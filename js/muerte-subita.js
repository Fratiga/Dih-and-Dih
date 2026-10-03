(function () {
  const puerta = document.getElementById("msPuerta");
  const contenido = document.getElementById("msContenido");
  const desafiosEl = document.getElementById("msDesafios");
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
    if (i.veredicto === "confirmado") return i.estado === "ganado" ? "victoria confirmada" : "derrota confirmada";
    if (i.estado === "en_curso") return "sin terminar";
    return i.estado === "ganado" ? "ganado, espera al DM" : "perdido, espera al DM";
  }

  function pintarDesafios() {
    desafiosEl.innerHTML = window.MUERTE_SUBITA.map(d => {
      if (d.bloqueado) {
        return `<div class="ms-desafio ms-bloqueado"><span class="ms-cat">${escapar(d.categoria)}</span><h3>???</h3><p>Sellado.</p></div>`;
      }
      return `
        <div class="ms-desafio" data-desafio="${escapar(d.id)}">
          <span class="ms-cat">${escapar(d.categoria)} · ${escapar(d.prueba)}</span>
          <h3>${escapar(d.rival)}</h3>
          <p>${escapar(d.texto)}</p>
          <button type="button" class="ms-boton" data-retar="${escapar(d.id)}" ${sesion ? "" : "disabled"}>${sesion ? "Aceptar el reto" : "Inicia sesión"}</button>
        </div>`;
    }).join("") + pintarIntentos();
  }

  function pintarIntentos() {
    if (!intentos.length) return "";
    const filas = intentos.map(i => `<li>${escapar(i.personaje_nombre)} · ${escapar(i.desafio)} · ${escapar(textoEstado(i))}${i.veredicto === "anulado" ? " (anulado)" : ""}</li>`).join("");
    return `<div class="ms-desafio" style="grid-column:1/-1"><span class="ms-cat">Tus intentos</span><ul style="margin:10px 0 0;padding-left:18px;color:var(--muted);font-size:.85rem">${filas}</ul></div>`;
  }

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
        : "Necesitas un personaje de nivel 4 o más.";
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
      avisoEl.textContent = "No se pudo abrir el desafío. Si ya tenías un intento, el DM puede anularlo.";
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
            : `Perdiste, ${marcador}.<small>El DM decide qué pasa con tu personaje. Nada es automático.</small>`;
        } catch (err) {
          resultadoEl.innerHTML = `Terminó ${marcador}, pero no se pudo registrar.<small>Avisa al DM: una falla técnica nunca cuenta como derrota.</small>`;
        }
        try { intentos = await msListarIntentos(); pintarDesafios(); } catch (e) { /* se actualiza al recargar */ }
      }
    });
    botonJugar.classList.remove("hidden");
    juegoEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  botonJugar.addEventListener("click", () => { if (juego) juego.iniciar(); });

  async function cargarDatos() {
    try {
      sesion = await fichasSesionActual();
      if (sesion) {
        [fichas, intentos] = await Promise.all([fichasStorageListar(), msListarIntentos()]);
      }
    } catch (e) {
      sesion = null;
    }
    pintarDesafios();
  }

  document.getElementById("msEntrar").addEventListener("click", () => {
    musica.currentTime = 0;
    musica.play().catch(() => { /* sin archivo o bloqueado */ });
    puerta.classList.add("hidden");
    contenido.classList.remove("hidden");
    pintarDesafios();
    cargarDatos();
  });

  window.addEventListener("pagehide", () => musica.pause());
})();
