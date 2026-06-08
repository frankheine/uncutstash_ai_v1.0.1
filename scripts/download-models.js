import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS = [
    {
        modelDir: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-1B",
        wasmUrl: "http://localhost:5173/wasm/FISHscale_v1.0.wasm"
        wasmFile: "FISHscale_v1.0.wasm"
    }
    /*
    {
        modelDir: "http://localhost:5173/models/SNOWflake_v1.2_UNCUTstash-3B/",
        wasmUrl: "http://localhost:5173/wasm/SNOWflake_v1.0.wasm"
        wasmFile: "SNOWflake_v1.0.wasm"
    }
    */
];

const BASE_DIR = path.resolve(__dirname, '../public/models');

async function main() {
    console.log("=== SOVEREIGN RAG: OFFLINE MODEL VERIFICATION ===");
    console.log("Validating local model assets (Air-gapped mode). No internet requests will be made.\n");

    if (!fs.existsSync(BASE_DIR)) {
        console.error(`[FATAL ERROR] Base model directory not found at ${BASE_DIR}`);
        console.error("Please ensure you have placed your model files in the public/models directory.");
        process.exit(1);
    }

    let allValid = true;

    for (const model of MODELS) {
        const modelDir = path.join(BASE_DIR, model.dir);
        console.log(`\nVerifying local model directory: ${modelDir}`);

        if (!fs.existsSync(modelDir)) {
            console.error(`  [X] Model directory missing: ${model.dir}`);
            allValid = false;
            continue;
        }

        // 1. Verify required JSON Configs
        const requiredConfigs = [
            'mlc-chat-config.json',
            'ndarray-cache.json',
            'tokenizer.json',
            'tokenizer_config.json'
        ];

        for (const file of requiredConfigs) {
            const filePath = path.join(modelDir, file);
            if (fs.existsSync(filePath)) {
                console.log(`  [OK] Found ${file}`);
            } else {
                console.error(`  [X] Missing required config: ${file}`);
                allValid = false;
            }
        }

        // 2. Verify WebGPU WASM existence
        const wasmPath = path.join(modelDir, model.wasmFile);
        if (fs.existsSync(wasmPath)) {
            console.log(`  [OK] Found WebGPU Orchestrator: ${model.wasmFile}`);
        } else {
            console.error(`  [X] Missing WebGPU Orchestrator: ${model.wasmFile}`);
            allValid = false;
        }

        // 3. Verify Binary Shards
        const files = fs.readdirSync(modelDir);
        const shards = files.filter(f => f.startsWith('params_shard_') && f.endsWith('.bin'));
        if (shards.length > 0) {
            console.log(`  [OK] Found ${shards.length} binary tensor shards.`);
        } else {
            console.error(`  [X] Missing binary tensor shards! No .bin files found.`);
            allValid = false;
        }
    }

    console.log("\n=================================================");
    if (allValid) {
        console.log("SUCCESS: All local Sovereign AI models are present and valid.");
    } else {
        console.error("ERROR: Missing model files detected! Please check your local models directory.");
        process.exit(1);
    }
}

main().catch(console.error);
