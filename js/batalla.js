/* Batalla de Triunfos: lobby (retos entre jugadores), tablero y modo "probar solo".
   Las reglas las lleva js/cartas-motor.js; aquí solo se dibuja y se mandan las acciones. */
(function () {
  const { esc, htmlCarta } = window.CartasVista;
  const M = window.CartasMotor;
  const $ = id => document.getElementById(id);

  let supa = null;
  let miId = null;
  let esEditor = CartasCliente.editorCacheado();
  let mazos = [];
  let jugadores = [];
  let partidas = [];

  // Partida abierta
  let modo = "lobby";          // lobby | partida | local
  let fila = null;             // fila de cartas_partidas (en línea)
  let est = null;              // estado del motor
  let lista = [];              // acciones ya aplicadas al estado (como texto, para compararlas con el servidor)
  let ventana = { id: 0, desde: 0, enviado: false };  // reacción pendiente que se está esperando
  let yo = 0;                  // mi índice de jugador (0 o 1)
  let sel = null;              // { tipo: 'mano', i } | { tipo: 'unidad', uid } | { tipo: 'ver', uid }
  let cerrando = false;
  let mostradaMirada = "";
  let reveladoPila = null;     // carta superior de tu mazo que ya conoces: { carta, largo }
  let pvPrevios = new Map();
  let ultimoTurno = 0;         // para saber cuándo cambió el turno y avisarlo
  let ultimoTerreno = "";      // lo mismo con el terreno
  let arrastre = null;         // arrastre de carta o de unidad en curso
  let ignorarClic = false;     // tras un arrastre, el clic que lo cierra no cuenta
  let primeroDeLaPartida = 0;  // quién empieza (para la presentación)
  let introVisible = false;
  let bannerTimer = null;
  let tablero = "terciopelo";
  try { tablero = localStorage.getItem("cartasTablero") || "terciopelo"; } catch (e) { /* sin almacenamiento */ }

  const local = () => modo === "local";
  const miTurno = () => est && est.ganador === null && est.activo === yo;
  const indiceYo = () => (local() ? M.quienActua(est) : yo);
  const ESPERA_REACCION = 20000;       // cuánto espera el rival para reaccionar
  const ESPERA_ACTOR = 22000;          // cuánto espera quien actuó antes de seguir sin su respuesta

  /* ---------------------------------------------------------------- avisos */
  function aviso(texto) {
    const el = $("btAviso");
    el.textContent = texto || "";
    el.classList.toggle("hidden", !texto);
  }
  let toastTimer = null;
  function toast(texto) {
    const el = $("btToast");
    el.textContent = texto;
    el.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
  }

  /* ----------------------------------------------------------------- lobby */
  const mazoPorId = id => mazos.find(m => m.id === id);
  const totalMazo = m => Object.values(m.cartas).reduce((s, n) => s + n, 0);
  const nombreDe = (idUsuario) => (jugadores.find(j => j.user_id === idUsuario) || {}).username;

  function opcionesMazos(seleccion) {
    return mazos.length
      ? mazos.map(m => `<option value="${m.id}" ${m.id === seleccion ? "selected" : ""}>${esc(m.nombre)} (${totalMazo(m)})</option>`).join("")
      : `<option value="">No tienes mazos</option>`;
  }

  function pintarLobby() {
    const eleccion = $("btMazo").value;
    $("btMazo").innerHTML = opcionesMazos(eleccion);
    $("btMazoInfo").innerHTML = mazos.length ? "" : `Primero arma un mazo en <a href="mazos.html">Mazos</a>.`;
    $("btLocalA").innerHTML = opcionesMazos($("btLocalA").value);
    $("btLocalB").innerHTML = opcionesMazos($("btLocalB").value || (mazos[1] || mazos[0] || {}).id);

    $("btJugadores").innerHTML = jugadores.length ? jugadores.map(j => `
      <li><span>${esc(j.username)}</span><button type="button" class="cartas-boton" data-retar="${j.user_id}">Retar</button></li>`).join("")
      : `<li class="bt-vacio">${miId ? "No hay otros jugadores." : "Inicia sesión para retar a alguien."}</li>`;

    const mias = id => partidas.filter(p => id(p));
    const recibidos = mias(p => p.estado === "pendiente" && p.j2 === miId);
    const enviados = mias(p => p.estado === "pendiente" && p.j1 === miId);
    const curso = mias(p => p.estado === "en_curso");
    const fin = mias(p => p.estado === "terminada").slice(0, 8);
    const rival = p => (p.j1 === miId ? p.nombre2 : p.nombre1);

    $("btRecibidos").innerHTML = recibidos.length ? recibidos.map(p => `
      <li><span>${esc(p.nombre1)} te retó</span>
        <select data-mazo-de="${p.id}">${opcionesMazos("")}</select>
        <button type="button" class="cartas-boton cartas-boton-principal" data-aceptar="${p.id}">Aceptar</button>
        <button type="button" class="cartas-boton" data-rechazar="${p.id}">Rechazar</button></li>`).join("")
      : `<li class="bt-vacio">Ninguno.</li>`;
    $("btEnviados").innerHTML = enviados.length ? enviados.map(p => `
      <li><span>A ${esc(p.nombre2)}, esperando respuesta</span><button type="button" class="cartas-boton" data-cancelar="${p.id}">Cancelar</button></li>`).join("")
      : `<li class="bt-vacio">Ninguno.</li>`;
    $("btCurso").innerHTML = curso.length ? curso.map(p => {
      const suTurno = p.turno === miId;
      return `<li><span>Contra ${esc(rival(p))}${suTurno ? " · <b class=\"bt-tuturno\">te toca</b>" : ""}</span>
        <button type="button" class="cartas-boton cartas-boton-principal" data-abrir="${p.id}">Jugar</button></li>`;
    }).join("") : `<li class="bt-vacio">Ninguna.</li>`;
    $("btTerminadas").innerHTML = fin.length ? fin.map(p => {
      const yoSoyJ1 = p.j1 === miId;
      const gane = p.resultado === (yoSoyJ1 ? "j1" : "j2");
      const texto = p.resultado === "empate" ? "Empate" : gane ? "Ganaste" : "Perdiste";
      return `<li><span>${texto} contra ${esc(rival(p))}${p.motivo === "rendicion" ? " (rendición)" : ""}</span></li>`;
    }).join("") : `<li class="bt-vacio">Todavía no hay.</li>`;
  }

  async function cargarJugadores() {
    try {
      const { data, error } = await supa.rpc("cartas_jugadores");
      if (error) throw error;
      jugadores = data || [];
    } catch (e) { jugadores = []; }
  }

  async function cargarPartidas() {
    try {
      const { data, error } = await supa.from("cartas_partidas").select("*").order("actualizada", { ascending: false }).limit(40);
      if (error) throw error;
      partidas = data || [];
    } catch (e) {
      partidas = [];
      if (miId) aviso("No se pudieron cargar las partidas. Si eres el máster, corre scratchpad/cartas_combate.sql en Supabase.");
    }
    if (modo === "partida") sincronizar();
    else if (modo === "lobby") pintarLobby();
  }

  let cargaPendiente = null;
  function programarCarga() {
    clearTimeout(cargaPendiente);
    cargaPendiente = setTimeout(cargarPartidas, 250);
  }

  async function accionServidor(rpc, args, ok) {
    const { error } = await supa.rpc(rpc, args);
    if (error) { toast(error.message || "No se pudo completar la acción."); return false; }
    if (ok) toast(ok);
    await cargarPartidas();
    return true;
  }

  async function retar(rivalId) {
    const m = mazoPorId($("btMazo").value);
    if (!m) { toast("Elige uno de tus mazos primero."); return; }
    await accionServidor("cartas_retar", { p_rival: rivalId, p_mazo: m.id, p_cartas: CartasCliente.instantanea(CartasCliente.aplanar(m.cartas)) }, "Reto enviado.");
  }

  async function responder(id, aceptar) {
    if (!aceptar) return accionServidor("cartas_responder", { p_id: id, p_aceptar: false, p_mazo: null, p_cartas: {} });
    const sel = document.querySelector(`[data-mazo-de="${id}"]`);
    const m = sel && mazoPorId(sel.value);
    if (!m) { toast("Elige uno de tus mazos para aceptar."); return; }
    const ok = await accionServidor("cartas_responder", { p_id: id, p_aceptar: true, p_mazo: m.id, p_cartas: CartasCliente.instantanea(CartasCliente.aplanar(m.cartas)) });
    if (ok) abrirPartida(id);
  }

  /* --------------------------------------------------------------- partida */
  function construir(f) {
    const e = M.crearPartida({
      semilla: f.semilla, primero: f.primero, cartas: f.cartas,
      jugadores: [{ id: f.j1, nombre: f.nombre1, mazo: f.mazo1 }, { id: f.j2, nombre: f.nombre2, mazo: f.mazo2 }]
    });
    const l = [];
    // Una acción que no vale se ignora igual en todos los navegadores
    for (const a of f.acciones) { M.reproducir(e, a); l.push(JSON.stringify(a)); }
    return { e, l };
  }

  function entrarPartida(titulo) {
    modo = modo === "local" ? "local" : "partida";
    sel = null;
    cerrando = false;
    mostradaMirada = "";
    reveladoPila = null;
    pvPrevios = new Map();
    ultimoTurno = 0;
    ultimoTerreno = "";
    arrastre = null;
    document.body.classList.add("bt-en-partida");
    $("btLobby").classList.add("hidden");
    $("btPartida").classList.remove("hidden");
    $("btFinal").classList.add("hidden");
    $("btTitulo").textContent = titulo;
    $("btRendirse").textContent = local() ? "Salir" : "Rendirse";
    aplicarTablero();
    pintarTablero();
    // Presentación: una vez por partida y sesión, y solo si la partida acaba de empezar
    let ver = true;
    if (fila) {
      try { ver = !sessionStorage.getItem(`btIntro:${fila.id}`); sessionStorage.setItem(`btIntro:${fila.id}`, "1"); } catch (e) { /* sin almacenamiento */ }
    }
    if (ver && est.turno <= 3) mostrarIntro();
    else anunciarTurno(true);
  }

  function abrirPartida(id) {
    const f = partidas.find(p => p.id === id);
    if (!f || f.estado === "pendiente" || f.estado === "rechazada") return;
    fila = f;
    modo = "partida";
    primeroDeLaPartida = f.primero;
    const { e, l } = construir(f);
    est = e; lista = l;
    yo = f.j1 === miId ? 0 : 1;
    entrarPartida(`${f.nombre1} contra ${f.nombre2}`);
    cerrarSiHaceFalta();
  }

  function empezarLocal() {
    const a = mazoPorId($("btLocalA").value), b = mazoPorId($("btLocalB").value);
    if (!a || !b) { toast("Elige dos mazos para probar."); return; }
    const cartas = CartasCliente.instantanea([...CartasCliente.aplanar(a.cartas), ...CartasCliente.aplanar(b.cartas)]);
    est = M.crearPartida({
      semilla: Math.floor(Math.random() * 2147483647), primero: Math.random() < 0.5 ? 0 : 1, cartas,
      jugadores: [{ id: "a", nombre: a.nombre, mazo: CartasCliente.aplanar(a.cartas) }, { id: "b", nombre: b.nombre === a.nombre ? `${b.nombre} (2)` : b.nombre, mazo: CartasCliente.aplanar(b.cartas) }]
    });
    fila = null; lista = [];
    primeroDeLaPartida = est.activo;
    modo = "local";
    entrarPartida("Prueba en solitario");
  }

  function volverAlLobby() {
    modo = "lobby";
    est = null; fila = null;
    document.body.classList.remove("bt-en-partida");
    ocultarFlecha();
    $("btPartida").classList.add("hidden");
    $("btLobby").classList.remove("hidden");
    cargarPartidas();
  }

  /* Trae del servidor las acciones que todavía no se aplicaron */
  function sincronizar() {
    if (!fila) return;
    const nueva = partidas.find(p => p.id === fila.id);
    if (!nueva) return;
    fila = nueva;
    // ¿Lo que ya aplicamos coincide con lo que guardó el servidor? Si no (por una carrera entre jugadores), se rehace
    const acciones = fila.acciones;
    const comun = Math.min(lista.length, acciones.length);
    let i = 0;
    while (i < comun && lista[i] === JSON.stringify(acciones[i])) i++;
    if (i < comun) {
      const r = construir(fila);
      est = r.e; lista = r.l;
    } else {
      for (let k = lista.length; k < acciones.length; k++) {
        M.reproducir(est, acciones[k]);
        lista.push(JSON.stringify(acciones[k]));
      }
    }
    if (fila.estado === "terminada" && est.ganador === null) {
      // El rival se rindió
      est.ganador = fila.resultado === "empate" ? "empate" : fila.resultado === "j1" ? 0 : 1;
      est.motivo = fila.motivo || "rendicion";
    }
    pintarTablero();
    cerrarSiHaceFalta();
  }

  async function cerrarSiHaceFalta() {
    if (local() || !est || est.ganador === null || !fila || fila.estado !== "en_curso" || cerrando || est.motivo === "rendicion") return;
    cerrando = true;
    const resultado = est.ganador === "empate" ? "empate" : est.ganador === 0 ? "j1" : "j2";
    try { await supa.rpc("cartas_terminar", { p_id: fila.id, p_resultado: resultado }); } catch (e) { /* lo intentará el otro jugador */ }
    await cargarPartidas();
  }

  async function enviar(accion) {
    if (!est || est.ganador !== null) return;
    let jugador = indiceYo();
    const sigueSinEsperar = !!accion.forzar && est.activo === yo;
    if (sigueSinEsperar) jugador = yo;
    else if (!local() && M.quienActua(est) !== yo) { toast(est.pendiente ? "Espera la respuesta de tu rival." : "No es tu turno."); return; }
    const r = M.aplicar(est, accion, jugador);
    if (r.error) { toast(r.error); return; }
    sel = null;
    if (!local()) {
      lista.push(JSON.stringify(accion));
      pintarTablero();
      const { error } = await supa.rpc("cartas_accion", { p_id: fila.id, p_accion: accion });
      if (error) {
        toast(error.message || "No se pudo enviar la jugada.");
        await cargarPartidas();
        const r2 = construir(partidas.find(p => p.id === fila.id) || fila);
        est = r2.e; lista = r2.l;
        pintarTablero();
        return;
      }
      cerrarSiHaceFalta();
    } else {
      pintarTablero();
    }
  }

  async function rendirse() {
    if (local()) { volverAlLobby(); return; }
    if (!est || est.ganador !== null || !(await dialogo.confirmar("¿Te rindes?", { titulo: "Rendirse", aceptar: "Rendirme", peligro: true }))) return;
    await accionServidor("cartas_rendirse", { p_id: fila.id });
  }

  /* ---------------------------------------------------------------- dibujo */
  const verMeta = u => M.meta(est, u.cartaId);

  /* Datos de la carta con los números de ahora, para dibujarla en el campo */
  function vistaUnidad(u) {
    const m = verMeta(u);
    return Object.assign({}, m, { id: u.cartaId, atq: M.atqEfectivo(est, u), pv: u.pv, borrador: false, limite: null });
  }

  function htmlUnidad(u, miIdx) {
    const m = verMeta(u);
    let html = htmlCarta(vistaUnidad(u), true, 0, null);
    if (u.pv < u.pvMax) html = html.replace('class="carta-stat pv"', 'class="carta-stat pv herida"');
    if (M.atqEfectivo(est, u) > u.atqBase) html = html.replace('class="carta-stat atq"', 'class="carta-stat atq sube"');
    const chips = [];
    if (M.tienePalabra(est, u, "provocar")) chips.push("Provocar");
    if (M.tienePalabra(est, u, "volar")) chips.push("Volar");
    if (u.flags.marcadaPor !== null) chips.push("Marcada");
    if (u.flags.intocableHasta >= est.turno) chips.push("Oculta");
    if (u.flags.inmune) chips.push("Protegida");
    if (u.flags.noAtacaHasta >= est.turno) chips.push("Inmóvil");
    if (u.entro === est.turno && u.dueno === est.activo) chips.push("Recién llegada");
    const listo = u.dueno === miIdx && miTurnoDe(miIdx) && M.unidadPuedeAtacar(est, u);
    return `<div class="bt-unidad ${listo ? "lista" : ""} ${sel && sel.uid === u.uid ? "elegida" : ""}" data-uid="${u.uid}" title="${esc(m.nombre)}">
      ${html}
      <div class="bt-chips">${chips.map(c => `<span>${c}</span>`).join("")}</div>
    </div>`;
  }

  // Turno normal de ese jugador (sin ninguna reacción en el aire)
  const miTurnoDe = idx => est.ganador === null && est.activo === idx && !est.pendiente;
  // Le toca decidir si reacciona
  const reaccionaYo = idx => est.ganador === null && !!est.pendiente && est.pendiente.reactor === idx;

  /* Orbe de energía: se llena con la energía que queda y se vacía al gastarla. Si hay una carta elegida,
     la parte que gastaría se ve en naranja. */
  function htmlOrbe(J, idx) {
    const max = Math.max(J.energiaMax, 1);
    const llena = Math.min(100, Math.round((100 * J.energia) / max));
    let gasto = 0;
    if (sel && sel.tipo === "mano" && idx === indiceYo() && miTurnoDe(idx)) {
      const id = J.mano[sel.i];
      if (id && !M.esReaccion(est, id)) gasto = Math.min(J.energia, M.costeDe(est, idx, id));
    }
    const gastoPct = Math.round((100 * gasto) / max);
    const extra = J.energia > J.energiaMax ? `<b class="extra">+${J.energia - J.energiaMax}</b>` : "";
    return `<div class="bt-orbe energia ${J.energia === 0 ? "vacia" : ""}" title="Energía: ${J.energia} de ${J.energiaMax}" style="--llena:${llena}%;--gasto:${gastoPct}%">
      <div class="liquido"></div><div class="gasto"></div>
      <span class="num">${J.energia}</span><small>/ ${J.energiaMax}</small>${extra}
    </div>${gasto ? `<span class="bt-orbe-gasto">−${gasto}</span>` : ""}`;
  }

  /* El mazo sobre la mesa, boca abajo. Si has mirado la carta superior (Cuervo del augurio), se da vuelta
     y se queda a la vista: es la siguiente que robarás. Solo la ves tú; la del rival siempre va boca abajo. */
  function htmlPila(J, idx, rival) {
    const n = J.mazo.length;
    const rev = !rival && reveladoPila && n > 0 && reveladoPila.largo === n && J.mazo[0] === reveladoPila.carta;
    let frente = "", nombre = "";
    if (rev) {
      const m = M.meta(est, reveladoPila.carta);
      nombre = m.nombre;
      const vista = Object.assign({}, m, { id: reveladoPila.carta, coste: M.costeDe(est, idx, reveladoPila.carta), borrador: false, limite: null });
      frente = `<div class="bt-pila-frente">${htmlCarta(vista, true, 0, null)}</div>`;
    }
    return `<div class="bt-pila ${n === 0 ? "vacia" : ""} ${rev ? "con-revelada" : ""}" title="${rev ? `Siguiente carta: ${esc(nombre)}` : `Mazo: ${n} cartas`}">
      ${n > 2 ? '<i class="bt-pila-capa c2"></i>' : ""}${n > 1 ? '<i class="bt-pila-capa c1"></i>' : ""}
      ${n ? `<div class="bt-pila-tope ${rev ? "revelada" : ""}"><div class="bt-pila-giro"><div class="bt-vuelo-dorso"><i></i></div>${frente}</div></div>` : '<div class="bt-pila-vacia">0</div>'}
    </div>`;
  }

  function htmlJugador(idx, rival) {
    const J = est.jugadores[idx];
    const activo = est.ganador === null && est.activo === idx;
    return `<div class="bt-orbe vida ${J.vida <= 5 ? "baja" : ""}" title="Vida"><span class="num">${Math.max(0, J.vida)}</span></div>
      <div class="bt-datos">
        <div class="bt-nombre">${esc(J.nombre)}${activo ? '<em class="bt-tag-turno">Su turno</em>' : ""}</div>
        <div class="bt-conteo">${rival ? `Mano <strong>${J.mano.length}</strong> · ` : ""}Mazo <strong>${J.mazo.length}</strong></div>
      </div>
      ${htmlPila(J, idx, rival)}
      ${htmlOrbe(J, idx)}
      ${rival ? '<div class="bt-atacar-cartel">⚔ Atacar al jugador</div>' : ""}`;
  }

  function objetivosVigentes() {
    // Lista de objetivos { u } / { j } que se pueden elegir con la selección actual
    if (!sel || est.pendiente || !miTurnoDe(indiceYo())) return [];
    const idx = indiceYo();
    if (sel.tipo === "mano") {
      const id = est.jugadores[idx].mano[sel.i];
      const req = id && M.requisitoDeJugada(est, idx, id);
      return req ? req.validos : [];
    }
    if (sel.tipo === "unidad") {
      const u = M.buscar(est, sel.uid);
      if (!u || !M.unidadPuedeAtacar(est, u.u)) return [];
      const v = M.objetivosDeAtaque(est, sel.uid);
      return [...v.unidades.map(x => ({ u: x })), ...(v.jugador ? [{ j: 1 - idx }] : [])];
    }
    return [];
  }

  /* Animación de robar: la carta sale del mazo, cruza la mesa y se gira en la mano. Para el rival
     solo viaja el dorso hasta su contador de mano. Se compara la mano con la del dibujo anterior,
     así que sirve también para cartas que llegan por efectos. */
  let robo = null;   // lo que había en la última pasada: mano propia, mazo, turno y manos del rival
  function sinAnimaciones() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function pulso(el) {
    if (!el) return;
    el.classList.remove("bt-pulso"); void el.offsetWidth; el.classList.add("bt-pulso");
    el.addEventListener("animationend", () => el.classList.remove("bt-pulso"), { once: true });
  }
  function volar(origen, destino, opts) {
    const a = origen.getBoundingClientRect(), d = destino.getBoundingClientRect();
    const ancho = opts.ancho, alto = opts.alto;
    const fantasma = document.createElement("div");
    fantasma.className = "bt-vuelo" + (opts.soloDorso ? " solo-dorso" : "");
    fantasma.style.cssText = `left:${d.left + d.width / 2 - ancho / 2}px;top:${d.top + d.height / 2 - alto / 2}px;width:${ancho}px;height:${alto}px`;
    fantasma.innerHTML = `<div class="bt-vuelo-giro"><div class="bt-vuelo-dorso"><i></i></div>${opts.frente ? `<div class="bt-vuelo-frente">${opts.frente}</div>` : ""}</div>`;
    document.body.appendChild(fantasma);
    const dx = a.left + a.width / 2 - (d.left + d.width / 2), dy = a.top + a.height / 2 - (d.top + d.height / 2);
    const giro = opts.giro || 0;
    const viaje = fantasma.animate(opts.soloDorso
      ? [{ transform: `translate(${dx}px,${dy}px) scale(.55) rotate(-10deg)`, opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { transform: "translate(0,0) scale(.2) rotate(8deg)", opacity: 0 }]
      : [{ transform: `translate(${dx}px,${dy}px) scale(.3) rotate(-14deg)`, opacity: 0 }, { opacity: 1, offset: .12 }, { transform: `translate(${dx * .15}px,${dy * .15 - 30}px) scale(1.12) rotate(${giro / 2}deg)`, offset: .78 }, { transform: `translate(0,0) scale(1) rotate(${giro}deg)`, opacity: 1 }],
      { duration: opts.duracion, delay: opts.retraso, easing: "cubic-bezier(.22,.8,.3,1)", fill: "both" });
    if (!opts.soloDorso) {
      fantasma.querySelector(".bt-vuelo-giro").animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(0deg)", offset: .4 }, { transform: "rotateY(180deg)" }],
        { duration: opts.duracion, delay: opts.retraso, easing: "ease-in-out", fill: "both" });
    }
    return viaje.finished.catch(() => {}).then(() => fantasma.remove());
  }
  function animarRobos(idx) {
    const J = est.jugadores[idx], R = est.jugadores[1 - idx];
    const antes = robo;
    robo = { mano: J.mano.slice(), mazo: J.mazo.length, turno: est.turno, manoRival: R.mano.length, mazoRival: R.mazo.length };
    // Partida nueva (el mazo crece o el turno vuelve atrás) o primer dibujo: nada que animar
    if (!antes || J.mazo.length > antes.mazo || est.turno < antes.turno || R.mazo.length > antes.mazoRival) return;
    if (document.hidden || sinAnimaciones()) return;

    // Cartas propias nuevas: lo que hay ahora en la mano y no estaba antes
    const restantes = new Map();
    antes.mano.forEach(id => restantes.set(id, (restantes.get(id) || 0) + 1));
    const nuevas = [];
    J.mano.forEach((id, i) => {
      const n = restantes.get(id) || 0;
      if (n > 0) restantes.set(id, n - 1); else nuevas.push(i);
    });
    const mazoYo = document.querySelector("#btYo .bt-pila") || document.querySelector("#btYo .bt-conteo strong:last-child");
    if (nuevas.length && mazoYo) {
      nuevas.slice(0, 4).forEach((i, k) => {
        const el = document.querySelector(`#btMano [data-i="${i}"]`);
        if (!el) return;
        const cartaEl = el.querySelector(".carta");
        const frente = cartaEl ? cartaEl.outerHTML : "";
        el.style.visibility = "hidden";
        const giro = parseFloat(el.style.getPropertyValue("--r")) || 0;
        pulso(document.querySelector("#btYo .bt-conteo strong:last-child"));
        volar(mazoYo, el, { ancho: el.offsetWidth, alto: el.offsetHeight || el.offsetWidth * 1.5, frente, giro, duracion: 760, retraso: k * 190 })
          .then(() => {
            el.style.visibility = "";
            el.classList.add("bt-llega");
            el.addEventListener("animationend", () => el.classList.remove("bt-llega"), { once: true });
          });
      });
      nuevas.slice(4).forEach(i => { const el = document.querySelector(`#btMano [data-i="${i}"]`); if (el) el.classList.add("bt-llega"); });
    }

    // Cartas del rival: el dorso viaja del mazo a su contador de mano
    const robadasRival = R.mano.length - antes.manoRival;
    const mazoR = document.querySelector("#btRival .bt-pila") || document.querySelector("#btRival .bt-conteo strong:last-child");
    const manoR = document.querySelector("#btRival .bt-conteo strong:first-child");
    if (robadasRival > 0 && mazoR && manoR) {
      pulso(document.querySelector("#btRival .bt-conteo strong:last-child"));
      for (let k = 0; k < Math.min(robadasRival, 4); k++) {
        volar(mazoR, manoR, { ancho: 46, alto: 69, soloDorso: true, duracion: 640, retraso: k * 170 }).then(() => { if (k === 0) pulso(manoR); });
      }
    }
  }

  function pintarTablero() {
    if (!est) return;
    if (arrastre && arrastre.activo) { arrastre.repintar = true; return; }
    const idx = indiceYo();
    const rival = 1 - idx;
    const J = est.jugadores[idx];
    const mesa = $("btMesa");

    mesa.dataset.turno = est.ganador !== null ? "fin" : reaccionaYo(idx) ? "reaccion" : miTurnoDe(idx) ? "mio" : "rival";

    // Los paneles de jugador no se vuelven a crear: se les quita la marca de objetivo de la vez anterior
    ["btRival", "btYo"].forEach(id => $(id).classList.remove("objetivo", "sobre"));
    $("btRival").innerHTML = htmlJugador(rival, true);
    $("btYo").innerHTML = htmlJugador(idx, false);
    $("btRival").classList.toggle("activo", est.ganador === null && est.activo === rival);
    $("btYo").classList.toggle("activo", est.ganador === null && est.activo === idx);

    // Seis huecos por campo: se ve cuánto sitio queda
    // Cada unidad ocupa el hueco que se eligió al jugarla; los demás quedan vacíos en su sitio
    const htmlCampo = Jx => Array.from({ length: M.C.CAMPO_MAX }, (_, k) => {
      const u = Jx.campo.find(x => x.hueco === k);
      return u ? htmlUnidad(u, idx) : `<div class="bt-hueco" data-hueco="${k}"></div>`;
    }).join("");
    $("btCampoRival").innerHTML = htmlCampo(est.jugadores[rival]);
    $("btCampoYo").innerHTML = htmlCampo(J);
    // Con una unidad de la mano elegida, los huecos libres de tu campo se ofrecen como destino
    const cartaElegida = sel && sel.tipo === "mano" ? J.mano[sel.i] : null;
    $("btCampoYo").classList.toggle("eligiendo", !!(cartaElegida && M.esUnidad(M.meta(est, cartaElegida)) && miTurnoDe(idx) && !est.pendiente));

    pintarCentro(idx);
    aplicarBioma();

    const n = J.mano.length;
    const medio = (n - 1) / 2;
    $("btMano").innerHTML = J.mano.map((id, i) => {
      const m = M.meta(est, id);
      const coste = M.costeDe(est, idx, id);
      const esReaccion = M.esReaccion(est, id);
      const jugable = est.pendiente
        ? reaccionaYo(idx) && M.reaccionesPosibles(est, idx, est.pendiente.evento).includes(i)
        : miTurnoDe(idx) && coste <= J.energia && !esReaccion;
      const vista = Object.assign({}, m, { id, coste, borrador: false, limite: null });
      const giro = ((i - medio) * Math.min(4, 22 / Math.max(n, 1))).toFixed(1);
      const baja = (Math.abs(i - medio) ** 2 * 1.4).toFixed(1);
      return `<div class="bt-carta ${jugable ? "jugable" : ""} ${esReaccion ? "es-reaccion" : ""} ${sel && sel.tipo === "mano" && sel.i === i ? "elegida" : ""}" data-i="${i}" style="--r:${giro}deg;--y:${baja}px">${esReaccion ? '<span class="bt-etiqueta">Reacción</span>' : ""}${htmlCarta(vista, true, 0, null)}</div>`;
    }).join("") || `<p class="bt-vacio">Sin cartas en la mano</p>`;
    animarRobos(idx);

    // Objetivos que se pueden elegir
    objetivosVigentes().forEach(o => {
      const el = o.u !== undefined ? document.querySelector(`[data-uid="${o.u}"]`) : document.querySelector(`[data-jugador="${o.j === idx ? "yo" : "rival"}"]`);
      if (el) el.classList.add("objetivo");
    });

    // Golpes: parpadeo de las unidades que perdieron vida
    est.jugadores.forEach(Jx => Jx.campo.forEach(u => {
      const antes = pvPrevios.get(u.uid);
      if (antes !== undefined && u.pv < antes) {
        const el = document.querySelector(`[data-uid="${u.uid}"]`);
        if (el) el.classList.add("golpe");
      }
      pvPrevios.set(u.uid, u.pv);
    }));

    const turnoEl = $("btTurno");
    const reactor = est.pendiente ? est.jugadores[est.pendiente.reactor].nombre : "";
    turnoEl.textContent = est.ganador !== null ? "Partida terminada"
      : est.pendiente ? (local() ? `${reactor} puede reaccionar` : reaccionaYo(idx) ? "Puedes reaccionar" : `Esperando la reacción de ${reactor}`)
      : local() ? `Turno de ${est.jugadores[est.activo].nombre}` : miTurno() ? "Es tu turno" : `Turno de ${est.jugadores[est.activo].nombre}`;
    turnoEl.className = `bt-turno ${miTurnoDe(idx) || reaccionaYo(idx) ? "mio" : ""}`;
    pintarVentana();

    $("btLog").innerHTML = est.log.slice(-40).map(l => `<li class="${l.startsWith("—") ? "turno" : ""}">${esc(l)}</li>`).join("");
    $("btLog").scrollTop = $("btLog").scrollHeight;
    pintarInspector();
    pintarFinal();
    avisarMirada();
    anunciarTurno(false);
    anunciarTerreno();
  }

  /* Franja del centro: terreno actual, de quién es el turno y el botón de terminar turno */
  function pintarCentro(idx) {
    const T = est.terreno;
    const m = T ? M.meta(est, T.cartaId) : null;
    const terreno = T
      ? `<div class="bt-terreno-ficha carta-rareza-${esc(m.rareza)}" title="${esc(m.habilidad)}">
          <span class="bt-terreno-icono"></span>
          <div><strong>${esc(m.nombre)}</strong><small>${T.restantes === null ? "hasta que entre otro" : `${T.restantes} turno${T.restantes === 1 ? "" : "s"}`} · de ${esc(est.jugadores[T.dueno].nombre)}</small></div>
        </div>`
      : `<div class="bt-terreno-ficha vacia"><span class="bt-terreno-icono"></span><div><small>Sin terreno</small></div></div>`;
    const miTurnoAhora = miTurnoDe(idx);
    const cinta = est.ganador !== null ? "Fin de la partida"
      : est.pendiente ? (reaccionaYo(idx) ? "¡Reacciona!" : "Esperando respuesta")
      : local() ? `Turno de ${est.jugadores[est.activo].nombre}` : miTurnoAhora ? "Tu turno" : `Turno de ${est.jugadores[est.activo].nombre}`;
    $("btCentro").innerHTML = `${terreno}
      <div class="bt-cinta ${miTurnoAhora ? "mio" : ""}">${esc(cinta)}</div>
      <button type="button" id="btFin" class="bt-fin ${miTurnoAhora ? "activo" : ""}" ${miTurnoAhora ? "" : "disabled"}>Terminar turno</button>`;
  }

  /* ----------------------------------------------------------- tableros y biomas */
  const TABLEROS = [
    { id: "terciopelo", nombre: "Terciopelo" },
    { id: "pano", nombre: "Paño verde" },
    { id: "taberna", nombre: "Mesa de taberna" },
    { id: "cripta", nombre: "Cripta" },
    { id: "bosque", nombre: "Claro del bosque" },
    { id: "cenizas", nombre: "Llanura de ceniza" },
    { id: "glaciar", nombre: "Glaciar" }
  ];
  // Cada terreno cambia el ambiente de todo el tablero (ver css/cartas-juego.css)
  const BIOMAS = {
    "puente-de-las-legiones": "puente", "los-huesos": "huesos", "glaciar-eterno": "hielo", "vado-ceniza": "ceniza",
    "desierto-de-cenizas": "desierto", "catedral-del-juramento": "catedral", "el-crater": "crater", "kigan": "puerto",
    "torre-del-silencio": "torre", "la-espesura": "espesura", "osario-de-la-frontera": "osario", "cueva-de-carne": "carne"
  };

  function aplicarTablero() {
    if (!TABLEROS.some(t => t.id === tablero)) tablero = "terciopelo";
    $("btMesa").dataset.tablero = tablero;
    $("btTablero").value = tablero;
  }

  let biomaActual = "";
  function aplicarBioma() {
    const el = $("btBioma");
    const T = est && est.terreno;
    const nuevo = T ? (BIOMAS[T.cartaId] || "generico") : "";
    if (nuevo === biomaActual) return;
    biomaActual = nuevo;
    // Se desvanece el ambiente anterior y entra el nuevo
    el.classList.remove("on");
    setTimeout(() => {
      if (biomaActual !== nuevo) return;
      el.dataset.b = nuevo;
      if (nuevo) { void el.offsetWidth; el.classList.add("on"); }
    }, nuevo && el.dataset.b ? 450 : 0);
  }

  function mostrarBanner(titulo, subtitulo, clase, ms) {
    const b = $("btBanner");
    b.className = `bt-banner ${clase || ""}`;
    b.innerHTML = `<strong>${esc(titulo)}</strong>${subtitulo ? `<span>${esc(subtitulo)}</span>` : ""}`;
    void b.offsetWidth;
    b.classList.add("visible");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove("visible"), ms || 1900);
  }

  /* Cartel grande cuando cambia el turno */
  function anunciarTurno(forzar) {
    if (!est || introVisible || est.ganador !== null) return;
    if (!forzar && est.turno === ultimoTurno) return;
    const primera = ultimoTurno === 0;
    ultimoTurno = est.turno;
    if (primera && !forzar) return;
    const idx = indiceYo();
    const mio = est.activo === idx || local();
    mostrarBanner(local() ? `Turno de ${est.jugadores[est.activo].nombre}` : mio ? "Tu turno" : `Turno de ${est.jugadores[est.activo].nombre}`,
      `Turno ${est.turno}`, local() ? "mio" : mio ? "mio" : "rival");
  }

  /* Cartel cuando entra un terreno nuevo (o se va) */
  function anunciarTerreno() {
    const T = est.terreno;
    const clave = T ? `${T.cartaId}:${T.desde}` : "";
    if (clave === ultimoTerreno) return;
    const habiaAntes = ultimoTerreno !== "";
    ultimoTerreno = clave;
    if (introVisible) return;
    if (T) {
      const m = M.meta(est, T.cartaId);
      mostrarBanner(m.nombre, m.habilidad, "terreno", 3200);
    } else if (habiaAntes) {
      mostrarBanner("El terreno se desvanece", "", "terreno", 1600);
    }
  }

  /* Presentación de la partida: los dos nombres, el sorteo y quién empieza */
  function mostrarIntro() {
    const el = $("btIntro");
    const a = indiceYo(), b = 1 - a;
    const JA = est.jugadores[a], JB = est.jugadores[b];
    const empieza = est.jugadores[primeroDeLaPartida].nombre;
    introVisible = true;
    el.innerHTML = `<div class="bt-intro-caja">
        <div class="bt-intro-j izq"><small>${local() ? "Jugador 1" : "Tú"}</small><strong>${esc(JA.nombre)}</strong></div>
        <div class="bt-intro-vs">VS</div>
        <div class="bt-intro-j der"><small>${local() ? "Jugador 2" : "Rival"}</small><strong>${esc(JB.nombre)}</strong></div>
        <div class="bt-intro-moneda"><i></i></div>
        <p class="bt-intro-primero">Empieza <strong>${esc(empieza)}</strong></p>
        <small class="bt-intro-skip">Toca para empezar</small>
      </div>`;
    el.className = "bt-intro";
    const cerrar = () => {
      if (!introVisible) return;
      introVisible = false;
      el.classList.add("salir");
      setTimeout(() => { el.classList.add("hidden"); el.classList.remove("salir"); }, 500);
      anunciarTurno(true);
    };
    el.onclick = cerrar;
    setTimeout(cerrar, 4200);
  }

  /* ----------------------------------------------------------------- flechas */
  function posicionEnMesa(el) {
    const r = el.getBoundingClientRect(), m = $("btMesa").getBoundingClientRect();
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top };
  }

  function dibujarFlecha(a, b, valida) {
    const svg = $("btFlecha");
    const dx = b.x - a.x, dy = b.y - a.y;
    const cx = (a.x + b.x) / 2 - dy * 0.12, cy = (a.y + b.y) / 2 + dx * 0.12 - Math.min(90, Math.hypot(dx, dy) * 0.25);
    // La punta se orienta con la tangente de la curva y el trazo termina donde empieza su base
    let tx = b.x - cx, ty = b.y - cy;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const escala = valida ? 1.2 : 1;
    const d = `M${a.x},${a.y} Q${cx},${cy} ${b.x - tx * 22 * escala},${b.y - ty * 22 * escala}`;
    ["btFlechaSombra", "btFlechaTrazo", "btFlechaBrillo"].forEach(id => $(id).setAttribute("d", d));
    $("btFlechaPunta").setAttribute("transform", `translate(${b.x},${b.y}) rotate(${(Math.atan2(ty, tx) * 180 / Math.PI).toFixed(1)}) scale(${escala})`);
    $("btFlechaOrigen").setAttribute("transform", `translate(${a.x},${a.y})`);
    $("btFlechaDiana").setAttribute("transform", `translate(${b.x},${b.y})`);
    const g = $("btFlechaGrad");
    g.setAttribute("x1", a.x); g.setAttribute("y1", a.y); g.setAttribute("x2", b.x); g.setAttribute("y2", b.y);
    svg.classList.add("visible");
    svg.classList.toggle("valida", !!valida);
  }
  const ocultarFlecha = () => $("btFlecha").classList.remove("visible", "valida");

  /* Panel de la reacción en el aire: a quien le toca decidir le ofrece sus cartas; al otro le avisa de que espera */
  function pintarVentana() {
    const el = $("btVentana");
    const p = est && est.ganador === null ? est.pendiente : null;
    if (!p) { el.classList.add("hidden"); ventana = { id: 0, desde: 0, enviado: false }; return; }
    if (ventana.id !== p.id) ventana = { id: p.id, desde: Date.now(), enviado: false };
    const idx = indiceYo();
    const hit = p.tipo === "ataque" ? M.buscar(est, p.datos.uid) : null;
    const objetivoU = p.tipo === "ataque" && p.datos.objetivo.u !== undefined ? M.buscar(est, p.datos.objetivo.u) : null;
    const quien = est.jugadores[p.actor].nombre;
    const que = p.tipo === "ataque"
      ? `${quien} ataca con ${hit ? M.nombre(est, hit.u) : "una unidad"} a ${objetivoU ? M.nombre(est, objetivoU.u) : est.jugadores[p.datos.objetivo.j].nombre}.`
      : `${quien} juega ${M.meta(est, p.datos.id).nombre}.`;
    const cuenta = local() ? "" : `<span id="btCuenta" class="bt-cuenta"></span>`;
    if (reaccionaYo(idx)) {
      const vistas = new Set();
      const botones = M.reaccionesPosibles(est, idx, p.evento).filter(i => {
        // Una sola opción por carta distinta, aunque haya copias en la mano
        const id = est.jugadores[idx].mano[i];
        if (vistas.has(id)) return false;
        vistas.add(id);
        return true;
      }).map(i => {
        const id = est.jugadores[idx].mano[i];
        return `<button type="button" class="cartas-boton cartas-boton-principal" data-reaccionar="${i}">Reaccionar con ${esc(M.meta(est, id).nombre)} (${M.costeDe(est, idx, id)})</button>`;
      }).join("");
      el.innerHTML = `<p><strong>${esc(que)}</strong></p><div class="bt-ventana-botones">${botones}<button type="button" class="cartas-boton" data-pasar>Dejar pasar</button>${cuenta}</div>`;
    } else {
      el.innerHTML = `<p><strong>${esc(que)}</strong></p><p class="bt-nota">Esperando la reacción de ${esc(est.jugadores[p.reactor].nombre)}... ${cuenta}</p>`;
    }
    el.classList.remove("hidden");
    actualizarCuenta();
  }

  /* Cuenta atrás de la reacción. Al acabar, el rival pasa solo; si no responde, quien actuó sigue sin esperarlo. */
  function actualizarCuenta() {
    if (!est || !est.pendiente || local() || est.ganador !== null) return;
    const p = est.pendiente;
    if (ventana.id !== p.id) return;
    const soyReactor = est.pendiente.reactor === yo;
    const limite = soyReactor ? ESPERA_REACCION : ESPERA_ACTOR;
    const falta = Math.max(0, Math.ceil((limite - (Date.now() - ventana.desde)) / 1000));
    const el = $("btCuenta");
    if (el) el.textContent = `${falta} s`;
    if (falta === 0 && !ventana.enviado) {
      ventana.enviado = true;
      enviar(soyReactor ? { t: "pasar" } : { t: "pasar", forzar: true });
    }
  }
  setInterval(actualizarCuenta, 500);

  function pintarInspector() {
    const el = $("btInspector");
    const idx = indiceYo();
    let c = null, extra = "";
    if (sel && sel.tipo === "mano") {
      const id = est.jugadores[idx].mano[sel.i];
      if (id) {
        const m = M.meta(est, id);
        c = Object.assign({}, m, { id, coste: M.costeDe(est, idx, id), borrador: false, limite: null });
        const req = M.requisitoDeJugada(est, idx, id);
        const energia = est.jugadores[idx].energia;
        if (M.esReaccion(est, id)) {
          if (reaccionaYo(idx) && M.reaccionesPosibles(est, idx, est.pendiente.evento).includes(sel.i)) extra = `<button type="button" class="cartas-boton cartas-boton-principal" data-reaccionar="${sel.i}">Reaccionar (${c.coste})</button>`;
          else if (reaccionaYo(idx)) extra = `<p class="bt-nota">No encaja con lo que está pasando, o no te alcanza la energía.</p>`;
          else extra = `<p class="bt-nota">Se juega como respuesta en el turno del rival, con la energía que te sobre.</p>`;
        }
        else if (!miTurnoDe(idx)) extra = `<p class="bt-nota">Espera tu turno.</p>`;
        else if (c.coste > energia) extra = `<p class="bt-nota">Te faltan ${c.coste - energia} de energía.</p>`;
        else if (req && req.validos.length) extra = `<p class="bt-nota">Elige un objetivo resaltado en el tablero.</p>`;
        else if (req && !req.opcional) extra = `<p class="bt-nota">No hay objetivos válidos para esta carta.</p>`;
        else extra = `<button type="button" class="cartas-boton cartas-boton-principal" data-jugar>Jugar (${c.coste})</button>`;
      }
    } else if (sel && (sel.tipo === "unidad" || sel.tipo === "ver")) {
      const hit = M.buscar(est, sel.uid);
      if (hit) {
        c = vistaUnidad(hit.u);
        const jug = hit.j === idx;
        if (jug && miTurnoDe(idx)) extra = M.unidadPuedeAtacar(est, hit.u) ? `<p class="bt-nota">Elige a quién atacar.</p>` : `<p class="bt-nota">Esta unidad no puede atacar ahora.</p>`;
        extra += `<p class="bt-nota">Vida ${hit.u.pv}/${hit.u.pvMax} · Ataque ${c.atq}</p>`;
      }
    }
    if (!c) { el.innerHTML = `<p class="bt-nota">Pasa el ratón o elige una carta o unidad para verla aquí.</p>`; return; }
    el.innerHTML = `<div class="bt-inspector-carta">${htmlCarta(c, true, 0, null)}</div>
      <div class="bt-inspector-texto"><h3>${esc(c.nombre)}</h3><p class="carta-meta">${esc(c.tipo)} · ${esc((window.CARTAS_RAREZAS[c.rareza] || {}).nombre || c.rareza)}</p>${c.habilidad ? `<p>${esc(c.habilidad)}</p>` : ""}${extra}</div>`;
  }

  function pintarFinal() {
    const el = $("btFinal");
    if (est.ganador === null) { el.classList.add("hidden"); return; }
    let texto;
    if (est.ganador === "empate") texto = "Empate";
    else if (local()) texto = `Gana ${est.jugadores[est.ganador].nombre}`;
    else texto = est.ganador === yo ? "¡Ganaste!" : "Perdiste";
    const motivo = est.motivo === "rendicion" ? "Por rendición." : "";
    el.innerHTML = `<h2>${esc(texto)}</h2><p>${motivo}</p><button type="button" class="cartas-boton cartas-boton-principal" id="btVolver2">Volver al lobby</button>`;
    el.classList.remove("hidden");
  }

  /* El Cuervo del augurio deja ver la carta superior, solo a su dueño */
  function avisarMirada() {
    const m = est.mirada;
    if (!m || m.turno !== est.turno || m.j !== indiceYo()) return;
    const clave = `${m.turno}-${m.carta || (m.cartas || []).join("+")}-${m.j}`;
    if (clave === mostradaMirada) return;
    mostradaMirada = clave;
    if (m.cartas) toast(`Lectura: ${m.cartas.map(id => M.meta(est, id).nombre).join(", ")}. Robas ${M.meta(est, m.elegida).nombre}.`);
    else if (m.carta) {
      // La carta superior del mazo se levanta, se da vuelta y queda a la vista hasta que se robe
      reveladoPila = { carta: m.carta, largo: est.jugadores[m.j].mazo.length };
      const vieja = document.querySelector("#btYo .bt-pila");
      if (vieja) vieja.outerHTML = htmlPila(est.jugadores[m.j], m.j, false);
      animarRevelado();
    } else toast("Tu mazo está vacío.");
  }

  function animarRevelado() {
    if (sinAnimaciones()) return;
    const tope = document.querySelector("#btYo .bt-pila-tope");
    if (!tope) return;
    const giro = tope.querySelector(".bt-pila-giro");
    const opts = { duration: 2600, easing: "cubic-bezier(.2,.8,.25,1)" };
    const arriba = "translateY(-96px) scale(3.1)";
    tope.animate([{ transform: "translateY(0) scale(1)" }, { transform: arriba, offset: .3 }, { transform: arriba, offset: .82 }, { transform: "translateY(0) scale(1)" }], opts);
    giro.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)", offset: .34 }, { transform: "rotateY(180deg)" }], Object.assign({ fill: "none" }, opts));
  }

  /* --------------------------------------------------------- arrastrar y soltar */
  /* Se arrastra una carta de la mano hacia el tablero (o hacia su objetivo), o una unidad hacia lo que quiere atacar. */
  function destinosDe(a) {
    const idx = indiceYo();
    if (a.tipo === "mano") {
      const id = est.jugadores[idx].mano[a.i];
      if (!id) return null;
      if (M.esReaccion(est, id)) return { zona: "mesa", objetivos: [] };
      const req = M.requisitoDeJugada(est, idx, id);
      if (req && req.validos.length) return { zona: "campo", objetivos: req.validos, pideObjetivo: true };
      return { zona: "campo", objetivos: [] };
    }
    const hit = M.buscar(est, a.uid);
    if (!hit || !M.unidadPuedeAtacar(est, hit.u)) return null;
    const v = M.objetivosDeAtaque(est, a.uid);
    return { zona: null, objetivos: [...v.unidades.map(x => ({ u: x })), ...(v.jugador ? [{ j: 1 - idx }] : [])] };
  }

  function elementoDeObjetivo(o) {
    const idx = indiceYo();
    return o.u !== undefined ? document.querySelector(`[data-uid="${o.u}"]`) : document.querySelector(`[data-jugador="${o.j === idx ? "yo" : "rival"}"]`);
  }

  function iniciarArrastre() {
    const a = arrastre;
    a.destinos = destinosDe(a);
    if (!a.destinos) { arrastre = null; return; }
    sel = a.tipo === "mano" ? { tipo: "mano", i: a.i } : { tipo: "unidad", uid: a.uid };
    pintarTablero();           // marca los objetivos posibles
    a.activo = true;
    document.body.classList.add("bt-arrastrando");
    if (a.tipo === "mano") {
      const idx = indiceYo();
      const id = est.jugadores[idx].mano[a.i];
      const m = M.meta(est, id);
      const vista = Object.assign({}, m, { id, coste: M.costeDe(est, idx, id), borrador: false, limite: null });
      const f = document.createElement("div");
      f.className = "bt-fantasma";
      f.innerHTML = htmlCarta(vista, true, 0, null);
      document.body.appendChild(f);
      a.fantasma = f;
      const original = document.querySelector(`.bt-carta[data-i="${a.i}"]`);
      if (original) original.classList.add("arrastrando");
      a.origen = original ? posicionEnMesa(original) : null;
    } else {
      const original = document.querySelector(`.bt-unidad[data-uid="${a.uid}"]`);
      a.origen = original ? posicionEnMesa(original) : null;
    }
    // Zonas donde se puede soltar
    if (a.destinos.zona === "campo") { $("btCampoYo").classList.add("zona-soltar"); $("btCentro").classList.add("zona-soltar"); }
    if (a.destinos.zona === "mesa") $("btMesa").classList.add("zona-soltar");
  }

  /* El hueco libre de tu campo más cercano en horizontal (para soltar una carta entre dos huecos) */
  function huecoCercano(x) {
    let mejor, dist = Infinity;
    document.querySelectorAll("#btCampoYo .bt-hueco").forEach(h => {
      const r = h.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x);
      if (d < dist) { dist = d; mejor = Number(h.dataset.hueco); }
    });
    return mejor;
  }

  /* Acción de jugar una carta, con el hueco elegido si es una unidad */
  function accionJugar(i, o, hueco) {
    const a = { t: "jugar", i };
    if (o) a.o = o;
    const id = est.jugadores[indiceYo()].mano[i];
    const h = hueco !== undefined ? hueco : sel && sel.tipo === "mano" && sel.i === i ? sel.hueco : undefined;
    if (h !== undefined && id && M.esUnidad(M.meta(est, id))) a.h = h;
    return a;
  }

  /* ¿Sobre qué cosa válida está el puntero? { objetivo } o { zona } o null */
  function destinoBajo(a, x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const unidad = el.closest("[data-uid]"), jugador = el.closest("[data-jugador]");
    const idx = indiceYo();
    for (const o of a.destinos.objetivos) {
      if (o.u !== undefined && unidad && Number(unidad.dataset.uid) === o.u) return { objetivo: o, el: unidad };
      if (o.j !== undefined && jugador && (jugador.dataset.jugador === "yo" ? idx : 1 - idx) === o.j) return { objetivo: o, el: jugador };
    }
    if (a.destinos.zona === "campo") {
      const hz = el.closest("#btCampoYo .bt-hueco");
      if (hz) return { zona: true, hueco: Number(hz.dataset.hueco), el: hz };
      if (el.closest("#btCampoYo, #btCentro")) return { zona: true, hueco: huecoCercano(x), el: $("btCampoYo") };
    }
    if (a.destinos.zona === "mesa" && el.closest("#btMesa")) return { zona: true, el: $("btMesa") };
    return null;
  }

  function moverArrastre(ev) {
    const a = arrastre;
    if (a.fantasma) a.fantasma.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -60%) rotate(-4deg)`;
    const mesa = $("btMesa").getBoundingClientRect();
    const dest = destinoBajo(a, ev.clientX, ev.clientY);
    document.querySelectorAll(".sobre").forEach(e => e.classList.remove("sobre"));
    if (dest) dest.el.classList.add("sobre");
    // Flecha: desde el origen hasta el puntero (o hasta el objetivo si está encima)
    if (a.origen && (a.tipo === "unidad" || a.destinos.pideObjetivo)) {
      const hasta = dest && dest.objetivo ? posicionEnMesa(dest.el) : { x: ev.clientX - mesa.left, y: ev.clientY - mesa.top };
      dibujarFlecha(a.origen, hasta, !!(dest && dest.objetivo));
    }
  }

  function terminarArrastre(a, ev) {
    const dest = destinoBajo(a, ev.clientX, ev.clientY);
    if (a.fantasma) a.fantasma.remove();
    document.body.classList.remove("bt-arrastrando");
    document.querySelectorAll(".sobre, .zona-soltar, .arrastrando").forEach(e => e.classList.remove("sobre", "zona-soltar", "arrastrando"));
    ocultarFlecha();
    if (dest && dest.objetivo) {
      const o = dest.objetivo;
      if (a.tipo === "mano") enviar(accionJugar(a.i, o));
      else enviar({ t: "atacar", u: a.uid, o });
      return;
    }
    if (dest && dest.zona) {
      if (a.destinos.zona === "mesa") { enviar({ t: "reaccionar", i: a.i }); return; }
      if (a.destinos.pideObjetivo) { if (sel && dest.hueco !== undefined) sel.hueco = dest.hueco; pintarTablero(); toast("Ahora elige el objetivo."); return; }  // la carta queda elegida
      enviar(accionJugar(a.i, null, dest.hueco));
      return;
    }
    sel = null;
    pintarTablero();
  }

  function cancelarArrastre() {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (a.activo) {
      if (a.fantasma) a.fantasma.remove();
      document.body.classList.remove("bt-arrastrando");
      document.querySelectorAll(".sobre, .zona-soltar, .arrastrando").forEach(e => e.classList.remove("sobre", "zona-soltar", "arrastrando"));
      ocultarFlecha();
      sel = null;
      pintarTablero();
    }
  }

  $("btMesa").addEventListener("pointerdown", ev => {
    if (ev.button !== 0 || !est) return;
    const carta = ev.target.closest(".bt-carta.jugable");
    const unidad = ev.target.closest(".bt-unidad.lista");
    if (!carta && !unidad) return;
    arrastre = {
      tipo: carta ? "mano" : "unidad", i: carta ? Number(carta.dataset.i) : null, uid: unidad ? Number(unidad.dataset.uid) : null,
      x0: ev.clientX, y0: ev.clientY, activo: false
    };
  });
  document.addEventListener("pointermove", ev => {
    if (!arrastre) return;
    if (!arrastre.activo) {
      if (Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) < 8) return;
      iniciarArrastre();
      if (!arrastre) return;
    }
    moverArrastre(ev);
    ev.preventDefault();
  });
  document.addEventListener("pointerup", ev => {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (!a.activo) return;                       // fue un clic normal
    ignorarClic = true;
    setTimeout(() => { ignorarClic = false; }, 120);
    a.activo = false;
    terminarArrastre(a, ev);
  });
  document.addEventListener("pointercancel", cancelarArrastre);

  /* Con una carta o una unidad elegida, la flecha sigue al ratón y se marca el objetivo */
  $("btMesa").addEventListener("mousemove", ev => {
    if (!est || arrastre || !sel) return;
    const objetivos = objetivosVigentes();
    if (!objetivos.length) { ocultarFlecha(); return; }
    const origen = sel.tipo === "unidad" ? document.querySelector(`.bt-unidad[data-uid="${sel.uid}"]`) : document.querySelector(`.bt-carta[data-i="${sel.i}"]`);
    if (!origen) { ocultarFlecha(); return; }
    const mesa = $("btMesa").getBoundingClientRect();
    const el = ev.target.closest("[data-uid], [data-jugador]");
    let valido = null;
    if (el) {
      const idx = indiceYo();
      valido = objetivos.find(o => (o.u !== undefined && el.dataset.uid && Number(el.dataset.uid) === o.u) || (o.j !== undefined && el.dataset.jugador && (el.dataset.jugador === "yo" ? idx : 1 - idx) === o.j));
    }
    dibujarFlecha(posicionEnMesa(origen), valido ? posicionEnMesa(el) : { x: ev.clientX - mesa.left, y: ev.clientY - mesa.top }, !!valido);
  });
  $("btMesa").addEventListener("mouseleave", () => { if (!arrastre) ocultarFlecha(); });

  $("btTablero").innerHTML = TABLEROS.map(t => `<option value="${t.id}">${t.nombre}</option>`).join("");
  $("btTablero").addEventListener("change", () => {
    tablero = $("btTablero").value;
    try { localStorage.setItem("cartasTablero", tablero); } catch (e) { /* sin almacenamiento */ }
    aplicarTablero();
  });

  /* ---------------------------------------------------------------- eventos */
  function alClicTablero(ev) {
    if (!est) return;
    if (ignorarClic) return;
    const idx = indiceYo();
    if (ev.target.closest("#btFin")) { if (miTurnoDe(idx)) enviar({ t: "fin" }); return; }
    if (ev.target.closest("#btRendirse")) { rendirse(); return; }
    if (ev.target.closest("#btVolver2")) { volverAlLobby(); return; }
    if (ev.target.closest("[data-jugar]")) { if (sel && sel.tipo === "mano") enviar(accionJugar(sel.i)); return; }
    // Una unidad de la mano elegida se coloca en el hueco libre que se toque
    const hueco = ev.target.closest("#btCampoYo .bt-hueco");
    if (hueco && sel && sel.tipo === "mano" && miTurnoDe(idx) && !est.pendiente) {
      const id = est.jugadores[idx].mano[sel.i];
      if (id && M.esUnidad(M.meta(est, id))) {
        const h = Number(hueco.dataset.hueco);
        const req = M.requisitoDeJugada(est, idx, id);
        if (req && req.validos.length) { sel.hueco = h; pintarTablero(); toast("Ahora elige el objetivo."); }
        else enviar(accionJugar(sel.i, null, h));
        return;
      }
    }
    if (ev.target.closest("[data-pasar]")) { if (reaccionaYo(idx)) enviar({ t: "pasar" }); return; }
    const botonReaccion = ev.target.closest("[data-reaccionar]");
    if (botonReaccion) { if (reaccionaYo(idx)) enviar({ t: "reaccionar", i: Number(botonReaccion.dataset.reaccionar) }); return; }

    const objetivos = objetivosVigentes();
    const unidad = ev.target.closest("[data-uid]");
    const jugador = ev.target.closest("[data-jugador]");
    const carta = ev.target.closest("[data-i]");

    // ¿Es un objetivo válido de lo que hay elegido?
    if (unidad && sel) {
      const uid = Number(unidad.dataset.uid);
      if (objetivos.some(o => o.u === uid)) {
        if (sel.tipo === "mano") enviar(accionJugar(sel.i, { u: uid }));
        else enviar({ t: "atacar", u: sel.uid, o: { u: uid } });
        return;
      }
    }
    if (jugador && sel) {
      const j = jugador.dataset.jugador === "yo" ? idx : 1 - idx;
      if (objetivos.some(o => o.j === j)) {
        if (sel.tipo === "mano") enviar(accionJugar(sel.i, { j }));
        else enviar({ t: "atacar", u: sel.uid, o: { j } });
        return;
      }
    }

    if (carta) {
      const i = Number(carta.dataset.i);
      if (sel && sel.tipo === "mano" && sel.i === i) {
        // Segundo clic: jugarla si no pide objetivo
        const id = est.jugadores[idx].mano[i];
        if (M.esReaccion(est, id)) {
          if (reaccionaYo(idx) && M.reaccionesPosibles(est, idx, est.pendiente.evento).includes(i)) enviar({ t: "reaccionar", i });
          else { sel = null; pintarTablero(); }
          return;
        }
        const req = M.requisitoDeJugada(est, idx, id);
        if (miTurnoDe(idx) && (!req || (req.opcional && !req.validos.length))) enviar(accionJugar(i));
        else { sel = null; pintarTablero(); }
      } else {
        sel = { tipo: "mano", i };
        pintarTablero();
      }
      return;
    }
    if (unidad) {
      const uid = Number(unidad.dataset.uid);
      const hit = M.buscar(est, uid);
      if (!hit) return;
      if (sel && sel.uid === uid) sel = null;
      else sel = { tipo: hit.j === idx ? "unidad" : "ver", uid };
      pintarTablero();
      return;
    }
    if (sel) { sel = null; ocultarFlecha(); pintarTablero(); }
  }

  function alPasarRaton(ev) {
    // Con el ratón encima se muestra la carta en el inspector (sin cambiar la selección)
    if (!est || (sel && sel.tipo === "mano")) return;
    const unidad = ev.target.closest("[data-uid]");
    if (!unidad || (sel && sel.uid)) return;
    const hit = M.buscar(est, Number(unidad.dataset.uid));
    if (!hit) return;
    const guardada = sel;
    sel = { tipo: "ver", uid: hit.u.uid };
    pintarInspector();
    sel = guardada;
  }

  document.addEventListener("animationend", ev => { if (ev.target.classList && ev.target.classList.contains("golpe")) ev.target.classList.remove("golpe"); });
  $("btPartida").addEventListener("click", alClicTablero);
  $("btMesa").addEventListener("mouseover", alPasarRaton);
  $("btVolver").addEventListener("click", volverAlLobby);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && sel) { sel = null; pintarTablero(); } });

  $("btLobby").addEventListener("click", ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.retar) retar(b.dataset.retar);
    else if (b.dataset.aceptar) responder(b.dataset.aceptar, true);
    else if (b.dataset.rechazar) responder(b.dataset.rechazar, false);
    else if (b.dataset.cancelar) accionServidor("cartas_rendirse", { p_id: b.dataset.cancelar });
    else if (b.dataset.abrir) abrirPartida(b.dataset.abrir);
  });
  $("btLocalIr").addEventListener("click", empezarLocal);

  /* ------------------------------------------------------------------ inicio */
  function suscribir() {
    try {
      supa.channel("cartas-partidas")
        .on("postgres_changes", { event: "*", schema: "public", table: "cartas_partidas" }, programarCarga)
        .subscribe();
    } catch (e) { /* sin tiempo real: queda la consulta periódica */ }
    setInterval(() => { if (!document.hidden && modo !== "local") cargarPartidas(); }, 4000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && modo !== "local") cargarPartidas(); });
  }

  (async function iniciar() {
    pintarLobby();
    const rol = await CartasCliente.verificarRol();
    esEditor = rol.puede;
    await CartasCliente.cargarDefiniciones(esEditor);
    try {
      const ses = await fichasSesionActual();
      miId = ses ? ses.user.id : null;
      supa = await fichasCliente();
    } catch (e) { miId = null; }
    if (!miId) { aviso("Inicia sesión para armar mazos y jugar."); pintarLobby(); return; }
    try { mazos = await CartasCliente.listarMazos(); } catch (e) {
      mazos = [];
      aviso("No se pudieron cargar tus mazos. Si eres el máster, corre scratchpad/cartas_combate.sql en Supabase.");
    }
    await cargarJugadores();
    await cargarPartidas();
    suscribir();
    pintarLobby();
  })();
})();
