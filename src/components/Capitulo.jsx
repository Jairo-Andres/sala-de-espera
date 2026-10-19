import { useEnVista, useReducedMotion } from '../lib/hooks.js';

/** Sección de la historia (v2): etiqueta, título, texto y contenido que aparece al hacer scroll. */
export default function Capitulo({ id, kicker, titulo, texto, children, alt = false, className = '' }) {
  const reduce = useReducedMotion();
  const [ref, visto] = useEnVista({ threshold: 0.08 });
  const fondo = alt || className.includes('bg-superficie');
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={`v-block ${fondo ? 'v-alt' : ''}`}>
      <div ref={ref} className={`v-wrap revela ${!reduce && !visto ? 'revela--oculto' : ''}`}>
        <div className="v-sh">
          <span className="v-eyebrow">{kicker}</span>
          <h2 id={`${id}-titulo`}>{titulo}</h2>
          {texto && <p>{texto}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
