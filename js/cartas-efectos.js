/* =============================================================================
   CARTAS MALDITAS — habilidades de cada carta, por id. Cada entrada le dice al
   motor (cartas-motor.js) qué hace la carta en cada momento:

     palabras        'desafiante' (al atacar elige qué unidad enemiga debe bloquearla),
                     'provocar' (los desafíos deben apuntar antes a una unidad con
                     Provocar), 'volar' (solo la bloquean unidades que vuelan), 'temible' (no la
                     bloquean unidades con menos de 3 de ataque), 'veloz' (en combate golpea
                     antes), 'arrollar' (el daño que sobra pasa al jugador), 'duro' (recibe 1
                     menos de daño), 'esquivo' (en combate recibe la mitad del daño, redondeado hacia
                     abajo), 'noBloquea' (no puede bloquear). Barrera no es una palabra
                     fija sino un estado: se da con u.flags.barrera = true (ver alCrear)
     pasivaAtq       ataque extra mientras está en juego
     auraAtq         ataque extra para las demás unidades aliadas
     bonusAtaque     daño extra en combate contra otra unidad (atacando o bloqueando)
     reduceDano      daño que se quita de cada golpe que recibe
     guardian        recibe en lugar de un aliado el daño (una vez por turno)
     alCrear         al crearse, sin importar silencios
     escurridizo     (est, u) => bool; si devuelve true, ni los desafíos ni las habilidades
                     enemigas pueden elegirla (también existe flags.escurridizoHasta)
     alEntrar        { objetivo?, resolver(c) } habilidad "al entrar"
     alEntrarAliada  cuando otra unidad aliada entra
     alRecibirDano   al recibir daño sin morir
     alMorir         al morir
     alMatar         al destruir a una unidad con un ataque
     alInicioTurno   al inicio del turno de su dueño
     jugar           { objetivo?, resolver(c) } para objetos y acciones
     alAtacarJugador cuando golpea al jugador rival (atacante sin bloquear, o arrollar)
     reaccion        { cuando: 'ataque'|'jugar', objetivo?: 'atacante', puede(c), resolver(c) }
                     para cartas de tipo Reacción. 'ataque' es la declaración de ataques, antes
                     de los bloqueos (c.evento.atacantes, c.est.combate); con objetivo: 'atacante'
                     se elige una unidad atacante (c.objetivo = { u }). c.pendiente.cancelado = true
                     cancela una carta que se iba a jugar

   Los terrenos se registran con registrarTerreno. Una carta que no aparece
   aquí (por ejemplo una creada desde el editor) juega solo con sus números.
============================================================================= */
(function (raiz) {
  function registrar(M) {
    const R = M.registrar, RT = M.registrarTerreno;
    const enemigas = (est, j) => est.jugadores[1 - j].campo;
    const aleatoria = (est, lista) => lista[M.entero(est, lista.length)];

    // --- Personajes ------------------------------------------------------
    R("rook", { pasivaAtq: (est, u) => (est.jugadores[u.dueno].campo.length === 1 ? 2 : 0) });
    R("bull", { palabras: ["provocar"] });
    // Garra: el arpón baja a las voladoras y quita el escudo a quien provoca; además desafía al atacar.
    R("garra", { palabras: ["desafiante"], alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.sinProvocarHasta = c.est.turno + 1;
      c.objetivo.flags.sinVolarHasta = c.est.turno + 1;
      M.log(c.est, `${M.nombre(c.est, c.u)} engancha a ${M.nombre(c.est, c.objetivo)}: pierde Provocar y Volar hasta el final del próximo turno de su dueño.`);
    } } });
    R("baraja", { alEntrar: { resolver: c => M.robar(c.est, c.j, 1) } });
    R("ocevat", { guardian: true });
    R("verdam", { palabras: ["desafiante"], alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.marcadaPor = c.j;
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} queda marcada.`);
    } } });
    R("eklino-a", { palabras: ["provocar"], alEntrarAliada: c => { c.otra.pv += 1; c.otra.pvMax += 1; } });
    R("dagren", { alRecibirDano: c => { c.u.atq += 1; } });
    R("orina", { alMorir: c => {
      const validos = enemigas(c.est, c.j).filter(t => M.puedeApuntarHabilidad(c.est, t, c.j));
      if (!validos.length) return;
      const t = validos.slice().sort((a, b) => M.atqEfectivo(c.est, b) - M.atqEfectivo(c.est, a) || b.pv - a.pv)[0];
      M.infligir(c.est, { u: t.uid }, 3, { tipo: "habilidad", dueno: c.j });
    } });
    R("edge", { bonusAtaque: (est, u, t) => (t && t.flags.danada ? 2 : 0) });
    R("hornet", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => M.infligir(c.est, { u: c.objetivo.uid }, 1, { tipo: "habilidad", dueno: c.j }) } });
    R("sir-buffolet", { alEntrar: { resolver: c => {
      c.est.jugadores.forEach(J => {
        if (!J.mano.length) return;
        const carta = J.mano.splice(M.entero(c.est, J.mano.length), 1)[0];
        J.descartes.push(carta);
        M.log(c.est, `${J.nombre} descarta ${M.meta(c.est, carta).nombre}.`);
      });
    } } });
    R("enzo", { palabras: ["veloz"] });
    // Escurridizo: ni desafíos ni habilidades enemigas pueden elegirlo (Mattei, solo el turno siguiente a entrar)
    R("mattei", { alCrear: (est, u) => { u.flags.escurridizoHasta = est.turno + 1; } });
    R("adam-kovacs", { auraAtq: () => 1 });
    R("cassius-coldgrave", { palabras: ["noBloquea"], escurridizo: (est, u) => est.jugadores[u.dueno].campo.length > 1 });
    R("torvrena", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.noAtacaHasta = c.est.turno + 1;
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} queda atrapada y no podrá atacar el próximo turno.`);
    } } });
    R("ryn", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => M.mod(c.est, c.objetivo, 2, 2, c.est.turno) } });
    R("hooey-magoo", { alMorir: c => M.robar(c.est, c.j, 1) });

    // --- Criaturas ---------------------------------------------------------
    R("kobold", { pasivaAtq: (est, u) => M.todas(est).filter(o => o.uid !== u.uid && o.cartaId === "kobold").length });
    R("manta-del-cielo", { palabras: ["volar"] });
    R("lobo", { bonusAtaque: (est, u, t) => (t && t.pv < t.pvMax ? 1 : 0) });
    R("cuervo-del-augurio", { alEntrar: { resolver: c => {
      const J = c.est.jugadores[c.j];
      M.log(c.est, `${J.nombre} mira la carta superior de su mazo.`);
      c.est.mirada = { j: c.j, carta: J.mazo[0] || null, turno: c.est.turno };
    } } });
    R("guiverno", { palabras: ["volar"], bonusAtaque: (est, u, t) => (t && !M.tienePalabra(est, t, "volar") ? 1 : 0) });
    R("hidra", { alInicioTurno: c => M.curar(c.est, { u: c.u.uid }, 2) });
    R("draco", { reduceDano: () => 2 });
    R("kraken", { palabras: ["arrollar"], alMatar: c => M.robar(c.est, c.j, 1) });
    R("el-bufon", { alEntrar: { resolver: c => { c.est.jugadores[c.j].costeMenos += 1; } } });

    // --- Personajes creados desde el editor (sus textos viven en el servidor) -----------------
    // Eledar, tarotista: lee el mazo; sus cartas, eso sí, no vieron venir el golpe.
    R("eledar", {
      alEntrar: { resolver: c => {
        const J = c.est.jugadores[c.j];
        const arriba = J.mazo.slice(0, 3);
        if (!arriba.length) return;
        let mejor = 0;
        arriba.forEach((id, i) => { if (M.meta(c.est, id).coste > M.meta(c.est, arriba[mejor]).coste) mejor = i; });
        const elegida = arriba[mejor];
        // La elegida va a la mano y las otras al fondo del mazo
        J.mazo.splice(0, arriba.length);
        arriba.forEach((id, i) => { if (i !== mejor) J.mazo.push(id); });
        J.mazo.unshift(elegida);
        M.log(c.est, `${J.nombre} lee las cartas de Eledar y elige ${M.meta(c.est, elegida).nombre}.`);
        c.est.mirada = { j: c.j, cartas: arriba, elegida, turno: c.est.turno };
        M.robar(c.est, c.j, 1);
      } },
      reduceDano: (est, u, n, fuente) => (fuente && fuente.tipo === "combate" ? -1 : 0)
    });
    // Laia, cambiante de familia de ladrones: toma la forma de otra unidad y tiene las manos largas.
    R("laia", {
      alEntrar: { objetivo: "unidad", resolver: c => {
        const t = c.objetivo;
        c.u.atq = M.atqEfectivo(c.est, t);
        c.u.pvMax = c.u.pv = t.pvMax;
        M.log(c.est, `${M.nombre(c.est, c.u)} toma la forma de ${M.nombre(c.est, t)} (${c.u.atq}/${c.u.pv}).`);
      } },
      alAtacarJugador: c => M.robar(c.est, c.j, 1)
    });
    // Ledros, la armadura poseída: las almas errantes levantan barro, piedra o madera. Al darle descanso, se van.
    const RESTOS = ["resto-barro", "resto-piedra", "resto-madera"];
    R("ledros", {
      alEntrar: { resolver: c => {
        if (c.est.jugadores[c.j].campo.length >= M.C.CAMPO_MAX) return;
        const cuerpo = RESTOS[M.entero(c.est, RESTOS.length)];
        M.log(c.est, "Las almas errantes de Ledros levantan un cuerpo.");
        M.ponerUnidad(c.est, c.j, cuerpo, false, null);
      } },
      alMorir: c => {
        const restos = c.est.jugadores[c.j].campo.filter(u => RESTOS.includes(u.cartaId));
        if (!restos.length) return;
        M.log(c.est, "Ledros descansa: las almas errantes lo siguen.");
        restos.forEach(u => { if (M.buscar(c.est, u.uid)) M.morir(c.est, u, { tipo: "habilidad" }); });
      }
    });
    R("resto-piedra", { reduceDano: () => 1 });

    // --- Objetos -------------------------------------------------------------
    R("pocion-de-curacion-menor", { jugar: { objetivo: "jugadorOUnidadAliada", resolver: c => M.curar(c.est, c.objetivo.uid !== undefined ? { u: c.objetivo.uid } : c.objetivo, 3) } });
    R("escudo-reforzado", { jugar: { objetivo: "unidadAliada", resolver: c => {
      c.objetivo.pvMax += 3; c.objetivo.pv += 3; c.objetivo.equipo.push("escudo-reforzado");
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se equipa con un escudo reforzado (+0/+3).`);
    } } });
    R("baraja-de-cartas", { jugar: { resolver: c => M.robar(c.est, c.j, 2) } });
    // Reacciones: se juegan en el turno del rival, como respuesta (ver el motor). Las de ataque se
    // juegan al declarar el rival sus atacantes, antes de elegir los bloqueos.
    R("bomba-de-humo", { reaccion: { cuando: "ataque", objetivo: "atacante", resolver: c => {
      const combate = c.est.combate;
      const hit = M.buscar(c.est, c.objetivo.u);
      if (!combate || !hit) return;
      combate.atacantes = combate.atacantes.filter(uid => uid !== c.objetivo.u);
      M.log(c.est, `El humo cubre a ${M.nombre(c.est, hit.u)}: se queda fuera del combate.`);
    } } });
    R("silbato-de-guardia", { reaccion: { cuando: "ataque", resolver: c => {
      M.log(c.est, "El silbato resuena: las unidades de la guardia se preparan.");
      c.est.jugadores[c.j].campo.slice().forEach(u => M.mod(c.est, u, 0, 2, c.est.turno));
    } } });
    R("llave-maestra-defectuosa", { reaccion: { cuando: "jugar",
      puede: c => ["Objeto", "Acción", "Terreno"].includes(M.meta(c.est, c.evento.carta).tipo),
      resolver: c => { c.pendiente.cancelado = true; M.log(c.est, "La llave atasca el mecanismo."); } } });
    R("cristal-de-mana", { jugar: { resolver: c => { c.est.jugadores[c.j].energia += 2; } } });
    R("capucha-oscura", { jugar: { objetivo: "unidadAliada", resolver: c => {
      c.objetivo.flags.inmune = true; c.objetivo.equipo.push("capucha-oscura");
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se pone la capucha: las habilidades enemigas no pueden apuntarle.`);
    } } });

    // --- Terrenos ------------------------------------------------------------
    // Los terrenos con duración (turnos) se quitan solos; los demás duran hasta que entra otro terreno.
    // Los efectos fijos (Puente, Huesos, Vado, Desierto, Catedral, Torre) los aplica el propio motor.
    RT("puente-de-las-legiones", { duracion: 2 });
    RT("los-huesos", { duracion: 3 });
    RT("glaciar-eterno", { duracion: 3, alEntrarUnidad: (est, u) => {
      if (est.terreno.turnoEntrada === est.turno) return;
      est.terreno.turnoEntrada = est.turno;
      u.flags.noAtacaHasta = Math.max(u.flags.noAtacaHasta, est.turno + 2);
      M.log(est, `El hielo atrapa a ${M.nombre(est, u)}: no atacará en su próximo turno.`);
    } });
    RT("vado-ceniza", { duracion: 3 });
    RT("desierto-de-cenizas", { duracion: 3 });
    RT("catedral-del-juramento", { duracion: 3 });
    RT("torre-del-silencio", { duracion: 3 });
    RT("el-crater", {
      costeMod: (est, jIdx, m) => (jIdx === est.terreno.dueno && (m.afinidad || []).includes("arcano") ? -1 : 0),
      inicioTurno: (est, jIdx) => {
        if (jIdx !== est.terreno.dueno) return;
        const arcanas = M.todas(est).filter(u => (M.meta(est, u.cartaId).afinidad || []).includes("arcano"));
        if (!arcanas.length) return;
        M.infligir(est, { u: aleatoria(est, arcanas).uid }, 1, { tipo: "habilidad", dueno: jIdx });
      }
    });
    RT("kigan", { inicioTurno: (est, jIdx) => {
      if (jIdx === est.terreno.dueno && est.jugadores[jIdx].campo.length >= 2) M.robar(est, jIdx, 1);
    } });
    RT("la-espesura", { inicioTurno: (est) => {
      const unidades = M.todas(est);
      if (!unidades.length) return;
      const u = aleatoria(est, unidades);
      u.flags.noAtacaHasta = Math.max(u.flags.noAtacaHasta, est.turno);
      M.log(est, `La presencia de La Espesura paraliza a ${M.nombre(est, u)} este turno.`);
    } });
    RT("osario-de-la-frontera", { alMorirUnidad: (est, u) => {
      if (u.dueno !== est.terreno.dueno || u.cartaId === "centinela") return;
      if (est.jugadores[u.dueno].campo.length >= M.C.CAMPO_MAX) return;
      M.ponerUnidad(est, u.dueno, "centinela", false, null);
    } });
    RT("cueva-de-carne", { finTurno: (est) => {
      M.todas(est).slice().forEach(u => {
        if (!M.buscar(est, u.uid)) return;
        if ((M.meta(est, u.cartaId).afinidad || []).includes("carne")) M.curar(est, { u: u.uid }, 1);
        else M.infligir(est, { u: u.uid }, 1, { tipo: "terreno" });
      });
    } });
  }

  if (raiz.CartasMotor) registrar(raiz.CartasMotor);
  else raiz.__registrarEfectosCartas = registrar;
  if (typeof module !== "undefined" && module.exports) module.exports = registrar;
})(typeof window !== "undefined" ? window : globalThis);
