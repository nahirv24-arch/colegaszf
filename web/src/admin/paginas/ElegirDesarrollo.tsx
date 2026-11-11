import { useMemo, useState } from "react";
import { Link } from "react-router";
import { listarDesarrollos } from "../servicio";
import { Cargando, ChipEstado, ErrorCaja, useCarga } from "../ui";

/** "Unidades disponibles" y "Material multimedia": primero se elige el desarrollo. */
export function ElegirDesarrollo({ destino, titulo }: { readonly destino: "unidades" | "multimedia"; readonly titulo: string }) {
  const { datos, cargando, error, recargar } = useCarga(listarDesarrollos, []);
  const [buscar, setBuscar] = useState("");
  const lista = useMemo(() => (datos ?? []).filter((d) => !d.eliminado_en && d.nombre.toLowerCase().includes(buscar.toLowerCase())), [datos, buscar]);
  return (
    <div className="adm-pagina">
      <p className="adm-intro">{destino === "unidades"
        ? "Elegí el desarrollo cuya tabla de unidades querés editar. Cada desarrollo tiene sus propias columnas."
        : "Elegí el desarrollo para subir, ordenar o reemplazar su portada, fotos, renders, planos y páginas del brochure."}</p>
      <div className="adm-barra">
        <label className="adm-buscar"><span className="adm-sr">Buscar</span>
          <input type="search" placeholder="Buscar desarrollo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
      </div>
      {cargando && !datos ? <Cargando /> : error ? <ErrorCaja texto={error} reintentar={recargar} /> : (
        <div className="adm-elegir" aria-label={titulo}>
          {lista.map((d) => (
            <Link key={d.id} to={`/admin/desarrollos/${d.id}/${destino}`} className="adm-elegir-item">
              <b>{d.nombre}</b>
              <span>{destino === "unidades" ? `${d.unidades} unidades` : `${d.medios} archivos`}</span>
              <ChipEstado estado={d.estado} visible={d.visible} cambios={d.cambios_sin_publicar} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
