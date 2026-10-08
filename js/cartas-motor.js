/* =============================================================================
   CARTAS MALDITAS — motor del combate. Reglas puras, sin pantalla: el estado de
   una partida es un objeto JSON y cada acción lo cambia de forma determinista
   (el azar sale de una semilla guardada en el propio estado). Por eso en una
   partida entre dos jugadores basta con guardar la lista de acciones: cada
   navegador las repite en orden y llega al mismo resultado.

   Reglas:
   - 20 de vida. Mazo de 20 a 30 cartas. Se roban 5 al empezar (el segundo
     jugador roba 1 más).
   - La energía máxima sube 1 en cada turno propio, hasta 10, y se rellena.
   - Un turno: robas una carta, juegas cartas pagando su coste y atacas con tus
     unidades. Una unidad que entra no puede atacar hasta tu siguiente turno.
   - Atacar: eliges una unidad enemiga (las dos se hacen daño) o al jugador. Las
     unidades con Provocar deben ser atacadas antes que nada. Las unidades con
     Volar solo las pueden atacar otras unidades con Volar.
   - Máximo 6 unidades en tu campo y 8 cartas en la mano. Sin cartas en el mazo,
     cada robo hace daño creciente (fatiga).
   - Un terreno a la vez: jugar uno nuevo reemplaza al anterior.
   - Reacciones: cartas que se juegan en el turno del rival, como respuesta a un
     ataque contra una unidad suya o a una carta que él juega. Se pagan con la
     energía que te sobró. Si no tienes ninguna aplicable, no hay espera.

   Las habilidades de cada carta están en js/cartas-efectos.js. Una carta sin
   efecto registrado juega solo con sus números.
============================================================================= */
(function (raiz) {
  const C = { VIDA: 20, MANO_INICIAL: 5, MANO_MAX: 8, CAMPO_MAX: 6, ENERGIA_MAX: 10, MAZO_MIN: 20, MAZO_MAX: 30 };
  const TIPOS_UNIDAD = ["Personaje", "Criatura", "Entidad"];
  const TOPE_COPIAS = { comun: 3, infrecuente: 3, rara: 2, legendaria: 1, limitada: 1 };

  const TOKENS = {
    centinela: { id: "centinela", nombre: "Centinela", tipo: "Criatura", rareza: "comun", afinidad: ["eternidad"], coste: 0, atq: 1, pv: 1, habilidad: "", token: true }
  };

  const EFECTOS = {};
  const TERRENOS = {};

  /* --- Azar con semilla (mulberry32) ------------------------------------- */
  function rnd(est) {
    est.rng = (est.rng + 0x6D2B79F5) >>> 0;
    let t = est.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entero = (est, n) => Math.floor(rnd(est) * n);
  function barajar(est, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = entero(est, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* --- Acceso a cartas y unidades ---------------------------------------- */
  const meta = (est, id) => est.cartas[id] || TOKENS[id] || { id, nombre: id, tipo: "Objeto", afinidad: [], coste: 0, atq: null, pv: null, habilidad: "" };
  const efectoDe = (est, idOUnidad) => EFECTOS[typeof idOUnidad === "string" ? idOUnidad : idOUnidad.cartaId] || {};
  const nombre = (est, u) => meta(est, u.cartaId).nombre;
  const esUnidad = m => TIPOS_UNIDAD.includes(m.tipo);

  function log(est, texto) {
    est.log.push(texto);
    if (est.log.length > 300) est.log.splice(0, est.log.length - 300);
  }

  function buscar(est, uid) {
    for (let j = 0; j < 2; j++) {
      const u = est.jugadores[j].campo.find(x => x.uid === uid);
      if (u) return { u, j };
    }
    return null;
  }
  const todas = est => est.jugadores.flatMap(J => J.campo);

  function terrenoActivo(est, id) { return !!est.terreno && est.terreno.cartaId === id; }
  const defTerreno = est => (est.terreno ? TERRENOS[est.terreno.cartaId] || null : null);

  /* --- Estadísticas ------------------------------------------------------- */
  function modsActivos(est, u) { return u.mods.filter(m => est.turno <= m.hasta); }

  function atqEfectivo(est, u) {
    let a = u.atq;
    modsActivos(est, u).forEach(m => { a += m.atq; });
    const ef = efectoDe(est, u);
    if (ef.pasivaAtq) a += ef.pasivaAtq(est, u) || 0;
    est.jugadores[u.dueno].campo.forEach(o => {
      if (o.uid === u.uid) return;
      const eo = efectoDe(est, o);
      if (eo.auraAtq) a += eo.auraAtq(est, o, u) || 0;
    });
    const J = est.jugadores[u.dueno];
    if (J.malus && est.turno <= J.malus.hasta) a += J.malus.atq;
    return Math.max(0, a);
  }

  function tienePalabra(est, u, palabra) {
    const ef = efectoDe(est, u);
    if (!(ef.palabras || []).includes(palabra)) return false;
    if (palabra === "provocar" && u.flags.sinProvocar >= est.turno) return false;
    if (palabra === "volar" && u.flags.sinVolar >= est.turno) return false;
    return true;
  }

  function costeDe(est, jIdx, id) {
    const m = meta(est, id);
    let c = m.coste || 0;
    c -= est.jugadores[jIdx].costeMenos || 0;
    const T = defTerreno(est);
    if (T && T.costeMod) c += T.costeMod(est, jIdx, m) || 0;
    return Math.max(0, c);
  }

  /* --- Creación de unidades ---------------------------------------------- */
  function nuevaUnidad(est, jIdx, cartaId) {
    const m = meta(est, cartaId);
    const atq = Number.isFinite(m.atq) ? m.atq : 0;
    const pv = Number.isFinite(m.pv) && m.pv > 0 ? m.pv : 1;
    const u = {
      uid: est.siguienteUid++, cartaId, dueno: jIdx, atq, pv, pvMax: pv, atqBase: atq, pvBase: pv,
      entro: est.turno, ataques: 0, equipo: [], mods: [],
      flags: { noAtacaHasta: 0, intocableHasta: 0, sinProvocar: 0, sinVolar: 0, marcadaPor: null, guardiaTurno: 0, danada: false, inmune: false }
    };
    const ef = EFECTOS[cartaId];
    if (ef && ef.alCrear) ef.alCrear(est, u);
    return u;
  }

  function ponerUnidad(est, jIdx, cartaId, conEntrada, objetivo) {
    const J = est.jugadores[jIdx];
    const u = nuevaUnidad(est, jIdx, cartaId);
    J.campo.push(u);
    log(est, `${J.nombre} juega a ${nombre(est, u)}.`);
    const T = defTerreno(est);
    if (T && T.alEntrarUnidad) T.alEntrarUnidad(est, u);
    J.campo.forEach(o => {
      if (o.uid === u.uid) return;
      const eo = efectoDe(est, o);
      if (eo.alEntrarAliada) eo.alEntrarAliada({ est, M, u: o, j: jIdx, otra: u });
    });
    if (conEntrada && !terrenoActivo(est, "torre-del-silencio")) {
      const ef = efectoDe(est, u);
      if (ef.alEntrar) {
        if (ef.alEntrar.objetivo && !objetivo) log(est, `La habilidad de ${nombre(est, u)} no encuentra objetivo.`);
        else ef.alEntrar.resolver({ est, M, u, j: jIdx, objetivo });
      }
    } else if (conEntrada && efectoDe(est, u).alEntrar) {
      log(est, `El silencio de la Torre apaga la habilidad de ${nombre(est, u)}.`);
    }
    return u;
  }

  /* --- Robar -------------------------------------------------------------- */
  function robar(est, jIdx, n = 1) {
    const J = est.jugadores[jIdx];
    for (let i = 0; i < n; i++) {
      if (!J.mazo.length) {
        J.fatiga += 1;
        log(est, `${J.nombre} no tiene cartas: fatiga, recibe ${J.fatiga} de daño.`);
        infligir(est, { j: jIdx }, J.fatiga, { tipo: "fatiga" });
        continue;
      }
      const carta = J.mazo.shift();
      if (J.mano.length >= C.MANO_MAX) {
        J.descartes.push(carta);
        log(est, `${J.nombre} tiene la mano llena: ${meta(est, carta).nombre} se pierde.`);
      } else {
        J.mano.push(carta);
      }
    }
  }

  /* --- Daño y curación ---------------------------------------------------- */
  function revisarFinal(est) {
    if (est.ganador !== null) return;
    const [a, b] = est.jugadores;
    if (a.vida <= 0 && b.vida <= 0) { est.ganador = "empate"; est.motivo = "vida"; }
    else if (a.vida <= 0) { est.ganador = 1; est.motivo = "vida"; }
    else if (b.vida <= 0) { est.ganador = 0; est.motivo = "vida"; }
    if (est.ganador !== null) log(est, est.ganador === "empate" ? "La partida termina en empate." : `${est.jugadores[est.ganador].nombre} gana la partida.`);
  }

  function morir(est, u, fuente) {
    const J = est.jugadores[u.dueno];
    const i = J.campo.findIndex(x => x.uid === u.uid);
    if (i < 0) return;
    J.campo.splice(i, 1);
    J.cementerio.push(u.cartaId);
    log(est, `${nombre(est, u)} cae.`);
    const ef = efectoDe(est, u);
    if (ef.alMorir) ef.alMorir({ est, M, u, j: u.dueno });
    const T = defTerreno(est);
    if (T && T.alMorirUnidad) T.alMorirUnidad(est, u);
    if (fuente && fuente.uid) {
      const ata = buscar(est, fuente.uid);
      if (ata) {
        const ea = efectoDe(est, ata.u);
        if (ea.alMatar) ea.alMatar({ est, M, u: ata.u, j: ata.j, muerta: u });
      }
    }
    revisarFinal(est);
  }

  /* objetivo: { j: idx } o { u: uid }. fuente: { tipo: 'combate'|'habilidad'|'terreno'|'fatiga', uid? } */
  function infligir(est, objetivo, cantidad, fuente) {
    if (est.ganador !== null || cantidad <= 0) return 0;
    if (objetivo.j !== undefined) {
      const J = est.jugadores[objetivo.j];
      J.vida -= cantidad;
      log(est, `${J.nombre} recibe ${cantidad} de daño (${Math.max(0, J.vida)} de vida).`);
      revisarFinal(est);
      return cantidad;
    }
    let hit = buscar(est, objetivo.u);
    if (!hit) return 0;
    let u = hit.u;
    // Guardián: otra unidad aliada recibe el golpe en su lugar (una vez por turno)
    const ownerJ = est.jugadores[u.dueno];
    const guardian = ownerJ.campo.find(g => g.uid !== u.uid && efectoDe(est, g).guardian && g.flags.guardiaTurno !== est.turno);
    if (guardian) {
      guardian.flags.guardiaTurno = est.turno;
      log(est, `${nombre(est, guardian)} se interpone y recibe el golpe de ${nombre(est, u)}.`);
      u = guardian;
    }
    let n = cantidad;
    const ef = efectoDe(est, u);
    if (ef.reduceDano) n -= ef.reduceDano(est, u, n, fuente) || 0;
    n = Math.max(0, n);
    if (fuente && fuente.tipo === "habilidad" && terrenoActivo(est, "catedral-del-juramento")) n = Math.max(0, Math.min(n, u.pv - 1));
    if (n <= 0) { log(est, `${nombre(est, u)} no recibe daño.`); return 0; }
    u.pv -= n;
    u.flags.danada = true;
    log(est, `${nombre(est, u)} recibe ${n} de daño.`);
    if (u.pv > 0) {
      if (ef.alRecibirDano) ef.alRecibirDano({ est, M, u, j: u.dueno, cantidad: n });
    } else {
      morir(est, u, fuente);
    }
    return n;
  }

  function curar(est, objetivo, cantidad) {
    if (est.ganador !== null || cantidad <= 0) return 0;
    if (terrenoActivo(est, "desierto-de-cenizas")) { log(est, "La ceniza impide curar."); return 0; }
    if (objetivo.j !== undefined) {
      const J = est.jugadores[objetivo.j];
      const antes = J.vida;
      J.vida = Math.min(C.VIDA, J.vida + cantidad);
      if (J.vida > antes) log(est, `${J.nombre} recupera ${J.vida - antes} de vida.`);
      return J.vida - antes;
    }
    const hit = buscar(est, objetivo.u);
    if (!hit) return 0;
    const u = hit.u;
    const antes = u.pv;
    u.pv = Math.min(u.pvMax, u.pv + cantidad);
    if (u.pv > antes) log(est, `${nombre(est, u)} recupera ${u.pv - antes} de vida.`);
    return u.pv - antes;
  }

  /* Bonificación temporal de ataque y vida hasta el final del turno `hasta` */
  function mod(est, u, atq, pv, hasta) {
    u.mods.push({ atq, pv, hasta });
    u.pvMax += pv;
    u.pv += pv;
    log(est, `${nombre(est, u)} gana ${atq >= 0 ? "+" : ""}${atq}/${pv >= 0 ? "+" : ""}${pv} este turno.`);
  }

  /* --- Objetivos ---------------------------------------------------------- */
  /* ¿Puede una habilidad (de unidad) apuntar a esta unidad? */
  function puedeApuntarHabilidad(est, t, desdeDueno) {
    if (terrenoActivo(est, "vado-ceniza")) return false;
    if (t.flags.inmune && t.dueno !== desdeDueno) return false;
    return true;
  }

  function validosParaObjetivo(est, jIdx, tipo, habilidad, excluirUid) {
    const yo = est.jugadores[jIdx], el = est.jugadores[1 - jIdx];
    const ok = t => (!habilidad || puedeApuntarHabilidad(est, t, jIdx)) && t.uid !== excluirUid;
    if (tipo === "unidadEnemiga") return el.campo.filter(ok).map(t => ({ u: t.uid }));
    if (tipo === "unidadAliada" || tipo === "unidadAliadaOtra") return yo.campo.filter(ok).map(t => ({ u: t.uid }));
    if (tipo === "jugadorOUnidadAliada") return [{ j: jIdx }, ...yo.campo.filter(ok).map(t => ({ u: t.uid }))];
    return [];
  }

  /* Qué hay que elegir al jugar esta carta: { tipo, habilidad, opcional, validos } o null */
  function requisitoDeJugada(est, jIdx, cartaId) {
    const m = meta(est, cartaId);
    const ef = EFECTOS[cartaId] || {};
    const spec = esUnidad(m) ? ef.alEntrar : ef.jugar;
    if (!spec || !spec.objetivo) return null;
    const esU = esUnidad(m);
    return {
      tipo: spec.objetivo,
      habilidad: esU,
      opcional: esU,
      validos: validosParaObjetivo(est, jIdx, spec.objetivo, esU, null)
    };
  }

  /* Objetivos que puede atacar una unidad: { unidades: [uid], jugador: bool } */
  function objetivosDeAtaque(est, uid) {
    const hit = buscar(est, uid);
    if (!hit) return { unidades: [], jugador: false };
    const { u, j } = hit;
    const enemigas = est.jugadores[1 - j].campo;
    const ignoraProvocar = terrenoActivo(est, "puente-de-las-legiones") && est.terreno.dueno === j;
    const vuela = tienePalabra(est, u, "volar");
    const T = est.terreno;
    const atacable = t => {
      if (t.flags.intocableHasta >= est.turno) return false;
      const ef = efectoDe(est, t);
      if (ef.noAtacable && ef.noAtacable(est, t)) return false;
      if (T && T.cartaId === "los-huesos" && t.dueno === T.dueno && (meta(est, t.cartaId).afinidad || []).includes("sombra")) return false;
      if (tienePalabra(est, t, "volar") && !vuela) return false;
      return true;
    };
    const validas = enemigas.filter(atacable);
    const provocadoras = validas.filter(t => tienePalabra(est, t, "provocar"));
    let permitidas = validas;
    if (!ignoraProvocar && provocadoras.length) {
      permitidas = validas.filter(t => tienePalabra(est, t, "provocar") || t.flags.marcadaPor === j);
    }
    return { unidades: permitidas.map(t => t.uid), jugador: ignoraProvocar || provocadoras.length === 0 };
  }

  function ataquesMax(est, u) { return efectoDe(est, u).ataquesMax || 1; }

  function unidadPuedeAtacar(est, u) {
    if (est.ganador !== null || est.activo !== u.dueno) return false;
    if (u.entro === est.turno) return false;
    if (u.flags.noAtacaHasta >= est.turno) return false;
    if (u.ataques >= ataquesMax(est, u)) return false;
    return atqEfectivo(est, u) > 0;
  }

  /* --- Turnos -------------------------------------------------------------- */
  function iniciarTurno(est) {
    est.turno += 1;
    const jIdx = est.activo;
    const J = est.jugadores[jIdx];
    J.energiaMax = Math.min(C.ENERGIA_MAX, J.energiaMax + 1);
    J.energia = J.energiaMax;
    J.costeMenos = 0;
    J.campo.forEach(u => { u.ataques = 0; u.flags.danada = false; });
    est.jugadores[1 - jIdx].campo.forEach(u => { u.flags.danada = false; });
    log(est, `— Turno ${est.turno}: ${J.nombre} —`);
    if (!(est.turno === 1)) robar(est, jIdx, 1);
    if (est.ganador !== null) return;
    const T = defTerreno(est);
    if (T && T.inicioTurno) T.inicioTurno(est, jIdx);
    J.campo.slice().forEach(u => {
      const ef = efectoDe(est, u);
      if (ef.alInicioTurno && buscar(est, u.uid)) ef.alInicioTurno({ est, M, u, j: jIdx });
    });
  }

  function finalizarTurno(est) {
    const J = est.jugadores[est.activo];
    J.costeMenos = 0;
    const T = defTerreno(est);
    if (T && T.finTurno) T.finTurno(est);
    // Se acaban las bonificaciones temporales de este turno
    todas(est).forEach(u => {
      const vencen = u.mods.filter(m => m.hasta <= est.turno);
      if (!vencen.length) return;
      vencen.forEach(m => { u.pvMax -= m.pv; u.pv = Math.max(1, Math.min(u.pv, u.pvMax)); });
      u.mods = u.mods.filter(m => m.hasta > est.turno);
    });
    if (est.terreno && est.terreno.restantes !== null) {
      est.terreno.restantes -= 1;
      if (est.terreno.restantes <= 0) {
        log(est, `${meta(est, est.terreno.cartaId).nombre} se desvanece.`);
        est.terreno = null;
      }
    }
    est.activo = 1 - est.activo;
    iniciarTurno(est);
  }

  /* --- Acciones ------------------------------------------------------------ */
  const igual = (a, b) => (a === undefined || b === undefined ? a === b : (a.u !== undefined ? a.u === b.u : a.j === b.j));

  /* --- Reacciones ------------------------------------------------------------
     Una reacción es una carta que se juega en el turno del rival, como respuesta a
     lo que hace. Cuando el jugador activo ataca o juega una carta, si el rival tiene
     en la mano una reacción que pueda pagar y que encaje, la acción queda
     "pendiente": el rival puede reaccionar o dejarla pasar, y después se resuelve.
     Si no tiene ninguna, la acción se resuelve al instante (no hay espera).
     evento: { tipo: 'ataque', actor, uid (del atacante), objetivo } | { tipo: 'jugar', actor, carta } */
  function reaccionesPosibles(est, reactor, evento) {
    const J = est.jugadores[reactor];
    const lista = [];
    J.mano.forEach((id, i) => {
      const m = meta(est, id);
      if (m.tipo !== "Reacción") return;
      const ef = EFECTOS[id];
      if (!ef || !ef.reaccion || ef.reaccion.cuando !== evento.tipo) return;
      if (costeDe(est, reactor, id) > J.energia) return;
      if (ef.reaccion.puede && !ef.reaccion.puede({ est, M, j: reactor, evento })) return;
      lista.push(i);
    });
    return lista;
  }

  function abrirVentana(est, evento, datos) {
    const reactor = 1 - evento.actor;
    if (!reaccionesPosibles(est, reactor, evento).length) return false;
    est.pendienteN += 1;
    est.pendiente = { id: est.pendienteN, tipo: evento.tipo, actor: evento.actor, reactor, datos, evento, cancelado: false };
    return true;
  }

  /* Quién tiene que actuar ahora: el rival si hay una reacción en el aire, si no el jugador activo */
  const quienActua = est => (est.pendiente ? est.pendiente.reactor : est.activo);

  function jugarReaccion(est, jIdx, i, objetivoRaw) {
    const p = est.pendiente;
    if (jIdx !== p.reactor) return { error: "No te toca reaccionar." };
    if (!reaccionesPosibles(est, jIdx, p.evento).includes(i)) return { error: "Esa carta no se puede jugar como reacción ahora." };
    const J = est.jugadores[jIdx];
    const id = J.mano[i];
    const ef = EFECTOS[id];
    J.energia -= costeDe(est, jIdx, id);
    J.mano.splice(i, 1);
    log(est, `${J.nombre} reacciona con ${meta(est, id).nombre}.`);
    ef.reaccion.resolver({ est, M, j: jIdx, pendiente: p, objetivo: objetivoRaw || null });
    J.cementerio.push(id);
    return resolverPendiente(est);
  }

  function resolverPendiente(est) {
    const p = est.pendiente;
    est.pendiente = null;
    if (p.tipo === "jugar") {
      const { id, objetivo } = p.datos;
      if (p.cancelado) {
        est.jugadores[p.actor].cementerio.push(id);
        log(est, `${meta(est, id).nombre} queda cancelada.`);
      } else {
        resolverJugada(est, p.actor, id, objetivo);
      }
    } else if (p.tipo === "ataque") {
      ejecutarAtaque(est, p.actor, p.datos.uid, p.datos.objetivo, p.cancelado);
    }
    revisarFinal(est);
    return { ok: true };
  }

  /* --- Jugar una carta ------------------------------------------------------- */
  function jugarCarta(est, jIdx, i, objetivoRaw) {
    const J = est.jugadores[jIdx];
    if (i === undefined || i < 0 || i >= J.mano.length) return { error: "Esa carta no está en tu mano." };
    const id = J.mano[i];
    const m = meta(est, id);
    const coste = costeDe(est, jIdx, id);
    if (coste > J.energia) return { error: "No tienes energía suficiente." };
    if (m.tipo === "Reacción") return { error: "Una reacción solo se juega como respuesta en el turno del rival." };
    if (esUnidad(m) && J.campo.length >= C.CAMPO_MAX) return { error: "Tu campo está lleno." };
    const req = requisitoDeJugada(est, jIdx, id);
    if (req) {
      if (objetivoRaw) {
        if (!req.validos.some(v => igual(v, objetivoRaw))) return { error: "Ese objetivo no es válido." };
      } else if (!req.opcional) {
        return { error: "Elige un objetivo." };
      } else if (req.validos.length) {
        return { error: "Elige un objetivo." };
      }
    }
    J.energia -= coste;
    J.mano.splice(i, 1);
    const objetivo = req && objetivoRaw ? objetivoRaw : null;
    if (abrirVentana(est, { tipo: "jugar", actor: jIdx, carta: id }, { id, objetivo })) return { ok: true, pendiente: true };
    resolverJugada(est, jIdx, id, objetivo);
    revisarFinal(est);
    return { ok: true };
  }

  /* Aplica el efecto de una carta ya pagada. objetivoRaw: { u } | { j } | null (puede haber desaparecido). */
  function resolverJugada(est, jIdx, id, objetivoRaw) {
    const J = est.jugadores[jIdx];
    const m = meta(est, id);
    let objetivo = null;
    if (objetivoRaw) {
      if (objetivoRaw.u !== undefined) { const hit = buscar(est, objetivoRaw.u); objetivo = hit ? hit.u : null; }
      else objetivo = objetivoRaw;
    }
    if (esUnidad(m)) {
      if (J.campo.length >= C.CAMPO_MAX) { J.cementerio.push(id); log(est, `No hay sitio para ${m.nombre}.`); return; }
      ponerUnidad(est, jIdx, id, true, objetivo);
    } else if (m.tipo === "Terreno") {
      const T = TERRENOS[id] || {};
      est.terreno = { cartaId: id, dueno: jIdx, restantes: T.duracion || null, turnoEntrada: 0 };
      log(est, `${J.nombre} juega el terreno ${m.nombre}.`);
    } else {
      log(est, `${J.nombre} juega ${m.nombre}.`);
      const ef = EFECTOS[id];
      if (ef && ef.jugar) {
        if (ef.jugar.objetivo && !objetivo) log(est, "El objetivo ya no está.");
        else ef.jugar.resolver({ est, M, j: jIdx, objetivo });
      }
      J.cementerio.push(id);
    }
  }

  /* --- Atacar ---------------------------------------------------------------- */
  function atacar(est, jIdx, uid, objetivoRaw) {
    const hit = buscar(est, uid);
    if (!hit || hit.j !== jIdx) return { error: "Esa unidad no es tuya." };
    const u = hit.u;
    if (u.entro === est.turno) return { error: "Esa unidad acaba de entrar." };
    if (u.flags.noAtacaHasta >= est.turno) return { error: "Esa unidad no puede atacar este turno." };
    if (u.ataques >= ataquesMax(est, u)) return { error: "Esa unidad ya atacó." };
    if (atqEfectivo(est, u) <= 0) return { error: "Esa unidad no tiene ataque." };
    const validos = objetivosDeAtaque(est, uid);
    let objetivo;
    if (objetivoRaw && objetivoRaw.j !== undefined) {
      if (objetivoRaw.j !== 1 - jIdx || !validos.jugador) return { error: "No puedes atacar al jugador ahora." };
      objetivo = { j: objetivoRaw.j };
    } else if (objetivoRaw && objetivoRaw.u !== undefined) {
      if (!validos.unidades.includes(objetivoRaw.u)) return { error: "No puedes atacar a esa unidad." };
      objetivo = { u: objetivoRaw.u };
    } else {
      return { error: "Elige a quién atacar." };
    }
    u.ataques += 1;
    const ev = { tipo: "ataque", actor: jIdx, uid, objetivo };
    if (abrirVentana(est, ev, { uid, objetivo })) return { ok: true, pendiente: true };
    ejecutarAtaque(est, jIdx, uid, objetivo, false);
    revisarFinal(est);
    return { ok: true };
  }

  function ejecutarAtaque(est, jIdx, uid, objetivo, cancelado) {
    const hit = buscar(est, uid);
    if (!hit) return;
    const u = hit.u;
    const tUnidad = objetivo.u !== undefined ? (buscar(est, objetivo.u) || {}).u || null : null;
    if (objetivo.u !== undefined && !tUnidad) { log(est, `${nombre(est, u)} ataca, pero su objetivo ya no está.`); return; }
    log(est, tUnidad ? `${nombre(est, u)} ataca a ${nombre(est, tUnidad)}.` : `${nombre(est, u)} ataca a ${est.jugadores[1 - jIdx].nombre}.`);
    if (cancelado) { log(est, "El ataque se cancela."); return; }
    const ef = efectoDe(est, u);
    let ataque = atqEfectivo(est, u);
    if (tUnidad) {
      if (ef.bonusAtaque) ataque += ef.bonusAtaque(est, u, tUnidad) || 0;
      if (tUnidad.flags.marcadaPor === jIdx) ataque += 2;
    }
    const contra = tUnidad ? atqEfectivo(est, tUnidad) : 0;
    infligir(est, objetivo, ataque, { tipo: "combate", uid: u.uid });
    if (tUnidad && contra > 0 && buscar(est, u.uid)) infligir(est, { u: u.uid }, contra, { tipo: "combate", uid: tUnidad.uid });
  }

  /* Quién envió una acción ya guardada (para repetir una partida desde cero). */
  function emisorDe(est, accion) {
    if (est.pendiente && accion && (accion.t === "reaccionar" || (accion.t === "pasar" && !accion.forzar))) return est.pendiente.reactor;
    return est.activo;
  }
  const reproducir = (est, accion) => aplicar(est, accion, emisorDe(est, accion));

  /* Aplica una acción de un jugador.
       { t:'jugar', i, o? } | { t:'atacar', u, o } | { t:'fin' }
       { t:'reaccionar', i } | { t:'pasar', forzar? }  (mientras hay una acción pendiente) */
  function aplicar(est, accion, jIdx) {
    if (est.ganador !== null) return { error: "La partida ya terminó." };
    if (!accion || typeof accion !== "object") return { error: "Acción inválida." };
    const p = est.pendiente;
    if (p) {
      if (accion.t === "reaccionar") return jugarReaccion(est, jIdx, accion.i, accion.o);
      if (accion.t === "pasar") {
        // El rival deja pasar. El jugador activo solo puede seguir sin esperar si pasó el tiempo (lo comprueba el servidor).
        if (jIdx === p.reactor || (accion.forzar && jIdx === p.actor)) return resolverPendiente(est);
        return { error: "No te toca reaccionar." };
      }
      return { error: "Espera la respuesta del rival." };
    }
    if (accion.t === "pasar") return { ok: true }; // sobra: la reacción ya se resolvió
    if (accion.t === "reaccionar") return { error: "No hay nada a lo que reaccionar." };
    if (jIdx !== est.activo) return { error: "No es tu turno." };
    if (accion.t === "jugar") return jugarCarta(est, jIdx, accion.i, accion.o);
    if (accion.t === "atacar") return atacar(est, jIdx, accion.u, accion.o);
    if (accion.t === "fin") { finalizarTurno(est); return { ok: true }; }
    return { error: "Acción desconocida." };
  }

  /* Todas las acciones posibles de quien tiene que actuar (para la interfaz y para las pruebas) */
  function accionesLegales(est) {
    if (est.ganador !== null) return [];
    if (est.pendiente) {
      const p = est.pendiente;
      return [...reaccionesPosibles(est, p.reactor, p.evento).map(i => ({ t: "reaccionar", i })), { t: "pasar" }];
    }
    const jIdx = est.activo, J = est.jugadores[jIdx], out = [];
    J.mano.forEach((id, i) => {
      const m = meta(est, id);
      if (costeDe(est, jIdx, id) > J.energia || m.tipo === "Reacción") return;
      if (esUnidad(m) && J.campo.length >= C.CAMPO_MAX) return;
      const req = requisitoDeJugada(est, jIdx, id);
      if (!req) out.push({ t: "jugar", i });
      else if (req.validos.length) req.validos.forEach(v => out.push({ t: "jugar", i, o: v }));
      else if (req.opcional) out.push({ t: "jugar", i });
    });
    J.campo.forEach(u => {
      if (!unidadPuedeAtacar(est, u)) return;
      const v = objetivosDeAtaque(est, u.uid);
      v.unidades.forEach(t => out.push({ t: "atacar", u: u.uid, o: { u: t } }));
      if (v.jugador) out.push({ t: "atacar", u: u.uid, o: { j: 1 - jIdx } });
    });
    out.push({ t: "fin" });
    return out;
  }

  /* --- Partida nueva --------------------------------------------------------- */
  /* jugadores: [{ id, nombre, mazo: [cartaId, ...] }, ...]. cartas: { id: datos de carta }. */
  function crearPartida({ semilla, jugadores, primero, cartas }) {
    const est = {
      v: 1, rng: semilla >>> 0, turno: 0, activo: primero, cartas: cartas || {},
      jugadores: jugadores.map(j => ({
        id: j.id, nombre: j.nombre, vida: C.VIDA, energia: 0, energiaMax: 0,
        mazo: j.mazo.slice(), mano: [], campo: [], cementerio: [], descartes: [], fatiga: 0, costeMenos: 0, malus: null
      })),
      terreno: null, siguienteUid: 1, ganador: null, motivo: "", log: [], pendiente: null, pendienteN: 0
    };
    est.jugadores.forEach(J => barajar(est, J.mazo));
    est.jugadores.forEach(J => robar(est, est.jugadores.indexOf(J), C.MANO_INICIAL));
    robar(est, 1 - primero, 1);
    iniciarTurno(est);
    return est;
  }

  /* --- Mazos ------------------------------------------------------------------ */
  /* cuenta: { cartaId: copias }. Devuelve una lista de problemas (vacía si el mazo vale). */
  function validarMazo(cuenta, cartas, posee) {
    const problemas = [];
    const total = Object.values(cuenta).reduce((s, n) => s + n, 0);
    if (total < C.MAZO_MIN) problemas.push(`Faltan ${C.MAZO_MIN - total} cartas (mínimo ${C.MAZO_MIN}).`);
    if (total > C.MAZO_MAX) problemas.push(`Sobran ${total - C.MAZO_MAX} cartas (máximo ${C.MAZO_MAX}).`);
    Object.entries(cuenta).forEach(([id, n]) => {
      const c = cartas[id];
      if (!c) { problemas.push(`La carta ${id} ya no existe.`); return; }
      const tope = TOPE_COPIAS[c.rareza] || 1;
      if (n > tope) problemas.push(`${c.nombre}: como máximo ${tope} copia${tope === 1 ? "" : "s"}.`);
      if (posee && n > (posee[id] || 0)) problemas.push(`${c.nombre}: solo tienes ${posee[id] || 0}.`);
    });
    return problemas;
  }

  const M = {
    C, TOPE_COPIAS, TOKENS, EFECTOS, TERRENOS,
    registrar: (id, def) => { EFECTOS[id] = def; },
    registrarTerreno: (id, def) => { TERRENOS[id] = def; },
    crearPartida, aplicar, reproducir, quienActua, reaccionesPosibles, accionesLegales, validarMazo,
    meta, efectoDe, nombre, esUnidad, buscar, todas, log, entero, rnd, barajar,
    infligir, curar, robar, mod, morir, ponerUnidad, nuevaUnidad,
    atqEfectivo, tienePalabra, costeDe, requisitoDeJugada, objetivosDeAtaque, unidadPuedeAtacar,
    puedeApuntarHabilidad, terrenoActivo, ataquesMax
  };

  raiz.CartasMotor = M;
  if (typeof module !== "undefined" && module.exports) module.exports = M;
})(typeof window !== "undefined" ? window : globalThis);
