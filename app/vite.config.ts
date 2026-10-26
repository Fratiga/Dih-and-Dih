import { defineConfig } from "vite";

/* El sitio se publica en https://fratiga.github.io/Dih-and-Dih/, no en la raiz del dominio,
   asi que todas las rutas del resultado son relativas (base "./"). El resultado compilado
   (app/dist) se sube al repositorio: GitHub Pages sigue sirviendo la rama main tal cual. */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes("node_modules/phaser") ? "phaser" : undefined),
      },
    },
  },
});
