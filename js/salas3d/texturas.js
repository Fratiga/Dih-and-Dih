/* =============================================================================
   TEXTURAS PIXEL ART DE LAS SALAS 2.5D (las usan js/salas3d/motor.js y js/salas3d/salas.js)
   Todo se pinta en lienzos pequeños con una semilla fija (la escena es siempre la misma) y se usa sin suavizado, así la arquitectura 3D
   conserva el aspecto de píxel del resto del sitio. Densidad: unos 32 píxeles de textura por unidad del mundo.
============================================================================= */
export function crearTexturas(THREE) {
  const cache = new Map();

  function rng(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    return [c, g];
  }
  // Aclara u oscurece un color #rrggbb
  function tono(hex, d) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + d)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function textura(c, repetir) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repetir[0], repetir[1]); }
    return t;
  }
  function guardada(clave, hacer) {
    if (!cache.has(clave)) cache.set(clave, hacer());
    return cache.get(clave);
  }

  /* Tablones horizontales: vetas, juntas y clavos */
  function pintarTablones(g, w, h, base, alto, semilla) {
    const r = rng(semilla);
    for (let y = 0; y < h; y += alto) {
      const sombra = (r() - 0.5) * 26;
      g.fillStyle = tono(base, sombra); g.fillRect(0, y, w, alto);
      g.fillStyle = tono(base, sombra + 14); g.fillRect(0, y, w, 1);
      g.fillStyle = tono(base, sombra - 40); g.fillRect(0, y + alto - 1, w, 1);
      for (let k = 0; k < 4; k++) {
        const vy = y + 2 + Math.floor(r() * (alto - 4)), vx = Math.floor(r() * w), vl = 6 + Math.floor(r() * 18);
        g.fillStyle = tono(base, sombra - 18); g.fillRect(vx, vy, vl, 1);
      }
      const junta = Math.floor(r() * w);
      g.fillStyle = tono(base, sombra - 46); g.fillRect(junta, y, 1, alto - 1);
      g.fillStyle = tono(base, -70); g.fillRect((junta + 3) % w, y + 2, 1, 1); g.fillRect((junta + 3) % w, y + alto - 4, 1, 1);
    }
  }

  const T = {
    suelo: () => guardada("suelo", () => {
      const [c, g] = lienzo(64, 64);
      pintarTablones(g, 64, 64, "#7a5332", 8, 11);
      return textura(c, [16, 9]);
    }),
    madera: (base = "#6b4a2f", semilla = 3) => guardada("madera" + base + semilla, () => {
      const [c, g] = lienzo(32, 32);
      pintarTablones(g, 32, 32, base, 8, semilla);
      return textura(c, [1, 1]);
    }),
    maderaVertical: (base = "#5d3f27") => guardada("maderav" + base, () => {
      const [c, g] = lienzo(64, 64);
      g.save(); g.translate(64, 0); g.rotate(Math.PI / 2);
      pintarTablones(g, 64, 64, base, 10, 21);
      g.restore();
      return textura(c, [6, 1]);
    }),
    piedra: (base = "#6d6470", semilla = 5, rep = [1, 1]) => guardada("piedra" + base + semilla + rep, () => {
      const [c, g] = lienzo(64, 64), r = rng(semilla);
      g.fillStyle = tono(base, -48); g.fillRect(0, 0, 64, 64);
      for (let y = 0, fila = 0; y < 64; y += 12, fila++) {
        let x = -((fila * 7) % 13);
        while (x < 64) {
          const w = 12 + Math.floor(r() * 12), s = (r() - 0.5) * 30;
          g.fillStyle = tono(base, s); g.fillRect(x + 1, y + 1, w - 2, 10);
          g.fillStyle = tono(base, s + 18); g.fillRect(x + 1, y + 1, w - 2, 1);
          g.fillStyle = tono(base, s - 22); g.fillRect(x + 1, y + 10, w - 2, 1);
          if (r() < 0.35) { g.fillStyle = tono(base, s - 14); g.fillRect(x + 3 + Math.floor(r() * (w - 6)), y + 4, 2, 2); }
          x += w;
        }
      }
      return textura(c, rep);
    }),
    yeso: () => guardada("yeso", () => {
      const [c, g] = lienzo(64, 64), r = rng(9);
      g.fillStyle = "#c9b590"; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? "#bea883" : "#d3c19d"; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1); }
      for (let i = 0; i < 6; i++) { g.fillStyle = "#b29c77"; const x = Math.floor(r() * 60), y = Math.floor(r() * 60); g.fillRect(x, y, 3, 1); g.fillRect(x + 2, y + 1, 2, 1); }
      return textura(c, [8, 2]);
    }),
    libros: (semilla = 4, filas = 4) => guardada("libros" + semilla + filas, () => {
      const W = 72, H = filas * 26 + 4, [c, g] = lienzo(W, H), r = rng(semilla);
      const colores = ["#8e2f2f", "#2f4f7a", "#b88a2e", "#3f6b3a", "#5d3a78", "#a0522d", "#2f6b6b", "#7a2f52", "#c9b48a"];
      g.fillStyle = "#3a2516"; g.fillRect(0, 0, W, H);
      for (let f = 0; f < filas; f++) {
        const y0 = 2 + f * 26;
        g.fillStyle = "#1e130b"; g.fillRect(2, y0, W - 4, 22);
        let x = 3;
        while (x < W - 5) {
          if (r() < 0.08) { x += 4 + Math.floor(r() * 5); continue; }
          const w = 3 + Math.floor(r() * 3), h = 13 + Math.floor(r() * 8), col = colores[Math.floor(r() * colores.length)];
          if (r() < 0.1 && x + h < W - 4) {   // un libro tumbado
            g.fillStyle = col; g.fillRect(x, y0 + 22 - w, h, w); g.fillStyle = tono("#000000", 0); x += h + 1; continue;
          }
          g.fillStyle = col; g.fillRect(x, y0 + 22 - h, w, h);
          g.fillStyle = "rgba(255,240,200,.35)"; g.fillRect(x, y0 + 22 - h + 3, w, 1); g.fillRect(x, y0 + 20, w, 1);
          g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x + w - 1, y0 + 22 - h, 1, h);
          x += w + (r() < 0.2 ? 1 : 0);
        }
        g.fillStyle = "#6b4a2f"; g.fillRect(0, y0 + 22, W, 3);
        g.fillStyle = "#8d6a45"; g.fillRect(0, y0 + 22, W, 1);
      }
      g.fillStyle = "#5d3f27"; g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H); g.fillRect(0, 0, W, 2);
      return textura(c);
    }),
    alfombra: () => guardada("alfombra", () => {
      const [c, g] = lienzo(96, 52);
      g.fillStyle = "#6e2632"; g.fillRect(0, 0, 96, 52);
      g.fillStyle = "#d4a24a"; g.fillRect(3, 3, 90, 2); g.fillRect(3, 47, 90, 2); g.fillRect(3, 3, 2, 46); g.fillRect(91, 3, 2, 46);
      g.fillStyle = "#4a1820"; g.fillRect(7, 7, 82, 38);
      g.fillStyle = "#8c3442"; g.fillRect(9, 9, 78, 34);
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? "#d4a24a" : "#2f4f6b"; g.fillRect(12 + i * 8, 11, 4, 2); g.fillRect(12 + i * 8, 39, 4, 2); }
      // Medallón central
      g.fillStyle = "#d4a24a"; g.fillRect(40, 20, 16, 12); g.fillStyle = "#2f4f6b"; g.fillRect(43, 23, 10, 6); g.fillStyle = "#d4a24a"; g.fillRect(46, 25, 4, 2);
      g.fillStyle = "#d4a24a"; g.fillRect(30, 25, 8, 2); g.fillRect(58, 25, 8, 2);
      for (let i = 0; i < 12; i++) { g.fillStyle = "#e8d0a0"; g.fillRect(i * 8 + 2, 0, 2, 2); g.fillRect(i * 8 + 2, 50, 2, 2); }
      return textura(c);
    }),
    corcho: () => guardada("corcho", () => {
      const [c, g] = lienzo(64, 40), r = rng(17);
      g.fillStyle = "#a8774a"; g.fillRect(0, 0, 64, 40);
      for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? "#96683e" : "#b98a5a"; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 40), 1, 1); }
      // Notas clavadas
      [[6, 26, "#efe3c2"], [50, 4, "#f2ead2"], [54, 24, "#e9d8a8"]].forEach(([x, y, col]) => {
        g.fillStyle = col; g.fillRect(x, y, 9, 10);
        g.fillStyle = "#8a7a5a"; for (let k = 0; k < 3; k++) g.fillRect(x + 1, y + 3 + k * 2, 6, 1);
        g.fillStyle = "#c0392b"; g.fillRect(x + 4, y, 2, 2);
      });
      return textura(c);
    }),
    mapa: () => guardada("mapa", () => {
      const [c, g] = lienzo(56, 38), r = rng(31);
      g.fillStyle = "#e3cf9f"; g.fillRect(0, 0, 56, 38);
      g.fillStyle = "#cdb47e"; for (let i = 0; i < 90; i++) g.fillRect(Math.floor(r() * 56), Math.floor(r() * 38), 1, 1);
      g.fillStyle = "#8fb0b8"; g.fillRect(0, 0, 56, 6); g.fillRect(0, 30, 14, 8); g.fillRect(44, 24, 12, 14);
      g.fillStyle = "#b59a68";
      [[8, 10, 14, 8], [20, 8, 10, 14], [30, 14, 14, 10], [14, 20, 10, 8], [38, 8, 8, 6]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
      g.fillStyle = "#6f8f4a"; [[22, 12], [26, 16], [34, 16], [16, 22]].forEach(([x, y]) => { g.fillRect(x, y, 3, 2); g.fillRect(x + 1, y - 1, 1, 1); });
      g.fillStyle = "#7a5a3a"; [[32, 10], [36, 20], [12, 12]].forEach(([x, y]) => { g.fillRect(x, y, 3, 3); g.fillRect(x + 1, y - 1, 1, 1); });
      g.fillStyle = "#9a2f2f"; for (let i = 0; i < 9; i++) g.fillRect(12 + i * 3, 26 - (i % 3), 2, 1);
      g.fillStyle = "#9a2f2f"; g.fillRect(40, 18, 3, 3);
      g.fillStyle = "#8a6a40"; g.fillRect(0, 0, 56, 1); g.fillRect(0, 37, 56, 1); g.fillRect(0, 0, 1, 38); g.fillRect(55, 0, 1, 38);
      return textura(c);
    }),
    fieltro: (col = "#1f5a3a") => guardada("fieltro" + col, () => {
      const [c, g] = lienzo(32, 32), r = rng(7);
      g.fillStyle = col; g.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 60; i++) { g.fillStyle = tono(col, (r() - 0.5) * 24); g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1, 1); }
      return textura(c);
    }),
    toldo: () => guardada("toldo", () => {
      const [c, g] = lienzo(32, 16);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#e9dcc0" : "#b83a2e"; g.fillRect(i * 4, 0, 4, 16); }
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 13, 32, 3);
      return textura(c);
    }),
    plana: col => guardada("plana" + col, () => { const [c, g] = lienzo(4, 4); g.fillStyle = col; g.fillRect(0, 0, 4, 4); return textura(c); }),
    puerta: (base = "#6b4425", ventanita = false) => guardada("puerta" + base + ventanita, () => {
      const [c, g] = lienzo(32, 64);
      pintarTablones(g, 32, 64, base, 8, 44);
      g.save(); g.translate(32, 0); g.rotate(Math.PI / 2); g.restore();
      // Tablas verticales encima de los tablones y herrajes
      for (let x = 0; x < 32; x += 8) { g.fillStyle = tono(base, (x % 16) ? -10 : 6); g.fillRect(x, 0, 8, 64); g.fillStyle = tono(base, -40); g.fillRect(x + 7, 0, 1, 64); }
      g.fillStyle = "#2b2b33"; g.fillRect(0, 12, 32, 3); g.fillRect(0, 48, 32, 3);
      g.fillStyle = "#55556a"; g.fillRect(2, 12, 2, 1); g.fillRect(28, 49, 2, 1);
      g.fillStyle = "#d4a24a"; g.fillRect(25, 32, 3, 3);
      if (ventanita) { g.fillStyle = "#1a1626"; g.fillRect(10, 6, 12, 10); g.fillStyle = "#f0c070"; g.fillRect(11, 7, 10, 8); g.fillStyle = "#2b2b33"; g.fillRect(15, 6, 2, 10); g.fillRect(10, 10, 12, 2); }
      return textura(c);
    }),
    barril: () => guardada("barril", () => {
      const [c, g] = lienzo(32, 32);
      for (let x = 0; x < 32; x += 4) { g.fillStyle = x % 8 ? "#7a5030" : "#6b4428"; g.fillRect(x, 0, 4, 32); g.fillStyle = "#4a2e1a"; g.fillRect(x + 3, 0, 1, 32); }
      g.fillStyle = "#3a3a44"; g.fillRect(0, 5, 32, 3); g.fillRect(0, 24, 32, 3);
      g.fillStyle = "#6a6a78"; g.fillRect(0, 5, 32, 1); g.fillRect(0, 24, 32, 1);
      return textura(c);
    }),
    caja: () => guardada("caja", () => {
      const [c, g] = lienzo(32, 32);
      g.fillStyle = "#8a6238"; g.fillRect(0, 0, 32, 32);
      for (let y = 0; y < 32; y += 8) { g.fillStyle = "#6b4a2a"; g.fillRect(0, y + 7, 32, 1); }
      g.fillStyle = "#5a3c22"; g.fillRect(0, 0, 32, 3); g.fillRect(0, 29, 32, 3); g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32);
      for (let i = 0; i < 26; i++) g.fillRect(3 + i, 3 + i, 2, 1);
      return textura(c);
    })
  };

  /* Sprites 2D dibujados aquí (planta, gato, velas, cartas, llama) */
  const S = {
    planta: () => guardada("sp-planta", () => {
      const [c, g] = lienzo(24, 32), r = rng(23);
      g.fillStyle = "#8a4b2e"; g.fillRect(6, 22, 12, 10); g.fillStyle = "#a85d3a"; g.fillRect(6, 22, 12, 2); g.fillStyle = "#6b3a24"; g.fillRect(16, 24, 2, 8);
      for (let i = 0; i < 26; i++) {
        const x = 3 + Math.floor(r() * 18), y = 2 + Math.floor(r() * 20);
        g.fillStyle = r() < 0.5 ? "#3f7a3a" : r() < 0.5 ? "#4f9a46" : "#2f5a2c"; g.fillRect(x, y, 3, 2);
      }
      g.fillStyle = "#2f5a2c"; g.fillRect(11, 12, 2, 10);
      return textura(c);
    }),
    gato: fase => guardada("sp-gato" + fase, () => {
      const [c, g] = lienzo(24, 12);
      const cuerpo = "#3a3340", claro = "#5a5064";
      g.fillStyle = cuerpo; g.fillRect(4, 4 - fase, 14, 7 + fase); g.fillRect(2, 8, 4, 3); g.fillRect(16, 2, 6, 6);
      g.fillStyle = cuerpo; g.fillRect(16, 0, 2, 2); g.fillRect(20, 0, 2, 2);
      g.fillStyle = claro; g.fillRect(5, 5 - fase, 10, 1);
      g.fillStyle = "#e8b84a"; g.fillRect(18, 4, 1, 1); g.fillRect(20, 4, 1, 1);
      g.fillStyle = cuerpo; g.fillRect(0, 9, 4, 2);
      return textura(c);
    }),
    carta: (col = "#efe3c2") => guardada("sp-carta" + col, () => {
      const [c, g] = lienzo(6, 8);
      g.fillStyle = col; g.fillRect(0, 0, 6, 8); g.fillStyle = "#8a2f2f"; g.fillRect(1, 1, 4, 6); g.fillStyle = "#d4a24a"; g.fillRect(2, 3, 2, 2);
      return textura(c);
    }),
    papel: () => guardada("sp-papel", () => {
      const [c, g] = lienzo(10, 12);
      g.fillStyle = "#efe3c2"; g.fillRect(0, 0, 10, 12); g.fillStyle = "#8a7a5a"; for (let k = 0; k < 4; k++) g.fillRect(1, 2 + k * 2, 7 - (k % 2) * 2, 1);
      return textura(c);
    }),
    libroAbierto: () => guardada("sp-libroab", () => {
      const [c, g] = lienzo(16, 10);
      g.fillStyle = "#5a2a2a"; g.fillRect(0, 0, 16, 10); g.fillStyle = "#efe3c2"; g.fillRect(1, 1, 6, 8); g.fillRect(9, 1, 6, 8);
      g.fillStyle = "#8a7a5a"; for (let k = 0; k < 3; k++) { g.fillRect(2, 2 + k * 2, 4, 1); g.fillRect(10, 2 + k * 2, 4, 1); }
      return textura(c);
    }),
    espadas: () => guardada("sp-espadas", () => {
      const [c, g] = lienzo(32, 32);
      const hoja = (x0, dir) => { for (let i = 0; i < 22; i++) { g.fillStyle = "#c8ccd8"; g.fillRect(x0 + i * dir, 4 + i, 2, 2); g.fillStyle = "#8a8ea0"; g.fillRect(x0 + i * dir + 1, 5 + i, 1, 1); } };
      hoja(4, 1); hoja(26, -1);
      g.fillStyle = "#d4a24a"; g.fillRect(22, 22, 6, 2); g.fillRect(4, 22, 6, 2);
      g.fillStyle = "#5a3a22"; g.fillRect(26, 24, 2, 5); g.fillRect(4, 24, 2, 5);
      g.fillStyle = "#7a2f2f"; g.fillRect(10, 8, 12, 14); g.fillStyle = "#d4a24a"; g.fillRect(10, 8, 12, 2); g.fillRect(15, 10, 2, 12);
      return textura(c);
    }),
    diana: () => guardada("sp-diana", () => {
      const [c, g] = lienzo(20, 20);
      [[10, "#2a1f18"], [9, "#e9dcc0"], [7, "#b83a2e"], [5, "#e9dcc0"], [3, "#b83a2e"], [1, "#2a1f18"]].forEach(([rad, col]) => {
        g.fillStyle = col; for (let y = -rad; y < rad; y++) for (let x = -rad; x < rad; x++) if (x * x + y * y < rad * rad) g.fillRect(10 + x, 10 + y, 1, 1);
      });
      g.fillStyle = "#d4a24a"; g.fillRect(12, 7, 6, 1); g.fillRect(13, 11, 5, 1);
      return textura(c);
    })
  };

  /* ---------------------------------------------------------------- más superficies para las otras salas */
  Object.assign(T, {
    losas: (base = "#6a6470", rep = [10, 6]) => guardada("losas" + base + rep, () => {
      const [c, g] = lienzo(64, 64), r = rng(41);
      g.fillStyle = tono(base, -40); g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) {
        const s = (r() - 0.5) * 22;
        g.fillStyle = tono(base, s); g.fillRect(x + 1, y + 1, 14, 14);
        g.fillStyle = tono(base, s + 14); g.fillRect(x + 1, y + 1, 14, 1);
        if (r() < 0.3) { g.fillStyle = tono(base, s - 18); g.fillRect(x + 4 + Math.floor(r() * 8), y + 5 + Math.floor(r() * 6), 3, 1); }
      }
      return textura(c, rep);
    }),
    ajedrezSuelo: (a = "#d9cdb0", b = "#2a2230", rep = [7, 4]) => guardada("ajs" + a + b + rep, () => {
      const [c, g] = lienzo(32, 32);
      [[0, 0, a], [16, 0, b], [0, 16, b], [16, 16, a]].forEach(([x, y, col]) => { g.fillStyle = col; g.fillRect(x, y, 16, 16); g.fillStyle = tono(col.length === 7 ? col : "#000000", 12); g.fillRect(x, y, 16, 1); });
      return textura(c, rep);
    }),
    moqueta: (fondo = "#3a1a4a", dibujo = "#6a2f7a", rep = [8, 5]) => guardada("moq" + fondo + dibujo + rep, () => {
      const [c, g] = lienzo(32, 32);
      g.fillStyle = fondo; g.fillRect(0, 0, 32, 32);
      g.fillStyle = dibujo;
      [[4, 4], [20, 20]].forEach(([x, y]) => { g.fillRect(x + 3, y, 2, 8); g.fillRect(x, y + 3, 8, 2); g.fillRect(x + 2, y + 2, 4, 4); });
      g.fillStyle = tono(dibujo, 40); g.fillRect(7, 7, 2, 2); g.fillRect(23, 23, 2, 2);
      g.fillStyle = tono(fondo, -14); [[20, 4], [4, 20]].forEach(([x, y]) => g.fillRect(x + 2, y + 2, 4, 4));
      return textura(c, rep);
    }),
    papel: (base = "#4a2f3a", raya = "#5a3a48", rep = [9, 2]) => guardada("papel" + base + raya + rep, () => {
      const [c, g] = lienzo(32, 32);
      g.fillStyle = base; g.fillRect(0, 0, 32, 32);
      g.fillStyle = raya; g.fillRect(0, 0, 6, 32); g.fillRect(16, 0, 6, 32);
      g.fillStyle = tono(raya, 30); for (let y = 4; y < 32; y += 10) { g.fillRect(9, y, 4, 4); g.fillRect(25, y + 5, 4, 4); g.fillRect(10, y - 1, 2, 6); }
      return textura(c, rep);
    }),
    tierra: (rep = [10, 6]) => guardada("tierra" + rep, () => {
      const [c, g] = lienzo(64, 64), r = rng(53);
      g.fillStyle = "#6b5236"; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 420; i++) { g.fillStyle = ["#5a4430", "#7a5f40", "#8a7048", "#c9a95a"][Math.floor(r() * (i % 9 ? 3 : 4))]; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1); }
      for (let i = 0; i < 18; i++) { g.fillStyle = "#c9a95a"; const x = Math.floor(r() * 62), y = Math.floor(r() * 62); g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 2, 1); }
      return textura(c, rep);
    }),
    heno: () => guardada("heno", () => {
      const [c, g] = lienzo(32, 24), r = rng(61);
      g.fillStyle = "#c9a14a"; g.fillRect(0, 0, 32, 24);
      for (let i = 0; i < 120; i++) { g.fillStyle = r() < 0.5 ? "#b08a38" : "#e0c070"; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 24), 3, 1); }
      g.fillStyle = "#7a5a2a"; g.fillRect(9, 0, 2, 24); g.fillRect(21, 0, 2, 24);
      return textura(c);
    }),
    botellas: () => guardada("botellas", () => {
      const [c, g] = lienzo(96, 64), r = rng(71);
      g.fillStyle = "#3a2516"; g.fillRect(0, 0, 96, 64);
      const cols = ["#2f6b3a", "#7a2f2f", "#c9a14a", "#3b4a8a", "#8a5a2a", "#d9d0b8", "#5a2f6a"];
      for (let f = 0; f < 3; f++) {
        const y0 = 4 + f * 20;
        g.fillStyle = "#1e130b"; g.fillRect(2, y0, 92, 16);
        let x = 4;
        while (x < 90) {
          const col = cols[Math.floor(r() * cols.length)], alto = 9 + Math.floor(r() * 5);
          if (r() < 0.25) { g.fillStyle = "#c9a14a"; g.fillRect(x, y0 + 16 - 6, 5, 6); g.fillStyle = "#fff1b0"; g.fillRect(x, y0 + 16 - 7, 5, 1); x += 7; continue; }
          g.fillStyle = col; g.fillRect(x, y0 + 16 - alto, 4, alto); g.fillRect(x + 1, y0 + 16 - alto - 3, 2, 3);
          g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y0 + 16 - alto + 1, 1, alto - 3);
          x += 5 + Math.floor(r() * 3);
        }
        g.fillStyle = "#6b4a2f"; g.fillRect(0, y0 + 16, 96, 3); g.fillStyle = "#8d6a45"; g.fillRect(0, y0 + 16, 96, 1);
      }
      return textura(c);
    }),
    pizarra: (lineas = 6, col = "#2a3a30") => guardada("pizarra" + lineas + col, () => {
      const [c, g] = lienzo(48, 32), r = rng(83);
      g.fillStyle = col; g.fillRect(0, 0, 48, 32);
      g.fillStyle = "#d9d0b8"; for (let i = 0; i < lineas; i++) { const w = 12 + Math.floor(r() * 26); g.fillRect(4, 4 + i * 4, w, 1); g.fillRect(38, 4 + i * 4, 6, 1); }
      g.fillStyle = "#6b4a2f"; g.fillRect(0, 0, 48, 2); g.fillRect(0, 30, 48, 2); g.fillRect(0, 0, 2, 32); g.fillRect(46, 0, 2, 32);
      return textura(c);
    }),
    rejillaMapa: () => guardada("rejillaMapa", () => {
      const [c, g] = lienzo(64, 40), r = rng(97);
      g.fillStyle = "#4a7a52"; g.fillRect(0, 0, 64, 40);
      g.fillStyle = "#5a8a5a"; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(r() * 64), Math.floor(r() * 40), 2, 1);
      g.fillStyle = "#7a5a3a"; g.fillRect(20, 6, 18, 10); g.fillStyle = "#3f6fa0"; g.fillRect(44, 22, 14, 10); g.fillRect(40, 26, 6, 6);
      g.fillStyle = "#2f5a34"; [[6, 26], [10, 30], [8, 20]].forEach(([x, y]) => g.fillRect(x, y, 4, 4));
      g.fillStyle = "rgba(20,40,24,.6)"; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 40); for (let y = 0; y < 40; y += 8) g.fillRect(0, y, 64, 1);
      return textura(c);
    }),
    tapiz: (col = "#7a2f4a", palo = "♠") => guardada("tapiz" + col + palo, () => {
      const [c, g] = lienzo(20, 32);
      g.fillStyle = col; g.fillRect(0, 0, 20, 28);
      g.fillStyle = "#d4a24a"; g.fillRect(0, 0, 20, 2); g.fillRect(1, 2, 1, 26); g.fillRect(18, 2, 1, 26);
      for (let i = 0; i < 5; i++) { g.fillStyle = col; g.fillRect(i * 4, 28, 3, 3); }
      g.fillStyle = "#f2e6cc"; g.font = "bold 12px monospace"; g.textAlign = "center"; g.fillText(palo, 10, 19);
      return textura(c);
    }),
    letrero: (texto, fondo = "#120d2a", tinta = "#ff7ac0", w = 96, h = 20) => guardada("let" + texto + fondo + tinta + w, () => {
      const [c, g] = lienzo(w, h);
      g.fillStyle = fondo; g.fillRect(0, 0, w, h);
      g.fillStyle = tinta; g.font = `bold ${h - 8}px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(texto, w / 2, h / 2 + 1);
      return textura(c);
    })
  });

  /* Iconos de 12x12 para distinguir los estantes de la biblioteca y otros objetos */
  const ICONOS = {
    reloj: [["#d4a24a", [[3, 1, 6, 1], [3, 10, 6, 1]]], ["#e9dcc0", [[4, 2, 4, 2], [5, 4, 2, 1], [5, 7, 2, 1], [4, 8, 4, 2]]], ["#c9a14a", [[5, 8, 2, 1]]]],
    mapa: [["#e3cf9f", [[1, 2, 10, 8]]], ["#6f8f4a", [[3, 4, 3, 2], [7, 6, 2, 2]]], ["#9a2f2f", [[8, 3, 1, 1], [4, 7, 1, 1]]]],
    estandarte: [["#8d6a45", [[2, 1, 1, 10]]], ["#b6453f", [[3, 1, 7, 5], [3, 6, 3, 2]]], ["#d4a24a", [[5, 3, 2, 1]]]],
    corona: [["#e8b84a", [[2, 5, 8, 4], [2, 3, 1, 2], [5, 2, 2, 3], [9, 3, 1, 2]]], ["#b6453f", [[5, 6, 2, 2]]]],
    arbol: [["#3f7a3a", [[3, 1, 6, 6], [2, 3, 8, 3]]], ["#6b4a2f", [[5, 7, 2, 4]]]],
    sol: [["#f2c14e", [[4, 4, 4, 4], [5, 1, 2, 2], [5, 9, 2, 2], [1, 5, 2, 2], [9, 5, 2, 2]]]],
    pluma: [["#e9dcc0", [[7, 1, 2, 2], [6, 3, 2, 2], [5, 5, 2, 2]]], ["#2a2030", [[3, 8, 3, 2], [2, 10, 2, 1]]]],
    pergamino: [["#e3cf9f", [[2, 2, 8, 8]]], ["#b59a68", [[1, 2, 1, 8], [10, 2, 1, 8]]], ["#8a7a5a", [[3, 4, 6, 1], [3, 6, 5, 1]]]],
    espada: [["#c8ccd8", [[5, 1, 2, 7]]], ["#d4a24a", [[3, 8, 6, 1]]], ["#6b4a2f", [[5, 9, 2, 2]]]],
    cofre: [["#8d6a45", [[1, 4, 10, 6]]], ["#6b4a2f", [[1, 3, 10, 2]]], ["#d4a24a", [[5, 5, 2, 2]]]],
    calavera: [["#e9dcc0", [[3, 2, 6, 6], [4, 8, 4, 2]]], ["#1c1422", [[4, 4, 1, 2], [7, 4, 1, 2], [5, 9, 1, 1]]]],
    balanza: [["#d4a24a", [[5, 1, 2, 9], [1, 3, 10, 1], [3, 9, 6, 1]]], ["#c9a14a", [[1, 4, 3, 2], [8, 4, 3, 2]]]],
    moneda: [["#e8b84a", [[3, 3, 6, 6], [2, 4, 8, 4]]], ["#b08a38", [[5, 4, 2, 4]]]],
    dado: [["#f2ead2", [[2, 2, 8, 8]]], ["#b6453f", [[3, 3, 2, 2], [7, 7, 2, 2], [5, 5, 2, 2]]]],
    gente: [["#e0b890", [[2, 2, 3, 3], [7, 2, 3, 3]]], ["#4f7fb5", [[1, 5, 5, 5]]], ["#7a2f4a", [[6, 5, 5, 5]]]],
    libro: [["#7a2f2f", [[2, 2, 8, 8]]], ["#efe3c2", [[3, 3, 6, 6]]], ["#8a7a5a", [[4, 4, 4, 1], [4, 6, 3, 1]]]]
  };
  S.icono = nombre => guardada("ico-" + nombre, () => {
    const [c, g] = lienzo(12, 12);
    (ICONOS[nombre] || ICONOS.libro).forEach(([col, rs]) => { g.fillStyle = col; rs.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h)); });
    return textura(c);
  });

  /* Gente dibujada aquí: el tabernero (dos cuadros: secando una jarra) y Cera, la crupier de cera */
  S.tabernero = fase => guardada("sp-tab" + fase, () => {
    const [c, g] = lienzo(32, 48);
    const piel = "#e0b890", pelo = "#5a3a22";
    g.fillStyle = "#4a2f1c"; g.fillRect(9, 20, 14, 20);
    g.fillStyle = "#e9dcc0"; g.fillRect(11, 24, 10, 20);
    g.fillStyle = "#c9b08a"; g.fillRect(11, 24, 10, 1);
    g.fillStyle = piel; g.fillRect(11, 6, 10, 12); g.fillRect(14, 18, 4, 2);
    g.fillStyle = pelo; g.fillRect(10, 4, 12, 4); g.fillRect(10, 8, 2, 4); g.fillRect(20, 8, 2, 4);
    g.fillStyle = "#1c1422"; g.fillRect(13, 11, 2, 2); g.fillRect(18, 11, 2, 2);
    g.fillStyle = pelo; g.fillRect(12, 15, 8, 2); g.fillRect(11, 16, 2, 2); g.fillRect(19, 16, 2, 2);
    // Brazos: con la jarra y el trapo
    g.fillStyle = "#4a2f1c"; g.fillRect(5, 22, 4, 10); g.fillRect(23, 22, 4, 10);
    g.fillStyle = piel; g.fillRect(5, 31, 4, 3); g.fillRect(23, 31 - fase * 3, 4, 3);
    g.fillStyle = "#c9a14a"; g.fillRect(22, 27 - fase * 3, 6, 5); g.fillStyle = "#fff1b0"; g.fillRect(22, 26 - fase * 3, 6, 1);
    g.fillStyle = "#e9dcc0"; g.fillRect(4, 33, 6, 3);
    g.fillStyle = "#3a2a2a"; g.fillRect(11, 44, 4, 4); g.fillRect(17, 44, 4, 4);
    return textura(c);
  });
  S.cera = fase => guardada("sp-cera" + fase, () => {
    const [c, g] = lienzo(32, 48);
    g.fillStyle = "#efe3c3"; g.fillRect(8, 18, 16, 30); g.fillRect(10, 4, 12, 14);
    g.fillStyle = "#fff6dc"; g.fillRect(8, 18, 16, 2); g.fillRect(10, 4, 12, 2);
    g.fillStyle = "#d9cba5"; g.fillRect(8, 44, 16, 4); g.fillRect(12, 18, 1, 8 + fase); g.fillRect(19, 18, 1, 5);
    g.fillStyle = "#3a2a2a"; g.fillRect(13, 9, 2, 2); g.fillRect(18, 9, 2, 2);
    g.fillStyle = "#a8434f"; g.fillRect(14, 14, 4, 1);
    g.fillStyle = "#f2ead2"; g.fillRect(15, 0, 2, 4); g.fillStyle = fase ? "#ffd27a" : "#f0b038"; g.fillRect(15, -1, 2, 2);
    g.fillStyle = "#7a2f4a"; g.fillRect(8, 26, 16, 3);
    return textura(c);
  });
  S.llamita = fase => guardada("sp-llama" + fase, () => {
    const [c, g] = lienzo(4, 6);
    g.fillStyle = "#f0b038"; g.fillRect(1, 1 + fase, 2, 5 - fase); g.fillStyle = "#fff1b0"; g.fillRect(1, 3, 1, 2);
    return textura(c);
  });

  return { T, S, lienzo, textura, tono, rng };
}
