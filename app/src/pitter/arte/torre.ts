/* La mansion del menu, vista en corte como en el Pitter-Patter original: una torre de ladrillo con tejado naranja, buhardilla y chimeneas,
   hiedra a un lado y UNA habitacion ancha por piso (tres pisos), con la puerta grande abajo.
   Los huecos de las habitaciones estan recortados en el dibujo: lo que hay dentro (el diorama, los muebles y los personajes) se ve por detras del hueco. */

import { TINTA, azar, degradado, el, lienzo, poligono, rr, sparkle } from "./dibujo.ts";
import { K } from "./escenarios.ts";

export const TORRE_W = 760;
export const TORRE_H = 1180;
export const SALA_W = 632;
export const SALA_H = 230;
export const SALAS_MAX = 3;

/* Cada habitacion es un piso: 0 abajo, 1 en medio, 2 arriba. Coordenadas dentro del lienzo de la torre. */
export function rectSala(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 64, y: 250 + (2 - i) * 270, w: SALA_W, h: SALA_H };
}

function nuevo(w: number, h: number, k = K): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [cv, c] = lienzo(w * k, h * k);
  c.scale(k, k);
  return [cv, c];
}

export function ladrillos(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, semilla: number): void {
  const r = azar(semilla);
  rr(c, x, y, w, h, 6, "#fbeed8", 6);
  const alto = 34;
  for (let j = 0, yy = y + 6; yy < y + h - 8; j++, yy += alto) {
    c.strokeStyle = "rgba(42,21,69,0.22)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + w - 4, yy); c.stroke();
    const ancho = 54;
    for (let xx = x + 6 + (j % 2) * ancho / 2; xx < x + w - 4; xx += ancho) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, Math.min(yy + alto, y + h - 4)); c.stroke(); if (r() < 0.2) { c.fillStyle = "rgba(232,164,104,0.8)"; c.fillRect(xx + 3, yy + 3, ancho - 6, alto - 6); } }
  }
  c.strokeStyle = TINTA; c.lineWidth = 6; c.beginPath(); c.roundRect(x, y, w, h, 6); c.stroke();
}

/* Faldon naranja con dientes de sierra, el que cuelga bajo cada piso. */
export function faldon(c: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  rr(c, x, y, w, 22, 6, "#fbeed8", 6);
  for (let xx = x + 4; xx < x + w - 14; xx += 28) poligono(c, [[xx, y + 22], [xx + 24, y + 22], [xx + 12, y + 40]], "#e8a468", 4);
}

export function tejado(c: CanvasRenderingContext2D, ancho: number): void {
  const cx = ancho / 2;
  // chimeneas
  for (const x of [cx - 250, cx + 190]) {
    rr(c, x, 20, 60, 100, 6, "#e8a468", 6);
    for (let j = 0; j < 3; j++) { c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(x + 8, 34 + j * 26, 18, 14); c.fillRect(x + 34, 34 + j * 26, 18, 14); }
    rr(c, x - 8, 8, 76, 18, 4, "#fbeed8", 6);
  }
  // cuerpo del tejado: cupula naranja
  c.beginPath(); c.moveTo(30, 232); c.quadraticCurveTo(40, 80, cx, 30); c.quadraticCurveTo(ancho - 40, 80, ancho - 30, 232); c.closePath();
  c.fillStyle = degradado(c, 0, 30, 0, 232, "#ff9a3a", "#f07a1e"); c.fill(); c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
  c.save(); c.clip();
  const r = azar(4);
  for (let y = 50; y < 232; y += 26) for (let x = 20 + ((y / 26) % 2) * 22; x < ancho; x += 44) { c.fillStyle = r() < 0.3 ? "rgba(255,200,120,0.45)" : "rgba(180,70,10,0.18)"; c.beginPath(); c.ellipse(x, y, 18, 11, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // buhardilla
  poligono(c, [[cx - 92, 232], [cx - 92, 110], [cx + 92, 110], [cx + 92, 232]], "#fbeed8", 7);
  poligono(c, [[cx - 118, 118], [cx, 52], [cx + 118, 118], [cx + 100, 126], [cx, 74], [cx - 100, 126]], "#e8602a", 7);
  c.beginPath(); c.moveTo(cx - 52, 232); c.lineTo(cx - 52, 168); c.arc(cx, 168, 52, Math.PI, 0); c.lineTo(cx + 52, 232); c.closePath();
  c.fillStyle = "#cfeaff"; c.fill(); c.lineWidth = 8; c.strokeStyle = "#a85a2a"; c.stroke();
  c.lineWidth = 5; c.strokeStyle = "#a85a2a"; c.beginPath(); c.moveTo(cx, 116); c.lineTo(cx, 232); c.moveTo(cx - 52, 180); c.lineTo(cx + 52, 180); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.moveTo(cx - 40, 150); c.lineTo(cx - 20, 150); c.lineTo(cx - 40, 190); c.lineTo(cx - 48, 190); c.fill();
}

export function torreBase(): HTMLCanvasElement {
  const [cv, c] = nuevo(TORRE_W, TORRE_H);
  const cx = TORRE_W / 2;
  c.fillStyle = "rgba(42,21,69,0.35)"; c.beginPath(); c.ellipse(cx, TORRE_H - 10, 390, 26, 0, 0, Math.PI * 2); c.fill();
  // cuerpo de ladrillo
  ladrillos(c, 14, 226, TORRE_W - 28, TORRE_H - 236, 11);
  // sombreado del lado derecho y brillo del izquierdo
  c.fillStyle = "rgba(42,21,69,0.12)"; c.fillRect(TORRE_W - 60, 232, 44, TORRE_H - 250);
  c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(20, 232, 30, TORRE_H - 250);
  tejado(c, TORRE_W);
  // faldon bajo el tejado y bajo cada piso
  faldon(c, 6, 222, TORRE_W - 12);
  for (let i = 0; i < SALAS_MAX; i++) { const s = rectSala(i); faldon(c, 6, s.y + s.h + 8, TORRE_W - 12); }
  // marco de cada habitacion y hueco
  for (let i = 0; i < SALAS_MAX; i++) {
    const s = rectSala(i);
    rr(c, s.x - 10, s.y - 10, s.w + 20, s.h + 20, 18, "#8a4a26", 8);
  }
  c.save(); c.globalCompositeOperation = "destination-out";
  for (let i = 0; i < SALAS_MAX; i++) { const s = rectSala(i); c.beginPath(); c.roundRect(s.x, s.y, s.w, s.h, 10); c.fillStyle = "#000"; c.fill(); }
  c.restore();
  for (let i = 0; i < SALAS_MAX; i++) { const s = rectSala(i); c.lineWidth = 7; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(s.x, s.y, s.w, s.h, 10); c.stroke(); }
  // hiedra por el lado izquierdo
  const r = azar(9);
  for (let i = 0; i < 26; i++) { const y = 250 + r() * 880; el(c, 22 + r() * 30, y, 16 + r() * 10, 11 + r() * 6, i % 3 ? "#4fdc7a" : "#2fa85a", 4); }
  for (let i = 0; i < 8; i++) { const y = 260 + r() * 800; el(c, TORRE_W - 20 - r() * 14, y, 12, 9, i % 2 ? "#4fdc7a" : "#3cbf68", 3); }
  // base con la puerta grande
  rr(c, 214, 1040, 332, 140, 8, "#8a4a26", 7);
  c.beginPath(); c.moveTo(228, 1180); c.lineTo(228, 1120); c.arc(cx, 1120, 152, Math.PI, 0); c.lineTo(532, 1180); c.closePath();
  c.fillStyle = "#c97a46"; c.fill(); c.lineWidth = 7; c.strokeStyle = TINTA; c.stroke();
  c.beginPath(); c.moveTo(cx, 968 + 0); c.lineTo(cx, 1180); c.lineWidth = 6; c.stroke();
  for (const x of [cx - 80, cx + 80]) { rr(c, x - 44, 1078, 88, 84, 14, "#e29a63", 5); c.strokeStyle = "rgba(42,21,69,0.5)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 30, 1100); c.lineTo(x + 30, 1100); c.moveTo(x - 30, 1124); c.lineTo(x + 30, 1124); c.stroke(); }
  el(c, cx - 14, 1124, 9, 9, "#ffd23f", 3); el(c, cx + 14, 1124, 9, 9, "#ffd23f", 3);
  // ventana de postigos amarillos
  rr(c, 90, 1060, 90, 96, 8, "#ffd23f", 6); rr(c, 600, 1060, 90, 96, 8, "#ffd23f", 6);
  c.strokeStyle = TINTA; c.lineWidth = 3; for (let j = 0; j < 5; j++) { for (const x0 of [90, 600]) { c.beginPath(); c.moveTo(x0 + 6, 1072 + j * 18); c.lineTo(x0 + 84, 1072 + j * 18); c.stroke(); } }
  // alfombra y macetas
  rr(c, 236, 1168, 288, 12, 6, "#ff4f9a", 5);
  for (const x of [196, 566]) { rr(c, x - 18, 1138, 36, 36, 8, "#ff4f9a", 5); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x - 15 + i * 10, 1128 - (i % 2) * 10, 9, 16, (i - 1.5) * 0.3, 0, Math.PI * 2); c.fillStyle = "#4fdc7a"; c.fill(); c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke(); } }
  sparkle(c, 620, 300, 0);
  return cv;
}

/* Cristal que va por encima de lo que hay dentro de cada habitacion: reflejos y un poco de sombra abajo. */
export function cristalSala(): HTMLCanvasElement {
  const [cv, c] = nuevo(SALA_W, SALA_H, 1.25);
  c.save();
  c.beginPath(); c.roundRect(0, 0, SALA_W, SALA_H, 10); c.clip();
  c.fillStyle = "rgba(255,255,255,0.14)";
  c.beginPath(); c.moveTo(60, 0); c.lineTo(150, 0); c.lineTo(70, SALA_H); c.lineTo(-20, SALA_H); c.fill();
  c.beginPath(); c.moveTo(170, 0); c.lineTo(196, 0); c.lineTo(116, SALA_H); c.lineTo(90, SALA_H); c.fill();
  c.fillStyle = degradado(c, 0, SALA_H - 30, 0, SALA_H, "rgba(42,21,69,0)", "rgba(42,21,69,0.22)"); c.fillRect(0, SALA_H - 30, SALA_W, 30);
  c.restore();
  return cv;
}

/* Habitacion que aun no esta abierta: oscura y con un candado. */
export function salaCerrada(): HTMLCanvasElement {
  const [cv, c] = nuevo(SALA_W, SALA_H, 1.25);
  c.save(); c.beginPath(); c.roundRect(0, 0, SALA_W, SALA_H, 10); c.clip();
  c.fillStyle = degradado(c, 0, 0, 0, SALA_H, "#4a3a6a", "#2a1a4a"); c.fillRect(0, 0, SALA_W, SALA_H);
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.lineWidth = 8; for (let x = -SALA_H; x < SALA_W; x += 36) { c.beginPath(); c.moveTo(x, SALA_H); c.lineTo(x + SALA_H, 0); c.stroke(); }
  c.restore();
  const cx = SALA_W / 2, cy = SALA_H / 2;
  rr(c, cx - 36, cy - 2, 72, 58, 12, "#ffd23f", 6);
  c.lineWidth = 10; c.strokeStyle = TINTA; c.beginPath(); c.arc(cx, cy - 2, 23, Math.PI, 0); c.stroke();
  c.lineWidth = 5; c.strokeStyle = "#ffd23f"; c.beginPath(); c.arc(cx, cy - 2, 23, Math.PI, 0); c.stroke();
  el(c, cx, cy + 24, 7, 7, TINTA, 0);
  return cv;
}

/* El cielo del atardecer y el jardin alrededor de la torre (2560x1080, cubre toda la ventana). */
export function fondoJardin(): HTMLCanvasElement {
  const W = 2560, H = 1080;
  const [cv, c] = nuevo(W, H);
  const r = azar(33);
  c.fillStyle = degradado(c, 0, 0, 0, H * 0.78, "#3b2a7a", "#ff9ac8"); c.fillRect(0, 0, W, H);
  c.fillStyle = degradado(c, 0, H * 0.5, 0, H * 0.8, "rgba(255,200,140,0)", "rgba(255,214,150,0.85)"); c.fillRect(0, H * 0.5, W, H * 0.3);
  for (let i = 0; i < 90; i++) sparkle(c, r() * W, r() * H * 0.5, 4 + r() * 8, "rgba(255,255,255,0.85)");
  el(c, 360, 230, 90, 90, "#fff6e5", 7); el(c, 332, 206, 18, 18, "rgba(42,21,69,0.12)", 0); el(c, 390, 260, 26, 26, "rgba(42,21,69,0.1)", 0);
  const colina = (base: number, amp: number, col: string, paso: number) => {
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) c.lineTo(x, base - Math.sin(x / paso + base) * amp - Math.sin(x / (paso * 0.37)) * amp * 0.3);
    c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 6; c.strokeStyle = TINTA; c.stroke();
  };
  colina(780, 70, "#6a4cc0", 260);
  colina(850, 60, "#4fb58a", 220);
  for (const [x, y, s] of [[150, 880, 1.2], [420, 900, 0.9], [2120, 890, 1.1], [2400, 870, 1.3], [640, 920, 0.7], [1930, 915, 0.75]] as const) {
    rr(c, x - 16 * s, y - 80 * s, 32 * s, 100 * s, 10, "#8a4a26", 6);
    el(c, x, y - 140 * s, 92 * s, 82 * s, "#4fdc7a", 7); el(c, x - 40 * s, y - 100 * s, 56 * s, 46 * s, "#3cbf68", 6); el(c, x + 44 * s, y - 110 * s, 52 * s, 44 * s, "#5fe88a", 6);
  }
  c.fillStyle = degradado(c, 0, H * 0.88, 0, H, "#5fe088", "#2f9a58"); c.fillRect(0, H * 0.88, W, H * 0.12);
  c.strokeStyle = TINTA; c.lineWidth = 6; c.beginPath(); c.moveTo(0, H * 0.88); c.lineTo(W, H * 0.88); c.stroke();
  for (let i = 0; i < 70; i++) { const x = r() * W, y = H * 0.91 + r() * H * 0.08; el(c, x, y, 7, 7, ["#ff4f9a", "#ffd23f", "#fff6e5", "#7a4cff"][i % 4], 3); }
  return cv;
}

/* El marco de la pantalla de habitacion: el mismo edificio visto de cerca. El hueco del diorama esta recortado. */
export const MARCO = { x: 624, y: 252, w: 1312, h: 665 };
export function marcoHabitacion(): HTMLCanvasElement {
  const W = 2560, H = 1080;
  const [cv, c] = nuevo(W, H);
  const x0 = 330, x1 = 2230;
  ladrillos(c, x0, 200, x1 - x0, H - 190, 12);
  // tejado ancho con buhardilla al centro
  c.save(); c.translate(x0 - 20, -30); c.scale((x1 - x0 + 40) / TORRE_W, 1.05); tejado(c, TORRE_W); c.restore();
  faldon(c, x0 - 10, 224, x1 - x0 + 20);
  // marco del diorama
  rr(c, MARCO.x - 14, MARCO.y - 14, MARCO.w + 28, MARCO.h + 28, 22, "#8a4a26", 8);
  c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.roundRect(MARCO.x, MARCO.y, MARCO.w, MARCO.h, 12); c.fillStyle = "#000"; c.fill(); c.restore();
  c.lineWidth = 7; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(MARCO.x, MARCO.y, MARCO.w, MARCO.h, 12); c.stroke();
  faldon(c, x0 - 10, MARCO.y + MARCO.h + 16, x1 - x0 + 20);
  // base inferior: una placa de madera para los botones
  rr(c, 520, 946, 1520, 150, 20, "#c97a46", 7);
  rr(c, 540, 962, 1480, 14, 6, "rgba(255,255,255,0.3)", 0);
  // hiedra a la izquierda
  const r = azar(19);
  for (let i = 0; i < 46; i++) { const y = 300 + r() * 780; el(c, x0 + 10 + r() * 50, y, 20 + r() * 12, 14 + r() * 8, i % 3 ? "#4fdc7a" : "#2fa85a", 4); }
  sparkle(c, 1000, 300, 0);
  return cv;
}
