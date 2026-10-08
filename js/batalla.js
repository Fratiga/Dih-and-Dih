/* Batalla de Cartas malditas: lobby (retos entre jugadores), tablero y modo "probar solo".
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
  let aplicadas = 0;           // acciones ya aplicadas al estado
  let yo = 0;                  // mi índice de jugador (0 o 1)
  let sel = null;              // { tipo: 'mano', i } | { tipo: 'unidad', uid } | { tipo: 'ver', uid }
  let cerrando = false;
  let mostradaMirada = "";
  let pvPrevios = new Map();

  const local = () => modo === "local";
  const miTurno = () => est && est.ganador === null && est.activo === yo;
  const indiceYo = () => (local() ? est.activo : yo);

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
    let n = 0;
    for (const a of f.acciones) {
      const r = M.aplicar(e, a, e.activo);
      if (r.error) break;
      n++;
    }
    return { e, n };
  }

  function entrarPartida(titulo) {
    modo = modo === "local" ? "local" : "partida";
    sel = null;
    cerrando = false;
    mostradaMirada = "";
    pvPrevios = new Map();
    $("btLobby").classList.add("hidden");
    $("btPartida").classList.remove("hidden");
    $("btFinal").classList.add("hidden");
    $("btTitulo").textContent = titulo;
    pintarTablero();
  }

  function abrirPartida(id) {
    const f = partidas.find(p => p.id === id);
    if (!f || f.estado === "pendiente" || f.estado === "rechazada") return;
    fila = f;
    modo = "partida";
    const { e, n } = construir(f);
    est = e; aplicadas = n;
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
    fila = null; aplicadas = 0;
    modo = "local";
    entrarPartida("Prueba en solitario");
  }

  function volverAlLobby() {
    modo = "lobby";
    est = null; fila = null;
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
    if (fila.acciones.length < aplicadas) {
      const { e, n } = construir(fila);
      est = e; aplicadas = n;
    } else {
      for (let i = aplicadas; i < fila.acciones.length; i++) {
        const r = M.aplicar(est, fila.acciones[i], est.activo);
        if (r.error) { const { e, n } = construir(fila); est = e; aplicadas = n; break; }
        aplicadas = i + 1;
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
    const jugador = indiceYo();
    if (!local() && !miTurno()) { toast("No es tu turno."); return; }
    const r = M.aplicar(est, accion, jugador);
    if (r.error) { toast(r.error); return; }
    sel = null;
    if (!local()) {
      aplicadas += 1;
      pintarTablero();
      const { error } = await supa.rpc("cartas_accion", { p_id: fila.id, p_accion: accion });
      if (error) {
        toast(error.message || "No se pudo enviar la jugada.");
        await cargarPartidas();
        const { e, n } = construir(partidas.find(p => p.id === fila.id) || fila);
        est = e; aplicadas = n;
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
    if (!est || est.ganador !== null || !confirm("¿Te rindes?")) return;
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

  const miTurnoDe = idx => est.ganador === null && est.activo === idx;

  function htmlJugador(idx, rival) {
    const J = est.jugadores[idx];
    const orbes = Array.from({ length: Math.max(J.energiaMax, 1) }, (_, i) => `<i class="${i < J.energia ? "llena" : ""}"></i>`).join("");
    const extra = J.energia > J.energiaMax ? `<small>+${J.energia - J.energiaMax}</small>` : "";
    return `<div class="bt-nombre">${esc(J.nombre)}${est.activo === idx && est.ganador === null ? ' <em>· su turno</em>' : ""}</div>
      <div class="bt-vida" title="Vida"><span>♥</span> <strong>${Math.max(0, J.vida)}</strong></div>
      <div class="bt-energia" title="Energía: ${J.energia}/${J.energiaMax}">${orbes}${extra}</div>
      <div class="bt-conteo">${rival ? `Mano <strong>${J.mano.length}</strong> · ` : ""}Mazo <strong>${J.mazo.length}</strong></div>`;
  }

  function objetivosVigentes() {
    // Lista de objetivos { u } / { j } que se pueden elegir con la selección actual
    if (!sel || !miTurnoDe(indiceYo())) return [];
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

  function pintarTablero() {
    if (!est) return;
    const idx = indiceYo();
    const rival = 1 - idx;
    const J = est.jugadores[idx];

    // Los paneles de jugador no se vuelven a crear: se les quita la marca de objetivo de la vez anterior
    $("btRival").classList.remove("objetivo");
    $("btYo").classList.remove("objetivo");
    $("btRival").innerHTML = htmlJugador(rival, true);
    $("btYo").innerHTML = htmlJugador(idx, false) + `
      <div class="bt-botones">
        <button type="button" id="btFin" class="cartas-boton cartas-boton-principal" ${miTurnoDe(idx) ? "" : "disabled"}>Terminar turno</button>
        <button type="button" id="btRendirse" class="cartas-boton cartas-boton-peligro">${local() ? "Salir" : "Rendirse"}</button>
      </div>`;
    $("btCampoRival").innerHTML = est.jugadores[rival].campo.map(u => htmlUnidad(u, idx)).join("") || `<p class="bt-vacio">Sin unidades</p>`;
    $("btCampoYo").innerHTML = J.campo.map(u => htmlUnidad(u, idx)).join("") || `<p class="bt-vacio">Sin unidades</p>`;

    const T = est.terreno;
    $("btCentro").innerHTML = T
      ? `<div class="bt-terreno carta-rareza-${esc(M.meta(est, T.cartaId).rareza)}" title="${esc(M.meta(est, T.cartaId).habilidad)}"><strong>${esc(M.meta(est, T.cartaId).nombre)}</strong><span>${esc(M.meta(est, T.cartaId).habilidad)}</span><small>${T.restantes === null ? "hasta que entre otro terreno" : `${T.restantes} turno${T.restantes === 1 ? "" : "s"}`} · de ${esc(est.jugadores[T.dueno].nombre)}</small></div>`
      : `<div class="bt-terreno vacio">Sin terreno</div>`;

    $("btMano").innerHTML = J.mano.map((id, i) => {
      const m = M.meta(est, id);
      const coste = M.costeDe(est, idx, id);
      const jugable = miTurnoDe(idx) && coste <= J.energia && m.tipo !== "Reacción";
      const vista = Object.assign({}, m, { id, coste, borrador: false, limite: null });
      return `<div class="bt-carta ${jugable ? "jugable" : ""} ${sel && sel.tipo === "mano" && sel.i === i ? "elegida" : ""}" data-i="${i}">${htmlCarta(vista, true, 0, null)}</div>`;
    }).join("") || `<p class="bt-vacio">Sin cartas en la mano</p>`;

    // Objetivos que se pueden elegir
    const objetivos = objetivosVigentes();
    objetivos.forEach(o => {
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
    turnoEl.textContent = est.ganador !== null ? "Partida terminada" : local() ? `Turno de ${est.jugadores[est.activo].nombre}` : miTurno() ? "Es tu turno" : `Turno de ${est.jugadores[est.activo].nombre}`;
    turnoEl.className = `bt-turno ${miTurnoDe(idx) ? "mio" : ""}`;

    $("btLog").innerHTML = est.log.slice(-40).map(l => `<li class="${l.startsWith("—") ? "turno" : ""}">${esc(l)}</li>`).join("");
    $("btLog").scrollTop = $("btLog").scrollHeight;
    pintarInspector();
    pintarFinal();
    avisarMirada();
  }

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
        if (!miTurnoDe(idx)) extra = `<p class="bt-nota">Espera tu turno.</p>`;
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
    const clave = `${m.turno}-${m.carta}-${m.j}`;
    if (clave === mostradaMirada) return;
    mostradaMirada = clave;
    toast(m.carta ? `Carta superior de tu mazo: ${M.meta(est, m.carta).nombre}` : "Tu mazo está vacío.");
  }

  /* ---------------------------------------------------------------- eventos */
  function alClicTablero(ev) {
    if (!est) return;
    const idx = indiceYo();
    if (ev.target.closest("#btFin")) { if (miTurnoDe(idx)) enviar({ t: "fin" }); return; }
    if (ev.target.closest("#btRendirse")) { rendirse(); return; }
    if (ev.target.closest("#btVolver2")) { volverAlLobby(); return; }
    if (ev.target.closest("[data-jugar]")) { if (sel && sel.tipo === "mano") enviar({ t: "jugar", i: sel.i }); return; }

    const objetivos = objetivosVigentes();
    const unidad = ev.target.closest("[data-uid]");
    const jugador = ev.target.closest("[data-jugador]");
    const carta = ev.target.closest("[data-i]");

    // ¿Es un objetivo válido de lo que hay elegido?
    if (unidad && sel) {
      const uid = Number(unidad.dataset.uid);
      if (objetivos.some(o => o.u === uid)) {
        if (sel.tipo === "mano") enviar({ t: "jugar", i: sel.i, o: { u: uid } });
        else enviar({ t: "atacar", u: sel.uid, o: { u: uid } });
        return;
      }
    }
    if (jugador && sel) {
      const j = jugador.dataset.jugador === "yo" ? idx : 1 - idx;
      if (objetivos.some(o => o.j === j)) {
        if (sel.tipo === "mano") enviar({ t: "jugar", i: sel.i, o: { j } });
        else enviar({ t: "atacar", u: sel.uid, o: { j } });
        return;
      }
    }

    if (carta) {
      const i = Number(carta.dataset.i);
      if (sel && sel.tipo === "mano" && sel.i === i) {
        // Segundo clic: jugarla si no pide objetivo
        const id = est.jugadores[idx].mano[i];
        const req = M.requisitoDeJugada(est, idx, id);
        if (miTurnoDe(idx) && (!req || (req.opcional && !req.validos.length))) enviar({ t: "jugar", i });
        else sel = null, pintarTablero();
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
    if (sel) { sel = null; pintarTablero(); }
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
