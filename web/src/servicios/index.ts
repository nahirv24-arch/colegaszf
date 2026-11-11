import type { FuenteDatos } from "./fuente";
import { fuenteJsonLocal } from "./fuenteJsonLocal";

/**
 * Punto único donde se elige de dónde salen los datos.
 * Fase 4: reemplazar por la implementación de Supabase (misma interfaz FuenteDatos).
 */
export const fuente: FuenteDatos = fuenteJsonLocal;

export type { ContenidoPublico, FuenteDatos } from "./fuente";
