// Screenshot the two home sections (MostPopularRail + Categories) in
// light/dark at desktop (1440) and mobile (390), into /tmp/candy-redesign.
// Usage: node scripts/shoot-two.mjs <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const prefix = process.argv[2] || 'cur';
const url = 'http://127.0.0.1:5273/';
const outDir = '/tmp/candy-redesign';
mkdirSync(outDir, { recursive: true });

const SECTIONS = [
  { sel: 'section[data-qa="rail"]', tag: 'rail' },
  { sel: '#categories-section', tag: 'cats' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 900 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
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
    await page.waitForTimeout(1000);
    for (const s of SECTIONS) {
      const el = await page.$(s.sel);
      const out = `${outDir}/${prefix}-${s.tag}-${vp.name}-${theme}.png`;
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        await el.screenshot({ path: out });
        console.log('wrote', out);
      } else {
        console.log('NOT FOUND', s.sel, 'at', vp.name, theme);
      }
    }
    await page.close();
  }
}

await browser.close();
