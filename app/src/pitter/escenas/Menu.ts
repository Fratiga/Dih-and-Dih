import Phaser from "phaser";
import { K } from "../arte/escenarios.ts";
import { DIO_W } from "../arte/habitacion.ts";
import { SALAS_MAX } from "../arte/torre.ts";
import type { Shell } from "../shell.ts";
import { medir, rectSalaPantalla, torre, type Medida } from "./medidas.ts";
import { SalaVista } from "./salaVista.ts";

/* El menu es la mansion en corte, como en el Pitter-Patter original: una torre con un piso por habitacion y los personajes viviendo dentro. */
export class Menu extends Phaser.Scene {
  private jardin!: Phaser.GameObjects.Image;
  private torreIm!: Phaser.GameObjects.Image;
  private salas: Array<SalaVista | null> = [];
  private cristales: Phaser.GameObjects.Image[] = [];
  private cerradas: Phaser.GameObjects.Image[] = [];
  private brillo!: Phaser.GameObjects.Graphics;
  private nubes: Phaser.GameObjects.Graphics[] = [];
  private chispas?: Phaser.GameObjects.Particles.ParticleEmitter;
  private m!: Medida;
  private sobre: string | null = null;
  private alHover = (id: string | null): void => { this.sobre = id; this.pintarBrillo(); };

  constructor() { super("Menu"); }

  create(): void {
    const shell = this.registry.get("shell") as Shell;
    this.m = medir(this.scale.width, this.scale.height);
    this.jardin = this.add.image(0, 0, "fondo-jardin").setOrigin(0.5).setDepth(0);
    this.torreIm = this.add.image(0, 0, "torre").setOrigin(0).setDepth(50);
    this.brillo = this.add.graphics().setDepth(70);
    this.salas = [];
    this.cristales = [];
    this.cerradas = [];
    for (let i = 0; i < SALAS_MAX; i++) {
      const hab = shell.estado.habitaciones[i];
      if (hab) {
        const sv = new SalaVista(this, hab, { vivo: true, dialogos: false, grande: 2.6 });
        sv.cont.setDepth(10);
        this.salas.push(sv);
        this.cristales.push(this.add.image(0, 0, "cristal").setOrigin(0).setDepth(60));
      } else {
        this.salas.push(null);
        this.cerradas.push(this.add.image(0, 0, "sala-cerrada").setOrigin(0).setDepth(55));
      }
    }
    this.add.particles(0, 0, "fx:punto", { x: { min: 0, max: this.scale.width }, y: { min: this.scale.height * 0.55, max: this.scale.height * 0.95 }, scale: { start: 0.25, end: 0.7 }, alpha: { start: 0, end: 0.6 }, speedY: { min: -26, max: -6 }, speedX: { min: -14, max: 14 }, lifespan: 5000, frequency: 200, blendMode: "ADD", tint: 0xfff2a8 }).setDepth(3);
    this.chispas = this.add.particles(0, 0, "fx:estrella", { emitting: false, speed: { min: 80, max: 260 }, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 700, gravityY: 200, blendMode: "ADD", rotate: { min: 0, max: 360 } }).setDepth(90);
    for (let i = 0; i < 4; i++) this.nubes.push(this.add.graphics().setDepth(1));
    this.colocar();
    this.scale.on("resize", this.colocar, this);
    this.game.events.on("pt:hover", this.alHover);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.colocar, this);
      this.game.events.off("pt:hover", this.alHover);
      this.salas.forEach((s) => s?.parar());
      this.salas = [];
      this.nubes = [];
    });
  }

  private colocar(): void {
    const w = this.scale.width, h = this.scale.height;
    this.m = medir(w, h);
    const m = this.m;
    this.jardin.setPosition(w / 2, h / 2).setScale(m.s / K);
    const t = torre(m);
    this.torreIm.setPosition(t.x0, t.y0).setScale(t.sc / K);
    for (let i = 0; i < SALAS_MAX; i++) {
      const r = rectSalaPantalla(i, m);
      const sv = this.salas[i];
      if (sv) {
        const esc = r.w / DIO_W;
        sv.colocar(r.x, r.y + r.h - 760 * esc, esc);
        const cr = this.cristales[this.salas.slice(0, i + 1).filter(Boolean).length - 1];
        cr?.setPosition(r.x, r.y).setScale(r.w / (632 * 1.25));
      } else {
        const ce = this.cerradas[this.salas.slice(0, i).filter((x) => !x).length];
        ce?.setPosition(r.x, r.y).setScale(r.w / (632 * 1.25));
      }
    }
    this.pintarBrillo();
    // Nubes que cruzan el cielo
    this.nubes.forEach((g, i) => {
      g.clear().fillStyle(0xffffff, 0.8);
      const r = (24 + i * 8) * m.s;
      g.fillCircle(0, 0, r).fillCircle(r * 1.1, -r * 0.4, r * 1.2).fillCircle(r * 2.3, 0, r);
      g.setPosition(((i * 0.27 + 0.1) * w) % w, m.oy + (120 + i * 70) * m.s);
      this.tweens.killTweensOf(g);
      this.tweens.add({ targets: g, x: g.x + w * 0.3, duration: 60000 + i * 14000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  update(): void {
    this.salas.forEach((s) => s?.update());
  }

  private pintarBrillo(): void {
    const g = this.brillo;
    g.clear();
    if (!this.sobre || !this.m) return;
    if (this.sobre.startsWith("sala")) {
      const i = Number(this.sobre.slice(4));
      const r = rectSalaPantalla(i, this.m);
      g.lineStyle(8, 0xffd23f, 1);
      g.strokeRoundedRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 16);
      g.fillStyle(0xffffff, 0.08);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      this.chispas?.explode(6, r.x + r.w / 2, r.y + r.h / 2);
    }
  }
}
