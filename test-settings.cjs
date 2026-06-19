const { chromium } = require('playwright');
const path = require('path');

const DEV_URL = 'http://localhost:5173';
const SCREENSHOT_PATH = path.join(__dirname, 'test-settings-screenshot.png');

(async () => {
  console.log('\n🔍 sovereign-rag — Settings UI Verification');
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  ❌ [console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`  💥 [pageerror] ${err.message}`));

  console.log(`\n📡 Navigating to ${DEV_URL} ...`);
  await page.goto(DEV_URL, { waitUntil: 'domcontentloaded' });

  console.log(`⏳ Bypassing boot sequence for rapid UI testing...`);
  // Click the "FORCE BYPASS ENGINE (DEV DEMO)" button
  await page.getByText('FORCE BYPASS ENGINE (DEV DEMO)').click();

  // Wait for the UI to transition
  await page.waitForTimeout(2000);

  console.log(`⚙️ Opening Settings Menu...`);
  // The settings button is inside the SidebarMenu. We can look for the settings icon or button.
  // We'll evaluate JS to click the settings button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.innerHTML.includes('lucide-settings') || b.querySelector('svg.lucide-settings') || (b.title && b.title.includes('Settings')) || b.textContent.includes('Settings'));
    if (settingsBtn) {
      settingsBtn.click();
    } else {
      // If we can't find it easily by text, let's look for any button that looks like settings
      const sidebarButtons = document.querySelectorAll('button');
      sidebarButtons[sidebarButtons.length - 1].click(); // Usually the last button in sidebar
    }
  });

  await page.waitForTimeout(1000);

  // Take a screenshot of the settings modal
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`\n📸 Settings Verification Screenshot saved: ${SCREENSHOT_PATH}`);

  const modalHtml = await page.evaluate(() => {
    const modal = document.querySelector('.fixed.z-\\[101\\]');
    return modal ? modal.textContent.substring(0, 500) : 'Modal not found';
  });
  console.log(`📄 Modal Text Preview:\n  ${modalHtml}`);

  await browser.close();
})();
