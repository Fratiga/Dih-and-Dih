import Phaser from "phaser";
import { Taberna, ANCHO, ALTO } from "./escenas/Taberna";

/* Pagina de prueba, solo para admin, igual que el resto de juegos ocultos (ver js/oculto.js en la raiz).
   En desarrollo (npm run dev) no se comprueba porque la raiz del sitio no esta servida. */
function permitido(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem("compendioAdmin") === "1";
  } catch {
    return false;
  }
}

if (!permitido()) {
  window.location.replace("../../minijuegos.html");
} else {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "juego",
    width: ANCHO,
    height: ALTO,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#0e0a08",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Taberna],
  });
}
