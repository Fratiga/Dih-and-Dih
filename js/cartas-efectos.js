/* =============================================================================
   CARTAS MALDITAS — habilidades de cada carta, por id. Cada entrada le dice al
   motor (cartas-motor.js) qué hace la carta en cada momento:

     palabras        'provocar' (hay que atacarla primero), 'volar' (solo la atacan
                     unidades que también vuelan)
     pasivaAtq       ataque extra mientras está en juego
     auraAtq         ataque extra para las demás unidades aliadas
     bonusAtaque     daño extra al atacar a una unidad
     reduceDano      daño que se quita de cada golpe que recibe
     ataquesMax      ataques por turno
     noAtacable      si devuelve true, no se le puede atacar
     guardian        recibe en lugar de un aliado el daño (una vez por turno)
     alCrear         al crearse, sin importar silencios
     alEntrar        { objetivo?, resolver(c) } habilidad "al entrar"
     alEntrarAliada  cuando otra unidad aliada entra
     alRecibirDano   al recibir daño sin morir
     alMorir         al morir
     alMatar         al destruir a una unidad con un ataque
     alInicioTurno   al inicio del turno de su dueño
     jugar           { objetivo?, resolver(c) } para objetos y acciones
     reaccion        { cuando: 'ataque'|'jugar', puede(c), resolver(c) } para cartas de tipo
                     Reacción (c.pendiente.cancelado = true cancela lo que iba a pasar)

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
    R("garra", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.sinProvocar = c.est.turno;
      c.objetivo.flags.sinVolar = c.est.turno;
      M.log(c.est, `${M.nombre(c.est, c.u)} arrastra a ${M.nombre(c.est, c.objetivo)}: pierde Provocar y Volar este turno.`);
    } } });
    R("baraja", { alEntrar: { resolver: c => M.robar(c.est, c.j, 1) } });
    R("ocevat", { guardian: true });
    R("verdam", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
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
    R("enzo", { ataquesMax: 2 });
    R("mattei", { alCrear: (est, u) => { u.flags.intocableHasta = est.turno + 1; } });
    R("adam-kovacs", { auraAtq: () => 1 });
    R("cassius-coldgrave", { noAtacable: (est, u) => est.jugadores[u.dueno].campo.length > 1 });
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
    R("kraken", { alMatar: c => M.robar(c.est, c.j, 1) });
    R("el-bufon", { alEntrar: { resolver: c => { c.est.jugadores[c.j].costeMenos += 1; } } });

    // --- Objetos -------------------------------------------------------------
    R("pocion-de-curacion-menor", { jugar: { objetivo: "jugadorOUnidadAliada", resolver: c => M.curar(c.est, c.objetivo.uid !== undefined ? { u: c.objetivo.uid } : c.objetivo, 3) } });
    R("escudo-reforzado", { jugar: { objetivo: "unidadAliada", resolver: c => {
      c.objetivo.pvMax += 3; c.objetivo.pv += 3; c.objetivo.equipo.push("escudo-reforzado");
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se equipa con un escudo reforzado (+0/+3).`);
    } } });
    R("baraja-de-cartas", { jugar: { resolver: c => M.robar(c.est, c.j, 2) } });
    // Reacciones: se juegan en el turno del rival, como respuesta (ver el motor)
    const objetivoEsMio = c => c.evento.objetivo.u !== undefined && (M.buscar(c.est, c.evento.objetivo.u) || { j: -1 }).j === c.j;
    R("bomba-de-humo", { reaccion: { cuando: "ataque", puede: objetivoEsMio, resolver: c => {
      c.pendiente.cancelado = true;
      const hit = M.buscar(c.est, c.pendiente.datos.objetivo.u);
      if (hit) hit.u.flags.intocableHasta = Math.max(hit.u.flags.intocableHasta, c.est.turno);
      M.log(c.est, "El humo lo cubre todo: el ataque se pierde.");
    } } });
    R("silbato-de-guardia", { reaccion: { cuando: "ataque", puede: objetivoEsMio, resolver: c => {
      const hit = M.buscar(c.est, c.pendiente.datos.objetivo.u);
      if (hit) M.mod(c.est, hit.u, 0, 3, c.est.turno);
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
