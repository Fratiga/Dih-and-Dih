/* Medidas compartidas entre el lienzo (Phaser) y los botones de HTML, para que ambos coincidan al milimetro. */
import { DISENO_H, DISENO_W } from "../arte/escenarios.ts";
import { TORRE_H, TORRE_W, rectSala } from "../arte/torre.ts";

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

/* La torre ocupa casi toda la altura, centrada. */
export function torre(m: Medida): { sc: number; x0: number; y0: number } {
  const sc = (900 / TORRE_H) * m.s;
  return { sc, x0: m.w / 2 - (TORRE_W / 2) * sc, y0: m.oy + 72 * m.s };
}

export interface Rect { x: number; y: number; w: number; h: number }

export function rectSalaPantalla(i: number, m: Medida): Rect {
  const t = torre(m);
  const r = rectSala(i);
  return { x: t.x0 + r.x * t.sc, y: t.y0 + r.y * t.sc, w: r.w * t.sc, h: r.h * t.sc };
}

export function rectPuerta(m: Medida): Rect {
  const t = torre(m);
  return { x: t.x0 + 228 * t.sc, y: t.y0 + 968 * t.sc, w: 304 * t.sc, h: 212 * t.sc };
}
