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


def desde_salud_total(res, year, month, fuente):
    """Registros por IPS (solo PBS y las especialidades de la sala) y agregados departamental y
    nacional por régimen. El agregado usa solo filas que pasaron las reglas bloqueantes y dice qué
    parte de las citas quedó fuera."""
    from . import validar

    banderas_archivo = []
    if res.periodos_en_texto and (year, month) not in res.periodos_en_texto:
        banderas_archivo.append(
            "period_mismatch:" + ",".join(f"{y}-{m:02d}" for y, m in sorted(res.periodos_en_texto))
        )
    ips, vistos = [], {}
    for f in res.filas:
        if f.specialty is None or f.producto != "PBS" or f.regimen not in ("contributivo", "subsidiado"):
            continue  # otras especialidades, el plan complementario (PAC) y filas sin régimen ("-") no entran
        r = _base("salud_total", f.regimen, year, month, fuente)
        r.update(specialty=f.specialty, geo_level="ips", department=f.department, city=f.city,
                 ips_nit=f.ips_nit, ips_name=f.ips_name)
        r.update({k: v for k, v in f.valores.items() if k in CAMPOS})
        r["_decimales"] = f.decimales
        r["quality_flags"] += banderas_archivo
        if f.department is None:
            r["quality_flags"].append(f"unknown_department:{f.lugar_raw}")
        # La misma IPS y servicio puede aparecer en varias filas con valores distintos (sedes o redes
        # distintas): se suman. Solo una fila idéntica en todo se trata como duplicada y se usa una vez.
        clave = (f.ips_nit, f.regimen, f.cups, f.department, f.city, tuple(f.valores.values()))
        if clave in vistos:
            validar._agregar(vistos[clave], "duplicate_row")
            continue
        vistos[clave] = r
        validar.calcular(r)
        validar.validar_registro(r)
        # Un promedio por debajo del mínimo o por encima del máximo de la misma fila es imposible. Como el
        # promedio sí cuadra con sus sumas (regla avg_mismatch), lo dudoso es el mínimo/máximo: advertencia.
        prom, mn, mx = f.valores["avg_request_reported"], f.valores["min_days"], f.valores["max_days"]
        if None not in (mn, mx):
            mn, mx = min(mn, mx), max(mn, mx)  # algunas filas traen mínimo y máximo invertidos
        if r["avg_request_calc"] is not None and None not in (prom, mn, mx) and (prom < mn - 0.005 or prom > mx + 0.005):
            validar._agregar(r, f"avg_outside_min_max:{mn:g}-{mx:g}")
        # Un máximo mayor que la suma de todos los días tampoco es posible (p. ej. máximo 77 con suma 0).
        suma = f.valores["sum_days_request"]
        if mx is not None and suma is not None and mx > suma + 0.5:
            validar._agregar(r, f"avg_outside_min_max:max {mx:g} > suma {suma:g}")
        r.pop("_decimales", None)
        r["_validado"] = True
        ips.append(r)

    # Agregados: Σ días / Σ citas sobre las filas válidas.
    from collections import defaultdict

    grupos = defaultdict(list)
    for r in ips:
        grupos[(r["regimen"], r["specialty"], "national", None)].append(r)
        if r["department"]:
            grupos[(r["regimen"], r["specialty"], "department", r["department"])].append(r)
    agregados = []
    for (regimen, esp, nivel, dep), regs in grupos.items():
        validas = [r for r in regs if r["avg_request_calc"] is not None]
        total = sum(r["appointments_total"] or 0 for r in regs)
        n = sum(r["appointments_total"] for r in validas)
        a = _base("salud_total", regimen, year, month, fuente)
        a.update(specialty=esp, geo_level=nivel, department=dep, appointments_total=n,
                 sum_days_request=sum(r["sum_days_request"] for r in validas),
                 sum_days_desired=sum(r["sum_days_desired"] for r in validas if r["avg_desired_calc"] is not None),
                 specialist_hours=None)
        a["quality_flags"] += banderas_archivo
        validar.calcular(a)
        if total and n < total:
            excluidas = (total - n) / total * 100
            validar._agregar(a, f"partial_aggregate:{excluidas:.1f}")
        if n and n < config.UMBRAL_MUESTRA_PEQUENA:
            validar._agregar(a, "small_sample")
        if a["avg_request_calc"] is None and total:
            validar._agregar(a, "no_valid_rows")
        a["_validado"] = True
        agregados.append(a)
    return ips + agregados
