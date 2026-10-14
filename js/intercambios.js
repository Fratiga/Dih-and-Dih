/* Intercambios de Triunfos: tablón entre jugadores, mercader y forja.
   Toda la lógica y los límites viven en el servidor (scratchpad/economia_5_intercambios.sql y economia_6_forja.sql);
   esta página escoge cartas y enseña lo que el servidor decide. docs/economia-de-cartas.md, secciones 8 y 11. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const BA = window.BatallaApuestas;
  const SIN_TRATO = new Set(["legendaria", "limitada"]);
  const TIPOS_FORJA = new Set(["Objeto", "Reacción", "Terreno", "Acción"]);   // la forja solo acepta cartas que no están vivas (el servidor lo vuelve a comprobar)

  let supa = null, miId = null, esAdmin = false;
  let intercambios = [], mercader = null, forja = null, jugadores = [];
  let ofrezco = null;            // { ids, copias }
  let pido = [];                 // [{ carta, n, nombre }]
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

  /* ------------------------------------------------------------------ datos */
  async function cargarIntercambios() {
    const { data, error } = await supa.from("cartas_intercambios").select("*").order("creada", { ascending: false }).limit(80);
    if (error) throw error;
    intercambios = data || [];
  }
  async function cargarTodo() {
    try {
      await rpc("cartas_refrescar").catch(() => {});
      await cargarIntercambios();
      pintarTablon(); pintarMios();
    } catch (e) { estado(`No se pudieron cargar los intercambios: ${e.message || e}. ¿Corriste economia_5_intercambios.sql?`, true); }
  }
  async function cargarMercader() {
    try { mercader = await rpc("cartas_mercader_ver"); pintarMercader(); }
    catch (e) { $("icMercaderLista").innerHTML = `<li class="ic-vacio">${esc(e.message || e)}</li>`; }
  }
  async function cargarForja() {
    try { forja = await rpc("cartas_forja_ver"); pintarForja(); }
    catch (e) { $("icForjaLista").innerHTML = `<li class="ic-vacio">${esc(e.message || e)}</li>`; }
  }

  /* ---------------------------------------------------------------- resultado */
  function mostrarCarta(titulo, cartaId, texto) {
    const c = window.cartaPorId(cartaId);
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado";
    dlg.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="ic-carta">${c ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
      <p><b>${esc(c ? c.nombre : cartaId)}</b>${texto ? `<br><small>${esc(texto)}</small>` : ""}</p>
      <button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector("button").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  /* ------------------------------------------------------------------ tablón */
  function lineaOferta(it) {
    return `<b>${esc(it.nombre_de)}</b> ofrece <b>${BA.texto(it.ofrece_info)}</b> y pide <b>${BA.texto(it.pide_info)}</b>`;
  }

  function pintarTablon() {
    const lista = intercambios.filter(i => i.estado === "abierta" && i.de !== miId && (!i.para || i.para === miId));
    $("icLista").innerHTML = lista.length ? lista.map(i => `
      <li><div>${lineaOferta(i)}${i.para === miId ? ' <i class="ba-sello">para ti</i>' : ""}
        ${i.nota ? `<span class="ba-linea">«${esc(i.nota)}»</span>` : ""}
        <span class="ba-linea">Caduca el ${new Date(i.caduca).toLocaleDateString("es")}</span></div>
        <button type="button" class="cartas-boton cartas-boton-principal" data-aceptar="${i.id}">Aceptar</button></li>`).join("")
      : `<li class="ic-vacio">Nadie ofrece nada ahora mismo.</li>`;
  }

  function pintarMios() {
    const paraMi = intercambios.filter(i => i.estado === "abierta" && i.para === miId);
    const mias = intercambios.filter(i => i.estado === "abierta" && i.de === miId);
    const hist = intercambios.filter(i => i.estado !== "abierta" && (i.de === miId || i.aceptada_por === miId)).slice(0, 10);
    $("icMiosN").textContent = paraMi.length ? String(paraMi.length) : "";
    $("icParaMi").innerHTML = paraMi.length ? paraMi.map(i => `
      <li><div>${lineaOferta(i)}${i.nota ? `<span class="ba-linea">«${esc(i.nota)}»</span>` : ""}</div>
        <button type="button" class="cartas-boton cartas-boton-principal" data-aceptar="${i.id}">Aceptar</button></li>`).join("")
      : `<li class="ic-vacio">Nadie te ha ofrecido nada.</li>`;
    $("icMiasAbiertas").innerHTML = mias.length ? mias.map(i => `
      <li><div>Ofreces <b>${BA.texto(i.ofrece_info)}</b> y pides <b>${BA.texto(i.pide_info)}</b>${i.para ? ` · para ${esc(i.nombre_para)}` : " · tablón abierto"}</div>
        <button type="button" class="cartas-boton" data-cancelar="${i.id}">Cancelar</button></li>`).join("")
      : `<li class="ic-vacio">No tienes ofertas abiertas.</li>`;
    $("icHistorial").innerHTML = hist.length ? hist.map(i => {
      if (i.estado === "aceptada") {
        const yoOfrecia = i.de === miId;
        return `<li><div>${yoOfrecia ? `Diste <b>${BA.texto(i.ofrece_info)}</b> y recibiste <b>${BA.texto(i.entregado_info)}</b> de ${esc(i.nombre_acepta || "")}`
          : `Diste <b>${BA.texto(i.entregado_info)}</b> y recibiste <b>${BA.texto(i.ofrece_info)}</b> de ${esc(i.nombre_de)}`}</div></li>`;
      }
      return `<li><div>${i.estado === "caducada" ? "Caducó" : "Cancelada"}: <b>${BA.texto(i.ofrece_info)}</b> por <b>${BA.texto(i.pide_info)}</b></div></li>`;
    }).join("") : `<li class="ic-vacio">Todavía no hay historial.</li>`;
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
    try { await rpc("cartas_cancelar_trueque", { p_id: id }); estado("Oferta cancelada: tus cartas vuelven a estar libres."); await cargarTodo(); }
    catch (e) { estado(e.message || String(e), true); }
  }

  function pintarPido() {
    $("icPidoLista").innerHTML = pido.length ? pido.map((p, i) => `<span class="ic-chip">${esc(p.nombre)} ×${p.n}<button type="button" data-quitar-pido="${i}" aria-label="Quitar">×</button></span>`).join("")
      : `<span class="ic-vacio">Nada todavía</span>`;
  }

  async function publicar() {
    if (!ofrezco) { estado("Elige primero las cartas que ofreces.", true); return; }
    if (!pido.length) { estado("Añade al menos una carta que pides.", true); return; }
    try {
      await rpc("cartas_ofrecer", { p_para: $("icPara").value || null, p_ofrece: ofrezco.ids, p_pide: pido.map(p => ({ carta: p.carta, n: p.n })), p_nota: $("icNota").value.trim() });
      estado("Oferta publicada. Tus cartas quedan bloqueadas hasta que se resuelva.");
      ofrezco = null; pido = []; $("icNota").value = "";
      $("icOfrezcoTexto").textContent = "nada todavía";
      pintarPido();
      $("icNueva").open = false;
      await cargarTodo();
    } catch (e) { estado(e.message || String(e), true); }
  }

  /* ----------------------------------------------------------------- mercader */
  function pintarMercader() {
    if (!mercader) return;
    $("icMercaderHoy").textContent = `Cambios de hoy: ${mercader.hoy} de ${mercader.tope}.`;
    $("icMercaderLista").innerHTML = mercader.ofertas.length ? mercader.ofertas.map(o => `
      <li><div><b>${esc(o.nombre)}</b> <small>${esc(BA.nombreRareza(o.rareza))} · copia ${o.numero}</small>${o.especial ? ' <i class="ba-sello">especial</i>' : ""}
        <span class="ba-linea">Pide cartas que sumen de ${o.valor_min} a ${o.valor_min + 2} de valor.</span></div>
        <button type="button" class="cartas-boton cartas-boton-principal" data-cambiar="${o.id}">Cambiar</button>
        ${esAdmin ? `<button type="button" class="cartas-boton" data-quitar-oferta="${o.id}">Quitar</button>` : ""}</li>`).join("")
      : `<li class="ic-vacio">El mercader no tiene nada hoy. Vuelve mañana: su inventario sale de lo que otros jugadores le han cambiado.</li>`;
    $("icMercaderAdmin").classList.toggle("hidden", !esAdmin);
  }

  async function cambiarConMercader(id) {
    const o = mercader.ofertas.find(x => x.id === id);
    if (!o) return;
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
    if (r.error) { estado(r.error, true); return; }
    try {
      const res = await rpc("cartas_mercader_comprar", { p_oferta: id, p_ejemplares: r.ids });
      mostrarCarta("¡Trato hecho!", res.carta, `Copia ${res.numero}`);
      await cargarMercader();
    } catch (e) { estado(e.message || String(e), true); }
  }

  /* -------------------------------------------------------------------- forja */
  const PLURAL = { comun: ["común", "comunes"], infrecuente: ["poco común", "poco comunes"], rara: ["rara", "raras"] };
  const rarezaN = (r, n) => (PLURAL[r] || [r, r])[n === 1 ? 0 : 1];
  function pintarForja() {
    if (!forja) return;
    $("icForjaHoy").textContent = `Forjas de hoy: ${forja.hoy} de ${forja.tope}.`;
    $("icForjaLista").innerHTML = forja.recetas.map(r => `
      <li><div><b>${esc(r.nombre)}</b>
        <span class="ba-linea">${esc(r.descripcion)}</span>
        <span class="ba-linea">Entregas: ${r.entrada.map(g => `${g.n} ${rarezaN(g.rareza, g.n)}`).join(" + ")} · Recibes: 1 carta ${rarezaN(r.salida.rareza, 1)} · Éxito: ${Math.round(r.exito * 100)} %${r.exito < 1 ? ` · Si falla: ${r.al_fallar === "devolver_una" ? "te devuelven una carta" : "lo pierdes todo"}` : ""}</span></div>
        <button type="button" class="cartas-boton cartas-boton-principal" data-forjar="${esc(r.id)}">Forjar</button></li>`).join("")
      || `<li class="ic-vacio">No hay recetas.</li>`;
  }

  async function forjar(id) {
    const r = forja.recetas.find(x => x.id === id);
    if (!r) return;
    const necesarias = {};
    r.entrada.forEach(g => { necesarias[g.rareza] = (necesarias[g.rareza] || 0) + g.n; });
    const total = Object.values(necesarias).reduce((s, n) => s + n, 0);
    const res = await BA.elegir({
      titulo: `Forja: ${r.nombre}`, max: total,
      ayuda: `Entregas ${r.entrada.map(g => `${g.n} ${rarezaN(g.rareza, g.n)}`).join(" + ")}. Se destruyen para siempre; recibes una carta ${rarezaN(r.salida.rareza, 1)} (${Math.round(r.exito * 100)} % de éxito).`,
      filtro: c => necesarias[c.rareza] > 0 && TIPOS_FORJA.has(c.tipo),
      validar: sel => {
        const mal = Object.entries(necesarias).filter(([ra, n]) => sel.filter(c => c.rareza === ra).length !== n);
        return { ok: !mal.length && sel.length === total, texto: `Elegidas ${sel.length} de ${total}` };
      }
    });
    if (!res) return;
    if (res.error) { estado(res.error, true); return; }
    if (!(await dialogo.confirmar(`Vas a entregar ${total} cartas, que se destruyen para siempre. ¿Forjar?`, { titulo: "Forja", aceptar: "Forjar", peligro: true }))) return;
    try {
      const out = await rpc("cartas_forjar", { p_receta: id, p_ejemplares: res.ids });
      if (out.resultado === "carta") mostrarCarta("¡La forja funcionó!", out.carta, `Copia ${out.numero}`);
      else if (out.resultado === "fallo") estado(out.devuelta ? "La forja falló. Te devolvieron una de las cartas." : "La forja falló y las cartas se perdieron.", true);
      else estado(out.mensaje || "No hay carta disponible ahora mismo. No se consumió nada.", true);
      await cargarForja();
    } catch (e) { estado(e.message || String(e), true); }
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
      ["tablon", "mios", "mercader", "forja"].forEach(v => $("ic" + v[0].toUpperCase() + v.slice(1)).classList.toggle("hidden", v !== b.dataset.vista));
      if (b.dataset.vista === "mercader") cargarMercader();
      if (b.dataset.vista === "forja") cargarForja();
      if (b.dataset.vista === "mios" || b.dataset.vista === "tablon") cargarTodo();
    });
    document.querySelector("main").addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.aceptar) aceptar(b.dataset.aceptar);
      else if (b.dataset.cancelar) cancelar(b.dataset.cancelar);
      else if (b.dataset.cambiar) cambiarConMercader(b.dataset.cambiar);
      else if (b.dataset.forjar) forjar(b.dataset.forjar);
      else if (b.dataset.quitarPido !== undefined) { pido.splice(Number(b.dataset.quitarPido), 1); pintarPido(); }
      else if (b.dataset.quitarOferta) rpc("cartas_admin_mercader_quitar", { p_oferta: b.dataset.quitarOferta }).then(cargarMercader).catch(e => estado(e.message || String(e), true));
    });
    $("icOfrezcoElegir").addEventListener("click", async () => {
      const r = await BA.elegir({ titulo: "Cartas que ofreces", max: 5, ayuda: "Elige de 1 a 5 cartas. Quedan bloqueadas hasta que alguien acepte, lo canceles o pasen 7 días." });
      if (!r) return;
      if (r.error) { estado(r.error, true); return; }
      ofrezco = r;
      $("icOfrezcoTexto").textContent = r.copias.map(c => c.nombre).join(", ");
    });
    $("icPidoAnadir").addEventListener("click", () => {
      const id = resolverCarta($("icPidoCarta").value);
      const n = Math.max(1, Math.min(5, Math.round(Number($("icPidoN").value) || 1)));
      if (!id) { estado("No encuentro esa carta. Elige una de la lista.", true); return; }
      if (pido.some(p => p.carta === id)) { estado("Esa carta ya está en lo que pides: cambia su cantidad quitándola y añadiéndola otra vez.", true); return; }
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
    enlazar();
    pintarPido();
    const aviso = $("icAviso");
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) { aviso.textContent = "Inicia sesión para intercambiar cartas."; aviso.classList.remove("hidden"); document.querySelector(".ic-pestanas").classList.add("hidden"); document.querySelectorAll(".ic-vista").forEach(v => v.classList.add("hidden")); return; }
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
    setInterval(() => { if (!document.hidden && !document.querySelector("dialog[open]")) cargarTodo(); }, 20000);
  }
  iniciar();
})();
