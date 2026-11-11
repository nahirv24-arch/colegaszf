import { useMemo, useState, type FormEvent } from "react";
import type { Columna } from "../../tipos/datos";
import { COLUMNAS_POR_DEFECTO } from "../../utilidades/textos";
import {
  crearUnidad, guardarDesarrollo, guardarUnidad, listarUnidades, mensajeError, quitarUnidad, reordenarUnidades,
  restaurarUnidad, type FilaDesarrollo, type FilaUnidad,
} from "../servicio";
import { Cargando, ErrorCaja, Modal, useAvisos, useCarga, useConfirmar } from "../ui";

const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ETIQUETA_EXTRA: Record<string, string> = { grupo: "Torre / grupo", sup: "Sup. propia", balcon: "Balcón", terraza: "Terraza", total: "M² totales", suptotal: "M² totales", contado: "Contado" };

interface Props { readonly desarrollo: FilaDesarrollo; readonly onCambio: () => void }

/** Tabla de unidades de UN desarrollo, con las columnas propias de ese desarrollo. */
export function TablaUnidades({ desarrollo, onCambio }: Props) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const carga = useCarga(() => listarUnidades(desarrollo.id), [desarrollo.id]);
  const [buscar, setBuscar] = useState("");
  const [grupo, setGrupo] = useState("");
  const [estado, setEstado] = useState("");
  const [verQuitadas, setVerQuitadas] = useState(false);
  const [editando, setEditando] = useState<FilaUnidad | "nueva" | null>(null);
  const [columnasAbierto, setColumnasAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const usaPorDefecto = !desarrollo.columnas.length;
  const cols: readonly Columna[] = usaPorDefecto ? COLUMNAS_POR_DEFECTO : desarrollo.columnas;
  const todas = carga.datos ?? [];
  const activas = todas.filter((u) => !u.eliminado_en).sort((a, b) => a.posicion - b.posicion);
  const quitadas = todas.filter((u) => u.eliminado_en);
  const grupos = useMemo(() => [...new Set(activas.map((u) => u.campos.grupo).filter((g): g is string => !!g))], [activas]);
  const estados = useMemo(() => [...new Set(activas.map((u) => u.campos.estado).filter((g): g is string => !!g))], [activas]);
  const filtrando = !!(buscar.trim() || grupo || estado);
  const visibles = activas.filter((u) => (!grupo || u.campos.grupo === grupo) && (!estado || u.campos.estado === estado)
    && (!buscar.trim() || sinAcentos(Object.values(u.campos).join(" ")).includes(sinAcentos(buscar.trim()))));

  const hacer = async (f: () => Promise<void>, ok: string) => {
    setTrabajando(true);
    try { await f(); avisar("ok", ok); carga.recargar(); onCambio(); }
    catch (e) { avisar("error", mensajeError(e)); carga.recargar(); }
    finally { setTrabajando(false); }
  };

  const mover = (u: FilaUnidad, delta: number) => {
    const ids = activas.map((x) => x.id);
    const i = ids.indexOf(u.id); const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void hacer(() => reordenarUnidades(desarrollo.id, ids), "Orden guardado.");
  };

  if (carga.cargando && !carga.datos) return <Cargando texto="Cargando unidades…" />;
  if (carga.error) return <ErrorCaja texto={carga.error} reintentar={carga.recargar} />;

  let grupoActual: string | null = null;
  return (
    <div className="adm-seccion">
      <p className="adm-intro">Los cambios se guardan en el <b>borrador</b>. Los colegas los ven cuando tocás «Publicar cambios».
        Los precios y superficies se guardan como texto, tal cual los escribas.</p>
      <div className="adm-barra">
        <label className="adm-buscar"><span className="adm-sr">Buscar unidad</span>
          <input type="search" placeholder="Buscar (piso, unidad, precio…)" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
        {grupos.length ? (
          <label className="adm-select"><span className="adm-sr">Torre o grupo</span>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}><option value="">Todas las torres / grupos</option>
              {grupos.map((g) => <option key={g}>{g}</option>)}</select></label>
        ) : null}
        <label className="adm-select"><span className="adm-sr">Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>
            {estados.map((g) => <option key={g}>{g}</option>)}</select></label>
        <span className="adm-espacio" />
        <button type="button" className="adm-btn" onClick={() => setColumnasAbierto(true)}>Columnas</button>
        <button type="button" className="adm-btn primario" onClick={() => setEditando("nueva")}>+ Agregar unidad</button>
      </div>
      <p className="adm-nota">{activas.length} unidades{filtrando ? ` · mostrando ${visibles.length}` : ""}
        {filtrando ? " · Para cambiar el orden, quitá los filtros." : ""}
        {usaPorDefecto ? " · Este desarrollo usa las columnas por defecto." : ""}</p>

      <div className="adm-tabla-caja">
        <table className="adm-tabla adm-unidades">
          <thead><tr>
            {!filtrando ? <th className="adm-col-orden"><span className="adm-sr">Orden</span></th> : null}
            {cols.map(([k, t]) => <th key={k}>{t}</th>)}
            <th><span className="adm-sr">Acciones</span></th>
          </tr></thead>
          <tbody>
            {visibles.flatMap((u, idx) => {
              const filas = [];
              const g = u.campos.grupo;
              if (g && g !== grupoActual) {
                grupoActual = g;
                filas.push(<tr key={`g-${g}-${idx}`} className="adm-banda"><th colSpan={cols.length + 2}>{g} <span>{activas.filter((x) => x.campos.grupo === g).length} unidades</span></th></tr>);
              }
              filas.push(
                <tr key={u.id}>
                  {!filtrando ? (
                    <td className="adm-col-orden">
                      <button type="button" aria-label="Subir" disabled={trabajando || u.id === activas[0]?.id} onClick={() => mover(u, -1)}>↑</button>
                      <button type="button" aria-label="Bajar" disabled={trabajando || u.id === activas[activas.length - 1]?.id} onClick={() => mover(u, 1)}>↓</button>
                    </td>
                  ) : null}
                  {cols.map(([k]) => (
                    <td key={k} className={k === "estado" ? "" : "num"}>
                      {k === "estado" ? <span className={/disponible|libre/i.test(u.campos.estado ?? "") ? "adm-chip verde" : "adm-chip gris"}>{u.campos.estado || "—"}</span>
                        : (u.campos[k] || "—")}
                    </td>
                  ))}
                  <td className="der adm-nowrap">
                    <button type="button" className="adm-btn chico" onClick={() => setEditando(u)}>Editar</button>
                    <button type="button" className="adm-btn chico texto-peligro" disabled={trabajando} onClick={async () => {
                      const nombre = [u.campos.piso, u.campos.unidad].filter(Boolean).join(" ") || `fila ${u.posicion}`;
                      if (await confirmar({ titulo: "Quitar unidad", confirmar: "Quitar", peligro: true,
                        mensaje: <>La unidad <b>{nombre}</b> sale de la tabla. Se puede recuperar desde «Unidades quitadas», abajo.</> })) {
                        await hacer(() => quitarUnidad(u.id), "Unidad quitada (se puede recuperar).");
                      }
                    }}>Quitar</button>
                  </td>
                </tr>,
              );
              return filas;
            })}
            {!visibles.length ? <tr><td colSpan={cols.length + 2} className="adm-vacio">{activas.length ? "Ninguna unidad coincide con la búsqueda." : "Todavía no hay unidades. Tocá «+ Agregar unidad»."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      {quitadas.length ? (
        <div className="adm-papelera">
          <button type="button" className="adm-btn chico" aria-expanded={verQuitadas} onClick={() => setVerQuitadas(!verQuitadas)}>
            {verQuitadas ? "Ocultar" : "Ver"} unidades quitadas ({quitadas.length})</button>
          {verQuitadas ? (
            <ul className="adm-lista">
              {quitadas.map((u) => (
                <li key={u.id}><span>{cols.slice(0, 4).map(([k]) => u.campos[k]).filter(Boolean).join(" · ") || "Unidad"}</span>
                  <button type="button" className="adm-btn chico" disabled={trabajando} onClick={() => void hacer(() => restaurarUnidad(u), "Unidad recuperada (quedó al final de la tabla).")}>Recuperar</button></li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <EditorUnidad abierta={editando !== null} unidad={editando === "nueva" ? null : editando} cols={cols} grupos={grupos}
        estados={estados} onCerrar={() => setEditando(null)}
        onGuardar={async (campos) => {
          const nueva = editando === "nueva";
          const u = editando;
          await hacer(async () => {
            if (nueva) await crearUnidad(desarrollo.id, campos, cols.map(([k]) => k));
            else if (u && u !== "nueva") await guardarUnidad(u, campos);
          }, nueva ? "Unidad agregada al final de la tabla." : "Unidad guardada.");
          setEditando(null);
        }} />

      <EditorColumnas abierto={columnasAbierto} cols={cols} usaPorDefecto={usaPorDefecto}
        clavesEnDatos={[...new Set(activas.flatMap((u) => Object.keys(u.campos)))]}
        onCerrar={() => setColumnasAbierto(false)}
        onGuardar={async (nuevas) => {
          await hacer(() => guardarDesarrollo(desarrollo.id, { columnas: nuevas }), "Columnas guardadas. Los datos de las unidades no se modificaron.");
          setColumnasAbierto(false);
        }} />
    </div>
  );
}

// ------------------------------------------------------------------ editor de una unidad
function EditorUnidad({ abierta, unidad, cols, grupos, estados, onCerrar, onGuardar }: {
  readonly abierta: boolean; readonly unidad: FilaUnidad | null; readonly cols: readonly Columna[];
  readonly grupos: string[]; readonly estados: string[]; readonly onCerrar: () => void;
  readonly onGuardar: (campos: Record<string, string>) => Promise<void>;
}) {
  const base = unidad?.campos ?? {};
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const id = unidad?.id ?? "nueva";
  if (abierta && clave !== id) { setClave(id); setValores({ ...base }); setNuevoNombre(""); }
  if (!abierta && clave !== null) setClave(null);

  const enColumnas = new Set(cols.map(([k]) => k));
  const extras = Object.keys(valores).filter((k) => !enColumnas.has(k) && k !== "grupo");
  const opcionesEstado = [...new Set([...estados, "Disponible", "Reservada"])];

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    // Se conservan TODAS las claves que ya tenía la unidad (aunque queden vacías); las nuevas solo si tienen valor.
    const campos: Record<string, string> = {};
    for (const [k, v] of Object.entries(valores)) if (k in base || v.trim() !== "") campos[k] = v;
    setGuardando(true);
    try { await onGuardar(campos); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={unidad ? "Editar unidad" : "Agregar unidad"} abierta={abierta} onCerrar={onCerrar} ancho={640}>
      <form className="adm-form" onSubmit={enviar}>
        <div className="adm-dos">
          <label className="adm-campo"><span>Torre / grupo</span>
            <input type="text" list="adm-grupos" value={valores.grupo ?? ""} onChange={(e) => setValores({ ...valores, grupo: e.target.value })}
                   placeholder={grupos.length ? grupos.join(" / ") : "Opcional"} />
            <datalist id="adm-grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist></label>
          {cols.map(([k, t]) => (
            <label key={k} className="adm-campo"><span>{t}</span>
              {k === "estado" ? (
                <><input type="text" list="adm-estados" value={valores[k] ?? ""} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} />
                  <datalist id="adm-estados">{opcionesEstado.map((g) => <option key={g} value={g} />)}</datalist></>
              ) : (
                <input type="text" value={valores[k] ?? ""} onChange={(e) => setValores({ ...valores, [k]: e.target.value })}
                       placeholder={k === "precio" ? "USD 120.000" : ""} />
              )}
            </label>
          ))}
        </div>
        {extras.length ? (
          <fieldset className="adm-grupo"><legend>Otros datos de esta unidad (no se muestran como columna)</legend>
            <div className="adm-dos">
              {extras.map((k) => (
                <label key={k} className="adm-campo"><span>{ETIQUETA_EXTRA[k] ?? k}</span>
                  <input type="text" value={valores[k] ?? ""} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} /></label>
              ))}
            </div>
            <p className="adm-ayuda">Los M² totales no se recalculan solos: si cambiás la superficie, revisá también el total.</p>
          </fieldset>
        ) : null}
        <div className="adm-fila-agregar">
          <input type="text" aria-label="Nombre de un dato nuevo" placeholder="Agregar otro dato (ej.: cochera)" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
          <button type="button" className="adm-btn chico" disabled={!nuevoNombre.trim()}
                  onClick={() => { const k = nuevoNombre.trim().toLowerCase().replace(/\s+/g, "_"); if (!(k in valores)) setValores({ ...valores, [k]: "" }); setNuevoNombre(""); }}>Agregar dato</button>
        </div>
        <div className="adm-acciones">
          <button type="button" className="adm-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="adm-btn primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar unidad"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ editor de columnas
function EditorColumnas({ abierto, cols, usaPorDefecto, clavesEnDatos, onCerrar, onGuardar }: {
  readonly abierto: boolean; readonly cols: readonly Columna[]; readonly usaPorDefecto: boolean; readonly clavesEnDatos: string[];
  readonly onCerrar: () => void; readonly onGuardar: (c: [string, string][]) => Promise<void>;
}) {
  const [lista, setLista] = useState<[string, string][]>([]);
  const [abiertoAntes, setAbiertoAntes] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  if (abierto && !abiertoAntes) { setAbiertoAntes(true); setLista(cols.map(([k, t]) => [k, t])); setNuevo(""); }
  if (!abierto && abiertoAntes) setAbiertoAntes(false);

  const usadas = new Set(lista.map(([k]) => k));
  const disponibles = clavesEnDatos.filter((k) => !usadas.has(k) && k !== "grupo");
  const mover = (i: number, d: number) => { const n = [...lista]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; setLista(n); };
  const claveNueva = (titulo: string) => {
    let base = sinAcentos(titulo).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "columna";
    if (base === "grupo") base = "grupo_2";
    let k = base, i = 2; while (usadas.has(k) || clavesEnDatos.includes(k)) k = `${base}_${i++}`;
    return k;
  };

  return (
    <Modal titulo="Columnas de la tabla" abierta={abierto} onCerrar={onCerrar} ancho={620}>
      <p className="adm-ayuda">Cambiá los títulos, el orden o qué columnas se muestran. <b>Quitar una columna no borra datos</b>:
        los valores quedan guardados en cada unidad y la podés volver a agregar.
        {usaPorDefecto ? " Este desarrollo todavía usa las columnas por defecto; al guardar quedan como propias." : ""}</p>
      <ol className="adm-columnas">
        {lista.map(([k, t], i) => (
          <li key={k}>
            <span className="adm-col-num">{i + 1}</span>
            <label className="adm-campo"><span className="adm-sr">Título de la columna {k}</span>
              <input type="text" value={t} onChange={(e) => { const n = [...lista]; n[i] = [k, e.target.value]; setLista(n); }} /></label>
            <code title="Nombre interno del dato">{k}</code>
            <button type="button" className="adm-btn chico" aria-label={`Subir ${t}`} disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
            <button type="button" className="adm-btn chico" aria-label={`Bajar ${t}`} disabled={i === lista.length - 1} onClick={() => mover(i, 1)}>↓</button>
            <button type="button" className="adm-btn chico texto-peligro" onClick={() => setLista(lista.filter((_, x) => x !== i))}>Quitar</button>
          </li>
        ))}
      </ol>
      {disponibles.length ? (
        <div className="adm-chips-elegir"><span className="adm-ayuda">Datos que ya existen en las unidades y no se muestran:</span>
          {disponibles.map((k) => <button key={k} type="button" className="adm-btn chico" onClick={() => setLista([...lista, [k, ETIQUETA_EXTRA[k] ?? k]])}>+ {ETIQUETA_EXTRA[k] ?? k}</button>)}</div>
      ) : null}
      <div className="adm-fila-agregar">
        <input type="text" aria-label="Título de la columna nueva" placeholder="Título de una columna nueva (ej.: Cochera)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        <button type="button" className="adm-btn chico" disabled={!nuevo.trim()} onClick={() => { setLista([...lista, [claveNueva(nuevo), nuevo.trim()]]); setNuevo(""); }}>Agregar columna</button>
      </div>
      <div className="adm-acciones">
        <button type="button" className="adm-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button type="button" className="adm-btn primario" disabled={guardando || !lista.length || lista.some(([, t]) => !t.trim())}
                onClick={async () => { setGuardando(true); try { await onGuardar(lista.map(([k, t]) => [k, t.trim()])); } finally { setGuardando(false); } }}>
          {guardando ? "Guardando…" : "Guardar columnas"}</button>
      </div>
    </Modal>
  );
}
