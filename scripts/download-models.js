import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS = [
    {
        repo: "Sandoche/Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC",
        dir: "SNOWflake_v1.2_UNCUTstash-1B",
        wasmUrl: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm",
        wasmFile: "SNOWflake_v1.2_UNCUTstash-1B-webgpu.wasm"
    }
    /*
    {
        repo: "Sandoche/Llama-3.2-3B-Instruct-abliterated-q4f16_1-MLC",
        dir: "SNOWflake_v1.2_UNCUTstash-3B",
        wasmUrl: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm",
        wasmFile: "SNOWflake_v1.2_UNCUTstash-3B-webgpu.wasm"
    }
    */
];

const BASE_DIR = path.resolve(__dirname, '../public/models');

async function downloadFile(url, dest) {
    if (fs.existsSync(dest)) {
        console.log(`[SKIP] Already exists: ${path.basename(dest)}`);
        return;
    }
    
    console.log(`[DOWNLOADING] ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const fileStream = fs.createWriteStream(dest);
    const reader = response.body.getReader();
    
    let loaded = 0;
    const total = parseInt(response.headers.get('content-length') || '0', 10);
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        fileStream.write(value);
        loaded += value.length;
        
        if (total > 0 && loaded % (1024 * 1024 * 20) < value.length) { // Log every ~20MB
            process.stdout.write(`\r  Progress: ${Math.round((loaded / total) * 100)}% (${(loaded / 1024 / 1024).toFixed(1)}MB)`);
        }
    }
    
    fileStream.end();
    process.stdout.write('\n');
}

async function main() {
    if (!fs.existsSync(BASE_DIR)) {
        fs.mkdirSync(BASE_DIR, { recursive: true });
    }

    for (const model of MODELS) {
        const modelDir = path.join(BASE_DIR, model.dir);
        if (!fs.existsSync(modelDir)) {
            fs.mkdirSync(modelDir, { recursive: true });
        }

        console.log(`\n=== Processing Model: ${model.repo} ===`);
        
        const baseUrl = `https://huggingface.co/${model.repo}/resolve/main`;
        
        // 1. Fetch JSON Configs
        const configs = [
            'mlc-chat-config.json',
            'ndarray-cache.json',
            'tokenizer.json',
            'tokenizer_config.json'
        ];
        
        for (const file of configs) {
            try {
                await downloadFile(`${baseUrl}/${file}`, path.join(modelDir, file));
            } catch (err) {
                console.warn(`[WARN] Could not download ${file} (might be optional): ${err.message}`);
            }
        }

        // 2. Parse ndarray-cache.json to get shard list
        const cachePath = path.join(modelDir, 'ndarray-cache.json');
        if (!fs.existsSync(cachePath)) {
            console.error(`[ERROR] ndarray-cache.json not found for ${model.repo}`);
            continue;
        }

        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const shards = new Set();
        
        for (const record of cacheData.records) {
            shards.add(record.dataPath);
        }

        console.log(`\nFound ${shards.size} chunked tensor shards to download...`);

        // 3. Download shards sequentially (to avoid memory/network crash)
        for (const shard of shards) {
            await downloadFile(`${baseUrl}/${shard}`, path.join(modelDir, shard));
        }

        // 4. Download WASM architecture binary
        if (model.wasmUrl) {
            await downloadFile(model.wasmUrl, path.join(modelDir, model.wasmFile));
        }
        
        console.log(`\n✅ Finished downloading ${model.dir}`);
    }
}

main().catch(console.error);
