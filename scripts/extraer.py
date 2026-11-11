"""FASE 2 — Separa los datos y las imágenes del index.html original.

Uso (desde la carpeta del proyecto):
    python scripts/extraer.py

Lee index.html SIN modificarlo y genera:
    datos/desarrollos.json   los mismos datos, con rutas a archivos en lugar de imágenes base64
    datos/medios.json        inventario: cada archivo (huella, tamaño, formato, medidas)
                             y cada referencia (dónde se usa y en qué orden)
    media/...                las imágenes, con sus bytes originales (sin recomprimir)

Reglas:
  - Ningún valor que no sea imagen se toca: precios, textos, vacíos y links quedan igual.
  - Si dos imágenes tienen exactamente los mismos bytes, se guarda un solo archivo
    y las dos referencias apuntan a él.
  - Nunca se sobrescribe un archivo distinto: si el nombre ya existe con otro
    contenido, el script se detiene.
"""
import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import SECCIONES, decodificar, formato_real, leer_original, medidas, sha256  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL = os.path.join(RAIZ, "index.html")


def main():
    with open(ORIGINAL, "rb") as f:
        huella_original = sha256(f.read())
    _, datos, logo = leer_original(ORIGINAL)
    nuevo = copy.deepcopy(datos)

    archivos = {}      # sha256 -> info del archivo
    referencias = []   # una por cada uso de imagen
    rutas_usadas = {}  # ruta -> sha256 (para no pisar archivos distintos)

    def registrar(data_uri, ruta_sin_ext, ubicacion, desarrollo, seccion, orden):
        mime, b = decodificar(data_uri)
        h = sha256(b)
        fmt, ext = formato_real(b)
        if fmt is None:
            raise SystemExit(f"Formato desconocido en {ubicacion}")
        if h not in archivos:
            ruta = f"{ruta_sin_ext}.{ext}"
            if ruta in rutas_usadas and rutas_usadas[ruta] != h:
                raise SystemExit(f"Choque de nombres: {ruta}")
            destino = os.path.join(RAIZ, *ruta.split("/"))
            if os.path.exists(destino):
                with open(destino, "rb") as f:
                    if sha256(f.read()) != h:
                        raise SystemExit(f"Ya existe {ruta} con otro contenido; no se sobrescribe.")
            else:
                os.makedirs(os.path.dirname(destino), exist_ok=True)
                with open(destino, "xb") as f:  # "x": falla si el archivo ya existe
                    f.write(b)
            w, hh = medidas(b)
            archivos[h] = {"ruta": ruta, "sha256": h, "bytes": len(b), "formato": fmt,
                           "ancho": w, "alto": hh}
            rutas_usadas[ruta] = h
        ruta = archivos[h]["ruta"]
        referencias.append({"ubicacion": ubicacion, "desarrollo": desarrollo, "seccion": seccion,
                            "orden": orden, "ruta": ruta, "sha256": h, "mime_original": mime})
        return ruta

    # 1) Generales: logo (está en el código, no en el JSON) y portada de la página
    registrar(logo, "media/general/logo", "LOGO", None, "logo", 0)
    if datos.get("portada"):
        nuevo["portada"] = registrar(datos["portada"], "media/general/portada", "portada",
                                     None, "portada-general", 0)

    # 2) Cada desarrollo: primero las galerías en orden, al final la portada.
    #    Así, si la portada es igual a una foto, apunta al archivo de esa foto.
    for i, e in enumerate(datos["emprendimientos"]):
        did = e["id"]
        for clave, carpeta, prefijo in SECCIONES:
            for n, src in enumerate(e.get(clave) or []):
                nuevo["emprendimientos"][i][clave][n] = registrar(
                    src, f"media/{did}/{carpeta}/{prefijo}-{n + 1:02d}",
                    f"emprendimientos[{i}].{clave}[{n}]", did, clave, n + 1)
        if e.get("portada"):
            nuevo["emprendimientos"][i]["portada"] = registrar(
                e["portada"], f"media/{did}/portada", f"emprendimientos[{i}].portada",
                did, "portada", 0)

    os.makedirs(os.path.join(RAIZ, "datos"), exist_ok=True)
    with open(os.path.join(RAIZ, "datos", "desarrollos.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(nuevo, f, ensure_ascii=False, indent=2)
        f.write("\n")
    medios = {
        "descripcion": "Inventario de imágenes extraídas de index.html (fase 2). "
                       "'archivos' = un registro por archivo único; 'referencias' = cada lugar donde se usa.",
        "origen": {"archivo": "index.html", "sha256": huella_original},
        "logo": archivos[referencias[0]["sha256"]]["ruta"],
        "archivos": sorted(archivos.values(), key=lambda a: a["ruta"]),
        "referencias": referencias,
    }
    with open(os.path.join(RAIZ, "datos", "medios.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(medios, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Referencias: {len(referencias)} | Archivos únicos: {len(archivos)} | "
          f"Bytes: {sum(a['bytes'] for a in archivos.values()):,}")


if __name__ == "__main__":
    main()
