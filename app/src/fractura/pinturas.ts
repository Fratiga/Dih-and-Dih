/* =============================================================================
   LA FRACTURA en Phaser: pintores de texturas. Cada funcion dibuja en un lienzo 2D con coordenadas de
   40 unidades por casilla (igual que el tablero de canvas de js/fractura-tablero.js) y se escala al
   tamano pedido. Las texturas se hornean una vez; lo que se mueve (agua, cristales, banderas, brillos)
   lo anima la escena con tweens.
============================================================================= */

export const hash = (x: number, y: number, k = 0): number => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const num = (c: string): number[] => {
  if (c[0] === "#") { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g) || ["0", "0", "0"];
  return [+m[0], +m[1], +m[2]];
};
export const mezcla = (a: string, b: string, t: number): string => {
  const x = num(a), y = num(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
export const oscuro = (c: string, t: number): string => mezcla(c, "#000000", t);
export const claro = (c: string, t: number): string => mezcla(c, "#ffffff", t);
export const colorNum = (c: string): number => { const v = num(c); return (v[0] << 16) | (v[1] << 8) | v[2]; };

export const PALETA: Record<string, [string, string]> = {
  llanura: ["#5b7036", "#2c3a19"], bosque: ["#2f4a29", "#12200e"], montana: ["#554c42", "#201c18"], desierto: ["#b8955a", "#684f2c"],
  agua: ["#25557f", "#0a2040"], magica: ["#442a68", "#140a26"], huesos: ["#706b5d", "#2b2822"], vacio: ["#0d0a15", "#050408"]
};

export function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")!];
}

/* --- Terreno. frame: 0 a 3, solo cambia el agua (las ondas se desplazan) --- */
export function pintarTerreno(g: CanvasRenderingContext2D, S: number, tipo: string, v: number, frame = 0): void {
  g.save();
  g.scale(S / 40, S / 40);
  const sem = tipo.charCodeAt(0) * 7 + tipo.length;
  const r = (n: number): number => hash(v + 3, n, sem);
  const pal = PALETA[tipo] || PALETA.llanura;
  const gr = g.createLinearGradient(0, 0, 40, 40); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
  g.fillStyle = gr; g.fillRect(0, 0, 40, 40);
  g.save(); g.beginPath(); g.rect(0, 0, 40, 40); g.clip();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "rgba(255,240,200,.05)" : "rgba(0,0,0,.15)";
    g.beginPath(); g.ellipse(r(i) * 40, r(i + 9) * 40, 6 + r(i + 3) * 8, 4 + r(i + 5) * 6, r(i + 1) * 3, 0, 7); g.fill();
  }
  const poly = (col: string | CanvasGradient, pts: number[][]): void => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
  const lin = (col: string, w: number, x1: number, y1: number, x2: number, y2: number): void => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  switch (tipo) {
    case "llanura":
      for (let i = 0; i < 7; i++) {
        const a = 4 + r(20 + i) * 32, b = 10 + r(30 + i) * 28, col = i % 2 ? "rgba(150,180,80,.7)" : "rgba(98,128,52,.8)";
        lin(col, 1.2, a, b, a - 1.5, b - 4.5); lin(col, 1.2, a, b, a + 1.6, b - 4);
      }
      if (r(60) > 0.7) for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(235,225,190,.7)"; g.beginPath(); g.arc(6 + r(61 + i) * 28, 8 + r(64 + i) * 28, 0.9, 0, 7); g.fill(); }
      break;
    case "bosque": {
      const n = 3 + Math.floor(r(1) * 2);
      for (let i = 0; i < n; i++) {
        const a = 7 + r(10 + i) * 26, b = 16 + r(20 + i) * 18, k = 0.85 + r(30 + i) * 0.5;
        g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(a, b + 6, 7 * k, 2.2, 0, 0, 7); g.fill();
        lin("#3a2a1a", 2, a, b + 6, a, b + 1);
        for (let p = 0; p < 3; p++) {
          const y0 = b + 3 - p * 6 * k, ancho = (7 - p * 1.6) * k;
          const gp = g.createLinearGradient(a - ancho, y0, a + ancho, y0); gp.addColorStop(0, "#4a7a3e"); gp.addColorStop(0.5, "#27471f"); gp.addColorStop(1, "#10210c");
          poly(gp, [[a, y0 - 9 * k], [a + ancho, y0], [a - ancho, y0]]);
        }
      }
      break;
    }
    case "montana": {
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(22, 34, 17, 3.4, 0, 0, 7); g.fill();
      poly("#2c2823", [[22, 8], [38, 34], [6, 34]]);
      const gl = g.createLinearGradient(6, 8, 22, 34); gl.addColorStop(0, "#9a9387"); gl.addColorStop(1, "#4a453d");
      poly(gl, [[20, 6], [5, 34], [22, 34], [24, 18]]);
      const gd = g.createLinearGradient(22, 6, 38, 34); gd.addColorStop(0, "#3a362f"); gd.addColorStop(1, "#15130f");
      poly(gd, [[20, 6], [24, 18], [22, 34], [37, 34]]);
      const gs = g.createLinearGradient(14, 6, 26, 18); gs.addColorStop(0, "#ffffff"); gs.addColorStop(1, "#aab4c4");
      poly(gs, [[20, 6], [14, 17], [17, 15], [20, 19], [22, 14], [26, 17]]);
      lin("rgba(0,0,0,.4)", 1, 14, 24, 19, 20); lin("rgba(0,0,0,.35)", 1, 26, 28, 30, 24);
      break;
    }
    case "desierto":
      for (let i = 0; i < 3; i++) {
        const y = 10 + i * 11 + r(i) * 3;
        g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, y + 3); g.quadraticCurveTo(14, y - 6, 42, y + 3); g.stroke();
        g.strokeStyle = "rgba(255,235,180,.3)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, y + 1); g.quadraticCurveTo(14, y - 8, 42, y + 1); g.stroke();
      }
      g.fillStyle = "rgba(80,55,25,.5)"; for (let i = 0; i < 5; i++) g.fillRect(4 + r(40 + i) * 32, 6 + r(50 + i) * 30, 1.6, 1.1);
      break;
    case "agua":
      for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? "rgba(120,170,220,.07)" : "rgba(0,0,0,.14)"; g.fillRect(-2, 6 + i * 12 + r(i) * 3, 44, 5); }
      g.strokeStyle = "rgba(170,210,245,.42)"; g.lineWidth = 1.3; g.lineCap = "round";
      [11, 21, 31].forEach((b, i) => {
        const fase = (frame / 4) * Math.PI * 2 + i * 0.9 + r(70 + i) * 3, d = Math.sin(fase) * 3;
        g.beginPath(); g.moveTo(5, b); g.quadraticCurveTo(12, b - 4 + d, 20, b); g.quadraticCurveTo(28, b + 4 - d, 35, b); g.stroke();
      });
      break;
    case "magica":
      g.strokeStyle = "rgba(170,120,230,.3)"; g.lineWidth = 0.9; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.stroke(); g.setLineDash([2, 3]); g.beginPath(); g.arc(20, 20, 17, 0, 7); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(200,170,255,.55)"; g.beginPath(); g.arc(r(70 + i) * 40, r(75 + i) * 40, 0.7, 0, 7); g.fill(); }
      break;
    case "huesos":
      g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 0.8; for (let i = 0; i < 3; i++) { const a = r(80 + i) * 30, b = r(84 + i) * 30; g.beginPath(); g.moveTo(a, b); g.lineTo(a + 8, b + 3); g.lineTo(a + 6, b + 10); g.stroke(); }
      for (let i = 0; i < 2; i++) { const a = 8 + r(60 + i) * 18, b = 10 + r(70 + i) * 18; lin("#2a2620", 3.2, a, b, a + 9, b + 8); lin("#2a2620", 3.2, a + 9, b, a, b + 8); lin("#d9d1bb", 2, a, b, a + 9, b + 8); lin("#d9d1bb", 2, a + 9, b, a, b + 8); }
      if (r(90) > 0.55) { g.fillStyle = "#d9d1bb"; g.beginPath(); g.arc(30, 11, 3.4, 0, 7); g.fill(); g.fillStyle = "#1a1714"; g.fillRect(28, 10, 1.6, 1.8); g.fillRect(31, 10, 1.6, 1.8); }
      break;
    case "vacio":
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(190,180,255,${0.15 + r(i) * 0.35})`; g.fillRect(r(10 + i) * 40, r(20 + i) * 40, 0.9, 0.9); }
      break;
    default:
  }
  g.fillStyle = "rgba(255,255,255,.04)"; for (let i = 0; i < 24; i++) g.fillRect(r(100 + i) * 40, r(130 + i) * 40, 0.8, 0.8);
  g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 24; i++) g.fillRect(r(160 + i) * 40, r(190 + i) * 40, 0.8, 0.8);
  g.restore();
  g.restore();
}

/* --- Estructuras --- */
export interface DatosCiudad { col: string; ban: string; casas: number; capital: boolean; neutral: boolean; }

function piedra(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: string, b: string): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr;
}

export function pintarCiudad(g: CanvasRenderingContext2D, S: number, d: DatosCiudad): void {
  g.save(); g.scale(S / 40, S / 40);
  g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(4, 31, 32, 4);
  g.fillStyle = piedra(g, 0, 20, 0, 34, "#8b8374", "#3a352e"); g.fillRect(5, 21, 30, 13);
  g.fillStyle = "#2a2622"; for (let i = 0; i < 6; i++) g.fillRect(5 + i * 5.2, 19, 3, 3);
  const col = d.neutral ? "#8a8a8a" : d.col;
  for (let i = 0; i < d.casas; i++) {
    const cx = 9 + i * 7 + (d.casas === 1 ? 7 : 0), desf = (i % 2) * 3, top = 17 - desf;
    g.fillStyle = piedra(g, cx, top, cx, top + 14, "#cfc6b0", "#7a7160"); g.fillRect(cx, top, 8, 14);
    const gt = g.createLinearGradient(cx, top - 8, cx + 9, top); gt.addColorStop(0, col); gt.addColorStop(1, oscuro(col, 0.65));
    g.fillStyle = gt; g.beginPath(); g.moveTo(cx - 1.5, top); g.lineTo(cx + 4, top - 8); g.lineTo(cx + 9.5, top); g.closePath(); g.fill();
    g.fillStyle = "#ffcf6a"; g.fillRect(cx + 2.6, top + 5, 2.6, 3);
  }
  if (d.capital) { g.fillStyle = "#f0cf6a"; g.beginPath(); g.moveTo(16, 8); g.lineTo(18, 4); g.lineTo(20, 7); g.lineTo(22, 4); g.lineTo(24, 8); g.closePath(); g.fill(); }
  g.restore();
}

export function pintarFortaleza(g: CanvasRenderingContext2D, S: number): void {
  g.save(); g.scale(S / 40, S / 40);
  g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(6, 33, 30, 3.5);
  g.fillStyle = piedra(g, 8, 14, 32, 34, "#8d8678", "#34302a"); g.fillRect(8, 14, 24, 20);
  g.fillStyle = piedra(g, 6, 8, 30, 16, "#a39c8c", "#4a453d"); for (let k = 0; k < 3; k++) g.fillRect(8 + k * 9, 9, 6, 6);
  g.fillStyle = "#0b0a0d"; g.beginPath(); g.moveTo(17, 34); g.lineTo(17, 27); g.arc(20, 27, 3, Math.PI, 0); g.lineTo(23, 34); g.fill();
  g.fillStyle = "rgba(255,190,90,.7)"; g.fillRect(18.8, 29, 2.4, 5);
  g.restore();
}

export function pintarRuinas(g: CanvasRenderingContext2D, S: number, saqueada: boolean): void {
  g.save(); g.scale(S / 40, S / 40);
  const gr = g.createLinearGradient(0, 12, 0, 34); gr.addColorStop(0, saqueada ? "#7a746a" : "#9c9484"); gr.addColorStop(1, "#3a352e");
  g.strokeStyle = gr; g.lineWidth = 3.4; g.lineCap = "butt";
  g.beginPath(); g.moveTo(9, 33); g.lineTo(9, 17); g.arc(20, 17, 11, Math.PI, Math.PI * 1.55); g.stroke();
  g.beginPath(); g.moveTo(31, 33); g.lineTo(31, 25); g.stroke();
  g.fillStyle = "#3a352e"; g.fillRect(12, 31, 4, 2); g.fillRect(23, 30, 5, 3);
  if (!saqueada) { g.fillStyle = "#ecd48a"; g.fillRect(17.5, 27, 5, 3); }
  g.restore();
}

export function pintarNucleo(g: CanvasRenderingContext2D, S: number): void {
  g.save(); g.scale(S / 40, S / 40);
  g.strokeStyle = "#f0d278"; g.lineWidth = 2.2;
  g.beginPath(); g.arc(20, 20, 13, 0, 7); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.arc(20, 20, 6, 0, 7); g.stroke();
  for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15); g.lineTo(20 + Math.cos(a) * 18, 20 + Math.sin(a) * 18); g.stroke(); }
  g.restore();
}

export function pintarCostura(g: CanvasRenderingContext2D, S: number): void {
  g.save(); g.scale(S / 40, S / 40);
  g.strokeStyle = "#8fe3e6"; g.lineWidth = 2.4;
  g.setLineDash([5, 4]); g.beginPath(); g.arc(20, 20, 11, 0, 7); g.stroke();
  g.setLineDash([3, 3]); g.beginPath(); g.arc(20, 20, 5.5, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#d8fbfc"; g.fillRect(18.5, 18.5, 3, 3);
  g.restore();
}

export function pintarBandera(g: CanvasRenderingContext2D, S: number, color: string): void {
  g.save(); g.scale(S / 40, S / 40);
  g.strokeStyle = "#b9a56e"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(3, 36); g.lineTo(3, 6); g.stroke();
  g.fillStyle = color; g.beginPath(); g.moveTo(3, 6); g.quadraticCurveTo(10, 5, 17, 7); g.lineTo(14, 12); g.lineTo(17, 17); g.quadraticCurveTo(10, 15, 3, 18); g.closePath(); g.fill();
  g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 0.7; g.stroke();
  g.restore();
}

export function pintarGema(g: CanvasRenderingContext2D, S: number): void {
  g.save(); g.scale(S / 40, S / 40);
  const gg = g.createLinearGradient(12, 4, 28, 36); gg.addColorStop(0, "#fff0b0"); gg.addColorStop(1, "#c9902a");
  g.fillStyle = gg; g.beginPath(); g.moveTo(20, 4); g.lineTo(26, 14); g.lineTo(20, 26); g.lineTo(14, 14); g.closePath(); g.fill();
  g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 0.8; g.stroke();
  g.restore();
}

export function pintarCristal(g: CanvasRenderingContext2D, S: number): void {
  g.save(); g.scale(S / 40, S / 40);
  const c = g.createLinearGradient(13, 7, 27, 33); c.addColorStop(0, "#f1e4ff"); c.addColorStop(0.5, "#b88cf0"); c.addColorStop(1, "#5a2f94");
  g.fillStyle = c; g.beginPath(); g.moveTo(20, 7); g.lineTo(27, 20); g.lineTo(20, 33); g.lineTo(13, 20); g.closePath(); g.fill();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(20, 11); g.lineTo(23, 20); g.lineTo(20, 20); g.closePath(); g.fill();
  g.restore();
}

/* Una mancha circular suave (blanca), para brillos con mezcla aditiva y para la niebla */
export function pintarBrillo(g: CanvasRenderingContext2D, S: number): void {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
}

export function pintarAnillo(g: CanvasRenderingContext2D, S: number): void {
  g.strokeStyle = "#ffffff"; g.lineWidth = S * 0.04; g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, 7); g.stroke();
}
