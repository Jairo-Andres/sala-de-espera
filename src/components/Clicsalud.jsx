import { useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { oportunidadCompleta } from '../lib/api.js';
import { PLAZO_NORMA, formatoDias, formatoEntero, formatoPeriodo, resumenPorPeriodo } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';
import Campo from './Campo.jsx';
import { Lineas } from './Graficos.jsx';

// Departamentos tal como los escribe la API para tipo=ips (extraídos de /hospitales el 2026-10-05).
const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Archipiélago de San Andrés, Providencia y Santa Catalina', 'Atlántico',
  'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindio', 'Risaralda', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada',
];
const ESPECIALIDADES = ['Medicina general', 'Odontología'];
const FUENTE = 'https://www.datos.gov.co/d/thui-g47e';

export default function Clicsalud() {
  const { t, lang, esp } = useLang();
  const [depto, setDepto] = useState('');
  const [especialidad, setEspecialidad] = useState(ESPECIALIDADES[0]);
  const [estado, setEstado] = useState({ cargando: false, error: null, resumen: null, clave: null });

  const consultar = async (e) => {
    e.preventDefault();
    if (!depto) return;
    const clave = `${depto}|${especialidad}`;
    setEstado({ cargando: true, error: null, resumen: null, clave });
    try {
      const filas = await oportunidadCompleta({ tipo: 'ips', depto, especialidad });
      setEstado({ cargando: false, error: null, resumen: resumenPorPeriodo(filas), clave });
    } catch (err) {
      setEstado({ cargando: false, error: err, resumen: null, clave });
    }
  };

  const r = estado.resumen;
  const series = r ? [
    { id: 'ponderado', etiqueta: t.ponderado, puntos: r.map((p) => ({ periodo: p.periodo, granularidad: p.granularidad, dias_espera: p.ponderado })) },
    { id: 'mediana', etiqueta: t.mediana, puntos: r.map((p) => ({ periodo: p.periodo, granularidad: p.granularidad, dias_espera: p.mediana })) },
  ] : [];
  const [d, es] = (estado.clave ?? '|').split('|');

  return (
    <Capitulo id="archivo" kicker={t.clKicker} titulo={t.clTitulo} texto={t.clTexto}>
      <p className="max-w-2xl rounded-md border border-dashed border-borde-fuerte p-4 text-sm">{t.clAviso}</p>
      <form onSubmit={consultar} className="mt-6 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Campo etiqueta={t.departamento} value={depto} onChange={setDepto} opciones={[{ value: '', label: t.elegirDepto }, ...DEPARTAMENTOS.map((x) => ({ value: x, label: x }))]} />
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
        {r && r.length === 0 && <p>{t.sinDatos}</p>}
        {r && r.length > 0 && (
          <div className="ja-card ja-card--raised">
            <p className="font-display text-xl font-black">{d} <span className="text-texto-suave">·</span> {esp(es)}</p>
            <p className="text-sm text-texto-suave">{t.clGranularidad}</p>
            <Lineas series={series} titulo={`${t.diasEspera}: ${d}, ${esp(es)}`} referencia={{ valor: PLAZO_NORMA, etiqueta: t.normaLinea }} />
            <div className="ja-table-wrap mt-4 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${d} · ${esp(es)}`}>
              <table className="ja-table">
                <thead>
                  <tr>
                    <th scope="col">{t.colPeriodo}</th>
                    <th scope="col" className="is-num">{t.ponderado}</th>
                    <th scope="col" className="is-num">{t.mediana}</th>
                    <th scope="col" className="is-num">{t.ipsReportan}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...r].reverse().map((p) => (
                    <tr key={p.periodo}>
                      <td className="whitespace-nowrap">{formatoPeriodo(p.periodo, p.granularidad, lang)}</td>
                      <td className="is-num">{formatoDias(p.ponderado, lang)}</td>
                      <td className="is-num">{formatoDias(p.mediana, lang)}</td>
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
