"""FASE 2 — Compara el index.html original con lo extraído (datos/ y media/).

Uso (desde la carpeta del proyecto):
    python scripts/validar_extraccion.py

No modifica nada. Termina con código 0 si todo coincide y 1 si algo falla.
"""
import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import SECCIONES, decodificar, formato_real, leer_original, medidas, sha256  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESPERADO = {
    "desarrollos": 17, "unidades": 207, "referencias": 174,
    "imagenes": 38, "galeria": 23, "planos": 32, "brochurePags": 72,
    "portada": 7, "portada-general": 1, "logo": 1,
}
CAMPOS_IMAGEN = {"portada"} | {c for c, _, _ in SECCIONES}

fallas, avisos = [], []


def check(cond, texto):
    print(("  OK   " if cond else "  FALLA ") + texto)
    if not cond:
        fallas.append(texto)


def leer_archivo(ruta):
    with open(os.path.join(RAIZ, *ruta.split("/")), "rb") as f:
        return f.read()


def main():
    ruta_html = os.path.join(RAIZ, "index.html")
    with open(ruta_html, "rb") as f:
        huella = sha256(f.read())
    _, orig, logo = leer_original(ruta_html)
    with open(os.path.join(RAIZ, "datos", "desarrollos.json"), encoding="utf-8") as f:
        ext = json.load(f)
    with open(os.path.join(RAIZ, "datos", "medios.json"), encoding="utf-8") as f:
        medios = json.load(f)
    archivos = {a["ruta"]: a for a in medios["archivos"]}
    refs = medios["referencias"]

    print("\n1) Archivo original")
    check(huella == medios["origen"]["sha256"],
          f"index.html es el mismo que se usó para extraer (sha256 {huella[:16]}…)")

    print("\n2) Cantidades")
    E, X = orig["emprendimientos"], ext["emprendimientos"]
    unidades = sum(len(e.get("disponibles") or []) for e in E)
    unidades_x = sum(len(e.get("disponibles") or []) for e in X)
    check(len(E) == ESPERADO["desarrollos"] == len(X), f"desarrollos: original {len(E)}, extraído {len(X)}")
    check(unidades == ESPERADO["unidades"] == unidades_x, f"unidades: original {unidades}, extraído {unidades_x}")
    por_seccion = {}
    for r in refs:
        por_seccion[r["seccion"]] = por_seccion.get(r["seccion"], 0) + 1
    for clave in ["imagenes", "galeria", "planos", "brochurePags", "portada", "portada-general", "logo"]:
        n_orig = (sum(len(e.get(clave) or []) for e in E) if clave in ("imagenes", "galeria", "planos", "brochurePags")
                  else sum(1 for e in E if e.get("portada")) if clave == "portada"
                  else (1 if orig.get("portada") else 0) if clave == "portada-general" else 1)
        check(n_orig == ESPERADO[clave] == por_seccion.get(clave, 0),
              f"{clave}: esperado {ESPERADO[clave]}, original {n_orig}, extraído {por_seccion.get(clave, 0)}")
    check(len(refs) == ESPERADO["referencias"], f"referencias de imágenes: {len(refs)} (esperado 174)")

    print("\n3) Archivos de imagen")
    validos = True
    for ruta, a in archivos.items():
        try:
            b = leer_archivo(ruta)
        except OSError:
            check(False, f"falta el archivo {ruta}")
            validos = False
            continue
        fmt, _ = formato_real(b)
        ok = (sha256(b) == a["sha256"] and len(b) == a["bytes"] and fmt == a["formato"]
              and ruta.endswith("." + ("jpg" if fmt == "jpeg" else fmt))
              and medidas(b) == (a["ancho"], a["alto"]) and a["ancho"])
        if not ok:
            check(False, f"archivo inválido o alterado: {ruta}")
            validos = False
    check(validos, f"{len(archivos)} archivos existen, tienen firma de imagen válida, medidas legibles y huella correcta")
    en_disco = set()
    for base, _, nombres in os.walk(os.path.join(RAIZ, "media")):
        for n in nombres:
            en_disco.add(os.path.relpath(os.path.join(base, n), RAIZ).replace(os.sep, "/"))
    check(en_disco == set(archivos), f"media/ tiene exactamente los archivos del inventario ({len(en_disco)}), sin sobrantes")

    print("\n4) Bytes idénticos a los originales decodificados")
    iguales = 0
    originales = [("LOGO", logo)]
    if orig.get("portada"):
        originales.append(("portada", orig["portada"]))
    for i, e in enumerate(E):
        for clave, _, _ in SECCIONES:
            for n, src in enumerate(e.get(clave) or []):
                originales.append((f"emprendimientos[{i}].{clave}[{n}]", src))
        if e.get("portada"):
            originales.append((f"emprendimientos[{i}].portada", e["portada"]))
    por_ubicacion = {r["ubicacion"]: r for r in refs}
    for ubic, src in originales:
        mime, b = decodificar(src)
        r = por_ubicacion.get(ubic)
        if r and r["mime_original"] == mime and leer_archivo(r["ruta"]) == b:
            iguales += 1
        else:
            check(False, f"bytes distintos en {ubic}")
    check(iguales == len(originales) == len(refs), f"{iguales} de {len(originales)} imágenes son byte a byte iguales")

    print("\n5) Referencias")
    rotas = [r for r in refs if r["ruta"] not in archivos]
    check(not rotas, "todas las referencias del inventario apuntan a un archivo existente")
    texto_ext = json.dumps(ext, ensure_ascii=False)
    check("data:image" not in texto_ext, "desarrollos.json ya no contiene imágenes base64")
    rutas_json = []
    if ext.get("portada"):
        rutas_json.append(ext["portada"])
    for e in X:
        for clave in CAMPOS_IMAGEN:
            v = e.get(clave)
            rutas_json += [v] if isinstance(v, str) and v else (v if isinstance(v, list) else [])
    check(all(r in archivos for r in rutas_json),
          f"las {len(rutas_json)} rutas de desarrollos.json existen (ninguna rota)")
    ordenes = all(
        X[int(r["ubicacion"].split("[")[1].split("]")[0])][r["seccion"]][r["orden"] - 1] == r["ruta"]
        for r in refs if r["seccion"] in ("imagenes", "galeria", "planos", "brochurePags"))
    check(ordenes, "el orden de fotos, renders, planos y páginas de brochure es el original")

    print("\n6) Datos comerciales y campos (todo lo que no es imagen)")
    def sin_imagenes(e):
        return {k: v for k, v in e.items() if k not in CAMPOS_IMAGEN}
    iguales_com = all(sin_imagenes(a) == sin_imagenes(b) for a, b in zip(E, X))
    check(iguales_com, "precios, superficies, tablas, columnas, notas, links, posesión y gastos idénticos")
    check(all(list(a.keys()) == list(b.keys()) for a, b in zip(E, X)),
          "cada desarrollo conserva todos sus campos, en el mismo orden")
    check([e["id"] for e in E] == [e["id"] for e in X], "IDs y orden de los desarrollos sin cambios (links #id compatibles)")
    check(list(orig.keys()) == list(ext.keys()) and orig["actualizado"] == ext["actualizado"],
          "raíz: claves 'actualizado', 'portada', 'emprendimientos' y fecha sin cambios")
    def vacios(o):
        if isinstance(o, dict):
            return sum(vacios(v) for v in o.values())
        if isinstance(o, list):
            return sum(vacios(v) for v in o) + (1 if not o else 0)
        return 1 if o in ("", None) else 0
    check(vacios(orig) == vacios(ext), f"campos vacíos conservados: {vacios(orig)} en ambos")
    tipos_precio = {type(u.get("precio")).__name__ for e in X for u in (e.get("disponibles") or []) if "precio" in u}
    check(tipos_precio == {"str"}, "los precios siguen siendo texto (no se convirtieron a números)")

    print("\n7) Reconstrucción completa")
    def rearmar(v, mime):
        return "data:" + mime + ";base64," + base64.b64encode(leer_archivo(v)).decode("ascii")
    rearmado = json.loads(json.dumps(ext))
    for r in refs:
        if r["seccion"] == "logo":
            continue
        if r["seccion"] == "portada-general":
            rearmado["portada"] = rearmar(r["ruta"], r["mime_original"])
            continue
        i = int(r["ubicacion"].split("[")[1].split("]")[0])
        if r["seccion"] == "portada":
            rearmado["emprendimientos"][i]["portada"] = rearmar(r["ruta"], r["mime_original"])
        else:
            rearmado["emprendimientos"][i][r["seccion"]][r["orden"] - 1] = rearmar(r["ruta"], r["mime_original"])
    check(rearmado == orig, "volviendo a meter las imágenes en el JSON se obtiene EXACTAMENTE el original")
    check(rearmar(por_ubicacion["LOGO"]["ruta"], por_ubicacion["LOGO"]["mime_original"]) == logo,
          "el logo rearmado es idéntico al original")

    print("\n8) Tamaños")
    total = sum(a["bytes"] for a in archivos.values())
    tam_json = os.path.getsize(os.path.join(RAIZ, "datos", "desarrollos.json"))
    print(f"  imágenes: {len(archivos)} archivos, {total:,} bytes ({total / 1048576:.1f} MB)")
    print(f"  desarrollos.json: {tam_json:,} bytes ({tam_json / 1024:.1f} KB)")
    print(f"  index.html original: {os.path.getsize(ruta_html):,} bytes")

    print("\nRESULTADO:", "TODO CORRECTO" if not fallas else f"{len(fallas)} FALLAS")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
