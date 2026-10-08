/* Arquería contra un rival simulado. Mismo esquema que el juego de Hooey: un
   campo de tamaño lógico fijo (960x600) que solo se escala al dibujar, así el
   zoom o el tamaño de la ventana no cambian la dificultad. Los blancos caen,
   se les dispara con clic (o con las teclas Z / X sobre el cursor) y puntúa lo
   cerca que quede el tiro del centro. A un lado corre el puntaje del rival.
   Lo usan arqueria.html (Hornet, Garra y Cassius, y partidas contra otros jugadores) y
   Muerte Súbita (Verdam). */
(function () {
  const LOGICO_ANCHO = 960;
  const LOGICO_ALTO = 600;

  // dist = [centro, interior, exterior] de los tiros que aciertan; ritmo
  // sale de intervalo * precisión * promedio de anillo (Hornet ~300, Garra ~440, Cassius ~540, Verdam ~620 en 60 s)
  const RIVALES = {
    hornet: {
      nombre: "Hornet", color: "#b48ad9",
      intervalo: 1.0, precision: 0.75, dist: [0.25, 0.40, 0.35],
      radio: 46, velocidadBase: 110, zigzag: false
    },
    cassius: {
      nombre: "Cassius", color: "#d9a441",
      intervalo: 0.8, precision: 0.9, dist: [0.48, 0.37, 0.15],
      radio: 40, velocidadBase: 135, zigzag: true
    },
    garra: {
      nombre: "Garra", color: "#d9794f",
      intervalo: 0.85, precision: 0.84, dist: [0.38, 0.37, 0.25],
      radio: 42, velocidadBase: 125, zigzag: false
    },
    verdam: {
      nombre: "Verdam", color: "#8fd06a",
      intervalo: 0.75, precision: 0.93, dist: [0.55, 0.33, 0.12],
      radio: 38, velocidadBase: 140, zigzag: true
    }
  };
  const PUNTOS_ANILLO = [10, 7, 4];
  // Lo que se lee en la pantalla previa al disparo (antes estaba en una fila de fichas bajo el campo)
  const REGLAS = ["Un minuto. Gana quien sume más puntos.", "Centro 10, anillo medio 7 y borde 4.", "Dispara con clic, o con Z / X sobre el blanco."];

  // Generador con semilla: los dos jugadores de una partida ven los mismos blancos.
  function generadorConSemilla(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* resolucionMax: tope de píxeles por píxel CSS del lienzo. En pantallas de alta densidad
     (2x o más) dibujar a resolución completa cuesta el doble o el triple de relleno por
     cuadro y casi no se nota; el combate con Verdam lo baja más porque va sobre capas
     con filtros. */
  function crearArqueria({ canvas, rival: claveRival, duracion = 60, pantallas = true, fondo = false, resolucionMax = 1.25, onEstado, onFin, onPuntaje }) {
    let cfg = RIVALES[claveRival] || RIVALES.hornet;
    const ancho = LOGICO_ANCHO;
    const alto = LOGICO_ALTO;
    // Con "fondo" el lienzo dibuja su propio paisaje (js/arqueria-visual.js) y es opaco, que se compone más barato.
    // Sin él (Muerte Súbita) se queda transparente sobre el fondo de su página.
    const visual = fondo && window.ArqueriaVisual ? window.ArqueriaVisual.crear({ ancho, alto }) : null;
    const ctx = canvas.getContext("2d", visual ? { alpha: false } : undefined);

    let nombreJugador = "Tú"; // se cambia por el nombre de usuario cuando hay sesión
    let vs = false; // partida contra otro jugador: el puntaje del rival llega de fuera
    let textoFin = null;
    let azar = Math.random; // con semilla en las partidas contra otro jugador
    let sucio = true; // fuera de la partida solo se vuelve a dibujar cuando algo cambió
    let relojVisual = 0; // segundos que lleva la página abierta: anima nubes, aves y luciérnagas
    let faseVisual = 0; // 0 = hora dorada, 1 = noche; sigue al minuto de juego con suavidad
    let ultimoDibujo = 0;
    let sacudida = 0;
    let cursorActual = "";
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
    let mouse = false; // la mira solo se dibuja con ratón; en táctil taparía el dedo

    let lastW = 0;
    function ajustarTamano() {
      const dpr = Math.min(window.devicePixelRatio || 1, resolucionMax);
      const caja = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(caja.width * dpr));
      canvas.height = Math.max(1, Math.round(caja.height * dpr));
      ctx.setTransform(canvas.width / ancho, 0, 0, canvas.height / alto, 0, 0);
      if (visual) visual.redimensionar(canvas.width, canvas.height);
      sucio = true;
      cajaMedida = null;
    }

    /* Medir el lienzo obliga al navegador a recalcular la página; con un ratón que manda más de
       500 movimientos por segundo eso pesa. Se mide solo al cambiar de tamaño o al desplazar. */
    let cajaMedida = null;
    const medirCaja = () => { cajaMedida = null; };
    window.addEventListener("scroll", medirCaja, { passive: true });
    function posicion(e) {
      const r = cajaMedida || (cajaMedida = canvas.getBoundingClientRect());
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
      const x0 = r + azar() * (ancho - r * 2);
      return {
        x0, x: x0, y: -r, r, t: 0,
        amp: cfg.zigzag ? 18 + azar() * 40 : 0,
        frec: 1.2 + azar() * 1.6,
        vel: 0.92 + azar() * 0.2
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
        if (onPuntaje) onPuntaje(puntaje);
        efectos.push({ tipo: "texto", x: b.x, y: b.y, texto: anillo === 0 && visual ? `¡CENTRO! +${pts}` : `+${pts}`, grande: anillo === 0, edad: 0, vida: 0.7, color: anillo === 0 ? "#ffd84a" : "#e8e4d0" });
        if (visual) {
          efectos.push({ tipo: "estela", x0: ancho / 2, y0: alto + 14, x: b.x, y: b.y, edad: 0, vida: 0.14 });
          efectos.push({ tipo: "anillo", x: b.x, y: b.y, r0: b.r * 0.4, r1: b.r * (anillo === 0 ? 2.1 : 1.5), color: anillo === 0 ? "#ffe27a" : "#f4ecd2", edad: 0, vida: anillo === 0 ? 0.5 : 0.35 });
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = 80 + Math.random() * 150;
            efectos.push({ tipo: "pedazo", x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, rot: Math.random() * 6, giro: (Math.random() - 0.5) * 18, l: 7 + Math.random() * 7, color: ["#e8e4d0", "#c0392b", "#e8e4d0", "#f1c40f"][k % 4], edad: 0, vida: 0.7 });
          }
          if (anillo === 0) sacudida = 0.16;
        }
        for (let k = 0; k < 7; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 70 + Math.random() * 130;
          efectos.push({ tipo: "chispa", x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, edad: 0, vida: 0.5, color: anillo === 0 ? "#f1c40f" : "#c0392b" });
        }
        blancos.splice(i, 1);
        return;
      }
      if (visual) {
        efectos.push({ tipo: "estela", x0: ancho / 2, y0: alto + 14, x, y, edad: 0, vida: 0.12 });
        efectos.push({ tipo: "polvo", x, y, fase: Math.random() * 6, edad: 0, vida: 0.5 });
      }
    }

    function tiroDelRival() {
      if (Math.random() > cfg.precision) return;
      const r = Math.random();
      const anillo = r < cfg.dist[0] ? 0 : r < cfg.dist[0] + cfg.dist[1] ? 1 : 2;
      puntajeRival += PUNTOS_ANILLO[anillo];
      destelloRival = 0.45;
      if (visual) efectos.push({ tipo: "texto", x: ancho - 120, y: 122, texto: `+${PUNTOS_ANILLO[anillo]}`, chico: true, edad: 0, vida: 0.7, color: cfg.color });
    }

    function cambiarEstado(nuevo) {
      estado = nuevo;
      sucio = true;
      if (onEstado) onEstado(nuevo);
    }

    function iniciar() {
      if (!vs) azar = Math.random;
      textoFin = null;
      tiempo = 0; puntaje = 0; puntajeRival = 0; blancos = [nuevoBlanco()]; efectos = [];
      temporizadorBlanco = intervaloBlanco(); temporizadorRival = cfg.intervalo; destelloRival = 0; resultado = "";
      cambiarEstado("jugando");
    }

    function terminar() {
      resultado = vs ? "" : puntaje > puntajeRival ? "ganado" : puntaje < puntajeRival ? "perdido" : "empate";
      cambiarEstado("fin");
      if (onFin) onFin({ puntaje, puntajeRival, resultado, vs });
    }

    /* Rendirse en una partida contra un rival de la casa: termina ya, cuenta como derrota y lo avisa en onFin
       con rendicion: true. Devuelve false si no hay partida en marcha o es contra otro jugador (ahí rinde el servidor). */
    function rendirse() {
      if (estado !== "jugando" || vs) return false;
      resultado = "perdido";
      textoFin = { titulo: "Te rendiste", sub: `${puntaje} a ${puntajeRival}` };
      cambiarEstado("fin");
      if (onFin) onFin({ puntaje, puntajeRival, resultado, vs, rendicion: true });
      return true;
    }

    function actualizar(dt) {
      if (estado === "jugando") {
        tiempo += dt;
        temporizadorBlanco -= dt;
        if (temporizadorBlanco <= 0) { blancos.push(nuevoBlanco()); temporizadorBlanco = intervaloBlanco(); }
        temporizadorRival -= dt;
        if (!vs) while (temporizadorRival <= 0) { tiroDelRival(); temporizadorRival += cfg.intervalo; }
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
        if (e.tipo === "chispa" || e.tipo === "pedazo") { e.vy += (e.tipo === "pedazo" ? 620 : 380) * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        else if (e.tipo === "texto") e.y -= 40 * dt;
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
      ctx.fillText(`${nombreJugador} ${puntaje}`, 22, 40);
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

    function dibujarMira(x, y) {
      ctx.save();
      ctx.lineCap = "round";
      for (const [color, ancho] of [["rgba(0,0,0,.6)", 5], ["#ffe08a", 2.5]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = ancho;
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        // cuatro marcas que salen del aro
        ctx.moveTo(x - 27, y); ctx.lineTo(x - 9, y);
        ctx.moveTo(x + 9, y); ctx.lineTo(x + 27, y);
        ctx.moveTo(x, y - 27); ctx.lineTo(x, y - 9);
        ctx.moveTo(x, y + 9); ctx.lineTo(x, y + 27);
        ctx.stroke();
      }
      ctx.fillStyle = "#ff6b5a";
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function dibujarConPaisaje() {
      ctx.save();
      if (sacudida > 0) ctx.translate((Math.random() - 0.5) * 5 * (sacudida / 0.16), (Math.random() - 0.5) * 5 * (sacudida / 0.16));
      visual.fondo(ctx, { t: relojVisual, fase: faseVisual });
      if (estado !== "fin") for (const b of blancos) dibujarBlanco(b);
      for (const e of efectos) visual.efecto(ctx, e);
      ctx.restore();
      if (estado !== "listo") {
        visual.hud(ctx, {
          nombre: nombreJugador, puntaje, nombreRival: cfg.nombre, colorRival: cfg.color, puntajeRival,
          destelloRival, tiempo, duracion, reloj: relojVisual
        });
      }
      if (estado === "jugando" && cursor && mouse) dibujarMira(cursor.x, cursor.y);
      if (pantallas && estado !== "jugando") {
        const titulo = estado === "listo" ? `${nombreJugador} contra ${cfg.nombre}`
          : textoFin && textoFin.titulo ? textoFin.titulo
          : vs ? "Tiempo"
          : resultado === "ganado" ? "Ganaste" : resultado === "perdido" ? "Perdiste" : "Empate";
        const sub = estado === "fin" ? (textoFin && textoFin.sub ? textoFin.sub : `${puntaje} a ${puntajeRival}`) : "";
        visual.pantalla(ctx, { titulo, sub, reglas: estado === "listo" ? REGLAS : null, escala: (canvas.clientWidth || ancho) / ancho });
      }
    }

    function dibujar() {
      if (visual) { dibujarConPaisaje(); return; }
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
      if (estado === "jugando" && cursor && mouse) dibujarMira(cursor.x, cursor.y);
      if (pantallas && estado !== "jugando") {
        ctx.fillStyle = "rgba(0,0,0,.5)";
        ctx.fillRect(0, 0, ancho, alto);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8e4d0";
        ctx.font = "600 52px sans-serif";
        const titulo = estado === "listo" ? `${nombreJugador} contra ${cfg.nombre}`
          : textoFin && textoFin.titulo ? textoFin.titulo
          : vs ? "Tiempo"
          : resultado === "ganado" ? "Ganaste" : resultado === "perdido" ? "Perdiste" : "Empate";
        ctx.fillText(titulo, ancho / 2, alto * 0.28);
        if (estado === "fin") {
          ctx.font = "30px sans-serif";
          ctx.fillStyle = "#b9b5a2";
          ctx.fillText(textoFin && textoFin.sub ? textoFin.sub : `${puntaje} a ${puntajeRival}`, ancho / 2, alto * 0.36);
        }
      }
    }

    function cuadro(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
      ultimo = t;
      actualizar(dt);
      if (visual) {
        relojVisual += dt;
        if (sacudida > 0) sacudida = Math.max(0, sacudida - dt);
        const objetivo = estado === "jugando" ? tiempo / duracion : estado === "fin" ? 1 : 0;
        faseVisual += (objetivo - faseVisual) * Math.min(1, dt * (estado === "jugando" ? 6 : 1.2));
      }
      // Con paisaje, fuera de la partida se redibuja a unos 25 cuadros por segundo para que el cielo siga vivo sin gastar de más
      if (estado === "jugando" || efectos.length || sucio || (visual && t - ultimoDibujo >= 40)) { dibujar(); sucio = false; ultimoDibujo = t; }
      const forma = estado === "jugando" && mouse ? "none" : "";
      if (forma !== cursorActual) { canvas.style.cursor = forma; cursorActual = forma; }
      requestAnimationFrame(cuadro);
    }

    canvas.addEventListener("pointerenter", medirCaja);
    canvas.addEventListener("pointerdown", e => {
      if (estado !== "jugando") return;
      cajaMedida = null; // un disparo siempre con la medida al día
      const p = posicion(e);
      disparar(p.x, p.y);
    });
    canvas.addEventListener("pointermove", e => { cursor = posicion(e); mouse = e.pointerType === "mouse"; });
    canvas.addEventListener("pointerleave", () => { cursor = null; });
    document.addEventListener("keydown", e => {
      if (e.repeat || estado !== "jugando" || !cursor) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== "z" && tecla !== "x") return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      disparar(cursor.x, cursor.y);
    });
    window.addEventListener("resize", ajustarTamano);
    // El lienzo también cambia de tamaño sin que la ventana cambie (la fuente o el tema cargan tarde)
    if (window.ResizeObserver) new ResizeObserver(() => { const c = canvas.getBoundingClientRect(); if (Math.round(c.width * 100) !== lastW) { lastW = Math.round(c.width * 100); ajustarTamano(); } }).observe(canvas);

    ajustarTamano();
    requestAnimationFrame(cuadro);

    /* Cambia de rival entre partidas (no mientras se juega). */
    function cambiarRival(clave) {
      if (estado === "jugando" || !RIVALES[clave]) return;
      cfg = RIVALES[clave];
      vs = false;
      azar = Math.random;
      cambiarEstado("listo");
    }

    /* Partida contra otro jugador: se deja el campo listo (con su rival y su
       semilla) y se arranca con iniciar() cuando termina la cuenta atrás. */
    function prepararVs({ nombre, color, semilla }) {
      if (estado === "jugando") return;
      cfg = { nombre, color, intervalo: 99, precision: 0, dist: [0.3, 0.4, 0.3], radio: 40, velocidadBase: 125, zigzag: true };
      vs = true;
      azar = generadorConSemilla(semilla);
      textoFin = null;
      puntaje = 0; puntajeRival = 0;
      cambiarEstado("listo");
    }

    function setNombreJugador(n) {
      const limpio = String(n || "").trim().slice(0, 16);
      if (limpio) { nombreJugador = limpio; sucio = true; }
    }

    function setPuntajeRival(n) {
      if (n > puntajeRival) destelloRival = 0.35;
      puntajeRival = n;
      sucio = true;
    }

    function setFin(texto) {
      textoFin = texto;
      sucio = true;
      if (estado === "listo") cambiarEstado("fin");
    }

    return {
      iniciar,
      rendirse,
      cambiarRival,
      prepararVs,
      setNombreJugador,
      setPuntajeRival,
      setFin,
      estado: () => estado,
      ajustarTamano,
      marcador: () => ({ puntaje, puntajeRival, tiempo, duracion })
    };
  }

  window.crearArqueria = crearArqueria;
})();
