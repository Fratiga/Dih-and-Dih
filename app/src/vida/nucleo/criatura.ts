/* La criatura: su cuerpo (necesidades), su caracter (rasgos y emociones), su cabeza (red + memoria) y lo que hace.
   Este archivo guarda el estado y lo que se aprende de cada experiencia. Percibir y decidir esta en conducta.ts y moverse y actuar en acciones.ts. */

import { AJ } from "./ajustes.ts";
import { Azar, acota, mezclar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { afectoDe, candidatas, contrasteAspecto, elegir, featuresObjeto, firmaDe, gustoDe, percibir, valorDeProbar, type Cand } from "./conducta.ts";
import { ejecutar, iniciar } from "./acciones.ts";
import { sexoDe, type Genoma } from "./genoma.ts";
import { SeguimientoAtencion } from "./social.ts";
import { Memoria, articulo, semejanza, type EstadoMemoria } from "./memoria.ts";
import type { Mundo, Objeto } from "./mundo.ts";
import { Red, type EstadoRed } from "./red.ts";
import { C, D, DIA, E, N, NC_RED, R, TIEMPO_TENDIDA, VERBOS, resCero, type Mortalidad, type Percepto, type Res, type Verbo } from "./tipos.ts";

export interface Entorno {
  mundo: Mundo;
  criaturas: Criatura[];
  t: number;
  /** Lo pone la simulacion: registra que una pareja ha aceptado reproducirse. */
  embarazar?: (madre: Criatura, padre: Criatura) => void;
}

/** Raza simple: una criatura que decide con una regla fija en lugar de con su cerebro. No aprende, sus rasgos no cambian y su conducta es la misma en cualquier situacion.
    Sirve de actor en las pruebas (la agresora, la cuidadora) y como monstruo o mascota sencillos. `hostil` golpea sin parar a la mas cercana; `amistosa` se acerca y se queda a su lado. */
export type Rutina = "hostil" | "amistosa";

/** Una secuela fisica: lo que dejan los golpes graves o repetidos y no se cura. Tiene un efecto funcional (la criatura hace menos) y una marca que se ve en su cuerpo. */
export type TipoSecuela = "cojera" | "debilidad" | "vista" | "oido";
export interface Secuela {
  tipo: TipoSecuela;
  /** Donde se ve la marca: pata trasera, pata delantera, flanco, ojo u oreja. */
  zona: string;
  /** De 0 a 1: cuanto limita. */
  gravedad: number;
  t: number;
  /** Quien la causo (el id de percepcion, 1000 mas el de la criatura). */
  causa: number;
  /** Lo que se lee en la ficha y en la historia. */
  texto: string;
  efecto: string;
}

export interface Accion {
  v: Verbo;
  obj: number;
  tipo: string;
  nombre: string;
  esCriatura: boolean;
  recordado: boolean;
  dest: number;
  fase: "ir" | "hacer";
  t0: number;
  tf: number;
  dur: number;
  hecho: boolean;
  /** Se acerca con intencion de cortejar. */
  cortejo?: boolean;
  comp: number;
  /** Si al empezar habia a la vista una criatura angustiada: quien, cuanta angustia se le percibia y como la veia. Al terminar se nota si ha bajado. */
  ajeno?: { obj: number; ini: number; f: number[]; nombre: string; medido?: boolean };
  f: number[];
  /** Lo que esperaba conseguir al elegirla (para notar cuando no llega). */
  espera: Res;
}

/** Lo ultimo que comio, para que las que la miran sepan que eso se come. */
export interface Comida {
  t: number;
  f: number[];
  tipo: string;
  nombre: string;
  x: number;
}

/** Envidia (solo alimento): `nivel` (de 0 a 1) por ver comer a `poseedor` algo que ella desea y no tiene. `donde` es el sitio del ultimo bocado visto (para no tomar
    por «otro alimento» el que esta comiendo el poseedor) y `visto` cuando lo vio por ultima vez. */
export interface Envidia {
  poseedor: number;
  recurso: string;
  nivel: number;
  pico: number;
  anotado: boolean;
  donde: number;
  visto: number;
}

/** Celos: `nivel` (de 0 a 1) por ver que `vinculo`, a quien quiere, atiende a `tercero`. `pico` es lo mas alto que llego en este episodio. */
export interface Celo {
  vinculo: number;
  tercero: number;
  nivel: number;
  pico: number;
  anotado: boolean;
  /** Cuanto teme ahora a la tercera (de 0 a 1). Frena los celos y lo que le empujan a hacer. */
  temor?: number;
}

export interface Traza {
  t: number;
  v: Verbo;
  f: number[];
  lug: number;
  tipo: string;
  nombre: string;
  cred: number;
  entrada: number[];
  /** Sobre que objeto se hizo. */
  obj: number;
}

export interface Registro {
  t: number;
  kind: "inicio" | "impacto";
  v: Verbo;
  tipo: string;
  obj: number;
  res?: number[];
}

export const NI = D + VERBOS.length + 5 + 5 + 1;
const CANALES_SIN_SACIA = [false, true, true, true, true, true];

export interface EstadoCriatura {
  id: number;
  nombre: string;
  genoma: Genoma;
  huella: number;
  azar: number;
  x: number;
  dir: number;
  nec: number[];
  salud: number;
  emo: number[];
  rasgos: number[];
  mem: EstadoMemoria;
  red: EstadoRed;
  accion: Accion | null;
  trazas: Traza[];
  edad: number;
  dormido: boolean;
  fallos: Record<string, number>;
  ultimoDano: number;
  vivo: boolean;
  incap: number;
  causa: string;
  mortalidad: Mortalidad;
  padres: number[];
  generacion: number;
  espera: number;
  proxDecision: number;
  forzar: boolean;
  acumOlvido: number;
  expuesto: Record<number, number>;
  atencion: Atencion | null;
  ultimoImpacto: Atencion | null;
  ultimoContagio: number;
  ayudaInnata: boolean;
  estadosAjenos: boolean;
  reconocePorRasgos: boolean;
  aprendeObservando: boolean;
  agresion: boolean;
  celos: boolean;
  celosEstado: Celo[];
  rutina?: Rutina | null;
  permiteSecuelas?: boolean;
  secuelas?: Secuela[];
  danoAcumulado?: number;
  envidia: boolean;
  envidiaEstado: Envidia[];
  vistoBocado: Record<number, number>;
  atendidaPor: Record<number, number>;
  fatiga: number;
  reproduccion: boolean;
  impulso: number;
  gestando: boolean;
  aversionSexo: number[];
  aversionInd: Record<number, number>;
  ultimoCortejo: { t: number; con: number } | null;
  ajusteReaccion: number[][];
  ultimoRechazo: { t: number; rol: 0 | 1; reaccion: number } | null;
  gustos: boolean;
  valencias: number[];
  reputacion: Record<number, { agresion: number; t?: number }>;
  ultimoGolpe: { t: number; contra: number } | null;
  conflictoComida: boolean;
  represalia: { contra: number; t: number } | null;
  agravios: Record<number, { n: number; t: number }>;
  ultimoComer: Comida | null;
  vistoComer: number;
  atrapada: boolean;
  inconsolable: boolean;
  habito: Record<number, { n: number; t: number }>;
  ayuda: { quien: number; t: number } | null;
}

/** Lo que otra criatura acaba de hacer con algo, visto desde aqui. */
export interface Atencion {
  obj: number;
  v: Verbo;
  t: number;
  quien: number;
}

export class Criatura {
  id: number;
  nombre: string;
  genoma: Genoma;
  huella: number;
  azar: Azar;
  x: number;
  dir = 1;
  vx = 0;
  /** hambre, sueno, dolor, aburrimiento, soledad (de 0 a 1, 1 es lo peor) */
  nec = [0.2, 0.1, 0, 0.3, 0.2];
  salud = 1;
  /** miedo, curiosidad, frustracion, apego, excitacion */
  emo = [0, 0.4, 0, 0, 0];
  base: number[];
  /** Los rasgos tal como estan ahora: predisposicion genetica mas lo vivido. */
  rasgos: number[];
  mem: Memoria;
  red: Red;
  accion: Accion | null = null;
  trazas: Traza[] = [];
  edad = 0;
  dormido = false;
  vivo = true;
  fallos: Record<string, number> = {};
  ultimoDano = -99;
  // Lo que no se guarda: se recalcula
  espera = 0;
  proxDecision = 0;
  forzar = false;
  percibidos: Percepto[] = [];
  acumOlvido = 0;
  expuesto: Record<number, number> = {};
  /** Lo ultimo que vio hacer a otra criatura con un objeto (dura unos segundos). */
  atencion: Atencion | null = null;
  /** Lo ultimo que hizo yo con un objeto, para que lo vean los demas. */
  ultimoImpacto: Atencion | null = null;
  ultimoContagio = -99;
  /** Regla escrita a mano: ver sufrir a alguien querido hace acercarse a el. Se puede apagar para probar si la conducta se aprende sola. */
  ayudaInnata = true;
  /** Experimental (caso 08b): percibe la angustia de otras criaturas como senal, se alarma con ella, y consolar a alguien querido se vive como mas compania. */
  estadosAjenos = false;
  /** Experimental: reconoce a los demas por lo que percibe de ellos y no por su etiqueta, y quien conoce le atrae mas. */
  reconocePorRasgos = false;
  /** Experimental: si ve que otra criatura actua sobre una maquina y poco despues sale algo que le interesa, aprende que esa accion lo trae. */
  aprendeObservando = false;
  /** Experimental: puede empujar a otras criaturas (y hacerles dano). Si compensa o no lo aprende viviendo. */
  agresion = false;
  /** Experimental: celos. Si alguien a quien quiere atiende a una tercera, siente celos mientras lo ve; no son frustracion, no dan acciones nuevas y se van con el tiempo. */
  celos = false;
  celosEstado: Celo[] = [];
  /** Raza simple (ver `Rutina`). Con null decide con su cerebro, como todas. */
  rutina: Rutina | null = null;
  /** Opcional: si los golpes graves o repetidos dejan secuelas fisicas. Apagado, no se acumula nada y la criatura es la de siempre. */
  permiteSecuelas = false;
  secuelas: Secuela[] = [];
  /** Dano recibido que aun cuenta para la proxima secuela. */
  danoAcumulado = 0;
  /** Experimental: envidia. Si ve comer a otra algo que desea (tiene hambre) y no tiene, la siente mientras dura; no es hambre ni frustracion, no da acciones nuevas y no la lleva a robar ni a pegar. */
  envidia = false;
  envidiaEstado: Envidia[] = [];
  /** Cuando vio el ultimo bocado de cada criatura (para contar cada bocado una sola vez). */
  vistoBocado: Record<number, number> = {};
  /** Lo que ve de la atencion entre las criaturas que tiene a la vista (se rehace con lo que ve, no se guarda). */
  social = new SeguimientoAtencion();
  /** Cuando fue la ultima vez que alguien a quien quiere la atendio a ella (para notar que ya no lo hace). */
  atendidaPor: Record<number, number> = {};
  /** De 0 a 1. Sube con los golpes dados y recibidos y baja con el tiempo: limita las peleas y empuja a descansar. No borra la memoria de quien ataco. */
  fatiga = 0;
  /** Experimental: reproduccion autonoma. Tiene un impulso que sube de adulta, busca pareja de otro sexo, y se acepta o se rechaza segun afecto, gusto y aversion. */
  reproduccion = false;
  /** De 0 a 1. Sube con el tiempo en una adulta y se vacia al reproducirse. */
  impulso = 0;
  /** Gesta (solo quien tiene el sexo 1): no cortejada ni cortejando hasta el parto. */
  gestando = false;
  /** Aversion aprendida a cortejar o ser cortejada con cada sexo (por un castigo justo despues de un cortejo), y con cada individuo. */
  aversionSexo: number[] = [0, 0];
  aversionInd: Record<number, number> = {};
  /** El ultimo cortejo en que participo (lo inicio ella o la cortejaron), para ligarle un premio o un castigo. */
  ultimoCortejo: { t: number; con: number } | null = null;
  /** Lo que ha aprendido sobre como reaccionar al rechazo (indice 0 si la rechazaron, 1 si rechazo ella) a cada reaccion: enfado, miedo, indiferencia o alegria. Se suma
      al exponente de su peso, asi un premio tras una reaccion la hace mas probable y un susto la hace menos. */
  ajusteReaccion: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0]];
  /** La ultima vez que hubo un rechazo en que participo y que reaccion tuvo (para ligarle un premio o un susto). */
  ultimoRechazo: { t: number; rol: 0 | 1; reaccion: number } | null = null;
  /** Experimental: toma gustos y manias por el aspecto (tamano, color, cuernos) y por la conducta de los demas, a partir de lo que vive con ellos. */
  gustos = false;
  /** Lo que ha aprendido a gustarle (+) o disgustarle (-) de cada rasgo de aspecto, que se aplica a cualquiera que lo tenga. */
  valencias: number[] = [0, 0, 0, 0];
  /** Lo que ha visto hacer a cada criatura (por ahora, pegar a otras). */
  reputacion: Record<number, { agresion: number; t?: number }> = {};
  /** Ultimo golpe que dio y a quien (para que lo vean las demas). */
  ultimoGolpe: { t: number; contra: number } | null = null;
  /** Experimental: la comida que otra esta comiendo esta ocupada (no se come a la vez) y se puede disputar. */
  conflictoComida = false;
  /** Quien la golpeo hace poco, para responder. */
  represalia: { contra: number; t: number } | null = null;
  /** El dano intercambiado con cada criatura (la que lo hizo o el que lo recibio), que se va olvidando. Mientras dura, estar cerca de ella no crea afecto. */
  agravios: Record<number, { n: number; t: number }> = {};
  ultimoComer: Comida | null = null;
  /** El instante de la ultima comida ajena que ya vio. */
  vistoComer = -1;
  /** Condiciones de laboratorio: no puede moverse (no puede ayudar a nadie) / su angustia no baja nunca (nada la alivia). */
  atrapada = false;
  /** Solo laboratorio: fuerza el verbo elegido mientras haya una candidata con el. No se guarda. */
  verboForzado: Verbo | null = null;
  inconsolable = false;
  /** Cuanto se ha entretenido hace poco con cada cosa (por su identificador). Lo que se repite sin parar entretiene cada vez menos, y se recupera con el descanso. */
  habito: Record<number, { n: number; t: number }> = {};
  ayuda: { quien: number; t: number } | null = null;
  registro: Registro[] = [];
  capRegistro = 600;
  t = 0;
  /** Que pasa cuando la salud llega a cero (ver Mortalidad). */
  mortalidad: Mortalidad = "protegida";
  /** Instante en que quedo tendida sin fuerzas (-1 si no lo esta). Solo en la mortalidad recuperable. */
  incap = -1;
  causa = "";
  /** De quien nacio (vacio si nacio del laboratorio). */
  padres: number[] = [];
  /** 0 si nacio del laboratorio, y una mas que la de sus padres si nacio de una cria. */
  generacion = 0;
  /** Ultimo vistazo a lo que penso al decidir, para mostrarlo. */
  ultimaDecision: { v: Verbo; tipo: string; u: number }[] = [];

  constructor(id: number, nombre: string, genoma: Genoma, x: number, semilla: number) {
    this.id = id;
    this.nombre = nombre;
    this.genoma = genoma;
    this.azar = new Azar(mezclar(semilla, id, 77));
    this.huella = 0.1 + 0.8 * new Azar(mezclar(semilla, id, 5)).next();
    this.x = x;
    this.base = genoma.rasgos.slice();
    this.rasgos = genoma.rasgos.slice();
    this.mem = new Memoria(genoma.memoria, genoma.plasticidad);
    this.red = new Red(NI, AJ.ocultas, NC_RED, genoma.semillaCerebro, undefined, AJ.entradasExtra);
    this.emo[E.curiosidad] = this.rasgos[R.curiosidad] * 0.6;
  }

  /* ---------- Un paso de vida ---------- */

  paso(env: Entorno, dt: number): void {
    this.t = env.t;
    this.edad += dt;
    if (!this.vivo) return;
    this.necesidades(env, dt);
    this.emociones(dt);
    if (!this.vivo) return;
    // Tendida: no decide ni se mueve, solo espera a que la cuiden
    if (this.incap >= 0) {
      this.accion = null; this.vx = 0; this.percibidos = []; this.dormido = false;
      return;
    }
    this.acumOlvido += dt;
    if (this.acumOlvido >= 5) {
      this.mem.olvidar(this.acumOlvido);
      this.red.olvidar(AJ.olvidoRed * this.acumOlvido);
      this.relajarRasgos(this.acumOlvido);
      this.acumOlvido = 0;
    }
    this.percibidos = percibir(this, env);
    this.notarApariciones(env);
    this.mirarAOtros(env);
    if (this.celos) this.sentirCelos(env, dt);
    if (this.envidia) this.sentirEnvidia(env, dt);
    this.observar(env, dt);
    this.resolverTrazas(env);
    if (this.espera > 0) this.espera -= dt;
    if (!this.accion) {
      if (this.espera <= 0) this.decidir(env);
    } else if (this.forzar || env.t >= this.proxDecision) {
      this.decidir(env);
    }
    if (this.accion) ejecutar(this, env, dt);
    else this.vx = 0;
  }

  /** Para meter una criatura ya vivida en una sala nueva cuyo reloj empieza en 0: lo que depende del reloj anterior (a quien miraba, lo que esperaba, lo reciente) se borra. Lo aprendido se queda. */
  reiniciarReloj(): void {
    this.atencion = null;
    this.ultimoImpacto = null;
    this.trazas = [];
    this.habito = {};
    this.expuesto = {};
    this.ayuda = null;
    this.ultimoDano = -99;
    this.ultimoContagio = -99;
    this.ultimoComer = null;
    this.vistoComer = -1;
    this.proxDecision = 0;
    this.espera = 0;
    this.acumOlvido = 0;
  }

  /** Raza simple: la regla fija. Pega a la criatura mas cercana que ve (hostil) o se acerca a ella y se queda a su lado (amistosa). No mira necesidades, emociones ni recuerdos. */
  private decidirPorRutina(env: Entorno): void {
    this.forzar = false;
    this.proxDecision = env.t + AJ.reconsiderar;
    const cercana = this.percibidos.filter((p) => p.esCriatura && !p.recordado).sort((a, b) => a.dist - b.dist)[0];
    let cand: Cand;
    if (!cercana) cand = { v: "descansar", p: null, dest: this.x, u: 1, cambia: true, espera: resCero() };
    else if (this.rutina === "hostil") cand = { v: "empujar", p: cercana, dest: cercana.x, u: 1, cambia: true, espera: resCero() };
    else if (cercana.dist > 140) cand = { v: "acercarse", p: cercana, dest: cercana.x, u: 1, cambia: true, espera: resCero() };
    else cand = { v: "descansar", p: null, dest: this.x, u: 1, cambia: true, espera: resCero() };
    const act = this.accion;
    if (act && act.v === cand.v && (cand.p ? act.obj === cand.p.id : act.obj === -1)) return;
    this.accion = iniciar(this, cand, env);
  }

  private decidir(env: Entorno): void {
    if (this.rutina) { this.decidirPorRutina(env); return; }
    const cands = candidatas(this, this.percibidos, env);
    // Solo en el laboratorio: una fase de exploracion en la que se fuerza probar un verbo (para tener muestras de cada opcion)
    const c = (this.verboForzado && cands.find((k) => k.v === this.verboForzado && (!k.p || k.p.esCriatura))) || elegir(this, cands);
    this.forzar = false;
    this.proxDecision = env.t + AJ.reconsiderar;
    this.ultimaDecision = cands.slice().sort((a, b) => b.u - a.u).slice(0, 4).map((k) => ({ v: k.v, tipo: k.p?.tipo ?? "", u: k.u }));
    if (!c) return;
    const act = this.accion;
    const igual = act && act.v === c.v && (c.p ? act.obj === c.p.id : act.obj === -1);
    if (igual) return;
    if (act && !c.cambia) return;
    this.accion = iniciar(this, c, env);
  }

  /* ---------- Cuerpo ---------- */

  private necesidades(env: Entorno, dt: number): void {
    const g = this.genoma;
    const n = this.nec;
    const dur = this.dormido;
    // El impulso reproductivo sube en una adulta que no gesta, y la aversion aprendida se va olvidando muy despacio
    if (this.reproduccion) {
      if (this.edad >= DIA * 0.5 && !this.gestando) this.impulso = acota(this.impulso + AJ.impulsoTasa * dt);
      const olv = Math.exp(-dt / (DIA * 3));
      this.aversionSexo[0] *= olv; this.aversionSexo[1] *= olv;
      for (const k of Object.keys(this.aversionInd)) this.aversionInd[+k] *= olv;
    }
    n[N.hambre] = acota(n[N.hambre] + AJ.hambre * g.metabolismo * (dur ? 0.5 : 1) * dt);
    n[N.sueno] = acota(n[N.sueno] + (dur ? AJ.suenoDormido : AJ.sueno) * dt);
    n[N.aburrimiento] = acota(n[N.aburrimiento] + AJ.aburrimiento * (dur ? 0.1 : 1) * dt);
    if (!this.inconsolable) n[N.dolor] = acota(n[N.dolor] - AJ.dolorCae * dt);
    // Soledad: solo cuenta si hay otras criaturas, y sube mas en quien se apega
    const otros = env.criaturas.filter((o) => o !== this && o.vivo);
    if (otros.length) {
      const cerca = otros.some((o) => Math.abs(o.x - this.x) < 160);
      if (cerca) n[N.soledad] = acota(n[N.soledad] - 0.012 * dt);
      else n[N.soledad] = acota(n[N.soledad] + AJ.soledad * (0.5 + this.rasgos[R.apego] + this.rasgos[R.sociabilidad] * 0.5) * dt);
    } else n[N.soledad] = 0;
    if (n[N.hambre] > 0.95) this.salud -= AJ.saludHambre * dt;
    else if (n[N.dolor] < 0.2) this.salud += AJ.saludCura * dt;
    const causa = n[N.hambre] > 0.9 ? "de hambre" : "por el daño que sufrió";
    this.salud = acota(this.salud, this.mortalidad === "protegida" ? 0.08 : this.incap >= 0 ? 0.01 : 0, 1);
    if (this.salud <= 0) {
      if (this.mortalidad === "recuperable" && this.incap < 0) {
        this.incap = env.t;
        this.salud = 0.02;
        this.accion = null;
        this.dormido = false;
        this.mem.anotar(env.t, "tendida", "Cayó al suelo sin fuerzas.", -0.9);
      } else this.morir(env, causa);
    }
    // Tendida demasiado tiempo sin que nadie la cuide
    if (this.incap >= 0 && env.t - this.incap > TIEMPO_TENDIDA) this.morir(env, `${causa}, sin que nadie la cuidara`);
  }

  private morir(env: Entorno, causa: string): void {
    if (!this.vivo) return;
    this.vivo = false;
    this.accion = null;
    this.incap = -1;
    this.causa = causa;
    this.mem.anotar(env.t, "muerte", `Murió ${causa}.`, -1);
    // Con la agresion activada, el cuerpo queda donde cae y se puede comer
    if (this.agresion) env.mundo.agregar("cadaver", this.x, { porciones: 6 });
  }

  /** Se la reanima con cuidados: vuelve a ponerse en pie con algo de fuerzas. Devuelve si estaba tendida. */
  reanimar(env: Entorno): boolean {
    if (!this.vivo || this.incap < 0) return false;
    this.incap = -1;
    this.salud = 0.35;
    this.nec[N.dolor] = 0;
    this.nec[N.hambre] = Math.min(this.nec[N.hambre], 0.75);
    this.emo[E.excitacion] = acota(this.emo[E.excitacion] + 0.5);
    this.mem.anotar(env.t, "reanimada", "Se recuperó gracias a los cuidados.", 0.8);
    return true;
  }

  private emociones(dt: number): void {
    const e = this.emo;
    if (!this.inconsolable) e[E.miedo] *= Math.exp(-dt / 12);
    // Tras una pelea la frustracion baja mas deprisa cuanto mas cansada esta; la fatiga tarda mas en irse si esta herida o asustada y si es agresiva
    e[E.frustracion] *= Math.exp(-dt / (this.fatiga > 0.4 ? 12 : 30));
    if (this.fatiga > 0) {
      const tau = AJ.tauFatiga * (1 + 1.5 * (1 - this.salud) + 0.5 * e[E.miedo]) * (1 + 0.5 * this.rasgos[R.agresividad]) * (1 + 0.8 * this.rasgos[R.miedo]);
      this.fatiga *= Math.exp(-dt / tau);
      if (this.fatiga < 0.003) this.fatiga = 0;
    }
    e[E.excitacion] *= Math.exp(-dt / 8);
    const alvo = acota(this.rasgos[R.curiosidad] * 0.6 + this.nec[N.aburrimiento] * 0.3 - e[E.miedo] * 0.5);
    e[E.curiosidad] += (alvo - e[E.curiosidad]) * (1 - Math.exp(-dt / 20));
    const apegado = this.mem.vinculos.reduce((a, v) => Math.max(a, v.afecto), 0);
    e[E.apego] += (apegado * this.rasgos[R.apego] * 1.5 - e[E.apego]) * (1 - Math.exp(-dt / 30));
  }

  /** Los rasgos vividos vuelven despacio hacia la predisposicion con la que nacio. */
  private relajarRasgos(dt: number): void {
    const k = 1 - Math.exp(-dt / (DIA * 4));
    for (let i = 0; i < this.rasgos.length; i++) this.rasgos[i] += (this.base[i] - this.rasgos[i]) * k;
  }

  desarrollar(i: number, delta: number): void {
    if (this.rutina) return;
    const lim = AJ.desarrolloMax;
    this.rasgos[i] = acota(this.rasgos[i] + delta, Math.max(0, this.base[i] - lim), Math.min(1, this.base[i] + lim));
  }

  /* ---------- Observar lo que hay alrededor ---------- */

  private observar(env: Entorno, dt: number): void {
    const m = this.mem;
    m.total += dt;
    for (const p of this.percibidos) {
      if (p.recordado) continue;
      if (!p.esCriatura) m.ver(p.id, p.tipo, p.nombre, p.f, p.x, env.t);
      if (p.m[0] > 0 && !p.esCriatura) {
        if (!(`visto:${p.tipo}` in m.acciones)) {
          m.acciones[`visto:${p.tipo}`] = 1;
          const a = articulo(p.tipo, p.nombre);
          m.anotar(env.t, `vio:${p.tipo}`, `Vio por primera vez ${a.un} ${a.nombre}.`, 0.1);
          this.emo[E.curiosidad] = acota(this.emo[E.curiosidad] + 0.25);
        }
      }
      if (p.dist < 90) m.cerca[p.tipo] = (m.cerca[p.tipo] ?? 0) + dt;
      // Estar cerca de algo y que no pase nada va quitando el miedo que se le tenga
      if (!p.esCriatura && p.dist < 60 && env.t - this.ultimoDano > 4 && env.t - (this.expuesto[p.id] ?? -99) > 3) {
        this.expuesto[p.id] = env.t;
        const ant = m.predecir("presencia", p.f, p.m, 0);
        if (ant.conf > 0.1) m.aprender("presencia", p.f, 0, [0, 0, 0, 0, 0], p.tipo, p.nombre, env.t, [false, true, false, false, true], 0.05);
      }
      if (p.esCriatura && p.dist < 130) this.convivir(p, dt);
    }
    // Si llega donde recordaba algo y no esta, lo olvida
    for (const a of [...m.avist]) {
      if (Math.abs(a.x - this.x) < 70 && !this.percibidos.some((p) => p.id === a.id && !p.recordado)) m.olvidarAvistamiento(a.id);
      else if (env.t - a.t > 1500) m.olvidarAvistamiento(a.id);
    }
    // Lugares visitados
    const bin = Math.min(15, Math.floor((this.x / env.mundo.ancho) * 16));
    m.visitas[bin] += dt * 0.1;
  }

  private convivir(p: Percepto, dt: number): void {
    const v = this.mem.vinculo(p.id, this.nombreDe(p.id));
    v.tiempo += dt;
    const factor = this.agravioDe(p.id) * (this.gustos ? Math.max(0, 1 + 0.8 * gustoDe(this, p)) : 1);
    if (this.reconocePorRasgos) {
      const s = firmaDe(p.f);
      if (!v.firma) v.firma = s;
      else for (let i = 0; i < s.length; i++) v.firma[i] += (s[i] - v.firma[i]) * Math.min(1, 0.05 * dt);
    }
    v.afecto = acota(v.afecto + 0.0007 * dt * (0.4 + this.rasgos[R.sociabilidad] + this.rasgos[R.apego]) * (1 - v.afecto) * factor);
  }

  /** Cuanto sigue pesando el dano intercambiado con esa criatura: 1 si nada, hacia 0 si hace poco que se golpearon. Sirve como factor de afecto. */
  private agravioDe(id: number): number {
    const a = this.agravios[id];
    if (!a) return 1;
    return Math.max(0, 1 - 2 * a.n * Math.exp(-(this.t - a.t) / AJ.olvidoAgravio));
  }

  /** Anota que ha habido dano entre las dos (lo hizo o lo recibio), y enfria el afecto que hubiera. */
  /** Una experiencia buena (+) o mala (-) con esa criatura le cambia los gustos por los rasgos de aspecto que tiene, y asi por cualquiera que los tenga. */
  valorarAspecto(id: number, v: number): void {
    if (!this.gustos) return;
    const p = this.percibidos.find((q) => q.id === id);
    if (!p) return;
    const k = contrasteAspecto(p.f);
    for (let i = 0; i < k.length; i++) this.valencias[i] = acota(this.valencias[i] + AJ.pasoGusto * v * k[i], -1, 1);
  }

  anotarAgravio(id: number, nivel: number): void {
    this.valorarAspecto(id, -2 * nivel);
    const a = this.agravios[id];
    const previo = a ? a.n * Math.exp(-(this.t - a.t) / AJ.olvidoAgravio) : 0;
    this.agravios[id] = { n: Math.min(1, previo + nivel), t: this.t };
    const v = this.mem.vinculos.find((q) => q.id === id);
    if (v) v.afecto = acota(v.afecto * (1 - 0.35 * nivel));
  }

  nombreDe(idPercepto: number): string {
    const p = this.percibidos.find((q) => q.id === idPercepto);
    return p ? p.nombre : `la criatura ${idPercepto - 1000}`;
  }

  /* ---------- Entrada de la red ---------- */

  entrada(f: number[], v: Verbo, x: number, ancho: number): number[] {
    // Las entradas de siempre son las NI primeras; las ampliables van detras y valen cero mientras nadie las use
    const out = new Array<number>(this.red.nIn).fill(0);
    for (let i = 0; i < D; i++) out[i] = f[i];
    out[D + VERBOS.indexOf(v)] = 1;
    let o = D + VERBOS.length;
    for (let i = 0; i < 5; i++) out[o++] = this.nec[i] * 0.6;
    for (let i = 0; i < 5; i++) out[o++] = this.emo[i] * 0.6;
    out[o] = x / ancho;
    return out;
  }

  /** De 0 a 1: cuanto cansa ya repetir esto, segun lo reciente y seguido que haya sido. */
  cansancioDe(id: number): number {
    const h = this.habito[id];
    if (!h) return 0;
    return Math.min(1, h.n * AJ.habituacionPaso * Math.exp(-(this.t - h.t) / AJ.habituacionTau));
  }

  get lr(): number {
    return AJ.lrRed * this.genoma.plasticidad;
  }

  /* ---------- Aprender de lo que pasa ---------- */

  /** Se llama cuando una accion sobre algo ya tuvo su efecto (el mordisco, el empujon, el toque). */
  experimentar(acc: Accion, res: Res, efecto: boolean, env: Entorno): void {
    // Una raza simple no aprende de lo que le pasa: solo queda el registro de lo que hizo
    if (this.rutina) { this.registrar({ t: env.t, kind: "impacto", v: acc.v, tipo: acc.tipo, obj: acc.obj, res: res.slice() }); return; }
    const m = this.mem;
    // Pasarlo bien con alguien cerca cuenta tambien como compania
    if (res[C.diversion] > 0.1 && env.criaturas.some((o) => o !== this && o.vivo && Math.abs(o.x - this.x) < 300)) res[C.compania] = Math.max(res[C.compania], 0.25);
    const ancho = env.mundo.ancho;
    const lug = this.x / ancho;
    const entrada = this.entrada(acc.f, acc.v, this.x, ancho);
    const inmediatos = acc.v === "probar" ? undefined : CANALES_SIN_SACIA;
    m.aprender(acc.v, acc.f, lug, res, acc.tipo, acc.nombre, env.t, inmediatos);
    this.red.avanzar(entrada);
    this.red.entrenar(entrada, res, this.lr, inmediatos);
    m.contar(`${acc.v}:${acc.tipo}`);
    if (acc.v === "probar" && !acc.esCriatura && res[C.sacia] > 0.1) this.ultimoComer = { t: env.t, f: acc.f.slice(), tipo: acc.tipo, nombre: acc.nombre, x: this.x };
    // Repetir lo mismo cansa, haya salido algo o no (una palanca en pausa no sorprende mas que una que funciona)
    if ((acc.v === "empujar" || acc.v === "tocar") && acc.obj >= 0 && !acc.esCriatura) {
      const h = this.habito[acc.obj];
      this.habito[acc.obj] = { n: (h ? h.n * Math.exp(-(env.t - h.t) / AJ.habituacionTau) : 0) + 1, t: env.t };
    }
    if (acc.obj >= 0 && !acc.esCriatura && (acc.v === "empujar" || acc.v === "tocar")) this.ultimoImpacto = { obj: acc.obj, v: acc.v, t: env.t, quien: this.id };
    this.registrar({ t: env.t, kind: "impacto", v: acc.v, tipo: acc.tipo, obj: acc.obj, res: res.slice() });

    const gus = res[C.sacia] + res[C.diversion] + res[C.compania];
    // Lo que esperaba frente a lo que paso
    const esperado = acc.espera[C.sacia] * this.nec[N.hambre] + acc.espera[C.diversion];
    const clave = `${acc.v}:${acc.tipo}`;
    if (gus < 0.08 && res[C.dano] < 0.05) {
      this.fallos[clave] = (this.fallos[clave] ?? 0) + 1;
      // Pegar a otra criatura sin recibir nada en el momento no cuenta como un fracaso que frustre: si no, cada golpe alimentaria el siguiente sin limite
      if (esperado > 0.25 && !(acc.esCriatura && acc.v === "empujar")) this.emo[E.frustracion] = acota(this.emo[E.frustracion] + 0.18);
    } else {
      if ((this.fallos[clave] ?? 0) >= 2) this.desarrollar(R.persistencia, 0.03);
      this.fallos[clave] = 0;
    }

    if (res[C.sacia] > 0) {
      this.nec[N.hambre] = acota(this.nec[N.hambre] - res[C.sacia]);
      this.emo[E.excitacion] = acota(this.emo[E.excitacion] + res[C.sacia] * 0.6);
      this.reforzarCausas(res[C.sacia], acc);
    }
    if (res[C.diversion] > 0) {
      this.nec[N.aburrimiento] = acota(this.nec[N.aburrimiento] - res[C.diversion] * 0.12);
      this.emo[E.excitacion] = acota(this.emo[E.excitacion] + res[C.diversion] * 0.7);
      const nuevo = this.mem.acciones[clave] === 1;
      if (nuevo && res[C.diversion] > 0.15) this.desarrollar(R.curiosidad, 0.05);
    }
    if (res[C.dano] > 0) this.sufrir(res[C.dano], acc.obj, acc, res[C.susto]);
    if (res[C.compania] > 0) {
      this.nec[N.soledad] = acota(this.nec[N.soledad] - res[C.compania] * 0.5);
      this.desarrollar(R.sociabilidad, 0.012 * res[C.compania]);
      this.emo[E.excitacion] = acota(this.emo[E.excitacion] + res[C.compania] * 0.4);
    }
    if (acc.v !== "probar" && acc.v !== "acercarse") {
      this.trazas.push({ t: env.t, v: acc.v, f: acc.f.slice(), lug, tipo: acc.tipo, nombre: acc.nombre, cred: 0, entrada, obj: acc.obj });
    }
    this.escribir(acc, res, efecto, env);
  }

  /** Percibe lo que hacen los demas: si otra criatura que ve acaba de empujar o tocar algo, se fija en ello. Le despierta curiosidad,
      y lo que le vio hacer (y el resultado que se ve) le deja un recuerdo suave de que eso entretiene. */
  private mirarAOtros(env: Entorno): void {
    for (const o of env.criaturas) {
      if (o === this || !o.vivo) continue;
      // Contagio del susto: ver a otra criatura hacerse dano inquieta un poco (mas a quien es sensible). Es una reaccion biologica, no una conducta:
      // lo que se hace con ese susto (acercarse, huir, ignorar) se aprende.
      if (env.t - o.ultimoDano < 1.5 && Math.abs(o.x - this.x) <= AJ.vista * this.genoma.vista * 1.3 && env.t - this.ultimoContagio > 3) {
        this.ultimoContagio = env.t;
        if (this.ayudaInnata) this.ayuda = { quien: o.id, t: env.t };
        this.emo[E.miedo] = acota(this.emo[E.miedo] + 0.06 + 0.1 * this.rasgos[R.sensibilidad]);
        // Un sobresalto ajeno despierta la necesidad de compania (mas en quien se apega): es una necesidad, no una orden de acercarse a nadie
        if (this.estadosAjenos) {
          const cercania = this.mem.vinculos.find((q) => q.id === 1000 + o.id)?.afecto ?? 0;
          this.nec[N.soledad] = acota(this.nec[N.soledad] + (0.05 + 0.25 * this.rasgos[R.apego]) + 0.35 * cercania);
        }
        this.forzar = true;
      }
      // Ver comer a otra enseña que eso se come (algo menos que comerlo uno mismo)
      if (this.aprendeObservando && o.ultimoComer && o.ultimoComer.t > this.vistoComer && env.t - o.ultimoComer.t < 3 && Math.abs(o.x - this.x) <= AJ.vista * this.genoma.vista * 1.3) {
        const q = o.ultimoComer;
        this.vistoComer = q.t;
        this.mem.aprender("probar", q.f, q.x / env.mundo.ancho, [0.8 * AJ.pesoVicario, 0, 0, 0, 0, 0], q.tipo, q.nombre, env.t, [true, false, false, false, false, false], 1, false);
      }
      // Lo que ve hacer a otra: si pega a alguien que no es ella, queda con fama de pegar
      if (this.gustos && o.ultimoGolpe && o.ultimoGolpe.contra !== this.id && o.ultimoGolpe.t > (this.reputacion[1000 + o.id]?.t ?? -1) && env.t - o.ultimoGolpe.t < 2 && Math.abs(o.x - this.x) <= AJ.vista * this.genoma.vista * 1.3) {
        const r = (this.reputacion[1000 + o.id] ??= { agresion: 0 });
        r.agresion = Math.min(1, r.agresion + 0.4);
        r.t = o.ultimoGolpe.t;
      }
      if (!o.ultimoImpacto) continue;
      const u = o.ultimoImpacto;
      if (u.t <= (this.atencion?.t ?? -1) || env.t - u.t > 1 || env.t < u.t) continue;
      if (Math.abs(o.x - this.x) > AJ.vista * this.genoma.vista * 1.3) continue;
      const ob = env.mundo.obj(u.obj);
      if (!ob) continue;
      this.atencion = { obj: u.obj, v: u.v, t: u.t, quien: o.id };
      this.emo[E.curiosidad] = acota(this.emo[E.curiosidad] + 0.12);
      this.emo[E.excitacion] = acota(this.emo[E.excitacion] + 0.1);
      const def = CATALOGO[ob.tipo];
      this.mem.aprender(u.v, featuresObjeto(ob), ob.x / env.mundo.ancho, [0, 0, def.efecto * 0.5, 0.1, 0], ob.tipo, def.nombre, env.t, [false, false, true, true, false], 0.5, false);
      this.forzar = true;
    }
  }

  /** Si algo aparece poco despues de tocar una maquina, la accion se queda con el valor de lo que salio (lo que cree que le sentara cada cosa). */
  private notarApariciones(env: Entorno): void {
    for (const ap of env.mundo.apariciones) {
      const ob = env.mundo.obj(ap.id);
      const origen = env.mundo.obj(ap.origen);
      if (!ob || !origen || Math.abs(ob.x - this.x) > AJ.vista * this.genoma.vista) continue;
      const valor = valorDeProbar(this, featuresObjeto(ob), env);
      for (const tr of this.trazas) {
        if (tr.obj !== ap.origen || env.t - tr.t > 6) continue;
        tr.cred = Math.max(tr.cred, 0.85 * valor);
      }
      if (this.aprendeObservando) this.aprenderDeOtra(ap.origen, origen, valor, env);
    }
  }

  /** Si lo que acaba de salir de una maquina viene justo despues de que otra criatura que esta a la vista actuara sobre ella, se aprende (con menos fuerza que
      si lo hubiera hecho uno mismo) que esa accion sobre esa cosa trae algo bueno. */
  private aprenderDeOtra(idOrigen: number, origen: Objeto, valor: number, env: Entorno): void {
    for (const o of env.criaturas) {
      if (o === this || !o.vivo || !o.ultimoImpacto || o.ultimoImpacto.obj !== idOrigen) continue;
      const u = o.ultimoImpacto;
      if (env.t < u.t || env.t - u.t > 6 || Math.abs(o.x - this.x) > AJ.vista * this.genoma.vista * 1.3) continue;
      const def = CATALOGO[origen.tipo];
      this.mem.aprender(u.v, featuresObjeto(origen), origen.x / env.mundo.ancho, [0.85 * valor * AJ.pesoVicario, 0, 0, 0, 0, 0], origen.tipo, def.nombre, env.t, [true, false, false, false, false, false], 1, false);
    }
  }

  /** Cuando algo bueno ocurre, las acciones recientes reciben parte del merito (consecuencias que llegan despues). */
  private reforzarCausas(cantidad: number, propia: Accion): void {
    for (const tr of this.trazas) {
      const edad = this.t - tr.t;
      if (edad > AJ.ventanaCausal || (propia.v === tr.v && propia.tipo === tr.tipo)) continue;
      const w = Math.exp(-edad / AJ.tauCausal);
      if (w < 0.1) continue;
      tr.cred = Math.max(tr.cred, cantidad * w);
    }
  }

  private resolverTrazas(env: Entorno): void {
    if (!this.trazas.length) return;
    const resto: Traza[] = [];
    for (const tr of this.trazas) {
      if (env.t - tr.t < AJ.ventanaCausal) { resto.push(tr); continue; }
      const res = [tr.cred, 0, 0, 0, 0, 0];
      this.mem.aprender(tr.v, tr.f, tr.lug, res, tr.tipo, tr.nombre, env.t, [true, false, false, false, false], 1.3);
      this.red.entrenar(tr.entrada, res, this.lr, [true, false, false, false, false]);
      if (tr.cred > 0.12 && tr.tipo) {
        const a = articulo(tr.tipo, tr.nombre);
        const verbo = tr.v === "tocar" ? "tocar" : tr.v === "empujar" ? "empujar" : "interactuar con";
        this.mem.anotar(env.t, `causa:${tr.v}:${tr.tipo}`, `Comió poco después de ${verbo} ${a.el} ${a.nombre}.`, 0.5);
      }
    }
    this.trazas = resto;
  }

  /** Un golpe, una descarga o un mal sabor. `nivel` es la gravedad de 0 a 1. */
  /** Cuanto limita cada secuela: un factor de 0 a 1 que multiplica lo que la criatura puede hacer. Sin secuelas valen exactamente 1. */
  private factorSecuela(tipo: TipoSecuela, limite: number): number {
    let g = 0;
    for (const s of this.secuelas) if (s.tipo === tipo) g = Math.max(g, s.gravedad);
    return 1 - limite * g;
  }
  factorMovilidad(): number { return this.factorSecuela("cojera", AJ.limiteCojera); }
  factorFuerza(): number { return this.factorSecuela("debilidad", AJ.limiteDebilidad); }
  factorVista(): number { return this.factorSecuela("vista", AJ.limiteSentido); }
  factorOido(): number { return this.factorSecuela("oido", AJ.limiteSentido); }

  /** Cuenta el dano recibido y, cuando pasa el umbral, deja una secuela (una por tipo, hasta el maximo). Solo si se permiten. */
  private acumularSecuela(nivel: number, causa: number): void {
    this.danoAcumulado += nivel;
    if (this.secuelas.length >= AJ.maxSecuelas || this.danoAcumulado < AJ.umbralSecuela * (1 + this.secuelas.length)) return;
    const libres = (["cojera", "debilidad", "vista", "oido"] as TipoSecuela[]).filter((t) => !this.secuelas.some((s) => s.tipo === t));
    const tipo = libres[Math.floor(this.azar.next() * libres.length)];
    const quien = causa >= 1000 ? this.nombreDeId(causa - 1000) : "algo";
    const dia = Math.floor(this.edad / DIA) + 1;
    const gravedad = acota(0.35 + 0.5 * nivel + 0.1 * this.secuelas.length, 0.35, 1);
    const pct = (limite: number): number => Math.round(limite * gravedad * 100);
    let zona: string, texto: string, efecto: string;
    if (tipo === "cojera") {
      zona = this.azar.next() < 0.5 ? "pata trasera" : "pata delantera";
      texto = `Cojea de la ${zona} desde el día ${dia}, tras los golpes de ${quien}.`;
      efecto = `Se mueve un ${pct(AJ.limiteCojera)} % más despacio.`;
    } else if (tipo === "debilidad") {
      zona = "flanco";
      texto = `Le quedó el flanco marcado desde el día ${dia}, tras los golpes de ${quien}.`;
      efecto = `Pega con un ${pct(AJ.limiteDebilidad)} % menos de fuerza.`;
    } else if (tipo === "vista") {
      zona = "ojo";
      texto = `Una cicatriz le cruza el ojo desde el día ${dia}, tras los golpes de ${quien}.`;
      efecto = `Ve un ${pct(AJ.limiteSentido)} % menos lejos.`;
    } else {
      zona = "oreja";
      texto = `Tiene una oreja rota desde el día ${dia}, tras los golpes de ${quien}.`;
      efecto = `Oye un ${pct(AJ.limiteSentido)} % menos lejos.`;
    }
    this.secuelas.push({ tipo, zona, gravedad, t: this.t, causa, texto, efecto });
    this.mem.anotar(this.t, `secuela:${tipo}`, texto, -0.8);
  }

  sufrir(nivel: number, causa: number, acc: Accion | null, susto = 0): void {
    if (this.permiteSecuelas) this.acumularSecuela(nivel, causa);
    const sens = this.rasgos[R.sensibilidad];
    this.nec[N.dolor] = acota(this.nec[N.dolor] + nivel * 0.9);
    this.salud -= nivel * 0.08;
    this.emo[E.miedo] = acota(this.emo[E.miedo] + nivel * (0.6 + sens * 0.6));
    this.emo[E.excitacion] = 0;
    this.ultimoDano = this.t;
    this.forzar = true;
    this.despertar();
    this.desarrollar(R.miedo, 0.14 * nivel * (0.5 + sens));
    this.desarrollar(R.curiosidad, -0.05 * nivel);
    this.desarrollar(R.sensibilidad, 0.004 * nivel);
    const m = this.mem;
    const lug = this.x / AJ.ancho;
    m.aprender("lugar", [], lug, [0, nivel, 0, 0, 0], "", "", this.t, [false, true, false, false, false], 0.9);
    // Lo que tocaba cuenta mucho; lo muy llamativo que habia cerca (luz, ruido) cuenta algo
    const causado = this.percibidos.find((p) => p.id === causa);
    // Un golpe fuerte se aprende a la primera: queda con la firmeza de una experiencia repetida
    let marca: ReturnType<Memoria["aprender"]> | null = null;
    if (causado) marca = m.aprender("presencia", causado.f, 0, [0, nivel, 0, 0, Math.max(susto, nivel * 0.5)], causado.tipo, causado.nombre, this.t, [false, true, false, false, true], 1.1);
    else if (acc && acc.obj === causa) marca = m.aprender("presencia", acc.f, 0, [0, nivel, 0, 0, Math.max(susto, nivel * 0.5)], acc.tipo, acc.nombre, this.t, [false, true, false, false, true], 1.1);
    if (marca && nivel >= 0.3) marca.n = Math.max(marca.n, 2);
    for (const p of this.percibidos) {
      if (p.id === causa || p.esCriatura || p.recordado || p.dist > 420) continue;
      if (p.f[2] > 0.8 || p.f[6] > 0.5) m.aprender("presencia", p.f, 0, [0, nivel * 0.5, 0, 0, nivel * 0.3], p.tipo, p.nombre, this.t, [false, true, false, false, true], 0.8);
    }
    const lugarNombre = causado ?? (acc ? { tipo: acc.tipo, nombre: acc.nombre } : null);
    if (lugarNombre && lugarNombre.tipo) {
      const a = articulo(lugarNombre.tipo, lugarNombre.nombre);
      const tox = CATALOGO[lugarNombre.tipo]?.toxico ?? 0;
      m.anotar(this.t, `dano:${lugarNombre.tipo}`, tox > 0 && acc?.v === "probar" ? `Probó ${a.un} ${a.nombre} y le sentó mal.` : `Se hizo daño con ${a.el} ${a.nombre}.`, -Math.min(1, nivel + 0.2));
    } else m.anotar(this.t, "dano:lugar", "Se hizo daño en un sitio de la habitación.", -Math.min(1, nivel + 0.2));
  }

  despertar(): void {
    this.dormido = false;
    if (this.accion?.v === "dormir") this.accion = null;
  }

  /** Dano que dura mientras se esta en un sitio (una placa que descarga). Se aprende una vez por segundo para no contar cada paso. */
  sufrirContinuo(tasa: number, dt: number, causa: number): void {
    this.nec[N.dolor] = acota(this.nec[N.dolor] + tasa * dt * 2);
    this.salud -= tasa * dt * 0.2;
    this.despertar();
    if (this.t - this.ultimoDano > 1) this.sufrir(Math.min(1, tasa * 2), causa, null);
    else this.emo[E.miedo] = acota(this.emo[E.miedo] + 0.1 * dt);
  }

  private escribir(acc: Accion, res: Res, efecto: boolean, env: Entorno): void {
    const m = this.mem;
    const a = articulo(acc.tipo, acc.nombre);
    const nombre = `${a.el} ${a.nombre}`;
    const t = env.t;
    if (acc.v === "probar") {
      if (res[C.sacia] > 0.15 && res[C.dano] < 0.2) m.anotar(t, `come:${acc.tipo}`, `Comió ${a.un} ${a.nombre} y se quedó a gusto.`, 0.5 + res[C.sacia] * 0.4);
      else if (res[C.dano] < 0.2 && res[C.sacia] < 0.05) m.anotar(t, `prueba:${acc.tipo}`, `Probó ${nombre} y no le dijo nada.`, 0);
    } else if (acc.v === "empujar" || acc.v === "tocar") {
      const verbo = acc.v === "empujar" ? "Empujó" : "Tocó";
      if (res[C.diversion] > 0.15 && efecto) m.anotar(t, `juega:${acc.v}:${acc.tipo}`, `${verbo} ${nombre} y le gustó lo que pasó.`, 0.3 + res[C.diversion] * 0.4);
      else if (!efecto && (this.fallos[`${acc.v}:${acc.tipo}`] ?? 0) === 3) m.anotar(t, `nada:${acc.v}:${acc.tipo}`, `${verbo} ${nombre} varias veces y no pasó nada.`, -0.1);
    } else if (acc.v === "acercarse" && res[C.compania] > 0.12) {
      m.anotar(t, `con:${acc.obj}`, `Se quedó un rato junto a ${acc.nombre}.`, 0.3 + res[C.compania] * 0.3);
    }
  }

  registrar(r: Registro): void {
    this.registro.push(r);
    if (this.registro.length > this.capRegistro) this.registro.splice(0, this.registro.length - this.capRegistro);
  }

  /* ---------- Para el jugador ---------- */

  /** Recompensa: lo ultimo que hizo se vuelve mas atractivo. */
  recompensar(env: Entorno, nivel = 0.6): void {
    if (this.reanimar(env)) return;
    this.ligarACortejo(env, -1);
    this.ligarARechazo(env, -1);
    const ult = this.accionReciente(env);
    this.emo[E.excitacion] = acota(this.emo[E.excitacion] + 0.6);
    this.nec[N.soledad] = acota(this.nec[N.soledad] - 0.2);
    this.nec[N.aburrimiento] = acota(this.nec[N.aburrimiento] - 0.2);
    // Si lo ultimo que le paso fue recibir dano de otra criatura, el premio la liga con quien se lo hizo: puede acabar queriendo a quien la maltrata
    this.perdonarAgravio(env, nivel);
    if (!ult) return;
    const res = [0, 0, nivel, nivel * 0.5, 0];
    this.mem.aprender(ult.v, ult.f, ult.lug, res, ult.tipo, ult.nombre, env.t, [false, false, true, true, false], 1.6);
    const a = articulo(ult.tipo, ult.nombre);
    this.mem.anotar(env.t, `premio:${ult.v}:${ult.tipo}`, `Recibió una caricia justo después de ${this.verboPasado(ult.v)} ${a.el ? a.el + " " : ""}${a.nombre}.`, 0.6);
  }

  /** Un premio justo despues de recibir dano de otra criatura: el afecto por ella crece, el dano deja de impedirlo y su aspecto se asocia menos con peligro. */
  private perdonarAgravio(env: Entorno, nivel: number): void {
    let id = -1;
    let reciente = -1;
    for (const k of Object.keys(this.agravios)) {
      const a = this.agravios[+k];
      if (env.t - a.t < 6 && a.n > 0.05 && a.t > reciente) { reciente = a.t; id = +k; }
    }
    if (id < 0) return;
    const p = this.percibidos.find((q) => q.id === id);
    const v = this.mem.vinculo(id, p ? p.nombre : this.nombreDe(id));
    v.afecto = acota(v.afecto + 0.3 * nivel);
    this.valorarAspecto(id, 1.5 * nivel);
    this.agravios[id].n *= 0.4;
    if (p) {
      this.mem.aprender("acercarse", p.f, this.x / env.mundo.ancho, [0, 0, 0, nivel * 0.8, 0], "criatura", p.nombre, env.t, [false, false, false, true, false], 1.6);
      const pres = this.mem.protos.find((q) => q.v === "presencia" && semejanza(p.f, q.f, p.m) > 0.8);
      if (pres) { pres.res[C.dano] *= 0.75; pres.res[C.susto] *= 0.75; }
    }
    this.mem.anotar(env.t, `premio:maltrato:${id}`, `Recibió una caricia justo después de que ${p ? p.nombre : "otra criatura"} la golpeara.`, 0.2);
  }

  /** Cuanto celo siente ahora por ver que `idVinculo` atiende a alguien (el mayor, si son varias), descontado el miedo que le tenga a esa tercera: si la teme, el celo no la empuja a acercarse. */
  celoPorVinculo(idVinculo: number): number {
    let m = 0;
    for (const c of this.celosEstado) if (c.vinculo === idVinculo) m = Math.max(m, c.nivel * (1 - (c.temor ?? 0)));
    return m;
  }

  /** Cuanto celo siente ahora hacia `idTercero`, la que recibe la atencion. */
  celoPorTercero(idTercero: number): number {
    let m = 0;
    for (const c of this.celosEstado) if (c.tercero === idTercero) m = Math.max(m, c.nivel);
    return m;
  }

  /** El celo mas alto que siente ahora. */
  celoMaximo(): number {
    let m = 0;
    for (const c of this.celosEstado) m = Math.max(m, c.nivel);
    return m;
  }

  /** Celos: ve a alguien a quien quiere atender a otra (por la senal de atencion social, que solo cuenta lo que ella misma ve). Sube con cuanto quiere a su vinculo y
      con su apego y su soledad, sube mas si ese vinculo la atendia a ella hace poco y menos si tambien quiere a la tercera. Baja con el tiempo, mas deprisa
      si su vinculo vuelve a atenderla. No toca la frustracion ni el miedo. */
  /** Cuanto teme a esa criatura: lo mayor entre su fama de pegar (si lleva la cuenta de gustos) y el peligro que ha aprendido de su presencia. De 0 a 1. */
  temorA(idCriatura: number): number {
    // La fama va por quien es y no necesita verle los rasgos; el peligro aprendido solo si la tiene lo bastante cerca para percibirla
    const fama = this.reputacion[1000 + idCriatura]?.agresion ?? 0;
    const p = this.percibidos.find((q) => q.id === 1000 + idCriatura);
    if (!p) return acota(fama);
    const pres = this.mem.predecir("presencia", p.f, p.m, 0);
    return acota(Math.max(fama, pres.res[C.dano] * pres.conf));
  }

  private sentirCelos(env: Entorno, dt: number): void {
    const alcance = AJ.vista * this.genoma.vista * 1.3;
    const vistas: Criatura[] = [this];
    for (const o of env.criaturas) if (o !== this && o.vivo && Math.abs(o.x - this.x) <= alcance) vistas.push(o);
    this.social.actualizar(vistas, env.t);
    const afectoCon = (id: number): number => this.mem.vinculos.find((q) => q.id === 1000 + id)?.afecto ?? 0;
    const alimentadas = new Set<string>();
    for (const v of vistas) {
      if (v === this) continue;
      // Si su vinculo la atiende a ella, lo anota (y no hay motivo de celos mientras lo hace)
      const aMi = this.social.duracion(v.id, this.id, env.t) > 0;
      if (aMi) this.atendidaPor[v.id] = env.t;
      const afecto = afectoCon(v.id);
      if (afecto < AJ.umbralVinculoCelos || aMi) continue;
      for (const t of vistas) {
        if (t === this || t === v) continue;
        if (this.social.duracion(v.id, t.id, env.t) <= 0) continue;
        const clave = `${v.id}>${t.id}`;
        alimentadas.add(clave);
        let c = this.celosEstado.find((q) => q.vinculo === v.id && q.tercero === t.id);
        if (!c) { c = { vinculo: v.id, tercero: t.id, nivel: 0, pico: 0, anotado: false }; this.celosEstado.push(c); }
        const perdida = env.t - (this.atendidaPor[v.id] ?? -999) < 180 ? 1.4 : 1;
        c.temor = this.temorA(t.id);
        const tasa = AJ.tasaCelos * afecto * (0.5 + this.rasgos[R.apego]) * (1 - 0.6 * afectoCon(t.id)) * (1 - 0.8 * c.temor) * (1 + 0.6 * this.nec[N.soledad]) * perdida;
        c.nivel = acota(c.nivel + tasa * dt * (1 - c.nivel));
        c.pico = Math.max(c.pico, c.nivel);
        if (c.nivel > 0.5 && !c.anotado) {
          c.anotado = true;
          this.mem.anotar(env.t, `celos:${v.id}:${t.id}`, `Sintió celos al ver que ${this.nombreDeId(v.id)} atendía a ${this.nombreDeId(t.id)}.`, -0.5);
          this.anotarAgravio(1000 + t.id, 0.08);
        }
      }
    }
    // Se van con el tiempo, antes si su vinculo vuelve a atenderla; y desaparecen del todo cuando ya no queda
    for (const c of this.celosEstado) {
      if (alimentadas.has(`${c.vinculo}>${c.tercero}`)) continue;
      const vuelve = env.t - (this.atendidaPor[c.vinculo] ?? -999) < 3;
      c.nivel *= Math.exp(-dt / ((AJ.tauCelos * (1 + 0.5 * this.rasgos[R.apego])) / (vuelve ? 3 : 1)));
      if (c.nivel < 0.01) c.nivel = 0;
    }
    this.celosEstado = this.celosEstado.filter((c) => c.nivel > 0);
  }

  /** Cuanta envidia siente ahora por lo que come `idPoseedor`. */
  envidiaPor(idPoseedor: number): number {
    let m = 0;
    for (const e of this.envidiaEstado) if (e.poseedor === idPoseedor) m = Math.max(m, e.nivel);
    return m;
  }

  /** La envidia mas alta que siente ahora. */
  envidiaMaxima(): number {
    let m = 0;
    for (const e of this.envidiaEstado) m = Math.max(m, e.nivel);
    return m;
  }

  /** ¿Es este el sitio donde come alguien a quien envidia? Ese alimento es del otro y no cuenta como «otro alimento» para ella. */
  esAlimentoEnvidiado(x: number): boolean {
    return this.envidiaEstado.some((e) => e.nivel > 0.02 && Math.abs(e.donde - x) < 60);
  }

  /** Envidia de alimento: ve a otra criatura dar un bocado a algo que ella desea y no tiene. Desea en proporcion a su hambre y a lo que espera que le quite el hambre
      (lo que sabe de ese alimento). Sube con cada bocado visto, menos si quiere a quien come o le teme, y nada si ya tiene acceso (acaba de comer o ve otro alimento).
      Baja con el tiempo, antes si ya no ve comer, si come ella o si deja de tener hambre. No toca la frustracion ni el miedo, y solo percibe lo que ve. */
  private sentirEnvidia(env: Entorno, dt: number): void {
    const alcance = AJ.vista * this.genoma.vista * 1.3;
    const hambre = this.nec[N.hambre];
    const deseoHambre = Math.max(0, (hambre - AJ.umbralHambreEnvidia) / (1 - AJ.umbralHambreEnvidia));
    const comioYo = env.t - (this.ultimoComer?.t ?? -999) < AJ.ventanaAccesoPropio;
    const afectoCon = (id: number): number => this.mem.vinculos.find((q) => q.id === 1000 + id)?.afecto ?? 0;
    const visibles = new Set<number>();
    for (const o of env.criaturas) {
      if (o === this || !o.vivo || Math.abs(o.x - this.x) > alcance) continue;
      visibles.add(o.id);
      const q = o.ultimoComer;
      if (!q || env.t - q.t > 3 || q.t <= (this.vistoBocado[o.id] ?? -1)) continue;
      this.vistoBocado[o.id] = q.t;
      let e = this.envidiaEstado.find((k) => k.poseedor === o.id);
      if (e) { e.visto = env.t; e.donde = q.x; }
      // Acceso propio: acaba de comer, o ve otro alimento que no es el que come el otro (cuanto mas cerca, mas acceso: con la comida al lado no hay nada que envidiar)
      let acceso = comioYo ? 1 : 0;
      if (!comioYo) for (const p of this.percibidos) if (!p.esCriatura && !p.recordado && (CATALOGO[p.tipo]?.porciones ?? 0) > 0 && p.dist < 250 && Math.abs(p.x - q.x) > 80) acceso = Math.max(acceso, 1 - p.dist / 250);
      if (deseoHambre <= 0 || acceso >= 1) continue;
      const deseo = deseoHambre * Math.min(1, Math.max(0, valorDeProbar(this, q.f, env)) * 2);
      const temor = this.reputacion[1000 + o.id]?.agresion ?? 0;
      const base = AJ.tasaEnvidia * deseo * (1 - 0.6 * afectoCon(o.id)) * (1 - acceso) * (1 - 0.8 * temor);
      if (base <= 0) continue;
      if (!e) { e = { poseedor: o.id, recurso: q.tipo, nivel: 0, pico: 0, anotado: false, donde: q.x, visto: env.t }; this.envidiaEstado.push(e); }
      e.nivel = acota(e.nivel + base * (1 - e.nivel));
      e.pico = Math.max(e.pico, e.nivel);
      if (e.nivel > 0.5 && !e.anotado) {
        e.anotado = true;
        this.mem.anotar(env.t, `envidia:${o.id}`, `Sintió envidia al ver comer a ${this.nombreDeId(o.id)}.`, -0.4);
        this.anotarAgravio(1000 + o.id, 0.05);
      }
    }
    // Se va con el tiempo, antes si ya no ve comer (se acabo o se fue), si come ella o si ya no tiene hambre
    for (const e of this.envidiaEstado) {
      let tau = AJ.tauEnvidia;
      if (env.t - e.visto > 8 || !visibles.has(e.poseedor)) tau /= 2;
      if (comioYo) tau /= 4;
      if (deseoHambre <= 0) tau /= 3;
      e.nivel *= Math.exp(-dt / tau);
      if (e.nivel < 0.01) e.nivel = 0;
    }
    this.envidiaEstado = this.envidiaEstado.filter((e) => e.nivel > 0);
  }

  private nombreDeId(id: number): string {
    return this.percibidos.find((q) => q.id === 1000 + id)?.nombre ?? `la criatura ${id}`;
  }

  /** Evalua un cortejo: acepta si es adulta, no gesta, tiene impulso, es de otro sexo y le apetece lo bastante. Lo que le apetece sale del afecto, de su gusto por el
      aspecto y la conducta, de su propio impulso y de la aversion que tenga (por castigos anteriores) a ese sexo o a ese individuo. `intensidad` es cuanto rechaza. */
  evaluarCortejo(pretendiente: Criatura): { acepta: boolean; intensidad: number } {
    const p = this.percibidos.find((q) => q.id === 1000 + pretendiente.id);
    const afecto = p ? afectoDe(this, p) : (this.mem.vinculos.find((q) => q.id === 1000 + pretendiente.id)?.afecto ?? 0);
    const gusto = p ? gustoDe(this, p) : 0;
    const sx = sexoDe(pretendiente.genoma);
    const aversion = Math.max(this.aversionSexo[sx], this.aversionInd[1000 + pretendiente.id] ?? 0);
    // La aversion aprendida multiplica el deseo en vez de restarle: un castigo repetido puede pesar mas que el cariño
    const deseo = Math.max(0, 0.1 + AJ.pesoAfectoDeseo * afecto + AJ.pesoGustoDeseo * gusto + 0.3 * this.impulso) * (1 - AJ.pesoAversionDeseo * aversion);
    const posible = this.reproduccion && this.vivo && this.incap < 0 && !this.gestando && this.edad >= DIA * 0.5 && sexoDe(this.genoma) !== sx && this.impulso > 0.25;
    const acepta = posible && deseo > AJ.umbralAceptacion;
    return { acepta, intensidad: acepta ? 0 : acota(aversion + Math.max(0, AJ.umbralAceptacion - deseo) + (posible ? 0 : 0.1)) };
  }

  /** Como reacciona a un rechazo, al azar pero segun su caracter y lo aprendido: 0 enfado, 1 miedo, 2 indiferencia, 3 alegria. `rol` 0 si la rechazan y 1 si rechaza.
      Rechazada: el enfado crece con su agresividad, el miedo con su miedo y con la aversion que ha aprendido, la indiferencia con el poco apego y la alegria es rara.
      La que rechaza puede sentir alivio o alegria si le tiene aversion. */
  reaccionAlRechazo(rol: 0 | 1, intensidad: number): number {
    const r = this.rasgos;
    const aversion = Math.max(this.aversionSexo[0], this.aversionSexo[1]);
    const base = [
      0.15 + 1.4 * Math.max(0, r[R.agresividad] - 0.3) + 0.6 * this.emo[E.frustracion],
      0.15 + 1.0 * r[R.miedo] * (rol === 0 ? 1 : 0.5) + 0.5 * aversion,
      0.25 + 0.8 * (1 - r[R.apego]),
      rol === 1 ? 0.1 + 0.9 * aversion + 0.4 * intensidad : 0.08,
    ];
    const w = base.map((b, i) => b * Math.exp(this.ajusteReaccion[rol][i]));
    let u = this.azar.next() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) { u -= w[i]; if (u <= 0) return i; }
    return 2;
  }

  /** Un premio o un susto justo despues de reaccionar a un rechazo cambia lo probable que es esa reaccion. El susto, ademas, asusta. */
  private ligarARechazo(env: Entorno, signo: 1 | -1): void {
    const u = this.ultimoRechazo;
    if (!this.reproduccion || !u || env.t - u.t > 8) return;
    const a = this.ajusteReaccion[u.rol];
    a[u.reaccion] = Math.max(-2, Math.min(2, a[u.reaccion] - signo * AJ.pasoReaccion));
    if (signo > 0 && u.reaccion !== 1) a[1] = Math.min(2, a[1] + 0.5 * AJ.pasoReaccion);
  }

  /** Si lo ultimo en que participo fue un cortejo, un castigo o un premio se liga a ese sexo y a ese individuo. */
  private ligarACortejo(env: Entorno, signo: 1 | -1): void {
    if (!this.reproduccion || !this.ultimoCortejo || env.t - this.ultimoCortejo.t > 8) return;
    const o = env.criaturas.find((q) => q.id === this.ultimoCortejo?.con);
    if (!o) return;
    const sx = sexoDe(o.genoma);
    this.aversionSexo[sx] = acota(this.aversionSexo[sx] + signo * AJ.pasoAversionSexo);
    this.aversionInd[1000 + o.id] = acota((this.aversionInd[1000 + o.id] ?? 0) + signo * AJ.pasoAversionInd);
    this.mem.anotar(env.t, `cortejo:${signo}:${o.id}`, signo > 0 ? `Se asustó justo después de un acercamiento reproductivo con ${o.nombre}.` : `Recibió una caricia justo después de un acercamiento reproductivo con ${o.nombre}.`, signo > 0 ? -0.5 : 0.4);
  }

  /** Susto: el jugador la asusta. */
  asustar(env: Entorno): void {
    this.ligarACortejo(env, 1);
    this.ligarARechazo(env, 1);
    const ult = this.accionReciente(env);
    this.emo[E.miedo] = acota(this.emo[E.miedo] + 0.8);
    this.forzar = true;
    this.despertar();
    this.desarrollar(R.miedo, 0.02);
    if (ult) {
      const res = [0, 0.25, 0, 0, 0.7];
      this.mem.aprender(ult.v, ult.f, ult.lug, res, ult.tipo, ult.nombre, env.t, [false, true, false, false, true], 1.6);
      const a = articulo(ult.tipo, ult.nombre);
      this.mem.anotar(env.t, `susto:${ult.v}:${ult.tipo}`, `Se llevó un susto justo después de ${this.verboPasado(ult.v)} ${a.el ? a.el + " " : ""}${a.nombre}.`, -0.6);
    } else this.mem.anotar(env.t, "susto:aire", "Se llevó un susto sin saber de dónde.", -0.4);
  }

  private verboPasado(v: Verbo): string {
    return v === "probar" ? "probar" : v === "empujar" ? "empujar" : v === "tocar" ? "tocar" : v === "acercarse" ? "acercarse a" : "estar junto a";
  }

  private accionReciente(env: Entorno): { v: Verbo; f: number[]; lug: number; tipo: string; nombre: string } | null {
    for (let i = this.registro.length - 1; i >= 0; i--) {
      const r = this.registro[i];
      if (env.t - r.t > 6) break;
      if (r.kind !== "impacto") continue;
      const tr = [...this.trazas].reverse().find((q) => q.v === r.v && q.tipo === r.tipo);
      const av = this.mem.avist.find((q) => q.id === r.obj);
      const f = tr?.f ?? av?.f ?? this.percibidos.find((p) => p.id === r.obj)?.f;
      if (f) return { v: r.v, f, lug: this.x / env.mundo.ancho, tipo: r.tipo, nombre: tr?.nombre ?? av?.nombre ?? r.tipo };
    }
    return null;
  }

  /* ---------- Guardado ---------- */

  estado(): EstadoCriatura {
    return JSON.parse(
      JSON.stringify({
        id: this.id, nombre: this.nombre, genoma: this.genoma, huella: this.huella, azar: this.azar.s, x: this.x, dir: this.dir, nec: this.nec, salud: this.salud,
        emo: this.emo, rasgos: this.rasgos, mem: this.mem.estado(), red: this.red.estado(), accion: this.accion, trazas: this.trazas, edad: this.edad,
        dormido: this.dormido, fallos: this.fallos, ultimoDano: this.ultimoDano, vivo: this.vivo, incap: this.incap, causa: this.causa, mortalidad: this.mortalidad, padres: this.padres, generacion: this.generacion,
        espera: this.espera, proxDecision: this.proxDecision, forzar: this.forzar, acumOlvido: this.acumOlvido, expuesto: this.expuesto, atencion: this.atencion, ultimoImpacto: this.ultimoImpacto, ultimoContagio: this.ultimoContagio, ayudaInnata: this.ayudaInnata, estadosAjenos: this.estadosAjenos, reconocePorRasgos: this.reconocePorRasgos, aprendeObservando: this.aprendeObservando, agresion: this.agresion, celos: this.celos, celosEstado: this.celosEstado, rutina: this.rutina, permiteSecuelas: this.permiteSecuelas, secuelas: this.secuelas, danoAcumulado: this.danoAcumulado, envidia: this.envidia, envidiaEstado: this.envidiaEstado, vistoBocado: this.vistoBocado, atendidaPor: this.atendidaPor, fatiga: this.fatiga, reproduccion: this.reproduccion, impulso: this.impulso, gestando: this.gestando, aversionSexo: this.aversionSexo, aversionInd: this.aversionInd, ultimoCortejo: this.ultimoCortejo, ajusteReaccion: this.ajusteReaccion, ultimoRechazo: this.ultimoRechazo, gustos: this.gustos, valencias: this.valencias, reputacion: this.reputacion, ultimoGolpe: this.ultimoGolpe, conflictoComida: this.conflictoComida, represalia: this.represalia, agravios: this.agravios, ultimoComer: this.ultimoComer, vistoComer: this.vistoComer, atrapada: this.atrapada, inconsolable: this.inconsolable, habito: this.habito, ayuda: this.ayuda,
      }),
    ) as EstadoCriatura;
  }

  static desde(e: EstadoCriatura, semilla: number): Criatura {
    const c = new Criatura(e.id, e.nombre, e.genoma, e.x, semilla);
    c.huella = e.huella;
    c.azar.s = e.azar;
    c.dir = e.dir;
    c.nec = e.nec.slice();
    c.salud = e.salud;
    c.emo = e.emo.slice();
    c.rasgos = e.rasgos.slice();
    c.mem.restaurar(e.mem);
    c.red = Red.desde(e.red, AJ.entradasExtra);
    c.accion = e.accion ? JSON.parse(JSON.stringify(e.accion)) : null;
    c.trazas = JSON.parse(JSON.stringify(e.trazas));
    c.edad = e.edad;
    c.dormido = e.dormido;
    c.fallos = { ...e.fallos };
    c.ultimoDano = e.ultimoDano;
    c.vivo = e.vivo;
    c.incap = e.incap ?? -1;
    c.causa = e.causa ?? "";
    c.mortalidad = e.mortalidad ?? "protegida";
    c.padres = e.padres ? e.padres.slice() : [];
    c.generacion = e.generacion ?? 0;
    c.espera = e.espera;
    c.proxDecision = e.proxDecision;
    c.forzar = e.forzar;
    c.acumOlvido = e.acumOlvido;
    c.expuesto = { ...e.expuesto };
    c.atencion = e.atencion ? { ...e.atencion } : null;
    c.ultimoImpacto = e.ultimoImpacto ? { ...e.ultimoImpacto } : null;
    c.ultimoContagio = e.ultimoContagio ?? -99;
    c.ayudaInnata = e.ayudaInnata ?? true;
    c.estadosAjenos = e.estadosAjenos ?? false;
    c.reconocePorRasgos = e.reconocePorRasgos ?? false;
    c.aprendeObservando = e.aprendeObservando ?? false;
    c.agresion = e.agresion ?? false;
    c.celos = e.celos ?? false;
    c.rutina = e.rutina ?? null;
    c.permiteSecuelas = e.permiteSecuelas ?? false;
    c.secuelas = JSON.parse(JSON.stringify(e.secuelas ?? []));
    c.danoAcumulado = e.danoAcumulado ?? 0;
    c.celosEstado = JSON.parse(JSON.stringify(e.celosEstado ?? []));
    c.envidia = e.envidia ?? false;
    c.envidiaEstado = JSON.parse(JSON.stringify(e.envidiaEstado ?? []));
    c.vistoBocado = { ...(e.vistoBocado ?? {}) };
    c.atendidaPor = JSON.parse(JSON.stringify(e.atendidaPor ?? {}));
    c.fatiga = e.fatiga ?? 0;
    c.reproduccion = e.reproduccion ?? false;
    c.impulso = e.impulso ?? 0;
    c.gestando = e.gestando ?? false;
    c.aversionSexo = (e.aversionSexo ?? [0, 0]).slice();
    c.aversionInd = JSON.parse(JSON.stringify(e.aversionInd ?? {}));
    c.ultimoCortejo = e.ultimoCortejo ? { ...e.ultimoCortejo } : null;
    c.ajusteReaccion = JSON.parse(JSON.stringify(e.ajusteReaccion ?? [[0, 0, 0, 0], [0, 0, 0, 0]]));
    c.ultimoRechazo = e.ultimoRechazo ? { ...e.ultimoRechazo } : null;
    c.gustos = e.gustos ?? false;
    c.valencias = (e.valencias ?? [0, 0, 0, 0]).slice();
    c.reputacion = JSON.parse(JSON.stringify(e.reputacion ?? {}));
    c.ultimoGolpe = e.ultimoGolpe ? { ...e.ultimoGolpe } : null;
    c.conflictoComida = e.conflictoComida ?? false;
    c.represalia = e.represalia ? { ...e.represalia } : null;
    c.agravios = JSON.parse(JSON.stringify(e.agravios ?? {}));
    c.ultimoComer = e.ultimoComer ? { ...e.ultimoComer, f: e.ultimoComer.f.slice() } : null;
    c.vistoComer = e.vistoComer ?? -1;
    c.atrapada = e.atrapada ?? false;
    c.inconsolable = e.inconsolable ?? false;
    c.habito = JSON.parse(JSON.stringify(e.habito ?? {}));
    c.ayuda = e.ayuda ? { ...e.ayuda } : null;
    return c;
  }
}

export type { Cand };
