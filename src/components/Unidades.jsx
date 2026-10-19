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

  const escala = Math.ceil(Math.max(...filas.map((f) => f.tMax), 1) / 15) * 15;
  const pct = (v) => `${(v / escala) * 100}%`;
  const esps = (n) => (lang === 'es' ? `${n} esp.` : `${n} spec.`);

  return (
    <Capitulo id="capitulo-1" kicker={t.c1Kicker} titulo={t.c1Titulo(filas.length)} texto={`${t.c1Texto} ${t.c1Rango}`} alt>
      <div className="v-axl" aria-hidden="true"><span /><div><span>0</span><span>{escala / 3}</span><span>{(2 * escala) / 3}</span><span>{escala} {t.dias}</span></div><span /></div>
      <ul className="v-rng">
        {filas.map(({ u, n, especialidades, min: desde, max: hasta, tMin, tMax }) => (
          <li key={u.nombre} className="v-row">
            <div className="v-nm">
              {u.fuente_url ? <a href={u.fuente_url} target="_blank" rel="noreferrer" className="text-texto">{u.corto}</a> : u.corto}
              <small>{t.tipo[u.tipo]} · {u.departamento} · {formatoEntero(n, lang)} {t.registros} · {esps(especialidades)}</small>
              <small>{desde} → {hasta}</small>
            </div>
            <div className="v-ax" role="img" aria-label={`${u.corto}: ${tMin === tMax ? t.termometroUno(formatoDias(tMin, lang)) : t.termometro(formatoDias(tMin, lang), formatoDias(tMax, lang))}`}>
              <i style={{ left: pct(tMin), width: pct(Math.max(tMax - tMin, 0)) }} />
            </div>
            <div className="v-v">{tMin === tMax ? formatoDias(tMin, lang) : `${formatoDias(tMin, lang)}–${formatoDias(tMax, lang)}`} d</div>
          </li>
        ))}
      </ul>
    </Capitulo>
  );
}
