// Pruebas automáticas del seguimiento comercial (reuniones, consultas, visitas, reservas/ventas, pendientes).
// SOLO proyecto de PRUEBA. Crea una administración temporal y un colega de prueba; al final borra todo lo que creó.
// Uso: node scripts/supabase/pruebas_seguimiento.mjs
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cargarEntorno, clienteServidor, salir, soloEnPrueba } from "./comun.mjs";

const e = cargarEntorno();
soloEnPrueba("pruebas_seguimiento.mjs");
const srv = clienteServidor(e);
const nuevo = () => createClient(e.url, e.publica, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = 0, mal = 0;
const prueba = (nombre, cond, extra = "") => { if (cond) { ok++; console.log(`  ✔ ${nombre}`); } else { mal++; console.log(`  ✘ ${nombre} ${extra}`); } };

const TABLAS = ["reuniones", "consultas", "visitas", "operaciones", "pendientes"];
const sufijo = randomBytes(3).toString("hex");
const marca = `Prueba automática ${sufijo}`;
const claveAdmin = randomBytes(18).toString("base64url");
const correoAdmin = `zf-prueba-seguimiento-${sufijo}@example.com`;
const usuario = `prueba.seg.${sufijo}`;
const claveColega = randomBytes(9).toString("base64url");
let adminId = null, colegaId = null;
const creados = Object.fromEntries(TABLAS.map((t) => [t, []]));

async function limpiar() {
  for (const t of ["operaciones", "visitas", "consultas", "reuniones", "pendientes"]) {
    if (creados[t].length) await srv.from(t).delete().in("id", creados[t]);
  }
  if (colegaId) {
    const c = (await srv.from("colegas").select("user_id").eq("id", colegaId).single()).data;
    await srv.from("actividad").delete().eq("colega_id", colegaId);
    await srv.from("colegas").delete().eq("id", colegaId);
    if (c?.user_id) await srv.auth.admin.deleteUser(c.user_id);
  }
  if (adminId) { await srv.from("roles_usuario").delete().eq("user_id", adminId); await srv.auth.admin.deleteUser(adminId); }
}

try {
  const u = await srv.auth.admin.createUser({ email: correoAdmin, password: claveAdmin, email_confirm: true });
  if (u.error) salir(u.error.message);
  adminId = u.data.user.id;
  await srv.from("roles_usuario").insert({ user_id: adminId, rol: "administrador", nota: "temporal: pruebas_seguimiento" });
  const admin = nuevo();
  await admin.auth.signInWithPassword({ email: correoAdmin, password: claveAdmin });

  const c = await admin.from("colegas").insert({ nombre_apellido: marca, inmobiliaria: "Prueba" }).select("id").single();
  colegaId = c.data?.id;
  await admin.rpc("crear_acceso_colega", { p_colega: colegaId, p_usuario: usuario, p_clave: claveColega });
  const desarrollo = (await srv.from("desarrollos").select("id").limit(1).single()).data?.id;
  const hoy = new Date().toISOString().slice(0, 10);

  console.log("La administración carga y edita");
  const filas = {
    reuniones: { fecha: hoy, titulo: marca, lugar: "Oficina", desarrollo_id: desarrollo, asistentes: [colegaId], otros_asistentes: "Invitado" },
    consultas: { fecha: hoy, colega_id: colegaId, desarrollo_id: desarrollo, unidad: "5B", canal: "whatsapp", notas: marca },
    visitas: { fecha: hoy, desarrollo_id: desarrollo, unidad: "5B", cliente: marca, origen: "colega", colega_id: colegaId, resultado: "interesado" },
    pendientes: { fecha: hoy, texto: marca, colega_id: colegaId },
  };
  for (const [t, f] of Object.entries(filas)) {
    const r = await admin.from(t).insert(f).select("id,creado_por").single();
    if (r.data) creados[t].push(r.data.id);
    prueba(`crea en ${t}`, !!r.data && r.data.creado_por === adminId, r.error?.message);
  }
  const op = await admin.from("operaciones").insert({
    fecha: hoy, estado: "venta", desarrollo_id: desarrollo, unidad: "5B", colega_id: colegaId, cliente: marca,
    monto: 125000, moneda: "USD", forma_pago: "contado", comision_pct: 3, comision_monto: 3750, visita_id: creados.visitas[0],
  }).select("id,monto").single();
  if (op.data) creados.operaciones.push(op.data.id);
  prueba("registra una venta con monto y comisión", Number(op.data?.monto) === 125000, op.error?.message);
  const ed = await admin.from("operaciones").update({ comision_pagada: true }).eq("id", creados.operaciones[0]).select("comision_pagada").single();
  prueba("marca la comisión como pagada", ed.data?.comision_pagada === true, ed.error?.message);
  const ph = await admin.from("pendientes").update({ hecho: true, hecho_en: new Date().toISOString() }).eq("id", creados.pendientes[0]).select("hecho").single();
  prueba("tilda un pendiente como hecho", ph.data?.hecho === true, ph.error?.message);

  console.log("Controles de datos");
  const malo1 = await admin.from("visitas").insert({ fecha: hoy, cliente: marca, origen: "inventado" }).select("id");
  prueba("rechaza un origen que no existe", !!malo1.error);
  const malo2 = await admin.from("visitas").insert({ fecha: hoy, cliente: "  " }).select("id");
  prueba("la visita necesita el nombre del cliente", !!malo2.error);
  const malo3 = await admin.from("operaciones").insert({ fecha: hoy, monto: -5 }).select("id");
  prueba("rechaza montos negativos", !!malo3.error);
  const malo4 = await admin.from("operaciones").insert({ fecha: hoy, comision_pct: 150 }).select("id");
  prueba("rechaza comisiones de más del 100 %", !!malo4.error);

  console.log("Fechas del proyecto");
  const cfg = await admin.from("configuracion").select("valor").eq("clave", "seguimiento").single();
  prueba("existe la configuración con lanzamiento 27/11 y límite 1/7", cfg.data?.valor?.lanzamiento === "2026-11-27" && cfg.data?.valor?.limite === "2027-07-01", cfg.error?.message);

  console.log("Privacidad");
  const anon = nuevo();
  for (const t of TABLAS) {
    const r = await anon.from(t).select("id").limit(5);
    prueba(`sin cuenta no se ve ${t}`, !!r.error || (r.data ?? []).length === 0);
  }
  const ai = await anon.from("visitas").insert({ fecha: hoy, cliente: marca }).select("id");
  prueba("sin cuenta no se puede cargar nada", !!ai.error);
  const anonCfg = await anon.from("configuracion").select("valor").eq("clave", "seguimiento");
  prueba("sin cuenta no se ven las fechas ni metas", (anonCfg.data ?? []).length === 0);

  const col = nuevo();
  const ing = await col.auth.signInWithPassword({ email: `${usuario}@colegas.zf.local`, password: claveColega });
  prueba("el colega de prueba entra", !ing.error, ing.error?.message);
  for (const t of TABLAS) {
    const r = await col.from(t).select("id").limit(5);
    prueba(`un colega no ve ${t}`, !!r.error || (r.data ?? []).length === 0);
  }
  const ci = await col.from("operaciones").insert({ fecha: hoy, cliente: marca }).select("id");
  prueba("un colega no puede cargar ventas", !!ci.error);
  const cu = await col.from("visitas").update({ resultado: "compro" }).eq("id", creados.visitas[0]).select("id");
  prueba("un colega no puede cambiar visitas", !!cu.error || (cu.data ?? []).length === 0);

  console.log("Borrado");
  const b = await admin.from("pendientes").delete().eq("id", creados.pendientes[0]).select("id");
  prueba("la administración puede borrar un registro", (b.data ?? []).length === 1, b.error?.message);
  if ((b.data ?? []).length) creados.pendientes = [];
  const qc = await srv.from("colegas").select("id").eq("id", colegaId);
  prueba("los registros no afectan a la tabla de colegas", (qc.data ?? []).length === 1);
} finally {
  await limpiar();
}
const resto = await Promise.all(TABLAS.map((t) => srv.from(t).select("id", { count: "exact", head: true }).or(
  t === "pendientes" ? `texto.eq.${marca}` : t === "reuniones" ? `titulo.eq.${marca}` : t === "consultas" ? `notas.eq.${marca}` : `cliente.eq.${marca}`)));
prueba("no quedó nada de la prueba", resto.every((r) => !r.count));
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
