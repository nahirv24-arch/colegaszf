// Pruebas automáticas de las cuentas de colegas, la actividad y «Página cerrada» (SOLO proyecto de PRUEBA).
// Crea una cuenta de administración temporal y un colega de prueba; al final borra todo lo que creó.
// Uso: node scripts/supabase/pruebas_cuentas.mjs
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cargarEntorno, clienteServidor, salir, soloEnPrueba } from "./comun.mjs";

const e = cargarEntorno();
soloEnPrueba("pruebas_cuentas.mjs");
const srv = clienteServidor(e);
const nuevo = () => createClient(e.url, e.publica, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = 0, mal = 0;
const prueba = (nombre, cond, extra = "") => { if (cond) { ok++; console.log(`  ✔ ${nombre}`); } else { mal++; console.log(`  ✘ ${nombre} ${extra}`); } };

const sufijo = randomBytes(3).toString("hex");
const claveAdmin = randomBytes(18).toString("base64url");
const correoAdmin = `zf-prueba-cuentas-${sufijo}@example.com`;
const usuario = `prueba.colega.${sufijo}`;
const clave1 = randomBytes(9).toString("base64url");
const clave2 = randomBytes(9).toString("base64url");
const clave3 = randomBytes(9).toString("base64url");
let adminId = null, colegaId = null;

async function limpiar() {
  await srv.from("configuracion").update({ valor: false }).eq("clave", "pagina_cerrada");
  if (colegaId) {
    await srv.from("actividad").delete().eq("colega_id", colegaId);
    await srv.from("colegas").delete().eq("id", colegaId);
  }
  await srv.from("actividad").delete().like("colega_nombre", `Prueba automática ${sufijo}%`);
  if (adminId) { await srv.from("roles_usuario").delete().eq("user_id", adminId); await srv.auth.admin.deleteUser(adminId); }
}

try {
  // Administración temporal
  const u = await srv.auth.admin.createUser({ email: correoAdmin, password: claveAdmin, email_confirm: true });
  if (u.error) salir(u.error.message);
  adminId = u.data.user.id;
  await srv.from("roles_usuario").insert({ user_id: adminId, rol: "administrador", nota: "temporal: pruebas_cuentas" });
  const admin = nuevo();
  await admin.auth.signInWithPassword({ email: correoAdmin, password: claveAdmin });

  console.log("Cuentas");
  const c = await admin.from("colegas").insert({ nombre_apellido: `Prueba automática ${sufijo}`, inmobiliaria: "Prueba" }).select("id").single();
  colegaId = c.data?.id;
  prueba("la administradora agrega un colega", !!colegaId, c.error?.message);
  const cr = await admin.rpc("crear_acceso_colega", { p_colega: colegaId, p_usuario: usuario, p_clave: clave1 });
  prueba("crea el acceso", !cr.error, cr.error?.message);
  const dup = await admin.rpc("crear_acceso_colega", { p_colega: colegaId, p_usuario: usuario, p_clave: clave1 });
  prueba("no deja crear dos veces", !!dup.error);
  const corta = await admin.rpc("resetear_clave_colega", { p_colega: colegaId, p_clave: "corta" });
  prueba("rechaza contraseñas cortas", !!corta.error);

  const correo = `${usuario}@colegas.zf.local`;
  const col = nuevo();
  const ing = await col.auth.signInWithPassword({ email: correo, password: clave1 });
  prueba("el colega entra con usuario y contraseña", !ing.error, ing.error?.message);
  const mal1 = await nuevo().auth.signInWithPassword({ email: correo, password: "equivocada-123" });
  prueba("con otra contraseña no entra", !!mal1.error);
  let est = await col.rpc("estado_pagina");
  prueba("la página sabe quién es y que la clave es provisoria",
    est.data?.cuenta?.nombre === `Prueba automática ${sufijo}` && est.data?.cuenta?.clave_provisoria === true, JSON.stringify(est.data));
  const cambio = await col.auth.updateUser({ password: clave2 });
  prueba("el colega cambia su contraseña", !cambio.error, cambio.error?.message);
  await col.rpc("marcar_clave_cambiada");
  est = await col.rpc("estado_pagina");
  prueba("deja de ser provisoria", est.data?.cuenta?.clave_provisoria === false);
  const ing2 = await nuevo().auth.signInWithPassword({ email: correo, password: clave2 });
  prueba("entra con la contraseña nueva", !ing2.error, ing2.error?.message);

  console.log("Lo que un colega NO puede hacer");
  prueba("no lee el registro de colegas", ((await col.from("colegas").select("id")).data ?? []).length === 0);
  prueba("no lee la actividad", ((await col.from("actividad").select("id")).data ?? []).length === 0);
  const ed = await col.from("desarrollos").update({ nombre: "X" }).eq("id", "reggia-6").select("id");
  prueba("no edita desarrollos", !!ed.error || (ed.data ?? []).length === 0);
  prueba("no crea accesos", !!(await col.rpc("crear_acceso_colega", { p_colega: colegaId, p_usuario: "otro.mas", p_clave: clave3 })).error);
  prueba("no resetea contraseñas", !!(await col.rpc("resetear_clave_colega", { p_colega: colegaId, p_clave: clave3 })).error);
  prueba("no cierra la página", ((await col.from("configuracion").update({ valor: true }).eq("clave", "pagina_cerrada").select("clave")).data ?? []).length === 0);
  prueba("no es administradora", (await col.rpc("es_admin")).data === false);

  console.log("Actividad");
  await col.rpc("registrar_actividad", { p_tipo: "ingreso" });
  await col.rpc("registrar_actividad", { p_tipo: "ver_ficha", p_desarrollo: "reggia-6" });
  await col.rpc("registrar_actividad", { p_tipo: "ver_ficha", p_desarrollo: "reggia-6" }); // repetido: se ignora
  await col.rpc("registrar_actividad", { p_tipo: "ver_precio", p_desarrollo: "reggia-6", p_detalle: { unidad: "1A" } });
  await nuevo().rpc("registrar_actividad", { p_tipo: "ver_ficha", p_desarrollo: "reggia-6" }); // sin cuenta: no se registra
  const act = await admin.from("actividad").select("tipo,desarrollo_id,detalle").eq("colega_id", colegaId).order("id");
  prueba("se registra ingreso, ficha y precio (sin repetidos)", act.data?.map((a) => a.tipo).join(",") === "ingreso,ver_ficha,ver_precio", JSON.stringify(act.data));
  const ult = await admin.from("colegas").select("ultimo_ingreso,usuario").eq("id", colegaId).single();
  prueba("guarda el último ingreso y el usuario", !!ult.data?.ultimo_ingreso && ult.data?.usuario === usuario);

  console.log("Página cerrada");
  const anon = nuevo();
  prueba("abierta: sin cuenta se ve", !(await anon.rpc("contenido_publico")).error);
  const cerrar = await admin.from("configuracion").update({ valor: true }).eq("clave", "pagina_cerrada").select("clave");
  prueba("la administradora la cierra", (cerrar.data ?? []).length === 1, cerrar.error?.message);
  const ca = await anon.rpc("contenido_publico");
  prueba("cerrada: sin cuenta NO ve los desarrollos", !!ca.error && ca.error.code === "42501", JSON.stringify(ca.error));
  prueba("cerrada: sin cuenta NO ve Terceros/Locales", !!(await anon.rpc("propiedades_publicas")).error);
  prueba("cerrada: sin cuenta NO lee las versiones publicadas", ((await anon.from("publicaciones").select("desarrollo_id")).data ?? []).length === 0);
  prueba("cerrada: la página sabe que está cerrada", (await anon.rpc("estado_pagina")).data?.cerrada === true);
  prueba("cerrada: el colega SÍ ve los desarrollos", !(await col.rpc("contenido_publico")).error);
  prueba("cerrada: el colega SÍ ve Terceros/Locales", !(await col.rpc("propiedades_publicas")).error);
  prueba("cerrada: la administradora SÍ ve", !(await admin.rpc("contenido_publico")).error);

  console.log("Pausar y resetear");
  prueba("la administradora pausa el acceso", !(await admin.rpc("pausar_acceso_colega", { p_colega: colegaId, p_activo: false })).error);
  const col2 = nuevo(); await col2.auth.signInWithPassword({ email: correo, password: clave2 });
  prueba("pausado: el colega NO ve nada", !!(await col2.rpc("contenido_publico")).error);
  await admin.rpc("pausar_acceso_colega", { p_colega: colegaId, p_activo: true });
  prueba("reactivado: vuelve a ver", !(await col2.rpc("contenido_publico")).error);
  prueba("la administradora resetea la contraseña", !(await admin.rpc("resetear_clave_colega", { p_colega: colegaId, p_clave: clave3 })).error);
  prueba("con la contraseña vieja ya no entra", !!(await nuevo().auth.signInWithPassword({ email: correo, password: clave2 })).error);
  const col3 = nuevo();
  prueba("con la nueva sí entra", !(await col3.auth.signInWithPassword({ email: correo, password: clave3 })).error);
  prueba("vuelve a ser provisoria", (await col3.rpc("estado_pagina")).data?.cuenta?.clave_provisoria === true);

  console.log("Quitar colega");
  const { data: antes } = await srv.from("colegas").select("user_id").eq("id", colegaId).single();
  await srv.from("actividad").delete().eq("colega_id", colegaId);
  const q = await admin.from("colegas").delete().eq("id", colegaId).select("id");
  prueba("la administradora lo quita", (q.data ?? []).length === 1, q.error?.message);
  colegaId = null;
  const borrado = await srv.auth.admin.getUserById(antes.user_id);
  prueba("su cuenta se borra", !!borrado.error || !borrado.data?.user);
  prueba("ya no puede entrar", !!(await nuevo().auth.signInWithPassword({ email: correo, password: clave3 })).error);
} finally {
  await limpiar();
}
console.log(`\n${ok} bien, ${mal} mal.`);
process.exit(mal ? 1 : 0);
