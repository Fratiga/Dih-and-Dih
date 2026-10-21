/* =============================================================================
   LAS VEINTIUNA VELAS CON AMIGOS (veintiuna-amigos.html)
   La mesa compartida. El servidor (docs/veintiuna.sql, sección 8) lleva las cuentas: reparte, da los turnos, juega el crupier, paga y reparte el pozo de cartas.
   Esta página pregunta por el estado de la mesa cada pocos segundos y lo pinta; lo que haces (apostar, pedir, plantarte...) se manda y se pinta lo que
   el servidor confirma. Nunca se calcula aquí un resultado.
   Piezas: veintiuna-arte.js (dibujos), veintiuna-vista.js (textos y acciones), veintiuna-api.js (red).
============================================================================= */
(function () {
  const A = window.VeintiunaArte, V = window.VeintiunaVista;
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

  /* ---------------------------------------------------------------- estado de la pantalla */
  const S = {
    sesion: null,
    vista: "cargando",     // cargando | sin_sesion | sin_servidor | sin_conexion | lobby | mesa
    est: null,             // lo último que dijo el servidor de tu mesa
    version: null,
    lista: null,           // mesas abiertas
    saldo: null,
    eleccion: { modo: "apuesta", apuesta: Number(guardado.leer("vvaApuesta", "0")) || 0, carta: null },
    editando: false,       // cambiar la apuesta cuando ya estabas listo
    misCartas: null,
    ocupado: false,
    reintento: null,
    efectos: guardado.leer("vvEfectos", "1") !== "0",
    limite: { t0: 0, s: null },
    primerPintado: true,
    resultadoVisto: 0,
    logrosVistos: new Set(),
    sondeo: null,
    pintadoRonda: 0
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

  /* ---------------------------------------------------------------- sonidos (sintetizados) */
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
      carta() { ruido(0.09, 2600, 0.45); },
      giro() { ruido(0.14, 1800, 0.35); tono(180, 0.1, "triangle", 0.05); },
      ficha() { tono(1900, 0.07, "triangle", 0.09); tono(2500, 0.08, "triangle", 0.07, 0.045); },
      turno() { tono(660, 0.12, "sine", 0.07); tono(880, 0.16, "sine", 0.06, 0.1); },
      gana() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.28, "sine", 0.1, i * 0.09)); },
      natural() { [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, 0.34, "triangle", 0.1, i * 0.08)); },
      pierde() { tono(233, 0.4, "sawtooth", 0.05); tono(175, 0.55, "sawtooth", 0.05, 0.2); },
      empate() { tono(440, 0.22, "sine", 0.08); tono(440, 0.22, "sine", 0.08, 0.2); }
    };
  })();
  const sonar = nombre => { try { Sonido[nombre](); } catch (e) { /* sin audio */ } };

  /* ---------------------------------------------------------------- avisos */
  function leer(texto, fuerte) {
    const el = $(fuerte ? "vvSrFuerte" : "vvSr");
    el.textContent = "";
    setTimeout(() => { el.textContent = texto; }, 30);
  }
  function aviso(texto, opciones) {
    const el = $("vvAviso");
    if (!texto) { el.hidden = true; el.innerHTML = ""; return; }
    const o = opciones || {};
    el.hidden = false;
    el.className = "vv-aviso" + (o.tipo ? " vv-aviso-" + o.tipo : "");
    el.innerHTML = `<span>${esc(texto)}</span>${o.reintentar ? `<button type="button" class="vv-boton-mini" id="vvReintentar">Reintentar</button>` : ""}${o.cerrar ? `<button type="button" class="vv-boton-mini" id="vvAvisoCerrar" aria-label="Cerrar el aviso">×</button>` : ""}`;
    if (o.tipo === "error") leer(texto, true);
  }
  function tostada(texto, opciones) {
    const o = opciones || {};
    const el = document.createElement("div");
    el.className = "vv-tostada" + (o.clase ? " " + o.clase : "");
    el.innerHTML = `<span class="vv-tostada-icono" aria-hidden="true">${o.icono || "✦"}</span><span>${esc(texto)}</span>${o.accion ? `<a class="vv-enlace" href="${esc(o.href || "#")}">${esc(o.accion)}</a>` : ""}`;
    $("vvToasts").appendChild(el);
    requestAnimationFrame(() => el.classList.add("entra"));
    setTimeout(() => { el.classList.remove("entra"); setTimeout(() => el.remove(), 400); }, o.ms || 6500);
  }

  /* ---------------------------------------------------------------- diálogos */
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
  const cabeceraDlg = (id, titulo, sub) => `<header class="vv-dlg-cab"><div><p class="eyebrow">VEINTIUNA CON AMIGOS</p><h2 id="${id}">${esc(titulo)}</h2>${sub ? `<p class="vv-dlg-sub">${esc(sub)}</p>` : ""}</div><button type="button" class="vv-cerrar" data-cerrar aria-label="Cerrar">×</button></header>`;

  /* ---------------------------------------------------------------- saldo */
  function pintarSaldo(n) {
    const x = Number(n);
    $("vvSaldo").textContent = Number.isFinite(x) ? V.monedas(x) : "—";
    if (Number.isFinite(x)) S.saldo = x;
  }
  const saldoActual = () => (S.est && S.est.yo && S.est.yo.saldo != null ? Number(S.est.yo.saldo) : Number(S.saldo) || 0);

  /* ---------------------------------------------------------------- cartas */
  function crearCarta(carta, oculta) {
    const t = document.createElement("template");
    t.innerHTML = A.carta(carta, oculta).trim();
    return t.content.firstElementChild;
  }
  function ajustarAbanico(mano) {
    const n = mano.children.length;
    mano.dataset.n = String(n);
    mano.style.setProperty("--n", n);
  }
  async function revelar(el, carta) {
    el.querySelector(".vv-lado-cara").innerHTML = A.cara(carta);
    el.setAttribute("aria-label", A.nombreCarta(carta));
    el.dataset.r = carta.r; el.dataset.p = carta.p;
    const vista = el.querySelector(".vv-vista"); if (vista) vista.remove();
    sonar("giro");
    if (!sinMovimiento()) {
      el.classList.add("girando");
      await animar(el.querySelector(".vv-carta-giro"), [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], { duration: 420 });
    }
    el.classList.remove("vv-boca-abajo", "girando");
  }
  function cambiarCara(el, carta) {
    el.querySelector(".vv-lado-cara").innerHTML = A.cara(carta);
    el.setAttribute("aria-label", A.nombreCarta(carta) + (carta.as1 ? ", convertida en un as de valor 1" : ""));
    el.dataset.r = carta.r; el.dataset.p = carta.p;
    if (carta.as1) el.dataset.as1 = "1"; else delete el.dataset.as1;
    el.classList.add("convertida"); setTimeout(() => el.classList.remove("convertida"), 1400);
  }
  // Deja la mano dibujada igual que la del servidor tocando lo mínimo: las cartas nuevas entran, la oculta se gira cuando se enseña, la que cambió de cara se marca
  function reconciliar(mano, cartas, ocultas, clave) {
    if (mano.dataset.clave !== clave) { mano.innerHTML = ""; mano.dataset.clave = clave; }
    const total = cartas.length + (ocultas || 0);
    while (mano.children.length > total) mano.lastElementChild.remove();
    let nuevas = 0;
    for (let i = 0; i < total; i++) {
      const oculta = i >= cartas.length, c = oculta ? null : cartas[i];
      let el = mano.children[i];
      if (!el) {
        el = crearCarta(c, oculta);
        if (S.primerPintado || sinMovimiento()) el.classList.add("sin-anim"); else { el.classList.add("vva-entra"); nuevas++; }
        mano.appendChild(el);
      } else if (el.classList.contains("vv-boca-abajo") && !oculta) {
        revelar(el, c);
      } else if (!oculta && (Number(el.dataset.r) !== c.r || Number(el.dataset.p) !== c.p)) {
        cambiarCara(el, c);
      } else if (!oculta && c.as1 && !el.dataset.as1) {
        cambiarCara(el, c);
      }
    }
    ajustarAbanico(mano);
    if (nuevas) sonar("carta");
  }

  /* ---------------------------------------------------------------- velas y totales */
  function textoTotal(total, blando, resultado) { return (blando && total <= 21 ? `${total} blando` : String(total)) + (resultado ? "" : ""); }

  /* ---------------------------------------------------------------- la crupier */
  let dichoTimer = null;
  function crupierEstado(estado) { $("vvCrupier").dataset.estado = estado; $("vvaMesa").dataset.estado = estado; }
  function decir(clave, probabilidad) {
    if (probabilidad != null && Math.random() > probabilidad) return;
    const texto = V.elegir(clave);
    if (!texto) return;
    const d = $("vvDicho");
    d.textContent = texto; d.classList.add("visible");
    clearTimeout(dichoTimer);
    dichoTimer = setTimeout(() => d.classList.remove("visible"), 3200);
  }

  /* ---------------------------------------------------------------- la placa de la regla */
  function pintarPlaca(est) {
    const reglaId = est.regla.id, R = V.REGLAS[reglaId], placa = $("vvPlaca");
    if (!R) { placa.hidden = true; return; }
    placa.hidden = false;
    const cambia = placa.dataset.regla !== reglaId || placa.dataset.ronda !== String(est.ronda);
    placa.dataset.regla = reglaId; placa.dataset.ronda = String(est.ronda);
    $("vvPlacaIcono").innerHTML = A.ICONOS[reglaId];
    $("vvPlacaEtq").textContent = "Regla de la ronda " + est.ronda;
    $("vvPlacaNombre").textContent = R.nombre;
    if (V.esDuelo(est)) { $("vvLeyendaPaga").textContent = V.DUELO.leyendaPaga; $("vvLeyendaPlanta").textContent = V.DUELO.leyendaPlanta; }
    else {
      $("vvLeyendaPaga").textContent = reglaId === "vela" ? "La veintiuna paga seis a cinco" : "La veintiuna paga tres a dos";
      $("vvLeyendaPlanta").textContent = reglaId === "vela" ? "La casa se planta con dieciséis" : "La casa se planta con diecisiete";
    }
    $("vvPlacaEfecto").textContent = R.resumen;
    const y = est.yo || {}, usada = !!(y.regla && y.regla.usada);
    let estado;
    if (est.fase === "apuestas") estado = reglaId === "maldicion" || reglaId === "vela" ? "Activa en toda la ronda" : reglaId === "bufon" ? "Un dado al repartir" : "Cada uno la usa en su turno";
    else estado = R.estado(usada, y.acciones && y.acciones.especial && y.acciones.especial.tipo === "fortuna" ? "fortuna" : "", est.regla.evento);
    const chip = $("vvPlacaEstado");
    chip.textContent = estado;
    chip.className = "vv-placa-estado" + (usada ? " gastada" : "");
    if (cambia && !S.primerPintado && !sinMovimiento()) { placa.classList.remove("cambia"); void placa.offsetWidth; placa.classList.add("cambia"); }
  }

  /* ---------------------------------------------------------------- lo que solo ves tú: la siguiente carta (Ojo) y la oculta del crupier (Cartas marcadas) */
  function pintarVistas(est) {
    const ojo = $("vvOjo"), y = est.yo || {};
    const prox = est.fase === "jugando" && y.regla ? y.regla.proxima : null;
    if (prox) {
      const el = $("vvOjoCarta");
      if (el.dataset.k !== prox.r + "-" + prox.p) { el.innerHTML = A.cara(prox); el.dataset.k = prox.r + "-" + prox.p; }
      el.setAttribute("aria-label", "Siguiente carta de la baraja: " + A.nombreCarta(prox));
      ojo.hidden = false;
    } else { ojo.hidden = true; $("vvOjoCarta").dataset.k = ""; }
    const hole = $("vvManoCrupier").querySelector(".vv-boca-abajo");
    if (hole) {
      const v = est.fase === "jugando" ? y.vista : null, ya = hole.querySelector(".vv-vista");
      if (v && !ya) {
        const s = document.createElement("span");
        s.className = "vv-vista"; s.setAttribute("aria-hidden", "true"); s.innerHTML = A.cara(v);
        hole.querySelector(".vv-lado-dorso").after(s);
        hole.setAttribute("aria-label", "carta oculta, que solo tú ves: " + A.nombreCarta(v));
        sonar("giro");
      } else if (!v && ya) { ya.remove(); hole.setAttribute("aria-label", "carta oculta"); }
    }
  }

  /* ---------------------------------------------------------------- el crupier */
  function pintarCrupier(est, antes) {
    const c = est.crupier, duelo = V.esDuelo(est);
    $("vvLadoCrupier").classList.toggle("vva-bote-lado", duelo);
    $("vvLadoCrupier").querySelector(".vv-etiqueta-nombre").textContent = duelo ? "Bote" : "Crupier";
    $("vvCrupier").querySelector("figcaption span").textContent = duelo ? "reparte, no juega" : "crupier de la casa";
    reconciliar($("vvManoCrupier"), c.cartas, c.ocultas, "c" + est.ronda);
    const tot = $("vvTotalCrupier");
    if (duelo) {
      const hay = est.bote != null && est.fase !== "apuestas";
      tot.textContent = hay ? V.monedas(est.bote) : "";
      tot.className = "vv-total" + (hay ? "" : "");
      $("vvManoCrupier").innerHTML = hay ? `<p class="vva-bote-texto">Se lo lleva la mejor mano sin pasarse de 21.</p>` : `<p class="vva-bote-texto">Cera reparte pero no juega. Aquí se verá el bote.</p>`;
      $("vvManoCrupier").dataset.clave = "duelo";
      return;
    }
    if (!c.cartas.length) { tot.textContent = ""; tot.className = "vv-total"; return; }
    const completo = est.fase === "resultado";
    tot.textContent = completo ? textoTotal(c.total, c.blando) : `muestra ${c.total}`;
    tot.className = "vv-total" + (completo && c.total > 21 ? " pasado" : completo && c.total === 21 ? " veintiuna" : "");
  }

  /* ---------------------------------------------------------------- el pozo de cartas */
  function pintarPozo(est) {
    const el = $("vvaPozo"), p = est.pozo;
    if (!p || !p.activo) { el.hidden = true; return; }
    el.hidden = false;
    const cartas = p.cartas.map(c => `<li class="vva-pozo-carta${c.yo ? " mia" : ""}${c.abandono ? " abandono" : ""}" data-rareza="${esc(c.rareza || "")}"><strong>${esc(c.titulo || c.carta)}</strong><small>${esc(RAREZAS[c.rareza] || "")} · de ${esc(c.nombre || "alguien")}</small></li>`).join("");
    el.innerHTML = `<h3>Pozo de cartas</h3>${cartas ? `<ul>${cartas}</ul>` : ""}<p>${esc(V.frasePozo(est))}</p>`;
    el.dataset.estado = p.estado || "";
  }

  /* ---------------------------------------------------------------- los asientos */
  const COLORES = ["#7fb4d9", "#d98f9a", "#8fd0a0", "#b79fe0", "#d9a98f"];
  function elementoAsiento(n) {
    const cont = $("vvaAsientos");
    let el = cont.querySelector(`[data-asiento="${n}"]`);
    if (!el) {
      el = document.createElement("article");
      el.className = "vva-asiento";
      el.dataset.asiento = String(n);
      el.style.setProperty("--asiento", COLORES[n % COLORES.length]);
      el.innerHTML = `<header class="vva-asiento-cab"><span class="vva-nombre"></span><span class="vva-chip"></span></header>
        <div class="vv-mano vva-mano"></div>
        <footer class="vva-asiento-pie"><span class="vv-total"></span><span class="vva-apuesta"></span></footer>`;
      cont.appendChild(el);
    }
    return el;
  }
  function pintarAsientos(est) {
    const cont = $("vvaAsientos");
    const ocupados = new Set(est.asientos.map(a => a.asiento));
    cont.querySelectorAll(".vva-asiento").forEach(el => { if (el.classList.contains("vacio") || !ocupados.has(Number(el.dataset.asiento))) { if (!ocupados.has(Number(el.dataset.asiento))) el.remove(); } });
    est.asientos.forEach(a => {
      const el = elementoAsiento(a.asiento);
      el.classList.remove("vacio");
      const chip = V.chipAsiento(est, a), m = a.mano;
      el.classList.toggle("yo", !!a.yo);
      el.classList.toggle("turno", est.fase === "jugando" && est.turno === a.asiento);
      el.classList.toggle("fuera", !m && est.fase !== "apuestas");
      ["natural", "victoria", "derrota", "empate"].forEach(k => el.classList.toggle("res-" + k, est.fase === "resultado" && m && m.resultado === k));
      el.querySelector(".vva-nombre").textContent = a.nombre + (a.yo ? " (tú)" : "");
      const chipEl = el.querySelector(".vva-chip");
      chipEl.textContent = chip.texto; chipEl.dataset.tipo = chip.clase;
      const mano = el.querySelector(".vva-mano");
      // De los demás solo se ve la primera carta y cuántas llevan (boca abajo) hasta que acaba la ronda; las tuyas se ven siempre
      if (m) reconciliar(mano, m.cartas, m.oculta ? Math.max(0, (m.n || m.cartas.length) - m.cartas.length) : 0, "a" + est.ronda + "-" + a.asiento);
      else { mano.innerHTML = ""; mano.dataset.clave = ""; ajustarAbanico(mano); }
      const tot = el.querySelector(".vv-total");
      if (m && m.oculta) { tot.textContent = "?"; tot.className = "vv-total oculto"; }
      else if (m) { tot.textContent = textoTotal(m.total, m.blando); tot.className = "vv-total" + (m.total > 21 ? " pasado" : m.total === 21 ? " veintiuna" : ""); }
      else { tot.textContent = ""; tot.className = "vv-total"; }
      const ap = el.querySelector(".vva-apuesta");
      let txtAp = "";
      if (m) txtAp = m.modo === "apuesta" ? V.monedas(m.apuesta) + (Number(m.peajes) > 0 ? " + " + V.monedas(m.peajes) + " de peaje" : "") : "sin apostar";
      else if (est.fase === "apuestas" && a.yo && a.apuesta != null) txtAp = Number(a.apuesta) > 0 ? V.monedas(a.apuesta) : "sin apostar";
      if (a.con_carta) txtAp += (txtAp ? " · " : "") + "carta en el pozo";
      ap.textContent = txtAp;
      el.classList.toggle("con-carta", !!a.con_carta);
      el.setAttribute("aria-label", `${a.nombre}${a.yo ? " (tú)" : ""}: ${chip.texto}${m && !m.oculta ? `, suma ${m.total}` : m ? `, lleva ${m.n} cartas boca abajo` : ""}${a.con_carta ? ", con una carta en el pozo" : ""}`);
    });
    // los asientos libres, hasta completar la mesa
    const libres = Math.max(0, est.asientos_max - est.asientos.length);
    cont.querySelectorAll(".vva-asiento.vacio").forEach(e => e.remove());
    for (let i = 0; i < libres; i++) {
      const e = document.createElement("article");
      e.className = "vva-asiento vacio";
      e.setAttribute("aria-label", "Asiento libre");
      e.innerHTML = `<p>Asiento libre</p>`;
      cont.appendChild(e);
    }
    // el orden visual: por asiento (el tuyo primero en pantallas estrechas, con CSS)
    [...cont.querySelectorAll(".vva-asiento:not(.vacio)")].sort((x, y) => Number(x.dataset.asiento) - Number(y.dataset.asiento)).forEach(e => cont.insertBefore(e, cont.querySelector(".vva-asiento.vacio")));
  }

  /* ---------------------------------------------------------------- la barra de la mesa */
  function pintarBarra(est) {
    const enlace = `${location.origin}${location.pathname}?mesa=${est.codigo}`;
    $("vvaBarra").innerHTML = `
      <div class="vva-barra-datos">
        <h2>${esc(est.nombre)}</h2>
        <p><span class="vva-codigo" aria-label="Código de la mesa: ${esc(est.codigo.split("").join(" "))}">${esc(est.codigo)}</span>
          <button type="button" class="vv-enlace" data-copiar="${esc(enlace)}">Copiar enlace para invitar</button>
          · ${est.asientos.length} de ${est.asientos_max} asientos · ${V.esDuelo(est) ? "todos contra todos" : "contra la casa"}${est.privada ? " · privada" : ""}${est.cartas ? " · con pozo de cartas" : ""}</p>
      </div>
      <button type="button" class="vv-boton vv-boton-chico vv-boton-fantasma" data-salir>Levantarme</button>`;
  }

  /* ---------------------------------------------------------------- el reloj de cada fase (cuenta atrás con lo que dijo el servidor) */
  function segundosRestantes() {
    if (S.limite.s == null) return null;
    return Math.max(0, Math.round(S.limite.s - (performance.now() - S.limite.t0) / 1000));
  }
  function pintarReloj() {
    const s = segundosRestantes();
    document.querySelectorAll("[data-reloj]").forEach(e => { e.textContent = s == null ? "" : `${s} s`; });
  }

  /* ---------------------------------------------------------------- el dock */
  function fase(vista) { S.vista = vista; $("vvSala").dataset.fase = vista; }
  function pintarDock() {
    const act = document.activeElement;
    let foco = null;
    if (act && act.closest && act.closest("#vvDockCuerpo")) {
      const k = [...act.attributes].find(a => a.name.startsWith("data-") && a.name !== "data-motivo");
      if (k) foco = `[${k.name}${k.value ? `="${k.value}"` : ""}]`;
    }
    pintarDockSinFoco();
    if (foco) { const el = $("vvDockCuerpo").querySelector(foco); if (el && document.activeElement !== el) { try { el.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } } }
  }
  function pintarDockSinFoco() {
    const cuerpo = $("vvDockCuerpo"), dock = $("vvDock");
    const est = S.est;
    dock.dataset.fase = S.vista;
    dock.dataset.regla = est && est.regla ? est.regla.id : "";
    if (S.vista === "cargando") { cuerpo.innerHTML = `<p class="vv-dock-texto">Encendiendo las velas...</p>`; return; }
    if (S.vista === "sin_sesion") { cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>Inicia sesión para sentarte</h2><p>La mesa guarda tus tokens, tus manos y tus desafíos en tu cuenta. Pulsa «Iniciar sesión» arriba a la derecha.</p></div>`; return; }
    if (S.vista === "sin_conexion") { cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>La mesa no responde</h2><p>No hay conexión con el servidor.</p><button type="button" class="vv-boton vv-boton-principal" data-reintentar><span class="vv-boton-texto">Reintentar</span></button></div>`; return; }
    if (S.vista === "sin_servidor") {
      const admin = (() => { try { return localStorage.getItem("compendioAdmin") === "1"; } catch (e) { return false; } })();
      cuerpo.innerHTML = admin ? `<div class="vv-dock-aviso"><h2>La mesa todavía no está montada</h2><p>Falta ejecutar <code>docs/veintiuna.sql</code> en Supabase. Cuando se ejecute, recarga esta página.</p></div>` : `<div class="vv-dock-aviso"><h2>La mesa todavía no está abierta</h2><p>Las velas se están encendiendo. Vuelve en un rato.</p></div>`;
      return;
    }
    if (!est) { cuerpo.innerHTML = ""; return; }
    if (est.fase === "apuestas") pintarApuestas(cuerpo, est);
    else if (est.fase === "jugando") pintarTurno(cuerpo, est);
    else pintarResultado(cuerpo, est);
    pintarReloj();
  }

  function pintarApuestas(cuerpo, est) {
    const y = est.yo, lim = est.limites, saldo = saldoActual();
    const l = V.listosDeLaMesa(est);
    const quedan = `<span class="vva-estado-linea">Listos: <strong>${l.listos}</strong> de ${l.total}. Cuando estéis todos listos se reparte, o en <strong data-reloj></strong> desde que apuesta el primero.</span>`;
    const botonRepartir = est.soy_creador && l.listos > 0 && l.faltan > 0 ? `<button type="button" class="vv-boton" data-repartir-ya><span class="vv-boton-texto">Repartir ya</span><span class="vv-boton-sub">sin esperar a los demás</span></button>` : "";
    if (y.listo && !S.editando) {
      const a = V.asientoYo(est);
      const carta = a && a.con_carta ? (est.pozo.cartas.find(c => c.yo) || {}) : null;
      cuerpo.innerHTML = `<div class="vva-listo">
        <p class="vva-listo-texto" role="status"><strong>${y.apuesta == null ? "Pasas esta ronda" : Number(y.apuesta) > 0 ? "Apuesta de " + V.monedas(y.apuesta) : "Juegas sin apostar"}</strong>${carta ? ` · en el pozo: ${esc(carta.titulo || carta.carta)}` : ""}</p>
        ${quedan}
        <div class="vv-botones">${botonRepartir}<button type="button" class="vv-boton vv-boton-chico" data-cambiar><span class="vv-boton-texto">Cambiar</span></button></div>
      </div>`;
      return;
    }
    const sin = S.eleccion.modo === "sin";
    const fichas = V.fichasDisponibles(lim);
    const apuesta = S.eleccion.apuesta;
    const motivo = sin ? "" : V.motivoApuesta(apuesta, saldo, lim);
    const sinFondos = saldo < lim.min;
    const duelo = V.esDuelo(est);
    const nota = sin ? (duelo ? `Juegas la ronda sin apostar tokens: compites por la gloria, sin tokens en el bote.` : `Juegas la ronda sin apostar tokens: tu mano es de práctica, no cobra ni paga y no cuenta para los desafíos.`)
      : sinFondos ? `No tienes tokens para la apuesta mínima. Puedes jugar sin apostar o vender una carta al <a href="hipodromo.html#cartas" data-buhonero>Buhonero</a>.`
      : motivo && apuesta > 0 ? motivo : V.textoLimites(lim);
    const regla = V.REGLAS[est.regla.id];
    const notaDuelo = duelo ? " Todos contra todos: lo que apostáis forma el bote y se lo lleva la mejor mano. Hace falta que apuesten al menos dos jugadores." : "";
    const peajeNota = est.peajes && est.peajes[est.regla.id] != null ? ` Peaje de ${regla.nombre}: ${Math.round(est.peajes[est.regla.id] * 100)} % de la apuesta.` : "";
    const cartaElegida = S.eleccion.carta;
    cuerpo.innerHTML = `
      <div class="vv-apuesta-panel vva-apuesta-panel">
        <div class="vv-modos" role="radiogroup" aria-label="Cómo juegas esta ronda">
          <button type="button" role="radio" aria-checked="${!sin}" class="vv-modo${!sin ? " activo" : ""}" data-modo="apuesta"><strong>Con apuesta</strong><small>tokens de juego</small></button>
          <button type="button" role="radio" aria-checked="${sin}" class="vv-modo${sin ? " activo" : ""}" data-modo="sin"><strong>Sin apostar</strong><small>no cuenta para los desafíos</small></button>
        </div>
        <div class="vv-apuesta-centro">
          ${sin ? `<div class="vv-practica"><p>Tu mano será de práctica.${esc(peajeNota ? " " + peajeNota.trim() : "")}</p></div>` : `
          <div class="vv-fichas" role="group" aria-label="Fichas para apostar">
            ${fichas.map(f => { const cabe = (apuesta + f) <= Math.min(V.tope(lim), saldo); return `<button type="button" class="vv-ficha${cabe ? "" : " sin-fondos"}" data-ficha="${f}" aria-disabled="${!cabe}" aria-label="Añadir ${V.monedas(f)} a la apuesta">${A.ficha(f)}</button>`; }).join("")}
          </div>
          <div class="vv-apuesta-total">
            <button type="button" class="vv-paso" data-paso="-1" aria-label="Bajar la apuesta ${V.monedas(lim.paso)}" ${apuesta <= 0 ? 'aria-disabled="true"' : ""}>−</button>
            <div class="vv-apuesta-cifra" aria-live="polite"><small>Apuesta</small><strong>${V.monedas(apuesta)}</strong></div>
            <button type="button" class="vv-paso" data-paso="1" aria-label="Subir la apuesta ${V.monedas(lim.paso)}">+</button>
            <button type="button" class="vv-enlace" data-borrar>Quitar fichas</button>
            <button type="button" class="vv-enlace" data-todo>Todo lo que tengo</button>
          </div>`}
        </div>
        <div class="vv-apuesta-acciones">
          <button type="button" class="vv-boton vv-boton-principal" data-apostar ${(!sin && (!!motivo || apuesta <= 0)) ? 'aria-disabled="true"' : ""}><span class="vv-boton-texto">${y.listo ? "Guardar cambio" : "Listo"}</span><span class="vv-boton-sub">${sin ? "jugar sin apostar" : apuesta > 0 ? "apuesta " + V.monedas(apuesta) : "elige una apuesta"}</span></button>
          <button type="button" class="vv-boton" data-pasar><span class="vv-boton-texto">Pasar</span><span class="vv-boton-sub">mirar esta ronda</span></button>
          ${botonRepartir}
        </div>
        ${est.cartas ? `<div class="vva-carta-pozo"><span>${cartaElegida ? `Carta en el pozo: <strong>${esc(cartaElegida.nombre || cartaElegida.carta)}</strong> <small>${esc(RAREZAS[cartaElegida.rareza] || "")}</small>` : "Sin carta en el pozo"}</span>
          <button type="button" class="vv-boton vv-boton-chico" data-elegir-carta><span class="vv-boton-texto">${cartaElegida ? "Cambiar carta" : "Poner una carta"}</span></button>
          ${cartaElegida ? `<button type="button" class="vv-enlace" data-quitar-carta>Quitarla</button>` : ""}</div>` : ""}
        <p class="vv-nota-apuesta${motivo && apuesta > 0 && !sin ? " mal" : ""}">${sin || sinFondos ? nota : esc(nota)}${sin ? "" : esc(peajeNota)}${esc(notaDuelo)} ${quedan}</p>
        ${y.aviso ? `<p class="vv-nota-aviso" role="status">${esc(y.aviso)}</p>` : ""}
      </div>`;
  }

  function pintarTurno(cuerpo, est) {
    const y = est.yo || {}, mia = V.manoComoPropia(est);
    if (y.tu_turno && mia) {
      const plan = V.acciones(mia);
      const fortuna = plan.fase === "fortuna";
      cuerpo.innerHTML = `
        <div class="vv-acciones${fortuna ? " vv-acciones-fortuna" : ""}">
          <p class="vva-estado-linea" role="status"><strong>Tu turno.</strong> Te quedan <strong data-reloj></strong>; si no juegas, te plantas solo.</p>
          ${fortuna ? `<p class="vv-acciones-aviso" id="vvAvisoFortuna"><strong>Te pasaste de 21.</strong> La Fortuna puede convertir esa última carta en un as de valor 1, pero cobra su peaje.</p>` : ""}
          <div class="vv-botones">
            ${plan.botones.map(b => `<button type="button" class="vv-boton${b.principal ? " vv-boton-principal" : ""}${b.especial ? " vv-boton-especial" : ""}${b.id === "aceptar" ? " vv-boton-fantasma" : ""}" data-accion="${b.id}" aria-disabled="${!b.habilitado}"${b.motivo ? ` data-motivo="${esc(b.motivo)}"` : ""} aria-keyshortcuts="${b.tecla}">
              <span class="vv-boton-texto">${esc(b.texto)}</span>${b.sub ? `<span class="vv-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}
          </div>
        </div>`;
      return;
    }
    const turno = est.asientos.find(a => a.asiento === est.turno);
    let msg;
    if (!mia) msg = `Estás mirando esta ronda. Apuestas en la siguiente.`;
    else if (mia.estado === "terminada") msg = `Tu mano ya terminó. Mira cómo juegan los demás.`;
    else if (mia.fase === "plantada") msg = `Te plantaste con ${mia.jugador.total}. Espera a que acaben los demás y juegue el crupier.`;
    else msg = `Todavía no te toca.`;
    cuerpo.innerHTML = `<p class="vv-dock-texto vva-espera" role="status">${turno ? `Juega <strong>${esc(turno.nombre)}</strong> (<span data-reloj></span>). ` : ""}${esc(msg)}</p>`;
  }

  function pintarResultado(cuerpo, est) {
    const mia = V.manoComoPropia(est), a = V.asientoYo(est);
    let resumen = "No jugaste esta ronda.";
    if (mia && est.yo.resultado) {
      const r = V.resultado({ resultado: est.yo.resultado, modo: est.yo.modo });
      if (r) resumen = `${r.titulo}. ${r.razon} ${r.linea}`;
    }
    cuerpo.innerHTML = `<div class="vv-fin"><div class="vv-fin-resumen"><strong>${a && a.mano ? esc(V.chipAsiento(est, a).texto) : "Ronda terminada"}</strong><span>${esc(resumen)}</span></div>
      <div class="vva-siguiente">Siguiente ronda en <strong data-reloj></strong></div></div>`;
  }

  /* ---------------------------------------------------------------- el lobby de mesas */
  function pintarLobby() {
    const el = $("vvaLobby");
    const lista = S.lista || [];
    const filas = lista.map(m => `<li class="vva-mesa-fila"><div><strong>${esc(m.nombre)}</strong><span>${esc(m.jugadores.join(", "))} · ${m.jugadores.length} de ${m.asientos_max} · ${m.modo === "duelo" ? "todos contra todos" : "contra la casa"}${m.cartas ? " · pozo de cartas" : ""} · ${esc(V.FASES_AMIGOS[m.fase] || "")}</span></div>
      <button type="button" class="vv-boton vv-boton-chico" data-unirse="${esc(m.codigo)}" ${m.jugadores.length >= m.asientos_max ? 'aria-disabled="true"' : ""}><span class="vv-boton-texto">${m.jugadores.length >= m.asientos_max ? "Llena" : "Sentarme"}</span></button></li>`).join("");
    const previo = { nombre: ($("vvaNombre") || {}).value || "", codigo: ($("vvaCodigo") || {}).value || "", priv: $("vvaPrivada") ? $("vvaPrivada").checked : true, modo: (document.querySelector('input[name="vvaModo"]:checked') || {}).value || "casa", cartas: $("vvaConCartas") ? $("vvaConCartas").checked : false };
    el.innerHTML = `
      <div class="vva-lobby-intro">
        <h2>Sentaos juntos a la mesa</h2>
        <p>Hasta cinco jugadores, una sola crupier y una regla especial por ronda para todos. Cada uno apuesta sus tokens, juega su turno y cobra o paga contra la casa. Si queréis más tensión, jugad con un pozo de cartas.</p>
      </div>
      <div class="vva-lobby-grid">
        <section class="vva-tarjeta" aria-labelledby="vvaH1">
          <h3 id="vvaH1">Mesas abiertas</h3>
          ${filas ? `<ul class="vva-mesas">${filas}</ul>` : `<p class="vva-vacio">No hay mesas abiertas ahora mismo. Crea una y pasa el código a tus amigos.</p>`}
        </section>
        <section class="vva-tarjeta" aria-labelledby="vvaH2">
          <h3 id="vvaH2">Crear una mesa</h3>
          <form id="vvaFormCrear" class="vva-form">
            <label>Nombre <input id="vvaNombre" type="text" maxlength="30" autocomplete="off" placeholder="Mesa de la taberna" value="${esc(previo.nombre)}"></label>
            <fieldset class="vva-modos" id="vvaModos"><legend>Modo de la mesa</legend>
              <label class="vva-check"><input type="radio" name="vvaModo" value="casa" ${previo.modo === "duelo" ? "" : "checked"}> <span><strong>Contra la casa.</strong> Todos jugáis contra la crupier, cada uno con su apuesta.</span></label>
              <label class="vva-check"><input type="radio" name="vvaModo" value="duelo" ${previo.modo === "duelo" ? "checked" : ""}> <span><strong>Todos contra todos.</strong> Sin crupier: lo apostado forma un bote y se lo lleva la mejor mano.</span></label>
            </fieldset>
            <label class="vva-check"><input id="vvaPrivada" type="checkbox" ${previo.priv ? "checked" : ""}> Privada: solo entra quien tenga el código</label>
            <label class="vva-check"><input id="vvaConCartas" type="checkbox" ${previo.cartas ? "checked" : ""}> Con pozo de cartas: cada uno puede poner una carta y el mejor se lleva todas</label>
            <button type="submit" class="vv-boton vv-boton-principal"><span class="vv-boton-texto">Crear y sentarme</span></button>
          </form>
        </section>
        <section class="vva-tarjeta" aria-labelledby="vvaH3">
          <h3 id="vvaH3">Entrar con un código</h3>
          <form id="vvaFormEntrar" class="vva-form">
            <label>Código de la mesa <input id="vvaCodigo" type="text" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="${esc(previo.codigo)}"></label>
            <button type="submit" class="vv-boton"><span class="vv-boton-texto">Entrar</span></button>
          </form>
        </section>
      </div>`;
  }

  /* ---------------------------------------------------------------- vistas */
  function mostrar(vista) {
    fase(vista);
    $("vvaLobby").hidden = vista !== "lobby";
    $("vvaMesa").hidden = vista !== "mesa";
    $("vvDock").hidden = vista === "lobby";
    const dentro = ["cargando", "sin_sesion", "sin_conexion", "sin_servidor"].includes(vista);
    if (dentro) { $("vvaMesa").hidden = false; $("vvaMesa").classList.add("vva-sin-mesa"); $("vvaBarra").innerHTML = ""; $("vvFieltro").hidden = true; $("vvDock").hidden = false; }
    else { $("vvaMesa").classList.remove("vva-sin-mesa"); $("vvFieltro").hidden = false; }
    document.querySelector(".vv-madera").hidden = dentro;
    if (vista === "mesa") $("vvaMesa").hidden = false;
    pintarDock();
  }
  function irALobby() {
    clearTimeout(S.sondeo);
    S.est = null; S.version = null; S.editando = false; S.primerPintado = true; S.pintadoRonda = 0;
    S.eleccion.carta = null;
    $("vvaAsientos").innerHTML = ""; $("vvManoCrupier").innerHTML = ""; $("vvManoCrupier").dataset.clave = ""; $("vvOjo").hidden = true;
    mostrar("lobby");
    pintarLobby();
    programar(300);
  }
  function entrarEnMesa() {
    S.primerPintado = true;
    mostrar("mesa");
  }

  /* ---------------------------------------------------------------- pintar la mesa entera */
  function pintarMesa(est, antes) {
    const cambioMesa = !antes || antes.codigo !== est.codigo;
    if (cambioMesa) { S.primerPintado = true; S.resultadoVisto = 0; S.logrosVistos = new Set(); S.editando = false; }
    if (!antes || antes.ronda !== est.ronda) {
      S.editando = false;
      if (est.fase === "apuestas") { S.eleccion.carta = null; S.eleccion.apuesta = V.ajustarApuesta(S.eleccion.apuesta, Number(est.yo.saldo), est.limites); }
    }
    pintarBarra(est);
    pintarPlaca(est);
    pintarCrupier(est, antes);
    pintarPozo(est);
    pintarAsientos(est);
    pintarVistas(est);
    pintarSaldo(est.yo.saldo);
    crupierEstado(est.fase === "jugando" ? "crupier" : est.fase === "resultado" ? "reparto" : "espera");
    pintarDock();
    ajustarVolumen();
    if (antes && antes.codigo === est.codigo) avisosDeCambios(antes, est);
    const texto = V.anuncioAmigos(cambioMesa ? null : antes, est);
    if (texto) leer(texto);
    S.primerPintado = false;
  }

  // Sonidos, dichos y tostadas de lo que cambió entre dos estados
  function avisosDeCambios(antes, est) {
    if (est.fase === "jugando" && est.yo.tu_turno && !(antes.fase === "jugando" && antes.yo.tu_turno)) { sonar("turno"); tostada("Es tu turno.", { icono: "🕯", ms: 2500 }); }
    if (est.fase === "jugando" && antes.fase !== "jugando") decir("reparto", 0.6);
    if (est.fase === "resultado" && antes.fase !== "resultado") {
      const a = V.asientoYo(est);
      if (a && a.mano && S.resultadoVisto !== est.ronda) {
        S.resultadoVisto = est.ronda;
        const r = V.resultado({ resultado: est.yo.resultado, modo: est.yo.modo });
        if (r) {
          sonar(r.tipo === "natural" ? "natural" : r.gano ? "gana" : r.empate ? "empate" : "pierde");
          tostada(`${r.titulo}. ${r.linea}`, { icono: r.gano ? "✦" : r.empate ? "=" : "·", clase: r.gano ? "oro" : "", ms: 5000 });
        }
      }
      const p = est.pozo;
      if (p && p.cartas.length && p.estado === "pagado") {
        const mio = p.cartas.some(c => c.yo);
        tostada(V.frasePozo(est), { icono: "🂠", clase: "oro", ms: 8000 });
        if (mio) sonar("ficha");
      }
    }
    // desafíos que se completaron con esta mano
    const nuevos = (est.yo.logros_nuevos || []).filter(id => !S.logrosVistos.has(est.ronda + id));
    nuevos.forEach(id => { S.logrosVistos.add(est.ronda + id); tostada("Has completado un desafío. Reclama tu carta desde la mesa individual.", { icono: "✦", clase: "oro", accion: "Ver desafíos", href: "veintiuna.html#desafios", ms: 9000 }); });
    if (est.yo.aviso && est.yo.aviso !== (antes.yo || {}).aviso) tostada(est.yo.aviso, { icono: "!" });
  }

  /* ---------------------------------------------------------------- llamadas */
  function manejarError(e, opciones) {
    const o = opciones || {};
    const info = e && e.tipo ? e : { tipo: "servidor", mensaje: String((e && e.message) || e || ""), codigo: "" };
    if (info.codigo === "sin_servidor" || /does not exist|Could not find the function|schema cache|PGRST202/i.test(info.mensaje || "")) { mostrar("sin_servidor"); aviso(""); return; }
    if (info.tipo === "red") {
      S.ocupado = false;
      aviso(V.mensajeError(info).replace("Tu mano está a salvo en el servidor: pulsa Reintentar.", "Tu sitio en la mesa sigue guardado en el servidor."), { tipo: "error", reintentar: true });
      S.reintento = o.alReintentar || null;
      return;
    }
    aviso(V.mensajeError(info), { tipo: "error", cerrar: true });
    if (["no_es_tu_turno", "fase_invalida", "paso_futuro", "sin_mesa"].includes(info.codigo)) refrescar();
    if (info.codigo === "sin_sesion") { S.sesion = null; mostrar("sin_sesion"); }
  }
  async function ejecutar(fn) {
    if (S.ocupado) return null;
    S.ocupado = true; document.body.classList.add("vv-ocupado");
    try { return await fn(); }
    finally { S.ocupado = false; document.body.classList.remove("vv-ocupado"); }
  }
  function aplicar(r) {
    if (!r) return;
    if (r.sin_mesa) {
      if (S.vista === "mesa" || S.est) {
        tostada(r.levantado ? "Te levantaron de la mesa: llevabas mucho rato sin dar señales." : "Ya no estás sentado en la mesa.", { icono: "!" });
      }
      irALobby();
      return;
    }
    if (r.sin_cambios) { S.limite = { t0: performance.now(), s: r.restante_s }; pintarReloj(); return; }
    const antes = S.est;
    S.est = r; S.version = r.version;
    S.limite = { t0: performance.now(), s: r.restante_s };
    if (S.vista !== "mesa") entrarEnMesa();
    pintarMesa(r, antes);
    aviso("");
  }
  async function refrescar() {
    try { aplicar(await api.amigos.estado(null)); } catch (e) { manejarError(e, { alReintentar: refrescar }); }
  }
  async function cargarLista() {
    const r = await api.amigos.lista();
    S.lista = r.mesas || [];
    if (r.saldo != null) pintarSaldo(r.saldo);
    if (r.sentado && S.vista === "lobby") { await refrescar(); return; }
    if (S.vista === "lobby") pintarListaSinPerderForm();
  }
  // Refresca solo la lista de mesas sin tocar lo que estés escribiendo en los formularios
  function pintarListaSinPerderForm() {
    const act = document.activeElement;
    if (act && act.closest && act.closest(".vva-form")) return;
    pintarLobby();
  }
  function programar(ms) { clearTimeout(S.sondeo); S.sondeo = setTimeout(sondear, ms); }
  async function sondear() {
    if (S.vista === "mesa") {
      if (!S.ocupado) {
        try { aplicar(await api.amigos.estado(S.version)); S.reintento = null; }
        catch (e) { if (e && e.tipo === "red") { /* un corte: se reintenta solo */ } else manejarError(e); }
      }
      programar(document.hidden ? SONDEO_FONDO_MS : SONDEO_MS);
    } else if (S.vista === "lobby") {
      if (!S.ocupado) { try { await cargarLista(); } catch (e) { if (!(e && e.tipo === "red")) manejarError(e); } }
      programar(document.hidden ? SONDEO_FONDO_MS : LISTA_MS);
    }
  }

  async function crearMesa(nombre, privada, cartas, modo) {
    const r = await ejecutar(async () => { try { return await api.amigos.crear(nombre, privada, cartas, modo); } catch (e) { manejarError(e); return null; } });
    if (r) { S.est = null; aplicar(r); programar(SONDEO_MS); }
  }
  async function unirse(codigo) {
    const r = await ejecutar(async () => { try { return await api.amigos.unirse(codigo); } catch (e) { manejarError(e); return null; } });
    if (r) { S.est = null; aplicar(r); programar(SONDEO_MS); }
  }
  async function salir() {
    const r = await ejecutar(async () => { try { return await api.amigos.salir(); } catch (e) { manejarError(e); return null; } });
    if (r) { irALobby(); }
  }
  async function apostar() {
    const sin = S.eleccion.modo === "sin", est = S.est;
    if (!sin) {
      const motivo = V.motivoApuesta(S.eleccion.apuesta, saldoActual(), est.limites);
      if (motivo || S.eleccion.apuesta <= 0) { aviso(motivo || "Elige una apuesta con las fichas.", { tipo: "info", cerrar: true }); return; }
    }
    const importe = sin ? 0 : S.eleccion.apuesta;
    const carta = est.cartas && S.eleccion.carta ? S.eleccion.carta.ejemplar : null;
    const r = await ejecutar(async () => { try { return await api.amigos.apostar(importe, carta); } catch (e) { manejarError(e, { alReintentar: apostar }); return null; } });
    if (r) { if (!sin) guardado.poner("vvaApuesta", importe); S.editando = false; sonar("ficha"); aviso(""); aplicar(r); }
  }
  async function pasar() {
    const r = await ejecutar(async () => { try { return await api.amigos.pasar(); } catch (e) { manejarError(e); return null; } });
    if (r) { S.editando = false; aplicar(r); }
  }
  async function repartirYa() {
    const r = await ejecutar(async () => { try { return await api.amigos.repartir(); } catch (e) { manejarError(e); return null; } });
    if (r) aplicar(r);
  }
  async function hacer(accion) {
    const est = S.est;
    if (!est || !est.yo || !est.yo.tu_turno) return;
    const paso = est.yo.paso;
    const r = await ejecutar(async () => { try { return await api.amigos.accion(paso, accion); } catch (e) { manejarError(e, { alReintentar: () => hacer(accion) }); return null; } });
    if (r) { aviso(""); aplicar(r); }
  }
  function intentarAccion(id) {
    if (S.ocupado || !S.est) return;
    const mia = V.manoComoPropia(S.est);
    if (!mia || !S.est.yo.tu_turno) return;
    const b = (V.acciones(mia).botones || []).find(x => x.id === id);
    if (!b) return;
    if (!b.habilitado) { aviso(b.motivo || "Esa acción no está disponible ahora.", { tipo: "info", cerrar: true }); return; }
    hacer(id);
  }

  /* ---------------------------------------------------------------- elegir la carta del pozo */
  async function abrirCartas() {
    abrir($("vvDlgCartas"), `${cabeceraDlg("vvDlgCartasT", "Una carta para el pozo")}<div class="vv-dlg-cuerpo"><p>Buscando tus cartas...</p></div>`);
    let cartas;
    try { cartas = await api.amigos.misCartas(); } catch (e) { manejarError(e); $("vvDlgCartas").close(); return; }
    S.misCartas = cartas || [];
    const otras = (S.est.pozo.cartas || []).filter(c => !c.yo);
    const cuerpo = !S.misCartas.length ? `<p>No tienes cartas libres para poner en el pozo.</p>` : `
      <p>Si ganas a la casa con la mejor mano de entre quienes pusieron carta, te llevas <strong>todas</strong> las del pozo. Si pierdes, tu carta pasa al ganador. Las cartas de un mismo pozo no pueden diferir en más de una categoría de rareza.${otras.length ? ` Ahora hay: ${esc(otras.map(c => (c.titulo || c.carta) + " (" + (RAREZAS[c.rareza] || "") + ")").join(", "))}.` : ""}</p>
      <ul class="vva-cartas-lista" role="radiogroup" aria-label="Tus cartas libres">
        ${S.misCartas.map(c => `<li><button type="button" role="radio" aria-checked="${S.eleccion.carta && S.eleccion.carta.ejemplar === c.ejemplar}" data-carta="${esc(c.ejemplar)}"><strong>${esc(c.nombre || c.carta)}</strong><small>${esc(RAREZAS[c.rareza] || c.rareza)}${c.numero ? " · n.º " + c.numero : ""}</small></button></li>`).join("")}
      </ul>`;
    abrir($("vvDlgCartas"), `${cabeceraDlg("vvDlgCartasT", "Una carta para el pozo")}<div class="vv-dlg-cuerpo">${cuerpo}</div>`);
  }

  /* ---------------------------------------------------------------- reglas */
  function abrirReglas(foco) {
    const est = S.est;
    const por = { fortuna: 60, voluntad: 50, ojo: 35, marcadas: 18, trueque: 100 };
    const peajeDe = id => (est && est.peajes && est.peajes[id] != null ? Math.round(est.peajes[id] * 100) : por[id]) + " % de la apuesta";
    const reglas = V.ORDEN_REGLAS.map(id => {
      const R = V.REGLAS[id];
      return `<article class="vv-regla-ficha" data-regla="${id}" id="vvRegla-${id}"><div class="vv-regla-icono" aria-hidden="true">${A.ICONOS[id]}</div><div><h3>${esc(R.nombre)}</h3><p class="vv-regla-lema">${esc(R.lema)}</p><ul>${R.detalle(peajeDe(id)).map(l => `<li>${esc(l)}</li>`).join("")}</ul></div></article>`;
    }).join("");
    abrir($("vvDlgReglas"), `${cabeceraDlg("vvDlgReglasT", "Cómo se juega con amigos", "Blackjack contra la casa, una regla especial por ronda")}
      <div class="vv-dlg-cuerpo">
        <section><h3>La mesa</h3><ul>
          <li>Hasta ${est ? est.asientos_max : 5} asientos y una sola crupier. La baraja es doble y se baraja de nuevo en cada ronda.</li>
          <li><strong>Contra la casa</strong> (el modo normal): todos juegan contra la crupier, no entre sí. Cada uno apuesta sus propios tokens y cobra o paga solo por su mano.</li>
          <li><strong>Todos contra todos</strong>: no hay crupier que juegue. ${esc(V.DUELO.reglaApuestas)} Quién juega primero rota cada ronda. En este modo solo se sortean las reglas que no necesitan crupier (Fortuna, Maldición, Última voluntad, Ojo del Tahúr y Pacto del Bufón).</li>
          <li>Una ronda: <strong>apuestas</strong> (empieza el reparto cuando todos están listos, o 45 s después de que apueste el primero), <strong>turnos</strong> por asiento (45 s cada uno: si no juegas te plantas solo), el crupier juega y se enseña el <strong>resultado</strong>.</li>
          <li>No hay apuesta máxima: puedes apostar todo lo que tengas, de 10 en 10.</li>
          <li>Las reglas del blackjack son las de la mesa individual: el crupier se planta con 17 (también blando), el natural paga 3 a 2 y no hay dividir, doblar, seguro ni rendición.</li>
          <li>Las cartas de los demás están <strong>boca abajo</strong> (solo ves la primera de cada uno y cuántas llevan) hasta que acaba la ronda y se enseña quién gana y quién pierde. Las tuyas las ves siempre. La carta oculta del crupier y la baraja las guarda el servidor: nadie las ve hasta que toca.</li>
          <li>Si te levantas a mitad de ronda pierdes tu mano. Quien deja pasar dos turnos seguidos sin jugar, o lleva más de dos minutos y medio sin dar señales, se levanta de la mesa.</li>
          <li>Puedes jugar la ronda <strong>sin apostar</strong>: tu mano no cobra ni paga y no cuenta para los desafíos. Las apuestas con tokens sí cuentan.</li>
        </ul></section>
        <section><h3>El pozo de cartas</h3><ul>
          <li>Solo en las mesas creadas «con pozo de cartas». Antes de repartir, cada jugador puede poner <strong>una</strong> carta suya. Se bloquea hasta que acabe la ronda.</li>
          <li>Para que haya pozo tienen que poner carta al menos dos jugadores. Si no, las cartas vuelven a su dueño.</li>
          <li>Las cartas del pozo no pueden diferir en más de una categoría de rareza. Hay un máximo diario de veces que se puede poner una carta.</li>
          <li>Al acabar la ronda, entre quienes pusieron carta y <strong>ganaron a la casa</strong> (en «todos contra todos»: que no se pasaron), se lleva todo el pozo el de mejor mano: un blackjack natural vale más que cualquier total y, después, gana el total más alto.</li>
          <li>Si empatan arriba o nadie ganó a la casa, cada carta vuelve a su dueño. Si te levantas a mitad de ronda no puedes ganar el pozo, pero tu carta sigue en juego.</li>
          <li>Nunca se crean ni se destruyen cartas. Si al ganador ya no le cabe una carta (límite por jugador), esa carta vuelve a su dueño.</li>
        </ul></section>
        <section><h3>Las ocho reglas especiales</h3><p>Cada ronda trae una para toda la mesa y se enseña antes de apostar. Cada jugador usa su acción (peaje incluido) en su turno.</p><div class="vv-reglas-lista">${reglas}</div></section>
      </div>`);
    if (foco) { const el = $("vvRegla-" + foco); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("destacada"); } }
  }
  function abrirAtajos() {
    abrir($("vvDlgAtajos"), `${cabeceraDlg("vvDlgAtajosT", "Atajos de teclado")}
      <div class="vv-dlg-cuerpo"><table class="vv-tabla"><tbody>
        <tr><td><kbd>P</kbd></td><td>Pedir carta (en tu turno)</td></tr><tr><td><kbd>L</kbd></td><td>Plantarse</td></tr>
        <tr><td><kbd>V</kbd></td><td>La acción de la regla de la ronda, o salvar la mano con la Fortuna</td></tr><tr><td><kbd>A</kbd></td><td>Aceptar la derrota (cuando la Fortuna te lo ofrece)</td></tr>
        <tr><td><kbd>Intro</kbd></td><td>Confirmar tu apuesta cuando estás eligiendo</td></tr></tbody></table>
      <p>Todos los botones también se manejan con Tab e Intro.</p></div>`);
  }

  /* ---------------------------------------------------------------- eventos */
  function alClic(ev) {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if ("reintentar" in t.dataset) { const f = S.reintento; aviso(""); if (f) f(); else sondear(); return; }
    if (t.dataset.unirse) { if (t.getAttribute("aria-disabled") !== "true") unirse(t.dataset.unirse); return; }
    if ("salir" in t.dataset) { salir(); return; }
    if (t.dataset.copiar) { copiar(t.dataset.copiar); return; }
    if (t.dataset.modo) { S.eleccion.modo = t.dataset.modo; pintarDock(); return; }
    if (t.dataset.ficha) {
      const f = Number(t.dataset.ficha), lim = S.est.limites, saldo = saldoActual();
      if (S.eleccion.apuesta + f > Math.min(V.tope(lim), saldo)) { aviso(S.eleccion.apuesta + f > V.tope(lim) ? `La apuesta máxima es ${V.monedas(lim.max)}.` : `No te alcanzan los tokens: tienes ${V.monedas(saldo)}.`, { tipo: "info", cerrar: true }); return; }
      S.eleccion.apuesta += f; sonar("ficha"); aviso(""); pintarDock();
      const f2 = $("vvDockCuerpo").querySelector(`[data-ficha="${f}"]`); if (f2) f2.focus({ preventScroll: true }); return;
    }
    if (t.dataset.paso) {
      const lim = S.est.limites, nueva = S.eleccion.apuesta + Number(t.dataset.paso) * lim.paso;
      S.eleccion.apuesta = Math.max(0, Math.min(nueva, Math.min(V.tope(lim), Math.floor(saldoActual() / lim.paso) * lim.paso)));
      sonar("ficha"); pintarDock();
      const p = $("vvDockCuerpo").querySelector(`[data-paso="${t.dataset.paso}"]`); if (p) p.focus({ preventScroll: true }); return;
    }
    if ("borrar" in t.dataset) { S.eleccion.apuesta = 0; aviso(""); pintarDock(); return; }
    if ("todo" in t.dataset) { S.eleccion.apuesta = V.ajustarApuesta(Infinity, saldoActual(), S.est.limites); sonar("ficha"); aviso(""); pintarDock(); const f2 = $("vvDockCuerpo").querySelector("[data-todo]"); if (f2) f2.focus({ preventScroll: true }); return; }
    if ("apostar" in t.dataset) { if (t.getAttribute("aria-disabled") === "true") { const m = V.motivoApuesta(S.eleccion.apuesta, saldoActual(), S.est.limites); aviso(S.eleccion.apuesta <= 0 ? "Elige una apuesta con las fichas." : m, { tipo: "info", cerrar: true }); return; } apostar(); return; }
    if ("pasar" in t.dataset) { pasar(); return; }
    if ("cambiar" in t.dataset) { S.editando = true; if (S.est.yo.apuesta != null) { S.eleccion.modo = Number(S.est.yo.apuesta) > 0 ? "apuesta" : "sin"; if (Number(S.est.yo.apuesta) > 0) S.eleccion.apuesta = Number(S.est.yo.apuesta); } pintarDock(); return; }
    if ("repartirYa" in t.dataset) { repartirYa(); return; }
    if ("elegirCarta" in t.dataset) { abrirCartas(); return; }
    if ("quitarCarta" in t.dataset) { S.eleccion.carta = null; pintarDock(); return; }
    if (t.dataset.carta) {
      const c = (S.misCartas || []).find(x => x.ejemplar === t.dataset.carta);
      if (c) { S.eleccion.carta = c; $("vvDlgCartas").close(); pintarDock(); sonar("ficha"); }
      return;
    }
    if (t.dataset.accion) { intentarAccion(t.dataset.accion); }
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); tostada("Enlace copiado: quien lo abra entra directo en tu mesa.", { icono: "✓", ms: 3500 }); }
    catch (e) { aviso("No pude copiar el enlace. Pásales el código a mano.", { tipo: "info", cerrar: true }); }
  }
  function alTeclear(ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    const t = ev.target;
    if (t && (t.matches("input, textarea, select") || t.isContentEditable)) return;
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    const est = S.est;
    if (!est) return;
    if (est.fase === "jugando" && est.yo.tu_turno) {
      const mia = V.manoComoPropia(est);
      const b = mia ? V.acciones(mia).botones.find(x => x.tecla === k) : null;
      if (b) { ev.preventDefault(); intentarAccion(b.id); }
    } else if (est.fase === "apuestas" && k === "Enter" && (!t || !t.matches("button, a")) && (!est.yo.listo || S.editando)) {
      ev.preventDefault(); apostar();
    }
  }
  function ajustarVolumen() {
    const dock = $("vvDock");
    const pegado = window.matchMedia("(max-width: 720px)").matches && dock && !dock.hidden;
    document.body.style.setProperty("--vv-dock-h", pegado ? Math.ceil(dock.getBoundingClientRect().height) + "px" : "0px");
  }
  function pintarSonidoBoton() {
    const b = $("vvBtnSonido");
    b.setAttribute("aria-pressed", String(S.efectos));
    $("vvSonidoIcono").textContent = S.efectos ? "♪" : "–";
    b.classList.toggle("apagado", !S.efectos);
  }
  function montarArte() {
    document.body.insertAdjacentHTML("afterbegin", A.sprite());
    $("vvEmblema").innerHTML = A.emblema();
    $("vvTapete").innerHTML = A.tapete();
    $("vvCrupierArte").innerHTML = A.crupier();
    $("vvZapato").innerHTML = `<span class="vv-zapato-lomo"></span><span class="vv-zapato-carta">${A.dorso()}</span><span class="vv-zapato-carta">${A.dorso()}</span>`;
  }

  /* ---------------------------------------------------------------- arranque */
  async function iniciar() {
    montarArte();
    pintarSonidoBoton();
    document.addEventListener("click", alClic);
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("submit", ev => {
      if (ev.target.id === "vvaFormCrear") { ev.preventDefault(); crearMesa($("vvaNombre").value, $("vvaPrivada").checked, $("vvaConCartas").checked, (document.querySelector('input[name="vvaModo"]:checked') || {}).value); }
      if (ev.target.id === "vvaFormEntrar") { ev.preventDefault(); const c = $("vvaCodigo").value.trim(); if (c) unirse(c); }
    });
    document.addEventListener("input", ev => { if (ev.target.id === "vvaCodigo") ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    $("vvAviso").addEventListener("click", ev => {
      if (ev.target.id === "vvReintentar") { const f = S.reintento; aviso(""); if (f) f(); else sondear(); }
      if (ev.target.id === "vvAvisoCerrar") aviso("");
    });
    $("vvBtnReglas").addEventListener("click", () => abrirReglas());
    window.VeintiunaBuhonero.iniciar({ abrir, cabecera: cabeceraDlg, dlg: $("vvDlgBuhonero"), supa: () => fichasCliente(), yo: () => S.sesion.user.id, alCambiar: saldo => pintarSaldo(saldo) });
    // al cerrar al Buhonero, el panel de la apuesta cuenta con los tokens nuevos
    $("vvDlgBuhonero").addEventListener("close", () => { try { pintarDockSinFoco(); } catch (e) { /* se pinta en el siguiente sondeo */ } });
    $("vvPlacaMas").addEventListener("click", () => abrirReglas($("vvPlaca").dataset.regla));
    $("vvAtajosBtn").addEventListener("click", abrirAtajos);
    $("vvBtnSonido").addEventListener("click", () => { S.efectos = !S.efectos; guardado.poner("vvEfectos", S.efectos ? "1" : "0"); pintarSonidoBoton(); if (S.efectos) sonar("ficha"); });
    window.addEventListener("resize", ajustarVolumen);
    window.addEventListener("online", () => { aviso("Volvió la conexión.", { tipo: "info", cerrar: true }); sondear(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sondear(); });
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
  async function arrancarConSesion() {
    try {
      const r = await api.amigos.estado(null);
      if (r && !r.sin_mesa) { aplicar(r); programar(SONDEO_MS); return; }
      S.lista = []; irALobby();
      // un enlace de invitación: veintiuna-amigos.html?mesa=ABCDE
      const codigo = (new URLSearchParams(location.search).get("mesa") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
      if (codigo.length === 5) { history.replaceState(null, "", location.pathname); await unirse(codigo); }
    } catch (e) { manejarError(e, { alReintentar: arrancarConSesion }); if (!e || e.tipo === "red") mostrar("sin_conexion"); }
  }
  const finCarga = () => { try { if (window.Carga && window.Carga.listo) window.Carga.listo(); } catch (e) { /* sin aviso de carga */ } };

  window.VeintiunaAmigos = { estado: S, abrirReglas };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
