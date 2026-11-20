/**
 * Miniatura de un PDF (primera página) para mostrar en la web. SOLO se usa en el panel:
 * pdf.js se descarga recién cuando se sube un PDF, así la página de los colegas no pesa más.
 * El PDF original no se modifica: la miniatura es un archivo WEBP aparte.
 */

/** Lado mayor de la miniatura, en píxeles (alcanza para verla nítida a pantalla completa). */
const LADO_MAYOR = 2000;

export interface VistaGenerada { blob: Blob; ancho: number; alto: number }

export async function generarVistaPdf(datos: ArrayBuffer): Promise<VistaGenerada> {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  // Copia: pdf.js se queda con el buffer que recibe.
  const tarea = pdfjs.getDocument({ data: new Uint8Array(datos.slice(0)) });
  const doc = await tarea.promise;
  try {
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(4, LADO_MAYOR / Math.max(base.width, base.height));
    const vista = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vista.width);
    canvas.height = Math.round(vista.height);
    const cx = canvas.getContext("2d");
    if (!cx) throw new Error("El navegador no pudo preparar la miniatura.");
    cx.fillStyle = "#fff";
    cx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, canvasContext: cx, viewport: vista, background: "#ffffff" }).promise;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
    if (!blob) throw new Error("El navegador no pudo guardar la miniatura.");
    return { blob, ancho: canvas.width, alto: canvas.height };
  } finally {
    void tarea.destroy();
  }
}

/** ¿Los primeros bytes son de un PDF ("%PDF-")? */
export function esPdf(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes.slice(0, 5));
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
}
