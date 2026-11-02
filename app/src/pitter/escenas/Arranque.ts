import Phaser from "phaser";
import { arteGlobal, EXPRESIONES } from "../arte/chibis.ts";
import { texturaCorazonBrillo, texturaEstrella, texturaPunto } from "../arte/escenarios.ts";
import { cristalSala, fondoJardin, marcoHabitacion, salaCerrada, torreBase } from "../arte/torre.ts";

/* Convierte todo el arte dibujado en codigo en texturas de Phaser, una sola vez. */
export class Arranque extends Phaser.Scene {
  constructor() { super("Arranque"); }

  create(): void {
    const arte = arteGlobal.v;
    const t = this.textures;
    if (arte) {
      for (const [id, e] of arte.chibi) for (const x of EXPRESIONES) t.addCanvas(`chibi:${id}:${x}`, e[x]);
      for (const [id, cv] of arte.ficha) t.addCanvas(`ficha:${id}`, cv);
      for (const [id, cv] of arte.retrato) t.addCanvas(`ret:${id}`, cv);
      for (const [k, cv] of Object.entries(arte.especiales)) t.addCanvas(`esp:${k}`, cv);
      for (const [k, cv] of arte.jefes) t.addCanvas(`jefe:${k}`, cv);
    }
    t.addCanvas("fondo-jardin", fondoJardin());
    t.addCanvas("torre", torreBase());
    t.addCanvas("cristal", cristalSala());
    t.addCanvas("sala-cerrada", salaCerrada());
    t.addCanvas("marco-hab", marcoHabitacion());
    t.addCanvas("fx:estrella", texturaEstrella());
    t.addCanvas("fx:punto", texturaPunto());
    t.addCanvas("fx:brillo", texturaCorazonBrillo());
    this.registry.set("listo", true);
  }
}
