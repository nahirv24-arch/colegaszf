/**
 * Convierte un texto libre cargado en el panel en bloques para mostrar:
 *   - los renglones vacíos separan párrafos;
 *   - los renglones que empiezan con «-», «•», «*» o «–» forman una lista;
 *   - los demás saltos de línea se respetan dentro del párrafo.
 * No interpreta HTML: el texto se muestra siempre como texto.
 */
export type Bloque =
  | { readonly tipo: "parrafo"; readonly texto: string }
  | { readonly tipo: "lista"; readonly items: readonly string[] };

const VINETA = /^\s*[-•*–]\s+/;

export function bloquesDeTexto(texto: string | null | undefined): Bloque[] {
  const limpio = (texto ?? "").replace(/\r\n?/g, "\n").trim();
  if (!limpio) return [];
  const bloques: Bloque[] = [];
  for (const grupo of limpio.split(/\n\s*\n/)) {
    let parrafo: string[] = [];
    let lista: string[] = [];
    const cerrarParrafo = () => { if (parrafo.length) bloques.push({ tipo: "parrafo", texto: parrafo.join("\n") }); parrafo = []; };
    const cerrarLista = () => { if (lista.length) bloques.push({ tipo: "lista", items: lista }); lista = []; };
    for (const renglon of grupo.split("\n")) {
      const r = renglon.trimEnd();
      if (!r.trim()) continue;
      if (VINETA.test(r)) { cerrarParrafo(); lista.push(r.replace(VINETA, "").trim()); }
      else { cerrarLista(); parrafo.push(r.trim()); }
    }
    cerrarParrafo();
    cerrarLista();
  }
  return bloques;
}
