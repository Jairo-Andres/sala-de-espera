import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { useReducedMotion } from '../lib/hooks.js';
import { construirTurnos, formatoDias, formatoPeriodo } from '../lib/datos.js';

const INTERVALO = 6000;

export default function Turnero({ registros, unidades }) {
  const { t, lang, esp } = useLang();
  const reduce = useReducedMotion();
  const turnos = useMemo(() => construirTurnos(registros), [registros]);
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [interactuando, setInteractuando] = useState(false);
  const auto = !reduce && !pausado && !interactuando;

  useEffect(() => {
    if (!auto || turnos.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % turnos.length), INTERVALO);
    return () => clearInterval(id);
  }, [auto, turnos.length]);

  if (!turnos.length) return null;
  const turno = turnos[i];
  const u = unidades.get(turno.hospital);
  const dias = turno.dias_espera;
  const ir = (d) => setI((x) => (x + d + turnos.length) % turnos.length);

  return (
    <section
      className="turnero p-5 sm:p-7"
      aria-roledescription={t.turneroLabel}
      aria-label={t.turneroLabel}
      onMouseEnter={() => setInteractuando(true)}
      onMouseLeave={() => setInteractuando(false)}
      onFocus={() => setInteractuando(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInteractuando(false); }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#2D3137] pb-3">
        <p className="ja-label !text-[#A2A9B1]">{t.turneroLabel}</p>
        <p className="font-mono text-xs turnero__muted">{t.turnoDe(i + 1, turnos.length)}</p>
      </div>

      <div key={turno.numero} className={auto ? 'turnero__entra' : undefined} aria-live={auto ? 'off' : 'polite'} aria-atomic="true">
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <p>
            <span className="block font-mono text-sm uppercase tracking-label turnero__muted">{t.turno}</span>
            <span className="turnero__digito block text-[3.5rem] sm:text-[4.5rem]">{String(turno.numero).padStart(3, '0')}</span>
          </p>
          <p className="min-w-0 flex-1 pb-1">
            <span className="block font-display text-xl font-black leading-tight sm:text-2xl">{esp(turno.especialidad)}</span>
            <span className="mt-1 block text-sm turnero__muted">
              {u?.corto ?? turno.hospital} · {t.tipo[turno.tipo]}
            </span>
          </p>
        </div>

        <div className="mt-6 flex items-baseline gap-3 rounded-md bg-[#1A1D21] px-4 py-3">
          <span className="turnero__digito text-[2.75rem] sm:text-[3.25rem]">{formatoDias(dias, lang)}</span>
          <span className="font-display text-lg font-black">{dias === 1 ? t.dia : t.dias}</span>
          <span className="ml-auto text-right font-mono text-xs turnero__muted">
            {t.promedioDe}<br />{formatoPeriodo(turno.periodo, turno.granularidad, lang)}
          </span>
        </div>

        <p className="mt-3 text-sm turnero__muted">
          {u?.nombre ?? turno.hospital}
          {u?.fuente_url && (<> · <a href={u.fuente_url} target="_blank" rel="noreferrer">{t.verFuente}<span className="sr-only"> ({u.corto})</span></a></>)}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="ja-btn turnero__btn" onClick={() => ir(-1)} aria-label={t.anterior}>
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" className="ja-btn turnero__btn flex-1 sm:flex-none" onClick={() => ir(1)}>
          <span className="sm:hidden">{t.siguienteCorto}</span><span className="hidden sm:inline">{t.siguiente}</span> <span aria-hidden="true">→</span>
        </button>
        {!reduce && (
          <button type="button" className="ja-btn turnero__btn" onClick={() => setPausado((p) => !p)}>
            {pausado ? t.reanudar : t.pausar}
          </button>
        )}
      </div>
      <p className="mt-4 text-xs turnero__muted">{t.turneroNota}</p>
    </section>
  );
}
