import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { useReducedMotion } from '../lib/hooks.js';
import { formatoDias, formatoEntero, formatoPeriodo, rangoPeriodos } from '../lib/datos.js';
import Cargando from '../components/Cargando.jsx';
import { Sala3D } from './Sala3D.jsx';
import TurneroV2 from './TurneroV2.jsx';
import Estimador from './Estimador.jsx';
import { V2 } from './textos.js';

const irA = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Portada v2 de la sala de hospitales: texto, sala 3D, turnero inclinado y franja de cifras. */
export default function PortadaHosp({ datos, turnos, iTurno, setITurno, etapa, error, onReintentar }) {
  const { t, lang, esp } = useLang();
  const v = V2[lang];
  const reduce = useReducedMotion();
  const turno = turnos[iTurno];

  const vista = useMemo(() => turnos.map((r) => {
    const u = datos?.unidades.get(r.hospital);
    return {
      titulo: esp(r.especialidad),
      quien: `${u?.corto ?? r.hospital} · ${t.tipo[r.tipo] ?? ''}`,
      valor: formatoDias(r.dias_espera, lang),
      unidad: r.dias_espera === 1 ? t.dia : t.dias,
      periodo: formatoPeriodo(r.periodo, r.granularidad, lang),
      nota: <span>{u?.nombre ?? r.hospital}</span>,
      chip: u?.estadoDefinicion === 'asumida' ? <span className="v-chip v-chip--warn">△ {t.asumidaMarca}</span> : null,
      fuente: u?.fuente_url ? { url: u.fuente_url, texto: t.verFuente, sr: u.corto } : null,
    };
  }), [turnos, datos, lang, t, esp]);

  const hechos = useMemo(() => {
    if (!datos) return null;
    const [min, max] = rangoPeriodos(datos.registros);
    const deptos = new Set([...datos.unidades.values()].map((u) => u.departamento)).size;
    const unidadesConDatos = new Set(datos.registros.map((r) => r.hospital)).size;
    return [
      [v.hechos.unidades, unidadesConDatos],
      [v.hechos.departamentos, deptos],
      [v.hechos.registros, formatoEntero(datos.registros.length, lang)],
      [v.hechos.anios, `${min.slice(0, 4)}–${max.slice(2, 4)}`],
    ];
  }, [datos, lang, v]);

  const opciones = useMemo(() => turnos.map((r) => ({
    etiqueta: `${esp(r.especialidad)} · ${datos?.unidades.get(r.hospital)?.corto ?? r.hospital} · ${formatoDias(r.dias_espera, lang)} d`,
    valor: r.dias_espera,
    valorTexto: formatoDias(r.dias_espera, lang),
  })), [turnos, datos, lang, esp]);

  const u = turno && datos?.unidades.get(turno.hospital);
  return (
    <>
      <div className="v-wrap">
        <section id="portada" className="v-hero" aria-labelledby="titulo">
          <div>
            <p className="v-eyebrow flex items-center gap-2"><span className="v-bullet" aria-hidden="true">D</span>{t.ruta}</p>
            <h1 id="titulo">{t.titulo}</h1>
            <p className="v-lead">{t.subtitulo}</p>
            <div className="v-ctas">
              {datos && <button type="button" className="v-btn v-btn--primary" onClick={() => irA('hallazgos')}>{v.empezar} <span aria-hidden="true">↓</span></button>}
              <a href="#eps" className="v-btn">{v.irEps}</a>
            </div>
            {turno && (
              <Sala3D
                dias={turno.dias_espera}
                reduce={reduce}
                etiqueta={v.salaEtiqueta}
                leyenda={<>{v.salaLeyenda(formatoDias(turno.dias_espera, lang), esp(turno.especialidad), u?.corto ?? turno.hospital)}{Math.round(turno.dias_espera) > 30 && ` · ${t.masSillas(Math.round(turno.dias_espera) - 30)}`}<br /><span className="opacity-70">{v.girar}</span></>}
              />
            )}
          </div>
          {datos ? (
            <TurneroV2 turnos={vista} i={iTurno} setI={setITurno} t={t} reduce={reduce} etiqueta={t.turneroLabel} notaFinal={t.turneroNota} />
          ) : (
            <Cargando etapa={etapa} error={error} onReintentar={onReintentar} />
          )}
          {hechos && (
            <dl className="v-facts">
              {hechos.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
            </dl>
          )}
        </section>
      </div>
      {datos && <Estimador opciones={opciones} t={v} lang={lang} />}
    </>
  );
}
