import { pipeline, env } from '@huggingface/transformers';

// Disable remote fetching entirely for a fully sovereign local app
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Point directly to your public assets folder
// Vite serves the public folder at the root "/" path
env.localModelPath = '/models/Xenova/';

let extractor: any = null;

// Use standard self.onmessage syntax to match your existing pattern perfectly
self.onmessage = async (event: MessageEvent) => {
    const { text, id } = event.data;

    try {
        if (!extractor) {
            // It looks for: /models/Xenova/all-MiniLM-L6-v2/config.json
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                device: 'webgpu',
            });
        }

        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        self.postMessage({ id, embedding });
    } catch (error: any) {
        // Crucial for debugging local file-loading issues
        self.postMessage({ id, error: `Worker error: ${error.message}` });
    }
};