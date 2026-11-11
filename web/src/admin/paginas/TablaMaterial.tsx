import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Completitud } from "../servicio";
import { ChipEstado } from "../ui";

export const FILTROS_MATERIAL = [
  ["todos", "Todos"], ["sin", "Sin material"], ["parcial", "Parcialmente completos"], ["completos", "Completos"],
  ["pendientes", "Publicados con información pendiente"],
] as const;
export type FiltroMaterial = (typeof FILTROS_MATERIAL)[number][0];

const pasa = (d: Completitud, f: FiltroMaterial) =>
  f === "sin" ? d.cumplidos === 0
  : f === "parcial" ? d.cumplidos > 0 && d.cumplidos < d.total
  : f === "completos" ? d.cumplidos === d.total
  : f === "pendientes" ? d.estado === "publicado" && d.cumplidos < d.total
  : true;

const ATENCION = { alta: ["Alta", "rojo"], media: ["Media", "ambar"], ninguna: ["Al día", "verde"] } as const;
const ORDEN_ATENCION = { alta: 0, media: 1, ninguna: 2 } as const;
const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Orden = { campo: "completitud" | "nombre" | "atencion"; asc: boolean };

/** Material de los desarrollos: completitud, pendientes y acceso directo a completarlos. */
export function TablaMaterial({ datos, filtro, onFiltro }: {
  readonly datos: readonly Completitud[]; readonly filtro: FiltroMaterial; readonly onFiltro: (f: FiltroMaterial) => void;
}) {
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<Orden>({ campo: "atencion", asc: true });
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set());

  const lista = useMemo(() => {
    const q = sinAcentos(buscar.trim());
    const l = datos.filter((d) => pasa(d, filtro) && (!q || sinAcentos(d.nombre).includes(q)));
    const signo = orden.asc ? 1 : -1;
    return [...l].sort((a, b) => {
      if (orden.campo === "nombre") return signo * a.nombre.localeCompare(b.nombre, "es");
      if (orden.campo === "completitud") return signo * (a.porcentaje - b.porcentaje) || a.nombre.localeCompare(b.nombre, "es");
      return signo * (ORDEN_ATENCION[a.atencion] - ORDEN_ATENCION[b.atencion]) || a.porcentaje - b.porcentaje || a.nombre.localeCompare(b.nombre, "es");
    });
  }, [datos, filtro, buscar, orden]);

  const ordenarPor = (campo: Orden["campo"]) => setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : true }));
  const ariaSort = (campo: Orden["campo"]) => (orden.campo === campo ? (orden.asc ? "ascending" : "descending") : "none");
  const flecha = (campo: Orden["campo"]) => (orden.campo === campo ? (orden.asc ? " ↑" : " ↓") : "");
  const alternar = (id: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="adm-mat">
      <div className="adm-barra">
        <div className="adm-chips-filtro" role="group" aria-label="Filtrar por completitud">
          {FILTROS_MATERIAL.map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filtro === k} className={filtro === k ? "activo" : undefined} onClick={() => onFiltro(k)}>
              {t} <span>{datos.filter((d) => pasa(d, k)).length}</span>
            </button>
          ))}
        </div>
        <label className="adm-buscar chico"><span className="adm-sr">Buscar desarrollo</span>
          <input type="search" placeholder="Buscar desarrollo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
      </div>

      <div className="adm-tabla-caja">
        <table className="adm-tabla adm-tabla-mat">
          <thead>
            <tr>
              <th aria-sort={ariaSort("nombre")}><button type="button" className="adm-orden" onClick={() => ordenarPor("nombre")}>Desarrollo{flecha("nombre")}</button></th>
              <th>Estado</th>
              <th aria-sort={ariaSort("completitud")}><button type="button" className="adm-orden" onClick={() => ordenarPor("completitud")}>Completitud{flecha("completitud")}</button></th>
              <th>Pendiente</th>
              <th aria-sort={ariaSort("atencion")}><button type="button" className="adm-orden" onClick={() => ordenarPor("atencion")}>Atención{flecha("atencion")}</button></th>
              <th><span className="adm-sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((d) => {
              const faltan = d.esenciales.filter((x) => !x.ok);
              const primero = faltan[0];
              const [atTxt, atColor] = ATENCION[d.atencion];
              const abierto = abiertos.has(d.id);
              return (
                <Fragment key={d.id}>
                  <tr className={abierto ? "abierto" : undefined}>
                    <td>
                      <button type="button" className="adm-desplegar" aria-expanded={abierto} aria-controls={`chk-${d.id}`} onClick={() => alternar(d.id)}>
                        <span aria-hidden="true">{abierto ? "▾" : "▸"}</span> <b>{d.nombre}</b>
                      </button>
                    </td>
                    <td><ChipEstado estado={d.estado} visible={d.visible} cambios={d.cambios_sin_publicar} /></td>
                    <td>
                      <div className="adm-prog" title={`${d.cumplidos} de ${d.total} puntos esenciales`}>
                        <span className="adm-prog-pista"><span style={{ width: `${d.porcentaje}%` }} className={d.porcentaje === 100 ? "lleno" : undefined} /></span>
                        <b>{d.porcentaje} %</b>
                      </div>
                      <span className="adm-tabla-sec">{d.cumplidos} de {d.total} puntos</span>
                    </td>
                    <td className="adm-pend">
                      {!faltan.length ? <span className="adm-tabla-sec">Nada esencial</span>
                        : faltan.length === d.total ? <span>Todo el material</span>
                        : <span>{faltan.slice(0, 2).map((f) => f.etiqueta).join(", ")}{faltan.length > 2 ? ` y ${faltan.length - 2} más` : ""}</span>}
                    </td>
                    <td><span className={`adm-chip ${atColor}`}>{atTxt}</span></td>
                    <td className="der">
                      {primero
                        ? <Link to={`/admin/desarrollos/${d.id}/${primero.pestana}`} className="adm-btn chico" aria-label={`Completar material de ${d.nombre}`}>Completar material</Link>
                        : <Link to={`/admin/desarrollos/${d.id}`} className="adm-btn chico" aria-label={`Abrir ${d.nombre}`}>Abrir</Link>}
                    </td>
                  </tr>
                  {abierto ? (
                    <tr className="adm-chk-fila" id={`chk-${d.id}`}>
                      <td colSpan={6}>
                        <div className="adm-chk">
                          <div>
                            <h4>Esenciales <span>(cuentan para el porcentaje)</span></h4>
                            <ul>{d.esenciales.map((p) => (
                              <li key={p.clave} className={p.ok ? "ok" : "falta"}>
                                <span aria-hidden="true">{p.ok ? "✓" : "✕"}</span>
                                <span className="adm-sr">{p.ok ? "Presente:" : "Falta:"}</span> {p.etiqueta}
                                {typeof p.cantidad === "number" && p.cantidad > 0 ? <em> · {p.cantidad}</em> : null}
                                {!p.ok ? <Link to={`/admin/desarrollos/${d.id}/${p.pestana}`}>Cargar</Link> : null}
                              </li>))}</ul>
                          </div>
                          <div>
                            <h4>Opcionales <span>(no cuentan)</span></h4>
                            <ul>{d.opcionales.map((p) => (
                              <li key={p.clave} className={p.ok ? "ok" : "opcional"}>
                                <span aria-hidden="true">{p.ok ? "✓" : "○"}</span>
                                <span className="adm-sr">{p.ok ? "Presente:" : "Sin cargar:"}</span> {p.etiqueta}
                              </li>))}</ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!lista.length ? (
              <tr><td colSpan={6} className="adm-vacio">
                {filtro === "completos" ? "Todavía no hay desarrollos con el material completo." : "Ningún desarrollo coincide con ese filtro o búsqueda."}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="adm-nota">Completitud = puntos esenciales presentes sobre 7: portada, dirección, fecha de posesión, lista de disponibles,
        brochure, planos y fotos o renders. Desarrollista, gastos, nota de la tabla y planilla en vivo son opcionales.</p>
    </div>
  );
}
