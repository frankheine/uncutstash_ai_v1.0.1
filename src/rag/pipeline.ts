// src/rag/pipeline.ts
import { CreateWebWorkerMLCEngine, AppConfig } from "@mlc-ai/web-llm";

export const MLC_APP_CONFIG: AppConfig = {
    model_list: [
        {
            // CHANGE: 'model_url' -> 'model'
            model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-1B/",

            // CHANGE: 'local_id' -> 'model_id'
            model_id: "SNOWflake_v1.2_UNCUTstash-1B",

            model_lib: "http://localhost:5173/wasm/FISHscale_v1.0.wasm"
        },
        {
            // CHANGE: 'model_url' -> 'model'
            model: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-3B/",

            // CHANGE: 'local_id' -> 'model_id'
            model_id: "SNOWflake_v1.2_UNCUTstash-3B",

            model_lib: "http://localhost:5173/wasm/SNOWflake_v1.0.wasm"
        }
    ]
};
// Instantiated worker endpoints requested by orchestrator.ts
export const workers = {
    embed: new Worker(new URL('../workers/embed.worker.ts', import.meta.url), { type: 'module' }),
    retrieve: new Worker(new URL('../workers/retrieve.worker.ts', import.meta.url), { type: 'module' }),
    rerank: new Worker(new URL('../workers/rerank.worker.ts', import.meta.url), { type: 'module' }),
    inference: new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' }),
};

let currentEngine: any = null;
let activeModelId: string | null = null;

/**
 * Initializes or swaps the background WebGPU engine for the inference worker channel.
 * Implements clean lifecycle disposal to avoid VRAM leaks across dropdown context mutations.
 */
export async function loadActiveModel(modelId: string, progressCallback: (text: string) => void) {
    // If the worker has already loaded a different model profile, sweep it to prevent OOM errors
    if (currentEngine && activeModelId !== modelId) {
        console.log(`[Pipeline] Purging VRAM footprint: Unloading ${activeModelId} to mount ${modelId}`);
        await currentEngine.unload();
        currentEngine = null;
    }

    if (!currentEngine) {
        // WebLLM CreateWebWorkerEngine proxies calls safely onto inference.worker.ts
        currentEngine = await CreateWebWorkerMLCEngine(workers.inference, modelId, {
            appConfig: MLC_APP_CONFIG,
            initProgressCallback: (progress) => {
                progressCallback(progress.text);
            }
        });
        activeModelId = modelId;
    }

    return currentEngine;
}

/**
 * Generalized LangGraph pipeline execution envelope.
 * Wraps worker message boundaries into standard promise states.
 */
export function runWorker<T>(
    worker: Worker,
    payload: any,
    onProgress?: (msg: any) => void
): Promise<T> {
    return new Promise((resolve, reject) => {
        const taskId = crypto.randomUUID();

        // Intercept native chat streaming states from the background execution channel
        if (worker === workers.inference && currentEngine) {
            const runGeneration = async () => {
                try {
                    const SYSTEM_INSTRUCTIONS = "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'. Use the provided context to answer questions accurately and concisely.";

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

                        // Stream the text tokens back to the application context dynamically
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

        // Standard static data transformation passage paths for embed/retrieve nodes
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