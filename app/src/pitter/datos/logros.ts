import type { Estado } from "../estado.ts";
import { JEFES } from "./campana.ts";
import { personajesVisibles } from "./roster.ts";

export interface Logro {
  id: string;
  nombre: string;
  texto: string;
  progreso(e: Estado): { actual: number; meta: number };
}

const colocados = (e: Estado): number => e.habitaciones.reduce((s, h) => s + h.muebles.length, 0);

export const LOGROS: Logro[] = [
  { id: "primera", nombre: "Primera victoria", texto: "Derrota a un jefe.", progreso: (e) => ({ actual: e.stats.victorias, meta: 1 }) },
  { id: "cinco", nombre: "Constante", texto: "Gana 5 partidas.", progreso: (e) => ({ actual: e.stats.victorias, meta: 5 }) },
  { id: "combo15", nombre: "En racha", texto: "Haz un combo de 15.", progreso: (e) => ({ actual: e.stats.mejorCombo, meta: 15 }) },
  { id: "combo30", nombre: "Imparable", texto: "Haz un combo de 30.", progreso: (e) => ({ actual: e.stats.mejorCombo, meta: 30 }) },
  { id: "estrellas", nombre: "De tres en tres", texto: "Consigue 3 estrellas en 3 jefes.", progreso: (e) => ({ actual: Object.values(e.records).filter((r) => r.estrellas >= 3).length, meta: 3 }) },
  { id: "jefes", nombre: "Cazador de jefes", texto: "Derrota a todos los jefes.", progreso: (e) => ({ actual: e.jefesSuperados.length, meta: JEFES.length }) },
  { id: "album", nombre: "Álbum completo", texto: "Reúne a todos los personajes.", progreso: (e) => ({ actual: e.desbloqueados.length, meta: personajesVisibles().length }) },
  { id: "stand", nombre: "De pie", texto: "Activa el Stand Up Time 10 veces.", progreso: (e) => ({ actual: e.stats.standUp, meta: 10 }) },
  { id: "habilidades", nombre: "Con poderes", texto: "Usa 25 habilidades.", progreso: (e) => ({ actual: e.stats.habilidades, meta: 25 }) },
  { id: "fichas", nombre: "Mil fichas", texto: "Borra 1000 fichas.", progreso: (e) => ({ actual: e.stats.fichas, meta: 1000 }) },
  { id: "decorador", nombre: "Manitas", texto: "Coloca 8 muebles en tus habitaciones.", progreso: (e) => ({ actual: colocados(e), meta: 8 }) },
];
