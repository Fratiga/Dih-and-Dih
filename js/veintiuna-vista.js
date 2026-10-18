/* =============================================================================
   LAS VEINTIUNA VELAS: lo que se dice y lo que se puede hacer, sin tocar el DOM
   Funciones puras: de lo que manda el servidor (docs/veintiuna.sql) sacan los textos, las acciones que se ofrecen y por qué no se ofrece una.
   Se pueden probar en Node (docs/pruebas-web/veintiuna.js). Nada de aquí decide el resultado de una mano: eso es del servidor.
============================================================================= */
(function (raiz) {
  const nombrePalo = ["picas", "corazones", "diamantes", "tréboles"];
  const nombreRango = r => ({ 1: "as", 11: "jota", 12: "reina", 13: "rey" }[r] || String(r));
  const nombreCarta = c => `${nombreRango(c.r)} de ${nombrePalo[c.p]}`;
  const lista = (partes) => partes.length < 2 ? (partes[0] || "") : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];

  /* Tokens sin ceros de sobra: 20, 7,5 */
  function monedas(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return (Math.round(x * 100) / 100).toLocaleString("es", { maximumFractionDigits: 2 });
  }
  const conSigno = n => (Number(n) > 0 ? "+" : Number(n) < 0 ? "−" : "") + monedas(Math.abs(Number(n)));
  const plural = (n, uno, varios) => `${monedas(n)} ${Number(n) === 1 ? uno : varios}`;

  /* ---------------------------------------------------------------- las reglas especiales, con todo lo que hay que saber antes de apostar */
  const REGLAS = {
    fortuna: {
      id: "fortuna", nombre: "Fortuna", lema: "Una carta de más puede salvarse.",
      resumen: "Si te pasas de 21, paga un peaje y esa carta vale 1.",
      detalle: peaje => [
        "Una vez por ronda, si pides una carta y te pasas de 21, puedes convertirla en un as de valor 1 pagando el peaje (" + peaje + ").",
        "La carta convertida vale 1 aunque sea un rey, y no sube a 11. Si no pagas, o ya la usaste, pierdes la mano.",
        "Si la mano termina, el peaje no se devuelve. En la mesa de práctica el peaje es simbólico."
      ],
      estado: (usada, fase) => usada ? "Gastada" : fase === "fortuna" ? "Decide ahora" : "Se activa si te pasas"
    },
    maldicion: {
      id: "maldicion", nombre: "Maldición", lema: "Las figuras pesan más.",
      resumen: "J, Q y K valen 11, para ti y para el crupier.",
      detalle: () => [
        "En esta ronda las jotas, las reinas y los reyes valen 11. Los ases siguen valiendo 1 u 11, y las demás cartas, su número.",
        "Dos figuras suman 22: se pasa quien las reciba al repartir. Si eres tú, pierdes la mano; si es el crupier, ganas.",
        "Un rey y un 10 suman 21 y cuentan como blackjack natural."
      ],
      estado: () => "Activa en toda la ronda"
    },
    voluntad: {
      id: "voluntad", nombre: "Última voluntad", lema: "Reescribe tu última carta.",
      resumen: "Paga un peaje y cambia tu última carta por la siguiente.",
      detalle: peaje => [
        "Una vez por ronda, mientras no tengas 21, puedes pagar el peaje (" + peaje + ") para devolver tu última carta al mazo y recibir la siguiente de la baraja.",
        "Sirve para cambiar una carta que te estorba, o para jugártela: si la nueva te hace pasar de 21, pierdes (en esta regla no hay Fortuna). Cambiar una carta que dejaba tu mano baja es seguro mientras el resto de tu mano sume 11 o menos.",
        "Después sigues con tu mano nueva (pedir o plantarte); el crupier juega su turno como siempre. El peaje no se devuelve y en la mesa de práctica es simbólico."
      ],
      estado: (usada) => usada ? "Gastada" : "Disponible"
    },
    ojo: {
      id: "ojo", nombre: "Ojo del Tahúr", lema: "Mira antes de saltar.",
      resumen: "Paga un peaje y mira la siguiente carta de la baraja.",
      detalle: peaje => [
        "Una vez por ronda, mientras no tengas 21, puedes pagar el peaje (" + peaje + ") para ver la siguiente carta de la baraja antes de decidir.",
        "Es la carta que recibirías si pides. Si te plantas, es la primera que robará el crupier si le hace falta: así funciona una baraja de verdad.",
        "Solo mira: no cambia nada. El peaje no se devuelve y en la mesa de práctica es simbólico."
      ],
      estado: (usada) => usada ? "Gastado" : "Disponible"
    },
    marcadas: {
      id: "marcadas", nombre: "Cartas marcadas", lema: "La casa ya no esconde nada.",
      resumen: "Paga un peaje y mira la carta oculta del crupier.",
      detalle: peaje => [
        "Una vez por ronda puedes pagar el peaje (" + peaje + ") para ver la carta oculta del crupier. Solo la ves tú.",
        "Sabiendo cuánto suma su mano, sabes cuándo te basta con plantarte y cuándo te toca arriesgar. La carta no cambia ni se mueve: sigue oculta hasta que el crupier juega su turno.",
        "El peaje no se devuelve y en la mesa de práctica es simbólico."
      ],
      estado: (usada) => usada ? "Gastadas" : "Disponibles"
    },
    trueque: {
      id: "trueque", nombre: "Trueque con la casa", lema: "Tu carta por la suya.",
      resumen: "Cambia tu primera carta por la que el crupier enseña.",
      detalle: peaje => [
        "Una vez por ronda, antes de pedir carta, puedes pagar el peaje (" + peaje + ", una apuesta igual) para cambiar tu primera carta por la que el crupier tiene boca arriba. Los dos veis el cambio.",
        "Con un 2 y un 3 contra un rey, por ejemplo, pasas a tener rey y 3, y el crupier a enseñar un 2. Si el cambio te deja en 21 no es blackjack natural: no paga 3 a 2.",
        "La carta oculta del crupier no se toca. El peaje no se devuelve y en la mesa de práctica es simbólico."
      ],
      estado: (usada) => usada ? "Hecho" : "Disponible antes de pedir"
    },
    vela: {
      id: "vela", nombre: "Vela corta", lema: "La cera se derrite antes.",
      resumen: "El crupier se planta con 16, pero el natural paga 6 a 5.",
      detalle: () => [
        "En esta ronda el crupier se planta con 16 o más, en lugar de 17: pide con 15 o menos. Sigue plantándose con un 17 blando.",
        "A cambio, un blackjack natural paga 6 a 5 en lugar de 3 a 2 (con 10 de apuesta cobras 22 y no 25).",
        "No hay botón ni peaje: cambia lo que te conviene hacer con 12 a 16 puntos."
      ],
      estado: () => "Activa en toda la ronda"
    },
    bufon: {
      id: "bufon", nombre: "Pacto del Bufón", lema: "Un dado antes de decidir.",
      resumen: "Al repartir, el Bufón puede cambiar una carta al azar.",
      detalle: () => [
        "Al repartir, el Bufón tira un dado: con 1 o 2 no pasa nada; con 3 o 4 cambia la carta visible del crupier por la siguiente de la baraja; con 5 o 6 hace lo mismo con tu primera carta.",
        "Siempre es por una carta al azar, así que de media ni te ayuda ni te estorba: solo pone caos antes de que decidas nada. La carta oculta nunca se toca.",
        "No hay botón ni peaje."
      ],
      estado: (usada, fase, evento) => evento === "crupier" ? "Cambió la carta del crupier" : evento === "jugador" ? "Cambió tu primera carta" : evento === "nada" ? "El dado no cambió nada" : "El dado decide al repartir"
    }
  };
  const ORDEN_REGLAS = ["fortuna", "maldicion", "voluntad", "ojo", "marcadas", "trueque", "vela", "bufon"];
  // Lo que enseña el botón de la acción especial de cada regla
  const BOTON_ESPECIAL = {
    voluntad: ["Última voluntad", "cambia tu última carta"],
    ojo: ["Ojo del Tahúr", "ver la siguiente carta"],
    marcadas: ["Cartas marcadas", "ver la carta oculta"],
    trueque: ["Trueque con la casa", "tu 1.ª carta por la del crupier"]
  };

  /* ---------------------------------------------------------------- resultados */
  const RAZONES = {
    natural: "Blackjack natural: 21 con tus dos primeras cartas.",
    ambos_natural: "Los dos tenéis blackjack natural. Se devuelve la apuesta.",
    natural_crupier: "El crupier tiene blackjack natural.",
    pasado_al_repartir: "Dos figuras con la Maldición suman 22: te pasas al repartir.",
    crupier_pasado_al_repartir: "El crupier recibió dos figuras con la Maldición y se pasó al repartir.",
    te_pasas: "Te pasaste de 21.",
    crupier_se_pasa: "El crupier se pasó de 21.",
    mayor: "Tu mano gana a la del crupier.",
    menor: "La mano del crupier gana a la tuya.",
    igual: "Empate: se devuelve la apuesta."
  };
  const TITULOS = { natural: "Blackjack", victoria: "Ganas", empate: "Empate", derrota: "Pierdes" };

  function resultado(est) {
    const r = est && est.resultado;
    if (!r || r === "null") return null;
    const gano = r.tipo === "natural" || r.tipo === "victoria";
    const practica = est.modo === "practica";
    let linea;
    if (practica) linea = "Mesa de práctica: sin tokens en juego.";
    else if (r.tipo === "empate") linea = `Recuperas tu apuesta de ${monedas(r.apuesta)}.`;
    else if (gano) linea = `Cobras ${monedas(r.pago)} (${conSigno(r.neto)} contra tu apuesta de ${monedas(r.apuesta)}${Number(r.peajes) > 0 ? " y el peaje de " + monedas(r.peajes) : ""}).`;
    else linea = `Pierdes ${monedas(Number(r.apuesta) + Number(r.peajes || 0))}${Number(r.peajes) > 0 ? " (apuesta y peaje)" : ""}.`;
    return { tipo: r.tipo, titulo: TITULOS[r.tipo], razon: RAZONES[r.razon] || "", linea, gano, empate: r.tipo === "empate", neto: Number(r.neto), practica, pago: Number(r.pago) };
  }

  /* ---------------------------------------------------------------- lo que se anuncia a un lector de pantalla */
  function anuncio(antes, est) {
    const j = est.jugador, c = est.crupier;
    const partes = [];
    const nA = antes ? antes.jugador.cartas.length : 0;
    const nuevas = j.cartas.slice(nA);
    if (!antes || antes.partida !== est.partida) {
      partes.push(`Reparto. Regla de la ronda: ${REGLAS[est.regla.id].nombre}.`);
      partes.push(`Tus cartas: ${lista(j.cartas.map(nombreCarta))}. Suman ${j.total}${j.blando ? " en blando" : ""}.`);
      if (c.cartas[0]) partes.push(`El crupier muestra ${nombreCarta(c.cartas[0])}${c.ocultas ? " y tiene una carta oculta" : ""}.`);
    } else if (nuevas.length) {
      partes.push(`Recibes ${lista(nuevas.map(nombreCarta))}. Sumas ${j.total}${j.blando ? " en blando" : ""}.`);
    } else if (antes.regla.id === "voluntad" && !antes.regla.usada && est.regla.usada) {
      partes.push(`Cambias tu última carta: ahora tienes ${nombreCarta(j.cartas[j.cartas.length - 1])}. Sumas ${j.total}${j.blando ? " en blando" : ""}.`);
    }
    if (est.regla.evento && (!antes || antes.partida !== est.partida)) {
      partes.push(est.regla.evento === "nada" ? "El dado del Bufón no cambia nada." : est.regla.evento === "crupier" ? "El Bufón cambia la carta visible del crupier." : "El Bufón cambia tu primera carta.");
    }
    if (est.regla.proxima && !(antes && antes.regla.proxima && antes.partida === est.partida)) partes.push(`Miras la baraja: la siguiente carta es ${nombreCarta(est.regla.proxima)}.`);
    if (c.vista && !(antes && antes.crupier.vista && antes.partida === est.partida)) partes.push(`La carta oculta del crupier es ${nombreCarta(c.vista)}.`);
    if (antes && antes.partida === est.partida && est.regla.id === "trueque" && est.regla.usada && !antes.regla.usada) {
      partes.push(`Haces el trueque: ahora tienes ${lista(j.cartas.map(nombreCarta))} y el crupier enseña ${nombreCarta(c.cartas[0])}. Sumas ${j.total}.`);
    }
    if (est.fase === "fortuna") partes.push("Te pasaste de 21. Puedes pagar el peaje de la Fortuna para salvar la mano, o aceptar la derrota.");
    if (est.estado === "terminada") {
      partes.push(`El crupier enseña ${lista(c.cartas.map(nombreCarta))}, suma ${c.total}.`);
      const r = resultado(est);
      if (r) partes.push(`${r.titulo}. ${r.razon} ${r.linea}`);
    }
    return partes.join(" ");
  }

  /* ---------------------------------------------------------------- qué botones se ofrecen */
  function acciones(est) {
    if (!est || est.estado !== "en_curso") return { fase: "apuesta", botones: [] };
    const a = est.acciones || {};
    if (est.fase === "fortuna") {
      const e = a.especial || {};
      return {
        fase: "fortuna", botones: [
          { id: "fortuna", texto: "Salvar la mano", sub: est.modo === "practica" ? `peaje simbólico de ${monedas(e.peaje)}` : `peaje ${monedas(e.peaje)}`, habilitado: !!e.disponible, motivo: e.motivo || "", principal: true, tecla: "V" },
          { id: "aceptar", texto: "Aceptar la derrota", sub: "sin peaje", habilitado: true, motivo: "", tecla: "A" }]
      };
    }
    const botones = [
      { id: "pedir", texto: "Pedir carta", sub: a.pedir ? "" : "ya tienes 21", habilitado: !!a.pedir, motivo: a.pedir ? "" : "Con 21 no se pide más.", tecla: "P" },
      { id: "plantar", texto: "Plantarse", sub: "", habilitado: !!a.plantar, motivo: "", principal: true, tecla: "L" }
    ];
    const e = a.especial;
    if (e && e !== "null" && BOTON_ESPECIAL[e.tipo]) {
      const [texto, efecto] = BOTON_ESPECIAL[e.tipo];
      botones.push({ id: e.tipo, texto, sub: e.disponible ? efecto + " · " + (est.modo === "practica" ? `peaje simbólico ${monedas(e.peaje)}` : `peaje ${monedas(e.peaje)}`) : e.motivo, habilitado: !!e.disponible, motivo: e.disponible ? "" : texto + ": " + e.motivo + ".", especial: true, tecla: "V" });
    }
    return { fase: "mano", botones };
  }

  /* ---------------------------------------------------------------- el panel de apuesta */
  function fichasDisponibles(limites) {
    const { min, max, paso } = limites;
    const base = [min, min * 2, min * 5, min * 10].filter(v => v <= max && v % paso === 0);
    if (!base.includes(max) && max % paso === 0) base.push(max);
    return [...new Set(base)].sort((a, b) => a - b);
  }
  // Por qué no se puede apostar esa cantidad (texto vacío si se puede)
  function motivoApuesta(cant, saldo, limites) {
    if (cant < limites.min) return `La apuesta mínima es ${monedas(limites.min)}.`;
    if (cant > limites.max) return `La apuesta máxima es ${monedas(limites.max)}.`;
    if (cant % limites.paso !== 0) return `Se apuesta de ${monedas(limites.paso)} en ${monedas(limites.paso)}.`;
    if (cant > saldo) return `Te faltan ${monedas(cant - saldo)} tokens para apostar ${monedas(cant)} (tienes ${monedas(saldo)}).`;
    return "";
  }
  function ajustarApuesta(cant, saldo, limites) {
    const tope = Math.min(limites.max, Math.floor(saldo / limites.paso) * limites.paso);
    return Math.max(0, Math.min(cant, tope));
  }
  // La apuesta que se propone al sentarse o al terminar una mano: la anterior si cabe (o la mayor que cabe), y si es la primera vez, ninguna: se elige con las fichas
  function apuestaInicial(anterior, saldo, limites) {
    if (!anterior || anterior < limites.min) return 0;
    const quiere = anterior;
    const cabe = ajustarApuesta(quiere, saldo, limites);
    return cabe >= limites.min ? cabe : 0;
  }

  /* ---------------------------------------------------------------- errores de red y del servidor, con palabras */
  function mensajeError(e) {
    if (!e) return "Algo falló.";
    if (e.tipo === "red") return "No hay conexión con la mesa. Tu mano está a salvo en el servidor: pulsa Reintentar.";
    const pistas = {
      sin_sesion: "Tu sesión se cerró. Vuelve a iniciar sesión para seguir jugando.",
      mano_en_curso: "Ya tenías una mano abierta. La recupero.",
      paso_futuro: "La mesa y tu pantalla no coincidían. La sincronizo.",
      no_encontrada: "No encuentro esa mano. La mesa se recarga.",
      mano_terminada: "Esa mano ya había terminado."
    };
    return pistas[e.codigo] || e.mensaje || "Algo falló en la mesa.";
  }

  /* ---------------------------------------------------------------- desafíos */
  const NIVELES = { bronce: "Bronce", plata: "Plata", oro: "Oro" };
  function estadoLogro(l) {
    if (l.reclamado) return "reclamado";
    if (l.completado) return "listo";
    return "pendiente";
  }

  /* ---------------------------------------------------------------- lo que dice la crupier (breve y de vez en cuando) */
  const DICHOS = {
    ronda: ["Las velas aguardan.", "Siéntate. La cera no se enfría sola.", "Una mano más, si te atreves."],
    reparto: ["Cartas en el aire.", "Que arda la primera."],
    tuTurno: ["Tú decides.", "Piensa bien."],
    suTurno: ["Veamos qué me deja el mazo.", "Mi turno."],
    gana: ["Otra vela que se apaga.", "La casa sonríe.", "Así es la cera."],
    pierde: ["Qué fastidio. Cobra.", "Se apagó la mía.", "Esta vez, tuya."],
    empate: ["Tablas. Nadie arde.", "Ni tú ni yo."],
    natural: ["Veintiuna a la primera. Qué descaro.", "La suerte te besa."],
    pasas: ["Demasiado cerca del fuego.", "Te quemaste."],
    sePasa: ["Me he derretido.", "Me pasé de fuego."],
    fortuna: ["La suerte tiene peaje.", "Salvada, a un precio."],
    voluntad: ["Última voluntad concedida.", "Reescribe tu suerte, pues.", "Esa carta ya no cuenta."],
    maldicion: ["Esta mano está maldita.", "Las figuras pesan hoy."],
    ojo: ["Mira, mira. El mazo no guarda secretos.", "Un vistazo no hace daño. Cuesta, eso sí."],
    marcadas: ["Así que ves mi mano. Qué descaro.", "Las cartas hablan, ¿verdad?"],
    trueque: ["Trato hecho. Tu carta es mía.", "El trueque, siempre a favor de quien lo paga."],
    vela: ["Esta vela se apaga antes.", "Hoy me derrito pronto."],
    bufon: ["¡El Bufón mete la mano!", "Un poquito de caos no le hace mal a nadie."],
    bufonNada: ["El dado no quiso nada esta vez.", "El Bufón bosteza."],
    sinMonedas: ["Sin tokens no hay mesa. La práctica es gratis."]
  };
  const elegir = (clave, azar) => { const l = DICHOS[clave] || []; return l.length ? l[Math.floor((azar ? azar() : Math.random()) * l.length) % l.length] : ""; };

  const API = { ORDEN_REGLAS, BOTON_ESPECIAL, monedas, conSigno, plural, REGLAS, RAZONES, TITULOS, resultado, anuncio, acciones, fichasDisponibles, motivoApuesta, ajustarApuesta, apuestaInicial, mensajeError, NIVELES, estadoLogro, DICHOS, elegir, nombreCarta, nombreRango, lista };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.VeintiunaVista = API;
})(typeof window !== "undefined" ? window : globalThis);
