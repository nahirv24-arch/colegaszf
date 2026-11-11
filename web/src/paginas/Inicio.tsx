import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TarjetaDesarrollo } from "../componentes/TarjetaDesarrollo";
import type { ContenidoPublico } from "../servicios";
import { idDe, ordenarPorMaterial } from "../utilidades/orden";
import { fecha } from "../utilidades/textos";

/** Inicio: portada general + grilla de desarrollos ordenada por material. */
export function Inicio({ contenido }: { readonly contenido: ContenidoPublico }) {
  const { sitio, logo } = contenido;
  const lista = sitio.emprendimientos.filter((e) => e.publicado !== false);
  return (
    <>
      <Portada foto={sitio.portada} logo={logo} rotulo="ZF Propiedades" tinta
               titular={<><em>Bienvenidos, colegas.</em><br />Todo el material de nuestros desarrollos, en un solo lugar.</>} />
      <main className="seccion col gut">
        <div className="cabecera">
          <div className="rot">Desarrollos</div>
          <p>Entrá a cada uno y vas a encontrar el brochure, los planos, los renders, la lista de precios y la lista
            de disponibles. Los links son fijos: guardá esta página y siempre vas a estar viendo la versión vigente.
            Actualizamos los jueves{sitio.actualizado ? ` — la última fue el ${fecha(sitio.actualizado)}` : ""}.</p>
        </div>
        {!lista.length ? (
          <div className="vacio">
            <div className="sub">Todavía no hay desarrollos cargados</div>
            Estamos preparando el material. Escribinos y te lo pasamos.
          </div>
        ) : (
          <div className="grilla">
            {ordenarPorMaterial(sitio.emprendimientos)
              .filter(({ e }) => e.publicado !== false)
              .map(({ e, i }) => <TarjetaDesarrollo key={idDe(e, i)} e={e} id={idDe(e, i)} />)}
          </div>
        )}
      </main>
      <Pie />
    </>
  );
}
