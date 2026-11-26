import { Categorias } from "../componentes/Categorias";
import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TarjetaDesarrollo } from "../componentes/TarjetaDesarrollo";
import type { ContenidoPublico } from "../servicios";
import { idDe } from "../utilidades/orden";
import { fecha } from "../utilidades/textos";

/** Inicio: portada general + las tres categorías + grilla de desarrollos ordenada por material. */
export function Inicio({ contenido }: { readonly contenido: ContenidoPublico }) {
  const { sitio, logo } = contenido;
  const lista = sitio.emprendimientos.filter((e) => e.publicado !== false);
  return (
    <>
      <Portada foto={sitio.portada} logo={logo} rotulo="ZF Propiedades" amplia
               titular={<><em>Bienvenidos, colegas.</em><br />Todo el material de nuestros desarrollos, en un solo lugar.</>} />
      <Categorias />
      <main className="seccion col amplia gut" id="desarrollos">
        <div className="cabecera ancha">
          <div className="rot">Desarrollos</div>
          <p>Entrá a cada uno y vas a encontrar el brochure, los planos, los renders, la lista de precios y la lista
            de disponibles. Los links son fijos: guardá esta página y siempre vas a estar viendo la versión vigente.</p>
          <p className="aviso-actualizado">
            <span className="punto" aria-hidden="true" />
            <span>Actualizamos los jueves{sitio.actualizado ? <>{" "}<i aria-hidden="true">·</i><span className="ult">Última actualización <b className="fecha">{fecha(sitio.actualizado)}</b></span></> : null}</span>
          </p>
        </div>
        {!lista.length ? (
          <div className="vacio">
            <div className="sub">Todavía no hay desarrollos cargados</div>
            Estamos preparando el material. Escribinos y te lo pasamos.
          </div>
        ) : (
          <div className="grilla">
            {sitio.emprendimientos.map((e, i) => ({ e, i })) /* orden elegido en el panel («Ordenar la página») */
              .filter(({ e }) => e.publicado !== false)
              .map(({ e, i }) => <TarjetaDesarrollo key={idDe(e, i)} e={e} id={idDe(e, i)} />)}
          </div>
        )}
      </main>
      <Pie />
    </>
  );
}
