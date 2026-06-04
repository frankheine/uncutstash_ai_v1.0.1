// src/rag/pipeline.ts
// Workers are lazily initialized on first access to prevent top-level
// module instantiation from crashing Vite HMR and non-browser environments.

let _workers: {
    embed: Worker;
    retrieve: Worker;
    rerank: Worker;
    inference: Worker;
} | null = null;

export function getWorkers() {
    if (!_workers) {
        _workers = {
            embed: new Worker(new URL('../workers/embeddings.worker.ts', import.meta.url), { type: 'module' }),
            retrieve: new Worker(new URL('../workers/retrieval.worker.ts', import.meta.url), { type: 'module' }),
            rerank: new Worker(new URL('../workers/rerank.worker.ts', import.meta.url), { type: 'module' }),
            inference: new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' }),
        };
    }
    return _workers;
}

// Backwards-compatible named export so orchestrator.ts doesn't need changes
export const workers = new Proxy({} as NonNullable<typeof _workers>, {
    get(_target, prop) {
        return getWorkers()[prop as keyof NonNullable<typeof _workers>];
    }
});

export function runWorker<T>(worker: Worker, payload: Record<string, unknown>, onProgress?: (msg: any) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        // Inject a UUID into every payload — used to match responses in the handler
        const id = crypto.randomUUID();

        const handler = (e: MessageEvent) => {
            if (e.data.id === id) {
                if (e.data.status === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(new Error(e.data.message || "Unknown worker error"));
                } else if (e.data.status === 'success') {
                    worker.removeEventListener('message', handler);
                    resolve(e.data as T);
                } else if (e.data.status === 'progress' && onProgress) {
                    onProgress(e.data);
                }
            }
        };

        worker.addEventListener('message', handler);

        // Spread the caller's payload and attach the generated ID
        // NOTE: Any `id` key in payload is intentionally overwritten here
        worker.postMessage({ ...payload, id });
    });
}