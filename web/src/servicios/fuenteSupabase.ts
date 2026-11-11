import type { InfoMedio, RutaMedio, Sitio } from "../tipos/datos";
import type { ContenidoPublico, FuenteDatos } from "./fuente";
import { obtenerSupabase, urlPublicaMedia } from "./supabase";

/**
 * Fuente de datos desde Supabase (PREPARADA, todavía NO se usa en la página).
 * Llama a la función contenido_publico(), que devuelve exactamente la misma forma que
 * datos/desarrollos.json y solo incluye lo publicado y visible (lo garantiza la base de datos).
 * Para activarla en el futuro: cambiar una línea en servicios/index.ts.
 */
interface RespuestaContenido {
  readonly sitio: Sitio;
  readonly logo: RutaMedio;
  readonly medios: readonly InfoMedio[];
}

export const fuenteSupabase: FuenteDatos = {
  async cargar(): Promise<ContenidoPublico> {
    const { data, error } = await obtenerSupabase().rpc("contenido_publico");
    if (error) throw new Error(`No se pudo leer Supabase: ${error.message}`);
    const r = data as RespuestaContenido;
    return {
      sitio: { ...r.sitio, emprendimientos: Array.isArray(r.sitio.emprendimientos) ? r.sitio.emprendimientos : [] },
      logo: r.logo,
      medios: new Map(r.medios.map((m) => [m.ruta, m])),
    };
  },
  urlMedio(ruta: RutaMedio): string {
    return urlPublicaMedia(ruta);
  },
};
