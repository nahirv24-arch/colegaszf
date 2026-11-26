import { useEffect, useState } from "react";
import { guardarOrdenDesarrollos, type ResumenDesarrollo } from "../servicio";
import { Modal, useAvisos } from "../ui";

/**
 * Ventana «Ordenar la página»: el orden en que los colegas ven los desarrollos en el inicio.
 * Se acomodan arrastrando o con las flechas. Tiene efecto enseguida, sin publicar.
 */
export function OrdenDesarrollos({ abierta, desarrollos, onCerrar, onGuardado }: {
  readonly abierta: boolean; readonly desarrollos: readonly ResumenDesarrollo[];
  readonly onCerrar: () => void; readonly onGuardado: () => void;
}) {
  const avisar = useAvisos();
  const [lista, setLista] = useState<ResumenDesarrollo[]>([]);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierta) setLista(desarrollos.filter((d) => !d.eliminado_en).sort((a, b) => (a.posicion - b.posicion) || a.id.localeCompare(b.id)));
  }, [abierta, desarrollos]);

  const mover = (de: number, a: number) => setLista((l) => {
    if (a < 0 || a >= l.length || de === a) return l;
    const n = [...l]; const [x] = n.splice(de, 1); if (x) n.splice(a, 0, x); return n;
  });

  const original = desarrollos.filter((d) => !d.eliminado_en).sort((a, b) => (a.posicion - b.posicion) || a.id.localeCompare(b.id));
  const cambio = lista.some((d, i) => original[i]?.id !== d.id);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarOrdenDesarrollos(lista.map((d) => d.id), new Map(desarrollos.map((d) => [d.id, d.posicion])));
      avisar("ok", "Listo: la página ya muestra los desarrollos en este orden.");
      onGuardado(); onCerrar();
    } catch (e) {
      avisar("error", e instanceof Error ? e.message : String(e));
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo="Ordenar la página" abierta={abierta} onCerrar={onCerrar} ancho={620}>
      <p className="adm-dialogo-texto">Arrastrá los desarrollos (o usá las flechas) para elegir en qué orden aparecen en el inicio.
        El primero de la lista es el primero de la página. El cambio se ve <b>enseguida</b>, sin publicar.</p>
      <ol className="adm-orden">
        {lista.map((d, i) => {
          const seVe = d.estado === "publicado" && d.visible;
          return (
            <li key={d.id} draggable className={arrastrando === i ? "arrastrando" : undefined}
                onDragStart={(e) => { setArrastrando(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (arrastrando !== null && arrastrando !== i) { mover(arrastrando, i); setArrastrando(i); } }}
                onDragEnd={() => setArrastrando(null)}>
              <span className="asa" aria-hidden="true">⋮⋮</span>
              <span className="num">{i + 1}</span>
              <span className="nom">{d.nombre}{!seVe ? <span className="adm-chip gris">{d.estado !== "publicado" ? "Borrador" : "Oculto"} · no se ve</span> : null}</span>
              <span className="flechas">
                <button type="button" className="adm-btn chico" aria-label={`Subir ${d.nombre}`} disabled={i === 0} onClick={() => mover(i, i - 1)}>↑</button>
                <button type="button" className="adm-btn chico" aria-label={`Bajar ${d.nombre}`} disabled={i === lista.length - 1} onClick={() => mover(i, i + 1)}>↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="adm-acciones">
        <button type="button" className="adm-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="adm-btn primario" disabled={!cambio || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar orden"}</button>
      </div>
    </Modal>
  );
}
