import { useState, type ReactNode } from "react";
import { BotonAccion } from "../componentes/BotonAccion";
import { FilaSeccion } from "../componentes/FilaSeccion";
import { Galeria } from "../componentes/Galeria";
import { Pie } from "../componentes/Pie";
import { Portada } from "../componentes/Portada";
import { TablaDisponibles } from "../componentes/TablaDisponibles";
import { Visor } from "../componentes/Visor";
import { urlMedio } from "../servicios/contexto";
import type { ClaveGaleria, Desarrollo, RutaMedio } from "../tipos/datos";
import { bajarBrochure } from "../utilidades/descargas";

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
  const [visor, setVisor] = useState<{ lista: readonly RutaMedio[]; n: number } | null>(null);
  const rotulo = e.direccion ? e.direccion : e.desarrollista ? `Desarrolla ${e.desarrollista}` : "Desarrollo";
  const nombreBase = (e.nombre || "ZF").replace(/\s+/g, "-");

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
        return n ? { etiqueta: plural(n, " plano", " planos"), contenido: () => galeria("planos", true) } : { etiqueta: "", contenido: null };
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
      <Portada foto={e.portada} logo={logo} rotulo={rotulo} titular={e.nombre} />
      <main className="seccion col gut" style={{ paddingBlock: "34px 64px" }}>
        <a className="volver" href="#"><span aria-hidden="true">&larr;</span> Todos los desarrollos</a>
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
      {visor ? <Visor lista={visor.lista} inicio={visor.n} onCerrar={() => setVisor(null)} /> : null}
    </>
  );
}
