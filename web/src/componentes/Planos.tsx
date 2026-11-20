import { useMedio, useUrlMedio } from "../servicios/contexto";
import type { Desarrollo, PlanoInfo, RutaMedio } from "../tipos/datos";
import { bajarArchivo, bajarZipConNombres } from "../utilidades/descargas";
import { esPdfPlano, etiquetaPlano, nombresArchivosPlanos, paraArchivo, tituloPlano } from "../utilidades/planos";
import { BotonAccion } from "./BotonAccion";

/** Datos de los planos: los publicados (etapa 3) o, para planos viejos, los armados desde la lista de imágenes. */
export function infoPlanos(e: Desarrollo): readonly PlanoInfo[] {
  const planos = e.planos ?? [];
  if (e.planosInfo && e.planosInfo.length === planos.length) return e.planosInfo;
  return planos.map((ruta) => ({ ruta, vista: "", vistaAncho: 0, vistaAlto: 0, nombre: "", tipologia: "", variante: "", formato: "", bytes: 0 }));
}

/** Lo que se muestra en pantalla: la miniatura, o el original si es una imagen. "" = PDF sin miniatura. */
export const rutaVisible = (p: PlanoInfo): RutaMedio => p.vista || (esPdfPlano(p) ? "" : p.ruta);

interface Props {
  readonly e: Desarrollo;
  /** Abre el visor con las miniaturas (índices de `visibles`) y la descarga del original de cada una. */
  readonly onAbrir: (visibles: readonly PlanoInfo[], n: number, nombres: readonly string[]) => void;
}

/**
 * Sección «Planos» de la ficha: miniaturas con la etiqueta de tipología superpuesta (es parte de la
 * página, el archivo no se modifica), descarga del ORIGINAL de cada plano y de todos juntos en ZIP.
 */
export function Planos({ e, onAbrir }: Props) {
  const urlMedio = useUrlMedio();
  const medio = useMedio();
  const planos = infoPlanos(e);
  const nombres = nombresArchivosPlanos(e.nombre, planos);
  const visibles = planos.filter((p) => rutaVisible(p));
  const nombresVisibles = planos.map((p, i) => (rutaVisible(p) ? nombres[i]! : null)).filter((n): n is string => n !== null);
  const hayPdf = planos.some(esPdfPlano);

  return (
    <>
      <div className="vinculos">
        <BotonAccion trabajando="Preparando los planos…" error="No se pudo armar el archivo — probá con internet"
                     accion={() => bajarZipConNombres(planos.map((p, i) => ({ url: urlMedio(p.ruta), nombre: nombres[i]! })),
                                                      `${paraArchivo(e.nombre) || "ZF"}_Planos.zip`)}>
          Descargar todos los planos <span aria-hidden="true">&darr;</span>
        </BotonAccion>
        <span className="pista">{hayPdf ? "Archivos originales, en máxima calidad" : "o descargá cada plano por separado"}</span>
      </div>
      <ul className="galeria planos lista-planos">
        {planos.map((p, i) => {
          const visible = rutaVisible(p);
          const etiqueta = etiquetaPlano(p);
          const titulo = tituloPlano(p, i);
          const pdf = esPdfPlano(p);
          const dim = p.vista ? { ancho: p.vistaAncho || undefined, alto: p.vistaAlto || undefined } : medio(p.ruta);
          const n = visible ? visibles.indexOf(p) : -1;
          return (
            <li key={`${i}-${p.ruta}`} className="plano">
              {visible ? (
                <button type="button" aria-label={`Ampliar ${titulo}`} onClick={() => onAbrir(visibles, n, nombresVisibles)}>
                  <img src={urlMedio(visible)} alt="" width={dim.ancho} height={dim.alto} loading="lazy" decoding="async" />
                  {etiqueta ? <span className="etiqueta-plano">{etiqueta}</span> : null}
                </button>
              ) : (
                <a className="plano-sin-vista" href={urlMedio(p.ruta)} target="_blank" rel="noopener" aria-label={`Abrir ${titulo} (PDF)`}>
                  <span>PDF</span>
                  {etiqueta ? <span className="etiqueta-plano">{etiqueta}</span> : null}
                </a>
              )}
              <div className="plano-pie">
                <span className="plano-titulo">{titulo}</span>
                <BotonAccion trabajando="Descargando…" error="No se pudo descargar — probá de nuevo"
                             accion={() => bajarArchivo(urlMedio(p.ruta), nombres[i]!)}>
                  {pdf ? "Descargar PDF" : "Descargar imagen"} <span aria-hidden="true">&darr;</span>
                </BotonAccion>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
