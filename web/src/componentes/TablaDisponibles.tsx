import { useEffect, useState, type ReactNode } from "react";
import type { Desarrollo, Unidad } from "../tipos/datos";
import { COLUMNAS_POR_DEFECTO, celda, hayTexto } from "../utilidades/textos";

/** Columnas con montos (precio, contado, anticipo, cuotas…): se muestran tapadas hasta tocar «Ver precio». */
const MONTO = /precio|contado|anticipo|cuota|financ/i;
/** Valores que son montos aunque la columna se llame distinto (p. ej. «Entrega: USD 20.000»). */
const VALOR_MONTO = /USD|U\$S|\$|\d{1,3}(\.\d{3})+/i;

interface Props {
  readonly e: Desarrollo;
}

/**
 * Tabla de unidades disponibles: columnas propias de cada desarrollo, bandas por torre/grupo,
 * filtro por grupo, corte por piso y nota al pie. Los valores se muestran tal cual vienen.
 */
export function TablaDisponibles({ e }: Props) {
  const filas: readonly Unidad[] = e.disponibles ?? [];
  const [filtro, setFiltro] = useState("");
  // Fila cuyo precio está a la vista (una sola por vez, para que una captura no muestre la lista entera).
  const [vista, setVista] = useState<number | null>(null);
  // Con un precio a la vista, el siguiente clic (en cualquier lugar) vuelve a la lista. También Escape.
  useEffect(() => {
    if (vista === null) return;
    const volver = (ev: Event) => {
      if (ev instanceof KeyboardEvent && ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      setVista(null);
    };
    // Se registra después del clic que abrió el precio, para que ese mismo clic no lo cierre.
    const id = window.setTimeout(() => {
      document.addEventListener("click", volver, true);
      document.addEventListener("keydown", volver);
    });
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", volver, true);
      document.removeEventListener("keydown", volver);
    };
  }, [vista]);
  if (!filas.length) return null;
  const COLS = e.columnas && e.columnas.length ? e.columnas : COLUMNAS_POR_DEFECTO;
  const esMonto = (f: Unidad, k: string, t: string) => {
    const v = celda(f, k);
    if (v === "—" || k === "unidad" || k === "estado" || k === "piso") return false;
    return MONTO.test(k) || MONTO.test(t) || (VALOR_MONTO.test(v) && !/m²|m2/i.test(v));
  };

  const grupos: string[] = [];
  for (const f of filas) if (f.grupo && !grupos.includes(f.grupo)) grupos.push(f.grupo);
  const oculta = (g: string | undefined) => !!filtro && g !== filtro;

  const cuerpo: ReactNode[] = [];
  let grupoActual: string | null = null;
  let pisoActual: string | undefined | null = null;
  filas.forEach((f, idx) => {
    if (f.grupo && f.grupo !== grupoActual) {
      grupoActual = f.grupo;
      pisoActual = null;
      const g = grupoActual;
      const n = filas.filter((x) => x.grupo === g).length;
      cuerpo.push(
        <tr key={`b-${idx}`} className="banda" data-grupo={g} hidden={oculta(g)}>
          <th colSpan={COLS.length}>{g} <span>{n} unidades</span></th>
        </tr>,
      );
    }
    const nuevoPiso = f.piso !== undefined && f.piso !== pisoActual;
    if (nuevoPiso) pisoActual = f.piso;
    cuerpo.push(
      <tr key={idx} className={[nuevoPiso ? "corte" : "", vista === idx ? "con-precio" : ""].join(" ").trim() || undefined} data-grupo={f.grupo || undefined}
          hidden={oculta(f.grupo)}>
        {COLS.map(([k, t], j) => {
          if (vista !== idx && esMonto(f, k, t)) {
            // El valor real no se escribe en la página hasta tocar el botón (tampoco borroso).
            return (
              <td key={j} className="num">
                {!COLS.slice(0, j).some(([k2, t2]) => esMonto(f, k2, t2)) ? (
                  <button type="button" className="ver-precio" onClick={() => setVista(idx)}
                          aria-label={`Ver precio de la unidad ${celda(f, "unidad")}`}>Ver precio</button>
                ) : <span className="precio-oculto" aria-hidden="true">••••••</span>}
              </td>
            );
          }
          if (k === "piso") return <td key={j} className="piso">{nuevoPiso ? (f.piso ?? "") : ""}</td>;
          if (k === "estado") {
            const v = f.estado;
            const libre = /disponible|libre/i.test(v || "");
            return <td key={j}><span className={libre ? "chip libre" : "chip"}>{v || "—"}</span></td>;
          }
          if (k === "unidad") return <td key={j} className="uni">{celda(f, k)}</td>;
          return <td key={j} className="num">{celda(f, k)}</td>;
        })}
      </tr>,
    );
  });

  return (
    <>
      {e.disponiblesEjemplo ? (
        <div className="aviso-ej"><b>Datos de ejemplo.</b><span>Las unidades, los valores y las condiciones de esta
          tabla están puestos para mostrar cómo se ve. Hay que reemplazarlos por la lista real antes de pasarle la
          página a un colega.</span></div>
      ) : null}
      {hayTexto(e.links?.disponibles) ? (
        <div className="vinculos">
          <a className="vinculo" href={e.links.disponibles} target="_blank" rel="noopener">
            Abrir la planilla en vivo <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      ) : null}
      {grupos.length > 1 ? (
        <div className="filtros">
          <span className="et-filtro">Ver</span>
          {["", ...grupos].map((g) => (
            <button key={g || "todas"} type="button" className={g === filtro ? "chip-f activo" : "chip-f"}
                    data-filtro={g} onClick={() => { setFiltro(g); setVista(null); }}>
              {g || "Todas"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="tabla-wrap">
        {/* Con un precio a la vista, el resto de la tabla queda borroso; tocándolo se vuelve a la lista. */}
        <table className={vista !== null ? "disp enfocada" : "disp"}>
          <thead><tr>{COLS.map(([k, t]) => <th key={k}>{t}</th>)}</tr></thead>
          <tbody>{cuerpo}</tbody>
        </table>
      </div>
      <p className="pie-tabla">
        Los precios se ven de a una unidad: tocá «Ver precio» en la que te interese y volvé a tocar para ver la lista.{" "}
        {e.notaTabla ? `${e.notaTabla} ` : ""}Verificá el precio contra esta tabla cada vez que publiques en un portal.
      </p>
    </>
  );
}
