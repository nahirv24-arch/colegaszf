import { useEffect, useRef, useState } from "react";
import { ORIGEN, TIPO } from "../historial";
import { leerHistorialPaginado, listarDesarrollos, type Evento, type FiltroHistorial, type OrigenEvento, type TipoEvento } from "../servicio";
import { Cargando, ErrorCaja, useCarga } from "../ui";
import { agrupar, EventoFila } from "./ActividadReciente";

/** Historial completo: filtros por origen, tipo y desarrollo; se carga de a 40 eventos. */
export function Actividad() {
  const des = useCarga(listarDesarrollos, []);
  const [filtro, setFiltro] = useState<FiltroHistorial>({ origen: "administracion" });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [estado, setEstado] = useState<{ cargando: boolean; error: string | null; fin: boolean }>({ cargando: true, error: null, fin: false });

  // Si cambian los filtros mientras llega una respuesta vieja, esa respuesta se descarta.
  const pedido = useRef(0);
  const cargar = async (desde: number | null, base: Evento[]) => {
    const n = ++pedido.current;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const nuevos = await leerHistorialPaginado(filtro, desde, 40);
      if (n !== pedido.current) return;
      setEventos([...base, ...nuevos]);
      setEstado({ cargando: false, error: null, fin: nuevos.length < 40 });
    } catch (x) {
      if (n !== pedido.current) return;
      setEstado({ cargando: false, error: x instanceof Error ? x.message : String(x), fin: false });
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setEventos([]); void cargar(null, []); }, [filtro.origen, filtro.tipo, filtro.desarrollo]);

  return (
    <div className="adm-pagina">
      <p className="adm-intro">Todos los cambios registrados. Por defecto se ven los hechos por la administración; las importaciones
        («Sistema») y las pruebas automatizadas se pueden mostrar con el filtro. El registro nunca se modifica.</p>
      <div className="adm-barra">
        <label className="adm-select"><span className="adm-sr">Origen</span>
          <select value={filtro.origen ?? ""} onChange={(e) => { const v = (e.target.value || null) as OrigenEvento | null; setFiltro((f) => ({ ...f, origen: v })); }}>
            <option value="">Todos los orígenes</option>
            {(Object.keys(ORIGEN) as OrigenEvento[]).map((k) => <option key={k} value={k}>{ORIGEN[k]}</option>)}
          </select></label>
        <label className="adm-select"><span className="adm-sr">Tipo de acción</span>
          <select value={filtro.tipo ?? ""} onChange={(e) => { const v = (e.target.value || null) as TipoEvento | null; setFiltro((f) => ({ ...f, tipo: v })); }}>
            <option value="">Todas las acciones</option>
            {(Object.keys(TIPO) as TipoEvento[]).map((k) => <option key={k} value={k}>{TIPO[k]}</option>)}
          </select></label>
        <label className="adm-select"><span className="adm-sr">Desarrollo</span>
          <select value={filtro.desarrollo ?? ""} onChange={(e) => { const v = e.target.value || null; setFiltro((f) => ({ ...f, desarrollo: v })); }}>
            <option value="">Todos los desarrollos</option>
            {(des.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select></label>
      </div>
      <section className="adm-panel">
        {estado.error ? <ErrorCaja texto={estado.error} reintentar={() => void cargar(null, [])} />
          : !eventos.length && estado.cargando ? <Cargando texto="Cargando el historial…" />
          : !eventos.length ? <p className="adm-graf-vacio"><b>Sin eventos</b><br />No hay cambios que coincidan con estos filtros.
              {filtro.origen === "administracion" ? " Los cambios hechos desde el panel van a aparecer acá." : ""}</p>
          : <ul className="adm-eventos">{agrupar(eventos).map((g) => <EventoFila key={g[0]!.id} grupo={g} />)}</ul>}
        {eventos.length && !estado.fin ? (
          <button type="button" className="adm-btn" disabled={estado.cargando} onClick={() => void cargar(eventos[eventos.length - 1]!.id, eventos)}>
            {estado.cargando ? "Cargando…" : "Cargar más"}</button>
        ) : eventos.length ? <p className="adm-nota">No hay más eventos.</p> : null}
      </section>
    </div>
  );
}
