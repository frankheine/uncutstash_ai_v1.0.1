import { pipeline, env } from '@huggingface/transformers';

env.allowRemoteModels = true;
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.useBrowserCache = false;
// Explicitly map the files so ONNX never requests the missing .jsep.wasm file
env.backends.onnx.wasm!.wasmPaths = {
    'ort-wasm.wasm': self.location.origin + '/wasm/ort-wasm.wasm',
    'ort-wasm-simd.wasm': self.location.origin + '/wasm/ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm': self.location.origin + '/wasm/ort-wasm-threaded.wasm',
    'ort-wasm-simd-threaded.wasm': self.location.origin + '/wasm/ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.jsep.mjs': self.location.origin + '/wasm/ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.jsep.wasm': self.location.origin + '/wasm/ort-wasm-simd-threaded.jsep.wasm'
};

// UNLEASH MULTI-THREADING & SIMD
const availableCores = navigator.hardwareConcurrency || 4;
env.backends.onnx.wasm!.numThreads = Math.max(1, availableCores - 1);
env.backends.onnx.wasm!.simd = true;
env.backends.onnx.wasm!.proxy = false;

let extractor: any = null;
let initPromise: Promise<any> | null = null;

self.onmessage = async (event: MessageEvent) => {
    const replyPort = event.ports[0];
    if (!replyPort) {
        console.error("[Embedding Worker] No reply port.");
        return;
    }

    const { text, taskId, action } = event.data;

    try {
        if (!extractor) {
            if (!initPromise) {
                replyPort.postMessage({ taskId, status: 'progress', log: '🧬 Initializing embedding model...' });
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
            replyPort.postMessage({ taskId, status: 'progress', log: '✅ Embedding model ready.' });
        }

        if (action === 'WAKEUP' || text === undefined || text === null) {
            replyPort.postMessage({ taskId, status: 'success', embedding: [] });
            // DO NOT close the port here. The background progress_callback needs it to report loading status!
            return;
        }

        replyPort.postMessage({ taskId, status: 'progress', log: '🔢 Running inference...' });
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        replyPort.postMessage({ taskId, status: 'success', embedding });
        replyPort.close(); // FIX: Prevent half-open IPC memory leak

    } catch (error: any) {
        console.error("[Embedding Worker Error]:", error);
        initPromise = null;
        replyPort.postMessage({ taskId, status: 'error', message: `Embedding error: ${error.message}` });
        replyPort.close(); // FIX: Prevent half-open IPC memory leak
    }
};