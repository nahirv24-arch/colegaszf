"""Funciones compartidas por extraer.py y validar_extraccion.py.

Solo usa la biblioteca estándar de Python: no hace falta instalar nada.
"""
import base64
import hashlib
import json
import re
import struct

# Secciones de imágenes de cada desarrollo, en el orden en que se recorren.
# (clave en el JSON, carpeta en disco, prefijo del nombre de archivo)
SECCIONES = [
    ("imagenes", "fotos", "foto"),
    ("galeria", "renders", "render"),
    ("planos", "planos", "plano"),
    ("brochurePags", "brochure", "pagina"),
]

RE_DATA_URI = re.compile(r"^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]*)$")
RE_DATOS = re.compile(r'<script id="datos" type="application/json">(.*?)</script>', re.S)
RE_LOGO = re.compile(r'var LOGO = "(data:[^"]+)";')


def leer_original(ruta_html):
    """Devuelve (texto_html, datos_dict, logo_data_uri) del index.html original."""
    with open(ruta_html, encoding="utf-8") as f:
        html = f.read()
    m = RE_DATOS.search(html)
    if not m:
        raise SystemExit('No se encontró <script id="datos"> en ' + ruta_html)
    datos = json.loads(m.group(1))
    ml = RE_LOGO.search(html)
    if not ml:
        raise SystemExit("No se encontró el logo (var LOGO) en " + ruta_html)
    return html, datos, ml.group(1)


def decodificar(data_uri):
    """Devuelve (mime_declarado, bytes) de un data URI base64."""
    m = RE_DATA_URI.match(data_uri)
    if not m:
        raise ValueError("No es un data URI base64 válido")
    return m.group(1), base64.b64decode(m.group(2), validate=True)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def formato_real(b):
    """Detecta el formato por los primeros bytes (firma del archivo)."""
    if b[:3] == b"\xff\xd8\xff":
        return "jpeg", "jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp", "webp"
    return None, None


def medidas(b):
    """Ancho y alto en píxeles leyendo solo la cabecera. (None, None) si no se puede."""
    try:
        fmt, _ = formato_real(b)
        if fmt == "png":
            return struct.unpack(">II", b[16:24])
        if fmt == "webp":
            chunk = b[12:16]
            if chunk == b"VP8X":
                w = int.from_bytes(b[24:27], "little") + 1
                h = int.from_bytes(b[27:30], "little") + 1
                return w, h
            if chunk == b"VP8 ":
                w, h = struct.unpack("<HH", b[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if chunk == b"VP8L":
                v = int.from_bytes(b[21:25], "little")
                return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
        if fmt == "jpeg":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF:
                    i += 1
                    continue
                marca = b[i + 1]
                if marca in (0xD8, 0x01) or 0xD0 <= marca <= 0xD7:
                    i += 2
                    continue
                largo = struct.unpack(">H", b[i + 2:i + 4])[0]
                if 0xC0 <= marca <= 0xCF and marca not in (0xC4, 0xC8, 0xCC):
                    h, w = struct.unpack(">HH", b[i + 5:i + 9])
                    return w, h
                i += 2 + largo
    except Exception:
        pass
    return None, None
