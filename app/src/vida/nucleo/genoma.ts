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
  /** 1 es lo normal. Las patas largas dan una criatura mas esbelta. */
  longitudPata?: number;
  grosorPata?: number;
  /** 0 orejas muy caidas, 1 mas erguidas. */
  caidaOrejas?: number;
  tamanoCabeza?: number;
  tamanoOjos?: number;
}

export type CuerpoCompleto = Required<Cuerpo>;

/** El cuerpo con todos sus campos (los genomas guardados antes de ampliarlo no traen los nuevos). */
export function cuerpoDe(g: Genoma): CuerpoCompleto {
  const c = g.cuerpo;
  return { ...c, longitudPata: c.longitudPata ?? 1, grosorPata: c.grosorPata ?? 1, caidaOrejas: c.caidaOrejas ?? 0.7, tamanoCabeza: c.tamanoCabeza ?? 1.05, tamanoOjos: c.tamanoOjos ?? 1.05 };
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
    cuerpo: { tono: u(150, 230), tamano: u(0.92, 1.08), orejas: r.next(), cola: r.next(), patas: u(0.4, 0.9), ojos: u(0.5, 1), motas: r.next(), longitudPata: u(0.9, 1.1), grosorPata: u(0.95, 1.2), caidaOrejas: u(0.45, 0.95), tamanoCabeza: u(1, 1.18), tamanoOjos: u(1, 1.15) },
  };
}

/** Una copia exacta: el gemelo. */
export function clonarGenoma(g: Genoma): Genoma {
  return JSON.parse(JSON.stringify(g)) as Genoma;
}

const limita = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Un gen numerico del hijo: sale de uno de los padres, o de una mezcla de los dos, y a veces cambia un poco. */
function gen(r: Azar, a: number, b: number, lo: number, hi: number, mut = 0.04): number {
  const u = r.next();
  let v = u < 0.4 ? a : u < 0.8 ? b : (a + b) / 2;
  if (r.next() < 0.2) v += r.gauss() * mut * (hi - lo);
  return limita(v, lo, hi);
}

/** El hijo de dos genomas: hereda predisposiciones (no recuerdos: eso lo vive cada uno), con mutaciones pequenas.
    Ningun gen sale de su rango, asi que las generaciones no se vuelven simplemente mas fuertes. */
export function cruzar(a: Genoma, b: Genoma, semilla: number): Genoma {
  const r = new Azar(semilla);
  const ca = cuerpoDe(a), cb = cuerpoDe(b);
  return {
    linaje: `${a.linaje.split("+")[0]}+${b.linaje.split("+")[0]}`,
    rasgos: a.rasgos.map((x, i) => gen(r, x, b.rasgos[i], 0.05, 0.95, 0.12)),
    semillaCerebro: Math.floor(r.next() * 4294967296),
    plasticidad: gen(r, a.plasticidad, b.plasticidad, 0.6, 1.5),
    memoria: gen(r, a.memoria, b.memoria, 0.6, 1.6),
    metabolismo: gen(r, a.metabolismo, b.metabolismo, 0.7, 1.4),
    vista: gen(r, a.vista, b.vista, 0.7, 1.4),
    olfato: gen(r, a.olfato, b.olfato, 0.7, 1.4),
    oido: gen(r, a.oido, b.oido, 0.7, 1.4),
    fuerza: gen(r, a.fuerza, b.fuerza, 0.7, 1.4),
    velocidad: gen(r, a.velocidad, b.velocidad, 0.7, 1.4),
    priorOlor: gen(r, a.priorOlor, b.priorOlor, 0.05, 0.35),
    cuerpo: {
      tono: gen(r, ca.tono, cb.tono, 100, 280, 0.1),
      tamano: gen(r, ca.tamano, cb.tamano, 0.8, 1.2),
      orejas: gen(r, ca.orejas, cb.orejas, 0, 1, 0.12),
      cola: gen(r, ca.cola, cb.cola, 0, 1, 0.12),
      patas: gen(r, ca.patas, cb.patas, 0.3, 1),
      ojos: gen(r, ca.ojos, cb.ojos, 0.4, 1),
      motas: gen(r, ca.motas, cb.motas, 0, 1, 0.12),
      longitudPata: gen(r, ca.longitudPata, cb.longitudPata, 0.8, 1.3),
      grosorPata: gen(r, ca.grosorPata, cb.grosorPata, 0.85, 1.3),
      caidaOrejas: gen(r, ca.caidaOrejas, cb.caidaOrejas, 0.3, 1),
      tamanoCabeza: gen(r, ca.tamanoCabeza, cb.tamanoCabeza, 0.9, 1.3),
      tamanoOjos: gen(r, ca.tamanoOjos, cb.tamanoOjos, 0.9, 1.3),
    },
  };
}
