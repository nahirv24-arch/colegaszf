# Publicar en Cloudflare Pages — Material para colegas · ZF Propiedades

Alternativa gratuita a Netlify (11/11/2026: el plan gratis de Netlify agotó los créditos de despliegue
hasta el 2/12). **El sitio de Netlify no se toca**: sigue mostrando la página original.

## Compatibilidad (verificada)

| Punto | Resultado |
|---|---|
| Tipo de proyecto | Página estática (Vite). Cloudflare Pages la publica sin cambios de código. |
| Rutas (`/admin`, `/admin/...`) | Cloudflare abre `index.html` en cualquier ruta que no sea un archivo (no hay `404.html`). |
| `web/public/_redirects` | Es para Netlify. Cloudflare avisa «infinite loop» y lo ignora: no afecta. |
| Links viejos (`/#reggia-6`) | Funcionan (son internos de la página). |
| Formularios | Solo los del panel (ingreso, contraseña), que usan Supabase. No hay formularios de Netlify. |
| Archivos | 188 archivos, el más grande 0,6 MB (límite de Cloudflare: 25 MB por archivo, 20.000 archivos). |
| `netlify.toml` | Cloudflare no lo lee: la misma configuración se carga a mano (abajo). |

## Configuración en Cloudflare (Workers & Pages → Create → Pages → Connect to Git)

| Campo | Valor |
|---|---|
| Repositorio | `nahirv24-arch/colegaszf` |
| Production branch | `main` |
| Framework preset | `None` (o Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | vacío |

Variables de entorno (Production), solo públicas:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `24` |
| `VITE_FUENTE_DATOS` | `supabase` |
| `VITE_SUPABASE_URL` | `https://mdaecwjzubpcolufzyvx.supabase.co` (proyecto de PRODUCCIÓN) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave `sb_publishable_…` de producción |

**Nunca** `SUPABASE_SECRET_KEY` ni `SUPABASE_DB_URL`. Nunca las claves del proyecto de pruebas.

Después de crearlo: Settings → Builds → **Branch control** → previews: **None** (solo se publica `main`;
así la rama `desarrollo` no se publica con la base de producción).

## Supabase de producción

Authentication → URL Configuration → Redirect URLs: agregar `https://<nombre>.pages.dev/admin/**`
(para el correo de recuperación de contraseña).

## Volver atrás

Cloudflare → Deployments → un despliegue anterior → **Rollback**. Como en Netlify, no restaura la base
de datos: para eso, versiones del panel o respaldos de `respaldos/`.
