import type { Propiedad } from "../tipos/datos";
import { DISPONIBILIDAD, OPERACION } from "../utilidades/propiedades";
import { Imagen } from "./Imagen";

/** Tarjeta de Terceros / Comercios (mismo diseño que la de los desarrollos). */
export function TarjetaPropiedad({ p }: { readonly p: Propiedad }) {
  const linea = [OPERACION[p.operacion], p.precio].filter(Boolean).join(" · ");
  const lugar = [p.barrio, p.direccion].filter(Boolean).join(" · ");
  return (
    <a className="tarjeta" href={`#${p.id}`}>
      <div className="foto">
        {p.portada ? <Imagen ruta={p.portada} diferida /> : <div className="sinfoto">Sin imagen</div>}
        {p.disponibilidad !== "disponible"
          ? <span className="estado-prop">{DISPONIBILIDAD[p.disponibilidad]}</span> : null}
      </div>
      <div className="nom">{p.titulo}</div>
      <div className="pos">{linea || "Precio a consultar"}</div>
      <div className="des">{lugar || " "}</div>
      <div className="ir">Ver material <span aria-hidden="true">&rarr;</span></div>
    </a>
  );
}
