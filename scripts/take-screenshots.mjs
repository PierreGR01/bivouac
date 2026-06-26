import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'fs/promises';
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

async function save(page, name) {
  const p1 = join(SCREENSHOTS_DIR, name);
  const p2 = join(DOCS_SCREENSHOTS_DIR, name);
  await page.screenshot({ path: p1, type: 'png' });
  await copyFile(p1, p2);
  console.log('Saved:', name);
}

async function searchAndGo(page, query, resultText) {
  // On mobile the search may be behind a "Recherche" button — tap it first
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === 'Recherche');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Focus, select all, type the query
  await page.focus('input[placeholder*="Lieu"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(query);
  await new Promise(r => setTimeout(r, 1800));

  // Click the matching autocomplete result
  await page.evaluate((text) => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.textContent.trim() === text && e.children.length === 0)
      || all.find(e => e.textContent.includes(text) && e.textContent.length < 80 && e.children.length < 3);
    if (el) el.click();
  }, resultText);
  await new Promise(r => setTimeout(r, 2500));
}

async function loadZones(page) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.title === 'Rechercher les zones réglementées' || b.textContent.includes('Rechercher les zones'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 6000));
}

async function clickLayer(page, title) {
  await page.evaluate((t) => {
    const btn = document.querySelector(`button[title="${t}"]`);
    if (btn) btn.click();
  }, title);
  await new Promise(r => setTimeout(r, 3000));
}

async function clickFirstZone(page) {
  await page.evaluate(() => {
    const paths = document.querySelectorAll('.leaflet-interactive');
    if (paths.length > 0) {
      const bbox = paths[0].getBoundingClientRect();
      paths[0].dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: bbox.left + bbox.width / 2,
        clientY: bbox.top + bbox.height / 2,
      }));
    }
  });
  await new Promise(r => setTimeout(r, 1500));
}

// ─── MOBILE BROWSER ───────────────────────────────────────────────────────────
const mobile = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--window-size=390,844'],
  defaultViewport: { width: 390, height: 844, isMobile: true },
});

const mob = await mobile.newPage();
await mob.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
await mob.waitForSelector('.leaflet-container', { timeout: 20000 });
await new Promise(r => setTimeout(r, 3000));

// Mobile 1 — Spot bivouac "Joli spot au dessus des Doménons"
await searchAndGo(mob, 'Doménons', 'Doménons');
await new Promise(r => setTimeout(r, 1500));
await save(mob, 'mobile-spot.png');

// Mobile 2 — Points d'eau near that area
await clickLayer(mob, "Points d'eau");
await new Promise(r => setTimeout(r, 2000));
// Click first water point marker
await mob.evaluate(() => {
  const markers = document.querySelectorAll('.leaflet-marker-icon');
  if (markers.length > 0) {
    const bbox = markers[0].getBoundingClientRect();
    markers[0].dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: bbox.left + bbox.width / 2,
      clientY: bbox.top + bbox.height / 2,
    }));
  }
});
await new Promise(r => setTimeout(r, 1500));
await save(mob, 'mobile-water.png');

await mobile.close();

// ─── DESKTOP BROWSER ──────────────────────────────────────────────────────────
const desktop = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
});

const desk = await desktop.newPage();
await desk.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
await desk.waitForSelector('.leaflet-container', { timeout: 20000 });
await new Promise(r => setTimeout(r, 3000));

// Desktop 1 — Mode hiver (neige) + Précipitations, vue Col de Maure
await clickLayer(desk, 'Activer le mode hiver');
await clickLayer(desk, 'Radar précipitations');
await searchAndGo(desk, 'Col de Maure', 'Col de Maure');
await new Promise(r => setTimeout(r, 3000));
await save(desk, 'desktop-layers.png');

// Desktop 2 — Zone Parc des Écrins
// Reset layers
await clickLayer(desk, 'Radar précipitations');
await clickLayer(desk, 'Activer le mode hiver');
await searchAndGo(desk, 'Massif des Écrins', 'Massif des Écrins');
await loadZones(desk);
// Try to click the largest zone (Écrins national park)
await desk.evaluate(() => {
  const paths = Array.from(document.querySelectorAll('.leaflet-interactive'));
  // Sort by bounding box area to find the largest zone
  const withArea = paths.map(p => {
    const b = p.getBoundingClientRect();
    return { el: p, area: b.width * b.height, bbox: b };
  }).sort((a, b) => b.area - a.area);
  if (withArea.length > 0) {
    const { el, bbox } = withArea[0];
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: bbox.left + bbox.width / 2,
      clientY: bbox.top + bbox.height / 2,
    }));
  }
});
await new Promise(r => setTimeout(r, 2000));
await save(desk, 'desktop-ecrins.png');

// Desktop 3 — Spot bivouac Doménons (desktop)
await desk.evaluate(() => {
  const input = document.querySelector('input[placeholder*="Lieu"]');
  if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
});
// Close any open panel first
await desk.keyboard.press('Escape');
await searchAndGo(desk, 'Doménons', 'Doménons');
await new Promise(r => setTimeout(r, 1500));
await save(desk, 'desktop-spot.png');

await desktop.close();
console.log('\nAll screenshots done.');
