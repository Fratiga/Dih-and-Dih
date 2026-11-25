/* Estocatta: el juego en la página.
   Escenas: portada (el claustro con un duelo de autómatas de fondo), puerta de retos
   (jugar en línea), combate, juicio (el resultado) y escuela (lecciones con maniquí o
   autómata). Se pasa de una a otra con una transición de puntos, sin recargar nada.

   Quién decide el combate:
   - local, escuela y portada: la simulación corre aquí (servidor/estocatta/estocatta-sim.js,
     el mismo archivo que usa el servidor);
   - en línea: este archivo NO calcula el combate. Manda teclas al servidor y dibuja los
     estados que recibe, interpolados para que el movimiento sea suave.
   Todo se dibuja en un lienzo de 480×270 ampliado sin suavizado. Los menús son HTML encima
   del lienzo, con el mismo tamaño de píxel (variable CSS --px). */
(function () {
  "use strict";
  const E = window.Estocatta, S = window.EstocattaSprites, M = window.EstocattaMundo;
  if (!E || !S || !M) return;
  const CFG = E.CFG;
  const { AN, AL, SUELO, U } = M;
  const RETARDO_INTERPOLACION = 110;
  const TICK_MS = 1000 / CFG.TICK_HZ;

  const $ = id => document.getElementById(id);
  const canvas = $("estCampo"), ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const ui = $("estUi");
  const mundo = M.crearMundo(CFG);
  const reducido = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================================
     Teclas
     ========================================================================= */

  const ACCIONES = [
    ["izq", "Izquierda"], ["der", "Derecha"], ["salto", "Saltar"], ["agachar", "Agacharse"], ["correr", "Correr (mantener)"],
    ["alt+", "Subir la espada"], ["alt-", "Bajar la espada"], ["estocada", "Estocada"], ["tajo", "Tajo"], ["finta", "Finta"],
    ["guardia", "Guardia (mantener)"], ["parada", "Parada"]
  ];
  const ESQUEMA_1 = { izq: ["KeyA"], der: ["KeyD"], salto: ["KeyW"], agachar: ["KeyS"], correr: ["ShiftLeft"], "alt+": ["KeyQ"], "alt-": ["KeyE"], estocada: ["KeyF"], tajo: ["KeyG"], finta: ["KeyH"], guardia: ["KeyR"], parada: ["KeyT"] };
  const ESQUEMA_2 = { izq: ["ArrowLeft"], der: ["ArrowRight"], salto: ["ArrowUp"], agachar: ["ArrowDown"], correr: ["ShiftRight"], "alt+": ["KeyU"], "alt-": ["KeyO"], estocada: ["KeyJ"], tajo: ["KeyK"], finta: ["KeyL"], guardia: ["KeyI"], parada: ["KeyP"] };
  function esquemaUnido() { const m = {}; ACCIONES.forEach(([a]) => { m[a] = ESQUEMA_1[a].concat(ESQUEMA_2[a]); }); return m; }
  const CLAVE_TECLAS = "compendioEstocattaTeclas";
  let teclasPropias = null;
  try { teclasPropias = JSON.parse(localStorage.getItem(CLAVE_TECLAS) || "null"); } catch (e) { teclasPropias = null; }
  /* El esquema propio sirve para jugar en línea, para la escuela y para el primer jugador en local. */
  function mapaPropio() {
    const base = esquemaUnido();
    if (!teclasPropias) return base;
    const m = {};
    ACCIONES.forEach(([a]) => { m[a] = Array.isArray(teclasPropias[a]) && teclasPropias[a].length ? teclasPropias[a] : base[a]; });
    return m;
  }
  const esquemaLocal1 = () => teclasPropias ? mapaPropio() : ESQUEMA_1;
  const nombreTecla = c => c.replace("Key", "").replace("Digit", "").replace("ShiftLeft", "Mayús izq.").replace("ShiftRight", "Mayús der.")
    .replace("Space", "Espacio").replace("ArrowLeft", "←").replace("ArrowRight", "→").replace("ArrowUp", "↑").replace("ArrowDown", "↓");

  const pulsadas = new Set(), virtuales = new Set();
  const cola = { yo: [], j0: [], j1: [] };
  const EVENTO_DE = { salto: "saltar", estocada: "estocada", tajo: "tajo", finta: "finta", parada: "parada", "alt+": "altura+", "alt-": "altura-" };
  function leerEntrada(esq, c, tactil) {
    const mant = a => esq[a].some(k => pulsadas.has(k)) || (tactil && virtuales.has(a));
    return { mov: (mant("der") ? 1 : 0) - (mant("izq") ? 1 : 0), correr: mant("correr"), agachar: mant("agachar"), guardia: mant("guardia"), ev: c.splice(0, 6) };
  }
  const hayCampoDeTexto = () => { const a = document.activeElement; return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")); };
  let capturando = null;

  window.addEventListener("keydown", e => {
    if (capturando) { e.preventDefault(); if (e.code !== "Escape") reasignar(capturando, e.code); capturando = null; pintarTeclas(); return; }
    if (e.code === "Escape" && !e.repeat) { atras(); e.preventDefault(); return; }
    if (hayCampoDeTexto()) return;
    const juega = enJuego();
    if (juega && /^(Arrow|Space|Shift)/.test(e.code)) e.preventDefault();
    if (!juega) { navegarMenu(e); return; }
    if (e.repeat) return;
    pulsadas.add(e.code);
    if (estado.fuente === "local") {
      const e1 = esquemaLocal1();
      ACCIONES.forEach(([a]) => {
        if (!EVENTO_DE[a]) return;
        if (e1[a].indexOf(e.code) >= 0) cola.j0.push(EVENTO_DE[a]);
        if (ESQUEMA_2[a].indexOf(e.code) >= 0) cola.j1.push(EVENTO_DE[a]);
      });
    } else {
      const m = mapaPropio();
      ACCIONES.forEach(([a]) => { if (EVENTO_DE[a] && m[a].indexOf(e.code) >= 0) cola.yo.push(EVENTO_DE[a]); });
    }
  });
  window.addEventListener("keyup", e => pulsadas.delete(e.code));
  window.addEventListener("blur", () => { pulsadas.clear(); virtuales.clear(); });

  function enJuego() {
    return !estado.pausa && !estado.transicion && ((estado.escena === "combate" && estado.fuente !== "demo") || estado.escena === "escuela");
  }

  /* Navegación con teclado en los menús: flechas para moverse entre botones. */
  function navegarMenu(e) {
    if (e.code !== "ArrowDown" && e.code !== "ArrowUp" && e.code !== "KeyS" && e.code !== "KeyW") return;
    const capa = ui.querySelector(".est-capa.activa");
    if (!capa) return;
    const botones = Array.from(capa.querySelectorAll("button:not([disabled]):not([hidden])")).filter(b => b.offsetParent);
    if (!botones.length) return;
    e.preventDefault();
    const i = botones.indexOf(document.activeElement);
    const sig = e.code === "ArrowDown" || e.code === "KeyS" ? (i + 1) % botones.length : (i - 1 + botones.length) % botones.length;
    botones[i < 0 ? 0 : sig].focus();
  }

  /* Controles táctiles: debajo del lienzo para no tapar a nadie. */
  document.querySelectorAll("#estTactil button").forEach(b => {
    const a = b.dataset.a;
    const mantener = ["izq", "der", "agachar", "correr", "guardia"].indexOf(a) >= 0;
    b.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      try { b.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
      b.classList.add("activo");
      if (mantener) virtuales.add(a);
      else if (EVENTO_DE[a]) (estado.fuente === "local" ? cola.j0 : cola.yo).push(EVENTO_DE[a]);
    });
    const suelta = ev => { ev.preventDefault(); b.classList.remove("activo"); virtuales.delete(a); };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => b.addEventListener(t, suelta));
    b.addEventListener("contextmenu", ev => ev.preventDefault());
  });

  function reasignar(accion, codigo) {
    if (/^(Escape|F\d+|Tab|Enter|Meta|Control|Alt)/.test(codigo)) return;
    const m = mapaPropio();
    ACCIONES.forEach(([a]) => { if (a !== accion) m[a] = m[a].filter(c => c !== codigo); });
    m[accion] = [codigo];
    ACCIONES.forEach(([a]) => { if (!m[a].length) m[a] = ESQUEMA_1[a].slice(); });
    teclasPropias = m;
    try { localStorage.setItem(CLAVE_TECLAS, JSON.stringify(m)); } catch (e) { /* sin almacenamiento */ }
  }
  function pintarTeclas() {
    const t = $("estTeclas");
    if (!t) return;
    const m = mapaPropio();
    t.innerHTML = "";
    ACCIONES.forEach(([a, nombre]) => {
      const fila = document.createElement("button");
      fila.type = "button"; fila.className = "est-fila-tecla" + (capturando === a ? " esperando" : "");
      const n = document.createElement("span"); n.textContent = nombre;
      const k = document.createElement("span"); k.className = "est-teclas";
      if (capturando === a) k.textContent = "pulsa una tecla";
      else m[a].slice(0, 2).forEach(c => { const kb = document.createElement("kbd"); kb.textContent = nombreTecla(c); k.appendChild(kb); });
      fila.append(n, k);
      fila.addEventListener("click", () => { capturando = a; pintarTeclas(); });
      t.appendChild(fila);
    });
  }

  /* =========================================================================
     Sonido (pasa por el volumen común de los minijuegos)
     ========================================================================= */

  let audio = null;
  function tono(f, dur, tipo, vol, hasta, retraso) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t0 = audio.currentTime + (retraso || 0);
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo || "square"; o.frequency.setValueAtTime(f, t0);
      if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* sin audio */ }
  }
  function ruido(dur, vol, filtro) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const n = Math.floor(audio.sampleRate * dur), b = audio.createBuffer(1, n, audio.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = audio.createBufferSource(); s.buffer = b;
      const f = audio.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filtro || 1800;
      const g = audio.createGain(); g.gain.value = vol || 0.05;
      s.connect(f); f.connect(g); g.connect(audio.destination); s.start();
    } catch (e) { /* sin audio */ }
  }
  const SON = {
    zas: () => ruido(0.09, 0.05, 2600),
    tajo: () => ruido(0.16, 0.06, 1400),
    choque: () => { tono(1500, 0.14, "square", 0.05, 700); tono(2300, 0.1, "triangle", 0.04, 900, 0.01); },
    bloqueo: () => { tono(820, 0.09, "square", 0.05, 420); },
    parada: () => { tono(1900, 0.2, "triangle", 0.06, 2700); tono(1300, 0.16, "square", 0.03, 1900, 0.03); },
    muerte: () => { ruido(0.25, 0.08, 600); tono(220, 0.4, "sawtooth", 0.05, 55); },
    reaparece: () => { tono(330, 0.25, "triangle", 0.04, 990); },
    cuenta: () => { tono(520, 0.08, "square", 0.04); },
    empieza: () => { tono(660, 0.08, "square", 0.05); tono(990, 0.25, "square", 0.05, 1320, 0.08); },
    campana: () => { tono(330, 1.1, "triangle", 0.07, 320); tono(660, 0.8, "sine", 0.03, 650); },
    fin: () => { tono(523, 0.18, "triangle", 0.05); tono(659, 0.18, "triangle", 0.05, 0, 0.16); tono(784, 0.4, "triangle", 0.05, 0, 0.32); },
    menu: () => { tono(880, 0.04, "square", 0.025); },
    elige: () => { ruido(0.07, 0.05, 3200); tono(1200, 0.08, "triangle", 0.03, 1700); },
    paso: () => { ruido(0.03, 0.015, 500); }
  };

  /* =========================================================================
     Estado de la página
     ========================================================================= */

  const estado = {
    escena: "titulo",          // titulo | retos | combate | juicio | escuela
    fuente: "demo",            // demo | local | escuela | linea
    sim: null, prev: null, acumulado: 0,
    bots: [null, null],
    efectos: [], camX: CFG.PISTA / 2, camLista: false,
    congelar: 0, ultimaVista: null,
    transicion: null, pausa: false,
    resultado: null, nombres: ["Carmesí", "Turquesa"],
    escuela: { rival: "maniqui", guardia: 1, golpe: 0 },
    titulo: { inicio: performance.now() },
    historial: null
  };
  // lo que el cliente recuerda de cada esgrimista para animarlo (no afecta a las reglas)
  const anim = [0, 1].map(() => ({ capa: S.nuevaCapa(), xPrev: null, dist: 0, zancada: 0, animPrev: "", sombrero: null, aparicion: 1, pasoPrev: 0 }));

  /* =========================================================================
     Autómatas (rivales simulados para la portada y la escuela)
     ========================================================================= */

  function crearBot(nivel, semilla) {
    let s = semilla >>> 0;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const memo = { enfriar: 0, defensa: null, paso: 0, plan: 0 };
    const reflejo = nivel === "demo" ? 0.22 : 0.16;
    return function (sim, i) {
      const f = sim.j[i], o = sim.j[1 - i];
      const e = { mov: 0, correr: false, agachar: false, guardia: false, ev: [] };
      if (!f.vivo || (sim.fase !== "juego" && sim.fase !== "muerte_subita")) return e;
      const salida = i === 0 ? 1 : -1;
      const dx = o.x - f.x, ad = Math.abs(dx), hacia = dx === 0 ? salida : Math.sign(dx);
      const altura = h => { if (f.altura > h) e.ev.push("altura+"); else if (f.altura < h) e.ev.push("altura-"); };
      if (!o.vivo || (sim.ventaja === i && dx * salida < 0)) { e.mov = salida; e.correr = true; return e; }
      if (memo.enfriar > 0) memo.enfriar--;
      // mantener la defensa elegida unos ticks
      if (memo.defensa && memo.defensa.hasta > sim.tick) {
        const d = memo.defensa;
        if (d.tipo === "guardia") { altura(d.h); e.guardia = true; }
        else if (d.tipo === "agachar") e.agachar = true;
        else if (d.tipo === "atras") { e.mov = -hacia; }
        return e;
      }
      memo.defensa = null;
      const oa = o.accion;
      if (oa && (oa.tipo === "estocada" || oa.tipo === "tajo") && oa.fase === "prep" && ad < 240 && r() < reflejo) {
        const q = r();
        if (oa.tipo === "estocada" && oa.altura === 0 && q < 0.25) memo.defensa = { tipo: "agachar", hasta: sim.tick + 10 };
        else if (q < 0.55) memo.defensa = { tipo: "guardia", h: oa.altura, hasta: sim.tick + 10 };
        else if (q < 0.75 && oa.t <= 4) { altura(oa.altura); e.ev.push("parada"); memo.enfriar = 6; return e; }
        else memo.defensa = { tipo: "atras", hasta: sim.tick + 6 };
        return e;
      }
      if (f.accion || f.aturdido) return e;
      if (f.cara !== hacia && ad < 400) { e.mov = hacia; return e; }
      if (ad > 185) {
        e.mov = hacia; e.correr = ad > 520;
        if (ad < 260 && r() < 0.06) { memo.paso = 6; }
        if (memo.paso > 0) { memo.paso--; e.mov = r() < 0.5 ? -hacia : 0; }
        return e;
      }
      if (ad < 85) { e.mov = -hacia; if (r() < 0.04) { e.mov = hacia; e.correr = true; e.ev.push("saltar"); } return e; }
      if (memo.enfriar === 0 && r() < (nivel === "demo" ? 0.16 : 0.1)) {
        // elige altura: evita la que cubre el rival
        let h = Math.floor(r() * 3);
        if (o.guardando && h === o.altura) h = (h + 1 + Math.floor(r() * 2)) % 3;
        altura(h);
        const q = r();
        e.ev.push(q < 0.68 ? "estocada" : q < 0.84 ? "tajo" : "finta");
        memo.enfriar = 10 + Math.floor(r() * 18);
        return e;
      }
      if (r() < 0.08) e.mov = r() < 0.5 ? hacia : -hacia;
      if (r() < 0.04) altura(Math.floor(r() * 3));
      return e;
    };
  }

  /* Maniquí: no se mueve; se cubre a la altura elegida (o no se cubre). */
  function botManiqui(sim, i) {
    const f = sim.j[i], e = { mov: 0, correr: false, agachar: false, guardia: false, ev: [] };
    const g = estado.escuela.guardia;
    if (!f.vivo) return e;
    if (g >= 0) {
      if (f.altura > g) e.ev.push("altura+"); else if (f.altura < g) e.ev.push("altura-");
      e.guardia = true;
    }
    const o = sim.j[1 - i];
    if (!f.accion && Math.sign(o.x - f.x) !== f.cara && o.vivo) e.mov = Math.sign(o.x - f.x);
    return e;
  }

  /* =========================================================================
     Partidas en este navegador (portada, local y escuela)
     ========================================================================= */

  function nuevaSim(fuente) {
    const o = fuente === "escuela" ? { tiempo: 3600 * 1000, sinCuenta: true } : fuente === "demo" ? { sinCuenta: true, tiempo: 90000 } : {};
    estado.sim = E.crearPartida(o);
    estado.prev = estado.sim.j.map(f => ({ x: f.x, y: f.y }));
    estado.acumulado = 0;
    estado.fuente = fuente;
    estado.efectos = [];
    mundo.reiniciar();
    anim.forEach(a => { a.capa = S.nuevaCapa(); a.sombrero = null; a.aparicion = 1; a.xPrev = null; });
    if (fuente === "demo") estado.bots = [crearBot("demo", 7), crearBot("demo", 99)];
    else if (fuente === "escuela") estado.bots = [null, estado.escuela.rival === "maniqui" ? botManiqui : crearBot("escuela", 31)];
    else estado.bots = [null, null];
    if (fuente === "escuela" && estado.escuela.rival === "maniqui") { estado.sim.j[1].x = estado.sim.j[0].x + 260; }
  }

  function pasoSim(dtMs) {
    const sim = estado.sim;
    if (!sim || estado.pausa) return;
    if (performance.now() < estado.congelar) return;
    estado.acumulado += Math.min(dtMs, 100);
    while (estado.acumulado >= TICK_MS && sim.fase !== "fin") {
      estado.prev = sim.j.map(f => ({ x: f.x, y: f.y }));
      let e0, e1;
      if (estado.fuente === "local") { e0 = leerEntrada(esquemaLocal1(), cola.j0, true); e1 = leerEntrada(ESQUEMA_2, cola.j1, false); }
      else if (estado.fuente === "escuela") { e0 = leerEntrada(mapaPropio(), cola.yo, true); e1 = estado.bots[1](sim, 1); }
      else { e0 = estado.bots[0](sim, 0); e1 = estado.bots[1](sim, 1); }
      E.paso(sim, [e0, e1]);
      alEventos(sim.eventos, sim);
      estado.acumulado -= TICK_MS;
      if (performance.now() < estado.congelar) { estado.acumulado = 0; break; }
    }
    if (sim.fase === "fin" && !estado.finProgramado) {
      estado.finProgramado = true;
      if (estado.fuente === "local") setTimeout(() => irAJuicio({ ganador: sim.ganador, motivo: sim.motivo, bajas: [sim.j[0].bajas, sim.j[1].bajas], muertes: [sim.j[0].muertes, sim.j[1].muertes], tiempo: (CFG.TIEMPO_PARTIDA / TICK_MS - sim.reloj) * TICK_MS }), 1900);
      else if (estado.fuente === "demo") setTimeout(() => { if (estado.fuente === "demo") { nuevaSim("demo"); estado.finProgramado = false; } }, 3200);
      else if (estado.fuente === "escuela") setTimeout(() => { if (estado.fuente === "escuela") { nuevaSim("escuela"); estado.finProgramado = false; } }, 2200);
    }
  }

  /* Lo que se dibuja, venga de la simulación local o del servidor. */
  function vistaLocal() {
    const sim = estado.sim, k = Math.min(1, estado.acumulado / TICK_MS);
    return {
      fase: sim.fase, cuenta: sim.cuenta, reloj: sim.reloj, ventaja: sim.ventaja, ganador: sim.ganador, motivo: sim.motivo,
      j: sim.j.map((f, i) => {
        const p = estado.prev[i] || f;
        const salto = Math.abs(f.x - p.x) > 200;
        return {
          x: salto ? f.x : p.x + (f.x - p.x) * k, y: p.y + (f.y - p.y) * k, cara: f.cara, anim: E.animacion(f), altura: f.altura,
          altAccion: f.accion ? f.accion.altura : f.altura, t: f.accion ? f.accion.t : 0, proteccion: f.proteccion > 0, vivo: f.vivo,
          contra: f.contra > 0, muerteT: f.vivo ? 0 : 1 - f.muertoT / E.ms(CFG.REAPARICION), bajas: f.bajas, muertes: f.muertes, guardando: f.guardando
        };
      })
    };
  }

  /* =========================================================================
     Eventos de la partida → efectos, sonido, cámara
     ========================================================================= */

  const px = x => mundo.px(x);
  function efecto(ef) { ef.t0 = performance.now(); estado.efectos.push(ef); if (estado.efectos.length > 30) estado.efectos.shift(); }
  function sacudir(n) { if (!reducido) mundo.sacudida = Math.max(mundo.sacudida, n); }
  function congelar(ms) { estado.congelar = performance.now() + ms; }

  function alEventos(evs, sim) {
    (evs || []).forEach(v => {
      const y = SUELO - 50;
      if (v.e === "choque") {
        efecto({ tipo: "estrella", mx: v.x, y, dur: 260 }); mundo.emitir("chispa", v.x, y, 16, { vel: 120, vida: 0.5, abanico: Math.PI * 2, color: "#ffd27a" });
        mundo.destello(px(v.x), y, 90, "rgba(255,240,200,A)", 0.12); sacudir(4); congelar(60); SON.choque();
      } else if (v.e === "bloqueo") {
        mundo.emitir("chispa", v.x, y + 6, 9, { vel: 90, vida: 0.4, abanico: 2.4, color: "#bfe9ff" }); sacudir(2); congelar(35); SON.bloqueo();
        efecto({ tipo: "letrero", mx: v.x, y: y - 24, dur: 650, texto: "BLOQUEO", color: "#bfe9ff" });
      } else if (v.e === "parada") {
        efecto({ tipo: "anillo", mx: v.x, y, dur: 420, color: "#fff6c8", radio: 26 }); efecto({ tipo: "letrero", mx: v.x, y: y - 26, dur: 800, texto: "¡PARADA!", color: "#fff6c8" });
        mundo.emitir("chispa", v.x, y, 12, { vel: 110, vida: 0.5, abanico: Math.PI * 2, color: "#ffe9a0" }); mundo.destello(px(v.x), y, 110, "rgba(255,240,180,A)", 0.2);
        sacudir(3); congelar(70); SON.parada();
      } else if (v.e === "muerte") {
        const dir = v.por === 1 ? -1 : v.por === 0 ? 1 : (v.quien === 0 ? -1 : 1);
        mundo.emitir("sangre", v.x, SUELO - 42, 26, { vel: 150, vida: 1.2, angulo: dir > 0 ? -0.5 : Math.PI + 0.5, abanico: 1.3, color: Math.random() < 0.5 ? "#b3202e" : "#7a1020" });
        mundo.destello(px(v.x), SUELO - 40, 120, "rgba(255,60,60,A)", 0.18);
        // el sombrero sale volando
        anim[v.quien].sombrero = { x: v.x, y: SUELO - 56, vx: dir * (40 + Math.random() * 40), vy: -150, suelo: false, gira: 0 };
        sacudir(6); congelar(110); SON.muerte();
      } else if (v.e === "doble") {
        efecto({ tipo: "sello", x: AN / 2, y: 60, dur: 1300, texto: "DOBLE BAJA", color: "#ffb08a", escala: 3, pantalla: true });
      } else if (v.e === "reaparece") {
        efecto({ tipo: "haz", mx: v.x, y: SUELO, dur: 700 }); anim[v.quien].aparicion = 0; anim[v.quien].sombrero = null;
        mundo.emitir("polvo", v.x, SUELO - 2, 10, { vel: 40, vida: 0.6, angulo: -Math.PI / 2, abanico: 2.6 }); SON.reaparece();
      } else if (v.e === "empieza") {
        efecto({ tipo: "sello", x: AN / 2, y: 60, dur: 1100, texto: "¡EN GUARDIA!", color: "#fff6c8", escala: 3, pantalla: true }); SON.empieza();
      } else if (v.e === "muerte_subita") {
        efecto({ tipo: "sello", x: AN / 2, y: 60, dur: 2200, texto: "MUERTE SÚBITA", color: "#ff8a6a", escala: 3, pantalla: true }); SON.campana(); sacudir(3);
      } else if (v.e === "fin") {
        SON.fin(); congelar(160);
      }
    });
  }

  /* Reacciones que solo dependen de cómo cambia la animación (sonidos de espada, polvo). */
  function seguirAnimaciones(v, dt, ahora) {
    v.j.forEach((f, i) => {
      const a = anim[i];
      if (a.xPrev === null) a.xPrev = f.x;
      const dx = f.x - a.xPrev; a.xPrev = f.x;
      if (Math.abs(dx) < 120) a.dist += Math.abs(dx);
      a.zancada = (a.dist / (f.anim === "correr" ? 52 : 36)) % 1;
      if (f.anim !== a.animPrev) {
        if (f.anim === "estocada_impacto" || f.anim === "finta_prep") SON.zas();
        if (f.anim === "tajo_impacto") SON.tajo();
        if (f.anim === "aterriza_recup") mundo.emitir("polvo", f.x, SUELO - 1, 6, { vel: 30, vida: 0.5, angulo: -Math.PI / 2, abanico: 3 });
        if (f.anim === "salto") mundo.emitir("polvo", f.x, SUELO - 1, 4, { vel: 20, vida: 0.4, angulo: -Math.PI / 2, abanico: 3 });
        a.animPrev = f.anim;
      }
      const pasoActual = Math.floor(a.zancada * 2);
      if (f.anim === "correr" && pasoActual !== a.pasoPrev) { mundo.emitir("polvo", f.x - f.cara * 6, SUELO - 1, 2, { vel: 14, vida: 0.4, angulo: -Math.PI / 2 - f.cara * 0.8, abanico: 0.8 }); SON.paso(); }
      a.pasoPrev = pasoActual;
      if (a.aparicion < 1) a.aparicion = Math.min(1, a.aparicion + dt * 2.2);
      const s = a.sombrero;
      if (s && !s.suelo) {
        s.vy += 420 * dt; s.x += s.vx / U * dt; s.y += s.vy * dt; s.gira += dt * 12;
        if (s.y >= SUELO - 2) { s.y = SUELO - 2; s.suelo = true; }
      }
    });
  }

  /* =========================================================================
     Dibujo
     ========================================================================= */

  function camara(v, dt) {
    let obj = CFG.PISTA / 2;
    if (v && v.j) {
      const a = v.j[0], b = v.j[1];
      obj = (a.x + b.x) / 2;
      if (Math.abs(a.x - b.x) > 760) {
        const lider = v.ventaja >= 0 ? v.ventaja : (a.x / CFG.PISTA >= (CFG.PISTA - b.x) / CFG.PISTA ? 0 : 1);
        obj = v.j[lider].x + (lider === 0 ? 1 : -1) * 140;
      }
    }
    if (estado.escena === "titulo") obj -= 170;                    // el duelo queda a la derecha del título
    if (estado.escena === "escuela") obj += 120;                   // la lección ocupa la derecha
    if (estado.escena === "juicio" && estado.resultado) obj = estado.resultado.focoX + 170;
    if (estado.escena === "retos") obj = 620;
    const min = 240 / U - 120, max = CFG.PISTA - 240 / U + 120;
    obj = Math.max(min, Math.min(max, obj));
    if (!estado.camLista) { estado.camX = obj; estado.camLista = true; }
    else estado.camX += (obj - estado.camX) * Math.min(1, dt * 5);
    mundo.cam = estado.camX;
  }

  function progreso(f) {
    const [tipo, fase] = f.anim.split("_");
    if (!fase) return 0;
    const total = S.duracionFase(E, tipo, fase);
    return Math.max(0, Math.min(1, 1 - f.t / total));
  }

  function dibujarLuchadores(v, ahora, dt, nombres) {
    const orden = [0, 1].sort((i, j) => (v.j[i].vivo ? 1 : 0) - (v.j[j].vivo ? 1 : 0));
    orden.forEach(i => {
      const f = v.j[i], a = anim[i];
      const x = px(f.x);
      if (x < -120 || x > AN + 120) return;
      const maniqui = estado.fuente === "escuela" && i === 1 && estado.escuela.rival === "maniqui";
      if (!f.vivo) {
        if (!maniqui) S.dibujarCaido(ctx, x, SUELO, f.cara, i, f.muerteT, ahora);
        else S.dibujarManiqui(ctx, x, SUELO + 2, f.cara, -1, 0, ahora);
        return;
      }
      if (maniqui) {
        estado.escuela.golpe = Math.max(0, estado.escuela.golpe - dt * 3);
        S.dibujarManiqui(ctx, x, SUELO, f.cara, f.guardando ? f.altura : -1, estado.escuela.golpe, ahora);
        return;
      }
      S.dibujarEsgrimista(ctx, {
        x, suelo: SUELO, alto: f.y * U, cara: f.cara, anim: f.anim, altura: f.altura, altAccion: f.altAccion, prog: progreso(f),
        zancada: a.zancada, t: ahora, proteccion: f.proteccion, contra: f.contra, capa: a.capa, dt, aparicion: a.aparicion, viento: 30,
        sinSombrero: !!a.sombrero
      }, i);
      if (nombres) {
        const col = S.PALETAS[i].texto;
        S.texto(ctx, nombres[i], x, Math.round(SUELO - f.y * U - 78), { color: col, borde: "#0a0710", alinear: "centro" });
      }
    });
    anim.forEach((a, i) => { if (a.sombrero) S.dibujarSombreroSuelto(ctx, px(a.sombrero.x), a.sombrero.y, i, a.sombrero.suelo, ahora); });
  }

  function dibujarEfectos(ahora) {
    estado.efectos = estado.efectos.filter(ef => {
      const e2 = Object.assign({}, ef);
      if (ef.mx !== undefined) e2.x = px(ef.mx);
      return S.dibujarEfecto(ctx, e2, ahora);
    });
  }

  /* --- HUD de combate, dibujado en el lienzo --- */
  function hud(v, ahora) {
    const T = S.texto, R = S.rect;
    // placa del reloj
    R(ctx, 208, 3, 64, 19, "#0a0710"); R(ctx, 209, 4, 62, 17, "#2a2146"); R(ctx, 209, 4, 62, 1, "#4b3f7a"); R(ctx, 209, 20, 62, 1, "#1a1430");
    const s = Math.max(0, Math.ceil(v.reloj / CFG.TICK_HZ));
    const reloj = estado.fuente === "escuela" ? "--:--" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    const urgente = v.fase === "muerte_subita" || (s <= 10 && v.fase === "juego" && estado.fuente !== "escuela");
    T(ctx, reloj, 240, 8, { escala: 2, color: urgente && Math.floor(ahora / 300) % 2 ? "#ff8a6a" : "#f3ead8", alinear: "centro" });
    // cuerda de la pista con las dos cabezas
    const x0 = 150, x1 = 330, y = 28;
    R(ctx, x0, y, x1 - x0, 1, "#5a4e78");
    R(ctx, x0 - 3, y - 4, 3, 9, S.PALETAS[1].bandera); R(ctx, x1, y - 4, 3, 9, S.PALETAS[0].bandera);
    v.j.forEach((f, i) => {
      const hx = Math.round(x0 + (f.x / CFG.PISTA) * (x1 - x0));
      const c = S.PALETAS[i];
      if (!f.vivo) ctx.globalAlpha = 0.4;
      R(ctx, hx - 2, y - 3, 5, 5, "#0a0710"); R(ctx, hx - 1, y - 2, 3, 3, c.tunica); R(ctx, hx - 3, y - 3, 7, 1, c.oscura);
      ctx.globalAlpha = 1;
      if (v.ventaja === i) { const b = Math.floor(ahora / 250) % 2; R(ctx, hx - 1, y - 8 - b, 3, 1, c.ribete); R(ctx, hx, y - 9 - b, 1, 1, c.ribete); }
    });
    // estandartes con nombre y muescas de bajas
    [0, 1].forEach(i => {
      const c = S.PALETAS[i], izq = i === 0;
      const ancho = 112, xb = izq ? 6 : AN - 6 - ancho;
      R(ctx, xb, 4, ancho, 15, "#0a0710"); R(ctx, xb + 1, 5, ancho - 2, 13, c.bandera); R(ctx, xb + 1, 5, ancho - 2, 1, c.ribete);
      for (let k = 0; k < 4; k++) R(ctx, izq ? xb + ancho - 1 + k : xb - k, 5 + k, 1, 13 - k * 2, "#0a0710");
      const nombre = (estado.nombres[i] || "").slice(0, 14);
      T(ctx, nombre, izq ? xb + 5 : xb + ancho - 5, 8, { color: "#fff6e8", alinear: izq ? "izq" : "der" });
      const bajas = v.j[i].bajas || 0;
      for (let k = 0; k < Math.min(bajas, 12); k++) {
        const mx = izq ? xb + 4 + k * 4 : xb + ancho - 6 - k * 4;
        R(ctx, mx, 21, 2, 6, "#0a0710"); R(ctx, mx, 21, 1, 5, c.texto);
      }
    });
    // «¡ADELANTE!»: quien lleva la ventaja tiene el camino libre
    if (v.ventaja >= 0 && (v.fase === "juego")) {
      const f = v.j[v.ventaja], o = v.j[1 - v.ventaja];
      const libre = f.vivo && (!o.vivo || Math.abs(o.x - f.x) > 520 || (o.x - f.x) * (v.ventaja === 0 ? 1 : -1) < 0);
      if (libre) {
        const dir = v.ventaja === 0 ? 1 : -1, c = S.PALETAS[v.ventaja];
        const b = Math.floor(ahora / 220) % 2;
        const ax = dir > 0 ? AN - 14 : 14, yf = 64;
        for (let n = 0; n < 3; n++) {
          const cx = ax - dir * n * 10 + dir * b * 3;
          const col = n === 0 ? c.ribete : c.texto;
          for (let k = 0; k < 7; k++) { R(ctx, cx - dir * k, yf - k, 2, 1, col); R(ctx, cx - dir * k, yf + k, 2, 1, col); }
        }
        T(ctx, "¡ADELANTE!", dir > 0 ? AN - 8 : 8, yf + 12, { color: c.texto, borde: "#0a0710", alinear: dir > 0 ? "der" : "izq" });
      }
    }
    // cuenta atrás con nombres que entran desde los lados
    if (v.fase === "cuenta") {
      const total = E.ms(CFG.CUENTA_ATRAS), k = 1 - v.cuenta / total;
      const entra = S.suave(Math.min(1, k * 3));
      [0, 1].forEach(i => {
        const c = S.PALETAS[i];
        const w = 150, yb = 108, xb = i === 0 ? Math.round(-w + entra * (w + 62)) : Math.round(AN - entra * (w + 62));
        R(ctx, xb, yb, w, 20, "#0a0710"); R(ctx, xb + 1, yb + 1, w - 2, 18, c.bandera); R(ctx, xb + 1, yb + 1, w - 2, 1, c.ribete);
        T(ctx, (estado.nombres[i] || "").toUpperCase().slice(0, 16), i === 0 ? xb + w - 10 : xb + 10, yb + 6, { escala: 1, color: "#fff6e8", alinear: i === 0 ? "der" : "izq" });
      });
      ctx.globalAlpha = Math.min(1, k * 4);
      T(ctx, "VS", 240, 111, { escala: 2, color: "#f3ead8", borde: "#0a0710", alinear: "centro" });
      ctx.globalAlpha = 1;
      const seg = Math.ceil(v.cuenta / CFG.TICK_HZ);
      if (seg !== estado.ultimaCuenta) {
        estado.ultimaCuenta = seg; SON.cuenta();
        efecto({ tipo: "sello", x: AN / 2, y: 52, dur: 950, texto: String(seg), color: "#f3ead8", escala: 5, pantalla: true });
      }
    } else estado.ultimaCuenta = -1;
    // estado de la red
    if (estado.fuente === "linea") {
      const inestable = performance.now() - red.ultimoMensaje > 2500 && !red.pausa;
      const col = inestable ? "#ff8a6a" : red.rtt > 180 ? "#ffd27a" : "#9fe9b0";
      R(ctx, 8, AL - 12, 3, 5, col);
      T(ctx, inestable ? "SEÑAL DÉBIL" : (red.rtt ? "PING " + red.rtt + " MS" : "..."), 14, AL - 12, { color: col, borde: "#0a0710" });
    }
    if (estado.fuente === "escuela") {
      T(ctx, "ESC: SALIR DE LA ESCUELA", 8, AL - 12, { color: "#bfb2d8", borde: "#0a0710" });
    } else if (estado.fuente === "local") {
      T(ctx, "ESC: PAUSA", 8, AL - 12, { color: "#bfb2d8", borde: "#0a0710" });
    }
  }

  /* --- Portada --- */
  function dibujarPortada(ahora) {
    const t = (ahora - estado.titulo.inicio) / 1000;
    const letras = "ESTOCATTA".split("");
    let x = 24;
    letras.forEach((l, i) => {
      const k = S.suave(Math.min(1, Math.max(0, (t - i * 0.07) / 0.35)));
      const y = Math.round(36 - (1 - k) * 30);
      ctx.globalAlpha = k;
      S.texto(ctx, l, x, y, { escala: 4, color: "#d9b878", luz: "#fff1c8", borde: "#0a0710", sombra: "#2a1830" });
      x += S.anchoTexto(l, 4) + 6;
      ctx.globalAlpha = 1;
    });
    // la espada bajo el título, con un destello que la recorre
    const ky = 74, kx0 = 26, kx1 = Math.min(x, 26 + Math.round(Math.min(1, t / 0.9) * (x - 26)));
    S.rect(ctx, kx0 - 2, ky - 2, 6, 5, "#0a0710"); S.rect(ctx, kx0 - 1, ky - 1, 4, 3, "#c9a24a");
    S.rect(ctx, kx0 + 4, ky - 4, 2, 9, "#0a0710"); S.rect(ctx, kx0 + 4, ky - 3, 1, 7, "#c9a24a");
    S.rect(ctx, kx0 + 6, ky, kx1 - kx0 - 6, 1, "#8796a2"); S.rect(ctx, kx0 + 6, ky - 1, kx1 - kx0 - 6, 1, "#e4ebef");
    const brillo = ((t * 120) % 400) - 60;
    if (brillo > 0 && brillo < kx1 - kx0) S.rect(ctx, kx0 + brillo, ky - 2, 3, 4, "#ffffff");
    if (estado.historial) {
      const h = estado.historial;
      S.texto(ctx, "TU HOJA DE SERVICIOS: " + h.v + " VICTORIAS · " + h.d + " DERROTAS", AN - 10, AL - 14, { color: "#d9cfe6", borde: "#0a0710", alinear: "der" });
    }
  }

  /* --- Puerta de los retos (en línea) --- */
  function dibujarRetos(ahora) {
    mundo.dibujarTablon(ctx, 96, 58, 196, 118, ahora);
    const sala = red.sala;
    const poses = [{ x: 352, cara: 1 }, { x: 432, cara: -1 }];
    [0, 1].forEach(i => {
      const j = sala && sala.jugadores && sala.jugadores[i];
      const p = poses[i];
      if (!j) {
        // plaza libre: una silueta de espera
        if (sala) {
          ctx.globalAlpha = 0.25 + 0.1 * Math.sin(ahora / 500);
          S.rect(ctx, p.x - 5, SUELO - 46, 10, 46, "#8a7ab8");
          ctx.globalAlpha = 1;
          S.texto(ctx, "PLAZA LIBRE", p.x, SUELO - 62, { color: "#8a7ab8", borde: "#0a0710", alinear: "centro" });
        }
        return;
      }
      const listo = j.listo || j.revancha;
      const prog = ((ahora / 1000) % 2.2) / 2.2;
      S.dibujarEsgrimista(ctx, { x: p.x, suelo: SUELO, alto: 0, cara: p.cara, anim: listo ? "saludo" : "descanso", altura: 1, prog: listo ? Math.min(1, prog * 1.4) : 0, t: ahora, capa: anim[i].capa, dt: 1 / 60, aparicion: 1 }, i);
      const nombre = (j.nombre || "").slice(0, 14) + (i === red.yo ? " (TÚ)" : "");
      S.texto(ctx, nombre, p.x, SUELO - 74, { color: S.PALETAS[i].texto, borde: "#0a0710", alinear: "centro" });
      S.texto(ctx, !j.conectado ? "SIN CONEXIÓN" : listo ? "EN GUARDIA" : "ESPERANDO", p.x, SUELO - 64, { color: listo ? "#9fe9b0" : "#bfb2d8", borde: "#0a0710", alinear: "centro" });
    });
  }

  /* --- Juicio (resultado) --- */
  function dibujarJuicio(ahora) {
    const r = estado.resultado;
    if (!r) return;
    const wx = 150;
    const g = r.ganador;
    if (Math.random() < 0.5) mundo.emitir("petalo", Math.random() * 300, -4, 1, { pantalla: true, f: 0, vel: 0, vida: 9, color: Math.random() < 0.5 ? "#c8483a" : "#f4f1ea" });
    if (g >= 0) {
      const p = 1 - g;
      mundo.foco = { x: wx, y: SUELO - 60, r: 150 };
      S.dibujarEsgrimista(ctx, { x: 86, suelo: SUELO, alto: 0, cara: 1, anim: r.revancha[p] ? "saludo" : "derrota", altura: 1, prog: r.revancha[p] ? ((ahora / 1000) % 2.2) / 2.2 : 0, t: ahora, capa: anim[p].capa, dt: 1 / 60 }, p, 2);
      S.dibujarEsgrimista(ctx, { x: wx, suelo: SUELO, alto: 0, cara: -1, anim: r.revancha[g] ? "saludo" : "victoria", altura: 1, prog: r.revancha[g] ? ((ahora / 1000) % 2.2) / 2.2 : 0, t: ahora, capa: anim[g].capa, dt: 1 / 60 }, g, 3);
    } else {
      mundo.foco = { x: 118, y: SUELO - 60, r: 170 };
      [0, 1].forEach(i => S.dibujarEsgrimista(ctx, { x: i === 0 ? 92 : 150, suelo: SUELO, alto: 0, cara: i === 0 ? 1 : -1, anim: r.revancha[i] ? "saludo" : "descanso", altura: 1, prog: ((ahora / 1000) % 2.2) / 2.2, t: ahora, capa: anim[i].capa, dt: 1 / 60 }, i, 2 + i));
    }
  }

  /* --- Transición de puntos (tapa, cambia de escena, destapa) --- */
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function transicion(alMedio, dur) {
    if (estado.transicion) return;
    estado.transicion = { t0: performance.now(), dur: reducido ? 120 : (dur || 520), alMedio, cambiado: false };
  }
  function dibujarTransicion(ahora) {
    const tr = estado.transicion;
    if (!tr) return;
    const k = (ahora - tr.t0) / tr.dur;
    if (k >= 0.5 && !tr.cambiado) { tr.cambiado = true; tr.alMedio(); }
    if (k >= 1) { estado.transicion = null; return; }
    const tapa = k < 0.5 ? k * 2 : (1 - k) * 2;
    const umbral = tapa * 17;
    ctx.fillStyle = "#05030a";
    const c = 8;
    for (let y = 0; y < AL; y += c) for (let x = 0; x < AN; x += c) if (BAYER[(y / c) % 4][(x / c) % 4] < umbral) ctx.fillRect(x, y, c, c);
  }

  /* --- Bucle --- */
  let tAnterior = 0, ultimoDibujo = 0, visible = true;
  const siempre = /[?&]siempre/.test(location.search);       // para capturas automáticas
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);

  function bucle(ahora) {
    requestAnimationFrame(bucle);
    if (!siempre && (!visible || document.hidden)) { tAnterior = ahora; return; }
    // en los menús basta con 30 fotogramas por segundo; en combate, todos
    const combate = enJuego() || estado.fuente === "linea";
    if (!combate && ahora - ultimoDibujo < 32) return;
    const dt = Math.min(0.1, (ahora - (tAnterior || ahora)) / 1000);
    tAnterior = ahora; ultimoDibujo = ahora;
    const t0 = performance.now();

    let v = null;
    if (estado.fuente === "linea" && estado.escena === "combate") { enviarEntrada(ahora); v = vistaEnLinea(ahora); }
    else if (estado.sim && (estado.escena === "titulo" || estado.escena === "combate" || estado.escena === "escuela")) { pasoSim(dt * 1000); v = vistaLocal(); }
    if (v && performance.now() < estado.congelar && estado.ultimaVista) v = estado.ultimaVista;
    if (v) estado.ultimaVista = v;

    camara(estado.escena === "retos" || estado.escena === "juicio" ? null : v, dt);
    if (v) seguirAnimaciones(v, dt, ahora);
    mundo.ambiente = estado.escena === "juicio" ? 0.78 : estado.escena === "retos" ? 0.66 : 0.58;
    if (estado.escena !== "juicio") mundo.foco = null;
    mundo.actualizar(dt, ahora, v && estado.escena !== "titulo" ? v : (v && estado.escena === "titulo" ? v : null));

    ctx.save();
    if (mundo.sacudida > 0.3) { ctx.translate(Math.round((Math.random() - 0.5) * mundo.sacudida), Math.round((Math.random() - 0.5) * mundo.sacudida)); mundo.sacudida *= 0.84; }
    ctx.clearRect(-10, -10, AN + 20, AL + 20);
    mundo.dibujarFondo(ctx, ahora);
    if (estado.escena === "retos") dibujarRetos(ahora);
    else if (estado.escena === "juicio") dibujarJuicio(ahora);
    else if (v) dibujarLuchadores(v, ahora, dt, estado.escena === "combate" && estado.fuente !== "demo" ? estado.nombres : null);
    dibujarEfectos(ahora);
    mundo.dibujarDelante(ctx, ahora);
    mundo.dibujarLuz(ctx, ahora);
    ctx.restore();

    if (estado.escena === "titulo") dibujarPortada(ahora);
    if (v && (estado.escena === "combate" || estado.escena === "escuela")) hud(v, ahora);
    // efectos de pantalla (sellos) por encima de la luz
    estado.efectos.filter(e => e.pantalla).forEach(ef => S.dibujarEfecto(ctx, ef, ahora));

    // pausa por desconexión: el mundo se apaga y corre el reloj de espera
    if (estado.fuente === "linea" && red.pausa && estado.escena === "combate") {
      ctx.save(); ctx.filter = "grayscale(1) brightness(.7)"; ctx.drawImage(canvas, 0, 0); ctx.restore();
      const s = Math.max(0, Math.ceil((red.pausa.hasta - performance.now()) / 1000));
      S.texto(ctx, red.pausa.plaza === red.yo ? "SE CORTÓ TU CONEXIÓN" : "TU RIVAL PERDIÓ LA CONEXIÓN", AN / 2, 110, { escala: 2, color: "#f3ead8", borde: "#0a0710", alinear: "centro" });
      S.texto(ctx, "SE ESPERA " + s + " S. SI NO VUELVE, PIERDE.", AN / 2, 132, { color: "#bfb2d8", borde: "#0a0710", alinear: "centro" });
    }
    if (estado.pausa) { ctx.save(); ctx.filter = "grayscale(.7) brightness(.55)"; ctx.drawImage(canvas, 0, 0); ctx.restore(); }
    dibujarTransicion(ahora);
    estado.msDibujo = (estado.msDibujo || 0) * 0.95 + (performance.now() - t0) * 0.05;   // coste medio de un fotograma
  }

  /* =========================================================================
     Escenas y menús
     ========================================================================= */

  function mostrarCapa(id) {
    ui.querySelectorAll(".est-capa").forEach(c => {
      const activa = c.id === id;
      c.classList.toggle("activa", activa);
      c.setAttribute("aria-hidden", activa ? "false" : "true");
      c.inert = !activa;
    });
    const tactil = $("estTactil");
    if (tactil) tactil.classList.toggle("visible", id === null || id === "estEscuela");
    document.body.dataset.escena = estado.escena;
    if (id) {
      const primero = $(id).querySelector("[data-foco]") || $(id).querySelector("button:not([disabled])");
      if (primero && !hayCampoDeTexto()) setTimeout(() => { try { primero.focus({ preventScroll: true }); } catch (e) { primero.focus(); } }, 60);
    }
  }

  function irATitulo() {
    transicion(() => {
      estado.escena = "titulo"; estado.pausa = false; estado.resultado = null; estado.finProgramado = false;
      estado.titulo.inicio = performance.now();
      nuevaSim("demo"); estado.camLista = false;
      mostrarCapa("estPortada");
      cargarHistorial();
    });
  }

  function empezarLocal() {
    transicion(() => {
      estado.escena = "combate"; estado.pausa = false; estado.finProgramado = false;
      estado.nombres = ["Carmesí", "Turquesa"];
      nuevaSim("local"); estado.camLista = false;
      mostrarCapa(null);
    });
  }

  function abrirEscuela() {
    transicion(() => {
      estado.escena = "escuela"; estado.pausa = false; estado.finProgramado = false;
      estado.nombres = [red.nombre || "Tú", estado.escuela.rival === "maniqui" ? "Maniquí" : "Autómata"];
      nuevaSim("escuela"); estado.camLista = false;
      mostrarCapa("estEscuela"); pintarTeclas(); pintarLeccion();
      ponerOpcionesEscuela();
    });
  }

  function atras() {
    if (estado.transicion) return;
    if (capturando) return;
    if (estado.escena === "combate" && estado.fuente === "local") { alternarPausa(); return; }
    if (estado.escena === "escuela" || estado.escena === "juicio" && estado.fuente !== "linea") { irATitulo(); return; }
    if (estado.escena === "retos") { salirDeRed(); irATitulo(); return; }
    if (estado.escena === "juicio" && estado.fuente === "linea") { enviar({ t: "salir" }); salirDeRed(); irATitulo(); }
  }

  function alternarPausa() {
    estado.pausa = !estado.pausa;
    if (estado.pausa) { mostrarCapa("estPausa"); pulsadas.clear(); }
    else { mostrarCapa(null); estado.acumulado = 0; }
  }

  /* --- Juicio --- */
  const MOTIVOS = {
    salida: "cruzó la puerta del rival", territorio: "llevaba más terreno cuando se acabó el tiempo",
    bajas: "tenía más bajas con el terreno igualado", muerte_subita: "dio el primer golpe en la muerte súbita",
    abandono: "ganó porque su rival abandonó la pista", empate: "nadie ganó la muerte súbita"
  };
  function irAJuicio(r) {
    if (estado.escena === "juicio") return;
    const v = estado.ultimaVista;
    r.focoX = v ? v.j[r.ganador >= 0 ? r.ganador : 0].x : CFG.PISTA / 2;
    r.revancha = [false, false];
    transicion(() => {
      estado.escena = "juicio"; estado.resultado = r;
      const g = r.ganador;
      const yo = estado.fuente === "linea" ? red.yo : -1;
      $("estJuicioTitulo").textContent = g < 0 ? "Empate" : yo >= 0 ? (g === yo ? "Victoria" : "Derrota") : "Gana " + estado.nombres[g];
      $("estJuicioTitulo").dataset.lado = g;
      $("estJuicioMotivo").textContent = g < 0 ? "Nadie cruzó ninguna puerta y " + MOTIVOS.empate + "." : estado.nombres[g] + " " + (MOTIVOS[r.motivo] || r.motivo) + ".";
      const filas = $("estJuicioFilas"); filas.innerHTML = "";
      const fila = (n, a, b) => { const d = document.createElement("div"); d.className = "est-fila"; d.innerHTML = "<span></span><b></b><em></em><b></b>"; d.children[0].textContent = n; d.children[1].textContent = a; d.children[2].textContent = "·"; d.children[3].textContent = b; filas.appendChild(d); };
      const nom = document.createElement("div"); nom.className = "est-fila est-fila-nombres"; nom.innerHTML = "<span></span><b></b><em></em><b></b>";
      nom.children[1].textContent = estado.nombres[0]; nom.children[3].textContent = estado.nombres[1]; filas.appendChild(nom);
      fila("Bajas", r.bajas[0], r.bajas[1]);
      if (r.muertes) fila("Caídas", r.muertes[0], r.muertes[1]);
      if (r.tiempo) { const s = Math.round(r.tiempo / 1000); fila("Tiempo", Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"), ""); }
      if (estado.fuente === "linea" && red.guardado !== undefined) r.guardado = red.guardado;
      $("estJuicioGuardado").textContent = estado.fuente === "linea" ? (r.guardado === undefined ? "Anotando el resultado en el registro..." : r.guardado ? "Resultado anotado en el registro." : "No se pudo anotar el resultado.") : "";
      $("estRevancha").disabled = false;
      $("estRevancha").querySelector("span").textContent = "Revancha";
      mostrarCapa("estJuicio");
    }, 700);
  }

  /* --- Escuela --- */
  const LECCIONES = [
    { t: "Un golpe basta", p: ["Un golpe limpio mata. Después reapareces delante de quien te mató, y él sigue corriendo hacia tu puerta.", "Gana quien cruza la puerta del rival. Matar solo sirve para abrir camino."] },
    { t: "Tres alturas", p: ["Tu espada va alta, media o baja. La estocada solo hiere a esa altura.", "Agacharse esquiva lo alto. Saltar esquiva lo bajo. El tajo barre dos o tres alturas, pero es lento."] },
    { t: "Guardia y parada", p: ["La guardia solo cubre la altura de tu espada y se cansa si la mantienes mucho.", "La parada es un golpe de tiempo. Si el ataque llega justo en su ventana, el rival queda aturdido y tu siguiente estocada sale casi al instante."] },
    { t: "Fintas y riesgos", p: ["La finta amaga sin herir. Desde ella puedes lanzar el ataque de verdad más rápido.", "Todo ataque fallido deja un hueco: castiga al que falla."] },
    { t: "La ventaja", p: ["Quien mata se lleva la ventaja: los estandartes se tiñen de su color cuando los cruza.", "Si se acaba el tiempo, gana quien lleve más terreno. Si están igual, más bajas. Si siguen igual, muerte súbita."] }
  ];
  let leccion = 0;
  function pintarLeccion() {
    const l = LECCIONES[leccion];
    $("estLeccionNum").textContent = "Lección " + (leccion + 1) + " de " + LECCIONES.length;
    $("estLeccionTitulo").textContent = l.t;
    const c = $("estLeccionTexto"); c.innerHTML = "";
    l.p.forEach(t => { const p = document.createElement("p"); p.textContent = t; c.appendChild(p); });
    $("estLeccionAnt").disabled = leccion === 0;
    $("estLeccionSig").disabled = leccion === LECCIONES.length - 1;
  }
  function ponerOpcionesEscuela() {
    document.querySelectorAll("[data-rival]").forEach(b => b.setAttribute("aria-pressed", b.dataset.rival === estado.escuela.rival ? "true" : "false"));
    document.querySelectorAll("[data-guardia]").forEach(b => {
      b.setAttribute("aria-pressed", Number(b.dataset.guardia) === estado.escuela.guardia ? "true" : "false");
      b.disabled = estado.escuela.rival !== "maniqui";
    });
  }

  /* =========================================================================
     En línea
     ========================================================================= */

  const red = { ws: null, listo: false, yo: -1, sala: null, snaps: [], rtt: 0, ultimoMensaje: 0, intentos: 0, pausa: null, ultimaEntrada: "", ultimoEnvio: 0, nombre: "" };

  function urlServidor() {
    let u = window.ESTOCATTA_SERVIDOR || "";
    try {
      const q = new URLSearchParams(location.search).get("servidor");
      if (q && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(q)) u = q;
    } catch (e) { /* sin parámetros */ }
    return u.replace(/\/$/, "");
  }
  const urlSalud = u => u.replace(/^ws/, "http") + "/salud";

  function tablon(estadoTablon, texto) {
    const t = $("estTablon");
    t.dataset.estado = estadoTablon;
    $("estTablonTexto").textContent = texto || "";
  }

  async function despertar(u) {
    for (let i = 0; i < 14; i++) {
      try {
        const c = new AbortController(); const tm = setTimeout(() => c.abort(), 9000);
        const r = await fetch(urlSalud(u), { signal: c.signal, cache: "no-store" });
        clearTimeout(tm);
        if (r.ok) return true;
      } catch (e) { /* sigue dormido */ }
      if (estado.escena !== "retos") return false;
      tablon("conectando", "El heraldo despierta al servidor. La primera vez puede tardar un minuto. (" + (i + 1) + "/14)");
      await new Promise(r => setTimeout(r, 2500));
    }
    return false;
  }

  function abrirRetos() {
    transicion(async () => {
      estado.escena = "retos"; estado.fuente = "linea"; estado.sim = null; red.sala = null;
      mostrarCapa("estRetos");
      const u = urlServidor();
      if (!u) { tablon("aviso", "El servidor de los retos todavía no está en marcha. Mientras tanto se puede jugar en esta mesa o practicar en la escuela."); return; }
      let sesion = null;
      try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
      if (!sesion) { tablon("aviso", "Para retar a alguien hay que iniciar sesión (arriba a la derecha)."); return; }
      tablon("conectando", "Buscando al heraldo...");
      if (!(await despertar(u))) { if (estado.escena === "retos") tablon("aviso", "El servidor no contesta. Inténtalo en unos minutos."); return; }
      conectar(u);
    });
  }

  async function conectar(u) {
    let token = "";
    try { const s = await fichasSesionActual(); token = s && s.access_token; } catch (e) { token = ""; }
    if (!token) { tablon("aviso", "Tu sesión caducó. Inicia sesión de nuevo."); return; }
    let ws;
    try { ws = new WebSocket(u); } catch (e) { tablon("aviso", "La dirección del servidor no es válida."); return; }
    red.ws = ws; red.listo = false;
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hola", token })));
    ws.addEventListener("message", ev => { red.ultimoMensaje = performance.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } alMensaje(m); });
    ws.addEventListener("close", () => {
      if (red.ws !== ws) return;
      red.ws = null; red.listo = false;
      const enCurso = (estado.escena === "combate" && estado.fuente === "linea") || (estado.escena === "retos" && red.sala) || (estado.escena === "juicio" && estado.fuente === "linea" && red.sala);
      if (enCurso && red.intentos < 4) {
        red.intentos++;
        banda("Se perdió la conexión. Reconectando (" + red.intentos + "/4)...");
        setTimeout(() => conectar(u), 1000 * Math.pow(2, red.intentos - 1));
      } else if (enCurso) { banda("No se pudo recuperar la conexión.", 6000); red.sala = null; irATitulo(); }
    });
    ws.addEventListener("error", () => { /* el cierre se trata en "close" */ });
  }
  function enviar(m) { if (red.ws && red.ws.readyState === 1) red.ws.send(JSON.stringify(m)); }
  function salirDeRed() {
    if (red.ws) { try { red.ws.close(); } catch (e) { /* ya cerrada */ } }
    red.ws = null; red.sala = null; red.snaps = []; red.pausa = null; red.listo = false; red.intentos = 0;
  }

  function banda(texto, ms) {
    const b = $("estBanda");
    if (!texto) { b.classList.remove("visible"); return; }
    b.textContent = texto; b.classList.add("visible");
    clearTimeout(banda.t);
    if (ms) banda.t = setTimeout(() => b.classList.remove("visible"), ms);
  }

  function alMensaje(m) {
    switch (m.t) {
      case "ok":
        red.listo = true; red.intentos = 0; red.nombre = m.nombre; banda("");
        if (!m.reconectado && estado.escena === "retos") tablon("menu", "Saludos, " + m.nombre + ". Clava un reto en el tablón o responde al de tu rival con su código.");
        break;
      case "error":
        if (["token", "prohibido", "sin_sesion"].indexOf(m.codigo) >= 0) { red.intentos = 99; tablon("aviso", m.mensaje); }
        else { banda(m.mensaje, 4000); const c = $("estCodigo"); if (c && m.codigo === "sala_inexistente") { c.classList.remove("temblor"); void c.offsetWidth; c.classList.add("temblor"); } }
        break;
      case "sala": alSala(m); break;
      case "est": alEstado(m); break;
      case "pausa": red.pausa = { ms: m.ms, hasta: performance.now() + m.ms, plaza: m.plaza }; break;
      case "reanuda": red.pausa = null; break;
      case "guardado":
        red.guardado = m.guardado;
        if (estado.resultado) estado.resultado.guardado = m.guardado;
        $("estJuicioGuardado").textContent = m.guardado ? "Resultado anotado en el registro." : "No se pudo anotar el resultado: el servidor no lo confirmó.";
        break;
      case "pong": red.rtt = Math.round(performance.now() - m.c); break;
      case "salio": salirDeRed(); irATitulo(); break;
      default: break;
    }
  }

  function alSala(m) {
    red.yo = m.yo; red.sala = m;
    estado.nombres = [(m.jugadores[0] && m.jugadores[0].nombre) || "Carmesí", (m.jugadores[1] && m.jugadores[1].nombre) || "Turquesa"];
    if (m.estado === "espera") {
      if (estado.escena !== "retos") { transicion(() => { estado.escena = "retos"; estado.resultado = null; mostrarCapa("estRetos"); }); }
      tablon("sala", "");
      $("estCodigoSala").textContent = m.codigo;
      const yo = m.jugadores[m.yo], ambos = m.jugadores[0] && m.jugadores[1];
      $("estListo").querySelector("span").textContent = yo && yo.listo ? "Bajar la espada" : "En guardia";
      $("estListo").disabled = !ambos;
      $("estSalaEstado").textContent = !ambos ? "Esperando a que alguien responda al reto." : yo && yo.listo ? "Esperando a que tu rival se ponga en guardia." : "Tu rival ha llegado. Ponte en guardia cuando quieras.";
    } else if (m.estado === "fin" && estado.resultado) {
      const yo = m.jugadores[m.yo], otro = m.jugadores[1 - m.yo];
      estado.resultado.revancha = [!!(m.jugadores[0] && m.jugadores[0].revancha), !!(m.jugadores[1] && m.jugadores[1].revancha)];
      const b = $("estRevancha");
      b.querySelector("span").textContent = !otro ? "Tu rival se fue" : yo && yo.revancha ? "Esperando al rival..." : otro.revancha ? "Aceptar la revancha" : "Revancha";
      b.disabled = !otro || !!(yo && yo.revancha);
    }
  }

  function alEstado(m) {
    const ahora = performance.now();
    if (m.ini) {
      red.snaps = []; red.guardado = undefined;
      const empezar = () => {
        estado.escena = "combate"; estado.fuente = "linea"; estado.resultado = null; estado.efectos = []; estado.camLista = false; estado.finProgramado = false;
        mundo.reiniciar(); anim.forEach(a => { a.capa = S.nuevaCapa(); a.sombrero = null; a.aparicion = 1; a.xPrev = null; });
        mostrarCapa(null);
      };
      if (estado.escena === "combate") empezar(); else transicion(empezar);
    }
    red.snaps.push({ rec: ahora, s: m });
    if (red.snaps.length > 40) red.snaps.shift();
    alEventos(m.ev);
    if (m.f === "fin" && !estado.finProgramado) {
      estado.finProgramado = true;
      const j = m.j;
      setTimeout(() => irAJuicio({ ganador: m.g, motivo: m.m, bajas: [j[0].b, j[1].b], muertes: [j[0].d, j[1].d] }), 1900);
    }
  }

  function vistaEnLinea(ahora) {
    const s = red.snaps;
    if (!s.length) return null;
    const rt = ahora - RETARDO_INTERPOLACION;
    let a = s[0], b = s[s.length - 1];
    for (let i = s.length - 1; i > 0; i--) { if (s[i - 1].rec <= rt) { a = s[i - 1]; b = s[i]; break; } if (i === 1) { a = s[0]; b = s[1] || s[0]; } }
    const k = b.rec === a.rec ? 1 : Math.max(0, Math.min(1, (rt - a.rec) / (b.rec - a.rec)));
    const sb = b.s;
    return {
      fase: sb.f, cuenta: sb.c, reloj: sb.r, ventaja: sb.v, ganador: sb.g, motivo: sb.m,
      j: sb.j.map((fb, i) => {
        const fa = a.s.j[i] || fb;
        const mismo = Math.abs(fb.x - fa.x) < 400;
        return {
          x: mismo ? fa.x + (fb.x - fa.x) * k : fb.x, y: fa.y + (fb.y - fa.y) * k, cara: fb.c, anim: fb.a, altura: fb.h, altAccion: fb.ha,
          t: fa.a === fb.a ? fa.t + (fb.t - fa.t) * k : fb.t, proteccion: !!fb.p, vivo: !!fb.vivo, contra: !!fb.ct,
          muerteT: fb.vivo ? 0 : 1 - fb.mt / E.ms(CFG.REAPARICION), bajas: fb.b, muertes: fb.d
        };
      })
    };
  }

  function enviarEntrada(ahora) {
    if (!red.ws || red.ws.readyState !== 1) return;
    const e = leerEntrada(mapaPropio(), cola.yo, true);
    const clave = e.mov + "|" + e.correr + "|" + e.agachar + "|" + e.guardia;
    if (clave !== red.ultimaEntrada || e.ev.length || ahora - red.ultimoEnvio > 400) {
      red.ultimaEntrada = clave; red.ultimoEnvio = ahora;
      enviar({ t: "in", mov: e.mov, correr: e.correr, agachar: e.agachar, guardia: e.guardia, ev: e.ev });
    }
  }
  setInterval(() => { if (red.ws && red.ws.readyState === 1) enviar({ t: "ping", c: performance.now() }); }, 2000);

  /* Hoja de servicios: victorias y derrotas en línea, si la tabla ya existe. */
  async function cargarHistorial() {
    try {
      if (typeof fichasSesionActual !== "function") return;
      const s = await fichasSesionActual();
      if (!s) { estado.historial = null; return; }
      const sb = await fichasCliente();
      const id = s.user.id;
      const { data, error } = await sb.from("estocatta_partidas").select("j0,j1,ganador").or("j0.eq." + id + ",j1.eq." + id).limit(500);
      if (error || !data) { estado.historial = null; return; }
      let v = 0, d = 0;
      data.forEach(p => { const yo = p.j0 === id ? 0 : 1; if (p.ganador === yo) v++; else if (p.ganador === 1 - yo) d++; });
      estado.historial = data.length ? { v, d } : null;
    } catch (e) { estado.historial = null; }
  }

  /* =========================================================================
     Botones
     ========================================================================= */

  function boton(id, fn) {
    const b = $(id);
    if (!b) return;
    b.addEventListener("click", () => { SON.elige(); b.classList.remove("pulsado"); void b.offsetWidth; b.classList.add("pulsado"); fn(); });
    b.addEventListener("focus", () => SON.menu());
  }
  boton("estIrLocal", empezarLocal);
  boton("estIrRetos", abrirRetos);
  boton("estIrEscuela", abrirEscuela);
  boton("estRetosVolver", () => { if (red.sala) enviar({ t: "salir" }); salirDeRed(); irATitulo(); });
  boton("estCrear", () => enviar({ t: "crear" }));
  $("estUnirForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const c = $("estCodigo").value.trim();
    if (c) { SON.elige(); enviar({ t: "unir", codigo: c }); }
  });
  boton("estListo", () => { const yo = red.sala && red.sala.jugadores[red.sala.yo]; enviar({ t: "listo", listo: !(yo && yo.listo) }); });
  boton("estSalaSalir", () => { enviar({ t: "salir" }); red.sala = null; tablon("menu", "Retiraste el reto. Puedes clavar otro o responder a uno."); });
  boton("estRevancha", () => {
    if (estado.fuente === "linea") {
      if (red.ws) enviar({ t: "revancha" });
    } else empezarLocal();
  });
  boton("estJuicioSalir", () => { if (estado.fuente === "linea") { enviar({ t: "salir" }); salirDeRed(); } irATitulo(); });
  boton("estPausaSeguir", alternarPausa);
  boton("estPausaSalir", () => { estado.pausa = false; irATitulo(); });
  boton("estEscuelaSalir", irATitulo);
  boton("estLeccionAnt", () => { leccion = Math.max(0, leccion - 1); pintarLeccion(); });
  boton("estLeccionSig", () => { leccion = Math.min(LECCIONES.length - 1, leccion + 1); pintarLeccion(); });
  document.querySelectorAll("[data-rival]").forEach(b => b.addEventListener("click", () => {
    SON.elige(); estado.escuela.rival = b.dataset.rival;
    estado.nombres[1] = estado.escuela.rival === "maniqui" ? "Maniquí" : "Autómata";
    nuevaSim("escuela"); ponerOpcionesEscuela();
  }));
  document.querySelectorAll("[data-guardia]").forEach(b => b.addEventListener("click", () => { SON.elige(); estado.escuela.guardia = Number(b.dataset.guardia); ponerOpcionesEscuela(); }));
  boton("estRestablecer", () => { teclasPropias = null; try { localStorage.removeItem(CLAVE_TECLAS); } catch (e) { /* nada */ } pintarTeclas(); });
  boton("estPantalla", () => {
    const el = $("estJuego");
    if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });

  /* El maniquí tiembla cuando lo golpean; la escuela comenta lo que pasa. */
  const alEventosBase = alEventos;
  alEventos = function (evs, sim) {
    alEventosBase(evs, sim);
    if (estado.fuente !== "escuela") return;
    (evs || []).forEach(v => {
      if ((v.e === "bloqueo" || v.e === "muerte") && estado.escuela.rival === "maniqui") estado.escuela.golpe = 1;
      if (v.e === "muerte" && v.quien === 1) efecto({ tipo: "letrero", mx: v.x, y: SUELO - 80, dur: 900, texto: "¡TOCADO!", color: "#9fe9b0" });
    });
  };

  /* --- Tamaño del píxel para el HTML que va encima del lienzo --- */
  function ajustar() {
    const r = canvas.getBoundingClientRect();
    ui.style.setProperty("--px", (r.width / AN) + "px");
  }
  if ("ResizeObserver" in window) new ResizeObserver(ajustar).observe(canvas);
  window.addEventListener("resize", ajustar);
  ajustar();

  // arranque: la portada con el duelo de fondo
  estado.escena = "titulo";
  nuevaSim("demo");
  mostrarCapa("estPortada");
  cargarHistorial();
  requestAnimationFrame(bucle);

  // para las pruebas desde fuera
  window.EstocattaPagina = { estado, red, mundo, anim, nuevaSim, irAJuicio, empezarLocal, abrirEscuela, abrirRetos, irATitulo, vistaLocal };
})();
