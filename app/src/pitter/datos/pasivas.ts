/* La habilidad pasiva de cada personaje. Cuenta mientras esta en el equipo, en cualquiera de los dos puestos, y siempre esta puesta.
   Son pequeñas: la habilidad activa y la de lider son las que mandan. */

export type EfectoPasiva =
  /** Las fichas de este personaje cargan su habilidad un pct mas rapido (0.15 = 15 %). */
  | { t: "cargaPropia"; pct: number }
  /** Las fichas de este personaje hacen un pct mas de dano. */
  | { t: "ataquePropio"; pct: number }
  /** Segundos extra de tiempo al empezar. */
  | { t: "tiempoInicial"; s: number }
  /** El medidor de Stand Up se llena un pct mas rapido. */
  | { t: "standGana"; pct: number }
  /** Segundos extra en la ventana del combo. */
  | { t: "ventanaCombo"; s: number };

export interface Pasiva {
  nombre: string;
  texto: string;
  efecto: EfectoPasiva;
}

export const PASIVAS: Record<string, Pasiva> = {
  "bull": { nombre: "Aguante", texto: "Empiezas con 4 segundos más.", efecto: { t: "tiempoInicial", s: 4 } },
  "garra": { nombre: "Buena puntería", texto: "Sus fichas hacen un 15 % más de daño.", efecto: { t: "ataquePropio", pct: 0.15 } },
  "baraja": { nombre: "Baraja corta", texto: "El combo dura 0,4 segundos más.", efecto: { t: "ventanaCombo", s: 0.4 } },
  "ocevat": { nombre: "Guardia alta", texto: "El medidor de Stand Up se llena un 10 % más rápido.", efecto: { t: "standGana", pct: 0.1 } },
  "verdam": { nombre: "Olfato", texto: "Sus fichas cargan su habilidad un 15 % más rápido.", efecto: { t: "cargaPropia", pct: 0.15 } },
  "gareth": { nombre: "Barra libre", texto: "El combo dura 0,3 segundos más.", efecto: { t: "ventanaCombo", s: 0.3 } },
  "ceniza-coronada": { nombre: "Trono", texto: "Sus fichas hacen un 12 % más de daño.", efecto: { t: "ataquePropio", pct: 0.12 } },
  "rook": { nombre: "Filo corto", texto: "Sus fichas cargan su habilidad un 12 % más rápido.", efecto: { t: "cargaPropia", pct: 0.12 } },
  "dagren": { nombre: "Veterano", texto: "El medidor de Stand Up se llena un 12 % más rápido.", efecto: { t: "standGana", pct: 0.12 } },
  "sir-buffolet": { nombre: "Despistado", texto: "Empiezas con 5 segundos más.", efecto: { t: "tiempoInicial", s: 5 } },
  "edge": { nombre: "Reflejos", texto: "El combo dura 0,5 segundos más.", efecto: { t: "ventanaCombo", s: 0.5 } },
  "torvrena": { nombre: "Cazadora", texto: "Sus fichas hacen un 14 % más de daño.", efecto: { t: "ataquePropio", pct: 0.14 } },
  "ryn": { nombre: "Oído fino", texto: "Sus fichas cargan su habilidad un 18 % más rápido.", efecto: { t: "cargaPropia", pct: 0.18 } },
  "hooey-magoo": { nombre: "Aguanta lo que sea", texto: "Empiezas con 6 segundos más.", efecto: { t: "tiempoInicial", s: 6 } },
  "cassius-coldgrave": { nombre: "Labia", texto: "El medidor de Stand Up se llena un 14 % más rápido.", efecto: { t: "standGana", pct: 0.14 } },
  "adam-kovacs": { nombre: "Disciplina", texto: "Sus fichas hacen un 10 % más de daño.", efecto: { t: "ataquePropio", pct: 0.1 } },
};

export function pasivaDe(id: string): Pasiva | undefined {
  return PASIVAS[id];
}

export interface ModificadoresPasivos {
  cargaPropia: [number, number];
  ataquePropio: [number, number];
  tiempoInicial: number;
  standGana: number;
  ventanaCombo: number;
}

/** Junta las pasivas de los dos del equipo. */
export function juntarPasivas(ids: [string, string]): ModificadoresPasivos {
  const m: ModificadoresPasivos = { cargaPropia: [0, 0], ataquePropio: [0, 0], tiempoInicial: 0, standGana: 0, ventanaCombo: 0 };
  ids.forEach((id, i) => {
    const e = PASIVAS[id]?.efecto;
    if (!e) return;
    if (e.t === "cargaPropia") m.cargaPropia[i] += e.pct;
    else if (e.t === "ataquePropio") m.ataquePropio[i] += e.pct;
    else if (e.t === "tiempoInicial") m.tiempoInicial += e.s;
    else if (e.t === "standGana") m.standGana += e.pct;
    else m.ventanaCombo += e.s;
  });
  return m;
}
