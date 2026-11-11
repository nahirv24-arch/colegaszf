# Pasar a producción — Material para colegas · ZF Propiedades

Procedimiento preparado en la fase 6 (11/11/2026). **Nada de esto se ejecutó todavía.**
Cada paso que crea o cambia algo en producción requiere la autorización de Nahir.

## Situación actual

| Pieza | Prueba (hoy) | Producción (hoy) | Producción (al terminar) |
|---|---|---|---|
| Página | `colegaszf-pruebas.netlify.app` (rama `desarrollo`, privada con login de Netlify) | `colegaszfpropiedades.netlify.app` (HTML original, Netlify Drop) | Misma dirección, aplicación React leyendo Supabase de producción |
| Supabase | proyecto `zf-colegas-pruebas` | — | proyecto nuevo `zf-colegas-produccion` |
| Panel | `…pruebas.netlify.app/admin` | — | `colegaszfpropiedades.netlify.app/admin` |

**Principios:** producción es un proyecto de Supabase **independiente**; no se copian usuarios, sesiones
ni contraseñas de prueba; el sitio original no se toca hasta el paso 9 y se puede volver a él en un clic.

---

## Paso 1 — Respaldo previo (sin riesgo)

1. `npm run sb:exportar` (respaldo completo del proyecto de prueba, por si se quiere comparar).
2. Guardar el `index.html` original: ya está en `C:\Users\Propietario\Downloads\zf-colegas-respaldos\`
   y en la etiqueta Git `respaldo-2026-11-11` (rama `main`).
3. En Netlify (sitio de producción) → *Deploys*: anotar el último deploy publicado (es la versión
   original; se usa para volver atrás).

## Paso 2 — Crear el proyecto de Supabase de producción (lo hace Nahir)

1. supabase.com → **New project** → nombre `zf-colegas-produccion`, región **São Paulo**,
   contraseña de base generada y guardada en un gestor de contraseñas.
2. **Authentication → Sign In / Providers**: desactivar «Allow new users to sign up».
3. **Authentication → URL Configuration**:
   - Site URL: `https://colegaszfpropiedades.netlify.app`
   - Redirect URLs: `https://colegaszfpropiedades.netlify.app/admin/**`
4. **Correo propio (recomendado)**: Authentication → SMTP Settings con una casilla de ZF (el correo
   incluido en Supabase tiene un límite muy bajo de envíos y puede no llegar).
5. Crear en la carpeta del proyecto el archivo **`.env.produccion`** (mismo formato que `.env.local.ejemplo`)
   con los 4 datos del proyecto NUEVO. Nunca se sube a GitHub (está en `.gitignore`).

## Paso 3 — Esquema, seguridad y Storage (migraciones)

```
node scripts/supabase/migrar.mjs --produccion --ver
node scripts/supabase/migrar.mjs --produccion --confirmo-produccion
```
Aplica en orden las 8 migraciones de `supabase/migrations/` (tablas, RLS, Storage con buckets `media`
y `privado`, funciones, versiones publicadas, identificador inmutable, reemplazo de archivos).
Supabase recuerda las aplicadas: repetir el comando no duplica nada.

## Paso 4 — Importar los 17 desarrollos y sus 174 archivos

```
node scripts/supabase/importar.mjs --produccion --ver
node scripts/supabase/importar.mjs --produccion --confirmo-produccion
```
- Fuente: `datos/desarrollos.json`, `datos/medios.json` y `media/` (los originales de la fase 2),
  **no** el proyecto de prueba. Así producción arranca exactamente con el contenido publicado hoy.
- Crea la versión publicada 1 de cada desarrollo, sube los archivos sin recomprimir, guarda una copia
  de los JSON originales en `privado/respaldos/original-2026-11-11/` y deja un informe en `respaldos/`.
- Si algo falla: se puede volver a ejecutar; lo que ya entró no se duplica ni se pisa.
- Si hubo cambios cargados en el panel de PRUEBA que se quieran llevar a producción, se decide caso por
  caso (por defecto NO se copian).

## Paso 5 — Cuenta administradora de producción (la crea Nahir)

1. Supabase (producción) → Authentication → Users → **Add user** → su correo y una contraseña **nueva**
   (distinta de la de prueba) → marcar Auto Confirm.
2. `node scripts/supabase/asignar_admin.mjs su-correo --produccion --confirmo-produccion`

## Paso 6 — Validación de integridad (solo lectura)

```
node scripts/supabase/verificar.mjs --produccion
```
Tiene que dar **12 de 12 OK**: 17 desarrollos, 207 unidades, contenido idéntico al JSON original,
174 archivos con bytes idénticos, visitante sin permisos de escritura ni lectura de borradores/historial/
roles, bucket privado cerrado, registro público desactivado y al menos una administradora.
Las pruebas que crean datos (`pruebas_seguridad`, `pruebas_panel`) **no se ejecutan en producción**:
los scripts lo impiden.

## Paso 7 — Respaldo inicial de producción

`node scripts/supabase/exportar.mjs --produccion` → copia en `respaldos/` y en `privado/respaldos/`.
Después: un respaldo antes de cada cambio grande y, como rutina, una vez por semana desde
**Configuración → Descargar respaldo completo** en el panel.

## Paso 8 — Ensayo general en el sitio de pruebas (opcional pero recomendado)

Cargar temporalmente en Netlify (sitio de pruebas) las variables públicas del proyecto de PRODUCCIÓN y
revisar que la página sea idéntica a la actual. Luego volver a poner las de prueba.

## Paso 9 — Conectar el sitio de producción (requiere autorización expresa)

1. Llevar el código a `main` (fusión de `desarrollo` → `main` revisada; la etiqueta
   `respaldo-2026-11-11` conserva la versión original).
2. Netlify (sitio de producción) → conectar el repositorio, rama `main`, base vacía, publicación `dist`.
3. Variables de entorno (solo públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` del
   proyecto de producción. `VITE_FUENTE_DATOS=supabase` ya está en `netlify.toml`.
4. Revisar que el sitio de producción **no** tenga activada la protección con login (debe ser público).
5. Verificar en vivo: 17 desarrollos, links viejos (`/#reggia-6`), descargas ZIP/PDF, `/admin`.

## Reversión (volver atrás)

| Situación | Qué hacer | Tiempo |
|---|---|---|
| Falla algo en los pasos 2–8 | Nada: el sitio original sigue igual. Se puede borrar el proyecto de producción y empezar de nuevo. | — |
| Falla la página después del paso 9 | Netlify → sitio de producción → *Deploys* → el deploy original de Netlify Drop → **Publish deploy**. | 1 minuto |
| Un error de carga en el panel | Versiones e historial → **Recuperar** la versión anterior y publicar. | minutos |
| Se perdió información | Restaurar con el respaldo exportado (`importar.mjs` con el contenido del respaldo) o desde la papelera / historial. | según el caso |

## Lo que NUNCA se hace

- Copiar usuarios, sesiones o contraseñas de prueba a producción.
- Poner `SUPABASE_SECRET_KEY` o `SUPABASE_DB_URL` en Netlify o en GitHub.
- Ejecutar pruebas que crean datos contra producción.
- Tocar el sitio original antes del paso 9.
