/* Tipos y constantes compartidas del nucleo de Vida Artificial. Nada aqui toca el navegador ni Phaser. */

/** Rasgos sensoriales que percibe una criatura de cada cosa, todos de 0 a 1. */
export const RASGO_SENSORIAL = ["redondez", "tamano", "brillo", "calidez", "verdor", "olor", "sonido", "movimiento", "vivo", "huella"] as const;
export const D = RASGO_SENSORIAL.length;
export const IDX = { redondez: 0, tamano: 1, brillo: 2, calidez: 3, verdor: 4, olor: 5, sonido: 6, movimiento: 7, vivo: 8, huella: 9 } as const;

/** Lo que una experiencia puede dejar. Son cantidades de lo que ocurrio, no de lo que la criatura sintio:
    cuanto le importe a cada una depende de sus necesidades en ese momento. */
export const CANALES = ["sacia", "dano", "diversion", "compania", "susto"] as const;
export const NC = CANALES.length;
export const C = { sacia: 0, dano: 1, diversion: 2, compania: 3, susto: 4 } as const;
export type Res = number[];
export const resCero = (): Res => new Array(NC).fill(0);

export type Verbo = "probar" | "empujar" | "tocar" | "acercarse" | "evitar" | "explorar" | "descansar" | "dormir";
export const VERBOS: readonly Verbo[] = ["probar", "empujar", "tocar", "acercarse", "evitar", "explorar", "descansar", "dormir"];
/** Verbos que se hacen sobre algo concreto y de los que se aprende que resulta de ellos. */
export const VERBOS_OBJETO: readonly Verbo[] = ["probar", "empujar", "tocar", "acercarse"];

export const RASGOS = ["curiosidad", "sociabilidad", "agresividad", "miedo", "apego", "persistencia", "territorialidad", "sensibilidad"] as const;
export type NombreRasgo = (typeof RASGOS)[number];
export const R = { curiosidad: 0, sociabilidad: 1, agresividad: 2, miedo: 3, apego: 4, persistencia: 5, territorialidad: 6, sensibilidad: 7 } as const;

export const EMOCIONES = ["miedo", "curiosidad", "frustracion", "apego", "excitacion"] as const;
export const E = { miedo: 0, curiosidad: 1, frustracion: 2, apego: 3, excitacion: 4 } as const;

export const NECESIDADES = ["hambre", "sueno", "dolor", "aburrimiento", "soledad"] as const;
export const N = { hambre: 0, sueno: 1, dolor: 2, aburrimiento: 3, soledad: 4 } as const;

/** Un dia de las criaturas, en segundos de simulacion. */
export const DIA = 1800;

export interface Percepto {
  /** Identificador de lo que se percibe (objeto o criatura). */
  id: number;
  /** Nombre legible (para la memoria que lee el jugador). */
  nombre: string;
  tipo: string;
  esCriatura: boolean;
  x: number;
  dist: number;
  /** Rasgos que se perciben. Los que no se distinguen desde lejos valen 0.5 y su peso es 0. */
  f: number[];
  /** Cuanto cuenta cada rasgo al comparar con lo ya vivido (0 donde no se distingue). */
  m: number[];
  cerca: boolean;
  /** Recordado, no visto ahora. */
  recordado: boolean;
}

export interface Resultado {
  res: Res;
  /** Si la cosa respondio de alguna manera (se movio, se activo, se comio). */
  efecto: boolean;
}

/** Que pasa cuando la salud llega a cero. Protegida: no baja de un minimo. Recuperable: queda tendida y puede reanimarse con cuidados. Permanente: muere. */
export type Mortalidad = "protegida" | "recuperable" | "permanente";
export const MORTALIDADES: readonly Mortalidad[] = ["protegida", "recuperable", "permanente"];
/** Segundos que una criatura tendida aguanta sin que nadie la cuide. */
export const TIEMPO_TENDIDA = 240;
