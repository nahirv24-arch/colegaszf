import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RutaMedio } from "../tipos/datos";
import { fuente, type ContenidoPublico } from "./index";

type Estado =
  | { readonly tipo: "cargando" }
  | { readonly tipo: "error"; readonly mensaje: string }
  | { readonly tipo: "listo"; readonly contenido: ContenidoPublico };

const Contexto = createContext<Estado>({ tipo: "cargando" });

export function ProveedorDatos({ children }: { readonly children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  useEffect(() => {
    let vivo = true;
    fuente.cargar().then(
      (contenido) => { if (vivo) setEstado({ tipo: "listo", contenido }); },
      (e: unknown) => { if (vivo) setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { vivo = false; };
  }, []);
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useEstadoDatos(): Estado {
  return useContext(Contexto);
}

/** Dirección de un archivo + sus medidas (para reservar el espacio y evitar saltos). */
export function useMedio() {
  const estado = useContext(Contexto);
  const medios = estado.tipo === "listo" ? estado.contenido.medios : undefined;
  return (ruta: RutaMedio) => {
    const info = medios?.get(ruta);
    return { src: fuente.urlMedio(ruta), ancho: info?.ancho ?? undefined, alto: info?.alto ?? undefined };
  };
}

export const urlMedio = (ruta: RutaMedio): string => fuente.urlMedio(ruta);
