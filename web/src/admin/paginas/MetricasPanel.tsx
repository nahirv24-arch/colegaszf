import { Navigate, NavLink, useParams } from "react-router";
import { Metricas } from "./Metricas";
import { Registros } from "./Registros";
import { Resultados } from "./Resultados";

/** «Métricas de colegas»: resultados del trabajo con colegas, lo que se anota a mano y el uso de la página. */
const PESTANAS = [
  ["resultados", "Resultados"],
  ["reuniones", "Reuniones"],
  ["visitas", "Visitas"],
  ["ventas", "Reservas y ventas"],
  ["consultas", "Consultas"],
  ["pendientes", "Pendientes"],
  ["uso", "Uso de la página"],
] as const;
type Pestana = (typeof PESTANAS)[number][0];

export function MetricasPanel() {
  const { pestana = "resultados" } = useParams();
  if (!PESTANAS.some(([k]) => k === pestana)) return <Navigate to="/admin/metricas" replace />;
  const p = pestana as Pestana;
  return (
    <div className="adm-pagina">
      <nav className="adm-pestanas adm-sg-pestanas" aria-label="Secciones de métricas">
        {PESTANAS.map(([k, t]) => (
          <NavLink key={k} to={k === "resultados" ? "/admin/metricas" : `/admin/metricas/${k}`} end
                   className={() => (k === p ? "activo" : undefined)}>{t}</NavLink>
        ))}
      </nav>
      {p === "resultados" ? <Resultados />
        : p === "uso" ? <Metricas />
        : <Registros key={p} clave={p} />}
    </div>
  );
}
