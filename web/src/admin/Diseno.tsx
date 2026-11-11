import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { cerrarSesion } from "../servicios/auth";
import { useSesion } from "./sesion";
import { useConfirmar } from "./ui";

/** El aviso «Entorno de prueba» solo aparece si el panel está conectado al proyecto de prueba de Supabase. */
const ES_PRUEBA = String(import.meta.env.VITE_SUPABASE_URL ?? "").includes("xwstxvbcfdizrhezulxl");

const MENU = [
  { a: "/admin", texto: "Dashboard", icono: "M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z", fin: true },
  { a: "/admin/desarrollos", texto: "Desarrollos", icono: "M4 21V8l8-5 8 5v13h-6v-6h-4v6z" },
  { a: "/admin/unidades", texto: "Unidades disponibles", icono: "M4 5h16v3H4zm0 5.5h16v3H4zM4 16h16v3H4z" },
  { a: "/admin/multimedia", texto: "Material multimedia", icono: "M4 5h16v14H4zm2 11h12l-4-5-3 4-2-2z" },
  { a: "/admin/configuracion", texto: "Configuración", icono: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.6 2h2.8l.5 2.6 1.9.8 2.2-1.5 2 2-1.5 2.2.8 1.9 2.6.5v2.8l-2.6.5-.8 1.9 1.5 2.2-2 2-2.2-1.5-1.9.8-.5 2.6h-2.8l-.5-2.6-1.9-.8-2.2 1.5-2-2 1.5-2.2-.8-1.9L2 13.4v-2.8l2.6-.5.8-1.9-1.5-2.2 2-2 2.2 1.5 1.9-.8z" },
] as const;

/** Título de la sección según la dirección. */
function tituloDe(path: string): string {
  if (path === "/admin" || path === "/admin/") return "Resumen general";
  if (path.startsWith("/admin/actividad")) return "Historial de actividad";
  if (path.startsWith("/admin/desarrollos/nuevo")) return "Nuevo desarrollo";
  if (path.startsWith("/admin/desarrollos/")) return "Desarrollo";
  const m = [...MENU].reverse().find((x) => path === x.a || path.startsWith(`${x.a}/`));
  return m?.texto ?? "Panel";
}

/** Estructura del panel: menú lateral + encabezado + contenido. */
export function Diseno() {
  const { estado } = useSesion();
  const loc = useLocation();
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => { setMenuAbierto(false); }, [loc.pathname]);

  const salir = async () => {
    if (!(await confirmar({ titulo: "Cerrar sesión", mensaje: "¿Querés salir del panel en este navegador?", confirmar: "Cerrar sesión" }))) return;
    await cerrarSesion();
    navegar("/admin/ingresar", { replace: true });
  };

  return (
    <div className={menuAbierto ? "adm adm-menu-abierto" : "adm"}>
      <a className="adm-saltar" href="#adm-contenido">Saltar al contenido</a>
      <aside className="adm-lateral" aria-label="Menú del panel">
        <div className="adm-marca">
          <img src="/media/general/logo.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div><b>ZF Propiedades</b><span>Material para colegas</span></div>
        </div>
        <nav>
          {MENU.map((m) => (
            <NavLink key={m.a} to={m.a} end={"fin" in m} className={({ isActive }) => (isActive ? "activo" : undefined)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={m.icono} /></svg>{m.texto}
            </NavLink>
          ))}
        </nav>
        <div className="adm-cuenta">
          <span className="adm-cuenta-rot">Sesión iniciada</span>
          <span className="adm-cuenta-email">{estado.tipo === "admin" ? estado.email : ""}</span>
          <div className="adm-cuenta-acc">
            <a href="/" target="_blank" rel="noopener">Ver página pública ↗</a>
            <button type="button" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>
      </aside>
      <div className="adm-principal">
        <header className="adm-cabecera">
          <button type="button" className="adm-hamburguesa" aria-label="Abrir menú" aria-expanded={menuAbierto}
                  onClick={() => setMenuAbierto(!menuAbierto)}><span /><span /><span /></button>
          <h1>{tituloDe(loc.pathname)}</h1>
          {ES_PRUEBA ? <span className="adm-entorno" title="Los cambios se guardan en el proyecto de prueba de Supabase">Entorno de prueba</span> : null}
        </header>
        <main id="adm-contenido" className="adm-contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {menuAbierto ? <button type="button" className="adm-velo" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} /> : null}
    </div>
  );
}
