const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const WASM_DIR = path.join(__dirname, '../public/wasm');

if (!fs.existsSync(WASM_DIR)) {
    fs.mkdirSync(WASM_DIR, { recursive: true });
}

const files = [
    'Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',
    'Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm',
    'Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',
    'Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm'
];

const BASE_URL = 'https://huggingface.co/mlc-ai/web-llm-wasm/resolve/main/';

async function downloadFile(filename) {
    const dest = path.join(WASM_DIR, filename);
    const url = BASE_URL + filename;

    console.log(`Downloading: ${filename}...`);

    const options = {};
    if (process.env.HF_TOKEN) {
        options.headers = {
            'Authorization': `Bearer ${process.env.HF_TOKEN}`
        };
    } else {
        console.warn('⚠️ WARNING: HF_TOKEN not found in .env. Attempting anonymous download, which may fail with 401 Unauthorized.');
    }

    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                const redirectOptions = { ...options };
                https.get(response.headers.location, redirectOptions, (res) => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Failed to download ${filename} after redirect. Status: ${res.statusCode}`));
                    }
                    const file = fs.createWriteStream(dest);
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                }).on('error', reject);
            } else if (response.statusCode === 200) {
                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                reject(new Error(`Failed to download ${filename}. Status: ${response.statusCode}`));
            }
        }).on('error', reject);
    });
}

(async () => {
    for (const file of files) {
        try {
            await downloadFile(file);
            console.log(`✅ Success: ${file}`);
        } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
        }
    }
    console.log("All downloads complete.");
})();
