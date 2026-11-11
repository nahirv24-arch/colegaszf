import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listarDesarrollos, type ResumenDesarrollo } from "../servicio";
import { Cargando, ChipEstado, ErrorCaja, fechaHora, useCarga } from "../ui";

const FILTROS = [
  ["todos", "Todos"], ["publicados", "Publicados"], ["borradores", "Borradores"], ["ocultos", "Ocultos"],
  ["cambios", "Con cambios sin publicar"], ["papelera", "Papelera"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

function pasa(d: ResumenDesarrollo, f: Filtro): boolean {
  if (f === "papelera") return !!d.eliminado_en;
  if (d.eliminado_en) return false;
  if (f === "publicados") return d.estado === "publicado";
  if (f === "borradores") return d.estado === "borrador";
  if (f === "ocultos") return !d.visible;
  if (f === "cambios") return d.estado === "publicado" && d.cambios_sin_publicar;
  return true;
}

const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ListaDesarrollos() {
  const { datos, cargando, error, recargar } = useCarga(listarDesarrollos, []);
  const [params, setParams] = useSearchParams();
  const filtro = (FILTROS.find(([k]) => k === params.get("filtro"))?.[0] ?? "todos") as Filtro;
  const [buscar, setBuscar] = useState("");

  const lista = useMemo(() => (datos ?? []).filter((d) => pasa(d, filtro)
    && (!buscar.trim() || sinAcentos(`${d.nombre} ${d.id} ${d.direccion}`).includes(sinAcentos(buscar.trim())))), [datos, filtro, buscar]);

  return (
    <div className="adm-pagina">
      <div className="adm-barra">
        <label className="adm-buscar"><span className="adm-sr">Buscar por nombre</span>
          <input type="search" placeholder="Buscar por nombre…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
        <Link to="/admin/desarrollos/nuevo" className="adm-btn primario">+ Nuevo desarrollo</Link>
      </div>
      <div className="adm-filtros" role="tablist" aria-label="Filtrar desarrollos">
        {FILTROS.map(([k, t]) => {
          const n = (datos ?? []).filter((d) => pasa(d, k)).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={filtro === k} className={filtro === k ? "activo" : undefined}
                    onClick={() => setParams(k === "todos" ? {} : { filtro: k })}>{t} <span>{n}</span></button>
          );
        })}
      </div>
      {cargando && !datos ? <Cargando /> : error ? <ErrorCaja texto={error} reintentar={recargar} /> : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead><tr><th>Desarrollo</th><th>Estado</th><th className="num">Unidades</th><th className="num">Archivos</th><th>Última modificación</th><th><span className="adm-sr">Acciones</span></th></tr></thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/admin/desarrollos/${d.id}`} className="adm-fuerte">{d.nombre}</Link>
                    <span className="adm-tabla-sec">{d.direccion || "Sin dirección"} · <code>{d.id}</code></span></td>
                  <td><ChipEstado estado={d.estado} visible={d.visible} papelera={!!d.eliminado_en} cambios={d.cambios_sin_publicar} /></td>
                  <td className="num">{d.unidades}</td>
                  <td className="num">{d.medios}</td>
                  <td>{fechaHora(d.modificado_en)}</td>
                  <td className="der"><Link to={`/admin/desarrollos/${d.id}`} className="adm-btn chico">Editar</Link></td>
                </tr>
              ))}
              {!lista.length ? <tr><td colSpan={6} className="adm-vacio">No hay desarrollos con ese filtro{buscar ? " y esa búsqueda" : ""}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
