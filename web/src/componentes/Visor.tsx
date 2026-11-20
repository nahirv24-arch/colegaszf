import { useCallback, useEffect, useState } from "react";
import { useUrlMedio } from "../servicios/contexto";
import type { RutaMedio } from "../tipos/datos";
import { bajarArchivo, bajarImagen, bajarPlanoPdf } from "../utilidades/descargas";

/** Qué se descarga desde el visor cuando lo que se ve NO es el archivo original (por ejemplo, la miniatura de un PDF). */
export interface DescargaVisor {
  /** Archivo original. */
  readonly ruta: RutaMedio;
  /** Nombre con extensión ("Reggia-6_Plano_2-dormitorios-Tipo-C.pdf"). */
  readonly nombre: string;
  /** Texto del botón ("Descargar PDF"). */
  readonly texto: string;
  /** Si el original es una imagen, se descarga pasado a PDF (planos). */
  readonly comoPdf?: boolean;
}

interface Props {
  readonly lista: readonly RutaMedio[];
  readonly inicio: number;
  readonly onCerrar: () => void;
  /** Opcional, alineado con `lista`: descarga del original en lugar de la imagen que se ve. */
  readonly descargas?: readonly DescargaVisor[];
  /** Opcional, alineado con `lista`: rótulo que se muestra abajo (por ejemplo, la tipología del plano). */
  readonly rotulos?: readonly string[];
}

/** Visor a pantalla completa: flechas, teclado (← → Esc), contador y descarga de la imagen. */
export function Visor({ lista, inicio, onCerrar, descargas, rotulos }: Props) {
  const urlMedio = useUrlMedio();
  const [n, setN] = useState(inicio);
  const [bajando, setBajando] = useState(false);
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
  const descarga = descargas?.[n];
  const rotulo = rotulos?.[n];

  const bajar = () => {
    if (bajando) return;
    setBajando(true);
    // Sin datos propios: mismo nombre que el original ("imagen-<número>").
    const tarea = !descarga ? bajarImagen(src, `imagen-${n + 1}`)
      : descarga.comoPdf ? bajarPlanoPdf(urlMedio(descarga.ruta), descarga.nombre, rotulo ?? "")
      : bajarArchivo(urlMedio(descarga.ruta), descarga.nombre);
    tarea.catch(() => undefined).finally(() => setBajando(false));
  };

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
        {rotulo ? <span className="rotulo-visor">{rotulo}</span> : null}
        <button type="button" disabled={bajando} onClick={(ev) => { ev.stopPropagation(); bajar(); }}>
          {bajando ? "Descargando…" : descarga ? descarga.texto : "Descargar esta imagen"}
        </button>
      </div>
      <div className="cuenta">{n + 1} / {total}</div>
    </div>
  );
}
