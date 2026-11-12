// VERIFICACIÓN DE SOLO LECTURA de un proyecto de Supabase (prueba o producción).
// No crea cuentas, no crea datos, no modifica nada. Pensado para comprobar producción
// después de migrar e importar, y antes/después de conectar la página.
// Uso: npm run sb:verificar                 (proyecto de prueba)
//      npm run sb:verificar -- --produccion (proyecto de producción)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cargarEntorno, clientePublico, clienteServidor, ES_PRODUCCION, limpiar, mismoContenido, RAIZ } from "./comun.mjs";

const e = cargarEntorno();
const srv = clienteServidor(e);
const anon = clientePublico(e);
const res = [];
const ok = (nombre, cond, det = "") => { res.push(!!cond); console.log(`${cond ? "  OK   " : "  FALLA"} ${nombre}${det ? ` — ${det}` : ""}`); };
const datos = JSON.parse(readFileSync(join(RAIZ, "datos", "desarrollos.json"), "utf8"));
const inventario = JSON.parse(readFileSync(join(RAIZ, "datos", "medios.json"), "utf8"));

console.log("\nVERIFICACIÓN (solo lectura)\n");
try {
  // 1. Estructura: migraciones aplicadas (las funciones y tablas clave existen)
  const tablas = {};
  for (const t of ["desarrollos", "unidades", "medios", "configuracion", "publicaciones", "roles_usuario", "historial"]) {
    const { count, error } = await srv.from(t).select("*", { count: "exact", head: true });
    tablas[t] = error ? `ERROR ${limpiar(error.message, e)}` : count;
  }
  ok("Tablas creadas", Object.values(tablas).every((v) => typeof v === "number"), JSON.stringify(tablas));

  // 2. Contenido público = JSON original (17 desarrollos, 207 unidades, mismo contenido y orden)
  const { data: c, error: ec } = await anon.rpc("contenido_publico");
  if (ec) throw ec;
  const reales = c.sitio.emprendimientos.filter((d) => datos.emprendimientos.some((x) => x.id === d.id));
  const unidades = reales.reduce((t, d) => t + d.disponibles.length, 0);
  ok("La página pública tiene los 17 desarrollos originales", reales.length === 17, `${c.sitio.emprendimientos.length} públicos en total`);
  if (ES_PRODUCCION) {
    // En producción el contenido cambia con lo que se publica desde el panel: se informa, no se exige.
    console.log(`  INFO   Unidades publicadas: ${unidades} (207 al importar). ` +
      (mismoContenido({ ...c.sitio, emprendimientos: reales }, datos) ? "Contenido igual al original."
        : "El contenido difiere del original por cambios publicados desde el panel (es lo esperable)."));
  } else {
    ok("207 unidades", unidades === 207, `${unidades}`);
    ok("Contenido idéntico al JSON original (valores, orden de listas y de campos)", mismoContenido({ ...c.sitio, emprendimientos: reales }, datos));
  }
  ok("Logo y portada general", c.logo === inventario.logo && c.sitio.portada === datos.portada);

  // 3. Archivos: los 174 se descargan por dirección pública con los mismos bytes
  let bien = 0;
  for (const a of inventario.archivos) {
    const r = await fetch(`${e.url}/storage/v1/object/public/media/${a.ruta.replace(/^media\//, "")}`);
    if (r.ok && createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex") === a.sha256) bien++;
  }
  ok("174 archivos públicos con bytes idénticos", bien === 174, `${bien} de ${inventario.archivos.length}`);

  // 4. Seguridad sin crear nada: el visitante no puede escribir (las pruebas usan ids inexistentes)
  const intentos = [
    await anon.from("desarrollos").insert({ id: "verificacion-no-debe-existir", posicion: 1, nombre: "x" }).select(),
    await anon.from("desarrollos").update({ nombre: "x" }).eq("id", "verificacion-no-debe-existir").select(),
    await anon.from("unidades").delete().eq("desarrollo_id", "verificacion-no-debe-existir").select(),
    await anon.from("roles_usuario").insert({ user_id: "00000000-0000-0000-0000-000000000000", rol: "administrador" }).select(),
    await anon.rpc("publicar_desarrollo", { p_id: "verificacion-no-debe-existir", p_nota: "", p_actualizar_fecha: false }),
    await anon.rpc("estadisticas_panel"),
  ];
  ok("Un visitante no puede escribir ni usar funciones de administración", intentos.every((r) => r.error || !(r.data?.length)), "6 intentos rechazados");
  const lectura = await Promise.all(["desarrollos", "unidades", "medios", "historial", "roles_usuario"].map((t) => anon.from(t).select("*").limit(1)));
  ok("Un visitante no lee la copia de trabajo, el historial ni los roles", lectura.every((r) => r.error || !(r.data?.length)));
  const privado = await fetch(`${e.url}/storage/v1/object/public/privado/respaldos/original-2026-11-11/desarrollos.json`);
  ok("El bucket privado no se puede leer por dirección pública", !privado.ok, `respuesta ${privado.status}`);
  const lista = await anon.storage.from("media").list("reggia-6/fotos");
  ok("Un visitante no puede listar los archivos", !(lista.data?.length));

  // 4b. Terceros y Comercios (migraciones 20261111150000, 160000 y 170000)
  const tablasProp = {};
  for (const t of ["propiedades", "propiedad_medios", "propiedad_publicaciones"]) {
    const { count, error } = await srv.from(t).select("*", { count: "exact", head: true });
    tablasProp[t] = error ? "falta" : count;
  }
  ok("Terceros y Comercios: tablas creadas", Object.values(tablasProp).every((v) => typeof v === "number"), JSON.stringify(tablasProp));
  const pp = await anon.rpc("propiedades_publicas");
  ok("Terceros y Comercios: la página puede leer lo publicado",
    !pp.error && Array.isArray(pp.data?.terceros) && Array.isArray(pp.data?.comercios),
    pp.error ? limpiar(pp.error.message, e) : `${pp.data.terceros.length} terceros · ${pp.data.comercios.length} comercios publicados`);
  const intentosProp = [
    ...(await Promise.all(["propiedades", "propiedad_medios", "propiedad_publicaciones"].map((t) => anon.from(t).select("*").limit(1)))),
    await anon.from("propiedades").insert({ id: "verificacion-no-debe-existir", categoria: "tercero", titulo: "x" }).select(),
    await anon.rpc("resumen_propiedades", { p_categoria: null }),
    await anon.rpc("publicar_propiedad", { p_id: "verificacion-no-debe-existir", p_nota: "", p_actualizar_fecha: false }),
  ];
  ok("Terceros y Comercios: un visitante no lee borradores ni escribe", intentosProp.every((r) => r.error || !(r.data?.length)),
    `${intentosProp.length} intentos rechazados`);

  // 5. Configuración de acceso
  const ajustes = await fetch(`${e.url}/auth/v1/settings`, { headers: { apikey: e.publica } }).then((r) => r.json());
  ok("Registro público desactivado", ajustes.disable_signup === true);
  const { data: roles } = await srv.from("roles_usuario").select("rol");
  const admins = (roles ?? []).filter((r) => r.rol === "administrador").length;
  ok("Hay al menos una cuenta administradora", admins >= 1, `${admins} administradora(s)`);
} catch (x) {
  ok("Verificación sin errores", false, limpiar(x?.message ?? x, e));
}
console.log(`\nResultado: ${res.filter(Boolean).length} de ${res.length} OK`);
process.exit(res.every(Boolean) ? 0 : 1);
