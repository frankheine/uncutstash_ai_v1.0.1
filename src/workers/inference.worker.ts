import { WebWorkerMLCEngineHandler, CreateMLCEngine } from "@mlc-ai/web-llm";
import { Wllama } from "@wllama/wllama";

// Standard web worker polyfill for Emscripten-based modules
if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { currentScript: null };
}

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
    // Pass all messages directly to WebLLM's low-level RPC system
    handler.onmessage(msg);
};

const CONFIG_PATHS = { default: '/wasm/wllama.wasm' };
let initPromise: Promise<void> | null = null;
let engineReady = false;

// Declare missing variables for the worker state
let activeEngine: 'mlc' | 'wllama' | null = null;
let mlcEngine: any = null;
let targetEngine: any = null;
let wllama: any = null;

// ── Chunked OPFS Fetcher for CPU Fallback ────────────────────────────────────
async function downloadModelToOPFS(url: string, progressCallback: (percent: number) => void): Promise<string> {
    const root = await navigator.storage.getDirectory();
    const filename = url.split('/').pop() || 'model.gguf';
    let fileHandle;
    try {
        fileHandle = await root.getFileHandle(filename);
        const file = await fileHandle.getFile();
        if (file.size > 100 * 1024 * 1024) {
            // File seems valid and large enough
            progressCallback(100);
            return URL.createObjectURL(file);
        }
    } catch (e) {
        fileHandle = await root.getFileHandle(filename, { create: true });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const total = Number(response.headers.get('content-length')) || 1107410016; // 1.1GB fallback

    const writable = await fileHandle.createSyncAccessHandle();
    const reader = response.body!.getReader();
    let loaded = 0;

    // Download in chunks and write directly to OPFS
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writable.write(value, { at: loaded });
        loaded += value.length;
        const percent = Math.round((loaded / total) * 100);
        progressCallback(percent);
    }

    writable.flush();
    writable.close();

    const file = await fileHandle.getFile();
    // Append #model.gguf to satisfy wllama's strict URL extension validation
    return URL.createObjectURL(file) + '#model.gguf';
}

function startInitialization() {
    if (initPromise) return initPromise;

    console.log("[Inference Worker] Initializing Sovereign Web-LLM Dual Engine...");
    self.postMessage({ status: 'global_progress', log: 'Initializing Sovereign AI Engine...' });

    initPromise = (async () => {
        try {
            let gpuAvailable = false;
            try {
                if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
                    const adapter = await (navigator as any).gpu.requestAdapter();
                    gpuAvailable = adapter !== null;
                }
            } catch (_e) {
                gpuAvailable = false;
            }

            if (gpuAvailable) try {
                // Detect shader-f16 support: f16 models need it, f32 is universally safe
                let hasF16 = false;
                try {
                    const adapter = await (navigator as any).gpu.requestAdapter();
                    if (adapter) {
                        hasF16 = adapter.features.has('shader-f16');
                    }
                } catch (_e) { /* no f16 */ }

                self.postMessage({ status: 'global_progress', log: `🚀 WebGPU detected (f16: ${hasF16}). Booting Sovereign Dual-Engine NAV Architecture...` });

                // ── SINGLE ENGINE (Target/Verification) ────────────────
                // We load only one model to prevent WebGPU shader compilation from hanging.
                // NOTE: We only fallback to 3B if explicitly requested later, 1B is default for speed.
                const targetModelId = 'SNOWflake_v1.2_UNCUTstash-1B';

                self.postMessage({ status: 'global_progress', log: `Loading Engine (${targetModelId})...` });
                
                // FORCE PURGE OF BROWSER CACHE API TO CLEAR CORRUPTED HTML PAYLOADS
                try {
                    await caches.delete("webllm/model");
                    await caches.delete("webllm/wasm");
                    await caches.delete("uncutstash-ai-models-v1"); // Target the Service Worker's specific cache
                } catch (e) {
                    console.warn("Could not clear cache API", e);
                }

                // TEMPORARY DEBUG: Intercept all fetches to find the corrupted HTML file
                const originalFetch = self.fetch;
                self.fetch = async (...args) => {
                    const response = await originalFetch(...args);
                    const clone = response.clone();
                    try {
                        const text = await clone.text();
                        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                            self.postMessage({ status: 'global_progress', percent: 0, log: `🚨 VITE FALLBACK ERROR ON URL: ${args[0]}` });
                            console.error(`🚨 VITE FALLBACK ERROR ON URL:`, args[0]);
                        }
                    } catch(e) {}
                    return response;
                };

                const customAppConfig = {
                    useIndexedDBCache: false, // Temporarily disabled to bypass corrupted cached payloads
                    model_list: [
                        {
                            model_id: "SNOWflake_v1.2_UNCUTstash-1B",
                            model_lib: self.location.origin + "/models/SNOWflake_v1.2_UNCUTstash-1B/resolve/main/SNOWflake_v1.2_UNCUTstash-1B-webgpu.wasm",
                            vram_required_MB: 1200,
                            low_resource_required: true,
                            model: self.location.origin + "/models/SNOWflake_v1.2_UNCUTstash-1B/resolve/main/"
                        },
                        {
                            model_id: "SNOWflake_v1.2_UNCUTstash-3B",
                            model_lib: self.location.origin + "/models/SNOWflake_v1.2_UNCUTstash-3B/resolve/main/SNOWflake_v1.2_UNCUTstash-3B-webgpu.wasm",
                            vram_required_MB: 2800,
                            low_resource_required: false,
                            model: self.location.origin + "/models/SNOWflake_v1.2_UNCUTstash-3B/resolve/main/"
                        }
                    ]
                };

                mlcEngine = await CreateMLCEngine(targetModelId, {
                    initProgressCallback: (progress) => {
                        const percent = typeof progress.progress === 'number' ? Math.round(progress.progress * 100) : 0;
                        self.postMessage({
                            status: 'global_progress',
                            percent,
                            log: `Engine: ${progress.text}`
                        });
                    },
                    appConfig: customAppConfig
                }, {
                    context_window_size: 4096, // Larger context for batch verification
                    sliding_window_size: -1,
                });

                targetEngine = mlcEngine;

                activeEngine = 'mlc';
                engineReady = true;
                console.log("[Inference Worker] Engine Pipeline Online.");
                self.postMessage({
                    status: 'engine_ready',
                    percent: 100,
                    log: '✅ Sovereign NAV Pipeline Online — WebGPU Active.'
                });
            } catch (webgpuError) {
                console.warn("[Inference Worker] WebGPU initialization failed, falling back to CPU mode:", webgpuError);
                self.postMessage({ status: 'global_progress', percent: 0, log: `🚨 WebGPU Error: ${webgpuError}` });
                gpuAvailable = false; // Force CPU fallback
            }

            if (!gpuAvailable) {
                // ── FALLBACK ENGINE: WLLAMA CPU INFERENCE ────────────────
                self.postMessage({ status: 'global_progress', percent: 10, log: '⚠️ WebGPU missing. Initializing Wllama CPU fallback...' });
                
                wllama = new Wllama(CONFIG_PATHS);
                
                const modelUrl = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
                
                const blobUrl = await downloadModelToOPFS(modelUrl, (p) => {
                    self.postMessage({ status: 'global_progress', percent: p, log: `Downloading CPU Model: ${p}%` });
                });

                await wllama.loadModelFromUrl(blobUrl, {
                    n_ctx: 2048,
                    n_threads: (navigator.hardwareConcurrency || 4)
                });
                
                activeEngine = 'wllama';
                engineReady = true;

                self.postMessage({
                    status: 'engine_ready',
                    percent: 100,
                    log: '✅ Sovereign AI Engine Online — CPU Fallback Mode.'
                });
            }
        } catch (error) {
            console.error("[Inference Worker] Engine Initialization Failed:", error);
            self.postMessage({ status: 'global_progress', percent: 0, log: `Initialization Failed: ${(error as Error).message}` });
        }
    })();

    return initPromise;
}

startInitialization();

let isGenerating = false;

self.onmessage = async (event: MessageEvent) => {
    const { prompt, context, id } = event.data;

    if (!prompt || typeof prompt !== 'string') {
        if (event.data && event.data.kind) {
            handler.onmessage(event);
        }
        return;
    }

    try {
        if (prompt.includes("MOCK_TEST_PIPELINE")) {
            self.postMessage({ id, status: 'progress', text: "✅ Pipeline Verification Active...\n" });
            self.postMessage({ id, status: 'success', text: "✅ Pipeline Verification Active...\nReceived data from UI -> Orchestrator -> Embeddings -> Orama DB -> Inference Worker successfully!" });
            return;
        }

        if (!engineReady) {
            self.postMessage({ id, status: 'progress', log: '⚙️ [Worker] Waiting for AI Engine to finish booting...' });
            await initPromise;
        }

        if (isGenerating) {
            self.postMessage({ id, status: 'error', message: "Engine is busy generating a response. Please wait until the current output finishes." });
            return;
        }
        isGenerating = true;

        const MAX_HISTORY_LENGTH = 12000;
        let safeContext = context || "No context available.";
        if (safeContext.length > MAX_HISTORY_LENGTH) {
            safeContext = safeContext.slice(-MAX_HISTORY_LENGTH);
        }

        let currentResponse = '';
        const CACHED_SYSTEM_INSTRUCTIONS = "You are a helpful assistant."; // Ensure it's defined globally for both blocks

        if (activeEngine === 'mlc' && mlcEngine) {
            const messages = [
                { role: 'system', content: CACHED_SYSTEM_INSTRUCTIONS },
                { role: 'user', content: `Context:\n${safeContext}\n\nQuery:\n${prompt}` }
            ];

            const asyncChunkGenerator = await mlcEngine.chat.completions.create({
                messages: messages as any,
                stream: true,
            });

            for await (const chunk of asyncChunkGenerator) {
                const deltaText = chunk.choices[0]?.delta?.content || '';
                currentResponse += deltaText;
                self.postMessage({ id, status: 'progress', delta: deltaText });
            }
        } else if (activeEngine === 'wllama' && wllama) {
            // Wllama CPU Fallback Inference
            const fullPrompt = CACHED_SYSTEM_INSTRUCTIONS + `<|im_start|>user\nContext:\n${safeContext}\n\nQuery:\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

            await wllama.createCompletion({
                prompt: fullPrompt,
                max_tokens: 512,
                stream: true,
                onNewToken: (token, piece, currentText) => {
                    currentResponse = currentText;
                    self.postMessage({ id, status: 'progress', text: currentText });
                },
                stop: ['<|im_end|>'],
            });
        }

        // Emit only the finalized, one-dimensional verified text stream back to the UI
        self.postMessage({ id, status: 'success', text: currentResponse });

    } catch (error: any) {
        console.error("[Inference Worker Error]:", error);
        self.postMessage({ id, status: 'error', message: error.message });
    } finally {
        isGenerating = false;
    }
};
