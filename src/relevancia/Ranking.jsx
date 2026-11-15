import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoDias, formatoPeriodo } from '../lib/datos.js';
import Capitulo from '../components/Capitulo.jsx';
import { separarRanking } from './datos.js';
import { R } from './textos.js';
import Viejo from './Viejo.jsx';

/** "Quién espera más": un bloque por especialidad × definición × granularidad (nunca un ranking único). */
export default function Ranking({ ranking, unidades }) {
  const { t, lang, esp } = useLang();
  const r = R[lang];
  const { comparables, solas } = useMemo(() => separarRanking(ranking?.grupos ?? []), [ranking]);
  const corto = (h) => unidades.get(h)?.corto ?? h;

  return (
    <Capitulo id="ranking" kicker={r.rkKicker} titulo={r.rkTitulo} texto={r.rkTexto} alt>
      {comparables.length === 0 && solas.length === 0 && <p>{r.rkVacio}</p>}
      <ul className="v-g2">
        {comparables.map((g) => {
          const max = Math.max(...g.ranking.map((i) => i.dias_espera), 0.0001);
          const titulo = `${esp(g.especialidad)} · ${r.gran[g.granularidad]}, ${r.def[g.definicion]}`;
          return (
            <li key={`${g.especialidad}|${g.definicion}|${g.granularidad}`} className="v-card">
              <h3>{esp(g.especialidad)}</h3>
              <p className="flex flex-wrap gap-2">
                <span className="v-chip v-chip--neutral">{r.gran[g.granularidad]}</span>
                <span className="v-chip v-chip--neutral">{r.def[g.definicion]}</span>
                <span className="v-chip v-chip--neutral">{r.rkUnidades(g.unidades)}</span>
              </p>
              <ol className="v-rng v-rank" aria-label={titulo}>
                {g.ranking.map((i) => (
                  <li key={i.hospital_id} className="v-row">
                    <span className="v-nm">
                      {corto(i.hospital)}
                      <small>{formatoPeriodo(i.periodo, g.granularidad, lang)}</small>
                      <Viejo periodo={i.periodo} />
                    </span>
                    <span className="v-ax" aria-hidden="true"><i style={{ left: 0, width: `${Math.max(3, (i.dias_espera / max) * 100)}%` }} /></span>
                    <span className="v-v">{formatoDias(i.dias_espera, lang)} {i.dias_espera === 1 ? t.dia : t.dias}</span>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
      {solas.length > 0 && (
        <details className="v-callout mt-6">
          <summary>{r.rkSolas} ({solas.length})</summary>
          <p className="v-fine">{r.rkSolasTexto}</p>
          <div className="ja-table-wrap mt-3 max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-label={r.rkSolas}>
            <table className="ja-table">
              <thead>
                <tr>
                  <th scope="col">{r.rkColEsp}</th>
                  <th scope="col">{r.rkColUnidad}</th>
                  <th scope="col">{r.rkColPeriodo}</th>
                  <th scope="col" className="is-num">{r.rkColDias}</th>
                </tr>
              </thead>
              <tbody>
                {solas.map((i) => (
                  <tr key={`${i.especialidad}|${i.definicion}|${i.granularidad}|${i.hospital_id}`}>
                    <td>{esp(i.especialidad)}{i.definicion !== 'solicitud' && <span className="v-fine"> · {r.def[i.definicion]}</span>}</td>
                    <td>{corto(i.hospital)}</td>
                    <td className="whitespace-nowrap">{formatoPeriodo(i.periodo, i.granularidad, lang)} <Viejo periodo={i.periodo} /></td>
                    <td className="is-num">{formatoDias(i.dias_espera, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Capitulo>
  );
}
