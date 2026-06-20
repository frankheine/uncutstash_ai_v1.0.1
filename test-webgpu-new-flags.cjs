const { chromium } = require('playwright');
(async () => {
    console.log("Launching browser with new flags...");
    try {
        const browser = await chromium.launch({
            headless: true,
            channel: 'msedge',
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
            ]
        });
        const page = await browser.newPage();
        await page.goto('about:blank');
        const hasWebGPU = await page.evaluate(() => navigator.gpu !== undefined);
        console.log("WebGPU Supported:", hasWebGPU);
        await browser.close();
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
})();
