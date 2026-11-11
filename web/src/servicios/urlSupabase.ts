/**
 * Dirección pública de un archivo del bucket "media" de Supabase.
 * Está separado de supabase.ts para que la página pública pueda armar direcciones
 * sin descargar la biblioteca de Supabase.
 */
const URL_SB = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");

export function urlPublicaMedia(ruta: string): string {
  const enBucket = ruta.replace(/^media\//, "");
  return `${URL_SB}/storage/v1/object/public/media/${enBucket.split("/").map(encodeURIComponent).join("/")}`;
}
