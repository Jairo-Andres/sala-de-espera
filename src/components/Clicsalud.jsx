import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { resumen } from '../lib/api.js';
import { PLAZO_NORMA, formatoDias, formatoEntero, formatoPeriodo } from '../lib/datos.js';
import { departamentos as listaDeptos, ciudades as listaCiudades, serieArchivo } from '../relevancia/datos.js';
import { R } from '../relevancia/textos.js';
import Capitulo from './Capitulo.jsx';
import Campo from './Campo.jsx';
import { Lineas } from './Graficos.jsx';

const ESPECIALIDADES = ['Medicina general', 'Odontología'];
const FUENTE = 'https://www.datos.gov.co/d/thui-g47e';

/**
 * Archivo Clicsalud (2016 a 2021-T3): una llamada a /resumen agrupada por periodo, con el promedio
 * ponderado por citas y la mediana entre IPS que calcula la API. Departamentos y ciudades vienen de la API.
 * No depende del selector de periodo: la fuente es histórica.
 */
export default function Clicsalud() {
  const { t, lang, esp } = useLang();
  const r = R[lang];
  const [deptos, setDeptos] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [depto, setDepto] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [especialidad, setEspecialidad] = useState(ESPECIALIDADES[0]);
  const [estado, setEstado] = useState({ cargando: false, error: null, serie: null, clave: null });

  useEffect(() => {
    const ctrl = new AbortController();
    resumen({ agrupar_por: 'departamento', tipo: 'ips', limit: 1000 }, { signal: ctrl.signal })
      .then((d) => setDeptos(listaDeptos(d.items)))
      .catch(() => { /* el select queda vacío y el error se ve al consultar */ });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    setCiudad('');
    setCiudades([]);
    if (!depto) return undefined;
    const ctrl = new AbortController();
    resumen({ agrupar_por: 'municipio', tipo: 'ips', depto, limit: 1000 }, { signal: ctrl.signal })
      .then((d) => setCiudades(listaCiudades(d.items)))
      .catch(() => { /* sin lista de ciudades se consulta el departamento completo */ });
    return () => ctrl.abort();
  }, [depto]);

  const consultar = async (e) => {
    e.preventDefault();
    if (!depto) return;
    const clave = { depto, ciudad, especialidad };
    setEstado({ cargando: true, error: null, serie: null, clave });
    try {
      const d = await resumen({ agrupar_por: 'periodo', tipo: 'ips', depto, municipio: ciudad, especialidad, limit: 200 });
      setEstado({ cargando: false, error: null, serie: serieArchivo(d.items), clave });
    } catch (err) {
      setEstado({ cargando: false, error: err, serie: null, clave });
    }
  };

  const s = estado.serie;
  const series = s ? [
    { id: 'ponderado', etiqueta: t.ponderado, puntos: s.map((p) => ({ periodo: p.periodo, granularidad: p.granularidad, dias_espera: p.ponderado })) },
    { id: 'mediana', etiqueta: t.mediana, puntos: s.map((p) => ({ periodo: p.periodo, granularidad: p.granularidad, dias_espera: p.mediana })) },
  ] : [];
  const lugar = estado.clave ? [estado.clave.ciudad, estado.clave.depto].filter(Boolean).join(', ') : '';
  const historico = s?.length > 0 && s.every((p) => p.historico);
  const ultimo = s?.[s.length - 1];

  return (
    <Capitulo id="archivo" kicker={t.clKicker} titulo={t.clTitulo} texto={t.clTexto}>
      <p className="max-w-2xl rounded-md border border-dashed border-borde-fuerte p-4 text-sm">{t.clAviso}</p>
      <form onSubmit={consultar} className="mt-6 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Campo etiqueta={t.departamento} value={depto} onChange={setDepto} opciones={[{ value: '', label: t.elegirDepto }, ...deptos.map((x) => ({ value: x, label: x }))]} />
        <Campo etiqueta={r.clCiudad} value={ciudad} onChange={setCiudad} opciones={[{ value: '', label: r.clTodas }, ...ciudades.map((x) => ({ value: x, label: x }))]} />
        <Campo etiqueta={t.especialidad} value={especialidad} onChange={setEspecialidad} opciones={ESPECIALIDADES.map((x) => ({ value: x, label: esp(x) }))} />
        <button type="submit" className="ja-btn ja-btn--primary" disabled={!depto || estado.cargando}>{t.ver}</button>
      </form>

      <div className="mt-6" aria-live="polite">
        {estado.cargando && (
          <div className="ja-loading" role="status">
            <p>{t.cargandoDepto}</p>
            <div className="ja-skeleton h-40 w-full" aria-hidden="true" />
          </div>
        )}
        {estado.error && <p role="alert" className="text-estado-malo">{t.errorTexto}</p>}
        {s && s.length === 0 && <p>{t.sinDatos}</p>}
        {s && s.length > 0 && (
          <div className="ja-card ja-card--raised">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-display text-xl font-black">{lugar} <span className="text-texto-suave">·</span> {esp(estado.clave.especialidad)}</p>
              {historico && <span className="v-sello">{r.clSello}</span>}
            </div>
            <dl className="v-facts v-facts--archivo">
              <div><dt>{t.ponderado}</dt><dd>{formatoDias(ultimo.ponderado, lang)}</dd></div>
              <div><dt>{t.mediana}</dt><dd>{formatoDias(ultimo.mediana, lang)}</dd></div>
              <div><dt>{r.clCitas}</dt><dd>{ultimo.citas == null ? '–' : formatoEntero(ultimo.citas, lang)}</dd></div>
              <div><dt>{r.clIps}</dt><dd>{formatoEntero(ultimo.ips, lang)}</dd></div>
            </dl>
            <p className="text-sm text-texto-suave">{r.clUltimo(formatoPeriodo(ultimo.periodo, ultimo.granularidad, lang))} · {t.clGranularidad}</p>
            <Lineas series={series} titulo={`${t.diasEspera}: ${lugar}, ${esp(estado.clave.especialidad)}`} referencia={{ valor: PLAZO_NORMA, etiqueta: t.normaLinea }} />
            <div className="ja-table-wrap mt-4 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${lugar} · ${esp(estado.clave.especialidad)}`}>
              <table className="ja-table">
                <thead>
                  <tr>
                    <th scope="col">{t.colPeriodo}</th>
                    <th scope="col" className="is-num">{t.ponderado}</th>
                    <th scope="col" className="is-num">{t.mediana}</th>
                    <th scope="col" className="is-num">{r.clCitas}</th>
                    <th scope="col" className="is-num">{t.ipsReportan}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s].reverse().map((p) => (
                    <tr key={p.periodo}>
                      <td className="whitespace-nowrap">{formatoPeriodo(p.periodo, p.granularidad, lang)}</td>
                      <td className="is-num">{formatoDias(p.ponderado, lang)}</td>
                      <td className="is-num">{formatoDias(p.mediana, lang)}</td>
                      <td className="is-num">{p.citas == null ? '–' : formatoEntero(p.citas, lang)}</td>
                      <td className="is-num">{formatoEntero(p.ips, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-texto-suave">
              {t.fuente}: Clicsalud, Ministerio de Salud · <a href={FUENTE} target="_blank" rel="noreferrer">{t.verFuente}</a>
            </p>
          </div>
        )}
      </div>
    </Capitulo>
  );
}
