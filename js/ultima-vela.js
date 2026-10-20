/* =============================================================================
   LA ÚLTIMA VELA (ultima-vela.html): el reto de Muerte Súbita contra Cera
   El servidor (docs/veintiuna-reto.sql) baraja, reparte, juega el turno de Cera, cuenta las manos y cierra el intento de Muerte Súbita. Esta página pregunta
   cómo va el reto y lo pinta; lo que haces (repartir, pedir, plantarte) se manda con el número de paso, así que repetirlo por un corte de red es seguro, y
   recargar la página devuelve la partida exactamente donde estaba. Nunca se calcula aquí un resultado.
   Piezas: veintiuna-arte.js (dibujos), ultima-vela-vista.js (textos y botones), veintiuna-api.js (red).
============================================================================= */
(function () {
  const A = window.VeintiunaArte, U = window.UltimaVelaVista;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const api = window.VeintiunaApi.crear(() => fichasCliente());
  const reducir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const sinMovimiento = () => reducir.matches;
  const guardado = {
    leer(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    poner(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const idIntento = new URLSearchParams(location.search).get("i");

  const S = {
    sesion: null,
    est: null,             // lo último que dijo el servidor
    ocupado: false,
    reintento: null,
    efectos: guardado.leer("vvEfectos", "1") !== "0",
    primerPintado: true,
    finAnunciado: false
  };

  /* ---------------------------------------------------------------- movimiento y sonidos */
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
      gana() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.28, "sine", 0.1, i * 0.09)); },
      pierde() { tono(233, 0.4, "sawtooth", 0.05); tono(175, 0.55, "sawtooth", 0.05, 0.2); },
      empate() { tono(440, 0.22, "sine", 0.08); tono(440, 0.22, "sine", 0.08, 0.2); },
      final() { [392, 330, 262, 196].forEach((f, i) => tono(f, 0.5, "triangle", 0.07, i * 0.22)); }
    };
  })();
  const sonar = nombre => { try { Sonido[nombre](); } catch (e) { /* sin audio */ } };

  /* ---------------------------------------------------------------- avisos y diálogos */
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
    el.innerHTML = `<span>${esc(texto)}</span>${o.reintentar ? `<button type="button" class="vv-boton-mini" data-reintentar>Reintentar</button>` : ""}${o.cerrar ? `<button type="button" class="vv-boton-mini" data-cerrar-aviso aria-label="Cerrar el aviso">×</button>` : ""}`;
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
  const cabeceraDlg = (id, titulo, sub) => `<header class="vv-dlg-cab"><div><p class="eyebrow">MUERTE SÚBITA</p><h2 id="${id}">${esc(titulo)}</h2>${sub ? `<p class="vv-dlg-sub">${esc(sub)}</p>` : ""}</div><button type="button" class="vv-cerrar" data-cerrar aria-label="Cerrar">×</button></header>`;

  function abrirReglas() {
    abrir($("vvDlgReglas"), `${cabeceraDlg("vvDlgReglasT", "Cómo es el reto", "Blackjack contra Cera, a tres de cinco manos")}
      <div class="vv-dlg-cuerpo"><ul class="uv-reglas-lista">${U.REGLAS.map(r => `<li><strong>${esc(r.titulo)}.</strong> ${esc(r.texto)}</li>`).join("")}</ul></div>`);
  }
  function abrirAtajos() {
    abrir($("vvDlgAtajos"), `${cabeceraDlg("vvDlgAtajosT", "Atajos de teclado")}
      <div class="vv-dlg-cuerpo"><table class="vv-tabla"><tbody>
        <tr><td><kbd>P</kbd></td><td>Pedir carta</td></tr><tr><td><kbd>L</kbd></td><td>Plantarse</td></tr>
        <tr><td><kbd>S</kbd></td><td>Repartir la siguiente mano</td></tr></tbody></table>
      <p>Todos los botones también se manejan con Tab e Intro.</p></div>`);
  }

  /* ---------------------------------------------------------------- cartas */
  function crearCarta(carta) {
    const t = document.createElement("template");
    t.innerHTML = A.carta(carta, false).trim();
    return t.content.firstElementChild;
  }
  // Deja la mano dibujada igual que la del servidor. Las cartas nuevas entran una tras otra (las que Cera roba se ven llegar de una en una)
  function reconciliar(mano, cartas, clave) {
    if (mano.dataset.clave !== clave) { mano.innerHTML = ""; mano.dataset.clave = clave; }
    while (mano.children.length > cartas.length) mano.lastElementChild.remove();
    let nuevas = 0;
    for (let i = mano.children.length; i < cartas.length; i++) {
      const el = crearCarta(cartas[i]);
      if (S.primerPintado || sinMovimiento()) el.classList.add("sin-anim");
      else { el.classList.add("vva-entra"); el.style.animationDelay = (nuevas * 260) + "ms"; el.style.animationFillMode = "backwards"; nuevas++; }
      mano.appendChild(el);
    }
    mano.dataset.n = String(mano.children.length);
    mano.style.setProperty("--n", mano.children.length);
    if (nuevas) sonar("carta");
  }

  /* ---------------------------------------------------------------- Cera */
  const DICHOS = {
    reparto: ["Mis dos cartas están a la vista. No tengo nada que esconder.", "Mira bien. Hoy no hay carta oculta."],
    gana: ["Una vela menos.", "Se apagó.", "Eso es una."],
    pierde: ["Esa vela es tuya. Por ahora.", "Arde, arde."],
    empate: ["Otra vez. Sin prisa.", "Ni tú ni yo. Repetimos."],
    final_gana: ["Ya está. Se acabó mi cera.", "La última vela es tuya."],
    final_pierde: ["La última vela, apagada."]
  };
  let dichoTimer = null;
  function decir(clave) {
    const l = DICHOS[clave]; if (!l) return;
    const d = $("vvDicho");
    d.textContent = l[Math.floor(Math.random() * l.length)]; d.classList.add("visible");
    clearTimeout(dichoTimer);
    dichoTimer = setTimeout(() => d.classList.remove("visible"), 3600);
  }
  function crupierEstado(estado) { $("vvCrupier").dataset.estado = estado; $("vvMesa").dataset.estado = estado; }

  /* ---------------------------------------------------------------- pintar */
  function textoTotal(t) { return (t.blando && t.total <= 21 ? `${t.total} blando` : String(t.total)); }
  function clasesTotal(t, listo) { return "vv-total" + (t.total > 21 ? " pasado" : t.total === 21 && listo ? " veintiuna" : ""); }

  function pintarVelas(est) {
    $("uvVelas").innerHTML = U.velas(est).map(v => `<li class="uv-vela uv-vela-${v.estado}" aria-label="${esc(U.etiquetaVela(v))}"><svg viewBox="0 0 40 60" aria-hidden="true" focusable="false"><use href="#vv-llama"/></svg><span>${v.numero}</span></li>`).join("");
    $("uvCuenta").textContent = U.cuenta(est);
  }

  function pintarMano(est) {
    const m = est.mano;
    if (!m) {
      $("vvManoJugador").innerHTML = ""; $("vvManoJugador").dataset.clave = "";
      $("vvManoCrupier").innerHTML = ""; $("vvManoCrupier").dataset.clave = "";
      $("vvTotalJugador").textContent = ""; $("vvTotalCrupier").textContent = "";
      return;
    }
    const clave = "m" + est.repartidas;
    reconciliar($("vvManoCrupier"), m.cera.cartas, "c" + clave);
    reconciliar($("vvManoJugador"), m.jugador.cartas, "j" + clave);
    const listo = m.fase === "terminada";
    const tj = $("vvTotalJugador"), tc = $("vvTotalCrupier");
    tj.textContent = textoTotal(m.jugador); tj.className = clasesTotal(m.jugador, listo || m.jugador.total === 21);
    tc.textContent = listo && m.cera.cartas.length > 2 ? textoTotal(m.cera) : `muestra ${m.cera.total}`;
    tc.className = clasesTotal(m.cera, listo);
    $("vvManoJugador").classList.toggle("vv-mano-fin", listo);
  }

  function pintarResultado(est, antes) {
    const el = $("vvResultado"), r = U.resultadoMano(est);
    if (!r) { el.hidden = true; return; }
    el.hidden = false;
    el.className = "vv-resultado " + r.clase;
    $("vvResultadoEtq").textContent = r.etq;
    $("vvResultadoTitulo").textContent = r.titulo;
    $("vvResultadoRazon").textContent = r.razon;
    $("vvResultadoLinea").textContent = r.linea;
    // El efecto y la frase de Cera solo la primera vez que se ve este resultado (no al recargar ni al volver a pintar)
    const nuevo = !antes || !antes.mano || antes.mano.fase !== "terminada" || antes.repartidas !== est.repartidas;
    if (!nuevo || S.primerPintado) return;
    const final = est.estado !== "en_curso";
    if (final) { decir(est.estado === "ganado" ? "final_gana" : "final_pierde"); sonar(est.estado === "ganado" ? "gana" : "final"); crupierEstado(est.estado === "ganado" ? "pierde" : "gana"); return; }
    if (r.clase === "res-victoria" || r.clase === "res-natural") { decir("pierde"); sonar("gana"); crupierEstado("pierde"); }
    else if (r.clase === "res-derrota") { decir("gana"); sonar("pierde"); crupierEstado("gana"); }
    else { decir("empate"); sonar("empate"); crupierEstado("empate"); }
  }

  function pintarDock(est) {
    const cuerpo = $("vvDockCuerpo");
    if (est.estado !== "en_curso") {
      const f = U.textoFinal(est);
      cuerpo.innerHTML = `<div class="uv-fin ${f.clase}"><h2>${esc(f.titulo)}</h2><p>${esc(f.texto)}</p><a class="vv-boton vv-boton-principal uv-volver" href="muerte-subita.html"><span class="vv-boton-texto">Volver al Dominio</span></a></div>`;
      return;
    }
    const plan = U.acciones(est);
    const primera = !est.repartidas;
    const intro = primera
      ? `<p class="uv-intro">Hay que ganar 3 de 5 manos. En cuanto repartas la primera, el intento queda gastado: si recargas o te desconectas, la mano sigue donde estaba.</p>`
      : (plan.tipo === "jugando" ? `<p class="uv-intro uv-intro-corta">Tu turno. Cera ya enseñó sus dos cartas.</p>` : "");
    cuerpo.innerHTML = `<div class="vv-acciones">${intro}<div class="vv-botones">${plan.botones.map(b => `<button type="button" class="vv-boton${b.principal ? " vv-boton-principal" : ""}" data-accion="${b.id}" aria-disabled="${!b.habilitado}"${b.motivo ? ` data-motivo="${esc(b.motivo)}"` : ""} aria-keyshortcuts="${b.tecla}">
        <span class="vv-boton-texto">${esc(b.texto)}</span>${b.sub ? `<span class="vv-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}</div></div>`;
  }

  function pintar(est, antes) {
    S.est = est;
    $("uvReto").hidden = false; $("vvMesa").hidden = false;
    $("uvApuesta").textContent = `Apuestas a ${est.personaje}. Un solo intento.`;
    $("vvSala").dataset.fase = est.estado === "en_curso" ? (est.mano && est.mano.fase === "jugador" ? "jugando" : "espera") : "fin";
    if (est.mano && est.mano.fase === "jugador") crupierEstado("jugador");
    else if (!est.mano) crupierEstado("espera");
    pintarVelas(est);
    pintarMano(est);
    pintarResultado(est, antes);
    pintarDock(est);
    const frase = U.anuncio(antes, est);
    if (frase) leer(frase);
    if (!antes && est.mano && est.mano.fase === "jugador" && est.repartidas) decir("reparto");
    S.primerPintado = false;
  }

  /* ---------------------------------------------------------------- hablar con el servidor */
  function manejarError(e, reintento) {
    aviso(U.mensajeError(e), { tipo: "error", reintentar: !!reintento && (!e || e.tipo === "red"), cerrar: true });
    S.reintento = reintento || null;
  }
  async function ejecutar(fn) {
    if (S.ocupado) return;
    S.ocupado = true; document.body.classList.add("uv-ocupado");
    try {
      const r = await fn();
      aviso(""); S.reintento = null;
      if (r) pintar(r, S.est);
    } catch (e) {
      manejarError(e, () => ejecutar(fn));
    } finally { S.ocupado = false; document.body.classList.remove("uv-ocupado"); }
  }
  const repartir = () => { const manos = S.est.repartidas; return ejecutar(() => api.reto.repartir(idIntento, manos)); };
  function hacer(accion) {
    const m = S.est && S.est.mano;
    if (!m || m.fase !== "jugador") return;
    const paso = m.paso;                                     // el paso con el que se mandó: si hay que reintentar, se reintenta con este mismo
    return ejecutar(() => api.reto.accion(idIntento, paso, accion));
  }
  function intentarAccion(id) {
    if (!S.est || S.est.estado !== "en_curso") return;
    const b = U.acciones(S.est).botones.find(x => x.id === id);
    if (!b) return;
    if (!b.habilitado) { aviso(b.motivo, { tipo: "info", cerrar: true }); return; }
    if (id === "repartir") repartir(); else hacer(id);
  }

  /* ---------------------------------------------------------------- eventos */
  function alClic(ev) {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if ("reintentar" in t.dataset) { const f = S.reintento; aviso(""); if (f) f(); return; }
    if ("cerrarAviso" in t.dataset) { aviso(""); return; }
    if (t.dataset.accion) {
      if (t.getAttribute("aria-disabled") === "true") { aviso(t.dataset.motivo || "", { tipo: "info", cerrar: true }); return; }
      intentarAccion(t.dataset.accion);
    }
  }
  function alTeclear(ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    const t = ev.target;
    if (t && (t.matches("input, textarea, select") || t.isContentEditable)) return;
    if (!S.est || S.est.estado !== "en_curso") return;
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    const b = U.acciones(S.est).botones.find(x => x.tecla === k);
    if (b) { ev.preventDefault(); intentarAccion(b.id); }
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
  const finCarga = () => { try { if (window.Carga && window.Carga.listo) window.Carga.listo(); } catch (e) { /* sin aviso de carga */ } };
  function mensajePagina(texto) {
    $("vvSala").dataset.fase = "mensaje";
    aviso(texto, { tipo: "info" });
  }
  async function cargar() {
    try {
      const est = await api.reto.estado(idIntento);
      pintar(est, null);
      if (est.estado === "en_curso" && est.mano && est.mano.fase === "jugador") aviso("Retomas la mano donde la dejaste. Las cartas son las mismas.", { tipo: "info", cerrar: true });
      else if (est.estado === "en_curso" && est.repartidas) aviso(`Retomas el reto en la mano ${est.numero} de ${est.meta.manos}.`, { tipo: "info", cerrar: true });
    } catch (e) {
      if (e && e.tipo === "servidor" && /no_encontrado|anulado/.test(e.codigo)) mensajePagina(U.mensajeError(e));
      else if (e && e.tipo === "servidor" && /function .* does not exist|Could not find the function/i.test(e.mensaje || "")) mensajePagina("El reto todavía no está instalado en el servidor. Avisa al DM.");
      else manejarError(e, cargar);
    }
  }
  async function iniciar() {
    montarArte();
    pintarSonidoBoton();
    document.addEventListener("click", alClic);
    document.addEventListener("keydown", alTeclear);
    $("vvBtnReglas").addEventListener("click", abrirReglas);
    $("vvAtajosBtn").addEventListener("click", abrirAtajos);
    $("vvBtnSonido").addEventListener("click", () => { S.efectos = !S.efectos; guardado.poner("vvEfectos", S.efectos ? "1" : "0"); pintarSonidoBoton(); if (S.efectos) sonar("carta"); });
    window.addEventListener("online", () => { aviso("Volvió la conexión.", { tipo: "info", cerrar: true }); if (!S.est) cargar(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && S.est && !S.ocupado) api.reto.estado(idIntento).then(r => { if (r && JSON.stringify(r) !== JSON.stringify(S.est)) pintar(r, S.est); }).catch(() => {}); });

    if (!idIntento) { mensajePagina("Este reto se abre desde Muerte Súbita, con el personaje que apuestas."); finCarga(); return; }
    let sesion = null;
    try { sesion = typeof fichasSesionActual === "function" ? await fichasSesionActual() : null; } catch (e) { sesion = null; }
    S.sesion = sesion;
    if (!sesion) { mensajePagina("Hay que iniciar sesión para este reto."); finCarga(); }
    else { await cargar(); finCarga(); }
    if (typeof fichasEnCambioDeSesion === "function") {
      fichasEnCambioDeSesion(ses => { if (ses && !S.sesion) { S.sesion = ses; aviso(""); cargar(); } }).catch(() => {});
    }
  }

  window.UltimaVela = { estado: S, abrirReglas };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
