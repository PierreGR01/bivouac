import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '..', 'public', 'screenshots');
const DOCS_SCREENSHOTS_DIR = join(__dirname, '..', 'docs', 'screenshots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

await mkdir(SCREENSHOTS_DIR, { recursive: true });
await mkdir(DOCS_SCREENSHOTS_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();

// Load env vars so Supabase works
await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

// Wait for the map to be ready
await page.waitForSelector('.leaflet-container', { timeout: 20000 });
console.log('Map loaded');

// Wait for zones to appear (leaflet-interactive paths)
await page.waitForFunction(
  () => document.querySelectorAll('.leaflet-interactive').length > 0,
  { timeout: 15000 }
).catch(() => console.log('No zones yet, continuing...'));

// Extra wait for tiles to render
await new Promise(r => setTimeout(r, 3000));

// --- Screenshot 1: Navigate to Chartreuse area ---
// Fill search and navigate
await page.click('input[placeholder*="Lieu"]');
await page.type('input[placeholder*="Lieu"]', 'Chartreuse');
await new Promise(r => setTimeout(r, 1500));

// Click Saint-Pierre-de-Chartreuse
const allText = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('*'));
  const item = items.find(el =>
    el.textContent.trim() === 'Saint-Pierre-de-Chartreuse' &&
    el.children.length === 0
  );
  if (item) { item.click(); return 'clicked'; }
  // Try containing element
  const item2 = items.find(el =>
    el.textContent.includes('Saint-Pierre-de-Chartreuse') &&
    el.textContent.length < 60 &&
    el.children.length < 3
  );
  if (item2) { item2.click(); return 'clicked parent'; }
  return 'not found';
});
console.log('Search result:', allText);

await new Promise(r => setTimeout(r, 2000));

// Load zones
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('Rechercher les zones'));
  if (btn) btn.click();
});

await new Promise(r => setTimeout(r, 6000));
console.log('Zones loaded');

// Screenshot 1: Map with zones
const s1 = { path: join(SCREENSHOTS_DIR, 'map-zones.png'), type: 'png' };
await page.screenshot(s1);
await page.screenshot({ ...s1, path: join(DOCS_SCREENSHOTS_DIR, 'map-zones.png') });
console.log('Screenshot 1 saved: map-zones.png');

// --- Screenshot 2: Zone info panel ---
// Click on first interactive zone
await page.evaluate(() => {
  const paths = document.querySelectorAll('.leaflet-interactive');
  if (paths.length > 0) {
    const bbox = paths[0].getBoundingClientRect();
    const evt = new MouseEvent('click', {
      bubbles: true,
      clientX: bbox.left + bbox.width / 2,
      clientY: bbox.top + bbox.height / 2,
    });
    paths[0].dispatchEvent(evt);
  }
});

await new Promise(r => setTimeout(r, 1500));
const s2 = { path: join(SCREENSHOTS_DIR, 'zone-info.png'), type: 'png' };
await page.screenshot(s2);
await page.screenshot({ ...s2, path: join(DOCS_SCREENSHOTS_DIR, 'zone-info.png') });
console.log('Screenshot 2 saved: zone-info.png');

await browser.close();
console.log('Done.');
