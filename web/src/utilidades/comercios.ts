import type { CategoriaPropiedad, Operacion, Propiedad } from "../tipos/datos";

/**
 * Terceros y Locales comerciales / oficinas en formato tabla (las mismas columnas que la planilla de Tokko).
 * Se guardan en la tabla "propiedades" (categoría "tercero" o "comercio") sin cambiar la base de datos:
 *   título y dirección = Dirección · operacion · barrio · precio (texto, sin la moneda)
 *   detalles: tipo, m2_cubiertos, m2_totales, moneda, cod_tokko · links: colegas (ficha de Tokko)
 */
export interface FilaComercio {
  tipo: string;
  operacion: Operacion;
  direccion: string;
  barrio: string;
  m2_cubiertos: string;
  m2_totales: string;
  moneda: string;
  precio: string;
  cod_tokko: string;
  link: string;
}

export const FILA_VACIA: FilaComercio = {
  tipo: "Local", operacion: "venta", direccion: "", barrio: "", m2_cubiertos: "", m2_totales: "",
  moneda: "USD", precio: "", cod_tokko: "", link: "",
};

/** Tipos sugeridos en el panel (se puede escribir otro). */
export const TIPOS: Readonly<Record<CategoriaPropiedad, readonly string[]>> = {
  comercio: ["Local", "Oficina"],
  tercero: ["Departamento", "Casa", "Dúplex", "PH", "Lote", "Cochera"],
};
export const MONEDAS = ["USD", "ARS"] as const;
export const OPERACIONES: readonly (readonly [Exclude<Operacion, "">, string])[] = [
  ["venta", "Venta"], ["alquiler", "Alquiler"], ["venta_alquiler", "Venta y alquiler"],
];

export function filaDePropiedad(p: Pick<Propiedad, "titulo" | "operacion" | "direccion" | "barrio" | "precio" | "detalles" | "links">): FilaComercio {
  const d = p.detalles ?? {};
  return {
    tipo: d.tipo ?? "",
    operacion: p.operacion,
    direccion: p.direccion || p.titulo,
    barrio: p.barrio,
    m2_cubiertos: d.m2_cubiertos ?? "",
    m2_totales: d.m2_totales ?? "",
    moneda: d.moneda ?? "",
    precio: p.precio,
    cod_tokko: d.cod_tokko ?? "",
    link: p.links?.colegas ?? "",
  };
}

/** "25" → "25 m²"; vacío → "—". */
export function metros(v: string): string {
  const t = v.trim();
  if (!t) return "—";
  return /m²|m2/i.test(t) ? t : `${t} m²`;
}

/** "USD" + "25.000" → "USD 25.000"; sin precio → "Consultar". */
export function precioCompleto(f: Pick<FilaComercio, "moneda" | "precio">): string {
  const p = f.precio.trim();
  if (!p) return "Consultar";
  return [f.moneda.trim(), p].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- CSV de Tokko

const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Encabezados aceptados para cada columna (sin acentos, espacios ni signos). */
const ENCABEZADOS: Readonly<Record<keyof FilaComercio, readonly string[]>> = {
  tipo: ["tipo"],
  operacion: ["operacion"],
  direccion: ["direccion"],
  barrio: ["barrio"],
  m2_cubiertos: ["m2cubiertos", "mcubiertos", "supcubierta", "superficiecubierta"],
  m2_totales: ["m2totales", "mtotales", "suptotal", "superficietotal"],
  moneda: ["moneda"],
  precio: ["precio"],
  cod_tokko: ["codtokko", "codigotokko", "codigo", "cod"],
  link: ["linkparacolegas", "link", "ficha", "linkcolegas"],
};

/** Separa un CSV respetando comillas ("Corro 303, local 2" queda en una sola celda). Acepta coma o punto y coma. */
export function leerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim()));
}

function operacionDe(v: string): Operacion {
  const n = normal(v);
  if (!n) return "";
  if (n.includes("venta") && n.includes("alquiler")) return "venta_alquiler";
  if (n.includes("alquiler")) return "alquiler";
  return "venta";
}

/** Convierte el CSV en filas. Devuelve también las columnas que no se encontraron. */
export function filasDeCsv(texto: string): { filas: FilaComercio[]; faltan: string[] } {
  const [cab, ...resto] = leerCsv(texto);
  if (!cab) return { filas: [], faltan: [] };
  const pos = {} as Record<keyof FilaComercio, number>;
  const faltan: string[] = [];
  for (const k of Object.keys(ENCABEZADOS) as (keyof FilaComercio)[]) {
    pos[k] = cab.findIndex((h) => ENCABEZADOS[k].includes(normal(h)));
    if (pos[k] < 0 && k !== "link" && k !== "cod_tokko" && k !== "m2_cubiertos") faltan.push(k);
  }
  const v = (f: string[], k: keyof FilaComercio) => (pos[k] >= 0 ? (f[pos[k]] ?? "").trim() : "");
  const filas = resto.map((f) => ({
    tipo: v(f, "tipo"), operacion: operacionDe(v(f, "operacion")), direccion: v(f, "direccion"), barrio: v(f, "barrio"),
    m2_cubiertos: "", m2_totales: v(f, "m2_totales"), moneda: v(f, "moneda").toUpperCase(),
    precio: v(f, "precio"), cod_tokko: v(f, "cod_tokko").toUpperCase(), link: v(f, "link"),
  })).filter((f) => f.direccion);
  return { filas, faltan };
}

/** Identificador para el link (/comercios#zlo7715318): el código de Tokko o, si no hay, la dirección. */
export function idPara(f: FilaComercio, usados: ReadonlySet<string>): string {
  const base = (f.cod_tokko || f.direccion).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "local";
  const limpio = base === "nuevo" ? "local-nuevo" : base;
  let id = limpio;
  for (let i = 2; usados.has(id); i++) id = `${limpio}-${i}`;
  return id;
}
