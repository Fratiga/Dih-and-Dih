/* =============================================================================
   LA FRACTURA: el tablero, dibujado en un canvas. Solo dibuja y avisa de los toques: las reglas son
   del motor. Respeta la niebla de guerra del jugador humano.
============================================================================= */
window.FracturaTablero = (function () {
  const D = window.FRACTURA_DATOS;
  const { TERRENOS, CLASES, FACCIONES } = D;
  const SIMBOLO = { guerrero: "⚔", cazador: "➶", arcanista: "✦", paladin: "✚", picaro: "✂", caballero: "♞", esqueleto: "☠", archimago: "✧", ballestero: "⌖", mercenario: "$", sanador: "✝", lider: "★", eco: "☉", salvaje: "◆" };
  const COLOR_BANDO = ["#d9b24c", "#c0463c"];

  function crear(canvas, hooks) {
    const ctx = canvas.getContext("2d");
    let est = null, ts = 40, dpr = 1;
    let estado = { sel: null, mover: new Map(), atacar: new Set(), ciudad: null, objetivosHab: new Set() };
    const efectos = [];
    let pendiente = false;

    function ajustar() {
      const caja = canvas.parentElement;
      const ancho = Math.max(240, Math.min(caja.clientWidth, 760));
      dpr = window.devicePixelRatio || 1;
      ts = Math.floor(ancho / (est ? est.ancho : 13));
      canvas.style.width = `${ts * (est ? est.ancho : 13)}px`;
      canvas.style.height = `${ts * (est ? est.alto : 13)}px`;
      canvas.width = Math.round(ts * (est ? est.ancho : 13) * dpr);
      canvas.height = Math.round(ts * (est ? est.alto : 13) * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pedir();
    }
    window.addEventListener("resize", ajustar);

    function pedir() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => { pendiente = false; dibujar(); if (efectos.length) pedir(); });
    }

    function colorDe(dueno) {
      if (dueno === null || dueno === undefined || dueno < 0) return "#8c8c8c";
      return COLOR_BANDO[dueno];
    }

    function dibujarTerreno(c, x, y, vis) {
      const px = x * ts, py = y * ts;
      ctx.fillStyle = vis === 0 ? "#0c0912" : TERRENOS[c.t].color;
      ctx.fillRect(px, py, ts, ts);
      if (vis === 0) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(px, py, ts, ts); ctx.clip();
      const s = ts / 40;
      switch (c.t) {
        case "bosque":
          ctx.fillStyle = "#274a24";
          [[12, 26], [26, 22], [19, 12]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(px + a * s, py + (b - 11) * s); ctx.lineTo(px + (a + 6) * s, py + (b + 5) * s); ctx.lineTo(px + (a - 6) * s, py + (b + 5) * s); ctx.fill(); });
          break;
        case "montana":
          ctx.fillStyle = "#5d554b"; ctx.beginPath(); ctx.moveTo(px + 6 * s, py + 32 * s); ctx.lineTo(px + 20 * s, py + 8 * s); ctx.lineTo(px + 34 * s, py + 32 * s); ctx.fill();
          ctx.fillStyle = "#e8e4dc"; ctx.beginPath(); ctx.moveTo(px + 15 * s, py + 16 * s); ctx.lineTo(px + 20 * s, py + 8 * s); ctx.lineTo(px + 25 * s, py + 16 * s); ctx.fill();
          break;
        case "desierto":
          ctx.fillStyle = "#b1914f"; [[10, 12], [24, 18], [16, 28], [30, 30]].forEach(([a, b]) => ctx.fillRect(px + a * s, py + b * s, 3 * s, 2 * s));
          break;
        case "agua":
          ctx.strokeStyle = "#7aa3d1"; ctx.lineWidth = 2; [12, 22, 32].forEach(b => { ctx.beginPath(); ctx.moveTo(px + 6 * s, py + b * s); ctx.quadraticCurveTo(px + 13 * s, py + (b - 5) * s, px + 20 * s, py + b * s); ctx.quadraticCurveTo(px + 27 * s, py + (b + 5) * s, px + 34 * s, py + b * s); ctx.stroke(); });
          break;
        case "magica":
          ctx.fillStyle = "#c9a6f0"; ctx.beginPath(); ctx.moveTo(px + 20 * s, py + 9 * s); ctx.lineTo(px + 27 * s, py + 20 * s); ctx.lineTo(px + 20 * s, py + 31 * s); ctx.lineTo(px + 13 * s, py + 20 * s); ctx.fill();
          break;
        case "huesos":
          ctx.strokeStyle = "#e9e3d2"; ctx.lineWidth = 2; [[10, 12], [26, 24]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(px + a * s, py + b * s); ctx.lineTo(px + (a + 8) * s, py + (b + 8) * s); ctx.moveTo(px + (a + 8) * s, py + b * s); ctx.lineTo(px + a * s, py + (b + 8) * s); ctx.stroke(); });
          break;
        default:
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, ts - 1, ts - 1);
    }

    function dibujarEstructura(c, x, y) {
      const px = x * ts, py = y * ts, s = ts / 40;
      if (!c.est) return;
      if (c.est === "ciudad") {
        const ci = Object.values(est.ciudades).find(k => k.x === x && k.y === y);
        const col = colorDe(ci ? ci.dueno : null);
        ctx.fillStyle = "#2a2430"; ctx.fillRect(px + 8 * s, py + 14 * s, 24 * s, 18 * s);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px + 6 * s, py + 15 * s); ctx.lineTo(px + 20 * s, py + 5 * s); ctx.lineTo(px + 34 * s, py + 15 * s); ctx.fill();
        ctx.fillStyle = "#f3ecd6"; ctx.fillRect(px + 17 * s, py + 21 * s, 6 * s, 11 * s);
        if (ci && ci.capital) { ctx.fillStyle = "#f6d46c"; ctx.fillRect(px + 19 * s, py + 1 * s, 2 * s, 5 * s); }
      } else if (c.est === "fortaleza") {
        const i = est.fortalezas.findIndex(p => p.x === x && p.y === y);
        const col = colorDe(i >= 0 ? est.fortalezasDueno[i] : null);
        ctx.fillStyle = "#4b4650"; ctx.fillRect(px + 9 * s, py + 12 * s, 22 * s, 20 * s);
        ctx.fillStyle = col; for (let k = 0; k < 3; k++) ctx.fillRect(px + (9 + k * 8) * s, py + 7 * s, 6 * s, 6 * s);
      } else if (c.est === "ruinas") {
        ctx.strokeStyle = c.saqueada ? "#7a746a" : "#f1d58a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px + 9 * s, py + 32 * s); ctx.lineTo(px + 9 * s, py + 16 * s); ctx.arc(px + 20 * s, py + 16 * s, 11 * s, Math.PI, Math.PI * 1.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 31 * s, py + 32 * s); ctx.lineTo(px + 31 * s, py + 24 * s); ctx.stroke();
      } else if (c.est === "nucleo") {
        ctx.strokeStyle = "#f6d46c"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px + 20 * s, py + 20 * s, 13 * s, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(px + 20 * s, py + 20 * s, 6 * s, 0, 7); ctx.stroke();
        const holds = est.nucleoHold; const h = Math.max(holds[0], holds[1]);
        if (h) { ctx.fillStyle = colorDe(holds[0] >= holds[1] ? 0 : 1); ctx.font = `bold ${12 * s}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(String(h), px + 20 * s, py + 25 * s); }
      } else if (c.est === "costura") {
        ctx.strokeStyle = "#e6c6ff"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(px + 20 * s, py + 20 * s, 10 * s, 0.3, 4.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(px + 20 * s, py + 20 * s, 5 * s, 3.4, 7.5); ctx.stroke();
      }
      if (c.objetos && c.objetos.length) { ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(px + 32 * s, py + 8 * s, 4 * s, 0, 7); ctx.fill(); ctx.strokeStyle = "#5a4310"; ctx.lineWidth = 1; ctx.stroke(); }
    }

    function dibujarUnidad(u) {
      const cx = u.x * ts + ts / 2, cy = u.y * ts + ts / 2, r = ts * 0.34;
      const col = colorDe(u.dueno);
      ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = u.lider ? "#fff6cc" : "#1b1520"; ctx.stroke();
      ctx.fillStyle = "#1b1520"; ctx.font = `bold ${Math.round(ts * 0.38)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(SIMBOLO[u.clase] || "?", cx, cy + 1);
      ctx.textBaseline = "alphabetic";
      // Vida
      const max = window.FracturaMotor.ef(est, u).hpMax;
      const w = ts * 0.7, f = Math.max(0, Math.min(1, u.hp / max));
      ctx.fillStyle = "#1b1520"; ctx.fillRect(cx - w / 2, cy + r + 2, w, 4);
      ctx.fillStyle = f > 0.5 ? "#7bc86c" : f > 0.25 ? "#e0b84a" : "#d4574a"; ctx.fillRect(cx - w / 2, cy + r + 2, w * f, 4);
      // Marcas: capitán y rango
      if (u.s) {
        if (u.s.capitan) { ctx.fillStyle = "#f6d46c"; ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.6); ctx.lineTo(cx - r * 0.5, cy - r * 1.05); ctx.lineTo(cx, cy - r * 0.6); ctx.fill(); }
        const rg = window.FracturaSoldados.rangoIndice(u.s.victorias + (u.vicG || 0));
        ctx.fillStyle = "#fff6cc"; for (let i = 0; i < rg; i++) ctx.fillRect(cx + r * 0.6, cy - r * 0.9 + i * 4, 5, 2);
      }
      // Ya actuó
      if (u.dueno === est.activo && est.jugadores[u.dueno].humano && u.pm <= 0 && u.atacado) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
    }

    function dibujar() {
      if (!est) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      const H = est.humano >= 0 ? est.humano : 0;
      const vis = est.vision[H];
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
        const v = vis[y * est.ancho + x];
        const c = est.casillas[y][x];
        dibujarTerreno(c, x, y, v);
        if (v > 0) dibujarEstructura(c, x, y);
        if (v === 1) { ctx.fillStyle = "rgba(10,8,16,.5)"; ctx.fillRect(x * ts, y * ts, ts, ts); }
      }
      // Resaltes
      estado.mover.forEach((n, k) => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(120,220,120,.32)"; ctx.fillRect(x * ts, y * ts, ts, ts); ctx.strokeStyle = "rgba(160,255,160,.7)"; ctx.lineWidth = 1.5; ctx.strokeRect(x * ts + 1.5, y * ts + 1.5, ts - 3, ts - 3); });
      estado.objetivosHab.forEach(k => { const [x, y] = k.split(",").map(Number); ctx.fillStyle = "rgba(150,120,255,.35)"; ctx.fillRect(x * ts, y * ts, ts, ts); });
      Object.values(est.unidades).forEach(u => {
        const v = vis[u.y * est.ancho + u.x];
        if (v === 2 || (u.dueno === H)) dibujarUnidad(u);
      });
      estado.atacar.forEach(k => { const [x, y] = k.split(",").map(Number); ctx.strokeStyle = "#ff6b5e"; ctx.lineWidth = 3; ctx.strokeRect(x * ts + 2, y * ts + 2, ts - 4, ts - 4); });
      if (estado.sel && est.unidades[estado.sel]) { const u = est.unidades[estado.sel]; ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 3; ctx.strokeRect(u.x * ts + 1.5, u.y * ts + 1.5, ts - 3, ts - 3); }
      if (estado.ciudad && est.ciudades[estado.ciudad]) { const c = est.ciudades[estado.ciudad]; ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 3; ctx.strokeRect(c.x * ts + 1.5, c.y * ts + 1.5, ts - 3, ts - 3); }
      // Efectos (daño flotante)
      const ahora = performance.now();
      for (let i = efectos.length - 1; i >= 0; i--) {
        const e = efectos[i];
        const t = (ahora - e.t0) / 900;
        if (t >= 1) { efectos.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = e.color; ctx.font = `bold ${Math.round(ts * 0.42)}px sans-serif`; ctx.textAlign = "center";
        ctx.fillText(e.texto, e.x * ts + ts / 2, e.y * ts + ts * 0.3 - t * ts * 0.5);
        ctx.globalAlpha = 1;
      }
    }

    function celdaDe(ev) {
      const r = canvas.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (canvas.width / dpr / r.width), py = (ev.clientY - r.top) * (canvas.height / dpr / r.height);
      return { x: Math.floor(px / ts), y: Math.floor(py / ts) };
    }
    canvas.addEventListener("click", ev => { if (!est) return; const c = celdaDe(ev); if (c.x >= 0 && c.y >= 0 && c.x < est.ancho && c.y < est.alto) hooks.alTocar(c.x, c.y); });
    canvas.addEventListener("mousemove", ev => { if (!est || !hooks.alPasar) return; const c = celdaDe(ev); if (c.x >= 0 && c.y >= 0 && c.x < est.ancho && c.y < est.alto) hooks.alPasar(c.x, c.y); });

    return {
      poner(nuevo) { est = nuevo; ajustar(); },
      estado(e) { estado = Object.assign({ sel: null, mover: new Map(), atacar: new Set(), ciudad: null, objetivosHab: new Set() }, e); pedir(); },
      redibujar: pedir,
      efecto(x, y, texto, color) { efectos.push({ x, y, texto, color: color || "#fff", t0: performance.now() }); pedir(); },
      ajustar
    };
  }

  return { crear, SIMBOLO };
})();
