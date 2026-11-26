import { useEffect, useState, type ReactNode } from "react";
import { BotonAccion } from "../componentes/BotonAccion";
import { FilaSeccion } from "../componentes/FilaSeccion";
import { Galeria } from "../componentes/Galeria";
import { Planos, rutaVisible } from "../componentes/Planos";
import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TablaDisponibles } from "../componentes/TablaDisponibles";
import { TextoLibre } from "../componentes/TextoLibre";
import { Visor, type DescargaVisor } from "../componentes/Visor";
import { useUrlMedio } from "../servicios/contexto";
import { fijarLugar, registrar } from "../servicios/cuenta";
import type { ClaveGaleria, Desarrollo, RutaMedio } from "../tipos/datos";
import { bajarBrochure } from "../utilidades/descargas";
import { esPdfPlano, etiquetaPlano, tituloPlano } from "../utilidades/planos";

/** Las filas de la ficha, en el orden del original. */
const PUNTOS = [
  ["disponibles", "Disponibles", "Unidades, precio, financiación, cuotas y fecha de entrega."],
  ["brochure", "Brochure", "La pieza institucional del desarrollo."],
  ["imagenes", "Imágenes", "Fotos reales del desarrollo: obra, unidades y entorno."],
  ["galeria", "Renders", "Imágenes en alta del desarrollo."],
  ["planos", "Planos", "Planos por tipología, con medidas."],
] as const;

type Punto = (typeof PUNTOS)[number][0];

const plural = (n: number, uno: string, varios: string) => `${n}${n === 1 ? uno : varios}`;

interface Props {
  readonly e: Desarrollo;
  readonly logo: RutaMedio;
}

/** Ficha de un desarrollo: portada, posesión y gastos, y las secciones que se abren. */
export function Ficha({ e, logo }: Props) {
  const urlMedio = useUrlMedio();
  const [visor, setVisor] = useState<{
    lista: readonly RutaMedio[]; n: number; descargas?: readonly DescargaVisor[]; rotulos?: readonly string[];
  } | null>(null);
  const rotulo = e.direccion ? e.direccion : e.desarrollista ? `Desarrolla ${e.desarrollista}` : "Desarrollo";
  const nombreBase = (e.nombre || "ZF").replace(/\s+/g, "-");
  // Opcionales: si faltan o están vacíos no se muestra nada (ni espacio en blanco).
  const condiciones = e.condiciones?.trim() ?? "";
  const descripcion = e.descripcion?.trim() ?? "";
  const escribania = e.escribania?.trim() ?? "";

  // Métricas: qué ficha abrió el colega (y a qué desarrollo corresponden sus descargas).
  useEffect(() => {
    fijarLugar({ desarrollo: e.id, nombre: e.nombre });
    registrar("ver_ficha", { desarrollo: e.id, detalle: { nombre: e.nombre } });
    return () => fijarLugar(null);
  }, [e.id, e.nombre]);

  const galeria = (clave: ClaveGaleria, plano: boolean) => {
    const lista = e[clave] ?? [];
    return (
      <Galeria lista={lista} plano={plano} nombreZip={`${nombreBase}-${clave}`}
               onAbrir={(n) => setVisor({ lista, n })} />
    );
  };

  const seccion = (clave: Punto): { etiqueta: string; contenido: (() => ReactNode) | null } => {
    switch (clave) {
      case "disponibles": {
        const n = (e.disponibles ?? []).length;
        return n ? { etiqueta: `${n} unidades`, contenido: () => <TablaDisponibles e={e} /> } : { etiqueta: "", contenido: null };
      }
      case "brochure": {
        const pags = e.brochurePags ?? [];
        if (!pags.length) return { etiqueta: "", contenido: null };
        return {
          etiqueta: `${pags.length} páginas`,
          contenido: () => (
            <>
              <div className="vinculos">
                <BotonAccion trabajando="Armando el PDF…" error="No se pudo armar el PDF — probá con internet"
                             accion={() => bajarBrochure(pags.map(urlMedio), e.nombre)}>
                  Descargar el brochure en PDF <span aria-hidden="true">&darr;</span>
                </BotonAccion>
              </div>
              {galeria("brochurePags", true)}
            </>
          ),
        };
      }
      case "planos": {
        const n = (e.planos ?? []).length;
        if (!n) return { etiqueta: "", contenido: null };
        return {
          etiqueta: plural(n, " plano", " planos"),
          contenido: () => (
            <Planos e={e} onAbrir={(vis, k, nombres) => setVisor({
              lista: vis.map(rutaVisible), n: k,
              descargas: vis.map((p, j) => ({ ruta: p.ruta, nombre: nombres[j] ?? "plano.pdf", texto: "Descargar PDF", comoPdf: !esPdfPlano(p) })),
              rotulos: vis.map((p) => [tituloPlano(p, (e.planos ?? []).indexOf(p.ruta)), etiquetaPlano(p)]
                .filter((t, j, a) => t && a.indexOf(t) === j).join(" — ")),
            })} />
          ),
        };
      }
      case "imagenes": {
        const n = (e.imagenes ?? []).length;
        return n ? { etiqueta: plural(n, " imagen", " imágenes"), contenido: () => galeria("imagenes", false) } : { etiqueta: "", contenido: null };
      }
      case "galeria": {
        const n = (e.galeria ?? []).length;
        return n ? { etiqueta: plural(n, " render", " renders"), contenido: () => galeria("galeria", false) } : { etiqueta: "", contenido: null };
      }
    }
  };

  return (
    <>
      <Portada foto={e.portada} logo={logo} rotulo={rotulo} titular={e.nombre} amplia />
      <main className="seccion col amplia gut" style={{ paddingBlock: "34px 64px" }}>
        <a className="volver" href="#desarrollos"><span aria-hidden="true">&larr;</span> Todos los desarrollos</a>
        {e.desactualizado ? (
          <p className="aviso-actualizacion" role="note">
            <span className="punto" aria-hidden="true" />
            <span><b>Pendiente de actualización</b> · algunos datos pueden no estar al día</span>
          </p>
        ) : null}
        {condiciones || descripcion || escribania ? (
          <div className="intro-ficha">
            {condiciones ? (
              <section className="condiciones" aria-labelledby="titulo-condiciones">
                <h2 id="titulo-condiciones" className="rot">Condiciones de publicación</h2>
                <TextoLibre texto={condiciones} />
              </section>
            ) : null}
            {descripcion ? <TextoLibre texto={descripcion} className="descripcion" /> : null}
            {escribania ? <p className="escribania">Escribanía: <span>{escribania}</span></p> : null}
          </div>
        ) : null}
        <p className="spec">
          Posesión: {e.posesion ? e.posesion : "a confirmar"}{"  "}<span>/</span>{"  "}Gastos de posesión: {e.gastos ? e.gastos : "a confirmar"}
        </p>
        <div className="filas">
          {PUNTOS.map(([clave, titulo, descripcion]) => {
            const s = seccion(clave);
            return <FilaSeccion key={clave} clave={clave} titulo={titulo} descripcion={descripcion}
                                etiqueta={s.etiqueta} contenido={s.contenido} />;
          })}
        </div>
      </main>
      <Pie />
      {visor ? <Visor lista={visor.lista} inicio={visor.n} descargas={visor.descargas} rotulos={visor.rotulos} onCerrar={() => setVisor(null)} /> : null}
    </>
  );
}
