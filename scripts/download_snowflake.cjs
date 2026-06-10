const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const TOKEN = process.env.HF_TOKEN;
if (!TOKEN) {
    console.error("❌ ERROR: HF_TOKEN not found in .env file.");
    process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, '../public');
const WASM_DIR = path.join(PUBLIC_DIR, 'wasm');
const MODEL_DIR = path.join(PUBLIC_DIR, 'models', 'SNOWflake_v1.2_UNCUTstash-1B');

[WASM_DIR, MODEL_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// We map Llama-3.2-1B-Instruct-q4f16_1 to SNOWflake
const HF_BASE_WASM = 'https://huggingface.co/mlc-ai/web-llm-wasm/resolve/main/';
const HF_BASE_MODEL = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/';

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'Authorization': `Bearer ${TOKEN}` } };
        const req = https.get(url, options, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                https.get(res.headers.location, { headers: options.headers }, (redirectRes) => {
                    const fileStream = fs.createWriteStream(dest);
                    redirectRes.pipe(fileStream);
                    fileStream.on('finish', () => fileStream.close(resolve));
                }).on('error', reject);
            } else if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(dest);
                res.pipe(fileStream);
                fileStream.on('finish', () => fileStream.close(resolve));
            } else {
                reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
        });
        req.on('error', reject);
    });
}

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'Authorization': `Bearer ${TOKEN}` } };
        https.get(url, options, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                https.get(res.headers.location, { headers: options.headers }, (redirectRes) => {
                    let data = '';
                    redirectRes.on('data', chunk => data += chunk);
                    redirectRes.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
            } else if (res.statusCode === 200) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            } else {
                reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
        }).on('error', reject);
    });
}

(async () => {
    console.log("🚀 Starting Full SNOWflake Model Download...");

    // 1. Download WASM
    console.log("Downloading WebGPU WASM (FISHscale)...");
    await downloadFile(HF_BASE_WASM + 'Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm', path.join(WASM_DIR, 'FISHscale_v1.0.wasm'));

    // 2. Download Configs
    console.log("Downloading JSON Configs...");
    const configs = ['mlc-chat-config.json', 'tokenizer.json', 'tokenizer_config.json', 'ndarray-cache.json'];
    for (const file of configs) {
        await downloadFile(HF_BASE_MODEL + file, path.join(MODEL_DIR, file));
    }

    // 3. Dynamically read ndarray-cache.json to download EVERY SINGLE shard
    console.log("Reading ndarray-cache.json to dynamically locate all shards...");
    const cacheJSON = await fetchJSON(HF_BASE_MODEL + 'ndarray-cache.json');
    const shards = cacheJSON.records.map(r => r.dataPath);
    
    // Remove duplicates if any
    const uniqueShards = [...new Set(shards)];
    
    console.log(`Found ${uniqueShards.length} shards. Downloading all of them to ensure full inference works...`);
    for (let i = 0; i < uniqueShards.length; i++) {
        const shard = uniqueShards[i];
        console.log(`Downloading shard ${i + 1}/${uniqueShards.length}: ${shard}`);
        await downloadFile(HF_BASE_MODEL + shard, path.join(MODEL_DIR, shard));
    }

    console.log("🎉 FULL SNOWflake MODEL DOWNLOAD COMPLETE! Ready for End-to-End OPFS UI Test.");
})();
