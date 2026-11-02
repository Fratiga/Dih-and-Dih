import Phaser from "phaser";
import { arteGlobal } from "../arte/chibis.ts";

/* El fondo animado de las pantallas que son sobre todo interfaz (coleccion, equipo, records): colores vivos y fichas que flotan. */
const TONOS: Record<string, [number, number]> = {
  coleccion: [0x6a3df0, 0xb06bff],
  equipo: [0x0fb5a8, 0x6be8d4],
  progreso: [0x2f6fe0, 0x7ac0ff],
  campana: [0xff4f9a, 0xffa86b],
};

export class Fondo extends Phaser.Scene {
  private tono: [number, number] = TONOS.coleccion;
  private grad?: Phaser.GameObjects.Graphics;
  private flotantes: Phaser.GameObjects.Image[] = [];

  constructor() { super("Fondo"); }

  init(): void {
    this.tono = TONOS[String(this.registry.get("pantalla") ?? "coleccion")] ?? TONOS.coleccion;
  }

  create(): void {
    this.grad = this.add.graphics();
    this.pintar();
    const ids = [...(arteGlobal.v?.ficha.keys() ?? [])];
    const n = ids.length ? 16 : 0;
    for (let i = 0; i < n; i++) {
      const id = ids[i % ids.length];
      const im = this.add.image(0, 0, `ficha:${id}`).setAlpha(0.2 + Math.random() * 0.18).setScale(0.5 + Math.random() * 0.9);
      im.setData("vx", (Math.random() - 0.5) * 14);
      im.setData("vy", -8 - Math.random() * 20);
      im.setData("vr", (Math.random() - 0.5) * 0.4);
      im.setPosition(Math.random() * this.scale.width, Math.random() * this.scale.height);
      im.setAngle(Math.random() * 360);
      this.flotantes.push(im);
    }
    this.add.particles(0, 0, "fx:estrella", { x: { min: 0, max: this.scale.width }, y: { min: 0, max: this.scale.height }, scale: { start: 0.1, end: 0.35 }, alpha: { start: 0.9, end: 0 }, lifespan: 2400, frequency: 160, quantity: 1, blendMode: "ADD" });
    this.scale.on("resize", this.pintar, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.pintar, this));
  }

  private pintar(): void {
    const g = this.grad;
    if (!g) return;
    const { width: w, height: h } = this.scale;
    g.clear();
    g.fillGradientStyle(this.tono[0], this.tono[0], this.tono[1], this.tono[1], 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0xffffff, 0.07);
    for (let x = -h; x < w + h; x += 140) g.fillTriangle(x, h, x + 70, h, x + 70 + h, 0), g.fillTriangle(x + 70 + h, 0, x + h, 0, x, h);
  }

  update(_t: number, dt: number): void {
    const { width: w, height: h } = this.scale;
    const d = dt / 1000;
    for (const im of this.flotantes) {
      im.x += (im.getData("vx") as number) * d;
      im.y += (im.getData("vy") as number) * d;
      im.rotation += (im.getData("vr") as number) * d;
      if (im.y < -120) { im.y = h + 120; im.x = Math.random() * w; }
      if (im.x < -120) im.x = w + 120;
      if (im.x > w + 120) im.x = -120;
    }
  }
}
