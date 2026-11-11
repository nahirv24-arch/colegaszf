import type { Estadisticas } from "../tipos/admin";
import type { Sitio } from "../tipos/datos";

/**
 * Números para el futuro dashboard del administrador, calculados SIEMPRE a partir de los
 * datos reales (nunca escritos a mano). Si cambian los datos, cambian los números.
 * Hoy los datos no tienen "publicado": todos cuentan como publicados.
 */
export function calcularEstadisticas(sitio: Sitio): Estadisticas {
  const E = sitio.emprendimientos;
  const suma = (f: (e: Sitio["emprendimientos"][number]) => number) => E.reduce((t, e) => t + f(e), 0);
  const publicados = E.filter((e) => e.publicado !== false).length;
  return {
    desarrollos: E.length,
    publicados,
    borradores: E.length - publicados,
    unidades: suma((e) => (e.disponibles ?? []).length),
    fotos: suma((e) => (e.imagenes ?? []).length),
    renders: suma((e) => (e.galeria ?? []).length),
    planos: suma((e) => (e.planos ?? []).length),
    paginasBrochure: suma((e) => (e.brochurePags ?? []).length),
    desarrollosConBrochure: E.filter((e) => (e.brochurePags ?? []).length > 0).length,
    portadas: E.filter((e) => !!e.portada).length,
  };
}
