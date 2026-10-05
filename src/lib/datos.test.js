import { describe, expect, it } from 'vitest';
import {
  agruparSeries,
  construirTurnos,
  coberturaEspecialidades,
  formatoDias,
  formatoPeriodo,
  indexarUnidades,
  matrizMensual,
  nombreCorto,
  resumenPorPeriodo,
  ultimoPorUnidad,
} from './datos.js';

// Fixture con la forma de /oportunidad. Valores inventados solo para las pruebas.
const r = (hospital, especialidad, periodo, dias, extra = {}) => ({
  hospital, tipo: 'hospital', departamento: 'X', municipio: 'Y', especialidad, periodo,
  granularidad: 'mes', definicion: 'solicitud', dias_espera: dias, citas: 100, ...extra,
});

const filas = [
  r('H. A', 'Pediatría', '2026-01-01', 5),
  r('H. A', 'Pediatría', '2026-03-01', 7),
  r('H. A', 'Pediatría', '2026-02-01', 6),
  r('H. A', 'Cirugía general', '2026-03-01', 20),
  r('H. B', 'Pediatría', '2026-01-01', 30, { granularidad: 'trimestre' }),
  r('H. B', 'Pediatría', '2025-07-01', 99, { granularidad: 'semestre' }),
  r('H. C', 'Pediatría', '2026-03-01', 3, { definicion: 'fecha_deseada' }),
  r('H. C', 'Todas las especialidades', '2026-03-01', 4),
];

describe('nombreCorto', () => {
  it('usa el municipio para hospitales y la zona para subredes', () => {
    expect(nombreCorto({ tipo: 'hospital', municipio: 'Neiva', nombre: 'E.S.E. Hospital' })).toBe('Neiva');
    expect(nombreCorto({ tipo: 'subred', nombre: 'Subred Integrada de Servicios de Salud Sur Occidente E.S.E.' })).toBe('Bogotá Sur Occidente');
  });
});

describe('indexarUnidades', () => {
  it('marca la definición según la fuente', () => {
    const idx = indexarUnidades([
      { nombre: 'A', tipo: 'hospital', municipio: 'Aguadas' },
      { nombre: 'P', tipo: 'hospital', municipio: 'Popayán' },
      { nombre: 'I', tipo: 'ips', municipio: 'Aguadas' },
    ]);
    expect(idx.get('A').estadoDefinicion).toBe('verificada');
    expect(idx.get('P').estadoDefinicion).toBe('asumida');
    expect(idx.get('I').estadoDefinicion).toBe('asumida');
  });
});

describe('agruparSeries', () => {
  it('separa por unidad, especialidad, definición y granularidad, y ordena por periodo', () => {
    const s = agruparSeries(filas);
    expect(s.size).toBe(6);
    const pedA = s.get('H. A|Pediatría|solicitud|mes');
    expect(pedA.puntos.map((p) => p.dias_espera)).toEqual([5, 6, 7]);
  });
});

describe('coberturaEspecialidades', () => {
  it('cuenta unidades distintas por especialidad', () => {
    expect(coberturaEspecialidades(filas)[0]).toEqual({ especialidad: 'Pediatría', unidades: 3 });
  });
});

describe('ultimoPorUnidad', () => {
  it('toma el último dato con definición solicitud y prefiere la granularidad más fina', () => {
    const u = ultimoPorUnidad(filas, 'Pediatría');
    expect(u.map((x) => [x.hospital, x.dias_espera])).toEqual([['H. B', 30], ['H. A', 7]]);
  });
});

describe('construirTurnos', () => {
  it('intercala unidades, excluye el total del hospital y numera desde 1', () => {
    const t = construirTurnos(filas);
    expect(t.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(t.map((x) => x.hospital)).toEqual(['H. A', 'H. B', 'H. A']);
    expect(t.some((x) => x.especialidad === 'Todas las especialidades')).toBe(false);
  });
});

describe('matrizMensual', () => {
  it('pone cada mes en su columna y deja vacíos los que faltan', () => {
    const m = matrizMensual(filas.slice(0, 3));
    expect(m).toHaveLength(1);
    expect(m[0].meses.slice(0, 4).map((p) => p?.dias_espera ?? null)).toEqual([5, 6, 7, null]);
  });
});

describe('resumenPorPeriodo', () => {
  it('pondera por citas, calcula la mediana e ignora registros sin citas', () => {
    const rs = resumenPorPeriodo([
      r('I1', 'Medicina general', '2020-01-01', 2, { citas: 300 }),
      r('I2', 'Medicina general', '2020-01-01', 10, { citas: 100 }),
      r('I3', 'Medicina general', '2020-01-01', 50, { citas: null }),
    ]);
    expect(rs).toHaveLength(1);
    expect(rs[0].ponderado).toBe(4);
    expect(rs[0].mediana).toBe(6);
    expect(rs[0].ips).toBe(2);
  });
});

describe('formatos', () => {
  it('formatea periodos por granularidad e idioma', () => {
    expect(formatoPeriodo('2026-03-01', 'mes', 'es')).toBe('mar 2026');
    expect(formatoPeriodo('2026-04-01', 'trimestre', 'es')).toBe('2026-T2');
    expect(formatoPeriodo('2026-04-01', 'trimestre', 'en')).toBe('Q2 2026');
    expect(formatoPeriodo('2025-07-01', 'semestre', 'en')).toBe('H2 2025');
  });
  it('usa coma decimal en español', () => {
    expect(formatoDias(23.44, 'es')).toBe('23,4');
    expect(formatoDias(23.44, 'en')).toBe('23.4');
    expect(formatoDias(null)).toBe('–');
  });
});
