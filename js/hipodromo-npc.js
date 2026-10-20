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
  /* Cada personaje: quién es (nombre, apodo, cuadra, lema, bio), con qué empieza (inicio), cómo juega (reserva, ganas, descanso, fatigaMax, grados, dist, copas,
     cuida, entrena, stat, tactica, compra, vende, prestamo), cómo apuesta (apuesta) y qué dice (frases). */
  const REPARTO = [
    {
      id: "npc:remedios", nombre: "Doña Remedios Calzada", apodo: "la Contadora", cuadra: "Cuadra Calzada e Hijos",
      lema: "Cada token tiene un trabajo, y el que no trabaja se va.",
      bio: "Viuda de un tratante de forrajes y dueña de un libro de cuentas que nadie ha visto abierto. Nunca inscribe a una criatura cansada, nunca paga de más y vende en cuanto una deja de dar cuentas. Apuesta poco y casi siempre a la favorita.",
      inicio: { saldo: 1500, tipo: "media", n: 2 },
      reserva: 400, tope: 9000, gasto: 1.5, grados: { gran: 0.3, selecta: 0.8, corriente: 1, novatos: 0.2 }, copas: 0.6, dist: null,
      cuida: null, entrena: 0.005, stat: "debil", tactica: "media", compra: { prob: 0.04, criterio: "baratas", tamano: 3 }, vende: true, prestamo: null, hora: 5,
      apuesta: { estilo: "favorita", prob: 0.5, monto: 12, maxCuota: 3.4 },
      frases: {
        compra: ["Barata y con buenas patas. Eso no lo da cualquiera.", "Lo apunto en el libro: una boca más, pero con dientes de ganadora."],
        vende: ["Esa ya no me deja cuentas. Cada token tiene que trabajar.", "Se vende. Las que no pagan su avena se buscan otro establo."],
        gana: ["Ganar está bien. Ganar sin gastar de más es lo que cuenta.", "Anotado. Y cobrado."],
        ganaApuesta: ["Pequeña, segura y mía."], pierdeApuesta: ["Se pierde algo. Se anota y se sigue."], prestamo: ["Otro préstamo. Lo devolveré con intereses, como siempre."]
      }
    },
    {
      id: "npc:marques", nombre: "Anselmo de Vallecuervo", apodo: "el Marqués", cuadra: "Casa de Vallecuervo",
      lema: "Mis criaturas no corren: se dignan.",
      bio: "Último de una familia que lo perdió casi todo menos el apellido. Solo se mueve entre Grandes Premios y copas, exige que sus criaturas salgan primeras y apuesta siempre por la suya, la gane o no. No vende nada.",
      inicio: { saldo: 9000, tipo: "elite", n: 3 },
      reserva: 800, tope: 20000, gasto: 7, grados: { gran: 1, selecta: 0.5, corriente: 0, novatos: 0 }, copas: 1, dist: "larga",
      cuida: null, entrena: 0.005, stat: "vel", tactica: "frente", compra: { prob: 0.02, criterio: "flechas", tamano: 3 }, vende: false, prestamo: { piso: 1200, monto: 3000 }, hora: 9,
      apuesta: { estilo: "vanidad", prob: 0.85, monto: 40 },
      frases: {
        compra: ["Tiene porte. Aceptable para mis establos.", "Me recuerda a una que tuvo mi abuelo. Con eso basta."],
        vende: ["Los Vallecuervo no venden. Esto es una cesión."],
        gana: ["Un trámite. Mis criaturas no corren, se dignan.", "Que conste que no hizo falta esforzarse."],
        ganaApuesta: ["Naturalmente. Había que apoyarla."], pierdeApuesta: ["Un error de la pista, no de mi criterio."], prestamo: ["Un adelanto de la herencia. Que nadie lo comente."]
      }
    },
    {
      id: "npc:pez", nombre: "Tano y Berta Pez", apodo: "los Pez", cuadra: "Cuadra Los Pez",
      lema: "¡Tú inscribe, que ya veremos!",
      bio: "Dos hermanos que inscriben a todo lo que se tiene en pie, cuidan poco y viven pidiendo préstamos al banco, que ya los conoce por el nombre. Apuestan a las que nadie quiere porque les parece que alguien tiene que hacerlo.",
      inicio: { saldo: 500, tipo: "baja", n: 3 },
      reserva: 60, tope: 2500, gasto: 3, grados: { gran: 0, selecta: 0.1, corriente: 0.7, novatos: 1 }, copas: 0, dist: "corta",
      cuida: null, entrena: 0.003, stat: "debil", tactica: null, compra: { prob: 0.08, criterio: "baratisimas", tamano: 3 }, vende: true, prestamo: { piso: 150, monto: 400 }, hora: 14,
      apuesta: { estilo: "longshots", prob: 0.5, monto: 6, minCuota: 9 },
      frases: {
        compra: ["¡Qué barata! ¡Nos la llevamos, Berta!", "Esa tiene cara de ganar algún día. Algún día."],
        vende: ["¡Hay que pagar la luz, Tano!", "Se va. Pero con cariño."],
        gana: ["¡Ganamos! ¡Que alguien avise al banco!", "¡Lo dijimos! ¿Quién lo dijo? ¡Nosotros!"],
        ganaApuesta: ["¡La del doce a uno! ¡La del doce a uno!"], pierdeApuesta: ["Otra vez será. Berta, ¿tienes algo suelto?"], prestamo: ["El banco nos quiere mucho. Nos presta otra vez."]
      }
    },
    {
      id: "npc:hilda", nombre: "Madre Hilda de la Escarcha", apodo: "la Madre Escarcha", cuadra: "Convento de la Escarcha",
      lema: "A los hijos no se les vende: se les enseña.",
      bio: "Priora de un convento de las tierras frías que cría criaturas jóvenes con mucha avena y mucha paciencia. Las cuida a la menor señal de cansancio, las entrena sin descanso y no se separa de ninguna. No apuesta, solo reza.",
      inicio: { saldo: 1800, tipo: "joven", n: 3 },
      reserva: 500, tope: 6000, gasto: 2, grados: { gran: 0, selecta: 0.5, corriente: 1, novatos: 1 }, copas: 0.4, dist: null,
      cuida: 40, entrena: 0.01, stat: "debil", tactica: null, compra: { prob: 0.03, criterio: "jovenes", tamano: 3 }, vende: false, prestamo: null, hora: 20,
      apuesta: null,
      frases: {
        compra: ["Una más para la casa. Se le dará de comer y se le enseñará.", "Llega con frío. Aquí se le quita."],
        vende: ["Las hijas de este convento no se venden."],
        gana: ["La avena y la paciencia. No hay más secreto.", "Que se le dé doble ración esta noche."],
        ganaApuesta: [], pierdeApuesta: [], prestamo: ["La orden ha tenido que pedir limosna al banco."]
      }
    },
    {
      id: "npc:cuervo", nombre: "Cuervo Salgado", apodo: "el Tahúr", cuadra: "Cuadra del Cuervo",
      lema: "La casa siempre gana, salvo la que yo elijo.",
      bio: "Jugador de oficio con una sola criatura y mucha paciencia. Vive del pozo: mira dónde no mira nadie y apuesta fuerte cuando la cuota le parece mal puesta. Habla poco y nunca explica.",
      inicio: { saldo: 1200, tipo: "uno", n: 1 },
      reserva: 120, tope: 5000, gasto: 3, grados: { gran: 0.4, selecta: 1, corriente: 0.6, novatos: 0 }, copas: 0.5, dist: null,
      cuida: null, entrena: 0.01, stat: "debil", tactica: "atras", compra: { prob: 0.01, criterio: "valor", tamano: 2 }, vende: true, prestamo: { piso: 350, monto: 600 }, hora: 2,
      apuesta: { estilo: "valor", prob: 0.7, monto: 30 },
      frases: {
        compra: ["Me gustó la cara.", "Los números dicen que sí. Los números no se equivocan: se aplazan."],
        vende: ["Las cuentas no cuadraban. Se vende."],
        gana: ["La casa siempre gana. Hoy la casa era yo.", "Sin prisa. Esto es un oficio."],
        ganaApuesta: ["Las cuentas salen cuando miras donde no mira nadie."], pierdeApuesta: ["Perder es el precio de la entrada."], prestamo: ["Una mala racha. Se paga y se sigue."]
      }
    },
    {
      id: "npc:ludmila", nombre: "Ludmila Voss", apodo: "la Estratega", cuadra: "Haras Voss",
      lema: "No se corre contra los demás: se corre contra el trazado.",
      bio: "Criadora de las tierras altas que lee las pistas como otros leen cartas. Prefiere las distancias largas y las pistas arcanas, entrena la resistencia y apuesta cuando el terreno le da la razón a una criatura.",
      inicio: { saldo: 2500, tipo: "largas", n: 3 },
      reserva: 500, tope: 12000, gasto: 4, grados: { gran: 0.6, selecta: 1, corriente: 0.7, novatos: 0 }, copas: 0.8, dist: "larga",
      cuida: null, entrena: 0.012, stat: "res", tactica: "media", compra: { prob: 0.02, criterio: "largas", tamano: 3 }, vende: true, prestamo: { piso: 500, monto: 900 }, hora: 17,
      apuesta: { estilo: "terreno", prob: 0.5, monto: 15 },
      frases: {
        compra: ["Larga de pecho. El trazado hará el resto.", "Buenas piernas para las curvas. Eso se enseña. El pulmón, no."],
        vende: ["No encaja en mi método. Se vende."],
        gana: ["No se corre contra los demás: se corre contra el trazado.", "Conforme al plan."],
        ganaApuesta: ["El terreno lo decía. Solo había que leerlo."], pierdeApuesta: ["Un dato no es una garantía. Revisaré el método."], prestamo: ["Inversión en el haras. Con recibo."]
      }
    },
    {
      id: "npc:pocho", nombre: "Pocho Arango", apodo: "el Optimista", cuadra: null,
      lema: "¡Quien gana una vez, gana dos!",
      bio: "Aficionado de la grada que cree en las rachas como otros en los santos. Apuesta un poco cada hora a la criatura que viene ganando y, si no hay ninguna, no apuesta, que él no es un aventurero.",
      inicio: { saldo: 300, tipo: null, n: 0 }, reserva: 0, tope: 700, grados: {}, copas: 0, prestamo: { piso: 20, monto: 60 }, hora: 7,
      apuesta: { estilo: "racha", prob: 0.7, monto: 8 },
      frases: { ganaApuesta: ["¡Racha, amigos, racha!"], pierdeApuesta: ["La racha solo estaba descansando."], prestamo: ["Mi cuñado me adelanta el sueldo."] }
    },
    {
      id: "npc:pilar", nombre: "Doña Pilar Ferrer", apodo: "la Supersticiosa", cuadra: null,
      lema: "Siempre el siete. Si no hay siete, el tres.",
      bio: "Vecina de toda la vida que va a la grada con su amuleto y su pañuelo. Apuesta a la puerta de la suerte, siete o, si no la hay, tres, y se santigua antes de que salgan. Lleva años sin que le falle el pañuelo.",
      inicio: { saldo: 250, tipo: null, n: 0 }, reserva: 0, tope: 600, grados: {}, copas: 0, prestamo: { piso: 15, monto: 50 }, hora: 11,
      apuesta: { estilo: "puerta", prob: 0.6, monto: 7, puertas: [7, 3] },
      frases: { ganaApuesta: ["¡El siete! ¡Siempre el siete!"], pierdeApuesta: ["Alguien me miró mal. Fue eso."], prestamo: ["Vendo unas puntillas y listo."] }
    }
  ];
  const PERSONAJE = {}; REPARTO.forEach(p => { PERSONAJE[p.id] = p; });

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
  /* Se hace una sola vez, cuando el mundo ya ha corrido lo suficiente para saber qué criaturas son buenas. Reparte criaturas del mundo y abre las carteras. */
  function iniciar(m, X, ev) {
    if (m.npc || !m.proxima || m.stats.carreras < AJUSTE.FUNDAR_DESDE) return;
    m.npc = { v: 1, fundadas: m.n };
    if (!m.duenos) m.duenos = {};
    const rng = X.crearRng(m.semilla, "npc", "fundar");
    const lista = [];
    REPARTO.forEach(P => {
      m.duenos[P.id] = { nombre: P.nombre, npc: true, adoptada: true, saldo: P.inicio.saldo, cuadra: P.cuadra || null };
      const k = P.inicio.n; if (!k) return;
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
      lista.push(`${P.nombre} (${P.apodo}) abre ${P.cuadra} con ${elegidas.length} ${elegidas.length === 1 ? "criatura" : "criaturas"}`);
    });
    const apostadores = REPARTO.filter(P => !P.cuadra).map(P => `${P.nombre} (${P.apodo})`);
    ev.noticias.push(X.noticia(m, "cuadra", "Nuevas caras en el hipódromo", `Llegan a las cuadras y a la grada: ${lista.join("; ")}. Y en la tribuna, ${apostadores.join(" y ")}. Cada uno juega a su manera.`, []));
  }

  /* ---------------------------------------------------------------- el turno de cada personaje: órdenes antes de programar la carrera */
  function turno(m, X, ev) {
    if (!m.npc) return;
    const C = X.C, cal = X.calendarioVisible(m).filter(x => x.n > m.n);
    const ratings = m.vivos.filter(c => c.estado === "activo" && X.edadAnios(m.n, c) >= C.DEBUT).map(c => c.rating);
    const puesto = c => ratings.filter(r => r > c.rating).length / Math.max(1, ratings.length);   // 0 = la mejor del mundo, 1 = la peor
    const tomadas = {};          // plazas que los NPC se han llevado en este turno, para dejar sitio a los jugadores aunque varios elijan la misma carrera
    let noticias = 0;
    REPARTO.forEach(P => {
      const d = m.duenos[P.id]; if (!d) return;
      const rng = X.crearRng(m.semilla, "npc", P.id, m.n);
      // préstamo: una vez al día (a la hora que le toca a cada uno) si la cartera está por debajo de su mínimo
      if (P.prestamo && m.n % 24 === P.hora && d.saldo < P.prestamo.piso) {
        d.saldo += P.prestamo.monto;
        if (noticias < AJUSTE.MAX_NOTICIAS && rng.f() < AJUSTE.PROB_NOTICIA_PRESTAMO) { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${P.nombre} pide otro préstamo`, `${nombreCorto(P)} se ha quedado sin tokens y el banco le adelanta ${P.prestamo.monto}. ${frase(P, "prestamo", rng)}`, [])); }
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
        if (!r.ok || noticias >= AJUSTE.MAX_NOTICIAS) return;
        const c = o.id != null ? X.buscar(m, o.id) : null; if (!c) return;
        if (o.tipo === "comprar") { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${nombreCorto(P)} ficha a ${c.nombre}`, `${P.nombre} se lleva a ${c.nombre} para ${P.cuadra} por ${r.costo} tokens. ${frase(P, "compra", rng)}`, [c.id])); }
        else if (o.tipo === "vender") { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `${nombreCorto(P)} se desprende de ${c.nombre}`, `${P.nombre} vende a ${c.nombre} a la casa por ${r.ingreso} tokens. ${frase(P, "vende", rng)}`, [c.id])); }
      });
    });
  }

  /* Los entrenadores del mundo arman cada campo con las criaturas de su nivel; las de un personaje entran en ese reparto si su dueño acepta la categoría y la
     distancia (el Marqués no mete a las suyas en Novatos; los Pez huyen de las distancias largas). Una preferencia de 0,6 es «aceptarla 6 de cada 10 veces». */
  function acepta(m, X, c, grado, dist, n) {
    const P = PERSONAJE[c.dueno]; if (!P || !grado) return true;
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
    if (!m.npc || sig.suspendida || !AJUSTE.ESCALA_APUESTAS) return;
    const pub = X.programaPublico(sig);                 // solo lo público: sin el resultado ni las probabilidades reales
    const perfiles = {}; pub.entrantes.forEach(e => { const c = X.buscar(m, e.id); if (c) perfiles[e.id] = X.perfil(m, c); });
    const abre = X.horaDe(m, sig.n - 1) + X.C.APLICAR_SEG * 1000, cierra = sig.cierre;
    REPARTO.forEach(P => {
      const d = m.duenos[P.id]; if (!P.apuesta || !d) return;
      const rng = X.crearRng(m.semilla, "npc", "apuesta", P.id, sig.n);
      if (rng.f() > P.apuesta.prob) return;
      let sel = elegir(P, pub, perfiles, m, X);
      if (Array.isArray(sel)) sel = rng.pick(sel);
      if (!sel) return;
      const monto = Math.floor(P.apuesta.monto * AJUSTE.ESCALA_APUESTAS * (0.7 + 0.6 * rng.f()));
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
    // victorias de las criaturas de los personajes
    const gc = X.buscar(m, ganador), PG = gc && PERSONAJE[gc.dueno];
    const grande = X.GRADOS[res.grado] && (X.GRADOS[res.grado].copa || res.grado === "gran");
    if (PG && PG.cuadra && (grande || rng.f() < AJUSTE.PROB_NOTICIA_VICTORIA)) { noticias++; ev.noticias.push(X.noticia(m, "cuadra", `Gana la cuadra de ${nombreCorto(PG)}`, `${gc.nombre}, de ${PG.cuadra}, se lleva ${res.nombre}. ${frase(PG, "gana", rng)}`, [gc.id], res.n)); }
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
    if (top && noticias < AJUSTE.MAX_NOTICIAS && (top.ganada ? top.neto >= 35 && rng.f() < 0.3 : top.b.monto >= 25 && rng.f() < 0.15)) {
      const P = PERSONAJE[top.b.npc];
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

  /* Lo que se enseña de ellos en cada programa: quién tiene qué criaturas y cuánto hay en su cartera */
  function publico(m) {
    if (!m.npc) return [];
    return REPARTO.map(P => { const d = m.duenos[P.id]; return d ? { id: P.id, saldo: Math.round(d.saldo), criaturas: m.vivos.concat(m.criadores).filter(c => c.dueno === P.id).map(c => c.id) } : null; }).filter(Boolean);
  }

  raiz.HipodromoNPC = { REPARTO, PERSONAJE, AJUSTE, esNpc, iniciar, turno, acepta, apuestas, liquidar, cerrar, publico };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.HipodromoNPC;
})(typeof window !== "undefined" ? window : globalThis);
