const { chromium } = require('playwright');
const path = require('path');

const DEV_URL = 'http://localhost:5173';
const SCREENSHOT_PATH = path.join(__dirname, 'test-chat-screenshot.png');

(async () => {
  console.log('\n🔍 sovereign-rag — Playwright AI Chat Verification');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--unlimited-storage',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    bypassCSP: true,
  });

  const page = await context.newPage();

  page.on('worker', worker => {
    worker.on('console', msg => console.log(`  ⚙️ [worker] ${msg.text()}`));
  });

  page.on('worker', worker => {
    worker.on('console', msg => console.log(`  ⚙️ [worker] ${msg.text()}`));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  ❌ [console.error] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.log(`  💥 [pageerror] ${err.message}`);
  });

  console.log(`\n📡 Navigating to ${DEV_URL} ...`);
  await page.goto(DEV_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

  console.log(`⏳ Waiting for Local AI Engine to download and boot (up to 3 minutes)...`);
  
  // Wait until the "Downloading AI Weights: 100%" or similar disappears, or just wait 120s if we can't detect it reliably.
  // Actually, let's just wait 120 seconds to be absolutely safe that it has finished downloading and booting.
  await page.waitForTimeout(120000);

  console.log(`💬 Typing a message...`);
  const input = page.getByPlaceholder('Send a message...');
  
  if (await input.count() > 0) {
    await input.fill('What is the capital of France?');
    console.log(`⏎ Sending message...`);
    await input.press('Enter');
    
    // Wait for the response to stream completely
    console.log(`⏳ Waiting up to 60s for assistant response...`);
    await page.waitForTimeout(60000); 
    
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
    console.log(`\n📄 Chat Log Preview:\n  ${bodyText.replace(/\n/g, '\n  ')}`);
  } else {
    console.log(`❌ Could not find chat input box.`);
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`\n📸 Final Verification Screenshot saved: ${SCREENSHOT_PATH}`);

  await browser.close();
})();
