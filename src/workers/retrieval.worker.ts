import { create, insert, search, save, load } from '@orama/orama';

let db: any = null;

async function saveToOPFS(database: any) {
    try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle('sovereign-vector-db.json', { create: true });
        const writable = await fileHandle.createWritable();
        const dbData = await save(database);
        await writable.write(JSON.stringify(dbData));
        await writable.close();
    } catch (e) {
        console.warn("[Orama Worker] Failed to persist to OPFS", e);
    }
}

async function loadFromOPFS() {
    try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle('sovereign-vector-db.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        const newDb = await create({
            schema: { text: 'string', embedding: 'vector[384]' }
        });
        await load(newDb, parsed);
        return newDb;
    } catch (e) {
        return null;
    }
}

self.onmessage = async (event: MessageEvent) => {
    const { action, taskId } = event.data;

    try {
        if (!db) {
            db = await loadFromOPFS();
            if (db) {
                console.log("[Orama Worker] Successfully restored vector database from OPFS");
            } else {
                console.log("[Orama Worker] OPFS restore failed or DB not found, creating new");
                db = await create({
                    schema: {
                        text: 'string',
                        embedding: 'vector[384]',
                    }
                });
                console.log("[Orama Worker] Initialized new OPFS-backed vector database");
            }
        }

        if (action === 'insert') {
            const { text, embedding } = event.data;
            await insert(db, { text, embedding });
            await saveToOPFS(db);
            self.postMessage({ taskId, status: 'success' });
        }

        if (action === 'flush') {
            console.log("[Orama Worker] Flushing vector database...");
            db = await create({
                schema: {
                    text: 'string',
                    embedding: 'vector[384]',
                }
            });
            await saveToOPFS(db);
            self.postMessage({ taskId, status: 'success' });
        }

        if (action === 'search') {
            const { queryVector, queryText } = event.data;

            self.postMessage({ taskId, status: 'progress', log: '🔍 Executing Orama Hybrid Search...' });

            try {
                const results = await search(db, {
                    term: queryText,
                    mode: 'hybrid',
                    vector: { value: queryVector, property: 'embedding' },
                    limit: 10
                });

                const candidates = results.hits.map(hit => ({
                    id: hit.id,
                    text: hit.document.text,
                    score: hit.score
                }));

                self.postMessage({ taskId, status: 'success', candidates });
            } catch (searchError: any) {
                console.log("[Orama Worker] Search failed (likely empty db):", searchError);
                self.postMessage({ taskId, status: 'success', candidates: [] });
            }
        }
    } catch (error: any) {
        self.postMessage({ taskId, status: 'error', message: error.message });
    }
};