import { useMemo } from 'react';
import { useLang } from '../lib/i18n.js';
import Capitulo from './Capitulo.jsx';

const MESES_POR = { mes: 1, trimestre: 3, semestre: 6 };

/**
 * Reloj de un año: 12 marcas, una por mes. La cuña rellena es lo que abarca un solo
 * dato publicado (1, 3 o 6 meses). Mientras más grande, más se suavizan los picos.
 */
function RelojAnual({ meses, titulo }) {
  const r = 26;
  const ang = (meses / 12) * Math.PI * 2;
  const x = 32 + r * Math.sin(ang);
  const y = 32 - r * Math.cos(ang);
  const grande = meses > 6 ? 1 : 0;
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" role="img" aria-label={titulo} className="shrink-0">
      <circle cx="32" cy="32" r="30" fill="var(--color-bg)" stroke="var(--color-border-strong)" strokeWidth="2" />
      <path d={`M32 32 L32 ${32 - r} A${r} ${r} 0 ${grande} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="var(--ink-d)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={32 + 27 * Math.sin(a)} y1={32 - 27 * Math.cos(a)} x2={32 + 30 * Math.sin(a)} y2={32 - 30 * Math.cos(a)} stroke="var(--color-fg)" strokeWidth={i % 3 === 0 ? 2 : 1} />;
      })}
      <circle cx="32" cy="32" r="2.5" fill="var(--color-fg)" />
    </svg>
  );
}

export default function Relojes({ registros, unidades }) {
  const { t, lang } = useLang();
  const grupos = useMemo(() => {
    const m = new Map();
    for (const r of registros) {
      if (!m.has(r.hospital)) m.set(r.hospital, { gran: new Set(), def: new Set(), citas: false });
      const f = m.get(r.hospital);
      f.gran.add(r.granularidad);
      f.def.add(r.definicion);
      if (r.citas != null) f.citas = true;
    }
    const orden = ['mes', 'trimestre', 'semestre'];
    // Unidades con exactamente la misma forma de medir se muestran juntas (p. ej. las 4 subredes de Bogotá).
    const g = new Map();
    for (const [nombre, f] of m) {
      const u = unidades.get(nombre) ?? { nombre, corto: nombre };
      const gran = orden.filter((x) => f.gran.has(x));
      const def = [...f.def].sort();
      const k = [u.tipo, gran, def, u.estadoDefinicion, f.citas].join('|');
      if (!g.has(k)) g.set(k, { us: [], gran, def, citas: f.citas, estado: u.estadoDefinicion, tipo: u.tipo });
      g.get(k).us.push(u);
    }
    return [...g.values()]
      .map((x) => ({ ...x, us: x.us.sort((a, b) => a.corto.localeCompare(b.corto, 'es')) }))
      .sort((a, b) => MESES_POR[a.gran[0]] - MESES_POR[b.gran[0]] || a.us[0].corto.localeCompare(b.us[0].corto, 'es'));
  }, [registros, unidades]);

  const nombreGrupo = (us) => {
    if (us.length === 1) return us[0].corto;
    const mun = us[0].municipio;
    if (us.every((u) => u.municipio === mun)) return `${mun}: ${us.map((u) => u.corto.replace(`${mun} `, '')).join(', ')}`;
    return us.map((u) => u.corto).join(', ');
  };
  const tipoGrupo = (tipo, n) => {
    const base = t.tipo[tipo] ?? '';
    if (n === 1) return base;
    return lang === 'es' ? `${n} ${base.toLowerCase()}es` : `${n} ${base.toLowerCase()}s`;
  };

  const tituloReloj = (g) => (lang === 'es'
    ? `Un dato abarca ${MESES_POR[g]} ${MESES_POR[g] === 1 ? 'mes' : 'meses'} del año`
    : `One value covers ${MESES_POR[g]} ${MESES_POR[g] === 1 ? 'month' : 'months'} of the year`);

  return (
    <Capitulo id="capitulo-2" kicker={t.c2Kicker} titulo={t.c2Titulo} texto={t.c2Texto} className="bg-superficie">
      <ul className="grid gap-3 md:grid-cols-2">
        {grupos.map(({ us, gran, def, citas, estado, tipo }) => (
          <li key={us[0].nombre} className="ja-card ja-card--raised !grid-cols-[auto_minmax(0,1fr)] items-start !gap-4">
            <RelojAnual meses={MESES_POR[gran[0]]} titulo={tituloReloj(gran[0])} />
            <div className="min-w-0">
              <p className="font-display text-lg font-black leading-tight">{nombreGrupo(us)}</p>
              <p className="text-sm text-texto-suave">{tipoGrupo(tipo, us.length)}</p>
              <dl className="mt-3 grid gap-x-3 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="ja-label">{t.colPeriodo}</dt>
                <dd>{gran.map((g) => t.gran[g]).join(' + ')}</dd>
                <dt className="ja-label">{t.colDefinicion}</dt>
                <dd>
                  {def.map((d) => t.def[d]).join(' + ')}
                  <span className="text-texto-suave"> ({t.estadoDef[estado ?? 'asumida']})</span>
                </dd>
                <dt className="ja-label">{t.colCitas}</dt>
                <dd>{citas ? t.si : t.no}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </Capitulo>
  );
}
