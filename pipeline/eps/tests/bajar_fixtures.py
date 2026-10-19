"""Descarga los PDF de prueba (con el mismo User-Agent y pausas del pipeline) y verifica su hash.

    python -m pipeline.eps.tests.bajar_fixtures
"""

import hashlib
import json
import sys
from pathlib import Path

from pipeline.eps import descargar

DIR = Path(__file__).parent / "fixtures"


def main():
    meta = json.loads((DIR / "fixtures.json").read_text(encoding="utf-8"))["archivos"]
    distintos = 0
    for nombre, info in meta.items():
        destino = DIR / nombre
        if not destino.exists():
            destino.write_bytes(descargar.obtener(info["url"]))
        sha = hashlib.sha256(destino.read_bytes()).hexdigest()
        if sha != info["sha256"]:
            distintos += 1
            aviso = "se sobrescribe cada mes" if info.get("se_sobrescribe") else "posible reemisión"
            print(f"AVISO {nombre}: hash distinto del observado el 2026-10-18 ({aviso}): {sha}")
        else:
            print(f"OK {nombre}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
