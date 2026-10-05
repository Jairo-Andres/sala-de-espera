import { useCallback, useEffect, useMemo, useState } from 'react';
import { cargarTodo } from './lib/api.js';
import { LangContext, traductor } from './lib/i18n.js';
import { indexarUnidades } from './lib/datos.js';
import Cabecera from './components/Cabecera.jsx';
import Cargando from './components/Cargando.jsx';
import Turnero from './components/Turnero.jsx';
import Hallazgos from './components/Hallazgos.jsx';
import Unidades from './components/Unidades.jsx';
import Relojes from './components/Relojes.jsx';
import Fila from './components/Fila.jsx';
import Explorar from './components/Explorar.jsx';
import Clicsalud from './components/Clicsalud.jsx';
import Pie from './components/Pie.jsx';

function idiomaInicial() {
  try {
    const guardado = localStorage.getItem('sala-lang');
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch { /* almacenamiento bloqueado */ }
  const p = new URLSearchParams(window.location.search).get('lang');
  if (p === 'en' || p === 'es') return p;
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export default function App() {
  const [lang, setLang] = useState(idiomaInicial);
  const [etapa, setEtapa] = useState(0);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'es' ? 'La sala de espera · Oportunidad de citas en Colombia' : 'The waiting room · Medical appointment waits in Colombia';
    try { localStorage.setItem('sala-lang', lang); } catch { /* sin almacenamiento */ }
  }, [lang]);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    setEtapa(0);
    cargarTodo(setEtapa, ctrl.signal)
      .then((d) => setDatos({ ...d, unidades: indexarUnidades(d.hospitales) }))
      .catch((e) => { if (!ctrl.signal.aborted) setError(e); });
    return () => ctrl.abort();
  }, [intento]);

  const reintentar = useCallback(() => setIntento((i) => i + 1), []);
  const ctx = useMemo(() => traductor(lang), [lang]);
  const t = ctx.t;

  return (
    <LangContext.Provider value={ctx}>
      <a href="#contenido" className="ja-btn ja-btn--primary sr-only-focusable fixed left-4 top-4 z-50">{t.saltar}</a>
      <Cabecera onIdioma={() => setLang(lang === 'es' ? 'en' : 'es')} />
      <main id="contenido">
        <section className="ja-topo border-b border-borde" aria-labelledby="titulo">
          <div className="mx-auto grid max-w-contenido gap-10 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="ja-label flex items-center gap-2"><span className="ja-bullet ja-bullet--d" aria-hidden="true">D</span>{t.ruta}</p>
              <h1 id="titulo" className="mt-4 text-display">{t.titulo}</h1>
              <p className="mt-5 max-w-xl text-md text-texto-suave">{t.subtitulo}</p>
              {datos && (
                <a href="#hallazgos" className="ja-btn ja-btn--secondary mt-7">{t.bajar} <span aria-hidden="true">↓</span></a>
              )}
            </div>
            <div>
              {datos ? (
                <Turnero registros={datos.registros} unidades={datos.unidades} />
              ) : (
                <Cargando etapa={etapa} error={error} onReintentar={reintentar} />
              )}
            </div>
          </div>
        </section>
        {datos && (
          <>
            <Hallazgos registros={datos.registros} unidades={datos.unidades} />
            <Unidades registros={datos.registros} unidades={datos.unidades} />
            <Relojes registros={datos.registros} unidades={datos.unidades} />
            <Fila registros={datos.registros} unidades={datos.unidades} />
            <Explorar registros={datos.registros} unidades={datos.unidades} />
            <Clicsalud />
          </>
        )}
      </main>
      <Pie estado={datos?.estado} unidades={datos?.unidades} />
    </LangContext.Provider>
  );
}
