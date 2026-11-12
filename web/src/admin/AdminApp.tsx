import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import "./admin.css";
import "./dashboard.css";
import { Diseno } from "./Diseno";
import { Actividad } from "./paginas/Actividad";
import { Configuracion } from "./paginas/Configuracion";
import { Dashboard } from "./paginas/Dashboard";
import { EditarDesarrollo } from "./paginas/EditarDesarrollo";
import { EditarPropiedad } from "./paginas/EditarPropiedad";
import { ElegirDesarrollo } from "./paginas/ElegirDesarrollo";
import { Ingresar, NuevaContrasena, Recuperar } from "./paginas/Acceso";
import { ListaDesarrollos } from "./paginas/ListaDesarrollos";
import { ListaPropiedades } from "./paginas/ListaPropiedades";
import { NuevaPropiedad } from "./paginas/NuevaPropiedad";
import { NuevoDesarrollo } from "./paginas/NuevoDesarrollo";
import { VistaPrevia } from "./paginas/VistaPrevia";
import { VistaPreviaPropiedad } from "./paginas/VistaPreviaPropiedad";
import { ProveedorSesion, useSesion } from "./sesion";
import { Cargando, ProveedorAvisos, ProveedorConfirmar } from "./ui";

/** Panel de administración (/admin/*). Se descarga solo al entrar acá. */
export default function AdminApp() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const titulo = document.title;
    document.title = "Panel · Material para colegas · ZF";
    document.body.classList.add("adm-body");
    return () => { meta.remove(); document.title = titulo; document.body.classList.remove("adm-body"); };
  }, []);

  return (
    <ProveedorSesion>
      <ProveedorAvisos>
        <ProveedorConfirmar>
          <Routes>
            <Route path="ingresar" element={<Ingresar />} />
            <Route path="recuperar" element={<Recuperar />} />
            <Route path="nueva-contrasena" element={<NuevaContrasena />} />
            <Route path="vista-previa/:id" element={<Protegido><VistaPrevia /></Protegido>} />
            <Route path="vista-previa-propiedad/:id" element={<Protegido><VistaPreviaPropiedad /></Protegido>} />
            <Route element={<Protegido><Diseno /></Protegido>}>
              <Route index element={<Dashboard />} />
              <Route path="desarrollos" element={<ListaDesarrollos />} />
              <Route path="desarrollos/nuevo" element={<NuevoDesarrollo />} />
              <Route path="desarrollos/:id" element={<EditarDesarrollo />} />
              <Route path="desarrollos/:id/:pestana" element={<EditarDesarrollo />} />
              <Route path="terceros" element={<ListaPropiedades key="terceros" clave="terceros" />} />
              <Route path="terceros/nuevo" element={<NuevaPropiedad key="terceros" clave="terceros" />} />
              <Route path="terceros/:id" element={<EditarPropiedad key="terceros" clave="terceros" />} />
              <Route path="terceros/:id/:pestana" element={<EditarPropiedad key="terceros" clave="terceros" />} />
              <Route path="comercios" element={<ListaPropiedades key="comercios" clave="comercios" />} />
              <Route path="comercios/nuevo" element={<NuevaPropiedad key="comercios" clave="comercios" />} />
              <Route path="comercios/:id" element={<EditarPropiedad key="comercios" clave="comercios" />} />
              <Route path="comercios/:id/:pestana" element={<EditarPropiedad key="comercios" clave="comercios" />} />
              <Route path="unidades" element={<ElegirDesarrollo destino="unidades" titulo="Unidades disponibles" />} />
              <Route path="multimedia" element={<ElegirDesarrollo destino="multimedia" titulo="Material multimedia" />} />
              <Route path="configuracion" element={<Configuracion />} />
              <Route path="actividad" element={<Actividad />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </ProveedorConfirmar>
      </ProveedorAvisos>
    </ProveedorSesion>
  );
}

/** Solo deja pasar si la base de datos confirma que la cuenta es administradora. */
function Protegido({ children }: { readonly children: React.ReactNode }) {
  const { estado } = useSesion();
  if (estado.tipo === "sin_configurar") {
    return (
      <div className="adm-acceso"><div className="adm-acceso-caja">
        <h1>Falta configurar Supabase</h1>
        <p>El archivo <code>.env.local</code> no tiene la dirección y la clave pública del proyecto.</p>
      </div></div>
    );
  }
  if (estado.tipo === "cargando") return <div className="adm-acceso"><Cargando texto="Comprobando la sesión…" /></div>;
  if (estado.tipo === "admin") return <>{children}</>;
  if (estado.tipo === "recuperando") return <Navigate to="/admin/nueva-contrasena" replace />;
  return <Navigate to="/admin/ingresar" replace />;
}
