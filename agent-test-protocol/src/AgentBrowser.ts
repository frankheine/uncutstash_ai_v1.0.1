import { chromium, Page, BrowserContext, Browser } from 'playwright';

interface ProtocolConfig {
  url: string;
  onLogReceived: (logType: string, message: string) => void;
}

export async function launchAgentProtocol(config: ProtocolConfig) {
  // Launch browser (set headless: false if visual debugging is needed)
  const browser: Browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();

  // 1. Real-time F12 Console Stream
  page.on('console', msg => {
    config.onLogReceived(msg.type(), msg.text());
  });

  // 2. Real-time Unhandled JavaScript Exceptions / Page Crashes
  page.on('pageerror', exception => {
    config.onLogReceived('CRITICAL_EXCEPTION', exception.message);
  });

  // Navigate to target application
  await page.goto(config.url);

  /**
   * Automates the "Clear Site Data" button behavior under the Application Tab
   */
  async function clearApplicationData() {
    const client = await context.newCDPSession(page);
    await client.send('Storage.clearDataForOrigin', {
      origin: new URL(config.url).origin,
      storageTypes: 'all' // Wipes cookies, localStorage, indexedDB, cache, etc.
    });
    config.onLogReceived('SYSTEM', 'Application data storage successfully wiped.');
  }

  return { browser, context, page, clearApplicationData };
}
