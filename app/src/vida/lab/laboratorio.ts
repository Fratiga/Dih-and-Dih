/* Laboratorio de pruebas (solo para desarrollo). Cada caso es un experimento con condiciones iniciales reproducibles: una semilla,
   unas criaturas, unos objetos y una duracion. Se ejecuta con varias semillas y siempre con un control (lo mismo sin el estimulo
   o sin la posibilidad social). Un caso no se aprueba porque salga bien una vez, sino porque sale bien en casi todas las semillas
   y la conducta es claramente menos probable en el control. */

import { Criatura } from "../nucleo/criatura.ts";
import { genomaNuevo, type Genoma } from "../nucleo/genoma.ts";
import { mezclar } from "../nucleo/azar.ts";
import { Simulacion, type ConfigSim } from "../nucleo/simulacion.ts";
import { type Verbo } from "../nucleo/tipos.ts";

export interface ResSemilla {
  semilla: number;
  ok: boolean;
  criterios: Record<string, boolean>;
  metricas: Record<string, number>;
  /** Cuantas acciones de cada tipo hizo la criatura estudiada (verbo:objeto). */
  acciones: Record<string, number>;
  /** Series de lo que iba aprendiendo, para ver la curva. */
  curvas: Record<string, { t: number; v: number }[]>;
  segundos: number;
}

export interface Caso {
  id: string;
  titulo: string;
  /** La hipotesis de comportamiento y que se espera ver. */
  hipotesis: string;
  /** Fraccion minima de semillas que deben cumplir todos los criterios. */
  minimo: number;
  ejecutar(semilla: number): ResSemilla;
}

export interface InformeCaso {
  id: string;
  titulo: string;
  semillas: number[];
  resultados: ResSemilla[];
  aprobadas: number;
  pasa: boolean;
  /** Por cada criterio, en cuantas semillas se cumplio. */
  porCriterio: Record<string, number>;
}

export function ejecutarCaso(caso: Caso, semillas: number[]): InformeCaso {
  const resultados = semillas.map((s) => caso.ejecutar(s));
  const aprobadas = resultados.filter((r) => r.ok).length;
  const porCriterio: Record<string, number> = {};
  for (const r of resultados) for (const [k, v] of Object.entries(r.criterios)) porCriterio[k] = (porCriterio[k] ?? 0) + (v ? 1 : 0);
  return { id: caso.id, titulo: caso.titulo, semillas, resultados, aprobadas, pasa: aprobadas / semillas.length >= caso.minimo, porCriterio };
}

export function genomaDe(semilla: number, variante = 0): Genoma {
  return genomaNuevo(mezclar(semilla, 100, variante), "lab");
}

/** Una simulacion de laboratorio: guarda todo el registro de acciones. */
export function nuevaSim(cfg: ConfigSim): Simulacion {
  const s = new Simulacion(cfg);
  for (const c of s.criaturas) c.capRegistro = 200000;
  return s;
}

/** Una copia de una simulacion en este instante, con otro azar: lo mismo vivido, pero cada replica decide con su propio azar. */
export function replica(s: Simulacion, k: number): Simulacion {
  const e = s.serializar();
  const r = Simulacion.restaurar(e);
  r.azar.s = mezclar(e.semilla, 777, k);
  r.mundo.azar.s = mezclar(e.semilla, 778, k);
  for (const c of r.criaturas) { c.azar.s = mezclar(e.semilla, 779, k, c.id); c.capRegistro = 200000; }
  return r;
}

export function impactos(c: Criatura, v: Verbo | null, tipo: string, t0 = 0, t1 = Infinity, filtro?: (res: number[]) => boolean): number {
  let n = 0;
  for (const r of c.registro) {
    if (r.kind !== "impacto" || r.t < t0 || r.t >= t1) continue;
    if (v && r.v !== v) continue;
    if (tipo && r.tipo !== tipo) continue;
    if (filtro && !filtro(r.res ?? [])) continue;
    n++;
  }
  return n;
}

export function conteoAcciones(c: Criatura): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of c.registro) if (r.kind === "impacto") o[`${r.v}:${r.tipo}`] = (o[`${r.v}:${r.tipo}`] ?? 0) + 1;
  return o;
}

/** Avanza la simulacion midiendo una sonda cada `cada` segundos. */
export function avanzarMuestreando(s: Simulacion, segundos: number, cada: number, sonda: () => number): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  const n = Math.round(segundos / cada);
  for (let i = 0; i < n; i++) {
    s.avanzar(cada);
    out.push({ t: s.t, v: sonda() });
  }
  return out;
}

export const media = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
export const mediana = (v: number[]): number => {
  if (!v.length) return 0;
  const s = v.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function tablaInforme(inf: InformeCaso): string {
  const lineas = [`${inf.id} ${inf.titulo}: ${inf.aprobadas}/${inf.semillas.length} semillas ${inf.pasa ? "APRUEBA" : "NO APRUEBA"}`];
  for (const [k, n] of Object.entries(inf.porCriterio)) lineas.push(`   ${n}/${inf.semillas.length}  ${k}`);
  return lineas.join("\n");
}
