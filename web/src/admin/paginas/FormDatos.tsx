import { useEffect, useState, type FormEvent } from "react";
import type { DatosEditables, FilaDesarrollo } from "../servicio";

const LINKS = [
  ["disponibles", "Planilla de disponibles en vivo", "Si se completa, en la ficha aparece «Abrir la planilla en vivo»."],
  ["brochure", "Brochure (enlace)", "Hoy la página no muestra este enlace; se conserva por compatibilidad."],
  ["planogeneral", "Plano general (enlace)", "Hoy la página no muestra este enlace; se conserva por compatibilidad."],
] as const;

export const VACIO: DatosEditables = {
  nombre: "", direccion: "", desarrollista: "", posesion: "", gastos: "", nota_tabla: "",
  links: { disponibles: "", brochure: "", planogeneral: "" }, disponibles_ejemplo: false, info_extra: {},
};

export function desdeFila(d: FilaDesarrollo): DatosEditables {
  return {
    nombre: d.nombre, direccion: d.direccion, desarrollista: d.desarrollista, posesion: d.posesion, gastos: d.gastos,
    nota_tabla: d.nota_tabla, links: { ...d.links }, disponibles_ejemplo: d.disponibles_ejemplo, info_extra: { ...d.info_extra },
  };
}

interface Props {
  readonly inicial: DatosEditables;
  readonly guardando: boolean;
  readonly onGuardar: (d: DatosEditables) => void;
  readonly onCancelar: () => void;
  readonly textoGuardar: string;
  readonly onCambio?: (sucio: boolean) => void;
  readonly arriba?: React.ReactNode;
  /** Avisa el nombre mientras se escribe (para proponer el enlace al crear). */
  readonly onNombre?: (nombre: string) => void;
}

/** Formulario de datos de un desarrollo. Conserva todos los campos, incluidos los vacíos. */
export function FormDatos({ inicial, guardando, onGuardar, onCancelar, textoGuardar, onCambio, arriba, onNombre }: Props) {
  const [d, setD] = useState<DatosEditables>(inicial);
  const [nuevaClave, setNuevaClave] = useState("");
  useEffect(() => { setD(inicial); }, [inicial]);
  const sucio = JSON.stringify(d) !== JSON.stringify(inicial);
  useEffect(() => { onCambio?.(sucio); }, [sucio, onCambio]);
  useEffect(() => { onNombre?.(d.nombre); }, [d.nombre, onNombre]);
  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sucio]);

  const campo = (k: "nombre" | "direccion" | "desarrollista" | "posesion" | "gastos", et: string, ph: string, req = false) => (
    <label className="adm-campo"><span>{et}{req ? " *" : ""}</span>
      <input type="text" value={d[k]} required={req} placeholder={ph} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>
  );

  const enviar = (e: FormEvent) => { e.preventDefault(); if (!d.nombre.trim()) return; onGuardar({ ...d, nombre: d.nombre.trim() }); };

  return (
    <form className="adm-form adm-form-ancho" onSubmit={enviar}>
      {arriba}
      <fieldset className="adm-grupo"><legend>Datos principales</legend>
        <div className="adm-dos">{campo("nombre", "Nombre", "Patagonia 16", true)}{campo("desarrollista", "Desarrollista", "Grupo Lofer")}</div>
        {campo("direccion", "Dirección", "Av. Vélez Sarsfield 1165, Nueva Córdoba")}
        <div className="adm-dos">{campo("posesion", "Fecha de posesión", "Marzo 2027 · Inmediata")}{campo("gastos", "Gastos de posesión", "USD 2.000")}</div>
        <p className="adm-ayuda">Se escriben tal cual se quieren mostrar. Si quedan vacíos, la página muestra «a confirmar».</p>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Tabla de disponibles</legend>
        <label className="adm-campo"><span>Nota al pie de la tabla</span>
          <textarea rows={4} value={d.nota_tabla} onChange={(e) => setD({ ...d, nota_tabla: e.target.value })}
                    placeholder="Valores al…, en dólares. Financiación…" /></label>
        <label className="adm-check"><input type="checkbox" checked={d.disponibles_ejemplo} onChange={(e) => setD({ ...d, disponibles_ejemplo: e.target.checked })} />
          <span>Mostrar el aviso «Datos de ejemplo» arriba de la tabla</span></label>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Enlaces</legend>
        {LINKS.map(([k, et, ayuda]) => (
          <label key={k} className="adm-campo"><span>{et}</span>
            <input type="url" placeholder="https://" value={d.links[k] ?? ""} onChange={(e) => setD({ ...d, links: { ...d.links, [k]: e.target.value } })} />
            <small>{ayuda}</small></label>
        ))}
      </fieldset>

      <fieldset className="adm-grupo"><legend>Información adicional (uso interno)</legend>
        <p className="adm-ayuda">Datos extra que quieras guardar con el desarrollo. Hoy no se muestran en la página pública.</p>
        {Object.entries(d.info_extra).map(([k, v]) => (
          <label key={k} className="adm-campo"><span>{k}</span>
            <input type="text" value={v} onChange={(e) => setD({ ...d, info_extra: { ...d.info_extra, [k]: e.target.value } })} /></label>
        ))}
        <div className="adm-fila-agregar">
          <input type="text" aria-label="Nombre del dato nuevo" placeholder="Nombre del dato (ej.: Amenities)" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} />
          <button type="button" className="adm-btn chico" disabled={!nuevaClave.trim() || nuevaClave.trim() in d.info_extra}
                  onClick={() => { setD({ ...d, info_extra: { ...d.info_extra, [nuevaClave.trim()]: "" } }); setNuevaClave(""); }}>Agregar dato</button>
        </div>
      </fieldset>

      <div className="adm-acciones adm-pegajoso">
        {sucio ? <span className="adm-sucio">Hay cambios sin guardar</span> : <span className="adm-ayuda">Sin cambios</span>}
        <button type="button" className="adm-btn" onClick={() => { setD(inicial); onCancelar(); }} disabled={guardando}>Cancelar</button>
        <button type="submit" className="adm-btn primario" disabled={guardando || !sucio || !d.nombre.trim()}>{guardando ? "Guardando…" : textoGuardar}</button>
      </div>
    </form>
  );
}
