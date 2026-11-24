/**
 * Porcentaje del anticipo sobre el precio, calculado solo a partir de la tabla de disponibles
 * (no hay que cargarlo a mano). Ej.: precio «USD 123.000» y anticipo «USD 61.500» → «50 %».
 */

type Columnas = readonly (readonly [string, string])[];

/** «USD 123.000» → 123000 · «U$S 61.500,50» → 61500.5 · null si no es un monto. */
export function numeroMonto(v: unknown): number | null {
  const t = String(v ?? "").replace(/\s/g, "");
  const m = t.match(/\d[\d.,]*/);
  if (!m) return null;
  let s = m[0].replace(/[.,]$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // 123.000,50
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 123,000.50
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Columna del precio de lista: la primera que dice «precio» (no la de contado, m² ni cochera). */
export function clavePrecio(cols: Columnas): string | null {
  const c = cols.find(([k, t]) => /precio/i.test(`${k} ${t}`) && !/contado|m2|m²|cochera/i.test(`${k} ${t}`));
  return c ? c[0] : null;
}

export const esColumnaAnticipo = (k: string, t: string) => /anticipo/i.test(`${k} ${t}`);

/** «50 %», «37,5 %»; null si falta algún monto, si ya trae un % o si el resultado no tiene sentido. */
export function porcentajeAnticipo(fila: Readonly<Record<string, unknown>>, cols: Columnas, claveAnticipo: string): string | null {
  const kp = clavePrecio(cols);
  const valor = fila[claveAnticipo];
  if (!kp || /%/.test(String(valor ?? ""))) return null;
  const precio = numeroMonto(fila[kp]);
  const anticipo = numeroMonto(valor);
  if (!precio || !anticipo || anticipo > precio) return null;
  const p = Math.round((anticipo / precio) * 1000) / 10;
  return `${String(p).replace(".", ",")} %`;
}
