import Phaser from "phaser";
import { K, MUEBLES, dibujarMueble, type DefMueble } from "../arte/escenarios.ts";
import { DIO_H, DIO_W, KD, SUELO_FONDO, SUELO_FRENTE, TEMAS_HAB, dioramaHabitacion, escalaProfundidad, limitesX, type TemaHab } from "../arte/habitacion.ts";
import { personaje } from "../datos/roster.ts";
import type { Habitacion } from "../estado.ts";
import { ChibiVivo } from "./chibiVivo.ts";

export interface Pieza {
  idx: number;
  def: DefMueble;
  im: Phaser.GameObjects.Image;
}

interface Habitante {
  c: ChibiVivo;
  id: string;
  espiritu: Phaser.GameObjects.Image;
  libre: boolean;
  /** Posicion en el diorama mientras la habitacion se proyecta en 3D (la de pantalla se escribe encima y se restaura tras dibujar). */
  lx?: number;
  ly?: number;
}

export interface Proyeccion { x: number; y: number; s: number; d: number; visible: boolean }
export type Proyector = (x: number, y: number, suelo: boolean) => Proyeccion;

const FRASES = {
  dormir: ["Zzz…", "Cinco minutos más…"],
  sentar: ["¡Qué cómodo!", "Aquí se está bien."],
  jugar: ["¡Otra ronda!", "¡Esta vez gano yo!"],
  ver: ["Hmm…", "Esto no estaba aquí."],
  saludo: ["¡Hola!", "¿Qué tal todo?", "¡Mira lo que encontré!"],
  respuesta: ["¡Eh, hola!", "Todo bien por aquí.", "¡Cuéntame!"],
};

export function tema(id: string): TemaHab {
  return TEMAS_HAB.find((t) => t.id === id) ?? TEMAS_HAB[0];
}

/* Una habitacion viva dentro de un contenedor: el diorama, los muebles y los personajes que viven ahi.
   Se usa en grande (pantalla de habitacion) y en pequeño (cada piso de la torre). Las coordenadas son las del diorama (1500x760). */
export class SalaVista {
  scene: Phaser.Scene;
  cont: Phaser.GameObjects.Container;
  hab: Habitacion;
  piezas: Pieza[] = [];
  gente: Habitante[] = [];
  bg?: Phaser.GameObjects.Image;
  vivo: boolean;
  dialogos: boolean;
  private parado = false;
  /** Cuanto se agrandan los personajes (en la torre se ven mas grandes que su habitacion, como en el original). */
  grande = 1;
  /** Si hay proyector, la habitacion no usa el diorama plano: sus muebles y personajes se colocan en una caja 3D (ver Cuarto3D). */
  proy?: Proyector;
  private sinFondo: boolean;
  private silencio: boolean;
  private temporizadores: Phaser.Time.TimerEvent[] = [];
  private emitir?: (ev: string, datos: unknown) => void;

  constructor(escena: Phaser.Scene, hab: Habitacion, opc: { vivo: boolean; dialogos: boolean; grande?: number; sinFondo?: boolean; silencio?: boolean; emitir?: (ev: string, datos: unknown) => void }) {
    this.grande = opc.grande ?? 1.55;
    this.scene = escena;
    this.hab = hab;
    this.vivo = opc.vivo;
    this.dialogos = opc.dialogos;
    this.emitir = opc.emitir;
    this.sinFondo = !!opc.sinFondo;
    this.silencio = !!opc.silencio;
    this.cont = escena.add.container(0, 0);
    this.reconstruir();
  }

  private texFondo(): string {
    const t = tema(this.hab.fondo);
    const k = `dio:${t.id}`;
    if (!this.scene.textures.exists(k)) this.scene.textures.addCanvas(k, dioramaHabitacion(t));
    return k;
  }

  private texMueble(id: string): string {
    const t = tema(this.hab.fondo);
    const k = `mue:${id}:${t.detalle}`;
    if (!this.scene.textures.exists(k)) this.scene.textures.addCanvas(k, dibujarMueble(id, t.detalle));
    return k;
  }

  colocar(x: number, y: number, escala: number): void {
    this.cont.setPosition(x, y).setScale(escala);
  }

  reconstruir(): void {
    this.temporizadores.forEach((t) => t.remove());
    this.temporizadores = [];
    this.gente.forEach((g) => { g.c.destruirTodo(); g.espiritu.destroy(); });
    this.gente = [];
    this.piezas.forEach((p) => p.im.destroy());
    this.piezas = [];
    this.bg?.destroy();
    if (!this.sinFondo) {
      this.bg = this.scene.add.image(0, 0, this.texFondo()).setOrigin(0).setScale(1 / KD).setDepth(0);
      this.cont.add(this.bg);
    }
    this.hab.muebles.forEach((mu, idx) => this.crearPieza(mu.id, idx));
    this.colocarPiezas();
    for (const id of this.hab.residentes.slice(0, 2)) {
      if (!personaje(id)) continue;
      const c = new ChibiVivo(this.scene, 0, 0, id, 0.6);
      const esp = this.scene.add.image(0, 0, `ficha:${id}`).setScale(0.3).setAlpha(0.95);
      this.cont.add([c, esp]);
      const g: Habitante = { c, id, espiritu: esp, libre: true };
      const x = 420 + Math.random() * 600, y = 580 + Math.random() * 140;
      c.setPosition(x, y).setScale(0.6 * this.grande * escalaProfundidad(y)).setDepth(y + 1);
      this.gente.push(g);
    }
    this.cont.sort("depth");
    if (this.vivo) this.gente.forEach((g, i) => this.temporizadores.push(this.scene.time.delayedCall(500 + i * 900, () => this.decidir(g))));
  }

  crearPieza(id: string, idx: number): Pieza {
    const def = MUEBLES.find((d) => d.id === id) as DefMueble;
    const im = this.scene.add.image(0, 0, this.texMueble(id)).setOrigin(0.5, def.suelo ? 1 : 0.5);
    this.cont.add(im);
    const p: Pieza = { idx, def, im };
    im.setData("pieza", p);
    this.piezas.push(p);
    return p;
  }

  colocarPiezas(): void {
    for (const p of this.piezas) {
      const mu = this.hab.muebles[p.idx];
      if (!mu) continue;
      const y = p.def.suelo ? Phaser.Math.Clamp(mu.y, SUELO_FONDO + 14, SUELO_FRENTE - 8) : Phaser.Math.Clamp(mu.y, 170, 440);
      const esc = p.def.suelo ? 0.82 * escalaProfundidad(y) : 0.8;
      p.im.setPosition(Phaser.Math.Clamp(mu.x, 60, DIO_W - 60), y).setScale(esc / K).setDepth(p.def.suelo ? y : 1);
    }
    this.cont.sort("depth");
  }

  /* ---------- la vida de los personajes ---------- */
  update(): void {
    if (this.proy) return;
    for (const g of this.gente) {
      const dx = g.c.x + (g.c.img.flipX ? -70 : 70) * g.c.scaleX;
      const dy = g.c.y - 250 * g.c.scaleX;
      g.espiritu.x += (dx - g.espiritu.x) * 0.08;
      g.espiritu.y += (dy + Math.sin(this.scene.time.now / 420 + g.c.x) * 8 - g.espiritu.y) * 0.08;
      g.espiritu.setDepth(g.c.y + 2).setScale(0.3 * g.c.scaleX / 0.6);
      g.c.setScale(0.6 * this.grande * escalaProfundidad(g.c.y)).setDepth(g.c.y + 1);
    }
  }

  parar(): void {
    this.parado = true;
    this.temporizadores.forEach((t) => t.remove());
    this.gente.forEach((g) => { g.c.destruirTodo(); g.espiritu.destroy(); });
    this.gente = [];
    this.piezas.forEach((p) => p.im.destroy());
    this.piezas = [];
    this.cont.destroy();
  }

  private esperar(ms: number, fn: () => void): void {
    this.temporizadores.push(this.scene.time.delayedCall(ms, () => { if (!this.parado) fn(); }));
  }

  /* Coloca muebles y personajes en la caja 3D segun la camara de este momento. Los personajes siguen moviendose por el diorama plano:
     aqui solo se guarda su posicion y se escribe encima la de pantalla, que restaurar() devuelve tras dibujar. */
  proyectar(): void {
    const P = this.proy;
    if (!P) return;
    for (const p of this.piezas) {
      const mu = this.hab.muebles[p.idx];
      if (!mu) continue;
      const q = P(mu.x, mu.y, p.def.suelo);
      p.im.setPosition(q.x, q.y).setScale((0.82 * 0.43 * q.s) / K).setDepth(q.d).setVisible(q.visible);
    }
    for (const g of this.gente) {
      if (g.lx === undefined) { g.lx = g.c.x; g.ly = g.c.y; }
      const q = P(g.lx, g.ly as number, true);
      const esc = 0.6 * this.grande * 0.42 * q.s;
      g.c.setPosition(q.x, q.y).setScale(esc).setDepth(q.d + 1).setVisible(q.visible);
      g.espiritu.setVisible(q.visible);
      if (q.visible) {
        const dx = q.x + (g.c.img.flipX ? -70 : 70) * esc, dy = q.y - 250 * esc + Math.sin(this.scene.time.now / 420 + q.x) * 6;
        g.espiritu.setPosition(dx, dy).setDepth(q.d + 2).setScale(0.3 * esc / 0.6);
      }
    }
    this.cont.sort("depth");
  }

  restaurar(): void {
    for (const g of this.gente) {
      if (g.lx === undefined) continue;
      g.c.setPosition(g.lx, g.ly as number);
      g.lx = undefined;
      g.ly = undefined;
    }
  }

  private globo(g: Habitante, texto: string): void {
    if (this.silencio) return;
    const t = this.scene.add.text(g.c.x, g.c.y - 300 * g.c.scaleX, texto, { fontFamily: '"Lilita One", sans-serif', fontSize: "34px", color: "#2a1545", backgroundColor: "#fff6e5", padding: { x: 14, y: 6 } }).setOrigin(0.5).setDepth(2000).setScale(0.3);
    this.cont.add(t);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 200, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 900, delay: 1100, onComplete: () => t.destroy() });
  }

  private tira(g: Habitante, texto: string): void {
    if (this.dialogos) this.emitir?.("pt:tira", { id: g.id, texto });
    else this.globo(g, texto);
  }

  private de(tipo: DefMueble["interaccion"]): Pieza[] {
    return this.piezas.filter((p) => p.def.interaccion === tipo);
  }

  decidir(g: Habitante): void {
    if (this.parado || !g.c.active) return;
    const r = Math.random();
    const dormir = this.de("dormir"), sentar = this.de("sentar"), jugar = this.de("jugar"), ver = this.de("ver");
    const otros = this.gente.filter((o) => o !== g);
    if (r < 0.14 && dormir.length) return this.irA(g, Phaser.Utils.Array.GetRandom(dormir), "dormir");
    if (r < 0.3 && sentar.length) return this.irA(g, Phaser.Utils.Array.GetRandom(sentar), "sentar");
    if (r < 0.46 && jugar.length) return this.irA(g, Phaser.Utils.Array.GetRandom(jugar), "jugar");
    if (r < 0.56 && ver.length) return this.irA(g, Phaser.Utils.Array.GetRandom(ver), "ver");
    if (r < 0.72 && otros.length) return this.saludar(g, Phaser.Utils.Array.GetRandom(otros));
    this.pasear(g);
  }

  private pasear(g: Habitante, luego?: () => void): void {
    const y = 570 + Math.random() * 160;
    const [a, b] = limitesX(y);
    const x = a + Math.random() * (b - a);
    this.scene.tweens.add({ targets: g.c, y, duration: 500 });
    g.c.caminar(x, Math.max(900, Math.abs(x - g.c.x) * 2.4), () => {
      if (luego) luego(); else this.esperar(500 + Math.random() * 2500, () => this.decidir(g));
    });
  }

  /* Donde esta un mueble en el diorama plano, sin depender de como se dibuje en pantalla. */
  private posLogica(p: Pieza): { x: number; y: number; w: number } {
    const mu = this.hab.muebles[p.idx];
    const y = p.def.suelo ? Phaser.Math.Clamp(mu.y, SUELO_FONDO + 14, SUELO_FRENTE - 8) : Phaser.Math.Clamp(mu.y, 170, 440);
    const esc = p.def.suelo ? 0.82 * escalaProfundidad(y) : 0.8;
    return { x: Phaser.Math.Clamp(mu.x, 60, DIO_W - 60), y, w: (p.im.width * esc) / K };
  }

  private irA(g: Habitante, p: Pieza, que: "dormir" | "sentar" | "jugar" | "ver"): void {
    const l = this.posLogica(p);
    const x = l.x + (que === "jugar" ? l.w * 0.62 : 0);
    const y = que === "dormir" ? l.y - 24 : que === "sentar" ? l.y - 14 : l.y + 8;
    this.scene.tweens.add({ targets: g.c, y, duration: 700 });
    g.c.caminar(x, Math.max(900, Math.abs(x - g.c.x) * 2.4), () => {
      g.c.quieto();
      const frase = Phaser.Utils.Array.GetRandom(FRASES[que]) as string;
      if (que === "dormir") {
        g.c.expresion("blink");
        this.scene.tweens.add({ targets: g.c.img, angle: 86, duration: 500, ease: "Back.easeOut" });
        this.tira(g, frase);
        this.esperar(8500, () => { g.c.expresion("idle"); this.scene.tweens.add({ targets: g.c.img, angle: 0, duration: 400 }); this.decidir(g); });
      } else if (que === "sentar") {
        g.c.expresion("feliz");
        this.tira(g, frase);
        this.esperar(6000, () => { g.c.expresion("idle"); this.decidir(g); });
      } else if (que === "jugar") {
        this.tira(g, frase);
        for (let i = 0; i < 3; i++) this.esperar(i * 800, () => g.c.saltar(34));
        this.esperar(3600, () => this.decidir(g));
      } else {
        g.c.expresion("poder", 1500);
        this.tira(g, frase);
        this.esperar(4000, () => this.decidir(g));
      }
    });
  }

  private saludar(g: Habitante, o: Habitante): void {
    this.pasear(g, () => {
      const x = o.c.x + (g.c.x < o.c.x ? -110 : 110);
      this.scene.tweens.add({ targets: g.c, y: o.c.y, duration: 500 });
      g.c.caminar(x, 700, () => {
        g.c.quieto(); g.c.saltar(34); o.c.saltar(34);
        this.tira(g, Phaser.Utils.Array.GetRandom(FRASES.saludo) as string);
        this.esperar(1400, () => this.tira(o, Phaser.Utils.Array.GetRandom(FRASES.respuesta) as string));
        this.esperar(3600, () => this.decidir(g));
      });
    });
  }

  /* Cuando se decora no se mueven. */
  pausarVida(si: boolean): void {
    if (si) { this.temporizadores.forEach((t) => t.remove()); this.temporizadores = []; this.gente.forEach((g) => { g.c.quieto(); this.scene.tweens.killTweensOf(g.c); }); }
    else this.gente.forEach((g, i) => this.esperar(400 + i * 700, () => this.decidir(g)));
  }
}

export { DIO_H, DIO_W };
