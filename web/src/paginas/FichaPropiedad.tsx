import { useState } from "react";
import { FilaSeccion } from "../componentes/FilaSeccion";
import { Galeria } from "../componentes/Galeria";
import { Portada } from "../componentes/Portada";
import { Visor } from "../componentes/Visor";
import { useUrlMedio } from "../servicios/contexto";
import type { Propiedad, RutaMedio } from "../tipos/datos";
import { detallesVisibles, DISPONIBILIDAD, linkSeguro, LINKS, OPERACION } from "../utilidades/propiedades";

const plural = (n: number, uno: string, varios: string) => `${n}${n === 1 ? uno : varios}`;

interface Props {
  readonly p: Propiedad;
  readonly logo: RutaMedio;
  /** "Todos los terceros", "Todos los comercios". */
  readonly volver: string;
}

/**
 * Ficha de una propiedad de Terceros o Comercios: mismo estilo que la de los desarrollos.
 * Los datos que faltan se muestran como «a confirmar»: nunca se inventan.
 */
export function FichaPropiedad({ p, logo, volver }: Props) {
  const urlMedio = useUrlMedio();
  const [visor, setVisor] = useState<{ lista: readonly RutaMedio[]; n: number } | null>(null);
  const nombreBase = (p.titulo || "ZF").replace(/\s+/g, "-");
  const detalles = detallesVisibles(p.categoria, p.detalles ?? {});
  const links = LINKS.map(([clave, etiqueta]) => [linkSeguro(p.links?.[clave]), etiqueta] as const).filter(([u]) => u);

  const galeria = (lista: readonly RutaMedio[], plano: boolean, sufijo: string) => (
    <Galeria lista={lista} plano={plano} nombreZip={`${nombreBase}-${sufijo}`} onAbrir={(n) => setVisor({ lista, n })} />
  );
  const fotos = p.fotos ?? [];
  const planos = p.planos ?? [];
  const documentos = p.documentos ?? [];

  return (
    <>
      <Portada foto={p.portada} logo={logo} inicio="/" rotulo={[p.barrio, p.direccion].filter(Boolean).join(" · ") || "ZF Propiedades"}
               titular={p.titulo} />
      <main className="seccion col gut" style={{ paddingBlock: "34px 64px" }}>
        <a className="volver" href="#"><span aria-hidden="true">&larr;</span> {volver}</a>
        <p className="spec">
          {OPERACION[p.operacion] ? <>{OPERACION[p.operacion]}{"  "}<span>/</span>{"  "}</> : null}
          Precio: {p.precio || "a confirmar"}{"  "}<span>/</span>{"  "}
          Superficie: {p.superficie || "a confirmar"}{"  "}<span>/</span>{"  "}
          {DISPONIBILIDAD[p.disponibilidad] ?? "a confirmar"}
        </p>
        {p.descripcion || detalles.length || p.expensas || links.length ? (
          <div className="prop-info">
            {p.descripcion ? <p className="prop-desc">{p.descripcion}</p> : null}
            {detalles.length || p.expensas ? (
              <dl className="prop-datos">
                {detalles.map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
                {p.expensas ? <div><dt>Expensas</dt><dd>{p.expensas}</dd></div> : null}
              </dl>
            ) : null}
            {links.length ? (
              <div className="vinculos">
                {links.map(([u, etiqueta]) => (
                  <a key={etiqueta} className="vinculo" href={u!} target="_blank" rel="noopener noreferrer">
                    {etiqueta} <span aria-hidden="true">&#8599;</span></a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="filas">
          <FilaSeccion clave="fotos" titulo="Fotos" descripcion="Imágenes de la propiedad."
                       etiqueta={plural(fotos.length, " imagen", " imágenes")}
                       contenido={fotos.length ? () => galeria(fotos, false, "fotos") : null} />
          <FilaSeccion clave="planos" titulo="Planos" descripcion="Planos y medidas."
                       etiqueta={plural(planos.length, " plano", " planos")}
                       contenido={planos.length ? () => galeria(planos, true, "planos") : null} />
          <FilaSeccion clave="documentos" titulo="Documentos"descripcion="Material comercial en PDF."
                       etiqueta={plural(documentos.length, " archivo", " archivos")}
                       contenido={documentos.length ? () => (
                         <div className="vinculos prop-docs">
                           {documentos.map((d) => (
                             <a key={d.ruta} className="vinculo" href={urlMedio(d.ruta)} target="_blank" rel="noopener">
                               {d.nombre || "Documento"} (PDF) <span aria-hidden="true">&darr;</span></a>
                           ))}
                         </div>
                       ) : null} />
        </div>
      </main>
      {visor ? <Visor lista={visor.lista} inicio={visor.n} onCerrar={() => setVisor(null)} /> : null}
    </>
  );
}
