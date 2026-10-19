import { useMemo, useState } from 'react';
import { useLang } from '../lib/i18n.js';
import { useReducedMotion } from '../lib/hooks.js';
import { coberturaEspecialidades, formatoDias, formatoPeriodo, ultimoPorUnidad } from '../lib/datos.js';
import { Fila3D } from '../v2/Sala3D.jsx';
import { V2 } from '../v2/textos.js';
import Capitulo from './Capitulo.jsx';
import Campo from './Campo.jsx';

const COLS = 10; // sillas por fila (1 silla = 1 día, redondeado)

function Silla({ llena }) {
  return (
    <svg viewBox="0 0 20 20" className={`v-ch ${llena ? 'v-on' : ''}`} aria-hidden="true">
      <path d="M5 2h10a1.5 1.5 0 0 1 1.5 1.5V11h-13V3.5A1.5 1.5 0 0 1 5 2Z" />
      <rect x="2" y="12" width="16" height="4" rx="1.5" />
      <rect x="4" y="16" width="2" height="3" rx="1" />
      <rect x="14" y="16" width="2" height="3" rx="1" />
    </svg>
  );
}

export default function Fila({ registros, unidades }) {
  const { t, lang, esp } = useLang();
  const v = V2[lang];
  const reduce = useReducedMotion();
  const opciones = useMemo(
    () => coberturaEspecialidades(registros).filter((o) => o.especialidad !== 'Todas las especialidades'),
    [registros],
  );
  const [especialidad, setEspecialidad] = useState(opciones[0]?.especialidad);
  const filas = useMemo(
    () => [...ultimoPorUnidad(registros, especialidad)].sort((a, b) => b.dias_espera - a.dias_espera),
    [registros, especialidad],
  );
  const nombres = filas.map((f) => unidades.get(f.hospital)?.corto ?? f.hospital);
  const valores = useMemo(() => filas.map((f) => Math.min(COLS, f.dias_espera)), [filas]);

  return (
    <Capitulo id="capitulo-3" kicker={t.c3Kicker} titulo={t.c3Titulo} texto={t.c3Texto} alt>
      <div className="flex flex-wrap items-end gap-4">
        <Campo
          etiqueta={t.especialidad}
          value={especialidad}
          onChange={setEspecialidad}
          opciones={opciones.map((o) => ({ value: o.especialidad, label: `${esp(o.especialidad)} (${o.unidades})` }))}
          className="w-full max-w-sm"
        />
        <p className="pb-2 text-sm text-texto-suave">{t.unidadesPublican(filas.length)} · {t.sillaLeyenda}</p>
      </div>
      <Fila3D valores={valores} nombres={nombres} cols={COLS} reduce={reduce} etiqueta={v.filaEtiqueta(esp(especialidad))} leyenda={v.filaLeyenda} />
      <ol className="v-queue mt-5">
        {filas.map((f, k) => {
          const u = unidades.get(f.hospital);
          const n = Math.round(f.dias_espera);
          return (
            <li key={f.hospital} className="v-row">
              <div className="v-nm">{nombres[k]}</div>
              <div className="v-rowchairs" role="img" aria-label={`${formatoDias(f.dias_espera, lang)} ${t.dias}`}>
                {Array.from({ length: COLS }, (_, i) => <Silla key={i} llena={i < n} />)}
              </div>
              <div className="v-v">
                {formatoDias(f.dias_espera, lang)} {t.dias}
                <small>
                  {formatoPeriodo(f.periodo, f.granularidad, lang)}
                  {u?.estadoDefinicion === 'asumida' && ` · △ ${t.asumidaMarca}`}
                  {n > COLS && ` · ${t.masSillas(n - COLS)}`}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="v-fine mt-4">△ {t.asumidaMarca}: {t.estadoDef.asumida}</p>
    </Capitulo>
  );
}
