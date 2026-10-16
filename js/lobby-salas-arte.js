/* =============================================================================
   EL DIBUJO DE LAS SALAS DE LA TABERNA (lo usa js/lobby-salas.js)
   Cada sala es una escena con fondo, profundidad, ambiente y movimiento, no una fila de objetos:
     biblioteca  estanterías por grupos con una pieza distinta en cada una, mesa de lectura, escalera, farolillos, gato dormido
     juegos      sala de máquinas con neón: arcades en la pared, tiro con arco, ajedrez, mesa de cartas y el rincón de los juegos escondidos
     establos    exterior con el cielo real (hora y clima), grada, pista con corredores, pantalla del directo y corral con animales
     despacho    oficina con ventana al cielo real (solo admin)
   Cada función recibe el mapa de enlaces de su sala y si quien mira es admin, y devuelve el SVG (1280 x 700).
============================================================================= */
window.LobbySalasArte = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = (x, y, w, h, f, ex) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${ex || ""}/>`;
  const C = (cx, cy, r, f, ex) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex || ""}/>`;
  const P = (pts, f, ex) => `<polygon points="${pts}" fill="${f}"${ex || ""}/>`;
  const semilla = t => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 997; return h; };

  /* Un enlace dentro de la escena: el cuerpo se ilumina al pasar el ratón y el nombre sale en la capa de arriba (js/lobby-salas.js) */
  function enlace(href, nombre, cuerpo, etq, admin) {
    return `<a class="lb-spot" href="${esc(href)}" aria-label="${esc(nombre)}"${admin ? " data-admin-only" : ""}><g class="lb-forma">${cuerpo}</g><text x="${etq[0]}" y="${etq[1]}" text-anchor="middle" class="lb-etq">${esc(nombre)}</text></a>`;
  }
  const puertaTaberna = (x, y) => enlace("#taberna", "Volver a la taberna",
    R(x, y, 72, 148, "#4a2f1f") + R(x + 8, y + 8, 56, 140, "#6b4a2f") + R(x + 14, y + 16, 44, 56, "#5a3d28") + R(x + 14, y + 80, 44, 60, "#5a3d28") + R(x + 52, y + 82, 6, 6, "#e8b84a") +
    R(x + 4, y - 14, 64, 14, "#3b4a8a") + R(x + 10, y - 10, 52, 6, "#e8b84a"), [x + 36, y + 170]);

  const pared = (id, base, juntas) => `<pattern id="${id}" width="64" height="32" patternUnits="userSpaceOnUse">${R(0, 0, 64, 32, base)}${R(0, 0, 64, 2, juntas)}${R(0, 16, 64, 2, juntas)}${R(0, 0, 2, 16, juntas)}${R(32, 16, 2, 16, juntas)}</pattern>`;
  const tablones = (id, base, juntas) => `<pattern id="${id}" width="96" height="30" patternUnits="userSpaceOnUse">${R(0, 0, 96, 30, base)}${R(0, 0, 96, 2, juntas)}${R(0, 15, 96, 2, juntas)}${R(30, 2, 2, 13, juntas)}${R(70, 17, 2, 13, juntas)}</pattern>`;
  const polvo = (n, x0, y0, w, h) => Array.from({ length: n }, (_, i) => R(Math.round(x0 + ((i * 97) % 89) / 89 * w), Math.round(y0 + ((i * 53) % 71) / 71 * h), 2, 2, "#fff1b0", ` class="lb-mota" style="animation-delay:${-i * 0.9}s;animation-duration:${7 + (i % 4) * 2}s"`)).join("");

  /* ============================================================ BIBLIOTECA */
  function lomos(x0, x1, base, sem, paleta, hmin, hmax) {
    let s = "", x = x0, i = 0;
    while (x < x1 - 4) {
      const w = 5 + ((sem + i * 7) % 5), h = hmin + ((sem * 3 + i * 5) % (hmax - hmin + 1));
      s += R(x, base - h, Math.min(w, x1 - x), h, paleta[(sem + i * 3) % paleta.length]);
      if ((sem + i) % 5 === 0) s += R(x + 1, base - h + 4, Math.max(1, Math.min(w, x1 - x) - 2), 2, "#e8b84a", ' opacity=".7"');
      x += w + 1; i++;
    }
    return s;
  }
  // Una pieza distinta sobre la balda de cada sección (40 x 44, apoyada en y + 44)
  const PIEZAS = {
    "Cronología": (x, y) => { let s = R(x + 6, y, 28, 4, "#8d6a45") + R(x + 6, y + 40, 28, 4, "#8d6a45") + R(x + 8, y + 4, 2, 36, "#6b4a2f") + R(x + 30, y + 4, 2, 36, "#6b4a2f"); for (let i = 0; i < 6; i++) { s += R(x + 11 + i * 2, y + 5 + i * 3, 18 - i * 4, 3, "#cfd8ff") + R(x + 11 + i * 2, y + 35 - i * 3, 18 - i * 4, 3, "#cfd8ff"); } return s + R(x + 17, y + 30, 6, 6, "#e8b84a") + R(x + 19, y + 17, 2, 14, "#e8b84a"); },
    "Lugares": (x, y) => C(x + 20, y + 20, 15, "#3f7fb5") + R(x + 11, y + 12, 9, 7, "#6fa86b") + R(x + 21, y + 22, 10, 8, "#6fa86b") + R(x + 5, y + 18, 30, 2, "#c9a14a", ' opacity=".8"') + R(x + 18, y + 35, 4, 5, "#8d6a45") + R(x + 10, y + 40, 20, 4, "#6b4a2f"),
    "Facciones": (x, y) => R(x + 8, y, 3, 44, "#8d8d99") + R(x + 11, y + 2, 24, 16, "#b6453f") + R(x + 11, y + 9, 24, 4, "#e8b84a") + R(x + 14, y + 22, 18, 12, "#3b4a8a") + R(x + 14, y + 26, 18, 3, "#e9dcc0"),
    "Personajes": (x, y) => R(x + 4, y + 2, 32, 40, "#8d6a45") + R(x + 8, y + 6, 24, 32, "#2a1d14") + C(x + 20, y + 18, 7, "#e0b890") + R(x + 12, y + 26, 16, 12, "#3b4a8a") + R(x + 16, y + 12, 8, 4, "#6b4a2f"),
    "Razas": (x, y) => R(x + 3, y + 8, 16, 24, "#e9dcc0") + R(x + 6, y + 15, 4, 4, "#1c1422") + R(x + 13, y + 15, 4, 4, "#1c1422") + R(x + 8, y + 25, 8, 2, "#1c1422") + R(x + 22, y + 14, 16, 24, "#4f7fb5") + R(x + 25, y + 21, 4, 4, "#1c1422") + R(x + 32, y + 21, 4, 4, "#1c1422") + R(x + 27, y + 31, 8, 2, "#1c1422") + P(`${x + 22},${y + 14} ${x + 26},${y + 6} ${x + 30},${y + 14}`, "#4f7fb5"),
    "Religión": (x, y) => R(x + 4, y + 26, 8, 18, "#f2ead2") + R(x + 6, y + 16, 4, 10, "#f0b038", ' class="lb-llama"') + C(x + 28, y + 18, 9, "#e8b84a") + R(x + 26, y + 4, 4, 6, "#e8b84a") + R(x + 26, y + 28, 4, 6, "#e8b84a") + R(x + 14, y + 16, 6, 4, "#e8b84a") + R(x + 36, y + 16, 4, 4, "#e8b84a") + R(x + 20, y + 40, 20, 4, "#6b4a2f"),
    "Textos": (x, y) => R(x + 4, y + 28, 14, 14, "#1c1422") + R(x + 6, y + 26, 10, 3, "#3a3550") + P(`${x + 10},${y + 28} ${x + 28},${y + 2} ${x + 31},${y + 5} ${x + 13},${y + 31}`, "#f2ead2") + R(x + 20, y + 32, 20, 10, "#f2ead2") + R(x + 20, y + 32, 2, 10, "#8a3d3d") + R(x + 24, y + 35, 12, 2, "#6b4a2f"),
    "Pergaminos": (x, y) => R(x + 3, y + 14, 10, 30, "#e9d9a0") + R(x + 3, y + 12, 10, 3, "#b6453f") + R(x + 15, y + 8, 10, 36, "#d9c48f") + R(x + 15, y + 6, 10, 3, "#8d6a45") + R(x + 27, y + 16, 10, 28, "#e9d9a0") + R(x + 27, y + 24, 10, 3, "#b6453f"),
    "Armas": (x, y) => P(`${x + 6},${y + 2} ${x + 10},${y + 2} ${x + 28},${y + 30} ${x + 24},${y + 32}`, "#c9cdd6") + P(`${x + 34},${y + 2} ${x + 30},${y + 2} ${x + 12},${y + 30} ${x + 16},${y + 32}`, "#aeb3bf") + R(x + 8, y + 30, 24, 4, "#e8b84a") + R(x + 18, y + 34, 4, 10, "#8d6a45"),
    "Objetos": (x, y) => R(x + 4, y + 18, 18, 26, "#4f9a95") + R(x + 8, y + 10, 10, 10, "#4f9a95") + R(x + 8, y + 6, 10, 5, "#8d6a45") + R(x + 8, y + 24, 10, 8, "#7fd0c8", ' opacity=".5"') + R(x + 24, y + 28, 16, 16, "#8d6a45") + R(x + 24, y + 26, 16, 5, "#6b4a2f") + R(x + 30, y + 32, 4, 4, "#e8b84a"),
    "Bestiario": (x, y) => R(x + 8, y + 10, 24, 22, "#e9dcc0") + R(x + 13, y + 18, 6, 7, "#1c1422") + R(x + 22, y + 18, 6, 7, "#1c1422") + R(x + 12, y + 32, 16, 8, "#e9dcc0") + R(x + 15, y + 34, 2, 6, "#1c1422") + R(x + 23, y + 34, 2, 6, "#1c1422") + P(`${x + 8},${y + 12} ${x + 2},${y + 2} ${x + 12},${y + 8}`, "#c9b08a") + P(`${x + 32},${y + 12} ${x + 38},${y + 2} ${x + 28},${y + 8}`, "#c9b08a"),
    "Reglas": (x, y) => P(`${x + 14},${y + 6} ${x + 26},${y + 6} ${x + 34},${y + 18} ${x + 20},${y + 40} ${x + 6},${y + 18}`, "#b6453f") + R(x + 17, y + 17, 6, 8, "#f2ead2") + R(x + 28, y + 30, 10, 10, "#f2ead2") + R(x + 31, y + 33, 3, 3, "#1c1422") + R(x + 35, y + 36, 2, 2, "#1c1422"),
    "Economía": (x, y) => R(x + 4, y + 36, 20, 6, "#e8b84a") + R(x + 6, y + 30, 20, 6, "#f0c860") + R(x + 4, y + 24, 20, 6, "#e8b84a") + R(x + 26, y + 20, 14, 22, "#6b4a2f") + R(x + 28, y + 16, 10, 6, "#8d6a45") + R(x + 30, y + 28, 6, 6, "#e8b84a"),
    "Estadísticas": (x, y) => R(x + 3, y + 4, 34, 38, "#1c1422") + R(x + 7, y + 28, 6, 10, "#5fe0d2") + R(x + 16, y + 18, 6, 20, "#e8b84a") + R(x + 25, y + 10, 6, 28, "#ff7ac0") + R(x + 5, y + 38, 30, 2, "#8d8d99"),
    // Huecos sin enlace: solo ambiente
    "reloj": (x, y) => R(x + 10, y, 20, 44, "#6b4a2f") + R(x + 8, y, 24, 4, "#8d6a45") + C(x + 20, y + 12, 8, "#f2ead2") + R(x + 19, y + 6, 2, 7, "#1c1422") + R(x + 19, y + 12, 6, 2, "#1c1422") + `<g class="lb-pendulo">${R(x + 19, y + 24, 2, 14, "#c9a14a")}${R(x + 16, y + 36, 8, 6, "#e8b84a")}</g>`,
    "busto": (x, y) => R(x + 8, y + 34, 24, 10, "#9a9aa6") + R(x + 12, y + 26, 16, 10, "#b8b8c4") + C(x + 20, y + 16, 11, "#c9c9d4") + R(x + 14, y + 12, 12, 3, "#9a9aa6"),
    "maceta": (x, y) => R(x + 10, y + 30, 20, 14, "#a8546a") + R(x + 8, y + 28, 24, 4, "#c9707a") + R(x + 18, y + 12, 4, 18, "#3f7a3a") + R(x + 8, y + 12, 12, 6, "#4c8a4f") + R(x + 22, y + 6, 12, 6, "#4c8a4f") + R(x + 12, y + 2, 10, 6, "#6fa86b"),
    "lampara": (x, y) => R(x + 6, y + 38, 26, 6, "#4c8a4f") + R(x + 17, y + 14, 4, 24, "#c9a14a") + R(x + 4, y + 6, 30, 10, "#2f6a4d") + R(x + 8, y + 16, 22, 3, "#fff1b0", ' opacity=".8"') + C(x + 19, y + 24, 22, "#fff1b0", ' fill-opacity=".14" class="lb-brillo"')
  };
  const PALETAS = {
    Mundo: ["#4f7fb5", "#2f5f8a", "#6fa8d8", "#8a5fc2", "#2f8a8a", "#b6453f"],
    Archivo: ["#c9703a", "#a8546a", "#e8b84a", "#4c8a4f", "#8d6a45", "#b6453f"],
    "Reglas y cifras": ["#b6453f", "#e8b84a", "#8a2f3a", "#c9703a", "#4f7fb5", "#2f8a8a"]
  };
  const BANDERA = { Mundo: "#2f4f8a", Archivo: "#2f6a4d", "Reglas y cifras": "#8a2f3a" };
  const HUECOS = { Archivo: ["lampara"], "Reglas y cifras": ["reloj", "busto", "maceta"] };

  function celdaEstante(x, y, nombre, href, pieza, paleta) {
    const sem = semilla(nombre);
    let s = R(x, y, 104, 132, "#1f140d") + R(x, y + 64, 104, 5, "#6a4a30") + R(x, y + 110, 104, 5, "#6a4a30") + R(x, y, 104, 3, "#35241a");
    s += PIEZAS[pieza](x + 8, y + 20);
    s += lomos(x + 52, x + 102, y + 64, sem, paleta, 28, 46);
    s += lomos(x + 3, x + 102, y + 110, sem + 3, paleta, 30, 44);
    s += R(x + 6, y + 117, 92, 12, "#c9a14a") + R(x + 8, y + 119, 88, 8, "#e0bc5a") + `<text x="${x + 52}" y="${y + 126}" text-anchor="middle" class="lb-placa">${esc(nombre)}</text>`;
    return enlace(href, nombre, s, [x + 52, y + 150]);
  }

  function biblioteca(mapa, admin) {
    let s = `<defs>${pared("bibP", "#2a1d14", "#3a281a")}${tablones("bibS", "#4a2f22", "#35221a")}</defs>
      ${R(0, 0, 1280, 404, "url(#bibP)")}${R(0, 404, 1280, 296, "url(#bibS)")}${R(0, 400, 1280, 8, "#1c1422")}${R(0, 0, 1280, 24, "#1c1422")}${R(0, 0, 16, 404, "#1c1422")}${R(1264, 0, 16, 404, "#1c1422")}`;
    // Farolillos entre las estanterías
    s += [486, 874].map((x, i) => `${R(x - 1, 24, 2, 38, "#8d8d99")}${R(x - 10, 62, 20, 26, "#e8b84a")}${R(x - 6, 66, 12, 18, "#fff1b0", ' class="lb-llama lb-l' + (i + 1) + '"')}${C(x, 76, 40, "#fff1b0", ' fill-opacity=".12" class="lb-brillo"')}`).join("");
    // Las tres estanterías grandes, una por grupo, con su banderola
    mapa.grupos.forEach((g, gi) => {
      const bx = 112 + gi * 388, paleta = PALETAS[g.titulo], tapas = HUECOS[g.titulo] || [];
      s += R(bx - 6, 80, 372, 12, "#6a4a30") + R(bx, 86, 360, 316, "#3a2616") + R(bx + 6, 92, 348, 300, "#4a3220") + R(bx - 4, 392, 368, 14, "#2a1a10");
      const piezas = g.enlaces.filter(e => !e[3] || admin).map(e => [e[1], e[0], e[1]]);
      tapas.forEach(t => piezas.push([null, null, t]));
      piezas.slice(0, 6).forEach((p, i) => {
        const cx = bx + 14 + (i % 3) * 112, cy = 100 + Math.floor(i / 3) * 140;
        if (p[0]) s += celdaEstante(cx, cy, p[0], p[1], p[2], paleta);
        else s += R(cx, cy, 104, 132, "#1f140d") + R(cx, cy + 110, 104, 5, "#6a4a30") + PIEZAS[p[2]](cx + 32, cy + 66) + R(cx, cy, 104, 3, "#35241a");
      });
      const col = BANDERA[g.titulo];
      s += R(bx + 110, 36, 140, 34, col) + R(bx + 110, 36, 140, 4, "#e8b84a") + P(`${bx + 110},70 ${bx + 180},86 ${bx + 250},70`, col) + `<text x="${bx + 180}" y="58" text-anchor="middle" class="lb-rotulo">${esc(g.titulo.toUpperCase())}</text>`;
    });
    // Escalera apoyada entre las dos últimas estanterías
    s += R(866, 96, 4, 310, "#8d6a45") + R(884, 96, 4, 310, "#8d6a45") + Array.from({ length: 15 }, (_, i) => R(866, 112 + i * 20, 22, 3, "#a8834f")).join("");
    // Suelo: alfombra, mesa de lectura, sillas, lámparas y el Compendio abierto
    s += R(318, 440, 644, 220, "#2f4a3a", ' opacity=".95"') + R(326, 448, 628, 204, "none", ' stroke="#c9a14a" stroke-width="3" opacity=".7"') + R(338, 460, 604, 180, "none", ' stroke="#c9a14a" stroke-width="1" opacity=".35"');
    [[468, 0], [616, 1], [764, 2]].forEach(([x, i]) => { s += R(x, 428, 56, 64, "#4a2f1f") + R(x + 6, 434, 44, 52, "#6b4a2f") + R(x + 6, 434, 44, 6, "#8a3d3d"); });
    s += R(450, 520, 22, 48, "#4a2f1f") + R(808, 520, 22, 48, "#4a2f1f") + R(430, 494, 420, 28, "#6b4a2f") + R(422, 476, 436, 20, "#8d6a45") + R(422, 476, 436, 4, "#a8834f");
    s += [[476, 1], [804, 2]].map(([x, i]) => `${R(x - 2, 448, 4, 28, "#c9a14a")}${R(x - 16, 438, 32, 12, "#2f6a4d")}${R(x - 12, 450, 24, 3, "#fff1b0", ' opacity=".8"')}${C(x, 470, 52, "#fff1b0", ' fill-opacity=".1" class="lb-brillo' + (i === 2 ? " lb-b2" : "") + '"')}`).join("");
    s += R(540, 466, 24, 8, "#f2ead2", ' transform="rotate(-6 552 470)"') + R(716, 468, 28, 6, "#e9d9a0", ' transform="rotate(5 730 471)"') + R(512, 462, 10, 14, "#1c1422") + P("516,462 530,442 534,445 520,464", "#f2ead2");
    s += enlace("compendio.html", "El Compendio completo",
      R(594, 454, 44, 22, "#f2ead2") + R(642, 454, 44, 22, "#e9dcc0") + R(638, 452, 4, 26, "#8a3d3d") + R(600, 460, 32, 2, "#6b4a2f") + R(600, 466, 26, 2, "#6b4a2f") + R(648, 460, 32, 2, "#6b4a2f") + R(648, 466, 28, 2, "#6b4a2f") + R(592, 474, 96, 4, "#6a4a30"), [640, 440]);
    // Rincón de lectura: sillón, lámpara de pie y un gato dormido
    s += R(1010, 470, 120, 76, "#8a2f3a") + R(1002, 500, 20, 54, "#a8546a") + R(1118, 500, 20, 54, "#a8546a") + R(1020, 520, 100, 30, "#a8546a") + R(1020, 520, 100, 4, "#c9707a") + R(1010, 548, 8, 12, "#4a2f1f") + R(1122, 548, 8, 12, "#4a2f1f");
    s += R(1166, 410, 4, 150, "#8d8d99") + R(1154, 404, 28, 16, "#e8b84a") + R(1158, 408, 20, 8, "#fff1b0", ' class="lb-llama"') + C(1168, 420, 44, "#fff1b0", ' fill-opacity=".1" class="lb-brillo"') + R(1156, 556, 24, 6, "#6b4a2f");
    s += `<g class="lb-gato">${R(1030, 590, 46, 18, "#c9703a")}${R(1068, 582, 18, 16, "#c9703a")}${P("1070,582 1074,574 1078,582", "#c9703a")}${P("1080,582 1084,574 1086,584", "#c9703a")}${R(1026, 594, 8, 12, "#a85a2a")}${R(1042, 590, 4, 18, "#a85a2a", ' opacity=".6"')}${R(1060, 590, 4, 18, "#a85a2a", ' opacity=".6"')}</g>`;
    // Globo y pila de libros a la izquierda
    s += R(152, 500, 4, 66, "#8d6a45") + R(132, 560, 44, 8, "#6b4a2f") + C(154, 496, 36, "#3f7fb5") + R(136, 480, 14, 10, "#6fa86b") + R(156, 498, 16, 12, "#6fa86b") + R(126, 494, 56, 4, "#c9a14a", ' opacity=".9"') + R(204, 568, 70, 12, "#b6453f") + R(210, 556, 58, 12, "#4f7fb5") + R(216, 544, 46, 12, "#e8b84a");
    s += polvo(11, 340, 410, 620, 120);
    s += puertaTaberna(16, 256);
    return `<svg class="lb-escena lb-sala" data-sala="biblioteca" viewBox="0 0 1280 700" shape-rendering="crispEdges" role="group" aria-label="Biblioteca: cada estantería es una página del compendio">${s}<g class="lb-capa-etq" pointer-events="none"></g></svg>`;
  }

  /* ============================================================ SALA RECREATIVA */
  const PANTALLAS = {
    ritmo: `${R(8, 8, 8, 26, "#5fe0d2", ' class="lb-neon lb-n1"')}${R(22, 16, 8, 18, "#ff7ac0", ' class="lb-neon lb-n2"')}${R(36, 6, 8, 28, "#ffd84a", ' class="lb-neon lb-n3"')}${R(50, 20, 8, 14, "#5fe0d2", ' class="lb-neon lb-n1"')}`,
    parranda: `${[6, 20, 34, 48, 62].map(x => R(x, 4, 2, 34, "#ffffff44")).join("")}${R(8, 10, 10, 6, "#ff7ac0", ' class="lb-neon lb-n1"')}${R(22, 20, 10, 6, "#5fe0d2", ' class="lb-neon lb-n2"')}${R(36, 6, 10, 6, "#ffd84a", ' class="lb-neon lb-n3"')}${R(50, 26, 10, 6, "#ff7ac0", ' class="lb-neon lb-n2"')}`,
    hooey: `${R(22, 22, 24, 14, "#e8872a")}${R(26, 12, 16, 12, "#f0b038", ' class="lb-llama"')}${R(30, 6, 8, 10, "#f7dd6a", ' class="lb-llama lb-l2"')}${R(50, 28, 8, 8, "#f2ead2")}`,
    fractura: `${[0, 1, 2].map(i => [0, 1].map(j => R(8 + i * 18, 6 + j * 18, 14, 14, (i + j) % 2 ? "#5a3f27" : "#8d6a45")).join("")).join("")}${R(26, 24, 14, 14, "#b6453f", ' class="lb-neon lb-n2"')}`
  };
  const CAB = { ritmo: "#2a5a8a", parranda: "#8a2f5a", hooey: "#8a3a22", fractura: "#4a4066" };
  function maquina(x, y, tipo) {
    return R(x, y, 88, 124, CAB[tipo]) + R(x, y, 88, 6, "#ffffff2a") + R(x + 6, y + 10, 76, 16, "#e8b84a") + R(x + 10, y + 14, 68, 8, "#1c1422") +
      R(x + 14, y + 16, 8, 4, "#e8b84a") + R(x + 28, y + 16, 8, 4, "#ff7ac0") + R(x + 42, y + 16, 8, 4, "#5fe0d2") + R(x + 56, y + 16, 8, 4, "#e8b84a") +
      R(x + 8, y + 32, 72, 46, "#0c1a2a") + `<g transform="translate(${x + 9} ${y + 34})">${PANTALLAS[tipo]}</g>` +
      R(x + 4, y + 84, 80, 14, "#1c1c3a") + R(x + 12, y + 88, 8, 6, "#b6453f") + R(x + 26, y + 88, 8, 6, "#e8b84a") + R(x + 62, y + 86, 14, 10, "#4f7fb5") + R(x + 30, y + 104, 28, 12, "#0c1220") +
      C(x + 44, y + 52, 52, "#5fe0d2", ' fill-opacity=".05" class="lb-brillo"');
  }

  function juegos(mapa, admin) {
    let s = `<defs>${pared("arcP", "#1d1736", "#2a2050")}<pattern id="arcS" width="64" height="64" patternUnits="userSpaceOnUse">${R(0, 0, 64, 64, "#241a3a")}${R(0, 0, 32, 32, "#2f2350")}${R(32, 32, 32, 32, "#2f2350")}</pattern></defs>
      ${R(0, 0, 1280, 404, "url(#arcP)")}${R(0, 404, 1280, 296, "url(#arcS)")}${R(0, 400, 1280, 8, "#1c1422")}${R(0, 0, 1280, 24, "#1c1422")}${R(0, 0, 16, 404, "#1c1422")}${R(1264, 0, 16, 404, "#1c1422")}`;
    // Tiras de neón en la pared y en el suelo
    s += R(16, 150, 1248, 3, "#ff7ac0", ' class="lb-neon lb-n2"') + R(16, 392, 1248, 4, "#5fe0d2", ' class="lb-neon lb-n1"') + R(0, 430, 1280, 3, "#ffd84a", ' class="lb-neon lb-n3" opacity=".5"');
    // Luminarias colgadas
    s += [220, 640, 1060].map((x, i) => `${R(x - 1, 24, 2, 54, "#8d8d99")}${R(x - 22, 78, 44, 10, "#2a2050")}${R(x - 18, 88, 36, 4, "#ff7ac0", ' class="lb-neon lb-n' + (i + 1) + '"')}${C(x, 96, 56, "#ff7ac0", ' fill-opacity=".08" class="lb-brillo"')}`).join("");
    // Rótulo de neón: la página de Minijuegos
    s += enlace("minijuegos.html", "Minijuegos: la página con todos los juegos",
      R(380, 38, 520, 74, "#2a1d4a") + R(388, 46, 504, 58, "#120d2a") + `<text x="640" y="92" text-anchor="middle" class="lb-rotulo-grande">MINIJUEGOS</text>` + R(388, 46, 504, 4, "#ff7ac0", ' class="lb-neon lb-n1"') + R(388, 100, 504, 4, "#5fe0d2", ' class="lb-neon lb-n2"'), [640, 130]);
    // Tiro con arco (izquierda): diana grande y el mostrador con el arco
    s += enlace("arqueria.html", "Arquería",
      R(70, 180, 180, 184, "#6b4a2f") + R(78, 188, 164, 168, "#8d6a45") + C(160, 270, 62, "#e9dcc0") + C(160, 270, 48, "#b6453f") + C(160, 270, 34, "#e9dcc0") + C(160, 270, 20, "#b6453f") + C(160, 270, 7, "#ffd84a") +
      R(168, 262, 52, 3, "#8d6a45") + R(214, 258, 10, 10, "#c9cdd6") + R(60, 372, 220, 14, "#8d6a45") + R(70, 386, 14, 18, "#6b4a2f") + R(256, 386, 14, 18, "#6b4a2f") +
      P("100,372 108,332 112,332 106,372", "#6b4a2f") + R(104, 340, 2, 32, "#e9dcc0") + R(236, 352, 12, 20, "#8a3d3d") + R(238, 344, 2, 10, "#e9dcc0") + R(243, 344, 2, 10, "#e9dcc0"), [160, 428]);
    // Máquinas en la pared del fondo
    const filas = [["ritmo.html", "Zarabanda", "ritmo"], ["parranda.html", "Parranda", "parranda"], ["sacrificio.html", "Hooey", "hooey"]];
    if (admin) filas.push(["fractura.html", "La Fractura", "fractura", true]);
    const x0 = admin ? 330 : 380;
    filas.forEach((f, i) => { s += enlace(f[0], f[1], maquina(x0 + i * 112, 276, f[2]), [x0 + i * 112 + 44, 420], f[3]); });
    // Ajedrez (derecha): mesa con tablero, reloj y dos taburetes
    let aj = R(900, 336, 150, 12, "#8d6a45") + R(908, 348, 14, 54, "#6b4a2f") + R(1028, 348, 14, 54, "#6b4a2f");
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) aj += R(918 + i * 14, 306 + j * 14, 14, 14, (i + j) % 2 ? "#3a2a1d" : "#e9dcc0");
    aj += R(918, 302, 112, 4, "#3a2a1d") + R(924, 284, 8, 22, "#f2ead2") + R(960, 290, 8, 16, "#f2ead2") + R(990, 282, 8, 24, "#2a2030") + R(1006, 292, 8, 14, "#2a2030") + R(1034, 322, 14, 14, "#1c1422") + R(1036, 324, 10, 6, "#5fe0d2") +
      R(870, 360, 28, 8, "#a8546a") + R(878, 368, 6, 34, "#6b4a2f") + R(1056, 360, 28, 8, "#a8546a") + R(1064, 368, 6, 34, "#6b4a2f");
    s += enlace("ajedrez.html", "Ajedrez", aj, [975, 428]);
    // Duelo (solo admin): la panoplia de armas en la pared de la derecha
    if (admin) s += enlace("duelo.html", "Duelo",
      R(1110, 190, 130, 10, "#6b4a2f") + R(1124, 200, 6, 190, "#4a2f1f") + R(1220, 200, 6, 190, "#4a2f1f") + R(1130, 240, 90, 8, "#6b4a2f") + R(1130, 300, 90, 8, "#6b4a2f") +
      P("1140,204 1148,204 1172,300 1164,300", "#c9cdd6") + P("1210,204 1202,204 1178,300 1186,300", "#aeb3bf") + R(1146, 296, 28, 6, "#e8b84a") + R(1176, 296, 28, 6, "#e8b84a") + R(1158, 252, 10, 40, "#c9cdd6") + R(1186, 252, 10, 40, "#aeb3bf") + R(1150, 248, 26, 4, "#e8b84a") + R(1178, 248, 26, 4, "#e8b84a"), [1175, 420], true);
    // Mesa de cartas de Triunfos en el centro: tres montones, cada uno es una sección
    [340, 500, 660].forEach(x => { s += R(x, 420, 48, 58, "#4a2f1f") + R(x + 6, 426, 36, 46, "#6b4a2f") + R(x + 6, 426, 36, 5, "#a8546a"); });
    s += R(300, 476, 470, 18, "#8d6a45") + R(300, 494, 470, 24, "#6b4a2f") + R(312, 518, 20, 46, "#4a2f1f") + R(738, 518, 20, 46, "#4a2f1f") + R(308, 452, 454, 26, "#245a38") + R(308, 452, 454, 3, "#2f7a4a");
    s += enlace("cartas.html", "Álbum", R(334, 442, 44, 24, "#f2ead2") + R(378, 442, 44, 24, "#e9dcc0") + R(376, 440, 4, 28, "#8a3d3d") + R(340, 448, 32, 2, "#6b4a2f") + R(340, 454, 26, 2, "#6b4a2f") + R(384, 448, 32, 2, "#6b4a2f"), [378, 496]);
    s += enlace("mazos.html", "Mazos", R(500, 456, 30, 8, "#7a2f4a") + R(500, 448, 30, 8, "#3b4a8a") + R(500, 440, 30, 8, "#7a2f4a") + R(504, 442, 22, 4, "#e8b84a") + R(540, 450, 30, 14, "#f2ead2", ' transform="rotate(8 555 457)"') + R(580, 452, 28, 12, "#7a2f4a", ' transform="rotate(-6 594 458)"'), [548, 496]);
    s += enlace("batalla.html", "Batalla", R(650, 436, 26, 34, "#f2ead2", ' transform="rotate(-10 663 453)"') + R(662, 434, 8, 8, "#e8b84a", ' transform="rotate(-10 666 438)"') + R(704, 436, 26, 34, "#7a2f4a", ' transform="rotate(10 717 453)"') + R(712, 440, 8, 8, "#e8b84a", ' transform="rotate(10 716 444)"') + R(684, 448, 12, 12, "#b6453f", ' class="lb-neon lb-n2"'), [694, 496]);
    // Ostelar (solo admin): la trampilla del suelo
    if (admin) s += enlace("ostelar.html", "Ostelar",
      R(900, 560, 190, 84, "#2a1d14") + R(910, 568, 170, 68, "#120c08") + R(922, 580, 146, 8, "#3a2a1d") + R(934, 594, 122, 8, "#2c1f15") + R(946, 608, 98, 8, "#20160f") + R(982, 564, 16, 8, "#8d8d99") + C(990, 564, 6, "none", ' stroke="#8d8d99" stroke-width="3"') + C(995, 600, 80, "#ff7ac0", ' fill-opacity=".06" class="lb-brillo"'), [995, 664], true);
    s += puertaTaberna(16, 256);
    return `<svg class="lb-escena lb-sala" data-sala="juegos" viewBox="0 0 1280 700" shape-rendering="crispEdges" role="group" aria-label="Sala recreativa: los juegos, cada uno en su sitio">${s}<g class="lb-capa-etq" pointer-events="none"></g></svg>`;
  }

  /* ============================================================ ESTABLOS (exterior, con el cielo real) */
  function establos() {
    let s = `<defs><pattern id="estP" width="48" height="24" patternUnits="userSpaceOnUse">${R(0, 0, 48, 24, "#5b8a3a")}${R(6, 6, 2, 4, "#4a7230")}${R(30, 14, 2, 4, "#6fa04a")}${R(18, 18, 2, 4, "#4a7230")}</pattern></defs>`;
    s += `<svg id="salaCielo" class="cielo-ventana" x="0" y="0" width="1280" height="340" viewBox="0 0 1280 340" shape-rendering="crispEdges"><rect width="1280" height="340" fill="#6fb4e8"/></svg>`;
    // Colinas lejanas y árboles
    s += P("0,340 0,290 160,250 320,290 480,260 640,300 800,254 960,292 1120,262 1280,296 1280,340", "#4a7a52") + P("0,340 0,310 220,288 420,314 700,292 940,316 1180,290 1280,312 1280,340", "#3f6b44");
    [60, 470, 520, 1180].forEach((x, i) => { s += R(x, 270, 6, 30, "#5a3d28") + R(x - 14, 238, 34, 36, "#2f5a34") + R(x - 8, 226, 22, 18, "#2f5a34"); });
    // Hierba y camino
    s += R(0, 340, 1280, 360, "url(#estP)") + R(0, 340, 1280, 4, "#3f6b44");
    // Grada del hipódromo
    let g = R(30, 150, 380, 16, "#b6453f");
    for (let i = 0; i < 10; i++) g += R(30 + i * 38, 150, 19, 16, "#f2ead2");
    g += R(34, 166, 8, 164, "#6b4a2f") + R(398, 166, 8, 164, "#6b4a2f") + R(216, 166, 8, 164, "#6b4a2f");
    const COL = ["#b6453f", "#4f7fb5", "#e8b84a", "#4c8a4f", "#8a5fc2", "#c9703a", "#2f8a8a", "#a8546a"];
    for (let f = 0; f < 4; f++) {
      g += R(42, 176 + f * 38, 356, 38, ["#6b4a2f", "#5a3d28", "#4a3220", "#3a2518"][f]) + R(42, 176 + f * 38, 356, 3, "#8d6a45");
      for (let k = 0; k < 15; k++) if ((k * 7 + f * 3) % 5) g += R(50 + k * 23, 188 + f * 38, 10, 14, COL[(k * 3 + f * 5) % COL.length]) + R(52 + k * 23, 182 + f * 38, 6, 6, "#e0b890");
    }
    g += R(30, 100, 3, 52, "#8d8d99") + `<g class="lb-bandera">${R(33, 100, 28, 16, "#b6453f")}${R(33, 106, 28, 4, "#e8b84a")}</g>` + R(404, 100, 3, 52, "#8d8d99") + `<g class="lb-bandera lb-b2">${R(407, 100, 28, 16, "#4f7fb5")}${R(407, 106, 28, 4, "#f2ead2")}</g>`;
    s += enlace("hipodromo.html", "Hipódromo", g, [220, 372]);
    // Pista con corredores
    s += R(0, 340, 1280, 6, "#f2ead2") + R(0, 332, 1280, 4, "#d9d2bd", ' opacity=".6"') + R(0, 346, 1280, 74, "#a8834f") + R(0, 346, 1280, 3, "#8f6e40") + R(0, 420, 1280, 6, "#f2ead2");
    [[368, "#b6453f", 0], [388, "#4f7fb5", -2.2], [404, "#e8b84a", -4.1]].forEach(([y, c, d]) => {
      s += `<g class="lb-corredor" style="animation-delay:${d}s;animation-duration:${9 + (-d % 2)}s">${R(0, y, 26, 12, c)}${R(20, y - 6, 10, 10, c)}${R(4, y + 12, 4, 8, "#3a2a1d")}${R(18, y + 12, 4, 8, "#3a2a1d")}${R(26, y - 4, 4, 3, "#1c1422")}${R(-6, y + 2, 6, 3, c)}</g>`;
    });
    s += R(0, 380, 1280, 2, "#8f6e40", ' opacity=".7"') + R(0, 400, 1280, 2, "#8f6e40", ' opacity=".7"');
    // Pantalla del directo
    s += enlace("hipodromo-vivo.html", "Hipódromo en vivo",
      R(470, 96, 330, 176, "#1c1422") + R(480, 106, 310, 156, "#0c1a2a") + [140, 176, 212].map(y => R(480, y, 310, 2, "#ffffff33")).join("") +
      `<g class="lb-corredor-pantalla">${R(490, 118, 22, 12, "#e8b84a")}${R(490, 150, 22, 12, "#5fe0d2")}${R(490, 186, 22, 12, "#ff7ac0")}${R(490, 222, 22, 12, "#6fe08a")}</g>` +
      R(488, 112, 10, 10, "#e04a4a", ' class="lb-brillo"') + R(626, 272, 18, 66, "#4a3220") + R(590, 330, 90, 12, "#6b4a2f") + C(635, 184, 150, "#5fe0d2", ' fill-opacity=".04" class="lb-brillo"'), [635, 130]);
    // Corral: valla, hierba, heno, abrevadero y animales que se mueven
    let c = R(820, 470, 420, 180, "#4f8a3a") + R(820, 470, 420, 4, "#3f6b44");
    for (let i = 0; i < 9; i++) c += R(822 + i * 52, 440, 8, 66, "#6b4a2f");
    c += R(820, 452, 420, 8, "#8d6a45") + R(820, 482, 420, 8, "#8d6a45");
    for (let i = 0; i < 9; i++) c += R(822 + i * 52, 626, 8, 40, "#6b4a2f");
    c += R(820, 640, 420, 8, "#8d6a45") + R(820, 664, 420, 6, "#6b4a2f") + R(820, 470, 8, 180, "#6b4a2f") + R(1232, 470, 8, 180, "#6b4a2f");
    c += R(1130, 588, 90, 46, "#d4b24a") + R(1130, 588, 90, 6, "#ecd275") + R(1140, 600, 70, 3, "#b99a35") + R(1000, 596, 70, 22, "#6b4a2f") + R(1004, 600, 62, 14, "#3f7fb5") + R(1000, 618, 6, 18, "#4a2f1f") + R(1064, 618, 6, 18, "#4a2f1f");
    const animal = (x, y, col, d) => `<g class="lb-salta" style="animation-delay:${d}s">${R(x, y, 40, 22, col)}${R(x + 34, y - 10, 16, 16, col)}${R(x + 36, y - 14, 4, 6, col)}${R(x + 46, y - 14, 4, 6, col)}${R(x + 44, y - 6, 3, 3, "#1c1422")}${R(x + 4, y + 22, 6, 14, "#3a2a1d")}${R(x + 28, y + 22, 6, 14, "#3a2a1d")}</g>`;
    c += animal(860, 530, "#f6e7c2", 0) + animal(950, 560, "#c9b08a", -0.6) + animal(1060, 520, "#a8734a", -1.1);
    s += enlace("corrales.html", "Corrales", c, [1030, 690]);
    // Muro de piedra con la puerta de vuelta a la taberna
    s += R(0, 470, 300, 130, "#6e6a78") + R(0, 470, 300, 8, "#8b8696") + Array.from({ length: 4 }, (_, j) => Array.from({ length: 7 }, (_, i) => R(i * 44 + (j % 2) * 22, 480 + j * 28, 2, 26, "#5a5668")).join("")).join("") + R(0, 506, 300, 2, "#5a5668") + R(0, 534, 300, 2, "#5a5668") + R(0, 562, 300, 2, "#5a5668");
    s += puertaTaberna(116, 460);
    s += `<rect id="salaTinte" width="1280" height="700" fill="none" opacity="0" pointer-events="none"/>`;
    return `<svg class="lb-escena lb-sala" data-sala="establos" viewBox="0 0 1280 700" shape-rendering="crispEdges" role="group" aria-label="Establos: el hipódromo, el directo y los corrales, al aire libre">${s}<g class="lb-capa-etq" pointer-events="none"></g></svg>`;
  }

  /* ============================================================ DESPACHO (solo admin) */
  function despacho() {
    let s = `<defs>${pared("desP", "#243326", "#1c291f")}${tablones("desS", "#3a2a2a", "#2c2020")}</defs>${R(0, 0, 1280, 420, "url(#desP)")}${R(0, 420, 1280, 280, "url(#desS)")}${R(0, 416, 1280, 8, "#1c1422")}${R(0, 0, 1280, 24, "#1c1422")}${R(0, 0, 16, 420, "#1c1422")}${R(1264, 0, 16, 420, "#1c1422")}`;
    // Ventana al exterior con el cielo real
    s += R(120, 70, 200, 170, "#3b2a1d") + `<svg id="salaVentana" class="cielo-ventana" x="130" y="80" width="180" height="150" viewBox="0 0 180 150" shape-rendering="crispEdges"><rect width="180" height="150" fill="#10163a"/></svg>` + R(216, 70, 6, 170, "#3b2a1d") + R(120, 150, 200, 6, "#3b2a1d") + R(112, 236, 216, 10, "#8d6a45") + R(124, 74, 20, 162, "#2f4f8a", ' opacity=".9"') + R(296, 74, 20, 162, "#2f4f8a", ' opacity=".9"');
    // Estantería y archivador al fondo
    s += R(420, 90, 180, 330, "#3a2616") + R(428, 98, 164, 314, "#4a3220") + [1, 2, 3, 4].map(i => R(428, 98 + i * 62, 164, 5, "#6a4a30")).join("");
    for (let i = 0; i < 5; i++) s += lomos(434, 588, 98 + (i + 1) * 62 - 0, i * 11 + 3, ["#4c8a4f", "#2f6a4d", "#8d6a45", "#c9a14a", "#4f7fb5"], 30, 50);
    s += R(940, 200, 120, 220, "#5e5a69") + R(946, 206, 108, 66, "#78748a") + R(946, 278, 108, 66, "#78748a") + R(946, 350, 108, 62, "#78748a") + R(990, 232, 20, 6, "#c9cdd6") + R(990, 304, 20, 6, "#c9cdd6") + R(990, 376, 20, 6, "#c9cdd6");
    s += R(1110, 120, 80, 100, "#8d6a45") + R(1116, 126, 68, 88, "#2a1d14") + C(1150, 156, 16, "#e0b890") + R(1128, 174, 44, 32, "#3b4a8a");
    // Mesa grande con el panel de Admin
    s += R(520, 504, 24, 70, "#4a2f1f") + R(736, 504, 24, 70, "#4a2f1f") + R(480, 478, 320, 30, "#6b4a2f") + R(472, 462, 336, 20, "#8d6a45") + R(472, 462, 336, 4, "#a8834f");
    s += enlace("admin.html", "Panel de Admin",
      R(590, 410, 100, 56, "#1c1422") + R(596, 416, 88, 44, "#0c1a2a") + R(604, 440, 10, 16, "#5fe0d2", ' class="lb-neon lb-n1"') + R(620, 430, 10, 26, "#e8b84a", ' class="lb-neon lb-n2"') + R(636, 422, 10, 34, "#ff7ac0", ' class="lb-neon lb-n3"') + R(652, 436, 10, 20, "#5fe0d2", ' class="lb-neon lb-n1"') + R(634, 466, 12, 8, "#4a3220") + R(612, 472, 56, 6, "#6b4a2f") + C(640, 440, 80, "#5fe0d2", ' fill-opacity=".05" class="lb-brillo"'), [640, 396], true);
    s += R(500, 446, 4, 16, "#c9a14a") + R(488, 436, 28, 12, "#2f6a4d") + C(502, 466, 44, "#fff1b0", ' fill-opacity=".1" class="lb-brillo"') + R(700, 456, 36, 6, "#f2ead2", ' transform="rotate(-4 718 459)"') + R(740, 452, 28, 8, "#e9d9a0");
    // Los dos puestos de edición de mapas de ritmo
    s += enlace("ritmo-editor.html", "Editor de Zarabanda",
      R(130, 470, 230, 16, "#8d6a45") + R(140, 486, 14, 70, "#6b4a2f") + R(336, 486, 14, 70, "#6b4a2f") + R(150, 430, 200, 40, "#1c2450") + [0, 1, 2, 3, 4, 5, 6, 7].map(i => R(158 + i * 24, 436, 18, 28, i % 2 ? "#e9dcc0" : "#f2ead2")).join("") + [1, 3, 6].map(i => R(170 + i * 24, 436, 10, 18, "#1c1422")).join("") + R(220, 400, 60, 28, "#0c1a2a") + R(228, 408, 8, 14, "#5fe0d2", ' class="lb-neon lb-n1"') + R(244, 404, 8, 18, "#ff7ac0", ' class="lb-neon lb-n2"') + R(260, 410, 8, 12, "#ffd84a", ' class="lb-neon lb-n3"'), [245, 586], true);
    s += enlace("parranda-editor.html", "Editor de Parranda",
      C(1040, 520, 46, "#b6453f") + C(1040, 520, 38, "#e9dcc0") + R(1000, 580, 80, 10, "#6b4a2f") + R(1036, 566, 8, 36, "#8d8d99") + C(1130, 480, 28, "#c9a14a") + C(1130, 480, 22, "#e8b84a") + R(1128, 508, 4, 80, "#8d8d99") + C(960, 556, 30, "#2a5a8a") + C(960, 556, 24, "#e9dcc0") + R(948, 586, 4, 40, "#8d8d99") + R(1000, 542, 30, 4, "#8d6a45", ' transform="rotate(-20 1015 544)"'), [1040, 650], true);
    s += R(360, 560, 560, 130, "#4a2a30", ' opacity=".9"') + R(368, 568, 544, 114, "none", ' stroke="#c9a14a" stroke-width="3" opacity=".6"');
    s += puertaTaberna(16, 266);
    s += `<rect id="salaTinte" width="1280" height="700" fill="none" opacity="0" pointer-events="none"/>`;
    return `<svg class="lb-escena lb-sala" data-sala="despacho" viewBox="0 0 1280 700" shape-rendering="crispEdges" role="group" aria-label="Despacho: el panel de Admin y los editores de ritmo">${s}<g class="lb-capa-etq" pointer-events="none"></g></svg>`;
  }

  return { biblioteca, juegos, establos, despacho };
})();
