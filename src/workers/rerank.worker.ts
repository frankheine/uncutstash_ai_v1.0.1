import { pipeline, env } from '@huggingface/transformers';

// Strictly enforce the air-gap for the Sovereign Core
// Tell the library to look in the Vite public directory
// Enforce strict offline operations
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

let reranker: any = null;

self.onmessage = async (event: MessageEvent) => {
    const { query, candidates, id } = event.data;

    try {
        if (!reranker) {
            console.log("[Rerank Worker] Initializing Cross-Encoder...");
            // Force CPU: reranker only processes top-10 candidates and CPU is
            // fast enough. WebGPU is reserved exclusively for the inference worker
            // to prevent [Invalid ShaderModule] shader collisions across workers.
            reranker = await pipeline('text-classification', 'Xenova/bge-reranker-v2-m3', {
                device: 'wasm',
                quantized: true,
                dtype: 'q8',
                progress_callback: (data: any) => {
                    if (data.status === 'progress' && typeof data.progress === 'number') {
                        self.postMessage({ id, status: 'progress', log: `Loading Cross-Encoder Weights: ${Math.round(data.progress)}%` });
                    } else {
                        self.postMessage({ id, status: 'progress', log: `Loading Cross-Encoder Weights: ${data.status || 'Downloading'}...` });
                    }
                }
            } as any); // 👈 Added 'as any' to bypass strict model option validation
        }

        // Notify the UI that cross-encoder reranking has started
        self.postMessage({ id, status: 'progress', log: '🧠 Cross-encoder reranking candidates...' });

        const reranked: any[] = []; // 👈 Added explicit any[] type to prevent 'never' array inference
        for (const doc of candidates) {
            // Evaluates text queries alongside document data strings simultaneously
            const result = await reranker(query, doc.text);
            reranked.push({ ...doc, rerankScore: result[0].score });
        }

        // Sort by highest confidence scores
        reranked.sort((a: any, b: any) => b.rerankScore - a.rerankScore); // 👈 Added explicit types to parameters

        // Notify the UI that reranking is complete
        self.postMessage({ id, status: 'progress', log: `✨ Reranked — top ${Math.min(5, reranked.length)} passages selected.` });

        // Return top 5 optimised matches; status:'success' required for runWorker to resolve
        self.postMessage({ id, status: 'success', reranked: reranked.slice(0, 5) });
    } catch (error: any) {
        console.error("[Rerank Worker Error]:", error);
        // status:'error' lets runWorker reject cleanly
        self.postMessage({ id, status: 'error', message: error.message });
    }
};