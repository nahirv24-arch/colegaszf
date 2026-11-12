import { useCallback, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { mensajeError } from "../servicio";
import {
  cambiarVisiblePropiedad, CATEGORIAS_PANEL, guardarPropiedad, leerPropiedad, listarPropiedades, propiedadAPapelera,
  propiedadDePapelera, publicarPropiedad, type ClavePanel, type DatosPropiedad,
} from "../servicioPropiedades";
import { Cargando, ErrorCaja, fechaHora, useAvisos, useCarga, useConfirmar } from "../ui";
import { DialogoPublicar } from "./EditarDesarrollo";
import { desdeFilaPropiedad, EstadoPropiedad, FormPropiedad } from "./FormPropiedad";
import { MaterialPropiedad } from "./MaterialPropiedad";

const PESTANAS = [["datos", "Datos"], ["material", "Fotos y documentos"]] as const;

/** Editar una propiedad de Terceros o un Comercio: datos, material, publicar / despublicar y papelera. */
export function EditarPropiedad({ clave }: { readonly clave: ClavePanel }) {
  const cat = CATEGORIAS_PANEL[clave];
  const { id = "", pestana = "datos" } = useParams();
  const navegar = useNavigate();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const carga = useCarga(async () => {
    const [fila, resumen] = await Promise.all([leerPropiedad(id), listarPropiedades(cat.db)]);
    return { fila, resumen: resumen.find((r) => r.id === id) ?? null };
  }, [id, cat.db]);
  const [guardando, setGuardando] = useState(false);
  const [publicarAbierto, setPublicarAbierto] = useState(false);
  const fila = carga.datos?.fila ?? null;
  const resumen = carga.datos?.resumen ?? null;
  const inicial = useMemo(() => (fila ? desdeFilaPropiedad(fila) : null), [fila]);
  const refrescar = carga.recargar;

  const accion = useCallback(async (f: () => Promise<void>, ok: string) => {
    try { await f(); avisar("ok", ok); refrescar(); } catch (e) { avisar("error", mensajeError(e)); }
  }, [avisar, refrescar]);

  if (carga.cargando && !carga.datos) return <Cargando />;
  if (carga.error) return <ErrorCaja texto={carga.error} reintentar={refrescar} />;
  if (!fila || !resumen || !inicial || fila.categoria !== cat.db) {
    return <ErrorCaja texto={`No existe ${cat.db === "comercio" ? "un local u oficina" : "una propiedad de terceros"} con el identificador "${id}".`} />;
  }

  const enPapelera = !!fila.eliminado_en;
  const publicada = fila.estado === "publicado";
  const vistaPrevia = `/admin/vista-previa-propiedad/${id}`;

  const guardarDatos = async (d: DatosPropiedad) => {
    setGuardando(true);
    try {
      await guardarPropiedad(id, d);
      avisar("ok", publicada ? "Cambios guardados en el borrador. La página pública no cambia hasta que publiques." : "Cambios guardados.");
      refrescar();
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setGuardando(false); }
  };

  return (
    <div className="adm-pagina">
      <div className="adm-ficha-cab">
        <div>
          <Link to={`/admin/${clave}`} className="adm-volver">{cat.volver}</Link>
          <h2 className="adm-ficha-titulo">{fila.titulo}</h2>
          <div className="adm-ficha-meta">
            <EstadoPropiedad p={resumen} />
            <span>Enlace: <code>/{clave}#{fila.id}</code></span>
            <span>{resumen.version_vigente ? `Versión publicada: ${resumen.version_vigente} (${fechaHora(resumen.publicado_en)})` : "Nunca publicado"}</span>
          </div>
          {resumen.faltan.length && !enPapelera
            ? <p className="adm-ayuda adm-falta">Material esencial pendiente: <b>{resumen.faltan.join(", ")}</b>. Se puede publicar igual.</p> : null}
        </div>
        <div className="adm-ficha-acc">
          {enPapelera ? (
            <button type="button" className="adm-btn primario" onClick={() => void accion(() => propiedadDePapelera(id), "Recuperado de la papelera.")}>Sacar de la papelera</button>
          ) : (<>
            <a className="adm-btn" href={vistaPrevia} target="_blank" rel="noopener">Vista previa ↗</a>
            <button type="button" className="adm-btn publicar" onClick={() => setPublicarAbierto(true)}
                    disabled={publicada && fila.visible && !resumen.cambios_sin_publicar}
                    title={publicada && fila.visible && !resumen.cambios_sin_publicar ? "No hay cambios sin publicar" : undefined}>
              {!publicada ? "Publicar" : !fila.visible ? "Publicar de nuevo" : "Publicar cambios"}</button>
            {publicada && fila.visible ? (
              <button type="button" className="adm-btn" onClick={async () => {
                const ok = await confirmar({ titulo: "Despublicar", confirmar: "Despublicar",
                  mensaje: <>«{fila.titulo}» deja de verse en la página de colegas <b>enseguida</b>. No se borra nada:
                    lo podés volver a publicar cuando quieras.</> });
                if (ok) await accion(() => cambiarVisiblePropiedad(id, false), "Despublicado: ya no se ve en la página.");
              }}>Despublicar</button>
            ) : null}
            <button type="button" className="adm-btn texto-peligro" onClick={async () => {
              const ok = await confirmar({ titulo: "Mandar a la papelera", peligro: true, confirmar: "Mandar a la papelera",
                mensaje: <>«{fila.titulo}» sale de la página y del listado, pero <b>no se borra</b>: lo podés recuperar
                  desde {cat.titulo} → Papelera.</> });
              if (ok) { await accion(() => propiedadAPapelera(id), "Enviado a la papelera."); navegar(`/admin/${clave}`); }
            }}>Papelera</button>
          </>)}
        </div>
      </div>

      <nav className="adm-pestanas" aria-label="Secciones">
        {PESTANAS.map(([k, t]) => (
          <NavLink key={k} to={`/admin/${clave}/${id}/${k}`} className={pestana === k ? "activo" : undefined} aria-current={pestana === k ? "page" : undefined}>{t}</NavLink>
        ))}
      </nav>

      {pestana === "material"
        ? <MaterialPropiedad propiedadId={id} onCambio={refrescar} />
        : <FormPropiedad categoria={cat.db} inicial={inicial} guardando={guardando} textoGuardar="Guardar cambios"
                         onGuardar={guardarDatos} onCancelar={() => {}} />}

      <DialogoPublicar abierto={publicarAbierto} nombre={fila.titulo} primeraVez={!publicada}
        titulo={clave === "terceros" ? "Publicar propiedad" : "Publicar local u oficina"} vistaPrevia={vistaPrevia}
        onCerrar={() => setPublicarAbierto(false)}
        onPublicar={async (nota, fecha) => {
          try {
            const v = await publicarPropiedad(id, nota, fecha);
            avisar("ok", `Publicado: versión ${v}. Ya se ve en ${cat.titulo} en la página de colegas.`);
            setPublicarAbierto(false); refrescar();
          } catch (e) { avisar("error", mensajeError(e)); }
        }} />
    </div>
  );
}
