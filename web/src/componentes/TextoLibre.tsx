import { bloquesDeTexto } from "../utilidades/bloques";

/** Muestra un texto cargado en el panel respetando párrafos, renglones y listas con «-». */
export function TextoLibre({ texto, className }: { readonly texto: string | undefined; readonly className?: string }) {
  const bloques = bloquesDeTexto(texto);
  if (!bloques.length) return null;
  return (
    <div className={className ? `texto-libre ${className}` : "texto-libre"}>
      {bloques.map((b, i) => b.tipo === "lista"
        ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
        : <p key={i}>{b.texto}</p>)}
    </div>
  );
}
