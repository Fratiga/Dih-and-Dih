/* Estocatta: la página del juego.
   - Modo local: dos jugadores en el mismo navegador. Aquí corre la simulación completa
     (servidor/estocatta/estocatta-sim.js), la misma que usa el servidor.
   - Modo en línea: este archivo NO calcula nada del combate. Manda las teclas al servidor
     y dibuja los estados que recibe, interpolándolos para que el movimiento sea suave.
   Se dibuja sobre un lienzo de 480×270 que la página amplía sin suavizado. */
(function () {
  const E = window.Estocatta;
  const S = window.EstocattaSprites;
  if (!E || !S) return;
  const CFG = E.CFG;

  const AN = 480, AL = 270;               // lienzo en píxeles
  const SUELO = 214;                      // y del suelo en el lienzo
  const U = 0.5;                          // píxeles por unidad lógica
  const VISTA = AN / U;                   // unidades que caben a lo ancho (960)
  const RETARDO_INTERPOLACION = 110;      // ms de retraso al dibujar el estado del servidor

  const $ = id => document.getElementById(id);
  const canvas = $("estCampo");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  /* ---------- Teclas ---------- */

  const ACCIONES = [
    ["izq", "Ir a la izquierda"], ["der", "Ir a la derecha"], ["salto", "Saltar"], ["agachar", "Agacharse"], ["correr", "Correr (mantener)"],
    ["alt+", "Subir la espada"], ["alt-", "Bajar la espada"], ["estocada", "Estocada"], ["tajo", "Tajo"], ["finta", "Finta"],
    ["guardia", "Guardia (mantener)"], ["parada", "Parada"]
  ];
  const ESQUEMA_1 = { izq: ["KeyA"], der: ["KeyD"], salto: ["KeyW"], agachar: ["KeyS"], correr: ["ShiftLeft"], "alt+": ["KeyQ"], "alt-": ["KeyE"], estocada: ["KeyF"], tajo: ["KeyG"], finta: ["KeyH"], guardia: ["KeyR"], parada: ["KeyT"] };
  const ESQUEMA_2 = { izq: ["ArrowLeft"], der: ["ArrowRight"], salto: ["ArrowUp"], agachar: ["ArrowDown"], correr: ["ShiftRight"], "alt+": ["KeyU"], "alt-": ["KeyO"], estocada: ["KeyJ"], tajo: ["KeyK"], finta: ["KeyL"], guardia: ["KeyI"], parada: ["KeyP"] };
  // en línea: el esquema 1 y el 2 a la vez, para que cada quien use la mano que prefiera
  function esquemaEnLinea() {
    const m = {};
    ACCIONES.forEach(([a]) => { m[a] = ESQUEMA_1[a].concat(ESQUEMA_2[a]); });
    return m;
  }
  const CLAVE_TECLAS = "compendioEstocattaTeclas";
  let teclasPropias = null;
  try { teclasPropias = JSON.parse(localStorage.getItem(CLAVE_TECLAS) || "null"); } catch (e) { teclasPropias = null; }
  function mapaPropio() {
    const base = esquemaEnLinea();
    if (!teclasPropias) return base;
    const m = {};
    ACCIONES.forEach(([a]) => { m[a] = Array.isArray(teclasPropias[a]) && teclasPropias[a].length ? teclasPropias[a] : base[a]; });
    return m;
  }
  function esquemaJugador1Local() {
    if (!teclasPropias) return ESQUEMA_1;
    return mapaPropio();
  }

  const nombreTecla = code => code.replace("Key", "").replace("Arrow", "").replace("ShiftLeft", "Mayús izq.").replace("ShiftRight", "Mayús der.").replace("Space", "Espacio")
    .replace("Left", "←").replace("Right", "→").replace("Up", "↑").replace("Down", "↓");

  const pulsadas = new Set();                 // códigos de teclado mantenidos
  const virtuales = new Set();                // botones táctiles mantenidos
  const eventosEnCola = { yo: [], j0: [], j1: [] };

  function hayCampoDeTexto() {
    const a = document.activeElement;
    return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable));
  }

  /* Estado de entrada de un esquema: lo que se mantiene y lo que se acaba de pulsar. */
  function leerEntrada(esquema, cola, virtualesVale) {
    const mantiene = a => esquema[a].some(c => pulsadas.has(c)) || (virtualesVale && virtuales.has(a));
    const ev = cola.splice(0, 6);
    return {
      mov: (mantiene("der") ? 1 : 0) - (mantiene("izq") ? 1 : 0),
      correr: mantiene("correr"), agachar: mantiene("agachar"), guardia: mantiene("guardia"), ev
    };
  }

  const EVENTO_DE = { salto: "saltar", estocada: "estocada", tajo: "tajo", finta: "finta", parada: "parada", "alt+": "altura+", "alt-": "altura-" };

  let capturando = null;                      // acción cuya tecla se está reasignando

  window.addEventListener("keydown", e => {
    if (capturando) {
      e.preventDefault();
      if (e.code !== "Escape") reasignar(capturando, e.code);
      capturando = null; pintarTabla();
      return;
    }
    if (hayCampoDeTexto()) return;
    if (!modoActivo()) return;
    const juegoCorre = estado.pantalla === "local" || estado.pantalla === "juego";
    if (juegoCorre && /^(Arrow|Space|Shift)/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    pulsadas.add(e.code);
    if (estado.pantalla === "local") {
      const e1 = esquemaJugador1Local(), e2 = ESQUEMA_2;
      ACCIONES.forEach(([a]) => {
        if (EVENTO_DE[a] && e1[a].indexOf(e.code) >= 0) eventosEnCola.j0.push(EVENTO_DE[a]);
        if (EVENTO_DE[a] && e2[a].indexOf(e.code) >= 0) eventosEnCola.j1.push(EVENTO_DE[a]);
      });
    } else if (estado.pantalla === "juego") {
      const m = mapaPropio();
      ACCIONES.forEach(([a]) => { if (EVENTO_DE[a] && m[a].indexOf(e.code) >= 0) eventosEnCola.yo.push(EVENTO_DE[a]); });
    }
  });
  window.addEventListener("keyup", e => { pulsadas.delete(e.code); });
  window.addEventListener("blur", () => { pulsadas.clear(); virtuales.clear(); });

  function modoActivo() { return estado.pantalla === "local" || estado.pantalla === "juego"; }

  /* ---------- Controles táctiles ---------- */

  document.querySelectorAll("#estTactil button").forEach(b => {
    const a = b.dataset.a;
    const tiene = ["izq", "der", "agachar", "correr", "guardia"].indexOf(a) >= 0;
    b.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      try { b.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
      b.classList.add("activo");
      if (tiene) virtuales.add(a);
      else if (EVENTO_DE[a]) {
        if (estado.pantalla === "juego") eventosEnCola.yo.push(EVENTO_DE[a]);
        else if (estado.pantalla === "local") eventosEnCola.j0.push(EVENTO_DE[a]);
      }
    });
    const suelta = ev => { ev.preventDefault(); b.classList.remove("activo"); virtuales.delete(a); };
    b.addEventListener("pointerup", suelta); b.addEventListener("pointercancel", suelta); b.addEventListener("lostpointercapture", suelta);
    b.addEventListener("contextmenu", ev => ev.preventDefault());
  });

  /* ---------- Reasignación de teclas ---------- */

  function reasignar(accion, codigo) {
    if (/^(Escape|F\d+|Tab|Enter|Meta|Control|Alt)/.test(codigo)) return;
    const mapa = mapaPropio();
    // si otra acción ya usaba esa tecla, se intercambian
    ACCIONES.forEach(([a]) => { if (a !== accion) mapa[a] = mapa[a].filter(c => c !== codigo); });
    mapa[accion] = [codigo];
    ACCIONES.forEach(([a]) => { if (!mapa[a].length) mapa[a] = ESQUEMA_1[a].slice(); });
    teclasPropias = mapa;
    try { localStorage.setItem(CLAVE_TECLAS, JSON.stringify(mapa)); } catch (e) { /* sin almacenamiento */ }
  }
  function pintarTabla() {
    const t = $("estTabla");
    const mapa = mapaPropio();
    t.innerHTML = "<tr><th>Acción</th><th>Tecla</th><th></th></tr>";
    ACCIONES.forEach(([a, nombre]) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td"); td1.textContent = nombre;
      const td2 = document.createElement("td"); td2.textContent = capturando === a ? "Pulsa una tecla..." : mapa[a].map(nombreTecla).join(" / ");
      const td3 = document.createElement("td");
      const b = document.createElement("button"); b.type = "button"; b.className = "est-enlace"; b.textContent = "Cambiar";
      b.addEventListener("click", () => { capturando = a; pintarTabla(); });
      td3.appendChild(b);
      tr.append(td1, td2, td3); t.appendChild(tr);
    });
  }
  $("estRestablecer").addEventListener("click", () => {
    teclasPropias = null; try { localStorage.removeItem(CLAVE_TECLAS); } catch (e) { /* nada */ }
    pintarTabla();
  });
  $("estAyudaBtn").addEventListener("click", () => {
    const c = $("estControles"); c.classList.toggle("hidden"); if (!c.classList.contains("hidden")) pintarTabla();
  });
  $("estPantalla").addEventListener("click", () => {
    const el = $("estEscenario");
    if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });

  /* ---------- Sonido (se silencia con el control de volumen de la página) ---------- */

  let audio = null;
  function tono(frec, dur, tipo, vol, hasta, retraso) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t0 = audio.currentTime + (retraso || 0);
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo || "square"; o.frequency.setValueAtTime(frec, t0);
      if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* sin audio */ }
  }
  const SONIDOS = {
    choque: () => { tono(1400, 0.12, "square", 0.05, 600); tono(900, 0.1, "triangle", 0.05, 400, 0.02); },
    bloqueo: () => { tono(700, 0.09, "square", 0.05, 380); },
    parada: () => { tono(1800, 0.18, "triangle", 0.06, 2600); tono(1200, 0.18, "square", 0.03, 1800, 0.03); },
    muerte: () => { tono(260, 0.35, "sawtooth", 0.06, 60); },
    doble: () => { tono(300, 0.45, "sawtooth", 0.06, 50); },
    reaparece: () => { tono(300, 0.16, "triangle", 0.04, 700); },
    cuenta: () => { tono(520, 0.08, "square", 0.04); },
    empieza: () => { tono(780, 0.2, "square", 0.05, 1200); },
    fin: () => { tono(520, 0.18, "triangle", 0.05, 780); tono(780, 0.3, "triangle", 0.05, 1040, 0.18); }
  };

  /* ---------- Estado de la página ---------- */

  const estado = {
    pantalla: "menu",              // menu | linea | sala | juego | local | fin
    sim: null, prev: null,         // modo local
    efectos: [], temblor: 0,
    cam: CFG.PISTA / 2, camInicial: false,
    ultimaCuenta: -1, ultimoReloj: 0,
    finTimer: 0
  };

  function mostrar(que) {
    ["estMenu", "estLinea", "estSala", "estFin"].forEach(id => $(id).classList.toggle("hidden", id !== que));
  }
  function aviso(texto, ms) {
    const b = $("estBanda");
    if (!texto) { b.classList.add("hidden"); return; }
    b.textContent = texto; b.classList.remove("hidden");
    clearTimeout(aviso.t);
    if (ms) aviso.t = setTimeout(() => b.classList.add("hidden"), ms);
  }

  /* ---------- Modo local ---------- */

  const NOMBRES = ["Jugador 1", "Jugador 2"];
  function empezarLocal() {
    NOMBRES[0] = "Jugador 1"; NOMBRES[1] = "Jugador 2";
    estado.sim = E.crearPartida();
    estado.prev = clonarPos(estado.sim);
    estado.pantalla = "local"; estado.efectos = []; estado.camInicial = false; estado.ultimaCuenta = -1;
    mostrar(null);
    $("estHud").classList.remove("hidden");
    $("estN0").textContent = NOMBRES[0]; $("estN1").textContent = NOMBRES[1];
    aviso("");
  }
  function clonarPos(sim) { return sim.j.map(f => ({ x: f.x, y: f.y })); }

  let acumulado = 0, tAnterior = 0;
  function pasoLocal(dtMs) {
    const sim = estado.sim;
    acumulado += Math.min(dtMs, 100);
    const paso = 1000 / CFG.TICK_HZ;
    while (acumulado >= paso && sim.fase !== "fin") {
      estado.prev = clonarPos(sim);
      const e0 = leerEntrada(esquemaJugador1Local(), eventosEnCola.j0, true);
      const e1 = leerEntrada(ESQUEMA_2, eventosEnCola.j1, false);
      E.paso(sim, [e0, e1]);
      procesarEventos(sim.eventos);
      acumulado -= paso;
    }
    if (sim.fase === "fin" && estado.pantalla === "local") {
      estado.pantalla = "fin";
      setTimeout(() => mostrarFinLocal(), 1100);
    }
  }
  function textoMotivo(m) {
    return { salida: "llegó a la salida", territorio: "tenía más terreno ganado cuando se acabó el tiempo", bajas: "tenía más bajas al acabarse el tiempo y el mismo terreno",
      muerte_subita: "dio el primer golpe en la muerte súbita", abandono: "ganó porque el rival abandonó", empate: "empate: nadie ganó la muerte súbita" }[m] || m;
  }
  function mostrarFinLocal() {
    if (estado.pantalla !== "fin") return;
    const g = estado.sim.ganador;
    $("estFinTitulo").textContent = g < 0 ? "Empate" : "Gana " + NOMBRES[g];
    $("estFinTexto").textContent = g < 0 ? textoMotivo(estado.sim.motivo) : NOMBRES[g] + " " + textoMotivo(estado.sim.motivo) + ".";
    $("estFinGuardado").textContent = "";
    $("estRevancha").textContent = "Otra partida";
    estado.finEnLinea = false;
    mostrar("estFin");
  }

  /* ---------- Efectos ---------- */

  function px(x) { return (x - estado.cam + VISTA / 2) * U; }
  function agregar(ef) { ef.t0 = performance.now(); ef.semilla = Math.random() * 6; estado.efectos.push(ef); if (estado.efectos.length > 40) estado.efectos.shift(); }

  function procesarEventos(evs) {
    (evs || []).forEach(v => {
      if (v.e === "choque") { agregar({ tipo: "chispas", x: v.x, dur: 380 }); agregar({ tipo: "onda", x: v.x, dur: 300, color: "#ffffff" }); estado.temblor = 4; SONIDOS.choque(); }
      else if (v.e === "bloqueo") { agregar({ tipo: "chispas", x: v.x, dur: 300, color: "#bfe9ff" }); estado.temblor = 2; SONIDOS.bloqueo(); }
      else if (v.e === "parada") { agregar({ tipo: "onda", x: v.x, dur: 420, color: "#fff6c8" }); agregar({ tipo: "texto", x: v.x, dur: 700, texto: "¡PARADA!", color: "#fff6c8" }); estado.temblor = 3; SONIDOS.parada(); }
      else if (v.e === "muerte") { agregar({ tipo: "sangre", x: v.x, dur: 650, dir: v.por === 1 ? -1 : 1 }); estado.temblor = 5; SONIDOS.muerte(); }
      else if (v.e === "doble") { agregar({ tipo: "onda", x: v.x, dur: 500, color: "#ff8a6a" }); agregar({ tipo: "texto", x: v.x, dur: 800, texto: "DOBLE BAJA", color: "#ffb08a" }); SONIDOS.doble(); }
      else if (v.e === "reaparece") { agregar({ tipo: "onda", x: v.x, dur: 420, color: "#9fe9b0" }); SONIDOS.reaparece(); }
      else if (v.e === "muerte_subita") { aviso("MUERTE SÚBITA: el primer golpe decide", 3500); }
      else if (v.e === "empieza") { SONIDOS.empieza(); }
      else if (v.e === "fin") { SONIDOS.fin(); }
    });
  }

  /* ---------- Vista: lo que se dibuja, venga de la simulación local o del servidor ---------- */

  function vistaLocal(alpha) {
    const sim = estado.sim;
    return {
      fase: sim.fase, cuenta: sim.cuenta, reloj: sim.reloj, ventaja: sim.ventaja, ganador: sim.ganador,
      j: sim.j.map((f, i) => {
        const p = estado.prev[i] || f;
        return {
          x: p.x + (f.x - p.x) * alpha, y: p.y + (f.y - p.y) * alpha, cara: f.cara, anim: E.animacion(f), altura: f.altura,
          altAccion: f.accion ? f.accion.altura : f.altura, proteccion: f.proteccion > 0, vivo: f.vivo, contra: f.contra > 0,
          muerteT: f.vivo ? 0 : 1 - f.muertoT / E.ms(CFG.REAPARICION), bajas: f.bajas
        };
      })
    };
  }

  /* ---------- Dibujo ---------- */

  const FONDO = ["#0e0b1a", "#130f24", "#19142e", "#1f1938", "#261e42", "#2d2449", "#352b50", "#3d3158"];

  function rectc(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function fondo(ahora) {
    // cielo en franjas
    const alto = SUELO / FONDO.length;
    for (let i = 0; i < FONDO.length; i++) rectc(0, Math.floor(i * alto), AN, Math.ceil(alto) + 1, FONDO[i]);
    const cam = estado.cam;
    // capa lejana: arcos
    const f1 = cam * U * 0.3;
    for (let i = -1; i < AN / 96 + 2; i++) {
      const bx = Math.round(i * 96 - (f1 % 96));
      rectc(bx, 70, 14, SUELO - 70, "#171230");
      rectc(bx + 82, 70, 14, SUELO - 70, "#171230");
      rectc(bx, 56, 96, 14, "#171230");
      rectc(bx + 14, 70, 68, 8, "#171230");
      rectc(bx + 22, 78, 52, 6, "#171230");
    }
    // capa media: columnas con antorchas
    const f2 = cam * U * 0.62;
    for (let i = -1; i < AN / 120 + 2; i++) {
      const bx = Math.round(i * 120 - (f2 % 120));
      rectc(bx, 40, 18, SUELO - 40, "#2a2144");
      rectc(bx - 3, 36, 24, 6, "#352a55");
      rectc(bx - 3, SUELO - 8, 24, 8, "#352a55");
      rectc(bx + 3, 40, 3, SUELO - 40, "#3a2f5e");
      // antorcha cada dos columnas
      const idx = Math.floor((cam * U * 0.62 + i * 120) / 120);
      if (((idx % 2) + 2) % 2 === 0) {
        rectc(bx + 7, 100, 4, 12, "#5a4330");
        const parpadeo = Math.floor(ahora / 120 + idx) % 3;
        rectc(bx + 6, 92 - parpadeo, 6, 8 + parpadeo, "#f08a2e");
        rectc(bx + 7, 94 - parpadeo, 4, 6, "#ffd36a");
        rectc(bx - 18, 96, 54, 40, "rgba(240,138,46,.06)");
      }
    }
    // suelo
    rectc(0, SUELO, AN, AL - SUELO, "#2b2238");
    rectc(0, SUELO, AN, 3, "#5a4a72");
    rectc(0, SUELO + 3, AN, 1, "#1d1628");
    const mx = cam * U;
    for (let fila = 0; fila < 4; fila++) {
      const y = SUELO + 4 + fila * 12;
      const sh = (fila % 2) * 12;
      for (let i = -1; i < AN / 24 + 2; i++) {
        const bx = Math.round(i * 24 - ((mx + sh) % 24));
        rectc(bx, y, 1, 12, "#1d1628");
      }
      rectc(0, y + 11, AN, 1, "#1d1628");
    }
    // marcas de zona cada 800 unidades
    for (let z = 0; z <= CFG.PISTA; z += 800) {
      const x = px(z);
      if (x > -6 && x < AN + 6) { rectc(x - 1, SUELO - 2, 2, 5, "#7a68a0"); }
    }
  }

  function salidas(ahora) {
    const pulso = 0.6 + 0.4 * Math.sin(ahora / 400);
    [[0, CFG.PISTA - CFG.SALIDA, "#e8c872"], [1, 0, "#7fd0ff"]].forEach(([quien, x0, color]) => {
      const xi = px(x0), xf = px(x0 + CFG.SALIDA);
      if (xf < -4 || xi > AN + 4) return;
      // luz en el suelo de la zona
      ctx.globalAlpha = 0.18 * pulso; rectc(xi, SUELO - 70, xf - xi, 70, color); ctx.globalAlpha = 1;
      // puerta
      const dx = quien === 0 ? xf - 38 : xi + 6;
      rectc(dx, SUELO - 76, 32, 76, "#120d1f");
      rectc(dx + 4, SUELO - 72, 24, 72, color);
      rectc(dx + 8, SUELO - 68, 16, 68, "#fff6dc");
      rectc(dx - 3, SUELO - 80, 38, 5, "#4a3b66");
      // flecha
      const sentido = quien === 0 ? 1 : -1;
      ctx.fillStyle = "#120d1f";
      for (let k = 0; k < 6; k++) { const h = 2 * (5 - k) + 1; ctx.fillRect(dx + 13 + (sentido > 0 ? k : 5 - k), SUELO - 40 - (h - 1) / 2, 1, h); }
      rectc(dx + 8, SUELO - 40, 5, 1, "#120d1f");
    });
    // fuera de la pista
    const x0 = px(0), x1 = px(CFG.PISTA);
    if (x0 > 0) rectc(0, 0, x0, SUELO, "#05030a");
    if (x1 < AN) rectc(x1, 0, AN - x1, SUELO, "#05030a");
  }

  function flechaRival(v, quien) {
    // si el otro luchador está fuera de la vista, un indicador en el borde
    const o = v.j[1 - quien];
    const x = px(o.x);
    if (x >= 8 && x <= AN - 8) return;
    const izq = x < 8;
    const dist = Math.abs(o.x - v.j[quien].x);
    ctx.fillStyle = quien === 0 ? S.PALETAS[1].tunica : S.PALETAS[0].tunica;
    const ax = izq ? 6 : AN - 6;
    for (let k = 0; k < 6; k++) ctx.fillRect(ax + (izq ? k : -k - 1), SUELO - 60 - k, 1, k * 2 + 1);
    ctx.font = "bold 8px monospace"; ctx.textAlign = izq ? "left" : "right";
    ctx.fillStyle = "#fff"; ctx.fillText(Math.round(dist / 100) / 10 + " u", izq ? 14 : AN - 14, SUELO - 56);
  }

  function dibujarEscena(v, ahora) {
    // cámara: entre los dos si están cerca; si no, sigue a quien lleva la ventaja o va más adelantado
    const a = v.j[0], b = v.j[1];
    let objetivo = (a.x + b.x) / 2;
    if (Math.abs(a.x - b.x) > VISTA * 0.78) {
      const lider = v.ventaja >= 0 ? v.ventaja : (a.x / CFG.PISTA >= (CFG.PISTA - b.x) / CFG.PISTA ? 0 : 1);
      objetivo = v.j[lider].x + (lider === 0 ? 1 : -1) * 120;
    }
    objetivo = Math.max(VISTA / 2 - 80, Math.min(CFG.PISTA - VISTA / 2 + 80, objetivo));
    if (!estado.camInicial) { estado.cam = objetivo; estado.camInicial = true; }
    else estado.cam += (objetivo - estado.cam) * 0.14;

    ctx.save();
    if (estado.temblor > 0.2) { ctx.translate(Math.round((Math.random() - 0.5) * estado.temblor), Math.round((Math.random() - 0.5) * estado.temblor)); estado.temblor *= 0.82; }
    fondo(ahora);
    salidas(ahora);
    // primero el caído, luego el vivo, para que el que pelea quede encima
    const orden = [0, 1].sort((i, j) => (v.j[i].vivo ? 1 : 0) - (v.j[j].vivo ? 1 : 0));
    orden.forEach(i => {
      const f = v.j[i];
      S.dibujarLuchador(ctx, {
        x: px(f.x), suelo: SUELO, alto: f.y * U, cara: f.cara, anim: f.anim, altura: f.altura, altAccion: f.altAccion,
        t: ahora, proteccion: f.proteccion, vivo: f.vivo, muerteT: f.muerteT, contra: f.contra
      }, i, ahora);
      // nombre encima, sin cubrir la espada
      if (f.vivo) {
        ctx.font = "bold 7px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillText(NOMBRES[i], Math.round(px(f.x)) + 1, Math.round(SUELO - f.y * U - 58) + 1);
        ctx.fillStyle = i === 0 ? "#ffb59f" : "#a8dcff"; ctx.fillText(NOMBRES[i], Math.round(px(f.x)), Math.round(SUELO - f.y * U - 58));
      }
    });
    // efectos
    estado.efectos = estado.efectos.filter(ef => {
      const e2 = Object.assign({}, ef, { x: px(ef.x), y: SUELO - 26 });
      return S.dibujarEfecto(ctx, e2, ahora);
    });
    flechaRival(v, 0); flechaRival(v, 1);
    ctx.restore();

    // cuenta atrás y textos grandes
    if (v.fase === "cuenta") {
      const seg = Math.ceil(v.cuenta / CFG.TICK_HZ);
      if (seg !== estado.ultimaCuenta) { estado.ultimaCuenta = seg; SONIDOS.cuenta(); }
      grande(String(seg), "#fff6c8");
    } else if (estado.ultimaCuenta !== -1 && v.fase === "juego") {
      estado.ultimaCuenta = -1; estado.empiezaHasta = ahora + 700;
    }
    if (estado.empiezaHasta && ahora < estado.empiezaHasta) grande("¡A LUCHAR!", "#fff6c8");
    if (v.fase === "fin") {
      const g = v.ganador;
      grande(g < 0 ? "EMPATE" : (NOMBRES[g] + " GANA").toUpperCase(), g === 1 ? "#a8dcff" : g === 0 ? "#ffb59f" : "#fff6c8");
    }
  }
  function grande(texto, color) {
    ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#000"; ctx.fillText(texto, AN / 2 + 2, 92 + 2);
    ctx.fillStyle = color; ctx.fillText(texto, AN / 2, 92);
  }

  /* ---------- HUD ---------- */

  function formatoTiempo(ticks) {
    const s = Math.max(0, Math.ceil(ticks / CFG.TICK_HZ));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function actualizarHud(v, extra) {
    $("estReloj").textContent = formatoTiempo(v.reloj);
    $("estB0").textContent = v.j[0].bajas; $("estB1").textContent = v.j[1].bajas;
    let txt = v.fase === "muerte_subita" ? "MUERTE SÚBITA" : v.ventaja >= 0 ? "Ventaja: " + NOMBRES[v.ventaja] : "Sin ventaja";
    $("estEstado").textContent = txt;
    $("estEstado").dataset.ventaja = v.ventaja;
    $("estM0").style.left = (v.j[0].x / CFG.PISTA * 100) + "%";
    $("estM1").style.left = (v.j[1].x / CFG.PISTA * 100) + "%";
    $("estM0").classList.toggle("muerto", !v.j[0].vivo); $("estM1").classList.toggle("muerto", !v.j[1].vivo);
    $("estM0").classList.toggle("ventaja", v.ventaja === 0); $("estM1").classList.toggle("ventaja", v.ventaja === 1);
    $("estRed").textContent = extra || "";
  }

  /* ---------- Bucle de dibujo ---------- */

  function bucle(ahora) {
    const dt = tAnterior ? ahora - tAnterior : 16;
    tAnterior = ahora;
    if (estado.pantalla === "local" || (estado.pantalla === "fin" && estado.sim && !estado.finEnLinea)) {
      if (estado.pantalla === "local") pasoLocal(dt);
      const alpha = Math.min(1, acumulado / (1000 / CFG.TICK_HZ));
      const v = vistaLocal(estado.sim.fase === "fin" ? 1 : alpha);
      dibujarEscena(v, ahora); actualizarHud(v, "");
    } else if (estado.pantalla === "juego" || (estado.pantalla === "fin" && estado.finEnLinea)) {
      enviarEntrada(ahora);
      const v = vistaEnLinea(ahora);
      if (v) { dibujarEscena(v, ahora); actualizarHud(v, textoRed()); }
    } else {
      // menús: la arena de fondo, quieta
      const v = { fase: "menu", cuenta: 0, reloj: 0, ventaja: -1, ganador: -1, j: [0, 1].map(i => ({ x: CFG.PISTA / 2 + (i ? 300 : -300), y: 0, cara: i ? -1 : 1, anim: "espera", altura: 1, altAccion: 1, proteccion: false, vivo: true, muerteT: 0, bajas: 0 })) };
      estado.cam = CFG.PISTA / 2; estado.camInicial = true;
      dibujarEscena(v, ahora);
    }
    requestAnimationFrame(bucle);
  }

  /* ---------- Modo en línea ---------- */

  const red = { ws: null, listo: false, yo: -1, sala: null, snaps: [], cfg: null, rtt: 0, ultimoMensaje: 0, intentos: 0, pausa: null, ultimaEntrada: "", ultimoEnvio: 0, nombre: "" };

  function urlServidor() {
    let u = window.ESTOCATTA_SERVIDOR || "";
    try {
      const q = new URLSearchParams(location.search).get("servidor");
      if (q && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(q)) u = q;
    } catch (e) { /* sin parámetros */ }
    return u.replace(/\/$/, "");
  }
  function urlSalud(u) { return u.replace(/^ws/, "http") + "/salud"; }

  async function despertar(u) {
    for (let i = 0; i < 14; i++) {
      try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
        const r = await fetch(urlSalud(u), { signal: c.signal, cache: "no-store" });
        clearTimeout(t);
        if (r.ok) return true;
      } catch (e) { /* aún dormido */ }
      $("estLineaEstado").textContent = "Despertando el servidor... puede tardar hasta un minuto la primera vez (" + (i + 1) + "/14).";
      await new Promise(r => setTimeout(r, 2500));
    }
    return false;
  }

  function mostrarLinea(texto, acciones) {
    estado.pantalla = "linea"; mostrar("estLinea");
    $("estLineaEstado").textContent = texto;
    $("estLineaAcciones").classList.toggle("hidden", !acciones);
  }

  async function entrarEnLinea() {
    const u = urlServidor();
    if (!u) { mostrarLinea("El servidor de Estocatta todavía no está configurado. Mientras tanto puedes jugar dos personas en este navegador.", false); return; }
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) { mostrarLinea("Para jugar en línea inicia sesión (arriba a la derecha) y vuelve a abrir esta opción.", false); return; }
    mostrarLinea("Conectando con el servidor...", false);
    if (!(await despertar(u))) { mostrarLinea("No se pudo contactar con el servidor. Inténtalo en unos minutos.", false); return; }
    conectar(u, false);
  }

  async function conectar(u, reconexion) {
    let token = "";
    try { const s = await fichasSesionActual(); token = s && s.access_token; } catch (e) { token = ""; }
    if (!token) { mostrarLinea("Tu sesión ha caducado. Inicia sesión de nuevo.", false); return; }
    let ws;
    try { ws = new WebSocket(u); } catch (e) { mostrarLinea("Dirección del servidor no válida.", false); return; }
    red.ws = ws; red.listo = false;
    ws.addEventListener("open", () => { ws.send(JSON.stringify({ t: "hola", token })); });
    ws.addEventListener("message", ev => { red.ultimoMensaje = performance.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } alMensaje(m); });
    ws.addEventListener("close", () => {
      if (red.ws !== ws) return;
      red.ws = null; red.listo = false;
      if (estado.pantalla === "juego" || estado.pantalla === "sala" || (estado.pantalla === "fin" && estado.finEnLinea && red.sala)) {
        if (red.intentos < 4) {
          red.intentos++;
          aviso("Conexión perdida. Reconectando (" + red.intentos + "/4)...");
          setTimeout(() => conectar(u, true), 1000 * Math.pow(2, red.intentos - 1));
        } else { aviso("No se pudo recuperar la conexión.", 6000); volverAlMenu(); }
      } else if (estado.pantalla === "linea" && !red.listo) {
        // se rechazó el saludo: el mensaje de error ya se mostró
      }
    });
    ws.addEventListener("error", () => { /* el cierre se trata en "close" */ });
  }

  function enviar(m) { if (red.ws && red.ws.readyState === 1) red.ws.send(JSON.stringify(m)); }

  function alMensaje(m) {
    switch (m.t) {
      case "ok":
        red.listo = true; red.intentos = 0; red.nombre = m.nombre;
        $("estLineaEstado").textContent = "Conectado como " + m.nombre + ".";
        if (!m.reconectado) { mostrarLinea("Conectado como " + m.nombre + ". Crea una sala o únete con el código de tu rival.", true); }
        aviso("");
        break;
      case "error":
        if (m.codigo === "token" || m.codigo === "prohibido" || m.codigo === "sin_sesion") { mostrarLinea(m.mensaje, false); red.intentos = 99; }
        else aviso(m.mensaje, 4000);
        break;
      case "sala": alSala(m); break;
      case "est": alEstado(m); break;
      case "pausa": red.pausa = { ms: m.ms, hasta: performance.now() + m.ms, plaza: m.plaza }; break;
      case "reanuda": red.pausa = null; aviso(""); break;
      case "guardado":
        $("estFinGuardado").textContent = m.guardado ? "Resultado guardado." : "No se pudo guardar el resultado (el servidor no respondió).";
        break;
      case "pong": red.rtt = Math.round(performance.now() - m.c); break;
      case "salio": volverAlMenu(); break;
      default: break;
    }
  }

  function alSala(m) {
    red.yo = m.yo; red.sala = m;
    NOMBRES[0] = (m.jugadores[0] && m.jugadores[0].nombre) || "Jugador 1";
    NOMBRES[1] = (m.jugadores[1] && m.jugadores[1].nombre) || "Jugador 2";
    $("estN0").textContent = NOMBRES[0]; $("estN1").textContent = NOMBRES[1];
    if (m.estado === "espera") {
      estado.pantalla = "sala"; mostrar("estSala");
      $("estSalaCodigo").textContent = m.codigo;
      const ul = $("estSalaJugadores"); ul.innerHTML = "";
      [0, 1].forEach(i => {
        const j = m.jugadores[i]; const li = document.createElement("li");
        li.textContent = j ? j.nombre + (i === m.yo ? " (tú)" : "") + (j.conectado ? "" : " (sin conexión)") + (j.listo ? " · listo" : " · esperando") : "Plaza libre: esperando al rival";
        li.className = j ? (j.listo ? "listo" : "") : "libre";
        ul.appendChild(li);
      });
      const yo = m.jugadores[m.yo];
      $("estListo").textContent = yo && yo.listo ? "Ya no estoy listo" : "Estoy listo";
      $("estListo").disabled = !(m.jugadores[0] && m.jugadores[1]);
      estado.finEnLinea = false;
    } else if (m.estado === "fin") {
      // el cartel final se muestra cuando llega el último estado
      estado.finEnLinea = true;
      const yo = m.jugadores[m.yo], otro = m.jugadores[1 - m.yo];
      $("estRevancha").textContent = yo && yo.revancha ? "Esperando al rival..." : (otro && otro.revancha ? "Aceptar revancha" : "Revancha");
      $("estRevancha").disabled = !!(yo && yo.revancha) || !otro;
      if (!otro) $("estFinTexto").textContent += " Tu rival ya salió de la sala.";
    }
  }

  function alEstado(m) {
    const ahora = performance.now();
    if (m.ini) {
      red.cfg = m.cfg; red.snaps = [];
      estado.pantalla = "juego"; estado.efectos = []; estado.camInicial = false; estado.ultimaCuenta = -1; estado.finEnLinea = true;
      mostrar(null); $("estHud").classList.remove("hidden"); aviso("");
      clearTimeout(estado.finTimer);
    }
    red.snaps.push({ rec: ahora, s: m });
    if (red.snaps.length > 40) red.snaps.shift();
    procesarEventos(m.ev);
    if (m.f === "fin" && estado.pantalla === "juego") {
      estado.pantalla = "fin";
      estado.finTimer = setTimeout(() => mostrarFinLinea(m), 1400);
    }
  }
  function mostrarFinLinea(m) {
    if (estado.pantalla !== "fin" || !estado.finEnLinea) return;
    const g = m.g;
    $("estFinTitulo").textContent = g < 0 ? "Empate" : (g === red.yo ? "¡Ganaste!" : "Gana " + NOMBRES[g]);
    $("estFinTexto").textContent = g < 0 ? textoMotivo(m.m) : NOMBRES[g] + " " + textoMotivo(m.m) + ".";
    if (!$("estFinGuardado").textContent) $("estFinGuardado").textContent = "Guardando el resultado...";
    mostrar("estFin");
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
      fase: sb.f, cuenta: sb.c, reloj: sb.r, ventaja: sb.v, ganador: sb.g,
      j: sb.j.map((fb, i) => {
        const fa = a.s.j[i] || fb;
        const mismoTramo = Math.abs(fb.x - fa.x) < 400;       // un teletransporte (reaparición) no se interpola
        return {
          x: mismoTramo ? fa.x + (fb.x - fa.x) * k : fb.x, y: fa.y + (fb.y - fa.y) * k, cara: fb.c, anim: fb.a, altura: fb.h, altAccion: fb.ha,
          proteccion: !!fb.p, vivo: !!fb.vivo, contra: !!fb.ct, muerteT: fb.vivo ? 0 : 1 - fb.mt / E.ms(CFG.REAPARICION), bajas: fb.b
        };
      })
    };
  }

  function textoRed() {
    if (!red.ws) return "Sin conexión";
    if (red.pausa) { const s = Math.max(0, Math.ceil((red.pausa.hasta - performance.now()) / 1000)); aviso((red.pausa.plaza === red.yo ? "Tu conexión se cortó" : "Tu rival perdió la conexión") + ". Esperando " + s + " s..."); }
    const inestable = performance.now() - red.ultimoMensaje > 2500 && estado.pantalla === "juego" && !red.pausa;
    if (inestable) return "Conexión inestable";
    return "Ping " + (red.rtt || "...") + " ms";
  }

  function enviarEntrada(ahora) {
    if (estado.pantalla !== "juego" || !red.ws || red.ws.readyState !== 1) return;
    const e = leerEntrada(mapaPropio(), eventosEnCola.yo, true);
    const clave = e.mov + "|" + e.correr + "|" + e.agachar + "|" + e.guardia;
    if (clave !== red.ultimaEntrada || e.ev.length || ahora - red.ultimoEnvio > 400) {
      red.ultimaEntrada = clave; red.ultimoEnvio = ahora;
      enviar({ t: "in", mov: e.mov, correr: e.correr, agachar: e.agachar, guardia: e.guardia, ev: e.ev });
    }
  }

  setInterval(() => { if (red.ws && red.ws.readyState === 1) enviar({ t: "ping", c: performance.now() }); }, 2000);

  function volverAlMenu() {
    clearTimeout(estado.finTimer);
    if (red.ws) { try { red.ws.close(); } catch (e) { /* ya cerrada */ } red.ws = null; }
    red.sala = null; red.snaps = []; red.pausa = null; red.listo = false; red.intentos = 0;
    estado.pantalla = "menu"; estado.sim = null; estado.finEnLinea = false;
    $("estHud").classList.add("hidden"); $("estFinGuardado").textContent = "";
    mostrar("estMenu");
  }

  /* ---------- Botones ---------- */

  $("estLocal").addEventListener("click", empezarLocal);
  $("estEnLinea").addEventListener("click", entrarEnLinea);
  $("estLineaVolver").addEventListener("click", volverAlMenu);
  $("estCrear").addEventListener("click", () => enviar({ t: "crear" }));
  $("estUnirForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const c = $("estCodigo").value.trim();
    if (c) enviar({ t: "unir", codigo: c });
  });
  $("estListo").addEventListener("click", () => {
    const yo = red.sala && red.sala.jugadores[red.sala.yo];
    enviar({ t: "listo", listo: !(yo && yo.listo) });
  });
  $("estSalaSalir").addEventListener("click", () => { enviar({ t: "salir" }); setTimeout(volverAlMenu, 200); });
  $("estRevancha").addEventListener("click", () => {
    if (estado.finEnLinea && red.ws) enviar({ t: "revancha" });
    else empezarLocal();
  });
  $("estFinMenu").addEventListener("click", () => {
    if (estado.finEnLinea && red.ws) enviar({ t: "salir" });
    volverAlMenu();
  });

  mostrar("estMenu");
  pintarTabla();
  requestAnimationFrame(bucle);

  // para las pruebas desde fuera
  window.EstocattaPagina = { estado, red, empezarLocal, vistaLocal };
})();
