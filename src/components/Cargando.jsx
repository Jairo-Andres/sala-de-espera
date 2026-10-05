import { useLang } from '../lib/i18n.js';

/** Componente "Cargando datos" de la identidad (ja-loading): un tren que avanza por 3 paradas. */
export default function Cargando({ etapa, error, onReintentar }) {
  const { t } = useLang();
  const pct = Math.min(etapa, 3) / 3 * 100;
  if (error) {
    return (
      <div className="ja-loading" role="alert">
        <p className="font-display text-xl font-black">{t.errorTitulo}</p>
        <p className="text-texto-suave">{t.errorTexto}</p>
        <div><button type="button" className="ja-btn ja-btn--primary" onClick={onReintentar}>{t.reintentar}</button></div>
      </div>
    );
  }
  return (
    <div className="ja-loading" role="status" aria-live="polite">
      <p className="font-display text-xl font-black">{t.cargandoTitulo}</p>
      <p className="text-texto-suave">{t.cargandoTexto}</p>
      <div className="ja-loading__track" aria-hidden="true">
        <div className="ja-loading__fill" style={{ width: `${pct}%` }} />
        <div className="ja-loading__train ja-loading__pulse" style={{ left: `${pct}%` }} />
      </div>
      <ol className="ja-loading__stops">
        {t.etapas.map((e, i) => (
          <li key={e} className={i <= etapa ? 'text-texto' : undefined}>
            {i < etapa ? '✓ ' : ''}{e}
          </li>
        ))}
      </ol>
      <div className="grid gap-2" aria-hidden="true">
        <div className="ja-skeleton h-4 w-3/4" />
        <div className="ja-skeleton h-4 w-1/2" />
      </div>
    </div>
  );
}
