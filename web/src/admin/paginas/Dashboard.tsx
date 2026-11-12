import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { BarraSegmentada, BarrasHorizontales, COLOR, ColumnasPorDia, type Segmento } from "../graficos";
import {
  leerActividad, leerActualizado, leerCompletitud, leerEstadisticas, leerEstadosUnidades, type Completitud,
} from "../servicio";
import { listarPropiedades, type ResumenPropiedad } from "../servicioPropiedades";
import { Cargando, ErrorCaja, fechaHora, useCarga } from "../ui";
import { ActividadReciente } from "./ActividadReciente";
import { EstadoPropiedad } from "./FormPropiedad";
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
    const [stats, completitud, estados, actualizado, propiedades] = await Promise.all([
      leerEstadisticas(), leerCompletitud(), leerEstadosUnidades(), leerActualizado(),
      // Terceros y Comercios: si fallara, el resto del dashboard se muestra igual.
      listarPropiedades(null).then((l) => ({ lista: l, error: null as string | null }),
        (e: unknown) => ({ lista: [] as ResumenPropiedad[], error: e instanceof Error ? e.message : String(e) })),
    ]);
    return { stats, completitud, estados, actualizado, propiedades, al: new Date().toISOString() };
  }, []);
  const [incluirPruebas, setIncluirPruebas] = useState(false);
  const actividad = useCarga(() => leerActividad(incluirPruebas), [incluirPruebas]);
  const [filtroMaterial, setFiltroMaterial] = useState<FiltroMaterial>("pendientes");
  const [desUnidades, setDesUnidades] = useState("");
  const [vistaMaterial, setVistaMaterial] = useState<"total" | Categoria>("total");
  const [catPublicacion, setCatPublicacion] = useState<"desarrollos" | "tercero" | "comercio">("desarrollos");
  const refMaterial = useRef<HTMLElement>(null);
  const refProp = useRef<HTMLElement>(null);

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

  // ---- Terceros y Comercios (datos reales de Supabase; la papelera no cuenta)
  const props = d.propiedades.lista.filter((p) => !p.eliminado_en);
  const terceros = props.filter((p) => p.categoria === "tercero");
  const comercios = props.filter((p) => p.categoria === "comercio");
  const activa = (p: ResumenPropiedad) => p.estado === "publicado" && p.visible;
  const desActivos = completitud.filter((c) => c.estado === "publicado" && c.visible);
  const propActivas = props.filter(activa);
  const activas = desActivos.length + propActivas.length;
  const incompletas = desActivos.filter((c) => c.porcentaje < 100).length + propActivas.filter((p) => p.faltan.length > 0).length;
  const despublicadas = (l: ResumenPropiedad[]) => l.filter((p) => p.estado === "publicado" && !p.visible).length;
  const cuenta = (k: number, uno: string, varios: string) => `${n(k)} ${k === 1 ? uno : varios}`;
  const detCat = (l: ResumenPropiedad[]) => (l.length
    ? `${cuenta(l.filter(activa).length, "publicada", "publicadas")} · ${cuenta(l.filter((p) => p.estado === "borrador").length, "borrador", "borradores")}`
      + (despublicadas(l) ? ` · ${cuenta(despublicadas(l), "despublicada", "despublicadas")}` : "")
    : "Todavía no hay ninguno cargado");
  const publicacionProp = (cat: "tercero" | "comercio"): Segmento[] => {
    const l = props.filter((p) => p.categoria === cat);
    return [
      { etiqueta: "Publicado y al día", valor: l.filter((p) => activa(p) && !p.cambios_sin_publicar).length, color: COLOR.azul },
      { etiqueta: "Publicado con cambios sin publicar", valor: l.filter((p) => activa(p) && p.cambios_sin_publicar).length, color: COLOR.violeta },
      { etiqueta: "Borrador", valor: l.filter((p) => p.estado === "borrador").length, color: COLOR.ambar },
      { etiqueta: "Despublicado", valor: despublicadas(l), color: COLOR.gris },
    ];
  };
  const propPendientes = props.filter((p) => p.estado === "borrador" || p.cambios_sin_publicar);
  const propOrdenadas = [...props].sort((a, b) => Number(b.faltan.length > 0) - Number(a.faltan.length > 0)
    || Number(activa(b)) - Number(activa(a)) || a.titulo.localeCompare(b.titulo, "es"));
  const rutaProp = (p: ResumenPropiedad) => `/admin/${p.categoria === "tercero" ? "terceros" : "comercios"}/${p.id}`;

  // «Publicaciones incompletas» lleva a la tabla donde están (desarrollos primero).
  const irIncompletas = () => {
    setFiltroMaterial("pendientes");
    const destino = desActivos.some((c) => c.porcentaje < 100) ? refMaterial.current : refProp.current;
    destino?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

      {/* Indicadores principales: las tres categorías y lo que ven hoy los colegas */}
      <section className="adm-kpis cinco" aria-label="Indicadores principales">
        <Link to="/admin/desarrollos" className="adm-kpi">
          <span className="adm-kpi-rot">Desarrollos</span><span className="adm-kpi-num">{n(s.desarrollos)}</span>
          <span className="adm-kpi-det">{n(s.publicados)} publicados · {n(s.borradores)} {s.borradores === 1 ? "borrador" : "borradores"}{s.ocultos ? ` · ${n(s.ocultos)} ocultos` : ""}</span>
        </Link>
        <Link to="/admin/terceros" className="adm-kpi">
          <span className="adm-kpi-rot">Terceros</span><span className="adm-kpi-num">{n(terceros.length)}</span>
          <span className="adm-kpi-det">{detCat(terceros)}</span>
        </Link>
        <Link to="/admin/comercios" className="adm-kpi">
          <span className="adm-kpi-rot">Locales / oficinas</span><span className="adm-kpi-num">{n(comercios.length)}</span>
          <span className="adm-kpi-det">{detCat(comercios)}</span>
        </Link>
        <div className="adm-kpi estatico">
          <span className="adm-kpi-rot">Publicaciones activas</span><span className="adm-kpi-num">{n(activas)}</span>
          <span className="adm-kpi-det">lo que ven hoy los colegas: {n(desActivos.length)} desarrollos · {n(terceros.filter(activa).length)} terceros · {n(comercios.filter(activa).length)} locales u oficinas</span>
        </div>
        <button type="button" className={incompletas ? "adm-kpi alerta" : "adm-kpi"} onClick={irIncompletas}>
          <span className="adm-kpi-rot">Publicaciones incompletas</span><span className="adm-kpi-num">{n(incompletas)}</span>
          <span className="adm-kpi-det">{incompletas ? "publicadas con material esencial pendiente →" : "todo lo publicado tiene su material esencial"}</span>
        </button>
      </section>
      {d.propiedades.error ? <ErrorCaja texto={`No se pudieron leer Terceros y Locales / oficinas: ${d.propiedades.error}`} reintentar={inventario.recargar} /> : null}

      {/* Indicadores de los desarrollos (los que ya existían) */}
      <section className="adm-kpis tres" aria-label="Indicadores de los desarrollos">
        <Link to="/admin/unidades" className="adm-kpi">
          <span className="adm-kpi-rot">Unidades registradas</span><span className="adm-kpi-num">{n(s.unidades)}</span>
          <span className="adm-kpi-det">{n(s.unidades_disponibles)} disponibles · {n(s.unidades_reservadas)} {s.unidades_reservadas === 1 ? "reservada" : "reservadas"}{s.existe_estado_vendida ? ` · ${n(s.unidades_vendidas)} vendidas` : ""}</span>
        </Link>
        <Link to="/admin/multimedia" className="adm-kpi">
          <span className="adm-kpi-rot">Material cargado</span><span className="adm-kpi-num">{n(material)}</span>
          <span className="adm-kpi-det">fotos, renders, planos y páginas de brochure</span>
        </Link>
        <button type="button" className={atencion ? "adm-kpi alerta" : "adm-kpi"} onClick={irAtencion}>
          <span className="adm-kpi-rot">Desarrollos que requieren atención</span><span className="adm-kpi-num">{n(atencion)}</span>
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
          <label className="adm-select chico"><span className="adm-sr">Categoría</span>
            <select value={catPublicacion} onChange={(e) => setCatPublicacion(e.target.value as typeof catPublicacion)}>
              <option value="desarrollos">Desarrollos ({n(completitud.length)})</option>
              <option value="tercero">Terceros ({n(terceros.length)})</option>
              <option value="comercio">Locales / oficinas ({n(comercios.length)})</option>
            </select></label>
          {catPublicacion === "desarrollos" ? <>
            <BarraSegmentada segmentos={publicacion} unidad="desarrollos" />
            {s.en_papelera ? <p className="adm-nota">{s.en_papelera} en la papelera (no cuentan). <Link to="/admin/desarrollos?filtro=papelera">Ver papelera</Link></p> : null}
          </> : (catPublicacion === "tercero" ? terceros : comercios).length
            ? <BarraSegmentada segmentos={publicacionProp(catPublicacion)} unidad={catPublicacion === "tercero" ? "propiedades" : "locales u oficinas"} />
            : <p className="adm-graf-vacio"><b>Sin datos</b><br />Todavía no hay {catPublicacion === "tercero" ? "propiedades de terceros" : "locales u oficinas"} cargados.</p>}
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

      <section className="adm-panel" ref={refProp} aria-labelledby="t-matp" style={{ scrollMarginTop: 90 }}>
        <header className="adm-sec-cab"><h2 id="t-matp">Material de Terceros y Locales / oficinas</h2>
          <span className="adm-fuente">{props.filter((p) => !p.faltan.length).length} de {props.length} completos</span></header>
        {props.length ? (
          <div className="adm-tabla-caja">
            <table className="adm-tabla">
              <thead><tr><th>Propiedad</th><th>Categoría</th><th>Estado</th><th>Material esencial</th><th><span className="adm-sr">Acciones</span></th></tr></thead>
              <tbody>
                {propOrdenadas.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={rutaProp(p)} className="adm-fuerte">{p.titulo}</Link>
                      <span className="adm-tabla-sec">{[p.barrio, p.direccion].filter(Boolean).join(" · ") || "Sin ubicación"}</span></td>
                    <td>{p.categoria === "tercero" ? "Terceros" : "Locales / oficinas"}</td>
                    <td><EstadoPropiedad p={p} /></td>
                    <td>{p.faltan.length
                      ? <span className={activa(p) ? "adm-chip rojo" : "adm-chip ambar"}>Falta: {p.faltan.join(", ")}</span>
                      : <span className="adm-chip verde">Completo</span>}</td>
                    <td className="der">{p.faltan.length
                      ? <Link to={`${rutaProp(p)}/${p.faltan.some((f) => f === "Portada" || f === "Fotos") ? "material" : "datos"}`} className="adm-btn chico">Completar</Link>
                      : <Link to={rutaProp(p)} className="adm-btn chico">Editar</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-graf-vacio"><b>Todavía no hay propiedades de Terceros ni Locales / oficinas</b><br />
            Mientras no publiques ninguna, esas secciones muestran «Próximamente» en la página.<br />
            <Link to="/admin/terceros/nuevo">+ Nueva propiedad de terceros</Link> · <Link to="/admin/comercios/nuevo">+ Nuevo local u oficina</Link></p>
        )}
        <p className="adm-nota">Esencial: portada, ubicación (barrio o dirección), precio, superficie y al menos una foto. En rojo: publicadas con material pendiente.</p>
      </section>

      <div className="adm-dos-col">
        <section className="adm-panel" aria-labelledby="t-pend">
          <header className="adm-sec-cab"><h2 id="t-pend">Pendientes de publicar</h2><span className="adm-fuente">Borradores y cambios guardados</span></header>
          {pendientesPublicar.length || propPendientes.length ? (
            <ul className="adm-lista">
              {pendientesPublicar.map((c) => (
                <li key={c.id}>
                  <span><Link to={`/admin/desarrollos/${c.id}`}><b>{c.nombre}</b></Link>
                    <span className="adm-lista-sec">{c.estado === "borrador" ? "Borrador: todavía no está en la página" : "Tiene cambios guardados que los colegas no ven"} · {fechaHora(c.modificado_en)}</span></span>
                  <Link to={`/admin/vista-previa/${c.id}`} className="adm-btn chico" target="_blank" rel="noopener">Vista previa ↗</Link>
                </li>
              ))}
              {propPendientes.map((p) => (
                <li key={`p-${p.id}`}>
                  <span><Link to={rutaProp(p)}><b>{p.titulo}</b></Link>
                    <span className="adm-lista-sec">{p.categoria === "tercero" ? "Terceros" : "Locales / oficinas"} · {p.estado === "borrador" ? "Borrador: todavía no está en la página" : "Tiene cambios guardados que los colegas no ven"} · {fechaHora(p.modificado_en)}</span></span>
                  <Link to={`/admin/vista-previa-propiedad/${p.id}`} className="adm-btn chico" target="_blank" rel="noopener">Vista previa ↗</Link>
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
          que respete la privacidad (sin cookies ni datos personales) o activar las estadísticas de Cloudflare. Se decide más adelante.</p>
      </section>
    </div>
  );
}
