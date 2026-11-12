import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DISPONIBILIDAD } from "../../utilidades/propiedades";
import { CATEGORIAS_PANEL, listarPropiedades, type ClavePanel, type ResumenPropiedad } from "../servicioPropiedades";
import { Cargando, ErrorCaja, fechaHora, useCarga } from "../ui";
import { EstadoPropiedad } from "./FormPropiedad";

const FILTROS = [
  ["todos", "Todos"], ["publicados", "Publicados"], ["borradores", "Borradores"], ["despublicados", "Despublicados"],
  ["incompletos", "Incompletos"], ["cambios", "Con cambios sin publicar"], ["papelera", "Papelera"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

function pasa(p: ResumenPropiedad, f: Filtro): boolean {
  if (f === "papelera") return !!p.eliminado_en;
  if (p.eliminado_en) return false;
  if (f === "publicados") return p.estado === "publicado" && p.visible;
  if (f === "borradores") return p.estado === "borrador";
  if (f === "despublicados") return p.estado === "publicado" && !p.visible;
  if (f === "incompletos") return p.faltan.length > 0;
  if (f === "cambios") return p.estado === "publicado" && p.cambios_sin_publicar;
  return true;
}

const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Listado de Terceros o Comercios, con filtros por estado y búsqueda. */
export function ListaPropiedades({ clave }: { readonly clave: ClavePanel }) {
  const cat = CATEGORIAS_PANEL[clave];
  const { datos, cargando, error, recargar } = useCarga(() => listarPropiedades(cat.db), [cat.db]);
  const [params, setParams] = useSearchParams();
  const filtro = (FILTROS.find(([k]) => k === params.get("filtro"))?.[0] ?? "todos") as Filtro;
  const [buscar, setBuscar] = useState("");

  const lista = useMemo(() => (datos ?? []).filter((p) => pasa(p, filtro)
    && (!buscar.trim() || sinAcentos(`${p.titulo} ${p.id} ${p.direccion} ${p.barrio}`).includes(sinAcentos(buscar.trim())))), [datos, filtro, buscar]);
  const hayAlguno = (datos ?? []).length > 0;

  if (cargando && !datos) return <Cargando />;
  if (error) return <ErrorCaja texto={error} reintentar={recargar} />;

  if (!hayAlguno) {
    return (
      <div className="adm-pagina">
        <section className="adm-panel adm-vacio-cat">
          <h2 className="adm-subtitulo">Todavía no hay {clave === "terceros" ? "propiedades de terceros" : "locales comerciales ni oficinas"}</h2>
          <p className="adm-ayuda">Mientras no publiques ninguno, la página de colegas muestra «Próximamente» en {cat.titulo}.
            Lo que crees queda como <b>borrador</b> hasta que lo publiques.</p>
          <Link to={`/admin/${clave}/nuevo`} className="adm-btn primario">{cat.nuevo}</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="adm-pagina">
      <div className="adm-barra">
        <label className="adm-buscar"><span className="adm-sr">Buscar</span>
          <input type="search" placeholder="Buscar por título, barrio o dirección…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
        <Link to={`/admin/${clave}/nuevo`} className="adm-btn primario">{cat.nuevo}</Link>
      </div>
      <div className="adm-filtros" role="tablist" aria-label={`Filtrar ${cat.titulo.toLowerCase()}`}>
        {FILTROS.map(([k, t]) => {
          const n = (datos ?? []).filter((p) => pasa(p, k)).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={filtro === k} className={filtro === k ? "activo" : undefined}
                    onClick={() => setParams(k === "todos" ? {} : { filtro: k })}>{t} <span>{n}</span></button>
          );
        })}
      </div>
      <div className="adm-tabla-caja">
        <table className="adm-tabla">
          <thead><tr><th>Propiedad</th><th>Estado</th><th>Precio</th><th>Disponibilidad</th>
            <th>Material</th><th>Última modificación</th><th><span className="adm-sr">Acciones</span></th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/admin/${clave}/${p.id}`} className="adm-fuerte">{p.titulo}</Link>
                  <span className="adm-tabla-sec">{[p.barrio, p.direccion].filter(Boolean).join(" · ") || "Sin ubicación"} · <code>{p.id}</code></span></td>
                <td><EstadoPropiedad p={p} /></td>
                <td>{p.precio || <span className="adm-ayuda">—</span>}</td>
                <td>{DISPONIBILIDAD[p.disponibilidad]}</td>
                <td>{p.faltan.length
                  ? <span className="adm-chip ambar" title={`Falta: ${p.faltan.join(", ")}`}>Falta: {p.faltan.join(", ")}</span>
                  : <span className="adm-chip verde">Completo</span>}</td>
                <td>{fechaHora(p.modificado_en)}</td>
                <td className="der"><Link to={`/admin/${clave}/${p.id}`} className="adm-btn chico">Editar</Link></td>
              </tr>
            ))}
            {!lista.length ? <tr><td colSpan={7} className="adm-vacio">No hay registros con ese filtro{buscar ? " y esa búsqueda" : ""}.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
