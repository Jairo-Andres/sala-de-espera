import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoDias, formatoEntero, formatoPeriodo, rangoPeriodos } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';

export default function Unidades({ registros, unidades }) {
  const { t, lang } = useLang();
  const filas = useMemo(() => {
    const porUnidad = new Map();
    for (const r of registros) {
      if (!porUnidad.has(r.hospital)) porUnidad.set(r.hospital, []);
      porUnidad.get(r.hospital).push(r);
    }
    return [...porUnidad.entries()]
      .map(([nombre, rs]) => {
        const [min, max] = rangoPeriodos(rs);
        const finos = rs.filter((r) => r.periodo === max);
        // Último dato (definición "solicitud") de cada especialidad, para el termómetro.
        const ult = new Map();
        for (const r of rs) {
          if (r.definicion !== 'solicitud') continue;
          const p = ult.get(r.especialidad);
          if (!p || r.periodo > p.periodo) ult.set(r.especialidad, r);
        }
        const propias = [...ult.values()].filter((r) => r.especialidad !== 'Todas las especialidades');
        const vals = (propias.length ? propias : [...ult.values()]).map((r) => r.dias_espera);
        return {
          u: unidades.get(nombre) ?? { nombre, corto: nombre, tipo: rs[0].tipo, departamento: rs[0].departamento },
          n: rs.length,
          especialidades: new Set(rs.map((r) => r.especialidad)).size,
          min: formatoPeriodo(min, rs.find((r) => r.periodo === min).granularidad, lang),
          max: formatoPeriodo(max, finos[0].granularidad, lang),
          tMin: Math.min(...vals),
          tMax: Math.max(...vals),
        };
      })
      .sort((a, b) => a.u.corto.localeCompare(b.u.corto, 'es'));
  }, [registros, unidades, lang]);

  const [min, max] = rangoPeriodos(registros);
  const escala = Math.ceil(Math.max(...filas.map((f) => f.tMax), 1) / 10) * 10;
  const deptos = new Set(filas.map((f) => f.u.departamento)).size;

  return (
    <Capitulo id="capitulo-1" kicker={t.c1Kicker} titulo={t.c1Titulo(filas.length)} texto={t.c1Texto}>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="ja-kpi"><dt className="ja-label">{lang === 'es' ? 'Unidades' : 'Units'}</dt><dd className="ja-kpi__value">{filas.length}</dd></div>
        <div className="ja-kpi"><dt className="ja-label">{lang === 'es' ? 'Departamentos' : 'Departments'}</dt><dd className="ja-kpi__value">{deptos}</dd></div>
        <div className="ja-kpi"><dt className="ja-label">{lang === 'es' ? 'Registros' : 'Records'}</dt><dd className="ja-kpi__value">{formatoEntero(registros.length, lang)}</dd></div>
        <div className="ja-kpi"><dt className="ja-label">{lang === 'es' ? 'Años cubiertos' : 'Years covered'}</dt><dd className="ja-kpi__value"><span aria-hidden="true">{min.slice(0, 4)}<span className="ja-kpi__unit">–{max.slice(2, 4)}</span></span><span className="sr-only">{min.slice(0, 4)}–{max.slice(0, 4)}</span></dd></div>
      </dl>

      <ul className="mt-8 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {filas.map(({ u, n, especialidades, min: desde, max: hasta, tMin, tMax }) => (
          <li key={u.nombre} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-t border-borde py-4">
            <span className="ja-bullet ja-bullet--d mt-0.5" aria-hidden="true">D</span>
            <div className="min-w-0">
              <p className="font-display text-lg font-black leading-tight">{u.corto} <span className="whitespace-nowrap font-body text-sm font-normal text-texto-suave">{' · '}{t.tipo[u.tipo]}, {u.departamento}</span></p>
              <p className="mt-1 font-mono text-sm">
                {desde} → {hasta}
                <span className="text-texto-suave"> · {formatoEntero(n, lang)} {t.registros} · {especialidades} {lang === 'es' ? (especialidades === 1 ? 'especialidad' : 'especialidades') : (especialidades === 1 ? 'specialty' : 'specialties')}</span>
              </p>
              <div className="mt-2 grid gap-1">
                <div className="termometro" aria-hidden="true">
                  <span className="termometro__rango" style={{ left: `${(tMin / escala) * 100}%`, width: `${((tMax - tMin) / escala) * 100}%` }} />
                </div>
                <p className="text-xs text-texto-suave">
                  {tMin === tMax ? t.termometroUno(formatoDias(tMin, lang)) : t.termometro(formatoDias(tMin, lang), formatoDias(tMax, lang))}
                  <span aria-hidden="true"> · 0–{escala}</span>
                </p>
              </div>
              {u.fuente_url && (
                <a href={u.fuente_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm">
                  {t.verFuente}<span className="sr-only">: {u.nombre}</span> <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Capitulo>
  );
}
