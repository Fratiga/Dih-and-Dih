/* Generador de numeros con semilla (mulberry32). Su estado cabe en un entero, asi se puede guardar y restaurar la simulacion
   exactamente donde se quedo. Cada criatura y cada mundo llevan el suyo, para que lo que haga uno no cambie el azar de otro. */

export class Azar {
  s: number;

  constructor(semilla: number) {
    this.s = semilla >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  entre(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  entero(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Normal estandar (Box-Muller). */
  gauss(): number {
    const u = Math.max(1e-9, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }

  elegir<T>(v: readonly T[]): T {
    return v[this.entero(v.length)];
  }
}

/** Mezcla varios enteros en una semilla nueva, para derivar el azar de cada parte a partir de la semilla del experimento. */
export function mezclar(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const x of n) {
    h ^= x >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export const acota = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
