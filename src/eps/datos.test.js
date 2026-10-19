import { describe, expect, it } from 'vitest';
import { filasDepartamento, frenteAReferencia, motivosSinDato, ordenarTurnos, tramos } from './datos.js';

describe('sala de las EPS', () => {
  it('ordena turnos por especialidad y luego Sura, contributivo, subsidiado', () => {
    const t = [
      { eps: 'nueva_eps', regimen: 'subsidiado', specialty: 'pediatria' },
      { eps: 'sura', regimen: null, specialty: 'pediatria' },
      { eps: 'nueva_eps', regimen: 'contributivo', specialty: 'medicina_general' },
    ];
    expect(ordenarTurnos(t).map((x) => `${x.eps}|${x.regimen}|${x.specialty}`)).toEqual([
      'nueva_eps|contributivo|medicina_general', 'sura|null|pediatria', 'nueva_eps|subsidiado|pediatria',
    ]);
  });

  it('corta la línea en meses sin dato o ausentes', () => {
    const p = [
      { ym: '2026-01', req: 3 }, { ym: '2026-02', req: null }, { ym: '2026-03', req: 4 },
      { ym: '2026-04', req: 5 }, { ym: '2026-06', req: 6 },
    ];
    expect(tramos(p).map((s) => s.map((x) => x.ym))).toEqual([['2026-01'], ['2026-03', '2026-04'], ['2026-06']]);
  });

  it('compara con la referencia sin juicio', () => {
    expect(frenteAReferencia(10, 10)).toBe('dentro');
    expect(frenteAReferencia(12.4, 10)).toBe('encima');
    expect(frenteAReferencia(null, 10)).toBeNull();
    expect(frenteAReferencia(2, undefined)).toBeNull();
  });

  it('solo las banderas bloqueantes explican un sin dato', () => {
    const p = { flags: [{ code: 'avg_mismatch', severity: 'bloqueante' }, { code: 'small_sample', severity: 'advertencia' }] };
    expect(motivosSinDato(p).map((f) => f.code)).toEqual(['avg_mismatch']);
  });

  it('pone los departamentos sin dato al final', () => {
    const f = filasDepartamento({ '2026-08': [{ dept: 'a', req: null }, { dept: 'b', req: 2 }, { dept: 'c', req: 9 }] }, '2026-08');
    expect(f.map((x) => x.dept)).toEqual(['c', 'b', 'a']);
  });
});
