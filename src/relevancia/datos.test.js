import { describe, expect, it } from 'vitest';
import { ciudades, departamentos, desdeDe, esViejo, normaDesdeRanking, saludEtl, separarRanking, serieArchivo } from './datos.js';

const item = (hospital, dias, periodo = '2026-04-01', id = hospital.length) => ({ hospital_id: id, hospital, dias_espera: dias, periodo, citas: 10 });

describe('periodo y datos viejos', () => {
  it('traduce el periodo a desde_anio', () => {
    expect(desdeDe('2023')).toBe(2023);
    expect(desdeDe('todo')).toBeNull();
  });
  it('marca como viejo lo que empieza hace más de un año', () => {
    const hoy = new Date('2026-11-15T00:00:00');
    expect(esViejo('2024-12-01', hoy)).toBe(true);
    expect(esViejo('2026-01-01', hoy)).toBe(false);
  });
});

describe('saludEtl', () => {
  const hoy = new Date('2026-11-15T12:00:00Z');
  it('al día sin errores y con menos de 8 días', () => {
    const s = saludEtl({ ultima_carga_etl: { fecha: '2026-11-15T03:51:51Z', datasets_ok: 11, datasets_error: 0 } }, hoy);
    expect(s).toMatchObject({ alDia: true, vieja: false, total: 11 });
  });
  it('avisa por fuentes caídas o por carga vieja', () => {
    expect(saludEtl({ ultima_carga_etl: { fecha: '2026-11-14T00:00:00Z', datasets_ok: 10, datasets_error: 1 } }, hoy).alDia).toBe(false);
    const vieja = saludEtl({ ultima_carga_etl: { fecha: '2026-11-02T20:39:50Z', datasets_ok: 11, datasets_error: 0 } }, hoy);
    expect(vieja).toMatchObject({ vieja: true, dias: 12, alDia: false });
  });
  it('sin carga no dice nada', () => expect(saludEtl({ ultima_carga_etl: null })).toBeNull());
});

describe('ranking', () => {
  const grupos = [
    { especialidad: 'Pediatría', definicion: 'solicitud', granularidad: 'trimestre', unidades: 1, ranking: [item('Colón', 10)] },
    { especialidad: 'Urología', definicion: 'solicitud', granularidad: 'trimestre', unidades: 4, ranking: [item('Sur', 16.1), item('Norte', 9.2)] },
    { especialidad: 'Cardiología', definicion: 'solicitud', granularidad: 'trimestre', unidades: 4, ranking: [item('Norte', 14.7)] },
    { especialidad: 'Medicina general', definicion: 'solicitud', granularidad: 'mes', unidades: 1, ranking: [item('Aguadas', 1.1)] },
    { especialidad: 'Medicina general', definicion: 'solicitud', granularidad: 'trimestre', unidades: 1, ranking: [item('Aguadas', 4)] },
    { especialidad: 'Odontología', definicion: 'solicitud', granularidad: 'semestre', unidades: 2, ranking: [item('Pereira', 2.1), item('Neiva', 5)] },
  ];
  it('separa series comparables de las de una sola unidad, sin mezclar granularidades', () => {
    const { comparables, solas } = separarRanking(grupos);
    expect(comparables.map((g) => g.especialidad)).toEqual(['Urología', 'Cardiología', 'Odontología']);
    expect(solas.map((s) => `${s.especialidad}|${s.granularidad}`)).toEqual(['Medicina general|mes', 'Medicina general|trimestre', 'Pediatría|trimestre']);
  });
  it('frente a la norma toma la granularidad más fina de cada unidad', () => {
    const n = normaDesdeRanking(grupos, ['Medicina general', 'Odontología'], 3);
    expect(n.registros.map((r) => `${r.hospital}|${r.especialidad}|${r.granularidad}`).sort())
      .toEqual(['Aguadas|Medicina general|mes', 'Neiva|Odontología|semestre', 'Pereira|Odontología|semestre']);
    expect([n.debajo, n.total]).toEqual([2, 3]);
  });
});

describe('listas y serie del archivo', () => {
  const items = [
    { grupo: { periodo: '2021-07-01' }, granularidad: 'trimestre', dias_espera: 3.6, metodo: 'ponderado', mediana_unidades: 2.1, unidades: 40, citas: 900, historico: true },
    { grupo: { periodo: '2016-01-01' }, granularidad: 'semestre', dias_espera: 4.2, metodo: 'ponderado', mediana_unidades: 2.2, unidades: 30, citas: 500, historico: true },
  ];
  it('ordena la serie por periodo y conserva mediana, IPS, citas e histórico', () => {
    const s = serieArchivo(items);
    expect(s.map((p) => p.periodo)).toEqual(['2016-01-01', '2021-07-01']);
    expect(s[1]).toMatchObject({ ponderado: 3.6, mediana: 2.1, ips: 40, citas: 900, historico: true });
  });
  it('saca ciudades y departamentos únicos y ordenados', () => {
    expect(ciudades([{ grupo: { municipio: 'Neiva' } }, { grupo: { municipio: 'Bogotá' } }, { grupo: { municipio: 'Neiva' } }])).toEqual(['Bogotá', 'Neiva']);
    expect(departamentos([{ grupo: { departamento: 'Huila' } }, { grupo: { departamento: 'Antioquia' } }])).toEqual(['Antioquia', 'Huila']);
  });
});
