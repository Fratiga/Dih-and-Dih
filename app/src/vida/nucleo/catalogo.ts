/* Las cosas que puede haber en una habitacion. Los rasgos son lo que una criatura puede percibir. Lo demas (cuanto alimenta,
   si se mueve, si hace dano) es propiedad del mundo y la criatura solo lo averigua probando. */

export interface Maquina {
  /** Segundos desde que se toca hasta que sale lo que produce. */
  retardo: number;
  produce: string;
  /** Segundos hasta que se puede volver a activar. */
  enfria: number;
  distancia: number;
}

export interface TipoObjeto {
  id: string;
  nombre: string;
  /** "f" o "m", para concordar en los textos. */
  gen: "f" | "m";
  /** redondez, tamano, brillo, calidez, verdor, olor, sonido (el movimiento se calcula) */
  f: [number, number, number, number, number, number, number];
  /** 0 si no se puede mover. */
  masa: number;
  nutri: number;
  /** Dano que causa al comerlo. */
  toxico: number;
  porciones: number;
  /** Cuanto entretiene al manipularlo cuando responde. */
  efecto: number;
  maquina?: Maquina;
  /** Dano por segundo a quien esta encima, mientras esta activo. */
  peligro?: { ratio: number; ancho: number };
  /** Dano de una descarga al tocarlo. */
  descarga?: number;
  /** Segundos que dura antes de desaparecer, si caduca. */
  caduca?: number;
  /** Algo solido que cierra el paso a las criaturas. `ancho` es la mitad de su grosor y `resistencia` lo que aguanta de empujones antes de romperse (0: no se rompe). */
  barrera?: { ancho: number; resistencia: number };
  /** Una puerta a otra sala del complejo (su destino esta en el objeto). Cerrada es una barrera; abierta se puede cruzar. */
  puerta?: boolean;
}

export const CATALOGO: Record<string, TipoObjeto> = {
  cadaver: { id: "cadaver", nombre: "cadáver", gen: "m", f: [0.5, 0.5, 0.4, 0.2, 0.2, 0.65, 0], masa: 0, nutri: 0.3, toxico: 0.03, porciones: 6, efecto: 0.02, caduca: 500 },
  raiz: { id: "raiz", nombre: "raíz", gen: "f", f: [0.75, 0.35, 0.45, 0.15, 0.35, 0.75, 0], masa: 0.6, nutri: 0.12, toxico: 0, porciones: 8, efecto: 0.05 },
  fruta: { id: "fruta", nombre: "fruta azul", gen: "f", f: [0.75, 0.35, 0.45, 0.15, 0.35, 0.75, 0], masa: 0.6, nutri: 0.55, toxico: 0, porciones: 2, efecto: 0.1 },
  baya: { id: "baya", nombre: "baya roja", gen: "f", f: [0.6, 0.25, 0.5, 0.85, 0.1, 0.55, 0], masa: 0.5, nutri: 0.2, toxico: 0.3, porciones: 1, efecto: 0.1 },
  pelota_pesada: { id: "pelota_pesada", nombre: "pelota pesada", gen: "f", f: [0.95, 0.45, 0.6, 0.5, 0.65, 0.05, 0.1], masa: 1.6, nutri: 0, toxico: 0, porciones: 0, efecto: 0.55 },
  pelota: { id: "pelota", nombre: "pelota", gen: "f", f: [0.95, 0.45, 0.6, 0.5, 0.65, 0.05, 0.1], masa: 0.6, nutri: 0, toxico: 0, porciones: 0, efecto: 0.55 },
  bola_fija: { id: "bola_fija", nombre: "bola atornillada", gen: "f", f: [0.95, 0.45, 0.6, 0.5, 0.65, 0.05, 0], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0 },
  palanca: { id: "palanca", nombre: "palanca", gen: "f", f: [0.1, 0.7, 0.7, 0.55, 0.3, 0, 0.2], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.3, maquina: { retardo: 1.5, produce: "granulo", enfria: 6, distancia: 80 } },
  palanca_rota: { id: "palanca_rota", nombre: "palanca", gen: "f", f: [0.1, 0.7, 0.7, 0.55, 0.3, 0, 0.2], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.3 },
  /* Solo para el laboratorio (no estan en la bandeja): la misma palanca con otro color, una que funciona y otra estropeada, para que una criatura pueda distinguirlas por el aspecto. */
  palanca2: { id: "palanca2", nombre: "palanca", gen: "f", f: [0.1, 0.7, 0.7, 0.15, 0.8, 0, 0.2], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.3, maquina: { retardo: 1.5, produce: "granulo", enfria: 6, distancia: 80 } },
  palanca2_rota: { id: "palanca2_rota", nombre: "palanca", gen: "f", f: [0.1, 0.7, 0.7, 0.15, 0.8, 0, 0.2], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.3 },
  granulo: { id: "granulo", nombre: "gránulo", gen: "m", f: [0.5, 0.2, 0.3, 0.6, 0.3, 0.55, 0], masa: 0.4, nutri: 0.4, toxico: 0, porciones: 1, efecto: 0.05, caduca: 240 },
  placa: { id: "placa", nombre: "placa roja", gen: "f", f: [0.05, 0.9, 0.9, 0.95, 0, 0, 0.6], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, peligro: { ratio: 0.3, ancho: 150 } },
  foco_rojo: { id: "foco_rojo", nombre: "foco rojo", gen: "m", f: [0.8, 0.3, 0.95, 0.95, 0, 0, 0.3], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, descarga: 0.5 },
  foco_azul: { id: "foco_azul", nombre: "foco azul", gen: "m", f: [0.8, 0.3, 0.95, 0.05, 0.2, 0, 0.3], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, descarga: 0 },
  /* Barreras (capacidad W3). La reja se rompe a empujones; la reja fija se ve igual y no se rompe (solo para el laboratorio); el muro es otra cosa y tampoco. */
  reja: { id: "reja", nombre: "reja", gen: "f", f: [0.05, 0.85, 0.4, 0.3, 0.15, 0, 0.05], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.12, barrera: { ancho: 14, resistencia: 1 } },
  reja_fija: { id: "reja_fija", nombre: "reja", gen: "f", f: [0.05, 0.85, 0.4, 0.3, 0.15, 0, 0.05], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0.12, barrera: { ancho: 14, resistencia: 0 } },
  muro: { id: "muro", nombre: "muro", gen: "m", f: [0.1, 0.95, 0.15, 0.5, 0.05, 0, 0], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, barrera: { ancho: 18, resistencia: 0 } },
  puerta: { id: "puerta", nombre: "puerta", gen: "f", f: [0.15, 0.88, 0.3, 0.55, 0.15, 0.1, 0], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, puerta: true },
  /* Solo para el laboratorio: la placa roja con el mismo aspecto, con una descarga mas leve y mas fuerte, y sin ella. */
  placa_leve: { id: "placa_leve", nombre: "placa roja", gen: "f", f: [0.05, 0.9, 0.9, 0.95, 0, 0, 0.6], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, peligro: { ratio: 0.06, ancho: 150 } },
  placa_fuerte: { id: "placa_fuerte", nombre: "placa roja", gen: "f", f: [0.05, 0.9, 0.9, 0.95, 0, 0, 0.6], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, peligro: { ratio: 0.9, ancho: 150 } },
  placa_inocua: { id: "placa_inocua", nombre: "placa roja", gen: "f", f: [0.05, 0.9, 0.9, 0.95, 0, 0, 0.6], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0 },
  foco_rojo_b: { id: "foco_rojo_b", nombre: "foco rojo grande", gen: "m", f: [0.7, 0.45, 0.9, 0.9, 0.05, 0, 0.3], masa: 0, nutri: 0, toxico: 0, porciones: 0, efecto: 0, descarga: 0 },
};
