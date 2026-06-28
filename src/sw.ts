export type { }; // Forces TypeScript to treat this file as an isolated module
declare const self: ServiceWorkerGlobalScope; // Maps the global 'self' keyword cleanly

// @ts-ignore
const precacheManifest = self.__WB_MANIFEST;

const MODEL_CACHE_NAME = "uncutstash-ai-models-v1";

function getOPFSFilename(urlStr: string) {
    const url = new URL(urlStr);
    return url.pathname.replace(/[^a-zA-Z0-9.\-]/g, '_');
}

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
                } catch (e) {
                    break;
                }
            }

            if (chunks.length > 0) {
                let mimeType = 'application/octet-stream';
                if (request.url.endsWith('.wasm')) {
                    mimeType = 'application/wasm';
                }
                const combinedBlob = new Blob(chunks, { type: mimeType });
                return new Response(combinedBlob, {
                    headers: {
                        "content-type": mimeType,
                        "content-length": combinedBlob.size.toString()
                    }
                });
            }
            return undefined;
        } catch (e) {
            return undefined;
        }
    },

    async put(request: Request, response: Response): Promise<void> {
        const root = await navigator.storage.getDirectory();
        const filename = getOPFSFilename(request.url);

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

        // @ts-ignore
        const accessHandle = await handle.createSyncAccessHandle();
        const arrayBuf = await blob.arrayBuffer();
        accessHandle.write(new Uint8Array(arrayBuf));
        accessHandle.flush();
        accessHandle.close();
    }
};

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event: any) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isHeavyAsset = [".wasm", ".bin", ".onnx", ".gguf"].some(ext => url.pathname.endsWith(ext));
    const isLightAsset = [".json"].some(ext => url.pathname.endsWith(ext));

    if (isHeavyAsset || isLightAsset) {
        event.respondWith(
            (async () => {
                const cachedResponse = isHeavyAsset
                    ? await OPFSCache.match(event.request)
                    : await (await caches.open(MODEL_CACHE_NAME)).match(event.request);

                if (cachedResponse) {
                    return cachedResponse;
                }

                try {
                    const urlObj = new URL(event.request.url);
                    const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === self.location.hostname;

                    if (!isLocal) {
                        const allowedDomains = ['huggingface.co', 'cdn.jsdelivr.net', 'githubusercontent.com'];
                        const isAllowedDomain = allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));

                        if (!isAllowedDomain) {
                            console.warn(`[Zero-Trust Firewall] Blocked unauthorized external request: ${urlObj.href}`);
                            return new Response("Blocked by Sovereign Zero-Trust Firewall.", { status: 403 });
                        }
                    }

                    const networkResponse = await fetch(event.request);

                    if (networkResponse.status === 200) {
                        const contentType = networkResponse.headers.get("content-type");
                        if (contentType && !contentType.includes("text/html")) {
                            if (isHeavyAsset) {
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