import type { Session } from "@supabase/supabase-js";
import type { Estadisticas } from "../tipos/admin";
import { obtenerSupabase } from "./supabase";

/**
 * Autenticación del panel (PREPARADA para la fase 5; todavía no hay pantallas que la usen).
 * - Solo email + contraseña. No hay registro público (desactivado en Supabase).
 * - Ser administrador lo decide la BASE DE DATOS (función es_admin y RLS), no este código:
 *   aunque alguien modificara la página, sin el rol no puede leer borradores ni escribir.
 */

export async function iniciarSesion(email: string, contrasena: string): Promise<void> {
  const { error } = await obtenerSupabase().auth.signInWithPassword({ email: email.trim(), password: contrasena });
  if (error) throw new Error("No se pudo iniciar sesión. Revisá el correo y la contraseña.");
}

export async function cerrarSesion(): Promise<void> {
  await obtenerSupabase().auth.signOut({ scope: "global" });
}

export async function sesionActual(): Promise<Session | null> {
  const { data } = await obtenerSupabase().auth.getSession();
  return data.session;
}

/** Pregunta a la base de datos si la cuenta actual es administradora. */
export async function esAdministrador(): Promise<boolean> {
  const { data, error } = await obtenerSupabase().rpc("es_admin");
  return !error && data === true;
}

/**
 * Recuperación de contraseña: Supabase envía un correo con un enlace de un solo uso que
 * vuelve a /admin/nueva-contrasena (esa pantalla se construye en la fase 5).
 * Siempre responde igual, exista o no la cuenta, para no revelar qué correos están registrados.
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  await obtenerSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/admin/nueva-contrasena`,
  });
}

/** Se usa desde el enlace del correo de recuperación (sesión temporal de recuperación). */
export async function guardarNuevaContrasena(nueva: string): Promise<void> {
  if (nueva.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
  const { error } = await obtenerSupabase().auth.updateUser({ password: nueva });
  if (error) throw new Error("No se pudo guardar la contraseña nueva.");
}

/** Números del dashboard, calculados en la base de datos (solo responde al administrador). */
export interface EstadisticasPanel extends Partial<Estadisticas> {
  readonly desarrollos: number;
  readonly publicados: number;
  readonly borradores: number;
  readonly ocultos: number;
  readonly en_papelera: number;
  readonly con_material_incompleto: number;
  readonly detalle_incompletos: readonly { id: string; nombre: string; falta: readonly string[] }[];
  readonly unidades: number;
  readonly unidades_por_estado: Readonly<Record<string, number>>;
  readonly unidades_disponibles: number;
  readonly unidades_reservadas: number;
  readonly unidades_vendidas: number;
  readonly existe_estado_vendida: boolean;
  readonly fotos: number;
  readonly renders: number;
  readonly planos: number;
  readonly paginas_brochure: number;
  readonly portadas: number;
  readonly ultimas_modificaciones: readonly {
    fecha: string; tabla: string; registro: string; accion: string; usuario: string | null; rol: string | null;
  }[];
}

export async function leerEstadisticas(): Promise<EstadisticasPanel> {
  const { data, error } = await obtenerSupabase().rpc("estadisticas_panel");
  if (error) throw new Error("No se pudieron leer las estadísticas.");
  return data as EstadisticasPanel;
}
