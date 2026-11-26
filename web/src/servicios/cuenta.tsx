import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Ingreso, CambiarClave, AccesoPausado } from "../componentes/Ingreso";

/**
 * Cuentas de colegas en la página pública.
 * - Si la página está «cerrada» (llave en el panel), sin usuario y contraseña no se ve nada:
 *   lo bloquea la BASE DE DATOS (contenido_publico rechaza); esta pantalla solo lo explica.
 * - Con la página abierta, entrar es opcional («Ingresar» en la barra).
 * - Lo que hace un colega con sesión queda registrado (registrar_actividad) para las métricas del panel.
 * Solo funciona con los datos de Supabase; con los JSON locales todo queda como antes.
 */
const USA_SUPABASE = import.meta.env.VITE_FUENTE_DATOS === "supabase";
/** Los colegas escriben solo su usuario; por dentro, la cuenta es «usuario@colegas.zf.local». */
const DOMINIO = "colegas.zf.local";

const sb = async (): Promise<SupabaseClient> => (await import("./supabase")).obtenerSupabase();

export interface CuentaColega {
  readonly nombre: string;
  readonly usuario: string;
  readonly clave_provisoria: boolean;
  readonly activa: boolean;
}

interface EstadoPagina {
  readonly cerrada: boolean;
  readonly admin: boolean;
  readonly cuenta: CuentaColega | null;
  readonly logo: string;
}

interface ValorCuenta {
  /** Colega con sesión (null = nadie o la administradora). */
  readonly cuenta: CuentaColega | null;
  /** Se puede ofrecer «Ingresar» (página con Supabase, sin sesión). */
  readonly puedeIngresar: boolean;
  readonly abrirIngreso: () => void;
  readonly salir: () => void;
}

const Contexto = createContext<ValorCuenta>({ cuenta: null, puedeIngresar: false, abrirIngreso: () => {}, salir: () => {} });
export const useCuenta = () => useContext(Contexto);

// ---------------------------------------------------------------- registro de actividad

let colegaActivo = false;

export type TipoActividad =
  | "ingreso" | "ver_ficha" | "ver_precio" | "descarga" | "ver_propiedad" | "ver_fotos" | "descarga_fotos" | "ver_categoria";

/**
 * Anota lo que hizo el colega (solo si entró con su cuenta). No espera respuesta ni muestra errores:
 * si falla, la página sigue igual. La base ignora repeticiones idénticas en menos de 15 segundos.
 */
export function registrar(tipo: TipoActividad, datos: { desarrollo?: string; propiedad?: string; detalle?: Record<string, unknown> } = {}): void {
  if (!colegaActivo) return;
  void sb().then((c) => c.rpc("registrar_actividad", {
    p_tipo: tipo, p_desarrollo: datos.desarrollo ?? null, p_propiedad: datos.propiedad ?? null, p_detalle: datos.detalle ?? {},
  })).catch(() => {});
}

// ---------------------------------------------------------------- sesión

export async function ingresar(usuario: string, clave: string): Promise<void> {
  const u = usuario.trim().toLowerCase();
  const email = u.includes("@") ? u : `${u}@${DOMINIO}`;
  const { error } = await (await sb()).auth.signInWithPassword({ email, password: clave });
  if (!error) return;
  if (error.name === "AuthRetryableFetchError" || /fetch|network/i.test(error.message)) {
    throw new Error("No hay conexión. Revisá internet y probá de nuevo.");
  }
  if (error.status === 429) throw new Error("Demasiados intentos. Esperá unos minutos y probá de nuevo.");
  throw new Error("Usuario o contraseña incorrectos.");
}

export async function cambiarClave(nueva: string): Promise<void> {
  if (nueva.length < 10) throw new Error("La contraseña tiene que tener al menos 10 caracteres.");
  const c = await sb();
  const { error } = await c.auth.updateUser({ password: nueva });
  if (error) {
    if (/different|same/i.test(error.message)) throw new Error("Elegí una contraseña distinta de la que te dimos.");
    if (/weak|short|characters/i.test(error.message)) throw new Error("Esa contraseña es muy fácil. Probá con una más larga.");
    throw new Error("No se pudo guardar la contraseña. Probá de nuevo.");
  }
  const r = await c.rpc("marcar_clave_cambiada");
  if (r.error) throw new Error("No se pudo guardar la contraseña. Probá de nuevo.");
}

async function leerEstado(): Promise<EstadoPagina> {
  const { data, error } = await (await sb()).rpc("estado_pagina");
  if (error) throw error;
  return data as EstadoPagina;
}

const CLAVE_INGRESO = "zf-ingreso-registrado";

/** Decide qué se muestra: la página, la pantalla de ingreso o el cambio de contraseña. */
export function ProveedorCuenta({ children }: { readonly children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoPagina | "cargando" | "sin-dato">(USA_SUPABASE ? "cargando" : "sin-dato");
  const [verIngreso, setVerIngreso] = useState(false);

  const actualizar = useCallback(() => {
    leerEstado().then(setEstado, () => setEstado("sin-dato"));
  }, []);

  useEffect(() => {
    if (!USA_SUPABASE) return;
    actualizar();
    let baja: (() => void) | undefined;
    void sb().then((c) => {
      const { data } = c.auth.onAuthStateChange((evento) => {
        // Sin llamar a Supabase dentro del aviso (puede trabarse): se hace apenas termina.
        if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") window.setTimeout(actualizar, 0);
      });
      baja = () => data.subscription.unsubscribe();
    });
    return () => baja?.();
  }, [actualizar]);

  const est = typeof estado === "object" ? estado : null;
  const cuenta = est?.cuenta ?? null;
  const habilitada = !!cuenta && cuenta.activa && !cuenta.clave_provisoria;
  colegaActivo = habilitada;

  // Un «ingreso» por visita (pestaña), no uno por cada recarga.
  useEffect(() => {
    if (!habilitada || !cuenta) return;
    try {
      if (sessionStorage.getItem(CLAVE_INGRESO) === cuenta.usuario) return;
      sessionStorage.setItem(CLAVE_INGRESO, cuenta.usuario);
    } catch { /* sin almacenamiento: se registra igual */ }
    registrar("ingreso");
  }, [habilitada, cuenta]);

  const salir = useCallback(() => {
    try { sessionStorage.removeItem(CLAVE_INGRESO); } catch { /* nada */ }
    void sb().then((c) => c.auth.signOut({ scope: "local" })).finally(actualizar);
  }, [actualizar]);

  useEffect(() => { if (cuenta) setVerIngreso(false); }, [cuenta]);

  if (estado === "cargando") return null;
  if (est) {
    if (cuenta && !cuenta.activa) return <AccesoPausado logo={est.logo} nombre={cuenta.nombre} onSalir={salir} />;
    if (cuenta?.clave_provisoria) return <CambiarClave logo={est.logo} nombre={cuenta.nombre} onListo={actualizar} onSalir={salir} />;
    if (!cuenta && !est.admin && (est.cerrada || verIngreso)) {
      return <Ingreso logo={est.logo} onVolver={est.cerrada ? undefined : () => setVerIngreso(false)} />;
    }
  }
  const valor: ValorCuenta = {
    cuenta: habilitada ? cuenta : null,
    puedeIngresar: !!est && !cuenta && !est.admin,
    abrirIngreso: () => { setVerIngreso(true); window.scrollTo(0, 0); },
    salir,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// ---------------------------------------------------------------- dónde está el colega (para anotar las descargas)

let lugar: { desarrollo?: string; propiedad?: string; nombre?: string } | null = null;

/** La ficha de un desarrollo (o las fotos de una propiedad) avisan que están abiertas; null al cerrarse. */
export function fijarLugar(l: typeof lugar): void { lugar = l; }

/** Anota una descarga en el lugar abierto (brochure, plano, ZIP, foto…). */
export function anotarDescarga(clase: string, archivo: string): void {
  if (!lugar) return;
  registrar(lugar.propiedad ? "descarga_fotos" : "descarga", {
    desarrollo: lugar.desarrollo, propiedad: lugar.propiedad, detalle: { clase, archivo, nombre: lugar.nombre },
  });
}
