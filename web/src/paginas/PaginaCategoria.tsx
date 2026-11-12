import { useEffect } from "react";
import { Link } from "react-router";
import { categoria, type ClaveCategoria } from "../componentes/Categorias";
import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TarjetaPropiedad } from "../componentes/TarjetaPropiedad";
import { useEstadoDatos } from "../servicios/contexto";
import { useHash } from "../utilidades/hash";
import { FichaPropiedad } from "./FichaPropiedad";

const TITULO_BASE = "Material para colegas · ZF Propiedades";

/**
 * Página de una categoría (/terceros, /comercios).
 *   /terceros               listado (o «Próximamente» si todavía no hay nada publicado)
 *   /terceros#casa-cerro    ficha de esa propiedad (mismo sistema de links que los desarrollos)
 * El aviso «Próximamente» desaparece solo cuando se publica el primer elemento de la categoría.
 */
export function PaginaCategoria({ clave }: { readonly clave: Exclude<ClaveCategoria, "desarrollos"> }) {
  const estado = useEstadoDatos();
  const hash = useHash();
  const c = categoria(clave);
  const lista = estado.tipo === "listo" ? estado.contenido.propiedades[clave] : [];
  const elegida = hash ? lista.find((p) => p.id.toLowerCase() === hash) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [elegida?.id]);

  useEffect(() => {
    document.title = `${elegida ? `${elegida.titulo} · ` : ""}${c.nombre} · ${TITULO_BASE}`;
  }, [c.nombre, elegida]);
  // Al salir de la categoría, la pestaña vuelve al título general.
  useEffect(() => () => { document.title = TITULO_BASE; }, []);

  if (estado.tipo === "cargando") return null;
  if (estado.tipo === "error") {
    return (
      <main className="seccion col gut">
        <div className="vacio">
          <div className="sub">No pudimos cargar el material</div>
          Probá recargar la página en unos minutos.
        </div>
      </main>
    );
  }
  const portada = estado.tipo === "listo" ? estado.contenido.sitio.portada : "";
  const logo = estado.tipo === "listo" ? estado.contenido.logo : "";

  if (elegida) {
    return (
      <>
        <FichaPropiedad key={elegida.id} p={elegida} logo={logo}
                        volver={clave === "terceros" ? "Todas las propiedades de terceros" : "Todos los locales y oficinas"} />
        <Pie />
      </>
    );
  }

  return (
    <>
      <Portada foto={portada} logo={logo} rotulo="ZF Propiedades" tinta inicio="/" bajo
               titular={<><em>{c.nombre}.</em><br />{c.titular}</>} />
      <main className="seccion col gut">
        <Link className="volver" to="/#categorias"><span aria-hidden="true">&larr;</span> Todas las categorías</Link>
        <div className="cabecera">
          <div className="rot">{c.nombre}</div>
          <p>{c.descripcion}</p>
        </div>
        {lista.length ? (
          <div className="grilla">
            {lista.map((p) => <TarjetaPropiedad key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="vacio proximamente">
            <h2 className="sub">Próximamente</h2>
            <p>Estamos preparando el material de esta sección. Muy pronto vas a poder consultarlo acá.</p>
            <Link className="btn" to="/#categorias">Ver todas las categorías</Link>
          </div>
        )}
      </main>
      <Pie />
    </>
  );
}
