/* La memoria de una criatura. Tiene cuatro partes:
   1. Asociaciones (rapidas): "esto, hecho asi, dio tal resultado". Se aprenden con una sola experiencia, se refuerzan al repetirse,
      se difuminan si no se usan y se aplican tambien a cosas parecidas (generalizacion), porque se comparan por semejanza.
   2. Avistamientos: donde vio cada cosa por ultima vez.
   3. Episodios: lo importante que le paso, escrito para que el jugador lo lea. No se guarda ningun fotograma.
   4. Habitos y vinculos: cuanto tiempo pasa con cada cosa y con quien. */

import { AJ } from "./ajustes.ts";
import { CATALOGO } from "./catalogo.ts";
import { C, D, NC, type Res } from "./tipos.ts";

/** Cuanto cuenta cada rasgo al comparar dos cosas. El movimiento cuenta poco: una pelota rodando sigue siendo la pelota. */
const PESO_RASGO = [1, 1, 1, 1, 1, 1, 1, 0.08, 1, 1];

export interface Proto {
  /** "probar", "empujar", "tocar", "acercarse", o "presencia" (lo que suele pasar cuando esa cosa esta cerca) o "lugar". */
  v: string;
  f: number[];
  /** Posicion en la habitacion, de 0 a 1 (solo cuenta en los lugares). */
  lug: number;
  res: Res;
  n: number;
  /** Cuantas de esas veces fueron experiencia propia (no ver a otra). Es lo que cuenta para saber si algo ya se ha probado. */
  nProp?: number;
  fuerza: number;
  t: number;
  tipo: string;
  nombre: string;
}

export interface Avistamiento {
  id: number;
  tipo: string;
  nombre: string;
  f: number[];
  x: number;
  t: number;
}

export interface Episodio {
  t: number;
  texto: string;
  /** De -1 (muy malo) a 1 (muy bueno). */
  val: number;
  clave: string;
  n: number;
}

export interface Vinculo {
  id: number;
  nombre: string;
  afecto: number;
  tiempo: number;
  /** Lo que se percibia de ella (tamano, color, huella): con el reconocimiento por rasgos, es lo que sirve para saber si es la misma. */
  firma?: number[];
}

export interface Prediccion {
  res: Res;
  /** Cuanta experiencia respalda la prediccion, de 0 a 1. */
  conf: number;
  /** Lo mismo, contando solo lo vivido por uno mismo: ver a otra no hace que algo deje de ser nuevo. */
  confPropia: number;
}

export interface EstadoMemoria {
  protos: Proto[];
  avist: Avistamiento[];
  episodios: Episodio[];
  acciones: Record<string, number>;
  cerca: Record<string, number>;
  vinculos: Vinculo[];
  visitas: number[];
  total: number;
}

export const BINES = 16;

export function semejanza(a: number[], b: number[], m: number[]): number {
  let s = 0;
  for (let i = 0; i < D; i++) {
    const w = m[i] * PESO_RASGO[i];
    if (w === 0) continue;
    const d = a[i] - b[i];
    s += w * d * d;
  }
  return Math.exp(-s / (2 * AJ.sigma * AJ.sigma));
}

const UNOS = new Array<number>(D).fill(1);

export function articulo(tipo: string, nombre: string): { el: string; un: string; nombre: string } {
  const t = CATALOGO[tipo];
  if (!t) return { el: "", un: "", nombre };
  return t.gen === "f" ? { el: "la", un: "una", nombre: t.nombre } : { el: "el", un: "un", nombre: t.nombre };
}

export class Memoria {
  protos: Proto[] = [];
  avist: Avistamiento[] = [];
  episodios: Episodio[] = [];
  acciones: Record<string, number> = {};
  cerca: Record<string, number> = {};
  vinculos: Vinculo[] = [];
  visitas: number[] = new Array(BINES).fill(0);
  total = 0;
  /** Duracion de los recuerdos (viene del genoma). */
  dur: number;
  plast: number;

  constructor(dur: number, plast: number) {
    this.dur = dur;
    this.plast = plast;
  }

  /* --- Asociaciones --- */

  predecir(v: string, f: number[], m: number[], lug: number): Prediccion {
    let sw = 0;
    let ev = 0;
    let evP = 0;
    const acc = new Array<number>(NC).fill(0);
    for (const p of this.protos) {
      if (p.v !== v) continue;
      const s = v === "lugar" ? Math.exp(-((p.lug - lug) ** 2) / (2 * 0.06 * 0.06)) : semejanza(f, p.f, m);
      if (s < 0.02) continue;
      const w = s * Math.min(1, p.fuerza);
      sw += w;
      ev += w * Math.min(1, p.n / 2);
      evP += w * Math.min(1, (p.nProp ?? p.n) / 2);
      for (let k = 0; k < NC; k++) acc[k] += w * (p.res[k] ?? 0);
    }
    if (sw <= 1e-9) return { res: new Array<number>(NC).fill(0), conf: 0, confPropia: 0 };
    return { res: acc.map((a) => a / sw), conf: 1 - Math.exp(-2 * ev), confPropia: 1 - Math.exp(-2 * evP) };
  }

  /** Aprende de una experiencia. `canales` limita que resultados se actualizan (para el credito tardio). */
  aprender(v: string, f: number[], lug: number, res: Res, tipo: string, nombre: string, t: number, canales?: boolean[], alfaExtra = 1, propia = true): Proto {
    let mejor: Proto | null = null;
    let ms = 0;
    for (const p of this.protos) {
      if (p.v !== v) continue;
      const s = v === "lugar" ? (Math.abs(p.lug - lug) < 0.05 ? 1 : 0) : semejanza(f, p.f, UNOS);
      if (s >= (v === "lugar" ? 1 : AJ.fusion) && s > ms) { mejor = p; ms = s; }
    }
    if (mejor) {
      const alfa = Math.min(1, Math.max(1 / (mejor.n + 1), AJ.alfaMin * this.plast) * alfaExtra);
      for (let k = 0; k < NC; k++) if (!canales || canales[k]) mejor.res[k] += alfa * (res[k] - mejor.res[k]);
      for (let i = 0; i < D; i++) mejor.f[i] += alfa * 0.4 * (f[i] - mejor.f[i]);
      if (v === "lugar") mejor.lug += 0.3 * (lug - mejor.lug);
      mejor.n++;
      if (propia) mejor.nProp = (mejor.nProp ?? mejor.n - 1) + 1;
      mejor.fuerza = Math.min(1.5, Math.max(mejor.fuerza, 0.6) + 0.35);
      mejor.t = t;
      return mejor;
    }
    const nuevo: Proto = { v, f: f.slice(), lug, res: res.map((x, k) => (!canales || canales[k] ? x : 0)), n: 1, nProp: propia ? 1 : 0, fuerza: 1, t, tipo, nombre };
    this.protos.push(nuevo);
    if (this.protos.length > AJ.capacidad * this.dur) {
      let peor = 0;
      for (let i = 1; i < this.protos.length; i++) if (this.protos[i].fuerza < this.protos[peor].fuerza) peor = i;
      if (this.protos[peor] === nuevo) peor = peor === 0 ? 1 : 0;
      this.protos.splice(peor, 1);
    }
    return nuevo;
  }

  /** Mezcla un resultado en una asociacion que ya existe, sin buscar la mas parecida (con los mismos pesos que `aprender`). Sirve para que lo aprendido de un objeto alcance a todo
      lo que se sabe hacer con el, aunque su aspecto de ese momento (quieto, en movimiento) no se parezca al de cada asociacion. */
  reforzar(p: Proto, res: Res, canales: boolean[], alfaExtra: number, t: number): void {
    const alfa = Math.min(1, Math.max(1 / (p.n + 1), AJ.alfaMin * this.plast) * alfaExtra);
    for (let k = 0; k < NC; k++) if (canales[k]) p.res[k] += alfa * (res[k] - p.res[k]);
    p.n++;
    p.fuerza = Math.min(1.5, Math.max(p.fuerza, 0.6) + 0.35);
    p.t = t;
  }

  /** Olvido gradual: lo que no se usa se difumina. Lo muy importante (dolor, comida) dura mas. */
  olvidar(dt: number): void {
    for (const p of this.protos) {
      const imp = Math.max(p.res[C.dano], p.res[C.sacia], p.res[C.susto] * 0.6);
      const vida = AJ.vidaMedia * this.dur * (1 + 2 * imp);
      p.fuerza *= Math.pow(0.5, dt / vida);
    }
    if (this.protos.some((p) => p.fuerza < 0.04)) this.protos = this.protos.filter((p) => p.fuerza >= 0.04);
    for (let i = 0; i < this.visitas.length; i++) this.visitas[i] *= Math.pow(0.5, dt / 900);
  }

  /* --- Avistamientos --- */

  ver(id: number, tipo: string, nombre: string, f: number[], x: number, t: number): void {
    const a = this.avist.find((q) => q.id === id);
    if (a) { a.x = x; a.t = t; a.f = f.slice(); return; }
    this.avist.push({ id, tipo, nombre, f: f.slice(), x, t });
    if (this.avist.length > 14) {
      this.avist.sort((p, q) => q.t - p.t);
      this.avist.length = 14;
    }
  }

  olvidarAvistamiento(id: number): void {
    this.avist = this.avist.filter((a) => a.id !== id);
  }

  /* --- Episodios --- */

  anotar(t: number, clave: string, texto: string, val: number): void {
    const rec = this.episodios.slice(-14).find((e) => e.clave === clave);
    if (rec) { rec.n++; rec.t = t; rec.val = rec.val * 0.6 + val * 0.4; return; }
    this.episodios.push({ t, texto, val, clave, n: 1 });
    if (this.episodios.length > AJ.maxEpisodios) {
      // Se olvidan primero los mas antiguos que no fueron muy intensos
      let k = 0;
      let menor = 9;
      for (let i = 0; i < this.episodios.length - 20; i++) {
        const q = Math.abs(this.episodios[i].val);
        if (q < menor) { menor = q; k = i; }
      }
      this.episodios.splice(k, 1);
    }
  }

  /* --- Habitos y vinculos --- */

  contar(clave: string): void {
    this.acciones[clave] = (this.acciones[clave] ?? 0) + 1;
  }

  vinculo(id: number, nombre: string): Vinculo {
    let v = this.vinculos.find((q) => q.id === id);
    if (!v) { v = { id, nombre, afecto: 0, tiempo: 0 }; this.vinculos.push(v); }
    return v;
  }

  /* --- Lo que lee el jugador --- */

  /** Lo que ha aprendido, escrito en frases. */
  asociacionesLegibles(): { texto: string; valor: number; veces: number; fuerza: number }[] {
    const out: { texto: string; valor: number; veces: number; fuerza: number }[] = [];
    for (const p of this.protos) {
      if (p.v === "lugar") {
        if (p.res[C.dano] > 0.2) out.push({ texto: `La zona de la posición ${Math.round(p.lug * 100)} le trae dolor.`, valor: -p.res[C.dano], veces: p.n, fuerza: p.fuerza });
        continue;
      }
      const a = articulo(p.tipo, p.nombre);
      const sujeto = `${a.el ? a.el + " " : ""}${a.nombre}`.trim();
      if (p.v === "presencia") {
        if (p.res[C.dano] > 0.15) out.push({ texto: `Estar cerca de ${sujeto} le hace daño.`, valor: -p.res[C.dano], veces: p.n, fuerza: p.fuerza });
        continue;
      }
      if (p.n < 1) continue;
      const r = p.res;
      const verbo = p.v === "probar" ? "Probar" : p.v === "empujar" ? "Empujar" : p.v === "tocar" ? "Tocar" : "Acercarse a";
      if (r[C.sacia] > 0.15) out.push({ texto: `${verbo} ${sujeto} le quita el hambre.`, valor: r[C.sacia], veces: p.n, fuerza: p.fuerza });
      if (r[C.dano] > 0.15) out.push({ texto: `${verbo} ${sujeto} le hace daño.`, valor: -r[C.dano], veces: p.n, fuerza: p.fuerza });
      if (r[C.diversion] > 0.2) out.push({ texto: `${verbo} ${sujeto} le divierte.`, valor: r[C.diversion], veces: p.n, fuerza: p.fuerza });
      if (r[C.compania] > 0.2) out.push({ texto: `Estar con ${sujeto} le da compañía.`, valor: r[C.compania], veces: p.n, fuerza: p.fuerza });
      if (r[C.susto] > 0.25) out.push({ texto: `${verbo} ${sujeto} le asusta.`, valor: -r[C.susto], veces: p.n, fuerza: p.fuerza });
      if (Math.max(r[C.sacia], r[C.dano], r[C.diversion], r[C.compania], r[C.susto]) < 0.1 && p.n >= 3) out.push({ texto: `${verbo} ${sujeto} no le sirve de nada.`, valor: 0, veces: p.n, fuerza: p.fuerza });
    }
    return out.sort((a, b) => Math.abs(b.valor) * b.fuerza - Math.abs(a.valor) * a.fuerza);
  }

  /** Lo que se le ve hacer, en frases. */
  habitosLegibles(): string[] {
    const out: string[] = [];
    const tipos = Object.entries(this.cerca).sort((a, b) => b[1] - a[1]);
    for (const [tipo, seg] of tipos.slice(0, 3)) {
      const pct = this.total > 0 ? seg / this.total : 0;
      if (pct < 0.06) continue;
      const a = articulo(tipo, tipo);
      if (!a.el) continue;
      out.push(`Pasa mucho tiempo cerca de ${a.el} ${a.nombre} (${Math.round(pct * 100)} % del tiempo).`);
    }
    for (const p of this.protos) {
      if (p.v === "presencia" && p.res[C.dano] > 0.3 && p.fuerza > 0.3) {
        const a = articulo(p.tipo, p.nombre);
        if (a.el) out.push(`Evita ${a.el} ${a.nombre}.`);
      }
    }
    for (const v of this.vinculos) {
      if (v.afecto > 0.5) out.push(`Busca la compañía de ${v.nombre}.`);
    }
    return out;
  }

  estado(): EstadoMemoria {
    return JSON.parse(JSON.stringify({ protos: this.protos, avist: this.avist, episodios: this.episodios, acciones: this.acciones, cerca: this.cerca, vinculos: this.vinculos, visitas: this.visitas, total: this.total })) as EstadoMemoria;
  }

  restaurar(e: EstadoMemoria): void {
    const c = JSON.parse(JSON.stringify(e)) as EstadoMemoria;
    this.protos = c.protos;
    for (const p of this.protos) while (p.res.length < NC) p.res.push(0);
    this.avist = c.avist;
    this.episodios = c.episodios;
    this.acciones = c.acciones;
    this.cerca = c.cerca;
    this.vinculos = c.vinculos;
    this.visitas = c.visitas;
    this.total = c.total;
  }
}
