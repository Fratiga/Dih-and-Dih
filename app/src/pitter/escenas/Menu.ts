import Phaser from "phaser";
import { K } from "../arte/escenarios.ts";
import { ANCHO_MANSION, HUECO, PANEL_H, PANEL_W, PASO_PISO, PISOS, SECTORES, TECHO_H } from "../arte/mansion.ts";
import { DIO_W } from "../arte/habitacion.ts";
import { sonido } from "../audio/audio.ts";
import { estrellasParaSala } from "../estado.ts";
import type { Shell } from "../shell.ts";
import { medir, type Medida } from "./medidas.ts";
import { SalaVista } from "./salaVista.ts";

/* La mansion circular. Cada piso es un anillo de SECTORES habitaciones que se puede girar; cada habitacion se ve como un tramo de pared con
   su hueco, aplastado por el coseno de su angulo (de frente a su ancho completo, de lado casi invisible) y mas oscuro cuanto mas lejos.
   Se gira arrastrando, con las flechas o con ← →, y se cambia de piso con ↑ ↓ o con la rueda. Un clic en la habitacion de enfrente la abre. */

const PASO = (Math.PI * 2) / SECTORES;
const R = 560;
const VEL_MAX = 2.6;
const norm = (a: number): number => { let x = a % (Math.PI * 2); if (x > Math.PI) x -= Math.PI * 2; if (x <= -Math.PI) x += Math.PI * 2; return x; };
const centroPiso = (f: number): number => TECHO_H + (PISOS - 1 - f) * PASO_PISO + PANEL_H / 2;

interface Panel {
  k: number;
  f: number;
  i: number;
  outer: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Image;
  sala?: SalaVista;
  dim: Phaser.GameObjects.Rectangle;
  cos: number;
}

export class Menu extends Phaser.Scene {
  private shell!: Shell;
  private m!: Medida;
  private jardin!: Phaser.GameObjects.Image;
  private mundo!: Phaser.GameObjects.Container;
  private paneles: Panel[] = [];
  private sombras: Phaser.GameObjects.Image[] = [];
  private velos: Phaser.GameObjects.Rectangle[] = [];
  private guia!: Phaser.GameObjects.Graphics;
  private th: number[] = [];
  private vel: number[] = [];
  private obj: number[] = [];
  private piso = 0;
  private mundoY = 0;
  private drag: { f: number; x0: number; y0: number; th0: number; t: number; ult: number; v: number; movido: boolean } | null = null;
  private hover = -1;
  private entrando = false;
  private escuchas: Array<[string, (...a: unknown[]) => void]> = [];
  private ultimoAviso = "";
  private desde = -1;

  constructor() { super("Menu"); }

  init(datos: { desde?: number } | undefined): void {
    this.shell = this.registry.get("shell") as Shell;
    this.desde = datos?.desde ?? -1;
    this.paneles = [];
    this.sombras = [];
    this.velos = [];
    this.drag = null;
    this.hover = -1;
    this.entrando = false;
    this.escuchas = [];
  }

  create(): void {
    const e = this.shell.estado;
    this.m = medir(this.scale.width, this.scale.height);
    this.piso = Phaser.Math.Clamp(e.mansion.piso, 0, PISOS - 1);
    this.th = e.mansion.sector.map((s) => -s * PASO);
    this.obj = [...this.th];
    this.vel = new Array(PISOS).fill(0);
    this.jardin = this.add.image(0, 0, "fondo-jardin").setOrigin(0.5).setScrollFactor(0).setDepth(0);
    this.mundo = this.add.container(0, 0).setDepth(10);
    this.mundo.add(this.add.image(0, 0, "techo-mansion").setOrigin(0.5, 0).setScale(1 / K).setDepth(-1));
    this.mundo.add(this.add.image(0, TECHO_H + PISOS * PASO_PISO - 14, "base-mansion").setOrigin(0.5, 0).setScale(1 / K).setDepth(-1));
    const hab = e.habitaciones;
    for (let f = 0; f < PISOS; f++) {
      for (let i = 0; i < SECTORES; i++) this.paneles.push(this.crearPanel(f, i, hab[f * SECTORES + i]));
      const sh = this.add.image(0, centroPiso(f), "sombra-cilindro").setScale(1 / 0.6).setDepth(f * 10 + 9);
      sh.setDisplaySize(ANCHO_MANSION, PANEL_H);
      this.sombras.push(sh);
      this.mundo.add(sh);
      const v = this.add.rectangle(0, centroPiso(f), ANCHO_MANSION, PANEL_H, 0x2a1545, 0).setDepth(f * 10 + 9.5);
      this.velos.push(v);
      this.mundo.add(v);
    }
    this.guia = this.add.graphics().setDepth(1000);
    this.mundo.add(this.guia);
    this.add.particles(0, 0, "fx:punto", { x: { min: 0, max: this.scale.width }, y: { min: this.scale.height * 0.5, max: this.scale.height }, scale: { start: 0.25, end: 0.7 }, alpha: { start: 0, end: 0.5 }, speedY: { min: -26, max: -6 }, speedX: { min: -14, max: 14 }, lifespan: 5000, frequency: 220, blendMode: "ADD", tint: 0xfff2a8 }).setScrollFactor(0).setDepth(3);
    this.colocar();
    this.mundoY = this.yObjetivo();
    this.mundo.y = this.mundoY;
    this.colocarPaneles(0);
    this.sala();

    const inp = this.input;
    inp.on("pointerdown", (p: Phaser.Input.Pointer) => this.alPulsar(p));
    inp.on("pointermove", (p: Phaser.Input.Pointer) => this.alMover(p));
    inp.on("pointerup", (p: Phaser.Input.Pointer) => this.alSoltar(p));
    inp.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.alSoltar(p));
    inp.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => { if (Math.abs(dy) > 4) this.cambiarPiso(dy > 0 ? -1 : 1); });
    this.alEscuchar("pt:girar", (d) => this.girar(Number(d)));
    this.alEscuchar("pt:piso", (d) => this.cambiarPiso(Number(d)));
    this.alEscuchar("pt:entrar-frente", () => this.entrarFrente());
    this.scale.on("resize", this.colocar, this);
    this.events.once("shutdown", () => {
      this.escuchas.forEach(([ev, fn]) => this.game.events.off(ev, fn));
      this.scale.off("resize", this.colocar, this);
      this.paneles.forEach((p) => p.sala?.parar());
      this.paneles = [];
    });
    // Al volver de una habitacion, la camara sale del zoom
    if (this.desde >= 0) this.salirDeLaHabitacion();
  }

  private alEscuchar(ev: string, fn: (...a: unknown[]) => void): void {
    this.game.events.on(ev, fn);
    this.escuchas.push([ev, fn]);
  }

  private crearPanel(f: number, i: number, hab: import("../estado.ts").Habitacion | undefined): Panel {
    const outer = this.add.container(0, centroPiso(f));
    const inner = this.add.container(-PANEL_W / 2, -PANEL_H / 2);
    let sala: SalaVista | undefined;
    if (hab) {
      sala = new SalaVista(this, hab, { vivo: true, dialogos: false, grande: 2.2 });
      const esc = HUECO.w / DIO_W;
      sala.colocar(HUECO.x, HUECO.y + HUECO.h - 760 * esc, esc);
      inner.add(sala.cont);
    } else {
      inner.add(this.add.image(HUECO.x, HUECO.y, "hueco-cerrado").setOrigin(0).setScale(1 / 1.25));
    }
    const frame = this.add.image(0, 0, "panel-sala").setOrigin(0).setScale(1 / K);
    inner.add(frame);
    const dim = this.add.rectangle(HUECO.x, HUECO.y, HUECO.w, HUECO.h, 0x2a1545, 0).setOrigin(0);
    inner.add(dim);
    outer.add(inner);
    this.mundo.add(outer);
    return { k: f * SECTORES + i, f, i, outer, frame, sala, dim, cos: 1 };
  }

  /* ---------- medidas ---------- */
  private yObjetivo(): number {
    return this.scale.height * 0.44 - centroPiso(this.piso) * this.m.s;
  }

  private colocar(): void {
    const w = this.scale.width, h = this.scale.height;
    this.m = medir(w, h);
    this.jardin.setPosition(w / 2, h / 2).setScale(this.m.s / K);
    this.mundo.setPosition(w / 2, this.mundoY).setScale(this.m.s);
  }

  /* ---------- posicion de cada habitacion segun el giro ---------- */
  private colocarPaneles(dt: number): void {
    for (const p of this.paneles) {
      const phi = norm(this.th[p.f] + p.i * PASO);
      const cos = Math.cos(phi);
      p.cos = cos;
      const visible = cos > 0.04;
      p.outer.setVisible(visible);
      if (p.sala) p.sala.cont.setVisible(visible);
      if (!visible) continue;
      p.outer.x = R * Math.sin(phi);
      p.outer.scaleX = Math.max(0.05, cos);
      p.outer.scaleY = 0.82 + 0.18 * cos;
      p.outer.setDepth(p.f * 10 + cos * 8);
      p.dim.setAlpha((1 - cos) * 0.5);
      if (p.sala && dt > 0) p.sala.update();
    }
    this.mundo.sort("depth");
  }

  private sala(): void {
    const e = this.shell.estado;
    const f = this.piso;
    const s = this.sectorDe(f);
    const k = f * SECTORES + s;
    const abierta = !!e.habitaciones[k];
    this.game.events.emit("pt:mansion", { piso: f, pisos: PISOS, sector: s, sectores: SECTORES, k, abierta, faltan: Math.max(0, estrellasParaSala(k) - this.estrellas()), nombre: abierta ? `Habitación ${k + 1}` : "Cerrada" });
  }

  private estrellas(): number {
    return Object.values(this.shell.estado.records).reduce((t, r) => t + r.estrellas, 0);
  }

  private sectorDe(f: number): number {
    return (((-Math.round(this.obj[f] / PASO)) % SECTORES) + SECTORES) % SECTORES;
  }

  /* ---------- guardar donde se queda ---------- */
  private guardarSeleccion(): void {
    const e = this.shell.estado;
    e.mansion = { piso: this.piso, sector: this.obj.map((_o, f) => this.sectorDe(f)) };
    this.shell.guardar();
  }

  /* ---------- girar y cambiar de piso ---------- */
  private girar(d: number): void {
    if (this.entrando || !d) return;
    const f = this.piso;
    this.obj[f] = Math.round(this.obj[f] / PASO) * PASO - Math.sign(d) * PASO;
    this.vel[f] = 0;
    sonido.mover();
    this.guardarSeleccion();
    this.sala();
  }

  private cambiarPiso(d: number): void {
    if (this.entrando || !d) return;
    const n = Phaser.Math.Clamp(this.piso + Math.sign(d), 0, PISOS - 1);
    if (n === this.piso) return;
    this.piso = n;
    sonido.mueble();
    this.guardarSeleccion();
    this.sala();
  }

  /* ---------- raton ---------- */
  private pisoBajo(py: number): number {
    const yd = (py - this.mundo.y) / this.m.s;
    for (let f = 0; f < PISOS; f++) if (Math.abs(yd - centroPiso(f)) <= PANEL_H / 2) return f;
    return -1;
  }

  private panelBajo(px: number, py: number): Panel | null {
    const xd = (px - this.mundo.x) / this.m.s;
    const yd = (py - this.mundo.y) / this.m.s;
    let mejor: Panel | null = null;
    for (const p of this.paneles) {
      if (p.cos <= 0.12) continue;
      const hw = (HUECO.w / 2) * p.outer.scaleX + 0.01;
      const cx = p.outer.x + (HUECO.x + HUECO.w / 2 - PANEL_W / 2) * p.outer.scaleX;
      const cy = p.outer.y + (HUECO.y + HUECO.h / 2 - PANEL_H / 2) * p.outer.scaleY;
      const hh = (HUECO.h / 2) * p.outer.scaleY;
      if (Math.abs(xd - cx) <= hw && Math.abs(yd - cy) <= hh && (!mejor || p.cos > mejor.cos)) mejor = p;
    }
    return mejor;
  }

  private alPulsar(p: Phaser.Input.Pointer): void {
    if (this.entrando) return;
    const f = this.pisoBajo(p.y);
    if (f < 0) return;
    this.drag = { f, x0: p.x, y0: p.y, th0: this.th[f], t: this.time.now, ult: p.x, v: 0, movido: false };
    this.vel[f] = 0;
  }

  private alMover(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) {
      const ph = this.panelBajo(p.x, p.y);
      this.hover = ph ? ph.k : -1;
      this.game.canvas.style.cursor = ph ? "pointer" : "default";
      return;
    }
    if (Math.abs(p.x - d.x0) > 8) d.movido = true;
    if (!d.movido) return;
    const ahora = this.time.now;
    const dtm = Math.max(1, ahora - d.t);
    const nuevo = d.th0 + (p.x - d.x0) / (R * this.m.s);
    const v = (nuevo - this.th[d.f]) / (dtm / 1000);
    d.v = d.v * 0.6 + Phaser.Math.Clamp(v, -VEL_MAX, VEL_MAX) * 0.4;
    d.t = ahora;
    this.th[d.f] = nuevo;
    this.obj[d.f] = nuevo;
    this.game.canvas.style.cursor = "grabbing";
    if (this.piso !== d.f) { this.piso = d.f; this.sala(); }
  }

  private alSoltar(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    this.game.canvas.style.cursor = "default";
    if (!d) return;
    if (!d.movido) {
      const ph = this.panelBajo(p.x, p.y);
      if (ph) this.pulsarHabitacion(ph);
      return;
    }
    const f = d.f;
    this.vel[f] = Phaser.Math.Clamp(d.v, -VEL_MAX, VEL_MAX);
    this.obj[f] = Math.round((this.th[f] + this.vel[f] * 0.22) / PASO) * PASO;
    this.piso = f;
    this.guardarSeleccion();
    this.sala();
  }

  private pulsarHabitacion(p: Panel): void {
    const e = this.shell.estado;
    if (p.f !== this.piso) { this.piso = p.f; this.guardarSeleccion(); this.sala(); }
    if (p.cos < 0.9) {
      // Primero se gira hasta ponerla al frente
      this.obj[p.f] = this.th[p.f] - norm(this.th[p.f] + p.i * PASO);
      this.guardarSeleccion();
      this.sala();
      return;
    }
    if (!e.habitaciones[p.k]) {
      const faltan = Math.max(0, estrellasParaSala(p.k) - this.estrellas());
      sonido.invalido();
      const msg = `Esta habitación se abre con ${estrellasParaSala(p.k)} estrellas. Te faltan ${faltan}.`;
      if (msg !== this.ultimoAviso) this.shell.avisar(msg);
      this.ultimoAviso = msg;
      this.time.delayedCall(2500, () => { this.ultimoAviso = ""; });
      return;
    }
    this.entrar(p);
  }

  private entrarFrente(): void {
    const f = this.piso;
    const p = this.paneles.find((q) => q.f === f && q.i === this.sectorDe(f));
    if (p) this.pulsarHabitacion(p);
  }

  /* ---------- entrar y salir: zoom de camara ---------- */
  private entrar(p: Panel): void {
    if (this.entrando) return;
    this.entrando = true;
    this.shell.ui.classList.add("saliendo");
    sonido.desbloqueo();
    const cam = this.cameras.main;
    const cx = this.mundo.x + p.outer.x * this.m.s;
    const cy = this.mundo.y + p.outer.y * this.m.s;
    cam.pan(cx, cy, 650, "Cubic.easeInOut");
    cam.zoomTo(this.zoomHasta(), 650, "Cubic.easeInOut");
    this.time.delayedCall(560, () => { void this.shell.ir("habitaciones", { indice: p.k }, "rapida"); });
  }

  private zoomHasta(): number {
    // La habitacion pasa a llenar casi todo el ancho
    return Math.min(3.2, (this.scale.width * 0.7) / (HUECO.w * this.m.s));
  }

  private salirDeLaHabitacion(): void {
    const p = this.paneles.find((q) => q.k === this.desde);
    this.desde = -1;
    if (!p) return;
    const cam = this.cameras.main;
    this.colocarPaneles(0);
    const cx = this.mundo.x + p.outer.x * this.m.s;
    const cy = this.mundo.y + p.outer.y * this.m.s;
    cam.setZoom(this.zoomHasta());
    cam.centerOn(cx, cy);
    this.time.delayedCall(80, () => {
      cam.pan(this.scale.width / 2, this.scale.height / 2, 700, "Cubic.easeOut");
      cam.zoomTo(1, 700, "Cubic.easeOut");
    });
  }

  /* ---------- bucle ---------- */
  update(_t: number, dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    for (let f = 0; f < PISOS; f++) {
      if (this.drag && this.drag.f === f && this.drag.movido) continue;
      const ya = this.th[f];
      const dif = this.obj[f] - ya;
      this.th[f] = ya + dif * (1 - Math.exp(-11 * dt)) + this.vel[f] * dt;
      this.vel[f] *= Math.pow(0.003, dt);
      if (Math.abs(dif) < 0.0005 && Math.abs(this.vel[f]) < 0.01) { this.th[f] = this.obj[f]; this.vel[f] = 0; }
    }
    // Camara vertical: va suave hacia el piso elegido
    const y = this.yObjetivo();
    this.mundoY += (y - this.mundoY) * (1 - Math.exp(-8 * dt));
    this.mundo.y = this.mundoY;
    // Los pisos que no son el elegido se ven un poco apagados
    for (let f = 0; f < PISOS; f++) {
      const a = f === this.piso ? 0 : 0.3;
      this.velos[f].setAlpha(this.velos[f].alpha + (a - this.velos[f].alpha) * (1 - Math.exp(-8 * dt)));
    }
    this.colocarPaneles(dt);
    this.dibujarGuia();
  }

  private dibujarGuia(): void {
    const g = this.guia;
    g.clear();
    if (this.entrando) return;
    const pintar = (p: Panel, color: number, grosor: number, alfa: number): void => {
      const w = HUECO.w * p.outer.scaleX, h = HUECO.h * p.outer.scaleY;
      const cx = p.outer.x + (HUECO.x + HUECO.w / 2 - PANEL_W / 2) * p.outer.scaleX;
      const cy = p.outer.y + (HUECO.y + HUECO.h / 2 - PANEL_H / 2) * p.outer.scaleY;
      g.lineStyle(grosor, color, alfa);
      g.strokeRoundedRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 12);
    };
    // La habitacion de enfrente del piso elegido
    const fr = this.paneles.find((q) => q.f === this.piso && q.i === this.sectorDe(this.piso));
    if (fr && fr.cos > 0.9) pintar(fr, 0xffd23f, 6, 0.9);
    const ph = this.paneles.find((q) => q.k === this.hover);
    if (ph && ph.cos > 0.12) { pintar(ph, 0xffffff, 5, 0.95); }
  }
}
