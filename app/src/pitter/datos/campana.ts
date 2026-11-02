/* Los jefes de la campaña de Pitter-Patter. Son criaturas del bestiario publico (assets/criaturas), no los enemigos de las fichas
   de combate del DM, para no adelantar nada de lo que los jugadores todavia no han visto. */

export type Ataque = "bloques" | "congelar" | "tinta";

export interface Fase {
  /** Cada cuantos segundos ataca. */
  cada: number;
  tipo: Ataque;
  /** Cuantas fichas toca. */
  n: number;
  /** Texto corto del aviso. */
  aviso: string;
}

export interface Jefe {
  id: string;
  nombre: string;
  imagen: string;
  vida: number;
  tiempo: number;
  fases: Fase[];
  /** Tonos del escenario: cielo arriba, cielo abajo, suelo, detalle. */
  tema: { cielo: [string, string]; suelo: string; detalle: string; tipo: "prado" | "cueva" | "pantano" | "volcan" | "mar" | "ruinas" };
  frase: string;
  /** Tokens de juego de la primera vez que se supera (el servidor pone el tope diario). */
  premio: number;
  /** Mueble que se gana la primera vez que se supera (para las habitaciones). */
  mueble?: string;
}

export const JEFES: Jefe[] = [
  { id: "kobold", nombre: "Kobold", imagen: "kobold.png", vida: 900, tiempo: 60, fases: [],
    tema: { cielo: ["#8fd8ff", "#d9f4ff"], suelo: "#7cd36b", detalle: "#ffd34e", tipo: "prado" },
    frase: "Son muchos, y todos tienen prisa.", premio: 20, mueble: "sillon" },
  { id: "dragarto", nombre: "Dragarto", imagen: "dragarto.png", vida: 1800, tiempo: 60,
    fases: [{ cada: 14, tipo: "bloques", n: 3, aviso: "¡Escombros!" }],
    tema: { cielo: ["#ffb36b", "#ffe2a8"], suelo: "#c98a4b", detalle: "#ff6f3c", tipo: "ruinas" },
    frase: "Un solo dragarto ya hace retroceder a un aldeano.", premio: 30, mueble: "estante" },
  { id: "protodraco", nombre: "Protodraco", imagen: "protodraco.png", vida: 3000, tiempo: 60,
    fases: [{ cada: 12, tipo: "bloques", n: 4, aviso: "¡Brasas!" }],
    tema: { cielo: ["#ff8a5c", "#ffd1a1"], suelo: "#8c4a3a", detalle: "#ffb02e", tipo: "volcan" },
    frase: "Su aliento no distingue entre defensor y muro.", premio: 40, mueble: "alfombra" },
  { id: "basilisco", nombre: "Basilisco", imagen: "basilisco.png", vida: 4200, tiempo: 60,
    fases: [{ cada: 11, tipo: "congelar", n: 4, aviso: "¡Mirada de piedra!" }],
    tema: { cielo: ["#7be0b4", "#d1ffe9"], suelo: "#4f9d7a", detalle: "#2f6f58", tipo: "pantano" },
    frase: "Mirarlo un segundo de más sale caro.", premio: 50, mueble: "cuadro" },
  { id: "hidra", nombre: "Hidra", imagen: "hidra.png", vida: 5600, tiempo: 60,
    fases: [{ cada: 13, tipo: "bloques", n: 3, aviso: "¡Cabeza nueva!" }, { cada: 17, tipo: "tinta", n: 5, aviso: "¡Tinta!" }],
    tema: { cielo: ["#8ad0ff", "#e1f4ff"], suelo: "#3e9f9a", detalle: "#1b6f7a", tipo: "pantano" },
    frase: "Cortas una cabeza y salen más.", premio: 60 },
  { id: "behemoth", nombre: "Behemoth", imagen: "behemoth.png", vida: 7000, tiempo: 60,
    fases: [{ cada: 10, tipo: "congelar", n: 5, aviso: "¡Temblor!" }],
    tema: { cielo: ["#c3a7ff", "#f0e4ff"], suelo: "#8a6aa8", detalle: "#ffd34e", tipo: "cueva" },
    frase: "No ataca. Camina hacia ti.", premio: 70 },
  { id: "kraken", nombre: "Kraken", imagen: "kraken.png", vida: 8800, tiempo: 60,
    fases: [{ cada: 11, tipo: "tinta", n: 7, aviso: "¡Nube de tinta!" }, { cada: 16, tipo: "bloques", n: 4, aviso: "¡Tentáculo!" }],
    tema: { cielo: ["#5fb7ff", "#bfe8ff"], suelo: "#2b7fd6", detalle: "#9fe8ff", tipo: "mar" },
    frase: "Cambia las corrientes durante generaciones.", premio: 80 },
  { id: "dragon-de-magma", nombre: "Dragón de Magma", imagen: "dragon-de-magma.png", vida: 11000, tiempo: 60,
    fases: [{ cada: 9, tipo: "bloques", n: 4, aviso: "¡Roca fundida!" }, { cada: 12, tipo: "congelar", n: 4, aviso: "¡Ceniza!" }],
    tema: { cielo: ["#ff5f6d", "#ffc371"], suelo: "#5a2a3a", detalle: "#ff8a3c", tipo: "volcan" },
    frase: "Convierte la montaña en su casa.", premio: 100 },
];

export function jefe(id: string): Jefe | undefined {
  return JEFES.find((j) => j.id === id);
}
