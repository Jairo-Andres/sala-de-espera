import { useRef, useState } from 'react';
import { formatoDias } from '../lib/datos.js';
import { frenteAReferencia, ORDEN_ESPECIALIDADES } from './datos.js';
import { mesLargo } from './textos.js';
import { ASTERISCO, COLOR, grupo, Motivos, nombreGrupo, resumenMeses, textoReferencia } from './comun.jsx';

/** Capítulo "Frente a la referencia": una pestaña por especialidad, una barra por EPS y régimen. */
export default function Referencia({ turnos, tx }) {
  const { t, lang, esp } = tx;
  const [sel, setSel] = useState(0);
  const botones = useRef([]);
  const e = ORDEN_ESPECIALIDADES[sel];
  const filas = turnos.filter((x) => x.specialty === e);
  const ref = filas[0]?.standard;
  const max = Math.max(...filas.map((x) => x.req ?? 0), ref ?? 0, 1) * 1.12;
  const pos = (v) => `${(v / max) * 100}%`;
  const elegir = (i, foco) => { setSel(i); if (foco) botones.current[i]?.focus(); };
  const teclas = (ev) => {
    const n = ORDEN_ESPECIALIDADES.length;
    let i;
    if (ev.key === 'ArrowRight') i = (sel + 1) % n;
    else if (ev.key === 'ArrowLeft') i = (sel - 1 + n) % n;
    else if (ev.key === 'Home') i = 0;
    else if (ev.key === 'End') i = n - 1;
    else return;
    ev.preventDefault();
    elegir(i, true);
  };
  const dias = (v) => (v == null ? t.sinDato : `${formatoDias(v, lang)} ${t.dias}`);

  return (
    <>
      <p className="mb-4 text-sm">{t.refMeses(resumenMeses(turnos, t, lang))}</p>
      <div className="v-tabs" role="tablist" aria-label={t.especialidad} onKeyDown={teclas}>
        {ORDEN_ESPECIALIDADES.map((k, i) => (
          <button
            key={k}
            ref={(el) => { botones.current[i] = el; }}
            type="button"
            role="tab"
            id={`ref-tab-${k}`}
            aria-selected={i === sel}
            aria-controls="ref-panel"
            tabIndex={i === sel ? 0 : -1}
            onClick={() => elegir(i)}
          >{esp[k]}</button>
        ))}
      </div>
      <div className="v-panel" id="ref-panel" role="tabpanel" aria-labelledby={`ref-tab-${e}`}>
        <div className="v-panel-h">
          <h3>{esp[e]}</h3>
          <span className="v-chip v-chip--neutral">{textoReferencia(t, ref, e)}</span>
        </div>
        <div className="v-bars">
          {filas.map((x, k) => {
            const p = frenteAReferencia(x.req, ref);
            const nombre = nombreGrupo(t, x.eps, x.regimen);
            return (
              <div key={x.key} className={`v-bar-row ${ref != null ? 'v-h' : ''}`}>
                <div className="v-lab"><span>{nombre}</span><span>{dias(x.req)}</span></div>
                <div className="v-bt" role="img" aria-label={`${nombre}: ${dias(x.req)}`}>
                  {x.req != null && <i style={{ width: pos(x.req), background: COLOR[grupo(x.eps, x.regimen)] }} />}
                  {ref != null && <u style={{ left: pos(ref) }} data-l={k === 0 ? `≤ ${ref}` : undefined} />}
                </div>
                <div className="v-sub">
                  {p && <span className={`v-chip ${p === 'dentro' ? 'v-chip--good' : 'v-chip--bad'}`}>{p === 'dentro' ? t.dentroCorto : t.sobreRef(formatoDias(x.req - ref, lang))}</span>}
                  <span>
                    {x.req == null ? <Motivos punto={x} tx={tx} /> : (x.des != null ? `${t.desdeDeseada}: ${formatoDias(x.des, lang)}` : t.deseadaNoConfiable)}
                    {' · '}{mesLargo(x.ym, lang)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="v-legend">
          {filas.map((x) => <span key={x.key} style={{ '--sw': COLOR[grupo(x.eps, x.regimen)] }}>{nombreGrupo(t, x.eps, x.regimen)}</span>)}
          {ref != null && <span className="v-ln">{t.referenciaCorta}</span>}
        </div>
        {ASTERISCO.includes(e) && <p className="v-fine">{t.refNota}</p>}
        <details className="v-tbl-d">
          <summary>{t.refTabla}</summary>
          <div className="v-tbl" role="region" aria-label={`${t.refTitulo}: ${esp[e]}`} tabIndex={0}>
            <table>
              <thead><tr><th>{t.colEps}</th><th>{t.colMes}</th><th>{t.colSolicitud}</th><th>{t.colDeseada}</th></tr></thead>
              <tbody>
                {filas.map((x) => (
                  <tr key={x.key}>
                    <td>{nombreGrupo(t, x.eps, x.regimen)}</td>
                    <td>{mesLargo(x.ym, lang)}</td>
                    <td>{x.req == null ? t.sinDato : formatoDias(x.req, lang)}</td>
                    <td>{x.des == null ? t.sinDato : formatoDias(x.des, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <p className="v-fine mt-3">{t.refNotaDeseada}</p>
    </>
  );
}
