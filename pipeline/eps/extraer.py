"""PDF -> líneas de texto (pypdf), con las filas partidas en varias líneas vueltas a unir."""

import io

from pypdf import PdfReader

from . import texto


def lineas_pdf(contenido: bytes) -> list[str]:
    lector = PdfReader(io.BytesIO(contenido))
    crudo = "\n".join((p.extract_text() or "") for p in lector.pages)
    return [" ".join(l.split()) for l in crudo.split("\n") if l.strip()]


def es_solo_numeros(linea: str) -> bool:
    toks = linea.split()
    return bool(toks) and all(texto.es_numero(t) for t in toks)


def cola_numerica(tokens: list[str]) -> int:
    """Cuántos tokens numéricos hay al final de la línea."""
    n = 0
    for t in reversed(tokens):
        if not texto.es_numero(t):
            break
        n += 1
    return n
