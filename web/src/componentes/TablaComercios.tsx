import { useState } from "react";
import type { Propiedad } from "../tipos/datos";
import { filaDePropiedad, metros, OPERACIONES, precioCompleto } from "../utilidades/comercios";
import { linkSeguro } from "../utilidades/propiedades";

const plural = (t: string) => (/[aeiouáéíóú]$/i.test(t) ? `${t}s` : /[xsh]$/i.test(t) ? t : `${t}es`);

/** Terceros y Locales comerciales / oficinas: una tabla simple con las columnas de la planilla de Tokko. */
export function TablaComercios({ lista }: { readonly lista: readonly Propiedad[] }) {
  const filas = lista.map((p) => ({ id: p.id, ...filaDePropiedad(p) }));
  const tipos = [...new Set(filas.map((f) => f.tipo).filter(Boolean))];
  const [filtro, setFiltro] = useState("");
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
              return (
                <tr key={f.id} id={f.id}>
                  <td>{f.tipo || "—"}</td>
                  <td>{operacion(f.operacion) || "—"}</td>
                  <td className="uni">{f.direccion}</td>
                  <td>{f.barrio || "—"}</td>
                  <td className="num">{metros(f.m2_totales)}</td>
                  <td className="num precio">{precioCompleto(f)}</td>
                  {conLlave ? <><td>{f.llave || "—"}</td><td>{f.escritura || "—"}</td></> : null}
                  <td className="ficha">
                    {link ? <a href={link} target="_blank" rel="noopener noreferrer">Ver ficha <span aria-hidden="true">&#8599;</span></a> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pie-tabla">{vistas.length} {vistas.length === 1 ? "propiedad" : "propiedades"}. «Ver ficha» abre la ficha completa con fotos en una pestaña nueva.</p>
    </>
  );
}
