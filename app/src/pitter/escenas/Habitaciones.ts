import Phaser from "phaser";
import { DISENO_H, DISENO_W, K, MUEBLES } from "../arte/escenarios.ts";
import { DIO_W, SUELO_FONDO, SUELO_FRENTE } from "../arte/habitacion.ts";
import { MARCO } from "../arte/torre.ts";
import type { Habitacion } from "../estado.ts";
import { sonido } from "../audio/audio.ts";
import type { Shell } from "../shell.ts";
import { medir } from "./medidas.ts";
import { SalaVista, type Pieza } from "./salaVista.ts";

/* La pantalla de una habitacion, como en el original: el mismo edificio visto de cerca, con la habitacion en perspectiva en el centro.
   Los personajes viven aqui, y al decorar se pueden arrastrar los muebles. */
export class Habitaciones extends Phaser.Scene {
  private shell!: Shell;
  private indice = 0;
  private editando = false;
  private sala?: SalaVista;
  private marcoIm?: Phaser.GameObjects.Image;
  private jardin?: Phaser.GameObjects.Image;
  private seleccion: Pieza | null = null;
  private guia!: Phaser.GameObjects.Graphics;
  private chispas?: Phaser.GameObjects.Particles.ParticleEmitter;
  private escuchas: Array<[string, (...a: unknown[]) => void]> = [];
  private m = medir(1920, 1080);

  constructor() { super("Habitaciones"); }

  init(datos: { indice?: number; editar?: boolean } | undefined): void {
    this.shell = this.registry.get("shell") as Shell;
    this.indice = Math.max(0, Math.min(this.shell.estado.habitaciones.length - 1, datos?.indice ?? 0));
    this.editando = !!datos?.editar;
    this.seleccion = null;
    this.escuchas = [];
  }

  private hab(): Habitacion {
    return this.shell.estado.habitaciones[this.indice];
  }

  create(): void {
    this.jardin = this.add.image(0, 0, "fondo-jardin").setOrigin(0.5).setDepth(0);
    this.marcoIm = this.add.image(0, 0, "marco-hab").setOrigin(0.5).setDepth(500);
    this.guia = this.add.graphics().setDepth(520);
    this.chispas = this.add.particles(0, 0, "fx:estrella", { emitting: false, speed: { min: 60, max: 220 }, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 600, gravityY: 120, blendMode: "ADD" }).setDepth(600);
    this.montar();
    this.alEscuchar("pt:hab", (cfg) => this.configurar(cfg as { indice?: number; editar?: boolean; refrescar?: boolean }));
    this.alEscuchar("pt:hab-nuevo", (id) => this.anadir(String(id)));
    this.alEscuchar("pt:foto", () => this.foto());
    this.scale.on("resize", this.colocar, this);
    this.input.on("dragstart", (_p: unknown, o: Phaser.GameObjects.Image) => this.arrastre(o, "inicio"));
    this.input.on("drag", (p: Phaser.Input.Pointer, o: Phaser.GameObjects.Image) => this.arrastre(o, "mover", p));
    this.input.on("dragend", (_p: unknown, o: Phaser.GameObjects.Image) => this.arrastre(o, "fin"));
    this.events.once("shutdown", () => {
      this.escuchas.forEach(([ev, fn]) => this.game.events.off(ev, fn));
      this.scale.off("resize", this.colocar, this);
      this.sala?.parar();
      this.sala = undefined;
    });
  }

  private alEscuchar(ev: string, fn: (...a: unknown[]) => void): void {
    this.game.events.on(ev, fn);
    this.escuchas.push([ev, fn]);
  }

  private montar(): void {
    this.sala?.parar();
    this.seleccion = null;
    this.sala = new SalaVista(this, this.hab(), { vivo: !this.editando, dialogos: true, emitir: (ev, d) => this.game.events.emit(ev, d) });
    this.sala.cont.setDepth(100);
    this.colocar();
    this.aplicarEdicion();
  }

  private configurar(c: { indice?: number; editar?: boolean; refrescar?: boolean }): void {
    if (c.indice !== undefined) { this.indice = Math.max(0, Math.min(this.shell.estado.habitaciones.length - 1, c.indice)); this.editando = false; this.montar(); }
    if (c.refrescar) this.montar();
    if (c.editar !== undefined) { this.editando = c.editar; this.sala?.pausarVida(this.editando); this.aplicarEdicion(); }
  }

  private colocar(): void {
    const w = this.scale.width, h = this.scale.height;
    this.m = medir(w, h);
    const m = this.m;
    this.jardin?.setPosition(w / 2, h / 2).setScale(m.s / K);
    this.marcoIm?.setPosition(w / 2, h / 2).setScale(m.s / K);
    const x0 = w / 2 + (MARCO.x - DISENO_W / 2) * m.s;
    const y0 = m.oy + MARCO.y * m.s;
    this.sala?.colocar(x0, y0, (MARCO.w / DIO_W) * m.s);
    this.dibujarGuia();
  }

  private aplicarEdicion(): void {
    this.sala?.piezas.forEach((p) => {
      if (this.editando) { p.im.setInteractive({ draggable: true, useHandCursor: true }); this.input.setDraggable(p.im, true); }
      else p.im.disableInteractive();
    });
    if (!this.editando) this.seleccion = null;
    this.dibujarGuia();
  }

  private local(p: Phaser.Input.Pointer): { x: number; y: number } {
    const c = this.sala?.cont;
    if (!c) return { x: 0, y: 0 };
    return { x: (p.x - c.x) / c.scaleX, y: (p.y - c.y) / c.scaleY };
  }

  private anadir(id: string): void {
    const def = MUEBLES.find((d) => d.id === id);
    const sala = this.sala;
    if (!def || !sala) return;
    const h = this.hab();
    if (h.muebles.length >= 14) { this.shell.avisar("Esta habitación ya está llena."); sonido.invalido(); return; }
    const x = 460 + Math.random() * 600;
    const y = def.suelo ? SUELO_FONDO + 60 + Math.random() * 140 : 280;
    h.muebles.push({ id, x, y });
    const p = sala.crearPieza(id, h.muebles.length - 1);
    sala.colocarPiezas();
    this.aplicarEdicion();
    this.seleccion = p;
    this.dibujarGuia();
    sonido.mueble();
    const c = sala.cont;
    this.chispas?.explode(10, c.x + x * c.scaleX, c.y + y * c.scaleY - 60);
    this.tweens.add({ targets: p.im, scale: { from: 0, to: p.im.scale }, duration: 360, ease: "Back.easeOut" });
    this.shell.guardar();
  }

  private arrastre(o: Phaser.GameObjects.Image, fase: "inicio" | "mover" | "fin", p?: Phaser.Input.Pointer): void {
    const pz = o.getData("pieza") as Pieza | undefined;
    const sala = this.sala;
    if (!pz || !sala) return;
    const mu = this.hab().muebles[pz.idx];
    if (fase === "inicio") { this.seleccion = pz; sonido.agarrar(); o.setDepth(2000); this.dibujarGuia(); return; }
    if (fase === "mover" && p) {
      const l = this.local(p);
      mu.x = Phaser.Math.Clamp(l.x, 40, DIO_W - 40);
      mu.y = pz.def.suelo ? Phaser.Math.Clamp(l.y, SUELO_FONDO + 10, SUELO_FRENTE + 70) : Phaser.Math.Clamp(l.y, 150, 460);
      o.setPosition(mu.x, mu.y);
      this.dibujarGuia();
      return;
    }
    sonido.soltar();
    // Si se suelta por debajo del suelo, se quita
    if (mu.y > SUELO_FRENTE + 40) { this.hab().muebles.splice(pz.idx, 1); sonido.invalido(); this.shell.guardar(); this.montar(); return; }
    mu.y = pz.def.suelo ? Math.min(mu.y, SUELO_FRENTE - 8) : mu.y;
    sala.colocarPiezas();
    this.dibujarGuia();
    this.shell.guardar();
  }

  private dibujarGuia(): void {
    const g = this.guia;
    g.clear();
    const c = this.sala?.cont;
    if (!this.editando || !c) return;
    const s = c.scaleX;
    g.lineStyle(4, 0xffffff, 0.5);
    g.strokeRect(c.x + 60 * s, c.y + (SUELO_FONDO + 10) * s, (DIO_W - 120) * s, (SUELO_FRENTE - SUELO_FONDO - 18) * s);
    if (this.seleccion) {
      const im = this.seleccion.im;
      const wx = c.x + im.x * s, wy = c.y + im.y * s;
      const w = im.displayWidth * s, h2 = im.displayHeight * s;
      g.lineStyle(6, 0xffd23f, 1);
      g.strokeRoundedRect(wx - w / 2 - 6, wy - h2 * (this.seleccion.def.suelo ? 1 : 0.5) - 6, w + 12, h2 + 12, 14);
    }
  }

  private foto(): void {
    try {
      this.game.renderer.snapshot((img: unknown) => {
        const a = document.createElement("a");
        a.href = (img as HTMLImageElement).src;
        a.download = "pitter-patter-habitacion.png";
        a.click();
      });
      sonido.cargada();
    } catch {
      this.shell.avisar("No he podido sacar la foto en este navegador.");
    }
  }

  update(): void {
    this.sala?.update();
  }
}

export { DISENO_H };
