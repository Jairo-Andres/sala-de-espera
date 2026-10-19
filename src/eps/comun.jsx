import { useMemo } from 'react';
import { formatoDias, formatoEntero } from '../lib/datos.js';
import { frenteAReferencia, motivosSinDato } from './datos.js';
import { BANDERA, EPS, ESPECIALIDAD, mesLargo, T } from './textos.js';

export const COLOR = {
  'sura|': 'var(--c-sura)',
  'nueva_eps|contributivo': 'var(--c-contrib)',
  'nueva_eps|subsidiado': 'var(--c-subs)',
  'salud_total|contributivo': 'var(--c-st-contrib)',
  'salud_total|subsidiado': 'var(--c-st-subs)',
};
export const grupo = (eps, regimen) => `${eps}|${regimen ?? ''}`;
export const ASTERISCO = ['ginecologia', 'cirugia_general'];
export const irA = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function useTextos(lang) {
  return useMemo(() => ({ t: T[lang], b: BANDERA[lang], esp: ESPECIALIDAD[lang], lang }), [lang]);
}

export function nombreGrupo(t, eps, regimen) {
  return regimen ? `${EPS[eps]} · ${t.regimenCorto[regimen]}` : EPS[eps];
}

export function Motivos({ punto, tx }) {
  const m = motivosSinDato(punto);
  if (!m.length) return null;
  return <span>{tx.t.sinDatoPor}: {m.map((f) => tx.b[f.code] ?? f.code).join('; ')}</span>;
}

/** "Nueva EPS: agosto de 2026; Salud Total y EPS Sura: septiembre de 2026" (sin repetir regímenes ni meses). */
export function resumenMeses(items, t, lang) {
  const porMes = new Map();
  for (const x of items) {
    if (!porMes.has(x.ym)) porMes.set(x.ym, []);
    const nombre = EPS[x.eps];
    if (!porMes.get(x.ym).includes(nombre)) porMes.get(x.ym).push(nombre);
  }
  const y = lang === 'es' ? ' y ' : ' and ';
  return [...porMes.entries()].sort().map(([ym, n]) => `${n.length > 1 ? `${n.slice(0, -1).join(', ')}${y}${n.at(-1)}` : n[0]}: ${mesLargo(ym, lang)}`).join('; ');
}

export const textoReferencia = (t, valor, especialidad) => (valor != null
  ? `${t.referencia(valor)}${ASTERISCO.includes(especialidad) ? '*' : ''}`
  : t.sinReferencia);

/** Turnos del archivo de datos -> formato del turnero v2. */
export function vistaTurnos(turnos, tx) {
  const { t, lang, esp } = tx;
  return turnos.map((x) => {
    const pos = frenteAReferencia(x.req, x.standard);
    let chip;
    if (x.standard == null) chip = <span className="v-chip v-chip--neutral">{t.sinReferencia}</span>;
    else if (pos == null) chip = <span className="v-chip v-chip--neutral">{textoReferencia(t, x.standard, x.specialty)}</span>;
    else chip = <span className={`v-chip ${pos === 'dentro' ? 'v-chip--good' : 'v-chip--bad'}`}>{t.frenteRef(t.frente[pos], x.standard)}</span>;
    return {
      titulo: esp[x.specialty],
      quien: `${EPS[x.eps]} · ${t.regimen[x.regimen]}`,
      valor: x.req == null ? null : formatoDias(x.req, lang),
      unidad: x.req === 1 ? t.dia : t.dias,
      periodo: mesLargo(x.ym, lang),
      nota: (
        <>
          <span>{x.req == null ? <Motivos punto={x} tx={tx} /> : <>{t.desdeSolicitud}{x.n ? ` · ${t.citas(formatoEntero(Math.round(x.n), lang))}` : ''}</>}</span>
          <span>{x.des != null ? `${t.desdeDeseada}: ${formatoDias(x.des, lang)} ${t.dias}` : t.deseadaNoConfiable}</span>
        </>
      ),
      chip,
      fuente: { url: x.src.split(' | ')[0], texto: t.verFuente, sr: `${EPS[x.eps]}, ${mesLargo(x.ym, lang)}` },
    };
  });
}
