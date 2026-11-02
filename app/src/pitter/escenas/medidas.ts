/* Medidas compartidas entre el lienzo (Phaser) y los botones de HTML, para que ambos coincidan al milimetro. */
import { DISENO_H, DISENO_W } from "../arte/escenarios.ts";

export interface Medida {
  /** Escala del fondo (cubre toda la ventana). */
  s: number;
  /** Escala de los objetos: igual que el fondo, salvo en ventanas muy estrechas, donde se encogen para no salirse. */
  sp: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export function medir(w: number, h: number): Medida {
  const s = Math.max(h / DISENO_H, w / DISENO_W);
  const sp = Math.min(s, w / 1900);
  return { s, sp, ox: w / 2 - (DISENO_W / 2) * s, oy: h / 2 - (DISENO_H / 2) * s, w, h };
}
