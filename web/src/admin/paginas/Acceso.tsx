import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { cerrarSesion, guardarNuevaContrasena, iniciarSesion, pedirRecuperacion } from "../../servicios/auth";
import { useSesion } from "../sesion";
import { Cargando } from "../ui";

function Marco({ titulo, children }: { readonly titulo: string; readonly children: ReactNode }) {
  return (
    <div className="adm-acceso">
      <div className="adm-acceso-caja">
        <img className="adm-acceso-logo" src="/media/general/logo.png" alt="ZF Propiedades" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="adm-rot">Panel de administración</div>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  );
}

export function Ingresar() {
  const { estado, revisar } = useSesion();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado.tipo === "admin") return <Navigate to="/admin" replace />;
  if (estado.tipo === "cargando") return <div className="adm-acceso"><Cargando texto="Comprobando la sesión…" /></div>;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await iniciarSesion(email, clave);
      setClave("");
      await revisar();
      navegar("/admin", { replace: true });
    } catch (x) { setError(x instanceof Error ? x.message : String(x)); }
    finally { setEnviando(false); }
  };

  return (
    <Marco titulo="Iniciar sesión">
      {estado.tipo === "sin_permiso" ? (
        <div className="adm-error-caja" role="alert">
          La cuenta <b>{estado.email}</b> no tiene permiso de administración.
          <button type="button" className="adm-btn chico" onClick={() => void cerrarSesion().then(revisar)}>Usar otra cuenta</button>
        </div>
      ) : null}
      <form onSubmit={enviar} className="adm-form">
        <label className="adm-campo"><span>Correo</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="adm-campo"><span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} /></label>
        {error ? <p className="adm-error-linea" role="alert">{error}</p> : null}
        <button type="submit" className="adm-btn primario ancho" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
      </form>
      <p className="adm-acceso-pie"><Link to="/admin/recuperar">¿Olvidaste tu contraseña?</Link></p>
    </Marco>
  );
}

export function Recuperar() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEstado("enviando"); setError(null);
    try { await pedirRecuperacion(email); setEstado("enviado"); }
    catch { setError("No se pudo enviar el pedido. Revisá la conexión y probá de nuevo."); setEstado("listo"); }
  };
  return (
    <Marco titulo="Recuperar contraseña">
      {estado === "enviado" ? (
        <p className="adm-ok-linea" role="status">Si ese correo tiene una cuenta, te llega un mensaje con un enlace para elegir
          una contraseña nueva. Revisá también la carpeta de spam. El enlace sirve una sola vez.</p>
      ) : (
        <form onSubmit={enviar} className="adm-form">
          <p className="adm-ayuda">Escribí el correo de tu cuenta y te enviamos un enlace.</p>
          <label className="adm-campo"><span>Correo</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error ? <p className="adm-error-linea" role="alert">{error}</p> : null}
          <button type="submit" className="adm-btn primario ancho" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar enlace"}</button>
        </form>
      )}
      <p className="adm-acceso-pie"><Link to="/admin/ingresar">Volver a iniciar sesión</Link></p>
    </Marco>
  );
}

export function NuevaContrasena() {
  const { estado, revisar } = useSesion();
  const navegar = useNavigate();
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (estado.tipo === "cargando") return <div className="adm-acceso"><Cargando /></div>;
  if (estado.tipo === "sin_sesion" || estado.tipo === "sin_configurar") {
    return (
      <Marco titulo="Enlace vencido o inválido">
        <p className="adm-ayuda">Para elegir una contraseña nueva usá el enlace del correo de recuperación (sirve una sola vez).</p>
        <p className="adm-acceso-pie"><Link to="/admin/recuperar">Pedir otro enlace</Link></p>
      </Marco>
    );
  }
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    if (a !== b) { setError("Las dos contraseñas no coinciden."); return; }
    setGuardando(true);
    try { await guardarNuevaContrasena(a); setA(""); setB(""); await revisar(); navegar("/admin", { replace: true }); }
    catch (x) { setError(x instanceof Error ? x.message : String(x)); }
    finally { setGuardando(false); }
  };
  return (
    <Marco titulo="Elegí una contraseña nueva">
      <form onSubmit={enviar} className="adm-form">
        <p className="adm-ayuda">Mínimo 12 caracteres. Conviene una frase larga que te resulte fácil de recordar.</p>
        <label className="adm-campo"><span>Contraseña nueva</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={a} onChange={(e) => setA(e.target.value)} /></label>
        <label className="adm-campo"><span>Repetila</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={b} onChange={(e) => setB(e.target.value)} /></label>
        {error ? <p className="adm-error-linea" role="alert">{error}</p> : null}
        <button type="submit" className="adm-btn primario ancho" disabled={guardando}>{guardando ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </Marco>
  );
}
