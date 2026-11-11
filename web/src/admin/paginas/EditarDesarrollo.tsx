import { useCallback, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import {
  cambiarVisible, guardarDesarrollo, leerDesarrollo, listarDesarrollos, mandarAPapelera, mensajeError, publicar,
  sacarDePapelera, type DatosEditables, type FilaDesarrollo, type ResumenDesarrollo,
} from "../servicio";
import { Cargando, ChipEstado, ErrorCaja, fechaHora, Modal, useAvisos, useCarga, useConfirmar } from "../ui";
import { desdeFila, FormDatos } from "./FormDatos";
import { Multimedia } from "./Multimedia";
import { TablaUnidades } from "./TablaUnidades";
import { Versiones } from "./Versiones";

const PESTANAS = [["datos", "Datos"], ["unidades", "Unidades"], ["multimedia", "Multimedia"], ["versiones", "Versiones e historial"]] as const;

export function EditarDesarrollo() {
  const { id = "", pestana = "datos" } = useParams();
  const navegar = useNavigate();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const carga = useCarga(async () => {
    const [fila, resumen] = await Promise.all([leerDesarrollo(id), listarDesarrollos()]);
    return { fila, resumen: resumen.find((r) => r.id === id) ?? null };
  }, [id]);
  const [guardando, setGuardando] = useState(false);
  const [publicarAbierto, setPublicarAbierto] = useState(false);
  const fila: FilaDesarrollo | null = carga.datos?.fila ?? null;
  const resumen: ResumenDesarrollo | null = carga.datos?.resumen ?? null;
  const inicial = useMemo(() => (fila ? desdeFila(fila) : null), [fila]);
  const refrescar = carga.recargar;

  const accion = useCallback(async (f: () => Promise<void>, ok: string) => {
    try { await f(); avisar("ok", ok); refrescar(); } catch (e) { avisar("error", mensajeError(e)); }
  }, [avisar, refrescar]);

  if (carga.cargando && !carga.datos) return <Cargando />;
  if (carga.error) return <ErrorCaja texto={carga.error} reintentar={refrescar} />;
  if (!fila || !resumen || !inicial) return <ErrorCaja texto={`No existe un desarrollo con el identificador "${id}".`} />;

  const enPapelera = !!fila.eliminado_en;
  const guardarDatos = async (d: DatosEditables) => {
    setGuardando(true);
    try {
      await guardarDesarrollo(id, d);
      avisar("ok", fila.estado === "publicado" ? "Cambios guardados en el borrador. La página pública no cambia hasta que publiques." : "Cambios guardados.");
      refrescar();
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setGuardando(false); }
  };

  return (
    <div className="adm-pagina">
      <div className="adm-ficha-cab">
        <div>
          <Link to="/admin/desarrollos" className="adm-volver">← Todos los desarrollos</Link>
          <h2 className="adm-ficha-titulo">{fila.nombre}</h2>
          <div className="adm-ficha-meta">
            <ChipEstado estado={fila.estado} visible={fila.visible} papelera={enPapelera} cambios={resumen.cambios_sin_publicar} />
            <span>Enlace: <code>/#{fila.id}</code></span>
            <span>{resumen.version_vigente ? `Versión publicada: ${resumen.version_vigente} (${fechaHora(resumen.publicado_en)})` : "Nunca publicado"}</span>
          </div>
        </div>
        <div className="adm-ficha-acc">
          {enPapelera ? (
            <button type="button" className="adm-btn primario" onClick={() => void accion(() => sacarDePapelera(id), "Desarrollo recuperado de la papelera.")}>Sacar de la papelera</button>
          ) : (<>
            <a className="adm-btn" href={`/admin/vista-previa/${id}`} target="_blank" rel="noopener">Vista previa ↗</a>
            <button type="button" className="adm-btn publicar" onClick={() => setPublicarAbierto(true)}
                    disabled={fila.estado === "publicado" && !resumen.cambios_sin_publicar}
                    title={fila.estado === "publicado" && !resumen.cambios_sin_publicar ? "No hay cambios sin publicar" : undefined}>
              {fila.estado === "publicado" ? "Publicar cambios" : "Publicar"}</button>
            <button type="button" className="adm-btn" onClick={async () => {
              const ok = await confirmar(fila.visible
                ? { titulo: "Ocultar de la página", mensaje: <>«{fila.nombre}» deja de verse en la página de colegas <b>enseguida</b>. No se borra nada y podés volver a mostrarlo cuando quieras.</>, confirmar: "Ocultar" }
                : { titulo: "Mostrar en la página", mensaje: <>«{fila.nombre}» vuelve a verse en la página de colegas (su última versión publicada).</>, confirmar: "Mostrar" });
              if (ok) await accion(() => cambiarVisible(id, !fila.visible), fila.visible ? "Oculto de la página pública." : "Visible otra vez en la página pública.");
            }}>{fila.visible ? "Ocultar" : "Mostrar"}</button>
            <button type="button" className="adm-btn texto-peligro" onClick={async () => {
              const ok = await confirmar({ titulo: "Mandar a la papelera", peligro: true, confirmar: "Mandar a la papelera",
                mensaje: <>«{fila.nombre}» sale de la página y del panel, pero <b>no se borra</b>: lo podés recuperar desde Desarrollos → Papelera.</> });
              if (ok) { await accion(() => mandarAPapelera(id), "Enviado a la papelera."); navegar("/admin/desarrollos"); }
            }}>Papelera</button>
          </>)}
        </div>
      </div>

      <nav className="adm-pestanas" aria-label="Secciones del desarrollo">
        {PESTANAS.map(([k, t]) => (
          <NavLink key={k} to={`/admin/desarrollos/${id}/${k}`} className={pestana === k ? "activo" : undefined} aria-current={pestana === k ? "page" : undefined}>{t}</NavLink>
        ))}
      </nav>

      {pestana === "datos" ? (
        <FormDatos inicial={inicial} guardando={guardando} onGuardar={guardarDatos} onCancelar={() => {}} textoGuardar="Guardar cambios" />
      ) : pestana === "unidades" ? (
        <TablaUnidades desarrollo={fila} onCambio={refrescar} />
      ) : pestana === "multimedia" ? (
        <Multimedia desarrolloId={id} onCambio={refrescar} />
      ) : (
        <Versiones desarrolloId={id} onCambio={refrescar} />
      )}

      <DialogoPublicar abierto={publicarAbierto} nombre={fila.nombre} primeraVez={fila.estado !== "publicado"}
        onCerrar={() => setPublicarAbierto(false)}
        onPublicar={async (nota, fecha) => {
          try {
            const v = await publicar(id, nota, fecha);
            avisar("ok", `Publicado: versión ${v}. Ya es lo que ve la página pública.`);
            setPublicarAbierto(false); refrescar();
          } catch (e) { avisar("error", mensajeError(e)); }
        }} />
    </div>
  );
}

function DialogoPublicar({ abierto, nombre, primeraVez, onCerrar, onPublicar }: {
  readonly abierto: boolean; readonly nombre: string; readonly primeraVez: boolean;
  readonly onCerrar: () => void; readonly onPublicar: (nota: string, fecha: boolean) => Promise<void>;
}) {
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(true);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal titulo={primeraVez ? "Publicar desarrollo" : "Publicar cambios"} abierta={abierto} onCerrar={onCerrar} ancho={520}>
      <p className="adm-dialogo-texto">Lo que está guardado ahora en el panel para <b>«{nombre}»</b> pasa a ser lo que ven los colegas.
        La versión anterior queda guardada y se puede recuperar.</p>
      <p className="adm-ayuda">Antes de publicar, conviene revisar la <a href="#" onClick={(e) => { e.preventDefault(); window.open(window.location.pathname.replace(/\/admin\/desarrollos\/([^/]+).*/, "/admin/vista-previa/$1"), "_blank"); }}>vista previa</a>.
        Los cambios que no hayas guardado no se publican.</p>
      <label className="adm-campo"><span>Nota (opcional, para el historial)</span>
        <input type="text" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: lista de precios de noviembre" /></label>
      <label className="adm-check"><input type="checkbox" checked={fecha} onChange={(e) => setFecha(e.target.checked)} />
        <span>Actualizar la fecha «la última fue el…» del inicio a hoy</span></label>
      <div className="adm-acciones">
        <button type="button" className="adm-btn" onClick={onCerrar} disabled={enviando}>Cancelar</button>
        <button type="button" className="adm-btn publicar" disabled={enviando}
                onClick={async () => { setEnviando(true); await onPublicar(nota, fecha); setEnviando(false); setNota(""); }}>
          {enviando ? "Publicando…" : "Publicar ahora"}</button>
      </div>
    </Modal>
  );
}
