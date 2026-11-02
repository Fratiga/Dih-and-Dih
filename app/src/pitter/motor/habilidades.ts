/* Lo que hace cada habilidad sobre el tablero. Devuelve los pasos para dibujarlos y los efectos que no son del tablero
   (tiempo, furia, medidor de Stand Up, combo, jefe aturdido). Los numeros salen de la ficha del personaje (datos/roster.ts). */

import { N, REGLAS, Tablero, type Paso } from "./tablero.ts";
import type { Verbo } from "../datos/roster.ts";

export interface Efectos {
  pasos: Paso[];
  tiempo: number;
  furia: { segundos: number; mult: number } | null;
  stand: number;
  combo: number;
  aturdir: number;
  nombre: string;
}

function vacio(nombre: string): Efectos {
  return { pasos: [], tiempo: 0, furia: null, stand: 0, combo: 0, aturdir: 0, nombre };
}

function masNumeroso(t: Tablero, excluir: number[] = []): number {
  const c = t.conteo();
  let mejor = -1;
  let n = -1;
  c.forEach((v, i) => {
    if (!excluir.includes(i) && v > n) {
      n = v;
      mejor = i;
    }
  });
  return mejor;
}

function aleatorio<T>(t: Tablero, lista: T[]): T {
  return lista[Math.floor(t.rng() * lista.length)];
}

/** Borra un conjunto de celdas como lo haria un grupo: con su dano, su carga, su caida y lo que se forme despues. */
function borrarIndices(t: Tablero, idxs: number[]): Paso[] {
  const unicos = [...new Set(idxs)].filter((i) => t.celdas[i]);
  if (!unicos.length) return [];
  t.combo += 1;
  const mult = Math.min(REGLAS.multMaxCombo, 1 + t.combo * REGLAS.multPorCombo);
  let dano = 0;
  const ids: number[] = [];
  const rotos: number[] = [];
  const cargas: Record<number, number> = {};
  for (const i of unicos) {
    const c = t.celdas[i];
    if (c.bloque > 0) {
      rotos.push(c.id);
    } else {
      const delEquipo = c.tipo === t.equipo[0] ? t.atqEquipo[0] : c.tipo === t.equipo[1] ? t.atqEquipo[1] : 0;
      let d = REGLAS.danoBase + delEquipo * REGLAS.danoEquipo;
      if (c.reforzada) d *= REGLAS.reforzada;
      dano += d * mult;
      cargas[c.tipo] = (cargas[c.tipo] ?? 0) + 1;
    }
    ids.push(c.id);
  }
  const pasos: Paso[] = [{ k: "borrar", ids, grupos: [], combo: t.combo, mult, dano, cargas, cajas: [], rotos, golpeados: [] }];
  for (const i of unicos) t.celdas[i] = null as unknown as never;
  pasos.push(...t.gravedad());
  pasos.push(...t.resolver());
  return pasos;
}

function fila(i: number): number {
  return Math.floor(i / N);
}
function col(i: number): number {
  return i % N;
}

export function usarHabilidad(t: Tablero, verbo: Verbo, n: number, miTipo: number, nombre: string): Efectos {
  const e = vacio(nombre);
  switch (verbo) {
    case "convertirAzar": {
      const cand = t.indicesDe((c) => c.bloque === 0 && !c.caja && c.tipo !== miTipo);
      const elegidos: number[] = [];
      while (elegidos.length < n && cand.length) elegidos.push(cand.splice(Math.floor(t.rng() * cand.length), 1)[0]);
      e.pasos.push({ k: "convertir", cambios: elegidos.map((i) => ({ id: t.celdas[i].id, tipo: miTipo })) });
      elegidos.forEach((i) => (t.celdas[i].tipo = miTipo));
      e.pasos.push(...t.resolver());
      break;
    }
    case "borrarColumna": {
      const tipo = masNumeroso(t);
      let mejor = 0;
      let mejorN = -1;
      for (let x = 0; x < N; x++) {
        let k = 0;
        for (let y = 0; y < N; y++) if (t.celdas[y * N + x].tipo === tipo && t.celdas[y * N + x].bloque === 0) k++;
        if (k > mejorN) {
          mejorN = k;
          mejor = x;
        }
      }
      e.pasos.push({ k: "efecto", nombre: "columna", ids: Array.from({ length: N }, (_, y) => t.celdas[y * N + mejor].id) });
      e.pasos.push(...borrarIndices(t, Array.from({ length: N }, (_, y) => y * N + mejor)));
      break;
    }
    case "barajar": {
      const movibles = t.indicesDe((c) => c.bloque === 0 && !c.congelada);
      const destinos = [...movibles];
      for (let i = destinos.length - 1; i > 0; i--) {
        const j = Math.floor(t.rng() * (i + 1));
        [destinos[i], destinos[j]] = [destinos[j], destinos[i]];
      }
      const viejas = movibles.map((i) => t.celdas[i]);
      const mov = movibles.map((de, k) => ({ id: viejas[k].id, de, a: destinos[k] }));
      destinos.forEach((a, k) => (t.celdas[a] = viejas[k]));
      e.pasos.push({ k: "barajar", mov });
      e.combo += n;
      e.pasos.push(...t.resolver());
      break;
    }
    case "tiempo":
      e.tiempo += n;
      e.pasos.push({ k: "efecto", nombre: "tiempo" });
      break;
    case "marcarTipo": {
      const tipo = masNumeroso(t);
      const idxs = t.indicesDe((c) => c.tipo === tipo && c.bloque === 0 && !c.caja);
      idxs.forEach((i) => (t.celdas[i].reforzada = true));
      e.pasos.push({ k: "reforzar", ids: idxs.map((i) => t.celdas[i].id) });
      break;
    }
    case "limpiar": {
      const idxs = t.indicesDe((c) => c.bloque > 0);
      const lim = t.indicesDe((c) => c.congelada || c.tinta);
      lim.forEach((i) => {
        t.celdas[i].congelada = false;
        t.celdas[i].tinta = false;
      });
      e.pasos.push({ k: "limpiarObstaculos", ids: [...idxs, ...lim].map((i) => t.celdas[i].id) });
      e.pasos.push(...borrarIndices(t, idxs));
      e.stand += n;
      break;
    }
    case "crearCajas": {
      const cand = t.indicesDe((c) => c.bloque === 0 && !c.caja);
      const elegidos: number[] = [];
      while (elegidos.length < n && cand.length) elegidos.push(cand.splice(Math.floor(t.rng() * cand.length), 1)[0]);
      elegidos.forEach((i) => {
        t.celdas[i].caja = true;
        t.celdas[i].reforzada = false;
      });
      e.pasos.push({ k: "crear", cajas: elegidos.map((i) => ({ id: t.celdas[i].id, idx: i })) });
      break;
    }
    case "cruz": {
      const centro = aleatorio(t, t.indicesDe((c) => c.bloque === 0));
      const idxs: number[] = [];
      for (let k = 0; k < N; k++) idxs.push(fila(centro) * N + k, k * N + col(centro));
      e.pasos.push({ k: "efecto", nombre: "cruz", ids: idxs.map((i) => t.celdas[i].id) });
      e.pasos.push(...borrarIndices(t, idxs));
      break;
    }
    case "furia":
      e.furia = { segundos: n, mult: 1.5 };
      e.combo += 4;
      e.pasos.push({ k: "efecto", nombre: "furia" });
      break;
    case "caos": {
      const tipos: number[] = [];
      t.conteo().forEach((v, i) => v > 0 && tipos.push(i));
      const tipo = aleatorio(t, tipos);
      const cand = t.indicesDe((c) => c.bloque === 0 && !c.caja && c.tipo !== tipo);
      const elegidos: number[] = [];
      while (elegidos.length < n && cand.length) elegidos.push(cand.splice(Math.floor(t.rng() * cand.length), 1)[0]);
      e.pasos.push({ k: "convertir", cambios: elegidos.map((i) => ({ id: t.celdas[i].id, tipo })) });
      elegidos.forEach((i) => (t.celdas[i].tipo = tipo));
      e.pasos.push(...t.resolver());
      break;
    }
    case "diagonales": {
      const centro = aleatorio(t, t.indicesDe((c) => c.bloque === 0));
      const idxs: number[] = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const dx = x - col(centro);
          const dy = y - fila(centro);
          if (dx === dy || dx === -dy) idxs.push(y * N + x);
        }
      e.pasos.push({ k: "efecto", nombre: "diagonales", ids: idxs.map((i) => t.celdas[i].id) });
      e.pasos.push(...borrarIndices(t, idxs));
      break;
    }
    case "aturdir":
      e.aturdir = n;
      e.pasos.push({ k: "efecto", nombre: "aturdir" });
      break;
    case "borrarTipo": {
      const tipo = masNumeroso(t);
      const idxs = t.indicesDe((c) => c.tipo === tipo && c.bloque === 0 && !c.caja);
      e.pasos.push({ k: "efecto", nombre: "tipo", ids: idxs.map((i) => t.celdas[i].id) });
      e.pasos.push(...borrarIndices(t, idxs));
      break;
    }
    case "sacrificio":
      e.tiempo -= n;
      e.stand += 60;
      e.combo += 5;
      e.pasos.push({ k: "efecto", nombre: "sacrificio" });
      break;
    case "fusionar": {
      const primero = masNumeroso(t);
      const segundo = masNumeroso(t, [primero]);
      if (segundo >= 0) {
        const idxs = t.indicesDe((c) => c.tipo === segundo && c.bloque === 0 && !c.caja);
        e.pasos.push({ k: "convertir", cambios: idxs.map((i) => ({ id: t.celdas[i].id, tipo: primero })) });
        idxs.forEach((i) => (t.celdas[i].tipo = primero));
        e.pasos.push(...t.resolver());
      }
      break;
    }
    case "reforzarEquipo": {
      const idxs = t.indicesDe((c) => (c.tipo === t.equipo[0] || c.tipo === t.equipo[1]) && c.bloque === 0 && !c.caja);
      idxs.forEach((i) => (t.celdas[i].reforzada = true));
      e.pasos.push({ k: "reforzar", ids: idxs.map((i) => t.celdas[i].id) });
      break;
    }
  }
  return e;
}
