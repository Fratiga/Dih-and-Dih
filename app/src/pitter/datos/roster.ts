/* Los personajes jugables de Pitter-Patter.
   Los datos de la campaña (nombre, rareza, afinidad, resumen) salen de los globales del sitio (cartas-datos.js y personajes.js);
   aquí solo se añade lo propio del juego: el color de la ficha, la habilidad y cuánto cuesta cargarla.
   Cada Side ve a los suyos y a los compartidos. El admin los ve todos. */

export type Rareza = "comun" | "infrecuente" | "rara" | "legendaria" | "limitada";
export type Afinidad = "juramento" | "sombra" | "carne" | "arcano" | "eternidad" | "caceria";
export type Lado = "A" | "B";

/* Lo que sabe hacer el motor del tablero (src/pitter/motor/habilidades.ts). Cada personaje usa uno con sus propios numeros. */
export type Verbo =
  | "convertirAzar" | "borrarColumna" | "barajar" | "tiempo" | "marcarTipo" | "limpiar" | "crearCajas"
  | "cruz" | "furia" | "caos" | "diagonales" | "aturdir" | "borrarTipo" | "sacrificio" | "fusionar" | "reforzarEquipo";

export interface Habilidad {
  nombre: string;
  verbo: Verbo;
  /** Cuantas fichas propias hay que juntar para llenar las tres estrellas. */
  carga: number;
  /** Numeros del verbo (segundos, cantidad de fichas...). */
  n: number;
  /** Lo que lee el jugador. */
  texto: string;
}

export interface Personaje {
  id: string;
  nombre: string;
  epiteto: string;
  rareza: Rareza;
  afinidad: Afinidad;
  lado: Lado[] | null;
  atq: number;
  pv: number;
  /** Color de su ficha en el tablero. Cada uno de los 16 tiene un tono distinto para que no se confundan. */
  color: string;
  resumen: string;
  habilidad: Habilidad;
  /** Frase suelta para el menu y la coleccion. */
  frase: string;
}

export const AFINIDADES: Record<Afinidad, { nombre: string; color: string; icono: string; texto: string }> = {
  juramento: { nombre: "Juramento", color: "#4d8dff", icono: "escudo", texto: "Defensa, protección y represalias." },
  sombra: { nombre: "Sombra", color: "#8d63f2", icono: "luna", texto: "Engaño, evasión y golpes por sorpresa." },
  carne: { nombre: "Carne", color: "#ff5f7e", icono: "gota", texto: "Regeneración, sacrificios y adaptación." },
  arcano: { nombre: "Arcano", color: "#24c8d6", icono: "estrella", texto: "Energía, efectos y control del campo." },
  eternidad: { nombre: "Eternidad", color: "#5fd68f", icono: "aro", texto: "Persistencia, desgaste y regreso." },
  caceria: { nombre: "Cacería", color: "#ff9a3d", icono: "flecha", texto: "Daño dirigido, trampas y preparación." },
};

export const RAREZAS: Record<Rareza, { nombre: string; orden: number; marco: string; brillo: string; estrellas: number }> = {
  comun: { nombre: "Común", orden: 1, marco: "#c98a4b", brillo: "#ffd9a8", estrellas: 1 },
  infrecuente: { nombre: "Infrecuente", orden: 2, marco: "#b9c4d6", brillo: "#ffffff", estrellas: 2 },
  rara: { nombre: "Rara", orden: 3, marco: "#ffc93c", brillo: "#fff2a8", estrellas: 3 },
  legendaria: { nombre: "Legendaria", orden: 4, marco: "#ff6fb5", brillo: "#ffe2f2", estrellas: 4 },
  limitada: { nombre: "Limitada", orden: 5, marco: "#7de6ff", brillo: "#ffffff", estrellas: 5 },
};

type Base = Omit<Personaje, "nombre" | "epiteto" | "rareza" | "afinidad" | "lado" | "atq" | "pv" | "resumen">;

/* Los 16. El orden es el del album: primero los compartidos, luego Side A, luego Side B. */
const BASES: Base[] = [
  { id: "bull", color: "#3f8cff", frase: "Se planta y no se mueve.",
    habilidad: { nombre: "Plantarse", verbo: "convertirAzar", carga: 14, n: 9, texto: "Convierte 9 fichas al azar en fichas de Bull. Cuantas más Bull haya, más fácil es juntarlas." } },
  { id: "garra", color: "#ff8a2a", frase: "Primero la mirada, luego las manos.",
    habilidad: { nombre: "Arpón", verbo: "borrarColumna", carga: 14, n: 1, texto: "Lanza un arpón y borra la columna con más fichas iguales juntas." } },
  { id: "baraja", color: "#18c4b8", frase: "Siempre tiene una carta de más.",
    habilidad: { nombre: "Cartas del destino", verbo: "barajar", carga: 18, n: 3, texto: "Baraja el tablero y suma 3 de combo. A veces sale el mejor reparto." } },
  { id: "ocevat", color: "#2f6fe0", frase: "Mientras esté en pie, el refugio resiste.",
    habilidad: { nombre: "Defensor del refugio", verbo: "tiempo", carga: 22, n: 8, texto: "Gana 8 segundos de tiempo para seguir en pie un poco más." } },
  { id: "verdam", color: "#f0603a", frase: "Elige a su presa y no la suelta.",
    habilidad: { nombre: "Marca de la presa", verbo: "marcarTipo", carga: 28, n: 1, texto: "Marca el personaje más numeroso del tablero. Todas esas fichas pasan a ser reforzadas." } },
  { id: "gareth", color: "#8a6a3c", frase: "En su taberna se acaba la pelea.",
    habilidad: { nombre: "Se acabó la pelea", verbo: "limpiar", carga: 18, n: 25, texto: "Quita los obstáculos del tablero y suma un cuarto del medidor de Stand Up." } },
  { id: "ceniza-coronada", color: "#46c27c", frase: "Gobierna desde lo más hondo.",
    habilidad: { nombre: "Corona de huesos", verbo: "crearCajas", carga: 28, n: 2, texto: "Crea 2 Cajas en el tablero. Tócalas para limpiar cinco fichas en cruz." } },
  { id: "rook", color: "#ffb02e", frase: "No pelea contra grupos.",
    habilidad: { nombre: "Degüello", verbo: "cruz", carga: 22, n: 1, texto: "Borra una fila y una columna enteras, cruzadas en un punto al azar." } },
  { id: "dagren", color: "#ff5252", frase: "Cada golpe recibido lo vuelve más peligroso.",
    habilidad: { nombre: "Furia de veterano", verbo: "furia", carga: 18, n: 8, texto: "Durante 8 segundos el daño sube un 50 % y suma 4 de combo." } },
  { id: "sir-buffolet", color: "#38d9ee", frase: "Casi siempre pronuncia bien el conjuro.",
    habilidad: { nombre: "Conjuro mal pronunciado", verbo: "caos", carga: 16, n: 12, texto: "Convierte 12 fichas al azar en un solo personaje elegido al azar. Puede salir muy bien." } },
  { id: "edge", color: "#a46cff", frase: "Un tajo y ya se fue.",
    habilidad: { nombre: "Tajo", verbo: "diagonales", carga: 13, n: 1, texto: "Borra las dos diagonales que pasan por un punto al azar." } },
  { id: "torvrena", color: "#e3a23a", frase: "Todo monstruo tiene una parte blanda.",
    habilidad: { nombre: "Trampa de mandíbula", verbo: "aturdir", carga: 18, n: 6, texto: "El jefe queda atrapado 6 segundos y no puede estropearte el tablero." } },
  { id: "ryn", color: "#2dd4c8", frase: "Duerme poco y lo ve todo.",
    habilidad: { nombre: "Intriga", verbo: "borrarTipo", carga: 24, n: 1, texto: "Borra todas las fichas del personaje más numeroso del tablero." } },
  { id: "hooey-magoo", color: "#ff6b8a", frase: "Hace fuerza a cambio de monedas.",
    habilidad: { nombre: "Sacrificado", verbo: "sacrificio", carga: 22, n: 5, texto: "Pierdes 5 segundos, pero el medidor de Stand Up sube un 60 % y el combo suma 5." } },
  { id: "cassius-coldgrave", color: "#ff7f50", frase: "Hasta el dragón, o hasta que decida huir.",
    habilidad: { nombre: "Charlatán", verbo: "fusionar", carga: 16, n: 1, texto: "Convence a todas las fichas del segundo personaje más numeroso de que son del primero." } },
  { id: "adam-kovacs", color: "#5a8dff", frase: "Ordena lo que otros no se atreven.",
    habilidad: { nombre: "Orden del capitán", verbo: "reforzarEquipo", carga: 22, n: 1, texto: "Las fichas de tu equipo pasan a ser reforzadas: hacen más daño y cargan más rápido." } },
];

interface DatosGlobales {
  CARTAS?: Array<{ id: string; nombre: string; rareza: Rareza; afinidad: string[]; atq: number | null; pv: number | null; lado: Lado[] | null; epiteto?: string; habilidad?: string; fuente?: { data: string; id: string } }>;
  PERSONAJES?: Array<{ id: string; title: string; summary?: string }>;
}

const g = (): DatosGlobales => window as unknown as DatosGlobales;

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export interface Visibilidad {
  admin: boolean;
  lado: Lado | null;
  verTodo: boolean;
}

export function visibilidad(): Visibilidad {
  const admin = leer("compendioAdmin") === "1";
  const lado = leer("compendioLado") as Lado | null;
  return { admin, lado: lado === "A" || lado === "B" ? lado : null, verTodo: admin || leer("compendioVeAmbos") === "1" };
}

export function puedeVer(p: Personaje, v: Visibilidad = visibilidad()): boolean {
  if (v.verTodo || !p.lado) return true;
  return v.lado !== null && p.lado.includes(v.lado);
}

/* Todos los jugables, con los datos del sitio ya mezclados. Si falta una carta, el personaje se omite. */
let cache: Personaje[] | null = null;
export function todosLosPersonajes(): Personaje[] {
  if (cache) return cache;
  const cartas = g().CARTAS ?? [];
  const fichas = g().PERSONAJES ?? [];
  const salida: Personaje[] = [];
  for (const b of BASES) {
    const c = cartas.find((x) => x.id === b.id);
    if (!c) continue;
    const ficha = fichas.find((x) => x.id === (c.fuente?.id ?? b.id));
    salida.push({
      ...b,
      nombre: c.nombre,
      epiteto: c.epiteto ?? "",
      rareza: c.rareza,
      afinidad: (c.afinidad[0] ?? "juramento") as Afinidad,
      lado: c.lado,
      atq: c.atq ?? 0,
      pv: c.pv ?? 0,
      resumen: ficha?.summary ?? c.habilidad ?? "",
    });
  }
  cache = salida;
  return salida;
}

export function personajesVisibles(): Personaje[] {
  const v = visibilidad();
  return todosLosPersonajes().filter((p) => puedeVer(p, v));
}

export function personaje(id: string): Personaje | undefined {
  return todosLosPersonajes().find((p) => p.id === id);
}

export function iniciales(nombre: string): string {
  const limpio = nombre.replace(/[^\p{L}\s]/gu, "").trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2);
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}
