/* Lo que Pitter-Patter recuerda del jugador: coleccion, equipos, mejoras, habitaciones, records, estadisticas y ajustes.
   Se guarda en este navegador y, cuando hay sesion, tambien en el servidor (guardado.ts). Nunca da ventajas en las partidas de rol. */

import { personajesVisibles } from "./datos/roster.ts";
import { JEFES } from "./datos/campana.ts";

export interface Record_ {
  puntos: number;
  mejorTiempo: number;
  estrellas: number;
  combo: number;
}

export interface Mueble {
  id: string;
  x: number;
  y: number;
}

export interface Habitacion {
  fondo: string;
  muebles: Mueble[];
  residentes: string[];
}

export interface Ajustes {
  musica: number;
  efectos: number;
  silencioMusica: boolean;
  silencioEfectos: boolean;
  calidad: "alta" | "media" | "baja";
  movimientoReducido: boolean;
}

export interface Estado {
  v: 1;
  desbloqueados: string[];
  /** Nivel de cada personaje (sube al repetir): da un poco mas de carga a su habilidad, nada mas. */
  niveles: Record<string, number>;
  equipo: [string, string];
  equipos: { nombre: string; ids: [string, string] }[];
  jefesSuperados: string[];
  records: Record<string, Record_>;
  premiosCobrados: string[];
  habitaciones: Habitacion[];
  muebles: string[];
  ajustes: Ajustes;
  stats: { partidas: number; victorias: number; derrotas: number; combos: number; mejorCombo: number; fichas: number; habilidades: number; standUp: number; tiempo: number; regalos: number };
  vistos: string[];
  /** Dia (UTC) del ultimo regalo abierto. */
  regaloDia: string;
  /** El personaje que se ve en el menu (se elige en la habitacion con la estrella). */
  favorito: string;
  /** Donde se quedo la mansion: el piso que se mira y el sector que mira al frente en cada piso. */
  mansion: { piso: number; sector: number[] };
  actualizado: number;
}

const CLAVE = "pitterEstado";

export function estadoInicial(): Estado {
  const vis = personajesVisibles();
  const primeros = vis.slice(0, 2).map((p) => p.id);
  return {
    v: 1,
    desbloqueados: primeros,
    niveles: {},
    equipo: [primeros[0] ?? "bull", primeros[1] ?? "garra"],
    equipos: [],
    jefesSuperados: [],
    records: {},
    premiosCobrados: [],
    habitaciones: [{ fondo: "rombos", muebles: [], residentes: primeros }],
    muebles: ["cama", "mesa", "planta", "lampara"],
    ajustes: { musica: 0.6, efectos: 0.8, silencioMusica: false, silencioEfectos: false, calidad: "alta", movimientoReducido: false },
    stats: { partidas: 0, victorias: 0, derrotas: 0, combos: 0, mejorCombo: 0, fichas: 0, habilidades: 0, standUp: 0, tiempo: 0, regalos: 0 },
    vistos: [],
    regaloDia: "",
    favorito: "",
    mansion: { piso: 0, sector: new Array(PISOS).fill(0) },
    actualizado: 0,
  };
}

function fusionar(base: Estado, guardado: Partial<Estado>): Estado {
  return {
    ...base,
    ...guardado,
    ajustes: { ...base.ajustes, ...(guardado.ajustes ?? {}) },
    stats: { ...base.stats, ...(guardado.stats ?? {}) },
  } as Estado;
}

export function cargar(): Estado {
  const base = estadoInicial();
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return base;
    const e = fusionar(base, JSON.parse(crudo) as Partial<Estado>);
    // Un personaje que ya no se ve (otro Side) no cuenta
    const visibles = new Set(personajesVisibles().map((p) => p.id));
    e.desbloqueados = e.desbloqueados.filter((id) => visibles.has(id));
    if (e.desbloqueados.length < 2) e.desbloqueados = base.desbloqueados;
    if (!e.desbloqueados.includes(e.equipo[0]) || !e.desbloqueados.includes(e.equipo[1]) || e.equipo[0] === e.equipo[1]) e.equipo = [e.desbloqueados[0], e.desbloqueados[1]];
    asegurarHabitaciones(e);
    return e;
  } catch {
    return base;
  }
}

export function guardarLocal(e: Estado): void {
  e.actualizado = Date.now();
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* sin almacenamiento: se juega igual */
  }
}

/** Dos personajes nuevos por cada jefe superado, en el orden del album y solo de los que ve este jugador. */
export function personajesPorDesbloquear(e: Estado): string[] {
  return personajesVisibles().map((p) => p.id).filter((id) => !e.desbloqueados.includes(id));
}

export function desbloquearPorJefe(e: Estado, jefeId: string): string[] {
  if (e.jefesSuperados.includes(jefeId)) return [];
  e.jefesSuperados.push(jefeId);
  const nuevos = personajesPorDesbloquear(e).slice(0, 2);
  e.desbloqueados.push(...nuevos);
  return nuevos;
}

/* La mansion: 4 pisos de 6 sectores (24 habitaciones). La habitacion k es el piso k/6, sector k%6. La primera esta abierta y cada estrella abre otra. */
export const SECTORES = 6;
export const PISOS = 4;
export const TOTAL_SALAS = SECTORES * PISOS;
const TEMAS = ["rombos", "verde", "mandarina", "noche"];

export const estrellasParaSala = (k: number): number => k;
export function salasAbiertas(e: Estado): number {
  return Math.min(TOTAL_SALAS, 1 + estrellasTotales(e));
}

export function asegurarHabitaciones(e: Estado): boolean {
  let cambio = false;
  // Los fondos antiguos pasan al primer tema; hay como mucho 2 residentes por habitacion
  for (const h of e.habitaciones) {
    if (!TEMAS.includes(h.fondo)) { h.fondo = "rombos"; cambio = true; }
    if (h.residentes.length > 2) { h.residentes = h.residentes.slice(0, 2); cambio = true; }
  }
  const objetivo = salasAbiertas(e);
  for (let k = e.habitaciones.length; k < objetivo; k++) {
    e.habitaciones.push({ fondo: TEMAS[k % TEMAS.length], muebles: [], residentes: e.desbloqueados.filter((id) => !e.habitaciones.some((h) => h.residentes.includes(id))).slice(0, 2) });
    cambio = true;
  }
  if (!e.mansion || !Array.isArray(e.mansion.sector) || e.mansion.sector.length !== PISOS) { e.mansion = { piso: 0, sector: new Array(PISOS).fill(0) }; cambio = true; }
  return cambio;
}

export function nivelMansion(e: Estado): number {
  return 1 + e.jefesSuperados.length * 2 + Math.floor(estrellasTotales(e) / 2) + Math.floor(e.desbloqueados.length / 3);
}

export function estrellasTotales(e: Estado): number {
  return Object.values(e.records).reduce((s, r) => s + r.estrellas, 0);
}

export function proximoJefe(e: Estado): number {
  const i = JEFES.findIndex((j) => !e.jefesSuperados.includes(j.id));
  return i < 0 ? JEFES.length - 1 : i;
}
