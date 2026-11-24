/* =============================================================================
   LAS VEINTIUNA VELAS: la mesa (veintiuna.html)
   Pinta lo que el servidor confirma y le pide lo que el jugador hace. Las reglas, la baraja y los tokens están en docs/veintiuna.sql;
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
      vela() { ruido(0.22, 900, 0.2); tono(660, 0.12, "sine", 0.03); },
      // la campanilla de latón: dos parciales que se apagan despacio
      campana() { tono(1318, 1.1, "sine", 0.11); tono(2637, 0.7, "sine", 0.05); tono(3951, 0.35, "sine", 0.025); ruido(0.03, 5000, 0.2); },
      // golpe sordo: la campanilla no suena si no hay apuesta
      sordo() { tono(140, 0.12, "triangle", 0.12); ruido(0.05, 400, 0.3); },
      // velas que se apagan de un soplo
      soplo() { ruido(0.5, 700, 0.32); ruido(0.3, 1400, 0.12, 0.08); },
      // la crupier arrastra las fichas
      rastrillo() { ruido(0.32, 2200, 0.28); ruido(0.18, 3200, 0.18, 0.14); },
      // el sello de cera golpea el tapete
      sello() { tono(90, 0.18, "sine", 0.2); ruido(0.08, 600, 0.4); }
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
      const k = Math.max(0, Math.min(1, (ahora - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = V.monedas(animarDesde + (hasta - animarDesde) * e);
      if (k < 1) requestAnimationFrame(paso); else { el.textContent = V.monedas(hasta); S.saldoMostrado = hasta; }
    };
    requestAnimationFrame(paso);
    // con la pestaña en segundo plano el navegador pausa la animación: un temporizador deja siempre el número bueno
    S._saldoObjetivo = hasta;
    setTimeout(() => { if (S._saldoObjetivo === hasta && S.saldoMostrado !== hasta) { el.textContent = V.monedas(hasta); S.saldoMostrado = hasta; } }, dur + 200);
    el.classList.remove("sube", "baja"); void el.offsetWidth;
    el.classList.add(hasta > animarDesde ? "sube" : "baja");
    if (hasta > animarDesde) { const b = document.querySelector(".vj-bolsa"); if (b) { b.classList.remove("recibe"); void b.offsetWidth; b.classList.add("recibe"); } }
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
    const antes = el.dataset.total === "" || el.dataset.total == null ? null : Number(el.dataset.total);
    el.classList.toggle("pasado", total > 21);
    el.classList.toggle("veintiuna", total === 21);
    el.querySelectorAll("i").forEach((v, i) => v.classList.toggle("on", total != null && i < Math.min(total, 21)));
    el.dataset.total = total == null ? "" : total;
    el.style.visibility = o.oculto ? "hidden" : "";
    // Lo que se ve al cambiar: humo de todas las velas si te pasas, chispas si llegas a 21
    const Salon = window.VeintiunaSalon;
    if (!Salon || o.oculto || total == null || antes === total || S.saltar) return;
    if (total > 21 && !(antes > 21)) {
      sonar("soplo");
      el.querySelectorAll("i.on").forEach((v, i) => { if (i % 2) return; const r = v.getBoundingClientRect(); Salon.humo(r.left + r.width / 2, r.top - 4, 2); });
      if (el.classList.contains("vj-velas-jugador")) { el.classList.remove("tiembla"); void el.offsetWidth; el.classList.add("tiembla"); }
    } else if (total === 21 && antes !== 21) {
      const r = el.getBoundingClientRect();
      Salon.chispas(r.left + r.width - 10, r.top, 18, ["#fff3c4", "#ffd27a"], 0.7);
    }
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
    $("vvOjo").hidden = true;
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
    $("vvOjo").hidden = true;
  }

  function pintarTotales(est, opciones) {
    const o = opciones || {};
    const j = est ? est.jugador : null, c = est ? est.crupier : null;
    $("vvTotalJugador").textContent = j ? (j.blando && j.total <= 21 ? `${j.total} blando` : String(j.total)) : "";
    $("vvTotalJugador").className = "vv-total" + (j && j.total > 21 ? " pasado" : j && j.total === 21 ? " veintiuna" : "");
    velas($("vvVelasJugador"), j ? j.total : null, { oculto: !j });
    if (!c) { $("vvTotalCrupier").textContent = ""; velas($("vvVelasCrupier"), null, { oculto: true }); return; }
    const completo = est.estado === "terminada" && !o.ocultarCrupier;
    // Mientras su mano sigue oculta (te acabas de plantar, o se repartió un natural) solo cuenta la carta que se ve: el total de la respuesta ya es el final
    const visible = o.ocultarCrupier && c.cartas.length ? valorDeMano(c.cartas.slice(0, 1), est) : c.total;
    $("vvTotalCrupier").textContent = completo ? (c.blando && c.total <= 21 ? `${c.total} blando` : String(c.total)) : `muestra ${visible}`;
    $("vvTotalCrupier").className = "vv-total" + (completo && c.total > 21 ? " pasado" : completo && c.total === 21 ? " veintiuna" : "");
    velas($("vvVelasCrupier"), visible, { oculto: false });
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
    // los rótulos del tapete (solo existen en la mesa con amigos; en la mesa de uno lo dice la carta de la regla)
    if ($("vvLeyendaPaga")) $("vvLeyendaPaga").textContent = reglaId === "vela" ? "La veintiuna paga seis a cinco" : "La veintiuna paga tres a dos";
    if ($("vvLeyendaPlanta")) $("vvLeyendaPlanta").textContent = reglaId === "vela" ? "La casa se planta con dieciséis" : "La casa se planta con diecisiete";
    $("vvPlacaEfecto").textContent = R.resumen;
    const usada = est ? !!est.regla.usada : false;
    const fase = est ? est.fase : "";
    let estado = "";
    if (modoEtiqueta === "proxima") estado = reglaId === "maldicion" || reglaId === "vela" ? "Activa en toda la mano" : reglaId === "bufon" ? "Un dado al repartir" : "Disponible en la mano";
    else estado = R.estado(usada, fase, est && est.regla ? est.regla.evento : null);
    const chip = $("vvPlacaEstado");
    chip.textContent = estado;
    chip.className = "vv-placa-estado" + (usada ? " gastada" : fase === "fortuna" ? " urgente" : "");
    if (cambia) {
      placa.classList.remove("cambia"); void placa.offsetWidth;
      if (!sinMovimiento()) placa.classList.add("cambia");
    }
  }
  // Lo que solo tú ves: la siguiente carta (Ojo del Tahúr) y la oculta del crupier (Cartas marcadas)
  function pintarVistas(est) {
    const ojo = $("vvOjo");
    const prox = est && est.estado === "en_curso" && est.regla ? est.regla.proxima : null;
    if (prox) {
      const el = $("vvOjoCarta");
      if (el.dataset.k !== prox.r + "-" + prox.p) { el.innerHTML = A.cara(prox); el.dataset.k = prox.r + "-" + prox.p; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
      el.setAttribute("aria-label", "Siguiente carta de la baraja: " + A.nombreCarta(prox));
      ojo.hidden = false;
    } else { ojo.hidden = true; $("vvOjoCarta").dataset.k = ""; }
    const hole = manoEl("crupier").querySelector(".vv-boca-abajo");
    if (hole) {
      const v = est && est.estado === "en_curso" ? est.crupier.vista : null;
      const ya = hole.querySelector(".vv-vista");
      if (v && !ya) {
        const s = document.createElement("span");
        s.className = "vv-vista"; s.setAttribute("aria-hidden", "true"); s.innerHTML = A.cara(v);
        hole.querySelector(".vv-lado-dorso").after(s);
        hole.setAttribute("aria-label", "carta oculta, que solo tú ves: " + A.nombreCarta(v));
        sonar("giro");
      } else if (!v && ya) { ya.remove(); hole.setAttribute("aria-label", "carta oculta"); }
    }
  }
  const peajeTexto = (id) => {
    const m = S.mesa; if (!m) return "";
    const f = m.peajes[id] != null ? m.peajes[id] : 0;
    return `${Math.round(f * 100)} % de la apuesta`;
  };

  /* ---------------------------------------------------------------- la apuesta sobre la mesa (montoncito de fichas) */
  function pintarFichasMesa(est) {
    if (!est) { pintarPila(0); return; }
    pintarPila(Number(est.apuesta), { practica: est.modo === "practica", peajes: Number(est.peajes) || 0 });
  }
  // La pila del círculo de la apuesta: de las fichas más grandes a las más pequeñas, como mucho 9. «cae» hace rebotar la de arriba.
  function pintarPila(cantidad, opciones) {
    const o = opciones || {};
    const el = $("vvApuestaMesa");
    if (!(cantidad > 0)) { el.innerHTML = ""; el.classList.remove("hay"); el.dataset.n = "0"; return; }
    let resto = Number(cantidad);
    const den = [5000, 1000, 500, 100, 50, 20, 10];
    const fichas = [];
    for (const d of den) while (resto >= d && fichas.length < 9) { fichas.push(d); resto -= d; }
    if (resto > 0 && fichas.length < 9) fichas.push(10);
    const antes = Number(el.dataset.n || 0);
    const pila = fichas.map((d, i) => `<span class="vv-ficha-pila${o.cae && i >= antes - 1 && i === fichas.length - 1 ? " cae" : ""}" style="--k:${i}">${A.ficha(d)}</span>`).join("");
    el.innerHTML = `<span class="vv-pila">${pila}</span><span class="vv-apuesta-valor">${o.practica ? "práctica" : V.monedas(cantidad)}${o.peajes ? `<small>+ peaje ${V.monedas(o.peajes)}</small>` : ""}</span>`;
    el.dataset.n = String(fichas.length);
    el.classList.add("hay");
    el.setAttribute("aria-hidden", "true");
  }
  // Lo que vuela por la pantalla se quita al terminar o, como mucho, pasado su tiempo (con la pestaña oculta las animaciones se congelan)
  function alTerminar(anim, el, ms) {
    return Promise.race([anim.finished.catch(() => {}), new Promise(ok => setTimeout(ok, ms + 400))]).then(() => { try { anim.finish(); } catch (e) { /* ya terminó */ } el.remove(); });
  }
  // Una ficha vuela en arco desde el fichero hasta el círculo de la apuesta
  function lanzarFicha(desde, valor) {
    const destino = $("vvApuestaMesa").getBoundingClientRect();
    if (!desde || sinMovimiento()) return Promise.resolve();
    const lado = Math.max(28, Math.round(destino.width || 48));
    const f = document.createElement("span");
    f.className = "vj-ficha-vuelo";
    f.style.width = f.style.height = lado + "px";
    f.innerHTML = A.ficha(valor);
    const x0 = desde.left + desde.width / 2 - lado / 2, y0 = desde.top + desde.height * 0.3 - lado / 2;
    const x1 = destino.left + destino.width / 2 - lado / 2, y1 = destino.top + destino.height * 0.55 - lado / 2;
    f.style.left = x0 + "px"; f.style.top = y0 + "px";
    document.body.appendChild(f);
    const dx = x1 - x0, dy = y1 - y0, alto = Math.min(-80, dy - 120);
    const a = f.animate([
      { transform: "translate(0,0) rotate(0deg) scale(.9)" },
      { transform: `translate(${dx * 0.5}px, ${alto}px) rotate(200deg) scale(1.08)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(1)` }
    ], { duration: 420, easing: "cubic-bezier(.35,.1,.4,1)" });
    return alTerminar(a, f, 420);
  }

  /* ---------------------------------------------------------------- el dock: apuesta, acciones y fin de mano */
  function pintarDock() {
    const cuerpo = $("vvDockCuerpo");
    const dock = $("vvDock");
    dock.dataset.fase = S.fase;
    dock.dataset.regla = S.est && S.est.regla ? S.est.regla.id : "";
    const m = S.mesa;
    if (S.fase === "cargando") { cuerpo.innerHTML = `<p class="vv-dock-texto">Encendiendo las velas...</p>`; return; }
    if (S.fase === "sin_sesion") {
      cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>Inicia sesión para sentarte</h2><p>La mesa guarda tus tokens, tus manos y tus desafíos en tu cuenta. Pulsa «Iniciar sesión» arriba a la derecha.</p></div>`;
      return;
    }
    if (S.fase === "sin_conexion") {
      cuerpo.innerHTML = `<div class="vv-dock-aviso"><h2>La mesa no responde</h2><p>No hay conexión con el servidor. Si tenías una mano abierta sigue guardada.</p><button type="button" class="vv-boton vv-boton-principal" data-reintentar><span class="vv-boton-texto">Reintentar</span></button></div>`;
      return;
    }
    if (S.fase === "sin_servidor") {
      const admin = (() => { try { return localStorage.getItem("compendioAdmin") === "1"; } catch (e) { return false; } })();
      cuerpo.innerHTML = admin ? `<div class="vv-dock-aviso"><h2>La mesa todavía no está montada</h2><p>Falta ejecutar <code>docs/veintiuna.sql</code> en Supabase. Cuando se ejecute, recarga esta página.</p></div>` : `<div class="vv-dock-aviso"><h2>La mesa todavía no está abierta</h2><p>Las velas se están encendiendo. Vuelve en un rato.</p></div>`;
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
    const peajeLinea = regla && m.peajes[regla.id] != null ? ` Peaje: ${peajeTexto(regla.id)}.` : "";
    const bloqueada = practica ? false : (!!motivo || S.apuesta <= 0 || sinFondos);
    // el fichero: cada valor es una columna de fichas (más alta cuantas más caben con tu saldo)
    const columnas = fichas.map(f => {
      const cabe = (S.apuesta + f) <= Math.min(V.tope(lim), saldo);
      const alto = Math.max(1, Math.min(5, Math.floor((saldo - S.apuesta) / f)));
      return `<button type="button" class="vv-ficha${cabe ? "" : " sin-fondos"}" data-ficha="${f}" aria-disabled="${!cabe}" aria-label="Añadir ${f} tokens"${cabe ? "" : ` title="${esc(S.apuesta + f > V.tope(lim) ? "Pasarías la apuesta máxima de " + V.monedas(lim.max) : "No te alcanzan los tokens")}"`}>${window.VeintiunaSalon ? window.VeintiunaSalon.columna(f, cabe ? alto : 1) : A.ficha(f)}<span class="vj-ficha-valor" aria-hidden="true">${V.monedas(f)}</span></button>`;
    }).join("");
    cuerpo.innerHTML = `
      <div class="vj-apostar vv-apuesta-panel">
        <div class="vv-modos" role="radiogroup" aria-label="Modalidad de la mesa">
          <button type="button" role="radio" aria-checked="${!practica}" class="vv-modo${!practica ? " activo" : ""}" data-modo="apuesta"><strong>Con apuesta</strong><small>tokens de juego</small></button>
          <button type="button" role="radio" aria-checked="${practica}" class="vv-modo${practica ? " activo" : ""}" data-modo="practica"><strong>Práctica</strong><small>sin tokens ni desafíos</small></button>
        </div>
        ${practica ? `
          <div class="vv-practica"><p>Apuesta simbólica de <strong>${V.monedas(lim.min)}</strong>: no se cobra ni se paga.${esc(peajeLinea)} Las mismas cartas, las mismas reglas.</p></div>`
        : `
          <div class="vj-fichero-caja">
            <div class="vv-fichas" role="group" aria-label="Fichas para apostar">${columnas}</div>
          </div>
          <div class="vv-apuesta-total">
            <div class="vj-cifra-fila">
              <button type="button" class="vv-paso" data-paso="-1" aria-label="Bajar la apuesta ${V.monedas(lim.paso)}" ${S.apuesta <= 0 ? 'aria-disabled="true"' : ""}>−</button>
              <div class="vv-apuesta-cifra" aria-live="polite"><small>Apuesta</small><strong id="vvApuestaCifra">${V.monedas(S.apuesta)}</strong></div>
              <button type="button" class="vv-paso" data-paso="1" aria-label="Subir la apuesta ${V.monedas(lim.paso)}">+</button>
            </div>
            <div class="vj-atajos-apuesta">
              <button type="button" class="vv-enlace" data-borrar ${S.apuesta <= 0 ? 'aria-disabled="true"' : ""}>Quitar</button>
              <button type="button" class="vv-enlace" data-todo>Todo</button>
              ${S.ultimaApuesta && S.ultimaApuesta !== S.apuesta ? `<button type="button" class="vv-enlace" data-repetir>Repetir ${V.monedas(S.ultimaApuesta)}</button>` : ""}
            </div>
          </div>`}
        <button type="button" class="vj-campana" data-repartir ${bloqueada ? 'aria-disabled="true"' : ""} aria-keyshortcuts="Enter">
          <span class="vj-campana-dib">${window.VeintiunaSalon ? window.VeintiunaSalon.campana() : ""}</span>
          <span class="vv-boton-texto">Repartir</span><span class="vv-boton-sub">${practica ? "mano de práctica" : S.apuesta > 0 ? "apuesta " + V.monedas(S.apuesta) : "elige una apuesta"}</span><kbd aria-hidden="true">↵</kbd></button>
        ${sinFondos ? `<button type="button" class="vv-boton" data-modo="practica"><span class="vv-boton-texto">Jugar en la práctica</span></button>` : ""}
        ${practica ? "" : `<p class="vv-nota-apuesta${motivo && S.apuesta > 0 ? " mal" : ""}${sinFondos ? " sin" : ""}" id="vvNotaApuesta">${sinFondos
            ? `No tienes tokens para la apuesta mínima (${V.monedas(lim.min)}). Puedes vender una carta al <a href="hipodromo.html#cartas" data-buhonero>Buhonero</a> o jugar en la mesa de práctica.`
            : motivo && S.apuesta > 0 ? esc(motivo)
            : `${V.textoLimites(lim)} Victoria 1 a 1, blackjack natural 3 a 2, empate devuelve.${esc(peajeLinea)}`}</p>`}
      </div>`;
    // la pila del círculo enseña la apuesta que estás montando (si hay fichas en el aire, la pone al día la que aterriza)
    if (!S.vuelos) pintarPila(practica ? 0 : S.apuesta);
  }

  // Los gestos de la mesa de verdad: tocar el tapete para pedir, pasar la mano por encima para plantarse
  const GESTOS = {
    pedir: `<svg class="vj-gesto" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M13 27V11a2 2 0 0 1 4 0v8l6 1c2 .4 3 2 2.6 4L24 28H14z" fill="currentColor" opacity=".9"/><path d="M8 6l3 3M15 2v4M22 6l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    plantar: `<svg class="vj-gesto" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M4 18c0-2 2-3 4-2l3 2V8a2 2 0 0 1 4 0v6-9a2 2 0 0 1 4 0v9-7a2 2 0 0 1 4 0v10c0 6-3 10-9 10-5 0-7-3-10-9z" fill="currentColor" opacity=".9"/><path d="M2 8c2-2 3-2 5 0M26 4c2-2 3-2 5 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
    aceptar: `<svg class="vj-gesto" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M6 22h20M9 18h14M12 14h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`
  };
  function pintarAcciones(cuerpo) {
    const est = S.est, plan = V.acciones(est);
    const fortuna = plan.fase === "fortuna";
    const icono = b => b.especial || b.id === "fortuna" ? `<span class="vj-icono-regla" aria-hidden="true">${A.ICONOS[est.regla.id] || ""}</span>` : GESTOS[b.id] || "";
    cuerpo.innerHTML = `
      <div class="vv-acciones${fortuna ? " vv-acciones-fortuna" : ""}">
        ${fortuna ? `<p class="vv-acciones-aviso" id="vvAvisoFortuna"><strong>Te pasaste de 21.</strong> La Fortuna puede convertir esa última carta en un as de valor 1, pero cobra su peaje.</p>` : ""}
        <div class="vv-botones vj-entra">
          ${plan.botones.map(b => `<button type="button" class="vv-boton${b.principal ? " vv-boton-principal" : ""}${b.especial ? " vv-boton-especial" : ""}${b.id === "aceptar" ? " vv-boton-fantasma" : ""}" data-accion="${b.id}" aria-disabled="${!b.habilitado}"${b.motivo ? ` data-motivo="${esc(b.motivo)}"` : ""} aria-keyshortcuts="${b.tecla}">
            <span class="vv-boton-texto">${icono(b)}${esc(b.texto)}</span>${b.sub ? `<span class="vv-boton-sub">${esc(b.sub)}</span>` : ""}<kbd aria-hidden="true">${b.tecla}</kbd></button>`).join("")}
        </div>
      </div>`;
  }

  function pintarFin(cuerpo) {
    const r = V.resultado(S.est);
    const lim = S.mesa.limites;
    const sin = S.est.modo === "apuesta" && saldoActual() < lim.min;
    cuerpo.innerHTML = `
      <div class="vv-fin vj-entra">
        <div class="vv-fin-resumen"><strong>${esc(r ? r.titulo : "")}</strong><span>${esc(r ? r.linea : "")}</span></div>
        <button type="button" class="vj-campana" data-otra aria-keyshortcuts="Enter"><span class="vj-campana-dib">${window.VeintiunaSalon ? window.VeintiunaSalon.campana() : ""}</span><span class="vv-boton-texto">Otra mano</span><span class="vv-boton-sub">${sin ? "cambia de apuesta" : "elige tu apuesta"}</span><kbd aria-hidden="true">↵</kbd></button>
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
    luz("");
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
    pintarTotales(est); pintarPlaca(est.regla.id, "actual", est); pintarFichasMesa(est); pintarVistas(est);
    crupierEstado(est.fase === "fortuna" ? "jugador" : "jugador");
    leer(V.anuncio(null, est));
    musica(true);
    fase(est.fase === "fortuna" ? "fortuna" : "mano");
    enfocarDock();
    tostada("Recuperé tu mano abierta. Sigue donde la dejaste.", { icono: "🕯" });
  }

const luz = (t, ms) => { try { if (window.VeintiunaSalon) window.VeintiunaSalon.luz(t, ms); } catch (e) { /* sin sala */ } };
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
      luz(est.fase === "fortuna" ? "fortuna" : "");
      enfocarDock();
    }
  }

  async function nuevaMano(est) {
    fase("espera");
    luz("");
    $("vvResultado").hidden = true;
    $("vvMesa").classList.remove("res-victoria", "res-derrota", "res-empate", "res-natural");
    await barrerMesa();
    musica(true);
    const placa = est.regla.id;
    pintarPlaca(placa, "actual", est);
    crupierEstado("reparto");
    decir(placa === "maldicion" ? "maldicion" : placa === "vela" ? "vela" : "reparto", 0.55);
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
    if (est.regla.evento) await bufonActua(est);
  }

  // El Pacto del Bufón ya cambió una carta en el servidor; aquí se cuenta con un destello en la carta afectada
  async function bufonActua(est) {
    const ev = est.regla.evento;
    if (ev === "nada") { decir("bufonNada", 1); tostada("El dado del Bufón no cambia nada esta mano.", { icono: "🎲", ms: 5000 }); return; }
    const cual = ev === "crupier" ? manoEl("crupier").firstElementChild : manoEl("jugador").firstElementChild;
    decir("bufon", 1);
    sonar("giro");
    tostada(ev === "crupier" ? "El Bufón cambia la carta visible del crupier." : "El Bufón cambia tu primera carta.", { icono: "🎲", ms: 6000 });
    if (cual) { cual.classList.add("convertida"); setTimeout(() => cual.classList.remove("convertida"), 1400); }
    await esperar(400);
  }

  // Trueque con la casa: tu primera carta y la visible del crupier cruzan la mesa y se cambian
  async function hacerTrueque(est) {
    const eJ = manoEl("jugador").firstElementChild, eC = manoEl("crupier").firstElementChild;
    if (!eJ || !eC) return;
    decir("trueque", 1);
    sonar("giro");
    const rJ = eJ.getBoundingClientRect(), rC = eC.getBoundingClientRect();
    const dx = (rC.left + rC.width / 2) - (rJ.left + rJ.width / 2), dy = (rC.top + rC.height / 2) - (rJ.top + rJ.height / 2);
    await Promise.all([
      animar(eJ, [{ transform: "none", zIndex: 5 }, { transform: `translate(${dx}px, ${dy}px) rotate(8deg)`, zIndex: 5 }], { duration: 480 }),
      animar(eC, [{ transform: "none", zIndex: 5 }, { transform: `translate(${-dx}px, ${-dy}px) rotate(-8deg)`, zIndex: 5 }], { duration: 480 })
    ]);
    const cartaJ = est.jugador.cartas[0], cartaC = est.crupier.cartas[0];
    [[eJ, cartaJ], [eC, cartaC]].forEach(([el, c]) => {
      el.getAnimations().forEach(a => { try { a.cancel(); } catch (e) { /* ya cancelada */ } });
      el.querySelector(".vv-lado-cara").innerHTML = A.cara(c);
      el.setAttribute("aria-label", A.nombreCarta(c));
      el.dataset.r = c.r; el.dataset.p = c.p;
      el.classList.add("convertida"); setTimeout(() => el.classList.remove("convertida"), 1400);
    });
  }

  async function continuarMano(est, previo, antes) {
    let nJ = antes.nJ;
    if (previo && previo.regla.id === "trueque" && !previo.regla.usada && est.regla.usada) await hacerTrueque(est);
    // La Última voluntad cambia la última carta: la vieja se retira (vuelve al mazo) y la nueva llega en su lugar
    if (previo && previo.regla.id === "voluntad" && !previo.regla.usada && est.regla.usada && est.jugador.cartas.length >= nJ) {
      const viejo = manoEl("jugador").lastElementChild;
      if (viejo) {
        decir("voluntad", 0.9);
        sonar("giro");
        const z = posicionZapato(), r = viejo.getBoundingClientRect();
        await animar(viejo, [{ transform: "none", opacity: 1 }, { transform: `translate(${z.x - (r.left + r.width / 2)}px, ${z.y - (r.top + r.height / 2)}px) scale(.5) rotate(18deg)`, opacity: 0 }], { duration: 300 });
        viejo.remove(); ajustarAbanico(manoEl("jugador"));
        nJ = nJ - 1;
        S.pintado.nJ = nJ;
      }
    }
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
    pintarTotales(est, { ocultarCrupier: est.estado === "terminada" });
    pintarPlaca(est.regla.id, "actual", est);
    pintarFichasMesa(est);
    pintarVistas(est);
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
    efectosDeResultado(r);
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

  // El sello del resultado cae sobre el tapete: polvo al golpear, chispas si ganas, la sala cambia de luz
  function efectosDeResultado(r) {
    const Salon = window.VeintiunaSalon;
    if (!Salon) return;
    Salon.luz(r.tipo === "natural" ? "natural" : r.gano ? "gana" : r.empate ? "" : "pierde", r.gano ? 2600 : 0);
    if (sinMovimiento() || S.saltar) return;
    setTimeout(() => {
      const t = $("vvResultadoTitulo").getBoundingClientRect();
      if (!t.width) return;
      sonar("sello");
      Salon.polvo(t.left + t.width / 2, t.bottom - 6, 22);
      Salon.temblor($("vvFieltro"), r.tipo === "natural" ? 5 : 3);
      if (r.tipo === "natural") {
        Salon.chispas(t.left + t.width / 2, t.top + t.height / 2, 70, ["#fff3c4", "#ffd27a", "#ffb24a", "#ffffff"], 1.3);
        setTimeout(() => Salon.chispas(t.left + t.width * 0.2, t.top, 24, ["#ffd27a", "#fff3c4"], 0.8), 260);
        setTimeout(() => Salon.chispas(t.right - t.width * 0.2, t.top, 24, ["#ffd27a", "#fff3c4"], 0.8), 420);
      } else if (r.gano) Salon.chispas(t.left + t.width / 2, t.top + t.height / 2, 34, ["#ffd27a", "#ffb24a", "#fff3c4"], 1);
    }, 230);
  }

  // Las fichas de verdad: si ganas, la casa paga desde su bandeja y tu montón vuelve a la bolsa; si pierdes, la crupier se lo lleva
  function volarMonedas(r) {
    if (sinMovimiento() || S.saltar) return;
    const pila = $("vvApuestaMesa").querySelector(".vv-pila");
    const etq = $("vvApuestaMesa").querySelector(".vv-apuesta-valor");
    if (etq) setTimeout(() => { etq.style.visibility = "hidden"; }, r.gano ? 1300 : 700);
    const bolsa = document.querySelector(".vj-bolsa-dib") || $("vvSaldo");
    const cera = $("vvCrupierArte").getBoundingClientRect();
    if (!pila || !bolsa || !cera.width) return;
    const bandeja = { x: cera.left + cera.width / 2, y: cera.bottom - cera.height * 0.06 };
    const fichasDe = () => [...pila.querySelectorAll(".vv-ficha-pila")];
    const volar = (el, x, y, retraso, dur) => {
      const r0 = el.getBoundingClientRect();
      const c = el.cloneNode(true);
      c.className = "vj-ficha-vuelo";
      Object.assign(c.style, { left: r0.left + "px", top: r0.top + "px", width: r0.width + "px", height: r0.height + "px" });
      document.body.appendChild(c);
      el.style.visibility = "hidden";
      const dx = x - (r0.left + r0.width / 2), dy = y - (r0.top + r0.height / 2);
      const a = c.animate([
        { transform: "translate(0,0) rotate(0)" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) rotate(160deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(300deg) scale(.6)`, opacity: 0.2 }
      ], { duration: dur || 560, delay: retraso, easing: "cubic-bezier(.4,.1,.4,1)", fill: "both" });
      return alTerminar(a, c, (dur || 560) + retraso);
    };
    const haciaBolsa = (retraso) => {
      const b = bolsa.getBoundingClientRect();
      fichasDe().reverse().forEach((el, i) => volar(el, b.left + b.width / 2, b.top + b.height * 0.55, retraso + i * 55));
      setTimeout(() => sonar("ficha"), retraso + 380);
    };
    if (r.gano) {
      // la paga: unas fichas salen de la bandeja de la casa y caen sobre tu montón
      const p = pila.getBoundingClientRect();
      const n = Math.min(6, 2 + Math.round(Math.abs(r.neto) / Math.max(10, Number(S.est && S.est.apuesta) || 10)));
      for (let i = 0; i < n; i++) {
        const f = document.createElement("span");
        f.className = "vj-ficha-vuelo";
        const lado = p.width || 48;
        Object.assign(f.style, { left: (bandeja.x - lado / 2) + "px", top: (bandeja.y - lado / 2) + "px", width: lado + "px", height: lado + "px" });
        f.innerHTML = A.ficha([10, 20, 50, 100][i % 4]);
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 2600 + i * 120);
        f.animate([
          { transform: "translate(0,0) scale(.7)", opacity: 0 },
          { transform: `translate(${(p.left + p.width / 2 - bandeja.x) * 0.5}px, ${(p.top - bandeja.y) * 0.5 - 50}px) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${p.left + p.width / 2 - bandeja.x}px, ${p.top + p.height * 0.4 - bandeja.y}px) scale(1)`, opacity: 1 }
        ], { duration: 520, delay: 380 + i * 80, easing: "cubic-bezier(.35,.1,.4,1)", fill: "both" }).finished.then(() => {
          // y luego van con el resto a tu bolsa
          const b = bolsa.getBoundingClientRect(), q = f.getBoundingClientRect();
          return f.animate([{ transform: `translate(${p.left + p.width / 2 - bandeja.x}px, ${p.top + p.height * 0.4 - bandeja.y}px)` }, { transform: `translate(${b.left + b.width / 2 - bandeja.x}px, ${b.top + b.height / 2 - bandeja.y}px) scale(.6)`, opacity: 0.2 }], { duration: 520, delay: 380 + (n - i) * 40, easing: "cubic-bezier(.4,.1,.4,1)", fill: "both" }).finished;
        }).then(() => f.remove(), () => f.remove());
      }
      setTimeout(() => sonar("ficha"), 820);
      haciaBolsa(1100);
    } else if (r.empate) {
      haciaBolsa(500);
    } else {
      // la crupier arrastra tu montón hasta su bandeja
      setTimeout(() => sonar("rastrillo"), 520);
      fichasDe().forEach((el, i) => volar(el, bandeja.x + (i - 2) * 10, bandeja.y, 520 + i * 40, 640));
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
      if (S.apuesta + f > Math.min(V.tope(lim), saldo)) { aviso(S.apuesta + f > V.tope(lim) ? `La apuesta máxima es ${V.monedas(lim.max)}.` : `No te alcanzan los tokens: tienes ${V.monedas(saldo)}.`, { tipo: "info", cerrar: true }); return; }
      const desde = t.getBoundingClientRect();
      S.apuesta += f; aviso("");
      S.vuelos = (S.vuelos || 0) + 1;
      pintarDock();
      lanzarFicha(desde, f).then(() => {
        S.vuelos = Math.max(0, S.vuelos - 1);
        sonar("ficha");
        if (S.fase === "apuesta" && S.modo === "apuesta") pintarPila(S.apuesta, { cae: true });
      });
      const f2 = $("vvDockCuerpo").querySelector(`[data-ficha="${f}"]`); if (f2) f2.focus({ preventScroll: true }); return;
    }
    if (t.dataset.paso) {
      const lim = S.mesa.limites, nueva = S.apuesta + Number(t.dataset.paso) * lim.paso;
      S.apuesta = Math.max(0, Math.min(nueva, Math.min(V.tope(lim), Math.floor(saldoActual() / lim.paso) * lim.paso)));
      if (Number(t.dataset.paso) > 0 && nueva > S.apuesta) aviso(nueva > V.tope(lim) ? `La apuesta máxima es ${V.monedas(lim.max)}.` : `No te alcanzan los tokens: tienes ${V.monedas(saldoActual())}.`, { tipo: "info", cerrar: true });
      sonar("ficha"); pintarDock(); const p = $("vvDockCuerpo").querySelector(`[data-paso="${t.dataset.paso}"]`); if (p) p.focus({ preventScroll: true }); return;
    }
    if ("borrar" in t.dataset) { S.apuesta = 0; aviso(""); pintarDock(); return; }
    if ("todo" in t.dataset) { S.apuesta = V.ajustarApuesta(Infinity, saldoActual(), S.mesa.limites); sonar("ficha"); aviso(""); pintarDock(); const f2 = $("vvDockCuerpo").querySelector("[data-todo]"); if (f2) f2.focus({ preventScroll: true }); return; }
    if ("repetir" in t.dataset) { S.apuesta = V.ajustarApuesta(S.ultimaApuesta, saldoActual(), S.mesa.limites); pintarDock(); return; }
    if ("repartir" in t.dataset) { tocarCampana(t); return; }
    if ("otra" in t.dataset) { sonarCampana(t); empezarOtra(); return; }
    if (t.dataset.accion) { intentarAccion(t.dataset.accion, t); }
  }
  // La campanilla: se hunde, suena y la crupier reparte. Sin apuesta válida da un golpe sordo y dice qué falta.
  function sonarCampana(b) {
    if (b) { b.classList.remove("suena"); void b.offsetWidth; b.classList.add("suena"); }
    sonar("campana");
  }
  function tocarCampana(b) {
    if (S.ocupado || S.animando) return;
    if (b && b.getAttribute("aria-disabled") === "true") {
      sonar("sordo");
      if (window.VeintiunaSalon) window.VeintiunaSalon.temblor(b, 3);
      const m = S.modo === "practica" ? "" : (saldoActual() < S.mesa.limites.min ? "No tienes tokens para la apuesta mínima. Prueba la mesa de práctica." : (V.motivoApuesta(S.apuesta, saldoActual(), S.mesa.limites) || "Elige una apuesta con las fichas."));
      if (m) aviso(m, { tipo: "info", cerrar: true });
      return;
    }
    sonarCampana(b);
    repartir();
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
    } else if (S.fase === "fin" && k === "Enter" && (!t || !t.matches("button, a"))) { ev.preventDefault(); sonarCampana(document.querySelector("[data-otra]")); empezarOtra(); }
    else if (S.fase === "apuesta" && k === "Enter" && (!t || !t.matches("button, a"))) { ev.preventDefault(); tocarCampana(document.querySelector("[data-repartir]")); }
  }

  /* ---------------------------------------------------------------- diálogos */
  // Cada diálogo es un objeto de la sala: el tablón y el libro de cuentas envuelven su contenido en su material
  const MATERIAL = { "vj-dlg-tablon": "vj-tablero", "vj-dlg-cuentas": "vj-cuentas" };
  function abrir(dlg, html) {
    const envoltorio = Object.keys(MATERIAL).find(c => dlg.classList.contains(c));
    dlg.innerHTML = envoltorio ? `<div class="${MATERIAL[envoltorio]}">${html}</div>` : html;
    if (!sinMovimiento()) sonar(envoltorio === "vj-dlg-cuentas" || dlg.id === "vvDlgReglas" ? "carta" : "giro");
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

  // El libro de la casa: a la izquierda el índice, a la derecha el capítulo. Cambiar de capítulo pasa la hoja.
  function capitulosReglas() {
    const m = S.mesa;
    const por = { fortuna: 60, voluntad: 50, ojo: 35, marcadas: 18, trueque: 100 };
    const peajeDe = id => (m && m.peajes && m.peajes[id] != null ? Math.round(m.peajes[id] * 100) : por[id]) + " % de la apuesta";
    const lim = m ? m.limites : { min: 10, max: 100, paso: 10 };
    const caps = [
      { id: "mano", titulo: "La mano", html: `<h3>La mano</h3><ul>
          <li>Baraja de 52 cartas, barajada de nuevo en cada mano. Recibes dos cartas; el crupier, una boca arriba y otra oculta.</li>
          <li>El as vale 1 u 11, J, Q y K valen 10 (11 con la Maldición) y el resto, su número. Gana quien más se acerque a 21 sin pasarse.</li>
          <li>Puedes <strong>pedir carta</strong> o <strong>plantarte</strong>. Si pasas de 21, pierdes. No hay dividir, doblar, seguro ni rendición.</li>
          <li>El crupier pide con 16 o menos y se planta con 17 o más, <strong>también con un 17 blando</strong>. Con la Vela corta se planta ya con 16.</li>
          <li>Un <strong>blackjack natural</strong> es un 21 con las dos primeras cartas. Un 21 conseguido pidiendo carta no lo es.</li>
        </ul>
        <p class="vj-pie-hoja">Las velas de tu candelero cuentan tus puntos: una por punto, hasta 21. Si te pasas, se apagan.</p>` },
      { id: "pagos", titulo: "Pagos", html: `<h3>Pagos</h3>
          <table class="vv-tabla"><thead><tr><th>Resultado</th><th>Cobras</th></tr></thead><tbody>
            <tr><td>Victoria</td><td>1 a 1: tu apuesta y otra igual</td></tr>
            <tr><td>Blackjack natural</td><td>3 a 2: tu apuesta y una vez y media más (6 a 5 con la Vela corta)</td></tr>
            <tr><td>Empate</td><td>Te devuelven la apuesta</td></tr>
            <tr><td>Derrota</td><td>Pierdes la apuesta</td></tr></tbody></table>
          <p>${V.sinTope(lim) ? `Apuestas desde ${V.monedas(lim.min)}, de ${V.monedas(lim.paso)} en ${V.monedas(lim.paso)}, sin máximo: puedes apostar todo lo que tengas.` : `Apuestas de ${V.monedas(lim.min)} a ${V.monedas(lim.max)}, de ${V.monedas(lim.paso)} en ${V.monedas(lim.paso)}.`} Los peajes de las reglas no se devuelven.</p>
          <h4>Orden al repartir</h4>
          <p>Si te pasas de 21 (solo con la Maldición), pierdes; si los dos tenéis blackjack natural, es empate; si lo tienes tú, cobras 3 a 2; si el crupier se pasa de 21 (solo con la Maldición), ganas. Si la mano sigue, se juega con normalidad. Un blackjack natural del crupier no corta la mano: la juegas igual, pero su natural gana a cualquier 21 que no sea natural.</p>` }
    ];
    V.ORDEN_REGLAS.forEach(id => {
      const R = V.REGLAS[id];
      caps.push({ id, titulo: R.nombre, html: `<div class="vj-regla-cab vv-regla-ficha" data-regla="${id}" id="vvRegla-${id}"><div class="vv-regla-icono" aria-hidden="true">${A.ICONOS[id]}</div><div><h3>${esc(R.nombre)}</h3><p class="vv-regla-lema">${esc(R.lema)}</p></div></div>
        <ul>${R.detalle(peajeDe(id)).map(l => `<li>${esc(l)}</li>`).join("")}</ul>
        <p class="vj-pie-hoja">Cada mano trae una de las ocho reglas, elegida por el servidor. La próxima se enseña en su atril antes de que apuestes y no cambia hasta que la repartas.</p>` });
    });
    caps.push({ id: "practica", titulo: "Práctica y desafíos", html: `<h3>Práctica y desafíos</h3><ul>
          <li>La <strong>mesa de práctica</strong> usa las mismas cartas y reglas con una apuesta simbólica: no cobra ni paga tokens. No cuenta para los desafíos ni para las rachas: para aprender las reglas.</li>
          <li>Los <strong>desafíos</strong> se comprueban en el servidor. Cada uno que completes se puede reclamar una vez y da una carta del juego de Triunfos, siempre respetando los límites de la colección (como mucho una carta al día desde esta mesa). Los desafíos se reinician cada día: puedes completarlos de nuevo, y lo que no reclames antes del reinicio se pierde.</li>
          <li>Si dejas una mano a medias, queda guardada. Pasados ${m ? m.inactividad_min : 30} minutos sin jugarla, el servidor se planta por ti.</li>
        </ul>
        <p class="vj-pie-hoja">Los tokens de juego son los mismos del <a href="hipodromo.html">Hipódromo</a>. La baraja y las reglas viven en el servidor: ni tú ni nadie pueden saber la carta oculta.</p>` });
    caps.push({ id: "atajos", titulo: "Atajos de teclado", html: `<h3>Atajos de teclado</h3>${tablaAtajos()}` });
    return caps;
  }
  function tablaAtajos() {
    return `<table class="vv-tabla"><tbody>
        <tr><td><kbd>P</kbd></td><td>Pedir carta</td></tr><tr><td><kbd>L</kbd></td><td>Plantarse</td></tr>
        <tr><td><kbd>V</kbd></td><td>La acción de la regla de la mano: Última voluntad, Ojo del Tahúr, Cartas marcadas, Trueque o salvar la mano con la Fortuna</td></tr><tr><td><kbd>A</kbd></td><td>Aceptar la derrota (cuando la Fortuna te lo ofrece)</td></tr>
        <tr><td><kbd>Intro</kbd></td><td>Tocar la campanilla: repartir, u otra mano cuando termina la anterior</td></tr><tr><td><kbd>Espacio</kbd></td><td>Saltar la animación</td></tr></tbody></table>
      <p>Todos los botones también se manejan con Tab e Intro.</p>`;
  }
  function abrirReglas(foco) {
    const caps = capitulosReglas();
    let actual = caps.find(c => c.id === foco) ? foco : "mano";
    const dlg = $("vvDlgReglas");
    const indice = () => caps.map((c, i) => `<li><button type="button" data-cap="${c.id}"${c.id === actual ? " aria-current=\"page\"" : ""}>${esc(c.titulo)}<span>${i + 1}</span></button></li>`).join("");
    abrir(dlg, `<div class="vj-libro">
        <button type="button" class="vv-cerrar" data-cerrar aria-label="Cerrar el libro">×</button>
        <div class="vj-hoja vj-hoja-izq">
          <p class="eyebrow">Las Veintiuna Velas</p>
          <h2 id="vvDlgReglasT">El libro de la casa</h2>
          <p class="vv-dlg-sub">Blackjack contra la casa, con una regla especial por mano</p>
          <nav aria-label="Capítulos"><ol class="vj-indice">${indice()}</ol></nav>
        </div>
        <article class="vj-hoja vj-hoja-der" id="vjHojaReglas" tabindex="-1">${caps.find(c => c.id === actual).html}</article>
      </div>`);
    const hoja = $("vjHojaReglas");
    dlg.querySelector(".vj-indice").addEventListener("click", ev => {
      const b = ev.target.closest("[data-cap]");
      if (!b || b.dataset.cap === actual) return;
      actual = b.dataset.cap;
      dlg.querySelectorAll("[data-cap]").forEach(x => { if (x.dataset.cap === actual) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
      hoja.innerHTML = caps.find(c => c.id === actual).html;
      hoja.scrollTop = 0;
      hoja.classList.remove("pasa"); void hoja.offsetWidth;
      if (!sinMovimiento()) hoja.classList.add("pasa");
      sonar("carta");
      if (window.matchMedia("(max-width: 720px)").matches) { try { hoja.scrollIntoView({ block: "start" }); } catch (e) { /* sin desplazamiento */ } }
    });
  }

  function abrirAtajos() {
    abrir($("vvDlgAtajos"), `${cabeceraDlg("vvDlgAtajosT", "Atajos de teclado")}<div class="vv-dlg-cuerpo">${tablaAtajos()}</div>`);
  }

  async function abrirHistorial() {
    abrir($("vvDlgHistorial"), `${cabeceraDlg("vvDlgHistorialT", "El libro de cuentas", "Tus últimas manos en esta mesa")}<div class="vv-dlg-cuerpo"><p class="vv-dock-texto">Buscando tus manos...</p></div>`);
    try {
      const filas = await api.historial(15);
      const est = S.mesa ? S.mesa.estadisticas : null;
      const resumen = est ? `<p class="vv-historial-resumen"><strong>${est.rondas}</strong> manos · <strong>${est.victorias}</strong> ganadas · <strong>${est.derrotas}</strong> perdidas · <strong>${est.empates}</strong> empates · mejor racha <strong>${est.mejor_racha}</strong> · tokens ${V.conSigno(est.neto)} en total</p>` : "";
      const mini = cartas => cartas.map(c => `<span class="vv-mini ${A.PALOS[c.p].color === "rojo" ? "rojo" : ""}" title="${esc(A.nombreCarta(c))}"><span>${A.letraRango(c.r)}</span><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#vv-${A.PALOS[c.p].id}"/></svg></span>`).join("");
      const tabla = filas.length ? `<ul class="vv-historial">${filas.map(f => {
        const R = V.REGLAS[f.regla];
        const t = { natural: "Blackjack", victoria: "Ganada", empate: "Empate", derrota: "Perdida" }[f.resultado];
        const cuando = new Date(f.terminada).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        return `<li class="vv-hist-fila res-${f.resultado}"><div class="vv-hist-cab"><span class="vv-hist-tipo">${esc(t)}</span><span>${esc(R ? R.nombre : f.regla)} · ${f.modo === "practica" ? "práctica" : "con apuesta"}</span><time datetime="${esc(f.terminada)}">${esc(cuando)}</time></div>
          <div class="vv-hist-manos"><span><b>Tú ${f.total_jugador}</b> ${mini(f.jugador)}</span><span><b>Crupier ${f.total_crupier}</b> ${mini(f.crupier)}</span></div>
          <div class="vv-hist-neto ${Number(f.neto) > 0 ? "sube" : Number(f.neto) < 0 ? "baja" : ""}">${f.modo === "practica" ? "sin tokens" : `${V.conSigno(f.neto)} tokens${Number(f.peajes) ? ` (con peaje de ${V.monedas(f.peajes)})` : ""}`}</div></li>`;
      }).join("")}</ul>` : `<p class="vv-dock-texto">Todavía no has terminado ninguna mano.</p>`;
      $("vvDlgHistorial").querySelector(".vv-dlg-cuerpo").innerHTML = resumen + tabla;
    } catch (e) {
      $("vvDlgHistorial").querySelector(".vv-dlg-cuerpo").innerHTML = `<p class="vv-dock-texto">${esc(V.mensajeError(e))}</p>`;
    }
  }

  /* Cuándo se reinician los desafíos (cada día a las 00:00 UTC): lo completado y sin reclamar se pierde, y todo se puede volver a completar */
  function textoReinicio(m) {
    const fin = m && m.logros_reinician ? Date.parse(m.logros_reinician) : NaN;
    if (!isFinite(fin)) return "Los desafíos se reinician cada día.";
    const min = Math.max(0, Math.round((fin - Date.now()) / 60000)), h = Math.floor(min / 60);
    return `Los desafíos se reinician cada día: dentro de ${h ? h + " h " : ""}${min % 60} min. Lo que no reclames antes se pierde, y después puedes completarlos de nuevo.`;
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
    abrir($("vvDlgDesafios"), `${cabeceraDlg("vvDlgDesafiosT", "El tablón de desafíos", "Se comprueban en el servidor y valen lo mismo con o sin apuesta")}
      <div class="vv-dlg-cuerpo">
        <p class="vv-nota-aviso vv-dlg-estado" id="vvDesafiosEstado" role="status" aria-live="polite"${S.mensajeDesafios ? "" : " hidden"}>${esc(S.mensajeDesafios || "")}</p>
        ${apagado ? `<p class="vv-nota-aviso">Las cartas de esta mesa todavía no se reparten. Tus desafíos se siguen completando y quedan guardados hasta el reinicio del día.</p>` : ""}
        <p class="vv-nota-aviso">${textoReinicio(m)}</p>
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
        const motivos = { "juego-inactivo": "Las cartas de esta mesa todavía no se reparten. Tu desafío sigue guardado hasta el reinicio del día.", "tope-diario": "Hoy ya reclamaste la carta de la mesa. El desafío sigue guardado hasta el reinicio del día; mañana puedes completarlo de nuevo.", agotado: "Ahora mismo no queda ninguna carta disponible para este premio. El desafío sigue guardado hasta el reinicio del día." };
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
    const Salon = window.VeintiunaSalon;
    if (Salon) {
      Salon.montar();
      $("vvTapete").innerHTML = Salon.tapete();
      document.querySelectorAll("[data-dib]").forEach(e => { e.innerHTML = Salon.OBJ[e.dataset.dib] || ""; });
      const b = $("vjBolsa"); if (b) b.innerHTML = Salon.bolsa();
    } else $("vvTapete").innerHTML = A.tapete();
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
    window.VeintiunaBuhonero.iniciar({ abrir, cabecera: cabeceraDlg, dlg: $("vvDlgBuhonero"), supa: () => fichasCliente(), yo: () => S.sesion.user.id, alCambiar: () => cargarMesa({ soloDatos: true, animarSaldo: true }) });
    // al cerrar al Buhonero, el panel de la apuesta cuenta con los tokens nuevos
    $("vvDlgBuhonero").addEventListener("close", () => { if (S.fase === "apuesta" && S.mesa) { S.apuesta = V.ajustarApuesta(S.apuesta, saldoActual(), S.mesa.limites); pintarDock(); } });
    $("vvAtajosBtn").addEventListener("click", abrirAtajos);
    $("vvBtnSonido").addEventListener("click", () => { S.efectos = !S.efectos; guardado.poner("vvEfectos", S.efectos ? "1" : "0"); pintarSonidoBoton(); if (S.efectos) sonar("ficha"); });
    window.addEventListener("resize", ajustarVolumen);
    window.addEventListener("online", () => { if (S.reintento) { const f = S.reintento; aviso("Volvió la conexión. Reintento...", { tipo: "info" }); f(); } });

    fase("cargando");
    let sesion = null;
    try { sesion = typeof fichasSesionActual === "function" ? await fichasSesionActual() : null; } catch (e) { sesion = null; }
    S.sesion = sesion;
    if (!sesion) { pintarPlaca("maldicion", "proxima", null); $("vvPlaca").hidden = true; fase("sin_sesion"); finCarga(); }
    else { await cargarMesa(); finCarga(); if (location.hash === "#desafios") abrirDesafios(); }
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
