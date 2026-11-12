/**
 * Operaciones del panel para Terceros y Comercios. Mismo criterio que servicio.ts:
 * los permisos los decide la base de datos (RLS + funciones que verifican es_admin()).
 * Todo se guarda en la COPIA DE TRABAJO; la página pública cambia recién al publicar.
 */
import { obtenerSupabase, urlPublicaMedia } from "../servicios/supabase";
import type { CategoriaPropiedad, Disponibilidad, InfoMedio, Operacion, Propiedad } from "../tipos/datos";
import { ErrorPanel, FORMATOS_PERMITIDOS, LIMITE_BYTES, mensajeError, revisarArchivo, type EstadoPublicacion } from "./servicio";

const sb = () => obtenerSupabase();

function revisar<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErrorPanel(mensajeError(r.error));
  return r.data;
}

// ---------------------------------------------------------------- categorías del panel
export type ClavePanel = "terceros" | "comercios";

export interface InfoCategoria {
  readonly clave: ClavePanel;
  readonly db: CategoriaPropiedad;
  readonly titulo: string;
  /** "propiedad de terceros", "comercio" */
  readonly singular: string;
  readonly nuevo: string;
  readonly volver: string;
  readonly ejemploTitulo: string;
}

export const CATEGORIAS_PANEL: Readonly<Record<ClavePanel, InfoCategoria>> = {
  terceros: {
    clave: "terceros", db: "tercero", titulo: "Terceros", singular: "propiedad de terceros",
    nuevo: "+ Nueva propiedad", volver: "← Todas las propiedades de terceros", ejemploTitulo: "Casa en Cerro de las Rosas",
  },
  comercios: {
    clave: "comercios", db: "comercio", titulo: "Locales comerciales / oficinas", singular: "local u oficina",
    nuevo: "+ Nuevo local u oficina", volver: "← Todos los locales y oficinas", ejemploTitulo: "Local sobre Av. Colón",
  },
};

// ---------------------------------------------------------------- tipos
export interface ResumenPropiedad {
  id: string; categoria: CategoriaPropiedad; titulo: string; operacion: Operacion;
  direccion: string; barrio: string; precio: string; disponibilidad: Disponibilidad;
  estado: EstadoPublicacion; visible: boolean; eliminado_en: string | null; modificado_en: string;
  fotos: number; planos: number; documentos: number; tiene_portada: boolean; faltan: string[];
  version_vigente: number | null; publicado_en: string | null; cambios_sin_publicar: boolean;
}

export interface FilaPropiedad {
  id: string; categoria: CategoriaPropiedad; posicion: number; titulo: string; operacion: Operacion;
  direccion: string; barrio: string; precio: string; expensas: string; superficie: string;
  disponibilidad: Disponibilidad; descripcion: string;
  detalles: Record<string, string>; links: Record<string, string>;
  estado: EstadoPublicacion; visible: boolean; creado_en: string; modificado_en: string; eliminado_en: string | null;
}

export type DatosPropiedad = Pick<FilaPropiedad, "titulo" | "operacion" | "direccion" | "barrio" | "precio" | "expensas"
  | "superficie" | "disponibilidad" | "descripcion" | "detalles" | "links">;

export type TipoMedioProp = "portada" | "foto" | "plano" | "documento";

export interface FilaMedioProp {
  id: string; propiedad_id: string; tipo: TipoMedioProp; orden: number; bucket: "media" | "privado";
  ruta: string; nombre: string; ancho: number | null; alto: number | null; bytes: number | null;
  sha256: string | null; formato: "jpeg" | "png" | "webp" | "pdf" | null; mime: string | null;
  eliminado_en: string | null; creado_en: string;
}

// ---------------------------------------------------------------- lectura
export async function listarPropiedades(categoria: CategoriaPropiedad | null): Promise<ResumenPropiedad[]> {
  return (revisar(await sb().rpc("resumen_propiedades", { p_categoria: categoria })) ?? []) as ResumenPropiedad[];
}

export async function leerPropiedad(id: string): Promise<FilaPropiedad | null> {
  return revisar(await sb().from("propiedades").select("*").eq("id", id).maybeSingle()) as FilaPropiedad | null;
}

/** La ficha armada con el borrador (vista previa). */
export async function propiedadBorrador(id: string): Promise<{ propiedad: Propiedad; medios: InfoMedio[] } | null> {
  return revisar(await sb().rpc("propiedad_borrador", { p_id: id })) as { propiedad: Propiedad; medios: InfoMedio[] } | null;
}

// ---------------------------------------------------------------- escritura
const LIMITES: Partial<Record<keyof DatosPropiedad, number>> = {
  titulo: 120, direccion: 200, barrio: 100, precio: 80, expensas: 80, superficie: 80, descripcion: 4000,
};

/** Revisa los datos antes de guardar. Devuelve los errores por campo (vacío = todo bien). */
export function validarPropiedad(d: DatosPropiedad): Record<string, string> {
  const err: Record<string, string> = {};
  if (!d.titulo.trim()) err.titulo = "El título es obligatorio.";
  for (const [k, max] of Object.entries(LIMITES) as [keyof DatosPropiedad, number][]) {
    const v = d[k];
    if (typeof v === "string" && v.length > max) err[k] = `Máximo ${max} caracteres (hay ${v.length}).`;
  }
  for (const [k, v] of Object.entries(d.links)) {
    if (v.trim() && !/^https?:\/\/[^\s]+$/i.test(v.trim())) err[`links.${k}`] = "Tiene que ser una dirección web completa (https://…).";
  }
  return err;
}

/** Limpia espacios y quita detalles y links vacíos (no se guardan claves sin valor). */
function normalizar(d: DatosPropiedad): DatosPropiedad {
  const limpio = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return {
    ...d,
    titulo: d.titulo.trim(), direccion: d.direccion.trim(), barrio: d.barrio.trim(), precio: d.precio.trim(),
    expensas: d.expensas.trim(), superficie: d.superficie.trim(), descripcion: d.descripcion.trim(),
    detalles: limpio(d.detalles), links: limpio(d.links),
  };
}

export async function crearPropiedad(id: string, categoria: CategoriaPropiedad, d: DatosPropiedad): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new ErrorPanel("El identificador solo puede tener letras minúsculas, números y guiones.");
  if (id === "nuevo") throw new ErrorPanel("«nuevo» está reservado por el panel: elegí otro identificador.");
  if (Object.keys(validarPropiedad(d)).length) throw new ErrorPanel("Revisá los campos marcados.");
  const existe = revisar(await sb().from("propiedades").select("id").eq("id", id).maybeSingle());
  if (existe) throw new ErrorPanel(`Ya existe una propiedad con el identificador "${id}" (puede estar en la papelera).`);
  revisar(await sb().from("propiedades").insert({ id, categoria, estado: "borrador", visible: true, ...normalizar(d) }));
}

export async function guardarPropiedad(id: string, d: DatosPropiedad): Promise<void> {
  if (Object.keys(validarPropiedad(d)).length) throw new ErrorPanel("Revisá los campos marcados.");
  revisar(await sb().from("propiedades").update(normalizar(d)).eq("id", id).select("id").single());
}

export async function publicarPropiedad(id: string, nota: string, actualizarFecha: boolean): Promise<number> {
  return revisar(await sb().rpc("publicar_propiedad", { p_id: id, p_nota: nota, p_actualizar_fecha: actualizarFecha })) as number;
}

/** Despublicar / volver a mostrar (efecto inmediato en la página; no borra nada). */
export async function cambiarVisiblePropiedad(id: string, visible: boolean): Promise<void> {
  revisar(await sb().from("propiedades").update({ visible }).eq("id", id).select("id").single());
}

export async function propiedadAPapelera(id: string): Promise<void> {
  revisar(await sb().rpc("eliminar_propiedad", { p_id: id }));
}
export async function propiedadDePapelera(id: string): Promise<void> {
  revisar(await sb().rpc("restaurar_propiedad", { p_id: id }));
}

// ---------------------------------------------------------------- archivos
export const urlMedioProp = (m: Pick<FilaMedioProp, "ruta">) => urlPublicaMedia(`media/${m.ruta}`);

export async function listarMediosProp(id: string): Promise<FilaMedioProp[]> {
  return revisar(await sb().from("propiedad_medios").select("*").eq("propiedad_id", id).order("tipo").order("orden")) as FilaMedioProp[];
}

/** Revisa un PDF antes de subirlo: tipo, tamaño y que realmente empiece como PDF. */
async function revisarPdf(f: File): Promise<void> {
  if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) throw new ErrorPanel(`"${f.name}": solo se aceptan archivos PDF.`);
  if (f.size === 0) throw new ErrorPanel(`"${f.name}": el archivo está vacío.`);
  if (f.size > LIMITE_BYTES) throw new ErrorPanel(`"${f.name}": pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es 20 MB.`);
  const inicio = new TextDecoder().decode(await f.slice(0, 5).arrayBuffer());
  if (inicio !== "%PDF-") throw new ErrorPanel(`"${f.name}": no parece un PDF válido.`);
}

async function huella(f: File): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function siguienteOrden(id: string, tipo: TipoMedioProp): Promise<number> {
  if (tipo === "portada") return 0;
  const r = revisar(await sb().from("propiedad_medios").select("orden").eq("propiedad_id", id).eq("tipo", tipo)
    .is("eliminado_en", null).order("orden", { ascending: false }).limit(1)) as { orden: number }[];
  return (r[0]?.orden ?? 0) + 1;
}

/** La portada anterior va a la papelera (se puede recuperar). */
async function liberarPortada(id: string) {
  revisar(await sb().from("propiedad_medios").update({ eliminado_en: new Date().toISOString() })
    .eq("propiedad_id", id).eq("tipo", "portada").is("eliminado_en", null));
}

/** Sube un archivo con un nombre nuevo y único (nunca pisa archivos existentes). Devuelve un aviso si es pesado. */
export async function subirMedioProp(id: string, tipo: TipoMedioProp, f: File): Promise<string | null> {
  let datos: { formato: "jpeg" | "png" | "webp" | "pdf"; ancho: number | null; alto: number | null; aviso: string | null };
  if (tipo === "documento") { await revisarPdf(f); datos = { formato: "pdf", ancho: null, alto: null, aviso: null }; }
  else datos = await revisarArchivo(f);
  const ext = datos.formato === "jpeg" ? "jpg" : datos.formato;
  const ruta = `propiedades/${id}/${tipo}/${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36)}.${ext}`;
  const mime = datos.formato === "pdf" ? "application/pdf" : f.type;
  const sha256 = await huella(f);
  const up = await sb().storage.from("media").upload(ruta, f, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (up.error) throw new ErrorPanel(`"${f.name}": no se pudo subir. ${mensajeError(up.error)}`);
  if (tipo === "portada") await liberarPortada(id);
  const orden = await siguienteOrden(id, tipo);
  const nombre = tipo === "documento" ? f.name.replace(/\.pdf$/i, "") : f.name;
  revisar(await sb().from("propiedad_medios").insert({ propiedad_id: id, tipo, orden, bucket: "media", ruta, nombre,
    ancho: datos.ancho, alto: datos.alto, bytes: f.size, sha256, formato: datos.formato, mime }));
  return datos.aviso;
}

export async function quitarMedioProp(mid: string): Promise<void> {
  revisar(await sb().from("propiedad_medios").update({ eliminado_en: new Date().toISOString() }).eq("id", mid).select("id").single());
}

export async function restaurarMedioProp(m: FilaMedioProp): Promise<void> {
  if (m.tipo === "portada") await liberarPortada(m.propiedad_id);
  const orden = await siguienteOrden(m.propiedad_id, m.tipo);
  revisar(await sb().from("propiedad_medios").update({ eliminado_en: null, orden }).eq("id", m.id).select("id").single());
}

export async function reordenarMediosProp(id: string, tipo: TipoMedioProp, ids: string[]): Promise<void> {
  revisar(await sb().rpc("reordenar_propiedad_medios", { p_id: id, p_tipo: tipo, p_ids: ids }));
}

/** Usa una foto ya subida como portada (mismo archivo, sin volver a subirlo). */
export async function usarComoPortadaProp(m: FilaMedioProp): Promise<void> {
  await liberarPortada(m.propiedad_id);
  const { ruta, nombre, ancho, alto, bytes, sha256, formato, mime, bucket } = m;
  revisar(await sb().from("propiedad_medios").insert({ propiedad_id: m.propiedad_id, tipo: "portada", orden: 0, bucket,
    ruta, nombre, ancho, alto, bytes, sha256, formato, mime }));
}

/** Nombre visible de un documento ("Ficha comercial", "Reglamento"…). */
export async function renombrarDocumento(mid: string, nombre: string): Promise<void> {
  const n = nombre.trim();
  if (!n) throw new ErrorPanel("El nombre del documento no puede quedar vacío.");
  if (n.length > 120) throw new ErrorPanel("Máximo 120 caracteres.");
  revisar(await sb().from("propiedad_medios").update({ nombre: n }).eq("id", mid).select("id").single());
}

export const ACEPTA_IMAGENES = Object.keys(FORMATOS_PERMITIDOS).join(",");
