import { useRef, useState, type DragEvent } from "react";
import {
  listarMedios, mensajeError, quitarMedio, reemplazarMedio, reordenarMedios, restaurarMedio, subirMedio, urlMedio,
  usarComoPortada, type FilaMedio, type TipoMedio,
} from "../servicio";
import { Cargando, ErrorCaja, Modal, pesoLegible, useAvisos, useCarga, useConfirmar } from "../ui";

const SECCIONES: { tipo: TipoMedio; titulo: string; ayuda: string }[] = [
  { tipo: "foto", titulo: "Fotografías reales", ayuda: "Obra, unidades y entorno. Se muestran en la pestaña «Imágenes»." },
  { tipo: "render", titulo: "Renders", ayuda: "Imágenes en alta del proyecto." },
  { tipo: "plano", titulo: "Planos", ayuda: "Planos por tipología, con medidas." },
  { tipo: "pagina_brochure", titulo: "Páginas del brochure", ayuda: "Una imagen por página, EN ORDEN. Con estas páginas la página pública arma el PDF del brochure." },
];
const ACEPTA = "image/jpeg,image/png,image/webp";

type Progreso = { nombre: string; estado: "esperando" | "subiendo" | "ok" | "error"; mensaje?: string };

export function Multimedia({ desarrolloId, onCambio }: { readonly desarrolloId: string; readonly onCambio: () => void }) {
  const carga = useCarga(() => listarMedios(desarrolloId), [desarrolloId]);
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [viendo, setViendo] = useState<FilaMedio | null>(null);
  const [eligiendoPortada, setEligiendoPortada] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const hacer = async (f: () => Promise<void>, ok: string) => {
    setTrabajando(true);
    try { await f(); avisar("ok", ok); }
    catch (e) { avisar("error", mensajeError(e)); }
    finally { setTrabajando(false); carga.recargar(); onCambio(); }
  };

  if (carga.cargando && !carga.datos) return <Cargando texto="Cargando el material…" />;
  if (carga.error) return <ErrorCaja texto={carga.error} reintentar={carga.recargar} />;
  const todos = carga.datos ?? [];
  const activos = (t: TipoMedio) => todos.filter((m) => m.tipo === t && !m.eliminado_en).sort((a, b) => a.orden - b.orden);
  const quitados = (t: TipoMedio) => todos.filter((m) => m.tipo === t && m.eliminado_en);
  const portada = activos("portada")[0];
  const candidatas = [...activos("foto"), ...activos("render")];

  return (
    <div className="adm-seccion">
      <p className="adm-intro">Todo lo que subas o cambies acá queda en el <b>borrador</b>: los colegas lo ven al publicar.
        Las imágenes se guardan tal cual (sin recomprimir). Formatos: JPG, PNG o WEBP, hasta 20 MB cada una.</p>

      <section className="adm-panel adm-medios-sec" aria-labelledby="sec-portada">
        <div className="adm-medios-cab"><h2 id="sec-portada" className="adm-subtitulo">Portada</h2>
          <span className="adm-ayuda">La foto de la tarjeta del inicio y de la cabecera de la ficha.</span></div>
        <div className="adm-portada-fila">
          <div className="adm-portada-muestra">
            {portada ? <img src={urlMedio(portada)} alt="Portada actual" /> : <span>Sin portada</span>}
          </div>
          <div className="adm-portada-acc">
            <SubirArchivos tipo="portada" desarrolloId={desarrolloId} multiple={false} texto={portada ? "Subir otra portada" : "Subir portada"}
              onListo={() => { carga.recargar(); onCambio(); }} />
            <button type="button" className="adm-btn" disabled={!candidatas.length} onClick={() => setEligiendoPortada(true)}>Elegir de las fotos o renders</button>
            {portada ? <InfoArchivo m={portada} /> : null}
            {quitados("portada").length ? <Quitados lista={quitados("portada")} trabajando={trabajando}
              onRecuperar={(m) => void hacer(() => restaurarMedio(m), "Portada anterior recuperada.")} /> : null}
          </div>
        </div>
      </section>

      {SECCIONES.map((s) => (
        <SeccionMedios key={s.tipo} {...s} desarrolloId={desarrolloId} lista={activos(s.tipo)} quitados={quitados(s.tipo)}
          trabajando={trabajando} onVer={setViendo}
          onListo={() => { carga.recargar(); onCambio(); }}
          onReordenar={(ids) => void hacer(() => reordenarMedios(desarrolloId, s.tipo, ids), "Orden guardado.")}
          onReemplazar={(m, f) => void hacer(async () => { const aviso = await reemplazarMedio(m, f); if (aviso) avisar("info", aviso); }, "Archivo reemplazado. El anterior se conserva para las versiones ya publicadas.")}
          onQuitar={async (m) => {
            if (await confirmar({ titulo: "Quitar archivo", confirmar: "Quitar", peligro: true,
              mensaje: <>El archivo sale de esta sección. <b>No se borra</b>: lo podés recuperar desde «Quitados».</> })) {
              await hacer(() => quitarMedio(m.id), "Archivo quitado (se puede recuperar).");
            }
          }}
          onPortada={s.tipo === "foto" || s.tipo === "render" ? (m) => void hacer(() => usarComoPortada(m), "Portada cambiada.") : undefined}
          onRecuperar={(m) => void hacer(() => restaurarMedio(m), "Archivo recuperado (quedó al final).")} />
      ))}

      <Modal titulo={viendo?.nombre || "Vista de la imagen"} abierta={!!viendo} onCerrar={() => setViendo(null)} ancho={1100}>
        {viendo ? <><img className="adm-vista-grande" src={urlMedio(viendo)} alt="" /><InfoArchivo m={viendo} /></> : null}
      </Modal>

      <Modal titulo="Elegir portada" abierta={eligiendoPortada} onCerrar={() => setEligiendoPortada(false)} ancho={900}>
        <p className="adm-ayuda">Tocá una imagen para usarla como portada (se usa el mismo archivo, no se vuelve a subir).</p>
        <div className="adm-miniaturas">
          {candidatas.map((m) => (
            <button key={m.id} type="button" className="adm-mini-elegir" disabled={trabajando}
                    onClick={() => { setEligiendoPortada(false); void hacer(() => usarComoPortada(m), "Portada cambiada."); }}>
              <img src={urlMedio(m)} alt={`${m.tipo === "foto" ? "Foto" : "Render"} ${m.orden}`} loading="lazy" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function InfoArchivo({ m }: { readonly m: FilaMedio }) {
  return <span className="adm-info-archivo">{(m.formato ?? "").toUpperCase().replace("JPEG", "JPG")} · {pesoLegible(m.bytes)}{m.ancho ? ` · ${m.ancho}×${m.alto}` : ""}</span>;
}

function Quitados({ lista, trabajando, onRecuperar }: { readonly lista: FilaMedio[]; readonly trabajando: boolean; readonly onRecuperar: (m: FilaMedio) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="adm-papelera">
      <button type="button" className="adm-btn chico" aria-expanded={ver} onClick={() => setVer(!ver)}>{ver ? "Ocultar" : "Ver"} quitados ({lista.length})</button>
      {ver ? (
        <div className="adm-miniaturas chicas">
          {lista.map((m) => (
            <div key={m.id} className="adm-mini quitado">
              <img src={urlMedio(m)} alt="" loading="lazy" />
              <button type="button" className="adm-btn chico" disabled={trabajando} onClick={() => onRecuperar(m)}>Recuperar</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SeccionMedios({ tipo, titulo, ayuda, desarrolloId, lista, quitados, trabajando, onVer, onListo, onReordenar, onReemplazar, onQuitar, onPortada, onRecuperar }: {
  readonly tipo: TipoMedio; readonly titulo: string; readonly ayuda: string; readonly desarrolloId: string;
  readonly lista: FilaMedio[]; readonly quitados: FilaMedio[]; readonly trabajando: boolean;
  readonly onVer: (m: FilaMedio) => void; readonly onListo: () => void; readonly onReordenar: (ids: string[]) => void;
  readonly onReemplazar: (m: FilaMedio, f: File) => void; readonly onQuitar: (m: FilaMedio) => void;
  readonly onPortada?: (m: FilaMedio) => void; readonly onRecuperar: (m: FilaMedio) => void;
}) {
  const arrastrando = useRef<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const mover = (de: number, a: number) => {
    if (a < 0 || a >= lista.length || de === a) return;
    const ids = lista.map((m) => m.id);
    const [x] = ids.splice(de, 1);
    ids.splice(a, 0, x!);
    onReordenar(ids);
  };
  const soltar = (e: DragEvent, i: number) => { e.preventDefault(); setSobre(null); if (arrastrando.current !== null) mover(arrastrando.current, i); arrastrando.current = null; };

  return (
    <section className="adm-panel adm-medios-sec" aria-labelledby={`sec-${tipo}`}>
      <div className="adm-medios-cab"><h2 id={`sec-${tipo}`} className="adm-subtitulo">{titulo} <span className="adm-cuenta-n">{lista.length}</span></h2>
        <span className="adm-ayuda">{ayuda}</span></div>
      <SubirArchivos tipo={tipo} desarrolloId={desarrolloId} multiple texto="Subir archivos" onListo={onListo} />
      {lista.length ? (
        <>
          <p className="adm-nota">Arrastrá una imagen para cambiar el orden, o usá las flechas ← →.</p>
          <ol className="adm-miniaturas" aria-label={`${titulo}, en orden`}>
            {lista.map((m, i) => (
              <li key={m.id} className={sobre === i ? "adm-mini sobre" : "adm-mini"} draggable={!trabajando}
                  onDragStart={(e) => { arrastrando.current = i; e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); setSobre(i); }} onDragLeave={() => setSobre(null)} onDrop={(e) => soltar(e, i)}>
                <button type="button" className="adm-mini-img" onClick={() => onVer(m)} aria-label={`Ver ${titulo.toLowerCase()} ${i + 1}`}>
                  <img src={urlMedio(m)} alt="" loading="lazy" width={m.ancho ?? undefined} height={m.alto ?? undefined} />
                  <span className="adm-mini-n">{i + 1}</span>
                </button>
                <InfoArchivo m={m} />
                <div className="adm-mini-acc">
                  <button type="button" aria-label="Mover antes" disabled={trabajando || i === 0} onClick={() => mover(i, i - 1)}>←</button>
                  <button type="button" aria-label="Mover después" disabled={trabajando || i === lista.length - 1} onClick={() => mover(i, i + 1)}>→</button>
                  <label className="adm-mini-reemplazar">Reemplazar
                    <input type="file" accept={ACEPTA} disabled={trabajando} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onReemplazar(m, f); }} /></label>
                  {onPortada ? <button type="button" disabled={trabajando} onClick={() => onPortada(m)}>Portada</button> : null}
                  <button type="button" className="texto-peligro" disabled={trabajando} onClick={() => onQuitar(m)}>Quitar</button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : <p className="adm-nota">Todavía no hay archivos en esta sección (en la página aparece como «Pendiente»).</p>}
      {quitados.length ? <Quitados lista={quitados} trabajando={trabajando} onRecuperar={onRecuperar} /> : null}
    </section>
  );
}

/** Botón + zona para soltar archivos. Sube de a uno, muestra el progreso y los errores claros. */
function SubirArchivos({ tipo, desarrolloId, multiple, texto, onListo }: {
  readonly tipo: TipoMedio; readonly desarrolloId: string; readonly multiple: boolean; readonly texto: string; readonly onListo: () => void;
}) {
  const [progreso, setProgreso] = useState<Progreso[]>([]);
  const [encima, setEncima] = useState(false);
  const avisar = useAvisos();
  const ocupado = progreso.some((p) => p.estado === "subiendo" || p.estado === "esperando");

  const subir = async (archivos: File[]) => {
    if (!archivos.length || ocupado) return;
    const lista = multiple ? archivos : archivos.slice(0, 1);
    const p: Progreso[] = lista.map((f) => ({ nombre: f.name, estado: "esperando" }));
    setProgreso(p);
    let ok = 0;
    for (const [i, f] of lista.entries()) {
      p[i] = { nombre: f.name, estado: "subiendo" }; setProgreso([...p]);
      try {
        const aviso = await subirMedio(desarrolloId, tipo, f);
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
        <input type="file" accept={ACEPTA} multiple={multiple} disabled={ocupado} className="adm-sr"
               onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void subir(fs); }} /></label>
      <span className="adm-ayuda">{multiple ? "o arrastrá varias imágenes acá. Se agregan al final, en el orden en que las elegiste." : "o arrastrá la imagen acá."}</span>
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
