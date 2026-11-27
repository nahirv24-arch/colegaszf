// Carga la ubicación (lat/lng) de los desarrollos para el mapa, desde un archivo JSON.
// Solo completa los que todavía NO tienen ubicación (no pisa lo que se haya movido desde el panel),
// salvo que se agregue --pisar.
// Uso: node scripts/supabase/cargar_ubicaciones.mjs [archivo.json] [--ver] [--pisar] [--produccion --confirmo-produccion]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ, cargarEntorno, clienteServidor, exigirConfirmacionProduccion, limpiar, salir } from "./comun.mjs";

const e = cargarEntorno();
const soloVer = process.argv.includes("--ver");
const pisar = process.argv.includes("--pisar");
if (!soloVer) exigirConfirmacionProduccion("cargar ubicaciones de desarrollos");
const archivo = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(RAIZ, "scripts", "supabase", "ubicaciones_iniciales.json");
const { ubicaciones } = JSON.parse(readFileSync(archivo, "utf8"));
const srv = clienteServidor(e);

const { data: actuales, error } = await srv.from("desarrollos").select("id,nombre,lat,lng");
if (error) salir(limpiar(error.message, e));
const porId = new Map(actuales.map((d) => [d.id, d]));
let cargadas = 0;
for (const u of ubicaciones) {
  const d = porId.get(u.id);
  if (!d) { console.log(`  ? ${u.id}: no existe, se saltea`); continue; }
  if (d.lat !== null && !pisar) { console.log(`  = ${d.nombre}: ya tiene ubicación, no se toca`); continue; }
  console.log(`  ${soloVer ? "→" : "✔"} ${d.nombre}: ${u.lat}, ${u.lng}${u.aproximada ? "  (aproximada)" : ""}`);
  if (soloVer) continue;
  const r = await srv.from("desarrollos").update({ lat: u.lat, lng: u.lng }).eq("id", u.id);
  if (r.error) salir(limpiar(r.error.message, e));
  cargadas++;
}
const sin = actuales.filter((d) => d.lat === null && !ubicaciones.some((u) => u.id === d.id));
if (sin.length) console.log(`  Sin ubicación: ${sin.map((d) => d.nombre).join(", ")}`);
console.log(soloVer ? "\n(solo vista previa, no se cambió nada)" : `\n${cargadas} ubicaciones cargadas.`);
