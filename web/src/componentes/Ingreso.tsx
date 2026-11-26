import { useState, type FormEvent, type ReactNode } from "react";
import { cambiarClave, ingresar } from "../servicios/cuenta";
import { urlPublicaMedia } from "../servicios/urlSupabase";

const WHATSAPP = "https://wa.me/5493516378970";

/** Marco común: fondo oscuro, logo y una tarjeta blanca en el medio. */
function Marco({ logo, children }: { readonly logo: string; readonly children: ReactNode }) {
  return (
    <main className="ingreso">
      <div className="ingreso-caja">
        <div className="ingreso-logo">
          {logo ? <img src={urlPublicaMedia(logo)} alt="ZF Propiedades" /> : <b>ZF Propiedades</b>}
        </div>
        <div className="ingreso-tarjeta">{children}</div>
        <p className="ingreso-pie">¿Necesitás ayuda? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">Escribinos por WhatsApp</a></p>
      </div>
    </main>
  );
}

function CampoClave({ etiqueta, valor, onCambio, auto, ver }: {
  readonly etiqueta: string; readonly valor: string; readonly onCambio: (v: string) => void;
  readonly auto: string; readonly ver: boolean;
}) {
  return (
    <label className="ingreso-campo">
      <span>{etiqueta}</span>
      <input type={ver ? "text" : "password"} value={valor} onChange={(e) => onCambio(e.target.value)}
             autoComplete={auto} autoCapitalize="none" spellCheck={false} required />
    </label>
  );
}

/** Pantalla de ingreso con usuario y contraseña. */
export function Ingreso({ logo, onVolver }: { readonly logo: string; readonly onVolver?: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !clave) return;
    setEntrando(true); setError("");
    try { await ingresar(usuario, clave); }
    catch (x) { setError(x instanceof Error ? x.message : String(x)); setEntrando(false); }
  }

  return (
    <Marco logo={logo}>
      <div className="ingreso-rot">Material para colegas</div>
      <h1 className="ingreso-titulo">Ingresá con tu usuario</h1>
      <p className="ingreso-texto">Usá el usuario y la contraseña que te pasamos desde ZF Propiedades.</p>
      <form onSubmit={(e) => void enviar(e)} className="ingreso-form">
        <label className="ingreso-campo">
          <span>Usuario</span>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username"
                 autoCapitalize="none" spellCheck={false} placeholder="nombre.apellido" required autoFocus />
        </label>
        <CampoClave etiqueta="Contraseña" valor={clave} onCambio={setClave} auto="current-password" ver={ver} />
        <label className="ingreso-ver"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseña</label>
        {error ? <p className="ingreso-error" role="alert">{error}</p> : null}
        <button type="submit" className="ingreso-boton" disabled={entrando}>{entrando ? "Ingresando…" : "Ingresar"}</button>
      </form>
      <p className="ingreso-nota">¿Te olvidaste la contraseña? Escribinos y te damos una nueva.</p>
      <p className="ingreso-nota">Al ingresar, registramos qué material consultás para darte una mejor atención.</p>
      {onVolver ? <button type="button" className="ingreso-volver" onClick={onVolver}>← Volver a la página</button> : null}
    </Marco>
  );
}

/** La primera vez (o después de una contraseña nueva), el colega elige la suya. */
export function CambiarClave({ logo, nombre, onListo, onSalir }: {
  readonly logo: string; readonly nombre: string; readonly onListo: () => void; readonly onSalir: () => void;
}) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nueva.length < 10) { setError("La contraseña tiene que tener al menos 10 caracteres."); return; }
    if (nueva !== repetida) { setError("Las dos contraseñas no coinciden."); return; }
    setGuardando(true); setError("");
    try { await cambiarClave(nueva); onListo(); }
    catch (x) { setError(x instanceof Error ? x.message : String(x)); setGuardando(false); }
  }

  const pila = nombre.trim().split(/\s+/)[0] ?? "";
  return (
    <Marco logo={logo}>
      <div className="ingreso-rot">Material para colegas</div>
      <h1 className="ingreso-titulo">¡Hola{pila ? `, ${pila}` : ""}!</h1>
      <p className="ingreso-texto">Antes de seguir, elegí una contraseña tuya (al menos 10 caracteres). Es la que vas a usar de ahora en adelante.</p>
      <form onSubmit={(e) => void enviar(e)} className="ingreso-form">
        <CampoClave etiqueta="Contraseña nueva" valor={nueva} onCambio={setNueva} auto="new-password" ver={ver} />
        <CampoClave etiqueta="Repetila" valor={repetida} onCambio={setRepetida} auto="new-password" ver={ver} />
        <label className="ingreso-ver"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas</label>
        {error ? <p className="ingreso-error" role="alert">{error}</p> : null}
        <button type="submit" className="ingreso-boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar y entrar"}</button>
      </form>
      <button type="button" className="ingreso-volver" onClick={onSalir}>Salir</button>
    </Marco>
  );
}

/** Acceso pausado desde el panel. */
export function AccesoPausado({ logo, nombre, onSalir }: { readonly logo: string; readonly nombre: string; readonly onSalir: () => void }) {
  const pila = nombre.trim().split(/\s+/)[0] ?? "";
  return (
    <Marco logo={logo}>
      <div className="ingreso-rot">Material para colegas</div>
      <h1 className="ingreso-titulo">Tu acceso está en pausa</h1>
      <p className="ingreso-texto">{pila ? `${pila}, por` : "Por"} el momento tu usuario no tiene acceso al material. Si creés que es un error,
        escribinos y lo revisamos.</p>
      <a className="ingreso-boton" href={WHATSAPP} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>
      <button type="button" className="ingreso-volver" onClick={onSalir}>Salir</button>
    </Marco>
  );
}
