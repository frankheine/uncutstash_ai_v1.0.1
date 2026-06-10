// src/rag/pipeline.ts
import { CreateWebWorkerMLCEngine, AppConfig } from "@mlc-ai/web-llm";

export const getMLCAppConfig = (useZeroCopy: boolean, hasF16: boolean): AppConfig => {
    const wasmVersion = hasF16 ? "FISHscale_v1.0.wasm" : "FISHscale_v1.0_f32.wasm"; // Fallback placeholder
    
    return {
        useIndexedDBCache: !useZeroCopy, // Zero-copy stream directly to VRAM if true
        model_list: [
            {
                model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-1B/",
                model_id: "SNOWflake_v1.2_UNCUTstash-1B",
                model_lib: `http://localhost:5173/wasm/${wasmVersion}`
            },
            {
                model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-3B/",
                model_id: "SNOWflake_v1.2_UNCUTstash-3B",
                model_lib: "http://localhost:5173/wasm/SNOWflake_v1.0.wasm"
            }
        ]
    };
};

// Explicit Worker type keys for strict compilation tracking
export type WorkerType = 'embed' | 'retrieve' | 'rerank' | 'inference';

let embedWorker: Worker | null = null;
let retrieveWorker: Worker | null = null;
let rerankWorker: Worker | null = null;
let inferenceWorker: Worker | null = null;

let currentEngine: any = null;
let activeModelId: string | null = null;

export const getWorkers = {
    getEmbed: () => {
        if (!embedWorker) embedWorker = new Worker(new URL('../workers/embed.worker.ts', import.meta.url), { type: 'module' });
        return embedWorker;
    },
    getRetrieve: () => {
        if (!retrieveWorker) retrieveWorker = new Worker(new URL('../workers/retrieve.worker.ts', import.meta.url), { type: 'module' });
        return retrieveWorker;
    },
    getRerank: () => {
        if (!rerankWorker) rerankWorker = new Worker(new URL('../workers/rerank.worker.ts', import.meta.url), { type: 'module' });
        return rerankWorker;
    },
    getInference: () => {
        if (!inferenceWorker) inferenceWorker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' });
        return inferenceWorker;
    }
};

export async function loadActiveModel(modelId: string, progressCallback: (text: string) => void, useZeroCopy = true) {
    if (currentEngine && activeModelId !== modelId) {
        console.log(`[Pipeline] Purging VRAM footprint: Unloading ${activeModelId} to mount ${modelId}`);
        await currentEngine.unload();
        currentEngine = null;
    }

    if (!currentEngine) {
        let hasF16 = false;
        try {
            if (navigator.gpu) {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) hasF16 = adapter.features.has('shader-f16');
            }
        } catch (e) {
            console.warn("GPU Adapter check failed", e);
        }

        console.log(`[Pipeline] Initializing Engine (ZeroCopy: ${useZeroCopy}, F16: ${hasF16})`);

        const targetWorker = getWorkers.getInference();
        currentEngine = await CreateWebWorkerMLCEngine(targetWorker, modelId, {
            appConfig: getMLCAppConfig(useZeroCopy, hasF16),
            initProgressCallback: (progress) => {
                progressCallback(progress.text);
            }
        });
        activeModelId = modelId;
    }
    return currentEngine;
}

export function runWorker<T>(
    targetWorkerType: WorkerType, // Enforce our strict union literal type here
    payload: any,
    onProgress?: (msg: any) => void
): Promise<T> {
    return new Promise((resolve, reject) => {
        const taskId = crypto.randomUUID();

        let worker: Worker;
        if (targetWorkerType === 'embed') worker = getWorkers.getEmbed();
        else if (targetWorkerType === 'retrieve') worker = getWorkers.getRetrieve();
        else if (targetWorkerType === 'rerank') worker = getWorkers.getRerank();
        else worker = getWorkers.getInference();

        if (targetWorkerType === 'inference' && currentEngine) {
            const runGeneration = async () => {
                try {
                    const SYSTEM_INSTRUCTIONS = "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'.";
                    const promptContent = `${SYSTEM_INSTRUCTIONS}\n\nContext:\n${payload.context}\n\nUser: ${payload.prompt}`;

                    const response = await currentEngine.chat.completions.create({
                        messages: [{ role: "user", content: promptContent }],
                        temperature: 0.2,
                        stream: true
                    });

                    let fullResponseText = "";
                    for await (const chunk of response) {
                        const delta = chunk.choices[0]?.delta?.content || "";
                        fullResponseText += delta;
                        if (onProgress && delta) {
                            onProgress({ status: 'progress', delta });
                        }
                    }
                    resolve({ text: fullResponseText } as any);
                } catch (err) {
                    reject(err);
                }
            };
            runGeneration();
            return;
        }

        const handleResponse = (e: MessageEvent) => {
            if (e.data.taskId === taskId) {
                if (e.data.status === 'success') {
                    worker.removeEventListener('message', handleResponse);
                    resolve(e.data.result);
                } else if (e.data.status === 'log' && onProgress) {
                    onProgress(e.data.message);
                } else if (e.data.status === 'error') {
                    worker.removeEventListener('message', handleResponse);
                    reject(new Error(e.data.message));
                }
            }
        };

        worker.addEventListener('message', handleResponse);
        worker.postMessage({ taskId, ...payload });
    });
}