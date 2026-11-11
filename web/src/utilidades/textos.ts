import type { Columna, Unidad } from "../tipos/datos";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-11-06" → "6 de noviembre" (igual que la página original). */
export function fecha(iso: string): string {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  return `${parseInt(p[2] ?? "", 10)} de ${MESES[parseInt(p[1] ?? "", 10) - 1] ?? ""}`;
}

/** Hay un texto con contenido (no vacío ni solo espacios). */
export function hayTexto(u: unknown): u is string {
  return typeof u === "string" && u.trim().length > 0;
}

/** Columnas por defecto cuando un desarrollo no trae las suyas (copiadas del original). */
export const COLUMNAS_POR_DEFECTO: readonly Columna[] = [
  ["unidad", "Unidad"], ["tipologia", "Tipología"], ["sup", "Sup. total"], ["exterior", "Terraza / patio"],
  ["precio", "Precio"], ["anticipo", "Anticipo"], ["cuotas", "Cuotas"], ["entrega", "Entrega"], ["estado", "Estado"],
];

/** Valor de una celda tal cual viene en los datos; "—" si está vacío (como el original). */
export function celda(u: Unidad, clave: string): string {
  const v = u[clave];
  return v ? String(v) : "—";
}

/** "Patagonia 15" → "Patagonia-15" (para nombres de descargas, como el original). */
export function nombreArchivo(nombre: string): string {
  return nombre.replace(/\s+/g, "-");
}
