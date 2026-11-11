import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

/**
 * Las carpetas `media/` y `datos/` viven en la raíz del repositorio (fase 2) y NO se copian
 * dentro del código fuente. Este complemento:
 *   - en desarrollo (`npm run dev`) las sirve tal cual desde la raíz;
 *   - al compilar (`npm run build`) las copia a `dist/` para publicar.
 * Así hay una sola copia de cada imagen en el repositorio.
 */
const CARPETAS_PUBLICAS = ["media", "datos"] as const;
const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
};

function contenidoRaiz(): Plugin {
  return {
    name: "zf-contenido-raiz",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ruta = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
        const carpeta = CARPETAS_PUBLICAS.find((c) => ruta.startsWith(`/${c}/`));
        if (!carpeta) return next();
        const archivo = normalize(join(RAIZ, ruta));
        const base = resolve(RAIZ, carpeta) + sep;
        const tipo = TIPOS[extname(archivo).toLowerCase()];
        if (!archivo.startsWith(base) || !tipo || !existsSync(archivo) || !statSync(archivo).isFile()) {
          res.statusCode = 404;
          res.end("No encontrado");
          return;
        }
        res.setHeader("Content-Type", tipo);
        createReadStream(archivo).pipe(res);
      });
    },
    closeBundle() {
      for (const c of CARPETAS_PUBLICAS) {
        cpSync(resolve(RAIZ, c), resolve(RAIZ, "dist", c), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: resolve(RAIZ, "web"),
  // .env.local vive en la raíz del proyecto. Vite solo pasa a la página las variables VITE_*
  // (la URL y la clave pública); las secretas nunca llegan al navegador.
  envDir: RAIZ,
  base: "/",
  publicDir: resolve(RAIZ, "web", "public"),
  plugins: [react(), contenidoRaiz()],
  build: {
    outDir: resolve(RAIZ, "dist"),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
