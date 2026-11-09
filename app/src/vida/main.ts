import "./vida.css";
import Phaser from "phaser";
import { Juego } from "./juego.ts";
import { Laboratorio } from "./escenas/Laboratorio.ts";
import { Interfaz } from "./ui/interfaz.ts";
import { pantallaTitulo } from "./ui/titulo.ts";
import { aviso, boton, esperar, h, iniciarAyudas, respirar } from "./ui/base.ts";
import { AJ } from "./nucleo/ajustes.ts";
import { cargarGuardado, complejoNuevo, simulacionNueva } from "./guardado.ts";
import { sonido } from "./audio/audio.ts";
import type { ResumenFueraDeLinea } from "./nucleo/simulacion.ts";

/* Pagina escondida: solo la abre el admin, igual que el resto de juegos ocultos (ver js/oculto.js en la raiz). En desarrollo no se comprueba. */
function permitido(): boolean {
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem("compendioAdmin") === "1"; } catch { return false; }
}

function progreso(p: number, texto?: string): void {
  const r = document.getElementById("va-carga-relleno");
  if (r) r.style.width = `${Math.round(p * 100)}%`;
  const t = document.getElementById("va-carga-texto");
  if (t && texto) t.textContent = texto;
}

/** Simula el tiempo que el jugador estuvo fuera, en trozos para que la pagina siga respondiendo. */
async function simularFuera(juego: Juego, segundos: number, alAvance: (txt: string) => void): Promise<ResumenFueraDeLinea> {
  const sim = juego.sim;
  const seg = Math.min(segundos, AJ.topeFueraDeLinea);
  const t0 = sim.t;
  const trozo = 1200;
  for (let hecho = 0; hecho < seg; hecho += trozo) {
    sim.avanzar(Math.min(trozo, seg - hecho), AJ.dtFueraDeLinea);
    alAvance(`Simulando lo que pasó… ${Math.round(Math.min(1, (hecho + trozo) / seg) * 100)} %`);
    await respirar();
  }
  return sim.resumenDesde(t0, seg, segundos > AJ.topeFueraDeLinea);
}

function duracion(s: number): string {
  const h_ = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h_ ? `${h_} h ${m} min` : `${Math.max(1, m)} min`;
}

function mostrarResumen(raiz: HTMLElement, r: ResumenFueraDeLinea, real: number): void {
  const modal = h("div", { clase: "va-modal" });
  const caja = h("div", { clase: "va-caja" },
    h("h2", {}, "Mientras no estabas"),
    h("p", { clase: "va-sub-modal" }, `Pasaron ${duracion(real)}.${r.recortado ? ` Solo se simularon ${duracion(r.segundos)}, que es el máximo.` : ""}`),
  );
  for (const c of r.criaturas) {
    caja.append(h("h3", {}, c.nombre));
    if (!c.sucesos.length) caja.append(h("p", {}, "No le pasó nada que merezca contarse."));
    for (const s of c.sucesos) caja.append(h("p", {}, s.texto, s.n > 1 ? ` (${s.n} veces)` : ""));
    if (c.hambre > 0.7) caja.append(h("p", {}, "Ahora mismo tiene hambre."));
  }
  caja.append(h("div", { clase: "va-pie-modal" }, boton("Seguir", () => modal.remove(), { clase: "va-btn-lleno" })));
  modal.append(caja);
  raiz.append(modal);
}

async function arrancar(): Promise<void> {
  if (!permitido()) { window.location.replace("../../minijuegos.html"); return; }
  const raiz = document.getElementById("va-raiz") as HTMLElement;
  const ui = document.getElementById("va-ui") as HTMLElement;
  progreso(0.1, "Cargando letras…");
  await Promise.all(['600 20px "Chakra Petch"', '500 16px "Chakra Petch"', '600 16px "Nunito"', '700 16px "Nunito"'].map((f) => document.fonts.load(f).catch(() => null)));
  progreso(0.4, "Preparando la sala…");
  await esperar(30);
  const guardado = cargarGuardado();
  const juego = new Juego(guardado);
  iniciarAyudas(raiz);

  progreso(0.65, "Despertando a las criaturas…");
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "va-juego",
    backgroundColor: "#040a0d",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false },
    scene: [Laboratorio],
    disableContextMenu: true,
    audio: { noAudio: true },
  });
  juego.game = game;
  game.registry.set("juego", juego);
  const escena = await new Promise<Laboratorio>((res) => {
    const t = setInterval(() => {
      const s = game.scene.getScene("Laboratorio") as Laboratorio | null;
      if (s && s.lista) { clearInterval(t); res(s); }
    }, 30);
  });
  progreso(1, "Listo.");

  let interfaz: Interfaz | null = null;
  const montar = (): void => {
    interfaz?.desmontar();
    interfaz = new Interfaz(ui, juego, escena);
    interfaz.montar();
  };
  const w = window as unknown as { vida: unknown };
  w.vida = { juego, escena, game };

  pantallaTitulo(ui, {
    hayGuardado: !!guardado,
    async entrar(nuevo, alAvance, complejo) {
      if (nuevo) juego.reemplazarSim(complejo ? complejoNuevo() : simulacionNueva());
      else if (guardado) {
        const real = Math.max(0, (Date.now() - guardado.ultima) / 1000);
        if (real > 20) {
          const r = await simularFuera(juego, real, alAvance);
          if (real > 120) window.setTimeout(() => mostrarResumen(raiz, r, real), 2400);
        }
      }
      escena.enTitulo = false;
      montar();
      juego.fijarCamara(juego.ajustes.camara);
      juego.fijarVelocidad(juego.ajustes.velocidad || 1);
      juego.guardar(true);
    },
  });
  document.getElementById("va-carga")?.classList.add("fuera");

  window.addEventListener("pagehide", () => juego.guardar(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) juego.guardar(true); });
  void aviso;
  void sonido;
}

void arrancar();
