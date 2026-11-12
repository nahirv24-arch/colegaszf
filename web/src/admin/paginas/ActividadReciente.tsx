import { useState } from "react";
import { Link } from "react-router";
import { diferencias, ORIGEN, TABLA, TIPO } from "../historial";
import { leerDetalleEvento, type Evento, type ResumenActividad, type TipoEvento } from "../servicio";
import { Cargando, ErrorCaja, fechaHora } from "../ui";

export const GRUPOS_TIPO: readonly (readonly [string, string, readonly TipoEvento[]])[] = [
  ["todas", "Todas", []],
  ["publicacion", "Publicaciones", ["publicacion", "visibilidad"]],
  ["edicion", "Ediciones", ["edicion", "orden"]],
  ["alta", "Altas", ["alta"]],
  ["papelera", "Papelera", ["papelera", "recuperacion", "borrado"]],
];

/** Agrupa eventos seguidos del mismo tipo, desarrollo y autor (por ejemplo, 12 unidades editadas juntas). */
export function agrupar(eventos: readonly Evento[]): Evento[][] {
  const grupos: Evento[][] = [];
  for (const e of eventos) {
    const g = grupos[grupos.length - 1];
    const ult = g?.[g.length - 1];
    if (g && ult && ult.tipo === e.tipo && ult.desarrollo_id === e.desarrollo_id && ult.propiedad_id === e.propiedad_id && ult.origen === e.origen
        && ult.usuario_email === e.usuario_email && Math.abs(Date.parse(ult.fecha) - Date.parse(e.fecha)) < 3 * 60 * 1000) g.push(e);
    else grupos.push([e]);
  }
  return grupos;
}

export function EventoFila({ grupo }: { readonly grupo: readonly Evento[] }) {
  const e = grupo[0]!;
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<{ cargando: boolean; error: string | null; filas: { campo: string; antes: string; despues: string }[] } | null>(null);
  const tablas = [...new Set(grupo.map((x) => TABLA[x.tabla] ?? x.tabla))].join(", ");
  // De qué se trata: un desarrollo o una propiedad de Terceros / Comercios.
  const cat = e.propiedad_categoria === "comercio" ? "comercios" : "terceros";
  const nombre = e.desarrollo_nombre ?? e.desarrollo_id ?? (e.propiedad_titulo ?? e.propiedad_id ?? null);
  const etiquetaCat = e.propiedad_id ? (e.propiedad_categoria === "comercio" ? "Comercio" : "Terceros") : "";
  const abrir = async () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo && grupo.length === 1 && !detalle) {
      setDetalle({ cargando: true, error: null, filas: [] });
      try { const d = await leerDetalleEvento(e.id); setDetalle({ cargando: false, error: null, filas: diferencias({ tabla: e.tabla, accion: e.accion, ...d }) }); }
      catch (x) { setDetalle({ cargando: false, error: x instanceof Error ? x.message : String(x), filas: [] }); }
    }
  };
  return (
    <li className={`adm-ev ${e.origen}`}>
      <button type="button" className="adm-ev-cab" aria-expanded={abierto} onClick={() => void abrir()}>
        <span className={`adm-ev-tipo t-${e.tipo}`}>{TIPO[e.tipo] ?? e.tipo}</span>
        <span className="adm-ev-que">
          {nombre ?? tablas}
          <span className="adm-tabla-sec">
            {[etiquetaCat, nombre ? tablas : "",grupo.length > 1 ? `${grupo.length} cambios` : ""].filter(Boolean).join(" · ") || " "}
          </span>
        </span>
        <span className="adm-ev-meta">{fechaHora(e.fecha)}<br />
          {e.origen === "administracion" ? (e.usuario_email ?? ORIGEN.administracion) : ORIGEN[e.origen]}</span>
      </button>
      {abierto ? (
        <div className="adm-ev-det">
          {grupo.length > 1 ? (
            <ul>{grupo.slice(0, 12).map((x) => <li key={x.id}>{TIPO[x.tipo]} · {TABLA[x.tabla] ?? x.tabla} · {fechaHora(x.fecha)}</li>)}
              {grupo.length > 12 ? <li>y {grupo.length - 12} más…</li> : null}</ul>
          ) : detalle?.cargando ? <Cargando texto="Cargando el detalle…" />
            : detalle?.error ? <ErrorCaja texto={detalle.error} />
            : detalle && detalle.filas.length ? (
              <table className="adm-tabla adm-dif"><thead><tr><th>Dato</th><th>Antes</th><th>Después</th></tr></thead>
                <tbody>{detalle.filas.map((d) => <tr key={d.campo}><td>{d.campo}</td><td>{d.antes}</td><td>{d.despues}</td></tr>)}</tbody></table>
            ) : <p className="adm-nota">Sin datos para comparar.</p>}
          {e.desarrollo_id && e.desarrollo_nombre ? <Link to={`/admin/desarrollos/${e.desarrollo_id}/versiones`}>Ver el historial de {e.desarrollo_nombre}</Link> : null}
          {e.propiedad_id && e.propiedad_titulo ? <Link to={`/admin/${cat}/${e.propiedad_id}`}>Abrir «{e.propiedad_titulo}»</Link> : null}
        </div>
      ) : null}
    </li>
  );
}

/** Lista compacta para el dashboard: 8 grupos como máximo, filtro por tipo y acceso al historial completo. */
export function ActividadReciente({ datos, cargando, error, recargar, incluirPruebas, onIncluirPruebas }: {
  readonly datos: ResumenActividad | null; readonly cargando: boolean; readonly error: string | null; readonly recargar: () => void;
  readonly incluirPruebas: boolean; readonly onIncluirPruebas: (v: boolean) => void;
}) {
  const [grupo, setGrupo] = useState("todas");
  const tipos = GRUPOS_TIPO.find(([k]) => k === grupo)?.[2] ?? [];
  const eventos = (datos?.recientes ?? []).filter((e) => !tipos.length || tipos.includes(e.tipo));
  const grupos = agrupar(eventos).slice(0, 8);
  const ocultas = datos?.por_origen.prueba ?? 0;
  return (
    <div className="adm-act">
      <div className="adm-chips-filtro" role="group" aria-label="Filtrar por tipo de acción">
        {GRUPOS_TIPO.map(([k, t]) => (
          <button key={k} type="button" aria-pressed={grupo === k} className={grupo === k ? "activo" : undefined} onClick={() => setGrupo(k)}>{t}</button>
        ))}
      </div>
      <label className="adm-check chico"><input type="checkbox" checked={incluirPruebas} onChange={(e) => onIncluirPruebas(e.target.checked)} />
        <span>Mostrar pruebas automatizadas{!incluirPruebas && ocultas ? ` (${ocultas.toLocaleString("es-AR")} ocultas)` : ""}</span></label>
      {cargando && !datos ? <Cargando texto="Cargando actividad…" /> : error ? <ErrorCaja texto={error} reintentar={recargar} /> : (
        grupos.length ? <ul className="adm-eventos">{grupos.map((g) => <EventoFila key={g[0]!.id} grupo={g} />)}</ul>
          : <p className="adm-graf-vacio">Todavía no hay cambios de este tipo{incluirPruebas ? "" : " (las pruebas automatizadas están ocultas)"}.</p>
      )}
      <Link to="/admin/actividad" className="adm-ver-mas">Ver el historial completo →</Link>
    </div>
  );
}
