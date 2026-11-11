import { urlMedio } from "../servicios/contexto";
import type { RutaMedio } from "../tipos/datos";
import { bajarZip } from "../utilidades/descargas";
import { BotonAccion } from "./BotonAccion";
import { Imagen } from "./Imagen";

interface Props {
  readonly lista: readonly RutaMedio[];
  /** Nombre base del ZIP, por ejemplo "Reggia-6-imagenes" (igual que el original). */
  readonly nombreZip: string;
  /** Planos y páginas de brochure: se muestran enteros sobre blanco. */
  readonly plano?: boolean;
  readonly onAbrir: (n: number) => void;
}

/** Grilla de imágenes con "Descargar todas" (ZIP) y apertura en el visor. */
export function Galeria({ lista, nombreZip, plano = false, onAbrir }: Props) {
  return (
    <>
      <div className="vinculos">
        <BotonAccion
          trabajando="Armando el archivo…"
          error="No se pudo armar el archivo — probá con internet"
          accion={() => bajarZip(lista.map(urlMedio), nombreZip)}
        >
          Descargar todas <span aria-hidden="true">&darr;</span>
        </BotonAccion>
        <span className="pista">o tocá una imagen y descargala sola</span>
      </div>
      <div className={plano ? "galeria planos" : "galeria"}>
        {lista.map((ruta, n) => (
          <button key={`${n}-${ruta}`} type="button" aria-label={`Ampliar imagen ${n + 1}`} onClick={() => onAbrir(n)}>
            <Imagen ruta={ruta} diferida />
          </button>
        ))}
      </div>
    </>
  );
}
