/* Página de Arquería: elegir rival (Hornet, Garra o Cassius) o jugar contra otro jugador.
   Las partidas entre jugadores viven en la tabla arqueria_partidas (scratchpad/arqueria_pvp.sql):
   los dos juegan el mismo campo a la vez y cada uno ve subir el puntaje del otro. */
(function () {
  const boton = document.getElementById("arqueriaJugar");
  const recordEl = document.getElementById("arqueriaRecord");
  const rivalesEl = document.getElementById("arqueriaRivales");
  const modoRivalesEl = document.getElementById("arqueriaModoRivales");
  const lobbyEl = document.getElementById("arqueriaLobby");
  const avisoEl = document.getElementById("arqueriaAviso");
  const partidasEl = document.getElementById("arqueriaPartidas");
  const jugadoresEl = document.getElementById("arqueriaJugadores");
  const escenarioEl = document.querySelector(".mj-escenario");
  const controlesEl = document.getElementById("arqueriaControles");
  const cerrarEl = document.getElementById("arqueriaCerrar");
  const rendirseEl = document.getElementById("arqueriaRendirse");
  const rendirseSoloEl = document.getElementById("arqueriaRendirseSolo");
  const rendirseSoloFilaEl = document.getElementById("arqueriaRendirseSoloFila");
  const pieEl = document.getElementById("arqueriaPie");
  const cuentaEl = document.getElementById("arqueriaCuenta");
  const revanchaEl = document.getElementById("arqueriaRevancha");
  const rankingEl = document.getElementById("arqueriaRankings");
  const CLAVE_REGISTRADAS = "compendioArqueriaPvpRegistradas";

  const RIVALES = [
    { id: "hornet", nombre: "Hornet", dificultad: "Fácil", nivel: 1, color: "#b48ad9", nota: "Dispara con calma y los blancos le caen en línea recta. Para empezar.", corta: "Blancos en línea recta" },
    { id: "garra", nombre: "Garra", dificultad: "Media", nivel: 2, color: "#d9794f", nota: "Más rápida y bastante precisa. No perdona los descuidos.", corta: "Rápida y precisa" },
    { id: "cassius", nombre: "Cassius", dificultad: "Difícil", nivel: 3, color: "#d9a441", nota: "Los blancos zigzaguean y casi no falla. Hay que ir a por el centro.", corta: "Blancos en zigzag" }
  ];
  // El récord de antes de que hubiera varios rivales era contra el rival más flojo, que ahora es Hornet
  const clave = id => id === "hornet" ? "compendioArqueriaCassius" : `compendioArqueria_${id}`;
  const leer = id => { try { return parseInt(localStorage.getItem(clave(id)), 10) || 0; } catch (e) { return 0; } };

  let modo = "rivales";
  let rival = RIVALES[0];
  let jugando = false;

  // Partida contra otro jugador abierta: { id, lado, listoEnviado, iniciada, terminada, ... }
  let vs = null;
  let supa = null;
  let miId = null;
  let jugadores = [];
  let partidas = [];
  let presentes = new Set();
  let enLinea = false;
  let aplazado = null;
  let sondeoVs = null;
  let envioPuntaje = null;
  let registradas = new Set();
  try { registradas = new Set(JSON.parse(localStorage.getItem(CLAVE_REGISTRADAS) || "[]")); } catch (e) { registradas = new Set(); }

  /* --- Tabla de arqueros ------------------------------------------------------------
     Una sola tabla con pestañas: el podio con los tres primeros y debajo el resto. A un
     lado, un recuadro con tus propios números. Los datos salen de mj_estadisticas. */
  const tabsEl = document.getElementById("arqueriaTabs");
  const tuEl = document.getElementById("arqueriaTu");
  const TABLAS = [
    { id: "puntaje", titulo: "Puntaje", valor: u => Number(u.maximo.mejor) || 0, etiqueta: "pts" },
    { id: "victorias", titulo: "Victorias", valor: u => u.victorias, etiqueta: "" },
    { id: "cassius", titulo: "Contra Cassius", ayuda: "Partidas ganadas contra Cassius, el rival más difícil", valor: u => (u.porClave.cassius ? u.porClave.cassius.victorias : 0), etiqueta: "" },
    { id: "jugadores", titulo: "Entre jugadores", valor: u => (u.porClave.jugador ? u.porClave.jugador.victorias : 0), etiqueta: "",
      sub: u => (u.porClave.jugador && u.porClave.jugador.maximo && Number(u.porClave.jugador.maximo.mejor) ? `mejor ${Number(u.porClave.jugador.maximo.mejor)} pts` : "") }
  ];
  let tablaActual = 0;
  let datosTabla = null;
  let yoSesion = { id: null };

  function filasDe(t) {
    return (datosTabla || [])
      .map(u => ({ id: u.id, nombre: u.username, v: t.valor(u), sub: t.sub ? t.sub(u) : "" }))
      .filter(f => Number.isFinite(f.v) && f.v > 0)
      .sort((a, b) => b.v - a.v);
  }

  function pintarTabla() {
    tabsEl.innerHTML = TABLAS.map((t, k) => `<button type="button" role="tab" aria-selected="${k === tablaActual}" class="arq-tab ${k === tablaActual ? "activa" : ""}" data-tabla="${k}"${t.ayuda ? ` title="${t.ayuda}"` : ""}>${t.titulo}</button>`).join("");
    if (!datosTabla) { rankingEl.innerHTML = `<p class="arq-vacio">Cargando la tabla...</p>`; return; }
    const t = TABLAS[tablaActual];
    const filas = filasDe(t);
    if (!filas.length) {
      rankingEl.innerHTML = `<p class="arq-vacio">Todavía no hay nadie en esta tabla. Juega con la sesión iniciada para abrirla.</p>`;
      return;
    }
    const fmt = f => Number(f.v).toLocaleString("es") + (t.etiqueta ? ` ${t.etiqueta}` : "");
    // Podio: el segundo a la izquierda, el primero al centro y el tercero a la derecha
    const orden = [1, 0, 2];
    const podio = orden.map(k => {
      const f = filas[k];
      if (!f) return `<div class="arq-podio-col puesto-${k + 1} vacio"><span class="arq-podio-nombre">—</span><span class="arq-podio-valor">·</span><div class="arq-peana">${k + 1}</div></div>`;
      return `<div class="arq-podio-col puesto-${k + 1} ${f.id === yoSesion.id ? "yo" : ""}"><span class="arq-podio-nombre" title="${esc(f.nombre)}">${esc(f.nombre)}</span><span class="arq-podio-valor">${esc(fmt(f))}</span>${f.sub ? `<span class="arq-podio-sub">${esc(f.sub)}</span>` : ""}<div class="arq-peana">${k + 1}</div></div>`;
    }).join("");
    const resto = filas.slice(3, 10);
    const miPuesto = yoSesion.id ? filas.findIndex(f => f.id === yoSesion.id) : -1;
    const lista = resto.map(f => `<li class="${f.id === yoSesion.id ? "yo" : ""}"><span>${esc(f.nombre)}</span><strong>${esc(fmt(f))}</strong></li>`).join("")
      + (miPuesto >= 10 ? `<li class="yo" style="counter-increment:none"><span>${esc(filas[miPuesto].nombre)} · puesto ${miPuesto + 1}</span><strong>${esc(fmt(filas[miPuesto]))}</strong></li>` : "");
    rankingEl.innerHTML = `<div class="arq-podio">${podio}</div>${lista ? `<ol class="arq-lista">${lista}</ol>` : ""}`;
  }

  function pintarTu() {
    if (!window.MjStats || !yoSesion.id) {
      tuEl.innerHTML = `<p class="arq-nota">Los puntajes se guardan solo con la sesión iniciada. Inicia sesión (arriba a la derecha) para guardar los tuyos y aparecer en la tabla.</p>`;
      return;
    }
    if (!datosTabla) {
      tuEl.innerHTML = `<p class="arq-nota">Tus números no están disponibles por ahora. Prueba de nuevo en un rato.</p>`;
      return;
    }
    const yo = (datosTabla || []).find(u => u.id === yoSesion.id);
    if (!yo) {
      tuEl.innerHTML = `<p class="arq-nota">Todavía no has jugado ninguna partida con la sesión iniciada. La primera que termines aparecerá aquí.</p>`;
      return;
    }
    const puesto = filasDe(TABLAS[0]).findIndex(f => f.id === yo.id);
    const celda = (rotulo, valor) => `<div class="arq-numero"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
    tuEl.innerHTML = `<dl class="arq-numeros">${celda("Partidas", yo.partidas)}${celda("Victorias", yo.victorias)}${celda("Mejor puntaje", Number(yo.maximo.mejor) || 0)}${celda("Tu puesto", puesto >= 0 ? `#${puesto + 1}` : "—")}</dl>`;
  }

  tabsEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tabla]");
    if (!b) return;
    tablaActual = Number(b.dataset.tabla);
    pintarTabla();
  });

  async function cargarRanking() {
    if (!rankingEl || !window.MjStats) return;
    try {
      const { sesion } = await MjStats.cargarSesion();
      yoSesion = { id: sesion ? sesion.user.id : null };
      datosTabla = await MjStats.datos("arqueria");
    } catch (e) {
      datosTabla = null;
      rankingEl.innerHTML = `<p class="arq-vacio">La tabla no está disponible por ahora. Prueba de nuevo en un rato.</p>`;
      pintarTu();
      return;
    }
    pintarTabla();
    pintarTu();
  }
  if (tabsEl) { pintarTabla(); tuEl.innerHTML = `<p class="arq-nota">Cargando tus números...</p>`; }

  async function anotarPartida(claveRival, resultado, puntaje) {
    if (!window.MjStats) return { guardado: false };
    const res = await MjStats.registrar("arqueria", claveRival, resultado, { suma: { puntos: puntaje }, max: { mejor: puntaje } });
    if (res.guardado) cargarRanking();
    return res;
  }

  /* Anota las partidas entre jugadores ya terminadas que aún no se anotaron (una vez por partida). */
  async function registrarPendientes() {
    const limite = Date.now() - 3 * 86400000;
    for (const f of partidas) {
      if (f.estado !== "terminada" || !f.resultado || registradas.has(f.id)) continue;
      if (new Date(f.actualizada).getTime() < limite) { registradas.add(f.id); continue; }
      const resultado = f.resultado === "empate" ? "tablas" : (f.resultado === mi(f) ? "gana" : "pierde");
      const res = await anotarPartida("jugador", resultado, puntajeMio(f));
      if (!res.guardado) return; // se reintenta en la siguiente consulta
      registradas.add(f.id);
      try { localStorage.setItem(CLAVE_REGISTRADAS, JSON.stringify([...registradas].slice(-200))); } catch (e) { /* sin almacenamiento */ }
    }
  }

  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* La línea bajo el campo (tu mejor puntaje, o lo que pasa en una partida entre jugadores) solo ocupa sitio si dice algo */
  function actualizarLinea() {
    recordEl.classList.toggle("hidden", (modo === "jugadores" && !vs) || !recordEl.textContent);
    pintarPie();
  }
  // El pie del campo desaparece entero si no tiene ni texto ni botón (por ejemplo, en la lista de partidas entre jugadores)
  function pintarPie() {
    pieEl.classList.toggle("hidden", recordEl.classList.contains("hidden") && rendirseSoloFilaEl.classList.contains("hidden"));
  }
  function ponerLinea(texto) { recordEl.textContent = texto; actualizarLinea(); }

  /* --- Contra rivales ------------------------------------------------------ */
  function pintarRivales() {
    rivalesEl.innerHTML = RIVALES.map(r => {
      const activo = r.id === rival.id;
      return `
      <button type="button" class="arq-rival ${activo ? "activo" : ""}" data-rival="${r.id}" aria-pressed="${activo}" style="--rc: ${r.color}" title="${esc(r.nota)}">
        <span class="arq-rival-icono" aria-hidden="true">${r.nombre[0]}</span>
        <span class="arq-rival-cab"><strong>${r.nombre}</strong><span class="arq-nivel" aria-label="Dificultad ${r.dificultad}">${r.dificultad}</span></span>
        <small>${r.corta}</small>
      </button>`;
    }).join("");
  }

  function pintarRecord() {
    if (modo === "jugadores") return;
    ponerLinea(leer(rival.id) ? `Tu mejor puntaje contra ${rival.nombre}: ${leer(rival.id)}` : "");
  }

  const juego = crearArqueria({
    canvas: document.getElementById("arqueriaCampo"),
    rival: rival.id,
    duracion: 60,
    fondo: true,
    onEstado: estado => {
      jugando = estado === "jugando";
      if (!vs) boton.classList.toggle("hidden", jugando);
      pintarRendirse();
    },
    onPuntaje: puntaje => { if (vs) vs.puntaje = puntaje; },
    onFin: ({ puntaje, resultado, vs: esVs, rendicion }) => {
      if (esVs) { finalizarVs(puntaje); return; }
      anotarPartida(rival.id, resultado === "ganado" ? "gana" : resultado === "perdido" ? "pierde" : "tablas", puntaje);
      // Una partida a la que te rendiste cuenta como derrota, pero no mejora tu mejor puntaje
      if (!rendicion && puntaje > leer(rival.id)) {
        try { localStorage.setItem(clave(rival.id), String(puntaje)); } catch (e) { /* sin almacenamiento */ }
      }
      pintarRivales();
      pintarRecord();
    }
  });

  boton.addEventListener("click", () => {
    if (vs) marcarListo();
    else juego.iniciar();
  });

  rivalesEl.addEventListener("click", e => {
    const b = e.target.closest("[data-rival]");
    if (!b || jugando) return;
    rival = RIVALES.find(r => r.id === b.dataset.rival);
    juego.cambiarRival(rival.id);
    pintarRivales();
    pintarRecord();
  });

  /* Botón de rendirse. Contra un rival de la casa solo se ve mientras se juega, y ocupa su sitio siempre para que el campo
     no salte. Contra otro jugador es el botón de los controles de la partida, que dice "Rendirse" una vez empezada. */
  function pintarRendirse() {
    rendirseSoloFilaEl.classList.toggle("hidden", modo === "jugadores" || !!vs);
    rendirseSoloFilaEl.classList.toggle("arq-inactivo", !jugando);
    rendirseSoloEl.disabled = !jugando;
    pintarPie();
    if (vs) rendirseEl.textContent = vs.iniciada && !vs.terminada ? "Rendirse" : "Abandonar";
  }

  /* --- Vistas -------------------------------------------------------------- */
  function refrescarVistas() {
    const pvp = modo === "jugadores";
    modoRivalesEl.classList.toggle("hidden", pvp);
    lobbyEl.classList.toggle("hidden", !pvp || !!vs);
    escenarioEl.classList.toggle("hidden", pvp && !vs);
    actualizarLinea();
    controlesEl.classList.toggle("hidden", !vs);
    pintarRendirse();
    document.querySelectorAll(".aj-modo").forEach(b => b.classList.toggle("activo", b.dataset.modo === modo));
  }

  document.querySelectorAll(".aj-modo").forEach(b => b.addEventListener("click", () => {
    if (jugando) return;
    modo = b.dataset.modo;
    if (modo === "jugadores") {
      iniciarOnline();
    } else {
      cerrarVs();
      juego.cambiarRival(rival.id);
      boton.classList.remove("hidden");
      pintarRecord();
    }
    refrescarVistas();
  }));

  /* --- Contra otros jugadores ---------------------------------------------- */
  const mi = f => (f.a === miId ? "a" : "b");
  const suyo = (f, k) => f[`${k}_${mi(f) === "a" ? "b" : "a"}`];
  const nombreOponente = f => suyo(f, "nombre");
  const idOponente = f => (f.a === miId ? f.b : f.a);
  const puntajeMio = f => f[`puntaje_${mi(f)}`];
  const puntajeSuyo = f => f[`puntaje_${mi(f) === "a" ? "b" : "a"}`];

  function textoResultado(f) {
    if (f.resultado === "empate") return `Empate ${puntajeMio(f)} a ${puntajeSuyo(f)}`;
    const gane = f.resultado === mi(f);
    return `${gane ? "Ganaste" : "Perdiste"} ${puntajeMio(f)} a ${puntajeSuyo(f)}${f.motivo === "rendicion" ? " (rendición)" : ""}`;
  }

  function pintarLobby() {
    if (!supa) return;
    const abiertas = partidas.filter(f => ["pendiente", "listos", "jugando"].includes(f.estado));
    const recibidos = abiertas.filter(f => f.estado === "pendiente" && f.a !== miId);
    const enviados = abiertas.filter(f => f.estado === "pendiente" && f.a === miId);
    const enCurso = abiertas.filter(f => f.estado === "listos" || f.estado === "jugando");
    const terminadas = partidas.filter(f => f.estado === "terminada").slice(0, 5);
    const ocupadosRev = new Set(abiertas.map(idOponente));
    let html = "";
    if (recibidos.length) {
      html += `<h3 class="aj-pvp-titulo">Te retaron</h3>` + recibidos.map(f => `
        <div class="aj-pvp-fila aj-pvp-aviso">
          <span><strong>${esc(nombreOponente(f))}</strong> te reta a una partida</span>
          <span><button type="button" class="aj-boton" data-aceptar="${f.id}">Aceptar</button> <button type="button" class="aj-boton" data-rechazar="${f.id}">Rechazar</button></span>
        </div>`).join("");
    }
    if (enCurso.length) {
      html += `<h3 class="aj-pvp-titulo">Para jugar</h3>` + enCurso.map(f => `
        <div class="aj-pvp-fila">
          <span>contra <strong>${esc(nombreOponente(f))}</strong> · ${f.estado === "jugando" ? "en juego" : "esperando que los dos estén listos"}</span>
          <button type="button" class="aj-boton" data-abrir="${f.id}">Abrir</button>
        </div>`).join("");
    }
    if (enviados.length) {
      html += `<h3 class="aj-pvp-titulo">Esperando respuesta</h3>` + enviados.map(f => `
        <div class="aj-pvp-fila">
          <span>Reto a <strong>${esc(nombreOponente(f))}</strong></span>
          <button type="button" class="aj-boton" data-cancelar="${f.id}">Cancelar</button>
        </div>`).join("");
    }
    if (terminadas.length) {
      html += `<h3 class="aj-pvp-titulo">Últimas partidas</h3>` + terminadas.map(f => `
        <div class="aj-pvp-fila">
          <span>contra <strong>${esc(nombreOponente(f))}</strong> · ${esc(textoResultado(f))}</span>
          <button type="button" class="aj-boton" data-revancha="${idOponente(f)}" ${ocupadosRev.has(idOponente(f)) ? "disabled" : ""}>Revancha</button>
        </div>`).join("");
    }
    partidasEl.innerHTML = html;

    const ocupados = new Set(abiertas.map(idOponente));
    jugadoresEl.innerHTML = jugadores.length ? jugadores.map(j => `
      <div class="aj-pvp-fila">
        <span><i class="aj-punto ${presentes.has(j.user_id) ? "on" : ""}" title="${presentes.has(j.user_id) ? "En línea" : "Desconectado"}"></i> ${esc(j.username)}</span>
        <button type="button" class="aj-boton" data-retar="${j.user_id}" ${ocupados.has(j.user_id) ? "disabled" : ""}>${ocupados.has(j.user_id) ? "Partida abierta" : "Retar"}</button>
      </div>`).join("") : `<p class="aj-ayuda">No hay otros jugadores con cuenta todavía.</p>`;
  }

  async function cargarJugadores() {
    const { data } = await supa.rpc("arqueria_jugadores");
    jugadores = data || [];
    pintarLobby();
  }

  async function cargarPartidas() {
    if (!supa) return;
    const { data, error } = await supa.from("arqueria_partidas").select("*").order("actualizada", { ascending: false }).limit(40);
    if (error) return;
    partidas = data || [];
    if (vs) {
      const f = partidas.find(x => x.id === vs.id);
      if (f) aplicarFila(f);
    }
    pintarLobby();
    registrarPendientes();
  }

  function programarCarga() {
    clearTimeout(aplazado);
    aplazado = setTimeout(cargarPartidas, 120);
  }

  function estadoTexto(texto) { ponerLinea(texto); }

  /* Abre una partida: deja el campo listo y espera a que los dos pulsen Listo. */
  function abrirVs(f) {
    cerrarVs();
    modo = "jugadores";
    rendirseEl.classList.remove("hidden");
    revanchaEl.classList.add("hidden");
    vs = { id: f.id, lado: mi(f), listoEnviado: false, cuenta: false, iniciada: false, terminada: false, puntaje: 0, enviado: 0, reclamo: null };
    juego.prepararVs({ nombre: nombreOponente(f), color: "#8fb4e8", semilla: f.semilla });
    refrescarVistas();
    if (f.estado === "jugando") {
      // La partida ya había empezado y esta página no la estaba jugando (se recargó): cuenta lo que llevaba
      if (!f[`fin_${vs.lado}`]) finalizarVs(puntajeMio(f), true);
      else estadoTexto("Esperando a que termine el otro jugador...");
    } else if (f.estado === "terminada") {
      mostrarResultado(f);
    } else {
      boton.classList.remove("hidden");
      estadoTexto(`Pulsa ▶ cuando estés listo. La partida con ${nombreOponente(f)} empieza cuando los dos lo hayan pulsado.`);
    }
    sondeoVs = setInterval(cargarPartidas, 800);
    escenarioEl.scrollIntoView({ block: "nearest" });
  }

  function cerrarVs() {
    clearInterval(sondeoVs); sondeoVs = null;
    clearInterval(envioPuntaje); envioPuntaje = null;
    clearTimeout(vs && vs.reclamo);
    clearInterval(vs && vs.reloj);
    cuentaEl.classList.add("hidden");
    vs = null;
  }

  async function marcarListo() {
    if (!vs || vs.listoEnviado) return;
    vs.listoEnviado = true;
    boton.classList.add("hidden");
    estadoTexto("Esperando al otro jugador...");
    const { data, error } = await supa.rpc("arqueria_listo", { p_id: vs.id });
    if (error) { vs.listoEnviado = false; boton.classList.remove("hidden"); estadoTexto("No se pudo marcar como listo. Inténtalo otra vez."); return; }
    if (data === "jugando") iniciarCuenta();
    else cargarPartidas();
  }

  /* Cuenta atrás de 3 segundos y arranca. Cada navegador la hace al enterarse de que
     la partida empezó, así que la diferencia entre los dos es solo lo que tarde el aviso. */
  function iniciarCuenta() {
    if (!vs || vs.cuenta || vs.iniciada) return;
    vs.cuenta = true;
    boton.classList.add("hidden");
    let n = 3;
    cuentaEl.textContent = n;
    cuentaEl.classList.remove("hidden");
    estadoTexto("");
    vs.reloj = setInterval(() => {
      n -= 1;
      if (n > 0) { cuentaEl.textContent = n; return; }
      clearInterval(vs.reloj);
      cuentaEl.classList.add("hidden");
      vs.iniciada = true;
      pintarRendirse();
      juego.iniciar();
      envioPuntaje = setInterval(enviarPuntaje, 1000);
    }, 1000);
  }

  async function enviarPuntaje() {
    if (!vs || vs.terminada || vs.puntaje === vs.enviado) return;
    vs.enviado = vs.puntaje;
    await supa.rpc("arqueria_puntaje", { p_id: vs.id, p_puntaje: vs.puntaje });
  }

  async function finalizarVs(puntaje, tardio) {
    if (!vs || vs.terminada) return;
    vs.terminada = true;
    pintarRendirse();
    clearInterval(envioPuntaje); envioPuntaje = null;
    juego.setFin({ titulo: "Esperando al otro jugador...", sub: `${puntaje} puntos` });
    const id = vs.id;
    await supa.rpc("arqueria_terminar", { p_id: id, p_puntaje: puntaje });
    // Si el otro nunca termina, pasado un tiempo se cierra la partida con su último puntaje
    vs.reclamo = setTimeout(async () => { await supa.rpc("arqueria_reclamar", { p_id: id }); cargarPartidas(); }, tardio ? 1000 : 45000);
    cargarPartidas();
  }

  function mostrarResultado(f) {
    const gane = f.resultado === mi(f);
    const titulo = f.resultado === "empate" ? "Empate" : gane ? "Ganaste" : "Perdiste";
    juego.setFin({ titulo, sub: `${puntajeMio(f)} a ${puntajeSuyo(f)}${f.motivo === "rendicion" ? (gane ? " · se rindió" : " · te rendiste") : ""}` });
    estadoTexto(`Partida contra ${nombreOponente(f)} terminada.`);
    rendirseEl.classList.add("hidden");
    boton.classList.add("hidden");
    revanchaEl.classList.remove("hidden");
  }

  /* Pone la partida abierta al día con lo guardado. */
  function aplicarFila(f) {
    if (!vs || f.id !== vs.id) return;
    juego.setPuntajeRival(puntajeSuyo(f));
    if (f.estado === "rechazada") {
      estadoTexto("La partida se canceló.");
      boton.classList.add("hidden");
      return;
    }
    if (f.estado === "jugando" && !vs.cuenta && !vs.iniciada && !vs.terminada) {
      if (vs.listoEnviado) iniciarCuenta();
      return;
    }
    if (f.estado === "terminada" && !jugando && (vs.terminada || !vs.iniciada)) {
      if (!vs.cuenta || vs.terminada) mostrarResultado(f);
    }
  }

  async function accion(rpc, args) {
    const { error } = await supa.rpc(rpc, args);
    if (error) dialogo.avisar(error.message || "No se pudo completar la acción.");
    await cargarPartidas();
  }

  partidasEl.addEventListener("click", async ev => {
    const b = ev.target.closest("button");
    if (!b || !supa) return;
    const d = b.dataset;
    if (d.aceptar) await accion("arqueria_responder", { p_id: d.aceptar, p_aceptar: true });
    else if (d.rechazar) await accion("arqueria_responder", { p_id: d.rechazar, p_aceptar: false });
    else if (d.cancelar) await accion("arqueria_rendirse", { p_id: d.cancelar });
    else if (d.revancha) await accion("arqueria_retar", { p_rival: d.revancha });
    else if (d.abrir) { const f = partidas.find(x => x.id === d.abrir); if (f) abrirVs(f); }
  });

  jugadoresEl.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-retar]");
    if (!b || !supa) return;
    b.disabled = true;
    await accion("arqueria_retar", { p_rival: b.dataset.retar });
  });

  revanchaEl.addEventListener("click", async () => {
    if (!vs || !supa) return;
    const f = partidas.find(x => x.id === vs.id);
    if (!f) return;
    revanchaEl.disabled = true;
    await accion("arqueria_retar", { p_rival: idOponente(f) });
    revanchaEl.disabled = false;
    cerrarVs();
    refrescarVistas();
  });

  cerrarEl.addEventListener("click", () => {
    if (jugando) return;
    cerrarVs();
    refrescarVistas();
    cargarPartidas();
  });

  rendirseSoloEl.addEventListener("click", async () => {
    if (vs || !jugando) return;
    const quien = rival.nombre;
    if (!(await dialogo.confirmar(`¿Te rindes? Cuenta como una derrota contra ${quien}.`, { titulo: "Rendirse", aceptar: "Rendirme", peligro: true }))) return;
    juego.rendirse();   // si el tiempo se acabó mientras decidías, ya no hay nada que rendir
  });

  rendirseEl.addEventListener("click", async () => {
    if (!vs) return;
    if (!(await dialogo.confirmar(vs.iniciada && !vs.terminada ? "¿Te rindes? Pierdes la partida." : "¿Abandonar esta partida?", { titulo: vs.iniciada && !vs.terminada ? "Rendirse" : "Abandonar", aceptar: vs.iniciada && !vs.terminada ? "Rendirme" : "Abandonar", peligro: true }))) return;
    const { error } = await supa.rpc("arqueria_rendirse", { p_id: vs.id });
    if (error) { dialogo.avisar(error.message || "No se pudo abandonar."); return; }
    cerrarVs();
    refrescarVistas();
    cargarPartidas();
  });

  function suscribir() {
    try {
      supa.channel("arqueria-partidas")
        .on("postgres_changes", { event: "*", schema: "public", table: "arqueria_partidas" }, programarCarga)
        .subscribe();
      const pres = supa.channel("arqueria-presencia", { config: { presence: { key: miId } } });
      pres.on("presence", { event: "sync" }, () => { presentes = new Set(Object.keys(pres.presenceState())); pintarLobby(); })
        .subscribe(async estado => { if (estado === "SUBSCRIBED") await pres.track({ en: Date.now() }); });
    } catch (err) { /* sin tiempo real: queda la consulta periódica */ }
    setInterval(() => { if (modo === "jugadores" && !vs && !document.hidden) cargarPartidas(); }, 4000);
    document.addEventListener("visibilitychange", () => { if (modo === "jugadores" && !document.hidden) cargarPartidas(); });
  }

  async function iniciarOnline() {
    if (enLinea) { cargarJugadores(); cargarPartidas(); return; }
    avisoEl.textContent = "Conectando...";
    try {
      const sesion = await fichasSesionActual();
      if (!sesion) { avisoEl.textContent = "Inicia sesión (arriba a la derecha) para jugar contra otros jugadores."; return; }
      miId = sesion.user.id;
      supa = await fichasCliente();
      enLinea = true;
      avisoEl.textContent = "Reta a alguien de la lista. Cuando acepte, abre la partida y pulsen ▶ los dos: juegan el mismo campo a la vez y ven el puntaje del otro subir.";
      try { await supa.rpc("arqueria_caducar"); } catch (err) { /* aún sin el SQL de caducidad */ }
      await Promise.all([cargarJugadores(), cargarPartidas()]);
      suscribir();
    } catch (err) {
      avisoEl.textContent = "No se pudo conectar. Revisa tu conexión y que el SQL de arqueria_pvp esté corrido.";
    }
  }

  // Con sesión iniciada, el marcador y el título usan tu nombre de usuario en vez de "Tú"
  if (window.MjStats) MjStats.cargarSesion().then(({ nombre }) => { if (nombre) juego.setNombreJugador(nombre); });

  function irAJugadores() {
    if (location.hash !== "#jugadores" || jugando) return;
    if (modo !== "jugadores") document.querySelector('.aj-modo[data-modo="jugadores"]').click();
    else if (vs && vs.terminada) cerrarEl.click();
    else if (supa && !vs) cargarPartidas();
  }
  window.addEventListener("hashchange", irAJugadores);

  pintarRivales();
  pintarRecord();
  refrescarVistas();
  if (window.MjStats) MjStats.cargarSesion().then(cargarRanking);
  irAJugadores();
})();
