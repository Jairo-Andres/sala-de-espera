import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoDias } from '../lib/datos.js';

/** Píldora fija con el turno actual que acompaña el scroll una vez se deja atrás la portada. */
export default function Pildora({ turno, total, objetivo }) {
  const { t, lang, esp } = useLang();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById(objetivo);
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [objetivo]);
  if (!turno) return null;
  return (
    <a
      href="#titulo"
      className={`pildora ${visible ? 'pildora--visible' : ''}`}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={`${t.turnoDe(turno.numero, total)}: ${esp(turno.especialidad)}, ${formatoDias(turno.dias_espera, lang)} ${t.dias}. ${t.volverTurnero}`}
    >
      <span className="font-bold text-[#F2B705]">{t.turno} {String(turno.numero).padStart(3, '0')}</span>
      <span className="hidden sm:inline">{esp(turno.especialidad)}</span>
      <span>{formatoDias(turno.dias_espera, lang)} {t.dias}</span>
    </a>
  );
}
