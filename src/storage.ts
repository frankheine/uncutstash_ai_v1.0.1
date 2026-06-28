// src/storage.ts
import localforage from 'localforage';

export interface ChatMessage {
    id: string;
    threadId: string;
    parentId: string | null;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface ChatThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

// 1. HOT TIER: IndexedDB for rapid, recent access
export const hotStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "hot_cache"
});

export const threadsStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "threads"
});

export const messagesStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "messages"
});

export async function saveMessage(msg: ChatMessage) {
    await messagesStore.setItem(msg.id, msg);
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const msgs: ChatMessage[] = [];
    await messagesStore.iterate((value: ChatMessage) => {
        if (value.threadId === threadId) msgs.push(value);
    });
    return msgs.sort((a, b) => a.timestamp - b.timestamp);
}

// 2. WARM TIER: Orama will handle our vector storage directly in the browser.

// 3. COLD TIER: Stubbed Encrypted Cloud Backup
export async function syncToColdStore(plaintextData: any, networkWorker: Worker) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(plaintextData));

    const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    networkWorker.postMessage({ ciphertext: ciphertextBuffer, iv });
}

// ============================================================================
// AUTONOMOUS MIGRATION (LRU & DECAY)
// ============================================================================

export const warmStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "warm_pointers"
});

export const coldManifest = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "cold_manifest"
});

export async function runDataLifecycleManager() {
    const DECAY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days
    const now = Date.now();
    const keysToMigrate: string[] = [];

    // Scan the hot cache for stale memories
    await hotStore.iterate((value: any, key: string) => {
        // If the memory has a lastAccessed timestamp and it's older than 7 days
        if (value && value.lastAccessed && (now - value.lastAccessed > DECAY_THRESHOLD_MS)) {
            keysToMigrate.push(key);
        }
    });

    // Migrate stale memories to warm storage
    for (const key of keysToMigrate) {
        const memory = await hotStore.getItem<any>(key);
        if (memory) {
            await warmStore.setItem(key, { ...memory, status: 'archived' });
            await hotStore.removeItem(key);
            console.log(`[Lifecycle Manager] Migrated memory ${key} to Warm Storage.`);
        }
    }
}