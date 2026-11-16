import { useEffect, useMemo, useRef, useState } from "react";
import { FILA_VACIA, filaDePropiedad, filasDeCsv, MONEDAS, OPERACIONES, TIPOS, type FilaComercio } from "../../utilidades/comercios";
import { mensajeError } from "../servicio";
import { erroresFila, guardarTablaComercios, leerTablaComercios, publicarTablaComercios } from "../servicioComercios";
import { Cargando, ErrorCaja, useAvisos, useCarga, useConfirmar } from "../ui";

interface Renglon {
  /** Clave para React (no cambia aunque se reordene). */
  clave: string;
  /** null = fila nueva, todavía sin guardar. */
  id: string | null;
  fila: FilaComercio;
  /** Cómo estaba al cargar (para saber si cambió). */
  original: string;
}

const COLUMNAS: readonly (readonly [keyof FilaComercio, string, string])[] = [
  ["tipo", "Tipo", "chico"], ["operacion", "Operación", "chico"], ["direccion", "Dirección", "ancho"],
  ["barrio", "Barrio", "medio"], ["m2_totales", "m² totales", "num"],
  ["moneda", "Moneda", "chico"], ["precio", "Precio", "medio"], ["cod_tokko", "Cód. Tokko", "medio"],
  ["link", "Link para colegas", "ancho"],
];

let contador = 0;
const nuevaClave = () => `r${++contador}`;
const firma = (f: FilaComercio) => JSON.stringify(f);

/** Locales comerciales / oficinas: tabla editable, importación del CSV de Tokko y publicación de toda la tabla. */
export function TablaComerciosPanel() {
  const { datos, cargando, error, recargar } = useCarga(leerTablaComercios, []);
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [quitadas, setQuitadas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  // Al cargar (o recargar después de guardar), la tabla vuelve a lo que hay en la base.
  useEffect(() => {
    if (!datos) return;
    setRenglones(datos.filas.map((p) => {
      const fila = filaDePropiedad(p);
      return { clave: nuevaClave(), id: p.id, fila, original: firma(fila) };
    }));
    setQuitadas([]);
  }, [datos]);

  const ordenOriginal = (datos?.filas ?? []).map((p) => p.id).join(",");
  const ordenActual = renglones.filter((r) => r.id).map((r) => r.id).join(",");
  const hayCambios = quitadas.length > 0 || renglones.some((r) => !r.id || firma(r.fila) !== r.original)
    || ordenActual !== ordenOriginal;

  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [hayCambios]);

  const paraPublicar = useMemo(() => (datos?.filas ?? []).filter((p) => {
    const r = datos?.resumen[p.id];
    return r && (r.estado === "borrador" || r.cambios_sin_publicar || !r.visible);
  }).map((p) => p.id), [datos]);

  if (cargando && !datos) return <Cargando />;
  if (error) return <ErrorCaja texto={error} reintentar={recargar} />;

  const cambiar = (clave: string, k: keyof FilaComercio, v: string) =>
    setRenglones((rs) => rs.map((r) => (r.clave === clave ? { ...r, fila: { ...r.fila, [k]: v } } : r)));
  const mover = (i: number, d: -1 | 1) => setRenglones((rs) => {
    const j = i + d;
    if (j < 0 || j >= rs.length) return rs;
    const copia = [...rs];
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    return copia;
  });
  const agregar = () => setRenglones((rs) => [...rs, { clave: nuevaClave(), id: null, fila: { ...FILA_VACIA }, original: "" }]);
  const quitar = async (r: Renglon) => {
    if (r.id) {
      const ok = await confirmar({ titulo: "Quitar fila", confirmar: "Quitar", peligro: true,
        mensaje: <>«{r.fila.direccion || "Sin dirección"}» sale de la tabla al <b>guardar</b> y deja de verse en la página de colegas.
          No se borra: queda en la papelera.</> });
      if (!ok) return;
      setQuitadas((q) => [...q, r.id!]);
    }
    setRenglones((rs) => rs.filter((x) => x.clave !== r.clave));
  };

  const importar = async (f: File | undefined) => {
    if (archivo.current) archivo.current.value = "";
    if (!f) return;
    let texto: string;
    try { texto = await f.text(); } catch { avisar("error", "No se pudo leer el archivo."); return; }
    const { filas, faltan } = filasDeCsv(texto);
    if (!filas.length) { avisar("error", "El archivo no tiene filas con dirección. ¿Es el CSV de la planilla?"); return; }
    if (faltan.includes("direccion")) { avisar("error", "No encontré la columna «Dirección» en el archivo."); return; }
    const porCodigo = new Map(renglones.filter((r) => r.fila.cod_tokko).map((r) => [r.fila.cod_tokko.toUpperCase(), r]));
    let nuevas = 0, actualizadas = 0, iguales = 0;
    const actualizar = new Map<string, FilaComercio>();
    const agregadas: Renglon[] = [];
    for (const fila of filas) {
      const existe = fila.cod_tokko ? porCodigo.get(fila.cod_tokko) : undefined;
      if (!existe) { nuevas++; agregadas.push({ clave: nuevaClave(), id: null, fila, original: "" }); continue; }
      const combinada = { ...fila, link: fila.link || existe.fila.link };
      if (firma(combinada) === firma(existe.fila)) iguales++;
      else { actualizadas++; actualizar.set(existe.clave, combinada); }
    }
    const fuera = renglones.filter((r) => !filas.some((f2) => f2.cod_tokko && f2.cod_tokko === r.fila.cod_tokko.toUpperCase())).length;
    const ok = await confirmar({ titulo: "Importar CSV", confirmar: "Importar",
      mensaje: <>
        <p>En «{f.name}» hay <b>{filas.length}</b> {filas.length === 1 ? "fila" : "filas"}:
          {" "}{nuevas} {nuevas === 1 ? "nueva" : "nuevas"}, {actualizadas} con cambios y {iguales} sin cambios.</p>
        {fuera ? <p>{fuera} {fuera === 1 ? "fila de la tabla no está" : "filas de la tabla no están"} en el archivo: quedan como están (si querés sacarlas, usá «Quitar»).</p> : null}
        {faltan.length ? <p>Columnas que no encontré en el archivo (quedan vacías): {faltan.join(", ")}.</p> : null}
        <p>Después revisá la tabla y tocá <b>Guardar cambios</b>.</p>
      </> });
    if (!ok) return;
    setRenglones((rs) => [...rs.map((r) => (actualizar.has(r.clave) ? { ...r, fila: actualizar.get(r.clave)! } : r)), ...agregadas]);
  };

  const guardar = async () => {
    if (!datos) return;
    setOcupado(true);
    try {
      await guardarTablaComercios({
        filas: renglones.map((r) => ({ id: r.id, fila: r.fila, cambio: !r.id || firma(r.fila) !== r.original })),
        quitadas,
      }, datos.filas, datos.ids);
      avisar("ok", "Tabla guardada. Los colegas la ven cuando toques «Publicar tabla».");
      recargar();
    } catch (e) { avisar("error", mensajeError(e)); }
    finally { setOcupado(false); }
  };

  const publicar = async () => {
    const ok = await confirmar({ titulo: "Publicar tabla", confirmar: "Publicar",
      mensaje: <>Se {paraPublicar.length === 1 ? "publica 1 fila nueva o con cambios" : `publican ${paraPublicar.length} filas nuevas o con cambios`}.
        Los colegas la ven enseguida en <b>Locales comerciales / oficinas</b>.</> });
    if (!ok) return;
    setOcupado(true);
    try {
      const n = await publicarTablaComercios(paraPublicar);
      avisar("ok", `Tabla publicada (${n} ${n === 1 ? "fila" : "filas"}). Ya se ve en la página de colegas.`);
      recargar();
    } catch (e) { avisar("error", mensajeError(e)); recargar(); }
    finally { setOcupado(false); }
  };

  const estadoDe = (r: Renglon) => {
    if (!r.id) return <span className="adm-chip ambar">Nueva</span>;
    const res = datos?.resumen[r.id];
    if (!res || res.estado === "borrador" || !res.visible) return <span className="adm-chip ambar">Sin publicar</span>;
    if (res.cambios_sin_publicar || firma(r.fila) !== r.original) return <span className="adm-chip ambar">Cambios</span>;
    return <span className="adm-chip verde">Publicada</span>;
  };

  return (
    <div className="adm-pagina">
      <p className="adm-intro">Cargá o corregí las filas acá, o importá el <b>CSV</b> exportado de la planilla de Tokko
        (las filas se reconocen por el <b>Cód. Tokko</b>, así no se duplican). <b>Guardar cambios</b> no cambia la página:
        los colegas ven la tabla cuando tocás <b>Publicar tabla</b>.</p>

      <div className="adm-barra adm-com-barra">
        <div className="adm-com-acc">
          <button type="button" className="adm-btn" onClick={agregar} disabled={ocupado}>+ Agregar fila</button>
          <label className={ocupado ? "adm-btn desactivado" : "adm-btn"}>
            Importar CSV
            <input ref={archivo} type="file" accept=".csv,text/csv" disabled={ocupado} onChange={(e) => void importar(e.target.files?.[0])} />
          </label>
        </div>
        <div className="adm-com-acc">
          {hayCambios ? <span className="adm-com-aviso">Hay cambios sin guardar</span> : null}
          <button type="button" className="adm-btn primario" onClick={() => void guardar()} disabled={ocupado || !hayCambios}>Guardar cambios</button>
          <button type="button" className="adm-btn publicar" onClick={() => void publicar()}
                  disabled={ocupado || hayCambios || !paraPublicar.length}
                  title={hayCambios ? "Primero guardá los cambios" : !paraPublicar.length ? "No hay nada nuevo para publicar" : undefined}>
            Publicar tabla{paraPublicar.length && !hayCambios ? ` (${paraPublicar.length})` : ""}
          </button>
        </div>
      </div>

      <div className="adm-tabla-caja">
        <table className="adm-tabla adm-com">
          <thead>
            <tr>
              <th aria-label="Orden" />
              {COLUMNAS.map(([k, t]) => <th key={k}>{t}</th>)}
              <th>Estado</th>
              <th aria-label="Quitar" />
            </tr>
          </thead>
          <tbody>
            {renglones.map((r, i) => {
              const err = erroresFila(r.fila);
              return (
                <tr key={r.clave}>
                  <td className="adm-com-orden">
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === renglones.length - 1} aria-label="Bajar">↓</button>
                  </td>
                  {COLUMNAS.map(([k, t, ancho]) => (
                    <td key={k} className={`adm-com-${ancho}`}>
                      {k === "operacion" ? (
                        <select aria-label={t} value={r.fila.operacion} onChange={(e) => cambiar(r.clave, k, e.target.value)}>
                          <option value="">—</option>
                          {OPERACIONES.map(([v, et]) => <option key={v} value={v}>{et}</option>)}
                        </select>
                      ) : k === "moneda" ? (
                        <select aria-label={t} value={r.fila.moneda} onChange={(e) => cambiar(r.clave, k, e.target.value)}>
                          <option value="">—</option>
                          {[...new Set([...MONEDAS, r.fila.moneda].filter(Boolean))].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <input type={k === "link" ? "url" : "text"} aria-label={t} value={r.fila[k]}
                               list={k === "tipo" ? "adm-com-tipos" : undefined}
                               className={err[k] ? "con-error" : undefined} title={err[k]}
                               placeholder={k === "direccion" ? "Obligatoria" : undefined}
                               onChange={(e) => cambiar(r.clave, k, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td>{estadoDe(r)}</td>
                  <td className="der">
                    <button type="button" className="adm-btn chico texto-peligro" onClick={() => void quitar(r)} disabled={ocupado}>Quitar</button>
                  </td>
                </tr>
              );
            })}
            {!renglones.length ? (
              <tr><td colSpan={COLUMNAS.length + 3} className="adm-vacio">
                Todavía no hay filas. Tocá «+ Agregar fila» o «Importar CSV».<br />
                Mientras no publiques ninguna, la página de colegas muestra «Próximamente».
              </td></tr>
            ) : null}
          </tbody>
        </table>
        <datalist id="adm-com-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      {renglones.some((r) => Object.keys(erroresFila(r.fila)).length)
        ? <p className="adm-com-error">Hay celdas marcadas en rojo: pasá el mouse por encima para ver qué falta.</p> : null}
    </div>
  );
}
