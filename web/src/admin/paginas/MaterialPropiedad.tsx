import { useState } from "react";
import { mensajeError } from "../servicio";
import {
  ACEPTA_IMAGENES, listarMediosProp, quitarMedioProp, renombrarDocumento, reordenarMediosProp, restaurarMedioProp,
  subirMedioProp, urlMedioProp, usarComoPortadaProp, type FilaMedioProp, type TipoMedioProp,
} from "../servicioPropiedades";
import { Cargando, ErrorCaja, Modal, pesoLegible, useAvisos, useCarga, useConfirmar } from "../ui";

type Progreso = { nombre: string; estado: "esperando" | "subiendo" | "ok" | "error"; mensaje?: string };

const SECCIONES: { tipo: Exclude<TipoMedioProp, "portada" | "documento">; titulo: string; ayuda: string }[] = [
  { tipo: "foto", titulo: "Fotografías", ayuda: "Interior, exterior y entorno. Se muestran en «Fotos»." },
  { tipo: "plano", titulo: "Planos", ayuda: "Planos y medidas." },
];

/** Portada, fotos, planos y documentos PDF de una propiedad. Todo queda en el borrador hasta publicar. */
export function MaterialPropiedad({ propiedadId, onCambio }: { readonly propiedadId: string; readonly onCambio: () => void }) {
  const carga = useCarga(() => listarMediosProp(propiedadId), [propiedadId]);
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [viendo, setViendo] = useState<FilaMedioProp | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const listo = () => { carga.recargar(); onCambio(); };
  const hacer = async (f: () => Promise<void>, ok: string) => {
    setTrabajando(true);
    try { await f(); avisar("ok", ok); }
    catch (e) { avisar("error", mensajeError(e)); }
    finally { setTrabajando(false); listo(); }
  };
  const quitar = async (m: FilaMedioProp) => {
    if (await confirmar({ titulo: "Quitar archivo", confirmar: "Quitar", peligro: true,
      mensaje: <>El archivo sale de esta sección. <b>No se borra</b>: lo podés recuperar desde «Ver quitados».</> })) {
      await hacer(() => quitarMedioProp(m.id), "Archivo quitado (se puede recuperar).");
    }
  };

  if (carga.cargando && !carga.datos) return <Cargando texto="Cargando el material…" />;
  if (carga.error) return <ErrorCaja texto={carga.error} reintentar={carga.recargar} />;
  const todos = carga.datos ?? [];
  const activos = (t: TipoMedioProp) => todos.filter((m) => m.tipo === t && !m.eliminado_en).sort((a, b) => a.orden - b.orden);
  const quitados = (t: TipoMedioProp) => todos.filter((m) => m.tipo === t && m.eliminado_en);
  const portada = activos("portada")[0];
  const fotos = activos("foto");
  const mover = (tipo: TipoMedioProp, lista: FilaMedioProp[], de: number, a: number) => {
    if (a < 0 || a >= lista.length) return;
    const ids = lista.map((m) => m.id);
    const [x] = ids.splice(de, 1);
    ids.splice(a, 0, x!);
    void hacer(() => reordenarMediosProp(propiedadId, tipo, ids), "Orden guardado.");
  };

  return (
    <div className="adm-seccion">
      <p className="adm-intro">Todo lo que subas o cambies acá queda en el <b>borrador</b>: los colegas lo ven al publicar.
        Imágenes: JPG, PNG o WEBP · Documentos: PDF · Hasta 20 MB cada archivo.</p>

      <section className="adm-panel adm-medios-sec" aria-labelledby="sec-portada">
        <div className="adm-medios-cab"><h2 id="sec-portada" className="adm-subtitulo">Portada</h2>
          <span className="adm-ayuda">La foto de la tarjeta del listado y de la cabecera de la ficha.</span></div>
        <div className="adm-portada-fila">
          <div className="adm-portada-muestra">{portada ? <img src={urlMedioProp(portada)} alt="Portada actual" /> : <span>Sin portada</span>}</div>
          <div className="adm-portada-acc">
            <Subir tipo="portada" propiedadId={propiedadId} multiple={false} texto={portada ? "Subir otra portada" : "Subir portada"} onListo={listo} />
            {fotos.length ? <p className="adm-nota">O usá una de las fotos: botón «Portada» debajo de cada foto.</p> : null}
            {portada ? <Info m={portada} /> : null}
            <Quitados lista={quitados("portada")} trabajando={trabajando} onRecuperar={(m) => void hacer(() => restaurarMedioProp(m), "Portada anterior recuperada.")} />
          </div>
        </div>
      </section>

      {SECCIONES.map((s) => {
        const lista = activos(s.tipo);
        return (
          <section key={s.tipo} className="adm-panel adm-medios-sec" aria-labelledby={`sec-${s.tipo}`}>
            <div className="adm-medios-cab"><h2 id={`sec-${s.tipo}`} className="adm-subtitulo">{s.titulo} <span className="adm-cuenta-n">{lista.length}</span></h2>
              <span className="adm-ayuda">{s.ayuda}</span></div>
            <Subir tipo={s.tipo} propiedadId={propiedadId} multiple texto="Subir imágenes" onListo={listo} />
            {lista.length ? (
              <ol className="adm-miniaturas" aria-label={`${s.titulo}, en orden`}>
                {lista.map((m, i) => (
                  <li key={m.id} className="adm-mini">
                    <button type="button" className="adm-mini-img" onClick={() => setViendo(m)} aria-label={`Ver ${s.titulo.toLowerCase()} ${i + 1}`}>
                      <img src={urlMedioProp(m)} alt="" loading="lazy" width={m.ancho ?? undefined} height={m.alto ?? undefined} />
                      <span className="adm-mini-n">{i + 1}</span>
                    </button>
                    <Info m={m} />
                    <div className="adm-mini-acc">
                      <button type="button" aria-label="Mover antes" disabled={trabajando || i === 0} onClick={() => mover(s.tipo, lista, i, i - 1)}>←</button>
                      <button type="button" aria-label="Mover después" disabled={trabajando || i === lista.length - 1} onClick={() => mover(s.tipo, lista, i, i + 1)}>→</button>
                      {s.tipo === "foto" ? <button type="button" disabled={trabajando} onClick={() => void hacer(() => usarComoPortadaProp(m), "Portada cambiada.")}>Portada</button> : null}
                      <button type="button" className="texto-peligro" disabled={trabajando} onClick={() => void quitar(m)}>Quitar</button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="adm-nota">Todavía no hay archivos (en la página aparece como «Pendiente»).</p>}
            <Quitados lista={quitados(s.tipo)} trabajando={trabajando} onRecuperar={(m) => void hacer(() => restaurarMedioProp(m), "Archivo recuperado (quedó al final).")} />
          </section>
        );
      })}

      <Documentos propiedadId={propiedadId} lista={activos("documento")} quitados={quitados("documento")} trabajando={trabajando}
        onListo={listo} onQuitar={(m) => void quitar(m)}
        onMover={(i, a) => mover("documento", activos("documento"), i, a)}
        onRenombrar={(m, n) => void hacer(() => renombrarDocumento(m.id, n), "Nombre guardado.")}
        onRecuperar={(m) => void hacer(() => restaurarMedioProp(m), "Documento recuperado (quedó al final).")} />

      <Modal titulo={viendo?.nombre || "Vista de la imagen"} abierta={!!viendo} onCerrar={() => setViendo(null)} ancho={1100}>
        {viendo ? <><img className="adm-vista-grande" src={urlMedioProp(viendo)} alt="" /><Info m={viendo} /></> : null}
      </Modal>
    </div>
  );
}

function Documentos({ propiedadId, lista, quitados, trabajando, onListo, onQuitar, onMover, onRenombrar, onRecuperar }: {
  readonly propiedadId: string; readonly lista: FilaMedioProp[]; readonly quitados: FilaMedioProp[]; readonly trabajando: boolean;
  readonly onListo: () => void; readonly onQuitar: (m: FilaMedioProp) => void; readonly onMover: (de: number, a: number) => void;
  readonly onRenombrar: (m: FilaMedioProp, nombre: string) => void; readonly onRecuperar: (m: FilaMedioProp) => void;
}) {
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  return (
    <section className="adm-panel adm-medios-sec" aria-labelledby="sec-documento">
      <div className="adm-medios-cab"><h2 id="sec-documento" className="adm-subtitulo">Documentación comercial <span className="adm-cuenta-n">{lista.length}</span></h2>
        <span className="adm-ayuda">Fichas, planillas, reglamentos… en PDF. Los colegas los abren o descargan desde «Documentos».</span></div>
      <Subir tipo="documento" propiedadId={propiedadId} multiple texto="Subir PDF" onListo={onListo} />
      {lista.length ? (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead><tr><th className="num">#</th><th>Nombre visible</th><th>Peso</th><th><span className="adm-sr">Acciones</span></th></tr></thead>
            <tbody>
              {lista.map((m, i) => (
                <tr key={m.id}>
                  <td className="num">{i + 1}</td>
                  <td>{editando?.id === m.id ? (
                    <form className="adm-fila-agregar" onSubmit={(e) => { e.preventDefault(); onRenombrar(m, editando.nombre); setEditando(null); }}>
                      <input type="text" aria-label="Nombre visible del documento" value={editando.nombre} maxLength={120} autoFocus
                             onChange={(e) => setEditando({ id: m.id, nombre: e.target.value })} />
                      <button type="submit" className="adm-btn chico primario" disabled={!editando.nombre.trim() || trabajando}>Guardar</button>
                      <button type="button" className="adm-btn chico" onClick={() => setEditando(null)}>Cancelar</button>
                    </form>
                  ) : <a href={urlMedioProp(m)} target="_blank" rel="noopener" className="adm-fuerte">{m.nombre || "Documento"}</a>}</td>
                  <td>{pesoLegible(m.bytes)}</td>
                  <td className="der adm-nowrap">
                    <button type="button" className="adm-btn chico" aria-label="Mover antes" disabled={trabajando || i === 0} onClick={() => onMover(i, i - 1)}>↑</button>{" "}
                    <button type="button" className="adm-btn chico" aria-label="Mover después" disabled={trabajando || i === lista.length - 1} onClick={() => onMover(i, i + 1)}>↓</button>{" "}
                    <button type="button" className="adm-btn chico" disabled={trabajando} onClick={() => setEditando({ id: m.id, nombre: m.nombre })}>Renombrar</button>{" "}
                    <button type="button" className="adm-btn chico texto-peligro" disabled={trabajando} onClick={() => onQuitar(m)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="adm-nota">Todavía no hay documentos (en la página aparece como «Pendiente»).</p>}
      {quitados.length ? (
        <details className="adm-papelera"><summary className="adm-btn chico">Ver quitados ({quitados.length})</summary>
          <ul className="adm-lista">{quitados.map((m) => (
            <li key={m.id}>{m.nombre || "Documento"} <button type="button" className="adm-btn chico" disabled={trabajando} onClick={() => onRecuperar(m)}>Recuperar</button></li>
          ))}</ul>
        </details>
      ) : null}
    </section>
  );
}

function Info({ m }: { readonly m: FilaMedioProp }) {
  return <span className="adm-info-archivo">{(m.formato ?? "").toUpperCase().replace("JPEG", "JPG")} · {pesoLegible(m.bytes)}{m.ancho ? ` · ${m.ancho}×${m.alto}` : ""}</span>;
}

function Quitados({ lista, trabajando, onRecuperar }: { readonly lista: FilaMedioProp[]; readonly trabajando: boolean; readonly onRecuperar: (m: FilaMedioProp) => void }) {
  const [ver, setVer] = useState(false);
  if (!lista.length) return null;
  return (
    <div className="adm-papelera">
      <button type="button" className="adm-btn chico" aria-expanded={ver} onClick={() => setVer(!ver)}>{ver ? "Ocultar" : "Ver"} quitados ({lista.length})</button>
      {ver ? (
        <div className="adm-miniaturas chicas">
          {lista.map((m) => (
            <div key={m.id} className="adm-mini quitado">
              <img src={urlMedioProp(m)} alt="" loading="lazy" />
              <button type="button" className="adm-btn chico" disabled={trabajando} onClick={() => onRecuperar(m)}>Recuperar</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Botón + zona para soltar archivos. Sube de a uno y muestra el progreso y los errores claros. */
function Subir({ tipo, propiedadId, multiple, texto, onListo }: {
  readonly tipo: TipoMedioProp; readonly propiedadId: string; readonly multiple: boolean; readonly texto: string; readonly onListo: () => void;
}) {
  const [progreso, setProgreso] = useState<Progreso[]>([]);
  const [encima, setEncima] = useState(false);
  const avisar = useAvisos();
  const ocupado = progreso.some((p) => p.estado === "subiendo" || p.estado === "esperando");
  const acepta = tipo === "documento" ? "application/pdf,.pdf" : ACEPTA_IMAGENES;

  const subir = async (archivos: File[]) => {
    if (!archivos.length || ocupado) return;
    const lista = multiple ? archivos : archivos.slice(0, 1);
    const p: Progreso[] = lista.map((f) => ({ nombre: f.name, estado: "esperando" }));
    setProgreso(p);
    let ok = 0;
    for (const [i, f] of lista.entries()) {
      p[i] = { nombre: f.name, estado: "subiendo" }; setProgreso([...p]);
      try {
        const aviso = await subirMedioProp(propiedadId, tipo, f);
        p[i] = { nombre: f.name, estado: "ok", mensaje: aviso ?? undefined }; ok++;
      } catch (e) { p[i] = { nombre: f.name, estado: "error", mensaje: mensajeError(e) }; }
      setProgreso([...p]);
    }
    if (ok) { avisar("ok", `${ok} ${ok === 1 ? "archivo subido" : "archivos subidos"}.`); onListo(); }
    if (ok < lista.length) avisar("error", `${lista.length - ok} no se pudieron subir. Mirá el detalle debajo del botón.`);
  };

  return (
    <div className={encima ? "adm-subir encima" : "adm-subir"}
         onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setEncima(true); } }}
         onDragLeave={() => setEncima(false)}
         onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setEncima(false); void subir([...e.dataTransfer.files]); }}>
      <label className={ocupado ? "adm-btn primario desactivado" : "adm-btn primario"}>{ocupado ? "Subiendo…" : texto}
        <input type="file" accept={acepta} multiple={multiple} disabled={ocupado} className="adm-sr"
               onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void subir(fs); }} /></label>
      <span className="adm-ayuda">{multiple ? "o arrastrá los archivos acá. Se agregan al final." : "o arrastrá la imagen acá."}</span>
      {progreso.length ? (
        <ul className="adm-progreso" aria-live="polite">
          {progreso.map((p, i) => (
            <li key={i} className={p.estado}><span>{p.nombre}</span>
              <span>{p.estado === "esperando" ? "En espera" : p.estado === "subiendo" ? "Subiendo…" : p.estado === "ok" ? "Listo" : "Error"}</span>
              {p.mensaje ? <small>{p.mensaje}</small> : null}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
