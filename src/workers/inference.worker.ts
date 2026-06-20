// src/workers/inference.worker.ts
// ============================================================================
// ELITE AUTONOMOUS INFERENCE WORKER
// ============================================================================
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Standard polyfill to prevent Emscripten-based driver tracking issues
if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

// Initialize the standard Web-LLM handler
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
        console.warn("[Inference Worker] Ignored malformed RPC message:", e);
    }
};