import { useLang } from '../lib/i18n.js';
import { PERIODOS } from './datos.js';
import { R } from './textos.js';

/** Selector global de periodo (se pasa como desde_anio a la API). */
export default function Periodo({ valor, onCambio, cargando }) {
  const { lang } = useLang();
  const r = R[lang];
  return (
    <div className="v-wrap v-periodo">
      <div className="v-periodo-fila" role="group" aria-labelledby="periodo-etiqueta" aria-describedby="periodo-ayuda">
        <span id="periodo-etiqueta" className="v-eyebrow">{r.periodoEtiqueta}</span>
        <div className="v-tabs">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" aria-pressed={valor === p.id} onClick={() => onCambio(p.id)}>
              {r.periodos[p.id]}
            </button>
          ))}
        </div>
        <span className="v-fine" aria-live="polite">{cargando ? r.cargando : ''}</span>
      </div>
      <p id="periodo-ayuda" className="v-fine">{r.periodoAyuda}</p>
    </div>
  );
}
