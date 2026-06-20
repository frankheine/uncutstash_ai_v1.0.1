// src/rag/pipeline.ts
// ============================================================================
// SOVEREIGN RAG PIPELINE — FIXED BOOTSTRAP WITH GPU→CPU FALLBACK
// ============================================================================
import { CreateWebWorkerMLCEngine, prebuiltAppConfig, AppConfig, ModelRecord, MLCEngine, InitProgressReport, MLCEngineConfig } from "@mlc-ai/web-llm";

export interface ExtendedModelRecord extends ModelRecord {
    model_url?: string;
    model_lib_url?: string;
}

// Explicit Worker type keys for strict compilation tracking
export type WorkerType = 'embed' | 'retrieve' | 'rerank' | 'inference';

export type ExecutionMode = 'local' | 'edge';

// DEFAULT TO EDGE: CDN-resolved WASMs work out of the box without local files
export let currentExecutionMode: ExecutionMode = 'edge'; // Set to edge by default to match UI

export function setExecutionMode(mode: ExecutionMode) {
    currentExecutionMode = mode;
    console.log(`[Pipeline] Execution mode set to: ${mode}`);
}

const customModels: ExtendedModelRecord[] = [
    {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/",
        model_url: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/",
        model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1500,
        low_resource_required: true,
    },
    {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
        model_url: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
        model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1500,
        low_resource_required: false,
    },
    {
        model: "/models/SNOWflake_v1.2_UNCUTstash-1B",
        model_url: "/models/SNOWflake_v1.2_UNCUTstash-1B",
        model_id: "SNOWflake_v1.2_UNCUTstash-1B",
        model_lib: "/wasm/SNOWflake_v1.2_UNCUTstash-1B-webgpu.wasm",
        model_lib_url: "/wasm/SNOWflake_v1.2_UNCUTstash-1B-webgpu.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
    }
];

export function getModelList(): ExtendedModelRecord[] {
    return [...customModels, ...prebuiltAppConfig.model_list as ExtendedModelRecord[]];
}

let embedWorker: Worker | null = null;
let retrieveWorker: Worker | null = null;
let rerankWorker: Worker | null = null;
let inferenceWorker: Worker | null = null;
let networkWorker: Worker | null = null;
const cpuFallbackWorker: Worker | null = null;

let currentEngine: MLCEngine | null = null;

export const getWorkers = {
    getEmbed: () => {
        if (!embedWorker) embedWorker = new Worker(new URL('../workers/embedding.worker.ts', import.meta.url), { type: 'module' });
        return embedWorker;
    },
    getRetrieve: () => {
        if (!retrieveWorker) retrieveWorker = new Worker(new URL('../workers/retrieval.worker.ts', import.meta.url), { type: 'module' });
        return retrieveWorker;
    },
    getRerank: () => {
        if (!rerankWorker) rerankWorker = new Worker(new URL('../workers/rerank.worker.ts', import.meta.url), { type: 'module' });
        return rerankWorker;
    },
    getInference: () => {
        if (!inferenceWorker) inferenceWorker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' });
        return inferenceWorker;
    },
    getNetwork: () => {
        if (!networkWorker) networkWorker = new Worker(new URL('../workers/network.worker.ts', import.meta.url), { type: 'module' });
        return networkWorker;
    }
};

// ============================================================================
// CPU FALLBACK REMOVED
// ============================================================================

// ============================================================================
// PRIMARY BOOTSTRAP — GPU FIRST, CPU FALLBACK
// ============================================================================
export async function bootstrapSpeculativePipeline(
    targetModel: string,
    draftModel: string | null,
    progressCallback: (text: string) => void
) {
    // Reset state for clean bootstrap
    if (currentEngine) {
        console.log(`[Pipeline] Unloading current engine to mount new target: ${targetModel}`);
        try { await currentEngine.unload(); } catch { /* ignore */ }
        currentEngine = null;
    }
    if (inferenceWorker) {
        inferenceWorker.terminate();
        inferenceWorker = null;
    }

    // ── STAGE 1: Try WebGPU via Web-LLM ────────────────────────────────────
    try {
        progressCallback("Probing WebGPU adapter...");
        if (!('gpu' in navigator)) { throw new Error("navigator.gpu is undefined. This browser or context does not expose the WebGPU API."); }

        progressCallback(`Validating model registry for ${targetModel}...`);

        // Ensure model.json is actually accessible and not intercepted by Vite SPA
        const targetModelConfig = getModelList().find(m => m.model_id === targetModel);
        if (targetModelConfig && targetModelConfig.model_url) {
            try {
                const modelJsonUrl = targetModelConfig.model_url.endsWith('/') ?
                    `${targetModelConfig.model_url}mlc-chat-config.json` :
                    `${targetModelConfig.model_url}/mlc-chat-config.json`;
                const hfToken = import.meta.env.VITE_HF_TOKEN || localStorage.getItem('HF_TOKEN');
                const headers: HeadersInit = {};
                if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

                const headCheck = await fetch(modelJsonUrl, { method: 'HEAD', headers });
                if (!headCheck.ok) {
                    const authMsg = headCheck.status === 401 ? ' (Gated model. Make sure VITE_HF_TOKEN is set in .env)' : '';
                    throw new Error(`Model weights not found at ${modelJsonUrl} (HTTP ${headCheck.status})${authMsg}`);
                }
                const contentType = headCheck.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    throw new Error(`Unexpected token < Error prevented. Model directory not found. Server intercepted with index.html.`);
                }
            } catch (validationErr: unknown) {
                console.error("[Pipeline] Pre-validation failed:", validationErr);
                throw new Error(`Model validation failed: ${(validationErr as Error).message}`, { cause: validationErr });
            }
        }

        progressCallback(`Mounting WebGPU engine: ${targetModel}...`);

        // Create fresh inference worker
        inferenceWorker = new Worker(
            new URL('../workers/inference.worker.ts', import.meta.url),
            { type: 'module' }
        );

        const configOpts: MLCEngineConfig = {
            initProgressCallback: (progress: InitProgressReport) => {
                progressCallback(progress.text);
            }
        };

        if (draftModel) {
            (configOpts as any).speculativeEngineConfig = {
                draft_model: draftModel
            };
        }

        // ── AppConfig handling ──────────────────────────────────────────────
        if (currentExecutionMode === 'local') {
            // Sovereign Local Mode: Override model_lib_url to point to local WASM directory
            const appConfig: AppConfig = {
                ...prebuiltAppConfig,
                model_list: [
                    ...customModels as ModelRecord[],
                    ...prebuiltAppConfig.model_list.map(model => {
                        const baseModel = { ...model };
                        (baseModel as ExtendedModelRecord).model_url = (model as ExtendedModelRecord).model_url || `https://huggingface.co/mlc-ai/${model.model_id}/resolve/main/`;
                        baseModel.model_lib = `/wasm/${model.model_id}-webgpu.wasm`;
                        (baseModel as ExtendedModelRecord).model_lib_url = `/wasm/${model.model_id}-webgpu.wasm`;
                        return baseModel as ModelRecord;
                    })
                ]
            };
            configOpts.appConfig = appConfig;
        } else {
            configOpts.appConfig = { ...prebuiltAppConfig, model_list: [...customModels as ModelRecord[], ...prebuiltAppConfig.model_list] };
        }
        // Edge mode: DON'T touch appConfig at all — let Web-LLM use its
        // built-in prebuiltAppConfig with correct jsdelivr CDN URLs

        currentEngine = (await CreateWebWorkerMLCEngine(
            inferenceWorker,
            targetModel,
            configOpts
        )) as unknown as MLCEngine;

        progressCallback("✅ WebGPU engine online — sovereign intelligence active.");
        return currentEngine;

    } catch (gpuError: unknown) {
        console.error("[Pipeline] WebGPU bootstrap failed:", (gpuError as Error).message || gpuError);
        progressCallback(`🚨 FATAL: WebGPU initialization failed. Hardware acceleration is strictly required.`);

        // Clean up the failed GPU worker
        if (inferenceWorker) {
            inferenceWorker.terminate();
            inferenceWorker = null;
        }
        currentEngine = null;

        throw new Error(`WebGPU is strictly required for this application but failed to initialize. Error: ${(gpuError as Error).message || gpuError}`, { cause: gpuError });
    }
}


// ============================================================================
// UNIFIED WORKER DISPATCH — HANDLES BOTH GPU ENGINE AND CPU FALLBACK
// ============================================================================
export function runWorker<T>(
    targetWorkerType: WorkerType,
    payload: Record<string, unknown>,
    onProgress?: (msg: unknown) => void,
    timeoutMs: number = 60000
): Promise<T> {
    return new Promise((resolve, reject) => {
        const taskId = crypto.randomUUID();

        const timeoutId = setTimeout(() => {
            reject(new Error(`Worker ${targetWorkerType} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        // ── INFERENCE PATH ──────────────────────────────────────────────────
        if (targetWorkerType === 'inference') {

            // PATH A: GPU Engine is alive — use the MLC chat completions API
            if (currentEngine) {
                const runGeneration = async () => {
                    try {
                        const SYSTEM_INSTRUCTIONS = payload.systemPrompt || "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'.";
                        const promptContent = `${SYSTEM_INSTRUCTIONS}\n\nContext:\n${payload.context}\n\nUser: ${payload.prompt}`;

                        if (onProgress) {
                            onProgress({ status: 'progress', log: '🧠 Generating response via WebGPU...' });
                        }

                        const response = await currentEngine!.chat.completions.create({
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
                        clearTimeout(timeoutId);
                        resolve({ text: fullResponseText } as unknown as T);
                    } catch (err) {
                        clearTimeout(timeoutId);
                        reject(err);
                    }
                };
                runGeneration();
                return;
            }

            // PATH B: CPU Fallback is alive
            if (cpuFallbackWorker) {
                const handleCpuResponse = (e: MessageEvent) => {
                    if (e.data.taskId === taskId || e.data.id === taskId) {
                        if (e.data.status === 'success') {
                            clearTimeout(timeoutId);
                            cpuFallbackWorker!.removeEventListener('message', handleCpuResponse);
                            resolve({ text: e.data.text || e.data.result?.text } as T);
                        } else if (e.data.status === 'progress' && onProgress) {
                            if (e.data.delta) onProgress({ status: 'progress', delta: e.data.delta });
                            else onProgress({ status: 'progress', log: e.data.message });
                        } else if (e.data.status === 'error') {
                            clearTimeout(timeoutId);
                            cpuFallbackWorker!.removeEventListener('message', handleCpuResponse);
                            reject(new Error(e.data.message));
                        }
                    }
                };
                cpuFallbackWorker.addEventListener('message', handleCpuResponse);
                cpuFallbackWorker.postMessage({
                    action: 'GENERATE',
                    taskId,
                    payload
                });
                return;
            }

            // PATH C: Nothing is initialized — reject immediately
            clearTimeout(timeoutId);
            reject(new Error(
                "No inference engine available. WebGPU initialization failed."
            ));
            return;
        }

        // ── NON-INFERENCE WORKERS (embed, retrieve, rerank) ─────────────────
        let worker: Worker;
        if (targetWorkerType === 'embed') worker = getWorkers.getEmbed();
        else if (targetWorkerType === 'retrieve') worker = getWorkers.getRetrieve();
        else if (targetWorkerType === 'rerank') worker = getWorkers.getRerank();
        else {
            clearTimeout(timeoutId);
            reject(new Error(`Unknown worker type: ${targetWorkerType}`));
            return;
        }

        const handleResponse = (e: MessageEvent) => {
            if (e.data.taskId === taskId) {
                if (e.data.status === 'success') {
                    clearTimeout(timeoutId);
                    worker.removeEventListener('message', handleResponse);
                    resolve(e.data as T);
                } else if (e.data.status === 'log' && onProgress) {
                    onProgress(e.data.message);
                } else if (e.data.status === 'progress' && onProgress) {
                    onProgress(e.data);
                } else if (e.data.status === 'error') {
                    clearTimeout(timeoutId);
                    worker.removeEventListener('message', handleResponse);
                    reject(new Error(e.data.message));
                }
            }
        };

        worker.addEventListener('message', handleResponse);
        worker.postMessage({ taskId, ...payload });
    });
}