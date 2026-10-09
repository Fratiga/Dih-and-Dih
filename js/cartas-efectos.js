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
     fuerzaHelenica  en combate contra una unidad su daño es la vida que tiene esa unidad; si nadie la
                     bloquea y toca al jugador, le quita toda la vida. No ignora resistencias: Barrera,
                     Duro, Esquivo, reduceDano y los guardianes se aplican después
     reduceDano      daño que se quita de cada golpe que recibe
     guardian        recibe en lugar de un aliado el daño (una vez por turno); con
                     guardianUnaVez: true, una sola vez en toda la partida
     duplicaEn       id de un terreno; mientras esté en juego duplica su ataque (con pasivaAtq)
                     y su vida (lo hace el motor)
     alCrear         al crearse, sin importar silencios
     escurridizo     (est, u) => bool; si devuelve true, ni los desafíos ni las habilidades
                     enemigas pueden elegirla (también existe flags.escurridizoHasta)
     alEntrar        { objetivo?, resolver(c) } habilidad "al entrar"
     alEntrarAliada  cuando otra unidad aliada entra
     alRecibirDano   al recibir daño sin morir ({ est, M, u, j, cantidad, fuente })
     evitaMuerte     (est, g, u, fuente) => bool; una unidad aliada g puede evitar que u muera (u se queda con 1 de vida)
     costeMod        (est, u, meta) => número; abarata o encarece cartas de su dueño mientras esté en juego
     filtro          (dentro de alEntrar/jugar) (est, objetivo, j) => bool; limita qué objetivos son válidos
     alMorir         al morir
     alMorirAliada   cuando cae otra unidad aliada: { est, M, u (la que reacciona), j, muerta }
     alMorirEnemiga  cuando cae una unidad del rival: { est, M, u, j, muerta }
                     Las dos se llaman con la caída ya hecha: la unidad `muerta` ya está en el cementerio
                     (salvo las fichas, que no dejan carta). Para devolver unidades del cementerio están
                     M.revivir(est, j, opciones), M.enCementerio(est, j, filtro) y M.exiliar(est, j, i)
                     (ver «Cementerio» en docs/combate-triunfos.md).
     alMatar         al destruir a una unidad con un ataque
     alInicioTurno   al inicio del turno de su dueño
     jugar           { objetivo?, resolver(c) } para objetos y acciones
     alAtacarJugador cuando golpea al jugador rival (atacante sin bloquear, o arrollar)
     reaccion        { cuando: 'ataque'|'jugar', objetivo?: 'atacante', valido?(est, u, j), puede(c), resolver(c) }
                     para cartas de tipo Reacción. 'ataque' es la declaración de ataques, antes
                     de los bloqueos (c.evento.atacantes, c.est.combate); con objetivo: 'atacante'
                     se elige una unidad atacante (c.objetivo = { u }). c.pendiente.cancelado = true
                     cancela una carta que se iba a jugar

   Los terrenos se registran con registrarTerreno: duracion (turnos), costeMod, inicioTurno,
   finTurno, alEntrarUnidad, alMorirUnidad, daPalabra(est, u, palabra) (palabras que da a las
   unidades de su dueño) y eco(est, u) (repite la habilidad al entrar). Una carta que no aparece
   aquí (por ejemplo una creada desde el editor) juega solo con sus números.
============================================================================= */
(function (raiz) {
  function registrar(M) {
    const R = M.registrar, RT = M.registrarTerreno;
    const enemigas = (est, j) => est.jugadores[1 - j].campo;
    const aleatoria = (est, lista) => lista[M.entero(est, lista.length)];
    const esDe = (est, u, afinidad) => (M.meta(est, u.cartaId).afinidad || []).includes(afinidad);
    const cuantas = (est, j, afinidad) => est.jugadores[j].campo.filter(u => esDe(est, u, afinidad)).length;
    const descartarAlAzar = (est, j) => {
      const J = est.jugadores[j];
      if (!J.mano.length) return;
      const carta = J.mano.splice(M.entero(est, J.mano.length), 1)[0];
      J.descartes.push(carta);
      M.log(est, `${J.nombre} descarta ${M.meta(est, carta).nombre}.`);
    };

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
    // Adam Kovacs, héroe de Brurland (carta creada desde el editor: su id en el servidor es adam-kovacs-h)
    R("adam-kovacs-h", { fuerzaHelenica: true });
    R("torvrena", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.noAtacaHasta = c.est.turno + 1;
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} queda atrapada y no podrá atacar el próximo turno.`);
    } } });
    R("ryn", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => M.mod(c.est, c.objetivo, 2, 2, c.est.turno) } });
    R("hooey-magoo", { alMorir: c => M.robar(c.est, c.j, 1) });

    // La banda de Cassius: Billy tapa, Voss hostiga, Victor señala.
    R("billy", { palabras: ["provocar"] });
    R("voss", { palabras: ["veloz"], alAtacarJugador: c => descartarAlAzar(c.est, 1 - c.j) });
    R("victor", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.marcadaPor = c.j;
      c.objetivo.flags.marcadaHasta = c.est.turno + 2;   // hasta el final de tu próximo turno
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} queda marcada hasta el final del próximo turno de ${c.est.jugadores[c.j].nombre}.`);
    } } });

    // Los Seis del Último Apunte
    R("amarillo-ultimo-apunte", { palabras: ["duro"], guardian: true, guardianUnaVez: true });
    R("azul-ultimo-apunte", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.noBloqueaHasta = Math.max(c.objetivo.flags.noBloqueaHasta, c.est.turno);
      M.log(c.est, `${M.nombre(c.est, c.u)} interrumpe a ${M.nombre(c.est, c.objetivo)}: no podrá bloquear este turno.`);
    } } });
    R("verde-ultimo-apunte", { alAtacarJugador: c => M.robar(c.est, c.j, 1) });
    R("morado-ultimo-apunte", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.noBloqueaHasta = Math.max(c.objetivo.flags.noBloqueaHasta, c.est.turno + 1);
      c.objetivo.flags.noAtacaHasta = Math.max(c.objetivo.flags.noAtacaHasta, c.est.turno + 1);
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} queda sujeta por las cadenas de Morado: ni ataca ni bloquea hasta el final de su próximo turno.`);
    } } });
    R("gris-ultimo-apunte", { auraAtq: () => 1 });
    R("rojo-ultimo-apunte", { palabras: ["desafiante"], alEntrar: { resolver: c => {
      c.est.jugadores[c.j].campo.filter(o => o.uid !== c.u.uid && o.cartaId.endsWith("-ultimo-apunte")).forEach(o => {
        o.atq += 1; o.pvMax += 1; o.pv += 1;
      });
      M.log(c.est, "Rojo da la orden: los demás del Último Apunte ganan +1/+1.");
    } } });

    // El laboratorio de Dexter. Darian crece dentro de la Cueva de Carne (ver duplicaEn en el motor).
    R("darian", {
      palabras: ["duro"],
      alCrear: (est, u) => { u.flags.barrera = true; },
      duplicaEn: "cueva-de-carne",
      pasivaAtq: (est, u) => (M.terrenoActivo(est, "cueva-de-carne") ? u.atq : 0)
    });
    R("coronel-tobi", { palabras: ["provocar", "arrollar"] });
    R("elias-morcant", {
      bonusAtaque: (est, u, t) => (t && t.flags.danada ? 2 : 0),
      alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
        M.curar(c.est, { u: c.objetivo.uid }, esDe(c.est, c.objetivo, "carne") ? 5 : 3);
      } }
    });
    R("baltasar-sorel", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => M.infligir(c.est, { u: c.objetivo.uid }, 2, { tipo: "habilidad", dueno: c.j }) } });
    R("nico", { palabras: ["esquivo"] });

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
    R("dragarto", { palabras: ["arrollar"] });
    R("colmillo-gris", { palabras: ["veloz"] });
    R("guillotina", { palabras: ["veloz", "arrollar"] });
    R("protodraco", { palabras: ["volar"], alEntrar: { objetivo: "unidadEnemiga", resolver: c => M.infligir(c.est, { u: c.objetivo.uid }, 2, { tipo: "habilidad", dueno: c.j }) } });
    R("halcon-linire", { palabras: ["volar"] });
    R("felino-veloz-mistico", { palabras: ["veloz"], alCrear: (est, u) => { u.flags.escurridizoHasta = est.turno + 1; } });
    R("mamut-gelido", { palabras: ["duro"] });
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

    // --- Personajes de la cronología sumados después ------------------------------
    // Coach se interpuso entre el protodraco y quien tenía detrás (con Ryn u Orina cubre siempre: ver cartas-vinculos.js).
    R("coach", { guardian: true, guardianUnaVez: true });
    // Julius: el decreto del rey y la sentencia aplazada.
    R("julius-goldenside", {
      alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
        c.objetivo.flags.noAtacaHasta = Math.max(c.objetivo.flags.noAtacaHasta, c.est.turno + 1);
        c.objetivo.flags.noBloqueaHasta = Math.max(c.objetivo.flags.noBloqueaHasta, c.est.turno + 1);
        M.log(c.est, `El decreto del rey Julius cae sobre ${M.nombre(c.est, c.objetivo)}: ni ataca ni bloquea hasta el final de su próximo turno.`);
      } },
      evitaMuerte: (est, g, u) => {
        if (g.flags.sentenciaUsada) return false;
        g.flags.sentenciaUsada = true;
        M.log(est, `Sentencia aplazada: ${M.nombre(est, g)} salva a ${M.nombre(est, u)}, que se queda con 1 de vida.`);
        return true;
      }
    });
    // Leonard, inspirado en Leo Whitefang (Guilty Gear Strive): Postura de Brynhildr (da la espalda: no bloquea, pero lo suyo
    // es difícil de bloquear), Graviert Würde (onda de energía) y Eisen Strum (contraataque).
    R("leonard-goldenside", {
      palabras: ["noBloquea", "temible"],
      alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
        M.log(c.est, `${M.nombre(c.est, c.u)} lanza una onda de energía.`);
        M.infligir(c.est, { u: c.objetivo.uid }, 2, { tipo: "habilidad", dueno: c.j });
      } },
      alRecibirDano: c => {
        const f = c.fuente;
        if (!f || f.tipo !== "combate" || !f.uid) return;
        const h = M.buscar(c.est, f.uid);
        if (!h || h.j === c.j) return;
        M.log(c.est, `${M.nombre(c.est, c.u)} responde con un contraataque.`);
        M.infligir(c.est, { u: h.u.uid }, 2, { tipo: "habilidad", dueno: c.j });
      }
    });
    R("mercader", { costeMod: (est, u, m) => (m.tipo === "Objeto" ? -1 : 0) });
    // El Comerciante de Dávidas espera a que otros terminen de vivir y se queda con lo que dejan.
    const carronia = c => {
      if ((c.u.flags.carronias || 0) >= 3) return;
      c.u.flags.carronias = (c.u.flags.carronias || 0) + 1;
      c.u.atq += 1; c.u.pvMax += 1; c.u.pv += 1;
      M.log(c.est, `${M.nombre(c.est, c.u)} recoge lo que ${M.nombre(c.est, c.muerta)} dejó: +1/+1.`);
    };
    R("el-vendedor-de-davidas", { alMorirAliada: carronia, alMorirEnemiga: carronia });
    R("gareth", {
      palabras: ["duro"],
      alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => M.meta(est, t.cartaId).coste <= 3, resolver: c => {
        M.log(c.est, `Gareth echa a ${M.nombre(c.est, c.objetivo)} a la calle.`);
        M.devolverAMano(c.est, c.objetivo);
      } }
    });
    R("sigismund", {
      palabras: ["duro"],
      alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
        M.log(c.est, `${M.nombre(c.est, c.u)} dispara la balista.`);
        M.infligir(c.est, { u: c.objetivo.uid }, M.tienePalabra(c.est, c.objetivo, "volar") ? 4 : 2, { tipo: "habilidad", dueno: c.j });
      } }
    });
    R("isa", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.noAtacaHasta = Math.max(c.objetivo.flags.noAtacaHasta, c.est.turno + 1);
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se queda mirando a Isa: no podrá atacar el próximo turno.`);
    } } });
    R("sett", { palabras: ["arrollar"] });
    R("vieja-de-la-espesura", { alEntrar: { resolver: c => M.robar(c.est, c.j, 1) } });
    R("clef", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => M.mod(c.est, c.objetivo, 2, 0, c.est.turno + 2, `Clef da una orden: ${M.nombre(c.est, c.objetivo)} gana +2 de ataque hasta el final de tu próximo turno.`) } });
    R("ulis", { alInicioTurno: c => M.curar(c.est, { u: c.u.uid }, 1) });
    // La enfermera Harrow: la jeringa cura a los suyos o castiga a los demás, y salva a una aliada de morir (una vez por partida).
    R("enfermera-harrow", {
      alEntrar: { objetivo: "unidad", resolver: c => {
        const t = c.objetivo;
        if (t.dueno === c.j) { M.log(c.est, `Harrow inyecta a ${M.nombre(c.est, t)}.`); M.curar(c.est, { u: t.uid }, 3); return; }
        M.log(c.est, `Harrow clava la jeringa en ${M.nombre(c.est, t)}.`);
        t.flags.sinCurarHasta = Math.max(t.flags.sinCurarHasta, c.est.turno + 1);
        M.infligir(c.est, { u: t.uid }, 2, { tipo: "habilidad", dueno: c.j });
      } },
      evitaMuerte: (est, g, u) => {
        if (g.flags.harrowUsada) return false;
        g.flags.harrowUsada = true;
        M.log(est, `«Usted no está autorizado para morir»: Harrow estabiliza a ${M.nombre(est, u)}, que se queda con 1 de vida.`);
        return true;
      }
    });

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

    // Afinidades: cada objeto nuevo premia a una. Los de Carne curan, los de Juramento protegen, los de Sombra estorban.
    R("kit-de-sanador", { jugar: { objetivo: "unidadAliada", resolver: c => {
      M.curar(c.est, { u: c.objetivo.uid }, 4);
      if (esDe(c.est, c.objetivo, "carne")) {
        c.objetivo.atq += 1; c.objetivo.pvMax += 1; c.objetivo.pv += 1;
        M.log(c.est, `${M.nombre(c.est, c.objetivo)} sale más fuerte de la cura (+1/+1).`);
      }
    } } });
    R("corneta-de-senales", { jugar: { resolver: c => M.robar(c.est, c.j, cuantas(c.est, c.j, "juramento") >= 2 ? 2 : 1) } });
    R("veneno-debil", { jugar: { objetivo: "unidadEnemiga", resolver: c => {
      M.mod(c.est, c.objetivo, -2, 0, c.est.turno + 1, `${M.nombre(c.est, c.objetivo)} queda débil: -2 de ataque hasta el final del próximo turno de su dueño.`);
    } } });
    R("capa-reversible", { jugar: { objetivo: "unidadAliada", resolver: c => {
      c.objetivo.flags.escurridizoHasta = c.est.turno + 1;
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se da vuelta la capa: hasta el final del próximo turno del rival nadie puede elegirla.`);
    } } });
    R("sales-aromaticas", { jugar: { resolver: c => {
      const u = M.revivir(c.est, c.j, { pv: 1, silencio: true });
      if (u) M.log(c.est, `${M.nombre(c.est, u)} despierta con 1 de vida.`);
    } } });
    // Trampa para animales: reacción que hiere a un atacante. Respeta Escurridizo, como una habilidad.
    R("trampa-para-animales", { reaccion: { cuando: "ataque", objetivo: "atacante",
      valido: (est, u, j) => M.puedeApuntarHabilidad(est, u, j),
      puede: c => (c.evento.atacantes || []).some(uid => { const h = M.buscar(c.est, uid); return h && M.puedeApuntarHabilidad(c.est, h.u, c.j); }),
      resolver: c => {
        const hit = M.buscar(c.est, c.objetivo.u);
        if (!hit) return;
        M.log(c.est, `${M.nombre(c.est, hit.u)} pisa la trampa.`);
        M.infligir(c.est, { u: hit.u.uid }, 3, { tipo: "habilidad", dueno: c.j });
      } } });
    R("saco-de-abrojos", { reaccion: { cuando: "ataque", resolver: c => {
      const atacantes = (c.est.combate ? c.est.combate.atacantes : []).map(uid => M.buscar(c.est, uid)).filter(Boolean);
      M.log(c.est, "Los abrojos cubren el camino.");
      atacantes.forEach(h => M.mod(c.est, h.u, -1, 0, c.est.turno, `${M.nombre(c.est, h.u)} avanza cojeando: -1 de ataque este turno.`));
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
    // Pozo de la Eternidad: la primera unidad de Eternidad de su dueño que muere cada turno vuelve con 1 de vida.
    RT("pozo-de-la-eternidad", { alMorirUnidad: (est, u) => {
      const T = est.terreno;
      if (u.dueno !== T.dueno || T.usado === est.turno || M.meta(est, u.cartaId).token || !esDe(est, u, "eternidad")) return;
      if (est.jugadores[u.dueno].campo.length >= M.C.CAMPO_MAX) return;
      T.usado = est.turno;
      const nueva = M.revivir(est, u.dueno, { id: u.cartaId, pv: 1, hueco: u.hueco, silencio: true });
      if (nueva) M.log(est, `El Pozo de la Eternidad devuelve a ${M.nombre(est, nueva)} con 1 de vida.`);
    } });
    // Fauces Grises: los rastreadores de Cacería eligen a su presa.
    RT("fauces-grises", { duracion: 3, daPalabra: (est, u, palabra) => palabra === "desafiante" && esDe(est, u, "caceria") });
    // Montaña del Eco Arcano: los conjuros de Arcano resuenan y se repiten.
    RT("montana-del-eco-arcano", { duracion: 3, eco: (est, u) => est.terreno.dueno === u.dueno && esDe(est, u, "arcano") });
    // Campamento de las Astas Caídas: el duelo endurece a los que quedan.
    RT("campamento-de-las-astas-caidas", { alMorirUnidad: (est, u) => {
      const T = est.terreno;
      if (u.dueno !== T.dueno || T.luto === est.turno || M.meta(est, u.cartaId).token) return;
      T.luto = est.turno;
      const hasta = est.activo === u.dueno ? est.turno + 2 : est.turno + 1;   // el final del próximo turno de su dueño
      est.jugadores[u.dueno].campo.forEach(o => M.mod(est, o, 1, 0, hasta, `${M.nombre(est, o)} se endurece por el duelo: +1 de ataque hasta el final del próximo turno de su dueño.`));
    } });
    // Carroñada: lo que cae alimenta a los de Carne.
    RT("carronada", { alMorirUnidad: (est, u) => {
      const T = est.terreno;
      est.jugadores[T.dueno].campo.filter(o => esDe(est, o, "carne")).forEach(o => M.curar(est, { u: o.uid }, 2));
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
