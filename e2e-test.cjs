/**
 * Sovereign RAG — E2E Pipeline Test (fixed)
 */

const { chromium } = require('playwright');

(async () => {
    console.log('\n[TEST] Launching Chromium...');
    const browser = await chromium.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext();
    const page    = await context.newPage();

    // ── Capture browser console ───────────────────────────────────────────────
    page.on('console', msg => {
        const line = `  browser> [${msg.type().toUpperCase()}] ${msg.text()}`;
        console.log(line);
    });
    page.on('pageerror', err => console.error(`  [PAGE ERROR] ${err.message}`));

    // ── Navigate ──────────────────────────────────────────────────────────────
    console.log('[TEST] Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log('[TEST] DOM loaded. Waiting for engine boot (model may download — up to 10 min)...');

    // ── Wait for the chat panel to become interactive ─────────────────────────
    // The panel starts at opacity:0 / pointer-events:none.
    // App.tsx GSAP-animates it to opacity:1 / pointer-events:auto when engineReady=true.
    // FIX: null is the arg param, options is the THIRD param in Playwright API.
    await page.waitForFunction(
        () => {
            // Find the glass chat panel (has both these classes)
            const panel = document.querySelector('.glass-panel');
            if (!panel) return false;
            const st = window.getComputedStyle(panel);
            // GSAP sets opacity to 1 when engine is ready
            return parseFloat(st.opacity) > 0.9 && st.pointerEvents !== 'none';
        },
        null,            // ← arg passed into the browser fn (not used, must be null)
        { timeout: 600_000 }  // ← 10 minutes for model download
    );

    console.log('[TEST] ✅ Engine online — chat panel interactive.');

    // ── Find the message input ────────────────────────────────────────────────
    const inputSel = 'textarea[placeholder="Send a message..."], textarea';
    await page.waitForSelector(inputSel, { timeout: 15_000 });

    // ── Send the test message ─────────────────────────────────────────────────
    const MSG = 'Hello Frank, can you tell me what you are?';
    console.log(`\n[TEST] Sending: "${MSG}"`);
    await page.locator(inputSel).first().click();
    await page.locator(inputSel).first().fill(MSG);
    await page.keyboard.press('Enter');
    console.log('[TEST] Message sent. Streaming response...\n');

    // ── Poll for stable response ──────────────────────────────────────────────
    let lastText    = '';
    let stableCount = 0;
    const deadline  = Date.now() + 600_000; // 10 min

    while (Date.now() < deadline) {
        await page.waitForTimeout(1500);

        // Grab text from any element that looks like an assistant reply
        const text = await page.evaluate(() => {
            const candidates = [
                ...document.querySelectorAll('[data-message-role="assistant"]'),
                ...document.querySelectorAll('[class*="AssistantMessage"]'),
                ...document.querySelectorAll('[class*="assistant-message"]'),
            ];
            // Also try grabbing any visible non-empty paragraph/div under the chat panel
            if (candidates.length === 0) {
                const all = document.querySelectorAll('.glass-panel p, .glass-panel div');
                for (const el of all) {
                    const t = el.innerText?.trim();
                    if (t && t.length > 10 && t !== 'Send a message...' && t !== 'Hello there!') {
                        candidates.push(el);
                    }
                }
            }
            return candidates.map(el => el.innerText).join('\n').trim();
        });

        if (text && text !== lastText) {
            process.stdout.write(`\r  [stream] ${text.slice(0, 140).replace(/\n/g, ' ').padEnd(140)}`);
            stableCount = 0;
        } else if (text && text === lastText) {
            stableCount++;
            if (stableCount >= 4) break; // stable for 6 seconds = done
        }

        lastText = text;
    }

    process.stdout.write('\n');

    // ── Screenshot ────────────────────────────────────────────────────────────
    await page.screenshot({ path: 'e2e-result.png', fullPage: false });
    console.log('\n[TEST] Screenshot saved → e2e-result.png');

    // ── Final output ──────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('FRANK\'S RESPONSE:');
    console.log('══════════════════════════════════════════════════════════');
    console.log(lastText || '(no text captured — check e2e-result.png)');
    console.log('══════════════════════════════════════════════════════════');
    console.log(lastText ? '\n[TEST] ✅ PASSED — full pipeline functional.' : '\n[TEST] ⚠️  Response empty — check screenshot.');

    await browser.close();
})().catch(err => {
    console.error('\n[TEST FAILED]', err.message);
    process.exit(1);
});
