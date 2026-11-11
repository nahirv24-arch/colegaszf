import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router";
import { Ficha } from "../../paginas/Ficha";
import { ProveedorDatos, useEstadoDatos } from "../../servicios/contexto";
import type { FuenteDatos } from "../../servicios/fuente";
import { urlPublicaMedia } from "../../servicios/supabase";
import { contenidoBorrador } from "../servicio";
import { Cargando, ErrorCaja } from "../ui";

/** Fuente que lee el BORRADOR (copia de trabajo) desde Supabase. Solo funciona con sesión de admin. */
const fuenteBorrador: FuenteDatos = {
  async cargar() {
    const r = await contenidoBorrador();
    return { sitio: r.sitio, logo: r.logo, medios: new Map(r.medios.map((m) => [m.ruta, m])) };
  },
  urlMedio: (ruta) => urlPublicaMedia(ruta),
};

/** Muestra la ficha EXACTAMENTE como la verían los colegas, pero con lo guardado en el borrador. */
export function VistaPrevia() {
  const { id = "" } = useParams();
  const fuente = useMemo(() => fuenteBorrador, []);
  // Fondo blanco como en la página real (el panel usa un fondo crema).
  useEffect(() => { document.body.classList.remove("adm-body"); return () => document.body.classList.add("adm-body"); }, []);
  return (
    <div className="adm-vista-previa">
      <div className="adm-vp-banda" role="note">
        <span><b>Vista previa del borrador</b> — así se verá al publicar. Los colegas todavía ven la versión publicada.</span>
        <Link to={`/admin/desarrollos/${id}`}>Volver al panel</Link>
      </div>
      <ProveedorDatos fuente={fuente}><Contenido id={id} /></ProveedorDatos>
    </div>
  );
}

function Contenido({ id }: { readonly id: string }) {
  const estado = useEstadoDatos();
  if (estado.tipo === "cargando") return <Cargando texto="Armando la vista previa…" />;
  if (estado.tipo === "error") return <ErrorCaja texto={estado.mensaje} />;
  const e = estado.contenido.sitio.emprendimientos.find((x) => x.id === id);
  if (!e) return <ErrorCaja texto="No se encontró ese desarrollo (¿está en la papelera?)." />;
  return <Ficha e={e} logo={estado.contenido.logo} />;
}
