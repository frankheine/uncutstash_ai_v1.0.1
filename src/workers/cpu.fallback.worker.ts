// src/workers/cpu.fallback.worker.ts
import { Wllama } from '@wllama/wllama';

// 1. The WASM Polyfill
// Strictly required for the emscripten-generated WASM glue inside @wllama/wllama 
// to prevent crashes in the background thread.
if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

let wllamaInstance: Wllama | null = null;
const CONFIG_PATHS = { default: '/wasm/wllama.wasm' };

self.onmessage = async (event: MessageEvent) => {
    const { action, payload, id, type, prompt, context, systemInstructions, modelPath } = event.data;

    try {
        if (action === 'INITIALIZE' || type === 'INIT_CPU') {
            console.log("[CPU Fallback Worker] Booting WASM SIMD Engine...");
            // Automatically detect hardware concurrency for multithreading
            const nThreads = Math.min(navigator.hardwareConcurrency ?? 4, 4);

            wllamaInstance = new Wllama(CONFIG_PATHS, { suppressNativeLog: true });
            await wllamaInstance.loadModelFromUrl(payload?.modelUrl || modelPath, {
                n_ctx: 2048,
                n_gpu_layers: 0, // Strictly CPU execution
                n_threads: nThreads,
            });

            self.postMessage({ id, status: 'ready' });
            return;
        }

        if (action === 'GENERATE' || type === 'GENERATE_CPU') {
            if (!wllamaInstance) throw new Error("CPU Engine not initialized.");

            const safeContext = context || "No context available.";
            const userPrompt = prompt || payload?.prompt || "";

            // Structure chat messages as an array of structured objects.
            // Pass a single object {} that contains the messages array inside it
            await wllamaInstance.createChatCompletion({
                messages: [
                    { role: 'system', content: systemInstructions || "You are an AI." },
                    { role: 'user', content: `Context:\n${safeContext}\n\nQuery:\n${userPrompt}` }
                ],
                max_tokens: 512,
                temperature: 0.2,
                onNewToken: (token, piece, currentText) => {
                    self.postMessage({ id, status: "progress", delta: piece });
                }
            }).then((response: any) => {
                const responseText = response.choices ? response.choices[0].message.content : (response.text || response);
                self.postMessage({ id, status: 'success', text: responseText });
            }).catch((err: any) => {
                self.postMessage({ id, status: 'error', message: err.message });
            });
        }
    } catch (error: any) {
        console.error("[CPU Fallback Worker Error]:", error);
        self.postMessage({ id, status: 'error', message: error.message });
    }
};