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