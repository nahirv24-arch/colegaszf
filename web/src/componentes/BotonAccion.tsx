import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  /** Texto mientras trabaja, por ejemplo "Armando el archivo…". */
  readonly trabajando: string;
  /** Texto si falla (se muestra 4 segundos, como el original). */
  readonly error: string;
  readonly accion: () => Promise<void>;
}

/** Botón con estilo "vínculo" para descargas que tardan (ZIP y PDF). */
export function BotonAccion({ children, trabajando, error, accion }: Props) {
  const [estado, setEstado] = useState<"listo" | "trabajando" | "error">("listo");
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const tocar = () => {
    if (estado === "trabajando") return;
    setEstado("trabajando");
    accion().then(
      () => { if (vivo.current) setEstado("listo"); },
      () => {
        if (!vivo.current) return;
        setEstado("error");
        setTimeout(() => { if (vivo.current) setEstado("listo"); }, 4000);
      },
    );
  };

  return (
    <button className="vinculo" type="button" disabled={estado === "trabajando"} onClick={tocar}>
      {estado === "trabajando" ? trabajando : estado === "error" ? error : children}
    </button>
  );
}
