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
export let currentExecutionMode: ExecutionMode = 'edge';

export function setExecutionMode(mode: ExecutionMode) {
    currentExecutionMode = mode;
    console.log(`[Pipeline] Execution mode set to: ${mode}`);
}

const customModels: ExtendedModelRecord[] = [
    {
        model: "/models/DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC/",
        model_url: "/models/DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC/",
        model_id: "DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC",
        model_lib: "/wasm/DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC-webgpu.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
    },
    {
        model: "/models/Qwen3-0.6B-abliterated-MLC-q4f16_1/",
        model_url: "/models/Qwen3-0.6B-abliterated-MLC-q4f16_1/",
        model_id: "Qwen3-0.6B-abliterated-MLC-q4f16_1",
        model_lib: "/wasm/*****.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
    },
    {
        model: "/models/Qwen3-0.6B-abliterated-MLC-q4f16_1/",
        model_url: "/models/Qwen3-0.6B-abliterated-MLC-q4f16_1/",
        model_id: "Qwen3-0.6B-abliterated-MLC-q4f16_1",
        model_lib: "/wasm/*****.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
    },
    {
        model: "/models/Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC/",
        model_url: "/models/Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC/",
        model_id: "Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1500,
        low_resource_required: false,
    },
    {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_url: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1500,
        low_resource_required: false,
    },
    {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/",
        model_url: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/",
        model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1200,
        low_resource_required: false,
    },
    {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC/",
        model_url: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC/",
        model_id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-3B-Instruct/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-3B-Instruct/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 2500,
        low_resource_required: false,
    },
    {
        model: "/models/SNOWflake_v1.2_UNCUTstash-1B/",
        model_url: "/models/SNOWflake_v1.2_UNCUTstash-1B/",
        model_id: "SNOWflake_v1.2_UNCUTstash-1B",
        model_lib: "/wasm/SNOWflake_v1.0.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
    },
    {
        model: "/models/SNOWflake_v1.2_UNCUTstash-3B/",
        model_url: "/models/SNOWflake_v1.2_UNCUTstash-3B/",
        model_id: "SNOWflake_v1.2_UNCUTstash-3B",
        model_lib: "/wasm/SNOWflake_v1.0.wasm",
        model_lib_url: "/wasm/SNOWflake_v1.0.wasm",
        vram_required_MB: 2048,
        low_resource_required: false,
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
// PRIMARY BOOTSTRAP — GPU FIRST
// ============================================================================
export async function bootstrapSpeculativePipeline(
    targetModel: string,
    draftModel: string | null,
    progressCallback: (text: string) => void
) {
    // 1. Reset state for clean bootstrap
    if (currentEngine) {
        console.log(`[Pipeline] Unloading current engine to mount new target: ${targetModel}`);
        try { await currentEngine.unload(); } catch { /* ignore */ }
        currentEngine = null;
    }
    if (inferenceWorker) {
        inferenceWorker.terminate();
        inferenceWorker = null;
    }

    try {
        progressCallback("Probing WebGPU adapter & Secure Context...");

        // CRITICAL: WebGPU requires a Secure Context (HTTPS or localhost)
        if (!window.isSecureContext) {
            throw new Error("Insecure Context: WebGPU and OPFS require HTTPS or localhost. The browser has blocked hardware access.");
        }
        // CIRCUIT BREAKER: Strict WebGPU Enforcement
        if (!('gpu' in navigator)) {
            throw new Error("CIRCUIT BREAKER TRIPPED: navigator.gpu is undefined. Hardware acceleration is required. CPU fallback is disabled to prevent system lockup.");
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
                    ...customModels.map(model => {
                        const baseModel = { ...model };
                        if (baseModel.model_url && baseModel.model_url.startsWith('/')) {
                            baseModel.model_url = new URL(baseModel.model_url, self.location.origin).href;
                        }
                        if (baseModel.model_lib_url && baseModel.model_lib_url.startsWith('/')) {
                            baseModel.model_lib_url = new URL(baseModel.model_lib_url, self.location.origin).href;
                        }
                        if (baseModel.model && baseModel.model.startsWith('/')) {
                            baseModel.model = new URL(baseModel.model, self.location.origin).href;
                        }
                        return baseModel as ModelRecord;
                    }),
                    ...prebuiltAppConfig.model_list.map(model => {
                        const baseModel = { ...model };
                        (baseModel as ExtendedModelRecord).model_url = (model as ExtendedModelRecord).model_url || `https://huggingface.co/mlc-ai/${model.model_id}`;
                        baseModel.model_lib = new URL(`/wasm/${model.model_id}-webgpu.wasm`, self.location.origin).href;
                        (baseModel as ExtendedModelRecord).model_lib_url = new URL(`/wasm/${model.model_id}-webgpu.wasm`, self.location.origin).href;
                        return baseModel as ModelRecord;
                    })
                ]
            };
            configOpts.appConfig = appConfig;
        } else {
            // Edge mode: only inject custom models that have fully remote model URLs.
            // The abliterated model points to /models/ (local) so exclude it here.
            const prebuiltIds = new Set(
                prebuiltAppConfig.model_list.map(m => m.model_id)
            );
            const trueCustomModels = (customModels as ModelRecord[]).filter(
                m => !m.model.startsWith('/') && !prebuiltIds.has(m.model_id)
            );
            configOpts.appConfig = {
                ...prebuiltAppConfig,
                model_list: [...trueCustomModels, ...prebuiltAppConfig.model_list]
            };
        }

        currentEngine = (await CreateWebWorkerMLCEngine(
            inferenceWorker,
            targetModel,
            configOpts
        )) as unknown as MLCEngine;

        progressCallback("Warming up embedding engine...");
        try {
            await runWorker('embed', { action: 'WAKEUP' }, (msg) => {
                if (typeof msg === 'string') progressCallback(msg);
                else if ((msg as any).log) progressCallback((msg as any).log);
            });
        } catch (warmupErr) {
            console.warn("[Pipeline] Warmup error, but proceeding:", warmupErr);
        }

        progressCallback("✅ WebGPU engine online — sovereign intelligence active.");
        return currentEngine;

    } catch (gpuError: any) {
        let errorMessage = gpuError.message || String(gpuError);

        if (errorMessage.includes("Unexpected token '<'") || errorMessage.includes("is not valid JSON")) {
            errorMessage = "Local model files not found. Please switch to 'EDGE NETWORK' mode to download weights, or place them in public/models/.";
        } else if (errorMessage.includes("Failed to execute 'add' on 'Cache'") || errorMessage.includes("Request failed")) {
            errorMessage = "Model shard fetch failed. A required file (WASM lib or weight shard) returned a non-200 response. Check network connectivity, or try switching to the f32 model variant.";
        }

        console.error("[Pipeline] WebGPU bootstrap failed:", errorMessage);
        progressCallback(`🚨 FATAL: ${errorMessage}`);

        if (inferenceWorker) {
            inferenceWorker.terminate();
            inferenceWorker = null;
        }
        currentEngine = null;

        throw new Error(`WebGPU Initialization Failed: ${errorMessage}`);
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

            // PATH B: Nothing is initialized — reject immediately (Circuit Breaker)
            clearTimeout(timeoutId);
            reject(new Error(
                "CIRCUIT BREAKER: No inference engine available. WebGPU initialization failed."
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

        const channel = new MessageChannel();

        const handleResponse = (e: MessageEvent) => {
            if (e.data.taskId === taskId) {
                if (e.data.status === 'success') {
                    clearTimeout(timeoutId);
                    channel.port1.removeEventListener('message', handleResponse);
                    channel.port1.close();
                    resolve(e.data as T);
                } else if (e.data.status === 'log' && onProgress) {
                    onProgress(e.data.message);
                } else if (e.data.status === 'progress' && onProgress) {
                    onProgress(e.data);
                } else if (e.data.status === 'error') {
                    clearTimeout(timeoutId);
                    channel.port1.removeEventListener('message', handleResponse);
                    channel.port1.close();
                    reject(new Error(e.data.message));
                }
            }
        };

        channel.port1.addEventListener('message', handleResponse);
        channel.port1.start();

        worker.postMessage({ taskId, ...payload }, [channel.port2]);
    });
}