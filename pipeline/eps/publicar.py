"""Archivo compacto que lee la interfaz (public/data/eps/sala-eps.json).

La interfaz nunca descarga nada de las EPS: solo lee este archivo ya validado.
"""

from collections import defaultdict

from . import config, validar

MESES_DEPARTAMENTOS = 12  # meses recientes con desglose por departamento


def _r(v, n=2):
    return None if v is None else round(v, n)


def _banderas(r):
    """Solo los códigos que la interfaz explica, con su severidad."""
    out = []
    for b in r["quality_flags"]:
        c = validar.codigo(b)
        detalle = b.split(":", 1)[1] if ":" in b else None
        out.append({"code": c, "detail": detalle, "severity": validar.severidad(b)})
    return out


def _punto(r):
    return {
        "ym": f"{r['year']}-{r['month']:02d}",
        "n": r["appointments_total"],
        "req": _r(r["avg_request_calc"]),
        "des": _r(r["avg_desired_calc"]),
        "req_rep": _r(r["avg_request_reported"]),
        "flags": _banderas(r),
        "src": r["source_url"],
    }


def sala(registros, estado):
    series = defaultdict(list)
    deptos = defaultdict(list)
    for r in registros:
        if not r["specialty"]:
            continue
        clave = f"{r['eps']}|{r['regimen'] or ''}|{r['specialty']}"
        if r["geo_level"] == "national":
            series[clave].append(r)
        elif r["geo_level"] == "department":
            deptos[clave].append(r)

    salida_series, turnos = {}, []
    for clave, regs in sorted(series.items()):
        regs.sort(key=lambda r: (r["year"], r["month"]))
        salida_series[clave] = [_punto(r) for r in regs]
        eps, regimen, esp = clave.split("|")
        ultimo = regs[-1]
        turnos.append({"key": clave, "eps": eps, "regimen": regimen or None, "specialty": esp,
                       "standard": config.ESTANDARES.get(esp), **_punto(ultimo)})

    salida_deptos = {}
    for clave, regs in sorted(deptos.items()):
        meses = sorted({(r["year"], r["month"]) for r in regs})[-MESES_DEPARTAMENTOS:]
        por_mes = defaultdict(list)
        for r in regs:
            if (r["year"], r["month"]) in meses:
                p = _punto(r)
                p.pop("src")
                p["dept"] = r["department"]
                por_mes[p["ym"]].append(p)
        salida_deptos[clave] = {ym: sorted(v, key=lambda p: p["dept"] or "") for ym, v in sorted(por_mes.items())}

    calidad = {}
    for eps, e in estado["eps"].items():
        calidad[eps] = {
            "name": e["name"],
            "ok": e["ok"],
            "responded": e["responded"],
            "checked_at": e["checked_at"],
            "error": e["error"],
            "failing_since": e["failing_since"],
            "first_month": e.get("first_month"),
            "last_month": e.get("last_month"),
            "missing_months": e.get("missing_months"),
            "files_total": e.get("files_total"),
            "files_failed": [{k: f.get(k) for k in ("regimen", "period", "status", "url")} for f in e["files_failed"]],
            "source": e.get("index_url") or e.get("pdf_url"),
            "notes": e.get("parser_notes", []),
        }
    conteo = defaultdict(lambda: {"bloqueante": 0, "advertencia": 0, "nota": 0})
    por_codigo = defaultdict(int)
    for r in registros:
        for b in r["quality_flags"]:
            conteo[r["eps"]][validar.severidad(b)] += 1
            por_codigo[(r["eps"], validar.codigo(b), validar.severidad(b))] += 1

    return {
        "generated_at": estado["generated_at"],
        "parser_version": estado["parser_version"],
        "standards": config.ESTANDARES,
        "turnos": turnos,
        "series": salida_series,
        "departments": salida_deptos,
        "quality": {
            "sources": calidad,
            "flag_counts": conteo,
            "by_code": [{"eps": e, "code": c, "severity": s, "count": n} for (e, c, s), n in sorted(por_codigo.items())],
        },
    }
