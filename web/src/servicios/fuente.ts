import type { InfoMedio, RutaMedio, Sitio } from "../tipos/datos";

/**
 * Todo lo que la página pública necesita para mostrarse.
 * Los componentes NUNCA leen archivos ni bases de datos directamente: reciben esto.
 */
export interface ContenidoPublico {
  readonly sitio: Sitio;
  readonly logo: RutaMedio;
  /** Medidas y datos de cada archivo, por ruta. */
  readonly medios: ReadonlyMap<RutaMedio, InfoMedio>;
}

/**
 * Capa de acceso a datos. Hoy hay una sola implementación (JSON local, fuenteJsonLocal.ts).
 * En la fase de Supabase se agrega otra implementación con esta misma interfaz y se elige
 * en servicios/index.ts: los componentes no cambian.
 */
export interface FuenteDatos {
  /** Carga los datos publicados. */
  cargar(): Promise<ContenidoPublico>;
  /** Convierte una ruta guardada en los datos en una dirección que el navegador puede abrir. */
  urlMedio(ruta: RutaMedio): string;
}
