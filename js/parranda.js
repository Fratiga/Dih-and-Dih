/* Parranda: el juego hermano de Zarabanda. Cuatro carriles que caen desde arriba, con tema de rock.
   Comparte la rocola, el análisis de la canción y el rol DJ con Zarabanda, pero tiene sus propios
   mapas, puntajes y editor. Los carriles no son de ningún instrumento: cada mapa decide qué sigue.
   El reloj del juego es el del audio, así que la música y las notas no se separan aunque la
   imagen se trabe. Campo de tamaño lógico fijo (960x540), igual que el resto de minijuegos. */
(function () {
  "use strict";

  const W = 960;
  const H = 540;
  const Y_GOLPE = 440;
  const RECORRIDO = Y_GOLPE + 50;
  const X0 = 300; // borde izquierdo de la pista
  const ANCHO = 90; // ancho de cada carril
  const CLAVE_RECORDS = "compendioParrandaRecords";
  const CLAVE_AJUSTES = "compendioParrandaAjustes";
  // El análisis (tempo, pulso, notas) vive en parranda-analisis.js y lo comparte el editor de mapas
  const { HOP, DIFICULTADES, crearMapa, desdeGuardado } = window.ParrandaAnalisis;

  /* hz: la nota que suena al pulsar el carril (cuartas: la, re, sol, do) */
  const CARRILES = [
    { color: "#ff3b3b", rgb: "255, 59, 59", etiqueta: "D", hz: 110 },
    { color: "#ffa51f", rgb: "255, 165, 31", etiqueta: "F", hz: 146.8 },
    { color: "#ffe14d", rgb: "255, 225, 77", etiqueta: "J", hz: 196 },
    { color: "#55d6ff", rgb: "85, 214, 255", etiqueta: "K", hz: 261.6 }
  ];
  const xCarril = c => X0 + ANCHO * c + ANCHO / 2;
  let TECLAS = {};
  const TECLAS_BASE = [["d", ""], ["f", ""], ["j", ""], ["k", ""]];

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
  let ajustes = { desfase: 0, practica: false, dificultad: "normal", cancion: 0, ruta: "", personaje: true, multitud: true, rayos: true, teclas: null, sonidoGolpe: true, avatar: { cuerpo: "verde", accesorio: "ninguno" }, multi: { tono: "rojo", cantidad: 2, luces: "encendedores" } };
  try { records = JSON.parse(localStorage.getItem(CLAVE_RECORDS) || "{}") || {}; } catch (e) { records = {}; }
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}")); } catch (e) { /* sin almacenamiento */ }
  function guardarAjustes() { try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin almacenamiento */ } }
  /* --- Teclas de cada carril: dos casillas por carril (las flechas siempre valen) --- */
  function teclasActuales() {
    const t = Array.isArray(ajustes.teclas) && ajustes.teclas.length === 4 ? ajustes.teclas : TECLAS_BASE;
    return [0, 1, 2, 3].map(c => [0, 1].map(i => (t[c] && t[c][i] ? String(t[c][i]).toLowerCase() : "")));
  }
  function construirTeclas() {
    const t = teclasActuales();
    TECLAS = { arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 };
    t.forEach((par, c) => par.forEach(k => { if (k) TECLAS[k] = c; }));
    CARRILES.forEach((c, i) => { c.etiqueta = t[i].filter(Boolean).map(k => k.toUpperCase()).join("/") || ["←", "↓", "↑", "→"][i]; });
  }
  function guardarRecords() { try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(records)); } catch (e) { /* sin almacenamiento */ } }

  /* Solo entran canciones de hasta 8 minutos: más largas dan mapas enormes y tardan en analizarse.
     Las duraciones salen de data/musica-duraciones.js; si una canción no está ahí se mide al
     cargarla (ver cargarCancion). */
  const LIMITE_S = 480;
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
  let entradas = [new Set(), new Set(), new Set(), new Set()]; // teclas o dedos pulsados por carril
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
  let fiebre = false; // con un combo de 30 empieza la fiebre: doble puntaje hasta que falles
  let celebracion = null; // { tipo, desde, ultimoFuego, dur } mientras la multitud reacciona al final
  let particulas = [];
  let ultimoDibujo = 0;
  let rafFin = 0;
  let temporizadorFin = 0;
  let avatar = { salto: -10, golpe: -10 };
  let flash = [-10, -10, -10, -10];
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
      const pr = JSON.parse(localStorage.getItem("parrandaPrueba") || "null");
      if (/[?&]prueba\b/.test(location.search) && pr && pr.ruta === ruta && pr.dificultad === dificultad) return { mapa: pr.mapa, version: "prueba" };
    } catch (e) { /* sin almacenamiento */ }
    try {
      if (typeof fichasCliente !== "function") return null;
      const supabase = await fichasCliente();
      const consulta = supabase.from("parranda_mapas").select("mapa, actualizado").eq("cancion", ruta).eq("dificultad", dificultad).maybeSingle();
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
        // Dura más de 8 minutos: se quita de la lista sin más
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
    fiebre = false; celebracion = null; particulas = [];
    clearTimeout(temporizadorFin); cancelAnimationFrame(rafFin);
    avatar = { salto: -10, golpe: -10 };
    flash = [-10, -10, -10, -10];
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
    cancelAnimationFrame(rafFin);
    clearTimeout(temporizadorFin);
    celebracion = null; particulas = []; fiebre = false;
    cargaId++;
    if (audio && audio.state === "suspended") audio.resume();
    estado = "menu";
    mostrar(menuEl);
    pintarMenu();
    dibujar(0);
  }

  /* --- Golpes ------------------------------------------------------------- */
  function limpiarEntradas() { entradas.forEach(e => e.clear()); }

  function multiplicador() { return (1 + Math.min(combo, 150) / 50) * (fiebre ? 2 : 1); }

  function sumar(juicio, carril, peso = 1) {
    const x = xCarril(carril);
    avatar.golpe = ahoraS();
    flash[carril] = ahoraS();
    if (juicio === "perfecto") {
      perfectos++; combo++;
      puntos += Math.round(300 * peso * multiplicador());
      vida = Math.min(100, vida + 1);
      efectos.push({ x, y: Y_GOLPE - 70, texto: "PERFECTO", color: "#ffe14d", t: ahoraS() });
    } else if (juicio === "bien") {
      buenos++; combo++;
      puntos += Math.round(100 * peso * multiplicador());
      efectos.push({ x, y: Y_GOLPE - 70, texto: "BIEN", color: "#f4efe6", t: ahoraS() });
    } else {
      fallos++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x, y: Y_GOLPE - 70, texto: "FALLO", color: "#ff6b6b", t: ahoraS() });
    }
    comboMax = Math.max(comboMax, combo);
    // La fiebre empieza con un combo de 30 y dura hasta el primer fallo
    if (juicio === "fallo" && fiebre) {
      fiebre = false;
      efectos.push({ x: W / 2, y: 150, texto: "SE ACABÓ LA FIEBRE", color: "#a58f89", t: ahoraS() });
    } else if (!fiebre && combo >= 30) {
      fiebre = true;
      efectos.push({ x: W / 2, y: 150, texto: "¡FIEBRE! PUNTOS x2", color: "#ffd84d", t: ahoraS() });
    }
  }

  /* Un toque suave por cada pulsación, con una nota distinta en cada carril, para oír el ritmo que
     estás tocando sin tapar la canción. Si no había nota, casi no se oye. */
  function sonidoGolpe(carril, acierto) {
    if (ajustes.sonidoGolpe === false || !audio || audio.state !== "running") return;
    const t0 = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "sine";
    o.frequency.value = acierto ? CARRILES[carril].hz * 3 : 150;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(acierto ? 0.05 : 0.02, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (acierto ? 0.08 : 0.05));
    o.connect(g); g.connect(audio.destination);
    o.start(t0); o.stop(t0 + 0.1);
  }

  function golpear(carril, t) {
    flash[carril] = ahoraS();
    avatar.salto = ahoraS();
    // Con una larga en curso en este carril, otra pulsación no cuenta
    if (activas.some(n => n.carril === carril)) return;
    let mejor = null;
    for (let i = punteroFallos; i < notas.length; i++) {
      const n = notas[i];
      if (n.t > t + cfg.bien) break;
      if (n.estado || n.carril !== carril) continue;
      const dt = Math.abs(n.t - t);
      if (dt <= cfg.bien && (!mejor || dt < Math.abs(mejor.t - t))) mejor = n;
    }
    if (!mejor) {
      sonidoGolpe(carril, false);
      // Pulsar sin nota a tiro cuenta como fallo: corta el combo y quita vida
      extras++; combo = 0; fiebre = false;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x: xCarril(carril), y: Y_GOLPE - 70, texto: "FALLO", color: "#ff6b6b", t: ahoraS() });
      return;
    }
    const juicio = Math.abs(mejor.t - t) <= cfg.perfecto ? "perfecto" : "bien";
    sonidoGolpe(carril, true);
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
        t.forEach(par => par.forEach((x, i) => { if (x === k) par[i] = ""; }));
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
    if (carril === undefined) return;
    if (estado === "jugando") {
      ev.preventDefault();
      if (ev.repeat) return;
      entradas[carril].add("k" + ev.key.toLowerCase());
      golpear(carril, tiempoDeEvento(ev));
    }
  });

  window.addEventListener("keyup", ev => {
    const carril = TECLAS[ev.key.toLowerCase()];
    if (carril !== undefined) entradas[carril].delete("k" + ev.key.toLowerCase());
  });

  // En pantalla táctil o con ratón: el carril es el de la columna donde se toca (fuera de la pista,
  // el más cercano)
  canvas.addEventListener("pointerdown", ev => {
    if (estado !== "jugando") return;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const carril = Math.max(0, Math.min(3, Math.floor((x - X0) / ANCHO)));
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    entradas[carril].add("p" + ev.pointerId);
    golpear(carril, tiempoDeEvento(ev));
  });
  const soltarDedo = ev => { entradas.forEach(e => e.delete("p" + ev.pointerId)); };
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
        efectos.push({ x: xCarril(n.carril), y: Y_GOLPE - 110, texto: "PERFECTO", color: "#ffe14d", t: ahoraS() });
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
      await supa.rpc("parranda_registrar_fallos", { p_cancion: cancionActual.ruta, p_dificultad: ajustes.dificultad, p_version: versionJugada, p_fallos: lista, p_alcanzo: alcanzo });
    } catch (e) { /* sin estadísticas */ }
  }

  function rangoDe(acc) {
    return acc >= 0.95 ? "S" : acc >= 0.88 ? "A" : acc >= 0.75 ? "B" : acc >= 0.6 ? "C" : "D";
  }

  /* Al acabar, la multitud reacciona unos segundos antes de que salga el resumen: ovación con fuegos
     artificiales (rango S o A), aplauso (B o C), murmullo (D) o abucheo (te quedaste sin vida). Si la
     multitud está desactivada, el resumen sale enseguida. */
  function iniciarCelebracion(tipo) {
    clearTimeout(temporizadorFin);
    cancelAnimationFrame(rafFin);
    particulas = [];
    if (ajustes.multitud === false) { celebracion = null; mostrar(finEl); return; }
    const dur = tipo === "ovacion" ? 3.4 : tipo === "abucheo" ? 2.2 : 2.4;
    const desde = ahoraS();
    celebracion = { tipo, desde, ultimoFuego: 0, dur };
    aplauso(tipo, dur);
    const bucleFin = () => {
      if (!celebracion || celebracion.desde !== desde || estado !== "fin") return;
      dibujar(tiempoCancion());
      rafFin = requestAnimationFrame(bucleFin);
    };
    rafFin = requestAnimationFrame(bucleFin);
    // El temporizador manda: aunque la pestaña esté oculta, el resumen acaba saliendo
    temporizadorFin = setTimeout(() => {
      if (!celebracion || celebracion.desde !== desde) return;
      cancelAnimationFrame(rafFin);
      celebracion = null;
      particulas = [];
      if (estado === "fin") mostrar(finEl);
    }, dur * 1000);
  }

  /* Aplauso: ruido filtrado con golpecitos de volumen al azar. Muy suave, y solo si los sonidos están
     activados. El murmullo y el abucheo no suenan. */
  function aplauso(tipo, dur) {
    if (ajustes.sonidoGolpe === false || !audio || audio.state !== "running" || tipo === "murmullo" || tipo === "abucheo") return;
    const n = Math.floor(audio.sampleRate * dur);
    const buf = audio.createBuffer(1, n, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const fuenteRuido = audio.createBufferSource();
    fuenteRuido.buffer = buf;
    const filtro = audio.createBiquadFilter();
    filtro.type = "bandpass"; filtro.frequency.value = 2200; filtro.Q.value = 0.6;
    const g = audio.createGain();
    const t0 = audio.currentTime;
    const pico = tipo === "ovacion" ? 0.07 : 0.045;
    g.gain.setValueAtTime(0.0001, t0);
    const golpes = Math.floor(dur * 14);
    for (let k = 0; k < golpes; k++) {
      const t = t0 + (k / golpes) * dur;
      const envolvente = Math.min(1, k / 4) * Math.min(1, (golpes - k) / 6);
      g.gain.linearRampToValueAtTime(pico * envolvente * (0.3 + Math.random() * 0.7), t + 0.02);
      g.gain.linearRampToValueAtTime(pico * envolvente * 0.15, t + 0.06);
    }
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    fuenteRuido.connect(filtro); filtro.connect(g); g.connect(audio.destination);
    fuenteRuido.start(t0); fuenteRuido.stop(t0 + dur);
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
    iniciarCelebracion(!completa ? "abucheo" : rango === "S" || rango === "A" ? "ovacion" : rango === "D" ? "murmullo" : "aplauso");
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

  /* Cada carril tiene su forma además de su color (círculo, rombo, cuadrado y hexágono), así se
     distinguen sin depender del color. */
  function trazarForma(carril, x, y, r) {
    ctxC.beginPath();
    if (carril === 0) {
      ctxC.arc(x, y, r, 0, Math.PI * 2);
    } else if (carril === 1) {
      ctxC.moveTo(x, y - r - 4); ctxC.lineTo(x + r + 4, y); ctxC.lineTo(x, y + r + 4); ctxC.lineTo(x - r - 4, y); ctxC.closePath();
    } else if (carril === 2) {
      const a = r * 0.88;
      ctxC.rect(x - a, y - a, a * 2, a * 2);
    } else {
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3 + Math.PI / 6;
        ctxC.lineTo(x + Math.cos(ang) * (r + 2), y + Math.sin(ang) * (r + 2));
      }
      ctxC.closePath();
    }
  }

  function dibujarForma(carril, x, y, alfa) {
    ctxC.globalAlpha = alfa;
    ctxC.fillStyle = CARRILES[carril].color;
    ctxC.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctxC.lineWidth = 4;
    ctxC.lineJoin = "round";
    trazarForma(carril, x, y, 23);
    ctxC.fill();
    ctxC.stroke();
    ctxC.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctxC.beginPath(); ctxC.arc(x - 7, y - 8, 5, 0, Math.PI * 2); ctxC.fill();
    ctxC.globalAlpha = 1;
  }

  /* Una nota: su forma; la larga lleva una barra hacia arriba hasta donde termina (yCola). */
  function dibujarNota(n, y, alfa, yCola) {
    const x = xCarril(n.carril);
    if (yCola !== undefined && yCola < y) {
      const arriba = Math.max(yCola, -40);
      ctxC.globalAlpha = alfa * 0.55;
      ctxC.fillStyle = CARRILES[n.carril].color;
      ctxC.fillRect(x - 14, arriba, 28, y - arriba);
      ctxC.globalAlpha = alfa;
      if (yCola >= -40) topeDeLarga(x, yCola, CARRILES[n.carril].color);
      ctxC.globalAlpha = 1;
    }
    dibujarForma(n.carril, x, y, alfa);
  }

  /* El final de una larga: un círculo blanco con un cuadrado dentro. Ahí se suelta. */
  function topeDeLarga(x, y, color) {
    ctxC.fillStyle = color;
    ctxC.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctxC.lineWidth = 3.5;
    ctxC.beginPath(); ctxC.arc(x, y, 16, 0, Math.PI * 2); ctxC.fill(); ctxC.stroke();
    ctxC.fillStyle = "rgba(255, 255, 255, 0.9)";
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

  /* --- Tu personaje y la multitud, personalizables ---------------------------------------------------
     El personaje se dibuja en cada fotograma (es uno solo). Los fans, en cambio, se dibujan una vez en
     un lienzo pequeño ("sprite") y después solo se copian: así 40 fans cuestan casi lo mismo que 4. Los
     brazos, las manos y las luces se pintan en tandas, un trazo por fila y no uno por fan. */
  const CUERPOS = {
    verde: ["#7ed87f", "#2e6e32"], rosa: ["#ff8fc7", "#8a2f5f"], azul: ["#7ab8ff", "#27508f"],
    amarillo: ["#ffe36b", "#8a6f12"], morado: ["#c49aff", "#5a3a9a"], naranja: ["#ffa24d", "#8a4510"],
    rojo: ["#ff6b6b", "#8a1c1c"], blanco: ["#f4efe6", "#8d8579"], negro: ["#3a3a46", "#101018"]
  };
  const ACCESORIOS = { ninguno: "Nada", gorra: "Gorra", gafas: "Gafas", cresta: "Cresta", diadema: "Diadema", corona: "Corona" };
  const PALETAS_MULTI = {
    rojo: ["#33171b", "#4a2025", "#662a30"], azul: ["#17202f", "#203049", "#2c4468"],
    verde: ["#16281b", "#1f3a27", "#2a5236"], violeta: ["#25172f", "#35204a", "#4a2c66"]
  };
  const NOMBRES_TONO = ["rojo", "azul", "verde", "violeta", "mixto"];
  const FILAS_MULTI = [{ y: 345, esc: 0.72 }, { y: 405, esc: 0.88 }, { y: 470, esc: 1.04 }];
  const CANTIDADES = { 1: [4, 3, 3], 2: [6, 5, 4], 3: [8, 7, 6] };

  function personalAvatar() {
    const a = ajustes.avatar || {};
    return { cuerpo: CUERPOS[a.cuerpo] ? a.cuerpo : "verde", accesorio: ACCESORIOS[a.accesorio] ? a.accesorio : "ninguno" };
  }
  function personalMulti() {
    const m = ajustes.multi || {};
    return {
      tono: NOMBRES_TONO.includes(m.tono) ? m.tono : "rojo",
      cantidad: CANTIDADES[m.cantidad] ? Number(m.cantidad) : 2,
      luces: ["encendedores", "varitas", "ninguna"].includes(m.luces) ? m.luces : "encendedores"
    };
  }

  /* El slime de tu color con su accesorio, centrado en (0, 0) del lienzo c (que ya está trasladado) */
  function trazarPersonaje(c, golpe) {
    const p = personalAvatar();
    const [relleno, borde] = CUERPOS[p.cuerpo];
    c.fillStyle = relleno; c.strokeStyle = borde; c.lineWidth = 4;
    c.beginPath(); c.ellipse(0, 0, 40, 33, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    const ojos = p.cuerpo === "negro" ? "#f4efe6" : "#12330f";
    c.fillStyle = ojos;
    c.beginPath(); c.arc(-12, -6, 5, 0, Math.PI * 2); c.arc(12, -6, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = ojos; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 6, golpe > 0 ? 9 : 6, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
    if (p.accesorio === "gorra") {
      c.fillStyle = "#ff3b3b"; c.strokeStyle = "#7a0f0f"; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, -22, 30, 17, 0, Math.PI, Math.PI * 2); c.fill(); c.stroke();
      c.fillRect(-4, -23, 40, 6); c.strokeRect(-4, -23, 40, 6);
    } else if (p.accesorio === "gafas") {
      c.fillStyle = "#101018"; c.strokeStyle = "#101018"; c.lineWidth = 3;
      c.fillRect(-24, -14, 20, 13); c.fillRect(4, -14, 20, 13);
      c.beginPath(); c.moveTo(-4, -9); c.lineTo(4, -9); c.stroke();
      c.fillStyle = "rgba(255, 255, 255, 0.5)"; c.fillRect(-21, -12, 6, 3); c.fillRect(7, -12, 6, 3);
    } else if (p.accesorio === "cresta") {
      c.fillStyle = "#ff3b3b"; c.strokeStyle = "#7a0f0f"; c.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const x = i * 9;
        c.beginPath(); c.moveTo(x - 5, -29 + Math.abs(i) * 4); c.lineTo(x, -50 + Math.abs(i) * 8); c.lineTo(x + 5, -29 + Math.abs(i) * 4); c.closePath(); c.fill(); c.stroke();
      }
    } else if (p.accesorio === "diadema") {
      c.strokeStyle = "#ffe14d"; c.lineWidth = 6; c.lineCap = "round";
      c.beginPath(); c.arc(0, -4, 36, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
    } else if (p.accesorio === "corona") {
      c.fillStyle = "#ffd84d"; c.strokeStyle = "#8a6f12"; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-18, -28); c.lineTo(-18, -46); c.lineTo(-9, -37); c.lineTo(0, -50); c.lineTo(9, -37); c.lineTo(18, -46); c.lineTo(18, -28); c.closePath(); c.fill(); c.stroke();
    }
  }

  function dibujarAvatar(ahora) {
    if (ajustes.personaje === false) return;
    const salto = Math.max(0, 1 - (ahora - avatar.salto) / 0.22);
    const golpe = Math.max(0, 1 - (ahora - avatar.golpe) / 0.2);
    const x = 150;
    const y = 438 - Math.sin(salto * Math.PI) * 30;
    const estira = 1 + golpe * 0.18;
    ctxC.save();
    ctxC.translate(x, y);
    ctxC.scale(1 / estira, estira);
    if (fotoImg) {
      // La foto (ya circular) reemplaza al slime, con el mismo salto
      ctxC.drawImage(fotoImg, -42, -42, 84, 84);
    } else {
      trazarPersonaje(ctxC, golpe);
    }
    ctxC.restore();
  }

  /* Un fan (cuerpo, cabeza y peinado) dibujado una sola vez a doble resolución */
  const sprites = new Map();
  function spriteFan(paleta, fila, tipo) {
    const clave = paleta + "|" + fila + "|" + tipo;
    let sp = sprites.get(clave);
    if (sp) return sp;
    const esc = FILAS_MULTI[fila].esc;
    const ancho = 60;
    const alto = 82;
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho * 2 * esc;
    lienzo.height = alto * 2 * esc;
    const c = lienzo.getContext("2d");
    c.scale(2 * esc, 2 * esc);
    // El punto (x, y) del fan queda en (30, 60) del sprite
    c.translate(30, 60);
    c.fillStyle = PALETAS_MULTI[paleta][fila];
    c.beginPath(); c.ellipse(0, 0, 17, 23, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0, -31, 11, 0, Math.PI * 2); c.fill();
    if (tipo === 1) {
      c.beginPath(); c.moveTo(-4, -40); c.lineTo(0, -55); c.lineTo(4, -40); c.closePath(); c.fill();
    } else if (tipo === 2) {
      c.beginPath(); c.ellipse(0, -25, 15, 17, 0, 0, Math.PI * 2); c.fill();
    }
    sp = { lienzo, ancho: ancho * esc, alto: alto * esc, ox: 30 * esc, oy: 60 * esc };
    sprites.set(clave, sp);
    return sp;
  }

  /* Posiciones fijas (salen de un generador con semilla): no cambian entre partidas */
  let fans = [];
  function reconstruirMultitud() {
    const m = personalMulti();
    const paletas = Object.keys(PALETAS_MULTI);
    let semilla = 20261;
    const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
    fans = [];
    [[22, 282], [678, 938]].forEach(([x0, x1]) => {
      FILAS_MULTI.forEach((f, fi) => {
        const n = CANTIDADES[m.cantidad][fi];
        for (let i = 0; i < n; i++) {
          const x = x0 + ((i + 0.5 + (azar() - 0.5) * 0.5) / n) * (x1 - x0);
          // En primera fila a la izquierda queda sitio para el personaje del jugador
          if (fi === 2 && x0 === 22 && Math.abs(x - 150) < 62) continue;
          const tipo = Math.floor(azar() * 3);
          const paleta = m.tono === "mixto" ? paletas[Math.floor(azar() * paletas.length)] : m.tono;
          fans.push({ x, y: f.y + (azar() - 0.5) * 10, esc: 0.92 + azar() * 0.16, fila: fi, sprite: spriteFan(paleta, fi, tipo), paleta, fase: azar() * Math.PI * 2, tipo, ritmo: 4 + azar() * 3, color: Math.floor(azar() * 4) });
        }
      });
    });
  }
  reconstruirMultitud();

  /* La multitud: rebota con el pulso de la canción, salta cuando aciertas, levanta los brazos con un
     combo alto y saca luces con uno muy alto. Con la vida baja se desinfla. */
  function dibujarMultitud(c, ahora, pulso, energia, golpe, luces, desinflada) {
    const m = personalMulti();
    c.globalAlpha = 0.88 + 0.12 * pulso;
    for (let i = 0; i < fans.length; i++) {
      const f = fans[i];
      const bote = pulso * 9 * f.esc * energia + golpe * (6 + (f.fase % 3) * 3) * f.esc * energia + Math.sin(ahora * f.ritmo + f.fase) * 1.6 * energia;
      f.yy = f.y - bote + (desinflada ? 7 * f.esc : 0);
      const sp = f.sprite;
      c.drawImage(sp.lienzo, f.x - sp.ox, f.yy - sp.oy, sp.ancho, sp.alto);
    }
    c.globalAlpha = 1;
    if (energia <= 0.45) return;
    // Brazos y manos, un trazo por fila y por paleta
    c.lineCap = "round";
    const tandas = new Map();
    for (let i = 0; i < fans.length; i++) {
      const f = fans[i];
      const clave = f.fila + "|" + f.paleta;
      let t = tandas.get(clave);
      if (!t) { t = { f, lista: [] }; tandas.set(clave, t); }
      t.lista.push(f);
    }
    tandas.forEach(t => {
      const esc = FILAS_MULTI[t.f.fila].esc;
      c.strokeStyle = c.fillStyle = PALETAS_MULTI[t.f.paleta][t.f.fila];
      c.lineWidth = 5.5 * esc;
      c.beginPath();
      t.lista.forEach(f => {
        const s = f.esc;
        const onda = Math.sin(ahora * f.ritmo * 1.3 + f.fase) * 7 * s;
        for (let lado = -1; lado <= 1; lado += 2) {
          const hx = f.x + lado * (24 * s + (f.tipo === 1 ? 4 * s : 0)) + onda * lado;
          const hy = f.yy - 52 * s - golpe * 8 * s;
          c.moveTo(f.x + lado * 13 * s, f.yy - 8 * s); c.lineTo(hx, hy);
        }
      });
      c.stroke();
      c.beginPath();
      t.lista.forEach(f => {
        const s = f.esc;
        const onda = Math.sin(ahora * f.ritmo * 1.3 + f.fase) * 7 * s;
        for (let lado = -1; lado <= 1; lado += 2) {
          const hx = f.x + lado * (24 * s + (f.tipo === 1 ? 4 * s : 0)) + onda * lado;
          const hy = f.yy - 52 * s - golpe * 8 * s;
          c.moveTo(hx + 4.5 * s, hy); c.arc(hx, hy, 4.5 * s, 0, Math.PI * 2);
        }
      });
      c.fill();
    });
    // Luces en primera fila con un combo muy alto
    if (luces && m.luces !== "ninguna") {
      for (let i = 0; i < fans.length; i++) {
        const f = fans[i];
        if (f.fila !== 2) continue;
        const s = f.esc;
        const lado = f.tipo === 0 ? -1 : 1;
        const onda = Math.sin(ahora * f.ritmo * 1.3 + f.fase) * 7 * s;
        const hx = f.x + lado * (24 * s + (f.tipo === 1 ? 4 * s : 0)) + onda * lado;
        const hy = f.yy - 52 * s - golpe * 8 * s;
        if (m.luces === "encendedores") {
          c.fillStyle = "rgba(255, 225, 77, 0.22)"; c.beginPath(); c.arc(hx, hy - 7 * s, 12 * s, 0, Math.PI * 2); c.fill();
          c.fillStyle = "rgba(255, 225, 77, 0.95)"; c.beginPath(); c.arc(hx, hy - 7 * s, 4 * s, 0, Math.PI * 2); c.fill();
        } else {
          c.strokeStyle = CARRILES[f.color].color; c.lineWidth = 5 * s;
          c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + onda * 0.8, hy - 20 * s); c.stroke();
        }
      }
    }
  }

  function pintarMultitud(ahora, pulso) {
    if (ajustes.multitud === false) return;
    let baja = vida < 35 && estado !== "menu" && !celebracion;
    let energia = baja ? 0.12 : fiebre ? 1 : Math.min(1, 0.3 + combo / 40);
    let golpe = Math.max(0, 1 - (ahora - avatar.golpe) / 0.3);
    let luces = (combo >= 50 || fiebre) && !baja;
    if (celebracion) {
      const k = celebracion.tipo;
      baja = k === "abucheo";
      energia = k === "ovacion" ? 1 : k === "aplauso" ? 0.8 : k === "murmullo" ? 0.35 : 0.1;
      golpe = k === "ovacion" ? 0.5 + 0.5 * Math.pow(Math.sin(ahora * 9), 2) : 0;
      luces = k === "ovacion";
    }
    dibujarMultitud(ctxC, ahora, pulso, energia, golpe, luces, baja);
  }

  /* Rayos de luz de escenario: cuatro haces que bajan del techo y se balancean, más fuertes con cada
     pulso (y cambiando de color durante la fiebre). Los degradados se crean una sola vez. */
  const RAYOS = [{ x: 90, ang: 0.35, col: 0 }, { x: 330, ang: -0.2, col: 1 }, { x: 630, ang: 0.2, col: 2 }, { x: 870, ang: -0.35, col: 3 }];
  let degradados = null;
  function dibujarRayos(ahora, pulso) {
    if (ajustes.rayos === false) return;
    if (!degradados) {
      degradados = CARRILES.map(c => {
        const g = ctxC.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(${c.rgb}, 0.55)`);
        g.addColorStop(1, `rgba(${c.rgb}, 0)`);
        return g;
      });
    }
    const fuerza = (0.25 + pulso * 0.55) * (fiebre ? 1.5 : 1) * (estado === "menu" ? 0.5 : 1);
    ctxC.globalAlpha = Math.min(0.55, fuerza * 0.5);
    const giro = fiebre ? Math.floor(ahora * 2) : 0;
    RAYOS.forEach((r, i) => {
      const base = r.x + Math.tan(r.ang + Math.sin(ahora * 0.7 + i * 1.7) * 0.28) * H;
      ctxC.fillStyle = degradados[(r.col + giro) % 4];
      ctxC.beginPath();
      ctxC.moveTo(r.x - 10, 0); ctxC.lineTo(r.x + 10, 0); ctxC.lineTo(base + 70, H); ctxC.lineTo(base - 70, H);
      ctxC.closePath();
      ctxC.fill();
    });
    ctxC.globalAlpha = 1;
  }

  /* Fuegos artificiales de la ovación: ráfagas de chispas con un poco de gravedad */
  function lanzarFuego(ahora) {
    const cx = 60 + Math.random() * 840;
    const cy = 70 + Math.random() * 160;
    const col = Math.floor(Math.random() * 4);
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 150;
      particulas.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: ahora, vida: 0.9 + Math.random() * 0.5, col });
    }
  }
  function dibujarParticulas(ahora, dt) {
    let vivas = 0;
    for (let i = 0; i < particulas.length; i++) {
      const p = particulas[i];
      const edad = ahora - p.t;
      if (edad > p.vida) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt;
      ctxC.globalAlpha = 1 - edad / p.vida;
      ctxC.fillStyle = CARRILES[p.col].color;
      ctxC.fillRect(p.x - 2, p.y - 2, 4, 4);
      particulas[vivas++] = p;
    }
    particulas.length = vivas;
    ctxC.globalAlpha = 1;
  }

  function dibujar(t) {
    ajustarCanvas();
    const ahora = ahoraS();
    const pulso = mapa && estado !== "menu" ? mapa.pulso[Math.max(0, Math.min(mapa.pulso.length - 1, Math.floor((t * mapa.sr) / HOP)))] || 0 : 0;

    // El resplandor que late con los graves es un div con degradado detrás del canvas: cambiar su
    // opacidad no cuesta nada, a diferencia de rellenar un degradado enorme en cada fotograma.
    ctxC.clearRect(0, 0, W, H);
    const brillo = (0.2 + pulso * 0.8).toFixed(2);
    if (brillo !== brilloPrevio) { brilloPrevio = brillo; brilloEl.style.opacity = brillo; }
    // El color del resplandor sigue al carril de la última nota que pasó
    let rgb = "255, 59, 59";
    if (estado !== "menu" && notas.length) {
      let q = Math.max(0, punteroFallos - 4);
      let ultima = null;
      while (q < notas.length && notas[q].t <= t + 0.03) { ultima = notas[q]; q++; }
      if (ultima && t - ultima.t < 1.2) rgb = CARRILES[ultima.carril].rgb;
    }
    if (rgb !== rgbPrevio) { rgbPrevio = rgb; brilloEl.style.setProperty("--brillo-rgb", rgb); }

    dibujarRayos(ahora, pulso);

    // La pista: fondo oscuro con borde rojo de neón (dorado en la fiebre) y los cuatro carriles
    const ancho = ANCHO * 4;
    ctxC.fillStyle = "rgba(8, 5, 6, 0.82)";
    ctxC.fillRect(X0, 0, ancho, H);
    ctxC.fillStyle = fiebre ? "rgba(255, 216, 77, 0.4)" : "rgba(255, 59, 59, 0.28)";
    ctxC.fillRect(X0 - 5, 0, 5, H);
    ctxC.fillRect(X0 + ancho, 0, 5, H);
    ctxC.fillStyle = fiebre ? "#ffd84d" : "#ff3b3b";
    ctxC.fillRect(X0 - 2, 0, 2, H);
    ctxC.fillRect(X0 + ancho, 0, 2, H);
    CARRILES.forEach((c, i) => {
      const f = Math.max(0, 1 - (ahora - flash[i]) / 0.18);
      const apretado = entradas[i].size > 0;
      ctxC.fillStyle = `rgba(${c.rgb}, ${(0.05 + f * 0.22 + (apretado ? 0.12 : 0)).toFixed(3)})`;
      ctxC.fillRect(X0 + i * ANCHO, 0, ANCHO, H);
      if (i > 0) {
        ctxC.fillStyle = "rgba(255, 255, 255, 0.07)";
        ctxC.fillRect(X0 + i * ANCHO - 1, 0, 2, H);
      }
    });

    if (estado === "jugando" || estado === "pausa" || estado === "fin") {
      // Guías del pulso: líneas horizontales que caen con las notas, más marcadas en cada compás
      if (mapa && mapa.pulsos && mapa.pulsos.length) {
        const ps = mapa.pulsos;
        let a = 0;
        let b = ps.length;
        while (a < b) { const m = (a + b) >> 1; if (ps[m] < t - 0.25) a = m + 1; else b = m; }
        ctxC.lineWidth = 2;
        for (let q = a; q < ps.length; q++) {
          const dtq = ps[q] - t;
          if (dtq > cfg.aproximacion) break;
          const y = Y_GOLPE - (dtq / cfg.aproximacion) * RECORRIDO;
          ctxC.strokeStyle = q % 4 === 0 ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.07)";
          ctxC.beginPath(); ctxC.moveTo(X0, y); ctxC.lineTo(X0 + ancho, y); ctxC.stroke();
        }
      }
    }

    // Aros de golpe y teclas
    CARRILES.forEach((c, i) => {
      const x = xCarril(i);
      const f = Math.max(0, 1 - (ahora - flash[i]) / 0.18);
      const apretado = entradas[i].size > 0;
      if (apretado || f > 0) {
        ctxC.fillStyle = `rgba(${c.rgb}, ${(0.18 + f * 0.3).toFixed(2)})`;
        ctxC.beginPath(); ctxC.arc(x, Y_GOLPE, 34 + f * 6, 0, Math.PI * 2); ctxC.fill();
      }
      ctxC.strokeStyle = c.color;
      ctxC.lineWidth = 3 + f * 3;
      ctxC.globalAlpha = 0.6 + f * 0.4;
      ctxC.beginPath(); ctxC.arc(x, Y_GOLPE, 32 + f * 6, 0, Math.PI * 2); ctxC.stroke();
      ctxC.globalAlpha = 1;
      ctxC.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctxC.font = "700 15px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(c.etiqueta, x, Y_GOLPE + 62);
    });

    if (estado === "jugando" || estado === "pausa" || estado === "fin") {
      // Notas
      for (let i = punteroFallos; i < notas.length; i++) {
        const n = notas[i];
        const dt = n.t - t;
        if (dt > cfg.aproximacion) break;
        if (n.estado === "perfecto" || n.estado === "bien") continue;
        const y = Y_GOLPE - (dt / cfg.aproximacion) * RECORRIDO;
        dibujarNota(n, y, 1, n.dur > 0 ? Y_GOLPE - ((n.t + n.dur - t) / cfg.aproximacion) * RECORRIDO : undefined);
      }
      // Largas que se están manteniendo: la cabeza se queda en el aro y la cola baja hacia él
      activas.forEach(n => {
        const x = xCarril(n.carril);
        const cola = Y_GOLPE - ((n.t + n.dur - t) / cfg.aproximacion) * RECORRIDO;
        const arriba = Math.max(cola, -40);
        ctxC.globalAlpha = 0.85;
        ctxC.fillStyle = CARRILES[n.carril].color;
        ctxC.fillRect(x - 14, arriba, 28, Y_GOLPE - arriba);
        ctxC.globalAlpha = 1;
        if (cola >= -40) topeDeLarga(x, Math.min(cola, Y_GOLPE), CARRILES[n.carril].color);
        // Mientras se mantiene, un texto recuerda que hay que seguir pulsando. Al llegar el círculo del
        // final al aro la larga se completa sola, así que no hay que "soltar" en un momento justo.
        ctxC.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctxC.font = "700 13px sans-serif";
        ctxC.textAlign = "center";
        if (t - n.t > 0.6) ctxC.fillText("MANTÉN", x, Y_GOLPE - 52);
      });
      // Notas ya falladas que se alejan
      for (let i = Math.max(0, punteroFallos - 12); i < punteroFallos; i++) {
        const n = notas[i];
        if (n.estado !== "fallo") continue;
        const dt = n.t - t;
        if (dt < -0.6) continue;
        dibujarNota(n, Y_GOLPE - (dt / cfg.aproximacion) * RECORRIDO, 0.3);
      }
    }

    pintarMultitud(ahora, pulso);
    dibujarAvatar(ahora);

    // Fuegos artificiales y mensaje de la reacción final
    const dtFrame = Math.min(0.05, Math.max(0, ahora - ultimoDibujo));
    ultimoDibujo = ahora;
    if (celebracion) {
      if (celebracion.tipo === "ovacion" && ahora - celebracion.ultimoFuego > 0.3) { lanzarFuego(ahora); celebracion.ultimoFuego = ahora; }
      const textos = { ovacion: ["¡OVACIÓN!", "#ffd84d"], aplauso: ["¡BIEN TOCADO!", "#f4efe6"], murmullo: ["Hmm...", "#a58f89"], abucheo: ["BUUU", "#ff6b6b"] };
      const [texto, color] = textos[celebracion.tipo];
      ctxC.globalAlpha = Math.min(1, (ahora - celebracion.desde) / 0.3);
      ctxC.fillStyle = color;
      ctxC.font = "800 52px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(texto, W / 2, 130);
      ctxC.globalAlpha = 1;
    }
    if (particulas.length) dibujarParticulas(ahora, dtFrame);

    // Textos de juicio
    efectos = efectos.filter(e => ahora - e.t < 0.6);
    efectos.forEach(e => {
      const k = (ahora - e.t) / 0.6;
      ctxC.globalAlpha = 1 - k;
      ctxC.fillStyle = e.color;
      ctxC.font = "800 20px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(e.texto, e.x, e.y - k * 22);
      ctxC.globalAlpha = 1;
    });

    // Marcador
    if (estado !== "menu") {
      ctxC.fillStyle = "#f4efe6";
      ctxC.textAlign = "left";
      ctxC.font = "700 28px sans-serif";
      if (puntos !== puntosPrevio) { puntosPrevio = puntos; puntosTexto = puntos.toLocaleString("es"); }
      ctxC.fillText(puntosTexto, 24, 44);
      if (combo >= 2) {
        ctxC.textAlign = "right";
        ctxC.font = "700 34px sans-serif";
        ctxC.fillStyle = combo >= 50 ? "#ffe14d" : "#f4efe6";
        ctxC.fillText(`${combo}`, W - 24, 46);
        ctxC.font = "600 12px sans-serif";
        ctxC.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctxC.fillText("COMBO", W - 24, 64);
      }
      if (fiebre) {
        ctxC.textAlign = "right";
        ctxC.font = "800 15px sans-serif";
        ctxC.fillStyle = "#ffd84d";
        ctxC.fillText("FIEBRE x2", W - 24, 86);
      }
      // Vida
      ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctxC.fillRect(24, 58, 200, 8);
      ctxC.fillStyle = vida > 35 ? "#7ed87f" : "#ff6b6b";
      ctxC.fillRect(24, 58, 2 * vida, 8);
      // Progreso
      if (mapa) {
        ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctxC.fillRect(0, H - 6, W, 6);
        ctxC.fillStyle = "#ff3b3b";
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
      let q = supa.from("parranda_puntajes").select(columnas).eq("cancion", ruta);
      if (dif !== "todas") q = q.eq("dificultad", dif);
      return q.order("puntos", { ascending: false }).limit(200);
    };
    let res = await pedir("user_id, username, dificultad, puntos, precision, rango, combo_max, jugadas, mapa_version");
    // Si todavía no se corrió parranda.sql no existe la versión: se muestra todo como siempre
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
        let { error } = await supa.rpc("parranda_registrar", Object.assign({ p_version: version || "auto" }, args));
        // Sin parranda.sql la función no conoce la versión: se manda como antes
        if (error && /p_version|PGRST202|schema cache/i.test(String(error.message || "") + String(error.code || ""))) ({ error } = await supa.rpc("parranda_registrar", args));
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
      const consulta = supabase.from("parranda_mapas").select("cancion, dificultad, actualizado, firma:mapa->>firma, nivel:mapa->>nivel");
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
    document.getElementById("rtMultitud").checked = ajustes.multitud !== false;
    document.getElementById("rtRayos").checked = ajustes.rayos !== false;
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
  document.getElementById("rtMultitud").addEventListener("change", ev => { ajustes.multitud = ev.target.checked; guardarAjustes(); });
  document.getElementById("rtRayos").addEventListener("change", ev => { ajustes.rayos = ev.target.checked; guardarAjustes(); });
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

  /* --- Personalizar: tu personaje y la multitud, con vista previa --- */
  {
    const modal = document.getElementById("rtPersonalizar");
    const lienzo = document.getElementById("rtPrevLienzo");
    const gp = lienzo.getContext("2d");
    const contenido = document.getElementById("rtPersCuerpo");
    let raf = 0;

    function chips(clave, grupo, opciones, actual, etiqueta) {
      return `<div class="rt-pers-fila"><span class="rt-etiqueta">${etiqueta}</span><div class="rt-pers-chips">${opciones.map(([v, txt, color]) =>
        `<button type="button" class="rt-pers-chip ${String(v) === String(actual) ? "activa" : ""}" data-grupo="${grupo}" data-clave="${clave}" data-valor="${v}"${color ? ` style="--c: ${color}" title="${txt}"` : ""}>${color ? "" : txt}</button>`).join("")}</div></div>`;
    }

    function pintarOpciones() {
      const a = personalAvatar();
      const m = personalMulti();
      contenido.innerHTML =
        `<p class="rt-etiqueta rt-pers-titulo">Tu personaje</p>` +
        chips("cuerpo", "avatar", Object.entries(CUERPOS).map(([k, v]) => [k, k, v[0]]), a.cuerpo, "Color") +
        chips("accesorio", "avatar", Object.entries(ACCESORIOS), a.accesorio, "Accesorio") +
        `<p class="rt-etiqueta rt-pers-titulo">La multitud</p>` +
        chips("tono", "multi", [["rojo", "Rojo", "#8a3a42"], ["azul", "Azul", "#3a5a8a"], ["verde", "Verde", "#3a7a50"], ["violeta", "Violeta", "#6a4a9a"], ["mixto", "Mezcla", "conic-gradient(#8a3a42, #3a5a8a, #3a7a50, #6a4a9a, #8a3a42)"]], m.tono, "Color") +
        chips("cantidad", "multi", [[1, "Pocos"], [2, "Normal"], [3, "Muchos"]], m.cantidad, "Cuántos") +
        chips("luces", "multi", [["encendedores", "Encendedores"], ["varitas", "Varitas de colores"], ["ninguna", "Sin luces"]], m.luces, "Luces con combo alto") +
        `<p class="rt-ayuda">Con «Pocos» el juego va más ligero en equipos lentos. Para quitar a la multitud o al personaje del todo, usa los interruptores de los ajustes.</p>`;
    }

    // Vista previa: tres filas pequeñas de fans y tu personaje
    function dibujarPrevia() {
      const ahora = ahoraS();
      gp.clearRect(0, 0, 320, 190);
      gp.fillStyle = "#0a0607"; gp.fillRect(0, 0, 320, 190);
      const g = gp.createLinearGradient(0, 0, 0, 190);
      g.addColorStop(0, "rgba(255, 59, 59, 0.18)"); g.addColorStop(1, "rgba(255, 59, 59, 0)");
      gp.fillStyle = g; gp.fillRect(0, 0, 320, 190);
      const pulso = Math.pow(Math.max(0, 1 - ((ahora % 0.6) / 0.4)), 2);
      // Un pedazo de la multitud: los fans de la izquierda, reubicados en la vista previa
      const vista = fans.filter(f => f.x < 282);
      gp.save();
      gp.translate(66, 0);
      gp.scale(0.62, 0.62);
      gp.translate(0, -250);
      dibujarMultitudEn(gp, ahora, pulso, vista);
      gp.restore();
      // Personaje
      gp.save();
      gp.translate(160, 138 - Math.abs(Math.sin(ahora * 3.2)) * 10);
      gp.scale(1.2, 1.2);
      if (fotoImg) gp.drawImage(fotoImg, -42, -42, 84, 84); else trazarPersonaje(gp, 0);
      gp.restore();
      raf = requestAnimationFrame(dibujarPrevia);
    }

    // La misma rutina de la multitud, pero sobre otra lista de fans y con mucha energía
    function dibujarMultitudEn(c, ahora, pulso, lista) {
      const guardada = fans;
      fans = lista;
      dibujarMultitud(c, ahora, pulso, 0.9, 0, true, false);
      fans = guardada;
    }

    function abrir() {
      pintarOpciones();
      modal.classList.remove("hidden");
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(dibujarPrevia);
    }
    function cerrar() {
      cancelAnimationFrame(raf);
      modal.classList.add("hidden");
    }
    document.getElementById("rtPersonalizarBtn").addEventListener("click", abrir);
    document.getElementById("rtPersonalizarCerrar").addEventListener("click", cerrar);
    contenido.addEventListener("click", ev => {
      const b = ev.target.closest("[data-grupo]");
      if (!b) return;
      const grupo = b.dataset.grupo;
      const valor = grupo === "multi" && b.dataset.clave === "cantidad" ? Number(b.dataset.valor) : b.dataset.valor;
      ajustes[grupo] = Object.assign({}, ajustes[grupo], { [b.dataset.clave]: valor });
      guardarAjustes();
      if (grupo === "multi") reconstruirMultitud();
      pintarOpciones();
    });
  }

  /* --- Novedades: lista de cambios (data/parranda-novedades.js) con un punto si hay algo que no viste --- */
  {
    const CLAVE_VISTAS = "compendioParrandaNovedadesVistas";
    const novedades = window.PARRANDA_NOVEDADES || [];
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
    cont.innerHTML = t.map((par, c) => `<span class="rt-teclas-grupo"><em style="color: ${CARRILES[c].color}">${c + 1}</em>${par.map((k, i) => {
      const espera = capturando && capturando.carril === c && capturando.i === i;
      return `<button type="button" class="rt-tecla ${espera ? "esperando" : ""}" data-carril="${c}" data-i="${i}">${espera ? "..." : (k ? k.toUpperCase() : "—")}</button>`;
    }).join("")}</span>`).join("") + `<button type="button" class="rt-secundario rt-chico" data-restablecer>Restablecer</button>`;
    const txt = document.getElementById("rtTeclasTxt");
    if (txt) txt.textContent = `Carriles de izquierda a derecha: ${CARRILES.map(c => c.etiqueta.replace(/\//g, " o ")).join(", ")}. Las flechas ← ↓ ↑ → también valen.`;
  }
  document.getElementById("rtTeclas").addEventListener("click", ev => {
    if (ev.target.closest("[data-restablecer]")) { ajustes.teclas = null; guardarAjustes(); construirTeclas(); capturando = null; pintarTeclas(); return; }
    const b = ev.target.closest("[data-carril]");
    if (!b) return;
    capturando = { carril: Number(b.dataset.carril), i: Number(b.dataset.i) };
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
      await enviarPeticion({ texto: "[Canción para Parranda] " + cancion + (enlace ? "\n" + enlace : ""), nombre });
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
      forzarTiempo: f => { tiempoCancion = f; },
      forzarCombo: n => { combo = n; },
      forzarFiebre: v => { fiebre = v; },
      poner: o => { if (o.perfectos !== undefined) perfectos = o.perfectos; if (o.buenos !== undefined) buenos = o.buenos; if (o.fallos !== undefined) fallos = o.fallos; },
      terminar
    };
  }
})();
