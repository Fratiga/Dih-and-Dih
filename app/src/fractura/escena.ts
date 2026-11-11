/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import {
  hash, lienzo, colorNum, estiloMar, hornearSuelo, pintarMar, pintarArbol, pintarPico, pintarRoca, pintarCalavera, pintarCristal, pintarJuncos,
  pintarCiudad, pintarFortaleza, pintarRuinas, pintarNucleo, pintarCostura, pintarMuro, pintarGlifo, pintarBandera, pintarGema,
  pintarNiebla, pintarTerritorios, pintarBrillo, pintarAnillo, pintarAroSel, pintarTajo, pintarEspadas, pintarHumo, type Ctx
} from "./pinturas";

/* =============================================================================
   LA FRACTURA en Phaser: la escena de la guerra. Solo dibuja y avisa de los toques; las reglas son del
   motor (window.FracturaMotor). El mundo mide T píxeles por casilla y no cambia con la pantalla: la
   cámara acerca, aleja y se desplaza. Las animaciones se reproducen por encima del estado final del
   motor y al acabar se vuelve al estado real.
   Nada da por hecho dos bandos ni un mapa cuadrado: todo sale de est.
============================================================================= */

export interface Ganchos {
  alTocar: (x: number, y: number, tactil: boolean) => void;
  alPasar?: (x: number, y: number) => void;
  alSonar?: (nombre: string) => void;
  alMoverVista?: () => void;
}

const W: any = window;
const T = 96;                 // píxeles de mundo por casilla
const FIG = 104;              // tamaño de las texturas de las figuras (una casilla)
const RN = 4;                 // píxeles de niebla por casilla
const RT = 32;                // píxeles del lienzo de provincias por casilla
const FPS_VIVO = 60, FPS_QUIETO = 20;   // con algo moviéndose y con el mapa en reposo
const CASILLA_VISTA = 86;     // tamaño de casilla (px CSS) con el que se abre la guerra
const CASILLA_MAX = 200;
const REDUCIDO = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const POSES: Record<string, { mov: boolean; fase: number; sw: number }> = {
  idle: { mov: false, fase: 0, sw: 0 }, w1: { mov: true, fase: 0.9, sw: 0 }, w2: { mov: true, fase: 3.9, sw: 0 },
  a0: { mov: false, fase: 0, sw: -0.5 }, a1: { mov: false, fase: 0, sw: 0.5 }, a2: { mov: false, fase: 0, sw: 1 }
};
const ease = (x: number): number => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
type Obj = Phaser.GameObjects.GameObject;

export class EscenaGuerra extends Phaser.Scene {
  private ganchos: Ganchos;
  private dpr: number;
  private listo = false;
  private cola: Array<() => void> = [];
  private est: any = null;
  private bandos: Array<{ col: string; ban: string; forma: string; n: number; faccion: string }> = [];
  private reserva = { arriba: 58, abajo: 8, izq: 8, der: 8 };
  private ui: any = { sel: null, mover: new Map(), atacar: new Set(), ciudad: null, casilla: null, objetivosHab: new Set(), ruta: null, hover: null, previaAtq: null, amenaza: null };
  private anim: any = null;
  private rapidez = 1;
  private seguirAccion = true;
  // vista
  private vz = 1; private cx = 0; private cy = 0;
  private vistaPendiente = true;
  private toque: { id: number; x: number; y: number; cx: number; cy: number; mov: boolean; tactil: boolean } | null = null;
  private pinza: { dist: number } | null = null;
  private viaje: Phaser.Tweens.Tween | null = null;
  // capas
  private mar: Phaser.GameObjects.TileSprite | null = null;
  private terr: Phaser.GameObjects.Image | null = null;
  private lienzoTerr: HTMLCanvasElement | null = null;
  private datos = new Map<string, any>();
  private actividad = 0;
  private fpsActual = FPS_VIVO;
  private suelo: Phaser.GameObjects.Image | null = null;
  private gRes!: Phaser.GameObjects.Graphics;
  private gBarras!: Phaser.GameObjects.Graphics;
  private niebla: Phaser.GameObjects.Image | null = null;
  private lienzoNiebla: HTMLCanvasElement | null = null;
  private aroSel!: Phaser.GameObjects.Image;
  private decor = new Map<number, Phaser.GameObjects.Image[]>();
  private tipoDecor: string[] = [];
  private estr = new Map<number, Obj[]>();
  private firmaEstr: string[] = [];
  private unidades = new Map<string, { spr: Phaser.GameObjects.Image; clave: string }>();
  private marcas: Phaser.GameObjects.Image[] = [];
  private rotulos: Phaser.GameObjects.Text[] = [];
  private firmaTerr = ""; private firmaVis = ""; private firmaSuelo = "";

  constructor(ganchos: Ganchos, dpr: number) {
    super("Guerra");
    this.ganchos = ganchos;
    this.dpr = dpr;
  }

  /* ===================================================================== ciclo de vida */
  create(): void {
    this.cameras.main.setBackgroundColor(0x05060c);
    this.gRes = this.add.graphics().setDepth(8);
    this.gBarras = this.add.graphics().setDepth(27);
    this.tex("brillo", 128, 128, g => pintarBrillo(g, 128));
    this.tex("anillo", 128, 128, g => pintarAnillo(g, 128));
    this.tex("aro", 128, 128, g => pintarAroSel(g, 128));
    this.tex("tajo", 128, 128, g => pintarTajo(g, 128));
    this.tex("espadas", 64, 64, g => pintarEspadas(g, 64));
    this.tex("humo", 64, 64, g => pintarHumo(g, 64));
    this.aroSel = this.add.image(0, 0, "aro").setDepth(8.5).setVisible(false);

    this.input.addPointer(1);
    const casillaEn = (sx: number, sy: number): { x: number; y: number; dentro: boolean } => {
      const m = this.aMundo(sx, sy);
      const x = Math.floor(m.x / T), y = Math.floor(m.y / T);
      return { x, y, dentro: !!this.est && x >= 0 && y >= 0 && x < this.est.ancho && y < this.est.alto };
    };
    const umbral = 8 * this.dpr;
    let tactil = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.actividad = performance.now();
      if (!this.est) return;
      if (p.wasTouch) tactil = Date.now();
      if (this.anim) { this.saltar(); return; }
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.pinza = { dist: Math.hypot(this.input.pointer1.x - this.input.pointer2.x, this.input.pointer1.y - this.input.pointer2.y) };
        if (this.toque) this.toque.mov = true;
        return;
      }
      if (this.viaje) { this.viaje.stop(); this.viaje = null; }
      this.toque = { id: p.id, x: p.x, y: p.y, cx: this.cx, cy: this.cy, mov: false, tactil: !!p.wasTouch };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.est) return;
      if (p.isDown) this.actividad = performance.now();
      if (this.pinza && this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const a = this.input.pointer1, b = this.input.pointer2, dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinza.dist > 0 && dist > 0) this.acercar(dist / this.pinza.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinza.dist = dist;
        return;
      }
      const t = this.toque;
      if (t && t.id === p.id && p.isDown) {
        if (!t.mov && Math.hypot(p.x - t.x, p.y - t.y) > umbral) t.mov = true;
        if (t.mov) { this.cx = t.cx - (p.x - t.x) / this.vz; this.cy = t.cy - (p.y - t.y) / this.vz; this.aplicarCamara(); }
        return;
      }
      if (Date.now() - tactil < 800) return;
      const c = casillaEn(p.x, p.y);
      const nuevo = c.dentro ? { x: c.x, y: c.y } : null;
      const h = this.ui.hover;
      if (!h !== !nuevo || (nuevo && h && (nuevo.x !== h.x || nuevo.y !== h.y))) {
        this.ui.hover = nuevo;
        if (this.ganchos.alPasar) this.ganchos.alPasar(nuevo ? nuevo.x : -1, nuevo ? nuevo.y : -1);
      }
    });
    const soltar = (p: Phaser.Input.Pointer): void => {
      if (this.pinza && !(this.input.pointer1.isDown && this.input.pointer2.isDown)) this.pinza = null;
      const t = this.toque;
      if (!t || t.id !== p.id) return;
      this.toque = null;
      if (t.mov || this.pinza || !this.est || this.anim) return;
      const c = casillaEn(p.x, p.y);
      if (c.dentro) this.ganchos.alTocar(c.x, c.y, t.tactil);
    };
    this.input.on("pointerup", soltar);
    this.input.on("pointerupoutside", soltar);
    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (this.est) { this.actividad = performance.now(); this.acercar(Math.exp(-dy * 0.0014), p.x, p.y); } });
    this.input.on("gameout", () => { this.toque = null; this.ui.hover = null; if (this.ganchos.alPasar) this.ganchos.alPasar(-1, -1); });
    document.addEventListener("keydown", ev => { if (this.anim && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) this.saltar(); });

    this.listo = true;
    this.cola.splice(0).forEach(f => f());
  }

  cuando(f: () => void): void { if (this.listo) f(); else this.cola.push(f); }
  alCambiarTamano(): void { this.cuando(() => { if (this.est) { this.limitarVista(); this.aplicarCamara(); } }); }
  ponerEscala(d: number): void { this.dpr = d; }
  ajustes(a: { rapidez?: number; seguir?: boolean }): void { if (a.rapidez) this.rapidez = a.rapidez; if (a.seguir !== undefined) this.seguirAccion = a.seguir; }

  /* ===================================================================== utilidades */
  private centro = (x: number, y: number): { x: number; y: number } => ({ x: x * T + T / 2, y: y * T + T / 2 });
  private humano = (): number => (this.est && this.est.humano >= 0 ? this.est.humano : 0);
  private visDe = (): number[] => this.est.vision[this.humano()];
  private sonar(n: string): void { if (this.ganchos.alSonar) { try { this.ganchos.alSonar(n); } catch { /* el sonido nunca rompe el juego */ } } }

  private tex(clave: string, w: number, h: number, f: (g: Ctx) => void): string {
    if (this.textures.exists(clave)) return clave;
    const [c, g] = lienzo(w, h);
    f(g);
    this.textures.addCanvas(clave, c);
    return clave;
  }
  private limpiar(lista: Obj[] | undefined): void { if (lista) lista.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); }); }

  /* ===================================================================== estado y estructura */
  poner(est: any): void {
    this.est = est;
    this.bandos = W.FracturaFiguras.coloresBando(est);
    this.anim = null;
    this.decor.forEach(l => this.limpiar(l)); this.decor.clear(); this.tipoDecor = [];
    this.estr.forEach(l => this.limpiar(l)); this.estr.clear(); this.firmaEstr = [];
    this.unidades.forEach(u => u.spr.destroy()); this.unidades.clear();
    this.rotulos.forEach(r => r.destroy()); this.rotulos = [];
    this.marcas.forEach(m => m.destroy()); this.marcas = [];
    this.firmaTerr = ""; this.firmaVis = ""; this.firmaSuelo = "";
    this.vistaPendiente = true; this.toque = null; this.pinza = null;
    for (let i = 0; i < est.ancho * est.alto; i++) { this.tipoDecor.push(""); this.firmaEstr.push(""); }
    const mw = est.ancho * T, mh = est.alto * T;
    // El mar o el abismo, en dos capas que se mueven a distinto paso
    const estilo = estiloMar(est.tipo);
    if (this.mar) this.mar.destroy();
    this.mar = this.add.tileSprite(mw / 2, mh / 2, mw + T * 60, mh + T * 60, this.tex(`mar:${estilo}`, 512, 512, g => pintarMar(g, 512, estilo))).setDepth(-20);
    // Provincias, en un lienzo que solo se repinta cuando cambia algo
    if (this.terr) this.terr.destroy();
    if (this.textures.exists("provincias")) this.textures.remove("provincias");
    const [ct] = lienzo(est.ancho * RT, est.alto * RT);
    this.lienzoTerr = ct;
    this.textures.addCanvas("provincias", ct);
    this.terr = this.add.image(0, 0, "provincias").setOrigin(0).setDisplaySize(mw, mh).setDepth(3);
    // Niebla de guerra
    if (this.niebla) this.niebla.destroy();
    if (this.textures.exists("niebla")) this.textures.remove("niebla");
    const [cn] = lienzo(est.ancho * RN, est.alto * RN);
    this.lienzoNiebla = cn;
    this.textures.addCanvas("niebla", cn);
    this.niebla = this.add.image(0, 0, "niebla").setOrigin(0).setDisplaySize(mw, mh).setDepth(9);
    // Nombres de las provincias
    est.regiones.forEach((rg: any) => {
      let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) if (est.casillas[y][x].region === rg.id) { sx += x; sy += y; n++; }
      const tx = this.add.text((sx / Math.max(1, n) + 0.5) * T, (sy / Math.max(1, n) + 0.5) * T - T * 0.42, String(rg.nombre).replace(/^Fragmento de /, "").toUpperCase(), {
        fontFamily: "Cinzel, Georgia, serif", fontSize: `${Math.round(T * 0.15)}px`, color: "#f1e6c9", stroke: "#0a0810", strokeThickness: 4, align: "center", wordWrap: { width: T * 2.6 }
      }).setOrigin(0.5).setDepth(26.5).setAlpha(0.62).setResolution(2);
      (tx as any).__rg = rg.id;
      this.rotulos.push(tx);
    });
    this.sincronizar(true);
    this.limitarVista();
    if (this.vistaPendiente) { this.vistaPendiente = false; this.centrar(); }
  }

  estado(e: any): void {
    this.ui = Object.assign({ sel: null, mover: new Map(), atacar: new Set(), ciudad: null, casilla: null, objetivosHab: new Set(), ruta: null, hover: this.ui.hover, previaAtq: null, amenaza: null }, e);
    this.actividad = performance.now();
    this.sincronizar(false);
  }

  /* ===================================================================== vista */
  reservar(r: any): void { this.reserva = Object.assign(this.reserva, r); if (this.est) { this.limitarVista(); this.aplicarCamara(); } }
  private libre(): { x: number; y: number; w: number; h: number } {
    const R = this.reserva, d = this.dpr, w = this.scale.width, h = this.scale.height;
    const x = R.izq * d, y = R.arriba * d;
    return { x, y, w: Math.max(80, w - x - R.der * d), h: Math.max(80, h - y - R.abajo * d) };
  }
  private aMundo(sx: number, sy: number): { x: number; y: number } {
    const L = this.libre();
    return { x: this.cx + (sx - (L.x + L.w / 2)) / this.vz, y: this.cy + (sy - (L.y + L.h / 2)) / this.vz };
  }
  private zoomMin(): number { const L = this.libre(); return Math.min(L.w / (T * this.est.ancho), L.h / (T * this.est.alto)) * 0.96; }
  private zoomMax(): number { return Math.max(this.zoomMin() * 1.5, (CASILLA_MAX * this.dpr) / T); }
  private limitarVista(): void {
    const est = this.est;
    this.vz = Math.max(this.zoomMin(), Math.min(this.zoomMax(), this.vz));
    this.cx = Math.max(0, Math.min(T * est.ancho, this.cx));
    this.cy = Math.max(0, Math.min(T * est.alto, this.cy));
  }
  private aplicarCamara(): void {
    const cam = this.cameras.main, L = this.libre();
    this.limitarVista();
    cam.setZoom(this.vz);
    cam.centerOn(this.cx + (this.scale.width / 2 - (L.x + L.w / 2)) / this.vz, this.cy + (this.scale.height / 2 - (L.y + L.h / 2)) / this.vz);
    if (this.ganchos.alMoverVista) this.ganchos.alMoverVista();
  }
  private acercar(factor: number, sx?: number, sy?: number): void {
    const L = this.libre();
    const px = sx === undefined ? L.x + L.w / 2 : sx, py = sy === undefined ? L.y + L.h / 2 : sy;
    const antes = this.aMundo(px, py);
    this.vz = Math.max(this.zoomMin(), Math.min(this.zoomMax(), this.vz * factor));
    const despues = this.aMundo(px, py);
    this.cx += antes.x - despues.x; this.cy += antes.y - despues.y;
    this.aplicarCamara();
  }
  zoom(factor: number): void { this.cuando(() => { if (this.est) this.acercar(factor); }); }
  verTodo(): void {
    this.cuando(() => {
      if (!this.est) return;
      this.vz = this.zoomMin(); this.cx = T * this.est.ancho / 2; this.cy = T * this.est.alto / 2;
      this.aplicarCamara();
    });
  }
  centrar(): void {
    this.cuando(() => {
      if (!this.est) return;
      const H = this.humano(), mias = Object.values(this.est.unidades).filter((u: any) => u.dueno === H) as any[];
      let tx = this.est.capitales[H] ? this.est.capitales[H].x + 0.5 : this.est.ancho / 2, ty = this.est.capitales[H] ? this.est.capitales[H].y + 0.5 : this.est.alto / 2;
      if (mias.length) { tx = mias.reduce((a, u) => a + u.x, 0) / mias.length + 0.5; ty = mias.reduce((a, u) => a + u.y, 0) / mias.length + 0.5; }
      this.vz = (CASILLA_VISTA * this.dpr) / T;
      this.cx = tx * T; this.cy = ty * T;
      this.aplicarCamara();
    });
  }
  /* Lleva la vista a una casilla, con un desplazamiento suave */
  irA(x: number, y: number, suave = true): void {
    this.cuando(() => {
      if (!this.est) return;
      const dx = (x + 0.5) * T, dy = (y + 0.5) * T;
      if (this.viaje) { this.viaje.stop(); this.viaje = null; }
      if (!suave || REDUCIDO) { this.cx = dx; this.cy = dy; this.aplicarCamara(); return; }
      const o = { t: 0 }, x0 = this.cx, y0 = this.cy;
      this.viaje = this.tweens.add({ targets: o, t: 1, duration: 320, ease: "Sine.easeInOut", onUpdate: () => { this.cx = lerp(x0, dx, o.t); this.cy = lerp(y0, dy, o.t); this.aplicarCamara(); }, onComplete: () => { this.viaje = null; } });
    });
  }
  /* Qué trozo del mapa se ve, en casillas (para el minimapa) */
  vista(): { x0: number; y0: number; x1: number; y1: number } {
    if (!this.est) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    const L = this.libre(), a = this.aMundo(L.x, L.y), b = this.aMundo(L.x + L.w, L.y + L.h);
    return { x0: a.x / T, y0: a.y / T, x1: b.x / T, y1: b.y / T };
  }
  private enPantalla(x: number, y: number, margen = 0.16): boolean {
    const v = this.vista(), mx = (v.x1 - v.x0) * margen, my = (v.y1 - v.y0) * margen;
    return x + 0.5 > v.x0 + mx && x + 0.5 < v.x1 - mx && y + 0.5 > v.y0 + my && y + 0.5 < v.y1 - my;
  }
  pantallaDe(x: number, y: number): { x: number; y: number; ts: number } {
    const r = this.game.canvas.getBoundingClientRect(), d = this.dpr, L = this.libre();
    const sx = ((x + 0.5) * T - this.cx) * this.vz + L.x + L.w / 2, sy = (y * T - this.cy) * this.vz + L.y + L.h / 2;
    return { x: r.left + sx / d, y: r.top + sy / d, ts: (T * this.vz) / d };
  }

  /* ===================================================================== sincronizar con el estado del juego */
  sincronizar(forzar: boolean): void {
    const est = this.est;
    if (!est || !this.listo) return;
    const vis = this.visDe(), w = est.ancho;
    // 1. El suelo se hornea entero y solo se rehace si cambia algún terreno
    let fs = "";
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) fs += est.casillas[y][x].t[0] + (est.casillas[y][x].t[1] || "");
    if (fs !== this.firmaSuelo) {
      this.firmaSuelo = fs;
      const P = Math.max(32, Math.min(64, Math.floor(1536 / Math.max(est.ancho, est.alto))));
      const s = hornearSuelo(est, P);
      if (this.suelo) this.suelo.destroy();
      if (this.textures.exists("suelo")) this.textures.remove("suelo");
      this.textures.addCanvas("suelo", s.lienzo);
      this.suelo = this.add.image(0, 0, "suelo").setOrigin(0).setDisplaySize(est.ancho * T, est.alto * T).setDepth(-10);
    }
    const ciudades: Record<string, any> = {};
    Object.values(est.ciudades).forEach((c: any) => { ciudades[`${c.x},${c.y}`] = c; });
    let fv = "", ft = "";
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = est.casillas[y][x], v = vis[i];
      fv += v;
      // lo que crece o se levanta sobre el terreno
      const td = v === 0 ? "" : c.t + (c.est ? "!" : "");
      if (this.tipoDecor[i] !== td) { this.tipoDecor[i] = td; this.rehacerDecor(i, x, y, c, v); }
      const ci = ciudades[`${x},${y}`];
      const fi = est.fortalezas.findIndex((p: any) => p.x === x && p.y === y);
      const fort = fi >= 0 ? est.fortalezasDueno[fi] : null;
      const hold = c.est === "nucleo" ? est.nucleoHold.map((n: number, k: number) => (n > 0 ? `${k}:${n}` : "")).join("") : "";
      const cons = est.consagradas && est.consagradas[`${x},${y}`] !== undefined ? `g${est.consagradas[`${x},${y}`]}` : "";
      const muro = est.muros && est.muros.some((m: any) => m.x === x && m.y === y) ? "M" : "";
      const fe = v === 0 ? "" : [c.est || "", ci ? `${ci.dueno}:${ci.nivel}:${ci.capital ? 1 : 0}:${ci.nombre}` : "", fi >= 0 ? `f${fort}` : "", c.saqueada ? "s" : "", c.objetos && c.objetos.length ? "o" : "", hold, cons, muro, v].join("|");
      if (this.firmaEstr[i] !== fe || forzar) { this.firmaEstr[i] = fe; this.rehacerEstructura(i, x, y, c, v, ci, fort); }
    }
    est.regiones.forEach((r: any) => { ft += r.dueno === null ? "n" : r.dueno; });
    if (fv !== this.firmaVis || forzar) {
      this.firmaVis = fv;
      if (this.lienzoNiebla) { pintarNiebla(this.lienzoNiebla, est, vis, RN); (this.textures.get("niebla") as Phaser.Textures.CanvasTexture).refresh(); }
      this.rotulos.forEach(tx => { const id = (tx as any).__rg; let visto = false; for (let y = 0; y < est.alto && !visto; y++) for (let x = 0; x < w; x++) if (est.casillas[y][x].region === id && vis[y * w + x] > 0) { visto = true; break; } tx.setVisible(visto); });
      this.firmaTerr = "";
    }
    if (ft + fv !== this.firmaTerr || forzar) {
      this.firmaTerr = ft + fv;
      if (this.lienzoTerr) { pintarTerritorios(this.lienzoTerr, est, vis, this.bandos.map(b => b.col), RT); (this.textures.get("provincias") as Phaser.Textures.CanvasTexture).refresh(); }
    }
    // Lo que no cambia de un fotograma a otro (vida máxima, rango...) se calcula aquí y no en cada fotograma
    this.datos.clear();
    Object.values(est.unidades).forEach((u: any) => this.datos.set(u.uid, this.datosUnidad(u)));
  }

  /* ===================================================================== lo que crece sobre el terreno */
  private rehacerDecor(i: number, x: number, y: number, c: any, v: number): void {
    this.limpiar(this.decor.get(i)); this.decor.delete(i);
    if (v === 0 || c.t === "vacio") return;
    const lista: Phaser.GameObjects.Image[] = [], sem = this.est.semilla % 997;
    const r = (k: number): number => hash(x, y, sem + k);
    const pon = (clave: string, fx: number, fy: number, tam: number, ox = 0.5, oy = 0.9): Phaser.GameObjects.Image => {
      const im = this.add.image((x + fx) * T, (y + fy) * T, clave).setOrigin(ox, oy).setDisplaySize(tam, tam).setDepth(10 + (y + fy) / 100 - 0.0005);
      lista.push(im); return im;
    };
    const arbol = (v2: number): string => this.tex(`arbol${v2}`, 96, 96, g => pintarArbol(g, 96, v2));
    const roca = (): string => this.tex("roca", 64, 64, g => pintarRoca(g, 64));
    const seco = this.est.tipo === "muertos";
    if (c.t === "bosque") {
      const n = c.est ? 2 : 4;
      for (let k = 0; k < n; k++) {
        const fx = c.est ? (k ? 0.88 : 0.1) : 0.14 + ((k % 2) * 0.5 + r(k * 4) * 0.3), fy = c.est ? 0.4 + r(k) * 0.4 : 0.3 + Math.floor(k / 2) * 0.36 + r(k * 4 + 1) * 0.22;
        pon(arbol(seco && r(k * 4 + 2) > 0.5 ? 3 : Math.floor(r(k * 4 + 2) * 3)), fx, fy, T * (0.56 + r(k * 4 + 3) * 0.2));
      }
    } else if (c.t === "montana") {
      const vp = Math.floor(r(1) * 3);
      if (!c.est) pon(this.tex(`pico${vp}`, 192, 192, g => pintarPico(g, 192, vp)), 0.5, 0.7, T * 1.3, 0.5, 0.92);
      else pon(roca(), 0.14, 0.9, T * 0.4, 0.5, 0.86);
    } else if (c.t === "llanura") {
      if (!c.est && r(2) > 0.88) pon(arbol(seco ? 3 : 1), 0.2 + r(3) * 0.6, 0.3 + r(4) * 0.5, T * 0.5);
      else if (!c.est && r(2) < 0.07) pon(roca(), 0.2 + r(3) * 0.6, 0.3 + r(4) * 0.5, T * 0.3, 0.5, 0.86);
    } else if (c.t === "desierto") {
      if (!c.est && r(2) > 0.8) pon(roca(), 0.2 + r(3) * 0.6, 0.3 + r(4) * 0.5, T * 0.34, 0.5, 0.86).setTint(0xe0c090);
    } else if (c.t === "huesos") {
      if (!c.est) pon(this.tex("calavera", 64, 64, g => pintarCalavera(g, 64)), 0.3 + r(3) * 0.4, 0.4 + r(4) * 0.4, T * 0.44, 0.5, 0.8);
    } else if (c.t === "magica") {
      if (!c.est) {
        const cr = pon(this.tex("cristal", 96, 96, g => pintarCristal(g, 96)), 0.5, 0.7, T * 0.62, 0.5, 0.84);
        const br = this.add.image((x + 0.5) * T, (y + 0.52) * T, "brillo").setDisplaySize(T * 0.9, T * 0.9).setTint(0xb98cff).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.5);
        lista.push(br);
        if (!REDUCIDO) { this.tweens.add({ targets: br, alpha: 0.22, duration: 1100 + (x * 131 + y * 71) % 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); this.tweens.add({ targets: cr, y: cr.y - T * 0.03, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (x * 130 + y * 70) % 900 }); }
      }
    } else if (c.t === "agua") {
      if (r(2) > 0.55) pon(this.tex("juncos", 48, 48, g => pintarJuncos(g, 48)), 0.12 + r(3) * 0.76, 0.2 + r(4) * 0.7, T * 0.3);
      const br = this.add.image((x + 0.3 + r(5) * 0.4) * T, (y + 0.3 + r(6) * 0.4) * T, "brillo").setDisplaySize(T * 0.5, T * 0.16).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      lista.push(br);
      if (!REDUCIDO) this.tweens.add({ targets: br, alpha: 0.28, duration: 1400 + r(7) * 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: r(8) * 2000 });
    }
    this.decor.set(i, lista);
  }

  /* ===================================================================== estructuras */
  private brillo(x: number, y: number, tam: number, color: number, alfa: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, "brillo").setDisplaySize(tam, tam).setTint(color).setAlpha(alfa).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.5);
  }

  private rehacerEstructura(i: number, x: number, y: number, c: any, v: number, ci: any, fort: number | null): void {
    this.limpiar(this.estr.get(i)); this.estr.delete(i);
    if (v === 0) return;
    const est = this.est, X = x * T, Y = y * T, lista: Obj[] = [];
    const prof = 10 + (y + 0.8) / 100 - 0.001;
    const pon = (clave: string, tam: number, fy = 0.82): Phaser.GameObjects.Image => { const im = this.add.image(X + T / 2, Y + T * fy, clave).setOrigin(0.5, 0.8).setDisplaySize(tam, tam).setDepth(prof); lista.push(im); return im; };
    const bandera = (d: number, bx: number, by: number, alto: number): void => {
      const b = this.bandos[d];
      const clave = this.tex(`ban:${b.col}:${b.forma}`, 80, 80, g => pintarBandera(g, 80, b.col, b.forma));
      const im = this.add.image(X + bx * T, Y + by * T, clave).setOrigin(6 / 40, 38 / 40).setDisplaySize(alto, alto).setDepth(prof + 0.0005);
      lista.push(im);
      if (!REDUCIDO) this.tweens.add({ targets: im, angle: { from: -3, to: 4 }, duration: 800 + (x + y) * 40, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    };
    if (est.consagradas && est.consagradas[`${x},${y}`] !== undefined) {
      const gl = this.add.image(X + T / 2, Y + T / 2, this.tex("glifo", 96, 96, g => pintarGlifo(g, 96))).setDisplaySize(T * 0.86, T * 0.86).setDepth(2.2).setAlpha(0.75);
      lista.push(gl);
    }
    if (est.muros && est.muros.some((m: any) => m.x === x && m.y === y)) { const mu = pon(this.tex("muro", 128, 128, g => pintarMuro(g, 128)), T * 1.05); if (!REDUCIDO) this.tweens.add({ targets: mu, alpha: 0.7, duration: 700, yoyo: true, repeat: -1 }); }
    if (c.est === "ciudad" && ci) {
      const neutral = ci.dueno === null, col = neutral ? "#8a8a8a" : this.bandos[ci.dueno].col;
      const nivel = Math.min(4, ci.nivel);
      pon(this.tex(`ciudad:${col}:${nivel}:${ci.capital ? 1 : 0}`, 192, 192, g => pintarCiudad(g, 192, { col, nivel, capital: !!ci.capital, neutral })), T * (ci.capital ? 1.28 : 1.12));
      if (!neutral) bandera(ci.dueno, ci.capital ? 0.5 : 0.8, ci.capital ? 0.12 : 0.34, T * 0.5);
      // rótulo con el nombre, el color del dueño y el nivel
      const tx = this.add.text(X + T / 2, Y + T * 1.0, `${ci.capital ? "★ " : ""}${ci.nombre}`, { fontFamily: "Cinzel, Georgia, serif", fontSize: `${Math.round(T * 0.135)}px`, color: v === 2 ? "#f6eeda" : "#a59f92", stroke: "#08060c", strokeThickness: 4 })
        .setOrigin(0.5, 0).setDepth(28).setResolution(2);
      const gr = this.add.graphics().setDepth(27.9);
      const bw = tx.width + T * 0.22, bh = tx.height + 4;
      gr.fillStyle(0x0b0910, 0.78).fillRect(X + T / 2 - bw / 2, Y + T * 1.0 - 2, bw, bh);
      gr.fillStyle(neutral ? 0x8a8a8a : colorNum(col), 1).fillRect(X + T / 2 - bw / 2, Y + T * 1.0 - 2, T * 0.05, bh);
      for (let k = 0; k < ci.nivel; k++) gr.fillStyle(0xe3bb4e, 0.9).fillRect(X + T / 2 - bw / 2 + T * 0.08 + k * 5, Y + T * 1.0 + bh - 5, 3.4, 2);
      lista.push(gr, tx);
    } else if (c.est === "fortaleza") {
      pon(this.tex("fortaleza", 192, 192, g => pintarFortaleza(g, 192)), T * 1.1);
      if (fort !== null && fort !== undefined) bandera(fort, 0.5, 0.2, T * 0.46);
    } else if (c.est === "ruinas") {
      pon(this.tex(`ruinas:${c.saqueada ? 1 : 0}`, 160, 160, g => pintarRuinas(g, 160, !!c.saqueada)), T * 1.0);
      if (!c.saqueada) { const br = this.brillo(X + T / 2, Y + T * 0.74, T * 0.46, 0xf0d278, 0.45); lista.push(br); if (!REDUCIDO) this.tweens.add({ targets: br, alpha: 0.15, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); }
    } else if (c.est === "nucleo") {
      const an = this.add.image(X + T / 2, Y + T / 2, this.tex("nucleo0", 192, 192, g => pintarNucleo(g, 192, 0))).setDisplaySize(T * 1.2, T * 1.2).setDepth(2.3);
      const co = this.add.image(X + T / 2, Y + T / 2, this.tex("nucleo1", 128, 128, g => pintarNucleo(g, 128, 1))).setDisplaySize(T * 0.8, T * 0.8).setDepth(2.4).setBlendMode(Phaser.BlendModes.ADD);
      const br = this.brillo(X + T / 2, Y + T / 2, T * 1.5, 0xf0d278, 0.3);
      lista.push(an, co, br);
      if (!REDUCIDO) { this.tweens.add({ targets: an, angle: 360, duration: 26000, repeat: -1 }); this.tweens.add({ targets: co, scale: co.scale * 1.18, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); }
      const lleva = est.nucleoHold.map((n: number, k: number) => ({ n, k })).filter((o: any) => o.n > 0)[0];
      if (lleva) {
        const tx = this.add.text(X + T / 2, Y + T * 0.94, `${lleva.n} / ${est.hold}`, { fontFamily: "Cinzel, Georgia, serif", fontSize: `${Math.round(T * 0.2)}px`, color: this.bandos[lleva.k].col, stroke: "#050304", strokeThickness: 5 }).setOrigin(0.5).setDepth(28).setResolution(2);
        lista.push(tx);
      }
    } else if (c.est === "costura") {
      const an = this.add.image(X + T / 2, Y + T / 2, this.tex("costura", 160, 160, g => pintarCostura(g, 160))).setDisplaySize(T * 0.96, T * 0.96).setDepth(2.4);
      const br = this.brillo(X + T / 2, Y + T / 2, T * 0.9, 0x8fe3e6, 0.4);
      lista.push(an, br);
      if (!REDUCIDO) { this.tweens.add({ targets: an, angle: 360, duration: 9000, repeat: -1 }); this.tweens.add({ targets: br, alpha: 0.18, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); }
    }
    if (c.objetos && c.objetos.length) {
      const gm = this.add.image(X + T * 0.78, Y + T * 0.3, this.tex("gema", 64, 64, g => pintarGema(g, 64))).setDisplaySize(T * 0.3, T * 0.3).setDepth(26);
      const br = this.brillo(X + T * 0.78, Y + T * 0.3, T * 0.5, 0xf6d46c, 0.4).setDepth(25.9);
      lista.push(gm, br);
      if (!REDUCIDO) this.tweens.add({ targets: [gm, br], y: Y + T * 0.22, duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.estr.set(i, lista);
  }

  /* ===================================================================== unidades */
  instantanea(): Map<string, any> {
    const m = new Map<string, any>();
    if (!this.est) return m;
    Object.values(this.est.unidades).forEach((u: any) => m.set(u.uid, this.datosUnidad(u)));
    return m;
  }

  private datosUnidad(u: any): any {
    const FM = W.FracturaMotor, S = W.FracturaSoldados;
    return {
      uid: u.uid, clase: u.clase, heroe: u.heroe || null, dueno: u.dueno, x: u.x, y: u.y, hp: u.hp, hpMax: FM.ef(this.est, u).hpMax, lider: !!u.lider,
      faccion: u.dueno >= 0 ? this.est.jugadores[u.dueno].faccion : null,
      cap: !!(u.s && u.s.capitan), rango: u.s ? S.rangoIndice(u.s.victorias + (u.vicG || 0)) : 0
    };
  }

  private texFigura(d: any, pose: string): string {
    const bando = d.dueno >= 0 ? this.bandos[d.dueno] : { col: "#8c8c8c", ban: "#3a3a3a" };
    const clave = `u:${d.faccion}:${d.clase}:${d.heroe || ""}:${bando.col}:${pose}:${d.cap ? 1 : 0}`;
    const w = Math.round(FIG * 2.3), h = Math.round(FIG * 2.1), p = POSES[pose];
    this.tex(clave, w, h, g => {
      W.FracturaFiguras.figura(g, { faccion: d.faccion, clase: d.clase, heroe: d.heroe }, bando, { x: w / 2, y: h * 0.86, s: FIG * 0.95, dir: 1, mov: p.mov, fase: p.fase, sw: p.sw, t: 1.3, cap: d.cap, rango: d.rango });
    });
    return clave;
  }

  /* Marca de bando: una forma distinta por puesto, para no depender solo del color */
  private formaBando(g: Phaser.GameObjects.Graphics, k: number, x: number, y: number, r: number, col: number): void {
    g.fillStyle(0x08060c, 0.9).fillCircle(x, y, r * 1.34);
    g.fillStyle(col, 1);
    const lados = [0, 3, 4, 4, 5, 6, 4, 8][k % 8], giro = [0, -Math.PI / 2, Math.PI / 4, 0, -Math.PI / 2, 0, 0, Math.PI / 8][k % 8];
    if (!lados) { g.fillCircle(x, y, r); return; }
    if (k % 8 === 6) { g.fillRect(x - r, y - r * 0.34, r * 2, r * 0.68); g.fillRect(x - r * 0.34, y - r, r * 0.68, r * 2); return; }
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < lados; i++) pts.push(new Phaser.Math.Vector2(x + Math.cos(giro + (i * 2 * Math.PI) / lados) * r * 1.12, y + Math.sin(giro + (i * 2 * Math.PI) / lados) * r * 1.12));
    g.fillPoints(pts, true);
  }

  private pintarUnidades(t: number): void {
    const est = this.est, H = this.humano(), vis = this.visDe(), FM = W.FracturaMotor;
    const lista: Array<{ d: any; v: any }> = [];
    if (this.anim) {
      this.anim.vis.forEach((v: any, uid: string) => {
        if (v.oculto || (v.alfa === 0 && !est.unidades[uid])) return;
        const logica = est.unidades[uid];
        const d = v.d || (logica ? this.datosUnidad(logica) : null);
        if (d) lista.push({ d, v });
      });
    } else Object.values(est.unidades).forEach((u: any) => {
      let d = this.datos.get(u.uid);
      if (!d) { d = this.datosUnidad(u); this.datos.set(u.uid, d); }
      d.x = u.x; d.y = u.y; d.hp = u.hp; d.dueno = u.dueno;
      lista.push({ d, v: null });
    });
    const usados = new Set<string>();
    const ve = this.vista();
    const g = this.gBarras;
    g.clear();
    lista.forEach(it => {
      const d = it.d, a = it.v || {};
      const X = a.x !== undefined ? a.x : d.x, Y = a.y !== undefined ? a.y : d.y;
      const tx = Math.round(X), ty = Math.round(Y);
      const visible = (d.dueno >= 0 && FM.mismoEquipo(est, d.dueno, H)) || (ty >= 0 && ty < est.alto && tx >= 0 && tx < est.ancho && vis[ty * est.ancho + tx] === 2);
      if (!visible) return;
      usados.add(d.uid);
      let o = this.unidades.get(d.uid);
      // fuera de la pantalla: ni se coloca ni se le pintan las barras
      if (X < ve.x0 - 2 || X > ve.x1 + 1 || Y < ve.y0 - 2 || Y > ve.y1 + 1) { if (o) o.spr.setVisible(false); return; }
      if (o) o.spr.setVisible(true);
      if (!o) { o = { spr: this.add.image(0, 0, this.texFigura(d, "idle")).setOrigin(0.5, 0.86), clave: "" }; this.unidades.set(d.uid, o); }
      const hp = a.hp !== undefined ? a.hp : d.hp;
      let pose = "idle";
      if (a.mov) pose = Math.floor(t / 110) % 2 ? "w2" : "w1";
      else if (a.sw > 0.7) pose = "a2"; else if (a.sw > 0.25) pose = "a1"; else if (a.sw < -0.2) pose = "a0";
      const clave = this.texFigura(d, pose);
      if (o.clave !== clave) { o.spr.setTexture(clave); o.clave = clave; }
      const elegida = this.ui.sel === d.uid && !this.anim;
      const idle = REDUCIDO ? 0 : Math.sin(t / 420 + d.uid.length * 1.7 + (d.x * 3 + d.y)) * T * 0.012;
      const salto = elegida && !REDUCIDO ? Math.abs(Math.sin(t / 260)) * T * 0.04 : 0;
      const paso = a.mov ? Math.abs(Math.sin((a.fase || 0) * 2)) * T * 0.04 : 0;
      const cxp = (X + 0.5 + (a.dx || 0)) * T, cyp = (Y + 0.86 + (a.dy || 0)) * T - idle - salto - paso;
      // Por defecto cada tropa mira hacia el centro del mapa (hacia donde está la guerra)
      const dir = a.dir || (d.x + 0.5 < est.ancho / 2 ? 1 : -1);
      o.spr.setPosition(cxp, cyp).setScale(T / FIG).setFlipX(dir < 0).setDepth(10 + (Y + 0.86) / 100);
      o.spr.setRotation(a.rot ? a.rot : 0).setAlpha(a.alfa !== undefined ? a.alfa : 1);
      const logica = est.unidades[d.uid];
      const gastada = !this.anim && logica && d.dueno === est.activo && d.dueno === H && logica.pm <= 0 && logica.atacado;
      if (a.flash > 0.15) o.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (gastada) o.spr.setTint(0x8a8794).setTintMode(Phaser.TintModes.MULTIPLY);
      else o.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      // vida y marca del bando
      if (a.alfa === undefined || a.alfa > 0.4) {
        const bw = T * 0.6, f = Math.max(0, Math.min(1, hp / d.hpMax)), by = cyp + T * 0.085, bh = Math.max(5, T * 0.07), bx = cxp - bw / 2 + T * 0.07;
        const col = d.dueno >= 0 ? colorNum(this.bandos[d.dueno].col) : 0x9a9a9a;
        g.fillStyle(0x060408, 0.92).fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
        g.fillStyle(f > 0.5 ? 0x74c75e : f > 0.25 ? 0xe6bd4a : 0xdc5a4c, 1).fillRect(bx, by, bw * f, bh);
        g.fillStyle(0xffffff, 0.22).fillRect(bx, by, bw * f, bh * 0.38);
        // muescas cada 5 de vida: se cuenta de un vistazo
        g.fillStyle(0x060408, 0.6);
        for (let k = 5; k < d.hpMax; k += 5) g.fillRect(bx + (bw * k) / d.hpMax - 0.6, by, 1.2, bh);
        if (d.dueno >= 0) this.formaBando(g, d.dueno, bx - T * 0.075, by + bh / 2, T * 0.062, col);
        // galones de rango, corona de líder y estrella de héroe
        for (let k = 0; k < Math.min(4, d.rango || 0); k++) g.fillStyle(0xf0cf6a, 1).fillRect(bx + bw + 3, by + bh - 2.4 - k * 3.4, T * 0.07, 2.2);
        if (d.heroe || d.lider) {
          const yy = cyp - T * (d.heroe ? 1.36 : 1.3) + Math.sin(t / 380) * 2;
          g.fillStyle(0x08060c, 0.85).fillCircle(cxp, yy, T * 0.085);
          g.fillStyle(d.heroe ? 0xfff0a0 : 0xf0cf6a, 1);
          if (d.heroe) { const pts: Phaser.Math.Vector2[] = []; for (let k = 0; k < 10; k++) { const rr = k % 2 ? T * 0.03 : T * 0.07, an = -Math.PI / 2 + (k * Math.PI) / 5; pts.push(new Phaser.Math.Vector2(cxp + Math.cos(an) * rr, yy + Math.sin(an) * rr)); } g.fillPoints(pts, true); }
          else { g.fillRect(cxp - T * 0.05, yy - T * 0.01, T * 0.1, T * 0.04); g.fillTriangle(cxp - T * 0.05, yy - T * 0.01, cxp - T * 0.03, yy - T * 0.01, cxp - T * 0.05, yy - T * 0.055); g.fillTriangle(cxp + T * 0.05, yy - T * 0.01, cxp + T * 0.03, yy - T * 0.01, cxp + T * 0.05, yy - T * 0.055); g.fillTriangle(cxp - T * 0.02, yy - T * 0.01, cxp + T * 0.02, yy - T * 0.01, cxp, yy - T * 0.06); }
        }
        // puede actuar todavía: un punto encendido junto a la barra
        if (!this.anim && logica && d.dueno === H && est.activo === H && est.ganador === null && (logica.pm > 0 || !logica.atacado)) {
          const lat = 0.6 + 0.4 * Math.sin(t / 300 + d.x);
          g.fillStyle(0xfff0a0, lat).fillCircle(bx + bw + T * 0.06, by - T * 0.06, T * 0.03);
        }
      }
    });
    this.unidades.forEach((o, uid) => { if (!usados.has(uid)) { o.spr.destroy(); this.unidades.delete(uid); } });
  }

  /* ===================================================================== resaltes */
  private zona(claves: Iterable<string>, color: number, borde: number, alfa: number, t: number): void {
    const g = this.gRes, set = new Set(claves), lw = Math.max(3, T * 0.045);
    const pulso = REDUCIDO ? 1 : 0.82 + 0.18 * Math.sin(t / 380);
    set.forEach(k => {
      const [x, y] = k.split(",").map(Number), X = x * T, Y = y * T;
      g.fillStyle(color, alfa).fillRect(X, Y, T, T);
      g.fillStyle(borde, 0.95 * pulso);
      if (!set.has(`${x + 1},${y}`)) g.fillRect(X + T - lw, Y, lw, T);
      if (!set.has(`${x - 1},${y}`)) g.fillRect(X, Y, lw, T);
      if (!set.has(`${x},${y + 1}`)) g.fillRect(X, Y + T - lw, T, lw);
      if (!set.has(`${x},${y - 1}`)) g.fillRect(X, Y, T, lw);
    });
  }
  private esquinas(x: number, y: number, color: number, alfa: number, lw: number, largo: number, margen: number): void {
    const g = this.gRes, X = x * T + margen, Y = y * T + margen, A = T - margen * 2, L = T * largo;
    g.lineStyle(lw, color, alfa);
    for (const [a, b, dx, dy] of [[X, Y, 1, 1], [X + A, Y, -1, 1], [X, Y + A, 1, -1], [X + A, Y + A, -1, -1]]) { g.beginPath(); g.moveTo(a, b + dy * L); g.lineTo(a, b); g.lineTo(a + dx * L, b); g.strokePath(); }
  }

  private pintarResaltes(t: number): void {
    const g = this.gRes, est = this.est, ui = this.ui;
    g.clear();
    let nMarca = 0;
    const marca = (x: number, y: number, tinte: number): void => {
      let m = this.marcas[nMarca];
      if (!m) { m = this.add.image(0, 0, "espadas").setDepth(29); this.marcas.push(m); }
      m.setVisible(true).setPosition((x + 0.5) * T, (y - 0.34) * T + (REDUCIDO ? 0 : Math.sin(t / 240 + x) * T * 0.04)).setDisplaySize(T * 0.4, T * 0.4).setTint(tinte);
      nMarca++;
    };
    if (ui.amenaza && ui.amenaza.size) this.zona(ui.amenaza, 0xc83228, 0xd4574a, 0.1, t);
    if (!this.anim && ui.mover.size) this.zona(ui.mover.keys(), 0x5fd2ff, 0xa8ecff, 0.16, t);
    if (ui.objetivosHab.size) this.zona(ui.objetivosHab, 0x9678ff, 0xc9b6ff, 0.24, t);
    if (ui.ruta && ui.ruta.length > 1) {
      const pts = ui.ruta.map((p: any) => this.centro(p.x, p.y));
      const paso = T * 0.2, off = REDUCIDO ? 0 : (t / 30) % paso;
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], b = pts[s + 1], L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        for (let p = off; p < L; p += paso) { g.fillStyle(0x0a0810, 0.6).fillCircle(a.x + ux * p, a.y + uy * p, T * 0.062); g.fillStyle(0xfff4d6, 1).fillCircle(a.x + ux * p, a.y + uy * p, T * 0.042); }
      }
      const f = pts[pts.length - 1], pv = pts[pts.length - 2], an = Math.atan2(f.y - pv.y, f.x - pv.x), r = T * 0.17;
      g.fillStyle(0x0a0810, 0.65).fillCircle(f.x, f.y, r * 1.1);
      g.fillStyle(0xfff4d6, 1).fillTriangle(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r, f.x + Math.cos(an + 2.4) * r, f.y + Math.sin(an + 2.4) * r, f.x + Math.cos(an - 2.4) * r, f.y + Math.sin(an - 2.4) * r);
    }
    if (!this.anim) ui.atacar.forEach((k: string) => {
      const [x, y] = k.split(",").map(Number), m = REDUCIDO ? 0.5 : Math.sin(t / 220) * 0.5 + 0.5;
      g.fillStyle(0xc83228, 0.14 + m * 0.12).fillRect(x * T, y * T, T, T);
      this.esquinas(x, y, 0xff6b5e, 1, Math.max(3, T / 20), 0.3, (2 - m * 1.5) * 3);
      marca(x, y, ui.previaAtq && ui.previaAtq.x === x && ui.previaAtq.y === y ? 0xffffff : 0xffb4a8);
    });
    for (let k = nMarca; k < this.marcas.length; k++) this.marcas[k].setVisible(false);
    if (ui.previaAtq) this.esquinas(ui.previaAtq.x, ui.previaAtq.y, 0xffe3a0, 1, Math.max(3, T / 20), 0.34, 5);
    const u = ui.sel && est.unidades[ui.sel];
    if (u && !this.anim) {
      this.aroSel.setVisible(true).setPosition((u.x + 0.5) * T, (u.y + 0.86) * T).setDisplaySize(T * 0.92, T * 0.34).setTint(0xfff0b0);
      if (!REDUCIDO) this.aroSel.setAlpha(0.75 + 0.25 * Math.sin(t / 200));
    } else this.aroSel.setVisible(false);
    if (ui.casilla) this.esquinas(ui.casilla.x, ui.casilla.y, 0xf2cf6a, 1, Math.max(2.5, T / 26), 0.28, 4);
    if (ui.ciudad && est.ciudades[ui.ciudad]) { const c = est.ciudades[ui.ciudad]; this.esquinas(c.x, c.y, 0xf2cf6a, 1, Math.max(3, T / 20), 0.34, 2); }
    if (ui.hover && !this.anim) this.esquinas(ui.hover.x, ui.hover.y, 0xfff4d6, 0.7, Math.max(2, T / 30), 0.22, 2);
  }

  /* ===================================================================== animaciones por eventos */
  private construir(evs: any[], rapidez: number): { items: any[]; total: number } {
    const items: any[] = [];
    let cursor = 0, ultimoGolpe = 0;
    const k = (rapidez || 1) / this.rapidez;
    const add = (tipo: string, dur: number, datos: any, alLado = false): void => {
      const ini = alLado ? Math.max(0, ultimoGolpe + 150 * k) : cursor;
      items.push(Object.assign({ tipo, ini, dur: dur * k, hecho: false }, datos));
      if (!alLado) cursor += dur * k;
    };
    evs.forEach(e => {
      if (e.k === "mov") { const pasos = Math.max(1, (e.ruta || [e.de, e.a]).length - 1); add("mov", Math.min(900, 150 * pasos + 120), { uid: e.uid, ruta: e.ruta && e.ruta.length > 1 ? e.ruta : [e.de, e.a] }); }
      else if (e.k === "golpe") {
        if (e.arma === "salpica") add("golpe", 260, { de: e.de, a: e.a, x: e.x, y: e.y, dmg: e.dmg, arma: e.arma, lejos: false, quieto: true }, true);
        else { ultimoGolpe = cursor; const lejos = e.dist > 1.5 || e.arma === "polvora" || e.arma === "magia"; add("golpe", lejos ? 520 : 440, { de: e.de, a: e.a, x: e.x, y: e.y, dmg: e.dmg, arma: e.arma || (lejos ? "flecha" : "filo"), lejos }); }
      } else if (e.k === "muerte") add("muerte", 480, { uid: e.uid, x: e.x, y: e.y });
      else if (e.k === "nuevo") add("nuevo", 300, { uid: e.uid, x: e.x, y: e.y });
      else if (e.k === "heroe") add("heroe", 900, { uid: e.uid, x: e.x, y: e.y, dueno: e.dueno });
      else if (e.k === "captura") add("captura", 420, { x: e.x, y: e.y, dueno: e.dueno });
      else if (e.k === "explosion") { ultimoGolpe = cursor; add("explosion", 360, { x: e.x, y: e.y }); }
      else if (e.k === "cura") add("cura", 300, { uid: e.uid, x: e.x, y: e.y, n: e.n }, true);
      else if (e.k === "consagra" || e.k === "aura" || e.k === "muro") add("onda", 380, { x: e.x, y: e.y, que: e.k, dueno: e.dueno });
      else if (e.k === "mejora") add("texto", 500, { x: e.x, y: e.y, texto: e.texto });
    });
    return { items, total: cursor };
  }

  reproducir(evs: any[], antesSnap: Map<string, any> | null, opciones?: any): void {
    opciones = opciones || {};
    if (!evs || !evs.length || REDUCIDO) { this.sincronizar(false); if (opciones.alTerminar) opciones.alTerminar(); return; }
    if (!this.anim) {
      const base = antesSnap || this.instantanea();
      const vis = new Map<string, any>();
      base.forEach((d: any, uid: string) => vis.set(uid, { d, x: d.x, y: d.y, hp: d.hp, alfa: 1, dir: 0 }));
      Object.values(this.est.unidades).forEach((u: any) => { if (!vis.has(u.uid)) vis.set(u.uid, { d: this.datosUnidad(u), x: u.x, y: u.y, hp: u.hp, alfa: 0, oculto: true, dir: 0 }); });
      this.anim = { vis, items: [], total: 0, t0: performance.now(), alTerminar: [], seguir: !!opciones.seguir };
    }
    const pulso = this.construir(evs, opciones.rapidez);
    pulso.items.forEach(i => { i.ini += Math.max(this.anim.total, 0); this.anim.items.push(i); });
    this.anim.total += pulso.total;
    const tope = opciones.tope || 6000;
    if (this.anim.total > tope) { const f = tope / this.anim.total; this.anim.items.forEach((i: any) => { i.ini *= f; i.dur *= f; }); this.anim.total = tope; }
    if (opciones.alTerminar) this.anim.alTerminar.push(opciones.alTerminar);
    if (opciones.seguir) this.anim.seguir = true;
  }

  saltar(): void { if (this.anim) this.anim.t0 -= 1e6; }
  ocupado(): boolean { return !!this.anim; }
  alTerminar(f: () => void): void { if (this.anim) this.anim.alTerminar.push(f); else f(); }

  private terminarAnim(): void {
    const cbs = this.anim ? this.anim.alTerminar : [];
    this.anim = null;
    this.sincronizar(true);
    cbs.forEach((f: () => void) => { try { f(); } catch (e) { console.warn(e); } });
  }

  private visibleEn(x: number, y: number): boolean {
    const est = this.est, vis = this.visDe(), ex = Math.round(x), ey = Math.round(y);
    return ex >= 0 && ey >= 0 && ex < est.ancho && ey < est.alto && vis[ey * est.ancho + ex] === 2;
  }
  /* Durante el turno de los demás la vista acompaña a lo que pasa, si se ve y queda fuera de pantalla */
  private acompanar(x: number, y: number): void {
    if (!this.anim || !this.anim.seguir || !this.seguirAccion || !this.visibleEn(x, y) || this.enPantalla(x, y)) return;
    this.irA(x, y, true);
  }

  private pasoAnim(ahora: number): void {
    const A = this.anim;
    if (!A) return;
    const t = ahora - A.t0;
    const saltando = t > 5e5;
    if (t > A.total + 420 || t > 20000) { this.terminarAnim(); return; }
    A.vis.forEach((v: any) => { v.mov = false; v.sw = 0; v.flash = 0; v.dx = 0; v.dy = 0; });
    A.items.forEach((it: any) => {
      const lt = t - it.ini;
      if (lt < 0) return;
      const p = Math.min(1, lt / Math.max(1, it.dur));
      if (!it.visto) { it.visto = true; if (!saltando && it.x !== undefined) this.acompanar(it.x, it.y); else if (!saltando && it.ruta) this.acompanar(it.ruta[it.ruta.length - 1].x, it.ruta[it.ruta.length - 1].y); }
      if (it.tipo === "mov") {
        const v = A.vis.get(it.uid); if (!v) return;
        const r = it.ruta, tramos = r.length - 1;
        const q = ease(p) * tramos, i = Math.min(tramos - 1, Math.floor(q)), f = q - i;
        v.x = lerp(r[i].x, r[i + 1].x, f); v.y = lerp(r[i].y, r[i + 1].y, f);
        const ddx = r[i + 1].x - r[i].x;
        if (ddx) v.dir = ddx > 0 ? 1 : -1;
        v.mov = p < 1; v.fase = (t / 90) % 6.283;
        if (!saltando && v.mov && Math.floor(q * 2) !== it.pisada && this.visibleEn(v.x, v.y)) { it.pisada = Math.floor(q * 2); this.sonar("paso"); }
        if (p >= 1 && !it.hecho) { it.hecho = true; v.x = r[tramos].x; v.y = r[tramos].y; if (!saltando) this.polvo(r[tramos].x, r[tramos].y); }
      } else if (it.tipo === "golpe") {
        const v = A.vis.get(it.de), o = A.vis.get(it.a);
        if (v && !it.quieto) {
          const dx = it.x - v.x, dy = it.y - v.y, L = Math.hypot(dx, dy) || 1;
          if (it.lejos) { v.sw = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55; v.dx = -(dx / L) * 0.05 * Math.sin(p * 3.14); }
          else {
            const avance = p < 0.3 ? -0.12 * (p / 0.3) : p < 0.5 ? lerp(-0.12, 0.36, (p - 0.3) / 0.2) : lerp(0.36, 0, (p - 0.5) / 0.5);
            v.dx = (dx / L) * avance; v.dy = (dy / L) * avance;
            v.sw = p < 0.3 ? (p / 0.3) * -0.5 : p < 0.5 ? lerp(-0.5, 1, (p - 0.3) / 0.2) : lerp(1, 0, (p - 0.5) / 0.5);
          }
          if (dx) v.dir = dx > 0 ? 1 : -1;
        }
        const momento = it.lejos ? 0.42 : 0.5;
        if (it.lejos && !it.lanzado && p >= 0.3 && v) { it.lanzado = true; if (!saltando) { this.proyectil(v.x, v.y, it.x, it.y, it.arma, it.dur * 0.2); this.sonar(it.arma === "polvora" ? "polvora" : it.arma === "magia" ? "magia" : "flecha"); } }
        if (p >= momento && !it.hecho) {
          it.hecho = true;
          if (o) o.hp = Math.max(0, o.hp - it.dmg);
          if (!saltando) {
            this.texto(it.x, it.y, it.dmg > 0 ? `-${it.dmg}` : "Parado", it.dmg > 0 ? "#ffd0c8" : "#fff6c8");
            this.impacto(it.x, it.y, it.arma, v ? Math.atan2(it.y - v.y, it.x - v.x) : 0);
            if (!it.lejos && this.visibleEn(it.x, it.y)) this.sonar(it.arma === "salpica" ? "salpica" : it.dmg > 0 ? "golpe" : "parada");
            if (it.dmg >= 6 && this.visibleEn(it.x, it.y)) this.cameras.main.shake(140, 0.004);
          }
        }
        if (o && p >= momento && p < momento + 0.4) {
          const kk = (p - momento) / 0.4, dxo = it.x - (v ? v.x : it.x), dyo = it.y - (v ? v.y : it.y), L = Math.hypot(dxo, dyo) || 1;
          o.flash = it.dmg > 0 ? 1 - kk : 0; o.dx = (dxo / L) * 0.1 * Math.sin(kk * 3.14); o.dy = (dyo / L) * 0.1 * Math.sin(kk * 3.14);
        }
      } else if (it.tipo === "muerte") {
        const v = A.vis.get(it.uid); if (!v) return;
        v.alfa = 1 - p; v.rot = p * 1.35 * (v.dir || 1); v.dy = p * 0.12; v.flash = Math.max(0, 0.6 - p);
        if (!it.sonado) { it.sonado = true; if (!saltando && this.visibleEn(it.x, it.y)) this.sonar("muerte"); }
        if (p >= 1 && !it.hecho) { it.hecho = true; if (!saltando) this.texto(it.x, it.y, "✝", "#ffffff"); }
      } else if (it.tipo === "nuevo") {
        const v = A.vis.get(it.uid); if (!v) return;
        v.oculto = false; v.alfa = ease(p); v.dy = (1 - p) * -0.15;
        if (!it.hecho) { it.hecho = true; if (!saltando && this.visibleEn(it.x, it.y)) { this.onda(it.x, it.y, "#fff0b0"); this.sonar("nuevo"); } }
      } else if (it.tipo === "heroe") {
        const v = A.vis.get(it.uid); if (!v) return;
        v.oculto = false; v.alfa = ease(Math.min(1, p * 1.6)); v.flash = Math.max(0, 1 - p * 1.4);
        if (!it.hecho) { it.hecho = true; if (!saltando && this.visibleEn(it.x, it.y)) { this.columna(it.x, it.y, this.bandos[it.dueno] ? this.bandos[it.dueno].col : "#fff0b0"); this.sonar("heroe"); this.cameras.main.shake(260, 0.004); } }
      } else if (it.tipo === "captura") {
        if (!it.hecho && p > 0.2) { it.hecho = true; if (!saltando && this.visibleEn(it.x, it.y)) { this.onda(it.x, it.y, this.bandos[it.dueno] ? this.bandos[it.dueno].col : "#ffffff"); this.sonar("captura"); } }
      } else if (it.tipo === "explosion") {
        if (!it.hecho) { it.hecho = true; if (!saltando && this.visibleEn(it.x, it.y)) { this.explosion(it.x, it.y); this.sonar("explosion"); this.cameras.main.shake(220, 0.007); } }
      } else if (it.tipo === "cura") {
        const v = A.vis.get(it.uid);
        if (!it.hecho) { it.hecho = true; if (v) v.hp = Math.min(v.d ? v.d.hpMax : 99, v.hp + (it.n || 0)); if (!saltando && this.visibleEn(it.x, it.y)) { this.texto(it.x, it.y, `+${it.n}`, "#b6f2a0"); this.sonar("cura"); } }
      } else if (it.tipo === "onda") {
        if (!it.hecho) { it.hecho = true; if (!saltando && this.visibleEn(it.x, it.y)) { this.onda(it.x, it.y, it.que === "consagra" ? "#ffe9a6" : it.que === "muro" ? "#b98cff" : "#fff0b0", 4.6); this.sonar(it.que === "consagra" ? "consagra" : "magia"); } }
      } else if (it.tipo === "texto") {
        if (!it.hecho) { it.hecho = true; if (!saltando) this.texto(it.x, it.y, it.texto, "#e8ff7a"); }
      }
    });
  }

  /* ===================================================================== efectos */
  texto(x: number, y: number, t: string, color: string): void {
    if (!this.est || !this.visibleEn(x, y)) return;
    this.actividad = performance.now();
    const c = this.centro(x, y);
    const tx = this.add.text(c.x, c.y - T * 0.3, t, { fontFamily: "Cinzel, Georgia, serif", fontSize: `${Math.round(T * (t.length > 4 ? 0.24 : 0.44))}px`, fontStyle: "bold", color, stroke: "#050304", strokeThickness: Math.max(4, T * 0.07) }).setOrigin(0.5).setDepth(40).setResolution(2).setScale(0.6);
    this.tweens.add({ targets: tx, scale: 1, duration: 140, ease: "Back.easeOut" });
    this.tweens.add({ targets: tx, y: c.y - T * 1.0, alpha: { from: 1, to: 0 }, duration: 950, ease: "Quad.easeOut", onComplete: () => tx.destroy() });
  }

  private impacto(x: number, y: number, arma: string, ang: number): void {
    if (!this.visibleEn(x, y)) return;
    const c = this.centro(x, y);
    if (arma === "filo") {
      const tj = this.add.image(c.x, c.y - T * 0.1, "tajo").setDisplaySize(T * 0.95, T * 0.95).setRotation(ang - 0.6).setDepth(31).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
      this.tweens.add({ targets: tj, alpha: 0, rotation: ang + 0.5, duration: 220, ease: "Quad.easeOut", onComplete: () => tj.destroy() });
    }
    const color = arma === "magia" || arma === "salpica" ? 0xc9a6ff : arma === "polvora" ? 0xffd27a : 0xfff4c4;
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + 0.3, r0 = T * 0.08, r1 = T * (0.3 + (k % 3) * 0.1);
      const s = this.add.rectangle(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, Math.max(3, T * 0.05), Math.max(3, T * 0.05), color).setDepth(31).setRotation(a);
      this.tweens.add({ targets: s, x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1, alpha: 0, duration: 300, ease: "Quad.easeOut", onComplete: () => s.destroy() });
    }
    const fl = this.add.image(c.x, c.y, "brillo").setDisplaySize(T * 0.9, T * 0.9).setTint(color).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
    this.tweens.add({ targets: fl, alpha: 0, scale: fl.scale * 1.5, duration: 260, onComplete: () => fl.destroy() });
  }

  private polvo(x: number, y: number): void {
    if (!this.visibleEn(x, y)) return;
    const c = this.centro(x, y);
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.5;
      const p = this.add.image(c.x + a * T * 0.14, c.y + T * 0.34, "humo").setDisplaySize(T * 0.16, T * 0.16).setTint(0xd8cfbd).setAlpha(0.5).setDepth(9.5);
      this.tweens.add({ targets: p, x: c.x + a * T * 0.4, y: c.y + T * 0.22, scale: p.scale * 2.2, alpha: 0, duration: 460, onComplete: () => p.destroy() });
    }
  }

  onda(x: number, y: number, color: string, radio = 3.4): void {
    if (!this.est) return;
    this.actividad = performance.now();
    const c = this.centro(x, y);
    const an = this.add.image(c.x, c.y, "anillo").setTint(colorNum(color)).setDisplaySize(T * 0.5, T * 0.5).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: an, displayWidth: T * radio, displayHeight: T * radio, alpha: 0, duration: 760, ease: "Quad.easeOut", onComplete: () => an.destroy() });
  }
  /* Columna de luz: la llegada de un héroe */
  private columna(x: number, y: number, color: string): void {
    const c = this.centro(x, y);
    const col = this.add.rectangle(c.x, c.y - T * 2, T * 0.7, T * 5, colorNum(color), 0.55).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: col, scaleX: 0.05, alpha: 0, duration: 900, ease: "Cubic.easeIn", onComplete: () => col.destroy() });
    this.onda(x, y, color, 5); this.onda(x, y, "#ffffff", 2.4);
    for (let i = 0; i < 12; i++) {
      const p = this.add.rectangle(c.x + (hash(i, 1, 9) - 0.5) * T * 0.8, c.y + T * 0.3, 4, 4, 0xfff0b0).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: p, y: c.y - T * (1 + hash(i, 2, 9) * 1.6), alpha: 0, duration: 700 + hash(i, 3, 9) * 500, onComplete: () => p.destroy() });
    }
  }
  private explosion(x: number, y: number): void {
    const c = this.centro(x, y);
    const fl = this.add.image(c.x, c.y, "brillo").setDisplaySize(T * 1.2, T * 1.2).setTint(0xffb03a).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
    this.tweens.add({ targets: fl, displayWidth: T * 3.6, displayHeight: T * 3.6, alpha: 0, duration: 420, ease: "Quad.easeOut", onComplete: () => fl.destroy() });
    this.onda(x, y, "#ffd27a", 3.6);
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, h = this.add.image(c.x, c.y, "humo").setDisplaySize(T * 0.5, T * 0.5).setTint(i % 2 ? 0x3a3432 : 0x6a625c).setAlpha(0.85).setDepth(30.5);
      this.tweens.add({ targets: h, x: c.x + Math.cos(a) * T * 1.1, y: c.y + Math.sin(a) * T * 0.9 - T * 0.3, scale: h.scale * 2.4, alpha: 0, duration: 800, ease: "Quad.easeOut", onComplete: () => h.destroy() });
    }
  }

  private proyectil(x1: number, y1: number, x2: number, y2: number, arma: string, dur: number): void {
    if (!this.visibleEn(x1, y1) && !this.visibleEn(x2, y2)) return;
    const a = this.centro(x1, y1), b = this.centro(x2, y2), alto = T * 0.3, ms = Math.max(90, dur);
    if (arma === "polvora") {
      const f = this.add.image(a.x + Math.sign(b.x - a.x || 1) * T * 0.3, a.y - alto, "brillo").setDisplaySize(T * 0.7, T * 0.7).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
      this.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
      const h = this.add.image(a.x, a.y - alto, "humo").setDisplaySize(T * 0.3, T * 0.3).setTint(0xb8b0a8).setAlpha(0.8).setDepth(30.5);
      this.tweens.add({ targets: h, y: a.y - T * 0.9, scale: h.scale * 2.6, alpha: 0, duration: 800, onComplete: () => h.destroy() });
      const g = this.add.graphics().setDepth(31);
      g.lineStyle(Math.max(2, T * 0.03), 0xfff4c8, 0.9).lineBetween(a.x, a.y - alto, b.x, b.y - alto * 0.5);
      this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
      return;
    }
    if (arma === "magia") {
      const orbe = this.add.image(a.x, a.y - alto, "brillo").setDisplaySize(T * 0.44, T * 0.44).setTint(0xc9a6ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
      this.tweens.add({ targets: orbe, x: b.x, y: b.y - alto * 0.5, duration: ms, ease: "Quad.easeIn", onUpdate: () => { const e = this.add.image(orbe.x, orbe.y, "brillo").setDisplaySize(T * 0.22, T * 0.22).setTint(0x9678ff).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(30.9); this.tweens.add({ targets: e, alpha: 0, scale: 0, duration: 240, onComplete: () => e.destroy() }); }, onComplete: () => orbe.destroy() });
      return;
    }
    const g = this.add.graphics().setDepth(31);
    this.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const q = tw.getValue() ?? 0, q0 = Math.max(0, q - 0.22), arcoY = (k: number): number => -alto - Math.sin(k * Math.PI) * T * 0.3;
        g.clear().lineStyle(Math.max(2, T * 0.04), 0x2a2018, 1).lineBetween(lerp(a.x, b.x, q0), lerp(a.y, b.y, q0) + arcoY(q0), lerp(a.x, b.x, q), lerp(a.y, b.y, q) + arcoY(q));
        g.lineStyle(Math.max(1.4, T * 0.022), 0xf4eed8, 1).lineBetween(lerp(a.x, b.x, q0), lerp(a.y, b.y, q0) + arcoY(q0), lerp(a.x, b.x, q), lerp(a.y, b.y, q) + arcoY(q));
      },
      onComplete: () => g.destroy()
    });
  }

  /* ===================================================================== bucle */
  update(tiempo: number): void {
    if (!this.est || !this.listo) return;
    if (this.anim) this.pasoAnim(performance.now());
    this.pintarUnidades(tiempo);
    this.pintarResaltes(tiempo);
    if (!REDUCIDO && this.mar) this.mar.setTilePosition(tiempo / 200, tiempo / 420);
    // En reposo no hace falta dibujar 60 veces por segundo: solo se mueven el agua y algún brillo
    const vivo = !!this.anim || !!this.toque || !!this.viaje || !!this.pinza || performance.now() - this.actividad < 900;
    const quiere = vivo ? FPS_VIVO : FPS_QUIETO;
    if (quiere !== this.fpsActual) { this.fpsActual = quiere; this.game.loop.setFPSLimit(quiere); }
  }
}
