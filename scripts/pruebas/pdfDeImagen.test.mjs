// Pruebas automáticas: planos en imagen → PDF sin perder calidad.
// Uso: npm run pruebas
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { formatoParaPdf, pdfDeImagen, pdfDeRgba } from "../../web/src/utilidades/pdfDeImagen.ts";

const JPG = new Uint8Array(readFileSync(new URL("../../media/reggia-6/planos/plano-01.jpg", import.meta.url)));

/** PNG mínimo armado a mano (sin librerías). tipo 2 = RGB, 6 = RGBA. */
function png(ancho, alto, tipo = 2) {
  const trozo = (nombre, datos) => {
    const t = Buffer.from(nombre, "ascii");
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([largo, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = tipo;
  const filas = [];
  for (let y = 0; y < alto; y++) {
    filas.push(Buffer.from([0]));
    for (let x = 0; x < ancho; x++) {
      const px = [(x * 40) % 256, (y * 90) % 256, 128];
      filas.push(Buffer.from(tipo === 6 ? [...px, 200] : px));
    }
  }
  const idat = deflateSync(Buffer.concat(filas));
  return {
    bytes: new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      trozo("IHDR", ihdr), trozo("IDAT", idat), trozo("IEND", Buffer.alloc(0))])),
    idat,
  };
}

const contiene = (grande, chico) => Buffer.from(grande).indexOf(Buffer.from(chico)) >= 0;
const texto = (pdf) => Buffer.from(pdf).toString("latin1");

/** Revisa que la tabla de posiciones (xref) del PDF apunte a cada objeto: si no, los lectores lo dan por roto. */
function xrefCorrecta(pdf) {
  const t = texto(pdf);
  const inicio = Number(t.match(/startxref\n(\d+)/)[1]);
  assert.ok(t.startsWith("xref", inicio), "startxref apunta a la tabla");
  const filas = t.slice(inicio).split("\n").slice(2, 9);
  filas.slice(1).forEach((f, i) => assert.ok(t.startsWith(`${i + 1} 0 obj`, Number(f.slice(0, 10))), `objeto ${i + 1}`));
}

test("reconoce JPG y PNG; WEBP u otros necesitan convertirse", () => {
  assert.equal(formatoParaPdf(JPG), "jpeg");
  assert.equal(formatoParaPdf(png(2, 2).bytes), "png");
  const webp = new TextEncoder().encode("RIFF....WEBPVP8 ");
  assert.equal(formatoParaPdf(webp), null);
  assert.equal(pdfDeImagen(webp), null);
});

test("JPG → PDF: el JPG original va dentro BYTE POR BYTE (no se recomprime)", () => {
  const pdf = pdfDeImagen(JPG, "Plano 1 · Tipología");
  const t = texto(pdf);
  assert.ok(t.startsWith("%PDF-"));
  assert.ok(t.trimEnd().endsWith("%%EOF"));
  assert.ok(contiene(pdf, JPG), "el PDF tiene que contener el JPG completo, idéntico");
  assert.match(t, /\/Filter \/DCTDecode/);
  assert.equal((t.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.match(t, /\/Title <FEFF/);
  xrefCorrecta(pdf);
});

test("PNG → PDF: mismos datos comprimidos (sin pérdida ni recompresión) y misma medida", () => {
  const { bytes, idat } = png(300, 200);
  const pdf = pdfDeImagen(bytes);
  const t = texto(pdf);
  assert.match(t, /\/Width 300/);
  assert.match(t, /\/Height 200/);
  assert.match(t, /\/Filter \/FlateDecode \/DecodeParms << \/Predictor 15 \/Colors 3 \/BitsPerComponent 8 \/Columns 300 >>/);
  assert.ok(contiene(pdf, idat), "los datos del PNG van tal cual");
  assert.match(t, /\/MediaBox \[0 0 225 150\]/); // 96 ppp
  xrefCorrecta(pdf);
});

test("PNG con transparencia: se pasa por píxeles (pdfDeRgba), sin pérdida y sobre blanco", async () => {
  assert.equal(pdfDeImagen(png(4, 4, 6).bytes), null);
  const rgba = new Uint8Array([10, 20, 30, 255, 0, 0, 0, 0]); // 2×1: un píxel opaco y uno transparente
  const pdf = await pdfDeRgba(2, 1, rgba, "x");
  const t = texto(pdf);
  assert.match(t, /\/Width 2 \/Height 1 \/ColorSpace \/DeviceRGB/);
  xrefCorrecta(pdf);
  const ini = t.indexOf("stream\n", t.indexOf("/Subtype /Image")) + 7;
  const largo = Number(t.slice(t.indexOf("/Subtype /Image")).match(/\/Length (\d+)/)[1]);
  assert.deepEqual([...inflateSync(Buffer.from(pdf.subarray(ini, ini + largo)))], [10, 20, 30, 255, 255, 255]);
});
