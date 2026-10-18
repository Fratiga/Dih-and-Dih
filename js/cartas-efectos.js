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
     palabrasForma   { k: [palabras] } palabras que da la forma k de la unidad (la forma 0 es la base)
     formas          (no es una habilidad: es un campo de la carta) cada unidad tiene u.flags.forma (0 = base) y la cambia
                     M.cambiarForma(est, u, k, textoDelRegistro); la imagen de cada forma está en carta.formas[k - 1]
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
     alFinTurno      al terminar el turno de su dueño
     alAtacar        al declarar su dueño un ataque en el que participa la unidad (antes de reacciones y bloqueos)
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
    // Cartas que cambian de forma según cómo se las juega: al atacar pasan a la forma 1 y, si pasa un turno de su
    // dueño sin que ataquen, vuelven a la forma 0. `ida` y `vuelta` son los textos del registro (reciben el nombre).
    const formaAlAtacar = (ida, vuelta) => ({
      alAtacar: c => {
        c.u.flags.ataqueTurno = c.est.turno;
        M.cambiarForma(c.est, c.u, 1, ida(M.nombre(c.est, c.u)));
      },
      alFinTurno: c => {
        if (c.u.flags.ataqueTurno !== c.est.turno) M.cambiarForma(c.est, c.u, 0, vuelta(M.nombre(c.est, c.u)));
      }
    });
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
    // Leonard (basado en Leo Whitefang, de Guilty Gear Strive) cambia de postura según cómo se le juegue: de guardia bloquea y
    // devuelve el golpe (Eisen Strum); si ataca se pone de espaldas en la Postura de Brynhildr (no bloquea y casi nadie lo
    // bloquea a él). Un turno suyo sin atacar lo devuelve a la guardia.
    R("leonard-goldenside", Object.assign({
      palabrasForma: { 1: ["noBloquea", "temible"] },
      alRecibirDano: c => {
        if (c.u.flags.forma) return;                                  // Eisen Strum solo en la guardia
        const f = c.fuente;
        if (!f || f.tipo !== "combate" || !f.uid) return;
        const h = M.buscar(c.est, f.uid);
        if (!h || h.j === c.j) return;
        M.log(c.est, `${M.nombre(c.est, c.u)} responde con Eisen Strum.`);
        M.infligir(c.est, { u: h.u.uid }, 2, { tipo: "habilidad", dueno: c.j });
      }
    }, formaAlAtacar(n => `${n} da la espalda: adopta la Postura de Brynhildr.`, n => `${n} pasa un turno sin atacar y vuelve a la guardia.`)));
    R("mercader", { costeMod: (est, u, m) => (m.tipo === "Objeto" ? -1 : 0) });
    // El Comerciante de Dávidas espera a que otros terminen de vivir y se queda con lo que dejan.
    const carronia = c => {
      if ((c.u.flags.carronias || 0) >= 3) return;
      c.u.flags.carronias = (c.u.flags.carronias || 0) + 1;
      c.u.atq += 1; c.u.pvMax += 1; c.u.pv += 1;
      M.log(c.est, `${M.nombre(c.est, c.u)} recoge lo que ${M.nombre(c.est, c.muerta)} dejó: +1/+1.`);
    };
    R("el-vendedor-de-davidas", { alMorirAliada: carronia, alMorirEnemiga: carronia });

    // --- La milicia de Brurland y otros que eran cartas vacías (stats en data/stats.js, bestiario y ajedrez) ---------
    // Miliciano: la formación cerrada de los escudos (+1 CA junto a otro miliciano, en D&D).
    R("miliciano-de-brurland", { reduceDano: (est, u) => (est.jugadores[u.dueno].campo.some(o => o.uid !== u.uid && esDe(est, o, "juramento")) ? 1 : 0) });
    // Arquero: el disparo de cobertura frena a quien alcanza.
    R("arquero-de-la-milicia", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      M.mod(c.est, c.objetivo, -1, 0, c.est.turno + 1, `${M.nombre(c.est, c.objetivo)} queda bajo fuego de cobertura: -1 de ataque hasta el final del próximo turno de su dueño.`);
    } } });
    // Sargento: la orden de avanzar.
    R("sargento-de-la-milicia", { alEntrar: { resolver: c => {
      const tropa = c.est.jugadores[c.j].campo.filter(o => o.uid !== c.u.uid && esDe(c.est, o, "juramento"));
      tropa.forEach(o => M.mod(c.est, o, 1, 0, c.est.turno));
      if (tropa.length) M.log(c.est, `${M.nombre(c.est, c.u)} ordena avanzar: ${tropa.length === 1 ? "su compañero de Juramento gana" : "sus compañeros de Juramento ganan"} +1 de ataque este turno.`);
    } } });
    // Caballero: la embestida arrolla y la resolución inquebrantable lo deja en pie una vez.
    R("caballero-de-brurland", {
      palabras: ["arrollar"],
      evitaMuerte: (est, g, u) => {
        if (g.uid !== u.uid || g.flags.resolucionUsada) return false;
        g.flags.resolucionUsada = true;
        M.log(est, `Resolución inquebrantable: ${M.nombre(est, g)} se queda en pie con 1 de vida.`);
        return true;
      }
    });
    // Mago de la milicia: un resguardo para quien va a recibir los golpes.
    R("mago-de-milicia", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
      c.objetivo.flags.barrera = true;
      M.log(c.est, `${M.nombre(c.est, c.u)} levanta un resguardo sobre ${M.nombre(c.est, c.objetivo)}: ignora el primer daño que reciba.`);
    } } });
    R("perro-sabio", { alEntrar: { resolver: c => M.robar(c.est, c.j, 1) } });
    R("rata", { alCrear: (est, u) => { u.flags.escurridizoHasta = est.turno + 1; } });
    R("sapo-beluto", { bonusAtaque: (est, u, t) => (t && M.tienePalabra(est, t, "volar") ? 3 : 0) });
    R("cocatriz", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => {
      M.mod(c.est, c.objetivo, -2, 0, c.est.turno + 1, `${M.nombre(c.est, c.objetivo)} respira el vapor negro de la cocatriz: -2 de ataque hasta el final del próximo turno de su dueño.`);
    } } });
    // Zraith es criatura y terreno a la vez: al entrar levanta su tormenta, que dura mientras él siga en juego.
    R("zraith", { palabras: ["volar"], alEntrar: { resolver: c => M.ponerTerreno(c.est, c.j, "tormenta-de-zraith", { ligadoA: c.u.uid }) } });
    RT("tormenta-de-zraith", { finTurno: est => {
      if (est.activo !== est.terreno.dueno) return;
      const rivales = enemigas(est, est.terreno.dueno);
      if (!rivales.length) return;
      const t = aleatoria(est, rivales);
      M.log(est, `Un rayo de la tormenta de Zraith cae sobre ${M.nombre(est, t)}.`);
      M.infligir(est, { u: t.uid }, 1, { tipo: "terreno" });
    } });
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
    // Ulis es una niña pequeña que se vuelve un monstruo ajolote grande cuando quiere y sin desgaste.
    R("ulis", Object.assign({
      alInicioTurno: c => M.curar(c.est, { u: c.u.uid }, 1),
      pasivaAtq: (est, u) => (u.flags.forma === 1 ? 2 : 0)
    }, formaAlAtacar(n => `${n} se transforma en un monstruo ajolote grande.`, n => `${n} pasa un turno sin atacar y vuelve a ser una niña.`)));
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

    // =====================================================================================================
    // Lote 2: líderes de facción, NPCs, criaturas, objetos, reacciones y terrenos (js/cartas-datos.js, «Lote 2»)
    // =====================================================================================================
    const MANO_MAX = M.C.MANO_MAX, CAMPO_MAX = M.C.CAMPO_MAX;
    // Último turno del próximo turno de `dueno` (para «hasta el final de su próximo turno»)
    const proximoDe = (est, dueno) => (est.activo === dueno ? est.turno + 2 : est.turno + 1);
    const golpe = (c, t, n) => M.infligir(c.est, { u: t.uid }, n, { tipo: "habilidad", dueno: c.j });
    const barrer = (c, n) => enemigas(c.est, c.j).slice().forEach(t => { if (M.buscar(c.est, t.uid)) golpe(c, t, n); });
    const mejora = (u, a, p) => { u.atq += a; u.pvMax += p; u.pv += p; };
    const dar = (u, palabra, hasta) => { u.flags.dadas = u.flags.dadas || {}; u.flags.dadas[palabra] = hasta === undefined ? 9999 : hasta; };
    const crear = (c, id, n) => { for (let i = 0; i < n; i++) { if (c.est.jugadores[c.j].campo.length >= CAMPO_MAX) return; M.ponerUnidad(c.est, c.j, id, false, null); } };
    const alMano = (est, j, id) => {
      const J = est.jugadores[j];
      if (J.mano.length >= MANO_MAX) { J.descartes.push(id); M.log(est, `${J.nombre} tiene la mano llena: ${M.meta(est, id).nombre} se pierde.`); }
      else J.mano.push(id);
    };
    const masHerida = (est, j) => est.jugadores[j].campo.filter(u => u.pv < u.pvMax).sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax || a.pv - b.pv)[0] || null;
    const conMenosVida = (est, j) => est.jugadores[j].campo.slice().sort((a, b) => a.pv - b.pv || a.uid - b.uid)[0] || null;
    const limpiar = (est, u) => {
      u.mods = u.mods.filter(m => { if (m.atq < 0) { u.pvMax -= m.pv; return false; } return true; });
      ["noAtacaHasta", "noBloqueaHasta", "sinProvocarHasta", "sinVolarHasta", "sinCurarHasta"].forEach(k => { u.flags[k] = 0; });
      if (u.flags.marcadaPor !== null && u.flags.marcadaPor !== u.dueno) { u.flags.marcadaPor = null; u.flags.marcadaHasta = 0; }
      u.pv = Math.max(1, Math.min(u.pv, u.pvMax));
    };
    const descartarPor = (est, j, mejor) => {
      const J = est.jugadores[j];
      if (!J.mano.length) return;
      let k = 0;
      J.mano.forEach((id, i) => { if (mejor(M.meta(est, id).coste || 0, M.meta(est, J.mano[k]).coste || 0)) k = i; });
      const carta = J.mano.splice(k, 1)[0];
      J.descartes.push(carta);
      M.log(est, `${J.nombre} descarta ${M.meta(est, carta).nombre}.`);
    };
    const descartarMasBarata = (est, j) => descartarPor(est, j, (a, b) => a < b);
    const descartarMasCara = (est, j) => descartarPor(est, j, (a, b) => a > b);
    // Roba del mazo la primera carta que cumpla el filtro(meta). Devuelve true si había alguna.
    const robarDelMazo = (est, j, filtro) => {
      const J = est.jugadores[j];
      const i = J.mazo.findIndex(id => filtro(M.meta(est, id)));
      if (i < 0) return false;
      const id = J.mazo.splice(i, 1)[0];
      alMano(est, j, id);
      M.log(est, `${J.nombre} busca en su mazo y roba una carta.`);
      return true;
    };
    // Devuelve a la mano una carta del cementerio (la última, o la de menor coste con cual = "barata")
    const recuperar = (est, j, filtro, cual) => {
      const lista = M.enCementerio(est, j, filtro);
      if (!lista.length) return false;
      const k = cual === "barata" ? lista.reduce((a, b) => ((M.meta(est, b.id).coste || 0) < (M.meta(est, a.id).coste || 0) ? b : a)) : lista[lista.length - 1];
      const id = M.exiliar(est, j, k.i);
      alMano(est, j, id);
      M.log(est, `${est.jugadores[j].nombre} recupera ${M.meta(est, id).nombre} de su cementerio.`);
      return true;
    };

    // Fichas del lote
    M.registrarFicha("automata", { nombre: "Autómata", afinidad: ["arcano"], atq: 1, pv: 2, habilidad: "Un autómata de Nernib: obedece y no pregunta." });
    M.registrarFicha("mercenario", { nombre: "Mercenario", tipo: "Personaje", afinidad: ["juramento"], atq: 2, pv: 1, habilidad: "Espada de alquiler: el contrato dura lo que dura el pago." });
    M.registrarFicha("gusano-de-arena", { nombre: "Gusano de arena", afinidad: ["carne"], atq: 2, pv: 2, habilidad: "Cría de la Madre del Desierto." });
    M.registrarFicha("cachorro-de-jauria", { nombre: "Cachorro de jauría", afinidad: ["caceria"], atq: 1, pv: 1, habilidad: "Veloz." });
    M.registrarFicha("emboscado", { nombre: "Emboscado", tipo: "Personaje", afinidad: ["sombra"], atq: 2, pv: 1, habilidad: "Salió de ninguna parte." });
    M.registrarFicha("recluta", { nombre: "Recluta", tipo: "Personaje", afinidad: ["juramento"], atq: 1, pv: 2, habilidad: "Respondió a la campana con lo que tenía a mano." });
    R("cachorro-de-jauria", { palabras: ["veloz"] });

    // --- Líderes de facción --------------------------------------------------------------------------
    R("el-mitrado", { protege: (est, g, t) => t.uid !== g.uid && esDe(est, t, "juramento") });
    R("la-primera-aurora", { alInicioTurno: c => {
      const t = masHerida(c.est, c.j);
      if (!t) return;
      M.log(c.est, `El amanecer de ${M.nombre(c.est, c.u)} cae sobre ${M.nombre(c.est, t)}.`);
      M.curar(c.est, { u: t.uid }, 2);
    } });
    R("el-primer-juramentado", { alEntrarAliada: c => {
      if (!esDe(c.est, c.otra, "juramento")) return;
      c.otra.flags.barrera = true;
      M.log(c.est, `${M.nombre(c.est, c.otra)} es investido: entra con Barrera.`);
    } });
    R("atalaya-de-vardun", { palabras: ["provocar"], alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => M.atqEfectivo(est, t) >= 4, resolver: c => {
      c.objetivo.flags.noAtacaHasta = Math.max(c.objetivo.flags.noAtacaHasta, proximoDe(c.est, c.objetivo.dueno));
      M.log(c.est, `${M.nombre(c.est, c.u)} escucha el hielo y detiene a ${M.nombre(c.est, c.objetivo)}: no puede atacar hasta el final del próximo turno de su dueño.`);
    } } });
    R("legado-del-aguila", { auraAtq: (est, g, u) => (esDe(est, u, "juramento") ? (cuantas(est, g.dueno, "juramento") >= 3 ? 2 : 1) : 0) });
    R("senora-de-la-madriguera", { alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => t.pv < t.pvMax, resolver: c => {
      M.log(c.est, `${M.nombre(c.est, c.u)} captura a ${M.nombre(c.est, c.objetivo)}.`);
      M.devolverAMano(c.est, c.objetivo);
    } } });
    R("el-tiznado", { alEntrar: { resolver: c => { robarDelMazo(c.est, c.j, m => m.tipo === "Objeto"); } } });
    R("pregonero-de-cambalache", { alEntrar: { resolver: c => {
      M.log(c.est, `${M.nombre(c.est, c.u)} abre la puja.`);
      M.robar(c.est, c.j, 1); M.robar(c.est, 1 - c.j, 1);
      descartarMasBarata(c.est, 1 - c.j);
    } } });
    R("primer-engranaje", {
      auraAtq: (est, g, u) => (u.cartaId === "automata" ? 1 : 0),
      alEntrar: { resolver: c => crear(c, "automata", 2) }
    });
    R("decano-de-los-fundamentos", {
      costeMod: (est, u, m) => ((m.afinidad || []).includes("arcano") ? -1 : 0),
      alEntrar: { resolver: c => { robarDelMazo(c.est, c.j, m => (m.afinidad || []).includes("arcano")); } }
    });
    R("la-anatomista", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
      const t = c.objetivo, a = t.atq, p = t.pvMax;
      M.log(c.est, `${M.nombre(c.est, c.u)} diseca a ${M.nombre(c.est, t)}.`);
      M.morir(c.est, t, { tipo: "habilidad", dueno: c.j });
      if (M.buscar(c.est, c.u.uid)) mejora(c.u, a, p);
    } } });
    R("trazahorizontes", { alEntrar: { resolver: c => { if (!robarDelMazo(c.est, c.j, m => m.tipo === "Terreno")) M.robar(c.est, c.j, 1); } } });
    R("el-desenterrador", { alEntrar: { resolver: c => { recuperar(c.est, c.j, m => m.tipo === "Objeto" || m.tipo === "Acción"); } } });
    R("mano-de-oro", { alEntrar: { resolver: c => crear(c, "mercenario", 2) } });
    R("el-ultimo-matadragones", {
      palabras: ["desafiante"],
      bonusAtaque: (est, u, t) => { if (!t) return 0; const m = M.meta(est, t.cartaId); return /drag|draco/i.test(m.nombre) || (m.coste || 0) >= 6 ? 4 : 0; }
    });
    R("primer-velo-del-eclipse", { escurridizo: () => true, alEntrar: { resolver: c => descartarAlAzar(c.est, 1 - c.j) } });
    R("el-anfitrion", { alInicioTurno: c => {
      if (enemigas(c.est, c.j).length <= c.est.jugadores[c.j].campo.length) return;
      const J = c.est.jugadores[c.j];
      J.energia = Math.min(M.C.ENERGIA_MAX, J.energia + 1);
      M.log(c.est, `${M.nombre(c.est, c.u)} cobra su protección: ${J.nombre} gana 1 de energía.`);
    } });
    R("senor-de-las-calas", { alAtacarJugador: c => { M.log(c.est, `${M.nombre(c.est, c.u)} saquea.`); M.robar(c.est, c.j, 1); descartarAlAzar(c.est, 1 - c.j); } });
    R("ceniza-coronada", {
      alEntrar: { resolver: c => { M.revivir(c.est, c.j, { cual: "fuerte", pv: 2 }); } },
      alMorirAliada: c => crear(c, "centinela", 1)
    });
    R("magistrada-de-la-colmena", { alEntrar: { resolver: c => {
      M.vetar(c.est, 1 - c.j, { tipos: ["Objeto", "Acción"], hasta: c.est.turno + 1, texto: "La Magistrada de la Colmena te impide jugar Objetos y Acciones." });
      M.log(c.est, `La sentencia de ${M.nombre(c.est, c.u)}: el rival no puede jugar Objetos ni Acciones hasta el final de su próximo turno.`);
    } } });
    R("portador-del-sello-rojo", { alEntrar: { resolver: c => { M.log(c.est, `${M.nombre(c.est, c.u)} ejecuta un embargo.`); descartarMasCara(c.est, 1 - c.j); } } });
    R("velador-de-umbrathil", { alEntrar: { resolver: c => {
      const J = c.est.jugadores[1 - c.j];
      const arriba = J.mazo.slice(0, 3);
      if (!arriba.length) return;
      let k = 0;
      arriba.forEach((id, i) => { if (M.meta(c.est, id).coste > M.meta(c.est, arriba[k]).coste) k = i; });
      J.mazo.push(J.mazo.splice(k, 1)[0]);
      M.log(c.est, `${M.nombre(c.est, c.u)} registra el mazo de ${J.nombre} y manda una carta al fondo.`);
    } } });

    // --- NPCs genéricos --------------------------------------------------------------------------------
    R("posadero", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => M.curar(c.est, { u: c.objetivo.uid }, 3) } });
    R("herrero-de-aldea", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
      mejora(c.objetivo, 1, 1);
      M.log(c.est, `${M.nombre(c.est, c.u)} forja algo para ${M.nombre(c.est, c.objetivo)}: +1/+1 para siempre.`);
    } } });
    R("boticaria", { alEntrar: { resolver: c => c.est.jugadores[c.j].campo.slice().forEach(u => M.curar(c.est, { u: u.uid }, 2)) } });
    R("bardo-ambulante", { alEntrar: { resolver: c => {
      c.est.jugadores[c.j].campo.slice().forEach(u => M.mod(c.est, u, 1, 0, c.est.turno, `${M.nombre(c.est, u)} sigue la canción: +1 de ataque este turno.`));
    } } });
    R("mercader-viajero", { alEntrar: { resolver: c => { descartarMasBarata(c.est, c.j); M.robar(c.est, c.j, 2); } } });
    R("guardia-de-la-ciudad", { palabras: ["provocar"] });
    R("novicio", { pasivaAtq: (est, u) => Math.min(3, cuantas(est, u.dueno, "juramento") - (esDe(est, u, "juramento") ? 1 : 0)) });
    R("cazador-de-brurland", { bonusAtaque: (est, u, t) => (t && M.meta(est, t.cartaId).tipo === "Criatura" ? 2 : 0) });
    R("granjero-con-horca", { alRecibirDano: c => {
      const f = c.fuente;
      if (!f || f.tipo !== "combate" || !f.uid) return;
      const h = M.buscar(c.est, f.uid);
      if (!h || h.j === c.j) return;
      M.log(c.est, `${M.nombre(c.est, c.u)} le clava la horca a ${M.nombre(c.est, h.u)}.`);
      M.infligir(c.est, { u: h.u.uid }, 1, { tipo: "habilidad", dueno: c.j });
    } });
    R("ladron-de-bolsillos", { alCrear: (est, u) => { u.flags.escurridizoHasta = est.turno + 1; }, alAtacarJugador: c => M.robar(c.est, c.j, 1) });
    R("contrabandista", { alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => M.tienePalabra(est, t, "provocar"), resolver: c => {
      c.objetivo.flags.sinProvocarHasta = Math.max(c.objetivo.flags.sinProvocarHasta, proximoDe(c.est, c.objetivo.dueno));
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} acepta el soborno: pierde Provocar hasta el final del próximo turno de su dueño.`);
    } } });
    R("alquimista-de-nernib", { alEntrar: { objetivo: "unidad", resolver: c => {
      const t = c.objetivo, a = t.atq, p = t.pv;
      t.atq = p; t.pvMax = t.pv = Math.max(1, a);
      t.mods = [];
      M.log(c.est, `${M.nombre(c.est, c.u)} invierte a ${M.nombre(c.est, t)}: ahora es ${t.atq}/${t.pv}.`);
    } } });
    R("aprendiz-de-mago", { alEntrar: { objetivo: "unidadEnemiga", resolver: c => golpe(c, c.objetivo, 1) } });
    R("capitan-de-barco", { alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
      M.log(c.est, `${M.nombre(c.est, c.u)} cambia de rumbo y recoge a ${M.nombre(c.est, c.objetivo)}.`);
      M.devolverAMano(c.est, c.objetivo);
    } } });
    // El Pescador saca algo del agua del terreno: una Criatura o un Objeto al azar de su afinidad, tenga o no esa carta en el mazo.
    // Cuanto más rara, menos probable (PESO_PESCA).
    // Sale de las cartas de la partida (est.cartas): por eso la instantánea lleva una reserva si algún mazo lo incluye
    // (CartasCliente.instantanea) y el sorteo es el mismo en los dos navegadores.
    R("pescador", { alEntrar: { resolver: c => {
      if (!c.est.terreno) return;
      const afin = (M.meta(c.est, c.est.terreno.cartaId).afinidad || [])[0];
      const PESO_PESCA = { comun: 16, infrecuente: 8, rara: 4, legendaria: 1, limitada: 1 };
      const reserva = Object.values(c.est.cartas)
        .filter(m => m && !m.token && ["Criatura", "Objeto"].includes(m.tipo) && (m.afinidad || []).includes(afin))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      if (!reserva.length) { M.robar(c.est, c.j, 1); return; }
      const total = reserva.reduce((s, m) => s + (PESO_PESCA[m.rareza] || 1), 0);
      let tirada = M.entero(c.est, total), id = reserva[0].id;
      for (const m of reserva) { tirada -= PESO_PESCA[m.rareza] || 1; if (tirada < 0) { id = m.id; break; } }
      alMano(c.est, c.j, id);
      M.log(c.est, `${M.nombre(c.est, c.u)} saca ${M.meta(c.est, id).nombre} del agua.`);
    } } });
    R("minero-de-pozohumo", { reduceDano: (est, u, n, fuente) => (fuente && fuente.tipo === "terreno" ? n : 0) });
    R("ciego-profeta", { alEntrar: { resolver: c => {
      const J = c.est.jugadores[1 - c.j];
      if (!J.mazo.length || !M.esUnidad(M.meta(c.est, J.mazo[0]))) return;
      J.mazo.push(J.mazo.shift());
      M.log(c.est, `${M.nombre(c.est, c.u)} ve lo que viene: una carta de ${J.nombre} va al fondo de su mazo.`);
    } } });
    R("verdugo", { alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => t.pv * 2 <= t.pvMax, resolver: c => {
      M.log(c.est, `${M.nombre(c.est, c.u)} ejecuta a ${M.nombre(c.est, c.objetivo)}.`);
      M.morir(c.est, c.objetivo, { tipo: "habilidad", dueno: c.j });
    } } });
    R("escriba-del-contrato", { alEntrar: { resolver: c => {
      M.vetar(c.est, 1 - c.j, { tipos: ["Reacción"], hasta: c.est.turno, texto: "La letra pequeña te impide jugar Reacciones este turno." });
      M.log(c.est, `La letra pequeña de ${M.nombre(c.est, c.u)}: el rival no puede jugar Reacciones este turno.`);
    } } });
    R("peregrino-del-alba", { alMorir: c => {
      const t = masHerida(c.est, c.j);
      if (!t) return;
      M.log(c.est, `El último consuelo de ${M.nombre(c.est, c.u)} llega a ${M.nombre(c.est, t)}.`);
      M.curar(c.est, { u: t.uid }, 3);
    } });
    R("soldado-balutiano", { palabras: ["duro"] });
    R("sepulturero", { alEntrar: { resolver: c => { recuperar(c.est, c.j, m => M.esUnidad(m) && !m.token, "barata"); } } });

    // --- Criaturas y titanes ---------------------------------------------------------------------------
    R("fenix", { alMorir: c => {
      if (c.u.flags.renacida) return;
      const n = M.revivir(c.est, c.j, { id: "fenix", pv: 2, silencio: true });
      if (n) { n.flags.renacida = true; M.log(c.est, "El Fénix renace de sus cenizas con 2 de vida."); }
    } });
    R("kirin", { alEntrar: { resolver: c => {
      c.est.jugadores[c.j].campo.slice().forEach(u => { limpiar(c.est, u); M.curar(c.est, { u: u.uid }, 2); });
      M.log(c.est, "El Kirin purifica a las unidades de su dueño.");
    } } });
    R("manticora", { alEntrar: { resolver: c => { M.log(c.est, "La Manticora lanza sus púas."); barrer(c, 1); } } });
    R("basilisco", { alRecibirDano: c => {
      const f = c.fuente;
      if (!f || f.tipo !== "combate" || !f.uid) return;
      const h = M.buscar(c.est, f.uid);
      if (!h || h.j === c.j) return;
      const hasta = proximoDe(c.est, h.u.dueno);
      h.u.flags.noAtacaHasta = Math.max(h.u.flags.noAtacaHasta, hasta);
      h.u.flags.noBloqueaHasta = Math.max(h.u.flags.noBloqueaHasta, hasta);
      M.log(c.est, `${M.nombre(c.est, h.u)} se queda de piedra: no puede atacar ni bloquear hasta el final del próximo turno de su dueño.`);
    } });
    R("medusa", { alEntrar: { resolver: c => {
      M.log(c.est, "Las serpientes de la Medusa miran al campo rival.");
      barrer(c, 1);
      enemigas(c.est, c.j).forEach(t => { t.flags.noAtacaHasta = Math.max(t.flags.noAtacaHasta, proximoDe(c.est, t.dueno)); });
    } } });
    R("kelpie", { alEntrar: { objetivo: "unidadEnemiga", filtro: (est, t) => !M.tienePalabra(est, t, "volar"), resolver: c => {
      c.objetivo.flags.noAtacaHasta = Math.max(c.objetivo.flags.noAtacaHasta, proximoDe(c.est, c.objetivo.dueno));
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} sube al lomo del Kelpie y se hunde: no puede atacar hasta el final del próximo turno de su dueño.`);
    } } });
    R("unicornio", { escurridizo: () => true, alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => M.curar(c.est, { u: c.objetivo.uid }, c.objetivo.pvMax) } });
    R("behemoth", { palabras: ["duro"], alEntrar: { objetivo: "unidadEnemiga", resolver: c => { M.log(c.est, "El Behemoth embiste."); golpe(c, c.objetivo, 3); } } });
    R("leviatan", { alAtacar: c => { M.log(c.est, "La marea del Leviatán barre el campo rival."); barrer(c, 2); } });
    R("gargola", { palabras: ["duro"], alMorir: c => crear(c, "resto-piedra", 1) });
    R("pegaso", { palabras: ["volar"], alEntrar: { objetivo: "unidadAliadaOtra", resolver: c => {
      dar(c.objetivo, "volar", c.est.turno);
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} monta el Pegaso: Volar hasta el final del turno.`);
    } } });
    R("hipogrifo", { palabras: ["volar", "veloz"] });
    R("grifo", { palabras: ["volar", "temible"] });
    R("dragon-dorado", { palabras: ["volar"], alEntrar: { resolver: c => { M.log(c.est, "El Dragón Dorado reparte su tesoro."); M.robar(c.est, c.j, 2); } } });
    R("dragon-de-magma", { palabras: ["arrollar"], alEntrar: { resolver: c => { M.log(c.est, "El aliento de magma cae sobre el campo rival."); barrer(c, 2); } } });
    R("dragon-ancestral", { palabras: ["volar", "duro"], alEntrar: { objetivo: "unidadEnemiga", resolver: c => golpe(c, c.objetivo, 4) } });
    R("arbol-ancestral-de-eon", { palabras: ["provocar"], alInicioTurno: c => {
      if ((c.u.flags.raices || 0) >= 4) return;
      c.u.flags.raices = (c.u.flags.raices || 0) + 1;
      mejora(c.u, 1, 1);
      M.log(c.est, `${M.nombre(c.est, c.u)} echa raíces: +1/+1.`);
    } });
    R("lao-shan-lung", { palabras: ["duro"], alAtacar: c => {
      if (!c.est.terreno) return;
      M.retirarTerreno(c.est, `${M.nombre(c.est, c.u)} avanza y aplasta ${M.meta(c.est, c.est.terreno.cartaId).nombre}.`);
      M.sincronizarTerreno(c.est);
    } });
    R("borealis-titan-glacial", { palabras: ["duro"], alEntrar: { resolver: c => {
      M.log(c.est, "Borealis despierta y el frío cae sobre el campo rival.");
      enemigas(c.est, c.j).forEach(t => { t.flags.noAtacaHasta = Math.max(t.flags.noAtacaHasta, proximoDe(c.est, t.dueno)); });
    } } });
    R("rykerd-el-imperdonable", { palabras: ["temible"], alMorirAliada: c => { c.u.atq += 2; M.log(c.est, `${M.nombre(c.est, c.u)} no perdona: +2 de ataque.`); } });
    R("ekizias-el-recolector", { alMorirEnemiga: c => {
      if (c.u.flags.cosecha === c.est.turno) return;
      c.u.flags.cosecha = c.est.turno;
      M.log(c.est, `${M.nombre(c.est, c.u)} recoge lo que quedó.`);
      M.robar(c.est, c.j, 1);
    } });
    R("la-madre-del-desierto", {
      alEntrar: { resolver: c => crear(c, "gusano-de-arena", 2) },
      alInicioTurno: c => crear(c, "gusano-de-arena", 1)
    });
    R("mimico", { alCrear: (est, u) => { u.flags.escurridizoHasta = est.turno + 1; }, alMorir: c => descartarAlAzar(c.est, 1 - c.j) });
    R("cubo-gelatinoso", { alMatar: c => { mejora(c.u, 1, 1); M.log(c.est, `${M.nombre(c.est, c.u)} absorbe lo que queda: +1/+1.`); } });
    R("ent-mayor", { palabras: ["provocar"], auraAtq: (est, g, u) => (esDe(est, u, "carne") ? 1 : 0) });
    R("gofiri-la-jauria", { alEntrar: { resolver: c => crear(c, "cachorro-de-jauria", 2) } });

    // --- Objetos y acciones --------------------------------------------------------------------------------
    const equipo = (id, texto, aplicar, filtro) => R(id, { jugar: { objetivo: "unidadAliada", filtro, resolver: c => {
      aplicar(c.objetivo);
      c.objetivo.equipo.push(id);
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} se equipa: ${texto}.`);
    } } });
    equipo("espada-larga", "+2/+0", u => mejora(u, 2, 0));
    equipo("daga-envenenada", "+1/+0 y Veloz", u => { mejora(u, 1, 0); dar(u, "veloz"); });
    equipo("arco-largo", "+1/+0 y Volar", u => { mejora(u, 1, 0); dar(u, "volar"); });
    equipo("lanza-de-caballeria", "+2/+0 y Arrollar", u => { mejora(u, 2, 0); dar(u, "arrollar"); });
    equipo("armadura-de-malla", "+0/+1 y Duro", u => { mejora(u, 0, 1); dar(u, "duro"); });
    equipo("anillo-de-invisibilidad", "Escurridizo para siempre", u => { u.flags.escurridizoHasta = 9999; });
    equipo("capa-elfica", "+0/+1 y Esquivo", u => { mejora(u, 0, 1); dar(u, "esquivo"); });
    equipo("botas-de-velocidad", "Veloz y puede atacar ya", u => { dar(u, "veloz"); u.entro = 0; });
    equipo("reliquia-de-asmodeo", "+2/+2 y Barrera", u => { mejora(u, 2, 2); u.flags.barrera = true; }, (est, t) => esDe(est, t, "juramento"));
    equipo("estandarte-de-brurland", "+1/+2 y Provocar", u => { mejora(u, 1, 2); dar(u, "provocar"); });
    R("pocion-de-fuerza", { jugar: { objetivo: "unidadAliada", resolver: c => M.mod(c.est, c.objetivo, 3, 0, c.est.turno, `${M.nombre(c.est, c.objetivo)} bebe la poción: +3 de ataque este turno.`) } });
    R("antidoto", { jugar: { objetivo: "unidadAliada", resolver: c => { limpiar(c.est, c.objetivo); M.curar(c.est, { u: c.objetivo.uid }, 2); } } });
    R("pergamino-de-bola-de-fuego", { jugar: { resolver: c => { M.log(c.est, "La bola de fuego estalla sobre el campo rival."); barrer(c, 2); } } });
    R("lampara-de-aceite", { jugar: { resolver: c => M.robar(c.est, c.j, c.est.jugadores[1 - c.j].mano.length >= 5 ? 2 : 1) } });
    R("cuerda-de-seda", { jugar: { objetivo: "unidadEnemiga", resolver: c => {
      c.objetivo.flags.sinVolarHasta = Math.max(c.objetivo.flags.sinVolarHasta, proximoDe(c.est, c.objetivo.dueno));
      M.log(c.est, `${M.nombre(c.est, c.objetivo)} cae enredada: pierde Volar hasta el final del próximo turno de su dueño.`);
    } } });
    R("mapa-del-tesoro", { jugar: { resolver: c => M.robar(c.est, c.j, c.est.terreno ? 2 : 1) } });
    R("cofre-con-trampa", { jugar: { resolver: c => { M.robar(c.est, c.j, 2); M.log(c.est, "La trampa del cofre salta."); M.infligir(c.est, { j: c.j }, 2, { tipo: "habilidad", dueno: c.j }); } } });
    R("bomba-alquimica-de-nernib", { jugar: { objetivo: "unidadEnemiga", resolver: c => { golpe(c, c.objetivo, 3); M.infligir(c.est, { j: 1 - c.j }, 1, { tipo: "habilidad", dueno: c.j }); } } });
    R("contrato-firmado", { jugar: { resolver: c => {
      M.vetar(c.est, 1 - c.j, { costeMin: 5, hasta: c.est.turno + 1, texto: "El contrato firmado te impide jugar cartas de coste 5 o más." });
      M.log(c.est, "El contrato queda firmado: el rival no puede jugar cartas de coste 5 o más hasta el final de su próximo turno.");
    } } });
    R("moneda-de-la-suerte", { jugar: { resolver: c => {
      const cara = M.entero(c.est, 2) === 0;
      // La interfaz mira est.moneda para animar el lanzamiento (batalla.js, anunciarMoneda)
      c.est.moneda = { j: c.j, cara, turno: c.est.turno, n: ((c.est.moneda && c.est.moneda.n) || 0) + 1, texto: cara ? "Ganas 2 de energía" : "Robas una carta" };
      if (cara) { c.est.jugadores[c.j].energia = Math.min(M.C.ENERGIA_MAX, c.est.jugadores[c.j].energia + 2); M.log(c.est, "La moneda cae de cara: ganas 2 de energía."); }
      else { M.log(c.est, "La moneda cae de cruz: robas una carta."); M.robar(c.est, c.j, 1); }
    } } });
    R("cuerno-de-guerra", { jugar: { resolver: c => {
      M.log(c.est, "El cuerno de guerra suena.");
      c.est.jugadores[c.j].campo.slice().forEach(u => M.mod(c.est, u, 2, 0, c.est.turno, `${M.nombre(c.est, u)} oye el cuerno: +2 de ataque este turno.`));
    } } });
    R("brujula-de-los-cartografos", { jugar: { resolver: c => {
      M.robar(c.est, c.j, 1);
      c.est.jugadores[c.j].energia = Math.min(M.C.ENERGIA_MAX, c.est.jugadores[c.j].energia + 1);
    } } });

    // --- Reacciones -----------------------------------------------------------------------------------------
    const alAtaque = (id, resolver, puede) => R(id, { reaccion: { cuando: "ataque", puede, resolver } });
    const contraAtacante = (id, resolver) => R(id, { reaccion: { cuando: "ataque", objetivo: "atacante",
      valido: (est, u, j) => M.puedeApuntarHabilidad(est, u, j),
      puede: c => (c.evento.atacantes || []).some(uid => { const h = M.buscar(c.est, uid); return h && M.puedeApuntarHabilidad(c.est, h.u, c.j); }),
      resolver: c => { const hit = M.buscar(c.est, c.objetivo.u); if (hit) resolver(c, hit.u); } } });
    const sacarDelAtaque = (c, u) => { if (c.est.combate) c.est.combate.atacantes = c.est.combate.atacantes.filter(uid => uid !== u.uid); };
    const propias = c => c.est.jugadores[c.j].campo.slice();
    alAtaque("parada", c => { M.log(c.est, "Parada: las unidades de su dueño ganan Barrera."); propias(c).forEach(u => { u.flags.barrera = true; }); }, c => c.est.jugadores[c.j].campo.length > 0);
    contraAtacante("contraataque", (c, t) => {
      const dano = c.est.jugadores[c.j].campo.some(u => esDe(c.est, u, "juramento")) ? 4 : 2;
      M.log(c.est, `Contraataque sobre ${M.nombre(c.est, t)}.`);
      M.infligir(c.est, { u: t.uid }, dano, { tipo: "habilidad", dueno: c.j });
    });
    alAtaque("emboscada", c => { M.log(c.est, "Emboscada: salen dos emboscados de ninguna parte."); crear(c, "emboscado", 2); }, c => c.est.jugadores[c.j].campo.length < CAMPO_MAX);
    R("espejo-arcano", { reaccion: { cuando: "jugar",
      puede: c => ["Objeto", "Acción"].includes(M.meta(c.est, c.evento.carta).tipo),
      resolver: c => { c.pendiente.cancelado = true; alMano(c.est, c.j, c.pendiente.datos.id); M.log(c.est, "El espejo arcano cancela la carta y se queda con una copia."); } } });
    R("contrahechizo", { reaccion: { cuando: "jugar",
      puede: c => ["Objeto", "Acción", "Terreno"].includes(M.meta(c.est, c.evento.carta).tipo),
      resolver: c => { c.pendiente.cancelado = true; M.log(c.est, "El contrahechizo deshace lo que se iba a jugar."); M.robar(c.est, c.j, 1); } } });
    contraAtacante("esquiva", (c, t) => M.mod(c.est, t, -3, 0, c.est.turno, `${M.nombre(c.est, t)} pierde el equilibrio: -3 de ataque este turno.`));
    alAtaque("ultima-voluntad", c => { M.revivir(c.est, c.j, { pv: 1 }); },
      c => c.est.jugadores[c.j].campo.length < CAMPO_MAX && M.enCementerio(c.est, c.j, m => M.esUnidad(m) && !m.token).length > 0);
    alAtaque("muro-de-escudos", c => { M.log(c.est, "Muro de escudos: las unidades de su dueño ganan Duro este turno."); propias(c).forEach(u => dar(u, "duro", c.est.turno)); }, c => c.est.jugadores[c.j].campo.length > 0);
    R("pacto-roto", { reaccion: { cuando: "jugar",
      puede: c => { const m = M.meta(c.est, c.evento.carta); return M.esUnidad(m) && (m.coste || 0) <= 4; },
      resolver: c => { c.pendiente.cancelado = true; M.log(c.est, "El pacto se rompe: la unidad se queda fuera."); } } });
    R("clausula-oculta", { reaccion: { cuando: "jugar",
      puede: c => (M.meta(c.est, c.evento.carta).coste || 0) >= 5,
      resolver: c => { c.pendiente.cancelado = true; M.log(c.est, "La cláusula oculta anula la carta."); } } });
    alAtaque("intervencion-divina", c => {
      M.log(c.est, "Intervención divina.");
      propias(c).forEach(u => M.curar(c.est, { u: u.uid }, u.pvMax));
      M.curar(c.est, { j: c.j }, 4);
    });
    contraAtacante("trampa-de-foso", (c, t) => {
      M.log(c.est, `${M.nombre(c.est, t)} cae al foso.`);
      sacarDelAtaque(c, t);
      t.flags.noAtacaHasta = Math.max(t.flags.noAtacaHasta, proximoDe(c.est, t.dueno));
      M.infligir(c.est, { u: t.uid }, 2, { tipo: "habilidad", dueno: c.j });
    });
    alAtaque("rafaga-de-flechas", c => {
      M.log(c.est, "Una ráfaga de flechas cae sobre los atacantes.");
      (c.est.combate ? c.est.combate.atacantes.slice() : []).forEach(uid => { const h = M.buscar(c.est, uid); if (h) M.infligir(c.est, { u: uid }, 1, { tipo: "habilidad", dueno: c.j }); });
    });
    alAtaque("llamada-a-las-armas", c => { M.log(c.est, "Suena la campana: llegan dos reclutas."); crear(c, "recluta", 2); }, c => c.est.jugadores[c.j].campo.length < CAMPO_MAX);
    contraAtacante("soborno", (c, t) => { M.log(c.est, `${M.nombre(c.est, t)} acepta el soborno y se queda donde está.`); sacarDelAtaque(c, t); M.robar(c.est, c.j, 1); });
    alAtaque("huida-estrategica", c => { const u = conMenosVida(c.est, c.j); if (u) { M.log(c.est, `${M.nombre(c.est, u)} se retira.`); M.devolverAMano(c.est, u); } }, c => c.est.jugadores[c.j].campo.length > 0);
    alAtaque("rezo-del-neravismo", c => { recuperar(c.est, c.j, () => true); }, c => c.est.jugadores[c.j].cementerio.length > 0);

    // --- Terrenos -----------------------------------------------------------------------------------------------
    RT("geiseres-de-nigredo", { duracion: 3, finTurno: est => {
      const todas = M.todas(est);
      if (!todas.length) return;
      const t = aleatoria(est, todas);
      M.log(est, `Un géiser de Nigredo estalla bajo ${M.nombre(est, t)}.`);
      M.infligir(est, { u: t.uid }, 2, { tipo: "terreno" });
    } });
    RT("mina-de-pozohumo", { inicioTurno: (est, jIdx) => {
      if (jIdx !== est.terreno.dueno) return;
      const J = est.jugadores[jIdx];
      J.energia = Math.min(M.C.ENERGIA_MAX, J.energia + 1);
      M.log(est, `La veta de Pozohumo da 1 de energía a ${J.nombre}.`);
    } });
    RT("taberna-del-camino", { duracion: 3, inicioTurno: (est, jIdx) => {
      if (jIdx !== est.terreno.dueno) return;
      est.jugadores[jIdx].campo.slice().forEach(u => M.curar(est, { u: u.uid }, 2));
    } });

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
