import Phaser from "phaser";
import { EscenaGuerra, type Ganchos } from "./escena";

/* =============================================================================
   LA FRACTURA en Phaser: punto de entrada. Expone window.FracturaTableroPhaser.crear(canvas, ganchos),
   con la misma interfaz que el tablero de canvas (js/fractura-tablero.js): poner, estado, redibujar,
   instantanea, reproducir, saltar, ocupado, alTerminar, onda, efecto, reservar, pantallaDe y ajustar.
   js/fractura.js elige este o el de canvas (con ?renderer=canvas se fuerza el de canvas).
============================================================================= */

export interface Tablero {
  poner(est: unknown): void;
  estado(e: unknown): void;
  redibujar(): void;
  instantanea(): Map<string, unknown>;
  reproducir(evs: unknown[], antes: Map<string, unknown> | null, opciones?: unknown): void;
  saltar(): void;
  ocupado(): boolean;
  alTerminar(f: () => void): void;
  onda(x: number, y: number, color: string): void;
  efecto(x: number, y: number, texto: string, color: string): void;
  reservar(r: { arriba?: number; abajo?: number; izq?: number; der?: number }): void;
  pantallaDe(x: number, y: number): { x: number; y: number; ts: number };
  ajustar(): void;
}

/* Phaser 4 exige elegir el renderizador cuando se le da un canvas propio. */
function tieneWebGL(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

function crear(canvas: HTMLCanvasElement, ganchos: Ganchos): Tablero {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const escena = new EscenaGuerra(ganchos, dpr);
  const juego = new Phaser.Game({
    type: tieneWebGL() ? Phaser.WEBGL : Phaser.CANVAS,
    canvas,
    width: Math.round(window.innerWidth * dpr),
    height: Math.round(window.innerHeight * dpr),
    backgroundColor: "#050304",
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    render: { antialias: true, roundPixels: false },
    input: { windowEvents: false },
    scene: [escena],
  });
  const medir = (): void => {
    juego.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
    escena.alCambiarTamano();
  };
  window.addEventListener("resize", medir);
  (canvas as unknown as { __juego: Phaser.Game }).__juego = juego;
  const api: Tablero = {
    poner: est => escena.cuando(() => escena.poner(est as never)),
    estado: e => escena.cuando(() => escena.estado(e as never)),
    redibujar: () => escena.cuando(() => escena.sincronizar(true)),
    instantanea: () => escena.instantanea() as Map<string, unknown>,
    reproducir: (evs, antes, op) => escena.cuando(() => escena.reproducir(evs as never, antes as never, op as never)),
    saltar: () => escena.saltar(),
    ocupado: () => escena.ocupado(),
    alTerminar: f => { if (escena.ocupado()) escena.alTerminar(f); else f(); },
    onda: (x, y, c) => escena.cuando(() => escena.onda(x, y, c)),
    efecto: (x, y, t, c) => escena.cuando(() => escena.texto(x, y, t, c)),
    reservar: r => escena.cuando(() => escena.reservar(r)),
    pantallaDe: (x, y) => escena.pantallaDe(x, y),
    ajustar: medir,
  };
  return api;
}

(window as unknown as { FracturaTableroPhaser: { crear: typeof crear } }).FracturaTableroPhaser = { crear };
