/* Las seis caras de una habitacion dibujadas planas en una sola imagen (atlas): pared del fondo, dos paredes laterales, suelo y techo.
   La mansion las proyecta en perspectiva segun el angulo de cada habitacion. Medidas en unidades del mundo; la imagen va a KA pixeles por unidad. */

import { TINTA, azar, lienzo, poligono, rr, sparkle } from "./dibujo.ts";
import { patronPlano, type TemaHab } from "./habitacion.ts";
import { ALTO_HAB, ANCHO_HUECO, PROF } from "./mansion.ts";

export const KA = 1.25;

export interface Region { x: number; y: number; w: number; h: number }

export const ATLAS = {
  w: ANCHO_HUECO + PROF * 2,
  h: ALTO_HAB + PROF,
  fondo: { x: 0, y: 0, w: ANCHO_HUECO, h: ALTO_HAB } as Region,
  izq: { x: ANCHO_HUECO, y: 0, w: PROF, h: ALTO_HAB } as Region,
  der: { x: ANCHO_HUECO + PROF, y: 0, w: PROF, h: ALTO_HAB } as Region,
  suelo: { x: 0, y: ALTO_HAB, w: ANCHO_HUECO, h: PROF } as Region,
  techo: { x: ANCHO_HUECO, y: ALTO_HAB, w: ANCHO_HUECO, h: PROF } as Region,
};

export function atlasCaras(t: TemaHab): HTMLCanvasElement {
  const [cv, c] = lienzo(ATLAS.w * KA, ATLAS.h * KA);
  c.scale(KA, KA);
  const r = azar(t.id.length * 17 + 3);

  const enRegion = (rc: Region, dibujar: () => void): void => {
    c.save(); c.beginPath(); c.rect(rc.x, rc.y, rc.w, rc.h); c.clip();
    dibujar();
    c.lineWidth = 8; c.strokeStyle = TINTA; c.strokeRect(rc.x + 4, rc.y + 4, rc.w - 8, rc.h - 8);
    c.restore();
  };

  const pared = (rc: Region): void => {
    const plano = patronPlano(t, rc.w * 1.25, rc.h * 1.25, 1);
    c.drawImage(plano, 0, 0, plano.width, plano.height, rc.x, rc.y, rc.w, rc.h);
    const y0 = rc.y + rc.h * 0.8;
    c.fillStyle = t.zocalo; c.fillRect(rc.x, y0, rc.w, rc.h * 0.2);
    c.lineWidth = 5; c.strokeStyle = TINTA; c.beginPath(); c.moveTo(rc.x, y0); c.lineTo(rc.x + rc.w, y0); c.stroke();
  };

  // pared del fondo, con la estanteria verde
  enRegion(ATLAS.fondo, () => {
    const rc = ATLAS.fondo;
    pared(rc);
    c.save(); c.translate(rc.x + 170, rc.y + 58); c.scale(0.78, 0.78);
    poligono(c, [[0, 90], [240, 90], [240, 110], [0, 110]], "#3a7a52", 5);
    poligono(c, [[-8, -20], [248, -20], [248, 90], [-8, 90]], "#4f9a6a", 5);
    for (const [bx, col, hh] of [[140, "#c9526a", 76], [170, "#e8a468", 66], [198, "#7a8ad0", 72]] as const) poligono(c, [[bx, 90 - hh], [bx + 24, 90 - hh], [bx + 24, 90], [bx, 90]], col, 4);
    for (const bx of [20, 78]) {
      poligono(c, [[bx, 54], [bx + 36, 54], [bx + 30, 90], [bx + 6, 90]], "#fff6e5", 4);
      for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(bx + 18 + (k - 1.5) * 8, 38 - (k % 2) * 10, 8, 22, (k - 1.5) * 0.3, 0, Math.PI * 2); c.fillStyle = k % 2 ? "#4fdc7a" : "#7a4cff"; c.fill(); c.lineWidth = 3; c.stroke(); }
    }
    c.restore();
  });

  // pared izquierda (s=0 junto al fondo, s=1 junto al hueco), con un cuadro
  enRegion(ATLAS.izq, () => {
    const rc = ATLAS.izq;
    pared(rc);
    poligono(c, [[rc.x + rc.w * 0.34, rc.y + 50], [rc.x + rc.w * 0.66, rc.y + 50], [rc.x + rc.w * 0.66, rc.y + 150], [rc.x + rc.w * 0.34, rc.y + 150]], "#fff6e5", 6);
    poligono(c, [[rc.x + rc.w * 0.38, rc.y + 64], [rc.x + rc.w * 0.62, rc.y + 64], [rc.x + rc.w * 0.62, rc.y + 136], [rc.x + rc.w * 0.38, rc.y + 136]], t.detalle, 4);
  });

  // pared derecha (s=0 junto al hueco, s=1 junto al fondo), con una ventana de celosia
  enRegion(ATLAS.der, () => {
    const rc = ATLAS.der;
    pared(rc);
    const x0 = rc.x + rc.w * 0.22, x1 = rc.x + rc.w * 0.78, y0 = rc.y + 44, y1 = rc.y + 176;
    poligono(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], "#fff6e5", 6);
    c.strokeStyle = TINTA; c.lineWidth = 4;
    for (let i = 1; i < 5; i++) { const x = x0 + ((x1 - x0) * i) / 5; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
    for (let j = 1; j < 4; j++) { const y = y0 + ((y1 - y0) * j) / 4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
  });

  // suelo de tablas con alfombra (v=0 junto al fondo, v=1 junto al hueco)
  enRegion(ATLAS.suelo, () => {
    const rc = ATLAS.suelo;
    c.fillStyle = t.suelo[0]; c.fillRect(rc.x, rc.y, rc.w, rc.h);
    c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 3;
    for (let i = 1; i < 14; i++) { const x = rc.x + (rc.w * i) / 14; c.beginPath(); c.moveTo(x, rc.y); c.lineTo(x, rc.y + rc.h); c.stroke(); }
    for (let i = 0; i < 14; i++) { const x = rc.x + (rc.w * i) / 14; for (let y = rc.y + ((i * 53) % 90); y < rc.y + rc.h; y += 90) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + rc.w / 14, y); c.stroke(); } }
    const ax = rc.x + rc.w * 0.2, ay = rc.y + rc.h * 0.22, aw = rc.w * 0.6, ah = rc.h * 0.58;
    rr(c, ax, ay, aw, ah, 10, t.suelo[1], 0);
    c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(ax + 24, ay + 24, aw - 48, ah - 48);
    c.lineWidth = 6; c.strokeStyle = t.detalle; c.strokeRect(ax, ay, aw, ah);
  });

  // techo con las luces de carril
  enRegion(ATLAS.techo, () => {
    const rc = ATLAS.techo;
    c.fillStyle = t.techo; c.fillRect(rc.x, rc.y, rc.w, rc.h);
    c.strokeStyle = "rgba(255,255,255,0.06)"; c.lineWidth = 4;
    for (let y = rc.y + 70; y < rc.y + rc.h; y += 90) { c.beginPath(); c.moveTo(rc.x, y); c.lineTo(rc.x + rc.w, y); c.stroke(); }
    const bx = rc.x + rc.w / 2 - 12;
    rr(c, bx, rc.y + 40, 24, rc.h - 80, 6, "#2a2438", 4);
    for (let i = 0; i < 4; i++) {
      const y = rc.y + 110 + i * 100;
      const g = c.createRadialGradient(bx + 12, y, 2, bx + 12, y, 30);
      g.addColorStop(0, "rgba(255,240,170,0.95)"); g.addColorStop(1, "rgba(255,240,170,0)");
      c.fillStyle = g; c.beginPath(); c.arc(bx + 12, y, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(bx + 12, y, 8, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 6; i++) sparkle(c, rc.x + r() * rc.w, rc.y + r() * rc.h, 5 + r() * 5, "rgba(255,226,120,0.35)");
  });

  return cv;
}
