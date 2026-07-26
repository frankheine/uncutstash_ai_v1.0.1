// src/workers/inference.worker.ts
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

console.log("🛠️ [Inference Worker] Booting up...");

try {
    // This handler is the "walkie-talkie" that talks to pipeline.ts
    const handler = new WebWorkerMLCEngineHandler();
    
    self.onmessage = (msg: MessageEvent) => {
        handler.onmessage(msg);
    };
    
    console.log("🛠️ [Inference Worker] Handshake listener active.");
} catch (error) {
    console.error("🚨 [Inference Worker] Fatal crash during setup:", error);
}