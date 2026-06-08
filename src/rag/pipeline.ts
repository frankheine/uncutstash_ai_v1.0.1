// src/rag/pipeline.ts

export interface PipelineWorkers {
    embed: Worker;
    retrieve: Worker;
    rerank: Worker;
    inference: Worker;
    network: Worker;
}

let _workers: PipelineWorkers | null = null;

export function getWorkers(): PipelineWorkers {
    if (!_workers) {
        _workers = {
            embed: new Worker(new URL('../workers/embedding.worker.ts', import.meta.url), { type: 'module' }),
            retrieve: new Worker(new URL('../workers/retrieval.worker.ts', import.meta.url), { type: 'module' }),
            rerank: new Worker(new URL('../workers/rerank.worker.ts', import.meta.url), { type: 'module' }),
            inference: new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' }),
            network: new Worker(new URL('../workers/network.worker.ts', import.meta.url), { type: 'module' }),
        };
    }
    return _workers;
}

export const workers = new Proxy({} as PipelineWorkers, {
    get(_target, prop) {
        return getWorkers()[prop as keyof PipelineWorkers];
    }
}) as PipelineWorkers;

export function runWorker<T>(worker: Worker, payload: Record<string, unknown>, onProgress?: (msg: any) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        let timeout = setTimeout(() => {
            worker.removeEventListener('message', handler);
            reject(new Error(`Worker timeout after 300s — likely a model load failure`));
        }, 300_000);

        const handler = (e: MessageEvent) => {
            if (e.data.id !== id) return;

            if (e.data.status === 'error') {
                clearTimeout(timeout);
                worker.removeEventListener('message', handler);
                reject(new Error(e.data.message || 'Unknown worker error'));
            } else if (e.data.status === 'success') {
                clearTimeout(timeout);
                worker.removeEventListener('message', handler);
                resolve(e.data as T);
            } else if (e.data.status === 'progress') {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    worker.removeEventListener('message', handler);
                    reject(new Error(`Worker timeout after 300s — likely a model load failure`));
                }, 300_000);
                if (onProgress) onProgress(e.data);
            }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({ ...payload, id });
    });
}