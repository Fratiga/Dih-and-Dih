/* Ajedrez contra "El perro sabio". Las reglas (movimientos legales, jaque, mate,
   tablas, enroque, al paso) las da chess.js, que se carga al abrir la página;
   la parte que piensa (evaluación y búsqueda con poda alfa-beta) es propia. */
(function () {
  const tableroEl = document.getElementById("ajTablero");
  const estadoEl = document.getElementById("ajEstado");
  const jugadasEl = document.getElementById("ajJugadas");
  const capturasJ = document.getElementById("ajCapturasJugador");
  const capturasR = document.getElementById("ajCapturasRival");
  const nivelEl = document.getElementById("ajNivel");
  const colorEl = document.getElementById("ajColor");
  const nuevaEl = document.getElementById("ajNueva");
  const deshacerEl = document.getElementById("ajDeshacer");
  const resultadoEl = document.getElementById("ajResultado");

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

  const NIVELES = {
    paciente: { prof: 1, tiempo: 300, error: 0.35 },
    normal: { prof: 2, tiempo: 700, error: 0.08 },
    sabio: { prof: 4, tiempo: 1600, error: 0 }
  };

  let Chess = null;
  let juego = null;
  let colorJugador = "w";
  let seleccion = null;
  let ultimaJugada = null;
  let pensando = false;
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

  function elegirJugada(g, nivel) {
    const cfg = NIVELES[nivel];
    const movs = ordenar(g.moves({ verbose: true }));
    if (!movs.length) return null;
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

  function actualizarEstado() {
    if (juego.isCheckmate()) {
      const gano = juego.turn() !== colorJugador;
      terminar(gano ? "Jaque mate. Le ganaste a El perro sabio." : "Jaque mate. El perro sabio te ganó.", gano ? "gana" : "pierde");
    } else if (juego.isDraw()) {
      terminar("Tablas.", "tablas");
    } else if (juego.turn() === colorJugador) {
      mensaje(juego.inCheck() ? "Estás en jaque. Te toca." : "Te toca.");
    }
  }

  function terminar(texto, resultado) {
    terminado = true;
    mensaje(texto);
    const nivel = nivelEl.value;
    if (resultado === "gana") {
      record[nivel] = (record[nivel] || 0) + 1;
      try { localStorage.setItem(CLAVE_RECORD, JSON.stringify(record)); } catch (err) { /* sin almacenamiento */ }
    }
    pintarRecord();
  }

  function pintarRecord() {
    resultadoEl.textContent = `Victorias: Paciente ${record.paciente || 0} · Normal ${record.normal || 0} · Sabio ${record.sabio || 0}`;
  }

  function registrarCaptura(m) {
    if (m.captured) capturadas[m.color].push(m.captured);
  }

  function jugar(m) {
    const hecha = juego.move(m);
    registrarCaptura(hecha);
    ultimaJugada = { from: hecha.from, to: hecha.to };
    seleccion = null;
    pintarTablero();
    pintarLaterales();
    actualizarEstado();
  }

  function turnoRival() {
    if (terminado || juego.turn() === colorJugador) return;
    pensando = true;
    mensaje("El perro sabio piensa...");
    setTimeout(() => {
      const m = elegirJugada(juego, nivelEl.value);
      pensando = false;
      if (m && !terminado) jugar(m);
    }, 80);
  }

  tableroEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-casilla]");
    if (!b || terminado || pensando || !juego || juego.turn() !== colorJugador) return;
    const casilla = b.dataset.casilla;
    const pieza = juego.get(casilla);
    if (seleccion) {
      const mov = juego.moves({ square: seleccion, verbose: true }).find(m => m.to === casilla);
      if (mov) {
        // Coronación automática a dama
        jugar({ from: mov.from, to: mov.to, promotion: mov.promotion ? "q" : undefined });
        turnoRival();
        return;
      }
    }
    if (pieza && pieza.color === colorJugador) seleccion = seleccion === casilla ? null : casilla;
    else seleccion = null;
    pintarTablero();
  });

  function nuevaPartida() {
    juego = new Chess();
    colorJugador = colorEl.value === "negras" ? "b" : "w";
    seleccion = null; ultimaJugada = null; pensando = false; terminado = false;
    capturadas = { w: [], b: [] };
    pintarTablero(); pintarLaterales();
    mensaje(colorJugador === "w" ? "Te toca." : "El perro sabio empieza.");
    if (colorJugador === "b") turnoRival();
  }

  deshacerEl.addEventListener("click", () => {
    if (!juego || pensando || terminado) return;
    // Deshace la jugada del rival y la tuya
    const n = juego.turn() === colorJugador ? 2 : 1;
    for (let i = 0; i < n && juego.history().length; i++) {
      const u = juego.undo();
      if (u && u.captured) capturadas[u.color].pop();
    }
    seleccion = null; ultimaJugada = null;
    pintarTablero(); pintarLaterales(); actualizarEstado();
  });
  nuevaEl.addEventListener("click", nuevaPartida);
  colorEl.addEventListener("change", nuevaPartida);

  pintarRecord();
  mensaje("Cargando el tablero...");
  import("https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm")
    .then(mod => { Chess = mod.Chess; nuevaPartida(); })
    .catch(() => mensaje("No se pudo cargar el motor de ajedrez. Revisa tu conexión a internet y recarga."));
})();
