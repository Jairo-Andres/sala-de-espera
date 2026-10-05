import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoEntero, formatoPeriodo, rangoPeriodos } from '../lib/datos.js';
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
        return {
          u: unidades.get(nombre) ?? { nombre, corto: nombre, tipo: rs[0].tipo, departamento: rs[0].departamento },
          n: rs.length,
          especialidades: new Set(rs.map((r) => r.especialidad)).size,
          min: formatoPeriodo(min, rs.find((r) => r.periodo === min).granularidad, lang),
          max: formatoPeriodo(max, finos[0].granularidad, lang),
        };
      })
      .sort((a, b) => a.u.corto.localeCompare(b.u.corto, 'es'));
  }, [registros, unidades, lang]);

  const [min, max] = rangoPeriodos(registros);
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
        {filas.map(({ u, n, especialidades, min: desde, max: hasta }) => (
          <li key={u.nombre} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-t border-borde py-4">
            <span className="ja-bullet ja-bullet--d mt-0.5" aria-hidden="true">D</span>
            <div className="min-w-0">
              <p className="font-display text-lg font-black leading-tight">{u.corto} <span className="whitespace-nowrap font-body text-sm font-normal text-texto-suave">{' · '}{t.tipo[u.tipo]}, {u.departamento}</span></p>
              <p className="mt-1 font-mono text-sm">
                {desde} → {hasta}
                <span className="text-texto-suave"> · {formatoEntero(n, lang)} {t.registros} · {especialidades} {lang === 'es' ? (especialidades === 1 ? 'especialidad' : 'especialidades') : (especialidades === 1 ? 'specialty' : 'specialties')}</span>
              </p>
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
