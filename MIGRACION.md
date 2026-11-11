# Migración de "Material para colegas" — ZF Propiedades

Registro de las fases de modernización de la página. La página publicada en
Netlify (colegaszfpropiedades.netlify.app) **no cambia** hasta que se decida explícitamente.

| Fase | Estado | Rama |
|---|---|---|
| 1. Análisis y protección | Completa (11/11/2026) | — |
| 2. Separar datos e imágenes | Completa (11/11/2026) | `desarrollo` |
| 3. React + TypeScript + Vite | Completa (11/11/2026) | `desarrollo` |
| 4. Supabase (proyecto de PRUEBA) | Completa (11/11/2026) | `desarrollo` |
| 5. Panel de administración (entorno de prueba) | Completa (11/11/2026) | `desarrollo` |

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

---

## Fase 4 — Supabase: base de datos, archivos, autenticación y permisos (11/11/2026)

**Entorno:** proyecto de PRUEBA `zf-colegas-pruebas` (región São Paulo). La web publicada en Netlify
**no** está conectada; la página React sigue leyendo `datos/` y `media/` locales. `index.html` original,
`datos/`, `media/` y `main` sin cambios.

**Instalado (autorizado por Nahir):** `@supabase/supabase-js` y el CLI `supabase` (solo dentro del
proyecto, sin Docker).

### Configuración

- `.env.local` (NO se sube a GitHub) con 4 datos: dirección del proyecto, clave pública, clave secreta
  y conexión a la base. Modelo: `.env.local.ejemplo`.
- Solo la dirección y la clave **pública** pueden llegar a la página (variables `VITE_*`). Se verificó
  que el código compilado no contiene ninguna clave secreta.
- En Supabase: registro público **desactivado**; Site URL `http://localhost:5173`; redirección
  `http://localhost:5173/admin/**` (para recuperar contraseña).

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run sb:migrar` | Aplica las migraciones pendientes (Supabase recuerda las aplicadas) |
| `npm run sb:importar -- --ver` | Informe previo, sin cambiar nada |
| `npm run sb:importar` | Importa lo que falte (no duplica, no pisa cambios, no borra) |
| `npm run sb:admin -- correo@...` | Da el rol administrador a una cuenta ya creada en Supabase |
| `npm run sb:exportar` | Respaldo completo en `respaldos/` y en el bucket privado |
| `npm run sb:pruebas` | Pruebas de seguridad (cuentas temporales que después se borran) |

### Esquema (supabase/migrations/)

| Migración | Contenido |
|---|---|
| `…120000_esquema.sql` | Tablas |
| `…120100_seguridad.sql` | Roles, sellos de fecha/usuario, historial, privilegios y RLS |
| `…120200_storage.sql` | Buckets `media` (público) y `privado` con sus políticas |
| `…120300_funciones.sql` | Lectura pública, papelera, estadísticas, exportación, importación |
| `…120400_historial_roles.sql` | Corrección detectada por las pruebas (historial de cambios de roles) |

**Tablas**
- `desarrollos`: `id` original (links `/#id`), `posicion` (orden original), nombre, dirección,
  desarrollista, posesión, gastos, `nota_tabla`, `links` (los 3, aunque estén vacíos), `columnas`
  (lista ordenada `[clave, título]`), `disponibles_ejemplo`, `info_extra` (información complementaria),
  `estado` (`borrador`/`publicado`), `visible`, fechas y usuario de creación/modificación, papelera
  (`eliminado_en`, `eliminado_por`).
- `unidades`: desarrollo, `posicion` (fila original), `campos` (TODOS los campos de la fila, como texto),
  `orden_campos` (orden original de los campos). Columnas calculadas solas para filtrar y contar:
  grupo, piso, unidad, tipología, estado, precio (texto, sin convertir). Superficies (`sup`, `total`,
  `suptotal`, `balcon`, `terraza`) y demás columnas propias quedan en `campos`.
- `medios`: desarrollo (vacío = general), `tipo` (portada, foto, render, plano, pagina_brochure,
  portada_general, logo), `orden`, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime,
  metadatos, fechas, papelera. Un solo archivo activo por posición: el orden del brochure queda fijo.
- `configuracion`: clave/valor; `actualizado` = "2026-11-06" (pública).
- `roles_usuario`: `administrador` (y `editor`, reservado para el futuro).
- `historial`: fecha, usuario, rol, tabla, registro, acción (crear, editar, eliminar, restaurar,
  borrar_definitivo), copia de antes y después. No guarda contraseñas (las tablas no tienen ninguna).

**Estados comerciales reales:** "Disponible" (206) y "Reservada" (1). "Vendida" no existe en los datos:
las estadísticas la cuentan (0) e informan `existe_estado_vendida: false`.

### Seguridad (RLS + privilegios SQL)

- Ser administrador lo decide la base (`es_admin()` lee `roles_usuario`), no la página.
- **Visitantes:** solo leen desarrollos `publicado` + `visible` + fuera de la papelera, y sus unidades y
  medios. No escriben nada. No ven roles, historial ni borradores.
- **Usuario con sesión sin rol:** igual que un visitante.
- **Administrador:** lee todo (borradores, ocultos, papelera, historial) y crea/modifica desarrollos,
  unidades, medios y configuración; publica/oculta; usa la papelera.
- **Nadie desde el navegador** puede: asignar roles, escribir el historial, borrar definitivamente
  desarrollos/medios/configuración, ni ejecutar la importación (solo con la clave secreta).
- Las fechas y el usuario de cada cambio los pone la base (no se pueden falsificar).

### Storage

- `media` (público): las 174 imágenes, misma estructura que `media/`
  (`<desarrollo>/fotos|renders|planos|brochure/...`, `general/`). Lectura por dirección directa;
  solo el admin sube o reemplaza; nadie lista salvo el admin; nadie borra desde el navegador.
- `privado` (privado): respaldos (`respaldos/original-2026-11-11/` con los JSON originales y las
  exportaciones). Solo el admin.

### Autenticación (preparada; las pantallas son de la fase 5)

`web/src/servicios/auth.ts`: iniciar sesión (email + contraseña), cerrar sesión (en todos los
dispositivos), consultar si la cuenta es admin (a la base), pedir recuperación de contraseña (respuesta
igual exista o no la cuenta) y guardar contraseña nueva (mínimo 12 caracteres), leer estadísticas.
`web/src/servicios/fuenteSupabase.ts`: fuente de datos alternativa, lista pero **no activada**.

### Importación y resultados

- Informe previo: origen 17 / 207 / 174; base vacía.
- Importación: 17 desarrollos importados, 207 unidades, 174 archivos subidos, 1 configuración.
- **Verificación:** lo que hay en la base, rearmado, tiene el mismo contenido que `datos/desarrollos.json`:
  todos los valores, el orden de desarrollos, unidades, columnas, fotos, renders, planos y páginas, el
  orden de los campos de cada unidad, y los precios como texto. Única diferencia: el orden en que se
  *listan* algunas claves de objetos (dentro de `links`, y la posición de `imagenes` en Reggia 6/7/9),
  que la base guarda ordenadas; no cambia ningún valor ni lo que muestra la página.
- Reimportación: los 17 "ya existía (idéntico)", sin duplicados (17 / 207 / 174).
- Cambio posterior protegido: se modificó la nota de Reggia 7, se reimportó → "MODIFICADO después:
  no se toca" y el cambio siguió ahí; luego se volvió al valor original.
- Respaldo: `npm run sb:exportar` → 17 / 207 / 174 en `respaldos/` y en `privado/respaldos/`.

### Pruebas de seguridad (ejecutadas el 11/11/2026 contra el proyecto de prueba)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Visitante consulta publicados | OK — 17 desarrollos, 207 unidades |
| 2 | Visitante no ve borradores | OK — ni tabla, ni unidades, ni contenido público, ni historial, ni roles |
| 3 | Visitante no modifica nada | OK — 20 intentos rechazados (tablas, funciones, Storage) y datos intactos |
| 4 | Usuario con sesión sin rol no modifica | OK — los mismos 20 intentos rechazados; tampoco ve borradores |
| 5 | Admin consulta y modifica datos de prueba | OK — creó borrador y unidad, editó, papelera y restauración; historial con su usuario |
| 6 | Nadie se asigna admin desde el navegador | OK — inserción, upsert, metadatos de usuario y edición de roles rechazados |
| 7 | Archivos privados no descargables | OK — dirección pública 400; visitante y usuario común rechazados; admin sí |
| 8 | Archivos públicos funcionan | OK — 174 de 174 descargados con bytes idénticos (huella SHA-256) |
| 9 | Datos se conservan al reabrir | OK — conexiones nuevas ven los cambios; datos presentes entre ejecuciones |
| 10 | Importación sin duplicados | OK — segunda ejecución: 17 "ya existía (idéntico)", conteos sin cambios |

Error real encontrado y corregido: el historial no podía registrar cambios de roles (migración
`…120400`). Las pruebas dejan en el historial los registros del desarrollo de prueba (creado y borrado).

Estadísticas leídas como admin: 17 desarrollos, 17 publicados, 0 borradores, 13 con material
incompleto, 207 unidades (206 disponibles, 1 reservada, 0 vendidas), 38 fotos, 23 renders, 32 planos,
72 páginas de brochure, 7 portadas.

**No probado todavía:** el correo de recuperación de contraseña (se prueba con la cuenta real de Nahir)
y el inicio de sesión desde una pantalla (fase 5).

### Cuenta administradora de Nahir (pendiente — la crea ella)

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Su correo y una contraseña fuerte (12+ caracteres, guardada en un gestor de contraseñas);
   marcar **Auto Confirm User**.
3. Avisar el correo; se ejecuta `npm run sb:admin -- su-correo` (solo agrega el rol; no ve la contraseña).

### Pendiente antes del panel visual (fase 5)

1. Crear la cuenta administradora de Nahir y probar inicio de sesión y recuperación de contraseña.
2. Para producción: segundo proyecto de Supabase separado, y correo propio (SMTP) para los avisos de
   contraseña (el correo incluido en Supabase tiene un límite bajo de envíos).
3. Decidir con Nahir: archivos de borradores en `privado` y pasarlos a `media` al publicar.
4. El plan gratuito pausa el proyecto tras una semana sin uso (se reactiva desde el panel).

---

## Fase 5 — Panel de administración (11/11/2026)

Panel en `/admin`, conectado al proyecto de **PRUEBA** de Supabase. La página pública sigue leyendo
`datos/` y `media/` locales (idéntica a la original: misma huella de contenido `ee6ce293…`) y **no**
descarga el código de Supabase. Netlify, `main` e `index.html` original sin cambios.

### Cómo abrir el panel

1. Doble clic en **`abrir_panel.bat`** (carpeta del proyecto). Se abre Chrome en `http://localhost:5173/admin`.
2. Iniciar sesión con `marketingzfpropiedades@gmail.com` y su contraseña. La sesión queda guardada en ese
   navegador y se renueva sola; «Cerrar sesión» (menú izquierdo, abajo) la cierra.
3. ¿Olvidó la contraseña? «¿Olvidaste tu contraseña?» → llega un correo con un enlace (sirve una vez)
   que abre «Elegí una contraseña nueva». *Pendiente de probar con su correo real.*
4. Para cerrar el panel, cerrar la ventana negra.

### Revisión previa (comprobada en Supabase, no supuesta)

17 desarrollos publicados y visibles, 207 unidades, 174 medios; cuenta `marketingzfpropiedades@gmail.com`
confirmada con rol administrador (nunca había iniciado sesión); registro público desactivado; buckets
`media` (público) y `privado`. Se reutilizaron `auth.ts`, `supabase.ts`, `contexto`, `Ficha`, RLS y
funciones de la fase 4.

### Cambios de base de datos (migraciones nuevas, compatibles con los datos)

| Migración | Por qué |
|---|---|
| `…130000_publicacion_versiones.sql` | **Borradores y publicación.** Antes había una sola copia de cada desarrollo: si la web la leyera, cualquier cambio a medio hacer se vería al instante. Ahora las tablas son la *copia de trabajo* (solo admin) y `publicaciones` guarda versiones congeladas; la web lee solo la vigente. Los 17 recibieron su versión 1 idéntica a la original. También: papelera de unidades, funciones `publicar_desarrollo`, `restaurar_version`, `reordenar_unidades`, `reordenar_medios`, `historial_reciente`, `resumen_desarrollos`, `versiones_desarrollo`; `contenido_publico` lee versiones publicadas. |
| `…130100_id_inmutable.sql` | Las pruebas mostraron que el admin podía cambiar el identificador (rompía los links `/#id`). Ahora la base lo impide. |
| `…130200_reemplazar_medio.sql` | Las pruebas mostraron que reemplazar una imagen perdía la referencia a la anterior y no se podía recuperar una versión vieja. Ahora reemplazar = el anterior a la papelera + nuevo en la misma posición, en una sola operación. |

Respaldo previo: `respaldos/exportacion-2026-11-11T05-42-00-838Z.json` (y copia en `privado/respaldos/`).

### Cómo funciona la publicación

- **Guardar cambios** → se guarda en el borrador. La página pública NO cambia.
- **Vista previa ↗** → la ficha tal cual se verá, con lo guardado en el borrador.
- **Publicar / Publicar cambios** → el borrador pasa a ser la versión pública (versión 1, 2, 3…). Opción
  para actualizar la fecha «la última fue el…».
- **Ocultar / Mostrar** → saca o vuelve a poner el desarrollo en la página, enseguida, sin borrar nada.
- **Papelera** → sale de la página y del panel; se recupera desde Desarrollos → Papelera.
- **Versiones e historial** → «Recuperar» carga una versión anterior en el borrador (no publica);
  «Descartar cambios sin publicar» vuelve el borrador a la versión vigente.
- Los archivos de Storage nunca se borran desde el panel: así las versiones anteriores siguen viéndose.
- Cuando se conecte la web: `VITE_FUENTE_DATOS=supabase` hace que la página lea las versiones publicadas,
  y cada «Publicar» se ve sin volver a desplegar (no activado todavía).

### Estructura del panel (`web/src/admin/`)

`AdminApp.tsx` (rutas, protección), `Diseno.tsx` (menú lateral + encabezado, responsive), `sesion.tsx`
(sesión y rol confirmado por la base), `servicio.ts` (todas las operaciones contra Supabase),
`ui.tsx` (avisos, confirmaciones, ventanas, carga, chips), `admin.css` (identidad ZF), y `paginas/`:
Acceso (ingresar, recuperar, nueva contraseña), Dashboard, ListaDesarrollos, NuevoDesarrollo,
EditarDesarrollo (pestañas Datos · Unidades · Multimedia · Versiones e historial), FormDatos,
TablaUnidades (editor de unidad y de columnas), Multimedia, Versiones, Configuración, VistaPrevia,
ElegirDesarrollo. Se descarga solo al entrar a `/admin` (la página pública no lo baja).

### Pruebas

**A) Directo contra Supabase** — `npm run sb:pruebas-panel` (cuentas temporales con contraseña al azar
que se borran al final; desarrollo `prueba-panel-xxxx` que se borra): **16 de 16 OK**.
Inicio/cierre de sesión y acceso no autorizado · crear (borrador, no público) · editar (id inmutable) ·
unidades (agregar, precio texto, superficie, estado, torre, reordenar, quitar/recuperar; borrado definitivo
rechazado) · columnas (agregar, renombrar, reordenar, quitar sin perder datos) · subida de imágenes y
formatos rechazados; usuarios sin rol no suben · reordenar medios (lista incompleta rechazada) · publicar
(aparece con unidades y archivos en orden) · borrador no cambia la web · publicar cambios, fecha, ocultar
y mostrar · reemplazar/quitar sin romper lo publicado y recuperar versión 1 · historial (usuario, antes/
después, sin contraseñas; cuenta común no lo lee) · dashboard con cifras reales · errores sin datos a medias
· los 17 reales idénticos antes y después.
También se volvieron a correr las pruebas de seguridad de la fase 4 (adaptadas a la lectura por versiones):
**9 de 9 OK**.

**B) En el navegador, con la sesión real de Nahir** (ella inició sesión; Claude no escribió su contraseña),
con el desarrollo de prueba `prueba-ui-zf` (borrado al final):

| Prueba | Resultado |
|---|---|
| Sesión: entrar, sesión recordada al reabrir el navegador | OK |
| Acceso no autorizado: sin sesión, `/admin/...` lleva a «Iniciar sesión» sin mostrar datos | OK |
| Dashboard con cifras reales (17/17/0/13 · 207/206/1 · 38/23/32/72), sin «Vendidas» porque no existe | OK |
| Lista: buscador y filtros (Todos, Publicados, Borradores, Ocultos, Cambios sin publicar, Papelera) | OK |
| Crear desarrollo (id generado del nombre), queda borrador y no aparece en la web (verificado en Supabase) | OK |
| Editar datos, nota, información adicional; aviso de cambios sin guardar | OK |
| Columnas: quitar 4, agregar «Cochera», renombrar, reordenar; datos intactos | OK |
| Unidades con teclado (Tab/Enter), agrupadas por torre, editar precio, filtrar, reordenar, quitar con confirmación, recuperar | OK (verificado en Supabase) |
| Multimedia: subir 3 fotos + 3 páginas + portada; un PDF rechazado con mensaje claro | OK |
| Reordenar arrastrando y con flechas | OK |
| Reemplazar (misma posición, anterior a «quitados»), quitar con confirmación, recuperar, usar como portada | OK |
| Vista previa: ficha completa con imágenes de Supabase (8 de 8) y **PDF del brochure de 3 páginas** | OK |
| Publicar (con nota, sin cambiar la fecha real) → aparece en la web (verificado como visitante) | OK |
| Cambio sin publicar → la web sigue con lo publicado; chip «Cambios sin publicar» | OK |
| Ocultar → desaparece de la web; Mostrar → vuelve con la versión publicada | OK |
| Descartar cambios sin publicar (recuperar versión vigente) | OK |
| Historial con fecha, correo, antes y después | OK (se mejoró la lectura: nombres en castellano, se ocultan pasos internos de reordenamiento) |
| Error de conexión simulado: mensaje claro, lo escrito queda en pantalla, al reintentar se guarda | OK |
| Papelera de desarrollos: mandar y sacar | OK |
| Celular (375 px): sin desborde, menú hamburguesa que abre y cierra | OK |
| Configuración: fecha, portada general y logo visibles, respaldo, cuenta | OK (no se cambió nada real) |
| Desarrollos reales en el panel: Patagonia 15 (8 columnas propias, 2 torres, 73 unidades), Magna 11 (52 imágenes) | OK, sin modificar |
| Consola | 1 error encontrado y corregido (regla de validación del identificador inválida en navegadores nuevos) |
| TypeScript estricto y compilación de producción | OK |
| Página pública después de todo | idéntica a la original; no contacta a Supabase |

**No probado (queda documentado):**
- Correo de recuperación de contraseña (requiere el correo real de Nahir; el correo incluido en Supabase
  tiene límite de envíos).
- Cerrar sesión **desde el botón del panel** (se probó a nivel de Supabase; no se cerró la sesión de Nahir
  para no obligarla a volver a entrar). Cambiar contraseña y «cerrar en todos los dispositivos» no se
  probaron para no tocar su cuenta real.
- La selección de archivos se simuló (el navegador automatizado no puede abrir la ventana de archivos de
  Windows); la subida, validación y guardado sí son reales.
- Descarga de respaldo desde Configuración (la exportación se probó con el script).

**Limpieza:** se borraron solo los registros y archivos de prueba (`prueba-panel-*`, `prueba-ui-zf`,
cuentas temporales). Quedan en el historial las entradas de esas pruebas (creado/borrado), como registro.
Al final: 17 desarrollos, 17 públicos, idénticos al JSON original, fecha 2026-11-06.

### Pendientes / decisiones antes de producción

1. Probar con Nahir el correo de recuperación de contraseña; configurar un correo propio (SMTP) para producción.
2. Proyecto de Supabase de **producción** separado (migrar con `sb:migrar`, importar con `sb:importar`).
3. Las imágenes de un borrador se suben al bucket público con nombres imposibles de adivinar; si se quiere
   que sean totalmente privadas hasta publicar, hace falta moverlas al publicar (cambio futuro).
4. La portada general y la fecha se aplican enseguida (no tienen borrador).
5. Conectar la página pública a Supabase (`VITE_FUENTE_DATOS=supabase`) y publicar — fase 6, con autorización.

---

## Fase 6 (en curso) — Integración en el sitio de pruebas (11/11/2026)

Hecho y verificado (detalle completo en el informe de la fase 6):
- `netlify.toml`: el sitio de pruebas lee las versiones publicadas en Supabase (`VITE_FUENTE_DATOS=supabase`).
  Netlify publicó `desarrollo@9f57d2c` automáticamente y sin errores.
- La página conectada a Supabase es idéntica a la original (huella `ee6ce293…`); descargas ZIP/PDF, visor,
  filtros y links viejos funcionan con los datos de Supabase.
- **Sincronización sin nuevo despliegue: 10 de 10 pasos** con el desarrollo de prueba
  `prueba-sincronizacion-zf` (borrador invisible → publicado visible → borrador no cambia lo público →
  publicado visible → oculto invisible → papelera y borrado solo de la prueba).
- Producción preparada, sin crear nada: `PRODUCCION.md`, scripts con `--produccion` y confirmación
  obligatoria, pruebas bloqueadas en producción y `verificar.mjs` (solo lectura, 12 de 12 en prueba).
- Error propio: se borraron los informes de importación de `respaldos/` (no eran respaldos de datos;
  las exportaciones completas siguen en `respaldos/` y en `privado/respaldos/`).

**Pendiente de la fase 6:** prueba online en `colegaszf-pruebas.netlify.app` con la sesión de Netlify de
Nahir (el sitio es privado), cierre de sesión y correo de recuperación de contraseña con ella.

---

## Rediseño del dashboard del panel (11/11/2026)

Solo cambió el **dashboard** del panel (y se agregó la página de historial completo). La página pública,
las tablas, los datos y las políticas RLS no cambiaron.

### Capturas

`docs/capturas/antes-escritorio.jpg`, `antes-movil.jpg` → `despues-escritorio-1.jpg`,
`despues-escritorio-2-material.jpg`, `despues-movil.jpg`.

### Organización nueva

1. **Encabezado** «Resumen general»: fecha de la última actualización de la página, hora de los datos,
   accesos «Actualizar», «Cargar material» y «+ Nuevo desarrollo».
2. **Indicadores** en una franja (no tarjetas repetidas): desarrollos (publicados · borradores), unidades
   (disponibles · reservadas), material cargado y **requieren atención** (rojo; lleva a la tabla filtrada).
3. **Gráficos** (inventario actual / actividad administrativa, rotulados):
   unidades por estado comercial (filtro por desarrollo), material por categoría (total o por desarrollo
   para cada categoría, con enlace a la pestaña Multimedia), estado de publicación (al día, con cambios
   sin publicar, borrador, oculto) y actividad por fecha (muestra «Sin datos suficientes» hasta tener 7
   días con actividad; hoy hay 1).
4. **Material de los desarrollos**: tabla con filtros (Todos 17 · Sin material 10 · Parciales 3 ·
   Completos 4 · Publicados con información pendiente 13), búsqueda, orden por nombre / completitud /
   atención, checklist desplegable (esenciales y opcionales) y botón «Completar material» que abre la
   pestaña del primer punto que falta.
5. **Pendientes de publicar** (borradores y cambios guardados sin publicar) y **actividad reciente**
   compacta (8 grupos, filtros por tipo, pruebas automatizadas ocultas por defecto, detalle al desplegar,
   enlace a **Historial de actividad** `/admin/actividad` con filtros por origen, tipo y desarrollo y
   «Cargar más»).
6. **Visitantes**: aviso de que no está implementado y qué haría falta (contador sin cookies o
   estadísticas de Netlify).

### Criterios de completitud (aprobados por Nahir)

7 puntos esenciales, mismo peso: portada · dirección · fecha de posesión · lista de disponibles (≥1) ·
brochure (≥1 página) · planos (≥1) · fotos **o** renders (≥1). Opcionales (se muestran, no cuentan):
desarrollista · gastos · nota de la tabla · fotos y renders ambos · planilla en vivo.
Atención: alta = publicado e incompleto · media = borrador incompleto · al día = 100 %.
Resultado hoy: 100 % Patagonia 15, Magna 11, Reggia 6, Reggia 7 · 86 % Reggia 9 (faltan fotos o renders) ·
14 % Ignea 15 y Foresta · 0 % los otros 10.

### Historial: pruebas separadas sin tocar el registro

Cada evento se clasifica **al leerlo**: *prueba automatizada* (desarrollos `prueba-*`/`intruso-*`/
`verificacion-*`, cuentas temporales que ya no existen, roles temporales, o ediciones de configuración
hechas con la clave del servidor, que solo hacen los scripts de prueba), *sistema* (importaciones y
scripts) y *administración* (cuenta administradora). Los pasos internos de los reordenamientos no se
muestran. El correo solo aparece en eventos de administración.

### Supabase (migraciones nuevas, solo funciones de lectura)

| Migración | Contenido |
|---|---|
| `…140000_dashboard_analiticas.sql` | `completitud_desarrollos`, `actividad_resumen` (conteos + últimos 80, sin bajar todo el historial), `historial_paginado` (de a 40), `evento_detalle` (antes/después solo al desplegar). Solo administradora. |
| `…140100_origen_configuracion.sql` | Ajuste de la clasificación (ediciones de configuración de los scripts de prueba). |

Respaldo previo: `respaldos/exportacion-2026-11-11T07-05-53-025Z.json`.

### Gráficos

Componentes propios (`web/src/admin/graficos.tsx`), **sin librerías nuevas**: son pocas categorías; una
librería sumaba ~100 KB. Tooltips con mouse y teclado, leyendas con números, estados vacíos y de carga.
Paleta derivada de la marca y **validada para daltonismo** con el validador de dataviz: azul `#2F78A8`,
ámbar `#D08A1F`, violeta `#8A6FC0` (todos los controles OK; el ámbar tiene bajo contraste contra blanco,
por eso todo gráfico lleva números visibles). El azul-gris de la marca no sirve como color de serie
(demasiado oscuro y gris según el validador). Rojo reservado para «atención».
El panel creció 6 KB comprimidos; la página pública no cambió de tamaño.

### Pruebas

| Prueba | Resultado |
|---|---|
| TypeScript estricto y compilación | OK |
| Funciones nuevas: valores, paginación sin solapamiento, filtros, detalle | OK; responden en 0,1–0,3 s |
| Visitante contra las funciones nuevas | 4 de 4 rechazadas |
| Gráficos: filtro por desarrollo, vista por categoría, enlaces, tooltip (mouse y foco), «< 1 %» | OK |
| Material: 5 filtros, búsqueda, orden asc/desc (`aria-sort`), checklist, «Completar material» | OK |
| Actividad: ocultar/mostrar pruebas, filtros por tipo, agrupación, detalle al desplegar | OK |
| Historial completo: filtros, «Cargar más», cambios rápidos de filtro | OK (se corrigió una carrera de respuestas) |
| Escritorio, tablet (768) y celular (375): sin desborde horizontal | OK |
| Otras pantallas del panel (lista, Versiones e historial) | OK |
| `validar_extraccion.py` · seguridad 9/9 · panel 16/16 · verificador 12/12 | OK |
| Consola | Sin errores (los vistos durante la edición eran recargas intermedias y cortes de red) |

### Mejoras pendientes

- Gráfico de actividad por fecha: aparece solo cuando haya 7 días con actividad.
- Analítica de visitantes: no implementada (requiere decidir la herramienta).
- En pantallas angostas la tabla de material se desplaza dentro de su caja; se podría pasar a tarjetas.
- Las demás pantallas del panel (desarrollos, unidades, multimedia) pueden recibir el mismo estilo.
- Las capturas de pantalla automáticas del navegador integrado a veces salen recortadas; conviene una
  revisión visual de Nahir en su pantalla.
