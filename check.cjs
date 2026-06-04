/**
 * check.cjs
 * Playwright headless Chromium visual verification for sovereign-rag dev server.
 * Usage: node check.cjs
 *
 * Captures:
 *  - Full-page screenshot saved to check-screenshot.png
 *  - All browser console messages (log, warn, error)
 *  - Any uncaught page errors / unhandled rejections
 *  - Vite error overlay detection
 *  - Network requests that returned 4xx/5xx
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEV_URL = 'http://localhost:5173';
const SCREENSHOT_PATH = path.join(__dirname, 'check-screenshot.png');
const WAIT_MS = 6000; // give the React app + GSAP preloader time to render

(async () => {
  console.log('\n🔍 sovereign-rag — Playwright Headless Check');
  console.log('━'.repeat(50));

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',   // allow COEP/COOP headers locally
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Must match the COEP/COOP headers Vite sends
    bypassCSP: true,
  });

  const page = await context.newPage();

  // ── Collect console messages ──────────────────────────────────────────────
  const consoleLogs = [];
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
    const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️ ' : '📝';
    console.log(`  ${icon} [console.${type}] ${text}`);
  });

  // ── Collect uncaught page errors ──────────────────────────────────────────
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`  💥 [pageerror] ${err.message}`);
  });

  // ── Collect failed network requests ──────────────────────────────────────
  const failedRequests = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const entry = `${response.status()} ${response.url()}`;
      failedRequests.push(entry);
      console.log(`  🌐 [network] ${entry}`);
    }
  });

  // ── Navigate ──────────────────────────────────────────────────────────────
  console.log(`\n📡 Navigating to ${DEV_URL} ...`);
  try {
    await page.goto(DEV_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log(`\n❌ FATAL: Could not reach ${DEV_URL}`);
    console.log(`   Is the Vite dev server running? (npm run dev)`);
    console.log(`   Error: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  // ── Wait for app to render / preloader to run ─────────────────────────────
  console.log(`⏳ Waiting ${WAIT_MS}ms for app to render...`);
  await page.waitForTimeout(WAIT_MS);

  // ── Check for Vite error overlay ──────────────────────────────────────────
  const viteErrorOverlay = await page.$('vite-error-overlay');
  if (viteErrorOverlay) {
    const overlayText = await viteErrorOverlay.innerText().catch(() => '(could not read overlay text)');
    console.log(`\n❌ VITE ERROR OVERLAY DETECTED:\n${overlayText}`);
  } else {
    console.log('\n✅ No Vite error overlay detected.');
  }

  // ── Check for React error boundary output ────────────────────────────────
  const errorBoundary = await page.$('[data-reactroot] ~ div:has(h1)');
  if (errorBoundary) {
    const errorText = await errorBoundary.innerText().catch(() => '');
    if (errorText.toLowerCase().includes('error')) {
      console.log(`\n⚠️  Possible React error boundary output:\n  ${errorText.substring(0, 300)}`);
    }
  }

  // ── Get visible page title and body snippet ───────────────────────────────
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '(empty body)');
  console.log(`\n📄 Page title: "${title}"`);
  console.log(`📄 Body text preview:\n  ${bodyText.replace(/\n/g, '\n  ')}`);

  // ── Screenshot ────────────────────────────────────────────────────────────
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`\n📸 Screenshot saved: ${SCREENSHOT_PATH}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('━'.repeat(50));

  const errors = consoleLogs.filter(l => l.type === 'error');
  const warnings = consoleLogs.filter(l => l.type === 'warning');

  console.log(`  Console errors:    ${errors.length}`);
  console.log(`  Console warnings:  ${warnings.length}`);
  console.log(`  Page errors:       ${pageErrors.length}`);
  console.log(`  Failed requests:   ${failedRequests.length}`);
  console.log(`  Vite overlay:      ${viteErrorOverlay ? 'YES ❌' : 'none ✅'}`);

  if (errors.length === 0 && pageErrors.length === 0 && !viteErrorOverlay) {
    console.log('\n✅ ALL CLEAR — app appears to be running without errors.\n');
  } else {
    console.log('\n⚠️  Issues were detected. Review the output above.\n');
  }

  await browser.close();
})();
