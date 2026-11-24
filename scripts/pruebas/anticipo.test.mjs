// Pruebas automáticas: porcentaje del anticipo sobre el precio.
// Uso: npm run pruebas
import assert from "node:assert/strict";
import { test } from "node:test";
import { clavePrecio, numeroMonto, porcentajeAnticipo } from "../../web/src/utilidades/anticipo.ts";

const COLS = [["unidad", "Unidad"], ["precio", "Precio"], ["anticipo", "Anticipo"], ["estado", "Estado"]];

test("lee montos escritos de distintas formas", () => {
  assert.equal(numeroMonto("USD 123.000"), 123000);
  assert.equal(numeroMonto("U$S 61.500,50"), 61500.5);
  assert.equal(numeroMonto("USD 123,000"), 123000);
  assert.equal(numeroMonto("$ 32.00"), 32);
  assert.equal(numeroMonto("—"), null);
  assert.equal(numeroMonto(""), null);
});

test("casos de la tabla de Nahir", () => {
  assert.equal(porcentajeAnticipo({ precio: "USD 123.000", anticipo: "USD 61.500" }, COLS, "anticipo"), "50 %");
  assert.equal(porcentajeAnticipo({ precio: "USD 139.000", anticipo: "USD 69.500" }, COLS, "anticipo"), "50 %");
  assert.equal(porcentajeAnticipo({ precio: "USD 80.000", anticipo: "USD 30.000" }, COLS, "anticipo"), "37,5 %");
});

test("no muestra nada si falta un dato, ya trae % o no tiene sentido", () => {
  assert.equal(porcentajeAnticipo({ precio: "USD 100.000", anticipo: "—" }, COLS, "anticipo"), null);
  assert.equal(porcentajeAnticipo({ precio: "", anticipo: "USD 30.000" }, COLS, "anticipo"), null);
  assert.equal(porcentajeAnticipo({ precio: "USD 100.000", anticipo: "30 %" }, COLS, "anticipo"), null);
  assert.equal(porcentajeAnticipo({ precio: "USD 100.000", anticipo: "USD 130.000" }, COLS, "anticipo"), null);
  assert.equal(porcentajeAnticipo({ anticipo: "USD 30.000" }, [["anticipo", "Anticipo"]], "anticipo"), null);
});

test("el precio de lista es la columna «precio», no la de contado", () => {
  assert.equal(clavePrecio([["contado", "Precio contado"], ["precio_lista", "Precio"]]), "precio_lista");
  assert.equal(clavePrecio([["m2", "Precio m²"], ["valor", "Precio"]]), "valor");
});
