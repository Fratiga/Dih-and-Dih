/* =============================================================================
   MÚSICA DE FONDO POR PÁGINA
   El Admin le pone a cada página una playlist (botón ⚙ junto al ♪, solo se ve con la cuenta de admin) y, en los
   juegos, otra que suena mientras hay una partida. Las listas viven en la tabla musica_paginas
   (scratchpad/musica_paginas.sql) y salen de la Rocola de fondos (js/musica-fondos.js), una biblioteca del Admin aparte de la
   Rocola pública (docs/admin/musica_fondos.sql).

   - "Desde cero": cada vez que entras empieza por la primera canción desde el segundo 0. Si no, sigue por donde iba
     en esa página (se recuerda en este navegador).
   - Los juegos avisan con MusicaPaginas.partida(true) al empezar una partida y partida(false) al terminarla.
   - Opción "continua" (config.continua): la canción no se interrumpe al empezar ni al terminar una partida. Sigue sonando la
     música de fondo sin cambiar de lista (la de partida no se usa; si la página solo tiene lista de partida, esa suena siempre).
   - Si la página tiene música configurada, la música propia de la página (el ♪ de los minijuegos, la del Dominio) y
     la de la Rocola se pausan: suena una sola cosa a la vez. Si alguien pulsa play en la Rocola, esta se pausa.
   - Los navegadores no dejan sonar hasta que se toca algo: arranca con el primer toque o tecla.
============================================================================= */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE_CACHE = "musicaPaginasCfg";
  const CLAVE_SILENCIO = "musicaPaginasSilencio";
  const PAGINA = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  // Páginas a las que se les puede poner música, y cuáles son juegos con partida
  const PAGINAS = [
    ["index.html", "Lobby"], ["compendio.html", "Compendio"], ["mapa.html", "Mapa"], ["cronologia.html", "Cronología"],
    ["lugares.html", "Lugares"], ["facciones.html", "Facciones"], ["personajes.html", "Personajes"], ["razas.html", "Razas"],
    ["religion.html", "Religión"], ["textos.html", "Textos"], ["pergaminos.html", "Pergaminos"], ["armas.html", "Armas"],
    ["objetos.html", "Objetos"], ["bestiario.html", "Bestiario"], ["reglas.html", "Reglas"], ["economia.html", "Economía"],
    ["estadisticas.html", "Estadísticas"], ["fanarts.html", "Fanarts"], ["peticiones.html", "Peticiones"],
    ["fichas.html", "Mis personajes"], ["habitacion.html", "Mi habitación"], ["corrales.html", "Corrales"], ["intercambios.html", "Intercambios"], ["forja.html", "La forja"], ["minijuegos.html", "Minijuegos"], ["ajedrez.html", "Ajedrez"],
    ["arqueria.html", "Arquería"], ["duelo.html", "Duelo"], ["cartas.html", "Triunfos: álbum"], ["mazos.html", "Triunfos: mazos"],
    ["batalla.html", "Triunfos: batalla"], ["ostelar.html", "Ostelar"], ["hipodromo.html", "Hipódromo"], ["hipodromo-vivo.html", "Hipódromo en vivo"], ["fractura.html", "La Fractura"], ["veintiuna.html", "Las Veintiuna Velas"], ["veintiuna-amigos.html", "Veintiuna con amigos"],
    ["muerte-subita.html", "Muerte Súbita"], ["encuentro-verdam.html", "Encuentro con Verdam"]
  ];
  // Páginas donde la lista de "partida" tiene otro nombre en el editor (aquí: la música suena según la fase de la carrera)
  const ETIQUETAS = {
    "hipodromo-vivo.html": {
      fondo: ["Espera", "Suena mientras no hay carrera en marcha: la espera, los resultados y la recuperación. Cuando termina una canción pasa a la siguiente."],
      partida: ["Carrera", "Suena desde 30 segundos antes de la salida (la preparación) hasta que cruza la meta la última criatura, para todos a la vez según el reloj de las carreras. Si la dejas vacía, la música no cambia."]
    }
  };
  const CON_PARTIDA = new Set(["ajedrez.html", "arqueria.html", "duelo.html", "batalla.html", "ostelar.html", "fractura.html", "hipodromo-vivo.html", "veintiuna.html", "veintiuna-amigos.html"]);

  // Interruptor del panel de Admin: apagada, la música de páginas no suena (ni calla a la propia de cada página)
  const apagada = (() => { try { return (JSON.parse(localStorage.getItem("sitioInterruptores") || "{}") || {}).musica_paginas === false; } catch (e) { return false; } })();
  const leerJson = (almacen, clave, defecto) => { try { return JSON.parse(almacen.getItem(clave) || "null") || defecto; } catch (e) { return defecto; } };
  const escribirJson = (almacen, clave, valor) => { try { almacen.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ } };

  let cfg = null;             // config de esta página
  let enPartida = false;
  let modo = "fondo";         // "fondo" o "partida"
  let lista = [], orden = [], pos = 0, silencio = false, pendienteGesto = false, fallos = 0;
  let firma = "";             // qué lista suena ahora (para no reiniciarla si no cambió)
  const audio = new Audio();
  audio.preload = "auto";
  try { silencio = localStorage.getItem(CLAVE_SILENCIO) === "1"; } catch (e) { silencio = false; }

  /* --- Música propia de la página y Rocola: se apartan cuando esta página tiene su playlist --- */
  const suprimidos = new WeakSet();
  let ultimoGesto = 0;
  ["pointerdown", "keydown", "touchstart"].forEach(t => document.addEventListener(t, () => { ultimoGesto = Date.now(); }, { capture: true, passive: true }));
  function apartarOtrasMusicas() {
    // La música propia de la página (♪ de los minijuegos, la del Dominio) se queda callada mientras haya playlist
    (window.__fondoPropio || []).forEach(a => {
      if (!a || suprimidos.has(a)) return;
      suprimidos.add(a);
      a.pause();
      a.addEventListener("play", () => { if (hayMusica()) a.pause(); });
    });
    // La Rocola: si arranca sola al cargar, se pausa; si alguien pulsa play, la que se pausa es esta
    const rocola = document.getElementById("audioPlayer");
    if (rocola && !suprimidos.has(rocola)) {
      suprimidos.add(rocola);
      rocola.addEventListener("play", () => {
        if (Date.now() - ultimoGesto < 1000) audio.pause(); else if (!silencio && lista.length) rocola.pause();
      });
      if (!rocola.paused && !silencio && lista.length) rocola.pause();
    }
  }
  // Qué lista toca ahora: con "continua" no depende de si hay partida o no
  function modoActual() {
    const hayF = !!(cfg && (cfg.lista || []).length), hayP = !!(cfg && cfg.partida && (cfg.partida.lista || []).length);
    if (cfg && cfg.continua) return hayF ? "fondo" : (hayP ? "partida" : "fondo");
    return enPartida && hayP ? "partida" : "fondo";
  }
  const hayMusica = () => !apagada && !!(cfg && ((cfg.lista || []).length || (cfg.partida && (cfg.partida.lista || []).length)));
  const urlDe = r => { try { return encodeURI(decodeURI(r)); } catch (e) { return encodeURI(r); } };

  /* --- Lista actual --- */
  const sub = () => (cfg ? (modo === "partida" ? cfg.partida : cfg) : null);
  const claveEstado = () => `musicaPag:${PAGINA}:${modo}`;

  function mezcla(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function cargarPista(tiempo) {
    if (!lista.length) { audio.pause(); return; }
    pos = ((pos % orden.length) + orden.length) % orden.length;
    audio.src = urlDe(lista[orden[pos]]);
    audio.volume = Math.max(0, Math.min(1, Number(sub().volumen ?? 0.5)));
    if (tiempo > 0) audio.addEventListener("loadedmetadata", () => { if (tiempo < audio.duration) audio.currentTime = tiempo; }, { once: true });
    sonar();
  }

  function sonar() {
    if (apagada || silencio || document.hidden || !lista.length) return;
    apartarOtrasMusicas();
    audio.play().then(() => { pendienteGesto = false; }).catch(() => { pendienteGesto = true; });
  }

  function guardarEstado() {
    if (!lista.length || !firma) return;
    escribirJson(localStorage, claveEstado(), { f: firma, orden, pos, t: audio.currentTime || 0 });
  }

  /* Arranca la lista del modo actual. continuar: sigue por donde iba (si la lista no cambió) */
  function iniciarLista(forzar) {
    const s = sub();
    const nuevaLista = s && Array.isArray(s.lista) ? s.lista.filter(x => typeof x === "string" && x) : [];
    const nuevaFirma = `${modo}|${nuevaLista.join("|")}|${s && s.mezclar ? 1 : 0}`;
    if (!forzar && nuevaFirma === firma) return;
    if (firma) guardarEstado();
    lista = nuevaLista;
    firma = nuevaLista.length ? nuevaFirma : "";
    fallos = 0;
    if (!lista.length) { audio.pause(); return; }
    const guardado = leerJson(localStorage, claveEstado(), null);
    const seguir = !(s.desdeCero ?? true) && guardado && guardado.f === firma && Array.isArray(guardado.orden) && guardado.orden.length === lista.length;
    if (seguir) { orden = guardado.orden; pos = guardado.pos || 0; cargarPista(guardado.t || 0); }
    else { orden = s.mezclar ? mezcla(lista.length) : lista.map((_, i) => i); pos = 0; cargarPista(0); }
  }

  function siguiente() {
    if (!lista.length) return;
    if (++fallos > lista.length * 2) return;   // ninguna se puede reproducir: no insistir
    pos += 1;
    if (pos >= orden.length && sub().mezclar) { orden = mezcla(lista.length); pos = 0; }
    cargarPista(0);
  }

  audio.addEventListener("ended", () => { fallos = 0; siguiente(); });
  audio.addEventListener("error", siguiente);
  audio.addEventListener("playing", () => { fallos = 0; });
  let ultimoGuardado = 0;
  audio.addEventListener("timeupdate", () => {
    if (Math.abs(audio.currentTime - ultimoGuardado) >= 2) { ultimoGuardado = audio.currentTime; guardarEstado(); }
  });
  window.addEventListener("pagehide", () => { guardarEstado(); audio.pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) audio.pause(); else sonar(); });
  ["pointerdown", "keydown", "touchstart"].forEach(t => document.addEventListener(t, () => { if (pendienteGesto) sonar(); }, { passive: true }));

  /* --- Botón ♪ / ⚙ --- */
  let caja = null, botonSonido = null;
  function pintarBoton() {
    if (!caja) return;
    const hay = hayMusica();
    const aj = caja.querySelector(".pagmus-ajustes");
    caja.hidden = !hay && !(aj && !aj.hidden);
    botonSonido.hidden = !hay;
    botonSonido.classList.toggle("apagado", silencio);
    botonSonido.title = silencio ? "Activar la música de la página" : "Silenciar la música de la página";
    botonSonido.setAttribute("aria-pressed", silencio ? "true" : "false");
  }
  const esAdminLocal = () => { try { return localStorage.getItem("compendioAdmin") === "1"; } catch (e) { return false; } };

  function crearBoton() {
    if (caja || !document.body) return;
    const enlace = document.createElement("link");
    enlace.rel = "stylesheet";
    enlace.href = `css/musica-paginas.css${VERSION}`;
    document.head.appendChild(enlace);
    caja = document.createElement("div");
    caja.className = "pagmus";
    caja.hidden = true;
    caja.innerHTML = `<button type="button" class="pagmus-sonido" aria-label="Música de la página" hidden>♪</button>`;
    botonSonido = caja.querySelector(".pagmus-sonido");
    botonSonido.addEventListener("click", () => {
      silencio = !silencio;
      try { localStorage.setItem(CLAVE_SILENCIO, silencio ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      if (silencio) audio.pause(); else if (audio.src) sonar(); else iniciarLista(true);
      pintarBoton();
    });
    if (esAdminLocal()) {
      const ajustes = document.createElement("button");
      ajustes.hidden = true;   // aparece cuando el servidor confirma que eres admin
      ajustes.type = "button";
      ajustes.className = "pagmus-ajustes";
      ajustes.title = "Música de esta página (solo admin)";
      ajustes.setAttribute("aria-label", "Configurar la música de esta página");
      ajustes.textContent = "⚙";
      ajustes.addEventListener("click", abrirEditor);
      caja.appendChild(ajustes);
    }
    document.body.appendChild(caja);
    pintarBoton();
    if (esAdminLocal()) confirmarAdmin().then(ok => {
      const aj = caja.querySelector(".pagmus-ajustes");
      if (aj) { if (ok) aj.hidden = false; else aj.remove(); }
      pintarBoton();
    });
  }

  /* La marca del navegador (compendioAdmin) solo decide si se enseña el botón; quién es admin lo dice el servidor.
     Sin tener que cargar nada si no hay marca, y el editor vuelve a comprobarlo al abrirse. */
  async function confirmarAdmin() {
    try {
      if (typeof fichasCliente !== "function") await cargarScript("js/fichas-supabase.js");
      const supabase = await fichasCliente();
      const { data } = await supabase.rpc("fichas_es_admin");
      return data === true;
    } catch (e) { return false; }
  }

  // La versión del script (?v=...) se reutiliza para lo que se carga después
  const VERSION = (() => {
    const s = document.currentScript || document.querySelector('script[src*="musica-paginas.js"]');
    const m = s && s.src.match(/\?v=\d+/);
    return m ? m[0] : "";
  })();

  function cargarScript(src) {
    return new Promise((ok, mal) => {
      if (document.querySelector(`script[data-mp="${src}"]`)) { ok(); return; }
      const s = document.createElement("script");
      s.src = `${src}${VERSION}`; s.dataset.mp = src; s.onload = ok; s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  async function abrirEditor() {
    try {
      if (!(await confirmarAdmin())) { alert("Solo el admin puede cambiar la música de las páginas."); return; }
      if (!window.MUSICA || !window.MUSICA_NUBE_NOMBRES) {
        if (!window.MUSICA) await cargarScript("data/musica.js");
        await cargarScript("js/musica-nube.js");
      }
      if (typeof fichasCliente !== "function") await cargarScript("js/fichas-supabase.js");
      await cargarScript("js/musica-fondos.js");
      await cargarScript("js/musica-paginas-editor.js");
      window.MusicaPaginasEditor.abrir({ pagina: PAGINA, paginas: PAGINAS, conPartida: CON_PARTIDA.has(PAGINA), etiquetas: ETIQUETAS[PAGINA] || null, config: cfg });
    } catch (e) {
      alert(`No se pudo abrir el editor de música: ${e.message || e}`);
    }
  }

  /* --- Configuración --- */
  function aplicarConfig(nueva, guardarCache) {
    cfg = nueva && typeof nueva === "object" ? nueva : null;
    if (guardarCache !== false) {
      const todo = leerJson(localStorage, CLAVE_CACHE, {});
      if (cfg) todo[PAGINA] = cfg; else delete todo[PAGINA];
      escribirJson(localStorage, CLAVE_CACHE, todo);
    }
    if (cfg) apartarOtrasMusicas();
    modo = modoActual();
    iniciarLista(false);
    if (document.body) pintarBoton();
  }

  async function pedirAlServidor() {
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/musica_paginas?select=pagina,config`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return;
      const filas = await r.json();
      const todo = {};
      filas.forEach(f => { todo[f.pagina] = f.config; });
      escribirJson(localStorage, CLAVE_CACHE, todo);
      aplicarConfig(todo[PAGINA] || null, false);
    } catch (e) { /* sin conexión o sin la tabla: se queda lo último que se sabía */ }
  }

  /* --- API para los juegos y el editor --- */
  function partida(si) {
    si = !!si;
    if (si === enPartida) return;
    if (firma) guardarEstado();
    enPartida = si;
    const nuevo = modoActual();
    if (nuevo === modo) return;
    modo = nuevo;
    firma = "";                  // fuerza a cargar la lista del modo nuevo (la de fondo se retoma según "desde cero")
    iniciarLista(true);
  }

  window.MusicaPaginas = {
    pagina: PAGINA,
    partida,
    configurada: hayMusica,
    editar: abrirEditor,
    aplicar: (c) => aplicarConfig(c, true),
    detener: () => { audio.pause(); },
    estado: () => ({ configurada: hayMusica(), sonando: !audio.paused && !audio.ended, silencio, esperaGesto: pendienteGesto }),
    probar: (rutas, volumen) => {                  // para escuchar una lista desde el editor sin guardarla
      const a = new Audio(urlDe(rutas[0] || ""));
      a.volume = volumen ?? 0.5; a.play().catch(() => {});
      return a;
    },
    audio
  };

  // Primero lo último que se sabía (para que suene enseguida), luego se consulta al servidor
  aplicarConfig(leerJson(localStorage, CLAVE_CACHE, {})[PAGINA] || null, false);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", crearBoton); else crearBoton();
  pedirAlServidor();
})();
