import { useId } from 'react';

/** Select con etiqueta visible y objetivo táctil de 44 px. */
export default function Campo({ etiqueta, value, onChange, opciones, className = '' }) {
  const id = useId();
  return (
    <div className={`grid min-w-0 gap-1 ${className}`}>
      <label htmlFor={id} className="ja-label">{etiqueta}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-tap w-full min-w-0 rounded-md border-2 border-borde-fuerte bg-fondo px-3 text-base text-texto"
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
