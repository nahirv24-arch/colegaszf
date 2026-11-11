/**
 * Utilidades para LEER el historial: etiquetas en castellano y diferencias "antes / después".
 * Las usan el dashboard, la página de actividad y la pestaña "Versiones e historial".
 */
import type { OrigenEvento, TipoEvento } from "./servicio";

export const ACCION: Record<string, string> = {
  crear: "Creación", editar: "Edición", eliminar: "Enviado a la papelera", restaurar: "Recuperado", borrar_definitivo: "Borrado definitivo",
};
export const TABLA: Record<string, string> = {
  desarrollos: "Datos del desarrollo", unidades: "Unidad", medios: "Archivo", publicaciones: "Publicación",
  configuracion: "Configuración", roles_usuario: "Rol de usuario",
};
export const TIPO: Record<TipoEvento, string> = {
  publicacion: "Publicación", edicion: "Edición", alta: "Alta", papelera: "Papelera", recuperacion: "Recuperación",
  borrado: "Borrado definitivo", visibilidad: "Visibilidad", orden: "Cambio de orden",
};
export const ORIGEN: Record<OrigenEvento, string> = { administracion: "Administración", sistema: "Sistema", prueba: "Prueba automatizada" };

/** Sellos internos que no aportan al leer el historial. En unidades, las columnas calculadas
 *  (grupo, piso, precio…) ya se muestran dentro de "campos". */
const SELLOS = new Set(["modificado_en", "modificado_por", "creado_en", "creado_por", "eliminado_por", "id", "orden_campos",
  "desarrollo_id", "bucket", "sha256", "metadatos"]);
const CALCULADAS_UNIDAD = new Set(["grupo", "piso", "unidad", "tipologia", "estado", "precio"]);
const NOMBRES: Record<string, string> = {
  nombre: "Nombre", direccion: "Dirección", desarrollista: "Desarrollista", posesion: "Posesión", gastos: "Gastos",
  nota_tabla: "Nota de la tabla", links: "Enlaces", columnas: "Columnas", visible: "Visible en la página", estado: "Estado",
  eliminado_en: "En la papelera desde", info_extra: "Información adicional", disponibles_ejemplo: "Aviso «datos de ejemplo»",
  posicion: "Posición", orden: "Posición", tipo: "Tipo", ruta: "Archivo", ancho: "Ancho", alto: "Alto", bytes: "Tamaño",
  formato: "Formato", mime: "Tipo de archivo", version: "Versión", vigente: "Es la vigente", nota: "Nota",
  publicado_en: "Publicado el", publicado_por: "Publicado por", valor: "Valor", clave: "Clave",
};

export interface CambioLegible { tabla: string; accion: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }

/** Los reordenamientos pasan por una posición transitoria (+1.000.000): ese paso no se muestra. */
export function esTransitorio(h: CambioLegible): boolean {
  const d = h.despues ?? {};
  return h.accion === "editar" && ((typeof d.posicion === "number" && d.posicion >= 1000000) || (typeof d.orden === "number" && d.orden >= 1000000));
}

/** Diferencias legibles entre "antes" y "después". */
export function diferencias(h: CambioLegible): { campo: string; antes: string; despues: string }[] {
  const a = h.antes ?? {}, d = h.despues ?? {};
  const out: { campo: string; antes: string; despues: string }[] = [];
  const txt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (SELLOS.has(k) || (h.tabla === "unidades" && CALCULADAS_UNIDAD.has(k))) continue;
    if (k === "campos" && typeof a[k] === "object" && typeof d[k] === "object") {
      const ca = (a[k] ?? {}) as Record<string, unknown>, cd = (d[k] ?? {}) as Record<string, unknown>;
      for (const c of new Set([...Object.keys(ca), ...Object.keys(cd)])) if (txt(ca[c]) !== txt(cd[c])) out.push({ campo: c, antes: txt(ca[c]), despues: txt(cd[c]) });
      continue;
    }
    if (k === "contenido") continue;
    // Posición transitoria de un reordenamiento (+1.000.000) → posición real anterior.
    const real = (v: unknown) => ((k === "posicion" || k === "orden") && typeof v === "number" && v >= 1000000 ? v - 1000000 : v);
    if (txt(a[k]) !== txt(d[k])) out.push({ campo: NOMBRES[k] ?? k, antes: h.antes ? txt(real(a[k])) : "", despues: h.despues ? txt(real(d[k])) : "" });
  }
  return out.slice(0, 30);
}

/** Quién hizo un cambio, sin exponer cuentas temporales. */
export function quien(email: string | null, rol: string | null, origen?: OrigenEvento): string {
  if (origen === "prueba") return "Prueba automatizada";
  if (email) return email;
  if (rol === "service_role" || origen === "sistema") return "Sistema (importación o script)";
  return "Sistema";
}
