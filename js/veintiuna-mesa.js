/* =============================================================================
   LAS VEINTIUNA VELAS: la mesa (veintiuna.html)
   Pinta lo que el servidor confirma y le pide lo que el jugador hace. Las reglas, la baraja y las monedas están en docs/veintiuna.sql;
   aquí no se calcula ningún resultado. Cada animación cuenta algo que el servidor YA decidió (reparto, carta pedida, turno del crupier
   ya jugado), y se puede saltar con un clic o una tecla.
   Piezas: veintiuna-arte.js (dibujos), veintiuna-vista.js (textos y acciones), veintiuna-api.js (red).
============================================================================= */
(function () {
  const A = window.VeintiunaArte, V = window.VeintiunaVista;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const api = window.VeintiunaApi.crear(() => fichasCliente());
  const reducir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
  const guardado = {
    leer(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    poner(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------------------------------------------------------------- estado de la pantalla */
  const S = {
    sesion: null,
    mesa: null,            // lo último que dijo veintiuna_mesa
    est: null,             // la mano en pantalla (en curso o recién terminada)
    fase: "cargando",      // cargando | sin_sesion | sin_servidor | apuesta | espera | mano | fortuna | fin
    modo: guardado.leer("vvModo", "apuesta") === "practica" ? "practica" : "apuesta",
    apuesta: 0,
    ultimaApuesta: Number(guardado.leer("vvApuesta", "0")) || 0,
    ocupado: false,
    intento: null,         // la última petición, por si hay que repetirla con los mismos identificadores
    pintado: null,         // { partida, nJ, nC, terminada } lo que ya está dibujado
    saltar: false,
    animando: false,
    efectos: guardado.leer("vvEfectos", "1") !== "0",
    saldoMostrado: null,
    version: 0
  };

  /* ---------------------------------------------------------------- tiempos y movimiento */
  const sinMovimiento = () => reducir.matches;
  const esperar = ms => new Promise(ok => {
    if (S.saltar || ms <= 0) { ok(); return; }
    const t = setTimeout(ok, sinMovimiento() ? Math.min(ms, 60) : ms);
    S._despertar = () => { clearTimeout(t); ok(); };
  });
  function pedirSaltar() { if (S.animando) { S.saltar = true; if (S._despertar) S._despertar(); } }
  // Anima y espera a que termine. Si la pestaña está en segundo plano el navegador congela las animaciones: un temporizador la termina de golpe para que la mesa nunca se quede esperando.
  function animar(el, fotogramas, opciones) {
    if (!el.animate || sinMovimiento() || S.saltar) return Promise.resolve();
    try {
      const o = Object.assign({ fill: "both", easing: "cubic-bezier(.2,.8,.2,1)" }, opciones);
      const anim = el.animate(fotogramas, o);
      return Promise.race([
        anim.finished.catch(() => {}),
        new Promise(ok => setTimeout(() => { try { anim.finish(); } catch (e) { /* ya terminó */ } ok(); }, (o.duration || 300) + (o.delay || 0) + 350))
      ]);
    } catch (e) { return Promise.resolve(); }
  }

  /* ---------------------------------------------------------------- sonidos de la mesa (sintetizados: no hay archivos que puedan faltar) */
  const Sonido = (() => {
    let ctx = null;
    const listo = () => {
      if (!S.efectos) return null;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
      } catch (e) { return null; }
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
      carta() { ruido(0.09, 2600, 0.5); },
      giro() { ruido(0.14, 1800, 0.35); tono(180, 0.1, "triangle", 0.05); },
      ficha() { tono(1900, 0.07, "triangle", 0.09); tono(2500, 0.08, "triangle", 0.07, 0.045); },
      gana() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.28, "sine", 0.1, i * 0.09)); },
      natural() { [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, 0.34, "triangle", 0.1, i * 0.08)); },
      pierde() { tono(233, 0.4, "sawtooth", 0.05); tono(175, 0.55, "sawtooth", 0.05, 0.2); },
      empate() { tono(440, 0.22, "sine", 0.08); tono(440, 0.22, "sine", 0.08, 0.2); },
      vela() { ruido(0.22, 900, 0.2); tono(660, 0.12, "sine", 0.03); }
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
    el.innerHTML = `<span class="vv-tostada-icono" aria-hidden="true">${o.icono || "✦"}</span><span>${esc(texto)}</span>${o.accion ? `<button type="button" class="vv-enlace">${esc(o.accion)}</button>` : ""}`;
    if (o.accion) el.querySelector("button").addEventListener("click", () => { o.alAccion && o.alAccion(); el.remove(); });
    $("vvToasts").appendChild(el);
    requestAnimationFrame(() => el.classList.add("entra"));
    setTimeout(() => { el.classList.remove("entra"); setTimeout(() => el.remove(), 400); }, o.ms || 6500);
  }

  /* ---------------------------------------------------------------- la crupier */
  let dichoTimer = null;
  function crupierEstado(estado) { $("vvCrupier").dataset.estado = estado; $("vvMesa").dataset.estado = estado; }
  function decir(clave, probabilidad) {
    if (probabilidad != null && Math.random() > probabilidad) return;
    const texto = V.elegir(clave);
    if (!texto) return;
    const d = $("vvDicho");
    d.textContent = texto; d.classList.add("visible");
    clearTimeout(dichoTimer);
    dichoTimer = setTimeout(() => d.classList.remove("visible"), 3200);
  }

  /* ---------------------------------------------------------------- saldo */
  function pintarSaldo(n, animarDesde) {
    const el = $("vvSaldo");
    const hasta = Number(n);
    if (!Number.isFinite(hasta)) { el.textContent = "—"; return; }
    if (animarDesde == null || sinMovimiento() || S.saltar || animarDesde === hasta) { el.textContent = V.monedas(hasta); S.saldoMostrado = hasta; return; }
    const t0 = performance.now(), dur = 800;
    const paso = ahora => {
      const k = Math.min(1, (ahora - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = V.monedas(animarDesde + (hasta - animarDesde) * e);
      if (k < 1) requestAnimationFrame(paso); else { el.textContent = V.monedas(hasta); S.saldoMostrado = hasta; }
    };
    requestAnimationFrame(paso);
    el.classList.remove("sube", "baja"); void el.offsetWidth;
    el.classList.add(hasta > animarDesde ? "sube" : "baja");
  }
  const saldoActual = () => (S.mesa ? Number(S.mesa.saldo) : 0);

  /* ---------------------------------------------------------------- velas (el marcador de puntos) */
  function prepararVelas(el) {
    if (el.childElementCount) return;
    let h = "";
    for (let i = 1; i <= 21; i++) h += `<i class="${i === 17 ? "m17" : ""}${i === 21 ? " m21" : ""}" style="--i:${i}"></i>`;
    el.innerHTML = h;
  }
  function velas(el, total, opciones) {
    prepararVelas(el);
    const o = opciones || {};
    el.classList.toggle("pasado", total > 21);
    el.classList.toggle("veintiuna", total === 21);
    el.querySelectorAll("i").forEach((v, i) => v.classList.toggle("on", total != null && i < Math.min(total, 21)));
    el.dataset.total = total == null ? "" : total;
    el.style.visibility = o.oculto ? "hidden" : "";
  }

  /* ---------------------------------------------------------------- manos */
  const manoEl = quien => $(quien === "crupier" ? "vvManoCrupier" : "vvManoJugador");
  function ajustarAbanico(mano) {
    const n = mano.children.length;
    mano.dataset.n = String(n);
    mano.style.setProperty("--n", n);
  }
  function crearCarta(carta, oculta) {
    const t = document.createElement("template");
    t.innerHTML = A.carta(carta, oculta).trim();
    return t.content.firstElementChild;
  }
  function posicionZapato() {
    const z = $("vvZapato").getBoundingClientRect();
    return { x: z.left + z.width / 2, y: z.top + z.height / 2 };
  }
  // Pone una carta en la mano y la hace volar desde el zapato hasta su sitio
  async function repartirCarta(quien, carta, oculta, opciones) {
    const mano = manoEl(quien), el = crearCarta(carta, oculta);
    const o = opciones || {};
    if (!o.animar) el.classList.add("sin-anim");
    mano.appendChild(el);
    ajustarAbanico(mano);
    if (o.animar && !sinMovimiento() && !S.saltar) {
      const z = posicionZapato(), r = el.getBoundingClientRect();
      const dx = z.x - (r.left + r.width / 2), dy = z.y - (r.top + r.height / 2);
      sonar("carta");
      await animar(el, [
        { transform: `translate(${dx}px, ${dy}px) rotate(${quien === "crupier" ? -18 : 14}deg) scale(.62)`, opacity: 0.2 },
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 }
      ], { duration: 340 });
    } else if (o.animar) sonar("carta");
    return el;
  }
  // Gira una carta boca abajo para enseñarla
  async function revelarCarta(el, carta) {
    el.querySelector(".vv-lado-cara").innerHTML = A.cara(carta);
    el.setAttribute("aria-label", A.nombreCarta(carta));
    el.dataset.r = carta.r; el.dataset.p = carta.p;
    sonar("giro");
    if (!sinMovimiento() && !S.saltar) {
      el.classList.add("girando");
      await animar(el.querySelector(".vv-carta-giro"), [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], { duration: 420 });
    }
    el.classList.remove("vv-boca-abajo", "girando");
  }
  function limpiarManos(conBarrido) {
    ["vvManoCrupier", "vvManoJugador"].forEach(id => { const m = $(id); m.innerHTML = ""; ajustarAbanico(m); });
  }
  async function barrerMesa() {
    const cartas = [...document.querySelectorAll(".vv-mano .vv-carta")];
    if (cartas.length && !sinMovimiento() && !S.saltar) {
      const z = posicionZapato();
      await Promise.all(cartas.map((el, i) => {
        const r = el.getBoundingClientRect();
        return animar(el, [{ transform: "none", opacity: 1 }, { transform: `translate(${z.x - (r.left + r.width / 2)}px, ${z.y - (r.top + r.height / 2)}px) scale(.5) rotate(20deg)`, opacity: 0 }], { duration: 260, delay: i * 30 });
      }));
    }
    limpiarManos();
  }

  function pintarTotales(est, opciones) {
    const o = opciones || {};
    const j = est ? est.jugador : null, c = est ? est.crupier : null;
    $("vvTotalJugador").textContent = j ? (j.blando && j.total <= 21 ? `${j.total} blando` : String(j.total)) : "";
    $("vvTotalJugador").className = "vv-total" + (j && j.total > 21 ? " pasado" : j && j.total === 21 ? " veintiuna" : "");
    velas($("vvVelasJugador"), j ? j.total : null, { oculto: !j });
    if (!c) { $("vvTotalCrupier").textContent = ""; velas($("vvVelasCrupier"), null, { oculto: true }); return; }
    const completo = est.estado === "terminada" && !o.ocultarCrupier;
    $("vvTotalCrupier").textContent = completo ? (c.blando && c.total <= 21 ? `${c.total} blando` : String(c.total)) : `muestra ${c.total}`;
    $("vvTotalCrupier").className = "vv-total" + (completo && c.total > 21 ? " pasado" : completo && c.total === 21 ? " veintiuna" : "");
    velas($("vvVelasCrupier"), c.total, { oculto: false });
  }

  /* ---------------------------------------------------------------- la placa de la regla */
  function pintarPlaca(reglaId, modoEtiqueta, est) {
    const R = V.REGLAS[reglaId];
    const placa = $("vvPlaca");
    if (!R) { placa.hidden = true; return; }
    placa.hidden = false;
    const cambia = placa.dataset.regla !== reglaId || placa.dataset.etq !== modoEtiqueta;
    placa.dataset.regla = reglaId; placa.dataset.etq = modoEtiqueta;
    $("vvPlacaIcono").innerHTML = A.ICONOS[reglaId];
    $("vvPlacaEtq").textContent = modoEtiqueta === "proxima" ? "Regla de la próxima mano" : "Regla de esta mano";
    $("vvPlacaNombre").textContent = R.nombre;
    $("vvPlacaEfecto").textContent = R.resumen;
    const usada = est ? !!est.regla.usada : false;
    const fase = est ? est.fase : "";
    let estado = "";
    if (modoEtiqueta === "proxima") estado = reglaId === "maldicion" ? "Activa en toda la mano" : "Disponible en la mano";
    else estado = R.estado(usada, fase);
    const chip = $("vvPlacaEstado");
    chip.textContent = estado;
    chip.className = "vv-placa-estado" + (usada ? " gastada" : fase === "fortuna" ? " urgente" : "");
    if (cambia) {
      placa.classList.remove("cambia"); void placa.offsetWidth;
      if (!sinMovimiento()) placa.classList.add("cambia");
    }
  }
  const peajeTexto = (id) => {
    const m = S.mesa; if (!m) return "";
    const f = id === "fortuna" ? m.peajes.fortuna : m.peajes.voluntad;
    return `${Math.round(f * 100)} % de la apuesta`;
  };

  /* ---------------------------------------------------------------- la apuesta sobre la mesa (montoncito de fichas) */
  function pintarFichasMesa(est) {
    const el = $("vvApuestaMesa");
    if (!est) { el.innerHTML = ""; el.classList.remove("hay"); return; }
    let resto = Number(est.apuesta), pila = "";
    const den = [100, 50, 20, 10];
    const fichas = [];
    for (const d of den) while (resto >= d && fichas.length < 7) { fichas.push(d); resto -= d; }
    if (resto > 0 && fichas.length < 7) fichas.push(den[den.length - 1]);
    pila = fichas.map((d, i) => `<span class="vv-ficha-pila" style="--k:${i}">${A.ficha(d)}</span>`).join("");
    const peajes = Number(est.peajes) || 0;
    el.innerHTML = `<span class="vv-pila">${pila}</span><span class="vv-apuesta-valor">${est.modo === "practica" ? "práctica" : V.monedas(est.apuesta)}${peajes ? `<small>+ peaje ${V.monedas(peajes)}</small>` : ""}</span>`;
    el.classList.add("hay");
    el.setAttribute("aria-hidden", "true");
  }

  /* ---------------------------------------------------------------- el dock: apuesta, acciones y fin de mano */
  function pintarDock() {
    const cuerpo = $("vvDockCuerpo");
    const dock = $("vvDock");
    dock.dataset.fase = S.fase;
    const m = S.mesa;
    if (S.fase === "cargando") { cuerpo.innerHTML = `<p class="vv-dock-texto">Encendiendo las velas...</p>`; return; }
    if (S.fase === "sin_sesion") {
      cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>Inicia sesión para sentarte</h2><p>La mesa guarda tus monedas, tus manos y tus desafíos en tu cuenta. Pulsa «Iniciar sesión» arriba a la derecha.</p></div>`;
      return;
    }
    if (S.fase === "sin_conexion") {
      cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>La mesa no responde</h2><p>No hay conexión con el servidor. Si tenías una mano abierta sigue guardada.</p><button type="button" class="vv-boton vv-boton-principal" data-reintentar><span class="vv-boton-texto">Reintentar</span></button></div>`;
      return;
    }
    if (S.fase === "sin_servidor") {
      cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>La mesa todavía no está montada</h2><p>Falta ejecutar <code>docs/veintiuna.sql</code> en Supabase. Cuando se ejecute, recarga esta página.</p></div>`;
      return;
    }
    if (S.fase === "espera") {
      cuerpo.innerHTML = `<p class="vv-dock-texto" role="status">${S.est && S.est.estado === "terminada" ? "El crupier juega su turno..." : "Repartiendo..."}</p><button type="button" class="vv-boton vv-boton-fantasma" data-saltar>Saltar la animación</button>`;
      return;
    }
    if (S.fase === "apuesta") { pintarPanelApuesta(cuerpo); return; }
    if (S.fase === "mano" || S.fase === "fortuna") { pintarAcciones(cuerpo); return; }
    if (S.fase === "fin") { pintarFin(cuerpo); }
  }

  function pintarPanelApuesta(cuerpo) {
    const m = S.mesa, lim = m.limites, saldo = Number(m.saldo);
    const practica = S.modo === "practica";
    const fichas = V.fichasDisponibles(lim);
    const motivo = practica ? "" : V.motivoApuesta(S.apuesta, saldo, lim);
    const sinFondos = !practica && saldo < lim.min;
    const regla = V.REGLAS[m.proxima_regla];
    const peajeLinea = regla && regla.id !== "maldicion" ? ` Peaje: ${peajeTexto(regla.id)}.` : "";
    cuerpo.innerHTML = `
      <div class="vv-apuesta-panel">
        <div class="vv-modos" role="radiogroup" aria-label="Modalidad de la mesa">
          <button type="button" role="radio" aria-checked="${!practica}" class="vv-modo${!practica ? " activo" : ""}" data-modo="apuesta"><strong>Con apuesta</strong><small>monedas del Hipódromo</small></button>
          <button type="button" role="radio" aria-checked="${practica}" class="vv-modo${practica ? " activo" : ""}" data-modo="practica"><strong>Mesa de práctica</strong><small>sin monedas, cuenta para los desafíos</small></button>
        </div>
        <div class="vv-apuesta-centro">
        ${practica ? `
          <div class="vv-practica"><p>Apuesta simbólica de <strong>${V.monedas(lim.min)}</strong>: no se cobra ni se paga.${esc(peajeLinea)} Las mismas cartas, las mismas reglas.</p></div>`
        : `
          <div class="vv-fichas" role="group" aria-label="Fichas para apostar">
            ${fichas.map(f => { const ok = !V.motivoApuesta(f, saldo, lim) || (S.apuesta + f <= lim.max && S.apuesta + f <= saldo); const cabe = (S.apuesta + f) <= Math.min(lim.max, saldo); return `<button type="button" class="vv-ficha${cabe ? "" : " sin-fondos"}" data-ficha="${f}" aria-disabled="${!cabe}" aria-label="Añadir ${f} monedas"${cabe ? "" : ` title="${esc(S.apuesta + f > lim.max ? "Pasarías la apuesta máxima de " + V.monedas(lim.max) : "No te alcanzan las monedas")}"`}>${A.ficha(f)}</button>`; }).join("")}
          </div>
          <div class="vv-apuesta-total">
            <button type="button" class="vv-paso" data-paso="-1" aria-label="Bajar la apuesta ${V.monedas(lim.paso)}" ${S.apuesta <= 0 ? 'aria-disabled="true"' : ""}>−</button>
            <div class="vv-apuesta-cifra" aria-live="polite"><small>Apuesta</small><strong id="vvApuestaCifra">${V.monedas(S.apuesta)}</strong></div>
            <button type="button" class="vv-paso" data-paso="1" aria-label="Subir la apuesta ${V.monedas(lim.paso)}">+</button>
            <button type="button" class="vv-enlace" data-borrar ${S.apuesta <= 0 ? 'aria-disabled="true"' : ""}>Quitar fichas</button>
            ${S.ultimaApuesta && S.ultimaApuesta !== S.apuesta ? `<button type="button" class="vv-enlace" data-repetir>Repetir ${V.monedas(S.ultimaApuesta)}</button>` : ""}
          </div>`}
        </div>
        <div class="vv-apuesta-acciones">
          <button type="button" class="vv-boton vv-boton-principal" data-repartir ${(practica ? false : (!!motivo || S.apuesta <= 0 || sinFondos)) ? 'aria-disabled="true"' : ""}>
            <span class="vv-boton-texto">Repartir</span><span class="vv-boton-sub">${practica ? "mano de práctica" : S.apuesta > 0 ? "apuesta " + V.monedas(S.apuesta) : "elige una apuesta"}</span></button>
          ${sinFondos ? `<button type="button" class="vv-boton" data-modo="practica">Jugar en la práctica</button>` : ""}
        </div>
        ${practica ? "" : `<p class="vv-nota-apuesta${motivo && S.apuesta > 0 ? " mal" : ""}" id="vvNotaApuesta">${sinFondos
            ? `No tienes monedas para la apuesta mínima (${V.monedas(lim.min)}). Puedes vender una carta en el <a href="hipodromo.html#cartas">Hipódromo</a> o jugar en la mesa de práctica.`
            : motivo && S.apuesta > 0 ? esc(motivo)
            : `De ${V.monedas(lim.min)} a ${V.monedas(lim.max)}, de ${V.monedas(lim.paso)} en ${V.monedas(lim.paso)}. Victoria 1 a 1, blackjack natural 3 a 2, empate devuelve.${esc(peajeLinea)}`}</p>`}
      </div>`;
  }

  function pintarAcciones(cuerpo) {
    const est = S.est, plan = V.acciones(est);
    const fortuna = plan.fase === "fortuna";
    cuerpo.innerHTML = `
      <div class="vv-acciones${fortuna ? " vv-acciones-fortuna" : ""}">
        ${fortuna ? `<p class="vv-acciones-aviso" id="vvAvisoFortuna"><strong>Te pasaste de 21.</strong> La Fortuna puede convertir esa última carta en un as de valor 1, pero cobra su peaje.</p>` : ""}
        <div class="vv-botones">
          ${plan.botones.map(b => `<button type="button" class="vv-boton${b.principal ? " vv-boton-principal" : ""}${b.especial ? " vv-boton-especial" : ""}${b.id === "aceptar" ? " vv-boton-fantasma" : ""}" data-accion="${b.id}" aria-disabled="${!b.habilitado}"${b.motivo ? ` data-motivo="${esc(b.motivo)}"` : ""} aria-keyshortcuts="${b.tecla}">
            <span class="vv-boton-texto">${esc(b.texto)}</span>${b.sub ? `<span class="vv-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}
        </div>
      </div>`;
  }

  function pintarFin(cuerpo) {
    const r = V.resultado(S.est);
    const lim = S.mesa.limites;
    const sin = S.est.modo === "apuesta" && saldoActual() < lim.min;
    cuerpo.innerHTML = `
      <div class="vv-fin">
        <div class="vv-fin-resumen"><strong>${esc(r ? r.titulo : "")}</strong><span>${esc(r ? r.linea : "")}</span></div>
        <div class="vv-botones">
          <button type="button" class="vv-boton vv-boton-principal" data-otra aria-keyshortcuts="Enter"><span class="vv-boton-texto">Otra mano</span><span class="vv-boton-sub">${sin ? "cambia de apuesta" : "elige tu apuesta"}</span><kbd aria-hidden="true">↵</kbd></button>
        </div>
      </div>`;
  }

  function enfocarDock() {
    const b = $("vvDockCuerpo").querySelector('button:not([aria-disabled="true"]):not([data-saltar])');
    if (b && !document.querySelector("dialog[open]")) { try { b.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
  }

  /* ---------------------------------------------------------------- cambios de fase */
  function fase(nueva) { S.fase = nueva; $("vvSala").dataset.fase = nueva; pintarDock(); ajustarVolumen(); }
  // En móvil el dock queda pegado abajo: el control de volumen general se sube lo que mide
  function ajustarVolumen() {
    const dock = $("vvDock");
    const pegado = window.matchMedia("(max-width: 720px)").matches && dock;
    document.body.style.setProperty("--vv-dock-h", pegado ? Math.ceil(dock.getBoundingClientRect().height) + "px" : "0px");
  }

  /* ---------------------------------------------------------------- cabecera: desafíos y avisos */
  function pintarCabecera() {
    const m = S.mesa;
    const listos = m ? m.logros.filter(l => V.estadoLogro(l) === "listo").length : 0;
    const ins = $("vvInsignia");
    ins.hidden = !listos; ins.textContent = listos ? String(listos) : "";
    ins.setAttribute("aria-label", listos ? `${listos} desafíos listos para reclamar` : "");
    $("vvBtnDesafios").setAttribute("aria-label", listos ? `Desafíos, ${listos} listos para reclamar` : "Desafíos");
  }

  /* ---------------------------------------------------------------- cargar la mesa */
  async function cargarMesa(opciones) {
    const o = opciones || {};
    try {
      const antes = S.mesa ? Number(S.mesa.saldo) : null;
      S.mesa = await api.mesa();
      pintarCabecera();
      pintarSaldo(S.mesa.saldo, o.animarSaldo && antes != null ? antes : null);
      if (o.soloDatos) return S.mesa;
      aviso("");
      if (S.mesa.partida) await retomar(S.mesa.partida);
      else { S.est = null; irAApuesta(true); }
      return S.mesa;
    } catch (e) {
      manejarError(e, { alReintentar: () => cargarMesa(opciones) });
      return null;
    }
  }
  function irAApuesta(primera) {
    S.est = null; S.pintado = null;
    S.apuesta = V.apuestaInicial(S.ultimaApuesta, saldoActual(), S.mesa.limites);
    if (S.modo === "apuesta" && saldoActual() < S.mesa.limites.min && primera && S.mesa.estadisticas.rondas === 0) S.modo = "practica";
    limpiarManos();
    pintarTotales(null);
    pintarFichasMesa(null);
    $("vvResultado").hidden = true;
    $("vvMesa").classList.remove("res-victoria", "res-derrota", "res-empate", "res-natural");
    pintarPlaca(S.mesa.proxima_regla, "proxima", null);
    crupierEstado("espera");
    fase("apuesta");
    if (primera) decir("ronda", 0.6);
    if (document.activeElement === document.body || primera) enfocarDock();
  }

  // Una mano que ya estaba abierta (recargaste la página): se dibuja entera, sin repartir
  async function retomar(est) {
    S.est = est;
    limpiarManos(); $("vvResultado").hidden = true;
    for (const c of est.jugador.cartas) await repartirCarta("jugador", c, false, { animar: false });
    for (let i = 0; i < est.crupier.cartas.length; i++) await repartirCarta("crupier", est.crupier.cartas[i], false, { animar: false });
    if (est.crupier.ocultas) await repartirCarta("crupier", null, true, { animar: false });
    S.pintado = { partida: est.partida, nJ: est.jugador.cartas.length, nC: est.crupier.cartas.length, terminada: false };
    pintarTotales(est); pintarPlaca(est.regla.id, "actual", est); pintarFichasMesa(est);
    crupierEstado(est.fase === "fortuna" ? "jugador" : "jugador");
    leer(V.anuncio(null, est));
    musica(true);
    fase(est.fase === "fortuna" ? "fortuna" : "mano");
    enfocarDock();
    tostada("Recuperé tu mano abierta. Sigue donde la dejaste.", { icono: "🕯" });
  }

  const musica = (activa) => { try { if (window.MusicaPaginas) window.MusicaPaginas.partida(!!activa); } catch (e) { /* sin música */ } };

  /* ---------------------------------------------------------------- aplicar lo que confirma el servidor */
  async function aplicarEstado(est, opciones) {
    const o = opciones || {};
    const antes = S.pintado;
    const mismoParte = antes && antes.partida === est.partida;
    const previo = mismoParte ? S.est : null;
    S.est = est;
    if (est.repetida || est.cerrada_por_inactividad) { /* se pinta tal cual: no hay nada nuevo que contar */ }
    S.animando = true; S.saltar = false;
    document.body.classList.add("vv-animando");
    const saldoAntes = o.saldoAntes != null ? o.saldoAntes : (S.saldoMostrado != null ? S.saldoMostrado : saldoActual());
    try {
      if (!mismoParte) await nuevaMano(est);
      else await continuarMano(est, previo, antes);
    } finally {
      S.animando = false; S.saltar = false;
      document.body.classList.remove("vv-animando");
    }
    leer(V.anuncio(previo, est));
    if (est.estado === "terminada") await terminarMano(est, saldoAntes);
    else {
      musica(true);
      fase(est.fase === "fortuna" ? "fortuna" : "mano");
      crupierEstado("jugador");
      enfocarDock();
    }
  }

  async function nuevaMano(est) {
    fase("espera");
    $("vvResultado").hidden = true;
    $("vvMesa").classList.remove("res-victoria", "res-derrota", "res-empate", "res-natural");
    await barrerMesa();
    musica(true);
    const placa = est.regla.id;
    pintarPlaca(placa, "actual", est);
    crupierEstado("reparto");
    decir(placa === "maldicion" ? "maldicion" : "reparto", 0.55);
    pintarFichasMesa(est);
    pintarTotales(null);
    const j = est.jugador.cartas, c = est.crupier.cartas;
    S.pintado = { partida: est.partida, nJ: 0, nC: 0, terminada: false };
    const ocultaFinal = est.crupier.ocultas || c.length > 1;
    // Orden de reparto: tú, crupier (visible), tú, crupier (oculta)
    await repartirCarta("jugador", j[0], false, { animar: true }); await esperar(110);
    await repartirCarta("crupier", c[0], false, { animar: true }); await esperar(110);
    await repartirCarta("jugador", j[1], false, { animar: true }); await esperar(110);
    const holeEl = await repartirCarta("crupier", null, true, { animar: true });
    S.pintado = { partida: est.partida, nJ: 2, nC: 2, terminada: false, hole: holeEl };
    // Las demás cartas del jugador no existen todavía; si la mano ya terminó, se cuenta aparte
    pintarTotales(est, { ocultarCrupier: est.estado === "terminada" });
    if (est.estado === "terminada") {
      await esperar(360);
      await revelarCarta(holeEl, c[1]);
      S.pintado.nC = c.length;
    }
    await esperar(160);
  }

  async function continuarMano(est, previo, antes) {
    const nJ = antes.nJ;
    const nuevas = est.jugador.cartas.slice(nJ);
    // La Fortuna cambia una carta que ya estaba: se vuelve a dibujar en su sitio
    const jm = manoEl("jugador");
    est.jugador.cartas.slice(0, nJ).forEach((c, i) => {
      const el = jm.children[i];
      if (el && c.as1 && !el.dataset.as1) {
        el.dataset.as1 = "1";
        el.querySelector(".vv-lado-cara").innerHTML = A.cara(c);
        el.setAttribute("aria-label", A.nombreCarta(c) + ", convertida en un as de valor 1");
        el.classList.add("convertida");
        sonar("ficha");
        decir("fortuna", 0.8);
        setTimeout(() => el.classList.remove("convertida"), 1400);
      }
    });
    for (const c of nuevas) { await repartirCarta("jugador", c, false, { animar: true }); await esperar(60); }
    S.pintado.nJ = est.jugador.cartas.length;
    if (nuevas.length && est.fase === "fortuna") decir("pasas", 0.8);
    if (est.regla.id === "voluntad" && est.regla.usada && previo && !previo.regla.usada) decir("voluntad", 0.9);
    pintarTotales(est, { ocultarCrupier: est.estado === "terminada" });
    pintarPlaca(est.regla.id, "actual", est);
    pintarFichasMesa(est);
    if (est.estado === "terminada") {
      fase("espera");
      crupierEstado("crupier");
      if (!nuevas.length || est.jugador.total <= 21) decir("suTurno", 0.6);
      await esperar(320);
      // El crupier enseña su carta oculta y juega: son cartas que el servidor ya había sacado
      const cm = manoEl("crupier");
      const hole = cm.children[1];
      if (hole && hole.classList.contains("vv-boca-abajo")) await revelarCarta(hole, est.crupier.cartas[1]);
      pintarTotales({ ...est, crupier: { ...est.crupier, total: valorDeMano(est.crupier.cartas.slice(0, 2), est) } }, { ocultarCrupier: false });
      for (let i = 2; i < est.crupier.cartas.length; i++) {
        await esperar(520);
        await repartirCarta("crupier", est.crupier.cartas[i], false, { animar: true });
        const parcial = valorDeMano(est.crupier.cartas.slice(0, i + 1), est);
        $("vvTotalCrupier").textContent = String(parcial);
        velas($("vvVelasCrupier"), parcial);
      }
      S.pintado.nC = est.crupier.cartas.length;
      await esperar(300);
    }
  }
  // Total de una mano de cartas ya enseñadas (solo para ir contando mientras se reparten; el total definitivo lo da el servidor)
  function valorDeMano(cartas, est) {
    const fig = est.regla.id === "maldicion" ? 11 : 10;
    let suma = 0, ases = 0;
    cartas.forEach(c => { if (c.r === 1) { suma += 1; ases++; } else suma += c.r >= 11 ? fig : c.r; });
    return ases && suma + 10 <= 21 ? suma + 10 : suma;
  }

  /* ---------------------------------------------------------------- el final de la mano */
  async function terminarMano(est, saldoAntes) {
    const r = V.resultado(est);
    S.pintado.terminada = true;
    pintarTotales(est, { ocultarCrupier: false });
    const clase = { natural: "res-natural", victoria: "res-victoria", derrota: "res-derrota", empate: "res-empate" }[r.tipo];
    $("vvMesa").classList.add(clase);
    $("vvResultadoEtq").textContent = r.tipo === "natural" ? "Veintiuna a la primera" : est.modo === "practica" ? "Mesa de práctica" : "Mano resuelta";
    $("vvResultadoTitulo").textContent = r.titulo;
    $("vvResultadoRazon").textContent = r.razon;
    $("vvResultadoLinea").textContent = r.linea;
    $("vvResultado").hidden = false;
    $("vvResultado").className = "vv-resultado " + clase.replace("res-", "res-");
    // La crupier reacciona: si tú ganas, ella pierde
    if (r.gano) { crupierEstado("pierde"); decir(r.tipo === "natural" ? "natural" : est.razon === "crupier_se_pasa" || (est.resultado && est.resultado.razon === "crupier_se_pasa") ? "sePasa" : "pierde"); sonar(r.tipo === "natural" ? "natural" : "gana"); }
    else if (r.empate) { crupierEstado("empate"); decir("empate"); sonar("empate"); }
    else { crupierEstado("gana"); decir(est.resultado && est.resultado.razon === "te_pasas" ? "pasas" : "gana"); sonar("pierde"); }
    if (est.modo === "apuesta") {
      // El saldo que confirma el servidor (el de la respuesta) y, de fondo, el resto de la mesa
      const nuevo = Number(est.saldo);
      S.mesa.saldo = nuevo;
      volarMonedas(r);
      pintarSaldo(nuevo, saldoAntes);
    }
    musica(false);
    fase("fin");
    enfocarDock();
    if (est.logros_nuevos && est.logros_nuevos.length) {
      est.logros_nuevos.forEach(id => {
        const l = (S.mesa.logros || []).find(x => x.id === id);
        tostada(`Desafío completado: ${l ? l.nombre : id}`, { icono: "✦", clase: "oro", accion: "Ver desafíos", alAccion: abrirDesafios, ms: 9000 });
      });
    }
    // Estadísticas, desafíos y el sitio de la siguiente regla, sin molestar
    try {
      const m = await api.mesa();
      const saldoVisible = S.mesa.saldo;
      S.mesa = m; S.mesa.saldo = est.modo === "apuesta" ? Number(est.saldo) : m.saldo;
      pintarCabecera();
      if (Number(m.saldo) !== Number(saldoVisible) && est.modo === "apuesta") pintarSaldo(m.saldo, null);
    } catch (e) { /* si falla se actualiza en la siguiente mano */ }
  }

  function volarMonedas(r) {
    if (sinMovimiento() || S.saltar) return;
    const desde = $("vvApuestaMesa").getBoundingClientRect(), hasta = (r.gano ? $("vvSaldo") : $("vvCrupierArte")).getBoundingClientRect();
    if (!desde.width || !hasta.width) return;
    const n = r.empate ? 3 : Math.min(8, 3 + Math.round(Math.abs(r.neto) / 10));
    for (let i = 0; i < n; i++) {
      const m = document.createElement("span");
      m.className = "vv-moneda-vuelo";
      m.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#vv-moneda"/></svg>`;
      m.style.left = (desde.left + desde.width / 2) + "px"; m.style.top = (desde.top + desde.height / 2) + "px";
      document.body.appendChild(m);
      const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2), dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);
      m.animate([
        { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.2}px), calc(-50% + ${dy * 0.2 - 50}px)) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.1 }
      ], { duration: 820, delay: 200 + i * 70, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" }).finished.then(() => m.remove(), () => m.remove());
      if (i === 0) setTimeout(() => sonar("ficha"), 320);
    }
  }

  /* ---------------------------------------------------------------- acciones del jugador */
  function manejarError(e, opciones) {
    const o = opciones || {};
    const info = e && e.tipo ? e : { tipo: "servidor", mensaje: String((e && e.message) || e || ""), codigo: "" };
    if (info.codigo === "sin_servidor" || /does not exist|Could not find the function|schema cache|PGRST202/i.test(info.mensaje || "")) {
      fase("sin_servidor"); aviso(""); return;
    }
    if (info.tipo === "red") {
      S.ocupado = false;
      if (!S.mesa) fase("sin_conexion");
      aviso(V.mensajeError(info), { tipo: "error", reintentar: true });
      S.reintento = o.alReintentar || null;
      return;
    }
    aviso(V.mensajeError(info), { tipo: "error", cerrar: true });
    if (["mano_en_curso", "paso_futuro", "no_encontrada", "mano_terminada"].includes(info.codigo)) { cargarMesa(); return; }
    if (info.codigo === "sin_sesion") { S.sesion = null; fase("sin_sesion"); }
  }

  async function ejecutar(fn) {
    if (S.ocupado) return null;
    S.ocupado = true;
    document.body.classList.add("vv-ocupado");
    $("vvDock").setAttribute("aria-busy", "true");
    try { return await fn(); }
    finally { S.ocupado = false; document.body.classList.remove("vv-ocupado"); $("vvDock").removeAttribute("aria-busy"); }
  }

  async function repartir() {
    const practica = S.modo === "practica";
    if (!practica) { const motivo = V.motivoApuesta(S.apuesta, saldoActual(), S.mesa.limites); if (motivo || S.apuesta <= 0) { aviso(motivo || "Elige una apuesta con las fichas.", { tipo: "info", cerrar: true }); return; } }
    const intento = { id: window.VeintiunaApi.nuevoId(), modo: S.modo, apuesta: S.apuesta };
    S.intento = { tipo: "repartir", ...intento };
    await enviarRepartir();
  }
  async function enviarRepartir() {
    const it = S.intento;
    const est = await ejecutar(async () => {
      try { return await api.repartir(it.id, it.modo, it.apuesta); }
      catch (e) { manejarError(e, { alReintentar: enviarRepartir }); return null; }
    });
    if (!est) return;
    aviso("");
    guardado.poner("vvModo", it.modo);
    if (it.modo === "apuesta") { S.ultimaApuesta = it.apuesta; guardado.poner("vvApuesta", it.apuesta); }
    const previo = S.saldoMostrado != null ? S.saldoMostrado : saldoActual();
    S.mesa.saldo = Number(est.saldo);
    if (est.estado !== "terminada") pintarSaldo(est.saldo, previo);
    if (est.repetida) { await retomar(est); return; }
    await aplicarEstado(est, { saldoAntes: previo });
  }

  async function hacer(accion) {
    const est = S.est;
    if (!est || est.estado !== "en_curso") return;
    S.intento = { tipo: "accion", partida: est.partida, paso: est.paso, accion };
    await enviarAccion();
  }
  async function enviarAccion() {
    const it = S.intento;
    const nuevo = await ejecutar(async () => {
      try { return await api.accion(it.partida, it.paso, it.accion); }
      catch (e) { manejarError(e, { alReintentar: enviarAccion }); return null; }
    });
    if (!nuevo) return;
    aviso("");
    if (nuevo.repetida && S.est && S.est.partida === nuevo.partida && Number(nuevo.paso) === Number(S.est.paso)) return;   // ya estaba aplicada y ya la tenemos pintada
    S.mesa.saldo = Number(nuevo.saldo);
    if (nuevo.estado !== "terminada") pintarSaldo(nuevo.saldo, S.saldoMostrado);
    if (nuevo.repetida || nuevo.cerrada_por_inactividad) {
      // Se perdió la respuesta anterior o la mano se cerró sola: se vuelve a dibujar entera
      if (nuevo.estado === "terminada") { S.pintado = null; await aplicarEstado(nuevo); } else await retomar(nuevo);
      return;
    }
    await aplicarEstado(nuevo);
  }

  function intentarAccion(id, boton) {
    if (S.ocupado || S.animando) return;
    const b = (V.acciones(S.est).botones || []).find(x => x.id === id);
    if (!b) return;
    if (!b.habilitado) { aviso(b.motivo || "Esa acción no está disponible ahora.", { tipo: "info", cerrar: true }); return; }
    hacer(id);
  }

  /* ---------------------------------------------------------------- eventos */
  function alClicDock(ev) {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if (t.matches("[data-saltar]")) { pedirSaltar(); return; }
    if ("reintentar" in t.dataset) { const f = S.reintento; aviso(""); if (f) f(); return; }
    if (t.dataset.modo) { S.modo = t.dataset.modo; guardado.poner("vvModo", S.modo); pintarDock(); return; }
    if (t.dataset.ficha) {
      const f = Number(t.dataset.ficha), lim = S.mesa.limites, saldo = saldoActual();
      if (S.apuesta + f > Math.min(lim.max, saldo)) { aviso(S.apuesta + f > lim.max ? `La apuesta máxima es ${V.monedas(lim.max)}.` : `No te alcanzan las monedas: tienes ${V.monedas(saldo)}.`, { tipo: "info", cerrar: true }); return; }
      S.apuesta += f; sonar("ficha"); aviso(""); pintarDock(); const f2 = $("vvDockCuerpo").querySelector(`[data-ficha="${f}"]`); if (f2) f2.focus({ preventScroll: true }); return;
    }
    if (t.dataset.paso) {
      const lim = S.mesa.limites, nueva = S.apuesta + Number(t.dataset.paso) * lim.paso;
      S.apuesta = Math.max(0, Math.min(nueva, Math.min(lim.max, Math.floor(saldoActual() / lim.paso) * lim.paso)));
      if (Number(t.dataset.paso) > 0 && nueva > S.apuesta) aviso(nueva > lim.max ? `La apuesta máxima es ${V.monedas(lim.max)}.` : `No te alcanzan las monedas: tienes ${V.monedas(saldoActual())}.`, { tipo: "info", cerrar: true });
      sonar("ficha"); pintarDock(); const p = $("vvDockCuerpo").querySelector(`[data-paso="${t.dataset.paso}"]`); if (p) p.focus({ preventScroll: true }); return;
    }
    if ("borrar" in t.dataset) { S.apuesta = 0; aviso(""); pintarDock(); return; }
    if ("repetir" in t.dataset) { S.apuesta = V.ajustarApuesta(S.ultimaApuesta, saldoActual(), S.mesa.limites); pintarDock(); return; }
    if ("repartir" in t.dataset) { if (t.getAttribute("aria-disabled") === "true") { const m = S.modo === "practica" ? "" : (saldoActual() < S.mesa.limites.min ? "No tienes monedas para la apuesta mínima. Prueba la mesa de práctica." : (V.motivoApuesta(S.apuesta, saldoActual(), S.mesa.limites) || "Elige una apuesta con las fichas.")); if (m) aviso(m, { tipo: "info", cerrar: true }); return; } repartir(); return; }
    if ("otra" in t.dataset) { sonar("ficha"); empezarOtra(); return; }
    if (t.dataset.accion) { intentarAccion(t.dataset.accion, t); }
  }
  async function empezarOtra() {
    await barrerMesa();
    irAApuesta(false);
    enfocarDock();
  }

  function alTeclear(ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    const t = ev.target;
    if (t && (t.matches("input, textarea, select") || t.isContentEditable)) return;
    if (S.animando && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) { pedirSaltar(); }
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (S.fase === "mano" || S.fase === "fortuna") {
      const plan = V.acciones(S.est);
      const b = plan.botones.find(x => x.tecla === k);
      if (b) { ev.preventDefault(); intentarAccion(b.id); }
    } else if (S.fase === "fin" && k === "Enter" && (!t || !t.matches("button, a"))) { ev.preventDefault(); sonar("ficha"); empezarOtra(); }
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
  const cabeceraDlg = (id, titulo, sub) => `<header class="vv-dlg-cab"><div><p class="eyebrow">LAS VEINTIUNA VELAS</p><h2 id="${id}">${esc(titulo)}</h2>${sub ? `<p class="vv-dlg-sub">${esc(sub)}</p>` : ""}</div><button type="button" class="vv-cerrar" data-cerrar aria-label="Cerrar">×</button></header>`;

  function abrirReglas(foco) {
    const m = S.mesa;
    const pj = m ? Math.round(m.peajes.fortuna * 100) : 60, pv = m ? Math.round(m.peajes.voluntad * 100) : 85;
    const lim = m ? m.limites : { min: 10, max: 100, paso: 10 };
    const reglas = ["fortuna", "maldicion", "voluntad"].map(id => {
      const R = V.REGLAS[id];
      const lineas = R.detalle(id === "fortuna" ? pj + " % de la apuesta" : pv + " % de la apuesta");
      return `<article class="vv-regla-ficha" data-regla="${id}" id="vvRegla-${id}"><div class="vv-regla-icono" aria-hidden="true">${A.ICONOS[id]}</div><div><h3>${esc(R.nombre)}</h3><p class="vv-regla-lema">${esc(R.lema)}</p><ul>${lineas.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div></article>`;
    }).join("");
    abrir($("vvDlgReglas"), `${cabeceraDlg("vvDlgReglasT", "Cómo se juega", "Blackjack contra la casa, con una regla especial por mano")}
      <div class="vv-dlg-cuerpo">
        <section><h3>La mano</h3><ul>
          <li>Baraja de 52 cartas, barajada de nuevo en cada mano. Recibes dos cartas; el crupier, una boca arriba y otra oculta.</li>
          <li>El as vale 1 u 11, J, Q y K valen 10 (11 con la Maldición) y el resto, su número. Gana quien más se acerque a 21 sin pasarse.</li>
          <li>Puedes <strong>pedir carta</strong> o <strong>plantarte</strong>. Si pasas de 21, pierdes. No hay dividir, doblar, seguro ni rendición.</li>
          <li>El crupier pide con 16 o menos y se planta con 17 o más, <strong>también con un 17 blando</strong>.</li>
          <li>Un <strong>blackjack natural</strong> es un 21 con las dos primeras cartas. Un 21 conseguido pidiendo carta no lo es.</li>
        </ul></section>
        <section><h3>Pagos</h3>
          <table class="vv-tabla"><thead><tr><th>Resultado</th><th>Cobras</th></tr></thead><tbody>
            <tr><td>Victoria</td><td>1 a 1: tu apuesta y otra igual</td></tr>
            <tr><td>Blackjack natural</td><td>3 a 2: tu apuesta y una vez y media más</td></tr>
            <tr><td>Empate</td><td>Te devuelven la apuesta</td></tr>
            <tr><td>Derrota</td><td>Pierdes la apuesta</td></tr></tbody></table>
          <p>Apuestas de ${V.monedas(lim.min)} a ${V.monedas(lim.max)}, de ${V.monedas(lim.paso)} en ${V.monedas(lim.paso)}. Los peajes de las reglas no se devuelven.</p>
          <p><strong>Orden al repartir:</strong> si te pasas de 21 (solo con la Maldición), pierdes; si los dos tenéis blackjack natural, es empate; si lo tienes tú, cobras 3 a 2; si lo tiene el crupier, pierdes; si el crupier se pasa de 21 (solo con la Maldición), ganas. Si la mano sigue, es que el crupier no tiene blackjack natural.</p>
        </section>
        <section><h3>Las tres reglas especiales</h3><p>Cada mano trae una, elegida por el servidor. La próxima se enseña antes de que apuestes y no cambia hasta que la repartas.</p><div class="vv-reglas-lista">${reglas}</div></section>
        <section><h3>Mesa de práctica y desafíos</h3><ul>
          <li>La <strong>mesa de práctica</strong> usa las mismas cartas y reglas con una apuesta simbólica: no cobra ni paga monedas. Cuenta para los desafíos.</li>
          <li>Los <strong>desafíos</strong> se comprueban en el servidor. Cada uno que completes se puede reclamar una vez y da una carta del juego de Triunfos, siempre respetando los límites de la colección (como mucho una carta al día desde esta mesa).</li>
          <li>Si dejas una mano a medias, queda guardada. Pasados ${m ? m.inactividad_min : 30} minutos sin jugarla, el servidor se planta por ti.</li>
        </ul></section>
      </div>`);
    if (foco) { const el = $("vvRegla-" + foco); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("destacada"); } }
  }

  function abrirAtajos() {
    abrir($("vvDlgAtajos"), `${cabeceraDlg("vvDlgAtajosT", "Atajos de teclado")}
      <div class="vv-dlg-cuerpo"><table class="vv-tabla"><tbody>
        <tr><td><kbd>P</kbd></td><td>Pedir carta</td></tr><tr><td><kbd>L</kbd></td><td>Plantarse</td></tr>
        <tr><td><kbd>V</kbd></td><td>Última voluntad, o salvar la mano con la Fortuna</td></tr><tr><td><kbd>A</kbd></td><td>Aceptar la derrota (cuando la Fortuna te lo ofrece)</td></tr>
        <tr><td><kbd>Intro</kbd></td><td>Otra mano, cuando termina la anterior</td></tr><tr><td><kbd>Espacio</kbd></td><td>Saltar la animación</td></tr></tbody></table>
      <p>Todos los botones también se manejan con Tab e Intro.</p></div>`);
  }

  async function abrirHistorial() {
    abrir($("vvDlgHistorial"), `${cabeceraDlg("vvDlgHistorialT", "Historial", "Tus últimas manos terminadas")}<div class="vv-dlg-cuerpo"><p class="vv-dock-texto">Buscando tus manos...</p></div>`);
    try {
      const filas = await api.historial(15);
      const est = S.mesa ? S.mesa.estadisticas : null;
      const resumen = est ? `<p class="vv-historial-resumen"><strong>${est.rondas}</strong> manos · <strong>${est.victorias}</strong> ganadas · <strong>${est.derrotas}</strong> perdidas · <strong>${est.empates}</strong> empates · mejor racha <strong>${est.mejor_racha}</strong> · monedas ${V.conSigno(est.neto)} en total</p>` : "";
      const mini = cartas => cartas.map(c => `<span class="vv-mini ${A.PALOS[c.p].color === "rojo" ? "rojo" : ""}" title="${esc(A.nombreCarta(c))}"><span>${A.letraRango(c.r)}</span><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#vv-${A.PALOS[c.p].id}"/></svg></span>`).join("");
      const tabla = filas.length ? `<ul class="vv-historial">${filas.map(f => {
        const R = V.REGLAS[f.regla];
        const t = { natural: "Blackjack", victoria: "Ganada", empate: "Empate", derrota: "Perdida" }[f.resultado];
        const cuando = new Date(f.terminada).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        return `<li class="vv-hist-fila res-${f.resultado}"><div class="vv-hist-cab"><span class="vv-hist-tipo">${esc(t)}</span><span>${esc(R ? R.nombre : f.regla)} · ${f.modo === "practica" ? "práctica" : "con apuesta"}</span><time datetime="${esc(f.terminada)}">${esc(cuando)}</time></div>
          <div class="vv-hist-manos"><span><b>Tú ${f.total_jugador}</b> ${mini(f.jugador)}</span><span><b>Crupier ${f.total_crupier}</b> ${mini(f.crupier)}</span></div>
          <div class="vv-hist-neto ${Number(f.neto) > 0 ? "sube" : Number(f.neto) < 0 ? "baja" : ""}">${f.modo === "practica" ? "sin monedas" : `${V.conSigno(f.neto)} monedas${Number(f.peajes) ? ` (con peaje de ${V.monedas(f.peajes)})` : ""}`}</div></li>`;
      }).join("")}</ul>` : `<p class="vv-dock-texto">Todavía no has terminado ninguna mano.</p>`;
      $("vvDlgHistorial").querySelector(".vv-dlg-cuerpo").innerHTML = resumen + tabla;
    } catch (e) {
      $("vvDlgHistorial").querySelector(".vv-dlg-cuerpo").innerHTML = `<p class="vv-dock-texto">${esc(V.mensajeError(e))}</p>`;
    }
  }

  function abrirDesafios() {
    const m = S.mesa;
    if (!m) return;
    const nivel = n => m.logros.filter(l => l.nivel === n);
    const tarjeta = l => {
      const est = V.estadoLogro(l), pct = Math.round(100 * l.progreso / l.meta);
      return `<li class="vv-logro ${est}" data-nivel="${l.nivel}">
        <div class="vv-logro-cab"><strong>${esc(l.nombre)}</strong><span class="vv-logro-estado">${est === "reclamado" ? "Reclamado" : est === "listo" ? "Completado" : `${l.progreso} de ${l.meta}`}</span></div>
        <p>${esc(l.texto)}</p>
        <div class="vv-barra" role="progressbar" aria-label="${esc(l.nombre)}" aria-valuemin="0" aria-valuemax="${l.meta}" aria-valuenow="${l.progreso}"><i style="width:${pct}%"></i></div>
        ${est === "listo" ? `<button type="button" class="vv-boton vv-boton-principal vv-boton-chico" data-reclamar="${esc(l.id)}">Reclamar carta</button>` : ""}
        ${est === "reclamado" && l.carta ? `<small class="vv-logro-carta">Recibiste: ${esc((window.cartaPorId && window.cartaPorId(l.carta) || { nombre: l.carta }).nombre)}</small>` : ""}
      </li>`;
    };
    const apagado = !m.recompensas.activas;
    abrir($("vvDlgDesafios"), `${cabeceraDlg("vvDlgDesafiosT", "Desafíos de la mesa", "Se comprueban en el servidor y valen lo mismo con o sin apuesta")}
      <div class="vv-dlg-cuerpo">
        <p class="vv-nota-aviso vv-dlg-estado" id="vvDesafiosEstado" role="status" aria-live="polite"${S.mensajeDesafios ? "" : " hidden"}>${esc(S.mensajeDesafios || "")}</p>
        ${apagado ? `<p class="vv-nota-aviso">Las cartas de esta mesa todavía no se reparten. Tus desafíos se siguen completando y quedan guardados para cuando se enciendan.</p>` : ""}
        <p>Cada desafío que completes se puede reclamar <strong>una sola vez</strong> y da una carta de Triunfos. Los de plata y oro dan cartas mejores. Desde esta mesa se reclama como mucho una carta al día${m.recompensas.hoy ? " (hoy ya has reclamado una)" : ""}, y la carta siempre respeta los límites de la colección.</p>
        ${["bronce", "plata", "oro"].map(n => `<section class="vv-logros-nivel" data-nivel="${n}"><h3>${V.NIVELES[n]}</h3><ul class="vv-logros">${nivel(n).map(tarjeta).join("")}</ul></section>`).join("")}
      </div>`);
    $("vvDlgDesafios").querySelectorAll("[data-reclamar]").forEach(b => b.addEventListener("click", () => reclamar(b.dataset.reclamar, b)));
  }

  async function reclamar(id, boton) {
    if (S.ocupado) return;
    boton.setAttribute("aria-disabled", "true"); boton.textContent = "Reclamando...";
    let mensajeReclamo = "";
    try {
      const r = await api.reclamar(id);
      if (r && r.resultado === "carta") {
        if (window.Recompensas && window.Recompensas.mostrar) await window.Recompensas.mostrar("veintiuna", r);
        tostada("Carta añadida a tu colección.", { icono: "🂡", clase: "oro" });
      } else {
        const motivos = { "juego-inactivo": "Las cartas de esta mesa todavía no se reparten. Tu desafío sigue guardado.", "tope-diario": "Hoy ya reclamaste la carta de la mesa. Vuelve mañana: el desafío sigue guardado.", agotado: "Ahora mismo no queda ninguna carta disponible para este premio. El desafío sigue guardado." };
        mensajeReclamo = motivos[r && r.motivo] || "No se pudo entregar la carta ahora. El desafío sigue guardado.";
        tostada(mensajeReclamo, { icono: "🕯" });
      }
      S.mensajeDesafios = r && r.resultado === "carta" ? "" : mensajeReclamo;
      await cargarMesa({ soloDatos: true });
      abrirDesafios();
      S.mensajeDesafios = "";
    } catch (e) {
      tostada(V.mensajeError(e), { icono: "!" });
      const est = $("vvDesafiosEstado"); if (est) { est.hidden = false; est.textContent = V.mensajeError(e); }
      boton.removeAttribute("aria-disabled"); boton.textContent = "Reclamar carta";
    }
  }

  /* ---------------------------------------------------------------- arranque */
  function montarArte() {
    document.body.insertAdjacentHTML("afterbegin", A.sprite());
    $("vvEmblema").innerHTML = A.emblema();
    $("vvTapete").innerHTML = A.tapete();
    $("vvCrupierArte").innerHTML = A.crupier();
    $("vvZapato").innerHTML = `<span class="vv-zapato-lomo"></span><span class="vv-zapato-carta">${A.dorso()}</span><span class="vv-zapato-carta">${A.dorso()}</span>`;
    prepararVelas($("vvVelasCrupier")); prepararVelas($("vvVelasJugador"));
    velas($("vvVelasCrupier"), null, { oculto: true }); velas($("vvVelasJugador"), null, { oculto: true });
  }

  function pintarSonidoBoton() {
    const b = $("vvBtnSonido");
    b.setAttribute("aria-pressed", String(S.efectos));
    $("vvSonidoIcono").textContent = S.efectos ? "♪" : "–";
    b.classList.toggle("apagado", !S.efectos);
  }

  async function iniciar() {
    montarArte();
    pintarSonidoBoton();
    $("vvDock").addEventListener("click", alClicDock);
    $("vvMesa").addEventListener("click", ev => { if (S.animando && !ev.target.closest("button, a")) pedirSaltar(); });
    document.addEventListener("keydown", alTeclear);
    $("vvAviso").addEventListener("click", ev => {
      if (ev.target.id === "vvReintentar") { const f = S.reintento; aviso(""); if (f) f(); }
      if (ev.target.id === "vvAvisoCerrar") aviso("");
    });
    $("vvBtnReglas").addEventListener("click", () => abrirReglas());
    $("vvPlacaMas").addEventListener("click", () => abrirReglas(($("vvPlaca").dataset.regla)));
    $("vvBtnDesafios").addEventListener("click", abrirDesafios);
    $("vvBtnHistorial").addEventListener("click", abrirHistorial);
    $("vvAtajosBtn").addEventListener("click", abrirAtajos);
    $("vvBtnSonido").addEventListener("click", () => { S.efectos = !S.efectos; guardado.poner("vvEfectos", S.efectos ? "1" : "0"); pintarSonidoBoton(); if (S.efectos) sonar("ficha"); });
    window.addEventListener("resize", ajustarVolumen);
    window.addEventListener("online", () => { if (S.reintento) { const f = S.reintento; aviso("Volvió la conexión. Reintento...", { tipo: "info" }); f(); } });

    fase("cargando");
    let sesion = null;
    try { sesion = typeof fichasSesionActual === "function" ? await fichasSesionActual() : null; } catch (e) { sesion = null; }
    S.sesion = sesion;
    if (!sesion) { pintarPlaca("maldicion", "proxima", null); $("vvPlaca").hidden = true; fase("sin_sesion"); finCarga(); }
    else { await cargarMesa(); finCarga(); }
    if (typeof fichasEnCambioDeSesion === "function") {
      fichasEnCambioDeSesion(ses => {
        if (ses && !S.sesion) { S.sesion = ses; cargarMesa(); }
        else if (!ses && S.sesion) { S.sesion = null; S.mesa = null; S.est = null; limpiarManos(); pintarSaldo(NaN); $("vvPlaca").hidden = true; fase("sin_sesion"); }
      }).catch(() => {});
    }
  }
  const finCarga = () => { try { if (window.Carga && window.Carga.listo) window.Carga.listo(); } catch (e) { /* sin aviso de carga */ } };

  window.Veintiuna = { estado: S, abrirReglas, abrirDesafios };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
