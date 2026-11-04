/* Los objetos de la habitacion, dibujados en codigo. Cada uno es un lienzo con un punto de anclaje (ax, ay de 0 a 1) para colocarlo en el suelo. */

import { PAL } from "./medidas.ts";

export interface Sprite {
  cv: HTMLCanvasElement;
  ax: number;
  ay: number;
}

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.lineJoin = "round";
  c.lineCap = "round";
  return [cv, c];
}

const contorno = (c: CanvasRenderingContext2D, grosor = 3): void => {
  c.lineWidth = grosor;
  c.strokeStyle = "rgba(4,10,12,0.9)";
  c.stroke();
};

function fruta(): Sprite {
  const [cv, c] = lienzo(140, 150);
  // Una fruta azul, blanda, con un rabito y una hoja
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(70, 138, 44, 8, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(54, 74, 6, 70, 88, 56);
  g.addColorStop(0, "#9ad8ff"); g.addColorStop(0.55, "#3f86d6"); g.addColorStop(1, "#244a9e");
  c.fillStyle = g;
  c.beginPath(); c.moveTo(70, 46); c.bezierCurveTo(112, 30, 128, 92, 98, 124); c.bezierCurveTo(84, 138, 56, 138, 42, 124); c.bezierCurveTo(12, 92, 28, 30, 70, 46); c.fill();
  contorno(c);
  c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.ellipse(52, 70, 9, 16, -0.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#1c3a22"; c.lineWidth = 6; c.beginPath(); c.moveTo(70, 46); c.quadraticCurveTo(66, 26, 78, 14); c.stroke();
  c.fillStyle = "#58c477"; c.beginPath(); c.moveTo(78, 22); c.quadraticCurveTo(110, 4, 118, 30); c.quadraticCurveTo(96, 40, 78, 22); c.fill(); contorno(c, 2);
  return { cv, ax: 0.5, ay: 0.93 };
}

function baya(): Sprite {
  const [cv, c] = lienzo(120, 120);
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(60, 108, 38, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#1c3a22"; c.lineWidth = 5; c.beginPath(); c.moveTo(60, 70); c.quadraticCurveTo(58, 40, 70, 20); c.stroke();
  for (const [x, y, r] of [[40, 82, 24], [78, 84, 22], [58, 62, 22]] as number[][]) {
    const g = c.createRadialGradient(x - 8, y - 8, 2, x, y, r);
    g.addColorStop(0, "#ff9aa0"); g.addColorStop(0.6, "#d3263f"); g.addColorStop(1, "#7c1226");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); contorno(c, 2.5);
    c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(x - 8, y - 9, 4, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = "#58c477"; c.beginPath(); c.ellipse(76, 24, 22, 9, -0.4, 0, Math.PI * 2); c.fill(); contorno(c, 2);
  return { cv, ax: 0.5, ay: 0.92 };
}

function pelota(): Sprite {
  const [cv, c] = lienzo(130, 130);
  const g = c.createRadialGradient(46, 44, 6, 65, 65, 62);
  g.addColorStop(0, "#f4ffb0"); g.addColorStop(0.5, "#9ad14a"); g.addColorStop(1, "#4a8a2c");
  c.fillStyle = g; c.beginPath(); c.arc(65, 65, 56, 0, Math.PI * 2); c.fill(); contorno(c, 3.5);
  // Gajos para que se vea que rueda
  c.save(); c.beginPath(); c.arc(65, 65, 55, 0, Math.PI * 2); c.clip();
  c.strokeStyle = "rgba(30,70,20,0.55)"; c.lineWidth = 5;
  c.beginPath(); c.moveTo(65, 4); c.quadraticCurveTo(20, 65, 65, 126); c.moveTo(65, 4); c.quadraticCurveTo(110, 65, 65, 126); c.moveTo(6, 65); c.lineTo(124, 65); c.stroke();
  c.fillStyle = "rgba(255,255,230,0.35)"; c.beginPath(); c.ellipse(40, 36, 16, 9, -0.7, 0, Math.PI * 2); c.fill();
  c.restore();
  return { cv, ax: 0.5, ay: 0.5 };
}

function bolaFija(): Sprite {
  const [cv, c] = lienzo(150, 170);
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(75, 158, 56, 8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(25, 138, 100, 20, 5); c.fill(); contorno(c, 2.5);
  c.fillStyle = PAL.metal; c.fillRect(66, 108, 18, 34); contorno(c, 2);
  const g = c.createRadialGradient(56, 56, 6, 75, 75, 62);
  g.addColorStop(0, "#f4ffb0"); g.addColorStop(0.5, "#9ad14a"); g.addColorStop(1, "#4a8a2c");
  c.fillStyle = g; c.beginPath(); c.arc(75, 70, 52, 0, Math.PI * 2); c.fill(); contorno(c, 3.5);
  c.strokeStyle = "rgba(30,70,20,0.55)"; c.lineWidth = 5; c.beginPath(); c.moveTo(75, 18); c.quadraticCurveTo(32, 70, 75, 122); c.stroke();
  for (const x of [38, 112]) { c.fillStyle = PAL.metalLuz; c.beginPath(); c.arc(x, 148, 5, 0, Math.PI * 2); c.fill(); }
  return { cv, ax: 0.5, ay: 0.93 };
}

function granulo(): Sprite {
  const [cv, c] = lienzo(60, 56);
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(30, 48, 20, 5, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(24, 26, 2, 30, 32, 22);
  g.addColorStop(0, "#f0c07a"); g.addColorStop(1, "#8a5a2a");
  c.fillStyle = g; c.beginPath(); c.moveTo(14, 36); c.quadraticCurveTo(8, 18, 26, 12); c.quadraticCurveTo(46, 10, 50, 28); c.quadraticCurveTo(52, 44, 30, 46); c.quadraticCurveTo(18, 46, 14, 36); c.fill(); contorno(c, 2.5);
  c.fillStyle = "rgba(255,240,200,0.6)"; c.beginPath(); c.ellipse(24, 22, 6, 3, -0.5, 0, Math.PI * 2); c.fill();
  return { cv, ax: 0.5, ay: 0.88 };
}

function palancaCuerpo(rota: boolean): Sprite {
  const [cv, c] = lienzo(260, 360);
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(130, 348, 100, 9, 0, 0, Math.PI * 2); c.fill();
  // Base y columna
  const g = c.createLinearGradient(40, 0, 220, 0);
  g.addColorStop(0, PAL.metalOsc); g.addColorStop(0.4, PAL.metal); g.addColorStop(1, PAL.metalOsc);
  c.fillStyle = g; c.beginPath(); c.roundRect(48, 270, 164, 76, 10); c.fill(); contorno(c);
  c.fillStyle = g; c.beginPath(); c.roundRect(76, 80, 108, 200, 12); c.fill(); contorno(c);
  // Panel con luces
  c.fillStyle = "#06161b"; c.beginPath(); c.roundRect(92, 100, 76, 56, 6); c.fill(); contorno(c, 2);
  c.fillStyle = rota ? "rgba(255,90,77,0.5)" : "rgba(124,240,138,0.55)"; c.fillRect(100, 108, 60, 12);
  c.fillStyle = "rgba(70,217,232,0.5)"; c.fillRect(100, 128, 36, 8); c.fillRect(100, 140, 52, 6);
  // Tolva por donde sale el granulo
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.moveTo(86, 296); c.lineTo(174, 296); c.lineTo(156, 330); c.lineTo(104, 330); c.closePath(); c.fill(); contorno(c, 2.5);
  c.fillStyle = "#020608"; c.beginPath(); c.ellipse(130, 330, 26, 5, 0, 0, Math.PI * 2); c.fill();
  // Aviso
  c.fillStyle = PAL.ambar; c.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(86 + i * 22, 256); c.lineTo(100 + i * 22, 256); c.lineTo(112 + i * 22, 238); c.lineTo(98 + i * 22, 238); c.closePath(); c.fill(); }
  c.globalAlpha = 1;
  // Soporte del brazo
  c.fillStyle = PAL.metal; c.beginPath(); c.arc(130, 190, 20, 0, Math.PI * 2); c.fill(); contorno(c);
  return { cv, ax: 0.5, ay: 0.97 };
}

function palancaBrazo(): Sprite {
  const [cv, c] = lienzo(40, 150);
  c.fillStyle = PAL.metalLuz; c.beginPath(); c.roundRect(15, 30, 10, 110, 5); c.fill(); contorno(c, 2.5);
  const g = c.createRadialGradient(17, 18, 2, 20, 22, 18);
  g.addColorStop(0, "#ff9a8a"); g.addColorStop(1, "#b02a22");
  c.fillStyle = g; c.beginPath(); c.arc(20, 24, 17, 0, Math.PI * 2); c.fill(); contorno(c, 3);
  return { cv, ax: 0.5, ay: 0.93 };
}

function placa(activa: boolean): Sprite {
  const [cv, c] = lienzo(260, 60);
  c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(130, 50, 118, 6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(10, 20, 240, 30, 6); c.fill(); contorno(c);
  c.save(); c.beginPath(); c.roundRect(18, 24, 224, 22, 4); c.clip();
  c.fillStyle = activa ? "#ff5a4d" : "#6b2a26"; c.fillRect(18, 24, 224, 22);
  c.fillStyle = activa ? "#ffb0a0" : "#8b3a34";
  for (let i = -2; i < 14; i++) { c.beginPath(); c.moveTo(18 + i * 22, 46); c.lineTo(30 + i * 22, 46); c.lineTo(48 + i * 22, 24); c.lineTo(36 + i * 22, 24); c.closePath(); c.fill(); }
  c.restore();
  for (const x of [20, 240]) { c.fillStyle = PAL.metalLuz; c.beginPath(); c.arc(x, 35, 4, 0, Math.PI * 2); c.fill(); }
  return { cv, ax: 0.5, ay: 0.82 };
}

function foco(color: "rojo" | "azul"): Sprite {
  const [cv, c] = lienzo(150, 330);
  c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(75, 318, 56, 8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(30, 296, 90, 22, 6); c.fill(); contorno(c, 2.5);
  c.fillStyle = PAL.metal; c.fillRect(68, 112, 14, 190); contorno(c, 2);
  // Pantalla de la lampara
  const cuerpo = color === "rojo" ? ["#ff9a8a", "#e0382e", "#7c1a16"] : ["#a8f0ff", "#2aa8d6", "#0e4a6a"];
  const g = c.createRadialGradient(62, 78, 4, 75, 90, 56);
  g.addColorStop(0, cuerpo[0]); g.addColorStop(0.55, cuerpo[1]); g.addColorStop(1, cuerpo[2]);
  c.fillStyle = g; c.beginPath(); c.arc(75, 84, 50, 0, Math.PI * 2); c.fill(); contorno(c, 3.5);
  c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.ellipse(56, 64, 12, 7, -0.7, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.metalOsc; c.beginPath(); c.roundRect(52, 128, 46, 18, 4); c.fill(); contorno(c, 2);
  return { cv, ax: 0.5, ay: 0.96 };
}

export function crearObjetos(): Record<string, Sprite> {
  return {
    fruta: fruta(),
    raiz: fruta(),
    baya: baya(),
    pelota: pelota(),
    pelota_pesada: pelota(),
    bola_fija: bolaFija(),
    palanca: palancaCuerpo(false),
    palanca_rota: palancaCuerpo(true),
    palanca_brazo: palancaBrazo(),
    granulo: granulo(),
    placa_on: placa(true),
    placa_off: placa(false),
    foco_rojo: foco("rojo"),
    foco_rojo_b: foco("rojo"),
    foco_azul: foco("azul"),
  };
}

/** Los iconos pequeños de la bandeja de herramientas (mismo dibujo, en miniatura). */
export function icono(tipo: string, objs: Record<string, Sprite>, tam = 64): HTMLCanvasElement {
  const [cv, c] = lienzo(tam, tam);
  const s = objs[tipo === "placa" ? "placa_on" : tipo] ?? objs.fruta;
  const k = Math.min((tam - 8) / s.cv.width, (tam - 8) / s.cv.height);
  const w = s.cv.width * k, h = s.cv.height * k;
  c.drawImage(s.cv, (tam - w) / 2, (tam - h) / 2, w, h);
  return cv;
}
