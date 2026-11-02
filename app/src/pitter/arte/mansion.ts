/* Piezas de la mansion circular: un tramo de pared con el hueco de una habitacion, el tejado, la base con la puerta y el sombreado que da forma de cilindro.
   La mansion es un edificio redondo con pisos; cada piso es un anillo de sectores que se puede girar. Un tramo de pared + su habitacion es lo que se ve en cada sector. */

import { TINTA, azar, degradado, el, lienzo, rr } from "./dibujo.ts";
import { K } from "./escenarios.ts";
import { faldon, ladrillos, tejado } from "./torre.ts";

export const SECTORES = 6;
export const PISOS = 4;
export const PANEL_W = 700;
export const PANEL_H = 350;
export const HUECO = { x: 30, y: 108, w: 640, h: 230 };
export const PASO_PISO = 340;
export const TECHO_H = 250;
export const BASE_H = 170;
export const ANCHO_MANSION = 1300;

function nuevo(w: number, h: number, k = K): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [cv, c] = lienzo(w * k, h * k);
  c.scale(k, k);
  return [cv, c];
}

/* Un tramo de pared de ladrillo con un hueco ancho para la habitacion. Cubre el desborde del diorama por arriba. */
export function panelSala(): HTMLCanvasElement {
  const [cv, c] = nuevo(PANEL_W, PANEL_H);
  ladrillos(c, 0, 0, PANEL_W, PANEL_H, 31);
  faldon(c, 0, 66, PANEL_W);
  rr(c, 0, PANEL_H - 14, PANEL_W, 14, 4, "#c97a46", 5);
  rr(c, HUECO.x - 10, HUECO.y - 10, HUECO.w + 20, HUECO.h + 20, 16, "#8a4a26", 7);
  c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.roundRect(HUECO.x, HUECO.y, HUECO.w, HUECO.h, 8); c.fillStyle = "#000"; c.fill(); c.restore();
  c.lineWidth = 7; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(HUECO.x, HUECO.y, HUECO.w, HUECO.h, 8); c.stroke();
  return cv;
}

/* Habitacion cerrada: un panel oscuro con candado que ocupa el hueco. */
export function huecoCerrado(): HTMLCanvasElement {
  const [cv, c] = nuevo(HUECO.w, HUECO.h, 1.25);
  const w = HUECO.w, h = HUECO.h;
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 8); c.clip();
  c.fillStyle = degradado(c, 0, 0, 0, h, "#4a3a6a", "#2a1a4a"); c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.lineWidth = 8; for (let x = -h; x < w; x += 36) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
  c.restore();
  rr(c, w / 2 - 36, h / 2 - 2, 72, 58, 12, "#ffd23f", 6);
  c.lineWidth = 10; c.strokeStyle = TINTA; c.beginPath(); c.arc(w / 2, h / 2 - 2, 23, Math.PI, 0); c.stroke();
  c.lineWidth = 5; c.strokeStyle = "#ffd23f"; c.beginPath(); c.arc(w / 2, h / 2 - 2, 23, Math.PI, 0); c.stroke();
  el(c, w / 2, h / 2 + 24, 7, 7, TINTA, 0);
  return cv;
}

export function techoMansion(): HTMLCanvasElement {
  const [cv, c] = nuevo(ANCHO_MANSION, TECHO_H);
  c.save(); c.translate(0, 0); c.scale(ANCHO_MANSION / 760, 1); tejado(c, 760); c.restore();
  faldon(c, 20, TECHO_H - 26, ANCHO_MANSION - 40);
  return cv;
}

export function baseMansion(): HTMLCanvasElement {
  const [cv, c] = nuevo(ANCHO_MANSION, BASE_H);
  const cx = ANCHO_MANSION / 2;
  ladrillos(c, 20, 0, ANCHO_MANSION - 40, BASE_H, 41);
  // puerta grande con arco
  rr(c, cx - 190, 14, 380, BASE_H - 14, 8, "#8a4a26", 7);
  c.beginPath(); c.moveTo(cx - 176, BASE_H); c.lineTo(cx - 176, 90); c.arc(cx, 90, 176, Math.PI, 0); c.lineTo(cx + 176, BASE_H); c.closePath();
  c.fillStyle = "#c97a46"; c.fill(); c.lineWidth = 7; c.strokeStyle = TINTA; c.stroke();
  c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, BASE_H); c.stroke();
  for (const x of [cx - 90, cx + 90]) { rr(c, x - 52, 70, 104, 86, 14, "#e29a63", 5); }
  el(c, cx - 16, 124, 9, 9, "#ffd23f", 3); el(c, cx + 16, 124, 9, 9, "#ffd23f", 3);
  // ventanas de postigos amarillos y macetas
  for (const x of [cx - 480, cx + 400]) { rr(c, x, 30, 90, 100, 8, "#ffd23f", 6); c.strokeStyle = TINTA; c.lineWidth = 3; for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(x + 6, 44 + j * 18); c.lineTo(x + 84, 44 + j * 18); c.stroke(); } }
  const r = azar(5);
  for (const x of [cx - 260, cx + 260, cx - 620, cx + 620]) { rr(c, x - 20, 118, 40, 40, 8, "#ff4f9a", 5); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x - 16 + i * 11, 108 - (i % 2) * 10, 10, 18, (i - 1.5) * 0.3, 0, Math.PI * 2); c.fillStyle = r() < 0.5 ? "#4fdc7a" : "#3cbf68"; c.fill(); c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke(); } }
  rr(c, cx - 210, BASE_H - 16, 420, 16, 6, "#ff4f9a", 5);
  return cv;
}

/* Sombreado de los lados de un piso: oscurece los bordes para que se lea como un cilindro. */
export function sombraCilindro(): HTMLCanvasElement {
  const w = ANCHO_MANSION, h = PANEL_H;
  const [cv, c] = nuevo(w, h, 0.6);
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(42,21,69,0.62)"); g.addColorStop(0.22, "rgba(42,21,69,0.18)"); g.addColorStop(0.5, "rgba(42,21,69,0)"); g.addColorStop(0.78, "rgba(42,21,69,0.18)"); g.addColorStop(1, "rgba(42,21,69,0.62)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  return cv;
}
