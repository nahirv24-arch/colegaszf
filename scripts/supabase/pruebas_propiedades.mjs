// PRUEBAS DE TERCEROS Y COMERCIOS (etapa 3) contra el proyecto de PRUEBA, directamente en Supabase.
// Usa una cuenta administradora TEMPORAL y una cuenta común temporal (contraseñas al azar, nunca se
// muestran ni se guardan). Crea UNA propiedad de prueba "prueba-prop-xxxx" y al final borra SOLO lo
// que creó. Los 17 desarrollos no se tocan (se verifica al principio y al final).
// Uso: node scripts/supabase/pruebas_propiedades.mjs
//      ... --mantener        deja la propiedad de prueba PUBLICADA para mirarla en el navegador
//      ... --limpiar <id>    borra una propiedad de prueba que quedó con --mantener
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { cargarEntorno, clientePublico, clienteServidor, limpiar, mismoContenido, RAIZ, soloEnPrueba } from "./comun.mjs";

const e = cargarEntorno();
soloEnPrueba("pruebas_propiedades.mjs");
const srv = clienteServidor(e);
const anon = clientePublico(e);
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const MANTENER = process.argv.includes("--mantener");
const marca = randomBytes(3).toString("hex");
const ID = arg("--limpiar") ?? `prueba-prop-${marca}`;
if (!/^prueba-prop-[0-9a-f]{6}$/.test(ID)) { console.error("Solo se pueden limpiar propiedades de prueba (prueba-prop-xxxxxx)."); process.exit(1); }
const cuentas = [];
const res = [];
let fechaOriginal = null;

const ok = (n, nombre, cond, det = "") => { res.push({ n, nombre, ok: !!cond }); console.log(`${cond ? "  OK   " : "  FALLA"} [${n}] ${nombre}${det ? ` — ${det}` : ""}`); };
const D = (r, donde) => { if (r.error) throw new Error(`${donde}: ${limpiar(r.error.message, e)}`); return r.data; };

// PNG mínimo válido de 4x3 píxeles (para probar subidas sin usar fotos reales) y PDF mínimo válido.
function png(r, g, b) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(3, 4); ihdr[8] = 8; ihdr[9] = 2;
  const filas = Buffer.concat(Array.from({ length: 3 }, () => Buffer.from([0, ...Array.from({ length: 4 }, () => [r, g, b]).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(filas)), chunk("IEND", Buffer.alloc(0))]);
}
const pdf = () => Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function cuenta(tipo, admin) {
  const email = `zf-prueba-prop-${tipo}-${marca}@example.com`;
  const clave = randomBytes(24).toString("base64url");
  const u = D(await srv.auth.admin.createUser({ email, password: clave, email_confirm: true }), "crear cuenta");
  cuentas.push(u.user.id);
  if (admin) D(await srv.from("roles_usuario").insert({ user_id: u.user.id, rol: "administrador", nota: "temporal: pruebas de propiedades" }), "rol");
  const c = createClient(e.url, e.publica, { auth: { persistSession: false, autoRefreshToken: false } });
  D(await c.auth.signInWithPassword({ email, password: clave }), "login");
  return { c, id: u.user.id };
}

async function subir(c, tipo, orden, archivo, formato, mime, nombre = "") {
  const ruta = `propiedades/${ID}/${tipo}/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${formato === "jpeg" ? "jpg" : formato}`;
  D(await c.storage.from("media").upload(ruta, archivo, { contentType: mime, upsert: false }), `subir ${tipo}`);
  const img = formato !== "pdf";
  return D(await c.from("propiedad_medios").insert({ propiedad_id: ID, tipo, orden, bucket: "media", ruta, nombre,
    ancho: img ? 4 : null, alto: img ? 3 : null, bytes: archivo.length, formato, mime }).select().single(), `fila ${tipo}`);
}

const publicas = async () => D(await anon.rpc("propiedades_publicas"), "propiedades públicas");
const enPublico = async () => (await publicas()).terceros.find((p) => p.id === ID);
const datosReales = JSON.parse(readFileSync(join(RAIZ, "datos", "desarrollos.json"), "utf8"));
const realesIntactos = async () => {
  const p = D(await anon.rpc("contenido_publico"), "contenido público");
  return mismoContenido({ ...p.sitio, actualizado: datosReales.actualizado }, datosReales);
};

async function main() {
  console.log(`\nPRUEBAS DE TERCEROS Y COMERCIOS (proyecto de prueba) · propiedad de prueba: ${ID}\n`);
  fechaOriginal = D(await srv.from("configuracion").select("valor").eq("clave", "actualizado").single(), "fecha").valor;
  ok(0, "Antes de empezar: los 17 desarrollos publicados coinciden con el JSON original", await realesIntactos());

  const adm = await cuenta("admin", true);
  const comun = await cuenta("comun", false);

  // 1-3: el público y una cuenta común no pueden leer ni escribir
  {
    const a = await anon.from("propiedades").select("id");
    const b = await anon.from("propiedad_medios").select("id");
    const c = await anon.from("propiedad_publicaciones").select("id");
    ok(1, "Visitante: no puede leer la copia de trabajo ni las versiones",
      (a.error || !a.data?.length) && (b.error || !b.data?.length) && (c.error || !c.data?.length));
    const d = await anon.from("propiedades").insert({ id: ID, categoria: "tercero", titulo: "Intruso" });
    const f = await comun.c.from("propiedades").insert({ id: ID, categoria: "tercero", titulo: "Intruso" });
    ok(2, "Visitante y cuenta común: no pueden crear propiedades", !!d.error && !!f.error);
  }

  // 4: borrador invisible
  D(await adm.c.from("propiedades").insert({
    id: ID, categoria: "tercero", titulo: "Propiedad de prueba", operacion: "venta", barrio: "Barrio de prueba",
    precio: "USD 1", superficie: "1 m²", descripcion: "Registro de prueba automática. Se borra al terminar.",
    detalles: { tipo: "Casa", dormitorios: "2" }, links: { mapa: "https://example.com/mapa", video: "javascript:alert(1)" },
  }), "crear borrador");
  ok(3, "Administradora: crea un borrador; el público NO lo ve", !(await enPublico()));

  // 5: archivos
  await subir(adm.c, "portada", 0, png(47, 64, 74), "png", "image/png");
  await subir(adm.c, "foto", 1, png(189, 21, 34), "png", "image/png");
  await subir(adm.c, "plano", 1, png(240, 240, 240), "png", "image/png");
  await subir(adm.c, "documento", 1, pdf(), "pdf", "application/pdf", "Ficha comercial");
  const malo = await adm.c.from("propiedad_medios").insert({ propiedad_id: ID, tipo: "documento", orden: 2, bucket: "media", ruta: "x.png", formato: "png" });
  ok(4, "Archivos: portada, foto, plano y PDF guardados; un «documento» que no es PDF se rechaza", !!malo.error);
  const intrusoArchivo = await comun.c.storage.from("media").upload(`propiedades/${ID}/foto/intruso.png`, png(0, 0, 0), { contentType: "image/png" });
  ok(5, "Cuenta común: no puede subir archivos", !!intrusoArchivo.error);

  // 6: publicar
  const pubComun = await comun.c.rpc("publicar_propiedad", { p_id: ID, p_nota: "", p_actualizar_fecha: false });
  ok(6, "Cuenta común: no puede publicar", !!pubComun.error);
  const v1 = D(await adm.c.rpc("publicar_propiedad", { p_id: ID, p_nota: "prueba", p_actualizar_fecha: false }), "publicar");
  const p1 = await enPublico();
  ok(7, "Publicar: aparece en Terceros con portada, foto, plano y documento", v1 === 1 && p1 &&
    p1.portada && p1.fotos.length === 1 && p1.planos.length === 1 && p1.documentos[0]?.nombre === "Ficha comercial",
    p1 ? `versión ${v1}` : "no aparece");
  const pub = await publicas();
  ok(8, "No aparece en Comercios y la medida de sus imágenes viaja con el contenido",
    !pub.comercios.some((p) => p.id === ID) && pub.medios.some((m) => m.ruta === p1?.portada && m.ancho === 4));

  // 9: editar sin publicar no cambia lo público
  D(await adm.c.from("propiedades").update({ titulo: "Título cambiado sin publicar" }).eq("id", ID), "editar");
  ok(9, "Editar sin publicar: el público sigue viendo la versión publicada", (await enPublico())?.titulo === "Propiedad de prueba");

  // 10-11: despublicar y volver a publicar
  D(await adm.c.from("propiedades").update({ visible: false }).eq("id", ID), "despublicar");
  ok(10, "Despublicar: desaparece de la página", !(await enPublico()));
  D(await adm.c.rpc("publicar_propiedad", { p_id: ID, p_nota: "", p_actualizar_fecha: false }), "republicar");
  const p2 = await enPublico();
  ok(11, "Publicar de nuevo: vuelve a aparecer, con los cambios (versión 2)", p2?.titulo === "Título cambiado sin publicar");

  // 12: cuenta común no modifica; el id no se puede cambiar
  const modComun = await comun.c.from("propiedades").update({ titulo: "Hackeado" }).eq("id", ID).select();
  const cambioId = await adm.c.from("propiedades").update({ id: `${ID}-otro` }).eq("id", ID);
  ok(12, "Cuenta común no modifica nada; el identificador (link) no se puede cambiar",
    (modComun.error || !modComun.data?.length) && !!cambioId.error);

  // 12b: funciones del panel (etapa 4): solo la administradora
  {
    const llamadas = (c) => [
      c.rpc("resumen_propiedades", { p_categoria: null }),
      c.rpc("propiedad_borrador", { p_id: ID }),
      c.rpc("reordenar_propiedad_medios", { p_id: ID, p_tipo: "foto", p_ids: [] }),
      c.rpc("eliminar_propiedad", { p_id: ID }),
      c.rpc("restaurar_propiedad", { p_id: ID }),
      c.rpc("publicar_propiedad", { p_id: ID, p_nota: "", p_actualizar_fecha: false }),
    ];
    const deAnon = await Promise.all(llamadas(anon));
    const deComun = await Promise.all(llamadas(comun.c));
    ok("12b", "Visitante y cuenta común: las 6 funciones del panel los rechazan",
      deAnon.every((r) => !!r.error) && deComun.every((r) => !!r.error),
      `${deAnon.filter((r) => r.error).length + deComun.filter((r) => r.error).length} de 12 rechazadas`);
    const resumen = D(await adm.c.rpc("resumen_propiedades", { p_categoria: "tercero" }), "resumen");
    const fila = resumen.find((p) => p.id === ID);
    const borrador = D(await adm.c.rpc("propiedad_borrador", { p_id: ID }), "borrador");
    ok("12c", "Administradora: el listado marca «cambios sin publicar» y la vista previa muestra el borrador",
      fila?.cambios_sin_publicar === false && Array.isArray(fila?.faltan) && borrador?.propiedad?.titulo === "Título cambiado sin publicar");
  }

  // 13: nadie borra definitivamente desde el navegador
  const borrar = await adm.c.from("propiedades").delete().eq("id", ID).select();
  ok(13, "Nadie puede borrar definitivamente desde el navegador (ni la administradora)",
    (borrar.error || !borrar.data?.length) && !!(await enPublico()));

  // 14: papelera
  if (!MANTENER) {
    D(await adm.c.rpc("eliminar_propiedad", { p_id: ID }), "papelera");
    const enPapelera = !(await enPublico());
    D(await adm.c.rpc("restaurar_propiedad", { p_id: ID }), "restaurar");
    ok(14, "Papelera: desaparece al eliminar y vuelve al restaurar", enPapelera && !!(await enPublico()));
  }

  // 15: historial
  // (las versiones se registran con su propio número; se buscan por la propiedad a la que pertenecen)
  const hist = D(await srv.from("historial").select("tabla, accion").eq("registro_id", ID), "historial");
  const histVer = D(await srv.from("historial").select("id").eq("tabla", "propiedad_publicaciones")
    .eq("despues->>propiedad_id", ID), "historial de versiones");
  ok(15, "Historial: los cambios quedaron registrados", hist.some((h) => h.tabla === "propiedades" && h.accion === "crear")
    && histVer.length >= 2, `${hist.length} cambios de la propiedad, ${histVer.length} de versiones`);

  ok(16, "Al final: los 17 desarrollos siguen idénticos al JSON original", await realesIntactos());
  const fechaFinal = D(await srv.from("configuracion").select("valor").eq("clave", "actualizado").single(), "fecha").valor;
  ok(17, "La fecha «actualizado» de la página no cambió", JSON.stringify(fechaFinal) === JSON.stringify(fechaOriginal));
}

async function borrarPropiedadDePrueba() {
  // Solo la propiedad de prueba (con la clave del servidor). Orden: hijos → padre.
  await srv.from("propiedad_publicaciones").delete().eq("propiedad_id", ID);
  await srv.from("propiedad_medios").delete().eq("propiedad_id", ID);
  await srv.from("propiedades").delete().eq("id", ID);
  for (const c of ["portada", "foto", "plano", "documento"]) {
    const l = (await srv.storage.from("media").list(`propiedades/${ID}/${c}`)).data ?? [];
    if (l.length) await srv.storage.from("media").remove(l.map((o) => `propiedades/${ID}/${c}/${o.name}`));
  }
  const queda = await srv.from("propiedades").select("id").eq("id", ID);
  console.log(`Propiedad de prueba ${ID} borrada (restantes: ${queda.data?.length ?? "?"}).`);
}

async function limpiarTodo() {
  for (const id of cuentas) await srv.auth.admin.deleteUser(id);
  if (fechaOriginal !== null) await srv.from("configuracion").update({ valor: fechaOriginal }).eq("clave", "actualizado");
  console.log(`\nLimpieza: cuentas temporales borradas (${cuentas.length}).`);
  if (MANTENER) console.log(`La propiedad ${ID} queda PUBLICADA para mirarla. Para borrarla: --limpiar ${ID}`);
  else await borrarPropiedadDePrueba();
}

if (arg("--limpiar")) { await borrarPropiedadDePrueba(); process.exit(0); }
try { await main(); }
catch (x) { console.error("\nERROR:", limpiar(x?.message ?? x, e)); res.push({ ok: false }); }
finally { await limpiarTodo(); }
console.log(`Resultado: ${res.filter((r) => r.ok).length} de ${res.length} OK`);
process.exit(res.every((r) => r.ok) ? 0 : 1);
