/* Música de fondo de las páginas de minijuegos (el hub y el ajedrez). Suena en
   bucle desde que entras; si el navegador bloquea el sonido hasta que toques algo,
   arranca con el primer toque o tecla. El botón flotante ♪ la silencia y se
   recuerda entre páginas. Para efectos sueltos (la victoria) hay efecto(), y
   agachar() baja el fondo mientras suenan. */
(function () {
  const CLAVE = "compendioMjSilencio";
  let silencio = false;
  try { silencio = localStorage.getItem(CLAVE) === "1"; } catch (err) { silencio = false; }
  let audio = null;
  let volumenBase = 0.4;
  let agachado = false;
  let boton = null;

  function aplicar() {
    if (boton) {
      boton.classList.toggle("apagado", silencio);
      boton.title = silencio ? "Activar la música" : "Silenciar la música";
      boton.setAttribute("aria-pressed", silencio ? "true" : "false");
    }
    if (!audio) return;
    audio.volume = agachado ? volumenBase * 0.25 : volumenBase;
    if (silencio) audio.pause();
    else if (!document.hidden) audio.play().catch(() => { /* espera el primer toque */ });
  }

  function crearBoton() {
    boton = document.createElement("button");
    boton.type = "button";
    boton.className = "mj-musica-btn";
    boton.textContent = "♪";
    boton.addEventListener("click", () => {
      silencio = !silencio;
      try { localStorage.setItem(CLAVE, silencio ? "1" : "0"); } catch (err) { /* sin almacenamiento */ }
      aplicar();
    });
    document.body.appendChild(boton);
  }

  function iniciar(src, opciones) {
    volumenBase = (opciones && opciones.volumen) || 0.4;
    audio = new Audio(src);
    audio.loop = true;
    crearBoton();
    aplicar();
    const desbloquear = () => { if (!silencio) audio.play().catch(() => {}); };
    ["pointerdown", "keydown", "touchstart"].forEach(t => document.addEventListener(t, desbloquear, { once: true, passive: true }));
    document.addEventListener("visibilitychange", () => { if (document.hidden) audio.pause(); else aplicar(); });
  }

  function efecto(src, volumen) {
    if (silencio) return;
    const a = new Audio(src);
    a.volume = volumen === undefined ? 0.8 : volumen;
    a.play().catch(() => { /* sonido bloqueado */ });
  }

  function agachar(si) {
    agachado = !!si;
    aplicar();
  }

  window.MjMusica = { iniciar, efecto, agachar, silenciada: () => silencio };
})();
