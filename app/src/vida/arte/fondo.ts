/* El laboratorio visto de lado, como un corte (al estilo de Creatures): a la izquierda un rincon acogedor con luz calida, plantas y un nido,
   en el centro una ventana de observacion y a la derecha los tubos de contencion, frios y verdes. Todo dibujado en codigo.
   Se generan tres capas: la pared del fondo, el suelo con el subsuelo en corte y un primer plano que va por delante de las criaturas. */

import { Azar } from "../nucleo/azar.ts";
import { MUNDO_H, MUNDO_W, PAL, SUELO_Y } from "./medidas.ts";

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.lineJoin = "round";
  c.lineCap = "round";
  return [cv, c];
}

const vert = (c: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient => {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};

function tubo(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, grosor: number, color = PAL.metal): void {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const g = c.createLinearGradient(x0 + nx * grosor / 2, y0 + ny * grosor / 2, x0 - nx * grosor / 2, y0 - ny * grosor / 2);
  g.addColorStop(0, PAL.metalLuz);
  g.addColorStop(0.35, color);
  g.addColorStop(1, PAL.metalOsc);
  c.strokeStyle = g;
  c.lineWidth = grosor;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}

function remache(c: CanvasRenderingContext2D, x: number, y: number, r = 4): void {
  c.fillStyle = PAL.metalOsc;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(160,200,215,0.25)";
  c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); c.fill();
}

function marco(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grosor: number): void {
  c.fillStyle = PAL.metalOsc;
  c.fillRect(x - grosor, y - grosor, w + grosor * 2, h + grosor * 2);
  c.strokeStyle = PAL.metalLuz;
  c.lineWidth = 2;
  c.strokeRect(x - grosor + 1, y - grosor + 1, w + grosor * 2 - 2, h + grosor * 2 - 2);
  c.strokeStyle = PAL.tinta;
  c.lineWidth = 3;
  c.strokeRect(x - 1, y - 1, w + 2, h + 2);
}

function textoEstarcido(c: CanvasRenderingContext2D, t: string, x: number, y: number, tam: number, color: string, alpha = 0.55): void {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.font = `600 ${tam}px "Chakra Petch", "Rajdhani", monospace`;
  c.textBaseline = "middle";
  c.fillText(t, x, y);
  c.restore();
}

/* ---------------- Pared del fondo ---------------- */

function plantaRoja(c: CanvasRenderingContext2D, x: number, y: number, esc: number, r: Azar, tono = "#d9344f"): void {
  c.save();
  c.translate(x, y);
  c.scale(esc, esc);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.34 + r.entre(-0.08, 0.08);
    const l = 130 + r.entre(-30, 40);
    const px_ = Math.cos(a) * l, py = Math.sin(a) * l;
    c.strokeStyle = "#2a0d16";
    c.lineWidth = 16;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(px_ * 0.4 + 20, py * 0.6, px_, py); c.stroke();
    c.strokeStyle = tono;
    c.lineWidth = 10;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(px_ * 0.4 + 20, py * 0.6, px_, py); c.stroke();
    c.fillStyle = "#ff8a9c";
    c.beginPath(); c.ellipse(px_, py, 9, 15, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function hongos(c: CanvasRenderingContext2D, x: number, y: number, esc: number, r: Azar): void {
  for (let i = 0; i < 4; i++) {
    const hx = x + (i - 1.5) * 38 * esc + r.entre(-8, 8);
    const alt = (60 + r.entre(0, 70)) * esc;
    c.strokeStyle = "#3a2a55";
    c.lineWidth = 9 * esc;
    c.beginPath(); c.moveTo(hx, y); c.quadraticCurveTo(hx + r.entre(-14, 14), y - alt * 0.5, hx, y - alt); c.stroke();
    c.fillStyle = "#8a5ad6";
    c.beginPath(); c.ellipse(hx, y - alt, 30 * esc, 14 * esc, 0, Math.PI, 0); c.fill();
    c.fillStyle = "rgba(220,190,255,0.8)";
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(hx - 14 * esc + k * 14 * esc, y - alt - 6 * esc, 2.4 * esc, 0, Math.PI * 2); c.fill(); }
  }
}

function ventanaRedonda(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, r_: Azar): void {
  // Lo que se ve fuera: un cielo de otro mundo con plantas altas
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  const g = c.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, "#0c2a3a"); g.addColorStop(0.6, "#14505a"); g.addColorStop(1, "#0a2a30");
  c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.fillStyle = "rgba(210,240,235,0.9)";
  c.beginPath(); c.arc(cx + r * 0.35, cy - r * 0.4, r * 0.16, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(10,60,70,0.55)";
  c.beginPath(); c.arc(cx + r * 0.3, cy - r * 0.42, r * 0.17, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(190,240,255,${r_.entre(0.2, 0.8)})`; c.fillRect(cx + r_.entre(-r, r), cy + r_.entre(-r, 0), 2, 2); }
  c.fillStyle = "#06181c";
  for (let i = 0; i < 9; i++) {
    const bx = cx - r + (i / 8) * r * 2;
    const alto = 70 + r_.entre(0, 150);
    c.beginPath(); c.moveTo(bx - 12, cy + r); c.quadraticCurveTo(bx + r_.entre(-20, 20), cy + r - alto * 0.6, bx, cy + r - alto); c.quadraticCurveTo(bx + 14, cy + r - alto * 0.5, bx + 14, cy + r); c.fill();
  }
  c.restore();
  // Reflejo del cristal y marco
  c.strokeStyle = "rgba(180,230,240,0.18)"; c.lineWidth = 6;
  c.beginPath(); c.arc(cx, cy, r * 0.82, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
  for (const [rr, col, w] of [[r + 14, PAL.metalOsc, 28], [r + 2, PAL.metal, 10]] as [number, string, number][]) {
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke();
  }
  c.strokeStyle = PAL.metalLuz; c.lineWidth = 2;
  c.beginPath(); c.arc(cx, cy, r + 26, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; remache(c, cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), 5); }
}

function ventanaObservacion(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Azar): void {
  marco(c, x, y, w, h, 22);
  // Sala de control detras del cristal
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#07161c"); g.addColorStop(1, "#0b2229");
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = "#0a1a20";
  c.fillRect(x, y + h * 0.72, w, h * 0.28);
  // Monitores con luz fria
  for (let i = 0; i < 5; i++) {
    const mx = x + 40 + i * (w - 80) / 5;
    const mw = (w - 80) / 5 - 26;
    c.fillStyle = "#0c2a33"; c.fillRect(mx, y + h * 0.5, mw, h * 0.2);
    c.fillStyle = `rgba(70,217,232,${0.25 + 0.25 * r.next()})`; c.fillRect(mx + 5, y + h * 0.5 + 5, mw - 10, h * 0.2 - 10);
    c.strokeStyle = "rgba(10,40,50,0.8)"; c.lineWidth = 2;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(mx + 5, y + h * 0.5 + 5 + k * (h * 0.2 - 10) / 4); c.lineTo(mx + mw - 5, y + h * 0.5 + 5 + k * (h * 0.2 - 10) / 4); c.stroke(); }
  }
  // Una figura de bata, de espaldas, mirando la habitacion
  const fx = x + w * 0.62;
  c.fillStyle = "#05090c";
  c.beginPath(); c.arc(fx, y + h * 0.4, 20, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(fx - 38, y + h * 0.75); c.quadraticCurveTo(fx - 42, y + h * 0.5, fx - 16, y + h * 0.47); c.lineTo(fx + 16, y + h * 0.47); c.quadraticCurveTo(fx + 42, y + h * 0.5, fx + 38, y + h * 0.75); c.closePath(); c.fill();
  c.strokeStyle = "rgba(120,200,215,0.22)"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(fx - 36, y + h * 0.55); c.lineTo(fx - 18, y + h * 0.49); c.moveTo(fx + 36, y + h * 0.55); c.lineTo(fx + 18, y + h * 0.49); c.stroke();
  // Reflejos del cristal
  c.fillStyle = "rgba(190,235,245,0.06)";
  c.beginPath(); c.moveTo(x + w * 0.1, y); c.lineTo(x + w * 0.28, y); c.lineTo(x + w * 0.16, y + h); c.lineTo(x - w * 0.02, y + h); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x + w * 0.4, y); c.lineTo(x + w * 0.5, y); c.lineTo(x + w * 0.38, y + h); c.lineTo(x + w * 0.3, y + h); c.closePath(); c.fill();
  // Montantes
  c.fillStyle = PAL.metalOsc;
  for (const k of [0.33, 0.66]) c.fillRect(x + w * k - 8, y, 16, h);
  textoEstarcido(c, "OBSERVACIÓN", x + 8, y - 44, 20, PAL.cian, 0.5);
}

function cubaContencion(c: CanvasRenderingContext2D, cx: number, base: number, ancho: number, alto: number, color: [string, string], contenido: "tentaculos" | "embrion" | "vacia" | "grieta", r: Azar, etiqueta: string): void {
  const x0 = cx - ancho / 2;
  const y0 = base - alto;
  // Cristal con liquido
  c.save();
  c.beginPath(); c.roundRect(x0, y0, ancho, alto, 26); c.clip();
  const g = c.createLinearGradient(0, y0, 0, base);
  g.addColorStop(0, color[0]); g.addColorStop(1, color[1]);
  c.fillStyle = g; c.fillRect(x0, y0, ancho, alto);
  // Rayas de luz del liquido
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.fillRect(x0 + ancho * 0.12, y0, ancho * 0.1, alto);
  c.fillStyle = "rgba(255,255,255,0.04)";
  c.fillRect(x0 + ancho * 0.7, y0, ancho * 0.06, alto);
  // Lo que hay dentro
  c.fillStyle = "rgba(4,18,16,0.82)";
  c.strokeStyle = "rgba(4,18,16,0.82)";
  c.lineWidth = 8;
  const my = y0 + alto * 0.5;
  if (contenido === "embrion") {
    c.beginPath(); c.ellipse(cx, my - 20, ancho * 0.22, alto * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 14, my - 70, ancho * 0.16, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(cx - 20, my + 40); c.quadraticCurveTo(cx - 60, my + 120, cx - 20, my + 170); c.moveTo(cx + 10, my + 40); c.quadraticCurveTo(cx + 50, my + 130, cx + 10, my + 190); c.stroke();
    c.beginPath(); c.moveTo(cx - 40, my - 30); c.quadraticCurveTo(cx - 80, my, cx - 60, my + 60); c.stroke();
  } else if (contenido === "tentaculos") {
    c.beginPath(); c.ellipse(cx, my - 40, ancho * 0.3, alto * 0.14, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) {
      const tx = cx + (i - 2.5) * ancho * 0.11;
      c.beginPath(); c.moveTo(tx, my - 10); c.bezierCurveTo(tx + r.entre(-50, 50), my + 60, tx + r.entre(-60, 60), my + 130, tx + r.entre(-30, 30), my + 200); c.stroke();
    }
  } else if (contenido === "grieta") {
    c.strokeStyle = "rgba(230,255,250,0.5)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 10, y0 + alto * 0.2); c.lineTo(cx + 12, y0 + alto * 0.38); c.lineTo(cx - 8, y0 + alto * 0.52); c.lineTo(cx + 18, y0 + alto * 0.72); c.stroke();
    c.beginPath(); c.moveTo(cx + 12, y0 + alto * 0.38); c.lineTo(cx + 48, y0 + alto * 0.46); c.stroke();
  }
  // Un menisco arriba
  c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x0, y0 + 36, ancho, 3);
  c.restore();
  c.strokeStyle = "rgba(200,240,240,0.35)"; c.lineWidth = 3;
  c.beginPath(); c.roundRect(x0, y0, ancho, alto, 26); c.stroke();
  // Tapas
  for (const [yy, hh] of [[y0 - 34, 40], [base - 6, 64]] as [number, number][]) {
    const gg = vert(c, yy, yy + hh, PAL.metalLuz, PAL.metalOsc);
    c.fillStyle = gg; c.beginPath(); c.roundRect(x0 - 18, yy, ancho + 36, hh, 10); c.fill();
    c.strokeStyle = PAL.tinta; c.lineWidth = 3; c.stroke();
    remache(c, x0 - 4, yy + hh / 2, 5); remache(c, x0 + ancho + 4, yy + hh / 2, 5);
  }
  // Tubos que suben y bajan
  tubo(c, cx - ancho * 0.25, y0 - 34, cx - ancho * 0.25, 160, 22);
  tubo(c, cx + ancho * 0.22, y0 - 34, cx + ancho * 0.22, 190, 14);
  // Consola en la base
  const ky = base + 58;
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(x0 - 6, ky - 4, ancho + 12, SUELO_Y - ky + 4, 6); c.fill();
  c.strokeStyle = PAL.metal; c.lineWidth = 2; c.stroke();
  c.fillStyle = "#06181c"; c.fillRect(x0 + 10, ky + 8, ancho * 0.5, 26);
  c.fillStyle = "rgba(124,240,138,0.65)"; c.fillRect(x0 + 14, ky + 12, ancho * 0.3, 18);
  textoEstarcido(c, etiqueta, x0 + 14, ky + 55, 15, PAL.verde, 0.6);
  for (let i = 0; i < 4; i++) { c.fillStyle = [PAL.rojo, PAL.verde, PAL.cian, PAL.ambar][i]; c.globalAlpha = 0.7; c.beginPath(); c.arc(x0 + ancho * 0.62 + i * 20, ky + 20, 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
}

export function pintarPared(): HTMLCanvasElement {
  const [cv, c] = lienzo(MUNDO_W, MUNDO_H);
  const r = new Azar(20261103);
  // Pared base y paneles
  c.fillStyle = vert(c, 0, SUELO_Y, "#0a161b", "#112530");
  c.fillRect(0, 0, MUNDO_W, MUNDO_H);
  for (let x = 0; x < MUNDO_W; x += 213) {
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x, 150, 5, SUELO_Y - 150);
    c.fillStyle = "rgba(90,150,170,0.08)"; c.fillRect(x + 5, 150, 2, SUELO_Y - 150);
    for (const y of [190, 1060]) { remache(c, x + 22, y, 4); remache(c, x - 12 < 0 ? 12 : x - 12, y, 4); }
  }
  // Manchas y desgaste
  for (let i = 0; i < 220; i++) {
    c.fillStyle = `rgba(${r.next() < 0.5 ? "0,0,0" : "120,190,210"},${r.entre(0.02, 0.06)})`;
    c.beginPath(); c.ellipse(r.entre(0, MUNDO_W), r.entre(160, SUELO_Y), r.entre(20, 140), r.entre(6, 40), 0, 0, Math.PI * 2); c.fill();
  }
  // Zocalo
  c.fillStyle = "#0a1418"; c.fillRect(0, SUELO_Y - 70, MUNDO_W, 70);
  c.fillStyle = "rgba(90,150,170,0.14)"; c.fillRect(0, SUELO_Y - 70, MUNDO_W, 3);

  // Techo con conductos
  c.fillStyle = vert(c, 0, 150, "#04090b", "#0c1a20");
  c.fillRect(0, 0, MUNDO_W, 150);
  c.fillStyle = PAL.metalOsc; c.fillRect(0, 60, MUNDO_W, 62);
  c.fillStyle = "rgba(130,180,200,0.16)"; c.fillRect(0, 60, MUNDO_W, 3);
  for (let x = 40; x < MUNDO_W; x += 120) { c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(x, 60, 4, 62); }
  // Tuberias de pared
  tubo(c, 0, 220, MUNDO_W, 220, 30);
  tubo(c, 0, 262, MUNDO_W, 262, 16);
  for (const x of [330, 1010, 1660, 2330]) { c.fillStyle = PAL.metalOsc; c.fillRect(x - 12, 204, 24, 74); c.strokeStyle = PAL.tinta; c.lineWidth = 2; c.strokeRect(x - 12, 204, 24, 74); remache(c, x, 215, 3); remache(c, x, 266, 3); }
  // Cables colgando
  c.strokeStyle = "#05090b"; c.lineWidth = 7;
  for (const [x0, x1, caida] of [[240, 520, 90], [880, 1180, 70], [1500, 1760, 110], [2150, 2470, 80]] as number[][]) {
    c.beginPath(); c.moveTo(x0, 122); c.quadraticCurveTo((x0 + x1) / 2, 122 + caida * 2, x1, 122); c.stroke();
  }

  // --- Rincon calido, a la izquierda ---
  const calido = c.createRadialGradient(560, 700, 60, 560, 700, 700);
  calido.addColorStop(0, "rgba(255,179,92,0.14)"); calido.addColorStop(1, "rgba(255,179,92,0)");
  c.fillStyle = calido; c.fillRect(0, 150, 1200, SUELO_Y - 150);
  ventanaRedonda(c, 560, 590, 190, r);
  // Estantes con frascos
  for (const [sx, sy] of [[120, 470], [120, 640]] as number[][]) {
    c.fillStyle = PAL.madera; c.fillRect(sx, sy, 250, 14);
    c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(sx, sy + 14, 250, 6);
    for (let i = 0; i < 5; i++) {
      const bx = sx + 18 + i * 46, bh = 40 + r.entre(0, 30);
      const col = [PAL.verde, PAL.cian, PAL.ambar, "#c98cff", PAL.rojo][i % 5];
      c.fillStyle = "rgba(180,220,230,0.12)"; c.beginPath(); c.roundRect(bx, sy - bh, 32, bh, 6); c.fill();
      c.fillStyle = col; c.globalAlpha = 0.5; c.fillRect(bx + 3, sy - bh * 0.7, 26, bh * 0.65); c.globalAlpha = 1;
      c.strokeStyle = "rgba(200,240,240,0.35)"; c.lineWidth = 2; c.beginPath(); c.roundRect(bx, sy - bh, 32, bh, 6); c.stroke();
    }
  }
  // Nido: un cojin grande y una manta
  const nx = 640, ny = SUELO_Y - 4;
  c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(nx, ny, 230, 20, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#5a2f2a"; c.beginPath(); c.ellipse(nx, ny - 26, 210, 44, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#7a3f36"; c.beginPath(); c.ellipse(nx, ny - 40, 190, 34, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#93503f"; c.beginPath(); c.ellipse(nx - 20, ny - 50, 140, 20, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255,200,150,0.3)"; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(nx - 90 + i * 60, ny - 42, 14, Math.PI, Math.PI * 2); c.stroke(); }
  // Plantas
  plantaRoja(c, 150, SUELO_Y - 20, 1.25, r);
  c.fillStyle = "#2a1c18"; c.beginPath(); c.moveTo(105, SUELO_Y - 22); c.lineTo(195, SUELO_Y - 22); c.lineTo(180, SUELO_Y); c.lineTo(120, SUELO_Y); c.closePath(); c.fill();
  hongos(c, 960, SUELO_Y - 6, 1.1, r);
  // Lampara colgante
  c.strokeStyle = "#05090b"; c.lineWidth = 4; c.beginPath(); c.moveTo(640, 122); c.lineTo(640, 300); c.stroke();
  c.fillStyle = PAL.ambarOsc; c.beginPath(); c.moveTo(600, 330); c.quadraticCurveTo(640, 270, 680, 330); c.closePath(); c.fill();
  c.fillStyle = PAL.ambar; c.beginPath(); c.ellipse(640, 330, 40, 9, 0, 0, Math.PI * 2); c.fill();

  // --- Centro: ventana de observacion ---
  ventanaObservacion(c, 1130, 400, 700, 330, r);
  // Panel con un letrero de advertencia: franjas de aviso arriba y abajo
  c.fillStyle = "#14100c"; c.fillRect(1230, 800, 160, 70);
  c.save(); c.beginPath(); c.rect(1230, 800, 160, 70); c.clip();
  c.fillStyle = PAL.ambarOsc;
  for (const y0 of [800, 858]) for (let i = -2; i < 9; i++) { c.beginPath(); c.moveTo(1230 + i * 24, y0 + 12); c.lineTo(1242 + i * 24, y0 + 12); c.lineTo(1254 + i * 24, y0); c.lineTo(1242 + i * 24, y0); c.closePath(); c.fill(); }
  c.restore();
  c.fillStyle = PAL.ambar; c.globalAlpha = 0.7; c.fillRect(1250, 826, 120, 4); c.fillRect(1250, 838, 80, 4); c.globalAlpha = 1;
  c.strokeStyle = PAL.tinta; c.lineWidth = 3; c.strokeRect(1230, 800, 160, 70);
  textoEstarcido(c, "OBSERVAR, NO TOCAR", 1470, 836, 20, PAL.ambar, 0.55);

  // --- Derecha: contencion ---
  const frio = c.createRadialGradient(2150, 800, 80, 2150, 800, 760);
  frio.addColorStop(0, "rgba(70,217,232,0.12)"); frio.addColorStop(1, "rgba(70,217,232,0)");
  c.fillStyle = frio; c.fillRect(1500, 150, 1060, SUELO_Y - 150);
  cubaContencion(c, 1960, 1000, 200, 640, ["#1f8f6a", "#0c3a38"], "tentaculos", r, "SUJETO 07");
  cubaContencion(c, 2230, 1000, 200, 640, ["#2aa3b8", "#0d3a4a"], "embrion", r, "SUJETO 12");
  cubaContencion(c, 2470, 1000, 150, 520, ["#3a6a50", "#102a24"], "grieta", r, "SUJETO 03");
  // Baliza de alarma
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(2490, 300, 40, 56, 6); c.fill();
  c.fillStyle = PAL.rojoOsc; c.beginPath(); c.arc(2510, 322, 14, 0, Math.PI * 2); c.fill();
  return cv;
}

/* ---------------- Suelo y subsuelo ---------------- */

export function pintarSuelo(): HTMLCanvasElement {
  const [cv, c] = lienzo(MUNDO_W, MUNDO_H - SUELO_Y + 20);
  const r = new Azar(77);
  const h = MUNDO_H - SUELO_Y + 20;
  // Plancha del suelo
  c.fillStyle = vert(c, 0, 62, "#26404b", "#14262e");
  c.fillRect(0, 0, MUNDO_W, 62);
  c.fillStyle = "rgba(170,220,235,0.35)"; c.fillRect(0, 0, MUNDO_W, 3);
  c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(0, 56, MUNDO_W, 6);
  for (let x = 0; x < MUNDO_W; x += 320) { c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(x, 3, 4, 53); remache(c, x + 20, 30, 4); remache(c, x + 300, 30, 4); }
  // Rejilla de ventilacion en la zona de contencion
  for (let x = 1780; x < 2520; x += 120) {
    c.fillStyle = "#04090b"; c.fillRect(x, 14, 90, 22);
    c.fillStyle = "rgba(255,90,77,0.16)"; c.fillRect(x, 14, 90, 22);
    c.fillStyle = "#0e1b21"; for (let k = 0; k < 9; k++) c.fillRect(x + 6 + k * 10, 14, 4, 22);
  }
  // Subsuelo en corte
  c.fillStyle = vert(c, 62, h, "#0a1519", "#040a0c");
  c.fillRect(0, 62, MUNDO_W, h);
  for (let i = 0; i < 280; i++) {
    c.fillStyle = `rgba(${r.next() < 0.5 ? "0,0,0" : "100,160,180"},${r.entre(0.02, 0.06)})`;
    c.beginPath(); c.ellipse(r.entre(0, MUNDO_W), r.entre(70, h), r.entre(20, 120), r.entre(5, 24), 0, 0, Math.PI * 2); c.fill();
  }
  // Conductos horizontales
  tubo(c, 0, 120, MUNDO_W, 120, 46, PAL.metal);
  tubo(c, 0, 200, MUNDO_W, 200, 24);
  tubo(c, 0, 262, MUNDO_W, 262, 60, PAL.metal);
  // Un conducto con liquido verde luminoso
  c.fillStyle = "rgba(124,240,138,0.4)"; c.fillRect(0, 252, MUNDO_W, 10);
  for (const x of [200, 640, 1100, 1500, 1980, 2400]) {
    c.fillStyle = PAL.metalOsc; c.fillRect(x - 16, 98, 32, 188); c.strokeStyle = PAL.tinta; c.lineWidth = 3; c.strokeRect(x - 16, 98, 32, 188);
    remache(c, x, 110, 4); remache(c, x, 274, 4);
  }
  // Valvulas
  for (const x of [420, 1300, 2200]) {
    c.strokeStyle = PAL.rojoOsc; c.lineWidth = 8; c.beginPath(); c.arc(x, 200, 22, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x - 22, 200); c.lineTo(x + 22, 200); c.moveTo(x, 178); c.lineTo(x, 222); c.stroke();
  }
  // Cables y piedras del fondo
  c.strokeStyle = "#020607"; c.lineWidth = 9;
  for (let i = 0; i < 7; i++) { const x0 = i * 380; c.beginPath(); c.moveTo(x0, 310); c.bezierCurveTo(x0 + 120, 340 + r.entre(0, 30), x0 + 240, 280, x0 + 380, 320); c.stroke(); }
  // Luces de pozo
  for (const [x, col] of [[300, PAL.cian], [980, PAL.verde], [1760, PAL.cian], [2340, PAL.rojo]] as [number, string][]) {
    c.fillStyle = col; c.globalAlpha = 0.6; c.beginPath(); c.arc(x, 330, 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
  return cv;
}

/* ---------------- Primer plano ---------------- */

export function pintarFrente(): HTMLCanvasElement {
  const [cv, c] = lienzo(MUNDO_W, MUNDO_H);
  const r = new Azar(5);
  // Columnas de los extremos con franjas de aviso
  for (const x of [0, MUNDO_W - 44]) {
    c.fillStyle = vert(c, 0, SUELO_Y, "#060d10", "#0c181d"); c.fillRect(x, 0, 44, SUELO_Y);
    c.fillStyle = x === 0 ? "rgba(120,180,200,0.2)" : "rgba(0,0,0,0.5)"; c.fillRect(x === 0 ? 40 : x, 0, 4, SUELO_Y);
    c.save(); c.beginPath(); c.rect(x, 900, 44, 200); c.clip();
    c.fillStyle = "#a07a1e";
    for (let i = -2; i < 12; i++) { c.beginPath(); c.moveTo(x - 10, 900 + i * 40); c.lineTo(x + 54, 900 + i * 40 - 64); c.lineTo(x + 54, 900 + i * 40 - 36); c.lineTo(x - 10, 900 + i * 40 + 28); c.closePath(); c.fill(); }
    c.restore();
  }
  // Hojas que asoman por delante, a la izquierda
  plantaRoja(c, 66, SUELO_Y + 10, 0.9, r, "#b82a44");
  // Cables que cuelgan por delante
  c.strokeStyle = "rgba(2,5,7,0.95)"; c.lineWidth = 6;
  for (const x of [800, 1900, 2380]) { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 20, 120, x - 24, 220, x + 10, 330 + r.entre(0, 40)); c.stroke(); }
  return cv;
}

/** Un halo suave de luz para sumar encima (se usa con mezcla aditiva). */
export function pintarHalo(): HTMLCanvasElement {
  const [cv, c] = lienzo(256, 256);
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  return cv;
}

/** Un haz de luz que cae del techo. */
export function pintarHaz(): HTMLCanvasElement {
  const [cv, c] = lienzo(256, 512);
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.beginPath(); c.moveTo(96, 0); c.lineTo(160, 0); c.lineTo(256, 512); c.lineTo(0, 512); c.closePath(); c.fill();
  return cv;
}

/** Una vineta oscura para los bordes de la pantalla. */
export function pintarVineta(): HTMLCanvasElement {
  const [cv, c] = lienzo(512, 288);
  const g = c.createRadialGradient(256, 144, 110, 256, 144, 330);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,4,6,0.78)");
  c.fillStyle = g; c.fillRect(0, 0, 512, 288);
  return cv;
}

export function pintarPunto(): HTMLCanvasElement {
  const [cv, c] = lienzo(32, 32);
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  return cv;
}
