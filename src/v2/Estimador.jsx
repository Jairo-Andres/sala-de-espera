import { useId, useMemo, useState } from 'react';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Fecha de solicitud + días del promedio elegido. Es una referencia, no una promesa. */
export function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d + Math.round(dias));
}

/** "Si pidieras la cita hoy": opciones = [{ etiqueta, valor (días) }] con valor no nulo. */
export default function Estimador({ opciones, t, lang }) {
  const idSel = useId();
  const idFecha = useId();
  const [sel, setSel] = useState(0);
  const [fecha, setFecha] = useState(hoy);
  const op = opciones[Math.min(sel, opciones.length - 1)];
  const resultado = useMemo(() => (op && fecha ? sumarDias(fecha, op.valor) : null), [op, fecha]);
  if (!opciones.length) return null;
  const dias = Math.round(op.valor);
  return (
    <section className="v-block v-alt" id="estimador" aria-labelledby="estimador-titulo">
      <div className="v-wrap">
      <div className="v-sh">
        <span className="v-eyebrow">{t.estKicker}</span>
        <h2 id="estimador-titulo">{t.estTitulo}</h2>
        <p>{t.estTexto}</p>
      </div>
      <div className="v-est">
        <div className="v-f">
          <label htmlFor={idSel}>{t.estDato}</label>
          <select id={idSel} value={sel} onChange={(e) => setSel(Number(e.target.value))}>
            {opciones.map((o, k) => <option key={o.etiqueta} value={k}>{o.etiqueta}</option>)}
          </select>
        </div>
        <div className="v-f">
          <label htmlFor={idFecha}>{t.estFecha}</label>
          <input id={idFecha} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <output className="v-estout" aria-live="polite" htmlFor={`${idSel} ${idFecha}`}>
          {resultado ? (
            <>
              <span className="v-eyebrow">{t.estHacia}</span>
              <b>{resultado.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
              <span className="v-fine">{t.estDetalle(dias, op.valorTexto)}</span>
            </>
          ) : <span>{t.estSinFecha}</span>}
        </output>
      </div>
      </div>
    </section>
  );
}
