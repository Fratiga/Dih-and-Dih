import Phaser from "phaser";

/* Los sprites de esta prueba se dibujan en codigo para no depender de arte todavia.
   Cada textura es un lienzo pequeño; cuando haya arte de verdad solo se sustituyen estas claves. */

type Dibujo = (c: CanvasRenderingContext2D) => void;
type Paleta = Record<string, string>;

function lienzo(escena: Phaser.Scene, clave: string, ancho: number, alto: number, dibujo: Dibujo): void {
  if (escena.textures.exists(clave)) return;
  const textura = escena.textures.createCanvas(clave, ancho, alto);
  if (!textura) return;
  const c = textura.getContext();
  c.imageSmoothingEnabled = false;
  dibujo(c);
  textura.refresh();
}

function pintar(c: CanvasRenderingContext2D, filas: string[], paleta: Paleta, x0 = 0, y0 = 0): void {
  filas.forEach((fila, y) => {
    [...fila].forEach((ch, x) => {
      const color = paleta[ch];
      if (!color) return;
      c.fillStyle = color;
      c.fillRect(x0 + x, y0 + y, 1, 1);
    });
  });
}

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

/* --- Personaje de 12x14 con tres posturas (de frente, de espaldas, de lado) y dos pasos --- */
const CABEZA_FRENTE = [
  "....dddd....",
  "...dhhhhhd..",
  "..dhhhhhhhd.",
  "..dhssssshd.",
  "..dsesssesd.",
  "..dsssssssd.",
  "...dsssssd..",
];
const CABEZA_ESPALDA = [
  "....dddd....",
  "...dhhhhhd..",
  "..dhhhhhhhd.",
  "..dhhhhhhhd.",
  "..dhhhhhhhd.",
  "..dhhhhhhhd.",
  "...dhhhhhd..",
];
const CABEZA_LADO = [
  "....dddd....",
  "...dhhhhhd..",
  "..dhhhhhhhd.",
  "..dhssssshd.",
  "..dsssssesd.",
  "..dsssssssd.",
  "...dsssssd..",
];
const CUERPO = [
  "..dcccccccd.",
  ".dscccccccsd",
  ".dcccbbbcccd",
  "..dcccccccd.",
  "..dpppppppd.",
];
const PIES_ABIERTOS = ["..dpppdpppd.", "..dooo.dooo."];
const PIES_JUNTOS = ["..dpppppppd.", "..dooooood.."];

export interface PaletaPersonaje extends Paleta {
  d: string; h: string; s: string; e: string; c: string; b: string; p: string; o: string;
}

export function crearPersonaje(escena: Phaser.Scene, prefijo: string, paleta: PaletaPersonaje): void {
  const posturas: Record<string, string[]> = { abajo: CABEZA_FRENTE, arriba: CABEZA_ESPALDA, lado: CABEZA_LADO };
  for (const [nombre, cabeza] of Object.entries(posturas)) {
    [PIES_ABIERTOS, PIES_JUNTOS].forEach((pies, paso) => {
      lienzo(escena, `${prefijo}_${nombre}_${paso}`, 12, 14, c => pintar(c, [...cabeza, ...CUERPO, ...pies], paleta));
    });
  }
}

export function crearTexturas(escena: Phaser.Scene): void {
  crearPersonaje(escena, "pj", { d: "#14101a", h: "#4a2f1d", s: "#e0b48c", e: "#1a1a1a", c: "#3d6b8a", b: "#c8a24a", p: "#4a4458", o: "#2a2018" });
  crearPersonaje(escena, "tab", { d: "#14101a", h: "#b8b0a4", s: "#d9a67e", e: "#1a1a1a", c: "#e8e2d4", b: "#9a2f2f", p: "#5a4a3a", o: "#2a2018" });

  lienzo(escena, "suelo", 16, 16, c => {
    rect(c, "#6b4a2e", 0, 0, 16, 16);
    for (const y of [3, 7, 11, 15]) rect(c, "#5a3d25", 0, y, 16, 1);
    for (const [x, y, w] of [[2, 1, 5], [9, 5, 5], [3, 9, 6], [10, 13, 4]]) rect(c, "#7a5636", x, y, w, 1);
    for (const [x, y] of [[8, 0], [3, 4], [11, 8], [6, 12]]) rect(c, "#5a3d25", x, y, 1, 3);
  });

  lienzo(escena, "pared", 16, 16, c => {
    rect(c, "#3b2a22", 0, 0, 16, 16);
    for (const y of [0, 5, 10, 15]) rect(c, "#2a1d17", 0, y, 16, 1);
    for (const [x, y] of [[4, 1], [12, 1], [8, 6], [0, 6], [4, 11], [12, 11]]) rect(c, "#2a1d17", x, y, 1, 4);
    for (const [x, y] of [[1, 2], [9, 7], [5, 12]]) rect(c, "#4a352b", x, y, 3, 1);
  });

  lienzo(escena, "barra", 112, 12, c => {
    rect(c, "#9a6a3c", 0, 0, 112, 4);
    rect(c, "#b98450", 0, 0, 112, 1);
    rect(c, "#6e4524", 0, 4, 112, 8);
    for (let x = 8; x < 112; x += 16) rect(c, "#583618", x, 4, 1, 8);
    rect(c, "#583618", 0, 11, 112, 1);
  });

  lienzo(escena, "mesa", 32, 20, c => {
    rect(c, "#5a3a1f", 3, 12, 3, 8);
    rect(c, "#5a3a1f", 26, 12, 3, 8);
    rect(c, "#6e4524", 0, 4, 32, 9);
    rect(c, "#8a5a34", 0, 0, 32, 8);
    rect(c, "#a06a3c", 1, 1, 30, 1);
    rect(c, "#583618", 0, 12, 32, 1);
    rect(c, "#d8b04a", 14, 2, 3, 3);
  });

  lienzo(escena, "taburete", 10, 10, c => {
    rect(c, "#583618", 2, 5, 1, 5);
    rect(c, "#583618", 7, 5, 1, 5);
    rect(c, "#7a4d2a", 0, 2, 10, 4);
    rect(c, "#9a6a3c", 1, 1, 8, 2);
  });

  lienzo(escena, "barril", 16, 18, c => {
    rect(c, "#7a4d2a", 1, 3, 14, 14);
    rect(c, "#5a3a1f", 0, 5, 1, 10);
    rect(c, "#5a3a1f", 15, 5, 1, 10);
    rect(c, "#9a6a3c", 2, 0, 12, 4);
    rect(c, "#b98450", 3, 1, 10, 2);
    rect(c, "#3a3a44", 1, 6, 14, 2);
    rect(c, "#3a3a44", 1, 12, 14, 2);
    rect(c, "#583618", 4, 3, 1, 14);
    rect(c, "#583618", 11, 3, 1, 14);
  });

  lienzo(escena, "chimenea", 44, 34, c => {
    rect(c, "#5b5560", 0, 0, 44, 34);
    for (let y = 0; y < 34; y += 6) rect(c, "#463f4a", 0, y, 44, 1);
    for (const [x, y] of [[6, 1], [20, 1], [34, 1], [12, 7], [28, 7], [6, 13], [38, 13], [4, 19], [38, 25]]) rect(c, "#463f4a", x, y, 1, 5);
    rect(c, "#6b6571", 0, 0, 44, 2);
    rect(c, "#1a1210", 10, 12, 24, 22);
    rect(c, "#2a1d17", 10, 12, 24, 2);
    rect(c, "#3a2a22", 12, 30, 20, 4);
  });

  for (const [paso, alto] of [[0, 11], [1, 13]] as const) {
    lienzo(escena, `fuego_${paso}`, 20, 16, c => {
      rect(c, "#c0391f", 3, 16 - alto + 2, 14, alto - 2);
      rect(c, "#e8742a", 5, 16 - alto + 4, 10, alto - 4);
      rect(c, "#f6c04a", 7, 16 - alto + 7, 6, alto - 7);
      rect(c, "#c0391f", paso ? 2 : 9, 16 - alto, 3, 4);
      rect(c, "#3a2a22", 2, 14, 16, 2);
    });
  }

  lienzo(escena, "puerta", 20, 26, c => {
    rect(c, "#3a2a22", 0, 0, 20, 26);
    rect(c, "#7a4d2a", 2, 2, 16, 24);
    for (const x of [7, 12]) rect(c, "#583618", x, 2, 1, 24);
    rect(c, "#9a6a3c", 2, 2, 16, 1);
    rect(c, "#d8b04a", 14, 14, 2, 2);
    rect(c, "#14101a", 2, 24, 16, 2);
  });

  lienzo(escena, "alfombra", 64, 40, c => {
    rect(c, "#c8a24a", 0, 0, 64, 40);
    rect(c, "#7a2a2a", 2, 2, 60, 36);
    rect(c, "#5e1f1f", 6, 6, 52, 28);
    rect(c, "#c8a24a", 8, 8, 48, 1);
    rect(c, "#c8a24a", 8, 31, 48, 1);
    for (let x = 12; x < 56; x += 8) rect(c, "#9a3838", x, 18, 4, 4);
  });

  lienzo(escena, "luz", 128, 128, c => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,190,100,0.9)");
    g.addColorStop(0.45, "rgba(255,140,60,0.35)");
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}
