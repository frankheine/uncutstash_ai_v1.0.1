// src/rag/pipeline.ts
import { CreateWebWorkerMLCEngine, prebuiltAppConfig, AppConfig, ModelRecord, MLCEngine, InitProgressReport, MLCEngineConfig } from "@mlc-ai/web-llm";
import { useSovereignStore } from '../store'; // Import the store

export type WorkerType = 'embed' | 'retrieve' | 'rerank' | 'inference' | 'network';

export interface ExtendedModelRecord extends ModelRecord {
    model_url?: string;
    model_lib_url?: string;
}

// --- 1. SOVEREIGN MODEL CATALOG ---
const customModels: ExtendedModelRecord[] = [
    {
        model: "/models/Qwen3-0.6B-abliterated-q4f16_1-MLC/",   // added -MLC
        model_id: "Qwen3-0.6B-abliterated-q4f16_1-MLC",
        model_lib: "/wasm/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1024,
        low_resource_required: true,
        required_features: ["shader-f16"], // <--- THE MISSING HARDWARE PERMISSION
    },
    // ADD THIS NEW BLOCK FOR YOUR F32 MODEL:
    {
        model_id: "Qwen2-0.5B-Instruct-q4f32_1-MLC",
        model: "/models/Qwen2-0.5B-Instruct-q4f32_1-MLC/", // Your local path
        model_lib: "/wasm/Qwen2-0.5B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 800,
        low_resource_required: true,
        required_features: [] // <--- Empty, because f32 works everywhere
    }
]

export function getModelList(): ExtendedModelRecord[] {
    return [...customModels, ...prebuiltAppConfig.model_list as ExtendedModelRecord[]];
}
let isGenerating = false;
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
    },
    // ADD THIS: The Real-Time RAM Flush
    killMemoryWorkers: () => {
        console.log("[Pipeline] 🧹 Flushing RAM: Terminating Embedding & Network workers...");
        if (embedWorker) { embedWorker.terminate(); embedWorker = null; }
        if (retrieveWorker) { retrieveWorker.terminate(); retrieveWorker = null; }
        if (rerankWorker) { rerankWorker.terminate(); rerankWorker = null; }
        if (networkWorker) { networkWorker.terminate(); networkWorker = null; }
    }
};

// ============================================================================
// PRIMARY BOOTSTRAP — GPU FIRST (Single Model Execution)
// ============================================================================
export async function bootstrapSovereignEngine(
    targetModel: string,
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

        if (!window.isSecureContext) {
            throw new Error("Insecure Context: WebGPU and OPFS require HTTPS or localhost.");
        }
        if (!('gpu' in navigator)) {
            throw new Error("CIRCUIT BREAKER TRIPPED: navigator.gpu is undefined. Hardware acceleration is required.");
        }

        // --- NEW: HARDWARE PROBE (Fixes Windows Crash & iOS Boot Loop) ---
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("No compatible GPU adapter found.");

        const supportsF16 = adapter.features.has("shader-f16");
        // Heuristic: iOS Safari strictly limits buffer sizes (usually 128MB or 256MB)
        const isStrictSandbox = adapter.limits.maxStorageBufferBindingSize <= 268435456;

        // DYNAMIC FALLBACK: If Windows doesn't support f16, force the f32 model you added

        if (!supportsF16 && targetModel.includes("f16")) {
            console.warn(`[Pipeline] shader-f16 not supported. Swapping to f32 fallback.`);
            targetModel = "Qwen2-0.5B-Instruct-q4f32_1-MLC";
            useSovereignStore.getState().setModel(targetModel); // sync UI
        }

        progressCallback(`Mounting WebGPU engine: ${targetModel}...`);

        inferenceWorker = new Worker(
            new URL('../workers/inference.worker.ts', import.meta.url),
            { type: 'module' }
        );

        // Catch silent worker errors that cause black screens
        inferenceWorker.onerror = (e) => {
            console.error("[Worker Error] Silent failure in inference worker:", e.message);
        };

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // 2. AGGRESSIVE RAM CLAMPING
        const maxContext = isIOS ? 1024 : 2048;

        const configOpts: MLCEngineConfig = {
            initProgressCallback: (progress: InitProgressReport) => {
                progressCallback(progress.text);
            }
        };

        // Get the accurate host website domain explicitly from the main window context
        const absoluteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

        // --- 2. APP CONFIG HANDLING (Clean Explicit Full Paths) ---
        const appConfig: AppConfig = {
            ...prebuiltAppConfig,
            model_list: [
                ...customModels.map(model => {
                    return {
                        model_id: model.model_id,
                        vram_required_MB: model.vram_required_MB,
                        low_resource_required: model.low_resource_required,
                        required_features: model.required_features,
                        // Directly forces the absolute web server origin right onto the paths
                        model: model.model.startsWith('/')
                            ? `${absoluteOrigin}${model.model}`
                            : model.model,

                        model_lib: model.model_lib.startsWith('/')
                            ? `${absoluteOrigin}${model.model_lib}`
                            : model.model_lib,

                        // THE FIX: Memory limits belong in ModelRecord.overrides!
                        overrides: {
                            context_window_size: maxContext,
                            sliding_window_size: -1, // Force WebGPU to drop old tokens from RAM
                        }
                    } as ModelRecord;
                }),
                ...prebuiltAppConfig.model_list
            ]
        };

        configOpts.appConfig = appConfig;

        // Reverted to 3 arguments. The 4th argument was causing the silent crash.
        currentEngine = (await CreateWebWorkerMLCEngine(
            inferenceWorker,
            targetModel,
            configOpts
        )) as unknown as MLCEngine;

        progressCallback("Warming up embedding engine...");
        try {
            // FIX: Added a strict 5000ms (5 second) timeout. 
            // If iOS Safari hangs on the embedding worker, we abort the warmup and proceed.
            await runWorker('embed', { action: 'WAKEUP' }, (msg) => {
                if (typeof msg === 'string') progressCallback(msg);
                else if ((msg as any).log) progressCallback((msg as any).log);
            }, 5000);
        } catch (warmupErr) {
            console.warn("[Pipeline] Warmup timed out or failed, but proceeding:", warmupErr);
            // Force the UI to update so it doesn't stay stuck on the warmup message
            progressCallback("Embedding warmup skipped. Finalizing boot...");
        }

        progressCallback("✅ WebGPU engine online — sovereign intelligence active.");
        return currentEngine;

    } catch (gpuError: any) {
        let errorMessage = gpuError.message || String(gpuError);
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
// UNIFIED WORKER DISPATCH
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

        if (targetWorkerType === 'inference') {
            if (currentEngine) {
                const runGeneration = async () => {
                    // FIX: Prevent concurrent WebGPU calls that destroy the buffer
                    if (isGenerating) {
                        reject(new Error("Engine is currently busy processing another request."));
                        return;
                    }
                    isGenerating = true;

                    try {
                        const SYSTEM_INSTRUCTIONS = payload.systemPrompt || "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'.";
                        const promptContent = `${SYSTEM_INSTRUCTIONS}\n\nContext:\n${payload.context}\n\nUser: ${payload.prompt}`;

                        if (onProgress) onProgress({ status: 'progress', log: '🧠 Generating response via WebGPU...' });

                        const response = await currentEngine!.chat.completions.create({
                            messages: [{ role: "user", content: promptContent }],
                            temperature: 0.2,
                            stream: true
                        });

                        let fullResponseText = "";
                        for await (const chunk of response) {
                            const delta = chunk.choices[0]?.delta?.content || "";
                            fullResponseText += delta;
                            if (onProgress && delta) onProgress({ status: 'progress', delta });
                        }
                        clearTimeout(timeoutId);
                        resolve({ text: fullResponseText } as unknown as T);
                    } catch (err) {
                        clearTimeout(timeoutId);
                        reject(err);
                    } finally {
                        // ALWAYS release the lock, even if it crashes
                        isGenerating = false;
                    }
                };
                runGeneration();
                return;
            }
            clearTimeout(timeoutId);
            reject(new Error("CIRCUIT BREAKER: No inference engine available."));
            return;
        }

        let worker: Worker;
        if (targetWorkerType === 'embed') worker = getWorkers.getEmbed();
        else if (targetWorkerType === 'retrieve') worker = getWorkers.getRetrieve();
        else if (targetWorkerType === 'rerank') worker = getWorkers.getRerank();
        else if (targetWorkerType === 'network') worker = getWorkers.getNetwork();
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