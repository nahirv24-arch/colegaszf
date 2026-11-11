import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Rutas } from "./rutas/Rutas";
import { ProveedorDatos } from "./servicios/contexto";
import "./estilos/index.css";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root");

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorDatos>
        <Rutas />
      </ProveedorDatos>
    </BrowserRouter>
  </StrictMode>,
);
