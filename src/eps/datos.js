// Funciones puras para la sala de las EPS. Leen el archivo ya validado por el pipeline
// (public/data/eps/sala-eps.json); nunca descargan nada de las EPS.

export const ORDEN_ESPECIALIDADES = [
  'medicina_general', 'odontologia', 'pediatria', 'obstetricia', 'ginecologia', 'cirugia_general', 'medicina_interna',
];
export const GRUPOS = ['sura|', 'nueva_eps|contributivo', 'nueva_eps|subsidiado'];

export function urlDatos() {
  return `${import.meta.env.BASE_URL}data/eps/sala-eps.json`;
}

/** Turnos en orden estable: por especialidad y, dentro de ella, por EPS y régimen. */
export function ordenarTurnos(turnos) {
  const g = (t) => GRUPOS.indexOf(`${t.eps}|${t.regimen ?? ''}`);
  return [...turnos].sort(
    (a, b) => ORDEN_ESPECIALIDADES.indexOf(a.specialty) - ORDEN_ESPECIALIDADES.indexOf(b.specialty) || g(a) - g(b),
  );
}

/** Banderas que bloquean el valor titular (las que explican un "sin dato"). */
export function motivosSinDato(punto) {
  return (punto?.flags ?? []).filter((f) => f.severity === 'bloqueante');
}

export function advertencias(punto) {
  return (punto?.flags ?? []).filter((f) => f.severity === 'advertencia' && f.code !== 'desired_unreliable_source');
}

/** Último mes con dato por EPS y régimen, para la nota de frescura. */
export function ultimoMes(calidad) {
  const out = [];
  for (const [eps, s] of Object.entries(calidad?.sources ?? {})) {
    for (const [reg, ym] of Object.entries(s.last_month ?? {})) out.push({ eps, regimen: reg === 'unico' ? null : reg, ym });
  }
  return out;
}

/** "2026-08" -> índice de mes absoluto (para ubicar puntos en el eje). */
export const mesAbs = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Parte una serie en tramos continuos: un mes sin dato o ausente corta la línea (no se inventa el hueco). */
export function tramos(puntos, campo = 'req') {
  const out = [];
  let actual = [];
  let prev = null;
  for (const p of puntos) {
    const ok = p[campo] != null;
    if (!ok || (prev != null && mesAbs(p.ym) - prev !== 1)) {
      if (actual.length) out.push(actual);
      actual = [];
    }
    if (ok) actual.push(p);
    prev = mesAbs(p.ym);
  }
  if (actual.length) out.push(actual);
  return out;
}

/** Posición frente a la referencia, en lenguaje neutral. null si no hay referencia o dato. */
export function frenteAReferencia(valor, referencia) {
  if (valor == null || referencia == null) return null;
  return valor <= referencia ? 'dentro' : 'encima';
}

/** Filas por departamento de un mes, ordenadas de mayor a menor espera y con los "sin dato" al final. */
export function filasDepartamento(porMes, ym) {
  const filas = porMes?.[ym] ?? [];
  return [...filas].sort((a, b) => (b.req ?? -1) - (a.req ?? -1) || (a.dept ?? '').localeCompare(b.dept ?? ''));
}

/** Simulación de una fuente caída (solo para revisar el diseño: ?eps_demo=fuente_caida). */
export function simularFuenteCaida(datos) {
  const fuentes = { ...datos.quality.sources };
  fuentes.nueva_eps = {
    ...fuentes.nueva_eps,
    ok: false,
    responded: false,
    error: 'SIMULACION',
    failing_since: fuentes.nueva_eps.checked_at,
  };
  return { ...datos, quality: { ...datos.quality, sources: fuentes }, simulacion: true };
}
