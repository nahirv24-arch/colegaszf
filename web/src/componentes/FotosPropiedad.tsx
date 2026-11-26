import { useEffect, useState } from "react";
import { useMedio, useUrlMedio } from "../servicios/contexto";
import { fijarLugar } from "../servicios/cuenta";
import type { Propiedad } from "../tipos/datos";
import { bajarArchivo, bajarZipConNombres } from "../utilidades/descargas";
import { nombresArchivosFotos, nombreZipFotos } from "../utilidades/fotosPropiedad";
import { BotonAccion } from "./BotonAccion";
import { Visor } from "./Visor";

/**
 * Fotos de una propiedad de Terceros (o de un local / oficina), dentro de la tabla:
 * miniaturas, visor, descarga de cada foto y de todas juntas en ZIP. Siempre los archivos ORIGINALES.
 */
export function FotosPropiedad({ p }: { readonly p: Propiedad }) {
  const urlMedio = useUrlMedio();
  const medio = useMedio();
  const [visor, setVisor] = useState<number | null>(null);
  // Métricas: las descargas de acá se anotan como fotos de esta propiedad.
  useEffect(() => {
    fijarLugar({ propiedad: p.id, nombre: p.direccion || p.titulo });
    return () => fijarLugar(null);
  }, [p.id, p.direccion, p.titulo]);
  const fotos = p.fotos ?? [];
  if (!fotos.length) return null;
  const nombres = nombresArchivosFotos(p.categoria, p.direccion, fotos, p.titulo);
  const lugar = p.direccion || p.titulo;

  return (
    <div className="fotos-prop">
      <div className="vinculos">
        <BotonAccion trabajando="Preparando las fotos…" error="No se pudo armar el archivo — probá con internet"
                     accion={() => bajarZipConNombres(fotos.map((r, i) => ({ url: urlMedio(r), nombre: nombres[i]! })),
                                                      nombreZipFotos(p.categoria, p.direccion, p.titulo))}>
          Descargar todas las fotos <span aria-hidden="true">&darr;</span>
        </BotonAccion>
        <span className="pista">{fotos.length} {fotos.length === 1 ? "foto" : "fotos"} en calidad original</span>
      </div>
      <ul className="lista-fotos-prop">
        {fotos.map((r, i) => {
          const dim = medio(r);
          return (
            <li key={`${i}-${r}`}>
              <button type="button" aria-label={`Ampliar foto ${i + 1} de ${lugar}`} onClick={() => setVisor(i)}>
                <img src={urlMedio(r)} alt="" width={dim.ancho} height={dim.alto} loading="lazy" decoding="async" />
              </button>
              <BotonAccion trabajando="Descargando…" error="No se pudo descargar"
                           accion={() => bajarArchivo(urlMedio(r), nombres[i]!)}>
                Descargar <span aria-hidden="true">&darr;</span>
              </BotonAccion>
            </li>
          );
        })}
      </ul>
      {visor !== null ? (
        <Visor lista={fotos} inicio={visor} onCerrar={() => setVisor(null)}
               descargas={fotos.map((r, i) => ({ ruta: r, nombre: nombres[i]!, texto: "Descargar esta foto" }))} />
      ) : null}
    </div>
  );
}
