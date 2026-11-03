/* La red neuronal de cada criatura: pequeña y recurrente (una capa oculta que se realimenta, como una red de Elman).
   Su trabajo es aprender que suele pasar cuando se hace algo en una situacion: recibe lo que percibe, como se siente y la accion
   que se plantea, y predice lo que dejaria esa accion. No lleva ninguna regla escrita: al nacer predice casi nada y aprende de lo que ocurre.
   Aprende con un paso de descenso de gradiente por experiencia, y olvida de a poco volviendo hacia los pesos con que nacio. */

import { Azar } from "./azar.ts";

export interface EstadoRed {
  nIn: number;
  nH: number;
  nOut: number;
  semilla: number;
  w1: number[];
  b1: number[];
  w2: number[];
  b2: number[];
  h: number[];
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));
const SESGO_SALIDA = -3;

export class Red {
  nIn: number;
  nH: number;
  nOut: number;
  semilla: number;
  /** Pesos de entrada y de la propia capa oculta (nH x (nIn + nH)). */
  w1: number[];
  b1: number[];
  w2: number[];
  b2: number[];
  /** Lo que la capa oculta recuerda del instante anterior. */
  h: number[];
  private w10: number[];
  private w20: number[];

  constructor(nIn: number, nH: number, nOut: number, semilla: number, e?: EstadoRed) {
    this.nIn = nIn;
    this.nH = nH;
    this.nOut = nOut;
    this.semilla = semilla;
    const inicial = Red.pesosIniciales(nIn, nH, nOut, semilla);
    this.w10 = inicial.w1;
    this.w20 = inicial.w2;
    if (e) {
      this.w1 = e.w1.slice();
      this.b1 = e.b1.slice();
      this.w2 = e.w2.slice();
      this.b2 = e.b2.slice();
      this.h = e.h.slice();
    } else {
      this.w1 = inicial.w1.slice();
      this.b1 = new Array(nH).fill(0);
      this.w2 = inicial.w2.slice();
      this.b2 = new Array(nOut).fill(SESGO_SALIDA);
      this.h = new Array(nH).fill(0);
    }
  }

  static pesosIniciales(nIn: number, nH: number, nOut: number, semilla: number): { w1: number[]; w2: number[] } {
    const r = new Azar(semilla);
    const nCol = nIn + nH;
    const w1: number[] = [];
    for (let i = 0; i < nH * nCol; i++) w1.push((r.gauss() * 1) / Math.sqrt(nCol));
    const w2: number[] = [];
    for (let i = 0; i < nOut * nH; i++) w2.push((r.gauss() * 0.6) / Math.sqrt(nH));
    return { w1, w2 };
  }

  estado(): EstadoRed {
    return { nIn: this.nIn, nH: this.nH, nOut: this.nOut, semilla: this.semilla, w1: this.w1.slice(), b1: this.b1.slice(), w2: this.w2.slice(), b2: this.b2.slice(), h: this.h.slice() };
  }

  static desde(e: EstadoRed): Red {
    return new Red(e.nIn, e.nH, e.nOut, e.semilla, e);
  }

  private oculta(x: number[]): number[] {
    const nCol = this.nIn + this.nH;
    const h = new Array<number>(this.nH);
    for (let j = 0; j < this.nH; j++) {
      let s = this.b1[j];
      const o = j * nCol;
      for (let i = 0; i < this.nIn; i++) s += this.w1[o + i] * x[i];
      for (let i = 0; i < this.nH; i++) s += this.w1[o + this.nIn + i] * this.h[i];
      h[j] = Math.tanh(s);
    }
    return h;
  }

  /** Predice sin cambiar lo que la red recuerda (se usa para comparar opciones). */
  predecir(x: number[]): number[] {
    const h = this.oculta(x);
    const y = new Array<number>(this.nOut);
    for (let k = 0; k < this.nOut; k++) {
      let s = this.b2[k];
      for (let j = 0; j < this.nH; j++) s += this.w2[k * this.nH + j] * h[j];
      y[k] = sig(s);
    }
    return y;
  }

  /** Avanza la memoria a corto plazo de la red con lo que acaba de percibir. */
  avanzar(x: number[]): void {
    this.h = this.oculta(x);
  }

  /** Un paso de aprendizaje: acerca la prediccion a lo que de verdad ocurrio. Devuelve el error cuadratico medio. */
  entrenar(x: number[], objetivo: number[], lr: number, canales?: boolean[]): number {
    const nCol = this.nIn + this.nH;
    const h = this.oculta(x);
    const y = new Array<number>(this.nOut);
    for (let k = 0; k < this.nOut; k++) {
      let s = this.b2[k];
      for (let j = 0; j < this.nH; j++) s += this.w2[k * this.nH + j] * h[j];
      y[k] = sig(s);
    }
    const dy = new Array<number>(this.nOut).fill(0);
    let err = 0;
    for (let k = 0; k < this.nOut; k++) {
      if (canales && !canales[k]) continue;
      const e = y[k] - objetivo[k];
      err += e * e;
      dy[k] = e * y[k] * (1 - y[k]);
    }
    const dh = new Array<number>(this.nH).fill(0);
    for (let k = 0; k < this.nOut; k++) {
      if (dy[k] === 0) continue;
      for (let j = 0; j < this.nH; j++) {
        dh[j] += dy[k] * this.w2[k * this.nH + j];
        this.w2[k * this.nH + j] -= lr * dy[k] * h[j];
      }
      this.b2[k] -= lr * dy[k];
    }
    for (let j = 0; j < this.nH; j++) {
      const g = dh[j] * (1 - h[j] * h[j]);
      if (g === 0) continue;
      const o = j * nCol;
      for (let i = 0; i < this.nIn; i++) this.w1[o + i] -= lr * g * x[i];
      for (let i = 0; i < this.nH; i++) this.w1[o + this.nIn + i] -= lr * g * this.h[i];
      this.b1[j] -= lr * g;
    }
    return err / this.nOut;
  }

  /** Olvido: los pesos vuelven poco a poco hacia con los que nacio. */
  olvidar(tasa: number): void {
    for (let i = 0; i < this.w1.length; i++) this.w1[i] += (this.w10[i] - this.w1[i]) * tasa;
    for (let i = 0; i < this.w2.length; i++) this.w2[i] += (this.w20[i] - this.w2[i]) * tasa;
  }
}
