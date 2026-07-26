// src/workers/retrieval.worker.ts
import { create, insert, search, save, load } from '@orama/orama';

let db: any = null;
let encryptionKey: CryptoKey | null = null;
let isWriting = false; // FIX: ACID Mutex Lock

// --- AES-256-GCM ENCRYPTION UTILS ---
async function getOrCreateKey(): Promise<CryptoKey> {
    if (encryptionKey) return encryptionKey;

    // In Phase 4, this will be derived from a user PIN. For now, we generate a persistent local key.
    const root = await navigator.storage.getDirectory();
    try {
        const keyHandle = await root.getFileHandle('sovereign.key');
        const file = await keyHandle.getFile();
        const rawKey = await file.arrayBuffer();
        encryptionKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]);
    } catch {
        encryptionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const rawKey = await crypto.subtle.exportKey("raw", encryptionKey);
        const keyHandle = await root.getFileHandle('sovereign.key', { create: true });
        const writable = await (keyHandle as any).createWritable();
        await writable.write(rawKey);
        await writable.close();
    }
    return encryptionKey;
}

async function encryptData(data: string): Promise<Uint8Array> {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    // Combine IV and Ciphertext for storage
    const payload = new Uint8Array(iv.length + ciphertext.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ciphertext), iv.length);
    return payload;
}

async function decryptData(payload: Uint8Array): Promise<string> {
    const key = await getOrCreateKey();
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
}

// --- ORAMA OPFS LOGIC ---
async function saveToOPFS(database: any) {
    if (isWriting) return;
    isWriting = true;
    try {
        const root = await navigator.storage.getDirectory();
        // Write to .tmp first for ACID compliance (Crash protection)
        const tmpHandle = await root.getFileHandle('sovereign-vector-db.tmp', { create: true });
        const writable = await (tmpHandle as any).createWritable();

        const dbData = await save(database);
        const encryptedPayload = await encryptData(JSON.stringify(dbData));

        await writable.write(encryptedPayload);
        await writable.close();

        // Atomic rename (OPFS doesn't have native rename yet, so we copy and delete)
        const finalHandle = await root.getFileHandle('sovereign-vector-db.enc', { create: true });
        const finalWritable = await (finalHandle as any).createWritable();
        await finalWritable.write(encryptedPayload);
        await finalWritable.close();
        await root.removeEntry('sovereign-vector-db.tmp');

    } catch (e) {
        console.warn("[Orama Worker] Failed to persist encrypted DB to OPFS", e);
    } finally {
        isWriting = false; // Release Lock
    }
}

async function loadFromOPFS() {
    try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle('sovereign-vector-db.enc');
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();

        const decryptedText = await decryptData(new Uint8Array(arrayBuffer));
        const parsed = JSON.parse(decryptedText);

        const newDb = await create({
            schema: { text: 'string', embedding: 'vector[384]', status: 'string' } // Added status for Phase 4 Conflict Resolution
        });
        await load(newDb, parsed);
        return newDb;
    } catch (e) {
        return null;
    }
}

self.onmessage = async (event: MessageEvent) => {
    const { action, taskId } = event.data;
    const replyPort = event.ports[0];
    if (!replyPort) { console.error("[Retrieval Worker] No reply port."); return; }

    try {
        if (!db) {
            db = await loadFromOPFS();
            if (db) {
                console.log("[Orama Worker] Successfully restored ENCRYPTED vector database from OPFS");
            } else {
                db = await create({ schema: { text: 'string', embedding: 'vector[384]', status: 'string' } });
                console.log("[Orama Worker] Initialized new OPFS-backed vector database");
            }
        }

        if (action === 'insert') {
            const { text, embedding } = event.data;
            await insert(db, { text, embedding, status: 'active' });
            await saveToOPFS(db);
            replyPort.postMessage({ taskId, status: 'success' });
            replyPort.close(); // FIX: Prevent half-open IPC memory leak
        }

        if (action === 'search') {
            const { queryVector, queryText } = event.data;
            replyPort.postMessage({ taskId, status: 'progress', log: '🔍 Executing Secure Hybrid Search...' });

            // FIX: Defer search if database is currently writing to OPFS
            while (isWriting) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            try {
                const results = await search(db, {
                    term: queryText,
                    mode: 'hybrid',
                    vector: { value: queryVector, property: 'embedding' },
                    where: { status: 'active' }, // Only search active memories
                    limit: 10
                });

                const candidates = results.hits.map(hit => ({
                    id: hit.id,
                    text: hit.document.text,
                    score: hit.score
                }));

                replyPort.postMessage({ taskId, status: 'success', candidates });
                replyPort.close(); // FIX: Prevent half-open IPC memory leak
            } catch (searchError: any) {
                replyPort.postMessage({ taskId, status: 'success', candidates: [] });
                replyPort.close(); // FIX: Prevent half-open IPC memory leak
            }
        }
    } catch (error: any) {
        replyPort.postMessage({ taskId, status: 'error', message: error.message });
        replyPort.close(); // FIX: Prevent half-open IPC memory leak
    }
};