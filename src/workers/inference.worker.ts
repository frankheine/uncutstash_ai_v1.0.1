// src/workers/inference.worker.ts
// ============================================================================
// ELITE AUTONOMOUS INFERENCE WORKER
// Rebased onto the official Web-LLM Baseline architecture.
// Featuring Path B: OPFS ArrayBuffer Pre-fetch Pipeline for Zero-Latency
// ============================================================================
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Standard polyfill to prevent Emscripten-based driver tracking issues
if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

// ----------------------------------------------------------------------------
// PATH B: OPFS PING-PONG PRE-FETCH ENGINE
// ----------------------------------------------------------------------------
const prefetchPool = new Map<string, ArrayBuffer>();
const originalFetch = globalThis.fetch;

async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
}

async function saveToOPFS(filename: string, buffer: ArrayBuffer) {
    try {
        const root = await getOPFSRoot();
        const fileHandle = await root.getFileHandle(filename, { create: true });
        // @ts-ignore - createSyncAccessHandle is only available in workers
        const accessHandle = await fileHandle.createSyncAccessHandle();
        accessHandle.write(new Uint8Array(buffer));
        accessHandle.flush();
        accessHandle.close();
    } catch (e) {
        console.warn("[OPFS] Failed to cache shard:", filename, e);
    }
}

async function prefetchNextChunk(nextChunkNum: number) {
    const nextFilename = `shard-cat${nextChunkNum.toString().padStart(4, '0')}.bin`;
    if (prefetchPool.has(nextFilename)) return;

    try {
        const root = await getOPFSRoot();
        const fileHandle = await root.getFileHandle(nextFilename);
        // @ts-ignore
        const accessHandle = await fileHandle.createSyncAccessHandle();
        const size = accessHandle.getSize();
        const buffer = new ArrayBuffer(size);
        const view = new Uint8Array(buffer);
        accessHandle.read(view);
        accessHandle.close();
        
        prefetchPool.set(nextFilename, buffer);
        console.log(`[OPFS] Prefetched next shard to RAM: ${nextFilename}`);
    } catch {
        // Chunk not in OPFS yet (likely first-boot network load)
    }
}

function extractChunkNumber(url: string): number | null {
    const match = url.match(/ndarray-cache\.cat(\d+)\.bin/);
    return match ? parseInt(match[1], 10) : null;
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = input.toString();
    const chunkNum = extractChunkNumber(urlStr);

    if (chunkNum !== null) {
        const filename = `shard-cat${chunkNum.toString().padStart(4, '0')}.bin`;

        // 1. Check RAM Prefetch Pool (Ping-Pong Swap)
        if (prefetchPool.has(filename)) {
            const buffer = prefetchPool.get(filename)!;
            prefetchPool.delete(filename); // Free up RAM pool

            // Trigger Async Prefetch for NEXT chunk
            prefetchNextChunk(chunkNum + 1);
            return new Response(buffer);
        }

        // 2. Cache Miss in RAM, Fallback to OPFS Disk Read
        try {
            const root = await getOPFSRoot();
            const fileHandle = await root.getFileHandle(filename);
            // @ts-ignore
            const accessHandle = await fileHandle.createSyncAccessHandle();
            const size = accessHandle.getSize();
            const buffer = new ArrayBuffer(size);
            const view = new Uint8Array(buffer);
            accessHandle.read(view);
            accessHandle.close();

            console.log(`[OPFS] Synchronous Disk Read: ${filename}`);
            
            // Trigger Async Prefetch for NEXT chunk
            prefetchNextChunk(chunkNum + 1);
            return new Response(buffer);
        } catch {
            // 3. Not in OPFS yet. Fallback to Network (First Boot Penalty)
            console.log(`[OPFS] Cache Miss. Fetching from Network: ${filename}`);
            const response = await originalFetch(input, init);
            
            // Clone response to cache into OPFS asynchronously
            const cloned = response.clone();
            cloned.arrayBuffer().then(buffer => saveToOPFS(filename, buffer));
            
            prefetchNextChunk(chunkNum + 1);
            return response;
        }
    }

    // Pass-through for non-shard assets (JSON configs, tokenizer, etc.)
    return originalFetch(input, init);
};

// ----------------------------------------------------------------------------
// PIPELINE INITIALIZATION
// ----------------------------------------------------------------------------
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
    // CRITICAL FIX: Vite HMR and React DevTools send automated postMessages to all workers.
    // Web-LLM expects strict RPC formatting and throws "unknown uuid" if it parses them.
    if (!msg.data || typeof msg.data.uuid !== 'string') {
        return; // Ignore internal browser/devtool messages
    }
    try {
        handler.onmessage(msg);
    } catch (e) {
        console.warn("[OPFS Worker] Ignored malformed RPC message:", e);
    }
};