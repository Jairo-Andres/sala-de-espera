import { useEnVista, useReducedMotion } from '../lib/hooks.js';

/** Sección de la historia: etiqueta, título, texto y contenido que aparece al hacer scroll. */
export default function Capitulo({ id, kicker, titulo, texto, children, className = '' }) {
  const reduce = useReducedMotion();
  const [ref, visto] = useEnVista({ threshold: 0.08 });
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={`border-b border-borde ${className}`}>
      <div ref={ref} className={`revela ${!reduce && !visto ? 'revela--oculto' : ''} mx-auto max-w-contenido px-4 py-14 sm:px-6 md:py-20`}>
        <p className="ja-label">{kicker}</p>
        <h2 id={`${id}-titulo`} className="mt-3 text-3xl md:text-4xl">{titulo}</h2>
        {texto && <p className="mt-4 max-w-2xl text-md text-texto-suave">{texto}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
