/**
 * Seguimiento comercial con colegas: reuniones, consultas, visitas, reservas/ventas y pendientes,
 * más las fechas del proyecto (inicio de la idea, lanzamiento, fecha límite) y las metas.
 * Todo es privado (RLS con es_admin()): no se publica ni lo ven los colegas.
 */
import { obtenerSupabase } from "../servicios/supabase";
import { ErrorPanel, listarDesarrollos, mensajeError } from "./servicio";
import { listarPropiedades } from "./servicioPropiedades";

const sb = () => obtenerSupabase();

function revisar<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErrorPanel(mensajeError(r.error));
  return r.data;
}

// ---------------------------------------------------------------- tipos

export type TablaSeguimiento = "reuniones" | "consultas" | "visitas" | "operaciones" | "pendientes";

interface Sellos { id: string; creado_en: string }

export interface Reunion extends Sellos {
  fecha: string; titulo: string; lugar: string; desarrollo_id: string | null;
  asistentes: string[]; otros_asistentes: string; notas: string;
}
export interface Consulta extends Sellos {
  fecha: string; colega_id: string | null; desarrollo_id: string | null; propiedad_id: string | null;
  unidad: string; canal: Canal; cliente: string; notas: string;
}
export interface Visita extends Sellos {
  fecha: string; desarrollo_id: string | null; propiedad_id: string | null; unidad: string;
  cliente: string; cliente_telefono: string; origen: Origen; colega_id: string | null; resultado: Resultado; notas: string;
}
export interface Operacion extends Sellos {
  fecha: string; estado: EstadoOperacion; desarrollo_id: string | null; propiedad_id: string | null; unidad: string;
  colega_id: string | null; cliente: string; monto: number | null; moneda: Moneda; forma_pago: FormaPago;
  comision_pct: number | null; comision_monto: number | null; comision_pagada: boolean; visita_id: string | null; notas: string;
}
export interface Pendiente extends Sellos {
  fecha: string | null; texto: string; colega_id: string | null; hecho: boolean; hecho_en: string | null;
}

export type Canal = "whatsapp" | "llamada" | "mail" | "presencial" | "otro";
export type Origen = "colega" | "instagram" | "whatsapp" | "web" | "portal" | "cartel" | "referido" | "oficina" | "otro";
export type Resultado = "pendiente" | "interesado" | "no_interesado" | "volvera" | "reservo" | "compro";
export type EstadoOperacion = "reserva" | "venta" | "caida";
export type Moneda = "USD" | "ARS";
export type FormaPago = "" | "contado" | "financiado" | "mixto";

export const CANALES: readonly (readonly [Canal, string])[] = [
  ["whatsapp", "WhatsApp"], ["llamada", "Llamada"], ["mail", "Mail"], ["presencial", "En persona"], ["otro", "Otro"],
];
export const ORIGENES: readonly (readonly [Origen, string])[] = [
  ["colega", "Un colega"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp"], ["web", "Página web"], ["portal", "Portal (Zonaprop, etc.)"],
  ["cartel", "Cartel de obra"], ["referido", "Referido / conocido"], ["oficina", "Vino a la oficina"], ["otro", "Otro"],
];
export const RESULTADOS: readonly (readonly [Resultado, string])[] = [
  ["pendiente", "Sin definir"], ["interesado", "Interesado"], ["volvera", "Va a volver"], ["no_interesado", "No le interesó"],
  ["reservo", "Reservó"], ["compro", "Compró"],
];
export const ESTADOS_OPERACION: readonly (readonly [EstadoOperacion, string])[] = [
  ["reserva", "Reserva"], ["venta", "Venta"], ["caida", "Se cayó"],
];
export const FORMAS_PAGO: readonly (readonly [FormaPago, string])[] = [
  ["", "Sin definir"], ["contado", "Contado"], ["financiado", "Financiado"], ["mixto", "Mixto"],
];
export const texto = <T extends string>(lista: readonly (readonly [T, string])[], v: T | null | undefined): string =>
  lista.find(([k]) => k === v)?.[1] ?? "—";

// ---------------------------------------------------------------- lectura y guardado

const ORDEN: Record<TablaSeguimiento, string> = {
  reuniones: "fecha", consultas: "fecha", visitas: "fecha", operaciones: "fecha", pendientes: "creado_en",
};

export async function listar<T>(tabla: TablaSeguimiento): Promise<T[]> {
  const todos: T[] = [];
  for (let pag = 0; pag < 50; pag++) {
    const filas = revisar(await sb().from(tabla).select("*")
      .order(ORDEN[tabla], { ascending: false }).order("creado_en", { ascending: false })
      .range(pag * 1000, pag * 1000 + 999)) as T[];
    todos.push(...filas);
    if (filas.length < 1000) break;
  }
  return todos;
}

/** Crea (sin id) o modifica (con id) un registro. Devuelve el id. */
export async function guardar(tabla: TablaSeguimiento, fila: Record<string, unknown>): Promise<string> {
  const { id, creado_en: _c, modificado_en: _m, creado_por: _cp, modificado_por: _mp, ...datos } = fila;
  if (id) {
    const r = revisar(await sb().from(tabla).update(datos).eq("id", id as string).select("id").single()) as { id: string };
    return r.id;
  }
  const r = revisar(await sb().from(tabla).insert(datos).select("id").single()) as { id: string };
  return r.id;
}

export async function borrar(tabla: TablaSeguimiento, id: string): Promise<void> {
  revisar(await sb().from(tabla).delete().eq("id", id));
}

export async function marcarPendiente(id: string, hecho: boolean): Promise<void> {
  revisar(await sb().from("pendientes").update({ hecho, hecho_en: hecho ? new Date().toISOString() : null }).eq("id", id).select("id").single());
}

// ---------------------------------------------------------------- fechas del proyecto y metas

export interface ConfigSeguimiento {
  inicio_idea: string | null;
  lanzamiento: string | null;
  limite: string | null;
  meta_ventas: number | null;
  meta_visitas: number | null;
  meta_colegas: number | null;
}

const CONFIG_INICIAL: ConfigSeguimiento = {
  inicio_idea: null, lanzamiento: "2026-11-27", limite: "2027-07-01", meta_ventas: null, meta_visitas: null, meta_colegas: null,
};

export async function leerConfig(): Promise<ConfigSeguimiento> {
  const r = revisar(await sb().from("configuracion").select("valor").eq("clave", "seguimiento").maybeSingle()) as { valor: Partial<ConfigSeguimiento> } | null;
  return { ...CONFIG_INICIAL, ...(r?.valor ?? {}) };
}

export async function guardarConfig(c: ConfigSeguimiento): Promise<void> {
  for (const f of [c.inicio_idea, c.lanzamiento, c.limite]) {
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new ErrorPanel("Hay una fecha que no es válida.");
  }
  if (c.lanzamiento && c.limite && c.limite <= c.lanzamiento) throw new ErrorPanel("La fecha límite tiene que ser posterior al lanzamiento.");
  const r = await sb().from("configuracion").update({ valor: c }).eq("clave", "seguimiento").select("clave");
  if (!r.error && (r.data ?? []).length) return;
  revisar(await sb().from("configuracion").insert({ clave: "seguimiento", valor: c, publica: false }).select("clave").single());
}

// ---------------------------------------------------------------- listas para elegir

export interface Opcion { id: string; nombre: string; detalle?: string }

/** Desarrollos (sin los de la papelera) y propiedades de Terceros / Locales, para los desplegables. */
export async function leerInmuebles(): Promise<{ desarrollos: Opcion[]; propiedades: Opcion[] }> {
  const [d, p] = await Promise.all([listarDesarrollos(), listarPropiedades(null).catch(() => [])]);
  return {
    desarrollos: d.filter((x) => !x.eliminado_en).map((x) => ({ id: x.id, nombre: x.nombre })),
    propiedades: p.filter((x) => !x.eliminado_en).map((x) => ({
      id: x.id, nombre: x.titulo || x.direccion || x.id, detalle: x.categoria === "tercero" ? "Terceros" : "Locales / oficinas",
    })),
  };
}

// ---------------------------------------------------------------- utilidades de fechas

/** Hoy en la hora de Argentina (la de esta computadora), como «AAAA-MM-DD». */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FMT_FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : FMT_FECHA.format(d);
}

/** Días entre dos fechas «AAAA-MM-DD» (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);
}

export function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dinero(n: number | null | undefined, moneda: Moneda = "USD"): string {
  if (n === null || n === undefined) return "—";
  return `${moneda === "USD" ? "USD" : "$"} ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}
