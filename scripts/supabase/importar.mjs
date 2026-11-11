// IMPORTACIÓN de datos/desarrollos.json, datos/medios.json y media/ al proyecto de PRUEBA.
//
// Seguro para repetir:
//   - Un desarrollo que ya existe NO se toca (ni se duplica ni se pisa). Si además es distinto
//     del JSON, se informa como "modificado después de importar".
//   - Un archivo que ya existe en Storage no se vuelve a subir; si existe con otro tamaño,
//     se informa y ese desarrollo no se importa.
//   - Cada desarrollo entra en UNA transacción (todo o nada): si algo falla, se puede reintentar.
//   - No borra nada. No modifica los JSON ni las imágenes originales.
//
// Uso: npm run sb:importar             (importa)
//      npm run sb:importar -- --ver    (solo informe previo, sin cambiar nada)
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cargarEntorno, clienteServidor, igualExacto, limpiar, mismoContenido, MIME, RAIZ, rutaBucket, salir, TIPOS, exigirConfirmacionProduccion } from "./comun.mjs";

const e = cargarEntorno();
if (!process.argv.includes("--ver")) exigirConfirmacionProduccion("importar datos y archivos");
const db = clienteServidor(e);
const soloVer = process.argv.includes("--ver");
const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), "utf8"));
const datos = leer("datos/desarrollos.json");
const inventario = leer("datos/medios.json");
const archivos = new Map(inventario.archivos.map((a) => [a.ruta, a]));
const informe = { fecha: new Date().toISOString(), modo: soloVer ? "solo informe" : "importación", antes: {}, desarrollos: [], archivos: {}, despues: {}, errores: [] };

const err = (donde, x) => { const m = limpiar(x?.message ?? x, e); informe.errores.push({ donde, error: m }); console.error(`  ✗ ${donde}: ${m}`); };

async function contar() {
  const n = async (tabla) => { const { count, error } = await db.from(tabla).select("*", { count: "exact", head: true }); if (error) throw error; return count; };
  return { desarrollos: await n("desarrollos"), unidades: await n("unidades"), medios: await n("medios"), configuracion: await n("configuracion") };
}

function infoMedio(ruta, tipo, orden) {
  const a = archivos.get(ruta);
  if (!a) throw new Error(`La ruta ${ruta} no está en datos/medios.json`);
  return { tipo, orden, ruta: rutaBucket(ruta), nombre: ruta.split("/").pop(), ancho: a.ancho, alto: a.alto,
           bytes: a.bytes, sha256: a.sha256, formato: a.formato, mime: MIME[a.formato] };
}

function mediosDe(d) {
  const lista = [];
  for (const [clave, tipo] of Object.entries(TIPOS)) (d[clave] ?? []).forEach((r, i) => lista.push(infoMedio(r, tipo, i + 1)));
  if (d.portada) lista.push(infoMedio(d.portada, "portada", 0));
  return lista;
}

// Archivos que ya están en el bucket "media": carpeta → (nombre → tamaño)
const enBucket = new Map();
async function existentes(carpeta) {
  if (!enBucket.has(carpeta)) {
    const { data, error } = await db.storage.from("media").list(carpeta, { limit: 1000 });
    if (error) throw error;
    enBucket.set(carpeta, new Map((data ?? []).filter((o) => o.id).map((o) => [o.name, o.metadata?.size ?? null])));
  }
  return enBucket.get(carpeta);
}

/** Sube los archivos que falten. Devuelve false si hay conflicto (mismo nombre, otro tamaño). */
async function subir(lista) {
  let ok = true;
  for (const m of lista) {
    const carpeta = m.ruta.split("/").slice(0, -1).join("/");
    const nombre = m.ruta.split("/").pop();
    const ya = (await existentes(carpeta)).get(nombre);
    if (ya !== undefined) {
      if (ya === m.bytes) { informe.archivos.ya_estaban = (informe.archivos.ya_estaban ?? 0) + 1; continue; }
      err(`archivo ${m.ruta}`, `ya existe en Storage con otro tamaño (${ya} vs ${m.bytes}); no se reemplaza`);
      ok = false; continue;
    }
    if (soloVer) { informe.archivos.por_subir = (informe.archivos.por_subir ?? 0) + 1; continue; }
    const bytes = readFileSync(join(RAIZ, "media", ...m.ruta.split("/")));
    if (createHash("sha256").update(bytes).digest("hex") !== m.sha256) { err(`archivo ${m.ruta}`, "el archivo local no coincide con el inventario"); ok = false; continue; }
    const { error } = await db.storage.from("media").upload(m.ruta, bytes, { contentType: m.mime, upsert: false, cacheControl: "3600" });
    if (error) { err(`subir ${m.ruta}`, error); ok = false; continue; }
    (await existentes(carpeta)).set(nombre, m.bytes);
    informe.archivos.subidos = (informe.archivos.subidos ?? 0) + 1;
  }
  return ok;
}

async function respaldoOriginal() {
  const base = "respaldos/original-2026-11-11";
  const { data } = await db.storage.from("privado").list(base);
  const ya = new Set((data ?? []).map((o) => o.name));
  for (const f of ["desarrollos.json", "medios.json"]) {
    if (ya.has(f)) continue;
    if (soloVer) { informe.respaldo = "pendiente"; continue; }
    const { error } = await db.storage.from("privado").upload(`${base}/${f}`, readFileSync(join(RAIZ, "datos", f)), { contentType: "application/json", upsert: false });
    if (error) err(`respaldo ${f}`, error); else informe.respaldo = `privado/${base}/`;
  }
  if (!informe.respaldo) informe.respaldo = `ya estaba en privado/${base}/`;
}

async function main() {
  console.log(`\n${soloVer ? "INFORME PREVIO (no se cambia nada)" : "IMPORTACIÓN al proyecto de prueba"}\n`);
  informe.origen = { desarrollos: datos.emprendimientos.length, unidades: datos.emprendimientos.reduce((t, d) => t + d.disponibles.length, 0), archivos: inventario.archivos.length };
  try { informe.antes = await contar(); } catch (x) { err("contar antes", x); return terminar(); }
  console.log("Origen (JSON):", informe.origen);
  console.log("Base ANTES:   ", informe.antes);

  await respaldoOriginal();

  // Portada general, logo y fecha
  const generales = [infoMedio(datos.portada, "portada_general", 0), infoMedio(inventario.logo, "logo", 0)];
  if (await subir(generales) && !soloVer) {
    const { data, error } = await db.rpc("importar_general", { p_actualizado: datos.actualizado, p_medios: generales });
    if (error) err("generales", error); else console.log(`  · general: ${data}`);
  }

  // Desarrollo por desarrollo, en el orden original
  const { data: actual, error: errActual } = await db.rpc("_contenido", { p_solo_publico: false });
  if (errActual) { err("leer contenido actual", errActual); return terminar(); }
  const enBase = new Map(actual.sitio.emprendimientos.map((d) => [d.id, d]));

  for (const [i, d] of datos.emprendimientos.entries()) {
    const fila = { id: d.id, unidades: d.disponibles.length };
    if (enBase.has(d.id)) {
      fila.resultado = mismoContenido(enBase.get(d.id), d) ? "ya existía (idéntico)" : "ya existía y fue MODIFICADO después: no se toca";
    } else {
      const medios = mediosDe(d);
      fila.medios = medios.length;
      if (!(await subir(medios))) fila.resultado = "no importado: problema con archivos";
      else if (soloVer) fila.resultado = "se importaría";
      else {
        const { data, error } = await db.rpc("importar_desarrollo", { p_desarrollo: d, p_posicion: i + 1, p_estado: "publicado", p_medios: medios });
        if (error) { err(`desarrollo ${d.id}`, error); fila.resultado = "ERROR (se puede reintentar)"; }
        else fila.resultado = data === "importado" ? "importado" : "ya existía";
      }
    }
    informe.desarrollos.push(fila);
    console.log(`  · ${d.id.padEnd(15)} ${fila.resultado}`);
  }
  await terminar();
}

async function terminar() {
  try { informe.despues = await contar(); } catch (x) { err("contar después", x); }
  console.log("\nBase DESPUÉS: ", informe.despues);
  console.log("Archivos:     ", informe.archivos);
  if (!soloVer && !informe.errores.length) {
    // Verificación total: lo que hay en la base, rearmado, tiene que ser IGUAL al JSON original.
    const { data, error } = await db.rpc("_contenido", { p_solo_publico: false });
    if (error) err("verificación", error);
    else {
      informe.verificacion_identico_al_json = mismoContenido(data.sitio, datos);
      informe.verificacion_texto_exacto = igualExacto(data.sitio, datos);
      informe.verificacion_logo = data.logo === inventario.logo;
      console.log("Verificación: mismo contenido que el JSON original (valores, listas en orden y orden de campos de cada unidad):", informe.verificacion_identico_al_json, "| logo:", informe.verificacion_logo);
      console.log("              (texto JSON letra por letra:", informe.verificacion_texto_exacto, "— solo cambia el orden en que se listan algunas claves)");
    }
  }
  mkdirSync(join(RAIZ, "respaldos"), { recursive: true });
  const archivo = join(RAIZ, "respaldos", `importacion-${informe.fecha.replace(/[:.]/g, "-")}.json`);
  writeFileSync(archivo, JSON.stringify(informe, null, 2));
  console.log(`\nInforme guardado en respaldos/${archivo.split(/[\\/]/).pop()}`);
  console.log(informe.errores.length ? `\nTERMINÓ CON ${informe.errores.length} ERROR(ES). Se puede volver a ejecutar sin riesgo.` : "\nTERMINÓ SIN ERRORES.");
  process.exit(informe.errores.length ? 1 : 0);
}

main().catch((x) => { err("general", x); terminar(); });
