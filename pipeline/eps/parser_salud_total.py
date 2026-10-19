"""Parser de los PDF mensuales de Salud Total (formato por IPS, 2025 en adelante).

Cada registro: departamento, ciudad, NIT, IPS, régimen, producto (PBS/PAC), código CUPS y
servicio, seguido de 8 números: total de citas, SFAFS, SFAFU, PFAFS, PFAFU, MINDA, MAXDA y horas.
El texto viene pegado en varios campos ("TOLIMA PALOCABILDO809004280"), así que se lee como un
flujo de tokens: cada registro termina en 8 números seguidos.

No es un resumen por EPS: el nivel nacional y departamental se agrega aquí, siempre como
Σ SFAFS / Σ citas (nunca promediando promedios).
"""

import re
from dataclasses import dataclass, field

from . import config, texto
from .parser_nueva_eps import FormatoInesperado

N_NUMEROS = 8
_REGISTRO = re.compile(
    r"^(?P<lugar>.*?[A-ZÁÉÍÓÚÑ.)])\s?(?P<nit>\d{6,10})\s+(?P<ips>.+?)\s*"
    r"(?:(?P<regimen>SUBSIDIADO|CONTRIBUTIVO|-)\s*(?P<producto>PBS/PAC|PBS|PAC|-)\s+)?(?P<cups>\d{6,12})\s+(?P<servicio>.+)$"
)
# Solo consultas de primera vez de las especialidades de la sala (las de control no son asignación nueva).
_SERVICIOS = {
    "consulta de primera vez por medicina general": "medicina_general",
    "consulta de primera vez por odontologia general": "odontologia",
    "consulta de primera vez por especialista en pediatria": "pediatria",
    "consulta de primera vez por especialista en obstetricia": "obstetricia",
    "consulta de primera vez por especialista en ginecologia": "ginecologia",
    # CUPS 890250 "ginecología y obstetricia": la Circular 038 lo agrupa con ginecología.
    "consulta de primera vez por especialista en ginecologia y obstetricia": "ginecologia",
    "consulta de primera vez por especialista en cirugia general": "cirugia_general",
    "consulta de primera vez por especialista en medicina interna": "medicina_interna",
}
_ENCABEZADO = ("Departamento", "Ciudad", "Nit", "IPS", "Regimen", "Producto", "CodigoIT", "Servicio")


class FormatoRedAliada(FormatoInesperado):
    """Formato "ESPECIALIDAD Sucursal IPS…" (red aliada, enero y febrero de 2025): no trae régimen,
    así que no se puede sumar a las series por régimen. Se registra y el mes queda sin dato."""


@dataclass
class FilaIps:
    department: str | None
    lugar_raw: str
    city: str
    ips_nit: str
    ips_name: str
    regimen: str
    producto: str
    cups: str
    servicio: str
    specialty: str | None
    valores: dict = field(default_factory=dict)
    decimales: dict = field(default_factory=dict)


def _separar_lugar(lugar: str):
    """'VALLE DEL CAUCA CALI' -> ('valle_del_cauca', 'CALI'); prueba primero los nombres más largos."""
    palabras = lugar.split()
    for n in range(min(5, len(palabras) - 1), 0, -1):
        dep = texto.departamento(" ".join(palabras[:n]))
        if dep:
            return dep, " ".join(palabras[n:])
    return None, lugar


@dataclass
class ResultadoSaludTotal:
    filas: list
    periodos_en_texto: set
    registros_ilegibles: int


def parsear(lineas: list[str]) -> ResultadoSaludTotal:
    tokens = " ".join(lineas).split()
    if tokens[:3] == ["ESPECIALIDAD", "Sucursal", "IPS"]:
        raise FormatoRedAliada("Formato de red aliada sin régimen (ESPECIALIDAD, Sucursal, IPS…)")
    if not all(h in tokens[:40] for h in _ENCABEZADO):
        raise FormatoInesperado("El encabezado no es el del formato por IPS (Departamento … Servicio)")
    filas, malas, buf, periodos = [], 0, [], set()
    i = 0
    while i < len(tokens):
        bloque = tokens[i:i + N_NUMEROS]
        if (len(bloque) == N_NUMEROS and all(texto.es_numero(t) for t in bloque)
                and buf and not texto.es_numero(buf[-1])):
            previo = " ".join(buf)
            buf = []
            # El glosario y el título "INFORME ASIGNACIÓN DE CITAS MES DE <MES> <AÑO>" quedan pegados
            # al primer registro de la última página: se conserva el periodo y se descarta el resto.
            t = re.search(r"MES DE (%s) (20\d\d) (.*)$" % "|".join(config.MESES), previo)
            if t:
                periodos.add((int(t.group(2)), config.MESES.index(t.group(1)) + 1))
                previo = t.group(3)
            m = _REGISTRO.match(previo)
            i += N_NUMEROS
            if not m:
                malas += 1
                continue
            g = m.groupdict()
            dep, ciudad = _separar_lugar(g["lugar"])
            servicio = texto.normalizar(g["servicio"])
            dec = lambda t: texto.decimal(t, punto_solo_es_miles=True)  # noqa: E731
            filas.append(FilaIps(
                department=dep, lugar_raw=g["lugar"], city=ciudad, ips_nit=g["nit"], ips_name=g["ips"],
                regimen=(g["regimen"] or "-").lower(), producto=g["producto"] or "-", cups=g["cups"], servicio=servicio,
                specialty=_SERVICIOS.get(servicio),
                valores={
                    "appointments_total": dec(bloque[0]),
                    "sum_days_request": dec(bloque[1]),
                    "sum_days_desired": dec(bloque[2]),
                    "avg_request_reported": dec(bloque[3]),
                    "avg_desired_reported": dec(bloque[4]),
                    "min_days": dec(bloque[5]),
                    "max_days": dec(bloque[6]),
                    "specialist_hours": dec(bloque[7]),
                },
                decimales={
                    "avg_request_reported": texto.decimales_reportados(bloque[3], True),
                    "avg_desired_reported": texto.decimales_reportados(bloque[4], True),
                },
            ))
        else:
            if tokens[i] in _ENCABEZADO or tokens[i] in ("TOTAL", "CITAS", "ASIGNADAS", "SFAFS", "SFAFU", "PFAFS",
                                                          "PFAFU", "MINDA", "MAXDA", "HORAS", "CONTRATAD", "AS"):
                if not buf:  # encabezado repetido en cada página
                    i += 1
                    continue
            buf.append(tokens[i])
            i += 1
    if not filas or malas > 0.05 * (len(filas) + malas):
        raise FormatoInesperado(f"{malas} registros de Salud Total no tienen la estructura esperada (de {len(filas) + malas})")
    return ResultadoSaludTotal(filas, periodos, malas)
