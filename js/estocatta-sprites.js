/* Estocatta: dibujo del luchador en pixel art.
   Todo se dibuja con rectángulos de 1 píxel sobre un lienzo pequeño (480×270) que la
   página amplía sin suavizado, así que los bordes salen nítidos. Es el arte
   PROVISIONAL: el juego no depende de él. Para cambiarlo por hojas de sprites hechas a
   mano basta con colocar assets/estocatta/luchador.png y luchador.json (ver
   docs/estocatta.md): si existen se usan en lugar de este dibujo, sin tocar las reglas.

   Una unidad lógica del juego son medio píxel (2 unidades = 1 px). Los pies están en
   el punto (x, suelo) y todo lo demás se mide hacia arriba. */
(function () {
  const ALTO_PX = 46;

  const PALETAS = [
    { tunica: "#c4452f", oscura: "#7d241a", ribete: "#e8c872", pelo: "#3a2418", sombra: "rgba(0,0,0,.28)", brillo: "#ffd9a0" },
    { tunica: "#2f7fa8", oscura: "#1c4a66", ribete: "#d9e4ea", pelo: "#1b1b24", sombra: "rgba(0,0,0,.28)", brillo: "#bfe9ff" }
  ];
  const PIEL = "#e0b48a", PIEL_SOMBRA = "#b98a63", BOTA = "#2b1d17", ACERO = "#d5dbe0", ACERO_SOMBRA = "#8f9aa3", EMPUNADURA = "#6b4a2a";

  // Altura de la punta de la espada para cada altura (0 alta, 1 media, 2 baja), en px sobre el suelo
  const Y_ESPADA = [-36, -25, -11];

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  /* Línea de píxeles (Bresenham) de grosor 1 o 2. */
  function linea(ctx, x0, y0, x1, y1, c, grosor) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = c;
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(x0, y0, grosor || 1, grosor || 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* Según la animación que manda la simulación, cómo debe verse el cuerpo y la espada.
     Coordenadas relativas a los pies, con x positivo hacia donde mira. */
  function pose(v) {
    const a = v.anim;
    const alt = v.altura;
    const yE = Y_ESPADA[alt];
    const base = a.split("_")[0];
    const fase = a.split("_")[1] || "";
    const p = {
      piernas: "parado", inclina: 0, bajaCuerpo: 0, mano: [8, -27], punta: [32, yE], tipo: "guardia",
      paso: 0, brillo: false, aturdido: false
    };
    if (alt === 0) p.mano = [9, -33]; else if (alt === 2) p.mano = [9, -20];
    const alturaGolpe = v.altAccion !== undefined ? v.altAccion : alt;
    const yG = Y_ESPADA[alturaGolpe];
    const manoG = alturaGolpe === 0 ? -33 : alturaGolpe === 2 ? -20 : -27;

    if (base === "caminar" || base === "correr") {
      const ciclo = Math.floor(v.t / (base === "correr" ? 90 : 150)) % 2;
      p.piernas = ciclo ? "pasoA" : "pasoB";
      p.inclina = base === "correr" ? 2 : 0;
      p.punta = [30, yE];
    } else if (base === "agachado") {
      p.piernas = "agachado"; p.bajaCuerpo = 14; p.mano = [9, -14 + (alt - 1) * 3]; p.punta = [30, yE + 13];
    } else if (base === "salto") {
      p.piernas = "recogido"; p.punta = [28, yE + 2];
    } else if (base === "guardia") {
      p.tipo = "guardia"; p.mano = [9, yE]; p.punta = [10, yE - 11]; p.cuchilla = "vertical";
    } else if (base === "aterriza") {
      p.piernas = "agachado"; p.bajaCuerpo = 6;
    } else if (base === "aturdido") {
      p.piernas = "agachado"; p.bajaCuerpo = 5; p.inclina = -2; p.mano = [4, -16]; p.punta = [10, -4]; p.aturdido = true;
    } else if (base === "estocada") {
      if (fase === "prep") { p.piernas = "pasoB"; p.inclina = -3; p.mano = [1, manoG]; p.punta = [34, yG + (manoG - yG)]; }
      else if (fase === "impacto") { p.piernas = "estocada"; p.inclina = 4; p.mano = [22, yG]; p.punta = [66, yG]; p.brillo = true; }
      else { p.piernas = "estocada"; p.inclina = 4; p.mano = [20, yG + 3]; p.punta = [62, yG + 8]; }
    } else if (base === "tajo") {
      if (fase === "prep") { p.piernas = "pasoB"; p.inclina = -4; p.mano = [-1, -42]; p.punta = [-14, -58]; }
      else if (fase === "impacto") { p.piernas = "estocada"; p.inclina = 3; p.mano = [18, yG]; p.punta = [80, yG]; p.brillo = true; p.arco = alturaGolpe; }
      else { p.piernas = "estocada"; p.inclina = 4; p.mano = [16, -14]; p.punta = [60, -3]; }
    } else if (base === "finta") {
      if (fase === "prep") { p.piernas = "pasoA"; p.inclina = 2; p.mano = [10, manoG]; p.punta = [44, yG]; p.brillo = true; }
      else { p.piernas = "pasoB"; p.mano = [6, yE]; p.punta = [28, yE + 2]; }
    } else if (base === "parada") {
      if (fase === "ventana") { p.mano = [10, -30]; p.punta = [18, yE - 14]; p.cuchilla = "vertical"; p.brillo = true; p.piernas = "pasoB"; }
      else { p.piernas = "agachado"; p.bajaCuerpo = 4; p.mano = [4, -17]; p.punta = [16, -6]; }
    }
    return p;
  }

  function dibujarPiernas(ctx, p, tunica) {
    const y = -p.bajaCuerpo;
    const botas = BOTA;
    if (p.piernas === "parado") { rect(ctx, -4, y - 18, 3, 18, tunica.oscura); rect(ctx, 1, y - 18, 3, 18, tunica.oscura); rect(ctx, -5, y - 3, 4, 3, botas); rect(ctx, 1, y - 3, 4, 3, botas); }
    else if (p.piernas === "pasoA") { rect(ctx, -5, y - 18, 3, 18, tunica.oscura); rect(ctx, 3, y - 16, 3, 14, tunica.oscura); rect(ctx, -6, y - 3, 4, 3, botas); rect(ctx, 3, y - 3 - 2, 4, 3, botas); }
    else if (p.piernas === "pasoB") { rect(ctx, -2, y - 18, 3, 18, tunica.oscura); rect(ctx, -6, y - 16, 3, 14, tunica.oscura); rect(ctx, -2, y - 3, 4, 3, botas); rect(ctx, -7, y - 3 - 2, 4, 3, botas); }
    else if (p.piernas === "estocada") { rect(ctx, -8, y - 13, 3, 13, tunica.oscura); rect(ctx, -9, y - 3, 4, 3, botas); linea(ctx, 2, y - 16, 10, y - 2, tunica.oscura, 3); rect(ctx, 9, y - 3, 5, 3, botas); }
    else if (p.piernas === "agachado") { rect(ctx, -5, y - 10, 4, 10, tunica.oscura); rect(ctx, 1, y - 10, 5, 10, tunica.oscura); rect(ctx, -6, y - 3, 5, 3, botas); rect(ctx, 1, y - 3, 6, 3, botas); }
    else if (p.piernas === "recogido") { rect(ctx, -4, y - 16, 4, 9, tunica.oscura); rect(ctx, 0, y - 15, 5, 7, tunica.oscura); rect(ctx, -5, y - 9, 5, 3, botas); rect(ctx, 1, y - 8, 5, 3, botas); }
  }

  function dibujarEspada(ctx, p, t) {
    const [hx, hy] = p.mano, [px, py] = p.punta;
    if (p.arco !== undefined) {
      // tajo: se ve el barrido
      const a = p.arco;
      const y0 = a === 0 ? -50 : a === 1 ? -50 : -34;
      const y1 = a === 0 ? -22 : a === 1 ? -6 : -4;
      for (let i = 0; i <= 5; i++) {
        const k = i / 5;
        const ax = hx + 6 + Math.sin(k * Math.PI) * 56, ay = y0 + (y1 - y0) * k;
        rect(ctx, ax, ay, 2, 2, i % 2 ? "rgba(255,255,255,.65)" : "rgba(255,240,200,.45)");
      }
    }
    if (p.cuchilla === "vertical") {
      // la espada se sostiene de punta para parar: se ve una hoja vertical a la altura del bloqueo
      const cx = hx + 1;
      linea(ctx, cx, hy + 10, cx, hy - 11, ACERO, 2);
      rect(ctx, cx - 3, hy + 9, 8, 2, EMPUNADURA);
      if (p.brillo) { rect(ctx, cx - 3, hy - 5, 8, 1, "#ffffff"); rect(ctx, cx - 1, hy - 8, 4, 1, "#fff6c8"); }
      return;
    }
    linea(ctx, hx, hy, px, py, ACERO, 2);
    linea(ctx, hx, hy + 1, px, py + 1, ACERO_SOMBRA, 1);
    // guarda y empuñadura
    const dx = px - hx, dy = py - hy; const largo = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / largo * 3, ny = dx / largo * 3;
    linea(ctx, hx + nx, hy + ny, hx - nx, hy - ny, EMPUNADURA, 2);
    if (p.brillo) rect(ctx, px + 1, py - 1, 2, 2, "#ffffff");
  }

  /* Dibuja un luchador. v: { x, suelo (en px), alto (px sobre el suelo), cara, anim, altura,
     altAccion, t (ms de animación), proteccion, vivo, muerteT (0..1) }. */
  function dibujarLuchador(ctx, v, idPaleta, ms) {
    const col = PALETAS[idPaleta];
    ctx.save();
    ctx.translate(Math.round(v.x), Math.round(v.suelo));
    // sombra en el suelo (se encoge si salta)
    const e = Math.max(4, 11 - v.alto * 0.08);
    ctx.fillStyle = col.sombra; ctx.fillRect(-Math.round(e), -1, Math.round(e * 2), 2);
    ctx.translate(0, -Math.round(v.alto));
    if (v.cara < 0) ctx.scale(-1, 1);

    if (!v.vivo) { dibujarCaido(ctx, col, v); ctx.restore(); return; }
    if (v.proteccion && Math.floor(ms / 90) % 2 === 0) ctx.globalAlpha = 0.45;

    const p = pose(v);
    dibujarPiernas(ctx, p, col);
    const b = p.bajaCuerpo, lean = p.inclina;
    // torso
    rect(ctx, -5 + (lean > 0 ? 1 : 0), -35 + b * 0.0 - b, 10, 17, col.tunica);
    rect(ctx, -5, -21 - b, 10, 2, col.ribete);               // cinturón
    rect(ctx, -5, -35 - b, 10, 2, col.oscura);               // hombros
    rect(ctx, -6 - (lean < 0 ? 1 : 0), -33 - b, 2, 9, col.oscura); // espalda (capa)
    // cabeza
    const hx = lean * 0.5;
    rect(ctx, -4 + hx, -44 - b, 8, 8, PIEL);
    rect(ctx, -4 + hx, -44 - b, 8, 3, col.pelo);
    rect(ctx, -5 + hx, -43 - b, 2, 6, col.pelo);
    rect(ctx, 1 + hx, -41 - b, 2, 2, "#1d1410");              // ojo
    rect(ctx, 2 + hx, -38 - b, 2, 1, PIEL_SOMBRA);
    // brazo trasero y delantero
    const [mx, my] = p.mano;
    linea(ctx, 2, -32 - b, mx, my - b * 0.0, PIEL_SOMBRA, 3);
    linea(ctx, 3, -33 - b, mx, my, col.tunica, 2);
    rect(ctx, mx - 1, my - 1, 3, 3, PIEL);
    const pAjustada = Object.assign({}, p, { mano: [mx, my], punta: p.punta });
    dibujarEspada(ctx, pAjustada, v.t);
    if (p.aturdido) {
      for (let i = 0; i < 3; i++) {
        const a = ms / 180 + i * 2.1;
        rect(ctx, Math.cos(a) * 8 - 1, -52 - b + Math.sin(a) * 3, 3, 3, "#ffe27a");
      }
    }
    if (v.contra) rect(ctx, -2, -56 - b, 5, 3, "#fff6c8");
    ctx.restore();
  }

  function dibujarCaido(ctx, col, v) {
    const k = Math.min(1, v.muerteT || 0);        // 0 recién caído … 1 a punto de reaparecer
    // cae de lado y queda tendido
    rect(ctx, -13, -6, 26, 6, col.oscura);
    rect(ctx, -10, -9, 18, 4, col.tunica);
    rect(ctx, 9, -9, 6, 6, PIEL);
    rect(ctx, 9, -9, 6, 2, col.pelo);
    rect(ctx, -2, -4, 14, 2, "#7a1020");
    if (k < 0.15) { for (let i = 0; i < 8; i++) rect(ctx, -10 + i * 3, -10 - (i % 3) * 5 - k * 30, 2, 2, "#b3202e"); }
    linea(ctx, -18, -3, -4, -3, ACERO_SOMBRA, 2);
  }

  /* Chispas, destellos y otros efectos de un instante. */
  function dibujarEfecto(ctx, ef, ahora) {
    const edad = (ahora - ef.t0) / ef.dur;
    if (edad >= 1) return false;
    ctx.save();
    ctx.translate(Math.round(ef.x), Math.round(ef.y));
    if (ef.tipo === "chispas") {
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + ef.semilla;
        const r = edad * (14 + (i % 3) * 6);
        rect(ctx, Math.cos(a) * r, Math.sin(a) * r - edad * 6, 2, 2, i % 2 ? "#fff6c8" : ef.color || "#ffd27a");
      }
    } else if (ef.tipo === "onda") {
      const r = 4 + edad * 22;
      ctx.strokeStyle = ef.color || "#ffffff"; ctx.globalAlpha = 1 - edad; ctx.lineWidth = 2;
      ctx.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);
    } else if (ef.tipo === "sangre") {
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI * (0.15 + 0.7 * ((i * 37) % 100) / 100) + ef.semilla * 0.2;
        const r = edad * (14 + (i % 4) * 8);
        rect(ctx, Math.cos(a) * r * ef.dir, Math.sin(a) * r + edad * edad * 20, 2, 2, i % 3 ? "#b3202e" : "#7a1020");
      }
    } else if (ef.tipo === "texto") {
      ctx.globalAlpha = 1 - edad * edad;
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#000"; ctx.fillText(ef.texto, 1, -edad * 14 + 1);
      ctx.fillStyle = ef.color || "#fff6c8"; ctx.fillText(ef.texto, 0, -edad * 14);
    }
    ctx.restore();
    return true;
  }

  window.EstocattaSprites = { dibujarLuchador, dibujarEfecto, PALETAS, ALTO_PX, Y_ESPADA, rect, linea };
})();
