import type { InfoMedio, ListasPropiedades, RutaMedio, Sitio } from "../tipos/datos";

/**
 * Todo lo que la página pública necesita para mostrarse.
 * Los componentes NUNCA leen archivos ni bases de datos directamente: reciben esto.
 */
export interface ContenidoPublico {
  readonly sitio: Sitio;
  readonly logo: RutaMedio;
  /** Medidas y datos de cada archivo, por ruta. */
  readonly medios: ReadonlyMap<RutaMedio, InfoMedio>;
  /** Terceros y Comercios publicados (listas vacías si todavía no hay ninguno). */
  readonly propiedades: ListasPropiedades;
}

/** Listas vacías: «Próximamente» en las dos categorías. */
export const SIN_PROPIEDADES: ListasPropiedades = { terceros: [], comercios: [] };

/**
 * Capa de acceso a datos. Implementaciones: JSON local (fuenteJsonLocal.ts) y Supabase
 * (fuenteSupabase.ts); se elige en servicios/index.ts. Los componentes no cambian.
 */
export interface FuenteDatos {
  /** Carga los datos publicados. */
  cargar(): Promise<ContenidoPublico>;
  /** Convierte una ruta guardada en los datos en una dirección que el navegador puede abrir. */
  urlMedio(ruta: RutaMedio): string;
}
