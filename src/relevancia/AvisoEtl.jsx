import { useLang } from '../lib/i18n.js';
import { saludEtl } from './datos.js';
import { R } from './textos.js';

/** Aviso arriba si la última carga del ETL tiene fuentes caídas o más de 8 días. */
export default function AvisoEtl({ estado }) {
  const { lang } = useLang();
  const r = R[lang];
  const s = saludEtl(estado);
  if (!s || s.alDia) return null;
  return (
    <div className="v-wrap">
      <p className="v-aviso" role="status">
        <span aria-hidden="true">⚠</span>
        <span>
          {s.vieja && r.avisoViejo(s.dias)}
          {s.vieja && s.errores > 0 && ' '}
          {s.errores > 0 && r.avisoErrores(s.errores, s.total)}
        </span>
      </p>
    </div>
  );
}

/** Pill para el pie: "Al día" con la fecha, o "Con fuentes caídas". */
export function PillEtl({ estado }) {
  const { lang } = useLang();
  const r = R[lang];
  const s = saludEtl(estado);
  if (!s) return null;
  const fecha = new Date(s.fecha).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <span className={`v-chip ${s.alDia ? 'v-chip--good' : 'v-chip--warn'}`}>
      {s.alDia ? r.alDia : r.conErrores} · {fecha} · {r.fuentesOk(s.ok, s.total)}
    </span>
  );
}
