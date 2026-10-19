"""Pruebas con los PDF reales (fixtures) y los valores de referencia observados el 2026-10-18.

Si un valor no coincide, la fuente pudo reemitir el PDF: hay que reportarlo, no ajustar la prueba.
Sin fixtures, las pruebas se saltan; con REQUIRE_FIXTURES=1 (CI) fallan.
"""

import os
import unittest
from functools import lru_cache
from pathlib import Path

from pipeline.eps import construir, extraer, parser_nueva_eps, parser_sura, validar

DIR = Path(__file__).parent / "fixtures"
FUENTE = {"url": "fixture", "sha256": "x", "retrieved_at": "2026-10-18T00:00:00Z"}


def _pdf(nombre):
    ruta = DIR / nombre
    if not ruta.exists():
        if os.environ.get("REQUIRE_FIXTURES") == "1":
            raise AssertionError(f"Falta el fixture {nombre}: python -m pipeline.eps.tests.bajar_fixtures")
        raise unittest.SkipTest(f"Sin fixture {nombre}")
    return ruta.read_bytes()


def _validados(regs):
    for r in regs:
        validar.calcular(r)
        validar.validar_registro(r)
        r.pop("_decimales", None)
    return validar.validar_conjunto(regs)


@lru_cache
def nueva_eps(regimen):
    res = parser_nueva_eps.parsear(extraer.lineas_pdf(_pdf(f"nueva_eps_2026_08_{regimen}.pdf")))
    return _validados(construir.desde_nueva_eps(res, regimen, 2026, 8, FUENTE))


@lru_cache
def sura():
    res = parser_sura.parsear(extraer.lineas_pdf(_pdf("sura_acumulado.pdf")))
    return res, _validados(construir.desde_sura(res, FUENTE))


def buscar(regs, **k):
    out = [r for r in regs if all(r.get(c) == v for c, v in k.items())]
    assert len(out) == 1, f"{k}: {len(out)} registros"
    return out[0]


# (citas, Σ solicitud, Σ deseada, prom. solicitud, prom. deseada) — sección 11 del brief
NUEVA_EPS_AGO_2026_CONTRIB = {
    "cirugia_general": (9784, 121352, 88547, 12.40, 9.1),
    "ginecologia": (29520, 365904, 223075, 12.40, 7.6),
    "medicina_general": (539894, 2940247, 1751690, 5.45, 3.2),
    "medicina_interna": (38449, 439310, 324514, 11.43, 8.4),
    "obstetricia": (9579, 78724, 54292, 8.22, 5.7),
    "odontologia": (202372, 805076, 412554, 3.98, 2.0),
    "pediatria": (33193, 239621, 131963, 7.22, 4.0),
}

# (citas, SFAFS, PFAFS esperado)
SURA_SEP_2026 = {
    "odontologia": (101562, 249137, 2.45),
    "medicina_interna": (15045, 125467, 8.34),
    "pediatria": (12990, 49823, 3.84),
    "cirugia_general": (4952, 47900, 9.67),
    "ginecologia": (10123, 75348, 7.44),
    "obstetricia": (1896, 9833, 5.19),
    "medicina_general": (680991, 2198048, 3.23),
}


class NuevaEpsAgosto2026(unittest.TestCase):
    def test_totales_nacionales_contributivo(self):
        regs = nueva_eps("contributivo")
        for esp, (n, s_req, s_des, p_req, p_des) in NUEVA_EPS_AGO_2026_CONTRIB.items():
            with self.subTest(esp):
                r = buscar(regs, specialty=esp, geo_level="national")
                self.assertEqual((r["appointments_total"], r["sum_days_request"], r["sum_days_desired"]), (n, s_req, s_des))
                self.assertEqual(round(r["avg_request_calc"], 2), p_req)
                self.assertEqual(r["avg_desired_reported"], p_des)
                self.assertAlmostEqual(r["avg_desired_calc"], s_des / n)
                self.assertFalse([b for b in r["quality_flags"] if validar.codigo(b) == "avg_mismatch"])

    def test_resumen_y_fila_total_coinciden(self):
        for r in nueva_eps("contributivo"):
            self.assertNotIn("total_row_mismatch", r["quality_flags"])

    def test_departamentos_reconocidos_y_suma_nacional(self):
        for regimen in ("contributivo", "subsidiado"):
            regs = nueva_eps(regimen)
            deptos = [r for r in regs if r["geo_level"] == "department"]
            self.assertGreater(len(deptos), 200)
            self.assertFalse([r for r in deptos if r["department"] is None])
        for r in nueva_eps("contributivo"):
            self.assertFalse([b for b in r["quality_flags"] if validar.codigo(b) == "national_sum_mismatch"], r["specialty"])

    def test_suma_departamental_distinta_del_total_subsidiado(self):
        # Hallazgo del 2026-10-18: en obstetricia (subsidiado) los 30 departamentos suman 12.826 citas y
        # el total nacional del mismo PDF dice 13.008. Se advierte; no se corrige.
        r = buscar(nueva_eps("subsidiado"), specialty="obstetricia", geo_level="national")
        self.assertEqual(r["appointments_total"], 13008)
        self.assertIn("national_sum_mismatch:12826", r["quality_flags"])

    def test_minimo_negativo_odontologia_antioquia(self):
        r = buscar(nueva_eps("contributivo"), specialty="odontologia", department="antioquia")
        self.assertEqual(r["quality_flags"].count("negative_days:avg_of_min_desired"), 1)
        self.assertIsNone(r["avg_of_min_desired"])  # sin dato
        self.assertIsNotNone(r["avg_request_calc"])  # la medida titular no depende de ese campo

    def test_maximo_1430_medicina_general_bogota(self):
        r = buscar(nueva_eps("contributivo"), specialty="medicina_general", department="bogota")
        self.assertEqual(r["avg_of_max_desired"], 1430.0)
        self.assertIn("avg_over_60:avg_of_max_desired", r["quality_flags"])

    def test_bogota_marcada_para_revision_sin_corregir(self):
        r = buscar(nueva_eps("contributivo"), specialty="cirugia_general", department="bogota")
        self.assertEqual(round(r["avg_request_calc"], 2), 38.19)
        self.assertIn("regional_outlier", r["quality_flags"])

    def test_periodo_y_regimen_del_encabezado(self):
        for regimen in ("contributivo", "subsidiado"):
            for r in nueva_eps(regimen):
                self.assertFalse([b for b in r["quality_flags"] if validar.codigo(b) in ("period_mismatch", "regimen_mismatch")])


class SuraAcumulado(unittest.TestCase):
    def test_septiembre_2026(self):
        _, regs = sura()
        for esp, (n, sfafs, pfafs) in SURA_SEP_2026.items():
            with self.subTest(esp):
                r = buscar(regs, specialty=esp, year=2026, month=9)
                self.assertEqual((r["appointments_total"], r["sum_days_request"]), (n, sfafs))
                self.assertEqual(round(r["avg_request_calc"], 2), pfafs)
                self.assertEqual(r["avg_request_reported"], pfafs)

    def test_fecha_deseada_no_confiable(self):
        _, regs = sura()
        r = buscar(regs, specialty="cirugia_general", year=2026, month=9)
        self.assertIsNone(r["sum_days_desired"])
        self.assertIsNone(r["avg_desired_calc"])
        self.assertEqual(r["avg_desired_reported"], 28.46)  # lo que dice el PDF, sin usarlo
        self.assertIn("desired_unreliable_source", r["quality_flags"])

    def test_historia_completa_sin_huecos(self):
        res, regs = sura()
        meses = {(r["year"], r["month"]) for r in regs}
        self.assertEqual(min(meses), (2013, 1))
        self.assertEqual(max(meses), (2026, 9))
        self.assertEqual(len(meses), 13 * 12 + 9)
        self.assertFalse([b for b in res.bloques if b.problema])

    def test_pagina_repetida_de_2019(self):
        res, _ = sura()
        self.assertEqual(len([n for n in res.notas if "repetido" in n]), 3)

    def test_separadores_mezclados(self):
        _, regs = sura()
        # 2013: decimales con punto y SFAFS antes del total; 2026: miles con punto y decimales con coma.
        r13 = buscar(regs, specialty="odontologia", year=2013, month=1)
        self.assertEqual((r13["appointments_total"], r13["sum_days_request"]), (47245, 197457))
        r26 = buscar(regs, specialty="odontologia", year=2026, month=8)
        self.assertEqual((r26["appointments_total"], r26["sum_days_request"]), (90194, 245505))

    def test_pediatria_agosto_2019_sin_dato(self):
        # El PDF dice PFAFS = 0,08, pero sus propias sumas dan 32.028 / 7.897 = 4,06 días.
        _, regs = sura()
        r = buscar(regs, specialty="pediatria", year=2019, month=8)
        self.assertEqual(r["avg_request_reported"], 0.08)
        self.assertEqual((r["appointments_total"], r["sum_days_request"]), (7897, 32028))
        self.assertIn("avg_mismatch:request", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])  # se publica como "sin dato"

    def test_caida_de_volumen_en_2020_anotada(self):
        _, regs = sura()
        r = buscar(regs, specialty="odontologia", year=2020, month=4)
        self.assertEqual(r["appointments_total"], 1869)
        self.assertIn("volume_jump", r["quality_flags"])
        self.assertIn("context:pandemia_covid19", r["quality_flags"])
        self.assertIsNotNone(r["avg_request_calc"])  # se anota, no se elimina


if __name__ == "__main__":
    unittest.main()
