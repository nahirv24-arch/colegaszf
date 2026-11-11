# Migración de "Material para colegas" — ZF Propiedades

Registro de las fases de modernización de la página. La página publicada en
Netlify (colegaszfpropiedades.netlify.app) **no cambia** hasta que se decida explícitamente.

| Fase | Estado | Rama |
|---|---|---|
| 1. Análisis y protección | Completa (11/11/2026) | — |
| 2. Separar datos e imágenes | Completa (11/11/2026) | `desarrollo` |
| 3. React | No iniciada | — |
| 4. Supabase | No iniciada | — |

---

## Fase 1 — Análisis y protección (11/11/2026)

- `index.html`: 26.553.293 bytes, SHA-256 `2F0EEFA48DF46DECB5B9BBCB5DA7C0FDED827137D7086E811A63CAC0A21742FA`.
- 17 desarrollos, 207 unidades, 174 imágenes en base64 (165 de galerías + 7 portadas + portada general + logo).
- No hay código que dependa de `window.claude`. El modo edición se activa con `#editar` y descarga un `index.html` nuevo.
- Respaldo: `C:\Users\Propietario\Downloads\zf-colegas-respaldos\index_respaldo_2026-11-11.html` (fuera del repositorio, hash idéntico).
- Etiqueta Git local `respaldo-2026-11-11` sobre la versión publicada. Rama de trabajo: `desarrollo`.

---

## Fase 2 — Separar datos e imágenes (11/11/2026)

`index.html` **no se modificó** (mismo SHA-256 antes y después). `main` no se tocó.

### Estructura creada

```
datos/
  desarrollos.json        datos de los 17 desarrollos, con rutas en lugar de base64 (86 KB)
  medios.json             inventario de imágenes: archivos y referencias (96 KB)
media/
  general/                logo.png, portada.webp
  <id-del-desarrollo>/
    portada.(jpg|webp)
    fotos/foto-01.jpg …       (clave "imagenes")
    renders/render-01.jpg …   (clave "galeria")
    planos/plano-01.jpg …     (clave "planos")
    brochure/pagina-01.jpg …  (clave "brochurePags")
scripts/
  comun.py                funciones compartidas
  extraer.py              genera datos/ y media/ a partir de index.html
  validar_extraccion.py   compara original vs. extraído (sale con error si algo difiere)
```

Solo tienen carpeta los 7 desarrollos con alguna imagen: patagonia-15, magna-11, reggia-6,
reggia-7, reggia-9, ignea-15 y foresta. Los otros 10 no tienen imágenes todavía.
Los números llevan dos cifras (`01`, `02`…) y respetan el orden original.

### Archivos por categoría

| Categoría | Clave JSON | Archivos | Tamaño |
|---|---|---|---|
| Fotos reales | `imagenes` | 38 | 5,56 MB |
| Renders | `galeria` | 23 | 2,84 MB |
| Planos | `planos` | 32 | 3,86 MB |
| Páginas de brochure | `brochurePags` | 72 | 5,21 MB |
| Portadas de desarrollos | `portada` | 7 | 1,34 MB |
| Portada general | `portada` (raíz) | 1 | 0,06 MB |
| Logo | (estaba en el código, `var LOGO`) | 1 | 0,04 MB |
| **Total** | | **174** | **18,9 MB (19.833.950 bytes)** |

Formatos: 107 JPEG, 66 WebP, 1 PNG (logo). El formato declarado en cada base64 coincide
con el real en las 174. No se recomprimió ni redimensionó nada: cada archivo tiene los
mismos bytes que estaban en el base64.

Por desarrollo: Patagonia 15 = 74 archivos (4,97 MB) · Magna 11 = 52 (6,72 MB) ·
Reggia 6 = 22 (3,14 MB) · Reggia 7 = 15 (2,36 MB) · Reggia 9 = 7 (1,36 MB) ·
Ignea 15 = 1 · Foresta = 1 · general = 2.

### Duplicados

Se compararon las 174 imágenes por huella SHA-256: **no hay ningún par idéntico**.
Ninguna portada es igual byte a byte a una foto o render (aunque se parezcan, el archivo
es distinto), por eso cada portada tiene su propio archivo. El extractor ya está preparado:
si en el futuro dos imágenes son idénticas, guarda un solo archivo y las dos referencias
apuntan a él. Las dos fotos "casi iguales" de Reggia 7 son distintas a nivel de bytes y
quedaron como dos archivos (decisión pendiente con Nahir, no se tocaron).

### Comparación original vs. extraído

| Control | Original | Extraído |
|---|---|---|
| Desarrollos | 17 | 17 |
| Unidades disponibles | 207 | 207 |
| Referencias de imágenes | 174 | 174 |
| Fotos / renders / planos / páginas | 38 / 23 / 32 / 72 | 38 / 23 / 32 / 72 |
| Portadas / portada general / logo | 7 / 1 / 1 | 7 / 1 / 1 |
| Campos vacíos | 197 | 197 |
| Fecha `actualizado` | 2026-11-06 | 2026-11-06 |

### Integridad (resultado de `validar_extraccion.py`: TODO CORRECTO)

- Los 174 archivos existen, tienen firma de imagen válida, medidas legibles y su huella coincide con el inventario.
- La carpeta `media/` tiene exactamente esos 174 archivos, sin sobrantes.
- Las 174 imágenes son byte a byte iguales al base64 original decodificado.
- Ninguna referencia rota: las 173 rutas de `desarrollos.json` (todas menos el logo) existen.
- `desarrollos.json` ya no contiene ningún base64.
- El orden de fotos, renders, planos y páginas de brochure es el original.
- Todo lo que no es imagen es idéntico: precios (siguen como texto), superficies, tablas,
  columnas personalizadas, notas al pie, grupos/torres, links vacíos, posesión y gastos.
- Cada desarrollo conserva todos sus campos, en el mismo orden, y los mismos `id`.
- **Prueba total:** si se vuelven a meter las imágenes en el JSON, se obtiene exactamente el JSON original.
- **Prueba del validador:** en una copia aparte se cambió un precio (USD 156.948 → 156.949)
  y un solo byte de una foto, y el validador detectó las dos cosas (6 fallas). Es decir,
  el control realmente detecta alteraciones.

Para repetir el control en cualquier momento:

```
python scripts/validar_extraccion.py
```

### Qué quedó preparado para React

- `datos/desarrollos.json` tiene **la misma forma** que el JSON original
  (`actualizado`, `portada`, `emprendimientos`). Lo único que cambió es que, donde había
  una imagen en base64, ahora hay una ruta como `media/reggia-6/fotos/foto-01.jpg`.
  El código actual de la página puede usarlo casi sin cambios: un `<img src>` acepta igual una ruta.
- **Links compatibles:** los `id` (`patagonia-15`, `reggia-6`…) no cambiaron, así que `/#reggia-6` puede seguir funcionando.
- **Descargar una foto:** cada imagen es un archivo con su extensión real.
- **ZIP de galerías:** cada sección es una carpeta con los archivos numerados en orden.
- **PDF del brochure:** las 72 páginas están en `brochure/pagina-NN`, en orden, con su ancho y alto
  en `medios.json` (el PDF actual usa las medidas de cada página).
- **Filtros por torre/grupo, notas y columnas:** `grupo`, `columnas` y `notaTabla` se conservaron sin cambios.
- `medios.json` trae ancho y alto de cada imagen: React puede reservar el espacio antes de
  que cargue la foto, para que la página no "salte".

### Qué quedó preparado para Supabase (sin implementar)

- Cada archivo tiene una ruta estable y una huella SHA-256: se puede subir tal cual a
  Supabase Storage usando la misma ruta, y la huella sirve para detectar si cambió.
- `medios.json → referencias` ya tiene la forma de una tabla: desarrollo, sección, orden, archivo.
- `desarrollos.json` se separa naturalmente en tablas: desarrollos (datos generales),
  unidades (`disponibles`, con sus columnas libres) y medios (las referencias).
- Los precios están como texto: al pasarlos a base de datos hay que decidir con Nahir si se
  guardan también como número. **No se convirtió nada.**

### Seguridad de esta fase

- No hay credenciales ni datos de clientes en los archivos nuevos (las imágenes ya se
  revisaron en la fase 1: sin datos de ubicación).
- Se agregó `.gitignore` para que nunca se suban `.env`, planillas Excel/CSV, bases de datos ni `.zip`.
- Todo se guardó en la rama `desarrollo`. Nada se subió a GitHub ni a Netlify.

### Pendiente para revisar con Nahir (sin cambios en esta fase)

- Cocheras de Reggia 9: la lista decía "$32.00" y se cargó como USD 32.000.
- Tapa del brochure de Reggia 6, que muestra un "5".
- Columna de precio contado en Reggia 6/7 (7% de descuento).
- Las dos fotos casi iguales de Reggia 7.
