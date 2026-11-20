// Pruebas automáticas de cómo se muestran los textos libres (condiciones, descripción).
// Uso: npm run pruebas   (usa el sistema de pruebas que trae Node; sin librerías extra)
import assert from "node:assert/strict";
import { test } from "node:test";
import { bloquesDeTexto } from "../../web/src/utilidades/bloques.ts";

test("vacío o solo espacios → sin bloques (no se muestra nada)", () => {
  assert.deepEqual(bloquesDeTexto(""), []);
  assert.deepEqual(bloquesDeTexto("  \n\n  "), []);
  assert.deepEqual(bloquesDeTexto(undefined), []);
  assert.deepEqual(bloquesDeTexto(null), []);
});

test("un renglón vacío separa párrafos; los saltos simples se conservan", () => {
  assert.deepEqual(bloquesDeTexto("Primera línea\nsegunda línea\n\nOtro párrafo"), [
    { tipo: "parrafo", texto: "Primera línea\nsegunda línea" },
    { tipo: "parrafo", texto: "Otro párrafo" },
  ]);
});

test("renglones con «-», «•», «*» o «–» forman una lista", () => {
  assert.deepEqual(bloquesDeTexto("Condiciones:\n- Comisión 50 %\n• Sin precio\n* Consultar\n– Con cartel"), [
    { tipo: "parrafo", texto: "Condiciones:" },
    { tipo: "lista", items: ["Comisión 50 %", "Sin precio", "Consultar", "Con cartel"] },
  ]);
});

test("Windows (\\r\\n) se trata igual que \\n", () => {
  assert.deepEqual(bloquesDeTexto("A\r\nB\r\n\r\n- x"), [
    { tipo: "parrafo", texto: "A\nB" },
    { tipo: "lista", items: ["x"] },
  ]);
});

test("un guion pegado al texto o un número negativo no es lista", () => {
  assert.deepEqual(bloquesDeTexto("-5 % de descuento\nPrecio-final"), [
    { tipo: "parrafo", texto: "-5 % de descuento\nPrecio-final" },
  ]);
});

test("el HTML se trata como texto (no se interpreta)", () => {
  assert.deepEqual(bloquesDeTexto("<b>hola</b>"), [{ tipo: "parrafo", texto: "<b>hola</b>" }]);
});
