// Pruebas automáticas de los planos: etiquetas, nombres de archivo (sin repetidos) y ZIP sin recomprimir.
// Uso: npm run pruebas
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import JSZip from "jszip";
import {
  esPdfPlano, etiquetaPlano, extensionPlano, nombresArchivosPlanos, paraArchivo, tituloPlano,
} from "../../web/src/utilidades/planos.ts";

test("etiqueta: tipología · variante; vacía si no hay datos", () => {
  assert.equal(etiquetaPlano({ tipologia: "2 dormitorios", variante: "Tipo C" }), "2 dormitorios · Tipo C");
  assert.equal(etiquetaPlano({ tipologia: "Monoambiente", variante: "" }), "Monoambiente");
  assert.equal(etiquetaPlano({ tipologia: " ", variante: " Tipo A " }), "Tipo A");
  assert.equal(etiquetaPlano({}), "");
});

test("título: nombre cargado › etiqueta › «Plano N»", () => {
  assert.equal(tituloPlano({ ruta: "a.pdf", nombre: "Frente", tipologia: "1 dormitorio" }, 0), "Frente");
  assert.equal(tituloPlano({ ruta: "a.pdf", tipologia: "1 dormitorio", variante: "Tipo B" }, 0), "1 dormitorio · Tipo B");
  assert.equal(tituloPlano({ ruta: "a.jpg" }, 2), "Plano 3");
});

test("extensión del ORIGINAL: por formato o por la ruta", () => {
  assert.equal(extensionPlano({ ruta: "media/x/planos/abc.pdf", formato: "pdf" }), "pdf");
  assert.equal(extensionPlano({ ruta: "media/x/planos/plano-01.jpg", formato: "" }), "jpg");
  assert.equal(extensionPlano({ ruta: "media/x/planos/p.webp" }), "webp");
  assert.equal(extensionPlano({ ruta: "media/x/planos/p.png", formato: "jpeg" }), "jpg");
  assert.equal(esPdfPlano({ ruta: "x.PDF" }), true);
  assert.equal(esPdfPlano({ ruta: "x.jpg" }), false);
});

test("texto para nombre de archivo: sin acentos, ñ ni signos", () => {
  assert.equal(paraArchivo("Reggia 6"), "Reggia-6");
  assert.equal(paraArchivo("Hyrī · Cañitas Park"), "Hyri-Canitas-Park");
  assert.equal(paraArchivo("2 dormitorios · Tipo C"), "2-dormitorios-Tipo-C");
  assert.equal(paraArchivo("¿?"), "");
});

test("nombres de archivo: claros, con la extensión correcta y SIN repetidos", () => {
  const n = nombresArchivosPlanos("Reggia 6", [
    { ruta: "a.pdf", formato: "pdf", tipologia: "2 dormitorios", variante: "Tipo C" },
    { ruta: "b.pdf", formato: "pdf", tipologia: "2 dormitorios", variante: "Tipo C" },
    { ruta: "media/reggia-6/planos/plano-03.jpg" },
    { ruta: "d.pdf", formato: "pdf", nombre: "Planta baja" },
    { ruta: "e.png", formato: "png", tipologia: "2 dormitorios", variante: "Tipo C" },
  ]);
  assert.deepEqual(n, [
    "Reggia-6_Plano_2-dormitorios-Tipo-C.pdf",
    "Reggia-6_Plano_2-dormitorios-Tipo-C-2.pdf",
    "Reggia-6_Plano_03.jpg",
    "Reggia-6_Plano_Planta-baja.pdf",
    "Reggia-6_Plano_2-dormitorios-Tipo-C.png",
  ]);
  assert.equal(new Set(n.map((x) => x.toLowerCase())).size, n.length);
});

test("siemprePdf: los planos en imagen se nombran .pdf (se descargan como PDF)", () => {
  const n = nombresArchivosPlanos("Reggia 6", [
    { ruta: "media/reggia-6/planos/plano-01.jpg" }, { ruta: "b.webp" }, { ruta: "c.pdf", formato: "pdf", tipologia: "Monoambiente" },
  ], { siemprePdf: true });
  assert.deepEqual(n, ["Reggia-6_Plano_01.pdf", "Reggia-6_Plano_02.pdf", "Reggia-6_Plano_Monoambiente.pdf"]);
});

test("sin nombre de desarrollo usa «ZF»", () => {
  assert.deepEqual(nombresArchivosPlanos("", [{ ruta: "a.pdf" }]), ["ZF_Plano_01.pdf"]);
});

test("ZIP: los archivos salen idénticos (STORE, sin recomprimir) y con sus nombres", async () => {
  // Un PDF mínimo y bytes al azar que imitan una imagen.
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const img = new Uint8Array(4096).map((_, i) => (i * 37) % 251);
  const nombres = nombresArchivosPlanos("Reggia 6", [
    { ruta: "a.pdf", formato: "pdf", tipologia: "Monoambiente", variante: "Tipo A" },
    { ruta: "b.jpg", formato: "jpeg" },
  ]);
  const zip = new JSZip();
  zip.file(nombres[0], pdf, { binary: true, compression: "STORE" });
  zip.file(nombres[1], img, { binary: true, compression: "STORE" });
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  const leido = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(leido.files).sort(), [...nombres].sort());
  const h = (b) => createHash("sha256").update(b).digest("hex");
  assert.equal(h(await leido.file(nombres[0]).async("uint8array")), h(pdf));
  assert.equal(h(await leido.file(nombres[1]).async("uint8array")), h(img));
  // STORE: el ZIP pesa lo mismo que los archivos más los encabezados (no se recomprimió nada).
  assert.ok(bytes.length >= pdf.length + img.length);
});
