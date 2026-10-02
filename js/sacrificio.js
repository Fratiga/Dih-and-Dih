(function () {
  const canvas = document.getElementById("sacrificioCampo");
  const estadoEl = document.getElementById("sacrificioEstado");
  const cuentaEl = document.getElementById("sacrificioCuenta");
  const botonJugar = document.getElementById("sacrificioJugar");
  const rankTotalEl = document.getElementById("sacrificioRankTotal");
  const rankRachaEl = document.getElementById("sacrificioRankRacha");
  const ctx = canvas.getContext("2d");

  const CLAVE_TOTAL = "compendioHooeyTotal";
  const CLAVE_RECORD = "compendioHooeyRecord";
  const ANCHO_SPRITE = 100;
  const VELOCIDAD_BASE = 118;
  const VELOCIDAD_POR_RACHA = 7;
  const VELOCIDAD_MAX = 560;

  const medidorEl = document.getElementById("sacrificioMedidor");
  const fuegoEl = document.getElementById("sacrificioFuego");
  const fuegoCtx = fuegoEl.getContext("2d");
  const hojaFuego = new Image();
  const FUEGO = { cols: 9, total: 54, w: 384, h: 216 };
  let fuegoPos = 0;

  function velocidadFuego() {
    // Cuadros por segundo del fuego: arranca en cámara muy lenta en la racha
    // 20 y se acelera con cada punto más, hasta acercarse al ritmo normal.
    return Math.min(26, 2.5 + Math.max(0, racha - RACHA_FUEGO) * 0.55);
  }

  function dibujarFuego(dt) {
    if (fase !== "jugando" || racha < RACHA_FUEGO || !hojaFuego.complete || !hojaFuego.naturalWidth) {
      fuegoCtx.clearRect(0, 0, FUEGO.w, FUEGO.h);
      return;
    }
    fuegoPos = (fuegoPos + velocidadFuego() * dt) % FUEGO.total;
    const i = Math.floor(fuegoPos);
    const frac = fuegoPos - i;
    const siguiente = (i + 1) % FUEGO.total;
    fuegoCtx.clearRect(0, 0, FUEGO.w, FUEGO.h);
    // Mezcla de dos cuadros vecinos para que la cámara lenta se vea fluida
    fuegoCtx.globalAlpha = 1;
    fuegoCtx.drawImage(hojaFuego, (i % FUEGO.cols) * FUEGO.w, Math.floor(i / FUEGO.cols) * FUEGO.h, FUEGO.w, FUEGO.h, 0, 0, FUEGO.w, FUEGO.h);
    fuegoCtx.globalAlpha = frac;
    fuegoCtx.drawImage(hojaFuego, (siguiente % FUEGO.cols) * FUEGO.w, Math.floor(siguiente / FUEGO.cols) * FUEGO.h, FUEGO.w, FUEGO.h, 0, 0, FUEGO.w, FUEGO.h);
    fuegoCtx.globalAlpha = 1;
  }

  // Efectos que se acumulan con la racha: fuego desde la 20 (cada 7 más se
  // vuelve menos transparente) y un bufón nuevo desde la 48, uno más cada 10.
  const RACHA_FUEGO = 20;
  const PASO_FUEGO = 7;
  const RACHA_BUFON = 48;
  const PASO_BUFON = 10;
  let bufonesActuales = 0;

  const musica = new Audio(encodeURI("assets/cosas/Mata al moco.mp3"));
  musica.loop = true;
  musica.volume = 0.6;

  const imagen = new Image();
  imagen.src = "assets/cosas/slime-bruja.png";

  function leerNumero(clave) {
    try { return parseInt(localStorage.getItem(clave), 10) || 0; } catch (e) { return 0; }
  }
  function guardarNumero(clave, valor) {
    try { localStorage.setItem(clave, String(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  let totalLocal = leerNumero(CLAVE_TOTAL);
  let recordLocal = leerNumero(CLAVE_RECORD);

  let fase = "listo"; // listo | jugando | fin
  let racha = 0;
  let hooeys = [];
  let particulas = [];
  let temporizadorAparicion = 0;
  let ancho = 0;
  let alto = 0;
  let ultimo = 0;
  let sesion = null;
  let miNombre = "";
  // Con sesión, estos números vienen de la cuenta en Supabase. Sin sesión
  // son los locales de este navegador, que no entran al ranking.
  let datosCuenta = { total: 0, mejor: 0 };
  let totalGlobal = null; // suma de todas las cuentas en el ranking; null = no disponible

  function velocidadActual() {
    return Math.min(VELOCIDAD_MAX, VELOCIDAD_BASE + racha * VELOCIDAD_POR_RACHA);
  }

  function intervaloAparicion() {
    return Math.max(0.4, 1.3 - racha * 0.012);
  }

  function dimensiones() {
    const w = Math.min(ANCHO_SPRITE, ancho * 0.22);
    const ratio = imagen.naturalHeight && imagen.naturalWidth ? imagen.naturalHeight / imagen.naturalWidth : 0.74;
    return { w, h: w * ratio };
  }

  function ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    ancho = canvas.clientWidth;
    alto = canvas.clientHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function nuevoHooey() {
    const { w, h } = dimensiones();
    return {
      x: Math.random() * Math.max(1, ancho - w),
      y: -h,
      variacion: 0.9 + Math.random() * 0.25,
      fase: Math.random() * Math.PI * 2
    };
  }

  function textoEstado() {
    if (fase === "listo") return "Pulsa play. Sacrifica a cada Hooey antes de que toque el piso. Con tableta o ratón puedes apuntar y usar las teclas Z o X.";
    if (fase === "jugando") return `Racha: ${racha} · Velocidad ×${(velocidadActual() / VELOCIDAD_BASE).toFixed(1)}`;
    return `Un Hooey tocó el piso. Tu racha fue de ${racha}.`;
  }

  function textoCuenta() {
    if (sesion) {
      return `Cuenta: ${miNombre || "sin nombre"} · Hooeys sacrificados: ${datosCuenta.total} · Mejor racha: ${datosCuenta.mejor}. Tus puntos se guardan en tu cuenta.`;
    }
    return `Sin cuenta: llevas ${totalLocal} sacrificados (mejor racha ${recordLocal}) solo en este navegador. Inicia sesión (arriba a la derecha) para que tus puntos queden en tu cuenta y entren al ranking.`;
  }

  function pintarMedidor() {
    if (totalGlobal === null) { medidorEl.textContent = "—"; return; }
    // Lo de la partida en curso todavía no está en el servidor: con cuenta se
    // suma al vuelo para que el medidor suba con cada Hooey.
    const enCurso = sesion && fase === "jugando" ? racha : 0;
    medidorEl.textContent = (totalGlobal + enCurso).toLocaleString("es");
  }

  function actualizarEfectos() {
    const jugando = fase === "jugando";
    const opacidad = jugando && racha >= RACHA_FUEGO
      ? Math.min(1, 0.03 + 0.1 * Math.floor((racha - RACHA_FUEGO) / PASO_FUEGO))
      : 0;
    fuegoEl.style.opacity = String(opacidad);

    const bufones = jugando && racha >= RACHA_BUFON ? 1 + Math.floor((racha - RACHA_BUFON) / PASO_BUFON) : 0;
    if (bufones !== bufonesActuales) {
      bufonesActuales = bufones;
      if (window.SacrificioBufones) window.SacrificioBufones.sincronizar(bufones);
    }
  }

  function refrescarTextos() {
    actualizarEfectos();
    pintarMedidor();
    estadoEl.textContent = textoEstado();
    cuentaEl.textContent = textoCuenta();
    botonJugar.classList.toggle("hidden", fase === "jugando");
    botonJugar.setAttribute("aria-label", fase === "fin" ? "Jugar de nuevo" : "Jugar");
  }

  function empezar() {
    racha = 0;
    if (typeof audio !== "undefined" && audio && !audio.paused) audio.pause();
    if (window.SacrificioBufones) window.SacrificioBufones.precargar();
    if (!hojaFuego.src) hojaFuego.src = "assets/cosas/fuego-hoja.webp";
    musica.currentTime = 0;
    musica.play().catch(() => { /* el navegador bloqueó el audio */ });
    hooeys = [nuevoHooey()];
    particulas = [];
    temporizadorAparicion = intervaloAparicion();
    fase = "jugando";
    refrescarTextos();
  }

  function terminar() {
    fase = "fin";
    musica.pause();
    if (!sesion && racha > recordLocal) {
      recordLocal = racha;
      guardarNumero(CLAVE_RECORD, recordLocal);
    }
    refrescarTextos();
    enviarPartida(racha);
  }

  async function enviarPartida(valor) {
    if (!sesion || valor <= 0) return;
    try {
      const supabase = await fichasCliente();
      const { error } = await supabase.rpc("hooey_registrar_partida", { p_racha: valor });
      if (error) throw error;
      datosCuenta.mejor = Math.max(datosCuenta.mejor, valor);
      if (totalGlobal !== null) totalGlobal += valor;
      refrescarTextos();
      cargarRankings();
    } catch (e) {
      cuentaEl.textContent = `${textoCuenta()} No se pudo guardar esta partida en tu cuenta.`;
    }
  }

  function sacrificar(indice) {
    const { w, h } = dimensiones();
    const m = hooeys[indice];
    const cx = m.x + w / 2;
    const cy = m.y + h / 2;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      particulas.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        vida: 0.6 + Math.random() * 0.5, edad: 0,
        tam: 3 + Math.floor(Math.random() * 4),
        color: Math.random() < 0.5 ? "#4f9a3a" : "#7fc45a"
      });
    }
    hooeys.splice(indice, 1);
    racha += 1;
    if (sesion) {
      datosCuenta.total += 1;
    } else {
      totalLocal += 1;
      guardarNumero(CLAVE_TOTAL, totalLocal);
    }
    refrescarTextos();
  }

  function indiceBajo(x, y) {
    const { w, h } = dimensiones();
    for (let i = hooeys.length - 1; i >= 0; i--) {
      const m = hooeys[i];
      if (x >= m.x && x <= m.x + w && y >= m.y && y <= m.y + h) return i;
    }
    return -1;
  }

  function posicion(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("pointerdown", e => {
    if (fase !== "jugando") return;
    const p = posicion(e);
    const i = indiceBajo(p.x, p.y);
    if (i >= 0) sacrificar(i);
  });

  // Teclas Z y X: sacrifican al Hooey que esté bajo el cursor, para jugar con
  // tableta al estilo osu! (el lápiz apunta, las teclas "clickean").
  let cursor = null;
  canvas.addEventListener("pointermove", e => { cursor = posicion(e); });
  canvas.addEventListener("pointerleave", () => { cursor = null; });

  document.addEventListener("keydown", e => {
    if (e.repeat || fase !== "jugando" || !cursor) return;
    const tecla = e.key.toLowerCase();
    if (tecla !== "z" && tecla !== "x") return;
    const destino = e.target;
    if (destino && /^(input|textarea|select)$/i.test(destino.tagName)) return;
    const i = indiceBajo(cursor.x, cursor.y);
    if (i >= 0) sacrificar(i);
  });

  canvas.addEventListener("mousemove", e => {
    const p = posicion(e);
    canvas.style.cursor = fase === "jugando" && indiceBajo(p.x, p.y) >= 0 ? "pointer" : "default";
  });

  canvas.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (fase !== "jugando") { empezar(); return; }
    if (hooeys.length) sacrificar(0);
  });

  botonJugar.addEventListener("click", empezar);

  function actualizar(dt) {
    const { h } = dimensiones();
    if (fase === "jugando") {
      const v = velocidadActual();
      temporizadorAparicion -= dt;
      if (temporizadorAparicion <= 0) {
        hooeys.push(nuevoHooey());
        temporizadorAparicion = intervaloAparicion();
      }
      for (const m of hooeys) {
        m.y += v * m.variacion * dt;
        m.fase += dt * 4;
        if (m.y + h >= alto) {
          m.y = alto - h;
          terminar();
          break;
        }
      }
    }
    for (const p of particulas) {
      p.edad += dt;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particulas = particulas.filter(p => p.edad < p.vida);
  }

  function dibujar() {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(0, alto - 3, ancho, 3);

    const { w, h } = dimensiones();
    for (const m of hooeys) {
      const gelatina = 1 + Math.sin(m.fase) * 0.035;
      const dw = w / gelatina;
      const dh = h * gelatina;
      ctx.drawImage(imagen, m.x + (w - dw) / 2, m.y + (h - dh), dw, dh);
    }
    for (const p of particulas) {
      ctx.globalAlpha = Math.max(0, 1 - p.edad / p.vida);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    ctx.globalAlpha = 1;

    if (fase !== "jugando") {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.fillStyle = "#e8e4d0";
      ctx.textAlign = "center";
      ctx.font = "600 24px sans-serif";
      ctx.fillText(fase === "fin" ? `Racha: ${racha}` : "Hooey", ancho / 2, alto / 2 - 70);
      if (fase === "fin") {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#b9b5a2";
        ctx.fillText("Un Hooey tocó el piso", ancho / 2, alto / 2 - 46);
      }
    }
  }

  function cuadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
    ultimo = t;
    actualizar(dt);
    dibujar();
    dibujarFuego(dt);
    requestAnimationFrame(cuadro);
  }

  window.addEventListener("resize", ajustarTamano);
  window.addEventListener("pagehide", () => musica.pause());

  /* --- Ranking global (Supabase). Requiere scratchpad/hooey_ranking.sql --- */
  function pintarLista(el, filas, campo) {
    if (!filas.length) {
      el.innerHTML = `<li class="sacrificio-vacio">Todavía no hay nadie en el ranking.</li>`;
      return;
    }
    el.innerHTML = filas.map(f => `
      <li class="${f.username === miNombre ? "yo" : ""}">
        <span>${escapar(f.username)}</span><strong>${f[campo]}</strong>
      </li>`).join("");
  }

  function escapar(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function cargarRankings() {
    try {
      const supabase = await fichasCliente();
      const [porTotal, porRacha] = await Promise.all([
        supabase.from("hooey_puntajes").select("username, total").order("total", { ascending: false }).limit(10),
        supabase.from("hooey_puntajes").select("username, mejor_racha").order("mejor_racha", { ascending: false }).limit(10)
      ]);
      if (porTotal.error) throw porTotal.error;
      if (porRacha.error) throw porRacha.error;
      const todos = await supabase.from("hooey_puntajes").select("total");
      if (!todos.error) {
        totalGlobal = (todos.data || []).reduce((suma, f) => suma + Number(f.total || 0), 0);
        pintarMedidor();
      }
      pintarLista(rankTotalEl, porTotal.data.filter(f => f.total > 0), "total");
      pintarLista(rankRachaEl, porRacha.data.filter(f => f.mejor_racha > 0), "mejor_racha");
    } catch (e) {
      const aviso = `<li class="sacrificio-vacio">El ranking no está disponible por ahora.</li>`;
      rankTotalEl.innerHTML = aviso;
      rankRachaEl.innerHTML = aviso;
    }
  }

  async function iniciarSesion() {
    try {
      sesion = await fichasSesionActual();
      if (sesion) {
        const supabase = await fichasCliente();
        const { data } = await supabase.from("perfiles").select("username").eq("user_id", sesion.user.id).maybeSingle();
        miNombre = (data && data.username) || (typeof nombreUsuario === "function" ? nombreUsuario() : "");
        const { data: fila } = await supabase.from("hooey_puntajes").select("total, mejor_racha").eq("user_id", sesion.user.id).maybeSingle();
        datosCuenta = { total: Number(fila && fila.total) || 0, mejor: Number(fila && fila.mejor_racha) || 0 };
      }
    } catch (e) {
      sesion = null;
    }
    refrescarTextos();
    cargarRankings();
  }

  ajustarTamano();
  refrescarTextos();
  requestAnimationFrame(cuadro);
  iniciarSesion();
})();
