/**
 * Planos cargados como imagen → PDF de una página para descargar, SIN perder calidad y rápido:
 *   - JPG: los bytes originales van tal cual dentro del PDF (no se recomprime).
 *   - PNG (RGB, gris o paleta, sin transparencia): los datos comprimidos del PNG van tal cual (el PDF los
 *     entiende igual que el PNG), así que no hay que descomprimir ni recomprimir nada.
 *   - Cualquier otro caso (WEBP, PNG con transparencia…): se pasan los píxeles RGB sin pérdida (pdfDeRgba).
 * La página mide lo mismo que la imagen, a 96 ppp (cada píxel en su lugar).
 * Sin librerías ni dependencias del navegador: se prueba con `npm run pruebas`.
 */

export type FormatoImagenPdf = "jpeg" | "png";

/** Reconoce JPG o PNG por sus primeros bytes. null = otro formato (WEBP, etc.). */
export function formatoParaPdf(bytes: Uint8Array): FormatoImagenPdf | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return null;
}

interface ImagenPdf {
  readonly ancho: number;
  readonly alto: number;
  /** Datos ya comprimidos, tal como van en el PDF. */
  readonly datos: Uint8Array;
  /** Entradas del diccionario de la imagen: /ColorSpace, /Filter, /DecodeParms… */
  readonly dicc: string;
}

const ascii = (t: string) => new TextEncoder().encode(t);

/** Título del documento como texto UTF-16 (acentos y ñ incluidos). */
function textoPdf(t: string): string {
  let h = "FEFF";
  for (const c of t) {
    const n = c.codePointAt(0)!;
    if (n > 0xffff) continue;
    h += n.toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${h}>`;
}

const num = (x: number) => String(Math.round(x * 100) / 100);

/** Arma el PDF de una página con la imagen. */
function armarPdf(im: ImagenPdf, titulo: string): Uint8Array {
  const w = im.ancho * 0.75, h = im.alto * 0.75; // píxeles a puntos (96 ppp)
  const contenido = `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q`;
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let largo = 0;
  const poner = (x: Uint8Array | string) => { const b = typeof x === "string" ? ascii(x) : x; partes.push(b); largo += b.length; };
  const objeto = (n: number, cuerpo: string) => { offsets[n] = largo; poner(`${n} 0 obj\n${cuerpo}\nendobj\n`); };

  poner("%PDF-1.4\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  objeto(4, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
  offsets[5] = largo;
  poner(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.ancho} /Height ${im.alto} ${im.dicc} /Length ${im.datos.length} >>\nstream\n`);
  poner(im.datos);
  poner("\nendstream\nendobj\n");
  objeto(6, `<< /Producer (ZF Propiedades) ${titulo ? `/Title ${textoPdf(titulo)}` : ""} >>`);
  const xref = largo;
  poner(`xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => `${String(offsets[n]).padStart(10, "0")} 00000 n \n`).join("")}`);
  poner(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const pdf = new Uint8Array(largo);
  let p = 0;
  for (const b of partes) { pdf.set(b, p); p += b.length; }
  return pdf;
}

/** JPG: medidas y colores desde su encabezado. null si es un JPG raro (CMYK, etc.). */
function leerJpg(b: Uint8Array): ImagenPdf | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1]!;
    if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
    const largo = (b[i + 2]! << 8) | b[i + 3]!;
    // SOF0…SOF15 (menos DHT, JPG y DAC): ahí están las medidas.
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      const alto = (b[i + 5]! << 8) | b[i + 6]!;
      const ancho = (b[i + 7]! << 8) | b[i + 8]!;
      const comp = b[i + 9]!;
      if (!ancho || !alto || (comp !== 1 && comp !== 3)) return null;
      return { ancho, alto, datos: b, dicc: `/ColorSpace /${comp === 1 ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode` };
    }
    i += 2 + largo;
  }
  return null;
}

/** PNG sin transparencia ni entrelazado: se usan sus datos comprimidos tal cual. null si no se puede. */
function leerPng(b: Uint8Array): ImagenPdf | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 8, ancho = 0, alto = 0, bits = 0, tipo = -1, entrelazado = 0;
  let paleta: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (i + 8 <= b.length) {
    const largo = dv.getUint32(i);
    const nombre = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    const datos = b.subarray(i + 8, i + 8 + largo);
    if (nombre === "IHDR") {
      ancho = dv.getUint32(i + 8); alto = dv.getUint32(i + 12);
      bits = b[i + 16]!; tipo = b[i + 17]!; entrelazado = b[i + 20]!;
    } else if (nombre === "PLTE") paleta = datos;
    else if (nombre === "tRNS") return null; // transparencia: mejor por píxeles
    else if (nombre === "IDAT") idat.push(datos);
    else if (nombre === "IEND") break;
    i += 12 + largo;
  }
  if (!ancho || !alto || entrelazado || !idat.length || bits !== 8) return null;
  const colores = tipo === 0 ? 1 : tipo === 2 ? 3 : tipo === 3 ? 1 : 0;
  if (!colores || (tipo === 3 && !paleta)) return null; // 4 y 6 tienen canal de transparencia
  const espacio = tipo === 0 ? "/DeviceGray" : tipo === 2 ? "/DeviceRGB"
    : `[/Indexed /DeviceRGB ${paleta!.length / 3 - 1} <${Array.from(paleta!, (x) => x.toString(16).padStart(2, "0")).join("")}>]`;
  const total = idat.reduce((s, x) => s + x.length, 0);
  const todo = new Uint8Array(total);
  let p = 0;
  for (const x of idat) { todo.set(x, p); p += x.length; }
  return {
    ancho, alto, datos: todo,
    dicc: `/ColorSpace ${espacio} /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${colores} /BitsPerComponent 8 /Columns ${ancho} >>`,
  };
}

/** PDF directo desde un JPG o PNG. null = hay que pasar los píxeles con pdfDeRgba (WEBP, PNG con transparencia…). */
export function pdfDeImagen(bytes: Uint8Array, titulo = ""): Uint8Array | null {
  const f = formatoParaPdf(bytes);
  const im = f === "jpeg" ? leerJpg(bytes) : f === "png" ? leerPng(bytes) : null;
  return im ? armarPdf(im, titulo) : null;
}

/** Comprime con "deflate" (zlib), que es lo que el PDF llama FlateDecode. Nativo del navegador y de Node. */
async function deflate(datos: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([datos as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** PDF desde píxeles RGBA (los semitransparentes se apoyan sobre blanco). Sin pérdida. */
export async function pdfDeRgba(ancho: number, alto: number, rgba: Uint8Array | Uint8ClampedArray, titulo = ""): Promise<Uint8Array> {
  const rgb = new Uint8Array(ancho * alto * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3]!;
    if (a === 255) { rgb[j] = rgba[i]!; rgb[j + 1] = rgba[i + 1]!; rgb[j + 2] = rgba[i + 2]!; }
    else {
      const k = a / 255, fondo = 255 * (1 - k);
      rgb[j] = Math.round(rgba[i]! * k + fondo); rgb[j + 1] = Math.round(rgba[i + 1]! * k + fondo); rgb[j + 2] = Math.round(rgba[i + 2]! * k + fondo);
    }
  }
  return armarPdf({ ancho, alto, datos: await deflate(rgb), dicc: "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode" }, titulo);
}
