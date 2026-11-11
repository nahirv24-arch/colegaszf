import { useState, type ReactNode } from "react";
import type { Desarrollo, Unidad } from "../tipos/datos";
import { COLUMNAS_POR_DEFECTO, celda, hayTexto } from "../utilidades/textos";

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
  if (!filas.length) return null;
  const COLS = e.columnas && e.columnas.length ? e.columnas : COLUMNAS_POR_DEFECTO;

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
      <tr key={idx} className={nuevoPiso ? "corte" : undefined} data-grupo={f.grupo || undefined}
          hidden={oculta(f.grupo)}>
        {COLS.map(([k], j) => {
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
                    data-filtro={g} onClick={() => setFiltro(g)}>
              {g || "Todas"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="tabla-wrap">
        <table className="disp">
          <thead><tr>{COLS.map(([k, t]) => <th key={k}>{t}</th>)}</tr></thead>
          <tbody>{cuerpo}</tbody>
        </table>
      </div>
      <p className="pie-tabla">
        {e.notaTabla ? `${e.notaTabla} ` : ""}Verificá el precio contra esta tabla cada vez que publiques en un portal.
      </p>
    </>
  );
}
