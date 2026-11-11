import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { BarraSegmentada, BarrasHorizontales, COLOR, ColumnasPorDia, type Segmento } from "../graficos";
import {
  leerActividad, leerActualizado, leerCompletitud, leerEstadisticas, leerEstadosUnidades, type Completitud,
} from "../servicio";
import { Cargando, ErrorCaja, fechaHora, useCarga } from "../ui";
import { ActividadReciente } from "./ActividadReciente";
import { TablaMaterial, type FiltroMaterial } from "./TablaMaterial";

const CATEGORIAS = [
  ["paginas_brochure", "Páginas de brochure"], ["fotos", "Fotografías"], ["planos", "Planos"], ["renders", "Renders"],
] as const;
type Categoria = (typeof CATEGORIAS)[number][0];

const fechaLarga = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "—");
const n = (v: number) => v.toLocaleString("es-AR");

/** Color por estado comercial: disponible = azul, reservada = ámbar, vendida = violeta, otros = gris. */
function colorEstado(e: string): string {
  if (/^\s*(disponible|libre)/i.test(e)) return COLOR.azul;
  if (/^\s*reservad/i.test(e)) return COLOR.ambar;
  if (/^\s*vendid/i.test(e)) return COLOR.violeta;
  return COLOR.gris;
}

export function Dashboard() {
  const inventario = useCarga(async () => {
    const [stats, completitud, estados, actualizado] = await Promise.all([leerEstadisticas(), leerCompletitud(), leerEstadosUnidades(), leerActualizado()]);
    return { stats, completitud, estados, actualizado, al: new Date().toISOString() };
  }, []);
  const [incluirPruebas, setIncluirPruebas] = useState(false);
  const actividad = useCarga(() => leerActividad(incluirPruebas), [incluirPruebas]);
  const [filtroMaterial, setFiltroMaterial] = useState<FiltroMaterial>("pendientes");
  const [desUnidades, setDesUnidades] = useState("");
  const [vistaMaterial, setVistaMaterial] = useState<"total" | Categoria>("total");
  const refMaterial = useRef<HTMLElement>(null);

  const d = inventario.datos;
  const completitud: readonly Completitud[] = d?.completitud ?? [];

  const segUnidades = useMemo<Segmento[]>(() => {
    const cuenta = new Map<string, number>();
    for (const u of d?.estados ?? []) if (!desUnidades || u.desarrollo_id === desUnidades) cuenta.set(u.estado || "(sin estado)", (cuenta.get(u.estado || "(sin estado)") ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([etiqueta, valor]) => ({ etiqueta, valor, color: colorEstado(etiqueta) }));
  }, [d, desUnidades]);

  if (inventario.cargando && !d) return <Cargando texto="Calculando el resumen…" />;
  if (inventario.error || !d) return <ErrorCaja texto={inventario.error ?? "Sin datos"} reintentar={inventario.recargar} />;
  const s = d.stats;

  const atencion = completitud.filter((c) => c.atencion !== "ninguna").length;
  const material = s.fotos + s.renders + s.planos + s.paginas_brochure;
  const pendientesPublicar = completitud.filter((c) => c.estado === "borrador" || c.cambios_sin_publicar);
  const conUnidades = completitud.filter((c) => c.conteos.unidades > 0);
  const publicacion: Segmento[] = [
    { etiqueta: "Publicado y al día", valor: completitud.filter((c) => c.estado === "publicado" && c.visible && !c.cambios_sin_publicar).length, color: COLOR.azul },
    { etiqueta: "Publicado con cambios sin publicar", valor: completitud.filter((c) => c.estado === "publicado" && c.visible && c.cambios_sin_publicar).length, color: COLOR.violeta },
    { etiqueta: "Borrador", valor: completitud.filter((c) => c.estado === "borrador").length, color: COLOR.ambar },
    { etiqueta: "Oculto", valor: completitud.filter((c) => c.estado === "publicado" && !c.visible).length, color: COLOR.gris },
  ];
  const barrasMaterial = vistaMaterial === "total"
    ? CATEGORIAS.map(([k, t]) => ({ etiqueta: t, valor: k === "paginas_brochure" ? s.paginas_brochure : s[k] }))
    : completitud.filter((c) => c.conteos[vistaMaterial] > 0).sort((a, b) => b.conteos[vistaMaterial] - a.conteos[vistaMaterial])
        .map((c) => ({ etiqueta: c.nombre, valor: c.conteos[vistaMaterial], a: `/admin/desarrollos/${c.id}/multimedia` }));
  const sinCategoria = vistaMaterial === "total" ? 0 : completitud.filter((c) => c.conteos[vistaMaterial] === 0).length;

  const irAtencion = () => { setFiltroMaterial("pendientes"); refMaterial.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <div className="adm-pagina adm-dash">
      <div className="adm-dash-cab">
        <div>
          <p className="adm-dash-sub">Última actualización de la página: <b>{fechaLarga(d.actualizado)}</b> · datos de Supabase al {fechaHora(d.al)}</p>
        </div>
        <div className="adm-dash-acc">
          <button type="button" className="adm-btn" onClick={() => { inventario.recargar(); actividad.recargar(); }}>Actualizar</button>
          <Link to="/admin/multimedia" className="adm-btn">Cargar material</Link>
          <Link to="/admin/desarrollos/nuevo" className="adm-btn primario">+ Nuevo desarrollo</Link>
        </div>
      </div>

      {/* Indicadores principales (inventario actual) */}
      <section className="adm-kpis" aria-label="Indicadores principales">
        <Link to="/admin/desarrollos" className="adm-kpi">
          <span className="adm-kpi-rot">Desarrollos</span><span className="adm-kpi-num">{n(s.desarrollos)}</span>
          <span className="adm-kpi-det">{n(s.publicados)} publicados · {n(s.borradores)} {s.borradores === 1 ? "borrador" : "borradores"}{s.ocultos ? ` · ${n(s.ocultos)} ocultos` : ""}</span>
        </Link>
        <Link to="/admin/unidades" className="adm-kpi">
          <span className="adm-kpi-rot">Unidades registradas</span><span className="adm-kpi-num">{n(s.unidades)}</span>
          <span className="adm-kpi-det">{n(s.unidades_disponibles)} disponibles · {n(s.unidades_reservadas)} {s.unidades_reservadas === 1 ? "reservada" : "reservadas"}{s.existe_estado_vendida ? ` · ${n(s.unidades_vendidas)} vendidas` : ""}</span>
        </Link>
        <Link to="/admin/multimedia" className="adm-kpi">
          <span className="adm-kpi-rot">Material cargado</span><span className="adm-kpi-num">{n(material)}</span>
          <span className="adm-kpi-det">fotos, renders, planos y páginas de brochure</span>
        </Link>
        <button type="button" className={atencion ? "adm-kpi alerta" : "adm-kpi"} onClick={irAtencion}>
          <span className="adm-kpi-rot">Requieren atención</span><span className="adm-kpi-num">{n(atencion)}</span>
          <span className="adm-kpi-det">{atencion ? "con material esencial pendiente →" : "todo el material esencial cargado"}</span>
        </button>
      </section>

      {/* Análisis visual */}
      <section className="adm-graficos" aria-label="Análisis visual">
        <article className="adm-panel adm-graf-card">
          <header><h2>Unidades por estado comercial</h2><span className="adm-fuente">Inventario actual</span></header>
          <label className="adm-select chico"><span className="adm-sr">Desarrollo</span>
            <select value={desUnidades} onChange={(e) => setDesUnidades(e.target.value)}>
              <option value="">Todos los desarrollos ({n(s.unidades)})</option>
              {conUnidades.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.conteos.unidades})</option>)}
            </select></label>
          <BarraSegmentada segmentos={segUnidades} unidad="unidades" vacio="Este desarrollo no tiene unidades cargadas." />
          {!s.existe_estado_vendida ? <p className="adm-nota">No hay unidades con estado «Vendida» en los datos.</p> : null}
        </article>

        <article className="adm-panel adm-graf-card">
          <header><h2>Material por categoría</h2><span className="adm-fuente">Inventario actual</span></header>
          <label className="adm-select chico"><span className="adm-sr">Vista</span>
            <select value={vistaMaterial} onChange={(e) => setVistaMaterial(e.target.value as "total" | Categoria)}>
              <option value="total">Total por categoría</option>
              {CATEGORIAS.map(([k, t]) => <option key={k} value={k}>{t}: por desarrollo</option>)}
            </select></label>
          <BarrasHorizontales barras={barrasMaterial} unidad="archivos" vacio="Ningún desarrollo tiene material de esta categoría." />
          {sinCategoria ? <p className="adm-nota">{sinCategoria} desarrollos sin {CATEGORIAS.find(([k]) => k === vistaMaterial)?.[1].toLowerCase()}.</p> : null}
        </article>

        <article className="adm-panel adm-graf-card">
          <header><h2>Estado de publicación</h2><span className="adm-fuente">Inventario actual</span></header>
          <BarraSegmentada segmentos={publicacion} unidad="desarrollos" />
          {s.en_papelera ? <p className="adm-nota">{s.en_papelera} en la papelera (no cuentan). <Link to="/admin/desarrollos?filtro=papelera">Ver papelera</Link></p> : null}
        </article>

        <article className="adm-panel adm-graf-card">
          <header><h2>Actividad por fecha</h2><span className="adm-fuente">Actividad administrativa</span></header>
          {actividad.cargando && !actividad.datos ? <Cargando /> : actividad.error ? <ErrorCaja texto={actividad.error} reintentar={actividad.recargar} />
            : <ColumnasPorDia datos={actividad.datos?.por_dia ?? []} unidad="cambios" />}
          <p className="adm-nota">{incluirPruebas ? "Incluye pruebas automatizadas." : "Sin pruebas automatizadas."} Últimos 60 días.</p>
        </article>
      </section>

      {/* Trabajo pendiente */}
      <section className="adm-panel" ref={refMaterial} aria-labelledby="t-mat" style={{ scrollMarginTop: 90 }}>
        <header className="adm-sec-cab"><h2 id="t-mat">Material de los desarrollos</h2>
          <span className="adm-fuente">{completitud.filter((c) => c.porcentaje === 100).length} de {completitud.length} completos</span></header>
        <TablaMaterial datos={completitud} filtro={filtroMaterial} onFiltro={setFiltroMaterial} />
      </section>

      <div className="adm-dos-col">
        <section className="adm-panel" aria-labelledby="t-pend">
          <header className="adm-sec-cab"><h2 id="t-pend">Pendientes de publicar</h2><span className="adm-fuente">Borradores y cambios guardados</span></header>
          {pendientesPublicar.length ? (
            <ul className="adm-lista">
              {pendientesPublicar.map((c) => (
                <li key={c.id}>
                  <span><Link to={`/admin/desarrollos/${c.id}`}><b>{c.nombre}</b></Link>
                    <span className="adm-lista-sec">{c.estado === "borrador" ? "Borrador: todavía no está en la página" : "Tiene cambios guardados que los colegas no ven"} · {fechaHora(c.modificado_en)}</span></span>
                  <Link to={`/admin/vista-previa/${c.id}`} className="adm-btn chico" target="_blank" rel="noopener">Vista previa ↗</Link>
                </li>
              ))}
            </ul>
          ) : <p className="adm-graf-vacio"><b>Nada pendiente</b><br />Todo lo guardado ya está publicado.</p>}
        </section>

        <section className="adm-panel" aria-labelledby="t-act">
          <header className="adm-sec-cab"><h2 id="t-act">Actividad reciente</h2><span className="adm-fuente">Actividad administrativa</span></header>
          <ActividadReciente datos={actividad.datos} cargando={actividad.cargando} error={actividad.error} recargar={actividad.recargar}
            incluirPruebas={incluirPruebas} onIncluirPruebas={setIncluirPruebas} />
        </section>
      </div>

      <section className="adm-panel adm-visitas" aria-labelledby="t-vis">
        <header className="adm-sec-cab"><h2 id="t-vis">Visitantes de la página</h2><span className="adm-fuente">Comportamiento de visitantes</span></header>
        <p className="adm-graf-vacio"><b>No implementado todavía</b><br />
          Hoy no se registra quién visita la página ni qué descarga. Para medirlo haría falta agregar un contador de visitas
          que respete la privacidad (sin cookies ni datos personales) o activar las estadísticas de Netlify. Se decide más adelante.</p>
      </section>
    </div>
  );
}
