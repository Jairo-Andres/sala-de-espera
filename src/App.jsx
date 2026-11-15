import { useCallback, useEffect, useMemo, useState } from 'react';
import { cargarTodo } from './lib/api.js';
import { LangContext, traductor } from './lib/i18n.js';
import { construirTurnos, indexarUnidades } from './lib/datos.js';
import Cabecera from './components/Cabecera.jsx';
import PortadaHosp from './v2/PortadaHosp.jsx';
import Hallazgos from './components/Hallazgos.jsx';
import Unidades from './components/Unidades.jsx';
import Relojes from './components/Relojes.jsx';
import Fila from './components/Fila.jsx';
import Explorar from './components/Explorar.jsx';
import Clicsalud from './components/Clicsalud.jsx';
import Pie from './components/Pie.jsx';
import SalaEps from './eps/SalaEps.jsx';
import Periodo from './relevancia/Periodo.jsx';
import AvisoEtl from './relevancia/AvisoEtl.jsx';
import Ranking from './relevancia/Ranking.jsx';
import { PERIODOS, PERIODO_DEFECTO, desdeDe } from './relevancia/datos.js';

function periodoInicial() {
  try {
    const g = localStorage.getItem('sala-periodo');
    if (PERIODOS.some((p) => p.id === g)) return g;
  } catch { /* almacenamiento bloqueado */ }
  return PERIODO_DEFECTO;
}

const salaDeHash = () => (window.location.hash.startsWith('#eps') ? 'eps' : 'hospitales');

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
  const [sala, setSala] = useState(salaDeHash);
  useEffect(() => {
    const on = () => {
      const nueva = salaDeHash();
      setSala((antes) => {
        if (antes !== nueva) window.scrollTo(0, 0);
        return nueva;
      });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [etapa, setEtapa] = useState(0);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);
  const [intento, setIntento] = useState(0);
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [recargando, setRecargando] = useState(false);
  const desde = desdeDe(periodo);
  const cambiarPeriodo = useCallback((id) => {
    setPeriodo(id);
    try { localStorage.setItem('sala-periodo', id); } catch { /* sin almacenamiento */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = sala === 'eps'
      ? (lang === 'es' ? 'La sala de las EPS · La sala de espera' : 'The insurers’ waiting room · The waiting room')
      : (lang === 'es' ? 'La sala de espera · Oportunidad de citas en Colombia' : 'The waiting room · Medical appointment waits in Colombia');
    try { localStorage.setItem('sala-lang', lang); } catch { /* sin almacenamiento */ }
  }, [lang, sala]);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    setEtapa(0);
    setRecargando(true);
    // Al cambiar de periodo se conservan los datos anteriores hasta que lleguen los nuevos.
    cargarTodo(setEtapa, ctrl.signal, desde)
      .then((d) => setDatos({ ...d, unidades: indexarUnidades(d.hospitales) }))
      .catch((e) => { if (!ctrl.signal.aborted) setError(e); })
      .finally(() => { if (!ctrl.signal.aborted) setRecargando(false); });
    return () => ctrl.abort();
  }, [intento, desde]);

  const turnos = useMemo(() => (datos ? construirTurnos(datos.registros) : []), [datos]);
  const [iTurno, setITurno] = useState(0);

  const reintentar = useCallback(() => setIntento((i) => i + 1), []);
  const ctx = useMemo(() => traductor(lang), [lang]);
  const t = ctx.t;

  return (
    <LangContext.Provider value={ctx}>
      <a href="#contenido" className="v-btn v-btn--primary sr-only-focusable fixed left-4 top-4 z-[80]" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>{t.saltar}</a>
      <Cabecera sala={sala} onIdioma={() => setLang(lang === 'es' ? 'en' : 'es')} />
      {sala === 'eps' ? (
        <main id="contenido" tabIndex={-1}><SalaEps lang={lang} /></main>
      ) : (
      <main id="contenido" tabIndex={-1}>
        <Periodo valor={periodo} onCambio={cambiarPeriodo} cargando={recargando && !!datos} />
        <AvisoEtl estado={datos?.estado} />
        <PortadaHosp datos={datos} turnos={turnos} iTurno={iTurno} setITurno={setITurno} etapa={etapa} error={error} onReintentar={reintentar} desde={desde} />
        {datos && (
          <>
            <Hallazgos registros={datos.registros} unidades={datos.unidades} ranking={datos.ranking} />
            <Ranking ranking={datos.ranking} unidades={datos.unidades} />
            <Unidades registros={datos.registros} unidades={datos.unidades} />
            <Relojes registros={datos.registros} unidades={datos.unidades} />
            <Fila registros={datos.registros} unidades={datos.unidades} />
            <Explorar registros={datos.registros} unidades={datos.unidades} />
            <Clicsalud />
            <section id="antes" className="v-block" aria-label={t.notaTitulo}>
              <div className="v-wrap">
                <details className="v-callout" open>
                  <summary>{t.notaTitulo}</summary>
                  <ul>{t.nota.map((n) => <li key={n}>{n}</li>)}</ul>
                </details>
              </div>
            </section>
          </>
        )}
      </main>
      )}
      {sala === 'eps' ? <Pie /> : <Pie estado={datos?.estado} unidades={datos?.unidades} />}
    </LangContext.Provider>
  );
}
