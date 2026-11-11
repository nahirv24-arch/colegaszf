// PRUEBAS DE SEGURIDAD contra el proyecto de PRUEBA.
// Crea dos cuentas temporales (una común y una administradora) con contraseñas al azar que
// nunca se muestran ni se guardan, y un desarrollo de prueba en BORRADOR. Al final borra
// solo lo que creó (cuentas, desarrollo de prueba y archivo de prueba).
// No toca los 17 desarrollos importados (salvo leerlos).
// Uso: npm run sb:pruebas
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { cargarEntorno, clientePublico, clienteServidor, limpiar } from "./comun.mjs";

const e = cargarEntorno();
const srv = clienteServidor(e);
const anon = clientePublico(e);
const marca = randomBytes(4).toString("hex");
const ID_PRUEBA = `prueba-seguridad-${marca}`;
const resultados = [];
const creadas = [];

function prueba(n, nombre, ok, detalle = "") {
  resultados.push({ n, nombre, ok, detalle });
  console.log(`${ok ? "  OK   " : "  FALLA"} [${n}] ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

async function cuenta(tipo, esAdmin) {
  const email = `zf-prueba-${tipo}-${marca}@example.com`;
  const clave = randomBytes(24).toString("base64url");
  const { data, error } = await srv.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (error) throw error;
  creadas.push(data.user.id);
  if (esAdmin) {
    const { error: er } = await srv.from("roles_usuario").insert({ user_id: data.user.id, rol: "administrador", nota: "cuenta temporal de pruebas" });
    if (er) throw er;
  }
  const c = createClient(e.url, e.publica, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: el } = await c.auth.signInWithPassword({ email, password: clave });
  if (el) throw el;
  return { c, id: data.user.id };
}

/** Intenta escribir en todas las tablas; devuelve la lista de escrituras que SÍ funcionaron. */
async function intentarEscribir(c, quien) {
  const logradas = [];
  const t = async (nombre, op) => {
    const { data, error } = await op();
    if (!error && (data?.length ?? 0) > 0) logradas.push(nombre);
  };
  await t("crear desarrollo", () => c.from("desarrollos").insert({ id: `intruso-${quien}-${marca}`, posicion: 99, nombre: "X" }).select());
  await t("editar desarrollo publicado", () => c.from("desarrollos").update({ nombre: "HACKEADO" }).eq("id", "reggia-6").select());
  await t("editar borrador", () => c.from("desarrollos").update({ nombre: "HACKEADO" }).eq("id", ID_PRUEBA).select());
  await t("publicar borrador", () => c.from("desarrollos").update({ estado: "publicado" }).eq("id", ID_PRUEBA).select());
  await t("borrar desarrollo", () => c.from("desarrollos").delete().eq("id", "reggia-6").select());
  await t("editar unidad", () => c.from("unidades").update({ campos: { precio: "USD 1" } }).eq("desarrollo_id", "reggia-6").select());
  await t("borrar unidades", () => c.from("unidades").delete().eq("desarrollo_id", "reggia-6").select());
  await t("crear unidad", () => c.from("unidades").insert({ desarrollo_id: "reggia-6", posicion: 999, campos: { unidad: "X" } }).select());
  await t("editar medio", () => c.from("medios").update({ orden: 99 }).eq("desarrollo_id", "reggia-6").select());
  await t("borrar medio", () => c.from("medios").delete().eq("desarrollo_id", "reggia-6").select());
  await t("editar configuración", () => c.from("configuracion").update({ valor: "2000-01-01" }).eq("clave", "actualizado").select());
  await t("escribir historial", () => c.from("historial").insert({ tabla: "x", registro_id: "x", accion: "editar" }).select());
  await t("borrar historial", () => c.from("historial").delete().gt("id", 0).select());
  const rpc = async (nombre, f, args) => { const { error } = await c.rpc(f, args); if (!error) logradas.push(nombre); };
  await rpc("importar desarrollo", "importar_desarrollo", { p_desarrollo: { id: `intruso-rpc-${marca}`, nombre: "X", disponibles: [] }, p_posicion: 1, p_estado: "publicado", p_medios: [] });
  await rpc("eliminar desarrollo (papelera)", "eliminar_desarrollo", { p_id: "reggia-6" });
  await rpc("ver estadísticas", "estadisticas_panel", {});
  await rpc("ver contenido completo", "contenido_completo", {});
  await rpc("exportar todo", "exportar_todo", {});
  const sube = await c.storage.from("media").upload(`intruso-${quien}-${marca}.webp`, new Uint8Array([1, 2, 3]), { contentType: "image/webp" });
  if (!sube.error) logradas.push("subir archivo a media");
  return logradas;
}

async function fotoIntacta() {
  const { data } = await srv.from("desarrollos").select("nombre").eq("id", "reggia-6").single();
  const { count } = await srv.from("unidades").select("*", { count: "exact", head: true }).eq("desarrollo_id", "reggia-6");
  const { data: conf } = await srv.from("configuracion").select("valor").eq("clave", "actualizado").single();
  return `${data?.nombre}|${count}|${JSON.stringify(conf?.valor)}`;
}

async function main() {
  console.log("\nPRUEBAS DE SEGURIDAD (proyecto de prueba)\n");
  const foto0 = await fotoIntacta();

  const admin = await cuenta("admin", true);
  const comun = await cuenta("comun", false);

  // 5 · El admin crea datos de prueba (borrador) y los modifica
  {
    const a = await admin.c.from("desarrollos").insert({ id: ID_PRUEBA, posicion: 999, nombre: "Prueba de seguridad", estado: "borrador" }).select().single();
    const u = await admin.c.from("unidades").insert({ desarrollo_id: ID_PRUEBA, posicion: 1, campos: { piso: "1º", unidad: "A", precio: "USD 100.000", estado: "Disponible" }, orden_campos: ["piso", "unidad", "precio", "estado"] }).select().single();
    const m = await admin.c.from("desarrollos").update({ nombre: "Prueba de seguridad (editada)" }).eq("id", ID_PRUEBA).select().single();
    const mu = await admin.c.from("unidades").update({ campos: { piso: "1º", unidad: "A", precio: "USD 101.000", estado: "Reservada" } }).eq("desarrollo_id", ID_PRUEBA).select().single();
    const ve = await admin.c.from("desarrollos").select("id").eq("id", ID_PRUEBA);
    const st = await admin.c.rpc("estadisticas_panel");
    const papelera = await admin.c.rpc("eliminar_desarrollo", { p_id: ID_PRUEBA });
    const restaurar = await admin.c.rpc("restaurar_desarrollo", { p_id: ID_PRUEBA });
    const hist = await admin.c.from("historial").select("accion, usuario").eq("registro_id", ID_PRUEBA).order("id");
    const sello = await admin.c.from("desarrollos").select("creado_por, modificado_por").eq("id", ID_PRUEBA).single();
    const ok = !a.error && !u.error && !m.error && !mu.error && ve.data?.length === 1 && !st.error && !papelera.error && !restaurar.error
      && mu.data?.precio === "USD 101.000" && mu.data?.estado === "Reservada"
      && (hist.data ?? []).map((h) => h.accion).join(",") === "crear,editar,eliminar,restaurar"
      && (hist.data ?? []).every((h) => h.usuario === admin.id)
      && sello.data?.creado_por === admin.id && sello.data?.modificado_por === admin.id;
    prueba(5, "El administrador consulta y modifica datos de prueba (borrador, unidad, papelera, historial con su usuario)", ok,
      ok ? `estadísticas: ${st.data?.desarrollos} desarrollos, ${st.data?.borradores} borrador, ${st.data?.unidades} unidades` :
        limpiar([a.error, u.error, m.error, mu.error, st.error, papelera.error, restaurar.error].filter(Boolean).map((x) => x.message).join(" / ") || JSON.stringify(hist.data), e));
  }

  // 1 · Visitante ve publicados
  {
    const { data, error } = await anon.from("desarrollos").select("id");
    const u = await anon.from("unidades").select("*", { count: "exact", head: true });
    const c = await anon.rpc("contenido_publico");
    prueba(1, "Un visitante consulta los desarrollos publicados", !error && data.length === 17 && u.count === 207 && c.data?.sitio?.emprendimientos?.length === 17,
      `${data?.length} desarrollos, ${u.count} unidades visibles`);
  }
  // 2 · Visitante no ve borradores
  {
    const d = await anon.from("desarrollos").select("id").eq("id", ID_PRUEBA);
    const u = await anon.from("unidades").select("id").eq("desarrollo_id", ID_PRUEBA);
    const c = await anon.rpc("contenido_publico");
    const enContenido = (c.data?.sitio?.emprendimientos ?? []).some((x) => x.id === ID_PRUEBA);
    const h = await anon.from("historial").select("id").limit(1);
    const r = await anon.from("roles_usuario").select("user_id").limit(1);
    prueba(2, "Un visitante no consulta borradores (ni su tabla, ni sus unidades, ni el historial, ni los roles)",
      d.data?.length === 0 && u.data?.length === 0 && !enContenido && !(h.data?.length) && !(r.data?.length));
  }
  // 3 · Visitante no escribe
  {
    const logradas = await intentarEscribir(anon, "anon");
    prueba(3, "Un visitante no puede crear, modificar ni eliminar nada (20 intentos)", logradas.length === 0 && (await fotoIntacta()) === foto0,
      logradas.length ? `LOGRÓ: ${logradas.join(", ")}` : "todos rechazados");
  }
  // 4 · Usuario autenticado sin rol no escribe
  {
    const logradas = await intentarEscribir(comun.c, "comun");
    const ve = await comun.c.from("desarrollos").select("id").eq("id", ID_PRUEBA);
    prueba(4, "Un usuario con sesión pero SIN rol administrador no puede modificar nada ni ver borradores", logradas.length === 0 && ve.data?.length === 0 && (await fotoIntacta()) === foto0,
      logradas.length ? `LOGRÓ: ${logradas.join(", ")}` : "todos rechazados");
  }
  // 6 · Nadie se asigna administrador desde el navegador
  {
    const intentos = [];
    const i1 = await comun.c.from("roles_usuario").insert({ user_id: comun.id, rol: "administrador" }).select(); if (!i1.error && i1.data?.length) intentos.push("insertar rol");
    const i2 = await comun.c.from("roles_usuario").upsert({ user_id: comun.id, rol: "administrador" }).select(); if (!i2.error && i2.data?.length) intentos.push("upsert rol");
    const i3 = await anon.from("roles_usuario").insert({ user_id: comun.id, rol: "administrador" }).select(); if (!i3.error && i3.data?.length) intentos.push("visitante inserta rol");
    await comun.c.auth.updateUser({ data: { rol: "administrador", role: "admin", es_admin: true } }); // metadatos que el usuario SÍ puede tocar
    await comun.c.auth.refreshSession();
    const es = await comun.c.rpc("es_admin");
    const i4 = await admin.c.from("roles_usuario").update({ rol: "administrador" }).eq("user_id", comun.id).select(); if (!i4.error && i4.data?.length) intentos.push("el admin cambia roles desde el navegador");
    const escribe = await comun.c.from("desarrollos").update({ nombre: "HACKEADO" }).eq("id", "reggia-6").select();
    const { data: rol } = await srv.from("roles_usuario").select("rol").eq("user_id", comun.id).maybeSingle();
    prueba(6, "Nadie puede asignarse (ni asignar) el rol administrador desde el navegador", intentos.length === 0 && es.data === false && !rol && !(escribe.data?.length),
      intentos.length ? `LOGRÓ: ${intentos.join(", ")}` : "inserción, upsert, metadatos de usuario y edición de roles: rechazados");
  }
  // 7 · Archivos privados
  {
    const ruta = `pruebas/secreto-${marca}.txt`;
    await srv.storage.from("privado").upload(ruta, "contenido privado de prueba", { contentType: "text/plain" });
    const publico = await fetch(`${e.url}/storage/v1/object/public/privado/${ruta}`);
    const dA = await anon.storage.from("privado").download(ruta);
    const dC = await comun.c.storage.from("privado").download(ruta);
    const firmado = await comun.c.storage.from("privado").createSignedUrl(ruta, 60);
    const listado = await anon.storage.from("media").list("reggia-6/fotos");
    const dAdm = await admin.c.storage.from("privado").download(ruta);
    await srv.storage.from("privado").remove([ruta]);
    prueba(7, "Los archivos privados no se pueden descargar públicamente", !publico.ok && !!dA.error && !!dC.error && !!firmado.error && !(listado.data?.length) && !dAdm.error,
      `dirección pública: ${publico.status}; visitante y usuario común: rechazados; el admin sí puede`);
  }
  // 8 · Archivos públicos
  {
    const { data: medios } = await srv.from("medios").select("ruta, sha256").eq("bucket", "media");
    let bien = 0;
    for (const m of medios ?? []) {
      const r = await fetch(`${e.url}/storage/v1/object/public/media/${m.ruta}`);
      if (r.ok && createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex") === m.sha256) bien++;
    }
    prueba(8, "Los archivos públicos funcionan (descarga por dirección directa y bytes idénticos)", bien === 174 && medios.length === 174, `${bien} de ${medios?.length}`);
  }
  // 9 · Persistencia: clientes nuevos (como cerrar y volver a abrir) ven los cambios del admin
  {
    const nuevo = clienteServidor(e);
    const { data } = await nuevo.from("desarrollos").select("nombre").eq("id", ID_PRUEBA).single();
    const { data: u } = await nuevo.from("unidades").select("precio").eq("desarrollo_id", ID_PRUEBA).single();
    const otraVez = await anon.from("desarrollos").select("id");
    prueba(9, "Los datos se conservan al cerrar y volver a abrir (conexiones nuevas)", data?.nombre === "Prueba de seguridad (editada)" && u?.precio === "USD 101.000" && otraVez.data?.length === 17);
  }

  console.log(`\nResultado: ${resultados.filter((r) => r.ok).length} de ${resultados.length} pruebas OK`);
}

async function limpiarTodo() {
  // Borra SOLO lo creado por esta prueba (con la clave del servidor).
  await srv.from("unidades").delete().eq("desarrollo_id", ID_PRUEBA);
  await srv.from("desarrollos").delete().eq("id", ID_PRUEBA);
  for (const id of creadas) await srv.auth.admin.deleteUser(id);
  const quedan = await srv.from("desarrollos").select("id").like("id", "%" + marca + "%");
  console.log(`Limpieza: cuentas temporales borradas (${creadas.length}); restos de la prueba: ${quedan.data?.length ?? "?"}`);
}

try { await main(); }
catch (x) { console.error("ERROR:", limpiar(x?.message ?? x, e)); resultados.push({ ok: false }); }
finally { await limpiarTodo(); }
process.exit(resultados.every((r) => r.ok) && resultados.length >= 9 ? 0 : 1);
