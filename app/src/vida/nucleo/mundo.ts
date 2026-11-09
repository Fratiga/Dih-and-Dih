/* El mundo: una habitacion vista de lado, que para la simulacion es una linea (la posicion x) con un suelo.
   Aqui viven los objetos, su fisica sencilla y lo que pasa cuando una criatura los toca. La criatura no ve estas reglas:
   solo percibe rasgos y averigua lo que pasa probando. */

import { AJ } from "./ajustes.ts";
import { Azar } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import { C, resCero, type Resultado, type Verbo } from "./tipos.ts";

export interface Objeto {
  id: number;
  tipo: string;
  x: number;
  vx: number;
  /** Altura sobre el suelo, para los botes (no cuenta en la simulacion, solo en lo que se ve). */
  z: number;
  vz: number;
  porciones: number;
  activo: boolean;
  /** Hasta cuando no se puede volver a activar (maquinas). */
  prox: number;
  /** Instante del ultimo destello o sonido (se ve y se oye). */
  luz: number;
  nace: number;
  /** Quien la esta comiendo y desde cuando (solo con el conflicto por comida). */
  ocupante?: number;
  tOcupante?: number;
  /** Lo que le queda de resistencia, si es una barrera que se rompe. */
  salud?: number;
  /** Quien lo lleva encima (solo con el transporte). */
  llevadoPor?: number;
  /** Si es una puerta, a donde lleva (la sala y la posicion de la puerta de enfrente) y si esta cerrada. */
  destino?: { sala: number; x: number };
  cerrada?: boolean;
}

export interface Sonido {
  x: number;
  vol: number;
  t: number;
}

export interface Dano {
  criatura: number;
  cant: number;
  causa: number;
}

/** Algo que acaba de aparecer porque una maquina lo produjo. */
export interface Aparicion {
  t: number;
  id: number;
  tipo: string;
  origen: number;
}

interface Agenda {
  t: number;
  obj: number;
  produce: string;
  distancia: number;
}

export interface EstadoMundo {
  ancho: number;
  t: number;
  sig: number;
  objetos: Objeto[];
  agenda: Agenda[];
  azar: number;
}

const FRICCION = 1.4;
const IMPULSO = 450;

export class Mundo {
  ancho: number;
  t = 0;
  sig = 1;
  objetos: Objeto[] = [];
  agenda: Agenda[] = [];
  sonidos: Sonido[] = [];
  /** Lo que aparecio en el paso actual (se vacia en cada paso). */
  apariciones: Aparicion[] = [];
  azar: Azar;

  constructor(semilla: number, ancho = AJ.ancho, idInicial = 1) {
    this.ancho = ancho;
    this.sig = idInicial;
    this.azar = new Azar(semilla);
  }

  agregar(tipo: string, x: number, o: Partial<Objeto> = {}): Objeto {
    const def = CATALOGO[tipo];
    if (!def) throw new Error(`Tipo de objeto desconocido: ${tipo}`);
    const ob: Objeto = { id: this.sig++, tipo, x, vx: 0, z: 0, vz: 0, porciones: def.porciones, activo: true, prox: 0, luz: -99, nace: this.t, ...o };
    if (def.barrera && def.barrera.resistencia > 0 && ob.salud === undefined) ob.salud = def.barrera.resistencia;
    this.objetos.push(ob);
    return ob;
  }

  /** Recibe un objeto que viene de otra sala (con su identificador, que es unico en todo el complejo). */
  acoger(o: Objeto): void {
    this.objetos.push(o);
  }

  quitar(id: number): void {
    this.objetos = this.objetos.filter((o) => o.id !== id);
  }

  obj(id: number): Objeto | undefined {
    return this.objetos.find((o) => o.id === id);
  }

  /** Si un tramo de x0 a x1 cruza una barrera, donde se queda quien lo recorre (junto a ella, con un margen para el cuerpo de la criatura), y si no, null.
      Quien ya esta dentro de la franja de una barrera puede salir de ella. Con la barrera mas cercana cuando hay varias. */
  cruce(x0: number, x1: number, margen = 0): number | null {
    if (x0 === x1) return null;
    let mejor: number | null = null;
    for (const o of this.objetos) {
      const def = CATALOGO[o.tipo];
      const b = def.barrera ?? (def.puerta && o.cerrada ? { ancho: 12, resistencia: 0 } : undefined);
      if (!b) continue;
      const izq = o.x - b.ancho - margen, der = o.x + b.ancho + margen;
      let p: number | null = null;
      if (x0 <= izq && x1 > izq) p = izq;
      else if (x0 >= der && x1 < der) p = der;
      if (p !== null && (mejor === null || Math.abs(p - x0) < Math.abs(mejor - x0))) mejor = p;
    }
    return mejor;
  }

  hayBarreras(): boolean {
    return this.objetos.some((o) => !!CATALOGO[o.tipo].barrera || !!CATALOGO[o.tipo].puerta);
  }

  /** Lo que lleva cada criatura va con ella (delante, a media altura). Si quien lo lleva ya no esta o no esta viva, se cae donde estaba. */
  llevar(criaturas: { id: number; x: number; dir: number; vivo: boolean }[]): void {
    for (const o of this.objetos) {
      if (o.llevadoPor === undefined) continue;
      const c = criaturas.find((q) => q.id === o.llevadoPor);
      if (!c || !c.vivo) { o.llevadoPor = undefined; o.vx = 0; continue; }
      o.x = Math.max(20, Math.min(this.ancho - 20, c.x + c.dir * 24));
      o.z = 40;
      o.vx = 0;
      o.vz = 0;
    }
  }

  /** Una criatura recoge algo si pesa lo que puede con su fuerza. Devuelve si lo ha recogido. */
  cargar(id: number, quien: number, capacidad: number): boolean {
    const o = this.obj(id);
    if (!o || o.llevadoPor !== undefined) return false;
    const def = CATALOGO[o.tipo];
    if (def.masa <= 0 || def.masa > capacidad) return false;
    o.llevadoPor = quien;
    o.vx = 0;
    o.ocupante = undefined;
    this.sonar(o.x, 0.08);
    return true;
  }

  /** Lo que lleva se deja donde esta, delante de quien lo lleva. */
  soltar(id: number): void {
    const o = this.obj(id);
    if (!o || o.llevadoPor === undefined) return;
    o.llevadoPor = undefined;
    o.z = 6;
    o.vz = 0;
    o.vx = 0;
    this.sonar(o.x, 0.1);
  }

  sonar(x: number, vol: number): void {
    this.sonidos.push({ x, vol, t: this.t });
  }

  /** Avanza la fisica y devuelve el dano que reciben las criaturas que estan sobre algo peligroso. */
  paso(dt: number, criaturas: { id: number; x: number }[]): Dano[] {
    this.t += dt;
    this.apariciones = [];
    const danos: Dano[] = [];
    for (const o of this.objetos) {
      if (o.llevadoPor !== undefined) continue;
      const def = CATALOGO[o.tipo];
      if (def.masa > 0) {
        const antes = o.x;
        o.x += o.vx * dt;
        // Las barreras tambien paran a lo que rueda
        if (o.vx !== 0 && this.hayBarreras()) {
          const p = this.cruce(antes, o.x, 0);
          if (p !== null) { o.x = p; o.vx = -o.vx * 0.4; }
        }
        o.vx *= Math.exp(-FRICCION * (o.z > 1 ? 0.4 : 1) * dt);
        if (Math.abs(o.vx) < 2) o.vx = 0;
        if (o.x < 20) { o.x = 20; o.vx = Math.abs(o.vx) * 0.6; }
        if (o.x > this.ancho - 20) { o.x = this.ancho - 20; o.vx = -Math.abs(o.vx) * 0.6; }
      }
      // Todo cae, tenga masa o no (una palanca soltada en el aire llega al suelo y se queda). Solo lo que se mueve rebota.
      if (o.z > 0 || o.vz > 0) {
        o.vz -= 700 * dt;
        o.z += o.vz * dt;
        if (o.z <= 0) {
          o.z = 0;
          o.vz = def.masa > 0 && Math.abs(o.vz) > 60 ? -o.vz * 0.4 : 0;
          if (def.masa > 0 && Math.abs(o.vx) > 25) this.sonar(o.x, 0.12);
        }
      }
      if (def.peligro && o.activo) {
        for (const c of criaturas) if (Math.abs(c.x - o.x) <= def.peligro.ancho / 2) danos.push({ criatura: c.id, cant: def.peligro.ratio * dt, causa: o.id });
      }
    }
    // Lo que se programo (lo que produce una maquina)
    if (this.agenda.length) {
      const resto: Agenda[] = [];
      for (const a of this.agenda) {
        if (a.t > this.t) { resto.push(a); continue; }
        const m = this.obj(a.obj);
        if (!m || !a.produce) continue;
        const lado = this.azar.next() < 0.5 ? -1 : 1;
        const x = Math.max(40, Math.min(this.ancho - 40, m.x + lado * a.distancia));
        const nuevo = this.agregar(a.produce, x, { z: 40, vz: 80 });
        this.apariciones.push({ t: this.t, id: nuevo.id, tipo: nuevo.tipo, origen: m.id });
        this.sonar(x, 0.15);
      }
      this.agenda = resto;
    }
    for (const o of [...this.objetos]) {
      const def = CATALOGO[o.tipo];
      if (def.caduca && this.t - o.nace > def.caduca) this.quitar(o.id);
    }
    this.sonidos = this.sonidos.filter((s) => this.t - s.t < 1.5);
    return danos;
  }

  /** Lo que ocurre cuando una criatura hace algo con un objeto. */
  interactuar(verbo: Verbo, id: number, xActor: number, fuerza: number): Resultado {
    const o = this.obj(id);
    const res = resCero();
    if (!o) return { res, efecto: false };
    const def = CATALOGO[o.tipo];
    let efecto = false;
    if (def.barrera && (verbo === "empujar" || verbo === "tocar")) {
      // Una barrera se queda donde esta. Si es de las que se rompen, cada empujon la desgasta (el toque suave, mucho menos) y se oye.
      const fuerte = verbo === "empujar";
      if (def.barrera.resistencia > 0 && o.salud !== undefined) {
        o.salud -= (fuerte ? 0.25 : 0.03) * fuerza;
        o.luz = this.t;
        this.sonar(o.x, fuerte ? 0.35 : 0.15);
        res[C.diversion] = def.efecto * (fuerte ? 1 : 0.5);
        efecto = true;
        if (o.salud <= 0) { this.sonar(o.x, 0.6); res[C.diversion] += 0.2; this.quitar(o.id); }
      }
      return { res, efecto };
    }
    if (verbo === "probar") {
      if (def.porciones > 0 && o.porciones > 0) {
        res[C.sacia] = def.nutri;
        res[C.dano] = def.toxico;
        efecto = true;
        o.porciones--;
        if (o.porciones <= 0) this.quitar(o.id);
      } else if (def.descarga) {
        res[C.dano] = def.descarga;
        res[C.susto] = 0.4;
        this.sonar(o.x, 0.3);
        o.luz = this.t;
        efecto = true;
      }
    } else if (verbo === "empujar" || verbo === "tocar") {
      const fuerte = verbo === "empujar";
      if (def.descarga) {
        res[C.dano] = def.descarga;
        res[C.susto] = def.descarga > 0 ? 0.4 : 0;
        if (def.descarga > 0) { this.sonar(o.x, 0.3); o.luz = this.t; efecto = true; }
      }
      if (def.masa > 0) {
        const dir = o.x >= xActor ? 1 : -1;
        const imp = (fuerte ? IMPULSO : IMPULSO * 0.25) * fuerza;
        o.vx += (dir * imp) / (0.5 + def.masa);
        o.vz = Math.max(o.vz, fuerte ? 170 : 60);
        res[C.diversion] = def.efecto * (fuerte ? 1 : 0.5);
        this.sonar(o.x, 0.2);
        efecto = true;
      } else if (def.maquina) {
        if (this.t >= o.prox) {
          o.prox = this.t + def.maquina.enfria;
          o.luz = this.t;
          this.agenda.push({ t: this.t + def.maquina.retardo, obj: o.id, produce: def.maquina.produce, distancia: def.maquina.distancia });
          res[C.diversion] = def.efecto;
          this.sonar(o.x, 0.45);
          efecto = true;
        } else res[C.diversion] = 0.04;
      } else if (def.efecto > 0) {
        res[C.diversion] = def.efecto;
        o.luz = this.t;
        this.sonar(o.x, 0.3);
        efecto = true;
      }
    }
    return { res, efecto };
  }

  estado(): EstadoMundo {
    return JSON.parse(JSON.stringify({ ancho: this.ancho, t: this.t, sig: this.sig, objetos: this.objetos, agenda: this.agenda, azar: this.azar.s })) as EstadoMundo;
  }

  restaurar(e: EstadoMundo): void {
    const c = JSON.parse(JSON.stringify(e)) as EstadoMundo;
    this.ancho = c.ancho;
    this.t = c.t;
    this.sig = c.sig;
    this.objetos = c.objetos;
    this.agenda = c.agenda;
    this.azar.s = c.azar;
    this.sonidos = [];
  }
}
