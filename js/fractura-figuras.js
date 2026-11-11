/* =============================================================================
   LA FRACTURA: figuras del tablero. Cada tropa se compone de piezas: un cuerpo, una cabeza, un arma y,
   si toca, escudo y capa. La receta sale del ejército y de la clase, así un Legionario de Balutia y un
   Guerrero de clan de Okran comparten reglas pero no silueta. Los héroes y las bestias tienen la suya.
   Se dibujan mirando a la derecha, con los pies en (0,0) y 40 unidades por casilla.
   También decide los colores y la marca (número y forma) de cada bando en una guerra.
   Uso: FracturaFiguras.figura(ctx, { faccion, clase, heroe }, bando, { x, y, s, ... })
============================================================================= */
window.FracturaFiguras = (function () {
  "use strict";
  const D = window.FRACTURA_DATOS;
  const { FACCIONES } = D;

  /* --- colores --- */
  const hex = h => { if (h[0] !== "#") { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const mezcla = (a, b, t) => { const x = hex(a), y = hex(b); return rgb(x.map((v, i) => v + (y[i] - v) * t)); };
  const oscuro = (c, t) => mezcla(c, "#000000", t);
  const claro = (c, t) => mezcla(c, "#ffffff", t);
  const distCol = (a, b) => { const x = hex(a), y = hex(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };

  /* Ocho colores de bando que no se confunden, y una forma por puesto para no depender solo del color */
  const PALETA_BANDOS = ["#d6453c", "#3d86e0", "#58b04f", "#e0b23a", "#a865dd", "#2fbfae", "#e07a2f", "#c9ccd4"];
  const FORMAS = ["●", "▲", "■", "◆", "★", "⬟", "✚", "⬢"];
  function coloresBando(est) {
    const usados = [];
    return est.jugadores.map((j, i) => {
      const f = FACCIONES[j.faccion] || FACCIONES[D.faccionReal(j.faccion)];
      let col = f.color;
      // Si el color del ejército se parece al de otro bando, se le da el de la paleta que más se aleje de los ya usados
      if (usados.some(u => distCol(u, col) < 120)) {
        let mejor = col, lejos = -1;
        PALETA_BANDOS.forEach(p => { const d = Math.min.apply(null, usados.map(u => distCol(u, p))); if (d > lejos) { lejos = d; mejor = p; } });
        col = mejor;
      }
      usados.push(col);
      return { col, ban: mezcla(col, "#0a0608", 0.62), forma: FORMAS[i % FORMAS.length], n: i + 1, faccion: j.faccion };
    });
  }
  const colorFaccion = id => { const f = FACCIONES[D.faccionReal(id)]; return { col: f.color, ban: f.bandera }; };

  /* --- pinceles --- */
  const PIEL = "#b8906c", ACERO = "#8a939e", MADERA = "#5a3d24", HUESO = "#d9d1bb", CUERO = "#4a3722", NEGRO = "#07060a", ORO = "#e3bb4e", BRONCE = "#b07a3c", LATON = "#c79a44";
  function F(K, c) { if (typeof c !== "string") return c; return K.flash > 0 ? mezcla(c[0] === "#" ? c : "#888888", "#ffffff", Math.min(1, K.flash)) : c; }
  function trazo(c, K, color, ancho, x1, y1, x2, y2) { c.strokeStyle = F(K, color); c.lineWidth = ancho; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function disco(c, K, color, x, y, r) { c.fillStyle = F(K, color); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function elipse(c, K, color, x, y, rx, ry, rot) { c.fillStyle = F(K, color); c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 7); c.fill(); }
  function poli(c, K, color, pts) { c.fillStyle = F(K, color); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function arco(c, K, color, ancho, x, y, r, a0, a1) { c.strokeStyle = F(K, color); c.lineWidth = ancho; c.lineCap = "round"; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
  function metal(K, base, x0, y0, x1, y1) { const g = K.c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, claro(base, 0.34)); g.addColorStop(0.4, base); g.addColorStop(1, oscuro(base, 0.72)); return g; }
  function ojoL(c, K, x, y, col) { const a = c.globalAlpha; c.globalAlpha = a * 0.4; disco(c, K, col, x, y, 2.5); c.globalAlpha = a; disco(c, K, col, x, y, 0.95); }
  function halo(c, K, col, x, y, r) { const a = c.globalAlpha; c.globalAlpha = a * 0.35; disco(c, K, col, x, y, r * 1.8); c.globalAlpha = a; disco(c, K, col, x, y, r); }

  function piernas(c, K, color, ancho) {
    const p = K.mov ? Math.sin(K.fase) * 5 : 0, lev = K.mov ? Math.max(0, Math.cos(K.fase)) * 2 : 0, lev2 = K.mov ? Math.max(0, -Math.cos(K.fase)) * 2 : 0, w = ancho || 3.8;
    trazo(c, K, color, w, -2.5, -13, -2.5 - p * 0.6, -1 - lev); trazo(c, K, color, w, 2.5, -13, 2.5 + p * 0.6, -1 - lev2);
    trazo(c, K, "#121014", w - 0.6, -2.5 - p * 0.6, -1.6 - lev, -1.2 - p * 0.6, -1 - lev); trazo(c, K, "#121014", w - 0.6, 2.5 + p * 0.6, -1.6 - lev2, 3.8 + p * 0.6, -1 - lev2);
  }
  function torso(c, K, color, ancho, alto, y0) { const w = ancho / 2; poli(c, K, color, [[-w, y0], [w, y0], [w * 0.8, y0 - alto], [-w * 0.8, y0 - alto]]); }
  /* La mano del arma: sw va de -1 (recogido) a 1 (golpe) */
  function mano(K, hombro, largo) { const ang = -0.5 + K.sw * 1.7 + (K.mov ? Math.sin(K.fase) * 0.25 : 0); return { x: hombro.x + Math.cos(ang) * largo, y: hombro.y + Math.sin(ang) * largo, ang }; }
  const capaAtras = (c, K, col, x0, x1) => poli(c, K, col, [[x0, -27], [x0 + 3, -27], [x1, -6], [x1 - 9, -9]]);

  /* =========================================================================
     CUERPOS. Dejan en K.h el hombro del brazo del arma y en K.brazo el color de la manga.
  ========================================================================= */
  const CUERPO = {
    placas(c, K, o) {
      piernas(c, K, "#32343c");
      const w = o.ancho || 13;
      torso(c, K, metal(K, o.metal || K.metal, -w / 2, -26, w / 2, -13), w, 13, -13);
      poli(c, K, K.col, [[-1.6, -13], [1.6, -13], [2.2, -25], [-2.2, -25]]);
      if (o.banda) trazo(c, K, K.col, 2.4, -w / 2 + 0.5, -23, w / 2 - 0.5, -23);
      K.h = { x: w / 2 - 1, y: -24 }; K.brazo = "#3a3d44";
    },
    cuero(c, K, o) {
      piernas(c, K, "#2a2218");
      torso(c, K, metal(K, o.cuero || CUERO, -5, -26, 5, -13), 11, 13, -13);
      trazo(c, K, oscuro(o.cuero || CUERO, 0.5), 2.2, -5, -26, 5, -14);
      trazo(c, K, K.col, 1.5, -5.3, -14.5, 5.3, -14.5);
      K.h = { x: 4.5, y: -24 }; K.brazo = oscuro(o.cuero || CUERO, 0.2);
    },
    tunica(c, K, o) {
      const t = o.tela || mezcla(K.ban, "#0c0a16", 0.25);
      poli(c, K, metal(K, oscuro(t, 0.12), -9, -14, 9, 0), [[-5, -15], [5, -15], [8.5, 0], [-8.5, 0]]);
      torso(c, K, metal(K, t, -5, -26, 5, -13), 11, 12, -13);
      trazo(c, K, K.col, 1.4, -5.5, -14.5, 5.5, -14.5);
      if (o.estola) { poli(c, K, K.col, [[-1.2, -25], [1.2, -25], [1.6, -6], [-1.6, -6]]); }
      K.h = { x: 5, y: -23 }; K.brazo = oscuro(t, 0.25);
    },
    abrigo(c, K, o) {
      const t = o.tela || "#22202a";
      piernas(c, K, "#17161c");
      poli(c, K, metal(K, t, -7, -27, 7, -5), [[-5.5, -27], [5.5, -27], [7.5, -6], [2, -5], [0, -12], [-2, -5], [-7.5, -6]]);
      poli(c, K, claro(t, 0.12), [[-1, -27], [3.5, -27], [0.8, -19]]);
      trazo(c, K, K.col, 1.2, 0.6, -19, 0.9, -14);
      K.h = { x: 5, y: -24 }; K.brazo = oscuro(t, 0.15);
    },
    pieles(c, K, o) {
      const piel = o.piel || PIEL;
      piernas(c, K, oscuro(piel, 0.25), 4.2);
      torso(c, K, metal(K, piel, -6, -27, 6, -13), 12.5, 14, -13);
      poli(c, K, "#4a3a2a", [[-6.6, -15], [6.6, -15], [7.6, -8], [4, -9.5], [1.5, -7], [-1.5, -9.5], [-4.5, -7], [-7.6, -8]]);
      poli(c, K, "#5a4632", [[-8, -27.5], [-1.5, -28.5], [-3, -22], [-8.5, -23]]);
      trazo(c, K, K.col, 1.6, -5, -20, 4.5, -16); trazo(c, K, K.col, 1.2, -4, -24, -1, -22.5);
      K.h = { x: 5.5, y: -24.5 }; K.brazo = piel;
    },
    kimono(c, K, o) {
      const t = o.tela || mezcla(K.ban, "#1c2420", 0.3);
      piernas(c, K, "#1e1c22");
      poli(c, K, metal(K, t, -7, -27, 7, -7), [[-5, -27], [5, -27], [7.2, -8], [-7.2, -8]]);
      poli(c, K, claro(t, 0.2), [[-1.5, -27], [4.5, -27], [-2.5, -15.5]]);
      trazo(c, K, K.col, 2.2, -6.4, -15, 6.4, -15);
      poli(c, K, oscuro(t, 0.2), [[-5, -26], [-9.5, -17], [-5.5, -15.5]]);
      K.h = { x: 5, y: -24 }; K.brazo = oscuro(t, 0.1);
    },
    jubon(c, K, o) {
      piernas(c, K, K.col, 4.2); trazo(c, K, K.ban, 1.6, -2.5, -12, -2.5, -5); trazo(c, K, K.ban, 1.6, 2.5, -12, 2.5, -5);
      torso(c, K, metal(K, K.col, -6, -26, 6, -13), 12.5, 13, -13);
      [-3.4, 0, 3.4].forEach(x => trazo(c, K, K.ban, 1.4, x, -25, x * 1.15, -14));
      disco(c, K, K.col, -6.5, -24, 3.2); disco(c, K, K.col, 6.5, -24, 3.2); trazo(c, K, K.ban, 1, -6.5, -26.5, -6.5, -21.5); trazo(c, K, K.ban, 1, 6.5, -26.5, 6.5, -21.5);
      K.h = { x: 6, y: -24 }; K.brazo = K.col;
    },
    legion(c, K, o) {
      piernas(c, K, PIEL, 3.4);
      poli(c, K, K.col, [[-6, -15], [6, -15], [6.8, -8.5], [-6.8, -8.5]]);
      [-5, -2.5, 0, 2.5, 5].forEach(x => trazo(c, K, "#6a4a2c", 1.5, x, -14, x * 1.08, -8.5));
      const m = o.metal || K.metal;
      torso(c, K, metal(K, m, -6, -27, 6, -14), 12.5, 13, -14);
      [-17.5, -20.5, -23.5].forEach(y => trazo(c, K, oscuro(m, 0.5), 0.8, -5.8, y, 5.8, y));
      disco(c, K, metal(K, m, -8, -27, -4, -22), -6.4, -25, 3); disco(c, K, metal(K, m, 4, -27, 8, -22), 6.4, -25, 3);
      K.h = { x: 6, y: -24 }; K.brazo = PIEL;
    },
    huesos(c, K, o) {
      const carne = o.carne || "#7a8670", tela = oscuro(K.ban, 0.3);
      piernas(c, K, oscuro(carne, 0.12));
      poli(c, K, tela, [[-6, -27], [4, -27], [7, -14], [9, -6], [6, -9], [4, -3], [1, -8], [-2, -3], [-5, -8], [-9, -4], [-8, -14]]);
      poli(c, K, carne, [[-3.6, -26], [3.6, -26], [3, -14], [-3, -14]]);
      for (let i = 0; i < 3; i++) trazo(c, K, "#d6cdb4", 1.1, -3, -23 + i * 3.4, 3, -23 + i * 3.4);
      if (!o.sinHombrera) { poli(c, K, "#6b5240", [[-8.5, -27], [-2, -28.5], [-3, -22.5], [-9, -23.5]]); poli(c, K, "#8a6a52", [[-7, -27], [-6.3, -32], [-4.6, -28]]); }
      K.h = { x: 4, y: -23 }; K.brazo = carne;
    },
    mole(c, K, o) {
      const piel = o.piel || "#6d7a62";
      trazo(c, K, oscuro(piel, 0.2), 5.4, -4, -13, -4.5 - (K.mov ? Math.sin(K.fase) * 3 : 0), -1); trazo(c, K, oscuro(piel, 0.2), 5.4, 4, -13, 4.5 + (K.mov ? Math.sin(K.fase) * 3 : 0), -1);
      c.fillStyle = F(K, metal(K, piel, -10, -30, 10, -11)); c.beginPath(); c.ellipse(0, -21, 10.5, 10.5, 0, 0, 7); c.fill();
      if (o.cosido) { trazo(c, K, "#2a1c1c", 1, -6, -27, 5, -14); for (let i = 0; i < 5; i++) trazo(c, K, "#2a1c1c", 0.9, -5 + i * 2.2 - 1, -24.5 + i * 2.6, -5 + i * 2.2 + 1.2, -26.5 + i * 2.6); poli(c, K, metal(K, "#5d5f66", 2, -28, 9, -20), [[2, -29], [9.5, -27], [9, -20], [3, -21]]); }
      if (o.pelo) { poli(c, K, oscuro(piel, 0.35), [[-10, -22], [-8, -31], [-3, -32], [-6, -24]]); trazo(c, K, K.col, 1.6, -7, -18, 7, -15); }
      K.h = { x: 8, y: -26 }; K.brazo = piel; K.grande = true;
    },
    insecto(c, K, o) {
      const q = o.quitina || "#6b4a2a", p = K.mov ? Math.sin(K.fase) * 3 : 0;
      elipse(c, K, metal(K, oscuro(q, 0.15), -14, -18, -2, -6), -7, -11, 7.5, 5.2, -0.35);
      trazo(c, K, oscuro(q, 0.6), 0.8, -11, -14, -4, -8.5); trazo(c, K, oscuro(q, 0.6), 0.8, -9, -15.5, -2.5, -10);
      [[-6, -p], [-2, p], [3, -p]].forEach(([x, d]) => { trazo(c, K, oscuro(q, 0.35), 1.7, x, -12, x + 2 + d * 0.5, -6); trazo(c, K, oscuro(q, 0.35), 1.5, x + 2 + d * 0.5, -6, x + 1 + d, -0.5); });
      poli(c, K, metal(K, q, -4, -28, 5, -12), [[-3.2, -12], [3.6, -12], [5, -22], [3.4, -28], [-3, -28], [-4.4, -22]]);
      trazo(c, K, K.col, 1.5, -4, -20, 4.6, -20);
      trazo(c, K, oscuro(q, 0.3), 1.6, -3, -23, -8, -19); trazo(c, K, oscuro(q, 0.3), 1.4, -8, -19, -6.5, -15);
      K.h = { x: 4, y: -25 }; K.brazo = oscuro(q, 0.25);
    },
    maquina(c, K, o) {
      const m = o.metal || LATON, p = K.mov ? Math.sin(K.fase) * 4 : 0;
      trazo(c, K, "#3a3530", 4.6, -3, -12, -3 - p * 0.5, -1.5); trazo(c, K, "#3a3530", 4.6, 3, -12, 3 + p * 0.5, -1.5);
      trazo(c, K, m, 2, -3, -8, -3 - p * 0.3, -5); trazo(c, K, m, 2, 3, -8, 3 + p * 0.3, -5);
      poli(c, K, metal(K, m, -7, -28, 7, -11), [[-6.5, -11.5], [6.5, -11.5], [7.2, -27], [-7.2, -27]]);
      [[-5, -25], [5, -25], [-5, -14], [5, -14]].forEach(q => disco(c, K, oscuro(m, 0.55), q[0], q[1], 0.9));
      halo(c, K, o.nucleo || "#7fe3ff", 0, -19.5, 2.4);
      c.strokeStyle = F(K, oscuro(m, 0.5)); c.lineWidth = 1; c.beginPath(); c.arc(0, -19.5, 4.2, 0, 7); c.stroke();
      K.h = { x: 7, y: -24 }; K.brazo = oscuro(m, 0.35);
    },
    harapos(c, K, o) {
      const carne = o.carne || "#7d8a72";
      piernas(c, K, "#3a3630");
      poli(c, K, "#4c4338", [[-5.5, -26], [5.5, -26], [6.4, -12], [3, -9], [0, -13], [-3, -9], [-6.4, -12]]);
      poli(c, K, carne, [[-2, -26], [3, -26], [1, -19]]);
      trazo(c, K, K.col, 1.6, -5, -17, 5, -15);
      K.h = { x: 5, y: -24 }; K.brazo = carne;
    }
  };

  /* =========================================================================
     CABEZAS. Centro aproximado (0,-33). Casi nadie enseña la cara: ojos encendidos en la sombra.
  ========================================================================= */
  const visor = (c, K, ojo, y) => { poli(c, K, NEGRO, [[0.8, y - 1.1], [5.4, y - 1.1], [5.4, y + 1.1], [0.8, y + 1.1]]); ojoL(c, K, 3.6, y, ojo); };
  const sombraCara = (c, K, ojo, dos) => { poli(c, K, NEGRO, [[-1, -33.5], [5.4, -33], [5.2, -27.2], [-1, -27]]); ojoL(c, K, 1.8, -30.6, ojo); if (dos !== false) ojoL(c, K, 4.4, -30.4, ojo); };
  const CABEZA = {
    yelmo(c, K, o) { poli(c, K, metal(K, o.metal || K.metal, -5, -38, 5, -28), [[-5.2, -28], [5.2, -28], [4.8, -35], [0, -38.6], [-4.8, -35]]); visor(c, K, o.ojo || "#ffbe4a", -32.3); trazo(c, K, "#2a2c30", 1.2, -5, -28.5, 5, -28.5); },
    capacete(c, K, o) { sombraCara(c, K, o.ojo || "#ffc86a", false); poli(c, K, metal(K, o.metal || K.metal, -6, -39, 6, -33), [[-4.4, -33.5], [4.6, -33.5], [3.8, -38], [0, -39.4], [-3.6, -38]]); poli(c, K, metal(K, o.metal || K.metal, -8, -34, 8, -32), [[-7.6, -32.6], [7.8, -32.6], [6, -34.4], [-5.8, -34.4]]); poli(c, K, "#3b3f46", [[-4.6, -32.5], [-1, -32.5], [-1, -27], [-5, -27]]); },
    cerrado(c, K, o) { poli(c, K, K.col, [[-1.6, -40], [1.6, -40], [4.5, -47], [-3, -45]]); poli(c, K, metal(K, o.metal || K.metal, -6.4, -41, 6.4, -28), [[-6.2, -28], [6.2, -28], [6, -37], [0, -41], [-6, -37]]); visor(c, K, o.ojo || "#ffb84a", -34.1); [[3, -31], [4.4, -30], [3, -29]].forEach(p => disco(c, K, NEGRO, p[0], p[1], 0.45)); },
    granYelmo(c, K, o) { poli(c, K, metal(K, o.metal || "#c9ccd0", -6, -40, 6, -27), [[-5.6, -27.5], [5.8, -27.5], [5.8, -38.5], [-5.6, -38.5]]); poli(c, K, metal(K, "#dfe2e6", -6, -41, 6, -38), [[-5.2, -38.5], [5.4, -38.5], [4, -40.6], [-3.8, -40.6]]); poli(c, K, NEGRO, [[0.4, -34.6], [5.8, -34.6], [5.8, -33.2], [0.4, -33.2]]); poli(c, K, NEGRO, [[2.6, -37], [3.8, -37], [3.8, -29.5], [2.6, -29.5]]); ojoL(c, K, 4.6, -33.9, o.ojo || "#ffe08a"); if (o.halo) { c.strokeStyle = F(K, ORO); c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, -42.5, 6, 1.9, 0, 0, 7); c.stroke(); } },
    capucha(c, K, o) { const t = o.tela || oscuro(K.ban, 0.1); poli(c, K, t, [[-6, -26], [-1.5, -40], [6, -29], [5, -25], [-4, -25]]); sombraCara(c, K, o.ojo || "#ffbe4a", o.dos); if (o.pico) poli(c, K, HUESO, [[2.5, -33], [10, -29.5], [2.5, -28]]); },
    capuchaPunta(c, K, o) { const t = o.tela || mezcla(K.ban, "#0c0a16", 0.4); poli(c, K, t, [[-6.5, -26], [0.5, -45 - (o.alto || 0)], [6.5, -26], [3, -24], [-3, -24]]); poli(c, K, NEGRO, [[-1, -33], [5, -33], [5, -27], [-1, -27]]); ojoL(c, K, 1.5, -30.5, o.ojo || "#8fe8ff"); ojoL(c, K, 4.4, -30.5, o.ojo || "#8fe8ff"); if (o.calavera) { poli(c, K, HUESO, [[0.2, -32.6], [5, -32.6], [4.6, -27.6], [0.6, -27.6]]); disco(c, K, NEGRO, 1.8, -30.6, 0.9); disco(c, K, NEGRO, 4, -30.6, 0.9); ojoL(c, K, 1.8, -30.6, o.ojo || "#b6f26a"); } },
    sombreroAla(c, K, o) { const t = o.tela || "#3a2e22"; sombraCara(c, K, o.ojo || "#ffcf6a", false); poli(c, K, oscuro(t, 0.3), [[-1, -29], [5.6, -29], [5.2, -25.5], [-1.4, -25.5]]); poli(c, K, t, [[-9.5, -33], [10, -33], [7, -34.6], [-7, -34.6]]); poli(c, K, claro(t, 0.08), [[-4.6, -34.4], [4.8, -34.4], [3.6, -39.5], [-3.2, -39.8]]); trazo(c, K, K.col, 1.2, -4.4, -35, 4.6, -35); if (o.pluma) poli(c, K, K.col, [[-3, -38], [-9, -44], [-5.5, -37]]); },
    sombreroPico(c, K, o) { const t = o.tela || mezcla(K.ban, "#0c0a16", 0.35); poli(c, K, "#e6e2da", [[2.5, -28], [6.5, -26], [4, -14], [1, -22]]); poli(c, K, NEGRO, [[-1.5, -33], [5.5, -33], [5.5, -27.5], [-1.5, -27.5]]); ojoL(c, K, 1.5, -30.4, o.ojo || "#d6e8ff"); ojoL(c, K, 4.5, -30.4, o.ojo || "#d6e8ff"); poli(c, K, t, [[-9, -32], [9, -32], [6, -34], [3, -49], [-1, -47], [-5, -34]]); trazo(c, K, K.col, 1.2, -8, -32.6, 8, -32.6); },
    plumas(c, K, o) { sombraCara(c, K, o.ojo || "#ffd24a", false); poli(c, K, "#2e2622", [[-1.5, -29], [5.4, -29], [4.8, -25.6], [-1.6, -25.6]]); poli(c, K, K.ban, [[-8.5, -33.4], [8.5, -34.8], [6.5, -37], [-6, -36.4]]); poli(c, K, K.col, [[-5, -36], [5.5, -36.6], [4, -39.6], [-3.6, -39.4]]); poli(c, K, "#f2ead6", [[-4, -38], [-12, -43], [-10.5, -38.5], [-13, -37], [-5, -35.6]]); poli(c, K, K.col, [[-4, -39], [-9, -47], [-6, -39.5]]); },
    morrion(c, K, o) { sombraCara(c, K, o.ojo || "#ffd24a", false); const m = o.metal || K.metal; poli(c, K, metal(K, m, -6, -40, 6, -32), [[-5, -32.6], [5.2, -32.6], [4, -38], [0, -40.4], [-4, -38]]); poli(c, K, metal(K, m, -8, -34, 9, -31), [[-8.6, -31], [0, -33.4], [9, -31], [0, -32]]); trazo(c, K, oscuro(m, 0.4), 1.4, -3, -39.6, 3.4, -39.6); poli(c, K, metal(K, m, -1, -43, 1, -39), [[-3.4, -39.4], [0, -43.4], [3.6, -39.4]]); },
    parche(c, K, o) { disco(c, K, "#54392a", 0.5, -30.5, 4.7); poli(c, K, "#2e2622", [[-4.6, -29.5], [5, -29.5], [4, -25.5], [-3.5, -25.5]]); poli(c, K, K.col, [[-5.2, -33.5], [5.2, -33.5], [5, -35.6], [-4.8, -36]]); poli(c, K, oscuro(K.col, 0.25), [[-5, -34], [-9, -31.5], [-6.5, -30]]); disco(c, K, "#090606", -1.8, -31.6, 1.6); ojoL(c, K, 2.6, -31.6, o.ojo || "#ffd24a"); },
    antifaz(c, K, o) { disco(c, K, PIEL, 0.6, -31, 4.6); poli(c, K, "#17131a", [[-4.4, -33.4], [5.4, -33.4], [5, -30.2], [-4, -30.2]]); ojoL(c, K, 0.4, -31.8, o.ojo || "#a8f0d6"); ojoL(c, K, 3.4, -31.8, o.ojo || "#a8f0d6"); poli(c, K, "#17131a", [[-5, -34.5], [5.4, -34.5], [3.6, -37.6], [-3.4, -37.6]]); if (o.liso) { disco(c, K, "#e9e4da", 0.8, -31, 4.4); disco(c, K, NEGRO, -0.6, -31.6, 0.8); disco(c, K, NEGRO, 2.6, -31.6, 0.8); ojoL(c, K, 2.6, -31.6, o.ojo || "#c9a6ff"); poli(c, K, mezcla(K.col, "#201830", 0.3), [[-6, -27], [-3, -38], [3.4, -38.6], [-1, -34], [-4, -27]]); } },
    fedora(c, K, o) { const t = o.tela || "#1d1b24"; sombraCara(c, K, o.ojo || "#ff9a5a", false); poli(c, K, claro(t, 0.1), [[-2.6, -29.4], [5.6, -29.4], [5.6, -25.2], [-3, -25.2]]); poli(c, K, t, [[-8.8, -33.2], [9.4, -32.6], [7, -34.6], [-6.4, -35]]); poli(c, K, t, [[-4.8, -34.6], [5, -34.4], [4.4, -39.2], [1, -38.2], [-3.6, -39.6]]); trazo(c, K, K.col, 1.3, -4.6, -35.4, 4.9, -35.2); if (o.cigarro) { trazo(c, K, "#e9e4da", 0.8, 5.4, -28, 8.2, -27.6); halo(c, K, "#ff8a3a", 8.4, -27.6, 0.7); } },
    bufanda(c, K, o) { disco(c, K, "#1d1b24", 0.3, -31, 4.8); poli(c, K, NEGRO, [[-1.5, -33.4], [5.2, -33.4], [5.2, -30.6], [-1.5, -30.6]]); ojoL(c, K, 1.4, -32, o.ojo || "#ffb86a"); ojoL(c, K, 4.2, -32, o.ojo || "#ffb86a"); poli(c, K, K.col, [[-4.6, -30.4], [5.4, -30.4], [5, -25.4], [-4.4, -25.4]]); poli(c, K, oscuro(K.col, 0.2), [[-4, -26], [-8, -19], [-5, -18.4], [-2, -25.6]]); poli(c, K, "#2a2832", [[-5.4, -34], [6.6, -34], [4.4, -36.6], [-3.6, -36.6]]); },
    gafas(c, K, o) { disco(c, K, o.piel || "#c79b78", 0.4, -31, 4.6); poli(c, K, "#4a3722", [[-4.6, -33.8], [5, -33.8], [3.4, -37.8], [-3.2, -37.8]]); trazo(c, K, "#2a2018", 1.6, -4.4, -32, 5.4, -32); halo(c, K, o.ojo || "#9be8ff", 0.6, -32, 1.9); halo(c, K, o.ojo || "#9be8ff", 4, -32, 1.9); c.strokeStyle = F(K, LATON); c.lineWidth = 0.9; c.beginPath(); c.arc(0.6, -32, 2.2, 0, 7); c.arc(4, -32, 2.2, 0, 7); c.stroke(); poli(c, K, "#3a3028", [[-1, -29.4], [5, -29.4], [4, -26], [0, -26]]); },
    kasa(c, K, o) { sombraCara(c, K, o.ojo || "#ffd98a", false); poli(c, K, oscuro(K.ban, 0.1), [[-1.6, -29.4], [5.4, -29.4], [4.8, -25.6], [-1.6, -25.6]]); poli(c, K, metal(K, o.paja || "#c9a964", -10, -38, 10, -32), [[-10.5, -32], [10.5, -32], [0.4, -39.6]]); trazo(c, K, oscuro(o.paja || "#c9a964", 0.4), 0.7, -6, -33, 0.4, -39); trazo(c, K, oscuro(o.paja || "#c9a964", 0.4), 0.7, 6.4, -33, 0.4, -39); if (o.cesta) poli(c, K, metal(K, "#b39554", -6, -40, 6, -27), [[-5.4, -27.6], [5.6, -27.6], [4.6, -40], [-4.4, -40]]), poli(c, K, NEGRO, [[0.5, -34], [5.2, -34], [5.2, -32.6], [0.5, -32.6]]), ojoL(c, K, 3.6, -33.3, o.ojo || "#ffd98a"); },
    cinta(c, K, o) { disco(c, K, o.piel || PIEL, 0.5, -31, 4.6); poli(c, K, "#17131a", [[-4.6, -34], [5, -34], [4, -38], [-2, -38.6], [-5, -36]]); poli(c, K, "#17131a", [[-3, -38.4], [-6.4, -42.4], [-1.4, -40.4]]); trazo(c, K, K.col, 1.5, -4.6, -33.8, 5.2, -33.8); poli(c, K, K.col, [[-4.6, -33.8], [-9.6, -31.6], [-9, -29.6], [-5, -32.6]]); disco(c, K, NEGRO, 2.6, -31.6, 0.8); ojoL(c, K, 2.6, -31.6, o.ojo || "#ffe0a0"); poli(c, K, oscuro(K.ban, 0.1), [[-1, -29.6], [5.2, -29.6], [4.6, -26], [-1, -26]]); },
    kabuto(c, K, o) { const m = o.metal || "#2b2a30"; poli(c, K, metal(K, m, -6, -40, 6, -30), [[-5.6, -31.6], [5.8, -31.6], [5, -37.4], [0, -40], [-5, -37.4]]); poli(c, K, metal(K, m, -8, -32, -4, -26), [[-5.8, -32], [-8.6, -26.4], [-4.4, -27.6]]); poli(c, K, metal(K, o.mascara || "#8a1f1f", 0, -32, 6, -26), [[-0.6, -31.8], [5.8, -31.8], [5.2, -26.2], [2.4, -25.2], [-0.4, -26.6]]); poli(c, K, HUESO, [[2, -27.4], [2.8, -25], [3.6, -27.4]]); ojoL(c, K, 1.4, -30, o.ojo || "#ffd24a"); ojoL(c, K, 4.2, -30, o.ojo || "#ffd24a"); c.strokeStyle = F(K, ORO); c.lineWidth = 1.5; c.lineCap = "round"; c.beginPath(); c.moveTo(-2.4, -38.4); c.quadraticCurveTo(-7, -42, -6.4, -47); c.moveTo(2.8, -38.4); c.quadraticCurveTo(7.4, -42, 6.8, -47); c.stroke(); },
    ninja(c, K, o) { disco(c, K, "#131217", 0.4, -31.4, 4.9); poli(c, K, o.piel || PIEL, [[-1, -33.2], [5.2, -33.2], [5.2, -30.8], [-1, -30.8]]); ojoL(c, K, 1.4, -32, o.ojo || "#a8f0d6"); ojoL(c, K, 4.2, -32, o.ojo || "#a8f0d6"); poli(c, K, K.col, [[-4.6, -34.4], [-9.4, -37], [-8.6, -34.4], [-10.4, -32.6], [-4.8, -32.6]]); },
    barbaro(c, K, o) { disco(c, K, o.piel || PIEL, 0.5, -31, 4.6); poli(c, K, "#3a2c20", [[-5.6, -27], [-5.4, -36], [-1, -38.4], [4, -37.4], [5.4, -33.8], [1, -34.4], [-2, -31]]); trazo(c, K, "#3a2c20", 1.6, -5, -29, -6.4, -21); poli(c, K, K.col, [[-0.4, -33], [5.2, -33.6], [5.2, -31.4], [0, -30.8]]); disco(c, K, NEGRO, 2.8, -31.9, 0.8); ojoL(c, K, 2.8, -31.9, o.ojo || "#ffd24a"); if (o.barba) poli(c, K, "#3a2c20", [[-0.6, -29], [5.2, -29.4], [3.4, -24], [0.6, -24.4]]); if (o.cuernos) { poli(c, K, HUESO, [[-3, -37.4], [-6.4, -43.6], [-1.4, -38.4]]); poli(c, K, HUESO, [[2.4, -37.6], [6.4, -43.4], [4.4, -37]]); poli(c, K, metal(K, K.metal, -5, -39, 5, -35), [[-5.2, -35.4], [5.4, -35.4], [4, -38.8], [-3.8, -38.8]]); } },
    craneoCiervo(c, K, o) { poli(c, K, "#3a2c20", [[-5.6, -26], [-4.6, -36], [0, -37.6], [-1, -27]]); poli(c, K, metal(K, HUESO, -2, -37, 8, -25), [[-1.6, -36.6], [3.4, -36.2], [8.6, -27.6], [7.4, -25.6], [2.4, -27.4], [-1.4, -28]]); disco(c, K, NEGRO, 1.8, -32.4, 1.5); ojoL(c, K, 1.8, -32.4, o.ojo || "#9af27a"); c.strokeStyle = F(K, HUESO); c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.moveTo(-1, -36.4); c.lineTo(-3.4, -43); c.lineTo(-6.6, -45); c.moveTo(-3.4, -43); c.lineTo(-2.4, -47); c.moveTo(1.6, -36.4); c.lineTo(3, -43.4); c.lineTo(6.4, -45.4); c.moveTo(3, -43.4); c.lineTo(1.6, -47); c.stroke(); },
    bestia(c, K, o) { const p = o.pelo || "#4a3626"; elipse(c, K, metal(K, p, -6, -40, 8, -26), 1, -32.4, 6.6, 6.4); poli(c, K, claro(p, 0.14), [[2, -31], [9.4, -30], [9, -26.4], [3, -26]]); disco(c, K, NEGRO, 8.4, -28.6, 0.8); ojoL(c, K, 3.6, -33.4, o.ojo || "#ffb03a"); c.strokeStyle = F(K, HUESO); c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(-3, -37); c.quadraticCurveTo(-9, -40, -7.4, -45.4); c.moveTo(4, -37.6); c.quadraticCurveTo(9.6, -40.6, 8, -45.6); c.stroke(); poli(c, K, oscuro(p, 0.3), [[-5.4, -30], [-8.4, -22], [-3.4, -26]]); },
    lobo(c, K, o) { const p = o.pelo || "#5a5650"; poli(c, K, metal(K, p, -5, -39, 9, -26), [[-5, -27], [-4.6, -36], [-2, -41.6], [0, -37], [3, -37.4], [10.4, -30.6], [9.6, -28], [3.4, -26.4]]); poli(c, K, oscuro(p, 0.35), [[-4.4, -36], [-5.4, -43], [-1.6, -38.4]]); disco(c, K, NEGRO, 10, -29.8, 0.9); ojoL(c, K, 3.4, -33, o.ojo || "#ffe36a"); poli(c, K, HUESO, [[6, -28], [6.8, -26], [7.6, -28.2]]); },
    tricornio(c, K, o) { sombraCara(c, K, o.ojo || "#ffcf6a", false); poli(c, K, o.panuelo ? K.col : "#2e2622", [[-1.5, -29.2], [5.4, -29.2], [4.8, -25.6], [-1.6, -25.6]]); const t = o.tela || "#22242c"; poli(c, K, t, [[-9.4, -32.6], [10.4, -33.4], [5, -36], [0, -39.4], [-5.4, -35.6]]); trazo(c, K, o.galon || ORO, 1, -9, -33, 0, -35.6); trazo(c, K, o.galon || ORO, 1, 0, -35.6, 10, -33.6); if (o.pluma) poli(c, K, K.col, [[-3, -36.6], [-10, -43.4], [-6, -36]]); },
    panuelo(c, K, o) { disco(c, K, o.piel || "#a9805c", 0.5, -31, 4.6); poli(c, K, K.col, [[-5.2, -33.4], [5.2, -33.4], [4.4, -37.6], [-3.6, -37.8]]); poli(c, K, oscuro(K.col, 0.25), [[-5, -34], [-9.4, -31.4], [-6.6, -30]]); disco(c, K, NEGRO, 2.6, -31.4, 0.8); ojoL(c, K, 2.6, -31.4, o.ojo || "#ffd24a"); poli(c, K, "#3a2c20", [[-0.4, -29], [5, -29.4], [3.6, -25.6], [0.4, -25.8]]); c.strokeStyle = F(K, ORO); c.lineWidth = 0.8; c.beginPath(); c.arc(-4.4, -29, 1.3, 0, 7); c.stroke(); },
    hormiga(c, K, o) { const q = o.quitina || "#6b4a2a"; elipse(c, K, metal(K, q, -5, -38, 6, -27), 0.8, -32.2, 5.6, 5.4); elipse(c, K, NEGRO, 3, -33, 2.4, 2.9, 0.3); halo(c, K, o.ojo || "#ffb03a", 3.2, -33, 1.2); c.strokeStyle = F(K, oscuro(q, 0.3)); c.lineWidth = 1.1; c.lineCap = "round"; c.beginPath(); c.moveTo(-1, -37); c.quadraticCurveTo(-2, -44, 4, -46); c.moveTo(2, -37.4); c.quadraticCurveTo(3, -43, 8.4, -43.4); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(3.4, -28.4); c.quadraticCurveTo(8, -27, 7.4, -24); c.moveTo(1.4, -27.6); c.quadraticCurveTo(4.6, -24.4, 7, -24.6); c.stroke(); if (o.corona) poli(c, K, "#f0b84a", [[-4, -37.4], [-3, -42], [-1, -38.6], [1, -43], [3, -38.6], [5, -41.6], [5.4, -37]]); },
    mantis(c, K, o) { const q = o.quitina || "#7a8a3a"; poli(c, K, metal(K, q, -5, -38, 6, -27), [[-5.4, -36.4], [6.4, -37.4], [1.6, -26.4]]); elipse(c, K, NEGRO, -3.2, -35.2, 2, 2.6, -0.4); elipse(c, K, NEGRO, 4.4, -35.8, 2, 2.6, 0.4); halo(c, K, o.ojo || "#e8ff7a", 4.4, -35.8, 1); halo(c, K, o.ojo || "#e8ff7a", -3, -35.2, 0.8); trazo(c, K, oscuro(q, 0.3), 0.9, -1, -37.4, -3, -45); trazo(c, K, oscuro(q, 0.3), 0.9, 2, -37.6, 5, -45.4); if (o.velo) { const a = c.globalAlpha; c.globalAlpha = a * 0.6; poli(c, K, K.col, [[-6, -36], [-9, -18], [-3, -22], [-1.4, -30]]); c.globalAlpha = a; } },
    escarabajo(c, K, o) { const q = o.quitina || "#3a3440"; elipse(c, K, metal(K, q, -6, -38, 7, -26), 0.6, -31.6, 6.4, 5.6); poli(c, K, metal(K, claro(q, 0.2), 2, -44, 10, -32), [[2.4, -35], [9.6, -43.6], [11, -41.4], [6, -31.6]]); poli(c, K, claro(q, 0.2), [[9.6, -43.6], [12.6, -45], [11, -41.4]]); ojoL(c, K, 3.4, -31, o.ojo || "#ff8a3a"); },
    lente(c, K, o) { const m = o.metal || LATON; poli(c, K, metal(K, m, -5, -38, 6, -27), [[-4.8, -27.4], [5.4, -27.4], [5.8, -36.6], [0.4, -38.8], [-5, -36.6]]); disco(c, K, NEGRO, 2.4, -32.4, 3.3); halo(c, K, o.ojo || "#7fe3ff", 2.4, -32.4, 1.9); c.strokeStyle = F(K, oscuro(m, 0.45)); c.lineWidth = 1; c.beginPath(); c.arc(2.4, -32.4, 3.5, 0, 7); c.stroke(); [[-3.4, -29], [-3.4, -35.4]].forEach(p => disco(c, K, oscuro(m, 0.5), p[0], p[1], 0.8)); if (o.antena) { trazo(c, K, oscuro(m, 0.4), 0.9, -2, -38, -3.4, -44.4); halo(c, K, "#ff6a4a", -3.4, -44.8, 0.8); } },
    galea(c, K, o) { const m = o.metal || BRONCE; sombraCara(c, K, o.ojo || "#ffd27a", false); poli(c, K, metal(K, m, -6, -40, 6, -31), [[-5.2, -32.4], [5.6, -32.4], [5, -37.6], [0, -40], [-5, -37.6]]); poli(c, K, metal(K, m, -6, -33, -2, -26), [[-5.4, -32.6], [-2, -32.6], [-2.6, -26.4], [-5.6, -27.6]]); poli(c, K, metal(K, m, 3, -33, 6, -27), [[3.6, -32.6], [5.8, -32.6], [5.4, -27.6]]); poli(c, K, m, [[4.4, -33.4], [7.6, -32.6], [4.6, -31.8]]); if (o.cresta === "t") poli(c, K, K.col, [[-7.4, -40.6], [7.8, -40.6], [6, -45], [-5.6, -45]]); else if (o.cresta) poli(c, K, K.col, [[-5.4, -38], [-2, -44.6], [3, -45], [5.6, -40.4], [0, -40.4]]); },
    laurel(c, K, o) { disco(c, K, o.piel || PIEL, 0.5, -31, 4.6); poli(c, K, "#2a2018", [[-5, -33.4], [-4, -37.6], [3.6, -37.6], [4.6, -34.4], [0, -35]]); disco(c, K, NEGRO, 2.6, -31.4, 0.8); ojoL(c, K, 2.6, -31.4, o.ojo || "#ffe0a0"); c.strokeStyle = F(K, ORO); c.lineWidth = 1.5; c.beginPath(); c.arc(0.2, -33.6, 5.2, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); [[-4.6, -35.6], [-2.4, -38], [3, -38.2], [5, -35.8]].forEach(p => disco(c, K, ORO, p[0], p[1], 1)); },
    calavera(c, K, o) { const tela = oscuro(K.ban, 0.3), carne = "#7a8670"; poli(c, K, tela, [[-6.5, -26], [-3, -38], [0.5, -43], [6, -31], [5, -25], [3, -23.5], [1, -25], [-1.5, -23.5], [-4, -25]]); poli(c, K, "#040306", [[-1.5, -35], [5, -33], [5, -27], [-1, -27]]); poli(c, K, carne, [[-0.8, -33.5], [4.6, -32.2], [4.4, -28], [-0.6, -28]]); poli(c, K, "#d6cdb4", [[1, -28.2], [4.4, -28.6], [3.8, -25.6], [1.4, -25.2]]); ojoL(c, K, 1.6, -31.2, o.ojo || "#c9f25a"); ojoL(c, K, 4, -30.6, o.ojo || "#c9f25a"); },
    zombi(c, K, o) { const carne = o.carne || "#7d8a72"; disco(c, K, carne, 0.6, -31.2, 4.8); poli(c, K, "#d6cdb4", [[1.4, -35.6], [5.2, -34], [5.2, -30.6], [2, -30.6]]); disco(c, K, NEGRO, 3.4, -32.4, 1.2); ojoL(c, K, 3.4, -32.4, o.ojo || "#c9f25a"); disco(c, K, NEGRO, -0.6, -32, 0.9); poli(c, K, "#2a2622", [[-4.6, -33.4], [-3.4, -37.4], [1, -37], [-1.4, -34.6]]); trazo(c, K, "#2a2018", 0.9, 0.6, -28, 4.4, -27.6); if (o.colmillos) { poli(c, K, HUESO, [[1.4, -28], [2, -25.6], [2.8, -28]]); poli(c, K, HUESO, [[3.4, -28], [4, -25.8], [4.6, -27.8]]); poli(c, K, carne, [[-3.6, -35], [-6.6, -39.6], [-2.4, -36.4]]); } },
    cosido(c, K, o) { const carne = o.carne || "#6d7a62"; disco(c, K, carne, 2.4, -34.6, 4.2); poli(c, K, metal(K, "#5d5f66", -1, -39, 4, -35), [[-1.6, -36], [3.6, -37.4], [3, -39.6], [-1, -38.6]]); disco(c, K, NEGRO, 4.2, -34.4, 1); ojoL(c, K, 4.2, -34.4, o.ojo || "#ff5a3a"); trazo(c, K, "#2a1c1c", 0.8, 0.4, -32, 5.6, -31.4); for (let i = 0; i < 4; i++) trazo(c, K, "#2a1c1c", 0.7, 1 + i * 1.3, -33, 1 + i * 1.3, -30.6); },
    vacia(c, K, o) { const m = o.metal || "#6b6f8a"; poli(c, K, metal(K, m, -6, -41, 6, -28), [[-5.6, -28], [5.8, -28], [5.4, -37.6], [0, -41], [-5.2, -37.6]]); poli(c, K, NEGRO, [[0.2, -35], [5.8, -35], [5.8, -31], [0.2, -31]]); halo(c, K, o.ojo || "#b98cff", 3.2, -33, 1.6); const a = c.globalAlpha; c.globalAlpha = a * 0.45; poli(c, K, o.ojo || "#b98cff", [[1, -35], [5, -35], [7, -42 - Math.sin(K.t * 4) * 2], [3, -39]]); c.globalAlpha = a; },
    mitra(c, K, o) { sombraCara(c, K, o.ojo || "#fff0b0", false); poli(c, K, "#e9e2cf", [[-1.4, -29.4], [5.2, -29.4], [3.8, -23.6], [0, -23.8]]); poli(c, K, metal(K, "#efe6cf", -5, -46, 5, -33), [[-5, -33.4], [5.2, -33.4], [4.4, -40], [0.2, -46.6], [-4.2, -40]]); trazo(c, K, K.col, 1.4, 0.1, -45, 0.1, -34); trazo(c, K, K.col, 1.4, -4.6, -36, 4.8, -36); },
    corona(c, K, o) { const m = o.metal || K.metal; poli(c, K, metal(K, m, -6.4, -41, 6.4, -28), [[-6.2, -28], [6.2, -28], [6, -38], [0, -40], [-6, -38]]); poli(c, K, NEGRO, [[0.5, -34], [6, -34], [6, -32], [0.5, -32]]); ojoL(c, K, 4.2, -33, o.ojo || "#ff5a3a"); poli(c, K, o.oro || "#f0cf6a", [[-6, -38], [6, -38], [7, -45], [3.5, -41.5], [0, -46], [-3.5, -41.5], [-7, -45]]); }
  };

  /* =========================================================================
     ARMAS Y ESCUDOS
  ========================================================================= */
  function hoja(c, K, h, largo, ancho, color, curva) {
    const a = h.ang - 0.1 + (curva || 0), x2 = h.x + Math.cos(a) * largo, y2 = h.y + Math.sin(a) * largo;
    trazo(c, K, "#2a2c30", ancho + 1.2, h.x, h.y, x2, y2); trazo(c, K, color || "#cfd6de", ancho, h.x, h.y, x2, y2);
    trazo(c, K, MADERA, 3, h.x - Math.cos(h.ang) * 2, h.y - Math.sin(h.ang) * 2, h.x + Math.cos(h.ang), h.y + Math.sin(h.ang));
    return { x: x2, y: y2 };
  }
  const brazo = (c, K, h, ancho) => trazo(c, K, K.brazo || "#3a3d44", ancho || 3, K.h.x, K.h.y, h.x, h.y);
  const asta = (c, K, h, largo, atras) => { const x2 = h.x + Math.cos(h.ang) * largo, y2 = h.y + Math.sin(h.ang) * largo; trazo(c, K, MADERA, 2.2, h.x - Math.cos(h.ang) * (atras || 6), h.y - Math.sin(h.ang) * (atras || 6), x2, y2); return { x: x2, y: y2 }; };
  const ARMA = {
    espada(c, K, o) { const h = mano(K, K.h, 8); brazo(c, K, h); hoja(c, K, h, o.largo || 14, o.ancho || 2.4, o.color); },
    espadon(c, K, o) { const h = mano(K, K.h, 8); brazo(c, K, h, 3.4); hoja(c, K, h, 19, 3.4, o.color); trazo(c, K, ORO, 1.6, h.x - 2.5, h.y - 2, h.x + 2.5, h.y + 2); },
    sable(c, K, o) { const h = mano(K, K.h, 7.5); brazo(c, K, h); hoja(c, K, h, o.largo || 14, 1.8, "#e6ebf0", -0.08); if (o.dos) { trazo(c, K, K.brazo, 2.6, -4, -23, -8, -19); trazo(c, K, "#2a2c30", 2.6, -8, -19, -14, -27); trazo(c, K, "#e6ebf0", 1.5, -8, -19, -14, -27); } },
    daga(c, K, o) { const h = mano(K, K.h, 6); brazo(c, K, h, 2.4); hoja(c, K, h, 8, 1.8); if (o.dos !== false) { trazo(c, K, K.brazo, 2.4, -4, -23, -8, -18); trazo(c, K, "#cfd6de", 1.8, -8, -18, -11, -22); } },
    lanza(c, K, o) { const h = mano(K, K.h, 6); brazo(c, K, h); const p = asta(c, K, h, o.largo || 19); poli(c, K, o.punta || "#cfd6de", [[p.x + Math.cos(h.ang) * 5, p.y + Math.sin(h.ang) * 5], [p.x - Math.sin(h.ang) * 1.8, p.y + Math.cos(h.ang) * 1.8], [p.x + Math.sin(h.ang) * 1.8, p.y - Math.cos(h.ang) * 1.8]]); if (o.travesano) trazo(c, K, "#cfd6de", 1.4, p.x - Math.sin(h.ang) * 3.4, p.y + Math.cos(h.ang) * 3.4, p.x + Math.sin(h.ang) * 3.4, p.y - Math.cos(h.ang) * 3.4); if (o.pendon) poli(c, K, K.ban, [[p.x, p.y], [p.x - 6, p.y - 3], [p.x - 5, p.y + 2]]); },
    alabarda(c, K, o) { const h = mano(K, K.h, 6); brazo(c, K, h); const p = asta(c, K, h, 19); const nx = -Math.sin(h.ang), ny = Math.cos(h.ang), dx = Math.cos(h.ang), dy = Math.sin(h.ang); poli(c, K, metal(K, "#cfd6de", p.x - 4, p.y - 4, p.x + 4, p.y + 4), [[p.x + dx * 6, p.y + dy * 6], [p.x + nx * 1.4, p.y + ny * 1.4], [p.x - nx * 1.2, p.y - ny * 1.2]]); poli(c, K, metal(K, "#b8c0c8", p.x - 5, p.y - 5, p.x + 5, p.y + 5), [[p.x - dx * 4 + nx * 5.4, p.y - dy * 4 + ny * 5.4], [p.x + dx * 1 + nx * 4.4, p.y + dy * 1 + ny * 4.4], [p.x, p.y], [p.x - dx * 5, p.y - dy * 5]]); if (o.curva) poli(c, K, "#cfd6de", [[p.x + dx * 8, p.y + dy * 8], [p.x + dx * 3 - nx * 3, p.y + dy * 3 - ny * 3], [p.x, p.y]]); },
    hacha(c, K, o) { const h = mano(K, K.h, 7); brazo(c, K, h, 3.4); const p = asta(c, K, h, o.largo || 12, 4); const nx = -Math.sin(h.ang), ny = Math.cos(h.ang), dx = Math.cos(h.ang), dy = Math.sin(h.ang); poli(c, K, metal(K, "#b8c0c8", p.x - 5, p.y - 5, p.x + 5, p.y + 5), [[p.x - dx * 4 + nx * 5.6, p.y - dy * 4 + ny * 5.6], [p.x + dx * 2 + nx * 5, p.y + dy * 2 + ny * 5], [p.x + dx, p.y + dy], [p.x - dx * 3, p.y - dy * 3]]); if (o.doble) poli(c, K, metal(K, "#b8c0c8", p.x - 5, p.y - 5, p.x + 5, p.y + 5), [[p.x - dx * 4 - nx * 5.6, p.y - dy * 4 - ny * 5.6], [p.x + dx * 2 - nx * 5, p.y + dy * 2 - ny * 5], [p.x + dx, p.y + dy], [p.x - dx * 3, p.y - dy * 3]]); if (o.dos) { trazo(c, K, K.brazo, 3, -5, -24, -9, -18); trazo(c, K, MADERA, 2, -9, -18, -13, -27); poli(c, K, "#b8c0c8", [[-13, -27], [-17.4, -26], [-16, -21.6], [-12, -24]]); } },
    maza(c, K, o) { const h = mano(K, K.h, 7); brazo(c, K, h, 3.2); const p = asta(c, K, h, o.tronco ? 15 : 9, 3); if (o.tronco) { trazo(c, K, "#4a3220", 5.4, h.x + Math.cos(h.ang) * 5, h.y + Math.sin(h.ang) * 5, p.x, p.y); [[0.4, 1], [0.7, -1], [0.95, 1]].forEach(([t, s]) => disco(c, K, "#8a8f98", h.x + Math.cos(h.ang) * 15 * t - Math.sin(h.ang) * 2.6 * s, h.y + Math.sin(h.ang) * 15 * t + Math.cos(h.ang) * 2.6 * s, 1.1)); } else { disco(c, K, metal(K, o.color || "#8a8f98", p.x - 3, p.y - 3, p.x + 3, p.y + 3), p.x, p.y, o.tubo ? 1.6 : 3.4); if (o.tubo) trazo(c, K, "#6d7178", 3, h.x, h.y, p.x, p.y); } },
    martillo(c, K, o) { const h = mano(K, K.h, 7); brazo(c, K, h, 3.2); const p = asta(c, K, h, 11, 3); const nx = -Math.sin(h.ang), ny = Math.cos(h.ang); trazo(c, K, "#3a3530", 6.4, p.x - nx * 4, p.y - ny * 4, p.x + nx * 4, p.y + ny * 4); trazo(c, K, o.color || LATON, 4.6, p.x - nx * 3.4, p.y - ny * 3.4, p.x + nx * 3.4, p.y + ny * 3.4); },
    arco(c, K, o) { const t = K.sw, r = o.largo ? 12 : 9, cy = o.largo ? -24 : -22; arco(c, K, o.color || MADERA, 2.4, 9, cy, r, -1.15 - t * 0.1, 1.15 + t * 0.1); const yx = 9 + Math.cos(1.15) * r, sy = Math.sin(1.15) * r; trazo(c, K, "#e8e2d0", 0.8, yx, cy - sy, 9 - t * 5, cy); trazo(c, K, "#e8e2d0", 0.8, yx, cy + sy, 9 - t * 5, cy); trazo(c, K, K.brazo || "#3a2c20", 2.6, 4, -23, 9 - t * 5, cy); if (t > 0.3 && t < 0.9) trazo(c, K, "#d8c9a6", 1.4, 9 - t * 5, cy, 19, cy); },
    ballesta(c, K, o) { const r = -K.sw * 4; trazo(c, K, MADERA, 3.2, 2 + r, -21, 15 + r, -22); c.strokeStyle = F(K, o.color || "#5a5d62"); c.lineWidth = 2.2; c.beginPath(); c.moveTo(10 + r, -27.6); c.lineTo(12.5 + r, -22); c.lineTo(10 + r, -16.4); c.stroke(); trazo(c, K, K.brazo || "#3a2c20", 2.6, 4, -23, 9 + r, -21.5); if (K.sw < 0.4) trazo(c, K, "#d8c9a6", 1.3, 6 + r, -22, 16 + r, -22); },
    pistola(c, K, o) { const r = -Math.max(0, K.sw) * 3; trazo(c, K, K.brazo || "#1d1b24", 2.8, K.h.x, K.h.y, 10 + r, -24); trazo(c, K, "#3a2c20", 2.6, 10 + r, -24, 10.6 + r, -21); trazo(c, K, "#6d7178", 2.2, 10 + r, -24.6, 17 + r, -24.6); if (K.sw > 0.45) fogonazo(c, K, 18 + r, -24.6); if (o.dos) { trazo(c, K, K.brazo || "#1d1b24", 2.6, -3, -23, 6, -19); trazo(c, K, "#6d7178", 2, 6, -19.4, 12, -19.4); } },
    fusil(c, K, o) { const r = -Math.max(0, K.sw) * 3; trazo(c, K, "#4a3220", 3, 0 + r, -22.6, 9 + r, -23.2); trazo(c, K, o.metal || "#6d7178", 2, 6 + r, -23.6, (o.largo || 21) + r, -24.4); trazo(c, K, K.brazo || "#3a2c20", 2.6, 4, -23, 9 + r, -22.6); trazo(c, K, K.brazo || "#3a2c20", 2.4, -3, -22, 3 + r, -21.4); if (K.sw > 0.45) fogonazo(c, K, (o.largo || 21) + 1.5 + r, -24.4); },
    tubo(c, K, o) { const r = -Math.max(0, K.sw) * 2.5; trazo(c, K, "#3a3530", 5.4, -1 + r, -25, 13 + r, -27); trazo(c, K, o.color || BRONCE, 4, 0 + r, -25.1, 12.4 + r, -26.9); trazo(c, K, K.brazo || "#3a2c20", 2.6, 4, -22, 7 + r, -24); if (K.sw > 0.45) { fogonazo(c, K, 15 + r, -27.2); fogonazo(c, K, 17.6 + r, -27.6); } },
    canon(c, K, o) { const r = -Math.max(0, K.sw) * 3; c.strokeStyle = F(K, "#4a3220"); c.lineWidth = 1.6; c.beginPath(); c.arc(11 + r, -4.4, 4.4, 0, 7); c.stroke(); trazo(c, K, "#4a3220", 1, 11 + r - 4.4, -4.4, 11 + r + 4.4, -4.4); trazo(c, K, "#4a3220", 1, 11 + r, -8.8, 11 + r, 0); trazo(c, K, "#2a2c30", 6.4, 6 + r, -9, 19 + r, -11); trazo(c, K, o.color || "#55585e", 5, 6.6 + r, -9.1, 18.4 + r, -10.9); trazo(c, K, K.brazo || "#3a2c20", 2.6, 4, -22, 7 + r, -13); if (K.sw > 0.45) { fogonazo(c, K, 21 + r, -11.2); fogonazo(c, K, 24 + r, -11.6); } },
    baston(c, K, o) { const h = mano(K, K.h, 6); trazo(c, K, K.brazo || "#2a2430", 2.6, K.h.x, K.h.y, h.x, h.y); const ox = h.x + Math.cos(h.ang) * 2, oy = h.y - 14 + K.sw * 2; trazo(c, K, o.madera || MADERA, 2, h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5 + 8, ox, oy); const col = o.orbe || "#8fd8ff", vivo = K.sw > 0.5 ? "#ffffff" : col; if (o.tipo === "calavera") { disco(c, K, HUESO, ox, oy - 2, 2.8); disco(c, K, NEGRO, ox - 0.9, oy - 2.4, 0.7); disco(c, K, NEGRO, ox + 1.1, oy - 2.4, 0.7); halo(c, K, vivo, ox, oy - 2.2, 0.6); } else if (o.tipo === "sol") { for (let i = 0; i < 8; i++) trazo(c, K, ORO, 0.9, ox, oy - 3, ox + Math.cos(i * 0.785) * 5, oy - 3 + Math.sin(i * 0.785) * 5); halo(c, K, vivo, ox, oy - 3, 2.4); } else if (o.tipo === "rombo") { const a = c.globalAlpha; c.globalAlpha = a * 0.4; disco(c, K, col, ox, oy - 3, 6); c.globalAlpha = a; poli(c, K, vivo, [[ox, oy - 8], [ox + 3.6, oy - 3], [ox, oy + 2], [ox - 3.6, oy - 3]]); } else if (o.tipo === "sonajas") { trazo(c, K, HUESO, 1.6, ox - 3, oy - 1, ox + 3, oy - 3); [[-3, 1.5], [0, 2.4], [3, 0.6]].forEach(p => disco(c, K, HUESO, ox + p[0], oy + p[1], 1)); halo(c, K, vivo, ox, oy - 4, 1.4); } else halo(c, K, vivo, ox, oy, 2.8); },
    incensario(c, K, o) { const h = mano(K, K.h, 6); trazo(c, K, K.brazo || "#2a2430", 2.6, K.h.x, K.h.y, h.x, h.y); const bal = Math.sin(K.t * 3 + K.sw * 3) * 2.4, x = h.x + bal, y = h.y + 9; trazo(c, K, "#8a8f98", 0.7, h.x, h.y, x, y); disco(c, K, metal(K, ORO, x - 2, y - 2, x + 2, y + 2), x, y + 1.4, 2.4); const a = c.globalAlpha; for (let i = 0; i < 3; i++) { c.globalAlpha = a * (0.3 - i * 0.08); disco(c, K, "#e9e4da", x + Math.sin(K.t * 2 + i) * 2, y - 3 - i * 4, 1.8 + i * 0.8); } c.globalAlpha = a; },
    jabalinas(c, K, o) { [-7, -5.4, -3.8].forEach(x => { trazo(c, K, o.color || HUESO, 1.2, x, -14, x + 2, -41); poli(c, K, "#cfd6de", [[x + 2.3, -43.4], [x + 1, -40.4], [x + 3.2, -40.6]]); }); const h = mano(K, K.h, 7); brazo(c, K, h, 2.8); const p = asta(c, K, h, 13, 8); poli(c, K, "#cfd6de", [[p.x + Math.cos(h.ang) * 4, p.y + Math.sin(h.ang) * 4], [p.x - Math.sin(h.ang) * 1.4, p.y + Math.cos(h.ang) * 1.4], [p.x + Math.sin(h.ang) * 1.4, p.y - Math.cos(h.ang) * 1.4]]); },
    frasco(c, K, o) { const h = mano(K, K.h, 7); brazo(c, K, h, 2.6); halo(c, K, o.color || "#9af27a", h.x + 1, h.y - 1.6, 2.4); trazo(c, K, "#3a3028", 1.4, h.x + 1, h.y - 4.4, h.x + 1, h.y - 5.6); [-4, -1.4, 1.2].forEach((x, i) => disco(c, K, [o.color || "#9af27a", "#ffb03a", "#c08aff"][i], x, -16.4 + i * 0.6, 1.4)); },
    garras(c, K, o) { const h = mano(K, K.h, 8); brazo(c, K, h, 2.8); for (let i = -1; i <= 1; i++) trazo(c, K, o.color || HUESO, 1.2, h.x, h.y, h.x + Math.cos(h.ang + i * 0.4) * 5.6, h.y + Math.sin(h.ang + i * 0.4) * 5.6); trazo(c, K, K.brazo, 2.6, -4, -23, -9, -17); for (let i = -1; i <= 1; i++) trazo(c, K, o.color || HUESO, 1.1, -9, -17, -12 + i * 1.6, -13); },
    pinzas(c, K, o) { const h = mano(K, K.h, 9); brazo(c, K, h, 2.4); const q = o.color || "#4a3420"; c.strokeStyle = F(K, q); c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(h.x, h.y); c.quadraticCurveTo(h.x + 7, h.y - 5, h.x + 9, h.y); c.moveTo(h.x, h.y); c.quadraticCurveTo(h.x + 6, h.y + 6, h.x + 9, h.y + 1.6); c.stroke(); },
    naginata(c, K, o) { const h = mano(K, K.h, 6); brazo(c, K, h); const p = asta(c, K, h, 17, 8); hoja(c, K, { x: p.x, y: p.y, ang: h.ang }, 8, 2.2, "#e6ebf0", -0.25); },
    estoque(c, K, o) { const h = mano(K, K.h, 7); brazo(c, K, h, 2.8); trazo(c, K, "#17131a", 2, h.x, h.y, h.x + Math.cos(h.ang + 1.5) * 11, h.y + Math.sin(h.ang + 1.5) * 11); disco(c, K, ORO, h.x, h.y, 1.5); if (K.sw > 0.2) hoja(c, K, h, 12, 1.2, "#e6ebf0"); },
    escupe(c, K, o) { if (K.sw > 0.4) { const a = c.globalAlpha; for (let i = 0; i < 4; i++) { c.globalAlpha = a * (0.9 - i * 0.18); disco(c, K, o.color || "#b6f23a", 9 + i * 4, -29 + i * 0.8, 2 - i * 0.3); } c.globalAlpha = a; } disco(c, K, o.color || "#b6f23a", 7.4, -28.4, 1.2); },
    nada() {}
  };
  function fogonazo(c, K, x, y) { const a = c.globalAlpha; c.globalAlpha = a * 0.55; disco(c, K, "#ffd27a", x, y, 4.4); c.globalAlpha = a; poli(c, K, "#fff4c8", [[x - 1, y - 1.6], [x + 5.4, y], [x - 1, y + 1.6]]); }
  const ESCUDO = {
    redondo(c, K, o) { disco(c, K, oscuro(K.col, 0.5), -6.5, -19, 7); arco(c, K, o.metal || K.metal, 1.3, -6.5, -19, 6.6, 0, 7); disco(c, K, o.metal || K.metal, -6.5, -19, 2); },
    rodela(c, K, o) { disco(c, K, metal(K, o.metal || K.metal, -11, -24, -3, -15), -7, -19.5, 5); disco(c, K, K.col, -7, -19.5, 2.2); },
    paves(c, K, o) { poli(c, K, metal(K, o.metal || K.metal, -13, -29, -3, -6), [[-12.4, -28.6], [-3, -28.6], [-3, -9], [-7.6, -4.6], [-12.4, -9]]); trazo(c, K, K.col, 1.8, -7.6, -26.6, -7.6, -8); trazo(c, K, K.col, 1.8, -11.4, -20, -4, -20); },
    cometa(c, K, o) { poli(c, K, metal(K, K.col, -12, -28, -4, -9), [[-12, -28], [-4, -28], [-4, -14], [-8, -9], [-12, -14]]); trazo(c, K, K.ban, 1.2, -8, -27, -8, -11); },
    scutum(c, K, o) { poli(c, K, metal(K, K.col, -13, -29, -4, -7), [[-12.6, -28.4], [-4, -28.4], [-4, -7.6], [-12.6, -7.6]]); arco(c, K, ORO, 1, -8.3, -18, 2.2, 0, 7); trazo(c, K, ORO, 1, -8.3, -27, -8.3, -21); trazo(c, K, ORO, 1, -8.3, -15, -8.3, -9); },
    ovalado(c, K, o) { elipse(c, K, metal(K, K.col, -12, -27, -4, -11), -8, -19, 4.6, 8); disco(c, K, ORO, -8, -19, 1.4); },
    puerta(c, K, o) { poli(c, K, metal(K, "#3a3028", -13, -30, -3, -7), [[-13, -29.6], [-3.4, -29.6], [-3.4, -7.4], [-13, -7.4]]); c.strokeStyle = F(K, LATON); c.lineWidth = 0.9; c.strokeRect(-11.6, -27.6, 6.8, 7.4); c.strokeRect(-11.6, -18, 6.8, 8.6); disco(c, K, LATON, -5.6, -17, 0.9); },
    quitina(c, K, o) { poli(c, K, metal(K, o.color || "#5a3e22", -12, -28, -4, -10), [[-8, -28.6], [-3.6, -24], [-4.4, -13], [-8, -9], [-11.6, -13], [-12.4, -24]]); trazo(c, K, oscuro(o.color || "#5a3e22", 0.5), 0.9, -8, -27.6, -8, -10); },
    grimorio(c, K, o) { poli(c, K, metal(K, mezcla(K.ban, "#2a2040", 0.3), -12, -27, -4, -13), [[-12.4, -27], [-4.4, -27], [-4.4, -13], [-12.4, -13]]); poli(c, K, "#e9e2cf", [[-11.4, -14.4], [-5, -14.4], [-5, -13], [-11.4, -13]]); halo(c, K, "#b98cff", -8.4, -20, 1.8); },
    torre(c, K, o) { poli(c, K, metal(K, o.metal || "#5a5046", -13, -30, -3, -6), [[-13, -29.4], [-3.4, -29.4], [-3.4, -6.4], [-13, -6.4]]); [[-11, -26, -6.4, -21], [-10, -19, -5, -15.4], [-11.4, -13, -7, -9]].forEach(p => trazo(c, K, "#201a16", 1, p[0], p[1], p[2], p[3])); }
  };

  /* =========================================================================
     ENTERAS: lo que no es una persona de pie
  ========================================================================= */
  const ENTERA = {
    eco(c, K) {
      const bob = Math.sin(K.t * 3) * 1.5;
      c.globalAlpha *= 0.78;
      c.fillStyle = F(K, mezcla(K.col, "#bfe9f2", 0.55)); c.beginPath(); c.moveTo(0, -37 + bob); c.quadraticCurveTo(10, -22, 7, -9); c.lineTo(3, -5 + bob); c.lineTo(0, -8 + bob); c.lineTo(-3, -4 + bob); c.lineTo(-7, -9); c.quadraticCurveTo(-10, -22, 0, -37 + bob); c.fill();
      c.fillStyle = "#04141a"; c.beginPath(); c.ellipse(1, -26 + bob, 5, 7, 0, 0, 7); c.fill();
      ojoL(c, K, -1.5, -27 + bob, "#e9fbff"); ojoL(c, K, 3.5, -27 + bob, "#e9fbff");
      c.strokeStyle = "rgba(190,235,255,.5)"; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -3, 11, 3, 0, 0, 7); c.stroke();
      c.globalAlpha /= 0.78;
    },
    bestia(c, K, o) {
      const p = K.mov ? Math.sin(K.fase) * 3 : 0, pel = o.pelo || "#4a3c40", e = o.escala || 1, emb = Math.max(0, K.sw) * 4;
      c.save(); c.scale(e, e); c.translate(emb, 0);
      c.fillStyle = F(K, metal(K, pel, -12, -20, 12, -8)); c.beginPath(); c.ellipse(0, -14, 12.5, 7.2, 0, 0, 7); c.fill();
      if (o.lomo) for (let i = 0; i < 6; i++) poli(c, K, oscuro(pel, 0.4), [[-9 + i * 3.4, -19.6], [-7.6 + i * 3.4, -25 - (i % 2) * 1.6], [-6 + i * 3.4, -19.8]]);
      [[-8, -p], [-3, p], [3, -p], [8, p]].forEach(([x, d]) => trazo(c, K, oscuro(pel, 0.45), 3.2, x, -10, x + d * 0.5, -1));
      c.fillStyle = F(K, metal(K, pel, 6, -24, 18, -14)); c.beginPath(); c.ellipse(12, -19, 5.8, 4.8, 0.3, 0, 7); c.fill();
      poli(c, K, oscuro(pel, 0.45), [[8.5, -22.5], [9.5, -28], [12.5, -23.5]]); poli(c, K, oscuro(pel, 0.45), [[13, -22], [16, -27], [16.5, -21]]);
      trazo(c, K, "#efe6cf", 1.6, 15, -16.5, 14.5, -14.5);
      if (o.colmillos) { c.strokeStyle = F(K, "#efe6cf"); c.lineWidth = 1.8; c.lineCap = "round"; c.beginPath(); c.moveTo(16, -16); c.quadraticCurveTo(20, -17, 19.4, -21.6); c.stroke(); }
      ojoL(c, K, 13.4, -20.2, o.ojo || "#ffd24a");
      trazo(c, K, oscuro(pel, 0.45), 2.6, -12, -16, -17, -20);
      c.restore();
    },
    kirin(c, K) {
      const p = K.mov ? Math.sin(K.fase) * 3 : 0, jade = "#3f8f72";
      [[-7, -p], [-3, p], [4, -p], [8, p]].forEach(([x, d]) => { trazo(c, K, oscuro(jade, 0.3), 2.4, x, -14, x + d * 0.5, -2); trazo(c, K, ORO, 2.6, x + d * 0.5, -2.6, x + d * 0.5 + 1.4, -1); });
      c.fillStyle = F(K, metal(K, jade, -11, -24, 10, -11)); c.beginPath(); c.ellipse(0, -17, 11, 6.4, -0.08, 0, 7); c.fill();
      for (let i = 0; i < 5; i++) arco(c, K, claro(jade, 0.3), 0.8, -7 + i * 3.6, -16, 2.2, 3.4, 6);
      poli(c, K, metal(K, jade, 6, -34, 14, -18), [[6, -19], [9, -32], [15.4, -33], [18, -27.4], [13, -24], [11, -18]]);
      trazo(c, K, "#f0cf6a", 1.4, 12.4, -33, 15.4, -43); ojoL(c, K, 13.6, -29.6, "#fff6a0");
      const chispa = Math.sin(K.t * 9);
      c.strokeStyle = F(K, K.sw > 0.4 ? "#ffffff" : "#bfe8ff"); c.lineWidth = 1.5; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(8, -31); c.lineTo(3, -34 + chispa); c.lineTo(1, -29); c.lineTo(-4, -32 - chispa); c.lineTo(-6, -26); c.lineTo(-11, -28 + chispa); c.stroke();
      c.beginPath(); c.moveTo(-10, -18); c.lineTo(-15, -22 - chispa); c.lineTo(-16, -16); c.lineTo(-19.6, -19); c.stroke();
    },
    tortuga(c, K, o) {
      const p = K.mov ? Math.sin(K.fase) * 2.4 : 0, v = "#4a6a52";
      [[-9, -p], [-3, p], [5, -p], [10, p]].forEach(([x, d]) => trazo(c, K, oscuro(v, 0.3), 4.2, x, -8, x + d * 0.5, -1));
      c.fillStyle = F(K, metal(K, "#5a4a32", -13, -24, 12, -6)); c.beginPath(); c.ellipse(-0.6, -11, 13.4, 9.6, 0, Math.PI, 0); c.fill();
      [[-7, -15], [0, -18], [6, -14.6]].forEach(q => { c.strokeStyle = F(K, "#3a2e1e"); c.lineWidth = 0.9; c.beginPath(); c.arc(q[0], q[1], 3, 0, 7); c.stroke(); });
      c.fillStyle = F(K, metal(K, v, 10, -18, 20, -9)); c.beginPath(); c.ellipse(15, -13, 5, 3.8, 0.2, 0, 7); c.fill(); ojoL(c, K, 16.6, -14, "#ffe36a");
      // el castillete y el jinete
      poli(c, K, "#4a3220", [[-6, -20], [5, -20], [5, -26], [-6, -26]]); [-5, -1.4, 2.4].forEach(x => poli(c, K, "#4a3220", [[x, -26], [x + 2, -26], [x + 2, -28], [x, -28]]));
      trazo(c, K, K.col, 1.4, -6, -23, 5, -23);
      disco(c, K, "#a9805c", 0, -31.6, 3); poli(c, K, K.col, [[-3.2, -33], [3.4, -33], [2.6, -35.6], [-2.4, -35.6]]); ojoL(c, K, 1.6, -31.6, "#ffd24a");
      const h = { x: 3 + Math.cos(-0.5 + K.sw * 1.6) * 6, y: -27 + Math.sin(-0.5 + K.sw * 1.6) * 6, ang: -0.5 + K.sw * 1.6 };
      trazo(c, K, "#3a2c20", 2.2, 2, -28, h.x, h.y); trazo(c, K, MADERA, 1.8, h.x, h.y, h.x + Math.cos(h.ang) * 15, h.y + Math.sin(h.ang) * 15);
      poli(c, K, "#cfd6de", [[h.x + Math.cos(h.ang) * 19, h.y + Math.sin(h.ang) * 19], [h.x + Math.cos(h.ang) * 15 - Math.sin(h.ang) * 1.6, h.y + Math.sin(h.ang) * 15 + Math.cos(h.ang) * 1.6], [h.x + Math.cos(h.ang) * 15 + Math.sin(h.ang) * 1.6, h.y + Math.sin(h.ang) * 15 - Math.cos(h.ang) * 1.6]]);
    },
    arana(c, K) {
      const p = K.mov ? Math.sin(K.fase) * 2.6 : 0, m = LATON;
      [[-1, 1], [1, -1]].forEach(([lado, s]) => [0, 1].forEach(i => { const x0 = lado * 3, x1 = lado * (9 + i * 3), y1 = -12 - i * 3 + s * p * (i ? -1 : 1) * 0.4; trazo(c, K, oscuro(m, 0.35), 1.6, x0, -13, x1, y1); trazo(c, K, oscuro(m, 0.35), 1.4, x1, y1, x1 + lado * 1.6, -0.6); }));
      elipse(c, K, metal(K, m, -6, -19, 6, -9), 0, -14, 6.4, 4.8);
      poli(c, K, metal(K, m, -3, -27, 5, -17), [[-2.4, -17.6], [4.4, -17.6], [5.4, -24], [1, -26.6], [-3.4, -24]]);
      disco(c, K, NEGRO, 2.2, -21.6, 2.8); halo(c, K, K.sw > 0.4 ? "#ffffff" : "#7fe3ff", 2.2, -21.6, 1.6);
      trazo(c, K, oscuro(m, 0.3), 0.9, -1, -26, -2.4, -31); halo(c, K, "#ff6a4a", -2.4, -31.4, 0.8);
      const h = { x: 6 + Math.max(0, K.sw) * 4, y: -15 }; trazo(c, K, "#8a8f98", 1.4, 4, -15, h.x + 3, h.y); trazo(c, K, "#cfd6de", 1.6, h.x + 3, h.y, h.x + 7, h.y - 1);
    },
    zaphar(c, K) {
      const q = "#8a5a22", ala = Math.sin(K.t * 8) * 1.6;
      const a = c.globalAlpha; c.globalAlpha = a * 0.55; poli(c, K, "#f0b84a", [[-3, -26], [-17, -37 + ala], [-18, -22], [-6, -17]]); poli(c, K, "#ffd98a", [[-3, -24], [-15, -29 - ala], [-14, -16], [-5, -15]]); c.globalAlpha = a;
      CUERPO.insecto(c, K, { quitina: q }); CABEZA.hormiga(c, K, { quitina: q, ojo: "#fff0a0", corona: true });
      ARMA.lanza(c, K, { largo: 20, punta: "#f0cf6a" }); ESCUDO.quitina(c, K, { color: "#6a4418" });
    },
    quimera(c, K) {
      const q = "#5a4a3a", ala = Math.sin(K.t * 7) * 1.4;
      const a = c.globalAlpha; c.globalAlpha = a * 0.5; poli(c, K, "#cfe0a0", [[-3, -25], [-15, -34 + ala], [-15, -20], [-5, -17]]); c.globalAlpha = a;
      CUERPO.insecto(c, K, { quitina: q });
      c.strokeStyle = F(K, oscuro(q, 0.2)); c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(-11, -12); c.quadraticCurveTo(-19, -16, -15, -27); c.stroke(); poli(c, K, "#e8ff7a", [[-15, -27], [-17.4, -24], [-12.4, -24.6]]);
      CABEZA.hormiga(c, K, { quitina: q, ojo: "#ff5a3a" }); ARMA.pinzas(c, K, { color: "#3a2a1a" });
    },
    barrilero(c, K) {
      CUERPO.cuero(c, K, { cuero: "#4a3a2a" });
      c.fillStyle = F(K, metal(K, "#6a4a2c", -13, -29, -3, -12)); c.beginPath(); c.ellipse(-8, -20.6, 5.4, 8.4, 0, 0, 7); c.fill();
      [-25, -20.6, -16].forEach(y => trazo(c, K, "#2a2c30", 1.2, -13, y, -3, y));
      trazo(c, K, "#d8c9a6", 0.9, -8, -29, -6, -33); halo(c, K, Math.sin(K.t * 14) > 0 ? "#ffd27a" : "#ff8a3a", -5.6, -33.6, 1.3);
      CABEZA.panuelo(c, K, {}); ARMA.maza(c, K, { tubo: true });
    },
    engranaje(c, K) {
      const m = "#7a9a72";
      CUERPO.maquina(c, K, { metal: m, nucleo: "#ffd27a" });
      c.save(); c.translate(0, -19.5); c.rotate(K.t * 1.2); c.strokeStyle = F(K, "#c79a44"); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 4.6, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) trazo(c, K, "#c79a44", 1.8, Math.cos(i * 0.785) * 4.6, Math.sin(i * 0.785) * 4.6, Math.cos(i * 0.785) * 6.4, Math.sin(i * 0.785) * 6.4); c.restore();
      CABEZA.lente(c, K, { metal: m, ojo: "#ffd27a", antena: true }); ARMA.martillo(c, K, { color: "#c79a44" });
    }
  };

  /* =========================================================================
     RECETAS: [cuerpo, cabeza, arma, opciones]. opciones: { c: del cuerpo, k: de la cabeza, a: del arma, e: escudo, eo: del escudo, capa, tam, entera }
  ========================================================================= */
  const R = (cuerpo, cabeza, arma, o) => Object.assign({ cuerpo, cabeza, arma }, o || {});
  const E = (entera, o) => Object.assign({ entera }, o || {});
  const RECETAS = {
    "caballeros-del-reino": {
      guerrero: R("cuero", "capacete", "lanza", { c: { cuero: "#6a5a46" }, e: "redondo" }),
      cazador: R("cuero", "capucha", "arco", { capa: 0.25, k: { pico: false } }),
      arcanista: R("tunica", "capuchaPunta", "baston", { k: { ojo: "#8fe8ff" }, a: { madera: "#6d7178", orbe: "#8fd8ff" } }),
      paladin: R("placas", "cerrado", "maza", { c: { ancho: 14, banda: true }, e: "paves", tam: 1.06 }),
      picaro: R("cuero", "capucha", "daga", { c: { cuero: "#262e28" }, k: { tela: "#141a16", ojo: "#a8f0d6" }, agachado: true }),
      caballero: R("placas", "cerrado", "lanza", { c: { ancho: 15, banda: true }, a: { largo: 20, pendon: true }, e: "cometa", tam: 1.06 }),
      lider: R("placas", "corona", "espadon", { c: { ancho: 15, banda: true }, capa: 0.05, estandarte: true, tam: 1.18 })
    },
    "academia-arcana-de-dolbred": {
      guerrero: R("tunica", "yelmo", "alabarda", { c: { tela: "#3a3560" }, k: { metal: "#8f93b8", ojo: "#b98cff" } }),
      cazador: R("cuero", "sombreroAla", "ballesta", { c: { cuero: "#3d3a52" }, k: { tela: "#2d2a4a" }, tubo: true }),
      arcanista: R("tunica", "capuchaPunta", "baston", {}),
      paladin: R("placas", "vacia", "espadon", { c: { ancho: 14, metal: "#6b6f8a" }, a: { color: "#c9b6ff" }, tam: 1.06 }),
      picaro: R("tunica", "antifaz", "daga", { c: { tela: "#2a2440" }, k: { liso: true }, a: { dos: false } }),
      archimago: R("tunica", "sombreroPico", "baston", { c: { tela: mezcla("#2d2a6b", "#0c0a16", 0.15) }, a: { tipo: "rombo", orbe: "#e6c6ff" } }),
      lider: R("tunica", "sombreroPico", "baston", { c: { tela: "#3a2d6b", estola: true }, a: { tipo: "rombo", orbe: "#ffe9a6" }, capa: 0.05, tam: 1.16 })
    },
    "trono-de-ceniza": {
      guerrero: R("harapos", "zombi", "espada", { a: { color: "#8a6a52", largo: 12 } }),
      cazador: R("harapos", "zombi", "jabalinas", { c: { carne: "#8a927a" }, k: { colmillos: true }, agachado: true }),
      arcanista: R("tunica", "capuchaPunta", "baston", { c: { tela: "#14121a" }, k: { tela: "#14121a", calavera: true, alto: 3, ojo: "#b6f26a" }, a: { tipo: "calavera", orbe: "#b6f26a" } }),
      paladin: R("mole", "cosido", "maza", { c: { cosido: true }, a: { color: "#5d5f66" }, tam: 1.12 }),
      picaro: R("harapos", "zombi", "garras", { c: { carne: "#8a927a" }, k: { colmillos: true, ojo: "#ff8a5a" }, agachado: true }),
      esqueleto: R("huesos", "calavera", "espada", { a: { color: "#8a6a52", largo: 12 } }),
      lider: R("huesos", "corona", "espadon", { c: { sinHombrera: true }, k: { metal: HUESO, oro: "#4a4a52", ojo: "#b6f26a" }, a: { color: "#9aa0a8" }, capa: 0.3, tam: 1.18 })
    },
    "compania-dorada": {
      guerrero: R("jubon", "plumas", "alabarda", {}),
      cazador: R("jubon", "morrion", "ballesta", { e: null, paves: true }),
      arcanista: R("tunica", "plumas", "baston", { c: { tela: "#4a3a1e" }, a: { orbe: "#ffd24a", madera: ORO } }),
      paladin: R("placas", "morrion", "espada", { c: { ancho: 14, metal: "#c9a23a", banda: true }, k: { metal: "#c9a23a" }, e: "rodela", eo: { metal: "#c9a23a" }, tam: 1.06 }),
      picaro: R("cuero", "antifaz", "daga", { c: { cuero: "#3a2e22" }, capa: 0.3 }),
      mercenario: R("cuero", "parche", "espadon", { c: { cuero: "#6a5a46" } }),
      lider: R("placas", "plumas", "espadon", { c: { ancho: 15, metal: "#c9a23a", banda: true }, capa: 0.05, tam: 1.18 })
    },
    "hijos-del-acero": {
      guerrero: R("cuero", "sombreroAla", "lanza", { c: { cuero: "#4a3e30" }, a: { travesano: true } }),
      cazador: R("cuero", "sombreroAla", "arco", { capa: 0.3, k: { pluma: true } }),
      arcanista: R("cuero", "gafas", "frasco", { c: { cuero: "#3a3d33" }, k: { ojo: "#9af27a", piel: "#3a3028" } }),
      paladin: R("placas", "capacete", "hacha", { c: { ancho: 14 }, e: "torre", tam: 1.06 }),
      picaro: R("pieles", "capucha", "daga", { c: { piel: "#6a5a46" }, k: { tela: "#4a3a2a" } }),
      ballestero: R("cuero", "yelmo", "ballesta", { c: { cuero: "#3a3d33" }, capa: 0.3 }),
      lider: R("abrigo", "sombreroAla", "ballesta", { c: { tela: "#3a2e26" }, k: { pluma: true, tela: "#2a2018" }, tam: 1.16 })
    },
    "santos-de-asmodeo": {
      guerrero: R("tunica", "granYelmo", "espada", { c: { tela: "#e2dccb", estola: true }, e: "cometa" }),
      cazador: R("cuero", "capacete", "arco", { c: { cuero: "#7a6a52" }, farol: true }),
      arcanista: R("tunica", "capucha", "incensario", { c: { tela: "#e2dccb", estola: true }, k: { tela: "#d9d2c0", ojo: "#fff0b0", dos: false } }),
      paladin: R("placas", "granYelmo", "maza", { c: { ancho: 14, metal: "#d9dce0", banda: true }, k: { halo: true, metal: "#e2e5e8" }, a: { color: ORO }, e: "paves", eo: { metal: "#d9dce0" }, tam: 1.06 }),
      picaro: R("tunica", "capucha", "daga", { c: { tela: "#2a2622" }, k: { tela: "#201c1a", ojo: "#ffb86a" }, a: { dos: false } }),
      sanador: R("tunica", "capucha", "baston", { c: { tela: "#d9d2c0", estola: true }, k: { tela: "#d9d2c0", ojo: "#fff0b0", dos: false }, a: { tipo: "sol", orbe: "#ffe9a6" } }),
      lider: R("tunica", "mitra", "baston", { c: { tela: "#efe6cf", estola: true }, a: { tipo: "sol", orbe: "#ffe9a6", madera: ORO }, capa: 0.1, tam: 1.16 })
    },
    nikaalia: {
      guerrero: R("abrigo", "fedora", "maza", { a: { tubo: true } }),
      cazador: R("abrigo", "fedora", "pistola", { c: { tela: "#1a1820" }, k: { cigarro: true } }),
      arcanista: R("cuero", "gafas", "frasco", { c: { cuero: "#3a2e2a" }, k: { ojo: "#c08aff", piel: "#8a7a8a" }, a: { color: "#c08aff" } }),
      paladin: R("abrigo", "fedora", "maza", { c: { tela: "#2a2832" }, k: { tela: "#15141a" }, e: "puerta", tam: 1.14 }),
      picaro: R("abrigo", "bufanda", "daga", { c: { tela: "#18171c" }, a: { dos: false } }),
      capo: R("abrigo", "fedora", "estoque", { c: { tela: "#34303c" }, k: { tela: "#2a2630", ojo: "#ffd27a" }, capa: 0.15 }),
      lider: R("abrigo", "fedora", "estoque", { c: { tela: "#4a3a3a" }, k: { tela: "#201c22", cigarro: true, ojo: "#ffd27a" }, capa: 0.1, tam: 1.16 })
    },
    seosan: {
      guerrero: R("kimono", "cinta", "sable", {}),
      cazador: R("kimono", "kasa", "arco", { c: { tela: "#3a4a42" }, a: { largo: true, color: "#2a2018" } }),
      arcanista: R("tunica", "kasa", "baston", { c: { tela: "#c9862e" }, k: { cesta: true }, a: { orbe: "#ffe36a" } }),
      paladin: R("placas", "kabuto", "naginata", { c: { ancho: 14, metal: "#4a2a2a" }, tam: 1.06 }),
      picaro: R("kimono", "ninja", "daga", { c: { tela: "#15141a" }, a: { dos: false }, agachado: true }),
      maestro: R("kimono", "cinta", "sable", { c: { tela: "#e9e4da" }, a: { dos: true, largo: 15 } }),
      lider: R("placas", "kabuto", "sable", { c: { ancho: 15, metal: "#2b2a30", banda: true }, k: { mascara: "#c9a23a" }, a: { largo: 16 }, capa: 0.1, tam: 1.16 })
    },
    okran: {
      guerrero: R("pieles", "barbaro", "hacha", { k: { barba: true }, a: { largo: 14, doble: true } }),
      cazador: R("pieles", "barbaro", "jabalinas", {}),
      arcanista: R("tunica", "craneoCiervo", "baston", { c: { tela: "#4a3a2a" }, a: { tipo: "sonajas", orbe: "#9af27a" } }),
      paladin: R("mole", "bestia", "maza", { c: { piel: "#5a4232", pelo: true }, a: { tronco: true }, tam: 1.2 }),
      picaro: R("pieles", "lobo", "garras", { c: { piel: "#6a665e" }, agachado: true }),
      berserker: R("pieles", "barbaro", "hacha", { c: { piel: "#c09a76" }, k: { ojo: "#ff5a3a" }, a: { dos: true } }),
      lider: R("pieles", "barbaro", "hacha", { k: { cuernos: true, barba: true }, a: { largo: 16, doble: true }, capa: 0.3, tam: 1.2 })
    },
    pelgiria: {
      guerrero: R("cuero", "panuelo", "sable", { c: { cuero: "#3d4a52" }, a: { largo: 11 }, e: "rodela" }),
      cazador: R("cuero", "tricornio", "fusil", { c: { cuero: "#3a3340" } }),
      arcanista: R("cuero", "panuelo", "canon", { c: { cuero: "#3d4a52" } }),
      paladin: E("tortuga", { tam: 1.08 }),
      picaro: R("abrigo", "tricornio", "daga", { c: { tela: "#2a3238" }, k: { panuelo: true }, a: { dos: false } }),
      barrilero: E("barrilero"),
      lider: R("abrigo", "tricornio", "sable", { c: { tela: "#2a4a52" }, k: { pluma: true }, a: { largo: 15 }, tam: 1.16 })
    },
    mravec: {
      guerrero: R("insecto", "hormiga", "lanza", { e: "quitina" }),
      cazador: R("insecto", "hormiga", "escupe", { c: { quitina: "#7a6a2a" }, k: { quitina: "#7a6a2a", ojo: "#b6f23a" } }),
      arcanista: R("insecto", "mantis", "baston", { c: { quitina: "#6a7a32" }, k: { velo: true }, a: { orbe: "#f0b84a", madera: "#4a3420" } }),
      paladin: R("insecto", "escarabajo", "pinzas", { c: { quitina: "#3a3440" }, e: "quitina", eo: { color: "#2e2a34" }, tam: 1.16 }),
      picaro: R("insecto", "hormiga", "pinzas", { c: { quitina: "#b08a4a" }, k: { quitina: "#b08a4a" }, agachado: true }),
      quimera: E("quimera", { tam: 1.08 }),
      lider: R("insecto", "mantis", "baston", { c: { quitina: "#8a5a22" }, k: { quitina: "#8a5a22", velo: true }, a: { orbe: "#f0b84a", tipo: "rombo" }, tam: 1.2 })
    },
    nernib: {
      guerrero: R("maquina", "gafas", "martillo", { c: { metal: "#7a7468" }, tam: 0.9 }),
      cazador: R("cuero", "gafas", "fusil", { c: { cuero: "#4a4038" }, a: { largo: 24, metal: LATON }, tam: 0.8 }),
      arcanista: R("cuero", "gafas", "baston", { c: { cuero: "#3a4450" }, k: { ojo: "#ffe36a" }, a: { orbe: "#7fe3ff", madera: LATON }, tam: 0.8 }),
      paladin: R("maquina", "lente", "martillo", { c: { metal: "#8a7a5a" }, k: { metal: "#8a7a5a" }, tam: 1.14 }),
      picaro: E("arana"),
      automata: R("maquina", "lente", "martillo", { k: { antena: true } }),
      lider: R("maquina", "gafas", "baston", { c: { metal: LATON, nucleo: "#ffd27a" }, a: { orbe: "#7fe3ff", madera: LATON }, tam: 1.1 })
    },
    balutia: {
      guerrero: R("legion", "galea", "espada", { a: { largo: 10 }, e: "scutum" }),
      cazador: R("cuero", "galea", "jabalinas", { c: { cuero: "#6a5a46" }, k: { metal: "#8a7a5a" }, e: "ovalado" }),
      arcanista: R("cuero", "galea", "tubo", { c: { cuero: "#4a3a2a" }, k: { metal: "#5a5046" } }),
      paladin: R("legion", "galea", "lanza", { c: { metal: "#c9a23a" }, k: { cresta: true, metal: "#c9a23a" }, e: "scutum", capa: 0.1, tam: 1.06 }),
      picaro: R("tunica", "capucha", "daga", { c: { tela: "#5a5a60" }, k: { tela: "#4a4a50", ojo: "#ffe0a0" }, a: { dos: false } }),
      condenado: R("harapos", "zombi", "maza", { c: { carne: "#b08a68" }, k: { carne: "#b08a68", ojo: "#ffd24a" }, a: { tubo: true } }),
      lider: R("legion", "laurel", "espada", { c: { metal: "#c9a23a" }, a: { largo: 12 }, capa: 0.05, estandarte: true, tam: 1.16 })
    }
  };
  const HEROE = {
    adam: R("placas", "cerrado", "espadon", { c: { ancho: 15, metal: "#4f6fae", banda: true }, k: { metal: "#4f6fae" }, capaCol: "#e9e4da", capa: 0, e: "cometa", tam: 1.2 }),
    mano_de_oro: R("placas", "parche", "espadon", { c: { ancho: 14, metal: "#2a2a30", banda: true }, capaCol: "#e0b23a", capa: 0, tam: 1.2, manoOro: true }),
    engranaje: E("engranaje", { tam: 1.24 }),
    ottavio: R("abrigo", "fedora", "estoque", { c: { tela: "#e9e4da" }, k: { tela: "#15141a", ojo: "#ffd27a" }, capaCol: "#15141a", capa: 0, tam: 1.2 }),
    brasa: R("tunica", "capuchaPunta", "baston", { c: { tela: "#8a2a1a" }, k: { tela: "#b0401a", ojo: "#ffd27a" }, a: { orbe: "#ff8a3a", tipo: "rombo" }, tam: 1.2, llamas: true }),
    humores: R("tunica", "capucha", "frasco", { c: { tela: "#3a4a32" }, k: { tela: "#2a3424", pico: true, ojo: "#9af27a" }, tam: 0.92 }),
    umbral: R("tunica", "capuchaPunta", "baston", { c: { tela: "#d9d2c0" }, k: { tela: "#cfc8b4", ojo: "#b98cff" }, a: { orbe: "#b98cff" }, e: "grimorio", tam: 1.22 }),
    ceniciento: R("placas", "corona", "espadon", { c: { ancho: 15, metal: "#3a3432" }, k: { metal: "#3a3432", oro: "#6a5a52", ojo: "#ff8a3a" }, a: { color: "#8a8078" }, capaCol: "#6a6460", capa: 0, tam: 1.22, ceniza: true }),
    vigilante: R("placas", "granYelmo", "espadon", { c: { ancho: 15, metal: "#eceef0" }, k: { halo: true, metal: "#f4f5f6", ojo: "#fff6c8" }, a: { color: "#ffd98a" }, tam: 1.24, alas: true }),
    kirin: E("kirin", { tam: 1.25 }),
    ebonrabia: E("bestia", { tam: 1.45, eo: { pelo: "#17141a", lomo: true, colmillos: true, ojo: "#ff3a2a" } }),
    dientesal: R("abrigo", "tricornio", "pistola", { c: { tela: "#8a1f1f" }, k: { pluma: true, galon: "#ffffff" }, a: { dos: true }, tam: 1.2 }),
    zaphar: E("zaphar", { tam: 1.26 }),
    orsa: R("legion", "galea", "espada", { c: { metal: BRONCE }, k: { cresta: "t", metal: BRONCE }, a: { largo: 12 }, capaCol: "#6a2a7a", capa: 0, estandarte: true, tam: 1.2 }),
    rykerd: R("placas", "cerrado", "espadon", { c: { ancho: 16, metal: "#4a4a50" }, k: { metal: "#4a4a50", ojo: "#b6f26a" }, a: { color: "#8a8f98" }, tam: 1.38, cadenas: true })
  };

  function receta(q) {
    if (q.heroe && HEROE[q.heroe]) return HEROE[q.heroe];
    if (q.clase === "salvaje") return E("bestia", {});
    if (q.clase === "eco") return E("eco", {});
    const f = RECETAS[D.faccionReal(q.faccion)] || RECETAS["caballeros-del-reino"];
    return f[q.clase] || RECETAS["caballeros-del-reino"][q.clase] || RECETAS["caballeros-del-reino"].guerrero;
  }

  /* Dibuja una figura entera. q: { faccion, clase, heroe }. o: { x, y (píxeles, pies), s (px por casilla), dir, mov, fase, sw, flash, t, cap, rango, herido, luto, alfa, rot, bob, sinAro } */
  function figura(c, q, bando, o) {
    if (typeof q === "string") q = { clase: q, faccion: bando.faccion };
    const r = receta(q);
    const s = o.s / 40 * (r.tam || 1);
    const K = { c, col: bando.col, ban: bando.ban, metal: ACERO, fase: o.fase || 0, mov: !!o.mov, sw: o.sw || 0, flash: o.flash || 0, t: o.t || 0 };
    c.save();
    c.translate(o.x, o.y);
    if (!o.sinAro) {
      const e = o.s / 40;
      c.fillStyle = "rgba(0,0,0,.45)"; c.beginPath(); c.ellipse(0, 0, 12.5 * e, 4 * e, 0, 0, 7); c.fill();
      c.strokeStyle = bando.col; c.lineWidth = 1.4 * e; c.beginPath(); c.ellipse(0, 0, 12.5 * e, 4 * e, 0, 0, 7); c.stroke();
    }
    c.scale(s * (o.dir || 1), s);
    if (o.rot) c.rotate(o.rot);
    if (o.alfa !== undefined) c.globalAlpha = o.alfa;
    c.translate(0, (o.bob || 0) + (r.agachado ? 1.5 : 0));
    if (o.rango >= 2 && !r.entera && !q.heroe && q.clase !== "lider") poli(c, K, oscuro(bando.col, 0.35), [[-3, -26], [-1, -26], [-6, -6], [-11, -9]]);
    if (o.cap || r.estandarte) { trazo(c, K, "#d8c28a", 1.5, -9, -3, -9, -50); const on = Math.sin((o.t || 0) * 5) * 2; poli(c, K, bando.col, [[-9, -50], [1, -47 + on], [-9, -42]]); }
    if (r.entera) ENTERA[r.entera](c, K, r.eo || {});
    else {
      if (r.alas) { const a = c.globalAlpha; c.globalAlpha = a * 0.85; [[-1, 0], [-1, 1], [-1, 2]].forEach(([l, i]) => poli(c, K, metal(K, "#e2e5e8", -16, -40, -2, -16), [[-3, -27], [-16 - i * 1.4, -42 + i * 8 + Math.sin(K.t * 2) * 1], [-13, -30 + i * 7], [-4, -20]])); c.globalAlpha = a; void 0; }
      if (r.capa !== undefined) capaAtras(c, K, r.capaCol || oscuro(K.ban, r.capa), -5, -10);
      if (r.paves) poli(c, K, metal(K, K.col, -10, -30, -3, -12), [[-9.4, -29], [-3.6, -29], [-3.6, -13], [-9.4, -13]]);
      if (r.tubo) trazo(c, K, "#6a5a3a", 3, -7, -29, -3, -16);
      CUERPO[r.cuerpo](c, K, r.c || {});
      if (r.e) ESCUDO[r.e](c, K, r.eo || {});
      if (r.farol) { trazo(c, K, "#2a2c30", 0.8, -5, -15, -6.4, -11.4); halo(c, K, "#ffd98a", -6.4, -10, 1.6); }
      ARMA[r.arma](c, K, r.a || {});
      CABEZA[r.cabeza](c, K, r.k || {});
      if (r.manoOro) halo(c, K, "#ffd24a", -7.4, -17, 2.4);
      if (r.cadenas) { c.strokeStyle = F(K, "#6d7178"); c.lineWidth = 1.2; c.setLineDash([1.6, 1.4]); c.beginPath(); c.moveTo(-7, -24); c.quadraticCurveTo(-13, -14, -10, -4); c.moveTo(5, -16); c.quadraticCurveTo(10, -9, 7, -3); c.stroke(); c.setLineDash([]); }
      if (r.llamas || r.ceniza) { const a = c.globalAlpha; for (let i = 0; i < 4; i++) { const f = (K.t * 0.9 + i * 0.27) % 1; c.globalAlpha = a * (1 - f) * 0.8; disco(c, K, r.llamas ? (i % 2 ? "#ffb03a" : "#ff6a2a") : "#b8b0a8", -4 + i * 2.8 + Math.sin(K.t * 3 + i) * 1.2, (r.llamas ? -38 : -28) - f * 12, r.llamas ? 1.8 - f : 1); } c.globalAlpha = a; }
    }
    if (K.flash > 0) { const a0 = c.globalAlpha; c.globalAlpha = a0 * Math.min(0.6, K.flash * 0.6); c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(0, -21, 8.5, 19, 0, 0, 7); c.fill(); c.globalAlpha = a0; }
    if (o.herido) { trazo(c, K, "#8f2a24", 2, -3, -24, 3, -18); trazo(c, K, "#e9e2cf", 2, -4, -33, 4, -33); }
    if (o.luto) trazo(c, K, "#111", 3, -6, -22, -6, -17);
    c.restore();
  }

  /* La figura sola, quieta, en un canvas pequeño (para botones, tarjetas y listas) */
  function icono(canvas, q, bando, o) {
    o = o || {};
    const w = o.w || 56, h = o.h || 64, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const r = receta(q), tam = r.tam || 1, alto = r.entera && r.entera !== "barrilero" && r.entera !== "zaphar" && r.entera !== "quimera" && r.entera !== "engranaje" ? 34 : 50;
    const s = Math.min(h * 0.82 / (alto * tam / 40), w * 0.9 / (30 * tam / 40));
    figura(c, q, bando || colorFaccion(q.faccion || "caballeros-del-reino"), { x: w / 2 + (o.dx || 0), y: h * 0.92, s, dir: 1, t: o.t || 0, sw: o.sw || 0, sinAro: !!o.sinAro, herido: o.herido, cap: o.cap, rango: o.rango, luto: o.luto });
  }

  return { figura, icono, coloresBando, colorFaccion, PALETA_BANDOS, FORMAS, mezcla, oscuro, claro, receta };
})();
