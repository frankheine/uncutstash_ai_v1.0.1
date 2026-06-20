const { chromium } = require('playwright');
(async () => {
    console.log("Launching browser...");
    try {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--headless=new',
                '--no-sandbox',
                '--enable-gpu',
                '--enable-unsafe-webgpu',
                '--use-angle=vulkan',
                '--use-gl=egl',
                '--use-cmd-decoder=passthrough'
            ]
        });
        console.log("Browser launched.");
        const page = await browser.newPage();
        console.log("Page created.");
        await page.goto('about:blank');
        const hasWebGPU = await page.evaluate(() => navigator.gpu !== undefined);
        console.log("WebGPU Supported:", hasWebGPU);
        await browser.close();
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
})();
