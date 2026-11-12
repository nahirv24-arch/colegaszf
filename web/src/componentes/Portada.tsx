import type { ReactNode } from "react";
import { Link } from "react-router";
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
  /** Fuera de "/" (páginas de categoría): el logo vuelve al inicio con esta dirección. */
  readonly inicio?: string;
  /** Portada más baja (páginas de categoría). */
  readonly bajo?: boolean;
}

/** Cabecera a sangre con foto, logo, rótulo y titular (inicio, fichas y categorías). */
export function Portada({ foto, logo, rotulo, titular, tinta = false, inicio, bajo = false }: Props) {
  const urlMedio = useUrlMedio();
  const clases = ["portada", foto ? "" : "lisa", tinta ? "tinta" : "", bajo ? "baja" : ""].filter(Boolean).join(" ");
  const marca = logo ? <img src={urlMedio(logo)} alt="ZF Propiedades" /> : <b>ZF Propiedades</b>;
  return (
    <header className={clases}>
      {foto ? <Imagen ruta={foto} prioritaria /> : null}
      {foto && tinta ? <div className="tinte" /> : null}
      <div className="sombra" />
      <div className="caja col gut">
        {inicio
          ? <Link className="marca" to={inicio} aria-label="Inicio">{marca}</Link>
          : <a className="marca" href="#" aria-label="Inicio">{marca}</a>}
        <div className="pie-txt">
          <div className="rot claro">{rotulo}</div>
          <h1 className="display">{titular}</h1>
        </div>
      </div>
    </header>
  );
}
