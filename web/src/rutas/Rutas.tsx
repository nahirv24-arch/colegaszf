import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { PaginaPublica } from "../paginas/PaginaPublica";

/** El panel se carga en un archivo aparte: los colegas nunca descargan su código. */
const AdminRaiz = lazy(() => import("../paginas/admin/AdminRaiz"));

/**
 * Rutas de la aplicación.
 *   /              página pública (la ficha se elige con "#id", compatible con los links viejos)
 *   /index.html    igual que "/"
 *   /admin/*       reservado para el panel privado (fase 4: inicio de sesión obligatorio)
 *   cualquier otra → inicio
 */
export function Rutas() {
  return (
    <Routes>
      <Route path="/" element={<PaginaPublica />} />
      <Route path="/index.html" element={<PaginaPublica />} />
      <Route path="/admin/*" element={<Suspense fallback={null}><AdminRaiz /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
