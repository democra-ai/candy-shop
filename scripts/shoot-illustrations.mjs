// QA screenshot of the illustration preview (light + dark panels).
// Usage: node scripts/shoot-illustrations.mjs [outPath] [url]
import { chromium } from 'playwright';

const out = process.argv[2] || '/tmp/illustrations-preview.png';
const url = process.argv[3] || 'http://127.0.0.1:5273/illustrations-preview.html';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle' });
// Let webfonts (Fredoka) settle so the wordmark renders correctly.
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
