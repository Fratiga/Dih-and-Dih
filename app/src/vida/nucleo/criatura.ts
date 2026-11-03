/* La criatura: su cuerpo (necesidades), su caracter (rasgos y emociones), su cabeza (red + memoria) y lo que hace.
   Este archivo guarda el estado y lo que se aprende de cada experiencia. Percibir y decidir esta en conducta.ts y moverse y actuar en acciones.ts. */

import { AJ } from "./ajustes.ts";
import { Azar, acota, mezclar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { candidatas, elegir, featuresObjeto, percibir, valorDeProbar, type Cand } from "./conducta.ts";
import { ejecutar, iniciar } from "./acciones.ts";
import type { Genoma } from "./genoma.ts";
import { Memoria, articulo, type EstadoMemoria } from "./memoria.ts";
import type { Mundo } from "./mundo.ts";
import { Red, type EstadoRed } from "./red.ts";
import { C, D, DIA, E, N, NC, R, VERBOS, type Percepto, type Res, type Verbo } from "./tipos.ts";

export interface Entorno {
  mundo: Mundo;
  criaturas: Criatura[];
  t: number;
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
  comp: number;
  f: number[];
  /** Lo que esperaba conseguir al elegirla (para notar cuando no llega). */
  espera: Res;
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
const CANALES_SIN_SACIA = [false, true, true, true, true];

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
  espera: number;
  proxDecision: number;
  forzar: boolean;
  acumOlvido: number;
  expuesto: Record<number, number>;
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
  registro: Registro[] = [];
  capRegistro = 600;
  t = 0;
  /** Que mortalidad hay: "protegida" no deja que la salud baje de un minimo. */
  protegida = true;
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
    this.red = new Red(NI, AJ.ocultas, NC, genoma.semillaCerebro);
    this.emo[E.curiosidad] = this.rasgos[R.curiosidad] * 0.6;
  }

  /* ---------- Un paso de vida ---------- */

  paso(env: Entorno, dt: number): void {
    this.t = env.t;
    this.edad += dt;
    if (!this.vivo) return;
    this.necesidades(env, dt);
    this.emociones(dt);
    this.acumOlvido += dt;
    if (this.acumOlvido >= 5) {
      this.mem.olvidar(this.acumOlvido);
      this.red.olvidar(AJ.olvidoRed * this.acumOlvido);
      this.relajarRasgos(this.acumOlvido);
      this.acumOlvido = 0;
    }
    this.percibidos = percibir(this, env);
    this.notarApariciones(env);
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

  private decidir(env: Entorno): void {
    const cands = candidatas(this, this.percibidos, env);
    const c = elegir(this, cands);
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
    n[N.hambre] = acota(n[N.hambre] + AJ.hambre * g.metabolismo * (dur ? 0.5 : 1) * dt);
    n[N.sueno] = acota(n[N.sueno] + (dur ? AJ.suenoDormido : AJ.sueno) * dt);
    n[N.aburrimiento] = acota(n[N.aburrimiento] + AJ.aburrimiento * (dur ? 0.1 : 1) * dt);
    n[N.dolor] = acota(n[N.dolor] - AJ.dolorCae * dt);
    // Soledad: solo cuenta si hay otras criaturas, y sube mas en quien se apega
    const otros = env.criaturas.filter((o) => o !== this && o.vivo);
    if (otros.length) {
      const cerca = otros.some((o) => Math.abs(o.x - this.x) < 160);
      if (cerca) n[N.soledad] = acota(n[N.soledad] - 0.012 * dt);
      else n[N.soledad] = acota(n[N.soledad] + AJ.soledad * (0.5 + this.rasgos[R.apego] + this.rasgos[R.sociabilidad] * 0.5) * dt);
    } else n[N.soledad] = 0;
    if (n[N.hambre] > 0.95) this.salud -= AJ.saludHambre * dt;
    else if (n[N.dolor] < 0.2) this.salud += AJ.saludCura * dt;
    this.salud = acota(this.salud, this.protegida ? 0.08 : 0, 1);
    if (this.salud <= 0) { this.vivo = false; this.accion = null; this.mem.anotar(env.t, "muerte", "Murió.", -1); }
  }

  private emociones(dt: number): void {
    const e = this.emo;
    e[E.miedo] *= Math.exp(-dt / 12);
    e[E.frustracion] *= Math.exp(-dt / 30);
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
    v.afecto = acota(v.afecto + 0.0007 * dt * (0.4 + this.rasgos[R.sociabilidad] + this.rasgos[R.apego]) * (1 - v.afecto));
  }

  nombreDe(idPercepto: number): string {
    const p = this.percibidos.find((q) => q.id === idPercepto);
    return p ? p.nombre : `la criatura ${idPercepto - 1000}`;
  }

  /* ---------- Entrada de la red ---------- */

  entrada(f: number[], v: Verbo, x: number, ancho: number): number[] {
    const out = new Array<number>(NI).fill(0);
    for (let i = 0; i < D; i++) out[i] = f[i];
    out[D + VERBOS.indexOf(v)] = 1;
    let o = D + VERBOS.length;
    for (let i = 0; i < 5; i++) out[o++] = this.nec[i] * 0.6;
    for (let i = 0; i < 5; i++) out[o++] = this.emo[i] * 0.6;
    out[o] = x / ancho;
    return out;
  }

  get lr(): number {
    return AJ.lrRed * this.genoma.plasticidad;
  }

  /* ---------- Aprender de lo que pasa ---------- */

  /** Se llama cuando una accion sobre algo ya tuvo su efecto (el mordisco, el empujon, el toque). */
  experimentar(acc: Accion, res: Res, efecto: boolean, env: Entorno): void {
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
    this.registrar({ t: env.t, kind: "impacto", v: acc.v, tipo: acc.tipo, obj: acc.obj, res: res.slice() });

    const gus = res[C.sacia] + res[C.diversion] + res[C.compania];
    // Lo que esperaba frente a lo que paso
    const esperado = acc.espera[C.sacia] * this.nec[N.hambre] + acc.espera[C.diversion];
    const clave = `${acc.v}:${acc.tipo}`;
    if (gus < 0.08 && res[C.dano] < 0.05) {
      this.fallos[clave] = (this.fallos[clave] ?? 0) + 1;
      if (esperado > 0.25) this.emo[E.frustracion] = acota(this.emo[E.frustracion] + 0.18);
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
      const res = [tr.cred, 0, 0, 0, 0];
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
  sufrir(nivel: number, causa: number, acc: Accion | null, susto = 0): void {
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
    const ult = this.accionReciente(env);
    this.emo[E.excitacion] = acota(this.emo[E.excitacion] + 0.6);
    this.nec[N.soledad] = acota(this.nec[N.soledad] - 0.2);
    this.nec[N.aburrimiento] = acota(this.nec[N.aburrimiento] - 0.2);
    if (!ult) return;
    const res = [0, 0, nivel, nivel * 0.5, 0];
    this.mem.aprender(ult.v, ult.f, ult.lug, res, ult.tipo, ult.nombre, env.t, [false, false, true, true, false], 1.6);
    const a = articulo(ult.tipo, ult.nombre);
    this.mem.anotar(env.t, `premio:${ult.v}:${ult.tipo}`, `Recibió una caricia justo después de ${this.verboPasado(ult.v)} ${a.el ? a.el + " " : ""}${a.nombre}.`, 0.6);
  }

  /** Susto: el jugador la asusta. */
  asustar(env: Entorno): void {
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
        dormido: this.dormido, fallos: this.fallos, ultimoDano: this.ultimoDano, vivo: this.vivo,
        espera: this.espera, proxDecision: this.proxDecision, forzar: this.forzar, acumOlvido: this.acumOlvido, expuesto: this.expuesto,
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
    c.red = Red.desde(e.red);
    c.accion = e.accion ? JSON.parse(JSON.stringify(e.accion)) : null;
    c.trazas = JSON.parse(JSON.stringify(e.trazas));
    c.edad = e.edad;
    c.dormido = e.dormido;
    c.fallos = { ...e.fallos };
    c.ultimoDano = e.ultimoDano;
    c.vivo = e.vivo;
    c.espera = e.espera;
    c.proxDecision = e.proxDecision;
    c.forzar = e.forzar;
    c.acumOlvido = e.acumOlvido;
    c.expuesto = { ...e.expuesto };
    return c;
  }
}

export type { Cand };
