// PRUEBAS DEL PANEL (fase 5) contra el proyecto de PRUEBA, directamente en Supabase.
// Usa una cuenta administradora TEMPORAL (contraseña al azar, nunca se muestra ni se guarda) y
// una cuenta común temporal. Crea un desarrollo de prueba "prueba-panel-xxxx" y al final borra
// SOLO lo que creó (cuentas, filas y archivos de prueba). Los 17 desarrollos reales no se tocan
// (se verifica al principio y al final).
// Uso: npm run sb:pruebas-panel
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { cargarEntorno, clientePublico, clienteServidor, limpiar, mismoContenido, RAIZ } from "./comun.mjs";

const e = cargarEntorno();
const srv = clienteServidor(e);
const anon = clientePublico(e);
const marca = randomBytes(3).toString("hex");
const ID = `prueba-panel-${marca}`;
const cuentas = [];
const archivos = [];
const res = [];
let fechaOriginal = null;

const ok = (n, nombre, cond, det = "") => { res.push({ n, nombre, ok: !!cond }); console.log(`${cond ? "  OK   " : "  FALLA"} [${n}] ${nombre}${det ? ` — ${det}` : ""}`); };
const D = (r, donde) => { if (r.error) throw new Error(`${donde}: ${limpiar(r.error.message, e)}`); return r.data; };

// PNG mínimo válido de 4x3 píxeles de un color (para probar subidas sin usar fotos reales).
function png(r, g, b) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(3, 4); ihdr[8] = 8; ihdr[9] = 2;
  const filas = Buffer.concat(Array.from({ length: 3 }, () => Buffer.from([0, ...Array.from({ length: 4 }, () => [r, g, b]).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(filas)), chunk("IEND", Buffer.alloc(0))]);
}

async function cuenta(tipo, admin) {
  const email = `zf-prueba-panel-${tipo}-${marca}@example.com`;
  const clave = randomBytes(24).toString("base64url");
  const u = D(await srv.auth.admin.createUser({ email, password: clave, email_confirm: true }), "crear cuenta");
  cuentas.push(u.user.id);
  if (admin) D(await srv.from("roles_usuario").insert({ user_id: u.user.id, rol: "administrador", nota: "temporal: pruebas del panel" }), "rol");
  const c = createClient(e.url, e.publica, { auth: { persistSession: false, autoRefreshToken: false } });
  D(await c.auth.signInWithPassword({ email, password: clave }), "login");
  return { c, id: u.user.id, email, clave };
}

async function subir(c, tipo, carpeta, color, orden) {
  const bytes = png(...color);
  const ruta = `${ID}/${carpeta}/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.png`;
  D(await c.storage.from("media").upload(ruta, bytes, { contentType: "image/png", upsert: false }), "subir");
  archivos.push(ruta);
  const fila = D(await c.from("medios").insert({ desarrollo_id: ID, tipo, orden, bucket: "media", ruta, nombre: `${tipo}-${orden}.png`,
    ancho: 4, alto: 3, bytes: bytes.length, formato: "png", mime: "image/png" }).select().single(), "fila medio");
  return fila;
}

const publico = async () => D(await anon.rpc("contenido_publico"), "contenido público");
const enPublico = async () => (await publico()).sitio.emprendimientos.find((d) => d.id === ID);
const datosReales = JSON.parse(readFileSync(join(RAIZ, "datos", "desarrollos.json"), "utf8"));
const realesIntactos = async () => {
  const p = await publico();
  return mismoContenido({ ...p.sitio, actualizado: datosReales.actualizado, emprendimientos: p.sitio.emprendimientos.filter((d) => d.id !== ID) }, datosReales);
};

async function main() {
  console.log(`\nPRUEBAS DEL PANEL (proyecto de prueba) · desarrollo de prueba: ${ID}\n`);
  fechaOriginal = D(await srv.from("configuracion").select("valor").eq("clave", "actualizado").single(), "fecha").valor;
  ok(0, "Antes de empezar: los 17 desarrollos publicados coinciden con el JSON original", await realesIntactos());

  // 1 · Inicio y cierre de sesión + acceso autorizado / no autorizado
  const adm = await cuenta("admin", true);
  const com = await cuenta("comun", false);
  {
    const esA = D(await adm.c.rpc("es_admin"), "es_admin");
    const esC = D(await com.c.rpc("es_admin"), "es_admin comun");
    const resumenC = await com.c.rpc("resumen_desarrollos");
    const estC = await com.c.rpc("estadisticas_panel");
    const salir = createClient(e.url, e.publica, { auth: { persistSession: false } });
    D(await salir.auth.signInWithPassword({ email: adm.email, password: adm.clave }), "login 2");
    const antes = D(await salir.rpc("es_admin"), "es_admin 2");
    await salir.auth.signOut();
    const despues = await salir.rpc("es_admin");
    const leeTrasSalir = await salir.from("desarrollos").select("id").limit(1);
    ok(1, "Inicio y cierre de sesión; solo la administradora entra al panel", esA === true && esC === false && !!resumenC.error && !!estC.error
      && antes === true && despues.data === false && !!leeTrasSalir.error,
      "admin: sí · cuenta común: rechazada (resumen y estadísticas) · tras cerrar sesión: sin acceso");
  }

  // 2 · Crear desarrollo (borrador): no aparece en la web pública
  {
    const max = D(await adm.c.from("desarrollos").select("posicion").order("posicion", { ascending: false }).limit(1), "max")[0].posicion;
    D(await adm.c.from("desarrollos").insert({ id: ID, posicion: max + 1, nombre: "Prueba Panel", estado: "borrador", visible: true,
      columnas: [["piso", "Piso"], ["unidad", "Unidad"], ["precio", "Precio"], ["estado", "Estado"]],
      links: { disponibles: "", brochure: "", planogeneral: "" } }), "crear");
    const fila = D(await adm.c.from("desarrollos").select("estado, creado_por").eq("id", ID).single(), "leer");
    ok(2, "Crear un desarrollo nuevo (queda en borrador y NO aparece en la página pública)", fila.estado === "borrador" && fila.creado_por === adm.id && !(await enPublico()));
  }

  // 3 · Editar desarrollo (sin cambiar el id)
  {
    D(await adm.c.from("desarrollos").update({ direccion: "Calle Falsa 123", posesion: "Marzo 2030", gastos: "USD 1.000", info_extra: { Amenities: "Pileta" } }).eq("id", ID), "editar");
    const intentoId = await adm.c.from("desarrollos").update({ id: `${ID}-x` }).eq("id", ID).select();
    if (!intentoId.error && intentoId.data?.length) D(await srv.from("desarrollos").update({ id: ID }).eq("id", `${ID}-x`), "volver id");
    const fila = D(await adm.c.from("desarrollos").select("*").eq("id", ID).single(), "leer");
    ok(3, "Editar un desarrollo (dirección, posesión, gastos, información adicional); el identificador no se puede cambiar",
      fila.direccion === "Calle Falsa 123" && fila.posesion === "Marzo 2030" && fila.info_extra.Amenities === "Pileta" && !!intentoId.error,
      "cambio de identificador rechazado por la base de datos");
  }

  // 4 · Unidades: agregar, editar precio/superficie/estado/torre, reordenar, quitar y recuperar
  let ids;
  {
    const nuevas = [
      { piso: "1º", unidad: "A", precio: "USD 100.000", estado: "Disponible", grupo: "Torre 1", sup: "50,2" },
      { piso: "1º", unidad: "B", precio: "USD 110.000", estado: "Disponible", grupo: "Torre 1", sup: "55" },
      { piso: "2º", unidad: "A", precio: "USD 120.000", estado: "Disponible", grupo: "Torre 2", sup: "60" },
    ];
    for (const [i, c] of nuevas.entries()) D(await adm.c.from("unidades").insert({ desarrollo_id: ID, posicion: i + 1, campos: c, orden_campos: Object.keys(c) }), "unidad");
    let u = D(await adm.c.from("unidades").select("*").eq("desarrollo_id", ID).order("posicion"), "unidades");
    ids = u.map((x) => x.id);
    D(await adm.c.from("unidades").update({ campos: { ...u[1].campos, precio: "USD 111.500 (contado)", estado: "Reservada", sup: "55,40", grupo: "Torre 2" } }).eq("id", u[1].id), "editar unidad");
    D(await adm.c.rpc("reordenar_unidades", { p_id: ID, p_ids: [ids[2], ids[0], ids[1]] }), "reordenar");
    D(await adm.c.from("unidades").update({ eliminado_en: new Date().toISOString() }).eq("id", ids[0]), "quitar");
    const borrarDuro = await adm.c.from("unidades").delete().eq("id", ids[1]).select();
    u = D(await adm.c.from("unidades").select("*").eq("desarrollo_id", ID).is("eliminado_en", null).order("posicion"), "unidades 2");
    const quitada = D(await adm.c.from("unidades").select("eliminado_en").eq("id", ids[0]).single(), "quitada");
    const editada = u.find((x) => x.id === ids[1]);
    const okEdicion = editada?.precio === "USD 111.500 (contado)" && editada?.estado === "Reservada" && editada?.campos.sup === "55,40" && editada?.grupo === "Torre 2" && typeof editada?.precio === "string";
    const okOrden = u.map((x) => x.id).join() === [ids[2], ids[1]].join();
    // recuperar
    // Igual que el panel (restaurarUnidad): vuelve al final, en la posición siguiente a la última activa.
    const ultima = D(await adm.c.from("unidades").select("posicion").eq("desarrollo_id", ID).is("eliminado_en", null).order("posicion", { ascending: false }).limit(1), "ultima")[0].posicion;
    D(await adm.c.from("unidades").update({ eliminado_en: null, posicion: ultima + 1 }).eq("id", ids[0]), "recuperar");
    const final = D(await adm.c.from("unidades").select("id").eq("desarrollo_id", ID).is("eliminado_en", null).order("posicion"), "final");
    ok(4, "Editar unidades: agregar, precio (texto), superficie, estado, torre, reordenar, quitar (reversible) y recuperar",
      okEdicion && okOrden && !!quitada.eliminado_en && !(borrarDuro.data?.length) && final.length === 3,
      `precio guardado tal cual: "${editada?.precio}" · borrado definitivo desde el navegador: rechazado`);
  }

  // 5 · Columnas personalizadas (agregar, renombrar, reordenar, quitar sin perder datos)
  {
    D(await adm.c.from("desarrollos").update({ columnas: [["unidad", "Depto."], ["piso", "Piso"], ["sup", "M² propios"], ["precio", "Precio de lista"], ["estado", "Estado"]] }).eq("id", ID), "columnas 1");
    D(await adm.c.from("desarrollos").update({ columnas: [["unidad", "Depto."], ["piso", "Piso"], ["precio", "Precio de lista"], ["estado", "Estado"]] }).eq("id", ID), "columnas 2");
    const fila = D(await adm.c.from("desarrollos").select("columnas").eq("id", ID).single(), "col");
    const u = D(await adm.c.from("unidades").select("campos").eq("desarrollo_id", ID).is("eliminado_en", null), "u");
    ok(5, "Columnas personalizadas: agregar, renombrar, reordenar y quitar sin perder datos",
      JSON.stringify(fila.columnas) === JSON.stringify([["unidad", "Depto."], ["piso", "Piso"], ["precio", "Precio de lista"], ["estado", "Estado"]]) && u.every((x) => x.campos.sup),
      "la columna «M² propios» se quitó y los valores de superficie siguen guardados");
  }

  // 6 · Subida de imágenes + permisos de Storage
  let fotos;
  {
    await subir(adm.c, "portada", "portada", [189, 21, 34], 0);
    fotos = [await subir(adm.c, "foto", "fotos", [47, 64, 74], 1), await subir(adm.c, "foto", "fotos", [220, 214, 204], 2), await subir(adm.c, "foto", "fotos", [26, 37, 44], 3)];
    await subir(adm.c, "pagina_brochure", "brochure", [255, 255, 255], 1);
    await subir(adm.c, "pagina_brochure", "brochure", [247, 242, 233], 2);
    const comunSube = await com.c.storage.from("media").upload(`${ID}/intruso.png`, png(0, 0, 0), { contentType: "image/png" });
    const anonSube = await anon.storage.from("media").upload(`${ID}/intruso2.png`, png(0, 0, 0), { contentType: "image/png" });
    const comunFila = await com.c.from("medios").insert({ desarrollo_id: ID, tipo: "foto", orden: 9, bucket: "media", ruta: "x/y.png" }).select();
    const r = await fetch(`${e.url}/storage/v1/object/public/media/${fotos[0].ruta}`);
    const pdfMal = await adm.c.storage.from("media").upload(`${ID}/x.exe`, Buffer.from("MZ"), { contentType: "application/x-msdownload" });
    if (!pdfMal.error) archivos.push(`${ID}/x.exe`);
    ok(6, "Subida de imágenes (portada, fotos, páginas de brochure); usuarios sin rol no pueden subir; formatos no permitidos rechazados",
      r.ok && !!comunSube.error && !!anonSube.error && !(comunFila.data?.length) && !!pdfMal.error, `descarga pública de la foto: ${r.status}`);
  }

  // 7 · Reordenamiento multimedia
  {
    D(await adm.c.rpc("reordenar_medios", { p_id: ID, p_tipo: "foto", p_ids: [fotos[2].id, fotos[0].id, fotos[1].id] }), "reordenar medios");
    const m = D(await adm.c.from("medios").select("id").eq("desarrollo_id", ID).eq("tipo", "foto").is("eliminado_en", null).order("orden"), "orden");
    const mal = await adm.c.rpc("reordenar_medios", { p_id: ID, p_tipo: "foto", p_ids: [fotos[0].id] });
    const m2 = D(await adm.c.from("medios").select("id").eq("desarrollo_id", ID).eq("tipo", "foto").is("eliminado_en", null).order("orden"), "orden 2");
    ok(7, "Reordenar imágenes (y una lista incompleta se rechaza sin desordenar nada)",
      m.map((x) => x.id).join() === [fotos[2].id, fotos[0].id, fotos[1].id].join() && !!mal.error && m2.map((x) => x.id).join() === m.map((x) => x.id).join());
  }

  // 8 · Publicar → aparece en la web; versión 1
  let v1;
  {
    const v = D(await adm.c.rpc("publicar_desarrollo", { p_id: ID, p_nota: "prueba", p_actualizar_fecha: false }), "publicar");
    const p = await enPublico();
    v1 = D(await adm.c.from("publicaciones").select("id").eq("desarrollo_id", ID).eq("version", 1).single(), "v1").id;
    ok(8, "Publicar: el desarrollo aparece en la página pública con sus unidades y archivos en orden",
      v === 1 && p && p.nombre === "Prueba Panel" && p.disponibles.length === 3 && p.imagenes.length === 3 && p.brochurePags.length === 2
      && p.imagenes[0] === `media/${fotos[2].ruta}` && p.disponibles[1].precio === "USD 111.500 (contado)"
      && JSON.stringify(Object.keys(p.disponibles[0])) === JSON.stringify(["piso", "unidad", "precio", "estado", "grupo", "sup"]));
  }

  // 9 · Guardar borrador sin publicar: la web NO cambia
  {
    D(await adm.c.from("desarrollos").update({ nombre: "Prueba Panel (borrador nuevo)" }).eq("id", ID), "editar borrador");
    const u = D(await adm.c.from("unidades").select("id, campos").eq("desarrollo_id", ID).is("eliminado_en", null).order("posicion"), "u")[0];
    D(await adm.c.from("unidades").update({ campos: { ...u.campos, precio: "USD 999.999" } }).eq("id", u.id), "precio borrador");
    const p = await enPublico();
    const r = D(await adm.c.rpc("resumen_desarrollos"), "resumen").find((x) => x.id === ID);
    ok(9, "Guardar cambios como borrador: la página pública sigue mostrando la versión publicada",
      p.nombre === "Prueba Panel" && !p.disponibles.some((x) => x.precio === "USD 999.999") && r.cambios_sin_publicar === true,
      "el panel marca «Cambios sin publicar»");
  }

  // 10 · Publicar cambios (versión 2) + actualizar fecha; ocultar y mostrar
  {
    D(await adm.c.rpc("publicar_desarrollo", { p_id: ID, p_nota: "", p_actualizar_fecha: true }), "publicar 2");
    const p = await enPublico();
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba" }).format(new Date());
    const fecha = (await publico()).sitio.actualizado;
    D(await adm.c.from("desarrollos").update({ visible: false }).eq("id", ID), "ocultar");
    const oculto = !(await enPublico());
    const vigenteOculto = await anon.from("publicaciones").select("id").eq("desarrollo_id", ID);
    D(await adm.c.from("desarrollos").update({ visible: true }).eq("id", ID), "mostrar");
    const visible = !!(await enPublico());
    ok(10, "Publicar cambios, ocultar y volver a mostrar", p.nombre === "Prueba Panel (borrador nuevo)" && fecha === hoy && oculto && !(vigenteOculto.data?.length) && visible,
      `versión 2 publicada · fecha del inicio actualizada a ${fecha} (luego se restaura) · oculto: no aparece ni en contenido ni en versiones`);
    D(await srv.from("configuracion").update({ valor: fechaOriginal }).eq("clave", "actualizado"), "restaurar fecha");
  }

  // 11 · Reemplazar y quitar archivos sin romper versiones publicadas; recuperar una versión anterior
  {
    // Posición ACTUAL de la foto (después del reordenamiento de la prueba 7).
    const viejo = D(await adm.c.from("medios").select("*").eq("id", fotos[0].id).single(), "viejo");
    const nuevo = png(10, 120, 60);
    const ruta = `${ID}/fotos/reemplazo-${marca}.png`;
    D(await adm.c.storage.from("media").upload(ruta, nuevo, { contentType: "image/png" }), "subir reemplazo"); archivos.push(ruta);
    D(await adm.c.rpc("reemplazar_medio", { p_id: viejo.id, p_ruta: ruta, p_nombre: "reemplazo.png", p_ancho: 4, p_alto: 3,
      p_bytes: nuevo.length, p_sha256: null, p_formato: "png", p_mime: "image/png" }), "reemplazar");
    const enLugar = D(await adm.c.from("medios").select("ruta, orden").eq("desarrollo_id", ID).eq("tipo", "foto").is("eliminado_en", null).order("orden"), "en lugar");
    D(await adm.c.from("medios").update({ eliminado_en: new Date().toISOString() }).eq("id", fotos[1].id), "quitar foto");
    const viejoSigue = await fetch(`${e.url}/storage/v1/object/public/media/${viejo.ruta}`);
    const publicadaSigue = (await enPublico()).imagenes.includes(`media/${viejo.ruta}`);
    D(await adm.c.rpc("restaurar_version", { p_publicacion: v1 }), "restaurar v1");
    const trabajo = D(await adm.c.rpc("contenido_completo"), "completo").sitio.emprendimientos.find((d) => d.id === ID);
    const v1c = D(await adm.c.from("publicaciones").select("contenido").eq("id", v1).single(), "v1c").contenido;
    const pub = await enPublico();
    ok(11, "Reemplazar/quitar archivos no rompe lo publicado; recuperar la versión 1 en el borrador sin tocar la web",
      viejoSigue.ok && publicadaSigue && enLugar.some((x) => x.ruta === ruta && x.orden === viejo.orden) && mismoContenido(trabajo, v1c) && pub.nombre === "Prueba Panel (borrador nuevo)",
      "el archivo reemplazado sigue disponible para la versión publicada");
  }

  // 12 · Historial
  {
    const h = D(await adm.c.rpc("historial_reciente", { p_desarrollo: ID, p_limite: 200 }), "historial");
    const acciones = new Set(h.map((x) => `${x.tabla}:${x.accion}`));
    const delAdmin = h.filter((x) => x.usuario === adm.id).length;
    const precio = h.find((x) => x.tabla === "unidades" && x.antes?.campos?.precio === "USD 110.000" && x.despues?.campos?.precio === "USD 111.500 (contado)");
    const texto = JSON.stringify(h);
    const comunVe = await com.c.rpc("historial_reciente", { p_desarrollo: ID, p_limite: 5 });
    ok(12, "Historial: qué cambió, cuándo, quién, valores anteriores y nuevos (sin contraseñas)",
      acciones.has("desarrollos:crear") && acciones.has("desarrollos:editar") && acciones.has("unidades:eliminar") && acciones.has("unidades:restaurar")
      && acciones.has("publicaciones:crear") && acciones.has("medios:eliminar") && delAdmin > 10 && !!precio
      && h.every((x) => x.usuario_email === null || x.usuario_email === adm.email) && !texto.includes(adm.clave) && !!comunVe.error,
      `${h.length} registros · ${delAdmin} con el usuario administrador · la cuenta común no puede leerlo`);
  }

  // 13 · Dashboard con datos reales
  {
    const s = D(await adm.c.rpc("estadisticas_panel"), "estadísticas");
    const pub = await publico();
    const { count } = await srv.from("unidades").select("*", { count: "exact", head: true }).is("eliminado_en", null);
    ok(13, "Dashboard: las cifras salen de la base y cambian con los datos", s.desarrollos === 18 && s.publicados === 18 && s.unidades === count
      && s.fotos === 38 + 3 && s.paginas_brochure === 72 + 2 && s.unidades_reservadas >= 1 && s.existe_estado_vendida === false
      && s.con_cambios_sin_publicar === 1 && s.ultimas_modificaciones.length === 20,
      `18 desarrollos (17 + prueba) · ${s.unidades} unidades · ${s.fotos} fotos · ${s.paginas_brochure} páginas · 1 con cambios sin publicar (la prueba recuperada)`);
    void pub;
  }

  // 14 · Errores: operaciones inválidas no dejan datos a medias
  {
    const a = await adm.c.rpc("publicar_desarrollo", { p_id: "no-existe-xyz", p_nota: "", p_actualizar_fecha: false });
    const b = await adm.c.rpc("restaurar_version", { p_publicacion: 999999999 });
    const c = await adm.c.from("desarrollos").insert({ id: ID, posicion: 1, nombre: "Duplicado" });
    const d = await adm.c.from("desarrollos").insert({ id: "Mal ID!", posicion: 1, nombre: "x" });
    const f = await adm.c.from("medios").insert({ desarrollo_id: ID, tipo: "foto", orden: 1, bucket: "media", ruta: "dup.png" });
    const versiones = D(await adm.c.from("publicaciones").select("id").eq("desarrollo_id", ID), "versiones").length;
    ok(14, "Errores: publicar algo inexistente, versión inexistente, id duplicado o inválido, posición repetida → rechazados sin cambios",
      !!a.error && !!b.error && !!c.error && !!d.error && !!f.error && versiones === 2);
  }

  ok(15, "Al final: los 17 desarrollos reales siguen idénticos al JSON original", await realesIntactos());
}

async function limpiarTodo() {
  // Solo lo creado por esta prueba (con la clave del servidor). Orden: hijos → padre.
  await srv.from("publicaciones").delete().eq("desarrollo_id", ID);
  await srv.from("medios").delete().eq("desarrollo_id", ID);
  await srv.from("unidades").delete().eq("desarrollo_id", ID);
  await srv.from("desarrollos").delete().like("id", `${ID}%`);
  if (archivos.length) await srv.storage.from("media").remove(archivos);
  const sobrantes = (await srv.storage.from("media").list(ID)).data ?? [];
  for (const c of ["fotos", "brochure", "portada"]) { const l = (await srv.storage.from("media").list(`${ID}/${c}`)).data ?? []; if (l.length) await srv.storage.from("media").remove(l.map((o) => `${ID}/${c}/${o.name}`)); }
  if (sobrantes.some((o) => o.id)) await srv.storage.from("media").remove(sobrantes.filter((o) => o.id).map((o) => `${ID}/${o.name}`));
  for (const id of cuentas) await srv.auth.admin.deleteUser(id);
  if (fechaOriginal !== null) await srv.from("configuracion").update({ valor: fechaOriginal }).eq("clave", "actualizado");
  const queda = await srv.from("desarrollos").select("id").like("id", `${ID}%`);
  console.log(`\nLimpieza: cuentas temporales borradas (${cuentas.length}), archivos de prueba borrados (${archivos.length}), desarrollos de prueba restantes: ${queda.data?.length ?? "?"}`);
}

try { await main(); }
catch (x) { console.error("\nERROR:", limpiar(x?.message ?? x, e)); res.push({ ok: false }); }
finally { await limpiarTodo(); }
console.log(`Resultado: ${res.filter((r) => r.ok).length} de ${res.length} OK`);
process.exit(res.every((r) => r.ok) ? 0 : 1);
