import Phaser from "phaser";
import { EscenaGuerra, type Ganchos } from "./escena";

/* =============================================================================
   LA FRACTURA en Phaser: punto de entrada. Expone window.FracturaTableroPhaser.crear(canvas, ganchos).
   Devuelve el tablero de la guerra: poner el estado, marcar resaltes, reproducir las animaciones de lo
   que resolvió el motor y mover la vista (zoom, arrastre, ir a una casilla, qué trozo se ve).
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
  zoom(factor: number): void;
  centrar(): void;
  verTodo(): void;
  irA(x: number, y: number, suave?: boolean): void;
  vista(): { x0: number; y0: number; x1: number; y1: number };
  ajustes(a: { rapidez?: number; seguir?: boolean }): void;
  dormir(si: boolean): void;
}

/* Phaser 4 exige elegir el renderizador cuando se le da un canvas propio. */
function tieneWebGL(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

/* Cuántos píxeles de dibujo por píxel de pantalla. Dibujar a toda la resolución de una pantalla grande ahoga a las
   gráficas integradas, así que hay un tope de píxeles totales: en pantallas grandes se dibuja a 1:1 o algo menos. */
const TOPE_PIXELES = 1.9e6;
function escalaDibujo(): number {
  const px = Math.max(1, window.innerWidth * window.innerHeight);
  return Math.max(0.6, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(TOPE_PIXELES / px)));
}

function crear(canvas: HTMLCanvasElement, ganchos: Ganchos): Tablero {
  let dpr = escalaDibujo();
  const escena = new EscenaGuerra(ganchos, dpr);
  const juego = new Phaser.Game({
    type: tieneWebGL() ? Phaser.WEBGL : Phaser.CANVAS,
    canvas,
    width: Math.round(window.innerWidth * dpr),
    height: Math.round(window.innerHeight * dpr),
    backgroundColor: "#05060c",
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    // antialiasGL apagado: el suavizado de bordes del contexto (MSAA) cuesta mucho y aquí casi todo son texturas
    render: { antialias: true, antialiasGL: false, roundPixels: false, powerPreference: "default" },
    fps: { limit: 60 },
    audio: { noAudio: true },
    input: { windowEvents: false },
    banner: false,
    scene: [escena],
  });
  const medir = (): void => {
    const d = escalaDibujo();
    if (Math.abs(d - dpr) > 0.01) { dpr = d; escena.ponerEscala(d); juego.scale.setZoom(1 / d); }
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
    zoom: f => escena.zoom(f),
    centrar: () => escena.centrar(),
    verTodo: () => escena.verTodo(),
    irA: (x, y, suave) => escena.irA(x, y, suave),
    vista: () => escena.vista(),
    ajustes: a => escena.ajustes(a),
    // Con la guerra fuera de la vista (cuartel, portada) el bucle se para del todo
    dormir: si => { if (si) juego.loop.sleep(); else { juego.loop.wake(); medir(); } },
  };
  return api;
}

(window as unknown as { FracturaTableroPhaser: { crear: typeof crear } }).FracturaTableroPhaser = { crear };
