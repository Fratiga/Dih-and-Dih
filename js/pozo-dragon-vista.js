/* =============================================================================
   EL POZO DEL DRAGÓN: textos, reglas visibles y decisiones de pantalla, sin tocar el DOM ni la red (así se puede probar con node: docs/pruebas-web/pozo_dragon.js).
   El servidor (docs/pozo-dragon.sql) decide todo; aquí solo se convierte su estado en frases, botones y tablas. La clasificación de los dados y la jerarquía del Duelo
   están copiadas del SQL (pozo_i_clasificar y pozo_i_fuerza) para poder enseñarlas y para que una prueba compruebe que no se separan.
============================================================================= */
(function (raiz) {
  /* ---------------------------------------------------------------- combinaciones */
  const CATEGORIAS = {
    ruina: { nombre: "Ruina", orden: 0, corta: "Suma de 3 a 5", texto: "Cualquier tirada que suma 3, 4 o 5. Pierdes tu sitio en el pozo." },
    ceniza: { nombre: "Ceniza", orden: 1, corta: "Nada especial", texto: "Todo lo que no es otra cosa. No suma ni resta." },
    pareja: { nombre: "Pareja", orden: 2, corta: "Dos dados iguales", texto: "Exactamente dos dados iguales." },
    escalera: { nombre: "Escalera", orden: 3, corta: "Tres seguidos", texto: "1-2-3, 2-3-4, 3-4-5 o 4-5-6." },
    triple: { nombre: "Triple", orden: 4, corta: "Tres iguales (2 a 5)", texto: "Tres dados iguales, de 2 a 5. El 1-1-1 es Ruina." },
    triple_seis: { nombre: "Triple seis", orden: 5, corta: "6-6-6", texto: "La mejor tirada del juego." }
  };
  const ORDEN_MEJOR_A_PEOR = ["triple_seis", "triple", "escalera", "pareja", "ceniza", "ruina"];
  // Casos de 216 y probabilidad de cada combinación (verificados por tools/pozo-dragon-simulacion.js)
  const CASOS = { ruina: 10, triple_seis: 1, triple: 4, escalera: 24, pareja: 81, ceniza: 96 };

  // La misma regla que pozo_i_clasificar del servidor: la Ruina manda sobre todo lo demás
  function clasificar(a, b, c) {
    if (a + b + c <= 5) return "ruina";
    if (a === b && b === c) return a === 6 ? "triple_seis" : "triple";
    const o = [a, b, c].sort((x, y) => x - y);
    if (o[1] === o[0] + 1 && o[2] === o[1] + 1) return "escalera";
    if (a === b || b === c || a === c) return "pareja";
    return "ceniza";
  }
  // La misma que pozo_i_fuerza: para comparar dos tiradas en el Duelo (mayor gana, igual empata)
  function fuerza(a, b, c) {
    const cat = clasificar(a, b, c), o = [a, b, c].sort((x, y) => y - x);
    if (cat === "ruina") return a + b + c;
    if (cat === "ceniza") return 1000 + o[0] * 100 + o[1] * 10 + o[2];
    if (cat === "pareja") { const par = (a === b || a === c) ? a : b; return 2000 + par * 10 + (a + b + c - 2 * par); }
    if (cat === "escalera") return 3000 + o[0];
    if (cat === "triple") return 4000 + a;
    return 5006;
  }
  const comparar = (x, y) => { const fx = fuerza(x[0], x[1], x[2]), fy = fuerza(y[0], y[1], y[2]); return fx > fy ? 1 : fx < fy ? -1 : 0; };
  const nombreCategoria = c => (CATEGORIAS[c] ? CATEGORIAS[c].nombre : String(c || ""));

  /* ---------------------------------------------------------------- números y apuestas */
  const num = n => { const x = Number(n); return Number.isFinite(x) ? x.toLocaleString("es", { maximumFractionDigits: 2 }) : "—"; };
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const pct = x => `${num(Number(x) * 100)} %`;

  // «20 tokens y 2 cartas», «solo 3 cartas», «50 tokens»
  function textoApuesta(r) {
    const d = Number(r.dinero) || 0, c = Number(r.cartas) || 0;
    const partes = [];
    if (d > 0) partes.push(`${num(d)} tokens de juego`);
    if (c > 0) partes.push(plural(c, "carta", "cartas"));
    return partes.length === 2 ? `${partes[0]} y ${partes[1]}` : (partes[0] || "nada");
  }
  const tipoApuesta = r => (r.dinero > 0 && r.cartas > 0 ? "mixta" : r.cartas > 0 ? "solo cartas" : "solo dinero");

  /* ---------------------------------------------------------------- reglas escritas (se enseñan antes de apostar) */
  function reglasDuelo(r) {
    r = r || {};
    return [
      `Dos jugadores, tres dados cada uno por ronda. Tiran por turnos y se comparan las combinaciones.`,
      `Jerarquía de mejor a peor: triple seis, triple (de 2 a 5), escalera, pareja, ceniza y Ruina (suma de 3 a 5). Dentro de una misma combinación gana el valor más alto: el triple por su valor, la escalera por su dado más alto, la pareja por su valor y luego por el dado suelto, la ceniza por sus dados de mayor a menor y la Ruina por su suma.`,
      `Si las dos tiradas son iguales, la ronda empata y no da victoria a nadie. Abre la ronda el que no abrió la anterior.`,
      `Gana el primero que consiga ${r.victorias || 2} rondas. Hay un máximo de ${r.rondas_max || 5} rondas (los empates cuentan): al llegar al límite gana quien lleve más rondas y, si van igualados, la partida acaba en empate y cada uno recupera lo suyo.`,
      `Quien gana se lleva las dos apuestas, el dinero y las cartas. Cada uno tiene ${r.turno_s || 30} segundos por turno: si se pasa, los dados los tira el servidor por él, y si deja pasar ${(r.faltas || 2) + 1} turnos seguidos pierde por abandono.`,
      `Salir de un duelo en marcha es abandonar y se pierde la apuesta. Si ninguno de los dos da señales durante cinco minutos, la partida acaba en empate.`
    ];
  }
  function reglasCompartido(r) {
    r = r || {};
    const b = r.bonos || {};
    return [
      `De 2 a 6 jugadores. Todos ponen la misma apuesta y el pozo es la suma de las apuestas. No entra ni sale nada más: el juego no crea dinero.`,
      `Cada jugador empieza con un peso de 100 % (su apuesta). Cada tirada que no es Ruina suma al peso un bono, en % de la apuesta: pareja +${num(b.pareja * 100)} %, escalera +${num(b.escalera * 100)} %, triple +${num(b.triple * 100)} % y triple seis +${num(b.triple_seis * 100)} %. La ceniza no suma.`,
      `Ruina (suma de 3 a 5): quedas eliminado, pierdes tu peso y tu apuesta se queda en el pozo.`,
      `Tras cada tirada sin Ruina decides: cobrar (te quedas con el peso que llevas y sales de las tiradas) o continuar (tirarás otra vez en tu próximo turno). Cobrar es una decisión válida, no una derrota. Cada jugador tira como máximo ${r.tiradas_max || 5} veces: si llegas a la última sin Ruina, cobras solo.`,
      `Cuando ya no queda nadie en juego, el pozo entero se reparte entre quienes no sufrieron Ruina en proporción a su peso: tu parte = pozo × tu peso / suma de los pesos. Si solo queda un jugador en juego, sigue tirando él solo hasta que cobre, caiga o agote sus tiradas.`,
      `Quien no llega a tirar ninguna vez sale de la mesa y recupera su apuesta sin entrar en el reparto. Si todos sufren Ruina, se devuelven las apuestas.`,
      `Cartas: las de los eliminados forman un botín que se reparte de una en una, las más raras primero, entre los supervivientes de mayor a menor peso. Las cartas de cada uno que siguen en la mesa vuelven a su dueño. Si una carta no se puede entregar por un límite de colección, vuelve a su dueño.`,
      `Cada turno dura ${r.turno_s || 30} segundos: si se acaba, te retiras solo con el peso que lleves (o sales sin participar si todavía no habías tirado). Salir de la mesa en marcha cuenta igual.`
    ];
  }
  const REGLAS_COMUNES = [
    "Los dados los tira el servidor y nadie puede cambiar un resultado. Las animaciones solo enseñan lo que ya se decidió.",
    "Tu apuesta se descuenta de tu saldo al confirmar y las cartas quedan bloqueadas hasta el final de la partida. Una sala que se cancela antes de empezar lo devuelve todo.",
    "Si cambian los jugadores o las cartas ofrecidas, todos tienen que volver a confirmar. Nada cambia después de empezar.",
    "No se cobra ninguna comisión: lo que se paga es exactamente lo apostado.",
    "Si recargas la página o pierdes la conexión, la partida sigue en el servidor y la recuperas donde estaba. Desconectarse no devuelve la apuesta."
  ];

  /* ---------------------------------------------------------------- estados y vistas */
  // Qué pantalla toca: lobby (sin mesa), sala (aún no empezó), mesa (en juego), fin (terminada o cancelada)
  function vista(est) {
    if (!est || est.sin_mesa) return "lobby";
    if (est.estado === "abierta" || est.estado === "confirmando") return "sala";
    if (est.estado === "jugando") return "mesa";
    return "fin";
  }
  const jugadorYo = est => (est && est.jugadores ? est.jugadores.find(j => j.yo) : null) || null;
  const jugadorEn = (est, asiento) => (est && est.jugadores ? est.jugadores.find(j => j.asiento === asiento) : null) || null;
  const rival = est => (est && est.jugadores ? est.jugadores.find(j => !j.yo) : null) || null;

  const ESTADO_JUGADOR = { esperando: "Sin confirmar", confirmado: "Confirmado", activo: "En juego", retirado: "Ha cobrado", ruina: "En Ruina", fuera: "Fuera" };
  const estadoJugador = j => ESTADO_JUGADOR[j.estado] || j.estado;

  // Mensaje de la sala: qué falta para empezar
  function estadoSala(est) {
    const js = est.jugadores || [], n = js.length, max = est.reglas.max, min = est.reglas.min;
    const sinConfirmar = js.filter(j => j.estado !== "confirmado");
    if (est.estado === "abierta") {
      if (n < min) return `Esperando jugadores (${n} de ${min} como mínimo). Comparte el código ${est.codigo}.`;
      if (est.modo === "duelo") return "Esperando al rival.";
      return est.creador ? `Hay ${n} de ${max} jugadores. Cierra la inscripción cuando quieras empezar.` : `Hay ${n} de ${max} jugadores. Quien creó la mesa cerrará la inscripción.`;
    }
    const sinOferta = js.filter(j => !j.oferta_completa);
    if (sinOferta.length) return `Faltan cartas por ofrecer: ${sinOferta.map(j => j.yo ? "tú" : j.nombre).join(", ")}.`;
    if (!sinConfirmar.length) return "Todos han confirmado: empieza la partida.";
    return `Falta confirmar: ${sinConfirmar.map(j => (j.yo ? "tú" : j.nombre)).join(", ")}.`;
  }

  /* ---------------------------------------------------------------- botones */
  function acciones(est) {
    if (!est) return { tipo: "ninguna", botones: [] };
    const yo = jugadorYo(est);
    if (est.estado === "jugando") {
      const t = est.turno || {};
      if (!est.yo || !est.yo.tu_turno) return { tipo: "espera", botones: [] };
      if (t.fase === "decidir") {
        return { tipo: "decidir", botones: [
          { id: "cobrar", texto: "Cobrar", sub: `te quedas con un peso de ${pct(yo.peso)}`, principal: true, tecla: "C" },
          { id: "continuar", texto: "Continuar", sub: `arriesgas un ${pct(10 / 216)} de Ruina`, tecla: "S" }
        ] };
      }
      return { tipo: "tirar", botones: [{ id: "tirar", texto: "Tirar los dados", sub: "", principal: true, tecla: "T" }] };
    }
    return { tipo: "ninguna", botones: [] };
  }

  /* ---------------------------------------------------------------- lo que cuenta el servidor, en frases */
  function dadosTexto(d) { return d ? `${d[0]}-${d[1]}-${d[2]}` : ""; }
  function frasesTirada(ult, modo, bonos) {
    if (!ult) return null;
    const c = ult.categoria, nombre = nombreCategoria(c);
    let efecto = "";
    if (modo === "compartido") {
      if (c === "ruina") efecto = "Ruina: queda eliminado y su apuesta se queda en el pozo.";
      else if (c === "ceniza") efecto = "No cambia su peso.";
      else efecto = `Su peso sube ${pct(bonos[c] || 0)} de la apuesta.`;
    } else if (modo === "solo") {
      if (c === "ruina") efecto = "Ruina: pierdes el premio y se acaba la partida.";
      else if (c === "ceniza") efecto = "No cambia tu premio.";
      else efecto = `Tu premio sube ${pct(bonos[c] || 0)} de tu apuesta.`;
    } else {
      efecto = CATEGORIAS[c] ? CATEGORIAS[c].corta : "";
    }
    return { nombre, dados: dadosTexto(ult.dados), efecto };
  }

  // Resultado final desde el punto de vista del jugador (para la pantalla de cierre)
  function resumenFinal(est) {
    if (!est || est.estado === "jugando") return null;
    if (est.estado === "cancelada") return { clase: "cancelada", titulo: "Mesa cancelada", texto: (est.motivo || "La mesa se canceló antes de empezar.") + " Todo lo reservado se devolvió.", neto: 0 };
    const r = est.resultado;
    if (!r) return null;
    const yo = jugadorYo(est);
    const mio = (r.jugadores || []).find(x => yo && x.asiento === yo.asiento) || {};
    const neto = Number(mio.neto) || 0;
    const ganadas = (mio.cartas_ganadas || []).length, perdidas = (mio.cartas_perdidas || []).length;
    let clase, titulo;
    if (est.modo === "duelo") {
      if (r.ganador == null) { clase = "empate"; titulo = "Empate"; }
      else if (yo && r.ganador === yo.asiento) { clase = "gana"; titulo = "Has ganado el duelo"; }
      else { clase = "pierde"; titulo = "Has perdido el duelo"; }
    } else if (!yo || mio.estado === "ruina") { clase = "pierde"; titulo = "Ruina: el Dragón se queda con tu apuesta"; }
    else if (mio.estado === "fuera") { clase = "empate"; titulo = "Saliste sin participar"; }
    else if (neto > 0 || ganadas > 0) { clase = "gana"; titulo = "Cobras del pozo"; }
    else if (neto < 0 || perdidas > 0) { clase = "pierde"; titulo = "Cobras menos de lo que apostaste"; }
    else { clase = "empate"; titulo = "Recuperas tu apuesta"; }
    const partes = [];
    partes.push(`${neto > 0 ? "Ganas" : neto < 0 ? "Pierdes" : "Quedas igual:"} ${neto === 0 ? "" : num(Math.abs(neto)) + " tokens de juego"}`.trim() + ".");
    if (ganadas) partes.push(`Ganas ${plural(ganadas, "carta", "cartas")}.`);
    if (perdidas) partes.push(`Pierdes ${plural(perdidas, "carta", "cartas")}.`);
    if (r.motivo) partes.push(r.motivo + ".");
    return { clase, titulo, texto: partes.join(" "), neto, ganadas, perdidas };
  }

  /* ---------------------------------------------------------------- lo que lee el lector de pantalla */
  function anuncio(antes, est) {
    const p = [];
    if (!est || est.sin_mesa) return "";
    const v = vista(est);
    if (!antes || vista(antes) !== v) {
      if (v === "mesa") p.push("Empieza la partida.");
      if (v === "fin") { const r = resumenFinal(est); if (r) p.push(`${r.titulo}. ${r.texto}`); }
    }
    if (v === "mesa") {
      const t = est.turno, yo = est.yo;
      if (t && (!antes || !antes.turno || antes.turno.asiento !== t.asiento || antes.turno.fase !== t.fase)) {
        const j = jugadorEn(est, t.asiento);
        if (yo && yo.tu_turno) p.push(t.fase === "decidir" ? "Decide: cobrar o continuar." : "Es tu turno. Tira los dados.");
        else if (j) p.push(`Le toca a ${j.nombre}.`);
      }
      (est.jugadores || []).forEach(j => {
        const ant = antes && antes.jugadores ? antes.jugadores.find(x => x.asiento === j.asiento) : null;
        if (j.ultima && (!ant || !ant.ultima || ant.ultima.id !== j.ultima.id)) {
          const f = frasesTirada(j.ultima, est.modo, est.reglas.bonos);
          p.push(`${j.yo ? "Sacas" : j.nombre + " saca"} ${f.dados}: ${f.nombre}.`);
        }
        if (ant && ant.estado !== j.estado) {
          if (j.estado === "ruina") p.push(`${j.yo ? "Caes en Ruina" : j.nombre + " cae en Ruina"}.`);
          if (j.estado === "retirado") p.push(`${j.yo ? "Cobras" : j.nombre + " cobra"}.`);
        }
      });
    }
    return p.join(" ");
  }

  /* ---------------------------------------------------------------- errores del servidor */
  const ERRORES = {
    oculto: "El Pozo del Dragón todavía no está abierto.",
    sin_sesion: "Hay que iniciar sesión para jugar.",
    saldo_insuficiente: null,
    ya_en_mesa: null,
    mesa_no_existe: "No hay ninguna mesa con ese código.",
    mesa_llena: "La mesa está llena.",
    mesa_cerrada: "Esa mesa ya no admite jugadores.",
    condiciones_cambiadas: "Las condiciones cambiaron mientras mirabas. Revísalas y vuelve a confirmar.",
    carta_invalida: null,
    fuera_de_turno: "Ahora no te toca.",
    paso_futuro: "La mesa y tu pantalla no coinciden. Recarga la página.",
    demasiados_cambios: null,
    faltan_ofertas: null,
    faltan_jugadores: null
  };
  function mensajeError(e) {
    if (!e) return "Algo falló.";
    if (e.tipo === "red") return "No hay conexión con la mesa. Lo que hiciste puede haber llegado: reintenta y la mesa lo comprobará.";
    if (e.codigo === "oculto") return ERRORES.oculto;
    return ERRORES[e.codigo] || e.mensaje || "La mesa rechazó la petición.";
  }

  /* ---------------------------------------------------------------- modo solitario: tú contra el Dragón */
  // Los valores de origen del servidor (docs/pozo-dragon.sql, sección 12); la pantalla usa los que el servidor manda en cada partida
  const SOLO_BONOS = { pareja: 0.0625, escalera: 0.1875, triple: 0.375, triple_seis: 1 };
  const SOLO_TRIBUTO = 5;
  const premioSolo = (apuesta, tributo, bono) => Math.floor(Number(apuesta) * (1 - Number(tributo) / 100) * (1 + Number(bono)) * 100 + 1e-9) / 100;

  function reglasSolo(r) {
    r = r || {};
    const b = r.bonos || SOLO_BONOS, t = r.tributo != null ? r.tributo : SOLO_TRIBUTO, max = r.tiradas_max || 5;
    return [
      `Tú contra el Dragón. Apuestas una cantidad de tokens de juego, lanzas los tres dados y, después de cada tirada que no sea Ruina, decides si cobrar o seguir tirando.`,
      `Tu premio provisional empieza en tu apuesta menos el tributo del Dragón (${num(t)} %). Cada tirada sin Ruina le suma un bono, en % de tu apuesta antes del tributo: pareja +${num(b.pareja * 100)} %, escalera +${num(b.escalera * 100)} %, triple +${num(b.triple * 100)} % y triple seis +${num(b.triple_seis * 100)} %. La ceniza no cambia el premio.`,
      `Premio = apuesta × ${num(1 - t / 100)} × (1 + suma de bonos). El tributo del ${num(t)} % es lo único que retiene el Dragón y se ve antes de apostar: no hay otras comisiones.`,
      `Ruina (suma de 3 a 5): pierdes el premio provisional y la partida termina. Es una probabilidad de 10 entre 216 (4,63 %) en cada tirada.`,
      `Puedes cobrar después de cualquier tirada sin Ruina. Hay un máximo de ${max} tiradas: si llegas a la última sin Ruina, cobras automáticamente.`,
      `Aquí no hay otros jugadores y paga la casa: por eso el juego tiene una ventaja del Dragón. Jugando lo mejor posible recuperas de media un 97,5 % de lo apostado. Solo se apuesta dinero, no cartas.`,
      `Si recargas la página la partida sigue donde estaba. Si te vas y no vuelves, a los ${r.abandono_s || 120} segundos se cierra sola: sin tiradas se te devuelve la apuesta entera, y con tiradas cobras lo que lleves.`
    ];
  }

  // En solitario «continuar» es simplemente tirar otra vez
  function accionesSolo(s) {
    if (!s || s.estado !== "en_curso") return { tipo: "ninguna", botones: [] };
    if (s.fase === "decidir") {
      return { tipo: "decidir", botones: [
        { id: "cobrar", texto: "Cobrar", sub: `recibes ${num(s.premio)} tokens`, principal: true, tecla: "C" },
        { id: "tirar", texto: "Seguir tirando", sub: `${pct(10 / 216)} de Ruina y pierdes ${num(s.premio)}`, tecla: "T" }
      ] };
    }
    return { tipo: "tirar", botones: [{ id: "tirar", texto: "Tirar los dados", sub: "", principal: true, tecla: "T" }] };
  }

  // Lo que pasaría con cada resultado de la siguiente tirada, para decidir con la tabla delante
  function perspectivaSolo(s) {
    if (!s || s.estado !== "en_curso" || s.fase !== "decidir") return null;
    const b = s.bonos || SOLO_BONOS, t = s.tributo;
    const fila = (nombre, cat) => ({ nombre, premio: premioSolo(s.apuesta, t, Number(s.bono) + (b[cat] || 0)) });
    return { ahora: s.premio, riesgo: 10 / 216, filas: [fila("Ceniza", "ceniza"), fila("Pareja", "pareja"), fila("Escalera", "escalera"), fila("Triple", "triple"), fila("Triple seis", "triple_seis")], quedan: (s.tiradas_max - s.tiradas) };
  }

  function resumenSolo(s) {
    if (!s || s.estado !== "terminada") return null;
    const neto = Number(s.neto) || 0;
    if (s.resultado === "ruina") return { clase: "pierde", titulo: "Ruina: el Dragón se queda con tu apuesta", texto: `Pierdes ${num(s.apuesta)} tokens de juego.`, neto };
    if (s.resultado === "devuelta") return { clase: "empate", titulo: "Apuesta devuelta", texto: `La partida se cerró sin ninguna tirada. Recuperas tus ${num(s.apuesta)} tokens.`, neto: 0 };
    const auto = s.resultado === "cobro_automatico" ? "Se cerró sola por inactividad y se cobró lo que llevabas. " : (s.tiradas >= s.tiradas_max ? "Llegaste a la última tirada sin Ruina y cobras. " : "");
    const clase = neto > 0 ? "gana" : neto < 0 ? "pierde" : "empate";
    return { clase, titulo: neto > 0 ? "Cobras del pozo" : neto < 0 ? "Cobras menos de lo apostado" : "Recuperas tu apuesta", texto: `${auto}Recibes ${num(s.pago)} tokens (apostaste ${num(s.apuesta)}): ${neto > 0 ? "ganas" : neto < 0 ? "pierdes" : "quedas igual"} ${neto === 0 ? "" : num(Math.abs(neto)) + " tokens"}`.trim() + ".", neto };
  }

  function anuncioSolo(antes, s) {
    if (!s || s.sin_partida) return "";
    const p = [];
    const ultima = s.historial && s.historial.length ? s.historial[s.historial.length - 1] : null;
    const vistaAntes = antes && antes.historial ? antes.historial.length : 0;
    if (ultima && s.historial.length > vistaAntes) {
      p.push(`Sacas ${dadosTexto(ultima.dados)}: ${nombreCategoria(ultima.categoria)}.`);
      if (ultima.categoria !== "ruina" && s.estado === "en_curso") p.push(`Tu premio provisional es ${num(s.premio)} tokens. Cobra o sigue tirando.`);
    }
    if (s.estado === "terminada" && (!antes || antes.estado !== "terminada")) { const r = resumenSolo(s); if (r) p.push(`${r.titulo}. ${r.texto}`); }
    return p.join(" ");
  }

  const API = { SOLO_BONOS, SOLO_TRIBUTO, premioSolo, reglasSolo, accionesSolo, perspectivaSolo, resumenSolo, anuncioSolo, CATEGORIAS, ORDEN_MEJOR_A_PEOR, CASOS, clasificar, fuerza, comparar, nombreCategoria, num, pct, plural, textoApuesta, tipoApuesta, reglasDuelo, reglasCompartido, REGLAS_COMUNES,
    vista, jugadorYo, jugadorEn, rival, estadoJugador, estadoSala, acciones, dadosTexto, frasesTirada, resumenFinal, anuncio, mensajeError };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.PozoVista = API;
})(typeof window !== "undefined" ? window : globalThis);
