// Autoevaluación: capturas a 390 px y 1280 px y axe-core (WCAG 2.1 A/AA) sobre el sitio local.
// Uso: npm run build && npx vite preview --port 4173  (en otra terminal)
//      node scripts/auditar.mjs [carpeta-salida] [url]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const salida = process.argv[2] ?? 'capturas/actual';
const URL_BASE = process.argv[3] ?? 'http://localhost:4173/';
const ANCHOS = [390, 1280];
const ESQUEMAS = ['light', 'dark'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

await mkdir(salida, { recursive: true });
const browser = await chromium.launch();
const resumen = [];

async function recorrer(page) {
  // Baja poco a poco para disparar las animaciones de aparición y luego vuelve arriba.
  const alto = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < alto; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function axe(page, nombre) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const v = r.violations.map((x) => ({ id: x.id, impacto: x.impact, nodos: x.nodes.length, ejemplo: x.nodes[0]?.target?.join(' '), resumen: x.nodes[0]?.failureSummary }));
  resumen.push({ vista: nombre, incumplimientos: v.length, nodos: v.reduce((s, x) => s + x.nodos, 0), detalle: v });
  return v;
}

for (const esquema of ESQUEMAS) {
  for (const ancho of ANCHOS) {
    for (const lang of esquema === 'light' ? ['es', 'en'] : ['es']) {
      const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho < 600 ? 844 : 900 }, colorScheme: esquema, deviceScaleFactor: 1, locale: lang === 'es' ? 'es-CO' : 'en-US' });
      const page = await ctx.newPage();
      const nombre = `${ancho}-${esquema}-${lang}`;
      await page.goto(`${URL_BASE}?lang=${lang}`);
      await page.evaluate((l) => localStorage.setItem('sala-lang', l), lang);
      await page.reload();
      await page.waitForSelector('#capitulo-1', { timeout: 120000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(salida, `${nombre}-inicio.png`) });
      await recorrer(page);
      await page.screenshot({ path: path.join(salida, `${nombre}-completa.png`), fullPage: true });
      await axe(page, `${nombre} (inicio)`);
      if (lang === 'es') {
        for (const tab of ['especialidad', 'mes']) {
          await page.click(`#tab-${tab}`);
          await page.waitForTimeout(400);
          await page.locator('#explorar').screenshot({ path: path.join(salida, `${nombre}-tab-${tab}.png`) });
          await axe(page, `${nombre} (pestaña ${tab})`);
        }
        await page.click('#tab-evolucion');
        if (esquema === 'dark') { await ctx.close(); continue; }
        // Archivo Clicsalud: consulta un departamento pequeño.
        await page.selectOption('#archivo select >> nth=0', 'Amazonas');
        await page.click('#archivo button[type=submit]');
        await page.waitForSelector('#archivo table', { timeout: 120000 });
        await page.waitForTimeout(400);
        await page.locator('#archivo').screenshot({ path: path.join(salida, `${nombre}-archivo.png`) });
        await axe(page, `${nombre} (archivo Clicsalud)`);
      }
      await ctx.close();
    }
  }
}

// Carga lenta: simula que la API tarda en despertar para capturar "Cargando datos".
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.route('**/estado', async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue(); });
  await page.goto(`${URL_BASE}?lang=es`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(salida, '390-light-es-cargando.png') });
  await axe(page, '390-light-es (cargando)');
  await ctx.close();
}

await browser.close();
await writeFile(path.join(salida, 'axe.json'), JSON.stringify(resumen, null, 2));
for (const r of resumen) console.log(`${r.incumplimientos === 0 ? 'OK ' : 'MAL'} ${r.vista}: ${r.incumplimientos} reglas, ${r.nodos} nodos${r.detalle.length ? ' -> ' + r.detalle.map((d) => `${d.id}(${d.nodos}) ${d.ejemplo}`).join('; ') : ''}`);
