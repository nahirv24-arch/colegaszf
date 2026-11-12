import type { InfoMedio, InventarioMedios, RutaMedio, Sitio } from "../tipos/datos";
import { SIN_PROPIEDADES, type ContenidoPublico, type FuenteDatos } from "./fuente";

/**
 * Lee datos/desarrollos.json y datos/medios.json (generados en la fase 2) y las imágenes
 * de media/. En desarrollo los sirve Vite desde la raíz del repo; en producción están en dist/.
 */
const BASE = import.meta.env.BASE_URL;

async function leerJson<T>(ruta: string): Promise<T> {
  const r = await fetch(BASE + ruta);
  if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status})`);
  return (await r.json()) as T;
}

export const fuenteJsonLocal: FuenteDatos = {
  async cargar(): Promise<ContenidoPublico> {
    const [sitio, inventario] = await Promise.all([
      leerJson<Sitio>("datos/desarrollos.json"),
      leerJson<InventarioMedios>("datos/medios.json"),
    ]);
    const medios = new Map<RutaMedio, InfoMedio>(inventario.archivos.map((a) => [a.ruta, a]));
    // Igual que el original: si no hay lista de desarrollos, se muestra vacía.
    const lista = Array.isArray(sitio.emprendimientos) ? sitio.emprendimientos : [];
    // Terceros y Comercios no existen en el JSON original: quedan en «Próximamente».
    return { sitio: { ...sitio, emprendimientos: lista }, logo: inventario.logo, medios, propiedades: SIN_PROPIEDADES };
  },
  urlMedio(ruta: RutaMedio): string {
    return BASE + ruta;
  },
};
