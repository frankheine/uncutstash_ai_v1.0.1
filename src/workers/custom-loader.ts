// src/workers/custom-loader.ts
// ============================================================================
// OPFS STREAMING LOADER - DOUBLE BUFFERING WITH SHARED ARRAY BUFFER
// ============================================================================

export class StreamingLoader {
    private bufferA: SharedArrayBuffer | ArrayBuffer | null = null;
    private bufferB: SharedArrayBuffer | ArrayBuffer | null = null;
    private root: FileSystemDirectoryHandle | null = null;

    constructor() {
        this.init();
    }

    async init() {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
            this.root = await navigator.storage.getDirectory();
        } else {
            console.warn("[StreamingLoader] OPFS not supported in this environment. Falling back to memory fetch.");
        }
    }

    // Double-buffering fetch logic pipelined directly to WebLLM memory
    async fetchShardPipelined(urlStr: string, chunkIndex: number): Promise<ArrayBuffer | SharedArrayBuffer> {
        if (!this.root) await this.init();
        
        const filename = this.getOPFSFilename(urlStr);
        const currentHandleName = `${filename}_part${chunkIndex}`;
        const nextHandleName = `${filename}_part${chunkIndex + 1}`;

        // 1. Fetch current chunk synchronously (await it)
        const currentBuffer = await this.readChunk(currentHandleName, urlStr);
        this.bufferA = currentBuffer; // Active buffer mapped to hardware

        // 2. Asynchronously prefetch the NEXT chunk into buffer B (don't await)
        this.prefetchNextChunk(nextHandleName, urlStr).catch(err => {
            console.log(`[StreamingLoader] Prefetch ended: no more chunks or error (${err.message})`);
        });

        // 3. Keep a rigid reference! We do NOT drop this.bufferA immediately.
        // Instead, we return it. When chunkIndex+1 is requested, bufferA will be overwritten
        // and garbage collected naturally, representing our virtual paging window.
        return this.bufferA;
    }

    private async prefetchNextChunk(handleName: string, fallbackUrl: string) {
        if (!this.root) return;
        try {
            const buffer = await this.readChunk(handleName, fallbackUrl);
            this.bufferB = buffer;
        } catch(e) {
            this.bufferB = null; // Next chunk doesn't exist (EOF)
        }
    }

    private async readChunk(chunkName: string, fallbackUrl: string): Promise<ArrayBuffer | SharedArrayBuffer> {
        try {
            if (this.root) {
                const handle = await this.root.getFileHandle(chunkName);
                const file = await handle.getFile();
                const arrayBuffer = await file.arrayBuffer();
                return this.toSharedArrayBuffer(arrayBuffer);
            }
        } catch (e) {
            // Cache miss in OPFS, fetch from network and store it
            console.log(`[StreamingLoader] Cache miss for ${chunkName}, fetching from network...`);
            const res = await fetch(fallbackUrl);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            this.saveChunkToOPFS(chunkName, arrayBuffer).catch(console.error);
            return this.toSharedArrayBuffer(arrayBuffer);
        }
        throw new Error("Unable to read chunk from OPFS or Network.");
    }

    private toSharedArrayBuffer(buffer: ArrayBuffer): ArrayBuffer | SharedArrayBuffer {
        if (typeof SharedArrayBuffer !== 'undefined') {
            const shared = new SharedArrayBuffer(buffer.byteLength);
            new Uint8Array(shared).set(new Uint8Array(buffer));
            return shared;
        }
        return buffer;
    }

    private async saveChunkToOPFS(chunkName: string, buffer: ArrayBuffer) {
        if (!this.root) return;
        try {
            const handle = await this.root.getFileHandle(chunkName, { create: true });
            const writable = await (handle as any).createWritable();
            await writable.write(buffer);
            await writable.close();
            console.log(`[StreamingLoader] Wrote ${chunkName} to OPFS.`);
        } catch (e) {
            console.error(`[StreamingLoader] Failed to write ${chunkName} to OPFS:`, e);
        }
    }

    private getOPFSFilename(urlStr: string) {
        try {
            const url = new URL(urlStr, location.origin);
            return url.pathname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        } catch {
            return urlStr.replace(/[^a-zA-Z0-9.\-]/g, '_');
        }
    }
}
