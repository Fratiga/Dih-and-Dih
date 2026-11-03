/* La escena de la habitacion: dibuja el corte del laboratorio, los objetos y las criaturas, lleva la camara y hace avanzar la simulacion
   (a la velocidad que se elija). La escena solo representa lo que pasa en la simulacion: no decide nada. */

import Phaser from "phaser";
import { AJ } from "../nucleo/ajustes.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import type { Criatura } from "../nucleo/criatura.ts";
import type { Objeto } from "../nucleo/mundo.ts";
import { C } from "../nucleo/tipos.ts";
import { sonido } from "../audio/audio.ts";
import { crearObjetos, icono, type Sprite } from "../arte/objetos.ts";
import { lienzoCriatura, actualizarVista, nuevaVista, pintarCriatura, type Vista } from "../arte/criatura.ts";
import { pintarFrente, pintarHalo, pintarHaz, pintarPared, pintarPunto, pintarSuelo } from "../arte/fondo.ts";
import { ESCALA, MUNDO_H, MUNDO_W, SUELO_Y, px, unidades } from "../arte/medidas.ts";
import { Juego } from "../juego.ts";

const PIES = SUELO_Y + 12;
const DT = AJ.dt;

interface SprCriatura {
  img: Phaser.GameObjects.Image;
  sombra: Phaser.GameObjects.Image;
  tex: Phaser.Textures.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  etiqueta: Phaser.GameObjects.Text;
  aro: Phaser.GameObjects.Image;
  burbuja: Phaser.GameObjects.Container;
  burbujaClave: string;
  burbujaAlpha: number;
  ultT: number;
  ultDano: number;
  proxRonquido: number;
  proxVoz: number;
  durmiendo: boolean;
  x: number;
  y: number;
}

interface SprObjeto {
  img: Phaser.GameObjects.Image;
  sombra: Phaser.GameObjects.Image;
  extra: Phaser.GameObjects.Image[];
  tipo: string;
  nace: number;
  rot: number;
  ultX: number;
  aterrizo: boolean;
  chispa: number;
}

export class Laboratorio extends Phaser.Scene {
  juego!: Juego;
  vistas = new Map<number, Vista>();
  private crit = new Map<number, SprCriatura>();
  private objs = new Map<number, SprObjeto>();
  private arte: Record<string, Sprite> = {};
  private acc = 0;
  private prevC = new Map<number, number>();
  private prevO = new Map<number, number>();
  private autoguardado = 0;
  private noche?: Phaser.GameObjects.Rectangle;
  private luces: { img: Phaser.GameObjects.Image; base: number; fase: number; vel: number }[] = [];
  private baliza?: Phaser.GameObjects.Image;
  private chispas?: Phaser.GameObjects.Particles.ParticleEmitter;
  private migas?: Phaser.GameObjects.Particles.ParticleEmitter;
  private premios?: Phaser.GameObjects.Particles.ParticleEmitter;
  private zoomActual = 0.5;
  private centro = { x: MUNDO_W / 2, y: MUNDO_H / 2 };
  private arrastre: { id: number | null; tipo: string; ghost: Phaser.GameObjects.Image | null } | null = null;
  private tiempoReal = 0;
  private cuadro = 0;
  enTitulo = true;
  colocando: string | null = null;
  lista = false;

  constructor() { super("Laboratorio"); }

  create(): void {
    const reg = this.registry.get("juego") as Juego;
    this.juego = reg;
    const t = this.textures;
    t.addCanvas("v:pared", pintarPared());
    t.addCanvas("v:suelo", pintarSuelo());
    t.addCanvas("v:frente", pintarFrente());
    t.addCanvas("v:halo", pintarHalo());
    t.addCanvas("v:haz", pintarHaz());
    t.addCanvas("v:punto", pintarPunto());
    this.arte = crearObjetos();
    for (const [k, s] of Object.entries(this.arte)) t.addCanvas(`o:${k}`, s.cv);
    for (const k of Object.keys(CATALOGO)) if (this.arte[k]) t.addCanvas(`i:${k}`, icono(k, this.arte, 96));
    // Una sombra suave para todo lo que pisa el suelo
    const sc = document.createElement("canvas"); sc.width = 128; sc.height = 32;
    const sx = sc.getContext("2d") as CanvasRenderingContext2D;
    const gr = sx.createRadialGradient(64, 16, 2, 64, 16, 62); gr.addColorStop(0, "rgba(0,0,0,0.7)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = gr; sx.save(); sx.scale(1, 0.26); sx.fillRect(0, 0, 128, 128); sx.restore();
    t.addCanvas("v:sombra", sc);
    const ar = document.createElement("canvas"); ar.width = 256; ar.height = 64;
    const ax = ar.getContext("2d") as CanvasRenderingContext2D;
    ax.strokeStyle = "rgba(70,217,232,0.9)"; ax.lineWidth = 3; ax.beginPath(); ax.ellipse(128, 32, 118, 22, 0, 0, Math.PI * 2); ax.stroke();
    ax.strokeStyle = "rgba(70,217,232,0.25)"; ax.lineWidth = 8; ax.beginPath(); ax.ellipse(128, 32, 124, 26, 0, 0, Math.PI * 2); ax.stroke();
    t.addCanvas("v:aro", ar);

    this.add.image(0, 0, "v:pared").setOrigin(0, 0).setDepth(0);
    this.add.image(0, SUELO_Y, "v:suelo").setOrigin(0, 0).setDepth(10);
    this.add.image(0, 0, "v:frente").setOrigin(0, 0).setDepth(100);
    this.noche = this.add.rectangle(0, 0, MUNDO_W, MUNDO_H, 0x03101c, 0).setOrigin(0, 0).setDepth(150);

    // Luces: suman encima (mezcla aditiva)
    const luz = (x: number, y: number, esc: number, color: number, alpha: number, vel = 0, tex = "v:halo"): Phaser.GameObjects.Image => {
      const im = this.add.image(x, y, tex).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setAlpha(alpha).setScale(esc).setDepth(160);
      if (vel) this.luces.push({ img: im, base: alpha, fase: Math.random() * 6, vel });
      return im;
    };
    luz(640, 330, 7.5, 0xffb35c, 0.45, 0.6);
    luz(640, 340, 2.4, 0xffd9a0, 0.5, 0.9);
    for (const x of [400, 1050, 1700, 2250]) {
      luz(x, 125, 3, 0xbfeaf2, 0.35, 0.3);
      this.add.image(x, 130, "v:haz").setBlendMode(Phaser.BlendModes.ADD).setTint(0xbfeaf2).setAlpha(0.07).setScale(2.4, 2.6).setOrigin(0.5, 0).setDepth(160);
    }
    for (const x of [1960, 2230, 2470]) luz(x, 700, x === 2470 ? 4.5 : 6.5, x === 2230 ? 0x46d9e8 : 0x7cf08a, 0.22, 0.7);
    this.baliza = luz(2510, 322, 2.6, 0xff5a4d, 0.0);
    luz(1480, 560, 8, 0x46d9e8, 0.1, 0.2);

    // Burbujas en los tubos, polvo y esporas
    for (const [x, ancho] of [[1960, 150], [2230, 150], [2470, 100]] as number[][]) {
      this.add.particles(0, 0, "v:punto", { x: { min: x - ancho / 2, max: x + ancho / 2 }, y: { min: 880, max: 1000 }, speedY: { min: -70, max: -130 }, speedX: { min: -8, max: 8 }, scale: { start: 0.18, end: 0.5 }, alpha: { start: 0.55, end: 0 }, lifespan: 4200, frequency: 420, blendMode: "ADD", tint: 0xc8fff0 }).setDepth(40);
    }
    this.add.particles(0, 0, "v:punto", { x: { min: 80, max: MUNDO_W - 80 }, y: { min: 200, max: SUELO_Y }, speedY: { min: -10, max: -3 }, speedX: { min: -6, max: 6 }, scale: { start: 0.1, end: 0.28 }, alpha: { start: 0, end: 0.3 }, lifespan: 7000, frequency: 160, blendMode: "ADD", tint: 0xbfeaf2 }).setDepth(155);
    this.chispas = this.add.particles(0, 0, "v:punto", { emitting: false, speed: { min: 120, max: 460 }, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 420, gravityY: 900, blendMode: "ADD", tint: 0xfff0a0 }).setDepth(120);
    this.premios = this.add.particles(0, 0, "v:punto", { emitting: false, speed: { min: 40, max: 200 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 1500, gravityY: -120, blendMode: "ADD", tint: 0x7cf0e8 }).setDepth(125);
    this.migas = this.add.particles(0, 0, "v:punto", { emitting: false, speed: { min: 60, max: 240 }, scale: { start: 0.25, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 480, gravityY: 800, tint: 0x7fb6ff }).setDepth(120);

    // Camara
    const cam = this.cameras.main;
    cam.setBackgroundColor("#040a0d");
    this.zoomActual = this.zoomPanorama();
    cam.setZoom(this.zoomActual);
    cam.centerOn(MUNDO_W / 2, MUNDO_H / 2);

    // Criaturas
    for (const c of this.juego.sim.criaturas) this.crearCriatura(c);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.alPulsar(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.alMover(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.alSoltar(p));
    // Rueda sobre la sala (no sobre la interfaz): hacia arriba se acerca (sala, seguir, cerca) y hacia abajo vuelve a la vista de la sala
    let ultimaRueda = 0;
    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.enTitulo || dy === 0) return;
      if (!(p.event?.target instanceof HTMLCanvasElement)) return;
      const modo = this.juego.ajustes.camara;
      if (dy > 0) { if (modo !== "panorama") this.juego.fijarCamara("panorama"); return; }
      // Un paso por cada gesto de la rueda, para que no se salte un nivel
      const ahora = performance.now();
      if (ahora - ultimaRueda < 320) return;
      ultimaRueda = ahora;
      if (modo === "panorama") this.juego.fijarCamara("seguir");
      else if (modo === "seguir") this.juego.fijarCamara("cercano");
    });
    this.juego.on("simNueva", () => this.reiniciar());
    this.juego.on("premio", (id) => this.efectoPremio(id as number));
    this.juego.on("susto", (id) => this.efectoSusto(id as number));
    this.scale.on("resize", () => { this.zoomActual = this.zoomObjetivo(); });
    this.lista = true;
  }

  /** Se ha cambiado de simulacion: se quitan los dibujos de la anterior. */
  private reiniciar(): void {
    for (const s of this.crit.values()) { s.img.destroy(); s.sombra.destroy(); s.etiqueta.destroy(); s.aro.destroy(); s.burbuja.destroy(); }
    for (const s of this.objs.values()) { s.img.destroy(); s.sombra.destroy(); s.extra.forEach((q) => q.destroy()); }
    for (const id of this.crit.keys()) this.textures.remove(`crit:${id}`);
    this.crit.clear(); this.objs.clear(); this.vistas.clear(); this.prevC.clear(); this.prevO.clear();
    this.acc = 0;
  }

  /* ---------- Camara ---------- */
  private zoomPanorama(): number {
    const { width: w, height: h } = this.scale;
    return Math.max(w / MUNDO_W, h / MUNDO_H);
  }

  private zoomObjetivo(): number {
    if (this.enTitulo) return this.zoomPanorama() * 1.25;
    const base = this.zoomPanorama();
    const m = this.juego.ajustes.camara;
    return m === "panorama" ? base : m === "seguir" ? base * 1.7 : base * 2.35;
  }

  private moverCamara(dt: number): void {
    const cam = this.cameras.main;
    const k = 1 - Math.exp(-dt * 2.6);
    const zObj = this.zoomObjetivo();
    this.zoomActual += (zObj - this.zoomActual) * k;
    cam.setZoom(this.zoomActual);
    let tx = MUNDO_W / 2;
    let ty = MUNDO_H / 2;
    const base = this.zoomPanorama();
    if (this.enTitulo) {
      tx = MUNDO_W / 2 + Math.sin(this.tiempoReal * 0.07) * 700;
      ty = SUELO_Y - 340;
    } else if (this.juego.ajustes.camara === "panorama") {
      ty = (MUNDO_H / 2);
      // Si sobra alto, se muestra mas suelo que techo
      const alto = cam.height / this.zoomActual;
      ty = Math.min(MUNDO_H - alto / 2, Math.max(alto / 2, SUELO_Y - alto * 0.62));
    } else {
      const c = this.juego.criatura;
      const s = this.crit.get(c.id);
      tx = s ? s.x : px(c.x);
      ty = SUELO_Y - (this.juego.ajustes.camara === "cercano" ? 215 : 255);
    }
    const c0 = this.centro;
    const kc = this.juego.ajustes.camara === "seguir" || this.juego.ajustes.camara === "cercano" ? 1 - Math.exp(-dt * 2.2) : 1 - Math.exp(-dt * 3);
    c0.x += (tx - c0.x) * kc;
    c0.y += (ty - c0.y) * kc;
    const mw = cam.width / this.zoomActual / 2, mh = cam.height / this.zoomActual / 2;
    const cx = Math.min(MUNDO_W - mw, Math.max(mw, c0.x));
    const cy = Math.min(MUNDO_H - mh, Math.max(mh, c0.y));
    cam.centerOn(cx, cy);
    void base;
  }

  private pan(xPx: number): number {
    const cam = this.cameras.main;
    const mitad = cam.width / this.zoomActual / 2;
    return Math.max(-1, Math.min(1, (xPx - (cam.midPoint.x)) / mitad));
  }

  /* ---------- Criaturas ---------- */
  private crearCriatura(c: Criatura): void {
    const L = lienzoCriatura;
    const key = `crit:${c.id}`;
    const tex = this.textures.createCanvas(key, Math.round(L.w * L.res), Math.round(L.h * L.res)) as Phaser.Textures.CanvasTexture;
    const ctx = tex.getContext();
    const sombra = this.add.image(0, PIES, "v:sombra").setDepth(29).setAlpha(0.8).setScale(4.2, 2.4);
    const img = this.add.image(0, PIES, key).setOrigin(L.ox / L.w, L.oy / L.h).setScale(1 / L.res).setDepth(30 + c.id);
    const aro = this.add.image(0, PIES + 2, "v:aro").setDepth(28).setAlpha(0).setScale(1.5);
    const etiqueta = this.add.text(0, 0, c.nombre.toUpperCase(), { fontFamily: '"Chakra Petch", sans-serif', fontSize: "26px", color: "#d9e4de" }).setOrigin(0.5, 1).setDepth(140).setAlpha(0.85);
    etiqueta.setLetterSpacing(4);
    const burbuja = this.add.container(0, 0).setDepth(141).setAlpha(0);
    this.vistas.set(c.id, nuevaVista(c.id * 977 + 13));
    this.crit.set(c.id, { img, sombra, tex, ctx, etiqueta, aro, burbuja, burbujaClave: "", burbujaAlpha: 0, ultT: c.t, ultDano: c.ultimoDano, proxRonquido: 3, proxVoz: 6, durmiendo: false, x: px(c.x), y: PIES });
    this.prevC.set(c.id, c.x);
  }

  /* ---------- Objetos ---------- */
  private crearObjeto(o: Objeto): SprObjeto {
    const a = this.arte[o.tipo === "placa" ? "placa_on" : o.tipo] ?? this.arte.fruta;
    const def = CATALOGO[o.tipo];
    const tex = o.tipo === "placa" ? "o:placa_on" : `o:${o.tipo}`;
    const sombra = this.add.image(0, PIES, "v:sombra").setDepth(19).setAlpha(0.7);
    const prof = o.tipo === "placa" ? 17 : o.tipo === "granulo" ? 22 : def.masa > 0 ? 24 : 21;
    const img = this.add.image(0, 0, tex).setOrigin(a.ax, a.ay).setDepth(prof);
    const extra: Phaser.GameObjects.Image[] = [];
    if (o.tipo === "palanca" || o.tipo === "palanca_rota") {
      extra.push(this.add.image(0, 0, "o:palanca_brazo").setOrigin(0.5, 0.93).setDepth(prof + 1));
      extra.push(this.add.image(0, 0, "v:halo").setBlendMode(Phaser.BlendModes.ADD).setTint(0x7cf08a).setAlpha(0).setScale(2.6).setDepth(160));
    } else if (o.tipo === "placa") {
      extra.push(this.add.image(0, 0, "v:halo").setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a4d).setAlpha(0).setScale(5, 1.2).setDepth(160));
    } else if (o.tipo.startsWith("foco")) {
      extra.push(this.add.image(0, 0, "v:halo").setBlendMode(Phaser.BlendModes.ADD).setTint(o.tipo === "foco_azul" ? 0x46d9e8 : 0xff5a4d).setAlpha(0.3).setScale(3.2).setDepth(160));
    }
    return { img, sombra, extra, tipo: o.tipo, nace: this.tiempoReal, rot: 0, ultX: o.x, aterrizo: o.z <= 0, chispa: 0 };
  }

  private actualizarObjetos(alpha: number, dt: number): void {
    const mundo = this.juego.sim.mundo;
    const vivos = new Set<number>();
    for (const o of mundo.objetos) {
      vivos.add(o.id);
      let s = this.objs.get(o.id);
      if (!s) { s = this.crearObjeto(o); this.objs.set(o.id, s); this.prevO.set(o.id, o.x); }
      const def = CATALOGO[o.tipo];
      const prev = this.prevO.get(o.id) ?? o.x;
      const x = px(prev + (o.x - prev) * alpha);
      const a = this.arte[o.tipo === "placa" ? (o.activo ? "placa_on" : "placa_off") : o.tipo] ?? this.arte.fruta;
      const z = Math.max(0, o.z) * ESCALA;
      const edad = this.tiempoReal - s.nace;
      const pop = Math.min(1, 0.4 + edad * 4);
      let y: number;
      if (o.tipo === "pelota") {
        const r = a.cv.height * 0.45;
        y = PIES - r - z;
        s.rot += ((o.x - s.ultX) * ESCALA) / r;
        s.img.setRotation(s.rot);
      } else y = PIES - z;
      s.ultX = o.x;
      if (o.tipo === "placa") s.img.setTexture(o.activo ? "o:placa_on" : "o:placa_off");
      s.img.setPosition(x, y).setScale(pop);
      const alto = a.cv.height * a.ay;
      s.sombra.setPosition(x, PIES + 4).setScale((def.peligro ? 2.6 : 1.2 + alto / 220) * (1 - Math.min(0.5, z / 700)), 1.6).setAlpha(0.7 * (1 - Math.min(0.7, z / 500)));
      if (!s.aterrizo && o.z <= 0 && edad > 0.2) {
        s.aterrizo = true;
        sonido.bote(this.pan(x), o.tipo === "fruta" ? 0.1 : 0.06);
      }
      // Rasgos propios de cada objeto
      const e = s.extra;
      if ((o.tipo === "palanca" || o.tipo === "palanca_rota") && e.length) {
        const t = mundo.t - o.luz;
        const pulso = t >= 0 && t < 0.6 ? Math.sin((t / 0.6) * Math.PI) : 0;
        e[0].setPosition(x, y - a.cv.height * a.ay * 0.45).setRotation(-0.6 + pulso * 1.3);
        e[1].setPosition(x - 20, y - a.cv.height * 0.67).setAlpha(o.tipo === "palanca" ? 0.25 + 0.5 * pulso : 0.1 * pulso).setTint(o.tipo === "palanca" ? 0x7cf08a : 0xff5a4d);
      } else if (o.tipo === "placa" && e.length) {
        const parpadeo = 0.5 + 0.5 * Math.sin(this.tiempoReal * 16) * Math.sin(this.tiempoReal * 5.3);
        e[0].setPosition(x, y - 14).setAlpha(o.activo ? 0.25 + 0.35 * parpadeo : 0);
        if (o.activo) {
          for (const c of this.juego.sim.criaturas) {
            if (Math.abs(c.x - o.x) <= (def.peligro?.ancho ?? 0) / 2) {
              s.chispa -= dt;
              if (s.chispa <= 0) { s.chispa = 0.09; this.chispas?.explode(4, px(c.x) + (Math.random() - 0.5) * 100, PIES - 10); this.cameras.main.shake(60, 0.0016); }
            }
          }
        }
      } else if (o.tipo.startsWith("foco") && e.length) {
        const t = mundo.t - o.luz;
        const flash = t >= 0 && t < 0.4 ? 1 - t / 0.4 : 0;
        e[0].setPosition(x, y - a.cv.height * 0.72).setAlpha(0.28 + 0.07 * Math.sin(this.tiempoReal * 2 + o.id) + flash * 0.6).setScale(3.2 + flash * 2);
      }
    }
    for (const [id, s] of this.objs) {
      if (vivos.has(id)) continue;
      if (s.tipo === "fruta" || s.tipo === "granulo" || s.tipo === "baya") this.migas?.explode(8, s.img.x, s.img.y - 30);
      s.img.destroy(); s.sombra.destroy(); s.extra.forEach((q) => q.destroy());
      this.objs.delete(id); this.prevO.delete(id);
    }
  }

  /* ---------- Un fotograma ---------- */
  update(_t: number, deltaMs: number): void {
    if (!this.lista) return;
    const dtR = Math.min(0.1, deltaMs / 1000);
    this.tiempoReal += dtR;
    this.cuadro++;
    const j = this.juego;
    const vel = j.pausado ? 0 : j.ajustes.velocidad;
    const sim = j.sim;
    this.acc += dtR * vel;
    let n = 0;
    while (this.acc >= DT && n < 160) {
      if (this.acc < 2 * DT || n === 159) this.instantanea();
      sim.paso(DT);
      this.acc -= DT;
      n++;
    }
    if (n >= 160) this.acc = 0;
    const alpha = this.acc / DT;
    const dtAnim = dtR * Math.min(vel, 4);

    this.moverCamara(dtR);
    this.actualizarObjetos(alpha, dtR);
    for (const c of sim.criaturas) {
      if (!this.crit.has(c.id)) this.crearCriatura(c);
      this.pintar(c, alpha, dtAnim, dtR);
    }
    this.ambiente(dtR);
    this.autoguardado += dtR;
    if (this.autoguardado > 20) { this.autoguardado = 0; j.guardar(true); }
  }

  /** Posiciones justo antes del ultimo paso: sirven para suavizar el movimiento entre pasos de la simulacion. */
  private instantanea(): void {
    for (const c of this.juego.sim.criaturas) this.prevC.set(c.id, c.x);
    for (const o of this.juego.sim.mundo.objetos) this.prevO.set(o.id, o.x);
  }

  private pintar(c: Criatura, alpha: number, dtAnim: number, dtR: number): void {
    const s = this.crit.get(c.id)!;
    const v = this.vistas.get(c.id)!;
    const prev = this.prevC.get(c.id) ?? c.x;
    const x = px(prev + (c.x - prev) * alpha);
    s.x = x;
    const foco = this.enfoque(c);
    actualizarVista(v, c, dtAnim, foco);
    // Cada criatura se redibuja una de cada dos veces (30 por segundo): se nota igual de fluido y cuesta la mitad (y dormida, un cuarto)
    if ((this.cuadro + c.id) % (v.pose.dormido > 0.9 ? 4 : 2) === 0) { pintarCriatura(s.ctx, v, c.genoma, c.huella); s.tex.refresh(); }
    const profundo = (c.id % 2) * 8;
    s.img.setPosition(x, PIES + profundo);
    s.sombra.setPosition(x, PIES + 6 + profundo).setScale(4 - v.pose.agacha * 0.3, 2.3).setAlpha(0.7);
    const sel = this.juego.seleccion === c.id && !this.enTitulo;
    s.aro.setPosition(x, PIES + 4 + profundo).setAlpha(sel ? 0.5 + 0.2 * Math.sin(this.tiempoReal * 3) : 0);
    const alto = 360 * c.genoma.cuerpo.tamano - v.pose.agacha * 130;
    s.etiqueta.setPosition(x, PIES - alto - 30).setAlpha(this.enTitulo ? 0 : sel ? 0.95 : 0.55).setFontSize(26);
    this.burbujaDe(c, s, x, PIES - alto - 70, sel, dtR);
    this.sonidos(c, s, v, x);
  }

  /** Hacia donde mira: lo que esta haciendo con algo, o lo que tiene a la vista. */
  private enfoque(c: Criatura): [number, number] | null {
    const a = c.accion;
    let tx: number | null = null;
    let ty = 0;
    if (a && a.obj >= 0) {
      if (a.esCriatura) { const o = this.juego.sim.criaturas.find((q) => 1000 + q.id === a.obj); if (o) tx = o.x; }
      else { const o = this.juego.sim.mundo.obj(a.obj); tx = o ? o.x : a.dest; ty = 0.5; }
    } else if (a && (a.v === "explorar" || a.v === "evitar")) { tx = a.dest; ty = 0; }
    if (tx === null) return null;
    const dx = (tx - c.x) * c.dir;
    return [Math.max(-1, Math.min(1, dx / 260)), ty];
  }

  /** Lo que piensa hacer, en una burbuja sobre la cabeza. */
  private burbujaDe(c: Criatura, s: SprCriatura, x: number, y: number, sel: boolean, dt: number): void {
    const a = c.accion;
    let clave = "";
    let icono_ = "";
    let texto = "";
    let color = "#d9e4de";
    if (c.dormido) { clave = "z"; texto = "Zzz"; }
    else if (a) {
      if (a.obj >= 0 && !a.esCriatura && a.v !== "evitar" && this.textures.exists(`i:${a.tipo}`)) { clave = `i:${a.tipo}`; icono_ = clave; }
      else if (a.v === "evitar") { clave = "!"; texto = "!"; color = "#ff7a6c"; }
      else if (a.v === "explorar") { clave = "?"; texto = "?"; }
      else if (a.v === "descansar") { clave = "…"; texto = "…"; }
      else if (a.esCriatura) { clave = "c"; texto = "♪"; }
    }
    const muestra = (sel || this.juego.observar) && !this.enTitulo && clave !== "";
    s.burbujaAlpha += ((muestra ? 1 : 0) - s.burbujaAlpha) * (1 - Math.exp(-dt * 6));
    if (clave !== s.burbujaClave && clave !== "") {
      s.burbuja.removeAll(true);
      const g = this.add.graphics();
      g.fillStyle(0x07151a, 0.82); g.lineStyle(3, 0x46d9e8, 0.7);
      g.fillRoundedRect(-52, -46, 104, 80, 20); g.strokeRoundedRect(-52, -46, 104, 80, 20);
      g.fillTriangle(-12, 33, 12, 33, 0, 52); g.lineBetween(-12, 34, 0, 51); g.lineBetween(12, 34, 0, 51);
      s.burbuja.add(g);
      if (icono_) s.burbuja.add(this.add.image(0, -6, icono_).setScale(0.78));
      else s.burbuja.add(this.add.text(0, -8, texto, { fontFamily: '"Chakra Petch", sans-serif', fontSize: "44px", color }).setOrigin(0.5));
      s.burbujaClave = clave;
    }
    s.burbuja.setPosition(x, y + Math.sin(this.tiempoReal * 2 + c.id) * 4).setAlpha(s.burbujaAlpha);
  }

  /* ---------- Sonidos y efectos que salen de lo que hace cada criatura ---------- */
  private sonidos(c: Criatura, s: SprCriatura, v: Vista, x: number): void {
    const pan = this.pan(x);
    const tono = 0.85 + (c.huella * 0.4);
    for (const r of c.registro) {
      if (r.t <= s.ultT) continue;
      if (r.kind === "impacto") {
        const res = r.res ?? [];
        if (r.v === "probar" && (res[C.sacia] ?? 0) > 0) { sonido.mordisco(pan); this.migas?.explode(6, x + 60 * c.dir, PIES - 120); if (Math.random() < 0.6) sonido.trino(pan, tono); }
        else if (r.v === "probar" && (res[C.dano] ?? 0) > 0.1) sonido.queja(pan, tono);
        else if (r.v === "empujar" || r.v === "tocar") {
          if (r.tipo === "pelota") { sonido.golpePelota(pan); this.chispas?.explode(5, x + 90 * c.dir, PIES - 70); }
          else if (r.tipo === "palanca" || r.tipo === "palanca_rota") sonido.palanca(pan);
          else if ((res[C.dano] ?? 0) > 0) sonido.descarga(pan);
          else sonido.fruta(pan);
          if ((res[C.diversion] ?? 0) > 0.3 && Math.random() < 0.4) sonido.trino(pan, tono);
        }
      } else if (r.v === "explorar" && Math.random() < 0.2) sonido.curiosear(pan, tono);
    }
    s.ultT = c.t;
    if (c.ultimoDano !== s.ultDano) {
      s.ultDano = c.ultimoDano;
      sonido.descarga(pan);
      if (Math.random() < 0.7) sonido.grito(pan, tono); else sonido.queja(pan, tono);
      this.chispas?.explode(8, x, PIES - 120);
    }
    if (c.dormido && !s.durmiendo) { s.durmiendo = true; sonido.bostezo(pan, tono); }
    if (!c.dormido) s.durmiendo = false;
    if (c.dormido) { s.proxRonquido -= 1 / 60; if (s.proxRonquido <= 0) { s.proxRonquido = 3.5 + Math.random() * 2; sonido.ronquido(pan); } }
    s.proxVoz -= 1 / 60;
    if (s.proxVoz <= 0) {
      s.proxVoz = 8 + Math.random() * 12;
      if (!c.dormido && c.emo[4] > 0.4) sonido.trino(pan, tono);
      else if (!c.dormido && c.emo[0] > 0.4) sonido.queja(pan, tono);
    }
    void v;
  }

  /** Luces que parpadean, baliza y la noche. */
  private ambiente(dt: number): void {
    const t = this.tiempoReal;
    for (const l of this.luces) l.img.setAlpha(l.base * (0.85 + 0.15 * Math.sin(t * l.vel * 2 + l.fase) + 0.04 * Math.sin(t * 17 + l.fase)));
    if (this.baliza) this.baliza.setAlpha(Math.max(0, Math.sin(t * 2.4)) * 0.5);
    const r = Juego.reloj(this.juego.sim.t).fraccion;
    // Anochece desde las 20 h y amanece a las 6 h
    const hora = r * 24;
    const noche = hora >= 20 ? Math.min(1, (hora - 20) / 1.5) : hora < 5 ? 1 : hora < 6.5 ? 1 - (hora - 5) / 1.5 : 0;
    this.noche?.setAlpha(noche * 0.36);
    sonido.noche(noche);
    void dt;
  }

  /* ---------- Efectos del jugador ---------- */
  private efectoPremio(id: number): void {
    const s = this.crit.get(id);
    if (!s) return;
    this.premios?.explode(22, s.x, PIES - 260);
    sonido.premio(this.pan(s.x));
    const c = this.juego.sim.criatura(id);
    if (c) sonido.trino(this.pan(s.x), 0.85 + c.huella * 0.4);
  }

  private efectoSusto(id: number): void {
    const s = this.crit.get(id);
    this.cameras.main.shake(260, 0.006);
    this.cameras.main.flash(120, 255, 255, 255, false);
    sonido.asustar();
    if (s) this.chispas?.explode(12, s.x, PIES - 200);
  }

  /* ---------- Raton ---------- */
  private mundoDe(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private objetoEn(wx: number, wy: number): number | null {
    let mejor: number | null = null;
    let prof = -1;
    for (const [id, s] of this.objs) {
      if (s.tipo === "placa") { if (Math.abs(wx - s.img.x) < 120 && wy > PIES - 70 && wy < PIES + 24) { if (prof < 0) { mejor = id; } } continue; }
      const b = s.img.getBounds();
      if (wx >= b.x - 10 && wx <= b.right + 10 && wy >= b.y - 10 && wy <= b.bottom + 10 && s.img.depth > prof) { mejor = id; prof = s.img.depth; }
    }
    return mejor;
  }

  private criaturaEn(wx: number, wy: number): number | null {
    for (const c of this.juego.sim.criaturas) {
      const s = this.crit.get(c.id);
      if (!s) continue;
      if (Math.abs(wx - s.x) < 120 && wy > PIES - 380 && wy < PIES + 30) return c.id;
    }
    return null;
  }

  private alPulsar(p: Phaser.Input.Pointer): void {
    if (this.enTitulo) return;
    const w = this.mundoDe(p);
    if (this.colocando) {
      this.juego.soltar(this.colocando, unidades(w.x));
      this.colocando = null;
      this.juego.emit("colocado");
      return;
    }
    const id = this.objetoEn(w.x, w.y);
    const cid = this.criaturaEn(w.x, w.y);
    // Una placa en el suelo se puede coger aunque haya una criatura encima: solo gana la criatura si se pulsa en su cuerpo, por encima de los pies
    const placaDebajo = id !== null && this.objs.get(id)?.tipo === "placa" && w.y > PIES - 100;
    if (cid !== null && (id === null || p.event.shiftKey || (this.objs.get(id)?.tipo === "placa" && !placaDebajo))) { this.juego.seleccionar(cid); return; }
    if (id !== null) { this.arrastre = { id, tipo: this.objs.get(id)!.tipo, ghost: null }; this.input.setDefaultCursor("grabbing"); }
  }

  private alMover(p: Phaser.Input.Pointer): void {
    const w = this.mundoDe(p);
    if (this.arrastre?.id != null) { this.juego.mover(this.arrastre.id, unidades(w.x)); return; }
    if (this.colocando) { this.input.setDefaultCursor("copy"); return; }
    const sobre = !this.enTitulo && (this.objetoEn(w.x, w.y) !== null || this.criaturaEn(w.x, w.y) !== null);
    this.input.setDefaultCursor(sobre ? "pointer" : "default");
  }

  private alSoltar(p: Phaser.Input.Pointer): void {
    if (this.arrastre?.id != null) {
      // Arrastrar un objeto hasta la bandeja lo retira
      const abajo = p.y > this.scale.height - 120;
      if (abajo) this.juego.quitar(this.arrastre.id);
      else this.juego.guardar();
      this.arrastre = null;
      this.input.setDefaultCursor("default");
    }
  }

  /** Desde la bandeja: se arrastra un objeto nuevo hasta la habitacion. */
  arrastrarNuevo(tipo: string): void {
    const a = this.arte[tipo];
    if (!a) return;
    const ghost = this.add.image(0, 0, `o:${tipo === "placa" ? "placa_on" : tipo}`).setOrigin(a.ax, a.ay).setAlpha(0.7).setDepth(130);
    this.arrastre = { id: null, tipo, ghost };
  }

  moverFantasma(cx: number, cy: number): void {
    const g = this.arrastre?.ghost;
    if (!g) return;
    const w = this.cameras.main.getWorldPoint(cx, cy);
    g.setPosition(w.x, PIES);
  }

  /** Suelta el objeto que se arrastraba desde la bandeja. Devuelve si quedo dentro de la habitacion. */
  soltarFantasma(cx: number, cy: number, dentro: boolean): boolean {
    const a = this.arrastre;
    if (!a || !a.ghost) return false;
    const w = this.cameras.main.getWorldPoint(cx, cy);
    a.ghost.destroy();
    this.arrastre = null;
    if (!dentro) return false;
    this.juego.soltar(a.tipo, unidades(w.x));
    return true;
  }

  /** Para la bandeja: una criatura donde esta ahora (px de pantalla), por si la interfaz quiere apuntar a ella. */
  posicionPantalla(id: number): { x: number; y: number } | null {
    const s = this.crit.get(id);
    if (!s) return null;
    const cam = this.cameras.main;
    return { x: (s.x - cam.worldView.x) * this.zoomActual, y: (PIES - 300 - cam.worldView.y) * this.zoomActual };
  }
}
