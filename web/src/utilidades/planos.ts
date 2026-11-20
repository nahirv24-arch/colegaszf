/**
 * Planos: etiquetas de tipología y nombres de archivo para las descargas.
 * Lo usan la página pública (etiquetas, descarga individual y ZIP) y el panel (desplegable de tipologías).
 * Sin dependencias del navegador: se prueba con `npm run pruebas`.
 */

/** Opciones del desplegable del panel. «Otra» permite escribir cualquier texto. */
export const TIPOLOGIAS = ["Monoambiente", "1 dormitorio", "2 dormitorios", "3 dormitorios", "4 dormitorios"] as const;

/** Lo mínimo que hace falta de un plano para nombrarlo y etiquetarlo. */
export interface DatosPlano {
  /** Ruta del archivo ORIGINAL (PDF o imagen). */
  readonly ruta: string;
  readonly nombre?: string;
  readonly tipologia?: string;
  readonly variante?: string;
  /** "pdf", "jpeg", "png", "webp" o "" si no se sabe. */
  readonly formato?: string;
}

/** "2 dormitorios · Tipo C" (lo que va superpuesto en la miniatura). "" si no hay datos. */
export function etiquetaPlano(p: Pick<DatosPlano, "tipologia" | "variante">): string {
  return [p.tipologia, p.variante].map((t) => (t ?? "").trim()).filter(Boolean).join(" · ");
}

/** Título visible: el nombre cargado, si no la etiqueta, si no «Plano N». */
export function tituloPlano(p: DatosPlano, i: number): string {
  return (p.nombre ?? "").trim() || etiquetaPlano(p) || `Plano ${i + 1}`;
}

/** Extensión del archivo original ("pdf", "jpg", "png", "webp"). */
export function extensionPlano(p: Pick<DatosPlano, "ruta" | "formato">): string {
  const f = (p.formato ?? "").toLowerCase();
  if (f === "pdf" || f === "png" || f === "webp") return f;
  if (f === "jpeg" || f === "jpg") return "jpg";
  const m = p.ruta.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  const e = (m?.[1] ?? "jpg").toLowerCase();
  return e === "jpeg" ? "jpg" : e;
}

export const esPdfPlano = (p: Pick<DatosPlano, "ruta" | "formato">) => extensionPlano(p) === "pdf";

/** "Reggia 6" → "Reggia-6"; "2 dormitorios · Tipo C" → "2-dormitorios-Tipo-C". Sin acentos ni signos raros. */
export function paraArchivo(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/**
 * Nombres de archivo para descargar los planos de un desarrollo, en el mismo orden, sin repetidos.
 *   Reggia-6_Plano_2-dormitorios-Tipo-C.pdf · Reggia-6_Plano_03.jpg · Reggia-6_Plano_Tipo-A-2.pdf
 */
export function nombresArchivosPlanos(desarrollo: string, planos: readonly DatosPlano[], opciones: { siemprePdf?: boolean } = {}): string[] {
  const base = paraArchivo(desarrollo) || "ZF";
  const usados = new Set<string>();
  return planos.map((p, i) => {
    const num = String(i + 1).padStart(2, "0");
    const detalle = paraArchivo(etiquetaPlano(p)) || paraArchivo(p.nombre ?? "") || num;
    // siemprePdf: los planos en imagen también se descargan como PDF.
    const ext = opciones.siemprePdf ? "pdf" : extensionPlano(p);
    let nombre = `${base}_Plano_${detalle}.${ext}`;
    for (let k = 2; usados.has(nombre.toLowerCase()); k++) nombre = `${base}_Plano_${detalle}-${k}.${ext}`;
    usados.add(nombre.toLowerCase());
    return nombre;
  });
}
