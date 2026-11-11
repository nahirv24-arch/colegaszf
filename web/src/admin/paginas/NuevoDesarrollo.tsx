import { useState } from "react";
import { useNavigate } from "react-router";
import { crearDesarrollo, idDesdeNombre, mensajeError, type DatosEditables } from "../servicio";
import { useAvisos } from "../ui";
import { FormDatos, VACIO } from "./FormDatos";

/** Crear un desarrollo nuevo. Queda como BORRADOR: no aparece en la página hasta publicarlo. */
export function NuevoDesarrollo() {
  const navegar = useNavigate();
  const avisar = useAvisos();
  const [guardando, setGuardando] = useState(false);
  const [id, setId] = useState("");
  const [idTocado, setIdTocado] = useState(false);
  const [nombre, setNombre] = useState("");

  const idFinal = idTocado ? id : idDesdeNombre(nombre);

  const guardar = async (d: DatosEditables) => {
    setGuardando(true);
    try {
      const ident = idTocado ? id : idDesdeNombre(d.nombre);
      await crearDesarrollo(ident, d);
      avisar("ok", `"${d.nombre}" creado como borrador. Ahora podés cargar unidades y material.`);
      navegar(`/admin/desarrollos/${ident}`, { replace: true });
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setGuardando(false); }
  };

  return (
    <div className="adm-pagina">
      <p className="adm-intro">El desarrollo se crea como <b>borrador</b>: no aparece en la página de colegas hasta que lo publiques.</p>
      <FormDatos inicial={VACIO} guardando={guardando} textoGuardar="Crear borrador" onGuardar={guardar}
        onCancelar={() => navegar("/admin/desarrollos")}
        onNombre={setNombre}
        arriba={
          <fieldset className="adm-grupo"><legend>Enlace del desarrollo</legend>
            <label className="adm-campo"><span>Identificador</span>
              <div className="adm-prefijo"><span>…/#</span>
                <input type="text" value={idFinal} pattern={String.raw`[a-z0-9][a-z0-9\-]*`} title="Solo minúsculas, números y guiones" onChange={(e) => { setIdTocado(true); setId(e.target.value.toLowerCase()); }} /></div>
              <small>Se genera solo a partir del nombre (abajo). <b>Después de crearlo no se puede cambiar</b>, para que los links que se compartan sigan funcionando.</small></label>
          </fieldset>
        } />
    </div>
  );
}
