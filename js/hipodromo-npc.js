/* =============================================================================
   HIPÓDROMO: los personajes del mundo. Cuadras con dueño virtual (NPC) que compran, venden, entrenan e inscriben a sus criaturas, y apostadores que
   mueven un poco de dinero en el pozo. Es un módulo aparte del motor (js/hipodromo-motor.js lo llama en tres puntos de avanzar()) y se carga antes que él.
   Reglas de oro:
   - Un NPC juega con las mismas órdenes que un jugador (ordenar / procesarOrdenes): no tiene privilegios ni atajos. Su cartera es suya (m.duenos[id].saldo,
     dentro del mundo guardado, nunca en las tablas de jugadores) y se rellena con un préstamo cuando se queda sin nada.
   - Decide solo con lo que sabe cualquiera: el programa público (cuotas, puertas, dueños), las estrellas, las últimas, las etiquetas del terreno. Nunca mira
     el resultado ya calculado de la carrera: las apuestas salen igual cambiando el resultado secreto (está comprobado).
   - Es determinista: todo el azar sale de crearRng(semilla, "npc", ...), así que el servidor y el navegador dan lo mismo y el mundo se puede guardar y reanudar.
   - No quita sitio a los jugadores: deja siempre al menos 2 plazas libres en cada carrera y no se mete en las copas si su criatura no clasifica.
   - Sus apuestas son pequeñas y solo van al pozo (el único mercado donde el volumen cambia lo que cobran los demás). Lo apostado y lo cobrado por ellos es
     dinero de su cartera; en el servidor entran en el reparto del pozo igual que el de un jugador (docs/hipodromo.sql).
   Lo que el servidor y los jugadores ven de ellos: el dueño de las criaturas (cuadra de X), las noticias, las apuestas de la tribuna y la lista de cuadras.
   El Admin los maneja desde su panel (pestaña Personajes, js/admin-hipodromo-npc.js, SQL en docs/admin/hipodromo_personajes.sql): lo que escribe va encima de los valores de
   fábrica de REPARTO (ajustes por personaje y generales, y personajes nuevos) y las órdenes puntuales (dar o quitar tokens o criaturas...) las procesa el motor con
   ordenes(). La Edge Function lee las tablas y se lo pasa al motor en paso(); el motor lo guarda en el mundo (m.npcCfg), así que todo sigue siendo determinista.
============================================================================= */
(function (raiz) {
  "use strict";

  const esNpc = id => typeof id === "string" && id.indexOf("npc:") === 0;
  const redondea = (x, d) => { const k = Math.pow(10, d || 0); return Math.round(x * k) / k; };
  const AJUSTE = {
    FUNDAR_DESDE: 200,        // el mundo ya tiene que haber corrido estas carreras para que se pueda elegir a las criaturas de cada cuadra por lo que han hecho
    PLAZAS_PARA_JUGADORES: 2,// plazas libres que dejan siempre en cada carrera
    ESCALA_APUESTAS: 1,      // multiplica todas las apuestas de la tribuna (0 las apaga)
    MAX_NOTICIAS: 1,         // noticias de personajes que salen como mucho por carrera
    PROB_NOTICIA_VICTORIA: 0.25,  // de las victorias que no son de Gran Premio ni de copa
    PROB_NOTICIA_PRESTAMO: 0.35,
  };

  /* ---------------------------------------------------------------- el reparto */
  /* Cada personaje: quién es (nombre, apodo, cuadra, lema, bio), con qué empieza (inicio), cómo juega (reserva, tope, gasto, grados, copas, dist, cuida, entrena,
     stat, tactica, compra, vende, prestamo), cómo apuesta (apuesta) y qué dice (frases). Los textos, llanos y concretos: sin aforismos ni cierres ingeniosos. */
  const REPARTO = [
    {
      id: "npc:remedios", nombre: "Doña Remedios Calzada", apodo: "la Contadora", cuadra: "Cuadra Calzada e Hijos",
      lema: "Cada token tiene su trabajo.",
      bio: "Viuda de un tratante de forrajes. Lo anota todo en un cuaderno que no enseña a nadie. Compra criaturas baratas y vende la que deja de dar cuentas. En el pozo apuesta poco, casi siempre a la favorita.",
      inicio: { saldo: 1500, tipo: "media", n: 2 },
      reserva: 400, tope: 9000, gasto: 1.5, grados: { gran: 0.3, selecta: 0.8, corriente: 1, novatos: 0.2 }, copas: 0.6, dist: null,
      cuida: null, entrena: 0.005, stat: "debil", tactica: "media", compra: { prob: 0.04, criterio: "baratas", tamano: 3 }, vende: true, prestamo: null, hora: 5,
      apuesta: { estilo: "favorita", prob: 0.5, monto: 12, maxCuota: 3.4 },
      frases: {
        compra: ["Barata y con buenas patas. Me sirve.", "Una boca más en el libro. Con esta salen las cuentas."],
        vende: ["Esa ya no me da cuentas. Se va.", "Se vende. La avena cuesta cada semana."],
        gana: ["Anotado. Y cobrado.", "Ganó sin gastar de más. Así me gusta."],
        ganaApuesta: ["Poco, pero seguro."], pierdeApuesta: ["Se pierde algo. Se anota."], prestamo: ["Otro préstamo. Lo devuelvo con sus intereses."]
      }
    },
    {
      id: "npc:marques", nombre: "Anselmo de Vallecuervo", apodo: "el Marqués", cuadra: "Casa de Vallecuervo",
      lema: "Los Vallecuervo salen siempre primeros.",
      bio: "Último de una familia que lo perdió casi todo menos el apellido. Solo apunta a sus criaturas a Grandes Premios y copas, y siempre al frente. No vende ninguna. En el pozo apuesta por la suya, gane o no.",
      inicio: { saldo: 9000, tipo: "elite", n: 3 },
      reserva: 800, tope: 20000, gasto: 7, grados: { gran: 1, selecta: 0.5, corriente: 0, novatos: 0 }, copas: 1, dist: "larga",
      cuida: null, entrena: 0.005, stat: "vel", tactica: "frente", compra: { prob: 0.02, criterio: "flechas", tamano: 3 }, vende: false, prestamo: { piso: 1200, monto: 3000 }, hora: 9,
      apuesta: { estilo: "vanidad", prob: 0.85, monto: 40 },
      frases: {
        compra: ["Tiene porte. Servirá en mis establos.", "Me recuerda a una de mi abuelo. Con eso basta."],
        vende: ["Los Vallecuervo no venden. Esto es una cesión."],
        gana: ["Un trámite.", "Ni siquiera hizo falta esforzarse."],
        ganaApuesta: ["Naturalmente."], pierdeApuesta: ["Un error de la pista."], prestamo: ["Un adelanto de la herencia. Que nadie lo comente."]
      }
    },
    {
      id: "npc:pez", nombre: "Tano y Berta Pez", apodo: "los Pez", cuadra: "Cuadra Los Pez",
      lema: "Tú inscribe, que ya veremos.",
      bio: "Dos hermanos que inscriben a todo el que se tenga en pie. Cuidan poco a sus criaturas y le deben dinero al banco. Apuestan poco, y a las de cuota alta.",
      inicio: { saldo: 500, tipo: "baja", n: 3 },
      reserva: 60, tope: 2500, gasto: 3, grados: { gran: 0, selecta: 0.1, corriente: 0.7, novatos: 1 }, copas: 0, dist: "corta",
      cuida: null, entrena: 0.003, stat: "debil", tactica: null, compra: { prob: 0.08, criterio: "baratisimas", tamano: 3 }, vende: true, prestamo: { piso: 150, monto: 400 }, hora: 14,
      apuesta: { estilo: "longshots", prob: 0.5, monto: 6, minCuota: 9 },
      frases: {
        compra: ["¡Qué barata! Nos la llevamos, Berta.", "Tiene cara de ganar algún día."],
        vende: ["Hay que pagar la luz, Tano.", "Se va. Con cariño."],
        gana: ["¡Ganamos! Que alguien avise al banco.", "¿Quién lo dijo? Nosotros."],
        ganaApuesta: ["La del doce a uno. Lo dijimos."], pierdeApuesta: ["Otra vez será. Berta, ¿tienes algo suelto?"], prestamo: ["El banco nos presta otra vez."]
      }
    },
    {
      id: "npc:hilda", nombre: "Madre Hilda de la Escarcha", apodo: "la Madre Escarcha", cuadra: "Convento de la Escarcha",
      lema: "Cada una a su paso.",
      bio: "Priora de un convento de las tierras frías que cría criaturas jóvenes. Las cuida al primer signo de cansancio y las entrena mucho. No vende ninguna y tampoco apuesta.",
      inicio: { saldo: 1800, tipo: "joven", n: 3 },
      reserva: 500, tope: 6000, gasto: 2, grados: { gran: 0, selecta: 0.5, corriente: 1, novatos: 1 }, copas: 0.4, dist: null,
      cuida: 40, entrena: 0.01, stat: "debil", tactica: null, compra: { prob: 0.03, criterio: "jovenes", tamano: 3 }, vende: false, prestamo: null, hora: 20,
      apuesta: null,
      frases: {
        compra: ["Una más para la casa. Se le dará de comer y se le enseñará.", "Llega con frío. Aquí se le quita."],
        vende: ["Las del convento no se venden."],
        gana: ["Doble ración de avena esta noche.", "Lo ha hecho bien."],
        ganaApuesta: [], pierdeApuesta: [], prestamo: ["La orden tiene que pedir ayuda al banco."]
      }
    },
    {
      id: "npc:cuervo", nombre: "Cuervo Salgado", apodo: "el Tahúr", cuadra: "Cuadra del Cuervo",
      lema: "Yo juego donde nadie mira.",
      bio: "Jugador de oficio con una sola criatura. Vive del pozo. Apuesta fuerte cuando una cuota le parece mal puesta y el resto del tiempo mira. Habla poco.",
      inicio: { saldo: 1200, tipo: "uno", n: 1 },
      reserva: 120, tope: 5000, gasto: 3, grados: { gran: 0.4, selecta: 1, corriente: 0.6, novatos: 0 }, copas: 0.5, dist: null,
      cuida: null, entrena: 0.01, stat: "debil", tactica: "atras", compra: { prob: 0.01, criterio: "valor", tamano: 2 }, vende: true, prestamo: { piso: 350, monto: 600 }, hora: 2,
      apuesta: { estilo: "valor", prob: 0.7, monto: 30 },
      frases: {
        compra: ["Me gustó la cara.", "Los números dicen que sí."],
        vende: ["No cuadraban las cuentas. Se vende."],
        gana: ["Hoy la casa era yo.", "Sin prisa."],
        ganaApuesta: ["Había que mirar donde nadie mira."], pierdeApuesta: ["Se paga la entrada."], prestamo: ["Mala racha. Se paga y se sigue."]
      }
    },
    {
      id: "npc:ludmila", nombre: "Ludmila Voss", apodo: "la Estratega", cuadra: "Haras Voss",
      lema: "Primero se lee la pista.",
      bio: "Criadora de las tierras altas. Prefiere las distancias largas y las pistas arcanas, entrena la resistencia y compra criaturas de buen pecho. Apuesta cuando el terreno favorece a una.",
      inicio: { saldo: 2500, tipo: "largas", n: 3 },
      reserva: 500, tope: 12000, gasto: 4, grados: { gran: 0.6, selecta: 1, corriente: 0.7, novatos: 0 }, copas: 0.8, dist: "larga",
      cuida: null, entrena: 0.012, stat: "res", tactica: "media", compra: { prob: 0.02, criterio: "largas", tamano: 3 }, vende: true, prestamo: { piso: 500, monto: 900 }, hora: 17,
      apuesta: { estilo: "terreno", prob: 0.5, monto: 15 },
      frases: {
        compra: ["Buen pecho. El trazado hará el resto.", "Tiene pulmón. Eso no se enseña."],
        vende: ["No encaja en mi método. Se vende."],
        gana: ["Conforme al plan.", "Era la pista indicada."],
        ganaApuesta: ["El terreno lo decía."], pierdeApuesta: ["Un dato no garantiza nada. Reviso el método."], prestamo: ["Inversión en el haras. Con recibo."]
      }
    },
    {
      id: "npc:pocho", nombre: "Pocho Arango", apodo: "el Optimista", cuadra: null,
      lema: "Quien gana una vez, gana dos.",
      bio: "Aficionado de la grada que cree en las rachas. Cada hora apuesta un poco a la criatura que viene ganando. Si no hay ninguna, no apuesta.",
      inicio: { saldo: 300, tipo: null, n: 0 }, reserva: 0, tope: 700, grados: {}, copas: 0, prestamo: { piso: 20, monto: 60 }, hora: 7,
      apuesta: { estilo: "racha", prob: 0.7, monto: 8 },
      frases: { ganaApuesta: ["¡Racha, amigos!"], pierdeApuesta: ["La racha estaba descansando."], prestamo: ["Mi cuñado me adelanta el sueldo."] }
    },
    {
      id: "npc:pilar", nombre: "Doña Pilar Ferrer", apodo: "la Supersticiosa", cuadra: null,
      lema: "Siempre el siete. Si no hay siete, el tres.",
      bio: "Vecina de toda la vida. Va a la grada con su amuleto y su pañuelo, apuesta a la puerta siete o, si no la hay, a la tres, y se santigua antes de la salida.",
      inicio: { saldo: 250, tipo: null, n: 0 }, reserva: 0, tope: 600, grados: {}, copas: 0, prestamo: { piso: 15, monto: 50 }, hora: 11,
      apuesta: { estilo: "puerta", prob: 0.6, monto: 7, puertas: [7, 3] },
      frases: { ganaApuesta: ["¡El siete! Siempre el siete."], pierdeApuesta: ["Alguien me miró mal."], prestamo: ["Vendo unas puntillas y listo."] }
    }
  ];
  const PERSONAJE = {}; REPARTO.forEach(p => { PERSONAJE[p.id] = p; });

  /* ---------------------------------------------------------------- lo que cambia el Admin: ajustes encima de los valores de fábrica */
  const ENUMS = {
    dist: [null, "larga", "corta"], tactica: [null, "frente", "media", "atras"], stat: ["debil", "vel", "res", "ace", "agi", "tem"],
    criterio: ["baratas", "baratisimas", "flechas", "jovenes", "largas", "valor"], estilo: ["favorita", "vanidad", "longshots", "valor", "racha", "puerta", "terreno"],
    inicio: [null, "elite", "media", "baja", "joven", "uno", "largas"]
  };
  const FRASES_TIPOS = ["compra", "vende", "gana", "ganaApuesta", "pierdeApuesta", "prestamo"];
  const ID_NPC = /^npc:[a-z0-9-]{2,24}$/;
  const num = (v, a, b, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : def; };
  const txt = (v, max, def) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : def);
  const uno = (v, lista, def) => (lista.indexOf(v) >= 0 ? v : def);
  /* Pone en orden una descripción de personaje (los ajustes del Admin pueden traer cualquier cosa): lo que no vale se cambia por el valor por defecto */
  function sanear(P) {
    const g = P.grados || {}, i = P.inicio || {}, c = P.compra, a = P.apuesta, p = P.prestamo, f = {};
    FRASES_TIPOS.forEach(k => { const l = P.frases && P.frases[k]; f[k] = Array.isArray(l) ? l.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, 240)).slice(0, 12) : []; });
    return {
      id: P.id, nuevo: !!P.nuevo, activo: P.activo !== false,
      nombre: txt(P.nombre, 40, "Sin nombre"), apodo: txt(P.apodo, 30, ""), cuadra: txt(P.cuadra, 40, null), lema: txt(P.lema, 120, ""), bio: txt(P.bio, 400, ""),
      inicio: { saldo: num(i.saldo, 0, 100000, 500), tipo: uno(i.tipo, ENUMS.inicio, null), n: Math.round(num(i.n, 0, 4, 0)) },
      reserva: num(P.reserva, 0, 100000, 0), tope: num(P.tope, 0, 1000000, 0), gasto: num(P.gasto, 0, 100, 0), hora: Math.round(num(P.hora, 0, 23, 0)),
      prestamo: p && typeof p === "object" ? { piso: num(p.piso, 0, 100000, 0), monto: num(p.monto, 0, 1000000, 0) } : null,
      grados: { gran: num(g.gran, 0, 1, 1), selecta: num(g.selecta, 0, 1, 1), corriente: num(g.corriente, 0, 1, 1), novatos: num(g.novatos, 0, 1, 1) },
      copas: num(P.copas, 0, 1, 0), dist: uno(P.dist, ENUMS.dist, null), tactica: uno(P.tactica, ENUMS.tactica, null),
      cuida: P.cuida == null ? null : num(P.cuida, 0, 100, null), entrena: num(P.entrena, 0, 0.2, 0), stat: uno(P.stat, ENUMS.stat, "debil"),
      compra: c && typeof c === "object" ? { prob: num(c.prob, 0, 0.3, 0.02), criterio: uno(c.criterio, ENUMS.criterio, "baratas"), tamano: Math.round(num(c.tamano, 1, 4, 3)) } : null,
      vende: !!P.vende,
      apuesta: a && typeof a === "object" ? { estilo: uno(a.estilo, ENUMS.estilo, "favorita"), prob: num(a.prob, 0, 1, 0.5), monto: num(a.monto, 1, 200, 10), maxCuota: num(a.maxCuota, 1, 500, 3.4), minCuota: num(a.minCuota, 1, 500, 9),
        puertas: Array.isArray(a.puertas) ? a.puertas.map(x => Math.round(num(x, 1, 20, 7))).slice(0, 4) : [7, 3] } : null,
      frases: f
    };
  }
  /* Los valores de fábrica con los ajustes del Admin por encima (los objetos anidados se mezclan campo a campo; las frases, grupo a grupo) */
  function mezcla(base, over) {
    const P = JSON.parse(JSON.stringify(base || {}));
    Object.keys(over || {}).forEach(k => {
      const v = over[k];
      if ((k === "grados" || k === "inicio" || k === "frases") && v && typeof v === "object" && P[k] && typeof P[k] === "object") Object.assign(P[k], v);
      else if ((k === "compra" || k === "apuesta" || k === "prestamo") && v && typeof v === "object" && P[k] && typeof P[k] === "object") P[k] = Object.assign({}, P[k], v);
      else P[k] = v;
    });
    return P;
  }
  /* Un personaje tal como juega de verdad: fábrica + ajustes, en orden. Para el panel de Admin (que lo enseña antes de guardar) y para el motor. */
  const efectiva = (id, over) => sanear(Object.assign(mezcla(PERSONAJE[id], over), { id }));
  /* Lo que el Admin ha puesto en el mundo (m.npcCfg: { global: {...}, "npc:...": {...} }) lo trae la Edge Function en cada paso (configurar) */
  function configurar(m, ajustes) { if (ajustes && typeof ajustes === "object" && !Array.isArray(ajustes)) m.npcCfg = JSON.parse(JSON.stringify(ajustes)); }
  let memoria = { m: null, cfg: null, lista: null };
  function lista(m) {
    if (memoria.m === m && memoria.cfg === m.npcCfg && memoria.lista) return memoria.lista;
    const cfg = m.npcCfg || {};
    const ids = REPARTO.map(p => p.id).concat(Object.keys(cfg).filter(k => k !== "global" && !PERSONAJE[k] && ID_NPC.test(k) && cfg[k] && typeof cfg[k] === "object" && cfg[k].nuevo));   // los nuevos que ha creado el Admin
    memoria = { m, cfg: m.npcCfg, lista: ids.map(id => efectiva(id, cfg[id])) };
    return memoria.lista;
  }
  const persona = (m, id) => lista(m).find(P => P.id === id) || null;
  /* Los ajustes generales: interruptor de todos, escala de las apuestas de la tribuna y noticias por carrera */
  function general(m) {
    const g = (m.npcCfg && m.npcCfg.global) || {};
    return { activo: g.activo !== false, apuestas: num(g.apuestas, 0, 3, 1), noticias: Math.round(num(g.noticias, 0, 3, AJUSTE.MAX_NOTICIAS)) };
  }

  /* ---------------------------------------------------------------- utilidades */
  const frase = (P, tipo, rng) => { const l = P.frases && P.frases[tipo]; return l && l.length ? "«" + rng.pick(l) + "»" : ""; };
  const nombreCorto = P => P.apodo ? P.apodo.charAt(0).toUpperCase() + P.apodo.slice(1) : P.nombre;
  const suma = o => Object.keys(o || {}).reduce((t, k) => t + Number(o[k] || 0), 0);

  /* Las criaturas del mundo que se pueden fundar como de un personaje: libres, activas y que no estén en la carrera que ya está programada */
  function libres(m, X) {
    const enCarrera = new Set(m.proxima ? m.proxima.entrantes.map(e => e.id) : []);
    return m.vivos.filter(c => !c.dueno && c.estado === "activo" && !enCarrera.has(c.id));
  }

  /* ---------------------------------------------------------------- fundar las cuadras */
  /* Abre la cuadra de un personaje: su cartera y las criaturas del mundo que busca (según lo que dice su `inicio`). Devuelve cuántas se llevó. */
  function fundarUna(m, X, P, ev) {
    m.duenos[P.id] = { nombre: P.nombre, npc: true, adoptada: true, saldo: P.inicio.saldo, cuadra: P.cuadra || null };
    const k = P.inicio.n; if (!k || !P.cuadra) return 0;
    const pool = libres(m, X), adultas = pool.filter(c => X.edadAnios(m.n, c) >= X.C.DEBUT);
    let elegidas = [];
    const porRating = lst => lst.slice().sort((a, b) => b.rating - a.rating);
    switch (P.inicio.tipo) {
      case "elite": elegidas = porRating(adultas.filter(c => c.salidas >= 6)).slice(0, k); break;
      case "media": { const o = porRating(adultas.filter(c => c.salidas >= 4)); const a = Math.floor(o.length * 0.35); elegidas = o.slice(a, a + k); break; }
      case "baja": { const o = porRating(adultas.filter(c => c.salidas >= 2)); elegidas = o.slice(Math.max(0, o.length - k - 4), o.length - 4); break; }
      case "joven": elegidas = pool.filter(c => X.edadAnios(m.n, c) < 2).sort((a, b) => X.edadAnios(m.n, a) - X.edadAnios(m.n, b)).slice(0, k); break;
      case "uno": { const o = porRating(adultas.filter(c => c.salidas >= 6)); const a = Math.floor(o.length * 0.3); elegidas = o.slice(a, a + k); break; }
      case "largas": elegidas = adultas.slice().sort((a, b) => b.genes.pul - a.genes.pul).slice(0, k); break;
      default: break;
    }
    elegidas.forEach(c => { c.dueno = P.id; c.entradas = []; c.tactica = P.tactica || null; ev.cambios.add(c.id); });
    return elegidas.length;
  }
  /* Se hace cuando el mundo ya ha corrido lo suficiente para saber qué criaturas son buenas: la primera vez abre todas las cuadras y, después, las de los
     personajes nuevos que cree el Admin. */
  function iniciar(m, X, ev) {
    if (!m.proxima || m.stats.carreras < AJUSTE.FUNDAR_DESDE || !general(m).activo) return;
    if (!m.duenos) m.duenos = {};
    const nuevos = lista(m).filter(P => !m.duenos[P.id]);
    if (!nuevos.length) return;
    const primera = !m.npc;
    if (!m.npc) m.npc = { v: 1, fundadas: m.n, ultimaOrden: 0 };
    const abiertas = nuevos.map(P => ({ P, n: fundarUna(m, X, P, ev) }));
    const conCuadra = abiertas.filter(x => x.P.cuadra), apostadores = abiertas.filter(x => !x.P.cuadra);
    const nombre = P => P.apodo ? `${P.nombre} (${P.apodo})` : P.nombre;
    if (primera) ev.noticias.push(X.noticia(m, "cuadra", "Nuevas caras en el hipódromo", `Llegan a las cuadras y a la grada: ${conCuadra.map(x => `${nombre(x.P)} abre ${x.P.cuadra} con ${x.n} ${x.n === 1 ? "criatura" : "criaturas"}`).join("; ")}. Y en la tribuna, ${apostadores.map(x => nombre(x.P)).join(" y ")}.`, []));
    else abiertas.forEach(x => ev.noticias.push(X.noticia(m, "cuadra", `Llega ${x.P.nombre} al hipódromo`, x.P.cuadra ? `${nombre(x.P)} abre ${x.P.cuadra} con ${x.n} ${x.n === 1 ? "criatura" : "criaturas"}. ${x.P.lema}` : `${nombre(x.P)} se sienta en la grada. ${x.P.lema}`, [])));
  }
  /* Un personaje que el Admin ha quitado: sus criaturas vuelven al mundo y desaparece su cartera */
  function limpiar(m, ev) {
    const vivos = new Set(lista(m).map(P => P.id));
    Object.keys(m.duenos || {}).forEach(id => {
      if (!m.duenos[id].npc || vivos.has(id)) return;
      m.vivos.concat(m.criadores).forEach(c => { if (c.dueno === id) { soltar(c); ev.cambios.add(c.id); } });
      delete m.duenos[id];
    });
  }
  function soltar(c) { c.dueno = null; c.entradas = []; c.entreno = null; c.tactica = null; }

  /* ---------------------------------------------------------------- el turno de cada personaje: órdenes antes de programar la carrera */
  function turno(m, X, ev) {
    if (!m.npc) return;
    const C = X.C, cal = X.calendarioVisible(m).filter(x => x.n > m.n);
    const G = general(m); if (!G.activo) return;       // el interruptor general del Admin: nadie hace nada
    limpiar(m, ev);
    let noticias = 0;
    lista(m).forEach(P => {
      const d = m.duenos[P.id]; if (!d || !P.activo) return;
      const rng = X.crearRng(m.semilla, "npc", P.id, m.n);
      // préstamo: una vez al día (a la hora que le toca a cada uno) si la cartera está por debajo de su mínimo
      if (P.prestamo && m.n % 24 === P.hora && d.saldo < P.prestamo.piso) {
        d.saldo += P.prestamo.monto;
        if (noticias < G.noticias && rng.f() < AJUSTE.PROB_NOTICIA_PRESTAMO) { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${P.nombre} pide otro préstamo`, `${nombreCorto(P)} se ha quedado sin tokens y el banco le adelanta ${P.prestamo.monto}. ${frase(P, "prestamo", rng)}`, [])); }
      }
      d.saldo = Math.max(0, redondea(d.saldo - (P.gasto || 0) * X.cuadraDe(m, P.id).length, 2));   // la avena, los mozos y el herrero, cada carrera
      if (P.tope && d.saldo > P.tope) d.saldo = P.tope;        // lo que pasa de ahí se les va en salarios, deudas viejas y caprichos
      if (!P.cuadra) return;
      const mias = X.cuadraDe(m, P.id).filter(c => c.estado === "activo");
      const ordenes = [], gasto = { v: 0 };
      const libre = () => d.saldo - P.reserva - gasto.v;
      const pedir = (o, coste) => { ordenes.push(Object.assign({ oid: ordenes.length, dueno: P.id }, o)); gasto.v += coste || 0; };
      // vender lo que no rinde cuando falta dinero
      if (P.vende && d.saldo < P.reserva * 0.35 && mias.length > 1 && rng.f() < 0.5) {
        const peor = mias.filter(c => !(c.entradas && c.entradas.length) && !(m.proxima && m.proxima.entrantes.some(e => e.id === c.id))).sort((a, b) => a.rating - b.rating)[0];
        if (peor) pedir({ tipo: "vender", id: peor.id }, 0);
      }
      mias.forEach(c => {
        if (!c.entradas) c.entradas = [];
        if (P.tactica && c.tactica !== P.tactica && rng.f() < 0.5) pedir({ tipo: "tactica", id: c.id, tactica: P.tactica }, 0);
        const ocupadaYa = m.proxima && m.proxima.entrantes.some(e => e.id === c.id);
        // cuidar a la que está cansada
        if (P.cuida != null && c.fatiga > P.cuida && !c.lesion && !ocupadaYa && m.n - (c.cuidado == null ? -999 : c.cuidado) >= C.CUIDADO_ESPERA && libre() >= C.CUIDADO_COSTE) pedir({ tipo: "cuidar", id: c.id }, C.CUIDADO_COSTE);
        // entrenar a la que está libre
        if (P.entrena && !c.entreno && !c.lesion && !ocupadaYa && X.edadAnios(m.n, c) >= 0.5 && libre() >= C.ENTRENO_COSTE && rng.f() < P.entrena) {
          let stat = P.stat;
          if (stat === "debil") { const cap = X.perfilCuadra(m, c).capacidades; stat = X.STATS.slice().sort((a, b) => cap[a] - cap[b])[0]; }
          if (c.perm[stat] < C.ENTRENO_TOPE) pedir({ tipo: "entrenar", id: c.id, stat }, C.ENTRENO_COSTE);
        }
      });
      // comprar a una del mercado
      if (P.compra && mias.length < P.compra.tamano && rng.f() < P.compra.prob * (mias.length < P.compra.tamano - 1 ? 3 : 1)) {   // con la cuadra a medias reponen antes
        const cand = X.enVenta(m).map(c => X.perfil(m, c)).filter(p => p.precio && p.precio <= libre());
        const puntua = {
          baratas: p => ((p.estrellas == null ? 2.5 : p.estrellas) + 0.5) / (1 + p.precio / 150), baratisimas: p => -p.precio,
          flechas: p => (p.arquetipo === "Flecha" ? 10 : 0) + (p.estrellas || 0), jovenes: p => (/cría|potro|joven/.test(p.etapa) ? 5 : 0) - p.precio / 500,
          largas: p => (p.arquetipo === "Maratonista" || p.arquetipo === "Tanque" ? 8 : 0) + (p.estrellas || 0), valor: p => (p.estrellas || 0) - p.precio / 800
        }[P.compra.criterio];
        const elegida = cand.map(p => ({ p, s: puntua(p) })).sort((a, b) => b.s - a.s)[0];
        if (elegida) pedir({ tipo: "comprar", id: elegida.p.id }, elegida.p.precio);
      }
      if (!ordenes.length) return;
      const saldos = {}; saldos[P.id] = d.saldo;
      const out = X.procesarOrdenes(m, ordenes, saldos);
      d.saldo = redondea(saldos[P.id], 2);
      out.resultados.forEach(r => {
        const o = ordenes[r.oid];
        if (r.criatura != null) ev.cambios.add(r.criatura);
        if (!r.ok || noticias >= G.noticias) return;
        const c = o.id != null ? X.buscar(m, o.id) : null; if (!c) return;
        if (o.tipo === "comprar") { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${nombreCorto(P)} ficha a ${c.nombre}`, `${P.nombre} se lleva a ${c.nombre} para ${P.cuadra} por ${r.costo} tokens. ${frase(P, "compra", rng)}`, [c.id])); }
        else if (o.tipo === "vender") { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${nombreCorto(P)} se desprende de ${c.nombre}`, `${P.nombre} vende a ${c.nombre} a la casa por ${r.ingreso} tokens. ${frase(P, "vende", rng)}`, [c.id])); }
      });
    });
  }

  /* Los entrenadores del mundo arman cada campo con las criaturas de su nivel; las de un personaje entran en ese reparto si su dueño acepta la categoría y la
     distancia (el Marqués no mete a las suyas en Novatos; los Pez huyen de las distancias largas). Una preferencia de 0,6 es «aceptarla 6 de cada 10 veces». */
  function acepta(m, X, c, grado, dist, n) {
    const P = persona(m, c.dueno); if (!P || !grado) return true;
    const G = X.GRADOS[grado];
    let w = G && G.copa ? P.copas : (P.grados && P.grados[grado] != null ? P.grados[grado] : 1);
    if (w == null) w = 1;
    if (dist) { if (P.dist === "larga") w *= dist >= 2000 ? 1 : 0.35; else if (P.dist === "corta") w *= dist <= 1600 ? 1 : 0.35; }
    if (w >= 1) return true; if (w <= 0) return false;
    return X.crearRng(m.semilla, "npc", "acepta", c.id, n == null ? m.n : n).f() < w;
  }

  /* ---------------------------------------------------------------- las apuestas de la tribuna: después de programar la carrera, con lo que sabe cualquiera */
  function elegir(P, pub, perfiles, m, X) {
    const A = P.apuesta, en = pub.entrantes, per = id => perfiles[id] || {};
    switch (A.estilo) {
      case "favorita": { const f = en.slice().sort((a, b) => a.gan - b.gan)[0]; return f && f.gan <= A.maxCuota ? f : null; }
      case "vanidad": { const mias = en.filter(e => e.dueno && e.dueno.id === P.id).sort((a, b) => a.gan - b.gan); return mias[0] || null; }
      case "longshots": { const l = en.filter(e => e.gan >= A.minCuota); return l.length ? l : null; }
      case "valor": { const l = en.filter(e => e.gan >= 3.5 && e.gan <= 16).map(e => ({ e, s: (per(e.id).estrellas || 2.5) / Math.log(e.gan + 1) })).sort((a, b) => b.s - a.s); return l[0] ? l[0].e : null; }
      case "racha": { const l = en.map(e => ({ e, r: per(e.id).racha || 0 })).filter(x => x.r >= 2).sort((a, b) => b.r - a.r); return l[0] ? l[0].e : null; }
      case "puerta": { for (const p of A.puertas) { const e = en.find(x => x.puerta === p); if (e) return e; } return null; }
      case "terreno": {
        const pista = X.PISTAS[pub.pista]; if (!pista) return null;
        const hum = Math.max(0, Math.min(1, pub.mojadoPrevio * 0.7 * (1 - 0.5 * pista.drenaje))), t = X.etiquetaPista(hum);
        const l = en.filter(e => (per(e.id).etiquetas || []).some(x => x.indexOf("terreno " + t) >= 0));
        return l.sort((a, b) => a.gan - b.gan)[0] || null;
      }
      default: return null;
    }
  }
  function apuestas(m, X, sig) {
    sig.tribuna = []; sig.pozoNpc = {};
    const G = general(m), escala = AJUSTE.ESCALA_APUESTAS * G.apuestas;
    if (!m.npc || sig.suspendida || !escala || !G.activo) return;
    const pub = X.programaPublico(sig);                 // solo lo público: sin el resultado ni las probabilidades reales
    const perfiles = {}; pub.entrantes.forEach(e => { const c = X.buscar(m, e.id); if (c) perfiles[e.id] = X.perfil(m, c); });
    const abre = X.horaDe(m, sig.n - 1) + X.C.APLICAR_SEG * 1000, cierra = sig.cierre;
    lista(m).forEach(P => {
      const d = m.duenos[P.id]; if (!P.apuesta || !d || !P.activo) return;
      const rng = X.crearRng(m.semilla, "npc", "apuesta", P.id, sig.n);
      if (rng.f() > P.apuesta.prob) return;
      let sel = elegir(P, pub, perfiles, m, X);
      if (Array.isArray(sel)) sel = rng.pick(sel);
      if (!sel) return;
      const monto = Math.floor(P.apuesta.monto * escala * (0.7 + 0.6 * rng.f()));
      if (monto < 1 || d.saldo - monto < (P.reserva || 0)) return;
      d.saldo = redondea(d.saldo - monto, 2);
      const hora = Math.round(abre + rng.f() * Math.max(1000, cierra - abre - 20000));
      sig.tribuna.push({ npc: P.id, quien: nombreCorto(P), sel: sel.id, criatura: sel.nombre, monto, hora });
      sig.pozoNpc[sel.id] = (sig.pozoNpc[sel.id] || 0) + monto;
    });
    sig.tribuna.sort((a, b) => a.hora - b.hora);
  }

  /* ---------------------------------------------------------------- al aplicar el resultado: cobran los que aciertan y se cuentan las victorias */
  function liquidar(m, X, prog, res, ev) {
    if (!m.npc) return;
    const rng = X.crearRng(m.semilla, "npc", "resultado", res.n);
    const ganador = res.llegada[0].id;
    let noticias = 0;
    const MAXN = general(m).noticias;
    // victorias de las criaturas de los personajes
    const gc = X.buscar(m, ganador), PG = gc && persona(m, gc.dueno);
    const grande = X.GRADOS[res.grado] && (X.GRADOS[res.grado].copa || res.grado === "gran");
    if (PG && PG.cuadra && noticias < MAXN && (grande || rng.f() < AJUSTE.PROB_NOTICIA_VICTORIA)) { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `Gana la cuadra de ${nombreCorto(PG)}`, `${gc.nombre}, de ${PG.cuadra}, se lleva ${res.nombre}. ${frase(PG, "gana", rng)}`, [gc.id], res.n)); }
    // el pozo: lo apostado por los jugadores (ev.pozoReal, que lo trae el servidor) y por la tribuna, más el bote de la casa, menos la retención, entre quienes aciertan
    const tribuna = prog.tribuna || []; if (!tribuna.length) return;
    const real = ev.pozoReal || {}, npc = prog.pozoNpc || {};
    const total = suma(real) + suma(npc), base = Number(real[ganador] || 0) + Number(npc[ganador] || 0);
    const bolsa = (total + X.C.POZO_BOTE) * (1 - X.C.POZO_RETENCION);
    const mayores = [];
    tribuna.forEach(b => {
      const d = m.duenos[b.npc]; if (!d) return;
      if (b.sel === ganador && base > 0) {
        const pago = redondea(Math.max(b.monto, bolsa * b.monto / base), 2);
        d.saldo = redondea(d.saldo + pago, 2); mayores.push({ b, ganada: true, neto: pago - b.monto });
      } else mayores.push({ b, ganada: false, neto: -b.monto });
    });
    // una noticia como mucho: la apuesta más gorda ganada, o la más gorda perdida si nadie acertó
    mayores.sort((a, b) => (b.ganada - a.ganada) || Math.abs(b.neto) - Math.abs(a.neto));
    const top = mayores[0];
    const P = top && persona(m, top.b.npc);
    if (top && P && noticias < MAXN && (top.ganada ? top.neto >= 35 && rng.f() < 0.3 : top.b.monto >= 25 && rng.f() < 0.15)) {
      if (top.ganada) ev.noticias.push(X.noticia(m, "tribuna", `${nombreCorto(P)} acierta en el pozo`, `${P.nombre} puso ${top.b.monto} tokens a ${top.b.criatura} en ${res.nombre} y se lleva ${redondea(top.neto + top.b.monto, 0)}. ${frase(P, "ganaApuesta", rng)}`, [top.b.sel], res.n));
      else ev.noticias.push(X.noticia(m, "tribuna", `${nombreCorto(P)} pierde su apuesta`, `${P.nombre} había puesto ${top.b.monto} tokens a ${top.b.criatura} en el pozo de ${res.nombre}. ${frase(P, "pierdeApuesta", rng)}`, [top.b.sel], res.n));
    }
  }

  /* ---------------------------------------------------------------- al terminar avanzar(): lo de los NPC no sale del mundo */
  /* Los pagos y avisos que generó el motor para dueños virtuales (premios, devoluciones de inscripción, entrenamientos) se quedan en su cartera:
     no hay billetera de jugador detrás ni a quién avisar. */
  function cerrar(m, ev) {
    if (!m.npc) return;
    ev.pagos = ev.pagos.filter(p => {
      if (!esNpc(p.dueno)) return true;
      const d = m.duenos[p.dueno]; if (d) d.saldo = redondea(d.saldo + p.monto, 2);
      return false;
    });
    ev.avisos = ev.avisos.filter(a => !esNpc(a.dueno));
  }

  /* Lo que se enseña de ellos en cada programa: quién es cada uno (puede haberlo cambiado el Admin), qué criaturas tiene y cuánto hay en su cartera */
  function publico(m) {
    if (!m.npc) return [];
    return lista(m).map(P => {
      const d = m.duenos[P.id]; if (!d) return null;
      return { id: P.id, nombre: P.nombre, apodo: P.apodo, cuadra: P.cuadra, lema: P.lema, bio: P.bio, activo: P.activo && general(m).activo, saldo: Math.round(d.saldo),
        criaturas: m.vivos.concat(m.criadores).filter(c => c.dueno === P.id).map(c => c.id) };
    }).filter(Boolean);
  }

  /* ---------------------------------------------------------------- las órdenes del Admin (dar o quitar tokens o criaturas, vender, préstamo, reiniciar) */
  /* Cada orden lleva el id de la fila de la tabla (crece siempre): m.npc.ultimaOrden recuerda hasta cuál se aplicó, así que repetir el paso no las repite. */
  function ordenes(m, X, pendientes) {
    const out = { resultados: [], perfiles: [] };
    if (!pendientes || !pendientes.length) return out;
    const ev = { cambios: new Set(), noticias: [] };
    pendientes.slice().sort((a, b) => a.id - b.id).forEach(o => {
      const res = { oid: o.id };
      const falla = t => { res.ok = false; res.error = t; out.resultados.push(res); };
      const bien = t => { res.ok = true; res.texto = t; out.resultados.push(res); };
      const ultima = (m.npc && m.npc.ultimaOrden) || 0;
      if (o.id <= ultima) return bien("Ya estaba aplicada.");
      if (!m.npc) return falla("Los personajes todavía no han llegado al hipódromo.");
      const P = persona(m, o.npc), d = P && m.duenos[P.id];
      if (!P) return falla("Ese personaje no existe.");
      if (!d) return falla("Ese personaje todavía no ha llegado al hipódromo.");
      const suyas = () => X.cuadraDe(m, P.id);
      const soltarlas = lista_ => { lista_.forEach(c => { soltar(c); ev.cambios.add(c.id); }); return lista_.length; };
      const monto = Number(o.monto);
      try {
        switch (o.tipo) {
          case "caja": {
            if (!Number.isFinite(monto)) return falla("Falta el importe.");
            const antes = d.saldo; d.saldo = redondea(num(o.modo === "fijar" ? monto : d.saldo + monto, 0, 10000000, d.saldo), 2);
            m.npc.ultimaOrden = o.id; return bien(`La caja de ${P.nombre} pasa de ${redondea(antes, 0)} a ${redondea(d.saldo, 0)} tokens.`);
          }
          case "dar": {
            const c = X.buscar(m, Number(o.criatura));
            if (!c || m.vivos.indexOf(c) < 0 || c.estado !== "activo") return falla("Esa criatura no está en pista.");
            if (c.dueno) return falla("Esa criatura ya tiene dueño.");
            if (suyas().length >= X.C.MAX_CABALLOS) return falla(`${P.nombre} ya tiene ${X.C.MAX_CABALLOS} criaturas.`);
            c.dueno = P.id; c.entradas = []; c.tactica = P.tactica || null; ev.cambios.add(c.id);
            m.npc.ultimaOrden = o.id; return bien(`${c.nombre} pasa a la cuadra de ${P.nombre}.`);
          }
          case "quitar": {
            const c = suyas().find(x => x.id === Number(o.criatura));
            if (!c) return falla("Esa criatura no es suya.");
            soltarlas([c]); m.npc.ultimaOrden = o.id; return bien(`${c.nombre} vuelve al mundo.`);
          }
          case "soltar": { const n = soltarlas(suyas()); m.npc.ultimaOrden = o.id; return bien(`${n} ${n === 1 ? "criatura vuelve" : "criaturas vuelven"} al mundo.`); }
          case "vender": {
            const c = suyas().find(x => x.id === Number(o.criatura));
            if (!c) return falla("Esa criatura no es suya.");
            if (m.proxima && m.proxima.entrantes.some(e => e.id === c.id)) return falla("Está inscrita en la carrera de ahora; espera a que termine.");
            const saldos = {}; saldos[P.id] = d.saldo;
            const r = X.procesarOrdenes(m, [{ oid: 1, dueno: P.id, tipo: "vender", id: c.id }], saldos);
            if (!r.resultados[0].ok) return falla(r.resultados[0].error);
            d.saldo = redondea(saldos[P.id], 2); ev.cambios.add(c.id);
            m.npc.ultimaOrden = o.id; return bien(`${P.nombre} vende a ${c.nombre} a la casa por ${r.resultados[0].ingreso} tokens.`);
          }
          case "prestamo": {
            if (!P.prestamo) return falla("Ese personaje no pide préstamos (no tiene préstamo configurado).");
            d.saldo = redondea(d.saldo + P.prestamo.monto, 2); m.npc.ultimaOrden = o.id; return bien(`El banco adelanta ${P.prestamo.monto} tokens a ${P.nombre}.`);
          }
          case "reiniciar": {
            const n0 = soltarlas(suyas()); delete m.duenos[P.id];
            const n1 = fundarUna(m, X, P, ev);
            m.npc.ultimaOrden = o.id; return bien(`${P.nombre} empieza de nuevo: caja de ${P.inicio.saldo} tokens y ${n1} ${n1 === 1 ? "criatura" : "criaturas"} (soltó ${n0}).`);
          }
          default: return falla("Esa orden no existe.");
        }
      } catch (e) { return falla("No se pudo aplicar: " + (e && e.message || e)); }
    });
    // la última orden vista cuenta aunque haya fallado (para no volver a intentarla en el siguiente paso)
    if (m.npc) m.npc.ultimaOrden = Math.max(m.npc.ultimaOrden || 0, ...pendientes.map(o => o.id));
    [...ev.cambios].forEach(id => { const c = X.buscar(m, id); if (c) out.perfiles.push(X.perfil(m, c)); });
    return out;
  }

  raiz.HipodromoNPC = { REPARTO, PERSONAJE, AJUSTE, ENUMS, FRASES_TIPOS, ID_NPC, esNpc, sanear, mezcla, efectiva, configurar, lista, persona, general, iniciar, turno, acepta, apuestas, liquidar, cerrar, publico, ordenes };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.HipodromoNPC;
})(typeof window !== "undefined" ? window : globalThis);
