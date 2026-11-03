import { defineConfig } from "vite";
import { resolve } from "node:path";

/* Solo para probar Vida Artificial sin tocar app/dist (otras sesiones compilan ahi): npx vite build --config vite.vida.config.ts */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-vida",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: { vida: resolve(import.meta.dirname, "vida.html") },
      output: { manualChunks: (id: string) => (id.includes("node_modules/phaser") ? "phaser" : undefined) },
    },
  },
});
