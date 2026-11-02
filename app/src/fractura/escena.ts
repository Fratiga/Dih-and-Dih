/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import {
  hash, lienzo, colorNum, mezcla, oscuro, PALETA, pintarTerreno, pintarCiudad, pintarFortaleza, pintarRuinas, pintarNucleo, pintarCostura,
  pintarBandera, pintarGema, pintarCristal, pintarBrillo, pintarAnillo
} from "./pinturas";

/* =============================================================================
   LA FRACTURA en Phaser: la escena de la guerra. Solo dibuja y avisa de los toques. Las reglas son del
   motor (window.FracturaMotor), que ya resolvio cada accion: las animaciones se reproducen por encima
   del estado final, igual que en el tablero de canvas, y al acabar se vuelve al estado real.
   Todo se mide en pixeles del dispositivo (la CSS multiplicada por dpr).
============================================================================= */

export interface Ganchos { alTocar: (x: number, y: number, tactil: boolean) => void; alPasar?: (x: number, y: number) => void; }

const W: any = window;
const BASE = 128;           // tamano de las texturas de casilla (nitidas hasta acercarse bastante)
const FIG = 128;            // tamano de referencia de las figuras (una casilla)
const CASILLA_VISTA = 84;   // tamano de casilla (px CSS) con el que se abre la guerra
const CASILLA_MAX = 190;    // casilla mas grande que deja el zoom (px CSS)
const REDUCIDO = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const PALETA_BANDOS = ["#c0463c", "#3b7fd1", "#4fa84f", "#d1a23a", "#9a5bd1", "#2fb5a8", "#d1602f", "#8a8f98"];
const POSES: Record<string, { mov: boolean; fase: number; sw: number }> = {
  idle: { mov: false, fase: 0, sw: 0 }, w1: { mov: true, fase: 0.9, sw: 0 }, w2: { mov: true, fase: 3.9, sw: 0 },
  a0: { mov: false, fase: 0, sw: -0.5 }, a1: { mov: false, fase: 0, sw: 0.5 }, a2: { mov: false, fase: 0, sw: 1 }
};
const ease = (x: number): number => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const dist2 = (a: number[], b: number[]): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const rgbDe = (h: string): number[] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export class EscenaGuerra extends Phaser.Scene {
  private ganchos: Ganchos;
  private dpr: number;
  private listo = false;
  private cola: Array<() => void> = [];
  private est: any = null;
  private bandos: Array<{ col: string; ban: string }> = [];
  private ts = 40; private ox = 0; private oy = 0;
  private reserva = { arriba: 58, abajo: 8, izq: 8, der: 8 };
  // vista: zoom y centro (en pixeles del mundo). El mundo se dibuja siempre a tamano de ajuste total y la camara acerca.
  private vz = 1; private cx = 0; private cy = 0;
  private vistaPendiente = true;
  private toque: { id: number; x: number; y: number; cx: number; cy: number; mov: boolean; tactil: boolean } | null = null;
  private pinza: { dist: number } | null = null;
  private ui: any = { sel: null, mover: new Map(), atacar: new Set(), ciudad: null, casilla: null, objetivosHab: new Set(), ruta: null, hover: null, previaAtq: null };
  private anim: any = null;
  private firmaGlobal = "";
  // capas
  private fondo!: Phaser.GameObjects.Image;
  private gMarco!: Phaser.GameObjects.Graphics;
  private gMezcla!: Phaser.GameObjects.Graphics;
  private gRegiones!: Phaser.GameObjects.Graphics;
  private gNiebla!: Phaser.GameObjects.Graphics;
  private gRes!: Phaser.GameObjects.Graphics;
  private gBarras!: Phaser.GameObjects.Graphics;
  private vineta: Phaser.GameObjects.Image | null = null;
  private neblinas: Phaser.GameObjects.Image[] = [];
  private motas: Phaser.GameObjects.Rectangle[] = [];
  private tiles: Phaser.GameObjects.Image[] = [];
  private tipoTile: string[] = [];
  private firmaTile: string[] = [];
  private estr = new Map<number, Phaser.GameObjects.GameObject[]>();
  private firmaEstr: string[] = [];
  private unidades = new Map<string, { spr: Phaser.GameObjects.Image; clave: string }>();
  private aguaIdx: number[] = [];

  constructor(ganchos: Ganchos, dpr: number) {
    super("Guerra");
    this.ganchos = ganchos;
    this.dpr = dpr;
  }

  /* ===================================================================== ciclo de vida */
  create(): void {
    this.fondo = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setDepth(-10).setVisible(false);
    this.gMarco = this.add.graphics().setDepth(-5);
    this.gMezcla = this.add.graphics().setDepth(1);
    this.gRegiones = this.add.graphics().setDepth(3);
    this.gNiebla = this.add.graphics().setDepth(5);
    this.gRes = this.add.graphics().setDepth(7);
    this.gBarras = this.add.graphics().setDepth(20);
    this.tex("brillo", 128, 128, g => pintarBrillo(g, 128));
    this.tex("anillo", 128, 128, g => pintarAnillo(g, 128));
    this.tex("punto", 8, 8, g => { g.fillStyle = "#fff"; g.fillRect(0, 0, 8, 8); });
    for (let i = 0; i < 5; i++) this.neblinas.push(this.add.image(0, 0, "brillo").setDepth(6).setAlpha(0.05).setTint(0xdfe6ee));
    for (let i = 0; i < 12; i++) this.motas.push(this.add.rectangle(0, 0, 2, 2, 0xf0e8cd, 0.3).setDepth(6));

    this.cameras.main.setBackgroundColor(0x050304);
    this.input.addPointer(1);
    const casillaEn = (sx: number, sy: number): { x: number; y: number; dentro: boolean } => {
      const m = this.aMundo(sx, sy);
      const x = Math.floor((m.x - this.ox) / this.ts), y = Math.floor((m.y - this.oy) / this.ts);
      return { x, y, dentro: !!this.est && x >= 0 && y >= 0 && x < this.est.ancho && y < this.est.alto };
    };
    const umbral = 8 * this.dpr;
    let tactil = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.est) return;
      if (p.wasTouch) tactil = Date.now();
      if (this.anim) { this.saltar(); return; }
      const dos = this.input.pointer1.isDown && this.input.pointer2.isDown;
      if (dos) {
        this.pinza = { dist: Math.hypot(this.input.pointer1.x - this.input.pointer2.x, this.input.pointer1.y - this.input.pointer2.y) };
        if (this.toque) this.toque.mov = true;
        return;
      }
      this.toque = { id: p.id, x: p.x, y: p.y, cx: this.cx, cy: this.cy, mov: false, tactil: !!p.wasTouch };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.est) return;
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
    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (this.est) this.acercar(Math.exp(-dy * 0.0014), p.x, p.y); });
    this.input.on("gameout", () => { this.toque = null; this.ui.hover = null; if (this.ganchos.alPasar) this.ganchos.alPasar(-1, -1); });
    document.addEventListener("keydown", ev => { if (this.anim && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) this.saltar(); });

    this.listo = true;
    this.cola.splice(0).forEach(f => f());
  }

  cuando(f: () => void): void { if (this.listo) f(); else this.cola.push(f); }
  alCambiarTamano(): void { this.cuando(() => this.medir()); }

  /* ===================================================================== utilidades */
  private px = (x: number): number => this.ox + x * this.ts;
  private py = (y: number): number => this.oy + y * this.ts;
  private centro = (x: number, y: number): { x: number; y: number } => ({ x: this.px(x) + this.ts / 2, y: this.py(y) + this.ts / 2 });
  private humano = (): number => (this.est && this.est.humano >= 0 ? this.est.humano : 0);

  private tex(clave: string, w: number, h: number, f: (g: CanvasRenderingContext2D) => void): string {
    if (this.textures.exists(clave)) return clave;
    const [c, g] = lienzo(w, h);
    f(g);
    this.textures.addCanvas(clave, c);
    return clave;
  }
  private texTerreno(tipo: string, v: number, frame: number): string {
    return this.tex(`t:${tipo}:${v}:${frame}`, BASE, BASE, g => pintarTerreno(g, BASE, tipo, v, frame));
  }

  private coloresBando(est: any): Array<{ col: string; ban: string }> {
    const D = W.FRACTURA_DATOS;
    const usados: string[] = [];
    return est.jugadores.map((j: any) => {
      const f = D.FACCIONES[j.faccion];
      let col: string = f.color;
      if (usados.some(u => dist2(rgbDe(u), rgbDe(col)) < 150)) col = PALETA_BANDOS.find(p => !usados.some(u => dist2(rgbDe(u), rgbDe(p)) < 150)) || col;
      usados.push(col);
      return { col, ban: f.bandera };
    });
  }

  /* ===================================================================== estado y estructura */
  poner(est: any): void {
    this.est = est;
    this.bandos = this.coloresBando(est);
    this.anim = null;
    this.tiles.forEach(t => t.destroy()); this.tiles = []; this.tipoTile = []; this.firmaTile = [];
    this.estr.forEach(l => l.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); })); this.estr.clear(); this.firmaEstr = [];
    this.unidades.forEach(u => u.spr.destroy()); this.unidades.clear();
    this.firmaGlobal = "";
    this.vistaPendiente = true; this.toque = null; this.pinza = null;
    for (let i = 0; i < est.ancho * est.alto; i++) {
      this.tiles.push(this.add.image(0, 0, this.texTerreno("llanura", 0, 0)).setOrigin(0).setDepth(0));
      this.tipoTile.push(""); this.firmaTile.push(""); this.firmaEstr.push("");
    }
    this.medir();
  }

  estado(e: any): void {
    this.ui = Object.assign({ sel: null, mover: new Map(), atacar: new Set(), ciudad: null, casilla: null, objetivosHab: new Set(), ruta: null, hover: this.ui.hover, previaAtq: null }, e);
    this.sincronizar(false);
  }

  /* El mapa se dibuja en toda la pantalla. La reserva (barra de arriba, panel) solo decide donde esta el centro de la vista. */
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
  private zoomMin(): number {
    const L = this.libre();
    return Math.min(1, Math.min(L.w / (this.ts * this.est.ancho), L.h / (this.ts * this.est.alto)));
  }
  private zoomMax(): number { return Math.max(2, (CASILLA_MAX * this.dpr) / this.ts); }
  private limitarVista(): void {
    const est = this.est;
    this.vz = Math.max(this.zoomMin(), Math.min(this.zoomMax(), this.vz));
    this.cx = Math.max(this.ox - this.ts, Math.min(this.ox + this.ts * (est.ancho + 1), this.cx));
    this.cy = Math.max(this.oy - this.ts, Math.min(this.oy + this.ts * (est.alto + 1), this.cy));
  }
  private aplicarCamara(): void {
    const cam = this.cameras.main, L = this.libre();
    this.limitarVista();
    cam.setZoom(this.vz);
    cam.centerOn(this.cx + (this.scale.width / 2 - (L.x + L.w / 2)) / this.vz, this.cy + (this.scale.height / 2 - (L.y + L.h / 2)) / this.vz);
  }
  /* Cambia el zoom dejando quieto el punto de pantalla (sx, sy) */
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
  /* Mapa entero en la pantalla */
  verTodo(): void {
    this.cuando(() => {
      if (!this.est) return;
      this.vz = this.zoomMin(); this.cx = this.ox + this.ts * this.est.ancho / 2; this.cy = this.oy + this.ts * this.est.alto / 2;
      this.aplicarCamara();
    });
  }
  /* Acerca la vista a las tropas propias */
  centrar(): void {
    this.cuando(() => {
      if (!this.est) return;
      const H = this.humano(), mias = Object.values(this.est.unidades).filter((u: any) => u.dueno === H) as any[];
      let tx = this.est.ancho / 2, ty = this.est.alto / 2;
      if (mias.length) { tx = mias.reduce((a, u) => a + u.x, 0) / mias.length + 0.5; ty = mias.reduce((a, u) => a + u.y, 0) / mias.length + 0.5; }
      this.vz = (CASILLA_VISTA * this.dpr) / this.ts;
      this.cx = this.ox + tx * this.ts; this.cy = this.oy + ty * this.ts;
      this.aplicarCamara();
    });
  }

  private medir(): void {
    const w = this.scale.width, h = this.scale.height, d = this.dpr;
    if (!this.est) return;
    const foco = this.ts > 0 && this.vz ? { x: (this.cx - this.ox) / this.ts, y: (this.cy - this.oy) / this.ts } : null;
    this.ts = Math.max(24 * d, Math.floor(Math.min(w / this.est.ancho, h / this.est.alto)));
    this.ox = Math.round((w - this.ts * this.est.ancho) / 2);
    this.oy = Math.round((h - this.ts * this.est.alto) / 2);
    if (foco && !this.vistaPendiente) { this.cx = this.ox + foco.x * this.ts; this.cy = this.oy + foco.y * this.ts; }
    if (!this.textures.exists("fondo")) {
      const [c, g] = lienzo(256, 256);
      const gr = g.createRadialGradient(128, 118, 10, 128, 128, 180);
      gr.addColorStop(0, "#1c141b"); gr.addColorStop(0.6, "#0d0a0d"); gr.addColorStop(1, "#050304");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      this.textures.addCanvas("fondo", c);
    }
    const mx = this.ts * 8;
    this.fondo.setTexture("fondo").setVisible(true).setPosition(this.ox - mx, this.oy - mx).setDisplaySize(this.ts * this.est.ancho + mx * 2, this.ts * this.est.alto + mx * 2);
    const ts = this.ts;
    this.tiles.forEach((im, i) => { const x = i % this.est.ancho, y = Math.floor(i / this.est.ancho); im.setPosition(this.px(x), this.py(y)).setDisplaySize(ts + 0.5, ts + 0.5); });
    // vineta del mapa
    if (this.vineta) { this.vineta.destroy(); this.vineta = null; }
    if (this.textures.exists("vineta")) this.textures.remove("vineta");
    const vw = ts * this.est.ancho, vh = ts * this.est.alto;
    const [vc, vg] = lienzo(vw / 2, vh / 2);
    const rad = vg.createRadialGradient(vw / 4, vh / 4, Math.min(vw, vh) * 0.17, vw / 4, vh / 4, Math.max(vw, vh) * 0.39);
    rad.addColorStop(0, "rgba(0,0,0,0)"); rad.addColorStop(1, "rgba(0,0,0,.55)");
    vg.fillStyle = rad; vg.fillRect(0, 0, vw / 2, vh / 2);
    this.textures.addCanvas("vineta", vc);
    this.vineta = this.add.image(this.ox, this.oy, "vineta").setOrigin(0).setDisplaySize(vw, vh).setDepth(4);
    // marco dorado
    this.gMarco.clear();
    this.gMarco.fillStyle(0x050406, 1).fillRect(this.ox - 9 * d, this.oy - 9 * d, vw + 18 * d, vh + 18 * d);
    this.gMarco.lineStyle(1.5 * d, 0xc5a059, 0.55).strokeRect(this.ox - 6.5 * d, this.oy - 6.5 * d, vw + 13 * d, vh + 13 * d);
    this.gMarco.lineStyle(1 * d, 0xc5a059, 0.2).strokeRect(this.ox - 3.5 * d, this.oy - 3.5 * d, vw + 7 * d, vh + 7 * d);
    this.firmaGlobal = "";
    this.estr.forEach(l => l.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); })); this.estr.clear(); this.firmaEstr = this.firmaEstr.map(() => "");
    this.firmaTile = this.firmaTile.map(() => "");
    this.sincronizar(true);
    if (this.vistaPendiente) { this.vistaPendiente = false; this.centrar(); } else this.aplicarCamara();
  }

  /* ===================================================================== sincronizar con el estado del juego */
  sincronizar(forzar: boolean): void {
    const est = this.est;
    if (!est || !this.listo) return;
    const H = this.humano(), vis: number[] = est.vision[H], w = est.ancho, ts = this.ts;
    const ciudades: Record<string, any> = {};
    Object.values(est.ciudades).forEach((c: any) => { ciudades[`${c.x},${c.y}`] = c; });
    let global = "";
    this.aguaIdx = [];
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = est.casillas[y][x], v = vis[i];
      global += c.t[0] + v;
      // terreno
      const tipo = v === 0 ? "vacio" : c.t;
      const firma = `${tipo}`;
      if (this.firmaTile[i] !== firma || forzar) {
        this.firmaTile[i] = firma;
        const variante = Math.floor(hash(x, y, 1) * 4);
        this.tiles[i].setTexture(this.texTerreno(tipo, tipo === "vacio" ? 0 : variante, 0));
        this.tipoTile[i] = tipo;
      }
      if (tipo === "agua") this.aguaIdx.push(i);
      // estructuras y objetos
      const ci = ciudades[`${x},${y}`];
      const fi = est.fortalezas.findIndex((p: any) => p.x === x && p.y === y);
      const fort = fi >= 0 ? est.fortalezasDueno[fi] : null;
      const nuc = c.est === "nucleo" ? Math.max(est.nucleoHold[0], est.nucleoHold[1]) + ":" + (est.nucleoHold[0] >= est.nucleoHold[1] ? 0 : 1) : "";
      const fe = v === 0 ? "" : [c.est || "", c.t === "magica" ? "m" : "", ci ? `${ci.dueno}:${ci.nivel}:${ci.capital ? 1 : 0}` : "", fi >= 0 ? `f${fort}` : "", c.saqueada ? "s" : "", c.objetos && c.objetos.length ? "o" : "", nuc].join("|");
      global += fe;
      if (this.firmaEstr[i] !== fe) { this.firmaEstr[i] = fe; this.reconstruirEstructura(i, x, y, c, v, ci, fort, nuc); }
    }
    est.regiones.forEach((r: any) => { global += (r.dueno === null ? "n" : r.dueno); });
    if (global !== this.firmaGlobal || forzar) {
      this.firmaGlobal = global;
      this.dibujarMezcla(vis); this.dibujarRegiones(vis); this.dibujarNiebla(vis);
    }
    void ts;
  }

  private strip(g: Phaser.GameObjects.Graphics, x: number, y: number, dx: number, dy: number, color: number, alfa: number, pasos: number): void {
    const ts = this.ts, grosor = ts * 0.06;
    for (let k = 0; k < pasos; k++) {
      g.fillStyle(color, alfa * (1 - k / pasos));
      if (dx !== 0) g.fillRect(dx > 0 ? x + ts - (k + 1) * grosor : x + k * grosor, y, grosor, ts);
      else g.fillRect(x, dy > 0 ? y + ts - (k + 1) * grosor : y + k * grosor, ts, grosor);
    }
  }

  /* Los bordes entre terrenos distintos se funden: el mapa deja de parecer una rejilla de losetas */
  private dibujarMezcla(vis: number[]): void {
    const est = this.est, g = this.gMezcla, w = est.ancho;
    g.clear();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) {
      if (vis[y * w + x] === 0) continue;
      const t = est.casillas[y][x].t;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= est.alto || vis[ny * w + nx] === 0) continue;
        const tn = est.casillas[ny][nx].t;
        if (tn === t || tn === "vacio" || t === "vacio") continue;
        this.strip(g, this.px(x), this.py(y), dx, dy, colorNum(PALETA[tn][0]), 0.3, 6);
      }
    }
  }

  private dibujarRegiones(vis: number[]): void {
    const est = this.est, g = this.gRegiones, w = est.ancho, ts = this.ts, d = this.dpr;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.04);
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) if (vis[y * w + x] > 0) g.strokeRect(this.px(x), this.py(y), ts, ts);
    const grosor = Math.max(2 * d, ts / 14);
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) {
      if (vis[y * w + x] === 0) continue;
      const r = est.casillas[y][x].region;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= w || ny >= est.alto || est.casillas[ny][nx].region === r) continue;
        const rg = est.regiones[r];
        const color = rg.dueno === null ? 0xebe1cd : colorNum(this.bandos[rg.dueno].col);
        const ax = dx ? this.px(nx) : this.px(x), ay = dx ? this.py(y) : this.py(ny), bx = dx ? ax : this.px(x + 1), by = dx ? this.py(y + 1) : ay;
        g.lineStyle(grosor + 2 * d, 0x000000, 0.45).lineBetween(ax, ay, bx, by);
        g.lineStyle(grosor, color, rg.dueno === null ? 0.4 : 0.85).lineBetween(ax, ay, bx, by);
      }
    }
  }

  private dibujarNiebla(vis: number[]): void {
    const est = this.est, g = this.gNiebla, w = est.ancho, ts = this.ts;
    g.clear();
    for (let y = 0; y < est.alto; y++) for (let x = 0; x < w; x++) {
      const v = vis[y * w + x], X = this.px(x), Y = this.py(y);
      if (v === 0) { g.fillStyle(0x07050b, 1).fillRect(X, Y, ts + 0.5, ts + 0.5); continue; }
      if (v === 1) g.fillStyle(0x06050a, 0.64).fillRect(X, Y, ts + 0.5, ts + 0.5);
      else {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= est.alto || vis[ny * w + nx] === 2) continue;
          this.strip(g, X, Y, dx, dy, 0x050407, 0.3, 5);
        }
      }
    }
  }

  /* ===================================================================== estructuras */
  private brillo(x: number, y: number, tam: number, color: number, alfa: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, "brillo").setDisplaySize(tam, tam).setTint(color).setAlpha(alfa).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.5);
  }

  private reconstruirEstructura(i: number, x: number, y: number, c: any, v: number, ci: any, fort: number | null, nuc: string): void {
    const viejos = this.estr.get(i);
    if (viejos) { viejos.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); }); this.estr.delete(i); }
    if (v === 0) return;
    const ts = this.ts, X = this.px(x), Y = this.py(y), u = ts / 40, lista: Phaser.GameObjects.GameObject[] = [];
    const poner = (clave: string, w: number, h: number, f: (g: CanvasRenderingContext2D) => void, prof = 2): Phaser.GameObjects.Image => {
      this.tex(clave, w, h, f);
      const im = this.add.image(X, Y, clave).setOrigin(0).setDisplaySize(ts * (w / BASE), ts * (h / BASE)).setDepth(prof);
      lista.push(im); return im;
    };
    const bandera = (col: string, bx: number, by: number, alto: number): void => {
      const clave = `ban:${col}:${alto}`;
      this.tex(clave, BASE, BASE, g => { g.save(); g.translate(0, 0); pintarBandera(g, BASE, col); g.restore(); });
      const im = this.add.image(X + bx * u, Y + by * u, clave).setOrigin(3 / 40, 36 / 40).setDisplaySize(ts * (alto / 30), ts * (alto / 30)).setDepth(2.2);
      lista.push(im);
      if (!REDUCIDO) this.tweens.add({ targets: im, angle: { from: -3, to: 4 }, duration: 700 + (x + y) * 40, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    };
    if (c.t === "magica") {
      const cr = poner("cristal", BASE, BASE, g => pintarCristal(g, BASE), 2);
      const br = this.brillo(X + ts / 2, Y + ts / 2, ts * 0.9, 0xb98cff, 0.5); lista.push(br);
      if (!REDUCIDO) {
        this.tweens.add({ targets: cr, y: Y - 2 * u, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (x * 130 + y * 70) % 900 });
        this.tweens.add({ targets: br, alpha: 0.28, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    if (c.est === "ciudad" && ci) {
      const neutral = ci.dueno === null, col = neutral ? "#8a8a8a" : this.bandos[ci.dueno].col;
      const casas = Math.min(4, 1 + Math.floor(ci.nivel / 2));
      poner(`ciudad:${col}:${casas}:${ci.capital ? 1 : 0}`, BASE, BASE, g => pintarCiudad(g, BASE, { col, ban: "#000", casas, capital: !!ci.capital, neutral }));
      if (!neutral) bandera(col, 34, 21, 18);
    } else if (c.est === "fortaleza") {
      poner("fortaleza", BASE, BASE, g => pintarFortaleza(g, BASE));
      if (fort !== null && fort !== undefined) bandera(this.bandos[fort].col, 20, 9, 16);
    } else if (c.est === "ruinas") {
      poner(`ruinas:${c.saqueada ? 1 : 0}`, BASE, BASE, g => pintarRuinas(g, BASE, !!c.saqueada));
      if (!c.saqueada) {
        const br = this.brillo(X + ts / 2, Y + ts * 0.72, ts * 0.5, 0xf0d278, 0.4); lista.push(br);
        if (!REDUCIDO) this.tweens.add({ targets: br, alpha: 0.18, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    } else if (c.est === "nucleo") {
      const an = poner("nucleo", BASE, BASE, g => pintarNucleo(g, BASE), 2);
      an.setOrigin(0.5).setPosition(X + ts / 2, Y + ts / 2);
      const br = this.brillo(X + ts / 2, Y + ts / 2, ts * 1.1, 0xf0d278, 0.32); lista.push(br);
      if (!REDUCIDO) {
        this.tweens.add({ targets: an, angle: 360, duration: 24000, repeat: -1 });
        this.tweens.add({ targets: br, scale: br.scale * 1.12, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      if (nuc && !nuc.startsWith("0:")) {
        const [h, q] = nuc.split(":");
        const tx = this.add.text(X + ts / 2, Y + ts / 2, h, { fontFamily: "Cinzel, serif", fontSize: `${Math.round(ts * 0.34)}px`, color: this.bandos[+q].col, stroke: "#050304", strokeThickness: Math.max(2, ts * 0.06) }).setOrigin(0.5).setDepth(2.6);
        lista.push(tx);
      }
    } else if (c.est === "costura") {
      const an = poner("costura", BASE, BASE, g => pintarCostura(g, BASE), 2);
      an.setOrigin(0.5).setPosition(X + ts / 2, Y + ts / 2);
      const br = this.brillo(X + ts / 2, Y + ts / 2, ts * 0.9, 0x8fe3e6, 0.4); lista.push(br);
      if (!REDUCIDO) {
        this.tweens.add({ targets: an, angle: 360, duration: 9000, repeat: -1 });
        this.tweens.add({ targets: br, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    if (c.objetos && c.objetos.length) {
      const gm = poner("gema", BASE, BASE, g => pintarGema(g, BASE), 2.4);
      gm.setOrigin(0.5).setDisplaySize(ts * 0.45, ts * 0.45).setPosition(X + 31 * u, Y + 12 * u);
      const br = this.brillo(X + 31 * u, Y + 12 * u, ts * 0.5, 0xf6d46c, 0.4); lista.push(br);
      if (!REDUCIDO) this.tweens.add({ targets: [gm, br], y: Y + 8 * u, duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
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
      uid: u.uid, clase: u.clase, dueno: u.dueno, x: u.x, y: u.y, hp: u.hp, hpMax: FM.ef(this.est, u).hpMax, lider: !!u.lider,
      cap: !!(u.s && u.s.capitan), rango: u.s ? S.rangoIndice(u.s.victorias + (u.vicG || 0)) : 0, luto: !!(u.s && u.s.luto)
    };
  }

  private texFigura(d: any, pose: string, herido: boolean): string {
    const bando = d.dueno >= 0 ? this.bandos[d.dueno] : { col: "#8c8c8c", ban: "#444444" };
    const clave = `u:${d.clase}:${bando.col}:${pose}:${d.cap ? 1 : 0}:${d.rango || 0}:${herido ? 1 : 0}:${d.luto ? 1 : 0}`;
    const w = Math.round(FIG * 1.7), h = Math.round(FIG * 1.6), p = POSES[pose];
    this.tex(clave, w, h, g => {
      W.FracturaTablero.figura(g, d.clase, bando, { x: w / 2, y: h * 0.9, s: FIG * 0.95, dir: 1, mov: p.mov, fase: p.fase, sw: p.sw, flash: 0, bob: 0, t: 0, cap: d.cap, rango: d.rango, herido, luto: d.luto });
    });
    return clave;
  }

  private pintarUnidades(t: number): void {
    const est = this.est, H = this.humano(), vis = est.vision[H], ts = this.ts;
    const lista: Array<{ d: any; v: any; y: number }> = [];
    if (this.anim) {
      this.anim.vis.forEach((v: any, uid: string) => {
        if (v.oculto || (v.alfa === 0 && !est.unidades[uid])) return;
        const logica = est.unidades[uid];
        const d = v.d || (logica ? this.datosUnidad(logica) : null);
        if (!d) return;
        lista.push({ d, v, y: v.y + (v.dy || 0) });
      });
    } else Object.values(est.unidades).forEach((u: any) => lista.push({ d: this.datosUnidad(u), v: null, y: u.y }));
    const usados = new Set<string>();
    const g = this.gBarras;
    g.clear();
    lista.forEach(it => {
      const d = it.d, a = it.v || {};
      const X = a.x !== undefined ? a.x : d.x, Y = a.y !== undefined ? a.y : d.y;
      const tx = Math.round(X), ty = Math.round(Y);
      const visible = d.dueno === H || (ty >= 0 && ty < est.alto && tx >= 0 && tx < est.ancho && vis[ty * est.ancho + tx] === 2);
      if (!visible) return;
      usados.add(d.uid);
      let o = this.unidades.get(d.uid);
      if (!o) { o = { spr: this.add.image(0, 0, this.texFigura(d, "idle", false)).setOrigin(0.5, 0.9), clave: "" }; this.unidades.set(d.uid, o); }
      const hp = a.hp !== undefined ? a.hp : d.hp, herido = hp <= d.hpMax * 0.45;
      let pose = "idle";
      if (a.mov) pose = Math.floor(t / 90) % 2 ? "w2" : "w1";
      else if (a.sw > 0.7) pose = "a2"; else if (a.sw > 0.25) pose = "a1"; else if (a.sw < -0.2) pose = "a0";
      const clave = this.texFigura(d, pose, herido);
      if (o.clave !== clave) { o.spr.setTexture(clave); o.clave = clave; }
      const idle = REDUCIDO ? 0 : Math.sin(t / 420 + d.uid.length * 1.7 + (d.x * 3 + d.y)) * ts * 0.012;
      const sel = this.ui.sel === d.uid && !REDUCIDO ? Math.abs(Math.sin(t / 260)) * ts * 0.035 : 0;
      const paso = a.mov ? Math.abs(Math.sin((a.fase || 0) * 2)) * ts * 0.04 : 0;
      const cx = this.px(X) + ts / 2 + (a.dx || 0) * ts, cy = this.py(Y) + ts * 0.86 + (a.dy || 0) * ts - idle - sel - paso;
      const dir = a.dir || (d.dueno === 0 ? 1 : -1);
      o.spr.setPosition(cx, cy).setScale(ts / FIG).setFlipX(dir < 0).setDepth(10 + Y * 0.01);
      o.spr.setRotation(a.rot ? a.rot : 0).setAlpha(a.alfa !== undefined ? a.alfa : 1);
      if (a.flash > 0.15) o.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else o.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      o.spr.setVisible(true);
      // vida
      if (a.alfa === undefined || a.alfa > 0.4) {
        const bw = ts * 0.62, f = Math.max(0, Math.min(1, hp / d.hpMax)), by = cy + ts * 0.08, bh = Math.max(4, ts * 0.075);
        g.fillStyle(0x060408, 0.92).fillRect(cx - bw / 2 - 1, by - 1, bw + 2, bh + 2);
        g.fillStyle(f > 0.5 ? 0x6fbf5c : f > 0.25 ? 0xe0b84a : 0xd4574a, 1).fillRect(cx - bw / 2, by, bw * f, bh);
        g.lineStyle(1, 0xc5a059, 0.55).strokeRect(cx - bw / 2 - 0.5, by - 0.5, bw + 1, bh + 1);
      }
      if (d.dueno === est.activo && est.jugadores[d.dueno].humano && !this.anim) {
        const u = est.unidades[d.uid];
        if (u && u.pm <= 0 && u.atacado) g.fillStyle(0x0a0810, 0.35).fillRect(cx - ts * 0.3, cy - ts * 0.85, ts * 0.6, ts * 0.95);
      }
    });
    this.unidades.forEach((o, uid) => { if (!usados.has(uid)) { o.spr.destroy(); this.unidades.delete(uid); } });
  }

  /* ===================================================================== resaltes */
  private esquinas(x: number, y: number, color: number, alfa: number, lw: number, largo: number, margen: number): void {
    const g = this.gRes, ts = this.ts, X = this.px(x) + margen, Y = this.py(y) + margen, A = ts - margen * 2, L = ts * largo;
    g.lineStyle(lw, color, alfa);
    for (const [a, b, dx, dy] of [[X, Y, 1, 1], [X + A, Y, -1, 1], [X, Y + A, 1, -1], [X + A, Y + A, -1, -1]]) {
      g.beginPath(); g.moveTo(a, b + dy * L); g.lineTo(a, b); g.lineTo(a + dx * L, b); g.strokePath();
    }
  }
  private caja(x: number, y: number, color: number, alfa: number): void { this.gRes.fillStyle(color, alfa).fillRect(this.px(x), this.py(y), this.ts, this.ts); }

  private pintarResaltes(t: number): void {
    const g = this.gRes, est = this.est, ts = this.ts, d = this.dpr, ui = this.ui;
    g.clear();
    if (!this.anim) {
      ui.mover.forEach((_n: any, k: string) => { const [x, y] = k.split(",").map(Number); this.caja(x, y, 0x5ac878, 0.17); this.esquinas(x, y, 0x96f0aa, 0.95, Math.max(1.6 * d, ts / 26), 0.3, 2 * d); });
    }
    ui.objetivosHab.forEach((k: string) => { const [x, y] = k.split(",").map(Number); this.caja(x, y, 0x9678ff, 0.28); this.esquinas(x, y, 0xc9b6ff, 1, Math.max(1.6 * d, ts / 26), 0.3, 2 * d); });
    if (ui.ruta && ui.ruta.length > 1) {
      const pts = ui.ruta.map((p: any) => this.centro(p.x, p.y));
      const largo = ts * 0.12, off = REDUCIDO ? 0 : (t / 60) % (largo * 2);
      g.lineStyle(Math.max(2 * d, ts / 12), 0xf2ecd8, 0.95);
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], b = pts[s + 1], L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        for (let p = -off; p < L; p += largo * 2) {
          const p0 = Math.max(0, p), p1 = Math.min(L, p + largo);
          if (p1 > p0) g.lineBetween(a.x + ux * p0, a.y + uy * p0, a.x + ux * p1, a.y + uy * p1);
        }
      }
      const f = pts[pts.length - 1]; g.fillStyle(0xf2ecd8, 1).fillCircle(f.x, f.y, ts * 0.12);
    }
    if (!this.anim) ui.atacar.forEach((k: string) => {
      const [x, y] = k.split(",").map(Number), m = REDUCIDO ? 0 : Math.sin(t / 220) * 0.5 + 0.5;
      this.caja(x, y, 0xc83228, 0.12 + m * 0.12); this.esquinas(x, y, 0xff6b5e, 1, Math.max(2 * d, ts / 20), 0.34, (2 - m * 1.5) * d);
    });
    if (ui.previaAtq) this.esquinas(ui.previaAtq.x, ui.previaAtq.y, 0xffe3a0, 1, Math.max(2 * d, ts / 20), 0.34, 3 * d);
    if (ui.sel && est.unidades[ui.sel] && !this.anim) { const u = est.unidades[ui.sel]; this.caja(u.x, u.y, 0xf0c85a, 0.1); this.esquinas(u.x, u.y, 0xf2cf6a, 1, Math.max(2 * d, ts / 18), 0.36, 1.5 * d); }
    if (ui.casilla) this.esquinas(ui.casilla.x, ui.casilla.y, 0xf2cf6a, 1, Math.max(1.5 * d, ts / 24), 0.3, 2 * d);
    if (ui.ciudad && est.ciudades[ui.ciudad]) { const c = est.ciudades[ui.ciudad]; this.esquinas(c.x, c.y, 0xf2cf6a, 1, Math.max(2 * d, ts / 18), 0.36, 1.5 * d); }
    if (ui.hover && !this.anim) this.esquinas(ui.hover.x, ui.hover.y, 0xfff4d6, 0.6, Math.max(1.4 * d, ts / 28), 0.24, 1 * d);
  }

  /* ===================================================================== animaciones por eventos */
  private construir(evs: any[], rapidez: number): { items: any[]; total: number } {
    const items: any[] = [];
    let cursor = 0;
    const escala = rapidez || 1;
    const add = (tipo: string, dur: number, datos: any): void => { items.push(Object.assign({ tipo, ini: cursor, dur: dur * escala, hecho: false }, datos)); cursor += dur * escala; };
    evs.forEach(e => {
      if (e.k === "mov") {
        const pasos = Math.max(1, (e.ruta || [e.de, e.a]).length - 1);
        add("mov", Math.min(900, 140 * pasos + 120), { uid: e.uid, ruta: e.ruta && e.ruta.length > 1 ? e.ruta : [e.de, e.a] });
      } else if (e.k === "golpe") {
        const lejos = e.dist > 1.5;
        add("golpe", lejos ? 480 : 420, { de: e.de, a: e.a, x: e.x, y: e.y, dmg: e.dmg, lejos });
      } else if (e.k === "muerte") add("muerte", 450, { uid: e.uid, x: e.x, y: e.y });
      else if (e.k === "nuevo") add("nuevo", 260, { uid: e.uid, x: e.x, y: e.y });
      else if (e.k === "captura") add("captura", 300, { x: e.x, y: e.y, dueno: e.dueno });
    });
    return { items, total: cursor };
  }

  reproducir(evs: any[], antesSnap: Map<string, any> | null, opciones?: any): void {
    opciones = opciones || {};
    if (!evs || !evs.length || REDUCIDO) { if (opciones.alTerminar) opciones.alTerminar(); return; }
    if (!this.anim) {
      const base = antesSnap || this.instantanea();
      const vis = new Map<string, any>();
      base.forEach((d: any, uid: string) => vis.set(uid, { d, x: d.x, y: d.y, hp: d.hp, alfa: 1, dir: d.dueno === 0 ? 1 : -1 }));
      Object.values(this.est.unidades).forEach((u: any) => { if (!vis.has(u.uid)) vis.set(u.uid, { d: this.datosUnidad(u), x: u.x, y: u.y, hp: u.hp, alfa: 0, oculto: true, dir: u.dueno === 0 ? 1 : -1 }); });
      this.anim = { vis, items: [], total: 0, t0: performance.now(), alTerminar: [] };
    }
    const pulso = this.construir(evs, opciones.rapidez);
    pulso.items.forEach(i => { i.ini += Math.max(this.anim.total, 0); this.anim.items.push(i); });
    this.anim.total += pulso.total;
    const tope = opciones.tope || 5200;
    if (this.anim.total > tope) { const f = tope / this.anim.total; this.anim.items.forEach((i: any) => { i.ini *= f; i.dur *= f; }); this.anim.total = tope; }
    if (opciones.alTerminar) this.anim.alTerminar.push(opciones.alTerminar);
  }

  saltar(): void { if (this.anim) this.anim.t0 -= 1e6; }
  ocupado(): boolean { return !!this.anim; }
  alTerminar(f: () => void): void { if (this.anim) this.anim.alTerminar.push(f); else f(); }

  private terminarAnim(): void {
    const cbs = this.anim ? this.anim.alTerminar : [];
    this.anim = null;
    this.sincronizar(true);
    cbs.forEach((f: () => void) => { try { f(); } catch { /* la animacion nunca debe romper el juego */ } });
  }

  private pasoAnim(ahora: number): void {
    const A = this.anim;
    if (!A) return;
    const t = ahora - A.t0;
    if (t > A.total + 400 || t > 15000) { this.terminarAnim(); return; }
    A.vis.forEach((v: any) => { v.mov = false; v.sw = 0; v.flash = 0; v.dx = 0; v.dy = 0; });
    A.items.forEach((it: any) => {
      const lt = t - it.ini;
      if (lt < 0) return;
      const p = Math.min(1, lt / Math.max(1, it.dur));
      if (it.tipo === "mov") {
        const v = A.vis.get(it.uid); if (!v) return;
        const r = it.ruta, tramos = r.length - 1;
        const q = ease(p) * tramos, i = Math.min(tramos - 1, Math.floor(q)), f = q - i;
        v.x = lerp(r[i].x, r[i + 1].x, f); v.y = lerp(r[i].y, r[i + 1].y, f);
        const ddx = r[i + 1].x - r[i].x;
        if (ddx) v.dir = ddx > 0 ? 1 : -1;
        v.mov = p < 1; v.fase = (t / 90) % 6.283;
        if (p >= 1 && !it.hecho) { it.hecho = true; v.x = r[tramos].x; v.y = r[tramos].y; if (!it.polvo) { it.polvo = true; this.polvo(r[tramos].x, r[tramos].y); } }
      } else if (it.tipo === "golpe") {
        const v = A.vis.get(it.de), o = A.vis.get(it.a);
        if (v) {
          const dx = it.x - v.x, dy = it.y - v.y, L = Math.hypot(dx, dy) || 1;
          if (it.lejos) { v.sw = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55; v.dx = -(dx / L) * 0.05 * Math.sin(p * 3.14); }
          else {
            const avance = p < 0.3 ? -0.12 * (p / 0.3) : p < 0.5 ? lerp(-0.12, 0.34, (p - 0.3) / 0.2) : lerp(0.34, 0, (p - 0.5) / 0.5);
            v.dx = (dx / L) * avance; v.dy = (dy / L) * avance;
            v.sw = p < 0.3 ? p / 0.3 * -0.5 : p < 0.5 ? lerp(-0.5, 1, (p - 0.3) / 0.2) : lerp(1, 0, (p - 0.5) / 0.5);
          }
          if (dx) v.dir = dx > 0 ? 1 : -1;
        }
        if (p >= 0.5 && !it.hecho) {
          it.hecho = true;
          if (o) o.hp = Math.max(0, o.hp - it.dmg);
          this.texto(it.x, it.y, `-${it.dmg}`, "#ffd0c8");
          this.chispas(it.x, it.y);
          if (it.lejos && v) this.proyectil(v.x, v.y, it.x, it.y);
        }
        if (o && p >= 0.5 && p < 0.9) {
          const k = (p - 0.5) / 0.4, dxo = it.x - (v ? v.x : it.x), dyo = it.y - (v ? v.y : it.y), L = Math.hypot(dxo, dyo) || 1;
          o.flash = 1 - k; o.dx = (dxo / L) * 0.1 * Math.sin(k * 3.14); o.dy = (dyo / L) * 0.1 * Math.sin(k * 3.14);
        }
      } else if (it.tipo === "muerte") {
        const v = A.vis.get(it.uid); if (!v) return;
        v.alfa = 1 - p; v.rot = p * 1.35 * v.dir; v.dy = p * 0.12; v.flash = Math.max(0, 0.6 - p);
        if (p >= 1 && !it.hecho) { it.hecho = true; this.texto(it.x, it.y, "✝", "#ffffff"); }
      } else if (it.tipo === "nuevo") {
        const v = A.vis.get(it.uid); if (!v) return;
        v.oculto = false; v.alfa = ease(p); v.dy = (1 - p) * -0.15;
      } else if (it.tipo === "captura") {
        if (!it.hecho && p > 0.2) { it.hecho = true; this.onda(it.x, it.y, this.bandos[it.dueno] ? this.bandos[it.dueno].col : "#ffffff"); }
      }
    });
  }

  /* ===================================================================== efectos */
  private visibleEn(x: number, y: number): boolean {
    const est = this.est, vis = est.vision[this.humano()];
    const ex = Math.round(x), ey = Math.round(y);
    return ex >= 0 && ey >= 0 && ex < est.ancho && ey < est.alto && vis[ey * est.ancho + ex] === 2;
  }

  texto(x: number, y: number, t: string, color: string): void {
    if (!this.est || !this.visibleEn(x, y)) return;
    const c = this.centro(x, y), ts = this.ts;
    const tx = this.add.text(c.x, c.y - ts * 0.15, t, { fontFamily: "Cinzel, serif", fontSize: `${Math.round(ts * 0.46)}px`, fontStyle: "bold", color, stroke: "#050304", strokeThickness: Math.max(3, ts * 0.08) }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: tx, y: c.y - ts * 0.75, alpha: { from: 1, to: 0 }, duration: 900, ease: "Quad.easeOut", onComplete: () => tx.destroy() });
  }

  private chispas(x: number, y: number): void {
    if (!this.visibleEn(x, y)) return;
    const c = this.centro(x, y), ts = this.ts;
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + 0.3, r0 = ts * 0.08, r1 = ts * (0.28 + (k % 3) * 0.08);
      const s = this.add.rectangle(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, Math.max(2, ts * 0.05), Math.max(2, ts * 0.05), 0xfff4c4).setDepth(30).setRotation(a);
      this.tweens.add({ targets: s, x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1, alpha: 0, duration: 280, ease: "Quad.easeOut", onComplete: () => s.destroy() });
    }
    const flash = this.brillo(c.x, c.y, ts * 0.9, 0xfff0c0, 0.7).setDepth(29);
    this.tweens.add({ targets: flash, alpha: 0, scale: flash.scale * 1.4, duration: 240, onComplete: () => flash.destroy() });
  }

  private polvo(x: number, y: number): void {
    if (!this.visibleEn(x, y)) return;
    const c = this.centro(x, y), ts = this.ts;
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.5;
      const p = this.add.circle(c.x + a * ts * 0.14, c.y + ts * 0.32, ts * 0.05, 0xd8cfbd, 0.5).setDepth(9);
      this.tweens.add({ targets: p, x: c.x + a * ts * 0.35, y: c.y + ts * 0.2, scale: 2, alpha: 0, duration: 420, onComplete: () => p.destroy() });
    }
  }

  onda(x: number, y: number, color: string): void {
    if (!this.est) return;
    const c = this.centro(x, y), ts = this.ts;
    const an = this.add.image(c.x, c.y, "anillo").setTint(colorNum(color)).setDisplaySize(ts * 0.6, ts * 0.6).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: an, displayWidth: ts * 3.4, displayHeight: ts * 3.4, alpha: 0, duration: 700, ease: "Quad.easeOut", onComplete: () => an.destroy() });
  }

  private proyectil(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.visibleEn(x1, y1) && !this.visibleEn(x2, y2)) return;
    const a = this.centro(x1, y1), b = this.centro(x2, y2), ts = this.ts;
    const g = this.add.graphics().setDepth(30);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 200,
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const q = tw.getValue() ?? 0;
        g.clear().lineStyle(Math.max(2, ts * 0.05), 0xf4eed8, 1);
        const q0 = Math.max(0, q - 0.25);
        g.lineBetween(lerp(a.x, b.x, q0), lerp(a.y, b.y, q0) - ts * 0.3, lerp(a.x, b.x, q), lerp(a.y, b.y, q) - ts * 0.3);
      },
      onComplete: () => g.destroy()
    });
  }

  pantallaDe(x: number, y: number): { x: number; y: number; ts: number } {
    const r = this.game.canvas.getBoundingClientRect(), d = this.dpr, L = this.libre();
    const sx = (this.px(x) + this.ts / 2 - this.cx) * this.vz + L.x + L.w / 2, sy = (this.py(y) - this.cy) * this.vz + L.y + L.h / 2;
    return { x: r.left + sx / d, y: r.top + sy / d, ts: (this.ts * this.vz) / d };
  }

  /* ===================================================================== bucle */
  update(tiempo: number): void {
    if (!this.est || !this.listo) return;
    if (this.anim) this.pasoAnim(performance.now());
    this.pintarUnidades(tiempo);
    this.pintarResaltes(tiempo);
    // agua: las ondas se desplazan
    if (!REDUCIDO) {
      const f = Math.floor(tiempo / 230) % 4;
      for (const i of this.aguaIdx) {
        const x = i % this.est.ancho, y = Math.floor(i / this.est.ancho);
        this.tiles[i].setTexture(this.texTerreno("agua", Math.floor(hash(x, y, 1) * 4), (f + (x + y)) % 4));
      }
      // niebla y motas
      const w = this.est.ancho * this.ts, h = this.est.alto * this.ts;
      this.neblinas.forEach((n, i) => {
        const cx = this.ox + (((tiempo / (11000 + i * 2300) + i * 0.37) % 1.5) - 0.25) * w, cy = this.oy + h * (0.12 + 0.19 * i);
        n.setPosition(cx, cy).setDisplaySize(this.ts * (8 + 2 * i), this.ts * (1.8 + 0.5 * i));
      });
      this.motas.forEach((m, i) => {
        const x = this.ox + ((hash(i, 1, 5) + tiempo / 70000 * (0.4 + hash(i, 2, 5))) % 1) * w;
        const y = this.oy + ((((hash(i, 3, 5) - tiempo / 55000 * (0.5 + hash(i, 4, 5))) % 1) + 1) % 1) * h;
        m.setPosition(x, y);
      });
    }
  }
}

void mezcla; void oscuro;
