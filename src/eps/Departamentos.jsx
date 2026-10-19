import { useId, useState } from 'react';
import { formatoDias } from '../lib/datos.js';
import Campo from '../components/Campo.jsx';
import { advertencias, filasDepartamento, ORDEN_ESPECIALIDADES } from './datos.js';
import { DEPARTAMENTO, EPS, mesLargo } from './textos.js';
import { COLOR, grupo, Motivos } from './comun.jsx';

const TOP = 12;

/** Capítulo "Por departamento": filtros, barras con referencia y promedio nacional, y los 12 con mayor espera. */
export default function Departamentos({ datos, tx }) {
  const { t, lang, esp, b } = tx;
  const idChk = useId();
  const [eps, setEps] = useState('nueva_eps');
  const [regimen, setRegimen] = useState('contributivo');
  const [e, setE] = useState('cirugia_general');
  const [soloOk, setSoloOk] = useState(false);
  const [todos, setTodos] = useState(false);
  const porMes = datos.departments[`${eps}|${regimen}|${e}`] ?? {};
  const meses = Object.keys(porMes).sort();
  const [ym, setYm] = useState(meses[meses.length - 1]);
  const mes = porMes[ym] ? ym : meses[meses.length - 1];
  const filas = filasDepartamento(porMes, mes);
  const nacional = (datos.series[`${eps}|${regimen}|${e}`] ?? []).find((p) => p.ym === mes);
  const ref = datos.standards[e];
  const tope = Math.max(...filas.map((f) => f.req ?? 0), nacional?.req ?? 0, ref ?? 0, 1) * 1.08;
  const pct = (v) => `${Math.min(100, (v / tope) * 100)}%`;
  const color = COLOR[grupo(eps, regimen)];
  const lista = filas.filter((f) => !(soloOk && (advertencias(f).length > 0 || f.req == null)));
  const visibles = todos ? lista : lista.slice(0, TOP);

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta={t.epsLabel} value={eps} onChange={setEps} opciones={['nueva_eps', 'salud_total'].map((k) => ({ value: k, label: EPS[k] }))} />
        <Campo etiqueta={t.regimenLabel} value={regimen} onChange={setRegimen} opciones={['contributivo', 'subsidiado'].map((k) => ({ value: k, label: t.regimen[k] }))} />
        <Campo etiqueta={t.especialidad} value={e} onChange={setE} opciones={ORDEN_ESPECIALIDADES.map((k) => ({ value: k, label: esp[k] }))} />
        <Campo etiqueta={t.mes} value={mes} onChange={setYm} opciones={[...meses].reverse().map((k) => ({ value: k, label: mesLargo(k, lang) }))} />
      </div>
      <div className="v-filters">
        <label className="v-tg" htmlFor={idChk}>
          <input id={idChk} type="checkbox" checked={soloOk} onChange={(ev) => setSoloOk(ev.target.checked)} /> {t.ocultarAdv}
        </label>
        <div className="v-legend">
          {ref != null && <span className="v-ln">{t.referencia(ref)}</span>}
          {nacional?.req != null && <span className="v-ln v-dot">{t.nacional}: {formatoDias(nacional.req, lang)} {t.dias}</span>}
          <span style={{ '--sw': `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 5px)` }}>{t.conAdvertencia}</span>
        </div>
      </div>
      <ol className="v-deps">
        {visibles.map((f) => {
          const avisos = advertencias(f);
          const marcado = avisos.length > 0;
          const nombre = DEPARTAMENTO[f.dept] ?? f.dept ?? '—';
          const valor = f.req == null ? t.sinDatoFila : formatoDias(f.req, lang);
          return (
            <li key={f.dept ?? `x${f.n}`} className={`v-dep ${marcado ? 'v-flag' : ''}`} style={{ '--sw': color }}>
              <span className="v-n">{nombre}</span>
              <div className="v-bt" role="img" aria-label={`${nombre}: ${valor}`}>
                {f.req != null && <i style={{ width: pct(f.req), background: marcado ? undefined : color }} />}
                {ref != null && <u style={{ left: pct(ref) }} />}
                {nacional?.req != null && <u className="v-avg" style={{ left: pct(nacional.req) }} />}
              </div>
              <span className="v-v">{valor}</span>
              {(f.req == null || marcado) && (
                <span className="v-w">
                  <b aria-hidden="true">△</b>
                  <span>
                    <b className="sr-only">{t.severidad.advertencia}: </b>
                    {f.req == null ? <Motivos punto={f} tx={tx} /> : avisos.map((a) => b[a.code] ?? a.code).join(' · ')}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {lista.length > TOP && (
        <button type="button" className="v-btn mt-4" aria-expanded={todos} onClick={() => setTodos((x) => !x)}>
          {todos ? t.verTop(TOP) : t.verTodos(lista.length)}
        </button>
      )}
    </>
  );
}
