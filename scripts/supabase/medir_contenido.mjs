// Mide cuánto tarda contenido_publico() (lo que carga la página) y guarda una huella de lo que devuelve.
// Solo LEE: no cambia nada. Sirve para comparar antes y después de optimizar la función.
// Uso: node scripts/supabase/medir_contenido.mjs [--produccion] [--guardar archivo.json]
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { cargarEntorno, clientePublico, clienteServidor, ES_PRODUCCION, salir } from "./comun.mjs";

const e = cargarEntorno();
const pub = clientePublico(e);
const srv = clienteServidor(e);

const { count } = await srv.from("medios").select("id", { count: "exact", head: true });
console.log(`Filas en medios (incluye quitados e historial): ${count}`);

const llamar = async () => {
  const t = performance.now();
  const r = await pub.rpc("contenido_publico");
  return { ms: Math.round(performance.now() - t), error: r.error?.message ?? null, data: r.data };
};

const primero = await llamar();
if (primero.error) salir(`Error: ${primero.error}`);
const texto = JSON.stringify(primero.data);
console.log(`Huella: ${createHash("sha256").update(texto).digest("hex")} (${texto.length} caracteres, ${primero.data.medios.length} archivos)`);
const i = process.argv.indexOf("--guardar");
if (i > 0) writeFileSync(process.argv[i + 1], texto);

const sueltas = [];
for (let k = 0; k < 4; k++) sueltas.push((await llamar()).ms);
console.log(`Una por vez (ms): ${sueltas.join(", ")}`);

// En producción, carga liviana para no molestar a quien esté mirando la página.
for (const n of ES_PRODUCCION ? [2, 3] : [3, 6, 10]) {
  const rs = await Promise.all(Array.from({ length: n }, llamar));
  const fallas = rs.filter((r) => r.error);
  console.log(`${n} a la vez: ${n - fallas.length} bien, ${fallas.length} con error; la más lenta ${Math.max(...rs.map((r) => r.ms))} ms${fallas.length ? ` (${fallas[0].error})` : ""}`);
}
