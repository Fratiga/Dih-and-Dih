/* =============================================================================
   OSTELAR — la escena. Dibuja el tablero, las fichas y todos los efectos
   (golpes, proyectiles, hechizos, chispas, temblor de pantalla) en el canvas.
   Lee los eventos que deja el motor en c.eventos y los convierte en animación;
   el motor no sabe nada de esto.
============================================================================= */
(function (OS) {
  const TS = 64;

  /* --- Paletas por tema de mapa ------------------------------------------------ */
  const PALETAS = {
    claro:   { a: "#2f9e4f", b: "#3cc063", suelo: "#134d27", roca: "#a9adbb", luz: "#d8ffb0", brillo: "#b8ff7a", mota: "#f4ff9a" },
    ruinas:  { a: "#cf9448", b: "#e5ad5c", suelo: "#6b4217", roca: "#b9a99a", luz: "#ffe2a8", brillo: "#ffd27a", mota: "#ffe9b0" },
    pozo:    { a: "#4a1a3a", b: "#632350", suelo: "#1c0716", roca: "#80566a", luz: "#ff8a4a", brillo: "#ff6a2e", mota: "#ffae4d" },
    pantano: { a: "#1f9487", b: "#27b5a4", suelo: "#0a4640", roca: "#7ea396", luz: "#a7ffe8", brillo: "#5cffd6", mota: "#c5ffa0" },
    puente:  { a: "#5546c9", b: "#6e5ef0", suelo: "#1f1666", roca: "#a29cd6", luz: "#cfc6ff", brillo: "#a99aff", mota: "#ffb3f2" },
    pilares: { a: "#3f7bdd", b: "#58a0ff", suelo: "#12337f", roca: "#bcc9ea", luz: "#cfe6ff", brillo: "#8ad0ff", mota: "#ffffff" }
  };

  /* Colores de cada tipo de daño (también para proyectiles y chispas). */
  const COLOR_DANO = {
    fuego: "#ff7a2e", "frío": "#6fe0ff", "relámpago": "#fff36a", trueno: "#b58cff", "necrótico": "#b04dff",
    radiante: "#fff0a8", "ácido": "#a6ff3d", veneno: "#6fe84c", fuerza: "#ff6bd6", "psíquico": "#ff8ae2",
    perforante: "#ffe7c2", cortante: "#ffffff", contundente: "#ffcf8a", elemental: "#ff9a4d", cura: "#5dff9a", arcano: "#c28cff"
  };
  const colorDe = t => COLOR_DANO[t] || "#ffffff";

  const COLOR_ESTADO = {
    derribado: "#ff9a4d", aturdido: "#ffe14d", paralizado: "#ffe14d", apresado: "#ff6bd6", envenenado: "#6fe84c",
    asustado: "#b58cff", cegado: "#9aa4b8", esquivando: "#6fe0ff", ralentizado: "#6fb0ff", bendecido: "#fff0a8",
    furia: "#ff4d3d", marcado: "#ff6b8a", acelerado: "#5dff9a"
  };

  /* --- Utilidades de color --------------------------------------------------------- */
  function rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mezclar(h, otro, t) {
    const a = rgb(h), b = rgb(otro);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  const aclarar = (h, t) => mezclar(h, "#ffffff", t);
  const oscurecer = (h, t) => mezclar(h, "#000000", t);
  const alfa = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const aleatorio = (a, b) => a + Math.random() * (b - a);

  OS.crearEscena = function (canvas) {
    const ctx = canvas.getContext("2d");
    let particulas = [];
    let proyectiles = [];
    let ondas = [];
    let anillosCelda = [];
    let textos = [];
    let sacudida = 0;
    let destello = 0; // pantallazo de color al lanzar un hechizo grande
    let colorDestello = "#fff";
    const vis = new Map();
    let ambiente = [];
    let paleta = PALETAS.claro;
    let ruido = [];

    function reiniciar(c) {
      particulas = []; proyectiles = []; ondas = []; anillosCelda = []; textos = []; sacudida = 0; destello = 0;
      vis.clear();
      paleta = PALETAS[c.tema ? c.tema.id : "claro"] || PALETAS.claro;
      ruido = Array.from({ length: c.alto }, () => Array.from({ length: c.ancho }, () => Math.random()));
      ambiente = Array.from({ length: 34 }, () => ({
        x: Math.random() * c.ancho * TS, y: Math.random() * c.alto * TS, v: aleatorio(6, 20), r: aleatorio(1, 3),
        f: Math.random() * 6.28, color: Math.random() < 0.5 ? paleta.mota : paleta.brillo
      }));
      c.eventos.length = 0;
    }

    function visual(u) {
      let v = vis.get(u.id);
      if (!v) { v = { x: u.x, y: u.y, ox: 0, oy: 0, flash: 0, lunge: null, pv: u.pv, hold: 0, muerte: u.muerto ? 1 : 0, escala: 1, aparece: 0 }; vis.set(u.id, v); }
      return v;
    }
    const centro = u => { const v = visual(u); return { x: v.x * TS + TS / 2, y: v.y * TS + TS / 2 }; };
    const centroCelda = (x, y) => ({ x: x * TS + TS / 2, y: y * TS + TS / 2 });

    /* --- Generadores de efectos ------------------------------------------------ */
    function chispas(x, y, color, n, vel, opciones) {
      const o = Object.assign({ vida: [0.35, 0.8], tam: [2, 5], g: 160, retraso: 0, dir: null, abre: Math.PI * 2 }, opciones);
      for (let i = 0; i < n; i++) {
        const base = o.dir === null ? Math.random() * 6.283 : o.dir + (Math.random() - 0.5) * o.abre;
        const v = aleatorio(vel * 0.3, vel);
        const vida = aleatorio(o.vida[0], o.vida[1]);
        particulas.push({ x, y, vx: Math.cos(base) * v, vy: Math.sin(base) * v, g: o.g, vida, max: vida, color, tam: aleatorio(o.tam[0], o.tam[1]), retraso: o.retraso, luz: true });
      }
    }
    function onda(x, y, color, radio, dur, retraso, grosor) {
      ondas.push({ x, y, color, radio, t: 0, dur, retraso: retraso || 0, grosor: grosor || 5 });
    }
    function texto(x, y, msg, color, retraso, tam) {
      textos.push({ x, y, msg, color, t: 0, retraso: retraso || 0, tam: tam || 24 });
    }

    /* --- Procesar los eventos del motor ---------------------------------------- */
    function procesar(c) {
      if (!c.eventos.length) return 0;
      const evs = c.eventos.splice(0);
      let ret = 0; // cuándo "llega" el golpe de la acción de este lote
      const unidad = id => c.unidades.find(u => u.id === id);
      evs.forEach(ev => {
        if (ev.t === "ataque") {
          const a = unidad(ev.de), b = unidad(ev.a);
          if (!a || !b) return;
          const pa = centro(a), pb = centro(b);
          const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
          const va = visual(a);
          va.lunge = { dx: Math.cos(ang), dy: Math.sin(ang), t: 0, lejos: ev.lejos };
          const color = colorDe(ev.tipo);
          if (ev.lejos) {
            const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
            const dur = Math.max(0.16, Math.min(0.5, d / 900));
            proyectiles.push({ x0: pa.x, y0: pa.y, x1: pb.x, y1: pb.y, t: 0, dur, retraso: 0.08, color, estela: [], tipo: "flecha" });
            ret = 0.08 + dur;
          } else {
            ret = 0.14;
            ondas.push({ x: pb.x, y: pb.y, color: "#fff", radio: 38, t: 0, dur: 0.22, retraso: ret, grosor: 6, arco: ang });
          }
          if (!ev.impacta) {
            texto(pb.x + 18, pb.y - 30, "FALLA", "#c8d0e0", ret, 20);
            chispas(pb.x, pb.y, "#cfd8ff", 6, 130, { retraso: ret, vida: [0.2, 0.4], tam: [1.5, 3], dir: ang, abre: 1.2 });
          } else if (ev.critico) {
            texto(pb.x, pb.y - 52, "¡CRÍTICO!", "#ffe14d", ret, 30);
            onda(pb.x, pb.y, "#ffe14d", 70, 0.4, ret, 8);
            sacudida = Math.max(sacudida, 9);
          }
        } else if (ev.t === "conjuro") {
          const a = unidad(ev.de);
          if (!a) return;
          const pa = centro(a);
          const color = colorDe(ev.tipo);
          const destino = centroCelda(ev.x, ev.y);
          va_pulso(a, color);
          if (ev.propio || (ev.x === a.x && ev.y === a.y && !ev.area)) {
            onda(pa.x, pa.y, color, 70, 0.5, 0, 6);
            chispas(pa.x, pa.y, color, 22, 150, { retraso: 0, g: -40 });
            ret = 0.12;
          } else if (ev.area && (ev.forma === "explosion" || ev.forma === "cono" || ev.forma === "linea")) {
            // el área sale del lanzador
            ret = 0.1;
            ev.area.forEach(k => {
              const q = centroCelda(k.x, k.y);
              const d = Math.hypot(q.x - pa.x, q.y - pa.y);
              anillosCelda.push({ x: k.x, y: k.y, color, t: 0, dur: 0.55, retraso: 0.05 + d / 700 });
              chispas(q.x, q.y, color, 4, 90, { retraso: 0.08 + d / 700, vida: [0.3, 0.6], g: -30 });
            });
            onda(pa.x, pa.y, color, 110, 0.45, 0, 7);
            destello = Math.max(destello, 0.18); colorDestello = color;
          } else {
            const d = Math.hypot(destino.x - pa.x, destino.y - pa.y);
            const dur = Math.max(0.2, Math.min(0.6, d / 800));
            proyectiles.push({ x0: pa.x, y0: pa.y, x1: destino.x, y1: destino.y, t: 0, dur, retraso: 0.12, color, estela: [], tipo: "orbe" });
            ret = 0.12 + dur;
            chispas(pa.x, pa.y, color, 12, 120, { retraso: 0, g: -30 });
            if (ev.area) {
              ev.area.forEach(k => {
                const q = centroCelda(k.x, k.y);
                const dd = Math.hypot(q.x - destino.x, q.y - destino.y);
                anillosCelda.push({ x: k.x, y: k.y, color, t: 0, dur: 0.6, retraso: ret + dd / 600 });
                chispas(q.x, q.y, color, 5, 110, { retraso: ret + dd / 600, vida: [0.3, 0.7], g: -50 });
              });
              onda(destino.x, destino.y, color, 40 + 18 * Math.max(...ev.area.map(k => Math.hypot(k.x - ev.x, k.y - ev.y)), 1), 0.55, ret, 9);
              sacudida = Math.max(sacudida, ev.nivel >= 3 ? 10 : 5);
              destello = Math.max(destello, 0.25); colorDestello = color;
            } else {
              onda(destino.x, destino.y, color, 42, 0.35, ret, 6);
            }
          }
        } else if (ev.t === "dano") {
          const u = unidad(ev.id);
          if (!u) return;
          const p = centro(u);
          const v = visual(u);
          v.hold = Math.max(v.hold, ret);
          v.flash = 0.18 + ret;
          const color = colorDe(ev.tipo);
          const n = Math.max(6, Math.min(46, Math.round(ev.n * 0.8)));
          const origen = ev.de ? unidad(ev.de) : null;
          let dir = null;
          if (origen) { const po = centro(origen); dir = Math.atan2(p.y - po.y, p.x - po.x); }
          chispas(p.x, p.y, color, n, 110 + Math.min(240, ev.n * 8), { retraso: ret, dir, abre: dir === null ? 6.283 : 2.4, vida: [0.3, 0.75] });
          if (ev.n >= 12) onda(p.x, p.y, color, 30 + Math.min(40, ev.n), 0.3, ret, 5);
          if (dir !== null) v.empuje = { dx: Math.cos(dir), dy: Math.sin(dir), t: 0, fuerza: Math.min(16, 5 + ev.n * 0.5), retraso: ret };
          sacudida = Math.max(sacudida, Math.min(10, ev.n / 5));
        } else if (ev.t === "cura") {
          const u = unidad(ev.id);
          if (!u) return;
          const p = centro(u);
          chispas(p.x, p.y + 10, "#5dff9a", 20, 70, { retraso: ret, g: -140, vida: [0.6, 1.1], tam: [2, 4] });
          onda(p.x, p.y, "#5dff9a", 46, 0.5, ret, 5);
          visual(u).hold = 0;
        } else if (ev.t === "estado") {
          const u = unidad(ev.id);
          if (!u) return;
          const p = centro(u);
          const color = COLOR_ESTADO[ev.nombre] || "#ffe14d";
          chispas(p.x, p.y - 20, color, 10, 80, { retraso: ret, g: -60 });
          texto(p.x, p.y - 58, ev.nombre.toUpperCase(), color, ret + 0.1, 17);
        } else if (ev.t === "teleport") {
          const p0 = centroCelda(ev.x0, ev.y0), p1 = centroCelda(ev.x1, ev.y1);
          chispas(p0.x, p0.y, "#c28cff", 26, 160, { g: -30 });
          onda(p0.x, p0.y, "#c28cff", 50, 0.35, 0, 6);
          chispas(p1.x, p1.y, "#c28cff", 26, 160, { retraso: 0.1, g: -30 });
          onda(p1.x, p1.y, "#c28cff", 50, 0.35, 0.1, 6);
          const u = unidad(ev.id);
          if (u) { const v = visual(u); v.x = u.x; v.y = u.y; v.aparece = 0.35; }
        } else if (ev.t === "choque") {
          const p = centroCelda(Math.max(0, Math.min(c.ancho - 1, ev.x)), Math.max(0, Math.min(c.alto - 1, ev.y)));
          chispas(p.x, p.y, "#ffd9a0", 18, 200, { retraso: ret });
          onda(p.x, p.y, "#ffd9a0", 44, 0.3, ret, 7);
          sacudida = Math.max(sacudida, 8);
        } else if (ev.t === "muerte") {
          const u = unidad(ev.id);
          if (!u) return;
          const p = centro(u);
          const v = visual(u);
          v.muerte = 0.001;
          const col = u.color;
          chispas(p.x, p.y, col, 40, 260, { retraso: ret + 0.05, vida: [0.5, 1.1], tam: [3, 6] });
          chispas(p.x, p.y, "#ffffff", 16, 200, { retraso: ret + 0.05, vida: [0.3, 0.6] });
          onda(p.x, p.y, col, 90, 0.6, ret + 0.05, 9);
          sacudida = Math.max(sacudida, 11);
        }
      });
      return ret;
    }
    function va_pulso(u, color) { const v = visual(u); v.flash = Math.max(v.flash, 0.12); v.lunge = { dx: 0, dy: -1, t: 0, lejos: true }; v.aura = { color, t: 0 }; }

    /* --- Dibujo -------------------------------------------------------------------------------------- */
    function rect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

    function dibujarTerreno(c, ahora, ruidoCelda) {
      const T = OS.TERRENO;
      const W = c.ancho * TS, H = c.alto * TS;
      for (let y = 0; y < c.alto; y++) for (let x = 0; x < c.ancho; x++) {
        const px = x * TS, py = y * TS;
        const g = ctx.createLinearGradient(px, py, px + TS, py + TS);
        const base = (x + y) % 2 ? paleta.a : paleta.b;
        g.addColorStop(0, aclarar(base, 0.1 + ruidoCelda[y][x] * 0.08));
        g.addColorStop(1, oscurecer(base, 0.16));
        ctx.fillStyle = g;
        ctx.fillRect(px, py, TS, TS);
        // brillo de arista arriba a la izquierda
        ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(px, py, TS, 2); ctx.fillRect(px, py, 2, TS);
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(px, py + TS - 2, TS, 2); ctx.fillRect(px + TS - 2, py, 2, TS);
        // motas
        if (ruidoCelda[y][x] > 0.8) { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(px + 14 + ruidoCelda[y][x] * 20, py + 40, 4, 4); }
      }
      // elementos
      for (let y = 0; y < c.alto; y++) for (let x = 0; x < c.ancho; x++) {
        const t = c.terreno[y][x];
        const px = x * TS, py = y * TS;
        if (t === T.ROCA) {
          ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 9, 25, 8, 0, 0, 6.283); ctx.fill();
          const g = ctx.createLinearGradient(px, py, px + TS, py + TS);
          g.addColorStop(0, aclarar(paleta.roca, 0.45)); g.addColorStop(0.55, paleta.roca); g.addColorStop(1, oscurecer(paleta.roca, 0.45));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(px + 9, py + TS - 10); ctx.lineTo(px + 14, py + 24); ctx.lineTo(px + 28, py + 7); ctx.lineTo(px + 46, py + 12); ctx.lineTo(px + TS - 8, py + 30); ctx.lineTo(px + TS - 12, py + TS - 10);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = oscurecer(paleta.roca, 0.55); ctx.lineWidth = 2.5; ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(px + 18, py + 26); ctx.lineTo(px + 28, py + 12); ctx.lineTo(px + 38, py + 16); ctx.lineTo(px + 24, py + 32); ctx.fill();
        } else if (t === T.FUEGO) {
          const f = 0.5 + 0.5 * Math.sin(ahora / 140 + x * 2 + y);
          const g = ctx.createRadialGradient(px + TS / 2, py + TS / 2, 2, px + TS / 2, py + TS / 2, TS * 0.75);
          g.addColorStop(0, "rgba(255,240,120,.95)"); g.addColorStop(0.45, "rgba(255,110,30,.85)"); g.addColorStop(1, "rgba(160,20,10,.55)");
          ctx.fillStyle = g; ctx.fillRect(px, py, TS, TS);
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 4; i++) {
            const fx = px + 14 + i * 12 + Math.sin(ahora / 220 + i * 1.7 + x) * 4;
            const alto = 20 + 14 * Math.sin(ahora / 120 + i * 2.3 + y) * f + i % 2 * 8;
            const lg = ctx.createLinearGradient(0, py + TS - 8, 0, py + TS - 8 - alto);
            lg.addColorStop(0, "rgba(255,90,20,.9)"); lg.addColorStop(1, "rgba(255,230,100,0)");
            ctx.fillStyle = lg;
            ctx.beginPath(); ctx.moveTo(fx - 7, py + TS - 8); ctx.quadraticCurveTo(fx, py + TS - 8 - alto * 1.2, fx + 7, py + TS - 8); ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
          if (Math.random() < 0.04) particulas.push({ x: px + aleatorio(10, 54), y: py + TS - 10, vx: aleatorio(-14, 14), vy: aleatorio(-70, -35), g: -10, vida: 0.9, max: 0.9, color: "#ffb347", tam: aleatorio(1.5, 3), retraso: 0, luz: true });
        } else if (t === T.PINCHOS) {
          ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            const sx = px + 8 + i * 20, sy = py + 22 + j * 17;
            const g = ctx.createLinearGradient(sx, sy, sx + 14, sy);
            g.addColorStop(0, "#f4f8ff"); g.addColorStop(1, "#7f8aa8");
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 7, sy - 17); ctx.lineTo(sx + 14, sy); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,70,90,.55)"; ctx.fillRect(sx + 5, sy - 17, 3, 3);
          }
        } else if (t === T.BARRO) {
          const g = ctx.createRadialGradient(px + TS / 2, py + TS / 2, 4, px + TS / 2, py + TS / 2, TS * 0.7);
          g.addColorStop(0, "rgba(120,86,40,.95)"); g.addColorStop(1, "rgba(70,46,22,.85)");
          ctx.fillStyle = g; rect(px + 3, py + 3, TS - 6, TS - 6, 16); ctx.fill();
          for (let i = 0; i < 3; i++) {
            const b = (ahora / 900 + i * 0.37 + ruidoCelda[y][x]) % 1;
            ctx.strokeStyle = `rgba(210,170,100,${0.7 * (1 - b)})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px + 16 + i * 17, py + 22 + (i % 2) * 20, 2 + b * 7, 0, 6.283); ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
      for (let x = 0; x <= c.ancho; x++) { ctx.beginPath(); ctx.moveTo(x * TS, 0); ctx.lineTo(x * TS, H); ctx.stroke(); }
      for (let y = 0; y <= c.alto; y++) { ctx.beginPath(); ctx.moveTo(0, y * TS); ctx.lineTo(W, y * TS); ctx.stroke(); }
    }

    function celda(x, y, color, grosor) {
      ctx.fillStyle = color; rect(x * TS + 3, y * TS + 3, TS - 6, TS - 6, 10); ctx.fill();
      if (grosor) { ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.stroke(); }
    }

    function dibujarUnidad(c, u, ahora, dt, activo) {
      const v = visual(u);
      const k = 1 - Math.pow(0.0012, dt);
      v.x += (u.x - v.x) * k; v.y += (u.y - v.y) * k;
      if (v.flash > 0) v.flash -= dt;
      if (v.hold > 0) v.hold -= dt; else v.pv += (u.pv - v.pv) * Math.min(1, dt * 6);
      if (v.aparece > 0) v.aparece -= dt;
      let ox = 0, oy = 0;
      if (v.lunge) {
        v.lunge.t += dt;
        const t = v.lunge.t / 0.28;
        if (t >= 1) v.lunge = null;
        else { const f = Math.sin(t * Math.PI) * (v.lunge.lejos ? 5 : 20); ox += v.lunge.dx * f; oy += v.lunge.dy * f; }
      }
      if (v.empuje) {
        v.empuje.t += dt;
        const t = (v.empuje.t - v.empuje.retraso) / 0.3;
        if (t >= 1) v.empuje = null;
        else if (t > 0) { const f = Math.sin(t * Math.PI) * v.empuje.fuerza; ox += v.empuje.dx * f; oy += v.empuje.dy * f; }
      }
      if (v.aura) { v.aura.t += dt; if (v.aura.t > 0.6) v.aura = null; }
      let escala = 1, giro = 0, opacidad = 1;
      if (u.muerto) {
        if (v.muerte > 0 && v.muerte < 1) { v.muerte += dt * 1.6; escala = Math.max(0, 1 - v.muerte); giro = v.muerte * 5; opacidad = 1 - v.muerte; }
        else if (v.muerte >= 1) return;
        else { v.muerte = 0.001; }
      }
      if (v.aparece > 0) { escala = 1 + v.aparece * 0.6; opacidad = 1 - v.aparece * 1.2; }
      const bob = u.caido ? 0 : Math.sin(ahora / 320 + hash(u.id) % 7) * 2.2;
      const px = v.x * TS + TS / 2 + ox, py = v.y * TS + TS / 2 + oy + bob;
      const equipoColor = u.equipo === "enemigos" ? "#ff3d7a" : "#38f0ff";
      ctx.save();
      ctx.globalAlpha = Math.max(0, opacidad) * (u.caido ? 0.5 : 1);
      // sombra
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(px - ox, py - oy + 22 - bob, 22 * escala, 8 * escala, 0, 0, 6.283); ctx.fill();
      ctx.translate(px, py); ctx.rotate(giro); ctx.scale(escala, escala);
      // resplandor de equipo
      const gl = ctx.createRadialGradient(0, 0, 14, 0, 0, 44);
      gl.addColorStop(0, alfa(equipoColor, u === activo ? 0.55 : 0.32)); gl.addColorStop(1, alfa(equipoColor, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.283); ctx.fill();
      // aura de hechizo
      if (v.aura) { const t = v.aura.t / 0.6; ctx.strokeStyle = alfa(v.aura.color, 1 - t); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 26 + t * 30, 0, 6.283); ctx.stroke(); }
      // cuerpo
      const cuerpo = ctx.createRadialGradient(-9, -11, 3, 0, 0, 28);
      cuerpo.addColorStop(0, aclarar(u.color, 0.7)); cuerpo.addColorStop(0.45, u.color); cuerpo.addColorStop(1, oscurecer(u.color, 0.5));
      ctx.fillStyle = cuerpo; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 6.283); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = equipoColor; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-9, -12, 9, 5, -0.6, 0, 6.283); ctx.fill();
      // inicial
      ctx.font = "900 27px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 4; ctx.strokeStyle = oscurecer(u.color, 0.7); ctx.strokeText(u.nombre.trim().charAt(0).toUpperCase(), 0, 2);
      ctx.fillStyle = "#fff"; ctx.fillText(u.nombre.trim().charAt(0).toUpperCase(), 0, 2);
      if (v.flash > 0 && !u.muerto) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, v.flash * 3.5)})`; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.283); ctx.fill(); }
      ctx.restore();

      if (u.muerto) return;
      ctx.save();
      ctx.globalAlpha = u.caido ? 0.6 : 1;
      // barra de vida
      const frac = Math.max(0, Math.min(1, v.pv / u.pvMax));
      const bx = px - 25, by = py + 28;
      ctx.fillStyle = "rgba(10,8,20,.8)"; rect(bx - 2, by - 2, 54, 10, 5); ctx.fill();
      const hg = ctx.createLinearGradient(bx, 0, bx + 50, 0);
      if (frac > 0.5) { hg.addColorStop(0, "#37e26b"); hg.addColorStop(1, "#b8ff4d"); }
      else if (frac > 0.25) { hg.addColorStop(0, "#ffb02e"); hg.addColorStop(1, "#ffe14d"); }
      else { hg.addColorStop(0, "#ff2e5a"); hg.addColorStop(1, "#ff7a3d"); }
      ctx.fillStyle = hg; rect(bx, by, Math.max(2, 50 * frac), 6, 3); ctx.fill();
      // condiciones
      Object.keys(u.cond).slice(0, 4).forEach((n, i) => {
        const cx = px - 22 + i * 15, cy = py - 36;
        ctx.fillStyle = COLOR_ESTADO[n] || "#ffe14d"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 6.283); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#101018"; ctx.font = "800 9px sans-serif"; ctx.fillText(n.charAt(0).toUpperCase(), cx, cy + 0.5);
      });
      if (u.caido) { ctx.fillStyle = "#fff"; ctx.font = "800 15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("z z", px + 14, py - 24 - Math.sin(ahora / 400) * 3); }
      // turno activo
      if (u === activo && !c.fin) {
        const p = 0.5 + 0.5 * Math.sin(ahora / 180);
        ctx.strokeStyle = `rgba(255,225,77,${0.7 + 0.3 * p})`; ctx.lineWidth = 3.5;
        ctx.setLineDash([9, 7]); ctx.lineDashOffset = -ahora / 40;
        ctx.beginPath(); ctx.arc(px, py, 33 + p * 3, 0, 6.283); ctx.stroke();
        ctx.setLineDash([]);
        const fy = py - 50 + Math.sin(ahora / 160) * 4;
        ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.moveTo(px - 8, fy - 8); ctx.lineTo(px + 8, fy - 8); ctx.lineTo(px, fy + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
    }

    function ruta(mapa, x, y) {
      const puntos = [];
      let k = `${x},${y}`;
      while (k && mapa.get(k)) { const d = mapa.get(k); puntos.unshift(d); k = d.prev; }
      return puntos;
    }

    function dibujar(c, ahora, dt, ui) {
      const W = c.ancho * TS, H = c.alto * TS;
      const ret = procesar(c);
      if (c.flotantes.length) {
        c.flotantes.splice(0).forEach(f => {
          const esDano = /^-\d/.test(f.msg);
          const esCura = /^\+\d/.test(f.msg);
          texto(f.x * TS + TS / 2, f.y * TS + 4, f.msg, esDano ? "#ff6b6b" : esCura ? "#5dff9a" : f.color, esDano || esCura ? ret : 0.05, esDano || esCura ? 28 : 19);
        });
      }
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (sacudida > 0.2) { ctx.translate((Math.random() - 0.5) * sacudida, (Math.random() - 0.5) * sacudida); sacudida *= Math.pow(0.02, dt); } else sacudida = 0;

      // fondo y terreno
      ctx.fillStyle = paleta.suelo; ctx.fillRect(-20, -20, W + 40, H + 40);
      dibujarTerreno(c, ahora, ruido);

      const activo = c.activo;
      const hover = ui.hover;
      const pulso = 0.5 + 0.5 * Math.sin(ahora / 220);
      // zonas de despliegue (tenue)
      if (ui.turnoJugador && !ui.modo && ui.alcance) {
        ui.alcance.forEach(i => { if (!(i.x === activo.x && i.y === activo.y)) celda(i.x, i.y, `rgba(56,240,255,${0.16 + 0.1 * pulso})`, 0); });
        if (hover && ui.alcance.get(`${hover.x},${hover.y}`) && !(hover.x === activo.x && hover.y === activo.y)) {
          const r = ruta(ui.alcance, hover.x, hover.y);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.setLineDash([2, 9]); ctx.lineCap = "round";
          ctx.beginPath(); r.forEach((p, i) => { const q = centroCelda(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke();
          ctx.setLineDash([]);
          const fin = r[r.length - 1], q = centroCelda(fin.x, fin.y);
          ctx.fillStyle = "rgba(10,8,30,.85)"; ctx.beginPath(); ctx.arc(q.x + 20, q.y - 20, 12, 0, 6.283); ctx.fill();
          ctx.fillStyle = "#38f0ff"; ctx.font = "800 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(fin.coste), q.x + 20, q.y - 19);
        }
      }
      if (ui.modo && ui.turnoJugador) {
        ui.modo.destinos.forEach(d => {
          if (d.dirigido) return;
          if (d.area) { celda(d.x, d.y, "rgba(255,255,255,.07)", 0); return; }
          const aliado = d.victimas[0] && d.victimas[0].equipo === activo.equipo;
          const col = d.teleport ? "170,120,255" : aliado ? "60,255,140" : "255,60,90";
          celda(d.x, d.y, `rgba(${col},${0.25 + 0.2 * pulso})`, 2.5);
        });
        const d = ui.destinoHover;
        if (d) {
          const p0 = centro(activo);
          (d.area || []).forEach(k => {
            const q = centroCelda(k.x, k.y);
            const dist = Math.hypot(q.x - (d.dirigido ? p0.x : d.x * TS + TS / 2), q.y - (d.dirigido ? p0.y : d.y * TS + TS / 2));
            celda(k.x, k.y, `rgba(255,${150 + 50 * pulso},40,${0.5 - Math.min(0.2, dist / 900)})`, 2);
          });
          d.victimas.forEach(vv => {
            const q = centro(vv);
            ctx.strokeStyle = vv.equipo === activo.equipo ? "#5dff9a" : "#ffe14d"; ctx.lineWidth = 4;
            ctx.setLineDash([8, 6]); ctx.lineDashOffset = -ahora / 30;
            ctx.beginPath(); ctx.arc(q.x, q.y, 36, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
          });
        }
      }
      if (hover && !ui.modo) {
        const x = hover.x * TS, y = hover.y * TS, l = 14;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.lineCap = "round";
        [[x + 4, y + 4, 1, 1], [x + TS - 4, y + 4, -1, 1], [x + 4, y + TS - 4, 1, -1], [x + TS - 4, y + TS - 4, -1, -1]].forEach(([cx, cy, sx, sy]) => {
          ctx.beginPath(); ctx.moveTo(cx + sx * l, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * l); ctx.stroke();
        });
      }
      // anillos de celda de las áreas
      anillosCelda.forEach(a => {
        if (a.retraso > 0) { a.retraso -= dt; return; }
        a.t += dt;
        const p = a.t / a.dur;
        const al = Math.max(0, 1 - p);
        ctx.fillStyle = alfa(a.color, 0.55 * al); rect(a.x * TS + 3, a.y * TS + 3, TS - 6, TS - 6, 10); ctx.fill();
        ctx.strokeStyle = alfa("#ffffff", 0.8 * al); ctx.lineWidth = 2.5; ctx.stroke();
      });
      anillosCelda = anillosCelda.filter(a => a.t < a.dur);

      // fichas (de arriba hacia abajo)
      c.unidades.slice().sort((a, b) => visual(a).y - visual(b).y).forEach(u => dibujarUnidad(c, u, ahora, dt, activo));

      // proyectiles
      ctx.globalCompositeOperation = "lighter";
      proyectiles.forEach(p => {
        if (p.retraso > 0) { p.retraso -= dt; return; }
        p.t += dt;
        const f = Math.min(1, p.t / p.dur);
        const x = p.x0 + (p.x1 - p.x0) * f, y = p.y0 + (p.y1 - p.y0) * f - Math.sin(f * Math.PI) * (p.tipo === "orbe" ? 16 : 6);
        p.estela.push({ x, y }); if (p.estela.length > 9) p.estela.shift();
        p.estela.forEach((q, i) => {
          const a = i / p.estela.length;
          ctx.fillStyle = alfa(p.color, 0.5 * a); ctx.beginPath(); ctx.arc(q.x, q.y, (p.tipo === "orbe" ? 12 : 4) * a + 1, 0, 6.283); ctx.fill();
        });
        const gr = ctx.createRadialGradient(x, y, 0, x, y, p.tipo === "orbe" ? 22 : 12);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, p.color); gr.addColorStop(1, alfa(p.color, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, p.tipo === "orbe" ? 22 : 12, 0, 6.283); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      proyectiles = proyectiles.filter(p => p.t < p.dur);

      // ondas
      ondas.forEach(o => {
        if (o.retraso > 0) { o.retraso -= dt; return; }
        o.t += dt;
        const p = Math.min(1, o.t / o.dur);
        ctx.strokeStyle = alfa(o.color, 1 - p); ctx.lineWidth = o.grosor * (1 - p) + 1;
        ctx.beginPath();
        if (o.arco !== undefined) ctx.arc(o.x, o.y, o.radio * (0.4 + 0.6 * p), o.arco - 0.9, o.arco + 0.9);
        else ctx.arc(o.x, o.y, o.radio * p, 0, 6.283);
        ctx.stroke();
      });
      ondas = ondas.filter(o => o.t < o.dur);

      // partículas
      ctx.globalCompositeOperation = "lighter";
      particulas.forEach(p => {
        if (p.retraso > 0) { p.retraso -= dt; return; }
        p.vida -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, p.vida / p.max);
        ctx.fillStyle = alfa(p.color, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.tam * (0.4 + 0.6 * a), 0, 6.283); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      particulas = particulas.filter(p => p.vida > 0 || p.retraso > 0);
      if (particulas.length > 900) particulas.splice(0, particulas.length - 900);

      // motas de ambiente
      ctx.globalCompositeOperation = "lighter";
      ambiente.forEach(m => {
        m.y -= m.v * dt; m.x += Math.sin(ahora / 900 + m.f) * 10 * dt;
        if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
        ctx.fillStyle = alfa(m.color, 0.35 + 0.25 * Math.sin(ahora / 400 + m.f)); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";

      // textos
      textos.forEach(t => {
        if (t.retraso > 0) { t.retraso -= dt; return; }
        t.t += dt;
        const p = t.t / 1.15;
        const escala = p < 0.15 ? 0.6 + p / 0.15 * 0.7 : p < 0.3 ? 1.3 - (p - 0.15) / 0.15 * 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
        ctx.translate(t.x, t.y - p * 46); ctx.scale(escala, escala);
        ctx.font = `900 ${t.tam}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(10,6,24,.9)"; ctx.lineJoin = "round"; ctx.strokeText(t.msg, 0, 0);
        ctx.fillStyle = t.color; ctx.fillText(t.msg, 0, 0);
        ctx.restore();
      });
      textos = textos.filter(t => t.t < 1.15);

      ctx.restore();
      // viñeta y destello
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(8,4,24,.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (destello > 0.01) { ctx.fillStyle = alfa(colorDestello, destello); ctx.fillRect(0, 0, W, H); destello *= Math.pow(0.002, dt); }
    }

    return { reiniciar, dibujar, tablero: () => ({ ancho: canvas.width, alto: canvas.height }) };
  };
})(window.OS);
