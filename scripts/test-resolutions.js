const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const sizes = [
    { name: 'laptop_1366x768', w: 1366, h: 768 },
    { name: 'compact_1280x720', w: 1280, h: 720 },
    { name: 'desktop_1536x864', w: 1536, h: 864 }
  ];
  for (const s of sizes) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.goto('http://localhost:3001/?url=demo', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `C:/Users/PC/.gemini/antigravity-ide/brain/2b79f55c-6089-48ca-87e5-3b69476b9308/${s.name}_home.png` });
    await page.click('button[data-tab="collection"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `C:/Users/PC/.gemini/antigravity-ide/brain/2b79f55c-6089-48ca-87e5-3b69476b9308/${s.name}_collection.png` });
    await page.click('button[data-tab="product"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `C:/Users/PC/.gemini/antigravity-ide/brain/2b79f55c-6089-48ca-87e5-3b69476b9308/${s.name}_product.png` });
    await page.close();
  }
  await browser.close();
  console.log('ALL_SCREENSHOTS_CAPTURED');
})();
