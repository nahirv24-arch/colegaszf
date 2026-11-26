import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  describirEvento, leerActividadColegas, leerPaginaCerrada, listarColegas, type EventoActividad,
} from "../servicioColegas";
import { Cargando, ErrorCaja, fechaHora, useCarga } from "../ui";

const PERIODOS = [["7", "Últimos 7 días"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"], ["todo", "Todo"]] as const;
type Periodo = (typeof PERIODOS)[number][0];

const desdeDe = (p: Periodo): string | null =>
  p === "todo" ? null : new Date(Date.now() - Number(p) * 86_400_000).toISOString();

const n = (x: number) => x.toLocaleString("es-AR");
const esTerceros = (t: string) => t === "ver_propiedad" || t === "ver_fotos" || t === "descarga_fotos";

interface PorColega {
  id: string; nombre: string; inmobiliaria: string; ultimo: string | null;
  ingresos: number; fichas: number; precios: number; descargas: number; terceros: number;
  eventos: EventoActividad[];
}

interface PorDesarrollo {
  id: string; nombre: string; vistas: number; colegas: Set<string>; precios: number; descargas: number;
  unidades: Map<string, number>;
}

/** Métricas de lo que hacen los colegas con su cuenta: quién entra, qué mira, qué precios consulta y qué descarga. */
export function Metricas() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [abierto, setAbierto] = useState<string | null>(null);
  const act = useCarga(() => leerActividadColegas(desdeDe(periodo)), [periodo]);
  const colegas = useCarga(listarColegas, []);
  const cerrada = useCarga(leerPaginaCerrada, []);

  const r = useMemo(() => {
    const ev = act.datos ?? [];
    const info = new Map((colegas.datos ?? []).map((c) => [c.id, c]));
    const pc = new Map<string, PorColega>();
    const pd = new Map<string, PorDesarrollo>();
    const props = new Map<string, { nombre: string; categoria: string; vistas: number; fotos: number; descargas: number }>();
    const tot = { colegas: new Set<string>(), fichas: 0, precios: 0, descargas: 0, terceros: 0 };
    for (const a of ev) {
      const clave = a.colega_id ?? `x:${a.colega_nombre}`;
      let c = pc.get(clave);
      if (!c) {
        const i = a.colega_id ? info.get(a.colega_id) : undefined;
        c = { id: clave, nombre: i?.nombre_apellido ?? `${a.colega_nombre} (quitado)`, inmobiliaria: i?.inmobiliaria ?? "",
          ultimo: null, ingresos: 0, fichas: 0, precios: 0, descargas: 0, terceros: 0, eventos: [] };
        pc.set(clave, c);
      }
      c.eventos.push(a);
      if (!c.ultimo || a.creado_en > c.ultimo) c.ultimo = a.creado_en;
      tot.colegas.add(clave);
      if (a.tipo === "ingreso") c.ingresos++;
      if (a.tipo === "ver_ficha") { c.fichas++; tot.fichas++; }
      if (a.tipo === "ver_precio") { c.precios++; tot.precios++; }
      if (a.tipo === "descarga") { c.descargas++; tot.descargas++; }
      if (esTerceros(a.tipo)) { c.terceros++; tot.terceros++; }
      if (a.desarrollo_id) {
        let d = pd.get(a.desarrollo_id);
        if (!d) { d = { id: a.desarrollo_id, nombre: a.detalle?.nombre || a.desarrollo_id, vistas: 0, colegas: new Set(), precios: 0, descargas: 0, unidades: new Map() }; pd.set(a.desarrollo_id, d); }
        d.colegas.add(clave);
        if (a.tipo === "ver_ficha") d.vistas++;
        if (a.tipo === "descarga") d.descargas++;
        if (a.tipo === "ver_precio") {
          d.precios++;
          const u = a.detalle?.unidad || "?";
          d.unidades.set(u, (d.unidades.get(u) ?? 0) + 1);
        }
      }
      if (a.propiedad_id) {
        let p = props.get(a.propiedad_id);
        if (!p) { p = { nombre: a.detalle?.nombre || a.propiedad_id, categoria: a.detalle?.categoria ?? "", vistas: 0, fotos: 0, descargas: 0 }; props.set(a.propiedad_id, p); }
        if (a.tipo === "ver_propiedad") p.vistas++;
        if (a.tipo === "ver_fotos") p.fotos++;
        if (a.tipo === "descarga_fotos") p.descargas++;
      }
    }
    const conAcceso = (colegas.datos ?? []).filter((c) => c.usuario && c.acceso_activo).length;
    return {
      tot, conAcceso,
      colegas: [...pc.values()].sort((a, b) => (b.ultimo ?? "").localeCompare(a.ultimo ?? "")),
      desarrollos: [...pd.values()].sort((a, b) => b.vistas - a.vistas || b.precios - a.precios),
      propiedades: [...props.entries()].map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.vistas + b.fotos) - (a.vistas + a.fotos)),
    };
  }, [act.datos, colegas.datos]);

  if ((act.cargando && !act.datos) || (colegas.cargando && !colegas.datos)) return <Cargando />;
  if (act.error) return <ErrorCaja texto={act.error} reintentar={act.recargar} />;
  if (colegas.error) return <ErrorCaja texto={colegas.error} reintentar={colegas.recargar} />;

  const sinNada = !r.colegas.length;
  return (
    <div className="adm-pagina adm-metricas">
      <div className="adm-barra adm-com-barra">
        <div className="adm-com-acc">
          <label className="adm-select"><span className="adm-sr">Período</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
              {PERIODOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></label>
          <button type="button" className="adm-btn" onClick={() => { act.recargar(); colegas.recargar(); cerrada.recargar(); }}>Actualizar</button>
        </div>
        <div className="adm-com-acc">
          {cerrada.datos === true ? <span className="adm-chip verde">Página cerrada · solo con usuario</span>
            : cerrada.datos === false ? <Link to="/admin/configuracion" className="adm-chip ambar" title="Cambialo en Configuración">Página abierta · solo se mide a quien ingresa</Link> : null}
        </div>
      </div>

      <section className="adm-kpis cinco" aria-label="Resumen del período">
        <div className="adm-kpi estatico"><span className="adm-kpi-rot">Colegas activos</span><span className="adm-kpi-num">{n(r.tot.colegas.size)}</span>
          <span className="adm-kpi-det">de {n(r.conAcceso)} con acceso</span></div>
        <div className="adm-kpi estatico"><span className="adm-kpi-rot">Fichas vistas</span><span className="adm-kpi-num">{n(r.tot.fichas)}</span>
          <span className="adm-kpi-det">desarrollos abiertos</span></div>
        <div className="adm-kpi estatico"><span className="adm-kpi-rot">Precios consultados</span><span className="adm-kpi-num">{n(r.tot.precios)}</span>
          <span className="adm-kpi-det">«Ver precio» por unidad</span></div>
        <div className="adm-kpi estatico"><span className="adm-kpi-rot">Descargas</span><span className="adm-kpi-num">{n(r.tot.descargas)}</span>
          <span className="adm-kpi-det">brochure, planos, fotos y ZIP</span></div>
        <div className="adm-kpi estatico"><span className="adm-kpi-rot">Terceros y locales</span><span className="adm-kpi-num">{n(r.tot.terceros)}</span>
          <span className="adm-kpi-det">fichas, fotos y descargas</span></div>
      </section>

      {sinNada ? (
        <div className="adm-panel adm-vacio">
          Todavía no hay actividad en este período. Se empieza a registrar cuando los colegas entran con el usuario que les creaste
          en <Link to="/admin/colegas">Colegas</Link>.
        </div>
      ) : (
        <>
          <section className="adm-panel" aria-labelledby="m-col">
            <h2 id="m-col" className="adm-subtitulo">Por colega</h2>
            <p className="adm-ayuda">Tocá un colega para ver todo lo que hizo, en orden.</p>
            <div className="adm-tabla-caja">
              <table className="adm-tabla adm-met">
                <thead><tr><th>Colega</th><th>Última actividad</th><th className="der">Ingresos</th><th className="der">Fichas</th>
                  <th className="der">Precios</th><th className="der">Descargas</th><th className="der">Terceros / locales</th></tr></thead>
                <tbody>
                  {r.colegas.map((c) => (
                    <Fragment key={c.id}>
                      <tr className="adm-met-fila" onClick={() => setAbierto(abierto === c.id ? null : c.id)}>
                        <td><button type="button" className="adm-met-nombre" aria-expanded={abierto === c.id}>
                          <span aria-hidden="true">{abierto === c.id ? "▾" : "▸"}</span> {c.nombre}</button>
                          {c.inmobiliaria ? <small>{c.inmobiliaria}</small> : null}</td>
                        <td className="adm-nowrap">{fechaHora(c.ultimo)}</td>
                        <td className="der">{n(c.ingresos)}</td><td className="der">{n(c.fichas)}</td><td className="der">{n(c.precios)}</td>
                        <td className="der">{n(c.descargas)}</td><td className="der">{n(c.terceros)}</td>
                      </tr>
                      {abierto === c.id ? (
                        <tr className="adm-met-detalle"><td colSpan={7}>
                          <ol>
                            {c.eventos.slice(0, 200).map((a) => (
                              <li key={a.id}><span className="cuando">{fechaHora(a.creado_en)}</span> {describirEvento(a)}</li>
                            ))}
                          </ol>
                          {c.eventos.length > 200 ? <p className="adm-ayuda">Se muestran las últimas 200 acciones de {n(c.eventos.length)}.</p> : null}
                        </td></tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adm-panel" aria-labelledby="m-des">
            <h2 id="m-des" className="adm-subtitulo">Por desarrollo</h2>
            {r.desarrollos.length ? (
              <div className="adm-tabla-caja">
                <table className="adm-tabla adm-met">
                  <thead><tr><th>Desarrollo</th><th className="der">Veces que se abrió</th><th className="der">Colegas distintos</th>
                    <th className="der">Precios consultados</th><th>Unidades más consultadas</th><th className="der">Descargas</th></tr></thead>
                  <tbody>
                    {r.desarrollos.map((d) => (
                      <tr key={d.id}>
                        <td><Link to={`/admin/desarrollos/${d.id}`}>{d.nombre}</Link></td>
                        <td className="der">{n(d.vistas)}</td><td className="der">{n(d.colegas.size)}</td><td className="der">{n(d.precios)}</td>
                        <td>{[...d.unidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
                          .map(([u, k]) => `${u} (${k})`).join(" · ") || "—"}</td>
                        <td className="der">{n(d.descargas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="adm-ayuda">En este período nadie abrió un desarrollo.</p>}
          </section>

          {r.propiedades.length ? (
            <section className="adm-panel" aria-labelledby="m-pro">
              <h2 id="m-pro" className="adm-subtitulo">Terceros y locales / oficinas</h2>
              <div className="adm-tabla-caja">
                <table className="adm-tabla adm-met">
                  <thead><tr><th>Propiedad</th><th>Sección</th><th className="der">Abrió la ficha</th><th className="der">Miró las fotos</th>
                    <th className="der">Descargó fotos</th></tr></thead>
                  <tbody>
                    {r.propiedades.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td><td>{p.categoria === "tercero" ? "Terceros" : p.categoria ? "Locales / oficinas" : "—"}</td>
                        <td className="der">{n(p.vistas)}</td><td className="der">{n(p.fotos)}</td><td className="der">{n(p.descargas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
