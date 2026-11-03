/* La habilidad de lider: se dispara sola cuando se cumple una condicion. Logica pura (sin Phaser) para poder probarla en Node.
   Solo cuenta la del primer personaje del equipo. Hay condiciones que se mantienen (mientras se cumplen, el efecto esta puesto)
   y condiciones que saltan una vez (el efecto se aplica en ese momento). */

export type Disparo =
  | { t: "siempre" }
  | { t: "stand" }
  | { t: "vidaMenor"; v: number }
  | { t: "tiempoMenor"; v: number }
  | { t: "inicio" }
  | { t: "cada"; s: number }
  | { t: "puntos"; v: number }
  | { t: "combo"; v: number }
  | { t: "grupo"; v: number };

export type Efecto =
  /** Dano extra: pct es 0.25 para +25 %. En condiciones puntuales dura s segundos. */
  | { t: "ataque"; pct: number; s?: number }
  /** Las fichas que se borran cargan mas rapido las habilidades (solo en condiciones que se mantienen). */
  | { t: "cargaMult"; pct: number }
  /** Suma pct a los dos medidores de habilidad (0.3 = un 30 % del medidor). */
  | { t: "carga"; pct: number }
  | { t: "tiempo"; s: number }
  | { t: "stand"; pct: number }
  | { t: "combo"; n: number }
  | { t: "convertir"; n: number };

export interface Lider {
  nombre: string;
  texto: string;
  disparo: Disparo;
  efecto: Efecto;
}

export interface Contexto {
  puntos: number;
  combo: number;
  /** Vida del jefe de 0 a 1. */
  vidaFrac: number;
  tiempoRestante: number;
  tiempoJugado: number;
  stand: boolean;
}

export interface Resultado {
  /** Multiplicador de dano (1 = nada). */
  ataque: number;
  /** Multiplicador de carga ganada (1 = nada). */
  cargaMult: number;
  /** Efectos que saltan ahora mismo. */
  unicos: Efecto[];
  /** Cierto cuando una condicion que se mantiene acaba de empezar. */
  recienActivo: boolean;
}

const CONTINUAS = new Set(["siempre", "stand", "vidaMenor", "tiempoMenor"]);

export class MotorLider {
  private activo = false;
  private inicioHecho = false;
  private ultimoCada = 0;
  private escalonPuntos = 0;
  private comboVisto = false;
  private buffT = 0;
  private buffPct = 0;
  private pendiente: Efecto[] = [];

  readonly lider: Lider | undefined;

  constructor(lider: Lider | undefined) {
    this.lider = lider;
  }

  /** Avisa de que se ha borrado un grupo de n fichas. */
  alGrupo(n: number): void {
    const l = this.lider;
    if (l && l.disparo.t === "grupo" && n >= l.disparo.v) this.disparar(l.efecto);
  }

  private disparar(e: Efecto): void {
    if (e.t === "ataque") { this.buffT = e.s ?? 5; this.buffPct = e.pct; }
    this.pendiente.push(e);
  }

  actualizar(dt: number, c: Contexto): Resultado {
    const l = this.lider;
    const r: Resultado = { ataque: 1, cargaMult: 1, unicos: [], recienActivo: false };
    if (!l) return r;
    const d = l.disparo;
    if (CONTINUAS.has(d.t)) {
      const ahora = d.t === "siempre" || (d.t === "stand" && c.stand) || (d.t === "vidaMenor" && c.vidaFrac < d.v) || (d.t === "tiempoMenor" && c.tiempoRestante < d.v && c.tiempoRestante > 0);
      if (ahora && !this.activo) r.recienActivo = true;
      this.activo = ahora;
      if (ahora) {
        if (l.efecto.t === "ataque") r.ataque += l.efecto.pct;
        else if (l.efecto.t === "cargaMult") r.cargaMult += l.efecto.pct;
      }
    } else {
      if (d.t === "inicio" && !this.inicioHecho && c.tiempoJugado > 0.4) { this.inicioHecho = true; this.disparar(l.efecto); }
      else if (d.t === "cada" && !c.stand && c.tiempoJugado - this.ultimoCada >= d.s) { this.ultimoCada = c.tiempoJugado; this.disparar(l.efecto); }
      else if (d.t === "puntos") {
        const escalon = Math.floor(c.puntos / d.v);
        if (escalon > this.escalonPuntos) { this.escalonPuntos = escalon; this.disparar(l.efecto); }
      } else if (d.t === "combo") {
        if (c.combo >= d.v && !this.comboVisto) { this.comboVisto = true; this.disparar(l.efecto); }
        else if (c.combo < d.v) this.comboVisto = false;
      }
      if (this.buffT > 0) { this.buffT -= dt; r.ataque += this.buffPct; }
    }
    r.unicos = this.pendiente;
    this.pendiente = [];
    return r;
  }
}
