"""PDF -> líneas de texto.

Se usa ``pdftotext -raw`` (Poppler) porque respeta el orden de las filas y no parte números
(pypdf separa a veces "2189" en "218 9" o "0,8" en "0, 8" en los PDF de 2015-2016 y 2021).
pypdf queda solo como respaldo si Poppler no está instalado.
"""

import io
import os
import shutil
import subprocess
import tempfile

from . import texto


def _con_pdftotext(contenido: bytes) -> str:
    fd, ruta = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(contenido)
        r = subprocess.run(["pdftotext", "-raw", "-enc", "UTF-8", ruta, "-"], capture_output=True, check=True)
        return r.stdout.decode("utf-8", "replace")
    finally:
        os.unlink(ruta)


def _con_pypdf(contenido: bytes) -> str:
    from pypdf import PdfReader

    lector = PdfReader(io.BytesIO(contenido))
    return "\n".join((p.extract_text() or "") for p in lector.pages)


def motor() -> str:
    return "pdftotext" if shutil.which("pdftotext") else "pypdf"


def lineas_pdf(contenido: bytes) -> list[str]:
    crudo = _con_pdftotext(contenido) if motor() == "pdftotext" else _con_pypdf(contenido)
    return [" ".join(l.split()) for l in crudo.replace("\f", "\n").split("\n") if l.strip()]


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
