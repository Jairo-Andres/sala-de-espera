import { useLang } from '../lib/i18n.js';
import { T as TE } from '../eps/textos.js';

export default function Cabecera({ onIdioma, sala = 'hospitales' }) {
  const { t, lang } = useLang();
  const te = TE[lang];
  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo">
      <div className="mx-auto flex max-w-contenido items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <a href={sala === 'eps' ? '#titulo-eps' : '#titulo'} className="flex min-h-tap items-center gap-2 font-display text-md font-black text-texto no-underline">
          <span className="ja-bullet ja-bullet--d" aria-hidden="true">D</span>
          <span className="sr-only sm:not-sr-only">{t.titulo}</span>
        </a>
        <nav aria-label={te.salas} className="flex gap-1">
          <a href="#portada" aria-current={sala === 'hospitales' ? 'page' : undefined} className={`ja-btn !min-h-tap !px-3 text-sm no-underline ${sala === 'hospitales' ? 'ja-btn--primary' : 'ja-btn--secondary'}`}>{te.pestanaHospitales}</a>
          <a href="#eps" aria-current={sala === 'eps' ? 'page' : undefined} className={`ja-btn !min-h-tap !px-3 text-sm no-underline ${sala === 'eps' ? 'ja-btn--primary' : 'ja-btn--secondary'}`}>{te.pestanaEps}</a>
        </nav>
        <button type="button" className="ja-btn ja-btn--secondary !min-h-tap !px-3 text-sm" onClick={onIdioma} aria-label={t.idiomaAria} lang={lang === 'es' ? 'en' : 'es'}>
          <span aria-hidden="true" className="font-mono text-xs">{lang === 'es' ? 'EN' : 'ES'}</span>
          <span className="hidden sm:inline">{t.idioma}</span>
        </button>
      </div>
    </header>
  );
}
