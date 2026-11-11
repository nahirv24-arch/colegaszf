import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { esAdministrador } from "../servicios/auth";
import { obtenerSupabase, supabaseConfigurado } from "../servicios/supabase";

/**
 * Estado de la sesión del panel. La sesión la guarda Supabase en este navegador y se renueva
 * sola. "admin" solo se da si la BASE DE DATOS confirma el rol (es_admin()).
 */
export type EstadoSesion =
  | { tipo: "sin_configurar" }
  | { tipo: "cargando" }
  | { tipo: "sin_sesion" }
  | { tipo: "sin_permiso"; email: string }
  | { tipo: "recuperando"; email: string }
  | { tipo: "admin"; email: string; userId: string };

interface ValorSesion {
  estado: EstadoSesion;
  revisar: () => Promise<void>;
}

const Ctx = createContext<ValorSesion>({ estado: { tipo: "cargando" }, revisar: async () => {} });

export function ProveedorSesion({ children }: { readonly children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>(supabaseConfigurado ? { tipo: "cargando" } : { tipo: "sin_configurar" });
  const navegar = useNavigate();

  const evaluar = useCallback(async (s: Session | null) => {
    if (!s?.user) { setEstado({ tipo: "sin_sesion" }); return; }
    const email = s.user.email ?? "";
    const ok = await esAdministrador();
    setEstado(ok ? { tipo: "admin", email, userId: s.user.id } : { tipo: "sin_permiso", email });
  }, []);

  const revisar = useCallback(async () => {
    const { data } = await obtenerSupabase().auth.getSession();
    await evaluar(data.session);
  }, [evaluar]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    void revisar();
    const { data } = obtenerSupabase().auth.onAuthStateChange((evento, s) => {
      if (evento === "PASSWORD_RECOVERY") {
        setEstado({ tipo: "recuperando", email: s?.user.email ?? "" });
        navegar("/admin/nueva-contrasena", { replace: true });
        return;
      }
      if (evento === "SIGNED_OUT") { setEstado({ tipo: "sin_sesion" }); return; }
      if (evento === "SIGNED_IN" || evento === "USER_UPDATED") {
        // Se difiere para no llamar a Supabase dentro del aviso de cambio de sesión.
        setTimeout(() => { void evaluar(s); }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [evaluar, revisar, navegar]);

  return <Ctx.Provider value={{ estado, revisar }}>{children}</Ctx.Provider>;
}

export const useSesion = () => useContext(Ctx);
