/* =============================================================================
   LA FRACTURA: el tablero, dibujado en un canvas a pantalla completa. Solo dibuja y avisa de los
   toques: las reglas son del motor. Las animaciones son puramente visuales: el motor ya resolvió la
   acción y aquí se reproducen sus eventos (mover, golpe, muerte, nuevo, captura) por encima del
   estado real, que es el que siempre se dibuja al terminar. Respeta la niebla de guerra del humano.
   Las figuras de los soldados son siluetas planas por clase, con faction, capitán, rango y heridas.
============================================================================= */
window.FracturaTablero = (function () {
  const D = window.FRACTURA_DATOS;
  const { TERRENOS, CLASES, FACCIONES } = D;
  const REDUCIDO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Colores --- */
  const hex = h => { if (h[0] !== "#") { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const mezcla = (a, b, t) => { const x = hex(a), y = hex(b); return rgb(x.map((v, i) => v + (y[i] - v) * t)); };
  const oscuro = (c, t) => mezcla(c, "#000000", t);
  const claro = (c, t) => mezcla(c, "#ffffff", t);
  const distCol = (a, b) => { const x = hex(a), y = hex(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };

  function coloresBando(est) {
    const f0 = FACCIONES[est.jugadores[0].faccion], f1 = FACCIONES[est.jugadores[1].faccion];
    const c0 = f0.color;
    let c1 = f1.color;
    if (distCol(c0, c1) < 150) c1 = "#c0463c";
    return [{ col: c0, ban: f0.bandera }, { col: c1, ban: f1.bandera }];
  }

  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* =========================================================================
     FIGURAS. Se dibujan mirando a la derecha, con los pies en (0,0) y 40 unidades por casilla.
     K: { col, dark, ban, cl, fase, mov, sw, flash, cap, rango, herido, escala }
  ========================================================================= */
  const PIEL = "#b8906c", ACERO = "#8a939e", MADERA = "#5a3d24", HUESO = "#d9d1bb", CUERO = "#4a3722", NEGRO = "#07060a";

  function F(K, c) {
    if (typeof c !== "string") return c;
    return K.flash > 0 ? mezcla(c.startsWith("#") ? c : "#888888", "#ffffff", Math.min(1, K.flash)) : c;
  }
  function trazo(c, K, color, ancho, x1, y1, x2, y2) {
    c.strokeStyle = F(K, color); c.lineWidth = ancho; c.lineCap = "round";
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  function disco(c, K, color, x, y, r) { c.fillStyle = F(K, color); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function poli(c, K, color, pts) {
    c.fillStyle = F(K, color); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); c.fill();
  }
  /* Metal con luz de arriba a la izquierda: claro, color y sombra */
  function metal(K, base, x0, y0, x1, y1) {
    const g = K.c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, claro(base, 0.34)); g.addColorStop(0.4, base); g.addColorStop(1, oscuro(base, 0.72));
    return g;
  }
  /* Un ojo encendido en la sombra del yelmo o la capucha */
  function ojoL(c, K, x, y, col) {
    const a = c.globalAlpha;
    c.globalAlpha = a * 0.4; disco(c, K, col, x, y, 2.5);
    c.globalAlpha = a; disco(c, K, col, x, y, 0.95);
  }

  function piernas(c, K, colorPierna) {
    const p = K.mov ? Math.sin(K.fase) * 5 : 0, lev = K.mov ? Math.max(0, Math.cos(K.fase)) * 2 : 0, lev2 = K.mov ? Math.max(0, -Math.cos(K.fase)) * 2 : 0;
    trazo(c, K, colorPierna, 3.8, -2.5, -13, -2.5 - p * 0.6, -1 - lev);
    trazo(c, K, colorPierna, 3.8, 2.5, -13, 2.5 + p * 0.6, -1 - lev2);
    trazo(c, K, "#121014", 3.2, -2.5 - p * 0.6, -1.6 - lev, -1.2 - p * 0.6, -1 - lev);
    trazo(c, K, "#121014", 3.2, 2.5 + p * 0.6, -1.6 - lev2, 3.8 + p * 0.6, -1 - lev2);
  }
  function torso(c, K, color, ancho, alto, y0) {
    const w = ancho / 2;
    poli(c, K, color, [[-w, y0], [w, y0], [w * 0.8, y0 - alto], [-w * 0.8, y0 - alto]]);
  }
  /* Brazo con arma: el ángulo sw (-1 recogido, 0 reposo, 1 golpe) mueve la mano */
  function manoArma(K, hombro, largo) {
    const ang = -0.5 + K.sw * 1.7 + (K.mov ? Math.sin(K.fase) * 0.25 : 0);
    return { x: hombro.x + Math.cos(ang) * largo, y: hombro.y + Math.sin(ang) * largo, ang };
  }
  const hoja = (c, K, h, largo, ancho) => {
    const a = h.ang - 0.1, x2 = h.x + Math.cos(a) * largo, y2 = h.y + Math.sin(a) * largo;
    trazo(c, K, "#2a2c30", ancho + 1.2, h.x, h.y, x2, y2);
    trazo(c, K, "#cfd6de", ancho, h.x, h.y, x2, y2);
    trazo(c, K, MADERA, 3, h.x - Math.cos(h.ang) * 2, h.y - Math.sin(h.ang) * 2, h.x + Math.cos(h.ang), h.y + Math.sin(h.ang));
    return { x: x2, y: y2 };
  };
  const capa = (c, K, col, x0, x1) => poli(c, K, col, [[x0, -27], [x0 + 3, -27], [x1, -6], [x1 - 9, -9]]);

  /* Cada clase: silueta propia (yelmo, capucha, máscara, calavera), metal con luz y los ojos encendidos.
     Se dibujan mirando a la derecha, con los pies en (0,0) y 40 unidades por casilla. */
  const FIG = {
    guerrero(c, K) {
      piernas(c, K, "#24262c");
      capa(c, K, oscuro(K.ban, 0.1), -4, -9);
      torso(c, K, metal(K, ACERO, -6, -26, 6, -13), 12, 13, -13);
      poli(c, K, K.ban, [[-1.6, -13], [1.6, -13], [2.2, -25], [-2.2, -25]]);
      disco(c, K, oscuro(K.col, 0.5), -6.5, -19, 7); c.strokeStyle = F(K, ACERO); c.lineWidth = 1.3; c.beginPath(); c.arc(-6.5, -19, 6.6, 0, 7); c.stroke(); disco(c, K, ACERO, -6.5, -19, 2);
      const h = manoArma(K, { x: 5, y: -24 }, 8);
      trazo(c, K, "#3a3d44", 3.2, 5, -24, h.x, h.y);
      hoja(c, K, h, 14, 2.4);
      poli(c, K, metal(K, ACERO, -5, -38, 5, -28), [[-5.2, -28], [5.2, -28], [4.8, -35], [0, -38.6], [-4.8, -35]]);
      poli(c, K, NEGRO, [[0.8, -33.5], [5.2, -33.5], [5.2, -31.2], [0.8, -31.2]]);
      ojoL(c, K, 3.6, -32.3, "#ffbe4a");
      trazo(c, K, "#2a2c30", 1.2, -5, -28.5, 5, -28.5);
    },
    cazador(c, K) {
      piernas(c, K, "#2a2218");
      capa(c, K, oscuro(K.ban, 0.25), -5, -9);
      torso(c, K, metal(K, CUERO, -5, -26, 5, -13), 10.5, 13, -13);
      trazo(c, K, "#1c130a", 2.4, -5, -26, 5, -14);
      trazo(c, K, MADERA, 3.2, -6, -27, -2.5, -17);
      [[-6.5, -29], [-5, -30], [-3.5, -29]].forEach((p, i) => { trazo(c, K, "#d8c9a6", 1, p[0], p[1], p[0] + 1, p[1] + 5); poli(c, K, K.ban, [[p[0], p[1] - 3], [p[0] - 1.2, p[1]], [p[0] + 1.2, p[1]]]); });
      poli(c, K, oscuro(K.ban, 0.1), [[-6, -26], [-1.5, -40], [6, -29], [5, -25], [-4, -25]]);
      poli(c, K, NEGRO, [[-1, -33], [5, -31], [5, -26.5], [-1, -27]]);
      poli(c, K, HUESO, [[2.5, -33], [10, -29.5], [2.5, -28]]);
      ojoL(c, K, 1.9, -31, "#ffbe4a");
      const t = K.sw;
      c.strokeStyle = F(K, MADERA); c.lineWidth = 2.4; c.beginPath(); c.arc(9, -22, 9, -1.15 - t * 0.1, 1.15 + t * 0.1); c.stroke();
      trazo(c, K, "#e8e2d0", 0.8, 9 + Math.cos(1.15) * 9, -22 - Math.sin(1.15) * 9, 9 - t * 5, -22);
      trazo(c, K, "#e8e2d0", 0.8, 9 + Math.cos(1.15) * 9, -22 + Math.sin(1.15) * 9, 9 - t * 5, -22);
      trazo(c, K, "#3a2c20", 2.6, 4, -23, 9 - t * 5, -22);
      if (t > 0.3 && t < 0.9) trazo(c, K, "#d8c9a6", 1.4, 9 - t * 5, -22, 19, -22);
    },
    arcanista(c, K) {
      poli(c, K, metal(K, mezcla(K.ban, "#0c0a16", 0.3), -8, -14, 8, 0), [[-5, -15], [5, -15], [8.5, 0], [-8.5, 0]]);
      torso(c, K, metal(K, mezcla(K.ban, "#0c0a16", 0.2), -5, -26, 5, -13), 11, 12, -13);
      trazo(c, K, K.col, 1.4, -5.5, -14.5, 5.5, -14.5);
      poli(c, K, mezcla(K.ban, "#0c0a16", 0.4), [[-6.5, -26], [0.5, -45], [6.5, -26], [3, -24], [-3, -24]]);
      poli(c, K, NEGRO, [[-1, -33], [5, -33], [5, -27], [-1, -27]]);
      ojoL(c, K, 1.5, -30.5, "#8fe8ff"); ojoL(c, K, 4.4, -30.5, "#8fe8ff");
      const h = manoArma(K, { x: 5, y: -23 }, 6);
      trazo(c, K, "#2a2430", 2.6, 5, -23, h.x, h.y);
      const ox = h.x + Math.cos(h.ang) * 2, oy = h.y - 14 + K.sw * 2;
      trazo(c, K, MADERA, 2, h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5 + 8, ox, oy);
      const a = c.globalAlpha; c.globalAlpha = a * 0.4; disco(c, K, "#8fd8ff", ox, oy, 5.5); c.globalAlpha = a; disco(c, K, K.sw > 0.5 ? "#ffffff" : "#8fd8ff", ox, oy, 2.8);
    },
    paladin(c, K) {
      piernas(c, K, "#32343c");
      torso(c, K, metal(K, ACERO, -7, -26, 7, -13), 14, 13, -13);
      poli(c, K, K.col, [[-1.6, -13], [1.6, -13], [2.2, -25], [-2.2, -25]]);
      trazo(c, K, K.col, 2.4, -6.5, -24, 6.5, -24);
      poli(c, K, metal(K, ACERO, -12, -27, -3, -8), [[-12, -27], [-3, -27], [-3, -12], [-7.5, -7], [-12, -12]]);
      trazo(c, K, K.ban, 1.8, -7.5, -25, -7.5, -11); trazo(c, K, K.ban, 1.8, -11, -20, -4, -20);
      const h = manoArma(K, { x: 6, y: -23 }, 7);
      trazo(c, K, "#3a3d44", 3.2, 6, -23, h.x, h.y);
      trazo(c, K, MADERA, 2.6, h.x, h.y, h.x + Math.cos(h.ang) * 9, h.y + Math.sin(h.ang) * 9);
      disco(c, K, "#8a8f98", h.x + Math.cos(h.ang) * 10, h.y + Math.sin(h.ang) * 10, 3.4);
      poli(c, K, "#8a1f1f", [[-1, -38], [1.5, -38], [4.5, -45], [-2, -43]]);
      poli(c, K, metal(K, ACERO, -6, -39, 6, -28), [[-6, -28], [6, -28], [5.4, -37], [0, -39.5], [-5.4, -37]]);
      poli(c, K, NEGRO, [[0.5, -34], [5.8, -34], [5.8, -32.4], [0.5, -32.4]]); poli(c, K, NEGRO, [[2.6, -36], [3.8, -36], [3.8, -30], [2.6, -30]]);
      ojoL(c, K, 4.4, -33.2, "#ffd27a");
    },
    picaro(c, K) {
      K.y = (K.y || 0) + 1.5;
      piernas(c, K, "#1b1d21");
      poli(c, K, "#141a16", [[-5, -26], [-9, -5], [0, -9], [4, -26]]);
      torso(c, K, metal(K, "#262e28", -5, -26, 5, -13), 10, 12, -13);
      trazo(c, K, K.col, 1.6, -5, -14, 5, -14);
      poli(c, K, "#141a16", [[-6, -27], [0, -37], [6, -28], [5, -24], [-5, -24]]);
      poli(c, K, "#26301f", [[-1, -28], [6, -28], [4, -23], [-1, -23]]);
      poli(c, K, NEGRO, [[-1, -32], [6, -32], [6, -29], [-1, -29]]);
      ojoL(c, K, 2.2, -30.5, "#a8f0d6"); ojoL(c, K, 5, -30.5, "#a8f0d6");
      const h = manoArma(K, { x: 4, y: -23 }, 6);
      trazo(c, K, "#1b1d21", 2.4, 4, -23, h.x, h.y);
      hoja(c, K, h, 8, 1.8);
      trazo(c, K, "#1b1d21", 2.4, -4, -23, -8, -18);
      trazo(c, K, "#cfd6de", 1.8, -8, -18, -11, -22);
    },
    caballero(c, K) {
      piernas(c, K, "#32343c");
      torso(c, K, metal(K, ACERO, -8, -27, 8, -13), 15, 14, -13);
      trazo(c, K, K.col, 3, -7, -21, 7, -21);
      poli(c, K, K.col, [[-1.8, -13], [1.8, -13], [2.4, -26], [-2.4, -26]]);
      poli(c, K, metal(K, K.col, -12, -28, -4, -9), [[-12, -28], [-4, -28], [-4, -14], [-8, -9], [-12, -14]]);
      const h = manoArma(K, { x: 7, y: -22 }, 6);
      trazo(c, K, "#3a3d44", 3.2, 7, -22, h.x, h.y);
      const lx = h.x + Math.cos(h.ang) * 20, ly = h.y + Math.sin(h.ang) * 20;
      trazo(c, K, MADERA, 2.2, h.x - Math.cos(h.ang) * 6, h.y - Math.sin(h.ang) * 6, lx, ly);
      poli(c, K, K.ban, [[lx, ly], [lx - 6, ly - 3], [lx - 5, ly + 2]]);
      poli(c, K, K.col, [[-1.6, -40], [1.6, -40], [4.5, -47], [-3, -45]]);
      poli(c, K, metal(K, ACERO, -6.4, -41, 6.4, -28), [[-6.2, -28], [6.2, -28], [6, -37], [0, -41], [-6, -37]]);
      poli(c, K, NEGRO, [[1, -35], [6, -35], [6, -33.2], [1, -33.2]]);
      ojoL(c, K, 4.2, -34.1, "#ffb84a");
    },
    esqueleto(c, K) {
      K.hueso = true;
      const carne = "#7a8670", tela = oscuro(K.ban, 0.3);
      piernas(c, K, "#6e7660");
      // capa a jirones por detrás
      poli(c, K, tela, [[-6, -27], [4, -27], [7, -14], [9, -6], [6, -9], [4, -3], [1, -8], [-2, -3], [-5, -8], [-9, -4], [-8, -14]]);
      // pecho al aire: carne gris y costillas
      poli(c, K, carne, [[-3.6, -26], [3.6, -26], [3, -14], [-3, -14]]);
      for (let i = 0; i < 3; i++) trazo(c, K, "#d6cdb4", 1.1, -3, -23 + i * 3.4, 3, -23 + i * 3.4);
      poli(c, K, oscuro(K.ban, 0.5), [[-6, -26], [-3.6, -26], [-3, -14], [-7, -13]]);
      // hombrera oxidada con pinchos
      poli(c, K, "#6b5240", [[-8.5, -27], [-2, -28.5], [-3, -22.5], [-9, -23.5]]);
      poli(c, K, "#8a6a52", [[-7, -27], [-6.3, -32], [-4.6, -28]]); poli(c, K, "#8a6a52", [[-4.2, -28], [-3.2, -33], [-2, -28.5]]);
      // capucha rota con el rostro hueco
      poli(c, K, tela, [[-6.5, -26], [-3, -38], [0.5, -43], [6, -31], [5, -25], [3, -23.5], [1, -25], [-1.5, -23.5], [-4, -25]]);
      poli(c, K, "#040306", [[-1.5, -35], [5, -33], [5, -27], [-1, -27]]);
      poli(c, K, carne, [[-0.8, -33.5], [4.6, -32.2], [4.4, -28], [-0.6, -28]]);
      poli(c, K, "#d6cdb4", [[1, -28.2], [4.4, -28.6], [3.8, -25.6], [1.4, -25.2]]);
      ojoL(c, K, 1.6, -31.2, "#c9f25a"); ojoL(c, K, 4, -30.6, "#c9f25a");
      const h = manoArma(K, { x: 4, y: -23 }, 7);
      trazo(c, K, carne, 2.4, 4, -23, h.x, h.y);
      trazo(c, K, "#2a2018", 3.4, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 12, h.y + Math.sin(h.ang - 0.1) * 12);
      trazo(c, K, "#8a6a52", 2.2, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 12, h.y + Math.sin(h.ang - 0.1) * 12);
    },
    archimago(c, K) {
      poli(c, K, metal(K, mezcla(K.ban, "#0c0a16", 0.3), -9, -14, 9, 0), [[-5, -15], [5, -15], [9.5, 0], [-9.5, 0]]);
      torso(c, K, metal(K, mezcla(K.ban, "#0c0a16", 0.15), -6, -26, 6, -13), 12, 12, -13);
      poli(c, K, K.ban, [[-6, -22], [6, -22], [7, -16], [-7, -16]]);
      poli(c, K, "#e6e2da", [[2.5, -28], [6.5, -26], [4, -14], [1, -22]]);
      poli(c, K, NEGRO, [[-1.5, -33], [5.5, -33], [5.5, -27.5], [-1.5, -27.5]]);
      ojoL(c, K, 1.5, -30.4, "#d6e8ff"); ojoL(c, K, 4.5, -30.4, "#d6e8ff");
      poli(c, K, mezcla(K.ban, "#0c0a16", 0.35), [[-9, -32], [9, -32], [6, -34], [3, -49], [-1, -47], [-5, -34]]);
      trazo(c, K, K.col, 1.2, -8, -32.6, 8, -32.6);
      const h = manoArma(K, { x: 5, y: -24 }, 6);
      trazo(c, K, "#2a2430", 2.4, 5, -24, h.x, h.y);
      const ox = h.x + Math.cos(h.ang) * 2, oy = h.y - 14 + K.sw * 2;
      trazo(c, K, MADERA, 2, h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5 + 9, ox, oy);
      const a = c.globalAlpha; c.globalAlpha = a * 0.4; disco(c, K, "#e6c6ff", ox, oy - 3, 6); c.globalAlpha = a;
      poli(c, K, K.sw > 0.5 ? "#ffffff" : "#e6c6ff", [[ox, oy - 8], [ox + 3.6, oy - 3], [ox, oy + 2], [ox - 3.6, oy - 3]]);
    },
    ballestero(c, K) {
      piernas(c, K, "#26282e");
      capa(c, K, oscuro(K.ban, 0.3), -5, -9);
      torso(c, K, metal(K, "#3a3d33", -5, -26, 5, -13), 12, 12, -13);
      trazo(c, K, "#6a4a2c", 3, -5.5, -25, 5.5, -14);
      poli(c, K, metal(K, ACERO, -6, -26, 6, -20), [[-6.5, -26], [6.5, -26], [5.6, -22], [-5.6, -22]]);
      const r = -K.sw * 4;
      trazo(c, K, MADERA, 3.2, 2 + r, -21, 15 + r, -22);
      c.strokeStyle = F(K, "#5a5d62"); c.lineWidth = 2.2; c.beginPath(); c.moveTo(10 + r, -27); c.lineTo(12.5 + r, -22); c.lineTo(10 + r, -17); c.stroke();
      trazo(c, K, "#3a2c20", 2.6, 4, -23, 9 + r, -21.5);
      if (K.sw < 0.4) trazo(c, K, "#d8c9a6", 1.3, 6 + r, -22, 16 + r, -22);
      poli(c, K, metal(K, ACERO, -6, -37, 6, -28), [[-5.8, -28], [6, -28], [6.6, -31], [5.4, -36], [0, -38], [-5.4, -36]]);
      poli(c, K, NEGRO, [[0.5, -33.4], [6, -33.4], [6, -31.8], [0.5, -31.8]]);
      ojoL(c, K, 4, -32.6, "#ffcf6a");
    },
    mercenario(c, K) {
      piernas(c, K, "#2a2420");
      torso(c, K, metal(K, "#6a5a46", -6, -26, 6, -13), 12, 12, -13);
      trazo(c, K, "#8a2a24", 2.8, -6, -15, 6, -13);
      poli(c, K, metal(K, ACERO, -6, -27, -2, -20), [[-7, -26], [-2, -26], [-2, -21], [-7, -22]]);
      disco(c, K, "#54392a", 0.5, -30.5, 4.7);
      poli(c, K, "#2e2622", [[-4.6, -29.5], [5, -29.5], [4, -25.5], [-3.5, -25.5]]);
      poli(c, K, "#9a2e26", [[-5.2, -33.5], [5.2, -33.5], [5, -35], [-4.8, -35.5]]);
      poli(c, K, "#7a2019", [[-5, -34], [-9, -31.5], [-6.5, -30]]);
      disco(c, K, "#090606", -1.8, -31.6, 1.6); ojoL(c, K, 2.6, -31.6, "#ffd24a");
      const h = manoArma(K, { x: 5, y: -24 }, 8);
      trazo(c, K, "#3a2c20", 3.2, 5, -24, h.x, h.y);
      hoja(c, K, h, 12, 2.8);
    },
    sanador(c, K) {
      poli(c, K, metal(K, "#cfc8b4", -9, -14, 9, 0), [[-5, -15], [5, -15], [8.5, 0], [-8.5, 0]]);
      torso(c, K, metal(K, "#d9d2c0", -5.5, -26, 5.5, -13), 11, 12, -13);
      poli(c, K, K.ban, [[-1.2, -25], [1.2, -25], [1.2, -17], [-1.2, -17]]);
      poli(c, K, K.ban, [[-4, -22], [4, -22], [4, -20], [-4, -20]]);
      poli(c, K, "#d9d2c0", [[-6.5, -27], [0, -38], [6.5, -28], [4, -24.5], [-4, -24.5]]);
      poli(c, K, metal(K, "#d6b25a", 1, -33, 5, -27), [[1.4, -33.4], [5.6, -31.5], [4.8, -27.5], [1.4, -27]]);
      ojoL(c, K, 4.1, -31, "#fff0b0");
      trazo(c, K, MADERA, 2.2, 8, -3, 8, -34);
      const a = c.globalAlpha; c.globalAlpha = a * 0.4; disco(c, K, "#ffe9a6", 8, -37, 5); c.globalAlpha = a; disco(c, K, "#ffe9a6", 8, -37, 2.6);
    },
    lider(c, K) {
      capa(c, K, oscuro(K.ban, 0.05), -7, -13);
      poli(c, K, K.ban, [[-7, -28], [-1, -28], [-5, -4], [-12, -4]]);
      piernas(c, K, "#32343c");
      torso(c, K, metal(K, ACERO, -8, -28, 8, -13), 15, 14, -13);
      trazo(c, K, "#f0cf6a", 2.6, -7.5, -22, 7.5, -22);
      poli(c, K, "#ece5d2", [[-8, -27], [-4, -29], [0, -26], [4, -29], [8, -27], [8, -24], [-8, -24]]);
      const h = manoArma(K, { x: 7, y: -24 }, 8);
      trazo(c, K, "#3a3d44", 3.2, 7, -24, h.x, h.y);
      hoja(c, K, h, 15, 3);
      poli(c, K, metal(K, ACERO, -6.4, -41, 6.4, -28), [[-6.2, -28], [6.2, -28], [6, -38], [0, -40], [-6, -38]]);
      poli(c, K, NEGRO, [[0.5, -34], [6, -34], [6, -32], [0.5, -32]]);
      ojoL(c, K, 4.2, -33, "#ff5a3a");
      poli(c, K, "#f0cf6a", [[-6, -38], [6, -38], [7, -45], [3.5, -41.5], [0, -46], [-3.5, -41.5], [-7, -45]]);
      trazo(c, K, "#d8c28a", 1.4, -11, -30, -11, -52); poli(c, K, K.col, [[-11, -52], [-3, -49], [-11, -45]]);
    },
    eco(c, K) {
      const bob = Math.sin(K.t * 3) * 1.5;
      c.globalAlpha *= 0.78;
      c.fillStyle = F(K, mezcla(K.col, "#bfe9f2", 0.55)); c.beginPath(); c.moveTo(0, -37 + bob); c.quadraticCurveTo(10, -22, 7, -9); c.lineTo(3, -5 + bob); c.lineTo(0, -8 + bob); c.lineTo(-3, -4 + bob); c.lineTo(-7, -9); c.quadraticCurveTo(-10, -22, 0, -37 + bob); c.fill();
      c.fillStyle = "#04141a"; c.beginPath(); c.ellipse(1, -26 + bob, 5, 7, 0, 0, 7); c.fill();
      ojoL(c, K, -1.5, -27 + bob, "#e9fbff"); ojoL(c, K, 3.5, -27 + bob, "#e9fbff");
      c.strokeStyle = "rgba(190,235,255,.5)"; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -3, 11, 3, 0, 0, 7); c.stroke();
      c.globalAlpha /= 0.78;
    },
    salvaje(c, K) {
      const p = K.mov ? Math.sin(K.fase) * 3 : 0, pel = "#4a3c40";
      c.fillStyle = F(K, metal(K, pel, -12, -20, 12, -8)); c.beginPath(); c.ellipse(0, -14, 12.5, 7.2, 0, 0, 7); c.fill();
      [[-8, -p], [-3, p], [3, -p], [8, p]].forEach(([x, d]) => trazo(c, K, "#2a2024", 3.2, x, -10, x + d * 0.5, -1));
      c.fillStyle = F(K, metal(K, pel, 6, -24, 18, -14)); c.beginPath(); c.ellipse(12, -19, 5.8, 4.8, 0.3, 0, 7); c.fill();
      poli(c, K, "#2a2024", [[8.5, -22.5], [9.5, -28], [12.5, -23.5]]); poli(c, K, "#2a2024", [[13, -22], [16, -27], [16.5, -21]]);
      trazo(c, K, "#efe6cf", 1.6, 15, -16.5, 14.5, -14.5);
      ojoL(c, K, 13.4, -20.2, "#ffd24a");
      trazo(c, K, "#2a2024", 2.6, -12, -16, -17, -20);
    }
  };

  /* Dibuja una figura entera. o: { x, y (en píxeles, pies), s (px por casilla), dir, ... } */
  function figura(c, cl, bando, o) {
    const s = o.s / 40 * (cl === "lider" ? 1.18 : cl === "paladin" || cl === "caballero" ? 1.06 : 1);
    const K = {
      c, cl, col: bando.col, dark: oscuro(bando.col, 0.55), ban: bando.ban, fase: o.fase || 0, mov: !!o.mov, sw: o.sw || 0, flash: o.flash || 0, t: o.t || 0, y: 0
    };
    c.save();
    c.translate(o.x, o.y);
    c.scale(s * (o.dir || 1), s);
    if (o.rot) { c.rotate(o.rot); }
    if (o.alfa !== undefined) c.globalAlpha = o.alfa;
    // sombra y aro del bando bajo los pies: se lee sobre cualquier terreno
    c.fillStyle = "rgba(0,0,0,.45)"; c.beginPath(); c.ellipse(0, 0, 12.5, 4, 0, 0, 7); c.fill();
    c.strokeStyle = bando.col; c.lineWidth = 1.3; c.globalAlpha *= 0.9; c.beginPath(); c.ellipse(0, 0, 12.5, 4, 0, 0, 7); c.stroke(); c.globalAlpha /= 0.9;
    c.translate(0, o.bob || 0);
    // capa de veterano y estandarte de capitán, por detrás
    if (o.rango >= 2 && cl !== "lider" && cl !== "eco" && cl !== "salvaje") poli(c, K, oscuro(bando.col, 0.35), [[-3, -26], [-1, -26], [-6, -6], [-11, -9]]);
    if (o.cap) {
      trazo(c, K, "#d8c28a", 1.5, -8, -3, -8, -48);
      const on = Math.sin((o.t || 0) * 5) * 2;
      poli(c, K, bando.col, [[-8, -48], [2, -45 + on], [-8, -40]]);
    }
    (FIG[cl] || FIG.guerrero)(c, K);
    if (K.flash > 0) { const a0 = c.globalAlpha; c.globalAlpha = a0 * Math.min(0.6, K.flash * 0.6); c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(0, -21, 8.5, 19, 0, 0, 7); c.fill(); c.globalAlpha = a0; }
    if (o.herido) { trazo(c, K, "#8f2a24", 2, -3, -24, 3, -18); trazo(c, K, "#e9e2cf", 2, -4, -33, 4, -33); }
    if (o.luto) trazo(c, K, "#111", 3, -6, -22, -6, -17);
    c.restore();
    // insignias de rango (en píxeles, no giran)
    if (o.rango > 0 && cl !== "salvaje") {
      c.fillStyle = "#f0cf6a";
      for (let i = 0; i < Math.min(o.rango, 4); i++) { c.fillRect(o.x + o.s * 0.18, o.y - o.s * 0.9 + i * (o.s * 0.07), o.s * 0.13, o.s * 0.04); }
    }
  }

  /* =========================================================================
     TABLERO
  ========================================================================= */
  function crear(canvas, hooks) {
    const ctx = canvas.getContext("2d");
    let est = null, ts = 40, dpr = 1, ox = 0, oy = 0, ancho = 0, alto = 0;
    let estado = { sel: null, mover: new Map(), atacar: new Set(), ciudad: null, objetivosHab: new Set(), ruta: null, hover: null, previaAtq: null };
    let bandos = null;
    let anim = null;          // reproducción de eventos en curso
    const efectos = [];       // textos de daño, chispas, polvo y ondas
    let pendiente = false, t0 = performance.now(), terminar = [];
    let reserva = { arriba: 58, abajo: 8, izq: 8, der: 8 };
    const antes = { uid: null };

    function medir() {
      dpr = window.devicePixelRatio || 1;
      ancho = window.innerWidth; alto = window.innerHeight;
      canvas.style.width = `${ancho}px`; canvas.style.height = `${alto}px`;
      canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!est) return;
      const libreW = ancho - reserva.izq - reserva.der, libreH = alto - reserva.arriba - reserva.abajo;
      ts = Math.max(24, Math.floor(Math.min(libreW / est.ancho, libreH / est.alto)));
      ox = Math.round(reserva.izq + (libreW - ts * est.ancho) / 2);
      oy = Math.round(reserva.arriba + (libreH - ts * est.alto) / 2);
      pedir();
    }
    window.addEventListener("resize", medir);

    function pedir() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(ahora => { pendiente = false; dibujar(ahora); if (anim || efectos.length || !REDUCIDO) pedir(); });
    }

    /* --- Casilla <-> píxeles --- */
    const px = x => ox + x * ts, py = y => oy + y * ts;
    const centro = (x, y) => ({ x: px(x) + ts / 2, y: py(y) + ts / 2 });
    function celdaDe(ev) {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((ev.clientX - r.left - ox) / ts), y = Math.floor((ev.clientY - r.top - oy) / ts);
      return { x, y, dentro: !!est && x >= 0 && y >= 0 && x < est.ancho && y < est.alto };
    }

    /* =====================================================================
       Terreno: texturas pintadas una vez por tipo, variante y tamaño de casilla (con luz de arriba a la
       izquierda, manchas, grano y un borde oscuro). Encima solo se dibuja lo que se mueve.
    ===================================================================== */
    const texturas = new Map();
    const PALETA = {
      llanura: ["#5b7036", "#2c3a19"], bosque: ["#2f4a29", "#12200e"], montana: ["#554c42", "#201c18"], desierto: ["#b8955a", "#684f2c"],
      agua: ["#25557f", "#0a2040"], magica: ["#442a68", "#140a26"], huesos: ["#706b5d", "#2b2822"], vacio: ["#0d0a15", "#050408"]
    };
    function textura(tipo, variante) {
      const k = tipo + variante + "|" + ts;
      let cv = texturas.get(k);
      if (cv) return cv;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      cv = document.createElement("canvas"); cv.width = cv.height = Math.max(1, Math.round(ts * d));
      const g = cv.getContext("2d"); g.scale(cv.width / 40, cv.width / 40);
      pintarTextura(g, tipo, variante);
      if (texturas.size > 90) texturas.delete(texturas.keys().next().value);
      texturas.set(k, cv);
      return cv;
    }
    function pintarTextura(g, tipo, v) {
      const sem = tipo.charCodeAt(0) * 7 + tipo.length;
      const r = n => hash(v + 3, n, sem);
      const pal = PALETA[tipo] || PALETA.llanura;
      const gr = g.createLinearGradient(0, 0, 40, 40); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
      g.fillStyle = gr; g.fillRect(0, 0, 40, 40);
      g.save(); g.beginPath(); g.rect(0, 0, 40, 40); g.clip();
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "rgba(255,240,200,.05)" : "rgba(0,0,0,.15)"; g.beginPath(); g.ellipse(r(i) * 40, r(i + 9) * 40, 6 + r(i + 3) * 8, 4 + r(i + 5) * 6, r(i + 1) * 3, 0, 7); g.fill(); }
      const poly = (col, pts) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
      const lin = (col, w, x1, y1, x2, y2) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
      switch (tipo) {
        case "llanura":
          for (let i = 0; i < 7; i++) { const a = 4 + r(20 + i) * 32, b = 10 + r(30 + i) * 28; lin(i % 2 ? "rgba(150,180,80,.7)" : "rgba(98,128,52,.8)", 1.2, a, b, a - 1.5, b - 4.5); lin(i % 2 ? "rgba(150,180,80,.7)" : "rgba(98,128,52,.8)", 1.2, a, b, a + 1.6, b - 4); }
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
          for (let i = 0; i < 3; i++) { const y = 10 + i * 11 + r(i) * 3; g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, y + 3); g.quadraticCurveTo(14, y - 6, 42, y + 3); g.stroke(); g.strokeStyle = "rgba(255,235,180,.3)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, y + 1); g.quadraticCurveTo(14, y - 8, 42, y + 1); g.stroke(); }
          g.fillStyle = "rgba(80,55,25,.5)"; for (let i = 0; i < 5; i++) g.fillRect(4 + r(40 + i) * 32, 6 + r(50 + i) * 30, 1.6, 1.1);
          break;
        case "agua":
          for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? "rgba(120,170,220,.07)" : "rgba(0,0,0,.14)"; g.fillRect(-2, 6 + i * 12 + r(i) * 3, 44, 5); }
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
      g.strokeStyle = "rgba(0,0,0,.42)"; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, 38.5, 38.5);
      g.strokeStyle = "rgba(255,240,200,.07)"; g.lineWidth = 1; g.beginPath(); g.moveTo(1.5, 38.5); g.lineTo(1.5, 1.5); g.lineTo(38.5, 1.5); g.stroke();
      g.restore();
    }

    function brillo(x, y, rad, col, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, "0")); g.addColorStop(1, col + "00");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    }

    function dibujarTerreno(c, x, y, v, t) {
      const X = px(x), Y = py(y);
      if (v === 0) {
        ctx.fillStyle = "#07050b"; ctx.fillRect(X, Y, ts, ts);
        ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1; ctx.strokeRect(X + .5, Y + .5, ts - 1, ts - 1);
        return;
      }
      const variante = Math.floor(hash(x, y, 1) * 4);
      ctx.drawImage(textura(c.t, variante), X, Y, ts, ts);
      const s = ts / 40, h = hash(x, y, 1);
      if (c.t === "agua") {
        ctx.strokeStyle = "rgba(170,210,245,.5)"; ctx.lineWidth = Math.max(1, 1.5 * s);
        [11, 21, 31].forEach((b, i) => {
          const fase = (t / 900 + i * 0.7 + h * 3) % 6.283, d = Math.sin(fase) * 3 * s;
          ctx.beginPath(); ctx.moveTo(X + 5 * s, Y + b * s); ctx.quadraticCurveTo(X + 12 * s, Y + b * s - 4 * s + d, X + 20 * s, Y + b * s); ctx.quadraticCurveTo(X + 28 * s, Y + b * s + 4 * s - d, X + 35 * s, Y + b * s); ctx.stroke();
        });
      } else if (c.t === "magica") {
        const flota = REDUCIDO ? 0 : Math.sin(t / 700 + h * 6) * 2 * s;
        brillo(X + 20 * s, Y + 20 * s + flota, 17 * s, "#b98cff", 0.35 + (REDUCIDO ? 0 : Math.sin(t / 500 + h * 5) * 0.1));
        const g = ctx.createLinearGradient(X + 13 * s, Y + 8 * s, X + 27 * s, Y + 32 * s); g.addColorStop(0, "#f1e4ff"); g.addColorStop(0.5, "#b88cf0"); g.addColorStop(1, "#5a2f94");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X + 20 * s, Y + 7 * s + flota); ctx.lineTo(X + 27 * s, Y + 20 * s + flota); ctx.lineTo(X + 20 * s, Y + 33 * s + flota); ctx.lineTo(X + 13 * s, Y + 20 * s + flota); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.moveTo(X + 20 * s, Y + 11 * s + flota); ctx.lineTo(X + 23 * s, Y + 20 * s + flota); ctx.lineTo(X + 20 * s, Y + 20 * s + flota); ctx.closePath(); ctx.fill();
      }
    }

    function bandera(X, Y, color, alto, t, fase) {
      ctx.strokeStyle = "#b9a56e"; ctx.lineWidth = Math.max(1.5, ts / 22);
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - alto); ctx.stroke();
      ctx.fillStyle = color;
      const w = alto * 0.7, h = alto * 0.42, on = REDUCIDO ? 0 : Math.sin(t / 220 + fase) * h * 0.12;
      ctx.beginPath(); ctx.moveTo(X, Y - alto); ctx.quadraticCurveTo(X + w * 0.5, Y - alto + on, X + w, Y - alto + h * 0.1 + on); ctx.lineTo(X + w * 0.78, Y - alto + h * 0.5); ctx.lineTo(X + w, Y - alto + h * 0.9 - on); ctx.quadraticCurveTo(X + w * 0.5, Y - alto + h * 0.8 - on, X, Y - alto + h); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.stroke();
    }

    /* Degradado vertical de piedra para una pieza */
    function piedra(X, Y, x0, y0, x1, y1, claro1, oscuro1) {
      const g = ctx.createLinearGradient(X + x0, Y + y0, X + x1, Y + y1);
      g.addColorStop(0, claro1 || "#9a9285"); g.addColorStop(1, oscuro1 || "#3f3a33");
      return g;
    }

    function dibujarEstructura(c, x, y, t) {
      if (!c.est && !(c.objetos && c.objetos.length)) return;
      const X = px(x), Y = py(y), s = ts / 40;
      if (c.est === "ciudad") {
        const ci = Object.values(est.ciudades).find(k => k.x === x && k.y === y);
        const dueno = ci ? ci.dueno : null;
        const col = dueno === null ? "#8a8a8a" : bandos[dueno].col, ban = dueno === null ? "#444" : bandos[dueno].ban;
        const casas = ci ? Math.min(4, 1 + Math.floor(ci.nivel / 2)) : 1;
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(X + 4 * s, Y + 31 * s, 32 * s, 4 * s);
        ctx.fillStyle = piedra(X, Y, 0, 20 * s, 0, 34 * s, "#8b8374", "#3a352e"); ctx.fillRect(X + 5 * s, Y + 21 * s, 30 * s, 13 * s);
        ctx.fillStyle = "#2a2622"; for (let i = 0; i < 6; i++) ctx.fillRect(X + (5 + i * 5.2) * s, Y + 19 * s, 3 * s, 3 * s);
        for (let i = 0; i < casas; i++) {
          const cx = X + (9 + i * 7 + (casas === 1 ? 7 : 0)) * s, desf = (i % 2) * 3 * s, top = Y + 17 * s - desf;
          ctx.fillStyle = piedra(cx, top, 0, 0, 0, 14 * s, "#cfc6b0", "#7a7160"); ctx.fillRect(cx, top, 8 * s, 14 * s);
          const gt = ctx.createLinearGradient(cx, top - 8 * s, cx + 9 * s, top); gt.addColorStop(0, col); gt.addColorStop(1, oscuro(col.startsWith("#") ? col : "#888888", 0.65));
          ctx.fillStyle = gt; ctx.beginPath(); ctx.moveTo(cx - 1.5 * s, top); ctx.lineTo(cx + 4 * s, top - 8 * s); ctx.lineTo(cx + 9.5 * s, top); ctx.closePath(); ctx.fill();
          ctx.fillStyle = (REDUCIDO || Math.sin(t / 700 + i * 2 + x) > -0.6) ? "#ffcf6a" : "#8a6a30"; ctx.fillRect(cx + 2.6 * s, top + 5 * s, 2.6 * s, 3 * s);
        }
        if (ci && ci.capital) { ctx.fillStyle = "#f0cf6a"; ctx.beginPath(); ctx.moveTo(X + 16 * s, Y + 8 * s); ctx.lineTo(X + 18 * s, Y + 4 * s); ctx.lineTo(X + 20 * s, Y + 7 * s); ctx.lineTo(X + 22 * s, Y + 4 * s); ctx.lineTo(X + 24 * s, Y + 8 * s); ctx.closePath(); ctx.fill(); }
        if (dueno !== null) bandera(X + 34 * s, Y + 21 * s, col, 17 * s, t, x + y);
        if (ci && ci.edificios.some(e => ci.desh[e] >= est.turno)) { ctx.fillStyle = "rgba(20,10,10,.55)"; ctx.fillRect(X + 5 * s, Y + 21 * s, 30 * s, 13 * s); }
      } else if (c.est === "fortaleza") {
        const i = est.fortalezas.findIndex(p => p.x === x && p.y === y);
        const d = i >= 0 ? est.fortalezasDueno[i] : null;
        const col = d === null ? "#7c7c7c" : bandos[d].col;
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(X + 6 * s, Y + 33 * s, 30 * s, 3.5 * s);
        ctx.fillStyle = piedra(X, Y, 8 * s, 14 * s, 32 * s, 34 * s, "#8d8678", "#34302a"); ctx.fillRect(X + 8 * s, Y + 14 * s, 24 * s, 20 * s);
        ctx.fillStyle = piedra(X, Y, 6 * s, 8 * s, 30 * s, 16 * s, "#a39c8c", "#4a453d"); for (let k = 0; k < 3; k++) ctx.fillRect(X + (8 + k * 9) * s, Y + 9 * s, 6 * s, 6 * s);
        ctx.fillStyle = "#0b0a0d"; ctx.beginPath(); ctx.moveTo(X + 17 * s, Y + 34 * s); ctx.lineTo(X + 17 * s, Y + 27 * s); ctx.arc(X + 20 * s, Y + 27 * s, 3 * s, Math.PI, 0); ctx.lineTo(X + 23 * s, Y + 34 * s); ctx.fill();
        ctx.fillStyle = "rgba(255,190,90,.7)"; ctx.fillRect(X + 18.8 * s, Y + 29 * s, 2.4 * s, 5 * s);
        if (d !== null) bandera(X + 20 * s, Y + 9 * s, col, 14 * s, t, x);
      } else if (c.est === "ruinas") {
        const gr = ctx.createLinearGradient(X, Y + 12 * s, X, Y + 34 * s); gr.addColorStop(0, c.saqueada ? "#7a746a" : "#9c9484"); gr.addColorStop(1, "#3a352e");
        ctx.strokeStyle = gr; ctx.lineWidth = 3.4 * s; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(X + 9 * s, Y + 33 * s); ctx.lineTo(X + 9 * s, Y + 17 * s); ctx.arc(X + 20 * s, Y + 17 * s, 11 * s, Math.PI, Math.PI * 1.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X + 31 * s, Y + 33 * s); ctx.lineTo(X + 31 * s, Y + 25 * s); ctx.stroke();
        ctx.fillStyle = "#3a352e"; ctx.fillRect(X + 12 * s, Y + 31 * s, 4 * s, 2 * s); ctx.fillRect(X + 23 * s, Y + 30 * s, 5 * s, 3 * s);
        if (!c.saqueada) { brillo(X + 20 * s, Y + 28.5 * s, 8 * s, "#f0d278", 0.35); ctx.fillStyle = "#ecd48a"; ctx.fillRect(X + 17.5 * s, Y + 27 * s, 5 * s, 3 * s); }
      } else if (c.est === "nucleo") {
        const h = Math.max(est.nucleoHold[0], est.nucleoHold[1]);
        const pul = REDUCIDO ? 0 : Math.sin(t / 500) * 1.2 * s;
        brillo(X + 20 * s, Y + 20 * s, 19 * s, "#f0d278", 0.3);
        ctx.strokeStyle = "#f0d278"; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 13 * s + pul, 0, 7); ctx.stroke();
        ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 6 * s, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + (REDUCIDO ? 0 : t / 4000); ctx.beginPath(); ctx.moveTo(X + 20 * s + Math.cos(a) * 15 * s, Y + 20 * s + Math.sin(a) * 15 * s); ctx.lineTo(X + 20 * s + Math.cos(a) * 18 * s, Y + 20 * s + Math.sin(a) * 18 * s); ctx.stroke(); }
        if (h) { ctx.fillStyle = bandos[est.nucleoHold[0] >= est.nucleoHold[1] ? 0 : 1].col; ctx.font = `bold ${12 * s}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(String(h), X + 20 * s, Y + 24.5 * s); }
      } else if (c.est === "costura") {
        const g = REDUCIDO ? 0 : t / 900;
        brillo(X + 20 * s, Y + 20 * s, 15 * s, "#8fe3e6", 0.28);
        ctx.strokeStyle = "#8fe3e6"; ctx.lineWidth = 2.4 * s;
        ctx.setLineDash([5 * s, 4 * s]); ctx.lineDashOffset = -g * 12 * s;
        ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 11 * s, 0, 7); ctx.stroke();
        ctx.lineDashOffset = g * 8 * s; ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 5.5 * s, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#d8fbfc"; ctx.fillRect(X + 18.5 * s, Y + 18.5 * s, 3 * s, 3 * s);
      }
      if (c.objetos && c.objetos.length) {
        const bob = REDUCIDO ? 0 : Math.sin(t / 400 + x) * 1.5 * s;
        brillo(X + 31 * s, Y + 9 * s + bob, 8 * s, "#f6d46c", 0.4);
        const gg = ctx.createLinearGradient(X + 27 * s, Y + 4 * s, X + 35 * s, Y + 14 * s); gg.addColorStop(0, "#fff0b0"); gg.addColorStop(1, "#c9902a");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(X + 31 * s, Y + 4 * s + bob); ctx.lineTo(X + 35 * s, Y + 9 * s + bob); ctx.lineTo(X + 31 * s, Y + 14 * s + bob); ctx.lineTo(X + 27 * s, Y + 9 * s + bob); ctx.fill();
      }
    }

    /* Esquinas de una casilla: marcan sin tapar el terreno */
    function esquinas(x, y, col, lw, largo, margen) {
      const X = px(x) + margen, Y = py(y) + margen, A = ts - margen * 2, L = ts * largo;
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "square";
      [[X, Y, 1, 1], [X + A, Y, -1, 1], [X, Y + A, 1, -1], [X + A, Y + A, -1, -1]].forEach(([a, b, dx, dy]) => { ctx.beginPath(); ctx.moveTo(a, b + dy * L); ctx.lineTo(a, b); ctx.lineTo(a + dx * L, b); ctx.stroke(); });
      ctx.lineCap = "round";
    }
    /* Oscurece los bordes del mapa para que la mirada caiga en el centro */
    function vineta() {
      const w = ts * est.ancho, h = ts * est.alto, g = ctx.createRadialGradient(ox + w / 2, oy + h / 2, Math.min(w, h) * 0.35, ox + w / 2, oy + h / 2, Math.max(w, h) * 0.78);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = g; ctx.fillRect(ox, oy, w, h);
    }

    /* Niebla que se desplaza y unas pocas motas. Muy sutil y siempre bajo las unidades. */
    function ambiente(t) {
      if (REDUCIDO) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, ts * est.ancho, ts * est.alto); ctx.clip();
      ctx.fillStyle = "rgba(226,232,240,.035)";
      for (let i = 0; i < 5; i++) {
        const cx = ox + (((t / (11000 + i * 2300) + i * 0.37) % 1.5) - 0.25) * ts * est.ancho, cy = oy + ts * est.alto * (0.12 + 0.19 * i);
        ctx.beginPath(); ctx.ellipse(cx, cy, ts * (4 + i), ts * (0.8 + 0.25 * i), 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "rgba(240,232,205,.3)";
      for (let i = 0; i < 12; i++) {
        const x = ox + ((hash(i, 1, 5) + t / 70000 * (0.4 + hash(i, 2, 5))) % 1) * ts * est.ancho;
        const y = oy + ((((hash(i, 3, 5) - t / 55000 * (0.5 + hash(i, 4, 5))) % 1) + 1) % 1) * ts * est.alto;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    }

    /* Fronteras de región: un trazo del color de quien manda (o gris si nadie) */
    function dibujarRegiones(vis) {
      ctx.lineWidth = Math.max(2, ts / 14);
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
        const r = est.casillas[y][x].region;
        if (vis[y * est.ancho + x] === 0) continue;
        [[1, 0], [0, 1]].forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (nx >= est.ancho || ny >= est.alto) return;
          if (est.casillas[ny][nx].region === r) return;
          const rg = est.regiones[r];
          ctx.strokeStyle = rg.dueno === null ? "rgba(235,225,205,.38)" : bandos[rg.dueno].col;
          ctx.globalAlpha = rg.dueno === null ? 1 : 0.8;
          ctx.beginPath();
          if (dx) { ctx.moveTo(px(nx), py(y)); ctx.lineTo(px(nx), py(y + 1)); } else { ctx.moveTo(px(x), py(ny)); ctx.lineTo(px(x + 1), py(ny)); }
          ctx.stroke(); ctx.globalAlpha = 1;
        });
      }
    }

    /* =====================================================================
       Unidades: estado visual (posición, vida mostrada, animación) y dibujo
    ===================================================================== */
    function instantanea() {
      const m = new Map();
      if (!est) return m;
      Object.values(est.unidades).forEach(u => m.set(u.uid, {
        uid: u.uid, clase: u.clase, dueno: u.dueno, x: u.x, y: u.y, hp: u.hp, hpMax: window.FracturaMotor.ef(est, u).hpMax, lider: !!u.lider,
        cap: !!(u.s && u.s.capitan), rango: u.s ? window.FracturaSoldados.rangoIndice(u.s.victorias + (u.vicG || 0)) : 0, luto: !!(u.s && u.s.luto)
      }));
      return m;
    }

    function datosUnidad(u) {
      return {
        uid: u.uid, clase: u.clase, dueno: u.dueno, x: u.x, y: u.y, hp: u.hp, hpMax: window.FracturaMotor.ef(est, u).hpMax, lider: !!u.lider,
        cap: !!(u.s && u.s.capitan), rango: u.s ? window.FracturaSoldados.rangoIndice(u.s.victorias + (u.vicG || 0)) : 0, luto: !!(u.s && u.s.luto)
      };
    }

    /* Anima una unidad dibujándola con la pose que le toca en este instante */
    function dibujarUnidad(d, v, t, seleccionada) {
      const a = v || {};
      const X = a.x !== undefined ? a.x : d.x, Y = a.y !== undefined ? a.y : d.y;
      const cx = px(X) + ts / 2 + (a.dx || 0) * ts, cy = py(Y) + ts * 0.86 + (a.dy || 0) * ts;
      const fase = (a.fase !== undefined ? a.fase : 0);
      const idle = REDUCIDO ? 0 : Math.sin(t / 420 + d.uid.length * 1.7 + (d.x * 3 + d.y)) * ts * 0.012;
      const vivoSel = seleccionada && !REDUCIDO ? Math.abs(Math.sin(t / 260)) * ts * 0.035 : 0;
      const hp = a.hp !== undefined ? a.hp : d.hp;
      const bando = d.dueno >= 0 ? bandos[d.dueno] : { col: "#8c8c8c", ban: "#444" };
      const dir = a.dir || (d.dueno === 0 ? 1 : -1);
      figura(ctx, d.clase === "lider" ? "lider" : d.clase, bando, {
        x: cx, y: cy, s: ts * 0.95, dir, mov: !!a.mov, fase, sw: a.sw || 0, flash: a.flash || 0, bob: -(idle + vivoSel + (a.mov ? Math.abs(Math.sin(fase * 2)) * 1.6 : 0)) / (ts / 40) * 1,
        t: t / 1000, cap: d.cap, rango: d.rango, herido: hp <= d.hpMax * 0.45, luto: d.luto, alfa: a.alfa, rot: a.rot
      });
      // Vida
      if (a.alfa === undefined || a.alfa > 0.4) {
        const w = ts * 0.62, f = Math.max(0, Math.min(1, hp / d.hpMax));
        const by = cy + ts * 0.08, bh = Math.max(4, ts * 0.075);
        ctx.fillStyle = "rgba(6,4,8,.92)"; ctx.fillRect(cx - w / 2 - 1, by - 1, w + 2, bh + 2);
        const gv = ctx.createLinearGradient(0, by, 0, by + bh); const cv = f > 0.5 ? ["#9fe08a", "#3f8a34"] : f > 0.25 ? ["#f0cf6a", "#a8801e"] : ["#f07a6a", "#8a1f18"];
        gv.addColorStop(0, cv[0]); gv.addColorStop(1, cv[1]);
        ctx.fillStyle = gv; ctx.fillRect(cx - w / 2, by, w * f, bh);
        ctx.strokeStyle = "rgba(197,160,89,.55)"; ctx.lineWidth = 1; ctx.strokeRect(cx - w / 2 - 0.5, by - 0.5, w + 1, bh + 1);
      }
      if (d.dueno === est.activo && est.jugadores[d.dueno].humano) {
        const u = est.unidades[d.uid];
        if (u && u.pm <= 0 && u.atacado && !anim) { ctx.fillStyle = "rgba(10,8,16,.35)"; ctx.fillRect(cx - ts * 0.3, cy - ts * 0.85, ts * 0.6, ts * 0.95); }
      }
    }

    /* =====================================================================
       Reproducción de eventos
    ===================================================================== */
    const ease = x => x * x * (3 - 2 * x);
    const lerp = (a, b, t) => a + (b - a) * t;

    function construir(evs, previo, rapidez) {
      const items = [];
      let cursor = 0;
      const escala = rapidez || 1;
      const add = (tipo, dur, datos) => { items.push(Object.assign({ tipo, ini: cursor, dur: dur * escala, hecho: false }, datos)); cursor += dur * escala; };
      evs.forEach(e => {
        if (e.k === "mov") {
          const pasos = Math.max(1, (e.ruta || [e.de, e.a]).length - 1);
          add("mov", Math.min(900, 140 * pasos + 120), { uid: e.uid, ruta: e.ruta && e.ruta.length > 1 ? e.ruta : [e.de, e.a] });
        } else if (e.k === "golpe") {
          const lejos = e.dist > 1.5;
          add("golpe", lejos ? 480 : 420, { de: e.de, a: e.a, x: e.x, y: e.y, dmg: e.dmg, lejos });
        } else if (e.k === "muerte") add("muerte", 450, { uid: e.uid, x: e.x, y: e.y });
        else if (e.k === "nuevo") add("nuevo", 260, { uid: e.uid, x: e.x, y: e.y });
        else if (e.k === "captura") add("captura", 300, { x: e.x, y: e.y, dueno: e.dueno });
      });
      return { items, total: cursor };
    }

    function reproducir(evs, antesSnap, opciones) {
      opciones = opciones || {};
      if (!evs || !evs.length || REDUCIDO) { if (opciones.alTerminar) opciones.alTerminar(); return; }
      if (!anim) {
        const base = antesSnap || instantanea();
        const vis = new Map();
        // Quienes ya estaban se dibujan donde estaban; quienes aparecen se esconden hasta su evento
        base.forEach((d, uid) => vis.set(uid, { d, x: d.x, y: d.y, hp: d.hp, alfa: 1, dir: d.dueno === 0 ? 1 : -1 }));
        Object.values(est.unidades).forEach(u => { if (!vis.has(u.uid)) vis.set(u.uid, { d: datosUnidad(u), x: u.x, y: u.y, hp: u.hp, alfa: 0, oculto: true, dir: u.dueno === 0 ? 1 : -1 }); });
        anim = { vis, items: [], total: 0, t0: performance.now(), rapido: 1, alTerminar: [] };
      }
      const resto = anim.total - (performance.now() - anim.t0);
      const pulso = construir(evs, null, opciones.rapidez);
      pulso.items.forEach(i => { i.ini += Math.max(anim.total, 0); anim.items.push(i); });
      anim.total += pulso.total;
      // Tope: una reproducción larga se acelera para no cansar
      const tope = opciones.tope || 5200;
      if (anim.total > tope) { const f = tope / anim.total; anim.items.forEach(i => { i.ini *= f; i.dur *= f; }); anim.total = tope; }
      void resto;
      if (opciones.alTerminar) anim.alTerminar.push(opciones.alTerminar);
      pedir();
    }

    function saltar() { if (anim) { anim.t0 -= 1e6; } }

    function terminarAnim() {
      const cbs = anim ? anim.alTerminar : [];
      anim = null;
      cbs.forEach(f => { try { f(); } catch (e) { /* la animación nunca debe romper el juego */ } });
    }

    function paso(ahora) {
      if (!anim) return;
      const t = ahora - anim.t0;
      if (t > anim.total + 400 || t > 15000) { terminarAnim(); return; }
      anim.vis.forEach(v => { v.mov = false; v.sw = 0; v.flash = 0; v.dx = 0; v.dy = 0; });
      anim.items.forEach(it => {
        const lt = t - it.ini;
        if (lt < 0) return;
        const p = Math.min(1, lt / Math.max(1, it.dur));
        if (it.tipo === "mov") {
          const v = anim.vis.get(it.uid); if (!v) return;
          const r = it.ruta, tramos = r.length - 1;
          const q = ease(p) * tramos, i = Math.min(tramos - 1, Math.floor(q)), f = q - i;
          v.x = lerp(r[i].x, r[i + 1].x, f); v.y = lerp(r[i].y, r[i + 1].y, f);
          const ddx = r[i + 1].x - r[i].x;
          if (ddx) v.dir = ddx > 0 ? 1 : -1;
          v.mov = p < 1; v.fase = (t / 90) % 6.283;
          if (p >= 1 && !it.hecho) { it.hecho = true; v.x = r[tramos].x; v.y = r[tramos].y; if (!it.polvo) { it.polvo = true; polvo(r[tramos].x, r[tramos].y); } }
        } else if (it.tipo === "golpe") {
          const v = anim.vis.get(it.de), o = anim.vis.get(it.a);
          if (v) {
            const dx = it.x - v.x, dy = it.y - v.y, L = Math.hypot(dx, dy) || 1;
            if (it.lejos) { v.sw = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55; v.dx = -(dx / L) * 0.05 * Math.sin(p * 3.14); }
            else {
              const avance = p < 0.3 ? -0.12 * (p / 0.3) : p < 0.5 ? lerp(-0.12, 0.34, (p - 0.3) / 0.2) : lerp(0.34, 0, (p - 0.5) / 0.5);
              v.dx = (dx / L) * avance; v.dy = (dy / L) * avance;
              v.sw = p < 0.3 ? p / 0.3 * -0.5 + 0 : p < 0.5 ? lerp(-0.5, 1, (p - 0.3) / 0.2) : lerp(1, 0, (p - 0.5) / 0.5);
            }
            if (dx) v.dir = dx > 0 ? 1 : -1;
          }
          const impacto = it.lejos ? 0.5 : 0.5;
          if (p >= impacto && !it.hecho) {
            it.hecho = true;
            if (o) { o.hp = Math.max(0, o.hp - it.dmg); }
            texto(it.x, it.y, `-${it.dmg}`, "#ffd0c8");
            chispas(it.x, it.y);
            if (it.lejos && v) proyectil(v.x, v.y, it.x, it.y);
          }
          if (o && p >= impacto && p < impacto + 0.4) {
            const k = (p - impacto) / 0.4, dxo = it.x - (v ? v.x : it.x), dyo = it.y - (v ? v.y : it.y), L = Math.hypot(dxo, dyo) || 1;
            o.flash = 1 - k; o.dx = (dxo / L) * 0.1 * Math.sin(k * 3.14); o.dy = (dyo / L) * 0.1 * Math.sin(k * 3.14);
          }
        } else if (it.tipo === "muerte") {
          const v = anim.vis.get(it.uid); if (!v) return;
          v.alfa = 1 - p; v.rot = p * 1.35 * v.dir; v.dy = p * 0.12; v.flash = Math.max(0, 0.6 - p);
          if (p >= 1 && !it.hecho) { it.hecho = true; texto(it.x, it.y, "✝", "#ffffff"); }
        } else if (it.tipo === "nuevo") {
          const v = anim.vis.get(it.uid); if (!v) return;
          v.oculto = false; v.alfa = ease(p); v.dy = (1 - p) * -0.15;
        } else if (it.tipo === "captura") {
          if (!it.hecho && p > 0.2) { it.hecho = true; onda(it.x, it.y, bandos[it.dueno] ? bandos[it.dueno].col : "#fff"); }
        }
      });
    }

    /* --- Efectos planos (sin resplandores) --- */
    function texto(x, y, t, color) { efectos.push({ k: "texto", x, y, t, color, t0: performance.now(), dur: 900 }); }
    function chispas(x, y) { efectos.push({ k: "chispa", x, y, t0: performance.now(), dur: 260 }); }
    function polvo(x, y) { for (let i = 0; i < 4; i++) efectos.push({ k: "polvo", x, y, a: (i - 1.5) * 0.5, t0: performance.now(), dur: 420 }); }
    function onda(x, y, color) { efectos.push({ k: "onda", x, y, color, t0: performance.now(), dur: 700 }); }
    function proyectil(x1, y1, x2, y2) { efectos.push({ k: "proy", x1, y1, x2, y2, t0: performance.now(), dur: 200 }); }

    function dibujarEfectos(ahora) {
      const H = est.humano >= 0 ? est.humano : 0, vis = est.vision[H];
      for (let i = efectos.length - 1; i >= 0; i--) {
        const e = efectos[i], p = (ahora - e.t0) / e.dur;
        if (p >= 1) { efectos.splice(i, 1); continue; }
        // Lo que pasa en la niebla no se ve
        const ex = Math.round(e.x !== undefined ? e.x : e.x1), ey = Math.round(e.y !== undefined ? e.y : e.y1);
        if (ex < 0 || ey < 0 || ex >= est.ancho || ey >= est.alto || vis[ey * est.ancho + ex] !== 2) continue;
        const c = centro(e.x, e.y);
        if (e.k === "texto") {
          ctx.globalAlpha = 1 - p * p; ctx.fillStyle = "#050304"; ctx.font = `bold ${Math.round(ts * 0.46)}px Cinzel, serif`; ctx.textAlign = "center";
          ctx.fillText(e.t, c.x + 1, c.y - ts * 0.15 - p * ts * 0.6 + 1);
          ctx.fillStyle = e.color; ctx.fillText(e.t, c.x, c.y - ts * 0.15 - p * ts * 0.6); ctx.globalAlpha = 1;
        } else if (e.k === "chispa") {
          ctx.strokeStyle = "#fff4c4"; ctx.lineWidth = 2; ctx.globalAlpha = 1 - p;
          for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.3, r1 = ts * (0.08 + p * 0.1), r2 = ts * (0.2 + p * 0.3); ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1); ctx.lineTo(c.x + Math.cos(a) * r2, c.y + Math.sin(a) * r2); ctx.stroke(); }
          ctx.globalAlpha = 1;
        } else if (e.k === "polvo") {
          ctx.globalAlpha = 0.5 * (1 - p); ctx.fillStyle = "#d8cfbd";
          ctx.beginPath(); ctx.arc(c.x + e.a * ts * 0.35 * (0.4 + p), c.y + ts * 0.32 - p * ts * 0.12, ts * (0.05 + p * 0.07), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        } else if (e.k === "onda") {
          ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(2, ts / 12) * (1 - p); ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc(c.x, c.y, ts * (0.3 + p * 1.6), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        } else if (e.k === "proy") {
          const a = centro(e.x1, e.y1), b = centro(e.x2, e.y2), q = p;
          ctx.strokeStyle = "#f4eed8"; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(lerp(a.x, b.x, Math.max(0, q - 0.25)), lerp(a.y, b.y, Math.max(0, q - 0.25)) - ts * 0.3); ctx.lineTo(lerp(a.x, b.x, q), lerp(a.y, b.y, q) - ts * 0.3); ctx.stroke();
        }
      }
    }

    /* =====================================================================
       Dibujo del cuadro completo
    ===================================================================== */
    function dibujar(ahora) {
      ctx.clearRect(0, 0, ancho, alto);
      const fondo = ctx.createRadialGradient(ancho / 2, alto * 0.45, 40, ancho / 2, alto / 2, Math.max(ancho, alto) * 0.75);
      fondo.addColorStop(0, "#1a1218"); fondo.addColorStop(0.6, "#0d0a0d"); fondo.addColorStop(1, "#050304");
      ctx.fillStyle = fondo; ctx.fillRect(0, 0, ancho, alto);
      if (!est) return;
      if (!bandos) bandos = coloresBando(est);
      paso(ahora);
      const t = ahora;
      const H = est.humano >= 0 ? est.humano : 0;
      const vis = est.vision[H];
      // Marco del mapa
      ctx.fillStyle = "#050406"; ctx.fillRect(ox - 9, oy - 9, ts * est.ancho + 18, ts * est.alto + 18);
      ctx.strokeStyle = "rgba(197,160,89,.55)"; ctx.lineWidth = 1.5; ctx.strokeRect(ox - 6.5, oy - 6.5, ts * est.ancho + 13, ts * est.alto + 13);
      ctx.strokeStyle = "rgba(197,160,89,.2)"; ctx.lineWidth = 1; ctx.strokeRect(ox - 3.5, oy - 3.5, ts * est.ancho + 7, ts * est.alto + 7);
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
        const v = vis[y * est.ancho + x];
        const c = est.casillas[y][x];
        dibujarTerreno(c, x, y, v, t);
        if (v > 0) dibujarEstructura(c, x, y, t);
        if (v === 1) { ctx.fillStyle = "rgba(6,5,10,.64)"; ctx.fillRect(px(x), py(y), ts, ts); }
      }
      dibujarRegiones(vis);
      ambiente(t);
      vineta();
      // Resaltes de movimiento (no mientras se reproduce una animación)
      if (!anim) estado.mover.forEach((n, k) => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(90,200,120,.17)"; ctx.fillRect(px(x), py(y), ts, ts); esquinas(x, y, "rgba(150,240,170,.95)", Math.max(1.6, ts / 26), 0.3, 2); });
      estado.objetivosHab.forEach(k => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(150,120,255,.28)"; ctx.fillRect(px(x), py(y), ts, ts); esquinas(x, y, "#c9b6ff", Math.max(1.6, ts / 26), 0.3, 2); });
      // Ruta preliminar
      if (estado.ruta && estado.ruta.length > 1) {
        ctx.strokeStyle = "#f2ecd8"; ctx.lineWidth = Math.max(2, ts / 12); ctx.setLineDash([ts * 0.12, ts * 0.12]); ctx.lineDashOffset = REDUCIDO ? 0 : -t / 60;
        ctx.beginPath(); estado.ruta.forEach((p, i) => { const c = centro(p.x, p.y); if (i) ctx.lineTo(c.x, c.y); else ctx.moveTo(c.x, c.y); }); ctx.stroke(); ctx.setLineDash([]);
        const f = estado.ruta[estado.ruta.length - 1], cf = centro(f.x, f.y);
        ctx.fillStyle = "#f2ecd8"; ctx.beginPath(); ctx.arc(cf.x, cf.y, ts * 0.12, 0, 7); ctx.fill();
      }
      // Unidades: se ordenan por fila para que las de abajo tapen a las de arriba
      const lista = [];
      if (anim) {
        anim.vis.forEach((v, uid) => {
          if (v.oculto || v.alfa === 0 && !est.unidades[uid]) return;
          const logica = est.unidades[uid];
          const d = v.d || (logica ? datosUnidad(logica) : null);
          if (!d) return;
          lista.push({ d, v, y: v.y + (v.dy || 0) });
        });
      } else {
        Object.values(est.unidades).forEach(u => lista.push({ d: datosUnidad(u), v: null, y: u.y }));
      }
      lista.sort((a, b) => a.y - b.y).forEach(it => {
        const tx = it.v ? Math.round(it.v.x) : it.d.x, ty = it.v ? Math.round(it.v.y) : it.d.y;
        const visible = it.d.dueno === H || (ty >= 0 && ty < est.alto && tx >= 0 && tx < est.ancho && vis[ty * est.ancho + tx] === 2);
        if (!visible) return;
        dibujarUnidad(it.d, it.v, t, estado.sel === it.d.uid);
      });
      if (!anim) estado.atacar.forEach(k => { const [x, y] = k.split(",").map(Number); const m = REDUCIDO ? 0 : Math.sin(t / 220) * 0.5 + 0.5; ctx.fillStyle = `rgba(200,50,40,${0.12 + m * 0.12})`; ctx.fillRect(px(x), py(y), ts, ts); esquinas(x, y, "#ff6b5e", Math.max(2, ts / 20), 0.34, 2 - m * 1.5); });
      if (estado.previaAtq) { const p = estado.previaAtq; esquinas(p.x, p.y, "#ffe3a0", Math.max(2, ts / 20), 0.34, 3); }
      if (estado.sel && est.unidades[estado.sel] && !anim) { const u = est.unidades[estado.sel]; ctx.fillStyle = "rgba(240,200,90,.1)"; ctx.fillRect(px(u.x), py(u.y), ts, ts); esquinas(u.x, u.y, "#f2cf6a", Math.max(2, ts / 18), 0.36, 1.5); }
      if (estado.casilla) { esquinas(estado.casilla.x, estado.casilla.y, "#f2cf6a", Math.max(1.5, ts / 24), 0.3, 2); }
      if (estado.ciudad && est.ciudades[estado.ciudad]) { const c = est.ciudades[estado.ciudad]; esquinas(c.x, c.y, "#f2cf6a", Math.max(2, ts / 18), 0.36, 1.5); }
      if (estado.hover && !anim) { esquinas(estado.hover.x, estado.hover.y, "rgba(255,244,214,.6)", Math.max(1.4, ts / 28), 0.24, 1); }
      dibujarEfectos(ahora);
    }

    /* --- Entrada --- */
    canvas.addEventListener("click", ev => {
      if (!est) return;
      const c = celdaDe(ev);
      if (anim) { saltar(); return; }
      if (c.dentro) hooks.alTocar(c.x, c.y, ev.pointerType === "touch" || (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents));
    });
    let tocoReciente = 0;
    canvas.addEventListener("touchstart", () => { tocoReciente = Date.now(); }, { passive: true });
    canvas.addEventListener("mousemove", ev => {
      if (!est || Date.now() - tocoReciente < 800) return;
      const c = celdaDe(ev);
      const nuevo = c.dentro ? { x: c.x, y: c.y } : null;
      if (!estado.hover !== !nuevo || (nuevo && estado.hover && (nuevo.x !== estado.hover.x || nuevo.y !== estado.hover.y))) {
        estado.hover = nuevo;
        if (hooks.alPasar) hooks.alPasar(nuevo ? nuevo.x : -1, nuevo ? nuevo.y : -1);
        pedir();
      }
    });
    canvas.addEventListener("mouseleave", () => { estado.hover = null; if (hooks.alPasar) hooks.alPasar(-1, -1); pedir(); });
    document.addEventListener("keydown", ev => { if (anim && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) { saltar(); } });

    return {
      poner(nuevo) { est = nuevo; bandos = null; medir(); },
      estado(e) { estado = Object.assign({ sel: null, mover: new Map(), atacar: new Set(), ciudad: null, casilla: null, objetivosHab: new Set(), ruta: null, hover: estado.hover, previaAtq: null }, e); pedir(); },
      redibujar: pedir,
      instantanea, reproducir, saltar,
      ocupado: () => !!anim,
      alTerminar(f) { if (anim) anim.alTerminar.push(f); else f(); },
      efecto: texto, onda,
      reservar(r) { reserva = Object.assign(reserva, r); medir(); },
      pantallaDe(x, y) { const r = canvas.getBoundingClientRect(); return { x: r.left + px(x) + ts / 2, y: r.top + py(y), ts }; },
      ajustar: medir
    };
  }

  /* Retrato de un soldado: su figura en grande sobre un fondo liso del color de su facción */
  function retrato(canvas, cl, bando, o) {
    o = o || {};
    const w = o.w || 96, h = o.h || 112, d = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const c = canvas.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = oscuro(bando.col, 0.74); c.fillRect(0, 0, w, h);
    c.fillStyle = oscuro(bando.col, 0.58); c.fillRect(0, h * 0.86, w, h * 0.14);
    const k = cl === "lider" ? 0.6 : cl === "paladin" || cl === "caballero" ? 0.68 : cl === "arcanista" || cl === "archimago" ? 0.66 : 0.72;
    figura(c, cl, bando, { x: w / 2 + 4, y: h * 0.93, s: h * k, dir: 1, mov: false, fase: 0, sw: 0, cap: o.cap, rango: o.rango || 0, herido: o.herido, luto: o.luto, t: 0 });
  }
  const colorFaccion = id => { const f = FACCIONES[id]; return { col: f.color, ban: f.bandera }; };

  return { crear, figura, coloresBando, retrato, colorFaccion };
})();
