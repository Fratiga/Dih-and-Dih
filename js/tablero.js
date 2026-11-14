/* =============================================================================
   TABLERO — la app: estado, carga, sincronización y acciones. La interfaz está en tablero-paneles.js y el
   dibujo en tablero-lienzo.js. Solo el GM navega entre páginas; los jugadores ven todos a la vez la que él elige.
============================================================================= */
(function () {
  const { aviso, mensajeError, confirmar } = TBUI;
  const params = new URLSearchParams(location.search);
  const LOCAL = params.has("local");
  const PREFS_DEF = {
    medida: { forma: "linea", ajuste: "centro", persistente: false, moverMide: true, transmitir: true },
    dibujo: { modo: "mano", trazo: "#d6127e", relleno: "transparent", grosor: "mediano" },
    texto: { color: "#000000", fondo: "transparent", fuente: "Arial", tam: 26, negrita: false, cursiva: false },
    niebla: { modo: "revelar", forma: "rect" },
    fx: { tipo: "aliento", color: "fuego" },
    dados: { modo: "todos", avanzado: false, explota: "", tresD: true, auto3D: true, skin: "marfil", moneda: "oro" },
    consejos: true, volumen: 0.7, volumenEfectos: 0.8, pestana: "chat", ladoPlegado: false, barraPlegada: false, tamChat: 14.5,
    avatares: { ver: true, tam: 56, nombres: true }, oscuro: false, verZoom: true, ruedaZoom: true,
    decoHover: false, arribaMias: false, centrarMia: true, mapaSinEncajar: false, sinFx: false, calidad: "media", webp: true,
    pitido: false, avataresChat: true, horas: false, escalaUI: "0.8"
  };
  function leerPrefs() {
    try { const p = JSON.parse(localStorage.getItem("tbPrefs") || "{}"); return Object.assign({}, PREFS_DEF, p, Object.fromEntries(["medida", "dibujo", "texto", "niebla", "fx", "dados", "avatares"].map(k => [k, Object.assign({}, PREFS_DEF[k], p[k])]))); }
    catch (e) { return JSON.parse(JSON.stringify(PREFS_DEF)); }
  }

  const oyentes = {};
  const TB = window.TB = {
    local: LOCAL,
    yo: null, red: null, L: null, fx: null,
    escenas: new Map(), escenaId: null, estado: null,
    mensajes: [], diario: new Map(), macros: [], jugadores: [], fichas: [], presencia: [], arte: null,
    capa: "fichas", herr: "seleccionar", vistaJugador: false,
    prefs: leerPrefs(),
    on(ev, f) { (oyentes[ev] = oyentes[ev] || []).push(f); },
    lanzar(ev, d) { (oyentes[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error("[tablero]", ev, e); } }); },
    guardarPrefs() { try { localStorage.setItem("tbPrefs", JSON.stringify(TB.prefs)); } catch (e) { /* sin almacenamiento */ } },
    esGM: () => !!(TB.yo && TB.yo.esGM),
    // Tamaño de la interfaz (no del lienzo). El 80 % deja las barras, el panel y las letras del tamaño de Roll20.
    escalaUI() {
      const e = !TB.prefs.escalaUI || TB.prefs.escalaUI === "auto" ? "0.8" : TB.prefs.escalaUI;
      if (e !== "zoom") return Math.max(0.5, Math.min(1.5, Number(e) || 0.8));
      // El zoom de la página se nota en dos sitios a la vez: en la relación entre la ventana y la página y en
      // devicePixelRatio. Si los dos coinciden es zoom del navegador (y no la escala de Windows ni un panel incrustado).
      const z = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
      const dpr = window.devicePixelRatio || 1;
      if (Math.abs(z - dpr) > 0.09 || z < 1.05) return 1;
      const zz = [1, 1.1, 1.25, 1.5, 1.75, 2].reduce((x, y) => (Math.abs(y - dpr) < Math.abs(x - dpr) ? y : x));
      return Math.max(0.5, Math.min(1, 1 / zz));
    },
    aplicarEscala() { document.documentElement.style.setProperty("--tb-k", String(Math.round(TB.escalaUI() * 1000) / 1000)); },
    escena: () => TB.escenas.get(TB.escenaId) || null,
    controla: o => !!o && !!TB.yo && (o.controlan_todos || (o.controladores || []).includes(TB.yo.uid)),
    colorJugador(uid) {
      let h = 0; String(uid || "").split("").forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
      return `hsl(${h % 360}, 62%, 48%)`;
    },
    nombreJugador(uid) { const j = TB.jugadores.find(x => x.uid === uid) || TB.presencia.find(x => x.uid === uid); return j ? j.nombre : "Jugador"; }
  };

  /* ------------------------------------------------------------ arranque */
  async function iniciar() {
    const carga = document.getElementById("tbCarga"), texto = document.getElementById("tbCargaTexto");
    TB.red = LOCAL ? TableroRed.local(params.has("jugador")) : TableroRed.supabase();
    try {
      TB.yo = await TB.red.iniciar();
    } catch (e) {
      carga.classList.add("sin-rueda");
      if (e.codigo === "sin-sesion") texto.innerHTML = `Inicia sesión en el compendio para entrar al tablero.<br><br><a href="index.html">Ir al compendio</a>`;
      else if (e.codigo === "sin-sql") texto.innerHTML = `El tablero todavía no está instalado en el servidor.<br>Falta correr <code>docs/admin/tablero.sql</code> en Supabase.<br><br><a href="tablero.html?local=1">Probar en este navegador sin conexión</a>`;
      else texto.innerHTML = `No se pudo abrir el tablero: ${TBUI.esc(mensajeError(e))}<br><br><a href="tablero.html">Reintentar</a>`;
      return;
    }
    document.body.classList.toggle("es-gm", TB.yo.esGM);
    TB.estado = await TB.red.estado();
    const escenas = await TB.red.escenas();
    escenas.forEach(e => TB.escenas.set(e.id, e));
    if (TB.yo.esGM && !escenas.length) {
      const e = await TB.red.crearEscena({ nombre: "Start" });
      TB.escenas.set(e.id, e);
      await TB.red.actualizarEstado({ escena_jugadores: e.id });
      TB.estado.escena_jugadores = e.id;
    }
    if (TB.yo.esGM && !TB.estado.escena_jugadores && TB.escenas.size) {
      const primera = [...TB.escenas.keys()][0];
      await TB.red.actualizarEstado({ escena_jugadores: primera });
      TB.estado.escena_jugadores = primera;
    }
    const [diario, mensajes, macros] = await Promise.all([TB.red.diario().catch(() => []), TB.red.mensajes().catch(() => []), TB.red.macros().catch(() => [])]);
    (diario || []).forEach(e => TB.diario.set(e.id, e));
    TB.mensajes = mensajes || [];
    TB.macros = macros || [];
    if (TB.yo.esGM) {
      TB.red.jugadores().then(j => { TB.jugadores = j; TB.lanzar("jugadores"); }).catch(() => {});
      TB.red.fichas().then(f => { TB.fichas = f; sincronizarPV(); }).catch(() => {});
      setInterval(() => { if (!document.hidden) refrescarPV(); }, 30000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescarPV(); });
      TB.on("escena", () => sincronizarPV());
    }

    TB.L = TBLienzo.crear(document.getElementById("tbLienzo"), callbacksLienzo());
    TB.L.setPermisos(TB.yo.esGM, TB.yo.uid);
    TB.fx = TBFx.crear(TB.L.capaUI);
    aplicarOpcionesLienzo();
    escucharRed();
    TBPaneles.iniciar(TB);
    const guardada = TB.yo.esGM && localStorage.getItem("tbEscenaGM");
    await cargarEscena(TB.yo.esGM && guardada && TB.escenas.has(guardada) ? guardada : TB.estado.escena_jugadores);
    actualizarTurno();
    TB.L.setPausa(!!TB.estado.pausa);
    TB.lanzar("estado", TB.estado);
    TB.miPerfil = await TB.red.perfil().catch(() => ({ avatar: "" }));
    anunciarAvatar();
    TB.on("diario", anunciarAvatar);
    carga.remove();
  }

  TB.anunciarAvatar = () => anunciarAvatar();
  // El avatar de cada uno en la barra de jugadores: el suyo si lo puso; si no, el de su personaje del grupo
  let avatarAnunciado = null;
  function anunciarAvatar() {
    const mio = [...TB.diario.values()].filter(e => e.tipo === "personaje" && !e.archivado && (e.controladores || []).includes(TB.yo.uid) && e.imagen)
      .sort((a, b) => (b.grupo ? 1 : 0) - (a.grupo ? 1 : 0))[0];
    const avatar = (TB.miPerfil && TB.miPerfil.avatar) || (mio ? mio.imagen : "");
    if (avatar === avatarAnunciado) return;
    avatarAnunciado = avatar;
    TB.red.presencia({ avatar, personaje: mio ? mio.nombre : "" });
  }

  async function cargarEscena(id) {
    TB.escenaId = id || null;
    if (TB.yo.esGM && id) try { localStorage.setItem("tbEscenaGM", id); } catch (e) { /* nada */ }
    if (!TB.yo.esGM) {
      const lista = await TB.red.escenas().catch(() => []);
      TB.escenas.clear(); lista.forEach(e => TB.escenas.set(e.id, e));
    }
    const escena = TB.escena();
    TB.L.setEscena(escena);
    TB.L.setObjetos(id ? await TB.red.objetos(id).catch(e => { aviso(mensajeError(e), true); return []; }) : []);
    const cam = leerCamara(id);
    // Un jugador que llega a una página nueva ve su ficha en el centro (si lo tiene activado)
    const mia = !TB.yo.esGM && TB.prefs.centrarMia !== false && TB.L.objetos().find(o => o.tipo === "imagen" && o.capa === "fichas" && TB.controla(o));
    if (cam) TB.L.centrarEn(cam.x, cam.y, cam.z); else if (mia) { TB.L.ajustarVista(); TB.L.centrarEn(mia.x, mia.y); } else TB.L.ajustarVista();
    TB.lanzar("escena", escena);
    if (!escena && !TB.yo.esGM) aviso("El DJ todavía no ha abierto ninguna página.");
  }
  TB.cargarEscena = cargarEscena;

  /* Barras enlazadas a los PV de una ficha del compendio (opcional, lo elige el DJ en Ajustes de ficha).
     Lo que diga la ficha manda: el navegador del DJ copia sus PV a la barra cada poco. Cambiar la barra desde
     el tablero también cambia la ficha. Una barra sin enlace va por libre. */
  async function refrescarPV() {
    try { TB.fichas = await TB.red.fichas(); } catch (e) { return; }
    sincronizarPV();
  }
  function sincronizarPV() {
    if (!TB.yo.esGM || !TB.L) return;
    const porId = new Map((TB.fichas || []).map(f => [f.id, f]));
    TB.L.objetos().forEach(o => {
      const barras = (o.datos && o.datos.barras) || [];
      let cambia = false;
      const nuevas = barras.map(b => {
        const f = b && b.enlace && porId.get(b.enlace), c = f && f.combate;
        if (!c) return b;
        const valor = Number(c.pvActual) || 0, max = Number(c.pvMax) || 0;
        if (Number(b.valor) === valor && Number(b.max) === max) return b;
        cambia = true;
        return Object.assign({}, b, { valor, max });
      });
      if (cambia) TB.cambiarObjeto(o.id, { datos: Object.assign({}, o.datos, { barras: nuevas }) }, { sinDeshacer: true });
    });
  }
  TB.sincronizarPV = sincronizarPV;
  function leerCamara(id) { try { return JSON.parse(sessionStorage.getItem("tbCam:" + id) || "null"); } catch (e) { return null; } }
  function guardarCamara() {
    if (!TB.escenaId || !TB.L) return;
    const c = TB.L.centroVista();
    try { sessionStorage.setItem("tbCam:" + TB.escenaId, JSON.stringify({ x: c.x, y: c.y, z: TB.L.zoom() })); } catch (e) { /* nada */ }
  }
  window.addEventListener("beforeunload", guardarCamara);

  function aplicarOpcionesLienzo() {
    const p = TB.prefs;
    // Plantilla de los efectos: la que se elija o, en «automática», la que va con el efecto
    const AUTO = { aliento: "cono", haz: "haz", salpicar: "cono", bomba: "circulo", explotar: "circulo", agrupacion: "circulo", estrella: "circulo", quemar: "circulo", rafaga: "circulo" };
    const pl = !p.fx.plantilla || p.fx.plantilla === "auto" ? (AUTO[p.fx.tipo] || "linea") : p.fx.plantilla;
    const tfx = TBFx.TIPOS.find(x => x.id === p.fx.tipo) || TBFx.TIPOS[0];
    const RADIO = { bomba: 10, explotar: 20, destello: 15, estrella: 30, agrupacion: 20, quemar: 5, brillo: 10, escudo: 5, rafaga: 10, burbujeante: 5, cohete: 5, misil: 5 };
    const fxPrevia = { modo: tfx.modo, tipo: tfx.id, forma: { aliento: "cono", salpicar: "cono", haz: "haz" }[tfx.id] || (tfx.modo === "apuntar" ? "impacto" : "circulo"),
      radioPies: (p.fx.radios || {})[tfx.id] || RADIO[tfx.id] || 10, conoGrados: p.fx.grados || 53, conoForma: p.medida.conoForma || "plano", hazPies: p.fx.hazPies || 5, mostrar: p.fx.plantilla !== "ninguna" };
    TB.L.setOpciones({ moverMide: p.medida.moverMide, transmitir: p.medida.transmitir, ajusteMedida: p.medida.ajuste, formaMedida: p.medida.forma,
      persistente: p.medida.persistente, dibujo: p.dibujo, texto: p.texto, niebla: p.niebla, fxPlantilla: pl, fxPrevia,
      medidaExtra: { conoGrados: p.medida.conoGrados || 53, conoForma: p.medida.conoForma || "plano", hazPies: p.medida.hazPies || 5, origen: p.medida.origen || "centro" } });
  }
  TB.aplicarOpcionesLienzo = aplicarOpcionesLienzo;

  /* ------------------------------------------------------------ red */
  function escucharRed() {
    const r = TB.red;
    r.on("objeto", o => {
      if (o.escena === TB.escenaId) TB.L.upsert(o);
      else if (TB.L.objeto(o.id)) TB.L.quitar(o.id);
    });
    r.on("objetoBorrado", id => TB.L.quitar(id));
    r.on("escena", e => {
      if (!TB.yo.esGM && e.id !== TB.escenaId) return;
      TB.escenas.set(e.id, e);
      if (e.id === TB.escenaId) TB.L.setEscena(e);
      TB.lanzar("escenas");
    });
    r.on("escenaBorrada", id => {
      TB.escenas.delete(id);
      if (id === TB.escenaId && TB.yo.esGM) cargarEscena(TB.estado.escena_jugadores || [...TB.escenas.keys()][0]);
      TB.lanzar("escenas");
    });
    r.on("estado", s => {
      const antes = TB.estado || {};
      TB.estado = s;
      if (!TB.yo.esGM && s.escena_jugadores !== TB.escenaId) { guardarCamara(); cargarEscena(s.escena_jugadores); }
      actualizarTurno();
      if (!!antes.pausa !== !!s.pausa) {
        TB.L.setPausa(s.pausa);
        aviso(s.pausa ? "El DJ ha pausado el movimiento." : "El DJ ha reanudado el movimiento.");
      }
      if (JSON.stringify(antes.musica) !== JSON.stringify(s.musica)) TB.lanzar("musica", s.musica);
      if (JSON.stringify(antes.gramola) !== JSON.stringify(s.gramola)) TB.lanzar("gramola", s.gramola);
      TB.lanzar("estado", s);
    });
    r.on("mensaje", m => {
      if (TB.mensajes.some(x => x.id === m.id)) return;
      TB.mensajes.push(m);
      if (TB.mensajes.length > 400) TB.mensajes.shift();
      TB.lanzar("mensaje", m);
    });
    r.on("mensajeBorrado", id => { TB.mensajes = TB.mensajes.filter(m => m.id !== id); TB.lanzar("mensajes"); });
    r.on("diario", e => { TB.diario.set(e.id, e); TB.lanzar("diario"); });
    r.on("diarioBorrado", id => { TB.diario.delete(id); TB.lanzar("diario"); });
    r.on("mov", d => { if (d && d.escena === TB.escenaId) TB.L.moverRemoto(d.id, d.x, d.y); });
    r.on("quitar", d => { if (d && !TB.yo.esGM) (d.ids || []).forEach(id => TB.L.quitar(id)); });
    r.on("ping", d => {
      if (!d || d.escena !== TB.escenaId) return;
      TB.L.ping(d.x, d.y, d.color);
      if (d.centrar) TB.L.centrarEn(d.x, d.y);
    });
    r.on("regla", d => { if (d && (!d.escena || d.escena === TB.escenaId)) TB.L.reglaRemota(d); });
    r.on("fx", d => { if (d && d.escena === TB.escenaId && !TB.prefs.sinFx) TB.fx.reproducir(d); });
    r.on("presencia", lista => { TB.presencia = lista || []; TB.lanzar("presencia"); });
    r.on("cursor", d => { if (d && d.escena === TB.escenaId) TB.L.cursorRemoto(d); });
    r.on("sonido", d => { if (d && window.TBLado) TBLado.sonar(d); });
    r.on("explorado", d => { if (d && d.escena === TB.escenaId && !TB.yo.esGM) TB.L.reiniciarExplorado(); });
    r.on("conexion", c => {
      const chip = document.getElementById("tbConexion");
      if (!chip || typeof c !== "object") return;
      if (c.estado === "reconectando") { chip.hidden = false; chip.textContent = "Reconectando…"; }
      else {
        chip.hidden = true;
        if (c.recuperado) resincronizar();
      }
    });
  }

  // Tras una caída de la conexión: se vuelve a leer lo que pudo cambiar mientras tanto
  async function resincronizar() {
    try {
      const est = await TB.red.estado();
      const cambioEscena = !TB.yo.esGM && est.escena_jugadores !== TB.escenaId;
      TB.estado = est;
      if (cambioEscena) await cargarEscena(est.escena_jugadores);
      else if (TB.escenaId) TB.L.setObjetos(await TB.red.objetos(TB.escenaId));
      TB.mensajes = await TB.red.mensajes();
      TB.lanzar("mensajes");
      (await TB.red.diario()).forEach(e => TB.diario.set(e.id, e));
      TB.lanzar("diario");
      actualizarTurno();
      TB.lanzar("estado", TB.estado);
    } catch (e) { console.warn("[tablero] resincronizar", e); }
  }
  TB.resincronizar = resincronizar;

  function actualizarTurno() {
    const ini = (TB.estado && TB.estado.iniciativa) || {};
    const lista = ini.lista || [];
    const actual = lista.length ? lista[Math.min(ini.turno | 0, lista.length - 1)] : null;
    TB.L && TB.L.setTurno(actual && (ini.visible || TB.yo.esGM) ? actual.id : null);
  }

  /* ------------------------------------------------------------ deshacer (GM) */
  const historial = [], rehechos = [];
  function apuntar(paso) { historial.push(paso); if (historial.length > 60) historial.shift(); rehechos.length = 0; }
  // Aplica un paso al revés y devuelve el paso que lo vuelve a hacer
  async function aplicarInverso(p) {
    if (p.tipo === "cambiar") {
      const vuelta = [];
      for (const c of p.cambios) {
        const o = TB.L.objeto(c.id) || {};
        const ahora = {}; Object.keys(c.antes).forEach(k => { ahora[k] = o[k]; });
        vuelta.push({ id: c.id, antes: ahora });
        await TB.red.actualizarObjeto(c.id, c.antes);
        if (TB.L.objeto(c.id)) TB.L.upsert(Object.assign({}, TB.L.objeto(c.id), c.antes));
      }
      return { tipo: "cambiar", cambios: vuelta };
    }
    if (p.tipo === "crear") {
      const filas = p.ids.map(id => TB.L.objeto(id)).filter(Boolean).map(o => Object.assign({}, o));
      await TB.red.borrarObjetos(p.ids); p.ids.forEach(id => TB.L.quitar(id));
      return { tipo: "borrar", filas };
    }
    if (p.tipo === "borrar") {
      const filas = await TB.red.crearObjetos(p.filas);
      (filas || p.filas).forEach(o => { if (o.escena === TB.escenaId) TB.L.upsert(o); });
      return { tipo: "crear", ids: (filas || p.filas).map(o => o.id) };
    }
    return null;
  }
  async function deshacer() {
    const p = historial.pop();
    if (!p) { aviso("Nada que deshacer."); return; }
    try { const v = await aplicarInverso(p); if (v) rehechos.push(v); } catch (e) { aviso(mensajeError(e), true); }
  }
  async function rehacer() {
    const p = rehechos.pop();
    if (!p) { aviso("Nada que rehacer."); return; }
    try { const v = await aplicarInverso(p); if (v) historial.push(v); } catch (e) { aviso(mensajeError(e), true); }
  }
  TB.rehacer = rehacer;
  TB.puedeDeshacer = () => historial.length > 0;
  TB.puedeRehacer = () => rehechos.length > 0;

  /* ------------------------------------------------------------ acciones sobre objetos */
  const zSiguiente = () => Math.max(0, ...TB.L.objetos().map(o => o.z || 0)) + 1;
  TB.crearObjetos = async function (filas, { sinDeshacer } = {}) {
    if (!TB.escenaId) return [];
    if (TB.yo.esGM) {
      let z = zSiguiente();
      const completas = filas.map(f => Object.assign({ escena: TB.escenaId, capa: TB.capa, rot: 0, opacidad: 1, bloqueado: false, controladores: [], controlan_todos: false, datos: {} }, f, { z: z++ }));
      try {
        const creadas = await TB.red.crearObjetos(completas);
        (creadas || []).forEach(o => TB.L.upsert(o));
        if (!sinDeshacer) apuntar({ tipo: "crear", ids: (creadas || []).map(o => o.id) });
        return creadas || [];
      } catch (e) { aviso(mensajeError(e), true); return []; }
    }
    const ids = [];
    for (const f of filas) {
      if (f.tipo !== "dibujo" && f.tipo !== "texto") continue;
      try { ids.push(await TB.red.crearPropio(TB.escenaId, f.tipo, f.x, f.y, f.ancho, f.alto, f.datos || {})); }
      catch (e) { aviso(mensajeError(e), true); }
    }
    return ids;
  };
  TB.cambiarObjeto = async function (id, cambios, { sinDeshacer } = {}) {
    const o = TB.L.objeto(id);
    if (!o) return;
    if (!TB.yo.esGM) {
      // Un jugador solo reescribe su texto: se borra y se crea de nuevo
      if (o.tipo === "texto" && o.autor === TB.yo.uid) {
        const nuevo = Object.assign({}, o, cambios);
        try { await TB.red.borrarPropio([id]); await TB.red.crearPropio(TB.escenaId, "texto", nuevo.x, nuevo.y, nuevo.ancho, nuevo.alto, nuevo.datos); }
        catch (e) { aviso(mensajeError(e), true); }
      }
      return;
    }
    const antes = {};
    Object.keys(cambios).forEach(k => { antes[k] = o[k]; });
    if (!sinDeshacer) apuntar({ tipo: "cambiar", cambios: [{ id, antes }] });
    TB.L.upsert(Object.assign({}, o, cambios));
    if (cambios.capa === "gm" && o.capa !== "gm") TB.red.emitir("quitar", { ids: [id] });
    try { await TB.red.actualizarObjeto(id, cambios); } catch (e) { aviso(mensajeError(e), true); }
  };
  // Cambiar el valor de una barra (las esferas de la selección). El jugador, solo si el DJ le deja editarla.
  TB.cambiarBarra = async function (id, i, valor) {
    const o = TB.L.objeto(id);
    if (!o) return;
    const barras = ((o.datos || {}).barras || []).slice();
    while (barras.length <= i) barras.push({ valor: "", max: "", ver: true, editar: false, texto: "editores" });
    const b = Object.assign({}, barras[i], { valor });
    barras[i] = b;
    if (TB.yo.esGM) await TB.cambiarObjeto(id, { datos: Object.assign({}, o.datos, { barras }) });
    else {
      if (!b.editar) { aviso("El DJ no te deja cambiar esa barra."); return; }
      try { await TB.red.barra(id, i + 1, Number(valor) || 0, Number(b.max) || 0); } catch (e) { aviso(mensajeError(e), true); return; }
    }
    if (b.enlace) TB.red.fichaPV(b.enlace, { actual: Number(valor) || 0, max: null, temp: null }).catch(() => {});
  };
  TB.cambiarVarios = async function (lista) {
    // lista: [{id, cambios}]
    apuntar({ tipo: "cambiar", cambios: lista.map(({ id, cambios }) => { const o = TB.L.objeto(id) || {}; const antes = {}; Object.keys(cambios).forEach(k => { antes[k] = o[k]; }); return { id, antes }; }) });
    const aGM = lista.filter(({ id, cambios }) => cambios.capa === "gm" && (TB.L.objeto(id) || {}).capa !== "gm").map(x => x.id);
    if (aGM.length) TB.red.emitir("quitar", { ids: aGM });
    for (const { id, cambios } of lista) {
      const o = TB.L.objeto(id);
      if (o) TB.L.upsert(Object.assign({}, o, cambios));
      try { await TB.red.actualizarObjeto(id, cambios); } catch (e) { aviso(mensajeError(e), true); }
    }
  };
  TB.borrarObjetos = async function (ids) {
    if (!ids.length) return;
    if (TB.yo.esGM) {
      apuntar({ tipo: "borrar", filas: ids.map(id => TB.L.objeto(id)).filter(Boolean).map(o => Object.assign({}, o)) });
      ids.forEach(id => TB.L.quitar(id));
      try { await TB.red.borrarObjetos(ids); } catch (e) { aviso(mensajeError(e), true); }
    } else {
      try { const n = await TB.red.borrarPropio(ids); if (!n) aviso("Solo puedes borrar lo que dibujaste o escribiste tú."); } catch (e) { aviso(mensajeError(e), true); }
    }
  };
  TB.deshacer = deshacer;

  /* ------------------------------------------------------------ escenas (GM) */
  TB.verEscena = async id => { TB.lanzar("antesDeEscena"); guardarCamara(); await cargarEscena(id); };
  TB.llevarJugadores = async id => {
    try {
      const cambios = { escena_jugadores: id };
      // «Reproducir en carga»: la pista de la página empieza cuando el marcalibros llega a ella
      const e = TB.escenas.get(id), au = e && e.opciones && e.opciones.audio;
      if (au && au.src && (!TB.estado.musica || TB.estado.musica.src !== au.src)) cambios.musica = Object.assign({}, TB.estado.musica || {}, { src: au.src, nombre: au.nombre || "", tipo: au.tipo || "archivo", inicio: Date.now(), pausado: false, pos: 0 });
      await TB.red.actualizarEstado(cambios);
      Object.assign(TB.estado, cambios); TB.lanzar("estado", TB.estado);
      if (cambios.musica) TB.lanzar("musica", TB.estado.musica);
      aviso("Los jugadores ven ahora esta página.");
    }
    catch (e) { aviso(mensajeError(e), true); }
  };
  TB.crearEscena = async (campos) => {
    try {
      const e = await TB.red.crearEscena(Object.assign({ nombre: "Nueva página " + (TB.escenas.size + 1), orden: TB.escenas.size }, campos || {}));
      TB.escenas.set(e.id, e); TB.lanzar("escenas");
      return e;
    } catch (err) { aviso(mensajeError(err), true); return null; }
  };
  TB.duplicarEscena = async id => {
    const e = TB.escenas.get(id);
    if (!e) return;
    const nueva = await TB.crearEscena({ nombre: e.nombre + " (copia)", cuadricula: e.cuadricula, fondo: e.fondo, niebla: e.niebla, miniatura: e.miniatura, carpeta: e.carpeta, ancho: e.ancho, alto: e.alto, opciones: e.opciones });
    if (!nueva) return;
    const objs = await TB.red.objetos(id);
    await TB.red.crearObjetos(objs.map(o => { const c = Object.assign({}, o); delete c.id; delete c.actualizado; c.escena = nueva.id; return c; }));
    aviso("Página duplicada.");
  };
  TB.borrarEscena = async id => {
    const e = TB.escenas.get(id);
    if (!e) return;
    if (TB.escenas.size <= 1) { aviso("Necesitas al menos una página."); return; }
    if (!(await confirmar("Borrar página", `¿Borrar «${e.nombre}» con todo lo que tiene? No se puede deshacer.`, "Borrar"))) return;
    try {
      if (TB.estado.escena_jugadores === id) await TB.llevarJugadores([...TB.escenas.keys()].find(x => x !== id));
      await TB.red.borrarEscena(id);
      TB.escenas.delete(id);
      if (TB.escenaId === id) await cargarEscena(TB.estado.escena_jugadores);
      TB.lanzar("escenas");
    } catch (err) { aviso(mensajeError(err), true); }
  };
  TB.guardarEscena = async (id, cambios) => {
    const e = TB.escenas.get(id);
    if (!e) return;
    const nueva = Object.assign({}, e, cambios);
    TB.escenas.set(id, nueva);
    if (id === TB.escenaId) TB.L.setEscena(nueva);
    TB.lanzar("escenas");
    try { await TB.red.actualizarEscena(id, cambios); } catch (err) { aviso(mensajeError(err), true); }
  };

  /* ------------------------------------------------------------ chat y tiradas */
  function separarTirada(resto) {
    // La expresión es el trozo más largo del principio que se pueda tirar; lo que sigue es la etiqueta
    const palabras = resto.trim().split(/\s+/);
    for (let k = palabras.length; k >= 1; k--) {
      const expr = palabras.slice(0, k).join("");
      try { TBDados.tirar(expr); return { expr, etiqueta: palabras.slice(k).join(" ") }; } catch (e) { /* sigue probando */ }
    }
    return { expr: resto.trim(), etiqueta: "" };
  }
  TB.enviarChat = async function (texto, como) {
    texto = await resolverConsultas(String(texto || ""));
    if (texto === null) return;
    const lineas = String(texto || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const linea of lineas) {
      try { await procesarLinea(linea, como || null); }
      catch (e) { aviso(mensajeError(e), true); }
    }
  };
  // ?{Pregunta} / ?{Pregunta|valor por defecto} / ?{Pregunta|Etiqueta,valor|Otra,valor}. Una misma pregunta se
  // contesta una sola vez aunque salga varias veces. Si se cancela, no se manda nada.
  function resolverConsultas(texto) {
    const re = /\?\{([^{}]*)\}/g, preguntas = new Map();
    let m;
    while ((m = re.exec(texto))) {
      const partes = m[1].split("|"), p = partes[0].trim() || "Valor";
      if (!preguntas.has(p)) preguntas.set(p, partes.slice(1));
    }
    if (!preguntas.size) return Promise.resolve(texto);
    const { el, esc, modal } = TBUI;
    return new Promise(res => {
      const cuerpo = el(`<div></div>`);
      const campos = [];
      preguntas.forEach((ops, p) => {
        let campo;
        if (ops.length > 1) {
          campo = el(`<select>${ops.map(o => { const i = o.indexOf(","); const etq = i >= 0 ? o.slice(0, i) : o, val = i >= 0 ? o.slice(i + 1) : o; return `<option value="${esc(val)}">${esc(etq.trim())}</option>`; }).join("")}</select>`);
        } else { campo = el(`<input type="text">`); campo.value = ops[0] || ""; }
        const f = el(`<label class="tb-campo"><span>${esc(p)}</span></label>`);
        f.appendChild(campo);
        cuerpo.appendChild(f);
        campos.push([p, campo]);
      });
      let hecho = false;
      modal({ titulo: "Antes de tirar", cuerpo, aceptar: "Lanzar", ancho: 440,
        alAceptar: () => {
          hecho = true;
          const r = new Map(campos.map(([p, c]) => [p, c.value]));
          res(texto.replace(re, (t, dentro) => r.get(dentro.split("|")[0].trim() || "Valor") || "0"));
        },
        alCerrar: () => { if (!hecho) res(null); } });
      setTimeout(() => { const c = campos[0] && campos[0][1]; if (c) { c.focus(); if (c.select) c.select(); } }, 30);
      cuerpo.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); const b = document.querySelector(".tb-modal [data-aceptar]"); if (b) b.click(); } });
    });
  }
  async function procesarLinea(linea, como) {
    let m;
    if ((m = linea.match(/^\/(r|roll|gr|gmroll)\s+(.+)$/i))) {
      const modo = /^g/i.test(m[1]) ? "dj" : "todos";
      let resto = m[2];
      const tracker = /&\{tracker\}/i.test(resto);
      resto = resto.replace(/&\{tracker\}/ig, "").trim();
      const { expr, etiqueta } = separarTirada(resto);
      if (tracker) {
        const mt = expr.replace(/\s/g, "").toLowerCase().match(/^1?d20([+-]\d+)?$/);
        const sel = TB.L.seleccion().map(id => TB.L.objeto(id)).find(o => o && (TB.yo.esGM || TB.controla(o)));
        if (mt && sel) { await TB.red.tirarIniciativa(sel.id, parseInt(mt[1] || "0", 10)); return; }
        aviso(sel ? "Para el orden de turno usa una tirada como 1d20+3." : "Selecciona tu ficha para añadirla al orden de turno.", true);
      }
      await TB.red.tirar(expr, etiqueta, modo, como);
      return;
    }
    if ((m = linea.match(/^\/w\s+(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/i))) {
      const quien = m[1] || m[2], texto = m[3];
      if (quien.toLowerCase() === "gm") await TB.red.decir(texto, "dj", null, como);
      else await TB.red.decir(texto, "susurro", quien, como);
      return;
    }
    if (/^\/desc\s/i.test(linea) && !TB.yo.esGM) { aviso("Solo el DJ puede usar /desc.", true); return; }
    await TB.red.decir(linea, "todos", null, como);
  }
  TB.tirar = async (expr, etiqueta, modo) => {
    try { return await TB.red.tirar(expr, etiqueta, modo || TB.prefs.dados.modo); } catch (e) { aviso(mensajeError(e), true); return null; }
  };

  /* ------------------------------------------------------------ orden de turno */
  TB.guardarIniciativa = async ini => {
    TB.estado.iniciativa = ini;
    actualizarTurno();
    TB.lanzar("estado", TB.estado);
    try { await TB.red.actualizarEstado({ iniciativa: ini }); } catch (e) { aviso(mensajeError(e), true); }
  };
  TB.pasarTurno = async paso => { try { await TB.red.turno(paso); } catch (e) { aviso(mensajeError(e), true); } };
  TB.tirarIniciativa = async (id, mod) => { try { await TB.red.tirarIniciativa(id, mod | 0); } catch (e) { aviso(mensajeError(e), true); } };
  TB.anadirAlTurno = async ids => {
    const ini = Object.assign({ lista: [], turno: 0, ronda: 1, visible: true }, TB.estado.iniciativa);
    const lista = (ini.lista || []).slice();
    ids.forEach(id => {
      const o = TB.L.objeto(id);
      if (!o || lista.some(e => e.id === id)) return;
      lista.push({ id, nombre: (o.datos && o.datos.nombre) || "", valor: 0, oculto: o.capa === "gm", src: (o.datos && o.datos.src) || "" });
    });
    await TB.guardarIniciativa(Object.assign(ini, { lista, visible: true }));
  };

  /* ------------------------------------------------------------ lienzo → app */
  let ultimaRegla = 0, reglaPendiente = null, ultimoCursor = 0;
  function callbacksLienzo() {
    return {
      onCambiar: (id, cambios) => TB.cambiarObjeto(id, cambios),
      onMovido: async o => {
        if (TB.yo.esGM) { TB.cambiarObjeto(o.id, { x: o.x, y: o.y }); return; }
        try { await TB.red.moverPropio(o.id, o.x, o.y); }
        catch (e) { aviso(mensajeError(e), true); cargarEscena(TB.escenaId); }
      },
      onMovEnCurso: (id, x, y) => TB.red.emitir("mov", { id, x, y, escena: TB.escenaId }),
      // En la capa Iluminación, lo que se dibuja son muros (del tipo elegido en el panel de iluminación)
      onCrear: filas => TB.crearObjetos(filas.map(f => f.capa === "luz" && f.tipo === "dibujo"
        ? Object.assign({}, f, { datos: Object.assign({}, f.datos, { muro: TB.prefs.muroTipo || "muro", trazo: TBLuz.COLOR_MURO[TB.prefs.muroTipo || "muro"], relleno: "transparent", grosor: 4 }) }) : f)),
      onAviso: t => aviso(t),
      onPuerta: async id => { try { await TB.red.puerta(id); } catch (e) { aviso(mensajeError(e), true); } },
      onAjustesLuz: id => TBPaneles.ajustesLuz(id),
      onBorrar: ids => TB.borrarObjetos(ids),
      onSeleccion: ids => TB.lanzar("seleccion", ids),
      onAbrirAjustes: id => TBPaneles.ajustesFicha(id),
      onEstados: (id, x, y) => TBPaneles.menuEstados(id, x, y),
      onBarra: (id, i, valor) => TB.cambiarBarra(id, i, valor),
      onMenu: (id, x, y) => TBPaneles.menuFicha(id, x, y),
      onRegla: d => {
        const datos = d ? Object.assign({ de: TB.yo.uid, color: TB.colorJugador(TB.yo.uid), escena: TB.escenaId }, d) : { de: TB.yo.uid, escena: TB.escenaId };
        const ahora = Date.now();
        if (!d || ahora - ultimaRegla > 70) { ultimaRegla = ahora; clearTimeout(reglaPendiente); TB.red.emitir("regla", datos); }
        else { clearTimeout(reglaPendiente); reglaPendiente = setTimeout(() => { ultimaRegla = Date.now(); TB.red.emitir("regla", datos); }, 80); }
      },
      onPing: (x, y, centrar) => TB.red.emitir("ping", { x, y, color: TB.colorJugador(TB.yo.uid), centrar: !!centrar && TB.yo.esGM, escena: TB.escenaId }),
      onFx: (a, b, extra) => {
        const t = TBFx.TIPOS.find(x => x.id === TB.prefs.fx.tipo) || TBFx.TIPOS[0];
        const fp = TB.L.opciones().fxPrevia || {};
        const pxPie = TB.L.tamCelda() / (((TB.escena() || {}).cuadricula || {}).pies || 5);
        // Radio de cada efecto con escala 1 (en píxeles): para que el efecto mida lo que dice el panel o lo arrastrado
        const BASE = { bomba: 52, explotar: 90, destello: 85, estrella: 160, agrupacion: 120, quemar: 22, brillo: 45, escudo: 42, rafaga: 50, burbujeante: 25, cohete: 48, misil: 48 };
        let escala = TB.L.tamCelda() / 70;
        const radioPx = (extra && extra.radio) || (fp.radioPies || 10) * pxPie;
        if (BASE[t.id]) escala = Math.max(0.2, Math.min(8, radioPx / BASE[t.id]));
        const d = { tipo: t.id, color: TB.prefs.fx.color, a, b: t.modo === "apuntar" ? b : a, escala, grados: fp.conoGrados, anchoPx: (fp.hazPies || 5) * pxPie, escena: TB.escenaId };
        TB.fx.reproducir(d);
        TB.red.emitir("fx", d);
      },
      onNiebla: n => { if (TB.yo.esGM && TB.escenaId) TB.guardarEscena(TB.escenaId, { niebla: n }); },
      onZoom: z => TB.lanzar("zoom", z),
      onMenuVacio: (p, x, y) => TBPaneles.menuVacio(p, x, y),
      onPin: id => TBPaneles.abrirPin(id),
      onCursor: (x, y) => {
        const ahora = Date.now();
        if (ahora - ultimoCursor < 60) return;
        ultimoCursor = ahora;
        const d = { de: TB.yo.uid, nombre: TB.yo.nombre, color: TB.colorJugador(TB.yo.uid), x, y, escena: TB.escenaId };
        TB.red.emitir("cursor", d);
        TB.L.cursorRemoto(d);
      },
      onSoltar: (dt, p, alt) => TBPaneles.soltarEnTablero(dt, p, alt)
    };
  }

  TB.aplicarEscala();
  window.addEventListener("resize", () => TB.aplicarEscala());
  // Clic derecho: solo nuestro menú (el del navegador se queda para los campos de texto y el chat)
  document.addEventListener("contextmenu", e => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable=true], .tb-chat-lista, .tb-contenido-rico, .tb-modal-cuerpo")) return;
    e.preventDefault();
  });

  /* ------------------------------------------------------------ portapapeles y teclado */
  let portapapeles = [];
  TB.portapapeles = () => portapapeles;
  TB.copiar = ids => { portapapeles = ids.map(id => Object.assign({}, TB.L.objeto(id))).filter(o => o.id); aviso(`Copiado: ${portapapeles.length}`); };
  TB.pegar = async p => {
    if (!portapapeles.length || !TB.yo.esGM) return;
    const cx = portapapeles.reduce((s, o) => s + o.x, 0) / portapapeles.length, cy = portapapeles.reduce((s, o) => s + o.y, 0) / portapapeles.length;
    const creadas = await TB.crearObjetos(portapapeles.map(o => { const c = Object.assign({}, o); delete c.id; delete c.actualizado; return Object.assign(c, TB.L.ajustarPos(c, p.x + o.x - cx, p.y + o.y - cy)); }));
    TB.L.seleccionar(creadas.map(o => o.id));
  };
  function enCampo(e) { const t = e.target; return t && t.closest && t.closest("input, textarea, select, [contenteditable=true]"); }
  document.addEventListener("keydown", async e => {
    if (!TB.L || enCampo(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const sel = TB.L.seleccion();
    if (e.key === " " && !e.repeat) { TB.L.setEspacio(true); e.preventDefault(); return; }
    if (e.key === "Shift") TB.L.setMayus(true);
    if (!ctrl && (e.key === "v" || e.key === "V") && !e.repeat) { TB.L.setArriba(true); return; }
    if (!ctrl && (e.key === "q" || e.key === "Q") && TB.L.midiendo()) { e.preventDefault(); TB.L.puntoDeRuta(); return; }
    if (!ctrl && (e.key === "b" || e.key === "B") && !e.repeat) { TB.L.setCursorB(true); return; }
    if (!ctrl && e.key === "Home") { TB.L.ajustarVista(); return; }
    if (!ctrl && (e.key === "p" || e.key === "P") && TB.yo.esGM) { TBPaneles.alternarPaginas(); return; }
    const k = e.key.toLowerCase();
    if (ctrl && k === "s") { e.preventDefault(); TBPaneles.setHerramienta("seleccionar"); return; }
    if (ctrl && k === "g") { e.preventDefault(); TBPaneles.setHerramienta("texto"); return; }
    if (ctrl && k === "u" && sel.length) { e.preventDefault(); TB.anadirAlTurno(sel); return; }
    if (ctrl && (k === "y" || (e.shiftKey && k === "z")) && TB.yo.esGM) { e.preventDefault(); rehacer(); return; }
    if (ctrl && k === "a") {
      e.preventDefault();
      TB.L.seleccionar(TB.L.objetos().filter(o => (TB.yo.esGM ? o.capa === TB.capa : TB.controla(o)) && (e.shiftKey || o.tipo !== "pin")).map(o => o.id));
      return;
    }
    const CAPA_TECLA = { m: "mapa", o: "fichas", k: "gm", ".": "delantero" };
    if (ctrl && CAPA_TECLA[k] && TB.yo.esGM) {
      e.preventDefault();
      if (e.shiftKey && sel.length) TB.cambiarVarios(sel.map(id => ({ id, cambios: { capa: CAPA_TECLA[k] } })));
      TBPaneles.setCapa(CAPA_TECLA[k]);
      return;
    }
    if (ctrl && k === "," && TB.yo.esGM) { e.preventDefault(); if (e.shiftKey && sel.length) TB.cambiarVarios(sel.map(id => ({ id, cambios: { capa: "luz" } }))); TBPaneles.setCapa("luz"); return; }
    if (e.key === "Escape") { TB.L.deseleccionar(); TB.L.cancelarGesto(); TB.L.limpiarMedida(); TBUI.cerrarMenu(); return; }
    if (e.key === "Enter") { TB.L.terminarPoligono(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); TB.borrarObjetos(sel); return; }
    if (ctrl && e.key.toLowerCase() === "z" && TB.yo.esGM) { e.preventDefault(); deshacer(); return; }
    if (ctrl && e.key.toLowerCase() === "c" && sel.length) { TB.copiar(sel); return; }
    if (ctrl && e.key.toLowerCase() === "v" && portapapeles.length && TB.yo.esGM) { e.preventDefault(); TB.pegar(TB.L.punteroMundo()); return; }
    if (ctrl && e.key.toLowerCase() === "f") { e.preventDefault(); TBPaneles.elegirDibujo("mano"); return; }
    if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); TBPaneles.elegirDibujo("rect"); return; }
    if (e.key.startsWith("Arrow") && sel.length) {
      e.preventDefault();
      const t = e.shiftKey ? TB.L.tamCelda() / 5 : TB.L.tamCelda();
      const dx = e.key === "ArrowLeft" ? -t : e.key === "ArrowRight" ? t : 0, dy = e.key === "ArrowUp" ? -t : e.key === "ArrowDown" ? t : 0;
      if (TB.yo.esGM) TB.cambiarVarios(sel.map(id => { const o = TB.L.objeto(id); return { id, cambios: { x: o.x + dx, y: o.y + dy } }; }));
      else for (const id of sel) { const o = TB.L.objeto(id); if (TB.L.cruzaMuro({ x: o.x, y: o.y }, { x: o.x + dx, y: o.y + dy })) { aviso("Hay un muro en medio."); continue; } try { await TB.red.moverPropio(id, o.x + dx, o.y + dy); TB.red.emitir("mov", { id, x: o.x + dx, y: o.y + dy, escena: TB.escenaId }); } catch (err) { aviso(mensajeError(err), true); } }
    }
  });
  document.addEventListener("keyup", e => {
    if (!TB.L) return;
    if (e.key === " ") TB.L.setEspacio(false);
    if (e.key === "Shift") TB.L.setMayus(false);
    if (e.key === "v" || e.key === "V") TB.L.setArriba(false);
    if (e.key === "b" || e.key === "B") TB.L.setCursorB(false);
  });
  window.addEventListener("blur", () => { if (TB.L) { TB.L.setEspacio(false); TB.L.setMayus(false); TB.L.setArriba(false); TB.L.setCursorB(false); } });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
