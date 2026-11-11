import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RutaMedio } from "../tipos/datos";
import { fuente as fuentePorDefecto, type ContenidoPublico, type FuenteDatos } from "./index";

type Estado =
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error"; readonly mensaje: string }
  | { readonly tipo: "listo"; readonly contenido: ContenidoPublico };

interface ValorContexto {
  readonly estado: Estado;
  readonly fuente: FuenteDatos;
}

const Contexto = createContext<ValorContexto>({ estado: { tipo: "cargando" }, fuente: fuentePorDefecto });

/**
 * Carga los datos y los pone a disposición de los componentes.
 * `fuente` permite usar otra fuente (por ejemplo, la vista previa del panel lee el borrador
 * desde Supabase); si no se indica, se usa la de servicios/index.ts.
 */
export function ProveedorDatos({ children, fuente = fuentePorDefecto }: { readonly children: ReactNode; readonly fuente?: FuenteDatos }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  useEffect(() => {
    let vivo = true;
    setEstado({ tipo: "cargando" });
    fuente.cargar().then(
      (contenido) => { if (vivo) setEstado({ tipo: "listo", contenido }); },
      (e: unknown) => { if (vivo) setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { vivo = false; };
  }, [fuente]);
  return <Contexto.Provider value={{ estado, fuente }}>{children}</Contexto.Provider>;
}

export function useEstadoDatos(): Estado {
  return useContext(Contexto).estado;
}

/** Convierte una ruta de los datos en una dirección que el navegador puede abrir. */
export function useUrlMedio(): (ruta: RutaMedio) => string {
  const { fuente } = useContext(Contexto);
  return (ruta) => fuente.urlMedio(ruta);
}

/** Dirección de un archivo + sus medidas (para reservar el espacio y evitar saltos). */
export function useMedio() {
  const { estado, fuente } = useContext(Contexto);
  const medios = estado.tipo === "listo" ? estado.contenido.medios : undefined;
  return (ruta: RutaMedio) => {
    const info = medios?.get(ruta);
    return { src: fuente.urlMedio(ruta), ancho: info?.ancho ?? undefined, alto: info?.alto ?? undefined };
  };
}
