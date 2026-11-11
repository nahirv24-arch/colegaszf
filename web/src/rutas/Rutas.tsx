import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { PaginaPublica } from "../paginas/PaginaPublica";
import { ProveedorDatos } from "../servicios/contexto";

/** El panel se carga en archivos aparte: los colegas nunca descargan su código. */
const AdminApp = lazy(() => import("../admin/AdminApp"));

/**
 * Rutas de la aplicación.
 *   /              página pública (la ficha se elige con "#id", compatible con los links viejos)
 *   /index.html    igual que "/"
 *   /admin/*       panel privado (inicio de sesión obligatorio; los permisos los controla Supabase)
 *   cualquier otra → inicio
 */
export function Rutas() {
  const publica = <ProveedorDatos><PaginaPublica /></ProveedorDatos>;
  return (
    <Routes>
      <Route path="/" element={publica} />
      <Route path="/index.html" element={publica} />
      <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
