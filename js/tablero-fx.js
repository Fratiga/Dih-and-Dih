/* =============================================================================
   TABLERO — efectos (FX) con partículas: los tipos y colores del panel de Efectos de Roll20.
   Modo "apuntar": se arrastra de un punto a otro. "clic": en un punto. "espera": se queda un rato en un punto.
   Solo anima mientras hay partículas (nada de bucles en reposo).
============================================================================= */
(function () {
  const TIPOS = [
    { id: "aliento", nombre: "Aliento", modo: "apuntar" },
    { id: "haz", nombre: "Haz", modo: "apuntar" },
    { id: "cohete", nombre: "Cohete", modo: "apuntar" },
    { id: "quemar", nombre: "Quemar", modo: "espera" },
    { id: "brillo", nombre: "Brillo", modo: "espera" },
    { id: "destello", nombre: "Destello", modo: "espera" },
    { id: "escudo", nombre: "Escudo", modo: "espera" },
    { id: "bomba", nombre: "Bomba", modo: "clic" },
    { id: "explotar", nombre: "Explotar", modo: "clic" },
    { id: "rafaga", nombre: "Ráfaga", modo: "espera" },
    { id: "burbujeante", nombre: "Burbujeante", modo: "espera" },
    { id: "estrella", nombre: "Estrella nueva", modo: "clic" },
    { id: "salpicar", nombre: "Salpicar", modo: "apuntar" },
    { id: "agrupacion", nombre: "Agrupación", modo: "clic" },
    { id: "misil", nombre: "Misil", modo: "apuntar" }
  ];
  const COLORES = [
    { id: "fuego", nombre: "Fuego", muestra: "#e8401c", tonos: ["#ff4500", "#ff8c1a", "#ffd34d"] },
    { id: "encanto", nombre: "Encanto", muestra: "#d6268f", tonos: ["#e62b9b", "#ff8fd0", "#ffd1ec"] },
    { id: "acido", nombre: "Ácido", muestra: "#2db83d", tonos: ["#36c943", "#a5ff5c", "#e6ff9e"] },
    { id: "muerte", nombre: "Muerte", muestra: "#111", tonos: ["#0d0d0d", "#2e2e2e", "#4d1250"], oscuro: true },
    { id: "sagrada", nombre: "Sagrada", muestra: "#b8962e", tonos: ["#d7b23a", "#fff3b0", "#ffffff"] },
    { id: "sangre", nombre: "Sangre", muestra: "#a10f12", tonos: ["#7a0000", "#c41414", "#e84a4a"], oscuro: true },
    { id: "escarcha", nombre: "Escarcha", muestra: "#6c7fd8", tonos: ["#6c8ef0", "#b7d4ff", "#ffffff"] },
    { id: "limo", nombre: "Limo", muestra: "#3fd14e", tonos: ["#37e05a", "#1f8f36", "#b8ff9e"] },
    { id: "humo", nombre: "Humo", muestra: "#8a8a8a", tonos: ["#6e6e6e", "#9a9a9a", "#c4c4c4"], oscuro: true },
    { id: "agua", nombre: "Agua", muestra: "#1a2fa8", tonos: ["#173bb5", "#4fa3ff", "#c9e6ff"] },
    { id: "magia", nombre: "Magia", muestra: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)", arcoiris: true }
  ];

  function crear(capa) {
    const particulas = [];
    const emisores = [];
    const forma = new Konva.Shape({
      listening: false,
      sceneFunc(ctx) {
        const raw = ctx._context;
        raw.save();
        for (const p of particulas) {
          const vida = 1 - p.edad / p.max;
          if (vida <= 0) continue;
          raw.globalCompositeOperation = p.oscuro ? "source-over" : "lighter";
          raw.globalAlpha = Math.min(1, vida * 1.4) * (p.alfa == null ? 1 : p.alfa);
          raw.fillStyle = p.color;
          raw.beginPath();
          raw.arc(p.x, p.y, Math.max(0.5, p.tam * (p.crece ? 1 + (1 - vida) * p.crece : vida * 0.7 + 0.3)), 0, Math.PI * 2);
          raw.fill();
        }
        raw.restore();
      }
    });
    capa.add(forma);
    let anim = null;

    const azar = (a, b) => a + Math.random() * (b - a);
    function tono(c) {
      if (c.arcoiris) return `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`;
      return c.tonos[Math.floor(Math.random() * c.tonos.length)];
    }
    function nueva(c, x, y, vx, vy, max, tam, extra) {
      particulas.push(Object.assign({ x, y, vx, vy, edad: 0, max, tam, color: tono(c), oscuro: !!c.oscuro, grav: 0, roce: 0.985 }, extra || {}));
    }

    // Cada emisor: { t, dur, paso(dt) } que añade partículas mientras dura
    const comportamientos = {
      aliento(c, a, b, s) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), L = Math.hypot(b.x - a.x, b.y - a.y);
        return { dur: 0.9, paso() { for (let i = 0; i < 14; i++) { const d = ang + azar(-0.46, 0.46), v = azar(0.7, 1.1) * L / 0.75; nueva(c, a.x, a.y, Math.cos(d) * v, Math.sin(d) * v, azar(0.6, 0.85), azar(5, 11) * s, { roce: 0.95, crece: 1.5 }); } } };
      },
      haz(c, a, b, s) {
        return { dur: 0.6, paso() { for (let i = 0; i < 18; i++) { const t = Math.random(); nueva(c, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, azar(-20, 20), azar(-20, 20), azar(0.25, 0.5), azar(3, 7) * s); } } };
      },
      cohete(c, a, b, s) { return proyectil(c, a, b, s, 1, 0.7, 5); },
      misil(c, a, b, s) { return proyectil(c, a, b, s, 3, 0.55, 3); },
      salpicar(c, a, b, s) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), L = Math.hypot(b.x - a.x, b.y - a.y);
        return { dur: 0.15, paso() { for (let i = 0; i < 30; i++) { const d = ang + azar(-0.3, 0.3), v = azar(0.6, 1.2) * L / 0.6; nueva(c, a.x, a.y, Math.cos(d) * v, Math.sin(d) * v, azar(0.6, 0.9), azar(3, 7) * s, { grav: 160 * s, roce: 0.96 }); } } };
      },
      quemar(c, a, b, s) {
        return { dur: 2.6, paso() { for (let i = 0; i < 5; i++) nueva(c, a.x + azar(-22, 22) * s, a.y + azar(-8, 10) * s, azar(-10, 10), azar(-90, -40) * s, azar(0.5, 1.0), azar(5, 10) * s); } };
      },
      brillo(c, a, b, s) {
        return { dur: 2.2, paso() { for (let i = 0; i < 3; i++) { const d = Math.random() * Math.PI * 2, r = azar(5, 45) * s; nueva(c, a.x + Math.cos(d) * r, a.y + Math.sin(d) * r, 0, 0, azar(0.3, 0.7), azar(2, 4) * s, { crece: 0.6 }); } } };
      },
      destello(c, a, b, s) {
        return { dur: 0.1, paso() { nueva(c, a.x, a.y, 0, 0, 0.45, 18 * s, { crece: 5 }); for (let i = 0; i < 24; i++) { const d = i / 24 * Math.PI * 2; nueva(c, a.x, a.y, Math.cos(d) * 260 * s, Math.sin(d) * 260 * s, 0.35, 3 * s); } } };
      },
      escudo(c, a, b, s) {
        let ang = 0;
        return { dur: 2.4, paso(dt) { ang += dt * 5; for (let i = 0; i < 4; i++) { const d = ang + i * Math.PI / 2; nueva(c, a.x + Math.cos(d) * 42 * s, a.y + Math.sin(d) * 42 * s, 0, 0, 0.5, 4 * s); } } };
      },
      bomba(c, a, b, s) { return estallido(c, a, s, 50, 220); },
      explotar(c, a, b, s) { return estallido(c, a, s, 110, 380); },
      rafaga(c, a, b, s) {
        let ang = 0;
        return { dur: 2.0, paso(dt) { ang += dt * 9; for (let i = 0; i < 3; i++) { const d = ang + i * 2.1, r = azar(10, 50) * s; nueva(c, a.x + Math.cos(d) * r, a.y + Math.sin(d) * r, -Math.sin(d) * 120 * s, Math.cos(d) * 120 * s, 0.5, 3.5 * s); } } };
      },
      burbujeante(c, a, b, s) {
        return { dur: 2.6, paso() { if (Math.random() < 0.6) nueva(c, a.x + azar(-25, 25) * s, a.y + azar(-5, 15) * s, azar(-6, 6), azar(-60, -25) * s, azar(0.9, 1.5), azar(3, 8) * s, { alfa: 0.7, roce: 1 }); } };
      },
      estrella(c, a, b, s) {
        return { dur: 0.1, paso() {
          nueva(c, a.x, a.y, 0, 0, 0.8, 14 * s, { crece: 3 });
          for (let i = 0; i < 8; i++) { const d = i / 8 * Math.PI * 2; for (let k = 0; k < 8; k++) nueva(c, a.x, a.y, Math.cos(d) * (60 + k * 40) * s, Math.sin(d) * (60 + k * 40) * s, 0.7, 3 * s, { roce: 0.97 }); }
          for (let i = 0; i < 40; i++) { const d = i / 40 * Math.PI * 2; nueva(c, a.x, a.y, Math.cos(d) * 150 * s, Math.sin(d) * 150 * s, 0.9, 2.5 * s, { roce: 0.99 }); }
        } };
      },
      agrupacion(c, a, b, s) {
        return { dur: 0.1, paso() {
          for (let i = 0; i < 70; i++) { const d = Math.random() * Math.PI * 2, r = azar(70, 120) * s; nueva(c, a.x + Math.cos(d) * r, a.y + Math.sin(d) * r, -Math.cos(d) * r / 0.45, -Math.sin(d) * r / 0.45, 0.5, 3.5 * s, { roce: 1 }); }
          setTimeout(() => lanzarEmisor(estallido(c, a, s, 50, 240)), 450);
        } };
      }
    };
    function proyectil(c, a, b, s, cuantos, dur, tam) {
      let t = 0;
      const desfases = Array.from({ length: cuantos }, (x, i) => (i - (cuantos - 1) / 2) * 0.35);
      let terminado = false;
      return { dur: dur + 0.05, paso(dt) {
        t += dt;
        const f = Math.min(1, t / dur);
        desfases.forEach(df => {
          const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2, curva = Math.sin(f * Math.PI) * df * 60 * s;
          const x = a.x + (b.x - a.x) * f + Math.cos(ang) * curva, y = a.y + (b.y - a.y) * f + Math.sin(ang) * curva;
          for (let i = 0; i < 3; i++) nueva(c, x, y, azar(-15, 15), azar(-15, 15), 0.35, tam * s);
        });
        if (f >= 1 && !terminado) { terminado = true; lanzarEmisor(estallido(c, b, s, 30 * cuantos, 200)); }
      } };
    }
    function estallido(c, a, s, n, v) {
      return { dur: 0.05, paso() { for (let i = 0; i < n; i++) { const d = Math.random() * Math.PI * 2, vel = azar(0.2, 1) * v * s; nueva(c, a.x, a.y, Math.cos(d) * vel, Math.sin(d) * vel, azar(0.4, 0.9), azar(3, 8) * s, { roce: 0.93, crece: 0.8 }); } } };
    }

    function lanzarEmisor(e) {
      e.t = 0;
      emisores.push(e);
      if (!anim) {
        anim = new Konva.Animation(frame => {
          const dt = Math.min(0.05, frame.timeDiff / 1000);
          for (let i = emisores.length - 1; i >= 0; i--) {
            const em = emisores[i];
            em.paso(dt);
            em.t += dt;
            if (em.t >= em.dur) emisores.splice(i, 1);
          }
          for (let i = particulas.length - 1; i >= 0; i--) {
            const p = particulas[i];
            p.edad += dt;
            if (p.edad >= p.max) { particulas.splice(i, 1); continue; }
            p.vy += p.grav * dt;
            p.vx *= p.roce; p.vy *= p.roce;
            p.x += p.vx * dt; p.y += p.vy * dt;
          }
          if (!emisores.length && !particulas.length) { anim.stop(); anim = null; capa.batchDraw(); }
        }, capa);
        anim.start();
      }
    }

    return {
      reproducir(d) {
        const c = COLORES.find(x => x.id === d.color) || COLORES[0];
        const f = comportamientos[d.tipo] || comportamientos.explotar;
        const s = d.escala || 1;
        lanzarEmisor(f(c, d.a, d.b || d.a, s));
        if (particulas.length > 2500) particulas.splice(0, particulas.length - 2500);
      }
    };
  }

  window.TBFx = { crear, TIPOS, COLORES };
})();
