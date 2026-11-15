import { useLang } from '../lib/i18n.js';
import { esViejo } from './datos.js';
import { R } from './textos.js';

/** Pill "Dato de AAAA" para datos con más de un año. No muestra nada si el dato es reciente. */
export default function Viejo({ periodo }) {
  const { lang } = useLang();
  if (!periodo || !esViejo(periodo)) return null;
  const r = R[lang];
  return <span className="v-chip v-chip--warn" title={r.datoDeLargo(periodo)}>{r.datoDe(periodo)}</span>;
}
