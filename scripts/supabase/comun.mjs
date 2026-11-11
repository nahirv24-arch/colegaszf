// Utilidades compartidas por los scripts de Supabase. Se ejecutan SOLO en esta computadora.
// Leen las claves de .env.local y nunca las imprimen.
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Entorno de trabajo:
 *   - PRUEBA (por defecto): claves en .env.local
 *   - PRODUCCIÓN: agregar --produccion al comando; claves en .env.produccion (nunca se sube a GitHub).
 * Las operaciones que ESCRIBEN en producción exigen además --confirmo-produccion.
 */
export const ES_PRODUCCION = process.argv.includes("--produccion");

/** Detiene el script si se intenta escribir en producción sin confirmación explícita. */
export function exigirConfirmacionProduccion(accion) {
  if (ES_PRODUCCION && !process.argv.includes("--confirmo-produccion")) {
    salir(`Vas a ${accion} en PRODUCCIÓN. Si es correcto, repetí el comando agregando --confirmo-produccion`);
  }
}

/** Scripts que crean datos o cuentas de prueba: prohibidos en producción. */
export function soloEnPrueba(nombre) {
  if (ES_PRODUCCION) salir(`${nombre} crea datos y cuentas de prueba: no se ejecuta en producción. Usá verificar.mjs.`);
}

export function cargarEntorno() {
  const nombre = ES_PRODUCCION ? ".env.produccion" : ".env.local";
  const archivo = join(RAIZ, nombre);
  if (!existsSync(archivo)) salir(`Falta el archivo ${nombre} (copiar .env.local.ejemplo y completarlo).`);
  process.loadEnvFile(archivo);
  if (!process.env.__ZF_AVISO) {
    process.env.__ZF_AVISO = "1";
    const ref = (process.env.VITE_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").split(".")[0];
    console.log(`\n>>> Entorno: ${ES_PRODUCCION ? "PRODUCCIÓN" : "PRUEBA"} · proyecto ${ref} · archivo ${nombre}`);
  }
  const faltan = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]
    .filter((k) => !process.env[k]?.trim());
  if (faltan.length) salir(`En .env.local faltan: ${faltan.join(", ")}`);
  return {
    url: process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, ""),
    publica: process.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim(),
    secreta: process.env.SUPABASE_SECRET_KEY.trim(),
    dbUrl: process.env.SUPABASE_DB_URL?.trim() ?? "",
  };
}

const sinSesion = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Cliente con la clave SECRETA (salta RLS). Solo scripts del servidor. */
export const clienteServidor = (e) => createClient(e.url, e.secreta, sinSesion);
/** Cliente con la clave PÚBLICA (lo mismo que tendría un visitante). */
export const clientePublico = (e) => createClient(e.url, e.publica, sinSesion);

export function salir(mensaje) {
  console.error(`\nERROR: ${mensaje}\n`);
  process.exit(1);
}

/** Quita cualquier clave o contraseña de un mensaje de error antes de mostrarlo. */
export function limpiar(texto, e) {
  let t = String(texto ?? "");
  for (const s of [e?.secreta, e?.publica, e?.dbUrl]) if (s) t = t.split(s).join("[oculto]");
  return t.replace(/postgres(ql)?:\/\/[^\s"']+/g, "postgresql://[oculto]");
}

/** Igualdad estricta incluyendo el ORDEN de las claves (compara el texto JSON). */
export const igualExacto = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ordenarClaves = (o) => Array.isArray(o) ? o.map(ordenarClaves)
  : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordenarClaves(o[k])])) : o;

/**
 * ¿Mismo contenido? Compara TODOS los valores y el orden de TODAS las listas (desarrollos,
 * unidades, columnas, fotos, renders, planos, páginas). Además exige que cada unidad conserve
 * el orden original de sus campos. Lo único que no exige es el orden en que se listan las
 * claves de un objeto como "links" (la base de datos las ordena alfabéticamente; no cambia nada).
 */
export function mismoContenido(a, b) {
  if (JSON.stringify(ordenarClaves(a)) !== JSON.stringify(ordenarClaves(b))) return false;
  const ua = (x) => JSON.stringify((x?.emprendimientos ?? [x]).map((d) => d?.disponibles ?? []));
  return ua(a) === ua(b);
}

export const TIPOS = { imagenes: "foto", galeria: "render", planos: "plano", brochurePags: "pagina_brochure" };
export const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** "media/reggia-6/fotos/foto-01.jpg" → "reggia-6/fotos/foto-01.jpg" (ruta dentro del bucket "media"). */
export const rutaBucket = (ruta) => ruta.replace(/^media\//, "");
