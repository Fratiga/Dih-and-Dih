/* =============================================================================
   LA ÚLTIMA VELA: los textos y las decisiones de pantalla, sin tocar el DOM ni la red (así se puede probar con node: docs/pruebas-web/ultima-vela.js)
   El servidor (docs/veintiuna-reto.sql) dice cómo va el reto y la mano; aquí solo se convierte eso en frases, velas y botones.
   Un estado es lo que devuelve veintiuna_reto_estado: { personaje, estado, meta, ganadas, perdidas, empates_seguidos, repartidas, numero, historial, mano }.
============================================================================= */
(function (raiz) {
  const nombreCarta = c => raiz.VeintiunaArte ? raiz.VeintiunaArte.nombreCarta(c) : `${c.r} (palo ${c.p})`;
  const lista = xs => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  /* ---------------------------------------------------------------- las cinco velas del reto */
  // Una vela por mano del reto: ganada (encendida), perdida (apagada), la que se juega ahora o pendiente. Los empates no gastan vela: repiten la misma.
  function velas(est) {
    const total = (est.meta && est.meta.manos) || 5;
    const decididas = [];
    (est.historial || []).forEach(h => { if (h.cuenta === "victoria" || h.cuenta === "derrota") decididas[h.numero - 1] = h.cuenta === "victoria" ? "ganada" : "perdida"; });
    const cerrado = est.estado !== "en_curso";
    const actual = Math.min((est.ganadas || 0) + (est.perdidas || 0) + 1, total);
    const salida = [];
    for (let i = 0; i < total; i++) {
      let e = decididas[i];
      if (!e) e = (!cerrado && i + 1 === actual) ? "actual" : "pendiente";
      salida.push({ numero: i + 1, estado: e });
    }
    return salida;
  }

  const ETIQUETA_VELA = { ganada: "ganada", perdida: "perdida", actual: "la que se juega ahora", pendiente: "sin jugar" };
  const etiquetaVela = v => `Mano ${v.numero}, ${ETIQUETA_VELA[v.estado]}`;

  // «Mano 2 de 5. Llevas 1 ganada y 0 perdidas. Empate 1 de 2.»
  function cuenta(est) {
    const m = est.meta || { ganar: 3, manos: 5, empates: 2 };
    if (est.estado === "ganado") return `Reto superado. Ganaste ${plural(est.ganadas, "mano", "manos")} y perdiste ${est.perdidas}.`;
    if (est.estado === "perdido") return `Reto perdido. Perdiste ${plural(est.perdidas, "mano", "manos")} y ganaste ${est.ganadas}.`;
    const partes = [`Mano ${est.numero} de ${m.manos}.`, `Llevas ${plural(est.ganadas, "ganada", "ganadas")} y ${plural(est.perdidas, "perdida", "perdidas")}. Hacen falta ${m.ganar}.`];
    if (est.empates_seguidos) partes.push(`Esta mano ya empató ${est.empates_seguidos} ${est.empates_seguidos === 1 ? "vez" : "veces"} (se repite hasta ${m.empates}).`);
    return partes.join(" ");
  }

  /* ---------------------------------------------------------------- el resultado de una mano */
  const RAZONES = {
    natural: "Veintiuna al repartir.",
    ambos_natural: "Los dos tenéis veintiuna al repartir.",
    natural_cera: "Cera tiene veintiuna al repartir.",
    te_pasas: "Te pasaste de 21.",
    cera_se_pasa: "Cera se pasó de 21.",
    mejor_mano: "Tu mano es mejor que la de Cera.",
    cera_mejor: "La mano de Cera es mejor que la tuya.",
    mismo_total: "Mismo total."
  };

  function resultadoMano(est) {
    const m = est && est.mano;
    if (!m || m.fase !== "terminada") return null;
    const tercer = m.resultado === "empate" && m.cuenta === "derrota";
    const razon = RAZONES[m.razon] || "";
    const resto = est.meta.empates - est.empates_seguidos;
    if (m.resultado === "victoria") return { clase: m.razon === "natural" ? "res-natural" : "res-victoria", etq: `Mano ${m.numero}`, titulo: m.razon === "natural" ? "Veintiuna" : "Mano ganada", razon, linea: "La vela se enciende." };
    if (m.resultado === "derrota") return { clase: "res-derrota", etq: `Mano ${m.numero}`, titulo: "Mano perdida", razon, linea: "La vela se apaga." };
    if (tercer) return { clase: "res-derrota", etq: `Mano ${m.numero}`, titulo: "Tercer empate", razon: `${razon} Es el tercer empate seguido.`, linea: "Cuenta como mano perdida." };
    return { clase: "res-empate", etq: `Mano ${m.numero}`, titulo: "Empate", razon, linea: resto > 0 ? "Se repite la mano." : "Se repite la mano. Si vuelve a empatar, cuenta como derrota." };
  }

  /* ---------------------------------------------------------------- final del reto */
  function textoFinal(est) {
    const nombre = est.personaje || "Tu personaje";
    if (est.estado === "ganado") return { clase: "uv-fin-gana", titulo: "Has vencido a Cera", texto: `${est.ganadas} a ${est.perdidas}. El resultado queda anotado y el DM decide qué te llevas. Este intento ya no se puede repetir.` };
    return { clase: "uv-fin-pierde", titulo: "La última vela se apaga", texto: `${est.ganadas} a ${est.perdidas}. ${nombre} queda marcado por el Dominio y el DM decide qué pasa con él. Este intento ya no se puede repetir.` };
  }

  /* ---------------------------------------------------------------- botones */
  // Lo que se puede hacer ahora mismo: pedir o plantarte en una mano abierta, o repartir la siguiente
  function acciones(est) {
    if (!est || est.estado !== "en_curso") return { tipo: "fin", botones: [] };
    const m = est.mano;
    if (m && m.fase === "jugador") {
      return { tipo: "jugando", botones: [
        { id: "pedir", texto: "Pedir carta", sub: m.jugador.total >= 21 ? "ya tienes 21" : "", habilitado: m.jugador.total < 21, motivo: "Con 21 no se pide más.", tecla: "P" },
        { id: "plantar", texto: "Plantarse", sub: "", habilitado: true, motivo: "", principal: true, tecla: "L" }
      ] };
    }
    const primera = !est.repartidas;
    const repite = !!m && m.fase === "terminada" && m.resultado === "empate" && m.cuenta === "empate";
    return { tipo: "repartir", botones: [
      { id: "repartir", texto: primera ? "Repartir la primera mano" : repite ? "Repetir la mano" : "Siguiente mano", sub: primera ? "desde aquí el intento queda gastado" : "", habilitado: true, motivo: "", principal: true, tecla: "S" }
    ] };
  }

  /* ---------------------------------------------------------------- frases para el lector de pantalla */
  function anuncio(antes, est) {
    const m = est.mano;
    if (!m) return "";
    const p = [];
    const nuevaMano = !antes || !antes.mano || antes.mano.numero !== m.numero || antes.repartidas !== est.repartidas;
    if (nuevaMano) {
      p.push(`Mano ${m.numero} de ${est.meta.manos}. Cera enseña ${lista(m.cera.cartas.slice(0, 2).map(nombreCarta))}. Tú tienes ${lista(m.jugador.cartas.map(nombreCarta))}, suman ${m.jugador.total}${m.jugador.blando ? " en blando" : ""}.`);
    } else if (antes && antes.mano && m.jugador.cartas.length > antes.mano.jugador.cartas.length) {
      const nuevas = m.jugador.cartas.slice(antes.mano.jugador.cartas.length);
      p.push(`Recibes ${lista(nuevas.map(nombreCarta))}. Sumas ${m.jugador.total}${m.jugador.blando ? " en blando" : ""}.`);
    }
    if (m.fase === "terminada") {
      const r = resultadoMano(est);
      if (m.cera.cartas.length > 2) p.push(`Cera pide y se queda con ${m.cera.total}.`);
      if (r) p.push(`${r.titulo}. ${r.razon} ${r.linea}`);
    }
    if (est.estado !== "en_curso") { const f = textoFinal(est); p.push(`${f.titulo}. ${f.texto}`); }
    return p.join(" ");
  }

  /* ---------------------------------------------------------------- errores del servidor */
  const ERRORES = {
    sin_sesion: "Hay que iniciar sesión para este reto.",
    no_encontrado: "No encontré ese desafío en tu cuenta.",
    anulado: "El DM anuló este intento.",
    sin_mano: "Todavía no has repartido la primera mano.",
    paso_futuro: "La mesa y tu pantalla no coinciden. Recarga la página.",
    accion_invalida: "Esa acción no existe en este reto."
  };
  function mensajeError(e) {
    if (!e) return "Algo falló.";
    if (e.tipo === "red") return "No hay conexión con la mesa. Lo que hiciste puede haber llegado: reintenta y la mesa lo comprobará.";
    return ERRORES[e.codigo] || e.mensaje || "La mesa rechazó la petición.";
  }

  /* ---------------------------------------------------------------- reglas (el diálogo) */
  const REGLAS = [
    { titulo: "Contra Cera", texto: "Es blackjack con las cartas y los valores de Las Veintiuna Velas. El as vale 1 u 11, las figuras valen 10 y la veintiuna se cuenta como veintiuna. No se dobla ni se divide, y no hay reglas especiales de ronda." },
    { titulo: "Gana quien llegue a tres", texto: "Hay que ganar 3 de 5 manos. El reto acaba en cuanto alguien llega a tres: tres manos ganadas es victoria y tres perdidas es derrota." },
    { titulo: "Los empates se repiten", texto: "Si una mano empata se juega de nuevo, hasta dos veces. El tercer empate seguido cuenta como mano perdida." },
    { titulo: "El testigo", texto: "Cera enseña sus dos cartas desde que se reparte. Úsalo: saber cuánto le falta cambia cuándo te conviene plantarte." },
    { titulo: "Cera exigente", texto: "Cera sigue pidiendo carta hasta llegar a 18, también con un 17 y con un 17 blando. En la mesa normal se planta con 17." },
    { titulo: "Un solo intento", texto: "Cada personaje tiene un único intento. En cuanto se reparte la primera mano ya no se puede repetir. Si recargas la página o se corta la conexión, la mano sigue donde estaba y las cartas son las mismas." },
    { titulo: "Lo que está en juego", texto: "No hay tokens ni cartas en la mesa. Si ganas, el DM decide qué te llevas. Si pierdes, tu personaje queda marcado por el Dominio y el DM decide qué le pasa. El resultado lo registra la mesa, el desenlace lo pones tú con el DM." }
  ];

  const API = { velas, etiquetaVela, cuenta, resultadoMano, textoFinal, acciones, anuncio, mensajeError, REGLAS, RAZONES, lista, plural };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.UltimaVelaVista = API;
})(typeof window !== "undefined" ? window : globalThis);
