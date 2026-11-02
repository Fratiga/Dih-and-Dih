/* Muñecos provisionales de los personajes.
   Todavia no hay arte chibi definitivo, asi que cada personaje es un muñeco blando del color de su ficha y del gorro de su afinidad.
   A proposito NO tienen el pelo, la piel ni los rasgos de nadie: el aspecto de cada personaje lo pone el arte real.
   Cuando exista, se deja en assets/pitter/chibis/<id>.png y este archivo deja de usarse para ese personaje (ver cargarArteReal). */

import { AFINIDADES, type Afinidad, type Personaje } from "../datos/roster.ts";

export type Expresion = "idle" | "blink" | "feliz" | "dolor" | "poder";
export const EXPRESIONES: Expresion[] = ["idle", "blink", "feliz", "dolor", "poder"];
export const ANCHO_CHIBI = 256;
export const ALTO_CHIBI = 320;
export const LADO_FICHA = 160;

const TINTA = "#2a1545";

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb(r: number, g: number, b: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function mezcla(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return rgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
const oscuro = (c: string, t = 0.35): string => mezcla(c, "#2a1545", t);
const claro = (c: string, t = 0.5): string => mezcla(c, "#ffffff", t);

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.lineJoin = "round";
  c.lineCap = "round";
  return [cv, c];
}

function relleno(c: CanvasRenderingContext2D, color: string, grosor = 7): void {
  c.fillStyle = color;
  c.fill();
  c.lineWidth = grosor;
  c.strokeStyle = TINTA;
  c.stroke();
}
function elipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, grosor = 7, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  relleno(c, color, grosor);
}
function brillo(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.55, rot = -0.5): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.fill();
}
function estrella(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, grosor = 5): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.46;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  relleno(c, color, grosor);
}

/* Iconos de afinidad, dibujados en un cuadro de 100x100 centrado en (0,0). */
export function iconoAfinidad(c: CanvasRenderingContext2D, a: Afinidad, x: number, y: number, tam: number, color = "#fff", grosor = 6): void {
  c.save();
  c.translate(x, y);
  c.scale(tam / 100, tam / 100);
  c.lineWidth = grosor * (100 / tam);
  c.strokeStyle = TINTA;
  c.fillStyle = color;
  c.beginPath();
  switch (a) {
    case "juramento":
      c.moveTo(-34, -38); c.lineTo(34, -38); c.lineTo(34, 4); c.quadraticCurveTo(34, 34, 0, 46); c.quadraticCurveTo(-34, 34, -34, 4); c.closePath();
      break;
    case "sombra":
      c.arc(0, 0, 36, 0.55, Math.PI * 2 - 0.55, false); c.arc(14, 0, 28, Math.PI * 2 - 0.9, 0.9, true); c.closePath();
      break;
    case "carne":
      c.moveTo(0, -42); c.quadraticCurveTo(40, 4, 28, 28); c.quadraticCurveTo(0, 50, -28, 28); c.quadraticCurveTo(-40, 4, 0, -42); c.closePath();
      break;
    case "arcano":
      for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 === 0 ? 44 : 20; c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
      c.closePath();
      break;
    case "eternidad":
      c.arc(0, 0, 32, 0, Math.PI * 2); c.moveTo(14, 0); c.arc(0, 0, 14, 0, Math.PI * 2, true);
      break;
    case "caceria":
      c.moveTo(0, -44); c.lineTo(30, -6); c.lineTo(10, -6); c.lineTo(10, 40); c.lineTo(-10, 40); c.lineTo(-10, -6); c.lineTo(-30, -6); c.closePath();
      break;
  }
  c.fill("evenodd");
  c.stroke();
  c.restore();
}

/* La cabeza es lo que se reutiliza: el muñeco entero, la ficha del tablero y el retrato de la coleccion. */
export function dibujarCabeza(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, p: Pick<Personaje, "color" | "afinidad" | "id">, expr: Expresion): void {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  const base = claro(p.color, 0.8);
  const gorro = oscuro(p.color, 0.18);
  const acento = claro(p.color, 0.35);
  const a = p.afinidad;

  // Por detras de la cabeza
  if (a === "sombra") {
    c.beginPath(); c.moveTo(-96, 20); c.quadraticCurveTo(-110, -70, 0, -128); c.quadraticCurveTo(110, -70, 96, 20); c.closePath();
    relleno(c, gorro);
  } else if (a === "arcano") {
    // ala del sombrero
    c.beginPath(); c.ellipse(0, -52, 118, 20, -0.06, 0, Math.PI * 2); relleno(c, gorro);
  } else if (a === "eternidad") {
    c.beginPath(); c.ellipse(0, -112, 56, 16, 0, 0, Math.PI * 2); c.lineWidth = 15; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 8; c.strokeStyle = "#fff6b8"; c.stroke();
  }

  // Cabeza
  c.beginPath();
  c.ellipse(0, 0, 96, 88, 0, 0, Math.PI * 2);
  relleno(c, base, 8);
  brillo(c, -44, -48, 26, 12, 0.7);

  // Gorro o adorno por afinidad
  if (a === "juramento") {
    c.beginPath(); c.moveTo(-92, -8); c.quadraticCurveTo(-92, -96, 0, -96); c.quadraticCurveTo(92, -96, 92, -8); c.quadraticCurveTo(0, -38, -92, -8); c.closePath();
    relleno(c, gorro, 8);
    brillo(c, -42, -68, 24, 9, 0.5);
    c.beginPath(); c.moveTo(0, -94); c.quadraticCurveTo(40, -150, 78, -120); c.quadraticCurveTo(52, -112, 40, -92); c.closePath(); relleno(c, "#ff4f6a", 6);
  } else if (a === "sombra") {
    c.beginPath(); c.moveTo(-92, -4); c.quadraticCurveTo(-96, -96, 0, -112); c.quadraticCurveTo(96, -96, 92, -4); c.quadraticCurveTo(70, -52, 0, -50); c.quadraticCurveTo(-70, -52, -92, -4); c.closePath();
    relleno(c, gorro, 8);
    brillo(c, -46, -76, 22, 8, 0.4);
  } else if (a === "carne") {
    c.beginPath(); c.moveTo(-94, -26); c.quadraticCurveTo(0, -62, 94, -26); c.lineTo(90, -2); c.quadraticCurveTo(0, -38, -90, -2); c.closePath(); relleno(c, "#fff1f1", 7);
    c.lineWidth = 6; c.strokeStyle = "#ff4f6a"; c.beginPath(); c.moveTo(-18, -50); c.lineTo(18, -22); c.moveTo(18, -50); c.lineTo(-18, -22); c.stroke();
  } else if (a === "arcano") {
    c.beginPath(); c.moveTo(-70, -54); c.quadraticCurveTo(-40, -96, 10, -170); c.quadraticCurveTo(26, -100, 70, -54); c.closePath();
    relleno(c, gorro, 8);
    estrella(c, 8, -108, 17, "#ffe36b", 5);
  } else if (a === "caceria") {
    c.beginPath(); c.moveTo(-94, -30); c.quadraticCurveTo(0, -70, 94, -30); c.lineTo(90, -8); c.quadraticCurveTo(0, -48, -90, -8); c.closePath(); relleno(c, gorro, 7);
    c.beginPath(); c.moveTo(70, -34); c.quadraticCurveTo(120, -96, 116, -150); c.quadraticCurveTo(84, -108, 60, -60); c.closePath(); relleno(c, acento, 6);
  } else if (a === "eternidad") {
    c.beginPath(); c.moveTo(-60, -76); c.quadraticCurveTo(0, -108, 60, -76); c.quadraticCurveTo(0, -62, -60, -76); c.closePath(); relleno(c, acento, 6);
  }

  // Mejillas
  c.fillStyle = "rgba(255,110,150,0.55)";
  c.beginPath(); c.ellipse(-62, 30, 17, 11, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(62, 30, 17, 11, 0, 0, Math.PI * 2); c.fill();

  // Ojos y boca segun la expresion
  c.strokeStyle = TINTA;
  c.fillStyle = TINTA;
  c.lineWidth = 9;
  const ojo = (x: number) => {
    if (expr === "idle" || expr === "poder") {
      c.beginPath(); c.ellipse(x, 6, 15, 23, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x - 5, -4, 7, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x + 5, 16, 3.6, 0, Math.PI * 2); c.fill(); c.fillStyle = TINTA;
      if (expr === "poder") { estrella(c, x, 6, 14, "#fff6b8", 3); }
    } else if (expr === "blink") {
      c.beginPath(); c.moveTo(x - 15, 8); c.quadraticCurveTo(x, 20, x + 15, 8); c.stroke();
    } else if (expr === "feliz") {
      c.beginPath(); c.moveTo(x - 16, 14); c.quadraticCurveTo(x, -10, x + 16, 14); c.stroke();
    } else {
      c.beginPath(); c.moveTo(x - 15, -6); c.lineTo(x + 15, 6); c.lineTo(x - 15, 18); c.stroke();
    }
  };
  ojo(-38);
  if (expr === "dolor") { c.beginPath(); c.moveTo(53, -6); c.lineTo(23, 6); c.lineTo(53, 18); c.stroke(); } else ojo(38);
  c.fillStyle = TINTA;
  if (expr === "idle" || expr === "blink") {
    c.beginPath(); c.moveTo(-14, 46); c.quadraticCurveTo(0, 58, 14, 46); c.lineWidth = 7; c.stroke();
  } else if (expr === "feliz" || expr === "poder") {
    c.beginPath(); c.moveTo(-26, 42); c.quadraticCurveTo(0, 86, 26, 42); c.closePath(); relleno(c, "#7a1f45", 6);
    c.fillStyle = "#ff8aa8"; c.beginPath(); c.ellipse(0, 62, 11, 7, 0, 0, Math.PI * 2); c.fill();
  } else {
    c.lineWidth = 7; c.beginPath(); c.moveTo(-20, 56); c.quadraticCurveTo(-10, 44, 0, 56); c.quadraticCurveTo(10, 68, 20, 56); c.stroke();
  }
  c.restore();
}

export function dibujarChibi(c: CanvasRenderingContext2D, p: Personaje, expr: Expresion): void {
  const color = p.color;
  const ropa = color;
  const ropa2 = oscuro(color, 0.22);
  const piel = claro(color, 0.8);

  // sombra en el suelo
  c.fillStyle = "rgba(42,21,69,0.28)";
  c.beginPath(); c.ellipse(128, 304, 78, 13, 0, 0, Math.PI * 2); c.fill();

  // capa o cola por detras
  if (p.afinidad === "juramento") {
    c.beginPath(); c.moveTo(70, 190); c.quadraticCurveTo(46, 260, 62, 292); c.lineTo(194, 292); c.quadraticCurveTo(210, 260, 186, 190); c.closePath(); relleno(c, "#ff4f6a", 7);
  } else if (p.afinidad === "sombra" || p.afinidad === "eternidad") {
    c.beginPath(); c.moveTo(74, 190); c.quadraticCurveTo(56, 262, 80, 294); c.lineTo(176, 294); c.quadraticCurveTo(200, 262, 182, 190); c.closePath(); relleno(c, oscuro(color, 0.5), 7);
  }

  // pies
  elipse(c, 98, 290, 28, 16, ropa2, 7);
  elipse(c, 158, 290, 28, 16, ropa2, 7);
  // cuerpo
  c.beginPath(); c.moveTo(78, 214); c.quadraticCurveTo(70, 280, 98, 284); c.lineTo(158, 284); c.quadraticCurveTo(186, 280, 178, 214); c.quadraticCurveTo(128, 196, 78, 214); c.closePath();
  relleno(c, ropa, 8);
  brillo(c, 98, 232, 12, 24, 0.4, 0.2);
  // brazos
  elipse(c, 66, 246, 15, 24, piel, 7, 0.35);
  elipse(c, 190, 246, 15, 24, piel, 7, -0.35);
  // emblema de la afinidad en el pecho
  iconoAfinidad(c, p.afinidad, 128, 246, 40, "#fff6e5", 5);
  // bufanda o cinturon
  if (p.afinidad === "sombra" || p.afinidad === "caceria") {
    c.beginPath(); c.moveTo(82, 208); c.quadraticCurveTo(128, 232, 174, 208); c.lineTo(170, 224); c.quadraticCurveTo(128, 246, 86, 224); c.closePath(); relleno(c, claro(color, 0.3), 6);
  }

  // cabeza grande
  dibujarCabeza(c, 128, 124, 1, p, expr);
}

/* La ficha del tablero: un cuadrado redondeado del color del personaje con su cabeza dentro. */
export function dibujarFicha(c: CanvasRenderingContext2D, p: Personaje, expr: Expresion = "idle"): void {
  const L = LADO_FICHA;
  c.clearRect(0, 0, L, L);
  c.beginPath();
  c.roundRect(7, 7, L - 14, L - 14, 34);
  c.fillStyle = p.color;
  c.fill();
  c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
  // fondo con rayas suaves y brillo
  c.save();
  c.beginPath(); c.roundRect(11, 11, L - 22, L - 22, 30); c.clip();
  c.fillStyle = "rgba(255,255,255,0.14)";
  for (let i = -L; i < L * 2; i += 30) { c.beginPath(); c.moveTo(i, L); c.lineTo(i + 14, L); c.lineTo(i + 14 + L, 0); c.lineTo(i + L, 0); c.closePath(); c.fill(); }
  const g = c.createLinearGradient(0, 0, 0, L);
  g.addColorStop(0, "rgba(255,255,255,0.35)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(42,21,69,0.25)");
  c.fillStyle = g; c.fillRect(0, 0, L, L);
  c.restore();
  dibujarCabeza(c, L / 2, L / 2 + 8, 0.6, p, expr);
  // insignia de afinidad
  c.beginPath(); c.arc(L - 30, L - 30, 19, 0, Math.PI * 2); c.fillStyle = AFINIDADES[p.afinidad].color; c.fill(); c.lineWidth = 5; c.strokeStyle = TINTA; c.stroke();
  iconoAfinidad(c, p.afinidad, L - 30, L - 30, 21, "#fff", 4);
}

export function fichaBloque(c: CanvasRenderingContext2D, golpes: 1 | 2 | 3): void {
  const L = LADO_FICHA;
  c.clearRect(0, 0, L, L);
  c.beginPath(); c.roundRect(7, 7, L - 14, L - 14, 26); c.fillStyle = "#8d86a8"; c.fill(); c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
  c.fillStyle = "#aaa4c4"; c.beginPath(); c.roundRect(16, 14, L - 40, 30, 12); c.fill();
  c.strokeStyle = TINTA; c.lineWidth = 6;
  c.beginPath(); c.moveTo(40, 52); c.lineTo(72, 84); c.lineTo(56, 118); c.moveTo(110, 40); c.lineTo(96, 76); c.lineTo(124, 108); c.stroke();
  if (golpes > 1) { c.beginPath(); c.moveTo(24, 100); c.lineTo(52, 126); c.moveTo(130, 60); c.lineTo(120, 38); c.stroke(); }
  c.fillStyle = TINTA; c.font = `900 38px "Lilita One", sans-serif`; c.textAlign = "center"; c.fillText(String(golpes), L / 2, 100);
}

export function fichaCaja(c: CanvasRenderingContext2D): void {
  const L = LADO_FICHA;
  c.clearRect(0, 0, L, L);
  c.beginPath(); c.roundRect(7, 7, L - 14, L - 14, 26); c.fillStyle = "#ffd23f"; c.fill(); c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
  c.fillStyle = "#ff4f9a"; c.fillRect(L / 2 - 14, 10, 28, L - 20);
  c.fillRect(10, L / 2 - 14, L - 20, 28);
  c.strokeStyle = TINTA; c.lineWidth = 6; c.strokeRect(L / 2 - 14, 10, 28, L - 20); c.strokeRect(10, L / 2 - 14, L - 20, 28);
  estrella(c, L / 2, L / 2, 22, "#fff6b8", 5);
}

export function efectoHielo(c: CanvasRenderingContext2D): void {
  const L = LADO_FICHA;
  c.clearRect(0, 0, L, L);
  c.beginPath(); c.roundRect(7, 7, L - 14, L - 14, 30); c.fillStyle = "rgba(150,225,255,0.55)"; c.fill(); c.lineWidth = 7; c.strokeStyle = "#e8fbff"; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 5; c.beginPath(); c.moveTo(34, 40); c.lineTo(70, 60); c.lineTo(60, 100); c.moveTo(120, 30); c.lineTo(100, 70); c.stroke();
}

export function efectoTinta(c: CanvasRenderingContext2D): void {
  const L = LADO_FICHA;
  c.clearRect(0, 0, L, L);
  c.beginPath(); c.roundRect(7, 7, L - 14, L - 14, 30); c.fillStyle = "#3a2a5a"; c.fill(); c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
  c.fillStyle = "#6a52a0"; c.font = `900 84px "Lilita One", sans-serif`; c.textAlign = "center"; c.fillText("?", L / 2, L / 2 + 30);
}

export interface ArteChibi {
  chibi: Map<string, Record<Expresion, HTMLCanvasElement>>;
  ficha: Map<string, HTMLCanvasElement>;
  retrato: Map<string, HTMLCanvasElement>;
  especiales: Record<string, HTMLCanvasElement>;
  jefes: Map<string, HTMLCanvasElement>;
}

export function crearArte(personajes: Personaje[]): ArteChibi {
  const arte: ArteChibi = { chibi: new Map(), ficha: new Map(), retrato: new Map(), especiales: {}, jefes: new Map() };
  for (const p of personajes) {
    const e = {} as Record<Expresion, HTMLCanvasElement>;
    for (const x of EXPRESIONES) {
      const [cv, c] = lienzo(ANCHO_CHIBI, ALTO_CHIBI);
      dibujarChibi(c, p, x);
      e[x] = cv;
    }
    arte.chibi.set(p.id, e);
    const [fv, fc] = lienzo(LADO_FICHA, LADO_FICHA);
    dibujarFicha(fc, p);
    arte.ficha.set(p.id, fv);
    const [rv, rc] = lienzo(256, 256);
    dibujarCabeza(rc, 128, 142, 1.08, p, "idle");
    arte.retrato.set(p.id, rv);
  }
  for (const k of [1, 2, 3] as const) { const [cv, c] = lienzo(LADO_FICHA, LADO_FICHA); fichaBloque(c, k); arte.especiales[`bloque${k}`] = cv; }
  { const [cv, c] = lienzo(LADO_FICHA, LADO_FICHA); fichaCaja(c); arte.especiales.caja = cv; }
  { const [cv, c] = lienzo(LADO_FICHA, LADO_FICHA); efectoHielo(c); arte.especiales.hielo = cv; }
  { const [cv, c] = lienzo(LADO_FICHA, LADO_FICHA); efectoTinta(c); arte.especiales.tinta = cv; }
  return arte;
}

export const arteGlobal: { v: ArteChibi | null } = { v: null };
