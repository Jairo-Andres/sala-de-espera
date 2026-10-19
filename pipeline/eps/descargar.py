"""Descubrimiento de enlaces y descarga cortés (robots.txt, User-Agent propio, pausas y reintentos)."""

import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timezone

from . import config

_robots: dict = {}
_ultima_peticion: dict = {}


class BloqueadoPorRobots(Exception):
    pass


def _permitido(url: str) -> bool:
    p = urllib.parse.urlsplit(url)
    host = f"{p.scheme}://{p.netloc}"
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(f"{host}/robots.txt", headers={"User-Agent": config.USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
        except urllib.error.HTTPError as e:
            # Sin robots.txt (404) se asume permitido; 401/403 se trata como prohibido.
            rp.parse([] if e.code == 404 else ["User-agent: *", "Disallow: /"])
        _robots[host] = rp
    return _robots[host].can_fetch(config.USER_AGENT, url)


def _esperar_turno(url: str):
    host = urllib.parse.urlsplit(url).netloc
    espera = config.PAUSA_SEGUNDOS - (time.monotonic() - _ultima_peticion.get(host, -1e9))
    if espera > 0:
        time.sleep(espera)
    _ultima_peticion[host] = time.monotonic()


def obtener(url: str) -> bytes:
    if not _permitido(url):
        raise BloqueadoPorRobots(url)
    ultimo = None
    for intento in range(config.REINTENTOS):
        _esperar_turno(url)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": config.USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404, 410):
                raise  # no tiene sentido reintentar
            ultimo = e
        except (urllib.error.URLError, TimeoutError) as e:
            ultimo = e
        time.sleep(config.PAUSA_SEGUNDOS * (2 ** intento))
    raise ultimo


@dataclass
class Archivo:
    url: str
    contenido: bytes
    sha256: str
    retrieved_at: str
    desde_cache: bool


def _ruta_cache(url: str):
    clave = hashlib.sha1(url.encode()).hexdigest()[:16]
    return config.CACHE_DIR / f"{clave}.pdf", config.CACHE_DIR / f"{clave}.json"


def descargar(url: str, usar_cache: bool = True) -> Archivo:
    """Descarga un PDF. Con caché, cada URL se pide una sola vez (salvo que se fuerce)."""
    pdf, meta = _ruta_cache(url)
    if usar_cache and pdf.exists() and meta.exists():
        m = json.loads(meta.read_text(encoding="utf-8"))
        datos = pdf.read_bytes()
        return Archivo(url, datos, hashlib.sha256(datos).hexdigest(), m["retrieved_at"], True)
    datos = obtener(url)
    if not datos.startswith(b"%PDF"):
        raise ValueError(f"La respuesta de {url} no es un PDF")
    ahora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    pdf.write_bytes(datos)
    meta.write_text(json.dumps({"url": url, "retrieved_at": ahora}), encoding="utf-8")
    return Archivo(url, datos, hashlib.sha256(datos).hexdigest(), ahora, False)


# --- Nueva EPS: la página índice es la única fuente de los enlaces ---------------------

@dataclass
class EnlaceMensual:
    regimen: str
    year: int
    month: int
    url: str


_TOKEN = re.compile(
    r"<h2[^>]*>(?P<h2>.*?)</h2>"
    r"|<strong>\s*(?P<anio>20\d\d)\s*</strong>"
    r"|<a[^>]+href=\"(?P<href>[^\"]+\.pdf)\"[^>]*>(?P<texto>.*?)</a>",
    re.S | re.I,
)


def _limpio(s: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def enlaces_nueva_eps(html_indice: str, base: str = config.FUENTES["nueva_eps"]["base"]):
    """Recorre la página en orden: el h2 dice el régimen, la celda en negrita el año y el enlace el mes.

    Devuelve (enlaces, avisos). Los enlaces cuyo texto no es un mes (políticas, códigos) se ignoran.
    """
    regimen, anio = None, None
    enlaces, avisos = [], []
    for m in _TOKEN.finditer(html_indice):
        if m.group("h2") is not None:
            t = _limpio(m.group("h2")).lower()
            regimen = "contributivo" if "contributivo" in t else "subsidiado" if "subsidiado" in t else None
            anio = None
        elif m.group("anio"):
            anio = int(m.group("anio"))
        elif m.group("href"):
            texto = _limpio(m.group("texto")).upper()
            if texto not in config.MESES:
                continue
            if not regimen or not anio:
                avisos.append(f"Enlace sin régimen o año: {m.group('href')}")
                continue
            url = urllib.parse.urljoin(base + "/", m.group("href").strip())
            url = url.replace("http://", "https://", 1)
            enlaces.append(EnlaceMensual(regimen, anio, config.MESES.index(texto) + 1, url))
    return enlaces, avisos


# --- Salud Total: acordeón por año, rótulo "Mes:" y uno o dos PDF por mes ---------------

_TOKEN_ST = re.compile(
    r"Tiempos de espera\s+(?P<anio>20\d\d)"
    r"|<p>\s*(?P<mes>Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*:?\s*</p>"
    r"|<a[^>]+href=\"(?P<href>[^\"]+\.pdf)\"",
    re.I,
)


def enlaces_salud_total(html_indice: str):
    """Devuelve (enlaces, avisos). Un mes puede tener varias partes (red aliada y red externa)."""
    anio = mes = None
    vistos, enlaces, avisos = set(), [], []
    for m in _TOKEN_ST.finditer(html_indice):
        if m.group("anio"):
            anio, mes = int(m.group("anio")), None
        elif m.group("mes"):
            mes = config.MESES.index(m.group("mes").upper()) + 1
        elif m.group("href") and anio and mes:
            url = m.group("href").strip().replace("http://", "https://", 1)
            if (anio, mes, url) in vistos:
                continue  # el mismo enlace partido en dos anclas
            vistos.add((anio, mes, url))
            enlaces.append(EnlaceMensual(None, anio, mes, url))
    if not enlaces:
        avisos.append("No se encontró ningún enlace mensual en la página de Salud Total")
    return enlaces, avisos
