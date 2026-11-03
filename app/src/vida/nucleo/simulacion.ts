/* La simulacion: un mundo con sus criaturas, que avanza en pasos discretos. No usa Phaser ni el navegador, asi se prueba en Node.
   Con la misma semilla y la misma configuracion, da siempre la misma vida. El estado completo se puede guardar y restaurar,
   y el tiempo que el jugador estuvo fuera se simula despues en pasos mas grandes (con un tope). */

import { AJ } from "./ajustes.ts";
import { Azar, mezclar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { Criatura, type EstadoCriatura } from "./criatura.ts";
import type { Genoma } from "./genoma.ts";
import { Mundo, type EstadoMundo } from "./mundo.ts";

export interface ConfigCriatura {
  genoma: Genoma;
  x: number;
  nombre?: string;
}

export interface ConfigSim {
  semilla: number;
  objetos: { tipo: string; x: number; activo?: boolean; porciones?: number }[];
  criaturas: ConfigCriatura[];
  /** Un dispensador que deja fruta de vez en cuando para que la criatura pueda vivir sola. */
  comedero?: { cada: number; max: number; tipo: string } | null;
  protegida?: boolean;
  ancho?: number;
}

export interface EstadoSim {
  v: 1;
  semilla: number;
  t: number;
  mundo: EstadoMundo;
  criaturas: EstadoCriatura[];
  azar: number;
  comedero: { cada: number; max: number; tipo: string } | null;
  proxComedero: number;
  protegida: boolean;
}

export interface ResumenFueraDeLinea {
  segundos: number;
  recortado: boolean;
  criaturas: { nombre: string; sucesos: { texto: string; val: number; n: number }[]; hambre: number; salud: number }[];
}

const NOMBRES = ["Brisa", "Nube", "Pipa", "Mota", "Gelo", "Tito", "Lúa", "Quino"];

export class Simulacion {
  semilla: number;
  t = 0;
  mundo: Mundo;
  criaturas: Criatura[] = [];
  azar: Azar;
  comedero: { cada: number; max: number; tipo: string } | null;
  proxComedero = 0;
  protegida: boolean;
  /** Se llama tras cada paso (el laboratorio lo usa para medir). */
  ganchos: ((s: Simulacion) => void)[] = [];

  constructor(cfg: ConfigSim) {
    this.semilla = cfg.semilla;
    this.mundo = new Mundo(mezclar(cfg.semilla, 1), cfg.ancho ?? AJ.ancho);
    this.azar = new Azar(mezclar(cfg.semilla, 2));
    this.comedero = cfg.comedero ?? null;
    this.protegida = cfg.protegida ?? true;
    for (const o of cfg.objetos) this.mundo.agregar(o.tipo, o.x, { ...(o.activo === false ? { activo: false } : {}), ...(o.porciones !== undefined ? { porciones: o.porciones } : {}) });
    cfg.criaturas.forEach((cc, i) => {
      const c = new Criatura(i + 1, cc.nombre ?? NOMBRES[i % NOMBRES.length], JSON.parse(JSON.stringify(cc.genoma)), cc.x, cfg.semilla);
      c.protegida = this.protegida;
      this.criaturas.push(c);
    });
    this.proxComedero = this.comedero ? this.comedero.cada * 0.3 : 0;
  }

  criatura(id: number): Criatura | undefined {
    return this.criaturas.find((c) => c.id === id);
  }

  paso(dt = AJ.dt): void {
    this.t += dt;
    const danos = this.mundo.paso(dt, this.criaturas.filter((c) => c.vivo));
    for (const d of danos) this.criatura(d.criatura)?.sufrirContinuo(d.cant / dt, dt, d.causa);
    this.alimentar();
    const env = { mundo: this.mundo, criaturas: this.criaturas, t: this.t };
    for (const c of this.criaturas) c.paso(env, dt);
    for (const g of this.ganchos) g(this);
  }

  private alimentar(): void {
    const cm = this.comedero;
    if (!cm || this.t < this.proxComedero) return;
    this.proxComedero = this.t + cm.cada;
    const hay = this.mundo.objetos.filter((o) => CATALOGO[o.tipo].nutri > 0.3 && CATALOGO[o.tipo].porciones > 0).length;
    if (hay >= cm.max) return;
    for (let i = 0; i < 8; i++) {
      const x = this.azar.entre(120, this.mundo.ancho - 120);
      const sobrePeligro = this.mundo.objetos.some((o) => CATALOGO[o.tipo].peligro && o.activo && Math.abs(o.x - x) < CATALOGO[o.tipo].peligro!.ancho / 2 + 30);
      if (sobrePeligro) continue;
      this.mundo.agregar(cm.tipo, x, { z: 160, vz: 0 });
      this.mundo.sonar(x, 0.1);
      return;
    }
  }

  /** Avanza `segundos` de tiempo de simulacion en pasos de dt. */
  avanzar(segundos: number, dt = AJ.dt): void {
    const n = Math.round(segundos / dt);
    for (let i = 0; i < n; i++) this.paso(dt);
  }

  /** El jugador estuvo fuera. Se simula lo pendiente en pasos grandes, con un tope, y se resume lo importante. */
  fueraDeLinea(segundos: number, tope = AJ.topeFueraDeLinea): ResumenFueraDeLinea {
    const seg = Math.max(0, Math.min(segundos, tope));
    const t0 = this.t;
    this.avanzar(seg, AJ.dtFueraDeLinea);
    const criaturas = this.criaturas.map((c) => {
      const sucesos = c.mem.episodios
        .filter((e) => e.t >= t0)
        .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
        .slice(0, 5)
        .map((e) => ({ texto: e.texto, val: e.val, n: e.n }));
      return { nombre: c.nombre, sucesos, hambre: c.nec[0], salud: c.salud };
    });
    return { segundos: seg, recortado: segundos > tope, criaturas };
  }

  serializar(): EstadoSim {
    return JSON.parse(
      JSON.stringify({
        v: 1, semilla: this.semilla, t: this.t, mundo: this.mundo.estado(), criaturas: this.criaturas.map((c) => c.estado()), azar: this.azar.s,
        comedero: this.comedero, proxComedero: this.proxComedero, protegida: this.protegida,
      }),
    ) as EstadoSim;
  }

  static restaurar(e: EstadoSim): Simulacion {
    const s = new Simulacion({ semilla: e.semilla, objetos: [], criaturas: [], comedero: e.comedero, protegida: e.protegida });
    s.t = e.t;
    s.mundo.restaurar(e.mundo);
    s.criaturas = e.criaturas.map((c) => {
      const k = Criatura.desde(c, e.semilla);
      k.protegida = e.protegida;
      return k;
    });
    s.azar.s = e.azar;
    s.proxComedero = e.proxComedero;
    return s;
  }
}
