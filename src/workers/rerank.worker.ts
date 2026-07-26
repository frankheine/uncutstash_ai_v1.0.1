import { pipeline, env } from '@huggingface/transformers';

// Enable remote model fetching when local files aren't available
// Force WASM execution binaries to resolve via public CDN
env.backends.onnx.wasm!.wasmPaths = '/wasm/';
// Disable ONNX multi-threading so it doesn't spawn sub-blob workers that violate Vite's MIME rules
env.backends.onnx.wasm!.numThreads = 1;
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.useBrowserCache = false; // Add this here too!

let reranker: any = null;
let initPromise: Promise<any> | null = null;

self.onmessage = async (event: MessageEvent) => {
    const { query, candidates, taskId } = event.data;
    const replyPort = event.ports[0];
    if (!replyPort) {
        console.error("Rerank Worker] No reply port provided.");
        return;
    }

    try {
        if (!reranker) {
            if (!initPromise) {
                console.log("[Rerank Worker] Initializing Cross-Encoder...");
                // Force CPU: reranker only processes top-10 candidates and CPU is
                // fast enough. WebGPU is reserved exclusively for the inference worker
                // to prevent [Invalid ShaderModule] shader collisions across workers.
                initPromise = pipeline('text-classification', 'Xenova/bge-reranker-v2-m3/', {
                    device: 'wasm',
                    quantized: true,
                    progress_callback: (data: any) => {
                        if (data.status === 'progress' && typeof data.progress === 'number') {
                            replyPort.postMessage({ taskId, status: 'progress', log: `Loading Cross-Encoder Weights: ${Math.round(data.progress)}%` });
                        } else {
                            replyPort.postMessage({ taskId, status: 'progress', log: `Loading Cross-Encoder Weights: ${data.status || 'Downloading'}...` });
                        }
                    }
                } as any); // 👈 Added 'as any' to bypass strict model option validation
            }
            reranker = await initPromise;
        }

        // Notify the UI that cross-encoder reranking has started
        replyPort.postMessage({ taskId, status: 'progress', log: '🧠 Cross-encoder reranking candidates...' });

        const reranked: any[] = []; // 👈 Added explicit any[] type to prevent 'never' array inference
        for (const doc of candidates) {
            // Evaluates text queries alongside document data strings simultaneously
            const result = await reranker(query, doc.text);
            reranked.push({ ...doc, rerankScore: result[0].score });
        }

        // Sort by highest confidence scores
        reranked.sort((a: any, b: any) => b.rerankScore - a.rerankScore); // 👈 Added explicit types to parameters

        // Notify the UI that reranking is complete
        replyPort.postMessage({ taskId, status: 'progress', log: `✨ Reranked — top ${Math.min(5, reranked.length)} passages selected.` });

        // Return top 5 optimised matches; status:'success' required for runWorker to resolve
        replyPort.postMessage({ taskId, status: 'success', reranked: reranked.slice(0, 5) });
    } catch (error: any) {
        console.error("[Rerank Worker Error]:", error);
        // status:'error' lets runWorker reject cleanly
        replyPort.postMessage({ taskId, status: 'error', message: error.message });
        initPromise = null;
    }
};