/* Lo que pasa cuando dos personajes forman equipo. Son pequeñas ventajas dentro del puzzle: nunca tocan las reglas del rol. */
import type { Afinidad, Personaje } from "./roster.ts";

export interface Sinergia {
  nombre: string;
  texto: string;
  /** Multiplica lo que cuesta cargar las habilidades (menos de 1 = se cargan antes). */
  carga: number;
  /** Multiplica lo que llena el medidor de Stand Up Time. */
  stand: number;
  /** "especial" tiene presentacion propia en la pantalla de equipo. */
  tipo: "ninguna" | "afinidad" | "complemento" | "especial";
}

const COMADREJAS = ["bull", "garra", "baraja", "rook"];
const ESPECIALES: { ids: [string, string]; nombre: string; texto: string; carga: number; stand: number }[] = [
  { ids: ["ocevat", "verdam"], nombre: "Los del refugio", texto: "Llegaron juntos cuando ya nadie esperaba ayuda. Las habilidades se cargan un 20 % antes y el Stand Up Time un 20 % más rápido.", carga: 0.8, stand: 1.2 },
  { ids: ["torvrena", "cassius-coldgrave"], nombre: "Contratados", texto: "Uno cobra por cazar y el otro por no huir. El Stand Up Time se llena un 30 % más rápido.", carga: 1, stand: 1.3 },
  { ids: ["hooey-magoo", "ryn"], nombre: "Supervivientes", texto: "Nadie ha dormido bien desde el refugio. Las habilidades se cargan un 25 % antes.", carga: 0.75, stand: 1 },
  { ids: ["adam-kovacs", "ocevat"], nombre: "Capitán y maestro", texto: "Una orden y una espalda que la sostiene. Habilidades un 15 % antes y Stand Up un 15 % más rápido.", carga: 0.85, stand: 1.15 },
];
const COMPLEMENTOS: [Afinidad, Afinidad][] = [["juramento", "caceria"], ["sombra", "arcano"], ["carne", "eternidad"]];

export function sinergia(a: Personaje, b: Personaje): Sinergia {
  const esp = ESPECIALES.find((e) => e.ids.includes(a.id) && e.ids.includes(b.id));
  if (esp) return { nombre: esp.nombre, texto: esp.texto, carga: esp.carga, stand: esp.stand, tipo: "especial" };
  if (COMADREJAS.includes(a.id) && COMADREJAS.includes(b.id)) return { nombre: "Las Comadrejas", texto: "Trabajan juntos desde antes del refugio. Las habilidades se cargan un 20 % antes.", carga: 0.8, stand: 1, tipo: "especial" };
  if (a.afinidad === b.afinidad) return { nombre: `Dúo de ${a.afinidad}`, texto: "Misma afinidad: las habilidades se cargan un 15 % antes.", carga: 0.85, stand: 1, tipo: "afinidad" };
  if (COMPLEMENTOS.some(([x, y]) => (a.afinidad === x && b.afinidad === y) || (a.afinidad === y && b.afinidad === x))) return { nombre: "Afinidades que se complementan", texto: "El Stand Up Time se llena un 15 % más rápido.", carga: 1, stand: 1.15, tipo: "complemento" };
  return { nombre: "Sin sinergia", texto: "Una pareja sin ventajas especiales. Siempre se puede probar.", carga: 1, stand: 1, tipo: "ninguna" };
}
