/* Juego de ritmo de dos carriles (en la línea de Muse Dash). Los golpes salen de la
   propia canción: al abrirla se analiza el audio, se buscan los ataques de sonido y
   se reparten por carril (graves al suelo, agudos al aire). El reloj del juego es el
   del audio, así que la música y las notas no se separan aunque la imagen se trabe.
   Campo de tamaño lógico fijo (960x540), igual que el resto de minijuegos. */
(function () {
  "use strict";

  const W = 960;
  const H = 540;
  const X_GOLPE = 210;
  const VENTANA_PERFECTO = 0.05;
  const VENTANA_BIEN = 0.11;
  const CLAVE_RECORDS = "compendioRitmoRecords";
  const CLAVE_AJUSTES = "compendioRitmoAjustes";
  const HOP = 512;

  const CARRILES = {
    arriba: { y: 175, color: "#8fdcff", etiqueta: "X · J · K" },
    abajo: { y: 385, color: "#e8837b", etiqueta: "Z · D · F" }
  };
  const TECLAS = { x: "arriba", j: "arriba", k: "arriba", arrowup: "arriba", z: "abajo", d: "abajo", f: "abajo", arrowdown: "abajo" };

  /* nps = notas por segundo que se buscan; hueco = separación mínima entre notas (s);
     aproximacion = segundos que tarda una nota desde el borde hasta el punto de golpe. */
  const DIFICULTADES = {
    facil: { nombre: "Fácil", nps: 1.5, hueco: 0.42, aproximacion: 1.6, umbral: 1.6 },
    normal: { nombre: "Normal", nps: 2.6, hueco: 0.28, aproximacion: 1.3, umbral: 1.4 },
    dificil: { nombre: "Difícil", nps: 4.0, hueco: 0.19, aproximacion: 1.1, umbral: 1.0 }
  };

  const canvas = document.getElementById("rtCampo");
  const ctxC = canvas.getContext("2d");
  const escenarioEl = document.getElementById("rtEscenario");
  const brilloEl = document.getElementById("rtBrillo");
  const menuEl = document.getElementById("rtMenu");
  const cancionesEl = document.getElementById("rtCanciones");
  const dificultadesEl = document.getElementById("rtDificultades");
  const desfaseEl = document.getElementById("rtDesfase");
  const desfaseTxtEl = document.getElementById("rtDesfaseTxt");
  const practicaEl = document.getElementById("rtPractica");
  const recordEl = document.getElementById("rtRecord");
  const jugarEl = document.getElementById("rtJugar");
  const cargaEl = document.getElementById("rtCarga");
  const cargaTxtEl = document.getElementById("rtCargaTxt");
  const finEl = document.getElementById("rtFin");
  const pausaEl = document.getElementById("rtPausa");

  /* --- Datos guardados ---------------------------------------------------- */
  let records = {};
  let ajustes = { desfase: 0, practica: false, dificultad: "normal", cancion: 0 };
  try { records = JSON.parse(localStorage.getItem(CLAVE_RECORDS) || "{}") || {}; } catch (e) { records = {}; }
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}")); } catch (e) { /* sin almacenamiento */ }
  function guardarAjustes() { try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin almacenamiento */ } }
  function guardarRecords() { try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(records)); } catch (e) { /* sin almacenamiento */ } }

  const canciones = (window.MUSICA || []).map(ruta => ({
    ruta,
    nombre: decodeURIComponent(ruta.split("/").pop()).replace(/\.[^.]+$/, "")
  }));
  if (!canciones.length) canciones.push({ ruta: "", nombre: "No hay canciones" });
  if (ajustes.cancion >= canciones.length) ajustes.cancion = 0;

  /* --- Análisis de la canción -------------------------------------------- */
  /* Energía por tramos en dos bandas: graves (por debajo de ~150 Hz) y agudos
     (lo que queda por encima de ~2,5 kHz). Un golpe es un salto brusco de energía. */
  function energias(buffer) {
    const sr = buffer.sampleRate;
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : c0;
    const n = Math.floor(buffer.length / HOP);
    const bajo = new Float32Array(n);
    const alto = new Float32Array(n);
    const a1 = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    const a2 = 1 - Math.exp(-2 * Math.PI * 2500 / sr);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < n; i++) {
      let sb = 0;
      let sa = 0;
      const ini = i * HOP;
      for (let k = ini; k < ini + HOP; k++) {
        const x = (c0[k] + c1[k]) * 0.5;
        lp1 += a1 * (x - lp1);
        lp2 += a2 * (x - lp2);
        const h = x - lp2;
        sb += lp1 * lp1;
        sa += h * h;
      }
      bajo[i] = Math.sqrt(sb / HOP);
      alto[i] = Math.sqrt(sa / HOP);
    }
    return { bajo, alto, sr };
  }

  /* Picos del flujo de energía: puntos que sobresalen de la media de su entorno. */
  function picos(rms, multiplicador) {
    const n = rms.length;
    const flujo = new Float32Array(n);
    let previo = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.log(1 + 100 * rms[i]);
      flujo[i] = Math.max(0, e - previo);
      previo = e;
    }
    const acum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) acum[i + 1] = acum[i] + flujo[i];
    const radio = 43;
    const lista = [];
    for (let i = 2; i < n - 2; i++) {
      const a = Math.max(0, i - radio);
      const b = Math.min(n, i + radio + 1);
      const umbral = ((acum[b] - acum[a]) / (b - a)) * multiplicador + 0.03;
      const v = flujo[i];
      if (v > umbral && v >= flujo[i - 1] && v >= flujo[i + 1] && v >= flujo[i - 2] && v >= flujo[i + 2]) lista.push({ i, fuerza: v - umbral });
    }
    const orden = lista.map(p => p.fuerza).sort((x, y) => x - y);
    const p90 = orden.length ? orden[Math.floor(orden.length * 0.9)] || 1 : 1;
    lista.forEach(p => { p.fuerza /= p90; });
    return lista;
  }

  /* Reparte los picos en notas: se quedan los más fuertes sin pasar de la densidad de la
     dificultad y sin dos notas más cerca que "hueco". No hay azar: la misma canción da
     siempre el mismo mapa. */
  function crearMapa(buffer, dificultad) {
    const cfg = DIFICULTADES[dificultad];
    const { bajo, alto, sr } = energias(buffer);
    const dur = buffer.duration;
    const tiempo = i => (i * HOP) / sr;
    const candidatos = [
      ...picos(bajo, cfg.umbral).map(p => ({ t: tiempo(p.i), carril: "abajo", f: p.fuerza })),
      ...picos(alto, cfg.umbral).map(p => ({ t: tiempo(p.i), carril: "arriba", f: p.fuerza * 0.95 }))
    ].filter(c => c.t > 0.8 && c.t < dur - 0.5);
    candidatos.sort((a, b) => b.f - a.f);

    const celda = 0.02;
    const bloqueo = new Uint8Array(Math.ceil(dur / celda) + 2);
    const maximo = Math.round(dur * cfg.nps);
    const notas = [];
    const medio = Math.round(cfg.hueco / celda);
    for (const c of candidatos) {
      if (notas.length >= maximo) break;
      const k = Math.round(c.t / celda);
      if (bloqueo[k]) continue;
      for (let j = Math.max(0, k - medio); j <= Math.min(bloqueo.length - 1, k + medio); j++) bloqueo[j] = 1;
      notas.push({ t: c.t, carril: c.carril, estado: null });
    }
    notas.sort((a, b) => a.t - b.t);

    // Pulso de los graves para que el fondo lata con la música
    const orden = Array.from(bajo).sort((x, y) => x - y);
    const tope = orden[Math.floor(orden.length * 0.95)] || 1;
    const pulso = new Float32Array(bajo.length);
    for (let i = 0; i < bajo.length; i++) pulso[i] = Math.min(1, bajo[i] / tope);
    return { notas, pulso, dur, sr };
  }

  /* --- Estado de la partida ---------------------------------------------- */
  let audio = null;
  let bufferActual = null;
  let rutaBuffer = "";
  const mapas = new Map();
  let fuente = null;
  let inicioAudio = 0;
  let estado = "menu"; // menu | cargando | jugando | pausa | fin
  let mapa = null;
  let cfg = DIFICULTADES.normal;
  let cancionActual = null;
  let notas = [];
  let punteroFallos = 0;
  let puntos = 0;
  let combo = 0;
  let comboMax = 0;
  let perfectos = 0;
  let buenos = 0;
  let fallos = 0;
  let vida = 100;
  let efectos = [];
  let avatar = { y: CARRILES.abajo.y, carril: "abajo", salto: -10, golpe: -10 };
  let flash = { arriba: -10, abajo: -10 };
  let raf = 0;
  let cargaId = 0;

  function ahoraS() { return performance.now() / 1000; }

  /* Tiempo de la canción tal como se oye: reloj del audio menos la latencia de salida
     y el ajuste de sincronía del jugador. */
  function tiempoCancion() {
    if (!audio) return 0;
    const latencia = (audio.outputLatency || 0);
    return audio.currentTime - inicioAudio - latencia - ajustes.desfase / 1000;
  }

  async function prepararAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") await audio.resume();
  }

  async function cargarCancion(cancion) {
    if (rutaBuffer === cancion.ruta && bufferActual) return bufferActual;
    bufferActual = null;
    rutaBuffer = "";
    const resp = await fetch(encodeURI(cancion.ruta));
    if (!resp.ok) throw new Error("No se pudo descargar la canción");
    const datos = await resp.arrayBuffer();
    bufferActual = await audio.decodeAudioData(datos);
    rutaBuffer = cancion.ruta;
    return bufferActual;
  }

  function mostrar(panel) {
    [menuEl, cargaEl, finEl, pausaEl].forEach(p => p.classList.toggle("hidden", p !== panel));
  }

  async function empezar() {
    if (estado === "cargando" || !canciones[ajustes.cancion].ruta) return;
    const miCarga = ++cargaId;
    estado = "cargando";
    cancionActual = canciones[ajustes.cancion];
    cfg = DIFICULTADES[ajustes.dificultad];
    mostrar(cargaEl);
    cargaTxtEl.textContent = "Cargando la canción...";
    try {
      await prepararAudio();
      const buffer = await cargarCancion(cancionActual);
      if (miCarga !== cargaId) return;
      cargaTxtEl.textContent = "Analizando la canción...";
      await new Promise(r => setTimeout(r, 30)); // deja pintar el aviso antes del cálculo
      const clave = cancionActual.ruta + "|" + ajustes.dificultad;
      if (!mapas.has(clave)) {
        if (mapas.size > 6) mapas.delete(mapas.keys().next().value);
        mapas.set(clave, crearMapa(buffer, ajustes.dificultad));
      }
      const base = mapas.get(clave);
      mapa = base;
      notas = base.notas.map(n => ({ t: n.t, carril: n.carril, estado: null }));
    } catch (err) {
      estado = "menu";
      mostrar(menuEl);
      recordEl.textContent = "No se pudo cargar esa canción. Prueba con otra.";
      return;
    }
    arrancar();
  }

  function arrancar() {
    punteroFallos = 0; puntos = 0; combo = 0; comboMax = 0;
    perfectos = 0; buenos = 0; fallos = 0; vida = 100; efectos = [];
    avatar = { y: CARRILES.abajo.y, carril: "abajo", salto: -10, golpe: -10 };
    flash = { arriba: -10, abajo: -10 };
    mostrar(null);
    fuente = audio.createBufferSource();
    fuente.buffer = bufferActual;
    fuente.connect(audio.destination);
    inicioAudio = audio.currentTime + 2.2; // margen para que las primeras notas lleguen de lejos
    fuente.start(inicioAudio);
    estado = "jugando";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  }

  function detenerFuente() {
    if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) { /* ya parada */ } fuente = null; }
  }

  function pausar() {
    if (estado !== "jugando") return;
    estado = "pausa";
    audio.suspend();
    mostrar(pausaEl);
  }

  async function continuar() {
    if (estado !== "pausa") return;
    mostrar(null);
    await audio.resume();
    estado = "jugando";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  }

  function salir() {
    detenerFuente();
    cancelAnimationFrame(raf);
    cargaId++;
    if (audio && audio.state === "suspended") audio.resume();
    estado = "menu";
    mostrar(menuEl);
    pintarMenu();
    dibujar(0);
  }

  /* --- Golpes ------------------------------------------------------------- */
  function sumar(juicio, carril) {
    const y = CARRILES[carril].y;
    avatar.carril = carril;
    avatar.golpe = ahoraS();
    flash[carril] = ahoraS();
    if (juicio === "perfecto") {
      perfectos++; combo++;
      puntos += Math.round(300 * (1 + Math.min(combo, 100) / 100));
      vida = Math.min(100, vida + 1);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "PERFECTO", color: "#f2d46b", t: ahoraS() });
    } else if (juicio === "bien") {
      buenos++; combo++;
      puntos += Math.round(100 * (1 + Math.min(combo, 100) / 100));
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "BIEN", color: "#e9e6d8", t: ahoraS() });
    } else {
      fallos++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - 7);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "FALLO", color: "#e8837b", t: ahoraS() });
    }
    comboMax = Math.max(comboMax, combo);
  }

  function golpear(carril, t) {
    flash[carril] = ahoraS();
    avatar.carril = carril;
    avatar.salto = ahoraS();
    let mejor = null;
    for (let i = punteroFallos; i < notas.length; i++) {
      const n = notas[i];
      if (n.t > t + VENTANA_BIEN) break;
      if (n.carril !== carril || n.estado) continue;
      const dt = Math.abs(n.t - t);
      if (dt <= VENTANA_BIEN && (!mejor || dt < Math.abs(mejor.t - t))) mejor = n;
    }
    if (!mejor) return;
    const dt = Math.abs(mejor.t - t);
    mejor.estado = dt <= VENTANA_PERFECTO ? "perfecto" : "bien";
    sumar(mejor.estado, carril);
  }

  function tiempoDeEvento(ev) {
    const retraso = Math.max(0, (performance.now() - (ev.timeStamp || performance.now())) / 1000);
    return tiempoCancion() - Math.min(retraso, 0.1);
  }

  window.addEventListener("keydown", ev => {
    if (ev.key === "Escape") {
      if (estado === "jugando") pausar();
      else if (estado === "pausa") continuar();
      return;
    }
    const carril = TECLAS[ev.key.toLowerCase()];
    if (!carril) return;
    if (estado === "jugando") {
      ev.preventDefault();
      if (!ev.repeat) golpear(carril, tiempoDeEvento(ev));
    }
  });

  canvas.addEventListener("pointerdown", ev => {
    if (estado !== "jugando") return;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    golpear((ev.clientY - r.top) / r.height < 0.5 ? "arriba" : "abajo", tiempoDeEvento(ev));
  });

  window.addEventListener("blur", () => { if (estado === "jugando") pausar(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && estado === "jugando") pausar(); });

  /* --- Avance y final ------------------------------------------------------ */
  function actualizar(t) {
    while (punteroFallos < notas.length && notas[punteroFallos].t < t - VENTANA_BIEN) {
      const n = notas[punteroFallos];
      if (!n.estado) { n.estado = "fallo"; sumar("fallo", n.carril); }
      punteroFallos++;
    }
    if (vida <= 0 && estado === "jugando") terminar(false);
    else if (t > mapa.dur + 0.8 && estado === "jugando") terminar(true);
  }

  function rangoDe(acc) {
    return acc >= 0.95 ? "S" : acc >= 0.88 ? "A" : acc >= 0.75 ? "B" : acc >= 0.6 ? "C" : "D";
  }

  function terminar(completa) {
    estado = "fin";
    detenerFuente();
    cancelAnimationFrame(raf);
    const total = notas.length || 1;
    const hechas = completa ? total : perfectos + buenos + fallos;
    const acc = (perfectos + buenos * 0.6) / Math.max(1, completa ? total : hechas);
    const rango = completa ? rangoDe(acc) : "—";
    const clave = cancionActual.ruta + "|" + ajustes.dificultad;
    const previo = records[clave] ? records[clave].puntos : 0;
    let nuevo = false;
    if (completa && !ajustes.practica && puntos > previo) {
      records[clave] = { puntos, acc: Math.round(acc * 1000) / 10, rango };
      guardarRecords();
      nuevo = true;
    }
    document.getElementById("rtFinTitulo").textContent = completa ? (nuevo ? "¡Nuevo récord!" : "Canción completada") : "Te quedaste sin vida";
    document.getElementById("rtFinRango").textContent = rango;
    document.getElementById("rtFinDatos").innerHTML =
      `${puntos.toLocaleString("es")} puntos · ${(acc * 100).toFixed(1)} % de precisión<br>` +
      `Perfectos ${perfectos} · Bien ${buenos} · Fallos ${fallos} · Combo máximo ${comboMax}` +
      (ajustes.practica ? "<br>Modo práctica: no cuenta para el récord." : "");
    mostrar(finEl);
  }

  /* --- Dibujo --------------------------------------------------------------- */
  /* Medir el canvas obliga al navegador a recalcular la página, así que solo se hace al
     cambiar el tamaño, no en cada fotograma. La resolución interna se limita para no
     pintar millones de píxeles de más en pantallas muy densas. */
  let medidaSucia = true;
  if (window.ResizeObserver) new ResizeObserver(() => { medidaSucia = true; }).observe(canvas);
  window.addEventListener("resize", () => { medidaSucia = true; });

  function ajustarCanvas() {
    if (!medidaSucia) return;
    medidaSucia = false;
    const r = canvas.getBoundingClientRect();
    const escala = Math.max(1, Math.min(window.devicePixelRatio || 1, 1280 / Math.max(1, r.width)));
    const w = Math.max(1, Math.round(r.width * escala));
    const h = Math.max(1, Math.round(r.height * escala));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctxC.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function dibujarNota(n, x, y, alfa) {
    ctxC.globalAlpha = alfa;
    if (n.carril === "abajo") {
      ctxC.fillStyle = "#e8837b";
      ctxC.strokeStyle = "#7a2e29";
      ctxC.lineWidth = 3;
      ctxC.beginPath();
      for (let k = 0; k < 14; k++) {
        const ang = (k * Math.PI) / 7;
        const radio = k % 2 === 0 ? 29 : 19;
        ctxC.lineTo(x + Math.cos(ang) * radio, y + Math.sin(ang) * radio);
      }
      ctxC.closePath();
      ctxC.fill();
      ctxC.stroke();
    } else {
      ctxC.fillStyle = "#8fdcff";
      ctxC.strokeStyle = "#2f6e8a";
      ctxC.lineWidth = 3;
      ctxC.beginPath();
      ctxC.moveTo(x, y - 27); ctxC.lineTo(x + 24, y); ctxC.lineTo(x, y + 27); ctxC.lineTo(x - 24, y);
      ctxC.closePath();
      ctxC.fill();
      ctxC.stroke();
    }
    ctxC.globalAlpha = 1;
  }

  let ultimoAvatar = 0;
  let brilloPrevio = "";
  let puntosTexto = "";
  let puntosPrevio = -1;
  function dibujarAvatar(ahora) {
    const objetivo = CARRILES[avatar.carril].y;
    const dt = Math.min(0.05, Math.max(0, ahora - ultimoAvatar));
    ultimoAvatar = ahora;
    avatar.y += (objetivo - avatar.y) * (1 - Math.exp(-dt * 20));
    const salto = Math.max(0, 1 - (ahora - avatar.salto) / 0.22);
    const golpe = Math.max(0, 1 - (ahora - avatar.golpe) / 0.2);
    const x = 100;
    const y = avatar.y - Math.sin(salto * Math.PI) * 26;
    const estira = 1 + golpe * 0.18;
    ctxC.save();
    ctxC.translate(x, y);
    ctxC.scale(1 / estira, estira);
    ctxC.fillStyle = "#7ed87f";
    ctxC.strokeStyle = "#2e6e32";
    ctxC.lineWidth = 4;
    ctxC.beginPath();
    ctxC.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    ctxC.fill();
    ctxC.stroke();
    ctxC.fillStyle = "#12330f";
    ctxC.beginPath(); ctxC.arc(-11, -6, 5, 0, Math.PI * 2); ctxC.arc(11, -6, 5, 0, Math.PI * 2); ctxC.fill();
    ctxC.strokeStyle = "#12330f"; ctxC.lineWidth = 3;
    ctxC.beginPath(); ctxC.arc(0, 6, golpe > 0 ? 8 : 6, 0.1 * Math.PI, 0.9 * Math.PI); ctxC.stroke();
    ctxC.restore();
  }

  function dibujar(t) {
    ajustarCanvas();
    const ahora = ahoraS();
    const pulso = mapa && estado !== "menu" ? mapa.pulso[Math.max(0, Math.min(mapa.pulso.length - 1, Math.floor((t * mapa.sr) / HOP)))] || 0 : 0;

    // El resplandor que late con los graves es un div con degradado detrás del canvas:
    // cambiar su opacidad no cuesta nada, a diferencia de rellenar un degradado enorme
    // en cada fotograma.
    ctxC.clearRect(0, 0, W, H);
    const brillo = (0.2 + pulso * 0.8).toFixed(2);
    if (brillo !== brilloPrevio) { brilloPrevio = brillo; brilloEl.style.opacity = brillo; }

    // Carriles
    Object.entries(CARRILES).forEach(([nombre, c]) => {
      ctxC.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctxC.fillRect(0, c.y - 38, W, 76);
      ctxC.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctxC.lineWidth = 2;
      ctxC.beginPath(); ctxC.moveTo(0, c.y); ctxC.lineTo(W, c.y); ctxC.stroke();
      const f = Math.max(0, 1 - (ahora - flash[nombre]) / 0.18);
      ctxC.strokeStyle = c.color;
      ctxC.lineWidth = 3 + f * 3;
      ctxC.globalAlpha = 0.55 + f * 0.45;
      ctxC.beginPath(); ctxC.arc(X_GOLPE, c.y, 36 + f * 6, 0, Math.PI * 2); ctxC.stroke();
      ctxC.globalAlpha = 1;
      ctxC.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctxC.font = "600 13px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(c.etiqueta, X_GOLPE, c.y + 62);
    });

    if (estado === "jugando" || estado === "pausa" || estado === "fin") {
      // Notas
      const recorrido = W - X_GOLPE + 50;
      for (let i = punteroFallos; i < notas.length; i++) {
        const n = notas[i];
        const dt = n.t - t;
        if (dt > cfg.aproximacion) break;
        if (n.estado === "perfecto" || n.estado === "bien") continue;
        dibujarNota(n, X_GOLPE + (dt / cfg.aproximacion) * recorrido, CARRILES[n.carril].y, 1);
      }
      // Notas ya falladas que se alejan
      for (let i = Math.max(0, punteroFallos - 12); i < punteroFallos; i++) {
        const n = notas[i];
        if (n.estado !== "fallo") continue;
        const dt = n.t - t;
        if (dt < -0.6) continue;
        dibujarNota(n, X_GOLPE + (dt / cfg.aproximacion) * recorrido, CARRILES[n.carril].y, 0.3);
      }
    }

    dibujarAvatar(ahora);

    // Textos de juicio
    efectos = efectos.filter(e => ahora - e.t < 0.6);
    efectos.forEach(e => {
      const k = (ahora - e.t) / 0.6;
      ctxC.globalAlpha = 1 - k;
      ctxC.fillStyle = e.color;
      ctxC.font = "700 22px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(e.texto, e.x + 20, e.y - k * 22);
      ctxC.globalAlpha = 1;
    });

    // Marcador
    if (estado !== "menu") {
      ctxC.fillStyle = "#e9e6d8";
      ctxC.textAlign = "left";
      ctxC.font = "700 28px sans-serif";
      if (puntos !== puntosPrevio) { puntosPrevio = puntos; puntosTexto = puntos.toLocaleString("es"); }
      ctxC.fillText(puntosTexto, 24, 44);
      if (combo >= 2) {
        ctxC.textAlign = "right";
        ctxC.font = "700 34px sans-serif";
        ctxC.fillStyle = combo >= 50 ? "#f2d46b" : "#e9e6d8";
        ctxC.fillText(`${combo}`, W - 24, 46);
        ctxC.font = "600 12px sans-serif";
        ctxC.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctxC.fillText("COMBO", W - 24, 64);
      }
      // Vida
      ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctxC.fillRect(24, 58, 200, 8);
      ctxC.fillStyle = vida > 35 ? "#7ed87f" : "#e8837b";
      ctxC.fillRect(24, 58, 2 * vida, 8);
      // Progreso
      if (mapa) {
        ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctxC.fillRect(0, H - 6, W, 6);
        ctxC.fillStyle = "#8fdcff";
        ctxC.fillRect(0, H - 6, W * Math.max(0, Math.min(1, t / mapa.dur)), 6);
      }
    }
  }

  function bucle() {
    if (estado !== "jugando") return;
    const t = tiempoCancion();
    actualizar(t);
    dibujar(t);
    if (estado === "jugando") raf = requestAnimationFrame(bucle);
  }

  /* --- Menú ------------------------------------------------------------------ */
  function pintarMenu() {
    cancionesEl.innerHTML = canciones.map((c, i) =>
      `<button type="button" class="rt-cancion ${i === ajustes.cancion ? "activa" : ""}" data-i="${i}" title="${c.nombre.replace(/"/g, "&quot;")}">${c.nombre.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))}</button>`).join("");
    dificultadesEl.innerHTML = Object.entries(DIFICULTADES).map(([id, d]) =>
      `<button type="button" class="rt-dif ${id === ajustes.dificultad ? "activa" : ""}" data-dif="${id}">${d.nombre}</button>`).join("");
    desfaseEl.value = ajustes.desfase;
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    practicaEl.checked = !!ajustes.practica;
    const r = records[canciones[ajustes.cancion].ruta + "|" + ajustes.dificultad];
    recordEl.textContent = r ? `Mejor: ${r.puntos.toLocaleString("es")} puntos · ${r.acc} % · rango ${r.rango}` : "";
    const activa = cancionesEl.querySelector(".activa");
    if (activa && activa.scrollIntoView) activa.scrollIntoView({ block: "nearest" });
  }

  cancionesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-i]");
    if (!b) return;
    ajustes.cancion = Number(b.dataset.i);
    guardarAjustes();
    pintarMenu();
  });
  dificultadesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-dif]");
    if (!b) return;
    ajustes.dificultad = b.dataset.dif;
    guardarAjustes();
    pintarMenu();
  });
  desfaseEl.addEventListener("input", () => {
    ajustes.desfase = Number(desfaseEl.value);
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    guardarAjustes();
  });
  practicaEl.addEventListener("change", () => { ajustes.practica = practicaEl.checked; guardarAjustes(); });
  jugarEl.addEventListener("click", empezar);
  document.getElementById("rtReintentar").addEventListener("click", empezar);
  document.getElementById("rtVolver").addEventListener("click", salir);
  document.getElementById("rtContinuar").addEventListener("click", continuar);
  document.getElementById("rtSalir").addEventListener("click", salir);
  window.addEventListener("resize", () => { if (estado !== "jugando") dibujar(tiempoCancion()); });

  pintarMenu();
  dibujar(0);

  if (/[?&]debug\b/.test(location.search)) {
    window.__ritmo = {
      crearMapa, DIFICULTADES,
      estado: () => ({ estado, puntos, combo, perfectos, buenos, fallos, vida, notas: notas.length }),
      tick: t => { actualizar(t); dibujar(t); },
      golpear, notas: () => notas, tiempo: tiempoCancion,
      forzarTiempo: f => { tiempoCancion = f; }
    };
  }
})();
