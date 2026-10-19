import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoDias, formatoPeriodo, frenteANorma, mayorAumento, mayorBrecha } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';

const sinEse = (n) => n.replace(/^E\.S\.E\.\s*/, '');

function Tarjeta({ grande, etiqueta, children, viz, pie }) {
  return (
    <li className="v-card v-stat">
      <b>{grande}</b>
      <span className="v-k">{etiqueta}</span>
      <div className="grid gap-2">{children}</div>
      {viz && <div className="v-mini">{viz}</div>}
      {pie && <p className="v-fine">{pie}</p>}
    </li>
  );
}

function Barras({ filas }) {
  const max = Math.max(...filas.map((f) => f.v), 0.0001);
  return filas.map((f) => (
    <div key={f.k} className="v-r" aria-hidden="true">
      <span>{f.k}</span>
      <div className="v-trk"><i style={{ width: `${Math.max(2, (f.v / max) * 100)}%` }} /></div>
      <em>{f.t}</em>
    </div>
  ));
}

export default function Hallazgos({ registros, unidades }) {
  const { t, lang, esp } = useLang();
  const brecha = useMemo(() => mayorBrecha(registros), [registros]);
  const aumento = useMemo(() => mayorAumento(registros), [registros]);
  const norma = useMemo(() => frenteANorma(registros), [registros]);
  const n = new Set(registros.map((r) => r.hospital)).size;
  const nombre = (h) => {
    const u = unidades.get(h);
    const base = sinEse(u?.nombre ?? h);
    if (lang !== 'es') return base;
    return `${u?.tipo === 'hospital' ? 'el' : 'la'} ${base}`;
  };
  const corto = (h) => unidades.get(h)?.corto ?? h;
  const d = (v) => formatoDias(v, lang);
  const minus = (e) => esp(e).toLowerCase();
  const encima = norma.registros.filter((r) => r.dias_espera > 3);

  return (
    <Capitulo id="hallazgos" kicker={t.hKicker} titulo={t.hTitulo} texto={t.hTexto}>
      <ul className="v-g4">
        {brecha && (
          <Tarjeta
            grande={`${Math.round(brecha.razon)}×`}
            etiqueta={t.hBrechaEtiqueta}
            pie={t.hMetodo}
            viz={<Barras filas={[{ k: esp(brecha.alta.especialidad), v: brecha.alta.valor, t: d(brecha.alta.valor) }, { k: esp(brecha.baja.especialidad), v: brecha.baja.valor, t: d(brecha.baja.valor) }]} />}
          >
            <p>{t.hBrecha(nombre(brecha.hospital), brecha.anio, minus(brecha.alta.especialidad), d(brecha.alta.valor), minus(brecha.baja.especialidad), d(brecha.baja.valor))}</p>
          </Tarjeta>
        )}
        {aumento && (
          <Tarjeta
            grande={`+${d(aumento.delta)}`}
            etiqueta={t.hAumentoEtiqueta}
            pie={t.hMetodo}
            viz={<Barras filas={[{ k: String(aumento.ini.anio), v: aumento.ini.valor, t: d(aumento.ini.valor) }, { k: String(aumento.fin.anio), v: aumento.fin.valor, t: d(aumento.fin.valor) }]} />}
          >
            <p>{t.hAumento(nombre(aumento.hospital), minus(aumento.especialidad), d(aumento.ini.valor), aumento.ini.anio, d(aumento.fin.valor), aumento.fin.anio)}</p>
          </Tarjeta>
        )}
        {norma.total > 0 && (
          <Tarjeta
            grande={`${norma.debajo}/${norma.total}`}
            etiqueta={t.hNormaEtiqueta}
            pie={t.hNormaNota}
            viz={(
              <div className="v-dots" role="img" aria-label={`${norma.debajo}/${norma.total} ${t.hNormaEtiqueta}`}>
                {[...norma.registros].sort((a, b) => a.dias_espera - b.dias_espera).map((r) => <i key={`${r.hospital}${r.especialidad}`} className={r.dias_espera <= 3 ? 'v-g' : 'v-b'} />)}
              </div>
            )}
          >
            <p>{t.hNorma}</p>
            {encima.length > 0 && (
              <p className="font-bold">
                {t.hNormaEncima(encima.map((r) => `${corto(r.hospital)}, ${minus(r.especialidad)} (${d(r.dias_espera)} ${t.dias}, ${formatoPeriodo(r.periodo, r.granularidad, lang)})`).join('; '))}
              </p>
            )}
          </Tarjeta>
        )}
        <Tarjeta grande={n} etiqueta={t.hVacioEtiqueta} viz={<div className="v-dots" role="img" aria-label={`${n}`}>{Array.from({ length: n }, (_, k) => <i key={k} />)}</div>}>
          <p>{t.hVacio}</p>
        </Tarjeta>
      </ul>
      <button type="button" className="v-btn mt-6" onClick={() => document.getElementById('explorar')?.scrollIntoView({ behavior: 'instant', block: 'start' })}>{t.verGraficos} <span aria-hidden="true">↓</span></button>
    </Capitulo>
  );
}
