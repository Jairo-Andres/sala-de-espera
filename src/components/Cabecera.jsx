import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { V2 } from '../v2/textos.js';

const SOL = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
const LUNA = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;

const temaOscuro = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Cabecera v2: marca, salas (Hospitales / EPS), idioma y tema; debajo, secciones de la sala con scroll-spy. */
export default function Cabecera({ onIdioma, sala = 'hospitales' }) {
  const { t, lang } = useLang();
  const v = V2[lang];
  const [oscuro, setOscuro] = useState(temaOscuro);
  const [actual, setActual] = useState(null);
  const chips = sala === 'eps' ? v.chipsEps : v.chipsHosp;
  const barra = useRef(null);
  const nav = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setOscuro(temaOscuro());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const cambiarTema = () => {
    const nuevo = oscuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem('sala-theme', nuevo); } catch { /* sin almacenamiento */ }
    setOscuro(!oscuro);
  };

  // Barra de lectura.
  useEffect(() => {
    let q = 0;
    const on = () => {
      if (q) return;
      q = requestAnimationFrame(() => {
        q = 0;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        barra.current?.style.setProperty('--p', h > 0 ? Math.min(1, window.scrollY / h).toFixed(4) : 0);
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // Sección visible (las secciones montan después de cargar los datos: se reintenta).
  useEffect(() => {
    let io = null;
    const conectar = () => {
      io?.disconnect();
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActual(e.target.id); }), { rootMargin: '-30% 0px -60% 0px' });
      chips.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    };
    conectar();
    const mo = new MutationObserver(conectar);
    const main = document.getElementById('contenido');
    if (main) mo.observe(main, { childList: true, subtree: false });
    const id = setTimeout(conectar, 1500);
    return () => { io?.disconnect(); mo.disconnect(); clearTimeout(id); };
  }, [sala, chips]);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [actual]);

  const ir = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <div ref={barra} className="v-sp" aria-hidden="true" />
      <header className="v-header">
        <div className="v-wrap">
          <div className="v-bar">
            <a href={sala === 'eps' ? '#eps' : '#portada'} className="v-brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }); }}>
              <span className="v-bullet" aria-hidden="true">D</span><span className="v-t">{t.titulo}</span>
            </a>
            <nav aria-label={v.salas} className="v-seg">
              <a href="#portada" aria-current={sala === 'hospitales' ? 'page' : undefined}>{v.hospitales}</a>
              <a href="#eps" aria-current={sala === 'eps' ? 'page' : undefined}>{v.eps}</a>
            </nav>
            <div className="v-tools">
              <button type="button" className="v-icon-btn" onClick={onIdioma} aria-label={t.idiomaAria} lang={lang === 'es' ? 'en' : 'es'}>
                {lang === 'es' ? 'EN' : 'ES'}
              </button>
              <button type="button" className="v-icon-btn" onClick={cambiarTema} aria-label={oscuro ? v.temaClaro : v.temaOscuro} title={oscuro ? v.temaClaro : v.temaOscuro}>
                {oscuro ? SOL : LUNA}
              </button>
            </div>
          </div>
          <nav ref={nav} className="v-chips" aria-label={v.secciones}>
            {chips.map(([id, texto], k) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={(actual ?? chips[0][0]) === id ? 'true' : undefined}
                onClick={(e) => { e.preventDefault(); ir(id); }}
                tabIndex={0}
                data-k={k}
              >{texto}</a>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
