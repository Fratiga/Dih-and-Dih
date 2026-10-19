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
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
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
  const PIEL = "#e2b98f", ACERO = "#b9c0c8", MADERA = "#7a5632", HUESO = "#e9e2cf";

  function F(K, c) { return K.flash > 0 ? mezcla(c.startsWith("#") ? c : "#888888", "#ffffff", Math.min(1, K.flash)) : c; }
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

  function piernas(c, K, colorPierna) {
    const p = K.mov ? Math.sin(K.fase) * 5 : 0, lev = K.mov ? Math.max(0, Math.cos(K.fase)) * 2 : 0, lev2 = K.mov ? Math.max(0, -Math.cos(K.fase)) * 2 : 0;
    trazo(c, K, colorPierna, 3.6, -2.5, -13, -2.5 - p * 0.6, -1 - lev);
    trazo(c, K, colorPierna, 3.6, 2.5, -13, 2.5 + p * 0.6, -1 - lev2);
  }
  function torso(c, K, color, ancho, alto, y0) {
    const w = ancho / 2;
    poli(c, K, color, [[-w, y0], [w, y0], [w * 0.8, y0 - alto], [-w * 0.8, y0 - alto]]);
  }
  function cabeza(c, K, y, r, piel) { disco(c, K, piel || PIEL, 0, y, r || 4.6); }
  /* Brazo con arma: el ángulo sw (-1 recogido, 0 reposo, 1 golpe) mueve la mano */
  function manoArma(K, hombro, largo) {
    const ang = -0.5 + K.sw * 1.7 + (K.mov ? Math.sin(K.fase) * 0.25 : 0);
    return { x: hombro.x + Math.cos(ang) * largo, y: hombro.y + Math.sin(ang) * largo, ang };
  }

  const FIG = {
    guerrero(c, K) {
      piernas(c, K, K.dark);
      torso(c, K, K.col, 12, 12, -13);
      trazo(c, K, K.ban, 2, -6, -14, 6, -14);
      const h = manoArma(K, { x: 5, y: -24 }, 8);
      // escudo redondo atrás, espada delante
      disco(c, K, oscuro(K.col, 0.35), -6, -20, 6.2); disco(c, K, K.ban, -6, -20, 2.2);
      trazo(c, K, PIEL, 3, 5, -24, h.x, h.y);
      trazo(c, K, ACERO, 2.6, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 13, h.y + Math.sin(h.ang - 0.1) * 13);
      trazo(c, K, MADERA, 3, h.x - Math.cos(h.ang) * 2, h.y - Math.sin(h.ang) * 2, h.x + Math.cos(h.ang) * 1, h.y + Math.sin(h.ang));
      cabeza(c, K, -30, 4.8);
      poli(c, K, ACERO, [[-5, -31], [5, -31], [4, -36], [-4, -36]]);
      trazo(c, K, ACERO, 1.6, 3, -31, 3, -28);
    },
    cazador(c, K) {
      piernas(c, K, oscuro(K.col, 0.4));
      torso(c, K, oscuro(K.col, 0.25), 10, 12, -13);
      trazo(c, K, MADERA, 3, -5, -27, -2, -18);   // carcaj
      trazo(c, K, "#d8c9a6", 1.4, -6, -28, -5, -31);
      cabeza(c, K, -30, 4.4);
      poli(c, K, K.col, [[-5.5, -29], [0, -38], [5.5, -29], [3, -27], [-3, -27]]);
      // arco: se tensa al atacar
      const t = K.sw;
      c.strokeStyle = F(K, MADERA); c.lineWidth = 2.4; c.beginPath(); c.arc(9, -22, 9, -1.15 - t * 0.1, 1.15 + t * 0.1); c.stroke();
      trazo(c, K, "#e8e2d0", 0.9, 9 + Math.cos(1.15) * 9, -22 - Math.sin(1.15) * 9, 9 - t * 5, -22);
      trazo(c, K, "#e8e2d0", 0.9, 9 + Math.cos(1.15) * 9, -22 + Math.sin(1.15) * 9, 9 - t * 5, -22);
      trazo(c, K, PIEL, 2.8, 4, -23, 9 - t * 5, -22);
      if (t > 0.3 && t < 0.9) trazo(c, K, "#d8c9a6", 1.4, 9 - t * 5, -22, 19, -22);
    },
    arcanista(c, K) {
      poli(c, K, K.col, [[-5, -14], [5, -14], [8, 0], [-8, 0]]);                // túnica larga
      torso(c, K, K.col, 11, 12, -13);
      trazo(c, K, K.ban, 1.8, -5.5, -14, 5.5, -14);
      cabeza(c, K, -30, 4.4);
      poli(c, K, oscuro(K.col, 0.3), [[-6, -32], [6, -32], [1, -46]]);
      const h = manoArma(K, { x: 5, y: -24 }, 6);
      trazo(c, K, PIEL, 2.6, 5, -24, h.x, h.y);
      trazo(c, K, MADERA, 2.2, h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5 + 8, h.x + Math.cos(h.ang) * 2, h.y - 12 + K.sw * 2);
      disco(c, K, K.sw > 0.5 ? "#ffffff" : "#8fd8ff", h.x + Math.cos(h.ang) * 2, h.y - 14 + K.sw * 2, 3.6);
    },
    paladin(c, K) {
      piernas(c, K, "#4c4d56");
      torso(c, K, ACERO, 14, 13, -13);
      trazo(c, K, K.col, 3, -6, -22, 6, -22);
      cabeza(c, K, -31, 4.8);
      poli(c, K, ACERO, [[-5.5, -31], [5.5, -31], [5, -37], [-5, -37]]);
      poli(c, K, "#c0463c", [[-1, -37], [1, -37], [3, -43], [-3, -41]]);
      // escudo grande con cruz
      poli(c, K, K.col, [[-12, -27], [-3, -27], [-3, -11], [-7.5, -7], [-12, -11]]);
      trazo(c, K, K.ban, 1.8, -7.5, -25, -7.5, -11); trazo(c, K, K.ban, 1.8, -11, -20, -4, -20);
      const h = manoArma(K, { x: 6, y: -23 }, 7);
      trazo(c, K, PIEL, 3, 6, -23, h.x, h.y);
      trazo(c, K, MADERA, 2.6, h.x, h.y, h.x + Math.cos(h.ang) * 9, h.y + Math.sin(h.ang) * 9);
      disco(c, K, "#8a8f98", h.x + Math.cos(h.ang) * 10, h.y + Math.sin(h.ang) * 10, 3.4);
    },
    picaro(c, K) {
      K.y = (K.y || 0) + 1.5;
      piernas(c, K, "#2d2733");
      torso(c, K, "#3a3342", 10, 12, -13);
      trazo(c, K, K.col, 2, -5, -14, 5, -14);
      poli(c, K, K.col, [[-5, -28], [0, -35], [5, -28], [4, -25], [-4, -25]]);
      cabeza(c, K, -30, 4.2);
      trazo(c, K, "#2d2733", 2.6, -3.5, -29, 3.5, -29);
      const h = manoArma(K, { x: 4, y: -23 }, 6);
      trazo(c, K, PIEL, 2.4, 4, -23, h.x, h.y);
      trazo(c, K, ACERO, 2, h.x, h.y, h.x + Math.cos(h.ang) * 8, h.y + Math.sin(h.ang) * 8);
      trazo(c, K, PIEL, 2.4, -4, -23, -8, -18);
      trazo(c, K, ACERO, 2, -8, -18, -11, -22);
    },
    caballero(c, K) {
      piernas(c, K, "#4c4d56");
      torso(c, K, ACERO, 15, 14, -13);
      trazo(c, K, K.col, 3.2, -7, -21, 7, -21);
      cabeza(c, K, -32, 5);
      poli(c, K, ACERO, [[-6, -32], [6, -32], [5.5, -39], [-5.5, -39]]);
      poli(c, K, K.col, [[-1.5, -39], [1.5, -39], [4, -46], [-4, -44]]);
      poli(c, K, K.col, [[-12, -28], [-4, -28], [-4, -14], [-8, -9], [-12, -14]]);
      const h = manoArma(K, { x: 7, y: -22 }, 6);
      trazo(c, K, PIEL, 3, 7, -22, h.x, h.y);
      const lx = h.x + Math.cos(h.ang) * 20, ly = h.y + Math.sin(h.ang) * 20;
      trazo(c, K, MADERA, 2.2, h.x - Math.cos(h.ang) * 6, h.y - Math.sin(h.ang) * 6, lx, ly);
      poli(c, K, K.ban, [[lx, ly], [lx - 6, ly - 3], [lx - 5, ly + 2]]);
    },
    esqueleto(c, K) {
      K.hueso = true;
      piernas(c, K, HUESO);
      c.fillStyle = F(K, HUESO); c.fillRect(-4, -26, 8, 12);
      for (let i = 0; i < 3; i++) trazo(c, K, "#4a4438", 1, -4, -24 + i * 3.4, 4, -24 + i * 3.4);
      poli(c, K, K.col, [[-5, -14], [5, -14], [3, -9], [-3, -8]]);
      disco(c, K, HUESO, 0, -30, 5);
      disco(c, K, "#231e2a", -1.8, -30.5, 1.3); disco(c, K, "#231e2a", 2, -30.5, 1.3);
      c.fillStyle = F(K, "#231e2a"); c.fillRect(-1.5, -27.2, 3, 1.3);
      const h = manoArma(K, { x: 4, y: -23 }, 7);
      trazo(c, K, HUESO, 2, 4, -23, h.x, h.y);
      trazo(c, K, "#8a6a52", 2.4, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 12, h.y + Math.sin(h.ang - 0.1) * 12);
    },
    archimago(c, K) {
      poli(c, K, K.col, [[-5, -14], [5, -14], [9, 0], [-9, 0]]);
      torso(c, K, claro(K.col, 0.12), 12, 12, -13);
      poli(c, K, K.ban, [[-6, -22], [6, -22], [7, -16], [-7, -16]]);
      cabeza(c, K, -30, 4.4);
      poli(c, K, oscuro(K.col, 0.4), [[-7, -32], [7, -32], [2, -50], [-1, -48]]);
      const h = manoArma(K, { x: 5, y: -24 }, 6);
      trazo(c, K, PIEL, 2.6, 5, -24, h.x, h.y);
      trazo(c, K, MADERA, 2.2, h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5 + 9, h.x + Math.cos(h.ang) * 2, h.y - 14 + K.sw * 2);
      poli(c, K, K.sw > 0.5 ? "#ffffff" : "#e6c6ff", [[h.x + Math.cos(h.ang) * 2, h.y - 21 + K.sw * 2], [h.x + 4 + Math.cos(h.ang) * 2, h.y - 15 + K.sw * 2], [h.x + Math.cos(h.ang) * 2, h.y - 9 + K.sw * 2], [h.x - 4 + Math.cos(h.ang) * 2, h.y - 15 + K.sw * 2]]);
    },
    ballestero(c, K) {
      piernas(c, K, K.dark);
      torso(c, K, K.col, 12, 12, -13);
      trazo(c, K, K.ban, 2, -6, -14, 6, -14);
      cabeza(c, K, -30, 4.6);
      poli(c, K, ACERO, [[-5.5, -30], [5.5, -30], [4, -37], [-4, -37]]);
      const r = -K.sw * 4;
      trazo(c, K, MADERA, 3, 2 + r, -21, 15 + r, -22);
      c.strokeStyle = F(K, ACERO); c.lineWidth = 2; c.beginPath(); c.moveTo(10 + r, -27); c.lineTo(12 + r, -22); c.lineTo(10 + r, -17); c.stroke();
      trazo(c, K, PIEL, 2.6, 4, -23, 9 + r, -21.5);
      if (K.sw < 0.4) trazo(c, K, "#d8c9a6", 1.4, 6 + r, -22, 16 + r, -22);
    },
    mercenario(c, K) {
      piernas(c, K, K.dark);
      torso(c, K, "#6a5a46", 12, 12, -13);
      trazo(c, K, "#c0463c", 2.6, -6, -15, 6, -13);
      cabeza(c, K, -30, 4.7);
      trazo(c, K, "#222", 1.4, -3.5, -31.5, 3.5, -29);
      disco(c, K, "#222", 1.8, -30, 1.4);
      poli(c, K, K.col, [[-5, -33], [5, -33], [4.5, -35], [-4.5, -35]]);
      const h = manoArma(K, { x: 5, y: -24 }, 8);
      trazo(c, K, PIEL, 3, 5, -24, h.x, h.y);
      trazo(c, K, ACERO, 3, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 12, h.y + Math.sin(h.ang - 0.1) * 12);
    },
    sanador(c, K) {
      poli(c, K, claro(K.col, 0.35), [[-5, -14], [5, -14], [8, 0], [-8, 0]]);
      torso(c, K, claro(K.col, 0.35), 11, 12, -13);
      poli(c, K, K.ban, [[-1.2, -25], [1.2, -25], [1.2, -17], [-1.2, -17]]);
      poli(c, K, K.ban, [[-4, -22], [4, -22], [4, -20], [-4, -20]]);
      cabeza(c, K, -30, 4.4);
      poli(c, K, claro(K.col, 0.35), [[-6, -29], [0, -37], [6, -29], [3, -26], [-3, -26]]);
      trazo(c, K, MADERA, 2.2, 8, -3, 8, -34);
      disco(c, K, "#ffe9a6", 8, -37, 3);
    },
    lider(c, K) {
      poli(c, K, K.ban, [[-7, -28], [-1, -28], [-5, -4], [-12, -4]]);   // capa larga
      piernas(c, K, K.dark);
      torso(c, K, ACERO, 15, 14, -13);
      trazo(c, K, K.col, 3.4, -7, -22, 7, -22);
      cabeza(c, K, -32, 5.2);
      poli(c, K, "#f0cf6a", [[-5.5, -36], [5.5, -36], [6.5, -43], [3, -39.5], [0, -44], [-3, -39.5], [-6.5, -43]]);
      const h = manoArma(K, { x: 7, y: -24 }, 8);
      trazo(c, K, PIEL, 3.2, 7, -24, h.x, h.y);
      trazo(c, K, ACERO, 3, h.x, h.y, h.x + Math.cos(h.ang - 0.1) * 15, h.y + Math.sin(h.ang - 0.1) * 15);
      trazo(c, K, "#d8c28a", 1.4, -11, -30, -11, -52); poli(c, K, K.col, [[-11, -52], [-3, -49], [-11, -45]]);
    },
    eco(c, K) {
      const bob = Math.sin(K.t * 3) * 1.5;
      c.globalAlpha *= 0.8;
      c.fillStyle = F(K, K.col); c.beginPath(); c.moveTo(0, -36 + bob); c.quadraticCurveTo(10, -22, 6, -9); c.lineTo(0, -4 + bob); c.lineTo(-6, -9); c.quadraticCurveTo(-10, -22, 0, -36 + bob); c.fill();
      c.strokeStyle = F(K, "#e6c6ff"); c.lineWidth = 1.8; c.beginPath(); c.arc(0, -22 + bob, 9, 0, 7); c.stroke();
      disco(c, K, "#ffffff", -2, -26 + bob, 1.5); disco(c, K, "#ffffff", 2.6, -26 + bob, 1.5);
      c.globalAlpha /= 0.8;
    },
    salvaje(c, K) {
      const p = K.mov ? Math.sin(K.fase) * 3 : 0;
      c.fillStyle = F(K, "#5a4a52"); c.beginPath(); c.ellipse(0, -14, 12, 7, 0, 0, 7); c.fill();
      [[-8, -p], [-3, p], [3, -p], [8, p]].forEach(([x, d]) => trazo(c, K, "#3d3037", 3, x, -10, x + d * 0.5, -1));
      c.fillStyle = F(K, "#5a4a52"); c.beginPath(); c.ellipse(12, -19, 5.5, 4.5, 0.3, 0, 7); c.fill();
      trazo(c, K, "#d8d0c0", 2, 11, -23, 9, -29); trazo(c, K, "#d8d0c0", 2, 14, -23, 16, -29);
      disco(c, K, "#ffd36a", 13.5, -20, 1.1);
      trazo(c, K, "#3d3037", 2.4, -12, -16, -17, -20);
    }
  };

  /* Dibuja una figura entera. o: { x, y (en píxeles, pies), s (px por casilla), dir, ... } */
  function figura(c, cl, bando, o) {
    const s = o.s / 40 * (cl === "lider" ? 1.18 : cl === "paladin" || cl === "caballero" ? 1.06 : 1);
    const K = {
      cl, col: bando.col, dark: oscuro(bando.col, 0.55), ban: bando.ban, fase: o.fase || 0, mov: !!o.mov, sw: o.sw || 0, flash: o.flash || 0, t: o.t || 0, y: 0
    };
    c.save();
    c.translate(o.x, o.y);
    c.scale(s * (o.dir || 1), s);
    if (o.rot) { c.rotate(o.rot); }
    if (o.alfa !== undefined) c.globalAlpha = o.alfa;
    // sombra plana
    c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(0, 0, 11, 3.4, 0, 0, 7); c.fill();
    c.translate(0, o.bob || 0);
    // capa de veterano y estandarte de capitán, por detrás
    if (o.rango >= 2 && cl !== "lider" && cl !== "eco" && cl !== "salvaje") poli(c, K, oscuro(bando.col, 0.3), [[-3, -26], [-1, -26], [-6, -6], [-11, -9]]);
    if (o.cap) {
      trazo(c, K, "#d8c28a", 1.5, -8, -3, -8, -48);
      const on = Math.sin((o.t || 0) * 5) * 2;
      poli(c, K, bando.col, [[-8, -48], [2, -45 + on], [-8, -40]]);
    }
    (FIG[cl] || FIG.guerrero)(c, K);
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
       Terreno y estructuras
    ===================================================================== */
    function dibujarTerreno(c, x, y, v, t) {
      const X = px(x), Y = py(y);
      const base = TERRENOS[c.t].color;
      ctx.fillStyle = v === 0 ? "#171220" : base;
      ctx.fillRect(X, Y, ts, ts);
      if (v === 0) { ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1; ctx.strokeRect(X + .5, Y + .5, ts - 1, ts - 1); return; }
      const s = ts / 40, h = hash(x, y, 1), h2 = hash(x, y, 2);
      // mancha de variación: el mismo terreno no se ve idéntico en todas las casillas
      ctx.fillStyle = h < 0.5 ? claro(base, 0.06) : oscuro(base, 0.08);
      ctx.fillRect(X + (h2 * 14) * s, Y + (h * 16) * s, (14 + h * 8) * s, (12 + h2 * 8) * s);
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, ts, ts); ctx.clip();
      switch (c.t) {
        case "bosque": {
          const cant = 2 + Math.floor(h * 2);
          for (let i = 0; i < cant; i++) {
            const a = 8 + hash(x, y, 10 + i) * 24, b = 12 + hash(x, y, 20 + i) * 20, k = 0.8 + hash(x, y, 30 + i) * 0.5;
            ctx.fillStyle = "#6b4a2c"; ctx.fillRect(X + (a - 1) * s, Y + (b + 4) * s, 2 * s, 5 * s);
            ctx.fillStyle = i % 2 ? "#2e5a2a" : "#244a22";
            ctx.beginPath(); ctx.moveTo(X + a * s, Y + (b - 12 * k) * s); ctx.lineTo(X + (a + 6 * k) * s, Y + (b + 5) * s); ctx.lineTo(X + (a - 6 * k) * s, Y + (b + 5) * s); ctx.fill();
          }
          break;
        }
        case "montana": {
          ctx.fillStyle = "#5d554b"; ctx.beginPath(); ctx.moveTo(X + 4 * s, Y + 33 * s); ctx.lineTo(X + 20 * s, Y + 7 * s); ctx.lineTo(X + 36 * s, Y + 33 * s); ctx.fill();
          ctx.fillStyle = "#463f38"; ctx.beginPath(); ctx.moveTo(X + 20 * s, Y + 7 * s); ctx.lineTo(X + 36 * s, Y + 33 * s); ctx.lineTo(X + 24 * s, Y + 33 * s); ctx.fill();
          ctx.fillStyle = "#ece8df"; ctx.beginPath(); ctx.moveTo(X + 14 * s, Y + 17 * s); ctx.lineTo(X + 20 * s, Y + 7 * s); ctx.lineTo(X + 26 * s, Y + 17 * s); ctx.lineTo(X + 21 * s, Y + 15 * s); ctx.fill();
          break;
        }
        case "desierto": {
          ctx.fillStyle = "#b8975a";
          for (let i = 0; i < 4; i++) ctx.fillRect(X + (6 + hash(x, y, 40 + i) * 26) * s, Y + (8 + hash(x, y, 50 + i) * 24) * s, 3 * s, 2 * s);
          ctx.strokeStyle = "#cfae70"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X + 4 * s, Y + 30 * s); ctx.quadraticCurveTo(X + 20 * s, Y + 22 * s, X + 36 * s, Y + 30 * s); ctx.stroke();
          break;
        }
        case "agua": {
          ctx.strokeStyle = "#8db4de"; ctx.lineWidth = 2;
          [11, 21, 31].forEach((b, i) => {
            const fase = (t / 900 + i * 0.7 + h * 3) % 6.283, d = Math.sin(fase) * 3 * s;
            ctx.beginPath(); ctx.moveTo(X + 5 * s, Y + b * s); ctx.quadraticCurveTo(X + 12 * s, Y + b * s - 4 * s + d, X + 20 * s, Y + b * s); ctx.quadraticCurveTo(X + 28 * s, Y + b * s + 4 * s - d, X + 35 * s, Y + b * s); ctx.stroke();
          });
          break;
        }
        case "magica": {
          const flota = Math.sin(t / 700 + h * 6) * 2 * s;
          ctx.fillStyle = "#d3b4f5"; ctx.beginPath(); ctx.moveTo(X + 20 * s, Y + 8 * s + flota); ctx.lineTo(X + 27 * s, Y + 20 * s + flota); ctx.lineTo(X + 20 * s, Y + 32 * s + flota); ctx.lineTo(X + 13 * s, Y + 20 * s + flota); ctx.fill();
          ctx.fillStyle = "#f1e4ff"; ctx.beginPath(); ctx.moveTo(X + 20 * s, Y + 12 * s + flota); ctx.lineTo(X + 23 * s, Y + 20 * s + flota); ctx.lineTo(X + 20 * s, Y + 20 * s + flota); ctx.fill();
          break;
        }
        case "huesos": {
          ctx.strokeStyle = "#ece6d4"; ctx.lineWidth = 2;
          for (let i = 0; i < 2; i++) { const a = 8 + hash(x, y, 60 + i) * 18, b = 10 + hash(x, y, 70 + i) * 18; ctx.beginPath(); ctx.moveTo(X + a * s, Y + b * s); ctx.lineTo(X + (a + 8) * s, Y + (b + 8) * s); ctx.moveTo(X + (a + 8) * s, Y + b * s); ctx.lineTo(X + a * s, Y + (b + 8) * s); ctx.stroke(); }
          break;
        }
        case "llanura": {
          ctx.strokeStyle = "#9db05a"; ctx.lineWidth = 1.4;
          for (let i = 0; i < 4; i++) { const a = 5 + hash(x, y, 80 + i) * 30, b = 8 + hash(x, y, 90 + i) * 26; ctx.beginPath(); ctx.moveTo(X + a * s, Y + b * s); ctx.lineTo(X + (a - 1.5) * s, Y + (b - 4) * s); ctx.moveTo(X + a * s, Y + b * s); ctx.lineTo(X + (a + 1.5) * s, Y + (b - 3.5) * s); ctx.stroke(); }
          break;
        }
        default:
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 1; ctx.strokeRect(X + .5, Y + .5, ts - 1, ts - 1);
    }

    function bandera(X, Y, color, alto, t, fase) {
      ctx.strokeStyle = "#d8c28a"; ctx.lineWidth = Math.max(1.5, ts / 22);
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - alto); ctx.stroke();
      ctx.fillStyle = color;
      const w = alto * 0.7, h = alto * 0.42, on = REDUCIDO ? 0 : Math.sin(t / 220 + fase) * h * 0.12;
      ctx.beginPath(); ctx.moveTo(X, Y - alto); ctx.quadraticCurveTo(X + w * 0.5, Y - alto + on, X + w, Y - alto + h * 0.1 + on); ctx.lineTo(X + w * 0.78, Y - alto + h * 0.5); ctx.lineTo(X + w, Y - alto + h * 0.9 - on); ctx.quadraticCurveTo(X + w * 0.5, Y - alto + h * 0.8 - on, X, Y - alto + h); ctx.fill();
    }

    function dibujarEstructura(c, x, y, t) {
      if (!c.est && !(c.objetos && c.objetos.length)) return;
      const X = px(x), Y = py(y), s = ts / 40;
      if (c.est === "ciudad") {
        const ci = Object.values(est.ciudades).find(k => k.x === x && k.y === y);
        const dueno = ci ? ci.dueno : null;
        const col = dueno === null ? "#9a9a9a" : bandos[dueno].col, ban = dueno === null ? "#555" : bandos[dueno].ban;
        const casas = ci ? Math.min(4, 1 + Math.floor(ci.nivel / 2)) : 1;
        ctx.fillStyle = "#2a2430"; ctx.fillRect(X + 6 * s, Y + 20 * s, 28 * s, 13 * s);
        for (let i = 0; i < casas; i++) {
          const cx = X + (9 + i * 7 + (casas === 1 ? 7 : 0)) * s;
          ctx.fillStyle = "#e6dcc4"; ctx.fillRect(cx, Y + (17 - (i % 2) * 3) * s, 8 * s, 14 * s);
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 1.5 * s, Y + (17 - (i % 2) * 3) * s); ctx.lineTo(cx + 4 * s, Y + (9 - (i % 2) * 3) * s); ctx.lineTo(cx + 9.5 * s, Y + (17 - (i % 2) * 3) * s); ctx.fill();
          ctx.fillStyle = ban; ctx.fillRect(cx + 3 * s, Y + (24 - (i % 2) * 3) * s, 2.4 * s, 7 * s);
        }
        if (ci && ci.capital) { ctx.fillStyle = "#f0cf6a"; ctx.fillRect(X + 18 * s, Y + 3 * s, 4 * s, 4 * s); }
        if (dueno !== null) bandera(X + 33 * s, Y + 20 * s, col, 16 * s, t, x + y);
        if (ci && ci.edificios.some(e => ci.desh[e] >= est.turno)) { ctx.fillStyle = "rgba(20,10,10,.55)"; ctx.fillRect(X + 6 * s, Y + 20 * s, 28 * s, 13 * s); }
      } else if (c.est === "fortaleza") {
        const i = est.fortalezas.findIndex(p => p.x === x && p.y === y);
        const d = i >= 0 ? est.fortalezasDueno[i] : null;
        const col = d === null ? "#8c8c8c" : bandos[d].col;
        ctx.fillStyle = "#5a5560"; ctx.fillRect(X + 8 * s, Y + 14 * s, 24 * s, 20 * s);
        ctx.fillStyle = "#6c6672"; for (let k = 0; k < 3; k++) ctx.fillRect(X + (8 + k * 9) * s, Y + 9 * s, 6 * s, 6 * s);
        ctx.fillStyle = "#2a2430"; ctx.fillRect(X + 17 * s, Y + 24 * s, 6 * s, 10 * s);
        if (d !== null) bandera(X + 20 * s, Y + 9 * s, col, 14 * s, t, x);
      } else if (c.est === "ruinas") {
        ctx.strokeStyle = c.saqueada ? "#80796e" : "#ecd48a"; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(X + 9 * s, Y + 33 * s); ctx.lineTo(X + 9 * s, Y + 17 * s); ctx.arc(X + 20 * s, Y + 17 * s, 11 * s, Math.PI, Math.PI * 1.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X + 31 * s, Y + 33 * s); ctx.lineTo(X + 31 * s, Y + 25 * s); ctx.stroke();
        if (!c.saqueada) { ctx.fillStyle = "#ecd48a"; ctx.fillRect(X + 17 * s, Y + 27 * s, 6 * s, 3 * s); }
      } else if (c.est === "nucleo") {
        const h = Math.max(est.nucleoHold[0], est.nucleoHold[1]);
        const pul = REDUCIDO ? 0 : Math.sin(t / 500) * 1.2 * s;
        ctx.strokeStyle = "#f0d278"; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 13 * s + pul, 0, 7); ctx.stroke();
        ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 6 * s, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + (REDUCIDO ? 0 : t / 4000); ctx.beginPath(); ctx.moveTo(X + 20 * s + Math.cos(a) * 15 * s, Y + 20 * s + Math.sin(a) * 15 * s); ctx.lineTo(X + 20 * s + Math.cos(a) * 18 * s, Y + 20 * s + Math.sin(a) * 18 * s); ctx.stroke(); }
        if (h) { ctx.fillStyle = bandos[est.nucleoHold[0] >= est.nucleoHold[1] ? 0 : 1].col; ctx.font = `bold ${12 * s}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(String(h), X + 20 * s, Y + 24.5 * s); }
      } else if (c.est === "costura") {
        const g = REDUCIDO ? 0 : t / 900;
        ctx.strokeStyle = "#8fe3e6"; ctx.lineWidth = 2.4 * s;
        ctx.setLineDash([5 * s, 4 * s]); ctx.lineDashOffset = -g * 12 * s;
        ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 11 * s, 0, 7); ctx.stroke();
        ctx.lineDashOffset = g * 8 * s; ctx.beginPath(); ctx.arc(X + 20 * s, Y + 20 * s, 5.5 * s, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#8fe3e6"; ctx.fillRect(X + 18.5 * s, Y + 18.5 * s, 3 * s, 3 * s);
      }
      if (c.objetos && c.objetos.length) {
        const bob = REDUCIDO ? 0 : Math.sin(t / 400 + x) * 1.5 * s;
        ctx.fillStyle = "#f6d46c"; ctx.beginPath(); ctx.moveTo(X + 31 * s, Y + (4 + bob) * s); ctx.lineTo(X + 35 * s, Y + (9 + bob) * s); ctx.lineTo(X + 31 * s, Y + (14 + bob) * s); ctx.lineTo(X + 27 * s, Y + (9 + bob) * s); ctx.fill();
      }
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
        ctx.fillStyle = "rgba(14,10,18,.85)"; ctx.fillRect(cx - w / 2, cy + ts * 0.06, w, 4);
        ctx.fillStyle = f > 0.5 ? "#7bc86c" : f > 0.25 ? "#e0b84a" : "#d4574a"; ctx.fillRect(cx - w / 2, cy + ts * 0.06, w * f, 4);
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
          ctx.globalAlpha = 1 - p * p; ctx.fillStyle = "#1b1520"; ctx.font = `bold ${Math.round(ts * 0.46)}px sans-serif`; ctx.textAlign = "center";
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
      ctx.fillStyle = "#0f0b14"; ctx.fillRect(0, 0, ancho, alto);
      if (!est) return;
      if (!bandos) bandos = coloresBando(est);
      paso(ahora);
      const t = ahora;
      const H = est.humano >= 0 ? est.humano : 0;
      const vis = est.vision[H];
      // Marco del mapa
      ctx.fillStyle = "#1a1421"; ctx.fillRect(ox - 6, oy - 6, ts * est.ancho + 12, ts * est.alto + 12);
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
        const v = vis[y * est.ancho + x];
        const c = est.casillas[y][x];
        dibujarTerreno(c, x, y, v, t);
        if (v > 0) dibujarEstructura(c, x, y, t);
        if (v === 1) { ctx.fillStyle = "rgba(10,8,16,.5)"; ctx.fillRect(px(x), py(y), ts, ts); }
      }
      dibujarRegiones(vis);
      ambiente(t);
      // Resaltes de movimiento (no mientras se reproduce una animación)
      if (!anim) estado.mover.forEach((n, k) => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(125,220,125,.28)"; ctx.fillRect(px(x), py(y), ts, ts); ctx.strokeStyle = "rgba(170,255,170,.75)"; ctx.lineWidth = 1.5; ctx.strokeRect(px(x) + 1.5, py(y) + 1.5, ts - 3, ts - 3); });
      estado.objetivosHab.forEach(k => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(150,120,255,.35)"; ctx.fillRect(px(x), py(y), ts, ts); });
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
      if (!anim) estado.atacar.forEach(k => { const [x, y] = k.split(",").map(Number); ctx.strokeStyle = "#ff6b5e"; ctx.lineWidth = 3; const m = REDUCIDO ? 0 : Math.sin(t / 220) * 1.5; ctx.strokeRect(px(x) + 2 - m, py(y) + 2 - m, ts - 4 + m * 2, ts - 4 + m * 2); });
      if (estado.previaAtq) { const p = estado.previaAtq; ctx.strokeStyle = "#ffe3a0"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeRect(px(p.x) + 3, py(p.y) + 3, ts - 6, ts - 6); ctx.setLineDash([]); }
      if (estado.sel && est.unidades[estado.sel] && !anim) { const u = est.unidades[estado.sel]; ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 3; ctx.strokeRect(px(u.x) + 1.5, py(u.y) + 1.5, ts - 3, ts - 3); }
      if (estado.casilla) { ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(px(estado.casilla.x) + 2, py(estado.casilla.y) + 2, ts - 4, ts - 4); ctx.setLineDash([]); }
      if (estado.ciudad && est.ciudades[estado.ciudad]) { const c = est.ciudades[estado.ciudad]; ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 3; ctx.strokeRect(px(c.x) + 1.5, py(c.y) + 1.5, ts - 3, ts - 3); }
      if (estado.hover && !anim) { ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.strokeRect(px(estado.hover.x) + 1, py(estado.hover.y) + 1, ts - 2, ts - 2); }
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
