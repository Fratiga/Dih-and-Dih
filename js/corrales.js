/* Corrales: la pantalla de gestión de criaturas y sus hábitats.
   El foco es el corral activo: un escenario grande con su bioma animado (js/corrales-arte.js), las criaturas de ese hábitat en sus sitios
   y, debajo, la ficha del corral (estado y reloj) y lo que se puede hacer ahora. Las operaciones son las de siempre y las valida el
   servidor: cartas_corral_iniciar / recoger / sacar (docs/economia-18_crianza.sql). El reloj y el estado salen de js/corrales-lib.js.
   Cada criatura se dibuja con assets/criaturas/<id de la carta>.png; si falta, con assets/criaturas/generica.png. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const C = window.Corrales, A = window.CorralesArte;
  const { RAREZAS, dur, horasTxt } = C;
  const ESTADOS = { listo: ["Lista", "hb-ok"], cria: ["En cría", "hb-azul"], descanso: ["Descansa", "hb-morado"], disponible: ["Libre", ""], vacio: ["Sin pareja", ""] };

  let historial = [], actual = null, supa = null, firmaEscena = "";
  const cartaDe = id => (window.cartaPorId && window.cartaPorId(id)) || null;
  const nombreCarta = id => { const c = cartaDe(id); return c ? c.nombre : id; };
  const ver = () => C.ver();
  const corral = h => ver().corrales.find(c => c.habitat === h);
  const sprite = id => `assets/criaturas/${encodeURIComponent(id)}.png`;

  /* Si no existe el PNG de una criatura se prueba con la genérica; si tampoco, la imagen se esconde y queda la sombra */
  window.coFallo = function (img) {
    const atributo = img.tagName.toLowerCase() === "image" ? "href" : "src";
    if (img.dataset.paso) { img.style.display = "none"; return; }
    img.dataset.paso = "1";
    img.setAttribute(atributo, "assets/criaturas/generica.png");
  };

  function aviso(t, error) {
    const a = $("coAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("hb-error", !!error);
  }
  function mensaje(t, error) {
    const m = $("coMsg");
    if (!m) return;
    m.textContent = t || "";
    m.classList.toggle("hb-error", !!error);
  }

  /* ---------------------------------------------------------------- fase de la cría (0, 1, 2) o 3 si ya está lista */
  function faseDe(c, est) {
    if (!c.cria) return -1;
    if (est.tipo === "listo") return 3;
    let desde = est.ini;
    const t = C.ahora();
    for (let i = 0; i < c.cria.fases.length; i++) {
      const hasta = desde + c.cria.fases[i].horas * 3600000;
      if (t < hasta) return i;
      desde = hasta;
    }
    return c.cria.fases.length - 1;
  }

  /* ---------------------------------------------------------------- criaturas en el escenario */
  function bicho(carta, sitio, i, clase, titulo, volteo) {
    const s = sitio.s || 1, w = 128 * s, h = 128 * s;
    return `<g class="co-bicho ${clase}" transform="translate(${sitio.x} ${sitio.y})" style="--d:${(i * 0.7).toFixed(1)}s"><title>${esc(titulo)}</title>
      <ellipse class="co-sombra" cx="0" cy="0" rx="${Math.round(w * .3)}" ry="${Math.round(w * .06)}"/>
      <g class="co-bicho-in"><g transform="scale(${volteo ? -1 : 1} 1)"><image href="${sprite(carta)}" x="${-w / 2}" y="${-h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet" onerror="coFallo(this)"/></g></g></g>`;
  }

  function colocar(c, est) {
    const capa = $("coEscena").querySelector(".co-capa");
    if (!capa) return;
    const sitios = A.SITIOS[c.habitat] || [], pareja = A.PAREJA[c.habitat] || [];
    let s = "";
    if (c.cria) {
      // La pareja que cría, junto al nido, y lo que pasa en cada fase
      const f = faseDe(c, est), carta = c.cria.carta_id, nombre = nombreCarta(carta);
      const mx = (pareja[0].x + pareja[1].x) / 2, my = pareja[0].y;
      s += bicho(carta, pareja[0], 0, "co-pareja", `${nombre} (n.º ${c.cria.numero_a})`, false) + bicho(carta, pareja[1], 1, "co-pareja", `${nombre} (n.º ${c.cria.numero_b})`, true);
      if (f === 0) s += `<g class="co-corazones" transform="translate(${mx} ${my - 120})">${[-26, 0, 26].map((dx, k) => `<g class="co-corazon" style="animation-delay:${-k * 0.8}s"><path d="M${dx - 8} 0 h6 v-4 h6 v4 h6 v6 h-4 v4 h-4 v4 h-6 v-4 h-4 v-4 h-4z" fill="#ff7ac0" transform="scale(.9)"/></g>`).join("")}</g>`;
      else if (f === 1) s += `<g class="co-huevo" transform="translate(${mx} ${my - 8})"><ellipse cx="0" cy="-26" rx="26" ry="34" fill="#f2ead2"/><ellipse cx="-8" cy="-34" rx="7" ry="9" fill="#ffffff" opacity=".5"/><rect x="-14" y="-18" width="8" height="6" fill="#c9b08a"/><rect x="6" y="-30" width="8" height="6" fill="#c9b08a"/><rect x="-2" y="-8" width="6" height="5" fill="#c9b08a"/></g>`;
      else s += bicho(carta, { x: mx, y: my + 6, s: f === 3 ? 0.7 : 0.55 }, 2, "co-cria", `Cría de ${nombre}`, false) + (f === 3 ? `<g class="co-chispas" transform="translate(${mx} ${my - 130})">${[-50, -16, 18, 52].map((dx, k) => `<g class="co-chispa" style="animation-delay:${-k * 0.5}s"><rect x="${dx}" y="0" width="6" height="6" fill="#fff1b0"/><rect x="${dx - 5}" y="2" width="16" height="2" fill="#fff1b0"/><rect x="${dx + 2}" y="-5" width="2" height="16" fill="#fff1b0"/></g>`).join("")}</g>` : "");
    } else {
      // Las criaturas de este hábitat en sus sitios: encendidas las que tienes, apagadas las que aún no
      const especies = ver().especies.filter(e => e.habitat === c.habitat).slice(0, sitios.length);
      especies.forEach((e, i) => {
        const lib = e.libres.length, nombre = nombreCarta(e.carta);
        const clase = `${lib >= 2 && !e.sobrepoblada && e.en_circulacion ? "co-lista" : lib >= 1 ? "co-tengo" : "co-no"}${est.tipo === "descanso" ? " co-duerme" : ""}`;
        s += bicho(e.carta, sitios[i], i, clase, lib ? `${nombre}: ${lib} ${lib === 1 ? "copia libre" : "copias libres"}` : `${nombre}: aún no la tienes`, i % 2 === 1);
      });
      if (est.tipo === "descanso") s += `<g class="co-zzz" transform="translate(${(sitios[0] || { x: 300 }).x + 30} ${(sitios[0] || { y: 300 }).y - 120})"><text x="0" y="0" class="co-z">z</text><text x="14" y="-16" class="co-z co-z2">Z</text><text x="30" y="-34" class="co-z co-z3">z</text></g>`;
    }
    capa.innerHTML = s;
  }

  function pintarEscena() {
    const c = corral(actual);
    if (!c) return;
    const est = C.estado(c), svg = $("coEscena");
    svg.dataset.habitat = c.habitat;
    svg.setAttribute("class", `co-escena co-${A.AMBIENTE[c.habitat]} co-entra`);
    svg.setAttribute("aria-label", `${c.nombre}: ${est.texto}`);
    svg.innerHTML = A.escena(c.habitat);
    colocar(c, est);
    if (window.Cielo) window.Cielo.aplicar();
    firmaEscena = `${actual}|${est.tipo}|${faseDe(c, est)}`;
  }

  /* ---------------------------------------------------------------- hábitats elegibles */
  function pintarTabs() {
    $("coFranja").innerHTML = ver().corrales.map(c => {
      const est = C.estado(c);
      return `<button type="button" class="co-tab hb-e-${est.tipo}${c.habitat === actual ? " co-elegido" : ""}" role="tab" aria-selected="${c.habitat === actual}" data-h="${esc(c.habitat)}" aria-label="${esc(c.nombre)}: ${esc(est.texto)}">
        <svg class="co-mini" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="crispEdges">${A.escena(c.habitat).replace(' id="coTinte"', "")}</svg>
        <i class="co-lampara"></i><b>${esc(c.nombre)}</b><small data-txt>${esc(est.texto)}</small>
        <span class="co-hilo" aria-hidden="true"><i style="width:${Math.round(est.prog * 100)}%"></i></span></button>`;
    }).join("");
    if (window.Cielo) window.Cielo.aplicar();
  }
  function refrescarTabs() {
    for (const c of ver().corrales) {
      const b = document.querySelector(`.co-tab[data-h="${c.habitat}"]`);
      if (!b) continue;
      const est = C.estado(c);
      b.className = `co-tab hb-e-${est.tipo}${c.habitat === actual ? " co-elegido" : ""}`;
      b.setAttribute("aria-label", `${c.nombre}: ${est.texto}`);
      b.querySelector("[data-txt]").textContent = est.texto;
      b.querySelector(".co-hilo > i").style.width = Math.round(est.prog * 100) + "%";
    }
  }

  /* ---------------------------------------------------------------- ficha del corral (fuera del dibujo) */
  function pintarBarra() {
    const c = corral(actual);
    if (!c) return;
    const est = C.estado(c);
    $("coBarra").innerHTML = `<div class="co-barra-id"><h2>${esc(c.nombre)}</h2><p>${esc(c.descripcion || "")}</p></div>
      <div class="co-barra-estado"><span class="hb-pildora ${ESTADOS[est.tipo][1]}" id="coPildora">${ESTADOS[est.tipo][0]}</span><b id="coReloj"></b><small id="coFase"></small></div>
      <div class="co-barra-prog" aria-hidden="true"><i id="coProg"></i></div>`;
    pintarTiempoBarra(c, est);
  }
  function pintarTiempoBarra(c, est) {
    const reloj = $("coReloj");
    if (!reloj) return;
    const p = ESTADOS[est.tipo];
    $("coPildora").className = `hb-pildora ${p[1]}`;
    $("coPildora").textContent = p[0];
    reloj.textContent = est.tipo === "cria" ? `faltan ${dur(est.fin - C.ahora())}` : est.tipo === "listo" ? "¡ya puedes recogerla!" : est.tipo === "descanso" ? est.texto.replace("Descansa ", "libre en ") : est.tipo === "disponible" ? "puedes criar ahora" : est.texto.toLowerCase();
    const f = faseDe(c, est);
    $("coFase").textContent = c.cria && f >= 0 && f < c.cria.fases.length ? `${nombreCarta(c.cria.carta_id)} · ${c.cria.fases[f].nombre}` : (c.cria ? nombreCarta(c.cria.carta_id) : "");
    $("coProg").style.width = Math.round(est.prog * 100) + "%";
    $("coProg").parentNode.className = `co-barra-prog hb-e-${est.tipo}`;
  }

  /* ---------------------------------------------------------------- panel: qué se puede hacer ahora */
  const token = id => `<img class="co-token" src="${sprite(id)}" alt="" width="64" height="64" loading="lazy" onerror="coFallo(this)">`;

  function pintarPanel() {
    const c = corral(actual);
    if (!c) return;
    const est = C.estado(c);
    let cuerpo = "";
    if (c.cria) {
      const cr = c.cria, listo = est.tipo === "listo";
      cuerpo = `<div class="co-pareja">${token(cr.carta_id)}<span class="co-mas">+</span>${token(cr.carta_id)}
          <div><b>${esc(nombreCarta(cr.carta_id))}</b><small>copias n.º ${esc(cr.numero_a)} y n.º ${esc(cr.numero_b)}, bloqueadas hasta que acabe</small></div></div>
        <ol class="co-fases" id="coFases">${cr.fases.map((f, i) => `<li data-fase="${i}"><span class="co-n">${i + 1}</span><div><b>${esc(f.nombre)}</b><small>${esc(horasTxt(f.horas))}</small><span class="co-tira"><i style="width:0%"></i></span></div></li>`).join("")}</ol>
        <div class="co-acciones">${listo
          ? `<button type="button" class="cartas-boton cartas-boton-principal" data-recoger="${esc(cr.id)}">Recoger la cría</button>`
          : `<button type="button" class="cartas-boton" data-sacar="${esc(cr.id)}">Sacar a la pareja (no nace nada)</button>`}</div>`;
    } else {
      // Solo se ofrecen las criaturas de las que tienes algún ejemplar libre. Las únicas (límite global menor que 2) no se pueden criar nunca, así que no salen
      const especies = ver().especies.filter(e => e.habitat === c.habitat && e.libres.length > 0 && !(e.limite != null && Number(e.limite) < 2));
      const libreCorral = est.tipo !== "descanso";
      cuerpo = (est.tipo === "descanso" ? `<p class="co-nota co-nota-descanso">El corral descansa después del último nacimiento: ${esc(est.texto.replace("Descansa ", "libre en "))}.</p>` : "")
        + (especies.length
          ? `<h3>¿A quién crías?</h3><p class="co-regla">Hacen falta dos copias libres de la misma criatura.</p><ul class="co-especies">${especies.map((e, i) => filaEspecie(e, i, libreCorral)).join("")}</ul>`
          : `<p class="co-nota">No tienes ninguna criatura que se críe en este corral.</p>`);
    }
    $("coPanel").innerHTML = `<p class="hb-msg" id="coMsg"></p>${cuerpo}`;
    refrescarTiempo();
  }

  function filaEspecie(e, i, libreCorral) {
    const carta = cartaDe(e.carta), n = e.libres.length;
    const [a, b, c2] = e.horas.map(Number), total = a + b + c2;
    const puede = n >= 2 && !e.sobrepoblada && e.en_circulacion && libreCorral;
    let nota = "";
    if (e.sobrepoblada) nota = `<p class="co-aviso-esp">Sobrepoblación de la especie: hay que respetar el medio ambiente.</p>`;
    else if (!e.en_circulacion) nota = `<p class="co-aviso-esp">Todavía no está en circulación.</p>`;
    else if (n < 2) nota = `<p class="co-falta">Te ${2 - n === 1 ? "falta 1 copia" : "faltan 2 copias"} para poder criarla.</p>`;
    const selectores = puede && n > 2
      ? `<label class="co-copias">Copias <select data-a="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 0 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select>
          <select data-b="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 1 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select></label>` : "";
    return `<li class="co-especie${puede ? "" : " co-no-puede"}${n ? "" : " co-sin"}" data-carta="${esc(e.carta)}">${token(e.carta)}
      <div class="co-esp-info"><b>${esc(carta ? carta.nombre : e.carta)}</b> <small>${esc(RAREZAS[carta && carta.rareza] || "")}</small>
        <p class="co-esp-datos"><span title="Copias libres">${n}/2 copias</span><span title="Duración de la cría">cría ${esc(horasTxt(total))}</span><span title="Descanso del corral después">descanso ${esc(horasTxt(Number(e.descanso_horas)))}</span></p>
        ${nota}${selectores}</div>
      ${puede ? `<button type="button" class="cartas-boton cartas-boton-principal" data-criar="${i}">Criar</button>` : ""}</li>`;
  }

  // Solo cambia lo que depende del tiempo (barras y texto), sin tocar los botones
  function refrescarTiempo() {
    if (!ver() || !actual) return;
    const c = corral(actual);
    if (!c || !c.cria || !$("coFases")) return;
    const est = C.estado(c), t = C.ahora();
    let desde = est.ini;
    c.cria.fases.forEach((f, i) => {
      const hasta = desde + f.horas * 3600000, li = document.querySelector(`#coFases li[data-fase="${i}"]`);
      if (li) {
        const frac = Math.max(0, Math.min(1, (t - desde) / (hasta - desde)));
        li.classList.toggle("co-hecha", t >= hasta);
        li.classList.toggle("co-ahora", t >= desde && t < hasta);
        li.querySelector(".co-tira > i").style.width = Math.round(frac * 100) + "%";
        li.querySelector(".co-n").textContent = t >= hasta ? "✓" : String(i + 1);
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
    dlg.querySelector(".cartas-boton-principal").addEventListener("click", () => dlg.close());
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

  /* ---------------------------------------------------------------- elegir, arrancar y reloj */
  function elegir(h, guardar) {
    if (!ver() || !corral(h)) return;
    actual = h;
    if (guardar !== false) { try { history.replaceState(null, "", "#" + h); } catch (e) { /* sin historial */ } }
    pintarTodo(true);
  }
  function primerCorral() {
    const cs = ver().corrales, por = t => cs.find(c => C.estado(c).tipo === t);
    return (por("listo") || por("cria") || por("disponible") || cs[0] || {}).habitat;
  }
  function pintarHistorial() {
    $("coHistorial").innerHTML = historial.length
      ? `<b>Últimas crías:</b> ${historial.map(h => `${h.estado === "nacida" ? "🐣" : "⚠"} ${esc(nombreCarta(h.carta_id))} <small>(${h.estado === "nacida" ? "nació" : "sin cupo"}, ${esc(new Date(h.cerrada).toLocaleDateString("es", { day: "numeric", month: "short" }))})</small>`).join(" · ")}`
      : `Todavía no ha nacido ninguna cría.`;
  }
  function pintarTodo(escenaNueva) {
    if (!actual || !corral(actual)) actual = primerCorral();
    const m = $("coMsg") ? $("coMsg").textContent : "", err = $("coMsg") && $("coMsg").classList.contains("hb-error");
    if (escenaNueva || !$("coEscena").firstChild) pintarEscena(); else { const c = corral(actual); colocar(c, C.estado(c)); firmaEscena = `${actual}|${C.estado(c).tipo}|${faseDe(c, C.estado(c))}`; }
    pintarTabs(); pintarBarra(); pintarPanel(); pintarHistorial();
    mensaje(m, err);
  }
  async function cargar() {
    await C.cargar();
    const r = await supa.from("cartas_crias").select("carta_id, estado, cerrada, habitat").in("estado", ["nacida", "sin_cupo"]).order("cerrada", { ascending: false }).limit(6);
    historial = r.data || [];
    pintarTodo(false);
  }
  const ultimoTipo = {};
  function reloj() {
    if (!ver()) return;
    const c = corral(actual);
    if (c) {
      const est = C.estado(c);
      pintarTiempoBarra(c, est);
      // Si la fase o el estado cambiaron (la cría pasó de huevo a cría, o ya está lista), se recolocan las criaturas sin reiniciar el escenario
      const firma = `${actual}|${est.tipo}|${faseDe(c, est)}`;
      if (firma !== firmaEscena) { colocar(c, est); firmaEscena = firma; pintarPanel(); }
    }
    refrescarTabs();
    refrescarTiempo();
    for (const x of ver().corrales) { const t = C.estado(x).tipo; if (ultimoTipo[x.habitat] && ultimoTipo[x.habitat] !== t && x.habitat === actual) { const m = $("coMsg") ? $("coMsg").textContent : ""; pintarPanel(); pintarBarra(); mensaje(m); } ultimoTipo[x.habitat] = t; }
  }

  async function iniciar() {
    $("coFranja").addEventListener("click", ev => { const b = ev.target.closest(".co-tab"); if (b) elegir(b.dataset.h); });
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
