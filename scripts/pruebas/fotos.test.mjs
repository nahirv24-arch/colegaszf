// Pruebas automáticas de las fotos de Terceros: nombres de archivo y del ZIP.
// Uso: npm run pruebas
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseFotos, nombresArchivosFotos, nombreZipFotos, prefijoCategoria } from "../../web/src/utilidades/fotosPropiedad.ts";

test("prefijo por categoría", () => {
  assert.equal(prefijoCategoria("tercero"), "Terceros");
  assert.equal(prefijoCategoria("comercio"), "Locales");
});

test("ZIP: Terceros_<propiedad>_Fotos.zip, sin acentos ni signos", () => {
  assert.equal(nombreZipFotos("tercero", "Av. Colón 1234, 5° B"), "Terceros_Av-Colon-1234-5-B_Fotos.zip");
  assert.equal(nombreZipFotos("tercero", "", "Casa en Cerro de las Rosas"), "Terceros_Casa-en-Cerro-de-las-Rosas_Fotos.zip");
  assert.equal(baseFotos("tercero", "", ""), "Terceros_Propiedad");
});

test("fotos: numeradas en orden, con la extensión del original y sin repetidos", () => {
  const n = nombresArchivosFotos("tercero", "Ñu Porá 50", [
    "media/propiedades/x/foto/a.jpg", "media/propiedades/x/foto/b.webp", "media/propiedades/x/foto/c.png", "media/propiedades/x/foto/d.jpeg",
  ]);
  assert.deepEqual(n, [
    "Terceros_Nu-Pora-50_Foto_01.jpg", "Terceros_Nu-Pora-50_Foto_02.webp",
    "Terceros_Nu-Pora-50_Foto_03.png", "Terceros_Nu-Pora-50_Foto_04.jpg",
  ]);
  const muchas = nombresArchivosFotos("tercero", "X", Array.from({ length: 120 }, (_, i) => `f${i}.jpg`));
  assert.equal(muchas[0], "Terceros_X_Foto_001.jpg");
  assert.equal(new Set(muchas).size, 120);
});
