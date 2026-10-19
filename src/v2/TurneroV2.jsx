import { useEffect, useRef, useState } from 'react';

/**
 * Turnero v2: tarjeta inclinada con dígitos que caen, barra de progreso que avanza sola
 * (se detiene con el mouse, el foco o fuera de pantalla) y controles. Genérico: cada sala
 * le pasa sus turnos ya formateados.
 *
 * turno: { titulo, quien, valor (texto o null = sin dato), unidad, periodo, nota, chip, fuente: {url, texto, sr} }
 */
export default function TurneroV2({ turnos, i, setI, t, reduce, etiqueta, notaFinal }) {
  const [jugando, setJugando] = useState(!reduce);
  const [quieto, setQuieto] = useState(false);
  const [enVista, setEnVista] = useState(true);
  const raiz = useRef(null);
  const tarjeta = useRef(null);
  const prog = useRef(null);
  const total = turnos.length;
  const turno = turnos[i];
  const numero = String(i + 1).padStart(3, '0');
  const [digitos, setDigitos] = useState(numero.split(''));
  const [gira, setGira] = useState([false, false, false]);

  useEffect(() => { if (reduce) setJugando(false); }, [reduce]);
  useEffect(() => {
    const nuevo = numero.split('');
    setGira(nuevo.map((d, k) => d !== digitos[k] && !reduce));
    setDigitos(nuevo);
    const id = setTimeout(() => setGira([false, false, false]), 400);
    return () => clearTimeout(id);
  }, [numero]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!raiz.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setEnVista(e.isIntersecting));
    io.observe(raiz.current);
    return () => io.disconnect();
  }, []);

  // Reinicia la barra de progreso con cada turno; al terminar, pasa al siguiente.
  useEffect(() => {
    const p = prog.current;
    if (!p) return;
    p.classList.remove('v-run');
    void p.offsetWidth; // eslint-disable-line no-void
    if (jugando) p.classList.add('v-run');
  }, [i, jugando]);
  const pausado = quieto || !enVista;
  const ir = (d) => setI((x) => (x + d + total) % total);

  // Inclinación que sigue al puntero (solo escritorio con mouse).
  const mover = (e) => {
    if (reduce || e.pointerType !== 'mouse' || !window.matchMedia('(min-width: 880px)').matches) return;
    const b = tarjeta.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    tarjeta.current.style.transform = `perspective(1100px) rotateY(${(-9 + x * 5).toFixed(2)}deg) rotateX(${(3 - y * 4).toFixed(2)}deg) rotateZ(-1deg)`;
  };

  if (!turno) return null;
  return (
    <div ref={raiz} className="min-w-0">
      <section
        ref={tarjeta}
        className="v-turn"
        aria-roledescription={etiqueta}
        aria-label={etiqueta}
        onPointerMove={mover}
        onPointerLeave={() => { if (tarjeta.current) tarjeta.current.style.transform = ''; }}
        onMouseEnter={() => setQuieto(true)}
        onMouseLeave={() => setQuieto(false)}
        onFocus={() => setQuieto(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setQuieto(false); }}
      >
        <div className="v-turn-top"><span>{etiqueta}</span><span>{t.turnoDe(i + 1, total)}</span></div>
        <div aria-live={jugando && !pausado ? 'off' : 'polite'} aria-atomic="true" className="flex flex-col gap-4">
          <div className="v-ticket">
            <span className="sr-only">{t.turno} {numero}</span>
            <div className="v-digits" aria-hidden="true">
              {digitos.map((d, k) => <i key={k} className={gira[k] ? 'v-flip' : undefined}>{d}</i>)}
            </div>
            <div className="v-spec"><h2>{turno.titulo}</h2><p>{turno.quien}</p></div>
          </div>
          <div className="v-big">
            {turno.valor == null ? <b className="!text-[2.4rem]">{t.sinDato}</b> : <><b>{turno.valor}</b><span>{turno.unidad}</span></>}
            <small>{t.promedioDe}<br />{turno.periodo}</small>
          </div>
          <div className="v-note">
            {turno.nota}
            {turno.chip}
            {turno.fuente && (
              <span><a href={turno.fuente.url} target="_blank" rel="noreferrer">{turno.fuente.texto}<span className="sr-only"> ({turno.fuente.sr})</span></a></span>
            )}
          </div>
        </div>
        <div
          ref={prog}
          className={`v-prog ${pausado ? 'v-paused' : ''}`}
          aria-hidden="true"
          onAnimationEnd={() => { if (jugando) ir(1); }}
        ><i /></div>
        <div className="v-controls">
          <button type="button" className="v-btn" onClick={() => ir(-1)} aria-label={t.anterior}><span aria-hidden="true">←</span></button>
          <button type="button" className="v-btn v-btn--primary" onClick={() => ir(1)}>
            <span className="sm:hidden">{t.siguienteCorto}</span><span className="hidden sm:inline">{t.siguiente}</span> <span aria-hidden="true">→</span>
          </button>
          {!reduce && <button type="button" className="v-btn" onClick={() => setJugando((p) => !p)}>{jugando ? t.pausar : t.reanudar}</button>}
        </div>
        <p className="v-fine">{notaFinal}</p>
      </section>
    </div>
  );
}
