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
  const relojEl = document.getElementById("ajReloj");
  const modoMaquinaEl = document.getElementById("ajModoMaquina");
  const modoJugadoresEl = document.getElementById("ajModoJugadores");
  const pvpAvisoEl = document.getElementById("ajPvpAviso");
  const pvpPartidasEl = document.getElementById("ajPvpPartidas");
  const pvpJugadoresEl = document.getElementById("ajPvpJugadores");
  const controlesEl = document.getElementById("ajControles");
  const colorLabelEl = document.getElementById("ajColorLabel");
  const cerrarOnlineEl = document.getElementById("ajCerrarOnline");
  const zonaEl = document.querySelector(".aj-zona");

  const GLIFOS = {
    wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
    bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
  };
  // En el tablero las dos bandos usan la silueta rellena y se distinguen por color (♟ con selector de texto: sin emoji)
  const RELLENO = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" };
  const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const CLAVE_RECORD = "compendioAjedrezRecord";
  const CLAVE_REGISTRADAS = "compendioAjedrezPvpRegistradas";

  // Tablas de posición simples (desde el punto de vista de las blancas, fila 8 arriba)
  const PST_PEON = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const PST_CABALLO = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
  const PST_ALFIL = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20];
  const PST = { p: PST_PEON, n: PST_CABALLO, b: PST_ALFIL };

  /* Cada rival tiene su dificultad (cuánto calcula y cuánto se equivoca), su ritmo
     al pensar y unas frases propias para que se sienta que hay alguien enfrente.
     prof = jugadas que mira por adelantado; tiempo = tope de cálculo (ms);
     error = probabilidad de elegir una jugada peor; pausa = [min, max] segundos
     que "piensa" antes de mover. tiempoMov = segundos que tienes para cada jugada
     (si se acaban, pierdes la partida; sin valor, no hay reloj). azar = no calcula nada: elige una pieza que pueda
     moverse al azar y mueve esa pieza a una casilla legal al azar. sinRanking = la
     partida no suma a récords ni rankings. */
  const RIVALES = [
    { id: "hooey", nombre: "Hooey Magoo", dificultad: "Caos", azar: true, sinRanking: true, prof: 0, tiempo: 0, error: 0, pausa: [0.4, 1.3],
      frases: { saludo: "¡Yo juego con las de arriba! ¿Cuáles son las de arriba?", jaque: "¿Eso es jaque? Yo solo quería mover algo.", capturaRival: "¡Me comí una! No sé cuál era.", capturaJugador: "Ah, esa se movía sola, ¿no?", gana: "¿Gané? ¿Eso era ganar?", pierde: "Perdí. ¿Puedo jugar otra? Guau. Digo, sí." } },
    { id: "ocevat", nombre: "Ocevat", dificultad: "Fácil", tiempoMov: 60, prof: 2, tiempo: 500, error: 0.18, pausa: [0.9, 2.2],
      frases: { saludo: "Una partida tranquila. Que gane quien lo merezca.", jaque: "Jaque. Con cuidado, amigo.", capturaRival: "Lo siento, era necesario.", capturaJugador: "Bien tomada. No la vi venir.", gana: "Buena partida. Gracias por jugarla.", pierde: "Me ganaste limpio. Te felicito." } },
    { id: "baraja", nombre: "Baraja", dificultad: "Media", tiempoMov: 45, prof: 3, tiempo: 900, error: 0.08, pausa: [1.2, 3.0],
      frases: { saludo: "Adelante, tú primero.", jaque: "Jaque. Tranquilo.", capturaRival: "Gracias por la pieza.", capturaJugador: "Una carta menos. Nada grave.", gana: "Así se juega la última mano.", pierde: "Esta vez te tocó a ti." } },
    { id: "ilyth", nombre: "General Ilyth", dificultad: "Difícil", tiempoMov: 30, prof: 4, tiempo: 1500, error: 0.02, pausa: [1.5, 3.6],
      frases: { saludo: "Siéntate. Veamos cómo mueves tus tropas.", jaque: "Jaque. Tu flanco quedó abierto.", capturaRival: "Una baja. Habrá más.", capturaJugador: "Un sacrificio. Lo anoto.", gana: "Partida cerrada. La frontera sigue en pie.", pierde: "Bien jugado. Pocos llegan hasta aquí." } },
    { id: "perro", nombre: "El perro sabio", dificultad: "Muy difícil", tiempoMov: 20, prof: 5, tiempo: 2600, error: 0, pausa: [2.0, 4.5],
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
  let online = null; // partida contra otro jugador abierta: { id, oponente }
  let modo = "maquina";
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
        html += `<button type="button" class="${clases.join(" ")}" data-casilla="${nombre}" aria-label="${nombre}">${p ? `<span class="aj-pieza aj-${p.color}">${RELLENO[p.type]}</span>` : ""}</button>`;
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
    if (!rival || !rival.frases || Math.random() > (probabilidad === undefined ? 1 : probabilidad)) return;
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
    } else if (online) {
      mensaje(`Esperando a ${rival.nombre}...`);
    }
  }

  function terminar(texto, resultado) {
    terminado = true;
    detenerReloj();
    mensaje(texto);
    rendirseEl.disabled = true;
    if (online) {
      // Contra otro jugador: el resultado sale de la partida guardada y se anota solo
      setTimeout(cargarPartidas, 600);
      return;
    }
    if (resultado === "gana" && !rival.sinRanking) {
      record[rival.id] = (record[rival.id] || 0) + 1;
      try { localStorage.setItem(CLAVE_RECORD, JSON.stringify(record)); } catch (err) { /* sin almacenamiento */ }
      comentar("pierde");
    } else if (resultado === "pierde") {
      comentar("gana");
    }
    pintarRivales();
    if (!rival.sinRanking) anotarPartida(resultado, texto.startsWith("Jaque mate"));
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
      { titulo: "Victorias contra otros jugadores", valor: u => (u.porClave.jugador ? u.porClave.jugador.victorias : 0) },
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
        <span>${r.dificultad}${r.tiempoMov ? ` · ${r.tiempoMov} s por jugada` : ""}</span>
        <small>${r.sinRanking ? "No cuenta para el ranking" : record[r.id] ? `Victorias: ${record[r.id]}` : "Sin vencer"}</small>
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
    sincronizarReloj();
    return hecha;
  }

  /* --- Reloj por jugada -----------------------------------------------------
     Solo corre en tu turno contra la máquina. Si llega a cero, pierdes la partida. */
  let relojTimer = null;
  let relojTurno = -1;

  function detenerReloj() {
    clearInterval(relojTimer);
    relojTimer = null;
    relojTurno = -1;
    relojEl.classList.add("hidden");
    relojEl.classList.remove("urgente");
  }

  function pintarReloj(restante) {
    const seg = Math.max(0, Math.ceil(restante / 1000));
    relojEl.textContent = `Tiempo: ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
    relojEl.classList.toggle("urgente", seg <= 5);
  }

  function sincronizarReloj() {
    const aplica = !online && rival && rival.tiempoMov && juego && !terminado && juego.turn() === colorJugador;
    if (!aplica) { detenerReloj(); return; }
    const turno = juego.history().length;
    if (relojTimer && relojTurno === turno) return;
    detenerReloj();
    relojTurno = turno;
    const fin = performance.now() + rival.tiempoMov * 1000;
    const miPartida = partidaId;
    relojEl.classList.remove("hidden");
    pintarReloj(rival.tiempoMov * 1000);
    relojTimer = setInterval(() => {
      if (miPartida !== partidaId || terminado) { detenerReloj(); return; }
      const restante = fin - performance.now();
      pintarReloj(restante);
      if (restante <= 0) {
        detenerReloj();
        limpiarArrastre();
        terminar(`Se te acabó el tiempo. ${rival.nombre} gana.`, "pierde");
      }
    }, 200);
  }

  /* Después de mi jugada: la máquina contesta, o se manda al otro jugador. */
  function tras(hecha) {
    if (!online) turnoRival();
    else enviarJugada(hecha);
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
        tras(jugar({ from: mov.from, to: mov.to, promotion: mov.promotion ? "q" : undefined }, false));
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
        tras(jugar({ from: mov.from, to: mov.to, promotion: mov.promotion ? "q" : undefined }, false, true));
      }
    }, 130);
  }
  tableroEl.addEventListener("pointerup", ev => soltar(ev, false));
  tableroEl.addEventListener("pointercancel", ev => soltar(ev, true));

  function nuevaPartida(r) {
    if (!r) return;
    online = null;
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
    refrescarVistas();
    pintarTablero(); pintarLaterales();
    mensaje(colorJugador === "w" ? "Te toca." : `${r.nombre} empieza.`);
    comentar("saludo");
    sincronizarReloj();
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

  colorEl.addEventListener("change", () => { if (!online && rival && juego && (terminado || juego.history().length === 0)) nuevaPartida(rival); });

  rendirseEl.addEventListener("click", async () => {
    if (!juego || terminado) return;
    if (!confirm("¿Te rindes?")) return;
    if (online) {
      const { error } = await supa.rpc("ajedrez_rendirse", { p_id: online.id });
      if (error) { mensaje("No se pudo registrar la rendición. Inténtalo otra vez."); return; }
    }
    partidaId += 1; pensando = false;
    terminar(`Te rendiste. ${rival.nombre} gana.`, "pierde");
  });

  /* --- Contra otros jugadores ----------------------------------------------
     Las partidas viven en la tabla ajedrez_partidas (scratchpad/ajedrez_pvp.sql).
     Cada jugada se manda con una función del servidor que comprueba el turno; el
     otro navegador la recibe por Realtime y, como respaldo, por consulta cada pocos
     segundos. El resultado de cada partida lo anota cada jugador a partir de la fila
     guardada, una sola vez por partida. */
  let supa = null;
  let miId = null;
  let jugadores = [];
  let partidas = [];
  let presentes = new Set();
  let enLinea = false;
  let temporizador = null;
  let aplazado = null;
  let registradas = new Set();
  try { registradas = new Set(JSON.parse(localStorage.getItem(CLAVE_REGISTRADAS) || "[]")); } catch (err) { registradas = new Set(); }

  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function refrescarVistas() {
    const pvp = modo === "jugadores";
    modoMaquinaEl.classList.toggle("hidden", pvp);
    modoJugadoresEl.classList.toggle("hidden", !pvp || !!online);
    colorLabelEl.classList.toggle("hidden", pvp);
    controlesEl.classList.toggle("hidden", pvp && !online);
    zonaEl.classList.toggle("hidden", pvp && !online);
    cerrarOnlineEl.classList.toggle("hidden", !online);
    document.querySelectorAll(".aj-modo").forEach(b => b.classList.toggle("activo", b.dataset.modo === modo));
  }

  function nombreOponente(f) { return f.blancas === miId ? f.nombre_negras : f.nombre_blancas; }
  function idOponente(f) { return f.blancas === miId ? f.negras : f.blancas; }
  function turnoDe(f) { return f.jugadas.length % 2 === 0 ? f.blancas : f.negras; }
  function parseJugada(t) { return { from: t.slice(0, 2), to: t.slice(2, 4), promotion: t[4] || undefined }; }

  function textoResultado(f) {
    if (f.resultado === "tablas") return "Tablas";
    const gane = (f.resultado === "blancas") === (f.blancas === miId);
    const como = f.motivo === "mate" ? "por jaque mate" : "por rendición";
    return gane ? `Ganaste ${como}` : `Perdiste ${como}`;
  }

  function pintarPvp() {
    if (!supa) return;
    const abiertas = partidas.filter(f => f.estado === "pendiente" || f.estado === "en_curso");
    const recibidos = abiertas.filter(f => f.estado === "pendiente" && f.retador !== miId);
    const enviados = abiertas.filter(f => f.estado === "pendiente" && f.retador === miId);
    const enCurso = abiertas.filter(f => f.estado === "en_curso");
    const terminadas = partidas.filter(f => f.estado === "terminada").slice(0, 5);
    let html = "";
    if (recibidos.length) {
      html += `<h3 class="aj-pvp-titulo">Te retaron</h3>` + recibidos.map(f => `
        <div class="aj-pvp-fila aj-pvp-aviso">
          <span><strong>${esc(nombreOponente(f))}</strong> te reta a una partida</span>
          <span><button type="button" class="aj-boton" data-aceptar="${f.id}">Aceptar</button> <button type="button" class="aj-boton" data-rechazar="${f.id}">Rechazar</button></span>
        </div>`).join("");
    }
    if (enCurso.length) {
      html += `<h3 class="aj-pvp-titulo">En curso</h3>` + enCurso.map(f => `
        <div class="aj-pvp-fila">
          <span><strong>${esc(nombreOponente(f))}</strong> · ${turnoDe(f) === miId ? "te toca a ti" : "le toca a él"} · ${f.jugadas.length} jugadas</span>
          <button type="button" class="aj-boton" data-abrir="${f.id}">Abrir</button>
        </div>`).join("");
    }
    if (enviados.length) {
      html += `<h3 class="aj-pvp-titulo">Esperando respuesta</h3>` + enviados.map(f => `
        <div class="aj-pvp-fila">
          <span>Reto a <strong>${esc(nombreOponente(f))}</strong></span>
          <button type="button" class="aj-boton" data-cancelar="${f.id}">Cancelar</button>
        </div>`).join("");
    }
    if (terminadas.length) {
      html += `<h3 class="aj-pvp-titulo">Últimas partidas</h3>` + terminadas.map(f => `
        <div class="aj-pvp-fila">
          <span>contra <strong>${esc(nombreOponente(f))}</strong> · ${esc(textoResultado(f))}</span>
          <button type="button" class="aj-boton" data-abrir="${f.id}">Ver</button>
        </div>`).join("");
    }
    pvpPartidasEl.innerHTML = html;

    const ocupados = new Set(abiertas.map(idOponente));
    pvpJugadoresEl.innerHTML = jugadores.length ? jugadores.map(j => `
      <div class="aj-pvp-fila">
        <span><i class="aj-punto ${presentes.has(j.user_id) ? "on" : ""}" title="${presentes.has(j.user_id) ? "En línea" : "Desconectado"}"></i> ${esc(j.username)}</span>
        <button type="button" class="aj-boton" data-retar="${j.user_id}" ${ocupados.has(j.user_id) ? "disabled" : ""}>${ocupados.has(j.user_id) ? "Partida abierta" : "Retar"}</button>
      </div>`).join("") : `<p class="aj-ayuda">No hay otros jugadores con cuenta todavía.</p>`;
  }

  async function cargarJugadores() {
    const { data } = await supa.rpc("ajedrez_jugadores");
    jugadores = data || [];
    pintarPvp();
  }

  async function cargarPartidas() {
    if (!supa) return;
    const { data, error } = await supa.from("ajedrez_partidas").select("*").order("actualizada", { ascending: false }).limit(40);
    if (error) return;
    partidas = data || [];
    if (online) {
      const f = partidas.find(x => x.id === online.id);
      if (f) aplicarRemoto(f);
    }
    pintarPvp();
    registrarPendientes();
  }

  function programarCarga() {
    clearTimeout(aplazado);
    aplazado = setTimeout(cargarPartidas, 150);
  }

  /* Anota en el ranking las partidas terminadas de los últimos días que aún no
     se anotaron (una vez por partida, aunque se abra desde otro navegador). */
  async function registrarPendientes() {
    if (!window.MjStats || !Chess) return;
    const limite = Date.now() - 3 * 86400000;
    for (const f of partidas) {
      if (f.estado !== "terminada" || !f.resultado || registradas.has(f.id)) continue;
      if (new Date(f.actualizada).getTime() < limite) { registradas.add(f.id); continue; }
      const miColor = f.blancas === miId ? "w" : "b";
      const g = new Chess();
      let mias = 0; let capturas = 0;
      for (const t of f.jugadas) {
        let m = null;
        try { m = g.move(parseJugada(t)); } catch (err) { break; }
        if (m && m.color === miColor) { mias += 1; if (m.captured) capturas += 1; }
      }
      const resultado = f.resultado === "tablas" ? "tablas" : ((f.resultado === "blancas") === (miColor === "w") ? "gana" : "pierde");
      const min = {};
      if (resultado === "gana" && f.motivo === "mate") min.mate = Math.max(1, mias);
      const res = await MjStats.registrar("ajedrez", "jugador", resultado, { suma: { jugadas: mias, capturas }, min });
      if (!res.guardado) return; // se reintenta en la siguiente consulta
      registradas.add(f.id);
      try { localStorage.setItem(CLAVE_REGISTRADAS, JSON.stringify([...registradas].slice(-200))); } catch (err) { /* sin almacenamiento */ }
      cargarRanking();
    }
  }

  /* Pone en el tablero la partida guardada desde cero. */
  function abrirOnline(f) {
    if (!Chess) return;
    modo = "jugadores";
    online = { id: f.id };
    detenerReloj();
    rival = { id: "jugador", nombre: nombreOponente(f), dificultad: "Jugador", frases: null };
    partidaId += 1;
    limpiarArrastre();
    juego = new Chess();
    colorJugador = f.blancas === miId ? "w" : "b";
    seleccion = null; ultimaJugada = null; pensando = false; terminado = false;
    capturadas = { w: [], b: [] };
    comentarioEl.textContent = "";
    for (const t of f.jugadas) {
      try { const h = juego.move(parseJugada(t)); registrarCaptura(h); ultimaJugada = { from: h.from, to: h.to }; } catch (err) { break; }
    }
    rivalActualEl.textContent = `Contra ${rival.nombre} · Jugador`;
    rendirseEl.disabled = f.estado !== "en_curso";
    refrescarVistas();
    pintarTablero(); pintarLaterales();
    mensaje(colorJugador === "w" ? "Te toca." : `Esperando a ${rival.nombre}...`);
    if (f.estado === "terminada") { terminado = true; mensaje(`${textoResultado(f)}.`); rendirseEl.disabled = true; }
    else actualizarEstado();
    document.querySelector(".aj-zona").scrollIntoView({ block: "nearest" });
  }

  /* Pone al día la partida abierta con lo que hay guardado (jugadas nuevas del
     rival o final de la partida). */
  function aplicarRemoto(f) {
    if (!online || f.id !== online.id || !juego || pensando) return;
    const hechas = juego.history().length;
    if (f.jugadas.length > hechas) {
      for (let i = hechas; i < f.jugadas.length; i++) {
        try { jugar(parseJugada(f.jugadas[i]), true); } catch (err) { abrirOnline(f); return; }
      }
    } else if (f.jugadas.length < hechas) {
      abrirOnline(f);
      return;
    }
    if (f.estado === "terminada" && !terminado) {
      if (f.motivo === "rendicion") {
        const gane = (f.resultado === "blancas") === (f.blancas === miId);
        terminar(gane ? `${rival.nombre} se rindió. Ganaste.` : `Te rendiste. ${rival.nombre} gana.`, gane ? "gana" : "pierde");
      } else {
        terminar(`${textoResultado(f)}.`, f.resultado === "tablas" ? "tablas" : "gana");
      }
    }
  }

  async function enviarJugada(hecha) {
    if (!online || !hecha) return;
    const fin = juego.isCheckmate() ? "mate" : (juego.isDraw() ? "tablas" : null);
    pensando = true;
    const { error } = await supa.rpc("ajedrez_mover", {
      p_id: online.id,
      p_jugada: hecha.from + hecha.to + (hecha.promotion || ""),
      p_fin: fin
    });
    pensando = false;
    if (error) {
      // La jugada no llegó: se vuelve a lo que dice el servidor.
      mensaje("No se pudo enviar la jugada. Se restaura la partida.");
      const { data } = await supa.from("ajedrez_partidas").select("*").eq("id", online.id).maybeSingle();
      if (data) abrirOnline(data);
      return;
    }
    cargarPartidas();
  }

  async function accion(rpc, args) {
    const { error } = await supa.rpc(rpc, args);
    if (error) alert(error.message || "No se pudo completar la acción.");
    await cargarPartidas();
  }

  function suscribir() {
    try {
      supa.channel("ajedrez-partidas")
        .on("postgres_changes", { event: "*", schema: "public", table: "ajedrez_partidas" }, programarCarga)
        .subscribe();
      const pres = supa.channel("ajedrez-presencia", { config: { presence: { key: miId } } });
      pres.on("presence", { event: "sync" }, () => { presentes = new Set(Object.keys(pres.presenceState())); pintarPvp(); })
        .subscribe(async estado => { if (estado === "SUBSCRIBED") await pres.track({ en: Date.now() }); });
    } catch (err) { /* sin tiempo real: queda la consulta periódica */ }
    temporizador = setInterval(() => { if (modo === "jugadores" && !document.hidden) cargarPartidas(); }, 4000);
    document.addEventListener("visibilitychange", () => { if (modo === "jugadores" && !document.hidden) cargarPartidas(); });
  }

  async function iniciarOnline() {
    if (enLinea) { cargarJugadores(); cargarPartidas(); return; }
    pvpAvisoEl.textContent = "Conectando...";
    try {
      const sesion = window.MjStats ? (await MjStats.cargarSesion()).sesion : null;
      if (!sesion) { pvpAvisoEl.textContent = "Inicia sesión (arriba a la derecha) para jugar contra otros jugadores."; return; }
      miId = sesion.user.id;
      supa = await fichasCliente();
      enLinea = true;
      pvpAvisoEl.textContent = "Reta a alguien de la lista. Cuando acepte, la partida queda abierta aunque cierres la página: las jugadas esperan a su turno.";
      await Promise.all([cargarJugadores(), cargarPartidas()]);
      suscribir();
    } catch (err) {
      pvpAvisoEl.textContent = "No se pudo conectar. Revisa tu conexión y que el SQL de ajedrez_pvp esté corrido.";
    }
  }

  document.querySelectorAll(".aj-modo").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    if (modo === "jugadores") {
      if (!online) { juego = null; terminado = false; }
      iniciarOnline();
    }
    refrescarVistas();
  }));

  cerrarOnlineEl.addEventListener("click", () => {
    online = null; juego = null; partidaId += 1; limpiarArrastre();
    refrescarVistas();
    cargarPartidas();
  });

  modoJugadoresEl.addEventListener("click", async ev => {
    const b = ev.target.closest("button");
    if (!b || !supa) return;
    const d = b.dataset;
    if (d.retar) { b.disabled = true; await accion("ajedrez_retar", { p_rival: d.retar }); }
    else if (d.aceptar) { await accion("ajedrez_responder", { p_id: d.aceptar, p_aceptar: true }); const f = partidas.find(x => x.id === d.aceptar); if (f && f.estado === "en_curso") abrirOnline(f); }
    else if (d.rechazar) await accion("ajedrez_responder", { p_id: d.rechazar, p_aceptar: false });
    else if (d.cancelar) await accion("ajedrez_rendirse", { p_id: d.cancelar });
    else if (d.abrir) { const f = partidas.find(x => x.id === d.abrir); if (f) abrirOnline(f); }
  });

  pintarRivales();
  mensaje("Cargando el tablero...");
  import("https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm")
    .then(mod => { Chess = mod.Chess; mensaje("Elige a un rival para empezar."); })
    .catch(() => mensaje("No se pudo cargar el motor de ajedrez. Revisa tu conexión a internet y recarga."));
})();
