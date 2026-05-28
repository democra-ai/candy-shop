// Crop a specific section of the home page by selector, light + dark.
// Usage: node scripts/shoot-section.mjs <selector> <tag> [theme]
import { chromium } from 'playwright';

const selector = process.argv[2] || '#skills-grid';
const tag = process.argv[3] || 'section';
const themes = process.argv[4] ? [process.argv[4]] : ['light', 'dark'];
const url = 'http://127.0.0.1:5273/';

const browser = await chromium.launch();

for (const theme of themes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
      const d = document.documentElement;
      if (t === 'dark') { d.classList.add('dark'); d.classList.remove('light'); }
      else { d.classList.add('light'); d.classList.remove('dark'); }
    } catch {}
  }, theme);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(1200);
  const el = await page.$(selector);
  const out = `/tmp/${tag}-${theme}.png`;
  if (el) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await el.screenshot({ path: out });
    console.log('wrote', out);
  } else {
    console.log('selector not found:', selector);
  }
  await page.close();
}

await browser.close();
