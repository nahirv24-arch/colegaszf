import type { ReactNode } from "react";
import { useUrlMedio } from "../servicios/contexto";
import type { RutaMedio } from "../tipos/datos";
import { Imagen } from "./Imagen";

interface Props {
  readonly foto: RutaMedio;
  readonly logo: RutaMedio;
  readonly rotulo: string;
  readonly titular: ReactNode;
  /** Portada de inicio: foto en blanco y negro con tinte azul. */
  readonly tinta?: boolean;
}

/** Cabecera a sangre con foto, logo, rótulo y titular (inicio y fichas). */
export function Portada({ foto, logo, rotulo, titular, tinta = false }: Props) {
  const urlMedio = useUrlMedio();
  const clases = ["portada", foto ? "" : "lisa", tinta ? "tinta" : ""].filter(Boolean).join(" ");
  return (
    <header className={clases}>
      {foto ? <Imagen ruta={foto} prioritaria /> : null}
      {foto && tinta ? <div className="tinte" /> : null}
      <div className="sombra" />
      <div className="caja col gut">
        <a className="marca" href="#" aria-label="Inicio">
          <img src={urlMedio(logo)} alt="ZF Propiedades" />
        </a>
        <div className="pie-txt">
          <div className="rot claro">{rotulo}</div>
          <h1 className="display">{titular}</h1>
        </div>
      </div>
    </header>
  );
}
