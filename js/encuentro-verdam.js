(function () {
  const intro = document.getElementById("encIntro");
  const apuestaEl = document.getElementById("encApuesta");
  const botonJugar = document.getElementById("encJugar");
  const veredictoEl = document.getElementById("encVeredicto");
  const veredictoTitulo = document.getElementById("encVeredictoTitulo");
  const veredictoTexto = document.getElementById("encVeredictoTexto");
  const barra = document.getElementById("encBarra");
  const avisoEl = document.getElementById("encAviso");

  const idIntento = new URLSearchParams(location.search).get("i");
  const CLAVE_EMPEZADO = "msEmpezado:" + idIntento;
  const musica = MsMusica.crear({ contenedor: document.getElementById("encVolumen") });
  let juego = null;
  let nombrePersonaje = "";

  // Cenizas que suben: muy livianas, a media resolución
  (function cenizas() {
    const canvas = document.getElementById("encCenizas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const ESCALA = 0.5;
    let w = 0, h = 0;
    const brasas = [];
    function medir() {
      w = canvas.width = Math.max(1, Math.round(innerWidth * ESCALA));
      h = canvas.height = Math.max(1, Math.round(innerHeight * ESCALA));
    }
    medir();
    addEventListener("resize", medir);
    for (let i = 0; i < 55; i++) {
      brasas.push({ x: Math.random() * w, y: Math.random() * h, v: 5 + Math.random() * 18, r: 0.6 + Math.random() * 1.6, f: Math.random() * 6.28, cal: Math.random() < 0.35 });
    }
    let ultimo = 0;
    function cuadro(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
      ultimo = t;
      ctx.clearRect(0, 0, w, h);
      for (const b of brasas) {
        b.y -= b.v * dt;
        b.f += dt * 2;
        if (b.y < -4) { b.y = h + 4; b.x = Math.random() * w; }
        ctx.fillStyle = b.cal ? `rgba(240,194,90,${0.3 + 0.4 * Math.abs(Math.sin(b.f))})` : `rgba(150,145,130,${0.2 + 0.25 * Math.abs(Math.sin(b.f))})`;
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(b.f) * 5, b.y, b.r, 0, 6.28);
        ctx.fill();
      }
      requestAnimationFrame(cuadro);
    }
    requestAnimationFrame(cuadro);
  })();

  function arrancarMusica() {
    const p = musica.play();
    if (p && p.catch) {
      p.catch(() => {
        const alToque = () => {
          ["pointerdown", "keydown", "touchstart"].forEach(t => document.removeEventListener(t, alToque, true));
          musica.play().catch(() => {});
        };
        ["pointerdown", "keydown", "touchstart"].forEach(t => document.addEventListener(t, alToque, true));
      });
    }
  }

  // El jefe: su "vida" muestra quién va adelante (la mitad = parejo)
  function animarBarra() {
    if (juego) {
      const m = juego.marcador();
      const f = Math.min(1, Math.max(0.02, 0.5 + (m.puntajeRival - m.puntaje) / 240));
      barra.style.width = (f * 100) + "%";
    }
    requestAnimationFrame(animarBarra);
  }

  function mostrarAviso(texto) {
    avisoEl.textContent = texto;
  }

  function terminarIntro() {
    intro.style.display = "none";
  }
  intro.addEventListener("click", terminarIntro);
  setTimeout(terminarIntro, 5200);

  async function iniciar() {
    if (!idIntento) { mostrarAviso("Este combate se abre desde Muerte Súbita."); return; }
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { /* sin sesión */ }
    if (!sesion) { mostrarAviso("Hay que iniciar sesión para este combate."); return; }

    let intento = null;
    try {
      const lista = await msListarIntentos();
      intento = lista.find(i => i.id === idIntento && i.user_id === sesion.user.id) || null;
    } catch (e) { /* se maneja abajo */ }
    if (!intento) { mostrarAviso("No encontré ese desafío en tu cuenta."); return; }

    nombrePersonaje = intento.personaje_nombre;
    apuestaEl.textContent = `Apuesta: ${nombrePersonaje}`;

    if (intento.estado !== "en_curso" || intento.veredicto) {
      mostrarAviso("Este desafío ya se jugó. El DM tiene el resultado.");
      return;
    }
    let yaEmpezado = false;
    try { yaEmpezado = localStorage.getItem(CLAVE_EMPEZADO) === "1"; } catch (e) { /* sin almacenamiento */ }
    if (yaEmpezado) {
      mostrarAviso("Este combate ya empezó y se interrumpió. Avisa al DM: él decide qué pasa.");
      return;
    }

    arrancarMusica();
    juego = crearArqueria({
      canvas: document.getElementById("encCampo"),
      rival: "verdam",
      duracion: 60,
      pantallas: false,
      onEstado: estado => {
        botonJugar.classList.toggle("hidden", estado !== "listo");
      },
      onFin: async ({ puntaje, puntajeRival }) => {
        const marcador = `${puntaje} a ${puntajeRival}`;
        let veredicto = null;
        try {
          veredicto = await msFinalizar(idIntento, puntaje, puntajeRival);
          try { localStorage.removeItem(CLAVE_EMPEZADO); } catch (e) { /* sin almacenamiento */ }
        } catch (err) { /* se avisa abajo */ }
        veredictoEl.classList.remove("hidden", "enc-gana", "enc-pierde");
        if (veredicto === "ganado") {
          veredictoEl.classList.add("enc-gana");
          veredictoTitulo.textContent = "VERDAM ABATIDO";
          veredictoTexto.textContent = `${marcador}. El DM confirma el resultado y entrega la recompensa.`;
        } else if (veredicto === "perdido") {
          veredictoEl.classList.add("enc-pierde");
          veredictoTitulo.textContent = "HAS CAÍDO";
          veredictoTexto.textContent = `${marcador}. ${nombrePersonaje} queda marcado por el Dominio. El DM decide qué pasa con él.`;
        } else {
          veredictoTitulo.textContent = "SIN REGISTRO";
          veredictoTexto.textContent = `Terminó ${marcador}, pero no se pudo guardar. Avisa al DM: una falla técnica nunca cuenta como derrota.`;
        }
      }
    });
    botonJugar.classList.remove("hidden");
    animarBarra();
  }

  botonJugar.addEventListener("click", () => {
    if (!juego) return;
    try { localStorage.setItem(CLAVE_EMPEZADO, "1"); } catch (e) { /* sin almacenamiento */ }
    juego.iniciar();
  });

  iniciar();
})();
