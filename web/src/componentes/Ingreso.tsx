import { useState, type FormEvent, type ReactNode } from "react";
import { cambiarClave, crearCuenta, ingresar } from "../servicios/cuenta";
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

const USUARIO_VALIDO = /^[a-z0-9][a-z0-9._-]{2,39}$/;

/** «Juan Pérez» → «juan.perez» (sugerencia; el colega lo puede cambiar). */
function usuarioDeNombre(nombre: string): string {
  return nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40).replace(/\.+$/, "");
}

/** Pantalla de ingreso con usuario y contraseña (o, la primera vez, para crear la cuenta). */
export function Ingreso({ logo, onVolver }: { readonly logo: string; readonly onVolver?: () => void }) {
  const [modo, setModo] = useState<"ingresar" | "crear">("ingresar");
  if (modo === "crear") return <CrearCuenta logo={logo} onVolver={onVolver} onIngresar={() => setModo("ingresar")} />;
  return <FormIngreso logo={logo} onVolver={onVolver} onCrear={() => setModo("crear")} />;
}

function FormIngreso({ logo, onVolver, onCrear }: { readonly logo: string; readonly onVolver?: () => void; readonly onCrear: () => void }) {
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
      <p className="ingreso-texto">Usá tu usuario y tu contraseña. Si es tu primera vez, creá tu cuenta abajo: es un minuto.</p>
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
      <div className="ingreso-alternativa">
        <span>¿Es tu primera vez?</span>
        <button type="button" className="ingreso-secundario" onClick={onCrear}>Creá tu cuenta</button>
      </div>
      <p className="ingreso-nota">¿Te olvidaste la contraseña? Escribinos y te damos una nueva.</p>
      <p className="ingreso-nota">Al ingresar, registramos qué material consultás para darte una mejor atención.</p>
      {onVolver ? <button type="button" className="ingreso-volver" onClick={onVolver}>← Volver a la página</button> : null}
    </Marco>
  );
}

/** El colega se crea la cuenta: nombre, usuario y contraseña. Queda pendiente hasta que ZF la aprueba. */
function CrearCuenta({ logo, onVolver, onIngresar }: {
  readonly logo: string; readonly onVolver?: () => void; readonly onIngresar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [tocoUsuario, setTocoUsuario] = useState(false);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  const cambiarNombre = (v: string) => { setNombre(v); if (!tocoUsuario) setUsuario(usuarioDeNombre(v)); };
  const u = usuario.trim().toLowerCase();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 3) { setError("Escribí tu nombre y apellido."); return; }
    if (!USUARIO_VALIDO.test(u)) { setError("El usuario tiene que tener entre 3 y 40 letras sin acentos, números o puntos (ej.: juan.perez)."); return; }
    if (clave.length < 8) { setError("La contraseña tiene que tener al menos 8 caracteres."); return; }
    if (clave !== repetida) { setError("Las dos contraseñas no coinciden."); return; }
    setCreando(true); setError("");
    try { await crearCuenta(nombre, u, clave); }
    catch (x) { setError(x instanceof Error ? x.message : String(x)); setCreando(false); }
  }

  return (
    <Marco logo={logo}>
      <div className="ingreso-rot">Material para colegas</div>
      <h1 className="ingreso-titulo">Creá tu cuenta</h1>
      <p className="ingreso-texto">Completá tus datos. Apenas revisemos tu registro, vas a poder ver todo el material.</p>
      <form onSubmit={(e) => void enviar(e)} className="ingreso-form">
        <label className="ingreso-campo">
          <span>Nombre y apellido</span>
          <input value={nombre} onChange={(e) => cambiarNombre(e.target.value)} autoComplete="name" required autoFocus maxLength={120} />
        </label>
        <label className="ingreso-campo">
          <span>Usuario</span>
          <input value={usuario} onChange={(e) => { setTocoUsuario(true); setUsuario(e.target.value); }} autoComplete="username"
                 autoCapitalize="none" spellCheck={false} placeholder="nombre.apellido" required maxLength={40} />
          <small className="ingreso-ayuda">Es con lo que vas a entrar. Sin espacios ni acentos (ej.: juan.perez).</small>
        </label>
        <CampoClave etiqueta="Contraseña" valor={clave} onCambio={setClave} auto="new-password" ver={ver} />
        <CampoClave etiqueta="Repetila" valor={repetida} onCambio={setRepetida} auto="new-password" ver={ver} />
        <label className="ingreso-ver"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas</label>
        {error ? <p className="ingreso-error" role="alert">{error}</p> : null}
        <button type="submit" className="ingreso-boton" disabled={creando}>{creando ? "Creando…" : "Crear cuenta"}</button>
      </form>
      <div className="ingreso-alternativa">
        <span>¿Ya tenés cuenta?</span>
        <button type="button" className="ingreso-secundario" onClick={onIngresar}>Ingresá</button>
      </div>
      <p className="ingreso-nota">Al ingresar, registramos qué material consultás para darte una mejor atención.</p>
      {onVolver ? <button type="button" className="ingreso-volver" onClick={onVolver}>← Volver a la página</button> : null}
    </Marco>
  );
}

/** Se registró y espera la aprobación de ZF. */
export function CuentaPendiente({ logo, nombre, usuario, onRevisar, onSalir, onVolver }: {
  readonly logo: string; readonly nombre: string; readonly usuario: string;
  readonly onRevisar: () => void; readonly onSalir: () => void; readonly onVolver?: () => void;
}) {
  const pila = nombre.trim().split(/\s+/)[0] ?? "";
  return (
    <Marco logo={logo}>
      <div className="ingreso-rot">Material para colegas</div>
      <h1 className="ingreso-titulo">¡Gracias{pila ? `, ${pila}` : ""}!</h1>
      <p className="ingreso-texto">Recibimos tu registro. En cuanto lo aprobemos vas a poder ver todo el material: entrá de nuevo más tarde con tu usuario
        {" "}<b className="ingreso-usuario">{usuario}</b> y tu contraseña.</p>
      {onVolver ? <button type="button" className="ingreso-boton" onClick={onVolver}>Seguir a la página</button>
        : <button type="button" className="ingreso-boton" onClick={onRevisar}>Ya me aprobaron · entrar</button>}
      <a className="ingreso-secundario centrado" href={WHATSAPP} target="_blank" rel="noopener noreferrer">¿Lo necesitás ya? Escribinos por WhatsApp</a>
      <button type="button" className="ingreso-volver" onClick={onSalir}>Salir</button>
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
