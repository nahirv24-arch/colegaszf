import { useCallback, useEffect, useState } from "react";
import { urlMedio } from "../servicios/contexto";
import type { RutaMedio } from "../tipos/datos";
import { bajarImagen } from "../utilidades/descargas";

interface Props {
  readonly lista: readonly RutaMedio[];
  readonly inicio: number;
  readonly onCerrar: () => void;
}

/** Visor a pantalla completa: flechas, teclado (← → Esc), contador y descarga de la imagen. */
export function Visor({ lista, inicio, onCerrar }: Props) {
  const [n, setN] = useState(inicio);
  const total = lista.length;
  const ver = useCallback((k: number) => setN(((k % total) + total) % total), [total]);

  useEffect(() => {
    const teclas = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
      else if (ev.key === "ArrowLeft") setN((x) => (x - 1 + total) % total);
      else if (ev.key === "ArrowRight") setN((x) => (x + 1) % total);
    };
    document.addEventListener("keydown", teclas);
    return () => document.removeEventListener("keydown", teclas);
  }, [onCerrar, total]);

  const ruta = lista[n];
  if (ruta === undefined) return null;
  const src = urlMedio(ruta);

  return (
    <div className="visor" onClick={(ev) => {
      const t = ev.target as HTMLElement;
      if (t === ev.currentTarget || t.tagName === "IMG") onCerrar();
    }}>
      <button className="cerrar" type="button" aria-label="Cerrar" onClick={onCerrar}>&times;</button>
      <button className="nav izq" type="button" aria-label="Anterior"
              onClick={(ev) => { ev.stopPropagation(); ver(n - 1); }}>&lsaquo;</button>
      <img alt="" src={src} />
      <button className="nav der" type="button" aria-label="Siguiente"
              onClick={(ev) => { ev.stopPropagation(); ver(n + 1); }}>&rsaquo;</button>
      <div className="bajar">
        <button type="button" onClick={(ev) => {
          ev.stopPropagation();
          // Mismo nombre que el original: "imagen-<número>".
          void bajarImagen(src, `imagen-${n + 1}`);
        }}>Descargar esta imagen</button>
      </div>
      <div className="cuenta">{n + 1} / {total}</div>
    </div>
  );
}
