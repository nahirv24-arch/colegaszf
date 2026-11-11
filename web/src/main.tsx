import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Rutas } from "./rutas/Rutas";
import "./estilos/index.css";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root");

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  </StrictMode>,
);
