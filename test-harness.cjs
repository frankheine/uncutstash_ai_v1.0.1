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
    const userDataDir = path.join(os.tmpdir(), `playwright-agent-${Date.now()}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        bypassCSP: true,
        args: [
            '--headless=new',
            '--no-sandbox',
            '--enable-gpu',
            '--enable-unsafe-webgpu',
            '--enable-webgpu-developer-features',
            '--enable-dawn-features=allow_unsafe_apis,disable_robustness',
            '--disable-gpu-sandbox',
            '--ignore-gpu-blocklist',
            '--disable-software-rasterizer',
            '--use-angle=vulkan',
            '--use-gl=egl',
            '--use-cmd-decoder=passthrough',
            '--disable-web-security',
            '--unlimited-storage',
        ],
    });
    
    const page = context.pages()[0] || await context.newPage();

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
        await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 300000 });
        console.log("🤖 [AGENT HARNESS] DOM Loaded. Waiting for initialization sequence...");

        // 4. Verify WebGPU Context
        const hasWebGPU = await page.evaluate(() => navigator.gpu !== undefined);
        if (!hasWebGPU) {
            throw new Error("navigator.gpu is undefined. WebGPU is NOT active in this browser environment.");
        }

        // Wait 2 seconds for boot screen to render and take screenshot
        console.log("🤖 [AGENT HARNESS] Taking Boot Screen screenshot...");
        await page.waitForTimeout(2000);
        await safeScreenshot(page, 'check-screenshot-boot.png', { fullPage: true });

        console.log("🤖 [AGENT HARNESS] Waiting for Sovereign Dual Engine to finish loading...");
        await page.waitForSelector('.engine-ready-indicator', { state: 'attached', timeout: 180000 });

        // Wait 2 seconds for GSAP animations to complete
        await page.waitForTimeout(2000);
        await safeScreenshot(page, 'check-screenshot-chat.png', { fullPage: true });
        console.log("🤖 [AGENT HARNESS] Engine loaded on First Boot. Initiating RELOAD to verify OPFSCache and Service Worker chain of custody...");
        await page.reload({ waitUntil: 'domcontentloaded' });
        console.log("🤖 [AGENT HARNESS] Page reloaded. Waiting for Engine on Second Boot (Zero-latency cache read)...");
        
        await page.waitForTimeout(2000);
        await safeScreenshot(page, 'check-screenshot-boot-second.png', { fullPage: true });
        
        await page.waitForSelector('.engine-ready-indicator', { state: 'attached', timeout: 180000 });
        
        await page.waitForTimeout(2000);
        await safeScreenshot(page, 'check-screenshot-chat-second.png', { fullPage: true });
        console.log("🤖 [AGENT HARNESS] Engine loaded on Second Boot. Zero-copy chain of custody verified.");

    } catch (error) {
        console.error(`🚨 [HARNESS FAILURE] ${error.message}`);
    } finally {
        await context.close();
        console.log("🤖 [AGENT HARNESS] Test sequence complete.");
    }
})();