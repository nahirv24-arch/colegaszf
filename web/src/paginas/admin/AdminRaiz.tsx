import { useEffect } from "react";

/**
 * Lugar reservado para el panel de administración (/admin).
 *
 * En esta fase NO tiene inicio de sesión, formularios ni acceso a datos: solo informa que
 * todavía no está disponible. No permite ver ni cambiar nada.
 * Las funciones previstas y las del antiguo modo #editar están documentadas en MIGRACION.md.
 */
export default function AdminRaiz() {
  useEffect(() => {
    // Que los buscadores no indexen esta dirección.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <main className="seccion col gut">
      <div className="vacio">
        <div className="sub">Panel de administración</div>
        Esta sección todavía no está disponible.
        <br />
        <a className="vinculo" href="/" style={{ marginTop: 22 }}>Ir a la página de colegas</a>
      </div>
    </main>
  );
}
