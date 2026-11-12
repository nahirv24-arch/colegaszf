import { useState } from "react";
import { useNavigate } from "react-router";
import { idDesdeNombre, mensajeError } from "../servicio";
import { CATEGORIAS_PANEL, crearPropiedad, type ClavePanel, type DatosPropiedad } from "../servicioPropiedades";
import { useAvisos } from "../ui";
import { FormPropiedad, VACIO_PROPIEDAD } from "./FormPropiedad";

/** Crear una propiedad de Terceros o un Comercio. Queda como BORRADOR hasta publicarla. */
export function NuevaPropiedad({ clave }: { readonly clave: ClavePanel }) {
  const cat = CATEGORIAS_PANEL[clave];
  const navegar = useNavigate();
  const avisar = useAvisos();
  const [guardando, setGuardando] = useState(false);
  const [id, setId] = useState("");
  const [idTocado, setIdTocado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const idFinal = idTocado ? id : idDesdeNombre(titulo);
  const idValido = /^[a-z0-9][a-z0-9-]*$/.test(idFinal);

  const guardar = async (d: DatosPropiedad) => {
    if (!idValido) { avisar("error", "Revisá el identificador del enlace: solo minúsculas, números y guiones."); return; }
    setGuardando(true);
    try {
      await crearPropiedad(idFinal, cat.db, d);
      avisar("ok", `«${d.titulo.trim()}» creado como borrador. Ahora podés cargar fotos y documentos.`);
      navegar(`/admin/${clave}/${idFinal}/material`, { replace: true });
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setGuardando(false); }
  };

  return (
    <div className="adm-pagina">
      <p className="adm-intro">Se crea como <b>borrador</b>: no aparece en la página de colegas hasta que lo publiques.</p>
      <FormPropiedad categoria={cat.db} inicial={VACIO_PROPIEDAD} guardando={guardando} textoGuardar="Crear borrador"
        onGuardar={guardar} onCancelar={() => navegar(`/admin/${clave}`)} onTitulo={setTitulo}
        arriba={
          <fieldset className="adm-grupo"><legend>Enlace</legend>
            <label className="adm-campo"><span>Identificador</span>
              <div className="adm-prefijo"><span>…/{clave}#</span>
                <input type="text" value={idFinal} aria-invalid={!!idFinal && !idValido}
                       onChange={(e) => { setIdTocado(true); setId(e.target.value.toLowerCase()); }} /></div>
              <small>Se genera solo a partir del título. <b>Después de crearlo no se puede cambiar</b>, para que los links
                compartidos sigan funcionando. Solo minúsculas, números y guiones.</small>
              {idFinal && !idValido ? <p className="adm-error-linea">Solo minúsculas, números y guiones (sin espacios ni acentos).</p> : null}</label>
          </fieldset>
        } />
    </div>
  );
}
