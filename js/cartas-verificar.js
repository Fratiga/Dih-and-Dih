/* Triunfos: comprobar una partida entre jugadores volviéndola a jugar.
   El motor (js/cartas-motor.js) es determinista: con la semilla, los mazos, las cartas guardadas y la lista de acciones sale
   siempre la misma partida, y una acción que no vale se ignora igual en todos los navegadores. Por eso el registro de acciones
   es la verdad, y lo que un jugador «avise» como resultado solo es una pista. Este archivo lo usan:
     * la Edge Function «cartas-verificar» (servidor), para cerrar disputas y apuestas atascadas con pruebas;
     * el panel de admin, para enseñar qué dice el registro antes de resolver a mano;
     * tools/probar-verificacion.js, para probarlo.
   No toca la pantalla ni la red: recibe la fila de la partida y el motor y devuelve un veredicto. */
(function (raiz) {
  /* fila: la fila de cartas_partidas (semilla, primero, cartas, j1, j2, nombre1, nombre2, mazo1, mazo2, acciones, actualizada).
     M: CartasMotor ya cargado (con los efectos y los vínculos registrados).
     opciones: { ahora (ms, por defecto Date.now()), horasTurno (tras cuántas horas sin actuar pierde quien tenía que actuar; 0 = nunca) }
     Devuelve uno de:
       { estado: "terminada", resultado: "j1" | "j2" | "empate", motivo, acciones, ignoradas }
       { estado: "abandono", resultado: "j1" | "j2", pierde: 0 | 1, horas }           (ganó quien no era el que debía actuar)
       { estado: "en_juego", actua: 0 | 1, horas }
       { estado: "error", mensaje } */
  function analizar(fila, M, opciones) {
    const o = opciones || {};
    try {
      if (!fila || fila.semilla === null || fila.semilla === undefined || !Array.isArray(fila.mazo1) || !Array.isArray(fila.mazo2)) {
        return { estado: "error", mensaje: "La partida no está completa (falta la semilla o algún mazo)." };
      }
      const est = M.crearPartida({
        semilla: fila.semilla, primero: fila.primero, cartas: fila.cartas || {},
        jugadores: [{ id: fila.j1, nombre: fila.nombre1, mazo: fila.mazo1 }, { id: fila.j2, nombre: fila.nombre2, mazo: fila.mazo2 }]
      });
      const acciones = Array.isArray(fila.acciones) ? fila.acciones : [];
      let ignoradas = 0;
      // Igual que construir() en js/batalla.js: una acción que no vale se ignora, igual en todos los navegadores
      for (const a of acciones) {
        const r = M.reproducir(est, a);
        if (r && r.error) ignoradas++;
      }
      if (est.ganador !== null) {
        return { estado: "terminada", resultado: est.ganador === "empate" ? "empate" : est.ganador === 0 ? "j1" : "j2", motivo: est.motivo || "vida", acciones: acciones.length, ignoradas };
      }
      const actua = M.quienActua(est);
      const desde = Date.parse(fila.actualizada);
      const ahora = o.ahora === undefined ? Date.now() : o.ahora;
      const horas = Number.isFinite(desde) ? Math.max(0, (ahora - desde) / 3600000) : 0;
      if (o.horasTurno && horas >= o.horasTurno) {
        return { estado: "abandono", resultado: actua === 0 ? "j2" : "j1", pierde: actua, horas: Math.round(horas * 10) / 10 };
      }
      return { estado: "en_juego", actua, horas: Math.round(horas * 10) / 10 };
    } catch (e) {
      return { estado: "error", mensaje: String((e && e.message) || e) };
    }
  }

  /* Compara los avisos de los jugadores (reporte1, reporte2) con el veredicto: devuelve quién avisó algo que el registro desmiente */
  function avisosFalsos(fila, veredicto) {
    const out = [];
    if (!veredicto || (veredicto.estado !== "terminada" && veredicto.estado !== "abandono")) return out;
    [[fila.reporte1, fila.nombre1, 1], [fila.reporte2, fila.nombre2, 2]].forEach(([aviso, nombre, n]) => {
      if (aviso && aviso !== veredicto.resultado) out.push({ jugador: n, nombre, aviso, verdad: veredicto.resultado });
    });
    return out;
  }

  const V = { analizar, avisosFalsos };
  raiz.CartasVerificar = V;
  if (typeof module !== "undefined" && module.exports) module.exports = V;
})(typeof window !== "undefined" ? window : globalThis);
