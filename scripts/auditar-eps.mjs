// Vista previa de la sala de las EPS: capturas (1440 y 390 px, ES/EN, claro/oscuro), estados
// especiales y axe-core (WCAG 2.1 A/AA).
// Uso: npm run build && npx vite preview --port 4173   (en otra terminal)
//      node scripts/auditar-eps.mjs [carpeta-salida] [url]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const salida = process.argv[2] ?? 'capturas/eps';
const URL_BASE = process.argv[3] ?? 'http://localhost:4173/';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
await mkdir(salida, { recursive: true });
const browser = await chromium.launch();
const resumen = [];

async function abrir({ ancho, lang = 'es', esquema = 'light', query = '', hash = '#eps' }) {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: ancho < 600 ? 844 : 900 }, colorScheme: esquema, deviceScaleFactor: 1,
    locale: lang === 'es' ? 'es-CO' : 'en-US', reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.addInitScript((l) => localStorage.setItem('sala-lang', l), lang);
  await page.goto(`${URL_BASE}?lang=${lang}${query}${hash}`);
  return { ctx, page };
}

async function axe(page, nombre) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const v = r.violations.map((x) => ({ id: x.id, impacto: x.impact, nodos: x.nodes.length, ejemplo: x.nodes[0]?.target?.join(' ') }));
  resumen.push({ vista: nombre, incumplimientos: v.length, detalle: v });
}

const foto = (page, nombre, opts = {}) => page.screenshot({ path: path.join(salida, `${nombre}.png`), ...opts });

// 1) Carga normal: página completa en escritorio y móvil, ES y EN; oscuro en ES.
for (const [ancho, lang, esquema] of [[1440, 'es', 'light'], [1440, 'en', 'light'], [390, 'es', 'light'], [390, 'en', 'light'], [1440, 'es', 'dark'], [390, 'es', 'dark']]) {
  const { ctx, page } = await abrir({ ancho, lang, esquema });
  await page.waitForSelector('#eps-calidad', { timeout: 30000 });
  const nombre = `${ancho}-${esquema}-${lang}`;
  await foto(page, `${nombre}-inicio`);
  await foto(page, `${nombre}-completa`, { fullPage: true });
  await axe(page, `${nombre} (sala EPS)`);
  await ctx.close();
}

// 2) "Sin dato" por validación: Nueva EPS contributivo, obstetricia, agosto de 2026 (Amazonas: 0 citas)
//    y la tabla mes a mes de pediatría de Sura (agosto de 2019: el promedio no cuadra con sus sumas).
for (const ancho of [1440, 390]) {
  const { ctx, page } = await abrir({ ancho });
  await page.waitForSelector('#eps-departamentos select');
  const sel = page.locator('#eps-departamentos select');
  await sel.nth(2).selectOption('obstetricia');
  await page.waitForTimeout(200);
  await page.locator('#eps-departamentos').screenshot({ path: path.join(salida, `${ancho}-light-es-sin-dato-departamento.png`) });
  // Salud Total por departamento (agregado desde sus filas por clínica).
  await sel.nth(0).selectOption('salud_total');
  await sel.nth(2).selectOption('medicina_general');
  await page.waitForTimeout(200);
  await page.locator('#eps-departamentos').screenshot({ path: path.join(salida, `${ancho}-light-es-salud-total-departamentos.png`) });
  await page.locator('#eps-tendencia select').selectOption('pediatria');
  await page.locator('#eps-tendencia details summary').click();
  const fila = page.locator('#eps-tendencia tr', { hasText: '2019-08' });
  await fila.scrollIntoViewIfNeeded();
  await page.locator('#eps-tendencia').screenshot({ path: path.join(salida, `${ancho}-light-es-sin-dato-serie.png`) });
  await axe(page, `${ancho} sin dato`);
  await ctx.close();
}

// 3) Error de fuente (simulado) y archivo de datos que no carga.
for (const ancho of [1440, 390]) {
  for (const lang of ['es', 'en']) {
    const { ctx, page } = await abrir({ ancho, lang, query: '&eps_demo=fuente_caida' });
    await page.waitForSelector('#eps-calidad');
    await page.locator('#eps-calidad').screenshot({ path: path.join(salida, `${ancho}-light-${lang}-fuente-caida.png`) });
    await axe(page, `${ancho} ${lang} fuente caída`);
    await ctx.close();
  }
  const { ctx, page } = await abrir({ ancho, query: '&eps_demo=carga_fallida' });
  await page.waitForSelector('[role=alert]');
  await foto(page, `${ancho}-light-es-carga-fallida`);
  await ctx.close();
}

// 4) Sala de hospitales con la cabecera nueva (lo único que cambia en ella).
for (const ancho of [1440, 390]) {
  const { ctx, page } = await abrir({ ancho, hash: '' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(salida, `${ancho}-light-es-hospitales-cabecera.png`), clip: { x: 0, y: 0, width: ancho, height: 260 } });
  await ctx.close();
}

await writeFile(path.join(salida, 'axe.json'), JSON.stringify(resumen, null, 2));
await browser.close();
const total = resumen.reduce((s, r) => s + r.incumplimientos, 0);
console.log(`axe: ${total} incumplimientos en ${resumen.length} vistas`);
for (const r of resumen.filter((x) => x.incumplimientos)) console.log(r.vista, JSON.stringify(r.detalle));
