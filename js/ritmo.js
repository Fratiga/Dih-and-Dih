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
  const CLAVE_RECORDS = "compendioRitmoRecords";
  const CLAVE_AJUSTES = "compendioRitmoAjustes";
  // El análisis (tempo, pulso, notas) vive en ritmo-analisis.js y lo comparte el editor de mapas
  const { HOP, DIFICULTADES, crearMapa, desdeGuardado } = window.RitmoAnalisis;

  const CARRILES = {
    arriba: { y: 175, color: "#8fdcff", etiqueta: "Z · D · F" },
    abajo: { y: 385, color: "#e8837b", etiqueta: "X · J · K" }
  };
  let TECLAS = { z: "arriba", d: "arriba", f: "arriba", arrowup: "arriba", x: "abajo", j: "abajo", k: "abajo", arrowdown: "abajo" };
  const TECLAS_BASE = { arriba: ["z", "d", "f"], abajo: ["x", "j", "k"] };


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
  const buzonEl = document.getElementById("rtBuzon");
  const novedadesEl = document.getElementById("rtNovedades");
  const lobbyEl = document.getElementById("rtLobby");
  const buscarEl = document.getElementById("rtBuscar");
  const tituloEl = document.getElementById("rtTitulo");
  const metaEl = document.getElementById("rtMeta");
  const puntajesEl = document.getElementById("rtPuntajes");
  const puntajesTabsEl = document.getElementById("rtPuntajesTabs");
  const finPuntajesEl = document.getElementById("rtFinPuntajes");
  const pieEl = document.getElementById("rtPie");

  /* --- Datos guardados ---------------------------------------------------- */
  let records = {};
  let ajustes = { desfase: 0, practica: false, dificultad: "normal", cancion: 0, ruta: "", personaje: true, teclas: null, sonidoGolpe: true };
  try { records = JSON.parse(localStorage.getItem(CLAVE_RECORDS) || "{}") || {}; } catch (e) { records = {}; }
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}")); } catch (e) { /* sin almacenamiento */ }
  function guardarAjustes() { try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin almacenamiento */ } }
  /* --- Teclas de cada carril (se pueden cambiar; las flechas siempre valen) --- */
  function teclasActuales() {
    const t = ajustes.teclas && Array.isArray(ajustes.teclas.arriba) && Array.isArray(ajustes.teclas.abajo) ? ajustes.teclas : TECLAS_BASE;
    const tres = lista => [0, 1, 2].map(i => (lista[i] ? String(lista[i]).toLowerCase() : ""));
    return { arriba: tres(t.arriba), abajo: tres(t.abajo) };
  }
  function construirTeclas() {
    const t = teclasActuales();
    TECLAS = { arrowup: "arriba", arrowdown: "abajo" };
    t.arriba.forEach(k => { if (k) TECLAS[k] = "arriba"; });
    t.abajo.forEach(k => { if (k) TECLAS[k] = "abajo"; });
    CARRILES.arriba.etiqueta = t.arriba.filter(Boolean).map(k => k.toUpperCase()).join(" · ") || "↑";
    CARRILES.abajo.etiqueta = t.abajo.filter(Boolean).map(k => k.toUpperCase()).join(" · ") || "↓";
  }
  function guardarRecords() { try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(records)); } catch (e) { /* sin almacenamiento */ } }

  /* Solo entran canciones de hasta 6 minutos: más largas dan mapas enormes y tardan en analizarse.
     Las duraciones salen de data/musica-duraciones.js; si una canción no está ahí se mide al
     cargarla (ver cargarCancion). */
  const LIMITE_S = 360;
  const duraciones = Object.assign({}, window.MUSICA_NUBE_DURACIONES, window.MUSICA_DURACIONES);
  // Las canciones subidas por los DJ son direcciones completas (ya codificadas); las de assets, rutas
  const urlDe = ruta => (/^https?:/i.test(ruta) ? ruta : encodeURI(ruta));
  function partirNombre(nombre) {
    const m = nombre.match(/^(.*\S) - ([^-]+)$/);
    return m ? { titulo: m[1].trim(), artista: m[2].trim() } : { titulo: nombre, artista: "" };
  }
  function cancionDe(ruta) {
    let nombre = (window.MUSICA_NUBE_NOMBRES || {})[ruta];
    if (!nombre) {
      nombre = ruta.split("/").pop();
      try { nombre = decodeURIComponent(nombre); } catch (e) { /* nombre tal cual */ }
      nombre = nombre.replace(/\.[^.]+$/, "");
    }
    return Object.assign({ ruta, nombre, dur: duraciones[ruta] || 0 }, partirNombre(nombre));
  }
  const todas = (window.MUSICA || []).map(cancionDe);
  const canciones = todas.filter(c => !c.dur || c.dur <= LIMITE_S);
  if (!canciones.length) canciones.push({ ruta: "", nombre: "No hay canciones", titulo: "No hay canciones", artista: "", dur: 0 });
  {
    // Las preferencias guardadas antes eran un número de lista; se pasa a la ruta de la canción
    const rutaGuardada = ajustes.ruta || ((window.MUSICA || [])[ajustes.cancion] || "");
    const k = canciones.findIndex(c => c.ruta === rutaGuardada);
    ajustes.cancion = k >= 0 ? k : 0;
    ajustes.ruta = canciones[ajustes.cancion].ruta;
  }

  function duracionTexto(s) {
    const t = Math.round(s);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  let versionJugada = "auto"; // "auto", la fecha del mapa hecho a mano o "prueba"
  let fallosBloque = []; // fallos por tramos de 4 s de la partida en curso
  let activas = []; // largas que se están manteniendo
  let entradas = { arriba: new Set(), abajo: new Set() }; // teclas o dedos pulsados por carril
  let gracia = 0;
  let puntos = 0;
  let combo = 0;
  let comboMax = 0;
  let perfectos = 0;
  let buenos = 0;
  let fallos = 0;
  let extras = 0;
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
    const resp = await fetch(urlDe(cancion.ruta));
    if (!resp.ok) throw new Error("No se pudo descargar la canción");
    const datos = await resp.arrayBuffer();
    const buffer = await audio.decodeAudioData(datos);
    if (buffer.duration > LIMITE_S + 1) {
      const larga = new Error("larga");
      larga.cancion = cancion;
      throw larga;
    }
    bufferActual = buffer;
    rutaBuffer = cancion.ruta;
    return bufferActual;
  }

  /* El menú y el buzón viven en la sección de arriba; la carga, el final y la pausa van
     sobre el campo de juego, que solo se ve mientras se juega. */
  function mostrar(panel) {
    const enMenu = panel === menuEl || panel === buzonEl || panel === novedadesEl;
    lobbyEl.classList.toggle("hidden", !enMenu);
    escenarioEl.classList.toggle("hidden", enMenu);
    pieEl.classList.toggle("hidden", enMenu);
    menuEl.classList.toggle("hidden", panel !== menuEl);
    buzonEl.classList.toggle("hidden", panel !== buzonEl);
    novedadesEl.classList.toggle("hidden", panel !== novedadesEl);
    [cargaEl, finEl, pausaEl].forEach(p => p.classList.toggle("hidden", p !== panel));
  }

  /* Mapa guardado por el admin para esta canción y dificultad, o null. Con ?prueba en la
     dirección se usa el que dejó el editor en este navegador sin guardar. */
  async function mapaPersonalizado(ruta, dificultad) {
    try {
      const pr = JSON.parse(localStorage.getItem("ritmoPrueba") || "null");
      if (/[?&]prueba\b/.test(location.search) && pr && pr.ruta === ruta && pr.dificultad === dificultad) return { mapa: pr.mapa, version: "prueba" };
    } catch (e) { /* sin almacenamiento */ }
    try {
      if (typeof fichasCliente !== "function") return null;
      const supabase = await fichasCliente();
      const consulta = supabase.from("ritmo_mapas").select("mapa, actualizado").eq("cancion", ruta).eq("dificultad", dificultad).maybeSingle();
      const { data, error } = await Promise.race([consulta, new Promise(r => setTimeout(() => r({ error: true }), 3000))]);
      return !error && data ? { mapa: data.mapa, version: data.actualizado || "auto" } : null;
    } catch (e) {
      return null;
    }
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
      // Un mapa hecho a mano en el editor (o de prueba) manda sobre el automático
      const guardado = await mapaPersonalizado(cancionActual.ruta, ajustes.dificultad);
      let base;
      versionJugada = guardado ? guardado.version : "auto";
      if (guardado) {
        base = desdeGuardado(guardado.mapa, buffer);
      } else {
        if (!mapas.has(clave)) {
          if (mapas.size > 6) mapas.delete(mapas.keys().next().value);
          mapas.set(clave, crearMapa(buffer, ajustes.dificultad));
        }
        base = mapas.get(clave);
      }
      mapa = base;
      notas = base.notas.map(n => ({ t: n.t, carril: n.carril, dur: n.dur, estado: null, mitades: {}, mantiene: null }));
    } catch (err) {
      estado = "menu";
      mostrar(menuEl);
      if (err && err.message === "larga") {
        // Dura más de 6 minutos: se quita de la lista sin más
        const k = canciones.indexOf(err.cancion);
        if (k >= 0 && canciones.length > 1) canciones.splice(k, 1);
        ajustes.cancion = Math.min(ajustes.cancion, canciones.length - 1);
        ajustes.ruta = canciones[ajustes.cancion].ruta;
        pintarMenu();
      } else {
        recordEl.textContent = "No se pudo cargar esa canción. Prueba con otra.";
      }
      return;
    }
    arrancar();
  }

  function arrancar() {
    fallosBloque = [];
    punteroFallos = 0; activas = []; limpiarEntradas(); gracia = 0; puntos = 0; combo = 0; comboMax = 0;
    perfectos = 0; buenos = 0; fallos = 0; extras = 0; vida = 100; efectos = [];
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
    limpiarEntradas();
    audio.suspend();
    mostrar(pausaEl);
  }

  async function continuar() {
    if (estado !== "pausa") return;
    mostrar(null);
    await audio.resume();
    gracia = tiempoCancion() + 0.7; // margen para volver a pulsar las largas en curso
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
  function limpiarEntradas() { entradas.arriba.clear(); entradas.abajo.clear(); }

  function multiplicador() { return 1 + Math.min(combo, 150) / 50; }

  function sumar(juicio, carril, peso = 1) {
    const doble = carril === "ambos";
    const y = (doble ? (CARRILES.arriba.y + CARRILES.abajo.y) / 2 : CARRILES[carril].y);
    avatar.carril = doble ? "abajo" : carril;
    avatar.golpe = ahoraS();
    flash[doble ? "arriba" : carril] = ahoraS();
    if (doble) flash.abajo = ahoraS();
    if (juicio === "perfecto") {
      perfectos++; combo++;
      puntos += Math.round(300 * peso * multiplicador());
      vida = Math.min(100, vida + 1);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "PERFECTO", color: "#f2d46b", t: ahoraS() });
    } else if (juicio === "bien") {
      buenos++; combo++;
      puntos += Math.round(100 * peso * multiplicador());
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "BIEN", color: "#e9e6d8", t: ahoraS() });
    } else {
      fallos++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "FALLO", color: "#e8837b", t: ahoraS() });
    }
    comboMax = Math.max(comboMax, combo);
  }

  /* Un golpecito por cada pulsación, más agudo arriba y más grave abajo. Así se oye el ritmo que
     estás tocando, que no siempre coincide con el de la canción. Si no había nota, suena apagado. */
  function sonidoGolpe(carril, acierto) {
    if (ajustes.sonidoGolpe === false || !audio || audio.state !== "running") return;
    const t0 = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    const f = carril === "arriba" ? 1320 : 520;
    o.type = acierto ? "triangle" : "sine";
    o.frequency.setValueAtTime(acierto ? f : f * 0.5, t0);
    o.frequency.exponentialRampToValueAtTime(acierto ? f * 0.7 : f * 0.3, t0 + 0.07);
    g.gain.setValueAtTime(acierto ? 0.22 : 0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    o.connect(g); g.connect(audio.destination);
    o.start(t0); o.stop(t0 + 0.1);
  }

  function golpear(carril, t) {
    flash[carril] = ahoraS();
    avatar.carril = carril;
    avatar.salto = ahoraS();
    // Con una larga en curso en este carril, otra pulsación no cuenta
    if (activas.some(n => n.carril === carril)) return;
    let mejor = null;
    for (let i = punteroFallos; i < notas.length; i++) {
      const n = notas[i];
      if (n.t > t + cfg.bien) break;
      if (n.estado) continue;
      if (!(n.carril === carril || (n.carril === "ambos" && !n.mitades[carril]))) continue;
      const dt = Math.abs(n.t - t);
      if (dt <= cfg.bien && (!mejor || dt < Math.abs(mejor.t - t))) mejor = n;
    }
    if (!mejor) {
      sonidoGolpe(carril, false);
      // Pulsar sin nota a tiro cuenta como fallo: corta el combo y quita vida
      extras++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x: X_GOLPE, y: CARRILES[carril].y - 56, texto: "FALLO", color: "#e8837b", t: ahoraS() });
      return;
    }
    const juicio = Math.abs(mejor.t - t) <= cfg.perfecto ? "perfecto" : "bien";
    sonidoGolpe(carril, true);
    if (mejor.carril === "ambos") {
      // Una nota doble solo cuenta cuando entran las dos mitades
      mejor.mitades[carril] = juicio;
      if (!mejor.mitades.arriba || !mejor.mitades.abajo) return;
      mejor.estado = mejor.mitades.arriba === "perfecto" && mejor.mitades.abajo === "perfecto" ? "perfecto" : "bien";
      sumar(mejor.estado, "ambos", 2);
      return;
    }
    mejor.estado = juicio;
    sumar(juicio, carril);
    if (mejor.dur > 0) { mejor.mantiene = "activa"; activas.push(mejor); }
  }

  function tiempoDeEvento(ev) {
    const retraso = Math.max(0, (performance.now() - (ev.timeStamp || performance.now())) / 1000);
    return tiempoCancion() - Math.min(retraso, 0.1);
  }

  let capturando = null; // { carril, i } mientras se elige una tecla
  let calibrando = null;

  window.addEventListener("keydown", ev => {
    if (capturando) {
      ev.preventDefault();
      const k = ev.key.toLowerCase();
      if (k !== "escape" && k.length === 1 && k !== " ") {
        const t = teclasActuales();
        ["arriba", "abajo"].forEach(c => t[c].forEach((x, i) => { if (x === k) t[c][i] = ""; }));
        t[capturando.carril][capturando.i] = k;
        ajustes.teclas = t;
        guardarAjustes();
        construirTeclas();
      }
      capturando = null;
      pintarTeclas();
      return;
    }
    if (calibrando && ev.key !== "Escape") { ev.preventDefault(); if (!ev.repeat) tocarCalibracion(ev); return; }
    if (ev.key === "Escape") {
      if (estado === "jugando") pausar();
      else if (estado === "pausa") continuar();
      return;
    }
    const carril = TECLAS[ev.key.toLowerCase()];
    if (!carril) return;
    if (estado === "jugando") {
      ev.preventDefault();
      if (ev.repeat) return;
      entradas[carril].add("k" + ev.key.toLowerCase());
      golpear(carril, tiempoDeEvento(ev));
    }
  });

  window.addEventListener("keyup", ev => {
    const carril = TECLAS[ev.key.toLowerCase()];
    if (carril) entradas[carril].delete("k" + ev.key.toLowerCase());
  });

  canvas.addEventListener("pointerdown", ev => {
    if (estado !== "jugando") return;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const carril = (ev.clientY - r.top) / r.height < 0.5 ? "arriba" : "abajo";
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    entradas[carril].add("p" + ev.pointerId);
    golpear(carril, tiempoDeEvento(ev));
  });
  const soltarDedo = ev => { entradas.arriba.delete("p" + ev.pointerId); entradas.abajo.delete("p" + ev.pointerId); };
  canvas.addEventListener("pointerup", soltarDedo);
  canvas.addEventListener("pointercancel", soltarDedo);

  window.addEventListener("blur", () => { if (estado === "jugando") pausar(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && estado === "jugando") pausar(); });

  /* --- Avance y final ------------------------------------------------------ */
  function actualizar(t) {
    while (punteroFallos < notas.length && notas[punteroFallos].t < t - cfg.bien) {
      const n = notas[punteroFallos];
      if (!n.estado) { n.estado = "fallo"; sumar("fallo", n.carril); anotarFallo(n.t); }
      punteroFallos++;
    }
    // Largas en curso: se completan al llegar al final y se rompen si sueltas antes
    for (let k = activas.length - 1; k >= 0; k--) {
      const n = activas[k];
      const fin = n.t + n.dur;
      if (t >= fin - 0.05) {
        n.mantiene = "hecha";
        puntos += Math.round(150 * multiplicador());
        vida = Math.min(100, vida + 2);
        efectos.push({ x: X_GOLPE, y: CARRILES[n.carril].y - 86, texto: "SOSTENIDA", color: "#f2d46b", t: ahoraS() });
        activas.splice(k, 1);
      } else if (t > gracia && entradas[n.carril].size === 0 && t < fin - 0.12) {
        n.mantiene = "rota";
        sumar("fallo", n.carril);
        efectos[efectos.length - 1].texto = "SOLTASTE ANTES";
        anotarFallo(n.t);
        activas.splice(k, 1);
      }
    }
    if (vida <= 0 && estado === "jugando") terminar(false);
    else if (t > mapa.dur + 0.8 && estado === "jugando") terminar(true);
  }

  function anotarFallo(t) {
    const b = Math.max(0, Math.min(400, Math.floor(t / 4)));
    fallosBloque[b] = (fallosBloque[b] || 0) + 1;
  }

  /* Al terminar una partida (completa o no) se manda dónde se falló, para que quien edita el mapa
     vea qué partes cuestan más. Solo con sesión y sin práctica; nunca falla en voz alta. */
  async function enviarFallos(completa) {
    if (ajustes.practica || versionJugada === "prueba" || !mapa) return;
    try {
      const { sesion } = window.MjStats ? await MjStats.cargarSesion() : { sesion: null };
      if (!sesion) return;
      const alcanzo = Math.max(0, Math.min(400, completa ? Math.floor(mapa.dur / 4) : Math.floor(Math.max(0, tiempoCancion()) / 4)));
      const lista = [];
      for (let i = 0; i <= alcanzo; i++) lista.push(fallosBloque[i] || 0);
      const supa = await fichasCliente();
      await supa.rpc("ritmo_registrar_fallos", { p_cancion: cancionActual.ruta, p_dificultad: ajustes.dificultad, p_version: versionJugada, p_fallos: lista, p_alcanzo: alcanzo });
    } catch (e) { /* sin estadísticas */ }
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
      `Perfectos ${perfectos} · Bien ${buenos} · Fallos ${fallos} · Pulsaciones de más ${extras} · Combo máximo ${comboMax}` +
      (ajustes.practica ? "<br>Modo práctica: no cuenta para el récord." : "");
    mostrar(finEl);
    finPuntajesEl.innerHTML = "";
    enviarFallos(completa);
    if (completa && !ajustes.practica && versionJugada !== "prueba") subirPuntaje(cancionActual.ruta, ajustes.dificultad, puntos, Math.round(acc * 1000) / 10, rango, comboMax, versionJugada);
    else if (completa && versionJugada === "prueba") finPuntajesEl.innerHTML = `<p class="rt-nota">Es una prueba del editor: no cuenta para los puntajes.</p>`;
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

  function dibujarForma(carril, x, alfa) {
    const y = CARRILES[carril].y;
    ctxC.globalAlpha = alfa;
    if (carril === "abajo") {
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

  /* Una nota: forma de su carril; la doble une las dos con un puente dorado; la larga
     lleva una barra hasta donde termina. xCola es la posición del final de la barra. */
  function dibujarNota(n, x, alfa, xCola) {
    if (n.carril === "ambos") {
      ctxC.globalAlpha = alfa;
      ctxC.strokeStyle = "#f2d46b";
      ctxC.lineWidth = 5;
      ctxC.beginPath(); ctxC.moveTo(x, CARRILES.arriba.y + 27); ctxC.lineTo(x, CARRILES.abajo.y - 29); ctxC.stroke();
      ctxC.globalAlpha = 1;
      dibujarForma("arriba", x, alfa);
      dibujarForma("abajo", x, alfa);
      return;
    }
    if (xCola !== undefined && xCola > x) {
      const y = CARRILES[n.carril].y;
      const fin = Math.min(xCola, W + 40);
      ctxC.globalAlpha = alfa * 0.55;
      ctxC.fillStyle = CARRILES[n.carril].color;
      ctxC.fillRect(x, y - 14, fin - x, 28);
      ctxC.globalAlpha = alfa;
      topeDeLarga(fin, y);
      ctxC.globalAlpha = 1;
    }
    dibujarForma(n.carril, x, alfa);
  }

  /* El final de una larga: un círculo blanco con aro del color del carril. Ahí se suelta. */
  function topeDeLarga(x, y) {
    ctxC.fillStyle = "#ffffff";
    ctxC.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctxC.lineWidth = 3;
    ctxC.beginPath(); ctxC.arc(x, y, 16, 0, Math.PI * 2); ctxC.fill(); ctxC.stroke();
    ctxC.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctxC.fillRect(x - 5, y - 5, 10, 10);
  }

  let ultimoAvatar = 0;
  let brilloPrevio = "";
  let rgbPrevio = "";
  let puntosTexto = "";
  let puntosPrevio = -1;
  /* Foto propia del jugador, ya recortada en círculo (se guarda en este navegador) */
  const CLAVE_FOTO = "compendioRitmoFoto";
  let fotoImg = null;
  function cargarFoto() {
    fotoImg = null;
    let url = "";
    try { url = localStorage.getItem(CLAVE_FOTO) || ""; } catch (e) { /* sin almacenamiento */ }
    const vista = document.getElementById("rtFotoVista");
    const quitar = document.getElementById("rtFotoQuitar");
    if (url) {
      // Se prepara una sola vez en un lienzo del tamaño con el que se dibuja (con su aro): en cada
      // fotograma solo se copia, sin recortar ni escalar, que es lo que más cuesta.
      const img = new Image();
      img.onload = () => {
        const lienzo = document.createElement("canvas");
        lienzo.width = 140; lienzo.height = 140;
        const gl = lienzo.getContext("2d");
        gl.drawImage(img, 0, 0, 140, 140);
        gl.strokeStyle = "rgba(255, 255, 255, 0.85)"; gl.lineWidth = 5;
        gl.beginPath(); gl.arc(70, 70, 67.5, 0, Math.PI * 2); gl.stroke();
        fotoImg = lienzo;
      };
      img.src = url;
      vista.src = url;
    }
    vista.classList.toggle("hidden", !url);
    quitar.classList.toggle("hidden", !url);
    document.getElementById("rtFotoBtn").textContent = url ? "Cambiar mi foto" : "Usar mi foto";
  }

  function dibujarAvatar(ahora) {
    if (ajustes.personaje === false) return;
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
    if (fotoImg) {
      // La foto (ya circular) reemplaza al slime, con el mismo salto
      ctxC.drawImage(fotoImg, -35, -35, 70, 70);
      ctxC.restore();
      return;
    }
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
    // El color del resplandor sigue al carril de la última nota que pasó: naranja las de abajo,
    // azul las de arriba y dorado las dobles
    let rgb = "143, 220, 255";
    if (estado !== "menu" && notas.length) {
      let q = Math.max(0, punteroFallos - 4);
      let ultima = null;
      while (q < notas.length && notas[q].t <= t + 0.03) { ultima = notas[q]; q++; }
      if (ultima && t - ultima.t < 1.2) rgb = ultima.carril === "abajo" ? "255, 140, 50" : ultima.carril === "ambos" ? "242, 212, 107" : "143, 220, 255";
    }
    if (rgb !== rgbPrevio) { rgbPrevio = rgb; brilloEl.style.setProperty("--brillo-rgb", rgb); }

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
      const recorrido = W - X_GOLPE + 50;
      // Guías del pulso: líneas verticales que viajan con las notas, más marcadas en cada
      // compás. Ayudan a sentir el tiempo en vez de adivinarlo mirando las notas.
      if (mapa && mapa.pulsos && mapa.pulsos.length) {
        const ps = mapa.pulsos;
        let a = 0;
        let b = ps.length;
        while (a < b) { const m = (a + b) >> 1; if (ps[m] < t - 0.25) a = m + 1; else b = m; }
        ctxC.lineWidth = 2;
        for (let q = a; q < ps.length; q++) {
          const dtq = ps[q] - t;
          if (dtq > cfg.aproximacion) break;
          const x = X_GOLPE + (dtq / cfg.aproximacion) * recorrido;
          ctxC.strokeStyle = q % 4 === 0 ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.06)";
          ctxC.beginPath(); ctxC.moveTo(x, CARRILES.arriba.y - 50); ctxC.lineTo(x, CARRILES.abajo.y + 50); ctxC.stroke();
        }
      }
      // Notas
      for (let i = punteroFallos; i < notas.length; i++) {
        const n = notas[i];
        const dt = n.t - t;
        if (dt > cfg.aproximacion) break;
        if (n.estado === "perfecto" || n.estado === "bien") continue;
        const x = X_GOLPE + (dt / cfg.aproximacion) * recorrido;
        dibujarNota(n, x, 1, n.dur > 0 ? X_GOLPE + ((n.t + n.dur - t) / cfg.aproximacion) * recorrido : undefined);
      }
      // Largas que se están manteniendo: la cabeza se queda en el círculo y la cola se acerca
      activas.forEach(n => {
        const y = CARRILES[n.carril].y;
        const cola = X_GOLPE + ((n.t + n.dur - t) / cfg.aproximacion) * recorrido;
        ctxC.globalAlpha = 0.85;
        ctxC.fillStyle = CARRILES[n.carril].color;
        ctxC.fillRect(X_GOLPE, y - 14, Math.max(0, Math.min(cola, W + 40) - X_GOLPE), 28);
        ctxC.globalAlpha = 1;
        if (cola < W + 40) topeDeLarga(Math.max(X_GOLPE, cola), y);
        // Mientras se mantiene, un texto fijo recuerda qué hacer y, al final, cuándo soltar
        const resta = n.t + n.dur - t;
        const cerca = resta < 0.35;
        ctxC.fillStyle = cerca ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
        ctxC.font = cerca ? "800 20px sans-serif" : "700 15px sans-serif";
        ctxC.textAlign = "center";
        if (cerca || t - n.t > 0.6) ctxC.fillText(cerca ? "¡SUELTA!" : "MANTÉN", X_GOLPE, y - 50);
      });
      // Notas ya falladas que se alejan
      for (let i = Math.max(0, punteroFallos - 12); i < punteroFallos; i++) {
        const n = notas[i];
        if (n.estado !== "fallo") continue;
        const dt = n.t - t;
        if (dt < -0.6) continue;
        dibujarNota(n, X_GOLPE + (dt / cfg.aproximacion) * recorrido, 0.3);
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

  /* --- Puntajes de todos --------------------------------------------------------
     Tabla ritmo_puntajes (scratchpad/ritmo_puntajes.sql): el mejor puntaje de cada
     jugador por canción y dificultad. Se lee sin sesión; para guardar hay que haber
     iniciado sesión. */
  const DESCRIPCION = { facil: "Relajado", normal: "Equilibrado", dificil: "Exigente", experto: "Extremo" };
  const puntajesCache = new Map();
  let vistaPuntajes = null; // "todas", una dificultad, o null = la que está elegida para jugar
  let verViejos = false; // false: puntajes de la versión actual del mapa; true: los de versiones anteriores
  const versionDe = (ruta, dif) => { const f = aMano.get(ruta); const v = f && f.get(dif); return (v && v.version) || "auto"; };
  let tokenPuntajes = 0;
  let yo = { id: null, nombre: "" };

  async function filasPuntajes(ruta, dif) {
    const clave = ruta + "|" + dif + "|" + (verViejos ? "viejos" : "vigentes");
    const guardado = puntajesCache.get(clave);
    if (guardado && Date.now() - guardado.t < 30000) return guardado.filas;
    const supa = await fichasCliente();
    const pedir = async columnas => {
      let q = supa.from("ritmo_puntajes").select(columnas).eq("cancion", ruta);
      if (dif !== "todas") q = q.eq("dificultad", dif);
      return q.order("puntos", { ascending: false }).limit(200);
    };
    let res = await pedir("user_id, username, dificultad, puntos, precision, rango, combo_max, jugadas, mapa_version");
    // Si todavía no se corrió ritmo_editor_3.sql no existe la versión: se muestra todo como siempre
    if (res.error && /mapa_version/i.test(String(res.error.message))) res = await pedir("user_id, username, dificultad, puntos, precision, rango, combo_max, jugadas");
    if (res.error) throw res.error;
    let filas = res.data || [];
    if (filas.length && filas[0].mapa_version !== undefined) {
      filas = filas.filter(f => (f.mapa_version === versionDe(ruta, f.dificultad)) !== verViejos);
    }
    filas = filas.slice(0, 50);
    puntajesCache.set(clave, { t: Date.now(), filas });
    return filas;
  }

  function tablaPuntajes(filas, { conDificultad, max }) {
    if (!filas.length) return `<p class="rt-nota">${verViejos ? "No hay puntajes de versiones anteriores del mapa." : "Nadie ha jugado esta versión del mapa todavía. Sé el primero."}</p>`;
    const vistas = filas.slice(0, max);
    const miFila = yo.id ? filas.findIndex(f => f.user_id === yo.id) : -1;
    if (miFila >= max) vistas.push(Object.assign({ _puesto: miFila + 1 }, filas[miFila]));
    return `<table class="rt-tabla"><thead><tr><th>#</th><th>Jugador</th>${conDificultad ? "<th>Dif.</th>" : ""}<th>Puntos</th><th>Rango</th><th>Prec.</th><th>Combo</th></tr></thead><tbody>${
      vistas.map((f, k) => {
        const puesto = f._puesto || k + 1;
        return `<tr class="${f.user_id === yo.id ? "yo" : ""}"><td>${puesto}</td><td>${esc(f.username)}</td>${conDificultad ? `<td>${esc((DIFICULTADES[f.dificultad] || {}).nombre || f.dificultad)}</td>` : ""}<td>${Number(f.puntos).toLocaleString("es")}</td><td><b class="rt-rango-mini rango-${esc(f.rango)}">${esc(f.rango)}</b></td><td>${Number(f.precision).toFixed(1)} %</td><td>${f.combo_max}</td></tr>`;
      }).join("")}</tbody></table>`;
  }

  async function pintarPuntajes() {
    const c = canciones[ajustes.cancion];
    if (!c || !c.ruta) { puntajesEl.innerHTML = ""; puntajesTabsEl.innerHTML = ""; return; }
    const vista = vistaPuntajes || ajustes.dificultad;
    puntajesTabsEl.innerHTML = [["todas", "Todas"], ...Object.entries(DIFICULTADES).map(([id, d]) => [id, d.nombre])]
      .map(([id, nombre]) => `<button type="button" class="rt-tab ${id === vista ? "activa" : ""}" data-vista="${id}">${nombre}</button>`).join("") +
      `<button type="button" class="rt-tab rt-tab-viejos ${verViejos ? "activa" : ""}" data-viejos title="Los puntajes hechos antes de que se cambiara el mapa de esta canción">Mapas anteriores</button>`;
    const token = ++tokenPuntajes;
    puntajesEl.innerHTML = `<p class="rt-nota">Cargando puntajes...</p>`;
    try {
      const filas = await filasPuntajes(c.ruta, vista);
      if (token !== tokenPuntajes) return;
      puntajesEl.innerHTML = tablaPuntajes(filas, { conDificultad: vista === "todas", max: 10 });
    } catch (e) {
      if (token === tokenPuntajes) puntajesEl.innerHTML = `<p class="rt-nota">Los puntajes no están disponibles por ahora.</p>`;
    }
  }

  puntajesTabsEl.addEventListener("click", ev => {
    if (ev.target.closest("[data-viejos]")) { verViejos = !verViejos; pintarPuntajes(); return; }
    const b = ev.target.closest("[data-vista]");
    if (!b) return;
    vistaPuntajes = b.dataset.vista;
    pintarPuntajes();
  });

  /* Al terminar una canción: se guarda el puntaje (si hay sesión) y se muestra la tabla. */
  async function subirPuntaje(ruta, dif, pts, acc, rango, combo, version) {
    finPuntajesEl.innerHTML = `<p class="rt-nota">Guardando tu puntaje...</p>`;
    let aviso = "";
    try {
      const { sesion } = window.MjStats ? await MjStats.cargarSesion() : { sesion: null };
      if (!sesion) {
        aviso = "Inicia sesión (arriba a la derecha) para aparecer en los puntajes.";
      } else {
        const supa = await fichasCliente();
        const args = { p_cancion: ruta, p_dificultad: dif, p_puntos: pts, p_precision: acc, p_rango: rango, p_combo: combo };
        let { error } = await supa.rpc("ritmo_registrar", Object.assign({ p_version: version || "auto" }, args));
        // Sin ritmo_editor_3.sql la función no conoce la versión: se manda como antes
        if (error && /p_version|PGRST202|schema cache/i.test(String(error.message || "") + String(error.code || ""))) ({ error } = await supa.rpc("ritmo_registrar", args));
        if (error) aviso = "No se pudo guardar el puntaje. Prueba de nuevo en un rato.";
      }
    } catch (e) {
      aviso = "No se pudo guardar el puntaje.";
    }
    puntajesCache.clear();
    try {
      const filas = await filasPuntajes(ruta, dif);
      if (estado !== "fin") return;
      finPuntajesEl.innerHTML = (aviso ? `<p class="rt-nota">${esc(aviso)}</p>` : "") + tablaPuntajes(filas, { conDificultad: false, max: 5 });
    } catch (e) {
      if (estado === "fin") finPuntajesEl.innerHTML = aviso ? `<p class="rt-nota">${esc(aviso)}</p>` : "";
    }
  }

  if (window.MjStats) {
    MjStats.cargarSesion().then(({ sesion, nombre }) => {
      yo = { id: sesion ? sesion.user.id : null, nombre };
      if (sesion) pintarPuntajes();
    });
  }

  /* --- Menú ------------------------------------------------------------------ */
  function normalizar(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* Canciones y dificultades con un mapa guardado desde el editor (hecho a mano por un admin).
     La lista es pública, así que se pide al abrir el menú. */
  const aMano = new Map(); // ruta -> Map(dificultad -> { firma, version, nivel })
  function textoMano(ruta) {
    const porDif = aMano.get(ruta);
    if (!porDif) return "";
    return "Mapa hecho a mano en " + [...porDif].map(([d, firma]) => (DIFICULTADES[d] ? DIFICULTADES[d].nombre : d) + (firma && firma.firma ? " por " + firma.firma : "")).join(", ");
  }
  async function cargarMapasAMano() {
    try {
      if (typeof fichasCliente !== "function") return;
      const supabase = await fichasCliente();
      const consulta = supabase.from("ritmo_mapas").select("cancion, dificultad, actualizado, firma:mapa->>firma, nivel:mapa->>nivel");
      const { data, error } = await Promise.race([consulta, new Promise(r => setTimeout(() => r({ error: true }), 4000))]);
      if (error || !data) return;
      aMano.clear();
      data.forEach(f => {
        if (!aMano.has(f.cancion)) aMano.set(f.cancion, new Map());
        aMano.get(f.cancion).set(f.dificultad, { firma: (f.firma || "").trim(), version: f.actualizado || "auto", nivel: f.nivel ? Number(f.nivel) : 0 });
      });
      pintarMenu();
    } catch (e) { /* sin marcas */ }
  }

  function pintarMenu() {
    const q = normalizar(buscarEl.value.trim());
    const guardado = cancionesEl.scrollTop;
    const filas = canciones.map((c, i) => ({ c, i })).filter(({ c }) => !q || normalizar(c.nombre).includes(q));
    cancionesEl.innerHTML = filas.map(({ c, i }) => {
      const r = records[c.ruta + "|" + ajustes.dificultad];
      return `<button type="button" role="option" aria-selected="${i === ajustes.cancion}" class="rt-cancion ${i === ajustes.cancion ? "activa" : ""}" data-i="${i}">` +
        `<span class="rt-cancion-txt"><strong>${esc(c.titulo)}</strong>${c.artista ? `<small>${esc(c.artista)}</small>` : ""}</span>` +
        `<span class="rt-cancion-der">${aMano.has(c.ruta) ? `<i class="rt-mano" title="${esc(textoMano(c.ruta))}">★</i>` : ""}${c.dur ? `<em>${duracionTexto(c.dur)}</em>` : ""}${r ? `<b class="rt-rango-mini rango-${esc(r.rango)}" title="Tu mejor: ${Number(r.puntos).toLocaleString("es")}">${esc(r.rango)}</b>` : ""}</span></button>`;
    }).join("") || `<p class="rt-nota">Ninguna canción coincide con la búsqueda.</p>`;
    cancionesEl.scrollTop = guardado;
    const activa = cancionesEl.querySelector(".activa");
    if (activa && !q) {
      // Se mantiene a la vista dentro de la lista, sin mover la página
      const arriba = activa.offsetTop - cancionesEl.offsetTop;
      if (arriba < cancionesEl.scrollTop) cancionesEl.scrollTop = arriba;
      else if (arriba + activa.offsetHeight > cancionesEl.scrollTop + cancionesEl.clientHeight) cancionesEl.scrollTop = arriba + activa.offsetHeight - cancionesEl.clientHeight;
    }

    const c = canciones[ajustes.cancion];
    tituloEl.textContent = c.titulo;
    metaEl.textContent = [c.artista, c.dur ? duracionTexto(c.dur) : ""].filter(Boolean).join(" · ");
    dificultadesEl.innerHTML = Object.entries(DIFICULTADES).map(([id, d]) =>
      `<button type="button" class="rt-dif ${id === ajustes.dificultad ? "activa" : ""}" data-dif="${id}"><strong>${d.nombre}</strong><small>${DESCRIPCION[id]}</small>${aMano.has(c.ruta) && aMano.get(c.ruta).has(id) ? `<em class="rt-dif-mano">★ ${esc(aMano.get(c.ruta).get(id).firma ? "Mapa de " + aMano.get(c.ruta).get(id).firma : "Mapa a mano")}</em>${aMano.get(c.ruta).get(id).nivel ? `<em class="rt-dif-nivel">Nivel ${aMano.get(c.ruta).get(id).nivel}</em>` : ""}` : ""}</button>`).join("");
    document.getElementById("rtLeyenda").classList.toggle("hidden", !aMano.size);
    desfaseEl.value = ajustes.desfase;
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    practicaEl.checked = !!ajustes.practica;
    document.getElementById("rtPersonaje").checked = ajustes.personaje !== false;
    document.getElementById("rtSonidoGolpe").checked = ajustes.sonidoGolpe !== false;
    const r = records[c.ruta + "|" + ajustes.dificultad];
    recordEl.textContent = r ? `Tu mejor: ${r.puntos.toLocaleString("es")} puntos · ${r.acc} % · rango ${r.rango}` : "";
    pintarPuntajes();
  }

  buscarEl.addEventListener("input", pintarMenu);
  cancionesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-i]");
    if (!b) return;
    ajustes.cancion = Number(b.dataset.i);
    ajustes.ruta = canciones[ajustes.cancion].ruta;
    vistaPuntajes = null;
    guardarAjustes();
    pintarMenu();
  });
  dificultadesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-dif]");
    if (!b) return;
    ajustes.dificultad = b.dataset.dif;
    vistaPuntajes = null;
    guardarAjustes();
    pintarMenu();
  });
  desfaseEl.addEventListener("input", () => {
    ajustes.desfase = Number(desfaseEl.value);
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    guardarAjustes();
  });
  practicaEl.addEventListener("change", () => { ajustes.practica = practicaEl.checked; guardarAjustes(); });
  document.getElementById("rtPersonaje").addEventListener("change", ev => { ajustes.personaje = ev.target.checked; guardarAjustes(); });
  document.getElementById("rtSonidoGolpe").addEventListener("change", ev => { ajustes.sonidoGolpe = ev.target.checked; guardarAjustes(); });

  /* --- Foto del personaje: se elige, se encuadra en un círculo y se guarda ya recortada --- */
  {
    const recorteEl = document.getElementById("rtRecorte");
    const lienzoR = document.getElementById("rtRecorteLienzo");
    const gr = lienzoR.getContext("2d");
    const zoomR = document.getElementById("rtRecorteZoom");
    const TAM = 300;
    let img = null;
    let base = 1; // escala que hace que la imagen cubra el círculo
    let zoom = 1;
    let ox = 0;
    let oy = 0;
    let arrastrando = null;

    function limitar() {
      const w = img.width * base * zoom;
      const h = img.height * base * zoom;
      ox = Math.min(0, Math.max(TAM - w, ox));
      oy = Math.min(0, Math.max(TAM - h, oy));
    }

    function pintarRecorte() {
      gr.clearRect(0, 0, TAM, TAM);
      gr.drawImage(img, ox, oy, img.width * base * zoom, img.height * base * zoom);
      // Oscurece lo que queda fuera del círculo
      gr.save();
      gr.fillStyle = "rgba(0, 0, 0, 0.62)";
      gr.beginPath();
      gr.rect(0, 0, TAM, TAM);
      gr.arc(TAM / 2, TAM / 2, TAM / 2 - 4, 0, Math.PI * 2, true);
      gr.fill("evenodd");
      gr.restore();
      gr.strokeStyle = "rgba(255, 255, 255, 0.9)"; gr.lineWidth = 2;
      gr.beginPath(); gr.arc(TAM / 2, TAM / 2, TAM / 2 - 4, 0, Math.PI * 2); gr.stroke();
    }

    function abrirRecorte(archivo) {
      const url = URL.createObjectURL(archivo);
      const nueva = new Image();
      nueva.onload = () => {
        URL.revokeObjectURL(url);
        img = nueva;
        base = Math.max(TAM / img.width, TAM / img.height);
        zoom = 1;
        zoomR.value = "100";
        ox = (TAM - img.width * base) / 2;
        oy = (TAM - img.height * base) / 2;
        recorteEl.classList.remove("hidden");
        pintarRecorte();
      };
      nueva.onerror = () => { URL.revokeObjectURL(url); alert("No se pudo leer esa imagen."); };
      nueva.src = url;
    }

    document.getElementById("rtFotoBtn").addEventListener("click", () => document.getElementById("rtFotoArchivo").click());
    document.getElementById("rtFotoArchivo").addEventListener("change", ev => {
      const f = ev.target.files[0];
      ev.target.value = "";
      if (f) abrirRecorte(f);
    });
    document.getElementById("rtFotoQuitar").addEventListener("click", () => {
      try { localStorage.removeItem(CLAVE_FOTO); } catch (e) { /* sin almacenamiento */ }
      cargarFoto();
    });

    lienzoR.addEventListener("pointerdown", ev => {
      lienzoR.setPointerCapture(ev.pointerId);
      arrastrando = { x: ev.clientX, y: ev.clientY, ox, oy };
    });
    lienzoR.addEventListener("pointermove", ev => {
      if (!arrastrando) return;
      const k = TAM / lienzoR.getBoundingClientRect().width;
      ox = arrastrando.ox + (ev.clientX - arrastrando.x) * k;
      oy = arrastrando.oy + (ev.clientY - arrastrando.y) * k;
      limitar();
      pintarRecorte();
    });
    const soltar = () => { arrastrando = null; };
    lienzoR.addEventListener("pointerup", soltar);
    lienzoR.addEventListener("pointercancel", soltar);
    zoomR.addEventListener("input", () => {
      // El zoom se hace alrededor del centro del círculo
      const antes = zoom;
      zoom = Number(zoomR.value) / 100;
      const cx = TAM / 2;
      ox = cx - ((cx - ox) / antes) * zoom;
      oy = cx - ((cx - oy) / antes) * zoom;
      limitar();
      pintarRecorte();
    });
    document.getElementById("rtRecorteNo").addEventListener("click", () => recorteEl.classList.add("hidden"));
    document.getElementById("rtRecorteOk").addEventListener("click", () => {
      // Se guarda a 160x160 con el recorte circular ya aplicado (PNG con transparencia)
      const salida = document.createElement("canvas");
      salida.width = 160; salida.height = 160;
      const gs = salida.getContext("2d");
      const k = 160 / TAM;
      gs.beginPath(); gs.arc(80, 80, 80, 0, Math.PI * 2); gs.clip();
      gs.drawImage(img, ox * k, oy * k, img.width * base * zoom * k, img.height * base * zoom * k);
      try { localStorage.setItem(CLAVE_FOTO, salida.toDataURL("image/png")); } catch (e) { alert("No se pudo guardar la foto en este navegador."); }
      recorteEl.classList.add("hidden");
      cargarFoto();
    });
  }
  cargarFoto();

  /* --- Novedades: lista de cambios (data/zarabanda-novedades.js) con un punto si hay algo que no viste --- */
  {
    const CLAVE_VISTAS = "compendioZarabandaNovedadesVistas";
    const novedades = window.ZARABANDA_NOVEDADES || [];
    const nuevoEl = document.getElementById("rtNuevo");
    const clave = n => n.fecha + "|" + n.titulo;
    let vistas = [];
    try { vistas = JSON.parse(localStorage.getItem(CLAVE_VISTAS) || "[]"); } catch (e) { vistas = []; }
    const hayNuevas = () => novedades.some(n => !vistas.includes(clave(n)));
    nuevoEl.classList.toggle("hidden", !hayNuevas());
    document.getElementById("rtNovedadesLista").innerHTML = novedades.length
      ? novedades.map(n => `<article class="rt-novedad"><h3>${esc(n.titulo)}</h3><time datetime="${esc(n.fecha)}">${esc(new Date(n.fecha + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }))}</time><ul>${n.cambios.map(x => `<li>${esc(x)}</li>`).join("")}</ul></article>`).join("")
      : `<p class="rt-nota">Todavía no hay novedades.</p>`;
    document.getElementById("rtAbrirNovedades").addEventListener("click", () => {
      mostrar(novedadesEl);
      vistas = novedades.map(clave);
      try { localStorage.setItem(CLAVE_VISTAS, JSON.stringify(vistas)); } catch (e) { /* sin almacenamiento */ }
      nuevoEl.classList.add("hidden");
    });
    document.getElementById("rtNovedadesVolver").addEventListener("click", () => mostrar(menuEl));
  }
  cargarMapasAMano();

  /* --- Teclas: casillas para elegir las de cada carril --- */
  function pintarTeclas() {
    const cont = document.getElementById("rtTeclas");
    if (!cont) return;
    const t = teclasActuales();
    const grupo = (carril, nombre) => `<span class="rt-teclas-grupo"><em>${nombre}</em>${[0, 1, 2].map(i => {
      const espera = capturando && capturando.carril === carril && capturando.i === i;
      return `<button type="button" class="rt-tecla ${espera ? "esperando" : ""}" data-carril="${carril}" data-i="${i}">${espera ? "..." : (t[carril][i] ? t[carril][i].toUpperCase() : "—")}</button>`;
    }).join("")}</span>`;
    cont.innerHTML = grupo("arriba", "Arriba") + grupo("abajo", "Abajo") + `<button type="button" class="rt-secundario rt-chico" data-restablecer>Restablecer</button>`;
    const txt = document.getElementById("rtTeclasTxt");
    if (txt) txt.textContent = `Arriba: ${CARRILES.arriba.etiqueta.replace(/ · /g, " ")} ↑. Abajo: ${CARRILES.abajo.etiqueta.replace(/ · /g, " ")} ↓.`;
  }
  document.getElementById("rtTeclas").addEventListener("click", ev => {
    if (ev.target.closest("[data-restablecer]")) { ajustes.teclas = null; guardarAjustes(); construirTeclas(); capturando = null; pintarTeclas(); return; }
    const b = ev.target.closest("[data-carril]");
    if (!b) return;
    capturando = { carril: b.dataset.carril, i: Number(b.dataset.i) };
    pintarTeclas();
  });
  construirTeclas();
  pintarTeclas();

  /* --- Calibrar la sincronía: suenan 10 tics y se mide cuánto tardas en tocar --- */
  {
    const modal = document.getElementById("rtCalibracion");
    const txt = document.getElementById("rtCalibracionTxt");
    const puntos = document.getElementById("rtCalibracionPuntos");
    const bEmpezar = document.getElementById("rtCalibracionEmpezar");
    const bAplicar = document.getElementById("rtCalibracionAplicar");
    let resultado = null;
    let temporizador = 0;

    function pintarPuntos() {
      puntos.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${calibrando && calibrando.taps.some(x => x.k === i) ? "tocado" : ""}"></i>`).join("");
    }

    window.tocarCalibracion = ev => {
      if (!calibrando || !audio) return;
      const retraso = Math.max(0, Math.min(0.1, (performance.now() - (ev.timeStamp || performance.now())) / 1000));
      const crudo = audio.currentTime - retraso;
      const k = Math.round((crudo - calibrando.t0) / calibrando.periodo);
      if (k < 0 || k >= calibrando.n || calibrando.taps.some(x => x.k === k)) return;
      const delta = crudo - (calibrando.t0 + k * calibrando.periodo);
      if (Math.abs(delta) > 0.3) return;
      calibrando.taps.push({ k, delta });
      pintarPuntos();
    };

    function terminar() {
      const taps = calibrando ? calibrando.taps : [];
      calibrando = null;
      bEmpezar.classList.remove("hidden");
      bEmpezar.textContent = "Repetir";
      if (taps.length < 6) {
        txt.textContent = `Solo llegué a oír ${taps.length} toques de 10. Prueba otra vez, tocando al ritmo de los tics.`;
        bAplicar.classList.add("hidden");
        return;
      }
      const ordenados = taps.map(x => x.delta).sort((a, b) => a - b);
      const mediana = ordenados[Math.floor(ordenados.length / 2)];
      // Lo que se oye llega un poco después de lo que marca el reloj del audio
      const ms = Math.round((((mediana - ((audio && audio.outputLatency) || 0)) * 1000)) / 5) * 5;
      resultado = Math.max(-200, Math.min(200, ms));
      txt.textContent = `Sueles tocar ${Math.abs(ms)} ms ${ms >= 0 ? "después de" : "antes de"} cada tic. Se ajustará la sincronía a ${resultado > 0 ? "+" : ""}${resultado} ms.`;
      bAplicar.classList.remove("hidden");
    }

    async function empezar() {
      await prepararAudio();
      resultado = null;
      bAplicar.classList.add("hidden");
      bEmpezar.classList.add("hidden");
      const periodo = 0.6;
      const n = 10;
      const t0 = audio.currentTime + 1.5;
      for (let i = 0; i < n; i++) {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = i % 4 === 0 ? 1200 : 880;
        g.gain.setValueAtTime(0.35, t0 + i * periodo);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * periodo + 0.06);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + i * periodo); o.stop(t0 + i * periodo + 0.08);
      }
      calibrando = { t0, periodo, n, taps: [] };
      txt.textContent = "Escucha... y toca con cada tic.";
      pintarPuntos();
      clearTimeout(temporizador);
      temporizador = setTimeout(terminar, (t0 + n * periodo + 0.7 - audio.currentTime) * 1000);
    }

    document.getElementById("rtCalibrar").addEventListener("click", () => {
      modal.classList.remove("hidden");
      calibrando = null;
      resultado = null;
      bEmpezar.textContent = "Empezar";
      bEmpezar.classList.remove("hidden");
      bAplicar.classList.add("hidden");
      txt.textContent = "Suenan 10 tics. Toca cualquier tecla, o la pantalla, justo cuando oigas cada uno.";
      pintarPuntos();
    });
    bEmpezar.addEventListener("click", empezar);
    bAplicar.addEventListener("click", () => {
      if (resultado === null) return;
      ajustes.desfase = resultado;
      guardarAjustes();
      pintarMenu();
      modal.classList.add("hidden");
    });
    document.getElementById("rtCalibracionCerrar").addEventListener("click", () => {
      clearTimeout(temporizador);
      calibrando = null;
      modal.classList.add("hidden");
    });
    modal.addEventListener("pointerdown", ev => { if (calibrando && !ev.target.closest("button")) tocarCalibracion(ev); });
  }

  /* Si un DJ le cambia el nombre a una canción, el menú lo muestra al momento */
  window.addEventListener("musica-nombres", () => {
    canciones.forEach(c => { if (c.ruta) Object.assign(c, cancionDe(c.ruta)); });
    pintarMenu();
  });

  /* Canciones que suben los DJ a la rocola: se suman a la lista en cuanto llegan */
  window.addEventListener("musica-nube", ev => {
    const nuevas = (ev.detail && ev.detail.nuevas) || [];
    const quitadas = (ev.detail && ev.detail.quitadas) || [];
    let cambiadas = false;
    quitadas.forEach(ruta => {
      const i = canciones.findIndex(c => c.ruta === ruta);
      if (i < 0) return;
      canciones.splice(i, 1);
      cambiadas = true;
    });
    if (cambiadas) {
      if (!canciones.length) canciones.push({ ruta: "", nombre: "No hay canciones", titulo: "No hay canciones", artista: "", dur: 0 });
      const k = canciones.findIndex(c => c.ruta === ajustes.ruta);
      ajustes.cancion = k >= 0 ? k : 0;
      ajustes.ruta = canciones[ajustes.cancion].ruta;
    }
    nuevas.forEach(ruta => {
      if (canciones.some(c => c.ruta === ruta)) return;
      Object.assign(duraciones, window.MUSICA_NUBE_DURACIONES);
      const c = cancionDe(ruta);
      if (c.dur && c.dur > LIMITE_S) return;
      if (canciones.length === 1 && !canciones[0].ruta) canciones.length = 0;
      canciones.push(c);
      cambiadas = true;
    });
    if (cambiadas) pintarMenu();
  });

  /* Botón del editor de mapas: solo para Admin y DJ */
  {
    const botonEditor = document.getElementById("rtAbrirEditor");
    if (botonEditor) {
      if (window.RitmoRol) botonEditor.classList.toggle("hidden", !RitmoRol.cacheado());
      if (window.RitmoRol) RitmoRol.verificar().then(r => botonEditor.classList.toggle("hidden", !r.puede));
    }
  }
  jugarEl.addEventListener("click", empezar);

  /* Buzón: la petición se guarda en la misma tabla de peticiones del sitio, marcada
     como canción, y el admin la ve en su pestaña de Peticiones. */
  const buzonForm = document.getElementById("rtBuzonForm");
  const buzonEstadoEl = document.getElementById("rtBuzonEstado");
  const buzonNombreEl = document.getElementById("rtBuzonNombre");
  try { buzonNombreEl.value = localStorage.getItem("compendioRitmoNombre") || ""; } catch (e) { /* sin almacenamiento */ }
  document.getElementById("rtAbrirBuzon").addEventListener("click", () => {
    buzonEstadoEl.textContent = "";
    mostrar(buzonEl);
  });
  document.getElementById("rtBuzonVolver").addEventListener("click", () => mostrar(menuEl));
  buzonForm.addEventListener("submit", async ev => {
    ev.preventDefault();
    const cancion = document.getElementById("rtBuzonCancion").value.trim();
    const enlace = document.getElementById("rtBuzonEnlace").value.trim();
    const nombre = buzonNombreEl.value.trim();
    if (!cancion) return;
    const boton = document.getElementById("rtBuzonEnviar");
    boton.disabled = true;
    buzonEstadoEl.textContent = "Enviando...";
    try {
      await enviarPeticion({ texto: "[Canción para Zarabanda] " + cancion + (enlace ? "\n" + enlace : ""), nombre });
      try { localStorage.setItem("compendioRitmoNombre", nombre); } catch (e) { /* sin almacenamiento */ }
      document.getElementById("rtBuzonCancion").value = "";
      document.getElementById("rtBuzonEnlace").value = "";
      buzonEstadoEl.textContent = "Enviada. Gracias.";
    } catch (err) {
      buzonEstadoEl.textContent = "No se pudo enviar. Prueba de nuevo en un rato.";
    } finally {
      boton.disabled = false;
    }
  });
  document.getElementById("rtReintentar").addEventListener("click", empezar);
  document.getElementById("rtVolver").addEventListener("click", salir);
  document.getElementById("rtContinuar").addEventListener("click", continuar);
  document.getElementById("rtSalir").addEventListener("click", salir);
  window.addEventListener("resize", () => { if (estado !== "jugando") dibujar(tiempoCancion()); });

  pintarMenu();
  dibujar(0);

  if (/[?&]debug\b/.test(location.search)) {
    window.__ritmo = {
      crearMapa, DIFICULTADES, subirPuntaje, forzarFin: () => { estado = "fin"; mostrar(finEl); },
      estado: () => ({ estado, puntos, combo, perfectos, buenos, fallos, extras, vida, notas: notas.length, activas: activas.length }),
      entradas,
      tick: t => { actualizar(t); dibujar(t); },
      golpear, notas: () => notas, tiempo: tiempoCancion,
      forzarTiempo: f => { tiempoCancion = f; }
    };
  }
})();
