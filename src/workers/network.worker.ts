// SEALED PIPELINE NETWORK WORKER
// This worker only ever processes opaque encrypted ciphertext ArrayBuffers.
// No plaintext ever enters this scope.

self.onmessage = async (event: MessageEvent) => {
    const { ciphertext, iv, id } = event.data;

    try {
        console.log("[Network Worker] Securely writing encrypted database block locally to storage layer...");

        // Open/Create a browser IndexedDB instance locally
        const dbRequest = indexedDB.open("SovereignRAG_Storage", 1);

        dbRequest.onupgradeneeded = (e: any) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains("backups")) {
                database.createObjectStore("backups", { keyPath: "id" });
            }
        };

        dbRequest.onsuccess = (e: any) => {
            const database = e.target.result;
            const transaction = database.transaction("backups", "readwrite");
            const store = transaction.objectStore("backups");

            store.put({
                id: id,
                payload: ciphertext,
                initializationVector: iv,
                timestamp: Date.now()
            });

            transaction.oncomplete = () => {
                console.log("[Network Worker] Write operation verified and finalized locally.");
                self.postMessage({ id, status: "success" });
            };
        };

        dbRequest.onerror = (e: any) => {
            const error = e.target.error;
            console.error("[Network Worker] IndexedDB open error:", error);
            self.postMessage({ id, status: "error", message: error?.message || "IndexedDB open failed" });
        };

    } catch (error: any) {
        console.error("[Network Worker Error]:", error);
        self.postMessage({ id, status: "error", message: error.message });
    }
};