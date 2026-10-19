"""Pruebas sin red ni PDF: números, normalización, parsers con texto sintético y reglas de calidad."""

import unittest

from pipeline.eps import construir, descargar, parser_nueva_eps, parser_sura, texto, validar
from pipeline.eps.parser_nueva_eps import FormatoInesperado

FUENTE = {"url": "u", "sha256": "s", "retrieved_at": "t"}


class Numeros(unittest.TestCase):
    def test_decimales(self):
        self.assertEqual(texto.decimal("12,40"), 12.40)
        self.assertEqual(texto.decimal("4.17"), 4.17)
        self.assertEqual(texto.decimal("5.078"), 5.078)  # Sura escribe decimales con punto en algunos años
        self.assertEqual(texto.decimal("1.430,0", punto_solo_es_miles=True), 1430.0)
        self.assertEqual(texto.decimal("1430,0", punto_solo_es_miles=True), 1430.0)
        self.assertEqual(texto.decimal("1.430", punto_solo_es_miles=True), 1430.0)
        self.assertEqual(texto.decimal("-0,3"), -0.3)
        self.assertIsNone(texto.decimal("-"))

    def test_enteros(self):
        self.assertEqual(texto.entero("2.940.247"), 2940247)
        self.assertEqual(texto.entero("54,195"), 54195)
        self.assertEqual(texto.entero("59.805"), 59805)

    def test_decimales_reportados_y_tolerancia(self):
        self.assertEqual(texto.decimales_reportados("12,40"), 2)
        self.assertEqual(texto.decimales_reportados("9,1"), 1)
        self.assertEqual(texto.decimales_reportados("17"), 0)
        self.assertEqual(texto.decimales_reportados("1.430,0", True), 1)
        self.assertEqual(texto.tolerancia(2, 0.05), 0.05)
        self.assertAlmostEqual(texto.tolerancia(0, 0.05), 0.5, places=6)

    def test_nombres(self):
        self.assertEqual(texto.departamento("NARI�O"), "narino")
        self.assertEqual(texto.departamento("NARIÑO"), "narino")
        self.assertEqual(texto.departamento("DISTRITO CAPITAL"), "bogota")
        self.assertEqual(texto.departamento("Bogotá D.C."), "bogota")
        self.assertEqual(texto.especialidad("Consulta Cirugía General"), "cirugia_general")
        self.assertIsNone(texto.departamento("ZONAL CUNDINAMARCA"))


INDICE = """
<h2><strong>Oportunidad de citas Régimen Contributivo</strong></h2>
<table><tr><td><p><strong>2026</strong></p></td></tr>
<tr><td><a href="/files/2026-02/Enero_2026_Contributivo.pdf">Enero</a></td>
<td><a href="http://nuevaeps.com.co/files/2026-04/Marzo_2026_contributivo_0.pdf">Marzo</a></td></tr>
<tr><td><p><strong>2024</strong></p></td></tr>
<tr><td><a href="/files/R_1552_ENERO_CONTRIBUTIVO.pdf">Enero</a></td></tr></table>
<h2>Oportunidad de citas Régimen Subsidiado</h2>
<table><tr><td><strong>2025</strong></td></tr>
<tr><td><a href="/files/Diciembre_2025_subsidiado.pdf">Diciembre</a></td></tr></table>
<a href="/files/politica.pdf">Política de canales</a>
"""


class Descubrimiento(unittest.TestCase):
    def test_lee_regimen_anio_y_mes_desde_la_pagina(self):
        enlaces, avisos = descargar.enlaces_nueva_eps(INDICE, base="https://www.nuevaeps.com.co")
        self.assertEqual(avisos, [])
        self.assertEqual(
            [(e.regimen, e.year, e.month) for e in enlaces],
            [("contributivo", 2026, 1), ("contributivo", 2026, 3), ("contributivo", 2024, 1), ("subsidiado", 2025, 12)],
        )
        self.assertTrue(all(e.url.startswith("https://") for e in enlaces))
        self.assertEqual(enlaces[2].url, "https://www.nuevaeps.com.co/files/R_1552_ENERO_CONTRIBUTIVO.pdf")


NE = [
    "INFORMACIÓN AGOSTO-2026 - CONTRIBUTIVO",
    "CIRUGIA GENERAL 9.784 121.352 88.547 12,40 9,1 19,6 2,6 16,0 1,8 3.261",
    "PEDIATRIA 100 500 300 5,00 3,0 9,0 1,0 8,0 1,0 50",
    "CIRUGIA GENERAL ANTIOQUIA 9000 111352 80000 12,37 8,89 14,7 1,3 11,7 1,1 173",
    "CIRUGIA GENERAL VALLE DEL CAUCA 784 10000 8547 12,76 10,90 14,7 1,3 11,7 1,1 17",
    "Total CIRUGIA GENERAL 9784 121352 88547 12,4 9,1 19,6 2,6 16,0 1,8 3261",
    "PEDIATRIA NARI�O 60 300",  # fila partida en dos líneas
    "200 3,0 3,33 9,0 1,0 8,0 -0,3 30",
    "PEDIATRIA ZONAL CUNDINAMARCA 40 200 100 5,0 2,5 9,0 1,0 8,0 1,0 20",
]


def _ne(lineas, regimen="contributivo", year=2026, month=8):
    regs = construir.desde_nueva_eps(parser_nueva_eps.parsear(lineas), regimen, year, month, FUENTE)
    for r in regs:
        validar.calcular(r)
        validar.validar_registro(r)
    return validar.validar_conjunto(regs)


def _uno(regs, **k):
    out = [r for r in regs if all(r.get(c) == v for c, v in k.items())]
    assert len(out) == 1, (k, len(out))
    return out[0]


class ParserNuevaEps(unittest.TestCase):
    def test_nacional_departamentos_y_filas_partidas(self):
        regs = _ne(NE)
        nat = _uno(regs, specialty="cirugia_general", geo_level="national")
        self.assertEqual(nat["appointments_total"], 9784)
        self.assertNotIn("total_row_mismatch", nat["quality_flags"])
        self.assertEqual(_uno(regs, specialty="cirugia_general", department="valle_del_cauca")["appointments_total"], 784)
        narino = _uno(regs, specialty="pediatria", department="narino")
        self.assertEqual(narino["sum_days_desired"], 200)
        self.assertIn("negative_days:avg_of_min_desired", narino["quality_flags"])

    def test_departamento_desconocido_queda_sin_dato(self):
        r = _uno(_ne(NE), specialty="pediatria", geo_level="department", department=None)
        self.assertIn("unknown_department:ZONAL CUNDINAMARCA", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])

    def test_periodo_distinto_del_esperado_bloquea(self):
        r = _uno(_ne(NE, month=7), specialty="cirugia_general", geo_level="national")
        self.assertIn("period_mismatch:2026-08", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])

    def test_regimen_distinto_bloquea(self):
        r = _uno(_ne(NE, regimen="subsidiado"), specialty="cirugia_general", geo_level="national")
        self.assertIn("regimen_mismatch:contributivo", r["quality_flags"])

    def test_cambio_de_columnas_hace_fallar(self):
        cambiado = [l.rsplit(" ", 1)[0] for l in NE]  # todas las filas pierden la última columna
        with self.assertRaises(FormatoInesperado):
            parser_nueva_eps.parsear(cambiado)

    def test_una_fila_con_celdas_vacias_queda_sin_dato(self):
        lineas = NE + ["CIRUGIA GENERAL SAN ANDRES 54 178 160 3,3 3,0 15 1 18"]
        r = _uno(_ne(lineas), specialty="cirugia_general", department="san_andres")
        self.assertIn("column_count", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])

    def test_fila_duplicada(self):
        dup = NE + ["CIRUGIA GENERAL ANTIOQUIA 9000 111352 80000 12,37 8,89 14,7 1,3 11,7 1,1 173"]
        r = _uno(_ne(dup), specialty="cirugia_general", department="antioquia")
        self.assertIn("duplicate_row", r["quality_flags"])
        conflicto = NE + ["CIRUGIA GENERAL ANTIOQUIA 9001 111352 80000 12,37 8,89 14,7 1,3 11,7 1,1 173"]
        regs = [r for r in _ne(conflicto) if r["department"] == "antioquia"]
        self.assertTrue(all("duplicate_row_conflict" in r["quality_flags"] and r["avg_request_calc"] is None for r in regs))

    def test_restos_de_tabla_dinamica_se_ignoran(self):
        regs = _ne(NE + ["(en blanco) (en blanco) 0 0 0 0 0 0 0 0 0 0", "Total general 1 2 3 4 5 6 7 8 9 10"])
        self.assertFalse([r for r in regs if r["specialty"] is None])


def _base(**k):
    r = {c: None for c in construir.CAMPOS}
    r.update(eps="nueva_eps", regimen="contributivo", year=2026, month=8, specialty="pediatria",
             geo_level="national", quality_flags=[], appointments_total=100, sum_days_request=500,
             sum_days_desired=300, avg_request_reported=5.0, avg_desired_reported=3.0,
             _decimales={"avg_request_reported": 2, "avg_desired_reported": 1})
    r.update(k)
    validar.calcular(r)
    validar.validar_registro(r)
    return r


class Reglas(unittest.TestCase):
    def test_registro_correcto_sin_banderas(self):
        self.assertEqual(_base()["quality_flags"], [])

    def test_cero_citas_con_promedio(self):
        r = _base(appointments_total=0, sum_days_request=0, avg_request_reported=4.0)
        self.assertIn("zero_appointments_nonzero_avg", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])

    def test_calculado_distinto_de_reportado(self):
        r = _base(avg_request_reported=5.2)
        self.assertIn("avg_mismatch:request", r["quality_flags"])
        self.assertIsNone(r["avg_request_calc"])
        self.assertEqual(r["avg_desired_calc"], 3.0)  # la otra medida sigue publicándose

    def test_tolerancia_respeta_redondeo_de_la_fuente(self):
        # La fuente publicó el promedio sin decimales: 4,83 se reporta como 5.
        r = _base(sum_days_request=483, avg_request_reported=5.0, _decimales={"avg_request_reported": 0})
        self.assertNotIn("avg_mismatch:request", r["quality_flags"])
        r = _base(sum_days_request=483, avg_request_reported=5.0, _decimales={"avg_request_reported": 2})
        self.assertIn("avg_mismatch:request", r["quality_flags"])

    def test_promedio_alto_y_muestra_pequena(self):
        r = _base(appointments_total=20, sum_days_request=1300, avg_request_reported=65.0, sum_days_desired=None,
                  avg_desired_reported=None)
        self.assertIn("avg_over_60:avg_request_calc", r["quality_flags"])
        self.assertIn("small_sample", r["quality_flags"])
        self.assertEqual(r["avg_request_calc"], 65.0)  # advertencia: se publica con aviso

    def test_saltos_mes_a_mes(self):
        a = _base(month=7)
        b = _base(month=8, sum_days_request=1100, avg_request_reported=11.0)
        c = _base(month=10, sum_days_request=5000, avg_request_reported=50.0)  # no consecutivo
        validar.validar_conjunto([a, b, c])
        self.assertIn("jump_vs_prev_month:request", b["quality_flags"])
        self.assertNotIn("jump_vs_prev_month:request", c["quality_flags"])

    def test_severidades(self):
        self.assertEqual(validar.severidad("negative_days:x"), "bloqueante")
        self.assertEqual(validar.severidad("small_sample"), "advertencia")
        self.assertEqual(validar.severidad("context:pandemia_covid19"), "nota")


SURA = [
    "AÑO 2013",
    "SFAFS Sumatoria de la diferencia de días",
    "ENERO",
    "Consulta Odontología 197457 47245 4.17 0 4,55",
    "Consulta Pediatría 67018 10607 6.31 0 6,31",
    "FEBRERO",
    "Consulta Odontología 120566 34235 3.52 0 3,54",
    "Consulta Pediatría 25038 4457 5.61 0 5,61",
    "FEBRERO",  # página repetida idéntica
    "Consulta Odontología 120566 34235 3.52 0 3,54",
    "Consulta Pediatría 25038 4457 5.61 0 5,61",
    "MARZO 2013",
    "Consulta Odontología",
    "54.790 154.498 508.215 2,81 11,32",
    "0 2,99 70.363",
    "Consulta Pediatría 7584 36216 891 4,77 12,72 0 9..95 4.162",
]


class ParserSura(unittest.TestCase):
    def test_orden_de_columnas_por_bloque_y_pagina_repetida(self):
        res = parser_sura.parsear(SURA)
        self.assertEqual([(b.year, b.month, b.orden) for b in res.bloques],
                         [(2013, 1, "sfafs_primero"), (2013, 2, "sfafs_primero"), (2013, 3, "total_primero")])
        self.assertEqual(len(res.notas), 1)
        regs = construir.desde_sura(res, FUENTE)
        odo_ene = regs[0]
        self.assertEqual((odo_ene["appointments_total"], odo_ene["sum_days_request"]), (47245, 197457))
        ped_mar = regs[-1]
        self.assertEqual((ped_mar["appointments_total"], ped_mar["sum_days_request"]), (7584, 36216))
        self.assertIsNone(ped_mar["sum_days_desired"])

    def test_mes_faltante_bloquea(self):
        sin_febrero = SURA[:5] + SURA[11:]
        res = parser_sura.parsear(sin_febrero)
        self.assertTrue(res.bloques[1].problema.startswith("month_sequence"))

    def test_columnas_inesperadas(self):
        roto = SURA[:3] + [f"Consulta Odontología {i} 2 3" for i in range(10)]
        with self.assertRaises(FormatoInesperado):
            parser_sura.parsear(roto)


if __name__ == "__main__":
    unittest.main()
