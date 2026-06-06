import { create, insert, search } from '@orama/orama';
// Persistence plugin removed – using in-memory DB only

let db: any = null;

self.onmessage = async (event: MessageEvent) => {
    const { action, id } = event.data;

    try {
        if (!db) {
            try {
                // Fallback: initialize new DB (no persistence)
                db = await create({
                    schema: { text: 'string', embedding: 'vector[384]' }
                });
                console.log("[Orama Worker] Initialized new in-memory DB (persistence disabled)");
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
            
            // Persistence disabled in this build – skipping persist
            
            self.postMessage({ id, status: 'success' });
        }

        if (action === 'search') {
            const { queryVector, queryText } = event.data;

            self.postMessage({ id, status: 'progress', log: '🔍 Executing Orama Hybrid Search...' });

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

                self.postMessage({ id, status: 'success', candidates });
            } catch (searchError: any) {
                console.log("[Orama Worker] Search failed (likely empty db):", searchError);
                self.postMessage({ id, status: 'success', candidates: [] });
            }
        }
    } catch (error: any) {
        self.postMessage({ id, status: 'error', message: error.message });
    }
};