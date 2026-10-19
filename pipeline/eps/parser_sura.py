"""Parser del PDF acumulado de EPS Sura (enero de 2013 en adelante, nivel nacional).

El PDF trae primero tablas resumen (especialidad × mes) y luego, desde el glosario
("SFAFS Sumatoria..."), una tabla detallada por mes. Solo se usa la detallada.

Columnas de la tabla detallada:
- 2013–2015 (5): total y SFAFS (en orden variable), PFAFS, MINDA, MAXDA.
- 2016 en adelante (8): total y SFAFS (en orden variable), SFAFU, PFAFS, PFAFU, MINDA, MAXDA, horas.

El encabezado del PDF dice "TOTAL CITAS, SFAFS" en todos los años, pero en varios años los
datos vienen al revés. Por eso el orden se decide por bloque (mes) con la aritmética:
PFAFS = SFAFS / total. Si ninguna de las dos lecturas cuadra, el dato queda "sin dato".

Solo se usa PFAFS: la propia fuente no cumple PFAFU = SFAFU / total y su MAXDA coincide
con PFAFS, así que la espera desde la fecha deseada y el máximo/mínimo no son confiables.
"""

import re
from dataclasses import dataclass, field

from . import config, texto
from .parser_nueva_eps import FormatoInesperado

_MES = re.compile(r"^(%s)\s?(20\d\d)?$" % "|".join(config.MESES))
_ANIO_RESUMEN = re.compile(r"^A\S{0,2}O\s+(20\d\d)$")  # "AÑO 2013" (la Ñ puede perderse)


@dataclass
class FilaSura:
    specialty: str | None
    specialty_raw: str
    tokens: list
    valores: dict = field(default_factory=dict)
    decimales: dict = field(default_factory=dict)
    problema: str | None = None


@dataclass
class Bloque:
    etiqueta: str
    month: int
    year_explicito: int | None
    filas: list = field(default_factory=list)
    year: int | None = None
    orden: str | None = None  # "total_primero" | "sfafs_primero"
    problema: str | None = None


@dataclass
class ResultadoSura:
    bloques: list
    notas: list


def _leer_filas(lineas: list[str]):
    inicio = next((i for i, l in enumerate(lineas) if l.startswith("SFAFS Sumatoria")), None)
    if inicio is None:
        raise FormatoInesperado("No se encontró la sección detallada (glosario 'SFAFS Sumatoria...')")
    primer_anio = next(
        (int(m.group(1)) for l in lineas[:inicio] if (m := _ANIO_RESUMEN.match(l))), None
    )
    bloques: list[Bloque] = []
    fila = None
    for l in lineas[inicio:]:
        m = _MES.match(l)
        if m:
            fila = None
            bloques.append(Bloque(l, config.MESES.index(m.group(1)) + 1, int(m.group(2)) if m.group(2) else None))
            continue
        if l.startswith("Consulta "):
            if not bloques:
                raise FormatoInesperado("Fila de datos antes de la primera etiqueta de mes")
            toks = l.split()
            n = 0
            while n < len(toks) and texto.es_numero_laxo(toks[-1 - n]):
                n += 1
            nombre = " ".join(toks[: len(toks) - n])
            fila = FilaSura(texto.especialidad(nombre), nombre, toks[len(toks) - n:])
            bloques[-1].filas.append(fila)
            continue
        toks = l.split()
        if fila is not None and toks and all(texto.es_numero_laxo(t) for t in toks):
            fila.tokens += toks
        else:
            fila = None
    return bloques, primer_anio


def _valores_fila(f: FilaSura):
    t = f.tokens
    if len(t) == 5:
        a, b, pfafs = t[0], t[1], t[2]
        sfafu = pfafu = horas = None
    elif len(t) == 8:
        a, b, sfafu, pfafs, pfafu, horas = t[0], t[1], t[2], t[3], t[4], t[7]
    else:
        f.problema = f"column_count:{len(t)}"
        return
    usadas = [a, b, pfafs] + [x for x in (sfafu, pfafu, horas) if x]
    if not all(texto.es_numero(x) for x in usadas):
        f.problema = "unreadable_number"
        return
    f.valores = {
        "a": texto.entero(a),
        "b": texto.entero(b),
        "sum_days_desired_reported": texto.entero(sfafu) if sfafu else None,
        "avg_request_reported": texto.decimal(pfafs),
        "avg_desired_reported": texto.decimal(pfafu) if pfafu else None,
        # Horas: entero con separador de miles (70.363).
        "specialist_hours": texto.entero(horas) if horas else None,
    }
    f.decimales = {"avg_request_reported": texto.decimales_reportados(pfafs)}


def _cuadra(suma, total, reportado, decimales) -> bool:
    if not total or reportado is None:
        return False
    return abs(suma / total - reportado) <= texto.tolerancia(decimales, config.TOLERANCIA_PROMEDIO)


def _decidir_orden(b: Bloque):
    votos = {"total_primero": 0, "sfafs_primero": 0}
    for f in b.filas:
        if f.problema:
            continue
        v, d = f.valores, f.decimales["avg_request_reported"]
        tp = _cuadra(v["b"], v["a"], v["avg_request_reported"], d)
        sp = _cuadra(v["a"], v["b"], v["avg_request_reported"], d)
        if tp and not sp:
            votos["total_primero"] += 1
        elif sp and not tp:
            votos["sfafs_primero"] += 1
    if votos["total_primero"] == votos["sfafs_primero"] == 0:
        b.problema = "column_order_unresolved"
        return
    if votos["total_primero"] and votos["sfafs_primero"]:
        b.problema = "column_order_mixed"
        return
    b.orden = max(votos, key=votos.get)


def _firma(b: Bloque):
    return tuple(tuple(f.tokens) for f in b.filas)


def parsear(lineas: list[str]) -> ResultadoSura:
    bloques, primer_anio = _leer_filas(lineas)
    notas = []
    if not bloques:
        raise FormatoInesperado("No se encontraron bloques mensuales")

    # 1) Páginas repetidas idénticas (p. ej. marzo–mayo de 2019 aparece dos veces).
    vistos, unicos = {}, []
    for i, b in enumerate(bloques):
        firma = (b.etiqueta.split()[0], _firma(b))
        if firma in vistos:
            notas.append(f"Bloque '{b.etiqueta}' repetido de forma idéntica en el PDF; se usa una sola vez")
            continue
        vistos[firma] = i
        unicos.append(b)
    bloques = unicos

    # 2) Año de cada bloque: explícito en la etiqueta desde 2022, inferido por la secuencia antes.
    anio = bloques[0].year_explicito or primer_anio
    if anio is None:
        raise FormatoInesperado("No se pudo establecer el año del primer bloque")
    previo = None
    for b in bloques:
        if previo is not None:
            esperado_mes = previo.month % 12 + 1
            esperado_anio = previo.year + (1 if previo.month == 12 else 0)
            if b.month != esperado_mes:
                b.problema = b.problema or f"month_sequence:esperado {esperado_mes:02d}/{esperado_anio}"
            anio = esperado_anio if b.month == esperado_mes else (
                previo.year + (1 if b.month < previo.month else 0)
            )
        if b.year_explicito and b.year_explicito != anio:
            notas.append(f"Bloque '{b.etiqueta}': año inferido {anio} distinto del rótulo; se usa el rótulo")
            anio = b.year_explicito
        b.year = anio
        previo = b

    # 3) Columnas y orden total/SFAFS por bloque.
    malas = 0
    for b in bloques:
        for f in b.filas:
            _valores_fila(f)
            malas += bool(f.problema)
        _decidir_orden(b)
    total_filas = sum(len(b.filas) for b in bloques)
    if malas > max(3, 0.05 * total_filas):
        raise FormatoInesperado(f"{malas} filas de Sura no tienen 5 ni 8 columnas numéricas")
    return ResultadoSura(bloques, notas)
