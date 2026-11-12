import type { InfoMedio, ListasPropiedades, Propiedad, RutaMedio, Sitio } from "../tipos/datos";
import { SIN_PROPIEDADES, type ContenidoPublico, type FuenteDatos } from "./fuente";
import { obtenerSupabase, urlPublicaMedia } from "./supabase";

/**
 * Fuente de datos desde Supabase (la que usa la página publicada).
 * - contenido_publico(): los desarrollos, con la misma forma que datos/desarrollos.json.
 * - propiedades_publicas(): Terceros y Comercios.
 * Las dos solo devuelven lo publicado y visible (lo garantiza la base de datos).
 * Si la segunda falla (por ejemplo, si la base todavía no tiene esas tablas), los desarrollos
 * se muestran igual y Terceros / Comercios quedan en «Próximamente».
 */
interface RespuestaContenido {
  readonly sitio: Sitio;
  readonly logo: RutaMedio;
  readonly medios: readonly InfoMedio[];
}

interface RespuestaPropiedades {
  readonly terceros: readonly Propiedad[] | null;
  readonly comercios: readonly Propiedad[] | null;
  readonly medios: readonly InfoMedio[] | null;
}

async function leerPropiedades(): Promise<{ listas: ListasPropiedades; medios: readonly InfoMedio[] }> {
  try {
    const { data, error } = await obtenerSupabase().rpc("propiedades_publicas");
    if (error) throw error;
    const r = data as RespuestaPropiedades;
    return {
      listas: { terceros: Array.isArray(r.terceros) ? r.terceros : [], comercios: Array.isArray(r.comercios) ? r.comercios : [] },
      medios: Array.isArray(r.medios) ? r.medios : [],
    };
  } catch {
    console.warn("No se pudieron leer Terceros y Comercios; se muestran como «Próximamente».");
    return { listas: SIN_PROPIEDADES, medios: [] };
  }
}

export const fuenteSupabase: FuenteDatos = {
  async cargar(): Promise<ContenidoPublico> {
    const [{ data, error }, prop] = await Promise.all([obtenerSupabase().rpc("contenido_publico"), leerPropiedades()]);
    if (error) throw new Error(`No se pudo leer Supabase: ${error.message}`);
    const r = data as RespuestaContenido;
    return {
      sitio: { ...r.sitio, emprendimientos: Array.isArray(r.sitio.emprendimientos) ? r.sitio.emprendimientos : [] },
      logo: r.logo,
      medios: new Map([...r.medios, ...prop.medios].map((m) => [m.ruta, m])),
      propiedades: prop.listas,
    };
  },
  urlMedio(ruta: RutaMedio): string {
    return urlPublicaMedia(ruta);
  },
};
