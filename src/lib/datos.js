// Funciones puras para preparar los datos de la API. No hacen peticiones: así se
// pueden probar con fixtures (ver datos.test.js).

// Cómo declara cada fuente su definición de espera, según el README de la API
// (sección "Qué se puede comparar"). "asumida" = la fuente no lo dice.
const ESTADO_DEFINICION = {
  Popayán: 'asumida',
  Aguadas: 'verificada',
  Neiva: 'explicita',
  Colón: 'asumida',
  Pereira: 'asumida',
  Bogotá: 'metadato',
};

/** Nombre corto y legible de una unidad (hospital, red o subred). */
export function nombreCorto(u) {
  if (u.tipo === 'subred') {
    const m = /Salud\s+(.+?)\s+E\.S\.E\./i.exec(u.nombre);
    return `Bogotá ${m ? m[1] : ''}`.trim();
  }
  if (u.tipo === 'ips') return u.nombre;
  return u.municipio;
}

/** Une los metadatos de /hospitales por nombre (los registros de /oportunidad no traen id). */
export function indexarUnidades(hospitales) {
  const idx = new Map();
  for (const h of hospitales) {
    idx.set(h.nombre, {
      ...h,
      corto: nombreCorto(h),
      estadoDefinicion: h.tipo === 'ips' ? 'asumida' : ESTADO_DEFINICION[h.municipio] ?? 'asumida',
    });
  }
  return idx;
}

export function claveSerie(r) {
  return `${r.hospital}|${r.especialidad}|${r.definicion}|${r.granularidad}`;
}

/** Agrupa registros en series ordenadas por periodo. */
export function agruparSeries(rows) {
  const series = new Map();
  for (const r of rows) {
    const k = claveSerie(r);
    if (!series.has(k)) series.set(k, { hospital: r.hospital, especialidad: r.especialidad, definicion: r.definicion, granularidad: r.granularidad, puntos: [] });
    series.get(k).puntos.push(r);
  }
  for (const s of series.values()) s.puntos.sort((a, b) => a.periodo.localeCompare(b.periodo));
  return series;
}

/** Especialidades con el número de unidades que las publican (más cobertura primero). */
export function coberturaEspecialidades(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.especialidad)) m.set(r.especialidad, new Set());
    m.get(r.especialidad).add(r.hospital);
  }
  return [...m.entries()]
    .map(([especialidad, s]) => ({ especialidad, unidades: s.size }))
    .sort((a, b) => b.unidades - a.unidades || a.especialidad.localeCompare(b.especialidad, 'es'));
}

/**
 * Último dato de cada unidad para una especialidad. Se usa la definición "solicitud"
 * (la única que publican todas) y, si una unidad tiene varias granularidades, la más fina.
 */
export function ultimoPorUnidad(rows, especialidad) {
  const orden = { mes: 0, trimestre: 1, semestre: 2 };
  const porUnidad = new Map();
  for (const r of rows) {
    if (r.especialidad !== especialidad || r.definicion !== 'solicitud') continue;
    const prev = porUnidad.get(r.hospital);
    if (
      !prev ||
      orden[r.granularidad] < orden[prev.granularidad] ||
      (r.granularidad === prev.granularidad && r.periodo > prev.periodo)
    ) porUnidad.set(r.hospital, r);
  }
  return [...porUnidad.values()].sort((a, b) => b.dias_espera - a.dias_espera);
}

/**
 * Turnos para el turnero: el último dato de cada unidad y especialidad (definición
 * "solicitud"), intercalando unidades para que turnos seguidos no sean del mismo hospital.
 */
export function construirTurnos(rows) {
  const ultimo = new Map();
  for (const r of rows) {
    if (r.definicion !== 'solicitud' || r.especialidad === 'Todas las especialidades') continue;
    const k = `${r.hospital}|${r.especialidad}`;
    const prev = ultimo.get(k);
    if (!prev || r.periodo > prev.periodo) ultimo.set(k, r);
  }
  const porUnidad = new Map();
  for (const r of [...ultimo.values()].sort((a, b) => a.especialidad.localeCompare(b.especialidad, 'es'))) {
    if (!porUnidad.has(r.hospital)) porUnidad.set(r.hospital, []);
    porUnidad.get(r.hospital).push(r);
  }
  const colas = [...porUnidad.keys()].sort((a, b) => a.localeCompare(b, 'es')).map((k) => porUnidad.get(k));
  const turnos = [];
  for (let i = 0; colas.some((c) => i < c.length); i++) {
    for (const c of colas) if (i < c.length) turnos.push(c[i]);
  }
  return turnos.map((r, i) => ({ ...r, numero: i + 1 }));
}

/** Matriz año × mes para series mensuales (null donde no hay dato). */
export function matrizMensual(puntos) {
  const anios = [...new Set(puntos.map((p) => Number(p.periodo.slice(0, 4))))].sort((a, b) => a - b);
  const filas = anios.map((anio) => ({ anio, meses: Array(12).fill(null) }));
  for (const p of puntos) {
    const anio = Number(p.periodo.slice(0, 4));
    const mes = Number(p.periodo.slice(5, 7)) - 1;
    filas.find((f) => f.anio === anio).meses[mes] = p;
  }
  return filas;
}

/**
 * Resumen por periodo de lo que reportaron muchas IPS (Clicsalud): promedio ponderado
 * por citas, mediana y número de IPS. Ignora registros sin citas.
 */
export function resumenPorPeriodo(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.citas) continue;
    if (!m.has(r.periodo)) m.set(r.periodo, []);
    m.get(r.periodo).push(r);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, rs]) => {
      const citas = rs.reduce((s, r) => s + r.citas, 0);
      const ponderado = rs.reduce((s, r) => s + r.dias_espera * r.citas, 0) / citas;
      const v = rs.map((r) => r.dias_espera).sort((a, b) => a - b);
      const mitad = Math.floor(v.length / 2);
      const mediana = v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2;
      return { periodo, granularidad: rs[0].granularidad, ips: new Set(rs.map((r) => r.hospital)).size, citas, ponderado, mediana };
    });
}

const MESES = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export const mesesCortos = (lang) => MESES[lang];

/** "mar 2026", "2026-T2" / "Q2 2026", "2026-S1" / "H1 2026". */
export function formatoPeriodo(periodo, granularidad, lang = 'es') {
  const anio = periodo.slice(0, 4);
  const mes = Number(periodo.slice(5, 7));
  if (granularidad === 'trimestre') {
    const t = Math.floor((mes - 1) / 3) + 1;
    return lang === 'es' ? `${anio}-T${t}` : `Q${t} ${anio}`;
  }
  if (granularidad === 'semestre') {
    const s = mes <= 6 ? 1 : 2;
    return lang === 'es' ? `${anio}-S${s}` : `H${s} ${anio}`;
  }
  return `${MESES[lang][mes - 1]} ${anio}`;
}

/** Días con un decimal y la coma o el punto según el idioma. */
export function formatoDias(n, lang = 'es') {
  if (n == null || Number.isNaN(n)) return '–';
  return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
}

export function formatoEntero(n, lang = 'es') {
  return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US').format(n);
}

/** Rango [min, max] de periodos de una lista de registros. */
export function rangoPeriodos(rows) {
  let min = null;
  let max = null;
  for (const r of rows) {
    if (!min || r.periodo < min) min = r.periodo;
    if (!max || r.periodo > max) max = r.periodo;
  }
  return [min, max];
}
