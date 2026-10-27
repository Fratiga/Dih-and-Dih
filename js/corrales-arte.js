/* =============================================================================
   EL ARTE DE LOS CORRALES (lo usa js/corrales.js)
   Seis biomas, cada uno una escena de 960 x 540 con su ambiente animado (hojas, luciérnagas, burbujas, nieve, brasas, lava...). Los tres de
   exterior (aviario, bosque, ciénaga) llevan un cielo real que sigue la hora y el clima (js/cielo.js); los tres cerrados (madriguera, cámara
   de hielo, cubil) no.
   Cada escena trae un grupo vacío <g class="co-capa"> donde js/corrales.js coloca las criaturas (entre el fondo y los objetos de delante, para
   que los pies queden detrás de la valla o la hierba) y deja marcados los sitios donde van:
     SITIOS[habitat]   hasta diez puestos {x, y, s}: los pies en (x, y) y s de escala (el fondo, más pequeño)
     PAREJA[habitat]   los dos puestos de la pareja que está criando (junto al nido, el tocón, la cámara...)
   Las criaturas se dibujan con assets/criaturas/<id de la carta>.png (ver assets/criaturas/README.md).
============================================================================= */
window.CorralesArte = (function () {
  const R = (x, y, w, h, f, ex) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${ex || ""}/>`;
  const C = (cx, cy, r, f, ex) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex || ""}/>`;
  const E = (cx, cy, rx, ry, f, ex) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${ex || ""}/>`;
  const P = (pts, f, ex) => `<polygon points="${pts}" fill="${f}"${ex || ""}/>`;
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join("");
  const az = (i, m) => ((i * 7919 + 13) % 997) / 997 * m;   // reparto fijo e irregular (sin azar de verdad: la escena es siempre la misma)
  const cielo = (alto, color) => `<svg class="cielo-ventana" x="0" y="0" width="960" height="${alto}" viewBox="0 0 960 ${alto}" shape-rendering="crispEdges">${R(0, 0, 960, alto, color)}</svg>`;
  const tinte = `<rect id="coTinte" width="960" height="540" fill="none" opacity="0" pointer-events="none"/>`;

  const SITIOS = {
    aviario: [{ x: 210, y: 304, s: .82 }, { x: 380, y: 236, s: .8 }, { x: 560, y: 336, s: .9 }, { x: 730, y: 254, s: .8 }, { x: 850, y: 372, s: .95 }, { x: 330, y: 470, s: 1.1 },
      { x: 90, y: 372, s: .85 }, { x: 470, y: 404, s: .95 }, { x: 660, y: 470, s: 1.1 }, { x: 880, y: 470, s: 1.05 }],
    bosque: [{ x: 180, y: 410, s: .95 }, { x: 330, y: 380, s: .88 }, { x: 490, y: 432, s: 1.1 }, { x: 650, y: 396, s: .92 }, { x: 800, y: 446, s: 1.15 }, { x: 905, y: 400, s: .9 },
      { x: 110, y: 354, s: .78 }, { x: 420, y: 352, s: .76 }, { x: 740, y: 350, s: .78 }, { x: 250, y: 492, s: 1.15 }],
    madriguera: [{ x: 190, y: 470, s: .9 }, { x: 500, y: 372, s: 1 }, { x: 790, y: 456, s: .9 }, { x: 250, y: 216, s: .78 }, { x: 800, y: 196, s: .78 }, { x: 495, y: 486, s: .85 }],
    pantano: [{ x: 190, y: 430, s: .95 }, { x: 360, y: 388, s: .85 }, { x: 520, y: 452, s: 1.1 }, { x: 690, y: 402, s: .9 }, { x: 830, y: 470, s: 1.1 }, { x: 905, y: 384, s: .85 }],
    glaciar: [{ x: 190, y: 470, s: 1 }, { x: 330, y: 424, s: .85 }, { x: 640, y: 474, s: 1.15 }, { x: 770, y: 430, s: .9 }, { x: 880, y: 478, s: 1.1 }, { x: 500, y: 410, s: .75 }],
    cubil: [{ x: 160, y: 402, s: .95 }, { x: 330, y: 330, s: .85 }, { x: 640, y: 424, s: 1 }, { x: 760, y: 350, s: .88 }, { x: 860, y: 428, s: 1 }, { x: 600, y: 246, s: .78 },
      { x: 250, y: 474, s: 1.08 }, { x: 480, y: 476, s: 1.1 }, { x: 470, y: 356, s: .82 }]
  };
  const PAREJA = {
    aviario: [{ x: 430, y: 478, s: 1.2 }, { x: 560, y: 478, s: 1.2 }],
    bosque: [{ x: 330, y: 436, s: 1.25 }, { x: 470, y: 446, s: 1.25 }],
    madriguera: [{ x: 430, y: 372, s: 1.1 }, { x: 570, y: 372, s: 1.1 }],
    pantano: [{ x: 410, y: 450, s: 1.2 }, { x: 560, y: 450, s: 1.2 }],
    glaciar: [{ x: 410, y: 474, s: 1.25 }, { x: 560, y: 474, s: 1.25 }],
    cubil: [{ x: 380, y: 438, s: 1.2 }, { x: 520, y: 438, s: 1.2 }]
  };

  /* ---------------------------------------------------------------- Aviario: una jaula grande abierta al cielo */
  function aviario() {
    let s = cielo(340, "#6fb4e8");
    s += P("0,340 0,282 110,222 215,268 350,206 470,266 600,196 720,262 860,214 960,266 960,340", "#5d7fa0", ' opacity=".85"') + P("0,340 0,308 160,268 330,306 520,276 720,310 880,280 960,304 960,340", "#4a7a52");
    s += R(0, 340, 960, 200, "#6b8a4a") + rep(14, i => R(Math.round(az(i, 920)), 352 + Math.round(az(i + 3, 130)), 40, 4, i % 2 ? "#7ba05a" : "#587a3c")) + R(0, 440, 960, 100, "#7a5a3a") + rep(7, i => R(0, 448 + i * 14, 960, 2, "#5a3f27")) + rep(9, i => R(az(i, 900), 440 + (i % 3) * 30, 2, 14, "#5a3f27"));
    // Pájaros lejanos cruzando el cielo y plumas que caen
    s += rep(4, i => `<g class="co-vuelo" style="animation-delay:${-i * 3.4}s;animation-duration:${15 + i * 3}s;--y:${60 + i * 38}px"><path class="co-aleteo" d="M0 0 L8 -7 L16 0 L24 -7 L32 0" fill="none" stroke="#1c1c3a" stroke-width="3"/></g>`);
    // La jaula: arcos de hierro, malla fina y postes
    s += `<g fill="none" stroke="#c9c2d6" stroke-linecap="square"><path d="M14 392 Q480 -70 946 392" stroke-width="5"/><path d="M96 392 Q480 20 864 392" stroke-width="3" opacity=".8"/><path d="M180 392 Q480 100 780 392" stroke-width="2" opacity=".5"/>${rep(11, i => `<path d="M${40 + i * 88} 392 L${40 + i * 88} ${Math.round(260 - Math.sin((i / 10) * Math.PI) * 190)}" stroke-width="1" opacity=".25"/>`)}</g>`;
    s += R(6, 120, 14, 330, "#8d8d99") + R(940, 120, 14, 330, "#8d8d99") + R(6, 120, 14, 6, "#c9c2d6") + R(940, 120, 14, 6, "#c9c2d6");
    // Perchas a distintas alturas con comederos colgando
    SITIOS.aviario.slice(0, 5).forEach((p, i) => { s += R(p.x - 70, p.y, 140, 10, "#6b4a2f") + R(p.x - 70, p.y, 140, 3, "#8d6a45") + R(p.x - 4, p.y - 140, 2, 140, "#8d8d99", ' opacity=".5"') + (i % 2 ? R(p.x + 50, p.y + 10, 16, 14, "#d4b24a") + R(p.x + 56, p.y + 6, 4, 6, "#8d8d99") : ""); });
    s += rep(4, i => `<g class="co-pluma" style="animation-delay:${-i * 2.3}s;--x:${160 + i * 190}px">${R(0, 0, 8, 3, "#f2ead2")}${R(2, 3, 4, 2, "#d9d2bd")}</g>`);
    // Nido de paja en el suelo (el sitio de la pareja)
    s += E(495, 482, 120, 26, "#5a3f27") + E(495, 476, 108, 20, "#b8964a") + rep(14, i => R(400 + i * 14, 466 + (i % 3) * 5, 10, 3, i % 2 ? "#d4b24a" : "#a8843a")) + E(495, 470, 80, 12, "#8a6a30");
    s += `<g class="co-capa"></g>`;
    // Valla de madera al frente y hierba
    s += R(0, 500, 960, 12, "#8d6a45") + R(0, 500, 960, 3, "#a8834f") + rep(13, i => R(30 + i * 74, 482, 10, 58, "#6b4a2f")) + R(0, 524, 960, 16, "#587a3c") + rep(30, i => R(8 + i * 32, 516 + (i % 3) * 3, 3, 10, "#4a6a30"));
    return s + tinte;
  }

  /* ---------------------------------------------------------------- Corral del bosque: claro con árboles, rayos de luz y un refugio de ramas */
  function bosque() {
    let s = cielo(300, "#6fb4e8");
    s += rep(13, i => P(`${i * 80 - 10},330 ${i * 80 + 30},${196 + (i % 3) * 18} ${i * 80 + 70},330`, "#244a2c")) + rep(12, i => P(`${i * 86 + 20},330 ${i * 86 + 60},${176 + (i % 4) * 16} ${i * 86 + 100},330`, "#2d5a34"));
    // Troncos y copas de los árboles grandes
    [[120, 1], [330, .9], [640, 1.05], [860, .95]].forEach(([x, k], i) => { s += R(x - 14 * k, 120, 28 * k, 320, i % 2 ? "#4a3220" : "#5a3d28") + R(x - 14 * k, 120, 6 * k, 320, "#00000030") + C(x, 110, 92 * k, "#2a4f2a") + C(x - 60 * k, 140, 64 * k, "#2f5a34") + C(x + 62 * k, 136, 66 * k, "#2f5a34") + C(x, 60, 58 * k, "#3b6b3c"); });
    // Rayos de luz entre las copas (solo de día)
    s += rep(4, i => P(`${180 + i * 210},60 ${220 + i * 210},60 ${150 + i * 210},400 ${70 + i * 210},400`, "#fff1b0", ` class="co-rayo" opacity=".12" style="animation-delay:${-i * 1.8}s"`));
    s += R(0, 330, 960, 210, "#4a7a3a") + rep(16, i => R(Math.round(az(i, 900)), 340 + Math.round(az(i + 5, 150)), 48, 5, i % 2 ? "#5a8a46" : "#3f6b32")) + P("300,540 380,330 560,330 700,540", "#8a6a45", ' opacity=".55"') + P("420,540 450,360 520,360 600,540", "#a08050", ' opacity=".5"');
    // Refugio de ramas con heno, tocón y setas
    s += P("690,345 800,250 940,345", "#5a3d28") + P("700,345 800,262 930,345", "#6b4a2f") + rep(8, i => R(704 + i * 28, 300 - (i % 2) * 12, 16, 5, "#8d6a45", ` transform="rotate(${-30 + i * 8} ${712 + i * 28} 300)"`)) + R(720, 330, 190, 22, "#d4b24a") + R(720, 330, 190, 4, "#ecd275");
    s += R(520, 400, 70, 30, "#6b4a2f") + E(555, 400, 35, 9, "#8d6a45") + E(555, 400, 24, 5, "#a8834f") + R(210, 436, 6, 12, "#e9dcc0") + C(213, 434, 9, "#b6453f") + R(236, 442, 5, 10, "#e9dcc0") + C(238, 440, 7, "#b6453f") + rep(10, i => R(Math.round(40 + az(i, 880)), 470 + Math.round(az(i + 2, 40)), 4, 4, ["#e8b84a", "#f2ead2", "#ff7ac0"][i % 3]));
    // Hojas que caen y luciérnagas (de noche)
    s += rep(9, i => `<g class="co-hoja" style="animation-delay:${-i * 1.9}s;animation-duration:${9 + (i % 4) * 2}s;--x:${60 + i * 100}px">${R(0, 0, 8, 5, i % 3 ? "#d4a43a" : "#c9703a")}${R(2, 1, 4, 1, "#8a4a1a")}</g>`);
    s += rep(12, i => `<g class="co-luciernaga" style="animation-delay:${-i * 0.7}s;left:0">${C(Math.round(80 + az(i, 800)), Math.round(240 + az(i + 4, 230)), 3, "#f7f27a")}${C(Math.round(80 + az(i, 800)), Math.round(240 + az(i + 4, 230)), 9, "#f7f27a", ' fill-opacity=".2"')}</g>`);
    s += `<g class="co-capa"></g>`;
    s += R(0, 500, 960, 10, "#8d6a45") + R(0, 500, 960, 3, "#a8834f") + rep(13, i => R(26 + i * 74, 478, 10, 62, "#6b4a2f")) + R(0, 522, 960, 18, "#3f6b32") + rep(34, i => R(4 + i * 28, 514 + (i % 3) * 3, 3, 10, "#2f5a28"));
    return s + tinte;
  }

  /* ---------------------------------------------------------------- Madriguera: un corte de la tierra con cámaras y túneles */
  function madriguera() {
    let s = R(0, 0, 960, 540, "#4a3426") + rep(46, i => R(Math.round(az(i, 920)), Math.round(40 + az(i + 9, 490)), 16 + (i % 4) * 8, 8 + (i % 3) * 4, i % 3 ? "#3f2c20" : "#5a4230")) + rep(14, i => `${E(Math.round(az(i + 20, 900)), Math.round(60 + az(i + 33, 460)), 10, 7, "#6b6370")}`);
    s += R(0, 0, 960, 44, "#3f6b32") + R(0, 36, 960, 10, "#2f5a28") + rep(24, i => R(i * 41, 40 + (i % 3) * 5, 4, 8, "#4a7a3a"));
    s += rep(10, i => R(40 + i * 96, 46, 3, 20 + (i % 4) * 14, "#6b4a2f") + R(36 + i * 96, 66 + (i % 4) * 14, 10, 3, "#6b4a2f"));
    // Cámaras y túneles
    const camara = (x, y, w, h) => R(x, y, w, h, "#1d130d") + R(x + 8, y + 8, w - 16, h - 16, "#2a1c12") + R(x + 8, y + h - 26, w - 16, 18, "#b8964a") + R(x + 8, y + h - 26, w - 16, 3, "#d4b24a") + rep(Math.floor(w / 28), i => R(x + 14 + i * 28, y + h - 20 + (i % 2) * 3, 12, 3, "#8a6a30"));
    s += R(300, 430, 80, 44, "#1d130d") + R(560, 380, 120, 40, "#1d130d") + R(160, 220, 40, 150, "#1d130d") + R(420, 150, 40, 70, "#1d130d") + R(460, 360, 40, 90, "#1d130d") + R(700, 200, 40, 110, "#1d130d") + R(380, 440, 400, 38, "#1d130d");
    s += camara(70, 330, 250, 156) + camara(350, 210, 290, 166) + camara(650, 300, 250, 180) + camara(120, 110, 250, 110) + camara(660, 80, 260, 120);
    // Comida, huesos, setas que brillan y una linterna
    s += rep(5, i => P(`${100 + i * 22},${470} ${110 + i * 22},${456} ${120 + i * 22},${470}`, "#e0662a")) + R(110, 462, 120, 4, "#b8964a", ' opacity="0"') + R(820, 468, 50, 12, "#8d6a45") + rep(7, i => R(826 + i * 6, 462 + (i % 3), 4, 6, "#e8b84a")) + R(720, 470, 40, 6, "#e9dcc0") + C(730, 470, 4, "#e9dcc0");
    s += [[170, 478], [830, 458], [460, 366]].map(([x, y], i) => `<g class="co-seta" style="animation-delay:${-i * 0.9}s">${R(x - 2, y - 14, 4, 14, "#d9d2bd")}${E(x, y - 16, 12, 7, "#5fe0d2")}${R(x - 6, y - 18, 3, 3, "#fff")}${C(x, y - 12, 30, "#5fe0d2", ' fill-opacity=".14"')}</g>`).join("");
    s += R(499, 215, 2, 40, "#8d8d99") + R(490, 255, 20, 24, "#e8b84a") + R(494, 259, 12, 16, "#fff1b0", ' class="lb-llama"') + C(500, 268, 70, "#fff1b0", ' fill-opacity=".1" class="co-brasa"');
    s += rep(9, i => `<g class="co-mota" style="animation-delay:${-i * 1.1}s;--x:${100 + i * 90}px">${R(0, 0, 2, 2, "#d9c9a0")}</g>`) + `<g class="co-gota-g">${R(612, 150, 2, 6, "#9fd0f0", ' class="co-gota"')}</g>`;
    s += `<g class="co-capa"></g>`;
    s += R(0, 520, 960, 20, "#2a1c12") + rep(12, i => R(i * 84, 510 + (i % 2) * 6, 40, 12, "#3f2c20"));
    return s;
  }

  /* ---------------------------------------------------------------- Ciénaga: agua turbia, juncos que se mecen, niebla y nenúfares */
  function pantano() {
    let s = cielo(260, "#7aa0a0");
    s += rep(10, i => { const x = 40 + i * 98; return R(x, 100 + (i % 3) * 20, 8, 200, "#2a3a2a") + C(x + 4, 96 + (i % 3) * 20, 44, "#2f4a34") + rep(5, k => R(x - 30 + k * 16, 120 + (i % 3) * 20, 3, 90 + (k % 3) * 20, "#2f4a34", ' opacity=".8"')); });
    s += R(0, 290, 960, 250, "#2f5c5a") + rep(8, i => R(0, 296 + i * 26, 960, 3, i % 2 ? "#3f7270" : "#264e4c", ' opacity=".7"')) + P("0,540 0,430 120,400 210,440 240,540", "#4a5a3a") + P("960,540 960,420 830,400 760,450 780,540", "#4a5a3a") + R(0, 520, 960, 20, "#3a3a28");
    // Nenúfares, troncos, muelle viejo
    s += rep(9, i => { const x = Math.round(130 + az(i, 700)), y = 380 + Math.round(az(i + 6, 110)); return E(x, y, 28, 8, "#4f9a45") + E(x + 3, y - 1, 20, 5, "#6fba5a") + (i % 3 === 0 ? C(x + 6, y - 6, 4, "#ff9ac0") : ""); });
    s += R(300, 436, 260, 22, "#5a3d28") + R(300, 436, 260, 5, "#7a5a3a") + E(300, 447, 8, 11, "#4a3220") + E(560, 447, 8, 11, "#4a3220") + R(640, 386, 240, 10, "#6b4a2f") + rep(6, i => R(646 + i * 38, 386, 3, 10, "#3a2517")) + R(700, 396, 8, 60, "#4a3220") + R(840, 396, 8, 70, "#4a3220");
    // Ondas, burbujas, niebla, luciérnagas
    s += rep(6, i => E(Math.round(150 + az(i, 700)), 350 + Math.round(az(i + 3, 150)), 22, 5, "none", ` stroke="#9fd0d0" stroke-width="2" opacity=".5" class="co-ola" style="animation-delay:${-i * 0.8}s"`));
    s += rep(8, i => `<g class="co-burbuja" style="animation-delay:${-i * 0.9}s;--x:${100 + i * 105}px">${C(0, 0, 3, "none", ' stroke="#cfe8e8" stroke-width="1.5"')}</g>`);
    // Juncos y espadañas a los lados
    const junco = (x, y, k) => R(x, y - 90 * k, 3, 90 * k, "#6aa04a", ` class="co-junco" style="animation-delay:${-(x % 7) * 0.4}s"`) + R(x - 3, y - 90 * k - 20, 9, 22, "#6b4a2f", ` class="co-junco" style="animation-delay:${-(x % 7) * 0.4}s"`);
    s += rep(10, i => junco(30 + i * 22, 470 + (i % 3) * 8, 0.9 + (i % 4) * 0.15)) + rep(10, i => junco(780 + i * 24, 480 + (i % 3) * 8, 0.8 + (i % 4) * 0.18));
    s += rep(3, i => R(0, 296 + i * 24, 1920, 26, "#d5dae4", ` class="co-niebla" opacity=".28" style="animation-delay:${-i * 6}s"`));
    s += rep(10, i => `<g class="co-luciernaga" style="animation-delay:${-i * 0.8}s">${C(Math.round(100 + az(i, 780)), Math.round(280 + az(i + 4, 200)), 3, "#f7f27a")}${C(Math.round(100 + az(i, 780)), Math.round(280 + az(i + 4, 200)), 9, "#f7f27a", ' fill-opacity=".2"')}</g>`);
    s += `<g class="co-capa"></g>`;
    s += rep(26, i => R(i * 38, 512 + (i % 3) * 4, 3, 22, "#3f6b32")) + R(0, 530, 960, 10, "#2a2a1c");
    return s + tinte;
  }

  /* ---------------------------------------------------------------- Cámara de hielo: gruta de cristal, estalactitas, niebla fría y destellos */
  function glaciar() {
    let s = R(0, 0, 960, 200, "#1b3a5a") + R(0, 200, 960, 160, "#2a5f88") + R(0, 360, 960, 180, "#8fc7e0");
    // Haz de luz que entra por una grieta arriba a la derecha
    s += P("780,0 880,0 700,420 560,420", "#dff6ff", ' opacity=".14" class="co-brasa"') + P("820,0 860,0 760,400 700,400", "#ffffff", ' opacity=".12"');
    // Columnas de cristal al fondo
    s += rep(9, i => { const x = 30 + i * 108, h = 160 + (i % 4) * 40; return P(`${x},400 ${x + 18},${400 - h} ${x + 46},${400 - h + 14} ${x + 64},400`, "#5ba8d0") + P(`${x + 18},${400 - h} ${x + 32},400 ${x + 46},${400 - h + 14}`, "#9fd8f0", ' opacity=".7"') + R(x + 28, 400 - h + 18, 3, 36, "#ffffff", ` class="co-brillo" style="animation-delay:${-i * 0.5}s"`); });
    // Estalactitas del techo
    s += rep(22, i => P(`${i * 46 - 6},0 ${i * 46 + 20},0 ${i * 46 + 7},${54 + (i % 5) * 26}`, i % 2 ? "#cfeaf6" : "#9fd0e6")) + rep(8, i => R(40 + i * 120, 70 + (i % 4) * 26, 3, 6, "#ffffff", ` class="co-gota" style="animation-delay:${-i * 0.7}s"`));
    // Suelo helado con reflejos, grietas, estanque y ventisqueros
    s += R(0, 400, 960, 140, "#bfe3f0") + R(0, 400, 960, 5, "#eaf8ff") + rep(8, i => R(Math.round(az(i, 880)), 420 + (i % 4) * 28, 90, 3, "#ffffff", ' opacity=".5"')) + `<path d="M560 540 L600 470 L580 430 L640 400" fill="none" stroke="#6fa8c8" stroke-width="3"/><path d="M200 520 L250 480 L240 440" fill="none" stroke="#6fa8c8" stroke-width="2"/>`;
    s += E(520, 484, 150, 28, "#7fc0e0") + E(520, 482, 130, 20, "#a6d8ee") + rep(5, i => R(420 + i * 40, 478 + (i % 2) * 6, 24, 2, "#ffffff", ' opacity=".6"'));
    s += P("0,540 0,452 120,430 220,470 260,540", "#eaf8ff") + P("960,540 960,446 840,426 740,470 700,540", "#eaf8ff") + P("0,540 0,480 90,462 160,500 180,540", "#cfeaf6");
    s += rep(14, i => `<g class="co-brillo" style="animation-delay:${-i * 0.4}s">${R(Math.round(40 + az(i + 7, 880)), Math.round(150 + az(i + 2, 360)), 4, 4, "#ffffff")}${R(Math.round(40 + az(i + 7, 880)) - 3, Math.round(150 + az(i + 2, 360)) + 1, 10, 2, "#ffffff", ' opacity=".7"')}</g>`);
    s += rep(14, i => `<g class="co-nieve" style="animation-delay:${-i * 0.9}s;--x:${40 + i * 66}px">${R(0, 0, 3, 3, "#ffffff")}</g>`);
    s += rep(3, i => R(0, 400 + i * 24, 1920, 28, "#e6f6ff", ` class="co-niebla" opacity=".22" style="animation-delay:${-i * 7}s"`));
    s += `<g class="co-capa"></g>`;
    s += P("0,540 0,505 80,520 160,505 240,525 320,508 400,524 480,506 560,526 640,508 720,524 800,506 880,522 960,508 960,540", "#eaf8ff");
    return s;
  }

  /* ---------------------------------------------------------------- Cubil: roca caliente, río de lava, brasas, huesos y un montón de oro */
  function cubil() {
    let s = R(0, 0, 960, 540, "#2a1d1a") + rep(40, i => R(Math.round(az(i, 920)), Math.round(az(i + 11, 500)), 18 + (i % 4) * 10, 10 + (i % 3) * 6, i % 3 ? "#34241f" : "#221613"));
    s += rep(20, i => P(`${i * 50 - 8},0 ${i * 50 + 24},0 ${i * 50 + 8},${46 + (i % 5) * 24}`, i % 2 ? "#3a2824" : "#2e1f1b"));
    // Grietas con resplandor
    s += `<g fill="none" stroke="#ff8a2a" stroke-width="3" class="co-brasa"><path d="M80 120 L120 170 L100 220 L150 280"/><path d="M860 90 L820 150 L850 210 L800 260"/><path d="M480 40 L460 100 L500 150"/></g>`;
    // Repisas de roca
    s += P("90,430 100,410 260,404 280,430", "#4a3430") + P("230,360 250,340 400,336 420,360", "#4a3430") + P("560,436 570,418 720,414 740,436", "#4a3430") + P("690,380 700,360 830,356 850,380", "#4a3430") + P("800,452 810,432 930,430 940,452", "#4a3430") + P("540,276 552,258 670,256 690,276", "#4a3430");
    // Huesos a la izquierda, oro a la derecha, nido de cenizas al centro
    s += rep(5, i => `<path d="M${50 + i * 14} 470 Q${60 + i * 14} 430 ${80 + i * 14} 470" fill="none" stroke="#e9dcc0" stroke-width="5"/>`) + C(150, 462, 16, "#e9dcc0") + R(142, 458, 5, 7, "#1c1422") + R(153, 458, 5, 7, "#1c1422") + R(144, 474, 12, 5, "#e9dcc0");
    s += P("700,500 770,440 860,440 930,500", "#d4a43a") + P("720,500 780,456 850,456 910,500", "#e8b84a") + rep(14, i => R(Math.round(720 + az(i, 190)), 450 + Math.round(az(i + 1, 40)), 8, 3, "#fff1b0")) + rep(4, i => `<g class="co-brillo" style="animation-delay:${-i * 0.7}s">${R(740 + i * 44, 444 + (i % 2) * 14, 4, 4, "#ffffff")}${R(737 + i * 44, 445 + (i % 2) * 14, 10, 2, "#ffffff", ' opacity=".7"')}</g>`);
    s += E(450, 464, 140, 24, "#1c1412") + E(450, 458, 124, 18, "#3a2a24") + rep(9, i => R(360 + i * 22, 450 + (i % 3) * 5, 14, 3, "#5a4540")) + E(420, 452, 12, 9, "#e9dcc0") + R(412, 448, 16, 5, "#d9d2bd") + E(500, 450, 10, 8, "#e9dcc0");
    // Río de lava que corre, calor y brasas
    s += R(0, 486, 960, 54, "#c84a1a") + R(0, 494, 960, 46, "#e0662a") + rep(6, i => R(i * 220, 500 + (i % 3) * 12, 120, 6, "#ffb347", ` class="co-lava" style="animation-delay:${-i * 1.4}s"`)) + R(0, 484, 960, 4, "#ffb347", ' opacity=".7"') + C(480, 520, 320, "#ff8a2a", ' fill-opacity=".1" class="co-brasa"');
    s += rep(16, i => `<g class="co-ascua" style="animation-delay:${-i * 0.65}s;--x:${30 + i * 58}px">${R(0, 0, 3, 3, i % 2 ? "#ffb347" : "#ff6a2a")}</g>`);
    s += `<g class="co-capa"></g>`;
    s += R(0, 534, 960, 6, "#c84a1a", ' opacity=".6"');
    return s;
  }

  const ESCENAS = { aviario, bosque, madriguera, pantano, glaciar, cubil };
  const FONDO = { aviario: "#6b8a4a", bosque: "#4a7a3a", madriguera: "#2a1c12", pantano: "#2f5c5a", glaciar: "#bfe3f0", cubil: "#2a1d14" };
  const AMBIENTE = { aviario: "exterior", bosque: "exterior", pantano: "exterior", madriguera: "cerrado", glaciar: "cerrado", cubil: "cerrado" };

  function escena(habitat) { return (ESCENAS[habitat] || bosque)(); }
  return { escena, SITIOS, PAREJA, FONDO, AMBIENTE };
})();
