/* Ajedrez contra rivales con su propia forma de jugar. Las reglas (movimientos legales, jaque, mate,
   tablas, enroque, al paso) las da chess.js, que se carga al abrir la página;
   la parte que piensa (evaluación y búsqueda con poda alfa-beta) es propia. */
(function () {
  const tableroEl = document.getElementById("ajTablero");
  const estadoEl = document.getElementById("ajEstado");
  const jugadasEl = document.getElementById("ajJugadas");
  const capturasJ = document.getElementById("ajCapturasJugador");
  const capturasR = document.getElementById("ajCapturasRival");
  const colorEl = document.getElementById("ajColor");
  const rendirseEl = document.getElementById("ajRendirse");
  const rivalesEl = document.getElementById("ajRivales");
  const rivalActualEl = document.getElementById("ajRivalActual");
  const comentarioEl = document.getElementById("ajComentario");

  const GLIFOS = {
    wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
    bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
  };
  const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const CLAVE_RECORD = "compendioAjedrezRecord";

  // Tablas de posición simples (desde el punto de vista de las blancas, fila 8 arriba)
  const PST_PEON = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const PST_CABALLO = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
  const PST_ALFIL = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20];
  const PST = { p: PST_PEON, n: PST_CABALLO, b: PST_ALFIL };

  /* Cada rival tiene su dificultad (cuánto calcula y cuánto se equivoca), su ritmo
     al pensar y unas frases propias para que se sienta que hay alguien enfrente.
     prof = jugadas que mira por adelantado; tiempo = tope de cálculo (ms);
     error = probabilidad de elegir una jugada peor; pausa = [min, max] segundos
     que "piensa" antes de mover. azar = no calcula nada: elige una pieza que pueda
     moverse al azar y mueve esa pieza a una casilla legal al azar. */
  const RIVALES = [
    { id: "hooey", nombre: "Hooey Magoo", dificultad: "Caos", azar: true, prof: 0, tiempo: 0, error: 0, pausa: [0.4, 1.3],
      frases: { saludo: "¡Yo juego con las de arriba! ¿Cuáles son las de arriba?", jaque: "¿Eso es jaque? Yo solo quería mover algo.", capturaRival: "¡Me comí una! No sé cuál era.", capturaJugador: "Ah, esa se movía sola, ¿no?", gana: "¿Gané? ¿Eso era ganar?", pierde: "Perdí. ¿Puedo jugar otra? Guau. Digo, sí." } },
    { id: "ocevat", nombre: "Ocevat", dificultad: "Fácil", prof: 2, tiempo: 500, error: 0.18, pausa: [0.9, 2.2],
      frases: { saludo: "Una partida tranquila. Que gane quien lo merezca.", jaque: "Jaque. Con cuidado, amigo.", capturaRival: "Lo siento, era necesario.", capturaJugador: "Bien tomada. No la vi venir.", gana: "Buena partida. Gracias por jugarla.", pierde: "Me ganaste limpio. Te felicito." } },
    { id: "baraja", nombre: "Baraja", dificultad: "Media", prof: 3, tiempo: 900, error: 0.08, pausa: [1.2, 3.0],
      frases: { saludo: "Adelante, tú primero.", jaque: "Jaque. Tranquilo.", capturaRival: "Gracias por la pieza.", capturaJugador: "Una carta menos. Nada grave.", gana: "Así se juega la última mano.", pierde: "Esta vez te tocó a ti." } },
    { id: "ilyth", nombre: "General Ilyth", dificultad: "Difícil", prof: 4, tiempo: 1500, error: 0.02, pausa: [1.5, 3.6],
      frases: { saludo: "Siéntate. Veamos cómo mueves tus tropas.", jaque: "Jaque. Tu flanco quedó abierto.", capturaRival: "Una baja. Habrá más.", capturaJugador: "Un sacrificio. Lo anoto.", gana: "Partida cerrada. La frontera sigue en pie.", pierde: "Bien jugado. Pocos llegan hasta aquí." } },
    { id: "perro", nombre: "El perro sabio", dificultad: "Muy difícil", prof: 5, tiempo: 2600, error: 0, pausa: [2.0, 4.5],
      frases: { saludo: "Veamos qué sabes.", jaque: "Jaque. Con calma.", capturaRival: "Gracias por la pieza.", capturaJugador: "Interesante.", gana: "Todavía te falta aprender.", pierde: "Buena partida. Aprendí algo." } }
  ];

  let Chess = null;
  let juego = null;
  let colorJugador = "w";
  let seleccion = null;
  let ultimaJugada = null;
  let pensando = false;
  let rival = null;
  let partidaId = 0;
  let capturadas = { w: [], b: [] };
  let terminado = false;
  let record = {};
  try { record = JSON.parse(localStorage.getItem(CLAVE_RECORD) || "{}") || {}; } catch (err) { record = {}; }

  /* --- Evaluación y búsqueda --------------------------------------------- */
  function evaluar(g) {
    let total = 0;
    const tablero = g.board();
    for (let f = 0; f < 8; f++) {
      for (let c = 0; c < 8; c++) {
        const p = tablero[f][c];
        if (!p) continue;
        const idx = p.color === "w" ? f * 8 + c : (7 - f) * 8 + c;
        const pst = PST[p.type] ? PST[p.type][idx] : 0;
        const v = VALOR[p.type] + pst;
        total += p.color === "w" ? v : -v;
      }
    }
    return total;
  }

  function ordenar(movs) {
    return movs.sort((a, b) => (b.captured ? VALOR[b.captured] * 10 - VALOR[b.piece] : 0) - (a.captured ? VALOR[a.captured] * 10 - VALOR[a.piece] : 0) + (b.promotion ? 800 : 0) - (a.promotion ? 800 : 0));
  }

  let limite = 0;
  let agotado = false;

  function buscar(g, prof, alfa, beta) {
    if (performance.now() > limite) { agotado = true; return 0; }
    if (g.isCheckmate()) return g.turn() === "w" ? -100000 - prof : 100000 + prof;
    if (g.isDraw()) return 0;
    if (prof === 0) return evaluar(g);
    const movs = ordenar(g.moves({ verbose: true }));
    const maximiza = g.turn() === "w";
    let mejor = maximiza ? -Infinity : Infinity;
    for (const m of movs) {
      g.move(m);
      const v = buscar(g, prof - 1, alfa, beta);
      g.undo();
      if (agotado) return 0;
      if (maximiza) { if (v > mejor) mejor = v; if (v > alfa) alfa = v; }
      else { if (v < mejor) mejor = v; if (v < beta) beta = v; }
      if (beta <= alfa) break;
    }
    return mejor;
  }

  function elegirJugada(g, cfg) {
    const movs = ordenar(g.moves({ verbose: true }));
    if (!movs.length) return null;
    if (cfg.azar) {
      // Primero una pieza al azar de las que pueden moverse, luego un movimiento suyo al azar
      const casillas = [...new Set(movs.map(m => m.from))];
      const origen = casillas[Math.floor(Math.random() * casillas.length)];
      const suyos = movs.filter(m => m.from === origen);
      return suyos[Math.floor(Math.random() * suyos.length)];
    }
    const maximiza = g.turn() === "w";
    limite = performance.now() + cfg.tiempo;
    let mejorGlobal = null;

    // Profundización iterativa: se queda con lo mejor de la última profundidad completa.
    for (let prof = 1; prof <= cfg.prof; prof++) {
      agotado = false;
      let mejor = null;
      let mejorVal = maximiza ? -Infinity : Infinity;
      const puntajes = [];
      for (const m of movs) {
        g.move(m);
        const v = buscar(g, prof - 1, -Infinity, Infinity);
        g.undo();
        if (agotado) break;
        puntajes.push({ m, v });
        if (maximiza ? v > mejorVal : v < mejorVal) { mejorVal = v; mejor = m; }
      }
      if (agotado) break;
      mejorGlobal = { mejor, puntajes, maximiza };
      if (Math.abs(mejorVal) > 90000) break;
    }
    if (!mejorGlobal) return movs[0];

    // Los niveles bajos a veces eligen una jugada que no es la mejor
    if (cfg.error > 0 && Math.random() < cfg.error) {
      const ord = mejorGlobal.puntajes.slice().sort((a, b) => (maximiza ? b.v - a.v : a.v - b.v));
      const k = Math.min(ord.length - 1, 1 + Math.floor(Math.random() * 3));
      return ord[k].m;
    }
    // Entre jugadas casi iguales, un poco de variedad
    const bestVal = mejorGlobal.puntajes.find(p => p.m === mejorGlobal.mejor).v;
    const parecidas = mejorGlobal.puntajes.filter(p => Math.abs(p.v - bestVal) <= 6);
    return parecidas[Math.floor(Math.random() * parecidas.length)].m;
  }

  /* --- Interfaz ---------------------------------------------------------- */
  function casillaNombre(f, c) { return "abcdefgh"[c] + (8 - f); }

  function pintarTablero() {
    const tablero = juego.board();
    const sel = seleccion;
    const destinos = sel ? new Set(juego.moves({ square: sel, verbose: true }).map(m => m.to)) : new Set();
    const enJaque = juego.inCheck() ? juego.turn() : null;
    const orden = colorJugador === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    let html = "";
    orden.forEach(f => {
      orden.slice().sort((a, b) => (colorJugador === "w" ? a - b : b - a)).forEach(c => {
        const nombre = casillaNombre(f, c);
        const p = tablero[f][c];
        const oscura = (f + c) % 2 === 1;
        const clases = ["aj-casilla", oscura ? "aj-oscura" : "aj-clara"];
        if (sel === nombre) clases.push("aj-sel");
        if (destinos.has(nombre)) clases.push(p ? "aj-captura" : "aj-destino");
        if (ultimaJugada && (ultimaJugada.from === nombre || ultimaJugada.to === nombre)) clases.push("aj-ultima");
        if (enJaque && p && p.type === "k" && p.color === enJaque) clases.push("aj-jaque");
        html += `<button type="button" class="${clases.join(" ")}" data-casilla="${nombre}" aria-label="${nombre}">${p ? `<span class="aj-pieza aj-${p.color}">${GLIFOS[p.color + p.type]}</span>` : ""}</button>`;
      });
    });
    tableroEl.innerHTML = html;
  }

  function pintarLaterales() {
    const hist = juego.history();
    let filas = "";
    for (let i = 0; i < hist.length; i += 2) {
      filas += `<li><span>${i / 2 + 1}.</span> ${hist[i]} ${hist[i + 1] || ""}</li>`;
    }
    jugadasEl.innerHTML = filas;
    jugadasEl.scrollTop = jugadasEl.scrollHeight;
    const rival = colorJugador === "w" ? "b" : "w";
    capturasJ.textContent = capturadas[rival].map(t => GLIFOS[rival + t]).join(" ");
    capturasR.textContent = capturadas[colorJugador].map(t => GLIFOS[colorJugador + t]).join(" ");
  }

  function mensaje(texto) { estadoEl.textContent = texto; }

  function comentar(clave, probabilidad) {
    if (!rival || Math.random() > (probabilidad === undefined ? 1 : probabilidad)) return;
    comentarioEl.textContent = `${rival.nombre}: «${rival.frases[clave]}»`;
  }

  function actualizarEstado() {
    if (juego.isCheckmate()) {
      const gano = juego.turn() !== colorJugador;
      terminar(gano ? `Jaque mate. Le ganaste a ${rival.nombre}.` : `Jaque mate. ${rival.nombre} te ganó.`, gano ? "gana" : "pierde");
    } else if (juego.isDraw()) {
      terminar("Tablas.", "tablas");
    } else if (juego.turn() === colorJugador) {
      mensaje(juego.inCheck() ? "Estás en jaque. Te toca." : "Te toca.");
    }
  }

  function terminar(texto, resultado) {
    terminado = true;
    mensaje(texto);
    rendirseEl.disabled = true;
    if (resultado === "gana") {
      record[rival.id] = (record[rival.id] || 0) + 1;
      try { localStorage.setItem(CLAVE_RECORD, JSON.stringify(record)); } catch (err) { /* sin almacenamiento */ }
      comentar("pierde");
    } else if (resultado === "pierde") {
      comentar("gana");
    }
    pintarRivales();
    anotarPartida(resultado, texto.startsWith("Jaque mate"));
  }

  /* Manda la partida al ranking (solo con sesión iniciada). */
  async function anotarPartida(resultado, esMate) {
    if (!window.MjStats || !juego) return;
    const mias = juego.history({ verbose: true }).filter(m => m.color === colorJugador).length;
    const suma = { jugadas: mias, capturas: capturadas[colorJugador].length };
    const min = {};
    if (resultado === "gana" && esMate) min.mate = Math.max(1, mias);
    const res = await MjStats.registrar("ajedrez", rival.id, resultado, { suma, min });
    if (res.guardado) cargarRanking();
  }

  /* --- Ranking ----------------------------------------------------------- */
  const rankingEl = document.getElementById("ajRankings");

  function cargarRanking() {
    if (!rankingEl || !window.MjStats) return;
    MjStats.cargarYPintar("ajedrez", rankingEl, [
      { titulo: "Más victorias", valor: u => u.victorias },
      { titulo: "Victorias contra El perro sabio", valor: u => (u.porClave.perro ? u.porClave.perro.victorias : 0) },
      { titulo: "Mate más rápido (jugadas)", valor: u => u.minimo.mate, menorEsMejor: true },
      { titulo: "Más tablas", valor: u => u.tablas },
      { titulo: "Más piezas capturadas", valor: u => u.suma.capturas }
    ]);
  }

  if (window.MjStats) MjStats.cargarSesion().then(cargarRanking);

  function pintarRivales() {
    rivalesEl.innerHTML = RIVALES.map(r => `
      <button type="button" class="aj-rival ${rival && rival.id === r.id ? "activo" : ""}" data-rival="${r.id}">
        <strong>${r.nombre}</strong>
        <span>${r.dificultad}</span>
        <small>${record[r.id] ? `Victorias: ${record[r.id]}` : "Sin vencer"}</small>
      </button>`).join("");
  }

  function registrarCaptura(m) {
    if (m.captured) capturadas[m.color].push(m.captured);
  }

  /* La pieza se desliza de su casilla a la de destino (también la torre al enrocar).
     Es un FLIP: se pinta ya en el destino y se la devuelve al origen con transform
     para soltarla con una transición. */
  function deslizar(desde, hasta, ms) {
    const a = tableroEl.querySelector(`[data-casilla="${desde}"]`);
    const b = tableroEl.querySelector(`[data-casilla="${hasta}"]`);
    const pieza = b && b.querySelector(".aj-pieza");
    if (!a || !pieza) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    pieza.style.transition = "none";
    pieza.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`;
    b.classList.add("aj-deslizando");
    pieza.getBoundingClientRect();
    pieza.style.transition = `transform ${ms}ms cubic-bezier(.2,.8,.25,1)`;
    pieza.style.transform = "";
    setTimeout(() => { b.classList.remove("aj-deslizando"); pieza.style.transition = ""; }, ms + 40);
  }

  function jugar(m, esRival, sinAnimar) {
    const hecha = juego.move(m);
    registrarCaptura(hecha);
    ultimaJugada = { from: hecha.from, to: hecha.to };
    seleccion = null;
    pintarTablero();
    if (!sinAnimar) {
      const ms = esRival ? 340 : 220;
      deslizar(hecha.from, hecha.to, ms);
      if (hecha.flags.includes("k") || hecha.flags.includes("q")) {
        const fila = hecha.to[1];
        const corto = hecha.flags.includes("k");
        deslizar(corto ? "h" + fila : "a" + fila, corto ? "f" + fila : "d" + fila, ms);
      }
    }
    pintarLaterales();
    actualizarEstado();
    if (!terminado) {
      if (esRival && juego.inCheck()) comentar("jaque", 0.7);
      else if (esRival && hecha.captured) comentar("capturaRival", 0.45);
      else if (!esRival && hecha.captured) comentar("capturaJugador", 0.35);
    }
  }

  function turnoRival() {
    if (terminado || juego.turn() === colorJugador) return;
    pensando = true;
    mensaje(`${rival.nombre} piensa...`);
    const miPartida = partidaId;
    const inicio = performance.now();
    setTimeout(() => {
      if (miPartida !== partidaId) return;
      const legales = juego.moves({ verbose: true });
      const m = elegirJugada(juego, rival);
      // Ritmo humano: tarda más en posiciones abiertas que en apertura, recapturas o jugadas obligadas.
      let [min, max] = rival.pausa;
      const triviales = legales.length === 1 || juego.history().length < 8;
      if (triviales) { min *= 0.35; max *= 0.5; }
      const objetivo = (min + Math.random() * (max - min)) * 1000;
      const espera = Math.max(0, objetivo - (performance.now() - inicio));
      setTimeout(() => {
        if (miPartida !== partidaId) return;
        pensando = false;
        if (m && !terminado) jugar(m, true);
      }, espera);
    }, 80);
  }

  tableroEl.addEventListener("click", ev => {
    if (sinClic) return;
    const b = ev.target.closest("[data-casilla]");
    if (!b || terminado || pensando || !juego || juego.turn() !== colorJugador) return;
    const casilla = b.dataset.casilla;
    const pieza = juego.get(casilla);
    if (seleccion) {
      const mov = juego.moves({ square: seleccion, verbose: true }).find(m => m.to === casilla);
      if (mov) {
        // Coronación automática a dama
        jugar({ from: mov.from, to: mov.to, promotion: mov.promotion ? "q" : undefined }, false);
        turnoRival();
        return;
      }
    }
    if (pieza && pieza.color === colorJugador) seleccion = seleccion === casilla ? null : casilla;
    else seleccion = null;
    pintarTablero();
  });

  /* --- Arrastrar piezas --------------------------------------------------
     Se arrastra con ratón o dedo. La pieza se levanta, sigue al puntero, las casillas
     legales se marcan al pasar por encima y al soltar entra en la casilla o vuelve a
     su sitio. Hacer clic en la pieza y luego en el destino sigue funcionando igual. */
  let arrastre = null;
  let sinClic = false;

  function centroDe(casilla) {
    const el = tableroEl.querySelector(`[data-casilla="${casilla}"]`);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function limpiarArrastre() {
    if (!arrastre) return;
    if (arrastre.fantasma) arrastre.fantasma.remove();
    tableroEl.querySelectorAll(".aj-arrastrando, .aj-sobre").forEach(el => el.classList.remove("aj-arrastrando", "aj-sobre"));
    arrastre = null;
  }

  tableroEl.addEventListener("pointerdown", ev => {
    if (ev.button > 0 || arrastre) return;
    const b = ev.target.closest("[data-casilla]");
    if (!b || terminado || pensando || !juego || juego.turn() !== colorJugador) return;
    const pieza = juego.get(b.dataset.casilla);
    if (!pieza || pieza.color !== colorJugador) return;
    arrastre = { casilla: b.dataset.casilla, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, activo: false, fantasma: null, sobre: null };
  });

  tableroEl.addEventListener("pointermove", ev => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    if (!arrastre.activo) {
      if (Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) < 6) return;
      arrastre.activo = true;
      try { tableroEl.setPointerCapture(ev.pointerId); } catch (err) { /* sin captura */ }
      if (seleccion !== arrastre.casilla) { seleccion = arrastre.casilla; pintarTablero(); }
      const origen = tableroEl.querySelector(`[data-casilla="${arrastre.casilla}"]`);
      const glifo = origen.querySelector(".aj-pieza");
      origen.classList.add("aj-arrastrando");
      const f = glifo.cloneNode(true);
      f.className = glifo.className + " aj-fantasma";
      f.style.fontSize = getComputedStyle(glifo).fontSize;
      document.body.appendChild(f);
      arrastre.fantasma = f;
      arrastre.legales = new Set(juego.moves({ square: arrastre.casilla, verbose: true }).map(m => m.to));
    }
    const f = arrastre.fantasma;
    f.style.transition = "none";
    f.style.left = ev.clientX + "px";
    f.style.top = ev.clientY + "px";
    const sobre = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-casilla]");
    const nombre = sobre && arrastre.legales.has(sobre.dataset.casilla) ? sobre.dataset.casilla : null;
    if (nombre !== arrastre.sobre) {
      tableroEl.querySelector(".aj-sobre")?.classList.remove("aj-sobre");
      if (nombre) sobre.classList.add("aj-sobre");
      arrastre.sobre = nombre;
    }
  });

  function soltar(ev, cancelado) {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    if (!arrastre.activo) { arrastre = null; return; }
    sinClic = true;
    setTimeout(() => { sinClic = false; }, 0);
    const { fantasma, casilla } = arrastre;
    const destino = cancelado ? null : document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-casilla]")?.dataset.casilla;
    const mov = destino && juego.moves({ square: casilla, verbose: true }).find(m => m.to === destino);
    const ir = centroDe(mov ? destino : casilla);
    fantasma.style.transition = "left .12s ease-out, top .12s ease-out, transform .12s ease-out";
    fantasma.style.left = ir.x + "px";
    fantasma.style.top = ir.y + "px";
    fantasma.style.transform = "translate(-50%, -50%) scale(1)";
    const miPartida = partidaId;
    // mientras entra o vuelve, no se acepta otro arrastre
    arrastre.id = -1;
    setTimeout(() => {
      limpiarArrastre();
      if (miPartida !== partidaId || terminado) return;
      if (mov) {
        jugar({ from: mov.from, to: mov.to, promotion: mov.promotion ? "q" : undefined }, false, true);
        turnoRival();
      }
    }, 130);
  }
  tableroEl.addEventListener("pointerup", ev => soltar(ev, false));
  tableroEl.addEventListener("pointercancel", ev => soltar(ev, true));

  function nuevaPartida(r) {
    if (!r) return;
    rival = r;
    partidaId += 1;
    limpiarArrastre();
    juego = new Chess();
    colorJugador = colorEl.value === "negras" ? "b" : "w";
    seleccion = null; ultimaJugada = null; pensando = false; terminado = false;
    capturadas = { w: [], b: [] };
    comentarioEl.textContent = "";
    rivalActualEl.textContent = `Contra ${r.nombre} · ${r.dificultad}`;
    rendirseEl.disabled = false;
    pintarRivales();
    pintarTablero(); pintarLaterales();
    mensaje(colorJugador === "w" ? "Te toca." : `${r.nombre} empieza.`);
    comentar("saludo");
    if (colorJugador === "b") turnoRival();
  }

  rivalesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-rival]");
    if (!b || !Chess) return;
    if (juego && !terminado && juego.history().length > 0 && rival && rival.id !== b.dataset.rival) {
      if (!confirm("Hay una partida en curso. ¿Abandonarla y cambiar de rival?")) return;
    }
    nuevaPartida(RIVALES.find(r => r.id === b.dataset.rival));
  });

  colorEl.addEventListener("change", () => { if (rival && juego && (terminado || juego.history().length === 0)) nuevaPartida(rival); });

  rendirseEl.addEventListener("click", () => {
    if (!juego || terminado) return;
    if (!confirm("¿Te rindes?")) return;
    partidaId += 1; pensando = false;
    terminar(`Te rendiste. ${rival.nombre} gana.`, "pierde");
  });

  pintarRivales();
  mensaje("Cargando el tablero...");
  import("https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm")
    .then(mod => { Chess = mod.Chess; mensaje("Elige a un rival para empezar."); })
    .catch(() => mensaje("No se pudo cargar el motor de ajedrez. Revisa tu conexión a internet y recarga."));
})();
