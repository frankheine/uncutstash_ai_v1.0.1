import { create, insert, search } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';

let db: any = null;

self.onmessage = async (event: MessageEvent) => {
    const { action, id } = event.data;

    try {
        if (!db) {
            try {
                // Restore from IndexedDB WARM storage
                db = await restore('idb', 'uncutstash-orama-v1');
                console.log("[Orama Worker] Restored from IndexedDB WARM Storage");
            } catch (e) {
                console.log("[Orama Worker] Initializing new vector database");
                db = await create({
                    schema: {
                        text: 'string',
                        embedding: 'vector[384]',
                    }
                });
            }
        }

        if (action === 'insert') {
            const { text, embedding } = event.data;
            await insert(db, { text, embedding });
            
            // Persist to IndexedDB WARM Storage automatically
            await persist(db, 'idb', 'uncutstash-orama-v1');
            
            self.postMessage({ id, status: 'success' });
        }

        if (action === 'search') {
            const { queryVector, queryText } = event.data;

            self.postMessage({ id, status: 'progress', log: '🔍 Executing Orama Hybrid Search...' });

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

            self.postMessage({ id, status: 'success', candidates });
        }
    } catch (error: any) {
        self.postMessage({ id, status: 'error', message: error.message });
    }
};