/* Aspecto de la arquería: un valle de bosque que pasa de la hora dorada a la noche mientras corre
   el minuto, con montañas lejanas, pinares en capas, nubes, aves y luciérnagas, todo en colores lisos.
   También dibuja el marcador, las pantallas de inicio y fin y los efectos de cada tiro.

   Pensado para no pesar: el paisaje (montañas, pinos, pradera) se dibuja UNA vez en un lienzo
   aparte al medir la pantalla y después solo se copia. Todo lo que se mueve (nubes, aves,
   luciérnagas, estrellas) son pocos dibujos pequeños calculados a partir del tiempo, sin estado.
   No se usan degradados, sombras difuminadas, filtros ni modos de mezcla. */
(function () {
  "use strict";

  const TITULO = '"IM Fell English SC", Georgia, "Times New Roman", serif';
  const NUMEROS = '"Karla", "Segoe UI", Arial, sans-serif';
  const MARGEN = 12; // el paisaje sobra unos píxeles por cada lado para que la sacudida no deje bordes

  function generador(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mezcla = (a, b, t) => a + (b - a) * t;
  const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function color(c1, c2, t) {
    return `rgb(${Math.round(mezcla(c1[0], c2[0], t))},${Math.round(mezcla(c1[1], c2[1], t))},${Math.round(mezcla(c1[2], c2[2], t))})`;
  }
  function lienzo(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rectRedondo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Cielo: de la hora dorada (0) a la noche (1)
  const CIELO_ARRIBA = [[24, 44, 78], [6, 10, 26]];
  const CIELO_MEDIO = [[150, 96, 112], [30, 26, 62]];
  const CIELO_HORIZONTE = [[246, 186, 112], [104, 64, 92]];
  const FRANJAS = 8;

  function crear({ ancho, alto }) {
    let sx = 1;
    let sy = 1;
    let paisaje = null;
    let sol = null;
    let nubes = [];
    let luna = null;
    let construido = false;
    const horizonte = alto * 0.62;

    const azar = generador(20261);
    const estrellas = Array.from({ length: 70 }, () => ({ x: azar() * ancho, y: azar() * alto * 0.5, r: 0.6 + azar() * 1.3, f: azar() * 6.28, v: 1 + azar() * 2 }));
    const luciernagas = Array.from({ length: 24 }, () => ({ x: azar() * ancho, y: alto * (0.5 + azar() * 0.45), fx: 0.2 + azar() * 0.5, fy: 0.3 + azar() * 0.6, px: azar() * 6.28, py: azar() * 6.28, f: azar() * 6.28, amp: 12 + azar() * 30 }));

    /* --- Sprites (a media resolución) ------------------------------------------------------- */
    function construirSol() {
      const R = 330;
      const k = 0.5;
      const c = lienzo(R * 2 * sx * k, R * 2 * sy * k);
      const g = c.getContext("2d");
      g.setTransform(sx * k, 0, 0, sy * k, 0, 0);
      g.fillStyle = "#ffd98a";
      g.beginPath(); g.arc(R, R, 46, 0, Math.PI * 2); g.fill();
      return c;
    }

    function construirLuna() {
      const R = 70;
      const k = 0.5;
      const c = lienzo(R * 2 * sx * k, R * 2 * sy * k);
      const g = c.getContext("2d");
      g.setTransform(sx * k, 0, 0, sy * k, 0, 0);
      g.fillStyle = "#eef1ff";
      g.beginPath(); g.arc(R, R, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(160,170,210,.35)";
      g.beginPath(); g.arc(R - 7, R - 4, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(R + 8, R + 6, 3.5, 0, Math.PI * 2); g.fill();
      return c;
    }

    function construirNube(w, h, semilla) {
      const k = 0.5;
      const c = lienzo(w * sx * k, h * sy * k);
      const g = c.getContext("2d");
      g.setTransform(sx * k, 0, 0, sy * k, 0, 0);
      const a = generador(semilla);
      // Cada nube son varias manchas alargadas (se aplastan en vertical): parecen estratos, no bolas
      for (let i = 0; i < 10; i++) {
        const x = w * (0.3 + a() * 0.4);
        const y = h * (0.5 + (a() - 0.5) * 0.3);
        const alargado = 2.0 + a() * 0.9;
        // la mancha no puede salirse del sprite, o se vería el corte recto en el cielo
        const r = Math.min(h * (0.5 + a() * 0.25), (Math.min(x, w - x) - 3) / alargado);
        g.save();
        g.translate(x, y);
        g.scale(alargado, 0.42);
        g.fillStyle = "#f3cdb4";
        g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      return c;
    }

    /* --- Paisaje: se dibuja una sola vez --------------------------------------------------- */
    function pino(g, x, yBase, h, tono) {
      const ancha = h * 0.46;
      g.fillStyle = tono;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const top = yBase - h + i * h * 0.26;
        const bajo = yBase - h * 0.18 - (2 - i) * h * 0.14;
        const w = ancha * (0.45 + i * 0.28);
        g.moveTo(x, top);
        g.lineTo(x + w, bajo);
        g.lineTo(x - w, bajo);
        g.closePath();
      }
      g.fill();
      g.fillRect(x - h * 0.03, yBase - h * 0.2, h * 0.06, h * 0.2);
    }

    function cresta(g, base, amplitud, ondas, dentado, colorArriba, hasta) {
      const a = generador(base * 13 + ondas.length);
      const ph = ondas.map(() => a() * 6.28);
      g.beginPath();
      g.moveTo(-MARGEN, hasta);
      const puntos = [];
      for (let x = -MARGEN; x <= ancho + MARGEN; x += 6) {
        let y = 0;
        ondas.forEach(([f, p], i) => {
          const s = Math.sin(x * f + ph[i]);
          y += p * (dentado ? 1 - Math.abs(s) * 1.0 : s);
        });
        const yy = base - amplitud * y;
        puntos.push([x, yy]);
        g.lineTo(x, yy);
      }
      g.lineTo(ancho + MARGEN, hasta);
      g.closePath();
      g.fillStyle = colorArriba;
      g.fill();
      return puntos;
    }

    function construirPaisaje() {
      const c = lienzo((ancho + MARGEN * 2) * sx, (alto + MARGEN * 2) * sy);
      const g = c.getContext("2d");
      g.setTransform(sx, 0, 0, sy, MARGEN * sx, MARGEN * sy);
      const a = generador(42);

      // Montañas lejanas: azules y violetas
      const lejos = cresta(g, horizonte - 52, 62, [[0.011, 0.5], [0.027, 0.3], [0.061, 0.2]], true, "#5a5f82", horizonte + 30);
      // un toque de nieve/luz en las cumbres más altas
      g.fillStyle = "rgba(255,226,196,.22)";
      lejos.forEach(([x, y], i) => { if (i % 5 === 0 && y < horizonte - 96) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + 22); g.lineTo(x - 14, y + 22); g.closePath(); g.fill(); } });

      // Colinas medias con pinos pequeños
      const medio = cresta(g, horizonte + 8, 30, [[0.008, 0.6], [0.022, 0.4]], false, "#33504a", horizonte + 80);
      for (let i = 0; i < 90; i++) {
        const idx = Math.floor(a() * medio.length);
        const [x, y] = medio[idx];
        pino(g, x, y + 3, 16 + a() * 22, a() < 0.5 ? "#223a32" : "#2a443b");
      }

      // Bosque cercano: pinos más grandes y oscuros
      const cerca = cresta(g, horizonte + 56, 22, [[0.012, 0.55], [0.031, 0.45]], false, "#203a2b", horizonte + 150);
      for (let i = 0; i < 56; i++) {
        const idx = Math.floor(a() * cerca.length);
        const [x, y] = cerca[idx];
        pino(g, x, y + 8 + a() * 26, 44 + a() * 56, a() < 0.5 ? "#16291d" : "#1b3323");
      }

      // Pradera del primer plano
      const suelo = alto * 0.8;
      g.fillStyle = "#264321";
      g.beginPath();
      g.moveTo(-MARGEN, suelo);
      for (let x = -MARGEN; x <= ancho + MARGEN; x += 12) g.lineTo(x, suelo - 8 * Math.sin(x * 0.01 + 1) - 5 * Math.sin(x * 0.027));
      g.lineTo(ancho + MARGEN, alto + MARGEN);
      g.lineTo(-MARGEN, alto + MARGEN);
      g.closePath();
      g.fill();

      // Hierba
      g.lineCap = "round";
      for (let i = 0; i < 360; i++) {
        const x = -MARGEN + a() * (ancho + MARGEN * 2);
        const y = suelo - 6 + a() * (alto - suelo + MARGEN + 6);
        const prof = (y - suelo) / (alto - suelo + MARGEN);
        const largo = 7 + a() * 14 + prof * 14;
        g.strokeStyle = ["#4c7a36", "#3a6a2c", "#5e8c3e", "#2c5224"][Math.floor(a() * 4)];
        g.lineWidth = 1 + prof * 1.3;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (a() - 0.5) * 8, y - largo * 0.6, x + (a() - 0.5) * 12, y - largo);
        g.stroke();
      }
      // Florecillas
      for (let i = 0; i < 46; i++) {
        const x = a() * ancho;
        const y = suelo + 6 + a() * (alto - suelo - 6);
        g.fillStyle = ["#f6e7a8", "#f4b8c8", "#d4dcff", "#ffffff"][Math.floor(a() * 4)];
        g.beginPath(); g.arc(x, y, 1.4 + a() * 1.2, 0, Math.PI * 2); g.fill();
      }
      // Arbustos en los bordes
      function arbusto(x, y, escala) {
        for (let i = 0; i < 9; i++) {
          const r = (14 + a() * 16) * escala;
          const dx = (a() - 0.5) * 70 * escala;
          const dy = -a() * 22 * escala;
          g.fillStyle = i % 3 === 0 ? "#1d3a1e" : "#15301a";
          g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "rgba(120,170,80,.35)";
        for (let i = 0; i < 7; i++) {
          g.beginPath(); g.arc(x + (a() - 0.5) * 60 * escala, y - 14 * escala - a() * 14 * escala, 2.5 * escala, 0, Math.PI * 2); g.fill();
        }
      }
      arbusto(34, alto - 8, 1.3);
      arbusto(120, alto + 6, 1);
      arbusto(ancho - 40, alto - 10, 1.4);
      arbusto(ancho - 140, alto + 6, 0.9);
      return c;
    }

    function redimensionar(w, h) {
      sx = w / ancho;
      sy = h / alto;
      paisaje = construirPaisaje();
      sol = construirSol();
      luna = construirLuna();
      nubes = [
        { img: construirNube(320, 90, 1), y: 70, v: 7, x0: 80, a: 0.9 },
        { img: construirNube(260, 74, 2), y: 150, v: 11, x0: 520, a: 0.8 },
        { img: construirNube(380, 100, 3), y: 118, v: 5, x0: 800, a: 0.7 },
        { img: construirNube(220, 64, 4), y: 215, v: 9, x0: 300, a: 0.6 },
        { img: construirNube(300, 80, 5), y: 36, v: 13, x0: 650, a: 0.55 }
      ];
      construido = true;
    }

    /* --- Fondo animado ---------------------------------------------------------------------- */
    function fondo(ctx, { t, fase }) {
      if (!construido) return;
      const noche = suave(0.35, 1, fase);

      // Cielo: franjas lisas, de la más alta (arriba) a la del horizonte
      const alturaCielo = horizonte + 10 + MARGEN;
      for (let i = 0; i < FRANJAS; i++) {
        const u = (i + 0.5) / FRANJAS;
        const c = u < 0.55
          ? [0, 1, 2].map(j => mezcla(mezcla(CIELO_ARRIBA[0][j], CIELO_ARRIBA[1][j], fase), mezcla(CIELO_MEDIO[0][j], CIELO_MEDIO[1][j], fase), u / 0.55))
          : [0, 1, 2].map(j => mezcla(mezcla(CIELO_MEDIO[0][j], CIELO_MEDIO[1][j], fase), mezcla(CIELO_HORIZONTE[0][j], CIELO_HORIZONTE[1][j], fase), (u - 0.55) / 0.45));
        ctx.fillStyle = `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
        const y0 = -MARGEN + Math.floor(alturaCielo * i / FRANJAS);
        const y1 = -MARGEN + Math.ceil(alturaCielo * (i + 1) / FRANJAS);
        ctx.fillRect(-MARGEN, y0, ancho + MARGEN * 2, y1 - y0);
      }
      ctx.fillStyle = color(CIELO_HORIZONTE[0], CIELO_HORIZONTE[1], fase);
      ctx.fillRect(-MARGEN, horizonte, ancho + MARGEN * 2, alto - horizonte + MARGEN);

      // Estrellas (solo con la luz baja)
      if (noche > 0.05) {
        ctx.fillStyle = "#fff";
        for (let i = 0; i < estrellas.length; i++) {
          const s = estrellas[i];
          ctx.globalAlpha = noche * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.7 * s.v + s.f))) * (1 - s.y / (alto * 0.62));
          ctx.fillRect(s.x, s.y, s.r * 1.6, s.r * 1.6);
        }
        ctx.globalAlpha = 1;
      }

      // Luna
      if (noche > 0.2) {
        ctx.globalAlpha = Math.min(1, (noche - 0.2) * 1.4);
        ctx.drawImage(luna, 170 - 70, 120 - 70 + Math.sin(t * 0.2) * 3, 140, 140);
        ctx.globalAlpha = 1;
      }

      // Sol: se hunde detrás de las montañas
      const solY = horizonte - 118 + fase * 160;
      const solA = 1 - suave(0.5, 0.95, fase);
      if (solA > 0.01) {
        ctx.globalAlpha = solA;
        ctx.drawImage(sol, 720 - 330, solY - 330, 660, 660);
        ctx.globalAlpha = 1;
      }

      // Nubes
      const claras = 1 - noche * 0.55;
      for (const n of nubes) {
        const w = n.img.width / sx * 2;
        const h = n.img.height / sy * 2;
        const x = ((n.x0 + t * n.v) % (ancho + w * 2)) - w;
        ctx.globalAlpha = n.a * claras;
        ctx.drawImage(n.img, x, n.y, w, h);
      }
      ctx.globalAlpha = 1;

      // Paisaje
      ctx.drawImage(paisaje, -MARGEN, -MARGEN, ancho + MARGEN * 2, alto + MARGEN * 2);

      // Aves cruzando el cielo (una cada 14 segundos)
      const ciclo = Math.floor(t / 14);
      const avance = (t % 14) / 9;
      if (avance < 1 && fase < 0.8) {
        const a = generador(ciclo * 31 + 5);
        const y0 = 70 + a() * 120;
        const dir = ciclo % 2 ? 1 : -1;
        ctx.strokeStyle = "rgba(20,24,40,.75)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        const x = dir === 1 ? -30 + avance * (ancho + 90) : ancho + 30 - avance * (ancho + 90);
        for (let i = 0; i < 3; i++) {
          const ox = x - dir * i * 26 + (i % 2) * 8;
          const oy = y0 + i * 12 + Math.sin(t * 2 + i) * 6;
          const ala = Math.sin(t * 9 + i * 1.7) * 5;
          ctx.beginPath();
          ctx.moveTo(ox - 9, oy - ala);
          ctx.quadraticCurveTo(ox - 3, oy - 3 - ala * 0.4, ox, oy);
          ctx.quadraticCurveTo(ox + 3, oy - 3 - ala * 0.4, ox + 9, oy - ala);
          ctx.stroke();
        }
      }

      // Luciérnagas y motas de polen
      const brillo = 0.22 + noche * 0.78;
      for (let i = 0; i < luciernagas.length; i++) {
        const l = luciernagas[i];
        const x = l.x + Math.sin(t * l.fx + l.px) * l.amp;
        const y = l.y + Math.sin(t * l.fy + l.py) * l.amp * 0.6;
        const p = (0.45 + 0.55 * Math.sin(t * 2.2 + l.f)) * brillo;
        ctx.globalAlpha = Math.min(1, p * 1.2);
        ctx.fillStyle = "#fbffd0";
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // La noche cae sobre todo lo anterior
      if (noche > 0.01) {
        ctx.fillStyle = "rgba(10,14,48,1)";
        ctx.globalAlpha = noche * 0.42;
        ctx.fillRect(-MARGEN, -MARGEN, ancho + MARGEN * 2, alto + MARGEN * 2);
        ctx.globalAlpha = 1;
      }
    }

    /* --- Marcador ---------------------------------------------------------------------------- */
    function placa(ctx, x, y, w, h, borde) {
      rectRedondo(ctx, x, y, w, h, 12);
      ctx.fillStyle = "rgba(10,18,12,.62)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = borde;
      ctx.stroke();
      rectRedondo(ctx, x + 4, y + 4, w - 8, h - 8, 9);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,236,190,.14)";
      ctx.stroke();
    }

    function hud(ctx, d) {
      const total = Math.max(60, d.puntaje, d.puntajeRival, 1) * 1.15;
      ctx.textBaseline = "alphabetic";

      // Jugador
      placa(ctx, 20, 16, 270, 82, "rgba(209,173,85,.75)");
      ctx.textAlign = "left";
      ctx.font = `600 15px ${TITULO}`;
      ctx.fillStyle = "#d9c07a";
      ctx.fillText(d.nombre.toUpperCase(), 38, 40);
      ctx.font = `800 40px ${NUMEROS}`;
      ctx.fillStyle = "#fff6dc";
      ctx.fillText(String(d.puntaje), 36, 80);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      rectRedondo(ctx, 150, 62, 120, 8, 4); ctx.fill();
      ctx.fillStyle = "#e9c764";
      rectRedondo(ctx, 150, 62, Math.max(8, 120 * Math.min(1, d.puntaje / total)), 8, 4); ctx.fill();

      // Rival
      placa(ctx, ancho - 290, 16, 270, 82, d.destelloRival > 0 ? "#ffffff" : d.colorRival);
      ctx.textAlign = "right";
      ctx.font = `600 15px ${TITULO}`;
      ctx.fillStyle = d.colorRival;
      ctx.fillText(d.nombreRival.toUpperCase(), ancho - 38, 40);
      ctx.font = `800 40px ${NUMEROS}`;
      ctx.fillStyle = d.destelloRival > 0 ? "#ffffff" : "#fff6dc";
      ctx.fillText(String(d.puntajeRival), ancho - 36, 80);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      rectRedondo(ctx, ancho - 270, 62, 120, 8, 4); ctx.fill();
      ctx.fillStyle = d.colorRival;
      const wr = Math.max(8, 120 * Math.min(1, d.puntajeRival / total));
      rectRedondo(ctx, ancho - 150 - wr, 62, wr, 8, 4); ctx.fill();

      // Reloj redondo
      const cx = ancho / 2;
      const cy = 56;
      const restante = Math.max(0, d.duracion - d.tiempo);
      const frac = restante / d.duracion;
      const urgente = restante <= 10;
      const pulso = urgente ? 1 + 0.06 * Math.sin(d.reloj * 10) : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulso, pulso);
      ctx.fillStyle = "rgba(10,18,12,.68)";
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.arc(0, 0, 33, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = urgente ? "#ff7a5c" : "#e9c764";
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 28px ${NUMEROS}`;
      ctx.fillStyle = urgente ? "#ffb4a0" : "#fff6dc";
      ctx.fillText(String(Math.ceil(restante)), 0, 2);
      ctx.restore();
      ctx.textBaseline = "alphabetic";
    }

    /* --- Pantallas de inicio y fin ------------------------------------------------------------ */
    function pantalla(ctx, d) {
      ctx.fillStyle = "rgba(6,10,8,.5)";
      ctx.fillRect(-MARGEN, -MARGEN, ancho + MARGEN * 2, alto + MARGEN * 2);
      const reglas = d.reglas || [];
      // En un campo pequeño (móvil) el texto de las reglas se agranda para que siga leyéndose: escala = píxeles de pantalla por unidad del campo
      const letra = Math.max(23, Math.min(32, 12 / (d.escala || 1)));
      const paso = Math.round(letra * 1.4);
      const w = reglas.length ? Math.min(ancho - 40, 680 + (letra - 23) * 14) : 600;
      const h = reglas.length ? 120 + paso * reglas.length : d.sub ? 170 : 130;
      const x = (ancho - w) / 2;
      const y = alto * (reglas.length ? 0.27 : 0.3) - h / 2;
      rectRedondo(ctx, x, y, w, h, 18);
      ctx.fillStyle = "rgba(34,25,14,.95)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#d1ad55";
      ctx.stroke();
      rectRedondo(ctx, x + 8, y + 8, w - 16, h - 16, 12);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,226,160,.35)";
      ctx.stroke();

      // adornos: flechas a los lados del título
      const ty = y + (reglas.length ? 66 : d.sub ? 70 : h / 2 + 2);
      ctx.strokeStyle = "#d1ad55";
      ctx.fillStyle = "#d1ad55";
      ctx.lineWidth = 2;
      for (const lado of [-1, 1]) {
        const x0 = ancho / 2 + lado * (w / 2 - 34);
        const x1 = ancho / 2 + lado * (w / 2 - 76);
        ctx.beginPath(); ctx.moveTo(x0, ty - 10); ctx.lineTo(x1, ty - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, ty - 10); ctx.lineTo(x1 - lado * -9, ty - 16); ctx.lineTo(x1 - lado * -9, ty - 4); ctx.closePath(); ctx.fill();
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `600 ${d.titulo.length > 22 ? 36 : 48}px ${TITULO}`;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillText(d.titulo, ancho / 2 + 2, ty + 2, w - 160);
      ctx.fillStyle = "#f6e9b8";
      ctx.fillText(d.titulo, ancho / 2, ty, w - 160);
      if (d.sub) {
        ctx.font = `700 28px ${NUMEROS}`;
        ctx.fillStyle = "#cdbf94";
        ctx.fillText(d.sub, ancho / 2, ty + 50, w - 80);
      }
      // Reglas: líneas cortas bajo el título, con un filete que las separa
      if (reglas.length) {
        ctx.strokeStyle = "rgba(209,173,85,.4)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 60, ty + 22); ctx.lineTo(x + w - 60, ty + 22); ctx.stroke();
        ctx.font = `600 ${letra}px ${NUMEROS}`;
        ctx.fillStyle = "#d8cba0";
        reglas.forEach((linea, i) => ctx.fillText(linea, ancho / 2, ty + 24 + paso * (i + 1), w - 60));
      }
    }

    /* --- Efectos de cada tiro -------------------------------------------------------------------- */
    function efecto(ctx, e) {
      const k = e.edad / e.vida;
      switch (e.tipo) {
        case "estela": {
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.strokeStyle = "#fff0b8";
          ctx.lineWidth = 2.2 * (1 - k) + 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(e.x0, e.y0);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          break;
        }
        case "anillo": {
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = Math.max(1, 6 * (1 - k));
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "polvo": {
          ctx.fillStyle = "#b9a98a";
          for (let i = 0; i < 5; i++) {
            const a = i * 1.26 + e.fase;
            const d = 6 + k * 22 + i * 2;
            ctx.globalAlpha = (1 - k) * 0.4;
            ctx.beginPath();
            ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6 - k * 8, 3 + k * 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case "pedazo": {
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.rot + e.edad * e.giro);
          ctx.fillStyle = e.color;
          ctx.fillRect(-e.l / 2, -e.l / 4, e.l, e.l / 2);
          ctx.restore();
          break;
        }
        case "chispa": {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 3, 3);
          break;
        }
        default: {
          // texto flotante con contorno
          const grande = e.grande;
          const escala = 1 + (k < 0.15 ? (0.15 - k) * 3 : 0);
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.5);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.scale(escala, escala);
          ctx.font = `800 ${grande ? 40 : (e.chico ? 22 : 30)}px ${NUMEROS}`;
          ctx.lineJoin = "round";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(10,10,6,.8)";
          ctx.strokeText(e.texto, 0, 0);
          ctx.fillStyle = e.color;
          ctx.fillText(e.texto, 0, 0);
          ctx.restore();
          ctx.textBaseline = "alphabetic";
        }
      }
      ctx.globalAlpha = 1;
    }

    return { redimensionar, fondo, hud, pantalla, efecto };
  }

  window.ArqueriaVisual = { crear };
})();
