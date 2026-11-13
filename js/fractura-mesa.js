/* =============================================================================
   LA FRACTURA: cómo se repite una guerra de mesa (varios jugadores). El servidor guarda la
   configuración y lo que hizo cada jugador en su turno; cada navegador reconstruye la guerra con
   eso. Los turnos de la máquina no se guardan: se vuelven a jugar aquí, y tienen que salir iguales
   en todos los navegadores. Por eso todo lo de este archivo depende solo del estado de la guerra.
   Se usa igual en el navegador y en Node (tools/probar-fractura-mesa.js).
============================================================================= */
(function (raiz) {
  const FM = raiz.FracturaMotor || (typeof require !== "undefined" ? require("./fractura-motor.js") : null);
  const IA = raiz.FracturaIA || (typeof require !== "undefined" ? require("./fractura-ia.js") : null);
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);

  /* La guerra recién creada a partir de la configuración de la mesa. humanos: quién ocupa cada asiento (null = la máquina). */
  function crear(cfg, miAsiento) {
    const jugadores = cfg.jugadores.map(j => (j.humano ? j : Object.assign({ nombre: `Fuerzas de ${D.FACCIONES[D.faccionReal(j.faccion)].corto}` }, j)));
    const est = FM.crearGuerra(Object.assign({}, cfg, { jugadores, humanoIdx: miAsiento, pvp: true }));
    avanzarMaquina(est, cfg.humanos || []);
    return est;
  }

  /* Lo que hace la máquina entre un jugador y el siguiente */
  function avanzarMaquina(e, humanos) {
    let guarda = 0;
    while (e.ganador === null && guarda++ < 400) {
      if (!e.jugadores.some((j, i) => humanos[i] && !j.eliminado)) {
        // No queda ningún jugador: la guerra se da por terminada y gana la máquina que va por delante
        const mejor = FM.vivos(e).slice().sort((a, b) => FM.puntuacion(e, b) - FM.puntuacion(e, a) || a - b)[0];
        FM.terminarGuerra(e, mejor === undefined ? "empate" : mejor, "No queda ningún jugador en la guerra.");
        break;
      }
      if (humanos[e.activo]) break;
      IA.turnoCompleto(e, e.activo);
    }
  }

  /* Repite un turno guardado: { j, acc, h }, { j, ausente, h } o { j, acc, rendicion, h }.
     Devuelve false si este navegador acaba viendo otra cosa que quien lo jugó. */
  function aplicarEntrada(e, humanos, t) {
    if (e.ganador !== null) return true;
    if (t.j !== e.activo) return false;
    if (t.ausente) IA.turnoCompleto(e, t.j);
    else {
      (t.acc || []).forEach(a => { if (e.ganador === null) FM.aplicar(e, a); });
      if (t.rendicion) FM.rendir(e, t.j);
      else if (e.ganador === null && e.activo === t.j) FM.aplicar(e, { t: "terminar" });
    }
    avanzarMaquina(e, humanos);
    return !t.h || t.h === FM.firma(e);
  }

  /* El final, como lo entiende el servidor: asientos que ganan ("0" o "1,3") o "empate" */
  const ganadoresTexto = e => (e.ganador === "empate" || e.ganador === null ? "empate" : (e.ganadores && e.ganadores.length ? e.ganadores : [e.ganador]).slice().sort((a, b) => a - b).join(","));

  /* Lo que hay que mandar al servidor después de un turno: a quién le toca y la firma, contando lo que hará la máquina.
     Se calcula en una copia para no tocar la guerra que se está viendo. */
  function despues(e, humanos, miAsiento) {
    const copia = JSON.parse(JSON.stringify(e));
    avanzarMaquina(copia, humanos);
    return { siguiente: copia.ganador === null ? copia.activo : miAsiento, firma: FM.firma(copia) };
  }

  raiz.FracturaMesa = { crear, avanzarMaquina, aplicarEntrada, ganadoresTexto, despues };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMesa;
})(typeof window !== "undefined" ? window : globalThis);
