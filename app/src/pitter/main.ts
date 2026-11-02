import "./pitter.css";
import "./pitter-menu.css";
import "./pitter-puzzle.css";
import "./pitter-campana.css";
import "./pitter-album.css";
import "./pitter-torre.css";
import "./pitter-hab.css";
import Phaser from "phaser";
import { todosLosPersonajes } from "./datos/roster.ts";
import { arteGlobal, crearArte } from "./arte/chibis.ts";
import { crearJefes } from "./arte/jefes.ts";
import { cargarArteReal } from "./arte/real.ts";
import { JEFES } from "./datos/campana.ts";
import { Shell } from "./shell.ts";
import { Arranque } from "./escenas/Arranque.ts";
import { Fondo } from "./escenas/Fondo.ts";
import { Menu } from "./escenas/Menu.ts";
import { Puzzle } from "./escenas/Puzzle.ts";
import { Habitaciones } from "./escenas/Habitaciones.ts";
import { pantallaTitulo } from "./ui/titulo.ts";
import { pantallaMenu } from "./ui/menu.ts";
import { pantallaPuzzle } from "./ui/puzzle.ts";
import { pantallaCampana } from "./ui/campana.ts";
import { pantallaColeccion } from "./ui/coleccion.ts";
import { pantallaEquipo } from "./ui/equipo.ts";
import { pantallaProgreso } from "./ui/progreso.ts";
import { pantallaHabitaciones } from "./ui/habitaciones.ts";

/* Pagina escondida: solo la abre el admin, igual que el resto de juegos ocultos (ver js/oculto.js en la raiz). En desarrollo no se comprueba. */
function permitido(): boolean {
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem("compendioAdmin") === "1"; } catch { return false; }
}

function progreso(p: number, texto?: string): void {
  const r = document.getElementById("pt-carga-relleno");
  if (r) r.style.width = `${Math.round(p * 100)}%`;
  const t = document.getElementById("pt-carga-texto");
  if (t && texto) t.textContent = texto;
}

async function arrancar(): Promise<void> {
  if (!permitido()) { window.location.replace("../../minijuegos.html"); return; }
  progreso(0.1, "Cargando letras…");
  await Promise.all(['32px "Lilita One"', '16px "Nunito"', '800 16px "Nunito"'].map((f) => document.fonts.load(f).catch(() => null)));
  progreso(0.35, "Dibujando a los personajes…");
  await new Promise((r) => setTimeout(r, 30));
  arteGlobal.v = crearArte(todosLosPersonajes());
  arteGlobal.v.jefes = crearJefes(JEFES.map((j) => j.id));
  await cargarArteReal(arteGlobal.v);
  progreso(0.65, "Montando el salón…");
  const shell = new Shell();
  shell.registrar("titulo", pantallaTitulo, "Menu", "calma");
  shell.registrar("menu", pantallaMenu, "Menu", "menu");
  shell.registrar("campana", pantallaCampana, "Fondo", "calma");
  shell.registrar("puzzle", pantallaPuzzle, "Puzzle", "puzzle");
  shell.registrar("coleccion", pantallaColeccion, "Fondo", "calma");
  shell.registrar("equipo", pantallaEquipo, "Fondo", "calma");
  shell.registrar("progreso", pantallaProgreso, "Fondo", "calma");
  shell.registrar("habitaciones", pantallaHabitaciones, "Habitaciones", "habitaciones");
  const juego = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "pt-juego",
    backgroundColor: "#24113f",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false },
    scene: [Arranque, Fondo, Menu, Puzzle, Habitaciones],
    disableContextMenu: true,
  });
  shell.juego = juego;
  juego.registry.set("shell", shell);
  await new Promise<void>((res) => { const t = setInterval(() => { if (juego.registry.get("listo")) { clearInterval(t); res(); } }, 30); });
  progreso(1, "¡Listo!");
  await shell.ir("titulo");
  document.getElementById("pt-carga")?.classList.add("fuera");
  (window as unknown as { pitter: Shell }).pitter = shell;
}

void arrancar();
