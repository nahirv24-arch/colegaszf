# Migración de "Material para colegas" — ZF Propiedades

Registro de las fases de modernización de la página. La página publicada en
Netlify (colegaszfpropiedades.netlify.app) **no cambia** hasta que se decida explícitamente.

| Fase | Estado | Rama |
|---|---|---|
| 1. Análisis y protección | Completa (11/11/2026) | — |
| 2. Separar datos e imágenes | Completa (11/11/2026) | `desarrollo` |
| 3. React + TypeScript + Vite | Completa (11/11/2026) | `desarrollo` |
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

---

## Fase 3 — React + TypeScript + Vite (11/11/2026)

`index.html` original **sin cambios** (SHA-256 `2F0EEFA4…42FA`). `main` sin cambios. Nada publicado.
La página nueva usa los mismos `datos/` y `media/` de la fase 2: no hay imágenes duplicadas ni base64.

### Cómo verla en la computadora

Doble clic en **`abrir_pagina_nueva.bat`** (carpeta del proyecto). Se abre Chrome en
`http://localhost:5173`. Para cerrarla, cerrar la ventana negra. Es solo una vista local: no publica nada.
(Requiere Node.js, instalado el 11/11/2026.)

Comandos equivalentes: `npm run dev` (ver), `npm run typecheck` (TypeScript), `npm run build`
(compilar a `dist/`), `npm run preview` (ver lo compilado), `npm run validar` (datos de la fase 2).

### Estructura

```
package.json, tsconfig.json, tsconfig.node.json, vite.config.ts
abrir_pagina_nueva.bat         acceso de doble clic
web/
  index.html                   página base de la app (NO es el index.html original)
  public/_redirects            Netlify: /admin y otras rutas abren la app
  src/
    main.tsx                   arranque
    rutas/Rutas.tsx            rutas: "/", "/index.html", "/admin/*"
    paginas/
      PaginaPublica.tsx        elige inicio o ficha según "#id" (links viejos)
      Inicio.tsx               portada + grilla de desarrollos
      Ficha.tsx                ficha de un desarrollo
      admin/AdminRaiz.tsx      lugar reservado para el panel (sin funciones)
    componentes/
      Portada, TarjetaDesarrollo, FilaSeccion (acordeón), TablaDisponibles,
      Galeria, Visor, BotonAccion (ZIP/PDF), Imagen, Pie
    servicios/
      fuente.ts                interfaz FuenteDatos (contrato de la capa de datos)
      fuenteJsonLocal.ts       implementación actual: datos/*.json + media/
      index.ts                 punto único donde se elige la fuente (Supabase en fase 4)
      contexto.tsx             ProveedorDatos + hooks para los componentes
    tipos/datos.ts             tipos de desarrollos, unidades, columnas, medios
    tipos/admin.ts             tipos reservados: estadísticas, historial, estados
    utilidades/                orden por material, textos/fechas, descargas, hash, estadísticas
    estilos/                   CSS original separado por zona (base, portada, inicio, ficha, tabla, galería, pie)
datos/, media/                 (fase 2) — en desarrollo los sirve Vite; al compilar se copian a dist/
```

### Funcionalidades migradas (las 22)

Inicio con portada · tarjetas · orden automático por material · fecha de posesión · ficha individual ·
tabla de disponibles · filtros por torre/grupo · columnas personalizadas · notas al pie · fotos ·
renders · planos · brochure por páginas · visor a pantalla completa · flechas y teclado (← → Esc) ·
descarga individual · ZIP por galería · PDF del brochure · secciones que se abren y cierran ·
"Pendiente" donde falta material · web, Instagram y WhatsApp · diseño para celular.

### Pruebas ejecutadas (todas en esta computadora)

| # | Prueba | Cómo | Resultado |
|---|---|---|---|
| 1 | Ejecutar localmente | `npm run dev` y `npm run preview` | OK |
| 2 | 17 desarrollos | se abrió cada ficha en el navegador | OK, 17 |
| 3 | Datos vs. original | se extrajo todo el texto visible (inicio, 17 fichas con todas las secciones abiertas, 213 filas de tabla, filtros, notas, etiquetas, pie) de la página original y de la nueva: huella SHA-256 idéntica (`ee6ce293…`) en desarrollo y en producción | OK, idénticos |
| 4 | `validar_extraccion.py` | script | TODO CORRECTO |
| 5 | 174 referencias multimedia | se descargó cada archivo desde la app y se comparó su huella con el inventario | 174 de 174 |
| 6 | Galerías | se forzó la carga de todas las imágenes de las 17 fichas | 189 imágenes dibujadas (165 de galerías + 7 portadas + 17 logos), 0 fallidas |
| 7 | ZIP | 4 ZIP (fotos y renders de Patagonia 15, planos de Magna 11, brochure de Reggia 9) comparados con los de la original: nombres, tamaños y CRC de los 33 archivos | idénticos |
| 8 | PDF | los 5 brochures en ambas páginas: cantidad y medidas de páginas | idénticos (32, 22, 8, 5, 5 páginas) |
| 9 | Filtros y tablas | Patagonia 15: Todas = 73 + 2 bandas, Torre 2 = 47 + banda, Torre 1 = 26 + banda; el filtro se conserva al cerrar y abrir | OK |
| 10 | Links viejos | `/#patagonia-15`, `/#reggia-6`, `/#REGGIA-7`, `/#reggia-9`, `/index.html#magna-11` abren la ficha correcta; `/#no-existe` y rutas desconocidas → inicio; volver y "atrás" del navegador | OK |
| 11 | Escritorio y celular | posición, tamaño, letra y color de cada elemento (inicio y 6 fichas) comparados con la original a 1024 px y 375 px | idénticos en ambos tamaños; sin desborde horizontal |
| 12 | TypeScript estricto | `npm run typecheck` | 0 errores |
| 13 | Compilación de producción | `npm run build` | OK |
| 14 | Consola y referencias | consola del navegador en desarrollo y producción | 0 errores, 0 pedidos fallidos |
| 15 | Comparación visual | capturas lado a lado + comparación de medidas (prueba 11) | sin diferencias |

Visor probado: abre en la imagen tocada, → avanza, ← dos veces da la vuelta (12/12), Esc cierra,
"Descargar esta imagen" entrega el archivo original.

**Error encontrado y corregido durante las pruebas:** en modo desarrollo, el botón del ZIP/PDF quedaba
en "Armando…" después de terminar (efecto del modo estricto de React). Se corrigió en `BotonAccion.tsx`
y se volvió a probar: vuelve a su texto normal.

**No probado automáticamente:** las descargas se interceptaron en el navegador para revisarlas sin
guardarlas en la computadora; no se abrió el PDF en un lector de PDF. Tampoco se probó en un
teléfono real (se usó la simulación de celular del navegador) ni en Safari/iPhone.

### Diferencias con la página original

Visuales: ninguna medida o color distinto en las pruebas. Funcionales:
- **Modo `#editar` eliminado.** `/#editar` ahora abre el inicio sin controles de edición (ver abajo).
- **Las imágenes se cargan cuando hacen falta:** la ficha arma cada sección al abrirla por primera vez
  y las imágenes se piden al acercarse a la pantalla. La original traía las 25 MB de una vez.
- **ZIP y PDF ya no dependen de internet:** JSZip y jsPDF vienen incluidos y se cargan solo al tocar
  el botón (antes se bajaban de cdnjs). jsPDF pasó de 2.5.1 a 4.2.1 (la 2.5.1 tiene fallas de
  seguridad conocidas); los PDF resultan iguales en cantidad y medidas de páginas.
- Se agregó el logo como ícono de la pestaña.
- `/admin` muestra "todavía no está disponible" (no existía).
- Se mantuvo a propósito un detalle del original: la imagen bajada desde el visor se llama
  `imagen-N` (sin el nombre del desarrollo). Cambiarlo es una mejora para decidir.
- Si se pide una dirección de imagen que no existe, el servidor devuelve la página (comportamiento
  normal de una app así); no afecta a ninguna imagen real.

### Tamaño de la compilación (`dist/`)

| Parte | Tamaño |
|---|---|
| Lo que carga al abrir la página: HTML + código + estilos | 1 KB + 277 KB (88 KB comprimido) + 12 KB (3 KB comprimido) |
| Datos (`desarrollos.json` + `medios.json`) | 182 KB |
| JSZip (solo al pedir un ZIP) | 96 KB |
| jsPDF y sus complementos (solo al pedir un PDF) | ~780 KB |
| Panel `/admin` (solo al entrar ahí) | 0,7 KB |
| Imágenes (174, sin cambios) | 18,9 MB |
| **Total** | **20,2 MB en 187 archivos** (el mayor: 0,53 MB) |

Para comparar: la original obliga a bajar 25,3 MB antes de mostrar nada; la nueva muestra el
inicio con ~0,5 MB más las fotos de las tarjetas. Todos los archivos están por debajo del límite
de 25 MB de Cloudflare Pages.

### Preparación para Supabase y el panel de administración (sin implementar)

- **Capa de datos intercambiable:** los componentes solo usan `FuenteDatos` (`cargar()` y `urlMedio()`).
  Para Supabase se escribe `fuenteSupabase.ts` con la misma interfaz y se cambia una línea en
  `servicios/index.ts`. Ningún componente cambia.
- **Rutas:** `/admin/*` ya existe y se carga en un archivo aparte (los colegas no descargan su código).
  Hoy no muestra datos, no tiene formularios ni inicio de sesión, y pide a los buscadores no indexarla.
  `_redirects` ya está listo para que Netlify sirva `/admin`.
- **Estadísticas:** `utilidades/estadisticas.ts` calcula desde los datos reales: desarrollos,
  publicados/borradores, unidades, fotos, renders, planos, páginas de brochure, portadas.
- **Publicar/ocultar:** el tipo `Desarrollo` tiene `publicado?` (opcional, no existe en los datos):
  si falta, el desarrollo se muestra, como hoy. La página pública ya oculta los que tengan `publicado: false`.
- **Historial y recuperación:** tipo `CambioRegistrado` reservado (`tipos/admin.ts`).

#### Lo que hacía el modo `#editar` (a reproducir en el panel seguro)

Se activaba agregando `#editar` a la dirección (cualquiera podía hacerlo; los cambios quedaban solo
en ese navegador hasta descargar el archivo). Permitía:
1. **Agregar desarrollo** y **Editar este desarrollo**: nombre, dirección, desarrollista, posesión,
   gastos, links (disponibles, brochure, plano general), portada y las cuatro galerías (subir varias
   imágenes, quitar una, elegir cuál es la portada). El `id` se generaba del nombre sin acentos.
2. Las imágenes subidas se achicaban a 1600 px (portadas) o 1400 px (galerías) en JPEG 0,82.
3. **Cambiar portada** general de la página.
4. **Quitar** un desarrollo (con confirmación de 5 segundos).
5. Cada cambio actualizaba la fecha `actualizado`.
6. **Guardar y descargar**: bajaba un `index.html` nuevo para subir a mano a Netlify (con instrucciones).
7. No permitía editar la tabla de disponibles, columnas ni notas (eso se hacía editando el JSON).

### Git

Todo en la rama `desarrollo`. No se hizo push de esta fase. `node_modules/` y `dist/` no se guardan
en Git (se regeneran con `npm install` y `npm run build`).
