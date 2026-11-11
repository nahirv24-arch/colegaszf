// Aplica las migraciones de supabase/migrations/ al proyecto de PRUEBA, en orden.
// Supabase recuerda cuáles ya se aplicaron: correrlo de nuevo no repite nada.
// Uso: npm run sb:migrar            (aplica)
//      npm run sb:migrar -- --ver   (solo muestra qué aplicaría)
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { cargarEntorno, limpiar, RAIZ, salir } from "./comun.mjs";

const e = cargarEntorno();
if (!e.dbUrl) salir("En .env.local falta SUPABASE_DB_URL (la conexión 'Session pooler').");
const soloVer = process.argv.includes("--ver");
// Se llama al CLI con Node directamente (sin pasar por la consola), así la conexión no se
// interpreta ni se muestra en pantalla.
const cli = join(RAIZ, "node_modules", "supabase", "dist", "supabase.js");
const args = [cli, "db", "push", `--remote=${e.dbUrl}`, "--yes", ...(soloVer ? ["--dry-run"] : [])];
console.log(soloVer ? "Migraciones pendientes (sin aplicar):" : "Aplicando migraciones al proyecto de prueba…");
const r = spawnSync(process.execPath, args, { cwd: RAIZ, encoding: "utf8" });
const salida = limpiar(`${r.stdout ?? ""}\n${r.stderr ?? ""}`, e).trim();
console.log(salida);
if (r.status !== 0) salir("No se pudieron aplicar las migraciones (ver mensaje arriba).");
console.log("\nListo.");
