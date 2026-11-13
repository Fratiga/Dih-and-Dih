/* =============================================================================
   TABLERO — panel «Tiradas»: el plugin de Roll20 (roll20/compendio-roll20.user.js) dentro del tablero.
   - Mi personaje: las tiradas que la ficha del compendio genera (columna roll20 de fichas_personajes), con
     favoritas, categorías, búsqueda, modo normal / ventaja / desventaja, revisión antes de lanzar y munición.
   - Enemigos (solo el DJ): las acciones y tiradas de las estadísticas del compendio (data/stats.js), con los de
     la página actual primero. El DJ puede mandarlas en susurro.
   Todo pasa por el chat del tablero, así que las tiradas se hacen en el servidor como cualquier otra.
============================================================================= */
(function () {
  const { esc, el, aviso, mensajeError, modal } = TBUI;
  let TB = null, caja = null, fichas = null, cargando = null, enemigos = null;
  const CLAVE = "tbTiradas";
  const est = (() => {
    const base = { vista: "personaje", ficha: null, filtro: "favoritas", modo: "normal", confirmar: false, susurro: false, busqueda: "", enemigo: null, recientes: [], filtroEnemigo: "Acciones" };
    try { return Object.assign(base, JSON.parse(localStorage.getItem(CLAVE) || "{}")); } catch (e) { return base; }
  })();
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch (e) { /* nada */ } };
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+\d+$/, "").trim();

  function iniciar(tb) { TB = tb; }
  async function cargar(forzar) {
    if (fichas && !forzar) return fichas;
    if (!cargando || forzar) cargando = TB.red.fichasRoll20().then(l => (l || []).filter(f => TB.esGM() || f.owner === TB.yo.uid)).catch(() => []);
    fichas = await cargando;
    return fichas;
  }
  function listaEnemigos() {
    if (enemigos) return enemigos;
    enemigos = (typeof statsR20Enemigo === "function" ? (window.STATS || []) : []).map(s => { try { return statsR20Enemigo(s); } catch (e) { return null; } }).filter(Boolean);
    return enemigos;
  }

  /* ------------------------------------------------------------ envío */
  function textoDeEnvio(item, modo) {
    const c = item.cmd || {};
    const comando = c[modo] || c.normal || "";
    return item.chat ? comando + "\n" + item.chat : comando;
  }
  function enviar(texto) {
    let lineas = String(texto).split("\n").map(l => l.trim()).filter(Boolean);
    // En susurro (DJ) se omiten las acciones narradas y el resto va solo al DJ
    if (TB.esGM() && est.susurro) lineas = lineas.filter(l => !/^\/em\s/i.test(l)).map(l => /^\/w\s|^\/gr\s/i.test(l) ? l : /^\/(r|roll)\s+/i.test(l) ? l.replace(/^\/(r|roll)\s+/i, "/gr ") : "/w gm " + l);
    if (lineas.length) TB.enviarChat(lineas.join("\n"));
  }
  async function gastarMunicion(ficha, item) {
    if (!item.municion) return;
    try {
      const n = await TB.red.gastarMunicion(ficha.id, item.municion.ataque);
      item.municion.actual = Number(n);
      pintar();
    } catch (e) { aviso("La tirada salió, pero no se pudo descontar la munición: " + mensajeError(e), true); }
  }
  function lanzar(item, ficha) {
    if (item.municion && item.municion.actual <= 0) { aviso("Sin munición. Recárgala en tu ficha del compendio.", true); return; }
    if (est.confirmar) { confirmarTirada(item, ficha); return; }
    enviar(textoDeEnvio(item, item.cmd && item.cmd[est.modo] ? est.modo : "normal"));
    if (ficha) gastarMunicion(ficha, item);
  }
  // Revisar antes de lanzar: descripción, cálculo, munición y el comando editable (como en el plugin)
  function confirmarTirada(item, ficha) {
    const nombreBase = String(item.texto || "").split(":")[0].replace(/\s*\(nv\.\s*\d+\)\s*$/, "").trim();
    const cuerpo = el(`<div>
      <div class="tb-nota" style="text-transform:uppercase;letter-spacing:.05em">${esc(item.categoria || "")}</div>
      ${item.desc ? `<div class="tb-campo"><span>Descripción</span><div class="tb-tiradas-texto">${esc(item.desc)}</div></div>` : ""}
      ${item.calc ? `<div class="tb-campo"><span>Cálculo</span><div class="tb-tiradas-texto">${esc(item.calc)}</div></div>` : ""}
      ${item.municion ? `<div class="tb-campo"><span>Munición</span>${item.municion.actual > 0 ? `<label class="tb-casilla"><input type="checkbox" data-gastar checked> Gastar 1 (${item.municion.actual} → ${item.municion.actual - 1} de ${item.municion.max})</label>` : `<div class="tb-tiradas-texto">Sin munición (0 / ${item.municion.max}).</div>`}</div>` : ""}
      <label class="tb-campo" data-bloque-nombre hidden><span>Nombre de la tirada</span><input type="text" data-nombre></label>
      <div class="tb-campo"><span>Tirada (editable)</span><select data-modo style="margin-bottom:calc(6px * var(--tb-k))"><option value="normal">Normal</option><option value="ventaja">Ventaja</option><option value="desventaja">Desventaja</option></select>
        <textarea rows="5" data-cmd spellcheck="false" style="font-family:Consolas,monospace;font-size:calc(13px * var(--tb-k))"></textarea>
        <span class="tb-nota" style="font-weight:400">Cambia los dados o los bonos dentro de [[ ]]. Cada línea se manda como un mensaje.</span></div></div>`);
    const q = s => cuerpo.querySelector(s);
    const area = q("[data-cmd]"), selModo = q("[data-modo]"), campoNombre = q("[data-nombre]");
    let nombreActual = nombreBase;
    const enComando = nombreBase && ["normal", "ventaja", "desventaja"].some(m => item.cmd && item.cmd[m] && textoDeEnvio(item, m).includes(nombreBase));
    const poner = m => { let t = textoDeEnvio(item, m); if (nombreActual !== nombreBase) t = t.split(nombreBase).join(nombreActual); area.value = t; };
    if (enComando) {
      q("[data-bloque-nombre]").hidden = false;
      campoNombre.value = nombreBase;
      campoNombre.addEventListener("change", () => { const n = campoNombre.value.trim(); if (!n) { campoNombre.value = nombreActual; return; } area.value = area.value.split(nombreActual).join(n); nombreActual = n; });
    }
    selModo.value = item.cmd && item.cmd[est.modo] ? est.modo : "normal";
    poner(selModo.value);
    selModo.addEventListener("change", () => poner(selModo.value));
    const sinMunicion = item.municion && item.municion.actual <= 0;
    modal({ titulo: esc(item.texto), cuerpo, ancho: 560, aceptar: sinMunicion ? "" : "Lanzar", alAceptar: () => {
      const texto = area.value.trim();
      const gastar = !!(q("[data-gastar]") && q("[data-gastar]").checked);
      if (texto) enviar(texto);
      if (texto && gastar && ficha) gastarMunicion(ficha, item);
    } });
    setTimeout(() => area.focus(), 30);
  }

  /* ------------------------------------------------------------ panel */
  async function pintar(c) {
    if (c) caja = c;
    if (!caja || caja.hidden) return;
    const gm = TB.esGM();
    if (!gm) est.vista = "personaje";
    caja.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab"><h2>Tiradas</h2><button type="button" class="tb-btn tb-btn-mini" data-recargar title="Volver a leer las fichas">↻</button></div>`);
    cab.querySelector("[data-recargar]").addEventListener("click", async () => { await cargar(true); pintar(); });
    const cuerpo = el(`<div class="tb-pes-scroll" style="padding-top:calc(4px * var(--tb-k))"></div>`);
    caja.append(cab, cuerpo);
    if (gm) {
      const pes = el(`<div class="tb-subpestanas" style="margin-top:0"><button type="button" data-v="personaje" class="${est.vista === "personaje" ? "activo" : ""}">Personajes</button><button type="button" data-v="enemigos" class="${est.vista === "enemigos" ? "activo" : ""}">Enemigos</button></div>`);
      pes.addEventListener("click", ev => { const b = ev.target.closest("[data-v]"); if (!b) return; est.vista = b.dataset.v; est.busqueda = ""; guardar(); pintar(); });
      cuerpo.appendChild(pes);
    }
    const controles = el(`<div class="tb-tiradas-controles">
      <select data-modo><option value="normal">Normal</option><option value="ventaja">Ventaja</option><option value="desventaja">Desventaja</option></select>
      <label class="tb-casilla"><input type="checkbox" data-confirmar${est.confirmar ? " checked" : ""}> Revisar antes de lanzar</label>
      ${gm ? `<label class="tb-casilla"><input type="checkbox" data-susurro${est.susurro ? " checked" : ""}> Solo yo (susurro)</label>` : ""}</div>`);
    controles.querySelector("[data-modo]").value = est.modo;
    controles.querySelector("[data-modo]").addEventListener("change", ev => { est.modo = ev.target.value; guardar(); });
    controles.querySelector("[data-confirmar]").addEventListener("change", ev => { est.confirmar = ev.target.checked; guardar(); });
    if (gm) controles.querySelector("[data-susurro]").addEventListener("change", ev => { est.susurro = ev.target.checked; guardar(); });
    cuerpo.appendChild(controles);
    if (est.vista === "enemigos" && gm) pintarEnemigos(cuerpo);
    else await pintarPersonaje(cuerpo);
  }

  async function pintarPersonaje(cuerpo) {
    const espera = el(`<p class="tb-nota">Cargando tus fichas…</p>`);
    cuerpo.appendChild(espera);
    const lista = await cargar();
    espera.remove();
    if (!lista.length) {
      cuerpo.appendChild(el(`<p class="tb-lista-vacia">${TB.esGM() ? "Ninguna ficha tiene tiradas todavía." : "Tu ficha no tiene tiradas todavía. Ábrela en «Mis personajes», pestaña Roll20, y guárdala: las tiradas salen solas de lo que tengas puesto."}</p>`));
      return;
    }
    let f = lista.find(x => x.id === est.ficha) || lista[0];
    est.ficha = f.id;
    const sel = el(`<select class="tb-tiradas-ficha">${lista.map(x => `<option value="${esc(x.id)}">${esc(x.nombre)}${TB.esGM() ? " · " + esc(TB.nombreJugador(x.owner)) : ""}</option>`).join("")}</select>`);
    sel.value = f.id;
    sel.addEventListener("change", () => { est.ficha = sel.value; est.filtro = "favoritas"; guardar(); pintar(); });
    const cb = f.combate || {};
    const resumen = el(`<div class="tb-tiradas-resumen">${cb.pvMax ? `<span>PV <b>${esc(cb.pvActual)}</b> / ${esc(cb.pvMax)}${Number(cb.pvTemp) ? ` (+${esc(cb.pvTemp)})` : ""}</span>` : ""}${f.velocidad ? `<span>Vel. ${esc(typeof f.velocidad === "object" ? Object.values(f.velocidad).filter(Boolean).join(" / ") : f.velocidad)}</span>` : ""}</div>`);
    if (lista.length > 1 || TB.esGM()) cuerpo.appendChild(sel);
    else cuerpo.appendChild(el(`<div class="tb-tiradas-nombre">${esc(f.nombre)}</div>`));
    cuerpo.appendChild(resumen);
    const items = f.items || [];
    const cats = [...new Set(items.map(i => i.categoria).filter(Boolean))];
    if (est.filtro === "favoritas" && !items.some(i => i.favorita)) est.filtro = "todas";
    const chips = el(`<div class="tb-tiradas-chips">${[["favoritas", "★ Favoritas"], ["todas", "Todas"]].concat(cats.map(c => [c, c])).map(([v, t]) => `<button type="button" data-f="${esc(v)}" class="${est.filtro === v ? "activo" : ""}">${esc(t)}</button>`).join("")}</div>`);
    chips.addEventListener("click", ev => { const b = ev.target.closest("[data-f]"); if (!b) return; est.filtro = b.dataset.f; guardar(); pintar(); });
    const buscar = el(`<input type="search" placeholder="Buscar tirada…" style="margin:calc(6px * var(--tb-k)) 0">`);
    buscar.value = est.busqueda;
    const caja = el(`<div class="tb-tiradas-lista"></div>`);
    const pintarLista = () => {
      const qy = norm(est.busqueda);
      const vis = items.filter(i => (qy ? norm(i.texto + " " + (i.categoria || "")).includes(qy) : (est.filtro === "favoritas" ? i.favorita : est.filtro === "todas" || i.categoria === est.filtro)));
      caja.innerHTML = "";
      if (!vis.length) { caja.appendChild(el(`<p class="tb-lista-vacia">Nada coincide.</p>`)); return; }
      vis.forEach(i => {
        const b = el(`<button type="button" class="tb-tirada-item" title="${esc((i.desc || i.calc || "").slice(0, 600))}"><small>${esc(i.categoria || "")}${i.municion ? ` · Munición ${esc(i.municion.actual)}/${esc(i.municion.max)}` : ""}</small><span>${esc(i.texto)}</span></button>`);
        b.addEventListener("click", () => lanzar(i, f));
        caja.appendChild(b);
      });
    };
    buscar.addEventListener("input", () => { est.busqueda = buscar.value; guardar(); pintarLista(); });
    cuerpo.append(chips, buscar, caja);
    pintarLista();
  }

  function pintarEnemigos(cuerpo) {
    const lista = listaEnemigos();
    if (!lista.length) { cuerpo.appendChild(el(`<p class="tb-lista-vacia">No hay estadísticas de enemigos cargadas.</p>`)); return; }
    // Los de esta página: fichas cuyo nombre coincide con unas estadísticas del compendio (sin el número de «Enumerar»)
    const porNombre = new Map(lista.map(e => [norm(e.nombre), e]));
    const enPagina = [];
    TB.L.objetos().forEach(o => { if (o.tipo !== "imagen") return; const e = porNombre.get(norm(o.datos && o.datos.nombre)); if (e && !enPagina.includes(e)) enPagina.push(e); });
    const seleccionado = TB.L.seleccion().map(id => TB.L.objeto(id)).map(o => o && porNombre.get(norm(o.datos && o.datos.nombre))).find(Boolean);
    let actual = seleccionado || lista.find(e => e.id === est.enemigo) || enPagina[0] || null;
    if (actual) est.enemigo = actual.id;
    const buscar = el(`<input type="search" placeholder="Buscar enemigo…" style="margin:calc(6px * var(--tb-k)) 0">`);
    buscar.value = est.busqueda;
    const chipsCaja = el(`<div></div>`), detalle = el(`<div></div>`);
    const chip = e => `<button type="button" data-e="${esc(e.id)}" class="${actual && actual.id === e.id ? "activo" : ""}">${esc(e.nombre)}</button>`;
    const pintarChips = () => {
      const qy = norm(est.busqueda);
      const recientes = est.recientes.map(id => lista.find(e => e.id === id)).filter(e => e && !enPagina.includes(e));
      chipsCaja.innerHTML = qy
        ? `<div class="tb-tiradas-chips">${lista.filter(e => norm(e.nombre).includes(qy)).slice(0, 12).map(chip).join("") || `<span class="tb-nota">Nada coincide.</span>`}</div>`
        : `${enPagina.length ? `<div class="tb-gramola-grupo">En esta página</div><div class="tb-tiradas-chips">${enPagina.map(chip).join("")}</div>` : ""}
           ${recientes.length ? `<div class="tb-gramola-grupo">Recientes</div><div class="tb-tiradas-chips">${recientes.map(chip).join("")}</div>` : ""}
           ${!enPagina.length && !recientes.length ? `<p class="tb-nota">Busca un enemigo por su nombre. Las fichas de la página que se llamen como unas estadísticas salen aquí solas.</p>` : ""}`;
    };
    chipsCaja.addEventListener("click", ev => {
      const b = ev.target.closest("[data-e]"); if (!b) return;
      est.enemigo = b.dataset.e; est.busqueda = "";
      est.recientes = [b.dataset.e].concat(est.recientes.filter(x => x !== b.dataset.e)).slice(0, 10);
      guardar(); pintar();
    });
    buscar.addEventListener("input", () => { est.busqueda = buscar.value; guardar(); pintarChips(); });
    if (actual) {
      const cats = ["Acciones", "Rasgos", "Tiradas"].filter(c => actual.items.some(i => i.categoria === c));
      if (!cats.includes(est.filtroEnemigo)) est.filtroEnemigo = cats[0];
      detalle.appendChild(el(`<div class="tb-tiradas-resumen"><b>${esc(actual.nombre)}</b>${actual.ca !== null ? `<span>CA ${esc(actual.ca)}</span>` : ""}${actual.pv !== null ? `<span>PV ${esc(actual.pv)}</span>` : ""}</div>`));
      if (actual.rol) detalle.appendChild(el(`<p class="tb-nota" style="margin:0 0 calc(6px * var(--tb-k))">${esc(actual.rol)}</p>`));
      const cchips = el(`<div class="tb-tiradas-chips">${cats.map(c => `<button type="button" data-c="${c}" class="${est.filtroEnemigo === c ? "activo" : ""}">${c}</button>`).join("")}</div>`);
      cchips.addEventListener("click", ev => { const b = ev.target.closest("[data-c]"); if (!b) return; est.filtroEnemigo = b.dataset.c; guardar(); pintar(); });
      const items = el(`<div class="tb-tiradas-lista"></div>`);
      actual.items.filter(i => i.categoria === est.filtroEnemigo).forEach(i => {
        const b = el(`<button type="button" class="tb-tirada-item" title="${esc((i.desc || "").slice(0, 600))}"><span>${esc(i.texto)}</span></button>`);
        b.addEventListener("click", () => lanzar(i, null));
        items.appendChild(b);
      });
      detalle.append(cchips, items);
    }
    cuerpo.append(buscar, chipsCaja, detalle);
    pintarChips();
  }

  window.TBTiradas = { iniciar, pintar, recargar: () => cargar(true) };
})();
