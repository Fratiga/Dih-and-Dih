/* =============================================================================
   EL POZO DEL DRAGÓN (pozo-dragon.html)
   El servidor (docs/pozo-dragon.sql) tira los dados, lleva los turnos, reserva el dinero y las cartas, cuenta el pozo y paga. Esta página pregunta por el estado de la mesa
   cada pocos segundos y lo pinta; lo que haces (tirar, cobrar, continuar...) se manda con el paso de la mesa que veías, así que repetirlo por un corte de red es seguro.
   Las animaciones de los dados enseñan un resultado que ya está decidido: nunca lo deciden.
   Piezas: pozo-dragon-arte.js (dibujos), pozo-dragon-vista.js (textos y reglas), veintiuna-api.js (red).
============================================================================= */
(function () {
  const A = window.PozoArte, V = window.PozoVista, E = window.PozoEscena;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const api = window.VeintiunaApi.crear(() => fichasCliente());
  const reducir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
  const sinMovimiento = () => reducir.matches;
  const guardado = {
    leer(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    poner(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const SONDEO_MS = 1500, SONDEO_FONDO_MS = 5000, LISTA_MS = 4000;
  const RAREZAS = { comun: "Común", infrecuente: "Poco común", rara: "Rara", legendaria: "Legendaria", limitada: "Limitada" };

  const S = {
    sesion: null,
    vista: "cargando",        // cargando | sin_sesion | oculto | sin_conexion | lobby | sala | mesa | fin
    est: null,                // lo último que dijo el servidor de tu mesa
    version: null,
    lista: null,              // mesas abiertas y ajustes
    saldo: null,
    form: { abierto: null },
    misCartas: null,
    seleccion: [],
    ocupado: false,
    reintento: null,
    efectos: guardado.leer("pzEfectos", "1") !== "0",
    primerPintado: true,
    vistoTirada: {},          // asiento -> id de la última tirada que ya se animó
    limite: { t0: 0, s: null },
    sondeo: null,
    timerLista: null,
    animando: false,
    teatro: false,            // una tirada se está enseñando: mientras dura, lo nuevo que llegue del servidor espera en cola
    cola: null,
    vigiaBase: "espera",
    rapido: guardado.leer("pzRapido", "0") === "1",
    solo: null,               // la partida en solitario (si hay)
    vistoSolo: 0,
    reglasSolo: null,
    desafios: null            // los desafíos de hoy con el progreso
  };

  /* ---------------------------------------------------------------- movimiento */
  function animar(el, fotogramas, opciones) {
    if (!el || !el.animate || sinMovimiento()) return Promise.resolve();
    try {
      const o = Object.assign({ fill: "both", easing: "cubic-bezier(.2,.8,.2,1)" }, opciones);
      const anim = el.animate(fotogramas, o);
      return Promise.race([anim.finished.catch(() => {}), new Promise(ok => setTimeout(() => { try { anim.finish(); } catch (e) { /* ya terminó */ } ok(); }, (o.duration || 300) + 350))]);
    } catch (e) { return Promise.resolve(); }
  }
  const esperar = ms => new Promise(ok => setTimeout(ok, ms));

  /* ---------------------------------------------------------------- sonidos (sintetizados, opcionales) */
  const Sonido = (() => {
    let ctx = null;
    const listo = () => {
      if (!S.efectos) return null;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; }
    };
    function tono(f, dur, tipo, vol, inicio) {
      const c = listo(); if (!c) return;
      const t0 = c.currentTime + (inicio || 0), o = c.createOscillator(), g = c.createGain();
      o.type = tipo || "sine"; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.03);
    }
    function ruido(dur, hz, vol, inicio) {
      const c = listo(); if (!c) return;
      const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + (inicio || 0);
      s.buffer = b; f.type = "bandpass"; f.frequency.value = hz; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
    }
    return {
      dados() { for (let i = 0; i < 5; i++) ruido(0.05, 900 + Math.random() * 900, 0.4, i * 0.09); },
      cae() { ruido(0.08, 400, 0.5); tono(160, 0.08, "triangle", 0.06); },
      moneda() { tono(1800, 0.07, "triangle", 0.08); tono(2400, 0.09, "triangle", 0.06, 0.05); },
      ruina() { tono(196, 0.5, "sawtooth", 0.05); tono(147, 0.7, "sawtooth", 0.05, 0.18); tono(98, 0.9, "sawtooth", 0.05, 0.4); },
      premio() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.26, "sine", 0.09, i * 0.08)); },
      grande() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, 0.34, "triangle", 0.09, i * 0.07)); },
      turno() { tono(660, 0.1, "sine", 0.07); tono(880, 0.14, "sine", 0.06, 0.09); },
      pierde() { tono(233, 0.4, "sawtooth", 0.05); tono(175, 0.55, "sawtooth", 0.05, 0.2); },
      grunido() { tono(55, 1.1, "sawtooth", 0.07); tono(82, 0.9, "triangle", 0.05, 0.12); ruido(0.9, 170, 0.22, 0.05); }
    };
  })();
  const sonar = nombre => { try { Sonido[nombre](); } catch (e) { /* sin audio */ } };

  /* ---------------------------------------------------------------- brasas (fondo animado, ligero y opcional) */
  const Brasas = (() => {
    let cv, cx, w = 0, h = 0, parts = [], activo = false, raf = 0, ultimo = 0;
    function medir() { w = cv.width = Math.max(1, Math.round(innerWidth * 0.5)); h = cv.height = Math.max(1, Math.round(innerHeight * 0.5)); }
    function nueva(y) { return { x: Math.random() * w, y: y == null ? Math.random() * h : y, v: 6 + Math.random() * 16, r: 0.7 + Math.random() * 1.6, f: Math.random() * 6.28, a: 0.25 + Math.random() * 0.5 }; }
    function cuadro(t) {
      raf = requestAnimationFrame(cuadro);
      if (t - ultimo < 40) return;
      const dt = Math.min(0.1, (t - ultimo) / 1000 || 0); ultimo = t;
      cx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.v * dt; p.f += dt * 2.2; p.x += Math.sin(p.f) * 0.25;
        if (p.y < -4) Object.assign(p, nueva(h + 4));
        cx.globalAlpha = p.a * (0.55 + 0.45 * Math.abs(Math.sin(p.f)));
        cx.fillStyle = p.r > 1.7 ? "#ebc35e" : "#cf7335";
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill();
      }
      cx.globalAlpha = 1;
    }
    return {
      iniciar() {
        cv = $("pzBrasas"); if (!cv || sinMovimiento()) return;
        try { cx = cv.getContext("2d"); } catch (e) { return; }
        medir(); addEventListener("resize", medir);
        parts = Array.from({ length: 46 }, () => nueva());
        activo = true; raf = requestAnimationFrame(cuadro);
        document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); } else if (activo) raf = requestAnimationFrame(cuadro); });
      },
      estallido(n) { if (!activo) return; for (let i = 0; i < n; i++) { const p = nueva(h * (0.6 + Math.random() * 0.4)); p.v *= 3; p.a = 0.9; parts.push(p); } setTimeout(() => { parts.length = Math.min(parts.length, 46); }, 2200); }
    };
  })();

  /* ---------------------------------------------------------------- avisos y diálogos */
  function leer(texto, fuerte) {
    const el = $(fuerte ? "pzSrFuerte" : "pzSr");
    el.textContent = "";
    setTimeout(() => { el.textContent = texto; }, 30);
  }
  function aviso(texto, opciones) {
    const el = $("pzAviso");
    if (!texto) { el.hidden = true; el.innerHTML = ""; return; }
    const o = opciones || {};
    el.hidden = false;
    el.className = "pz-aviso" + (o.tipo ? " pz-aviso-" + o.tipo : "");
    el.innerHTML = `<span>${esc(texto)}</span>${o.reintentar ? `<button type="button" class="pz-boton-mini" data-reintentar>Reintentar</button>` : ""}${o.cerrar ? `<button type="button" class="pz-boton-mini" data-cerrar-aviso aria-label="Cerrar el aviso">×</button>` : ""}`;
    if (o.tipo === "error") leer(texto, true);
  }
  function abrir(dlg, html) {
    dlg.innerHTML = html;
    dlg.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", () => dlg.close()));
    if (!dlg.dataset.listo) {
      dlg.dataset.listo = "1";
      dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
      dlg.addEventListener("close", () => { const w = dlg._volver; if (w && document.contains(w)) { try { w.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } } });
    }
    dlg._volver = document.activeElement;
    if (!dlg.open) dlg.showModal();
  }
  const cabeceraDlg = (id, titulo, sub) => `<header class="pz-dlg-cab"><div><p class="eyebrow">EL POZO DEL DRAGÓN</p><h2 id="${id}">${esc(titulo)}</h2>${sub ? `<p class="pz-dlg-sub">${esc(sub)}</p>` : ""}</div><button type="button" class="pz-cerrar" data-cerrar aria-label="Cerrar">×</button></header>`;

  function abrirReglas(modo) {
    const est = S.est, r = est && est.reglas ? est.reglas : {};
    const bonos = r.bonos || { pareja: 0.125, escalera: 0.375, triple: 0.75, triple_seis: 2 };
    const solo = reglasSoloVigentes();
    const filas = V.ORDEN_MEJOR_A_PEOR.map(c => {
      const k = V.CATEGORIAS[c], casos = V.CASOS[c];
      return `<tr><td>${A.ejemplo(c)}</td><th scope="row">${esc(k.nombre)}</th><td>${esc(k.texto)}</td><td class="pz-num">${casos}/216 · ${V.num(casos / 216 * 100)} %</td><td class="pz-num">${c === "ruina" ? "eliminado" : c === "ceniza" ? "—" : "+" + V.pct(bonos[c])}</td><td class="pz-num">${c === "ruina" ? "lo pierdes todo" : c === "ceniza" ? "—" : "+" + V.pct((solo.bonos || V.SOLO_BONOS)[c])}</td></tr>`;
    }).join("");
    const lista = xs => `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    abrir($("pzDlgReglas"), `${cabeceraDlg("pzDlgReglasT", "Cómo se juega", "Tres dados, un pozo y la decisión de cuánto arriesgar")}
      <div class="pz-dlg-cuerpo">
        <section><h3>Las combinaciones</h3>
          <table class="pz-tabla"><thead><tr><th scope="col">Ejemplo</th><th scope="col">Nombre</th><th scope="col">Cómo sale</th><th scope="col">Probabilidad</th><th scope="col">Bono (Compartido)</th><th scope="col">Bono (Solo)</th></tr></thead><tbody>${filas}</tbody></table>
          <p class="pz-ayuda">Son 216 resultados posibles con tres dados normales. La Ruina manda sobre cualquier otra combinación: 1-1-2 es Ruina aunque tenga una pareja. Las columnas de bono cuentan solo en El Pozo Compartido y en el modo Solo (cada uno con sus porcentajes).</p></section>
        <section><h3>Solo contra el Dragón</h3>${lista(V.reglasSolo(solo))}</section>
        <section><h3>Duelo de Dragones</h3>${lista(V.reglasDuelo(r))}</section>
        <section><h3>El Pozo Compartido</h3>${lista(V.reglasCompartido(Object.assign({ bonos }, r)))}</section>
        <section><h3>En las dos modalidades</h3>${lista(V.REGLAS_COMUNES)}</section>
      </div>`);
  }
  /* ---------------------------------------------------------------- desafíos: cartas por jugar */
  const NIVELES = { bronce: "Bronce", plata: "Plata", oro: "Oro" };
  const estadoDesafio = l => (l.reclamado ? "reclamado" : l.completado ? "listo" : "pendiente");
  function pintarInsignia() {
    const n = S.desafios ? S.desafios.desafios.filter(l => estadoDesafio(l) === "listo").length : 0, el = $("pzInsignia"), b = $("pzBtnDesafios");
    if (!el || !b) return;
    el.hidden = !n; el.textContent = n ? String(n) : "";
    b.setAttribute("aria-label", n ? `Desafíos, ${n} listos para reclamar` : "Desafíos");
  }
  async function cargarDesafios() {
    if (!S.sesion) return;
    const b = $("pzBtnDesafios");
    try { S.desafios = await api.pozo.desafios(); if (b) b.hidden = false; pintarInsignia(); }
    catch (e) { S.desafios = null; if (b) b.hidden = true; }              // los desafíos son un extra: si el servidor aún no los tiene o no cargan, no hay botón y el juego sigue
  }
  function textoReinicioDesafios(d) {
    const min = Math.max(0, Math.round((Number(d.reinicia_en_s) || 0) / 60)), h = Math.floor(min / 60);
    return `Se reinician cada día: dentro de ${h ? h + " h " : ""}${min % 60} min. Lo que no reclames antes se pierde, y después puedes completarlos de nuevo.`;
  }
  async function abrirDesafios() {
    if (!S.desafios) await cargarDesafios();
    const d = S.desafios;
    if (!d) { aviso("No se pudieron cargar los desafíos. Inténtalo de nuevo en un momento.", { tipo: "error", cerrar: true }); return; }
    const tarjeta = l => {
      const est = estadoDesafio(l), pct = Math.round(100 * l.progreso / l.meta);
      return `<li class="pz-logro ${est}" data-nivel="${l.nivel}">
        <div class="pz-logro-cab"><strong>${esc(l.nombre)}</strong><span class="pz-logro-estado">${est === "reclamado" ? "Reclamado" : est === "listo" ? "Completado" : `${V.num(l.progreso)} de ${V.num(l.meta)}`}</span></div>
        <p>${esc(l.texto)}</p>
        <div class="pz-barra-logro" role="progressbar" aria-label="${esc(l.nombre)}" aria-valuemin="0" aria-valuemax="${l.meta}" aria-valuenow="${l.progreso}"><i style="width:${pct}%"></i></div>
        ${est === "listo" ? `<button type="button" class="pz-boton pz-boton-principal pz-boton-chico" data-reclamar-desafio="${esc(l.id)}">Reclamar carta</button>` : ""}
        ${est === "reclamado" && l.carta ? `<small class="pz-logro-carta">Recibiste: ${esc((window.cartaPorId && window.cartaPorId(l.carta) || { nombre: l.carta }).nombre)}</small>` : ""}
      </li>`;
    };
    abrir($("pzDlgDesafios"), `${cabeceraDlg("pzDlgDesafiosT", "Desafíos", "Cartas por jugar: se comprueban en el servidor")}
      <div class="pz-dlg-cuerpo">
        <p class="pz-estado-sala" id="pzDesafiosEstado" role="status" aria-live="polite"${S.mensajeDesafios ? "" : " hidden"}>${esc(S.mensajeDesafios || "")}</p>
        ${d.activo ? "" : `<p class="pz-aviso-jugador">Las cartas de este juego todavía no se reparten. Tus desafíos se siguen completando y quedan guardados hasta el reinicio del día.</p>`}
        <p class="pz-ayuda">${esc(textoReinicioDesafios(d))} Cada desafío da una carta de Triunfos (las de plata y oro, mejores) y se reclama una sola vez al día. Cuentan las partidas con dinero en juego.</p>
        ${["bronce", "plata", "oro"].map(n => `<section class="pz-logros-nivel" data-nivel="${n}"><h3>${NIVELES[n]}</h3><ul class="pz-logros">${d.desafios.filter(l => l.nivel === n).map(tarjeta).join("")}</ul></section>`).join("")}
      </div>`);
    $("pzDlgDesafios").querySelectorAll("[data-reclamar-desafio]").forEach(b => b.addEventListener("click", () => reclamarDesafio(b.dataset.reclamarDesafio, b)));
  }
  async function reclamarDesafio(id, boton) {
    if (S.ocupado) return;
    boton.setAttribute("aria-disabled", "true"); boton.textContent = "Reclamando...";
    try {
      const r = await api.pozo.reclamar(id);
      if (r && r.resultado === "carta") {
        S.mensajeDesafios = "";
        if (window.Recompensas && window.Recompensas.mostrar) await window.Recompensas.mostrar("pozo_dragon", r);
      } else {
        const motivos = { "juego-inactivo": "Las cartas de este juego todavía no se reparten. Tu desafío sigue guardado hasta el reinicio del día.", "tope-diario": "Hoy ya reclamaste todas las cartas que da el juego. El desafío sigue guardado hasta el reinicio del día.", agotado: "Ahora mismo no queda ninguna carta que dar. El desafío sigue guardado hasta el reinicio del día." };
        S.mensajeDesafios = motivos[r && r.motivo] || "No se pudo entregar la carta ahora. El desafío sigue guardado.";
      }
      await cargarDesafios(); abrirDesafios(); S.mensajeDesafios = "";
    } catch (e) {
      S.mensajeDesafios = V.mensajeError(e); await cargarDesafios(); abrirDesafios(); S.mensajeDesafios = "";
    }
  }
  function abrirAtajos() {
    abrir($("pzDlgAtajos"), `${cabeceraDlg("pzDlgAtajosT", "Atajos de teclado")}
      <div class="pz-dlg-cuerpo"><table class="pz-tabla"><tbody>
        <tr><td><kbd>T</kbd></td><td>Tirar los dados</td></tr><tr><td><kbd>C</kbd></td><td>Cobrar (Pozo Compartido)</td></tr><tr><td><kbd>S</kbd></td><td>Seguir tirando (continuar)</td></tr></tbody></table>
      <p>Todos los botones también se manejan con Tab e Intro.</p></div>`);
  }

  /* ---------------------------------------------------------------- saldo */
  function pintarSaldo(n) {
    const x = Number(n);
    $("pzSaldo").textContent = Number.isFinite(x) ? V.num(x) : "—";
    if (Number.isFinite(x)) S.saldo = x;
  }
  const saldoActual = () => (S.est && S.est.yo && S.est.yo.saldo != null ? Number(S.est.yo.saldo) : Number(S.saldo) || 0);

  /* ---------------------------------------------------------------- relojes */
  function fijarLimite(s) { S.limite = { t0: Date.now(), s: s == null ? null : Number(s) }; }
  const segundosRestantes = () => (S.limite.s == null ? null : Math.max(0, Math.round(S.limite.s - (Date.now() - S.limite.t0) / 1000)));
  function pintarReloj() {
    const s = segundosRestantes();
    document.querySelectorAll("[data-reloj]").forEach(el => { el.textContent = s == null ? "" : (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`); });
  }

  /* ---------------------------------------------------------------- cartas ofrecidas */
  const rarezaDe = c => RAREZAS[c.rareza] || c.rareza || "";
  function listaCartas(cartas, vacio) {
    if (!cartas || !cartas.length) return vacio ? `<p class="pz-ayuda">${esc(vacio)}</p>` : "";
    return `<ul class="pz-oferta">${cartas.map(c => `<li><span>${esc(c.nombre || c.carta)}</span><small><span class="pz-rareza" data-r="${esc(c.rareza)}">${esc(rarezaDe(c))}</span>${c.numero != null ? ` · nº ${esc(c.numero)}` : ""}</small></li>`).join("")}</ul>`;
  }

  /* ---------------------------------------------------------------- vistas */
  function mostrar(vista) {
    const antes = S.vista;
    S.vista = vista;
    $("pzSala").dataset.vista = vista;
    $("pzLobby").hidden = vista !== "lobby";
    $("pzSalaEspera").hidden = vista !== "sala";
    $("pzMesa").hidden = !(vista === "mesa" || vista === "fin");
    $("pzSolo").hidden = vista !== "solo";
    if (vista === "sin_sesion" || vista === "oculto" || vista === "sin_conexion" || vista === "cargando") {
      $("pzLobby").hidden = false;
      $("pzLobby").innerHTML = `<p class="pz-lema" role="status">${{
        cargando: "Encendiendo las brasas...",
        sin_sesion: "Hay que iniciar sesión para sentarte a esta mesa. Usa el botón de arriba a la derecha.",
        oculto: "El Pozo del Dragón todavía no está abierto. Cuando lo esté, lo verás en Minijuegos.",
        sin_conexion: "No hay conexión con la mesa. Se reintentará sola."
      }[vista]}</p>`;
      S.lobbyArmado = false;
    }
    // Al empezar una partida o sentarte, la mesa sube hasta quedar a la vista para no tener que bajar a por los botones
    if (antes !== vista && (vista === "solo" || vista === "mesa")) {
      requestAnimationFrame(() => { const t = $("pzSala").getBoundingClientRect().top + window.scrollY - 60; window.scrollTo({ top: Math.max(0, t), behavior: sinMovimiento() ? "auto" : "smooth" }); });
    }
  }

  /* ---- Lobby ---- */
  function formModo(modo) {
    const aj = (S.lista && S.lista.ajustes) || { apuesta_min: 10, apuesta_paso: 10, apuesta_max: 0, cartas_max: 3 };
    const abierto = S.form.abierto === modo;
    const opcionesCartas = Array.from({ length: aj.cartas_max + 1 }, (_, i) => `<option value="${i}">${i === 0 ? "Sin cartas" : V.plural(i, "carta", "cartas") + " por jugador"}</option>`).join("");
    const maxJug = modo === "compartido" ? `<label class="pz-campo"><span>Jugadores como máximo</span><select data-f="max">${[2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === 4 ? " selected" : ""}>${n}</option>`).join("")}</select></label>` : "";
    return `<form class="pz-form" data-form="${modo}" ${abierto ? "" : "hidden"} novalidate>
        <label class="pz-campo"><span>Nombre de la mesa (opcional)</span><input type="text" data-f="nombre" maxlength="30" autocomplete="off" placeholder="${modo === "duelo" ? "Duelo de..." : "Pozo de..."}"></label>
        <div class="pz-fila">
          <label class="pz-campo"><span>Apuesta de dinero</span><input type="number" data-f="dinero" min="0" step="${aj.apuesta_paso}" value="${aj.apuesta_min}" inputmode="numeric"></label>
          <label class="pz-campo"><span>Cartas</span><select data-f="cartas">${opcionesCartas}</select></label>
          ${maxJug}
        </div>
        <p class="pz-ayuda" data-resumen-apuesta></p>
        <label class="pz-opcion"><input type="checkbox" data-f="privada" checked> Mesa privada (solo con el código)</label>
        <button type="submit" class="pz-boton pz-boton-principal">${modo === "duelo" ? "Crear el duelo" : "Crear la mesa"}</button>
      </form>`;
  }
  function pintarLobby() {
    const aj = (S.lista && S.lista.ajustes) || { apuesta_min: 10, apuesta_paso: 10, apuesta_max: 0 };
    const min = Number(aj.apuesta_min) || 10;
    const fichas = [min, min * 5, min * 10, min * 50, min * 100];
    $("pzLobby").innerHTML = `
      <section class="pz-heroe" id="pzHeroe" aria-label="Solo contra el Dragón">
        <div class="pz-heroe-arte" id="pzHeroeArte" aria-hidden="true">${A.dragonHeroe()}</div>
        <div class="pz-heroe-cuerpo">
          <p class="eyebrow">CASA DE JUEGO</p>
          <p class="pz-heroe-titulo" aria-hidden="true">El Pozo del Dragón</p>
          <p class="pz-heroe-lema">Tres dados. Un tesoro. Una criatura que espera que te equivoques.</p>
          <form class="pz-solo" data-form-solo novalidate>
            <div class="pz-solo-cab"><span class="pz-solo-icono" aria-hidden="true">${A.ojo()}</span><div><h2>Solo contra el Dragón</h2><p>Aumenta el premio y decide cuándo retirarte.</p></div></div>
            <div class="pz-solo-apuesta">
              <label class="pz-campo"><span>Tu apuesta, en tokens</span><input type="number" data-f="dinero" min="0" step="${aj.apuesta_paso}" value="${min}" inputmode="numeric"></label>
              <div class="pz-fichas" role="group" aria-label="Apuestas rápidas">${fichas.map(n => `<button type="button" class="pz-ficha" data-ficha="${n}">${V.num(n)}</button>`).join("")}<button type="button" class="pz-ficha pz-ficha-todo" data-ficha-todo>Todo</button></div>
            </div>
            <p class="pz-riesgo" data-resumen-solo></p>
            <button type="submit" class="pz-boton pz-boton-principal pz-boton-grande">Jugar en solitario</button>
          </form>
        </div>
      </section>
      <div class="pz-otros">
        <article class="pz-modo-mini" data-modo-tarjeta="duelo">
          <div class="pz-modo-mini-arte" aria-hidden="true">${A.dado(6)}${A.dado(5)}</div>
          <div class="pz-modo-mini-texto"><h2>Duelo de Dragones</h2><p>Desafía a otro jugador.</p></div>
          <button type="button" class="pz-boton" data-abrir-form="duelo">Crear un duelo</button>
        </article>
        <article class="pz-modo-mini" data-modo-tarjeta="compartido">
          <div class="pz-modo-mini-arte pz-ojos" aria-hidden="true">${A.ojo()}${A.ojo()}${A.ojo()}</div>
          <div class="pz-modo-mini-texto"><h2>Pozo Compartido</h2><p>Todos arriesgan por el tesoro.</p></div>
          <button type="button" class="pz-boton" data-abrir-form="compartido">Crear una mesa</button>
        </article>
      </div>
      <div class="pz-panel-form" id="pzPanelForm" ${S.form.abierto ? "" : "hidden"}>${formModo("duelo")}${formModo("compartido")}</div>
      <div class="pz-lobby-pie">
        <div class="pz-caja"><h3>Mesas abiertas</h3><div class="pz-mesas" id="pzMesasLista"></div></div>
        <div class="pz-caja"><h3>Entrar con un código</h3>
          <form id="pzFormEntrar" class="pz-form" novalidate><label class="pz-campo"><span>Código de la mesa</span><input type="text" id="pzCodigo" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE"></label>
            <button type="submit" class="pz-boton">Entrar</button></form></div>
      </div>
      <p class="pz-pie-reglas"><button type="button" class="pz-boton-mini" data-reglas="todas">Cómo se juega, las combinaciones y lo que se apuesta</button></p>`;
    S.lobbyArmado = true;
    pintarMesasLista();
    document.querySelectorAll("[data-form]").forEach(actualizarResumen);
    document.querySelectorAll("[data-form-solo]").forEach(actualizarResumenSolo);
    // Si hay una imagen propia del dragón en assets/cosas/pozo-dragon-heroe.webp, se usa en lugar del dibujo
    const img = new Image();
    img.onload = () => { const a = $("pzHeroeArte"); if (a) { a.style.backgroundImage = `url("${img.src}")`; a.classList.add("con-imagen"); } };
    img.src = "assets/cosas/pozo-dragon-heroe.webp";
  }
  function pintarMesasLista() {
    const el = $("pzMesasLista"); if (!el) return;
    const ms = (S.lista && S.lista.mesas) || [];
    el.innerHTML = ms.length ? ms.map(m => `<div class="pz-mesa-item"><div><strong>${esc(m.nombre)}</strong><small>${m.modo === "duelo" ? "Duelo" : "Pozo Compartido"} · ${esc(V.textoApuesta(m))} · ${m.jugadores.length} de ${m.max}: ${esc(m.jugadores.join(", "))}</small></div>
        <button type="button" class="pz-boton" data-unirse="${esc(m.codigo)}">Unirse</button></div>`).join("") : `<p class="pz-vacio">No hay mesas públicas abiertas. Crea una o pide un código a un amigo.</p>`;
  }
  function leerForm(modo) {
    const f = document.querySelector(`[data-form="${modo}"]`);
    const g = k => { const e = f.querySelector(`[data-f="${k}"]`); return e ? (e.type === "checkbox" ? e.checked : e.value) : null; };
    return { nombre: g("nombre"), dinero: Number(g("dinero")) || 0, cartas: Number(g("cartas")) || 0, max: modo === "compartido" ? Number(g("max")) || 4 : 2, privada: !!g("privada") };
  }
  function actualizarResumen(f) {
    const modo = f.dataset.form, v = leerForm(modo), el = f.querySelector("[data-resumen-apuesta]");
    if (!el) return;
    const sin = v.dinero <= 0 && v.cartas <= 0;
    el.textContent = sin ? "Hay que apostar dinero, cartas o las dos cosas."
      : `Cada jugador pondrá ${V.textoApuesta(v)} (${V.tipoApuesta(v)}). ${modo === "duelo" ? `El ganador se lleva todo.` : `Con ${v.max} jugadores el pozo de dinero será de ${V.num(v.dinero * v.max)} tokens.`} Nada se descuenta hasta que confirmes en la sala.`;
  }

  /* ---- Sala de espera ---- */
  function pintarSala(est) {
    const yo = V.jugadorYo(est), r = est.reglas, n = est.jugadores.length;
    const pozoDinero = r.dinero * n;
    const conf = est.estado === "confirmando";
    const todasOfertas = est.jugadores.every(j => j.oferta_completa);
    const miOferta = yo ? yo.oferta : [];
    const saldoDespues = saldoActual() - (yo && yo.estado === "confirmado" ? 0 : r.dinero);
    const puedeConfirmar = conf && yo && yo.estado !== "confirmado" && todasOfertas && saldoActual() >= r.dinero;
    $("pzSalaEspera").innerHTML = `
      <div class="pz-barra">
        <div><span class="pz-codigo" title="Código de la mesa">${esc(est.codigo)}</span> <button type="button" class="pz-boton-mini" data-copiar="${esc(est.codigo)}">Copiar código</button></div>
        <div class="pz-barra-sub">${est.modo === "duelo" ? "Duelo de Dragones" : "El Pozo Compartido"} · ${est.privada ? "privada" : "pública"} · ${est.estado === "confirmando" ? "confirmando" : "esperando jugadores"} <span class="pz-reloj" data-reloj></span></div>
        <button type="button" class="pz-boton-mini" data-salir>Salir de la mesa</button>
      </div>
      <section class="pz-terminos" aria-label="Condiciones de la mesa">
        <h2>Condiciones</h2>
        <p class="pz-grande">Cada jugador pone: ${esc(V.textoApuesta(r))}</p>
        <p>Tipo de apuesta: ${V.tipoApuesta(r)}. ${est.modo === "duelo" ? "El ganador se lleva las dos apuestas: el dinero y las cartas del que pierde." : `Pozo si llegáis ${n}: ${V.num(pozoDinero)} tokens de juego${r.cartas > 0 ? ` y ${V.plural(r.cartas * n, "carta", "cartas")} en juego` : ""}. Se reparte entre quienes no caigan en Ruina, en proporción a su peso.`}</p>
        <p>Sin comisiones: lo que se paga es exactamente lo apostado. Los dados los tira el servidor. <button type="button" class="pz-boton-mini" data-reglas="${est.modo}">Ver las reglas completas</button></p>
      </section>
      <p class="pz-estado-sala" role="status">${esc(V.estadoSala(est))}</p>
      <div class="pz-asientos">${est.jugadores.map(j => `
        <article class="pz-asiento" data-yo="${j.yo ? 1 : 0}" data-e="${esc(j.estado)}">
          <div class="pz-asiento-cab"><span class="pz-asiento-nombre">${esc(j.yo ? j.nombre + " (tú)" : j.nombre)}</span><span class="pz-chip" data-e="${esc(j.estado)}">${esc(V.estadoJugador(j))}</span></div>
          ${r.dinero > 0 ? `<p class="pz-ayuda">${j.estado === "confirmado" ? `Reservados ${V.num(r.dinero)} tokens.` : `Pondrá ${V.num(r.dinero)} tokens al confirmar.`}</p>` : ""}
          ${r.cartas > 0 ? (j.oferta.length ? listaCartas(j.oferta) : `<p class="pz-ayuda">Todavía no ha ofrecido ${V.plural(r.cartas, "carta", "cartas")}.</p>`) : ""}
          ${j.aviso ? `<p class="pz-aviso-jugador">${esc(j.aviso)}</p>` : ""}
        </article>`).join("")}${Array.from({ length: Math.max(0, r.max - n) }, () => `<article class="pz-asiento" data-e="vacio"><div class="pz-asiento-cab"><span class="pz-asiento-nombre">Asiento libre</span></div><p class="pz-ayuda">${est.estado === "abierta" ? "Esperando a alguien." : "La inscripción está cerrada."}</p></article>`).join("")}
      </div>
      <div class="pz-acciones" id="pzDock" tabindex="-1">
        ${r.cartas > 0 && yo && yo.estado !== "confirmado" ? `<button type="button" class="pz-boton" data-elegir-cartas>${miOferta.length === r.cartas ? "Cambiar mis cartas" : `Elegir mis ${V.plural(r.cartas, "carta", "cartas")}`}</button>` : ""}
        ${est.estado === "abierta" && est.creador && est.modo === "compartido" ? `<button type="button" class="pz-boton pz-boton-principal" data-cerrar-inscripcion ${n < r.min ? 'aria-disabled="true"' : ""}>Cerrar la inscripción</button>` : ""}
        ${conf && yo && yo.estado !== "confirmado" ? `<button type="button" class="pz-boton pz-boton-principal" data-confirmar ${puedeConfirmar ? "" : 'aria-disabled="true"'}>Confirmar y reservar mi apuesta<span class="pz-boton-sub">${r.dinero > 0 ? `se descuentan ${V.num(r.dinero)} tokens de tu saldo (${V.num(saldoActual())} → ${V.num(saldoDespues)})` : "se bloquean tus cartas"}</span></button>` : ""}
        ${conf && yo && yo.estado === "confirmado" ? `<button type="button" class="pz-boton" data-retirar-confirmacion>Retirar mi confirmación</button>` : ""}
      </div>
      ${conf && yo && yo.estado !== "confirmado" && saldoActual() < r.dinero ? `<p class="pz-estado-sala">Te faltan ${V.num(r.dinero - saldoActual())} tokens para confirmar.</p>` : ""}`;
  }

  /* ---- Mesa en juego y final ---- */
  const REPOSO = [2, 5, 4];                      // las caras de unos dados que todavía no se han tirado
  // Los dados de una tirada como cubos; sin tirada, tres cubos quietos y apagados
  const cubos = ult => (ult ? E.dados(ult.dados, "cat-" + ult.categoria) : E.dados(REPOSO, "pz-d3-inerte"));
  const botonAccion = (b, extra) => `<button type="button" class="pz-boton${b.principal ? " pz-boton-principal" : ""}${extra ? " " + extra : ""}" data-accion="${b.id}" aria-keyshortcuts="${b.tecla}">${esc(b.texto)}${b.sub ? `<span class="pz-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`;
  const montonDe = (n, nuevos) => A.monton(n, nuevos);
  const discosSolo = (premio, apuesta) => Math.round(3 + (Number(premio) / Math.max(1, Number(apuesta))) * 4);
  const firmado = n => (Number(n) > 0 ? "+" : Number(n) < 0 ? "−" : "") + V.num(Math.abs(Number(n)));

  // Las probabilidades, plegadas: a mano, pero fuera de la vista mientras juegas
  function detalleProbabilidades(cuerpo) {
    return `<details class="pz-prob"><summary>Probabilidades</summary><div class="pz-prob-cuerpo">${cuerpo}</div></details>`;
  }
  function probabilidadesMesa(est) {
    const r = est.reglas, filas = V.ORDEN_MEJOR_A_PEOR.map(c => {
      const efecto = est.modo === "compartido" ? (c === "ruina" ? "Eliminado: su apuesta se queda en el pozo" : c === "ceniza" ? "Su peso no cambia" : `Su peso sube ${V.pct((r.bonos || {})[c] || 0)} de la apuesta`) : V.CATEGORIAS[c].corta;
      return `<tr><th scope="row">${V.nombreCategoria(c)}</th><td class="pz-num">${V.pct(V.CASOS[c] / 216)}</td><td>${esc(efecto)}</td></tr>`;
    }).join("");
    return detalleProbabilidades(`<table class="pz-tabla"><caption class="pz-sr">Probabilidad de cada combinación con tres dados</caption><thead><tr><th scope="col">Sale</th><th scope="col" class="pz-num">Probabilidad</th><th scope="col">${est.modo === "compartido" ? "Efecto" : "Qué es"}</th></tr></thead><tbody>${filas}</tbody></table>`);
  }

  // Un veredicto: la combinación con su nombre, su efecto y su tratamiento propio (el color y la barra salen de data-c)
  function mostrarVeredicto(el, ult, modo, bonos, quien) {
    const f = V.frasesTirada(ult, modo, bonos || {});
    if (!el || !f) return;
    el.dataset.c = ult.categoria;
    const n = el.querySelector(".pz-veredicto-nombre"), e = el.querySelector(".pz-veredicto-efecto"), q = el.querySelector(".pz-veredicto-quien");
    if (n) n.textContent = f.nombre;
    if (e) e.textContent = f.dados + " · " + f.efecto;
    if (q && quien != null) q.textContent = quien;
    el.classList.remove("revela"); void el.offsetWidth; el.classList.add("revela");
  }
  const veredictoHtml = (ult, modo, bonos, quien) => {
    const f = ult ? V.frasesTirada(ult, modo, bonos || {}) : null;
    return `<div class="pz-veredicto" data-c="${ult ? esc(ult.categoria) : ""}" data-veredicto>${quien != null ? `<p class="pz-veredicto-quien">${esc(quien)}</p>` : ""}<p class="pz-veredicto-nombre">${f ? esc(f.nombre) : "&nbsp;"}</p><p class="pz-veredicto-efecto">${f ? esc(f.dados + " · " + f.efecto) : ""}</p></div>`;
  };

  // La decisión: lo que cobras a un lado y lo que arriesgas al otro, para que seguir tirando se note
  function decisionHtml(botones, cobra, riesgo) {
    const cobrar = botones.find(b => b.id === "cobrar"), seguir = botones.find(b => b.id !== "cobrar");
    return `<div class="pz-decision">
      <div class="pz-opcion-dec" data-t="cobrar"><p class="pz-dec-etq">Cobrar ahora</p><p class="pz-dec-cifra">${cobra.cifra}</p><p class="pz-dec-texto">${cobra.texto}</p><div class="pz-dock-botones">${cobrar ? botonAccion(cobrar) : ""}</div></div>
      <div class="pz-opcion-dec" data-t="seguir"><p class="pz-dec-etq">Seguir tirando</p><p class="pz-dec-cifra">${riesgo.cifra}</p>${riesgo.sinMedidor ? "" : `<div class="pz-medidor" aria-hidden="true"><i style="width:${(V.P_RUINA * 100).toFixed(2)}%"></i></div>`}<p class="pz-dec-texto">${riesgo.texto}</p><div class="pz-dock-botones">${seguir ? botonAccion(seguir, "pz-boton-riesgo") : ""}</div></div>
    </div>`;
  }

  function filaDados(ult) { return cubos(ult); }
  const claseResultadoDuelo = (est, asiento) => {
    const r = (est.rondas || []).slice(-1)[0];
    return r && r.ganador === asiento ? "gano" : "";
  };
  function pintarDuelo(est) {
    const yo = V.jugadorYo(est), riv = V.rival(est);
    const lados = [yo, riv].filter(Boolean);
    const turno = est.turno || {};
    const histor = (est.rondas || []).map(h => {
      const resultado = h.ganador == null ? "empate" : (yo && h.ganador === yo.asiento ? "gano" : "perdio");
      return `<li data-r="${resultado}">Ronda ${h.ronda}: ${resultado === "gano" ? "ganas" : resultado === "perdio" ? "pierdes" : "empate"}</li>`;
    }).join("");
    const ladoHtml = j => {
      const puntos = Array.from({ length: est.reglas.victorias }, (_, i) => `<span class="pz-ronda-punto" data-g="${i < j.victorias ? 1 : 0}"></span>`).join("");
      return `<article class="pz-duelo-lado" data-yo="${j.yo ? 1 : 0}" data-turno="${turno.asiento === j.asiento ? 1 : 0}" data-asiento="${j.asiento}">
        <div class="pz-asiento-cab"><span class="pz-asiento-nombre">${esc(j.yo ? j.nombre + " (tú)" : j.nombre)}</span>${turno.asiento === j.asiento ? `<span class="pz-chip pz-turno-marca">Su turno</span>` : ""}</div>
        <div class="pz-rondas" aria-label="${j.victorias} de ${est.reglas.victorias} rondas ganadas">${puntos}</div>
        <div class="pz-bandeja-lado" data-dados-main="${j.asiento}">${cubos(j.ultima)}</div>
        ${veredictoHtml(j.ultima, "duelo", est.reglas.bonos, null).replace('class="pz-veredicto"', 'class="pz-veredicto pz-veredicto-lado"')}
        ${est.reglas.cartas > 0 ? listaCartas(j.oferta) : ""}
      </article>`;
    };
    const ultimaRonda = (est.rondas || []).slice(-1)[0];
    return `<div class="pz-duelo">${lados[0] ? ladoHtml(lados[0]) : ""}
      <div class="pz-duelo-centro">
        <p class="pz-duelo-ronda">Ronda ${est.ronda} de ${est.reglas.rondas_max}</p>
        <div class="pz-pozo-fila">${montonDe(est.reglas.dinero > 0 ? 8 : 2)}</div>
        <p class="pz-pozo-cifra" data-pozo>${V.num(est.pozo.dinero)}</p>
        <p class="pz-pozo-sub">${est.reglas.cartas > 0 ? `+ ${V.plural(est.reglas.cartas * 2, "carta", "cartas")} en juego` : "tokens en juego"}</p>
        ${ultimaRonda ? `<p class="pz-pozo-sub">${ultimaRonda.ganador == null ? "La última ronda empató" : ultimaRonda.ganador === (yo && yo.asiento) ? "Ganaste la última ronda" : "Perdiste la última ronda"}</p>` : ""}
      </div>${lados[1] ? ladoHtml(lados[1]) : ""}</div>
      ${histor ? `<ul class="pz-historial" aria-label="Rondas jugadas">${histor}</ul>` : ""}`;
  }
  function pintarCompartido(est) {
    const turno = est.turno || {}, r = est.reglas;
    const ult = est.jugadores.filter(j => j.ultima).sort((a, b) => b.ultima.id - a.ultima.id)[0] || null;
    const maxPeso = Math.max(1, ...est.jugadores.map(j => Number(j.peso) || 0));
    const quien = ult ? (ult.yo ? "Tu tirada" : `Tirada de ${ult.nombre}`) + (ult.ultima.auto ? " (automática)" : "") : "Todavía nadie ha tirado";
    return `<div class="pz-pozo"><div class="pz-pozo-fila">${montonDe(Math.round(2 + est.pozo.dinero / Math.max(1, r.dinero) * 1.2))}
        <div><p class="pz-pozo-etq">El pozo</p><p class="pz-pozo-cifra" data-pozo>${V.num(est.pozo.dinero)}</p></div></div>
        <p class="pz-pozo-sub">${r.dinero > 0 ? "tokens de juego" : "solo cartas"}${r.cartas > 0 ? ` · ${V.plural(r.cartas * est.jugadores.length, "carta", "cartas")} en juego` : ""} · se reparte por peso entre quienes no caigan en Ruina</p></div>
      <div class="pz-bandeja" data-dados-main="${ult ? ult.asiento : ""}" aria-label="Última tirada">${cubos(ult ? ult.ultima : null)}</div>
      ${veredictoHtml(ult ? ult.ultima : null, "compartido", r.bonos, quien)}
      <div class="pz-jugadores">${est.jugadores.map(j => `
        <article class="pz-jugador" data-e="${esc(j.estado)}" data-turno="${turno.asiento === j.asiento && est.estado === "jugando" ? 1 : 0}" data-asiento="${j.asiento}">
          <div class="pz-asiento-cab"><span class="pz-asiento-nombre">${esc(j.yo ? j.nombre + " (tú)" : j.nombre)}</span><span class="pz-chip${turno.asiento === j.asiento && est.estado === "jugando" ? " pz-turno-marca" : ""}" data-e="${esc(j.estado)}">${turno.asiento === j.asiento && est.estado === "jugando" ? "Su turno" : esc(V.estadoJugador(j))}</span></div>
          <div class="pz-jugador-datos"><span>Tiradas <strong>${j.tiradas}/${r.tiradas_max}</strong></span><span>Peso <strong>${V.pct(j.peso)}</strong></span></div>
          <div class="pz-peso" aria-hidden="true"><i style="width:${Math.round((Number(j.peso) || 0) / maxPeso * 100)}%"></i></div>
          <div class="pz-jugador-datos"><span>${j.estado === "ruina" ? "Eliminado" : "Su parte hoy"}</span><strong data-parte="${j.asiento}">${j.parte != null ? V.num(j.parte) : "—"}</strong></div>
          <div class="pz-jugador-dados">${j.ultima ? j.ultima.dados.map(v => A.dado(v, "pz-mini")).join("") + `<small>${esc(V.nombreCategoria(j.ultima.categoria))}</small>` : ""}</div>
          ${r.cartas > 0 ? listaCartas(j.oferta) : ""}
        </article>`).join("")}</div>`;
  }
  function pintarDockMesa(est, op) {
    const plan = V.acciones(est), yo = V.jugadorYo(est), t = est.turno || {};
    if (op && op.observa) return `<p class="pz-observa" role="status">El Dragón observa los dados…</p>`;
    if (plan.tipo === "espera") {
      const j = V.jugadorEn(est, t.asiento);
      return `<p class="pz-espera-turno" role="status">Le toca a <strong>${esc(j ? j.nombre : "otro jugador")}</strong> <span class="pz-reloj" data-reloj></span></p>${yo && yo.estado !== "activo" ? `<p class="pz-espera-turno">${yo.estado === "ruina" ? "Has caído en Ruina. Sigue la partida desde aquí." : yo.estado === "retirado" ? "Ya has cobrado: tu peso queda fijo hasta que acabe la mesa." : ""}</p>` : ""}`;
    }
    const tc = V.tensionCompartido(est);
    if (plan.tipo === "decidir" && tc) {
      const cobra = { cifra: tc.parte != null ? V.num(tc.parte) : "—", texto: `Si cobras y todos los demás también, recibirías <strong>${tc.parte != null ? V.num(tc.parte) : "—"}</strong> tokens (apostaste ${V.num(tc.apuesta)}). Tu peso queda fijo en <strong>${V.pct(tc.peso)}</strong>.` };
      const riesgo = { cifra: `${V.pct(tc.pRuina)} de Ruina`, texto: `Si sale Ruina quedas eliminado y tu apuesta se queda en el pozo. ${tc.quedan > 0 ? `Te quedan ${V.plural(tc.quedan, "tirada", "tiradas")}` : "Era tu última tirada"}.` };
      return `${decisionHtml(plan.botones, cobra, riesgo)}<p class="pz-ayuda pz-centrado">Tiempo: <span class="pz-reloj" data-reloj></span></p>`;
    }
    return `<p class="pz-dock-texto">Tu turno. Tiempo: <span class="pz-reloj" data-reloj></span></p><div class="pz-dock-botones">${plan.botones.map(b => botonAccion(b)).join("")}</div>`;
  }
  function pintarFin(est) {
    const r = V.resumenFinal(est);
    if (!r) return "";
    const js = (est.resultado && est.resultado.jugadores) || [];
    const liq = js.map(x => { const j = V.jugadorEn(est, x.asiento); return j ? `<li><span>${esc(j.yo ? "Tú" : j.nombre)}</span><span>${Number(x.neto) > 0 ? "+" : ""}${V.num(x.neto)} tokens${(x.cartas_ganadas || []).length ? ` · +${V.plural(x.cartas_ganadas.length, "carta", "cartas")}` : ""}${(x.cartas_perdidas || []).length ? ` · −${V.plural(x.cartas_perdidas.length, "carta", "cartas")}` : ""}</span></li>` : ""; }).join("");
    return `<section class="pz-fin" data-c="${r.clase}"><h2>${esc(r.titulo)}</h2><p>${esc(r.texto)}</p>${liq ? `<ul class="pz-liquidacion" aria-label="Liquidación">${liq}</ul>` : ""}
      <div class="pz-acciones"><button type="button" class="pz-boton pz-boton-principal" data-cerrar-mesa id="pzDock" tabindex="-1">Volver a las mesas</button></div></section>`;
  }
  const dragonMesaHtml = () => `<div class="pz-vigia" id="pzVigia" aria-hidden="true">${A.dragonCara()}</div>`;
  function pintarMesa(est, op) {
    const fin = est.estado !== "jugando";
    const tapete = est.modo === "duelo" ? pintarDuelo(est) : pintarCompartido(est);
    $("pzMesa").innerHTML = `
      <div class="pz-barra">
        <div><span class="pz-codigo">${esc(est.codigo)}</span></div>
        <div class="pz-barra-sub">${est.modo === "duelo" ? "Duelo de Dragones" : "El Pozo Compartido"} · apuesta ${esc(V.textoApuesta(est.reglas))}</div>
        ${fin ? "" : `<button type="button" class="pz-boton-mini" data-salir>${est.modo === "duelo" ? "Abandonar el duelo" : "Retirarme de la mesa"}</button>`}
      </div>
      <div class="pz-mesa"><div class="pz-tapete" id="pzTapete"><div class="pz-destello" id="pzDestello" aria-hidden="true"></div>${dragonMesaHtml()}${tapete}</div>
        ${fin ? pintarFin(est) : `<section class="pz-dock" id="pzDock" tabindex="-1" aria-label="Controles de la mesa">${pintarDockMesa(est, op)}</section>`}
        ${probabilidadesMesa(est)}</div>`;
  }

  /* ---------------------------------------------------------------- el dragón de la mesa y los efectos de cada combinación */
  // El dragón reacciona a lo que pasa: se estrecha cuando te toca, se enciende con una Ruina o un premio, cierra los ojos al cobrar
  function marcoVigia() { const v = $("pzVigia"); return v ? v.querySelector(".pz-dragon-marco") : null; }
  function vigiaEstado(e) { S.vigiaBase = e; const m = marcoVigia(); if (m) m.dataset.e = e; }
  function vigiaReaccion(e, ms) {
    const m = marcoVigia(); if (!m) return;
    m.dataset.e = e;
    setTimeout(() => { const n = marcoVigia(); if (n === m && m.dataset.e === e) m.dataset.e = S.vigiaBase || "espera"; }, ms);
  }
  // El humo de las fosas del dragón (al perder): bocanadas que suben y se deshacen. Se colocan según el encuadre del dibujo (data-vb).
  const FOSAS = [[371, 300], [429, 300]];
  function humoDeFosas(marco) {
    if (!marco || sinMovimiento()) return;
    const vb = (marco.dataset.vb || "0 0 800 460").split(" ").map(Number);
    for (const [x, y] of FOSAS) {
      for (let i = 0; i < 3; i++) {
        const p = document.createElement("span");
        p.className = "pz-bocanada"; p.setAttribute("aria-hidden", "true");
        p.style.left = ((x - vb[0]) / vb[2] * 100).toFixed(2) + "%"; p.style.top = ((y - vb[1]) / vb[3] * 100).toFixed(2) + "%";
        p.style.animationDelay = (i * 0.28 + Math.random() * 0.12).toFixed(2) + "s"; p.style.setProperty("--dx", ((Math.random() - 0.5) * 36).toFixed(0) + "%");
        marco.appendChild(p); setTimeout(() => p.remove(), 2800);
      }
    }
  }
  // La viñeta: oscurece los bordes de golpe al perder, ilumina un poco el centro al ganar
  function vineta(tipo) {
    if (sinMovimiento()) return;
    const el = $(tipo === "perdio" ? "pzVineta" : "pzVinetaLuz"); if (!el) return;
    el.classList.remove("activa"); void el.offsetWidth; el.classList.add("activa");
  }
  function efectosDeCategoria(c, soyYo) {
    const tapete = $("pzTapete");
    if (c === "ruina") {
      vigiaReaccion("ruina", 2000);
      document.body.classList.add("pz-ruina"); setTimeout(() => document.body.classList.remove("pz-ruina"), 1200);
      if (tapete && !sinMovimiento()) { tapete.classList.add("pz-sacude"); setTimeout(() => tapete.classList.remove("pz-sacude"), 600); }
      humoDeFosas(marcoVigia()); vineta("perdio");
      sonar("ruina"); sonar("grunido");
    } else if (c === "triple_seis") {
      vigiaReaccion("gran", 2600);
      const d = $("pzDestello"); if (d && !sinMovimiento()) { d.classList.add("activo"); setTimeout(() => d.classList.remove("activo"), 1000); }
      if (tapete && !sinMovimiento()) { tapete.classList.add("pz-sacude"); setTimeout(() => tapete.classList.remove("pz-sacude"), 600); }
      vineta("gano"); Brasas.estallido(60); sonar("grande");
    } else if (c === "triple") { vigiaReaccion("premio", 1800); vineta("gano"); Brasas.estallido(24); sonar("premio"); }
    else if (c === "escalera") { vigiaReaccion("premio", 1400); sonar("moneda"); }
    else if (c === "pareja") { vigiaReaccion("premio", 900); sonar("moneda"); }
  }
  // Pone la tirada en su sitio ya lanzada: tiñe los dados, enseña la combinación y suelta los efectos
  function revelarTirada(cont, ult, veredicto, modo, bonos, quien, soyYo) {
    if (cont) cont.querySelectorAll(".pz-d3").forEach(d => { d.className = "pz-d3 cat-" + ult.categoria; });
    mostrarVeredicto(veredicto, ult, modo, bonos, quien);
    efectosDeCategoria(ult.categoria, soyYo);
  }
  // Mientras los dados ruedan, el veredicto de la tirada anterior se apaga
  function apagarVeredicto(el) {
    if (!el) return;
    el.dataset.c = ""; el.classList.remove("revela");
    const n = el.querySelector(".pz-veredicto-nombre"), e = el.querySelector(".pz-veredicto-efecto");
    if (n) n.innerHTML = "&nbsp;"; if (e) e.textContent = "";
  }
  // Un número que flota junto al contador: lo que acabas de ganar o de perder
  function numeroFlota(cifra, delta) {
    const padre = cifra && cifra.parentElement; if (!padre || sinMovimiento() || !delta) return;
    const el = document.createElement("span");
    el.className = "pz-delta " + (delta > 0 ? "sube" : "baja"); el.textContent = firmado(delta); el.setAttribute("aria-hidden", "true");
    padre.appendChild(el); setTimeout(() => el.remove(), 1500);
  }

  /* ---------------------------------------------------------------- la secuencia de cada tirada:
     decisión (ya hecha) → lanzamiento → revelación → resolución → elección.
     El servidor ya decidió el resultado: aquí solo se enseña. Se puede saltar (clic, espacio, Intro o Escape) y acelerar (botón «Rápido»). */
  const puedeTeatro = () => !S.primerPintado && !document.hidden && !sinMovimiento();
  async function teatro(paso) {
    S.teatro = true; E.nueva();
    const tap = $("pzTapete");
    if (tap) { tap.dataset.teatro = "1"; tap.insertAdjacentHTML("beforeend", `<p class="pz-pista-saltar" aria-hidden="true">Toca para saltar</p>`); }
    const guarda = setTimeout(() => E.saltar(), 9000);     // si algo se atasca, la escena se salta sola
    try { await paso(); } catch (e) { /* una escena rota no debe dejar la mesa colgada: se pinta el cuadro final igualmente */ }
    finally {
      clearTimeout(guarda); S.teatro = false;
      const t2 = $("pzTapete"); if (t2) { t2.removeAttribute("data-teatro"); const p = t2.querySelector(".pz-pista-saltar"); if (p) p.remove(); }
      const c = S.cola; S.cola = null; if (c) c();
    }
  }
  const saltarEscena = () => { if (S.teatro) E.saltar(); };

  // Las tiradas que el servidor ha hecho desde la última vez que se enseñó algo, de la más antigua a la más nueva
  function tiradasNuevas(est) {
    const out = [];
    for (const j of est.jugadores) if (j.ultima && j.ultima.id > (S.vistoTirada[j.asiento] || 0)) out.push({ j, ult: j.ultima });
    return out.sort((a, b) => a.ult.id - b.ult.id);
  }
  function marcarVistas(est) { for (const j of est.jugadores) if (j.ultima) S.vistoTirada[j.asiento] = Math.max(S.vistoTirada[j.asiento] || 0, j.ultima.id); }

  // Al terminar una mesa: el oro vuela al saldo si hay premio y es devorado por el dragón si se pierde
  async function liquidacionVisual(est) {
    const r = V.resumenFinal(est); if (!r) return;
    const fila = document.querySelector("#pzMesa .pz-pozo-fila"), caja = $("pzSaldo") && $("pzSaldo").closest(".pz-saldo"), nuevo = est.yo && est.yo.saldo != null ? Number(est.yo.saldo) : null;
    if (r.clase === "pierde") {
      vigiaEstado("ruina"); sonar("pierde"); sonar("grunido"); humoDeFosas(marcoVigia()); vineta("perdio");
      await Promise.all([E.devorar(fila), E.volar(fila, $("pzVigia"), 8, { clase: "roja", apaga: true })]);
    } else {
      vigiaEstado("cobro"); sonar(r.clase === "gana" ? "premio" : "moneda"); if (r.clase === "gana") vineta("gano");
      await E.volar(fila, caja, 12);
      if (nuevo != null) { await E.contar($("pzSaldo"), saldoActualVisible(), nuevo, 800, V.num); E.pulso(caja, "pz-recibe"); }
    }
  }
  const saldoActualVisible = () => (Number.isFinite(S.saldo) ? S.saldo : 0);

  async function teatroMesa(est, antes, nuevas) {
    pintarMesa(antes, { observa: true }); vigiaEstado("mira"); pintarReloj();
    await teatro(async () => {
      for (const { j, ult } of nuevas) {
        const cont = est.modo === "duelo" ? document.querySelector(`[data-dados-main="${j.asiento}"]`) : document.querySelector("#pzMesa .pz-bandeja");
        if (!cont) continue;
        cont.querySelectorAll(".pz-d3").forEach(d => { d.className = "pz-d3"; });
        const ved = est.modo === "duelo" ? cont.closest(".pz-duelo-lado").querySelector(".pz-veredicto") : document.querySelector("#pzMesa .pz-veredicto");
        apagarVeredicto(ved);
        await E.lanzar(cont, ult.dados, { alEmpezar: () => sonar("dados"), alCaer: () => sonar("cae") });
        await E.esperar(120);
        revelarTirada(cont, ult, ved, est.modo, est.reglas.bonos, est.modo === "duelo" ? null : (j.yo ? "Tu tirada" : `Tirada de ${j.nombre}`) + (ult.auto ? " (automática)" : ""), j.yo);
        if (est.estado !== "jugando") S.vigiaBase = "espera";
        await E.esperar(700);
      }
      // el cuadro final: lo que dice el servidor ahora
      S.est = est; S.version = est.version;
      pintarMesa(est); pintarReloj();
      const finDeMesa = est.estado !== "jugando";
      if (est.yo && est.yo.saldo != null && !finDeMesa) pintarSaldo(est.yo.saldo);
      vigiaEstado(!finDeMesa && est.yo && est.yo.tu_turno ? "mira" : "espera");
      for (const j of est.jugadores) {
        const antesJ = antes.jugadores.find(x => x.asiento === j.asiento), el = document.querySelector(`[data-parte="${j.asiento}"]`);
        if (el && antesJ && antesJ.parte != null && j.parte != null && Number(antesJ.parte) !== Number(j.parte)) { E.contar(el, Number(antesJ.parte), Number(j.parte), 700, V.num); E.pulso(el, "pz-pozo-cambia"); }
      }
      if (finDeMesa) { await E.esperar(300); await liquidacionVisual(est); if (est.yo && est.yo.saldo != null) pintarSaldo(est.yo.saldo); vigiaEstado("espera"); }
      despuesDePintar(est, antes, true);
    });
  }

  /* ---------------------------------------------------------------- modo solitario: tú contra el Dragón */
  function reglasSoloVigentes() { return (S.solo && S.solo.reglas) || (S.lista && S.lista.solo) || S.reglasSolo || {}; }

  function formSolo() {
    const r = reglasSoloVigentes(), aj = (S.lista && S.lista.ajustes) || { apuesta_min: 10, apuesta_paso: 10 };
    const b = r.bonos || { pareja: 0.0625, escalera: 0.1875, triple: 0.375, triple_seis: 1 }, t = r.tributo != null ? r.tributo : 5;
    return `<form class="pz-form" data-form-solo novalidate>
        <label class="pz-campo"><span>Apuesta de dinero</span><input type="number" data-f="dinero" min="0" step="${aj.apuesta_paso}" value="${aj.apuesta_min}" inputmode="numeric"></label>
        <p class="pz-ayuda" data-resumen-solo></p>
        <p class="pz-ayuda">Bonos por tirada: pareja +${V.num(b.pareja * 100)} %, escalera +${V.num(b.escalera * 100)} %, triple +${V.num(b.triple * 100)} %, triple seis +${V.num(b.triple_seis * 100)} %. Tributo del Dragón: ${V.num(t)} %, sin otras comisiones.</p>
        <button type="submit" class="pz-boton pz-boton-principal">Jugar en solitario</button>
      </form>`;
  }
  function actualizarResumenSolo(f) {
    const el = f.querySelector("[data-resumen-solo]"); if (!el) return;
    const r = reglasSoloVigentes(), t = r.tributo != null ? r.tributo : 5, d = Number(f.querySelector('[data-f="dinero"]').value) || 0, max = r.tiradas_max || 5;
    el.innerHTML = d <= 0 ? "Hay que apostar dinero." : `Premio inicial <strong>${V.num(V.premioSolo(d, t, 0))}</strong> · Ruina <strong>${V.pct(10 / 216)}</strong> en las primeras ${max} tiradas · tributo del Dragón ${V.num(t)} %`;
    f.querySelectorAll("[data-ficha]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.ficha) === d)));
  }

  // El panel plegable del solitario: la tabla de lo que pasaría con la siguiente tirada, con el bono de cada combinación y el premio que dejaría
  function probabilidadesSolo(s) {
    const tb = V.tablaSolo(s); if (!tb || s.tiradas >= s.tiradas_max) return "";
    const quedan = s.tiradas_max - s.tiradas;
    const filas = tb.filas.map(f => `<tr><th scope="row">${f.nombre}</th><td class="pz-num">${V.pct(f.p)}</td><td class="pz-num">${f.cat === "ruina" ? "pierdes todo" : f.bono > 0 ? "+" + V.pct(f.bono) : "—"}</td><td class="pz-num">${f.cat === "ruina" ? "0" : V.num(f.premio)}</td></tr>`).join("");
    return detalleProbabilidades(`<table class="pz-tabla pz-perspectiva"><caption>${s.estado === "en_curso" && s.tiradas > 0 ? `Si sigues tirando (te quedan ${V.plural(quedan, "tirada", "tiradas")}). ` : "Con cada tirada. "}Tu premio ahora: <strong>${V.num(tb.premio)}</strong>.</caption>
      <thead><tr><th scope="col">Sale</th><th scope="col" class="pz-num">Probabilidad</th><th scope="col" class="pz-num">Bono</th><th scope="col" class="pz-num">Premio resultante</th></tr></thead><tbody>${filas}</tbody></table>
      <p class="pz-ayuda">El premio base es <strong>${V.num(tb.base)}</strong> (tu apuesta menos el tributo del ${V.num(tb.tributo)} %). Cada bono es un porcentaje de ese base y se acumula tirada a tirada. La ceniza deja el premio como está y la Ruina lo pierde todo.</p>`);
  }
  const ultimaSolo = s => (s && s.historial && s.historial.length ? s.historial[s.historial.length - 1] : null);

  function decisionSoloHtml(s, plan) {
    const t = V.tensionSolo(s); if (!t) return "";
    if (s.fase === "decidir") {
      const cobra = { cifra: V.num(t.premio), texto: `Es tuyo ahora: se suma a tu saldo y la partida termina. Apostaste ${V.num(t.apuesta)}, así que ${t.premio >= t.apuesta ? `ganas <strong>${V.num(t.premio - t.apuesta)}</strong>` : `pierdes <strong>${V.num(t.apuesta - t.premio)}</strong>`}.` };
      const riesgo = t.fuera ? { cifra: "El Dragón no avisa", sinMedidor: true, texto: `Si te alcanza, pierdes <strong>${V.num(t.premio)}</strong>. Con un triple seis tu premio subiría a <strong>${V.num(t.mejor)}</strong>.` }
        : { cifra: `${V.pct(t.pRuina)} de Ruina`, texto: `Si sale, pierdes <strong>${V.num(t.premio)}</strong>. Con un triple seis tu premio subiría a <strong>${V.num(t.mejor)}</strong>. Te quedan ${V.plural(t.quedan, "tirada", "tiradas")}.` };
      return `${decisionHtml(plan.botones, cobra, riesgo)}<p class="pz-ayuda pz-centrado">Si te vas, la partida se cierra sola en <span class="pz-reloj" data-reloj></span> y cobras lo que lleves.</p>`;
    }
    return `<p class="pz-dock-texto">Apuestas <strong>${V.num(t.apuesta)}</strong> tokens. Primera tirada: <strong>${V.pct(t.pRuina)}</strong> de Ruina y lo pierdes. Si te vas, la partida se cierra sola en <span class="pz-reloj" data-reloj></span> y se te devuelve la apuesta.</p>
      <div class="pz-dock-botones">${plan.botones.map(b => botonAccion(b)).join("")}</div>`;
  }

  // «Tirada 3 de 5»; más allá de las cinco seguras, solo «Tirada 6»
  const etiquetaTirada = s => (s.tiradas > s.tiradas_max ? `Tirada ${s.tiradas}` : `Tirada ${s.tiradas} de ${s.tiradas_max}`);
  function pintarSolo(s, op) {
    const fin = s.estado === "terminada", r = V.resumenSolo(s), plan = V.accionesSolo(s);
    const ult = ultimaSolo(s);
    const puntos = Array.from({ length: Math.max(s.tiradas_max, s.tiradas) }, (_, i) => `<span class="pz-ronda-punto" data-g="${i < s.tiradas ? 1 : 0}"></span>`).join("");
    const dock = fin ? `<section class="pz-fin" data-c="${r.clase}"><h2>${esc(r.titulo)}</h2><p>${esc(r.texto)}</p>
        <div class="pz-acciones"><button type="button" class="pz-boton pz-boton-principal" data-solo-nueva id="pzDock" tabindex="-1">Jugar otra vez</button><button type="button" class="pz-boton" data-solo-lobby>Volver a las mesas</button></div></section>`
      : `<section class="pz-dock" id="pzDock" tabindex="-1" aria-label="Controles de la partida">${op && op.observa ? `<p class="pz-observa" role="status">El Dragón observa los dados…</p>` : decisionSoloHtml(s, plan)}</section>`;
    const premio = fin ? s.pago : s.premio;
    $("pzSolo").innerHTML = `
      <div class="pz-barra"><div><span class="pz-codigo">Solo</span></div><div class="pz-barra-sub">Tú contra el Dragón · apuesta ${V.num(s.apuesta)} tokens de juego</div></div>
      <div class="pz-mesa"><div class="pz-tapete" id="pzTapete"><div class="pz-destello" id="pzDestello" aria-hidden="true"></div>${dragonMesaHtml()}
        <div class="pz-pozo"><div class="pz-tesoro"><div class="pz-pozo-fila">${montonDe(discosSolo(premio, s.apuesta))}</div><div class="pz-tesoro-datos"><p class="pz-pozo-etq">${fin ? "Premio cobrado" : "Tu premio provisional"}</p><p class="pz-pozo-cifra" data-pozo>${V.num(premio)}</p></div></div>
          <p class="pz-pozo-sub">apuesta ${V.num(s.apuesta)} · el Dragón retiene un ${V.num(s.tributo)} % (premio base ${V.num(s.base)}) · ${V.pct(s.bono)} de bonos acumulados</p></div>
        <div class="pz-bandeja" data-dados-solo aria-label="Última tirada">${cubos(ult)}</div>
        ${veredictoHtml(ult ? { dados: ult.dados, categoria: ult.categoria } : null, "solo", s.bonos, ult ? etiquetaTirada(s) : "Todavía no has tirado")}
        <div class="pz-rondas" aria-label="${s.tiradas} tiradas">${puntos}</div>
      </div>${dock}${fin ? "" : probabilidadesSolo(s)}</div>`;
  }

  // El premio cambia tras la tirada: sube con monedas que caen, se queda quieto con una ceniza o se consume con una Ruina
  async function resolverPremioSolo(s, antes, ult) {
    const fila = document.querySelector("#pzSolo .pz-pozo-fila"), cifra = document.querySelector("#pzSolo [data-pozo]");
    const p0 = Number(antes.premio), p1 = ult.categoria === "ruina" ? 0 : Number(s.estado === "terminada" ? s.pago : s.premio);
    if (ult.categoria === "ruina") {
      numeroFlota(cifra, -p0);
      await Promise.all([E.devorar(fila), E.volar(fila, $("pzVigia"), 8, { clase: "roja", apaga: true }), E.contar(cifra, p0, 0, 650, V.num)]);
    } else if (p1 > p0 + 1e-9) {
      numeroFlota(cifra, p1 - p0); sonar("moneda");
      E.actualizarMonton(fila, discosSolo(p1, s.apuesta));
      await E.contar(cifra, p0, p1, 700, V.num);
      E.pulso(cifra, "pz-pozo-cambia");
    }
  }
  // El cierre de una partida cobrada: el dragón cierra los ojos y el oro viaja al saldo
  async function cierreSolo(s, ult) {
    if (ult && ult.categoria === "ruina") return;
    const pago = Number(s.pago) || 0, caja = $("pzSaldo") && $("pzSaldo").closest(".pz-saldo");
    if (pago <= 0) return;
    vigiaEstado("cobro"); sonar("premio"); vineta("gano");
    await E.volar(document.querySelector("#pzSolo .pz-pozo-fila"), caja, 12);
    if (s.saldo != null) { await E.contar($("pzSaldo"), saldoActualVisible(), Number(s.saldo), 800, V.num); E.pulso(caja, "pz-recibe"); }
  }

  async function teatroSolo(s, antes, rodo, ult) {
    pintarSolo(antes, { observa: true }); vigiaEstado("mira"); pintarReloj();
    await teatro(async () => {
      if (rodo) {
        const cont = document.querySelector("[data-dados-solo]");
        cont.querySelectorAll(".pz-d3").forEach(d => { d.className = "pz-d3"; });
        apagarVeredicto(document.querySelector("#pzSolo .pz-veredicto"));
        await E.lanzar(cont, ult.dados, { alEmpezar: () => sonar("dados"), alCaer: () => sonar("cae") });
        await E.esperar(120);
        revelarTirada(cont, ult, document.querySelector("#pzSolo .pz-veredicto"), "solo", s.bonos, etiquetaTirada(s), true);
        if (s.estado === "terminada") S.vigiaBase = "espera";
        await E.esperar(560);
        await resolverPremioSolo(s, antes, ult);
        await E.esperar(380);
      }
      if (s.estado === "terminada") await cierreSolo(s, ult);
      // el cuadro final: lo que dice el servidor ahora
      S.solo = s;
      if (s.saldo != null) pintarSaldo(s.saldo);
      pintarSolo(s); pintarReloj(); vigiaEstado(s.estado === "en_curso" ? "mira" : "espera");
      finDeSolo(s, antes, true);
    });
  }
  function finDeSolo(s, antes, yaSono) {
    if (s.estado === "terminada" && (!antes || antes.estado !== "terminada")) cargarDesafios();
    const frase = V.anuncioSolo(antes, s); if (frase) leer(frase);
    if (!yaSono && s.estado === "terminada" && (!antes || antes.estado !== "terminada") && !S.primerPintado) { const r = V.resumenSolo(s); if (r) sonar(r.clase === "gana" ? "premio" : r.clase === "pierde" ? "pierde" : "moneda"); }
    S.primerPintado = false;
  }

  function aplicarSolo(s) {
    if (!s) return;
    if (S.teatro) { S.cola = () => aplicarSolo(s); return; }
    if (s.reglas) S.reglasSolo = s.reglas;
    if (s.sin_partida) {
      const habia = S.solo; S.solo = null;
      if (s.saldo != null) pintarSaldo(s.saldo);
      if (S.vista === "solo" || habia) irALobby();
      return;
    }
    const antes = S.solo, ult = ultimaSolo(s);
    const rodo = !!(ult && ult.id > (S.vistoSolo || 0)), cierra = s.estado === "terminada" && !!antes && antes.estado === "en_curso";
    if (ult) S.vistoSolo = Math.max(S.vistoSolo || 0, ult.id);
    S.solo = s; S.est = null;
    fijarLimite(s.restante_s);
    if (S.vista !== "solo") mostrar("solo");
    if (puedeTeatro() && antes && antes.estado === "en_curso" && (rodo || cierra)) { teatroSolo(s, antes, rodo, ult); return; }
    if (s.saldo != null) pintarSaldo(s.saldo);
    pintarSolo(s); pintarReloj(); vigiaEstado(s.estado === "en_curso" ? "mira" : "espera");
    finDeSolo(s, antes, false);
  }

  function empezarSolo(f, boton) {
    const dinero = Number(f.querySelector('[data-f="dinero"]').value) || 0;
    const marco = document.querySelector("#pzHeroe .pz-dragon-marco"); if (marco) marco.dataset.e = "mira";
    const cliente = window.VeintiunaApi.nuevoId();                    // el mismo identificador en cada reintento: la partida no se abre dos veces ni se cobra dos veces
    return ejecutar(() => api.pozo.solo.empezar(cliente, dinero), boton, aplicarSolo);
  }
  function hacerSolo(accion, boton) {
    const s = S.solo; if (!s || s.estado !== "en_curso" || S.teatro) return;
    const paso = s.paso, id = s.id;
    return ejecutar(() => (accion === "cobrar" ? api.pozo.solo.cobrar(id, paso) : api.pozo.solo.tirar(id, paso)), boton, aplicarSolo);
  }
  const cerrarSolo = () => ejecutar(() => api.pozo.solo.descartar(), null, aplicarSolo);

  /* ---------------------------------------------------------------- aplicar lo que dice el servidor */
  // Lo que se hace después de pintar una mesa: anuncio para lectores de pantalla, sonido de turno y de final
  function despuesDePintar(est, antes, yaSono) {
    const vista = V.vista(est);
    if (vista === "fin" && (!antes || V.vista(antes) !== "fin")) cargarDesafios();
    const frase = V.anuncio(antes, est);
    if (frase) leer(frase);
    if (est.turno && est.yo && est.yo.tu_turno && (!antes || !antes.turno || antes.turno.asiento !== est.turno.asiento || antes.turno.fase !== est.turno.fase) && !S.primerPintado) sonar("turno");
    if (!yaSono && vista === "fin" && (!antes || V.vista(antes) !== "fin") && !S.primerPintado) {
      const r = V.resumenFinal(est); if (r) sonar(r.clase === "gana" ? "premio" : r.clase === "pierde" ? "pierde" : "moneda");
    }
    S.primerPintado = false;
  }
  function aplicar(est) {
    if (!est) return;
    if (S.teatro) { S.cola = () => aplicar(est); return; }
    if (est.sin_mesa) {
      const antes = S.est; S.est = null; S.version = null;
      if (est.saldo != null) pintarSaldo(est.saldo);
      if (S.vista !== "lobby") irALobby();
      else if (antes) irALobby();
      return;
    }
    const antes = S.est, vista = V.vista(est);
    const nuevas = vista !== "sala" ? tiradasNuevas(est) : [];
    const teatral = puedeTeatro() && !!antes && antes.codigo === est.codigo && antes.estado === "jugando" && vista !== "sala" && (nuevas.length > 0 || est.estado !== "jugando");
    marcarVistas(est);
    S.est = est; S.version = est.version;
    fijarLimite(est.turno ? est.turno.restante_s : est.restante_s);
    if (S.vista !== vista) { mostrar(vista); }
    if (teatral) { teatroMesa(est, antes, nuevas); return; }
    if (est.yo && est.yo.saldo != null) pintarSaldo(est.yo.saldo);
    if (vista === "sala") pintarSala(est);
    else { pintarMesa(est); vigiaEstado(est.estado === "jugando" && est.yo && est.yo.tu_turno ? "mira" : "espera"); }
    pintarReloj();
    despuesDePintar(est, antes, false);
  }

  /* ---------------------------------------------------------------- hablar con el servidor */
  function manejarError(e, reintento) {
    if (e && e.tipo === "servidor" && e.codigo === "oculto") { mostrar("oculto"); return; }
    aviso(V.mensajeError(e), { tipo: "error", reintentar: !!reintento && (!e || e.tipo === "red"), cerrar: true });
    S.reintento = reintento || null;
  }
  async function ejecutar(fn, boton, cuando) {
    if (S.ocupado) return;
    S.ocupado = true; if (boton) boton.classList.add("pz-esperando");
    try {
      const r = await fn();
      aviso(""); S.reintento = null;
      if (r) (cuando || aplicar)(r);
    } catch (e) {
      manejarError(e, () => ejecutar(fn, null, cuando));
      if (e && e.tipo === "servidor" && (e.codigo === "paso_futuro" || e.codigo === "condiciones_cambiadas")) refrescar();
      if (e && e.tipo === "servidor" && e.codigo === "solo_en_curso") refrescar();
    } finally { S.ocupado = false; if (boton) boton.classList.remove("pz-esperando"); }
  }
  async function refrescar() {
    try {
      const m = await api.pozo.estado(null);
      if (m && !m.sin_mesa) { aplicar(m); return; }
      const s = await api.pozo.solo.estado();
      if (s && !s.sin_partida) aplicarSolo(s); else if (m) aplicar(m);
    } catch (e) { /* el sondeo reintenta */ }
  }

  function irALobby() {
    mostrar("lobby");
    pintarLobby();
    cargarLista();
    clearTimeout(S.sondeo);
    programarLista();
  }
  async function cargarLista() {
    try {
      const l = await api.pozo.lista();
      S.lista = l;
      if (l && l.saldo != null) pintarSaldo(l.saldo);
      if (S.vista === "lobby") { if (!S.lobbyArmado) pintarLobby(); else pintarMesasLista(); }
    } catch (e) { manejarError(e, cargarLista); }
  }
  function programarLista() { clearTimeout(S.timerLista); S.timerLista = setTimeout(async () => { if (S.vista === "lobby") { await cargarLista(); programarLista(); } }, LISTA_MS); }
  function programar(ms) { clearTimeout(S.sondeo); S.sondeo = setTimeout(sondear, ms); }
  async function sondear() {
    if (!S.sesion) return;
    if (S.vista === "solo") {
      try { const r = await api.pozo.solo.estado(); if (r.sin_partida || !S.solo || r.paso !== S.solo.paso || r.estado !== S.solo.estado) aplicarSolo(r); else { fijarLimite(r.restante_s); pintarReloj(); } } catch (e) { /* se reintenta */ }
      programar(SONDEO_FONDO_MS); return;
    }
    try {
      const r = await api.pozo.estado(S.version);
      if (r && r.sin_cambios) { if (r.restante_s !== undefined) fijarLimite(r.restante_s); pintarReloj(); }
      else aplicar(r);
      if (S.vista === "sin_conexion") { mostrar(S.est ? V.vista(S.est) : "lobby"); }
    } catch (e) {
      if (e && e.tipo === "servidor" && e.codigo === "oculto") { mostrar("oculto"); return; }
      if (e && e.tipo === "red") aviso("Sin conexión con la mesa. Reintentando...", { tipo: "info" });
    }
    if (S.vista === "lobby") { programar(SONDEO_MS * 2); } else programar(document.hidden ? SONDEO_FONDO_MS : SONDEO_MS);
  }

  const crear = (modo, boton) => { const v = leerForm(modo); return ejecutar(() => api.pozo.crear(modo, v.privada, v.nombre, v.dinero, v.cartas, v.max), boton); };
  const unirse = (codigo, boton) => ejecutar(() => api.pozo.unirse(codigo), boton);
  async function salir() {
    const est = S.est; if (!est) return;
    const enJuego = est.estado === "jugando";
    const texto = !enJuego ? "¿Salir de la mesa? Lo que hubieras reservado se te devuelve." : est.modo === "duelo" ? "Abandonar un duelo en marcha cuenta como derrota: pierdes tu apuesta. ¿Seguro?" : "Retirarte ahora te deja con el peso que lleves (o fuera del reparto si todavía no habías tirado). ¿Seguro?";
    const ok = window.dialogo && window.dialogo.confirmar ? await window.dialogo.confirmar(texto, { titulo: "Salir de la mesa", aceptar: "Salir", peligro: enJuego }) : window.confirm(texto);
    if (!ok) return;
    ejecutar(async () => { const r = await api.pozo.salir(); S.est = null; S.version = null; return r; });
  }
  async function cerrarMesaTerminada() { await ejecutar(async () => { const r = await api.pozo.salir(); S.est = null; S.version = null; return r; }); }
  function hacer(accion, boton) {
    if (S.teatro) return;
    if (S.vista === "solo") return hacerSolo(accion, boton);
    const est = S.est; if (!est || est.estado !== "jugando") return;
    const paso = est.paso;
    const fn = { tirar: () => api.pozo.tirar(paso), cobrar: () => api.pozo.cobrar(paso), continuar: () => api.pozo.continuar(paso) }[accion];
    if (fn) ejecutar(fn, boton);
  }

  /* ---------------------------------------------------------------- elegir cartas */
  async function abrirCartas() {
    const est = S.est; if (!est) return;
    abrir($("pzDlgCartas"), `${cabeceraDlg("pzDlgCartasT", "Tus cartas para esta mesa")}<div class="pz-dlg-cuerpo"><p>Buscando tus cartas...</p></div>`);
    let cartas;
    try { cartas = await api.pozo.misCartas(); } catch (e) { manejarError(e); $("pzDlgCartas").close(); return; }
    S.misCartas = cartas || [];
    const k = est.reglas.cartas, yo = V.jugadorYo(est);
    S.seleccion = (yo && yo.oferta ? yo.oferta.map(c => c.ejemplar) : []).filter(id => S.misCartas.some(c => c.ejemplar === id));
    pintarDialogoCartas(k);
  }
  function pintarDialogoCartas(k) {
    const sel = new Set(S.seleccion);
    const cuerpo = !S.misCartas.length ? `<p>No tienes cartas libres para apostar. Las que ya están en otra partida, mazo en juego o intercambio no aparecen aquí.</p>` : `
      <p>Elige exactamente <strong>${V.plural(k, "carta", "cartas")}</strong>. Si pierdes, pasan al ganador por el sistema oficial de cartas (si a quien las gane le sobrepasa un límite de su colección, vuelven a ti). Mientras dure la partida quedan bloqueadas. Ya has elegido ${sel.size} de ${k}.</p>
      <ul class="pz-cartas-lista" aria-label="Tus cartas libres">${S.misCartas.map(c => `<li><label class="pz-carta-opcion" data-sel="${sel.has(c.ejemplar) ? 1 : 0}"><input type="checkbox" data-carta="${esc(c.ejemplar)}" ${sel.has(c.ejemplar) ? "checked" : ""}><span>${esc(c.nombre || c.carta)}</span><small><span class="pz-rareza" data-r="${esc(c.rareza)}">${esc(rarezaDe(c))}</span>${c.numero != null ? ` · nº ${esc(c.numero)}` : ""}</small></label></li>`).join("")}</ul>
      <div class="pz-acciones"><button type="button" class="pz-boton pz-boton-principal" data-ofrecer ${sel.size === k ? "" : 'aria-disabled="true"'}>Ofrecer estas cartas</button></div>`;
    $("pzDlgCartas").innerHTML = `${cabeceraDlg("pzDlgCartasT", "Tus cartas para esta mesa")}<div class="pz-dlg-cuerpo">${cuerpo}</div>`;
    $("pzDlgCartas").querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", () => $("pzDlgCartas").close()));
  }
  async function ofrecerCartas(boton) {
    $("pzDlgCartas").close();
    await ejecutar(() => api.pozo.ofrecer(S.seleccion.slice()), boton);
  }

  /* ---------------------------------------------------------------- eventos */
  function alClic(ev) {
    if (S.teatro && ev.target.closest("#pzTapete")) { saltarEscena(); return; }
    const t = ev.target.closest("button, a");
    if (!t) return;
    const d = t.dataset;
    if ("reintentar" in d) { const f = S.reintento; aviso(""); if (f) f(); else sondear(); return; }
    if ("cerrarAviso" in d) { aviso(""); return; }
    if (d.abrirForm) { S.form.abierto = S.form.abierto === d.abrirForm ? null : d.abrirForm; document.querySelectorAll("[data-form]").forEach(f => { f.hidden = f.dataset.form !== S.form.abierto; }); const panel = $("pzPanelForm"); if (panel) panel.hidden = !S.form.abierto; const f = document.querySelector(`[data-form="${S.form.abierto}"]`); if (f) { const i = f.querySelector("input[type=text]"); if (i) i.focus({ preventScroll: true }); } return; }
    if ("fichaTodo" in d) {
      const f = t.closest("[data-form-solo]"), paso = Number((S.lista && S.lista.ajustes && S.lista.ajustes.apuesta_paso) || 10) || 10, todo = Math.floor(saldoActual() / paso) * paso;
      if (f && todo > 0) { f.querySelector('[data-f="dinero"]').value = todo; actualizarResumenSolo(f); }
      return;
    }
    if (d.ficha) { const f = t.closest("[data-form-solo]"); if (f) { f.querySelector('[data-f="dinero"]').value = d.ficha; actualizarResumenSolo(f); } return; }
    if (d.unirse) { unirse(d.unirse, t); return; }
    if ("salir" in d) { salir(); return; }
    if ("cerrarMesa" in d) { cerrarMesaTerminada(); return; }
    if ("soloNueva" in d || "soloLobby" in d) { cerrarSolo(); return; }
    if (d.copiar) { copiar(d.copiar); return; }
    if (d.reglas) { abrirReglas(d.reglas); return; }
    if ("elegirCartas" in d) { abrirCartas(); return; }
    if ("ofrecer" in d) { if (t.getAttribute("aria-disabled") === "true") return; ofrecerCartas(t); return; }
    if ("cerrarInscripcion" in d) { if (t.getAttribute("aria-disabled") === "true") { aviso("Hacen falta al menos dos jugadores para empezar.", { tipo: "info", cerrar: true }); return; } ejecutar(() => api.pozo.cerrarInscripcion(), t); return; }
    if ("confirmar" in d) {
      if (t.getAttribute("aria-disabled") === "true") { const e = S.est; aviso(e && !V.jugadorYo(e).oferta_completa ? "Primero elige tus cartas." : e && !e.jugadores.every(j => j.oferta_completa) ? "Faltan cartas por ofrecer: espera a que todos las elijan." : "No te alcanzan los tokens para esta mesa.", { tipo: "info", cerrar: true }); return; }
      const cond = S.est.cond_version; ejecutar(() => api.pozo.confirmar(cond), t); return;
    }
    if ("retirarConfirmacion" in d) { ejecutar(() => api.pozo.retirarConfirmacion(), t); return; }
    if (d.accion) { hacer(d.accion, t); }
  }
  function alCambiar(ev) {
    const t = ev.target;
    if (t.matches && t.matches("[data-carta]")) {
      const k = S.est ? S.est.reglas.cartas : 0, id = t.dataset.carta;
      if (t.checked) { if (S.seleccion.length >= k) { t.checked = false; aviso(`En esta mesa se ponen ${V.plural(k, "carta", "cartas")}. Quita una antes de elegir otra.`, { tipo: "info", cerrar: true }); return; } S.seleccion.push(id); }
      else S.seleccion = S.seleccion.filter(x => x !== id);
      pintarDialogoCartas(k); return;
    }
    const f = t.closest && t.closest("[data-form]"); if (f) actualizarResumen(f);
    const fs2 = t.closest && t.closest("[data-form-solo]"); if (fs2) actualizarResumenSolo(fs2);
  }
  function alEnviar(ev) {
    const f = ev.target;
    if (f.matches && f.matches("[data-form-solo]")) { ev.preventDefault(); empezarSolo(f, f.querySelector("button[type=submit]")); return; }
    if (f.matches && f.matches("[data-form]")) { ev.preventDefault(); crear(f.dataset.form, f.querySelector("button[type=submit]")); return; }
    if (f.id === "pzFormEntrar") { ev.preventDefault(); const c = $("pzCodigo").value.trim(); if (c) unirse(c, f.querySelector("button")); }
  }
  async function copiar(texto) {
    const enlace = `${location.origin}${location.pathname}?mesa=${texto}`;
    try { await navigator.clipboard.writeText(enlace); aviso("Enlace copiado: quien lo abra entra directo a la mesa (si el juego está abierto para él).", { tipo: "info", cerrar: true }); }
    catch (e) { aviso(`No pude copiar el enlace. El código es ${texto}.`, { tipo: "info", cerrar: true }); }
  }
  function alTeclear(ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (S.teatro && [" ", "Enter", "Escape"].includes(ev.key)) { ev.preventDefault(); saltarEscena(); return; }
    const t = ev.target;
    if (t && (t.matches("input, textarea, select") || t.isContentEditable)) return;
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (S.vista === "solo") { const sb = V.accionesSolo(S.solo).botones.find(x => x.tecla === k); if (sb) { ev.preventDefault(); hacerSolo(sb.id, document.querySelector(`[data-accion="${sb.id}"]`)); } return; }
    const est = S.est; if (!est || est.estado !== "jugando") return;
    const b = V.acciones(est).botones.find(x => x.tecla === k);
    if (b) { ev.preventDefault(); hacer(b.id, document.querySelector(`[data-accion="${b.id}"]`)); }
  }
  function pintarSonidoBoton() {
    const b = $("pzBtnSonido");
    b.setAttribute("aria-pressed", String(S.efectos));
    $("pzSonidoIcono").textContent = S.efectos ? "♪" : "–";
    b.classList.toggle("apagado", !S.efectos);
  }

  /* ---------------------------------------------------------------- arranque */
  const finCarga = () => { try { if (window.Carga && window.Carga.listo) window.Carga.listo(); } catch (e) { /* sin aviso de carga */ } };
  async function arrancarConSesion() {
    cargarDesafios();
    try {
      const r = await api.pozo.estado(null);
      if (r && !r.sin_mesa) { aplicar(r); programar(SONDEO_MS); }
      else {
        if (r && r.saldo != null) pintarSaldo(r.saldo);
        let solo = null;
        try { solo = await api.pozo.solo.estado(); } catch (e) { if (e && e.tipo === "red") throw e; /* sin el modo solitario instalado se sigue con las mesas */ }
        if (solo && !solo.sin_partida) { aplicarSolo(solo); programar(SONDEO_FONDO_MS); return; }
        if (solo && solo.reglas) S.reglasSolo = solo.reglas;
        S.lista = null; irALobby(); programar(SONDEO_MS * 2);
        // enlace de invitación: pozo-dragon.html?mesa=ABCDE
        const cod = (new URLSearchParams(location.search).get("mesa") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
        if (cod.length === 5) { history.replaceState(null, "", location.pathname); await unirse(cod, null); }
      }
    } catch (e) {
      if (e && e.tipo === "servidor" && e.codigo === "oculto") { mostrar("oculto"); return; }
      if (e && e.tipo === "servidor" && /does not exist|Could not find the function|schema cache/i.test(e.mensaje || "")) { mostrar("oculto"); aviso("El Pozo del Dragón todavía no está instalado en el servidor.", { tipo: "info" }); return; }
      manejarError(e, arrancarConSesion); mostrar("sin_conexion"); programar(5000);
    }
  }
  // Los ojos de los dragones visibles siguen al cursor: la pupila viaja más que el iris para dar profundidad. Una sola escritura por fotograma.
  const mirada = { espera: false, ultimo: Date.now(), reposo: false, vaga: false };
  const entre = v => Math.max(-1, Math.min(1, v));
  function seguirConLaMirada(ev) {
    mirada.ultimo = Date.now();
    if (mirada.reposo || mirada.vaga) {
      mirada.reposo = false; mirada.vaga = false;
      document.querySelectorAll(".pz-dragon-marco.pz-reposo, .pz-dragon-marco.pz-vaga").forEach(m => { m.classList.remove("pz-reposo", "pz-vaga"); const o = m.querySelector(".pz-dragon-ojos"); if (o) o.style.transform = ""; });
    }
    if (mirada.espera || sinMovimiento()) return;
    const marcos = [...document.querySelectorAll(".pz-dragon-marco")].filter(m => m.offsetParent !== null);
    if (!marcos.length) return;
    mirada.espera = true;
    const x = ev.clientX, y = ev.clientY;
    requestAnimationFrame(() => {
      mirada.espera = false;
      for (const m of marcos) {
        const r = m.getBoundingClientRect(); if (!r.width) continue;
        const dx = entre((x - (r.left + r.width / 2)) / (r.width / 2)), dy = entre((y - (r.top + r.height * 0.48)) / (r.height / 2));
        m.querySelectorAll(".pz-heroe-pupila").forEach(g => { g.style.transform = `translate(${(dx * 9).toFixed(1)}px, ${(dy * 5).toFixed(1)}px)`; });
        m.querySelectorAll(".pz-heroe-iris").forEach(g => { g.style.transform = `translate(${(dx * 4).toFixed(1)}px, ${(dy * 2.5).toFixed(1)}px)`; });
      }
    });
  }
  // Sin cursor durante 5 s: los ojos vuelven despacio al centro y parpadean una vez
  function mirarAlCentro() {
    for (const m of document.querySelectorAll(".pz-dragon-marco")) {
      if (m.offsetParent === null) continue;
      m.classList.add("pz-reposo");
      m.querySelectorAll(".pz-heroe-pupila, .pz-heroe-iris").forEach(g => { g.style.transform = "translate(0px, 0px)"; });
      m.querySelectorAll(".pz-dh-parpado").forEach(p => animar(p, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 280, easing: "ease-in-out", fill: "none" }));
    }
  }
  // Cuando nadie mueve el cursor los ojos miran a su aire: cada pocos segundos se fijan en otro sitio (a veces con un parpadeo) y el par entero se desplaza un poco, para que no sean una imagen quieta en la oscuridad
  function vagar() {
    if (document.hidden || sinMovimiento() || Date.now() - mirada.ultimo < 3000) return;
    for (const m of document.querySelectorAll(".pz-dragon-marco")) {
      if (m.offsetParent === null || m.dataset.e === "ruina" || m.dataset.e === "cobro") continue;
      const dx = Math.random() * 2 - 1, dy = (Math.random() * 2 - 1) * 0.8;
      m.classList.add("pz-vaga"); mirada.vaga = true;
      m.querySelectorAll(".pz-heroe-pupila").forEach(g => { g.style.transform = `translate(${(dx * 9).toFixed(1)}px, ${(dy * 5).toFixed(1)}px)`; });
      m.querySelectorAll(".pz-heroe-iris").forEach(g => { g.style.transform = `translate(${(dx * 4).toFixed(1)}px, ${(dy * 2.5).toFixed(1)}px)`; });
      const o = m.querySelector(".pz-dragon-ojos"); if (o) o.style.transform = `translate(${(dx * 5).toFixed(1)}px, ${(dy * 3).toFixed(1)}px)`;
      if (Math.random() < 0.3) m.querySelectorAll(".pz-dh-parpado").forEach(p => animar(p, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 260, easing: "ease-in-out", fill: "none" }));
    }
  }
  const programarVagar = () => setTimeout(() => { vagar(); programarVagar(); }, 1800 + Math.random() * 3800);
  function pintarRapidoBoton() {
    const b = $("pzBtnRapido"); if (!b) return;
    b.setAttribute("aria-pressed", String(S.rapido)); b.classList.toggle("apagado", !S.rapido);
  }
  async function iniciar() {
    document.body.insertAdjacentHTML("afterbegin", A.defs());
    E.ritmo(S.rapido ? 0.55 : 1); pintarRapidoBoton();
    document.body.insertAdjacentHTML("beforeend", '<div class="pz-vineta" id="pzVineta" aria-hidden="true"></div><div class="pz-vineta-luz" id="pzVinetaLuz" aria-hidden="true"></div>');
    setInterval(() => { if (!document.hidden && !mirada.reposo && Date.now() - mirada.ultimo > 5000) { mirada.reposo = true; mirarAlCentro(); } }, 800);
    programarVagar();
    document.addEventListener("pointermove", seguirConLaMirada, { passive: true });
    $("pzEmblema").innerHTML = A.emblema();
    $("pzSaldoMoneda").innerHTML = A.moneda();
    $("pzFondoDragon").innerHTML = A.dragon();
    pintarSonidoBoton();
    Brasas.iniciar();
    document.addEventListener("click", alClic);
    document.addEventListener("change", alCambiar);
    document.addEventListener("input", alCambiar);
    document.addEventListener("submit", alEnviar);
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("input", ev => { if (ev.target.id === "pzCodigo") ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    $("pzBtnReglas").addEventListener("click", () => abrirReglas());
    $("pzBtnDesafios").addEventListener("click", abrirDesafios);
    $("pzBtnRapido").addEventListener("click", () => { S.rapido = !S.rapido; guardado.poner("pzRapido", S.rapido ? "1" : "0"); E.ritmo(S.rapido ? 0.55 : 1); pintarRapidoBoton(); });
    $("pzBtnAtajos").addEventListener("click", abrirAtajos);
    $("pzBtnSonido").addEventListener("click", () => { S.efectos = !S.efectos; guardado.poner("pzEfectos", S.efectos ? "1" : "0"); pintarSonidoBoton(); if (S.efectos) sonar("moneda"); });
    window.addEventListener("online", () => { aviso("Volvió la conexión.", { tipo: "info", cerrar: true }); sondear(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && S.sesion) sondear(); });
    setInterval(pintarReloj, 500);

    mostrar("cargando");
    let sesion = null;
    try { sesion = typeof fichasSesionActual === "function" ? await fichasSesionActual() : null; } catch (e) { sesion = null; }
    S.sesion = sesion;
    if (!sesion) { mostrar("sin_sesion"); finCarga(); }
    else { await arrancarConSesion(); finCarga(); }
    if (typeof fichasEnCambioDeSesion === "function") {
      fichasEnCambioDeSesion(ses => {
        if (ses && !S.sesion) { S.sesion = ses; arrancarConSesion(); }
        else if (!ses && S.sesion) { S.sesion = null; S.est = null; clearTimeout(S.sondeo); pintarSaldo(NaN); mostrar("sin_sesion"); }
      }).catch(() => {});
    }
  }

  window.PozoDragon = { estado: S, abrirReglas };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
