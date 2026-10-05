import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { useReducedMotion } from '../lib/hooks.js';
import { formatoDias, formatoPeriodo } from '../lib/datos.js';

const INTERVALO = 6000;

/** Un dígito que cambia girando, como un tablero de aeropuerto. Con reduced motion cambia sin animar. */
function Paleta({ valor, retraso, reduce }) {
  const [frente, setFrente] = useState(valor);
  const [atras, setAtras] = useState(valor);
  const [girando, setGirando] = useState(false);
  useEffect(() => {
    if (valor === frente) return undefined;
    if (reduce) { setFrente(valor); setAtras(valor); return undefined; }
    const t1 = setTimeout(() => { setAtras(valor); setGirando(true); }, retraso);
    const t2 = setTimeout(() => { setFrente(valor); setGirando(false); }, retraso + 460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={`paleta ${girando ? 'paleta--gira' : ''}`} aria-hidden="true">
      <span className="paleta__carta">
        <span className="paleta__cara">{frente}</span>
        <span className="paleta__cara paleta__cara--atras">{atras}</span>
      </span>
    </span>
  );
}

export default function Turnero({ turnos, i, setI, unidades }) {
  const { t, lang, esp } = useLang();
  const reduce = useReducedMotion();
  const [pausado, setPausado] = useState(false);
  const [interactuando, setInteractuando] = useState(false);
  const panel = useRef(null);
  const auto = !reduce && !pausado && !interactuando;

  useEffect(() => {
    if (!auto || turnos.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % turnos.length), INTERVALO);
    return () => clearInterval(id);
  }, [auto, turnos.length, setI]);

  // Inclinación 3D que sigue al puntero (solo mouse o lápiz; en táctil queda quieto).
  const mover = (e) => {
    if (reduce || e.pointerType === 'touch' || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    panel.current.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
    panel.current.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    panel.current.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    panel.current.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const soltar = () => {
    if (!panel.current) return;
    for (const p of ['--ry', '--rx', '--gx', '--gy']) panel.current.style.removeProperty(p);
  };

  if (!turnos.length) return null;
  const turno = turnos[i];
  const u = unidades.get(turno.hospital);
  const dias = turno.dias_espera;
  const numero = String(turno.numero).padStart(3, '0');
  const ir = (d) => setI((x) => (x + d + turnos.length) % turnos.length);

  return (
    <div className="escena" onPointerMove={mover} onPointerLeave={soltar}>
      <section
        ref={panel}
        className="turnero p-5 sm:p-7"
        aria-roledescription={t.turneroLabel}
        aria-label={t.turneroLabel}
        onMouseEnter={() => setInteractuando(true)}
        onMouseLeave={() => setInteractuando(false)}
        onFocus={() => setInteractuando(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInteractuando(false); }}
      >
        <div className="capa capa--1 flex items-center justify-between gap-3 border-b border-[#2D3137] pb-3">
          <p className="ja-label !text-[#A2A9B1]">{t.turneroLabel}</p>
          <p className="font-mono text-xs turnero__muted">{t.turnoDe(i + 1, turnos.length)}</p>
        </div>

        <div aria-live={auto ? 'off' : 'polite'} aria-atomic="true">
          <div className="capa capa--3 mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
            <p>
              <span className="block font-mono text-sm uppercase tracking-label turnero__muted">{t.turno}</span>
              <span className="sr-only">{numero}</span>
              <span className="mt-1 flex gap-1.5">
                {numero.split('').map((dg, k) => <Paleta key={k} valor={dg} retraso={k * 90} reduce={reduce} />)}
              </span>
            </p>
            <p key={`e${turno.numero}`} className="turnero__entra min-w-0 flex-1 pb-1">
              <span className="block font-display text-xl font-black leading-tight [overflow-wrap:anywhere] [hyphens:auto] sm:text-2xl">{esp(turno.especialidad)}</span>
              <span className="mt-1 block text-sm turnero__muted">
                {u?.corto ?? turno.hospital} · {t.tipo[turno.tipo]}
              </span>
            </p>
          </div>

          <div key={`d${turno.numero}`} className="capa capa--2 turnero__entra mt-6 flex items-baseline gap-3 rounded-md bg-[#1A1D21] px-4 py-3">
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

        <div className="capa capa--1 mt-5 flex flex-wrap gap-2">
          <button type="button" className="ja-btn turnero__btn" onClick={() => ir(-1)} aria-label={t.anterior}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className="ja-btn turnero__btn turnero__btn--solido flex-1 sm:flex-none" onClick={() => ir(1)}>
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
    </div>
  );
}
