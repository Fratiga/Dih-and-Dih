(function () {
  const puerta = document.getElementById("msPuerta");
  const botonEntrar = document.getElementById("msEntrar");
  const avisoPuerta = document.getElementById("msPuertaAviso");
  const contenido = document.getElementById("msContenido");
  const desafiosEl = document.getElementById("msDesafios");
  const intentosEl = document.getElementById("msIntentos");
  const panel = document.getElementById("msPanel");
  const panelTitulo = document.getElementById("msPanelTitulo");
  const selectPersonaje = document.getElementById("msPersonaje");
  const inputConfirmar = document.getElementById("msConfirmar");
  const avisoEl = document.getElementById("msAviso");
  const botonAceptar = document.getElementById("msAceptar");
  const botonCancelar = document.getElementById("msCancelar");
  const juegoEl = document.getElementById("msJuego");
  const botonJugar = document.getElementById("msJugar");
  const resultadoEl = document.getElementById("msResultado");

  const NIVEL_MINIMO = 4;

  // Si el archivo no está, el navegador simplemente no suena: no rompe nada.
  const musica = new Audio(encodeURI("assets/cosas/The Crack of Doom.mp3"));
  musica.loop = true;
  musica.volume = 0.5;

  let sesion = null;
  let fichas = [];
  let intentos = [];
  let desafioActual = null;
  let intentoActual = null;
  let juego = null;

  function escapar(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function nombreDe(ficha) {
    return (ficha.identidad && ficha.identidad.nombre) || "Sin nombre";
  }

  function nivelDe(ficha) {
    return Number(ficha.identidad && ficha.identidad.nivelTotal) || 0;
  }

  function intentoVivo(fichaId, desafioId) {
    return intentos.find(i => i.personaje_id === fichaId && i.desafio === desafioId && i.veredicto !== "anulado");
  }

  function textoEstado(i) {
    if (i.veredicto === "confirmado") return i.estado === "ganado" ? "victoria confirmada" : "marcado por el Dominio";
    if (i.estado === "en_curso") return "sin terminar";
    return i.estado === "ganado" ? "ganado, espera al DM" : "perdido, marcado y en juicio";
  }

  /* --- Cartas de desafío: rectángulos verticales chicos, con ojo que mira --- */
  function ojoSVG() {
    return `<svg class="ms-ojo" viewBox="0 0 100 60" aria-hidden="true">
      <path d="M4 30 C22 6 78 6 96 30 C78 54 22 54 4 30 Z" fill="#12061f" stroke="#c084fc" stroke-width="2.5"/>
      <circle cx="50" cy="30" r="15" fill="#a855f7"/>
      <g class="ms-pupila"><ellipse cx="50" cy="30" rx="5" ry="12" fill="#06020c"/><circle cx="46" cy="25" r="2.4" fill="#f5d0fe"/></g>
    </svg>`;
  }

  function tentaculosMini() {
    return ["ms-tm1", "ms-tm2", "ms-tm3"].map(c =>
      `<svg class="ms-tent-mini ${c}" viewBox="0 0 120 400" aria-hidden="true"><use href="#msTentaculo"/></svg>`).join("");
  }

  function cartaHTML(d) {
    if (d.bloqueado) {
      return `<button type="button" class="ms-carta ms-bloqueada" disabled>
        <div class="ms-carta-arte">${ojoSVG()}</div>
        ${tentaculosMini()}
        <div class="ms-carta-info"><span class="ms-cat">${escapar(d.categoria)}</span><h3>???</h3><small>Sellado</small></div>
      </button>`;
    }
    const gif = d.gif ? `<div class="ms-carta-gif" data-gif="${escapar(d.gif)}"></div>` : "";
    const diana = d.arte === "arqueria"
      ? `<svg class="ms-diana" viewBox="0 0 100 100" aria-hidden="true"><use href="#msDiana"/></svg><span class="ms-flecha"></span>`
      : "";
    return `<button type="button" class="ms-carta" data-retar="${escapar(d.id)}" ${sesion ? "" : "disabled"}>
      <div class="ms-carta-arte">${ojoSVG()}${diana}${gif}</div>
      ${tentaculosMini()}
      <div class="ms-carta-info"><span class="ms-cat">${escapar(d.categoria)} · ${escapar(d.prueba)}</span><h3>${escapar(d.rival)}</h3><small>${escapar(d.texto)}</small></div>
    </button>`;
  }

  function pintarDesafios() {
    desafiosEl.innerHTML = window.MUERTE_SUBITA.map(cartaHTML).join("");
    // El GIF solo se pide si el archivo existe; si no, la carta usa su animación
    desafiosEl.querySelectorAll("[data-gif]").forEach(el => {
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url("${el.dataset.gif}")`; };
      img.src = el.dataset.gif;
    });
    pintarIntentos();
  }

  function pintarIntentos() {
    if (!intentos.length) { intentosEl.innerHTML = ""; return; }
    const filas = intentos.map(i => {
      const marcado = i.estado === "perdido" && i.veredicto !== "anulado";
      return `<li class="${marcado ? "ms-marcado" : ""}">${marcado ? "☠ " : ""}${escapar(i.personaje_nombre)} · ${escapar(i.desafio)} · ${escapar(textoEstado(i))}${i.veredicto === "anulado" ? " (anulado)" : ""}</li>`;
    }).join("");
    intentosEl.innerHTML = `<div class="ms-intentos-lista"><h4>Tus intentos</h4><ul>${filas}</ul></div>`;
  }

  /* --- Ojos que siguen el cursor --- */
  document.addEventListener("pointermove", e => {
    document.querySelectorAll(".ms-ojo").forEach(ojo => {
      const r = ojo.getBoundingClientRect();
      if (!r.width) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160);
      const pupila = ojo.querySelector(".ms-pupila");
      if (pupila) pupila.setAttribute("transform", `translate(${(dx / d) * 11 * k} ${(dy / d) * 5 * k})`);
    });
  });

  /* --- Ambiente: motas violeta que suben y descargas de energía --- */
  function iniciarAmbiente() {
    const canvas = document.getElementById("msAmbiente");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const ESCALA = 0.5;
    let w = 0, h = 0;
    const motas = [];
    const rayos = [];
    function medir() {
      w = canvas.width = Math.max(1, Math.round(window.innerWidth * ESCALA));
      h = canvas.height = Math.max(1, Math.round(window.innerHeight * ESCALA));
    }
    medir();
    window.addEventListener("resize", medir);
    for (let i = 0; i < 70; i++) {
      motas.push({ x: Math.random() * w, y: Math.random() * h, v: 6 + Math.random() * 22, r: 0.8 + Math.random() * 2.2, f: Math.random() * 6.28, color: Math.random() < 0.7 ? "192,132,252" : "232,121,249" });
    }
    function rayo() {
      const x0 = Math.random() * w;
      const puntos = [[x0, 0]];
      let x = x0, y = 0;
      while (y < h * (0.3 + Math.random() * 0.4)) {
        x += (Math.random() - 0.5) * 40;
        y += 18 + Math.random() * 22;
        puntos.push([x, y]);
      }
      rayos.push({ puntos, edad: 0, vida: 0.18 });
    }
    let ultimo = 0, proximoRayo = 2;
    function cuadro(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
      ultimo = t;
      ctx.clearRect(0, 0, w, h);
      for (const m of motas) {
        m.y -= m.v * dt;
        m.f += dt * 2.4;
        if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w; }
        ctx.fillStyle = `rgba(${m.color},${0.25 + 0.35 * Math.abs(Math.sin(m.f))})`;
        ctx.beginPath();
        ctx.arc(m.x + Math.sin(m.f) * 6, m.y, m.r, 0, 6.28);
        ctx.fill();
      }
      proximoRayo -= dt;
      if (proximoRayo <= 0) { rayo(); proximoRayo = 2.5 + Math.random() * 5; }
      for (const r of rayos) {
        r.edad += dt;
        ctx.strokeStyle = `rgba(233,170,255,${Math.max(0, 1 - r.edad / r.vida)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        r.puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      for (let i = rayos.length - 1; i >= 0; i--) if (rayos[i].edad >= rayos[i].vida) rayos.splice(i, 1);
      requestAnimationFrame(cuadro);
    }
    requestAnimationFrame(cuadro);
  }
  iniciarAmbiente();

  /* --- Panel de apuesta --- */
  function abrirPanel(desafio) {
    desafioActual = desafio;
    panelTitulo.textContent = `${desafio.rival} · ${desafio.prueba}`;
    const elegibles = fichas.filter(f => nivelDe(f) >= NIVEL_MINIMO && !intentoVivo(f.id, desafio.id));
    selectPersonaje.innerHTML = elegibles.map(f => `<option value="${escapar(f.id)}">${escapar(nombreDe(f))} (nivel ${nivelDe(f)})</option>`).join("");
    inputConfirmar.value = "";
    botonAceptar.disabled = true;
    if (!elegibles.length) {
      avisoEl.textContent = fichas.some(f => nivelDe(f) >= NIVEL_MINIMO)
        ? "Tus personajes de nivel 4 o más ya tienen un intento de este reto."
        : "Ninguno de tus personajes llega al nivel 4. Vuelve cuando haya algo que perder.";
    } else {
      avisoEl.textContent = "";
    }
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function fichaElegida() {
    return fichas.find(f => f.id === selectPersonaje.value) || null;
  }

  function validarConfirmacion() {
    const f = fichaElegida();
    botonAceptar.disabled = !f || inputConfirmar.value.trim().toLowerCase() !== nombreDe(f).trim().toLowerCase();
  }

  desafiosEl.addEventListener("click", e => {
    const b = e.target.closest("[data-retar]");
    if (!b || b.disabled) return;
    const d = window.MUERTE_SUBITA.find(x => x.id === b.dataset.retar);
    if (d) abrirPanel(d);
  });
  selectPersonaje.addEventListener("change", validarConfirmacion);
  inputConfirmar.addEventListener("input", validarConfirmacion);
  botonCancelar.addEventListener("click", () => panel.classList.add("hidden"));

  botonAceptar.addEventListener("click", async () => {
    const f = fichaElegida();
    if (!f || !desafioActual) return;
    botonAceptar.disabled = true;
    avisoEl.textContent = "";
    try {
      intentoActual = await msIniciar(desafioActual.id, f.id, nombreDe(f));
    } catch (err) {
      avisoEl.textContent = "El Dominio no te dejó pasar. Si ya tenías un intento, el DM puede anularlo.";
      botonAceptar.disabled = false;
      return;
    }
    panel.classList.add("hidden");
    iniciarJuego(desafioActual);
  });

  function iniciarJuego(desafio) {
    juegoEl.classList.remove("hidden");
    resultadoEl.innerHTML = "";
    juego = crearArqueria({
      canvas: document.getElementById("msCampo"),
      rival: desafio.motorRival,
      duracion: desafio.duracion,
      onEstado: estado => botonJugar.classList.toggle("hidden", estado !== "listo"),
      onFin: async ({ puntaje, puntajeRival }) => {
        const marcador = `${puntaje} a ${puntajeRival}`;
        try {
          const veredicto = await msFinalizar(intentoActual, puntaje, puntajeRival);
          resultadoEl.innerHTML = veredicto === "ganado"
            ? `Ganaste, ${marcador}.<small>El DM confirma el resultado y entrega la recompensa.</small>`
            : `Perdiste, ${marcador}.<small>Tu personaje queda marcado por el Dominio. El DM decide qué pasa con él.</small>`;
        } catch (err) {
          resultadoEl.innerHTML = `Terminó ${marcador}, pero no se pudo registrar.<small>Avisa al DM: una falla técnica nunca cuenta como derrota.</small>`;
        }
        try {
          const miId = sesion && sesion.user && sesion.user.id;
          intentos = (await msListarIntentos()).filter(i => i.user_id === miId);
          pintarDesafios();
        } catch (e) { /* se actualiza al recargar */ }
      }
    });
    botonJugar.classList.remove("hidden");
    juegoEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  botonJugar.addEventListener("click", () => { if (juego) juego.iniciar(); });

  async function cargarDatos() {
    try {
      if (sesion) {
        const [todas, todosIntentos] = await Promise.all([fichasStorageListar(), msListarIntentos()]);
        // Admin ve las fichas e intentos de todos; acá solo cuentan los propios
        const miId = sesion.user && sesion.user.id;
        const miCorreo = sesion.user && sesion.user.email;
        fichas = todas.filter(f => !f.ownerEmail || f.ownerEmail === miCorreo);
        intentos = todosIntentos.filter(i => i.user_id === miId);
      }
    } catch (e) {
      fichas = []; intentos = [];
    }
    pintarDesafios();
  }

  /* --- Música desde la puerta. Los navegadores solo dejan sonar con sonido
     si hubo una interacción previa; al llegar escribiendo la palabra en la
     clave mágica casi siempre cuenta, y si no, suena con el primer toque. --- */
  function arrancarMusica() {
    const promesa = musica.play();
    if (promesa && promesa.catch) promesa.catch(() => esperarToque());
  }
  function esperarToque() {
    if (!avisoPuerta.textContent) avisoPuerta.textContent = "Toca cualquier parte para escuchar el Dominio.";
    const alToque = () => {
      ["pointerdown", "keydown", "touchstart"].forEach(t => document.removeEventListener(t, alToque, true));
      const p = musica.play();
      if (p && p.then) p.then(() => { if (avisoPuerta.textContent.startsWith("Toca cualquier")) avisoPuerta.textContent = ""; }).catch(() => {});
    };
    ["pointerdown", "keydown", "touchstart"].forEach(t => document.addEventListener(t, alToque, true));
  }
  arrancarMusica();

  /* --- Puerta: solo con cuenta --- */
  async function revisarSesion() {
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    botonEntrar.disabled = !sesion;
    if (!sesion) avisoPuerta.textContent = "Solo con cuenta. Inicia sesión arriba a la derecha para poder entrar.";
    else if (avisoPuerta.textContent.startsWith("Solo con cuenta")) avisoPuerta.textContent = "";
  }
  revisarSesion();

  botonEntrar.addEventListener("click", () => {
    if (!sesion) return;
    if (musica.paused) musica.play().catch(() => { /* sin archivo o bloqueado */ });
    puerta.classList.add("hidden");
    contenido.classList.remove("hidden");
    pintarDesafios();
    cargarDatos();
  });

  window.addEventListener("pagehide", () => musica.pause());
})();
