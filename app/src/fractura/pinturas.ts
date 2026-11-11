/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   LA FRACTURA en Phaser: pinturas. Todo el arte del mapa se dibuja aquí sobre canvas y luego se sube
   como textura. Hay tres familias:
   - El suelo del mundo entero, horneado una vez: silueta del continente con costa irregular, playa,
     aguas someras, biomas que se funden unos con otros, lagos, detalle de cada terreno y caminos.
   - Lo que tiene volumen (árboles, picos, rocas, ciudades, fortalezas...), que va en piezas sueltas
     para que se ordene por profundidad con las tropas y no se emborrone al acercar la vista.
   - Niebla, brillos y marcas.
============================================================================= */

export type Ctx = CanvasRenderingContext2D;
export const hash = (x: number, y: number, k = 0): number => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hex = (h: string): number[] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mezcla = (a: string, b: string, t: number): string => { const x = hex(a), y = hex(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
export const oscuro = (c: string, t: number): string => mezcla(c, "#000000", t);
export const claro = (c: string, t: number): string => mezcla(c, "#ffffff", t);
export const colorNum = (c: string): number => parseInt(c.slice(1), 16);
export function lienzo(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d") as Ctx];
}

/* Color de base de cada terreno (el suelo, sin lo que crece encima) */
export const SUELO: Record<string, string> = {
  llanura: "#6f8a44", bosque: "#4f7340", montana: "#7c7466", desierto: "#c8a567", agua: "#2f6f8f", magica: "#66708a", huesos: "#9a9382", vacio: "#000000"
};
const MAR: Record<string, [string, string, string]> = {
  mar: ["#0d2a3d", "#12425a", "#3f8fa0"], abismo: ["#0a0714", "#1a1230", "#6a4aa8"], ceniza: ["#12100f", "#221d1b", "#6f6a62"]
};
export const estiloMar = (tipo: string): string => (tipo === "horizonte" ? "abismo" : tipo === "muertos" ? "ceniza" : "mar");

/* Ruido suave de 0 a 1, repetible */
function ruido(x: number, y: number, k: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, k), b = hash(x0 + 1, y0, k), c = hash(x0, y0 + 1, k), d = hash(x0 + 1, y0 + 1, k);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/* =============================================================================
   EL SUELO DEL MUNDO
============================================================================= */
export interface Suelo { lienzo: HTMLCanvasElement; P: number; caminos: Array<Array<{ x: number; y: number }>> }

export function hornearSuelo(est: any, P: number): Suelo {
  const w = est.ancho, h = est.alto, W = w * P, H = h * P;
  const semilla = est.semilla % 9973;
  const t = (x: number, y: number): string => (x < 0 || y < 0 || x >= w || y >= h ? "vacio" : est.casillas[y][x].t);
  // 1. Colores de base, uno por casilla, estirados con suavizado: los biomas se funden. Todos los lienzos pequeños
  //    llevan una casilla de margen, así la tierra del borde del mapa también tiene orilla. Las máscaras de tierra y
  //    de lagos van a 1 píxel por casilla: al estirarlas, la costa sale redondeada en vez de seguir la cuadrícula.
  const R = 4;
  const [cm, gm] = lienzo((w + 2) * R, (h + 2) * R);
  const [mt, gt] = lienzo(w + 2, h + 2);
  const [ml, gl] = lienzo(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tt = t(x, y);
    if (tt === "vacio") continue;
    // El agua navegable no es tierra: va en su propia máscara y se pinta como mar claro
    if (tt === "agua") { gl.fillStyle = "#fff"; gl.fillRect(x + 1, y + 1, 1, 1); continue; }
    const base = SUELO[tt] || SUELO.llanura;
    gm.fillStyle = mezcla(base, hash(x, y, semilla) > 0.5 ? "#ffffff" : "#000000", hash(x, y, semilla + 3) * 0.1);
    gm.fillRect((x + 1) * R, (y + 1) * R, R, R);
    gt.fillStyle = "#fff"; gt.fillRect(x + 1, y + 1, 1, 1);
  }
  // Las casillas de tierra pegadas al vacío llevan su color un poco hacia fuera para que la orilla no salga negra
  const [cm2, gm2] = lienzo((w + 2) * R, (h + 2) * R);
  gm2.drawImage(cm, 0, 0);
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (t(x, y) !== "vacio" && t(x, y) !== "agua") continue;
    let col: string | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const v = t(x + dx, y + dy); if (v !== "vacio" && v !== "agua") { col = SUELO[v]; break; } }
    if (col) { gm2.fillStyle = col; gm2.fillRect((x + 1) * R, (y + 1) * R, R, R); }
  }
  const [gc, g] = lienzo(W, H);
  const estirar = (origen: HTMLCanvasElement): Uint8ClampedArray => {
    const [, x] = lienzo(W, H);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(origen, -P, -P, W + 2 * P, H + 2 * P);
    return x.getImageData(0, 0, W, H).data;
  };
  const col = estirar(cm2), tierra = estirar(mt), lago = estirar(ml);
  const img = g.createImageData(W, H), d = img.data;
  const arena = hex("#d2bd8a");
  const estilo = MAR[estiloMar(est.tipo)], somero = hex(estilo[2]), medio = hex(estilo[1]);
  const nav = [(somero[0] + medio[0]) / 2, (somero[1] + medio[1]) / 2, (somero[2] + medio[2]) / 2];
  const k1 = semilla + 11, k2 = semilla + 29, k3 = semilla + 53;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const fx = px / P, fy = py / P;
      const n = ruido(fx * 1.7, fy * 1.7, k1) * 0.6 + ruido(fx * 5.3, fy * 5.3, k2) * 0.4;   // forma de la orilla
      const grano = ruido(fx * 9, fy * 9, k3) * 0.5 + ruido(fx * 23, fy * 23, k2) * 0.5;      // textura del suelo
      const a = tierra[i + 3] / 255, umbral = 0.5 + (n - 0.5) * 0.42;
      if (a > umbral) {
        let r = col[i], gg = col[i + 1], b = col[i + 2];
        const luz = 0.86 + grano * 0.28;
        r *= luz; gg *= luz; b *= luz;
        const playa = 1 - Math.min(1, (a - umbral) / 0.1);
        if (playa > 0) { r += (arena[0] - r) * playa * 0.85; gg += (arena[1] - gg) * playa * 0.85; b += (arena[2] - b) * playa * 0.85; }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      } else {
        // Agua. La navegable se ve más clara que el mar abierto, con una línea tenue donde se acaba.
        // Pegadas a la tierra, aguas someras y una raya de espuma.
        const l = lago[i + 3] / 255, ul = 0.46 + (n - 0.5) * 0.12;
        const dentro = l <= ul ? 0 : Math.min(1, (l - ul) / 0.1);
        const f = a > umbral - 0.3 ? (a - (umbral - 0.3)) / 0.3 : 0;
        const espuma = a > umbral - 0.03 ? 1 : 0;
        const raya = dentro > 0 && dentro < 1 ? 0.16 : 0;
        const alfa = Math.max(dentro * (0.46 + grano * 0.12), f * f * 0.75) + espuma * 0.5 + raya;
        if (alfa <= 0.004) { d[i + 3] = 0; continue; }
        const cf = Math.min(1, f * 1.2);
        let r = nav[0] + (somero[0] - nav[0]) * cf, gg = nav[1] + (somero[1] - nav[1]) * cf, b = nav[2] + (somero[2] - nav[2]) * cf;
        if (raya) { r += (somero[0] - r) * 0.6; gg += (somero[1] - gg) * 0.6; b += (somero[2] - b) * 0.6; }
        if (espuma) { r += (235 - r) * 0.9; gg += (240 - gg) * 0.9; b += (235 - b) * 0.9; }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = Math.min(255, alfa * 255);
      }
    }
  }
  g.putImageData(img, 0, 0);

  // 2. Sombra del borde de la tierra hacia dentro (da volumen a la orilla) y luz general
  g.save(); g.globalCompositeOperation = "source-atop";
  const luzG = g.createLinearGradient(0, 0, W, H);
  luzG.addColorStop(0, "rgba(255,240,200,.10)"); luzG.addColorStop(1, "rgba(10,5,30,.18)");
  g.fillStyle = luzG; g.fillRect(0, 0, W, H);

  // 3. Detalle de cada terreno, pintado solo sobre la tierra
  const u = P / 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tt = t(x, y), X = x * P, Y = y * P;
    const r = (k: number): number => hash(x, y, semilla + k);
    if (tt === "llanura" || tt === "bosque") {
      g.strokeStyle = tt === "bosque" ? "rgba(30,52,26,.5)" : "rgba(52,74,30,.5)"; g.lineWidth = 1.2 * u; g.lineCap = "round";
      for (let i = 0; i < (tt === "bosque" ? 4 : 6); i++) { const bx = X + r(i * 3) * P, by = Y + r(i * 3 + 1) * P; g.beginPath(); g.moveTo(bx - 2 * u, by); g.lineTo(bx - 1 * u, by - 3.4 * u); g.moveTo(bx, by); g.lineTo(bx + 0.4 * u, by - 4.2 * u); g.moveTo(bx + 2 * u, by); g.lineTo(bx + 1.6 * u, by - 3 * u); g.stroke(); }
      if (tt === "llanura" && r(40) > 0.6) { g.fillStyle = ["rgba(240,220,120,.75)", "rgba(230,230,240,.7)", "rgba(210,120,130,.7)"][Math.floor(r(41) * 3)]; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(X + r(50 + i) * P, Y + r(60 + i) * P, 1.1 * u, 0, 7); g.fill(); } }
    } else if (tt === "desierto") {
      g.strokeStyle = "rgba(120,88,40,.38)"; g.lineWidth = 1.3 * u; g.lineCap = "round";
      for (let i = 0; i < 3; i++) { const by = Y + (0.2 + i * 0.3 + r(i) * 0.1) * P; g.beginPath(); g.moveTo(X + 2 * u, by); g.bezierCurveTo(X + P * 0.3, by - 4 * u, X + P * 0.6, by + 4 * u, X + P - 2 * u, by - 1 * u); g.stroke(); }
      g.strokeStyle = "rgba(255,240,200,.25)"; g.lineWidth = 0.9 * u;
      for (let i = 0; i < 3; i++) { const by = Y + (0.2 + i * 0.3 + r(i) * 0.1) * P + 1.6 * u; g.beginPath(); g.moveTo(X + 2 * u, by); g.bezierCurveTo(X + P * 0.3, by - 4 * u, X + P * 0.6, by + 4 * u, X + P - 2 * u, by - 1 * u); g.stroke(); }
    } else if (tt === "montana") {
      g.strokeStyle = "rgba(40,34,30,.4)"; g.lineWidth = 1.1 * u;
      for (let i = 0; i < 4; i++) { const bx = X + r(i * 5) * P, by = Y + r(i * 5 + 1) * P; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (r(i * 5 + 2) - 0.5) * 9 * u, by + 5 * u); g.lineTo(bx + (r(i * 5 + 3) - 0.5) * 9 * u, by + 9 * u); g.stroke(); }
      g.fillStyle = "rgba(60,54,48,.55)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(X + r(70 + i) * P, Y + r(80 + i) * P, 2.2 * u, 1.4 * u, 0, 0, 7); g.fill(); }
    } else if (tt === "magica") {
      const cx = X + P / 2, cy = Y + P / 2;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, P * 0.7);
      gr.addColorStop(0, "rgba(200,150,255,.42)"); gr.addColorStop(1, "rgba(200,150,255,0)");
      g.fillStyle = gr; g.fillRect(X - P * 0.2, Y - P * 0.2, P * 1.4, P * 1.4);
      g.strokeStyle = "rgba(225,195,255,.4)"; g.lineWidth = 1 * u; g.setLineDash([3 * u, 4 * u]);
      g.beginPath(); g.arc(cx, cy, 13 * u, 0, 7); g.stroke(); g.setLineDash([]);
    } else if (tt === "huesos") {
      g.strokeStyle = "rgba(232,224,203,.8)"; g.lineWidth = 1.5 * u; g.lineCap = "round";
      for (let i = 0; i < 3; i++) { const bx = X + (0.15 + r(i * 7) * 0.7) * P, by = Y + (0.2 + r(i * 7 + 1) * 0.65) * P, an = r(i * 7 + 2) * 3; g.beginPath(); g.moveTo(bx - Math.cos(an) * 4 * u, by - Math.sin(an) * 4 * u); g.lineTo(bx + Math.cos(an) * 4 * u, by + Math.sin(an) * 4 * u); g.stroke(); }
      g.strokeStyle = "rgba(60,54,46,.35)"; g.lineWidth = 0.9 * u;
      for (let i = 0; i < 3; i++) { const bx = X + r(90 + i) * P, by = Y + r(95 + i) * P; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 6 * u, by + 2 * u); g.stroke(); }
    }
  }

  // 4. Caminos: de cada ciudad a las dos más cercanas, por donde menos cuesta andar
  const sitios: Array<{ x: number; y: number }> = Object.values(est.ciudades).map((c: any) => ({ x: c.x, y: c.y }));
  const caminos: Array<Array<{ x: number; y: number }>> = [];
  const hechos = new Set<string>();
  const costeDe = (x: number, y: number): number => { const v = t(x, y); return v === "vacio" || v === "agua" ? 0 : v === "llanura" ? 1 : v === "desierto" ? 1.6 : v === "bosque" ? 2.2 : v === "montana" ? 4 : 1.4; };
  const ruta = (a: { x: number; y: number }, b: { x: number; y: number }): Array<{ x: number; y: number }> | null => {
    const dist = new Float32Array(w * h).fill(1e9), prev = new Int32Array(w * h).fill(-1), cola: number[] = [];
    dist[a.y * w + a.x] = 0; cola.push(a.y * w + a.x);
    while (cola.length) {
      let mi = 0; for (let i = 1; i < cola.length; i++) if (dist[cola[i]] < dist[cola[mi]]) mi = i;
      const cur = cola.splice(mi, 1)[0], cx = cur % w, cy = Math.floor(cur / w);
      if (cx === b.x && cy === b.y) break;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy, c = costeDe(nx, ny);
        if (!c) continue;
        const nd = dist[cur] + c * (dx && dy ? 1.4 : 1) + (hechos.has(`${nx},${ny}`) ? -0.35 : 0);
        if (nd < dist[ny * w + nx]) { dist[ny * w + nx] = nd; prev[ny * w + nx] = cur; cola.push(ny * w + nx); }
      }
    }
    if (prev[b.y * w + b.x] < 0) return null;
    const out: Array<{ x: number; y: number }> = [];
    for (let k = b.y * w + b.x; k >= 0; k = prev[k]) { out.unshift({ x: k % w, y: Math.floor(k / w) }); if (k === a.y * w + a.x) break; }
    return out;
  };
  const pares = new Set<string>();
  sitios.forEach((a, i) => {
    sitios.map((b, j) => ({ j, d: Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) })).filter(o => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2).forEach(o => {
      const k = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
      if (pares.has(k) || o.d > Math.max(w, h) * 0.55) return;
      pares.add(k);
      const r = ruta(a, sitios[o.j]);
      if (r && r.length > 1) { caminos.push(r); r.forEach(p => hechos.add(`${p.x},${p.y}`)); }
    });
  });
  const trazar = (r: Array<{ x: number; y: number }>): void => {
    const pt = r.map((p, i) => ({ x: (p.x + 0.5 + (i > 0 && i < r.length - 1 ? (hash(p.x, p.y, semilla + 7) - 0.5) * 0.36 : 0)) * P, y: (p.y + 0.58 + (i > 0 && i < r.length - 1 ? (hash(p.x, p.y, semilla + 8) - 0.5) * 0.3 : 0)) * P }));
    g.beginPath(); g.moveTo(pt[0].x, pt[0].y);
    for (let i = 1; i < pt.length - 1; i++) { const mx = (pt[i].x + pt[i + 1].x) / 2, my = (pt[i].y + pt[i + 1].y) / 2; g.quadraticCurveTo(pt[i].x, pt[i].y, mx, my); }
    g.lineTo(pt[pt.length - 1].x, pt[pt.length - 1].y);
    g.stroke();
  };
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "rgba(48,36,22,.42)"; g.lineWidth = 5.6 * u; caminos.forEach(trazar);
  g.strokeStyle = "rgba(196,170,120,.82)"; g.lineWidth = 3.2 * u; caminos.forEach(trazar);
  g.strokeStyle = "rgba(120,96,60,.5)"; g.lineWidth = 0.8 * u; g.setLineDash([2.5 * u, 4.5 * u]); caminos.forEach(trazar); g.setLineDash([]);
  g.restore();
  return { lienzo: gc, P, caminos };
}

/* El mar (o el abismo): una loseta que se repite sin costura y se desplaza despacio. Una sola capa: cada capa a pantalla
   completa es una pasada más para la gráfica. */
export function pintarMar(g: Ctx, S: number, estilo: string): void {
  const [fondo, medio, luz] = MAR[estilo] || MAR.mar;
  g.fillStyle = fondo; g.fillRect(0, 0, S, S);
  const copias = [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]];
  for (let i = 0; i < 26; i++) {
    const x = hash(i, 1, 3) * S, y = hash(i, 2, 3) * S, r = S * (0.12 + hash(i, 3, 3) * 0.2);
    for (const [ox, oy] of copias) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, medio + "66"); gr.addColorStop(1, medio + "00");
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  if (estilo === "abismo") { for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(220,200,255,${0.25 + hash(i, 9, 2) * 0.6})`; const r = 0.5 + hash(i, 8, 2) * 1.3; g.beginPath(); g.arc(hash(i, 5, 2) * S, hash(i, 6, 2) * S, r, 0, 7); g.fill(); } }
  g.strokeStyle = luz + (estilo === "abismo" ? "26" : "34"); g.lineWidth = S / 170; g.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    const x = hash(i, 11, 5) * S, y = hash(i, 12, 5) * S, l = S * (0.03 + hash(i, 13, 5) * 0.05);
    for (const [ox, oy] of copias.slice(0, 5)) { g.beginPath(); g.moveTo(x + ox - l, y + oy); g.quadraticCurveTo(x + ox - l / 2, y + oy - l * 0.35, x + ox, y + oy); g.quadraticCurveTo(x + ox + l / 2, y + oy + l * 0.35, x + ox + l, y + oy); g.stroke(); }
  }
}

/* Provincias en un solo lienzo (R píxeles por casilla): tinte del dueño, franja que se apaga hacia dentro y frontera
   entre dueños distintos. Se pinta una vez cada vez que cambia un dueño o lo que se ve, no en cada fotograma. */
export function pintarTerritorios(c: HTMLCanvasElement, est: any, vis: number[], colores: string[], R: number): void {
  const g = c.getContext("2d") as Ctx, w = est.ancho, h = est.alto;
  g.clearRect(0, 0, c.width, c.height);
  // El agua no se tiñe: las provincias son de tierra y su frontera sigue la costa
  const regDe = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h || est.casillas[y][x].t === "agua" ? -1 : est.casillas[y][x].region);
  const rgba = (col: string, a: number): string => { const v = hex(col); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = regDe(x, y);
    if (vis[y * w + x] === 0 || r < 0) continue;
    const d: number | null = est.regiones[r].dueno, X = x * R, Y = y * R;
    if (d !== null) { g.fillStyle = rgba(colores[d], 0.1); g.fillRect(X, Y, R, R); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r2 = regDe(x + dx, y + dy);
      if (r2 === r) continue;
      const d2 = r2 < 0 ? null : est.regiones[r2].dueno;
      if (d !== null && d2 !== d) {
        const ancho = R * 0.24, lw = Math.max(1.5, R * 0.055);
        const gr = dx ? g.createLinearGradient(dx > 0 ? X + R : X, 0, dx > 0 ? X + R - ancho : X + ancho, 0) : g.createLinearGradient(0, dy > 0 ? Y + R : Y, 0, dy > 0 ? Y + R - ancho : Y + ancho);
        gr.addColorStop(0, rgba(colores[d], 0.5)); gr.addColorStop(1, rgba(colores[d], 0));
        g.fillStyle = gr;
        if (dx) g.fillRect(dx > 0 ? X + R - ancho : X, Y, ancho, R); else g.fillRect(X, dy > 0 ? Y + R - ancho : Y, R, ancho);
        g.fillStyle = "rgba(8,6,12,.55)";
        if (dx) g.fillRect(dx > 0 ? X + R - lw * 1.5 : X, Y, lw * 1.5, R); else g.fillRect(X, dy > 0 ? Y + R - lw * 1.5 : Y, R, lw * 1.5);
        g.fillStyle = rgba(colores[d], 0.95);
        if (dx) g.fillRect(dx > 0 ? X + R - lw * 1.25 : X + lw * 0.25, Y, lw, R); else g.fillRect(X, dy > 0 ? Y + R - lw * 1.25 : Y + lw * 0.25, R, lw);
      } else if (d === null && d2 === null && r2 >= 0 && (dx > 0 || dy > 0)) {
        g.fillStyle = "rgba(241,230,201,.24)";
        for (let k = 0; k < 5; k++) { if (dx) g.fillRect(X + R - 0.75, Y + k * (R / 5) + 1, 1.5, R / 10); else g.fillRect(X + k * (R / 5) + 1, Y + R - 0.75, R / 10, 1.5); }
      }
    }
  }
}

/* =============================================================================
   LO QUE TIENE VOLUMEN. Coordenadas en unidades de 40 por casilla; (0,0) es el centro del pie.
============================================================================= */
const poli = (g: Ctx, col: string | CanvasGradient, pts: number[][]): void => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
const sombra = (g: Ctx, rx: number, ry: number): void => { g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill(); };

/* Árbol: v 0..3 (dos frondosos, un abeto, un árbol seco). cx,cy: dónde queda el pie dentro del lienzo */
export function pintarArbol(g: Ctx, S: number, v: number): void {
  g.save(); g.translate(S / 2, S * 0.9); g.scale(S / 30, S / 30);
  sombra(g, 7.5, 2.4);
  if (v === 2) {
    poli(g, "#4a3220", [[-1, 0], [1, 0], [0.8, -7], [-0.8, -7]]);
    [[9, -4, "#2c4a2a"], [7.4, -9.5, "#345632"], [5.6, -15, "#3d6338"]].forEach(([w, y, c]) => { poli(g, c as string, [[-(w as number), y as number], [w as number, y as number], [0, (y as number) - 9]]); poli(g, "rgba(255,255,220,.13)", [[-(w as number), y as number], [0, y as number], [0, (y as number) - 9]]); });
  } else if (v === 3) {
    g.strokeStyle = "#3a3028"; g.lineWidth = 1.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0.4, -11); g.lineTo(-4, -17); g.moveTo(0.4, -11); g.lineTo(4.6, -16); g.moveTo(0.2, -7); g.lineTo(-3.4, -10); g.moveTo(2.4, -13.4); g.lineTo(5, -12); g.stroke();
  } else {
    poli(g, "#4a3220", [[-1.2, 0], [1.2, 0], [0.9, -8], [-0.9, -8]]);
    const c0 = v === 0 ? "#2f5230" : "#3a5a2a", c1 = v === 0 ? "#3f6a3c" : "#4e7234", c2 = v === 0 ? "#5a8a4e" : "#6f9444";
    [[0, -11, 8.2, c0], [-3.4, -13.6, 5.6, c1], [3.2, -14.4, 5.4, c1], [-0.4, -17.4, 5.6, c1], [-2.2, -16.6, 3.4, c2], [1.2, -19.4, 2.8, c2]].forEach(([x, y, r, c]) => { g.fillStyle = c as string; g.beginPath(); g.arc(x as number, y as number, r as number, 0, 7); g.fill(); });
  }
  g.restore();
}

/* Pico de montaña: v 0..2. Más ancho que su casilla para que varios juntos formen una sierra */
export function pintarPico(g: Ctx, S: number, v: number): void {
  g.save(); g.translate(S / 2, S * 0.92); g.scale(S / 56, S / 56);
  g.fillStyle = "rgba(0,0,0,.26)"; g.beginPath(); g.ellipse(2, 0, 24, 5, 0, 0, 7); g.fill();
  const alto = [-31, -26, -34][v], cima = [-2, 4, 1][v];
  const roca = g.createLinearGradient(-22, alto, 22, 0); roca.addColorStop(0, "#a39a8c"); roca.addColorStop(0.5, "#756c60"); roca.addColorStop(1, "#3a332e");
  poli(g, roca, [[-24, 0], [cima, alto], [24, 0]]);
  poli(g, "rgba(20,14,24,.42)", [[cima, alto], [24, 0], [cima + 5, 0], [cima + 2, alto * 0.45]]);
  poli(g, "#8c8376", [[-30, 0], [-15, alto * 0.5], [-3, 0]]); poli(g, "rgba(20,14,24,.35)", [[-15, alto * 0.5], [-3, 0], [-11, 0]]);
  if (v !== 1) poli(g, "#6f665b", [[8, 0], [19, alto * 0.42], [30, 0]]);
  poli(g, "#f2f0ea", [[cima, alto], [cima - 5.4, alto * 0.72], [cima - 2, alto * 0.78], [cima + 0.4, alto * 0.66], [cima + 3, alto * 0.76], [cima + 5, alto * 0.73]]);
  poli(g, "rgba(120,140,170,.45)", [[cima, alto], [cima + 0.4, alto * 0.66], [cima + 3, alto * 0.76], [cima + 5, alto * 0.73]]);
  g.strokeStyle = "rgba(30,24,22,.35)"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-10, alto * 0.3); g.lineTo(-6, alto * 0.12); g.moveTo(-14, -3); g.lineTo(-9, -8); g.stroke();
  g.restore();
}

export function pintarRoca(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.86); g.scale(S / 20, S / 20);
  sombra(g, 7, 2);
  poli(g, "#7c7468", [[-6, 0], [-4, -6], [1, -8], [6, -3], [7, 0]]); poli(g, "#a39a8c", [[-4, -6], [1, -8], [0, -3], [-5, -1]]); poli(g, "rgba(20,14,24,.35)", [[1, -8], [6, -3], [7, 0], [2, 0]]);
  g.restore();
}
export function pintarCalavera(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 20, S / 20);
  sombra(g, 6.4, 1.8);
  g.strokeStyle = "#e8e0cb"; g.lineWidth = 1.6; g.lineCap = "round";
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-5 + i * 2.6, 0, 5 - i * 0.4, Math.PI * 1.02, Math.PI * 1.7); g.stroke(); }
  g.fillStyle = "#e8e0cb"; g.beginPath(); g.arc(5, -3.4, 3.4, 0, 7); g.fill(); g.fillRect(3.4, -1.6, 3.2, 2.4);
  g.fillStyle = "#1a1612"; g.beginPath(); g.arc(4, -3.8, 0.9, 0, 7); g.arc(6.2, -3.8, 0.9, 0, 7); g.fill();
  g.restore();
}
export function pintarCristal(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.84); g.scale(S / 24, S / 24);
  sombra(g, 6, 1.8);
  poli(g, "#7a4ab8", [[-5, 0], [-6.4, -7], [-3.4, -12], [-1, -6], [-1, 0]]);
  poli(g, "#b98cff", [[-2, 0], [-3.4, -10], [0.4, -19], [4, -10], [2.6, 0]]);
  poli(g, "#e9d6ff", [[0.4, -19], [-3.4, -10], [-0.4, -9]]);
  poli(g, "#8f5bc4", [[2, 0], [3.4, -7], [6.4, -10], [7, -3], [5.4, 0]]);
  g.restore();
}
export function pintarJuncos(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.9); g.scale(S / 16, S / 16);
  g.strokeStyle = "#3a5a34"; g.lineWidth = 1; g.lineCap = "round";
  [-3, -1, 1.4, 3.4].forEach((x, i) => { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 1, -5, x + (i % 2 ? 2 : -1), -9 - i); g.stroke(); });
  g.fillStyle = "#5a3d24"; g.fillRect(0.6, -11, 1.4, 3.2); g.fillRect(-2.4, -9.4, 1.3, 2.8);
  g.restore();
}

/* =============================================================================
   ESTRUCTURAS. Se dibujan en un lienzo cuadrado de S; el pie queda en (S/2, S*0.8).
============================================================================= */
export interface DatosCiudad { col: string; nivel: number; capital: boolean; neutral: boolean; estilo?: string }
function casa(g: Ctx, x: number, y: number, w: number, h: number, tejado: string, muro: string): void {
  poli(g, muro, [[x - w / 2, y], [x + w / 2, y], [x + w / 2, y - h], [x - w / 2, y - h]]);
  poli(g, "rgba(0,0,0,.28)", [[x, y], [x + w / 2, y], [x + w / 2, y - h], [x, y - h]]);
  poli(g, tejado, [[x - w / 2 - 1, y - h], [x + w / 2 + 1, y - h], [x, y - h - w * 0.62]]);
  poli(g, "rgba(0,0,0,.25)", [[x, y - h - w * 0.62], [x + w / 2 + 1, y - h], [x, y - h]]);
  g.fillStyle = "#f6d67a"; g.fillRect(x - 0.8, y - h * 0.62, 1.6, 2);
}
export function pintarCiudad(g: Ctx, S: number, d: DatosCiudad): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 41, S / 41);
  const tejado = d.neutral ? "#7c7068" : d.col, tejado2 = d.neutral ? "#6a5f58" : oscuro(d.col, 0.28), muro = "#d8cdb6", piedra = "#8c8478";
  g.fillStyle = "rgba(0,0,0,.34)"; g.beginPath(); g.ellipse(0, 1, 19, 6, 0, 0, 7); g.fill();
  // muralla
  const n = d.nivel;
  if (n >= 2 || d.capital) {
    poli(g, piedra, [[-18, 0], [18, 0], [18, -5], [-18, -5]]); poli(g, "rgba(0,0,0,.3)", [[4, 0], [18, 0], [18, -5], [4, -5]]);
    for (let i = -18; i < 18; i += 4) poli(g, piedra, [[i, -5], [i + 2.4, -5], [i + 2.4, -7], [i, -7]]);
    poli(g, "#2a2018", [[-2.4, 0], [2.4, 0], [2.4, -3.4], [0, -4.8], [-2.4, -3.4]]);
    [-18, 18].forEach(x => { poli(g, piedra, [[x - 2.6, 0], [x + 2.6, 0], [x + 2.6, -9], [x - 2.6, -9]]); poli(g, tejado2, [[x - 3.4, -9], [x + 3.4, -9], [x, -14]]); });
  }
  // casas: más cuanto mayor es la ciudad
  const sitios = [[-9, -6, 7, 6], [8, -6, 7.4, 6.4], [-1, -8, 7, 7], [-13, -10, 6, 5], [13, -11, 6, 5.4], [5, -13, 6.4, 6]];
  sitios.slice(0, Math.min(sitios.length, 2 + n)).sort((a, b) => a[1] - b[1]).forEach((s, i) => casa(g, s[0], s[1] + 1, s[2], s[3], i % 2 ? tejado2 : tejado, muro));
  if (d.capital) {
    // la torre del homenaje
    poli(g, "#b8ae9c", [[-4.4, -8], [4.4, -8], [4, -25], [-4, -25]]); poli(g, "rgba(0,0,0,.3)", [[0, -8], [4.4, -8], [4, -25], [0, -25]]);
    for (let i = -4.4; i < 4; i += 2.9) poli(g, "#b8ae9c", [[i, -25], [i + 1.8, -25], [i + 1.8, -27], [i, -27]]);
    poli(g, tejado, [[-5, -27], [5, -27], [0, -35]]); poli(g, "rgba(0,0,0,.25)", [[0, -35], [5, -27], [0, -27]]);
    g.fillStyle = "#f6d67a"; g.fillRect(-0.9, -20, 1.8, 3.4); g.fillRect(-0.9, -14, 1.8, 3);
  } else if (n >= 3) {
    poli(g, "#b8ae9c", [[-2.6, -12], [2.6, -12], [2.2, -23], [-2.2, -23]]); poli(g, tejado, [[-3.4, -23], [3.4, -23], [0, -29]]);
  }
  g.restore();
}
export function pintarFortaleza(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 44, S / 44);
  g.fillStyle = "rgba(0,0,0,.34)"; g.beginPath(); g.ellipse(0, 1, 17, 5.4, 0, 0, 7); g.fill();
  const p = "#7d766c", po = "#5a544c";
  poli(g, p, [[-13, 0], [13, 0], [12, -13], [-12, -13]]); poli(g, "rgba(0,0,0,.3)", [[2, 0], [13, 0], [12, -13], [2, -13]]);
  for (let i = -12; i < 12; i += 4.2) poli(g, p, [[i, -13], [i + 2.6, -13], [i + 2.6, -15.6], [i, -15.6]]);
  [-13, 13].forEach(x => { poli(g, po, [[x - 4, 0], [x + 4, 0], [x + 3.4, -20], [x - 3.4, -20]]); for (let i = -3.4; i < 3; i += 2.6) poli(g, po, [[x + i, -20], [x + i + 1.6, -20], [x + i + 1.6, -22.4], [x + i, -22.4]]); g.fillStyle = "#17120e"; g.fillRect(x - 0.6, -14, 1.2, 4); });
  poli(g, "#1c1611", [[-3, 0], [3, 0], [3, -6], [0, -8], [-3, -6]]);
  g.strokeStyle = "#3a322a"; g.lineWidth = 0.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-2 + i * 2, 0); g.lineTo(-2 + i * 2, -7); g.stroke(); }
  g.restore();
}
export function pintarRuinas(g: Ctx, S: number, saqueada: boolean): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 40, S / 40);
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(0, 1, 15, 4.6, 0, 0, 7); g.fill();
  const p = "#9a9284", po = "#6d665c";
  poli(g, p, [[-12, 0], [-8, 0], [-8, -17], [-10, -19], [-12, -16]]); poli(g, po, [[-10, 0], [-8, 0], [-8, -17], [-10, -19]]);
  poli(g, p, [[6, 0], [10, 0], [10, -11], [8, -9], [6, -12]]); poli(g, po, [[8, 0], [10, 0], [10, -11], [8, -9]]);
  poli(g, p, [[-12, -16], [-3, -20], [-2, -17.4], [-8, -15]]);
  poli(g, po, [[-3, 0], [3, 0], [2, -4], [-2, -3.4]]); poli(g, p, [[11, 0], [15, 0], [14, -3], [12, -2.6]]);
  g.strokeStyle = "rgba(70,100,60,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-9, -10); g.quadraticCurveTo(-6, -6, -8.4, -2); g.stroke();
  if (!saqueada) { poli(g, "#6a4a2c", [[-2.6, 0], [3, 0], [3, -3.6], [-2.6, -3.6]]); poli(g, "#e3bb4e", [[-2.6, -3.6], [3, -3.6], [2.4, -5.6], [-2, -5.6]]); g.fillStyle = "#fff4c8"; g.fillRect(-0.4, -3.4, 0.8, 1.6); }
  g.restore();
}
export function pintarNucleo(g: Ctx, S: number, capa: number): void {
  g.save(); g.translate(S / 2, S / 2); g.scale(S / 44, S / 44);
  if (capa === 0) {
    g.strokeStyle = "#f0d278"; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.stroke();
    g.lineWidth = 0.8; g.setLineDash([2, 3]); g.beginPath(); g.arc(0, 0, 20, 0, 7); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; poli(g, "#f0d278", [[Math.cos(a) * 17, Math.sin(a) * 17], [Math.cos(a + 0.1) * 13.4, Math.sin(a + 0.1) * 13.4], [Math.cos(a - 0.1) * 13.4, Math.sin(a - 0.1) * 13.4]]); }
  } else {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 12); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#ffe9a6"); gr.addColorStop(1, "rgba(240,210,120,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
    poli(g, "#fff6d6", [[0, -8], [2.6, 0], [0, 8], [-2.6, 0]]); poli(g, "#fff6d6", [[-8, 0], [0, -2.6], [8, 0], [0, 2.6]]);
  }
  g.restore();
}
export function pintarCostura(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S / 2); g.scale(S / 44, S / 44);
  for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(143,227,230,${0.9 - i * 0.25})`; g.lineWidth = 2 - i * 0.5; g.beginPath(); g.ellipse(0, 0, 8 + i * 4, 13 + i * 3, 0, 0.5 + i, 5.4 + i); g.stroke(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(143,227,230,0)");
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 6, 11, 0, 0, 7); g.fill();
  g.restore();
}
export function pintarMuro(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 40, S / 40);
  const gr = g.createLinearGradient(0, -26, 0, 0); gr.addColorStop(0, "rgba(185,140,255,.15)"); gr.addColorStop(1, "rgba(185,140,255,.75)");
  poli(g, gr, [[-13, 0], [13, 0], [11, -26], [-11, -26]]);
  g.strokeStyle = "#e9d6ff"; g.lineWidth = 1.2; g.strokeRect(-11.4, -25, 22.8, 24.4);
  g.beginPath(); g.moveTo(-5, -20); g.lineTo(0, -6); g.lineTo(5, -20); g.moveTo(-6, -12); g.lineTo(6, -12); g.stroke();
  g.restore();
}
/* Marca de terreno consagrado: un sol pequeño en el suelo */
export function pintarGlifo(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S / 2); g.scale(S / 40, S / 40);
  g.strokeStyle = "rgba(255,226,140,.7)"; g.lineWidth = 1.1; g.lineCap = "round";
  g.beginPath(); g.arc(0, 0, 4, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); g.lineTo(Math.cos(a) * (i % 2 ? 8 : 10), Math.sin(a) * (i % 2 ? 8 : 10)); g.stroke(); }
  g.restore();
}
export function pintarBandera(g: Ctx, S: number, col: string, forma: string): void {
  g.save(); g.scale(S / 40, S / 40);
  g.strokeStyle = "#2a2018"; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath(); g.moveTo(6, 38); g.lineTo(6, 4); g.stroke();
  g.fillStyle = "#e3bb4e"; g.beginPath(); g.arc(6, 3.4, 1.6, 0, 7); g.fill();
  poli(g, col, [[6, 5], [30, 7], [25, 13], [30, 19], [6, 21]]); poli(g, "rgba(0,0,0,.22)", [[6, 14], [26, 14.6], [30, 19], [6, 21]]);
  g.fillStyle = "rgba(255,255,255,.92)"; g.font = "bold 11px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(forma, 15, 13.4);
  g.restore();
}
export function pintarGema(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S / 2); g.scale(S / 20, S / 20);
  poli(g, "#f6d46c", [[0, -8], [6, -1], [0, 8], [-6, -1]]); poli(g, "#fff4c8", [[0, -8], [-6, -1], [0, -1]]); poli(g, "#b8922e", [[0, 8], [6, -1], [0, -1]]);
  g.restore();
}
export function pintarTumba(g: Ctx, S: number): void {
  g.save(); g.translate(S / 2, S * 0.8); g.scale(S / 20, S / 20);
  sombra(g, 5, 1.6);
  poli(g, "#8c8478", [[-3, 0], [3, 0], [3, -6], [0, -8.4], [-3, -6]]); poli(g, "rgba(0,0,0,.3)", [[0, 0], [3, 0], [3, -6], [0, -8.4]]);
  g.strokeStyle = "#3a342c"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -6.4); g.lineTo(0, -2.4); g.moveTo(-1.6, -5); g.lineTo(1.6, -5); g.stroke();
  g.restore();
}

/* =============================================================================
   NIEBLA, BRILLOS Y MARCAS
============================================================================= */
/* Niebla de guerra en un lienzo pequeño (R píxeles por casilla). Al estirarlo con suavizado los bordes salen blandos. */
export function pintarNiebla(c: HTMLCanvasElement, est: any, vis: number[], R: number): void {
  const g = c.getContext("2d") as Ctx, w = est.ancho, h = est.alto;
  g.clearRect(0, 0, c.width, c.height);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = vis[y * w + x];
    if (v === 2) continue;
    // El mar no lleva niebla (si no, el borde del mapa se nota como una franja). La tierra nunca vista queda casi
    // negra, así se intuye la silueta del continente; la ya explorada, en penumbra.
    const tt = est.casillas[y][x].t;
    if (tt === "vacio") continue;
    // Sobre el agua navegable la niebla es más leve: se sigue viendo que es mar
    if (tt === "agua") g.fillStyle = v === 1 ? "rgba(8,7,16,.3)" : "rgba(7,6,13,.55)";
    else g.fillStyle = v === 1 ? "rgba(8,7,16,.5)" : "rgba(7,6,13,.9)";
    g.fillRect(x * R, y * R, R, R);
  }
}
export function pintarBrillo(g: Ctx, S: number): void {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
}
export function pintarAnillo(g: Ctx, S: number): void {
  g.strokeStyle = "#fff"; g.lineWidth = S * 0.05; g.beginPath(); g.arc(S / 2, S / 2, S * 0.44, 0, 7); g.stroke();
  g.lineWidth = S * 0.015; g.globalAlpha = 0.5; g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, 7); g.stroke();
}
/* Aro que gira bajo la unidad elegida */
export function pintarAroSel(g: Ctx, S: number): void {
  g.translate(S / 2, S / 2);
  g.strokeStyle = "#fff"; g.lineWidth = S * 0.06; g.lineCap = "round";
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, S * 0.42, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + 1.2); g.stroke(); }
}
/* Tajo de un arma de filo */
export function pintarTajo(g: Ctx, S: number): void {
  const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(S * 0.08, S * 0.7); g.quadraticCurveTo(S * 0.5, S * 0.02, S * 0.92, S * 0.3); g.quadraticCurveTo(S * 0.5, S * 0.22, S * 0.08, S * 0.7); g.fill();
}
/* Dos espadas cruzadas: objetivo que se puede atacar */
export function pintarEspadas(g: Ctx, S: number): void {
  g.translate(S / 2, S / 2); g.scale(S / 24, S / 24);
  g.lineCap = "round";
  [[-1, 1], [1, 1]].forEach(([sx]) => {
    g.save(); g.scale(sx, 1); g.rotate(-0.78);
    g.strokeStyle = "#1a0c0a"; g.lineWidth = 3.4; g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -9); g.stroke();
    g.strokeStyle = "#ffe9e4"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -9); g.stroke();
    g.strokeStyle = "#e3bb4e"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-3, 4); g.lineTo(3, 4); g.moveTo(0, 4); g.lineTo(0, 8); g.stroke();
    g.restore();
  });
}
export function pintarHumo(g: Ctx, S: number): void {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,.8)"); gr.addColorStop(0.6, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
}
