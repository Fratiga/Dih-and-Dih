import Phaser from "phaser";
import { N, REGLAS, TOTAL, Tablero, type Celda, type Paso } from "../motor/tablero.ts";
import { borrarTodoDe, usarHabilidad } from "../motor/habilidades.ts";
import { MotorLider, type Efecto } from "../motor/lider.ts";
import { liderDe } from "../datos/lideres.ts";
import { adm } from "../ui/admin.ts";
import { juntarPasivas, type ModificadoresPasivos } from "../datos/pasivas.ts";
import { JEFES, type Jefe } from "../datos/campana.ts";
import { personaje, personajesVisibles, type Personaje } from "../datos/roster.ts";
import { fondoJefe } from "../arte/escenarios.ts";
import { LADO_FICHA, mezcla } from "../arte/chibis.ts";
import { sonido } from "../audio/audio.ts";
import { desbloquearPorJefe } from "../estado.ts";
import type { Shell } from "../shell.ts";
import type { Hud } from "../ui/puzzle.ts";
import { sinergia, type Sinergia } from "../datos/sinergias.ts";

const DEPTH_TABLERO = 10;
/** Lo que pierde por segundo el medidor del Stand Up cuando no se esta borrando nada. */
const STAND_ROT = 0.012;
/** El Rush solo empieza si el jefe cae con al menos esta parte del tiempo por delante. */
const RUSH_TIEMPO_MIN = 0.3;

export interface DatosPuzzle {
  jefe: number;
  equipo: [string, string];
}

type Fase = "jugando" | "resolviendo" | "stand" | "rush" | "pausa" | "fin";

interface FichaSprite {
  cont: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Image;
  extra: Map<string, Phaser.GameObjects.Image>;
}

const dist = (a: string, b: string): number => {
  const h = (c: string): number[] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const x = h(a), y = h(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

export class Puzzle extends Phaser.Scene {
  private shell!: Shell;
  private hud!: Hud;
  private jefe!: Jefe;
  private tablero!: Tablero;
  private ids: string[] = [];
  private pj: Personaje[] = [];
  private sprites = new Map<number, FichaSprite>();
  private fase: Fase = "jugando";
  private faseAntesPausa: Fase = "jugando";

  // medidas del tablero
  private ox = 0;
  private oy = 0;
  private celda = 100;
  private lado = 600;

  // partida
  private t = 60;
  private tMax = 60;
  private vida = 1;
  private vidaMax = 1;
  private puntos = 0;
  private mejorCombo = 0;
  private cargas: [number, number] = [0, 0];
  private cargaMax: [number, number] = [20, 20];
  private stand = 0;
  private standT = 0;
  private furiaT = 0;
  private silencioT = 0;
  private aturdirT = 0;
  private rushT = 0;
  private tiempoJugado = 0;
  private relojAcum = 0;
  private hudAcum = 0;
  private temporizadoresJefe: number[] = [];
  private pendientesJefe: Array<() => Paso[]> = [];
  private drag: { id: number; idx: number; ox: number; oy: number } | null = null;
  /** Ventana del combo: segundos que quedan para que el siguiente grupo lo siga sumando. */
  private comboT = 0;
  private comboVentana = 3;
  private lider!: MotorLider;
  private liderAtaque = 1;
  private liderCarga = 1;
  /** Bloques grandes que se quedan de pie durante el Stand Up Time, por id de ficha. */
  private bloques = new Map<number, Phaser.GameObjects.Container>();
  private standMax = 14;
  private pas!: ModificadoresPasivos;
  private cierreHecho = false;
  private agotando = false;
  private ocupado = 0;
  private cola: Promise<void> = Promise.resolve();
  private habilidades = 0;
  private standUsados = 0;
  private fichasBorradas = 0;
  private terminada = false;
  private sin!: Sinergia;

  // visuales
  private fondo?: Phaser.GameObjects.Image;
  private panel!: Phaser.GameObjects.Graphics;
  private velo!: Phaser.GameObjects.Rectangle;
  private emisores: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private rayos!: Phaser.GameObjects.Graphics;
  private timers: Phaser.Time.TimerEvent[] = [];
  private escuchas: Array<[string, (...a: unknown[]) => void]> = [];

  constructor() { super("Puzzle"); }

  init(datos: DatosPuzzle): void {
    this.shell = this.registry.get("shell") as Shell;
    this.hud = this.registry.get("hud") as Hud;
    this.jefe = JEFES[Math.max(0, Math.min(JEFES.length - 1, datos.jefe))];
    const equipo = datos.equipo.map((id) => personaje(id)).filter(Boolean) as Personaje[];
    const otros = personajesVisibles().filter((p) => !datos.equipo.includes(p.id));
    // Cuatro personajes mas para completar los seis del tablero, lo mas distintos posible en color
    const elegidos: Personaje[] = [...equipo];
    const mezclados = Phaser.Utils.Array.Shuffle([...otros]);
    for (const p of mezclados) {
      if (elegidos.length >= 6) break;
      if (elegidos.every((q) => dist(q.color, p.color) > 120)) elegidos.push(p);
    }
    for (const p of mezclados) { if (elegidos.length >= 6) break; if (!elegidos.includes(p)) elegidos.push(p); }
    this.pj = elegidos;
    this.ids = elegidos.map((p) => p.id);
    this.fase = "jugando";
    this.terminada = false;
    this.sprites = new Map();
    this.drag = null;
    this.ocupado = 0;
    this.cola = Promise.resolve();
    this.pendientesJefe = [];
    this.timers = [];
    this.escuchas = [];
  }

  create(): void {
    const semilla = (Date.now() ^ (this.jefe.id.length * 7919)) >>> 0;
    this.pas = juntarPasivas([this.pj[0].id, this.pj[1].id]);
    this.tablero = new Tablero({ semilla, tipos: this.ids.length, equipo: [0, 1], atqEquipo: [this.pj[0].atq * (1 + this.pas.ataquePropio[0]), this.pj[1].atq * (1 + this.pas.ataquePropio[1])] });
    this.tMax = this.jefe.tiempo + this.pas.tiempoInicial;
    this.t = this.tMax;
    this.vidaMax = this.vida = this.jefe.vida;
    this.puntos = 0;
    this.mejorCombo = 0;
    this.cargas = [0, 0];
    this.sin = sinergia(this.pj[0], this.pj[1]);
    this.cargaMax = [0, 1].map((i) => this.pj[i].habilidad.carga * (1 - 0.02 * (this.shell.estado.niveles[this.pj[i].id] ?? 0)) * this.sin.carga) as [number, number];
    this.stand = 0; this.standT = 0; this.furiaT = 0; this.silencioT = 0; this.aturdirT = 0; this.rushT = 0;
    this.tiempoJugado = 0; this.habilidades = 0; this.standUsados = 0; this.fichasBorradas = 0;
    this.temporizadoresJefe = this.jefe.fases.map((f) => f.cada * 0.75);
    this.comboT = 0;
    this.cierreHecho = false;
    this.agotando = false;
    this.lider = new MotorLider(liderDe(this.pj[0].id));
    this.liderAtaque = 1;
    this.liderCarga = 1;
    this.bloques = new Map();

    this.panel = this.add.graphics().setDepth(DEPTH_TABLERO - 2);
    this.rayos = this.add.graphics().setDepth(DEPTH_TABLERO + 40);
    this.velo = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setDepth(DEPTH_TABLERO + 30);
    this.crearEmisores();
    this.crearFondo();
    this.medir();
    for (let i = 0; i < TOTAL; i++) this.crearSprite(this.tablero.celdas[i], i, false);
    this.entradaInicial();
    this.layout();
    this.configurarEntrada();
    this.alEscuchar("pt:habilidad", (slot) => void this.pedirHabilidad(slot as 0 | 1));
    this.alEscuchar("pt:admin", (d) => void this.accionAdmin(d as { accion: string; valor?: { clave: string; valor: boolean } }));
    this.alEscuchar("pt:pausa", () => this.pausar(true));
    this.alEscuchar("pt:reanudar", () => this.pausar(false));
    this.scale.on("resize", this.alRedimensionar, this);
    this.events.once("shutdown", () => this.limpiar());
    this.hud.vida(this.vida, this.vidaMax);
    this.hud.tiempo(this.t, this.tMax);
    this.hud.combo(0, 1, 0);
    this.hud.puntos(0);
    this.hud.carga(0, 0, Math.ceil(this.cargaMax[0]));
    this.hud.carga(1, 0, Math.ceil(this.cargaMax[1]));
    this.hud.stand(0, false, 0);
    this.hud.banner(this.jefe.nombre, "aviso", this.jefe.frase);
    const l = this.lider.lider;
    this.hud.lider(l ? l.nombre : "", l ? l.texto : "");
    this.fase = "jugando";
  }

  private alEscuchar(ev: string, fn: (...a: unknown[]) => void): void {
    this.game.events.on(ev, fn);
    this.escuchas.push([ev, fn]);
  }

  private limpiar(): void {
    for (const [ev, fn] of this.escuchas) this.game.events.off(ev, fn);
    this.escuchas = [];
    this.scale.off("resize", this.alRedimensionar, this);
    this.timers.forEach((x) => x.remove());
    this.sprites.clear();
  }

  /* ---------- medidas y fondo ---------- */
  private zona(): { x: number; y: number; w: number; h: number } {
    const el = document.getElementById("pt-zona-tablero");
    if (el) { const r = el.getBoundingClientRect(); if (r.width > 40) return { x: r.left, y: r.top, w: r.width, h: r.height }; }
    const w = this.scale.width, h = this.scale.height;
    return { x: w * 0.2, y: h * 0.18, w: w * 0.6, h: h * 0.62 };
  }

  private medir(): void {
    const z = this.zona();
    this.lado = Math.floor(Math.min(z.w, z.h));
    this.celda = this.lado / N;
    this.ox = z.x + (z.w - this.lado) / 2;
    this.oy = z.y + (z.h - this.lado) / 2;
  }

  private alRedimensionar(): void {
    window.clearTimeout((this as unknown as { _r?: number })._r);
    (this as unknown as { _r?: number })._r = window.setTimeout(() => { this.crearFondo(); this.medir(); this.layout(); }, 60);
  }

  private crearFondo(): void {
    const w = this.scale.width, h = this.scale.height;
    const clave = `fondo-jefe:${this.jefe.id}`;
    if (this.textures.exists(clave)) this.textures.remove(clave);
    this.textures.addCanvas(clave, fondoJefe(this.jefe, w, h));
    if (!this.fondo) this.fondo = this.add.image(0, 0, clave).setOrigin(0).setDepth(0);
    else this.fondo.setTexture(clave);
    this.fondo.setPosition(0, 0).setDisplaySize(w, h);
    this.velo.setSize(w, h);
  }

  private crearEmisores(): void {
    this.emisores = this.pj.map((p) => this.add.particles(0, 0, "fx:estrella", {
      emitting: false, speed: { min: 120, max: 380 }, scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: { min: 350, max: 700 }, gravityY: 420,
      rotate: { min: 0, max: 360 }, tint: parseInt(mezcla(p.color, "#ffffff", 0.2).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_m, r, g, b) => ((Number(r) << 16) | (Number(g) << 8) | Number(b)).toString()), 10) || 0xffffff,
      blendMode: "ADD",
    }).setDepth(DEPTH_TABLERO + 20));
    this.add.particles(0, 0, "fx:punto", { x: { min: 0, max: this.scale.width }, y: { min: 0, max: this.scale.height }, scale: { start: 0.2, end: 0.5 }, alpha: { start: 0, end: 0.45 }, speedY: { min: -18, max: -6 }, lifespan: 5000, frequency: 280, blendMode: "ADD", tint: 0xffffff }).setDepth(1);
  }

  /* ---------- sprites de fichas ---------- */
  private centro(idx: number): { x: number; y: number } {
    return { x: this.ox + ((idx % N) + 0.5) * this.celda, y: this.oy + (Math.floor(idx / N) + 0.5) * this.celda };
  }

  private escalaFicha(): number {
    return (this.celda * 0.94) / LADO_FICHA;
  }

  private texturaDe(c: Celda): string {
    if (c.bloque > 0) return `esp:bloque${Math.min(3, c.bloque)}`;
    if (c.caja) return "esp:caja";
    if (c.tinta) return "esp:tinta";
    return `ficha:${this.ids[c.tipo]}`;
  }

  private crearSprite(c: Celda, idx: number, animar: boolean, desdeY?: number): FichaSprite {
    const p = this.centro(idx);
    const cont = this.add.container(p.x, desdeY ?? p.y).setDepth(DEPTH_TABLERO + (idx / TOTAL));
    const base = this.add.image(0, 0, this.texturaDe(c)).setScale(this.escalaFicha());
    cont.add(base);
    const s: FichaSprite = { cont, base, extra: new Map() };
    this.sprites.set(c.id, s);
    this.decorar(c, s);
    if (animar && desdeY === undefined) cont.setScale(0);
    return s;
  }

  /** Marcas encima de la ficha: reforzada (estrella), congelada (hielo) y de pie (halo). */
  private decorar(c: Celda, s: FichaSprite): void {
    const quita = (k: string): void => { s.extra.get(k)?.destroy(); s.extra.delete(k); };
    const pon = (k: string, tex: string, x: number, y: number, esc: number, blend?: Phaser.BlendModes): void => {
      if (s.extra.has(k)) return;
      const im = this.add.image(x, y, tex).setScale(esc);
      if (blend !== undefined) im.setBlendMode(blend);
      s.cont.add(im);
      s.extra.set(k, im);
      this.tweens.add({ targets: im, scale: esc * 1.2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    };
    const e = this.escalaFicha();
    if (c.reforzada && c.bloque === 0 && !c.caja) pon("ref", "fx:estrella", this.celda * 0.32, -this.celda * 0.32, e * 0.9); else quita("ref");
    if (c.congelada) pon("hielo", "esp:hielo", 0, 0, e); else quita("hielo");
    if (c.stand) pon("stand", "fx:brillo", 0, 0, e * 2.2, Phaser.BlendModes.ADD); else quita("stand");
  }

  private refrescar(c: Celda): void {
    const s = this.sprites.get(c.id);
    if (!s) return;
    const tex = this.texturaDe(c);
    if (s.base.texture.key !== tex) s.base.setTexture(tex);
    s.base.setScale(this.escalaFicha());
    this.decorar(c, s);
  }

  private layout(): void {
    const p = this.panel;
    p.clear();
    const m = this.celda * 0.12;
    const x = this.ox - m, y = this.oy - m, s = this.lado + m * 2;
    p.fillStyle(0x2a1545, 0.35); p.fillRoundedRect(x + 4, y + 12, s, s, 34);
    p.fillStyle(0xfff6e5, 0.96); p.fillRoundedRect(x, y, s, s, 34);
    p.fillStyle(0xffe9c4, 1);
    for (let i = 0; i < TOTAL; i++) { if (((i % N) + Math.floor(i / N)) % 2 === 0) p.fillRoundedRect(this.ox + (i % N) * this.celda + 3, this.oy + Math.floor(i / N) * this.celda + 3, this.celda - 6, this.celda - 6, 14); }
    p.lineStyle(7, 0x2a1545, 1); p.strokeRoundedRect(x, y, s, s, 34);
    for (const [id, sp] of this.sprites) {
      const idx = this.tablero.celdas.findIndex((c) => c.id === id);
      if (idx < 0) continue;
      const q = this.centro(idx);
      if (!this.drag || this.drag.id !== id) sp.cont.setPosition(q.x, q.y);
      sp.base.setScale(this.escalaFicha());
    }
  }

  private entradaInicial(): void {
    let i = 0;
    for (const [, s] of this.sprites) {
      const y = s.cont.y;
      s.cont.setY(y - this.lado * 0.9).setAlpha(0);
      this.tweens.add({ targets: s.cont, y, alpha: 1, duration: 520, delay: 40 * (i % N) + 30 * Math.floor(i / N), ease: "Bounce.easeOut" });
      i++;
    }
  }

  /* ---------- entrada del jugador ---------- */
  private celdaEn(x: number, y: number, limitar = false): number {
    let cx = Math.floor((x - this.ox) / this.celda);
    let cy = Math.floor((y - this.oy) / this.celda);
    if (limitar) { cx = Phaser.Math.Clamp(cx, 0, N - 1); cy = Phaser.Math.Clamp(cy, 0, N - 1); }
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return -1;
    return cy * N + cx;
  }

  private puedeJugar(): boolean {
    return (this.fase === "jugando" || this.fase === "stand" || this.fase === "rush") && this.ocupado === 0 && !this.terminada;
  }

  /* Se puede agarrar una ficha aunque aun se este animando una cascada, siempre que esa ficha ya este quieta en su sitio. */
  private puedeAgarrar(): boolean {
    return (this.fase === "jugando" || this.fase === "resolviendo" || this.fase === "stand" || this.fase === "rush") && !this.terminada;
  }

  private fichaQuieta(idx: number): FichaSprite | null {
    const c = this.tablero.celdas[idx];
    if (!c) return null;
    const s = this.sprites.get(c.id);
    if (!s || this.tweens.isTweening(s.cont) || s.cont.alpha < 0.99) return null;
    const q = this.centro(idx);
    return Math.hypot(s.cont.x - q.x, s.cont.y - q.y) < this.celda * 0.2 ? s : null;
  }

  private configurarEntrada(): void {
    const inp = this.input;
    inp.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.puedeAgarrar() || this.drag) return;
      const idx = this.celdaEn(p.x, p.y);
      if (idx < 0) return;
      const c = this.tablero.celdas[idx];
      const s = this.fichaQuieta(idx);
      if (!s) return;
      if (c.caja) { void this.tocarCaja(idx); return; }
      if (!this.tablero.puedeMover(idx)) { sonido.invalido(); this.sacudir(c.id); return; }
      this.drag = { id: c.id, idx, ox: s.cont.x - p.x, oy: s.cont.y - p.y };
      s.cont.setDepth(DEPTH_TABLERO + 60);
      this.tweens.add({ targets: s.cont, scale: 1.14, duration: 90, ease: "Back.easeOut" });
      sonido.agarrar();
    });
    inp.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d) return;
      const s = this.sprites.get(d.id);
      if (!s) return;
      // La ficha sigue al dedo hacia donde sea. Las que pisa se apartan un hueco, una a una, camino de la casilla en la que esta el dedo.
      const lim = this.celda * 0.4;
      s.cont.setPosition(Phaser.Math.Clamp(p.x + d.ox, this.ox - lim, this.ox + this.lado + lim), Phaser.Math.Clamp(p.y + d.oy, this.oy - lim, this.oy + this.lado + lim));
      const objetivo = this.celdaEn(p.x, p.y, true);
      let guard = 0;
      while (objetivo !== d.idx && guard++ < 8) {
        const cx = d.idx % N, cy = Math.floor(d.idx / N), tx = objetivo % N, ty = Math.floor(objetivo / N);
        const paso = Math.abs(tx - cx) >= Math.abs(ty - cy) ? cy * N + cx + Math.sign(tx - cx) : (cy + Math.sign(ty - cy)) * N + cx;
        // Si la de al lado aun se esta moviendo (cae de una cascada) no se la puede apartar
        const so = this.fichaQuieta(paso);
        if (!so || !this.tablero.intercambiar(d.idx, paso)) break;
        const q = this.centro(d.idx);
        this.tweens.add({ targets: so.cont, x: q.x, y: q.y, duration: 90, ease: "Quad.easeOut" });
        d.idx = paso;
        sonido.mover();
      }
    });
    const soltar = (): void => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      const s = this.sprites.get(d.id);
      if (s) {
        const q = this.centro(d.idx);
        s.cont.setDepth(DEPTH_TABLERO + d.idx / TOTAL);
        this.tweens.add({ targets: s.cont, x: q.x, y: q.y, scale: 1, duration: 110, ease: "Back.easeOut" });
      }
      sonido.soltar();
      void this.resolverTablero();
    };
    inp.on("pointerup", soltar);
    inp.on("pointerupoutside", soltar);
  }

  private sacudir(id: number): void {
    const s = this.sprites.get(id);
    if (!s) return;
    const x = s.cont.x;
    this.tweens.add({ targets: s.cont, x: { from: x - 8, to: x + 8 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => s.cont.setX(x) });
  }

  /* ---------- resolver y animar ---------- */
  private async resolverTablero(): Promise<void> {
    if (this.fase === "pausa" || this.terminada) return;
    const pasos = this.tablero.resolver(this.furiaT > 0 ? 1.5 : 1);
    if (pasos.length) await this.reproducir(pasos);
    this.armarCombo();
    this.despuesDeResolver();
  }

  private despuesDeResolver(): void {
    if (this.terminada) return;
    this.revisarStand();
    void this.ejecutarPendientesJefe();
  }

  private async tocarCaja(idx: number): Promise<void> {
    this.ocupado++;
    sonido.caja();
    const pasos = this.tablero.tocarCaja(idx);
    await this.reproducir(pasos);
    this.ocupado--;
    this.armarCombo();
    this.despuesDeResolver();
  }

  /* El combo sigue vivo mientras haya tiempo en su ventana. Cada grupo la reinicia. */
  private armarCombo(): void {
    const t = this.tablero;
    if (t.combo > 0) { this.comboVentana = t.ventanaCombo() + this.pas.ventanaCombo; this.comboT = this.comboVentana; }
    this.hud.combo(t.combo, t.multCombo(), t.combo > 0 ? 1 : 0);
  }

  /* Las animaciones van en cola: se puede mover una ficha mientras aun se anima la cascada anterior, y lo que salga de ahi se
     reproduce cuando acabe la anterior. El tablero ya esta resuelto por dentro desde el primer momento. */
  private reproducir(pasos: Paso[]): Promise<void> {
    this.ocupado++;
    const correr = async (): Promise<void> => {
      const faseAntes = this.fase;
      if (this.fase === "jugando") this.fase = "resolviendo";
      for (const p of pasos) {
        await this.paso(p);
        if (this.terminada) break;
      }
      this.ocupado--;
      if (this.fase === "resolviendo" && this.ocupado === 0) this.fase = faseAntes === "resolviendo" ? "jugando" : faseAntes;
      if (this.vida <= 0 && !this.terminada) await this.ganar();
    };
    const siguiente = this.cola.then(correr, correr);
    this.cola = siguiente.catch(() => undefined);
    return siguiente;
  }

  private espera(ms: number): Promise<void> {
    return new Promise((res) => { this.timers.push(this.time.delayedCall(this.shell.estado.ajustes.movimientoReducido ? ms * 0.5 : ms, res)); });
  }

  /* Termina cuando acaba la animacion o, por si la ficha se destruye por el camino y la animacion se pierde, un poco despues de lo previsto.
     Asi una animacion perdida no deja la cola de pasos esperando para siempre. */
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => {
      let hecho = false;
      const fin = (): void => { if (!hecho) { hecho = true; res(); } };
      this.tweens.add({ ...cfg, onComplete: fin });
      const dur = Number(cfg.duration ?? 0) + Number(cfg.delay ?? 0) * 1 + 450;
      this.time.delayedCall(dur * (cfg.yoyo ? 2 : 1), fin);
    });
  }

  private idxDe(id: number): number {
    return this.tablero.celdas.findIndex((c) => c && c.id === id);
  }

  private async paso(p: Paso): Promise<void> {
    switch (p.k) {
      case "borrar": return this.pasoBorrar(p);
      case "caer": {
        const ts = p.mov.map((m) => {
          const s = this.sprites.get(m.id);
          if (!s) return Promise.resolve();
          const j = this.idxDe(m.id);
          const q = this.centro(j >= 0 ? j : m.a);
          return this.tween({ targets: s.cont, x: q.x, y: q.y, duration: 300, ease: "Bounce.easeOut" });
        });
        sonido.caer();
        await Promise.all(ts);
        return;
      }
      case "entrar": {
        const ts = p.nuevas.map((n) => {
          const idx = this.idxDe(n.id);
          if (idx < 0) return Promise.resolve();
          const c = this.tablero.celdas[idx];
          const fila = Math.floor(n.desde / N);
          const y0 = this.oy + (fila + 0.5) * this.celda;
          const s = this.crearSprite(c, idx, false, y0);
          const q = this.centro(idx);
          return this.tween({ targets: s.cont, y: q.y, duration: 340, ease: "Bounce.easeOut", delay: 25 * (n.idx % N) });
        });
        await Promise.all(ts);
        return;
      }
      case "convertir": {
        sonido.cargada();
        await Promise.all(p.cambios.map((cb, i) => {
          const s = this.sprites.get(cb.id);
          if (!s) return Promise.resolve();
          return this.tween({ targets: s.cont, scaleX: 0, duration: 110, delay: i * 14, yoyo: true, onYoyo: () => { const idx = this.idxDe(cb.id); if (idx >= 0) this.refrescar(this.tablero.celdas[idx]); } });
        }));
        await this.espera(60);
        return;
      }
      case "reforzar": {
        sonido.cargada();
        for (const id of p.ids) { const idx = this.idxDe(id); if (idx >= 0) this.refrescar(this.tablero.celdas[idx]); const s = this.sprites.get(id); if (s) this.tweens.add({ targets: s.cont, scale: 1.25, duration: 120, yoyo: true }); }
        await this.espera(220);
        return;
      }
      case "barajar": {
        sonido.habilidad();
        await Promise.all(p.mov.map((m) => {
          const s = this.sprites.get(m.id);
          if (!s) return Promise.resolve();
          const j = this.idxDe(m.id);
          const q = this.centro(j >= 0 ? j : m.a);
          return this.tween({ targets: s.cont, x: q.x, y: q.y, angle: 360, duration: 480, ease: "Cubic.easeInOut", onComplete: () => s.cont.setAngle(0) });
        }));
        return;
      }
      case "crear": {
        sonido.caja();
        await Promise.all(p.cajas.map((cj) => {
          const idx = this.idxDe(cj.id);
          if (idx >= 0) this.refrescar(this.tablero.celdas[idx]);
          const s = this.sprites.get(cj.id);
          return s ? this.tween({ targets: s.cont, scale: { from: 1.5, to: 1 }, duration: 320, ease: "Bounce.easeOut" }) : Promise.resolve();
        }));
        return;
      }
      case "poner": {
        sonido.aviso();
        await Promise.all(p.bloques.map((b, i) => {
          const idx = this.idxDe(b.id);
          if (idx >= 0) this.refrescar(this.tablero.celdas[idx]);
          const s = this.sprites.get(b.id);
          return s ? this.tween({ targets: s.cont, scale: { from: 1.7, to: 1 }, alpha: { from: 0.2, to: 1 }, duration: 300, delay: i * 80, ease: "Back.easeIn" }) : Promise.resolve();
        }));
        this.cameras.main.shake(120, 0.004);
        return;
      }
      case "estado": {
        sonido.aviso();
        for (const id of p.ids) { const idx = this.idxDe(id); if (idx >= 0) this.refrescar(this.tablero.celdas[idx]); const s = this.sprites.get(id); if (s) this.tweens.add({ targets: s.cont, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => s.cont.setAngle(0) }); }
        await this.espera(260);
        return;
      }
      case "limpiarObstaculos": {
        for (const id of p.ids) { const idx = this.idxDe(id); if (idx >= 0) this.refrescar(this.tablero.celdas[idx]); }
        await this.espera(120);
        return;
      }
      case "estallar": return this.pasoEstallar(p);
      case "efecto": return this.efecto(p.nombre, p.ids);
    }
  }

  private async pasoBorrar(p: Extract<Paso, { k: "borrar" }>): Promise<void> {
    const mayor = p.grupos.reduce((m, g) => Math.max(m, g.celdas.length), 0);
    this.mejorCombo = Math.max(this.mejorCombo, p.combo);
    this.hud.combo(p.combo, p.mult, 1);
    this.comboT = this.comboVentana = this.tablero.ventanaCombo() + this.pas.ventanaCombo;
    for (const g of p.grupos) this.lider.alGrupo(g.celdas.length);
    // Cargas de las habilidades y del Stand Up
    let n = 0;
    for (const [tipo, k] of Object.entries(p.cargas)) {
      const t = Number(tipo);
      n += k;
      for (const slot of [0, 1] as const) this.cargas[slot] = Math.min(this.cargaMax[slot], this.cargas[slot] + (t === slot ? k * (1 + this.pas.cargaPropia[slot]) : k * REGLAS.cargaAjena) * this.liderCarga);
    }
    this.fichasBorradas += n;
    this.cargas.forEach((c, i) => this.hud.carga(i as 0 | 1, c / this.cargaMax[i], Math.ceil(this.cargaMax[i] - c)));
    if (this.fase !== "stand") this.stand = Math.min(1, this.stand + (n / 42) * this.sin.stand * (1 + this.pas.standGana));
    this.hud.stand(this.stand, this.fase === "stand", this.standT);
    if (p.combo >= 2) this.texto(`${p.combo} combo`, this.ox + this.lado / 2, this.oy + this.celda * 0.4, p.combo >= 10 ? "#ffd23f" : "#ff4f9a", 0.9 + Math.min(0.9, p.combo * 0.05), true);

    if (this.fase === "stand" || this.tablero.modoStand) {
      // En Stand Up Time las fichas no se borran: los grupos se juntan en un bloque grande y se quedan de pie.
      sonido.borrar(p.combo, mayor);
      this.standT = Math.min(this.standMax, this.standT + 0.9 * p.grupos.length);
      const pliegues = p.grupos.map((g) => this.plegar(g, true));
      this.hud.banner(`Pozo ${Math.round(this.tablero.pozoStand)}`, "stand", `Cuadrados: ${this.tablero.cuadradosStand()}`);
      await Promise.all(pliegues);
      return;
    }

    sonido.borrar(p.combo, mayor);
    const cuerpo: Promise<void>[] = [];
    for (const g of p.grupos) cuerpo.push(this.plegar(g, false));
    // Lo que no es de un grupo (bloques rotos, fichas borradas por una habilidad) desaparece sin mas
    const enGrupo = new Set(p.grupos.flatMap((g) => g.ids));
    for (const id of p.ids) {
      if (enGrupo.has(id)) continue;
      const s = this.sprites.get(id);
      if (!s) continue;
      this.emisores[Phaser.Math.Between(0, this.emisores.length - 1)]?.explode(3, s.cont.x, s.cont.y);
      cuerpo.push(this.tween({ targets: s.cont, scale: { from: 1.15, to: 0 }, angle: Phaser.Math.Between(-90, 90), alpha: 0, duration: 230, ease: "Back.easeIn" }));
    }
    for (const id of p.golpeados) {
      if (p.rotos.includes(id)) continue;
      const idx = this.idxDe(id);
      if (idx >= 0) this.refrescar(this.tablero.celdas[idx]);
      this.sacudir(id);
    }
    for (const cj of p.cajas) {
      const idx = this.idxDe(cj.id);
      if (idx >= 0) this.refrescar(this.tablero.celdas[idx]);
      const s = this.sprites.get(cj.id);
      if (s) cuerpo.push(this.tween({ targets: s.cont, scale: { from: 1.6, to: 1 }, duration: 330, ease: "Bounce.easeOut", delay: 380 }));
      sonido.caja();
    }
    if (mayor >= 6) this.cameras.main.shake(110, 0.004);
    this.golpearJefe(p.dano, p.combo);
    await Promise.all(cuerpo);
    for (const id of p.ids) { this.sprites.get(id)?.cont.destroy(); this.sprites.delete(id); }
    if (this.vida <= 0) return;
  }

  /* ---------- bloques grandes ---------- */
  private numColor(c: string): number {
    return parseInt(c.slice(1), 16);
  }

  /** Las fichas del grupo se pliegan hacia su centro y una pieza grande las sustituye. Si no se queda, el bloque sale disparado hacia el jefe. */
  private async plegar(g: Extract<Paso, { k: "borrar" }>["grupos"][number], quedarse: boolean): Promise<void> {
    const col = this.pj[g.tipo]?.color ?? "#ffffff";
    const cj = g.caja;
    let cx = 0, cy = 0;
    if (g.rect) { cx = this.ox + ((cj.x0 + cj.x1 + 1) / 2) * this.celda; cy = this.oy + ((cj.y0 + cj.y1 + 1) / 2) * this.celda; }
    else { for (const i of g.celdas) { const q = this.centro(i); cx += q.x; cy += q.y; } cx /= g.celdas.length; cy /= g.celdas.length; }
    const w = g.rect ? (cj.x1 - cj.x0 + 1) * this.celda : Math.sqrt(g.celdas.length) * this.celda * 1.04;
    const h = g.rect ? (cj.y1 - cj.y0 + 1) * this.celda : w;
    this.emisores[g.tipo]?.explode(4, cx, cy);
    await Promise.all(g.ids.map((id) => {
      const s = this.sprites.get(id);
      if (!s) return Promise.resolve();
      return this.tween({ targets: s.cont, x: cx, y: cy, scale: 0.7, duration: 150, ease: "Quad.easeIn" });
    }));
    const bloque = this.crearBloque(g.tipo, col, w, h, cx, cy);
    if (quedarse) {
      for (const id of g.ids) { const s = this.sprites.get(id); if (s) s.cont.setAlpha(0); this.bloques.set(id, bloque); }
      return;
    }
    await this.espera(110);
    await this.lanzarBloque(bloque, g.tipo);
  }

  private crearBloque(tipo: number, color: string, w: number, h: number, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.numColor(color);
    const fondo = this.add.graphics();
    fondo.fillStyle(c, 1); fondo.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12);
    fondo.fillStyle(0xffffff, 0.28); fondo.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h * 0.32, Math.min(w, h) * 0.1);
    fondo.lineStyle(7, 0x2a1545, 1); fondo.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12);
    const aura = this.add.image(0, 0, "fx:brillo").setBlendMode(Phaser.BlendModes.ADD).setTint(c).setAlpha(0.8);
    aura.setDisplaySize(w * 1.7, h * 1.7);
    const clave = `chibi:${this.ids[tipo]}:poder`;
    const arte = this.add.image(0, h * 0.05, this.textures.exists(clave) ? clave : `ficha:${this.ids[tipo]}`);
    arte.setScale((Math.min(w, h) * 0.9) / Math.max(arte.width, arte.height));
    const cont = this.add.container(x, y, [aura, fondo, arte]).setDepth(DEPTH_TABLERO + 45).setScale(0.55).setData("tipo", tipo);
    this.tweens.add({ targets: cont, scale: 1, duration: 230, ease: "Back.easeOut" });
    this.tweens.add({ targets: aura, alpha: { from: 0.5, to: 0.95 }, duration: 520, yoyo: true, repeat: -1 });
    return cont;
  }

  private posJefe(): { x: number; y: number } {
    const el = document.querySelector<HTMLElement>(".pt-jefe-retrato img");
    if (el) { const r = el.getBoundingClientRect(); if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: this.ox + this.lado / 2, y: this.oy - this.celda };
  }

  /** El bloque grande se encoge y una bola de su color vuela hacia el jefe. */
  private async lanzarBloque(bloque: Phaser.GameObjects.Container, tipo: number): Promise<void> {
    const dest = this.posJefe();
    const c = this.numColor(this.pj[tipo]?.color ?? "#ffffff");
    const bola = this.add.image(bloque.x, bloque.y, "fx:brillo").setBlendMode(Phaser.BlendModes.ADD).setTint(c).setDepth(DEPTH_TABLERO + 55);
    bola.setDisplaySize(this.celda * 1.1, this.celda * 1.1);
    this.tweens.add({ targets: bloque, scale: 1.25, alpha: 0, duration: 240, ease: "Quad.easeOut", onComplete: () => bloque.destroy() });
    await this.tween({ targets: bola, x: dest.x, y: dest.y, scale: bola.scale * 0.45, duration: 300, ease: "Quad.easeIn" });
    this.emisores[tipo]?.explode(8, dest.x, dest.y);
    bola.destroy();
    this.hud.jefeGolpe();
  }

  private golpearJefe(dano: number, combo: number): void {
    if (dano <= 0 || this.terminada) return;
    if (this.fase === "rush") { this.puntos += Math.round(dano * 2); this.hud.puntos(this.puntos); return; }
    dano *= this.liderAtaque * (adm.danoX10 ? 10 : 1);
    this.vida = Math.max(0, this.vida - dano);
    this.puntos += Math.round(dano) + combo * 3;
    this.hud.vida(this.vida, this.vidaMax);
    this.hud.puntos(this.puntos);
    this.texto(`-${Math.round(dano)}`, this.ox + this.lado * (0.2 + Math.random() * 0.6), this.oy + this.celda * 0.2, "#ffffff", 0.7, true);
  }

  private texto(s: string, x: number, y: number, color: string, escala = 0.6, grande = false): void {
    const t = this.add.text(x, y, s, { fontFamily: '"Lilita One", sans-serif', fontSize: `${Math.round(this.celda * (grande ? 0.52 : 0.46))}px`, color, stroke: "#2a1545", strokeThickness: Math.max(6, Math.round(this.celda * 0.1)) }).setOrigin(0.5).setDepth(DEPTH_TABLERO + 50).setScale(escala * 0.4);
    this.tweens.add({ targets: t, scale: escala * 1.3, duration: 180, ease: "Back.easeOut" });
    this.tweens.add({ targets: t, y: y - this.celda * 0.9, alpha: 0, duration: 760, delay: 280, ease: "Quad.easeIn", onComplete: () => t.destroy() });
  }

  private async pasoEstallar(p: Extract<Paso, { k: "estallar" }>): Promise<void> {
    sonido.estalla();
    this.destello(0xffffff, 0.8, 280);
    const grandes = [...new Set(this.bloques.values())];
    for (const b of grandes) this.tweens.add({ targets: b, scale: 1.2, duration: 120, yoyo: true });
    for (const id of p.ids) {
      const s = this.sprites.get(id);
      if (s && s.cont.alpha > 0) this.tweens.add({ targets: s.cont, scale: 1.3, duration: 120, yoyo: true });
    }
    await this.espera(260);
    const todos: Promise<void>[] = [];
    for (const id of p.ids) {
      const s = this.sprites.get(id);
      if (!s) continue;
      if (s.cont.alpha > 0) this.emisores[Phaser.Math.Between(0, this.emisores.length - 1)]?.explode(4, s.cont.x, s.cont.y);
      todos.push(this.tween({ targets: s.cont, scale: 0, alpha: 0, angle: Phaser.Math.Between(-180, 180), duration: 300, ease: "Back.easeIn" }));
    }
    grandes.forEach((b, i) => { todos.push(this.espera(i * 90).then(() => this.lanzarBloque(b, b.getData("tipo") as number))); });
    this.bloques.clear();
    this.cameras.main.shake(380, 0.012);
    this.golpearJefe(p.dano, 0);
    this.texto(`¡${Math.round(p.dano * this.liderAtaque)}!`, this.ox + this.lado / 2, this.oy + this.lado / 2, "#ffd23f", 1.6, true);
    if (p.cuadrados > 0) this.texto(`×${(1 + p.cuadrados * 0.5).toFixed(1)} cuadrados`, this.ox + this.lado / 2, this.oy + this.lado * 0.62, "#1ed7c8", 0.8);
    await Promise.all(todos);
    for (const id of p.ids) { this.sprites.get(id)?.cont.destroy(); this.sprites.delete(id); }
  }

  private destello(color: number, alpha: number, ms: number): void {
    this.velo.setFillStyle(color, alpha);
    this.tweens.add({ targets: this.velo, alpha: { from: alpha, to: 0 }, duration: ms, ease: "Quad.easeOut" });
  }

  private async efecto(nombre: string, ids?: number[]): Promise<void> {
    const g = this.rayos;
    const dur = 360;
    const trazo = (x0: number, y0: number, x1: number, y1: number, color: number): void => {
      g.lineStyle(this.celda * 0.55, color, 0.85); g.lineBetween(x0, y0, x1, y1);
      g.lineStyle(this.celda * 0.2, 0xffffff, 1); g.lineBetween(x0, y0, x1, y1);
    };
    sonido.habilidad();
    g.clear(); g.setAlpha(1);
    const col = this.pj[0].color;
    const c = parseInt(col.slice(1), 16);
    if (nombre === "columna" && ids?.length) { const i = this.idxDe(ids[0]); const q = this.centro(i); trazo(q.x, this.oy, q.x, this.oy + this.lado, c); }
    else if (nombre === "cruz" && ids?.length) { const i = this.idxDe(ids[0]); const q = this.centro(i); void q; for (const id of ids) { const j = this.idxDe(id); if (j < 0) continue; } const c0 = this.centro(this.idxDe(ids[0])); trazo(c0.x, this.oy, c0.x, this.oy + this.lado, c); const c1 = this.centro(this.idxDe(ids[1])); trazo(this.ox, c1.y, this.ox + this.lado, c1.y, c); }
    else if (nombre === "diagonales" && ids?.length) { const xs = ids.map((id) => this.centro(this.idxDe(id))); xs.forEach((q) => this.emisores[0]?.explode(1, q.x, q.y)); trazo(this.ox, this.oy, this.ox + this.lado, this.oy + this.lado, c); trazo(this.ox + this.lado, this.oy, this.ox, this.oy + this.lado, c); }
    else if (nombre === "tipo" && ids) { ids.forEach((id) => { const s = this.sprites.get(id); if (s) this.tweens.add({ targets: s.cont, scale: 1.3, duration: 140, yoyo: true }); }); }
    else if (nombre === "tiempo") { this.texto("+tiempo", this.ox + this.lado / 2, this.oy + this.lado / 2, "#1ed7c8", 1, true); this.destello(0x1ed7c8, 0.35, 300); }
    else if (nombre === "furia") { this.destello(0xff5252, 0.4, 400); }
    else if (nombre === "aturdir") { this.destello(0xffc93c, 0.3, 300); }
    else if (nombre === "sacrificio") { this.destello(0xff4f9a, 0.4, 400); }
    this.tweens.add({ targets: g, alpha: 0, duration: dur, delay: 100, onComplete: () => g.clear() });
    await this.espera(nombre === "tiempo" || nombre === "furia" || nombre === "aturdir" ? 260 : 340);
  }

  /* ---------- habilidades ---------- */
  private async pedirHabilidad(slot: 0 | 1): Promise<void> {
    if (!this.puedeJugar() || this.drag || this.fase === "rush") return;
    if (this.cargas[slot] < this.cargaMax[slot] - 0.001) { sonido.invalido(); this.hud.banner("Todavía no está cargada", "aviso"); return; }
    if (this.silencioT > 0) { sonido.invalido(); this.hud.banner("Silenciado", "aviso"); return; }
    const p = this.pj[slot];
    this.cargas[slot] = 0;
    this.hud.carga(slot, 0, Math.ceil(this.cargaMax[slot]));
    this.habilidades++;
    this.ocupado++;
    this.hud.habilidad(slot, p.nombre, p.habilidad.nombre);
    this.hud.expresion(slot, "poder");
    sonido.habilidad();
    this.destello(parseInt(p.color.slice(1), 16), 0.5, 500);
    await this.espera(650);
    const e = usarHabilidad(this.tablero, p.habilidad.verbo, p.habilidad.n, slot, p.habilidad.nombre);
    if (e.tiempo) { this.t = Math.max(1, Math.min(this.tMax + 15, this.t + e.tiempo)); this.hud.tiempo(this.t, this.tMax); }
    if (e.furia) this.furiaT = e.furia.segundos;
    if (e.stand) this.stand = Math.min(1, this.stand + e.stand / 100);
    if (e.aturdir) this.aturdirT = e.aturdir;
    if (e.combo) { this.tablero.combo += e.combo; this.armarCombo(); }
    this.hud.stand(this.stand, false, 0);
    this.ocupado--;
    await this.reproducir(e.pasos);
    this.armarCombo();
    this.hud.expresion(slot, "idle");
    this.despuesDeResolver();
  }

  /* ---------- Stand Up Time ---------- */
  private revisarStand(): void {
    if (this.fase !== "jugando" || this.stand < 1 || this.terminada || this.vida <= 0) return;
    this.fase = "stand";
    this.standUsados++;
    this.standT = 9;
    this.tablero.entrarStand();
    sonido.standUp();
    sonido.musica("stand");
    this.destello(0xffd23f, 0.7, 500);
    this.cameras.main.shake(260, 0.01);
    this.hud.banner("¡STAND UP TIME!", "stand", "Las fichas se quedan de pie. Haz cuadrados.");
    this.hud.stand(1, true, this.standT);
    this.tweens.add({ targets: this.fondo, alpha: { from: 1, to: 0.7 }, duration: 400, yoyo: false });
    this.velo.setFillStyle(0x7a4cff, 0);
    this.pintarPanelStand(true);
  }

  private pintarPanelStand(si: boolean): void {
    this.tweens.killTweensOf(this.velo);
    if (si) this.tweens.add({ targets: this.velo, alpha: { from: 0.05, to: 0.22 }, duration: 600, yoyo: true, repeat: -1 });
    else { this.velo.setAlpha(0); this.fondo?.setAlpha(1); }
  }

  private async terminarStand(): Promise<void> {
    if (this.fase !== "stand") return;
    if (this.drag) { this.drag = null; }
    this.fase = "resolviendo";
    this.pintarPanelStand(false);
    this.hud.stand(0, false, 0);
    this.stand = 0;
    sonido.musica("puzzle");
    const pasos = this.tablero.salirStand();
    await this.reproducir(pasos);
    this.armarCombo();
    if (this.fase === "resolviendo") this.fase = "jugando";
    this.despuesDeResolver();
  }

  /* ---------- jefe ---------- */
  private atacarJefe(i: number): void {
    const f = this.jefe.fases[i];
    this.hud.banner(f.aviso, "aviso");
    this.hud.jefeAtaca(f.aviso);
    sonido.aviso();
    const vida = this.jefe.vida > 6000 ? 2 : 1;
    this.pendientesJefe.push(() => [f.tipo === "bloques" ? this.tablero.ponerBloques(f.n, vida) : this.tablero.ponerEstado(f.n, f.tipo === "congelar" ? "congelada" : "tinta")]);
    void this.ejecutarPendientesJefe();
  }

  private async ejecutarPendientesJefe(): Promise<void> {
    if (!this.pendientesJefe.length || this.drag || this.ocupado > 0 || this.fase === "pausa" || this.fase === "fin" || this.terminada) return;
    if (this.fase === "stand") return;
    const f = this.pendientesJefe.shift() as () => Paso[];
    await this.reproducir(f());
    this.despuesDeResolver();
  }

  /* ---------- final ---------- */
  /* Al acabarse el tiempo o caer el jefe, cada medidor de habilidad que este lleno borra todas las fichas de su personaje y suma puntos. */
  private async cierreMedidores(): Promise<void> {
    if (this.cierreHecho) return;
    this.cierreHecho = true;
    for (const slot of [0, 1] as const) {
      if (this.cargas[slot] < this.cargaMax[slot] - 0.001) continue;
      this.cargas[slot] = 0;
      this.hud.carga(slot, 0, Math.ceil(this.cargaMax[slot]));
      const p = this.pj[slot];
      this.hud.habilidad(slot, p.nombre, "Medidor lleno");
      sonido.habilidad();
      this.destello(parseInt(p.color.slice(1), 16), 0.45, 400);
      await this.espera(450);
      await this.reproducir(borrarTodoDe(this.tablero, slot, p.nombre).pasos);
    }
  }

  private enRush(): boolean {
    return this.fase === "rush";
  }

  private async agotarTiempo(): Promise<void> {
    this.agotando = true;
    await this.cierreMedidores();
    if (this.terminada) return;
    if (this.vida <= 0) await this.ganar(true);
    else await this.perder();
  }

  /* Al caer el jefe con tiempo de sobra empieza el Rush: unos segundos en los que se sigue juntando fichas, sin obstaculos ni piezas especiales, y los puntos valen doble. */
  private async ganar(final = false): Promise<void> {
    if (this.terminada) return;
    if (!final) {
      if (this.fase === "rush") return;
      await this.cierreMedidores();
      if (this.terminada || this.enRush()) return;
      if (this.t < this.tMax * RUSH_TIEMPO_MIN) { await this.ganar(true); return; }
      this.fase = "rush";
      this.rushT = 5;
      this.pintarPanelStand(false);
      this.hud.stand(0, false, 0);
      this.hud.banner("¡RUSH!", "rush", "El jefe cae con tiempo de sobra. Sigue juntando fichas, valen doble.");
      this.hud.jefeCae();
      this.hud.expresion(0, "poder"); this.hud.expresion(1, "poder");
      sonido.standUp();
      this.destello(0xff4f9a, 0.6, 500);
      this.cameras.main.shake(260, 0.008);
      void this.reproducir(this.tablero.limpiarParaRush());
      return;
    }
    this.terminada = true;
    this.pintarPanelStand(false);
    sonido.parar();
    sonido.victoria();
    this.hud.banner("¡Derrotado!", "victoria", this.jefe.nombre);
    this.hud.jefeCae();
    this.hud.expresion(0, "feliz"); this.hud.expresion(1, "feliz");
    this.destello(0xffffff, 0.8, 600);
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 90, () => this.emisores[i % this.emisores.length]?.explode(10, Phaser.Math.Between(this.ox, this.ox + this.lado), Phaser.Math.Between(this.oy, this.oy + this.lado)));
    await this.espera(1600);
    sonido.jingle("assets/cosas/Happy Wheels victory.mp3");
    this.cerrar(true);
  }

  private async perder(): Promise<void> {
    if (this.terminada) return;
    this.terminada = true;
    this.pintarPanelStand(false);
    sonido.parar();
    sonido.derrota();
    this.hud.banner("¡Se acabó el tiempo!", "derrota", this.jefe.nombre);
    this.hud.expresion(0, "dolor"); this.hud.expresion(1, "dolor");
    this.cameras.main.shake(300, 0.006);
    await this.espera(1500);
    this.cerrar(false);
  }

  private cerrar(gano: boolean): void {
    const e = this.shell.estado;
    const segundos = this.tMax - this.t;
    const estrellas = !gano ? 0 : this.t >= this.tMax * 0.42 ? 3 : this.t >= this.tMax * 0.17 ? 2 : 1;
    e.stats.partidas++;
    e.stats.tiempo += Math.round(this.tiempoJugado);
    e.stats.fichas += this.fichasBorradas;
    e.stats.habilidades += this.habilidades;
    e.stats.standUp += this.standUsados;
    e.stats.mejorCombo = Math.max(e.stats.mejorCombo, this.mejorCombo);
    let nuevos: string[] = [];
    let mueble = "";
    if (gano) {
      e.stats.victorias++;
      nuevos = desbloquearPorJefe(e, this.jefe.id);
      if (this.jefe.mueble && !e.muebles.includes(this.jefe.mueble)) { e.muebles.push(this.jefe.mueble); mueble = this.jefe.mueble; }
      const r = e.records[this.jefe.id] ?? { puntos: 0, mejorTiempo: 0, estrellas: 0, combo: 0 };
      r.puntos = Math.max(r.puntos, this.puntos);
      r.mejorTiempo = r.mejorTiempo ? Math.min(r.mejorTiempo, Math.round(segundos)) : Math.round(segundos);
      r.estrellas = Math.max(r.estrellas, estrellas);
      r.combo = Math.max(r.combo, this.mejorCombo);
      e.records[this.jefe.id] = r;
      for (const id of this.ids.slice(0, 2)) e.niveles[id] = Math.min(10, (e.niveles[id] ?? 0) + (estrellas >= 3 ? 1 : 0));
    } else e.stats.derrotas++;
    this.shell.guardar(true);
    this.hud.resultado({ gano, jefe: this.jefe, puntos: this.puntos, estrellas, segundos: Math.round(segundos), combo: this.mejorCombo, nuevos, mueble, habilidades: this.habilidades, standUp: this.standUsados });
    this.fase = "fin";
  }

  /* ---------- pausa ---------- */
  private pausar(si: boolean): void {
    if (this.terminada) return;
    if (si && this.fase !== "pausa") { this.faseAntesPausa = this.fase; this.fase = "pausa"; this.tweens.pauseAll(); this.time.paused = true; }
    else if (!si && this.fase === "pausa") { this.fase = this.faseAntesPausa; this.tweens.resumeAll(); this.time.paused = false; void this.ejecutarPendientesJefe(); }
  }

  /* ---------- bucle ---------- */
  update(_t: number, dtMs: number): void {
    if (this.fase === "pausa" || this.terminada) return;
    const dt = dtMs / 1000;
    this.tickLider(dt);
    if (adm.cargaInfinita) this.llenarMedidores();
    if (this.fase === "stand") {
      this.standT -= dt;
      this.hudAcum += dt;
      if (this.hudAcum > 0.1) { this.hudAcum = 0; this.hud.stand(1, true, Math.max(0, this.standT)); }
      if (this.standT <= 0 && this.ocupado === 0 && !this.drag) void this.terminarStand();
      return;
    }
    if (this.fase === "rush") {
      this.rushT -= dt;
      if (this.rushT <= 0 && this.ocupado === 0 && !this.drag) void this.ganar(true);
      return;
    }
    this.tiempoJugado += dt;
    // Tiempo
    if (!adm.relojParado) this.t -= dt;
    if (this.t <= 10 && this.t > 0) { this.relojAcum += dt; if (this.relojAcum >= 1) { this.relojAcum = 0; sonido.reloj(); } }
    this.hudAcum += dt;
    if (this.hudAcum > 0.1) {
      this.hudAcum = 0;
      this.hud.tiempo(Math.max(0, this.t), this.tMax);
      if (this.comboT > 0) this.hud.combo(this.tablero.combo, this.tablero.multCombo(), Math.max(0, this.comboT / this.comboVentana));
      if (this.stand < 1 && this.stand > 0) this.hud.stand(this.stand, false, 0);
    }
    // La ventana del combo corre mientras no se esta resolviendo nada
    if (this.comboT > 0 && this.ocupado === 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.comboT = 0; this.tablero.reiniciarCombo(); this.hud.combo(0, 1, 0); }
    }
    // El medidor del Stand Up se va perdiendo si nadie lo alimenta
    if (this.stand > 0 && this.stand < 1 && this.comboT <= 0 && this.ocupado === 0) this.stand = Math.max(0, this.stand - dt * STAND_ROT);
    if (this.furiaT > 0) { this.furiaT -= dt; }
    if (this.silencioT > 0) { this.silencioT -= dt; if (this.silencioT <= 0) this.hud.silencio(false); }
    if (this.aturdirT > 0) { this.aturdirT -= dt; }
    else if (!this.agotando && !adm.sinAtaques) this.jefe.fases.forEach((f, i) => {
      this.temporizadoresJefe[i] += dt;
      if (this.temporizadoresJefe[i] >= f.cada) { this.temporizadoresJefe[i] = 0; this.atacarJefe(i); }
    });
    if (this.t <= 0 && !this.agotando && this.ocupado === 0 && !this.drag) { this.t = 0; void this.agotarTiempo(); }
  }

  /* ---------- habilidad de lider ---------- */
  private tickLider(dt: number): void {
    const l = this.lider.lider;
    if (!l) return;
    const r = this.lider.actualizar(dt, { puntos: this.puntos, combo: this.tablero.combo, vidaFrac: this.vida / this.vidaMax, tiempoRestante: this.t, tiempoJugado: this.tiempoJugado, stand: this.fase === "stand" });
    this.liderAtaque = r.ataque;
    this.liderCarga = r.cargaMult;
    if (r.recienActivo) this.hud.banner(l.nombre, "aviso", l.texto);
    for (const e of r.unicos) this.aplicarEfectoLider(e);
  }

  private aplicarEfectoLider(e: Efecto): void {
    const l = this.lider.lider;
    if (!l) return;
    this.hud.banner(l.nombre, "aviso", l.texto);
    sonido.cargada();
    switch (e.t) {
      case "carga":
        for (const slot of [0, 1] as const) { this.cargas[slot] = Math.min(this.cargaMax[slot], this.cargas[slot] + this.cargaMax[slot] * e.pct); this.hud.carga(slot, this.cargas[slot] / this.cargaMax[slot], Math.ceil(this.cargaMax[slot] - this.cargas[slot])); }
        break;
      case "tiempo":
        this.t = Math.max(1, Math.min(this.tMax + 15, this.t + e.s));
        this.hud.tiempo(this.t, this.tMax);
        break;
      case "stand":
        if (this.fase !== "stand") { this.stand = Math.min(1, this.stand + e.pct); this.hud.stand(this.stand, false, 0); }
        break;
      case "combo":
        this.tablero.combo += e.n;
        this.armarCombo();
        break;
      case "convertir":
        this.pendientesJefe.push(() => usarHabilidad(this.tablero, "convertirAzar", e.n, 0, l.nombre).pasos);
        void this.ejecutarPendientesJefe();
        break;
      default:
        break;
    }
  }

  /* ---------- herramientas de admin ---------- */
  private llenarMedidores(): void {
    for (const slot of [0, 1] as const) {
      if (this.cargas[slot] >= this.cargaMax[slot]) continue;
      this.cargas[slot] = this.cargaMax[slot];
      this.hud.carga(slot, 1, 0);
    }
  }

  private async accionAdmin(d: { accion: string; valor?: { clave: string; valor: boolean } }): Promise<void> {
    if (this.terminada) return;
    const t = this.tablero;
    switch (d.accion) {
      case "interruptor": if (d.valor && d.valor.clave === "cargaInfinita" && d.valor.valor) this.llenarMedidores(); break;
      case "cargar": this.llenarMedidores(); break;
      case "stand": this.stand = 1; this.hud.stand(1, false, 0); this.revisarStand(); break;
      case "tiempo": this.t = this.t + 30; this.tMax = Math.max(this.tMax, this.t); this.hud.tiempo(this.t, this.tMax); break;
      case "combo": t.combo += 10; this.armarCombo(); break;
      case "jefe10": this.vida = this.vidaMax * 0.1; this.hud.vida(this.vida, this.vidaMax); break;
      case "curar": this.vida = this.vidaMax; this.hud.vida(this.vida, this.vidaMax); break;
      case "matar": this.vida = 0; this.hud.vida(0, this.vidaMax); void this.ganar(); break;
      case "perder": this.t = 0; break;
      case "ataque": if (this.jefe.fases.length) this.atacarJefe(0); else this.hud.banner("Este jefe no ataca", "aviso"); break;
      case "bloques": this.pendientesJefe.push(() => [t.ponerBloques(3, 2)]); void this.ejecutarPendientesJefe(); break;
      case "hielo": this.pendientesJefe.push(() => [t.ponerEstado(4, "congelada")]); void this.ejecutarPendientesJefe(); break;
      case "tinta": this.pendientesJefe.push(() => [t.ponerEstado(4, "tinta")]); void this.ejecutarPendientesJefe(); break;
      case "caja": {
        const cand = t.indicesDe((c) => c.bloque === 0 && !c.caja && !c.stand);
        if (!cand.length) break;
        const i = cand[Math.floor(Math.random() * cand.length)];
        t.celdas[i].caja = true;
        t.celdas[i].reforzada = false;
        await this.reproducir([{ k: "crear", cajas: [{ id: t.celdas[i].id, idx: i }] }]);
        break;
      }
      case "limpiar": await this.reproducir(t.limpiarParaRush()); break;
      default: break;
    }
  }
}
