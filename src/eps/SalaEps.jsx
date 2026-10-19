import { useEffect, useMemo, useState } from 'react';
import { useAncho, useReducedMotion } from '../lib/hooks.js';
import { formatoDias, formatoEntero } from '../lib/datos.js';
import { ejeY } from '../components/Graficos.jsx';
import Capitulo from '../components/Capitulo.jsx';
import Campo from '../components/Campo.jsx';
import { Sala3D } from '../v2/Sala3D.jsx';
import TurneroV2 from '../v2/TurneroV2.jsx';
import Estimador from '../v2/Estimador.jsx';
import { V2 } from '../v2/textos.js';
import { mesAbs, motivosSinDato, ORDEN_ESPECIALIDADES, ordenarTurnos, simularFuenteCaida, tramos, ultimoMes, urlDatos } from './datos.js';
import { EPS, mesLargo } from './textos.js';
import { COLOR, grupo, irA, nombreGrupo, resumenMeses, useTextos, vistaTurnos } from './comun.jsx';
import Referencia from './Referencia.jsx';
import Departamentos from './Departamentos.jsx';
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
  const v = V2[lang];
  const reduce = useReducedMotion();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [i, setI] = useState(0);
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
  const vista = useMemo(() => vistaTurnos(turnos, tx), [turnos, tx]);
  const turno = turnos[i];
  const frescura = datos ? resumenMeses(ultimoMes(datos.quality), t, lang) : '';
  const opciones = useMemo(() => turnos.filter((x) => x.req != null).map((x) => ({
    etiqueta: `${tx.esp[x.specialty]} · ${nombreGrupo(t, x.eps, x.regimen)} · ${formatoDias(x.req, lang)} d`,
    valor: x.req,
    valorTexto: formatoDias(x.req, lang),
  })), [turnos, tx, t, lang]);
  const hechos = useMemo(() => {
    if (!datos) return null;
    const series = Object.values(datos.series).filter((s) => s.length);
    const desde = Math.min(...series.map((s) => Number(s[0].ym.slice(0, 4))));
    const hasta = Math.max(...series.map((s) => Number(s[s.length - 1].ym.slice(0, 4))));
    return [
      [v.hechosEps.eps, new Set(turnos.map((x) => x.eps)).size],
      [v.hechosEps.series, new Set(turnos.map((x) => grupo(x.eps, x.regimen))).size],
      [v.hechosEps.especialidades, ORDEN_ESPECIALIDADES.length],
      [v.hechosEps.anios, `${desde}–${String(hasta).slice(2)}`],
    ];
  }, [datos, turnos, v]);

  return (
    <>
      <div className="v-wrap">
        <section id="portada-eps" className="v-hero" aria-labelledby="titulo-eps">
          <div>
            <p className="v-eyebrow flex items-center gap-2"><span className="v-bullet" aria-hidden="true">D</span>{t.kicker}</p>
            <h1 id="titulo-eps">{t.titulo}</h1>
            <p className="v-lead">{t.subtitulo}</p>
            {datos && (
              <div className="mt-4 grid gap-1 text-sm text-texto-suave">
                <p>{t.frescura(frescura)}</p>
                <p className="font-mono">{t.actualizado}: {new Date(datos.generated_at).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            )}
            <div className="v-ctas">
              {datos && <button type="button" className="v-btn v-btn--primary" onClick={() => irA('eps-relojes')}>{v.empezar} <span aria-hidden="true">↓</span></button>}
              <a href="#portada" className="v-btn">{v.irHosp}</a>
            </div>
            {turno && (
              <Sala3D
                dias={turno.req ?? 0}
                reduce={reduce}
                etiqueta={v.salaEtiqueta}
                leyenda={(
                  <>
                    {turno.req == null ? t.sinDato : v.salaLeyenda(formatoDias(turno.req, lang), tx.esp[turno.specialty], nombreGrupo(t, turno.eps, turno.regimen))}
                    {(turno.req ?? 0) > 30 && ` · +${Math.round(turno.req) - 30}`}
                    <br /><span className="opacity-70">{v.girar}</span>
                  </>
                )}
              />
            )}
          </div>
          {datos ? (
            <TurneroV2 turnos={vista} i={i} setI={setI} t={t} reduce={reduce} etiqueta={t.turnero} notaFinal={t.turneroNota} />
          ) : error ? (
            <div className="ja-loading" role="alert">
              <p className="font-display text-xl font-black">{t.errorCarga}</p>
              <div><button type="button" className="v-btn v-btn--primary" onClick={() => setIntento((x) => x + 1)}>{t.reintentar}</button></div>
            </div>
          ) : (
            <div className="ja-loading" role="status"><p className="font-display text-xl font-black">{t.cargando}</p><div className="ja-skeleton h-40 w-full" /></div>
          )}
          {hechos && <dl className="v-facts">{hechos.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>}
        </section>
      </div>
      {datos && (
        <>
          <Estimador opciones={opciones} t={v} lang={lang} />
          <Capitulo id="eps-relojes" kicker={t.relojesKicker} titulo={t.relojesTitulo} texto={t.relojesTexto}>
            <div className="v-g2">
              <article className="v-card"><span className="v-chip v-chip--good">{t.titular}</span><h3>{t.reloj1Corto}</h3><p>{t.reloj1Texto}</p></article>
              <article className="v-card"><span className="v-chip v-chip--neutral">{t.secundaria}</span><h3>{t.reloj2Corto}</h3><p>{t.reloj2Texto}</p></article>
            </div>
            <div className="v-card mt-4"><p>{t.relojesEjemplo}</p><p className="v-fine">{t.relojesSura}</p></div>
          </Capitulo>
          <Capitulo id="eps-referencia" kicker={t.refKicker} titulo={t.refTitulo} texto={t.refTexto} alt>
            <Referencia turnos={turnos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-tendencia" kicker={t.tenKicker} titulo={t.tenTitulo} texto={t.tenTexto}>
            <Tendencia datos={datos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-departamentos" kicker={t.depKicker} titulo={t.depTitulo} texto={t.depTexto} alt>
            <Departamentos datos={datos} tx={tx} />
          </Capitulo>
          <Capitulo id="eps-calidad" kicker={t.calKicker} titulo={t.calTitulo} texto={t.calTexto}>
            <details className="v-callout mb-6" open>
              <summary>{t.avisosTitulo}</summary>
              <ul>{t.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            </details>
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
