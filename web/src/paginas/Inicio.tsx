import { lazy, Suspense, useMemo } from "react";
import { Categorias } from "../componentes/Categorias";
import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TarjetaDesarrollo } from "../componentes/TarjetaDesarrollo";
import type { ContenidoPublico } from "../servicios";
import { idDe } from "../utilidades/orden";
import { fecha } from "../utilidades/textos";

/** El mapa se baja aparte, solo si hay desarrollos con ubicación. */
const MapaDesarrollos = lazy(() => import("../componentes/MapaDesarrollos"));

/** Inicio: portada general + las tres categorías + grilla de desarrollos ordenada por material. */
export function Inicio({ contenido }: { readonly contenido: ContenidoPublico }) {
  const { sitio, logo } = contenido;
  const lista = sitio.emprendimientos.filter((e) => e.publicado !== false);
  const puntos = useMemo(() => sitio.emprendimientos.flatMap((e, i) => {
    const u = e.ubicacion;
    return e.publicado !== false && u && Number.isFinite(u.lat) && Number.isFinite(u.lng)
      ? [{ e, id: idDe(e, i), lat: u.lat, lng: u.lng }] : [];
  }), [sitio.emprendimientos]);
  return (
    <>
      <Portada foto={sitio.portada} logo={logo} rotulo="ZF Propiedades" amplia
               titular={<><em>Bienvenidos, colegas.</em><br />Todo el material de nuestros desarrollos, en un solo lugar.</>} />
      <Categorias />
      <main className="seccion col amplia gut" id="desarrollos">
        <div className="cabecera ancha">
          <div className="rot">Desarrollos</div>
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
      {puntos.length ? (
        <section className="seccion col amplia gut mapa-seccion" id="ubicaciones" aria-labelledby="ubicaciones-tit">
          <div className="cabecera ancha">
            <div className="rot" id="ubicaciones-tit">Ubicaciones</div>
            <p>Dónde está cada desarrollo. Tocá un pin para ver la ficha o cómo llegar.</p>
          </div>
          <Suspense fallback={<div className="mapa-zf cargando" aria-hidden="true" />}>
            <MapaDesarrollos puntos={puntos} />
          </Suspense>
        </section>
      ) : null}
      <Pie />
    </>
  );
}
