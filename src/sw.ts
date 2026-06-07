/// <reference lib="WebWorker" />
const sw = self as unknown as ServiceWorkerGlobalScope;

const MODEL_CACHE_NAME = "uncutstash-ai-models-v1";

// Simple helper array containing asset types we want to capture
const TARGET_EXTENSIONS = [".onnx", ".wasm", ".bin", ".json"];

sw.addEventListener("install", () => {
    self.skipWaiting();
});

sw.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Programmatic cache interception loop
sw.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

// Verify if the outgoing target match an asset type we manage
    const matchesTarget = TARGET_EXTENSIONS.some(ext => url.pathname.endsWith(ext));

    if (matchesTarget) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(MODEL_CACHE_NAME);
                const cachedResponse = await cache.match(event.request);

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
                            // Streams are read-once resources; clone the payload to save locally while returning original
                            await cache.put(event.request, networkResponse.clone());
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