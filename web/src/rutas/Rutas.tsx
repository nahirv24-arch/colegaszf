import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { PaginaCategoria } from "../paginas/PaginaCategoria";
import { PaginaPublica } from "../paginas/PaginaPublica";
import { ProveedorDatos } from "../servicios/contexto";

/** El panel se carga en archivos aparte: los colegas nunca descargan su código. */
const AdminApp = lazy(() => import("../admin/AdminApp"));

/**
 * Rutas de la aplicación.
 *   /              página pública (la ficha se elige con "#id", compatible con los links viejos)
 *   /index.html    igual que "/"
 *   /terceros      propiedades de terceros   /comercios   locales y espacios comerciales
 *   /desarrollos   lleva a la grilla del inicio ("/#desarrollos")
 *   /admin/*       panel privado (inicio de sesión obligatorio; los permisos los controla Supabase)
 *   cualquier otra → inicio
 * Las páginas públicas comparten los datos: se descargan una sola vez al entrar.
 */
export function Rutas() {
  return (
    <Routes>
      <Route element={<ProveedorDatos><Outlet /></ProveedorDatos>}>
        <Route path="/" element={<PaginaPublica />} />
        <Route path="/index.html" element={<PaginaPublica />} />
        <Route path="/terceros" element={<PaginaCategoria key="terceros" clave="terceros" />} />
        <Route path="/comercios" element={<PaginaCategoria key="comercios" clave="comercios" />} />
      </Route>
      <Route path="/desarrollos" element={<Navigate to={{ pathname: "/", hash: "desarrollos" }} replace />} />
      <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
