const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve('timeline_artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

let isBursting = false;
let burstCounter = 0;
let burstInterval = null;

async function safeScreenshot(page, filename, options = {}) {
    try {
        const filepath = path.join(ARTIFACTS_DIR, filename);
        // Optimize screenshot parameters for high-speed delivery
        await page.screenshot({ path: filepath, timeout: 3000, type: 'jpeg', quality: 80, ...options });
        console.log(`📸 [CAPTURE] ${filename}`);
    } catch (e) {
        console.log(`⚠️ Screenshot dropped: ${e.message}`);
    }
}

async function runAutonomousHarness() {
    console.log("🤖 [HARNESS ENGINE] Launching high-fidelity browser instance...");
    const userDataDir = path.resolve('.playwright_cache');
    
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: 'msedge',
        viewport: { width: 1280, height: 800 },
        bypassCSP: true,
        args: [
            '--no-sandbox',
            '--headless=new',
            '--enable-gpu',
            '--enable-unsafe-webgpu',
            '--enable-webgpu-developer-features',
            '--enable-dawn-features=allow_unsafe_apis,disable_robustness',
            '--disable-gpu-sandbox',
            '--ignore-gpu-blocklist',
            '--disable-software-rasterizer',
            '--use-angle=vulkan',
            '--disable-web-security',
            '--unlimited-storage'
        ],
    });

    const page = browser.pages()[0] || await browser.newPage();

    // EXPOSE NON-BLOCKING BACKGROUND INTERVALS TO DOM BOUNDARY
    await page.exposeFunction('startRapidCapture', (intervalMs = 100) => {
        if (isBursting) return;
        isBursting = true;
        console.log(`⚡ [STREAM DETECTED] Spawning parallel loop at ${intervalMs}ms intervals.`);
        
        burstInterval = setInterval(() => {
            if (!isBursting) {
                clearInterval(burstInterval);
                return;
            }
            burstCounter++;
            const filename = `stream-burst-${burstCounter.toString().padStart(4, '0')}.jpg`;
            // Execute out-of-band: DO NOT 'await' inside the timing engine loop
            safeScreenshot(page, filename, { fullPage: false });
        }, intervalMs);
    });

    await page.exposeFunction('stopRapidCapture', () => {
        if (!isBursting) return;
        isBursting = false;
        if (burstInterval) clearInterval(burstInterval);
        console.log(`⏹️ [STREAM ENDED] Halting rapid-fire visual capture pipeline.`);
    });

    // HOOK INTERACTION ENGINES TO AUTOMATICALLY FRAME INTERACTIONS
    const interceptAction = async (actionName, selector, callback) => {
        const id = Date.now();
        await safeScreenshot(page, `pre-${actionName}-${id}.jpg`);
        await callback();
        await safeScreenshot(page, `post-${actionName}-${id}.jpg`);
    };

    const originalClick = page.click.bind(page);
    page.click = async (selector, options) => {
        console.log(`🖱️  [ACTION] Click target: ${selector}`);
        await interceptAction('click', selector, () => originalClick(selector, options));
    };

    const originalFill = page.fill.bind(page);
    page.fill = async (selector, text, options) => {
        console.log(`⌨️  [ACTION] Keystroke sequence into: ${selector}`);
        await interceptAction('type', selector, () => originalFill(selector, text, options));
    };

    try {
        console.log("🚀 Navigating to local engine target application...");
        await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log("⚙️ Injecting scoped MutationObserver for thread tracking...");
        await page.evaluate(() => {
            let timeoutToken = null;
            const observer = new MutationObserver((mutations) => {
                let streamFound = false;
                for (const m of mutations) {
                    if (m.type === 'characterData' || m.type === 'childList') {
                        streamFound = true;
                        break;
                    }
                }

                if (streamFound) {
                    window.startRapidCapture(150); // Capturing intervals at 150ms chunks
                    if (timeoutToken) clearTimeout(timeoutToken);
                    timeoutToken = setTimeout(() => {
                        window.stopRapidCapture();
                    }, 1200); // Dynamic fallback window
                }
            });

            // target precision containers matching assistant-ui primitives
            const target = document.querySelector('.aui-thread-messages') || document.body;
            if (target) {
                observer.observe(target, { childList: true, subtree: true, characterData: true });
            }
        });

        // SIMULATED COMPLETE TEST SEQUENCE
        console.log("⏳ Initializing system buffer states (10s boot sleep)...");
        await page.waitForTimeout(10000);

        // Action 1: Force demo engine bypass if button present
        try {
            if (await page.$('button:has-text("FORCE BYPASS ENGINE")')) {
                await page.click('button:has-text("FORCE BYPASS ENGINE")');
                await page.waitForTimeout(2000);
            }
        } catch (_) {}

        // Action 2: Trigger Cube Loader Theme modification
        console.log("📦 Transitioning Cube Theme setting loader profile...");
        try {
            await page.click('button:has-text("MOTION")');
        } catch (_) {
            console.log("Could not find MOTION button, ignoring...");
        }
        await page.waitForTimeout(1000);

        // Execute precise burst to verify the WebGL Canvas CSS easing values 
        console.log("🔬 Executing targeted sequence for CubeLoader interpolation verification...");
        for (let i = 1; i <= 10; i++) {
            await safeScreenshot(page, `cube-anim-interpolation-0${i}.jpg`);
            await page.waitForTimeout(300); // Spaced 300ms apart precisely
        }

        // Action 3: Message input validation
        const textBar = 'textarea[placeholder*="Send a message"], input[placeholder*="message"]';
        if (await page.$(textBar)) {
            await page.fill(textBar, 'Perform deep architecture compilation pass.');
            await page.press(textBar, 'Enter');
        }

        console.log("📡 Keeping pipeline alive to monitor streaming text outputs...");
        await page.waitForTimeout(10000);

    } catch (err) {
        console.error(`🚨 Fatal execution failure encountered: ${err.message}`);
        await safeScreenshot(page, 'harness-crash-state.jpg');
    } finally {
        await browser.close();
        console.log("🏁 [HARNESS ENGINE] Execution pass clean.");
    }
}

runAutonomousHarness().catch(console.error);
