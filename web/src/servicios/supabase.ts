import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el NAVEGADOR. Usa solo la dirección y la clave PÚBLICA
 * (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY). La clave secreta nunca llega acá:
 * Vite solo entrega a la página las variables que empiezan con VITE_.
 * Los permisos reales los decide la base de datos (RLS), no este código.
 */
const URL_SB = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const CLAVE_PUBLICA = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";

export const supabaseConfigurado = URL_SB !== "" && CLAVE_PUBLICA !== "";

let cliente: SupabaseClient | null = null;

export function obtenerSupabase(): SupabaseClient {
  if (!supabaseConfigurado) throw new Error("Supabase no está configurado (.env.local)");
  cliente ??= createClient(URL_SB, CLAVE_PUBLICA, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return cliente;
}

export { urlPublicaMedia } from "./urlSupabase";
