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

  constructor(semilla: number, ancho = AJ.ancho) {
    this.ancho = ancho;
    this.azar = new Azar(semilla);
  }

  agregar(tipo: string, x: number, o: Partial<Objeto> = {}): Objeto {
    const def = CATALOGO[tipo];
    if (!def) throw new Error(`Tipo de objeto desconocido: ${tipo}`);
    const ob: Objeto = { id: this.sig++, tipo, x, vx: 0, z: 0, vz: 0, porciones: def.porciones, activo: true, prox: 0, luz: -99, nace: this.t, ...o };
    this.objetos.push(ob);
    return ob;
  }

  quitar(id: number): void {
    this.objetos = this.objetos.filter((o) => o.id !== id);
  }

  obj(id: number): Objeto | undefined {
    return this.objetos.find((o) => o.id === id);
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
      const def = CATALOGO[o.tipo];
      if (def.masa > 0) {
        o.x += o.vx * dt;
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
