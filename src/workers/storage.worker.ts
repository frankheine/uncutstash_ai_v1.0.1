// src/storage.ts
import localforage from 'localforage';

export interface SovereignMetadata {
    coreContext: {
        intent: string;
        sessionId: string;
    };
    interaction: {
        latencyMs: number;
        tokenUsage: number;
        modelVersion: string;
    };
    userPrefs: {
        priorityLevel: number;
        formattingRules: string[];
    };
    environmental: {
        deviceName: string;
        location: string;
        detectedMood: string;
    };
}

export interface SovereignMemory {
    id: string;
    timestamp: string; // ISO 8601
    content: string;
    category: string;
    title: string;
    summary: string;
    tags: string[];
    importance: number;
    status: 'active' | 'archived' | 'draft';
    links: string[];
    metadata: SovereignMetadata;
    lastAccessed: number; // Epoch ms for LRU Decay
}

export interface ColdStorageManifestEntry {
    id: string;
    iv: Uint8Array;
    bucketUrl: string;
    timestamp: number;
}

// 1. HOT TIER: IndexedDB for rapid, recent access
export const hotStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "hot_cache"
});

// 2. WARM TIER: OPFS Pointers
export const warmStore = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "warm_pointers"
});

// 3. COLD TIER: Encrypted Manifest
export const coldManifest = localforage.createInstance({
    name: "SovereignRAG",
    storeName: "cold_manifest"
});

export async function saveMemory(memory: SovereignMemory) {
    memory.lastAccessed = Date.now();
    await hotStore.setItem(memory.id, memory);
}

export async function getMemory(id: string): Promise<SovereignMemory | null> {
    const mem = await hotStore.getItem<SovereignMemory>(id);
    if (mem) {
        mem.lastAccessed = Date.now();
        await hotStore.setItem(id, mem);
        return mem;
    }
    return null;
}

// --- AUTONOMOUS MIGRATION (LRU & DECAY) ---
export async function runDataLifecycleManager() {
    const DECAY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days
    const now = Date.now();
    const keysToMigrate: string[] = [];

    await hotStore.iterate((value: SovereignMemory, key: string) => {
        if (now - value.lastAccessed > DECAY_THRESHOLD_MS) {
            keysToMigrate.push(key);
        }
    });

    for (const key of keysToMigrate) {
        const memory = await hotStore.getItem<SovereignMemory>(key);
        if (memory) {
            // Move to Warm Storage (OPFS logic handled by storage.worker.ts)
            await warmStore.setItem(key, { ...memory, status: 'archived' });
            await hotStore.removeItem(key);
            console.log(`[Lifecycle Manager] Migrated memory ${key} to Warm Storage.`);
        }
    }
}

// --- COLD STORAGE ENCRYPTION (WEB CRYPTO API) ---
export async function encryptForColdStorage(plaintextData: any): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey }> {
    // Generate a secure AES-GCM key
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true, // extractable (needed if you want to store the key in IndexedDB)
        ["encrypt", "decrypt"]
    );

    // 12 bytes is the NIST recommended IV length for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(plaintextData));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );

    return { ciphertext, iv, key };
}

export async function decryptFromColdStorage(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<any> {
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded);
}