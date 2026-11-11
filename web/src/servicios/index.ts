import type { FuenteDatos } from "./fuente";
import { fuenteJsonLocal } from "./fuenteJsonLocal";
import { urlPublicaMedia } from "./urlSupabase";

/**
 * Punto único donde se elige de dónde salen los datos de la PÁGINA PÚBLICA.
 * - Por defecto: datos/*.json + media/ (como hoy).
 * - Con VITE_FUENTE_DATOS=supabase en el entorno: las versiones publicadas en Supabase.
 *   Así, cuando se decida conectar la web, los cambios publicados desde el panel se ven
 *   sin volver a desplegar. (Hoy NO está activado.)
 * La biblioteca de Supabase se descarga solo si se usa esa opción.
 */
const fuenteSupabaseDiferida: FuenteDatos = {
  cargar: async () => (await import("./fuenteSupabase")).fuenteSupabase.cargar(),
  urlMedio: urlPublicaMedia,
};

export const fuente: FuenteDatos =
  import.meta.env.VITE_FUENTE_DATOS === "supabase" ? fuenteSupabaseDiferida : fuenteJsonLocal;

export type { ContenidoPublico, FuenteDatos } from "./fuente";
