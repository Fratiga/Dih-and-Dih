/* Escenarios y objetos dibujados en codigo. Cada funcion devuelve un lienzo ya horneado a la escala K (mas nitido en pantallas grandes).
   Las coordenadas son del espacio de diseño: 1080 de alto y 2560 de ancho, con lo importante en los 1920 centrales. */

import { TINTA, azar, bandera, degradado, el, estrellaDib, lienzo, nube, poligono, rr, sparkle } from "./dibujo.ts";
import { AFINIDADES, type Afinidad } from "../datos/roster.ts";
import type { Jefe } from "../datos/campana.ts";

export const DISENO_W = 2560;
export const DISENO_H = 1080;
export const K = 1.25;

const PALETA = ["#ff4f9a", "#1ed7c8", "#ffd23f", "#7a4cff", "#3d8bff", "#ff8a2a", "#4fdc7a"];

function nuevo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [cv, c] = lienzo(w * K, h * K);
  c.scale(K, K);
  return [cv, c];
}

/* --- El salon del menu --- */
export function fondoSalon(): HTMLCanvasElement {
  const [cv, c] = nuevo(DISENO_W, DISENO_H);
  const r = azar(7);
  // pared con rayas y lunares
  c.fillStyle = degradado(c, 0, 0, 0, 780, "#ffd9ec", "#ffe9f4");
  c.fillRect(0, 0, DISENO_W, 780);
  c.fillStyle = "rgba(255,150,200,0.22)";
  for (let x = 0; x < DISENO_W; x += 120) c.fillRect(x, 0, 60, 780);
  c.fillStyle = "rgba(255,255,255,0.55)";
  for (let y = 40; y < 760; y += 70) for (let x = ((y / 70) % 2) * 35 + 20; x < DISENO_W; x += 70) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
  // zocalo de madera
  c.fillStyle = "#c97a46";
  c.fillRect(0, 640, DISENO_W, 140);
  c.fillStyle = "#b5683d";
  for (let x = 0; x < DISENO_W; x += 110) c.fillRect(x, 640, 4, 140);
  c.fillStyle = "#e29a63";
  c.fillRect(0, 640, DISENO_W, 20);
  c.strokeStyle = TINTA; c.lineWidth = 6;
  c.beginPath(); c.moveTo(0, 640); c.lineTo(DISENO_W, 640); c.moveTo(0, 780); c.lineTo(DISENO_W, 780); c.stroke();
  // suelo a cuadros
  for (let y = 780, fila = 0; y < DISENO_H; y += 60, fila++) {
    for (let x = -((fila % 2) * 70); x < DISENO_W; x += 140) {
      c.fillStyle = (x / 140 + fila) % 2 === 0 ? "#ffb36b" : "#ff9a5c";
      c.fillRect(x, y, 140, 60);
    }
  }
  c.strokeStyle = "rgba(42,21,69,0.35)"; c.lineWidth = 3;
  for (let y = 780; y < DISENO_H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(DISENO_W, y); c.stroke(); }
  c.fillStyle = degradado(c, 0, 780, 0, DISENO_H, "rgba(42,21,69,0)", "rgba(42,21,69,0.32)");
  c.fillRect(0, 780, DISENO_W, 300);
  // viga del techo
  c.fillStyle = "#7a4cff"; c.fillRect(0, 0, DISENO_W, 70);
  c.fillStyle = "#9a76ff"; c.fillRect(0, 0, DISENO_W, 20);
  c.strokeStyle = TINTA; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 70); c.lineTo(DISENO_W, 70); c.stroke();
  // ventana grande con arco
  const wx = 1280, wy = 130, ww = 620, wh = 430;
  c.save();
  c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.lineTo(wx - ww / 2, wy + 150); c.arc(wx, wy + 150, ww / 2, Math.PI, 0); c.lineTo(wx + ww / 2, wy + wh); c.closePath();
  c.clip();
  c.fillStyle = degradado(c, 0, wy, 0, wy + wh, "#79d4ff", "#ffe9b8"); c.fillRect(wx - ww / 2, wy, ww, wh);
  c.beginPath(); c.arc(wx + 120, wy + 210, 62, 0, Math.PI * 2); c.fillStyle = "#ffd23f"; c.fill(); c.lineWidth = 6; c.strokeStyle = TINTA; c.stroke();
  nube(c, wx - 220, wy + 130, 1.1); nube(c, wx + 40, wy + 90, 0.8);
  c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.quadraticCurveTo(wx - 140, wy + 230, wx + 80, wy + 330); c.quadraticCurveTo(wx + 200, wy + 280, wx + ww / 2, wy + 360); c.lineTo(wx + ww / 2, wy + wh); c.closePath();
  c.fillStyle = "#7fe08a"; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.quadraticCurveTo(wx - 40, wy + 340, wx + 200, wy + 420); c.lineTo(wx + ww / 2, wy + wh); c.closePath();
  c.fillStyle = "#4fc971"; c.fill(); c.stroke();
  c.restore();
  c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.lineTo(wx - ww / 2, wy + 150); c.arc(wx, wy + 150, ww / 2, Math.PI, 0); c.lineTo(wx + ww / 2, wy + wh); c.closePath();
  c.lineWidth = 12; c.strokeStyle = TINTA; c.stroke();
  c.lineWidth = 14; c.strokeStyle = "#fff6e5";
  c.beginPath(); c.moveTo(wx, wy - 10); c.lineTo(wx, wy + wh); c.moveTo(wx - ww / 2, wy + 270); c.lineTo(wx + ww / 2, wy + 270); c.stroke();
  c.lineWidth = 5; c.strokeStyle = TINTA; c.beginPath(); c.moveTo(wx - 7, wy); c.lineTo(wx - 7, wy + wh); c.moveTo(wx + 7, wy); c.lineTo(wx + 7, wy + wh); c.stroke();
  rr(c, wx - ww / 2 - 26, wy + wh - 6, ww + 52, 34, 12, "#fff6e5", 6);
  // maceta en la repisa
  el(c, wx - 200, wy + wh - 14, 3, 3, null, 0);
  rr(c, wx - 240, wy + wh - 58, 60, 52, 10, "#ff4f9a", 5);
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(wx - 238 + i * 15, wy + wh - 84 - (i % 2) * 14, 14, 24, (i - 2) * 0.35, 0, Math.PI * 2); c.fillStyle = "#4fdc7a"; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke(); }
  // cuadros en la pared
  const cuadro = (x: number, y: number, w: number, h: number, col: string) => {
    rr(c, x, y, w, h, 10, "#fff6e5", 6); rr(c, x + 12, y + 12, w - 24, h - 24, 6, col, 4);
    estrellaDib(c, x + w / 2, y + h / 2, Math.min(w, h) * 0.26, "#fff6b8", 4);
  };
  cuadro(210, 190, 150, 190, "#7a4cff"); cuadro(380, 250, 120, 120, "#1ed7c8"); cuadro(2020, 200, 170, 140, "#ff8a2a"); cuadro(2210, 190, 130, 190, "#3d8bff");
  // guirnalda de banderines
  for (const [yy, caida, off] of [[100, 60, 0], [150, 40, 90]] as const) {
    c.beginPath(); c.strokeStyle = TINTA; c.lineWidth = 5;
    for (let x = 0; x <= DISENO_W; x += 20) { const y = yy + Math.sin((x / DISENO_W) * Math.PI * 3 + off) * 18 + caida * Math.sin((x / DISENO_W) * Math.PI) * 0.4; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    for (let x = 60; x < DISENO_W - 40; x += 92) {
      const y = yy + Math.sin((x / DISENO_W) * Math.PI * 3 + off) * 18 + caida * Math.sin((x / DISENO_W) * Math.PI) * 0.4;
      bandera(c, x, y, 54, 70, PALETA[Math.floor(r() * PALETA.length)]);
    }
  }
  return cv;
}

function sombraSuelo(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = "rgba(42,21,69,0.3)";
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

/* La mesa de juego: un tablero de 6x6 con fichas de colores encima. Es el boton de JUGAR. */
export function propMesa(): HTMLCanvasElement {
  const W = 680, H = 470;
  const [cv, c] = nuevo(W, H);
  sombraSuelo(c, W / 2, H - 34, 280, 34);
  // patas
  c.fillStyle = "#b5683d";
  rr(c, 160, 270, 56, 150, 18, "#b5683d", 6); rr(c, W - 216, 270, 56, 150, 18, "#b5683d", 6); rr(c, W / 2 - 28, 290, 56, 130, 18, "#a85a32", 6);
  // tablero
  c.save();
  c.translate(W / 2, 170);
  poligono(c, [[-290, 70], [290, 70], [250, -110], [-250, -110]], "#8a4a26", 7);
  poligono(c, [[-268, 52], [268, 52], [232, -92], [-232, -92]], "#e8a06a", 5);
  // rejilla 6x6 en perspectiva
  const r = azar(3);
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = (i + 1) / 6, v0 = j / 6, v1 = (j + 1) / 6;
      const ancho = (v: number) => 250 + (290 - 250) * v - 18;
      const y0 = -92 + v0 * 144, y1 = -92 + v1 * 144;
      const x00 = -ancho(v0) + t0 * 2 * ancho(v0), x01 = -ancho(v0) + t1 * 2 * ancho(v0);
      const x10 = -ancho(v1) + t0 * 2 * ancho(v1), x11 = -ancho(v1) + t1 * 2 * ancho(v1);
      poligono(c, [[x00 + 2, y0 + 2], [x01 - 2, y0 + 2], [x11 - 2, y1 - 2], [x10 + 2, y1 - 2]], PALETA[Math.floor(r() * PALETA.length)], 3);
    }
  c.restore();
  // fichas flotando
  for (const [x, y, col] of [[180, 40, "#ff4f9a"], [W / 2, 8, "#ffd23f"], [W - 180, 44, "#1ed7c8"]] as const) {
    rr(c, x - 38, y - 38, 76, 76, 20, col, 6);
    el(c, x, y + 4, 22, 20, "#fff1dd", 5);
    el(c, x - 8, y, 4, 6, TINTA, 0); el(c, x + 8, y, 4, 6, TINTA, 0);
    sparkle(c, x + 44, y - 40, 14, "#fff6b8");
  }
  return cv;
}

/* El estante con el album de la coleccion. */
export function propEstante(): HTMLCanvasElement {
  const W = 420, H = 700;
  const [cv, c] = nuevo(W, H);
  sombraSuelo(c, W / 2, H - 26, 170, 22);
  rr(c, 20, 40, W - 40, H - 70, 22, "#c97a46", 7);
  rr(c, 44, 66, W - 88, H - 122, 12, "#9b5530", 5);
  const r = azar(11);
  for (let s = 0; s < 4; s++) {
    const y = 66 + s * 140;
    rr(c, 36, y + 126, W - 72, 18, 6, "#e29a63", 5);
    let x = 56;
    while (x < W - 80) {
      const bw = 24 + Math.floor(r() * 20), bh = 70 + Math.floor(r() * 44);
      if (s === 0 && x > 120 && x < 300) { x += 20; continue; }
      rr(c, x, y + 126 - bh, bw, bh, 5, PALETA[Math.floor(r() * PALETA.length)], 4);
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(x + 5, y + 126 - bh + 10, bw - 10, 5);
      x += bw + 4;
    }
  }
  // album abierto arriba
  rr(c, 128, 70, 166, 120, 12, "#ff4f9a", 6);
  rr(c, 138, 80, 70, 100, 6, "#fff6e5", 4); rr(c, 214, 80, 70, 100, 6, "#fff6e5", 4);
  estrellaDib(c, 173, 130, 24, "#ffd23f", 4); estrellaDib(c, 249, 130, 24, "#1ed7c8", 4);
  rr(c, 90, 20, 240, 36, 14, "#7a4cff", 6);
  sparkle(c, 330, 50, 18, "#fff6b8"); sparkle(c, 96, 98, 12, "#fff6b8");
  return cv;
}

/* Dos sillones para el equipo. */
export function propSillones(): HTMLCanvasElement {
  const W = 620, H = 360;
  const [cv, c] = nuevo(W, H);
  sombraSuelo(c, W / 2, H - 26, 270, 24);
  const sillon = (x: number, col: string) => {
    rr(c, x, 70, 240, 230, 60, col, 7);
    rr(c, x - 22, 160, 60, 140, 24, col, 7);
    rr(c, x + 202, 160, 60, 140, 24, col, 7);
    rr(c, x + 20, 190, 200, 100, 26, "rgba(255,255,255,0.28)", 5);
    el(c, x + 70, 108, 40, 12, "rgba(255,255,255,0.4)", 0);
    rr(c, x + 6, 290, 36, 28, 10, "#8a4a26", 5); rr(c, x + 198, 290, 36, 28, 10, "#8a4a26", 5);
  };
  sillon(54, "#ff4f9a");
  sillon(330, "#1ed7c8");
  return cv;
}

/* La escalera y la puerta de las habitaciones. */
export function propEscalera(): HTMLCanvasElement {
  const W = 400, H = 700;
  const [cv, c] = nuevo(W, H);
  sombraSuelo(c, W / 2, H - 22, 160, 20);
  // marco y puerta
  rr(c, 60, 40, 280, 460, 26, "#7a4cff", 7);
  c.beginPath(); c.moveTo(88, 500); c.lineTo(88, 190); c.arc(200, 190, 112, Math.PI, 0); c.lineTo(312, 500); c.closePath();
  c.fillStyle = "#ffcf8a"; c.fill(); c.lineWidth = 7; c.strokeStyle = TINTA; c.stroke();
  c.beginPath(); c.moveTo(200, 78); c.lineTo(200, 500); c.lineWidth = 5; c.stroke();
  el(c, 160, 330, 12, 12, "#ffd23f", 4); el(c, 240, 330, 12, 12, "#ffd23f", 4);
  for (const x of [128, 272]) { rr(c, x - 30, 220, 60, 90, 12, "#fff0b8", 4); }
  // escalones
  for (let i = 0; i < 4; i++) rr(c, 44 - i * 8, 500 + i * 36, 312 + i * 16, 40, 10, i % 2 ? "#e29a63" : "#ffb36b", 6);
  // farol
  rr(c, 176, 8, 48, 14, 5, "#2a1545", 0); c.beginPath(); c.moveTo(200, 20); c.lineTo(200, 40); c.lineWidth = 6; c.strokeStyle = TINTA; c.stroke();
  el(c, 200, 62, 18, 18, "#ffe36b", 5);
  return cv;
}

/* El tablon de logros y records. */
export function propTablon(): HTMLCanvasElement {
  const W = 340, H = 300;
  const [cv, c] = nuevo(W, H);
  rr(c, 18, 18, W - 36, H - 70, 20, "#8a4a26", 7);
  rr(c, 36, 36, W - 72, H - 106, 10, "#e8a06a", 5);
  c.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 40; i++) { const r = azar(i + 5); c.beginPath(); c.arc(40 + r() * (W - 80), 40 + r() * (H - 114), 2 + r() * 2, 0, Math.PI * 2); c.fill(); }
  const papel = (x: number, y: number, w: number, h: number, rot: number, col: string) => {
    c.save(); c.translate(x, y); c.rotate(rot); rr(c, -w / 2, -h / 2, w, h, 6, col, 4); el(c, 0, -h / 2 + 12, 7, 7, "#ff4f9a", 3); c.restore();
  };
  papel(110, 110, 90, 100, -0.08, "#fff6e5"); papel(220, 120, 100, 80, 0.07, "#ffe9c4"); papel(168, 180, 80, 62, -0.04, "#fff6e5");
  estrellaDib(c, 106, 112, 24, "#ffd23f", 4); estrellaDib(c, 222, 120, 20, "#1ed7c8", 4);
  rr(c, 110, H - 54, 120, 40, 12, "#fff6e5", 5);
  return cv;
}

/* Estrella suelta y destello, para los efectos del menu. */
export function texturaEstrella(color = "#fff6b8"): HTMLCanvasElement {
  const [cv, c] = lienzo(64, 64);
  sparkle(c, 32, 32, 28, color);
  return cv;
}

export function texturaPunto(): HTMLCanvasElement {
  const [cv, c] = lienzo(32, 32);
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  return cv;
}

export function texturaCorazonBrillo(): HTMLCanvasElement {
  const [cv, c] = lienzo(96, 96);
  const g = c.createRadialGradient(48, 48, 4, 48, 48, 46);
  g.addColorStop(0, "rgba(255,246,184,0.95)"); g.addColorStop(1, "rgba(255,246,184,0)");
  c.fillStyle = g; c.fillRect(0, 0, 96, 96);
  return cv;
}

/* --- Escenario del puzzle segun el jefe --- */
export function fondoJefe(j: Jefe, ancho: number, alto: number): HTMLCanvasElement {
  const K2 = 1;
  const [cv, c] = lienzo(ancho * K2, alto * K2);
  const t = j.tema;
  const r = azar(j.id.length * 97 + 5);
  c.fillStyle = degradado(c, 0, 0, 0, alto, t.cielo[0], t.cielo[1]);
  c.fillRect(0, 0, ancho, alto);
  // patron de la escena
  c.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 26; i++) { const x = r() * ancho, y = r() * alto * 0.6, rad = 6 + r() * 22; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); }
  const sy = alto * 0.62;
  // montañas o siluetas segun el tipo
  const colores = [t.suelo, t.detalle];
  for (let capa = 0; capa < 3; capa++) {
    const base = sy - 60 + capa * 70;
    c.beginPath(); c.moveTo(0, alto);
    const picos = 5 + capa * 2;
    for (let i = 0; i <= picos; i++) {
      const x = (i / picos) * ancho;
      const y = base - (j.tema.tipo === "volcan" ? (i % 2 ? 170 : 40) : j.tema.tipo === "mar" ? 20 + Math.sin(i * 1.7) * 18 : 60 + r() * 120) * (1 - capa * 0.25);
      c.lineTo(x, y);
    }
    c.lineTo(ancho, alto); c.closePath();
    c.fillStyle = capa === 0 ? colores[1] : t.suelo; c.globalAlpha = 0.5 + capa * 0.25; c.fill(); c.globalAlpha = 1;
    c.lineWidth = 6; c.strokeStyle = TINTA; c.stroke();
  }
  // nubes
  for (let i = 0; i < 4; i++) nube(c, r() * ancho, 80 + r() * alto * 0.25, 0.8 + r() * 0.8, "rgba(255,255,255,0.9)");
  // suelo
  c.fillStyle = degradado(c, 0, alto * 0.82, 0, alto, t.suelo, "#2a1545");
  c.fillRect(0, alto * 0.84, ancho, alto * 0.16);
  c.strokeStyle = TINTA; c.lineWidth = 6; c.beginPath(); c.moveTo(0, alto * 0.84); c.lineTo(ancho, alto * 0.84); c.stroke();
  // lunares y puntos de luz
  for (let i = 0; i < 30; i++) sparkle(c, r() * ancho, r() * alto, 6 + r() * 10, "rgba(255,255,255,0.6)");
  // viñeta
  const v = c.createRadialGradient(ancho / 2, alto / 2, alto * 0.3, ancho / 2, alto / 2, alto * 0.95);
  v.addColorStop(0, "rgba(42,21,69,0)"); v.addColorStop(1, "rgba(42,21,69,0.45)");
  c.fillStyle = v; c.fillRect(0, 0, ancho, alto);
  return cv;
}

/* --- Habitaciones --- */
export interface TemaHabitacion { id: string; nombre: string; pared: [string, string]; zocalo: string; suelo: [string, string]; ventana: string; detalle: string }
export const TEMAS_HABITACION: TemaHabitacion[] = [
  { id: "taberna", nombre: "Taberna", pared: ["#ffd9ec", "#ffe9f4"], zocalo: "#c97a46", suelo: ["#ffb36b", "#ff9a5c"], ventana: "#79d4ff", detalle: "#ff4f9a" },
  { id: "cielo", nombre: "Cielo", pared: ["#cfe9ff", "#eaf6ff"], zocalo: "#8fb7e6", suelo: ["#fff6e5", "#ffe9c4"], ventana: "#bfe8ff", detalle: "#3d8bff" },
  { id: "bosque", nombre: "Bosque", pared: ["#d6f5c9", "#eaffdf"], zocalo: "#7a5a3a", suelo: ["#9bd37a", "#86c466"], ventana: "#a8e6c0", detalle: "#4fdc7a" },
  { id: "noche", nombre: "Noche", pared: ["#5a3d9a", "#7a5ac0"], zocalo: "#3a2468", suelo: ["#4a2e80", "#3a2468"], ventana: "#2a1a60", detalle: "#ffd23f" },
];

export function fondoHabitacion(tema: TemaHabitacion): HTMLCanvasElement {
  const [cv, c] = nuevo(DISENO_W, DISENO_H);
  c.fillStyle = degradado(c, 0, 0, 0, 760, tema.pared[0], tema.pared[1]);
  c.fillRect(0, 0, DISENO_W, 760);
  c.fillStyle = "rgba(255,255,255,0.18)";
  for (let x = 0; x < DISENO_W; x += 140) c.fillRect(x, 0, 70, 760);
  c.fillStyle = tema.zocalo; c.fillRect(0, 620, DISENO_W, 140);
  c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(0, 620, DISENO_W, 18);
  c.strokeStyle = TINTA; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 620); c.lineTo(DISENO_W, 620); c.moveTo(0, 760); c.lineTo(DISENO_W, 760); c.stroke();
  for (let y = 760, f = 0; y < DISENO_H; y += 56, f++) for (let x = -(f % 2) * 80; x < DISENO_W; x += 160) { c.fillStyle = (x / 160 + f) % 2 === 0 ? tema.suelo[0] : tema.suelo[1]; c.fillRect(x, y, 160, 56); }
  c.fillStyle = degradado(c, 0, 760, 0, DISENO_H, "rgba(42,21,69,0)", "rgba(42,21,69,0.3)"); c.fillRect(0, 760, DISENO_W, 320);
  // ventana
  rr(c, 1020, 160, 520, 380, 30, tema.ventana, 8);
  c.strokeStyle = "#fff6e5"; c.lineWidth = 14; c.beginPath(); c.moveTo(1280, 160); c.lineTo(1280, 540); c.moveTo(1020, 350); c.lineTo(1540, 350); c.stroke();
  c.strokeStyle = TINTA; c.lineWidth = 6; c.strokeRect(1020, 160, 520, 380);
  nube(c, 1100, 250, 0.9); nube(c, 1340, 220, 0.7);
  for (let i = 0; i < 5; i++) sparkle(c, 1060 + i * 100, 200 + (i % 2) * 90, 10, "#fff6b8");
  // cortinas
  poligono(c, [[990, 130], [1100, 130], [1060, 560], [990, 560]], tema.detalle, 6);
  poligono(c, [[1570, 130], [1460, 130], [1500, 560], [1570, 560]], tema.detalle, 6);
  c.strokeStyle = TINTA; c.lineWidth = 8; c.beginPath(); c.moveTo(960, 126); c.lineTo(1600, 126); c.stroke();
  // guirnalda
  for (let x = 120; x < DISENO_W - 100; x += 130) bandera(c, x, 70 + Math.sin(x / 300) * 12, 60, 76, PALETA[(x / 130) % PALETA.length | 0]);
  return cv;
}

/* --- Muebles --- */
export interface DefMueble { id: string; nombre: string; ancho: number; alto: number; suelo: boolean; interaccion: "dormir" | "sentar" | "jugar" | "ver" | null }
export const MUEBLES: DefMueble[] = [
  { id: "cama", nombre: "Cama", ancho: 360, alto: 220, suelo: true, interaccion: "dormir" },
  { id: "mesa", nombre: "Mesa de dados", ancho: 300, alto: 220, suelo: true, interaccion: "jugar" },
  { id: "planta", nombre: "Planta", ancho: 150, alto: 260, suelo: true, interaccion: null },
  { id: "lampara", nombre: "Lámpara", ancho: 120, alto: 300, suelo: true, interaccion: null },
  { id: "sillon", nombre: "Sillón", ancho: 260, alto: 200, suelo: true, interaccion: "sentar" },
  { id: "estante", nombre: "Estante", ancho: 240, alto: 340, suelo: true, interaccion: "ver" },
  { id: "alfombra", nombre: "Alfombra", ancho: 380, alto: 90, suelo: true, interaccion: null },
  { id: "cuadro", nombre: "Cuadro", ancho: 170, alto: 200, suelo: false, interaccion: null },
];

export function dibujarMueble(id: string, acento: string): HTMLCanvasElement {
  const d = MUEBLES.find((m) => m.id === id) as DefMueble;
  const [cv, c] = nuevo(d.ancho + 20, d.alto + 20);
  c.translate(10, 10);
  const W = d.ancho, H = d.alto;
  if (id !== "cuadro" && id !== "alfombra") sombraSuelo(c, W / 2, H - 6, W * 0.46, 12);
  switch (id) {
    case "cama":
      rr(c, 0, 40, W, H - 40, 28, "#8a4a26", 7); rr(c, 14, 20, 100, 90, 24, "#fff6e5", 6);
      rr(c, 10, 90, W - 20, 100, 30, acento, 7); rr(c, 10, 90, W - 20, 36, 22, "rgba(255,255,255,0.35)", 0);
      rr(c, 10, 0, 40, 220, 14, "#6e3a1c", 6);
      break;
    case "mesa":
      el(c, W / 2, 70, W / 2 - 6, 56, "#e8a06a", 7); rr(c, W / 2 - 24, 100, 48, H - 118, 14, "#a85a32", 6);
      rr(c, W / 2 - 80, H - 30, 160, 24, 12, "#8a4a26", 6);
      for (let i = 0; i < 3; i++) { rr(c, W / 2 - 70 + i * 56, 40 + (i % 2) * 16, 40, 40, 10, PALETA[i + 1], 5); }
      break;
    case "planta":
      rr(c, W / 2 - 46, H - 100, 92, 94, 18, acento, 7);
      for (let i = 0; i < 6; i++) { c.save(); c.translate(W / 2, H - 100); c.rotate((i - 2.5) * 0.42); c.beginPath(); c.ellipse(0, -70, 22, 76, 0, 0, Math.PI * 2); c.fillStyle = i % 2 ? "#4fdc7a" : "#3cbf68"; c.fill(); c.lineWidth = 6; c.strokeStyle = TINTA; c.stroke(); c.restore(); }
      break;
    case "lampara":
      rr(c, W / 2 - 10, 80, 20, H - 100, 8, "#6e3a1c", 5); rr(c, W / 2 - 40, H - 28, 80, 24, 12, "#6e3a1c", 6);
      poligono(c, [[W / 2 - 52, 90], [W / 2 + 52, 90], [W / 2 + 30, 10], [W / 2 - 30, 10]], "#ffe36b", 6);
      break;
    case "sillon":
      rr(c, 20, 20, W - 40, H - 50, 50, acento, 7); rr(c, 0, 90, 60, H - 100, 22, acento, 7); rr(c, W - 60, 90, 60, H - 100, 22, acento, 7);
      rr(c, 50, 110, W - 100, 70, 22, "rgba(255,255,255,0.3)", 5);
      break;
    case "estante":
      rr(c, 0, 0, W, H, 14, "#c97a46", 7);
      for (let s = 0; s < 3; s++) { rr(c, 14, 14 + s * 106, W - 28, 100, 6, "#9b5530", 5); for (let b = 0; b < 6; b++) rr(c, 24 + b * 32, 30 + s * 106 + (b % 3) * 8, 24, 70 - (b % 3) * 8, 4, PALETA[(b + s) % PALETA.length], 4); }
      break;
    case "alfombra":
      el(c, W / 2, H / 2, W / 2 - 4, H / 2 - 4, acento, 7); el(c, W / 2, H / 2, W / 2 - 40, H / 2 - 22, "rgba(255,255,255,0.4)", 0); estrellaDib(c, W / 2, H / 2, 24, "#fff6b8", 4);
      break;
    case "cuadro":
      rr(c, 0, 0, W, H, 12, "#fff6e5", 7); rr(c, 14, 14, W - 28, H - 28, 8, acento, 5); estrellaDib(c, W / 2, H / 2, 40, "#fff6b8", 5);
      break;
  }
  return cv;
}

export function iconoAfinidadTextura(a: Afinidad): string {
  return AFINIDADES[a].color;
}
