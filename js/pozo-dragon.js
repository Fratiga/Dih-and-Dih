/* =============================================================================
   EL POZO DEL DRAGÓN (pozo-dragon.html)
   El servidor (docs/pozo-dragon.sql) tira los dados, lleva los turnos, reserva el dinero y las cartas, cuenta el pozo y paga. Esta página pregunta por el estado de la mesa
   cada pocos segundos y lo pinta; lo que haces (tirar, cobrar, continuar...) se manda con el paso de la mesa que veías, así que repetirlo por un corte de red es seguro.
   Las animaciones de los dados enseñan un resultado que ya está decidido: nunca lo deciden.
   Piezas: pozo-dragon-arte.js (dibujos), pozo-dragon-vista.js (textos y reglas), veintiuna-api.js (red).
============================================================================= */
(function () {
  const A = window.PozoArte, V = window.PozoVista;
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
    solo: null,               // la partida en solitario (si hay)
    vistoSolo: 0,
    reglasSolo: null
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
      pierde() { tono(233, 0.4, "sawtooth", 0.05); tono(175, 0.55, "sawtooth", 0.05, 0.2); }
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
        cx.fillStyle = p.r > 1.7 ? "#ffb24a" : "#d8642c";
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
    const aj = (S.lista && S.lista.ajustes) || {};
    $("pzLobby").innerHTML = `
      <p class="pz-lema">Tres dados, un tesoro y un dragón que se lleva a quien se pasa de listo. Juega un duelo contra un amigo o siéntate a una mesa de hasta seis. Se apuestan tokens de juego, cartas de tu colección o las dos cosas, y todo se acuerda y se confirma antes de tirar.</p>
      <div class="pz-modos">
        <article class="pz-modo" data-modo-tarjeta="duelo">
          <div class="pz-modo-arte" aria-hidden="true">${A.dado(6)}<span class="pz-modo-vs">contra</span>${A.dado(5)}</div>
          <h2>Duelo de Dragones</h2>
          <p>Dos jugadores, una mesa y un pozo de dos apuestas. Gana quien primero se lleve dos rondas, comparando sus tiradas.</p>
          <ul><li>Mejor de tres rondas ganadas, con un máximo de cinco.</li><li>Los empates no dan ronda a nadie.</li><li>Se llevan todo: el dinero y las cartas del que pierde.</li></ul>
          <button type="button" class="pz-boton" data-abrir-form="duelo">Crear un duelo</button>
          ${formModo("duelo")}
        </article>
        <article class="pz-modo" data-modo-tarjeta="compartido">
          <div class="pz-modo-arte" aria-hidden="true"><div class="pz-modo-puestos">${A.ojo()}${A.ojo()}${A.ojo()}${A.ojo()}${A.ojo()}${A.ojo()}</div></div>
          <h2>El Pozo Compartido</h2>
          <p>De dos a seis jugadores ponen la misma apuesta. Tiras, sumas peso y decides si cobras o sigues. La Ruina te deja sin nada; el pozo se reparte según el peso.</p>
          <ul><li>Hasta cinco tiradas por jugador.</li><li>Cobrar es una decisión válida, no una derrota.</li><li>No se crea dinero: el pozo son las apuestas.</li></ul>
          <button type="button" class="pz-boton" data-abrir-form="compartido">Crear una mesa</button>
          ${formModo("compartido")}
        </article>
        <article class="pz-modo" data-modo-tarjeta="solo">
          <div class="pz-modo-arte" aria-hidden="true">${A.dado(4)}<span class="pz-modo-vs">y</span>${A.ojo()}</div>
          <h2>Solo contra el Dragón</h2>
          <p>Apuestas, tiras tres dados y decides después de cada tirada: cobrar o seguir. El premio crece con cada combinación y la Ruina lo pierde todo.</p>
          <ul><li>Hasta cinco tiradas; en la quinta cobras solo.</li><li>Paga la casa: tributo del Dragón visible antes de apostar.</li><li>Solo dinero, sin cartas.</li></ul>
          ${formSolo()}
        </article>
      </div>
      <div class="pz-lobby-pie">
        <div class="pz-caja"><h3>Mesas abiertas</h3><div class="pz-mesas" id="pzMesasLista"></div></div>
        <div class="pz-caja"><h3>Entrar con un código</h3>
          <form id="pzFormEntrar" class="pz-form" novalidate><label class="pz-campo"><span>Código de la mesa</span><input type="text" id="pzCodigo" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE"></label>
            <button type="submit" class="pz-boton">Entrar</button></form>
          <p class="pz-ayuda">Tu saldo: ${V.num(S.saldo)} tokens de juego${aj.apuesta_max > 0 ? `. Apuesta máxima: ${V.num(aj.apuesta_max)}` : ". Sin apuesta máxima"}.</p></div>
      </div>`;
    S.lobbyArmado = true;
    pintarMesasLista();
    document.querySelectorAll("[data-form]").forEach(actualizarResumen);
    document.querySelectorAll("[data-form-solo]").forEach(actualizarResumenSolo);
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
  function filaDados(ult, extra) {
    if (!ult) return `<p class="pz-sin-tirar">Aún no ha tirado</p>`;
    return ult.dados.map(v => A.dado(v, (extra || "") + (ult.categoria === "ruina" ? " es-ruina" : ult.categoria === "triple_seis" ? " es-triple-seis" : ""))).join("");
  }
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
      const f = V.frasesTirada(j.ultima, "duelo", est.reglas.bonos);
      const puntos = Array.from({ length: est.reglas.victorias }, (_, i) => `<span class="pz-ronda-punto" data-g="${i < j.victorias ? 1 : 0}"></span>`).join("");
      return `<article class="pz-duelo-lado" data-yo="${j.yo ? 1 : 0}" data-turno="${turno.asiento === j.asiento ? 1 : 0}" data-asiento="${j.asiento}">
        <div class="pz-asiento-cab"><span class="pz-asiento-nombre">${esc(j.yo ? j.nombre + " (tú)" : j.nombre)}</span>${turno.asiento === j.asiento ? `<span class="pz-chip pz-turno-marca">Su turno</span>` : ""}</div>
        <div class="pz-rondas" aria-label="${j.victorias} de ${est.reglas.victorias} rondas ganadas">${puntos}</div>
        <div class="pz-bandeja-lado" data-dados-main="${j.asiento}">${filaDados(j.ultima)}</div>
        <p class="pz-veredicto-efecto">${f ? `${esc(f.nombre)} (${esc(f.dados)})` : "&nbsp;"}</p>
        ${est.reglas.cartas > 0 ? listaCartas(j.oferta) : ""}
      </article>`;
    };
    const ultimaRonda = (est.rondas || []).slice(-1)[0];
    return `<div class="pz-duelo">${lados[0] ? ladoHtml(lados[0]) : ""}
      <div class="pz-duelo-centro">
        <p class="pz-duelo-ronda">Ronda ${est.ronda} de ${est.reglas.rondas_max}</p>
        <div class="pz-pozo-fila">${A.monton(est.reglas.dinero > 0 ? 8 : 2)}</div>
        <p class="pz-pozo-cifra" data-pozo>${V.num(est.pozo.dinero)}</p>
        <p class="pz-pozo-sub">${est.reglas.cartas > 0 ? `+ ${V.plural(est.reglas.cartas * 2, "carta", "cartas")} en juego` : "tokens en juego"}</p>
        ${ultimaRonda ? `<p class="pz-pozo-sub">${ultimaRonda.ganador == null ? "La última ronda empató" : ultimaRonda.ganador === (yo && yo.asiento) ? "Ganaste la última ronda" : "Perdiste la última ronda"}</p>` : ""}
      </div>${lados[1] ? ladoHtml(lados[1]) : ""}</div>
      ${histor ? `<ul class="pz-historial" aria-label="Rondas jugadas">${histor}</ul>` : ""}`;
  }
  function pintarCompartido(est) {
    const turno = est.turno || {}, r = est.reglas;
    const ult = est.jugadores.filter(j => j.ultima).sort((a, b) => b.ultima.id - a.ultima.id)[0] || null;
    const f = ult ? V.frasesTirada(ult.ultima, "compartido", r.bonos) : null;
    const maxPeso = Math.max(1, ...est.jugadores.map(j => Number(j.peso) || 0));
    const quien = ult ? (ult.yo ? "Tu tirada" : `Tirada de ${esc(ult.nombre)}`) : "";
    return `<div class="pz-pozo"><div class="pz-pozo-fila">${A.monton(Math.round(2 + est.pozo.dinero / Math.max(1, r.dinero) * 1.2))}
        <div><p class="pz-pozo-etq">El pozo</p><p class="pz-pozo-cifra" data-pozo>${V.num(est.pozo.dinero)}</p></div></div>
        <p class="pz-pozo-sub">${r.dinero > 0 ? "tokens de juego" : "solo cartas"}${r.cartas > 0 ? ` · ${V.plural(r.cartas * est.jugadores.length, "carta", "cartas")} en juego` : ""} · se reparte por peso entre quienes no caigan en Ruina</p></div>
      <div class="pz-bandeja" data-dados-main="${ult ? ult.asiento : ""}" aria-label="Última tirada">${ult ? filaDados(ult.ultima) : `<p class="pz-sin-tirar">Todavía nadie ha tirado</p>`}</div>
      <div class="pz-veredicto" data-c="${ult ? esc(ult.ultima.categoria) : ""}"><p class="pz-veredicto-quien">${quien}${ult && ult.ultima.auto ? " (automática)" : ""}</p>
        <p class="pz-veredicto-nombre">${f ? esc(f.nombre) : "&nbsp;"}</p><p class="pz-veredicto-efecto">${f ? esc(f.dados + " · " + f.efecto) : ""}</p></div>
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
  function pintarDockMesa(est) {
    const plan = V.acciones(est), yo = V.jugadorYo(est), t = est.turno || {};
    if (plan.tipo === "espera") {
      const j = V.jugadorEn(est, t.asiento);
      return `<p class="pz-espera-turno" role="status">Le toca a <strong>${esc(j ? j.nombre : "otro jugador")}</strong> <span class="pz-reloj" data-reloj></span></p>${yo && yo.estado !== "activo" ? `<p class="pz-espera-turno">${yo.estado === "ruina" ? "Has caído en Ruina. Sigue la partida desde aquí." : yo.estado === "retirado" ? "Ya has cobrado: tu peso queda fijo hasta que acabe la mesa." : ""}</p>` : ""}`;
    }
    const parte = yo && yo.parte != null ? `<p class="pz-dock-texto">${t.fase === "decidir" ? `Si cobraras ahora y todos los demás también, recibirías <strong>${V.num(yo.parte)}</strong> tokens (apostaste ${V.num(est.reglas.dinero)}). Tu tirada sumó a tu peso; ${est.reglas.tiradas_max - yo.tiradas > 0 ? `te quedan ${V.plural(est.reglas.tiradas_max - yo.tiradas, "tirada", "tiradas")}` : "era tu última tirada"}. ` : ""}Tiempo: <span class="pz-reloj" data-reloj></span></p>` : `<p class="pz-dock-texto">Tu turno. Tiempo: <span class="pz-reloj" data-reloj></span></p>`;
    return `${parte}<div class="pz-dock-botones">${plan.botones.map(b => `<button type="button" class="pz-boton${b.principal ? " pz-boton-principal" : ""}" data-accion="${b.id}" aria-keyshortcuts="${b.tecla}">${esc(b.texto)}${b.sub ? `<span class="pz-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}</div>`;
  }
  function pintarFin(est) {
    const r = V.resumenFinal(est);
    if (!r) return "";
    const js = (est.resultado && est.resultado.jugadores) || [];
    const liq = js.map(x => { const j = V.jugadorEn(est, x.asiento); return j ? `<li><span>${esc(j.yo ? "Tú" : j.nombre)}</span><span>${Number(x.neto) > 0 ? "+" : ""}${V.num(x.neto)} tokens${(x.cartas_ganadas || []).length ? ` · +${V.plural(x.cartas_ganadas.length, "carta", "cartas")}` : ""}${(x.cartas_perdidas || []).length ? ` · −${V.plural(x.cartas_perdidas.length, "carta", "cartas")}` : ""}</span></li>` : ""; }).join("");
    return `<section class="pz-fin" data-c="${r.clase}"><h2>${esc(r.titulo)}</h2><p>${esc(r.texto)}</p>${liq ? `<ul class="pz-liquidacion" aria-label="Liquidación">${liq}</ul>` : ""}
      <div class="pz-acciones"><button type="button" class="pz-boton pz-boton-principal" data-cerrar-mesa id="pzDock" tabindex="-1">Volver a las mesas</button></div></section>`;
  }
  function pintarMesa(est) {
    const fin = est.estado !== "jugando";
    const tapete = est.modo === "duelo" ? pintarDuelo(est) : pintarCompartido(est);
    $("pzMesa").innerHTML = `
      <div class="pz-barra">
        <div><span class="pz-codigo">${esc(est.codigo)}</span></div>
        <div class="pz-barra-sub">${est.modo === "duelo" ? "Duelo de Dragones" : "El Pozo Compartido"} · apuesta ${esc(V.textoApuesta(est.reglas))}</div>
        ${fin ? "" : `<button type="button" class="pz-boton-mini" data-salir>${est.modo === "duelo" ? "Abandonar el duelo" : "Retirarme de la mesa"}</button>`}
      </div>
      <div class="pz-mesa"><div class="pz-tapete" id="pzTapete"><div class="pz-destello" id="pzDestello" aria-hidden="true"></div>${tapete}</div>
        ${fin ? pintarFin(est) : `<section class="pz-dock" id="pzDock" tabindex="-1" aria-label="Controles de la mesa">${pintarDockMesa(est)}</section>`}</div>`;
  }

  /* ---------------------------------------------------------------- dados que ruedan (el resultado ya lo decidió el servidor) */
  async function rodar(cont, dados, categoria) {
    if (!cont) return;
    const els = [...cont.querySelectorAll(".pz-dado")];
    if (!els.length || sinMovimiento()) return;
    S.animando = true;
    sonar("dados");
    els.forEach(e => e.classList.add("rodando"));
    const t0 = Date.now();
    while (Date.now() - t0 < 640) {
      els.forEach((e, i) => { const v = 1 + Math.floor(Math.random() * 6); e.outerHTML = A.dado(v, "rodando"); });
      await esperar(80);
      els.splice(0, els.length, ...cont.querySelectorAll(".pz-dado"));
    }
    cont.innerHTML = dados.map(v => A.dado(v, "cae" + (categoria === "ruina" ? " es-ruina" : categoria === "triple_seis" ? " es-triple-seis" : ""))).join("");
    sonar("cae");
    await esperar(430);
    S.animando = false;
  }
  function efectosDeCategoria(c, soyYo) {
    const tapete = $("pzTapete");
    if (c === "ruina") {
      document.body.classList.add("pz-ruina"); setTimeout(() => document.body.classList.remove("pz-ruina"), 1200);
      if (tapete && !sinMovimiento()) { tapete.classList.add("pz-sacude"); setTimeout(() => tapete.classList.remove("pz-sacude"), 600); }
      sonar("ruina");
    } else if (c === "triple_seis") {
      const d = $("pzDestello"); if (d && !sinMovimiento()) { d.classList.add("activo"); setTimeout(() => d.classList.remove("activo"), 1000); }
      Brasas.estallido(60); sonar("grande");
    } else if (c === "triple") { Brasas.estallido(24); sonar("premio"); }
    else if (c === "escalera" || c === "pareja") sonar("moneda");
  }
  async function animarNuevas(est, antes) {
    for (const j of est.jugadores) {
      if (!j.ultima) continue;
      const visto = S.vistoTirada[j.asiento] || 0;
      if (j.ultima.id <= visto) continue;
      S.vistoTirada[j.asiento] = j.ultima.id;
      if (S.primerPintado) continue;
      const cont = document.querySelector(`[data-dados-main="${j.asiento}"]`);
      if (cont) { await rodar(cont, j.ultima.dados, j.ultima.categoria); efectosDeCategoria(j.ultima.categoria, j.yo); }
      const parte = document.querySelector(`[data-parte="${j.asiento}"]`);
      if (parte) { parte.classList.add("pz-pozo-cambia"); setTimeout(() => parte.classList.remove("pz-pozo-cambia"), 800); }
    }
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
    const r = reglasSoloVigentes(), t = r.tributo != null ? r.tributo : 5, d = Number(f.querySelector('[data-f="dinero"]').value) || 0;
    el.textContent = d <= 0 ? "Hay que apostar dinero." : `Apuestas ${V.num(d)} tokens. Tu premio provisional empieza en ${V.num(V.premioSolo(d, t, 0))} (la apuesta menos el tributo) y sube con cada tirada. Nada se descuenta hasta que pulses «Jugar en solitario».`;
  }

  function filaPerspectiva(s) {
    const p = V.perspectivaSolo(s); if (!p) return "";
    return `<table class="pz-tabla pz-perspectiva"><caption>Si sigues tirando (te quedan ${V.plural(p.quedan, "tirada", "tiradas")})</caption><thead><tr><th scope="col">Sale</th><th scope="col" class="pz-num">Probabilidad</th><th scope="col" class="pz-num">Tu premio pasa a</th></tr></thead><tbody>
      <tr><th scope="row">Ruina</th><td class="pz-num">${V.pct(10 / 216)}</td><td class="pz-num">0 (lo pierdes todo)</td></tr>
      ${[["Ceniza", "ceniza", 96], ["Pareja", "pareja", 81], ["Escalera", "escalera", 24], ["Triple", "triple", 4], ["Triple seis", "triple_seis", 1]].map(([n, c, k], i) => `<tr><th scope="row">${n}</th><td class="pz-num">${V.pct(k / 216)}</td><td class="pz-num">${V.num(p.filas[i].premio)}</td></tr>`).join("")}
      </tbody></table>`;
  }

  function pintarSolo(s) {
    const fin = s.estado === "terminada", r = V.resumenSolo(s), plan = V.accionesSolo(s);
    const ult = s.historial.length ? s.historial[s.historial.length - 1] : null;
    const f = ult ? V.frasesTirada({ dados: ult.dados, categoria: ult.categoria }, "solo", s.bonos) : null;
    const puntos = Array.from({ length: s.tiradas_max }, (_, i) => `<span class="pz-ronda-punto" data-g="${i < s.tiradas ? 1 : 0}"></span>`).join("");
    const dock = fin ? `<section class="pz-fin" data-c="${r.clase}"><h2>${esc(r.titulo)}</h2><p>${esc(r.texto)}</p>
        <div class="pz-acciones"><button type="button" class="pz-boton pz-boton-principal" data-solo-nueva id="pzDock" tabindex="-1">Jugar otra vez</button><button type="button" class="pz-boton" data-solo-lobby>Volver a las mesas</button></div></section>`
      : `<section class="pz-dock" id="pzDock" tabindex="-1" aria-label="Controles de la partida"><p class="pz-dock-texto">${s.fase === "decidir" ? `Tu premio provisional es <strong>${V.num(s.premio)}</strong> tokens (apostaste ${V.num(s.apuesta)}). ` : `Apuestas ${V.num(s.apuesta)} tokens. `}Si te vas, la partida se cierra sola en <span class="pz-reloj" data-reloj></span> ${s.tiradas === 0 ? "y se te devuelve la apuesta" : "y cobras lo que lleves"}.</p>
        <div class="pz-dock-botones">${plan.botones.map(b => `<button type="button" class="pz-boton${b.principal ? " pz-boton-principal" : ""}" data-accion="${b.id}" aria-keyshortcuts="${b.tecla}">${esc(b.texto)}${b.sub ? `<span class="pz-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}</div></section>`;
    $("pzSolo").innerHTML = `
      <div class="pz-barra"><div><span class="pz-codigo">Solo</span></div><div class="pz-barra-sub">Tú contra el Dragón · apuesta ${V.num(s.apuesta)} tokens de juego</div></div>
      <div class="pz-mesa"><div class="pz-tapete" id="pzTapete"><div class="pz-destello" id="pzDestello" aria-hidden="true"></div>
        <div class="pz-pozo"><div class="pz-pozo-fila">${A.monton(Math.round(3 + (Number(fin ? s.pago : s.premio) / Math.max(1, s.apuesta)) * 4))}<div><p class="pz-pozo-etq">${fin ? "Premio cobrado" : "Tu premio provisional"}</p><p class="pz-pozo-cifra" data-pozo>${V.num(fin ? s.pago : s.premio)}</p></div></div>
          <p class="pz-pozo-sub">apuesta ${V.num(s.apuesta)} · el Dragón retiene un ${V.num(s.tributo)} % (premio base ${V.num(s.base)}) · ${V.pct(s.bono)} de bonos acumulados</p></div>
        <div class="pz-bandeja" data-dados-solo aria-label="Última tirada">${ult ? filaDados(ult) : `<p class="pz-sin-tirar">Todavía no has tirado</p>`}</div>
        <div class="pz-veredicto" data-c="${ult ? esc(ult.categoria) : ""}"><p class="pz-veredicto-quien">Tirada ${s.tiradas} de ${s.tiradas_max}</p><p class="pz-veredicto-nombre">${f ? esc(f.nombre) : "&nbsp;"}</p><p class="pz-veredicto-efecto">${f ? esc(f.dados + " · " + f.efecto) : ""}</p></div>
        <div class="pz-rondas" aria-label="${s.tiradas} de ${s.tiradas_max} tiradas">${puntos}</div>
        ${fin ? "" : filaPerspectiva(s)}
      </div>${dock}</div>`;
  }

  async function animarSolo(s, antes) {
    const ult = s.historial.length ? s.historial[s.historial.length - 1] : null;
    if (!ult) return;
    const visto = S.vistoSolo || 0;
    if (ult.id <= visto) return;
    S.vistoSolo = ult.id;
    if (S.primerPintado) return;
    const cont = document.querySelector("[data-dados-solo]");
    if (cont) { await rodar(cont, ult.dados, ult.categoria); efectosDeCategoria(ult.categoria, true); }
    const p = document.querySelector("[data-pozo]"); if (p) { p.classList.add("pz-pozo-cambia"); setTimeout(() => p.classList.remove("pz-pozo-cambia"), 800); }
  }

  function aplicarSolo(s) {
    if (!s) return;
    if (s.reglas) S.reglasSolo = s.reglas;
    if (s.sin_partida) {
      const habia = S.solo; S.solo = null;
      if (s.saldo != null) pintarSaldo(s.saldo);
      if (S.vista === "solo" || habia) irALobby();
      return;
    }
    const antes = S.solo; S.solo = s; S.est = null;
    if (s.saldo != null) pintarSaldo(s.saldo);
    fijarLimite(s.restante_s);
    if (S.vista !== "solo") mostrar("solo");
    pintarSolo(s); animarSolo(s, antes); pintarReloj();
    const frase = V.anuncioSolo(antes, s); if (frase) leer(frase);
    if (s.estado === "terminada" && (!antes || antes.estado !== "terminada") && !S.primerPintado) { const r = V.resumenSolo(s); if (r) sonar(r.clase === "gana" ? "premio" : r.clase === "pierde" ? "pierde" : "moneda"); }
    S.primerPintado = false;
  }

  function empezarSolo(f, boton) {
    const dinero = Number(f.querySelector('[data-f="dinero"]').value) || 0;
    const cliente = window.VeintiunaApi.nuevoId();                    // el mismo identificador en cada reintento: la partida no se abre dos veces ni se cobra dos veces
    return ejecutar(() => api.pozo.solo.empezar(cliente, dinero), boton, aplicarSolo);
  }
  function hacerSolo(accion, boton) {
    const s = S.solo; if (!s || s.estado !== "en_curso") return;
    const paso = s.paso, id = s.id;
    return ejecutar(() => (accion === "cobrar" ? api.pozo.solo.cobrar(id, paso) : api.pozo.solo.tirar(id, paso)), boton, aplicarSolo);
  }
  const cerrarSolo = () => ejecutar(() => api.pozo.solo.descartar(), null, aplicarSolo);

  /* ---------------------------------------------------------------- aplicar lo que dice el servidor */
  function aplicar(est) {
    if (!est) return;
    if (est.sin_mesa) {
      const antes = S.est; S.est = null; S.version = null;
      if (est.saldo != null) pintarSaldo(est.saldo);
      if (S.vista !== "lobby") irALobby();
      else if (antes) irALobby();
      return;
    }
    const antes = S.est;
    S.est = est; S.version = est.version;
    if (est.yo && est.yo.saldo != null) pintarSaldo(est.yo.saldo);
    fijarLimite(est.turno ? est.turno.restante_s : est.restante_s);
    const vista = V.vista(est);
    if (S.vista !== vista) { mostrar(vista); }
    if (vista === "sala") pintarSala(est);
    else { pintarMesa(est); animarNuevas(est, antes); }
    pintarReloj();
    const frase = V.anuncio(antes, est);
    if (frase) leer(frase);
    if (est.turno && est.yo && est.yo.tu_turno && (!antes || !antes.turno || antes.turno.asiento !== est.turno.asiento || antes.turno.fase !== est.turno.fase) && !S.primerPintado) sonar("turno");
    if (vista === "fin" && (!antes || V.vista(antes) !== "fin") && !S.primerPintado) {
      const r = V.resumenFinal(est); if (r) sonar(r.clase === "gana" ? "premio" : r.clase === "pierde" ? "pierde" : "moneda");
    }
    S.primerPintado = false;
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
    const t = ev.target.closest("button, a");
    if (!t) return;
    const d = t.dataset;
    if ("reintentar" in d) { const f = S.reintento; aviso(""); if (f) f(); else sondear(); return; }
    if ("cerrarAviso" in d) { aviso(""); return; }
    if (d.abrirForm) { S.form.abierto = S.form.abierto === d.abrirForm ? null : d.abrirForm; document.querySelectorAll("[data-form]").forEach(f => { f.hidden = f.dataset.form !== S.form.abierto; }); const f = document.querySelector(`[data-form="${S.form.abierto}"]`); if (f) { const i = f.querySelector("input[type=text]"); if (i) i.focus({ preventScroll: true }); } return; }
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
  async function iniciar() {
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
