import type { ReactNode } from "react";
import { Link } from "react-router";

/** Las tres categorías de material. "terceros" y "comercios" tienen su propia dirección (/terceros, /comercios). */
export type ClaveCategoria = "desarrollos" | "terceros" | "comercios";

export interface Categoria {
  readonly clave: ClaveCategoria;
  readonly nombre: string;
  readonly descripcion: string;
  readonly accion: string;
  /** Titular de la portada de la página de la categoría. */
  readonly titular: string;
  readonly icono: ReactNode;
}

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export const CATEGORIAS: readonly Categoria[] = [
  {
    clave: "desarrollos",
    nombre: "Desarrollos",
    descripcion: "Conocé nuestros proyectos y accedé a brochures, planos, renders, precios y disponibilidad.",
    accion: "Explorar desarrollos",
    titular: "Nuestros desarrollos",
    icono: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path {...trazo} d="M10 42V8h18v34M28 18h10v24M6 42h36" />
        <path {...trazo} d="M15 14h3m4 0h1M15 20h3m4 0h1M15 26h3m4 0h1M15 32h3m4 0h1M32 24h2M32 30h2M32 36h2" />
      </svg>
    ),
  },
  {
    clave: "terceros",
    nombre: "Terceros",
    descripcion: "Explorá propiedades de terceros y consultá el material comercial disponible.",
    accion: "Explorar propiedades",
    titular: "Propiedades de terceros",
    icono: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path {...trazo} d="M6 22 24 8l18 14M11 18v24h26V18" />
        <path {...trazo} d="M20 42V30h8v12M6 42h36" />
      </svg>
    ),
  },
  {
    clave: "comercios",
    nombre: "Comercios",
    descripcion: "Accedé a información y material de locales y espacios comerciales.",
    accion: "Explorar comercios",
    titular: "Locales y espacios comerciales",
    icono: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path {...trazo} d="M8 20 11 8h26l3 12M8 20c0 2.8 2.2 5 5 5s5-2.2 5-5c0 2.8 2.2 5 6 5s6-2.2 6-5c0 2.8 2.2 5 5 5s5-2.2 5-5" />
        <path {...trazo} d="M10 25v17h28V25M20 42V32h8v10M6 42h36" />
      </svg>
    ),
  },
];

export function categoria(clave: ClaveCategoria): Categoria {
  return CATEGORIAS.find((c) => c.clave === clave)!;
}

/** Contenido de una tarjeta (la tarjeta entera es el enlace). */
function Contenido({ c }: { readonly c: Categoria }) {
  return (
    <>
      <span className="cat-ico">{c.icono}</span>
      <span className="cat-nom">{c.nombre}</span>
      <span className="cat-des">{c.descripcion}</span>
      <span className="cat-ir">{c.accion} <span className="cat-flecha" aria-hidden="true">&rarr;</span></span>
    </>
  );
}

/**
 * Sección del inicio, debajo de la portada: "¿Qué material estás buscando?" con las tres tarjetas.
 * Desarrollos baja a la grilla de esta misma página (/#desarrollos); las otras dos abren su página.
 */
export function Categorias() {
  return (
    <section className="categorias col gut" id="categorias" aria-labelledby="categorias-titulo">
      <div className="cabecera">
        <h2 className="titulo" id="categorias-titulo">¿Qué material estás buscando?</h2>
        <p>Explorá nuestros desarrollos, propiedades de terceros y espacios comerciales. Toda la información que
          necesitás, en un solo lugar.</p>
      </div>
      <ul className="cats">
        {CATEGORIAS.map((c) => (
          <li key={c.clave}>
            {c.clave === "desarrollos"
              ? <a className="cat" href="#desarrollos"><Contenido c={c} /></a>
              : <Link className="cat" to={`/${c.clave}`}><Contenido c={c} /></Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
