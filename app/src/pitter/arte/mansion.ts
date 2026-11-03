/* Piezas de la mansion circular. El edificio es un octogono: cada piso tiene SECTORES habitaciones y cada una es una caja con su fachada de ladrillo
   (un lado del octogono) y un hueco por donde se ve el interior en perspectiva real. Este archivo guarda las medidas, la fachada, el tejado y la base. */

import { TINTA, azar, degradado, el, lienzo, poligono, rr } from "./dibujo.ts";
import { K } from "./escenarios.ts";
import { ladrillos } from "./torre.ts";

export const SECTORES = 8;
export const PISOS = 3;
/** Lado del octogono: ancho de la fachada de cada habitacion. */
export const LADO = 640;
/** Ancho del hueco por donde se ve la habitacion (lo que queda libre entre los dos montantes de ladrillo). */
export const ANCHO_HUECO = 560;
export const ALTO_HAB = 290;
export const BARRA_SUP = 56;
export const BARRA_INF = 24;
export const PROF = 520;
/** Distancia del centro del edificio a la mitad de cada fachada. */
export const APOTEMA = LADO / (2 * Math.tan(Math.PI / SECTORES));
/** Distancia del centro del edificio a cada esquina. */
export const RADIO_ESQUINA = LADO / (2 * Math.sin(Math.PI / SECTORES));
export const PASO_PISO = ALTO_HAB + BARRA_SUP + BARRA_INF;
export const BASE_H = 170;
export const TECHO_ALTO = 230;
/** Ancho del remate del tejado, donde se juntan las caras inclinadas. */
export const LADO_CUMBRE = LADO * 0.3;

/* Atlas de la base (planta baja) y del tejado: un trozo de 640 de ancho por cara. */
export const ATLAS_BASE = { w: LADO * 3, h: BASE_H, puerta: { x: 0, y: 0, w: LADO, h: BASE_H }, ventana: { x: LADO, y: 0, w: LADO, h: BASE_H }, macetas: { x: LADO * 2, y: 0, w: LADO, h: BASE_H } };
export const ATLAS_TECHO = { w: LADO * 2, h: 250, tejas: { x: 0, y: 0, w: LADO, h: 250 }, buhardilla: { x: LADO, y: 0, w: LADO, h: 250 } };

/* La fachada: ladrillo de una pared completa (LADO x PASO_PISO) con el hueco ya marcado, y la puerta cerrada que tapa una habitacion bloqueada. */
export const FACHADA = {
  w: 1200,
  h: PASO_PISO,
  ladrillo: { x: 0, y: 0, w: LADO, h: PASO_PISO },
  puerta: { x: LADO, y: 0, w: ANCHO_HUECO, h: ALTO_HAB },
};
export const K_FACHADA = 1.25;

function nuevo(w: number, h: number, k = K): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [cv, c] = lienzo(w * k, h * k);
  c.scale(k, k);
  return [cv, c];
}

export function fachada(): HTMLCanvasElement {
  const [cv, c] = nuevo(FACHADA.w, FACHADA.h, K_FACHADA);
  const m = (LADO - ANCHO_HUECO) / 2;
  ladrillos(c, 0, 0, LADO, PASO_PISO, 31);
  // cornisa bajo el piso de arriba y zocalo sobre el de abajo
  c.fillStyle = "rgba(42,21,69,0.16)"; c.fillRect(6, BARRA_SUP - 14, LADO - 12, 12);
  rr(c, 0, PASO_PISO - BARRA_INF + 2, LADO, BARRA_INF - 2, 4, "#c97a46", 5);
  // marco del hueco
  c.lineWidth = 8; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(m, BARRA_SUP, ANCHO_HUECO, ALTO_HAB, 4); c.stroke();
  // puerta cerrada con candado
  c.save(); c.translate(FACHADA.puerta.x, 0);
  const w = ANCHO_HUECO, h = ALTO_HAB;
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 4); c.clip();
  c.fillStyle = degradado(c, 0, 0, 0, h, "#4a3a6a", "#2a1a4a"); c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.lineWidth = 8; for (let x = -h; x < w; x += 36) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
  c.restore();
  rr(c, w / 2 - 36, h / 2 - 2, 72, 58, 12, "#ffd23f", 6);
  c.lineWidth = 10; c.strokeStyle = TINTA; c.beginPath(); c.arc(w / 2, h / 2 - 2, 23, Math.PI, 0); c.stroke();
  c.lineWidth = 5; c.strokeStyle = "#ffd23f"; c.beginPath(); c.arc(w / 2, h / 2 - 2, 23, Math.PI, 0); c.stroke();
  el(c, w / 2, h / 2 + 24, 7, 7, TINTA, 0);
  c.lineWidth = 8; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 4); c.stroke();
  c.restore();
  return cv;
}

/* La planta baja: tres tipos de pared, la de la puerta grande, la de las ventanas con postigos y la de las macetas. */
export function fachadaBase(): HTMLCanvasElement {
  const [cv, c] = nuevo(ATLAS_BASE.w, BASE_H, K_FACHADA);
  const r = azar(5);
  const cx = LADO / 2;
  const maceta = (x: number): void => {
    rr(c, x - 20, 112, 40, 40, 8, "#ff4f9a", 5);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x - 16 + i * 11, 102 - (i % 2) * 10, 10, 18, (i - 1.5) * 0.3, 0, Math.PI * 2); c.fillStyle = r() < 0.5 ? "#4fdc7a" : "#3cbf68"; c.fill(); c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke(); }
  };
  const ventana = (x: number): void => {
    rr(c, x, 24, 96, 100, 8, "#ffd23f", 6);
    c.strokeStyle = TINTA; c.lineWidth = 3;
    for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(x + 6, 38 + j * 18); c.lineTo(x + 90, 38 + j * 18); c.stroke(); }
  };
  for (let k = 0; k < 3; k++) {
    c.save(); c.translate(k * LADO, 0);
    ladrillos(c, 0, 0, LADO, BASE_H, 41 + k);
    rr(c, 0, BASE_H - 16, LADO, 16, 4, "#ff4f9a", 5);
    if (k === 0) {
      rr(c, cx - 150, 12, 300, BASE_H - 12, 8, "#8a4a26", 7);
      c.beginPath(); c.moveTo(cx - 138, BASE_H - 16); c.lineTo(cx - 138, 84); c.arc(cx, 84, 138, Math.PI, 0); c.lineTo(cx + 138, BASE_H - 16); c.closePath();
      c.fillStyle = "#c97a46"; c.fill(); c.lineWidth = 7; c.strokeStyle = TINTA; c.stroke();
      c.beginPath(); c.moveTo(cx, 8); c.lineTo(cx, BASE_H - 16); c.stroke();
      for (const x of [cx - 68, cx + 68]) rr(c, x - 42, 70, 84, 70, 12, "#e29a63", 5);
      el(c, cx - 14, 118, 8, 8, "#ffd23f", 3); el(c, cx + 14, 118, 8, 8, "#ffd23f", 3);
      maceta(60); maceta(LADO - 60);
    } else if (k === 1) {
      ventana(120); ventana(LADO - 216);
      maceta(cx);
    } else {
      ventana(cx - 48);
      maceta(90); maceta(LADO - 90); maceta(cx - 140); maceta(cx + 140);
    }
    c.restore();
  }
  return cv;
}

/* El tejado: una cara de tejas naranjas y otra con buhardilla. Cada cara es un trapecio que se estrecha hacia la cumbre. */
export function fachadaTecho(): HTMLCanvasElement {
  const [cv, c] = nuevo(ATLAS_TECHO.w, ATLAS_TECHO.h, K_FACHADA);
  const w = LADO, h = ATLAS_TECHO.h;
  for (let k = 0; k < 2; k++) {
    c.save(); c.translate(k * w, 0);
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.fillStyle = degradado(c, 0, 0, 0, h, "#f07a1e", "#ff9a3a"); c.fillRect(0, 0, w, h);
    const q = azar(4 + k);
    for (let y = 14; y < h; y += 26) for (let x = ((y / 26) % 2) * 22; x < w + 20; x += 44) { c.fillStyle = q() < 0.3 ? "rgba(255,200,120,0.45)" : "rgba(180,70,10,0.18)"; c.beginPath(); c.ellipse(x, y, 18, 11, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
    if (k === 1) {
      const cx = w / 2;
      poligono(c, [[cx - 80, h - 18], [cx - 80, 118], [cx, 62], [cx + 80, 118], [cx + 80, h - 18]], "#fbeed8", 7);
      rr(c, cx - 38, 128, 76, 70, 10, "#7fd6e8", 6);
      c.strokeStyle = TINTA; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, 128); c.lineTo(cx, 198); c.moveTo(cx - 38, 163); c.lineTo(cx + 38, 163); c.stroke();
    }
    rr(c, 0, h - 16, w, 16, 4, "#fbeed8", 5);
    c.lineWidth = 8; c.strokeStyle = TINTA; c.strokeRect(4, 4, w - 8, h - 8);
    c.restore();
  }
  return cv;
}
