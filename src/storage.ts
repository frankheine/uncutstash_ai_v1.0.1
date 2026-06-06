// src/storage.ts
import localforage from 'localforage';

// 1. HOT TIER: IndexedDB for rapid, recent access
export const hotStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "hot_cache"
});

// 2. WARM TIER: Orama will handle our vector storage directly in the browser.

// 3. COLD TIER: Stubbed Encrypted Cloud Backup
export async function syncToColdStore(plaintextData: any, networkWorker: Worker) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(plaintextData));

    const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    networkWorker.postMessage({ ciphertext: ciphertextBuffer, iv });
}