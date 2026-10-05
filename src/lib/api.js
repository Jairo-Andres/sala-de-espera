// Cliente de la API de datos abiertos. Render (plan gratis) duerme el servicio tras
// ~15 min sin uso, así que la primera petición puede tardar hasta un minuto.

export const API_URL = (import.meta.env.VITE_API_URL || 'https://datos-abiertos-citas-api.onrender.com').replace(/\/$/, '');

const TIPOS_PROPIOS = ['hospital', 'red', 'subred'];

async function getJson(ruta, { timeout = 70000, signal } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(`${API_URL}${ruta}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}`);
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

/**
 * Carga inicial en tres etapas para el componente "Cargando datos":
 * 0 despertar el servidor, 1 unidades, 2 registros de espera.
 */
export async function cargarTodo(onEtapa, signal) {
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
  const hospitales = (
    await Promise.all(TIPOS_PROPIOS.map((tipo) => getJson(`/hospitales?tipo=${tipo}&limit=1000`, { signal })))
  ).flat();
  onEtapa(2);
  const registros = (
    await Promise.all(TIPOS_PROPIOS.map((tipo) => oportunidadCompleta({ tipo }, { signal })))
  ).flat();
  onEtapa(3);
  return { estado, hospitales, registros };
}
