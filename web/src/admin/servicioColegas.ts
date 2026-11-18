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
}

export const COLEGA_VACIO: DatosColega = { nombre_apellido: "", telefono: "", inmobiliaria: "", notas: "" };

export async function listarColegas(): Promise<Colega[]> {
  return revisar(await sb().from("colegas").select("id,nombre_apellido,telefono,inmobiliaria,notas,creado_en")
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
