import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { listarColegas, type Colega } from "../servicioColegas";
import {
  borrar, CANALES, dinero, ESTADOS_OPERACION, fechaCorta, FORMAS_PAGO, guardar, hoyISO, leerInmuebles, listar,
  marcarPendiente, ORIGENES, RESULTADOS, sumarDias, texto, type Opcion, type TablaSeguimiento,
} from "../servicioSeguimiento";
import { Cargando, ErrorCaja, Modal, useAvisos, useCarga, useConfirmar } from "../ui";

/**
 * Pantallas para anotar el seguimiento comercial: reuniones, consultas, visitas, reservas/ventas y pendientes.
 * Todas funcionan igual: lista con buscador y período, «+ Agregar», tocar una fila para editarla y «Borrar».
 */

type Fila = Record<string, unknown> & { id?: string };
type TipoCampo = "fecha" | "texto" | "largo" | "opciones" | "colega" | "colegas" | "inmueble" | "desarrollo" | "numero" | "si_no";

interface Campo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: readonly (readonly [string, string])[];
  obligatorio?: boolean;
  ayuda?: string;
  completo?: boolean;
  placeholder?: string;
  /** Se muestra solo si devuelve true (por ejemplo, comisión solo en ventas). */
  si?: (f: Fila) => boolean;
}

interface Contexto {
  colegas: Map<string, Colega>;
  listaColegas: Colega[];
  desarrollos: Opcion[];
  propiedades: Opcion[];
  nombreInmueble: (f: Fila) => string;
}

interface Columna { titulo: string; celda: (f: Fila, c: Contexto) => ReactNode; der?: boolean; nowrap?: boolean }

interface Definicion {
  tabla: TablaSeguimiento;
  singular: string;
  agregar: string;
  intro: ReactNode;
  vacio: string;
  campos: Campo[];
  columnas: Columna[];
  nueva: () => Fila;
  /** Campo de fecha para el filtro de período. */
  fecha: string;
}

// ---------------------------------------------------------------- piezas de las tablas

const nombreColega = (id: unknown, c: Contexto): string =>
  typeof id === "string" && id ? (c.colegas.get(id)?.nombre_apellido ?? "(colega quitado)") : "—";

const cliente = (f: Fila) => (f.cliente ? String(f.cliente) : "—");
const conUnidad = (f: Fila, c: Contexto) => {
  const n = c.nombreInmueble(f);
  return f.unidad ? `${n} · ${String(f.unidad)}` : n;
};
const recorte = (s: unknown, n = 70) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t || "—";
};

const CHIP_RESULTADO: Record<string, string> = {
  pendiente: "gris", interesado: "ambar", volvera: "ambar", no_interesado: "gris", reservo: "verde", compro: "verde",
};
const CHIP_ESTADO: Record<string, string> = { reserva: "ambar", venta: "verde", caida: "gris" };

export const DEFINICIONES: Record<string, Definicion> = {
  reuniones: {
    tabla: "reuniones", singular: "reunión", agregar: "+ Agregar reunión", fecha: "fecha",
    intro: <>Anotá cada reunión con colegas y <b>quiénes vinieron</b>. En Resultados vas a ver quién viene seguido y qué pasó después de cada reunión.</>,
    vacio: "Todavía no anotaste reuniones.",
    nueva: () => ({ fecha: hoyISO(), titulo: "", lugar: "", desarrollo_id: null, asistentes: [], otros_asistentes: "", notas: "" }),
    campos: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", obligatorio: true },
      { clave: "titulo", etiqueta: "Tema", tipo: "texto", placeholder: "Ej.: Presentación Reggia 9", obligatorio: true },
      { clave: "lugar", etiqueta: "Lugar", tipo: "texto", placeholder: "Oficina, obra, virtual…" },
      { clave: "desarrollo_id", etiqueta: "Desarrollo (si fue sobre uno)", tipo: "desarrollo" },
      { clave: "asistentes", etiqueta: "Quiénes vinieron", tipo: "colegas", completo: true },
      { clave: "otros_asistentes", etiqueta: "Otros que vinieron (sin cuenta)", tipo: "texto", completo: true, placeholder: "Nombres separados por coma" },
      { clave: "notas", etiqueta: "Notas", tipo: "largo", completo: true },
    ],
    columnas: [
      { titulo: "Fecha", celda: (f) => fechaCorta(f.fecha as string), nowrap: true },
      { titulo: "Tema", celda: (f) => <b className="adm-sg-fuerte">{recorte(f.titulo, 60)}</b> },
      { titulo: "Lugar", celda: (f) => recorte(f.lugar, 30) },
      { titulo: "Desarrollo", celda: (f, c) => c.nombreInmueble(f) },
      { titulo: "Vinieron", celda: (f, c) => {
        const ids = (f.asistentes as string[] | undefined) ?? [];
        const otros = String(f.otros_asistentes ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        const nombres = [...ids.map((i) => nombreColega(i, c)), ...otros];
        return nombres.length ? <span title={nombres.join(", ")}><b>{nombres.length}</b> · {recorte(nombres.join(", "), 60)}</span> : "—";
      } },
    ],
  },
  consultas: {
    tabla: "consultas", singular: "consulta", agregar: "+ Agregar consulta", fecha: "fecha",
    intro: <>Cuando un colega te pregunta por un desarrollo o una unidad. Es el primer paso antes de una visita.</>,
    vacio: "Todavía no anotaste consultas.",
    nueva: () => ({ fecha: hoyISO(), colega_id: null, desarrollo_id: null, propiedad_id: null, unidad: "", canal: "whatsapp", cliente: "", notas: "" }),
    campos: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", obligatorio: true },
      { clave: "colega_id", etiqueta: "Colega", tipo: "colega" },
      { clave: "inmueble", etiqueta: "Qué consultó", tipo: "inmueble" },
      { clave: "unidad", etiqueta: "Unidad", tipo: "texto", placeholder: "Ej.: 5B" },
      { clave: "canal", etiqueta: "Por dónde", tipo: "opciones", opciones: CANALES },
      { clave: "cliente", etiqueta: "Para qué cliente (si lo dijo)", tipo: "texto" },
      { clave: "notas", etiqueta: "Notas", tipo: "largo", completo: true },
    ],
    columnas: [
      { titulo: "Fecha", celda: (f) => fechaCorta(f.fecha as string), nowrap: true },
      { titulo: "Colega", celda: (f, c) => <b className="adm-sg-fuerte">{nombreColega(f.colega_id, c)}</b> },
      { titulo: "Qué consultó", celda: conUnidad },
      { titulo: "Por dónde", celda: (f) => texto(CANALES, f.canal as never) },
      { titulo: "Cliente", celda: cliente },
      { titulo: "Notas", celda: (f) => recorte(f.notas, 50) },
    ],
  },
  visitas: {
    tabla: "visitas", singular: "visita", agregar: "+ Agregar visita", fecha: "fecha",
    intro: <>Cada visita de un cliente a una propiedad: <b>quién es, de dónde viene</b> y cómo le fue. Si después reserva o compra, tocá «Venta» en la fila y se completa solo.</>,
    vacio: "Todavía no anotaste visitas.",
    nueva: () => ({ fecha: hoyISO(), desarrollo_id: null, propiedad_id: null, unidad: "", cliente: "", cliente_telefono: "", origen: "colega", colega_id: null, resultado: "pendiente", notas: "" }),
    campos: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", obligatorio: true },
      { clave: "cliente", etiqueta: "Cliente", tipo: "texto", obligatorio: true, placeholder: "Nombre y apellido" },
      { clave: "cliente_telefono", etiqueta: "Teléfono del cliente", tipo: "texto" },
      { clave: "inmueble", etiqueta: "Qué visitó", tipo: "inmueble" },
      { clave: "unidad", etiqueta: "Unidad", tipo: "texto", placeholder: "Ej.: 5B" },
      { clave: "origen", etiqueta: "De dónde viene", tipo: "opciones", opciones: ORIGENES },
      { clave: "colega_id", etiqueta: "Colega que lo trajo", tipo: "colega", si: (f) => f.origen === "colega" },
      { clave: "resultado", etiqueta: "Cómo le fue", tipo: "opciones", opciones: RESULTADOS },
      { clave: "notas", etiqueta: "Notas", tipo: "largo", completo: true },
    ],
    columnas: [
      { titulo: "Fecha", celda: (f) => fechaCorta(f.fecha as string), nowrap: true },
      { titulo: "Cliente", celda: (f) => <b className="adm-sg-fuerte">{cliente(f)}</b> },
      { titulo: "Qué visitó", celda: conUnidad },
      { titulo: "De dónde viene", celda: (f, c) => f.origen === "colega" ? `Colega · ${nombreColega(f.colega_id, c)}` : texto(ORIGENES, f.origen as never) },
      { titulo: "Cómo le fue", celda: (f) => <span className={`adm-chip ${CHIP_RESULTADO[String(f.resultado)] ?? "gris"}`}>{texto(RESULTADOS, f.resultado as never)}</span> },
    ],
  },
  ventas: {
    tabla: "operaciones", singular: "reserva o venta", agregar: "+ Agregar reserva o venta", fecha: "fecha",
    intro: <>Reservas y ventas: <b>con qué colega</b>, cuánto y la comisión. Si una reserva se cae, cambiale el estado a «Se cayó» (no hace falta borrarla).</>,
    vacio: "Todavía no anotaste reservas ni ventas.",
    nueva: () => ({ fecha: hoyISO(), estado: "venta", desarrollo_id: null, propiedad_id: null, unidad: "", colega_id: null, cliente: "", monto: "", moneda: "USD", forma_pago: "", comision_pct: "", comision_monto: "", comision_pagada: false, visita_id: null, notas: "" }),
    campos: [
      { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", obligatorio: true },
      { clave: "estado", etiqueta: "Estado", tipo: "opciones", opciones: ESTADOS_OPERACION },
      { clave: "inmueble", etiqueta: "Qué se vendió o reservó", tipo: "inmueble" },
      { clave: "unidad", etiqueta: "Unidad", tipo: "texto", placeholder: "Ej.: 5B" },
      { clave: "colega_id", etiqueta: "Colega", tipo: "colega" },
      { clave: "cliente", etiqueta: "Cliente", tipo: "texto" },
      { clave: "monto", etiqueta: "Monto", tipo: "numero", placeholder: "Ej.: 125000" },
      { clave: "moneda", etiqueta: "Moneda", tipo: "opciones", opciones: [["USD", "Dólares (USD)"], ["ARS", "Pesos ($)"]] },
      { clave: "forma_pago", etiqueta: "Forma de pago", tipo: "opciones", opciones: FORMAS_PAGO },
      { clave: "comision_pct", etiqueta: "Comisión del colega (%)", tipo: "numero", placeholder: "Ej.: 3" },
      { clave: "comision_monto", etiqueta: "Comisión (monto)", tipo: "numero", ayuda: "Si lo dejás vacío, se calcula con el % y el monto." },
      { clave: "comision_pagada", etiqueta: "Comisión ya pagada", tipo: "si_no" },
      { clave: "notas", etiqueta: "Notas", tipo: "largo", completo: true },
    ],
    columnas: [
      { titulo: "Fecha", celda: (f) => fechaCorta(f.fecha as string), nowrap: true },
      { titulo: "Estado", celda: (f) => <span className={`adm-chip ${CHIP_ESTADO[String(f.estado)] ?? "gris"}`}>{texto(ESTADOS_OPERACION, f.estado as never)}</span> },
      { titulo: "Qué", celda: (f, c) => <b className="adm-sg-fuerte">{conUnidad(f, c)}</b> },
      { titulo: "Colega", celda: (f, c) => nombreColega(f.colega_id, c) },
      { titulo: "Cliente", celda: cliente },
      { titulo: "Monto", der: true, nowrap: true, celda: (f) => dinero(f.monto as number | null, f.moneda as never) },
      { titulo: "Comisión", nowrap: true, celda: (f) => f.comision_monto === null || f.comision_monto === undefined ? "—"
        : <>{dinero(f.comision_monto as number, f.moneda as never)} {f.comision_pagada ? <span className="adm-chip verde">Pagada</span> : <span className="adm-chip ambar">A pagar</span>}</> },
    ],
  },
  pendientes: {
    tabla: "pendientes", singular: "pendiente", agregar: "+ Agregar pendiente", fecha: "fecha",
    intro: <>Cosas para hacer: «volver a llamar a…», «mandar el brochure a…». Tildalas cuando las termines.</>,
    vacio: "No tenés pendientes anotados.",
    nueva: () => ({ fecha: sumarDias(hoyISO(), 1), texto: "", colega_id: null, hecho: false }),
    campos: [
      { clave: "texto", etiqueta: "Qué hay que hacer", tipo: "texto", obligatorio: true, completo: true },
      { clave: "fecha", etiqueta: "Para cuándo", tipo: "fecha" },
      { clave: "colega_id", etiqueta: "Colega (si es con alguien)", tipo: "colega" },
    ],
    columnas: [
      { titulo: "Para cuándo", nowrap: true, celda: (f) => {
        if (!f.fecha) return "Sin fecha";
        const vencido = !f.hecho && String(f.fecha) < hoyISO();
        const hoy = !f.hecho && String(f.fecha) === hoyISO();
        return <span className={vencido ? "adm-sg-vencido" : undefined}>{fechaCorta(f.fecha as string)}{vencido ? " · vencido" : hoy ? " · hoy" : ""}</span>;
      } },
      { titulo: "Qué hay que hacer", celda: (f) => <span className={f.hecho ? "adm-sg-hecho" : "adm-sg-fuerte"}>{String(f.texto ?? "")}</span> },
      { titulo: "Colega", celda: (f, c) => nombreColega(f.colega_id, c) },
    ],
  },
};

// ---------------------------------------------------------------- números

/** «125.000», «125000», «3,5» → número. Vacío → null. */
export function leerNumero(v: unknown): number | null | "mal" {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\s|\$|usd/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "mal";
}

// ---------------------------------------------------------------- período

const PERIODOS = [["todo", "Todo"], ["mes", "Este mes"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"]] as const;
type Periodo = (typeof PERIODOS)[number][0];
const desde = (p: Periodo): string | null => {
  if (p === "todo") return null;
  if (p === "mes") return `${hoyISO().slice(0, 8)}01`;
  return sumarDias(hoyISO(), -Number(p));
};

// ---------------------------------------------------------------- pantalla

export function Registros({ clave }: { readonly clave: keyof typeof DEFINICIONES }) {
  const def = DEFINICIONES[clave]!;
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const loc = useLocation();
  const filas = useCarga(() => listar<Fila>(def.tabla), [def.tabla]);
  const colegas = useCarga(listarColegas, []);
  const inmuebles = useCarga(leerInmuebles, []);
  const [buscar, setBuscar] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const [verHechos, setVerHechos] = useState(false);
  const [editando, setEditando] = useState<Fila | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // «Venta» desde una visita: llega con los datos para completar.
  useEffect(() => {
    const st = loc.state as { nueva?: Fila } | null;
    if (st?.nueva) {
      setEditando({ ...def.nueva(), ...st.nueva });
      navegar(loc.pathname, { replace: true, state: null });
    }
  }, [loc.state, loc.pathname, navegar, def]);

  const ctx: Contexto = useMemo(() => {
    const lista = (colegas.datos ?? []).slice().sort((a, b) => a.nombre_apellido.localeCompare(b.nombre_apellido, "es"));
    const ds = inmuebles.datos?.desarrollos ?? [];
    const ps = inmuebles.datos?.propiedades ?? [];
    const nd = new Map(ds.map((d) => [d.id, d.nombre]));
    const np = new Map(ps.map((p) => [p.id, p.nombre]));
    return {
      colegas: new Map(lista.map((c) => [c.id, c])), listaColegas: lista, desarrollos: ds, propiedades: ps,
      nombreInmueble: (f) => f.desarrollo_id ? (nd.get(String(f.desarrollo_id)) ?? String(f.desarrollo_id))
        : f.propiedad_id ? (np.get(String(f.propiedad_id)) ?? String(f.propiedad_id)) : "—",
    };
  }, [colegas.datos, inmuebles.datos]);

  const visibles = useMemo(() => {
    const d = desde(periodo);
    const q = buscar.trim().toLowerCase();
    return (filas.datos ?? []).filter((f) => {
      if (clave === "pendientes" && !verHechos && f.hecho) return false;
      const fecha = f[def.fecha] as string | null;
      if (d && (!fecha || fecha < d)) return false;
      if (!q) return true;
      const todo = [
        ...def.columnas.map((c) => textoDe(c.celda(f, ctx))), String(f.notas ?? ""), String(f.cliente_telefono ?? ""),
      ].join(" ").toLowerCase();
      return todo.includes(q);
    }).sort((a, b) => clave === "pendientes"
      ? Number(a.hecho) - Number(b.hecho) || String(a.fecha ?? "9999").localeCompare(String(b.fecha ?? "9999"))
      : 0);
  }, [filas.datos, periodo, buscar, verHechos, clave, def, ctx]);

  if ((filas.cargando && !filas.datos) || (colegas.cargando && !colegas.datos) || (inmuebles.cargando && !inmuebles.datos)) return <Cargando />;
  if (filas.error) return <ErrorCaja texto={filas.error} reintentar={filas.recargar} />;
  if (colegas.error) return <ErrorCaja texto={colegas.error} reintentar={colegas.recargar} />;
  if (inmuebles.error) return <ErrorCaja texto={inmuebles.error} reintentar={inmuebles.recargar} />;

  const quitar = async (f: Fila) => {
    if (!f.id) return;
    if (!(await confirmar({ titulo: `Borrar ${def.singular}`, mensaje: "Se borra para siempre (queda en los respaldos que ya descargaste). ¿Seguro?", confirmar: "Borrar", peligro: true }))) return;
    setOcupado(true);
    try { await borrar(def.tabla, f.id); avisar("ok", "Borrado."); filas.recargar(); setEditando(null); }
    catch (e) { avisar("error", e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  };

  const tildar = async (f: Fila) => {
    if (!f.id) return;
    try { await marcarPendiente(f.id, !f.hecho); filas.recargar(); }
    catch (e) { avisar("error", e instanceof Error ? e.message : String(e)); }
  };

  const descargar = () => {
    const cab = ["Fecha", ...def.campos.filter((c) => c.clave !== "fecha").map((c) => c.etiqueta)];
    const lineas = visibles.map((f) => [fechaCorta(f.fecha as string), ...def.campos.filter((c) => c.clave !== "fecha").map((c) => valorTexto(c, f, ctx))]);
    const csv = [cab, ...lineas].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    a.download = `${def.tabla}-${hoyISO()}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };

  const total = (filas.datos ?? []).length;
  return (
    <div className="adm-pagina adm-sg">
      <p className="adm-intro">{def.intro}</p>
      <div className="adm-barra adm-com-barra">
        <div className="adm-com-acc">
          <label className="adm-buscar"><span className="adm-sr">Buscar</span>
            <input type="search" placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
          <label className="adm-select"><span className="adm-sr">Período</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
              {PERIODOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></label>
          {clave === "pendientes" ? (
            <label className="adm-sg-check"><input type="checkbox" checked={verHechos} onChange={(e) => setVerHechos(e.target.checked)} /> Mostrar los hechos</label>
          ) : null}
          <span className="adm-ayuda">{visibles.length === total ? `${total} en total` : `${visibles.length} de ${total}`}</span>
        </div>
        <div className="adm-com-acc">
          <button type="button" className="adm-btn" onClick={descargar} disabled={!visibles.length} title="Se abre con Excel">Descargar (Excel)</button>
          <button type="button" className="adm-btn primario" onClick={() => setEditando(def.nueva())}>{def.agregar}</button>
        </div>
      </div>

      <div className="adm-tabla-caja">
        <table className="adm-tabla adm-sg-tabla">
          <thead><tr>
            {clave === "pendientes" ? <th aria-label="Hecho" /> : null}
            {def.columnas.map((c) => <th key={c.titulo} className={c.der ? "der" : undefined}>{c.titulo}</th>)}
            <th aria-label="Acciones" />
          </tr></thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="adm-sg-fila" onClick={() => setEditando(f)}>
                {clave === "pendientes" ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="adm-sg-tilde" checked={!!f.hecho} aria-label="Hecho" onChange={() => void tildar(f)} />
                  </td>
                ) : null}
                {def.columnas.map((c) => (
                  <td key={c.titulo} className={[c.der ? "der" : "", c.nowrap ? "adm-nowrap" : ""].join(" ").trim() || undefined}>{c.celda(f, ctx)}</td>
                ))}
                <td className="adm-nowrap der" onClick={(e) => e.stopPropagation()}>
                  {clave === "visitas" ? (
                    <button type="button" className="adm-btn chico" title="Anotar una reserva o venta de esta visita"
                            onClick={() => navegar("/admin/metricas/ventas", { state: { nueva: {
                              cliente: f.cliente, colega_id: f.colega_id, desarrollo_id: f.desarrollo_id, propiedad_id: f.propiedad_id,
                              unidad: f.unidad, visita_id: f.id, estado: f.resultado === "reservo" ? "reserva" : "venta",
                            } } })}>Venta →</button>
                  ) : null}
                  <button type="button" className="adm-btn chico" onClick={() => setEditando(f)}>Editar</button>
                  <button type="button" className="adm-btn chico texto-peligro" onClick={() => void quitar(f)} disabled={ocupado}>Borrar</button>
                </td>
              </tr>
            ))}
            {!visibles.length ? (
              <tr><td colSpan={def.columnas.length + 2} className="adm-vacio">
                {total ? "No hay nada con ese filtro." : def.vacio}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Formulario def={def} fila={editando} ctx={ctx} onCerrar={() => setEditando(null)}
                  onGuardado={() => { setEditando(null); filas.recargar(); }} onBorrar={(f) => void quitar(f)} />
    </div>
  );
}

/** Texto plano de lo que muestra una celda (para el buscador). */
function textoDe(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join(" ");
  if (typeof n === "object" && "props" in n) return textoDe((n as { props: { children?: ReactNode } }).props.children);
  return "";
}

function valorTexto(c: Campo, f: Fila, ctx: Contexto): string {
  const v = f[c.clave];
  switch (c.tipo) {
    case "fecha": return fechaCorta(v as string);
    case "colega": return v ? (ctx.colegas.get(String(v))?.nombre_apellido ?? "(colega quitado)") : "";
    case "colegas": return ((v as string[] | undefined) ?? []).map((i) => ctx.colegas.get(i)?.nombre_apellido ?? "(colega quitado)").join(", ");
    case "inmueble": return ctx.nombreInmueble(f) === "—" ? "" : ctx.nombreInmueble(f);
    case "desarrollo": return v ? (ctx.desarrollos.find((d) => d.id === v)?.nombre ?? String(v)) : "";
    case "opciones": return c.opciones?.find(([k]) => k === v)?.[1] ?? String(v ?? "");
    case "si_no": return v ? "Sí" : "No";
    default: return v === null || v === undefined ? "" : String(v);
  }
}

// ---------------------------------------------------------------- formulario

/** Largo máximo de cada texto (el mismo que controla la base de datos). */
const MAXIMOS: Record<string, number> = {
  texto: 300, titulo: 160, lugar: 120, cliente: 120, cliente_telefono: 40, unidad: 60, otros_asistentes: 600,
};

function Formulario({ def, fila, ctx, onCerrar, onGuardado, onBorrar }: {
  readonly def: Definicion; readonly fila: Fila | null; readonly ctx: Contexto;
  readonly onCerrar: () => void; readonly onGuardado: () => void; readonly onBorrar: (f: Fila) => void;
}) {
  const avisar = useAvisos();
  const [f, setF] = useState<Fila>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [filtroColegas, setFiltroColegas] = useState("");

  useEffect(() => {
    if (!fila) return;
    const copia: Fila = { ...fila };
    for (const c of def.campos) if (c.tipo === "numero" && typeof copia[c.clave] === "number") copia[c.clave] = String(copia[c.clave]).replace(".", ",");
    setF(copia); setErrores({}); setFiltroColegas("");
  }, [fila, def]);

  const poner = (clave: string, v: unknown) => {
    setF((x) => ({ ...x, [clave]: v }));
    setErrores((e) => { if (!e[clave]) return e; const { [clave]: _q, ...resto } = e; return resto; });
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const err: Record<string, string> = {};
    const datos: Fila = { ...f };
    for (const c of def.campos) {
      if (c.si && !c.si(f)) { if (c.tipo === "colega") datos[c.clave] = null; continue; }
      const v = f[c.clave];
      if (c.tipo === "numero") {
        const n = leerNumero(v);
        if (n === "mal") err[c.clave] = "Escribí solo el número (ej.: 125000).";
        else datos[c.clave] = n;
      } else if (c.tipo === "texto" || c.tipo === "largo") {
        datos[c.clave] = String(v ?? "").trim();
      } else if (c.tipo === "fecha") {
        datos[c.clave] = v ? String(v) : null;
      }
      if (c.obligatorio && (c.tipo === "inmueble" ? !(f.desarrollo_id || f.propiedad_id) : !String(datos[c.clave] ?? "").trim())) {
        err[c.clave] = "Completá este dato.";
      }
    }
    if (def.tabla === "operaciones" && !err.comision_pct && !err.comision_monto) {
      const pct = datos.comision_pct as number | null, monto = datos.monto as number | null;
      if (pct !== null && pct > 100) err.comision_pct = "No puede ser más de 100 %.";
      else if (datos.comision_monto === null && pct !== null && monto !== null) datos.comision_monto = Math.round(monto * pct) / 100;
    }
    delete datos.inmueble;
    setErrores(err);
    if (Object.keys(err).length) return;
    setGuardando(true);
    try {
      await guardar(def.tabla, datos);
      avisar("ok", fila?.id ? "Cambios guardados." : "Guardado.");
      onGuardado();
    } catch (e) {
      avisar("error", e instanceof Error ? e.message : String(e));
    } finally { setGuardando(false); }
  };

  const campo = (c: Campo) => {
    if (c.si && !c.si(f)) return null;
    const id = `seg-${c.clave}`;
    const v = f[c.clave];
    const error = errores[c.clave];
    const props = { id, "aria-invalid": error ? true : undefined } as const;
    let control: ReactNode;
    switch (c.tipo) {
      case "fecha":
        control = <input {...props} type="date" value={String(v ?? "")} onChange={(e) => poner(c.clave, e.target.value)} />; break;
      case "texto":
        control = <input {...props} type="text" value={String(v ?? "")} placeholder={c.placeholder} maxLength={MAXIMOS[c.clave] ?? 160}
                         onChange={(e) => poner(c.clave, e.target.value)} />; break;
      case "largo":
        control = <textarea {...props} rows={3} value={String(v ?? "")} maxLength={2000} onChange={(e) => poner(c.clave, e.target.value)} />; break;
      case "numero":
        control = <input {...props} type="text" inputMode="decimal" value={String(v ?? "")} placeholder={c.placeholder} onChange={(e) => poner(c.clave, e.target.value)} />; break;
      case "opciones":
        control = <select {...props} value={String(v ?? "")} onChange={(e) => poner(c.clave, e.target.value)}>
          {c.opciones?.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>; break;
      case "si_no":
        control = <span className="adm-sg-check"><input id={id} type="checkbox" checked={!!v} onChange={(e) => poner(c.clave, e.target.checked)} /> Sí</span>; break;
      case "colega":
        control = <select {...props} value={String(v ?? "")} onChange={(e) => poner(c.clave, e.target.value || null)}>
          <option value="">— Ninguno —</option>
          {ctx.listaColegas.map((x) => <option key={x.id} value={x.id}>{x.nombre_apellido}{x.inmobiliaria ? ` · ${x.inmobiliaria}` : ""}</option>)}
          {typeof v === "string" && v && !ctx.colegas.has(v) ? <option value={v}>(colega quitado)</option> : null}
        </select>; break;
      case "desarrollo":
        control = <select {...props} value={String(v ?? "")} onChange={(e) => poner(c.clave, e.target.value || null)}>
          <option value="">— Ninguno —</option>
          {ctx.desarrollos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>; break;
      case "inmueble": {
        const actual = f.desarrollo_id ? `d:${String(f.desarrollo_id)}` : f.propiedad_id ? `p:${String(f.propiedad_id)}` : "";
        control = <select {...props} value={actual} onChange={(e) => {
          const x = e.target.value;
          setF((y) => ({ ...y, desarrollo_id: x.startsWith("d:") ? x.slice(2) : null, propiedad_id: x.startsWith("p:") ? x.slice(2) : null }));
        }}>
          <option value="">— Elegí —</option>
          <optgroup label="Desarrollos">{ctx.desarrollos.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.nombre}</option>)}</optgroup>
          {ctx.propiedades.length ? <optgroup label="Terceros y locales / oficinas">
            {ctx.propiedades.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nombre}{p.detalle ? ` (${p.detalle})` : ""}</option>)}</optgroup> : null}
        </select>;
        break;
      }
      case "colegas": {
        const elegidos = new Set((v as string[] | undefined) ?? []);
        const q = filtroColegas.trim().toLowerCase();
        const lista = ctx.listaColegas.filter((x) => !q || `${x.nombre_apellido} ${x.inmobiliaria}`.toLowerCase().includes(q));
        control = (
          <div className="adm-sg-multi">
            <div className="adm-sg-multi-cab">
              <input id={id} type="search" placeholder="Buscar colega…" value={filtroColegas} onChange={(e) => setFiltroColegas(e.target.value)} />
              <span className="adm-ayuda">{elegidos.size} {elegidos.size === 1 ? "elegido" : "elegidos"}</span>
            </div>
            <ul>
              {lista.map((x) => (
                <li key={x.id}><label>
                  <input type="checkbox" checked={elegidos.has(x.id)} onChange={(e) => {
                    const s = new Set(elegidos); if (e.target.checked) s.add(x.id); else s.delete(x.id);
                    poner(c.clave, [...s]);
                  }} /> {x.nombre_apellido}{x.inmobiliaria ? <small> · {x.inmobiliaria}</small> : null}
                </label></li>
              ))}
              {!lista.length ? <li className="adm-ayuda">{ctx.listaColegas.length ? "Nadie con ese nombre." : "Todavía no hay colegas registrados."}</li> : null}
            </ul>
          </div>
        );
        break;
      }
    }
    return (
      <div key={c.clave} className={c.completo ? "adm-campo completo" : "adm-campo"}>
        <label htmlFor={id}><span>{c.etiqueta}{c.obligatorio ? " *" : ""}</span></label>
        {control}
        {error ? <small className="adm-sg-error">{error}</small> : c.ayuda ? <small>{c.ayuda}</small> : null}
      </div>
    );
  };

  const titulo = `${fila?.id ? "Editar" : "Agregar"} ${def.singular}`;
  return (
    <Modal titulo={titulo} abierta={!!fila} onCerrar={onCerrar} ancho={720}>
      <form className="adm-form" onSubmit={(e) => void enviar(e)} noValidate>
        <div className="adm-sg-grilla">{def.campos.map(campo)}</div>
        <div className="adm-acciones">
          {fila?.id ? <button type="button" className="adm-btn texto-peligro adm-sg-borrar" onClick={() => onBorrar(fila)} disabled={guardando}>Borrar</button> : null}
          <button type="button" className="adm-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="adm-btn primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}
