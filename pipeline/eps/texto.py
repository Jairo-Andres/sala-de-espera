"""Normalización de nombres y lectura de números con separadores mezclados."""

import re
import unicodedata

from . import config


def normalizar(nombre: str) -> str:
    """Minúsculas, sin tildes, sin caracteres perdidos en la extracción y con espacios simples."""
    s = unicodedata.normalize("NFKD", nombre)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("�", "")  # carácter de reemplazo (p. ej. la Ñ que el PDF no codifica bien)
    s = re.sub(r"[^a-zA-Z0-9.\s]", " ", s).lower()
    return " ".join(s.split())


def especialidad(nombre: str):
    n = normalizar(re.sub(r"(?i)^consulta\s+", "", nombre))
    return config.ESPECIALIDADES.get(n)


_SIN_ESPACIOS = {k.replace(" ", ""): v for k, v in config.DEPARTAMENTOS.items()}


def departamento(nombre: str):
    n = normalizar(nombre)
    # Algunos PDF pegan las palabras ("VALLEDEL CAUCA", "NORTEDESANTANDER").
    return config.DEPARTAMENTOS.get(n) or _SIN_ESPACIOS.get(n.replace(" ", ""))


def fuera_de_alcance(nombre: str) -> bool:
    n = normalizar(re.sub(r"(?i)^consulta\s+", "", nombre))
    return any(n == e or n.startswith(e + " ") for e in config.ESPECIALIDADES_FUERA)


NUMERO = re.compile(r"^-?(\d+([.,]\d+)*)$")


def es_numero(tok: str) -> bool:
    return tok in ("-",) or bool(NUMERO.match(tok))


def es_numero_laxo(tok: str) -> bool:
    """Acepta erratas de la fuente como ``9..95`` para no partir la fila; esas celdas no se leen."""
    return bool(re.match(r"^-?\d[\d.,]*$", tok))


def entero(tok: str):
    """Conteos y sumas: cualquier separador es de miles."""
    if tok == "-":
        return None
    t = tok.replace(".", "").replace(",", "")
    return int(t)


def decimal(tok: str, punto_solo_es_miles: bool = False):
    """Promedios.

    - Con punto y coma a la vez, el último separador es el decimal (``1.430,0``).
    - Con un solo tipo de separador, es decimal (``12,40`` o ``4.17``), salvo que
      ``punto_solo_es_miles`` y el punto vaya seguido de exactamente tres dígitos
      (``1.430`` en una fuente que siempre escribe los decimales con coma).
    """
    if tok == "-":
        return None
    neg = tok.startswith("-")
    t = tok.lstrip("-")
    if "," in t and "." in t:
        dec = "," if t.rfind(",") > t.rfind(".") else "."
        miles = "." if dec == "," else ","
        t = t.replace(miles, "").replace(dec, ".")
    elif "," in t:
        partes = t.split(",")
        t = "".join(partes[:-1]) + "." + partes[-1]
    elif "." in t:
        partes = t.split(".")
        if punto_solo_es_miles and all(len(p) == 3 for p in partes[1:]):
            t = "".join(partes)
        else:
            t = "".join(partes[:-1]) + "." + partes[-1]
    v = float(t)
    return -v if neg else v


def decimales_reportados(tok: str, punto_solo_es_miles: bool = False) -> int:
    """Cuántos decimales trae un promedio tal como lo escribió la fuente (para la tolerancia)."""
    m = re.search(r"([.,])(\d+)$", tok)
    if not m:
        return 0
    sep, digitos = m.groups()
    if "," in tok and "." in tok and sep != ("," if tok.rfind(",") > tok.rfind(".") else "."):
        return 0
    if sep == "." and "," not in tok and punto_solo_es_miles and len(digitos) == 3:
        return 0
    return len(digitos)


def tolerancia(decimales: int, minima: float) -> float:
    """Diferencia admisible entre lo calculado y lo reportado: el redondeo de la fuente o la mínima."""
    return max(minima, 0.5 * 10 ** (-decimales) + 1e-9)
