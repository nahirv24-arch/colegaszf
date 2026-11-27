/**
 * Panel → desarrollo → «Ubicación» (27/11/2026): dónde va el pin del mapa del inicio.
 * Se toca el mapa o se arrastra el pin, y «Guardar ubicación». Efecto inmediato en la página
 * (como «Pendiente de actualización»): no hace falta publicar ni genera «cambios sin publicar».
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../estilos/mapa.css";
import { useEffect, useRef, useState } from "react";
import { cambiarUbicacion, mensajeError, type FilaDesarrollo } from "../servicio";
import { useAvisos, useConfirmar } from "../ui";

const CORDOBA: [number, number] = [-31.4201, -64.1888];

const PIN = L.divIcon({
  className: "pin-zf",
  html: '<svg viewBox="0 0 28 40" aria-hidden="true"><path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.6 14 39 14 39s12.5-16.4 12.5-25.7C26.5 6.4 21 1 14 1z"/><circle cx="14" cy="13.5" r="4.6"/></svg>',
  iconSize: [28, 40], iconAnchor: [14, 39],
});

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Acepta «-31.4285, -64.1922» (como lo copia Google Maps) o con espacios / punto y coma. */
export function leerCoordenadas(t: string): { lat: number; lng: number } | null {
  const m = t.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const [, a = "", b = ""] = m;
  const lat = Number(a.replace(",", "."));
  const lng = Number(b.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: redondear(lat), lng: redondear(lng) };
}

export function UbicacionDesarrollo({ fila, onCambio }: { readonly fila: FilaDesarrollo; readonly onCambio: () => void }) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const guardada = fila.lat !== null && fila.lat !== undefined && fila.lng !== null && fila.lng !== undefined
    ? { lat: Number(fila.lat), lng: Number(fila.lng) } : null;
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(guardada);
  const [busqueda, setBusqueda] = useState(fila.direccion ?? "");
  const [buscando, setBuscando] = useState(false);
  const [pegar, setPegar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);

  // El mapa se arma una sola vez; el pin sigue a «punto».
  useEffect(() => {
    if (!caja.current) return;
    const m = L.map(caja.current, { zoomSnap: 0.5 }).setView(guardada ? [guardada.lat, guardada.lng] : CORDOBA, guardada ? 17 : 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    m.on("click", (ev: L.LeafletMouseEvent) => setPunto({ lat: redondear(ev.latlng.lat), lng: redondear(ev.latlng.lng) }));
    mapa.current = m;
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(caja.current);
    return () => { obs.disconnect(); m.remove(); mapa.current = null; pin.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) { pin.current?.remove(); pin.current = null; return; }
    if (!pin.current) {
      pin.current = L.marker([punto.lat, punto.lng], { icon: PIN, draggable: true, autoPan: true, title: "Arrastrá el pin para moverlo" }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        setPunto({ lat: redondear(p.lat), lng: redondear(p.lng) });
      });
    } else pin.current.setLatLng([punto.lat, punto.lng]);
  }, [punto]);

  const llevarA = (p: { lat: number; lng: number }) => mapa.current?.setView([p.lat, p.lng], Math.max(mapa.current.getZoom(), 17));

  const buscar = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&accept-language=es`
        + `&viewbox=-64.40,-31.25,-64.00,-31.55&q=${encodeURIComponent(/c[oó]rdoba/i.test(q) ? q : `${q}, Córdoba`)}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const datos = (await r.json()) as { lat: string; lon: string; addresstype?: string; type?: string }[];
      const d = datos[0];
      if (!d) { avisar("error", "No encontramos esa dirección. Probá escribirla distinto o tocá el lugar en el mapa."); return; }
      const p = { lat: redondear(Number(d.lat)), lng: redondear(Number(d.lon)) };
      setPunto(p); llevarA(p);
      const exacta = d.addresstype === "building" || d.type === "house" || d.addresstype === "place";
      avisar("ok", exacta ? "Encontrada. Revisá que el pin esté en el edificio y guardá." : "Encontramos la calle, no el número exacto: arrastrá el pin al edificio y guardá.");
    } catch {
      avisar("error", "No pudimos buscar la dirección (¿hay internet?). Podés tocar el lugar en el mapa.");
    } finally { setBuscando(false); }
  };

  const usarPegadas = () => {
    const p = leerCoordenadas(pegar);
    if (!p) { avisar("error", "No son coordenadas válidas. En Google Maps: clic derecho sobre el lugar → copiar los números (ej.: -31.4285, -64.1922)."); return; }
    setPunto(p); llevarA(p); setPegar("");
  };

  const guardar = async () => {
    if (!punto) return;
    setGuardando(true);
    try {
      await cambiarUbicacion(fila.id, punto);
      avisar("ok", "Ubicación guardada. Ya se ve en el mapa de la página (no hace falta publicar).");
      onCambio();
    } catch (e) { avisar("error", mensajeError(e)); } finally { setGuardando(false); }
  };

  const quitar = async () => {
    const ok = await confirmar({ titulo: "Quitar del mapa", confirmar: "Quitar del mapa",
      mensaje: <>«{fila.nombre}» deja de aparecer en el mapa de la página <b>enseguida</b>. No se borra nada más y lo podés volver a ubicar cuando quieras.</> });
    if (!ok) return;
    setGuardando(true);
    try {
      await cambiarUbicacion(fila.id, null);
      setPunto(null);
      avisar("ok", "Quitado del mapa de la página.");
      onCambio();
    } catch (e) { avisar("error", mensajeError(e)); } finally { setGuardando(false); }
  };

  const sinGuardar = !!punto && (!guardada || guardada.lat !== punto.lat || guardada.lng !== punto.lng);

  return (
    <section className="adm-seccion adm-ubic">
      <p className="adm-ayuda">Dónde aparece el pin de <b>{fila.nombre}</b> en el mapa «Ubicaciones» del inicio.
        Buscá la dirección, o <b>tocá el lugar en el mapa</b> y arrastrá el pin hasta el edificio. Después, «Guardar ubicación».
        Se ve enseguida en la página: no hace falta publicar.</p>

      <div className="adm-ubic-barra">
        <label className="adm-campo adm-ubic-buscar"><span>Buscar dirección</span>
          <input type="text" value={busqueda} maxLength={160} onChange={(e) => setBusqueda(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscar(); } }} placeholder="Ej.: Buenos Aires 1055, Nueva Córdoba" /></label>
        <button type="button" className="adm-btn" onClick={() => void buscar()} disabled={buscando || !busqueda.trim()}>{buscando ? "Buscando…" : "Buscar"}</button>
        <label className="adm-campo adm-ubic-pegar"><span>O pegá coordenadas de Google Maps</span>
          <input type="text" value={pegar} maxLength={60} onChange={(e) => setPegar(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); usarPegadas(); } }} placeholder="-31.4285, -64.1922" /></label>
        <button type="button" className="adm-btn" onClick={usarPegadas} disabled={!pegar.trim()}>Usar</button>
      </div>

      <div className="adm-ubic-mapa"><div ref={caja} className="mapa-caja" role="region" aria-label="Mapa para ubicar el desarrollo" /></div>

      <div className="adm-ubic-pie">
        <div className="adm-ayuda">
          {punto ? <>Pin en <code>{punto.lat}, {punto.lng}</code> · <a href={`https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`} target="_blank" rel="noopener noreferrer">ver en Google Maps ↗</a></>
            : guardada ? null : <>Todavía no está en el mapa de la página.</>}
          {sinGuardar ? <b className="adm-ubic-sin"> · Sin guardar</b> : null}
        </div>
        <div className="adm-acciones">
          {guardada ? <button type="button" className="adm-btn texto-peligro" onClick={() => void quitar()} disabled={guardando}>Quitar del mapa</button> : null}
          {sinGuardar && guardada ? <button type="button" className="adm-btn" onClick={() => { setPunto(guardada); llevarA(guardada); }} disabled={guardando}>Deshacer</button> : null}
          <button type="button" className="adm-btn primario" onClick={() => void guardar()} disabled={guardando || !sinGuardar}>
            {guardando ? "Guardando…" : "Guardar ubicación"}</button>
        </div>
      </div>
    </section>
  );
}
