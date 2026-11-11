import { useEffect, useState } from "react";

/**
 * Compatibilidad con los links que ya tienen los colegas: /#patagonia-15, /#reggia-6…
 * La ficha de cada desarrollo se sigue eligiendo con lo que va después del "#",
 * sin distinguir mayúsculas, igual que la página original.
 */
export function leerHash(): string {
  return (window.location.hash || "").replace(/^#/, "").toLowerCase();
}

export function useHash(): string {
  const [h, setH] = useState(leerHash);
  useEffect(() => {
    const cambio = () => setH(leerHash());
    window.addEventListener("hashchange", cambio);
    window.addEventListener("popstate", cambio);
    return () => {
      window.removeEventListener("hashchange", cambio);
      window.removeEventListener("popstate", cambio);
    };
  }, []);
  return h;
}
