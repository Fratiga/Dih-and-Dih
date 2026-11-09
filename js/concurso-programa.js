/* =============================================================================
   CONCURSO — Programa: solo la escena al aire, a pantalla completa. Es la
   ventana que se comparte por Discord. Recibe todo de la cabina por
   BroadcastChannel. Los clics y las teclas (Espacio, Retroceso, flechas) se
   reenvían a la cabina, así el anfitrión puede jugar desde esta ventana.
============================================================================= */
(function () {
  const raiz = document.getElementById("programa");
  const aviso = document.getElementById("programaAviso");
  // Los clics en botones, celdas, cartas y temporizadores se mandan a la cabina, que es la que decide
  const escenario = new CZ.Escenario(raiz, {
    modo: "programa",
    alClic: (el, sub, ev) => {
      // Los puntos de marcadores y podio se escriben encima del número
      const num = CZ.numeroDePuntos(el, ev.objetivo);
      if (num && num.nodo) { CZ.editarNumero(num.nodo, v => CZ.canal.enviar({ tipo: "puntos", jugador: num.jugador, valor: v })); return; }
      CZ.canal.enviar({ tipo: "clic", escena: escenario.escenaId, el: el.id, sub, alt: ev.altKey, shift: ev.shiftKey, derecho: ev.derecho });
    }
  });
  let anterior = null;     // { escena, paso, puntos: Map }

  function aplicar(msg) {
    const p = msg.partida;
    if (!p) return;
    aviso.classList.add("oculto");
    const v = p.vivo || {};
    const escena = CZ.escena(p, v.escena);
    const cambiaEscena = !anterior || anterior.escena !== v.escena;
    escenario.mostrar(p, v.escena, v.paso || 0, { transicion: true });
    if (anterior && !cambiaEscena && v.paso > anterior.paso) CZ.sonidosDePasos(escena, anterior.paso, v.paso);
    if (anterior && cambiaEscena && escena && escena.transicion !== "corte") CZ.sonar("whoosh");
    if (anterior) {
      let sube = false, baja = false;
      p.jugadores.forEach(j => {
        const a = anterior.puntos.get(j.id);
        if (a != null && j.puntos > a) sube = true;
        if (a != null && j.puntos < a) baja = true;
      });
      if (sube) CZ.sonar("moneda");
      else if (baja) CZ.sonar("pierde");
      if (msg.evento === "volteo") CZ.sonar("volteo");
      if (msg.evento === "sonido" && msg.sonido) CZ.sonar(msg.sonido);
    }
    anterior = { escena: v.escena, paso: v.paso || 0, puntos: new Map(p.jugadores.map(j => [j.id, j.puntos])) };
    document.title = (escena ? escena.nombre + " · " : "") + p.nombre;
  }

  CZ.canal.escuchar(msg => {
    if (msg && msg.tipo === "estado") aplicar(msg);
    if (msg && msg.tipo === "silencio") CZ.silencio = !!msg.valor;
  });
  CZ.canal.enviar({ tipo: "pedir" });

  // Mientras no llegue nada (la cabina está cerrada), se muestra la última partida guardada en este navegador
  setTimeout(() => {
    if (anterior) return;
    const p = CZ.local.cargar(CZ.local.actual());
    if (p) aplicar({ partida: p });
  }, 600);

  document.addEventListener("keydown", e => {
    if (e.target.isContentEditable) return;
    if (e.key === " " || e.key === "Backspace" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      CZ.canal.enviar({ tipo: "tecla", tecla: e.key });
    }
    if (e.key === "f" || e.key === "F") pantallaCompleta();
  });
  raiz.addEventListener("dblclick", ev => { if (!ev.target.closest(".cz-el")) pantallaCompleta(); });
  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  // El navegador no deja sonar nada hasta el primer gesto en la página
  document.addEventListener("pointerdown", () => CZ.sonar("nada"), { once: true });

  // El puntero se esconde si no se mueve
  let t = null;
  document.addEventListener("mousemove", () => {
    document.body.classList.remove("sin-puntero");
    clearTimeout(t);
    t = setTimeout(() => document.body.classList.add("sin-puntero"), 1500);
  });
})();
