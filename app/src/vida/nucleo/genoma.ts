/* Genoma: lo que una criatura trae de nacimiento. Dos criaturas con el mismo genoma empiezan igual, con los mismos pesos en la red
   y las mismas predisposiciones. Lo que despues las separa es lo que vivan. (La reproduccion y la mutacion llegan en una fase posterior.) */

import { Azar } from "./azar.ts";
import { RASGOS } from "./tipos.ts";

export interface Cuerpo {
  /** Tono de la piel, 0 a 360. */
  tono: number;
  tamano: number;
  orejas: number;
  cola: number;
  patas: number;
  ojos: number;
  motas: number;
}

export interface Genoma {
  linaje: string;
  /** Predisposicion de cada rasgo de personalidad, de 0 a 1, en el orden de RASGOS. */
  rasgos: number[];
  semillaCerebro: number;
  /** Con que rapidez cambia lo que sabe (0.6 a 1.5). */
  plasticidad: number;
  /** Cuanto dura un recuerdo (0.6 a 1.6). */
  memoria: number;
  metabolismo: number;
  vista: number;
  olfato: number;
  oido: number;
  fuerza: number;
  velocidad: number;
  /** Atraccion innata por lo que huele bien. Es lo unico que la criatura sabe de comida al nacer. */
  priorOlor: number;
  cuerpo: Cuerpo;
}

export function genomaNuevo(semilla: number, linaje = "L"): Genoma {
  const r = new Azar(semilla);
  const u = (a: number, b: number) => a + (b - a) * r.next();
  return {
    linaje,
    rasgos: RASGOS.map(() => u(0.25, 0.75)),
    semillaCerebro: Math.floor(r.next() * 4294967296),
    plasticidad: u(0.9, 1.1),
    memoria: u(0.9, 1.1),
    metabolismo: u(0.9, 1.1),
    vista: u(0.9, 1.1),
    olfato: u(0.9, 1.1),
    oido: u(0.9, 1.1),
    fuerza: u(0.9, 1.1),
    velocidad: u(0.9, 1.1),
    priorOlor: u(0.14, 0.24),
    cuerpo: { tono: u(150, 230), tamano: u(0.92, 1.08), orejas: r.next(), cola: r.next(), patas: u(0.4, 0.9), ojos: u(0.5, 1), motas: r.next() },
  };
}

/** Una copia exacta: el gemelo. */
export function clonarGenoma(g: Genoma): Genoma {
  return JSON.parse(JSON.stringify(g)) as Genoma;
}
