(function () {
  const canvas = document.getElementById("sacrificioCampo");
  const estadoEl = document.getElementById("sacrificioEstado");
  const cuentaEl = document.getElementById("sacrificioCuenta");
  const botonJugar = document.getElementById("sacrificioJugar");
  const rankTotalEl = document.getElementById("sacrificioRankTotal");
  const rankRachaEl = document.getElementById("sacrificioRankRacha");
  const ctx = canvas.getContext("2d");

  const CLAVE_TOTAL = "compendioHooeyTotal";
  const SLAPPY = { username: "Slappy", total: 999, mejor_racha: 200 };
  const CLAVE_RECORD = "compendioHooeyRecord";
  const ANCHO_SPRITE = 100;
  const LOGICO_ANCHO = 960;
  const LOGICO_ALTO = 600;
  const VELOCIDAD_BASE = 94;
  const VELOCIDAD_POR_RACHA = 8;
  const VELOCIDAD_MAX = 560;
  const VELOCIDAD_OLEADA = 264; // las oleadas caen siempre a esta velocidad, sin importar la racha

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

  // Los 54 cuadros se recortan de la hoja y se dejan decodificados antes de
  // que haga falta: dibujar directo desde la hoja de 3456x1296 obligaba al
  // navegador a decodificarla en pleno juego, y de ahí venía el tirón.
  let cuadrosFuego = [];
  let preparandoFuego = false;

  function pausa() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  async function prepararFuego() {
    if (preparandoFuego || cuadrosFuego.length === FUEGO.total) return;
    preparandoFuego = true;
    try {
      if (!hojaFuego.src) hojaFuego.src = "assets/cosas/fuego-hoja.webp";
      await hojaFuego.decode();
      // Cada cuadro va a su propio lienzo chico, copiado de la hoja ya
      // decodificada: es rápido y después dibujarlo no cuesta casi nada.
      const cuadros = [];
      for (let i = 0; i < FUEGO.total; i++) {
        const lienzo = document.createElement("canvas");
        lienzo.width = FUEGO.w;
        lienzo.height = FUEGO.h;
        lienzo.getContext("2d").drawImage(hojaFuego, (i % FUEGO.cols) * FUEGO.w, Math.floor(i / FUEGO.cols) * FUEGO.h, FUEGO.w, FUEGO.h, 0, 0, FUEGO.w, FUEGO.h);
        cuadros.push(lienzo);
        if (i % 6 === 5) await pausa();
      }
      cuadrosFuego = cuadros;
    } catch (e) {
      preparandoFuego = false;
    }
  }

  function dibujarFuego(dt) {
    if (fase !== "jugando" || racha < RACHA_FUEGO || cuadrosFuego.length !== FUEGO.total) {
      fuegoCtx.clearRect(0, 0, FUEGO.w, FUEGO.h);
      return;
    }
    fuegoPos = (fuegoPos + velocidadFuego() * dt) % FUEGO.total;
    const i = Math.floor(fuegoPos);
    const frac = fuegoPos - i;
    fuegoCtx.clearRect(0, 0, FUEGO.w, FUEGO.h);
    // Mezcla de dos cuadros vecinos para que la cámara lenta se vea fluida
    fuegoCtx.globalAlpha = 1;
    fuegoCtx.drawImage(cuadrosFuego[i], 0, 0);
    fuegoCtx.globalAlpha = frac;
    fuegoCtx.drawImage(cuadrosFuego[(i + 1) % FUEGO.total], 0, 0);
    fuegoCtx.globalAlpha = 1;
  }

  // Efectos que se acumulan con la racha: fuego desde la 20 (cada 7 más se
  // vuelve menos transparente) y un bufón nuevo desde la 29, uno más cada 10.
  const RACHA_FUEGO = 20;
  const PASO_FUEGO = 7;
  const RACHA_BUFON = 31;
  const PASO_BUFON = 6;
  const RACHA_TPOSE = 100; // Slappy gigante en T-pose sobre los banners
  // Dificultad por tramos de racha: encogen, impostores, zigzag, oleadas y
  // blindados, además de algunos Hooeys más rápidos que el resto.
  const RACHA_RAPIDOS = 25;
  const RACHA_ENCOGE = 30;
  const RACHA_DECOY = 35;
  const RACHA_ZIGZAG = 40;
  const RACHA_OLEADA = 50;
  const RACHA_BLINDADO = 60;
  let bufonesActuales = 0;
  let tposeActual = false;
  let cierreVisible = true; // tras perder, espera a que el Hooey termine de caer fuera del cuadro
  let tiempoCaida = 0;

  const CANCIONES = {
    mata: "assets/cosas/Mata al moco.mp3",
    badapple: "assets/cosas/Bad Apple.mp3"
  };
  const CLAVE_CANCION = "hooeyCancion";
  let cancion = "mata";
  try { const g = localStorage.getItem(CLAVE_CANCION); if (CANCIONES[g]) cancion = g; } catch (e) { /* sin almacenamiento */ }
  const musica = new Audio(encodeURI(CANCIONES[cancion]));
  musica.loop = true;
  musica.volume = 0.6;
  const cancionEl = document.getElementById("sacrificioCancion");
  if (cancionEl) {
    cancionEl.value = cancion;
    cancionEl.addEventListener("change", () => {
      cancion = CANCIONES[cancionEl.value] ? cancionEl.value : "mata";
      try { localStorage.setItem(CLAVE_CANCION, cancion); } catch (e) { /* sin almacenamiento */ }
      const sonaba = !musica.paused;
      musica.src = encodeURI(CANCIONES[cancion]);
      musica.currentTime = 0;
      if (sonaba) musica.play().catch(() => {});
      cancionEl.blur(); // que Z / X sigan siendo del juego
    });
  }

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
  let motivoFin = "piso"; // piso | decoy
  let racha = 0;
  let hooeys = [];
  let particulas = [];
  let temporizadorAparicion = 0;
  let oleadaPendiente = false;
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

  function dimensiones(escala = 1) {
    const w = ANCHO_SPRITE * escala;
    const ratio = imagen.naturalHeight && imagen.naturalWidth ? imagen.naturalHeight / imagen.naturalWidth : 0.74;
    return { w, h: w * ratio };
  }

  function escalaPorRacha() {
    return racha < RACHA_ENCOGE ? 1 : Math.max(0.6, 1 - 0.4 * (racha - RACHA_ENCOGE) / 60);
  }

  function tipoNuevo() {
    if (racha >= RACHA_BLINDADO && Math.random() < Math.min(0.3, 0.12 + (racha - RACHA_BLINDADO) * 0.005)) return "blindado";
    if (racha >= RACHA_DECOY && Math.random() < Math.min(0.22, 0.08 + (racha - RACHA_DECOY) * 0.003)) return "decoy";
    return "normal";
  }

  // Versión del sprite teñida de rojo para los impostores
  let imagenDecoy = null;
  function prepararVariantes() {
    if (!imagen.naturalWidth || imagenDecoy) return;
    const c = document.createElement("canvas");
    c.width = imagen.naturalWidth;
    c.height = imagen.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(imagen, 0, 0);
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = "rgba(225, 45, 45, 0.55)";
    x.fillRect(0, 0, c.width, c.height);
    imagenDecoy = c;
  }
  if (imagen.complete) prepararVariantes(); else imagen.addEventListener("load", prepararVariantes);

  // El campo tiene un tamaño lógico fijo (LOGICO_ANCHO x LOGICO_ALTO). Todo —
  // posiciones, tamaños, velocidades, golpes— se calcula en esas unidades y
  // solo se escala al dibujar, así el zoom del navegador o el tamaño de la
  // ventana no hacen el juego más fácil ni más difícil.
  function ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    const caja = canvas.getBoundingClientRect();
    ancho = LOGICO_ANCHO;
    alto = LOGICO_ALTO;
    // Tope a la resolución interna: con zoom alto el lienzo sería enorme y daría lag
    const k = Math.min(dpr, (LOGICO_ANCHO * 2) / Math.max(1, caja.width));
    canvas.width = Math.max(1, Math.round(caja.width * k));
    canvas.height = Math.max(1, Math.round(caja.height * k));
    const escala = canvas.width / LOGICO_ANCHO;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function nuevoHooey(xFijo, yExtra) {
    const escala = escalaPorRacha();
    const { w, h } = dimensiones(escala);
    const tipo = tipoNuevo();
    let variacion = 0.9 + Math.random() * 0.25;
    if (racha >= RACHA_RAPIDOS && Math.random() < 0.25) variacion *= 1.4;
    const x0 = xFijo !== undefined ? xFijo : Math.random() * Math.max(1, ancho - w);
    const zigzag = racha >= RACHA_ZIGZAG;
    return {
      x0, x: x0,
      y: -h - (yExtra || 0),
      w, h, tipo,
      vidas: tipo === "blindado" ? 2 : 1,
      variacion,
      fase: Math.random() * Math.PI * 2,
      t: 0,
      zigAmp: zigzag ? (14 + Math.min(40, (racha - RACHA_ZIGZAG) * 0.6)) * (0.6 + Math.random() * 0.8) : 0,
      zigFrec: 1.2 + Math.random() * 1.6,
      destello: 0
    };
  }

  // Oleada: 3 o 4 Hooeys, en abanico (V) o en escalera. Caen a una velocidad
  // fija y juntos, en una franja central del campo, para que se pueda llegar a
  // cada uno con un solo cursor. Mientras la oleada siga en pantalla no cae
  // ningún otro Hooey.
  function generarOleada() {
    const n = 3 + (Math.random() < 0.4 ? 1 : 0);
    const { w } = dimensiones(escalaPorRacha());
    const enV = Math.random() < 0.5;
    const v = VELOCIDAD_OLEADA;
    const franja = (ancho - w) * 0.55;
    const inicio = (ancho - w - franja) / 2;
    const nuevos = [];
    for (let i = 0; i < n; i++) {
      const x = inicio + franja * (i / (n - 1));
      const extra = enV ? Math.abs(i - (n - 1) / 2) * v * 0.3 : i * v * 0.35;
      const m = nuevoHooey(x, extra);
      m.variacion = 1;
      m.velFija = v;
      m.oleada = true;
      m.zigAmp = 0;
      nuevos.push(m);
    }
    if (nuevos.every(m => m.tipo === "decoy")) { nuevos[0].tipo = "normal"; nuevos[0].vidas = 1; }
    hooeys.push(...nuevos);
  }

  function textoEstado() {
    if (fase === "listo") return "Que ninguno toque el piso.";
    if (fase === "jugando") return `Racha ${racha} · ×${(velocidadActual() / VELOCIDAD_BASE).toFixed(1)}`;
    if (motivoFin === "decoy") return `Era un impostor. Racha de ${racha}.`;
    return `Se cayó uno. Racha de ${racha}.`;
  }

  function textoCuenta() {
    if (sesion) {
      return `${miNombre || "Tu cuenta"} · ${datosCuenta.total} sacrificados · récord ${datosCuenta.mejor}`;
    }
    return `Invitado · ${totalLocal} sacrificados · récord ${recordLocal}. Inicia sesión para entrar al ranking.`;
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
    // Curva suave: arranca tenue y llega a opaco al noveno escalón (racha 83).
    const escalones = Math.floor((racha - RACHA_FUEGO) / PASO_FUEGO);
    const opacidad = jugando && racha >= RACHA_FUEGO
      ? Math.min(1, 0.04 + 0.96 * Math.pow(Math.min(1, escalones / 9), 1.5))
      : 0;
    fuegoEl.style.opacity = String(opacidad);

    const bufones = jugando && racha >= RACHA_BUFON ? 1 + Math.floor((racha - RACHA_BUFON) / PASO_BUFON) : 0;
    const tpose = jugando && racha >= RACHA_TPOSE;
    if (bufones !== bufonesActuales || tpose !== tposeActual) {
      bufonesActuales = bufones;
      tposeActual = tpose;
      if (window.SacrificioBufones) window.SacrificioBufones.sincronizar(bufones, tpose);
    }
  }

  function refrescarTextos() {
    actualizarEfectos();
    pintarMedidor();
    estadoEl.textContent = textoEstado();
    cuentaEl.textContent = textoCuenta();
    botonJugar.classList.toggle("hidden", !(fase === "listo" || (fase === "fin" && cierreVisible)));
    botonJugar.setAttribute("aria-label", fase === "fin" ? "Jugar de nuevo" : "Jugar");
  }

  function empezar() {
    racha = 0;
    motivoFin = "piso";
    if (typeof audio !== "undefined" && audio && !audio.paused) audio.pause();
    if (window.SacrificioBufones) window.SacrificioBufones.precargar();
    prepararFuego();
    musica.currentTime = 0;
    musica.play().catch(() => { /* el navegador bloqueó el audio */ });
    oleadaPendiente = false;
    hooeys = [nuevoHooey()];
    particulas = [];
    temporizadorAparicion = intervaloAparicion();
    fase = "jugando";
    refrescarTextos();
  }

  function terminar() {
    fase = "fin";
    cierreVisible = false;
    tiempoCaida = 0;
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
      cuentaEl.textContent = `${textoCuenta()} · No se guardó esta partida.`;
    }
  }

  function sacrificar(indice) {
    const m = hooeys[indice];
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
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

  function chispas(m, color, cantidad) {
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    for (let i = 0; i < cantidad; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 140;
      particulas.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        vida: 0.4 + Math.random() * 0.4, edad: 0,
        tam: 3 + Math.floor(Math.random() * 3), color
      });
    }
  }

  // Un golpe sobre un Hooey: según su tipo sacrifica, rompe un escudo o pierde.
  function golpear(indice) {
    const m = hooeys[indice];
    if (m.tipo === "decoy") {
      chispas(m, "#ff4b4b", 26);
      motivoFin = "decoy";
      terminar();
      return;
    }
    if (m.tipo === "blindado" && m.vidas > 1) {
      m.vidas -= 1;
      m.destello = 0.3;
      chispas(m, "#8fdcff", 16);
      return;
    }
    sacrificar(indice);
  }

  function indiceBajo(x, y) {
    for (let i = hooeys.length - 1; i >= 0; i--) {
      const m = hooeys[i];
      if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return i;
    }
    return -1;
  }

  function posicion(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (LOGICO_ANCHO / r.width), y: (e.clientY - r.top) * (LOGICO_ALTO / r.height) };
  }

  canvas.addEventListener("pointerdown", e => {
    if (fase !== "jugando") return;
    const p = posicion(e);
    const i = indiceBajo(p.x, p.y);
    if (i >= 0) golpear(i);
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
    if (i >= 0) golpear(i);
  });

  canvas.addEventListener("mousemove", e => {
    const p = posicion(e);
    canvas.style.cursor = fase === "jugando" && indiceBajo(p.x, p.y) >= 0 ? "pointer" : "default";
  });

  canvas.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (fase === "fin" && !cierreVisible) return;
    if (fase !== "jugando") { empezar(); return; }
    const i = hooeys.findIndex(m => m.tipo !== "decoy");
    if (i >= 0) golpear(i);
  });

  botonJugar.addEventListener("click", empezar);

  function actualizar(dt) {
    if (fase === "jugando") {
      const v = velocidadActual();
      const oleadaActiva = hooeys.some(m => m.oleada && m.tipo !== "decoy");
      if (oleadaActiva) {
        // No cae nada más hasta eliminar la oleada
        temporizadorAparicion = 0.9;
      } else {
        temporizadorAparicion -= dt;
      }
      if (temporizadorAparicion <= 0) {
        if (oleadaPendiente || (racha >= RACHA_OLEADA && Math.random() < Math.min(0.4, 0.2 + (racha - RACHA_OLEADA) * 0.004))) {
          // La oleada sale cuando el campo está libre de Hooeys sueltos
          if (hooeys.some(m => m.tipo !== "decoy")) {
            oleadaPendiente = true;
            temporizadorAparicion = 0.1;
          } else {
            oleadaPendiente = false;
            generarOleada();
          }
        } else {
          hooeys.push(nuevoHooey());
          temporizadorAparicion = intervaloAparicion();
        }
      }
      for (const m of hooeys) {
        m.t += dt;
        m.y += (m.velFija || v * m.variacion) * dt;
        m.fase += dt * 4;
        if (m.destello > 0) m.destello -= dt;
        if (m.zigAmp) {
          m.x = Math.min(Math.max(0, m.x0 + Math.sin(m.t * m.zigFrec * 2) * m.zigAmp), Math.max(0, ancho - m.w));
        }
        if (m.tipo !== "decoy" && m.y + m.h >= alto) {
          motivoFin = "piso";
          terminar();
          break;
        }
      }
      // Los impostores que llegan al piso simplemente se van
      hooeys = hooeys.filter(m => !(m.tipo === "decoy" && m.y > alto + 10));
    } else if (fase === "fin" && !cierreVisible) {
      // El Hooey que perdió sigue de largo y sale del cuadro, y recién
      // entonces aparece la pantalla de cierre.
      tiempoCaida += dt;
      const v = velocidadActual() * 1.4 + tiempoCaida * 320;
      for (const m of hooeys) {
        m.y += v * m.variacion * dt;
        m.fase += dt * 4;
      }
      hooeys = hooeys.filter(m => m.y < alto + 10);
      if (!hooeys.length || tiempoCaida > 2.5) {
        hooeys = [];
        cierreVisible = true;
        refrescarTextos();
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

    for (const m of hooeys) {
      const cx = m.x + m.w / 2;
      const cy = m.y + m.h / 2;
      if (m.tipo === "blindado") {
        // Disco azul que late; el aro exterior marca que aún tiene escudo
        const pulso = 0.6 + 0.25 * Math.sin(m.fase * 1.5);
        const radio = Math.max(m.w, m.h) * 0.8;
        const fuerza = m.vidas > 1 ? 0.3 : 0.14;
        ctx.fillStyle = `rgba(120, 210, 255, ${fuerza * pulso})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radio * 0.85, 0, Math.PI * 2);
        ctx.fill();
        if (m.vidas > 1) {
          ctx.strokeStyle = `rgba(190, 235, 255, ${0.75 * pulso})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radio * 0.78, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const gelatina = 1 + Math.sin(m.fase) * 0.035;
      const dw = m.w / gelatina;
      const dh = m.h * gelatina;
      ctx.drawImage(m.tipo === "decoy" && imagenDecoy ? imagenDecoy : imagen, m.x + (m.w - dw) / 2, m.y + (m.h - dh), dw, dh);

      if (m.tipo === "decoy") {
        // Una X grande encima, con borde oscuro para que se lea sobre cualquier fondo
        const a = m.w * 0.22;
        const trazo = Math.max(4, m.w * 0.09);
        ctx.lineCap = "round";
        for (const [color, grosor] of [["rgba(0,0,0,.65)", trazo + 4], ["#ff3b3b", trazo]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = grosor;
          ctx.beginPath();
          ctx.moveTo(cx - a, cy - a); ctx.lineTo(cx + a, cy + a);
          ctx.moveTo(cx + a, cy - a); ctx.lineTo(cx - a, cy + a);
          ctx.stroke();
        }
      }
      if (m.destello > 0) {
        ctx.fillStyle = `rgba(200, 240, 255, ${Math.min(0.6, m.destello * 2)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(m.w, m.h) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const p of particulas) {
      ctx.globalAlpha = Math.max(0, 1 - p.edad / p.vida);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    ctx.globalAlpha = 1;

    if (fase === "listo" || (fase === "fin" && cierreVisible)) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.fillStyle = "#e8e4d0";
      ctx.textAlign = "center";
      ctx.font = "600 46px sans-serif";
      ctx.fillText(fase === "fin" ? `Racha: ${racha}` : "Hooey", ancho / 2, alto * 0.27);
      if (fase === "fin") {
        ctx.font = "24px sans-serif";
        ctx.fillStyle = "#b9b5a2";
        ctx.fillText(motivoFin === "decoy" ? "Era un impostor" : "Se cayó uno", ancho / 2, alto * 0.34);
      }
    }
  }

  // El juego avanza por pasos fijos de 1/60 s según el tiempo real. Si el
  // navegador se atrasa (lag, zoom, equipo lento), se recuperan los pasos
  // perdidos en vez de jugar en cámara lenta, así forzar lag no ayuda.
  const PASO = 1 / 60;
  const MAX_PASOS = 120;
  let acumulado = 0;
  let relojNuevo = true;
  document.addEventListener("visibilitychange", () => { relojNuevo = true; });

  function cuadro(t) {
    let real = (t - ultimo) / 1000 || 0;
    ultimo = t;
    // Al volver de otra pestaña no se cobra el tiempo que estuvo oculta
    if (relojNuevo) { real = PASO; relojNuevo = false; }
    acumulado += Math.min(real, MAX_PASOS * PASO);
    let pasos = 0;
    while (acumulado >= PASO && pasos < MAX_PASOS) {
      actualizar(PASO);
      acumulado -= PASO;
      pasos += 1;
    }
    if (pasos >= MAX_PASOS) acumulado = 0;
    dibujar();
    dibujarFuego(Math.min(0.1, real));
    requestAnimationFrame(cuadro);
  }

  // El zoom del navegador no cambia el tamaño del juego: se compensa para que
  // la caja mida siempre lo mismo en pantalla (ancho de ventana / ancho útil).
  function fijarZoom() {
    const ratio = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
    const z = Math.abs(ratio - 1) > 0.12 ? Math.min(4, Math.max(0.5, ratio)) : 1;
    document.documentElement.style.setProperty("--hooey-zoom", z.toFixed(3));
  }
  window.addEventListener("resize", () => { fijarZoom(); ajustarTamano(); });
  fijarZoom();
  window.addEventListener("pagehide", () => musica.pause());

  /* --- Ranking global (Supabase). Requiere scratchpad/hooey_ranking.sql --- */
  function pintarLista(el, filas, campo) {
    if (!filas.length) {
      el.innerHTML = `<li class="sacrificio-vacio">Nadie todavía.</li>`;
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
      // Slappy ya figura en el ranking, siempre, con 200 en ambas listas
      const conSlappy = (filas, campo) => [...filas, { ...SLAPPY }].sort((a, b) => b[campo] - a[campo]).slice(0, 10);
      pintarLista(rankTotalEl, conSlappy(porTotal.data.filter(f => f.total > 0), "total"), "total");
      pintarLista(rankRachaEl, conSlappy(porRacha.data.filter(f => f.mejor_racha > 0), "mejor_racha"), "mejor_racha");
    } catch (e) {
      const aviso = `<li class="sacrificio-vacio">Ranking no disponible.</li>`;
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

  const alOcio = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 4000 }) : fn => setTimeout(fn, 1500);
  alOcio(() => {
    prepararFuego();
    if (window.SacrificioBufones) window.SacrificioBufones.precargar();
  });
})();
