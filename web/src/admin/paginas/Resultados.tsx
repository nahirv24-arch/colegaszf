import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BarrasHorizontales, COLOR } from "../graficos";
import { leerActividadColegas, listarColegas } from "../servicioColegas";
import {
  diasEntre, dinero, fechaCorta, guardarConfig, hoyISO, leerConfig, leerInmuebles, listar, marcarPendiente, ORIGENES,
  RESULTADOS, sumarDias, texto, type ConfigSeguimiento, type Consulta, type Operacion, type Pendiente, type Reunion, type Visita,
} from "../servicioSeguimiento";
import { Cargando, ErrorCaja, Modal, useAvisos, useCarga } from "../ui";
import { leerNumero } from "./Registros";

/**
 * Resultados del trabajo con colegas: plazo hasta la fecha límite, metas, embudo
 * (consultas → visitas → reservas → ventas), ranking de colegas, desarrollos, origen de las visitas
 * y qué pasó después de cada reunión.
 */

const n = (x: number) => x.toLocaleString("es-AR");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

type Periodo = "lanzamiento" | "mes" | "30" | "90" | "todo";
const PERIODOS: readonly (readonly [Periodo, string])[] = [
  ["lanzamiento", "Desde el lanzamiento"], ["mes", "Este mes"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"], ["todo", "Todo"],
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

interface PorColega {
  id: string; nombre: string; inmobiliaria: string;
  reuniones: number; consultas: number; visitas: number; reservas: number; ventas: number;
  usd: number; ars: number; comisionPendiente: number; ingresos: number;
}

export function Resultados() {
  const avisar = useAvisos();
  const [periodo, setPeriodo] = useState<Periodo>("lanzamiento");
  const [editarConfig, setEditarConfig] = useState(false);
  const cfg = useCarga(leerConfig, []);
  const datos = useCarga(async () => {
    const [reuniones, consultas, visitas, operaciones, pendientes, colegas, inmuebles] = await Promise.all([
      listar<Reunion>("reuniones"), listar<Consulta>("consultas"), listar<Visita>("visitas"),
      listar<Operacion>("operaciones"), listar<Pendiente>("pendientes"), listarColegas(), leerInmuebles(),
    ]);
    return { reuniones, consultas, visitas, operaciones, pendientes, colegas, inmuebles };
  }, []);

  const lanzamiento = cfg.datos?.lanzamiento ?? null;
  const desde = periodo === "todo" ? null : periodo === "lanzamiento" ? lanzamiento
    : periodo === "mes" ? `${hoyISO().slice(0, 8)}01` : sumarDias(hoyISO(), -Number(periodo));
  const actividad = useCarga(() => leerActividadColegas(desde ? `${desde}T00:00:00-03:00` : null), [desde]);

  const r = useMemo(() => {
    if (!datos.datos) return null;
    const d = datos.datos;
    const enPeriodo = <T extends { fecha: string | null }>(xs: T[]) => xs.filter((x) => !desde || (x.fecha && x.fecha >= desde));
    const reuniones = enPeriodo(d.reuniones);
    const consultas = enPeriodo(d.consultas);
    const visitas = enPeriodo(d.visitas);
    const ops = enPeriodo(d.operaciones);
    const ventas = ops.filter((o) => o.estado === "venta");
    const reservas = ops.filter((o) => o.estado === "reserva");
    const caidas = ops.filter((o) => o.estado === "caida");
    const suma = (xs: Operacion[], m: "USD" | "ARS") => xs.filter((o) => o.moneda === m).reduce((s, o) => s + (o.monto ?? 0), 0);

    const nombreDes = new Map(d.inmuebles.desarrollos.map((x) => [x.id, x.nombre]));
    const nombreProp = new Map(d.inmuebles.propiedades.map((x) => [x.id, x.nombre]));
    const info = new Map(d.colegas.map((c) => [c.id, c]));

    // Por colega
    const pc = new Map<string, PorColega>();
    const de = (id: string | null) => {
      if (!id) return null;
      let c = pc.get(id);
      if (!c) {
        const i = info.get(id);
        c = { id, nombre: i?.nombre_apellido ?? "(colega quitado)", inmobiliaria: i?.inmobiliaria ?? "",
          reuniones: 0, consultas: 0, visitas: 0, reservas: 0, ventas: 0, usd: 0, ars: 0, comisionPendiente: 0, ingresos: 0 };
        pc.set(id, c);
      }
      return c;
    };
    for (const x of reuniones) for (const a of x.asistentes) de(a)!.reuniones++;
    for (const x of consultas) { const c = de(x.colega_id); if (c) c.consultas++; }
    for (const x of visitas) { const c = de(x.colega_id); if (c) c.visitas++; }
    for (const x of ops) {
      const c = de(x.colega_id); if (!c) continue;
      if (x.estado === "reserva") c.reservas++;
      if (x.estado === "venta") {
        c.ventas++;
        if (x.moneda === "USD") c.usd += x.monto ?? 0; else c.ars += x.monto ?? 0;
        if (!x.comision_pagada && x.moneda === "USD") c.comisionPendiente += x.comision_monto ?? 0;
      }
    }
    for (const a of actividad.datos ?? []) if (a.tipo === "ingreso" && a.colega_id && info.has(a.colega_id)) de(a.colega_id)!.ingresos++;
    const ranking = [...pc.values()].sort((a, b) =>
      b.ventas - a.ventas || b.reservas - a.reservas || b.visitas - a.visitas || b.consultas - a.consultas
      || b.reuniones - a.reuniones || b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre, "es"));

    // Por desarrollo / propiedad
    const pd = new Map<string, { nombre: string; a?: string; consultas: number; visitas: number; reservas: number; ventas: number; usd: number; precios: number }>();
    const lugar = (x: { desarrollo_id: string | null; propiedad_id: string | null }) => {
      const clave = x.desarrollo_id ? `d:${x.desarrollo_id}` : x.propiedad_id ? `p:${x.propiedad_id}` : null;
      if (!clave) return null;
      let v = pd.get(clave);
      if (!v) {
        v = { nombre: x.desarrollo_id ? (nombreDes.get(x.desarrollo_id) ?? x.desarrollo_id) : (nombreProp.get(x.propiedad_id!) ?? x.propiedad_id!),
          a: x.desarrollo_id ? `/admin/desarrollos/${x.desarrollo_id}` : undefined, consultas: 0, visitas: 0, reservas: 0, ventas: 0, usd: 0, precios: 0 };
        pd.set(clave, v);
      }
      return v;
    };
    for (const x of consultas) { const v = lugar(x); if (v) v.consultas++; }
    for (const x of visitas) { const v = lugar(x); if (v) v.visitas++; }
    for (const x of ops) {
      const v = lugar(x); if (!v) continue;
      if (x.estado === "reserva") v.reservas++;
      if (x.estado === "venta") { v.ventas++; if (x.moneda === "USD") v.usd += x.monto ?? 0; }
    }
    for (const a of actividad.datos ?? []) {
      if (a.tipo === "ver_precio" && a.desarrollo_id) { const v = lugar({ desarrollo_id: a.desarrollo_id, propiedad_id: null }); if (v) v.precios++; }
    }
    const desarrollos = [...pd.values()].filter((v) => v.consultas + v.visitas + v.reservas + v.ventas > 0)
      .sort((a, b) => b.ventas - a.ventas || b.reservas - a.reservas || b.visitas - a.visitas || b.consultas - a.consultas);

    // Origen y resultado de las visitas
    const cuenta = <K extends string>(xs: K[]) => xs.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<K, number>());
    const origenes = [...cuenta(visitas.map((v) => v.origen)).entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ etiqueta: texto(ORIGENES, k), valor: v }));
    const resultados = [...cuenta(visitas.map((v) => v.resultado)).entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ etiqueta: texto(RESULTADOS, k), valor: v }));

    // Por mes
    const inicioMeses = (desde ?? [...d.consultas, ...d.visitas, ...d.operaciones, ...d.reuniones].map((x) => x.fecha).sort()[0] ?? hoyISO()).slice(0, 7);
    const finMeses = (cfg.datos?.limite && cfg.datos.limite > hoyISO() && periodo === "lanzamiento" ? cfg.datos.limite : hoyISO()).slice(0, 7);
    const meses: string[] = [];
    for (let m = inicioMeses; m <= finMeses && meses.length < 36;) {
      meses.push(m);
      const [y, mm] = m.split("-").map(Number) as [number, number];
      m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
    }
    const delMes = <T extends { fecha: string | null }>(xs: T[], m: string) => xs.filter((x) => x.fecha?.startsWith(m));
    const porMes = meses.map((m) => ({
      mes: m, futuro: m > hoyISO().slice(0, 7),
      reuniones: delMes(d.reuniones, m).length, consultas: delMes(d.consultas, m).length, visitas: delMes(d.visitas, m).length,
      reservas: delMes(d.operaciones, m).filter((o) => o.estado === "reserva").length,
      ventas: delMes(d.operaciones, m).filter((o) => o.estado === "venta").length,
      usd: suma(delMes(d.operaciones, m).filter((o) => o.estado === "venta"), "USD"),
    }));

    // Después de cada reunión: qué hicieron los que vinieron (30 días antes y 30 días después)
    const trajo = (ids: Set<string>, a: string, b: string) => {
      const dentro = (f: string) => f >= a && f < b;
      return {
        visitas: d.visitas.filter((v) => v.colega_id && ids.has(v.colega_id) && dentro(v.fecha)).length,
        ventas: d.operaciones.filter((o) => o.colega_id && ids.has(o.colega_id) && o.estado !== "caida" && dentro(o.fecha)).length,
      };
    };
    const efectoReuniones = reuniones.slice(0, 12).map((x) => {
      const ids = new Set(x.asistentes);
      const otros = x.otros_asistentes.split(",").map((s) => s.trim()).filter(Boolean).length;
      return { r: x, vinieron: ids.size + otros, antes: trajo(ids, sumarDias(x.fecha, -30), x.fecha), despues: trajo(ids, x.fecha, sumarDias(x.fecha, 30)),
        completo: sumarDias(x.fecha, 30) <= hoyISO() };
    });

    // Pendientes para hoy y la semana
    const hoy = hoyISO();
    const pendientes = d.pendientes.filter((p) => !p.hecho && (!p.fecha || p.fecha <= sumarDias(hoy, 7)))
      .sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999")).slice(0, 8);
    const vencidos = d.pendientes.filter((p) => !p.hecho && p.fecha && p.fecha < hoy).length;

    // Comisiones a pagar (de todas las ventas, no solo del período)
    const aPagar = d.operaciones.filter((o) => o.estado === "venta" && !o.comision_pagada && (o.comision_monto ?? 0) > 0);

    // Metas (siempre desde el lanzamiento)
    const desdeLanz = (f: string) => !lanzamiento || f >= lanzamiento;
    const metas = {
      ventas: d.operaciones.filter((o) => o.estado === "venta" && desdeLanz(o.fecha)).length,
      visitas: d.visitas.filter((v) => desdeLanz(v.fecha)).length,
      colegas: d.colegas.filter((c) => c.usuario && c.acceso_activo).length,
    };

    const asistencias = reuniones.reduce((s, x) => s + x.asistentes.length, 0);
    return {
      reuniones, consultas, visitas, ventas, reservas, caidas, asistencias,
      usd: suma(ventas, "USD"), ars: suma(ventas, "ARS"),
      ranking, desarrollos, origenes, resultados, porMes, efectoReuniones, pendientes, vencidos, aPagar, metas,
      sinActividad: d.colegas.filter((c) => c.usuario && c.acceso_activo && !pc.has(c.id)).length,
    };
  }, [datos.datos, actividad.datos, desde, cfg.datos, periodo, lanzamiento]);

  if ((datos.cargando && !datos.datos) || (cfg.cargando && !cfg.datos)) return <Cargando />;
  if (datos.error) return <ErrorCaja texto={datos.error} reintentar={datos.recargar} />;
  if (cfg.error) return <ErrorCaja texto={cfg.error} reintentar={cfg.recargar} />;
  if (!r || !cfg.datos) return null;
  const c = cfg.datos;

  const tildar = async (p: Pendiente) => {
    try { await marcarPendiente(p.id, true); avisar("ok", "Pendiente hecho."); datos.recargar(); }
    catch (e) { avisar("error", e instanceof Error ? e.message : String(e)); }
  };

  const nada = !r.consultas.length && !r.visitas.length && !r.ventas.length && !r.reservas.length && !r.reuniones.length;
  return (
    <div className="adm-pagina adm-sg adm-res">
      <Plazo c={c} metas={r.metas} onEditar={() => setEditarConfig(true)} />

      <div className="adm-barra">
        <label className="adm-select"><span className="adm-sr">Período</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            {PERIODOS.map(([v, t]) => <option key={v} value={v} disabled={v === "lanzamiento" && !lanzamiento}>{t}</option>)}
          </select></label>
        <button type="button" className="adm-btn" onClick={() => { datos.recargar(); cfg.recargar(); actividad.recargar(); }}>Actualizar</button>
        <span className="adm-ayuda">{desde ? `Desde el ${fechaCorta(desde)}` : "Desde el primer registro"}</span>
      </div>

      <section className="adm-kpis cinco" aria-label="Resumen del período">
        <Link className="adm-kpi" to="/admin/metricas/consultas"><span className="adm-kpi-rot">Consultas</span><span className="adm-kpi-num">{n(r.consultas.length)}</span>
          <span className="adm-kpi-det">de colegas</span></Link>
        <Link className="adm-kpi" to="/admin/metricas/visitas"><span className="adm-kpi-rot">Visitas</span><span className="adm-kpi-num">{n(r.visitas.length)}</span>
          <span className="adm-kpi-det">{n(r.visitas.filter((v) => v.origen === "colega").length)} traídas por colegas</span></Link>
        <Link className="adm-kpi" to="/admin/metricas/ventas"><span className="adm-kpi-rot">Reservas</span><span className="adm-kpi-num">{n(r.reservas.length)}</span>
          <span className="adm-kpi-det">{r.caidas.length ? `${n(r.caidas.length)} se cayeron` : "sin caídas"}</span></Link>
        <Link className="adm-kpi" to="/admin/metricas/ventas"><span className="adm-kpi-rot">Ventas</span><span className="adm-kpi-num">{n(r.ventas.length)}</span>
          <span className="adm-kpi-det">{r.usd ? dinero(r.usd) : "USD 0"}{r.ars ? ` + ${dinero(r.ars, "ARS")}` : ""}</span></Link>
        <Link className="adm-kpi" to="/admin/metricas/reuniones"><span className="adm-kpi-rot">Reuniones</span><span className="adm-kpi-num">{n(r.reuniones.length)}</span>
          <span className="adm-kpi-det">{n(r.asistencias)} asistencias de colegas</span></Link>
      </section>

      <div className="adm-res-dos">
        <section className="adm-panel" aria-labelledby="r-emb">
          <h2 id="r-emb" className="adm-subtitulo">Embudo</h2>
          <p className="adm-ayuda">De cada paso, cuántos llegaron al siguiente.</p>
          <BarrasHorizontales unidad="" color={COLOR.azul} vacio="Todavía no hay consultas, visitas ni ventas en este período." barras={[
            { etiqueta: "Consultas", valor: r.consultas.length },
            { etiqueta: "Visitas", valor: r.visitas.length, detalle: `${pct(r.visitas.length, r.consultas.length)} de las consultas` },
            { etiqueta: "Reservas y ventas", valor: r.reservas.length + r.ventas.length, detalle: `${pct(r.reservas.length + r.ventas.length, r.visitas.length)} de las visitas` },
            { etiqueta: "Ventas", valor: r.ventas.length, detalle: `${pct(r.ventas.length, r.visitas.length)} de las visitas` },
          ]} />
          {r.visitas.length ? <p className="adm-res-nota">De cada 10 visitas, <b>{Math.round((r.ventas.length / r.visitas.length) * 10)}</b> terminan en venta.</p> : null}
        </section>

        <section className="adm-panel" aria-labelledby="r-pen">
          <h2 id="r-pen" className="adm-subtitulo">Pendientes de esta semana</h2>
          {r.vencidos ? <p className="adm-res-alerta">{n(r.vencidos)} {r.vencidos === 1 ? "pendiente vencido" : "pendientes vencidos"}</p> : null}
          {r.pendientes.length ? (
            <ul className="adm-res-pend">
              {r.pendientes.map((p) => (
                <li key={p.id}>
                  <input type="checkbox" aria-label={`Marcar como hecho: ${p.texto}`} onChange={() => void tildar(p)} />
                  <span className={p.fecha && p.fecha < hoyISO() ? "adm-sg-vencido" : "cuando"}>{p.fecha ? fechaCorta(p.fecha) : "Sin fecha"}</span>
                  <span>{p.texto}</span>
                </li>
              ))}
            </ul>
          ) : <p className="adm-ayuda">No hay pendientes para esta semana.</p>}
          <p><Link to="/admin/metricas/pendientes">Ver todos los pendientes →</Link></p>
        </section>
      </div>

      {nada ? (
        <div className="adm-panel adm-vacio">
          Todavía no hay nada anotado en este período. Empezá por <Link to="/admin/metricas/reuniones">Reuniones</Link>,{" "}
          <Link to="/admin/metricas/visitas">Visitas</Link> o <Link to="/admin/metricas/ventas">Reservas y ventas</Link>:
          los resultados aparecen acá solos.
        </div>
      ) : null}

      <section className="adm-panel" aria-labelledby="r-col">
        <h2 id="r-col" className="adm-subtitulo">Ranking de colegas</h2>
        <p className="adm-ayuda">Ordenado por ventas, después reservas, visitas y consultas. «Ingresos» es cuántas veces entraron a la página con su cuenta.
          {r.sinActividad ? ` ${n(r.sinActividad)} ${r.sinActividad === 1 ? "colega con cuenta no aparece" : "colegas con cuenta no aparecen"} porque no tuvieron movimiento en este período.` : ""}</p>
        {r.ranking.length ? (
          <div className="adm-tabla-caja">
            <table className="adm-tabla adm-met">
              <thead><tr><th>#</th><th>Colega</th><th className="der">Reuniones</th><th className="der">Consultas</th><th className="der">Visitas</th>
                <th className="der">Reservas</th><th className="der">Ventas</th><th className="der">Vendido</th><th className="der">Comisión a pagar</th><th className="der">Ingresos</th></tr></thead>
              <tbody>
                {r.ranking.map((x, i) => (
                  <tr key={x.id}>
                    <td className="num">{i + 1}</td>
                    <td><b className="adm-sg-fuerte">{x.nombre}</b>{x.inmobiliaria ? <small> · {x.inmobiliaria}</small> : null}</td>
                    <td className="der num">{n(x.reuniones)}</td><td className="der num">{n(x.consultas)}</td><td className="der num">{n(x.visitas)}</td>
                    <td className="der num">{n(x.reservas)}</td><td className="der num"><b>{n(x.ventas)}</b></td>
                    <td className="der adm-nowrap">{x.usd ? dinero(x.usd) : x.ars ? dinero(x.ars, "ARS") : "—"}</td>
                    <td className="der adm-nowrap">{x.comisionPendiente ? dinero(x.comisionPendiente) : "—"}</td>
                    <td className="der num">{n(x.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-ayuda">Todavía no hay movimiento de colegas en este período.</p>}
      </section>

      <section className="adm-panel" aria-labelledby="r-mes">
        <h2 id="r-mes" className="adm-subtitulo">Mes a mes{periodo === "lanzamiento" && c.limite ? ` hasta ${fechaCorta(c.limite)}` : ""}</h2>
        <div className="adm-tabla-caja">
          <table className="adm-tabla adm-met">
            <thead><tr><th>Mes</th><th className="der">Reuniones</th><th className="der">Consultas</th><th className="der">Visitas</th>
              <th className="der">Reservas</th><th className="der">Ventas</th><th className="der">Vendido (USD)</th></tr></thead>
            <tbody>
              {r.porMes.map((m) => (
                <tr key={m.mes} className={m.futuro ? "adm-res-futuro" : undefined}>
                  <td className="adm-nowrap">{nombreMes(m.mes)}{m.mes === hoyISO().slice(0, 7) ? <span className="adm-chip gris">este mes</span> : null}</td>
                  <td className="der num">{m.futuro ? "" : n(m.reuniones)}</td><td className="der num">{m.futuro ? "" : n(m.consultas)}</td>
                  <td className="der num">{m.futuro ? "" : n(m.visitas)}</td><td className="der num">{m.futuro ? "" : n(m.reservas)}</td>
                  <td className="der num">{m.futuro ? "" : <b>{n(m.ventas)}</b>}</td><td className="der adm-nowrap">{m.futuro ? "" : m.usd ? dinero(m.usd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="adm-res-dos">
        <section className="adm-panel" aria-labelledby="r-ori">
          <h2 id="r-ori" className="adm-subtitulo">De dónde vienen las visitas</h2>
          <BarrasHorizontales barras={r.origenes} unidad="visitas" vacio="Todavía no hay visitas en este período." />
        </section>
        <section className="adm-panel" aria-labelledby="r-resu">
          <h2 id="r-resu" className="adm-subtitulo">Cómo les fue a las visitas</h2>
          <BarrasHorizontales barras={r.resultados} unidad="visitas" color={COLOR.violeta} vacio="Todavía no hay visitas en este período." />
        </section>
      </div>

      <section className="adm-panel" aria-labelledby="r-des">
        <h2 id="r-des" className="adm-subtitulo">Por desarrollo</h2>
        <p className="adm-ayuda">«Precios vistos» sale de la página: cuántas veces los colegas tocaron «Ver precio» en ese desarrollo.</p>
        {r.desarrollos.length ? (
          <div className="adm-tabla-caja">
            <table className="adm-tabla adm-met">
              <thead><tr><th>Desarrollo / propiedad</th><th className="der">Precios vistos</th><th className="der">Consultas</th><th className="der">Visitas</th>
                <th className="der">Reservas</th><th className="der">Ventas</th><th className="der">Vendido (USD)</th></tr></thead>
              <tbody>
                {r.desarrollos.map((x) => (
                  <tr key={x.nombre}>
                    <td>{x.a ? <Link to={x.a}>{x.nombre}</Link> : x.nombre}</td>
                    <td className="der num">{n(x.precios)}</td><td className="der num">{n(x.consultas)}</td><td className="der num">{n(x.visitas)}</td>
                    <td className="der num">{n(x.reservas)}</td><td className="der num"><b>{n(x.ventas)}</b></td>
                    <td className="der adm-nowrap">{x.usd ? dinero(x.usd) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-ayuda">Todavía no hay consultas, visitas ni ventas cargadas con un desarrollo.</p>}
      </section>

      <section className="adm-panel" aria-labelledby="r-reu">
        <h2 id="r-reu" className="adm-subtitulo">¿Sirven las reuniones?</h2>
        <p className="adm-ayuda">Para cada reunión: cuántas visitas y reservas o ventas trajeron <b>los colegas que vinieron</b> en los 30 días antes y en los 30 días después.</p>
        {r.efectoReuniones.length ? (
          <div className="adm-tabla-caja">
            <table className="adm-tabla adm-met">
              <thead><tr><th>Fecha</th><th>Tema</th><th className="der">Vinieron</th><th className="der">Visitas antes → después</th>
                <th className="der">Reservas y ventas antes → después</th></tr></thead>
              <tbody>
                {r.efectoReuniones.map(({ r: x, vinieron, antes, despues, completo }) => (
                  <tr key={x.id}>
                    <td className="adm-nowrap">{fechaCorta(x.fecha)}</td>
                    <td>{x.titulo || "—"}</td>
                    <td className="der num">{n(vinieron)}</td>
                    <td className="der adm-nowrap">{n(antes.visitas)} → <b>{n(despues.visitas)}</b></td>
                    <td className="der adm-nowrap">{n(antes.ventas)} → <b>{n(despues.ventas)}</b>{!completo ? <small className="adm-ayuda"> (todavía no pasaron 30 días)</small> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-ayuda">Todavía no hay reuniones en este período.</p>}
      </section>

      {r.aPagar.length ? (
        <section className="adm-panel" aria-labelledby="r-com">
          <h2 id="r-com" className="adm-subtitulo">Comisiones a pagar</h2>
          <p className="adm-ayuda">Ventas con comisión cargada que todavía no marcaste como pagada (de cualquier fecha).</p>
          <div className="adm-tabla-caja">
            <table className="adm-tabla adm-met">
              <thead><tr><th>Fecha</th><th>Colega</th><th>Qué</th><th className="der">Comisión</th></tr></thead>
              <tbody>
                {r.aPagar.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-nowrap">{fechaCorta(o.fecha)}</td>
                    <td>{datos.datos?.colegas.find((x) => x.id === o.colega_id)?.nombre_apellido ?? "—"}</td>
                    <td>{(o.desarrollo_id && datos.datos?.inmuebles.desarrollos.find((x) => x.id === o.desarrollo_id)?.nombre) || o.propiedad_id || "—"}{o.unidad ? ` · ${o.unidad}` : ""}</td>
                    <td className="der adm-nowrap">{dinero(o.comision_monto, o.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <ConfigModal abierta={editarConfig} c={c} onCerrar={() => setEditarConfig(false)} onGuardado={() => { setEditarConfig(false); cfg.recargar(); }} />
    </div>
  );
}

// ---------------------------------------------------------------- plazo y metas

function Plazo({ c, metas, onEditar }: {
  readonly c: ConfigSeguimiento; readonly metas: { ventas: number; visitas: number; colegas: number }; readonly onEditar: () => void;
}) {
  const hoy = hoyISO();
  const total = c.lanzamiento && c.limite ? diasEntre(c.lanzamiento, c.limite) : 0;
  const pasaron = c.lanzamiento ? Math.max(0, diasEntre(c.lanzamiento, hoy)) : 0;
  const faltan = c.limite ? diasEntre(hoy, c.limite) : null;
  const avance = total ? Math.min(100, Math.max(0, (pasaron / total) * 100)) : 0;
  const listaMetas = ([
    ["Ventas", metas.ventas, c.meta_ventas], ["Visitas", metas.visitas, c.meta_visitas], ["Colegas con cuenta", metas.colegas, c.meta_colegas],
  ] as const).filter(([, , m]) => m);
  return (
    <section className="adm-panel adm-res-plazo" aria-labelledby="r-plazo">
      <div className="adm-res-plazo-cab">
        <h2 id="r-plazo" className="adm-subtitulo">Plazo del proyecto</h2>
        <button type="button" className="adm-btn chico" onClick={onEditar}>Editar fechas y metas</button>
      </div>
      <div className="adm-res-fechas">
        <div><span className="adm-kpi-rot">Inicio de la idea</span>
          {c.inicio_idea ? <b>{fechaCorta(c.inicio_idea)}</b> : <button type="button" className="adm-res-cargar" onClick={onEditar}>Sin cargar · cargar</button>}</div>
        <div><span className="adm-kpi-rot">Lanzamiento de la página</span><b>{fechaCorta(c.lanzamiento)}</b></div>
        <div><span className="adm-kpi-rot">Fecha límite</span><b>{fechaCorta(c.limite)}</b></div>
        <div><span className="adm-kpi-rot">{faltan !== null && faltan < 0 ? "Plazo cumplido" : "Faltan"}</span>
          <b className={faltan !== null && faltan <= 30 ? "adm-sg-vencido" : undefined}>
            {faltan === null ? "—" : faltan < 0 ? `hace ${n(-faltan)} días` : `${n(faltan)} días`}</b>
          {faltan !== null && faltan >= 0 ? <small>unas {n(Math.round(faltan / 7))} semanas</small> : null}</div>
      </div>
      {total ? (
        <div className="adm-res-linea" role="img" aria-label={`Pasó el ${Math.round(avance)} % del plazo`}>
          <span style={{ width: `${avance}%` }} />
          <small>Pasó el {Math.round(avance)} % del plazo ({n(pasaron)} de {n(total)} días)</small>
        </div>
      ) : null}
      {listaMetas.length ? (
        <div className="adm-res-metas">
          {listaMetas.map(([t, v, m]) => {
            const p = Math.min(100, (v / (m ?? 1)) * 100);
            const atrasada = total > 0 && p + 10 < avance;
            return (
              <div key={t}>
                <div className="adm-res-meta-cab"><span>{t}</span><b>{n(v)} de {n(m ?? 0)}</b></div>
                <div className={atrasada ? "adm-res-barra atrasada" : "adm-res-barra"}><span style={{ width: `${p}%` }} /></div>
                <small>{p >= 100 ? "¡Meta cumplida!" : atrasada ? "Va más lento que el tiempo que pasó" : "Va bien con el tiempo que pasó"}</small>
              </div>
            );
          })}
        </div>
      ) : <p className="adm-ayuda">Si te ponen metas para el 1 de julio (por ejemplo, cantidad de ventas), cargalas en «Editar fechas y metas» y acá vas a ver si vas bien.</p>}
    </section>
  );
}

function ConfigModal({ abierta, c, onCerrar, onGuardado }: {
  readonly abierta: boolean; readonly c: ConfigSeguimiento; readonly onCerrar: () => void; readonly onGuardado: () => void;
}) {
  const avisar = useAvisos();
  const [f, setF] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!abierta) return;
    setF({
      inicio_idea: c.inicio_idea ?? "", lanzamiento: c.lanzamiento ?? "", limite: c.limite ?? "",
      meta_ventas: c.meta_ventas?.toString() ?? "", meta_visitas: c.meta_visitas?.toString() ?? "", meta_colegas: c.meta_colegas?.toString() ?? "",
    });
    setError("");
  }, [abierta, c]);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const meta = (k: string) => { const x = leerNumero(f[k]); return x === "mal" ? NaN : x === null ? null : Math.round(x); };
    const nueva: ConfigSeguimiento = {
      inicio_idea: f.inicio_idea || null, lanzamiento: f.lanzamiento || null, limite: f.limite || null,
      meta_ventas: meta("meta_ventas"), meta_visitas: meta("meta_visitas"), meta_colegas: meta("meta_colegas"),
    };
    if ([nueva.meta_ventas, nueva.meta_visitas, nueva.meta_colegas].some((x) => Number.isNaN(x))) { setError("Las metas van solo con números."); return; }
    setGuardando(true);
    try { await guardarConfig(nueva); avisar("ok", "Fechas y metas guardadas."); onGuardado(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  const fecha = (k: string, t: string, ayuda?: string) => (
    <div className="adm-campo"><label htmlFor={`cfg-${k}`}><span>{t}</span></label>
      <input id={`cfg-${k}`} type="date" value={f[k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
      {ayuda ? <small>{ayuda}</small> : null}</div>
  );
  const numero = (k: string, t: string) => (
    <div className="adm-campo"><label htmlFor={`cfg-${k}`}><span>{t}</span></label>
      <input id={`cfg-${k}`} type="text" inputMode="numeric" placeholder="Sin meta" value={f[k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>
  );
  return (
    <Modal titulo="Fechas y metas" abierta={abierta} onCerrar={onCerrar} ancho={620}>
      <form className="adm-form" onSubmit={(e) => void enviar(e)} noValidate>
        <div className="adm-sg-grilla">
          {fecha("inicio_idea", "Inicio de la idea", "Si no te acordás, dejalo vacío.")}
          {fecha("lanzamiento", "Lanzamiento de la página")}
          {fecha("limite", "Fecha límite", "Hasta cuándo tiene que funcionar.")}
        </div>
        <h3 className="adm-sg-h3">Metas hasta la fecha límite (opcional)</h3>
        <div className="adm-sg-grilla tres">
          {numero("meta_ventas", "Ventas")}
          {numero("meta_visitas", "Visitas")}
          {numero("meta_colegas", "Colegas con cuenta")}
        </div>
        {error ? <p className="adm-sg-error" role="alert">{error}</p> : null}
        <div className="adm-acciones">
          <button type="button" className="adm-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="adm-btn primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}
