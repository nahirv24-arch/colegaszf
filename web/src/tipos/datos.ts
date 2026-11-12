/**
 * Tipos de los datos públicos. Reflejan EXACTAMENTE la forma de datos/desarrollos.json
 * (que a su vez es el JSON original de index.html con rutas en lugar de base64).
 * La clave "emprendimientos" se mantiene por compatibilidad; en pantalla se dice "desarrollos".
 */

/** Ruta relativa a un archivo de media/, por ejemplo "media/reggia-6/fotos/foto-01.jpg". */
export type RutaMedio = string;

/** [clave del campo de la unidad, título de la columna] */
export type Columna = readonly [clave: string, titulo: string];

/**
 * Una fila de la tabla de disponibles. Cada desarrollo usa columnas distintas
 * (sup, total, suptotal, contado, c1, c2…), por eso las claves son libres.
 * Los precios son TEXTO ("USD 156.948") y no se convierten a números.
 */
export interface Unidad {
  readonly grupo?: string;
  readonly piso?: string;
  readonly estado?: string;
  readonly [clave: string]: string | number | undefined;
}

export interface Links {
  readonly disponibles?: string;
  readonly brochure?: string;
  readonly planogeneral?: string;
}

export interface Desarrollo {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly desarrollista: string;
  readonly posesion: string;
  readonly gastos: string;
  /** "" si no tiene portada. */
  readonly portada: RutaMedio;
  /** Fotos reales. */
  readonly imagenes: readonly RutaMedio[];
  /** Renders. */
  readonly galeria: readonly RutaMedio[];
  readonly planos: readonly RutaMedio[];
  /** Páginas del brochure, en orden. */
  readonly brochurePags: readonly RutaMedio[];
  readonly links: Links;
  readonly disponibles: readonly Unidad[];
  readonly disponiblesEjemplo: boolean;
  readonly columnas: readonly Columna[];
  readonly notaTabla: string;
  /**
   * Reservado para el futuro panel (publicar / ocultar). Hoy no existe en los datos:
   * si falta, el desarrollo se considera publicado (como en la página original).
   */
  readonly publicado?: boolean;
}

export interface Sitio {
  /** Fecha AAAA-MM-DD de la última actualización. */
  readonly actualizado: string;
  /** Portada general de la página. */
  readonly portada: RutaMedio;
  readonly emprendimientos: readonly Desarrollo[];
}

/** Información de un archivo (de datos/medios.json). */
export interface InfoMedio {
  readonly ruta: RutaMedio;
  readonly sha256: string;
  readonly bytes: number;
  readonly formato: "jpeg" | "png" | "webp";
  readonly ancho: number | null;
  readonly alto: number | null;
}

export interface ReferenciaMedio {
  readonly ubicacion: string;
  readonly desarrollo: string | null;
  readonly seccion: string;
  readonly orden: number;
  readonly ruta: RutaMedio;
  readonly sha256: string;
  readonly mime_original: string;
}

export interface InventarioMedios {
  readonly logo: RutaMedio;
  readonly archivos: readonly InfoMedio[];
  readonly referencias: readonly ReferenciaMedio[];
}

/** Las secciones de imágenes de una ficha. */
export type ClaveGaleria = "imagenes" | "galeria" | "planos" | "brochurePags";

// ---------------------------------------------------------------------------------------------
// Terceros y Comercios (etapa 3). Forma que devuelve la función propiedades_publicas() de Supabase.
// Igual que en los desarrollos, precios y superficies son TEXTO y no se convierten.
// No hay datos de propietarios.
// ---------------------------------------------------------------------------------------------

export type CategoriaPropiedad = "tercero" | "comercio";
export type Operacion = "" | "venta" | "alquiler" | "venta_alquiler";
export type Disponibilidad = "disponible" | "reservada" | "vendida" | "alquilada" | "no_disponible";

export interface Documento {
  readonly ruta: RutaMedio;
  /** Nombre visible ("Reglamento", "Planilla de gastos"…). */
  readonly nombre: string;
}

export interface Propiedad {
  readonly id: string;
  readonly categoria: CategoriaPropiedad;
  readonly titulo: string;
  readonly operacion: Operacion;
  readonly direccion: string;
  readonly barrio: string;
  readonly precio: string;
  readonly expensas: string;
  readonly superficie: string;
  readonly disponibilidad: Disponibilidad;
  readonly descripcion: string;
  /** Campos propios de cada categoría (dormitorios, frente, rubro…). Valores de texto. */
  readonly detalles: Readonly<Record<string, string>>;
  /** video, recorrido, mapa… (direcciones web). */
  readonly links: Readonly<Record<string, string>>;
  /** "" si no tiene portada. */
  readonly portada: RutaMedio;
  readonly fotos: readonly RutaMedio[];
  readonly planos: readonly RutaMedio[];
  readonly documentos: readonly Documento[];
}

export interface ListasPropiedades {
  readonly terceros: readonly Propiedad[];
  readonly comercios: readonly Propiedad[];
}
