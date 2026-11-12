import { useEffect, useLayoutEffect } from "react";
import { useEstadoDatos } from "../servicios/contexto";
import { useHash } from "../utilidades/hash";
import { idDe } from "../utilidades/orden";
import { Ficha } from "./Ficha";
import { Inicio } from "./Inicio";

/** Secciones del inicio a las que se puede ir con "#". Un desarrollo con ese mismo id tendría prioridad. */
const ANCLAS = new Set(["categorias", "desarrollos"]);

/**
 * La página pública vive en "/" y elige qué mostrar según lo que va después del "#",
 * exactamente como la original: "/#reggia-6" abre Reggia 6; "/" o "/#" abre el inicio;
 * un "#" que no corresponde a ningún desarrollo también abre el inicio.
 */
export function PaginaPublica() {
  const estado = useEstadoDatos();
  const hash = useHash();

  // El antiguo modo de edición (#editar) ya no existe: se limpia la dirección y se muestra el inicio.
  useLayoutEffect(() => {
    if (hash === "editar") history.replaceState(null, "", window.location.pathname);
  }, [hash]);

  const lista = estado.tipo === "listo" ? estado.contenido.sitio.emprendimientos : [];
  const i = hash && hash !== "editar"
    ? lista.findIndex((e, k) => idDe(e, k).toLowerCase() === hash)
    : -1;
  const e = i >= 0 ? lista[i] : undefined;
  const visible = e && e.publicado !== false ? e : undefined;

  useEffect(() => {
    if (visible) window.scrollTo(0, 0);
  }, [visible]);

  // "/#desarrollos" y "/#categorias" bajan a esa sección del inicio (también al llegar desde otra página,
  // cuando la sección todavía no existía en el momento en que el navegador quiso bajar).
  const listo = estado.tipo === "listo";
  useEffect(() => {
    if (!listo || visible || !ANCLAS.has(hash)) return;
    document.getElementById(hash)?.scrollIntoView();
  }, [listo, visible, hash]);

  if (estado.tipo === "cargando") return null;
  if (estado.tipo === "error") {
    return (
      <main className="seccion col gut">
        <div className="vacio">
          <div className="sub">No pudimos cargar el material</div>
          Probá recargar la página en unos minutos.
        </div>
      </main>
    );
  }
  return visible
    ? <Ficha key={visible.id} e={visible} logo={estado.contenido.logo} />
    : <Inicio contenido={estado.contenido} />;
}
