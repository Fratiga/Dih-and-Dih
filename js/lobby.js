/* =============================================================================
   LOBBY — la portada. Sin sesión muestra solo la bienvenida y manda a iniciar.
   Con sesión llena la taberna: tu personaje, retos pendientes, novedades,
   fanarts nuevos, tu posición en los rankings y quién está conectado.
   Todo lo que viene de Supabase es opcional: si una tabla no existe o falla,
   esa caja dice que no hay nada y el resto sigue funcionando.
============================================================================= */
(function () {
  const $ = id => document.getElementById(id);
  const body = document.body;

  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --- Ambiente según el Side y los juegos escondidos ---------------------- */
  function aplicarAmbiente() {
    const lado = typeof ladoActual === "function" ? ladoActual() : null;
    if (lado === "A" || lado === "B") document.documentElement.dataset.lado = lado; else delete document.documentElement.dataset.lado;
    body.classList.toggle("lb-admin", typeof esAdmin === "function" && esAdmin());
  }
  aplicarAmbiente();

  /* --- Novedades: cinta de arriba, tablón y "última actualización" --------- */
  function fechaCorta(iso) {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("es", { day: "numeric", month: "short" });
  }

  function pintarNovedades() {
    const lista = (window.NOVEDADES || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    $("lbTicker").innerHTML = lista.slice(0, 5).map(n =>
      `<span><b>[${esc(fechaCorta(n.fecha))}]</b> ${n.enlace ? `<a href="${esc(n.enlace)}">${esc(n.titulo)}</a>` : esc(n.titulo)}</span>`
    ).join("");
    $("lbNovedades").innerHTML = lista.slice(0, 6).map(n => `
      <div class="lb-novedad">
        <time>${esc(fechaCorta(n.fecha))}</time>
        <strong>${n.enlace ? `<a href="${esc(n.enlace)}">${esc(n.titulo)}</a>` : esc(n.titulo)}</strong>
        <p>${esc(n.texto)}</p>
      </div>`).join("") || `<p class="lb-chico">Nada nuevo por ahora.</p>`;
    if (lista[0]) {
      const d = new Date(lista[0].fecha + "T12:00:00");
      $("lbActualizado").textContent = isNaN(d) ? lista[0].fecha : d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  /* --- Contador de visitas (guardado en este navegador) -------------------- */
  function contarVisita() {
    let n = 0; let ultima = "";
    try {
      n = (parseInt(localStorage.getItem("lbVisitas"), 10) || 0) + 1;
      ultima = localStorage.getItem("lbUltimaVisita") || "";
      localStorage.setItem("lbVisitas", String(n));
      localStorage.setItem("lbUltimaVisita", new Date().toISOString());
    } catch (e) { n = 1; }
    $("lbVisitas").textContent = String(n);
    if (ultima) {
      const d = new Date(ultima);
      $("lbUltima").textContent = isNaN(d) ? "" : `Última vez: ${d.toLocaleDateString("es", { day: "numeric", month: "short" })}`;
    } else {
      $("lbUltima").textContent = "Primera vez por aquí.";
    }
  }

  /* --- Contador global (tabla lobby_contador, ver scratchpad/lobby_contador.sql) ---
     Cuenta una visita como mucho cada 30 minutos por navegador, así recargar no
     lo infla. Si la tabla no existe todavía, la caja se queda en ceros. */
  async function contarVisitaGlobal() {
    const el = $("lbVisitasGlobal");
    let contar = true;
    try {
      const ultima = parseInt(localStorage.getItem("lbVisitaGlobalTs"), 10) || 0;
      contar = Date.now() - ultima > 30 * 60 * 1000;
      if (contar) localStorage.setItem("lbVisitaGlobalTs", String(Date.now()));
    } catch (e) { /* sin almacenamiento: se cuenta */ }
    try {
      const supabase = await fichasCliente();
      const { data, error } = await supabase.rpc("lobby_visita", { p_contar: contar });
      if (error) throw error;
      if (data !== null && data !== undefined) el.textContent = String(data).padStart(7, "0");
    } catch (e) { /* contador no disponible */ }
  }

  /* --- La escena: cuadro que cambia y un poco de profundidad --------------- */
  function iniciarEscena() {
    const escena = $("lbEscena");
    if (!escena || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const caja = escena.closest(".lb-escena-caja");
    caja.addEventListener("pointermove", e => {
      const r = caja.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      escena.style.transform = `translate(${(-x * 6).toFixed(1)}px, ${(-y * 4).toFixed(1)}px) scale(1.012)`;
    });
    caja.addEventListener("pointerleave", () => { escena.style.transform = ""; });
    escena.style.transition = "transform .15s steps(4)";
  }

  /* --- Atajos: cada quien elige los suyos (se guardan en este navegador) ---------
     Se puede marcar cualquier página del sitio, ordenarlas y añadir enlaces propios. */
  const PAGINAS = [
    ["compendio.html", "Compendio"], ["mapa.html", "Mapa"], ["cronologia.html", "Cronología"],
    ["lugares.html", "Lugares"], ["facciones.html", "Facciones"], ["personajes.html", "Personajes"],
    ["razas.html", "Razas"], ["religion.html", "Religión"], ["textos.html", "Textos"],
    ["pergaminos.html", "Pergaminos"], ["armas.html", "Armas"], ["objetos.html", "Objetos"],
    ["bestiario.html", "Bestiario"], ["reglas.html", "Reglas"], ["economia.html", "Economía"],
    ["estadisticas.html", "Estadísticas"], ["fanarts.html", "Fanarts"], ["peticiones.html", "Peticiones"],
    ["fichas.html", "Mis personajes"], ["minijuegos.html", "Minijuegos"], ["ajedrez.html", "Ajedrez"],
    ["ritmo.html", "Zarabanda"], ["parranda.html", "Parranda"], ["rocola.html", "Rocola"], ["sacrificio.html", "Hooey"],
    ["arqueria.html", "Arquería"], ["duelo.html", "Duelo", true], ["cartas.html", "Cartas", true],
    ["ostelar.html", "Ostelar", true], ["hipodromo.html", "Hipódromo", true], ["admin.html", "Admin", true]
  ];
  const ATAJOS_CLAVE = "lbAtajos";
  const ATAJOS_BASE = ["compendio.html", "mapa.html", "cronologia.html", "bestiario.html", "fanarts.html", "minijuegos.html"];

  function paginasDisponibles() {
    const admin = typeof esAdmin === "function" && esAdmin();
    return PAGINAS.filter(p => !p[2] || admin).map(p => ({ href: p[0], nombre: p[1] }));
  }

  // Un atajo es { href, nombre }. Los enlaces propios solo pueden ser páginas del sitio o https://.
  function enlaceValido(href) {
    if (typeof href !== "string" || href.length > 300) return false;
    if (/^https:\/\/[^\s]+$/i.test(href)) return true;
    return /^[a-z0-9_\-]+\.html(#[\w\-]*)?(\?[\w=&%\-]*)?$/i.test(href);
  }

  function leerAtajos() {
    try {
      const guardado = JSON.parse(localStorage.getItem(ATAJOS_CLAVE) || "null");
      if (Array.isArray(guardado)) {
        return guardado.filter(a => a && typeof a.nombre === "string" && enlaceValido(a.href)).slice(0, 24);
      }
    } catch (e) { /* se usan los de base */ }
    const disp = paginasDisponibles();
    return ATAJOS_BASE.map(h => disp.find(p => p.href === h)).filter(Boolean);
  }
  function guardarAtajos(lista) {
    try {
      localStorage.setItem(ATAJOS_CLAVE, JSON.stringify(lista));
      localStorage.setItem(ATAJOS_TS, new Date().toISOString());
    } catch (e) { /* sin almacenamiento */ }
    subirAtajos(lista);
  }

  /* Sincronización con la cuenta (tabla atajos_usuario, ver scratchpad/atajos_usuario.sql).
     Gana lo más reciente: al entrar, si lo guardado en la cuenta es más nuevo que lo de este
     navegador, se usa lo de la cuenta; si es al revés, se sube lo de este navegador. Sin la
     tabla, los atajos siguen funcionando solo en este navegador. */
  const ATAJOS_TS = "lbAtajosTs";
  let atajosSupa = null;
  let atajosUsuario = null;
  let atajosTimer = null;

  function subirAtajos(lista) {
    if (!atajosSupa || !atajosUsuario) return;
    clearTimeout(atajosTimer);
    atajosTimer = setTimeout(async () => {
      try {
        await atajosSupa.from("atajos_usuario").upsert({ user_id: atajosUsuario, atajos: lista, updated_at: new Date().toISOString() });
      } catch (e) { /* se queda en este navegador */ }
    }, 600);
  }

  async function sincronizarAtajos(supabase, miId) {
    atajosSupa = supabase;
    atajosUsuario = miId;
    try {
      const { data, error } = await supabase.from("atajos_usuario").select("atajos, updated_at").eq("user_id", miId).maybeSingle();
      if (error) throw error;
      const tsLocal = localStorage.getItem(ATAJOS_TS) || "";
      const hayLocal = localStorage.getItem(ATAJOS_CLAVE) !== null;
      if (data && Array.isArray(data.atajos) && (!hayLocal || data.updated_at > tsLocal)) {
        localStorage.setItem(ATAJOS_CLAVE, JSON.stringify(data.atajos));
        localStorage.setItem(ATAJOS_TS, data.updated_at);
        pintarAtajos();
      } else if (data && data.atajos === null && data.updated_at > tsLocal) {
        // en otro dispositivo los restablecieron
        localStorage.removeItem(ATAJOS_CLAVE);
        localStorage.setItem(ATAJOS_TS, data.updated_at);
        pintarAtajos();
      } else if (hayLocal && (!data || tsLocal > data.updated_at)) {
        subirAtajos(leerAtajos());
      }
    } catch (e) { /* sin la tabla: solo este navegador */ }
  }

  function restablecerAtajos() {
    try {
      localStorage.removeItem(ATAJOS_CLAVE);
      localStorage.setItem(ATAJOS_TS, new Date().toISOString());
    } catch (e) { /* sin almacenamiento */ }
    if (atajosSupa && atajosUsuario) {
      atajosSupa.from("atajos_usuario").upsert({ user_id: atajosUsuario, atajos: null, updated_at: new Date().toISOString() }).then(() => {}, () => {});
    }
  }

  function colorDe(texto) {
    let h = 0;
    for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return [`hsl(${h} 45% 42%)`, `hsl(${h} 50% 22%)`];
  }

  function pintarAtajos() {
    const cont = $("lbAtajos");
    const lista = leerAtajos();
    const admin = typeof esAdmin === "function" && esAdmin();
    const visibles = lista.filter(a => admin || !PAGINAS.some(p => p[2] && p[0] === a.href));
    cont.innerHTML = visibles.length
      ? visibles.map(a => {
        const [c1, c2] = colorDe(a.nombre);
        const externo = /^https:/i.test(a.href);
        return `<a class="lb-88" href="${esc(a.href)}" ${externo ? 'target="_blank" rel="noopener noreferrer"' : ""} style="--c1:${c1};--c2:${c2}" title="${esc(a.nombre)}">${esc(a.nombre.toUpperCase().slice(0, 14))}</a>`;
      }).join("")
      : `<p class="lb-vacio">Sin atajos. Pulsa ✎ para elegir.</p>`;
  }

  function abrirEditorAtajos() {
    const ed = $("lbAtajosEditor");
    let lista = leerAtajos();
    const disp = paginasDisponibles();
    const propios = lista.filter(a => !disp.some(p => p.href === a.href));

    function pintar() {
      const marcados = new Set(lista.map(a => a.href));
      ed.innerHTML = `
        <h3>Tus atajos (en orden)</h3>
        ${lista.length ? lista.map((a, i) => `
          <div class="lb-atajo-fila">
            <label><input type="checkbox" checked data-quitar="${i}"> ${esc(a.nombre)}</label>
            <button type="button" class="lb-mini" data-sube="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">▲</button>
            <button type="button" class="lb-mini" data-baja="${i}" ${i === lista.length - 1 ? "disabled" : ""} aria-label="Bajar">▼</button>
          </div>`).join("") : `<p class="lb-vacio">Ninguno.</p>`}
        <h3 style="margin-top:8px">Añadir una página</h3>
        ${disp.filter(p => !marcados.has(p.href)).map(p => `
          <div class="lb-atajo-fila"><label><input type="checkbox" data-agrega="${esc(p.href)}"> ${esc(p.nombre)}</label></div>`).join("") || `<p class="lb-vacio">Ya tienes todas.</p>`}
        <h3 style="margin-top:8px">Enlace propio</h3>
        <form id="lbAtajoPropio">
          <input type="text" id="lbAtajoNombre" maxlength="14" placeholder="Nombre corto" required>
          <input type="text" id="lbAtajoUrl" placeholder="https://... o una página .html" required>
          <button type="submit" class="lb-boton">Añadir</button>
          <p class="lb-chico" id="lbAtajoError"></p>
        </form>
        <div class="lb-atajos-acciones">
          <button type="button" class="lb-boton" id="lbAtajosListo">Listo</button>
          <button type="button" class="lb-boton" id="lbAtajosBase">Restablecer</button>
        </div>`;
    }
    function aplicar() { guardarAtajos(lista); pintarAtajos(); pintar(); }

    ed.onclick = e => {
      const t = e.target;
      if (t.dataset.sube !== undefined) { const i = +t.dataset.sube; [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; aplicar(); }
      else if (t.dataset.baja !== undefined) { const i = +t.dataset.baja; [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; aplicar(); }
      else if (t.dataset.quitar !== undefined) { lista.splice(+t.dataset.quitar, 1); aplicar(); }
      else if (t.dataset.agrega !== undefined) { const p = disp.find(x => x.href === t.dataset.agrega); if (p && lista.length < 24) { lista.push(p); aplicar(); } }
      else if (t.id === "lbAtajosListo") { ed.classList.add("hidden"); ed.innerHTML = ""; }
      else if (t.id === "lbAtajosBase") {
        restablecerAtajos();
        lista = leerAtajos();
        pintarAtajos(); pintar();
      }
    };
    ed.onsubmit = e => {
      e.preventDefault();
      const nombre = $("lbAtajoNombre").value.trim();
      let url = $("lbAtajoUrl").value.trim();
      if (!enlaceValido(url)) { $("lbAtajoError").textContent = "Solo páginas del sitio (algo.html) o enlaces que empiecen con https://"; return; }
      if (lista.length >= 24) { $("lbAtajoError").textContent = "Ya son demasiados atajos."; return; }
      lista.push({ href: url, nombre });
      aplicar();
    };
    ed.classList.remove("hidden");
    pintar();
  }

  $("lbAtajosEditar").addEventListener("click", () => {
    const ed = $("lbAtajosEditor");
    if (ed.classList.contains("hidden")) abrirEditorAtajos(); else { ed.classList.add("hidden"); ed.innerHTML = ""; }
  });

  /* --- Saludo según la hora ------------------------------------------------ */
  function saludar(nombre) {
    const h = new Date().getHours();
    const frase = h < 6 ? "Qué haces despierto" : h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
    $("lbSaludo").innerHTML = `${frase}, <b>${esc(nombre || "viajero")}</b>. La mesa está lista.`;
  }

  /* --- Datos de la cuenta -------------------------------------------------- */
  const ver = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  async function cargarPersonajes(supabase, miId) {
    const { data, error } = await supabase.from("fichas_personajes")
      .select("id, data, owner_id, archivado").eq("owner_id", miId).eq("archivado", false)
      .order("updated_at", { ascending: false }).limit(6);
    if (error) throw error;
    const vivos = (data || []).filter(f => !(f.data && f.data.fallecido)).slice(0, 3);
    if (!vivos.length) {
      ver("lbPersonajes", `<p class="lb-chico">Todavía no tienes personajes.</p><p><a class="lb-boton" href="fichas.html">Crear uno</a></p>`);
      return;
    }
    ver("lbPersonajes", vivos.map(f => {
      const d = f.data || {};
      const id = d.identidad || {};
      const c = d.combate || {};
      const pct = c.pvMax > 0 ? Math.max(0, Math.min(100, Math.round((c.pvActual / c.pvMax) * 100))) : 0;
      return `<div class="lb-pj">
        <a class="lb-pj-nombre" href="fichas.html">${esc(id.nombre || "Sin nombre")}</a>
        <div class="lb-chico">${esc([id.raza, id.clase].filter(Boolean).join(" · ") || "—")} · Nivel ${esc(id.nivelTotal || 1)}</div>
        ${c.pvMax > 0 ? `<div class="lb-barra"><i style="width:${pct}%"></i></div><div class="lb-chico">PV ${esc(c.pvActual)} / ${esc(c.pvMax)}</div>` : ""}
      </div>`;
    }).join(""));
  }

  async function cargarRetos(supabase, miId) {
    const avisos = [];
    // Ajedrez: retos que esperan respuesta y partidas donde te toca mover
    try {
      const { data } = await supabase.from("ajedrez_partidas").select("estado, retador, blancas, negras, jugadas").in("estado", ["pendiente", "en_curso"]);
      const lista = data || [];
      const retos = lista.filter(p => p.estado === "pendiente" && p.retador !== miId).length;
      const turno = lista.filter(p => p.estado === "en_curso" && (p.jugadas.length % 2 === 0 ? p.blancas : p.negras) === miId).length;
      if (retos) avisos.push(`<a class="lb-aviso" href="ajedrez.html">♞ Ajedrez: ${retos} reto${retos === 1 ? "" : "s"} sin responder</a>`);
      if (turno) avisos.push(`<a class="lb-aviso" href="ajedrez.html">♞ Ajedrez: te toca mover en ${turno} partida${turno === 1 ? "" : "s"}</a>`);
    } catch (e) { /* sin ajedrez entre jugadores */ }
    // Arquería
    try {
      const { data } = await supabase.from("arqueria_partidas").select("estado, a, b").in("estado", ["pendiente", "listos", "jugando"]);
      const lista = data || [];
      const retos = lista.filter(p => p.estado === "pendiente" && p.b === miId).length;
      const abiertas = lista.filter(p => p.estado !== "pendiente").length;
      if (retos) avisos.push(`<a class="lb-aviso" href="arqueria.html">➶ Arquería: ${retos} reto${retos === 1 ? "" : "s"} sin responder</a>`);
      if (abiertas) avisos.push(`<a class="lb-aviso" href="arqueria.html">➶ Arquería: ${abiertas} partida${abiertas === 1 ? "" : "s"} en marcha</a>`);
    } catch (e) { /* sin arquería entre jugadores */ }
    ver("lbRetos", avisos.join("") || `<p class="lb-chico">Nadie te ha retado. Mueve tú primero.</p>`);
  }

  async function cargarFanarts(supabase) {
    const { data, error } = await supabase.from("fanarts_subidos").select("src, nombre").order("creada", { ascending: false }).limit(4);
    if (error || !data || !data.length) return;
    $("lbFanartsCaja").hidden = false;
    ver("lbFanarts", data.map(f => `<a href="fanarts.html" title="${esc(f.nombre)}"><img src="${esc(f.src)}" alt="${esc(f.nombre)}" loading="lazy"></a>`).join(""));
  }

  async function cargarRanking(supabase, miId) {
    const filas = [];
    function puesto(lista, valor) {
      const ordenada = lista.filter(x => valor(x) > 0).sort((a, b) => valor(b) - valor(a));
      const i = ordenada.findIndex(x => x.user_id === miId);
      return i < 0 ? null : { puesto: i + 1, de: ordenada.length, valor: valor(ordenada[i]) };
    }
    try {
      const juegos = (typeof esAdmin === "function" && esAdmin()) ? ["ajedrez", "duelo"] : ["ajedrez"]; // el duelo está escondido
      const { data } = await supabase.from("mj_estadisticas").select("user_id, juego, victorias").in("juego", juegos);
      juegos.forEach(juego => {
        const porUsuario = {};
        (data || []).filter(f => f.juego === juego).forEach(f => { porUsuario[f.user_id] = (porUsuario[f.user_id] || 0) + f.victorias; });
        const lista = Object.entries(porUsuario).map(([user_id, v]) => ({ user_id, v }));
        const r = puesto(lista, x => x.v);
        if (r) filas.push(`<div class="lb-fila"><span>${juego === "ajedrez" ? "Ajedrez" : "Duelo"}</span><b>#${r.puesto} de ${r.de}</b></div><div class="lb-chico" style="margin:0 0 2px">${r.valor} victoria${r.valor === 1 ? "" : "s"}</div>`);
      });
    } catch (e) { /* sin estadísticas */ }
    try {
      const { data } = await supabase.from("hooey_puntajes").select("user_id, mejor_racha");
      const r = puesto(data || [], x => x.mejor_racha);
      if (r) filas.push(`<div class="lb-fila"><span>Hooey</span><b>#${r.puesto} de ${r.de}</b></div><div class="lb-chico" style="margin:0 0 2px">Mejor racha: ${r.valor}</div>`);
    } catch (e) { /* sin ranking de Hooey */ }
    ver("lbRanking", filas.join("") || `<p class="lb-chico">Juega una partida y aparecerás aquí.</p>`);
  }

  /* --- Peticiones que ya atendí (el estado lo guarda js/peticiones.js) ----------- */
  async function avisarPeticiones() {
    let mias = [];
    try { mias = JSON.parse(localStorage.getItem("compendioMisPeticiones") || "[]") || []; } catch (e) { return; }
    const pendientes = mias.filter(m => !m.atendida);
    if (pendientes.length && typeof peticionesEstado === "function") {
      try {
        const estados = await peticionesEstado(pendientes.map(m => m.codigo));
        const atendidas = new Set(estados.filter(e => e.atendida).map(e => e.codigo));
        mias.forEach(m => { if (atendidas.has(m.codigo)) m.atendida = true; });
        localStorage.setItem("compendioMisPeticiones", JSON.stringify(mias));
      } catch (e) { /* sin el SQL de estado */ }
    }
    const nuevas = mias.filter(m => m.atendida && !m.visto);
    if (!nuevas.length) return;
    const caja = $("lbRetos");
    const aviso = nuevas.map(m => `<a class="lb-aviso" href="peticiones.html">✔ Atendí tu petición: «${esc(m.texto.length > 50 ? m.texto.slice(0, 50) + "…" : m.texto)}»</a>`).join("");
    caja.innerHTML = aviso + (caja.querySelector(".lb-chico") && caja.children.length === 1 ? "" : caja.innerHTML);
  }

  /* --- Quién está en la taberna (presencia en tiempo real) ----------------- */
  function iniciarPresencia(supabase, miId, miNombre) {
    if (!window.Presencia) {
      ver("lbPresentes", `<p class="lb-chico">No se puede ver quién hay.</p>`);
      return;
    }
    window.Presencia.suscribir(lista => {
      ver("lbPresentes", lista.length
        ? lista.map(n => `<div class="lb-presente${n.oculto ? " lb-lejos" : ""}">
            <span class="lb-punto"></span><b>${esc(n.nombre)}</b>${n.id === miId ? ` <span class="lb-chico">(tú)</span>` : ""}
            ${n.frase ? `<div class="lb-frase">${esc(n.frase)}</div>` : ""}
          </div>`).join("")
        : `<p class="lb-chico">Solo estás tú.</p>`);
    });
  }

  /* --- Sesión: qué se muestra ---------------------------------------------- */
  let cargado = false;
  async function conSesion(sesion) {
    body.classList.remove("lb-invitado");
    aplicarAmbiente();
    const miId = sesion.user.id;
    const nombre = (typeof nombreUsuario === "function" && nombreUsuario()) || (sesion.user.email || "").split("@")[0];
    saludar(nombre);
    if (cargado) return;
    cargado = true;
    pintarNovedades();
    contarVisita();
    let supabase;
    try { supabase = await fichasCliente(); } catch (e) { return; }
    sincronizarAtajos(supabase, miId);
    iniciarPresencia(supabase, miId, nombre);
    cargarPersonajes(supabase, miId).catch(() => ver("lbPersonajes", `<p class="lb-chico">No se pudieron cargar tus personajes.</p>`));
    cargarRetos(supabase, miId).catch(() => ver("lbRetos", `<p class="lb-chico">Sin novedades de partidas.</p>`)).then(avisarPeticiones);
    cargarFanarts(supabase).catch(() => {});
    cargarRanking(supabase, miId).catch(() => ver("lbRanking", `<p class="lb-chico">Sin datos todavía.</p>`));
  }

  function sinSesion() {
    body.classList.add("lb-invitado");
    cargado = false;
  }

  $("lbEntrar").addEventListener("click", () => {
    const insignia = $("globalLadoBadge");
    if (insignia) insignia.click();
  });

  iniciarEscena();
  pintarAtajos();
  pintarNovedades();
  contarVisitaGlobal();
  if (typeof fichasEnCambioDeSesion === "function") {
    fichasEnCambioDeSesion(sesion => { if (sesion) conSesion(sesion); else sinSesion(); }).catch(sinSesion);
  } else {
    sinSesion();
  }
})();
