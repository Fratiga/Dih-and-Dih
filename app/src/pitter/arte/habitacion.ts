/* La habitacion como en el Pitter-Patter original: una caja en perspectiva con pared de fondo, dos paredes laterales, techo con luces de carril y suelo.
   El mismo dibujo sirve para la pantalla de la habitacion y para el corte de la torre (alli se ve recortado por arriba).
   Coordenadas del diorama: 1500 de ancho y 760 de alto. El suelo va de y=520 (fondo) a y=760 (frente). */

import { TINTA, azar, degradado, lienzo, poligono, sparkle } from "./dibujo.ts";

export const DIO_W = 1500;
export const DIO_H = 760;
export const SUELO_FONDO = 520;
export const SUELO_FRENTE = 760;
const PARED_X0 = 300;
const PARED_X1 = 1200;
const PARED_Y0 = 110;
export const KD = 1.25;

export type Patron = "rombos" | "rayas" | "lunares" | "estrellas";

export interface TemaHab {
  id: string;
  nombre: string;
  patron: Patron;
  pared: [string, string];
  linea: string;
  zocalo: string;
  suelo: [string, string];
  techo: string;
  detalle: string;
}

export const TEMAS_HAB: TemaHab[] = [
  { id: "rombos", nombre: "Rombos morados", patron: "rombos", pared: ["#9a74d0", "#e2d2f6"], linea: "#c9a24a", zocalo: "#4a8aa8", suelo: ["#4a3a5a", "#3a2c4a"], techo: "#2e2250", detalle: "#ff4f9a" },
  { id: "verde", nombre: "Verde botella", patron: "rombos", pared: ["#2f6f5a", "#3f8a70"], linea: "#e0b860", zocalo: "#1f4a40", suelo: ["#6a4a2a", "#5a3c20"], techo: "#1f3a34", detalle: "#ffd23f" },
  { id: "mandarina", nombre: "Mandarina", patron: "rayas", pared: ["#ffcf8a", "#ffe6b8"], linea: "#e88a3a", zocalo: "#c9773a", suelo: ["#e8a468", "#d8935a"], techo: "#a85a2a", detalle: "#1ed7c8" },
  { id: "noche", nombre: "Noche de estrellas", patron: "estrellas", pared: ["#3d2f8a", "#4a3ca0"], linea: "#ffd23f", zocalo: "#2a2060", suelo: ["#3a2a6a", "#2e2058"], techo: "#1a1240", detalle: "#ffd23f" },
];

function nuevo(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [cv, c] = lienzo(DIO_W * KD, DIO_H * KD);
  c.scale(KD, KD);
  return [cv, c];
}

/* Un punto de la pared lateral a partir de su posicion relativa (fx a lo largo, fy a lo alto). */
function puntoPared(lado: "izq" | "der", fx: number, fy: number): [number, number] {
  const f = lado === "izq" ? 1 - fx : fx;   // fx=0 pegado al fondo
  const x0 = lado === "izq" ? PARED_X0 : PARED_X1;
  const x1 = lado === "izq" ? 0 : DIO_W;
  const x = x0 + (x1 - x0) * fx;
  const arriba = PARED_Y0 + (0 - PARED_Y0) * fx;
  const abajo = SUELO_FONDO + (SUELO_FRENTE - SUELO_FONDO) * fx;
  void f;
  return [x, arriba + (abajo - arriba) * fy];
}

export function patronPlano(t: TemaHab, w: number, h: number, escala: number): HTMLCanvasElement {
  const [cv, c] = lienzo(w, h);
  c.fillStyle = t.pared[1]; c.fillRect(0, 0, w, h);
  const r = azar(5);
  if (t.patron === "rombos") {
    const s = 90 * escala;
    for (let j = -1; j < h / s + 2; j++) for (let i = -1; i < w / s + 2; i++) {
      const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * s / 2 + 0;
      c.beginPath(); c.moveTo(cx, cy - s / 2); c.lineTo(cx + s / 2, cy); c.lineTo(cx, cy + s / 2); c.lineTo(cx - s / 2, cy); c.closePath();
      c.fillStyle = (i + j) % 2 === 0 ? t.pared[0] : t.pared[1]; c.fill();
      c.lineWidth = 3; c.strokeStyle = t.linea; c.stroke();
      if (Math.floor(r() * 9) === 0) sparkle(c, cx, cy, s * 0.16, "rgba(255,255,255,0.7)");
    }
  } else if (t.patron === "rayas") {
    const s = 70 * escala;
    for (let x = 0; x < w; x += s * 2) { c.fillStyle = t.pared[0]; c.fillRect(x, 0, s, h); }
    c.fillStyle = t.linea; for (let x = s; x < w; x += s * 2) c.fillRect(x, 0, 4, h);
  } else if (t.patron === "lunares") {
    c.fillStyle = t.pared[0]; for (let y = 20; y < h; y += 60 * escala) for (let x = ((y / (60 * escala)) % 2) * 30 + 20; x < w; x += 60 * escala) { c.beginPath(); c.arc(x, y, 12 * escala, 0, Math.PI * 2); c.fill(); }
  } else {
    c.fillStyle = t.pared[0]; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) sparkle(c, r() * w, r() * h, (6 + r() * 12) * escala, "rgba(255,226,120,0.9)");
  }
  return cv;
}

/* Dibuja la pared lateral columna a columna para que la perspectiva salga bien. */
function paredLateral(c: CanvasRenderingContext2D, plano: HTMLCanvasElement, lado: "izq" | "der"): void {
  const n = 300;
  for (let i = 0; i < n; i++) {
    const fx = lado === "izq" ? 1 - (i + 0.5) / n : (i + 0.5) / n;   // 0 = junto al fondo
    const x = lado === "izq" ? i : PARED_X1 + i;
    const arriba = PARED_Y0 * (1 - fx);
    const abajo = SUELO_FONDO + (SUELO_FRENTE - SUELO_FONDO) * fx;
    const col = Math.floor((i / n) * plano.width);
    c.drawImage(plano, col, 0, 2, plano.height, x, arriba, 1.6, abajo - arriba);
  }
}

export function dioramaHabitacion(t: TemaHab): HTMLCanvasElement {
  const [cv, c] = nuevo();
  const r = azar(t.id.length * 31 + 7);
  const plano = patronPlano(t, 900, 420, 1);
  // pared del fondo
  c.drawImage(plano, 0, 0, plano.width, plano.height, PARED_X0, PARED_Y0, PARED_X1 - PARED_X0, SUELO_FONDO - PARED_Y0);
  // paredes laterales
  const lat = patronPlano(t, 300, 760, 1.1);
  paredLateral(c, lat, "izq"); paredLateral(c, lat, "der");
  // sombreado de las paredes laterales
  const sombraL = c.createLinearGradient(0, 0, PARED_X0, 0); sombraL.addColorStop(0, "rgba(42,21,69,0.35)"); sombraL.addColorStop(1, "rgba(42,21,69,0)");
  c.fillStyle = sombraL; poligono(c, [[0, 0], [PARED_X0, PARED_Y0], [PARED_X0, SUELO_FONDO], [0, SUELO_FRENTE]], null, 0); c.fill();
  const sombraR = c.createLinearGradient(DIO_W, 0, PARED_X1, 0); sombraR.addColorStop(0, "rgba(42,21,69,0.35)"); sombraR.addColorStop(1, "rgba(42,21,69,0)");
  c.fillStyle = sombraR; poligono(c, [[DIO_W, 0], [PARED_X1, PARED_Y0], [PARED_X1, SUELO_FONDO], [DIO_W, SUELO_FRENTE]], null, 0); c.fill();
  // zocalo (rodapie)
  poligono(c, [[PARED_X0, 470], [PARED_X1, 470], [PARED_X1, SUELO_FONDO], [PARED_X0, SUELO_FONDO]], t.zocalo, 5);
  poligono(c, [[0, 640], [PARED_X0, 470], [PARED_X0, SUELO_FONDO], [0, SUELO_FRENTE]], t.zocalo, 5);
  poligono(c, [[DIO_W, 640], [PARED_X1, 470], [PARED_X1, SUELO_FONDO], [DIO_W, SUELO_FRENTE]], t.zocalo, 5);
  // techo
  poligono(c, [[0, 0], [DIO_W, 0], [PARED_X1, PARED_Y0], [PARED_X0, PARED_Y0]], t.techo, 6);
  // suelo de tablas en perspectiva
  poligono(c, [[PARED_X0, SUELO_FONDO], [PARED_X1, SUELO_FONDO], [DIO_W, SUELO_FRENTE], [0, SUELO_FRENTE]], t.suelo[0], 6);
  c.save(); c.beginPath(); c.moveTo(PARED_X0, SUELO_FONDO); c.lineTo(PARED_X1, SUELO_FONDO); c.lineTo(DIO_W, SUELO_FRENTE); c.lineTo(0, SUELO_FRENTE); c.closePath(); c.clip();
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 3;
  for (let i = 0; i <= 14; i++) { const f = i / 14; const xa = PARED_X0 + (PARED_X1 - PARED_X0) * f, xb = DIO_W * f; c.beginPath(); c.moveTo(xa, SUELO_FONDO); c.lineTo(xb, SUELO_FRENTE); c.stroke(); }
  for (let i = 1; i < 8; i++) { const f = Math.pow(i / 8, 1.5); const y = SUELO_FONDO + (SUELO_FRENTE - SUELO_FONDO) * f; c.beginPath(); c.moveTo(0, y); c.lineTo(DIO_W, y); c.stroke(); }
  c.fillStyle = degradado(c, 0, SUELO_FONDO, 0, SUELO_FRENTE, "rgba(255,255,255,0)", "rgba(255,255,255,0.1)"); c.fillRect(0, SUELO_FONDO, DIO_W, 240);
  // alfombra
  poligono(c, [[520, 560], [980, 560], [1180, 730], [320, 730]], t.suelo[1], 0);
  c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.moveTo(560, 575); c.lineTo(940, 575); c.lineTo(1110, 715); c.lineTo(390, 715); c.closePath(); c.fill();
  c.lineWidth = 5; c.strokeStyle = t.detalle; c.beginPath(); c.moveTo(520, 560); c.lineTo(980, 560); c.lineTo(1180, 730); c.lineTo(320, 730); c.closePath(); c.stroke();
  c.restore();
  // aristas de la caja
  c.strokeStyle = TINTA; c.lineWidth = 7;
  c.beginPath(); c.moveTo(PARED_X0, PARED_Y0); c.lineTo(PARED_X1, PARED_Y0); c.lineTo(PARED_X1, SUELO_FONDO); c.lineTo(PARED_X0, SUELO_FONDO); c.closePath();
  c.moveTo(0, 0); c.lineTo(PARED_X0, PARED_Y0); c.moveTo(DIO_W, 0); c.lineTo(PARED_X1, PARED_Y0); c.moveTo(0, SUELO_FRENTE); c.lineTo(PARED_X0, SUELO_FONDO); c.moveTo(DIO_W, SUELO_FRENTE); c.lineTo(PARED_X1, SUELO_FONDO); c.stroke();
  // estanteria verde en la pared del fondo
  const ex = 640, ey = 210;
  poligono(c, [[ex, ey + 90], [ex + 240, ey + 90], [ex + 240, ey + 110], [ex, ey + 110]], "#3a7a52", 5);
  poligono(c, [[ex - 8, ey - 20], [ex + 248, ey - 20], [ex + 248, ey + 90], [ex - 8, ey + 90]], "#4f9a6a", 5);
  for (const [bx, col, hh] of [[ex + 140, "#c9526a", 76], [ex + 170, "#e8a468", 66], [ex + 198, "#7a8ad0", 72]] as const) { poligono(c, [[bx, ey + 90 - hh], [bx + 24, ey + 90 - hh], [bx + 24, ey + 90], [bx, ey + 90]], col, 4); }
  for (const bx of [ex + 20, ex + 78]) { poligono(c, [[bx, ey + 54], [bx + 36, ey + 54], [bx + 30, ey + 90], [bx + 6, ey + 90]], "#fff6e5", 4); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(bx + 18 + (k - 1.5) * 8, ey + 38 - (k % 2) * 10, 8, 22, (k - 1.5) * 0.3, 0, Math.PI * 2); c.fillStyle = k % 2 ? "#4fdc7a" : "#7a4cff"; c.fill(); c.lineWidth = 3; c.stroke(); } }
  // ventana con celosia en la pared derecha
  const v = (fx: number, fy: number) => puntoPared("der", fx, fy);
  const vent: [number, number][] = [v(0.18, 0.2), v(0.78, 0.2), v(0.78, 0.74), v(0.18, 0.74)];
  poligono(c, vent, "#fff6e5", 6);
  c.strokeStyle = TINTA; c.lineWidth = 4;
  for (let i = 1; i < 5; i++) { const a = v(0.18 + (0.6 * i) / 5, 0.2), b = v(0.18 + (0.6 * i) / 5, 0.74); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (let j = 1; j < 5; j++) { const a = v(0.18, 0.2 + (0.54 * j) / 5), b = v(0.78, 0.2 + (0.54 * j) / 5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  // cuadro en la pared izquierda
  const q = (fx: number, fy: number) => puntoPared("izq", fx, fy);
  poligono(c, [q(0.3, 0.18), q(0.7, 0.18), q(0.7, 0.5), q(0.3, 0.5)], "#fff6e5", 6);
  poligono(c, [q(0.36, 0.23), q(0.64, 0.23), q(0.64, 0.45), q(0.36, 0.45)], t.detalle, 4);
  // luces de carril colgando del techo
  c.strokeStyle = TINTA; c.lineWidth = 6;
  poligono(c, [[PARED_X0 + 260, PARED_Y0 + 4], [PARED_X0 + 640, PARED_Y0 + 4], [PARED_X0 + 640, PARED_Y0 + 14], [PARED_X0 + 260, PARED_Y0 + 14]], "#2a2438", 4);
  for (let i = 0; i < 4; i++) {
    const x = PARED_X0 + 300 + i * 100;
    poligono(c, [[x - 6, PARED_Y0 + 14], [x + 6, PARED_Y0 + 14], [x + 22, PARED_Y0 + 62], [x - 22, PARED_Y0 + 62]], "#b9c0b0", 4);
    c.fillStyle = "rgba(255,240,170,0.5)"; c.beginPath(); c.ellipse(x, PARED_Y0 + 66, 16, 6, 0, 0, Math.PI * 2); c.fill();
  }
  void r;
  return cv;
}

/* Escala por profundidad: lo del fondo se ve mas pequeño que lo de delante. */
export function escalaProfundidad(y: number): number {
  return 0.62 + ((Math.max(SUELO_FONDO, Math.min(SUELO_FRENTE, y)) - SUELO_FONDO) / (SUELO_FRENTE - SUELO_FONDO)) * 0.5;
}

/* Hasta donde se puede andar a lo ancho a cada profundidad. */
export function limitesX(y: number): [number, number] {
  const f = (Math.max(SUELO_FONDO, Math.min(SUELO_FRENTE, y)) - SUELO_FONDO) / (SUELO_FRENTE - SUELO_FONDO);
  return [PARED_X0 + 40 - (PARED_X0 - 30) * f, PARED_X1 - 40 + (DIO_W - PARED_X1 - 30) * f];
}
