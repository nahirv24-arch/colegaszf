/**
 * Locales comerciales / oficinas en formato tabla. Usa las mismas tablas y funciones que el resto de
 * Terceros y Comercios (sin cambios en la base de datos): cada fila es una propiedad de categoría "comercio".
 * Guardar escribe la COPIA DE TRABAJO; los colegas ven los cambios recién al publicar la tabla.
 */
import { obtenerSupabase } from "../servicios/supabase";
import type { CategoriaPropiedad, Operacion } from "../tipos/datos";
import { idPara, type FilaComercio } from "../utilidades/comercios";
import { ErrorPanel, mensajeError } from "./servicio";
import { listarPropiedades, type FilaPropiedad, type ResumenPropiedad } from "./servicioPropiedades";

const sb = () => obtenerSupabase();

function revisar<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new ErrorPanel(mensajeError(r.error));
  return r.data;
}

export interface DatosTabla {
  /** Filas guardadas (sin las de la papelera), en el orden de la tabla. */
  filas: FilaPropiedad[];
  /** Estado de publicación de cada fila, por id. */
  resumen: Record<string, ResumenPropiedad>;
  /** Todos los identificadores usados (también papelera y otras categorías), para no repetirlos. */
  ids: string[];
}

export async function leerTablaComercios(categoria: CategoriaPropiedad): Promise<DatosTabla> {
  const [filas, resumen, ids] = await Promise.all([
    sb().from("propiedades").select("*").eq("categoria", categoria).is("eliminado_en", null)
      .order("posicion").order("creado_en", { ascending: false }).order("id"),
    listarPropiedades(categoria),
    sb().from("propiedades").select("id"),
  ]);
  return {
    filas: revisar(filas) as FilaPropiedad[],
    resumen: Object.fromEntries(resumen.map((r) => [r.id, r])),
    ids: (revisar(ids) as { id: string }[]).map((x) => x.id),
  };
}

/** Problemas de una fila (vacío = bien). */
export function erroresFila(f: FilaComercio): Partial<Record<keyof FilaComercio, string>> {
  const e: Partial<Record<keyof FilaComercio, string>> = {};
  if (!f.direccion.trim()) e.direccion = "La dirección es obligatoria.";
  else if (f.direccion.trim().length > 120) e.direccion = "Máximo 120 caracteres.";
  if (f.barrio.length > 100) e.barrio = "Máximo 100 caracteres.";
  if (f.precio.length > 80) e.precio = "Máximo 80 caracteres.";
  if (f.link.trim() && !/^https?:\/\/[^\s]+$/i.test(f.link.trim())) e.link = "Tiene que empezar con https://";
  for (const k of ["tipo", "m2_cubiertos", "m2_totales", "moneda", "cod_tokko"] as const) {
    if (f[k].length > 60) e[k] = "Máximo 60 caracteres.";
  }
  return e;
}

/** Lo que se guarda en la base para una fila (conserva otros detalles o links que ya tuviera). */
function datosDe(f: FilaComercio, previa?: FilaPropiedad) {
  const limpio = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const direccion = f.direccion.trim();
  return {
    titulo: direccion,
    direccion,
    operacion: f.operacion as Operacion,
    barrio: f.barrio.trim(),
    precio: f.precio.trim(),
    detalles: limpio({ ...(previa?.detalles ?? {}), tipo: f.tipo, m2_cubiertos: f.m2_cubiertos, m2_totales: f.m2_totales,
      moneda: f.moneda, cod_tokko: f.cod_tokko, llave: f.llave }),
    links: limpio({ ...(previa?.links ?? {}), colegas: f.link }),
  };
}

export interface CambiosTabla {
  /** Todas las filas en el orden final. id = null para las nuevas. */
  filas: { id: string | null; fila: FilaComercio; cambio: boolean }[];
  /** Filas guardadas que se quitaron de la tabla (van a la papelera). */
  quitadas: string[];
}

/** Guarda la tabla en la copia de trabajo: crea, actualiza, reordena y manda a la papelera. */
export async function guardarTablaComercios(categoria: CategoriaPropiedad, c: CambiosTabla, previas: FilaPropiedad[], idsUsados: string[]): Promise<void> {
  for (const { fila } of c.filas) {
    if (Object.keys(erroresFila(fila)).length) throw new ErrorPanel("Hay filas con datos para revisar (marcadas en rojo).");
  }
  const porId = new Map(previas.map((p) => [p.id, p]));
  const usados = new Set(idsUsados);
  for (const [i, { id, fila, cambio }] of c.filas.entries()) {
    const posicion = i + 1;
    if (!id) {
      const nuevo = idPara(fila, usados);
      usados.add(nuevo);
      revisar(await sb().from("propiedades").insert({ id: nuevo, categoria, estado: "borrador", visible: true,
        posicion, ...datosDe(fila) }));
      continue;
    }
    const previa = porId.get(id);
    if (cambio) {
      revisar(await sb().from("propiedades").update({ posicion, ...datosDe(fila, previa) }).eq("id", id).select("id").single());
    } else if (previa && previa.posicion !== posicion) {
      revisar(await sb().from("propiedades").update({ posicion }).eq("id", id).select("id").single());
    }
  }
  for (const id of c.quitadas) revisar(await sb().rpc("eliminar_propiedad", { p_id: id }));
}

/** Publica las filas nuevas o con cambios. Devuelve cuántas se publicaron. */
export async function publicarTablaComercios(ids: string[], nota: string): Promise<number> {
  let n = 0;
  for (const id of ids) {
    revisar(await sb().rpc("publicar_propiedad", { p_id: id, p_nota: nota, p_actualizar_fecha: n === 0 }));
    n++;
  }
  return n;
}
