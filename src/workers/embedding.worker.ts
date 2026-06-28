import { pipeline, env } from '@huggingface/transformers';

// Enable remote fetching as a fallback when local model files are missing
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.localModelPath = self.location.origin + '/models/';
env.useBrowserCache = true;

// 2. Force WASM execution binaries to resolve via public CDN to prevent MIME type issues
env.backends.onnx.wasm!.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/';
// 3. Disable ONNX multi-threading so it doesn't spawn sub-blob workers that violate Vite's MIME rules
env.backends.onnx.wasm!.numThreads = 1;

let extractor: any = null;
let initPromise: Promise<any> | null = null;

// Use standard self.onmessage syntax to match your existing pattern perfectly
self.onmessage = async (event: MessageEvent) => {
    const { text, taskId, action } = event.data;
    const replyPort = event.ports[0] || self;

    try {
        // Initialize pipeline on warmup without running inference
        if (action === 'WAKEUP' || text === undefined || text === null) {
            if (!extractor) {
                if (!initPromise) {
                    initPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                        device: 'wasm',
                        quantized: true,
                        progress_callback: (data: any) => {
                            if (data.status === 'progress' && typeof data.progress === 'number') {
                                replyPort.postMessage({ taskId, status: 'progress', log: `Loading Embedding Weights: ${Math.round(data.progress)}%` });
                            } else {
                                replyPort.postMessage({ taskId, status: 'progress', log: `Loading Embedding Weights: ${data.status || 'Downloading'}...` });
                            }
                        }
                    } as any);
                }
                extractor = await initPromise;
            }
            // Warmup successful — return empty embedding
            replyPort.postMessage({ taskId, status: 'success', embedding: [] });
            return;
        }

        if (!extractor) {
            if (!initPromise) {
                // It looks for: /models/Xenova/all-MiniLM-L6-v2/config.json
                // Force CPU: embeddings are fast on CPU and WebGPU must be reserved
                // exclusively for the inference worker (Web-LLM / Qwen2) to prevent
                // [Invalid ShaderModule] shader collisions across workers.
                initPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                    device: 'wasm',
                    quantized: true,
                    progress_callback: (data: any) => {
                        if (data.status === 'progress' && typeof data.progress === 'number') {
                            replyPort.postMessage({ taskId, status: 'progress', log: `Loading Embedding Weights: ${Math.round(data.progress)}%` });
                        } else {
                            replyPort.postMessage({ taskId, status: 'progress', log: `Loading Embedding Weights: ${data.status || 'Downloading'}...` });
                        }
                    }
                } as any); // 👈 Added 'as any' to bypass strict model option validation
            }
            extractor = await initPromise;
        }

        if (action === 'WAKEUP') {
            replyPort.postMessage({ taskId, status: 'success', embedding: [] });
            return;
        }

        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        replyPort.postMessage({ taskId, status: 'success', embedding });
    } catch (error: any) {
        console.error("[Embedding Worker Error]:", error);
        // Crucial for debugging local file-loading issues
        replyPort.postMessage({ taskId, status: 'error', message: `Worker error: ${error.message}` });
        initPromise = null;
    }
};