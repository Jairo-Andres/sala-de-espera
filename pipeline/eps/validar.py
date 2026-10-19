"""Reglas de calidad. Si falla una regla bloqueante, el valor afectado queda en blanco ("sin dato")
y el registro lleva la bandera con el motivo; nada se corrige en silencio.

Banderas: ``codigo`` o ``codigo:detalle``. La severidad depende solo del código.
"""

from collections import defaultdict

from . import config, texto

BLOQUEANTES = {
    "negative_days",
    "zero_appointments_nonzero_avg",
    "no_appointments",
    "avg_mismatch",
    "column_count",
    "column_order_unresolved",
    "column_order_mixed",
    "unreadable_number",
    "unknown_specialty",
    "unknown_department",
    "month_sequence",
    "duplicate_period",
    "duplicate_row_conflict",
    "period_mismatch",
    "regimen_mismatch",
    "duplicate_source_file",
}
ADVERTENCIAS = {
    "avg_over_60",
    "small_sample",
    "jump_vs_prev_month",
    "volume_jump",
    "duplicate_row",
    "regional_outlier",
    "national_sum_mismatch",
    "total_row_mismatch",
    "desired_unreliable_source",
    "fractional_appointments",
}
NOTAS = {"context"}

# Banderas que solo se pueden saber al leer el PDF (se conservan al recargar el CSV).
DE_PARSEO = {
    "column_count", "column_order_unresolved", "column_order_mixed", "unreadable_number",
    "unknown_specialty", "unknown_department", "month_sequence", "period_mismatch",
    "regimen_mismatch", "duplicate_source_file", "duplicate_row", "duplicate_row_conflict",
    "total_row_mismatch", "desired_unreliable_source",
}

# Qué valores calculados anula cada bandera bloqueante.
TODOS = ("avg_request_calc", "avg_desired_calc", "avg_of_max_request", "avg_of_min_request",
         "avg_of_max_desired", "avg_of_min_desired")


def codigo(bandera: str) -> str:
    return bandera.split(":", 1)[0]


def severidad(bandera: str) -> str:
    c = codigo(bandera)
    if c in BLOQUEANTES:
        return "bloqueante"
    if c in ADVERTENCIAS:
        return "advertencia"
    return "nota"


def _agregar(r, bandera):
    if bandera not in r["quality_flags"]:
        r["quality_flags"].append(bandera)


def _anular(r, campos):
    for c in campos:
        r[c] = None


def calcular(r):
    """Promedios calculados desde las sumas (nunca se copian del PDF)."""
    n = r["appointments_total"]
    r["avg_request_calc"] = (r["sum_days_request"] / n) if n and r["sum_days_request"] is not None else None
    r["avg_desired_calc"] = (r["sum_days_desired"] / n) if n and r["sum_days_desired"] is not None else None


def validar_registro(r):
    """Reglas que solo miran el propio registro."""
    if any(codigo(b) in {"column_count", "column_order_unresolved", "column_order_mixed",
                         "unreadable_number", "unknown_specialty", "unknown_department",
                         "month_sequence", "period_mismatch", "regimen_mismatch",
                         "duplicate_source_file", "duplicate_row_conflict", "duplicate_period"}
           for b in r["quality_flags"]):
        _anular(r, TODOS)
        return

    n = r["appointments_total"]
    # Días negativos
    pares = [
        ("sum_days_request", ("avg_request_calc",)),
        ("avg_request_reported", ("avg_request_calc",)),
        ("sum_days_desired", ("avg_desired_calc",)),
        ("avg_desired_reported", ("avg_desired_calc",)),
        ("avg_of_max_request", ("avg_of_max_request",)),
        ("avg_of_min_request", ("avg_of_min_request",)),
        ("avg_of_max_desired", ("avg_of_max_desired",)),
        ("avg_of_min_desired", ("avg_of_min_desired",)),
    ]
    for campo, anula in pares:
        v = r.get(campo)
        if v is not None and v < 0:
            _agregar(r, f"negative_days:{campo}")
            _anular(r, anula)

    # Cero citas con promedio distinto de cero
    if n == 0:
        if any((r.get(c) or 0) != 0 for c in ("avg_request_reported", "avg_desired_reported",
                                               "sum_days_request", "sum_days_desired")):
            _agregar(r, "zero_appointments_nonzero_avg")
        else:
            _agregar(r, "no_appointments")  # sin citas no hay promedio: "sin dato" con su motivo
        _anular(r, TODOS)
        return

    # Calculado frente a reportado (la tolerancia respeta el redondeo con que publicó la fuente)
    for medida in ("request", "desired"):
        calc, rep = r.get(f"avg_{medida}_calc"), r.get(f"avg_{medida}_reported")
        if calc is None or rep is None:
            continue
        dec = (r.get("_decimales") or {}).get(f"avg_{medida}_reported", 2)
        if abs(calc - rep) > texto.tolerancia(dec, config.TOLERANCIA_PROMEDIO):
            _agregar(r, f"avg_mismatch:{medida}")
            r[f"avg_{medida}_calc"] = None

    # Advertencias
    for campo in ("avg_request_calc", "avg_desired_calc", "avg_of_max_request", "avg_of_max_desired"):
        v = r.get(campo)
        if v is not None and v > config.UMBRAL_PROMEDIO_ALTO:
            _agregar(r, f"avg_over_60:{campo}")
    if n is not None and n != int(n):
        _agregar(r, "fractional_appointments")
    if n is not None and n < config.UMBRAL_MUESTRA_PEQUENA:
        _agregar(r, "small_sample")


def _clave_serie(r):
    return (r["eps"], r["regimen"], r["specialty"], r["geo_level"], r["department"])


def validar_conjunto(registros):
    """Reglas que comparan registros entre sí: saltos mes a mes, contraste regional, sumas nacionales."""
    series = defaultdict(list)
    for r in registros:
        if r["specialty"]:
            series[_clave_serie(r)].append(r)
    for regs in series.values():
        regs.sort(key=lambda r: (r["year"], r["month"]))
        for prev, cur in zip(regs, regs[1:]):
            consecutivo = (cur["year"] * 12 + cur["month"]) - (prev["year"] * 12 + prev["month"]) == 1
            if not consecutivo:
                continue
            a, b = prev.get("avg_request_calc"), cur.get("avg_request_calc")
            pocos = min(prev.get("appointments_total") or 0, cur.get("appointments_total") or 0) < config.UMBRAL_MUESTRA_PEQUENA
            if a and b and not pocos and (b / a > config.FACTOR_SALTO or a / b > config.FACTOR_SALTO):
                _agregar(cur, "jump_vs_prev_month:request")
            a, b = prev.get("appointments_total"), cur.get("appointments_total")
            if (a and b and min(a, b) >= config.UMBRAL_MUESTRA_PEQUENA
                    and (b / a > config.FACTOR_SALTO or a / b > config.FACTOR_SALTO)):
                _agregar(cur, "volume_jump")

    # Departamento frente al nacional del mismo mes, y suma de citas departamentales.
    nacional, deptos = {}, defaultdict(list)
    for r in registros:
        k = (r["eps"], r["regimen"], r["year"], r["month"], r["specialty"])
        if r["geo_level"] == "national":
            nacional[k] = r
        elif r["geo_level"] == "department":
            deptos[k].append(r)
    for k, ds in deptos.items():
        nat = nacional.get(k)
        if not nat:
            continue
        ref = nat.get("avg_request_calc")
        for d in ds:
            v = d.get("avg_request_calc")
            if ref and v and v > 2 * ref and (d["appointments_total"] or 0) >= config.UMBRAL_MUESTRA_PEQUENA:
                _agregar(d, "regional_outlier")
        if all(d["appointments_total"] is not None for d in ds) and nat["appointments_total"] is not None:
            suma = sum(d["appointments_total"] for d in ds)
            if suma != nat["appointments_total"]:
                _agregar(nat, f"national_sum_mismatch:{suma:g}")

    # Contexto: los meses de confinamiento por la pandemia (se anota, no se elimina).
    for r in registros:
        if r["year"] == 2020 and 3 <= r["month"] <= 6:
            _agregar(r, "context:pandemia_covid19")
    return registros


def es_publicable(r, campo="avg_request_calc"):
    """Un valor se muestra solo si sobrevivió a las reglas bloqueantes (si no, queda en blanco)."""
    return r.get(campo) is not None
