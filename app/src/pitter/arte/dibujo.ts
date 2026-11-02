/* Herramientas de dibujo con contorno de tinta para los escenarios y objetos. Todo es vectorial dibujado en canvas, sin imagenes. */

export const TINTA = "#2a1545";

export function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w);
  cv.height = Math.ceil(h);
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.lineJoin = "round";
  c.lineCap = "round";
  return [cv, c];
}

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient | null, grosor = 6): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (grosor > 0) { c.lineWidth = grosor; c.strokeStyle = TINTA; c.stroke(); }
}

export function el(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | null, grosor = 6): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (grosor > 0) { c.lineWidth = grosor; c.strokeStyle = TINTA; c.stroke(); }
}

export function poligono(c: CanvasRenderingContext2D, pts: [number, number][], fill: string | null, grosor = 6): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (grosor > 0) { c.lineWidth = grosor; c.strokeStyle = TINTA; c.stroke(); }
}

export function degradado(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: string, b: string): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

export function nube(c: CanvasRenderingContext2D, x: number, y: number, s: number, color = "#ffffff"): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.arc(0, 0, 34, Math.PI * 0.5, Math.PI * 1.5);
  c.arc(40, -18, 42, Math.PI, Math.PI * 1.85);
  c.arc(92, 0, 34, Math.PI * 1.5, Math.PI * 0.5);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.lineWidth = 6 / s;
  c.strokeStyle = TINTA;
  c.stroke();
  c.restore();
}

export function bandera(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  poligono(c, [[x, y], [x + w, y], [x + w / 2, y + h]], color, 5);
  c.beginPath();
  c.moveTo(x + 6, y + 6);
  c.lineTo(x + w * 0.45, y + 6);
  c.lineWidth = 5;
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.stroke();
}

export function estrellaDib(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, grosor = 5): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr_ = i % 2 === 0 ? r : r * 0.46;
    c.lineTo(x + Math.cos(a) * rr_, y + Math.sin(a) * rr_);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = grosor;
  c.strokeStyle = TINTA;
  c.stroke();
}

export function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color = "#fff"): void {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = color;
  c.fill();
}

/* Un numero que se repite de forma determinista, para variar sin usar Math.random en lo que se dibuja una vez. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
