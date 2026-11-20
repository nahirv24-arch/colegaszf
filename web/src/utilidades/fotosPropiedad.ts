/**
 * Fotos de Terceros y Locales / oficinas: nombres de archivo para descargar (sueltas y en ZIP).
 * Sin dependencias del navegador: se prueba con `npm run pruebas`.
 *   Terceros_Av-Colon-1234_Foto_01.jpg · Terceros_Av-Colon-1234_Fotos.zip
 */
import { extensionPlano, paraArchivo } from "./planos.ts";

/** "tercero" → "Terceros"; "comercio" → "Locales". */
export function prefijoCategoria(categoria: string): string {
  return categoria === "comercio" ? "Locales" : "Terceros";
}

/** Base común: categoría + dirección (o el título si no hay dirección). */
export function baseFotos(categoria: string, direccion: string, titulo = ""): string {
  const lugar = paraArchivo(direccion) || paraArchivo(titulo) || "Propiedad";
  return `${prefijoCategoria(categoria)}_${lugar}`;
}

/** Nombre del ZIP: "Terceros_Av-Colon-1234_Fotos.zip". */
export function nombreZipFotos(categoria: string, direccion: string, titulo = ""): string {
  return `${baseFotos(categoria, direccion, titulo)}_Fotos.zip`;
}

/** Un nombre por foto, en el mismo orden, con la extensión del ORIGINAL y sin repetidos. */
export function nombresArchivosFotos(categoria: string, direccion: string, rutas: readonly string[], titulo = ""): string[] {
  const base = baseFotos(categoria, direccion, titulo);
  const ancho = Math.max(2, String(rutas.length).length);
  return rutas.map((ruta, i) => `${base}_Foto_${String(i + 1).padStart(ancho, "0")}.${extensionPlano({ ruta })}`);
}
