import { useLang } from '../lib/i18n.js';

export default function Cabecera({ onIdioma }) {
  const { t, lang } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo">
      <div className="mx-auto flex max-w-contenido items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <a href="#titulo" className="flex min-h-tap items-center gap-2 font-display text-md font-black text-texto no-underline">
          <span className="ja-bullet ja-bullet--d" aria-hidden="true">D</span>
          <span>{t.titulo}</span>
        </a>
        <button type="button" className="ja-btn ja-btn--secondary !min-h-tap !px-3 text-sm" onClick={onIdioma} aria-label={t.idiomaAria} lang={lang === 'es' ? 'en' : 'es'}>
          <span aria-hidden="true" className="font-mono text-xs">{lang === 'es' ? 'EN' : 'ES'}</span>
          <span>{t.idioma}</span>
        </button>
      </div>
    </header>
  );
}
