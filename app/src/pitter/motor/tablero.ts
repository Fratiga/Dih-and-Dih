/* El tablero de Pitter-Patter. Logica pura y determinista (sin Phaser ni DOM): la misma semilla da la misma partida,
   asi se puede probar en Node y el juego solo tiene que dibujar los pasos que devuelve.

   Reglas (tomadas del original y fijadas aqui, todas en REGLAS para poder ajustarlas):
   - Tablero de 6x6 con fichas de personaje. Un grupo son fichas iguales que se tocan por un lado.
   - Un grupo de 4 o mas se borra. Un grupo de 6 o mas deja una Caja (tocarla borra cinco fichas en cruz).
   - Las fichas de arriba caen y las que faltan entran desde arriba. Cada borrado seguido sube el combo.
   - El jugador arrastra una ficha por su fila o su columna: las que pisa se desplazan un hueco (se intercambian con ella).
   - El combo vive en una ventana de tiempo: cada grupo la reinicia y cuando se acaba el combo se rompe.
   - Un grupo hace mas dano cuanto mas grande es. Las fichas del grupo se juntan en un bloque grande (lo dibuja la escena). */

export const N = 6;
export const TOTAL = N * N;

export const REGLAS = {
  minGrupo: 4,
  minCaja: 6,
  danoBase: 12,
  danoEquipo: 2, // por punto de ataque, solo en fichas del equipo
  multPorCombo: 0.07,
  multMaxCombo: 3.2,
  /** Segundos que dura la ventana del combo tras un grupo: baja un poco cuanto mas largo es el combo. */
  ventanaBase: 3,
  ventanaMin: 1.7,
  ventanaPorCombo: 0.07,
  /** Multiplicador del dano de un grupo segun su tamaño (indice = fichas del grupo). */
  porTamano: [0, 0, 0, 0, 1, 1.18, 1.42, 1.7, 2, 2.35, 2.7],
  reforzada: 1.6,
  cargaAjena: 0.34,
  cargaReforzada: 1.5,
};

export interface Celda {
  id: number;
  tipo: number;
  reforzada: boolean;
  /** Vida del bloque. 0 = ficha normal. Un bloque no se empareja ni se arrastra; se rompe al borrarse un grupo pegado a el. */
  bloque: number;
  caja: boolean;
  /** No se puede arrastrar (la congela un jefe). */
  congelada: boolean;
  /** Se ve como una interrogacion (la mancha un jefe). */
  tinta: boolean;
  /** Mientras dura el Stand Up Time, un grupo no se borra: se queda "de pie" en el tablero. */
  stand: boolean;
}

export interface Grupo {
  tipo: number;
  celdas: number[]; // indices
  ids: number[];
  /** Rectangulo que envuelve al grupo: columnas y filas, inclusive. */
  caja: { x0: number; y0: number; x1: number; y1: number };
  /** Cierto si el grupo llena su rectangulo entero (es un bloque cuadrado o rectangular de verdad). */
  rect: boolean;
}

export type Paso =
  | { k: "borrar"; ids: number[]; grupos: Grupo[]; combo: number; mult: number; dano: number; cargas: Record<number, number>; cajas: { id: number; idx: number }[]; rotos: number[]; golpeados: number[] }
  | { k: "caer"; mov: { id: number; de: number; a: number }[] }
  | { k: "entrar"; nuevas: { id: number; idx: number; tipo: number; desde: number }[] }
  | { k: "convertir"; cambios: { id: number; tipo: number }[] }
  | { k: "reforzar"; ids: number[] }
  | { k: "barajar"; mov: { id: number; de: number; a: number }[] }
  | { k: "crear"; cajas: { id: number; idx: number }[] }
  | { k: "poner"; bloques: { id: number; idx: number; vida: number }[] }
  | { k: "estado"; ids: number[]; que: "congelada" | "tinta" | "stand"; valor: boolean }
  | { k: "limpiarObstaculos"; ids: number[] }
  | { k: "estallar"; ids: number[]; dano: number; cuadrados: number }
  | { k: "efecto"; nombre: string; ids?: number[]; dano?: number };

export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OpcionesTablero {
  semilla: number;
  /** Cuantos personajes distintos hay en el tablero (6 en el original). */
  tipos: number;
  /** Cuantos tipos son del equipo: sus indices son 0 y 1. */
  equipo: [number, number];
  atqEquipo: [number, number];
}

export class Tablero {
  celdas: Celda[] = [];
  rng: () => number;
  proximoId = 1;
  tipos: number;
  equipo: [number, number];
  atqEquipo: [number, number];
  combo = 0;
  modoStand = false;
  pozoStand = 0;

  constructor(op: OpcionesTablero) {
    this.rng = mulberry32(op.semilla);
    this.tipos = op.tipos;
    this.equipo = op.equipo;
    this.atqEquipo = op.atqEquipo;
    this.generar();
  }

  nueva(tipo?: number): Celda {
    return {
      id: this.proximoId++,
      tipo: tipo ?? Math.floor(this.rng() * this.tipos),
      reforzada: false,
      bloque: 0,
      caja: false,
      congelada: false,
      tinta: false,
      stand: false,
    };
  }

  private generar(): void {
    this.celdas = Array.from({ length: TOTAL }, () => this.nueva());
    // Sin grupos hechos de salida: se cambia una ficha de cada grupo hasta que no quede ninguno.
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const gs = this.grupos();
      if (!gs.length) break;
      for (const g of gs) {
        const idx = g.celdas[Math.floor(this.rng() * g.celdas.length)];
        this.celdas[idx] = this.nueva();
      }
    }
  }

  vecinos(idx: number): number[] {
    const x = idx % N;
    const y = Math.floor(idx / N);
    const r: number[] = [];
    if (x > 0) r.push(idx - 1);
    if (x < N - 1) r.push(idx + 1);
    if (y > 0) r.push(idx - N);
    if (y < N - 1) r.push(idx + N);
    return r;
  }

  private emparejable(c: Celda): boolean {
    return c.bloque === 0 && !c.caja && !c.stand;
  }

  grupos(): Grupo[] {
    const visto = new Uint8Array(TOTAL);
    const out: Grupo[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const c = this.celdas[i];
      if (visto[i] || !this.emparejable(c)) continue;
      const cola = [i];
      visto[i] = 1;
      const celdas: number[] = [];
      while (cola.length) {
        const a = cola.pop() as number;
        celdas.push(a);
        for (const b of this.vecinos(a)) {
          const cb = this.celdas[b];
          if (!visto[b] && this.emparejable(cb) && cb.tipo === c.tipo) {
            visto[b] = 1;
            cola.push(b);
          }
        }
      }
      if (celdas.length >= REGLAS.minGrupo) {
        celdas.sort((p, q) => p - q);
        const xs = celdas.map((k) => k % N), ys = celdas.map((k) => Math.floor(k / N));
        const caja = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        const rect = (caja.x1 - caja.x0 + 1) * (caja.y1 - caja.y0 + 1) === celdas.length;
        out.push({ tipo: c.tipo, celdas, ids: celdas.map((k) => this.celdas[k].id), caja, rect });
      }
    }
    return out;
  }

  puedeMover(idx: number): boolean {
    const c = this.celdas[idx];
    return c.bloque === 0 && !c.congelada && !c.stand;
  }

  /** Cambia dos celdas de sitio (lo que pasa cuando arrastras una ficha sobre otra). */
  intercambiar(a: number, b: number): boolean {
    if (a === b || !this.puedeMover(a) || !this.puedeMover(b)) return false;
    const t = this.celdas[a];
    this.celdas[a] = this.celdas[b];
    this.celdas[b] = t;
    return true;
  }

  private danoDe(c: Celda): number {
    const delEquipo = c.tipo === this.equipo[0] ? this.atqEquipo[0] : c.tipo === this.equipo[1] ? this.atqEquipo[1] : -1;
    let d = REGLAS.danoBase + (delEquipo >= 0 ? delEquipo * REGLAS.danoEquipo : 0);
    if (c.reforzada) d *= REGLAS.reforzada;
    return d;
  }

  multCombo(): number {
    return Math.min(REGLAS.multMaxCombo, 1 + this.combo * REGLAS.multPorCombo);
  }

  /** Cuanto dura la ventana del combo en este momento. */
  ventanaCombo(): number {
    return Math.max(REGLAS.ventanaMin, REGLAS.ventanaBase - this.combo * REGLAS.ventanaPorCombo);
  }

  /** Multiplicador por el tamaño de un grupo. */
  multTamano(n: number): number {
    const t = REGLAS.porTamano;
    return t[Math.min(n, t.length - 1)] || 1;
  }

  private danoGrupo(g: Grupo, mult: number, furia: number): number {
    let d = 0;
    for (const i of g.celdas) d += this.danoDe(this.celdas[i]);
    return d * this.multTamano(g.celdas.length) * mult * furia;
  }

  /** Borra todos los grupos, deja caer y rellena, y repite hasta que no quede ninguno. Devuelve los pasos para dibujarlos. */
  resolver(furia = 1): Paso[] {
    const pasos: Paso[] = [];
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      const gs = this.grupos();
      if (!gs.length) break;
      if (this.modoStand) {
        pasos.push(this.pasoStand(gs, furia));
        break;
      }
      pasos.push(...this.borrarGrupos(gs, furia));
    }
    return pasos;
  }

  private pasoStand(gs: Grupo[], furia: number): Paso {
    this.combo += gs.length;
    const mult = this.multCombo();
    let dano = 0;
    const ids: number[] = [];
    const cargas: Record<number, number> = {};
    for (const g of gs) {
      dano += this.danoGrupo(g, mult, furia);
      for (const i of g.celdas) {
        const c = this.celdas[i];
        c.stand = true;
        ids.push(c.id);
        cargas[c.tipo] = (cargas[c.tipo] ?? 0) + (c.reforzada ? REGLAS.cargaReforzada : 1);
      }
    }
    this.pozoStand += dano;
    return { k: "borrar", ids: [], grupos: gs, combo: this.combo, mult, dano: 0, cargas, cajas: [], rotos: [], golpeados: ids };
  }

  private borrarGrupos(gs: Grupo[], furia: number): Paso[] {
    this.combo += gs.length;
    const mult = this.multCombo();
    let dano = 0;
    const ids: number[] = [];
    const cargas: Record<number, number> = {};
    const aBorrar = new Set<number>();
    const cajas: { id: number; idx: number }[] = [];
    for (const g of gs) {
      dano += this.danoGrupo(g, mult, furia);
      for (const i of g.celdas) {
        const c = this.celdas[i];
        cargas[c.tipo] = (cargas[c.tipo] ?? 0) + (c.reforzada ? REGLAS.cargaReforzada : 1);
        aBorrar.add(i);
      }
      if (g.celdas.length >= REGLAS.minCaja) {
        const donde = g.celdas[Math.floor(this.rng() * g.celdas.length)];
        cajas.push({ id: -1, idx: donde });
      }
    }
    // Los bloques pegados a un grupo reciben un golpe.
    const golpeados: number[] = [];
    const rotos: number[] = [];
    const tocados = new Set<number>();
    for (const i of aBorrar) for (const v of this.vecinos(i)) if (this.celdas[v].bloque > 0) tocados.add(v);
    for (const v of tocados) {
      const c = this.celdas[v];
      c.bloque -= 1;
      golpeados.push(c.id);
      if (c.bloque <= 0) {
        rotos.push(c.id);
        aBorrar.add(v);
      }
    }
    // Las cajas se crean en una de las celdas del grupo: esa celda no se borra, se convierte en caja.
    for (const cj of cajas) {
      aBorrar.delete(cj.idx);
      const c = this.celdas[cj.idx];
      c.caja = true;
      c.reforzada = false;
      cj.id = c.id;
    }
    for (const i of aBorrar) ids.push(this.celdas[i].id);
    const pasos: Paso[] = [{ k: "borrar", ids, grupos: gs, combo: this.combo, mult, dano, cargas, cajas, rotos, golpeados }];
    for (const i of aBorrar) this.celdas[i] = null as unknown as Celda;
    pasos.push(...this.gravedad());
    return pasos;
  }

  /** Cae lo que tiene un hueco debajo y entran fichas nuevas por arriba. */
  gravedad(): Paso[] {
    const mov: { id: number; de: number; a: number }[] = [];
    const nuevas: { id: number; idx: number; tipo: number; desde: number }[] = [];
    for (let x = 0; x < N; x++) {
      const columna: Celda[] = [];
      const origen: number[] = [];
      for (let y = N - 1; y >= 0; y--) {
        const c = this.celdas[y * N + x];
        if (c) {
          columna.push(c);
          origen.push(y * N + x);
        }
      }
      const faltan = N - columna.length;
      for (let k = 0; k < columna.length; k++) {
        const y = N - 1 - k;
        const idx = y * N + x;
        this.celdas[idx] = columna[k];
        if (origen[k] !== idx) mov.push({ id: columna[k].id, de: origen[k], a: idx });
      }
      for (let k = 0; k < faltan; k++) {
        const y = faltan - 1 - k;
        const idx = y * N + x;
        const c = this.nueva();
        this.celdas[idx] = c;
        nuevas.push({ id: c.id, idx, tipo: c.tipo, desde: -(k + 1) * N + x });
      }
    }
    const pasos: Paso[] = [];
    if (mov.length) pasos.push({ k: "caer", mov });
    if (nuevas.length) pasos.push({ k: "entrar", nuevas });
    return pasos;
  }

  /** Tocar una Caja borra cinco fichas en cruz. */
  tocarCaja(idx: number): Paso[] {
    const c = this.celdas[idx];
    if (!c || !c.caja) return [];
    const idxs = [idx, ...this.vecinos(idx)];
    const ids: number[] = [];
    let dano = 0;
    this.combo += 1;
    const mult = this.multCombo();
    const cargas: Record<number, number> = {};
    for (const i of idxs) {
      const x = this.celdas[i];
      if (x.bloque > 0) continue;
      dano += this.danoDe(x) * mult;
      cargas[x.tipo] = (cargas[x.tipo] ?? 0) + 1;
      ids.push(x.id);
      this.celdas[i] = null as unknown as Celda;
    }
    const pasos: Paso[] = [{ k: "borrar", ids, grupos: [], combo: this.combo, mult, dano, cargas, cajas: [], rotos: [], golpeados: [] }];
    pasos.push(...this.gravedad());
    pasos.push(...this.resolver());
    return pasos;
  }

  reiniciarCombo(): void {
    this.combo = 0;
  }

  /* --- Stand Up Time --- */
  entrarStand(): void {
    this.modoStand = true;
    this.pozoStand = 0;
  }

  /** Cuenta los cuadrados de 2x2 que forman las fichas de pie. Cada uno multiplica el estallido. */
  cuadradosStand(): number {
    let n = 0;
    for (let y = 0; y < N - 1; y++)
      for (let x = 0; x < N - 1; x++) {
        const a = y * N + x;
        if (this.celdas[a].stand && this.celdas[a + 1].stand && this.celdas[a + N].stand && this.celdas[a + N + 1].stand) n++;
      }
    return n;
  }

  salirStand(): Paso[] {
    this.modoStand = false;
    const cuadrados = this.cuadradosStand();
    const ids: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const c = this.celdas[i];
      if (c.stand) {
        ids.push(c.id);
        this.celdas[i] = null as unknown as Celda;
      }
    }
    const dano = this.pozoStand * (1 + cuadrados * 0.5);
    this.pozoStand = 0;
    const pasos: Paso[] = [{ k: "estallar", ids, dano, cuadrados }];
    pasos.push(...this.gravedad());
    pasos.push(...this.resolver());
    return pasos;
  }

  /** Lo que hace un jefe: pone bloques (con la vida que se le diga) sobre fichas normales. */
  ponerBloques(n: number, vida: number): Paso {
    const cand = this.indicesDe((c) => c.bloque === 0 && !c.caja && !c.stand);
    const elegidos: number[] = [];
    while (elegidos.length < n && cand.length) elegidos.push(cand.splice(Math.floor(this.rng() * cand.length), 1)[0]);
    elegidos.forEach((i) => (this.celdas[i].bloque = vida));
    return { k: "poner", bloques: elegidos.map((i) => ({ id: this.celdas[i].id, idx: i, vida })) };
  }

  /** Congela o mancha de tinta algunas fichas normales. */
  ponerEstado(n: number, que: "congelada" | "tinta"): Paso {
    const cand = this.indicesDe((c) => c.bloque === 0 && !c.caja && !c.stand && !c[que]);
    const elegidos: number[] = [];
    while (elegidos.length < n && cand.length) elegidos.push(cand.splice(Math.floor(this.rng() * cand.length), 1)[0]);
    elegidos.forEach((i) => (this.celdas[i][que] = true));
    return { k: "estado", ids: elegidos.map((i) => this.celdas[i].id), que, valor: true };
  }

  /** Cuenta fichas por tipo (solo las normales). */
  conteo(): number[] {
    const r = new Array(this.tipos).fill(0);
    for (const c of this.celdas) if (c && c.bloque === 0 && !c.caja) r[c.tipo]++;
    return r;
  }

  indicesDe(pred: (c: Celda) => boolean): number[] {
    const r: number[] = [];
    this.celdas.forEach((c, i) => {
      if (c && pred(c)) r.push(i);
    });
    return r;
  }
}
