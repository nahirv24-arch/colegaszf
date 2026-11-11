/**
 * Descargas: imagen suelta, galería en ZIP y brochure en PDF.
 * JSZip y jsPDF se cargan solo cuando alguien toca el botón (no pesan en la carga inicial).
 * Las imágenes se descargan con sus bytes originales; el PDF convierte cada página a JPEG
 * en el momento (calidad 0,85, fondo blanco), exactamente como la página original.
 */

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
  doc?.save(`${(nombreDesarrollo || "Brochure").replace(/\s+/g, "-")}-Brochure.pdf`);
}
