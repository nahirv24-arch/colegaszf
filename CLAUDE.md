# Página "Material para colegas" · ZF Propiedades — resumen para seguir en Claude Code

Última actualización: 20/11/2026. La dueña es Nahir (marketing de ZF Propiedades, Córdoba). Usa Windows y Chrome y
**no programa**: todo se le explica en castellano simple, sin comandos. En ZF se dice **"desarrollos"**, nunca
"emprendimientos".

Es una página para colegas inmobiliarios con el material de cada desarrollo, más Terceros y Locales comerciales /
oficinas. Es un proyecto aparte del Panel de Marketing: no tienen nada que ver.

## Dónde está cada cosa

- **Carpeta del proyecto (computadora actual, desde el 20/11/2026):**
  `C:\Users\DELL\Downloads\zf-colegas-actualizado-20261120T133242Z-1-001\zf-colegas-actualizado`.
  La computadora anterior usaba `C:\Users\Propietario\Downloads\...`. Las rutas viejas que aparecen en otros `.md`
  ya no existen en esta computadora.
- **Repositorio:** GitHub `nahirv24-arch/colegaszf`. Ramas `desarrollo` (trabajo) y `main` (publicada). Desde el 20/11 (pase
  a producción de las etapas 2 a 5) las dos quedaron iguales otra vez. La etiqueta `respaldo-2026-11-11` guarda la página original de un solo archivo.
- **Página publicada:** Cloudflare Pages, en `https://colegaszf.pages.dev`. Publica solo `main` y se actualiza sola al subir
  a `main`. Ver `CLOUDFLARE.md`.
- **Netlify:** `colegaszfpropiedades.netlify.app` todavía muestra la página **original** (Netlify Drop). El plan gratis
  agotó los créditos hasta el 2/12/2026. `colegaszf-pruebas.netlify.app` es el sitio de pruebas (rama `desarrollo`).
  **Los dos se van a borrar** (ver Pendientes).
- **Supabase:** `zf-colegas-pruebas` (para pruebas, en `.env.local`) y `zf-colegas-produccion` (en São Paulo, en
  `.env.produccion`). Los archivos `.env*` tienen claves secretas: **nunca** van a Git, a Cloudflare ni a Netlify, y nunca
  se muestran en el chat.
- **Panel de administración:** `/admin`. Nahir carga y publica el material desde ahí. Ya no se edita JSON a mano.

## Cómo está armado

- React + TypeScript + Vite (`web/src/`). La página pública está en `paginas/` y `componentes/`, y el panel en `admin/`.
- Datos en Supabase. Cada desarrollo o propiedad tiene un **borrador** y una **versión publicada**. Lo publicado aparece en
  la página sin volver a desplegar.
- `datos/` y `media/` son los originales extraídos el 11/11 del `index.html` viejo, que también sigue en la carpeta (26 MB).
  Sirven solo como fuente de importación y respaldo. El contenido real actual está en Supabase de producción.
- Migraciones en `supabase/migrations/` (solo aditivas). Scripts en `scripts/supabase/` (`npm run sb:*`). Los que tocan
  producción piden `--produccion --confirmo-produccion`, y las pruebas que crean datos se niegan a correr en producción.
- Respaldos de datos en `respaldos/` (ignorada por Git). En el panel: Configuración → Descargar respaldo completo.
- Historial detallado por fases: `MIGRACION.md`. Procedimientos de producción: `PRODUCCION.md`.

## Computadora actual (DELL, desde el 20/11/2026)

- Se instalaron Node.js 26 LTS (con winget) y Git 2.56. Se corrió `npm ci`, y `npm run typecheck` dio OK.
  Cloudflare y Netlify compilan con Node 24 (`.nvmrc`): conviene que el código siga funcionando con las dos versiones.
- Si `node` o `git` no aparecen en una consola nueva, hay que recargar el PATH desde el registro de Windows.
- Para abrir la página o el panel acá: `abrir_pagina_nueva.bat` y `abrir_panel.bat` (puerto 5173; el panel usa Supabase
  de prueba). `.claude/launch.json` tiene las configuraciones para el navegador integrado.
- Todavía no se abrió el panel en esta computadora ni se probó subir a GitHub desde acá. Puede pedir iniciar sesión en
  GitHub.

## Funcionalidades (resumen)

- Inicio con HERO y «¿Qué material estás buscando?» con 3 tarjetas: Desarrollos, Terceros y Locales comerciales / oficinas.
  Debajo está la grilla de desarrollos (los que tienen más material van primero) con la fecha de posesión.
- Ficha de desarrollo con pestañas Imágenes (fotos reales), Renders, Planos y Brochure, y tabla de disponibles con
  **M² totales**. Los precios están tapados y se ven de a una unidad con «Ver precio». Descargas en ZIP y PDF.
- Terceros y Locales/oficinas en formato tabla. Terceros tiene las columnas «Llave» y «Escritura». Locales muestra solo m²
  totales y no muestra el Cód. Tokko (que sí está en el panel).
- Panel: dashboard (indicadores, gráficos, completitud del material, actividad), desarrollos, unidades, multimedia,
  versiones e historial, Terceros, Locales y **Colegas** (registro de a quién se le dio acceso; solo administración).
- Pie con la web, Instagram (https://www.instagram.com/zfpropiedades/) y WhatsApp comercial (https://wa.me/5493516378970).

## Mejoras del 20/11/2026 (etapas 1 a 5 terminadas y en producción)

Pedido: condiciones de publicación, descripción y escribanía en cada desarrollo; planos en PDF con tipologías y
descargas (individual y ZIP); descarga de fotos en Terceros. Plan completo presentado en la Etapa 1.
- **Etapa 2 (hecha en PRUEBA, 20/11):** migración `20261120120000_condiciones_descripcion_escribania.sql`. Agrega
  `condiciones`, `descripcion` y `escribania` a `desarrollos`. El JSON publicado los incluye **solo si tienen texto**,
  así no aparecen falsos «cambios sin publicar». Panel: grupo «Información para colegas» en `FormDatos.tsx`. Ficha: el
  componente `TextoLibre` (párrafos y listas con «-») va antes de la línea de posesión. Pruebas: `npm run pruebas`.
  En producción desde el 20/11.
- **Etapa 3 (hecha en PRUEBA, 20/11):** migración `20261120130000_planos_pdf_tipologias.sql` (formato `pdf` solo para
  planos; datos del plano en `medios.metadatos`: `titulo`, `tipologia`, `variante`, `vista` = miniatura webp aparte;
  funciones `editar_plano`, `vista_plano`, `reemplazar_medio_conservando`; el JSON suma `planosInfo` solo si algún
  plano es PDF o tiene datos; `restaurar_version` devuelve los datos de cada plano). La miniatura la arma el panel con
  pdf.js (`admin/vistaPdf.ts`, se carga solo en el panel). Ficha: `componentes/Planos.tsx` (etiqueta encima de la
  miniatura, «Descargar PDF», «Descargar todos los planos» = ZIP sin recomprimir). Nombres de archivo en
  `utilidades/planos.ts`. Probado en el navegador (subir, reemplazar, descargas con bytes idénticos, celular).
  En producción desde el 20/11.
- **Etapa 4 (hecha en PRUEBA, 20/11; sin migración):** panel: columna «Fotos (N)» en la tabla de Terceros / Locales
  (lleva a la pestaña «Fotos y documentos» de esa propiedad; desactivada si hay cambios sin guardar) y «Reemplazar» en
  `MaterialPropiedad` (`reemplazarMedioProp`: el anterior queda en «Ver quitados»). Página: «Ver fotos (N)» por fila en
  `TablaComercios` abre `componentes/FotosPropiedad.tsx` debajo de la fila (miniaturas, visor, «Descargar» y «Descargar
  todas las fotos» = ZIP `Terceros_<Dirección>_Fotos.zip` sin recomprimir). Nombres en `utilidades/fotosPropiedad.ts`.
  Ojo: «Publicar tabla» cambia la fecha «actualizado» (comportamiento de siempre); en PRUEBA se volvió a 18/11.
  En producción desde el 20/11.
- **Etapa 5 (pruebas finales, hecha en PRUEBA, 20/11):** las 16 verificaciones del pedido OK. Respaldo comparado con el
  de antes de empezar: 17 desarrollos, 207 unidades y 174 archivos activos idénticos. Huellas de lo público idénticas.
  Recorridas 17 pantallas (panel y página) sin errores; celular sin desborde. Se corrigió que la miniatura de un PDF
  quedaba colgada si la pestaña estaba en segundo plano (`intent: "print"` en pdf.js + límite de 60 s; si falla, el PDF
  queda guardado y se usa «Rehacer miniatura»). Cuenta temporal bloqueada
  (`privado/cuenta-navegador-bloqueada-2026-11-20-b.json`).
- **PASADO A PRODUCCIÓN el 20/11/2026** con autorización de Nahir: respaldo
  `respaldos/exportacion-2026-11-20T15-09-28-076Z.json`, migraciones 20261120120000 y 20261120130000 aplicadas,
  contenido público y borradores idénticos antes y después, `main` = `desarrollo` y Cloudflare publicó en 40 s.
  Falta que Nahir pruebe el panel real con su cuenta (subir un PDF, cargar textos, fotos de Terceros).
  Pasos que se siguieron (sirven de modelo para la próxima vez):
  1. Respaldo: `npm run sb:exportar -- --produccion` y anotar la huella de `contenido_publico`.
  2. Ver qué falta: `npm run sb:migrar -- --ver --produccion --confirmo-produccion` (deben ser solo
     `20261120120000_…` y `20261120130000_…`).
  3. Aplicar: `npm run sb:migrar -- --produccion --confirmo-produccion`. Comprobar que lo público no cambió y que no
     aparecen «cambios sin publicar» falsos.
  4. Recién después, pasar `desarrollo` → `main` y subir (Cloudflare publica solo). Si el código llegara antes que
     las migraciones, el panel fallaría al guardar los campos nuevos o subir PDF (la página pública no se rompe).
  5. Revisar `colegaszf.pages.dev` y el panel con la cuenta de Nahir.
- **Planos siempre en PDF (20/11, commit 45ee560 en `desarrollo`):** en producción todos los planos eran imágenes y se
  bajaban como JPG/PNG. Ahora el botón, el visor y el ZIP entregan PDF: si es PDF, el original; si es imagen,
  `utilidades/pdfDeImagen.ts` arma un PDF sin librerías y sin pérdida (JPG tal cual, datos del PNG tal cual, WEBP por
  píxeles). Comprobado idéntico píxel a píxel con pdf.js.
- **Planos en PDF publicado** en `main` el 21/11 con OK de Nahir. También publicados (24/11): pie con «Nueva Córdoba,
  Córdoba» junto, «Ver fotos» a la derecha de «Ver ficha» en Terceros, texto de Desarrollos al ancho de la grilla y
  aviso «Actualizamos los jueves · la última fue el…» resaltado.
- **`contenido_publico()` rápida (24/11, migración `20261124120000_contenido_publico_rapido.sql`, APLICADA EN PRODUCCIÓN
  con OK de Nahir):** antes tardaba ~1,3 s (cruzaba cada archivo con las 602 filas de `medios`) y con 3 visitas a la vez
  daba «statement timeout» → «No pudimos cargar el material». Ahora ~0,14 s, 3 a la vez sin error. JSON idéntico antes y
  después (huella d5e927b5…). Respaldo `respaldos/exportacion-2026-11-24T13-22-20-116Z.json`. Para medir/comparar:
  `node scripts/supabase/medir_contenido.mjs [--produccion] --guardar archivo.json` (solo lee).
- **Cuentas de colegas (26/11, en producción con OK de Nahir):** página cerrada con usuario y contraseña; los colegas se
  crean la cuenta solos y **entran al instante, sin aprobación** (migración `20261126160000_registro_sin_aprobacion.sql`;
  freno: 20 registros/hora, 100/día). La sesión queda guardada en el dispositivo (Supabase, `persistSession`) hasta
  «Salir». Panel: Colegas (pausar/quitar) y «Métricas de colegas». Guía A4 para colegas en `../tutorial-colegas/`
  (WhatsApp +54 9 3513 07-8944; desde el 26/11 la página también usa ese número).
- **Seguimiento comercial (27/11, EN PRODUCCIÓN desde el 27/11 con OK de Nahir; solo el panel):** migración
  `20261127120000_seguimiento_comercial.sql` (solo agrega): tablas `reuniones` (asistentes = uuid[] de colegas),
  `consultas`, `visitas`, `operaciones` (reserva/venta/caída, monto, comisión) y `pendientes`, todas solo admin
  (es_admin), sin historial (como `colegas`); clave `configuracion.seguimiento` (inicio de la idea vacío,
  lanzamiento 2026-11-27, fecha límite 2027-07-01, metas opcionales). Panel: «Métricas de colegas» ahora tiene
  pestañas (`MetricasPanel.tsx`): Resultados (`Resultados.tsx`: plazo, metas, embudo, ranking, mes a mes, origen,
  «¿Sirven las reuniones?», comisiones a pagar), Reuniones / Visitas / Reservas y ventas / Consultas / Pendientes
  (`Registros.tsx`, genérico, con «Descargar (Excel)» y «Venta →» desde una visita) y Uso de la página (la de antes).
  Respaldos (`sb:exportar` y el del panel) incluyen `seguimiento`. Pruebas: `node scripts/supabase/pruebas_seguimiento.mjs`
  (30 OK). Ojo: la clase `.adm-seg` ya existía (gráfico segmentado); lo nuevo usa `.adm-sg-*`.
- **Inicio con 3 desarrollos por fila en la compu (27/11, commit en `desarrollo`, falta OK para `main`).**
- **Mapa de ubicaciones (27/11, hecho en PRUEBA, falta OK para producción):** migración
  `20261127150000_ubicacion_desarrollos.sql` (solo agrega `lat`/`lng` en `desarrollos`; efecto inmediato como
  `desactualizado`, no entra en las versiones ni genera «cambios sin publicar»; `contenido_publico()` suma
  `"ubicacion"` solo si está cargada). Página: sección «Ubicaciones» debajo de la grilla
  (`componentes/MapaDesarrollos.tsx`, Leaflet + OpenStreetMap, se carga aparte; lista al costado / tira en celular;
  ficha del pin con foto, posesión, «Ver material» y «Cómo llegar»). Panel: pestaña «Ubicación» de cada desarrollo
  (`admin/paginas/UbicacionDesarrollo.tsx`: buscar dirección, tocar el mapa / arrastrar el pin, pegar coordenadas de
  Google Maps, «Quitar del mapa»). Coordenadas iniciales en `scripts/supabase/ubicaciones_iniciales.json`, se cargan con
  `node scripts/supabase/cargar_ubicaciones.mjs [--ver] [--produccion --confirmo-produccion]` (no pisa las que ya
  tengan ubicación). Aproximadas (revisar con Nahir): Ignea 15, Cañitas Park y Foresta. Toscana 8 no tiene dirección.
  Para producción: respaldo → migración → `cargar_ubicaciones` → comparar lo público (solo cambia `ubicacion`) → `main`.
- Ojo con Git Bash: un argumento que empieza con «/admin…» se convierte en una ruta de Windows; en scripts de captura
  conviene navegar con `location.href` desde la página.
- Ojo: una cuenta temporal (`cuenta_navegador.mjs`) que **publicó** versiones no se puede borrar («Database error
  deleting user»). Se le quitó el rol y se la bloqueó (`privado/cuenta-navegador-bloqueada-2026-11-20.json`).
- `verificar.mjs` en PRUEBA da 14/15: la fecha «actualizado» de la base de pruebas (18/11) difiere de la del JSON
  original. Ya pasaba antes de estos cambios.

## Pendientes

1. Pantalla para recuperar versiones anteriores de una propiedad (las versiones se guardan, pero falta la pantalla).
2. Estadísticas de visitantes: falta elegir la herramienta (un contador sin cookies o las estadísticas de Cloudflare).
3. Netlify: Nahir decidió (20/11/2026) **borrar** el sitio `colegaszfpropiedades.netlify.app`. Lo borra ella desde
   Netlify (Site configuration → Delete this site); no se puede deshacer. Antes conviene avisar a los colegas el link
   nuevo (`colegaszf.pages.dev`), porque el viejo deja de funcionar. También decidió borrar el sitio de pruebas
   `colegaszf-pruebas.netlify.app`. Después, los cambios se prueban en esta computadora (`abrir_panel.bat`, con Supabase
   de prueba) antes de pasarlos a `main`. `netlify.toml` y `web/public/_redirects` quedan sin uso (Cloudflare los
   ignora). Se pueden quitar más adelante.
4. Revisar con Nahir (pendiente desde antes de la migración; puede que ya lo haya corregido desde el panel):
   - los precios de cocheras de Reggia 9: la lista decía "$32.00" y se tomaron como USD 32.000;
   - la tapa del brochure de Reggia 6, que muestra un "5";
   - si se agrega la columna de precio contado en Reggia 6/7 (7% de descuento);
   - las dos fotos casi iguales de Reggia 7.
5. Cargar el material de los desarrollos que faltan. El dashboard del panel muestra cuáles están incompletos.

## Reglas

- Usar "desarrollos" en todos los textos visibles.
- Antes de cada cambio de datos, hacer un respaldo (`npm run sb:exportar`, con `--produccion` si corresponde).
- Trabajar en la rama `desarrollo` y pasar a `main` (que se publica) solo con el OK de Nahir.
- Cualquier acción sobre producción (migraciones, importaciones, publicar) necesita la autorización expresa de Nahir.
- No modificar los archivos originales de Nahir: trabajar sobre una copia.
