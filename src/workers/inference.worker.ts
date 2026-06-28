/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
    // STRICT ALLOW-LIST: Web-LLM RPC messages ALWAYS have a 'kind' and 'uuid'
    if (!msg.data || typeof msg.data.kind !== 'string' || typeof msg.data.uuid !== 'string') {
        return;
    }

    try {
        handler.onmessage(msg);
    } catch (e) {
        console.warn("[Inference Worker] Context Loss or RPC Error:", e);
    }
};