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
- **Repositorio:** GitHub `nahirv24-arch/colegaszf`. Ramas `desarrollo` (trabajo) y `main` (publicada). El 20/11 las dos
  estaban iguales en `efaa442`. La etiqueta `respaldo-2026-11-11` guarda la página original de un solo archivo.
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

## Mejoras en curso (pedido del 20/11/2026, por etapas; cada etapa espera el OK de Nahir)

Pedido: condiciones de publicación, descripción y escribanía en cada desarrollo; planos en PDF con tipologías y
descargas (individual y ZIP); descarga de fotos en Terceros. Plan completo presentado en la Etapa 1.
- **Etapa 2 (hecha en PRUEBA, 20/11):** migración `20261120120000_condiciones_descripcion_escribania.sql`. Agrega
  `condiciones`, `descripcion` y `escribania` a `desarrollos`. El JSON publicado los incluye **solo si tienen texto**,
  así no aparecen falsos «cambios sin publicar». Panel: grupo «Información para colegas» en `FormDatos.tsx`. Ficha: el
  componente `TextoLibre` (párrafos y listas con «-») va antes de la línea de posesión. Pruebas: `npm run pruebas`.
  **Falta:** el OK de Nahir, el commit y aplicarla en producción (primero la migración, después el código a `main`).
- **Etapa 3 (planos PDF + tipologías) y Etapa 4 (fotos de Terceros):** esperan dos decisiones de Nahir. Una: si la
  vista previa de los PDF se genera sola (pdf.js, solo en el panel) o la sube ella. La otra: confirmar que las fotos de
  Terceros se cargan desde el panel (hoy están solo en Tokko, y la tabla pública solo tiene el link «Ver ficha»).
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
