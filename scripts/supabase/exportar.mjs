// RESPALDO: exporta todo el contenido de la base (incluida la papelera) a un archivo JSON
// en respaldos/ (esta PC) y una copia en el bucket privado. No modifica nada.
// El archivo incluye "contenido.sitio" con la misma forma que datos/desarrollos.json:
// para restaurar, se puede importar con el script de importación.
// Uso: npm run sb:exportar
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cargarEntorno, clienteServidor, limpiar, RAIZ, salir } from "./comun.mjs";

const e = cargarEntorno();
const db = clienteServidor(e);
const { data, error } = await db.rpc("exportar_todo");
if (error) salir(limpiar(error.message, e));
// Terceros y Comercios (etapa 3). Si las tablas todavía no existen en este proyecto, se omiten.
const propiedades = {};
for (const tabla of ["propiedades", "propiedad_medios", "propiedad_publicaciones"]) {
  const r = await db.from(tabla).select("*").order("id");
  if (r.error) { if (r.error.code === "42P01" || /does not exist|schema cache/i.test(r.error.message)) continue; salir(limpiar(r.error.message, e)); }
  propiedades[tabla] = r.data;
}
if (Object.keys(propiedades).length) data.propiedades = propiedades;
const nombre = `exportacion-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const texto = JSON.stringify(data, null, 2);
mkdirSync(join(RAIZ, "respaldos"), { recursive: true });
writeFileSync(join(RAIZ, "respaldos", nombre), texto);
const { error: e2 } = await db.storage.from("privado").upload(`respaldos/${nombre}`, texto, { contentType: "application/json", upsert: false });
console.log(`Exportado: ${data.desarrollos.length} desarrollos, ${data.unidades.length} unidades, ${data.medios.length} medios` +
  (data.propiedades ? `, ${data.propiedades.propiedades?.length ?? 0} propiedades (terceros y comercios).` : "."));
console.log(`Archivo: respaldos/${nombre}${e2 ? "" : " (copia también en Supabase → privado/respaldos/)"}`);
if (e2) console.warn("No se pudo guardar la copia en Supabase:", limpiar(e2.message, e));
