/**
 * Registro de colegas con acceso a la página. Solo administración (RLS con es_admin()).
 * No se publica ni aparece en la página de colegas.
 */
import { obtenerSupabase } from "../servicios/supabase";
import { ErrorPanel, mensajeError } from "./servicio";

const sb = () => obtenerSupabase();

function revisar<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErrorPanel(mensajeError(r.error));
  return r.data;
}

export interface DatosColega {
  nombre_apellido: string;
  telefono: string;
  inmobiliaria: string;
  notas: string;
}

export interface Colega extends DatosColega {
  id: string;
  creado_en: string;
  /** Usuario para entrar a la página (null = todavía sin acceso). */
  usuario: string | null;
  acceso_activo: boolean;
  /** true = todavía no cambió la contraseña que le diste. */
  clave_provisoria: boolean;
  ultimo_ingreso: string | null;
}

export const COLEGA_VACIO: DatosColega = { nombre_apellido: "", telefono: "", inmobiliaria: "", notas: "" };

export async function listarColegas(): Promise<Colega[]> {
  return revisar(await sb().from("colegas").select("id,nombre_apellido,telefono,inmobiliaria,notas,creado_en,usuario,acceso_activo,clave_provisoria,ultimo_ingreso")
    .order("nombre_apellido")) as Colega[];
}

/** Problemas de un colega (vacío = bien). */
export function erroresColega(c: DatosColega): Partial<Record<keyof DatosColega, string>> {
  const e: Partial<Record<keyof DatosColega, string>> = {};
  if (!c.nombre_apellido.trim()) e.nombre_apellido = "El nombre y apellido es obligatorio.";
  else if (c.nombre_apellido.trim().length > 120) e.nombre_apellido = "Máximo 120 caracteres.";
  if (c.telefono.trim().length > 40) e.telefono = "Máximo 40 caracteres.";
  else if (c.telefono.trim() && !/^[\d\s()+\-.]+$/.test(c.telefono.trim())) e.telefono = "Solo números, espacios, +, - o paréntesis.";
  if (c.inmobiliaria.trim().length > 120) e.inmobiliaria = "Máximo 120 caracteres.";
  if (c.notas.trim().length > 2000) e.notas = "Máximo 2000 caracteres.";
  return e;
}

const limpio = (c: DatosColega): DatosColega => ({
  nombre_apellido: c.nombre_apellido.trim(), telefono: c.telefono.trim(),
  inmobiliaria: c.inmobiliaria.trim(), notas: c.notas.trim(),
});

export interface CambiosColegas {
  nuevos: DatosColega[];
  editados: { id: string; datos: DatosColega }[];
  quitados: string[];
}

export async function guardarColegas(c: CambiosColegas): Promise<void> {
  for (const d of [...c.nuevos, ...c.editados.map((x) => x.datos)]) {
    if (Object.keys(erroresColega(d)).length) throw new ErrorPanel("Hay datos para revisar (marcados en rojo).");
  }
  if (c.nuevos.length) revisar(await sb().from("colegas").insert(c.nuevos.map(limpio)));
  for (const { id, datos } of c.editados) {
    revisar(await sb().from("colegas").update(limpio(datos)).eq("id", id).select("id").single());
  }
  if (c.quitados.length) revisar(await sb().from("colegas").delete().in("id", c.quitados));
}

/**
 * Link de WhatsApp solo cuando el número es claro: "+54 9 351 …" (13 dígitos con 549) o el celular de 10 dígitos
 * sin 0 ni 15 ("351 637 8970"). Con otros formatos (0351 15…) devuelve null para no abrir un número equivocado.
 */
export function linkWhatsapp(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (/^549\d{10}$/.test(d)) return `https://wa.me/${d}`;
  if (/^[1-9]\d{9}$/.test(d)) return `https://wa.me/549${d}`;
  return null;
}

// ---------------------------------------------------------------- accesos a la página

export const USUARIO_VALIDO = /^[a-z0-9][a-z0-9._-]{2,39}$/;

/** Usuario sugerido a partir del nombre: «Juan Pérez» → «juan.perez» (sin repetir uno que ya existe). */
export function sugerirUsuario(nombre: string, ocupados: ReadonlySet<string>): string {
  let base = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 36).replace(/\.+$/, "");
  if (!base) base = "colega";
  if (base.length < 3) base = `${base}.zf`;
  if (!ocupados.has(base)) return base;
  for (let i = 2; ; i++) if (!ocupados.has(`${base}${i}`)) return `${base}${i}`;
}

/** Contraseña fácil de dictar o copiar: 3 grupos de 4 (sin letras que se confunden, como l/1 u o/0). */
export function generarClave(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  const n = new Uint32Array(12);
  crypto.getRandomValues(n);
  const c = [...n].map((x) => letras[x % letras.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

export async function crearAcceso(colega: string, usuario: string, clave: string): Promise<void> {
  revisar(await sb().rpc("crear_acceso_colega", { p_colega: colega, p_usuario: usuario.trim().toLowerCase(), p_clave: clave }));
}

export async function resetearClave(colega: string, clave: string): Promise<void> {
  revisar(await sb().rpc("resetear_clave_colega", { p_colega: colega, p_clave: clave }));
}

export async function pausarAcceso(colega: string, activo: boolean): Promise<void> {
  revisar(await sb().rpc("pausar_acceso_colega", { p_colega: colega, p_activo: activo }));
}

/** Dirección de la página para mandarle al colega (desde esta computadora, la publicada). */
export function direccionPagina(): string {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? "https://colegaszf.pages.dev" : window.location.origin;
}

/** Mensaje listo para copiar o mandar por WhatsApp. */
export function mensajeAcceso(nombre: string, usuario: string, clave: string, nuevo: boolean): string {
  const pila = nombre.trim().split(/\s+/)[0] ?? "";
  return [
    `Hola${pila ? ` ${pila}` : ""}! ${nuevo ? "Te paso tu acceso" : "Te paso tu nueva contraseña"} para el material de ZF Propiedades para colegas:`,
    "",
    direccionPagina(),
    `Usuario: ${usuario}`,
    `Contraseña: ${clave}`,
    "",
    "La primera vez que entres te va a pedir que elijas una contraseña propia.",
  ].join("\n");
}

// ---------------------------------------------------------------- «Página cerrada»

/** true = sin usuario y contraseña no se ve nada de la página. */
export async function leerPaginaCerrada(): Promise<boolean> {
  const r = revisar(await sb().from("configuracion").select("valor").eq("clave", "pagina_cerrada").maybeSingle()) as { valor: unknown } | null;
  return r?.valor === true;
}

export async function guardarPaginaCerrada(cerrada: boolean): Promise<void> {
  revisar(await sb().from("configuracion").update({ valor: cerrada }).eq("clave", "pagina_cerrada").select("clave").single());
}

// ---------------------------------------------------------------- métricas

export type TipoActividad =
  | "ingreso" | "ver_ficha" | "ver_precio" | "descarga" | "ver_propiedad" | "ver_fotos" | "descarga_fotos" | "ver_categoria";

export interface EventoActividad {
  id: number;
  colega_id: string | null;
  colega_nombre: string;
  tipo: TipoActividad;
  desarrollo_id: string | null;
  propiedad_id: string | null;
  detalle: { nombre?: string; unidad?: string; clase?: string; archivo?: string; categoria?: string } | null;
  creado_en: string;
}

/** Lo que hicieron los colegas desde `desde` (null = todo). Se lee de a 1000 (límite de Supabase por consulta). */
export async function leerActividadColegas(desde: string | null): Promise<EventoActividad[]> {
  const todos: EventoActividad[] = [];
  for (let pag = 0; pag < 50; pag++) {
    let q = sb().from("actividad").select("id,colega_id,colega_nombre,tipo,desarrollo_id,propiedad_id,detalle,creado_en")
      .order("id", { ascending: false }).range(pag * 1000, pag * 1000 + 999);
    if (desde) q = q.gte("creado_en", desde);
    const filas = revisar(await q) as EventoActividad[];
    todos.push(...filas);
    if (filas.length < 1000) break;
  }
  return todos;
}

const CLASES: Record<string, string> = {
  brochure: "el brochure", plano: "un plano", zip: "un ZIP", imagen: "una imagen", archivo: "un archivo",
};

/** Texto simple de un evento, para el detalle de cada colega. */
export function describirEvento(a: EventoActividad): string {
  const nombre = a.detalle?.nombre || a.desarrollo_id || a.propiedad_id || "";
  switch (a.tipo) {
    case "ingreso": return "Entró a la página";
    case "ver_ficha": return `Abrió ${nombre}`;
    case "ver_precio": return `Vio el precio de la unidad ${a.detalle?.unidad || "?"} · ${nombre}`;
    case "descarga": return `Descargó ${CLASES[a.detalle?.clase ?? ""] ?? "material"} de ${nombre}${a.detalle?.archivo ? ` (${a.detalle.archivo})` : ""}`;
    case "ver_propiedad": return `Abrió la ficha de ${nombre}`;
    case "ver_fotos": return `Miró las fotos de ${nombre}`;
    case "descarga_fotos": return `Descargó fotos de ${nombre}`;
    case "ver_categoria": return a.detalle?.categoria === "comercios" ? "Entró a Locales / oficinas" : "Entró a Terceros";
  }
}
