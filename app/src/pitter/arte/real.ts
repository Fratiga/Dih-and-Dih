/* Arte definitivo: si existe assets/pitter/manifest.json, los personajes y jefes que liste usan esos PNG en lugar de los muñecos provisionales.
   Formato del manifiesto (todas las rutas son relativas a assets/pitter/):
     { "chibis": { "bull": "chibis/bull.png" }, "jefes": { "kobold": "jefes/kobold.png" } }
   Un chibi es UN solo PNG con fondo transparente, de cuerpo entero y con los pies abajo; el juego lo anima (respira, salta, se agranda)
   y saca de el la ficha del tablero y el retrato de la coleccion. Un jefe es un PNG cuadrado con fondo transparente. */

import { ALTO_CHIBI, ANCHO_CHIBI, EXPRESIONES, LADO_FICHA, type ArteChibi, type Expresion } from "./chibis.ts";
import { LADO_JEFE } from "./jefes.ts";
import { AFINIDADES, todosLosPersonajes } from "../datos/roster.ts";
import { iconoAfinidad } from "./chibis.ts";
import { cargarRig, dibujarRig, type Rig } from "./rig.ts";

interface Manifiesto {
  chibis?: Record<string, string>;
  jefes?: Record<string, string>;
  /** Personajes hechos con piezas sueltas: { id: "rig/<id>/rig.json" }. */
  rigs?: Record<string, string>;
}

const RAIZ = import.meta.env.DEV ? "/" : "../../";

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext("2d") as CanvasRenderingContext2D];
}

/* Dibuja la imagen dentro de un cuadro, entera, centrada abajo. */
function ajustar(c: CanvasRenderingContext2D, im: HTMLImageElement, w: number, h: number, margen = 6): void {
  const k = Math.min((w - margen * 2) / im.width, (h - margen) / im.height);
  const dw = im.width * k, dh = im.height * k;
  c.drawImage(im, (w - dw) / 2, h - dh - margen / 2, dw, dh);
}

/* El retrato y la ficha de un personaje. Si no hay una cabeza dibujada aparte, el retrato es la parte de arriba del chibi. */
function ponerRetratoYFicha(arte: ArteChibi, p: ReturnType<typeof todosLosPersonajes>[number], cv: HTMLCanvasElement, cabeza: HTMLCanvasElement | null): void {
  let rv: HTMLCanvasElement;
  if (cabeza) rv = cabeza;
  else {
    const [r, rc] = lienzo(256, 256);
    const sx = 0, sy = 0, sw = ANCHO_CHIBI, sh = ALTO_CHIBI * 0.62;
    rc.drawImage(cv, sx, sy, sw, sh, 8, 20, 240, 240 * (sh / sw));
    rv = r;
  }
  arte.retrato.set(p.id, rv);
  // Ficha del tablero: el retrato dentro del cuadrado de su color
  const [fv, fc] = lienzo(LADO_FICHA, LADO_FICHA);
  fc.beginPath(); fc.roundRect(7, 7, LADO_FICHA - 14, LADO_FICHA - 14, 34); fc.fillStyle = p.color; fc.fill(); fc.lineWidth = 8; fc.strokeStyle = "#2a1545"; fc.stroke();
  fc.save(); fc.beginPath(); fc.roundRect(11, 11, LADO_FICHA - 22, LADO_FICHA - 22, 30); fc.clip();
  fc.drawImage(rv, 14, 14, LADO_FICHA - 28, LADO_FICHA - 28);
  fc.restore();
  fc.beginPath(); fc.arc(LADO_FICHA - 30, LADO_FICHA - 30, 19, 0, Math.PI * 2); fc.fillStyle = AFINIDADES[p.afinidad].color; fc.fill(); fc.lineWidth = 5; fc.strokeStyle = "#2a1545"; fc.stroke();
  iconoAfinidad(fc, p.afinidad, LADO_FICHA - 30, LADO_FICHA - 30, 21, "#fff", 4);
  arte.ficha.set(p.id, fv);
}

/* Un chibi hecho con piezas: una imagen por expresion, de la pose que diga el rig, y el retrato con solo la cabeza. */
function ponerRig(arte: ArteChibi, rig: Rig, p: ReturnType<typeof todosLosPersonajes>[number]): void {
  const e = rig.datos.encuadre;
  const k = Math.min(ANCHO_CHIBI / e.w, ALTO_CHIBI / e.h);
  const poses = {} as Record<Expresion, HTMLCanvasElement>;
  for (const x of EXPRESIONES) {
    const [cv, c] = lienzo(ANCHO_CHIBI, ALTO_CHIBI);
    c.imageSmoothingQuality = "high";
    // Centrado a lo ancho y apoyado abajo
    c.translate((ANCHO_CHIBI - e.w * k) / 2 - e.x * k, ALTO_CHIBI - 2 - (e.y + e.h) * k);
    c.scale(k, k);
    dibujarRig(c, rig, rig.datos.poses[x] ?? rig.datos.poses.idle ?? {});
    poses[x] = cv;
  }
  arte.chibi.set(p.id, poses);
  const r = rig.datos.encuadreRetrato;
  const [rv, rc] = lienzo(256, 256);
  const kr = Math.min(240 / r.w, 240 / r.h);
  rc.translate(128 - (r.x + r.w / 2) * kr, 140 - (r.y + r.h / 2) * kr);
  rc.scale(kr, kr);
  dibujarRig(rc, rig, rig.datos.poses.idle ?? {}, rig.datos.retrato);
  ponerRetratoYFicha(arte, p, poses.idle, rv);
}

export async function cargarArteReal(arte: ArteChibi): Promise<{ chibis: string[]; jefes: string[] }> {
  const usados = { chibis: [] as string[], jefes: [] as string[] };
  let man: Manifiesto | null = null;
  try {
    const r = await fetch(`${RAIZ}assets/pitter/manifest.json`, { cache: "no-cache" });
    if (r.ok) man = (await r.json()) as Manifiesto;
  } catch {
    return usados;
  }
  if (!man) return usados;
  const personajes = todosLosPersonajes();
  for (const [id, ruta] of Object.entries(man.chibis ?? {})) {
    const p = personajes.find((x) => x.id === id);
    const im = await cargarImagen(`${RAIZ}assets/pitter/${ruta}`);
    if (!p || !im) continue;
    const [cv, c] = lienzo(ANCHO_CHIBI, ALTO_CHIBI);
    ajustar(c, im, ANCHO_CHIBI, ALTO_CHIBI);
    const poses = {} as Record<Expresion, HTMLCanvasElement>;
    for (const x of EXPRESIONES) poses[x] = cv;
    arte.chibi.set(id, poses);
    ponerRetratoYFicha(arte, p, cv, null);
    usados.chibis.push(id);
  }
  for (const [id, ruta] of Object.entries(man.rigs ?? {})) {
    const p = personajes.find((x) => x.id === id);
    const rig = await cargarRig(`${RAIZ}assets/pitter/${ruta}`);
    if (!p || !rig) continue;
    ponerRig(arte, rig, p);
    usados.chibis.push(id);
  }
  for (const [id, ruta] of Object.entries(man.jefes ?? {})) {
    const im = await cargarImagen(`${RAIZ}assets/pitter/${ruta}`);
    if (!im) continue;
    const [cv, c] = lienzo(LADO_JEFE, LADO_JEFE);
    ajustar(c, im, LADO_JEFE, LADO_JEFE, 10);
    arte.jefes.set(id, cv);
    usados.jefes.push(id);
  }
  return usados;
}
