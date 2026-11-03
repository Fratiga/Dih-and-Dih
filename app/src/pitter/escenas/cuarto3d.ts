import Phaser from "phaser";
import { ATLAS, type Region } from "../arte/caras.ts";
import { ALTO_HAB, ANCHO_HUECO, APOTEMA, ATLAS_BASE, ATLAS_TECHO, BARRA_INF, BARRA_SUP, BASE_H, FACHADA, LADO, LADO_CUMBRE, PASO_PISO, PISOS, PROF, RADIO_ESQUINA, SECTORES, TECHO_ALTO } from "../arte/mansion.ts";

/* Una habitacion de la mansion como caja 3D de verdad. La camara mira de frente a distancia DIST, un poco elevada y con una leve inclinacion; todos los pisos
   se proyectan con esa misma camara, asi que las fachadas de pisos contiguos encajan sin huecos. El interior (fondo, dos paredes, suelo y techo) se
   proyecta en triangulos que se recortan contra el hueco de la fachada; los personajes y muebles son carteles que siguen el mismo calculo. */

const DIST = 1700;
const EYREL = 110;
const PITCH = 0.1;
const SEN = Math.sin(PITCH);
const COS = Math.cos(PITCH);
const ZC = APOTEMA + DIST;
const F = EYREL * SEN + DIST * COS;
const YC0 = -EYREL * COS + DIST * SEN;
let EYw = 0;

/** Pone la camara a la altura de un piso (admite fracciones mientras se desplaza de uno a otro). */
export function fijarCamara(piso: number): void {
  EYw = piso * PASO_PISO + PASO_PISO / 2 + EYREL;
}

const out = [0, 0, 0, 0];
function proyectar(X: number, Y: number, Z: number): number[] {
  const ry = Y - EYw, rz = Z - ZC;
  const d = -ry * SEN - rz * COS;
  const yc = ry * COS - rz * SEN;
  const p = F / d;
  out[0] = X * p; out[1] = -yc * p + YC0; out[2] = p; out[3] = d;
  return out;
}

/** Donde cae en pantalla (espacio del mundo del menu) el centro de una fachada que mira de frente, en el piso f. */
export function centroFrontal(f: number): { x: number; y: number } {
  const o = proyectar(0, f * PASO_PISO + PASO_PISO / 2, APOTEMA);
  return { x: o[0], y: o[1] };
}

/** Mitad del ancho que ocupa el edificio en pantalla. */
export function semiancho(): number {
  let m = 0;
  for (let k = 0; k < SECTORES; k++) {
    const a = Math.PI / SECTORES + (k * Math.PI * 2) / SECTORES;
    const o = proyectar(RADIO_ESQUINA * Math.sin(a), EYw, RADIO_ESQUINA * Math.cos(a));
    m = Math.max(m, Math.abs(o[0]));
  }
  return m;
}

/** Y en pantalla del borde de arriba (o de abajo) de un piso, en el plano de la fachada frontal. */
export function bordePiso(f: number, arriba: boolean): number {
  return proyectar(0, arriba ? (f + 1) * PASO_PISO : f * PASO_PISO, APOTEMA)[1];
}

interface CaraDef {
  reg: Region;
  ns: number;
  nt: number;
  inner: [number, number, number];
  punto: (s: number, t: number) => [number, number, number];
}

const CARAS: CaraDef[] = [
  { reg: ATLAS.fondo, ns: 6, nt: 3, inner: [0, 0, -1], punto: (s, t) => [(s - 0.5) * ANCHO_HUECO, ALTO_HAB * (1 - t), PROF] },
  { reg: ATLAS.izq, ns: 8, nt: 3, inner: [1, 0, 0], punto: (s, t) => [-ANCHO_HUECO / 2, ALTO_HAB * (1 - t), PROF * (1 - s)] },
  { reg: ATLAS.der, ns: 8, nt: 3, inner: [-1, 0, 0], punto: (s, t) => [ANCHO_HUECO / 2, ALTO_HAB * (1 - t), PROF * s] },
  { reg: ATLAS.suelo, ns: 6, nt: 8, inner: [0, 1, 0], punto: (s, t) => [(s - 0.5) * ANCHO_HUECO, 0, PROF * (1 - t)] },
  { reg: ATLAS.techo, ns: 6, nt: 8, inner: [0, -1, 0], punto: (s, t) => [(s - 0.5) * ANCHO_HUECO, ALTO_HAB, PROF * (1 - t)] },
];

interface Malla { loc: Float32Array; uv: Float32Array; centro: [number, number, number] }
const MALLAS: Malla[] = CARAS.map((c) => {
  const loc = new Float32Array((c.ns + 1) * (c.nt + 1) * 3);
  const uv = new Float32Array((c.ns + 1) * (c.nt + 1) * 2);
  for (let j = 0; j <= c.nt; j++) for (let i = 0; i <= c.ns; i++) {
    const k = j * (c.ns + 1) + i;
    const [x, y, z] = c.punto(i / c.ns, j / c.nt);
    loc[k * 3] = x; loc[k * 3 + 1] = y; loc[k * 3 + 2] = z;
    uv[k * 2] = (c.reg.x + (i / c.ns) * c.reg.w) / ATLAS.w;
    uv[k * 2 + 1] = (c.reg.y + (j / c.nt) * c.reg.h) / ATLAS.h;
  }
  return { loc, uv, centro: c.punto(0.5, 0.5) };
});

/* Barras de ladrillo de la fachada, en el plano del hueco: [x0, y0, x1, y1, columnas, filas] en coordenadas locales. */
const M = (LADO - ANCHO_HUECO) / 2;
const BARRAS: Array<[number, number, number, number, number, number]> = [
  [-LADO / 2, ALTO_HAB, LADO / 2, ALTO_HAB + BARRA_SUP, 8, 1],
  [-LADO / 2, -BARRA_INF, LADO / 2, 0, 8, 1],
  [-LADO / 2, 0, -LADO / 2 + M, ALTO_HAB, 1, 4],
  [LADO / 2 - M, 0, LADO / 2, ALTO_HAB, 1, 4],
];

export interface Proyeccion { x: number; y: number; s: number; d: number; visible: boolean }

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export class Cuarto3D {
  grupo: Phaser.GameObjects.Container;
  malla?: Phaser.GameObjects.Mesh2D;
  marco: Phaser.GameObjects.Mesh2D;
  velo: Phaser.GameObjects.Graphics;
  /** Las cuatro esquinas del hueco en pantalla: x0, y0, x1, y1, x2, y2, x3, y3. */
  hueco = [0, 0, 0, 0, 0, 0, 0, 0];
  phi = 0;
  visible = false;
  abierta: boolean;
  private base: number;
  private sf = 0;
  private cf = 1;
  private ori = 1;

  constructor(escena: Phaser.Scene, readonly f: number, readonly i: number, abierta: boolean, atlas: string) {
    this.abierta = abierta;
    this.base = f * PASO_PISO + BARRA_INF;
    this.grupo = escena.add.container(0, 0);
    if (abierta) {
      this.malla = new Phaser.GameObjects.Mesh2D(escena, 0, 0, atlas, [], [], true);
      this.malla.setRenderAsTriangles(true).setDepth(0);
      this.grupo.add(this.malla);
    }
    this.marco = new Phaser.GameObjects.Mesh2D(escena, 0, 0, "mansion-fachada", [], [], true);
    this.marco.setRenderAsTriangles(true).setDepth(2000000);
    this.velo = escena.add.graphics().setDepth(2000001);
    this.grupo.add([this.marco, this.velo]);
  }

  /* De coordenadas locales de la habitacion (x a lo largo de la fachada, y hacia arriba, z hacia dentro) a las del mundo. */
  private mundo(lx: number, ly: number, lz: number): [number, number, number] {
    return [APOTEMA * this.sf + lx * this.cf - lz * this.sf, this.base + ly, APOTEMA * this.cf - lx * this.sf - lz * this.cf];
  }

  private pantalla(lx: number, ly: number, lz: number): number[] {
    const [X, Y, Z] = this.mundo(lx, ly, lz);
    return proyectar(X, Y, Z);
  }

  private dentro(x: number, y: number): boolean {
    const q = this.hueco;
    for (let e = 0; e < 4; e++) {
      const ax = q[e * 2], ay = q[e * 2 + 1], bx = q[((e + 1) % 4) * 2], by = q[((e + 1) % 4) * 2 + 1];
      if (((bx - ax) * (y - ay) - (by - ay) * (x - ax)) * this.ori < -0.01) return false;
    }
    return true;
  }

  /* Recorta un poligono (x, y, u, v) contra el hueco, que es convexo. */
  private recortar(poli: number[][]): number[][] {
    const q = this.hueco;
    let cur = poli;
    for (let e = 0; e < 4 && cur.length; e++) {
      const ax = q[e * 2], ay = q[e * 2 + 1], bx = q[((e + 1) % 4) * 2], by = q[((e + 1) % 4) * 2 + 1];
      const dist = (p: number[]): number => ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)) * this.ori;
      const nuevo: number[][] = [];
      for (let k = 0; k < cur.length; k++) {
        const a = cur[k], b = cur[(k + 1) % cur.length];
        const da = dist(a), db = dist(b);
        if (da >= 0) nuevo.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          nuevo.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
        }
      }
      cur = nuevo;
    }
    return cur;
  }

  /** Recalcula la habitacion para el angulo phi. luz va de 0 (oscuro) a 1 (normal). Devuelve si se ve. */
  actualizar(phi: number, luz: number, yMin: number, yMax: number): boolean {
    this.phi = phi;
    this.sf = Math.sin(phi);
    this.cf = Math.cos(phi);
    this.visible = false;
    if (ZC * this.cf - APOTEMA < 12) { this.grupo.setVisible(false); return false; }
    const hx = ANCHO_HUECO / 2;
    const q = this.hueco;
    const esq: Array<[number, number]> = [[-hx, 0], [-hx, ALTO_HAB], [hx, ALTO_HAB], [hx, 0]];
    let miny = 1e9, maxy = -1e9;
    esq.forEach(([x, y], k) => { const o = this.pantalla(x, y, 0); q[k * 2] = o[0]; q[k * 2 + 1] = o[1]; miny = Math.min(miny, o[1]); maxy = Math.max(maxy, o[1]); });
    if (maxy < yMin || miny > yMax) { this.grupo.setVisible(false); return false; }
    this.ori = ((q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0])) >= 0 ? 1 : -1;
    this.visible = true;
    this.grupo.setVisible(true);

    const g = Math.round(255 * clamp(luz, 0, 1));
    const tinte = (g << 16) | (g << 8) | g;
    if (this.malla) this.construirInterior(tinte);
    this.construirMarco(tinte);
    this.velo.clear();
    if (luz < 0.98) { this.velo.fillStyle(0x1a0d2e, clamp(1 - luz, 0, 0.85)); this.velo.fillPoints(this.puntos(), true); }
    return true;
  }

  private puntos(): Phaser.Math.Vector2[] {
    const q = this.hueco;
    return [0, 1, 2, 3].map((k) => new Phaser.Math.Vector2(q[k * 2], q[k * 2 + 1]));
  }

  private construirInterior(tinte: number): void {
    const V: number[] = [], I: number[] = [];
    const px = new Float32Array(64 * 3), py = new Float32Array(64 * 3);
    const ex = EYw;
    CARAS.forEach((cd, ci) => {
      const m = MALLAS[ci];
      // solo las caras que miran a la camara
      const [cx, cy, cz] = this.mundo(m.centro[0], m.centro[1], m.centro[2]);
      const nx = cd.inner[0] * this.cf - cd.inner[2] * this.sf, nz = -cd.inner[0] * this.sf - cd.inner[2] * this.cf, ny = cd.inner[1];
      if (nx * (0 - cx) + ny * (ex - cy) + nz * (ZC - cz) <= 0) return;
      const n = (cd.ns + 1) * (cd.nt + 1);
      const sx = n > px.length ? new Float32Array(n) : px, sy = n > py.length ? new Float32Array(n) : py;
      for (let k = 0; k < n; k++) {
        const o = this.pantalla(m.loc[k * 3], m.loc[k * 3 + 1], m.loc[k * 3 + 2]);
        sx[k] = o[0]; sy[k] = o[1];
      }
      const tri = (a: number, b: number, c: number): void => {
        const va = [sx[a], sy[a], m.uv[a * 2], m.uv[a * 2 + 1]], vb = [sx[b], sy[b], m.uv[b * 2], m.uv[b * 2 + 1]], vc = [sx[c], sy[c], m.uv[c * 2], m.uv[c * 2 + 1]];
        const todo = this.dentro(va[0], va[1]) && this.dentro(vb[0], vb[1]) && this.dentro(vc[0], vc[1]);
        const poli = todo ? [va, vb, vc] : this.recortar([va, vb, vc]);
        if (poli.length < 3) return;
        const b0 = V.length / 4;
        for (const p of poli) V.push(p[0], p[1], p[2], p[3]);
        for (let k = 1; k < poli.length - 1; k++) I.push(b0, b0 + k, b0 + k + 1, 0);
      };
      for (let j = 0; j < cd.nt; j++) for (let i = 0; i < cd.ns; i++) {
        const k00 = j * (cd.ns + 1) + i, k10 = k00 + 1, k01 = k00 + cd.ns + 1, k11 = k01 + 1;
        tri(k00, k10, k11);
        tri(k00, k11, k01);
      }
    });
    const mesh = this.malla as Phaser.GameObjects.Mesh2D;
    mesh.vertices = V;
    mesh.indices = I;
    (mesh as unknown as { tint: number }).tint = tinte;
    mesh.setVisible(I.length > 0);
  }

  private construirMarco(tinte: number): void {
    const V: number[] = [], I: number[] = [];
    const fb = FACHADA.ladrillo;
    const quad = (x0: number, y0: number, x1: number, y1: number, ns: number, nt: number, uv: (x: number, y: number) => [number, number]): void => {
      const b0 = V.length / 4;
      for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) {
        const lx = x0 + ((x1 - x0) * i) / ns, ly = y1 + ((y0 - y1) * j) / nt;
        const o = this.pantalla(lx, ly, 0);
        const [u, v] = uv(lx, ly);
        V.push(o[0], o[1], u, v);
      }
      for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
        const a = b0 + j * (ns + 1) + i, b = a + 1, c = a + ns + 1, d = c + 1;
        I.push(a, b, d, 0, a, d, c, 0);
      }
    };
    const ladrillo = (lx: number, ly: number): [number, number] => [(fb.x + ((lx + LADO / 2) / LADO) * fb.w) / FACHADA.w, (fb.y + ((ALTO_HAB + BARRA_SUP - ly) / PASO_PISO) * fb.h) / FACHADA.h];
    for (const [x0, y0, x1, y1, ns, nt] of BARRAS) quad(x0, y0, x1, y1, ns, nt, ladrillo);
    if (!this.abierta) {
      const pu = FACHADA.puerta;
      quad(-ANCHO_HUECO / 2, 0, ANCHO_HUECO / 2, ALTO_HAB, 4, 2, (lx, ly) => [(pu.x + ((lx + ANCHO_HUECO / 2) / ANCHO_HUECO) * pu.w) / FACHADA.w, (pu.y + ((ALTO_HAB - ly) / ALTO_HAB) * pu.h) / FACHADA.h]);
    }
    this.marco.vertices = V;
    this.marco.indices = I;
    (this.marco as unknown as { tint: number }).tint = tinte;
  }

  /** Lleva un punto del diorama plano (1500x760) a esta habitacion: lo que vive en el suelo se apoya en el, lo de la pared se pega al fondo. */
  proy(x: number, y: number, suelo: boolean): Proyeccion {
    let lx: number, ly: number, lz: number;
    if (suelo) {
      const f = clamp((y - 520) / 240, 0, 1);
      const xl = 300 * (1 - f), xr = 1200 + 300 * f;
      const u = clamp((x - xl) / (xr - xl), 0.04, 0.96);
      lx = (u - 0.5) * ANCHO_HUECO;
      lz = PROF * (0.9 - 0.78 * f);
      ly = 0;
    } else {
      const u = clamp((x - 300) / 900, 0.05, 0.95);
      lx = (u - 0.5) * ANCHO_HUECO;
      ly = clamp((520 - y) / 410, 0, 1) * ALTO_HAB;
      lz = PROF - 8;
    }
    const [X, Y, Z] = this.mundo(lx, ly, lz);
    const o = proyectar(X, Y, Z);
    return { x: o[0], y: o[1], s: o[2], d: Z, visible: this.visible && this.dentro(o[0], o[1]) };
  }

  /** Centro del hueco en pantalla. */
  centro(): { x: number; y: number } {
    const q = this.hueco;
    return { x: (q[0] + q[2] + q[4] + q[6]) / 4, y: (q[1] + q[3] + q[5] + q[7]) / 4 };
  }

  contiene(x: number, y: number): boolean {
    return this.visible && this.dentro(x, y);
  }

  /** Ancho del hueco en pantalla (para calcular el zoom de entrada). */
  anchoPantalla(): number {
    const q = this.hueco;
    return Math.hypot(q[6] - q[0], q[7] - q[1]);
  }
}

/* La planta baja y el tejado: una corona de SECTORES paredes que gira junto al piso de abajo (la base) o al de arriba (el tejado).
   Cada pared es un cuadrilatero proyectado con la misma camara; solo se dibujan las que miran al frente, de la mas lejana a la mas cercana. */
export class Corona3D {
  malla: Phaser.GameObjects.Mesh2D;

  constructor(escena: Phaser.Scene, clave: string, private tipo: "base" | "techo") {
    this.malla = new Phaser.GameObjects.Mesh2D(escena, 0, 0, clave, [], [], true);
    this.malla.setRenderAsTriangles(true);
  }

  /** th es el giro del piso con el que se mueve; luz de 0 a 1. */
  actualizar(th: number, luz: number): void {
    const paso = (Math.PI * 2) / SECTORES;
    const vis: Array<{ phi: number; i: number; cos: number }> = [];
    for (let i = 0; i < SECTORES; i++) {
      let phi = (th + i * paso) % (Math.PI * 2);
      if (phi > Math.PI) phi -= Math.PI * 2;
      if (phi <= -Math.PI) phi += Math.PI * 2;
      const cos = Math.cos(phi);
      if (ZC * cos - APOTEMA > 12) vis.push({ phi, i, cos });
    }
    vis.sort((a, b) => a.cos - b.cos);
    const V: number[] = [], I: number[] = [];
    const base = this.tipo === "base";
    const arriba = PISOS * PASO_PISO;
    const apCumbre = LADO_CUMBRE / (2 * Math.tan(Math.PI / SECTORES));
    const ns = 8, nt = base ? 1 : 4;
    const reg: { w: number; h: number } = base ? ATLAS_BASE : ATLAS_TECHO;
    for (const { phi, i } of vis) {
      const s = Math.sin(phi), c = Math.cos(phi);
      const mundo = (lx: number, ly: number, lz: number): [number, number, number] => [APOTEMA * s + lx * c - lz * s, ly, APOTEMA * c - lx * s - lz * c];
      // esquinas: abajo-izq, abajo-der, arriba-der, arriba-izq (x local, y mundo, z local hacia dentro)
      const esq: Array<[number, number, number]> = base
        ? [[-LADO / 2, -BASE_H, 0], [LADO / 2, -BASE_H, 0], [LADO / 2, 0, 0], [-LADO / 2, 0, 0]]
        : [[-LADO / 2, arriba, 0], [LADO / 2, arriba, 0], [LADO_CUMBRE / 2, arriba + TECHO_ALTO, APOTEMA - apCumbre], [-LADO_CUMBRE / 2, arriba + TECHO_ALTO, APOTEMA - apCumbre]];
      const r = base ? (i === 0 ? ATLAS_BASE.puerta : i % 2 ? ATLAS_BASE.ventana : ATLAS_BASE.macetas) : (i === 0 ? ATLAS_TECHO.buhardilla : ATLAS_TECHO.tejas);
      const b0 = V.length / 4;
      for (let j = 0; j <= nt; j++) for (let k = 0; k <= ns; k++) {
        const u = k / ns, v = j / nt;       // v=0 abajo, v=1 arriba
        const px = esq[0][0] * (1 - u) * (1 - v) + esq[1][0] * u * (1 - v) + esq[2][0] * u * v + esq[3][0] * (1 - u) * v;
        const py = esq[0][1] * (1 - u) * (1 - v) + esq[1][1] * u * (1 - v) + esq[2][1] * u * v + esq[3][1] * (1 - u) * v;
        const pz = esq[0][2] * (1 - u) * (1 - v) + esq[1][2] * u * (1 - v) + esq[2][2] * u * v + esq[3][2] * (1 - u) * v;
        const [X, Y, Z] = mundo(px, py, pz);
        const o = proyectar(X, Y, Z);
        V.push(o[0], o[1], (r.x + u * r.w) / reg.w, (r.y + (1 - v) * r.h) / reg.h);
      }
      for (let j = 0; j < nt; j++) for (let k = 0; k < ns; k++) {
        const a = b0 + j * (ns + 1) + k, bb = a + 1, cc = a + ns + 1, d = cc + 1;
        I.push(a, bb, d, 0, a, d, cc, 0);
      }
    }
    const gmax = vis.length ? Math.round(255 * clamp(luz, 0, 1)) : 255;
    this.malla.vertices = V;
    this.malla.indices = I;
    (this.malla as unknown as { tint: number }).tint = (gmax << 16) | (gmax << 8) | gmax;
    this.malla.setVisible(I.length > 0);
  }
}

/** Altura de la camara en el mundo. */
export function ojoY(): number {
  return EYw;
}

/** Las esquinas en pantalla (x0, y0, x1, y1...) de la losa octogonal de un anillo girado th, a la altura y del mundo. */
export function placa(th: number, y: number): number[] {
  const paso = (Math.PI * 2) / SECTORES;
  const pts: number[] = [];
  for (let k = 0; k < SECTORES; k++) {
    const a = th + (k + 0.5) * paso;
    const o = proyectar(RADIO_ESQUINA * Math.sin(a), y, RADIO_ESQUINA * Math.cos(a));
    pts.push(o[0], o[1]);
  }
  return pts;
}
