// src/workers/cpu.fallback.worker.ts
// ============================================================================
// CPU FALLBACK INFERENCE (WASM SIMD via wllama)
// Used when WebGPU is unavailable. Compatible with runWorker() taskId protocol.
// ============================================================================
import { Wllama } from '@wllama/wllama';

// Strictly required for the emscripten-generated WASM glue inside @wllama/wllama
if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

let wllamaInstance: Wllama | null = null;
let isInitializing = false;

// Default WASM paths — wllama needs these to find its own WASM runtime
const CONFIG_PATHS = {
    'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/dist/single-thread/wllama.wasm',
    'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/dist/multi-thread/wllama.wasm',
    'default': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/dist/single-thread/wllama.wasm'
};

self.onmessage = async (event: MessageEvent) => {
    const { action, payload, id, taskId, type, prompt, context, systemInstructions, modelPath } = event.data;

    // Use whichever ID is available (pipeline sends 'id', runWorker sends 'taskId')
    const messageId = id || taskId;

    try {
        // ── INITIALIZE ──────────────────────────────────────────────────────
        if (action === 'INITIALIZE' || type === 'INIT_CPU') {
            if (isInitializing) {
                self.postMessage({ id: messageId, taskId: messageId, status: 'error', message: 'Already initializing' });
                return;
            }
            isInitializing = true;

            console.log("[CPU Fallback Worker] Booting WASM SIMD Engine...");
            const nThreads = navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 4;

            try {
                wllamaInstance = new Wllama(CONFIG_PATHS, { suppressNativeLog: true });

                const modelUrl = payload?.modelUrl || modelPath ||
                    "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";

                await wllamaInstance.loadModelFromUrl(modelUrl, {
                    n_ctx: 2048,
                    n_gpu_layers: 0,
                    n_threads: nThreads,
                    progressCallback: (progress: any) => {
                        const pct = typeof progress === 'object' ? progress.loaded / progress.total : progress;
                        self.postMessage({
                            id: messageId,
                            taskId: messageId,
                            status: 'progress',
                            message: `Loading CPU model: ${Math.round((pct || 0) * 100)}%`
                        });
                    }
                });

                isInitializing = false;
                self.postMessage({ id: messageId, taskId: messageId, status: 'ready' });
            } catch (initErr: any) {
                isInitializing = false;
                throw initErr;
            }
            return;
        }

        // ── GENERATE ────────────────────────────────────────────────────────
        if (action === 'GENERATE' || type === 'GENERATE_CPU') {
            if (!wllamaInstance) {
                throw new Error("CPU Engine not initialized. Call INITIALIZE first.");
            }

            const safeContext = context || "No context available.";
            const userPrompt = prompt || payload?.prompt || "";
            const sysInstructions = systemInstructions || "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'.";

            self.postMessage({
                id: messageId,
                taskId: messageId,
                status: 'progress',
                message: '🔧 CPU engine generating response...'
            });

            // Use the createChatCompletion API
            const makeCompletion = (wllamaInstance as any).createChatCompletion.bind(wllamaInstance);

            let fullText = "";

            const response = await makeCompletion([
                { role: 'system', content: sysInstructions },
                { role: 'user', content: `Context:\n${safeContext}\n\nQuery:\n${userPrompt}` }
            ], {
                max_tokens: 512,
                temperature: 0.2,
                onNewToken: (_token: any, piece: any, _currentText: any) => {
                    fullText += piece;
                    self.postMessage({
                        id: messageId,
                        taskId: messageId,
                        status: 'progress',
                        delta: piece
                    });
                }
            });

            // Extract the final text
            const responseText = response?.choices?.[0]?.message?.content
                || response?.text
                || fullText
                || String(response);

            self.postMessage({
                id: messageId,
                taskId: messageId,
                status: 'success',
                text: responseText,
                result: { text: responseText }
            });
        }
    } catch (error: any) {
        console.error("[CPU Fallback Worker Error]:", error);
        self.postMessage({
            id: messageId,
            taskId: messageId,
            status: 'error',
            message: error.message || String(error)
        });
    }
};
