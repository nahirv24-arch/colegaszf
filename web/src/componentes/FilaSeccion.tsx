import { useState, type ReactNode } from "react";

interface Props {
  readonly clave: string;
  readonly titulo: string;
  readonly descripcion: string;
  /** Texto de la derecha: "73 unidades", "12 imágenes"… */
  readonly etiqueta: string;
  /** null = no hay material: la fila aparece como "Pendiente". */
  readonly contenido: (() => ReactNode) | null;
}

/**
 * Fila de la ficha que se abre y se cierra (acordeón).
 * El contenido se arma la primera vez que se abre: así las imágenes se piden solo si hacen falta.
 * Después queda armado (oculto) para no perder, por ejemplo, el filtro elegido en la tabla.
 */
export function FilaSeccion({ clave, titulo, descripcion, etiqueta, contenido }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [montada, setMontada] = useState(false);

  if (!contenido) {
    return (
      <div className="fila falta">
        <span className="n">{titulo}</span>
        <span className="d">{descripcion}</span>
        <span className="f">Pendiente</span>
      </div>
    );
  }

  return (
    <>
      <button className="fila" type="button" data-abrir={clave} aria-expanded={abierta}
              aria-controls={`panel-${clave}`}
              onClick={() => { setAbierta(!abierta); setMontada(true); }}>
        <span className="n">{titulo}</span>
        <span className="d">{descripcion}</span>
        <span className="f">{etiqueta} <span aria-hidden="true">{abierta ? "–" : "+"}</span></span>
      </button>
      <div className="panel-fila" id={`panel-${clave}`} hidden={!abierta}>
        {montada ? contenido() : null}
      </div>
    </>
  );
}
