/**
 * Operaciones del panel contra Supabase. TODA lectura o escritura pasa por aquí.
 * Los permisos NO se deciden en este archivo: los decide la base de datos (RLS + funciones
 * que verifican es_admin()). Si alguien sin rol intentara usar estas funciones, Supabase lo rechaza.
 */
import type { Columna, Desarrollo, InfoMedio, Sitio } from "../tipos/datos";
import { obtenerSupabase, urlPublicaMedia } from "../servicios/supabase";

const sb = () => obtenerSupabase();

// ---------------------------------------------------------------- errores
export class ErrorPanel extends Error {}

/** Traduce errores técnicos a mensajes claros (sin mostrar datos internos). */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(m)) {
    return "No hay conexión con Supabase. Revisá internet y probá de nuevo; no se perdió nada de lo guardado.";
  }
  if (/jwt|token.*expired|refresh token/i.test(m)) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (/sin permiso|permission denied|row-level security|42501/i.test(m)) return "Tu cuenta no tiene permiso para hacer esto.";
  if (/duplicate key|already exists|23505/i.test(m)) return "Ya existe un registro con ese identificador o en esa posición. Recargá la página.";
  if (/payload too large|exceeded the maximum allowed size|413/i.test(m)) return "El archivo es demasiado grande.";
  if (/mime type|invalid_mime/i.test(m)) return "Ese tipo de archivo no está permitido.";
  return m || "Ocurrió un error inesperado.";
}

function revisar<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErrorPanel(mensajeError(r.error));
  return r.data;
}

// ---------------------------------------------------------------- tipos
export type EstadoPublicacion = "borrador" | "publicado";

export interface ResumenDesarrollo {
  id: string; nombre: string; direccion: string; posicion: number;
  estado: EstadoPublicacion; visible: boolean; eliminado_en: string | null; modificado_en: string;
  unidades: number; medios: number; tiene_portada: boolean;
  version_vigente: number | null; publicado_en: string | null; cambios_sin_publicar: boolean;
}

export interface FilaDesarrollo {
  id: string; posicion: number; nombre: string; direccion: string; desarrollista: string;
  posesion: string; gastos: string; nota_tabla: string;
  links: Record<string, string>; columnas: Columna[]; disponibles_ejemplo: boolean;
  info_extra: Record<string, string>; estado: EstadoPublicacion; visible: boolean;
  creado_en: string; modificado_en: string; eliminado_en: string | null;
}

export interface FilaUnidad {
  id: string; desarrollo_id: string; posicion: number;
  campos: Record<string, string>; orden_campos: string[];
  grupo: string | null; piso: string | null; unidad: string | null; tipologia: string | null;
  estado: string | null; precio: string | null; eliminado_en: string | null; modificado_en: string;
}

export type TipoMedio = "portada" | "foto" | "render" | "plano" | "pagina_brochure" | "portada_general" | "logo";

export interface FilaMedio {
  id: string; desarrollo_id: string | null; tipo: TipoMedio; orden: number; bucket: "media" | "privado";
  ruta: string; nombre: string; ancho: number | null; alto: number | null; bytes: number | null;
  sha256: string | null; formato: "jpeg" | "png" | "webp" | null; mime: string | null;
  eliminado_en: string | null; creado_en: string;
}

export interface Version {
  id: number; version: number; vigente: boolean; publicado_en: string; nota: string;
  publicado_por_email: string | null; unidades: number; archivos: number;
}

export interface CambioHistorial {
  id: number; fecha: string; tabla: string; registro: string; accion: string; rol: string | null;
  usuario: string | null; usuario_email: string | null; desarrollo_id: string | null;
  antes: Record<string, unknown> | null; despues: Record<string, unknown> | null;
}

export interface Estadisticas {
  desarrollos: number; publicados: number; borradores: number; ocultos: number; en_papelera: number;
  con_cambios_sin_publicar: number; con_material_incompleto: number;
  detalle_incompletos: { id: string; nombre: string; falta: string[] }[];
  unidades: number; unidades_por_estado: Record<string, number>;
  unidades_disponibles: number; unidades_reservadas: number; unidades_vendidas: number; existe_estado_vendida: boolean;
  fotos: number; renders: number; planos: number; paginas_brochure: number; portadas: number;
  ultimas_modificaciones: { fecha: string; tabla: string; registro: string; accion: string; usuario: string | null;
    rol: string | null; usuario_email: string | null; desarrollo_id: string | null }[];
}

// ---------------------------------------------------------------- lecturas generales
export async function leerEstadisticas(): Promise<Estadisticas> {
  return revisar(await sb().rpc("estadisticas_panel")) as Estadisticas;
}

export async function listarDesarrollos(): Promise<ResumenDesarrollo[]> {
  return (revisar(await sb().rpc("resumen_desarrollos")) ?? []) as ResumenDesarrollo[];
}

export async function leerDesarrollo(id: string): Promise<FilaDesarrollo | null> {
  const r = await sb().from("desarrollos").select("*").eq("id", id).maybeSingle();
  return revisar(r) as FilaDesarrollo | null;
}

export async function historial(desarrolloId: string | null, limite = 60): Promise<CambioHistorial[]> {
  return (revisar(await sb().rpc("historial_reciente", { p_desarrollo: desarrolloId, p_limite: limite })) ?? []) as CambioHistorial[];
}

export async function versiones(id: string): Promise<Version[]> {
  return (revisar(await sb().rpc("versiones_desarrollo", { p_id: id })) ?? []) as Version[];
}

/** Contenido de TRABAJO (borradores incluidos) con la forma de desarrollos.json, para la vista previa. */
export async function contenidoBorrador(): Promise<{ sitio: Sitio; logo: string; medios: InfoMedio[] }> {
  return revisar(await sb().rpc("contenido_completo")) as { sitio: Sitio; logo: string; medios: InfoMedio[] };
}

// ---------------------------------------------------------------- desarrollos
/** "Patagonia 16" → "patagonia-16" (mismo criterio que el antiguo modo de edición). */
export function idDesdeNombre(nombre: string): string {
  return nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type DatosEditables = Pick<FilaDesarrollo, "nombre" | "direccion" | "desarrollista" | "posesion" | "gastos"
  | "nota_tabla" | "links" | "disponibles_ejemplo" | "info_extra">;

export async function crearDesarrollo(id: string, datos: DatosEditables): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new ErrorPanel("El identificador solo puede tener letras minúsculas, números y guiones.");
  const existe = await sb().from("desarrollos").select("id").eq("id", id).maybeSingle();
  if (revisar(existe)) throw new ErrorPanel(`Ya existe un desarrollo con el identificador "${id}" (puede estar en la papelera).`);
  const max = revisar(await sb().from("desarrollos").select("posicion").order("posicion", { ascending: false }).limit(1)) as { posicion: number }[];
  revisar(await sb().from("desarrollos").insert({ id, posicion: (max[0]?.posicion ?? 0) + 1, estado: "borrador", visible: true, columnas: [], ...datos }));
}

/** Guarda en la COPIA DE TRABAJO. No cambia la página pública hasta publicar. El id nunca se modifica. */
export async function guardarDesarrollo(id: string, cambios: Partial<DatosEditables> & { columnas?: Columna[] }): Promise<void> {
  revisar(await sb().from("desarrollos").update(cambios).eq("id", id).select("id").single());
}

export async function publicar(id: string, nota: string, actualizarFecha: boolean): Promise<number> {
  return revisar(await sb().rpc("publicar_desarrollo", { p_id: id, p_nota: nota, p_actualizar_fecha: actualizarFecha })) as number;
}

/** Ocultar / mostrar en la página pública (efecto inmediato, no borra nada). */
export async function cambiarVisible(id: string, visible: boolean): Promise<void> {
  revisar(await sb().from("desarrollos").update({ visible }).eq("id", id).select("id").single());
}

export async function mandarAPapelera(id: string): Promise<void> {
  revisar(await sb().rpc("eliminar_desarrollo", { p_id: id }));
}
export async function sacarDePapelera(id: string): Promise<void> {
  revisar(await sb().rpc("restaurar_desarrollo", { p_id: id }));
}

/** Vuelve a cargar en el borrador el contenido de una versión publicada (no publica). */
export async function recuperarVersion(publicacionId: number): Promise<void> {
  revisar(await sb().rpc("restaurar_version", { p_publicacion: publicacionId }));
}

// ---------------------------------------------------------------- unidades
export async function listarUnidades(desarrolloId: string): Promise<FilaUnidad[]> {
  return revisar(await sb().from("unidades").select("*").eq("desarrollo_id", desarrolloId).order("posicion")) as FilaUnidad[];
}

/** Agrega claves nuevas al final del orden original, sin perder las existentes. */
function ordenCon(orden: readonly string[], campos: Record<string, string>): string[] {
  const nuevo = [...orden];
  for (const k of Object.keys(campos)) if (!nuevo.includes(k)) nuevo.push(k);
  return nuevo;
}

export async function guardarUnidad(u: FilaUnidad, campos: Record<string, string>): Promise<void> {
  revisar(await sb().from("unidades").update({ campos, orden_campos: ordenCon(u.orden_campos, campos) }).eq("id", u.id).select("id").single());
}

export async function crearUnidad(desarrolloId: string, campos: Record<string, string>, orden: string[]): Promise<void> {
  const activas = revisar(await sb().from("unidades").select("posicion").eq("desarrollo_id", desarrolloId)
    .is("eliminado_en", null).order("posicion", { ascending: false }).limit(1)) as { posicion: number }[];
  revisar(await sb().from("unidades").insert({ desarrollo_id: desarrolloId, posicion: (activas[0]?.posicion ?? 0) + 1,
    campos, orden_campos: ordenCon(orden, campos) }));
}

/** Quitar = mandar a la papelera (reversible). */
export async function quitarUnidad(id: string): Promise<void> {
  revisar(await sb().from("unidades").update({ eliminado_en: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function restaurarUnidad(u: FilaUnidad): Promise<void> {
  const activas = revisar(await sb().from("unidades").select("posicion").eq("desarrollo_id", u.desarrollo_id)
    .is("eliminado_en", null).order("posicion", { ascending: false }).limit(1)) as { posicion: number }[];
  revisar(await sb().from("unidades").update({ eliminado_en: null, posicion: (activas[0]?.posicion ?? 0) + 1 }).eq("id", u.id).select("id").single());
}

export async function reordenarUnidades(desarrolloId: string, ids: string[]): Promise<void> {
  revisar(await sb().rpc("reordenar_unidades", { p_id: desarrolloId, p_ids: ids }));
}

// ---------------------------------------------------------------- multimedia
export const CARPETA: Record<TipoMedio, string> = {
  portada: "portada", foto: "fotos", render: "renders", plano: "planos", pagina_brochure: "brochure",
  portada_general: "general", logo: "general",
};
export const FORMATOS_PERMITIDOS: Record<string, "jpeg" | "png" | "webp"> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
export const LIMITE_BYTES = 20 * 1024 * 1024;
export const AVISO_BYTES = 5 * 1024 * 1024;

export const urlMedio = (m: Pick<FilaMedio, "ruta" | "bucket">) => urlPublicaMedia(`media/${m.ruta}`);

export async function listarMedios(desarrolloId: string | null): Promise<FilaMedio[]> {
  const q = sb().from("medios").select("*").order("tipo").order("orden");
  return revisar(await (desarrolloId === null ? q.is("desarrollo_id", null) : q.eq("desarrollo_id", desarrolloId))) as FilaMedio[];
}

/** Revisa un archivo ANTES de subirlo: tipo, tamaño y que se pueda abrir como imagen. */
export async function revisarArchivo(f: File): Promise<{ formato: "jpeg" | "png" | "webp"; ancho: number; alto: number; aviso: string | null }> {
  const formato = FORMATOS_PERMITIDOS[f.type];
  if (!formato) throw new ErrorPanel(`"${f.name}": formato no permitido (${f.type || "desconocido"}). Usá JPG, PNG o WEBP.`);
  if (f.size > LIMITE_BYTES) throw new ErrorPanel(`"${f.name}": pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es 20 MB.`);
  if (f.size === 0) throw new ErrorPanel(`"${f.name}": el archivo está vacío.`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(f); } catch { throw new ErrorPanel(`"${f.name}": no se pudo abrir como imagen (¿archivo dañado?).`); }
  const r = { formato, ancho: bmp.width, alto: bmp.height, aviso: f.size > AVISO_BYTES ? `"${f.name}" pesa ${(f.size / 1048576).toFixed(1)} MB: se verá bien, pero tarda más en cargar en celulares.` : null };
  bmp.close();
  return r;
}

async function huella(f: File): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sube el archivo con un nombre nuevo y único (nunca pisa archivos existentes). */
async function subirArchivo(desarrolloId: string | null, tipo: TipoMedio, f: File) {
  const info = await revisarArchivo(f);
  const ext = info.formato === "jpeg" ? "jpg" : info.formato;
  const nombre = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36)}.${ext}`;
  const ruta = desarrolloId === null ? `general/${tipo}-${nombre}` : tipo === "portada" ? `${desarrolloId}/portada-${nombre}` : `${desarrolloId}/${CARPETA[tipo]}/${nombre}`;
  const sha = await huella(f);
  const r = await sb().storage.from("media").upload(ruta, f, { contentType: f.type, upsert: false, cacheControl: "31536000" });
  if (r.error) throw new ErrorPanel(`"${f.name}": no se pudo subir. ${mensajeError(r.error)}`);
  return { ruta, nombre: f.name, ancho: info.ancho, alto: info.alto, bytes: f.size, sha256: sha, formato: info.formato, mime: f.type, aviso: info.aviso };
}

async function siguienteOrden(desarrolloId: string | null, tipo: TipoMedio): Promise<number> {
  if (tipo === "portada" || tipo === "portada_general" || tipo === "logo") return 0;
  const q = sb().from("medios").select("orden").eq("tipo", tipo).is("eliminado_en", null).order("orden", { ascending: false }).limit(1);
  const r = revisar(await (desarrolloId === null ? q.is("desarrollo_id", null) : q.eq("desarrollo_id", desarrolloId))) as { orden: number }[];
  return (r[0]?.orden ?? 0) + 1;
}

/** Portada / portada general: la anterior va a la papelera (se puede recuperar). */
async function liberarUnico(desarrolloId: string | null, tipo: TipoMedio) {
  if (tipo !== "portada" && tipo !== "portada_general" && tipo !== "logo") return;
  const q = sb().from("medios").update({ eliminado_en: new Date().toISOString() }).eq("tipo", tipo).is("eliminado_en", null);
  revisar(await (desarrolloId === null ? q.is("desarrollo_id", null) : q.eq("desarrollo_id", desarrolloId)));
}

export async function subirMedio(desarrolloId: string | null, tipo: TipoMedio, f: File): Promise<string | null> {
  const a = await subirArchivo(desarrolloId, tipo, f);
  await liberarUnico(desarrolloId, tipo);
  const orden = await siguienteOrden(desarrolloId, tipo);
  const { aviso, ...fila } = a;
  revisar(await sb().from("medios").insert({ desarrollo_id: desarrolloId, tipo, orden, bucket: "media", ...fila }));
  return aviso;
}

/** Reemplazar: sube un archivo NUEVO; en una sola operación el anterior va a la papelera y el
 *  nuevo ocupa su lugar. El anterior sigue en Storage (lo usan las versiones ya publicadas). */
export async function reemplazarMedio(m: FilaMedio, f: File): Promise<string | null> {
  const a = await subirArchivo(m.desarrollo_id, m.tipo, f);
  revisar(await sb().rpc("reemplazar_medio", { p_id: m.id, p_ruta: a.ruta, p_nombre: a.nombre, p_ancho: a.ancho, p_alto: a.alto,
    p_bytes: a.bytes, p_sha256: a.sha256, p_formato: a.formato, p_mime: a.mime }));
  return a.aviso;
}

export async function quitarMedio(id: string): Promise<void> {
  revisar(await sb().from("medios").update({ eliminado_en: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function restaurarMedio(m: FilaMedio): Promise<void> {
  await liberarUnico(m.desarrollo_id, m.tipo);
  const orden = await siguienteOrden(m.desarrollo_id, m.tipo);
  revisar(await sb().from("medios").update({ eliminado_en: null, orden }).eq("id", m.id).select("id").single());
}

export async function reordenarMedios(desarrolloId: string, tipo: TipoMedio, ids: string[]): Promise<void> {
  revisar(await sb().rpc("reordenar_medios", { p_id: desarrolloId, p_tipo: tipo, p_ids: ids }));
}

/** Usa una foto o render ya subido como portada (mismo archivo, sin volver a subirlo). */
export async function usarComoPortada(m: FilaMedio): Promise<void> {
  if (!m.desarrollo_id) return;
  await liberarUnico(m.desarrollo_id, "portada");
  const { ruta, nombre, ancho, alto, bytes, sha256, formato, mime, bucket } = m;
  revisar(await sb().from("medios").insert({ desarrollo_id: m.desarrollo_id, tipo: "portada", orden: 0, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime }));
}

// ---------------------------------------------------------------- configuración y respaldo
export async function leerActualizado(): Promise<string> {
  const r = revisar(await sb().from("configuracion").select("valor").eq("clave", "actualizado").maybeSingle()) as { valor: unknown } | null;
  return typeof r?.valor === "string" ? r.valor : "";
}

export async function guardarActualizado(fecha: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorPanel("La fecha no es válida.");
  revisar(await sb().from("configuracion").update({ valor: fecha }).eq("clave", "actualizado").select("clave").single());
}

export async function descargarRespaldo(): Promise<void> {
  const datos = revisar(await sb().rpc("exportar_todo"));
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo-zf-colegas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export type { Desarrollo };
