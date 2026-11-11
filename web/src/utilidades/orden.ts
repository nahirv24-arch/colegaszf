import type { Desarrollo } from "../tipos/datos";

/**
 * Puntaje de "cuánto material tiene" un desarrollo. Misma fórmula que la página original:
 * disponibles cuenta doble; brochure, fotos, renders, planos, portada, posesión y dirección, uno cada uno.
 */
export function puntajeMaterial(e: Desarrollo): number {
  let n = 0;
  if ((e.disponibles ?? []).length) n += 2;
  for (const k of ["brochurePags", "imagenes", "galeria", "planos"] as const) {
    if ((e[k] ?? []).length) n++;
  }
  if (e.portada) n++;
  if (e.posesion) n++;
  if (e.direccion) n++;
  return n;
}

/** Los desarrollos con más material primero; a igual material, el orden de carga. */
export function ordenarPorMaterial(lista: readonly Desarrollo[]): { e: Desarrollo; i: number }[] {
  return lista
    .map((e, i) => ({ e, i, n: puntajeMaterial(e) }))
    .sort((a, b) => (b.n - a.n) || (a.i - b.i))
    .map(({ e, i }) => ({ e, i }));
}

/** El id del desarrollo, o "e<i>" si faltara (como el original). */
export function idDe(e: Desarrollo, i: number): string {
  return e.id || `e${i}`;
}
