/* Corrales: la pantalla de gestión de criaturas y sus hábitats (antes eran seis parcelas dentro de Mi habitación).
   Se elige un hábitat en la franja de abajo y la vista central enseña ese corral con su cría, su reloj y sus especies; las operaciones
   (criar, recoger, sacar a la pareja) son las de siempre y las valida el servidor: cartas_corral_iniciar / recoger / sacar
   (docs/economia-18_crianza.sql). El dibujo, el reloj y el estado salen de js/corrales-lib.js. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const C = window.Corrales;
  const { RAREZAS, dur, horasTxt } = C;
  const PILDORA = { listo: ["Lista", "hb-ok"], cria: ["En cría", "hb-azul"], descanso: ["Descansa", "hb-morado"], disponible: ["Libre", ""], vacio: ["Vacío", ""] };

  let historial = [], perfil = null, actual = null, supa = null;
  const cartaDe = id => (window.cartaPorId && window.cartaPorId(id)) || null;
  const nombreCarta = id => { const c = cartaDe(id); return c ? c.nombre : id; };
  const ver = () => C.ver();
  const corral = h => ver().corrales.find(c => c.habitat === h);

  function aviso(t, error) {
    const a = $("coAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("hb-error", !!error);
  }
  function mensaje(t, error) {
    const m = $("hbMsg");
    if (!m) return;
    m.textContent = t || "";
    m.classList.toggle("hb-error", !!error);
  }

  /* ---------------------------------------------------------------- hábitat elegido */
  function elegir(h, guardar) {
    if (!ver() || !corral(h)) return;
    actual = h;
    if (guardar !== false) { try { history.replaceState(null, "", "#" + h); } catch (e) { /* sin historial */ } }
    pintarVista();
    pintarFranja();
    pintarPanel();
  }
  function primerCorral() {
    const cs = ver().corrales;
    const por = t => cs.find(c => C.estado(c).tipo === t);
    return (por("listo") || por("cria") || por("disponible") || cs[0] || {}).habitat;
  }

  /* ---------------------------------------------------------------- vista central */
  function pintarVista() {
    const c = corral(actual);
    if (!c) return;
    const est = C.estado(c);
    const svg = $("coEscena");
    svg.setAttribute("class", `co-escena hb-e-${est.tipo}`);
    svg.setAttribute("aria-label", `${c.nombre}: ${est.texto}`);
    svg.innerHTML = `<g transform="scale(4)">${C.ARTE[c.habitat]()}${C.BICHOS}</g>`;
    $("coTitulo").textContent = c.nombre;
    $("coDesc").textContent = c.descripcion || "";
    pintarEstado(c, est);
  }
  // Solo lo que depende del tiempo (se llama cada segundo)
  function pintarEstado(c, est) {
    const p = PILDORA[est.tipo];
    $("coEstado").innerHTML = `<span class="hb-pildora ${p[1]}">${p[0]}</span> ${est.tipo === "cria" || est.tipo === "descanso" ? esc(est.texto) : ""}`;
    $("coBarra").style.width = Math.round(est.prog * 100) + "%";
    $("coBarraCaja").classList.toggle("hb-listo", est.tipo === "listo");
    $("coBarraCaja").classList.toggle("hb-descanso", est.tipo === "descanso");
    $("coEscena").setAttribute("class", `co-escena hb-e-${est.tipo}`);
  }

  /* ---------------------------------------------------------------- franja de hábitats */
  function pintarFranja() {
    $("coFranja").innerHTML = ver().corrales.map(c => {
      const est = C.estado(c);
      return `<button type="button" class="co-tile hb-e-${est.tipo}${c.habitat === actual ? " co-elegido" : ""}" data-h="${esc(c.habitat)}" aria-pressed="${c.habitat === actual}" aria-label="${esc(c.nombre)}: ${esc(est.texto)}">
        <svg viewBox="0 0 120 100" shape-rendering="crispEdges" aria-hidden="true">${C.ARTE[c.habitat]()}</svg>
        <i class="co-lampara"></i><b>${esc(c.nombre)}</b><small data-txt>${esc(est.texto)}</small>
        <span class="co-mini" aria-hidden="true"><i style="width:${Math.round(est.prog * 100)}%"></i></span></button>`;
    }).join("");
  }
  function refrescarFranja() {
    for (const c of ver().corrales) {
      const b = document.querySelector(`.co-tile[data-h="${c.habitat}"]`);
      if (!b) continue;
      const est = C.estado(c);
      b.className = `co-tile hb-e-${est.tipo}${c.habitat === actual ? " co-elegido" : ""}`;
      b.setAttribute("aria-label", `${c.nombre}: ${est.texto}`);
      b.querySelector("[data-txt]").textContent = est.texto;
      b.querySelector(".co-mini > i").style.width = Math.round(est.prog * 100) + "%";
    }
  }

  /* ---------------------------------------------------------------- cajas laterales */
  function pintarLados() {
    const v = ver();
    const crias = v.corrales.filter(c => c.cria), listas = v.corrales.filter(c => c.cria && C.estado(c).tipo === "listo");
    $("coTu").innerHTML = `<div class="hb-fila"><span>Jugador</span><b>${esc(perfil && perfil.username || "Tú")}</b></div>
      <div class="hb-fila"><span>Crías en marcha</span><b>${crias.length}</b></div>
      <div class="hb-fila"><span>Listas para recoger</span><b>${listas.length ? `<span class="hb-pildora hb-ok">${listas.length}</span>` : "0"}</b></div>`;
    $("coResumen").innerHTML = `<ul class="hb-lista">${v.corrales.map(c => {
      const est = C.estado(c), p = PILDORA[est.tipo];
      return `<li><button type="button" class="hb-clic" data-abrir="${esc(c.habitat)}">${esc(c.nombre)}</button> <span class="hb-pildora ${p[1]}">${p[0]}</span>${est.tipo === "cria" || est.tipo === "descanso" ? `<br><small>${esc(est.texto)}</small>` : ""}</li>`;
    }).join("")}</ul>`;
    const listasCriar = v.especies.filter(e => e.libres.length >= 2 && !e.sobrepoblada && e.en_circulacion);
    $("coListas").innerHTML = listasCriar.length
      ? `<ul class="hb-lista">${listasCriar.map(e => {
          const c = v.corrales.find(x => x.habitat === e.habitat);
          return `<li><button type="button" class="hb-clic" data-abrir="${esc(e.habitat)}">${esc(nombreCarta(e.carta))}</button> <small>${e.libres.length} copias · ${esc(c ? c.nombre : e.habitat)}</small></li>`;
        }).join("")}</ul>`
      : `<p class="lb-chico">Aún no tienes dos copias de la misma criatura. Las copias llegan jugando, intercambiando o con un poco de suerte.</p>`;
    $("coHistorial").innerHTML = historial.length
      ? `<ul class="hb-lista">${historial.map(h => `<li>${h.estado === "nacida" ? "🐣" : "⚠"} ${esc(nombreCarta(h.carta_id))}<br><small>${h.estado === "nacida" ? "nació" : "sin cupo"} · ${esc(new Date(h.cerrada).toLocaleDateString("es", { day: "numeric", month: "short" }))}</small></li>`).join("")}</ul>`
      : `<p class="lb-chico">Todavía no ha nacido ninguna cría.</p>`;
  }

  /* ---------------------------------------------------------------- panel de gestión del hábitat elegido */
  function pintarPanel() {
    const c = corral(actual);
    if (!c) return;
    const est = C.estado(c);
    let cuerpo = "";
    if (c.cria) {
      const cr = c.cria, listo = est.tipo === "listo", nom = nombreCarta(cr.carta_id);
      cuerpo = `<div class="hb-pareja"><b>${esc(nom)}</b> <span>copias n.º ${esc(cr.numero_a)} y n.º ${esc(cr.numero_b)}</span></div>
        <div class="hb-total ${listo ? "hb-listo" : ""}" id="hbTotal"><i style="width:${Math.round(est.prog * 100)}%"></i></div>
        <p class="hb-msg" id="hbRestante" style="color:inherit">${listo ? "La cría ya está lista." : `Faltan ${esc(dur(est.fin - C.ahora()))}.`}</p>
        <ol class="hb-fases" id="hbFases">${cr.fases.map((f, i) => `<li data-fase="${i}"><span class="hb-n">${i + 1}</span><div><b>${esc(f.nombre)}</b><span class="hb-mini"><i style="width:0%"></i></span></div><small>${esc(horasTxt(f.horas))}</small></li>`).join("")}</ol>
        <div class="hb-acciones">${listo
          ? `<button type="button" class="cartas-boton cartas-boton-principal" data-recoger="${esc(cr.id)}">Recoger la cría</button>`
          : `<button type="button" class="cartas-boton" data-sacar="${esc(cr.id)}">Sacar a la pareja (no nace nada)</button>`}</div>`;
    } else {
      const especies = ver().especies.filter(e => e.habitat === c.habitat);
      const libreCorral = est.tipo !== "descanso";
      cuerpo = (est.tipo === "descanso" ? `<p class="hb-msg" style="color:#c9b3ff">El corral descansa después del último nacimiento (${esc(est.texto.replace("Descansa ", "faltan "))}).</p>` : "")
        + `<p class="lb-chico" style="margin:0">Necesitas <b>dos copias tuyas de la misma criatura</b>. Las dos quedan en el corral hasta que termine la cría y luego vuelven contigo.</p>`
        + (especies.length ? `<ul class="hb-especies">${especies.map((e, i) => filaEspecie(e, i, libreCorral)).join("")}</ul>`
                           : `<p class="lb-chico">Todavía no hay especies asignadas a este corral.</p>`);
    }
    $("coPanel").innerHTML = `<h2>Cría en ${esc(c.nombre)}</h2><div class="lb-caja-cuerpo hb-cuerpo"><p class="hb-msg" id="hbMsg"></p>${cuerpo}</div>`;
    refrescarTiempo();
  }
  function filaEspecie(e, i, libreCorral) {
    const carta = cartaDe(e.carta), n = e.libres.length;
    const [a, b, c2] = e.horas.map(Number), total = a + b + c2;
    const puede = n >= 2 && !e.sobrepoblada && e.en_circulacion && libreCorral;
    let nota = "";
    if (e.sobrepoblada) nota = `<small class="hb-aviso-esp">Sobrepoblación de la especie: hay que respetar el medio ambiente.</small>`;
    else if (!e.en_circulacion) nota = `<small class="hb-aviso-esp">Esta criatura todavía no está en circulación.</small>`;
    else if (n < 2) nota = `<small>Te faltan ${2 - n} ${2 - n === 1 ? "copia" : "copias"} para poder criarla.</small>`;
    const selectores = puede && n > 2
      ? `<small>Copias: <select data-a="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 0 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select>
          <select data-b="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 1 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select></small>` : "";
    return `<li class="${puede ? "" : "hb-no"}" data-carta="${esc(e.carta)}"><div class="hb-info"><b>${esc(carta ? carta.nombre : e.carta)}</b> <small style="display:inline">(${esc(RAREZAS[carta && carta.rareza] || "")})</small>
        <small>Copias libres: ${n} de 2 necesarias · Cría completa: ${esc(horasTxt(total))} (${esc(horasTxt(a))} · ${esc(horasTxt(b))} · ${esc(horasTxt(c2))}) · Descanso: ${esc(horasTxt(Number(e.descanso_horas)))}</small>
        ${nota}${selectores}</div>
      ${puede ? `<button type="button" class="cartas-boton cartas-boton-principal" data-criar="${i}">Criar</button>` : ""}</li>`;
  }
  // Solo cambia lo que depende del tiempo (barras y texto), sin tocar los botones
  function refrescarTiempo() {
    if (!ver() || !actual) return;
    const c = corral(actual);
    if (!c || !c.cria || !$("hbTotal")) return;
    const est = C.estado(c), t = C.ahora();
    $("hbTotal").firstElementChild.style.width = Math.round(est.prog * 100) + "%";
    $("hbTotal").classList.toggle("hb-listo", est.tipo === "listo");
    const r = $("hbRestante");
    if (r) r.textContent = est.tipo === "listo" ? "La cría ya está lista." : `Faltan ${dur(est.fin - t)}.`;
    let desde = est.ini;
    c.cria.fases.forEach((f, i) => {
      const hasta = desde + f.horas * 3600000, li = document.querySelector(`#hbFases li[data-fase="${i}"]`);
      if (li) {
        const frac = Math.max(0, Math.min(1, (t - desde) / (hasta - desde)));
        li.classList.toggle("hb-hecha", t >= hasta);
        li.classList.toggle("hb-ahora", t >= desde && t < hasta);
        li.querySelector(".hb-mini > i").style.width = Math.round(frac * 100) + "%";
        li.querySelector(".hb-n").textContent = t >= hasta ? "✓" : String(i + 1);
      }
      desde = hasta;
    });
  }

  function mostrarCarta(titulo, cartaId, texto) {
    const c = cartaDe(cartaId);
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado hb-nace";
    dlg.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="ic-carta">${c && window.CartasVista ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
      <p><b>${esc(c ? c.nombre : cartaId)}</b>${texto ? `<br><small>${esc(texto)}</small>` : ""}</p>
      <button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector("button").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  async function alPulsarPanel(ev) {
    const criar = ev.target.closest("[data-criar]"), recoger = ev.target.closest("[data-recoger]"), sacar = ev.target.closest("[data-sacar]");
    try {
      if (criar) {
        const li = criar.closest("li"), i = criar.dataset.criar, carta = li.dataset.carta;
        const e = ver().especies.find(x => x.carta === carta);
        const a = li.querySelector(`[data-a="${i}"]`), b = li.querySelector(`[data-b="${i}"]`);
        const ida = a ? a.value : e.libres[0].id, idb = b ? b.value : e.libres[1].id;
        if (ida === idb) { mensaje("Elige dos copias distintas.", true); return; }
        criar.disabled = true;
        await C.rpc("cartas_corral_iniciar", { p_carta: carta, p_a: ida, p_b: idb });
        await cargar();
        mensaje("La pareja entra al corral. Vuelve cuando termine.");
      } else if (recoger) {
        recoger.disabled = true;
        const r = await C.rpc("cartas_corral_recoger", { p_id: recoger.dataset.recoger });
        await cargar();
        if (r.resultado === "cria") mostrarCarta("¡Ha nacido una cría!", r.carta, `Copia n.º ${r.numero}${r.de_reserva ? " (una copia que estaba en la reserva)" : ""}`);
        else mensaje(r.mensaje || "No ha nacido nada.", true);
      } else if (sacar) {
        if (!(await dialogo.confirmar("Si sacas a la pareja ahora, no nace nada y habrá que empezar de cero. ¿Sacarla?", { titulo: "Sacar a la pareja", aceptar: "Sacarla", peligro: true }))) return;
        await C.rpc("cartas_corral_sacar", { p_id: sacar.dataset.sacar });
        await cargar();
        mensaje("La pareja sale del corral.");
      }
    } catch (e) {
      mensaje(e.message || String(e), true);
      if (criar) criar.disabled = false;
      if (recoger) recoger.disabled = false;
    }
  }

  /* ---------------------------------------------------------------- arranque y reloj */
  function pintarTodo() {
    if (!actual || !corral(actual)) actual = primerCorral();
    pintarVista(); pintarFranja(); pintarLados();
    const m = $("hbMsg") ? $("hbMsg").textContent : "", err = $("hbMsg") && $("hbMsg").classList.contains("hb-error");
    pintarPanel(); mensaje(m, err);
  }
  async function cargar() {
    await C.cargar();
    const r = await supa.from("cartas_crias").select("carta_id, estado, cerrada, habitat").in("estado", ["nacida", "sin_cupo"]).order("cerrada", { ascending: false }).limit(8);
    historial = r.data || [];
    pintarTodo();
  }
  const ultimoTipo = {};
  function reloj() {
    if (!ver()) return;
    const c = corral(actual);
    if (c) pintarEstado(c, C.estado(c));
    refrescarFranja();
    refrescarTiempo();
    // Si una cría acaba de terminar, se repinta una vez lo que depende de ello
    let cambio = false;
    for (const x of ver().corrales) { const t = C.estado(x).tipo; if (ultimoTipo[x.habitat] && ultimoTipo[x.habitat] !== t) cambio = true; ultimoTipo[x.habitat] = t; }
    if (cambio) { pintarLados(); const m = $("hbMsg") ? $("hbMsg").textContent : ""; pintarPanel(); mensaje(m); }
  }

  async function iniciar() {
    $("coFranja").addEventListener("click", ev => { const b = ev.target.closest(".co-tile"); if (b) elegir(b.dataset.h); });
    document.addEventListener("click", ev => { const b = ev.target.closest("[data-abrir]"); if (b) { elegir(b.dataset.abrir); $("coVista").scrollIntoView({ block: "nearest", behavior: "smooth" }); } });
    $("coPanel").addEventListener("click", alPulsarPanel);
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (ver() && corral(h)) elegir(h, false); });
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) {
      aviso("Inicia sesión para entrar a los corrales.");
      $("coCuerpo").classList.add("hidden");
      return;
    }
    supa = await fichasCliente();
    try {
      const rol = await CartasCliente.verificarRol();
      await CartasCliente.cargarDefiniciones(rol.puede);
    } catch (e) { /* las cartas se verán por su id */ }
    try { const r = await supa.from("perfiles").select("username, side").eq("user_id", sesion.user.id).maybeSingle(); perfil = r.data; } catch (e) { perfil = null; }
    const deLaUrl = location.hash.slice(1);
    try {
      actual = C.ORDEN.includes(deLaUrl) ? deLaUrl : null;
      await cargar();
    } catch (e) {
      aviso("Los corrales todavía no están activados en el servidor (falta aplicar economia-18_crianza.sql). " + (e.message || ""), true);
      return;
    }
    setInterval(reloj, 1000);
    setInterval(() => { if (!document.hidden) cargar().catch(() => {}); }, 30000);
  }
  iniciar();
})();
