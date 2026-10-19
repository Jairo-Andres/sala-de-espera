"""De resultados de parseo a registros tidy (sección 7 del brief)."""

from . import config
from .parser_nueva_eps import ResultadoPdf
from .parser_sura import ResultadoSura

CAMPOS = [
    "eps", "regimen", "year", "month", "specialty", "geo_level",
    "department", "city", "ips_nit", "ips_name",
    "appointments_total", "sum_days_request", "sum_days_desired",
    "avg_request_calc", "avg_desired_calc", "avg_request_reported", "avg_desired_reported",
    "avg_of_max_request", "avg_of_min_request", "avg_of_max_desired", "avg_of_min_desired",
    "specialist_hours",
    "source_url", "source_sha256", "retrieved_at", "parser_version",
    "quality_flags",
]


def _base(eps, regimen, year, month, fuente):
    r = {c: None for c in CAMPOS}
    r.update(
        eps=eps, regimen=regimen, year=year, month=month,
        source_url=fuente["url"], source_sha256=fuente["sha256"],
        retrieved_at=fuente["retrieved_at"], parser_version=config.PARSER_VERSION,
        quality_flags=[],
    )
    return r


def _cerca(a, b, tol=0.051):
    return a is None or b is None or abs(a - b) <= tol


def desde_nueva_eps(res: ResultadoPdf, regimen, year, month, fuente):
    regs = []
    banderas_archivo = []
    if res.periodos_en_texto and (year, month) not in res.periodos_en_texto:
        banderas_archivo.append(
            "period_mismatch:" + ",".join(f"{y}-{m:02d}" for y, m in sorted(res.periodos_en_texto))
        )
    if res.regimenes_en_texto and regimen not in res.regimenes_en_texto:
        banderas_archivo.append("regimen_mismatch:" + ",".join(sorted(res.regimenes_en_texto)))

    resumen = {f.specialty: f for f in res.filas if f.origen == "resumen"}
    totales = {f.specialty: f for f in res.filas if f.origen == "total"}
    vistos = {}
    for f in res.filas:
        # Nacional: el resumen inicial (más decimales); la fila "Total" sirve de contraste.
        if f.origen == "total" and f.specialty in resumen:
            continue
        r = _base("nueva_eps", regimen, year, month, fuente)
        r.update(specialty=f.specialty, geo_level=f.geo_level, department=f.department)
        r["quality_flags"] += banderas_archivo
        if f.incompleta:
            r["quality_flags"].append("column_count")
        else:
            r.update(f.valores)
            r["_decimales"] = f.decimales
        if f.specialty is None:
            r["quality_flags"].append(f"unknown_specialty:{f.specialty_raw}")
        if f.geo_level == "department" and f.department is None:
            r["quality_flags"].append(f"unknown_department:{f.department_raw}")
        if f.origen == "resumen" and f.specialty in totales and not f.incompleta:
            t = totales[f.specialty]
            ok = (t.valores.get("appointments_total") == f.valores["appointments_total"]
                  and t.valores.get("sum_days_request") == f.valores["sum_days_request"]
                  and _cerca(t.valores.get("avg_request_reported"), f.valores["avg_request_reported"]))
            if not t.incompleta and not ok:
                r["quality_flags"].append("total_row_mismatch")
        clave = (f.specialty, f.geo_level, f.department or f.department_raw)
        if clave in vistos:
            previo = vistos[clave]
            mismos = all(previo.get(k) == r.get(k) for k in ("appointments_total", "sum_days_request", "sum_days_desired"))
            if mismos:
                previo["quality_flags"].append("duplicate_row")
                continue
            previo["quality_flags"].append("duplicate_row_conflict")
            r["quality_flags"].append("duplicate_row_conflict")
        vistos[clave] = r
        regs.append(r)
    return regs


def desde_sura(res: ResultadoSura, fuente):
    regs = []
    for b in res.bloques:
        for f in b.filas:
            r = _base("sura", None, b.year, b.month, fuente)
            r.update(specialty=f.specialty, geo_level="national")
            if f.specialty is None:
                r["quality_flags"].append(f"unknown_specialty:{f.specialty_raw}")
            if b.problema:
                r["quality_flags"].append(b.problema)
            if f.problema:
                r["quality_flags"].append(f.problema)
            elif not b.problema:
                v = f.valores
                total, sfafs = (v["a"], v["b"]) if b.orden == "total_primero" else (v["b"], v["a"])
                r.update(
                    appointments_total=total,
                    sum_days_request=sfafs,
                    sum_days_desired=None,  # SFAFU no cuadra con PFAFU en la fuente: no confiable
                    avg_request_reported=v["avg_request_reported"],
                    avg_desired_reported=v["avg_desired_reported"],
                    specialist_hours=v["specialist_hours"],
                )
                r["_decimales"] = f.decimales
                if v["avg_desired_reported"] is not None:
                    r["quality_flags"].append("desired_unreliable_source")
            regs.append(r)
        # Bloque con menos de 7 especialidades: lo registra el estado de fuentes.
    return regs
