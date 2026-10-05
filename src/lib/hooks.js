import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** Ancho de un contenedor, para dibujar los SVG al tamaño real (mobile-first). */
export function useAncho(inicial = 300) {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

/** true cuando el elemento entra en pantalla (una sola vez). */
export function useEnVista(opciones = { threshold: 0.2 }) {
  const ref = useRef(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    if (!ref.current || visto) return undefined;
    if (!('IntersectionObserver' in window)) {
      setVisto(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisto(true);
        io.disconnect();
      }
    }, opciones);
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visto]); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, visto];
}
