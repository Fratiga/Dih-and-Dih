/* Los jefes de la campaña, dibujados en codigo con el mismo estilo de los muñecos (cabezotas, contorno de tinta, ojos grandes).
   Las siluetas de assets/criaturas son de prueba (32x32), asi que aqui no se usan. Cuando haya arte real, va en assets/pitter/jefes/<id>.png. */

import { TINTA, el, lienzo, poligono, rr } from "./dibujo.ts";

export const LADO_JEFE = 512;

const relleno = (c: CanvasRenderingContext2D, color: string, grosor = 8): void => {
  c.fillStyle = color;
  c.fill();
  c.lineWidth = grosor;
  c.strokeStyle = TINTA;
  c.stroke();
};

function ojo(c: CanvasRenderingContext2D, x: number, y: number, r: number, iris: string, mirada = 0): void {
  el(c, x, y, r, r * 1.08, "#fffdf2", 6);
  c.beginPath(); c.ellipse(x + mirada, y, r * 0.5, r * 0.82, 0, 0, Math.PI * 2); c.fillStyle = iris; c.fill();
  c.beginPath(); c.ellipse(x + mirada, y, r * 0.14, r * 0.7, 0, 0, Math.PI * 2); c.fillStyle = TINTA; c.fill();
  c.beginPath(); c.arc(x - r * 0.28, y - r * 0.32, r * 0.18, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill();
}

function cuerno(c: CanvasRenderingContext2D, x: number, y: number, dir: number, largo: number, color: string): void {
  c.beginPath();
  c.moveTo(x - 20 * dir, y);
  c.quadraticCurveTo(x + largo * 0.15 * dir, y - largo * 0.6, x + largo * 0.5 * dir, y - largo);
  c.quadraticCurveTo(x + largo * 0.5 * dir, y - largo * 0.4, x + 22 * dir, y + 4);
  c.closePath();
  relleno(c, color, 7);
}

function dientes(c: CanvasRenderingContext2D, x: number, y: number, n: number, paso: number, alto: number): void {
  for (let i = 0; i < n; i++) {
    const px = x + (i - (n - 1) / 2) * paso;
    poligono(c, [[px - paso * 0.36, y], [px + paso * 0.36, y], [px, y + alto]], "#fffdf2", 4);
  }
}

function boca(c: CanvasRenderingContext2D, x: number, y: number, ancho: number, alto: number, interior = "#7a1f45"): void {
  c.beginPath(); c.moveTo(x - ancho, y); c.quadraticCurveTo(x, y + alto * 2, x + ancho, y); c.closePath();
  relleno(c, interior, 7);
}

function sombra(c: CanvasRenderingContext2D, rx = 190): void {
  c.fillStyle = "rgba(42,21,69,0.3)";
  c.beginPath(); c.ellipse(256, 486, rx, 22, 0, 0, Math.PI * 2); c.fill();
}

function kobold(c: CanvasRenderingContext2D): void {
  sombra(c, 130);
  // lanza
  c.strokeStyle = TINTA; c.lineWidth = 16; c.beginPath(); c.moveTo(392, 470); c.lineTo(404, 190); c.stroke();
  c.strokeStyle = "#c98a4b"; c.lineWidth = 8; c.beginPath(); c.moveTo(392, 470); c.lineTo(404, 190); c.stroke();
  poligono(c, [[404, 130], [434, 200], [374, 200]], "#d6d6e6", 6);
  // cuerpo
  rr(c, 176, 318, 160, 148, 54, "#b0623a", 8);
  rr(c, 204, 372, 104, 90, 36, "#e8a878", 0);
  el(c, 206, 468, 40, 20, "#8a4a26", 7); el(c, 306, 468, 40, 20, "#8a4a26", 7);
  el(c, 170, 380, 24, 40, "#c9784a", 7); el(c, 342, 380, 24, 40, "#c9784a", 7);
  // orejas
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(256 + d * 80, 200); c.quadraticCurveTo(256 + d * 190, 150, 256 + d * 200, 90); c.quadraticCurveTo(256 + d * 150, 190, 256 + d * 100, 260); c.closePath(); relleno(c, "#c9784a", 8); poligono(c, [[256 + d * 110, 210], [256 + d * 176, 130], [256 + d * 124, 240]], "#ffb3c4", 0); }
  // cabeza
  el(c, 256, 240, 112, 96, "#c9784a", 8);
  el(c, 256, 280, 64, 44, "#e8a878", 6);
  el(c, 238, 276, 6, 8, TINTA, 0); el(c, 274, 276, 6, 8, TINTA, 0);
  ojo(c, 212, 226, 28, "#ffcf3a"); ojo(c, 300, 226, 28, "#ffcf3a");
  boca(c, 256, 306, 40, 16); dientes(c, 256, 306, 3, 22, 16);
}

function dragarto(c: CanvasRenderingContext2D): void {
  sombra(c, 200);
  // cola
  c.beginPath(); c.moveTo(380, 430); c.quadraticCurveTo(500, 440, 470, 330); c.quadraticCurveTo(450, 400, 370, 400); c.closePath(); relleno(c, "#58b85c", 8);
  // cuerpo
  el(c, 256, 410, 150, 74, "#6bc46a", 8); el(c, 256, 424, 100, 50, "#ffd27a", 0);
  el(c, 150, 470, 38, 20, "#4a9c4e", 7); el(c, 362, 470, 38, 20, "#4a9c4e", 7);
  // espinas
  for (let i = 0; i < 5; i++) poligono(c, [[156 + i * 50, 150 + Math.abs(i - 2) * 16], [186 + i * 50, 150 + Math.abs(i - 2) * 16], [171 + i * 50, 100 + Math.abs(i - 2) * 22]], "#ff8a3c", 6);
  // cabeza
  el(c, 256, 250, 150, 116, "#6bc46a", 8);
  el(c, 256, 300, 96, 56, "#8ee08a", 6);
  cuerno(c, 150, 180, -1, 90, "#ffe9b0"); cuerno(c, 362, 180, 1, 90, "#ffe9b0");
  ojo(c, 190, 232, 32, "#ff9a3c", 4); ojo(c, 322, 232, 32, "#ff9a3c", -4);
  el(c, 232, 282, 7, 9, TINTA, 0); el(c, 280, 282, 7, 9, TINTA, 0);
  boca(c, 256, 320, 56, 18); dientes(c, 256, 320, 4, 26, 20);
}

function protodraco(c: CanvasRenderingContext2D): void {
  sombra(c, 190);
  // alas
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(256 + d * 80, 300); c.quadraticCurveTo(256 + d * 250, 160, 256 + d * 230, 330); c.quadraticCurveTo(256 + d * 190, 300, 256 + d * 170, 350); c.quadraticCurveTo(256 + d * 130, 330, 256 + d * 100, 380); c.closePath(); relleno(c, "#ffb04a", 8); }
  // cuerpo
  el(c, 256, 410, 108, 80, "#ff8a3c", 8); el(c, 256, 424, 70, 50, "#ffe0a0", 0);
  el(c, 186, 474, 30, 18, "#e0702a", 7); el(c, 326, 474, 30, 18, "#e0702a", 7);
  // cabeza
  el(c, 256, 260, 132, 112, "#ff8a3c", 8);
  el(c, 256, 312, 80, 48, "#ffc27a", 6);
  cuerno(c, 176, 188, -1, 80, "#fff1c8"); cuerno(c, 336, 188, 1, 80, "#fff1c8");
  ojo(c, 208, 246, 30, "#3a8aff", 3); ojo(c, 304, 246, 30, "#3a8aff", -3);
  el(c, 238, 304, 6, 8, TINTA, 0); el(c, 274, 304, 6, 8, TINTA, 0);
  boca(c, 256, 332, 44, 14);
  // llama pequeña
  c.beginPath(); c.moveTo(256, 352); c.quadraticCurveTo(220, 400, 256, 430); c.quadraticCurveTo(292, 400, 256, 352); c.closePath(); relleno(c, "#ffd23f", 6);
}

function basilisco(c: CanvasRenderingContext2D): void {
  sombra(c, 180);
  // cuerpo enroscado
  for (let i = 0; i < 3; i++) el(c, 256, 450 - i * 12, 170 - i * 24, 36, i % 2 ? "#4fb086" : "#3a9a72", 8);
  el(c, 256, 430, 90, 22, "#c6f5dc", 0);
  // gorguera
  c.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8; const r = i % 2 ? 150 : 190; c.lineTo(256 + Math.cos(a) * r, 290 + Math.sin(a) * r * 0.85); } c.closePath(); relleno(c, "#ffd23f", 8);
  c.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8; const r = i % 2 ? 100 : 140; c.lineTo(256 + Math.cos(a) * r, 290 + Math.sin(a) * r * 0.85); } c.closePath(); c.fillStyle = "#ff8a3c"; c.fill();
  // cuello y cabeza
  rr(c, 206, 300, 100, 160, 40, "#4fb086", 8);
  el(c, 256, 270, 120, 94, "#5fc496", 8);
  el(c, 256, 304, 70, 40, "#a7ecc9", 6);
  ojo(c, 204, 252, 34, "#ffd23f"); ojo(c, 308, 252, 34, "#ffd23f");
  c.beginPath(); c.moveTo(256, 322); c.lineTo(256, 360); c.moveTo(256, 360); c.lineTo(240, 378); c.moveTo(256, 360); c.lineTo(272, 378); c.strokeStyle = "#ff4f6a"; c.lineWidth = 8; c.stroke();
  el(c, 240, 296, 6, 8, TINTA, 0); el(c, 272, 296, 6, 8, TINTA, 0);
}

function hidra(c: CanvasRenderingContext2D): void {
  sombra(c, 200);
  const cabeza = (x: number, y: number, r: number, color: string): void => {
    el(c, x, y, r * 1.1, r, color, 8); el(c, x, y + r * 0.45, r * 0.7, r * 0.42, "#a8f0ea", 5);
    ojo(c, x - r * 0.42, y - r * 0.1, r * 0.3, "#ffd23f"); ojo(c, x + r * 0.42, y - r * 0.1, r * 0.3, "#ffd23f");
    boca(c, x, y + r * 0.62, r * 0.4, r * 0.14);
  };
  // cuellos
  for (const [x0, x1] of [[200, 120], [312, 392]]) { c.beginPath(); c.moveTo(x0 - 30, 400); c.quadraticCurveTo(x0 - 80, 300, x1 - 20, 210); c.lineTo(x1 + 20, 210); c.quadraticCurveTo(x0 + 70, 300, x0 + 30, 400); c.closePath(); relleno(c, "#3fa8a2", 8); }
  rr(c, 224, 230, 64, 190, 30, "#3fa8a2", 8);
  el(c, 256, 430, 170, 62, "#2f8e8a", 8); el(c, 256, 444, 100, 36, "#8ae0d8", 0);
  cabeza(120, 190, 56, "#46b5af"); cabeza(392, 190, 56, "#46b5af"); cabeza(256, 150, 84, "#52c4be");
}

function behemoth(c: CanvasRenderingContext2D): void {
  sombra(c, 220);
  // patas y cuerpo
  el(c, 256, 400, 200, 100, "#8a5ac8", 8); el(c, 256, 420, 130, 66, "#c9a8f0", 0);
  rr(c, 110, 410, 90, 70, 26, "#7448b0", 8); rr(c, 312, 410, 90, 70, 26, "#7448b0", 8);
  // cabeza
  el(c, 256, 240, 168, 132, "#9a6ad8", 8);
  cuerno(c, 120, 180, -1, 150, "#fff1c8"); cuerno(c, 392, 180, 1, 150, "#fff1c8");
  el(c, 256, 296, 104, 64, "#c9a8f0", 6);
  ojo(c, 190, 224, 34, "#ff4f6a"); ojo(c, 322, 224, 34, "#ff4f6a");
  c.beginPath(); c.moveTo(176, 214); c.lineTo(222, 232); c.moveTo(336, 214); c.lineTo(290, 232); c.lineWidth = 12; c.strokeStyle = TINTA; c.stroke();
  el(c, 232, 288, 9, 11, TINTA, 0); el(c, 280, 288, 9, 11, TINTA, 0);
  boca(c, 256, 326, 64, 20); dientes(c, 256, 326, 4, 32, 22);
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(256 + d * 52, 326); c.quadraticCurveTo(256 + d * 92, 360, 256 + d * 70, 408); c.quadraticCurveTo(256 + d * 62, 366, 256 + d * 34, 340); c.closePath(); relleno(c, "#fff1c8", 6); }
}

function kraken(c: CanvasRenderingContext2D): void {
  sombra(c, 220);
  // tentaculos
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 54;
    const lado = i < 3 ? -1 : 1;
    c.beginPath(); c.moveTo(x - 24, 330); c.quadraticCurveTo(x + lado * 30, 430, x + lado * 80 + (i - 2.5) * 20, 478); c.quadraticCurveTo(x + lado * 40, 440, x + 26, 330); c.closePath(); relleno(c, "#3a8cf0", 8);
    el(c, x + lado * 20, 410, 8, 8, "#bfe0ff", 3);
  }
  // cabeza
  c.beginPath(); c.moveTo(80, 320); c.quadraticCurveTo(80, 40, 256, 40); c.quadraticCurveTo(432, 40, 432, 320); c.quadraticCurveTo(256, 380, 80, 320); c.closePath(); relleno(c, "#4a9cff", 8);
  c.beginPath(); c.ellipse(210, 120, 56, 26, -0.5, 0, Math.PI * 2); c.fillStyle = "rgba(255,255,255,0.45)"; c.fill();
  ojo(c, 190, 230, 46, "#ffd23f"); ojo(c, 322, 230, 46, "#ffd23f");
  boca(c, 256, 316, 54, 20, "#1f3c8a"); dientes(c, 256, 316, 4, 26, 18);
  for (const [x, y] of [[140, 170], [372, 170], [256, 100]]) el(c, x, y, 10, 10, "#8cc2ff", 3);
}

function dragonMagma(c: CanvasRenderingContext2D): void {
  sombra(c, 230);
  // alas
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(256 + d * 100, 330); c.quadraticCurveTo(256 + d * 270, 120, 256 + d * 250, 340); c.quadraticCurveTo(256 + d * 214, 310, 256 + d * 190, 366); c.quadraticCurveTo(256 + d * 150, 330, 256 + d * 122, 396); c.closePath(); relleno(c, "#7a2438", 8); c.strokeStyle = "#ff8a3c"; c.lineWidth = 6; c.beginPath(); c.moveTo(256 + d * 140, 300); c.lineTo(256 + d * 230, 220); c.stroke(); }
  // cuerpo con grietas de magma
  el(c, 256, 410, 150, 84, "#4a1f2e", 8);
  c.strokeStyle = "#ff8a3c"; c.lineWidth = 8; c.beginPath(); c.moveTo(190, 380); c.lineTo(220, 420); c.lineTo(200, 460); c.moveTo(320, 376); c.lineTo(296, 420); c.lineTo(330, 458); c.stroke();
  el(c, 170, 474, 34, 18, "#3a1424", 7); el(c, 342, 474, 34, 18, "#3a1424", 7);
  // cabeza
  el(c, 256, 250, 138, 114, "#6a2a3e", 8);
  el(c, 256, 304, 86, 50, "#a24a5a", 6);
  cuerno(c, 160, 186, -1, 120, "#2a1020"); cuerno(c, 352, 186, 1, 120, "#2a1020");
  c.strokeStyle = "#ff8a3c"; c.lineWidth = 7; c.beginPath(); c.moveTo(210, 170); c.lineTo(236, 206); c.moveTo(302, 170); c.lineTo(276, 206); c.stroke();
  ojo(c, 204, 244, 32, "#ff8a3c"); ojo(c, 308, 244, 32, "#ff8a3c");
  c.beginPath(); c.moveTo(172, 226); c.lineTo(226, 246); c.moveTo(340, 226); c.lineTo(286, 246); c.lineWidth = 13; c.strokeStyle = TINTA; c.stroke();
  el(c, 236, 296, 7, 10, "#ff8a3c", 0); el(c, 276, 296, 7, 10, "#ff8a3c", 0);
  boca(c, 256, 330, 56, 20, "#ff6a2a"); dientes(c, 256, 330, 4, 28, 20);
}

const DIBUJOS: Record<string, (c: CanvasRenderingContext2D) => void> = {
  kobold, dragarto, protodraco, basilisco, hidra, behemoth, kraken, "dragon-de-magma": dragonMagma,
};

export function crearJefes(ids: string[]): Map<string, HTMLCanvasElement> {
  const m = new Map<string, HTMLCanvasElement>();
  for (const id of ids) {
    const [cv, c] = lienzo(LADO_JEFE, LADO_JEFE);
    (DIBUJOS[id] ?? kobold)(c);
    m.set(id, cv);
  }
  return m;
}
