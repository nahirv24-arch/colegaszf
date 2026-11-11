import { useState } from "react";
import { historial, mensajeError, recuperarVersion, versiones, type CambioHistorial } from "../servicio";
import { Cargando, ErrorCaja, fechaHora, useAvisos, useCarga, useConfirmar } from "../ui";
import { quien } from "./Dashboard";

const ACCION: Record<string, string> = { crear: "Creación", editar: "Edición", eliminar: "Enviado a la papelera", restaurar: "Recuperado", borrar_definitivo: "Borrado definitivo" };
const TABLA: Record<string, string> = { desarrollos: "Datos del desarrollo", unidades: "Unidad", medios: "Archivo", publicaciones: "Publicación" };
/** Sellos internos que no aportan al leer el historial. En unidades, además, las columnas calculadas
 *  (grupo, piso, precio…) ya se muestran dentro de "campos". */
const SELLOS = new Set(["modificado_en", "modificado_por", "creado_en", "creado_por", "eliminado_por", "id", "orden_campos", "desarrollo_id", "bucket", "sha256", "metadatos"]);
const CALCULADAS_UNIDAD = new Set(["grupo", "piso", "unidad", "tipologia", "estado", "precio"]);
const NOMBRES: Record<string, string> = {
  nombre: "Nombre", direccion: "Dirección", desarrollista: "Desarrollista", posesion: "Posesión", gastos: "Gastos",
  nota_tabla: "Nota de la tabla", links: "Enlaces", columnas: "Columnas", visible: "Visible en la página", estado: "Estado",
  eliminado_en: "En la papelera desde", info_extra: "Información adicional", disponibles_ejemplo: "Aviso «datos de ejemplo»",
  posicion: "Posición", orden: "Posición", tipo: "Tipo", ruta: "Archivo", nombre_archivo: "Nombre del archivo", ancho: "Ancho",
  alto: "Alto", bytes: "Tamaño", formato: "Formato", mime: "Tipo de archivo", version: "Versión", vigente: "Es la vigente",
  nota: "Nota", publicado_en: "Publicado el", publicado_por: "Publicado por",
};
/** Los reordenamientos pasan por una posición transitoria (+1.000.000): ese paso no se muestra. */
const transitorio = (h: CambioHistorial) => {
  const d = h.despues ?? {};
  return h.accion === "editar" && ((typeof d.posicion === "number" && d.posicion >= 1000000) || (typeof d.orden === "number" && d.orden >= 1000000));
};

/** Diferencias legibles entre "antes" y "después" (sin sellos internos ni credenciales: las tablas no tienen). */
function diferencias(h: CambioHistorial): { campo: string; antes: string; despues: string }[] {
  const a = h.antes ?? {}, d = h.despues ?? {};
  const out: { campo: string; antes: string; despues: string }[] = [];
  const txt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (SELLOS.has(k) || (h.tabla === "unidades" && CALCULADAS_UNIDAD.has(k))) continue;
    if (k === "campos" && typeof a[k] === "object" && typeof d[k] === "object") {
      const ca = (a[k] ?? {}) as Record<string, unknown>, cd = (d[k] ?? {}) as Record<string, unknown>;
      for (const c of new Set([...Object.keys(ca), ...Object.keys(cd)])) if (txt(ca[c]) !== txt(cd[c])) out.push({ campo: c, antes: txt(ca[c]), despues: txt(cd[c]) });
      continue;
    }
    if (k === "contenido") continue;
    // Posición transitoria de un reordenamiento (+1.000.000) → posición real anterior.
    const real = (v: unknown) => ((k === "posicion" || k === "orden") && typeof v === "number" && v >= 1000000 ? v - 1000000 : v);
    if (txt(a[k]) !== txt(d[k])) out.push({ campo: NOMBRES[k] ?? k, antes: h.antes ? txt(real(a[k])) : "", despues: h.despues ? txt(real(d[k])) : "" });
  }
  return out.slice(0, 30);
}

export function Versiones({ desarrolloId, onCambio }: { readonly desarrolloId: string; readonly onCambio: () => void }) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const v = useCarga(() => versiones(desarrolloId), [desarrolloId]);
  const h = useCarga(() => historial(desarrolloId, 80), [desarrolloId]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  return (
    <div className="adm-seccion">
      <section className="adm-panel" aria-labelledby="t-ver">
        <h2 id="t-ver" className="adm-subtitulo">Versiones publicadas</h2>
        <p className="adm-ayuda">Cada vez que publicás se guarda una versión. «Recuperar» copia esa versión al <b>borrador</b>
          (no cambia la página pública): después la revisás y la publicás. Lo que había en el borrador queda en el historial.</p>
        {v.cargando && !v.datos ? <Cargando /> : v.error ? <ErrorCaja texto={v.error} reintentar={v.recargar} /> : !(v.datos ?? []).length
          ? <p className="adm-nota">Este desarrollo todavía no se publicó.</p> : (
          <ul className="adm-lista">
            {(v.datos ?? []).map((x) => (
              <li key={x.id}>
                <span><b>Versión {x.version}</b> {x.vigente ? <span className="adm-chip verde">La que ve la página</span> : null}
                  <span className="adm-lista-sec">{fechaHora(x.publicado_en)} · {x.publicado_por_email ?? "Sistema (importación)"} · {x.unidades} unidades · {x.archivos} archivos{x.nota ? ` · «${x.nota}»` : ""}</span></span>
                <button type="button" className="adm-btn chico" disabled={trabajando} onClick={async () => {
                  const ok = await confirmar({ titulo: `Recuperar la versión ${x.version}`, confirmar: "Recuperar en el borrador",
                    mensaje: <>El borrador vuelve a quedar como la versión {x.version}. <b>La página pública no cambia</b> hasta que publiques.
                      Lo que hay ahora en el borrador queda registrado en el historial.</> });
                  if (!ok) return;
                  setTrabajando(true);
                  try { await recuperarVersion(x.id); avisar("ok", `Versión ${x.version} cargada en el borrador. Revisala y publicá cuando quieras.`); onCambio(); h.recargar(); }
                  catch (e) { avisar("error", mensajeError(e)); }
                  finally { setTrabajando(false); }
                }}>{x.vigente ? "Descartar cambios sin publicar" : "Recuperar"}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="adm-panel" aria-labelledby="t-his">
        <h2 id="t-his" className="adm-subtitulo">Historial de cambios</h2>
        {h.cargando && !h.datos ? <Cargando /> : h.error ? <ErrorCaja texto={h.error} reintentar={h.recargar} /> : !(h.datos ?? []).length
          ? <p className="adm-nota">Sin cambios registrados.</p> : (
          <ul className="adm-lista adm-historial">
            {(h.datos ?? []).filter((x) => !transitorio(x)).map((x) => {
              const dif = diferencias(x);
              return (
                <li key={x.id}>
                  <button type="button" className="adm-historial-cab" aria-expanded={abierto === x.id} onClick={() => setAbierto(abierto === x.id ? null : x.id)}>
                    <span><b>{x.accion === "editar" && dif.length === 1 && dif[0]?.campo === "Posición" ? "Cambio de orden" : ACCION[x.accion] ?? x.accion}</b> · {TABLA[x.tabla] ?? x.tabla}</span>
                    <span className="adm-lista-sec">{fechaHora(x.fecha)} · {quien(x.usuario_email, x.rol)} {dif.length ? `· ${dif.length} cambio${dif.length > 1 ? "s" : ""}` : ""}</span>
                  </button>
                  {abierto === x.id && dif.length ? (
                    <table className="adm-tabla adm-dif"><thead><tr><th>Dato</th><th>Antes</th><th>Después</th></tr></thead>
                      <tbody>{dif.map((d) => <tr key={d.campo}><td>{d.campo}</td><td>{d.antes}</td><td>{d.despues}</td></tr>)}</tbody></table>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
