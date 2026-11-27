/**
 * Mapa del inicio con un pin por desarrollo (27/11/2026). Se carga aparte (React.lazy) para que
 * el inicio no pese más: Leaflet + mapa de OpenStreetMap.
 * Junto al mapa, la lista de desarrollos: al tocar uno, el mapa va a su pin y abre su ficha.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { useMedio } from "../servicios/contexto";
import type { Desarrollo } from "../tipos/datos";

export interface PuntoMapa {
  readonly e: Desarrollo;
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
}

const PIN = (activo: boolean) => L.divIcon({
  className: activo ? "pin-zf activo" : "pin-zf",
  html: '<svg viewBox="0 0 28 40" aria-hidden="true"><path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.6 14 39 14 39s12.5-16.4 12.5-25.7C26.5 6.4 21 1 14 1z"/><circle cx="14" cy="13.5" r="4.6"/></svg>',
  iconSize: [28, 40],
  iconAnchor: [14, 39],
  popupAnchor: [0, -36],
});

/** Arma la ficha del pin con elementos (nunca con HTML armado a partir de textos cargados). */
function ficha(p: PuntoMapa, foto: string | null): HTMLElement {
  const el = (tag: string, clase: string, texto?: string) => {
    const n = document.createElement(tag);
    n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  };
  const caja = el("div", "pin-ficha");
  if (foto) {
    const img = document.createElement("img");
    img.src = foto; img.alt = ""; img.className = "pf-foto";
    caja.append(img);
  }
  caja.append(el("div", "pf-nom", p.e.nombre));
  caja.append(el("div", "pf-pos", `Posesión: ${p.e.posesion || "a confirmar"}`));
  if (p.e.direccion) caja.append(el("div", "pf-dir", p.e.direccion));
  const acciones = el("div", "pf-acc");
  const ver = el("a", "pf-ver", "Ver material →") as HTMLAnchorElement;
  ver.href = `#${p.id}`;
  const ir = el("a", "pf-ir", "Cómo llegar") as HTMLAnchorElement;
  ir.href = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  ir.target = "_blank"; ir.rel = "noopener noreferrer";
  acciones.append(ver, ir);
  caja.append(acciones);
  return caja;
}

const limites = (puntos: readonly PuntoMapa[]) => L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));

export default function MapaDesarrollos({ puntos }: { readonly puntos: readonly PuntoMapa[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcas = useRef(new Map<string, L.Marker>());
  const [activo, setActivo] = useState<string | null>(null);
  const [aviso, setAviso] = useState(true);
  const medio = useMedio();
  const medioRef = useRef(medio);
  medioRef.current = medio;

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo || !puntos.length) return;
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    const m = L.map(nodo, {
      scrollWheelZoom: false, // la rueda del mouse sigue bajando la página hasta que se toca el mapa…
      dragging: !tactil,      // …y en el celular un dedo sigue moviendo la página
      zoomSnap: 0.5,
    });
    mapa.current = m;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);

    const activar = () => {
      m.scrollWheelZoom.enable();
      m.dragging.enable();
      setAviso(false);
    };
    m.on("click", activar);
    const dosDedos = (ev: TouchEvent) => { if (ev.touches.length > 1) activar(); };
    nodo.addEventListener("touchstart", dosDedos, { passive: true });

    for (const p of puntos) {
      const mk = L.marker([p.lat, p.lng], { icon: PIN(false), title: p.e.nombre, alt: p.e.nombre, riseOnHover: true })
        .addTo(m)
        .bindPopup(() => ficha(p, p.e.portada ? medioRef.current(p.e.portada).src : null), {
          maxWidth: 260, minWidth: 220, autoPanPadding: [24, 24], className: "pin-popup",
        });
      mk.on("popupopen", () => { mk.setIcon(PIN(true)); mk.setZIndexOffset(1000); setActivo(p.id); activar(); });
      mk.on("popupclose", () => { mk.setIcon(PIN(false)); mk.setZIndexOffset(0); setActivo((a) => (a === p.id ? null : a)); });
      marcas.current.set(p.id, mk);
    }
    m.fitBounds(limites(puntos), { padding: [36, 36], maxZoom: 16 });
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(nodo);
    const lista = marcas.current;
    return () => {
      obs.disconnect();
      nodo.removeEventListener("touchstart", dosDedos);
      m.remove();
      mapa.current = null;
      lista.clear();
    };
  }, [puntos]);

  // La lista acompaña al pin elegido (en el celular es una tira que se desliza)
  const lista = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!activo || !lista.current) return;
    const b = lista.current.querySelector<HTMLElement>("button.activo");
    const ul = lista.current;
    if (!b) return;
    const horizontal = ul.scrollWidth > ul.clientWidth + 1;
    if (horizontal) ul.scrollTo({ left: b.offsetLeft - 16, behavior: "smooth" });
    else ul.scrollTo({ top: b.offsetTop - ul.clientHeight / 2 + b.offsetHeight / 2, behavior: "smooth" });
  }, [activo]);

  const ir = (p: PuntoMapa) => {
    const m = mapa.current;
    const mk = marcas.current.get(p.id);
    if (!m || !mk) return;
    m.closePopup();
    m.flyTo([p.lat, p.lng], Math.max(m.getZoom(), 16), { duration: 0.6 });
    m.once("moveend", () => mk.openPopup());
  };

  const verTodos = () => {
    const m = mapa.current;
    if (!m) return;
    m.closePopup();
    m.flyToBounds(limites(puntos), { padding: [36, 36], maxZoom: 16, duration: 0.6 });
  };

  return (
    <div className="mapa-zf">
      <div className="mapa-lienzo">
        <div ref={caja} className="mapa-caja" role="region" aria-label="Mapa con la ubicación de los desarrollos" />
        {aviso ? <div className="mapa-aviso" aria-hidden="true">Tocá un pin para ver el desarrollo</div> : null}
      </div>
      <div className="mapa-lista">
        <ul ref={lista}>
          {puntos.map((p) => (
            <li key={p.id}>
              <button type="button" className={activo === p.id ? "activo" : undefined} aria-pressed={activo === p.id} onClick={() => ir(p)}>
                <span className="ml-nom">{p.e.nombre}</span>
                {p.e.direccion ? <span className="ml-dir">{p.e.direccion}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mapa-todos" onClick={verTodos}>Ver todos en el mapa</button>
      </div>
    </div>
  );
}
