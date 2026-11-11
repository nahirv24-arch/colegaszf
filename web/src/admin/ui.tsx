import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ------------------------------------------------------------------ avisos (éxito / error)
type Aviso = { id: number; tipo: "ok" | "error" | "info"; texto: string };
const CtxAvisos = createContext<(tipo: Aviso["tipo"], texto: string) => void>(() => {});

export function ProveedorAvisos({ children }: { readonly children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const n = useRef(0);
  const avisar = useCallback((tipo: Aviso["tipo"], texto: string) => {
    const id = ++n.current;
    setAvisos((a) => [...a, { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 9000 : 4500);
  }, []);
  return (
    <CtxAvisos.Provider value={avisar}>
      {children}
      <div className="adm-avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`adm-aviso ${a.tipo}`}>
            <span>{a.texto}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setAvisos((x) => x.filter((y) => y.id !== a.id))}>×</button>
          </div>
        ))}
      </div>
    </CtxAvisos.Provider>
  );
}
export const useAvisos = () => useContext(CtxAvisos);

// ------------------------------------------------------------------ confirmaciones
interface PedidoConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  confirmar: string;
  peligro?: boolean;
}
const CtxConfirmar = createContext<(p: PedidoConfirmacion) => Promise<boolean>>(async () => false);

export function ProveedorConfirmar({ children }: { readonly children: ReactNode }) {
  const [pedido, setPedido] = useState<(PedidoConfirmacion & { resolver: (ok: boolean) => void }) | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const confirmar = useCallback((p: PedidoConfirmacion) => new Promise<boolean>((resolver) => setPedido({ ...p, resolver })), []);
  useEffect(() => { if (pedido && dlg.current && !dlg.current.open) dlg.current.showModal(); }, [pedido]);
  const cerrar = (ok: boolean) => { pedido?.resolver(ok); dlg.current?.close(); setPedido(null); };
  return (
    <CtxConfirmar.Provider value={confirmar}>
      {children}
      <dialog ref={dlg} className="adm-dialogo" onCancel={(e) => { e.preventDefault(); cerrar(false); }} aria-labelledby="adm-conf-titulo">
        {pedido ? (
          <div className="adm-dialogo-caja">
            <h2 id="adm-conf-titulo">{pedido.titulo}</h2>
            <div className="adm-dialogo-texto">{pedido.mensaje}</div>
            <div className="adm-acciones">
              <button type="button" className="adm-btn" onClick={() => cerrar(false)} autoFocus>Cancelar</button>
              <button type="button" className={pedido.peligro ? "adm-btn peligro" : "adm-btn primario"} onClick={() => cerrar(true)}>{pedido.confirmar}</button>
            </div>
          </div>
        ) : null}
      </dialog>
    </CtxConfirmar.Provider>
  );
}
export const useConfirmar = () => useContext(CtxConfirmar);

// ------------------------------------------------------------------ piezas chicas
export function Cargando({ texto = "Cargando…" }: { readonly texto?: string }) {
  return <div className="adm-cargando" role="status"><span className="adm-giro" aria-hidden="true" />{texto}</div>;
}

export function ErrorCaja({ texto, reintentar }: { readonly texto: string; readonly reintentar?: () => void }) {
  return (
    <div className="adm-error-caja" role="alert">
      <b>No se pudo completar.</b> <span>{texto}</span>
      {reintentar ? <button type="button" className="adm-btn chico" onClick={reintentar}>Reintentar</button> : null}
    </div>
  );
}

/** Ventana modal genérica (formularios). Esc o "Cancelar" la cierran. */
export function Modal({ titulo, abierta, onCerrar, children, ancho }: {
  readonly titulo: string; readonly abierta: boolean; readonly onCerrar: () => void; readonly children: ReactNode; readonly ancho?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  return (
    <dialog ref={ref} className="adm-dialogo" style={ancho ? { width: `min(${ancho}px, calc(100vw - 32px))` } : undefined}
            onCancel={(e) => { e.preventDefault(); onCerrar(); }} aria-label={titulo}>
      {abierta ? (
        <div className="adm-dialogo-caja">
          <div className="adm-dialogo-cab"><h2>{titulo}</h2>
            <button type="button" className="adm-x" aria-label="Cerrar" onClick={onCerrar}>×</button></div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function ChipEstado({ estado, visible, papelera, cambios }: {
  readonly estado: string; readonly visible: boolean; readonly papelera?: boolean; readonly cambios?: boolean;
}) {
  if (papelera) return <span className="adm-chip gris">En la papelera</span>;
  return (
    <span className="adm-chips">
      {estado === "publicado" ? <span className="adm-chip verde">Publicado</span> : <span className="adm-chip ambar">Borrador</span>}
      {!visible ? <span className="adm-chip gris">Oculto</span> : null}
      {cambios && estado === "publicado" ? <span className="adm-chip rojo">Cambios sin publicar</span> : null}
    </span>
  );
}

const FMT = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FMT.format(d);
}

export function pesoLegible(b: number | null | undefined): string {
  if (!b) return "—";
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

/** Hook para cargar datos con estado de carga/error y recarga. */
export function useCarga<T>(f: () => Promise<T>, deps: readonly unknown[]) {
  const [estado, setEstado] = useState<{ cargando: boolean; error: string | null; datos: T | null }>({ cargando: true, error: null, datos: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    f().then((datos) => { if (vivo) setEstado({ cargando: false, error: null, datos }); },
            (e: unknown) => { if (vivo) setEstado((x) => ({ ...x, cargando: false, error: e instanceof Error ? e.message : String(e) })); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...estado, recargar: () => setN((x) => x + 1) };
}
