import { Fragment, useState } from "react";
import type { Propiedad } from "../tipos/datos";
import { FotosPropiedad } from "./FotosPropiedad";
import { filaDePropiedad, metros, OPERACIONES, precioCompleto } from "../utilidades/comercios";
import { linkSeguro } from "../utilidades/propiedades";

const plural = (t: string) => (/[aeiouáéíóú]$/i.test(t) ? `${t}s` : /[xsh]$/i.test(t) ? t : `${t}es`);

/** Terceros y Locales comerciales / oficinas: una tabla simple con las columnas de la planilla de Tokko. */
export function TablaComercios({ lista }: { readonly lista: readonly Propiedad[] }) {
  const filas = lista.map((p) => ({ id: p.id, p, ...filaDePropiedad(p) }));
  const tipos = [...new Set(filas.map((f) => f.tipo).filter(Boolean))];
  const [filtro, setFiltro] = useState("");
  // Fila con las fotos abiertas (debajo de la fila de la propiedad).
  const [abierta, setAbierta] = useState<string | null>(null);
  const columnas = 7 + (lista[0]?.categoria === "tercero" ? 2 : 0);
  const hayFotos = lista.some((p) => p.fotos?.length);
  const vistas = filtro ? filas.filter((f) => f.tipo === filtro) : filas;
  // Terceros muestra si ZF tiene la llave.
  const conLlave = lista[0]?.categoria === "tercero";
  const operacion = (o: string) => OPERACIONES.find(([k]) => k === o)?.[1] ?? "";

  return (
    <>
      {tipos.length > 1 ? (
        <div className="filtros">
          <span className="et-filtro">Ver</span>
          {["", ...tipos].map((t) => (
            <button key={t || "todos"} type="button" className={t === filtro ? "chip-f activo" : "chip-f"} onClick={() => setFiltro(t)}>
              {t ? plural(t) : "Todos"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="tabla-wrap">
        <table className="disp comercios">
          <thead>
            <tr>
              <th>Tipo</th><th>Operación</th><th>Dirección</th><th>Barrio</th>
              <th>m² totales</th><th>Precio</th>{conLlave ? <><th>Llave</th><th>Escritura</th></> : null}
              <th aria-label="Ficha" />
            </tr>
          </thead>
          <tbody>
            {vistas.map((f) => {
              const link = linkSeguro(f.link);
              const nFotos = f.p.fotos?.length ?? 0;
              const abiertaEsta = abierta === f.id;
              return (
                <Fragment key={f.id}>
                <tr id={f.id} className={abiertaEsta ? "con-fotos" : undefined}>
                  <td>{f.tipo || "—"}</td>
                  <td>{operacion(f.operacion) || "—"}</td>
                  <td className="uni">{f.direccion}</td>
                  <td>{f.barrio || "—"}</td>
                  <td className="num">{metros(f.m2_totales)}</td>
                  <td className="num precio">{precioCompleto(f)}</td>
                  {conLlave ? <><td>{f.llave || "—"}</td><td>{f.escritura || "—"}</td></> : null}
                  <td className="ficha">
                    {nFotos ? (
                      <button type="button" className="ver-fotos" aria-expanded={abiertaEsta} aria-controls={`fotos-${f.id}`}
                              onClick={() => setAbierta(abiertaEsta ? null : f.id)}>
                        {abiertaEsta ? "Ocultar fotos" : `Ver fotos (${nFotos})`}
                      </button>
                    ) : null}
                    {link ? <a href={link} target="_blank" rel="noopener noreferrer">Ver ficha <span aria-hidden="true">&#8599;</span></a> : null}
                  </td>
                </tr>
                {abiertaEsta ? (
                  <tr className="fila-fotos" id={`fotos-${f.id}`}>
                    <td colSpan={columnas}><FotosPropiedad p={f.p} /></td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pie-tabla">{vistas.length} {vistas.length === 1 ? "propiedad" : "propiedades"}. {hayFotos ? "«Ver fotos» muestra las fotos para descargar; «Ver ficha» abre la ficha completa en una pestaña nueva."
        : "«Ver ficha» abre la ficha completa con fotos en una pestaña nueva."}</p>
    </>
  );
}
