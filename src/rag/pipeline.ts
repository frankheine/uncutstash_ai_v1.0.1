// src/rag/pipeline.ts
import { CreateWebWorkerMLCEngine, AppConfig } from "@mlc-ai/web-llm";

export const MLC_APP_CONFIG: AppConfig = {
    model_list: [
        {
            model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-1B/",
            model_id: "SNOWflake_v1.2_UNCUTstash-1B",
            model_lib: "http://localhost:5173/wasm/FISHscale_v1.0.wasm"
        },
        {
            model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-3B/",
            model_id: "SNOWflake_v1.2_UNCUTstash-3B",
            model_lib: "http://localhost:5173/wasm/SNOWflake_v1.0.wasm"
        }
    ]
};

// Lazy initialization references to keep the file parsing clean
let embedWorker: Worker | null = null;
let retrieveWorker: Worker | null = null;
let rerankWorker: Worker | null = null;
let inferenceWorker: Worker | null = null;

let currentEngine: any = null;
let activeModelId: string | null = null;

// Dynamic, production-isolated lookup functions that avoid AST parsing compiler hangs
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

export async function loadActiveModel(modelId: string, progressCallback: (text: string) => void) {
    if (currentEngine && activeModelId !== modelId) {
        console.log(`[Pipeline] Purging VRAM footprint: Unloading ${activeModelId} to mount ${modelId}`);
        await currentEngine.unload();
        currentEngine = null;
    }

    if (!currentEngine) {
        // Call the dynamic lookup accessor rather than a static dictionary property
        const targetWorker = getWorkers.getInference();

        currentEngine = await CreateWebWorkerMLCEngine(targetWorker, modelId, {
            appConfig: MLC_APP_CONFIG,
            initProgressCallback: (progress) => {
                progressCallback(progress.text);
            }
        });
        activeModelId = modelId;
    }

    return currentEngine;
}

export function runWorker<T>(
    targetWorkerType: 'embed' | 'retrieve' | 'rerank' | 'inference',
    payload: any,
    onProgress?: (msg: any) => void
): Promise<T> {
    return new Promise((resolve, reject) => {
        const taskId = crypto.randomUUID();

        // Dynamically retrieve the worker context matching the routing tag
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