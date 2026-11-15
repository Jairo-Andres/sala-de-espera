// Cliente de la API de datos abiertos. Render (plan gratis) duerme el servicio tras
// ~15 min sin uso, así que la primera petición puede tardar hasta un minuto.

import { TIPOS_PROPIOS } from '../relevancia/datos.js';

export const API_URL = (import.meta.env.VITE_API_URL || 'https://datos-abiertos-citas-api.onrender.com').replace(/\/$/, '');

export async function getJson(path, { timeout = 70000, signal } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Trae todas las páginas de /oportunidad (máximo 1000 por página). */
export async function oportunidadCompleta(params, opts) {
  const items = [];
  let offset = 0;
  for (;;) {
    const q = new URLSearchParams({ ...params, limit: 1000, offset });
    const page = await getJson(`/oportunidad?${q}`, opts);
    items.push(...page.items);
    offset += page.limit;
    if (offset >= page.total || page.items.length === 0) return items;
  }
}

/** Arma una ruta con parámetros, omitiendo los vacíos. */
export function ruta(base, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') q.set(k, v);
  const txt = q.toString();
  return txt ? `${base}?${txt}` : base;
}

export const resumen = (params, opts) => getJson(ruta('/resumen', params), opts);
export const ranking = (params, opts) => getJson(ruta('/ranking', params), opts);

/**
 * Carga inicial en etapas para el componente "Cargando datos":
 * 0 despertar el servidor, 1 unidades, 2 registros de espera y ranking.
 * Solo baja los registros del periodo elegido (desde_anio) y en una sola serie de páginas
 * (tipo=hospital,red,subred); lo que se puede agregar en la API viene de /resumen y /ranking.
 */
export async function cargarTodo(onEtapa, signal, desde = null) {
  onEtapa(0);
  let estado = null;
  for (let intento = 0; ; intento++) {
    try {
      estado = await getJson('/estado', { signal, timeout: 75000 });
      break;
    } catch (e) {
      if (signal?.aborted || intento >= 1) throw e;
    }
  }
  onEtapa(1);
  const hospitales = await getJson(ruta('/hospitales', { tipo: TIPOS_PROPIOS, limit: 1000 }), { signal });
  onEtapa(2);
  const [registros, rk] = await Promise.all([
    oportunidadCompleta({ tipo: TIPOS_PROPIOS, ...(desde ? { desde_anio: desde } : {}) }, { signal }),
    ranking({ tipo: TIPOS_PROPIOS, desde_anio: desde ?? 2000, limit: 100 }, { signal }),
  ]);
  onEtapa(3);
  return { estado, hospitales, registros, ranking: rk };
}
