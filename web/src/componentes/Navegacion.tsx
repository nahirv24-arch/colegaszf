import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useEstadoDatos, useUrlMedio } from "../servicios/contexto";
import { useCuenta } from "../servicios/cuenta";
import { useHash } from "../utilidades/hash";

type Seccion = "inicio" | "desarrollos" | "terceros" | "comercios";

/** Secciones del inicio que se abren con "#" (cualquier otro "#" es la ficha de un desarrollo). */
const ANCLAS_INICIO = new Set(["", "categorias"]);

const arriba = () => window.scrollTo(0, 0);

/** En qué sección está el colega (para subrayarla en rojo). */
function useSeccion(): Seccion {
  const { pathname } = useLocation();
  const hash = useHash();
  const enInicio = (pathname === "/" || pathname === "/index.html") && (ANCLAS_INICIO.has(hash) || hash === "desarrollos");
  const [enGrilla, setEnGrilla] = useState(false);
  useEffect(() => {
    if (!enInicio) return;
    const medir = () => {
      const g = document.getElementById("desarrollos");
      setEnGrilla(!!g && g.getBoundingClientRect().top <= 120);
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, [enInicio]);
  if (pathname === "/terceros") return "terceros";
  if (pathname === "/comercios") return "comercios";
  if (!enInicio) return "desarrollos"; // ficha de un desarrollo
  return enGrilla ? "desarrollos" : "inicio";
}

/** Barra fija de arriba: transparente sobre la foto de portada y blanca cuando se baja. */
export function BarraNavegacion() {
  const estado = useEstadoDatos();
  const urlMedio = useUrlMedio();
  const { pathname } = useLocation();
  const seccion = useSeccion();
  const [blanca, setBlanca] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const enRaiz = pathname === "/" || pathname === "/index.html";
  const { cuenta, puedeIngresar, abrirIngreso, salir } = useCuenta();

  useEffect(() => {
    const medir = () => {
      // Transparente solo arriba de todo, sobre la foto; apenas se baja, blanca (así no tapa el título).
      setBlanca(!document.querySelector(".portada") || window.scrollY > 40);
    };
    medir();
    const t = window.setTimeout(medir, 300); // la portada puede aparecer después de cargar los datos
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { window.clearTimeout(t); window.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, [pathname, seccion, estado.tipo]);

  useEffect(() => { setAbierto(false); }, [pathname, seccion]);

  const logo = estado.tipo === "listo" ? estado.contenido.logo : "";
  const cerrar = () => setAbierto(false);

  /** Inicio y Desarrollos viven en "/": desde ahí alcanza con cambiar el "#". */
  const enlace = (s: Seccion, texto: string): ReactNode => {
    const clase = seccion === s ? "activo" : undefined;
    const actual = seccion === s ? "page" : undefined;
    if (s === "inicio") {
      return enRaiz
        ? <a href="#" className={clase} aria-current={actual} onClick={(e: MouseEvent) => { cerrar(); if (!window.location.hash || window.location.hash === "#") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>{texto}</a>
        : <Link to="/" className={clase} aria-current={actual} onClick={() => { cerrar(); arriba(); }}>{texto}</Link>;
    }
    if (s === "desarrollos") {
      return enRaiz
        ? <a href="#desarrollos" className={clase} aria-current={actual} onClick={cerrar}>{texto}</a>
        : <Link to="/#desarrollos" className={clase} aria-current={actual} onClick={cerrar}>{texto}</Link>;
    }
    return <Link to={`/${s}`} className={clase} aria-current={actual} onClick={() => { cerrar(); arriba(); }}>{texto}</Link>;
  };

  const marca = logo ? <img src={urlMedio(logo)} alt="ZF Propiedades" /> : <b>ZF Propiedades</b>;
  return (
    <header className={["barra-nav", blanca ? "blanca" : "", abierto ? "abierta" : ""].filter(Boolean).join(" ")}>
      <div className="in col amplia gut">
        {enRaiz
          ? <a className="logo" href="#" aria-label="Inicio" onClick={cerrar}>{marca}</a>
          : <Link className="logo" to="/" aria-label="Inicio" onClick={() => { cerrar(); arriba(); }}>{marca}</Link>}
        <button type="button" className="menu" aria-expanded={abierto} aria-controls="barra-nav-enlaces" onClick={() => setAbierto((x) => !x)}>
          <span className="rayas" aria-hidden="true"><i /><i /><i /></span>Menú
        </button>
        <nav id="barra-nav-enlaces" aria-label="Secciones">
          {enlace("inicio", "Inicio")}
          {enlace("desarrollos", "Desarrollos")}
          {enlace("terceros", "Terceros")}
          {enlace("comercios", "Locales / oficinas")}
          {cuenta ? (
            <span className="cuenta">
              <span className="quien">{cuenta.nombre.trim().split(/\s+/)[0]}</span>
              <button type="button" onClick={() => { cerrar(); salir(); }}>Salir</button>
            </span>
          ) : puedeIngresar ? (
            <span className="cuenta"><button type="button" onClick={() => { cerrar(); abrirIngreso(); }}>Ingresar</button></span>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

/** Circulito «volver arriba»: aparece cuando ya se bajó un poco. */
export function BotonArriba() {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const medir = () => setVer(window.scrollY > Math.max(500, window.innerHeight * 0.8));
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);
  return (
    <button type="button" className={ver ? "boton-arriba ver" : "boton-arriba"} aria-label="Volver arriba" title="Volver arriba"
            tabIndex={ver ? 0 : -1} aria-hidden={!ver} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
