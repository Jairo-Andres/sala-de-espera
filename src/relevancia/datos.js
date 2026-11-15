// Funciones puras para /resumen, /ranking y /estado (se prueban con fixtures en datos.test.js).

export const TIPOS_PROPIOS = 'hospital,red,subred';
export const PERIODOS = [
  { id: '2023', desde: 2023 },
  { id: '2020', desde: 2020 },
  { id: 'todo', desde: null },
];
export const PERIODO_DEFECTO = '2023';
export const desdeDe = (id) => PERIODOS.find((p) => p.id === id)?.desde ?? null;

/** true si el periodo empieza hace más de un año (se marca con "Dato de AAAA"). */
export function esViejo(periodo, hoy = new Date()) {
  const limite = new Date(hoy);
  limite.setFullYear(limite.getFullYear() - 1);
  return new Date(`${periodo}T00:00:00`) < limite;
}

/** Estado de la última carga del ETL: aviso si alguna fuente falló o si tiene más de 8 días. */
export function saludEtl(estado, hoy = new Date(), maxDias = 8) {
  const c = estado?.ultima_carga_etl;
  if (!c) return null;
  const dias = Math.floor((hoy - new Date(c.fecha)) / 86400000);
  const total = c.datasets_ok + c.datasets_error;
  return { fecha: c.fecha, dias, ok: c.datasets_ok, errores: c.datasets_error, total, vieja: dias > maxDias, alDia: dias <= maxDias && c.datasets_error === 0 };
}

/** Separa los grupos de /ranking: los que tienen al menos 2 unidades (se ordenan) y los de una sola. */
export function separarRanking(grupos) {
  const comparables = grupos.filter((g) => g.unidades >= 2)
    .sort((a, b) => b.unidades - a.unidades || b.ranking[0].dias_espera - a.ranking[0].dias_espera);
  const solas = grupos.filter((g) => g.unidades < 2)
    .map((g) => ({ ...g.ranking[0], especialidad: g.especialidad, definicion: g.definicion, granularidad: g.granularidad }))
    .sort((a, b) => a.especialidad.localeCompare(b.especialidad, 'es') || a.hospital.localeCompare(b.hospital, 'es'));
  return { comparables, solas };
}

const ORDEN_GRAN = { mes: 0, trimestre: 1, semestre: 2 };

/**
 * Último dato de medicina general y odontología por unidad (definición "solicitud" y la
 * granularidad más fina de cada unidad), a partir de /ranking, para compararlo con la norma.
 */
export function normaDesdeRanking(grupos, especialidades, plazo) {
  const porUnidad = new Map();
  for (const g of grupos) {
    if (!especialidades.includes(g.especialidad) || g.definicion !== 'solicitud') continue;
    for (const r of g.ranking) {
      const k = `${r.hospital}|${g.especialidad}`;
      const prev = porUnidad.get(k);
      if (!prev || ORDEN_GRAN[g.granularidad] < ORDEN_GRAN[prev.granularidad]) {
        porUnidad.set(k, { ...r, especialidad: g.especialidad, granularidad: g.granularidad });
      }
    }
  }
  const registros = [...porUnidad.values()];
  return { registros, debajo: registros.filter((r) => r.dias_espera <= plazo).length, total: registros.length };
}

/** Ciudades distintas de una respuesta de /resumen agrupada por municipio, en orden alfabético. */
export function ciudades(items) {
  return [...new Set(items.map((i) => i.grupo.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Departamentos distintos de una respuesta de /resumen agrupada por departamento. */
export function departamentos(items) {
  return [...new Set(items.map((i) => i.grupo.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Serie del Archivo a partir de /resumen?agrupar_por=periodo (un punto por trimestre o semestre). */
export function serieArchivo(items) {
  return [...items]
    .sort((a, b) => a.grupo.periodo.localeCompare(b.grupo.periodo))
    .map((i) => ({
      periodo: i.grupo.periodo,
      granularidad: i.granularidad,
      ponderado: i.dias_espera,
      metodo: i.metodo,
      mediana: i.mediana_unidades,
      ips: i.unidades,
      citas: i.citas,
      historico: i.historico,
    }));
}
