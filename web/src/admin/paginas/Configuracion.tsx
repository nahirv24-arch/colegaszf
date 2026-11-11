import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { cerrarSesion, guardarNuevaContrasena } from "../../servicios/auth";
import { descargarRespaldo, guardarActualizado, leerActualizado, listarMedios, mensajeError, subirMedio, urlMedio } from "../servicio";
import { useSesion } from "../sesion";
import { Cargando, ErrorCaja, pesoLegible, useAvisos, useCarga, useConfirmar } from "../ui";

export function Configuracion() {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const { estado } = useSesion();
  const fecha = useCarga(leerActualizado, []);
  const generales = useCarga(() => listarMedios(null), []);
  const [valorFecha, setValorFecha] = useState("");
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [clave, setClave] = useState(""); const [clave2, setClave2] = useState("");
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [bajando, setBajando] = useState(false);
  useEffect(() => { if (fecha.datos !== null) setValorFecha(fecha.datos); }, [fecha.datos]);

  const portada = (generales.datos ?? []).find((m) => m.tipo === "portada_general" && !m.eliminado_en);
  const logo = (generales.datos ?? []).find((m) => m.tipo === "logo" && !m.eliminado_en);

  const cambiarClave = async (e: FormEvent) => {
    e.preventDefault();
    if (clave !== clave2) { avisar("error", "Las dos contraseñas no coinciden."); return; }
    setGuardandoClave(true);
    try { await guardarNuevaContrasena(clave); setClave(""); setClave2(""); avisar("ok", "Contraseña cambiada."); }
    catch (x) { avisar("error", x instanceof Error ? x.message : String(x)); }
    finally { setGuardandoClave(false); }
  };

  return (
    <div className="adm-pagina adm-config">
      <section className="adm-panel" aria-labelledby="c-fecha">
        <h2 id="c-fecha" className="adm-subtitulo">Fecha de la última actualización</h2>
        <p className="adm-ayuda">Es la fecha que aparece en el inicio: «Actualizamos los jueves — la última fue el…».
          Se actualiza sola cuando publicás (si dejás tildada esa opción). Este cambio se ve <b>enseguida</b> en la página.</p>
        {fecha.cargando && fecha.datos === null ? <Cargando /> : fecha.error ? <ErrorCaja texto={fecha.error} reintentar={fecha.recargar} /> : (
          <form className="adm-fila-agregar" onSubmit={async (e) => {
            e.preventDefault(); setGuardandoFecha(true);
            try { await guardarActualizado(valorFecha); avisar("ok", "Fecha guardada."); fecha.recargar(); }
            catch (x) { avisar("error", mensajeError(x)); } finally { setGuardandoFecha(false); }
          }}>
            <label className="adm-campo"><span className="adm-sr">Fecha</span>
              <input type="date" value={valorFecha} required onChange={(e) => setValorFecha(e.target.value)} /></label>
            <button type="submit" className="adm-btn primario" disabled={guardandoFecha || valorFecha === fecha.datos}>{guardandoFecha ? "Guardando…" : "Guardar fecha"}</button>
          </form>
        )}
      </section>

      <section className="adm-panel" aria-labelledby="c-portada">
        <h2 id="c-portada" className="adm-subtitulo">Portada general y logo</h2>
        <p className="adm-ayuda">La portada general es la foto grande del inicio. Reemplazarla se ve <b>enseguida</b> en la página
          (la anterior queda guardada y se puede recuperar).</p>
        {generales.cargando && !generales.datos ? <Cargando /> : generales.error ? <ErrorCaja texto={generales.error} reintentar={generales.recargar} /> : (
          <div className="adm-portada-fila">
            <div className="adm-portada-muestra ancha">{portada ? <img src={urlMedio(portada)} alt="Portada general" /> : <span>Sin portada</span>}</div>
            <div className="adm-portada-acc">
              <label className={subiendo ? "adm-btn desactivado" : "adm-btn"}>{subiendo ? "Subiendo…" : "Reemplazar portada general"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="adm-sr" disabled={subiendo} onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                  if (!(await confirmar({ titulo: "Reemplazar portada general", confirmar: "Reemplazar", mensaje: "La nueva foto se va a ver enseguida en el inicio de la página." }))) return;
                  setSubiendo(true);
                  try { const aviso = await subirMedio(null, "portada_general", f); avisar("ok", "Portada general reemplazada."); if (aviso) avisar("info", aviso); generales.recargar(); }
                  catch (x) { avisar("error", mensajeError(x)); } finally { setSubiendo(false); }
                }} /></label>
              {portada ? <span className="adm-info-archivo">{pesoLegible(portada.bytes)}{portada.ancho ? ` · ${portada.ancho}×${portada.alto}` : ""}</span> : null}
              {logo ? <div className="adm-logo-muestra"><img src={urlMedio(logo)} alt="Logo" /><span className="adm-ayuda">Logo actual (para cambiarlo, pedilo: es parte de la identidad).</span></div> : null}
            </div>
          </div>
        )}
      </section>

      <section className="adm-panel" aria-labelledby="c-resp">
        <h2 id="c-resp" className="adm-subtitulo">Respaldo y papelera</h2>
        <p className="adm-ayuda">Descargá una copia completa de todo (desarrollos, unidades, archivos, versiones y papelera) en un archivo.
          Conviene guardar una antes de cambios grandes.</p>
        <div className="adm-acciones izq">
          <button type="button" className="adm-btn" disabled={bajando} onClick={async () => {
            setBajando(true); try { await descargarRespaldo(); avisar("ok", "Respaldo descargado."); } catch (x) { avisar("error", mensajeError(x)); } finally { setBajando(false); }
          }}>{bajando ? "Preparando…" : "Descargar respaldo completo"}</button>
          <Link to="/admin/desarrollos?filtro=papelera" className="adm-btn">Ver desarrollos en la papelera</Link>
        </div>
      </section>

      <section className="adm-panel" aria-labelledby="c-cuenta">
        <h2 id="c-cuenta" className="adm-subtitulo">Mi cuenta</h2>
        <p className="adm-ayuda">Sesión iniciada como <b>{estado.tipo === "admin" ? estado.email : ""}</b> (administradora).</p>
        <form className="adm-form" onSubmit={cambiarClave}>
          <div className="adm-dos">
            <label className="adm-campo"><span>Contraseña nueva</span>
              <input type="password" autoComplete="new-password" minLength={12} required value={clave} onChange={(e) => setClave(e.target.value)} /></label>
            <label className="adm-campo"><span>Repetila</span>
              <input type="password" autoComplete="new-password" minLength={12} required value={clave2} onChange={(e) => setClave2(e.target.value)} /></label>
          </div>
          <div className="adm-acciones izq">
            <button type="submit" className="adm-btn primario" disabled={guardandoClave}>{guardandoClave ? "Guardando…" : "Cambiar contraseña"}</button>
            <button type="button" className="adm-btn texto-peligro" onClick={async () => {
              if (!(await confirmar({ titulo: "Cerrar sesión en todos los dispositivos", confirmar: "Cerrar en todos", peligro: true,
                mensaje: "Se cierra la sesión en esta computadora y en cualquier otro dispositivo donde hayas entrado." }))) return;
              await cerrarSesion(true); navegar("/admin/ingresar", { replace: true });
            }}>Cerrar sesión en todos los dispositivos</button>
          </div>
        </form>
      </section>
    </div>
  );
}
