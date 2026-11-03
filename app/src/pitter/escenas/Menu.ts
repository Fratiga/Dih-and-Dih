import Phaser from "phaser";
import { K } from "../arte/escenarios.ts";
import { atlasCaras } from "../arte/caras.ts";
import { ANCHO_HUECO, BASE_H, PASO_PISO, PISOS, SECTORES, TECHO_ALTO } from "../arte/mansion.ts";
import { sonido } from "../audio/audio.ts";
import { estrellasParaSala, type Habitacion } from "../estado.ts";
import type { Shell } from "../shell.ts";
import { Corona3D, Cuarto3D, bordePiso, centroFrontal, fijarCamara, semiancho } from "./cuarto3d.ts";
import { medir, type Medida } from "./medidas.ts";
import { SalaVista, tema } from "./salaVista.ts";

/* La mansion circular, vista como un edificio de verdad. Cada piso es un anillo de SECTORES habitaciones; cada habitacion es una caja 3D (ver cuarto3d.ts)
   que se ve por el hueco de su fachada, en perspectiva, segun el angulo en el que este. Las de los lados se ven de lado, con sus paredes y su suelo.
   Se gira arrastrando, con las flechas o con ← →, y se cambia de piso con ↑ ↓ o con la rueda. Un clic en la habitacion de enfrente la abre. */

const PASO = (Math.PI * 2) / SECTORES;
const R_ARRASTRE = 600;
const VEL_MAX = 2.6;
const norm = (a: number): number => { let x = a % (Math.PI * 2); if (x > Math.PI) x -= Math.PI * 2; if (x <= -Math.PI) x += Math.PI * 2; return x; };
const acotar = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

interface Panel {
  k: number;
  f: number;
  i: number;
  cuarto: Cuarto3D;
  sala?: SalaVista;
  cos: number;
}

export class Menu extends Phaser.Scene {
  private shell!: Shell;
  private m!: Medida;
  private jardin!: Phaser.GameObjects.Image;
  private mundo!: Phaser.GameObjects.Container;
  private techo!: Corona3D;
  private base!: Corona3D;
  private paneles: Panel[] = [];
  private guia!: Phaser.GameObjects.Graphics;
  private th: number[] = [];
  private vel: number[] = [];
  private obj: number[] = [];
  private luz: number[] = [];
  private piso = 0;
  private pisoAnim = 0;
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
    this.drag = null;
    this.hover = -1;
    this.entrando = false;
    this.escuchas = [];
  }

  create(): void {
    const e = this.shell.estado;
    this.m = medir(this.scale.width, this.scale.height);
    this.piso = Phaser.Math.Clamp(e.mansion.piso, 0, PISOS - 1);
    this.pisoAnim = this.piso;
    this.th = e.mansion.sector.map((s) => -s * PASO);
    this.obj = [...this.th];
    this.vel = new Array(PISOS).fill(0);
    this.luz = Array.from({ length: PISOS }, (_v, f) => (f === this.piso ? 1 : 0.7));
    this.jardin = this.add.image(0, 0, "fondo-jardin").setOrigin(0.5).setScrollFactor(0).setDepth(0);
    this.mundo = this.add.container(0, 0).setDepth(10);
    // La base gira con el primer piso y el tejado con el ultimo
    this.techo = new Corona3D(this, "mansion-techo", "techo");
    this.base = new Corona3D(this, "mansion-base", "base");
    this.techo.malla.setDepth(-10);
    this.base.malla.setDepth(-10);
    this.mundo.add([this.techo.malla, this.base.malla]);
    const hab = e.habitaciones;
    for (let f = 0; f < PISOS; f++) for (let i = 0; i < SECTORES; i++) this.paneles.push(this.crearPanel(f, i, hab[f * SECTORES + i]));
    this.guia = this.add.graphics().setDepth(1000);
    this.mundo.add(this.guia);
    this.add.particles(0, 0, "fx:punto", { x: { min: 0, max: this.scale.width }, y: { min: this.scale.height * 0.5, max: this.scale.height }, scale: { start: 0.25, end: 0.7 }, alpha: { start: 0, end: 0.5 }, speedY: { min: -26, max: -6 }, speedX: { min: -14, max: 14 }, lifespan: 5000, frequency: 220, blendMode: "ADD", tint: 0xfff2a8 }).setScrollFactor(0).setDepth(3);
    this.colocar();
    this.colocarPaneles();
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
    // Los personajes se dibujan en su sitio de pantalla y vuelven a su sitio del diorama en cuanto acaba el fotograma
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.restaurar, this);
    this.scale.on("resize", this.colocar, this);
    this.events.once("shutdown", () => {
      this.escuchas.forEach(([ev, fn]) => this.game.events.off(ev, fn));
      this.game.events.off(Phaser.Core.Events.POST_RENDER, this.restaurar, this);
      this.scale.off("resize", this.colocar, this);
      this.paneles.forEach((p) => p.sala?.parar());
      this.paneles = [];
    });
    // Al volver de una habitacion, la camara sale del zoom
    if (this.desde >= 0) this.salirDeLaHabitacion();
  }

  private restaurar(): void {
    for (const p of this.paneles) p.sala?.restaurar();
  }

  private alEscuchar(ev: string, fn: (...a: unknown[]) => void): void {
    this.game.events.on(ev, fn);
    this.escuchas.push([ev, fn]);
  }

  private crearPanel(f: number, i: number, hab: Habitacion | undefined): Panel {
    const t = tema(hab?.fondo ?? "rombos");
    const clave = `cara:${t.id}`;
    if (!this.textures.exists(clave)) this.textures.addCanvas(clave, atlasCaras(t));
    const cuarto = new Cuarto3D(this, f, i, !!hab, clave);
    let sala: SalaVista | undefined;
    if (hab) {
      sala = new SalaVista(this, hab, { vivo: true, dialogos: false, silencio: true, sinFondo: true, grande: 2.2 });
      sala.proy = (x, y, suelo) => cuarto.proy(x, y, suelo);
      sala.cont.setDepth(1000000);
      cuarto.grupo.add(sala.cont);
      cuarto.grupo.sort("depth");
    }
    this.mundo.add(cuarto.grupo);
    return { k: f * SECTORES + i, f, i, cuarto, sala, cos: 1 };
  }

  /* ---------- medidas ---------- */
  private colocar(): void {
    const w = this.scale.width, h = this.scale.height;
    this.m = medir(w, h);
    this.jardin.setPosition(w / 2, h / 2).setScale(this.m.s / K);
    this.mundo.setPosition(w / 2, h * 0.44).setScale(this.m.s);
    fijarCamara(this.pisoAnim);
    this.shell.ui.style.setProperty("--pt-semi", `${Math.round(semiancho() * this.m.s)}px`);
  }

  /* ---------- posicion de cada habitacion segun el giro y la camara ---------- */
  private colocarPaneles(): void {
    fijarCamara(this.pisoAnim);
    const s = this.m.s;
    const yMin = -this.mundo.y / s - 160, yMax = (this.scale.height - this.mundo.y) / s + 160;
    for (const p of this.paneles) {
      const phi = norm(this.th[p.f] + p.i * PASO);
      const cos = Math.cos(phi);
      p.cos = cos;
      const luz = this.luz[p.f] * (0.5 + 0.5 * acotar((cos - 0.2) / 0.75, 0, 1));
      p.cuarto.grupo.setDepth(p.f * 10 + cos * 8);
      if (p.cuarto.actualizar(phi, luz, yMin, yMax)) p.sala?.proyectar();
    }
    this.techo.actualizar(this.th[PISOS - 1], this.luz[PISOS - 1]);
    this.base.actualizar(this.th[0], this.luz[0]);
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
  private aMundo(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.mundo.x) / this.m.s, y: (py - this.mundo.y) / this.m.s };
  }

  private pisoBajo(py: number): number {
    const yd = this.aMundo(0, py).y;
    // La base se mueve con el primer piso y el tejado con el ultimo
    if (yd > bordePiso(0, false) && yd < bordePiso(0, false) + BASE_H) return 0;
    if (yd < bordePiso(PISOS - 1, true) && yd > bordePiso(PISOS - 1, true) - TECHO_ALTO) return PISOS - 1;
    let mejor = -1, dist = PASO_PISO / 2;
    for (let f = 0; f < PISOS; f++) {
      const d = Math.abs(yd - centroFrontal(f).y);
      if (d <= dist) { dist = d; mejor = f; }
    }
    return mejor;
  }

  private panelBajo(px: number, py: number): Panel | null {
    const q = this.aMundo(px, py);
    let mejor: Panel | null = null;
    for (const p of this.paneles) {
      if (p.cos <= 0.2 || !p.cuarto.contiene(q.x, q.y)) continue;
      if (!mejor || p.cos > mejor.cos) mejor = p;
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
    const nuevo = d.th0 + (p.x - d.x0) / (R_ARRASTRE * this.m.s);
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
    const c = p.cuarto.centro();
    cam.pan(this.mundo.x + c.x * this.m.s, this.mundo.y + c.y * this.m.s, 650, "Cubic.easeInOut");
    cam.zoomTo(this.zoomHasta(), 650, "Cubic.easeInOut");
    this.time.delayedCall(560, () => { void this.shell.ir("habitaciones", { indice: p.k }, "rapida"); });
  }

  private zoomHasta(): number {
    // La habitacion pasa a llenar casi todo el ancho
    return Math.min(3.2, (this.scale.width * 0.7) / (ANCHO_HUECO * this.m.s));
  }

  private salirDeLaHabitacion(): void {
    const p = this.paneles.find((q) => q.k === this.desde);
    this.desde = -1;
    if (!p) return;
    const cam = this.cameras.main;
    this.colocarPaneles();
    const c = p.cuarto.centro();
    cam.setZoom(this.zoomHasta());
    cam.centerOn(this.mundo.x + c.x * this.m.s, this.mundo.y + c.y * this.m.s);
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
    // La camara sube o baja con suavidad hasta el piso elegido y los otros pisos se apagan un poco
    this.pisoAnim += (this.piso - this.pisoAnim) * (1 - Math.exp(-8 * dt));
    if (Math.abs(this.piso - this.pisoAnim) < 0.0005) this.pisoAnim = this.piso;
    for (let f = 0; f < PISOS; f++) this.luz[f] += ((f === this.piso ? 1 : 0.7) - this.luz[f]) * (1 - Math.exp(-8 * dt));
    this.colocarPaneles();
    this.dibujarGuia();
  }

  private dibujarGuia(): void {
    const g = this.guia;
    g.clear();
    if (this.entrando) return;
    const contorno = (p: Panel, color: number, grosor: number, alfa: number): void => {
      const q = p.cuarto.hueco;
      g.lineStyle(grosor, color, alfa);
      g.beginPath();
      g.moveTo(q[0], q[1]);
      for (let k = 1; k < 4; k++) g.lineTo(q[k * 2], q[k * 2 + 1]);
      g.closePath();
      g.strokePath();
    };
    // La habitacion de enfrente del piso elegido
    const fr = this.paneles.find((q) => q.f === this.piso && q.i === this.sectorDe(this.piso));
    if (fr && fr.cos > 0.9 && fr.cuarto.visible) contorno(fr, 0xffd23f, 6, 0.9);
    const ph = this.paneles.find((q) => q.k === this.hover);
    if (ph && ph.cos > 0.2 && ph.cuarto.visible) contorno(ph, 0xffffff, 5, 0.95);
  }
}
