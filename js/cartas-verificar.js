/* Triunfos: comprobar una partida entre jugadores volviéndola a jugar.
   El motor (js/cartas-motor.js) es determinista: con la semilla, los mazos, las cartas y los vínculos de la partida y la lista de
   acciones sale siempre la misma partida, y una acción que no vale se ignora igual en todos los navegadores. Por eso el registro de
   acciones es la verdad, y lo que un jugador «avise» como resultado solo es una pista.
   LA PARTIDA SE REPITE CON SU INSTANTÁNEA (fila.instantanea, que el servidor toma al aceptar el reto y no se puede cambiar), nunca con
   las cartas, los vínculos o el motor de hoy: así editar una carta o un vínculo más tarde no cambia retrospectivamente quién ganó.
   Este archivo lo usan:
     * la Edge Function «cartas-verificar» (servidor), para cerrar disputas y apuestas atascadas con pruebas;
     * el panel de admin, para enseñar qué dice el registro antes de resolver a mano;
     * tools/probar-verificacion.js, para probarlo.
   No toca la pantalla ni la red: recibe la fila de la partida y el motor y devuelve un veredicto. */
(function (raiz) {
  /* fila: la fila de cartas_partidas (instantanea, acciones, turno, actualizada).
     M: CartasMotor ya cargado (con los efectos y los vínculos registrados).
     opciones: { ahora (ms, por defecto Date.now()), horasTurno (tras cuántas horas sin actuar pierde quien tenía que actuar; 0 = nunca),
                 aplicarVinculos (función que carga los vínculos de la instantánea en el motor; por defecto aplicarVinculosServidor) }
     Devuelve uno de:
       { estado: "terminada", resultado: "j1" | "j2" | "empate", motivo, acciones, ignoradas, actualizada, motor }
       { estado: "abandono", resultado: "j1" | "j2", pierde: 0 | 1, horas, acciones, actualizada, motor }    (ganó quien no era el que debía actuar)
       { estado: "en_juego", actua: 0 | 1, horas }
       { estado: "motor", mensaje }            (la partida fija otra versión del motor que la que se usa para repetirla)
       { estado: "sin_instantanea", mensaje }  (partida anterior a las instantáneas: no se decide automáticamente)
       { estado: "error", mensaje }
     Seguros: (1) solo se decide con la MISMA versión del motor que fijó el servidor en la instantánea (M.VERSION); si no, no se decide
     nada. (2) Un abandono solo se da si el turno guardado por el servidor coincide con el de la repetición: así «quien tenía que
     actuar» es de verdad quien ese servidor esperaba. Una partida ya terminada según el registro se da por terminada aunque el turno
     guardado no cuadre: el motor ignora igual en todos lados las acciones que no valen, y así nadie puede esquivar una derrota
     estropeando a propósito el turno guardado. */
  function analizar(fila, M, opciones) {
    const o = opciones || {};
    try {
      if (!fila) return { estado: "error", mensaje: "No hay partida." };
      const inst = fila.instantanea;
      if (!inst) return { estado: "sin_instantanea", mensaje: "La partida no tiene instantánea (es anterior a ellas): no se decide automáticamente." };
      if (!Array.isArray(inst.participantes) || inst.participantes.length !== 2 || !Array.isArray(inst.mazos) || inst.mazos.length !== 2
          || inst.semilla === null || inst.semilla === undefined) {
        return { estado: "error", mensaje: "La instantánea de la partida está incompleta." };
      }
      if (M.VERSION !== inst.motor) {
        return { estado: "motor", mensaje: `Esta partida se jugó con la versión ${inst.motor} del motor y la repetición usa la ${M.VERSION}. No se decide automáticamente.` };
      }
      // Los vínculos de entonces (no los de hoy)
      const aplicar = o.aplicarVinculos || raiz.aplicarVinculosServidor;
      if (typeof aplicar === "function") aplicar(inst.vinculos || []);
      const [p1, p2] = inst.participantes;
      const est = M.crearPartida({
        semilla: inst.semilla, primero: inst.primero, cartas: inst.cartas || {},
        jugadores: [{ id: p1.id, nombre: p1.nombre, mazo: inst.mazos[0] }, { id: p2.id, nombre: p2.nombre, mazo: inst.mazos[1] }]
      });
      const acciones = Array.isArray(fila.acciones) ? fila.acciones : [];
      let ignoradas = 0;
      // Igual que construir() en js/batalla.js: una acción que no vale se ignora, igual en todos los navegadores
      for (const a of acciones) {
        const r = M.reproducir(est, a);
        if (r && r.error) ignoradas++;
      }
      if (est.ganador !== null) {
        return { estado: "terminada", resultado: est.ganador === "empate" ? "empate" : est.ganador === 0 ? "j1" : "j2", motivo: est.motivo || "vida", acciones: acciones.length, ignoradas, actualizada: fila.actualizada, motor: inst.motor };
      }
      const actua = M.quienActua(est);
      const desde = Date.parse(fila.actualizada);
      const ahora = o.ahora === undefined ? Date.now() : o.ahora;
      const horas = Number.isFinite(desde) ? Math.max(0, (ahora - desde) / 3600000) : 0;
      if (o.horasTurno && horas >= o.horasTurno) {
        // El turno que guardó el servidor tiene que ser el de la repetición, o no se sabe de quién era la obligación de actuar
        const turnoGuardado = fila.turno === p1.id ? 0 : fila.turno === p2.id ? 1 : null;
        if (turnoGuardado !== est.activo) {
          return { estado: "error", mensaje: "El turno guardado por el servidor no coincide con el de la repetición: no se decide el abandono automáticamente." };
        }
        return { estado: "abandono", resultado: actua === 0 ? "j2" : "j1", pierde: actua, horas: Math.round(horas * 10) / 10, acciones: acciones.length, actualizada: fila.actualizada, motor: inst.motor };
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
    const [p1, p2] = (fila.instantanea && fila.instantanea.participantes) || [{ nombre: fila.nombre1 }, { nombre: fila.nombre2 }];
    [[fila.reporte1, p1.nombre, 1], [fila.reporte2, p2.nombre, 2]].forEach(([aviso, nombre, n]) => {
      if (aviso && aviso !== veredicto.resultado) out.push({ jugador: n, nombre, aviso, verdad: veredicto.resultado });
    });
    return out;
  }

  const V = { analizar, avisosFalsos };
  raiz.CartasVerificar = V;
  if (typeof module !== "undefined" && module.exports) module.exports = V;
})(typeof window !== "undefined" ? window : globalThis);
