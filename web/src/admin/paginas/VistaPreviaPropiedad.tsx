import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router";
import { FichaPropiedad } from "../../paginas/FichaPropiedad";
import { ProveedorDatos, useEstadoDatos } from "../../servicios/contexto";
import type { FuenteDatos } from "../../servicios/fuente";
import { urlPublicaMedia } from "../../servicios/supabase";
import { contenidoBorrador } from "../servicio";
import { propiedadBorrador } from "../servicioPropiedades";
import { Cargando, ErrorCaja } from "../ui";

/** Muestra la ficha EXACTAMENTE como la verían los colegas, pero con lo guardado en el borrador. */
export function VistaPreviaPropiedad() {
  const { id = "" } = useParams();
  const fuente = useMemo<FuenteDatos>(() => ({
    async cargar() {
      const [general, r] = await Promise.all([contenidoBorrador(), propiedadBorrador(id)]);
      const lista = r ? [r.propiedad] : [];
      return {
        sitio: general.sitio, logo: general.logo,
        medios: new Map([...general.medios, ...(r?.medios ?? [])].map((m) => [m.ruta, m])),
        propiedades: { terceros: lista.filter((p) => p.categoria === "tercero"), comercios: lista.filter((p) => p.categoria === "comercio") },
      };
    },
    urlMedio: (ruta) => urlPublicaMedia(ruta),
  }), [id]);
  useEffect(() => { document.body.classList.remove("adm-body"); return () => document.body.classList.add("adm-body"); }, []);
  return (
    <div className="adm-vista-previa">
      <ProveedorDatos fuente={fuente}><Contenido id={id} /></ProveedorDatos>
    </div>
  );
}

function Contenido({ id }: { readonly id: string }) {
  const estado = useEstadoDatos();
  if (estado.tipo === "cargando") return <Cargando texto="Armando la vista previa…" />;
  if (estado.tipo === "error") return <ErrorCaja texto={estado.mensaje} />;
  const { terceros, comercios } = estado.contenido.propiedades;
  const p = [...terceros, ...comercios].find((x) => x.id === id);
  if (!p) return <ErrorCaja texto="No se encontró esa propiedad." />;
  const clave = p.categoria === "tercero" ? "terceros" : "comercios";
  return (
    <>
      <div className="adm-vp-banda" role="note">
        <span><b>Vista previa del borrador</b> — así se verá al publicar. Los colegas todavía ven la versión publicada (si existe).</span>
        <Link to={`/admin/${clave}/${id}`}>Volver al panel</Link>
      </div>
      <FichaPropiedad p={p} logo={estado.contenido.logo} volver={clave === "terceros" ? "Todas las propiedades de terceros" : "Todos los comercios"} />
    </>
  );
}
