import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { resumen } from '../lib/api.js';
import { formatoDias, formatoEntero } from '../lib/datos.js';
import Campo from '../components/Campo.jsx';
import { TIPOS_PROPIOS, ciudades as listaCiudades } from './datos.js';
import { R } from './textos.js';

const CIUDAD_DEFECTO = 'Bogotá';

/** Franja "Tu ciudad": promedio por especialidad en la ciudad elegida, con /resumen. */
export default function TuCiudad({ desde }) {
  const { t, lang, esp } = useLang();
  const r = R[lang];
  const [lista, setLista] = useState([]);
  const [ciudad, setCiudad] = useState(CIUDAD_DEFECTO);
  const [estado, setEstado] = useState({ cargando: true, error: false, items: [] });

  useEffect(() => {
    const ctrl = new AbortController();
    resumen({ agrupar_por: 'municipio', tipo: TIPOS_PROPIOS, desde_anio: desde, limit: 1000 }, { signal: ctrl.signal })
      .then((d) => {
        const l = listaCiudades(d.items);
        setLista(l);
        setCiudad((c) => (l.includes(c) ? c : l.includes(CIUDAD_DEFECTO) ? CIUDAD_DEFECTO : l[0] ?? c));
      })
      .catch(() => { if (!ctrl.signal.aborted) setLista([]); });
    return () => ctrl.abort();
  }, [desde]);

  useEffect(() => {
    if (!ciudad) return undefined;
    const ctrl = new AbortController();
    setEstado((e) => ({ ...e, cargando: true, error: false }));
    resumen({ agrupar_por: 'especialidad', municipio: ciudad, tipo: TIPOS_PROPIOS, desde_anio: desde, limit: 200 }, { signal: ctrl.signal })
      .then((d) => setEstado({ cargando: false, error: false, items: d.items }))
      .catch(() => { if (!ctrl.signal.aborted) setEstado({ cargando: false, error: true, items: [] }); });
    return () => ctrl.abort();
  }, [ciudad, desde]);

  const items = useMemo(
    () => [...estado.items].sort((a, b) => b.dias_espera - a.dias_espera),
    [estado.items],
  );
  const opciones = (lista.length ? lista : [ciudad]).map((c) => ({ value: c, label: c }));

  return (
    <section id="tu-ciudad" className="v-block v-ciudad" aria-labelledby="tu-ciudad-titulo">
      <div className="v-wrap">
        <div className="v-ciudad-top">
          <div className="v-sh">
            <span className="v-eyebrow">{r.tcKicker}</span>
            <h2 id="tu-ciudad-titulo">{r.tcTitulo(ciudad)}</h2>
            <p>{r.tcPromedio(desde)}. {r.tcNota}</p>
          </div>
          <Campo etiqueta={r.tcCiudad} value={ciudad} onChange={setCiudad} opciones={opciones} className="v-ciudad-campo" />
        </div>
        <div aria-live="polite" aria-busy={estado.cargando}>
          {estado.error && <p role="alert">{r.errorCorto}</p>}
          {!estado.cargando && !estado.error && items.length === 0 && <p>{r.tcVacio}</p>}
          {items.length > 0 && (
            <ul className="v-ciudad-lista">
              {items.map((i) => (
                <li key={`${i.grupo.especialidad}|${i.definicion}|${i.granularidad}`} className="v-card v-stat">
                  <span className="v-k">{esp(i.grupo.especialidad)}</span>
                  <b>{formatoDias(i.dias_espera, lang)} <small>{i.dias_espera === 1 ? t.dia : t.dias}</small></b>
                  <p className="v-fine">
                    {r.gran[i.granularidad]} · {r.def[i.definicion]} · {r.tcUnidades(i.unidades)}
                    {i.citas ? ` · ${formatoEntero(i.citas, lang)} ${t.citas.toLowerCase()}` : ''}
                  </p>
                  <p className="v-fine">{i.metodo === 'simple' ? r.tcSimple : r.tcPonderado}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
