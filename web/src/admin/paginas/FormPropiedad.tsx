import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { CategoriaPropiedad, Disponibilidad, Operacion } from "../../tipos/datos";
import { DETALLES, DISPONIBILIDAD, OPERACION } from "../../utilidades/propiedades";
import { validarPropiedad, type DatosPropiedad, type FilaPropiedad, type ResumenPropiedad } from "../servicioPropiedades";

/** Estado de una propiedad: Borrador · Publicado · Despublicado (+ cambios sin publicar / papelera). */
export function EstadoPropiedad({ p }: { readonly p: Pick<ResumenPropiedad, "estado" | "visible" | "eliminado_en" | "cambios_sin_publicar"> }) {
  if (p.eliminado_en) return <span className="adm-chip gris">En la papelera</span>;
  return (
    <span className="adm-chips">
      {p.estado === "borrador" ? <span className="adm-chip ambar">Borrador</span>
        : p.visible ? <span className="adm-chip verde">Publicado</span>
        : <span className="adm-chip gris">Despublicado</span>}
      {p.estado === "publicado" && p.cambios_sin_publicar ? <span className="adm-chip rojo">Cambios sin publicar</span> : null}
    </span>
  );
}

export const VACIO_PROPIEDAD: DatosPropiedad = {
  titulo: "", operacion: "", direccion: "", barrio: "", precio: "", expensas: "", superficie: "",
  disponibilidad: "disponible", descripcion: "", detalles: {}, links: {},
};

export function desdeFilaPropiedad(p: FilaPropiedad): DatosPropiedad {
  return {
    titulo: p.titulo, operacion: p.operacion, direccion: p.direccion, barrio: p.barrio, precio: p.precio,
    expensas: p.expensas, superficie: p.superficie, disponibilidad: p.disponibilidad, descripcion: p.descripcion,
    detalles: { ...p.detalles }, links: { ...p.links },
  };
}

const LINKS_FORM = [
  ["video", "Video", "YouTube, Vimeo, Google Drive…"],
  ["recorrido", "Recorrido 360°", "Enlace al recorrido virtual."],
  ["mapa", "Ubicación en el mapa", "Enlace de Google Maps."],
] as const;

const EJEMPLOS: Readonly<Record<string, string>> = {
  tipo: "Casa · Departamento · Lote", ambientes: "4", dormitorios: "3", banos: "2", cochera: "Sí, doble", antiguedad: "10 años",
  rubro: "Gastronomía, indumentaria…", frente: "8 m", planta: "Planta baja, sobre avenida",
};

interface Props {
  readonly categoria: CategoriaPropiedad;
  readonly inicial: DatosPropiedad;
  readonly guardando: boolean;
  readonly textoGuardar: string;
  readonly onGuardar: (d: DatosPropiedad) => void;
  readonly onCancelar: () => void;
  readonly arriba?: ReactNode;
  readonly onTitulo?: (t: string) => void;
}

/**
 * Formulario de una propiedad de Terceros o Comercios. Los valores se guardan como texto, tal cual
 * se escriben (los precios no se convierten). Lo vacío se muestra en la página como «a confirmar».
 * No hay campos para datos de propietarios.
 */
export function FormPropiedad({ categoria, inicial, guardando, textoGuardar, onGuardar, onCancelar, arriba, onTitulo }: Props) {
  const [d, setD] = useState<DatosPropiedad>(inicial);
  const [intentado, setIntentado] = useState(false);
  useEffect(() => { setD(inicial); setIntentado(false); }, [inicial]);
  useEffect(() => { onTitulo?.(d.titulo); }, [d.titulo, onTitulo]);
  const sucio = JSON.stringify(d) !== JSON.stringify(inicial);
  const errores = validarPropiedad(d);
  const hayErrores = Object.keys(errores).length > 0;
  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sucio]);

  const error = (k: string) => (intentado && errores[k] ? <p className="adm-error-linea" id={`err-${k}`}>{errores[k]}</p> : null);

  const texto = (k: "titulo" | "direccion" | "barrio" | "precio" | "expensas" | "superficie", et: string, ph: string, ayuda?: string) => (
    <label className="adm-campo"><span>{et}{k === "titulo" ? " *" : ""}</span>
      <input type="text" value={d[k]} placeholder={ph} required={k === "titulo"} aria-invalid={intentado && !!errores[k]}
             aria-describedby={intentado && errores[k] ? `err-${k}` : undefined}
             onChange={(e) => setD({ ...d, [k]: e.target.value })} />
      {ayuda ? <small>{ayuda}</small> : null}{error(k)}</label>
  );

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    if (hayErrores) return;
    onGuardar(d);
  };

  return (
    <form className="adm-form adm-form-ancho" onSubmit={enviar} noValidate>
      {arriba}
      <fieldset className="adm-grupo"><legend>Datos principales</legend>
        {texto("titulo", "Título", categoria === "tercero" ? "Casa en Cerro de las Rosas" : "Local sobre Av. Colón")}
        <div className="adm-dos">
          <label className="adm-campo"><span>Operación</span>
            <select value={d.operacion} onChange={(e) => setD({ ...d, operacion: e.target.value as Operacion })}>
              <option value="">Sin indicar</option>
              {(Object.keys(OPERACION) as Operacion[]).filter(Boolean).map((k) => <option key={k} value={k}>{OPERACION[k]}</option>)}
            </select></label>
          <label className="adm-campo"><span>Disponibilidad</span>
            <select value={d.disponibilidad} onChange={(e) => setD({ ...d, disponibilidad: e.target.value as Disponibilidad })}>
              {(Object.keys(DISPONIBILIDAD) as Disponibilidad[]).map((k) => <option key={k} value={k}>{DISPONIBILIDAD[k]}</option>)}
            </select>
            <small>Si no está disponible, la tarjeta lo indica. Para sacarla de la página usá «Despublicar».</small></label>
        </div>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Ubicación</legend>
        <div className="adm-dos">{texto("barrio", "Barrio", "Nueva Córdoba")}{texto("direccion", "Dirección", "Av. Hipólito Yrigoyen 500")}</div>
        <p className="adm-ayuda">Se muestra tal cual. Si preferís no publicar la dirección exacta, completá solo el barrio.</p>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Precio y superficie</legend>
        <div className="adm-dos">{texto("precio", "Precio", "USD 120.000 · $ 650.000 por mes")}{texto("expensas", "Expensas", "$ 85.000")}</div>
        {texto("superficie", "Superficie", "85 m² cubiertos · 300 m² de terreno")}
        <p className="adm-ayuda">Se escriben como se quieren mostrar, con la moneda. Si quedan vacíos, la página muestra «a confirmar».</p>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Características</legend>
        <div className="adm-dos adm-dos-col">
          {DETALLES[categoria].map(([k, et]) => (
            <label key={k} className="adm-campo"><span>{et}</span>
              <input type="text" value={d.detalles[k] ?? ""} placeholder={EJEMPLOS[k] ?? ""} maxLength={80}
                     onChange={(e) => setD({ ...d, detalles: { ...d.detalles, [k]: e.target.value } })} /></label>
          ))}
        </div>
        <p className="adm-ayuda">Opcionales: solo se muestran las que completes.</p>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Descripción</legend>
        <label className="adm-campo"><span>Texto para los colegas</span>
          <textarea rows={6} value={d.descripcion} aria-invalid={intentado && !!errores.descripcion}
                    onChange={(e) => setD({ ...d, descripcion: e.target.value })}
                    placeholder="Lo más importante de la propiedad: estado, orientación, amenities, condiciones…" />
          <small>{d.descripcion.length} / 4000 · No incluyas datos del propietario (nombre, teléfono, email).</small>
          {error("descripcion")}</label>
      </fieldset>

      <fieldset className="adm-grupo"><legend>Enlaces</legend>
        {LINKS_FORM.map(([k, et, ayuda]) => (
          <label key={k} className="adm-campo"><span>{et}</span>
            <input type="url" placeholder="https://" value={d.links[k] ?? ""} aria-invalid={intentado && !!errores[`links.${k}`]}
                   onChange={(e) => setD({ ...d, links: { ...d.links, [k]: e.target.value } })} />
            <small>{ayuda}</small>{error(`links.${k}`)}</label>
        ))}
      </fieldset>

      <div className="adm-acciones adm-pegajoso">
        {intentado && hayErrores ? <span className="adm-sucio">Revisá los campos marcados</span>
          : sucio ? <span className="adm-sucio">Hay cambios sin guardar</span> : <span className="adm-ayuda">Sin cambios</span>}
        <button type="button" className="adm-btn" onClick={() => { setD(inicial); setIntentado(false); onCancelar(); }} disabled={guardando}>Cancelar</button>
        <button type="submit" className="adm-btn primario" disabled={guardando || !sucio}>{guardando ? "Guardando…" : textoGuardar}</button>
      </div>
    </form>
  );
}
