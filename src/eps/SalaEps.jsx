import { useEffect, useMemo, useRef, useState } from 'react';
import { useAncho, useReducedMotion } from '../lib/hooks.js';
import { formatoDias, formatoEntero } from '../lib/datos.js';
import { ejeY } from '../components/Graficos.jsx';
import Capitulo from '../components/Capitulo.jsx';
import Campo from '../components/Campo.jsx';
import {
  advertencias, filasDepartamento, frenteAReferencia, mesAbs, motivosSinDato, ORDEN_ESPECIALIDADES,
  ordenarTurnos, simularFuenteCaida, tramos, ultimoMes, urlDatos,
} from './datos.js';
import { BANDERA, DEPARTAMENTO, EPS, ESPECIALIDAD, mesLargo, T } from './textos.js';

const INTERVALO = 6000;
const COLOR = {
  'sura|': 'var(--chart-1)', 'nueva_eps|contributivo': 'var(--chart-2)', 'nueva_eps|subsidiado': 'var(--chart-3)',
  'salud_total|contributivo': 'var(--chart-4)', 'salud_total|subsidiado': 'var(--chart-5)',
};
const grupo = (eps, regimen) => `${eps}|${regimen ?? ''}`;

function useTextos(lang) {
  return useMemo(() => ({ t: T[lang], b: BANDERA[lang], esp: ESPECIALIDAD[lang], lang }), [lang]);
}

function nombreGrupo(t, eps, regimen) {
  return regimen ? `${EPS[eps]} · ${t.regimenCorto[regimen]}` : EPS[eps];
}

function Motivos({ punto, tx }) {
  const m = motivosSinDato(punto);
  if (!m.length) return null;
  return <span>{tx.t.sinDatoPor}: {m.map((f) => tx.b[f.code] ?? f.code).join('; ')}</span>;
}

/* ---------- Turnero ---------- */

function TurneroEps({ turnos, tx }) {
  const { t, lang, esp } = tx;
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [encima, setEncima] = useState(false);
  const auto = !reduce && !pausado && !encima;
  useEffect(() => {
    if (!auto || turnos.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % turnos.length), INTERVALO);
    return () => clearInterval(id);
  }, [auto, turnos.length]);
  const turno = turnos[i];
  const ir = (d) => setI((x) => (x + d + turnos.length) % turnos.length);
  const numero = String(i + 1).padStart(3, '0');
  const sinDato = turno.req == null;
  const pos = frenteAReferencia(turno.req, turno.standard);
  return (
    <div className="escena">
      <section
        className="turnero p-5 sm:p-7"
        aria-roledescription={t.turnero}
        aria-label={t.turnero}
        onMouseEnter={() => setEncima(true)}
        onMouseLeave={() => setEncima(false)}
        onFocus={() => setEncima(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false); }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#2D3137] pb-3">
          <p className="ja-label !text-[#A2A9B1]">{t.turnero}</p>
          <p className="font-mono text-xs turnero__muted">{t.turnoDe(i + 1, turnos.length)}</p>
        </div>
        <div aria-live={auto ? 'off' : 'polite'} aria-atomic="true">
          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
            <p>
              <span className="block font-mono text-sm uppercase tracking-label turnero__muted">{t.turno}</span>
              <span className="turnero__digito mt-1 block text-[2rem]">{numero}</span>
            </p>
            <p key={`e${i}`} className="turnero__entra min-w-0 flex-1 pb-1">
              <span className="block font-display text-xl font-black leading-tight sm:text-2xl">{esp[turno.specialty]}</span>
              <span className="mt-1 block text-sm turnero__muted">{EPS[turno.eps]} · {t.regimen[turno.regimen]}</span>
            </p>
          </div>
          <div key={`d${i}`} className="turnero__entra mt-6 flex flex-wrap items-baseline gap-3 rounded-md bg-[#1A1D21] px-4 py-3">
            {sinDato ? (
              <span className="turnero__digito text-[2.25rem] sm:text-[2.75rem]">{t.sinDato}</span>
            ) : (
              <>
                <span className="turnero__digito text-[2.75rem] sm:text-[3.25rem]">{formatoDias(turno.req, lang)}</span>
                <span className="font-display text-lg font-black">{turno.req === 1 ? t.dia : t.dias}</span>
              </>
            )}
            <span className="ml-auto text-right font-mono text-xs turnero__muted">
              {t.promedioDe}<br />{mesLargo(turno.ym, lang)}
            </span>
          </div>
          <div className="mt-3 grid gap-1 text-sm turnero__muted">
            {sinDato ? <p><Motivos punto={turno} tx={tx} /></p> : <p>{t.desdeSolicitud}{turno.n ? ` · ${t.citas(formatoEntero(Math.round(turno.n), lang))}` : ''}</p>}
            <p>
              {turno.des != null ? `${t.desdeDeseada}: ${formatoDias(turno.des, lang)} ${t.dias}` : t.deseadaNoConfiable}
            </p>
            <p>
              {turno.standard != null ? `${t.referencia(turno.standard)}${turno.standard && ['ginecologia', 'cirugia_general'].includes(turno.specialty) ? '*' : ''}` : t.sinReferencia}
              {pos && <> · <b>{t.frente[pos]}</b></>}
            </p>
            <p><a href={turno.src.split(' | ')[0]} target="_blank" rel="noreferrer">{t.verFuente}<span className="sr-only"> ({EPS[turno.eps]}, {mesLargo(turno.ym, lang)})</span></a></p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="ja-btn turnero__btn" onClick={() => ir(-1)} aria-label={t.anterior}><span aria-hidden="true">←</span></button>
          <button type="button" className="ja-btn turnero__btn turnero__btn--solido flex-1 sm:flex-none" onClick={() => ir(1)}>
            <span className="sm:hidden">{t.siguienteCorto}</span><span className="hidden sm:inline">{t.siguiente}</span> <span aria-hidden="true">→</span>
          </button>
          {!reduce && (
            <button type="button" className="ja-btn turnero__btn" onClick={() => setPausado((p) => !p)}>{pausado ? t.reanudar : t.pausar}</button>
          )}
        </div>
        <p className="mt-4 text-xs turnero__muted">{t.turneroNota}</p>
      </section>
    </div>
  );
}

/** "Nueva EPS: agosto de 2026; Salud Total y EPS Sura: septiembre de 2026" (sin repetir regímenes ni meses). */
function resumenMeses(items, t, lang) {
  const porMes = new Map();
  for (const x of items) {
    if (!porMes.has(x.ym)) porMes.set(x.ym, []);
    const nombre = EPS[x.eps];
    if (!porMes.get(x.ym).includes(nombre)) porMes.get(x.ym).push(nombre);
  }
  const y = lang === 'es' ? ' y ' : ' and ';
  return [...porMes.entries()].sort().map(([ym, n]) => `${n.length > 1 ? `${n.slice(0, -1).join(', ')}${y}${n.at(-1)}` : n[0]}: ${mesLargo(ym, lang)}`).join('; ');
}

/* ---------- Capítulo 2: frente a la referencia ---------- */

function Referencia({ turnos, tx }) {
  const { t, lang, esp } = tx;
  const max = Math.max(...turnos.map((x) => Math.max(x.req ?? 0, x.standard ?? 0)), 1);
  const { tope } = ejeY(max);
  const pct = (v) => `${Math.min(100, (v / tope) * 100)}%`;
  return (
    <>
      <p className="mb-2 text-sm">{t.refMeses(resumenMeses(turnos, t, lang))}</p>
      <p className="mb-4 flex flex-wrap gap-4 text-sm text-texto-suave">
        <span><span className="mr-1 inline-block h-3 w-6 rounded-sm bg-texto-suave align-middle" aria-hidden="true" />{t.refLeyendaBarra}</span>
        <span><span className="mr-1 inline-block h-4 w-0.5 bg-[var(--status-bad)] align-middle" aria-hidden="true" />{t.refLeyendaLinea}</span>
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {ORDEN_ESPECIALIDADES.map((e) => {
          const filas = turnos.filter((x) => x.specialty === e);
          const ref = filas[0]?.standard;
          return (
            <figure key={e} className="ja-card grid gap-3 p-4">
              <figcaption className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-black">{esp[e]}</span>
                <span className="font-mono text-xs text-texto-suave">{ref != null ? `${t.referencia(ref)}${['ginecologia', 'cirugia_general'].includes(e) ? '*' : ''}` : t.sinReferencia}</span>
              </figcaption>
              {filas.map((x) => (
                <div key={x.key} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{nombreGrupo(t, x.eps, x.regimen)}</span>
                    <span className="text-right">
                      <b className="font-mono">{x.req == null ? t.sinDato : `${formatoDias(x.req, lang)} ${t.dias}`}</b>
                      {x.des != null && <span className="ml-2 text-xs text-texto-suave">({t.deseadaCorta} {formatoDias(x.des, lang)})</span>}
                    </span>
                  </div>
                  <div className="relative h-3 rounded-sm bg-superficie-2" aria-hidden="true">
                    {x.req != null && <div className="h-3 rounded-sm" style={{ width: pct(x.req), background: COLOR[grupo(x.eps, x.regimen)] }} />}
                    {ref != null && <div className="absolute -top-1 h-5 w-0.5 bg-[var(--status-bad)]" style={{ left: pct(ref) }} />}
                  </div>
                </div>
              ))}
            </figure>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-texto-suave">{t.refNotaDeseada}</p>
      <p className="mt-2 text-sm text-texto-suave">{t.refNota}</p>
      <details className="mt-4">
        <summary className="cursor-pointer font-bold">{t.refTabla}</summary>
        <div className="mt-3 overflow-x-auto" role="region" aria-label={t.refTitulo} tabIndex={0}>
          <table className="ja-table w-full text-sm">
            <thead><tr><th>{t.especialidad}</th><th>{t.colEps}</th><th>{t.colMes}</th><th>{t.colSolicitud}</th><th>{t.colDeseada}</th><th>{t.colReferencia}</th></tr></thead>
            <tbody>
              {turnos.map((x) => (
                <tr key={x.key}>
                  <td>{esp[x.specialty]}</td><td>{nombreGrupo(t, x.eps, x.regimen)}</td><td>{mesLargo(x.ym, lang)}</td>
                  <td className="font-mono">{x.req == null ? t.sinDato : formatoDias(x.req, lang)}</td>
                  <td className="font-mono">{x.des == null ? t.sinDato : formatoDias(x.des, lang)}</td>
                  <td className="font-mono">{x.standard != null ? `≤ ${x.standard}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/* ---------- Capítulo 3: tendencia ---------- */

function Tendencia({ datos, tx }) {
  const { t, lang, esp } = tx;
  const [e, setE] = useState('medicina_general');
  const [rango, setRango] = useState('todo');
  const [ref, ancho] = useAncho();
  const [hover, setHover] = useState(null);
  const series = Object.keys(COLOR).map((g) => {
    const [eps, regimen] = g.split('|');
    return { g, eps, regimen: regimen || null, puntos: datos.series[`${eps}|${regimen}|${e}`] ?? [] };
  }).filter((s) => s.puntos.length);
  const todos = series.flatMap((s) => s.puntos);
  const fin = Math.max(...todos.map((p) => mesAbs(p.ym)));
  const inicio = rango === 'uno' ? fin - 11 : rango === 'cinco' ? fin - 59 : Math.min(...todos.map((p) => mesAbs(p.ym)));
  const visibles = series.map((s) => ({ ...s, puntos: s.puntos.filter((p) => mesAbs(p.ym) >= inicio) }));
  const valores = visibles.flatMap((s) => s.puntos.map((p) => p.req)).filter((v) => v != null);
  const referencia = datos.standards[e];
  const { tope, marcas } = ejeY(Math.max(...valores, referencia ?? 0) * 1.05);
  const m = { top: 16, right: 16, bottom: 32, left: 40 };
  const alto = ancho < 480 ? 260 : 340;
  const w = ancho - m.left - m.right;
  const h = alto - m.top - m.bottom;
  const x = (ym) => m.left + ((mesAbs(ym) - inicio) / Math.max(1, fin - inicio)) * w;
  const y = (v) => m.top + h - (v / tope) * h;
  const anios = [];
  const a0 = Math.floor(inicio / 12);
  const a1 = Math.floor(fin / 12);
  const salto = Math.ceil((a1 - a0 + 1) / Math.max(2, Math.floor(w / 60)));
  for (let a = a0 + (inicio % 12 ? 1 : 0); a <= a1; a += salto) anios.push(a);
  const pandemia = [mesAbs('2020-03'), mesAbs('2020-06')];
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * ancho;
    const k = Math.round(((px - m.left) / w) * (fin - inicio)) + inicio;
    setHover(Math.max(inicio, Math.min(fin, k)));
  };
  const ymDe = (k) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
  const enHover = hover == null ? [] : visibles.map((s) => ({ s, p: s.puntos.find((p) => mesAbs(p.ym) === hover) })).filter((z) => z.p);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4">
        <Campo etiqueta={t.especialidad} value={e} onChange={setE} opciones={ORDEN_ESPECIALIDADES.map((k) => ({ value: k, label: esp[k] }))} />
        <fieldset className="grid gap-1 text-sm">
          <legend className="ja-label">{t.ultimos}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(t.rango).map(([k, v]) => (
              <button key={k} type="button" className={`ja-btn !min-h-tap !px-3 text-sm ${rango === k ? 'ja-btn--primary' : 'ja-btn--secondary'}`} aria-pressed={rango === k} onClick={() => setRango(k)}>{v}</button>
            ))}
          </div>
        </fieldset>
      </div>
      <ul className="mb-2 flex flex-wrap gap-4 text-sm">
        {visibles.map((s) => <li key={s.g}><span style={{ color: COLOR[s.g] }} aria-hidden="true">■ </span>{nombreGrupo(t, s.eps, s.regimen)}</li>)}
      </ul>
      <div ref={ref} className="relative w-full min-w-0">
        <svg width={ancho} height={alto} role="img" aria-label={`${t.tenTitulo}: ${esp[e]}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-pan-y">
          {pandemia[1] >= inicio && (
            <g>
              <rect x={x(ymDe(Math.max(pandemia[0], inicio)))} y={m.top} width={Math.max(2, x(ymDe(pandemia[1])) - x(ymDe(Math.max(pandemia[0], inicio))))} height={h} fill="var(--color-surface-2)" />
              <text x={x(ymDe(Math.max(pandemia[0], inicio))) + 4} y={m.top + 12} fontSize="11" fill="var(--chart-axis)">{t.pandemia}</text>
            </g>
          )}
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
              <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--chart-axis)" className="font-mono">{v}</text>
            </g>
          ))}
          {anios.map((a) => <text key={a} x={x(`${a}-01`)} y={alto - 8} textAnchor="middle" fontSize="12" fill="var(--chart-axis)" className="font-mono">{a}</text>)}
          {referencia != null && (
            <g>
              <line x1={m.left} x2={m.left + w} y1={y(referencia)} y2={y(referencia)} stroke="var(--status-bad)" strokeWidth="2" strokeDasharray="6 4" />
              <text x={m.left + 6} y={y(referencia) - 6} fontSize="12" fontWeight="700" fill="var(--status-bad)">{t.referencia(referencia)}</text>
            </g>
          )}
          {hover != null && <line x1={x(ymDe(hover))} x2={x(ymDe(hover))} y1={m.top} y2={m.top + h} stroke="var(--color-border-strong)" strokeDasharray="3 3" />}
          {visibles.map((s) => tramos(s.puntos).map((tr) => (
            tr.length === 1
              ? <circle key={s.g + tr[0].ym} cx={x(tr[0].ym)} cy={y(tr[0].req)} r="2.5" fill={COLOR[s.g]} />
              : <polyline key={s.g + tr[0].ym} points={tr.map((p) => `${x(p.ym)},${y(p.req)}`).join(' ')} fill="none" stroke={COLOR[s.g]} strokeWidth="2.25" strokeLinejoin="round" />
          )))}
          {enHover.filter((z) => z.p.req != null).map(({ s, p }) => (
            <circle key={s.g} cx={x(p.ym)} cy={y(p.req)} r="5" fill="var(--color-bg)" stroke={COLOR[s.g]} strokeWidth="3" />
          ))}
        </svg>
        {hover != null && enHover.length > 0 && (
          <div className="pointer-events-none absolute top-2 z-10 max-w-[16rem] rounded-md border border-borde bg-fondo p-3 text-sm shadow-md"
            style={x(ymDe(hover)) > ancho / 2 ? { right: ancho - x(ymDe(hover)) + 12 } : { left: x(ymDe(hover)) + 12 }} aria-hidden="true">
            <p className="font-mono text-xs text-texto-suave">{mesLargo(ymDe(hover), lang)}</p>
            {enHover.map(({ s, p }) => (
              <p key={s.g}><span style={{ color: COLOR[s.g] }}>■</span> {nombreGrupo(t, s.eps, s.regimen)}: <b>{p.req == null ? t.sinDato : formatoDias(p.req, lang)}</b></p>
            ))}
          </div>
        )}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer font-bold">{t.refTabla}</summary>
        <div className="mt-3 max-h-96 overflow-auto" role="region" aria-label={`${t.tenTitulo}: ${esp[e]}`} tabIndex={0}>
          <table className="ja-table w-full text-sm">
            <thead><tr><th>{t.colMes}</th>{visibles.map((s) => <th key={s.g}>{nombreGrupo(t, s.eps, s.regimen)}</th>)}</tr></thead>
            <tbody>
              {[...new Set(visibles.flatMap((s) => s.puntos.map((p) => p.ym)))].sort().reverse().map((ym) => (
                <tr key={ym}>
                  <td className="font-mono">{ym}</td>
                  {visibles.map((s) => {
                    const p = s.puntos.find((q) => q.ym === ym);
                    return <td key={s.g} className="font-mono" title={p && p.req == null ? motivosSinDato(p).map((f) => tx.b[f.code]).join('; ') : undefined}>{!p ? '' : p.req == null ? t.sinDato : formatoDias(p.req, lang)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/* ---------- Capítulo 4: departamentos ---------- */

function Departamentos({ datos, tx }) {
  const { t, lang, esp, b } = tx;
  const [eps, setEps] = useState('nueva_eps');
  const [regimen, setRegimen] = useState('contributivo');
  const [e, setE] = useState('cirugia_general');
  const porMes = datos.departments[`${eps}|${regimen}|${e}`] ?? {};
  const meses = Object.keys(porMes).sort();
  const [ym, setYm] = useState(meses[meses.length - 1]);
  const mes = porMes[ym] ? ym : meses[meses.length - 1];
  const filas = filasDepartamento(porMes, mes);
  const nacional = (datos.series[`${eps}|${regimen}|${e}`] ?? []).find((p) => p.ym === mes);
  const tope = ejeY(Math.max(...filas.map((f) => f.req ?? 0), nacional?.req ?? 0, datos.standards[e] ?? 0)).tope;
  const ref = datos.standards[e];
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-4">
        <Campo etiqueta={t.epsLabel} value={eps} onChange={setEps} opciones={['nueva_eps', 'salud_total'].map((k) => ({ value: k, label: EPS[k] }))} />
        <Campo etiqueta={t.regimenLabel} value={regimen} onChange={setRegimen} opciones={['contributivo', 'subsidiado'].map((k) => ({ value: k, label: t.regimen[k] }))} />
        <Campo etiqueta={t.especialidad} value={e} onChange={setE} opciones={ORDEN_ESPECIALIDADES.map((k) => ({ value: k, label: esp[k] }))} />
        <Campo etiqueta={t.mes} value={mes} onChange={setYm} opciones={[...meses].reverse().map((k) => ({ value: k, label: mesLargo(k, lang) }))} />
      </div>
      {nacional && (
        <p className="mb-3 text-sm">{t.nacional}: <b className="font-mono">{nacional.req == null ? t.sinDato : `${formatoDias(nacional.req, lang)} ${t.dias}`}</b>
          {ref != null && <span className="text-texto-suave"> · {t.referencia(ref)}</span>}</p>
      )}
      <ol className="grid gap-2">
        {filas.map((f) => {
          const avisos = advertencias(f);
          return (
            <li key={f.dept ?? `x${f.n}`} className="grid gap-1 sm:grid-cols-[11rem_1fr_6rem] sm:items-center sm:gap-3">
              <span className="text-sm font-bold">{DEPARTAMENTO[f.dept] ?? f.dept ?? '—'}</span>
              <span className="relative h-3 rounded-sm bg-superficie-2" aria-hidden="true">
                {f.req != null && <span className="block h-3 rounded-sm" style={{ width: `${Math.min(100, (f.req / tope) * 100)}%`, background: COLOR[grupo(eps, regimen)] }} />}
                {ref != null && <span className="absolute -top-1 h-5 w-0.5 bg-[var(--status-bad)]" style={{ left: `${(ref / tope) * 100}%` }} />}
              </span>
              <span className="font-mono text-sm sm:text-right">{f.req == null ? t.sinDatoFila : formatoDias(f.req, lang)}</span>
              {(f.req == null || avisos.length > 0) && (
                <span className="text-xs text-texto-suave sm:col-span-3">
                  {f.req == null && <Motivos punto={f} tx={tx} />}
                  {avisos.length > 0 && <span className="ja-status ja-status--warn mr-2 !py-0 !text-xs">{t.severidad.advertencia}</span>}
                  {avisos.map((a) => b[a.code] ?? a.code).join(' · ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ---------- Capítulo 5: calidad ---------- */

function Calidad({ datos, tx }) {
  const { t, lang, b } = tx;
  const fecha = (iso) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const porCodigo = {};
  for (const r of datos.quality.by_code) {
    const k = `${r.code}|${r.severity}`;
    porCodigo[k] = porCodigo[k] ?? { code: r.code, severity: r.severity, eps: {} };
    porCodigo[k].eps[r.eps] = r.count;
  }
  const filas = Object.values(porCodigo).sort((a, b2) => ['bloqueante', 'advertencia', 'nota'].indexOf(a.severity) - ['bloqueante', 'advertencia', 'nota'].indexOf(b2.severity));
  return (
    <>
      {datos.simulacion && <p className="ja-card mb-4 border-l-4 border-[var(--status-warn)] p-4 text-sm" role="note">{t.simulacion}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(datos.quality.sources).map(([k, s]) => (
          <article key={k} className="ja-card grid gap-2 p-4 text-sm" aria-labelledby={`fuente-${k}`}>
            <h3 id={`fuente-${k}`} className="flex items-center gap-2 text-lg">
              {s.name}
            </h3>
            <p><span className={`ja-status ${s.ok ? 'ja-status--good' : 'ja-status--bad'}`}>{s.ok ? t.fuenteOk : t.fuenteFalla}</span></p>
            {!s.ok && <p>{s.error === 'SIMULACION' ? t.errorFuente : s.error} {s.failing_since && <>· {t.fallaDesde} {fecha(s.failing_since)}</>}</p>}
            <p className="text-texto-suave">{t.revisado}: {fecha(s.checked_at)}</p>
            <p>{t.cubre}: {Object.entries(s.first_month ?? {}).map(([r, ym]) => `${r === 'unico' ? '' : `${t.regimenCorto[r]}: `}${ym} → ${s.last_month[r]}`).join(' · ')}</p>
            <p>{t.mesesFaltan}: {[...new Set(Object.values(s.missing_months ?? {}).flat())].sort().join(', ') || t.ninguno}</p>
            {s.unsupported_files > 0 && <p>{t.formatoOtro(s.unsupported_files)}</p>}
            <p>{t.archivosFallidos}: {s.files_failed.length ? s.files_failed.map((f) => <span key={f.url}><a href={f.url} target="_blank" rel="noreferrer">{f.period}</a> ({t.estadoArchivo[f.status] ?? f.status}) </span>) : t.ninguno}</p>
            <p><a href={s.source} target="_blank" rel="noreferrer">{t.verFuente.replace(' (PDF)', '')}</a></p>
          </article>
        ))}
      </div>
      <h3 className="mt-8 text-xl">{t.banderasTitulo}</h3>
      <p className="mt-1 text-sm text-texto-suave">{t.banderasTexto}</p>
      <div className="mt-3 overflow-x-auto" role="region" aria-label={t.banderasTitulo} tabIndex={0}>
        <table className="ja-table w-full text-sm">
          <thead><tr><th>{t.sinDatoPor}</th><th>{lang === 'es' ? 'Tipo' : 'Type'}</th><th>{EPS.nueva_eps}</th><th>{EPS.salud_total}</th><th>{EPS.sura}</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.code}${f.severity}`}>
                <td>{b[f.code] ?? f.code}</td>
                <td><span className={`ja-status ${f.severity === 'bloqueante' ? 'ja-status--bad' : f.severity === 'advertencia' ? 'ja-status--warn' : ''}`}>{t.severidad[f.severity]}</span></td>
                <td className="font-mono">{formatoEntero(f.eps.nueva_eps ?? 0, lang)}</td>
                <td className="font-mono">{formatoEntero(f.eps.salud_total ?? 0, lang)}</td>
                <td className="font-mono">{formatoEntero(f.eps.sura ?? 0, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Sala ---------- */

export default function SalaEps({ lang }) {
  const tx = useTextos(lang);
  const { t } = tx;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const titulo = useRef(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setError(false);
    fetch(urlDatos(), { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => {
        const demo = new URLSearchParams(window.location.search).get('eps_demo');
        if (demo === 'carga_fallida') throw new Error('demo');
        setDatos(demo === 'fuente_caida' ? simularFuenteCaida(d) : d);
      })
      .catch(() => { if (!ctrl.signal.aborted) setError(true); });
    return () => ctrl.abort();
  }, [intento]);

  const turnos = useMemo(() => (datos ? ordenarTurnos(datos.turnos) : []), [datos]);
  const frescura = datos ? resumenMeses(ultimoMes(datos.quality), t, lang) : '';

  return (
    <>
      <section id="portada-eps" className="ja-topo border-b border-borde" aria-labelledby="titulo-eps">
        <div className="mx-auto grid max-w-contenido gap-10 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="contents lg:grid lg:gap-6">
            <div>
              <p className="ja-label flex items-center gap-2"><span className="ja-bullet ja-bullet--d" aria-hidden="true">D</span>{t.kicker}</p>
              <h1 id="titulo-eps" ref={titulo} tabIndex={-1} className="mt-4 text-display">{t.titulo}</h1>
              <p className="mt-5 max-w-xl text-md text-texto-suave">{t.subtitulo}</p>
            </div>
            {datos && (
              <div className="grid gap-2 text-sm">
                <p>{t.frescura(frescura)}</p>
                <p className="font-mono text-texto-suave">{t.actualizado}: {new Date(datos.generated_at).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            )}
            <aside className="order-3 ja-card border-l-4 lg:order-none border-[var(--route-d)] p-4" aria-labelledby="avisos-eps">
              <h2 id="avisos-eps" className="text-lg">{t.avisosTitulo}</h2>
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">{t.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            </aside>
          </div>
          <div className="order-2 lg:order-none">
            {datos ? <TurneroEps turnos={turnos} tx={tx} /> : error ? (
              <div className="ja-loading" role="alert">
                <p className="font-display text-xl font-black">{t.errorCarga}</p>
                <div><button type="button" className="ja-btn ja-btn--primary" onClick={() => setIntento((i) => i + 1)}>{t.reintentar}</button></div>
              </div>
            ) : (
              <div className="ja-loading" role="status"><p className="font-display text-xl font-black">{t.cargando}</p><div className="ja-skeleton h-40 w-full" /></div>
            )}
          </div>
        </div>
      </section>
      {datos && (
        <>
          <Capitulo id="eps-relojes" kicker={t.relojesKicker} titulo={t.relojesTitulo} texto={t.relojesTexto}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="ja-card p-4"><h3 className="text-lg">{t.reloj1}</h3><p className="mt-2 text-texto-suave">{t.reloj1Texto}</p></div>
              <div className="ja-card p-4"><h3 className="text-lg">{t.reloj2}</h3><p className="mt-2 text-texto-suave">{t.reloj2Texto}</p></div>
            </div>
            <p className="mt-4 max-w-3xl">{t.relojesEjemplo}</p>
            <p className="mt-2 max-w-3xl text-texto-suave">{t.relojesSura}</p>
          </Capitulo>
          <Capitulo id="eps-referencia" kicker={t.refKicker} titulo={t.refTitulo} texto={t.refTexto}>
            <Referencia turnos={turnos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-tendencia" kicker={t.tenKicker} titulo={t.tenTitulo} texto={t.tenTexto}>
            <Tendencia datos={datos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-departamentos" kicker={t.depKicker} titulo={t.depTitulo} texto={t.depTexto}>
            <Departamentos datos={datos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-calidad" kicker={t.calKicker} titulo={t.calTitulo} texto={t.calTexto}>
            <Calidad datos={datos} tx={tx} />
            <h3 className="mt-8 text-xl">{t.fuentes}</h3>
            <p className="mt-1 max-w-3xl text-sm text-texto-suave">{t.fuentesTexto}</p>
            <p className="mt-2 text-sm"><a href="https://github.com/Jairo-Andres/sala-de-espera/tree/master/pipeline" target="_blank" rel="noreferrer">{t.metodo}</a></p>
          </Capitulo>
        </>
      )}
    </>
  );
}
