/* El armazon del juego: pantallas, transiciones entre escenas, pantalla completa, avisos y guardado.
   Todo ocurre en una sola pagina sin recargas, asi la partida se conserva al cambiar de pantalla o de modo. */

import { refrescarAdmin } from "./ui/admin.ts";
import type Phaser from "phaser";
import { aviso as mostrarAviso, esperar, iniciarTooltips } from "./ui/base.ts";
import { sonido, type Escena } from "./audio/audio.ts";
import { cargar, guardarLocal, type Estado } from "./estado.ts";
import { todosLosPersonajes } from "./datos/roster.ts";
import { guardarServidor } from "./guardado.ts";

export type PantallaId = "titulo" | "menu" | "puzzle" | "coleccion" | "equipo" | "habitaciones" | "progreso" | "campana";

export interface Pantalla {
  desmontar(): void;
}
export type Fabrica = (shell: Shell, datos: unknown) => Pantalla;

interface Registro {
  fabrica: Fabrica;
  escena: string;
  musica: Escena | null;
}

export type Transicion = "diagonal" | "centro" | "rapida";

export class Shell {
  raiz: HTMLElement;
  ui: HTMLElement;
  cortina: HTMLElement;
  juego: Phaser.Game | null = null;
  estado: Estado;
  actual: Pantalla | null = null;
  nombre: PantallaId | null = null;
  private registro = new Map<PantallaId, Registro>();
  private ocupado = false;
  private guardando = 0;

  constructor() {
    this.raiz = document.getElementById("pt-raiz") as HTMLElement;
    this.ui = document.getElementById("pt-ui") as HTMLElement;
    this.cortina = document.getElementById("pt-cortina") as HTMLElement;
    this.estado = cargar();
    sonido.fijar(this.estado.ajustes);
    iniciarTooltips(this.raiz);
    document.addEventListener("fullscreenchange", () => this.alCambiarPantallaCompleta());
    document.addEventListener("keydown", (e) => this.teclaGlobal(e));
    window.addEventListener("pagehide", () => this.guardar(true));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.guardar(true); });
  }

  registrar(id: PantallaId, fabrica: Fabrica, escena: string, musica: Escena | null): void {
    this.registro.set(id, { fabrica, escena, musica });
  }

  /* --- Pantalla completa --- */
  get enPantallaCompleta(): boolean {
    return !!document.fullscreenElement;
  }

  async pantallaCompleta(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.raiz.requestFullscreen({ navigationUI: "hide" });
    } catch {
      this.avisar("Tu navegador no deja usar la pantalla completa aquí.");
    }
  }

  private alCambiarPantallaCompleta(): void {
    this.raiz.classList.toggle("completa", this.enPantallaCompleta);
    document.querySelectorAll<HTMLElement>("[data-pc]").forEach((b) => {
      b.setAttribute("aria-pressed", this.enPantallaCompleta ? "true" : "false");
      b.textContent = this.enPantallaCompleta ? "⤡" : "⤢";
    });
    // El lienzo se ajusta solo (Scale.RESIZE), pero algunas pantallas miden zonas del DOM.
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  }

  private teclaGlobal(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "f" || e.key === "F") { e.preventDefault(); void this.pantallaCompleta(); }
    else if (e.key === "m" || e.key === "M") {
      const a = this.estado.ajustes;
      a.silencioMusica = !a.silencioMusica;
      sonido.fijar(a);
      this.guardar();
      this.avisar(a.silencioMusica ? "Música apagada" : "Música encendida", 1200);
    }
  }

  avisar(texto: string, ms?: number): void {
    mostrarAviso(this.raiz, texto, ms);
  }

  /* --- Guardado: en el navegador siempre, en el servidor al cerrar una partida o salir --- */
  guardar(servidor = false): void {
    guardarLocal(this.estado);
    sonido.fijar(this.estado.ajustes);
    if (!servidor) return;
    window.clearTimeout(this.guardando);
    void guardarServidor(this.estado);
  }

  /* --- Transiciones: una rejilla de fichas que se cierra y se abre --- */
  private async cerrarCortina(tipo: Transicion): Promise<void> {
    const paleta = todosLosPersonajes().map((p) => p.color);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cols = Math.max(8, Math.round(w / 140));
    const filas = Math.max(5, Math.round(h / 140));
    this.cortina.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.cortina.style.gridTemplateRows = `repeat(${filas}, 1fr)`;
    this.cortina.replaceChildren();
    const celdas: HTMLElement[] = [];
    const cx = (cols - 1) / 2;
    const cy = (filas - 1) / 2;
    for (let y = 0; y < filas; y++)
      for (let x = 0; x < cols; x++) {
        const i = document.createElement("i");
        i.style.background = paleta[(x * 3 + y * 5 + ((x * y) % 4)) % paleta.length] ?? "#ff4f9a";
        const d = tipo === "centro" ? Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy) : (x / cols + y / filas) / 2;
        i.dataset.d = String(d);
        this.cortina.append(i);
        celdas.push(i);
      }
    this.cortina.classList.add("activa");
    const rapido = tipo === "rapida" || this.estado.ajustes.movimientoReducido;
    const dur = rapido ? 160 : 340;
    const retraso = rapido ? 60 : 380;
    const animaciones = celdas.map((c) =>
      c.animate([{ transform: "scale(0) rotate(-25deg)" }, { transform: "scale(1.08) rotate(0deg)", offset: 0.8 }, { transform: "scale(1) rotate(0deg)" }], {
        duration: dur,
        delay: Number(c.dataset.d) * retraso,
        easing: "cubic-bezier(0.3, 0.9, 0.4, 1)",
        fill: "forwards",
      }).finished,
    );
    // Por si el navegador no avanza las animaciones (pestaña oculta): nunca nos quedamos atascados en la cortina
    await Promise.race([Promise.all(animaciones), esperar(dur + retraso + 400)]);
  }

  private async abrirCortina(tipo: Transicion): Promise<void> {
    const celdas = [...this.cortina.children] as HTMLElement[];
    const rapido = tipo === "rapida" || this.estado.ajustes.movimientoReducido;
    const dur = rapido ? 150 : 300;
    const retraso = rapido ? 50 : 330;
    await Promise.race([
      esperar(dur + retraso + 400),
      Promise.all(
      celdas.map((c) =>
        c.animate([{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(0) rotate(30deg)" }], {
          duration: dur,
          delay: (1 - Number(c.dataset.d)) * retraso,
          easing: "cubic-bezier(0.6, 0, 0.9, 0.5)",
          fill: "forwards",
        }).finished,
      ),
      ),
    ]);
    this.cortina.classList.remove("activa");
    this.cortina.replaceChildren();
  }

  /** Cambia de pantalla con transicion. Mientras dura, ignora otras peticiones. */
  async ir(id: PantallaId, datos?: unknown, tipo: Transicion = "diagonal"): Promise<void> {
    const reg = this.registro.get(id);
    if (!reg || this.ocupado) return;
    this.ocupado = true;
    try {
      if (this.nombre) await this.cerrarCortina(tipo);
      this.actual?.desmontar();
      this.ui.replaceChildren();
      this.nombre = id;
      this.raiz.dataset.pantalla = id;
      this.actual = reg.fabrica(this, datos);
      this.juego?.registry.set("pantalla", id);
      if (this.juego) {
        for (const s of this.juego.scene.getScenes(true)) this.juego.scene.stop(s.scene.key);
        this.juego.scene.start(reg.escena, (datos ?? undefined) as object | undefined);
      }
      if (reg.musica) sonido.musica(reg.musica);
      await esperar(90);
      await this.abrirCortina(tipo);
      refrescarAdmin(this);
    } finally {
      this.ocupado = false;
    }
  }
}
