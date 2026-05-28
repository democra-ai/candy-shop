// QA screenshots of the HOME page — light + dark, desktop + mobile.
// Usage: node scripts/shoot-home.mjs [tag] [url]
//   tag  — filename prefix (default "home")
// Writes /tmp/<tag>-{light,dark}-{desktop,mobile}.png and a few section crops.
import { chromium } from 'playwright';

const tag = process.argv[2] || 'home';
const url = process.argv[3] || 'http://127.0.0.1:5273/';

const browser = await chromium.launch();

async function shoot(theme, device) {
  const viewport = device === 'mobile'
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });

  // Force theme synchronously before first paint (matches index.html pattern).
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
  // Let typewriter + any mount settle.
  await page.waitForTimeout(1400);

  const base = `/tmp/${tag}-${theme}-${device}`;

  // Full page
  await page.screenshot({ path: `${base}-full.png`, fullPage: true });

  // Above-the-fold
  await page.screenshot({ path: `${base}-fold.png` });

  await page.close();
}

for (const theme of ['light', 'dark']) {
  for (const device of ['desktop', 'mobile']) {
    await shoot(theme, device);
    console.log('wrote', `/tmp/${tag}-${theme}-${device}-{full,fold}.png`);
  }
}

await browser.close();
console.log('done');
