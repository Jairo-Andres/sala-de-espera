/** Sección de la historia (v2): etiqueta, título, texto y contenido. Siempre visible: antes
 * aparecía al hacer scroll, pero al saltar desde los atajos la sección podía quedar oculta. */
export default function Capitulo({ id, kicker, titulo, texto, children, alt = false, className = '' }) {
  const fondo = alt || className.includes('bg-superficie');
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={`v-block ${fondo ? 'v-alt' : ''}`}>
      <div className="v-wrap">
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
