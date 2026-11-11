import { useState } from "react";
import { historial, mensajeError, recuperarVersion, versiones } from "../servicio";
import { Cargando, ErrorCaja, fechaHora, useAvisos, useCarga, useConfirmar } from "../ui";
import { ACCION, diferencias, esTransitorio as transitorio, quien, TABLA } from "../historial";

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
