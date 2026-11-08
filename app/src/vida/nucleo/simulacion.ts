/* La simulacion: un mundo con sus criaturas, que avanza en pasos discretos. No usa Phaser ni el navegador, asi se prueba en Node.
   Con la misma semilla y la misma configuracion, da siempre la misma vida. El estado completo se puede guardar y restaurar,
   y el tiempo que el jugador estuvo fuera se simula despues en pasos mas grandes (con un tope). */

import { AJ } from "./ajustes.ts";
import { Azar, mezclar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { Criatura, type EstadoCriatura } from "./criatura.ts";
import { cruzar, type Genoma } from "./genoma.ts";
import type { Mortalidad } from "./tipos.ts";
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
  comedero?: { cada: number; max: number; tipo: string; activo?: boolean } | null;
  protegida?: boolean;
  mortalidad?: Mortalidad;
  secuelas?: boolean;
  ancho?: number;
}

export interface EstadoSim {
  v: 1;
  semilla: number;
  t: number;
  mundo: EstadoMundo;
  criaturas: EstadoCriatura[];
  azar: number;
  comedero: { cada: number; max: number; tipo: string; activo?: boolean } | null;
  proxComedero: number;
  protegida: boolean;
  mortalidad?: Mortalidad;
  secuelas?: boolean;
  legado?: Legado[];
  embarazos?: { madre: number; padre: number; nace: number; genomaPadre: Genoma }[];
  proxNombre?: number;
}

/** Lo que queda de una criatura que murio: su genoma, su historia y sus rasgos. Sirve para recordarla y para criar de ella. */
export interface Legado {
  id: number;
  nombre: string;
  dia: number;
  edadDias: number;
  causa: string;
  genoma: Genoma;
  rasgos: number[];
  base: number[];
  episodios: string[];
  hijos: number;
  padres: number[];
  generacion: number;
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
  /** `activo: false` lo apaga (la criatura solo come lo que el jugador ponga). */
  comedero: { cada: number; max: number; tipo: string; activo?: boolean } | null;
  proxComedero = 0;
  protegida: boolean;
  mortalidad: Mortalidad;
  /** Si los golpes graves o repetidos dejan secuelas fisicas en las criaturas de la sala (apagado por defecto). */
  secuelas = false;
  legado: Legado[] = [];
  /** Embarazos en curso: quien gesta, el otro progenitor y cuando nacen. */
  embarazos: { madre: number; padre: number; nace: number; genomaPadre: Genoma }[] = [];
  /** Se llama tras cada paso (el laboratorio lo usa para medir). */
  ganchos: ((s: Simulacion) => void)[] = [];

  constructor(cfg: ConfigSim) {
    this.semilla = cfg.semilla;
    this.mundo = new Mundo(mezclar(cfg.semilla, 1), cfg.ancho ?? AJ.ancho);
    this.azar = new Azar(mezclar(cfg.semilla, 2));
    this.comedero = cfg.comedero ?? null;
    this.mortalidad = cfg.mortalidad ?? (cfg.protegida === false ? "permanente" : "protegida");
    this.protegida = this.mortalidad === "protegida";
    this.secuelas = cfg.secuelas ?? false;
    for (const o of cfg.objetos) this.mundo.agregar(o.tipo, o.x, { ...(o.activo === false ? { activo: false } : {}), ...(o.porciones !== undefined ? { porciones: o.porciones } : {}) });
    cfg.criaturas.forEach((cc, i) => {
      const c = new Criatura(i + 1, cc.nombre ?? NOMBRES[i % NOMBRES.length], JSON.parse(JSON.stringify(cc.genoma)), cc.x, cfg.semilla);
      c.mortalidad = this.mortalidad;
      c.permiteSecuelas = this.secuelas;
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
    const env = {
      mundo: this.mundo, criaturas: this.criaturas, t: this.t,
      embarazar: (madre: Criatura, padre: Criatura) => { madre.gestando = true; this.embarazos.push({ madre: madre.id, padre: padre.id, nace: this.t + AJ.gestacion, genomaPadre: JSON.parse(JSON.stringify(padre.genoma)) }); },
    };
    for (const c of this.criaturas) c.paso(env, dt);
    this.partos();
    for (const c of this.criaturas) if (!c.vivo && !this.legado.some((l) => l.id === c.id)) this.registrarLegado(c);
    for (const g of this.ganchos) g(this);
  }

  /** Nacen las crias de los embarazos cuyo plazo ha llegado, hasta donde quepan en la sala. */
  private partos(): void {
    if (!this.embarazos.length) return;
    const quedan: typeof this.embarazos = [];
    for (const e of this.embarazos) {
      if (e.nace > this.t) { quedan.push(e); continue; }
      const madre = this.criatura(e.madre);
      if (!madre || !madre.vivo) continue;
      madre.gestando = false;
      madre.impulso = 0;
      const padre = this.criatura(e.padre);
      const hueco = AJ.maxCriaturasSala - this.criaturas.filter((c) => c.vivo).length;
      // Si el padre ya no esta, nace con su genoma guardado
      const nacidos = padre ? this.parir(madre, padre, hueco) : this.parirCon(madre, e.genomaPadre, e.padre, hueco);
      madre.mem.anotar(this.t, `parto:${Math.floor(this.t)}`, nacidos.length === 1 ? "Tuvo una cría." : nacidos.length ? `Tuvo ${nacidos.length} crías.` : "No había sitio para sus crías.", 0.6);
    }
    this.embarazos = quedan;
  }

  private parirCon(madre: Criatura, genomaPadre: Genoma, idPadre: number, hueco: number): Criatura[] {
    const falso = new Criatura(idPadre, "", genomaPadre, madre.x, this.semilla);
    return this.parir(madre, falso, hueco);
  }

  private registrarLegado(c: Criatura): void {
    this.legado.push({
      id: c.id, nombre: c.nombre, dia: Math.floor(this.t / 1800) + 1, edadDias: Math.floor(c.edad / 1800) + 1, causa: c.causa || "de causas naturales",
      genoma: JSON.parse(JSON.stringify(c.genoma)), rasgos: c.rasgos.slice(), base: c.base.slice(),
      episodios: c.mem.episodios.slice().sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, 4).map((e) => e.texto), hijos: 0, padres: c.padres.slice(), generacion: c.generacion,
    });
  }

  /** Cambia lo que pasa cuando la salud llega a cero, para toda la sala. */
  fijarMortalidad(m: Mortalidad): void {
    this.mortalidad = m;
    this.protegida = m === "protegida";
    for (const c of this.criaturas) c.mortalidad = m;
  }

  /** Nace una cria de dos criaturas vivas: hereda predisposiciones mezcladas (con alguna mutacion pequena) y empieza sin recuerdos. */
  /** Cuantas crias tiene una camada: casi siempre una, algunas veces dos y pocas tres. */
  tamanoCamada(a: Criatura, b: Criatura): number {
    const r = new Azar(mezclar(this.semilla, a.id, b.id, Math.floor(this.t), 31)).next();
    return r < AJ.camadaTres ? 3 : r < AJ.camadaTres + AJ.camadaDos ? 2 : 1;
  }

  /** Una camada de una pareja, sin pasar de `hueco` crias. Cada una cruza los genomas por separado: son mellizos, no gemelos identicos. */
  parir(a: Criatura, b: Criatura, hueco = 3): Criatura[] {
    const n = Math.min(hueco, this.tamanoCamada(a, b));
    const hijos: Criatura[] = [];
    for (let i = 0; i < n; i++) hijos.push(this.nacer(a, b, i));
    return hijos;
  }

  /** Activa o apaga las secuelas fisicas para toda la sala. */
  fijarSecuelas(b: boolean): void {
    this.secuelas = b;
    for (const c of this.criaturas) c.permiteSecuelas = b;
  }

  nacer(a: Criatura, b: Criatura, k = 0): Criatura {
    const id = Math.max(0, ...this.criaturas.map((c) => c.id)) + 1;
    const g = cruzar(a.genoma, b.genoma, k === 0 ? mezclar(this.semilla, id, Math.floor(this.t)) : mezclar(this.semilla, id, Math.floor(this.t), k));
    const x = Math.max(40, Math.min(this.mundo.ancho - 40, (a.x + b.x) / 2));
    const hijo = new Criatura(id, NOMBRES[(id - 1) % NOMBRES.length], g, x, this.semilla);
    hijo.mortalidad = this.mortalidad;
    hijo.permiteSecuelas = this.secuelas;
    hijo.capRegistro = a.capRegistro;
    hijo.padres = [a.id, b.id];
    hijo.generacion = Math.max(a.generacion, b.generacion) + 1;
    this.criaturas.push(hijo);
    return hijo;
  }

  private alimentar(): void {
    const cm = this.comedero;
    if (!cm || cm.activo === false || this.t < this.proxComedero) return;
    this.proxComedero = this.t + cm.cada;
    const hay = this.mundo.objetos.filter((o) => CATALOGO[o.tipo].nutri > 0.3 && CATALOGO[o.tipo].porciones > 0).length;
    if (hay >= cm.max) return;
    for (let i = 0; i < 8; i++) {
      const x = this.azar.entre(120, this.mundo.ancho - 120);
      const sobrePeligro = this.mundo.objetos.some((o) => CATALOGO[o.tipo].peligro && o.activo && Math.abs(o.x - x) < CATALOGO[o.tipo].peligro!.ancho / 2 + 30);
      if (sobrePeligro) continue;
      this.mundo.agregar(cm.tipo, x, { z: 560, vz: 0 });
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
    return this.resumenDesde(t0, seg, segundos > tope);
  }

  /** Lo mas importante que le paso a cada criatura desde el instante t0. */
  resumenDesde(t0: number, segundos: number, recortado: boolean): ResumenFueraDeLinea {
    const criaturas = this.criaturas.map((c) => {
      const sucesos = c.mem.episodios
        .filter((e) => e.t >= t0)
        .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
        .slice(0, 5)
        .map((e) => ({ texto: e.texto, val: e.val, n: e.n }));
      return { nombre: c.nombre, sucesos, hambre: c.nec[0], salud: c.salud };
    });
    return { segundos, recortado, criaturas };
  }

  serializar(): EstadoSim {
    return JSON.parse(
      JSON.stringify({
        v: 1, semilla: this.semilla, t: this.t, mundo: this.mundo.estado(), criaturas: this.criaturas.map((c) => c.estado()), azar: this.azar.s,
        comedero: this.comedero, proxComedero: this.proxComedero, protegida: this.protegida, mortalidad: this.mortalidad, secuelas: this.secuelas, legado: this.legado, embarazos: this.embarazos,
      }),
    ) as EstadoSim;
  }

  static restaurar(e: EstadoSim): Simulacion {
    const s = new Simulacion({ semilla: e.semilla, objetos: [], criaturas: [], comedero: e.comedero, protegida: e.protegida, mortalidad: e.mortalidad, secuelas: e.secuelas });
    s.legado = JSON.parse(JSON.stringify(e.legado ?? []));
    s.embarazos = JSON.parse(JSON.stringify(e.embarazos ?? []));
    s.t = e.t;
    s.mundo.restaurar(e.mundo);
    s.criaturas = e.criaturas.map((c) => {
      const k = Criatura.desde(c, e.semilla);
      k.mortalidad = s.mortalidad;
      return k;
    });
    s.azar.s = e.azar;
    s.proxComedero = e.proxComedero;
    return s;
  }
}
