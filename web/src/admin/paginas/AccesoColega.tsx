import { useEffect, useState } from "react";
import { mensajeError } from "../servicio";
import {
  crearAcceso, generarClave, linkWhatsapp, mensajeAcceso, resetearClave, sugerirUsuario, USUARIO_VALIDO,
} from "../servicioColegas";
import { Modal } from "../ui";

export interface ColegaAcceso {
  id: string;
  nombre: string;
  telefono: string;
  /** null = todavía no tiene acceso (se crea); con usuario = se le da una contraseña nueva. */
  usuario: string | null;
}

/**
 * Ventana para crear el acceso de un colega o darle una contraseña nueva.
 * Al terminar muestra el mensaje con la dirección, el usuario y la contraseña, para copiar o mandar por WhatsApp.
 * La contraseña solo se ve acá: después no se puede volver a consultar (se guarda cifrada).
 */
export function AccesoColega({ colega, ocupados, onCerrar, onListo }: {
  readonly colega: ColegaAcceso | null;
  readonly ocupados: ReadonlySet<string>;
  readonly onCerrar: () => void;
  readonly onListo: () => void;
}) {
  const nuevo = !colega?.usuario;
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!colega) return;
    setUsuario(colega.usuario ?? sugerirUsuario(colega.nombre, ocupados));
    setClave(generarClave());
    setError(""); setMensaje(null); setCopiado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir la ventana
  }, [colega?.id]);

  if (!colega) return null;
  const usuarioLimpio = usuario.trim().toLowerCase();
  const problemaUsuario = !nuevo ? "" : !USUARIO_VALIDO.test(usuarioLimpio)
    ? "Entre 3 y 40 letras sin acentos, números o puntos (ej.: juan.perez)."
    : ocupados.has(usuarioLimpio) ? "Ese usuario ya lo tiene otro colega." : "";

  async function confirmar() {
    if (!colega) return;
    setGuardando(true); setError("");
    try {
      if (nuevo) await crearAcceso(colega.id, usuarioLimpio, clave);
      else await resetearClave(colega.id, clave);
      setMensaje(mensajeAcceso(colega.nombre, nuevo ? usuarioLimpio : colega.usuario ?? "", clave, nuevo));
      onListo();
    } catch (e) { setError(mensajeError(e)); }
    finally { setGuardando(false); }
  }

  async function copiar() {
    if (!mensaje) return;
    try { await navigator.clipboard.writeText(mensaje); setCopiado(true); }
    catch { setError("No se pudo copiar. Seleccioná el texto y copialo a mano."); }
  }

  const wa = linkWhatsapp(colega.telefono);
  const enlaceWa = mensaje ? `${wa ?? "https://wa.me/"}?text=${encodeURIComponent(mensaje)}` : "";

  return (
    <Modal titulo={nuevo ? `Crear acceso · ${colega.nombre}` : `Nueva contraseña · ${colega.nombre}`} abierta onCerrar={onCerrar} ancho={560}>
      {mensaje ? (
        <div className="adm-accol">
          <p className="adm-dialogo-texto"><b>Listo.</b> {nuevo ? "Ya puede entrar a la página." : "La contraseña anterior dejó de funcionar."} Mandale
            este mensaje. <b>Guardalo ahora:</b> la contraseña no se puede volver a ver (si la pierde, le das una nueva).</p>
          <pre className="adm-accol-msj">{mensaje}</pre>
          {error ? <p className="adm-com-error">{error}</p> : null}
          <div className="adm-acciones">
            <button type="button" className="adm-btn" onClick={() => void copiar()}>{copiado ? "Copiado ✓" : "Copiar mensaje"}</button>
            <a className="adm-btn" href={enlaceWa} target="_blank" rel="noopener noreferrer">
              {wa ? "Enviar por WhatsApp ↗" : "Abrir WhatsApp ↗"}</a>
            <button type="button" className="adm-btn primario" onClick={onCerrar}>Listo</button>
          </div>
          {!wa ? <p className="adm-ayuda">Como no tiene un celular cargado, WhatsApp te va a pedir que elijas a quién mandárselo.</p> : null}
        </div>
      ) : (
        <div className="adm-accol">
          <p className="adm-dialogo-texto">
            {nuevo
              ? <>Con este usuario y contraseña va a poder entrar a la página. Todo lo que mire o descargue va a quedar registrado con su nombre.</>
              : <>Se le crea una contraseña nueva y la anterior deja de funcionar (si estaba con la página abierta, tiene que volver a entrar).</>}
          </p>
          <label className="adm-campo">
            <span>Usuario</span>
            {nuevo ? (
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" spellCheck={false}
                     aria-invalid={problemaUsuario ? true : undefined} />
            ) : <input value={colega.usuario ?? ""} readOnly />}
            {problemaUsuario ? <small className="texto-peligro">{problemaUsuario}</small>
              : nuevo ? <small>Armado con su nombre. Podés cambiarlo.</small> : null}
          </label>
          <label className="adm-campo">
            <span>Contraseña provisoria</span>
            <span className="adm-accol-clave">
              <input value={clave} readOnly />
              <button type="button" className="adm-btn chico" onClick={() => setClave(generarClave())}>Generar otra</button>
            </span>
            <small>La primera vez que entre, la página le pide que elija una propia.</small>
          </label>
          {error ? <p className="adm-com-error">{error}</p> : null}
          <div className="adm-acciones">
            <button type="button" className="adm-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
            <button type="button" className="adm-btn primario" onClick={() => void confirmar()} disabled={guardando || !!problemaUsuario}>
              {guardando ? "Guardando…" : nuevo ? "Crear acceso" : "Cambiar contraseña"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
