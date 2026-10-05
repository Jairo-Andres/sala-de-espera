import { useState } from 'react';
import { useAncho } from '../lib/hooks.js';
import { useLang } from '../lib/i18n.js';
import { formatoDias, formatoPeriodo, mesesCortos } from '../lib/datos.js';

const COLORES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
export const colorSerie = (i) => COLORES[i % COLORES.length];

/** Máximo "redondo" para el eje Y y sus marcas. */
export function ejeY(max) {
  const pasos = [1, 2, 5, 10, 15, 20, 25, 50, 100];
  const objetivo = Math.max(max, 1) / 4;
  const paso = pasos.find((p) => p >= objetivo) ?? 100;
  const tope = Math.ceil(max / paso) * paso || paso;
  const marcas = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);
  return { tope, marcas };
}

const fecha = (p) => new Date(`${p}T00:00:00`).getTime();

/**
 * Gráfico de líneas. series: [{ id, etiqueta, puntos: [{periodo, granularidad, dias_espera}] }]
 * En pantallas anchas pone la etiqueta al final de cada línea; en móvil usa leyenda.
 */
export function Lineas({ series, titulo, referencia = null }) {
  const { t, lang } = useLang();
  const [ref, ancho] = useAncho();
  const [hover, setHover] = useState(null);
  const todos = series.flatMap((s) => s.puntos);
  if (!todos.length) return <p className="text-texto-suave">{t.sinDatos}</p>;

  const directo = ancho >= 640;
  const m = { top: 16, right: directo ? 150 : 16, bottom: 32, left: 40 };
  const alto = ancho < 480 ? 260 : 320;
  const w = ancho - m.left - m.right;
  const h = alto - m.top - m.bottom;
  const tiempos = todos.map((p) => fecha(p.periodo));
  const t0 = Math.min(...tiempos);
  const t1 = Math.max(...tiempos);
  const { tope, marcas } = ejeY(Math.max(...todos.map((p) => p.dias_espera), referencia ? referencia.valor * 1.15 : 0));
  const x = (p) => m.left + (t1 === t0 ? w / 2 : ((fecha(p) - t0) / (t1 - t0)) * w);
  const y = (v) => m.top + h - (v / tope) * h;
  const anios = [];
  const a0 = new Date(t0).getFullYear();
  const a1 = new Date(t1).getFullYear();
  const saltoAnio = Math.ceil((a1 - a0 + 1) / Math.max(2, Math.floor(w / 70)));
  for (let a = a0; a <= a1; a += saltoAnio) if (fecha(`${a}-01-01`) >= t0 || a === a0) anios.push(a);

  // Etiquetas directas sin solaparse: se reparten en vertical si chocan.
  const finales = series
    .map((s, i) => ({ s, i, y: s.puntos.length ? y(s.puntos[s.puntos.length - 1].dias_espera) : 0 }))
    .filter((e) => e.s.puntos.length)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < finales.length; k++) if (finales[k].y - finales[k - 1].y < 16) finales[k].y = finales[k - 1].y + 16;

  const periodos = [...new Set(todos.map((p) => p.periodo))].sort();
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * ancho;
    let mejor = null;
    for (const p of periodos) if (!mejor || Math.abs(x(p) - px) < Math.abs(x(mejor) - px)) mejor = p;
    setHover(mejor);
  };
  const enHover = hover ? series.map((s, i) => ({ s, i, p: s.puntos.find((q) => q.periodo === hover) })).filter((e) => e.p) : [];
  const granHover = enHover[0]?.p.granularidad;

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={ancho} height={alto} role="img" aria-label={titulo} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-pan-y">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
            <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--chart-axis)" className="font-mono">{v}</text>
          </g>
        ))}
        {anios.map((a) => (
          <text key={a} x={Math.max(m.left, x(`${a}-01-01`))} y={alto - 8} textAnchor="middle" fontSize="12" fill="var(--chart-axis)" className="font-mono">{a}</text>
        ))}
        <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke="var(--color-border-strong)" />
        {referencia && (
          <g>
            <line x1={m.left} x2={m.left + w} y1={y(referencia.valor)} y2={y(referencia.valor)} stroke="var(--status-bad)" strokeWidth="2" strokeDasharray="6 4" />
            <text x={m.left + 6} y={y(referencia.valor) - 6} fontSize="12" fontWeight="700" fill="var(--status-bad)">{referencia.etiqueta}</text>
          </g>
        )}
        {hover && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + h} stroke="var(--color-border-strong)" strokeDasharray="3 3" />}
        {series.map((s, i) => (
          <g key={s.id}>
            <polyline
              points={s.puntos.map((p) => `${x(p.periodo)},${y(p.dias_espera)}`).join(' ')}
              fill="none" stroke={colorSerie(i)} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            />
            {s.puntos.length < 40 && s.puntos.map((p) => (
              <circle key={p.periodo} cx={x(p.periodo)} cy={y(p.dias_espera)} r="3" fill={colorSerie(i)} />
            ))}
          </g>
        ))}
        {enHover.map(({ s, i, p }) => (
          <circle key={s.id} cx={x(p.periodo)} cy={y(p.dias_espera)} r="5.5" fill="var(--color-bg)" stroke={colorSerie(i)} strokeWidth="3" />
        ))}
        {directo && finales.map(({ s, i, y: yy }) => (
          <text key={s.id} x={m.left + w + 10} y={yy} dy="0.32em" fontSize="13" fill="var(--color-fg)">
            <tspan fill={colorSerie(i)} fontWeight="700">■ </tspan>{s.etiqueta.length > 18 ? `${s.etiqueta.slice(0, 17)}…` : s.etiqueta}
          </text>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md border border-borde bg-fondo p-3 text-sm shadow-md"
          style={x(hover) > ancho / 2 ? { right: ancho - x(hover) + 12 } : { left: x(hover) + 12 }}
          aria-hidden="true"
        >
          <p className="font-mono text-xs text-texto-suave">{formatoPeriodo(hover, granHover, lang)}</p>
          {enHover.map(({ s, i, p }) => (
            <p key={s.id} className="whitespace-nowrap"><span style={{ color: colorSerie(i) }}>■</span> {s.etiqueta}: <b>{formatoDias(p.dias_espera, lang)}</b></p>
          ))}
        </div>
      )}
      {!directo && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {series.map((s, i) => (
            <li key={s.id}><span style={{ color: colorSerie(i) }} aria-hidden="true">■</span> {s.etiqueta}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Barras horizontales: una por unidad (útil en móvil, las etiquetas no se cortan). */
export function Barras({ filas, titulo, referencia = null }) {
  const { t, lang } = useLang();
  const [ref, ancho] = useAncho();
  if (!filas.length) return <p className="text-texto-suave">{t.sinDatos}</p>;
  const { tope } = ejeY(Math.max(...filas.map((f) => f.valor), referencia ? referencia.valor * 1.15 : 0));
  const xr = referencia ? (referencia.valor / tope) * ancho : null;
  return (
    <div ref={ref} className="w-full min-w-0">
      {referencia && (
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-estado-malo">
          <svg width="24" height="14" aria-hidden="true"><line x1="12" x2="12" y1="0" y2="14" stroke="var(--status-bad)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          {referencia.etiquetaLarga ?? referencia.etiqueta}
        </p>
      )}
      <ul className="grid gap-4" aria-label={titulo}>
        {filas.map((f) => (
          <li key={f.id} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-bold">{f.etiqueta}</span>
              <span className="font-mono text-sm"><b>{formatoDias(f.valor, lang)}</b> {t.dias} · <span className="text-texto-suave">{f.detalle}</span></span>
            </div>
            <svg width={ancho} height="14" aria-hidden="true" className="block">
              <rect x="0" y="0" width={ancho} height="14" rx="3" fill="var(--color-surface-2)" />
              <rect x="0" y="0" width={Math.max(3, (f.valor / tope) * ancho)} height="14" rx="3" fill="var(--ink-d)" />
              {xr != null && <line x1={xr} x2={xr} y1="-2" y2="16" stroke="var(--status-bad)" strokeWidth="2" strokeDasharray="4 3" />}
            </svg>
            {f.nota && <span className="text-xs text-texto-suave">{f.nota}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SEQ = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600', '--seq-700'];

/** Mapa de calor año × mes con el valor escrito en cada celda. */
export function MapaMensual({ filas, titulo }) {
  const { t, lang } = useLang();
  const [ref, ancho] = useAncho();
  const valores = filas.flatMap((f) => f.meses.filter(Boolean).map((p) => p.dias_espera));
  if (!valores.length) return <p className="text-texto-suave">{t.sinDatos}</p>;
  // La escala empieza en 0 días: así una diferencia de medio día no parece enorme.
  const min = 0;
  const max = Math.max(...valores, 1);
  const paso = (v) => Math.min(6, Math.floor((v / max) * 7));
  const estrecho = ancho < 560;
  const meses = mesesCortos(lang);
  return (
    <div ref={ref} className="w-full min-w-0">
      <table className="w-full table-fixed border-separate border-spacing-[2px] text-center font-mono text-[11px] sm:text-xs" aria-label={titulo}>
        <thead>
          <tr>
            <th scope="col" className="w-10 text-left font-normal text-texto-suave"><span className="sr-only">{lang === 'es' ? 'Año' : 'Year'}</span></th>
            {meses.map((mm) => (
              <th key={mm} scope="col" className="font-normal text-texto-suave">{estrecho ? mm.slice(0, 1) : mm}<span className="sr-only">{estrecho ? mm.slice(1) : ''}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.anio}>
              <th scope="row" className="text-left font-normal text-texto-suave">{estrecho ? `’${String(f.anio).slice(2)}` : f.anio}</th>
              {f.meses.map((p, i) => {
                if (!p) return <td key={i} className="h-9 rounded-sm border border-dashed border-borde"><span className="sr-only">{t.mesVacio}</span></td>;
                const k = paso(p.dias_espera);
                return (
                  <td key={i} className="h-9 rounded-sm" style={{ background: `var(${SEQ[k]})`, color: k >= 4 ? '#FFFFFF' : '#1A1D21' }}>
                    {estrecho && p.dias_espera >= 10 ? Math.round(p.dias_espera) : formatoDias(p.dias_espera, lang)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-xs text-texto-suave">
        <span className="font-mono">{formatoDias(min, lang)}</span>
        <span className="flex" aria-hidden="true">{SEQ.map((s) => <span key={s} className="h-3 w-5" style={{ background: `var(${s})` }} />)}</span>
        <span className="font-mono">{formatoDias(max, lang)}</span>
        <span>{t.dias}{estrecho ? (lang === 'es' ? ' (desde 10 se redondea)' : ' (10 or more rounded)') : ''}</span>
      </div>
    </div>
  );
}

/** Tabla con los valores exactos de un conjunto de series, dentro de un <details>. */
export function TablaDatos({ series }) {
  const { t, lang } = useLang();
  const filas = series.flatMap((s) => s.puntos.map((p) => ({ s, p }))).sort((a, b) => b.p.periodo.localeCompare(a.p.periodo));
  if (!filas.length) return null;
  return (
    <details className="mt-6">
      <summary className="ja-btn ja-btn--ghost cursor-pointer list-none !px-0">{t.verTabla} ({filas.length})</summary>
      <div className="ja-table-wrap mt-3 max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-label={t.verTabla}>
        <table className="ja-table">
          <thead>
            <tr>
              <th scope="col">{t.colPeriodo}</th>
              <th scope="col">{t.especialidad}</th>
              <th scope="col" className="is-num">{t.diasEspera}</th>
              <th scope="col" className="is-num">{t.citas}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ s, p }) => (
              <tr key={`${s.id}${p.periodo}`}>
                <td className="whitespace-nowrap">{formatoPeriodo(p.periodo, p.granularidad, lang)}</td>
                <td>{s.etiqueta}</td>
                <td className="is-num">{formatoDias(p.dias_espera, lang)}</td>
                <td className="is-num">{p.citas == null ? '–' : new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US').format(p.citas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
