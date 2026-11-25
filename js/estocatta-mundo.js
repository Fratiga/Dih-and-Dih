/* Estocatta: el escenario. Un claustro en ruinas de noche, con la luna detrás de los arcos,
   antorchas en las columnas y una puerta en cada extremo de la pista.

   Capas, de lejos a cerca (el número es cuánto se mueven con la cámara):
     cielo 0 · luna 0.03 · nubes 0.08 · catedral 0.2 · arcadas 0.45 · columnas 0.8 ·
     suelo, estandartes, puertas y luchadores 1 · cadenas en primer plano 1.3
   La luz se calcula a media resolución y se amplía sin suavizar: sale en bloques, como el
   resto del pixel art. Lo que no cambia se dibuja una vez en lienzos propios.

   Las posiciones del mundo están en unidades del juego (la pista mide CFG.PISTA). */
(function () {
  "use strict";
  const S = window.EstocattaSprites;
  const AN = 480, AL = 270, SUELO = 214, U = 0.5;

  const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  /* Azar con semilla para que el decorado sea siempre el mismo. */
  function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* ---------- Piezas que se dibujan una vez ---------- */

  function hornearCielo() {
    const c = lienzo(AN, SUELO), g = c.getContext("2d");
    const franjas = ["#06040d", "#0a0716", "#0e0a1e", "#130e27", "#18122f", "#1e1638", "#251b41", "#2d2149"];
    const alto = SUELO / franjas.length;
    for (let y = 0; y < SUELO; y++) {
      const f = y / alto, i = Math.min(franjas.length - 1, Math.floor(f)), k = f - i;
      for (let x = 0; x < AN; x++) {
        const otro = k * 16 > BAYER[y % 4][x % 4] + 8 && i + 1 < franjas.length;
        g.fillStyle = otro ? franjas[i + 1] : franjas[i];
        g.fillRect(x, y, 1, 1);
      }
    }
    const r = azar(7);
    for (let i = 0; i < 70; i++) {
      const y = Math.floor(r() * 120);
      rect(g, Math.floor(r() * AN), y, 1, 1, r() < 0.2 ? "#cfd8ff" : "#6a6494");
    }
    return c;
  }

  function hornearLuna() {
    const c = lienzo(40, 40), g = c.getContext("2d");
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const d = Math.hypot(x - 20, y - 20);
      if (d < 11) {
        const borde = Math.hypot(x - 23, y - 18) > 10.5;
        rect(g, x, y, 1, 1, borde ? "#b9b4cf" : "#ece6d2");
      } else if (d < 13 && (x + y) % 2 === 0) rect(g, x, y, 1, 1, "rgba(220,214,240,.25)");
      else if (d < 17 && (x + y) % 4 === 0) rect(g, x, y, 1, 1, "rgba(200,196,240,.10)");
    }
    [[16, 16, 3], [23, 24, 2], [17, 25, 1], [25, 15, 1]].forEach(([x, y, r]) => {
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) rect(g, x + xx, y + yy, 1, 1, "#cdc6b4");
    });
    return c;
  }

  function hornearNubes(semilla, color) {
    const c = lienzo(960, 70), g = c.getContext("2d");
    const r = azar(semilla);
    for (let n = 0; n < 7; n++) {
      const cx = r() * 960, cy = 20 + r() * 34, w = 50 + r() * 80;
      for (let k = 0; k < 6; k++) {
        const bx = cx + (r() - 0.5) * w, by = cy + (r() - 0.5) * 10, bw = 20 + r() * w * 0.6, bh = 5 + r() * 7;
        for (let y = 0; y < bh; y++) {
          const ww = Math.round(bw * Math.sqrt(1 - Math.pow((y - bh / 2) / (bh / 2), 2)));
          rect(g, ((bx - ww / 2) % 960 + 960) % 960, by + y, ww, 1, color);
          if (bx - ww / 2 < 0) rect(g, 960 + bx - ww / 2, by + y, ww, 1, color);
        }
      }
    }
    return c;
  }

  function hornearCatedral() {
    const c = lienzo(480, 150), g = c.getContext("2d");
    const col = "#110c20";
    const r = azar(3);
    rect(g, 0, 120, 480, 30, col);
    // torres, agujas y un rosetón
    const torres = [[20, 70, 26], [70, 96, 18], [118, 40, 30], [170, 84, 16], [214, 58, 40], [282, 88, 20], [330, 50, 26], [384, 92, 18], [430, 66, 30]];
    torres.forEach(([x, y, w]) => {
      rect(g, x, y, w, 150 - y, col);
      for (let k = 0; k < w / 2; k++) rect(g, x + k, y - k * 1.3 - 1, w - k * 2, 2, col);
      rect(g, x + w / 2, y - w * 0.65 - 10, 1, 10, col);
      for (let v = 0; v < 3; v++) if (r() < 0.55) rect(g, x + 3 + Math.floor(r() * (w - 6)), y + 12 + v * 14, 2, 3, r() < 0.5 ? "#e7a44a" : "#3a2f58");
    });
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; rect(g, 234 + Math.cos(t) * 7, 86 + Math.sin(t) * 7, 1, 1, "#3a2f58"); }
    return c;
  }

  function hornearArcadas() {
    const c = lienzo(192, SUELO), g = c.getContext("2d");
    const piedra = "#1b1533", luz = "#2e2653";
    for (let i = 0; i < 2; i++) {
      const x0 = i * 96;
      rect(g, x0, 60, 14, SUELO - 60, piedra);
      rect(g, x0 + 14, 60, 82, 18, piedra);
      // arco de medio punto recortado
      for (let y = 0; y < 30; y++) {
        const ancho = Math.round(41 * Math.sqrt(Math.max(0, 1 - Math.pow((30 - y) / 30, 2))));
        rect(g, x0 + 14, 78 + y, 41 - ancho, 1, piedra);
        rect(g, x0 + 55 + ancho, 78 + y, 41 - ancho, 1, piedra);
        if (y > 2) { rect(g, x0 + 55 - ancho - 1, 78 + y, 1, 1, luz); }
      }
      rect(g, x0, 60, 96, 1, luz);
      rect(g, x0 + 13, 108, 1, SUELO - 108, luz);
      rect(g, x0 + 2, 56, 10, 4, piedra);
    }
    return c;
  }

  function hornearColumna() {
    const h = SUELO - 22;
    const c = lienzo(30, h), g = c.getContext("2d");
    rect(g, 6, 8, 18, h - 16, "#2a2146");
    rect(g, 6, 8, 3, h - 16, "#1f1838");
    rect(g, 20, 8, 4, h - 16, "#3c3166");
    rect(g, 22, 8, 1, h - 16, "#4b3f7a");
    for (let y = 22; y < h - 10; y += 18) rect(g, 6, y, 18, 1, "#1d1634");
    rect(g, 1, 0, 28, 5, "#352a5a"); rect(g, 3, 5, 24, 3, "#2a2146"); rect(g, 1, 0, 28, 1, "#4b3f7a");
    rect(g, 1, h - 8, 28, 8, "#352a5a"); rect(g, 3, h - 10, 24, 2, "#2a2146"); rect(g, 1, h - 8, 28, 1, "#4b3f7a");
    // soporte de la antorcha
    rect(g, 22, 70, 6, 2, "#4a3826"); rect(g, 25, 64, 3, 8, "#5a4330");
    return c;
  }

  function hornearSuelo() {
    const c = lienzo(128, AL - SUELO), g = c.getContext("2d");
    rect(g, 0, 0, 128, AL - SUELO, "#231b33");
    rect(g, 0, 0, 128, 2, "#5b4b78"); rect(g, 0, 2, 128, 1, "#3e3259"); rect(g, 0, 3, 128, 1, "#15101f");
    const r = azar(11);
    for (let fila = 0; fila < 4; fila++) {
      const y = 4 + fila * 13, desf = fila % 2 ? 16 : 0;
      rect(g, 0, y + 12, 128, 1, "#15101f");
      for (let x = desf; x < 128 + 32; x += 32) {
        rect(g, x % 128, y, 1, 12, "#15101f");
        rect(g, (x + 1) % 128, y, 30, 1, fila === 0 ? "#3a2f55" : "#2c2342");
        if (r() < 0.4) rect(g, (x + 6 + Math.floor(r() * 18)) % 128, y + 4 + Math.floor(r() * 6), 3 + Math.floor(r() * 4), 1, "#1a1428");
      }
    }
    return c;
  }

  function hornearViñeta() {
    const c = lienzo(AN / 2, AL / 2), g = c.getContext("2d");
    const gr = g.createRadialGradient(AN / 4, AL / 4, AL * 0.18, AN / 4, AL / 4, AL * 0.4);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = gr; g.fillRect(0, 0, AN / 2, AL / 2);
    return c;
  }

  /* ---------- El mundo ---------- */

  function crearMundo(CFG) {
    const piezas = {
      cielo: hornearCielo(), luna: hornearLuna(), nubesA: hornearNubes(5, "#1d1638"), nubesB: hornearNubes(9, "#2a2050"),
      catedral: hornearCatedral(), arcadas: hornearArcadas(), columna: hornearColumna(), suelo: hornearSuelo(), vineta: hornearViñeta()
    };
    const luz = lienzo(AN / 2, AL / 2), gl = luz.getContext("2d");
    const tinte = lienzo(AN / 2, AL / 2), gt = tinte.getContext("2d");

    const m = {
      cam: CFG.PISTA / 2, sacudida: 0, ambiente: 0.6, foco: null, gris: false,
      particulas: [], manchas: [], destellos: [],
      pancartas: [], puertas: [{ apertura: 0, objetivo: 0 }, { apertura: 0, objetivo: 0 }],
      murcielagos: [], proxMurcielagos: 8000
    };
    for (let x = 400; x < CFG.PISTA; x += 400) m.pancartas.push({ x, duenio: -1, giro: 1, anterior: -1 });

    m.px = x => (x - m.cam) * U + AN / 2;                 // unidades del mundo a píxel de pantalla
    const capaX = (lx, f) => lx - m.cam * U * f + AN / 2;

    m.reiniciar = function () {
      m.pancartas.forEach(p => { p.duenio = -1; p.anterior = -1; p.giro = 1; });
      m.puertas.forEach(p => { p.apertura = 0; p.objetivo = 0; });
      m.manchas.length = 0; m.particulas.length = 0; m.destellos.length = 0;
    };

    /* --- Partículas --- */
    m.emitir = function (tipo, x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        if (m.particulas.length > 260) m.particulas.shift();
        const a = (o.angulo !== undefined ? o.angulo : -Math.PI / 2) + (Math.random() - 0.5) * (o.abanico !== undefined ? o.abanico : Math.PI);
        const v = (o.vel || 60) * (0.4 + Math.random() * 0.8);
        m.particulas.push({
          tipo, f: o.f || 1, lx: o.pantalla ? x : x * U, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          vida: 0, max: (o.vida || 0.6) * (0.6 + Math.random() * 0.8), color: o.color || "#fff", pantalla: !!o.pantalla, semilla: Math.random() * 10
        });
      }
    };
    m.destello = function (x, y, radio, color, dur) { m.destellos.push({ x, y, radio, color, t: 0, dur: dur || 0.15 }); };

    /* Lo que el mundo necesita saber de la partida para animarse. */
    m.actualizar = function (dt, ahora, info) {
      // estandartes: pasan al color de quien lleva la ventaja cuando los cruza hacia su salida
      if (info && info.ventaja >= 0) {
        const f = info.j[info.ventaja];
        if (f && f.vivo) {
          const dir = info.ventaja === 0 ? 1 : -1;
          m.pancartas.forEach(p => {
            if (p.duenio !== info.ventaja && (f.x - p.x) * dir > 0 && Math.abs(f.x - p.x) < 200) { p.anterior = p.duenio; p.duenio = info.ventaja; p.giro = 0; }
          });
        }
      }
      m.pancartas.forEach(p => { if (p.giro < 1) p.giro = Math.min(1, p.giro + dt * 2.4); });
      // puertas: se levantan cuando alguien con ventaja se acerca a su salida
      m.puertas.forEach((p, i) => {
        let obj = 0;
        if (info && info.j) {
          const f = info.j[i];
          const dist = i === 0 ? CFG.PISTA - f.x : f.x;
          if (info.ganador === i) obj = 1;
          else if (info.ventaja === i && f.vivo) obj = Math.max(0, Math.min(0.45, (1100 - dist) / 1100 * 0.45));
        }
        p.objetivo = obj;
        p.apertura += (p.objetivo - p.apertura) * Math.min(1, dt * (obj === 1 ? 1.2 : 2));
      });
      // partículas
      for (const q of m.particulas) {
        q.vida += dt;
        if (q.tipo === "brasa") { q.vx += Math.sin(ahora / 300 + q.semilla) * 6 * dt; q.vy -= 4 * dt; }
        else if (q.tipo === "sangre" || q.tipo === "chispa") q.vy += 420 * dt;
        else if (q.tipo === "petalo") { q.vx = Math.sin(ahora / 500 + q.semilla) * 18; q.vy = 22; }
        else if (q.tipo === "polvo") { q.vx *= 0.92; q.vy *= 0.92; q.vy -= 3 * dt; }
        q.lx += q.vx * dt; q.y += q.vy * dt;
        if (q.tipo === "sangre" && q.y >= SUELO) {
          q.vida = q.max;
          if (m.manchas.length < 80) m.manchas.push({ x: q.lx / U, w: 1 + Math.floor(Math.random() * 3), t: ahora, oscura: Math.random() < 0.5 });
        }
        if (q.tipo === "chispa" && q.y >= SUELO) { q.y = SUELO; q.vy *= -0.3; q.vx *= 0.6; }
      }
      m.particulas = m.particulas.filter(q => q.vida < q.max);
      for (const d of m.destellos) d.t += dt;
      m.destellos = m.destellos.filter(d => d.t < d.dur);
      m.manchas = m.manchas.filter(s => ahora - s.t < 60000);
      // murciélagos de vez en cuando
      m.proxMurcielagos -= dt * 1000;
      if (m.proxMurcielagos <= 0) {
        m.proxMurcielagos = 18000 + Math.random() * 22000;
        const dir = Math.random() < 0.5 ? 1 : -1, y = 40 + Math.random() * 50;
        for (let i = 0; i < 5; i++) m.murcielagos.push({ x: dir > 0 ? -20 - i * 9 : AN + 20 + i * 9, y: y + (Math.random() - 0.5) * 16, vx: dir * (55 + Math.random() * 20), s: Math.random() * 6 });
      }
      m.murcielagos.forEach(b => { b.x += b.vx * dt; });
      m.murcielagos = m.murcielagos.filter(b => b.x > -60 && b.x < AN + 60);
      // brasas de las antorchas visibles
      if (Math.random() < dt * 9) {
        const ant = m.antorchas[Math.floor(Math.random() * m.antorchas.length)];
        if (ant) m.emitir("brasa", ant.lx, ant.y - 6, 1, { f: 0.8, pantalla: true, vel: 10, vida: 1.6, abanico: 0.8, color: Math.random() < 0.5 ? "#ffb347" : "#ff7a2e" });
      }
    };
    m.antorchas = [];

    /* --- Dibujo: fondo, todo lo que va detrás de los luchadores --- */
    m.dibujarFondo = function (g, ahora) {
      m.lucesExtra = [];
      g.drawImage(piezas.cielo, 0, 0);
      // estrellas que titilan
      for (let i = 0; i < 6; i++) {
        const t = Math.floor(ahora / 700 + i * 3.3);
        if (t % 3 === 0) rect(g, (i * 97 + 31) % AN, 10 + (i * 23) % 90, 1, 1, "#ffffff");
      }
      g.drawImage(piezas.luna, Math.round(388 - m.cam * U * 0.03 % 40), 14);
      const n1 = ((m.cam * U * 0.08 + ahora * 0.004) % 960 + 960) % 960;
      g.globalAlpha = 0.85; g.drawImage(piezas.nubesA, -n1, 6); g.drawImage(piezas.nubesA, 960 - n1, 6);
      const n2 = ((m.cam * U * 0.12 + ahora * 0.007) % 960 + 960) % 960;
      g.globalAlpha = 0.55; g.drawImage(piezas.nubesB, -n2, 28); g.drawImage(piezas.nubesB, 960 - n2, 28);
      g.globalAlpha = 1;
      // murciélagos
      m.murcielagos.forEach(b => {
        const ala = Math.floor(ahora / 90 + b.s) % 2;
        rect(g, b.x, b.y, 1, 1, "#0a0710");
        rect(g, b.x - 2, b.y - ala, 2, 1, "#0a0710"); rect(g, b.x + 1, b.y - ala, 2, 1, "#0a0710");
      });
      // catedral lejana
      const c1 = ((m.cam * U * 0.2) % 480 + 480) % 480;
      g.drawImage(piezas.catedral, -c1, SUELO - 160); g.drawImage(piezas.catedral, 480 - c1, SUELO - 160);
      // arcadas
      const a1 = ((m.cam * U * 0.45) % 192 + 192) % 192;
      for (let x = -a1; x < AN; x += 192) g.drawImage(piezas.arcadas, Math.round(x), 0);
      // columnas con antorchas
      m.antorchas = [];
      const sep = 150;
      const desde = Math.floor((m.cam * U * 0.8 - AN / 2 - 40) / sep), hasta = Math.ceil((m.cam * U * 0.8 + AN / 2 + 40) / sep);
      for (let i = desde; i <= hasta; i++) {
        const lx = i * sep, x = capaX(lx, 0.8);
        g.drawImage(piezas.columna, Math.round(x - 15), 22);
        if (((i % 2) + 2) % 2 === 0) {
          const fl = Math.floor(ahora / 110 + i * 7) % 3;
          const ax = Math.round(x + 11), ay = 22 + 62;
          rect(g, ax, ay - 1, 3, 6, "#3a2a1c");
          rect(g, ax - 1, ay - 7 - fl, 5, 6 + fl, "#e2702a");
          rect(g, ax, ay - 9 - fl, 3, 5 + fl, "#ffb347");
          rect(g, ax + 1, ay - 6, 1, 3, "#fff1b0");
          m.antorchas.push({ lx: lx + 12, x: ax + 1, y: ay - 4 });
        }
      }
      // suelo
      const s1 = ((m.cam * U) % 128 + 128) % 128;
      for (let x = -s1; x < AN; x += 128) g.drawImage(piezas.suelo, Math.round(x), SUELO);
      // runas en los límites de zona
      for (let z = 800; z < CFG.PISTA; z += 800) {
        const x = m.px(z);
        if (x < -10 || x > AN + 10) continue;
        rect(g, x - 5, SUELO + 6, 11, 1, "#4a3d70"); rect(g, x - 5, SUELO + 10, 11, 1, "#4a3d70");
        rect(g, x - 1, SUELO + 5, 3, 7, "#4a3d70"); rect(g, x, SUELO + 7, 1, 3, "#8a7ab8");
      }
      // manchas de sangre en el suelo
      m.manchas.forEach(s => {
        const x = m.px(s.x);
        if (x < -4 || x > AN + 4) return;
        const viejo = Math.min(1, (ahora - s.t) / 60000);
        g.globalAlpha = 1 - viejo * 0.8;
        rect(g, x, SUELO + 1, s.w, 1, s.oscura ? "#5a0f18" : "#8a1a24");
      });
      g.globalAlpha = 1;
      // puertas
      dibujarPuerta(g, ahora, 0);
      dibujarPuerta(g, ahora, 1);
      // fuera de la pista: muro
      const x0 = m.px(-60), x1 = m.px(CFG.PISTA + 60);
      if (x0 > 0) { rect(g, 0, 0, Math.ceil(x0), AL, "#07050c"); }
      if (x1 < AN) { rect(g, Math.floor(x1), 0, AN - Math.floor(x1), AL, "#07050c"); }
      // estandartes colgados del techo
      m.pancartas.forEach(p => dibujarPancarta(g, p, ahora));
    };

    function dibujarPuerta(g, ahora, i) {
      // i = 0: salida del jugador 0, a la derecha; i = 1: a la izquierda
      const p = m.puertas[i];
      const centro = i === 0 ? CFG.PISTA - CFG.SALIDA / 2 : CFG.SALIDA / 2;
      const x = m.px(centro);
      if (x < -90 || x > AN + 90) return;
      const pal = S.PALETAS[i];
      const ancho = 64, alto = 120, x0 = Math.round(x - ancho / 2), y0 = SUELO - alto;
      const calida = i === 0 ? "#ffd98a" : "#a8e0ff";
      // marco de piedra
      rect(g, x0 - 12, y0 - 18, ancho + 24, alto + 18, "#2a2146");
      rect(g, x0 - 12, y0 - 18, ancho + 24, 2, "#4b3f7a");
      rect(g, x0 - 12, y0 - 18, 3, alto + 18, "#1f1838");
      // hueco con la luz de fuera, más intensa cuanto más abierta
      rect(g, x0, y0, ancho, alto, "#05030a");
      const abierta = p.apertura;
      if (abierta > 0.01) {
        g.globalAlpha = Math.min(1, abierta * 1.6);
        rect(g, x0, y0, ancho, alto, calida);
        rect(g, x0 + 8, y0 + 10, ancho - 16, alto - 10, "#fffaf0");
        g.globalAlpha = 1;
      }
      // arco superior
      for (let y = 0; y < 14; y++) {
        const w = Math.round(ancho / 2 * Math.sqrt(Math.max(0, 1 - Math.pow((14 - y) / 14, 2))));
        rect(g, x0, y0 + y, ancho / 2 - w, 1, "#2a2146"); rect(g, x0 + ancho / 2 + w, y0 + y, ancho / 2 - w, 1, "#2a2146");
      }
      // rastrillo que sube
      const sube = Math.round(abierta * (alto - 6));
      g.save(); g.beginPath(); g.rect(x0, y0, ancho, alto); g.clip();
      for (let bx = x0 + 3; bx < x0 + ancho; bx += 8) rect(g, bx, y0 - sube, 2, alto, "#3a3046");
      for (let by = y0 + 8 - sube; by < SUELO - sube; by += 12) rect(g, x0, by, ancho, 2, "#3a3046");
      for (let bx = x0 + 3; bx < x0 + ancho; bx += 8) rect(g, bx, SUELO - sube - 4, 2, 4, "#5a4e66");
      g.restore();
      // escudo de quien sale por aquí
      rect(g, x - 7, y0 - 16, 14, 12, "#0a0710"); rect(g, x - 6, y0 - 15, 12, 9, pal.bandera); rect(g, x - 4, y0 - 6, 8, 2, pal.bandera);
      rect(g, x - 2, y0 - 6 + 2, 4, 1, pal.bandera);
      rect(g, x - 1, y0 - 13, 2, 6, pal.ribete);
      // flecha en el suelo hacia la puerta
      const dir = i === 0 ? 1 : -1;
      const fx = Math.round(x - dir * 56), fy = SUELO + 8;
      for (let k = 0; k < 4; k++) rect(g, fx + dir * k, fy - (3 - k), 1, (3 - k) * 2 + 1, pal.bandera);
      m.luzPuertas[i] = { x, y: y0 + alto / 2, abierta };
    }
    m.luzPuertas = [null, null];

    function dibujarPancarta(g, p, ahora) {
      const x = m.px(p.x);
      if (x < -20 || x > AN + 20) return;
      const ond = Math.round(Math.sin(ahora / 700 + p.x) * 1);
      const ancho = Math.max(1, Math.round(18 * Math.abs(Math.cos(p.giro * Math.PI))));
      const duenio = p.giro < 0.5 ? p.anterior : p.duenio;
      const col = duenio < 0 ? "#3a3050" : S.PALETAS[duenio].bandera;
      const ribete = duenio < 0 ? "#5a4e78" : S.PALETAS[duenio].ribete;
      const y0 = 60;
      rect(g, x - 13, y0, 26, 2, "#0a0710"); rect(g, x - 12, y0, 24, 1, "#5a4330");
      rect(g, x - ancho / 2 - 1, y0 + 2, ancho + 2, 38, "#0a0710");
      rect(g, x - ancho / 2, y0 + 2, ancho, 34, col);
      for (let k = 0; k < ancho / 2; k++) { const d = Math.min(k, ancho / 2 - k) / 2; rect(g, x - ancho / 2 + k, y0 + 36 + d + ond, 1, 1, col); rect(g, x + ancho / 2 - k - 1, y0 + 36 + d + ond, 1, 1, col); }
      rect(g, x - ancho / 2, y0 + 4, ancho, 1, ribete);
      if (ancho > 10) { rect(g, x - 1, y0 + 11 + ond, 3, 13, ribete); rect(g, x - 5, y0 + 15 + ond, 11, 3, ribete); }
    }

    /* --- Delante de los luchadores: cadenas, partículas, luz y viñeta --- */
    m.dibujarDelante = function (g, ahora) {
      // partículas
      for (const q of m.particulas) {
        const x = q.pantalla ? capaX(q.lx, q.f) : capaX(q.lx, 1);
        const k = q.vida / q.max;
        if (q.tipo === "brasa") { g.globalAlpha = 1 - k; rect(g, x, q.y, 1, 1, Math.floor(ahora / 80 + q.semilla) % 2 ? "#ffd27a" : q.color); }
        else if (q.tipo === "chispa") { g.globalAlpha = 1 - k * 0.7; rect(g, x, q.y, 1, 1, k < 0.3 ? "#ffffff" : q.color); }
        else if (q.tipo === "sangre") { g.globalAlpha = 1; rect(g, x, q.y, 1, 1, q.color); }
        else if (q.tipo === "polvo") { g.globalAlpha = (1 - k) * 0.6; const r = 1 + Math.floor(k * 3); rect(g, x - r / 2, q.y - r / 2, r, r, "#8a7ba8"); }
        else if (q.tipo === "petalo") { g.globalAlpha = 1 - Math.max(0, k - 0.8) * 5; rect(g, x, q.y, 2, 1, q.color); }
      }
      g.globalAlpha = 1;
      // cadenas con farol en primer plano
      const sep = 1150 * U * 1.3;
      const desde = Math.floor((m.cam * U * 1.3 - AN) / sep), hasta = Math.ceil((m.cam * U * 1.3 + AN) / sep);
      m.faroles = [];
      for (let i = desde; i <= hasta; i++) {
        const x = Math.round(capaX(i * sep + 120, 1.3));
        if (x < -20 || x > AN + 20) continue;
        const largo = 26 + ((i * 37) % 3) * 6;
        const vaiv = Math.round(Math.sin(ahora / 900 + i) * 1.5);
        for (let y = 0; y < largo; y += 3) rect(g, x + Math.round(vaiv * y / largo), y, 2, 2, "#0a0710");
        const fx = x + vaiv, fy = largo;
        rect(g, fx - 4, fy, 10, 11, "#0a0710"); rect(g, fx - 2, fy + 2, 6, 6, "#e89a3c"); rect(g, fx - 1, fy + 3, 4, 3, "#ffe2a0");
        m.faroles.push({ x: fx + 1, y: fy + 5 });
      }
    };

    /* Luz: un velo oscuro con huecos donde hay fuego, más un tinte cálido; todo a media resolución. */
    m.dibujarLuz = function (g, ahora) {
      gl.globalCompositeOperation = "source-over";
      gl.clearRect(0, 0, AN / 2, AL / 2);
      gl.fillStyle = "rgba(6,4,18," + m.ambiente + ")";
      gl.fillRect(0, 0, AN / 2, AL / 2);
      gl.globalCompositeOperation = "destination-out";
      gt.clearRect(0, 0, AN / 2, AL / 2);
      gt.globalCompositeOperation = "source-over";
      const hueco = (x, y, r, fuerza) => {
        const gr = gl.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2);
        gr.addColorStop(0, "rgba(0,0,0," + fuerza + ")"); gr.addColorStop(0.55, "rgba(0,0,0," + fuerza * 0.55 + ")"); gr.addColorStop(1, "rgba(0,0,0,0)");
        gl.fillStyle = gr; gl.fillRect(x / 2 - r / 2, y / 2 - r / 2, r, r);
      };
      const color = (x, y, r, c, a) => {
        const gr = gt.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2);
        gr.addColorStop(0, c.replace("A", a)); gr.addColorStop(1, c.replace("A", 0));
        gt.fillStyle = gr; gt.fillRect(x / 2 - r / 2, y / 2 - r / 2, r, r);
      };
      // luz de luna general sobre el suelo
      hueco(AN / 2, SUELO - 40, 520, 0.35);
      m.antorchas.forEach((a, i) => {
        const t = 0.85 + Math.sin(ahora / 140 + i * 5) * 0.08 + Math.sin(ahora / 57 + i) * 0.04;
        hueco(a.x, a.y, 150 * t, 0.95); color(a.x, a.y, 120 * t, "rgba(255,140,50,A)", 0.22);
      });
      (m.faroles || []).concat(m.lucesExtra || []).forEach(f => { hueco(f.x, f.y, 80, 0.8); color(f.x, f.y, 60, "rgba(255,170,80,A)", 0.25); });
      m.luzPuertas.forEach((p, i) => {
        if (!p || p.abierta < 0.02) return;
        hueco(p.x, p.y, 120 + 260 * p.abierta, Math.min(1, 0.4 + p.abierta));
        color(p.x, p.y, 120 + 220 * p.abierta, i === 0 ? "rgba(255,210,130,A)" : "rgba(150,215,255,A)", 0.35 * p.abierta);
      });
      m.destellos.forEach(d => {
        const k = 1 - d.t / d.dur;
        hueco(d.x, d.y, d.radio, k); color(d.x, d.y, d.radio, d.color, 0.5 * k);
      });
      if (m.foco) { hueco(m.foco.x, m.foco.y, m.foco.r, 1); color(m.foco.x, m.foco.y, m.foco.r * 0.8, "rgba(255,230,170,A)", 0.25); }
      const suavizado = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(luz, 0, 0, AN, AL);
      g.globalCompositeOperation = "lighter";
      g.drawImage(tinte, 0, 0, AN, AL);
      g.globalCompositeOperation = "source-over";
      g.drawImage(piezas.vineta, 0, 0, AN, AL);
      g.imageSmoothingEnabled = suavizado;
    };

    /* Tablón de retos para la pantalla en línea: postes y tabla, el papel va encima en HTML. */
    m.dibujarTablon = function (g, x, y, w, h, ahora) {
      rect(g, x + 8, y + h, 6, SUELO - y - h, "#0a0710"); rect(g, x + 9, y + h, 4, SUELO - y - h, "#4a3420");
      rect(g, x + w - 14, y + h, 6, SUELO - y - h, "#0a0710"); rect(g, x + w - 13, y + h, 4, SUELO - y - h, "#4a3420");
      rect(g, x - 2, y - 2, w + 4, h + 4, "#0a0710");
      for (let k = 0; k < h; k += 8) { rect(g, x, y + k, w, 8, k % 16 ? "#5a3d24" : "#654429"); rect(g, x, y + k + 7, w, 1, "#3a2716"); }
      rect(g, x - 4, y - 8, w + 8, 6, "#0a0710"); rect(g, x - 3, y - 7, w + 6, 4, "#3a2a40");
      // farolillo colgado del tejadillo
      const fx = x + w - 10, fy = y + 4 + Math.round(Math.sin(ahora / 800));
      rect(g, fx - 2, fy, 5, 6, "#0a0710"); rect(g, fx - 1, fy + 1, 3, 3, "#ffcf7a");
      m.lucesExtra.push({ x: fx, y: fy + 2 });
    };

    return m;
  }

  window.EstocattaMundo = { crearMundo, AN, AL, SUELO, U };
})();
