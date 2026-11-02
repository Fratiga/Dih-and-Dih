import { defineConfig } from "vite";
import { resolve } from "node:path";

/* El sitio se publica en https://fratiga.github.io/Dih-and-Dih/, no en la raiz del dominio,
   asi que todas las rutas del resultado son relativas (base "./"). El resultado compilado
   (app/dist) se sube al repositorio: GitHub Pages sigue sirviendo la rama main tal cual.
   Hay una pieza sin pagina: fractura-tablero, el mapa de La Fractura en Phaser. La carga
   fractura.html (en la raiz) con una etiqueta de script, asi que su archivo de salida tiene un
   nombre fijo: dist/fractura/tablero.js. */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "fractura-tablero": resolve(__dirname, "src/fractura/tablero.ts"),
      },
      output: {
        entryFileNames: (chunk: { name: string }) => (chunk.name === "fractura-tablero" ? "fractura/tablero.js" : "assets/[name]-[hash].js"),
        manualChunks: (id: string) => (id.includes("node_modules/phaser") ? "phaser" : undefined),
      },
    },
  },
});
