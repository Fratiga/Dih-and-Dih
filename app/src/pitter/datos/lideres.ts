/* La habilidad de lider de cada personaje. Solo cuenta la del que va primero en el equipo, y se dispara sola al cumplirse su condicion.
   La logica esta en motor/lider.ts; aqui solo estan los datos y lo que lee el jugador. */

import type { Lider } from "../motor/lider.ts";

export const LIDERES: Record<string, Lider> = {
  "bull": { nombre: "Muro firme", texto: "Siempre, el daño sube un 12 %.", disparo: { t: "siempre" }, efecto: { t: "ataque", pct: 0.12 } },
  "garra": { nombre: "Primer lance", texto: "Al empezar, los dos medidores de habilidad se llenan un 30 %.", disparo: { t: "inicio" }, efecto: { t: "carga", pct: 0.3 } },
  "baraja": { nombre: "Mano ganadora", texto: "Al llegar a 6 de combo, gana 2 segundos.", disparo: { t: "combo", v: 6 }, efecto: { t: "tiempo", s: 2 } },
  "ocevat": { nombre: "El refugio resiste", texto: "Con menos de 15 segundos, el daño sube un 25 %.", disparo: { t: "tiempoMenor", v: 15 }, efecto: { t: "ataque", pct: 0.25 } },
  "verdam": { nombre: "Presa herida", texto: "Con el jefe por debajo del 40 %, el daño sube un 30 %.", disparo: { t: "vidaMenor", v: 0.4 }, efecto: { t: "ataque", pct: 0.3 } },
  "gareth": { nombre: "Última ronda", texto: "Cada 25 segundos, el medidor de Stand Up sube un 12 %.", disparo: { t: "cada", s: 25 }, efecto: { t: "stand", pct: 0.12 } },
  "ceniza-coronada": { nombre: "Tributo", texto: "Cada 1.500 puntos, 4 fichas al azar pasan a ser de su personaje.", disparo: { t: "puntos", v: 1500 }, efecto: { t: "convertir", n: 4 } },
  "rook": { nombre: "Un solo golpe", texto: "Con un grupo de 6 o más, el daño sube un 40 % durante 4 segundos.", disparo: { t: "grupo", v: 6 }, efecto: { t: "ataque", pct: 0.4, s: 4 } },
  "dagren": { nombre: "Cada golpe cuenta", texto: "Durante el Stand Up Time, el daño sube un 35 %.", disparo: { t: "stand" }, efecto: { t: "ataque", pct: 0.35 } },
  "sir-buffolet": { nombre: "Conjuro de suerte", texto: "Cada 18 segundos, 5 fichas al azar pasan a ser de su personaje.", disparo: { t: "cada", s: 18 }, efecto: { t: "convertir", n: 5 } },
  "edge": { nombre: "Filo", texto: "Al llegar a 8 de combo, el medidor de Stand Up sube un 14 %.", disparo: { t: "combo", v: 8 }, efecto: { t: "stand", pct: 0.14 } },
  "torvrena": { nombre: "Trampa preparada", texto: "Al empezar, el medidor de Stand Up sube un 25 %.", disparo: { t: "inicio" }, efecto: { t: "stand", pct: 0.25 } },
  "ryn": { nombre: "Informante", texto: "Cada 30 segundos, los dos medidores de habilidad suben un 20 %.", disparo: { t: "cada", s: 30 }, efecto: { t: "carga", pct: 0.2 } },
  "hooey-magoo": { nombre: "Por unas monedas", texto: "Cada 2.500 puntos, gana 4 segundos.", disparo: { t: "puntos", v: 2500 }, efecto: { t: "tiempo", s: 4 } },
  "cassius-coldgrave": { nombre: "Palabrería", texto: "Con un grupo de 5 o más, los medidores suben un 15 %.", disparo: { t: "grupo", v: 5 }, efecto: { t: "carga", pct: 0.15 } },
  "adam-kovacs": { nombre: "Orden clara", texto: "Siempre, las habilidades se cargan un 15 % más rápido.", disparo: { t: "siempre" }, efecto: { t: "cargaMult", pct: 0.15 } },
};

export function liderDe(id: string): Lider | undefined {
  return LIDERES[id];
}
