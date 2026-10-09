/* =============================================================================
   CARTAS MALDITAS — motor del combate. Reglas puras, sin pantalla: el estado de
   una partida es un objeto JSON y cada acción lo cambia de forma determinista
   (el azar sale de una semilla guardada en el propio estado). Por eso en una
   partida entre dos jugadores basta con guardar la lista de acciones: cada
   navegador las repite en orden y llega al mismo resultado.

   Reglas:
   - 20 de vida. Mazo de 20 a 30 cartas, con una sola copia de cada personaje
     (salvo excepciones) y de 1 a 3 de las demás según su rareza. Se roban 5 al
     empezar (el segundo jugador roba 1 más).
   - La energía máxima sube 1 en cada turno propio, hasta 10, y se rellena.
   - Un turno: robas una carta, juegas cartas pagando su coste y atacas con tus
     unidades. Una unidad que entra no puede atacar hasta tu siguiente turno.
   - Atacar (como en Legends of Runeterra): una sola vez por turno, declaras a la vez
     todas las unidades que atacan. Después el rival elige quién bloquea: cada unidad
     suya bloquea como mucho a un atacante y cada atacante recibe como mucho un
     bloqueador. Los bloqueados se hacen daño a la vez (Veloz golpea antes); los que
     nadie bloquea golpean al jugador. Desafiante: al atacar, elige qué unidad
     enemiga tiene que bloquearla (aunque vuele o no pueda bloquear). Una unidad
     marcada es Vulnerable para quien la marcó: cualquiera de sus atacantes puede
     desafiarla. Provocar (regla propia): los desafíos deben apuntar antes a una
     unidad con Provocar, salvo contra una marcada o con el Puente de las Legiones. Volar: solo la bloquean unidades que vuelan.
     Temible: no la bloquean unidades con menos de 3 de ataque. Arrollar: el daño
     que sobra tras matar al bloqueador pasa al jugador. Barrera: ignora el
     primer daño que reciba. Duro: recibe 1 menos de daño. Esquivo: en combate
     recibe la mitad del daño (redondeado hacia abajo). Escurridizo (regla propia):
     ni los desafíos ni las habilidades enemigas pueden elegirla. Fuerza Helénica: contra una
     unidad hace tanto daño como vida tenga, sin ignorar sus resistencias.
   - Máximo 10 unidades en tu campo y 8 cartas en la mano. Sin cartas en el mazo,
     cada robo hace daño creciente (fatiga).
   - Un terreno a la vez: jugar uno nuevo reemplaza al anterior.
   - Vínculos y rivalidades (js/cartas-vinculos.js): algunas cartas se refuerzan al estar juntas en tu campo
     (según quién se conoce con quién y qué tal se llevan), y otras tienen una rivalidad secreta que se
     activa cuando una está en tu campo y su rival en el del contrario.
   - Reacciones: cartas que se juegan en el turno del rival, como respuesta a un
     ataque contra una unidad suya o a una carta que él juega. Se pagan con la
     energía que te sobró. Si no tienes ninguna aplicable, no hay espera.

   Las habilidades de cada carta están en js/cartas-efectos.js. Una carta sin
   efecto registrado juega solo con sus números.
============================================================================= */
(function (raiz) {
  const C = { VIDA: 20, MANO_INICIAL: 5, MANO_MAX: 8, CAMPO_MAX: 10, ENERGIA_MAX: 10, MAZO_MIN: 20, MAZO_MAX: 30 };
  const TIPOS_UNIDAD = ["Personaje", "Criatura", "Entidad"];
  const TOPE_COPIAS = { comun: 3, infrecuente: 3, rara: 2, legendaria: 1, limitada: 1 };
  /* Copias de una carta que caben en un mazo: los personajes van de a uno (salvo que la carta tenga su propia
     excepción, copiasMax de 1 a 3); las demás cartas, según su rareza. En la colección se pueden tener todas las
     copias que se quiera (para apostarlas o intercambiarlas); lo que limita es el mazo. */
  const topeCopias = c => (Number.isFinite(c.copiasMax) && c.copiasMax >= 1 ? Math.min(3, c.copiasMax)
    : c.tipo === "Personaje" ? 1 : (TOPE_COPIAS[c.rareza] || 1));

  const TOKENS = {
    centinela: { id: "centinela", nombre: "Centinela", tipo: "Criatura", rareza: "comun", afinidad: ["eternidad"], coste: 0, atq: 1, pv: 1, habilidad: "", token: true },
    "resto-barro": { id: "resto-barro", nombre: "Resto de barro", tipo: "Criatura", rareza: "comun", afinidad: ["eternidad"], coste: 0, atq: 1, pv: 4, habilidad: "Cuerpo de barro: aguanta mucho, pega poco.", token: true },
    "resto-piedra": { id: "resto-piedra", nombre: "Resto de piedra", tipo: "Criatura", rareza: "comun", afinidad: ["eternidad"], coste: 0, atq: 2, pv: 3, habilidad: "Cuerpo de piedra: reduce en 1 el daño que recibe.", token: true },
    "resto-madera": { id: "resto-madera", nombre: "Resto de madera", tipo: "Criatura", rareza: "comun", afinidad: ["eternidad"], coste: 0, atq: 3, pv: 2, habilidad: "Cuerpo de madera: ligero y quebradizo.", token: true }
  };

  const EFECTOS = {};
  const TERRENOS = {};
  const VINC = { circulos: [], rivalidades: [] };   // vínculos entre cartas (js/cartas-vinculos.js)

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
  // Es una reacción si su tipo lo dice o si su efecto es de reacción (aunque alguien la haya guardado con otro tipo)
  const esReaccion = (est, id) => meta(est, id).tipo === "Reacción" || !!(EFECTOS[id] && EFECTOS[id].reaccion);

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
    a += bonosDe(est, u).atq;
    est.jugadores[u.dueno].campo.forEach(o => {
      if (o.uid === u.uid) return;
      const eo = efectoDe(est, o);
      if (eo.auraAtq) a += eo.auraAtq(est, o, u) || 0;
    });
    const J = est.jugadores[u.dueno];
    if (J.malus && est.turno <= J.malus.hasta) a += J.malus.atq;
    return Math.max(0, a);
  }

  /* Palabras clave: las de la carta, más las que da el terreno (Los Huesos: Volar a las unidades de Sombra
     de su dueño). Provocar y Volar se pueden perder un tiempo (flags.sinProvocarHasta, sinVolarHasta). */
  function tienePalabra(est, u, palabra) {
    if (palabra === "provocar" && u.flags.sinProvocarHasta >= est.turno) return false;
    if (palabra === "volar" && u.flags.sinVolarHasta >= est.turno) return false;
    const bv = bonosDe(est, u);
    if (bv.quita.includes(palabra)) return false;
    if (bv.palabras.includes(palabra)) return true;
    const ef = efectoDe(est, u);
    if ((ef.palabras || []).includes(palabra)) return true;
    const T = est.terreno;
    if (T && T.dueno === u.dueno && palabra === "volar" && T.cartaId === "los-huesos" && (meta(est, u.cartaId).afinidad || []).includes("sombra")) return true;
    // Otros terrenos que dan una palabra a las unidades de su dueño (Fauces Grises: Desafiante a las de Cacería)
    const D = defTerreno(est);
    if (T && D && D.daPalabra && T.dueno === u.dueno && D.daPalabra(est, u, palabra)) return true;
    return false;
  }

  /* Marcada: Vulnerable para quien la marcó. Puede ser para siempre (Verdam) o hasta el final de un turno
     (flags.marcadaHasta, Victor). Devuelve el jugador que la marcó, o null. */
  function marcadaVigente(est, u) {
    if (u.flags.marcadaPor === null || u.flags.marcadaPor === undefined) return null;
    if (u.flags.marcadaHasta && u.flags.marcadaHasta < est.turno) return null;
    return u.flags.marcadaPor;
  }

  function costeDe(est, jIdx, id) {
    const m = meta(est, id);
    let c = m.coste || 0;
    c -= est.jugadores[jIdx].costeMenos || 0;
    const T = defTerreno(est);
    if (T && T.costeMod) c += T.costeMod(est, jIdx, m) || 0;
    // Unidades que abaratan cartas (Mercader: los Objetos)
    est.jugadores[jIdx].campo.forEach(u => { const e = EFECTOS[u.cartaId]; if (e && e.costeMod) c += e.costeMod(est, u, m) || 0; });
    return Math.max(0, c);
  }

  /* --- Vínculos y rivalidades -------------------------------------------------------
     Datos en js/cartas-vinculos.js. Todo se calcula mirando los dos campos, así que no hay que guardar nada:
     - Círculo (o lazo, si son dos): cada carta miembro gana el bono del nivel más alto que alcance el número
       de miembros distintos que haya en SU campo. `completo` suma otro bono si están todos los de `requiere`.
     - Rivalidad: una unidad del `bando` en un campo y una de `contra` en el contrario (secreta: la carta no
       lo dice, solo se anuncia en el registro cuando se activa). Cada lado recibe su bono (paraBando, paraContra).
     Un bono puede traer: atq, pv, palabras, quita (palabras que pierde), reduce, guarda (ids de aliadas a las
     que cubre), barrera, y en rivalidades bonusContra, marca, anulaAlMorirContra, alMatarContra, alMorirPropia. */
  const campoIds = J => new Set(J.campo.map(x => x.cartaId));

  function sumarBono(b, x) {
    if (!x) return;
    b.atq += x.atq || 0; b.pv += x.pv || 0; b.reduce += x.reduce || 0;
    (x.palabras || []).forEach(p => b.palabras.push(p));
    (x.quita || []).forEach(p => b.quita.push(p));
    (x.guarda || []).forEach(p => b.guarda.push(p));
    if (x.barrera) b.barrera = true;
  }

  function textoBono(x) {
    const t = [];
    if (x.atq || x.pv) t.push(`${x.atq >= 0 ? "+" : ""}${x.atq || 0}/${(x.pv || 0) >= 0 ? "+" : ""}${x.pv || 0}`);
    if (x.barrera) t.push("Barrera");
    (x.palabras || []).forEach(p => t.push(p));
    return t.join(", ");
  }

  /* Todo lo que los vínculos le dan a esta unidad ahora mismo, y la lista de vínculos activos (para pintarlos) */
  function bonosDe(est, u) {
    const b = { atq: 0, pv: 0, reduce: 0, palabras: [], quita: [], guarda: [], barrera: false, items: [] };
    if (!VINC.circulos.length && !VINC.rivalidades.length) return b;
    const J = est.jugadores[u.dueno], R = est.jugadores[1 - u.dueno];
    const propios = campoIds(J);
    VINC.circulos.forEach(c => {
      if (!c.miembros.includes(u.cartaId)) return;
      const n = c.miembros.filter(id => propios.has(id)).length;
      if (n < 2) return;
      let nivel = -1;
      c.niveles.forEach((t, i) => { if (n >= t.n) nivel = i; });
      const completo = !!(c.completo && c.completo.requiere.every(id => propios.has(id)));
      if (nivel < 0 && !completo) return;
      if (nivel >= 0) { const t = c.niveles[nivel]; sumarBono(b, t); sumarBono(b, t.ind && t.ind[u.cartaId]); }
      if (completo) { sumarBono(b, c.completo); sumarBono(b, c.completo.ind && c.completo.ind[u.cartaId]); }
      const cuentan = nivel >= 0 ? textoBono(c.niveles[nivel]) : "";
      b.items.push({
        clave: `c:${c.id}:${u.dueno}`, firma: `${nivel}|${completo ? 1 : 0}`, tipo: c.tipo || "circulo", id: c.id, nombre: c.nombre, n, completo, texto: c.texto || "",
        aviso: `${c.nombre}: ${n} de ${c.miembros.length} en el campo de ${J.nombre}${cuentan ? ` (${cuentan} a cada miembro)` : ""}${completo ? `. ${c.completo.nombre || "¡Completo!"}` : ""}.`
      });
    });
    VINC.rivalidades.forEach(r => {
      const esBando = r.bando.includes(u.cartaId), esContra = r.contra.includes(u.cartaId);
      if (esBando && R.campo.some(x => r.contra.includes(x.cartaId))) {
        sumarBono(b, r.paraBando);
        b.items.push({ clave: `r:${r.id}:${u.dueno}`, firma: "1", tipo: "rivalidad", id: r.id, nombre: r.nombre, texto: r.texto || "", secreta: true, aviso: `¡Rivalidad! ${nombreDe(est, r.bando, J)} y ${nombreDe(est, r.contra, R)} están frente a frente: se activa «${r.nombre}».` });
      }
      if (esContra && R.campo.some(x => r.bando.includes(x.cartaId))) {
        sumarBono(b, r.paraContra);
        b.items.push({ clave: `r:${r.id}:${1 - u.dueno}`, firma: "1", tipo: "rivalidad", id: r.id, nombre: r.nombre, texto: r.texto || "", secreta: true, aviso: `¡Rivalidad! ${nombreDe(est, r.bando, R)} y ${nombreDe(est, r.contra, J)} están frente a frente: se activa «${r.nombre}».` });
      }
    });
    return b;
  }

  // Nombre de la primera unidad del campo de J cuya carta está en `ids`
  function nombreDe(est, ids, J) {
    const x = J.campo.find(o => ids.includes(o.cartaId));
    return x ? nombre(est, x) : "?";
  }

  /* Daño extra de una unidad contra una rival concreta (rivalidades) */
  function bonusVsRival(est, u, t) {
    if (!VINC.rivalidades.length || u.dueno === t.dueno) return 0;
    let n = 0;
    VINC.rivalidades.forEach(r => {
      if (r.bando.includes(u.cartaId) && r.contra.includes(t.cartaId)) n += (r.paraBando && r.paraBando.bonusContra) || 0;
      if (r.contra.includes(u.cartaId) && r.bando.includes(t.cartaId)) n += (r.paraContra && r.paraContra.bonusContra) || 0;
    });
    return n;
  }

  /* ¿Puede `atk` desafiar a `d` por una rivalidad (aunque haya Provocar)? */
  function marcaPorRivalidad(est, atk, d) {
    return VINC.rivalidades.some(r => r.bando.includes(atk.cartaId) && r.contra.includes(d.cartaId) && r.paraBando && r.paraBando.marca);
  }

  /* Lo que las rivalidades cambian al morir `u` (se mira ANTES de quitarla del campo, mientras la rival sigue ahí):
     anula: la rivalidad que anula su habilidad al morir; recompensas: lo que gana quien la mató; propias: lo que hace ella al caer */
  function rivalidadesAlMorir(est, u, asesino) {
    const out = { anula: null, recompensas: [], propias: [] };
    if (!VINC.rivalidades.length) return out;
    const R = est.jugadores[1 - u.dueno];
    VINC.rivalidades.forEach(r => {
      if (r.contra.includes(u.cartaId) && R.campo.some(x => r.bando.includes(x.cartaId))) {
        if (asesino && asesino.dueno !== u.dueno && r.bando.includes(asesino.cartaId)) {
          if (r.paraBando && r.paraBando.anulaAlMorirContra) out.anula = r;
          if (r.paraBando && r.paraBando.alMatarContra) out.recompensas.push(r);
        }
        if (r.paraContra && r.paraContra.alMorirPropia) out.propias.push(r);
      }
    });
    return out;
  }

  /* Vida y Barrera de los vínculos: se ajustan cuando cambian los campos (entra o cae una unidad), igual que lo
     que da un terreno. El registro avisa solo cuando un vínculo se activa o sube de nivel. */
  function sincronizarVinculos(est) {
    if (!VINC.circulos.length && !VINC.rivalidades.length) return;
    if (!est.vinc) est.vinc = {};
    const vistos = {};
    todas(est).forEach(u => {
      const b = bonosDe(est, u);
      const delta = b.pv - (u.flags.vincPv || 0);
      if (delta !== 0) {
        u.pvMax = Math.max(1, u.pvMax + delta);
        // Al ganar vida del vínculo sube también la actual; al perderla baja lo mismo (nunca por debajo de 1), así no se cura cambiando de compañeros
        u.pv = delta > 0 ? u.pv + delta : Math.max(1, Math.min(u.pv + delta, u.pvMax));
        u.flags.vincPv = b.pv;
      }
      if (b.barrera && !u.flags.vincBarrera) { u.flags.vincBarrera = true; u.flags.barrera = true; }
      b.items.forEach(it => { vistos[it.clave] = it; });
    });
    Object.entries(vistos).forEach(([k, it]) => {
      if (est.vinc[k] !== it.firma) { est.vinc[k] = it.firma; log(est, it.aviso); }
    });
    Object.keys(est.vinc).forEach(k => { if (!(k in vistos)) delete est.vinc[k]; });
  }

  const vinculosActivos = (est, u) => bonosDe(est, u).items;

  /* --- Formas ------------------------------------------------------------------
     Una carta puede tener varias formas o posturas (campo `formas` de la carta: una lista con el nombre, la imagen y
     el encuadre de cada una; la forma 0 es la carta base). La forma en que está una unidad vive en u.flags.forma y
     solo cambia con una habilidad (cambiarForma). Lo único que el motor hace con ella es avisarlo en el registro:
     lo que cambia con cada forma lo decide la carta (pasivaAtq, etc.) y la imagen la elige la pantalla. */
  const formasDe = (est, u) => meta(est, u.cartaId).formas || [];
  const nombreForma = (est, u) => { const k = u.flags.forma || 0; return k > 0 && formasDe(est, u)[k - 1] ? formasDe(est, u)[k - 1].nombre || "" : ""; };
  function cambiarForma(est, u, k, texto) {
    if ((u.flags.forma || 0) === k) return false;
    u.flags.forma = k;
    if (texto) log(est, texto);
    return true;
  }

  /* --- Creación de unidades ---------------------------------------------- */
  function nuevaUnidad(est, jIdx, cartaId) {
    const m = meta(est, cartaId);
    const atq = Number.isFinite(m.atq) ? m.atq : 0;
    const pv = Number.isFinite(m.pv) && m.pv > 0 ? m.pv : 1;
    const u = {
      uid: est.siguienteUid++, cartaId, dueno: jIdx, atq, pv, pvMax: pv, atqBase: atq, pvBase: pv,
      entro: est.turno, equipo: [], mods: [],
      flags: { noAtacaHasta: 0, noBloqueaHasta: 0, sinProvocarHasta: 0, sinVolarHasta: 0, escurridizoHasta: 0, barrera: false, marcadaPor: null, marcadaHasta: 0, guardiaTurno: 0, guardiaUsada: false, dupPv: 0, danada: false, inmune: false, vincPv: 0, vincBarrera: false, sinCurarHasta: 0, forma: 0 }
    };
    const ef = EFECTOS[cartaId];
    if (ef && ef.alCrear) ef.alCrear(est, u);
    return u;
  }

  /* Hueco del campo (0 a CAMPO_MAX - 1): el pedido si está libre, y si no el primero libre. -1 si no queda ninguno. */
  function huecoLibre(J, pedido) {
    const usados = new Set(J.campo.map(x => x.hueco));
    if (Number.isInteger(pedido) && pedido >= 0 && pedido < C.CAMPO_MAX && !usados.has(pedido)) return pedido;
    for (let k = 0; k < C.CAMPO_MAX; k++) if (!usados.has(k)) return k;
    return -1;
  }

  function ponerUnidad(est, jIdx, cartaId, conEntrada, objetivo, hueco) {
    const J = est.jugadores[jIdx];
    const u = nuevaUnidad(est, jIdx, cartaId);
    u.hueco = huecoLibre(J, hueco);
    J.campo.push(u);
    log(est, `${J.nombre} juega a ${nombre(est, u)}.`);
    sincronizarTerreno(est);
    sincronizarVinculos(est);
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
        else {
          ef.alEntrar.resolver({ est, M, u, j: jIdx, objetivo });
          // Eco (Montaña del Eco Arcano): la habilidad al entrar se repite con el mismo objetivo, si sigue ahí
          const D = defTerreno(est);
          if (D && D.eco && D.eco(est, u) && buscar(est, u.uid) && (!objetivo || objetivo.uid === undefined || buscar(est, objetivo.uid))) {
            log(est, `El eco arcano repite la habilidad de ${nombre(est, u)}.`);
            ef.alEntrar.resolver({ est, M, u, j: jIdx, objetivo });
          }
        }
      }
    } else if (conEntrada && efectoDe(est, u).alEntrar) {
      log(est, `El silencio de la Torre apaga la habilidad de ${nombre(est, u)}.`);
    }
    return u;
  }

  /* Unidades que cambian con el terreno (efecto.duplicaEn = id del terreno): mientras ese terreno esté en juego
     duplican su ataque (lo hace pasivaAtq) y su vida. Se llama cada vez que entra una unidad o cambia el terreno. */
  function sincronizarTerreno(est) {
    todas(est).forEach(u => {
      const ef = efectoDe(est, u);
      if (!ef.duplicaEn) return;
      const debe = terrenoActivo(est, ef.duplicaEn);
      if (debe && !u.flags.dupPv) {
        u.flags.dupPv = u.pvMax;
        u.pvMax += u.flags.dupPv;
        u.pv += u.flags.dupPv;
        log(est, `${nombre(est, u)} se crece en ${meta(est, ef.duplicaEn).nombre}: duplica su ataque y su vida.`);
      } else if (!debe && u.flags.dupPv) {
        u.pvMax = Math.max(1, u.pvMax - u.flags.dupPv);
        u.flags.dupPv = 0;
        u.pv = Math.max(1, Math.min(u.pv, u.pvMax));
        log(est, `${nombre(est, u)} pierde lo que le daba ${meta(est, ef.duplicaEn).nombre}.`);
      }
    });
  }

  /* --- Robar -------------------------------------------------------------- */
  function robar(est, jIdx, n = 1, silencioso = false) {
    const J = est.jugadores[jIdx];
    let robadas = 0;
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
        robadas += 1;
      }
    }
    if (robadas && !silencioso) log(est, `${J.nombre} roba ${robadas === 1 ? "una carta" : `${robadas} cartas`}.`);
  }

  /* --- Cementerio -----------------------------------------------------------------
     Cada jugador tiene el suyo: sus cartas por orden de llegada, la última encima. Entran las unidades que caen
     (las fichas no: desaparecen), los objetos y acciones jugados o cancelados, las reacciones y los terrenos que
     se desvanecen o los reemplaza otro. Lo que se pierde de la mano (mano llena, descartes forzados) va aparte, a
     `descartes`, y no se puede recuperar. Es información pública: los dos jugadores ven los dos cementerios. */
  const cementerioDe = (est, j) => est.jugadores[j].cementerio;

  /* Cartas del cementerio que cumplen el filtro(meta, id) (todas si no hay): [{ id, i }], de la más antigua a la más reciente */
  function enCementerio(est, j, filtro) {
    return est.jugadores[j].cementerio.map((id, i) => ({ id, i })).filter(x => !filtro || filtro(meta(est, x.id), x.id));
  }

  /* Saca la carta de la posición i del cementerio para siempre (queda exiliada). Devuelve su id. */
  function exiliar(est, j, i) {
    const J = est.jugadores[j];
    return i >= 0 && i < J.cementerio.length ? J.cementerio.splice(i, 1)[0] : null;
  }

  /* Devuelve una unidad del cementerio al campo de `j` (entra como cualquier otra: no ataca ese turno).
     opciones:
       desde       de quién es el cementerio (por defecto, el de j; poniendo el del rival se roba una unidad)
       filtro      (meta, id) => bool; por defecto, cualquier unidad que no sea ficha
       id          una carta concreta
       cual        'ultima' (por defecto) | 'primera' | 'azar' | 'fuerte' (la de más ataque más vida)
       pv          con cuánta vida vuelve (por defecto, la completa)
       conEntrada  true para que se dispare su habilidad «al entrar» (con `objetivo` si la pide)
       hueco       hueco del campo que prefiere
       silencio    true para no escribir el aviso de regreso en el registro
     Devuelve la unidad, o null si no había a quién devolver o el campo está lleno. */
  function revivir(est, j, opciones) {
    const o = opciones || {};
    const de = o.desde === undefined ? j : o.desde;
    const J = est.jugadores[j];
    if (J.campo.length >= C.CAMPO_MAX) { log(est, "No hay sitio en el campo."); return null; }
    const pasa = o.id ? (m, id) => id === o.id : (o.filtro || (m => !m.token));
    const lista = enCementerio(est, de, (m, id) => esUnidad(m) && pasa(m, id));
    if (!lista.length) { log(est, "No hay a quién devolver del cementerio."); return null; }
    const peso = x => { const m = meta(est, x.id); return (m.atq || 0) + (m.pv || 0); };
    const k = o.cual === "primera" ? lista[0]
      : o.cual === "azar" ? lista[entero(est, lista.length)]
      : o.cual === "fuerte" ? lista.reduce((a, b) => (peso(b) >= peso(a) ? b : a))
      : lista[lista.length - 1];
    exiliar(est, de, k.i);
    const u = ponerUnidad(est, j, k.id, !!o.conEntrada, o.objetivo || null, o.hueco);
    if (o.pv !== undefined && o.pv !== null) u.pv = Math.max(1, Math.min(o.pv, u.pvMax));
    if (!o.silencio) log(est, `${nombre(est, u)} vuelve del cementerio${o.pv !== undefined && o.pv !== null ? ` con ${u.pv} de vida` : ""}.`);
    return u;
  }

  /* Devuelve una unidad del campo a la mano de su dueño (no cuenta como caída: no hay «al morir»). Si la mano
     está llena, la carta se pierde; una ficha desaparece. Devuelve true si la quitó. */
  function devolverAMano(est, u) {
    const J = est.jugadores[u.dueno];
    const i = J.campo.findIndex(x => x.uid === u.uid);
    if (i < 0) return false;
    J.campo.splice(i, 1);
    if (meta(est, u.cartaId).token) log(est, `${nombre(est, u)} desaparece.`);
    else if (J.mano.length >= C.MANO_MAX) { J.descartes.push(u.cartaId); log(est, `${nombre(est, u)} vuelve a la mano de ${J.nombre}, pero la tiene llena: se pierde.`); }
    else { J.mano.push(u.cartaId); log(est, `${nombre(est, u)} vuelve a la mano de ${J.nombre}.`); }
    sincronizarVinculos(est);
    return true;
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
    // Las rivalidades se miran antes de que caiga, mientras su rival sigue en el campo
    const aseHit = fuente && fuente.uid ? buscar(est, fuente.uid) : null;
    const riv = rivalidadesAlMorir(est, u, aseHit ? aseHit.u : null);
    J.campo.splice(i, 1);
    if (!meta(est, u.cartaId).token) J.cementerio.push(u.cartaId);   // las fichas desaparecen sin dejar carta
    log(est, `${nombre(est, u)} cae.`);
    const ef = efectoDe(est, u);
    if (ef.alMorir) {
      if (riv.anula) log(est, `«${riv.anula.nombre}»: la habilidad de ${nombre(est, u)} al morir no ocurre.`);
      else ef.alMorir({ est, M, u, j: u.dueno });
    }
    riv.propias.forEach(r => { if (est.ganador === null) r.paraContra.alMorirPropia({ est, M, u, j: u.dueno, rivalidad: r }); });
    // Las demás unidades en juego que reaccionan a una caída (nigromantes, carroñeras...)
    todas(est).slice().forEach(o => {
      if (!buscar(est, o.uid)) return;
      const eo = efectoDe(est, o), aliada = o.dueno === u.dueno;
      if (aliada && eo.alMorirAliada) eo.alMorirAliada({ est, M, u: o, j: o.dueno, muerta: u });
      else if (!aliada && eo.alMorirEnemiga) eo.alMorirEnemiga({ est, M, u: o, j: o.dueno, muerta: u });
    });
    const T = defTerreno(est);
    if (T && T.alMorirUnidad) T.alMorirUnidad(est, u);
    if (fuente && fuente.uid) {
      const ata = buscar(est, fuente.uid);
      if (ata) {
        const ea = efectoDe(est, ata.u);
        if (ea.alMatar) ea.alMatar({ est, M, u: ata.u, j: ata.j, muerta: u });
        riv.recompensas.forEach(r => r.paraBando.alMatarContra({ est, M, u: ata.u, j: ata.j, muerta: u, rivalidad: r }));
      }
    }
    sincronizarVinculos(est);
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
    const guardian = ownerJ.campo.find(g => {
      if (g.uid === u.uid || g.flags.guardiaTurno === est.turno) return false;
      const eg = efectoDe(est, g);
      if (eg.guardian && !(eg.guardianUnaVez && g.flags.guardiaUsada)) return true;
      return bonosDe(est, g).guarda.includes(u.cartaId);   // se interpone por quien le importa (vínculo)
    });
    if (guardian) {
      guardian.flags.guardiaTurno = est.turno;
      guardian.flags.guardiaUsada = true;
      log(est, `${nombre(est, guardian)} se interpone y recibe el golpe de ${nombre(est, u)}.`);
      u = guardian;
    }
    if (u.flags.barrera) {
      u.flags.barrera = false;
      log(est, `La barrera de ${nombre(est, u)} absorbe el golpe y se rompe.`);
      return 0;
    }
    let n = cantidad;
    const ef = efectoDe(est, u);
    // Esquivo: en combate esquiva parte del golpe (recibe la mitad, redondeando hacia abajo)
    if (fuente && fuente.tipo === "combate" && tienePalabra(est, u, "esquivo")) {
      n = Math.floor(n / 2);
      if (n <= 0) { log(est, `${nombre(est, u)} esquiva el golpe.`); return 0; }
    }
    if (tienePalabra(est, u, "duro")) n -= 1;
    if (ef.reduceDano) n -= ef.reduceDano(est, u, n, fuente) || 0;
    n -= bonosDe(est, u).reduce;
    n = Math.max(0, n);
    if (fuente && fuente.tipo === "habilidad" && terrenoActivo(est, "catedral-del-juramento")) n = Math.max(0, Math.min(n, u.pv - 1));
    if (n <= 0) { log(est, `${nombre(est, u)} no recibe daño.`); return 0; }
    u.pv -= n;
    u.flags.danada = true;
    log(est, `${nombre(est, u)} recibe ${n} de daño.`);
    // Una aliada puede evitar la muerte (Sentencia aplazada de Julius, Yo sé lo que te conviene de Harrow)
    if (u.pv <= 0) {
      for (const g of est.jugadores[u.dueno].campo) {
        const eg = efectoDe(est, g);
        if (eg.evitaMuerte && eg.evitaMuerte(est, g, u, fuente)) { u.pv = 1; break; }
      }
    }
    if (u.pv > 0) {
      if (ef.alRecibirDano) ef.alRecibirDano({ est, M, u, j: u.dueno, cantidad: n, fuente });
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
    if (u.flags.sinCurarHasta >= est.turno) { log(est, `${nombre(est, u)} no puede curarse ahora.`); return 0; }
    const antes = u.pv;
    u.pv = Math.min(u.pvMax, u.pv + cantidad);
    if (u.pv > antes) log(est, `${nombre(est, u)} recupera ${u.pv - antes} de vida.`);
    return u.pv - antes;
  }

  /* Bonificación temporal de ataque y vida hasta el final del turno `hasta` */
  function mod(est, u, atq, pv, hasta, texto) {
    u.mods.push({ atq, pv, hasta });
    u.pvMax += pv;
    u.pv += pv;
    log(est, texto || `${nombre(est, u)} gana ${atq >= 0 ? "+" : ""}${atq}/${pv >= 0 ? "+" : ""}${pv} este turno.`);
  }

  /* --- Objetivos ---------------------------------------------------------- */
  /* Escurridizo (regla propia): no la pueden elegir los desafíos ni las habilidades enemigas. No es invulnerable:
     si bloquea o la bloquean, recibe daño normal, y los efectos que no apuntan a nadie (terrenos) la alcanzan.
     Puede ser temporal (flags.escurridizoHasta) o depender de algo (efecto.escurridizo). */
  function esEscurridizo(est, u) {
    if (u.flags.escurridizoHasta >= est.turno) return true;
    const ef = efectoDe(est, u);
    return !!(ef.escurridizo && ef.escurridizo(est, u));
  }

  /* ¿Puede una habilidad (de unidad) apuntar a esta unidad? */
  function puedeApuntarHabilidad(est, t, desdeDueno) {
    if (terrenoActivo(est, "vado-ceniza")) return false;
    if (t.flags.inmune && t.dueno !== desdeDueno) return false;
    if (esEscurridizo(est, t) && t.dueno !== desdeDueno) return false;
    return true;
  }

  function validosParaObjetivo(est, jIdx, tipo, habilidad, excluirUid, filtro) {
    const yo = est.jugadores[jIdx], el = est.jugadores[1 - jIdx];
    const ok = t => (!habilidad || puedeApuntarHabilidad(est, t, jIdx)) && t.uid !== excluirUid && (!filtro || filtro(est, t, jIdx));
    if (tipo === "unidadEnemiga") return el.campo.filter(ok).map(t => ({ u: t.uid }));
    if (tipo === "unidadAliada" || tipo === "unidadAliadaOtra") return yo.campo.filter(ok).map(t => ({ u: t.uid }));
    if (tipo === "unidad") return [...yo.campo, ...el.campo].filter(ok).map(t => ({ u: t.uid }));
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
    // Un objeto que apunta a una unidad enemiga respeta Escurridizo y Capucha oscura, igual que una habilidad
    const hostil = esU || spec.objetivo === "unidadEnemiga";
    return {
      tipo: spec.objetivo,
      habilidad: hostil,
      opcional: esU,
      validos: validosParaObjetivo(est, jIdx, spec.objetivo, hostil, null, spec.filtro)
    };
  }

  /* --- Atacar y bloquear ------------------------------------------------------ */
  /* ¿Puede esta unidad (del jugador activo) formar parte de un ataque ahora? */
  function unidadPuedeAtacar(est, u) {
    if (est.ganador !== null || est.activo !== u.dueno || est.combate) return false;
    if (est.atacado === est.turno) return false;
    if (u.entro === est.turno) return false;
    if (u.flags.noAtacaHasta >= est.turno) return false;
    return atqEfectivo(est, u) > 0;
  }

  /* ¿Puede la unidad `blk` bloquear a la atacante `atk`? Volar: solo la bloquean unidades que vuelan.
     Temible: no la bloquean unidades con menos de 3 de ataque. */
  function puedeBloquear(est, blk, atk) {
    if (blk.dueno === atk.dueno) return false;
    if (tienePalabra(est, blk, "noBloquea")) return false;
    if (blk.flags.noBloqueaHasta >= est.turno) return false;
    if (tienePalabra(est, atk, "volar") && !tienePalabra(est, blk, "volar")) return false;
    if (tienePalabra(est, atk, "temible") && atqEfectivo(est, blk) < 3) return false;
    return true;
  }

  /* Uids de las unidades del defensor que podrían bloquear a esta atacante */
  function bloqueadoresPosibles(est, atkUid) {
    const hit = buscar(est, atkUid);
    if (!hit) return [];
    return est.jugadores[1 - hit.j].campo.filter(b => puedeBloquear(est, b, hit.u)).map(b => b.uid);
  }

  /* A quién puede desafiar esta unidad al atacar (uids de unidades enemigas). Un desafío obliga a bloquear aunque
     la unidad vuele o no pueda bloquear. Desafiante: cualquiera, pero primero las que tengan Provocar (salvo con el
     Puente de las Legiones). Una unidad marcada es Vulnerable para quien la marcó: la puede desafiar cualquiera de
     sus unidades y Provocar no cuenta. */
  function objetivosDeDesafio(est, atk) {
    const defensores = est.jugadores[1 - atk.dueno].campo;
    const out = new Set();
    if (tienePalabra(est, atk, "desafiante")) {
      const ignora = terrenoActivo(est, "puente-de-las-legiones") && est.terreno.dueno === atk.dueno;
      const provocan = defensores.filter(d => tienePalabra(est, d, "provocar"));
      (!ignora && provocan.length ? provocan : defensores).forEach(d => out.add(d.uid));
    }
    defensores.forEach(d => { if (marcadaVigente(est, d) === atk.dueno || marcaPorRivalidad(est, atk, d)) out.add(d.uid); });
    return [...out].filter(uid => !esEscurridizo(est, defensores.find(d => d.uid === uid)));
  }

  /* Quienes pueden bloquear a esta atacante sin estar ya obligados a bloquear a otra */
  function bloqueadoresLibres(est, atkUid) {
    const forzados = new Set(Object.values(est.combate ? est.combate.forzados || {} : {}));
    return bloqueadoresPosibles(est, atkUid).filter(b => !forzados.has(b));
  }

  /* --- Turnos -------------------------------------------------------------- */
  function iniciarTurno(est) {
    est.turno += 1;
    const jIdx = est.activo;
    const J = est.jugadores[jIdx];
    J.energiaMax = Math.min(C.ENERGIA_MAX, J.energiaMax + 1);
    J.energia = J.energiaMax;
    J.costeMenos = 0;
    J.campo.forEach(u => { u.flags.danada = false; });
    est.jugadores[1 - jIdx].campo.forEach(u => { u.flags.danada = false; });
    log(est, `— Turno ${est.turno}: ${J.nombre} —`);
    if (!(est.turno === 1)) robar(est, jIdx, 1, true);
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
    J.campo.slice().forEach(u => {
      const ef = efectoDe(est, u);
      if (ef.alFinTurno && buscar(est, u.uid)) ef.alFinTurno({ est, M, u, j: est.activo });
    });
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
        est.jugadores[est.terreno.dueno].cementerio.push(est.terreno.cartaId);
        est.terreno = null;
        sincronizarTerreno(est);
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
      if (!esReaccion(est, id)) return;
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

  /* Algunas reacciones piden elegir a una unidad atacante: { tipo, validos: [{ u }] } o null */
  function requisitoDeReaccion(est, jIdx, id) {
    const ef = EFECTOS[id];
    if (!ef || !ef.reaccion || ef.reaccion.objetivo !== "atacante" || !est.combate) return null;
    const valida = uid => { const hit = buscar(est, uid); return !!hit && (!ef.reaccion.valido || ef.reaccion.valido(est, hit.u, jIdx)); };
    return { tipo: "atacante", validos: est.combate.atacantes.filter(valida).map(uid => ({ u: uid })) };
  }

  function jugarReaccion(est, jIdx, i, objetivoRaw) {
    const p = est.pendiente;
    if (jIdx !== p.reactor) return { error: "No te toca reaccionar." };
    if (!reaccionesPosibles(est, jIdx, p.evento).includes(i)) return { error: "Esa carta no se puede jugar como reacción ahora." };
    const J = est.jugadores[jIdx];
    const id = J.mano[i];
    const ef = EFECTOS[id];
    const req = requisitoDeReaccion(est, jIdx, id);
    if (req && !(objetivoRaw && req.validos.some(v => igual(v, objetivoRaw)))) return { error: "Elige la unidad atacante a la que va dirigida." };
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
      const { id, objetivo, hueco } = p.datos;
      if (p.cancelado) {
        est.jugadores[p.actor].cementerio.push(id);
        log(est, `${meta(est, id).nombre} queda cancelada.`);
      } else {
        resolverJugada(est, p.actor, id, objetivo, hueco);
      }
    } else if (p.tipo === "ataque") {
      iniciarBloqueo(est);
    } else if (p.tipo === "bloqueo") {
      resolverCombate(est);
    }
    revisarFinal(est);
    return { ok: true };
  }

  /* --- Jugar una carta ------------------------------------------------------- */
  function jugarCarta(est, jIdx, i, objetivoRaw, huecoPedido) {
    const J = est.jugadores[jIdx];
    if (i === undefined || i < 0 || i >= J.mano.length) return { error: "Esa carta no está en tu mano." };
    const id = J.mano[i];
    const m = meta(est, id);
    const coste = costeDe(est, jIdx, id);
    if (coste > J.energia) return { error: "No tienes energía suficiente." };
    if (esReaccion(est, id)) return { error: "Una reacción solo se juega como respuesta en el turno del rival." };
    if (esUnidad(m) && J.campo.length >= C.CAMPO_MAX) return { error: "Tu campo está lleno." };
    if (esUnidad(m) && huecoPedido !== undefined && huecoPedido !== null) {
      if (!Number.isInteger(huecoPedido) || huecoPedido < 0 || huecoPedido >= C.CAMPO_MAX) return { error: "Ese hueco no existe." };
      if (J.campo.some(x => x.hueco === huecoPedido)) return { error: "Ese hueco está ocupado." };
    }
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
    if (abrirVentana(est, { tipo: "jugar", actor: jIdx, carta: id }, { id, objetivo, hueco: huecoPedido })) return { ok: true, pendiente: true };
    resolverJugada(est, jIdx, id, objetivo, huecoPedido);
    revisarFinal(est);
    return { ok: true };
  }

  /* Aplica el efecto de una carta ya pagada. objetivoRaw: { u } | { j } | null (puede haber desaparecido). */
  function resolverJugada(est, jIdx, id, objetivoRaw, hueco) {
    const J = est.jugadores[jIdx];
    const m = meta(est, id);
    let objetivo = null;
    if (objetivoRaw) {
      if (objetivoRaw.u !== undefined) { const hit = buscar(est, objetivoRaw.u); objetivo = hit ? hit.u : null; }
      else objetivo = objetivoRaw;
    }
    if (esUnidad(m)) {
      if (J.campo.length >= C.CAMPO_MAX) { J.cementerio.push(id); log(est, `No hay sitio para ${m.nombre}.`); return; }
      ponerUnidad(est, jIdx, id, true, objetivo, hueco);
    } else if (m.tipo === "Terreno") {
      const T = TERRENOS[id] || {};
      if (est.terreno) est.jugadores[est.terreno.dueno].cementerio.push(est.terreno.cartaId);   // el terreno anterior se va al cementerio
      est.terreno = { cartaId: id, dueno: jIdx, restantes: T.duracion || null, turnoEntrada: 0, desde: est.turno };
      log(est, `${J.nombre} juega el terreno ${m.nombre}.`);
      sincronizarTerreno(est);
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

  /* --- Combate ------------------------------------------------------------------
     est.combate = { atacantes: [uid], bloqueos: { uidAtacante: uidBloqueador } } mientras se decide el combate.
     Pasos: 1) el jugador activo declara sus atacantes (una vez por turno); 2) el rival puede reaccionar si
     tiene una reacción que encaje; 3) el rival elige sus bloqueos; 4) se resuelve todo a la vez.
     est.ultimoCombate guarda cómo salió, para que la pantalla lo anime. */
  function atacar(est, jIdx, uidsRaw, desafiosRaw) {
    if (est.combate) return { error: "Ya hay un combate en marcha." };
    if (est.atacado === est.turno) return { error: "Ya atacaste este turno: solo se ataca una vez." };
    const lista = (Array.isArray(uidsRaw) ? uidsRaw : [uidsRaw]).filter(x => x !== undefined && x !== null);
    if (!lista.length) return { error: "Elige al menos una unidad para atacar." };
    if (new Set(lista).size !== lista.length) return { error: "Una unidad no puede atacar dos veces." };
    const unidades = [];
    for (const uid of lista) {
      const hit = buscar(est, uid);
      if (!hit || hit.j !== jIdx) return { error: "Esa unidad no es tuya." };
      const u = hit.u;
      if (u.entro === est.turno) return { error: `${nombre(est, u)} acaba de entrar.` };
      if (u.flags.noAtacaHasta >= est.turno) return { error: `${nombre(est, u)} no puede atacar este turno.` };
      if (atqEfectivo(est, u) <= 0) return { error: `${nombre(est, u)} no tiene ataque.` };
      unidades.push(u);
    }
    // Desafíos: { uidAtacante: uidDefensor }. Obligan al defensor a bloquear a ese atacante.
    const desafios = {};
    const desafiados = new Set();
    for (const [k, v] of Object.entries(desafiosRaw && typeof desafiosRaw === "object" ? desafiosRaw : {})) {
      const atk = unidades.find(u => String(u.uid) === String(k));
      if (!atk) return { error: "Solo una unidad que ataca puede desafiar." };
      const def = buscar(est, v);
      if (!def || def.j === jIdx) return { error: "Ese desafío no apunta a una unidad enemiga." };
      if (!objetivosDeDesafio(est, atk).includes(v)) return { error: `${nombre(est, atk)} no puede desafiar a ${nombre(est, def.u)}.` };
      if (desafiados.has(v)) return { error: "Una unidad solo puede ser desafiada por un atacante." };
      desafiados.add(v);
      desafios[atk.uid] = v;
    }
    // De izquierda a derecha según su hueco: así el orden es igual en todos los navegadores
    unidades.sort((a, b) => (a.hueco - b.hueco) || (a.uid - b.uid));
    const uids = unidades.map(u => u.uid);
    est.atacado = est.turno;
    est.combate = { atacantes: uids, bloqueos: {}, desafios, forzados: {} };
    log(est, `${est.jugadores[jIdx].nombre} ataca con ${unidades.map(u => nombre(est, u)).join(", ")}.`);
    Object.entries(desafios).forEach(([a, d]) => log(est, `${nombre(est, buscar(est, Number(a)).u)} desafía a ${nombre(est, buscar(est, d).u)}: tendrá que bloquearla.`));
    // Habilidades que se activan al declarar el ataque (antes de las reacciones y de los bloqueos): Ulis se transforma
    unidades.forEach(u => { const ef = efectoDe(est, u); if (ef.alAtacar && buscar(est, u.uid)) ef.alAtacar({ est, M, u, j: jIdx }); });
    if (abrirVentana(est, { tipo: "ataque", actor: jIdx, atacantes: uids }, { atacantes: uids })) return { ok: true, pendiente: true };
    iniciarBloqueo(est);
    revisarFinal(est);
    return { ok: true, pendiente: !!est.pendiente };
  }

  /* Tras las reacciones: los desafíos que siguen en pie fijan sus bloqueos. Si el rival aún puede bloquear a
     alguien más, le toca elegir; si no, se resuelve ya. */
  function iniciarBloqueo(est) {
    const c = est.combate;
    if (!c) return;
    c.atacantes = c.atacantes.filter(uid => buscar(est, uid));
    if (!c.atacantes.length) { log(est, "El ataque se desvanece."); est.combate = null; return; }
    c.forzados = {};
    c.atacantes.forEach(uid => { const d = (c.desafios || {})[uid]; if (d !== undefined && buscar(est, d)) c.forzados[uid] = d; });
    c.bloqueos = Object.assign({}, c.forzados);
    if (!c.atacantes.some(uid => !(uid in c.forzados) && bloqueadoresLibres(est, uid).length)) { resolverCombate(est); return; }
    est.pendienteN += 1;
    est.pendiente = { id: est.pendienteN, tipo: "bloqueo", actor: est.activo, reactor: 1 - est.activo, datos: { atacantes: c.atacantes.slice() }, evento: { tipo: "bloqueo", actor: est.activo }, cancelado: false };
  }

  /* pares: [[uidAtacante, uidBloqueador], ...]. Cada atacante, un bloqueador como mucho, y viceversa. */
  function bloquear(est, jIdx, pares) {
    const p = est.pendiente;
    if (!p || p.tipo !== "bloqueo" || !est.combate) return { error: "No hay nada que bloquear." };
    if (jIdx !== p.reactor) return { error: "No te toca bloquear." };
    if (!Array.isArray(pares)) return { error: "Bloqueos inválidos." };
    const atacadas = new Set(), bloqueando = new Set(), mapa = {};
    const forzados = est.combate.forzados || {};
    const defForzados = new Set(Object.values(forzados));
    for (const par of pares) {
      if (!Array.isArray(par) || par.length !== 2) return { error: "Bloqueo inválido." };
      const [a, b] = par;
      if (!est.combate.atacantes.includes(a)) return { error: "Esa unidad no está atacando." };
      if (a in forzados) return { error: "Ese atacante ya tiene a su bloqueador por un desafío." };
      if (defForzados.has(b)) return { error: "Esa unidad está obligada a bloquear a otro atacante." };
      if (atacadas.has(a)) return { error: "Un atacante solo puede ser bloqueado por una unidad." };
      if (bloqueando.has(b)) return { error: "Una unidad solo puede bloquear a un atacante." };
      const ha = buscar(est, a), hb = buscar(est, b);
      if (!ha) return { error: "Ese atacante ya no está." };
      if (!hb || hb.j !== jIdx) return { error: "Esa unidad no es tuya." };
      if (!puedeBloquear(est, hb.u, ha.u)) return { error: `${nombre(est, hb.u)} no puede bloquear a ${nombre(est, ha.u)}.` };
      atacadas.add(a); bloqueando.add(b); mapa[a] = b;
    }
    est.combate.bloqueos = Object.assign({}, forzados, mapa);
    pares.forEach(([a, b]) => log(est, `${nombre(est, buscar(est, b).u)} bloquea a ${nombre(est, buscar(est, a).u)}.`));
    if (!pares.length) log(est, `${est.jugadores[jIdx].nombre} no bloquea${Object.keys(forzados).length ? " más allá de los desafíos" : ""}.`);
    return resolverPendiente(est);
  }

  /* Daño de una unidad contra otra en combate (con sus bonificaciones) */
  function danoDeCombate(est, u, contra) {
    // Fuerza Helénica: contra una unidad hace tanto daño como vida tenga (ni el ataque ni las bonificaciones cuentan, y las
    // resistencias, Barrera, Duro, Esquivo, reduceDano y guardián, actúan después, al infligir el daño). Si nadie la bloquea
    // y toca al jugador, le quita toda la vida de un golpe.
    if (efectoDe(est, u).fuerzaHelenica) return contra ? Math.max(0, contra.pv) : Math.max(1, est.jugadores[1 - u.dueno].vida);
    let d = atqEfectivo(est, u);
    if (contra) {
      const ef = efectoDe(est, u);
      if (ef.bonusAtaque) d += ef.bonusAtaque(est, u, contra) || 0;
      d += bonusVsRival(est, u, contra);
      if (marcadaVigente(est, contra) === u.dueno) d += 2;
    }
    return d;
  }

  function instantanea(est, u) {
    return { uid: u.uid, cartaId: u.cartaId, dueno: u.dueno, atq: atqEfectivo(est, u), pv: u.pv, pvMax: u.pvMax, forma: u.flags.forma || 0 };
  }

  function resolverCombate(est) {
    const c = est.combate;
    est.combate = null;
    if (!c) return;
    const A = est.activo, D = 1 - A;
    // 1) Quién pelea con quién y cuánto daño hace cada uno (con los números de antes del combate)
    const pares = [];
    c.atacantes.forEach(uid => {
      const ha = buscar(est, uid);
      if (!ha) return;
      const bUid = c.bloqueos[uid];
      const hb = bUid !== undefined ? buscar(est, bUid) : null;
      const a = ha.u, b = hb ? hb.u : null;
      pares.push({ a, b, dA: danoDeCombate(est, a, b), dB: b ? danoDeCombate(est, b, a) : 0, antes: { a: instantanea(est, a), b: b ? instantanea(est, b) : null }, jugador: 0, aMuere: false, bMuere: false });
    });
    est.combateN = (est.combateN || 0) + 1;
    // 2) Los golpes. Veloz golpea primero y, si mata, no recibe el golpe de vuelta. El resto, a la vez.
    const golpe = (de, a, dano, pvAntes, esAtacante, par) => {
      if (dano <= 0) return;
      infligir(est, { u: a.uid }, dano, { tipo: "combate", uid: de.uid });
      if (esAtacante && tienePalabra(est, de, "arrollar")) {
        const exceso = dano - pvAntes;
        if (exceso > 0 && est.ganador === null) {
          par.jugador += infligir(est, { j: D }, exceso, { tipo: "combate", uid: de.uid });
          const ef = efectoDe(est, de);
          if (ef.alAtacarJugador && buscar(est, de.uid)) ef.alAtacarJugador({ est, M, u: de, j: A });
        }
      }
    };
    pares.forEach(par => {
      const { a, b } = par;
      if (!b) return;
      const vA = tienePalabra(est, a, "veloz"), vB = tienePalabra(est, b, "veloz");
      if (vA && !vB) {
        const pvB = b.pv;
        golpe(a, b, par.dA, pvB, true, par);
        if (buscar(est, b.uid)) golpe(b, a, par.dB, a.pv, false, par);
        else log(est, `${nombre(est, b)} cae antes de poder golpear.`);
      } else if (vB && !vA) {
        const pvA = a.pv;
        golpe(b, a, par.dB, pvA, false, par);
        if (buscar(est, a.uid)) golpe(a, b, par.dA, b.pv, true, par);
        else log(est, `${nombre(est, a)} cae antes de poder golpear.`);
      } else {
        const pvA = a.pv, pvB = b.pv;
        golpe(a, b, par.dA, pvB, true, par);
        golpe(b, a, par.dB, pvA, false, par);
      }
    });
    // Los atacantes sin bloqueo golpean al jugador
    pares.forEach(par => {
      if (par.b || est.ganador !== null) return;
      const { a } = par;
      if (efectoDe(est, a).fuerzaHelenica) log(est, `${nombre(est, a)} toca a ${est.jugadores[D].nombre} con Fuerza Helénica: cae de un solo golpe.`);
      par.jugador += infligir(est, { j: D }, par.dA, { tipo: "combate", uid: a.uid });
      const ef = efectoDe(est, a);
      if (ef.alAtacarJugador && buscar(est, a.uid)) ef.alAtacarJugador({ est, M, u: a, j: A });
    });
    pares.forEach(par => { par.aMuere = !buscar(est, par.a.uid); par.bMuere = !!par.b && !buscar(est, par.b.uid); });
    est.ultimoCombate = {
      id: est.combateN, turno: est.turno, atacante: A,
      pares: pares.map(par => ({ a: par.antes.a, b: par.antes.b, dA: par.dA, dB: par.dB, jugador: par.jugador, aMuere: par.aMuere, bMuere: par.bMuere, desafio: !!(par.b && (c.forzados || {})[par.a.uid] === par.b.uid) }))
    };
    revisarFinal(est);
  }

  /* Quién envió una acción ya guardada (para repetir una partida desde cero). */
  function emisorDe(est, accion) {
    if (est.pendiente && accion && (accion.t === "reaccionar" || accion.t === "bloquear" || (accion.t === "pasar" && !accion.forzar))) return est.pendiente.reactor;
    return est.activo;
  }
  const reproducir = (est, accion) => aplicar(est, accion, emisorDe(est, accion));

  /* Aplica una acción de un jugador.
       { t:'jugar', i, o?, h? } | { t:'atacar', u: [uid, ...], d?: { uidAtacante: uidDefensor } } | { t:'fin' }
       { t:'reaccionar', i, o? } | { t:'bloquear', b: [[uidAtacante, uidBloqueador], ...] } | { t:'pasar', forzar? }
       (las tres últimas, solo mientras hay una acción pendiente) */
  function aplicar(est, accion, jIdx) {
    if (est.ganador !== null) return { error: "La partida ya terminó." };
    if (!accion || typeof accion !== "object") return { error: "Acción inválida." };
    const p = est.pendiente;
    if (p) {
      if (accion.t === "reaccionar") return jugarReaccion(est, jIdx, accion.i, accion.o);
      if (accion.t === "bloquear") return bloquear(est, jIdx, accion.b);
      if (accion.t === "pasar") {
        // El rival deja pasar. El jugador activo solo puede seguir sin esperar si pasó el tiempo (lo comprueba el servidor).
        if (jIdx === p.reactor || (accion.forzar && jIdx === p.actor)) return resolverPendiente(est);
        return { error: "No te toca reaccionar." };
      }
      return { error: "Espera la respuesta del rival." };
    }
    if (accion.t === "pasar") return { ok: true }; // sobra: la reacción ya se resolvió
    if (accion.t === "reaccionar") return { error: "No hay nada a lo que reaccionar." };
    if (accion.t === "bloquear") return { error: "No hay nada que bloquear." };
    if (jIdx !== est.activo) return { error: "No es tu turno." };
    if (accion.t === "jugar") return jugarCarta(est, jIdx, accion.i, accion.o, accion.h);
    if (accion.t === "atacar") return atacar(est, jIdx, accion.u, accion.d);
    if (accion.t === "fin") { est.combate = null; finalizarTurno(est); return { ok: true }; }
    return { error: "Acción desconocida." };
  }

  /* Todas las acciones posibles de quien tiene que actuar (para la interfaz y para las pruebas) */
  function accionesLegales(est) {
    if (est.ganador !== null) return [];
    if (est.pendiente) {
      const p = est.pendiente;
      if (p.tipo === "bloqueo") {
        // Sin bloquear, cada bloqueo suelto posible y una asignación completa
        const out = [{ t: "bloquear", b: [] }];
        const libres = new Set(est.jugadores[p.reactor].campo.map(u => u.uid)), completo = [];
        Object.values(est.combate.forzados || {}).forEach(d => libres.delete(d));
        est.combate.atacantes.forEach(a => {
          if (a in (est.combate.forzados || {})) return;
          const posibles = bloqueadoresLibres(est, a);
          posibles.forEach(b => out.push({ t: "bloquear", b: [[a, b]] }));
          const b = posibles.find(x => libres.has(x));
          if (b !== undefined) { libres.delete(b); completo.push([a, b]); }
        });
        if (completo.length > 1) out.push({ t: "bloquear", b: completo });
        return out;
      }
      return [...reaccionesPosibles(est, p.reactor, p.evento).flatMap(i => {
        const req = requisitoDeReaccion(est, p.reactor, est.jugadores[p.reactor].mano[i]);
        return req ? req.validos.map(o => ({ t: "reaccionar", i, o })) : [{ t: "reaccionar", i }];
      }), { t: "pasar" }];
    }
    const jIdx = est.activo, J = est.jugadores[jIdx], out = [];
    J.mano.forEach((id, i) => {
      const m = meta(est, id);
      if (costeDe(est, jIdx, id) > J.energia || esReaccion(est, id)) return;
      if (esUnidad(m) && J.campo.length >= C.CAMPO_MAX) return;
      const req = requisitoDeJugada(est, jIdx, id);
      if (!req) out.push({ t: "jugar", i });
      else if (req.validos.length) req.validos.forEach(v => out.push({ t: "jugar", i, o: v }));
      else if (req.opcional) out.push({ t: "jugar", i });
    });
    // Atacar: cada unidad lista por separado y todas juntas
    const listas = J.campo.filter(u => unidadPuedeAtacar(est, u));
    listas.forEach(u => {
      out.push({ t: "atacar", u: [u.uid] });
      objetivosDeDesafio(est, u).slice(0, 3).forEach(d => out.push({ t: "atacar", u: [u.uid], d: { [u.uid]: d } }));
    });
    if (listas.length > 1) out.push({ t: "atacar", u: listas.map(u => u.uid) });
    out.push({ t: "fin" });
    return out;
  }

  /* --- Partida nueva --------------------------------------------------------- */
  /* jugadores: [{ id, nombre, mazo: [cartaId, ...] }, ...]. cartas: { id: datos de carta }. */
  function crearPartida({ semilla, jugadores, primero, cartas }) {
    const est = {
      v: 2, rng: semilla >>> 0, turno: 0, activo: primero, cartas: cartas || {},
      jugadores: jugadores.map(j => ({
        id: j.id, nombre: j.nombre, vida: C.VIDA, energia: 0, energiaMax: 0,
        mazo: j.mazo.slice(), mano: [], campo: [], cementerio: [], descartes: [], fatiga: 0, costeMenos: 0, malus: null
      })),
      terreno: null, siguienteUid: 1, ganador: null, motivo: "", log: [], pendiente: null, pendienteN: 0, vinc: {},
      combate: null, atacado: 0, combateN: 0, ultimoCombate: null
    };
    est.jugadores.forEach(J => barajar(est, J.mazo));
    est.jugadores.forEach(J => robar(est, est.jugadores.indexOf(J), C.MANO_INICIAL, true));
    robar(est, 1 - primero, 1, true);
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
      const tope = topeCopias(c);
      if (n > tope) problemas.push(`${c.nombre}: ${tope === 1 ? "solo una copia" : `como máximo ${tope} copias`} por mazo${c.tipo === "Personaje" && tope === 1 ? " (un personaje por mazo)" : ""}.`);
      if (posee && n > (posee[id] || 0)) problemas.push(`${c.nombre}: solo tienes ${posee[id] || 0}.`);
    });
    return problemas;
  }

  const M = {
    C, TOPE_COPIAS, topeCopias, TOKENS, EFECTOS, TERRENOS,
    registrar: (id, def) => { EFECTOS[id] = def; },
    registrarTerreno: (id, def) => { TERRENOS[id] = def; },
    registrarVinculos: def => { (def.circulos || []).forEach(c => VINC.circulos.push(c)); (def.rivalidades || []).forEach(r => VINC.rivalidades.push(r)); },
    VINC, bonosDe, vinculosActivos, sincronizarVinculos, devolverAMano, cambiarForma, nombreForma, formasDe,
    crearPartida, aplicar, reproducir, quienActua, reaccionesPosibles, accionesLegales, validarMazo,
    meta, efectoDe, nombre, esUnidad, esReaccion, buscar, todas, log, entero, rnd, barajar,
    infligir, curar, robar, mod, morir, ponerUnidad, nuevaUnidad, cementerioDe, enCementerio, exiliar, revivir,
    atqEfectivo, tienePalabra, costeDe, requisitoDeJugada, requisitoDeReaccion, unidadPuedeAtacar,
    puedeBloquear, bloqueadoresPosibles, bloqueadoresLibres, objetivosDeDesafio, esEscurridizo, puedeApuntarHabilidad, terrenoActivo, marcadaVigente, sincronizarTerreno
  };

  raiz.CartasMotor = M;
  if (typeof module !== "undefined" && module.exports) module.exports = M;
})(typeof window !== "undefined" ? window : globalThis);
