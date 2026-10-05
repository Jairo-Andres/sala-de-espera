import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { useReducedMotion } from '../lib/hooks.js';
import { formatoDias } from '../lib/datos.js';

const SILLAS = 30;

/** Sala de espera en perspectiva: se ilumina una silla por cada día del turno actual (decorativa; el dato va en texto). */
export default function SalaIso({ turno, unidades }) {
  const { t, lang, esp } = useLang();
  const reduce = useReducedMotion();
  const objetivo = Math.min(SILLAS, Math.round(turno.dias_espera));
  const [encendidas, setEncendidas] = useState(reduce ? objetivo : 0);

  useEffect(() => {
    if (reduce) { setEncendidas(objetivo); return undefined; }
    setEncendidas(0);
    const ids = [];
    for (let k = 1; k <= objetivo; k++) ids.push(setTimeout(() => setEncendidas(k), 200 + k * 35));
    return () => ids.forEach(clearTimeout);
  }, [turno.numero, objetivo, reduce]);

  const extra = Math.round(turno.dias_espera) - SILLAS;
  const u = unidades.get(turno.hospital);
  return (
    <figure className="grid justify-items-center gap-2">
      <div className="sala" aria-hidden="true">
        <div className="sala__piso">
          {Array.from({ length: SILLAS }, (_, k) => (
            <span key={k} className={`sala__silla ${k < encendidas ? 'sala__silla--on' : ''}`}>
              <span className="sala__asiento" />
              <span className="sala__espaldar" />
            </span>
          ))}
        </div>
      </div>
      <figcaption className="text-center font-mono text-sm text-texto-suave">
        {t.salaLeyenda(formatoDias(turno.dias_espera, lang), esp(turno.especialidad), u?.corto ?? turno.hospital)}
        {extra > 0 && <> · {t.masSillas(extra)}</>}
      </figcaption>
    </figure>
  );
}
