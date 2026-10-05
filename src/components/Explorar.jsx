import { useMemo, useRef, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { agruparSeries, coberturaEspecialidades, formatoPeriodo, matrizMensual, ultimoPorUnidad } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';
import Campo from './Campo.jsx';
import { Barras, Lineas, MapaMensual, TablaDatos, colorSerie } from './Graficos.jsx';

const TABS = ['evolucion', 'especialidad', 'mes'];
const MAX_SERIES = 6;

function Nota() {
  const { t } = useLang();
  return (
    <aside className="mt-10 rounded-lg border-l-ruta border-l-ruta-d bg-superficie p-5" aria-labelledby="nota-titulo">
      <h3 id="nota-titulo" className="text-xl">{t.notaTitulo}</h3>
      <ul className="mt-3 grid list-disc gap-2 pl-5 text-texto">
        {t.nota.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </aside>
  );
}

function Evolucion({ registros, unidades }) {
  const { t, esp } = useLang();
  const series = useMemo(() => [...agruparSeries(registros).values()], [registros]);
  const nombres = useMemo(() => [...new Set(series.map((s) => s.hospital))].sort((a, b) => (unidades.get(a)?.corto ?? a).localeCompare(unidades.get(b)?.corto ?? b, 'es')), [series, unidades]);
  const [hospital, setHospital] = useState(() => nombres.find((n) => unidades.get(n)?.municipio === 'Popayán') ?? nombres[0]);
  const deUnidad = series.filter((s) => s.hospital === hospital);
  const variantes = [...new Set(deUnidad.map((s) => `${s.granularidad}|${s.definicion}`))];
  const [variante, setVariante] = useState(variantes[0]);
  const v = variantes.includes(variante) ? variante : variantes[0];
  const disponibles = deUnidad.filter((s) => `${s.granularidad}|${s.definicion}` === v).sort((a, b) => a.especialidad.localeCompare(b.especialidad, 'es'));
  const [elegidas, setElegidas] = useState(null);
  const activas = (elegidas ?? disponibles.slice(0, 3).map((s) => s.especialidad)).filter((e) => disponibles.some((s) => s.especialidad === e));
  const finales = activas.length ? activas : disponibles.slice(0, 3).map((s) => s.especialidad);
  const graf = disponibles
    .filter((s) => finales.includes(s.especialidad))
    .map((s) => ({ id: s.especialidad, etiqueta: esp(s.especialidad), puntos: s.puntos }));

  const cambiarUnidad = (h) => { setHospital(h); setElegidas(null); setVariante(null); };
  const alternar = (e) => {
    const base = finales;
    if (base.includes(e)) setElegidas(base.filter((x) => x !== e));
    else if (base.length < MAX_SERIES) setElegidas([...base, e]);
  };
  const u = unidades.get(hospital);
  const titulo = `${t.diasEspera}: ${u?.corto ?? hospital}`;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={t.unidad} value={hospital} onChange={cambiarUnidad} opciones={nombres.map((n) => ({ value: n, label: unidades.get(n)?.corto ?? n }))} />
        {variantes.length > 1 && (
          <Campo
            etiqueta={`${t.colPeriodo} · ${t.definicion}`}
            value={v}
            onChange={(x) => { setVariante(x); setElegidas(null); }}
            opciones={variantes.map((x) => { const [g, d] = x.split('|'); return { value: x, label: `${t.gran[g]} · ${t.def[d]}` }; })}
          />
        )}
      </div>
      {disponibles.length > 1 && (
        <fieldset className="mt-5">
          <legend className="ja-label">{t.serieCambia}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {disponibles.map((s) => {
              const on = finales.includes(s.especialidad);
              const idx = graf.findIndex((g) => g.id === s.especialidad);
              const bloqueada = !on && finales.length >= MAX_SERIES;
              return (
                <label key={s.especialidad} className={`flex min-h-tap cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm ${on ? 'border-texto bg-superficie-2 font-bold' : 'border-borde-fuerte'} ${bloqueada ? 'cursor-not-allowed text-texto-suave' : ''}`}>
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={on} disabled={bloqueada} onChange={() => alternar(s.especialidad)} />
                  {on && <span aria-hidden="true" style={{ color: colorSerie(idx) }}>■</span>}
                  {esp(s.especialidad)}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="mt-6">
        <Lineas series={graf} titulo={titulo} />
      </div>
      <p className="mt-3 text-sm text-texto-suave">
        {u?.nombre} · {t.estadoDef[u?.estadoDefinicion ?? 'asumida']}
        {u?.fuente_url && <> · <a href={u.fuente_url} target="_blank" rel="noreferrer">{t.verFuente}</a></>}
      </p>
      <TablaDatos series={graf} />
    </div>
  );
}

function PorEspecialidad({ registros, unidades }) {
  const { t, lang, esp } = useLang();
  const opciones = useMemo(() => coberturaEspecialidades(registros).filter((o) => o.unidades > 1), [registros]);
  const [especialidad, setEspecialidad] = useState(opciones[0]?.especialidad);
  const filas = ultimoPorUnidad(registros, especialidad).map((r) => {
    const u = unidades.get(r.hospital);
    return {
      id: r.hospital,
      etiqueta: u?.corto ?? r.hospital,
      valor: r.dias_espera,
      detalle: `${formatoPeriodo(r.periodo, r.granularidad, lang)}`,
      nota: u?.estadoDefinicion === 'asumida' ? `△ ${t.asumidaMarca}` : null,
    };
  });
  return (
    <div>
      <Campo className="max-w-sm" etiqueta={t.especialidad} value={especialidad} onChange={setEspecialidad} opciones={opciones.map((o) => ({ value: o.especialidad, label: `${esp(o.especialidad)} (${o.unidades})` }))} />
      <p className="mt-4 text-sm text-texto-suave">{t.porEspTexto}</p>
      <div className="mt-5">
        <Barras filas={filas} titulo={`${t.diasEspera}: ${esp(especialidad)}`} />
      </div>
    </div>
  );
}

function PorMes({ registros, unidades }) {
  const { t, esp } = useLang();
  const series = useMemo(() => [...agruparSeries(registros).values()].filter((s) => s.granularidad === 'mes'), [registros]);
  const opciones = series
    .map((s) => ({ s, u: unidades.get(s.hospital) }))
    .sort((a, b) => (a.u?.corto ?? '').localeCompare(b.u?.corto ?? '', 'es') || a.s.especialidad.localeCompare(b.s.especialidad, 'es'))
    .map(({ s, u }) => ({ value: `${s.hospital}|${s.especialidad}|${s.definicion}`, label: `${u?.corto ?? s.hospital} · ${esp(s.especialidad)}${s.definicion === 'fecha_deseada' ? ` · ${t.def.fecha_deseada}` : ''}`, s }));
  const [clave, setClave] = useState(() => (opciones.find((o) => unidades.get(o.s.hospital)?.municipio === 'Popayán') ?? opciones[0])?.value);
  const sel = opciones.find((o) => o.value === clave) ?? opciones[0];
  if (!sel) return <p>{t.sinDatos}</p>;
  const u = unidades.get(sel.s.hospital);
  return (
    <div>
      <Campo className="max-w-xl" etiqueta={`${t.unidad} · ${t.especialidad}`} value={sel.value} onChange={setClave} opciones={opciones} />
      <p className="mt-4 text-sm text-texto-suave">{t.soloMensual}</p>
      <div className="mt-5">
        <MapaMensual filas={matrizMensual(sel.s.puntos)} titulo={`${t.diasEspera}: ${sel.label}`} />
      </div>
      <p className="mt-3 text-sm text-texto-suave">
        {u?.nombre} · {t.def[sel.s.definicion]} ({t.estadoDef[u?.estadoDefinicion ?? 'asumida']})
        {u?.fuente_url && <> · <a href={u.fuente_url} target="_blank" rel="noreferrer">{t.verFuente}</a></>}
      </p>
    </div>
  );
}

export default function Explorar({ registros, unidades }) {
  const { t } = useLang();
  const [tab, setTab] = useState('evolucion');
  const refs = useRef({});
  const onKey = (e) => {
    const i = TABS.indexOf(tab);
    let n = null;
    if (e.key === 'ArrowRight') n = TABS[(i + 1) % TABS.length];
    if (e.key === 'ArrowLeft') n = TABS[(i - 1 + TABS.length) % TABS.length];
    if (e.key === 'Home') n = TABS[0];
    if (e.key === 'End') n = TABS[TABS.length - 1];
    if (n) { e.preventDefault(); setTab(n); refs.current[n]?.focus(); }
  };
  return (
    <Capitulo id="explorar" kicker={t.exKicker} titulo={t.exTitulo} texto={t.exTexto} className="bg-superficie">
      <div role="tablist" aria-label={t.exTitulo} className="flex gap-1 overflow-x-auto border-b-2 border-borde" onKeyDown={onKey}>
        {TABS.map((k) => (
          <button
            key={k}
            ref={(el) => { refs.current[k] = el; }}
            role="tab"
            type="button"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            className={`-mb-[2px] min-h-tap whitespace-nowrap border-b-4 px-4 font-bold ${tab === k ? 'border-ruta-d text-texto' : 'border-transparent text-texto-suave hover:text-texto'}`}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="ja-card ja-card--raised mt-6 !p-4 sm:!p-6">
        {tab === 'evolucion' && <Evolucion registros={registros} unidades={unidades} />}
        {tab === 'especialidad' && <PorEspecialidad registros={registros} unidades={unidades} />}
        {tab === 'mes' && <PorMes registros={registros} unidades={unidades} />}
      </div>
      <Nota />
    </Capitulo>
  );
}
