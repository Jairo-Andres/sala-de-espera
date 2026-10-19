"""Salud Total: PDF real de septiembre de 2026 (formato por IPS) y texto sintético con campos pegados."""

import unittest

from pipeline.eps import construir, extraer, parser_salud_total, validar
from pipeline.eps.parser_nueva_eps import FormatoInesperado
from pipeline.eps.tests.test_reales import _pdf

FUENTE = {"url": "u", "sha256": "s", "retrieved_at": "t"}
ENCABEZADO = "Departamento Ciudad Nit IPS Regimen Producto CodigoIT Servicio TOTAL CITAS ASIGNADAS SFAFS SFAFU PFAFS PFAFU MINDA MAXDA HORAS CONTRATAD AS"


def _regs(lineas, year=2026, month=9):
    return construir.desde_salud_total(parser_salud_total.parsear(lineas), year, month, FUENTE)


class Sintetico(unittest.TestCase):
    LINEAS = [
        ENCABEZADO,
        "TOLIMA PALOCABILDO809004280 HOSPITAL RICARDO ACOSTA SUBSIDIADO PBS 8902010000 CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL",
        "100 300 200 3,00 2,00 0 9 50",
        "BOGOTA BOGOTA 811004956 FUNDACION LA LUZSUBSIDIADO PBS 8902010000 CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL",
        "50 50 50 1,00 1,00 3 5 20",  # promedio por debajo del mínimo
        "BOGOTA BOGOTA 811004956 FUNDACION LA LUZSUBSIDIADO PBS 8902010000 CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL",
        "50 50 50 1,00 1,00 3 5 20",  # fila idéntica repetida
        "VALLE DEL CAUCA CALI 800000001 CLINICA X CONTRIBUTIVO PAC 8902010000 CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL",
        "10 10 10 1,00 1,00 1 1 5",  # plan complementario: no entra
        "VALLE DEL CAUCA CALI 800000001 CLINICA X SUBSIDIADO PBS 8903013401 CONSULTA DE CONTROL O DE SEGUIMIENTO POR MEDICINA GENERAL",
        "10 10 10 1,00 1,00 1 1 5",  # control: no entra
    ]

    def test_campos_pegados_y_agregado_ponderado(self):
        regs = _regs(self.LINEAS)
        ips = [r for r in regs if r["geo_level"] == "ips"]
        self.assertEqual(len(ips), 2)
        self.assertEqual({r["department"] for r in ips}, {"tolima", "bogota"})
        nat = next(r for r in regs if r["geo_level"] == "national")
        self.assertEqual(nat["appointments_total"], 150)  # la fila repetida cuenta una vez
        self.assertAlmostEqual(nat["avg_request_calc"], 350 / 150)  # Σ días / Σ citas, no promedio de promedios

    def test_banderas(self):
        regs = _regs(self.LINEAS)
        luz = next(r for r in regs if r.get("ips_nit") == "811004956")
        self.assertIn("duplicate_row", luz["quality_flags"])
        self.assertIn("avg_outside_min_max:3-5", luz["quality_flags"])
        self.assertEqual(validar.severidad("avg_outside_min_max:3-5"), "advertencia")

    def test_periodo_del_titulo(self):
        lineas = self.LINEAS[:1] + ["• SFAFS = glosario INFORME ASIGNACIÓN DE CITAS MES DE AGOSTO 2026 " + self.LINEAS[1], self.LINEAS[2]]
        nat = next(r for r in _regs(lineas) if r["geo_level"] == "national")
        self.assertIn("period_mismatch:2026-08", nat["quality_flags"])

    def test_formato_distinto_falla(self):
        with self.assertRaises(FormatoInesperado):
            parser_salud_total.parsear(["Otra tabla", "1 2 3 4 5 6 7 8"])


class Septiembre2026(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.res = parser_salud_total.parsear(extraer.lineas_pdf(_pdf("salud_total_2026_09.pdf")))
        cls.regs = construir.desde_salud_total(cls.res, 2026, 9, FUENTE)

    def test_lectura_completa(self):
        self.assertGreater(len(self.res.filas), 8900)
        self.assertLessEqual(self.res.registros_ilegibles, 1)
        self.assertEqual(self.res.periodos_en_texto, {(2026, 9)})
        self.assertFalse([f for f in self.res.filas if f.department is None])

    def test_nacional_es_suma_de_ips_validas(self):
        for regimen in ("contributivo", "subsidiado"):
            for esp in ("medicina_general", "pediatria", "ginecologia"):
                ips = [r for r in self.regs if r["geo_level"] == "ips" and r["regimen"] == regimen
                       and r["specialty"] == esp and r["avg_request_calc"] is not None]
                nat = next(r for r in self.regs if r["geo_level"] == "national" and r["regimen"] == regimen and r["specialty"] == esp)
                self.assertEqual(nat["appointments_total"], sum(r["appointments_total"] for r in ips))
                self.assertAlmostEqual(nat["avg_request_calc"], sum(r["sum_days_request"] for r in ips) / nat["appointments_total"])

    def test_hospital_de_neiva_presente(self):
        self.assertTrue([f for f in self.res.filas if f.ips_nit == "891180268" and f.department == "huila"])

    def test_filas_duplicadas_marcadas(self):
        self.assertTrue([r for r in self.regs if "duplicate_row" in r["quality_flags"]])


if __name__ == "__main__":
    unittest.main()
