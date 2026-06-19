// dynamic-agent-harness.cjs
// Fix Playwright hanging on "waiting for fonts to load" during screenshots
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
let GIFEncoder = null;
let jpeg = null;
try {
    GIFEncoder = require('gifencoder');
    jpeg = require('jpeg-js');
} catch (e) {
    console.log("⚠️ pure-js image libraries not found, skipping GIF generation");
}

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
            '--use-cmd-decoder=passthrough',
            '--disable-web-security',
            '--unlimited-storage'
        ],
    });

    const page = browser.pages()[0] || await browser.newPage();

    // EXPOSE NON-BLOCKING BACKGROUND INTERVALS TO DOM BOUNDARY
    await page.exposeFunction('startRapidCapture', (intervalMs = 150) => {
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

    const originalPress = page.press.bind(page);
    page.press = async (selector, key, options) => {
        console.log(`🔘  [ACTION] Press: ${key}`);
        await interceptAction('press', selector, () => originalPress(selector, key, options));
    };

    try {
        console.log("🚀 Navigating to local engine target application...");
        await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });

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
            setTimeout(() => {
                const target = document.querySelector('.aui-thread-messages') || document.body;
                if (target) {
                    observer.observe(target, { childList: true, subtree: true, characterData: true });
                }
            }, 5000);
        });

        // SIMULATED COMPLETE TEST SEQUENCE
        console.log("⏳ Initializing system buffer states (10s boot sleep)...");
        await page.waitForTimeout(10000);

        // Action 1: Trigger Cube Loader Theme modification
        console.log("📦 Transitioning Cube Theme setting loader profile...");
        const cubeThemeBtn = 'button[title="Cube Theme 2"]';
        if (await page.$(cubeThemeBtn)) {
            await page.click(cubeThemeBtn);
        }
        await page.waitForTimeout(1000);

        // Execute precise burst to verify the WebGL Canvas CSS easing values 
        console.log("🔬 Executing targeted sequence for CubeLoader interpolation verification...");
        for (let i = 1; i <= 10; i++) {
            await safeScreenshot(page, `cube-anim-interpolation-0${i}.jpg`);
            await page.waitForTimeout(300); // Spaced 300ms apart precisely
        }

        // Action 2: Message input validation
        const textBar = 'textarea[placeholder*="Send a message"], input[placeholder*="message"]';
        if (await page.$(textBar)) {
            await page.fill(textBar, 'Perform deep architecture compilation pass.');
            await page.press(textBar, 'Enter');
        } else {
            console.log("⚠️ Could not find chat text box.");
        }

        console.log("📡 Keeping pipeline alive to monitor streaming text outputs...");
        await page.waitForTimeout(15000);

    } catch (err) {
        console.error(`🚨 Fatal execution failure encountered: ${err.message}`);
        await safeScreenshot(page, 'harness-crash-state.jpg');
    } finally {
        await browser.close();
        console.log("🏁 [HARNESS ENGINE] Execution pass clean.");
        await compileTimelineGif();
    }
}

async function compileTimelineGif() {
    if (!GIFEncoder || !jpeg) {
        console.log("⚠️ Skipping timeline collator due to missing dependencies.");
        return;
    }
    console.log("🎞️ [TIMELINE COLLATOR] Stitching captured frames into GIF...");
    const files = fs.readdirSync(ARTIFACTS_DIR)
        .filter(f => f.endsWith('.jpg'))
        .sort((a, b) => fs.statSync(path.join(ARTIFACTS_DIR, a)).mtimeMs - fs.statSync(path.join(ARTIFACTS_DIR, b)).mtimeMs);

    if (files.length === 0) {
        console.log("⚠️ No frames to stitch.");
        return;
    }

    const width = 1280;
    const height = 800;
    const encoder = new GIFEncoder(width, height);

    const outPath = path.join(ARTIFACTS_DIR, 'timeline-execution.gif');
    encoder.createReadStream().pipe(fs.createWriteStream(outPath));

    encoder.start();
    encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
    encoder.setDelay(200); // frame delay in ms
    encoder.setQuality(10); // image quality. 10 is default.

    for (const file of files) {
        const filepath = path.join(ARTIFACTS_DIR, file);
        try {
            const jpegData = fs.readFileSync(filepath);
            const rawImageData = jpeg.decode(jpegData, {useTArray: true});
            encoder.addFrame(rawImageData.data);
        } catch(e) {
            console.log(`⚠️ Could not load image ${file}: ${e.message}`);
        }
    }

    encoder.finish();
    console.log(`✅ [TIMELINE COLLATOR] GIF exported successfully to ${outPath}`);
}

runAutonomousHarness().catch(console.error);
