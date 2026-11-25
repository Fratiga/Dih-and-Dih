/* Estocatta: arte del juego en pixel art.
   Todo se dibuja con píxeles enteros sobre un lienzo de 480×270 que la página amplía sin
   suavizado. Aquí viven la letra de píxeles, los esgrimistas (con articulaciones, capa y
   sombrero), el maniquí de prácticas y los efectos. Es arte procedural: para cambiarlo por
   hojas de sprites hechas a mano basta con sustituir dibujarEsgrimista(); las reglas del
   juego no dependen de nada de este archivo.

   Medidas: 1 píxel = 2 unidades del juego. Los pies están en el punto (x, suelo) y el
   personaje mira hacia +x (se refleja al dibujar si mira al otro lado). */
(function () {
  "use strict";

  /* ---------- Paletas ---------- */

  const COMUN = {
    piel: "#e3b38a", pielSombra: "#b8845e", pelo: "#2a1a12", bota: "#241812", botaLuz: "#4f3826",
    acero: "#e4ebef", aceroSombra: "#8796a2", cazoleta: "#c9a24a", cuero: "#5a3a22", contorno: "#0a0710", ojo: "#140c08"
  };
  const PALETAS = [
    { nombre: "Carmesí", tunica: "#b8352a", luz: "#d65a40", oscura: "#6e1f1a", sombra: "#4a1412", ribete: "#e2b65a", capa: "#5a1814", forro: "#c8483a", pluma: "#f2d27a", calza: "#3a1a1e", texto: "#ffb59f", bandera: "#a5302a" },
    { nombre: "Turquesa", tunica: "#2a7a9c", luz: "#4aa0c0", oscura: "#174a63", sombra: "#0f3446", ribete: "#cfe3ea", capa: "#123a4e", forro: "#3a96b8", pluma: "#f4f1ea", calza: "#1a2a36", texto: "#a8dcff", bandera: "#256d8c" }
  ];

  /* ---------- Píxeles ---------- */

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function linea(ctx, x0, y0, x1, y1, c, g) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; g = g || 1;
    const o = Math.floor((g - 1) / 2);
    ctx.fillStyle = c;
    for (let i = 0; i < 600; i++) {
      ctx.fillRect(x0 - o, y0 - o, g, g);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  const mezclar = (a, b, k) => a + (b - a) * k;
  const punto = (a, b, k) => [mezclar(a[0], b[0], k), mezclar(a[1], b[1], k)];
  const suave = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);

  /* Cinemática inversa de dos huesos: codo o rodilla entre la raíz y el objetivo. */
  function ik(r, t, l1, l2, signo) {
    const dx = t[0] - r[0], dy = t[1] - r[1];
    let d = Math.hypot(dx, dy);
    d = Math.max(0.01, Math.min(l1 + l2 - 0.01, d));
    const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const th = Math.atan2(dy, dx) + signo * a;
    return [r[0] + Math.cos(th) * l1, r[1] + Math.sin(th) * l1];
  }

  /* ---------- Letra de píxeles (5×7, mayúsculas con tildes) ---------- */

  const GLIFOS = {
    A: "01110,10001,10001,11111,10001,10001,10001", B: "11110,10001,10001,11110,10001,10001,11110",
    C: "01110,10001,10000,10000,10000,10001,01110", D: "11110,10001,10001,10001,10001,10001,11110",
    E: "11111,10000,10000,11110,10000,10000,11111", F: "11111,10000,10000,11110,10000,10000,10000",
    G: "01110,10001,10000,10111,10001,10001,01111", H: "10001,10001,10001,11111,10001,10001,10001",
    I: "111,010,010,010,010,010,111", J: "00111,00010,00010,00010,00010,10010,01100",
    K: "10001,10010,10100,11000,10100,10010,10001", L: "10000,10000,10000,10000,10000,10000,11111",
    M: "10001,11011,10101,10101,10001,10001,10001", N: "10001,10001,11001,10101,10011,10001,10001",
    O: "01110,10001,10001,10001,10001,10001,01110", P: "11110,10001,10001,11110,10000,10000,10000",
    Q: "01110,10001,10001,10001,10101,10010,01101", R: "11110,10001,10001,11110,10100,10010,10001",
    S: "01111,10000,10000,01110,00001,00001,11110", T: "11111,00100,00100,00100,00100,00100,00100",
    U: "10001,10001,10001,10001,10001,10001,01110", V: "10001,10001,10001,10001,10001,01010,00100",
    W: "10001,10001,10001,10101,10101,10101,01010", X: "10001,10001,01010,00100,01010,10001,10001",
    Y: "10001,10001,01010,00100,00100,00100,00100", Z: "11111,00001,00010,00100,01000,10000,11111",
    "0": "01110,10001,10011,10101,11001,10001,01110", "1": "010,110,010,010,010,010,111",
    "2": "01110,10001,00001,00010,00100,01000,11111", "3": "11111,00010,00100,00010,00001,10001,01110",
    "4": "00010,00110,01010,10010,11111,00010,00010", "5": "11111,10000,11110,00001,00001,10001,01110",
    "6": "00110,01000,10000,11110,10001,10001,01110", "7": "11111,00001,00010,00100,01000,01000,01000",
    "8": "01110,10001,10001,01110,10001,10001,01110", "9": "01110,10001,10001,01111,00001,00010,01100",
    " ": "000,000,000,000,000,000,000", ".": "0,0,0,0,0,1,1", ",": "00,00,00,00,01,01,10",
    ":": "0,1,1,0,1,1,0", "!": "1,1,1,1,1,0,1", "¡": "1,0,1,1,1,1,1",
    "?": "01110,10001,00001,00010,00100,00000,00100", "¿": "00100,00000,00100,01000,10000,10001,01110",
    "-": "000,000,000,111,000,000,000", "'": "1,1,0,0,0,0,0", "/": "00001,00010,00010,00100,01000,01000,10000",
    "(": "01,10,10,10,10,10,01", ")": "10,01,01,01,01,01,10", "+": "00000,00100,00100,11111,00100,00100,00000",
    ">": "0000000,0001000,0000100,1111110,0000100,0001000,0000000", "<": "0000000,0001000,0010000,0111111,0010000,0001000,0000000",
    "%": "11001,11010,00010,00100,01000,01011,10011", "*": "00000,10101,01110,11111,01110,10101,00000"
  };
  const TILDE = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U" };
  const glifos = {};
  Object.keys(GLIFOS).forEach(k => { glifos[k] = GLIFOS[k].split(",").map(f => f.split("").map(Number)); });

  function anchoTexto(s, esc) {
    esc = esc || 1;
    let w = 0;
    for (const ch of String(s).toUpperCase()) {
      const g = glifos[TILDE[ch] || (ch === "Ñ" ? "N" : ch)] || glifos["?"];
      w += (g[0].length + 1) * esc;
    }
    return Math.max(0, w - esc);
  }

  /* Texto en un lienzo propio (se guarda en caché: el HUD se repinta cada fotograma). */
  const cacheTexto = new Map();
  function lienzoTexto(s, o) {
    const esc = o.escala || 1, color = o.color || "#fff", borde = o.borde || null, sombra = o.sombra || null, luz = o.luz || null;
    const clave = [s, esc, color, borde, sombra, luz].join("|");
    let c = cacheTexto.get(clave);
    if (c) return c;
    const marg = (borde ? 1 : 0) + (sombra ? Math.max(1, esc >> 1) : 0);
    const w = anchoTexto(s, esc) + marg * 2 + esc, h = 10 * esc + marg * 2;
    c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = h;
    const g = c.getContext("2d");
    const pinta = (dx, dy, col, conLuz) => {
      let x = marg + dx;
      g.fillStyle = col;
      for (const original of String(s).toUpperCase()) {
        const base = TILDE[original] || (original === "Ñ" ? "N" : original);
        const gl = glifos[base] || glifos["?"];
        const y0 = marg + dy + 3 * esc;
        gl.forEach((fila, r) => fila.forEach((v, q) => {
          if (!v) return;
          if (conLuz && luz && (r === 0 || !gl[r - 1][q])) { g.fillStyle = luz; g.fillRect(x + q * esc, y0 + r * esc, esc, Math.max(1, esc >> 1)); g.fillStyle = col; g.fillRect(x + q * esc, y0 + r * esc + Math.max(1, esc >> 1), esc, esc - Math.max(1, esc >> 1)); }
          else g.fillRect(x + q * esc, y0 + r * esc, esc, esc);
        }));
        const centro = x + Math.floor(gl[0].length / 2) * esc;
        if (TILDE[original]) { g.fillRect(centro, y0 - 2 * esc, esc, esc); g.fillRect(centro + esc, y0 - 3 * esc, esc, esc); }
        if (original === "Ñ") { g.fillRect(x, y0 - 2 * esc, esc, esc); g.fillRect(x + esc, y0 - 3 * esc, 2 * esc, esc); g.fillRect(x + 3 * esc, y0 - 2 * esc, esc, esc); g.fillRect(x + 4 * esc, y0 - 3 * esc, esc, esc); }
        x += (gl[0].length + 1) * esc;
      }
    };
    const ds = Math.max(1, esc >> 1);
    if (sombra) pinta(ds, ds, sombra);
    if (borde) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pinta(dx, dy, borde); }
    pinta(0, 0, color, true);
    if (cacheTexto.size > 400) cacheTexto.clear();
    cacheTexto.set(clave, c);
    return c;
  }
  /* alinear: "izq" | "centro" | "der". y es la parte de arriba de las letras. */
  function texto(ctx, s, x, y, o) {
    o = o || {};
    const c = lienzoTexto(s, o);
    const esc = o.escala || 1, marg = (o.borde ? 1 : 0) + (o.sombra ? Math.max(1, esc >> 1) : 0);
    let dx = x - marg;
    if (o.alinear === "centro") dx = x - Math.floor(c.width / 2);
    else if (o.alinear === "der") dx = x - c.width + marg;
    ctx.drawImage(c, Math.round(dx), Math.round(y - marg - 3 * esc));
    return c.width;
  }

  /* ---------- El esgrimista ---------- */

  const Y_MANO = [-32, -26, -19];       // altura de la mano según la altura de la espada
  const Y_PUNTA = [-40, -27, -12];       // y de la punta en guardia
  const LARGO_HOJA = 34;

  /* Duración total (ticks) de cada fase, para saber cuánto ha avanzado una animación. */
  function duracionFase(E, tipo, fase) {
    const C = E.CFG, ms = E.ms;
    const t = {
      estocada: { prep: C.ESTOCADA.prep, impacto: C.ESTOCADA.impacto, recup: C.ESTOCADA.recup },
      tajo: { prep: C.TAJO.prep, impacto: C.TAJO.impacto, recup: C.TAJO.recup },
      finta: { prep: C.FINTA.prep, recup: C.FINTA.recup },
      parada: { ventana: C.PARADA.ventana, recup: C.PARADA.fallo },
      aterriza: { recup: C.ATERRIZAJE }
    }[tipo];
    return t && t[fase] ? ms(t[fase]) : 1;
  }

  /* Postura: puntos clave relativos a los pies, mirando a +x.
     v: { anim, altura, altAccion, prog (0..1 de la fase), zancada (0..1), vel (px/s), t (ms) } */
  function postura(v) {
    const [base, fase] = v.anim.split("_");
    const alt = v.altura, ag = v.altAccion !== undefined ? v.altAccion : alt;
    const k = v.prog || 0;
    const respira = Math.round(Math.sin(v.t / 520) * 0.6);
    const p = {
      cadera: [0, -17 + (respira > 0 ? 1 : 0)], pieDel: [6, 0], pieTras: [-6, 0], alzaDel: 0, alzaTras: 0,
      inclina: 0, mano: [9, Y_MANO[alt]], punta: null, manoTras: [-7, -34], hoja: "recta",
      brillo: false, aturdido: false, rastro: false
    };
    p.punta = [p.mano[0] + 25, Y_PUNTA[alt] + (alt === 2 ? 2 : 0)];

    if (base === "caminar" || base === "correr") {
      const corre = base === "correr";
      const fase2 = v.zancada * Math.PI * 2;
      const amp = corre ? 8 : 5;
      p.pieDel = [3 + Math.sin(fase2) * amp, 0]; p.pieTras = [-3 - Math.sin(fase2) * amp, 0];
      p.alzaDel = Math.max(0, Math.cos(fase2)) * (corre ? 4 : 2);
      p.alzaTras = Math.max(0, -Math.cos(fase2)) * (corre ? 4 : 2);
      p.cadera[1] += Math.abs(Math.sin(fase2)) > 0.7 ? -1 : 0;
      if (corre) {
        p.inclina = 3;
        p.mano = [10, Y_MANO[alt] + 3]; p.punta = [32, Y_PUNTA[alt] + 6];
        p.manoTras = [-6 - Math.sin(fase2) * 4, -26];
      }
    } else if (base === "agachado") {
      p.cadera = [0, -10]; p.pieDel = [8, 0]; p.pieTras = [-7, 0]; p.inclina = 2;
      p.mano = [11, Y_MANO[alt] + 8]; p.punta = [36, Y_PUNTA[alt] + 9]; p.manoTras = [-7, -22];
    } else if (base === "salto") {
      p.cadera = [0, -18]; p.pieDel = [5, -6]; p.pieTras = [-4, -4]; p.inclina = 1;
      p.mano = [10, Y_MANO[alt] - 1]; p.punta = [33, Y_PUNTA[alt] - 2]; p.manoTras = [-9, -36];
    } else if (base === "guardia") {
      // la espada se pone casi vertical delante, a la altura que se cubre
      const ym = Y_MANO[alt];
      p.mano = [9, ym]; p.hoja = "vertical";
      p.punta = alt === 2 ? [13, ym + 14] : [12, ym - 16];
      p.manoTras = [-5, -22]; p.pieDel = [7, 0]; p.pieTras = [-7, 0]; p.cadera = [-1, -16];
    } else if (base === "aterriza") {
      p.cadera = [0, -13 + Math.round(k * 3)]; p.pieDel = [7, 0]; p.pieTras = [-7, 0];
    } else if (base === "aturdido") {
      p.cadera = [-2, -15]; p.inclina = -3; p.mano = [5, -16]; p.punta = [26, -4]; p.manoTras = [-10, -24]; p.aturdido = true;
      p.pieDel = [5, 0]; p.pieTras = [-8, 0];
    } else if (base === "estocada") {
      const ym = Y_MANO[ag];
      if (fase === "prep") {
        const kk = suave(k);
        p.cadera = [mezclar(0, -3, kk), -17]; p.pieDel = [7, 0]; p.pieTras = [-8, 0]; p.inclina = Math.round(-2 * kk);
        p.mano = punto([9, Y_MANO[alt]], [1, ym], kk); p.punta = punto([34, Y_PUNTA[alt]], [33, ym], kk);
        p.manoTras = [-8, -36];
      } else if (fase === "impacto") {
        const kk = suave(Math.min(1, k * 1.6));
        p.cadera = punto([-3, -17], [4, -13], kk); p.pieDel = punto([7, 0], [17, 0], kk); p.pieTras = [-10, 0];
        p.inclina = 4; p.mano = punto([1, ym], [24, ym], kk); p.punta = punto([33, ym], [66, ym], kk);
        p.manoTras = punto([-8, -36], [-16, -24], kk); p.brillo = true; p.rastro = true;
      } else {
        const kk = suave(k);
        p.cadera = punto([4, -13], [0, -17], kk); p.pieDel = punto([17, 0], [6, 0], kk); p.pieTras = punto([-10, 0], [-6, 0], kk);
        p.inclina = Math.round(4 * (1 - kk));
        p.mano = punto([23, ym + 3], [9, Y_MANO[alt]], kk); p.punta = punto([62, ym + 9], [34, Y_PUNTA[alt]], kk);
        p.manoTras = punto([-15, -25], [-7, -34], kk);
      }
    } else if (base === "tajo") {
      const ym = Y_MANO[ag];
      if (fase === "prep") {
        const kk = suave(k);
        p.cadera = [mezclar(0, -2, kk), -17]; p.inclina = Math.round(-3 * kk); p.pieDel = [7, 0]; p.pieTras = [-8, 0];
        p.mano = punto([9, Y_MANO[alt]], [-1, -42], kk); p.punta = punto([34, Y_PUNTA[alt]], [-14, -64], kk);
        p.manoTras = [-6, -22];
      } else if (fase === "impacto") {
        // barrido: la punta recorre un arco de atrás-arriba a delante-abajo
        const a = mezclar(-2.2, 0.55 + (ag - 1) * 0.35, suave(k));
        p.cadera = punto([-2, -17], [3, -14], suave(k)); p.pieDel = punto([7, 0], [15, 0], suave(k)); p.pieTras = [-10, 0];
        p.inclina = 3; p.mano = punto([-1, -42], [18, ym], suave(k));
        p.punta = [p.mano[0] + Math.cos(a) * 62, p.mano[1] + Math.sin(a) * 62];
        p.manoTras = [-15, -26]; p.brillo = true; p.rastro = true; p.arco = true;
      } else {
        const kk = suave(k);
        p.cadera = punto([3, -14], [0, -17], kk); p.pieDel = punto([15, 0], [6, 0], kk); p.pieTras = punto([-10, 0], [-6, 0], kk);
        p.mano = punto([16, -14], [9, Y_MANO[alt]], kk); p.punta = punto([58, -2], [34, Y_PUNTA[alt]], kk);
        p.manoTras = punto([-14, -26], [-7, -34], kk); p.inclina = Math.round(3 * (1 - kk));
      }
    } else if (base === "finta") {
      const ym = Y_MANO[ag];
      if (fase === "prep") {
        const kk = suave(Math.min(1, k * 1.4));
        p.pieDel = punto([6, 0], [11, 0], kk); p.cadera = punto([0, -17], [2, -16], kk); p.inclina = 2;
        p.mano = punto([9, Y_MANO[alt]], [15, ym], kk); p.punta = punto([34, Y_PUNTA[alt]], [46, ym - 2], kk);
        p.brillo = Math.floor(v.t / 60) % 2 === 0;
      } else {
        const kk = suave(k);
        p.pieDel = punto([11, 0], [6, 0], kk); p.mano = punto([14, ym], [9, Y_MANO[alt]], kk); p.punta = punto([44, ym], [34, Y_PUNTA[alt]], kk);
      }
    } else if (base === "parada") {
      if (fase === "ventana") {
        const ym = Y_MANO[ag];
        p.mano = [10, ym]; p.hoja = "vertical"; p.punta = ag === 2 ? [16, ym + 14] : [17, ym - 18];
        p.pieDel = [5, 0]; p.pieTras = [-8, 0]; p.cadera = [-2, -17]; p.brillo = true; p.manoTras = [-8, -36];
      } else {
        const kk = suave(k);
        p.cadera = punto([-3, -15], [0, -17], kk); p.inclina = Math.round(-2 * (1 - kk));
        p.mano = punto([5, -17], [9, Y_MANO[alt]], kk); p.punta = punto([29, -4], [34, Y_PUNTA[alt]], kk);
        p.manoTras = [-9, -28];
      }
    } else if (base === "saludo") {
      // saludo de esgrima: la cazoleta sube a la cara y la hoja baja barriendo
      const kk = v.prog;
      if (kk < 0.45) { const q = suave(kk / 0.45); p.mano = punto([9, -26], [4, -38], q); p.punta = punto([34, -27], [6, -68], q); p.hoja = "vertical"; }
      else { const q = suave((kk - 0.45) / 0.55); p.mano = punto([4, -38], [11, -20], q); p.punta = punto([6, -68], [36, -5], q); }
      p.manoTras = [-6, -22]; p.pieDel = [5, 0]; p.pieTras = [-5, 0];
    } else if (base === "victoria") {
      p.mano = [3, -46]; p.punta = [10, -80]; p.hoja = "vertical"; p.manoTras = [-6, -48 + Math.round(Math.sin(v.t / 260))];
      p.pieDel = [5, 0]; p.pieTras = [-6, 0]; p.sombreroEnMano = true;
    } else if (base === "derrota") {
      p.cadera = [-2, -9]; p.pieDel = [6, 0]; p.pieTras = [-10, 0]; p.inclina = 3; p.cabezaGacha = true;
      p.mano = [10, -6]; p.punta = [40, 0]; p.manoTras = [2, -12];
    } else if (base === "descanso") {
      p.mano = [6, -16]; p.punta = [14, 0]; p.hoja = "vertical"; p.manoTras = [-5, -20];
    }
    return p;
  }

  /* Capa: una cadena de nudos que cuelga del hombro y se mueve con el cuerpo. */
  function nuevaCapa() { return { nudos: null }; }
  function moverCapa(capa, raizX, raizY, cara, dt, viento) {
    const N = 5, L = 4;
    if (!capa.nudos) {
      capa.nudos = [];
      for (let i = 0; i < N; i++) capa.nudos.push({ x: raizX - cara * i * 2, y: raizY + i * L, px: raizX - cara * i * 2, py: raizY + i * L });
    }
    const n = capa.nudos;
    n[0].x = raizX; n[0].y = raizY; n[0].px = raizX; n[0].py = raizY;
    const g = 260 * dt * dt, w = (viento || 0) * dt * dt;
    for (let i = 1; i < N; i++) {
      const a = n[i];
      const vx = (a.x - a.px) * 0.9, vy = (a.y - a.py) * 0.9;
      a.px = a.x; a.py = a.y;
      a.x += vx + w - cara * 8 * dt * dt; a.y += vy + g;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < N; i++) {
        const a = n[i - 1], b = n[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
        const k = (d - L) / d;
        b.x -= dx * k; b.y -= dy * k;
      }
    }
  }
  function dibujarCapa(ctx, capa, pal) {
    const n = capa.nudos;
    if (!n) return;
    for (let i = 1; i < n.length; i++) linea(ctx, n[i - 1].x, n[i - 1].y + 1, n[i].x, n[i].y + 1, COMUN.contorno, i < 3 ? 6 : 5);
    for (let i = 1; i < n.length; i++) linea(ctx, n[i - 1].x, n[i - 1].y, n[i].x, n[i].y, pal.capa, i < 3 ? 4 : 3);
    const u = n[n.length - 1], a = n[n.length - 2];
    linea(ctx, a.x, a.y + 1, u.x, u.y + 1, pal.forro, 1);
  }

  /* Lienzos de trabajo para el contorno de cada esgrimista. */
  const BW = 200, BH = 120, OX = 100, OY = 104;
  const buffers = [0, 1, 2, 3].map(() => {
    const a = document.createElement("canvas"); a.width = BW; a.height = BH;
    const b = document.createElement("canvas"); b.width = BW; b.height = BH;
    return { a, b, ca: a.getContext("2d"), cb: b.getContext("2d") };
  });

  function dibujarSombrero(g, cx, cy, pal, t, gacha) {
    // ala ancha, copa y pluma que se mece
    rect(g, cx - 6, cy, 13, 1, COMUN.contorno);
    rect(g, cx - 6, cy - 1, 13, 1, pal.oscura);
    rect(g, cx - 3, cy - 4, 7, 3, pal.oscura);
    rect(g, cx - 3, cy - 2, 7, 1, pal.ribete);
    const b = Math.round(Math.sin(t / 300) * 1);
    rect(g, cx - 4, cy - 5 + b, 2, 1, pal.pluma); rect(g, cx - 6, cy - 6 + b, 3, 1, pal.pluma);
    rect(g, cx - 8, cy - 6 + b * 2, 2, 1, pal.pluma); rect(g, cx - 9, cy - 5 + b * 2, 1, 1, pal.pluma);
    if (gacha) rect(g, cx - 6, cy + 1, 13, 1, pal.oscura);
  }

  function dibujarHoja(g, p, pal) {
    const [hx, hy] = p.mano, [tx, ty] = p.punta;
    if (p.rastro && p.arco) {
      // arco del tajo: estela fina
      for (let i = 0; i < 7; i++) {
        const a = -2.2 + i * 0.42;
        rect(g, p.mano[0] + Math.cos(a) * 58, p.mano[1] + Math.sin(a) * 58, 2, 1, i % 2 ? "rgba(255,255,255,.5)" : "rgba(255,236,190,.35)");
      }
    }
    linea(g, hx, hy, tx, ty, COMUN.aceroSombra, 1);
    // filo claro desplazado un píxel hacia arriba en la mitad delantera
    const mx = mezclar(hx, tx, 0.35), my = mezclar(hy, ty, 0.35);
    linea(g, mx, my - 1, tx, ty - 1, COMUN.acero, 1);
    // cazoleta y gavilanes
    rect(g, hx - 1, hy - 2, 3, 4, COMUN.cazoleta);
    rect(g, hx, hy - 1, 1, 2, "#f3d98a");
    rect(g, hx - 2, hy + 2, 1, 1, COMUN.cuero);
    if (p.brillo) { rect(g, tx - 1, ty - 1, 3, 1, "#ffffff"); rect(g, tx, ty - 2, 1, 3, "#ffffff"); }
  }

  /* Dibuja el cuerpo en el lienzo de trabajo (sin contorno), mirando a +x. */
  function cuerpo(g, p, pal, v) {
    const C = COMUN;
    const cad = [OX + p.cadera[0], OY + p.cadera[1]];
    const hom = [cad[0] + p.inclina, cad[1] - 13];
    const pieD = [OX + p.pieDel[0], OY + p.pieDel[1] - p.alzaDel], pieT = [OX + p.pieTras[0], OY + p.pieTras[1] - p.alzaTras];
    // pierna de atrás
    const rodT = ik([cad[0] - 1, cad[1]], pieT, 9, 9, -1);
    linea(g, cad[0] - 1, cad[1], rodT[0], rodT[1], pal.calza, 3);
    linea(g, rodT[0], rodT[1], pieT[0], pieT[1] - 2, C.bota, 3);
    rect(g, pieT[0] - 2, pieT[1] - 2, 5, 2, C.bota);
    // brazo de atrás (detrás del torso)
    const mt = [OX + p.manoTras[0], OY + p.manoTras[1]];
    const hombroT = [hom[0] - 3, hom[1] + 2];
    const codoT = ik(hombroT, mt, 6, 6, 1);
    linea(g, hombroT[0], hombroT[1], codoT[0], codoT[1], pal.oscura, 2);
    linea(g, codoT[0], codoT[1], mt[0], mt[1], pal.oscura, 2);
    rect(g, mt[0] - 1, mt[1] - 1, 2, 2, C.cuero);
    // torso: jubón con luz delante, sombra detrás, cinto y banda
    const tx = Math.round(Math.min(cad[0], hom[0]) - 4), top = Math.round(hom[1]);
    for (let y = top; y <= cad[1]; y++) {
      const k = (y - top) / Math.max(1, cad[1] - top);
      const x = Math.round(mezclar(hom[0], cad[0], k)) - 4;
      rect(g, x, y, 9, 1, pal.tunica);
      rect(g, x, y, 2, 1, pal.oscura);
      rect(g, x + 7, y, 2, 1, pal.luz);
    }
    rect(g, cad[0] - 4, cad[1] - 2, 9, 2, C.cuero);
    rect(g, cad[0] + 1, cad[1] - 2, 2, 2, pal.ribete);
    linea(g, hom[0] - 3, hom[1] + 1, cad[0] + 3, cad[1] - 3, pal.ribete, 1);
    // faldón
    rect(g, cad[0] - 4, cad[1], 9, 3, pal.oscura);
    // pierna de delante
    const rodD = ik([cad[0] + 1, cad[1]], pieD, 9, 9, -1);
    linea(g, cad[0] + 1, cad[1] + 1, rodD[0], rodD[1], pal.calza, 3);
    linea(g, rodD[0], rodD[1], pieD[0], pieD[1] - 2, C.bota, 3);
    rect(g, rodD[0] - 1, rodD[1] - 1, 3, 2, C.botaLuz);
    rect(g, pieD[0] - 1, pieD[1] - 2, 5, 2, C.bota);
    rect(g, pieD[0] + 2, pieD[1] - 2, 1, 1, C.botaLuz);
    // cabeza
    const cab = [hom[0] + 1, hom[1] - 6 + (p.cabezaGacha ? 3 : 0)];
    rect(g, cab[0] - 3, cab[1] - 4, 7, 7, C.piel);
    rect(g, cab[0] - 3, cab[1] - 4, 2, 7, C.pielSombra);
    rect(g, cab[0] - 4, cab[1] - 3, 3, 6, C.pelo);
    rect(g, cab[0] + 1, cab[1] - 2, 1, 2, C.ojo);
    rect(g, cab[0] + 4, cab[1], 1, 1, C.pielSombra);
    rect(g, cab[0] + 1, cab[1] + 2, 3, 1, C.pelo);      // bigote
    if (!p.sombreroEnMano && !v.sinSombrero) dibujarSombrero(g, cab[0], cab[1] - 5, pal, v.t, p.cabezaGacha);
    // cuello de encaje
    rect(g, hom[0] - 2, hom[1] - 1, 6, 2, "#efe6d6");
    // brazo armado y espada
    const ma = [OX + p.mano[0], OY + p.mano[1]];
    const hombroD = [hom[0] + 2, hom[1] + 2];
    const codo = ik(hombroD, ma, 6, 6, 1);
    linea(g, hombroD[0], hombroD[1], codo[0], codo[1], pal.tunica, 3);
    linea(g, codo[0], codo[1], ma[0], ma[1], pal.luz, 2);
    dibujarHoja(g, { mano: ma, punta: [OX + p.punta[0], OY + p.punta[1]], brillo: p.brillo, rastro: p.rastro, arco: p.arco }, pal);
    rect(g, ma[0] - 1, ma[1] - 1, 2, 2, C.cuero);
    if (p.sombreroEnMano) dibujarSombrero(g, mt[0], mt[1] - 2, pal, v.t, false);
    if (p.aturdido) {
      for (let i = 0; i < 3; i++) {
        const a = v.t / 170 + i * 2.1;
        rect(g, cab[0] + Math.cos(a) * 8, cab[1] - 12 + Math.sin(a) * 2, 2, 2, "#ffe27a");
      }
    }
    return { cabeza: cab, hombro: hom };
  }

  /* Dibuja un esgrimista completo con contorno.
     v: { x, suelo, alto, cara, anim, altura, altAccion, prog, zancada, t, proteccion, contra,
          aparicion (0..1, se materializa), capa, sinSombrero, desvanecer } */
  function dibujarEsgrimista(ctx, v, idPal, n) {
    const pal = PALETAS[idPal];
    const buf = buffers[n === undefined ? idPal : n];
    const g = buf.ca;
    g.clearRect(0, 0, BW, BH);
    const p = postura(v);
    const partes = cuerpo(g, p, pal, v);
    // la capa se calcula en coordenadas de pantalla (sigue al cuerpo con retraso)
    if (v.capa) {
      const hombroPantalla = [v.x + v.cara * (partes.hombro[0] - OX - 3), v.suelo - v.alto + (partes.hombro[1] - OY) + 1];
      moverCapa(v.capa, hombroPantalla[0], hombroPantalla[1], v.cara, v.dt || 1 / 60, v.viento || 0);
    }
    // contorno: silueta oscura alrededor
    const s = buf.cb;
    s.clearRect(0, 0, BW, BH);
    s.globalCompositeOperation = "source-over";
    s.drawImage(buf.a, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = COMUN.contorno; s.fillRect(0, 0, BW, BH);
    s.globalCompositeOperation = "source-over";

    const x = Math.round(v.x), y = Math.round(v.suelo - v.alto);
    // sombra en el suelo
    const esc = Math.max(4, 12 - v.alto * 0.12);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(Math.round(v.x - esc), Math.round(v.suelo) - 1, Math.round(esc * 2), 2);

    ctx.save();
    let alfa = 1;
    if (v.proteccion) alfa = Math.floor(v.t / 80) % 2 ? 0.55 : 0.9;
    if (v.desvanecer !== undefined) alfa *= v.desvanecer;
    ctx.globalAlpha = alfa;
    if (v.capa) dibujarCapa(ctx, v.capa, pal);
    ctx.translate(x, y);
    if (v.cara < 0) ctx.scale(-1, 1);
    // aparición: el cuerpo se dibuja de los pies hacia arriba
    if (v.aparicion !== undefined && v.aparicion < 1) {
      const hVis = Math.round(BH * v.aparicion);
      ctx.beginPath(); ctx.rect(-OX, OY - hVis - OY, BW, hVis + 20); ctx.clip();
    }
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(buf.b, -OX + dx, -OY + dy);
    ctx.drawImage(buf.a, -OX, -OY);
    if (v.contra) { rect(ctx, -2, -60, 5, 2, "#fff6c8"); rect(ctx, 0, -62, 1, 6, "#fff6c8"); }
    ctx.restore();
    return p;
  }

  /* Caído: el cuerpo tendido en el suelo. k va de 0 (recién herido) a 1. */
  function dibujarCaido(ctx, x, suelo, cara, idPal, k, t) {
    const pal = PALETAS[idPal], C = COMUN;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(suelo));
    if (cara < 0) ctx.scale(-1, 1);
    if (k > 0.78) ctx.globalAlpha = Math.max(0, 1 - (k - 0.78) / 0.22);
    if (k < 0.12) {
      ctx.restore();
      dibujarEsgrimista(ctx, { x, suelo, alto: 0, cara, anim: "derrota", altura: 1, prog: 0, t, sinSombrero: true }, idPal, 2 + idPal);
      return;
    }
    // tendido de espaldas, con la capa debajo y la espada caída al lado (mira hacia atrás: cayó hacia atrás)
    const L = (a, b, c, d, col, g) => linea(ctx, a, b, c, d, col, g);
    rect(ctx, -22, -4, 40, 5, C.contorno);
    rect(ctx, -20, -3, 34, 3, pal.capa); rect(ctx, -20, -1, 30, 1, pal.forro);
    rect(ctx, -21, -7, 6, 5, C.contorno); rect(ctx, -20, -6, 4, 3, C.bota); rect(ctx, -19, -6, 2, 1, C.botaLuz);
    rect(ctx, -16, -7, 11, 4, C.contorno); rect(ctx, -15, -6, 10, 2, pal.calza);
    rect(ctx, -6, -9, 13, 6, C.contorno); rect(ctx, -5, -8, 11, 4, pal.tunica); rect(ctx, -5, -8, 11, 1, pal.luz);
    rect(ctx, -2, -6, 2, 2, C.cuero); rect(ctx, 0, -8, 1, 4, pal.ribete);
    rect(ctx, 7, -9, 3, 3, "#efe6d6");
    rect(ctx, 9, -10, 8, 7, C.contorno); rect(ctx, 10, -9, 6, 5, C.piel); rect(ctx, 10, -9, 6, 1, C.pelo); rect(ctx, 15, -8, 1, 3, C.pelo);
    rect(ctx, 12, -7, 1, 1, C.ojo);
    L(2, -8, 6, -13, C.contorno, 3); L(2, -8, 6, -13, pal.luz, 1);
    L(8, -1, 30, -1, C.aceroSombra, 1); L(14, -2, 30, -2, C.acero, 1); rect(ctx, 6, -3, 3, 3, C.cazoleta);
    ctx.restore();
  }

  /* Sombrero suelto (sale volando al caer y se queda en el suelo). */
  function dibujarSombreroSuelto(ctx, x, y, idPal, bocaArriba, t) {
    const pal = PALETAS[idPal];
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (bocaArriba) ctx.scale(1, -1);
    rect(ctx, -7, -1, 15, 2, COMUN.contorno);
    rect(ctx, -6, -1, 13, 1, pal.oscura);
    rect(ctx, -3, -4, 7, 3, pal.oscura); rect(ctx, -3, -2, 7, 1, pal.ribete);
    rect(ctx, -6, -5, 3, 1, pal.pluma); rect(ctx, -8, -6, 2, 1, pal.pluma);
    ctx.restore();
  }

  /* Maniquí de prácticas: poste, saco de paja y una espada de madera según la guardia. */
  function dibujarManiqui(ctx, x, suelo, cara, guardia, golpe, t) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(suelo));
    if (cara < 0) ctx.scale(-1, 1);
    const tiembla = golpe > 0 ? Math.round(Math.sin(t / 20) * 2 * golpe) : 0;
    ctx.translate(tiembla, 0);
    rect(ctx, -7, -3, 15, 3, "#3a2a1c"); rect(ctx, -6, -3, 13, 1, "#5a4128");
    rect(ctx, -1, -46, 3, 44, "#0a0710"); rect(ctx, 0, -45, 1, 42, "#7a5a36");
    rect(ctx, -6, -40, 13, 22, "#0a0710"); rect(ctx, -5, -39, 11, 20, "#b8975a"); rect(ctx, -5, -39, 3, 20, "#8a6c3c");
    rect(ctx, -5, -30, 11, 1, "#6e5228"); rect(ctx, -5, -24, 11, 1, "#6e5228");
    rect(ctx, -4, -50, 9, 9, "#0a0710"); rect(ctx, -3, -49, 7, 7, "#c9a96a"); rect(ctx, -3, -49, 2, 7, "#8a6c3c");
    rect(ctx, 1, -47, 2, 1, "#4a3420"); rect(ctx, 0, -44, 3, 1, "#4a3420");
    rect(ctx, -9, -35, 3, 2, "#7a5a36"); rect(ctx, 7, -35, 4, 2, "#7a5a36");
    if (guardia >= 0) {
      const ym = Y_MANO[guardia];
      linea(ctx, 9, ym, 13, guardia === 2 ? ym + 14 : ym - 16, "#0a0710", 3);
      linea(ctx, 9, ym, 13, guardia === 2 ? ym + 14 : ym - 16, "#a07a46", 1);
      rect(ctx, 8, ym - 1, 3, 3, "#6e5228");
    }
    ctx.restore();
  }

  /* ---------- Efectos de un instante ---------- */

  function dibujarEfecto(ctx, ef, ahora) {
    const edad = (ahora - ef.t0) / ef.dur;
    if (edad >= 1 || edad < 0) return edad < 1;
    ctx.save();
    ctx.translate(Math.round(ef.x), Math.round(ef.y));
    if (ef.tipo === "estrella") {
      // destello de choque: cruz que crece y se apaga
      const r = Math.round(3 + edad * 14);
      ctx.globalAlpha = 1 - edad;
      rect(ctx, -r, 0, r * 2 + 1, 1, "#ffffff"); rect(ctx, 0, -r, 1, r * 2 + 1, "#ffffff");
      const d = Math.round(r * 0.6);
      for (let i = 1; i <= d; i += 2) { rect(ctx, i, i, 1, 1, "#fff6c8"); rect(ctx, -i, -i, 1, 1, "#fff6c8"); rect(ctx, i, -i, 1, 1, "#fff6c8"); rect(ctx, -i, i, 1, 1, "#fff6c8"); }
    } else if (ef.tipo === "anillo") {
      const r = 4 + edad * (ef.radio || 22);
      ctx.globalAlpha = 1 - edad;
      for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; rect(ctx, Math.cos(t) * r, Math.sin(t) * r * 0.7, 2, 2, ef.color || "#ffffff"); }
    } else if (ef.tipo === "sello") {
      // un texto grande que cae y se queda, como un sello
      const k = Math.min(1, edad * 4);
      const esc = ef.escala || 3;
      ctx.globalAlpha = edad > 0.8 ? (1 - edad) / 0.2 : 1;
      const caida = Math.round((1 - suave(k)) * -16);
      texto(ctx, ef.texto, 0, caida, { escala: esc, color: ef.color || "#fff6c8", borde: "#0a0710", sombra: "#0a0710", alinear: "centro" });
    } else if (ef.tipo === "letrero") {
      ctx.globalAlpha = 1 - edad * edad;
      texto(ctx, ef.texto, 0, -Math.round(edad * 14), { escala: 1, color: ef.color || "#fff6c8", borde: "#0a0710", alinear: "centro" });
    } else if (ef.tipo === "haz") {
      // columna de luz de la reaparición
      const a = edad < 0.2 ? edad / 0.2 : 1 - (edad - 0.2) / 0.8;
      ctx.globalAlpha = Math.max(0, a) * 0.8;
      rect(ctx, -6, -220, 12, 220, "rgba(190,240,210,.35)");
      rect(ctx, -2, -220, 4, 220, "rgba(235,255,240,.7)");
    }
    ctx.restore();
    return true;
  }

  window.EstocattaSprites = {
    PALETAS, COMUN, rect, linea, texto, anchoTexto, lienzoTexto, suave, mezclar,
    postura, duracionFase, nuevaCapa, dibujarEsgrimista, dibujarCaido, dibujarSombreroSuelto, dibujarManiqui, dibujarEfecto,
    Y_MANO, LARGO_HOJA
  };
})();
