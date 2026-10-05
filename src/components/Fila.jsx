import { useId, useMemo, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { useEnVista, useReducedMotion } from '../lib/hooks.js';
import { coberturaEspecialidades, formatoDias, formatoPeriodo, ultimoPorUnidad } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';

const MAX_SILLAS = 60;
const SALA = 30; // sillas mínimas por fila: la sala se ve aunque la espera sea corta

function Silla({ llena, retraso }) {
  return (
    <svg viewBox="0 0 16 18" className="h-[18px] w-4 md:h-6 md:w-5" aria-hidden="true">
      <path
        className="silla"
        style={{ transitionDelay: `${retraso}ms` }}
        d="M3 1.5h10v8H3z M2 10h12v2.5H2z M3 12.5v4.5 M13 12.5v4.5"
        fill={llena ? 'var(--ink-d)' : 'none'}
        stroke={llena ? 'var(--ink-d)' : 'var(--color-border-strong)'}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Fila({ registros, unidades }) {
  const { t, lang, esp } = useLang();
  const reduce = useReducedMotion();
  const idSel = useId();
  const opciones = useMemo(
    () => coberturaEspecialidades(registros).filter((o) => o.especialidad !== 'Todas las especialidades'),
    [registros],
  );
  const [especialidad, setEspecialidad] = useState(opciones[0]?.especialidad);
  const filas = useMemo(() => ultimoPorUnidad(registros, especialidad), [registros, especialidad]);
  const [ref, visto] = useEnVista({ threshold: 0.15 });
  const animar = !reduce;
  const encendidas = !animar || visto;
  const tope = Math.min(MAX_SILLAS, Math.max(SALA, ...filas.map((f) => Math.round(f.dias_espera))));

  return (
    <Capitulo id="capitulo-3" kicker={t.c3Kicker} titulo={t.c3Titulo} texto={t.c3Texto}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1">
          <label htmlFor={idSel} className="ja-label">{t.especialidad}</label>
          <select
            id={idSel}
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            className="min-h-tap rounded-md border-2 border-borde-fuerte bg-fondo px-3 text-base text-texto"
          >
            {opciones.map((o) => (
              <option key={o.especialidad} value={o.especialidad}>
                {esp(o.especialidad)} ({o.unidades})
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2 text-sm text-texto-suave">{t.unidadesPublican(filas.length)} · {t.sillaLeyenda}</p>
      </div>

      <ol ref={ref} className="mt-6 grid gap-5">
        {filas.map((f) => {
          const u = unidades.get(f.hospital);
          const n = Math.round(f.dias_espera);
          const visibles = Math.min(n, MAX_SILLAS);
          return (
            <li key={f.hospital} className="grid gap-2 border-t border-borde pt-4 md:grid-cols-[14rem_1fr] md:gap-6">
              <div>
                <p className="font-bold">{u?.corto ?? f.hospital}</p>
                <p className="font-mono text-sm text-texto-suave">
                  <span className="font-bold text-texto">{formatoDias(f.dias_espera, lang)} {t.dias}</span> · {formatoPeriodo(f.periodo, f.granularidad, lang)}
                </p>
                {u?.estadoDefinicion === 'asumida' && <p className="text-xs text-texto-suave">△ {t.asumidaMarca}</p>}
              </div>
              <div className="flex flex-wrap content-start gap-x-1 gap-y-1.5">
                {Array.from({ length: tope }, (_, i) => (
                  <Silla key={i} llena={encendidas && i < visibles} retraso={animar ? i * 25 : 0} />
                ))}
                {n > MAX_SILLAS && <span className="ml-1 font-mono text-xs text-texto-suave">{t.masSillas(n - MAX_SILLAS)}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </Capitulo>
  );
}
