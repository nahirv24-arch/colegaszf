import type { CategoriaPropiedad, Disponibilidad, Operacion } from "../tipos/datos";

/** Textos visibles de los valores guardados en Terceros y Comercios. */
export const OPERACION: Readonly<Record<Operacion, string>> = {
  "": "",
  venta: "Venta",
  alquiler: "Alquiler",
  venta_alquiler: "Venta y alquiler",
};

export const DISPONIBILIDAD: Readonly<Record<Disponibilidad, string>> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  alquilada: "Alquilada",
  no_disponible: "No disponible",
};

/** Campos propios de cada categoría (se guardan en "detalles"), en el orden en que se muestran. */
export const DETALLES: Readonly<Record<CategoriaPropiedad, readonly (readonly [clave: string, etiqueta: string])[]>> = {
  tercero: [
    ["tipo", "Tipo"], ["ambientes", "Ambientes"], ["dormitorios", "Dormitorios"],
    ["banos", "Baños"], ["cochera", "Cochera"], ["antiguedad", "Antigüedad"],
  ],
  comercio: [
    ["rubro", "Rubro"], ["frente", "Frente"], ["planta", "Ubicación"], ["banos", "Baños"],
  ],
};

/** Links opcionales de una propiedad. */
export const LINKS: readonly (readonly [clave: string, etiqueta: string])[] = [
  ["video", "Ver el video"], ["recorrido", "Recorrido 360°"], ["mapa", "Ver en el mapa"],
];

/** Detalles con valor, con su etiqueta (los desconocidos se muestran con su clave). */
export function detallesVisibles(categoria: CategoriaPropiedad, detalles: Readonly<Record<string, string>>): [string, string][] {
  const conocidos = DETALLES[categoria];
  const lista: [string, string][] = [];
  for (const [clave, etiqueta] of conocidos) {
    const v = String(detalles[clave] ?? "").trim();
    if (v) lista.push([etiqueta, v]);
  }
  for (const [clave, valor] of Object.entries(detalles)) {
    const v = String(valor ?? "").trim();
    if (v && !conocidos.some(([c]) => c === clave)) lista.push([clave.charAt(0).toUpperCase() + clave.slice(1), v]);
  }
  return lista;
}

/** Solo direcciones web (evita links "javascript:" u otros esquemas). */
export function linkSeguro(url: string | undefined): string | null {
  const u = String(url ?? "").trim();
  return /^https?:\/\//i.test(u) ? u : null;
}
