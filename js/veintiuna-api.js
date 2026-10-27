/* =============================================================================
   LAS VEINTIUNA VELAS: la conversación con el servidor (docs/veintiuna.sql)
   Cinco llamadas de la mesa individual (mesa, repartir, accion, historial y reclamar) y las de la mesa con amigos (amigos.*). Todas devuelven lo que el servidor confirma o lanzan un ErrorMesa:
     { tipo: "red" }       no llegó respuesta (sin conexión o tardó demasiado). La petición PUEDE haberse aplicado: repetirla con los mismos
                           identificadores es seguro (repartir lleva el identificador de la mano y accion lleva el número de paso).
     { tipo: "servidor" }  el servidor la rechazó; "codigo" es la pista (saldo_insuficiente, mano_en_curso, paso_futuro...) y "mensaje" el texto.
   Nada de aquí decide un resultado. El navegador solo pide y muestra.
============================================================================= */
(function (raiz) {
  class ErrorMesa extends Error {
    constructor(tipo, mensaje, codigo) { super(mensaje); this.name = "ErrorMesa"; this.tipo = tipo; this.codigo = codigo || ""; this.mensaje = mensaje; }
  }
  const TIEMPO_MAX_MS = 15000;

  function esErrorDeRed(error) {
    if (!error) return false;
    if (error.hint || /^P0001$/.test(error.code || "")) return false;           // lo lanzó la función a propósito: es un rechazo, no un corte
    const t = `${error.message || ""} ${error.details || ""}`;
    return /fetch|network|failed to|load failed|timeout|abort|offline|conexi/i.test(t) || error.code === "" || error.code === undefined && !error.message;
  }

  function crear(obtenerCliente, opciones) {
    const tiempoMax = (opciones && opciones.tiempoMax) || TIEMPO_MAX_MS;
    async function llamar(nombre, args) {
      let cliente;
      try { cliente = await obtenerCliente(); } catch (e) { throw new ErrorMesa("red", "No se pudo abrir la conexión con la mesa.", ""); }
      let respuesta;
      try {
        respuesta = await Promise.race([
          Promise.resolve(cliente.rpc(nombre, args)),
          new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("timeout")), tiempoMax))
        ]);
      } catch (e) { throw new ErrorMesa("red", "La mesa tardó demasiado en responder.", ""); }
      if (respuesta && respuesta.error) {
        const e = respuesta.error;
        if (esErrorDeRed(e)) throw new ErrorMesa("red", e.message || "Sin conexión.", "");
        throw new ErrorMesa("servidor", String(e.message || "").replace(/^ERROR:\s*/, ""), e.hint || "");
      }
      return respuesta ? respuesta.data : null;
    }
    return {
      mesa: () => llamar("veintiuna_mesa", {}),
      repartir: (cliente, modo, apuesta) => llamar("veintiuna_repartir", { p_cliente: cliente, p_modo: modo, p_apuesta: modo === "apuesta" ? apuesta : 0 }),
      accion: (partida, paso, accion) => llamar("veintiuna_accion", { p_partida: partida, p_paso: paso, p_accion: accion }),
      historial: limite => llamar("veintiuna_historial", { p_limite: limite || 15 }),
      reclamar: logro => llamar("veintiuna_reclamar", { p_logro: logro }),
      // La Última Vela, el reto de Muerte Súbita contra Cera (docs/veintiuna-reto.sql). repartir lleva cuántas manos había repartidas y accion el paso de la mano: repetirlas es seguro.
      reto: {
        estado: intento => llamar("veintiuna_reto_estado", { p_intento: intento }),
        repartir: (intento, manos) => llamar("veintiuna_reto_repartir", { p_intento: intento, p_manos: manos }),
        accion: (intento, paso, accion) => llamar("veintiuna_reto_accion", { p_intento: intento, p_paso: paso, p_accion: accion })
      },
      // El Pozo del Dragón (docs/pozo-dragon.sql). Las acciones de turno llevan el paso de la mesa que veía el jugador: repetirlas es seguro.
      pozo: {
        lista: () => llamar("pozo_lista", {}),
        crear: (modo, privada, nombre, dinero, cartas, max) => llamar("pozo_crear", { p_modo: modo, p_privada: !!privada, p_nombre: nombre || null, p_dinero: dinero || 0, p_cartas: cartas || 0, p_max: max || null }),
        unirse: codigo => llamar("pozo_unirse", { p_codigo: codigo }),
        cerrarInscripcion: () => llamar("pozo_cerrar_inscripcion", {}),
        ofrecer: cartas => llamar("pozo_ofrecer", { p_cartas: cartas }),
        confirmar: cond => llamar("pozo_confirmar", { p_cond: cond }),
        retirarConfirmacion: () => llamar("pozo_retirar_confirmacion", {}),
        salir: () => llamar("pozo_salir", {}),
        tirar: paso => llamar("pozo_tirar", { p_paso: paso }),
        cobrar: paso => llamar("pozo_cobrar", { p_paso: paso }),
        continuar: paso => llamar("pozo_continuar", { p_paso: paso }),
        estado: version => llamar("pozo_estado", { p_version: version == null ? null : version }),
        misCartas: () => llamar("pozo_mis_cartas", {}),
        // El modo solitario: empezar lleva un identificador nuevo por partida (repetirlo devuelve la misma, sin cobrar dos veces) y tirar/cobrar el paso de la partida
        solo: {
          estado: () => llamar("pozo_solo_estado", {}),
          empezar: (cliente, apuesta) => llamar("pozo_solo_empezar", { p_cliente: cliente, p_apuesta: apuesta }),
          tirar: (id, paso) => llamar("pozo_solo_tirar", { p_id: id, p_paso: paso }),
          cobrar: (id, paso) => llamar("pozo_solo_cobrar", { p_id: id, p_paso: paso }),
          descartar: () => llamar("pozo_solo_descartar", {})
        }
      },
      // La mesa con amigos (docs/veintiuna.sql, sección 8). estado(version) devuelve {sin_cambios} si no cambió nada desde esa versión.
      amigos: {
        lista: () => llamar("veintiuna_amigos_lista", {}),
        crear: (nombre, privada, cartas, modo) => llamar("veintiuna_amigos_crear", { p_nombre: nombre || null, p_privada: !!privada, p_cartas: !!cartas, p_modo: modo === "duelo" ? "duelo" : "casa" }),
        unirse: codigo => llamar("veintiuna_amigos_unirse", { p_codigo: codigo }),
        salir: () => llamar("veintiuna_amigos_salir", {}),
        estado: version => llamar("veintiuna_amigos_estado", { p_version: version == null ? null : version }),
        misCartas: () => llamar("veintiuna_amigos_mis_cartas", {}),
        apostar: (apuesta, carta) => llamar("veintiuna_amigos_apostar", { p_apuesta: apuesta, p_carta: carta || null }),
        pasar: () => llamar("veintiuna_amigos_pasar", {}),
        repartir: () => llamar("veintiuna_amigos_repartir", {}),
        accion: (paso, accion) => llamar("veintiuna_amigos_accion", { p_paso: paso, p_accion: accion })
      }
    };
  }

  const nuevoId = () => {
    if (raiz.crypto && raiz.crypto.randomUUID) return raiz.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
  };

  const API = { crear, ErrorMesa, esErrorDeRed, nuevoId };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.VeintiunaApi = API;
})(typeof window !== "undefined" ? window : globalThis);
