/* Dibujo y animacion de la criatura, todo en codigo. Es una criatura de laboratorio: piel palida y translucida, extremidades largas y finas,
   manos de dedos largos y un cuerpo blando con ojos grandes. Lo tierno y lo inquietante a la vez.
   La animacion no esta fijada a las acciones: la conducta decide que esta haciendo y aqui se traduce en una postura (agachada, cabeza baja,
   orejas, ojos, cola...) que se mezcla con suavidad con la anterior, asi un paso, un olfateo y un susto pueden ocurrir a la vez. */

import type { Criatura } from "../nucleo/criatura.ts";
import { cuerpoDe, type Genoma } from "../nucleo/genoma.ts";
import { E, N } from "../nucleo/tipos.ts";
import { Azar } from "../nucleo/azar.ts";
import { ESCALA } from "./medidas.ts";

export interface Pose {
  agacha: number;
  cabezaBaja: number;
  orejas: number;
  ojos: number;
  boca: number;
  tembl: number;
  alcance: number;
  colaAmp: number;
  colaVel: number;
  inclina: number;
  dormido: number;
  sonrisa: number;
  /** 0 pupila pequena, 1 muy abierta (curiosidad). */
  pupila: number;
}

export interface Vista {
  pose: Pose;
  dir: number;
  fase: number;
  t: number;
  parpadeo: number;
  proxParpadeo: number;
  golpe: number;
  mira: [number, number];
  azar: Azar;
  vel: number;
  ultimaVida: number;
  ultDano: number;
  /** Color de la lucecita del collar: azul asustado, rojo frustrado, verde contento, ambar curioso. */
  animo: string;
}

export const lienzoCriatura = { w: 700, h: 600, ox: 320, oy: 530, res: 1.1 };

export function nuevaVista(semilla: number): Vista {
  return {
    pose: { agacha: 0, cabezaBaja: 0.1, orejas: 0.6, ojos: 1, boca: 0, tembl: 0, alcance: 0, colaAmp: 0.3, colaVel: 2, inclina: 0, dormido: 0, sonrisa: 0, pupila: 0.4 },
    dir: 1,
    fase: 0,
    t: 0,
    parpadeo: 0,
    proxParpadeo: 2,
    golpe: 0,
    mira: [0, 0],
    azar: new Azar(semilla),
    vel: 0,
    ultimaVida: 0,
    ultDano: -99,
    animo: "#46d9e8",
  };
}

const acota = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

/** Calcula la postura que la criatura "quiere" tener ahora y la acerca a la actual. */
export function actualizarVista(v: Vista, c: Criatura, dt: number, mira: [number, number] | null): void {
  v.t += dt;
  const e = c.emo;
  const miedo = e[E.miedo], exc = e[E.excitacion], frus = e[E.frustracion], cur = e[E.curiosidad], ape = e[E.apego];
  const a = c.accion;
  const tAcc = a ? c.t - a.tf : 0;
  const hacer = !!a && a.fase === "hacer";
  const vel = Math.abs(c.vx) * ESCALA;
  v.vel += (vel - v.vel) * (1 - Math.exp(-dt * 8));

  const obj: Pose = {
    agacha: miedo * 0.45,
    cabezaBaja: 0.1,
    orejas: acota(0.55 + 0.35 * cur + 0.25 * exc - 1.0 * miedo - 0.35 * frus, -1, 1),
    ojos: 1 - c.nec[N.sueno] * 0.35,
    boca: 0,
    tembl: miedo > 0.45 ? (miedo - 0.45) * 1.8 : 0,
    alcance: 0,
    colaAmp: acota(0.25 + 0.4 * exc + 0.2 * ape - 0.3 * miedo, 0.05, 0.8),
    colaVel: 2 + 9 * exc,
    inclina: 0,
    dormido: 0,
    sonrisa: acota(exc * 0.8 + (1 - c.nec[N.hambre]) * 0.1 - miedo),
    pupila: acota(0.35 + 0.6 * cur - 0.6 * miedo + 0.2 * exc),
  };
  if (v.vel > 90) obj.inclina = 0.12 + Math.min(0.1, (v.vel - 90) / 800);
  if (c.nec[N.dolor] > 0.2) { obj.ojos = Math.min(obj.ojos, 0.7); obj.agacha += c.nec[N.dolor] * 0.25; }
  if (miedo > 0.4) obj.ojos = 1.15;

  if (c.dormido && a?.v === "dormir") {
    obj.dormido = 1; obj.agacha = 1; obj.ojos = 0; obj.cabezaBaja = 0.2; obj.orejas = -0.4; obj.colaAmp = 0.05; obj.colaVel = 0.6;
  } else if (a) {
    switch (a.v) {
      case "probar":
        if (hacer) { obj.cabezaBaja = 1; obj.agacha += 0.15; if (tAcc > 0.4) obj.boca = 0.55 + 0.45 * Math.sin(v.t * 15); }
        else obj.cabezaBaja = 0.3;
        break;
      case "empujar":
        if (hacer) { const p = Math.max(0, Math.sin(Math.min(1, tAcc / 0.8) * Math.PI)); obj.alcance = p; obj.inclina += 0.12 * p; obj.cabezaBaja = 0.4; }
        break;
      case "tocar":
        if (hacer) { obj.alcance = 0.7 * Math.max(0, Math.sin(Math.min(1, tAcc / 0.9) * Math.PI)); obj.cabezaBaja = 0.35; }
        break;
      case "explorar":
        obj.cabezaBaja = hacer ? 0.85 + 0.1 * Math.sin(v.t * 9) : 0.4 + 0.1 * Math.sin(v.t * 3);
        obj.orejas = Math.max(obj.orejas, 0.75);
        break;
      case "descansar":
        obj.agacha += 0.55; obj.ojos = Math.min(obj.ojos, 0.55); obj.cabezaBaja = 0.35; obj.colaAmp *= 0.5;
        break;
      case "acercarse":
        obj.orejas = Math.max(obj.orejas, 0.8); obj.cabezaBaja = 0.05;
        break;
      case "evitar":
        obj.agacha += 0.25; obj.orejas = -0.8;
        break;
    }
  }
  obj.agacha = acota(obj.agacha);

  const k = (rapido: number) => 1 - Math.exp(-dt * rapido);
  const p = v.pose;
  p.agacha += (obj.agacha - p.agacha) * k(5);
  p.cabezaBaja += (obj.cabezaBaja - p.cabezaBaja) * k(7);
  p.orejas += (obj.orejas - p.orejas) * k(6);
  p.ojos += (obj.ojos - p.ojos) * k(10);
  p.boca += (obj.boca - p.boca) * k(20);
  p.tembl += (obj.tembl - p.tembl) * k(8);
  p.alcance += (obj.alcance - p.alcance) * k(16);
  p.colaAmp += (obj.colaAmp - p.colaAmp) * k(3);
  p.colaVel += (obj.colaVel - p.colaVel) * k(3);
  p.inclina += (obj.inclina - p.inclina) * k(5);
  p.dormido += (obj.dormido - p.dormido) * k(3);
  p.sonrisa += (obj.sonrisa - p.sonrisa) * k(4);
  p.pupila += (obj.pupila - p.pupila) * k(5);
  v.animo = miedo > 0.4 ? "#5aa8ff" : frus > 0.4 ? "#ff6a5c" : exc > 0.45 ? "#7cf08a" : cur > 0.5 ? "#ffb35c" : "#46d9e8";

  // Mirada y giro
  v.dir += (c.dir - v.dir) * k(9);
  if (mira) { v.mira[0] += (mira[0] - v.mira[0]) * k(8); v.mira[1] += (mira[1] - v.mira[1]) * k(8); } else { v.mira[0] *= 1 - k(4); v.mira[1] *= 1 - k(4); }
  // Parpadeo
  v.proxParpadeo -= dt;
  if (v.proxParpadeo <= 0 && v.parpadeo <= 0) { v.parpadeo = 0.001; v.proxParpadeo = 2 + v.azar.next() * 4; }
  if (v.parpadeo > 0) { v.parpadeo += dt * 7; if (v.parpadeo >= 1) v.parpadeo = 0; }
  // Golpe (sobresalto): se detecta cuando acaba de hacerse dano
  if (c.ultimoDano !== v.ultDano) { v.ultDano = c.ultimoDano; v.golpe = 1; }
  v.golpe *= Math.exp(-dt * 5);
  // Fase del paso: avanza segun lo que se recorre
  const paso = pasoDe(v.vel);
  if (v.vel > 4) v.fase += (Math.PI * v.vel * dt) / (2 * paso);
}

const pasoDe = (vel: number): number => acota(20 + vel * 0.14, 20, 58);

/* ---------------- Dibujo ---------------- */

function ik(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, lado: number): [number, number] {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < 0.001) d = 0.001;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + (a * dx) / d, my = ay + (a * dy) / d;
  return [mx - (dy / d) * h * lado, my + (dx / d) * h * lado];
}

interface Colores {
  piel: string;
  pielClara: string;
  pielOsc: string;
  lejos: string;
  linea: string;
  luz: string;
  luz2: string;
  collar: string;
}

function colores(g: Genoma, huella: number): Colores {
  const h = g.cuerpo.tono;
  return {
    piel: `hsl(${h}, 24%, 74%)`,
    pielClara: `hsl(${h}, 20%, 86%)`,
    pielOsc: `hsl(${h}, 26%, 58%)`,
    lejos: `hsl(${h}, 24%, 44%)`,
    linea: `hsl(${h}, 40%, 12%)`,
    luz: `hsl(${(h + 150) % 360}, 90%, 72%)`,
    luz2: `hsl(${h - 10}, 95%, 70%)`,
    collar: `hsl(${Math.round(huella * 360)}, 68%, 58%)`,
  };
}

/** Una pata o brazo con la forma de una curva que se afina hacia el final (no dos palos). */
function miembro(c: CanvasRenderingContext2D, pts: [number, number][], anchos: number[], relleno: string, linea: string): void {
  const [a, k, f] = pts;
  const puntos: [number, number, number][] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = 2 * k[0] - (a[0] + f[0]) / 2;
    const cy = 2 * k[1] - (a[1] + f[1]) / 2;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * f[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * f[1];
    // Mas gruesa arriba, con una rodilla redondeada y fina al final
    const w = anchos[0] * (1 - t) + anchos[1] * t + Math.sin(t * Math.PI) * 4;
    puntos.push([x, y, w]);
  }
  for (const pasada of [0, 1]) {
    c.fillStyle = pasada === 0 ? linea : relleno;
    for (const [x, y, w] of puntos) { c.beginPath(); c.arc(x, y, w / 2 + (pasada === 0 ? 2.6 : 0), 0, Math.PI * 2); c.fill(); }
  }
}

/** Una zarpa blanda: tres deditos cortos y redondeados con una almohadilla, en vez de dedos largos. */
function mano(c: CanvasRenderingContext2D, x: number, y: number, dir: number, largo: number, col: Colores, rizo: number): void {
  c.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const a = dir + i * 0.4 + rizo * 0.2;
    const ex = x + Math.cos(a) * largo * (i === 0 ? 1 : 0.85);
    const ey = y + Math.sin(a) * largo * (i === 0 ? 1 : 0.85) + 2;
    c.strokeStyle = col.linea; c.lineWidth = 13; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = col.pielOsc; c.lineWidth = 8.5; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  }
  c.fillStyle = col.pielOsc; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
}

/** Una oreja blanda: sale de la nuca hacia arriba y atras y se dobla hacia abajo por la punta, sin cruzar la cara. Con atencion se levanta
    y con miedo se pega hacia atras. */
function oreja(c: CanvasRenderingContext2D, bx: number, by: number, atencion: number, largo: number, col: Colores, t: number, fase: number, lejos: boolean): void {
  // atencion: -1 pegada hacia atras, 0 en reposo, 1 alzada. Los angulos van en sentido de canvas (pi es "hacia atras", 1.5 pi "hacia arriba")
  const a0 = Math.PI * (1.2 + 0.14 * atencion) + Math.sin(t * 1.6 + fase) * 0.05;
  const doblez = 1.15 - 0.45 * (atencion + 1) / 2;
  const a1 = a0 - doblez;
  const mx = bx + Math.cos(a0) * largo * 0.5, my = by + Math.sin(a0) * largo * 0.5;
  const tx = mx + Math.cos(a1) * largo * 0.5, ty = my + Math.sin(a1) * largo * 0.5;
  const ancho = largo * 0.22;
  const nx = -Math.sin(a0), ny = Math.cos(a0);
  const hoja = (esc: number): void => {
    c.beginPath();
    c.moveTo(bx + nx * ancho * 0.45 * esc, by + ny * ancho * 0.45 * esc);
    c.quadraticCurveTo(mx + nx * ancho * esc, my + ny * ancho * esc, tx, ty);
    c.quadraticCurveTo(mx - nx * ancho * esc, my - ny * ancho * esc, bx - nx * ancho * 0.45 * esc, by - ny * ancho * 0.45 * esc);
    c.closePath();
  };
  hoja(1); c.fillStyle = lejos ? col.lejos : col.pielOsc; c.fill(); c.strokeStyle = col.linea; c.lineWidth = 3; c.stroke();
  hoja(0.5); c.fillStyle = lejos ? col.piel : col.pielClara; c.globalAlpha = 0.7; c.fill(); c.globalAlpha = 1;
  c.fillStyle = col.luz; c.globalAlpha = 0.8; c.beginPath(); c.arc(tx, ty, 3.6, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
}

function ojo(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, abierto: number, mirada: [number, number], col: Colores, dilata: number): void {
  const h = Math.max(0.06, abierto);
  if (h <= 0.1) {
    c.strokeStyle = col.linea; c.lineWidth = 4; c.beginPath(); c.arc(x, y + 2, rx * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    return;
  }
  c.fillStyle = "#06121a"; c.beginPath(); c.ellipse(x, y, rx, ry * h, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col.linea; c.lineWidth = 2.5; c.stroke();
  // Iris luminoso y pupila que sigue lo que mira
  const px_ = x + mirada[0] * rx * 0.35, py_ = y + mirada[1] * ry * 0.3;
  c.fillStyle = col.luz; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(px_, py_, rx * 0.62, ry * h * 0.62, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  c.fillStyle = "#020608"; c.beginPath(); c.ellipse(px_, py_, rx * (0.16 + 0.34 * dilata), ry * h * (0.26 + 0.38 * dilata), 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.ellipse(x - rx * 0.28, y - ry * h * 0.3, rx * 0.2, ry * h * 0.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(x + rx * 0.3, y + ry * h * 0.3, rx * 0.08, 0, Math.PI * 2); c.fill();
}

/** El collar: una banda que rodea el cuello de lado a lado, perpendicular a su direccion, con la lucecita de animo en el centro. (px, py) es el centro
    del cuello en ese punto y (tx, ty) su direccion. `ancho` es el grosor del cuello. */
function collar(c: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number, ancho: number, col: Colores, animo: string): void {
  const l = Math.hypot(tx, ty) || 1;
  const dx = tx / l, dy = ty / l;
  const nx = -dy, ny = dx;
  const m = ancho / 2 + 2.5;
  // Cada lado se curva un poco hacia la cabeza, como una banda que da la vuelta al cuello
  const a: [number, number] = [px - nx * m, py - ny * m];
  const b: [number, number] = [px + nx * m, py + ny * m];
  const cx = px + dx * 5, cy = py + dy * 5;
  c.lineCap = "butt";
  c.strokeStyle = col.linea; c.lineWidth = 15; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx, cy, b[0], b[1]); c.stroke();
  c.strokeStyle = col.collar; c.lineWidth = 10; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx, cy, b[0], b[1]); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(a[0] - dx * 2.5, a[1] - dy * 2.5); c.quadraticCurveTo(cx - dx * 2.5, cy - dy * 2.5, b[0] - dx * 2.5, b[1] - dy * 2.5); c.stroke();
  c.lineCap = "round";
  const bx = px + dx * 2.5, by = py + dy * 2.5;
  c.fillStyle = animo; c.globalAlpha = 0.3; c.beginPath(); c.arc(bx, by, 14, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  c.fillStyle = animo; c.beginPath(); c.arc(bx, by, 6.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = col.linea; c.lineWidth = 2; c.stroke();
}

/** La cabeza con sus orejas y su collar. Se usa en el cuerpo entero y en el retrato. */
export function dibujarCabeza(c: CanvasRenderingContext2D, hx: number, hy: number, v: Vista, g: Genoma, col: Colores, inclina: number, escalaOjo = 1): void {
  const p = v.pose;
  c.save();
  const cu = cuerpoDe(g);
  c.translate(hx, hy);
  c.rotate(inclina);
  c.scale(cu.tamanoCabeza, cu.tamanoCabeza);
  // Orejas caidas: la de atras mas oscura (la cercana se dibuja despues, por delante del craneo)
  const aten = p.orejas * (0.6 + 0.4 * cu.caidaOrejas) - (1 - cu.caidaOrejas) * 0.3;
  const lo = 66 + g.cuerpo.orejas * 34;
  oreja(c, -34, -26, aten - 0.15, lo * 0.9, col, v.t, 1.3, true);
  // Craneo y hocico
  const gr = c.createRadialGradient(-12, -14, 6, 0, 0, 62);
  gr.addColorStop(0, col.pielClara); gr.addColorStop(1, col.piel);
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(-44, 0); c.bezierCurveTo(-46, -46, 8, -58, 38, -30); c.bezierCurveTo(70, -20, 78, 12, 52, 28); c.bezierCurveTo(30, 44, -40, 44, -44, 0); c.fill();
  c.strokeStyle = col.linea; c.lineWidth = 3; c.stroke();
  // Nariz y boca
  c.fillStyle = col.linea; c.beginPath(); c.ellipse(66, 2, 5, 4, 0, 0, Math.PI * 2); c.fill();
  const abre = p.boca * 16;
  if (abre > 1.5) {
    c.fillStyle = "#1a0a12"; c.beginPath(); c.ellipse(52, 20 + abre * 0.3, 15, 3 + abre * 0.55, 0.06, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e0707f"; c.beginPath(); c.ellipse(52, 21 + abre * 0.45, 8, 2 + abre * 0.2, 0, 0, Math.PI * 2); c.fill();
  } else {
    c.strokeStyle = col.linea; c.lineWidth = 3; c.beginPath();
    const s = p.sonrisa * 6 - (v.pose.tembl > 0.3 ? 3 : 0);
    c.moveTo(34, 20); c.quadraticCurveTo(48, 24 + s, 62, 17 - s * 0.4); c.stroke();
  }
  // Ojos grandes: el de atras un poco mas pequeno
  const abierto = p.ojos * (v.parpadeo > 0 ? Math.abs(1 - v.parpadeo * 2) : 1);
  const eo = escalaOjo * cu.tamanoOjos;
  ojo(c, 16, -8, 19 * eo, 23 * eo, abierto, v.mira, col, p.pupila);
  // Mejillas luminosas
  c.fillStyle = col.luz2; c.globalAlpha = 0.18 + 0.2 * p.sonrisa; c.beginPath(); c.ellipse(34, 18, 12, 6, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  oreja(c, -22, -32, aten + 0.1, lo, col, v.t, 0, false);
  c.restore();
}

/** El cuerpo entero, con los pies en (0, 0). */
export function dibujarCuerpo(c: CanvasRenderingContext2D, v: Vista, g: Genoma, huella: number): void {
  const col = colores(g, huella);
  const p = v.pose;
  const t = v.t;
  const durmiendo = p.dormido;
  const respira = Math.sin(t * (durmiendo > 0.5 ? 1.6 : 2.4)) * (durmiendo > 0.5 ? 4 : 2.5);
  const sacudida = p.tembl * Math.sin(t * 52) * 2.5 + v.golpe * Math.sin(t * 40) * 4;
  const cuerpoY = -188 - (cuerpoDe(g).longitudPata - 1) * 160 + p.agacha * 118 + respira * 0.5 - Math.abs(Math.sin(v.fase)) * (v.vel > 4 ? Math.min(6, v.vel * 0.04) : 0);
  const tam = g.cuerpo.tamano;
  c.save();
  c.scale(tam, tam);
  c.translate(sacudida, 0);

  // Puntos de apoyo del cuerpo
  const cyC = cuerpoY;
  const caderaX = -52, hombroX = 56;
  const caderaY = cyC + 28 - p.agacha * 10;
  const hombroY = cyC + 22 - p.agacha * 8;
  const cu = cuerpoDe(g);
  const largoA = 86 * cu.longitudPata, largoB = 90 * cu.longitudPata;
  const paso = pasoDe(v.vel);
  const corre = v.vel > 4;
  const lift = corre ? 18 + Math.min(26, v.vel * 0.1) : 0;
  const fasePatas = [0, Math.PI, Math.PI, 0]; // trasera lejana, trasera cercana, delantera lejana, delantera cercana
  const apoyo = (i: number, hx: number): [number, number] => {
    if (durmiendo > 0.01) {
      // Patas recogidas bajo el cuerpo
      return [hx + (i < 2 ? 20 : -10) + (i % 2) * 14, -6 - (i % 2) * 2];
    }
    if (!corre) return [hx + (i < 2 ? 6 : -4) + (i % 2 ? 22 : -14), 0];
    const f = v.fase + fasePatas[i] + (i >= 2 ? Math.PI * 0.5 : 0);
    const x = hx + paso * Math.cos(f);
    const y = Math.sin(f) < 0 ? -lift * -Math.sin(f) : 0;
    return [x, y];
  };
  const patas: { pts: [number, number][]; cerca: boolean; delantera: boolean }[] = [];
  const bases: [number, number, boolean, boolean][] = [[caderaX - 8, caderaY, false, false], [caderaX + 12, caderaY + 4, true, false], [hombroX - 14, hombroY, false, true], [hombroX + 6, hombroY + 3, true, true]];
  bases.forEach(([bx, by, cerca, delantera], i) => {
    const hx = bx, hy = by;
    let [fx, fy] = apoyo(i, hx);
    if (delantera && cerca && p.alcance > 0.02) {
      // El brazo cercano se adelanta para empujar o tocar
      fx = hx + 50 + 70 * p.alcance; fy = -46 - 70 * p.alcance + (1 - p.alcance) * 40;
    }
    const [kx, ky] = ik(hx, hy, fx, fy, largoA, largoB, delantera ? -1 : 1);
    patas.push({ pts: [[hx, hy], [kx, ky], [fx, fy]], cerca, delantera });
  });

  const dibujarPata = (q: (typeof patas)[number]): void => {
    const rel = q.cerca ? col.pielOsc : col.lejos;
    miembro(c, q.pts, q.delantera ? [28 * cu.grosorPata, 19 * cu.grosorPata] : [34 * cu.grosorPata, 20 * cu.grosorPata], rel, col.linea);
    const [fx, fy] = q.pts[2];
    if (q.delantera) mano(c, fx, fy, q.cerca && p.alcance > 0.2 ? 0.1 : 1.2, 17, col, Math.sin(t * 2 + (q.cerca ? 1 : 0)) * 0.3);
    else mano(c, fx, fy, 0.2, 15, col, 0);
  };

  // Cola: una cadena de segmentos que se mueve con las emociones
  const colaPts: [number, number][] = [[-86, cyC + 8]];
  let ca = Math.PI * 0.92 + (durmiendo > 0.4 ? -0.9 : 0.35) + (1 - p.colaAmp) * 0.5;
  let cx_ = -86, cy_ = cyC + 8;
  for (let i = 0; i < 9; i++) {
    ca += Math.sin(t * p.colaVel - i * 0.55) * p.colaAmp * 0.18 + (durmiendo > 0.4 ? -0.32 : -0.05);
    cx_ += Math.cos(ca) * 32; cy_ += Math.sin(ca) * 32;
    colaPts.push([cx_, Math.min(cy_, -6)]);
  }
  for (const pasada of [0, 1]) {
    for (let i = 0; i < colaPts.length - 1; i++) {
      c.strokeStyle = pasada === 0 ? col.linea : col.pielOsc;
      c.lineWidth = (pasada === 0 ? 5 : 0) + 20 - i * 1.7;
      c.beginPath(); c.moveTo(colaPts[i][0], colaPts[i][1]); c.lineTo(colaPts[i + 1][0], colaPts[i + 1][1]); c.stroke();
    }
  }
  const punta = colaPts[colaPts.length - 1];
  c.fillStyle = col.luz; c.globalAlpha = 0.25; c.beginPath(); c.arc(punta[0], punta[1], 17, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1; c.beginPath(); c.arc(punta[0], punta[1], 7, 0, Math.PI * 2); c.fill();

  // Patas lejanas
  for (const q of patas) if (!q.cerca) dibujarPata(q);

  // Cuello hacia la cabeza
  const cuelloX = 66, cuelloY = cyC - 26 + p.agacha * 14;
  const abajo = p.cabezaBaja;
  const durm = durmiendo;
  const hx = durm > 0.5 ? cuelloX + 56 : cuelloX + 64 + 46 * abajo;
  const hy = durm > 0.5 ? cyC + 26 : cuelloY - 52 + 118 * abajo + p.agacha * 10 + respira * 0.3 - (v.vel > 4 ? Math.abs(Math.sin(v.fase)) * 3 : 0);
  const mid: [number, number] = [cuelloX + 34, (cuelloY + hy) / 2 - 6];
  for (const pasada of [0, 1]) {
    c.strokeStyle = pasada === 0 ? col.linea : col.piel;
    c.lineWidth = pasada === 0 ? 38 : 31;
    c.beginPath(); c.moveTo(cuelloX - 10, cuelloY + 24); c.quadraticCurveTo(mid[0], mid[1], hx - 8, hy + 8); c.stroke();
  }

  // Cresta dorsal: nace del propio contorno del lomo (las mismas curvas del cuerpo) y se dibuja por detras, con la base tapada por el cuerpo
  const lomo: [number, number][][] = [
    [[-82, cyC + 6], [-80, cyC - 54], [-20, cyC - 62], [36, cyC - 54]],
    [[36, cyC - 54], [88, cyC - 46], [98, cyC + 18], [66, cyC + 46]],
  ];
  const sobre = (k: number, t: number): [number, number, number, number] => {
    const [p0, p1, p2, p3] = lomo[k];
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const l = Math.hypot(dx, dy) || 1;
    return [x, y, dy / l, -dx / l]; // normal hacia fuera del cuerpo
  };
  const puntosLomo: [number, number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) puntosLomo.push([...sobre(0, 0.3 + (i / 6) * 0.65), 1]);
  for (let i = 0; i < 2; i++) puntosLomo.push([...sobre(1, 0.12 + i * 0.16), 0.7]);
  c.fillStyle = col.pielOsc; c.strokeStyle = col.linea; c.lineWidth = 2.5;
  for (const [x, y, nx, ny, esc] of puntosLomo) {
    const alto = (11 + 5 * Math.sin(((x + 82) / 180) * Math.PI)) * esc;
    const tx = -ny, ty = nx; // tangente
    const base = 8 * esc;
    c.beginPath();
    c.moveTo(x - tx * base - nx * 6, y - ty * base - ny * 6);
    c.lineTo(x + nx * alto + tx * 3, y + ny * alto + ty * 3);
    c.lineTo(x + tx * base - nx * 6, y + ty * base - ny * 6);
    c.closePath(); c.fill(); c.stroke();
  }

  // Cuerpo: blando, mas hondo en el pecho que en la grupa
  const gr = c.createLinearGradient(0, cyC - 60, 0, cyC + 60);
  gr.addColorStop(0, col.piel); gr.addColorStop(0.6, col.pielClara); gr.addColorStop(1, col.pielClara);
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(-82, cyC + 6);
  c.bezierCurveTo(-80, cyC - 54, -20, cyC - 62, 36, cyC - 54);
  c.bezierCurveTo(88, cyC - 46, 98, cyC + 18, 66, cyC + 46);
  c.bezierCurveTo(30, cyC + 66, -66, cyC + 58, -82, cyC + 6);
  c.fill();
  c.strokeStyle = col.linea; c.lineWidth = 3.5; c.stroke();
  // Costillas muy suaves
  c.strokeStyle = "rgba(20,40,50,0.16)"; c.lineWidth = 3;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-34 + i * 17, cyC + 14); c.quadraticCurveTo(-30 + i * 17, cyC + 38, -22 + i * 17, cyC + 52); c.stroke(); }
  // Motas luminosas (bioluminiscencia): su numero y sitio salen del genoma
  const ra = new Azar(Math.floor(huella * 1e6) + 7);
  const nM = 4 + Math.floor(g.cuerpo.motas * 6);
  const brillo = 0.55 + 0.25 * Math.sin(t * 2.2) + (p.sonrisa * 0.3);
  for (let i = 0; i < nM; i++) {
    const mx = -60 + ra.next() * 120, my = cyC - 38 + ra.next() * 52, mr = 2.5 + ra.next() * 4;
    c.fillStyle = i % 3 === 0 ? col.luz2 : col.luz;
    c.globalAlpha = 0.18 * brillo; c.beginPath(); c.arc(mx, my, mr * 2.6, 0, Math.PI * 2); c.fill();
    c.globalAlpha = Math.min(1, 0.8 * brillo); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Collar: su marca personal, sobre la curva del cuello (a un 36 % de su recorrido, en el cuello que queda a la vista)
  {
    const t = 0.36, u = 1 - t;
    const p0: [number, number] = [cuelloX - 10, cuelloY + 24], p2: [number, number] = [hx - 8, hy + 8];
    const x = u * u * p0[0] + 2 * u * t * mid[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * mid[1] + t * t * p2[1];
    const dx = 2 * u * (mid[0] - p0[0]) + 2 * t * (p2[0] - mid[0]);
    const dy = 2 * u * (mid[1] - p0[1]) + 2 * t * (p2[1] - mid[1]);
    collar(c, x, y, dx, dy, 31, col, v.animo);
  }

  // Patas cercanas
  for (const q of patas) if (q.cerca) dibujarPata(q);

  // Cabeza (por delante del cuello)
  dibujarCabeza(c, hx, hy, v, g, col, durm > 0.5 ? 0.35 : p.inclina - abajo * 0.35 + (p.tembl * Math.sin(t * 46) * 0.04), 1);
  c.restore();
}

/** Dibuja la criatura entera en un lienzo (con sus pies en el punto de anclaje). */
export function pintarCriatura(c: CanvasRenderingContext2D, v: Vista, g: Genoma, huella: number): void {
  const L = lienzoCriatura;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, L.w * L.res, L.h * L.res);
  c.save();
  c.scale(L.res, L.res);
  c.translate(L.ox, L.oy);
  c.scale(Math.abs(v.dir) < 0.05 ? 0.05 : v.dir, 1);
  c.lineJoin = "round"; c.lineCap = "round";
  dibujarCuerpo(c, v, g, huella);
  c.restore();
}

/** El retrato para el panel de la criatura: la cabeza, grande. */
export function pintarRetrato(cv: HTMLCanvasElement, v: Vista, g: Genoma, huella: number): void {
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.save();
  c.lineJoin = "round"; c.lineCap = "round";
  const s = cv.width / 230;
  c.scale(s, s);
  c.translate(92, 130);
  const col = colores(g, huella);
  // El cuello y el collar asoman por debajo
  c.strokeStyle = col.linea; c.lineWidth = 46; c.beginPath(); c.moveTo(-30, 120); c.lineTo(-6, 36); c.stroke();
  c.strokeStyle = col.piel; c.lineWidth = 38; c.beginPath(); c.moveTo(-30, 120); c.lineTo(-6, 36); c.stroke();
  collar(c, -30 + 24 * 0.55, 120 - 84 * 0.55, 24, -84, 38, col, v.animo);
  dibujarCabeza(c, 0, 0, v, g, col, v.pose.inclina * 0.5, 1.05);
  c.restore();
}
