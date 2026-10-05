import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import { formatoDias, formatoPeriodo, frenteANorma, mayorAumento, mayorBrecha } from '../lib/datos.js';
import Capitulo from './Capitulo.jsx';

const sinEse = (n) => n.replace(/^E\.S\.E\.\s*/, '');

function Tarjeta({ grande, etiqueta, children }) {
  return (
    <li className="ja-card ja-card--raised !gap-2 border-t-ruta border-t-ruta-d">
      <p className="font-display text-4xl font-black leading-none ja-num">{grande}</p>
      <p className="ja-label !text-texto">{etiqueta}</p>
      <div className="grid gap-2 text-base">{children}</div>
    </li>
  );
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
      <ul className="grid gap-4 md:grid-cols-2">
        {brecha && (
          <Tarjeta grande={`${Math.round(brecha.razon)}×`} etiqueta={t.hBrechaEtiqueta}>
            <p>{t.hBrecha(nombre(brecha.hospital), brecha.anio, minus(brecha.alta.especialidad), d(brecha.alta.valor), minus(brecha.baja.especialidad), d(brecha.baja.valor))}</p>
            <p className="text-sm text-texto-suave">{t.hMetodo}</p>
          </Tarjeta>
        )}
        {aumento && (
          <Tarjeta grande={`+${d(aumento.delta)}`} etiqueta={t.hAumentoEtiqueta}>
            <p>{t.hAumento(nombre(aumento.hospital), minus(aumento.especialidad), d(aumento.ini.valor), aumento.ini.anio, d(aumento.fin.valor), aumento.fin.anio)}</p>
            <p className="text-sm text-texto-suave">{t.hMetodo}</p>
          </Tarjeta>
        )}
        {norma.total > 0 && (
          <Tarjeta grande={`${norma.debajo}/${norma.total}`} etiqueta={t.hNormaEtiqueta}>
            <p>{t.hNorma}</p>
            {encima.length > 0 && (
              <p className="font-bold">
                {t.hNormaEncima(encima.map((r) => `${corto(r.hospital)}, ${minus(r.especialidad)} (${d(r.dias_espera)} ${t.dias}, ${formatoPeriodo(r.periodo, r.granularidad, lang)})`).join('; '))}
              </p>
            )}
            <p className="text-sm text-texto-suave">{t.hNormaNota}</p>
          </Tarjeta>
        )}
        <Tarjeta grande={n} etiqueta={t.hVacioEtiqueta}>
          <p>{t.hVacio}</p>
        </Tarjeta>
      </ul>
      <a href="#explorar" className="ja-btn ja-btn--secondary mt-6">{t.verGraficos} <span aria-hidden="true">↓</span></a>
    </Capitulo>
  );
}
