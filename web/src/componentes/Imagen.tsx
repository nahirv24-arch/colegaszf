import { useMedio } from "../servicios/contexto";
import type { RutaMedio } from "../tipos/datos";

interface Props {
  readonly ruta: RutaMedio;
  readonly alt?: string;
  /** true = la carga cuando está por aparecer en pantalla. */
  readonly diferida?: boolean;
  /** true = es la imagen principal de la pantalla (portada): se pide primero. */
  readonly prioritaria?: boolean;
}

/** Una imagen de media/ con sus medidas reales (para que la página no "salte" al cargar). */
export function Imagen({ ruta, alt = "", diferida = false, prioritaria = false }: Props) {
  const medio = useMedio()(ruta);
  return (
    <img
      src={medio.src}
      alt={alt}
      width={medio.ancho}
      height={medio.alto}
      loading={diferida ? "lazy" : "eager"}
      decoding="async"
      fetchPriority={prioritaria ? "high" : undefined}
    />
  );
}
