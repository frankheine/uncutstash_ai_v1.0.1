export type { }; // Forces TypeScript to treat this file as an isolated module
declare const self: ServiceWorkerGlobalScope; // Maps the global 'self' keyword cleanly

// 🛠️ Vite PWA / Workbox Manifest Injection Placeholder Token
// The build pipeline looks for this exact string. Do not modify or delete this line.
// @ts-ignore
const precacheManifest = self.__WB_MANIFEST;

const MODEL_CACHE_NAME = "uncutstash-ai-models-v1";

// Helper to sanitize URL into a valid filename
function getOPFSFilename(urlStr: string) {
    const url = new URL(urlStr);
    return url.pathname.replace(/[^a-zA-Z0-9.\-]/g, '_');
}

// Custom OPFS Interface for safely chunking large weights
const OPFSCache = {
    async match(request: Request): Promise<Response | undefined> {
        try {
            const root = await navigator.storage.getDirectory();
            const filename = getOPFSFilename(request.url);
            
            const chunks: File[] = [];
            let chunkIndex = 0;
            while (true) {
                try {
                    const handle = await root.getFileHandle(`${filename}_part${chunkIndex}`);
                    chunks.push(await handle.getFile());
                    chunkIndex++;
                } catch(e) {
                    break;
                }
            }

            if (chunks.length > 0) {
                // Browsers natively stream File/Blob objects directly from disk
                // without loading the entire payload into the V8/JSC JS memory heap!
                const combinedBlob = new Blob(chunks, { type: 'application/octet-stream' });
                return new Response(combinedBlob, {
                    headers: {
                        "content-type": "application/octet-stream",
                        "content-length": combinedBlob.size.toString()
                    }
                });
            }
            return undefined;
        } catch(e) {
            return undefined;
        }
    },

    async put(request: Request, response: Response): Promise<void> {
        const root = await navigator.storage.getDirectory();
        const filename = getOPFSFilename(request.url);
        
        // Ensure no single JS memory buffer exceeds ~150MB (well below 256MB iOS limit)
        const CHUNK_LIMIT = 150 * 1024 * 1024; 
        const reader = response.body!.getReader();
        
        let chunkIndex = 0;
        let currentChunkSize = 0;
        let currentBufferChunks: Uint8Array[] = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (currentBufferChunks.length > 0) {
                    await OPFSCache.writeChunk(root, `${filename}_part${chunkIndex}`, currentBufferChunks);
                }
                break;
            }
            
            currentBufferChunks.push(value);
            currentChunkSize += value.length;
            
            if (currentChunkSize >= CHUNK_LIMIT) {
                await OPFSCache.writeChunk(root, `${filename}_part${chunkIndex}`, currentBufferChunks);
                chunkIndex++;
                currentBufferChunks = [];
                currentChunkSize = 0;
            }
        }
    },

    async writeChunk(root: FileSystemDirectoryHandle, chunkName: string, bufferChunks: Uint8Array[]) {
        const handle = await root.getFileHandle(chunkName, { create: true });
        const blob = new Blob(bufferChunks as any);
        // @ts-ignore - Handle cross-browser OPFS writable streams
        if (handle.createWritable) {
            // @ts-ignore
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            // Safari worker fallback
            // @ts-ignore
            const accessHandle = await handle.createSyncAccessHandle();
            const arrayBuf = await blob.arrayBuffer();
            accessHandle.write(new Uint8Array(arrayBuf));
            accessHandle.flush();
            accessHandle.close();
        }
    }
};

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Programmatic cache interception loop
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Filter heavy weights vs standard JSON config files
    const isHeavyAsset = [".wasm", ".bin", ".onnx", ".gguf"].some(ext => url.pathname.endsWith(ext));
    const isLightAsset = [".json"].some(ext => url.pathname.endsWith(ext));

    if (isHeavyAsset || isLightAsset) {
        event.respondWith(
            (async () => {
                // OPFS for heavy assets, standard Cache API for lightweight JSON configs
                const cachedResponse = isHeavyAsset 
                    ? await OPFSCache.match(event.request)
                    : await (await caches.open(MODEL_CACHE_NAME)).match(event.request);

                // Cold-start validation: if asset is found locally, bypass network entirely
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Cache miss execution path: acquire via network connection and write to local disk
                try {
                    const networkResponse = await fetch(event.request);

                    if (networkResponse.status === 200) {
                        const contentType = networkResponse.headers.get("content-type");
                        // Never cache the Vite SPA HTML fallback if a requested asset is missing
                        if (contentType && !contentType.includes("text/html")) {
                            if (isHeavyAsset) {
                                // Background OPFS write
                                OPFSCache.put(event.request, networkResponse.clone()).catch(console.error);
                            } else {
                                const cache = await caches.open(MODEL_CACHE_NAME);
                                await cache.put(event.request, networkResponse.clone());
                            }
                        }
                    }

                    return networkResponse;
                } catch (error) {
                    return new Response("Offline execution failure: Asset not found in local cache.", {
                        status: 503,
                        statusText: "Service Unavailable"
                    });
                }
            })()
        );
    }
});