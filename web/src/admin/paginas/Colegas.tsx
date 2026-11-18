import { useEffect, useMemo, useState } from "react";
import { mensajeError } from "../servicio";
import { COLEGA_VACIO, erroresColega, guardarColegas, linkWhatsapp, listarColegas, type DatosColega } from "../servicioColegas";
import { Cargando, ErrorCaja, useAvisos, useCarga, useConfirmar } from "../ui";

interface Renglon {
  clave: string;
  /** null = colega nuevo, todavía sin guardar. */
  id: string | null;
  datos: DatosColega;
  original: string;
  creado_en: string | null;
}

const CAMPOS: readonly (readonly [keyof DatosColega, string, string])[] = [
  ["nombre_apellido", "Nombre y apellido", "medio"], ["telefono", "Teléfono", "medio"],
  ["inmobiliaria", "Inmobiliaria", "medio"], ["notas", "Notas", "ancho"],
];

let contador = 0;
const nuevaClave = () => `c${++contador}`;
const firma = (d: DatosColega) => JSON.stringify(d);
const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/** Registro de colegas con acceso a la página. Solo para el panel: no se publica. */
export function Colegas() {
  const { datos, cargando, error, recargar } = useCarga(listarColegas, []);
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [quitados, setQuitados] = useState<string[]>([]);
  const [buscar, setBuscar] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!datos) return;
    setRenglones(datos.map((c) => {
      const d = { nombre_apellido: c.nombre_apellido, telefono: c.telefono, inmobiliaria: c.inmobiliaria, notas: c.notas };
      return { clave: nuevaClave(), id: c.id, datos: d, original: firma(d), creado_en: c.creado_en };
    }));
    setQuitados([]);
  }, [datos]);

  const hayCambios = quitados.length > 0 || renglones.some((r) => !r.id || firma(r.datos) !== r.original);

  useEffect(() => {
    if (!hayCambios) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [hayCambios]);

  const visibles = useMemo(() => {
    const q = sinAcentos(buscar.trim());
    if (!q) return renglones;
    // Las filas nuevas siempre se ven, para no perderlas mientras se busca.
    return renglones.filter((r) => !r.id || sinAcentos(`${r.datos.nombre_apellido} ${r.datos.inmobiliaria} ${r.datos.telefono}`).includes(q));
  }, [renglones, buscar]);

  const inmobiliarias = useMemo(() => [...new Set(renglones.map((r) => r.datos.inmobiliaria.trim()).filter(Boolean))].sort(), [renglones]);

  if (cargando && !datos) return <Cargando />;
  if (error) return <ErrorCaja texto={error} reintentar={recargar} />;

  const cambiar = (clave: string, k: keyof DatosColega, v: string) =>
    setRenglones((rs) => rs.map((r) => (r.clave === clave ? { ...r, datos: { ...r.datos, [k]: v } } : r)));
  const agregar = () => setRenglones((rs) => [{ clave: nuevaClave(), id: null, datos: { ...COLEGA_VACIO }, original: "", creado_en: null }, ...rs]);
  const quitar = async (r: Renglon) => {
    if (r.id) {
      const ok = await confirmar({ titulo: "Quitar colega", confirmar: "Quitar", peligro: true,
        mensaje: <>«{r.datos.nombre_apellido || "Sin nombre"}» se borra del registro al <b>guardar</b>. No se puede recuperar.</> });
      if (!ok) return;
      setQuitados((q) => [...q, r.id!]);
    }
    setRenglones((rs) => rs.filter((x) => x.clave !== r.clave));
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      await guardarColegas({
        nuevos: renglones.filter((r) => !r.id).map((r) => r.datos),
        editados: renglones.filter((r) => r.id && firma(r.datos) !== r.original).map((r) => ({ id: r.id!, datos: r.datos })),
        quitados,
      });
      avisar("ok", "Registro de colegas guardado.");
      recargar();
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setOcupado(false); }
  };

  const guardados = renglones.filter((r) => r.id).length;

  return (
    <div className="adm-pagina">
      <p className="adm-intro">Registro de los colegas a los que les diste acceso a la página. <b>Es privado:</b> solo se ve en
        este panel y no aparece en la página de colegas.</p>

      <div className="adm-barra adm-com-barra">
        <div className="adm-com-acc">
          <label className="adm-buscar"><span className="adm-sr">Buscar</span>
            <input type="search" placeholder="Buscar por nombre, inmobiliaria o teléfono…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /></label>
          <span className="adm-ayuda">{guardados} {guardados === 1 ? "colega registrado" : "colegas registrados"}</span>
        </div>
        <div className="adm-com-acc">
          {hayCambios ? <span className="adm-com-aviso">Hay cambios sin guardar</span> : null}
          <button type="button" className="adm-btn" onClick={agregar} disabled={ocupado}>+ Agregar colega</button>
          <button type="button" className="adm-btn primario" onClick={() => void guardar()} disabled={ocupado || !hayCambios}>Guardar cambios</button>
        </div>
      </div>

      <div className="adm-tabla-caja">
        <table className="adm-tabla adm-com">
          <thead>
            <tr>
              {CAMPOS.map(([k, t]) => <th key={k}>{t}</th>)}
              <th>Cargado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const err = erroresColega(r.datos);
              const wa = linkWhatsapp(r.datos.telefono);
              return (
                <tr key={r.clave}>
                  {CAMPOS.map(([k, t, ancho]) => (
                    <td key={k} className={`adm-com-${ancho}`}>
                      {k === "notas" ? (
                        <textarea aria-label={t} rows={1} value={r.datos.notas} className={err.notas ? "con-error" : undefined}
                                  title={err.notas} onChange={(e) => cambiar(r.clave, k, e.target.value)} />
                      ) : (
                        <input type={k === "telefono" ? "tel" : "text"} aria-label={t} value={r.datos[k]}
                               list={k === "inmobiliaria" ? "adm-col-inmob" : undefined}
                               className={err[k] ? "con-error" : undefined} title={err[k]}
                               placeholder={k === "nombre_apellido" ? "Obligatorio" : k === "telefono" ? "351 123 4567" : undefined}
                               onChange={(e) => cambiar(r.clave, k, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td className="adm-nowrap">{r.id ? fecha(r.creado_en) : <span className="adm-chip ambar">Nuevo</span>}</td>
                  <td className="der adm-nowrap">
                    {wa && r.id ? <a className="adm-btn chico" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a> : null}
                    <button type="button" className="adm-btn chico texto-peligro" onClick={() => void quitar(r)} disabled={ocupado}>Quitar</button>
                  </td>
                </tr>
              );
            })}
            {!visibles.length ? (
              <tr><td colSpan={CAMPOS.length + 2} className="adm-vacio">
                {renglones.length ? "Ningún colega coincide con la búsqueda." : <>Todavía no registraste colegas. Tocá «+ Agregar colega».</>}
              </td></tr>
            ) : null}
          </tbody>
        </table>
        <datalist id="adm-col-inmob">{inmobiliarias.map((i) => <option key={i} value={i} />)}</datalist>
      </div>
      {renglones.some((r) => Object.keys(erroresColega(r.datos)).length)
        ? <p className="adm-com-error">Hay celdas marcadas en rojo: pasá el mouse por encima para ver qué falta.</p> : null}
    </div>
  );
}
