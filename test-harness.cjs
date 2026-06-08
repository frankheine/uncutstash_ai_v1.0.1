// test-harness.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function safeScreenshot(page, filename, options = {}) {
    try {
        await page.screenshot({ path: filename, timeout: 5000, ...options });
        console.log(`📸 Saved: ${filename}`);
    } catch (e) {
        console.log(`⚠️ Screenshot warning for ${filename}: ${e.message}`);
    }
}

(async () => {
    console.log("🤖 [AGENT HARNESS] Initiating WebGPU test sequence...");

    const os = require('os');
    const path = require('path');
    const userDataDir = path.join(os.tmpdir(), `.playwright_cache_sovereign_${Date.now()}`);
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // Force headless for background verification required for true WebGPU hardware acceleration
        viewport: { width: 1280, height: 800 },
        bypassCSP: true,
        args: [
            '--enable-unsafe-webgpu',
            '--enable-features=UseSkiaRenderer',
            '--disable-gpu-sandbox',
            '--ignore-gpu-blocklist',
            '--use-angle=d3d11', // Force D3D11 to stabilize WebGL on Windows AMD
            '--disable-web-security', // Bypass CORS for local testing
            '--unlimited-storage',
        ],
    });

    // Use the default page from the persistent context
    const page = browser.pages()[0];

    // 2. MIRROR CONSOLE & ERRORS TO THE AGENT'S TERMINAL
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`🖥️ [BROWSER ${type}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`❌ [BROWSER FATAL ERROR] ${err.message}`);
    });

    page.on('response', response => {
        if (response.url().includes('/models/') && response.status() === 200) {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('text/html')) {
                console.log(`🚨 [NETWORK FAULT] Server returned HTML for asset: ${response.url()}`);
            }
        }
        if (response.status() >= 400) {
            console.log(`⚠️ [NETWORK ERROR] ${response.status()} ${response.url()}`);
        }
    });

    // Listen to Web Worker errors (Crucial for WebLLM inference pipelines)
    page.on('worker', worker => {
        worker.on('console', msg => console.log(`⚙️ [WORKER LOG] ${msg.text()}`));
        worker.on('pageerror', err => console.log(`💥 [WORKER ERROR] ${err.message}`));
    });

    try {
        // 3. Navigate to Vite Localhost (Adjust port if necessary)
        console.log("🤖 [AGENT HARNESS] Navigating to http://localhost:5173");
        await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 120000 });
        console.log("🤖 [AGENT HARNESS] DOM Loaded. Waiting for initialization sequence...");

        // 4. Verify WebGPU Context
        const hasWebGPU = await page.evaluate(() => navigator.gpu !== undefined);
        if (!hasWebGPU) {
            throw new Error("navigator.gpu is undefined. WebGPU is NOT active in this browser environment.");
        }
        console.log("✅ [AGENT HARNESS] WebGPU is active and available.");

        // CHECKPOINT 1: Initial Load
        await safeScreenshot(page, 'agent_checkpoint_1_load_0s.png');
        
        await page.waitForTimeout(1000);
        await safeScreenshot(page, 'agent_checkpoint_1_load_1s.png');

        await page.waitForTimeout(1000);
        await safeScreenshot(page, 'agent_checkpoint_1_load_2s.png');

        // 5. Simulate Real User Interaction (MOCK BYPASS)
        console.log("🤖 [AGENT HARNESS] Force-unhiding UI for MOCK pipeline verification...");

        await page.evaluate(() => {
            const chatPanel = document.querySelector('.glass-panel:nth-of-type(1)') || document.querySelector('.glass-panel');
            if (chatPanel) {
                chatPanel.style.visibility = 'visible';
                chatPanel.style.opacity = '1';
                chatPanel.style.pointerEvents = 'auto';
            }
        });

        await page.waitForSelector('input[type="text"], textarea', { state: 'visible', timeout: 30000 });
        await page.fill('input[type="text"], textarea', 'MOCK_TEST_PIPELINE');
        await safeScreenshot(page, 'agent_checkpoint_2_input.png');

        await page.keyboard.press('Enter');

        // 6. Wait for LLM Inference Pipeline to process
        console.log("🤖 [AGENT HARNESS] Waiting for WebWorker inference response...");
        // Wait for the UI to update with a response (Update selector as needed)
        await page.waitForTimeout(15000); // Hard wait to allow WebLLM to download/infer

        // CHECKPOINT 3: Result
        await safeScreenshot(page, 'agent_checkpoint_3_result.png', { fullPage: true });

    } catch (error) {
        console.error(`🚨 [HARNESS FAILURE] ${error.message}`);
    } finally {
        await browser.close();
        console.log("🤖 [AGENT HARNESS] Test sequence complete.");
    }
})();