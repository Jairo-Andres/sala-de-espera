"""Configuración del pipeline de la sala de las EPS (fuentes, catálogos y umbrales)."""

from pathlib import Path

PARSER_VERSION = "1.0.0"

RAIZ = Path(__file__).resolve().parents[2]
DATA_DIR = RAIZ / "data" / "eps"
CACHE_DIR = DATA_DIR / "_cache"  # PDFs descargados (ignorado por git)
PUBLIC_DIR = RAIZ / "public" / "data" / "eps"  # archivo compacto que lee la interfaz

USER_AGENT = (
    "SalaDeEspera/1.0 (proyecto academico; datos abiertos de oportunidad de citas; "
    "linkedin.com/in/jairo-andres31-analyst)"
)
PAUSA_SEGUNDOS = 4.0  # entre peticiones al mismo sitio
REINTENTOS = 3

FUENTES = {
    "nueva_eps": {
        "nombre": "Nueva EPS",
        "indice": "https://www.nuevaeps.com.co/oportunidad-citas",
        "base": "https://www.nuevaeps.com.co",
    },
    "sura": {
        "nombre": "EPS Sura",
        "pdf": "https://www.epssura.com/files/indicador-oportunidad.pdf",
    },
}

MESES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]

# Nombre normalizado (sin tildes, minúsculas) -> clave del esquema
ESPECIALIDADES = {
    "cirugia general": "cirugia_general",
    "ginecologia": "ginecologia",
    "medicina general": "medicina_general",
    "medicina interna": "medicina_interna",
    "obstetricia": "obstetricia",
    "odontologia": "odontologia",
    "odontologia general": "odontologia",
    "pediatria": "pediatria",
}

# Departamentos (y distritos que algunas EPS reportan aparte) -> clave normalizada.
DEPARTAMENTOS = {
    "amazonas": "amazonas",
    "antioquia": "antioquia",
    "arauca": "arauca",
    "atlantico": "atlantico",
    "barranquilla": "barranquilla",
    "bogota": "bogota",
    "bogota d.c.": "bogota",
    "bogota dc": "bogota",
    "distrito capital": "bogota",
    "bolivar": "bolivar",
    "boyaca": "boyaca",
    "buenaventura": "buenaventura",
    "caldas": "caldas",
    "caqueta": "caqueta",
    "cartagena": "cartagena",
    "casanare": "casanare",
    "cauca": "cauca",
    "cesar": "cesar",
    "choco": "choco",
    "cordoba": "cordoba",
    "cundinamarca": "cundinamarca",
    "guainia": "guainia",
    "guaviare": "guaviare",
    "huila": "huila",
    "la guajira": "la_guajira",
    "guajira": "la_guajira",
    "magdalena": "magdalena",
    "meta": "meta",
    "narino": "narino",
    "nario": "narino",  # "NARIÑO" con la Ñ perdida en la extracción de texto
    "norte de santander": "norte_de_santander",
    "putumayo": "putumayo",
    "quindio": "quindio",
    "risaralda": "risaralda",
    "san andres": "san_andres",
    "san andres y providencia": "san_andres",
    "archipielago de san andres": "san_andres",
    "santa marta": "santa_marta",
    "santander": "santander",
    "sucre": "sucre",
    "tolima": "tolima",
    "valle del cauca": "valle_del_cauca",
    "valle": "valle_del_cauca",
    "vaupes": "vaupes",
    "vichada": "vichada",
}

# Estándares de referencia (días). Circular Externa 038 de 2025 (Minsalud), Fase I.
# Sujetos a ajuste según la propia circular. Verificado en la imagen del PDF oficial (2026-10-18):
# el símbolo es "≤" (el texto OCR del PDF lo lee como "<"). Ginecología y cirugía general llevan
# asterisco: son el "tiempo promedio reportado en los últimos 5 años en el país", no una norma previa.
ESTANDARES = {
    "medicina_general": 3,
    "pediatria": 5,
    "obstetricia": 8,
    "ginecologia": 10,
    "cirugia_general": 10,
    "medicina_interna": 15,
    # odontología no tiene referencia en la circular
}

# Umbrales de validación
TOLERANCIA_PROMEDIO = 0.05  # días
UMBRAL_PROMEDIO_ALTO = 60  # días
UMBRAL_MUESTRA_PEQUENA = 30  # citas
FACTOR_SALTO = 2.0  # más del doble (o menos de la mitad) frente al mes anterior
