import { pipeline, env } from '@huggingface/transformers';

// Enable remote fetching as a fallback in case local LFS pointer is corrupt
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.localModelPath = self.location.origin + '/models/';
env.useBrowserCache = true;

// 2. Force WASM execution binaries to resolve locally via the served public path
env.backends.onnx.wasm!.wasmPaths = self.location.origin + '/wasm/'; // 👈 Added ! to ensure it isn't evaluated as undefined

let extractor: any = null;

// Use standard self.onmessage syntax to match your existing pattern perfectly
self.onmessage = async (event: MessageEvent) => {
    const { text, id } = event.data;

    try {
        if (!extractor) {
            // It looks for: /models/Xenova/all-MiniLM-L6-v2/config.json
            // Force CPU: embeddings are fast on CPU and WebGPU must be reserved
            // exclusively for the inference worker (Web-LLM / Qwen2) to prevent
            // [Invalid ShaderModule] shader collisions across workers.
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                device: 'wasm',
                quantized: true,
                progress_callback: (data: any) => {
                    if (data.status === 'progress' && typeof data.progress === 'number') {
                        self.postMessage({ id, status: 'progress', log: `Loading Embedding Weights: ${Math.round(data.progress)}%` });
                    } else {
                        self.postMessage({ id, status: 'progress', log: `Loading Embedding Weights: ${data.status || 'Downloading'}...` });
                    }
                }
            } as any); // 👈 Added 'as any' to bypass strict model option validation
        }

        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        self.postMessage({ id, status: 'success', embedding });
    } catch (error: any) {
        console.error("[Embedding Worker Error]:", error);
        // Crucial for debugging local file-loading issues
        self.postMessage({ id, status: 'error', message: `Worker error: ${error.message}` });
    }
};