import type { Desarrollo } from "../tipos/datos";
import { Imagen } from "./Imagen";

interface Props {
  readonly e: Desarrollo;
  readonly id: string;
}

/** Tarjeta del inicio: foto, nombre, posesión, dirección y "Ver material". */
export function TarjetaDesarrollo({ e, id }: Props) {
  return (
    <a className={e.desactualizado ? "tarjeta pendiente" : "tarjeta"} href={`#${id}`}>
      <div className="foto">
        {e.portada ? <Imagen ruta={e.portada} diferida /> : <div className="sinfoto">Sin imagen</div>}
        {e.desactualizado ? <span className="pendiente-et">Pendiente de actualización</span> : null}
      </div>
      <div className="nom">{e.nombre}</div>
      <div className="pos">Posesión: {e.posesion ? e.posesion : "a confirmar"}</div>
      <div className="des">{e.direccion ? e.direccion : e.desarrollista ? e.desarrollista : " "}</div>
      <div className="ir">Ver material <span aria-hidden="true">&rarr;</span></div>
    </a>
  );
}
