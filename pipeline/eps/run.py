"""Pipeline completo de la sala de las EPS.

    python -m pipeline.eps.run                 # descarga lo que falte, parsea, valida y publica
    python -m pipeline.eps.run --dry-run       # igual, pero no escribe nada: solo informa
    python -m pipeline.eps.run --offline       # sin red: usa solo los PDF en caché
    python -m pipeline.eps.run --incremental   # (CI) reutiliza los registros ya publicados de
                                               # los PDF de Nueva EPS que no cambiaron de URL

Código de salida 1 si una fuente cambió de formato (no se publica basura) o si no se pudo
leer ninguna fuente.
"""

import argparse
import csv
import json
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from . import config, construir, descargar, extraer, parser_nueva_eps, parser_salud_total, parser_sura, publicar, validar
from .parser_nueva_eps import FormatoInesperado

CRUCE = {"jump_vs_prev_month", "volume_jump", "regional_outlier", "national_sum_mismatch", "context"}


def ahora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- CSV ------------------------------------------------------------------------------

ENTEROS = {"year", "month"}
REALES = {"appointments_total", "sum_days_request", "sum_days_desired", "avg_request_calc", "avg_desired_calc", "avg_request_reported", "avg_desired_reported",
          "avg_of_max_request", "avg_of_min_request", "avg_of_max_desired", "avg_of_min_desired",
          "specialist_hours"}


def escribir_csv(registros, carpeta: Path):
    """Un CSV por EPS y año (registros/<eps>_<año>.csv): cada carga mensual solo toca un archivo."""
    carpeta.mkdir(parents=True, exist_ok=True)
    grupos = defaultdict(list)
    for r in registros:
        grupos[(r["eps"], r["year"])].append(r)
    for viejo in carpeta.glob("*.csv"):
        viejo.unlink()
    for (eps, anio), regs in grupos.items():
        _escribir_un_csv(regs, carpeta / f"{eps}_{anio}.csv")


def _escribir_un_csv(registros, ruta: Path):
    with ruta.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=construir.CAMPOS)
        w.writeheader()
        for r in sorted(registros, key=lambda r: (r["eps"], r["regimen"] or "", r["year"], r["month"],
                                                   r["specialty"] or "", r["geo_level"], r["department"] or "")):
            fila = {c: r.get(c) for c in construir.CAMPOS}
            for c in REALES:
                if fila[c] is not None:
                    fila[c] = round(fila[c], 4)
            fila["quality_flags"] = "|".join(r["quality_flags"])
            w.writerow(fila)


def leer_csv(carpeta: Path):
    regs = []
    for ruta in sorted(carpeta.glob("*.csv")) if carpeta.exists() else []:
        regs += _leer_un_csv(ruta)
    return regs


def _leer_un_csv(ruta: Path):
    regs = []
    with ruta.open(encoding="utf-8") as fh:
        for fila in csv.DictReader(fh):
            r = {}
            for c, v in fila.items():
                if v == "":
                    r[c] = None
                elif c in ENTEROS:
                    r[c] = int(v)
                elif c in REALES:
                    r[c] = float(v)
                else:
                    r[c] = v
            r["quality_flags"] = [b for b in (fila["quality_flags"] or "").split("|") if b]
            regs.append(r)
    return regs


# --- Fuentes --------------------------------------------------------------------------

def procesar_nueva_eps(offline: bool, previos_por_url: dict, incremental: bool):
    estado = {"name": config.FUENTES["nueva_eps"]["nombre"], "index_url": config.FUENTES["nueva_eps"]["indice"],
              "checked_at": ahora(), "responded": False, "error": None, "files": []}
    cache_indice = config.CACHE_DIR / "nueva_eps_indice.html"
    try:
        if offline:
            html = cache_indice.read_text(encoding="utf-8")
        else:
            html = descargar.obtener(config.FUENTES["nueva_eps"]["indice"]).decode("utf-8", "replace")
            config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_indice.write_text(html, encoding="utf-8")
        estado["responded"] = True
    except Exception as e:  # noqa: BLE001 - se registra y la interfaz sigue con lo publicado
        estado["error"] = f"No se pudo leer la página índice: {e!r}"
        return [], estado, False

    enlaces, avisos = descargar.enlaces_nueva_eps(html)
    estado["index_warnings"] = avisos
    registros, formato_roto = [], False
    por_periodo = Counter((e.regimen, e.year, e.month) for e in enlaces)
    for e in enlaces:
        info = {"regimen": e.regimen, "period": f"{e.year}-{e.month:02d}", "url": e.url, "status": "ok"}
        estado["files"].append(info)
        if incremental and e.url in previos_por_url:
            regs = previos_por_url[e.url]
            for r in regs:
                r["_reusado"] = True
            info.update(sha256=regs[0]["source_sha256"], retrieved_at=regs[0]["retrieved_at"], reused=True)
            registros += regs
            continue
        try:
            if offline:
                pdf, meta = descargar._ruta_cache(e.url)
                if not pdf.exists():
                    info["status"] = "not_cached"
                    continue
            arch = descargar.descargar(e.url)
            info.update(sha256=arch.sha256, retrieved_at=arch.retrieved_at)
            fuente = {"url": e.url, "sha256": arch.sha256, "retrieved_at": arch.retrieved_at}
            res = parser_nueva_eps.parsear(extraer.lineas_pdf(arch.contenido))
            regs = construir.desde_nueva_eps(res, e.regimen, e.year, e.month, fuente)
            if por_periodo[(e.regimen, e.year, e.month)] > 1:
                for r in regs:
                    r["quality_flags"].append("duplicate_period")
            registros += regs
        except FormatoInesperado as ex:
            info.update(status="format_error", error=str(ex))
            formato_roto = True
        except Exception as ex:  # noqa: BLE001
            info.update(status="download_error", error=repr(ex))

    # El mismo archivo publicado para dos meses distintos (p. ej. nombres que se repiten entre años).
    por_sha = defaultdict(set)
    for r in registros:
        por_sha[r["source_sha256"]].add((r["regimen"], r["year"], r["month"]))
    for r in registros:
        periodos = por_sha[r["source_sha256"]]
        if len(periodos) > 1:
            otros = sorted(f"{y}-{m:02d}" for _, y, m in periodos if (y, m) != (r["year"], r["month"]))
            bandera = "duplicate_source_file:" + ",".join(otros)
            if bandera not in r["quality_flags"]:
                r["quality_flags"].append(bandera)
    return registros, estado, formato_roto


class PdfDanado(Exception):
    """El PDF publicado está incompleto o dañado (pasa igual al volver a descargarlo)."""


def procesar_salud_total(offline: bool, previos_por_url: dict, incremental: bool):
    """Un mes puede venir en dos PDF (red aliada y red externa): se leen juntos y se agregan una vez."""
    fuente_cfg = config.FUENTES["salud_total"]
    estado = {"name": fuente_cfg["nombre"], "index_url": fuente_cfg["indice"], "checked_at": ahora(),
              "responded": False, "error": None, "files": []}
    cache_indice = config.CACHE_DIR / "salud_total_indice.html"
    try:
        if offline:
            html = cache_indice.read_text(encoding="utf-8")
        else:
            html = descargar.obtener(fuente_cfg["indice"]).decode("utf-8", "replace")
            config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_indice.write_text(html, encoding="utf-8")
        estado["responded"] = True
    except Exception as e:  # noqa: BLE001
        estado["error"] = f"No se pudo leer la página índice: {e!r}"
        return [], estado, False
    enlaces, avisos = descargar.enlaces_salud_total(html)
    estado["index_warnings"] = avisos
    por_mes = defaultdict(list)
    for e in enlaces:
        por_mes[(e.year, e.month)].append(e)
    registros, formato_roto = [], False
    for (y, m), partes in sorted(por_mes.items()):
        urls = [p.url for p in partes]
        clave = " | ".join(urls)
        info = {"period": f"{y}-{m:02d}", "url": urls[0], "parts": len(urls), "status": "ok"}
        estado["files"].append(info)
        if incremental and clave in previos_por_url:
            regs = previos_por_url[clave]
            for r in regs:
                r["_reusado"] = True
            registros += regs
            continue
        filas, shas, fechas, ilegibles, periodos = [], [], [], 0, set()
        try:
            for u in urls:
                if offline and not descargar._ruta_cache(u)[0].exists():
                    raise FileNotFoundError("not_cached")
                arch = descargar.descargar(u)
                try:
                    lineas = extraer.lineas_pdf(arch.contenido)
                except Exception as ex:  # noqa: BLE001
                    raise PdfDanado(f"{u}: {ex!r}") from ex
                res = parser_salud_total.parsear(lineas)
                filas += res.filas
                ilegibles += res.registros_ilegibles
                periodos |= res.periodos_en_texto
                shas.append(arch.sha256)
                fechas.append(arch.retrieved_at)
        except FileNotFoundError:
            info["status"] = "not_cached"
            continue
        except PdfDanado as ex:
            info.update(status="corrupt_source_pdf", error=str(ex)[:300])
            continue
        except parser_salud_total.FormatoRedAliada as ex:
            info.update(status="unsupported_format", error=str(ex))
            continue
        except FormatoInesperado as ex:
            # Los formatos anteriores a 2025 (otra estructura) se registran pero no rompen el trabajo.
            historico = y < config.SALUD_TOTAL_FORMATO_DESDE
            info.update(status="unsupported_format" if historico else "format_error", error=str(ex))
            formato_roto = formato_roto or not historico
            continue
        except Exception as ex:  # noqa: BLE001
            info.update(status="download_error", error=repr(ex))
            continue
        info.update(sha256=",".join(shas), retrieved_at=max(fechas), unreadable_records=ilegibles)
        fuente = {"url": clave, "sha256": ",".join(shas), "retrieved_at": max(fechas)}
        res = parser_salud_total.ResultadoSaludTotal(filas, periodos, ilegibles)
        registros += construir.desde_salud_total(res, y, m, fuente)
    return registros, estado, formato_roto


def procesar_sura(offline: bool):
    url = config.FUENTES["sura"]["pdf"]
    estado = {"name": config.FUENTES["sura"]["nombre"], "pdf_url": url, "checked_at": ahora(),
              "responded": False, "error": None, "files": []}
    try:
        if offline:
            pdf, _ = descargar._ruta_cache(url)
            if not pdf.exists():
                estado["error"] = "Sin copia en caché (modo offline)"
                return [], estado, False
            arch = descargar.descargar(url, usar_cache=True)
        else:
            arch = descargar.descargar(url, usar_cache=False)  # el PDF se sobrescribe cada mes
        estado["responded"] = True
    except Exception as e:  # noqa: BLE001
        estado["error"] = f"No se pudo descargar el PDF: {e!r}"
        return [], estado, False
    info = {"period": "acumulado", "url": url, "sha256": arch.sha256, "retrieved_at": arch.retrieved_at, "status": "ok"}
    estado["files"].append(info)
    try:
        res = parser_sura.parsear(extraer.lineas_pdf(arch.contenido))
    except FormatoInesperado as ex:
        info.update(status="format_error", error=str(ex))
        return [], estado, True
    estado["parser_notes"] = res.notas
    fuente = {"url": url, "sha256": arch.sha256, "retrieved_at": arch.retrieved_at}
    return construir.desde_sura(res, fuente), estado, False


# --- Estado de fuentes ----------------------------------------------------------------

def meses_faltantes(periodos):
    if not periodos:
        return []
    idx = sorted({y * 12 + m - 1 for y, m in periodos})
    todos = set(range(idx[0], idx[-1] + 1))
    return [f"{i // 12}-{i % 12 + 1:02d}" for i in sorted(todos - set(idx))]


def completar_estado(estado, registros, previo):
    por_reg = defaultdict(set)
    for r in registros:
        if r["avg_request_calc"] is not None and r["geo_level"] == "national":
            por_reg[r["regimen"] or "unico"].add((r["year"], r["month"]))
    estado["last_month"] = {k: "%d-%02d" % max(v) for k, v in por_reg.items()}
    estado["first_month"] = {k: "%d-%02d" % min(v) for k, v in por_reg.items()}
    estado["missing_months"] = {k: meses_faltantes(v) for k, v in por_reg.items()}
    fallidos = [f for f in estado["files"] if f["status"] not in ("ok",)]
    estado["files_total"] = len(estado["files"])
    estado["files_failed"] = fallidos
    estado["files"] = [f for f in estado["files"] if f["status"] == "ok"]
    ok = estado["responded"] and not any(f["status"] == "format_error" for f in fallidos)
    estado["unsupported_files"] = sum(f["status"] == "unsupported_format" for f in fallidos)
    estado["ok"] = ok
    antes = (previo or {}).get("failing_since")
    estado["failing_since"] = None if ok else (antes or estado["checked_at"])
    return estado


def revisiones_sura(nuevos, previos):
    """Cambios en meses ya publicados (el PDF de Sura se reescribe completo cada mes)."""
    clave = lambda r: (r["year"], r["month"], r["specialty"])  # noqa: E731
    antes = {clave(r): r for r in previos if r["eps"] == "sura"}
    cambios = []
    for r in nuevos:
        a = antes.get(clave(r))
        if a and (a["appointments_total"], a["sum_days_request"]) != (r["appointments_total"], r["sum_days_request"]):
            cambios.append(f"{r['year']}-{r['month']:02d} {r['specialty']}: "
                           f"{a['appointments_total']}/{a['sum_days_request']} -> {r['appointments_total']}/{r['sum_days_request']}")
    return cambios


# --- Principal ------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--incremental", action="store_true")
    ap.add_argument("--salida", type=Path, default=None, help="carpeta de salida (por defecto data/eps)")
    a = ap.parse_args(argv)

    destino = a.salida or (Path(tempfile.mkdtemp(prefix="eps-dry-")) if a.dry_run else config.DATA_DIR)
    previos = leer_csv(config.DATA_DIR / "registros")
    estado_previo = {}
    if (config.DATA_DIR / "estado_fuentes.json").exists():
        estado_previo = json.loads((config.DATA_DIR / "estado_fuentes.json").read_text(encoding="utf-8"))

    previos_por_url = defaultdict(list)
    for r in previos:
        if r["eps"] == "nueva_eps":
            r["quality_flags"] = [b for b in r["quality_flags"] if validar.codigo(b) not in CRUCE]
            previos_por_url[r["source_url"]].append(r)

    regs_ne, est_ne, roto_ne = procesar_nueva_eps(a.offline, previos_por_url, a.incremental)
    previos_st = defaultdict(list)
    for r in previos:
        if r["eps"] == "salud_total":
            r["quality_flags"] = [b for b in r["quality_flags"] if validar.codigo(b) not in CRUCE]
            previos_st[r["source_url"]].append(r)
    regs_st, est_st, roto_st = procesar_salud_total(a.offline, previos_st, a.incremental)
    regs_su, est_su, roto_su = procesar_sura(a.offline)

    for r in regs_ne + regs_st + regs_su:
        if not r.pop("_reusado", False) and not r.pop("_validado", False):  # los reutilizados ya pasaron estas reglas al publicarse
            validar.calcular(r)
            validar.validar_registro(r)
        r.pop("_decimales", None)
    registros = validar.validar_conjunto(regs_ne + regs_st + regs_su)

    eps_prev = (estado_previo.get("eps") or {})
    est_ne = completar_estado(est_ne, regs_ne, eps_prev.get("nueva_eps"))
    est_su = completar_estado(est_su, regs_su, eps_prev.get("sura"))
    est_st = completar_estado(est_st, regs_st, eps_prev.get("salud_total"))
    est_su["revisions_vs_previous"] = revisiones_sura(regs_su, previos) if previos else []
    banderas = Counter(validar.codigo(b) for r in registros for b in r["quality_flags"])
    estado = {
        "generated_at": ahora(),
        "parser_version": config.PARSER_VERSION,
        "eps": {"nueva_eps": est_ne, "salud_total": est_st, "sura": est_su},
        "flags_summary": dict(sorted(banderas.items())),
        "records": len(registros),
    }

    print(f"Registros: {len(registros)} (Nueva EPS {len(regs_ne)}, Salud Total {len(regs_st)}, Sura {len(regs_su)})")
    for k, e in estado["eps"].items():
        print(f"- {k}: ok={e['ok']} último mes={e.get('last_month')} archivos con problema={len(e['files_failed'])}"
              + (f" error={e['error']}" if e["error"] else ""))
        for f in e["files_failed"][:10]:
            print(f"    {f.get('regimen', '')} {f['period']} {f['status']}: {f.get('error', '')[:140]}")
    print("Banderas:", dict(banderas.most_common()))

    if roto_ne or roto_st or roto_su:
        print("ERROR: una fuente cambió de formato. Revisa el estado de fuentes; no se publica.", file=sys.stderr)
    if not registros:
        print("ERROR: no se obtuvo ningún registro.", file=sys.stderr)
        return 1

    escribir_csv(registros, destino / "registros")
    (destino / "estado_fuentes.json").write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")
    sala = publicar.sala(registros, estado)
    publico = destino / "sala-eps.json" if a.dry_run or a.salida else config.PUBLIC_DIR / "sala-eps.json"
    publico.parent.mkdir(parents=True, exist_ok=True)
    publico.write_text(json.dumps(sala, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Salida escrita en {destino}" + (" (dry-run: no se tocó data/eps)" if a.dry_run else ""))
    # Un formato roto no publica el archivo afectado, pero sí el resto; el trabajo falla para que se revise.
    return 1 if (roto_ne or roto_st or roto_su) else 0


if __name__ == "__main__":
    sys.exit(main())
