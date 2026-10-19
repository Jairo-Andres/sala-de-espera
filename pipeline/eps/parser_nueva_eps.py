"""Parser de los PDF mensuales de Nueva EPS (Resolución 1552 de 2013).

Cada PDF trae un resumen nacional por especialidad y luego una fila por especialidad y
departamento, con una fila ``Total <ESPECIALIDAD>``. Siempre 10 columnas numéricas:

 1 total citas | 2 Σ días desde la solicitud | 3 Σ días desde la fecha deseada
 4 promedio desde la solicitud | 5 promedio desde la fecha deseada
 6.1.1 / 6.1.2 promedio de máximos / de mínimos (desde la solicitud)
 6.2.1 / 6.2.2 promedio de máximos / de mínimos (desde la fecha deseada)
 7 horas de especialista
"""

import re
from dataclasses import dataclass, field

from . import config, texto
from .extraer import cola_numerica, es_solo_numeros

N_COLUMNAS = 10


class FormatoInesperado(Exception):
    """El PDF no tiene la estructura esperada: no se publica nada de este archivo."""


@dataclass
class Fila:
    specialty: str | None
    specialty_raw: str
    department: str | None
    department_raw: str
    geo_level: str  # national | department
    origen: str  # resumen | total | departamento
    valores: dict
    decimales: dict
    incompleta: bool = False  # la fila trae celdas vacías: no se puede saber qué columna falta


@dataclass
class ResultadoPdf:
    filas: list = field(default_factory=list)
    periodos_en_texto: set = field(default_factory=set)
    regimenes_en_texto: set = field(default_factory=set)


def _valores(toks: list[str]) -> tuple[dict, dict]:
    ent = texto.entero
    dec = lambda t: texto.decimal(t, punto_solo_es_miles=True)  # noqa: E731
    # Las sumas de días a veces traen decimales (366986,06 en 2015): se leen como decimales.
    v = {
        "appointments_total": dec(toks[0]),  # 2020 trae citas con decimales (420613,91)
        "sum_days_request": dec(toks[1]),
        "sum_days_desired": dec(toks[2]),
        "avg_request_reported": dec(toks[3]),
        "avg_desired_reported": dec(toks[4]),
        "avg_of_max_request": dec(toks[5]),
        "avg_of_min_request": dec(toks[6]),
        "avg_of_max_desired": dec(toks[7]),
        "avg_of_min_desired": dec(toks[8]),
        "specialist_hours": dec(toks[9]),
    }
    d = {
        "avg_request_reported": texto.decimales_reportados(toks[3], True),
        "avg_desired_reported": texto.decimales_reportados(toks[4], True),
    }
    return v, d


def _separar_especialidad(prefijo: list[str]):
    """'MEDICINA GENERAL VALLE DEL CAUCA' -> ('medicina_general', 'MEDICINA GENERAL', 'VALLE DEL CAUCA')."""
    if prefijo and re.match(r"^\d+\.$", prefijo[0]):
        prefijo = prefijo[1:]  # 2016: "6. OBSTETRICIA"
    for n in (3, 2, 1):
        if len(prefijo) >= n:
            esp = texto.especialidad(" ".join(prefijo[:n]))
            if esp:
                return esp, " ".join(prefijo[:n]), " ".join(prefijo[n:])
    return None, " ".join(prefijo), ""


_PERIODO = re.compile(r"(%s)[\s\-_/]*(?:DE\s+|DEL\s+)?(20\d\d)" % "|".join(config.MESES))


def parsear(lineas: list[str]) -> ResultadoPdf:
    res = ResultadoPdf()
    todo = texto.normalizar(" ".join(lineas)).upper()
    for m in _PERIODO.finditer(todo):
        res.periodos_en_texto.add((int(m.group(2)), config.MESES.index(m.group(1)) + 1))
    for r in ("CONTRIBUTIVO", "SUBSIDIADO"):
        if r in todo:
            res.regimenes_en_texto.add(r.lower())

    malas = []
    esp_actual = None  # 2016: la especialidad va en su propia línea y debajo las filas por departamento
    i = 0
    en_resumen = True  # las filas nacionales sin departamento antes del primer departamento
    while i < len(lineas):
        toks = lineas[i].split()
        i += 1
        n = cola_numerica(toks)
        if n == 0:
            sola = texto.especialidad(re.sub(r"^\d+\.\s*", "", lineas[i - 1]))
            if sola:
                esp_actual = sola
            continue
        if n == len(toks):
            continue
        prefijo = toks[:-n]
        es_total = prefijo[0].lower() == "total"
        if es_total:
            prefijo = prefijo[1:]
        resto = texto.normalizar(" ".join(prefijo))
        if "en blanco" in resto or (es_total and resto == "general"):
            continue  # restos de la tabla dinámica: filas vacías y el total de todas las especialidades
        if texto.fuera_de_alcance(" ".join(prefijo)):
            continue
        esp, esp_raw, dep_raw = _separar_especialidad(prefijo)
        if esp is None and not es_total and esp_actual and texto.departamento(" ".join(prefijo)):
            esp, esp_raw, dep_raw = esp_actual, "", " ".join(prefijo)
        if esp:
            esp_actual = esp
        if esp is None and not (es_total or n >= N_COLUMNAS):
            continue  # encabezados y texto suelto
        nums = toks[-n:]
        # Filas partidas en varias líneas: se agregan las líneas siguientes que solo traen números.
        while len(nums) < N_COLUMNAS and i < len(lineas) and es_solo_numeros(lineas[i]):
            nums += lineas[i].split()
            i += 1
        incompleta = len(nums) != N_COLUMNAS
        if incompleta:
            malas.append(f"'{' '.join(toks[:-n])}' ({len(nums)} columnas)")
            valores, decimales = {}, {}
        else:
            valores, decimales = _valores(nums)
        if es_total:
            dep_raw = ""  # algunas versiones pegan el primer departamento a la fila Total
            origen, nivel = "total", "national"
        elif dep_raw:
            origen, nivel = "departamento", "department"
            en_resumen = False
        else:
            origen, nivel = ("resumen" if en_resumen else "total"), "national"
        res.filas.append(Fila(
            specialty=esp,
            specialty_raw=esp_raw,
            department=texto.departamento(dep_raw) if dep_raw else None,
            department_raw=dep_raw,
            geo_level=nivel,
            origen=origen,
            valores=valores,
            decimales=decimales,
            incompleta=incompleta,
        ))
    if not res.filas:
        raise FormatoInesperado("No se encontró ninguna fila de datos")
    # Filas con celdas vacías (pasa en varios meses históricos) quedan "sin dato" una por una.
    # Si son la mayoría, lo más probable es que cambió el formato: no se publica nada del archivo.
    if len(malas) > 0.5 * len(res.filas):
        raise FormatoInesperado(
            f"{len(malas)} de {len(res.filas)} filas no tienen las {N_COLUMNAS} columnas esperadas: " + "; ".join(malas[:5])
        )
    return res
