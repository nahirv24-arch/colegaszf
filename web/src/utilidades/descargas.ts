/**
 * Descargas: imagen suelta, galería en ZIP y brochure en PDF.
 * JSZip y jsPDF se cargan solo cuando alguien toca el botón (no pesan en la carga inicial).
 * Las imágenes se descargan con sus bytes originales; el PDF convierte cada página a JPEG
 * en el momento (calidad 0,85, fondo blanco), exactamente como la página original.
 */

import { anotarDescarga } from "../servicios/cuenta";

function guardar(blob: Blob, nombre: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/** Extensión según el archivo (jpg / webp / png), como hacía el original con el tipo de imagen. */
export function extension(url: string): string {
  const m = url.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return m?.[1] ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

async function traer(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar ${url}`);
  return r.blob();
}

export async function bajarImagen(url: string, nombre: string): Promise<void> {
  guardar(await traer(url), `${nombre}.${extension(url)}`);
  anotarDescarga("imagen", `${nombre}.${extension(url)}`);
}

export async function bajarZip(urls: readonly string[], nombre: string): Promise<void> {
  if (!urls.length) return;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const blobs = await Promise.all(urls.map(traer));
  urls.forEach((url, i) => {
    const num = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
    zip.file(`${nombre}-${num}.${extension(url)}`, blobs[i] as Blob);
  });
  guardar(await zip.generateAsync({ type: "blob" }), `${nombre}.zip`);
  anotarDescarga("zip", `${nombre}.zip`);
}

/** WEBP u otro formato → píxeles RGBA (sin pérdida), para ponerlos en un PDF. */
async function pixeles(blob: Blob): Promise<{ ancho: number; alto: number; rgba: Uint8ClampedArray }> {
  const bm = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bm.width;
  c.height = bm.height;
  const cx = c.getContext("2d");
  if (!cx) throw new Error("sin canvas");
  cx.drawImage(bm, 0, 0);
  bm.close();
  return { ancho: c.width, alto: c.height, rgba: cx.getImageData(0, 0, c.width, c.height).data };
}

/**
 * Un plano para descargar SIEMPRE en PDF: si ya es PDF, el original; si es imagen, un PDF con la imagen
 * sin perder calidad (JPG y PNG van dentro tal cual, sin recomprimir; WEBP pasa sus píxeles exactos).
 */
export async function planoEnPdf(url: string, titulo = ""): Promise<Blob> {
  const original = await traer(url);
  const bytes = new Uint8Array(await original.arrayBuffer());
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return original;
  const { pdfDeImagen, pdfDeRgba } = await import("./pdfDeImagen");
  let pdf = pdfDeImagen(bytes, titulo);
  if (!pdf) {
    const p = await pixeles(original);
    pdf = await pdfDeRgba(p.ancho, p.alto, p.rgba, titulo);
  }
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
}

export async function bajarPlanoPdf(url: string, nombre: string, titulo = ""): Promise<void> {
  guardar(await planoEnPdf(url, titulo), nombre);
  anotarDescarga("plano", nombre);
}

/** Descarga un archivo con el nombre indicado, con sus bytes originales (PDF o imagen, sin convertir). */
export async function bajarArchivo(url: string, nombre: string): Promise<void> {
  guardar(await traer(url), nombre);
  anotarDescarga("archivo", nombre);
}

/**
 * ZIP con nombres propios. Los archivos van SIN comprimir ("STORE"): los PDF y las imágenes ya vienen
 * comprimidos, así que no se pierde nada y cada archivo sale idéntico al original.
 * Los nombres tienen que llegar sin repetir (ver nombresArchivosPlanos).
 */
export async function bajarZipConNombres(
  archivos: readonly { url: string; nombre: string; armar?: () => Promise<Blob> }[], nombreZip: string,
): Promise<void> {
  if (!archivos.length) return;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  // `armar`: en vez del archivo tal cual, lo que devuelva (por ejemplo, el plano pasado a PDF).
  const blobs = await Promise.all(archivos.map((a) => (a.armar ? a.armar() : traer(a.url))));
  archivos.forEach((a, i) => zip.file(a.nombre, blobs[i] as Blob, { binary: true, compression: "STORE" }));
  guardar(await zip.generateAsync({ type: "blob", compression: "STORE" }), nombreZip);
  anotarDescarga("zip", nombreZip);
}

interface PaginaJPEG { dato: string; w: number; h: number }

function comoJPEG(src: string): Promise<PaginaJPEG | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const cx = c.getContext("2d");
      if (!cx) { res(null); return; }
      cx.fillStyle = "#fff";
      cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(im, 0, 0);
      res({ dato: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height });
    };
    im.onerror = () => res(null);
    // Las imágenes en Supabase están en otro dominio: sin esto el navegador no deja
    // pasarlas a JPEG para el PDF.
    im.crossOrigin = "anonymous";
    im.src = src;
  });
}

export async function bajarBrochure(urls: readonly string[], nombreDesarrollo: string): Promise<void> {
  if (!urls.length) return;
  const { jsPDF } = await import("jspdf");
  const paginas = (await Promise.all(urls.map(comoJPEG))).filter((p): p is PaginaJPEG => p !== null);
  if (!paginas.length) throw new Error("sin páginas");
  let doc: InstanceType<typeof jsPDF> | null = null;
  for (const im of paginas) {
    const orient = im.w >= im.h ? "l" : "p";
    if (!doc) doc = new jsPDF({ orientation: orient, unit: "px", format: [im.w, im.h] });
    else doc.addPage([im.w, im.h], orient);
    doc.addImage(im.dato, "JPEG", 0, 0, im.w, im.h);
  }
  const archivo = `${(nombreDesarrollo || "Brochure").replace(/\s+/g, "-")}-Brochure.pdf`;
  doc?.save(archivo);
  anotarDescarga("brochure", archivo);
}
