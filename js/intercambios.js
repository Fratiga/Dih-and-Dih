/* Intercambios: tablón entre jugadores, tus trueques y el Buhonero (la forja tiene su propia página, forja.html, js/forja.js).
   Toda la lógica y los límites viven en el servidor (docs/economia-5_intercambios.sql); esta página escoge cartas y enseña lo que el servidor decide.
   Las cartas se ven como cartas de verdad (mini cartas que crecen al pasar el cursor y se abren grandes al pulsarlas), con lo que se pide a su lado.
   La escena y la voz del Buhonero están en js/puesto-buhonero.js. docs/economia-de-cartas.md, secciones 8 y 11. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const BA = window.BatallaApuestas;
  const PB = window.PuestoBuhonero;
  const SIN_TRATO = new Set(["legendaria", "limitada"]);

  let supa = null, miId = null, esAdmin = false;
  let intercambios = [], mercader = null, jugadores = [];
  let ofrezco = null;            // { ids, copias }
  let pido = [];                 // [{ carta, n, nombre }]
  let tengo = new Map();         // carta -> copias libres que tengo (para marcar las ofertas que puedo aceptar)
  const idPorNombre = new Map();

  function estado(t, error) {
    const e = $("icEstado");
    e.textContent = t || "";
    e.classList.toggle("ic-error", !!error);
    clearTimeout(estado.t);
    if (t && !error) estado.t = setTimeout(() => { e.textContent = ""; }, 5000);
  }

  async function rpc(nombre, args) {
    const { data, error } = await supa.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }
  const nombreCarta = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };
  // un giro pequeño y fijo para cada nota, sacado de su id, para que el tablón parezca puesto a mano
  const giro = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 41) - 20) / 10; };

  /* ------------------------------------------------------------------ cartas que se ven */
  /* Una carta pequeña de verdad (js/cartas-mini.js). info = { carta, nombre, rareza, numero?, n? }. Pulsarla la abre grande */
  const miniCarta = (info, extra) => window.CartasMini.html(info, extra);
  const abanico = (lista, extra) => `<span class="pu-abanico-in">${(lista || []).map(c => miniCarta(c, extra)).join("")}</span>`;


  /* ------------------------------------------------------------------ datos */
  async function cargarIntercambios() {
    const { data, error } = await supa.from("cartas_intercambios").select("*").order("creada", { ascending: false }).limit(80);
    if (error) throw error;
    intercambios = data || [];
  }
  async function cargarMias() {
    try {
      const copias = await BA.copiasLibres();
      tengo = new Map();
      copias.forEach(c => tengo.set(c.carta, (tengo.get(c.carta) || 0) + 1));
    } catch (e) { tengo = new Map(); }
  }
  async function cargarTodo() {
    try {
      await rpc("cartas_refrescar").catch(() => {});
      await Promise.all([cargarIntercambios(), cargarMias()]);
      pintarTablon(); pintarMios();
    } catch (e) { estado(`No se pudieron cargar los intercambios: ${e.message || e}. ¿Corriste economia_5_intercambios.sql?`, true); }
  }
  async function cargarMercader(primera) {
    try {
      mercader = await rpc("cartas_mercader_ver"); pintarMercader(primera);
      // Lo que ya viste hoy del Buhonero: la taberna (js/avisos-taberna.js) solo avisa de lo que no
      try { localStorage.setItem("lbBuhoneroVisto", JSON.stringify({ dia: new Date().toISOString().slice(0, 10), ids: (mercader.ofertas || []).map(o => o.id) })); } catch (e) { /* sin almacenamiento */ }
    }
    catch (e) { $("icMercaderLista").innerHTML = `<li class="ic-vacio">${esc(e.message || e)}</li>`; }
  }

  /* ---------------------------------------------------------------- resultado */
  function mostrarCarta(titulo, cartaId, texto) {
    const c = window.cartaPorId(cartaId);
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado pu-trato";
    dlg.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="ic-carta">${c ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
      <p><b>${esc(c ? c.nombre : cartaId)}</b><br><small>${esc(texto || "")}</small></p>
      <button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".cartas-boton-principal").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  /* ------------------------------------------------------------------ tablón */
  const sePuede = i => (i.pide_info || []).every(p => (tengo.get(p.carta) || 0) >= (p.n || 1));
  const caduca = i => { const d = Math.ceil((new Date(i.caduca) - Date.now()) / 86400000); return d <= 1 ? "caduca hoy" : `caduca en ${d} días`; };

  /* Una nota clavada: lo que ofrece a un lado, lo que pide al otro. modo: "aceptar", "propia" o "leer" */
  function nota(i, modo) {
    const posible = modo === "aceptar" && sePuede(i);
    const quien = modo === "propia" ? "Tu oferta" : esc(i.nombre_de);
    const destino = modo === "propia" ? (i.para ? `· para ${esc(i.nombre_para)}` : "· tablón abierto") : (i.para === miId ? `<i class="ba-sello">para ti</i>` : "");
    const boton = modo === "aceptar" ? `<button type="button" class="cartas-boton cartas-boton-principal" data-aceptar="${i.id}">Aceptar</button>`
      : modo === "propia" ? `<button type="button" class="cartas-boton" data-cancelar="${i.id}">Retirar la nota</button>` : "";
    return `<li class="pu-nota${posible ? " pu-posible" : ""}" style="--giro:${giro(i.id)}deg">
      <span class="pu-chincheta" aria-hidden="true"></span>
      <header><b>${quien}</b> ${destino}${posible ? `<em class="pu-tienes">lo tienes</em>` : ""}</header>
      <div class="pu-trato-fila">
        <div class="pu-lado-nota"><small>ofrece</small>${abanico(i.ofrece_info)}</div>
        <div class="pu-flecha" aria-hidden="true">⇄</div>
        <div class="pu-lado-nota"><small>pide</small>${abanico(i.pide_info, "pu-pedida")}</div>
      </div>
      ${i.nota ? `<p class="pu-escrito">«${esc(i.nota)}»</p>` : ""}
      <footer><span class="pu-caduca">${caduca(i)}</span>${boton}</footer></li>`;
  }

  function pintarTablon() {
    const soloPosibles = $("icSoloPosibles").checked;
    let lista = intercambios.filter(i => i.estado === "abierta" && i.de !== miId && (!i.para || i.para === miId));
    const total = lista.length;
    if (soloPosibles) lista = lista.filter(sePuede);
    $("icLista").innerHTML = lista.length ? lista.map(i => nota(i, "aceptar")).join("")
      : `<li class="ic-vacio pu-vacio">${total && soloPosibles ? "Ninguna de las ofertas pide solo cartas que tengas libres ahora mismo." : "Nadie ofrece nada ahora mismo. El corcho espera tu nota."}</li>`;
  }

  function pintarMios() {
    const paraMi = intercambios.filter(i => i.estado === "abierta" && i.para === miId);
    const mias = intercambios.filter(i => i.estado === "abierta" && i.de === miId);
    const hist = intercambios.filter(i => i.estado !== "abierta" && (i.de === miId || i.aceptada_por === miId)).slice(0, 12);
    $("icMiosN").textContent = paraMi.length ? String(paraMi.length) : "";
    $("icParaMi").innerHTML = paraMi.length ? paraMi.map(i => nota(i, "aceptar")).join("") : `<li class="ic-vacio pu-vacio">Nadie te ha ofrecido nada.</li>`;
    $("icMiasAbiertas").innerHTML = mias.length ? mias.map(i => nota(i, "propia")).join("") : `<li class="ic-vacio pu-vacio">No tienes ofertas abiertas.</li>`;
    $("icHistorial").innerHTML = hist.length ? hist.map(i => {
      const cuando = i.cerrada ? new Date(i.cerrada).toLocaleDateString("es", { day: "numeric", month: "short" }) : "";
      if (i.estado === "aceptada") {
        const yoOfrecia = i.de === miId, con = yoOfrecia ? i.nombre_acepta : i.nombre_de;
        const di = yoOfrecia ? i.ofrece_info : i.entregado_info, recibo = yoOfrecia ? i.entregado_info : i.ofrece_info;
        return `<li class="pu-asiento pu-hecho"><span class="pu-fecha">${esc(cuando)}</span><div class="pu-asiento-in"><span><small>diste</small>${abanico(di, "pu-diminuta")}</span><i aria-hidden="true">→</i><span><small>recibiste</small>${abanico(recibo, "pu-diminuta")}</span></div><span class="pu-con">con ${esc(con || "alguien")}</span></li>`;
      }
      return `<li class="pu-asiento pu-roto"><span class="pu-fecha">${esc(cuando)}</span><div class="pu-asiento-in"><span><small>${i.estado === "caducada" ? "caducó" : "retirada"}</small>${abanico(i.ofrece_info, "pu-diminuta")}</span><i aria-hidden="true">✕</i><span><small>pedía</small>${abanico(i.pide_info, "pu-diminuta")}</span></div></li>`;
    }).join("") : `<li class="ic-vacio pu-vacio">Todavía no hay nada anotado.</li>`;
  }

  async function aceptar(id) {
    const it = intercambios.find(i => i.id === id);
    if (!it) return;
    const total = it.pide.reduce((s, p) => s + p.n, 0);
    const r = await BA.elegir({
      titulo: "Entrega lo que se pide", max: total,
      ayuda: `${it.nombre_de} pide: ${it.pide_info.map(p => `${p.nombre} ×${p.n}`).join(", ")}. Entregas exactamente eso y recibes ${it.ofrece_info.map(c => c.nombre).join(", ")}.`,
      filtro: c => it.pide.some(p => p.carta === c.carta),
      validar: sel => {
        const falta = it.pide.filter(p => sel.filter(c => c.carta === p.carta).length !== p.n);
        return { ok: !falta.length && sel.length === total, texto: `Elegidas ${sel.length} de ${total}${falta.length ? ` · falta ajustar: ${falta.map(p => p.nombre).join(", ")}` : ""}` };
      }
    });
    if (!r) return;
    if (r.error) { estado(r.error, true); return; }
    try {
      await rpc("cartas_aceptar_trueque", { p_id: id, p_ejemplares: r.ids });
      estado("Intercambio hecho.");
      await cargarTodo();
    } catch (e) { estado(e.message || String(e), true); }
  }

  async function cancelar(id) {
    try { await rpc("cartas_cancelar_trueque", { p_id: id }); estado("Oferta retirada: tus cartas vuelven a estar libres."); await cargarTodo(); }
    catch (e) { estado(e.message || String(e), true); }
  }

  /* El formulario enseña lo que ofreces y lo que pides como cartas */
  function pintarOfrezco() {
    $("icOfrezcoCartas").innerHTML = ofrezco && ofrezco.copias.length ? abanico(ofrezco.copias.map(c => ({ carta: c.carta, nombre: c.nombre, rareza: c.rareza, numero: c.numero })))
      : `<span class="ic-vacio">Todavía no has puesto ninguna carta.</span>`;
  }
  function pintarPido() {
    $("icPidoLista").innerHTML = pido.length ? `<span class="pu-abanico-in">${pido.map((p, i) => `<span class="pu-con-quitar">${miniCarta({ carta: p.carta, nombre: p.nombre, rareza: (window.cartaPorId(p.carta) || {}).rareza, n: p.n }, "pu-pedida")}<button type="button" class="pu-quitar" data-quitar-pido="${i}" aria-label="Quitar ${esc(p.nombre)}">×</button></span>`).join("")}</span>`
      : `<span class="ic-vacio">Todavía no has pedido nada.</span>`;
  }

  async function publicar() {
    if (!ofrezco) { estado("Elige primero las cartas que ofreces.", true); return; }
    if (!pido.length) { estado("Añade al menos una carta que pides.", true); return; }
    try {
      await rpc("cartas_ofrecer", { p_para: $("icPara").value || null, p_ofrece: ofrezco.ids, p_pide: pido.map(p => ({ carta: p.carta, n: p.n })), p_nota: $("icNota").value.trim() });
      estado("Oferta clavada en el tablón. Tus cartas quedan bloqueadas hasta que se resuelva.");
      ofrezco = null; pido = []; $("icNota").value = "";
      pintarOfrezco(); pintarPido();
      $("icNueva").open = false;
      await cargarTodo();
    } catch (e) { estado(e.message || String(e), true); }
  }

  /* ----------------------------------------------------------------- mercader */
  /* Una combinación sencilla de cartas que suma el valor mínimo, para que se vea de un vistazo qué hay que llevarle */
  function ejemploPrecio(v) {
    const raras = Math.floor(v / 3), resto = v - raras * 3, poco = Math.floor(resto / 2), com = resto - poco * 2;
    const partes = [];
    if (raras) partes.push(`${raras} rara${raras > 1 ? "s" : ""}`);
    if (poco) partes.push(`${poco} poco común${poco > 1 ? "es" : ""}`);
    if (com) partes.push(`${com} común${com > 1 ? "es" : ""}`);
    return partes.join(" + ");
  }

  function pintarMercader(primera) {
    if (!mercader) return;
    const hoy = mercader.hoy, tope = mercader.tope, agotado = hoy >= tope;
    PB.velas(hoy, tope);
    $("icMercaderLista").innerHTML = mercader.ofertas.length ? mercader.ofertas.map(o => `
      <li class="pu-puesto${o.especial ? " pu-especial" : ""} pu-r-${esc(o.rareza)}" data-rareza="${esc(o.rareza)}" data-especial="${o.especial ? 1 : 0}">
        <div class="pu-exhibe">${miniCarta({ carta: o.carta, nombre: o.nombre, rareza: o.rareza, numero: o.numero }, "pu-expuesta")}${o.especial ? `<i class="pu-destello" aria-hidden="true"></i>` : ""}</div>
        <div class="pu-etiqueta">
          <span class="pu-hilo" aria-hidden="true"></span>
          <b class="pu-nombre">${esc(o.nombre)}</b>
          <small>${esc(BA.nombreRareza(o.rareza))} · copia ${o.numero}${o.especial ? ' · <i class="ba-sello">especial</i>' : ""}</small>
          <div class="pu-precio" aria-label="Precio: valor de ${o.valor_min} a ${o.valor_min + 2}"><span class="pu-ficha pu-moneda">${o.valor_min}</span><span class="pu-hasta">a</span><span class="pu-ficha pu-moneda">${o.valor_min + 2}</span><small>de valor</small></div>
          <small class="pu-ejemplo">por ejemplo ${esc(ejemploPrecio(o.valor_min))}</small>
          <button type="button" class="cartas-boton cartas-boton-principal" data-cambiar="${o.id}"${agotado ? " disabled" : ""}>Cambiar</button>
          ${esAdmin ? `<button type="button" class="cartas-boton" data-quitar-oferta="${o.id}">Quitar</button>` : ""}
        </div></li>`).join("")
      : `<li class="ic-vacio pu-vacio">La mesa está vacía. Su inventario sale de la reserva común, que llenan los cambios con el Buhonero y las ventas del Hipódromo.</li>`;
    $("icMercaderAdmin").classList.toggle("hidden", !esAdmin);
    if (primera) PB.decir(!mercader.ofertas.length ? "vacio" : agotado ? "agotado" : "saludo");
  }

  async function cambiarConMercader(id) {
    const o = mercader.ofertas.find(x => x.id === id);
    if (!o) return;
    PB.decir("tarda");
    const r = await BA.elegir({
      titulo: `Cambiar por ${o.nombre}`, max: 5,
      ayuda: `Entrega cartas que sumen de ${o.valor_min} a ${o.valor_min + 2} de valor (común 1, poco común 2, rara 3). No acepta legendarias ni limitadas ni otra copia de ${o.nombre}.`,
      filtro: c => !SIN_TRATO.has(c.rareza) && c.carta !== o.carta,
      validar: sel => {
        const suma = sel.reduce((s, c) => s + BA.categoria(c.rareza), 0);
        return { ok: sel.length > 0 && suma >= o.valor_min && suma <= o.valor_min + 2, texto: `Suman ${suma} de valor · hace falta de ${o.valor_min} a ${o.valor_min + 2}` };
      }
    });
    if (!r) return;
    if (r.error) { estado(r.error, true); PB.decir("error"); return; }
    try {
      const res = await rpc("cartas_mercader_comprar", { p_oferta: id, p_ejemplares: r.ids });
      PB.decir("exito");
      mostrarCarta("¡Trato hecho!", res.carta, `Copia ${res.numero}`);
      await cargarMercader();
    } catch (e) { estado(e.message || String(e), true); PB.decir("error"); }
  }

  /* ------------------------------------------------------------------ eventos */
  function resolverCarta(texto) {
    const t = String(texto || "").trim().toLowerCase();
    if (!t) return null;
    if (idPorNombre.has(t)) return idPorNombre.get(t);
    const parecidas = [...idPorNombre.entries()].filter(([n]) => n.includes(t));
    return parecidas.length === 1 ? parecidas[0][1] : null;
  }

  function enlazar() {
    $("icPestanas").addEventListener("click", ev => {
      const b = ev.target.closest("[data-vista]");
      if (!b) return;
      document.querySelectorAll("#icPestanas button").forEach(x => x.classList.toggle("activa", x === b));
      ["tablon", "mios", "mercader"].forEach(v => $("ic" + v[0].toUpperCase() + v.slice(1)).classList.toggle("hidden", v !== b.dataset.vista));
      if (b.dataset.vista === "mercader") cargarMercader(true);
      if (b.dataset.vista === "mios" || b.dataset.vista === "tablon") cargarTodo();
    });
    $("icSoloPosibles").addEventListener("change", pintarTablon);
    document.querySelector("main").addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.aceptar) aceptar(b.dataset.aceptar);
      else if (b.dataset.cancelar) cancelar(b.dataset.cancelar);
      else if (b.dataset.cambiar) cambiarConMercader(b.dataset.cambiar);
      else if (b.dataset.ver) window.CartasMini.abrir(b.dataset.ver, b.dataset.numero);
      else if (b.dataset.quitarPido !== undefined) { pido.splice(Number(b.dataset.quitarPido), 1); pintarPido(); }
      else if (b.dataset.quitarOferta) rpc("cartas_admin_mercader_quitar", { p_oferta: b.dataset.quitarOferta }).then(cargarMercader).catch(e => estado(e.message || String(e), true));
    });
    // el Buhonero comenta lo que miras en su mesa
    $("icMercaderLista").addEventListener("mouseover", ev => {
      const p = ev.target.closest(".pu-puesto");
      if (!p || p === enlazar.ultimo) return;
      enlazar.ultimo = p;
      PB.decir(p.dataset.especial === "1" ? "especial" : p.dataset.rareza in PB.FRASES ? p.dataset.rareza : "comun");
    });
    $("icOfrezcoElegir").addEventListener("click", async () => {
      const r = await BA.elegir({ titulo: "Cartas que ofreces", max: 5, ayuda: "Elige de 1 a 5 cartas. Quedan bloqueadas hasta que alguien acepte, lo canceles o pasen 7 días." });
      if (!r) return;
      if (r.error) { estado(r.error, true); return; }
      ofrezco = r;
      pintarOfrezco();
    });
    $("icPidoAnadir").addEventListener("click", () => {
      const id = resolverCarta($("icPidoCarta").value);
      const n = Math.max(1, Math.min(5, Math.round(Number($("icPidoN").value) || 1)));
      if (!id) { estado("No encuentro esa carta. Elige una de la lista.", true); return; }
      if (pido.some(p => p.carta === id)) { estado("Esa carta ya está en lo que pides. Para cambiar la cantidad, quítala y añádela otra vez.", true); return; }
      if (pido.reduce((s, p) => s + p.n, 0) + n > 5) { estado("Se pueden pedir como mucho 5 cartas.", true); return; }
      pido.push({ carta: id, n, nombre: nombreCarta(id) });
      $("icPidoCarta").value = ""; $("icPidoN").value = "1";
      pintarPido();
    });
    $("icPublicar").addEventListener("click", publicar);
    $("icAdmAnadir").addEventListener("click", async () => {
      const id = resolverCarta($("icAdmCarta").value);
      if (!id) { estado("No encuentro esa carta.", true); return; }
      try { await rpc("cartas_admin_mercader_agregar", { p_carta: id, p_valor_min: Math.round(Number($("icAdmValor").value) || 4) }); estado("Oferta añadida."); $("icAdmCarta").value = ""; await cargarMercader(); }
      catch (e) { estado(e.message || String(e), true); }
    });
  }

  /* ------------------------------------------------------------------- inicio */
  async function iniciar() {
    PB.montar($("icEscena"));
    PB.velas(0, 3);
    enlazar();
    pintarOfrezco(); pintarPido();
    const aviso = $("icAviso");
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) {
      aviso.textContent = "Inicia sesión para intercambiar cartas.";
      aviso.classList.remove("hidden");
      document.querySelector(".ic-pestanas").classList.add("hidden");
      document.querySelectorAll(".ic-vista").forEach(v => v.classList.add("hidden"));
      return;
    }
    miId = sesion.user.id;
    supa = await fichasCliente();
    const rol = await CartasCliente.verificarRol();
    esAdmin = !!rol.admin;
    await CartasCliente.cargarDefiniciones(rol.puede);
    window.CARTAS.filter(c => !c.borrador).forEach(c => idPorNombre.set(c.nombre.toLowerCase(), c.id));
    $("icCartas").innerHTML = window.CARTAS.filter(c => !c.borrador).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(c => `<option value="${esc(c.nombre)}"></option>`).join("");
    try { jugadores = await rpc("cartas_jugadores"); } catch (e) { jugadores = []; }
    $("icPara").innerHTML = `<option value="">Cualquiera (tablón abierto)</option>` + jugadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.username)}</option>`).join("");
    await cargarTodo();
    if (location.hash === "#buhonero") { const t = document.querySelector('#icPestanas [data-vista="mercader"]'); if (t) t.click(); }
    setInterval(() => { if (!document.hidden && !document.querySelector("dialog[open]")) cargarTodo(); }, 20000);
  }
  iniciar();
})();
