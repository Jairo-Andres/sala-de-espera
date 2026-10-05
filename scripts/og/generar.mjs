// Genera public/og.png (1200×630) para la vista previa al compartir en LinkedIn.
// Uso: node scripts/og/generar.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(dir, 'og.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(dir, '..', '..', 'public', 'og.png') });
await browser.close();
