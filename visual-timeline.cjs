// visual-timeline.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve('timeline_artifacts');

async function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function safeScreenshot(page, filename, options = {}) {
    try {
        const filepath = path.join(ARTIFACTS_DIR, filename);
        await page.screenshot({ path: filepath, timeout: 5000, ...options });
        console.log(`📸 Saved: ${filepath}`);
    } catch (e) {
        console.log(`⚠️ Screenshot warning for ${filename}: ${e.message}`);
    }
}

async function runTimeline() {
    const args = process.argv.slice(2);
    const configFile = args[0] || 'test-sequence.json';

    if (!fs.existsSync(configFile)) {
        console.error(`❌ Cannot find configuration file: ${configFile}`);
        process.exit(1);
    }

    const sequence = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    await ensureDir(ARTIFACTS_DIR);

    console.log("🤖 [TIMELINE HARNESS] Initiating sequence...");

    const userDataDir = path.resolve('.playwright_cache');
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: 'msedge',
        viewport: { width: 1280, height: 800 },
        bypassCSP: true,
        args: [
            '--enable-gpu',
            '--enable-unsafe-webgpu',
            '--enable-webgpu-developer-features',
            '--enable-dawn-features=allow_unsafe_apis,disable_robustness',
            '--disable-gpu-sandbox',
            '--ignore-gpu-blocklist',
            '--disable-software-rasterizer',
            '--use-angle=vulkan',
            '--disable-web-security',
            '--unlimited-storage',
        ],
    });

    const page = browser.pages()[0] || await browser.newPage();

    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`🖥️ [BROWSER ${type}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`❌ [BROWSER FATAL ERROR] ${err.message}`);
    });

    try {
        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            console.log(`\n⏳ Executing Step ${i + 1}/${sequence.length}: [${step.action.toUpperCase()}]`);

            switch (step.action) {
                case 'goto':
                    console.log(`   Navigating to: ${step.url}`);
                    await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
                    break;
                case 'wait':
                    console.log(`   Waiting for ${step.ms}ms...`);
                    await page.waitForTimeout(step.ms);
                    break;
                case 'click':
                    console.log(`   Clicking selector: ${step.selector}`);
                    await page.click(step.selector);
                    break;
                case 'hover':
                    console.log(`   Hovering selector: ${step.selector}`);
                    await page.hover(step.selector);
                    break;
                case 'type':
                    console.log(`   Typing into selector: ${step.selector}`);
                    await page.fill(step.selector, step.text);
                    break;
                case 'screenshot':
                    console.log(`   Taking screenshot: ${step.filename}`);
                    await safeScreenshot(page, step.filename, { fullPage: true });
                    break;
                case 'burst':
                    console.log(`   Taking ${step.count} rapid-fire screenshots spaced ${step.intervalMs}ms apart...`);
                    for (let b = 1; b <= step.count; b++) {
                        const filename = `${step.prefix}_${b.toString().padStart(2, '0')}.png`;
                        await safeScreenshot(page, filename, { fullPage: true });
                        if (b < step.count) {
                            await page.waitForTimeout(step.intervalMs);
                        }
                    }
                    break;
                default:
                    console.log(`⚠️ Unknown action: ${step.action}`);
            }
        }
    } catch (error) {
        console.error(`🚨 [TIMELINE FAILURE] ${error.message}`);
        await safeScreenshot(page, 'timeline-failure-state.png', { fullPage: true });
    } finally {
        await browser.close();
        console.log("\n🤖 [TIMELINE HARNESS] Sequence complete.");
    }
}

runTimeline().catch(console.error);
