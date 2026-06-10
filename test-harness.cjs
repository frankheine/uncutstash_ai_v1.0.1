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

    // Fail-Fast Flag
    let hasFailed = false;
    const triggerFailFast = async (reason) => {
        if (hasFailed) return;
        hasFailed = true;
        console.error(`💥 [FAIL-FAST TRIGGERED] ${reason}`);
        await safeScreenshot(page, 'check-screenshot-failed.png', { fullPage: true });
        await browser.close();
        process.exit(1);
    };

    page.on('pageerror', err => {
        console.log(`❌ [BROWSER FATAL ERROR] ${err.message}`);
        triggerFailFast(err.message);
    });

    page.on('response', response => {
        if (response.url().includes('/models/') && response.status() === 200) {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('text/html')) {
                console.log(`🚨 [NETWORK FAULT] Server returned HTML for asset: ${response.url()}`);
                triggerFailFast('Missing model weights (404 intercepted by Vite SPA)');
            }
        }
        if (response.status() >= 400 && response.url().includes('/models/')) {
            console.log(`⚠️ [NETWORK ERROR] ${response.status()} ${response.url()}`);
            triggerFailFast(`Model asset missing: ${response.url()}`);
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

        // Dynamically wait until the engine is fully loaded and the main UI becomes visible
        console.log("🤖 [AGENT HARNESS] Waiting for Sovereign Dual Engine to finish loading...");
        await page.waitForSelector('.glass-panel', { state: 'visible', timeout: 300000 }); // Wait up to 5 minutes for model download

        await safeScreenshot(page, 'check-screenshot.png', { fullPage: true });
        console.log("🤖 [AGENT HARNESS] Engine loaded. Verification complete.");

    } catch (error) {
        console.error(`🚨 [HARNESS FAILURE] ${error.message}`);
    } finally {
        await browser.close();
        console.log("🤖 [AGENT HARNESS] Test sequence complete.");
    }
})();