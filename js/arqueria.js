/* Arquería contra un rival simulado. Mismo esquema que el juego de Hooey: un
   campo de tamaño lógico fijo (960x600) que solo se escala al dibujar, así el
   zoom o el tamaño de la ventana no cambian la dificultad. Los blancos caen,
   se les dispara con clic (o con las teclas Z / X sobre el cursor) y puntúa lo
   cerca que quede el tiro del centro. A un lado corre el puntaje del rival.
   Lo usan arqueria.html (Cassius) y Muerte Súbita (Verdam). */
(function () {
  const LOGICO_ANCHO = 960;
  const LOGICO_ALTO = 600;

  // dist = [centro, interior, exterior] de los tiros que aciertan; ritmo
  // sale de intervalo * precisión * promedio de anillo (Cassius ~300, Verdam ~620 en 60 s)
  const RIVALES = {
    cassius: {
      nombre: "Cassius", color: "#d9a441",
      intervalo: 1.0, precision: 0.75, dist: [0.25, 0.40, 0.35],
      radio: 46, velocidadBase: 110, zigzag: false
    },
    verdam: {
      nombre: "Verdam", color: "#8fd06a",
      intervalo: 0.75, precision: 0.93, dist: [0.55, 0.33, 0.12],
      radio: 38, velocidadBase: 140, zigzag: true
    }
  };
  const PUNTOS_ANILLO = [10, 7, 4];

  function crearArqueria({ canvas, rival: claveRival, duracion = 60, pantallas = true, onEstado, onFin }) {
    const cfg = RIVALES[claveRival] || RIVALES.cassius;
    const ctx = canvas.getContext("2d");
    const ancho = LOGICO_ANCHO;
    const alto = LOGICO_ALTO;

    let estado = "listo"; // listo | jugando | fin
    let tiempo = 0;
    let puntaje = 0;
    let puntajeRival = 0;
    let blancos = [];
    let efectos = [];
    let temporizadorBlanco = 0;
    let temporizadorRival = 0;
    let destelloRival = 0;
    let resultado = "";
    let ultimo = 0;
    let cursor = null;

    function ajustarTamano() {
      const dpr = window.devicePixelRatio || 1;
      const caja = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(caja.width * dpr));
      canvas.height = Math.max(1, Math.round(caja.height * dpr));
      ctx.setTransform(canvas.width / ancho, 0, 0, canvas.height / alto, 0, 0);
    }

    function posicion(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (ancho / r.width), y: (e.clientY - r.top) * (alto / r.height) };
    }

    function velocidad() {
      return cfg.velocidadBase + tiempo * 2.2;
    }

    function intervaloBlanco() {
      return Math.max(0.45, 0.85 - tiempo * 0.006);
    }

    function nuevoBlanco() {
      const r = cfg.radio;
      const x0 = r + Math.random() * (ancho - r * 2);
      return {
        x0, x: x0, y: -r, r, t: 0,
        amp: cfg.zigzag ? 18 + Math.random() * 40 : 0,
        frec: 1.2 + Math.random() * 1.6,
        vel: 0.92 + Math.random() * 0.2
      };
    }

    function disparar(x, y) {
      // El blanco más cercano al frente (el último dibujado) que contenga el tiro
      for (let i = blancos.length - 1; i >= 0; i--) {
        const b = blancos[i];
        const d = Math.hypot(x - b.x, y - b.y) / b.r;
        if (d > 1) continue;
        const anillo = d < 0.25 ? 0 : d < 0.55 ? 1 : 2;
        const pts = PUNTOS_ANILLO[anillo];
        puntaje += pts;
        efectos.push({ tipo: "texto", x: b.x, y: b.y, texto: `+${pts}`, edad: 0, vida: 0.7, color: anillo === 0 ? "#ffd84a" : "#e8e4d0" });
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 70 + Math.random() * 130;
          efectos.push({ tipo: "chispa", x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, edad: 0, vida: 0.5, color: anillo === 0 ? "#f1c40f" : "#c0392b" });
        }
        blancos.splice(i, 1);
        return;
      }
    }

    function tiroDelRival() {
      if (Math.random() > cfg.precision) return;
      const r = Math.random();
      const anillo = r < cfg.dist[0] ? 0 : r < cfg.dist[0] + cfg.dist[1] ? 1 : 2;
      puntajeRival += PUNTOS_ANILLO[anillo];
      destelloRival = 0.45;
    }

    function cambiarEstado(nuevo) {
      estado = nuevo;
      if (onEstado) onEstado(nuevo);
    }

    function iniciar() {
      tiempo = 0; puntaje = 0; puntajeRival = 0; blancos = [nuevoBlanco()]; efectos = [];
      temporizadorBlanco = intervaloBlanco(); temporizadorRival = cfg.intervalo; destelloRival = 0; resultado = "";
      cambiarEstado("jugando");
    }

    function terminar() {
      resultado = puntaje > puntajeRival ? "ganado" : puntaje < puntajeRival ? "perdido" : "empate";
      cambiarEstado("fin");
      if (onFin) onFin({ puntaje, puntajeRival, resultado });
    }

    function actualizar(dt) {
      if (estado === "jugando") {
        tiempo += dt;
        temporizadorBlanco -= dt;
        if (temporizadorBlanco <= 0) { blancos.push(nuevoBlanco()); temporizadorBlanco = intervaloBlanco(); }
        temporizadorRival -= dt;
        while (temporizadorRival <= 0) { tiroDelRival(); temporizadorRival += cfg.intervalo; }
        if (destelloRival > 0) destelloRival -= dt;
        const v = velocidad();
        for (const b of blancos) {
          b.t += dt;
          b.y += v * b.vel * dt;
          if (b.amp) b.x = Math.min(ancho - b.r, Math.max(b.r, b.x0 + Math.sin(b.t * b.frec * 2) * b.amp));
        }
        blancos = blancos.filter(b => b.y - b.r < alto);
        if (tiempo >= duracion) { tiempo = duracion; terminar(); }
      }
      for (const e of efectos) {
        e.edad += dt;
        if (e.tipo === "chispa") { e.vy += 380 * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        else e.y -= 40 * dt;
      }
      efectos = efectos.filter(e => e.edad < e.vida);
    }

    function dibujarBlanco(b) {
      const anillos = [[1, "#e8e4d0"], [0.78, "#c0392b"], [0.55, "#e8e4d0"], [0.38, "#c0392b"], [0.25, "#f1c40f"]];
      for (const [f, color] of anillos) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    function dibujarMarcador() {
      const total = Math.max(60, puntaje, puntajeRival, 1);
      ctx.textBaseline = "alphabetic";
      ctx.font = "600 30px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#e8e4d0";
      ctx.fillText(`Tú ${puntaje}`, 22, 40);
      ctx.textAlign = "right";
      ctx.fillStyle = cfg.color;
      ctx.fillText(`${cfg.nombre} ${puntajeRival}`, ancho - 22, 40);
      // barras de puntaje
      ctx.fillStyle = "rgba(255,255,255,.1)";
      ctx.fillRect(22, 52, 300, 8);
      ctx.fillRect(ancho - 322, 52, 300, 8);
      ctx.fillStyle = "#e8e4d0";
      ctx.fillRect(22, 52, 300 * Math.min(1, puntaje / (total * 1.15)), 8);
      ctx.fillStyle = destelloRival > 0 ? "#ffffff" : cfg.color;
      const w = 300 * Math.min(1, puntajeRival / (total * 1.15));
      ctx.fillRect(ancho - 22 - w, 52, w, 8);
      // tiempo
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8e4d0";
      ctx.font = "600 34px sans-serif";
      ctx.fillText(String(Math.ceil(duracion - tiempo)), ancho / 2, 44);
      ctx.fillStyle = "rgba(255,255,255,.1)";
      ctx.fillRect(ancho / 2 - 70, 54, 140, 6);
      ctx.fillStyle = "#e8e4d0";
      ctx.fillRect(ancho / 2 - 70, 54, 140 * (1 - tiempo / duracion), 6);
    }

    function dibujar() {
      ctx.clearRect(0, 0, ancho, alto);
      for (const b of blancos) dibujarBlanco(b);
      for (const e of efectos) {
        ctx.globalAlpha = Math.max(0, 1 - e.edad / e.vida);
        if (e.tipo === "chispa") {
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 4, 4);
        } else {
          ctx.fillStyle = e.color;
          ctx.font = "700 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(e.texto, e.x, e.y);
        }
      }
      ctx.globalAlpha = 1;
      if (estado !== "listo") dibujarMarcador();
      if (pantallas && estado !== "jugando") {
        ctx.fillStyle = "rgba(0,0,0,.5)";
        ctx.fillRect(0, 0, ancho, alto);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8e4d0";
        ctx.font = "600 52px sans-serif";
        const titulo = estado === "listo" ? `Tú contra ${cfg.nombre}`
          : resultado === "ganado" ? "Ganaste" : resultado === "perdido" ? "Perdiste" : "Empate";
        ctx.fillText(titulo, ancho / 2, alto * 0.28);
        if (estado === "fin") {
          ctx.font = "30px sans-serif";
          ctx.fillStyle = "#b9b5a2";
          ctx.fillText(`${puntaje} a ${puntajeRival}`, ancho / 2, alto * 0.36);
        }
      }
    }

    function cuadro(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
      ultimo = t;
      actualizar(dt);
      dibujar();
      requestAnimationFrame(cuadro);
    }

    canvas.addEventListener("pointerdown", e => {
      if (estado !== "jugando") return;
      const p = posicion(e);
      disparar(p.x, p.y);
    });
    canvas.addEventListener("pointermove", e => { cursor = posicion(e); });
    canvas.addEventListener("pointerleave", () => { cursor = null; });
    document.addEventListener("keydown", e => {
      if (e.repeat || estado !== "jugando" || !cursor) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== "z" && tecla !== "x") return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      disparar(cursor.x, cursor.y);
    });
    window.addEventListener("resize", ajustarTamano);

    ajustarTamano();
    requestAnimationFrame(cuadro);

    return {
      iniciar,
      estado: () => estado,
      ajustarTamano,
      marcador: () => ({ puntaje, puntajeRival, tiempo, duracion })
    };
  }

  window.crearArqueria = crearArqueria;
})();
