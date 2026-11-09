/* La simulacion: un mundo con sus criaturas, que avanza en pasos discretos. No usa Phaser ni el navegador, asi se prueba en Node.
   Con la misma semilla y la misma configuracion, da siempre la misma vida. El estado completo se puede guardar y restaurar,
   y el tiempo que el jugador estuvo fuera se simula despues en pasos mas grandes (con un tope). */

import { AJ } from "./ajustes.ts";
import { Azar, mezclar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { Criatura, type EstadoCriatura } from "./criatura.ts";
import { cruzar, type Genoma } from "./genoma.ts";
import type { Mortalidad } from "./tipos.ts";
import { Mundo, type EstadoMundo, type Objeto } from "./mundo.ts";

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
  extincion?: boolean;
  transporte?: boolean;
  aprendeBloqueos?: boolean;
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
  extincion?: boolean;
  transporte?: boolean;
  aprendeBloqueos?: boolean;
  /** Las salas de despues de la primera (cada una con su mundo). Sin ellas es una camara de una sala. */
  salasExtra?: { nombre: string; tipo: string; mundo: EstadoMundo }[];
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

/** Una sala del complejo: un mundo (una linea con objetos) con un nombre y un tipo. La sala 0 es el mundo de siempre. */
export interface Sala {
  id: number;
  nombre: string;
  tipo: string;
  mundo: Mundo;
}

export class Simulacion {
  semilla: number;
  t = 0;
  mundo: Mundo;
  /** Las salas del complejo. La primera comparte el mundo de `mundo`. Una camara experimental tiene una sola. */
  salas: Sala[] = [];
  criaturas: Criatura[] = [];
  azar: Azar;
  /** `activo: false` lo apaga (la criatura solo come lo que el jugador ponga). */
  comedero: { cada: number; max: number; tipo: string; activo?: boolean } | null;
  proxComedero = 0;
  protegida: boolean;
  mortalidad: Mortalidad;
  /** Si los golpes graves o repetidos dejan secuelas fisicas en las criaturas de la sala (apagado por defecto). */
  secuelas = false;
  /** Si el miedo aprendido a alguien baja con el contacto seguro (apagado por defecto). Es lo que permite rehabilitar a una criatura maltratada. */
  extincion = false;
  /** Si las criaturas de la sala pueden recoger objetos y llevarlos a cuestas (apagado por defecto). */
  transporte = false;
  /** Si un intento cortado por una barrera deja un recuerdo de que eso, ahi, no se consigue (apagado por defecto). */
  aprendeBloqueos = false;
  legado: Legado[] = [];
  /** Embarazos en curso: quien gesta, el otro progenitor y cuando nacen. */
  embarazos: { madre: number; padre: number; nace: number; genomaPadre: Genoma }[] = [];
  /** Se llama tras cada paso (el laboratorio lo usa para medir). */
  ganchos: ((s: Simulacion) => void)[] = [];

  constructor(cfg: ConfigSim) {
    this.semilla = cfg.semilla;
    this.mundo = new Mundo(mezclar(cfg.semilla, 1), cfg.ancho ?? AJ.ancho);
    this.azar = new Azar(mezclar(cfg.semilla, 2));
    this.salas = [{ id: 0, nombre: "Sala", tipo: "camara", mundo: this.mundo }];
    this.comedero = cfg.comedero ?? null;
    this.mortalidad = cfg.mortalidad ?? (cfg.protegida === false ? "permanente" : "protegida");
    this.protegida = this.mortalidad === "protegida";
    this.secuelas = cfg.secuelas ?? false;
    this.extincion = cfg.extincion ?? false;
    this.transporte = cfg.transporte ?? false;
    this.aprendeBloqueos = cfg.aprendeBloqueos ?? false;
    for (const o of cfg.objetos) this.mundo.agregar(o.tipo, o.x, { ...(o.activo === false ? { activo: false } : {}), ...(o.porciones !== undefined ? { porciones: o.porciones } : {}) });
    cfg.criaturas.forEach((cc, i) => {
      const c = new Criatura(i + 1, cc.nombre ?? NOMBRES[i % NOMBRES.length], JSON.parse(JSON.stringify(cc.genoma)), cc.x, cfg.semilla);
      c.mortalidad = this.mortalidad;
      c.permiteSecuelas = this.secuelas;
      c.extincion = this.extincion;
      c.puedeCargar = this.transporte;
      c.aprendeBloqueos = this.aprendeBloqueos;
      this.criaturas.push(c);
    });
    this.proxComedero = this.comedero ? this.comedero.cada * 0.3 : 0;
  }

  criatura(id: number): Criatura | undefined {
    return this.criaturas.find((c) => c.id === id);
  }

  paso(dt = AJ.dt): void {
    this.t += dt;
    // Cada criatura se mueve en su sala: ve los objetos y las criaturas de la suya y de ninguna otra. Los grupos se fijan antes, para que quien cruce una puerta no se mueva dos veces
    const grupos = this.salas.map((_, k) => this.criaturas.filter((c) => c.sala === k));
    this.salas.forEach((sala, k) => {
      const mundo = sala.mundo;
      const cs = grupos[k];
      const danos = mundo.paso(dt, cs.filter((c) => c.vivo));
      for (const d of danos) this.criatura(d.criatura)?.sufrirContinuo(d.cant / dt, dt, d.causa);
      if (k === 0) this.alimentar();
      const env = {
        mundo, criaturas: cs, t: this.t,
        embarazar: (madre: Criatura, padre: Criatura) => { madre.gestando = true; this.embarazos.push({ madre: madre.id, padre: padre.id, nace: this.t + AJ.gestacion, genomaPadre: JSON.parse(JSON.stringify(padre.genoma)) }); },
        cruzarSala: (c: Criatura, puerta: Objeto) => this.cruzarSala(c, puerta),
      };
      const antes = mundo.hayBarreras() ? cs.map((c) => c.x) : null;
      for (const c of cs) c.paso(env, dt);
      // Las barreras paran a quien intenta cruzarlas (la criatura queda junto a ella) y cuenta los segundos que lleva empujando contra una
      if (antes) {
        cs.forEach((c, i) => {
          if (c.sala !== k) return;
          const p = mundo.cruce(antes[i], c.x, 12);
          if (p !== null) { c.x = p; c.vx = 0; c.bloqueo += dt; } else c.bloqueo = 0;
        });
      }
      // Lo que se lleva a cuestas va con quien lo lleva
      mundo.llevar(cs);
      for (const c of cs) if (c.sala === k && c.lleva !== null && mundo.obj(c.lleva)?.llevadoPor !== c.id) c.lleva = null;
    });
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

  /** Anade una sala al complejo, vacia, y devuelve su numero. Los identificadores de sus objetos no chocan con los de las demas. */
  agregarSala(nombre: string, tipo: string, ancho = AJ.ancho): number {
    const id = this.salas.length;
    this.salas.push({ id, nombre, tipo, mundo: new Mundo(mezclar(this.semilla, 1, id), ancho, 100000 * id + 1) });
    return id;
  }

  /** Une dos salas con una puerta en cada una (la de una lleva a la otra). Devuelve las dos puertas. */
  conectar(a: number, xa: number, b: number, xb: number, cerrada = false): [Objeto, Objeto] {
    const pa = this.salas[a].mundo.agregar("puerta", xa, { destino: { sala: b, x: xb }, cerrada });
    const pb = this.salas[b].mundo.agregar("puerta", xb, { destino: { sala: a, x: xa }, cerrada });
    return [pa, pb];
  }

  /** Abre o cierra una puerta y la de enfrente. */
  fijarPuerta(sala: number, id: number, cerrada: boolean): void {
    const p = this.salas[sala]?.mundo.obj(id);
    if (!p?.destino) return;
    p.cerrada = cerrada;
    const q = this.salas[p.destino.sala]?.mundo.objetos.find((o) => o.tipo === "puerta" && o.destino?.sala === sala && Math.abs(o.destino.x - p.x) < 1);
    if (q) q.cerrada = cerrada;
  }

  /** Pasa a una criatura por una puerta a la otra sala, junto a la puerta de enfrente (y con lo que lleve a cuestas). Devuelve si lo ha hecho. */
  cruzarSala(c: Criatura, puerta: Objeto): boolean {
    const d = puerta.destino;
    const destino = d ? this.salas[d.sala] : undefined;
    if (!d || !destino || puerta.cerrada) return false;
    const origen = this.salas[c.sala].mundo;
    const objeto = c.lleva !== null ? origen.obj(c.lleva) : undefined;
    if (objeto) { origen.quitar(objeto.id); destino.mundo.acoger(objeto); }
    c.sala = d.sala;
    c.anchoSala = destino.mundo.ancho;
    c.x = Math.max(40, Math.min(destino.mundo.ancho - 40, d.x + (d.x < destino.mundo.ancho / 2 ? 70 : -70)));
    c.vx = 0;
    c.dir = d.x < destino.mundo.ancho / 2 ? 1 : -1;
    c.accion = null;
    c.hogar = null;
    c.percibidos = [];
    return true;
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

  /** Activa o apaga la extincion del miedo aprendido para toda la sala. */
  fijarExtincion(b: boolean): void {
    this.extincion = b;
    for (const c of this.criaturas) c.extincion = b;
  }

  /** Activa o apaga el transporte (cargar y soltar) para toda la sala. Al apagarlo, lo que llevaban se cae. */
  fijarTransporte(b: boolean): void {
    this.transporte = b;
    for (const c of this.criaturas) {
      c.puedeCargar = b;
      if (!b && c.lleva !== null) { this.mundo.soltar(c.lleva); c.lleva = null; }
    }
  }

  /** Activa o apaga que los intentos cortados por una barrera se recuerden, para toda la sala. */
  fijarBloqueos(b: boolean): void {
    this.aprendeBloqueos = b;
    for (const c of this.criaturas) c.aprendeBloqueos = b;
  }

  nacer(a: Criatura, b: Criatura, k = 0): Criatura {
    const id = Math.max(0, ...this.criaturas.map((c) => c.id)) + 1;
    const g = cruzar(a.genoma, b.genoma, k === 0 ? mezclar(this.semilla, id, Math.floor(this.t)) : mezclar(this.semilla, id, Math.floor(this.t), k));
    const x = Math.max(40, Math.min(this.salas[a.sala].mundo.ancho - 40, (a.x + b.x) / 2));
    const hijo = new Criatura(id, NOMBRES[(id - 1) % NOMBRES.length], g, x, this.semilla);
    hijo.sala = a.sala;
    hijo.anchoSala = this.salas[a.sala].mundo.ancho;
    hijo.mortalidad = this.mortalidad;
    hijo.permiteSecuelas = this.secuelas;
    hijo.extincion = this.extincion;
    hijo.puedeCargar = this.transporte;
    hijo.aprendeBloqueos = this.aprendeBloqueos;
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
        v: 1, semilla: this.semilla, t: this.t, mundo: this.mundo.estado(), ...(this.salas.length > 1 ? { salasExtra: this.salas.slice(1).map((s) => ({ nombre: s.nombre, tipo: s.tipo, mundo: s.mundo.estado() })) } : {}), criaturas: this.criaturas.map((c) => c.estado()), azar: this.azar.s,
        comedero: this.comedero, proxComedero: this.proxComedero, protegida: this.protegida, mortalidad: this.mortalidad, secuelas: this.secuelas, extincion: this.extincion, transporte: this.transporte, aprendeBloqueos: this.aprendeBloqueos, legado: this.legado, embarazos: this.embarazos,
      }),
    ) as EstadoSim;
  }

  static restaurar(e: EstadoSim): Simulacion {
    const s = new Simulacion({ semilla: e.semilla, objetos: [], criaturas: [], comedero: e.comedero, protegida: e.protegida, mortalidad: e.mortalidad, secuelas: e.secuelas, extincion: e.extincion, transporte: e.transporte, aprendeBloqueos: e.aprendeBloqueos });
    s.legado = JSON.parse(JSON.stringify(e.legado ?? []));
    s.embarazos = JSON.parse(JSON.stringify(e.embarazos ?? []));
    s.t = e.t;
    s.mundo.restaurar(e.mundo);
    for (const x of e.salasExtra ?? []) { const k = s.agregarSala(x.nombre, x.tipo, x.mundo.ancho); s.salas[k].mundo.restaurar(x.mundo); }
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
