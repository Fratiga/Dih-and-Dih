/* Medidas del corte de habitacion. La simulacion trabaja en unidades (0 a 1600); lo que se dibuja, en pixeles de un mundo de 2560 x 1440
   (16:9, asi a 1920 x 1080 se ve entero con zoom 0.75). */

export const MUNDO_W = 2560;
export const MUNDO_H = 1440;
export const SUELO_Y = 1100;
const MARGEN = 40;
const ANCHO_SIM = 1600;

/** De posicion de la simulacion a pixel del mundo. */
export const px = (x: number): number => MARGEN + (x / ANCHO_SIM) * (MUNDO_W - 2 * MARGEN);
/** Al reves. */
export const unidades = (p: number): number => ((p - MARGEN) / (MUNDO_W - 2 * MARGEN)) * ANCHO_SIM;
/** Pixeles por unidad. */
export const ESCALA = (MUNDO_W - 2 * MARGEN) / ANCHO_SIM;

export const PAL = {
  tinta: "#070f13",
  pared: "#0e1b21",
  pared2: "#13262f",
  paredLuz: "#1b3744",
  metal: "#2a3f49",
  metalLuz: "#4d6a77",
  metalOsc: "#16262e",
  cian: "#46d9e8",
  cianOsc: "#1b8d9c",
  verde: "#7cf08a",
  verdeOsc: "#2f9c55",
  ambar: "#ffb35c",
  ambarOsc: "#b8742a",
  rojo: "#ff5a4d",
  rojoOsc: "#8b2a26",
  hueso: "#d9e4de",
  madera: "#6b4a2e",
};
