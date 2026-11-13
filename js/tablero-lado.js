/* =============================================================================
   TABLERO — panel de la derecha: chat, arte (GM), diario, compendio, gramola, colecciones (macros) y ajustes.
============================================================================= */
(function () {
  const { esc, el, aviso, mensajeError, ventana, ventanas, modal, pedir, confirmar, menu, chips, editorRico, limpiarHtml, campoImagen, interruptor } = TBUI;
  const I = TBIcono;
  let TB = null;
  let pestana = "chat";
  const cuerpos = {};

  const PESTANAS = [
    { id: "chat", icono: "chat", titulo: "Chat de texto" },
    { id: "arte", icono: "arte", titulo: "Biblioteca de arte", gm: true },
    { id: "diario", icono: "diario", titulo: "Diario" },
    { id: "compendio", icono: "compendio", titulo: "Compendio" },
    { id: "gramola", icono: "gramola", titulo: "Gramola" },
    { id: "colecciones", icono: "colecciones", titulo: "Colecciones (macros)" },
    { id: "ajustes", icono: "ajustes", titulo: "Ajustes" }
  ];

  function iniciar(tb) {
    TB = tb;
    const nav = document.getElementById("tbPestanas"), cuerpo = document.getElementById("tbLadoCuerpo");
    PESTANAS.filter(p => !p.gm || TB.esGM()).forEach(p => {
      const b = el(`<button type="button" data-p="${p.id}" title="${esc(p.titulo)}">${I[p.icono]}</button>`);
      b.addEventListener("click", () => abrirPestana(p.id));
      nav.appendChild(b);
      const c = el(`<section class="tb-pes" hidden></section>`);
      cuerpo.appendChild(c);
      cuerpos[p.id] = c;
    });
    document.getElementById("tbLadoPlegar").addEventListener("click", () => {
      TB.prefs.ladoPlegado = !TB.prefs.ladoPlegado; TB.guardarPrefs();
      document.body.classList.toggle("lado-plegado", TB.prefs.ladoPlegado);
    });
    document.body.classList.toggle("lado-plegado", !!TB.prefs.ladoPlegado);
    document.getElementById("tbCompendioBtn").addEventListener("click", () => { if (TB.prefs.ladoPlegado) document.getElementById("tbLadoPlegar").click(); abrirPestana("compendio"); });
    construirChat();
    TB.on("mensaje", m => { agregarMensaje(m, true); if (pestana !== "chat") marcarNovedad("chat"); if (TB.prefs.pitido && m.autor !== TB.yo.uid) pitido(); });
    TB.on("mensajes", pintarMensajes);
    TB.on("diario", () => { pintarDiario(); pintarComo(); });
    TB.on("jugadores", pintarDiario);
    TB.on("musica", sincronizarMusica);
    TB.on("gramola", () => pintarGramola());
    TB.on("presencia", pintarAvatares);
    document.getElementById("tbReglasBtn").addEventListener("click", alternarReglas);
    const repro = document.getElementById("tbReproductor");
    repro.querySelector("[data-plegar]").addEventListener("click", () => repro.classList.toggle("plegado"));
    aplicarAjustes();
    TB.on("arte", pintarArte);
    pintarBarraMacros();
    abrirPestana(cuerpos[TB.prefs.pestana] ? TB.prefs.pestana : "chat");
    sincronizarMusica(TB.estado.musica);
  }

  function abrirPestana(id) {
    pestana = id;
    TB.prefs.pestana = id; TB.guardarPrefs();
    document.querySelectorAll("#tbPestanas button").forEach(b => { b.classList.toggle("activo", b.dataset.p === id); if (b.dataset.p === id) { const p = b.querySelector(".punto"); if (p) p.remove(); } });
    Object.entries(cuerpos).forEach(([k, c]) => { c.hidden = k !== id; });
    if (id === "arte") pintarArte();
    if (id === "diario") pintarDiario();
    if (id === "compendio") pintarCompendio();
    if (id === "gramola") pintarGramola();
    if (id === "colecciones") pintarColecciones();
    if (id === "ajustes") pintarAjustes();
    if (id === "chat") { const l = cuerpos.chat.querySelector(".tb-chat-lista"); if (l) l.scrollTop = l.scrollHeight; }
  }
  function marcarNovedad(id) {
    const b = document.querySelector(`#tbPestanas [data-p="${id}"]`);
    if (b && !b.querySelector(".punto")) b.appendChild(el(`<span class="punto"></span>`));
  }

  /* ============================================================ chat */
  let historialChat = [], posHist = -1;
  function construirChat() {
    const c = cuerpos.chat;
    c.innerHTML = "";
    const lista = el(`<div class="tb-chat-lista"></div>`);
    lista.style.fontSize = (TB.prefs.tamChat || 14.5) + "px";
    const entrada = el(`<div class="tb-chat-entrada">
      <textarea placeholder="Escribe aquí. Intro para enviar, Mayús+Intro para otra línea."></textarea>
      <div class="tb-chat-pie"><label>Como:</label><select data-como></select><button type="button" class="tb-btn" data-enviar>Enviar</button></div></div>`);
    c.append(lista, entrada);
    const ta = entrada.querySelector("textarea");
    const enviar = async () => {
      const t = ta.value.trim();
      if (!t) return;
      historialChat.unshift(t); if (historialChat.length > 30) historialChat.pop(); posHist = -1;
      ta.value = "";
      await TB.enviarChat(t, entrada.querySelector("[data-como]").value || null);
    };
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
      if (e.key === "ArrowUp" && !ta.value.includes("\n") && historialChat.length && (ta.selectionStart === 0 || posHist >= 0)) { e.preventDefault(); posHist = Math.min(historialChat.length - 1, posHist + 1); ta.value = historialChat[posHist]; }
      if (e.key === "ArrowDown" && posHist >= 0) { e.preventDefault(); posHist--; ta.value = posHist >= 0 ? historialChat[posHist] : ""; }
    });
    entrada.querySelector("[data-enviar]").addEventListener("click", enviar);
    pintarComo();
    pintarMensajes();
  }
  function pintarComo() {
    const s = cuerpos.chat && cuerpos.chat.querySelector("[data-como]");
    if (!s) return;
    const v = s.value;
    const mios = [...TB.diario.values()].filter(e => e.tipo === "personaje" && !e.archivado && (TB.esGM() || (e.controladores || []).includes(TB.yo.uid))).sort((a, b) => a.nombre.localeCompare(b.nombre));
    s.innerHTML = `<option value="">${esc(TB.yo.nombre)}${TB.esGM() && TB.yo.nombre !== "DJ" ? " (DJ)" : ""}</option>` + mios.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join("");
    if ([...s.options].some(o => o.value === v)) s.value = v;
  }
  function consejosHtml() {
    if (!TB.prefs.consejos) return "";
    return `<div class="tb-consejos"><h4>Consejos para el chat</h4>Escribe estos comandos en la caja de abajo y pulsa <b>Intro</b>.
      <ul><li>Tiradas de dados<br><b>/roll</b> 1d20 o <b>/r</b> 1d20<br><b>/gmroll</b> 2d6&gt;5 o <b>/gr</b> 2d6&gt;5 (solo al DJ)</li>
      <li>Ventaja y desventaja: <b>/r</b> 2d20kh1+5 · <b>/r</b> 2d20kl1+5</li>
      <li>Tiradas dentro de un mensaje: Ataco con [[1d20+5]]</li>
      <li>Susurra a un jugador o personaje<br><b>/w</b> nombre mensaje · <b>/w</b> "Nombre con espacios" mensaje<br><b>/w gm</b> mensaje</li>
      <li>Acciones: <b>/em</b> se esconde tras la columna${TB.esGM() ? " · Narración: <b>/desc</b> texto" : ""}</li></ul>
      <button type="button" class="tb-enlace" data-ocultar-consejos>Ocultar estos consejos</button></div>`;
  }
  function pintarMensajes() {
    const lista = cuerpos.chat.querySelector(".tb-chat-lista");
    lista.innerHTML = consejosHtml();
    const oc = lista.querySelector("[data-ocultar-consejos]");
    if (oc) oc.addEventListener("click", () => { TB.prefs.consejos = false; TB.guardarPrefs(); pintarMensajes(); });
    ultimoAutor = null;
    TB.mensajes.forEach(m => agregarMensaje(m, false));
    lista.scrollTop = lista.scrollHeight;
  }
  let ultimoAutor = null;
  let ctxPitido = null;
  function pitido() {
    try {
      ctxPitido = ctxPitido || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctxPitido.createOscillator(), g = ctxPitido.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctxPitido.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctxPitido.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctxPitido.currentTime + 0.18);
      o.connect(g).connect(ctxPitido.destination); o.start(); o.stop(ctxPitido.currentTime + 0.2);
    } catch (e) { /* sin audio */ }
  }
  function agregarMensaje(m, animado) {
    const lista = cuerpos.chat.querySelector(".tb-chat-lista");
    const abajo = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
    const t = m.texto || "";
    const emote = /^\/em\s/i.test(t), desc = /^\/desc\s/i.test(t);
    const clave = (m.autor || "") + "|" + m.nombre + "|" + m.modo;
    const seguido = !emote && !desc && clave === ultimoAutor && !m.tirada;
    ultimoAutor = clave;
    const tirada = m.tirada && !m.tirada.enlinea ? m.tirada : null;
    const enlinea = (m.tirada && m.tirada.enlinea) || [];
    let cuerpoTxt = esc(t.replace(/^\/(em|desc)\s+/i, ""));
    cuerpoTxt = cuerpoTxt.replace(/⟦(\d+)⟧/g, (x, i) => TBDados.enLineaHtml(enlinea[+i]));
    let etq = "";
    if (m.modo === "dj") etq = m.autor === TB.yo.uid && !TB.esGM() ? "Al DJ" : "Tirada / mensaje al DJ";
    if (m.modo === "secreta") etq = "Secreta";
    if (m.modo === "susurro") etq = m.autor === TB.yo.uid ? "Susurro a " + (m.para || []).map(u => TB.nombreJugador(u)).join(", ") : "Te susurra";
    const ini = (m.nombre || "?").trim()[0] || "?";
    const av = m.avatar ? `style="background-image:url('${esc(m.avatar)}')"` : `style="background-color:${TB.colorJugador(m.autor)}"`;
    const nodo = el(`<div class="tb-msg ${esc(m.modo)}${seguido ? " seguido" : ""}${emote ? " emote" : ""}${desc ? " desc" : ""}">
      <span class="tb-msg-av" ${av}>${m.avatar ? "" : esc(ini.toUpperCase())}</span>
      <div class="tb-msg-cuerpo">${TB.prefs.horas && m.creado ? `<span class="tb-msg-hora">${new Date(m.creado).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}${etq ? `<span class="tb-msg-etq">${esc(etq)}</span>` : ""}${seguido ? "" : `<span class="tb-msg-nombre">${esc(m.nombre)}${emote ? "" : ":"}</span>`}${cuerpoTxt}${tirada ? TBDados.tiradaHtml(tirada) : ""}</div></div>`);
    lista.appendChild(nodo);
    if (abajo || (animado && m.autor === TB.yo.uid)) lista.scrollTop = lista.scrollHeight;
  }

  /* ============================================================ arte (GM) */
  let filtroArte = "", tipoArte = "todo";
  function pintarArte() {
    const c = cuerpos.arte;
    if (!c || pestana !== "arte") return;
    if (TB.arte === null) { c.innerHTML = `<p class="tb-nota" style="padding:14px">Cargando…</p>`; TB.arte = []; TB.red.arte().then(a => { TB.arte = a || []; pintarArte(); }).catch(() => { TB.arte = []; pintarArte(); }); return; }
    c.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab" style="display:block">
      <div class="tb-fila"><b style="font-weight:500">Buscar:</b><span style="flex:1"></span><select data-tipo style="width:150px"><option value="todo">Todo</option><option value="subidas">Mi biblioteca</option><option value="compendio">Del compendio</option></select></div>
      <input type="search" data-buscar style="margin-top:6px">
      <p class="tb-arte-ayuda">Arrastra para colocar el arte, <b>arrastra pulsando Alt</b> para mantener las dimensiones. También puedes soltar archivos directamente en el tablero.</p>
      <div class="tb-fila" style="justify-content:flex-end"><input type="file" accept="image/*" multiple hidden data-archivo><button type="button" class="tb-btn" data-cargar>⬆ Cargar</button><button type="button" class="tb-btn" data-url>＋ Añadir URL</button></div></div>`);
    const buscar = cab.querySelector("[data-buscar]"), tipo = cab.querySelector("[data-tipo]"), archivo = cab.querySelector("[data-archivo]");
    buscar.value = filtroArte; tipo.value = tipoArte;
    buscar.addEventListener("input", () => { filtroArte = buscar.value; pintarLista(); });
    tipo.addEventListener("change", () => { tipoArte = tipo.value; pintarLista(); });
    cab.querySelector("[data-cargar]").addEventListener("click", () => archivo.click());
    archivo.addEventListener("change", async () => {
      for (const f of archivo.files) {
        try { aviso("Subiendo " + f.name + "…"); const src = await TB.red.subirImagen(f); const a = await TB.red.crearArte({ src, nombre: f.name.replace(/\.[^.]+$/, "") }); TB.arte.unshift(a); }
        catch (e) { aviso(mensajeError(e), true); }
      }
      archivo.value = ""; pintarLista();
    });
    cab.querySelector("[data-url]").addEventListener("click", async () => {
      const u = await pedir("Añadir imagen por dirección", "", { etiqueta: "Dirección de la imagen (https://…)" });
      if (!u || !/^https?:\/\//i.test(u.trim())) return;
      try { const a = await TB.red.crearArte({ src: u.trim(), nombre: decodeURIComponent(u.trim().split("/").pop().split("?")[0]).slice(0, 120) }); TB.arte.unshift(a); pintarLista(); }
      catch (e) { aviso(mensajeError(e), true); }
    });
    const lista = el(`<div class="tb-pes-scroll"></div>`);
    c.append(cab, lista);
    function item(src, nombre, borrable) {
      const it = el(`<div class="tb-lista-item cuadrada" draggable="true" title="Arrastra al tablero"><img src="${esc(src)}" alt="" loading="lazy"><b>${esc(nombre || src.split("/").pop())}</b>${borrable ? `<button type="button" class="tb-btn tb-btn-mini" title="Quitar de la biblioteca">✕</button>` : ""}</div>`);
      it.addEventListener("dragstart", e => { e.dataTransfer.setData("text/tablero-src", src); e.dataTransfer.setData("text/tablero-nombre", nombre || ""); e.dataTransfer.effectAllowed = "copy"; });
      it.addEventListener("click", ev => { if (ev.target.closest("button")) return; TBPaneles.soltarEnTablero({ files: [], getData: k => (k === "text/tablero-src" ? src : k === "text/tablero-nombre" ? nombre || "" : "") }, TB.L.centroVista(), false); });
      if (borrable) it.querySelector("button").addEventListener("click", async ev => { ev.stopPropagation(); await TB.red.borrarArte(borrable); TB.arte = TB.arte.filter(a => a.id !== borrable); pintarLista(); });
      return it;
    }
    function pintarLista() {
      lista.innerHTML = "";
      const f = filtroArte.trim().toLowerCase();
      const ok = n => !f || String(n || "").toLowerCase().includes(f);
      if (tipoArte !== "compendio") {
        lista.appendChild(el(`<div class="tb-lista-titulo">▢ Activos cargados</div>`));
        const sub = TB.arte.filter(a => ok(a.nombre));
        if (!sub.length) lista.appendChild(el(`<p class="tb-lista-vacia">Aún no has subido nada. Usa Cargar o suelta imágenes en el tablero.</p>`));
        sub.forEach(a => lista.appendChild(item(a.src, a.nombre, a.id)));
      }
      if (tipoArte !== "subidas") {
        lista.appendChild(el(`<div class="tb-lista-titulo">▢ Del compendio</div>`));
        (window.STATS || []).filter(s => s.imagen && ok(s.nombre)).forEach(s => lista.appendChild(item(s.imagen, s.nombre, null)));
      }
    }
    pintarLista();
  }

  /* ============================================================ diario */
  let filtroDiario = "", verArchivados = false;
  const plegadas = new Set();
  function pintarDiario() {
    const c = cuerpos.diario;
    if (!c || pestana !== "diario") return;
    c.innerHTML = "";
    const gm = TB.esGM();
    const cab = el(`<div class="tb-pes-cab" style="display:block">
      <input type="search" placeholder="Buscar por etiqueta o nombre…" data-buscar>
      ${gm ? `<div class="tb-fila" style="margin-top:8px"><button type="button" class="tb-btn" data-nuevo="personaje">＋ Personaje</button><button type="button" class="tb-btn" data-nuevo="nota">＋ Nota</button><span style="flex:1"></span><label class="tb-casilla tb-nota"><input type="checkbox" data-arch> Archivados</label></div>` : ""}</div>`);
    const buscar = cab.querySelector("[data-buscar]");
    buscar.value = filtroDiario;
    buscar.addEventListener("input", () => { filtroDiario = buscar.value; pintarLista(); });
    if (gm) {
      cab.querySelectorAll("[data-nuevo]").forEach(b => b.addEventListener("click", async () => {
        try { const e = await TB.red.crearDiario({ tipo: b.dataset.nuevo, nombre: b.dataset.nuevo === "nota" ? "Nueva nota" : "Nuevo personaje", carpeta: b.dataset.nuevo === "nota" ? "Notas" : "Personajes" }); TB.diario.set(e.id, e); editarEntrada(e.id); }
        catch (e) { aviso(mensajeError(e), true); }
      }));
      const arch = cab.querySelector("[data-arch]");
      arch.checked = verArchivados;
      arch.addEventListener("change", () => { verArchivados = arch.checked; pintarLista(); });
    }
    const lista = el(`<div class="tb-pes-scroll"></div>`);
    c.append(cab, lista);
    function item(e) {
      const color = (e.controladores || []).length ? TB.colorJugador(e.controladores[0]) : "#e0632e";
      const it = el(`<div class="tb-lista-item" draggable="${gm}"><span class="tb-lista-av" style="${e.imagen ? `background:url('${esc(e.imagen)}') center/cover` : `background:${e.tipo === "nota" ? "#c9b98a" : "#999"}`}"></span>
        <b>${e.tipo === "nota" ? "📜 " : ""}${esc(e.nombre)}${e.archivado ? " (archivado)" : ""}</b>${gm ? `<span class="tb-lista-punto" style="background:${color}" title="${e.ver_todos ? "Lo ven todos" : (e.ver || []).length ? "Lo ven algunos" : "Solo tú"}"></span>` : ""}</div>`);
      it.addEventListener("click", () => abrirEntrada(e.id));
      if (gm) it.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/tablero-diario", e.id); ev.dataTransfer.effectAllowed = "copy"; });
      return it;
    }
    function pintarLista() {
      lista.innerHTML = "";
      const f = filtroDiario.trim().toLowerCase();
      const todas = [...TB.diario.values()].filter(e => (verArchivados || !e.archivado) && (!f || e.nombre.toLowerCase().includes(f) || (e.etiquetas || []).some(t => t.toLowerCase().includes(f))))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre));
      if (!todas.length) { lista.appendChild(el(`<p class="tb-lista-vacia">${gm ? "Crea personajes y notas con los botones de arriba." : "El DJ todavía no ha compartido nada contigo."}</p>`)); return; }
      const sueltas = todas.filter(e => !e.carpeta);
      sueltas.forEach(e => lista.appendChild(item(e)));
      [...new Set(todas.filter(e => e.carpeta).map(e => e.carpeta))].sort((a, b) => a.localeCompare(b)).forEach(cp => {
        const abierta = !plegadas.has(cp);
        const t = el(`<div class="tb-lista-carpeta"><i>${abierta ? "−" : "+"}</i>${esc(cp)}</div>`);
        t.addEventListener("click", () => { if (plegadas.has(cp)) plegadas.delete(cp); else plegadas.add(cp); pintarLista(); });
        lista.appendChild(t);
        if (!abierta) return;
        const h = el(`<div class="tb-lista-hijos"></div>`);
        todas.filter(e => e.carpeta === cp).forEach(e => h.appendChild(item(e)));
        lista.appendChild(h);
      });
    }
    pintarLista();
  }

  async function abrirEntrada(id) {
    const e = TB.diario.get(id);
    if (!e) return;
    const gm = TB.esGM();
    const v = ventana("diario-" + id, { titulo: esc(e.nombre), ancho: 520, alto: 560, x: Math.max(80, window.innerWidth - 1000), y: 70 });
    v.cuerpo.innerHTML = "";
    const c = el(`<div style="padding:16px">
      <div class="tb-fila" style="align-items:flex-start;gap:16px">
        ${e.imagen ? `<img src="${esc(e.imagen)}" alt="" style="width:${e.tipo === "nota" ? "100%" : "150px"};${e.tipo === "nota" ? "" : "height:150px;border-radius:50%;"}object-fit:cover;flex:none">` : ""}
        ${e.tipo === "personaje" ? `<div><h2 style="margin:4px 0 6px;font-size:22px">${esc(e.nombre)}</h2>${(e.etiquetas || []).length ? `<p class="tb-nota">${e.etiquetas.map(esc).join(" · ")}</p>` : ""}
          ${(e.controladores || []).length ? `<p class="tb-nota">Lo controla: ${e.controladores.map(u => esc(TB.nombreJugador(u))).join(", ")}</p>` : ""}</div>` : ""}
      </div>
      <h4 style="margin:16px 0 6px">${e.tipo === "nota" ? "Contenido" : "Biografía e información"}</h4>
      <div class="tb-contenido-rico">${limpiarHtml(e.texto) || `<p class="tb-nota">Sin texto.</p>`}</div>
      ${gm ? `<h4 style="margin:16px 0 6px">Notas del DJ</h4><div class="tb-contenido-rico" data-gm><p class="tb-nota">Cargando…</p></div>` : ""}
    </div>`);
    v.cuerpo.appendChild(c);
    if (gm) {
      const pie = el(`<div class="tb-fila"><button type="button" class="tb-btn" data-hablar>Mostrar a los jugadores</button><button type="button" class="tb-btn tb-btn-azul" data-editar>Editar</button></div>`);
      pie.style.cssText = "padding:10px 16px;border-top:1px solid #ddd;justify-content:flex-end";
      v.el.appendChild(pie);
      pie.querySelector("[data-editar]").addEventListener("click", () => { v.cerrar(); editarEntrada(id); });
      pie.querySelector("[data-hablar]").addEventListener("click", async () => {
        if (!e.ver_todos) await TB.red.actualizarDiario(id, { ver_todos: true });
        await TB.red.decir(`/desc El DJ comparte «${e.nombre}» en el diario.`, "todos");
        aviso("Ahora lo ven todos en su diario.");
      });
      TB.red.diarioGM(id).then(t => { const g = c.querySelector("[data-gm]"); if (g) g.innerHTML = limpiarHtml(t) || `<p class="tb-nota">Sin notas.</p>`; }).catch(() => {});
    }
  }

  async function editarEntrada(id) {
    const e = TB.diario.get(id);
    if (!e) return;
    const jugadores = TB.jugadores.map(j => ({ id: j.uid, nombre: j.nombre }));
    const avatar = campoImagen(e.imagen, f => TB.red.subirImagen(f), { texto: "Suelta aquí una imagen, o haz clic para subirla" });
    const ver = chips(jugadores, (e.ver_todos ? ["*"] : []).concat(e.ver || []), { todos: "Todos los jugadores" });
    const control = chips(jugadores, e.controladores || []);
    const bio = editorRico(e.texto);
    let gmTexto = "";
    try { gmTexto = await TB.red.diarioGM(id); } catch (err) { /* sin notas */ }
    const notasGM = editorRico(gmTexto);
    const esPj = e.tipo === "personaje";
    const cuerpo = el(`<div>
      <div style="display:grid;grid-template-columns:300px 1fr;gap:24px">
        <div><div class="tb-etq" style="margin-bottom:6px">${esPj ? "Avatar" : "Imagen"}</div><div data-avatar></div>
          ${esPj ? `<div class="tb-etq" style="margin:16px 0 6px">Token predeterminado (opcional)</div>
            <div data-token style="width:150px;height:150px;margin:0 auto 10px;border-radius:50%;background:#eee center/cover"></div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button type="button" class="tb-btn tb-btn-azul" data-tok="editar">Editar propiedades de token</button>
              <button type="button" class="tb-btn" data-tok="usar">Usar token seleccionado</button>
              <button type="button" class="tb-btn" data-tok="aplicar">Aplicar valores predeterminados de token</button></div>` : ""}
        </div>
        <div>
          <label class="tb-campo"><span>Nombre</span><input type="text" data-nombre></label>
          <div class="tb-campo"><span>En los diarios de los jugadores</span><div data-ver></div></div>
          ${esPj ? `<div class="tb-campo"><span>Se puede editar &amp; controlado por</span><div data-control></div></div>` : ""}
          <label class="tb-campo"><span>Etiquetas</span><input type="text" data-etiquetas placeholder="Separadas por comas"></label>
          <label class="tb-campo"><span>Carpeta</span><input type="text" data-carpeta></label>
          ${esPj ? `<label class="tb-campo"><span>Ficha del compendio (opcional)</span><select data-ficha><option value="">Ninguna</option>${TB.fichas.map(f => `<option value="${f.id}">${esc(f.nombre)} · ${esc(TB.nombreJugador(f.owner))}</option>`).join("")}</select></label>` : ""}
          <hr class="tb-sep">
          <div class="tb-fila" style="justify-content:space-between;flex-wrap:wrap">
            <span class="tb-fila"><button type="button" class="tb-btn" data-dup>Duplicar</button><button type="button" class="tb-btn" data-arch>${e.archivado ? "Desarchivar" : "Archivar"}</button></span>
            <button type="button" class="tb-btn tb-btn-rojo" data-quitar>Quitar del juego</button>
          </div>
          ${esPj ? `<label class="tb-casilla" style="margin-top:16px;justify-content:space-between;width:100%"><span>Miembro del grupo:</span><input type="checkbox" data-grupo></label>` : ""}
        </div>
      </div>
      <hr class="tb-sep">
      <div class="tb-campo"><span>${esPj ? "Biografía &amp; Información" : "Contenido"}</span><div data-bio></div></div>
      <div class="tb-campo"><span>Notas del DJ (solo las ves tú)</span><div data-notasgm></div></div>
    </div>`);
    const q = s => cuerpo.querySelector(s);
    q("[data-avatar]").appendChild(avatar.el);
    q("[data-ver]").appendChild(ver.el);
    if (esPj) q("[data-control]").appendChild(control.el);
    q("[data-nombre]").value = e.nombre;
    q("[data-etiquetas]").value = (e.etiquetas || []).join(", ");
    q("[data-carpeta]").value = e.carpeta || "";
    q("[data-bio]").appendChild(bio.el);
    q("[data-notasgm]").appendChild(notasGM.el);
    if (esPj) {
      q("[data-ficha]").value = e.ficha || "";
      q("[data-grupo]").checked = !!e.grupo;
      const tok = q("[data-token]");
      const pintarTok = () => { const s = (e.token && e.token.datos && e.token.datos.src) || ""; tok.style.backgroundImage = s ? `url('${s.replace(/'/g, "%27")}')` : ""; };
      pintarTok();
      cuerpo.querySelectorAll("[data-tok]").forEach(b => b.addEventListener("click", async () => {
        const a = b.dataset.tok;
        if (a === "editar") { TBUI.cerrarModal(); TBPaneles.ajustesFicha(null, { diario: id }); return; }
        const sel = TB.L.seleccion().map(s => TB.L.objeto(s)).filter(o => o && o.tipo === "imagen");
        if (!sel.length) { aviso("Selecciona primero una ficha en el tablero."); return; }
        if (a === "usar") {
          e.token = { ancho: sel[0].ancho, alto: sel[0].alto, datos: Object.assign({}, sel[0].datos, { representa: id }) };
          await TB.red.actualizarDiario(id, { token: e.token });
          pintarTok(); aviso("Token predeterminado guardado.");
        } else if (a === "aplicar") {
          if (!e.token) { aviso("Este personaje no tiene token predeterminado."); return; }
          TB.cambiarVarios(sel.map(o => ({ id: o.id, cambios: { ancho: e.token.ancho, alto: e.token.alto, datos: Object.assign({}, o.datos, e.token.datos, { representa: id }), controladores: (e.controladores || []).slice() } })));
          aviso("Aplicado a " + sel.length + " ficha(s).");
        }
      }));
    }
    q("[data-dup]").addEventListener("click", async () => {
      const c = Object.assign({}, e); delete c.id; delete c.creado; delete c.actualizado;
      c.nombre = e.nombre + " (copia)";
      const n = await TB.red.crearDiario(c); TB.diario.set(n.id, n); TBUI.cerrarModal(); editarEntrada(n.id);
    });
    q("[data-arch]").addEventListener("click", async () => { await TB.red.actualizarDiario(id, { archivado: !e.archivado }); TBUI.cerrarModal(); });
    q("[data-quitar]").addEventListener("click", async () => {
      if (!(await confirmar("Quitar del juego", `¿Borrar «${e.nombre}» del diario? Las fichas del tablero que lo representan se quedan.`, "Quitar"))) return;
      await TB.red.borrarDiario(id); TB.diario.delete(id); TB.lanzar("diario");
    });
    modal({
      titulo: "Editar " + esc(e.nombre), cuerpo, ancho: 900, aceptar: "Guardar cambios",
      alAceptar: async () => {
        const vv = ver.valor();
        const cambios = {
          nombre: q("[data-nombre]").value.trim().slice(0, 80) || "Sin nombre", imagen: avatar.valor(),
          ver_todos: vv.includes("*"), ver: vv.filter(x => x !== "*"),
          etiquetas: q("[data-etiquetas]").value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 20),
          carpeta: q("[data-carpeta]").value.trim().slice(0, 60), texto: bio.valor()
        };
        if (esPj) {
          cambios.controladores = control.valor();
          cambios.ficha = q("[data-ficha]").value || null;
          cambios.grupo = q("[data-grupo]").checked;
        }
        await TB.red.actualizarDiario(id, cambios);
        TB.diario.set(id, Object.assign({}, e, cambios)); TB.lanzar("diario");
        const n = notasGM.valor();
        if (n !== limpiarHtml(gmTexto)) await TB.red.guardarDiarioGM(id, n);
        // Las fichas que lo representan pasan a controlarlas los mismos jugadores
        if (esPj && JSON.stringify(cambios.controladores) !== JSON.stringify(e.controladores || [])) {
          const fichas = TB.L.objetos().filter(o => o.datos && o.datos.representa === id);
          if (fichas.length) TB.cambiarVarios(fichas.map(o => ({ id: o.id, cambios: { controladores: cambios.controladores.slice() } })));
        }
      }
    });
  }

  /* ============================================================ compendio */
  const DATOS_COMPENDIO = ["entries", "personajes", "lugares", "facciones", "pergaminos", "armas", "objetos", "bestiario", "razas", "religiones"];
  const LISTAS = { ENTRIES: "Textos", PERSONAJES: "Personajes", LUGARES: "Lugares", FACCIONES: "Facciones", PERGAMINOS: "Pergaminos", ARMAS: "Armas", OBJETOS: "Objetos", BESTIARIO: "Bestiario", RAZAS: "Pueblos", RELIGIONES: "Religiones" };
  let compendioCargado = null, filtroComp = "";
  function cargarCompendio() {
    if (compendioCargado) return compendioCargado;
    compendioCargado = Promise.all(DATOS_COMPENDIO.map(n => new Promise(res => {
      const s = document.createElement("script");
      s.src = `data/${n}.js?v=20271111`;
      s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    })));
    return compendioCargado;
  }
  function visibleParaMi(item) {
    if (TB.esGM()) return true;
    const lado = (() => { try { return localStorage.getItem("compendioLado"); } catch (e) { return null; } })();
    const ambos = (() => { try { return localStorage.getItem("compendioVeAmbos") === "1"; } catch (e) { return false; } })();
    if (!item.lado || !item.lado.length || ambos) return true;
    return !!lado && item.lado.includes(lado);
  }
  async function pintarCompendio() {
    const c = cuerpos.compendio;
    if (!c.firstChild) {
      c.innerHTML = `<div class="tb-pes-cab" style="display:block"><h2 style="font-size:21px;font-weight:500;margin:0 0 8px">Compendio</h2><input type="search" placeholder="Buscar criaturas, lugares, objetos, personajes…" data-buscar></div><div class="tb-pes-scroll" data-res><p class="tb-nota">Cargando el compendio…</p></div>`;
      const b = c.querySelector("[data-buscar]");
      b.addEventListener("input", () => { filtroComp = b.value; pintarResultados(); });
    }
    await cargarCompendio();
    pintarResultados();
  }
  function pintarResultados() {
    const res = cuerpos.compendio.querySelector("[data-res]");
    if (!res) return;
    const f = filtroComp.trim().toLowerCase();
    res.innerHTML = "";
    if (!f) { res.innerHTML = `<p class="tb-nota">Escribe para buscar en todo el compendio. Al abrir una entrada se muestra en una ventana sin salir del tablero.</p>`; return; }
    const hallados = [];
    Object.entries(LISTAS).forEach(([k, cat]) => (window[k] || []).forEach(it => {
      const t = it.title || it.nombre || "";
      if (!t || !visibleParaMi(it)) return;
      const tl = t.toLowerCase();
      if (tl.includes(f) || (it.summary || "").toLowerCase().includes(f)) hallados.push({ it, cat, t, peso: tl.startsWith(f) ? 0 : tl.includes(f) ? 1 : 2 });
    }));
    hallados.sort((a, b) => a.peso - b.peso || a.t.localeCompare(b.t));
    if (!hallados.length) { res.innerHTML = `<p class="tb-lista-vacia">Nada con «${esc(filtroComp)}».</p>`; return; }
    hallados.slice(0, 80).forEach(({ it, cat, t }) => {
      const fila = el(`<div class="tb-lista-item"><b>${esc(t)}</b><span class="tb-nota">${esc(cat)}</span></div>`);
      fila.addEventListener("click", () => {
        const v = ventana("comp-" + (it.id || t), { titulo: esc(t), ancho: 560, alto: 600, x: 200, y: 60, recordar: false });
        v.cuerpo.innerHTML = `<div style="padding:16px 20px" class="tb-contenido-rico"><p class="tb-nota">${esc(cat)}${it.summary ? " · " + esc(it.summary) : ""}</p>${it.content || ""}</div>`;
      });
      res.appendChild(fila);
    });
  }

  /* ============================================================ gramola */
  /* Como la de Roll20: el DJ elige qué suena y suena para todos a la vez. Fuentes: las canciones del sitio, las
     subidas a la rocola, enlaces de YouTube o Spotify y archivos de audio por enlace. El DJ arma listas y tiene un
     soundboard de efectos cortos. Todo vive en tablero_estado (musica = lo que suena, gramola = listas y efectos). */
  let audioBloqueado = false;
  const CANCIONES_COSAS = ["All The Fun At The Fair", "Bad Apple", "Happy Wheels victory", "Mata al moco", "Pizza Parlor Theme", "The Crack of Doom"];
  const EFECTOS_BASE = [
    { id: "risa1", nombre: "Risita 1", src: "assets/audio/risita-bufon.mp3" },
    { id: "risa2", nombre: "Risita 2", src: "assets/audio/risita-bufon-2.mp3" },
    { id: "risa3", nombre: "Risita 3", src: "assets/audio/risita-bufon-3.mp3" },
    { id: "risa4", nombre: "Risita 4", src: "assets/audio/risita-bufon-4.mp3" },
    { id: "victoria", nombre: "Victoria", src: "assets/cosas/Happy Wheels victory.mp3" },
    { id: "susto1", nombre: "Susto (fuerte)", src: "assets/Jumpscare/loud-scream-sfx-earrape-warning-kenzirb_AHxFGmsa.mp3" },
    { id: "susto2", nombre: "Grito (fuerte)", src: "assets/Jumpscare/Slendytubbies classic Tinky Winky scream full version EARRAPE!!!! - AKA Golden Tinky Winky.mp3" },
    { id: "susto3", nombre: "Freddy (fuerte)", src: "assets/Jumpscare/Golden Freddy Jumpscare EARRAPE - Sswwaaggyy Zadar.mp3" }
  ];
  const gramola = () => Object.assign({ listas: [], sonidos: [] }, TB.estado.gramola || {});
  function guardarGramola(c) {
    const g = Object.assign(gramola(), c);
    TB.estado.gramola = g;
    pintarGramola();
    return TB.red.actualizarEstado({ gramola: g }).catch(e => aviso(mensajeError(e), true));
  }
  function nombreDe(src) {
    return (window.MUSICA_NUBE_NOMBRES && window.MUSICA_NUBE_NOMBRES[src]) || decodeURIComponent(String(src).split("/").pop()).replace(/\.[^.]+$/, "");
  }
  // Todas las canciones del sitio: la rocola (data/musica.js y las subidas), la música del Bufón y las de assets/cosas
  function pistasSitio() {
    const vistas = new Set(), out = [];
    const sumar = (src, nombre, grupo) => { if (!src || vistas.has(src)) return; vistas.add(src); out.push({ src, nombre: nombre || nombreDe(src), tipo: "archivo", grupo }); };
    (window.MUSICA || []).forEach(s => sumar(s, null, /^https?:/.test(s) ? "Subidas a la rocola" : "Rocola del sitio"));
    (window.BUFON_MUSICA || []).forEach(f => sumar("assets/Bufon/musica/" + f, f.replace(/\.[^.]+$/, ""), "Música de escena"));
    CANCIONES_COSAS.forEach(n => sumar(`assets/cosas/${n}.mp3`, n, "Música de escena"));
    return out;
  }
  // Un enlace pegado: YouTube, Spotify o un archivo de audio
  function pistaDeEnlace(url) {
    url = String(url || "").trim();
    let m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:[^#]*&)?v=)([\w-]{11})/);
    if (m) return { tipo: "youtube", id: m[1], src: "yt:" + m[1], nombre: "Vídeo de YouTube", enlace: "https://www.youtube.com/watch?v=" + m[1] };
    m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/) || url.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/);
    if (m) return { tipo: "spotify", uri: `spotify:${m[1]}:${m[2]}`, src: `spotify:${m[1]}:${m[2]}`, nombre: "Spotify (" + ({ track: "canción", album: "álbum", playlist: "lista", episode: "episodio", show: "programa" })[m[1]] + ")", enlace: `https://open.spotify.com/${m[1]}/${m[2]}` };
    if (/^https?:\/\/\S+\.(mp3|ogg|oga|wav|m4a|aac|webm|opus)(\?\S*)?$/i.test(url)) return { tipo: "archivo", src: url, nombre: nombreDe(url.split("?")[0]) };
    return null;
  }
  // El nombre de un vídeo o canción se pide a su propio servicio (oEmbed); si no contesta, se queda el genérico
  async function nombreExterno(p) {
    try {
      const base = p.tipo === "youtube" ? "https://www.youtube.com/oembed?format=json&url=" : p.tipo === "spotify" ? "https://open.spotify.com/oembed?url=" : null;
      if (!base) return p.nombre;
      const r = await fetch(base + encodeURIComponent(p.enlace));
      if (!r.ok) return p.nombre;
      const j = await r.json();
      return (j.title || p.nombre).slice(0, 120);
    } catch (e) { return p.nombre; }
  }
  const limpiaPista = p => ({ src: p.src, nombre: p.nombre, tipo: p.tipo || "archivo", id: p.id || null, uri: p.uri || null });

  /* ---------- lo que suena */
  const volumenDe = mus => Math.max(0, Math.min(1, (mus.volumen == null ? 0.6 : mus.volumen) * (TB.prefs.volumen == null ? 0.7 : TB.prefs.volumen)));
  const posicionDe = mus => mus.pausado ? (mus.pos || 0) : Math.max(0, (Date.now() - (mus.inicio || Date.now())) / 1000);
  function cambiarMusica(c) {
    const mus = Object.assign({}, TB.estado.musica || {}, c);
    TB.estado.musica = mus;
    sincronizarMusica(mus);
    TB.red.actualizarEstado({ musica: mus }).catch(e => aviso(mensajeError(e), true));
  }
  function reproducir(p, extra) {
    cambiarMusica(Object.assign({ src: p.src, nombre: p.nombre, tipo: p.tipo || "archivo", id: p.id || null, uri: p.uri || null, inicio: Date.now(), pausado: false, pos: 0, lista: null, indice: 0 }, extra || {}));
  }
  function listaActual() { const m = TB.estado.musica || {}; return m.lista ? gramola().listas.find(l => l.id === m.lista) : null; }
  function saltar(paso) {
    const m = TB.estado.musica || {}, l = listaActual();
    if (!l || !l.pistas.length) return;
    let i;
    if (m.aleatorio && l.pistas.length > 1) { do { i = Math.floor(Math.random() * l.pistas.length); } while (i === m.indice); }
    else i = (m.indice || 0) + paso;
    if (i >= l.pistas.length) { if (!m.repetirLista) { cambiarMusica({ src: null, nombre: null, pausado: false }); return; } i = 0; }
    if (i < 0) i = l.pistas.length - 1;
    reproducir(l.pistas[i], { lista: l.id, indice: i, aleatorio: !!m.aleatorio, repetirLista: !!m.repetirLista, volumen: m.volumen, bucle: false });
  }
  // Al terminar una pista: la repite si está en bucle; si viene de una lista, el DJ pasa a la siguiente
  function alTerminar() {
    const m = TB.estado.musica || {};
    if (m.bucle) return;
    if (TB.esGM() && m.lista) saltar(1);
  }

  function sincronizarMusica(mus) {
    mus = mus || {};
    const tipo = mus.src ? (mus.tipo || "archivo") : null;
    if (tipo !== "archivo") pararAudio();
    if (tipo !== "youtube") pararYT();
    if (tipo !== "spotify") pararSP();
    if (tipo === "archivo") syncAudio(mus);
    if (tipo === "youtube") syncYT(mus);
    if (tipo === "spotify") syncSP(mus);
    document.getElementById("tbReproductor").hidden = !(tipo === "youtube" || tipo === "spotify");
    document.querySelector("#tbReproductor .tb-repro-yt").hidden = tipo !== "youtube";
    document.querySelector("#tbReproductor .tb-repro-sp").hidden = tipo !== "spotify";
    const cab = document.querySelector("#tbReproductor .tb-repro-nombre");
    if (cab) cab.textContent = mus.nombre || "";
    pintarGramola();
  }
  function marcarBloqueo(v) { if (audioBloqueado !== v) { audioBloqueado = v; pintarGramola(); } }

  // Archivos de audio
  let audioPreparado = false;
  function pararAudio() { const a = document.getElementById("tbAudio"); a.pause(); a.removeAttribute("src"); }
  function syncAudio(mus) {
    const a = document.getElementById("tbAudio");
    if (!audioPreparado) { audioPreparado = true; a.addEventListener("ended", alTerminar); }
    a.volume = volumenDe(mus);
    a.loop = !!mus.bucle;
    if (a.getAttribute("src") !== mus.src) a.src = mus.src;
    const colocar = () => {
      let p = posicionDe(mus);
      if (a.duration && isFinite(a.duration)) { if (mus.bucle) p = p % a.duration; else if (p >= a.duration) { a.pause(); return; } }
      if (Math.abs(a.currentTime - p) > 1.5) a.currentTime = p;
      if (mus.pausado) a.pause();
      else a.play().then(() => marcarBloqueo(false)).catch(() => marcarBloqueo(true));
    };
    if (a.readyState >= 1) colocar(); else a.addEventListener("loadedmetadata", colocar, { once: true });
  }

  // YouTube (API del reproductor incrustado). El reproductor se ve pequeño abajo a la izquierda.
  let ytPromesa = null, yt = null, ytId = null, ytCola = Promise.resolve(), ytMus = null;
  function cargarYT() {
    if (ytPromesa) return ytPromesa;
    ytPromesa = new Promise((res, rej) => {
      const antes = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (antes) antes(); res(); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { ytPromesa = null; rej(new Error("No se pudo cargar YouTube.")); };
      document.head.appendChild(s);
    });
    return ytPromesa;
  }
  function pararYT() { ytMus = null; if (yt && yt.pauseVideo) try { yt.pauseVideo(); } catch (e) { /* nada */ } }
  function syncYT(mus) {
    ytMus = mus;
    ytCola = ytCola.then(async () => {
      if (ytMus !== mus) return;
      try { await cargarYT(); } catch (e) { aviso(e.message, true); return; }
      let pos = posicionDe(mus);
      if (!yt) {
        ytId = mus.id;
        yt = await new Promise(res => {
          const p = new YT.Player(document.getElementById("tbReproYT"), { width: 240, height: 135, videoId: mus.id,
            playerVars: { start: Math.floor(pos), autoplay: 0, playsinline: 1, controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3 },
            events: { onReady: () => res(p), onStateChange: e => { if (e.data === 0 && ytMus) { if (ytMus.bucle) { yt.seekTo(0, true); yt.playVideo(); } else alTerminar(); } if (e.data === 1) marcarBloqueo(false); } } });
        });
      } else if (ytId !== mus.id) { ytId = mus.id; yt.loadVideoById({ videoId: mus.id, startSeconds: pos }); }
      if (ytMus !== mus) return;
      yt.setVolume(Math.round(volumenDe(mus) * 100));
      const dur = yt.getDuration ? yt.getDuration() : 0;
      if (dur) { if (mus.bucle) pos = pos % dur; else if (pos >= dur) { yt.pauseVideo(); return; } }
      if (Math.abs((yt.getCurrentTime() || 0) - pos) > 2) yt.seekTo(pos, true);
      if (mus.pausado) yt.pauseVideo();
      else {
        yt.playVideo();
        setTimeout(() => { if (ytMus === mus && yt.getPlayerState && yt.getPlayerState() !== 1 && yt.getPlayerState() !== 3) marcarBloqueo(true); }, 2500);
      }
    });
  }

  // Spotify (API del reproductor incrustado). Sin sesión de Spotify en el navegador solo suenan 30 segundos.
  let spPromesa = null, sp = null, spUri = null, spMus = null, spCola = Promise.resolve();
  function cargarSP() {
    if (spPromesa) return spPromesa;
    spPromesa = new Promise((res, rej) => {
      window.onSpotifyIframeApiReady = api => res(api);
      const s = document.createElement("script");
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.onerror = () => { spPromesa = null; rej(new Error("No se pudo cargar Spotify.")); };
      document.head.appendChild(s);
    });
    return spPromesa;
  }
  function pararSP() { spMus = null; if (sp) try { sp.pause(); } catch (e) { /* nada */ } }
  function syncSP(mus) {
    spMus = mus;
    spCola = spCola.then(async () => {
      if (spMus !== mus) return;
      let api;
      try { api = await cargarSP(); } catch (e) { aviso(e.message, true); return; }
      if (!sp) {
        spUri = mus.uri;
        sp = await new Promise(res => api.createController(document.getElementById("tbReproSP"), { uri: mus.uri, width: 300, height: 80 }, c => res(c)));
        sp.addListener("playback_update", e => {
          const d = e.data || {};
          if (d.isPaused === false) marcarBloqueo(false);
          if (spMus && d.duration && d.position >= d.duration - 400 && d.isPaused) { if (spMus.bucle) { sp.seek(0); sp.resume(); } else alTerminar(); }
        });
        await new Promise(r => setTimeout(r, 600));
      } else if (spUri !== mus.uri) { spUri = mus.uri; sp.loadUri(mus.uri); await new Promise(r => setTimeout(r, 600)); }
      if (spMus !== mus) return;
      if (mus.pausado) sp.pause();
      else {
        sp.play();
        const pos = posicionDe(mus);
        if (pos > 2) setTimeout(() => { try { sp.seek(pos); } catch (e) { /* nada */ } }, 500);
      }
    });
  }
  function activarSonido() {
    marcarBloqueo(false);
    const a = document.getElementById("tbAudio");
    if (a.getAttribute("src")) a.play().catch(() => {});
    if (yt && ytMus && !ytMus.pausado) try { yt.playVideo(); } catch (e) { /* nada */ }
    if (sp && spMus && !spMus.pausado) try { sp.play(); } catch (e) { /* nada */ }
    sincronizarMusica(TB.estado.musica);
  }

  /* ---------- soundboard: efectos cortos que el DJ lanza para todos */
  function efectos() { return EFECTOS_BASE.filter(e => !(gramola().ocultos || []).includes(e.id)).concat(gramola().sonidos || []); }
  function sonar(d) {
    // Solo suenan los efectos del soundboard (el de la lista base o los que subió el DJ)
    const ef = (EFECTOS_BASE.concat(gramola().sonidos || [])).find(e => e.src === (d && d.src));
    if (!ef) return;
    const a = new Audio(ef.src);
    a.volume = Math.max(0, Math.min(1, (d.vol == null ? 0.8 : d.vol) * (TB.prefs.volumenEfectos == null ? 0.8 : TB.prefs.volumenEfectos)));
    a.play().catch(() => marcarBloqueo(true));
  }
  function lanzarEfecto(ef) {
    const d = { src: ef.src, vol: gramola().volEfectos == null ? 0.8 : gramola().volEfectos };
    sonar(d);
    TB.red.emitir("sonido", d);
  }

  /* ---------- panel */
  let filtroMusica = "", vistaGramola = "canciones", listaAbierta = null;
  function pintarGramola() {
    const c = cuerpos.gramola;
    if (!c || pestana !== "gramola") return;
    const enfoque = document.activeElement && c.contains(document.activeElement) && document.activeElement.matches("input[type=search], input[type=text]") ? document.activeElement.dataset.campo : null;
    const mus = TB.estado.musica || {};
    const gm = TB.esGM();
    const l = listaActual();
    c.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab"><h2>Gramola</h2></div>`);
    const cuerpo = el(`<div class="tb-pes-scroll" style="padding-top:0">
      ${audioBloqueado ? `<button type="button" class="tb-btn tb-btn-acento" data-activar style="width:100%;margin:8px 0">🔊 Activar el sonido en este navegador</button>` : ""}
      <div class="tb-gramola-ahora"><b>${mus.src ? "Reproduciendo" : "Nada sonando"}</b>${mus.src ? `<span class="tb-gramola-origen">${mus.tipo === "youtube" ? "YouTube" : mus.tipo === "spotify" ? "Spotify" : "Archivo"}</span>` : ""}<br>
        <span>${mus.src ? esc(mus.nombre || "Pista") + (mus.pausado ? " (en pausa)" : "") : "El DJ elige la música y suena para todos."}</span>
        ${l ? `<div class="tb-nota" style="margin-top:4px">Lista «${esc(l.nombre)}» · ${(mus.indice || 0) + 1} de ${l.pistas.length}</div>` : ""}
        ${gm && mus.src ? `<div class="tb-gramola-mandos">
            <button type="button" class="tb-btn tb-btn-mini" data-ant title="Anterior" ${l ? "" : "disabled"}>⏮</button>
            <button type="button" class="tb-btn tb-btn-mini" data-pausa title="${mus.pausado ? "Seguir" : "Pausa"}">${mus.pausado ? "▶" : "❚❚"}</button>
            <button type="button" class="tb-btn tb-btn-mini" data-sig title="Siguiente" ${l ? "" : "disabled"}>⏭</button>
            <button type="button" class="tb-btn tb-btn-mini" data-parar title="Parar">■</button>
            <label class="tb-casilla"><input type="checkbox" data-bucle${mus.bucle ? " checked" : ""}> Repetir pista</label>
            ${l ? `<label class="tb-casilla"><input type="checkbox" data-aleatorio${mus.aleatorio ? " checked" : ""}> Aleatorio</label><label class="tb-casilla"><input type="checkbox" data-replista${mus.repetirLista ? " checked" : ""}> Repetir lista</label>` : ""}</div>
          <label class="tb-campo" style="margin:8px 0 0"><span style="font-weight:400">Volumen para todos</span><input type="range" min="0" max="100" data-volgm value="${Math.round((mus.volumen == null ? 0.6 : mus.volumen) * 100)}"></label>` : ""}
        ${mus.tipo === "spotify" ? `<p class="tb-nota" style="margin:6px 0 0">Spotify suena entero solo si tienes la sesión de Spotify abierta en este navegador; si no, 30 segundos. Su volumen se ajusta en el propio reproductor.</p>` : ""}
      </div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Mi volumen de música</span><input type="range" min="0" max="100" data-vol value="${Math.round((TB.prefs.volumen == null ? 0.7 : TB.prefs.volumen) * 100)}"></label>
        <label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Mi volumen de efectos</span><input type="range" min="0" max="100" data-volef value="${Math.round((TB.prefs.volumenEfectos == null ? 0.8 : TB.prefs.volumenEfectos) * 100)}"></label></div>
      ${gm ? `<hr class="tb-sep">
        <div class="tb-campo"><span>YouTube, Spotify o un enlace a un audio</span>
          <div class="tb-fila"><input type="text" data-campo="enlace" data-enlace placeholder="Pega aquí el enlace…" style="flex:1"><button type="button" class="tb-btn tb-btn-acento" data-poner>▶</button><button type="button" class="tb-btn" data-alista title="Añadir a una lista">＋</button></div>
          <span class="tb-nota" style="font-weight:400">¿No lo tienes? <a class="tb-enlace" data-buscayt href="#">Buscar en YouTube ↗</a> · <a class="tb-enlace" data-buscasp href="#">Buscar en Spotify ↗</a></span></div>
        <div class="tb-subpestanas">${[["canciones", "Canciones"], ["listas", "Listas"], ["efectos", "Soundboard"]].map(([k, t]) => `<button type="button" data-vista="${k}" class="${vistaGramola === k ? "activo" : ""}">${t}</button>`).join("")}</div>
        <div data-vistag></div>` : `<p class="tb-nota" style="margin-top:12px">Solo el DJ elige la música y los efectos.</p>`}
    </div>`);
    c.append(cab, cuerpo);
    const q = s => cuerpo.querySelector(s);
    if (q("[data-activar]")) q("[data-activar]").addEventListener("click", activarSonido);
    q("[data-vol]").addEventListener("input", ev => {
      TB.prefs.volumen = ev.target.value / 100; TB.guardarPrefs();
      const v = volumenDe(mus);
      document.getElementById("tbAudio").volume = v;
      if (yt && yt.setVolume && mus.tipo === "youtube") yt.setVolume(Math.round(v * 100));
    });
    q("[data-volef]").addEventListener("input", ev => { TB.prefs.volumenEfectos = ev.target.value / 100; TB.guardarPrefs(); });
    if (!gm) return;
    if (q("[data-pausa]")) q("[data-pausa]").addEventListener("click", () => {
      if (mus.pausado) cambiarMusica({ pausado: false, inicio: Date.now() - (mus.pos || 0) * 1000 });
      else cambiarMusica({ pausado: true, pos: posicionDe(mus) });
    });
    if (q("[data-parar]")) q("[data-parar]").addEventListener("click", () => cambiarMusica({ src: null, nombre: null, pausado: false, lista: null }));
    if (q("[data-ant]")) q("[data-ant]").addEventListener("click", () => saltar(-1));
    if (q("[data-sig]")) q("[data-sig]").addEventListener("click", () => saltar(1));
    if (q("[data-bucle]")) q("[data-bucle]").addEventListener("change", ev => cambiarMusica({ bucle: ev.target.checked }));
    if (q("[data-aleatorio]")) q("[data-aleatorio]").addEventListener("change", ev => cambiarMusica({ aleatorio: ev.target.checked }));
    if (q("[data-replista]")) q("[data-replista]").addEventListener("change", ev => cambiarMusica({ repetirLista: ev.target.checked }));
    if (q("[data-volgm]")) q("[data-volgm]").addEventListener("change", ev => cambiarMusica({ volumen: ev.target.value / 100 }));
    const enlace = q("[data-enlace]");
    const leerEnlace = async () => {
      const p = pistaDeEnlace(enlace.value);
      if (!p) { aviso("No reconozco ese enlace. Sirven los de YouTube, Spotify o un archivo .mp3/.ogg/.wav.", true); return null; }
      p.nombre = await nombreExterno(p);
      return p;
    };
    q("[data-poner]").addEventListener("click", async () => { const p = await leerEnlace(); if (p) { reproducir(p); enlace.value = ""; } });
    enlace.addEventListener("keydown", async ev => { if (ev.key === "Enter") { const p = await leerEnlace(); if (p) { reproducir(p); enlace.value = ""; } } });
    q("[data-alista]").addEventListener("click", async ev => { const r = ev.currentTarget.getBoundingClientRect(); const p = await leerEnlace(); if (p) { menuAnadirALista(p, r.left - 160, r.bottom + 4); enlace.value = ""; } });
    q("[data-buscayt]").addEventListener("click", ev => { ev.preventDefault(); window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(enlace.value.trim() || filtroMusica || "dnd ambience"), "_blank", "noopener"); });
    q("[data-buscasp]").addEventListener("click", ev => { ev.preventDefault(); window.open("https://open.spotify.com/search/" + encodeURIComponent(enlace.value.trim() || filtroMusica || "dnd ambience"), "_blank", "noopener"); });
    cuerpo.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => { vistaGramola = b.dataset.vista; pintarGramola(); }));
    const caja = q("[data-vistag]");
    if (vistaGramola === "canciones") pintarCanciones(caja, mus);
    if (vistaGramola === "listas") pintarListas(caja, mus);
    if (vistaGramola === "efectos") pintarEfectos(caja);
    if (enfoque) { const i = cuerpo.querySelector(`[data-campo="${enfoque}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function filaPista(p, mus, extraHtml) {
    return el(`<div class="tb-gramola-pista${p.src === mus.src ? " sonando" : ""}"><span class="tb-gramola-ico">${p.tipo === "youtube" ? "▶︎ YT" : p.tipo === "spotify" ? "♫ SP" : "♪"}</span><span class="tb-gramola-nom" title="${esc(p.nombre)}">${esc(p.nombre)}</span>${extraHtml || ""}</div>`);
  }
  function pintarCanciones(caja, mus) {
    caja.innerHTML = "";
    const buscar = el(`<input type="search" data-campo="buscar" placeholder="Buscar entre todas las canciones…" style="margin:8px 0">`);
    buscar.value = filtroMusica;
    const lista = el(`<div></div>`);
    caja.append(buscar, lista);
    const pintar = () => {
      lista.innerHTML = "";
      const f = filtroMusica.trim().toLowerCase();
      const todas = pistasSitio();
      gramola().listas.forEach(l => l.pistas.forEach(p => { if (!todas.some(x => x.src === p.src)) todas.push(Object.assign({ grupo: "De tus listas" }, p)); }));
      const vis = todas.filter(p => !f || p.nombre.toLowerCase().includes(f));
      if (!vis.length) { lista.appendChild(el(`<p class="tb-lista-vacia">Nada con «${esc(filtroMusica)}». Prueba a buscarla en YouTube o Spotify y pega el enlace arriba.</p>`)); return; }
      let grupo = null;
      vis.forEach(p => {
        if (p.grupo !== grupo) { grupo = p.grupo; lista.appendChild(el(`<div class="tb-gramola-grupo">${esc(grupo)}</div>`)); }
        const fila = filaPista(p, mus, `<button type="button" class="tb-gramola-mas" title="Añadir a una lista">＋</button>`);
        fila.addEventListener("click", ev => {
          if (ev.target.closest(".tb-gramola-mas")) { menuAnadirALista(p, ev.clientX - 180, ev.clientY + 8); return; }
          reproducir(p);
        });
        lista.appendChild(fila);
      });
    };
    buscar.addEventListener("input", () => { filtroMusica = buscar.value; pintar(); });
    pintar();
  }
  function menuAnadirALista(p, x, y) {
    const g = gramola();
    menu(x, y, g.listas.map(l => ({ texto: "A «" + esc(l.nombre) + "»", accion: () => anadirALista(l.id, p) })).concat(g.listas.length ? ["-"] : [], [{ texto: "＋ Lista nueva…", accion: async () => {
      const n = await pedir("Lista nueva", "", { etiqueta: "Nombre de la lista (por ejemplo, Combate o Taberna)" });
      if (!n || !n.trim()) return;
      const l = { id: "l" + Date.now().toString(36), nombre: n.trim().slice(0, 60), pistas: [limpiaPista(p)] };
      guardarGramola({ listas: g.listas.concat([l]) });
      aviso(`Añadida a «${l.nombre}».`);
    } }]));
  }
  function anadirALista(id, p) {
    const g = gramola();
    const listas = g.listas.map(l => l.id === id ? Object.assign({}, l, { pistas: l.pistas.concat([limpiaPista(p)]).slice(0, 300) }) : l);
    guardarGramola({ listas });
    aviso("Añadida a la lista.");
  }
  function pintarListas(caja, mus) {
    caja.innerHTML = "";
    const g = gramola();
    const nueva = el(`<button type="button" class="tb-btn" style="margin:8px 0;width:100%">＋ Crear lista</button>`);
    nueva.addEventListener("click", async () => {
      const n = await pedir("Lista nueva", "", { etiqueta: "Nombre de la lista" });
      if (!n || !n.trim()) return;
      listaAbierta = "l" + Date.now().toString(36);
      guardarGramola({ listas: g.listas.concat([{ id: listaAbierta, nombre: n.trim().slice(0, 60), pistas: [] }]) });
    });
    caja.appendChild(nueva);
    if (!g.listas.length) { caja.appendChild(el(`<p class="tb-lista-vacia">Todavía no hay listas. Añade canciones con el ＋ de cada una.</p>`)); return; }
    g.listas.forEach(l => {
      const abierta = listaAbierta === l.id;
      const bloque = el(`<div class="tb-gramola-lista${mus.lista === l.id ? " sonando" : ""}">
        <div class="tb-gramola-lista-cab"><button type="button" class="tb-gramola-abrir" data-abrir>${abierta ? "▾" : "▸"} <b>${esc(l.nombre)}</b> <small>${l.pistas.length} pistas</small></button>
          <button type="button" class="tb-btn tb-btn-mini" data-tocar title="Reproducir la lista" ${l.pistas.length ? "" : "disabled"}>▶</button>
          <button type="button" class="tb-btn tb-btn-mini" data-mas title="Más">⋯</button></div>
        <div data-pistas ${abierta ? "" : "hidden"}></div></div>`);
      bloque.querySelector("[data-abrir]").addEventListener("click", () => { listaAbierta = abierta ? null : l.id; pintarGramola(); });
      bloque.querySelector("[data-tocar]").addEventListener("click", () => reproducir(l.pistas[0], { lista: l.id, indice: 0, aleatorio: false, repetirLista: true, volumen: mus.volumen }));
      bloque.querySelector("[data-mas]").addEventListener("click", ev => menu(ev.clientX - 200, ev.clientY + 8, [
        { texto: "Reproducir en orden aleatorio", apagado: !l.pistas.length, accion: () => { const i = Math.floor(Math.random() * l.pistas.length); reproducir(l.pistas[i], { lista: l.id, indice: i, aleatorio: true, repetirLista: true, volumen: mus.volumen }); } },
        { texto: "Cambiar el nombre", accion: async () => { const n = await pedir("Nombre de la lista", l.nombre); if (n && n.trim()) guardarGramola({ listas: gramola().listas.map(x => x.id === l.id ? Object.assign({}, x, { nombre: n.trim().slice(0, 60) }) : x) }); } },
        "-",
        { texto: "Borrar la lista", peligro: true, accion: async () => { if (await confirmar("Borrar lista", `¿Borrar la lista «${l.nombre}»? Las canciones no se borran.`, "Borrar")) guardarGramola({ listas: gramola().listas.filter(x => x.id !== l.id) }); } }
      ]));
      const pistas = bloque.querySelector("[data-pistas]");
      l.pistas.forEach((p, i) => {
        const fila = filaPista(p, mus, `<span class="tb-gramola-acc"><button type="button" data-a="sube" title="Subir">▲</button><button type="button" data-a="baja" title="Bajar">▼</button><button type="button" data-a="quita" title="Quitar">✕</button></span>`);
        if (mus.lista === l.id && mus.indice === i) fila.classList.add("sonando");
        fila.addEventListener("click", ev => {
          const a = ev.target.closest("[data-a]");
          if (!a) { reproducir(p, { lista: l.id, indice: i, aleatorio: !!mus.aleatorio, repetirLista: mus.repetirLista !== false, volumen: mus.volumen }); return; }
          const nuevas = l.pistas.slice();
          if (a.dataset.a === "quita") nuevas.splice(i, 1);
          else { const j = i + (a.dataset.a === "sube" ? -1 : 1); if (j < 0 || j >= nuevas.length) return; [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]]; }
          guardarGramola({ listas: gramola().listas.map(x => x.id === l.id ? Object.assign({}, x, { pistas: nuevas }) : x) });
        });
        pistas.appendChild(fila);
      });
      if (!l.pistas.length) pistas.appendChild(el(`<p class="tb-lista-vacia">Vacía. Añade canciones desde la pestaña Canciones o pegando un enlace.</p>`));
      caja.appendChild(bloque);
    });
  }
  let editandoEfectos = false;
  function pintarEfectos(caja) {
    caja.innerHTML = "";
    const g = gramola();
    const cab = el(`<div class="tb-fila" style="margin:8px 0;align-items:center">
      <label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Volumen de los efectos para todos</span><input type="range" min="0" max="100" data-v value="${Math.round((g.volEfectos == null ? 0.8 : g.volEfectos) * 100)}"></label>
      <button type="button" class="tb-btn tb-btn-mini" data-editar>${editandoEfectos ? "Listo" : "Editar"}</button></div>`);
    cab.querySelector("[data-v]").addEventListener("change", ev => guardarGramola({ volEfectos: ev.target.value / 100 }));
    cab.querySelector("[data-editar]").addEventListener("click", () => { editandoEfectos = !editandoEfectos; pintarGramola(); });
    const rejilla = el(`<div class="tb-soundboard"></div>`);
    const lista = editandoEfectos ? EFECTOS_BASE.concat(g.sonidos || []) : efectos();
    lista.forEach(ef => {
      const base = EFECTOS_BASE.some(b => b.id === ef.id);
      const oculto = base && (g.ocultos || []).includes(ef.id);
      const b = el(`<button type="button" class="tb-efecto${oculto ? " oculto" : ""}" title="${esc(ef.nombre)}"><span>${esc(ef.nombre)}</span>${editandoEfectos ? `<i>${base ? (oculto ? "mostrar" : "ocultar") : "quitar"}</i>` : ""}</button>`);
      b.addEventListener("click", () => {
        if (!editandoEfectos) { lanzarEfecto(ef); return; }
        if (base) guardarGramola({ ocultos: oculto ? (g.ocultos || []).filter(x => x !== ef.id) : (g.ocultos || []).concat([ef.id]) });
        else guardarGramola({ sonidos: (g.sonidos || []).filter(x => x.id !== ef.id) });
      });
      rejilla.appendChild(b);
    });
    const pie = el(`<div class="tb-fila" style="margin-top:10px"><label class="tb-btn" style="flex:1;cursor:pointer">＋ Subir un efecto<input type="file" accept="audio/*" hidden data-archivo></label><button type="button" class="tb-btn" style="flex:1" data-url>＋ Desde un enlace</button></div>`);
    const anadir = async (src, nombre) => {
      const n = await pedir("Nombre del efecto", nombre || "", { etiqueta: "Cómo se llama el botón" });
      if (n === null) return;
      guardarGramola({ sonidos: (gramola().sonidos || []).concat([{ id: "s" + Date.now().toString(36), nombre: (n.trim() || "Efecto").slice(0, 40), src }]).slice(0, 60) });
    };
    pie.querySelector("[data-archivo]").addEventListener("change", async ev => {
      const f = ev.target.files[0];
      ev.target.value = "";
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { aviso("Un efecto puede pesar como mucho 5 MB.", true); return; }
      try { aviso("Subiendo " + f.name + "…"); const src = await TB.red.subirImagen(f); await anadir(src, f.name.replace(/\.[^.]+$/, "")); }
      catch (e) { aviso(/mime|type/i.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para poder subir audio." : mensajeError(e), true); }
    });
    pie.querySelector("[data-url]").addEventListener("click", async () => {
      const u = await pedir("Efecto desde un enlace", "", { etiqueta: "Enlace directo a un .mp3, .ogg o .wav" });
      if (!u) return;
      const p = pistaDeEnlace(u);
      if (!p || p.tipo !== "archivo") { aviso("Tiene que ser un enlace directo a un archivo de audio.", true); return; }
      anadir(p.src, p.nombre);
    });
    caja.append(cab, rejilla, pie, el(`<p class="tb-nota">Un clic lanza el efecto para todos. Con «Editar» ocultas los de serie o quitas los tuyos.</p>`));
  }

  /* ============================================================ colecciones (macros) */
  function pintarBarraMacros() {
    const b = document.getElementById("tbMacros");
    b.innerHTML = "";
    TB.macros.filter(m => m.en_barra).sort((a, c) => (a.orden || 0) - (c.orden || 0)).forEach(m => {
      const x = el(`<button type="button" title="${esc(m.texto)}">${esc(m.nombre)}</button>`);
      x.addEventListener("click", () => ejecutarMacro(m));
      b.appendChild(x);
    });
  }
  function ejecutarMacro(m) { TB.enviarChat(m.texto, cuerpos.chat.querySelector("[data-como]").value || null); }
  function pintarColecciones() {
    const c = cuerpos.colecciones;
    c.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab"><h2>Macros</h2><button type="button" class="tb-btn" data-nueva>＋ Añadir</button></div>`);
    const lista = el(`<div class="tb-pes-scroll"><p class="tb-nota" style="margin-top:0">Una macro es un texto que se manda al chat con un clic. Puede tener varias líneas, tiradas como <b>/r 1d20+5</b> y tiradas en línea como <b>[[2d6+3]]</b>. Las marcadas como «en la barra» salen abajo del tablero.</p></div>`);
    c.append(cab, lista);
    cab.querySelector("[data-nueva]").addEventListener("click", async () => {
      try { const m = await TB.red.guardarMacro({ nombre: "Nueva macro", texto: "/r 1d20", en_barra: true, orden: TB.macros.length }); TB.macros.push(m); pintarColecciones(); pintarBarraMacros(); }
      catch (e) { aviso(mensajeError(e), true); }
    });
    TB.macros.forEach(m => {
      const caja = el(`<div style="border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:10px">
        <div class="tb-fila"><input type="text" data-n><label class="tb-casilla" style="white-space:nowrap"><input type="checkbox" data-b> En la barra</label></div>
        <textarea data-t rows="3" style="margin-top:8px;font-family:Consolas,monospace;font-size:13px"></textarea>
        <div class="tb-fila" style="justify-content:flex-end;margin-top:8px"><button type="button" class="tb-btn tb-btn-mini" data-probar>Probar</button><button type="button" class="tb-btn tb-btn-mini" data-guardar>Guardar</button><button type="button" class="tb-btn tb-btn-mini tb-btn-rojo" data-borrar>Borrar</button></div></div>`);
      caja.querySelector("[data-n]").value = m.nombre; caja.querySelector("[data-t]").value = m.texto; caja.querySelector("[data-b]").checked = !!m.en_barra;
      const leer = () => ({ id: m.id, nombre: caja.querySelector("[data-n]").value.trim().slice(0, 60) || "Macro", texto: caja.querySelector("[data-t]").value.slice(0, 2000), en_barra: caja.querySelector("[data-b]").checked });
      caja.querySelector("[data-probar]").addEventListener("click", () => ejecutarMacro(leer()));
      caja.querySelector("[data-guardar]").addEventListener("click", async () => {
        try { const n = leer(); await TB.red.guardarMacro(n); Object.assign(m, n); pintarBarraMacros(); aviso("Macro guardada."); } catch (e) { aviso(mensajeError(e), true); }
      });
      caja.querySelector("[data-borrar]").addEventListener("click", async () => {
        try { await TB.red.borrarMacro(m.id); TB.macros = TB.macros.filter(x => x.id !== m.id); pintarColecciones(); pintarBarraMacros(); } catch (e) { aviso(mensajeError(e), true); }
      });
      lista.appendChild(caja);
    });
  }

  /* ============================================================ ajustes */
  /* Lo de Roll20 que tiene sentido aquí (sin vídeo ni voz: para eso está Discord). Todo se guarda en este navegador. */
  function pintarAjustes() {
    const c = cuerpos.ajustes;
    c.innerHTML = "";
    const gm = TB.esGM();
    const P = TB.prefs;
    const scroll = el(`<div class="tb-pes-scroll"></div>`);
    const seccion = (titulo, abierta) => {
      const s = el(`<div class="tb-acordeon"><button type="button">${titulo}<span>${abierta ? "▴" : "▾"}</span></button><div class="tb-acordeon-cuerpo" ${abierta ? "" : "hidden"}></div></div>`);
      s.querySelector("button").addEventListener("click", () => { const d = s.querySelector("div"); d.hidden = !d.hidden; s.querySelector("span").textContent = d.hidden ? "▾" : "▴"; });
      scroll.appendChild(s);
      return s.querySelector(".tb-acordeon-cuerpo");
    };
    // Una fila con interruptor: ruta en prefs ("a" o "a.b"), texto y qué hacer al cambiar
    const leer = ruta => ruta.split(".").reduce((o, k) => (o == null ? o : o[k]), P);
    const escribir = (ruta, v) => { const k = ruta.split("."); let o = P; k.slice(0, -1).forEach(x => { o[x] = o[x] || {}; o = o[x]; }); o[k[k.length - 1]] = v; TB.guardarPrefs(); };
    const toggle = (caja, ruta, texto, alCambiar, nota) => {
      const t = interruptor(!!leer(ruta));
      t.input.addEventListener("change", () => { const v = t.valor(); escribir(ruta, v); if (alCambiar) alCambiar(v); });
      const f = el(`<div class="tb-fila-toggle"><span>${texto}${nota ? `<small class="tb-nota" style="display:block;font-weight:400">${nota}</small>` : ""}</span></div>`);
      f.appendChild(t.el);
      caja.appendChild(f);
    };
    const selector = (caja, ruta, texto, opciones, alCambiar) => {
      const f = el(`<label class="tb-campo"><span style="font-weight:400">${texto}</span><select>${opciones.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`);
      const s = f.querySelector("select");
      s.value = String(leer(ruta));
      s.addEventListener("change", () => { escribir(ruta, s.value); if (alCambiar) alCambiar(s.value); });
      caja.appendChild(f);
    };
    const deslizador = (caja, ruta, texto, min, max, paso, alCambiar) => {
      const f = el(`<label class="tb-campo"><span style="font-weight:400">${texto} <b data-v></b></span><input type="range" min="${min}" max="${max}" step="${paso}"></label>`);
      const r = f.querySelector("input");
      r.value = leer(ruta);
      f.querySelector("[data-v]").textContent = r.value;
      r.addEventListener("input", () => { escribir(ruta, +r.value); f.querySelector("[data-v]").textContent = r.value; if (alCambiar) alCambiar(+r.value); });
      caja.appendChild(f);
    };

    const jug = seccion("Jugadores en el tablero", true);
    toggle(jug, "avatares.ver", "Mostrar los avatares de quien está ahora en el tablero", pintarAvatares);
    deslizador(jug, "avatares.tam", "Tamaño de los avatares", 32, 120, 4, pintarAvatares);
    toggle(jug, "avatares.nombres", "Mostrar los nombres debajo de los avatares", pintarAvatares);

    const acc = seccion("Accesibilidad");
    toggle(acc, "oscuro", "Modo oscuro", aplicarAjustes);
    toggle(acc, "verZoom", "Mostrar los controles de zoom", aplicarAjustes);
    toggle(acc, "ruedaZoom", "La rueda del ratón hace zoom", aplicarAjustes, "Si lo apagas, la rueda mueve la vista y el zoom va con Ctrl + rueda.");

    const graf = seccion("Gráficos");
    toggle(graf, "decoHover", "Mostrar nombres y barras solo al pasar el ratón o al seleccionar", aplicarAjustes);
    toggle(graf, "arribaMias", "Mis fichas siempre por encima de las demás", aplicarAjustes);
    toggle(graf, "centrarMia", "Centrar la cámara en mi ficha cuando cambia la página");
    if (gm) toggle(graf, "mapaSinEncajar", "No encajar los mapas al lienzo al soltarlos en la capa del mapa", null, "Con esto apagado, un mapa soltado se ajusta al tamaño de la página.");
    toggle(graf, "sinFx", "Desactivar las animaciones de efectos", null, "Los efectos (fuego, rayos…) no se dibujan en este navegador.");
    selector(graf, "calidad", "Resolución de las texturas", [["alta", "Alta (más nítido, más trabajo para la gráfica)"], ["media", "Media"], ["baja", "Baja (para equipos modestos)"]], aplicarAjustes);
    if (gm) toggle(graf, "webp", "Optimizar las imágenes al subirlas (WebP, menos de 16 megapíxeles)", null, "Pesan menos y cargan antes para todos. Apágalo para subir el archivo original.");

    const chat = seccion("Opciones del chat de texto");
    deslizador(chat, "tamChat", "Tamaño del texto del chat", 12, 19, 0.5, v => { cuerpos.chat.querySelector(".tb-chat-lista").style.fontSize = v + "px"; });
    toggle(chat, "consejos", "Mostrar los consejos del chat", pintarMensajes);
    toggle(chat, "pitido", "Sonar un pitido con cada mensaje nuevo");
    toggle(chat, "avataresChat", "Mostrar los avatares en el chat", aplicarAjustes);
    toggle(chat, "horas", "Mostrar la hora de cada mensaje", pintarMensajes);
    if (gm) {
      const b = el(`<button type="button" class="tb-btn tb-btn-rojo" style="margin-top:8px">Vaciar el registro del chat</button>`);
      b.addEventListener("click", async () => {
        if (await confirmar("Vaciar el chat", "¿Borrar todos los mensajes y tiradas del chat para todos?", "Vaciar")) {
          try { await TB.red.vaciarChat(); TB.mensajes = []; pintarMensajes(); } catch (e) { aviso(mensajeError(e), true); }
        }
      });
      chat.appendChild(b);
    }

    const dados = seccion("Opciones de dados");
    toggle(dados, "dados.tresD", "Dados en 3D", null, "Los dados ruedan por el tablero. El resultado lo decide siempre el servidor.");
    toggle(dados, "dados.auto3D", "Lanzar en 3D también las tiradas de los demás");
    selector(dados, "dados.skin", "Aspecto de los dados", (window.TBDados3D ? TBDados3D.SKINS : [{ id: "marfil", nombre: "Marfil" }]).map(s => [s.id, s.nombre]));
    selector(dados, "dados.moneda", "Aspecto de la moneda", (window.TBDados3D ? TBDados3D.MONEDAS : [{ id: "oro", nombre: "Oro" }]).map(s => [s.id, s.nombre]));
    toggle(dados, "dados.avanzado", "Lanzador avanzado (modificadores, ventaja y explosiones en el panel de dados)");

    const atajos = seccion("Atajos de teclado");
    atajos.appendChild(el(`<table class="tb-historial tb-atajos"><tbody>
      <tr><th colspan="2">Herramientas</th></tr>
      <tr><td>Seleccionar</td><td>Ctrl + S</td></tr><tr><td>Rectángulo</td><td>Ctrl + D</td></tr><tr><td>Dibujo a mano</td><td>Ctrl + F</td></tr>
      <tr><td>Texto</td><td>Ctrl + G</td></tr><tr><td>Añadir al orden de turno</td><td>Ctrl + U</td></tr>
      ${gm ? `<tr><th colspan="2">Capas (DJ)</th></tr>
      <tr><td>Capa del mapa / fichas / DJ / delantera</td><td>Ctrl + M / O / K / .</td></tr>
      <tr><td>Mover lo seleccionado a esa capa</td><td>Ctrl + Mayús + M / O / K / .</td></tr>
      <tr><td>Páginas</td><td>P</td></tr>` : ""}
      <tr><th colspan="2">Edición</th></tr>
      <tr><td>Borrar</td><td>Supr o Retroceso</td></tr>
      <tr><td>Seleccionar todo en la capa (sin pines / con pines)</td><td>Ctrl + A / Ctrl + Mayús + A</td></tr>
      <tr><td>Copiar / pegar</td><td>Ctrl + C / Ctrl + V</td></tr>
      <tr><td>Deshacer / rehacer</td><td>Ctrl + Z / Ctrl + Y</td></tr>
      <tr><td>Mover una casilla (Mayús: un quinto)</td><td>Flechas</td></tr>
      <tr><th colspan="2">Vista</th></tr>
      <tr><td>Centrar la página</td><td>Inicio</td></tr>
      <tr><td>Mis fichas por encima (mientras se pulsa)</td><td>V</td></tr>
      <tr><td>Mover la vista</td><td>Espacio + arrastrar, clic derecho + arrastrar o la mano</td></tr>
      <tr><td>Zoom</td><td>${P.ruedaZoom === false ? "Ctrl + rueda" : "Rueda del ratón"}</td></tr>
      <tr><th colspan="2">Modificadores</th></tr>
      <tr><td>Mantener la proporción al redimensionar</td><td>Mayús</td></tr>
      <tr><td>No ajustar a la cuadrícula</td><td>Alt al soltar o al redimensionar</td></tr>
      <tr><td>Que todos vean mi cursor (mientras se pulsa)</td><td>B</td></tr>
      <tr><td>Marco de selección: solo fichas e imágenes / solo textos y dibujos</td><td>Ctrl / Alt</td></tr>
      <tr><td>Señalar (Mayús: mueve la vista de todos, DJ)</td><td>Mantener pulsado el clic</td></tr>
      <tr><td>Cerrar polígono o línea / cancelar</td><td>Doble clic o Intro / Esc</td></tr></tbody></table>`));

    const pie = el(`<div class="tb-ajustes-pie">
      ${gm ? `<button type="button" class="tb-btn tb-btn-borde ancho" data-vista>👁 ${TB.vistaJugador ? "Volver a la vista de DJ" : "Abrir vista de jugador"}</button>` : ""}
      <button type="button" class="tb-btn tb-btn-acento" data-copiar>Copiar enlace de partida</button>
      <button type="button" class="tb-btn" data-salir>Volver al compendio</button></div>`);
    c.append(scroll, pie);
    if (gm) pie.querySelector("[data-vista]").addEventListener("click", () => { document.querySelector('#tbZoom [data-z="vista"]').click(); pintarAjustes(); });
    pie.querySelector("[data-copiar]").addEventListener("click", () => {
      const u = location.href.split("?")[0];
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => aviso("Enlace copiado.")).catch(() => pedir("Enlace de la partida", u));
    });
    pie.querySelector("[data-salir]").addEventListener("click", () => { location.href = "index.html"; });
  }
  // Aplica en la página lo que se puede aplicar al momento
  function aplicarAjustes() {
    const P = TB.prefs;
    document.body.classList.toggle("tb-oscuro", !!P.oscuro);
    document.body.classList.toggle("sin-avatares-chat", P.avataresChat === false);
    document.getElementById("tbZoom").hidden = P.verZoom === false;
    if (TB.L) {
      TB.L.setOpciones({ decoHover: !!P.decoHover, ruedaZoom: P.ruedaZoom !== false, arribaMias: !!P.arribaMias });
      TB.L.setCalidad({ alta: 1.5, media: 1, baja: 0.75 }[P.calidad] || 1);
      TB.L.redibujar();
    }
    pintarAvatares();
  }

  /* ============================================================ avatares de los presentes */
  function pintarAvatares() {
    const b = document.getElementById("tbAvatares");
    if (!b || !TB) return;
    const A = Object.assign({ ver: true, tam: 56, nombres: true }, TB.prefs.avatares);
    b.hidden = !A.ver;
    if (!A.ver) return;
    const lista = (TB.presencia || []).slice().sort((x, y) => (y.gm ? 1 : 0) - (x.gm ? 1 : 0) || String(x.nombre).localeCompare(String(y.nombre)));
    b.style.setProperty("--tb-av", A.tam + "px");
    b.innerHTML = lista.map(p => {
      const nombre = p.personaje ? `${p.personaje} (${p.nombre})` : p.nombre || "?";
      const fondo = p.avatar ? `background-image:url('${esc(p.avatar)}')` : `background-color:${TB.colorJugador(p.uid)}`;
      return `<div class="tb-av${p.gm ? " gm" : ""}${p.uid === TB.yo.uid ? " yo" : ""}" title="${esc(nombre)}${p.gm ? " · DJ" : ""}">
        <span class="tb-av-img" style="${fondo};border-color:${TB.colorJugador(p.uid)}">${p.avatar ? "" : esc(String(p.nombre || "?")[0].toUpperCase())}</span>
        ${A.nombres ? `<span class="tb-av-nombre">${esc(p.gm ? "DJ" : (p.personaje || p.nombre || ""))}</span>` : ""}</div>`;
    }).join("");
  }

  /* ============================================================ reglas (ventana que se abre al pedirla) */
  let filtroReglas = "";
  function abrirReglas() {
    const v = ventana("reglas", { titulo: "Reglas", ancho: 520, alto: Math.min(680, window.innerHeight - 80), x: Math.max(80, window.innerWidth / 2 - 380), y: 50 });
    v.cuerpo.innerHTML = "";
    v.cuerpo.style.display = "flex"; v.cuerpo.style.flexDirection = "column";
    const buscar = el(`<div style="padding:10px 12px;border-bottom:1px solid var(--tb-borde)"><input type="search" placeholder="Buscar una regla (agarre, derribado, descanso…)"></div>`);
    const lista = el(`<div class="tb-reglas" style="flex:1;overflow-y:auto;padding:6px 12px 14px"></div>`);
    v.cuerpo.append(buscar, lista);
    const inp = buscar.querySelector("input");
    inp.value = filtroReglas;
    const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const pintar = () => {
      const f = norm(filtroReglas.trim());
      lista.innerHTML = "";
      (window.REGLAS || []).forEach(r => {
        const items = (r.items || []).filter(it => !f || norm(it.label + " " + it.detalle).includes(f) || norm(r.titulo).includes(f));
        if (f && !items.length && !norm(r.descripcion).includes(f)) return;
        const d = el(`<details class="tb-regla"${f ? " open" : ""}><summary>${esc(r.titulo)}</summary>
          ${r.descripcion ? `<p class="tb-nota" style="margin:6px 0 8px">${esc(r.descripcion)}</p>` : ""}
          ${items.map(it => `<div class="tb-regla-item"><b>${esc(it.label)}</b><span>${esc(it.detalle)}</span></div>`).join("")}</details>`);
        lista.appendChild(d);
      });
      if (!lista.children.length) lista.appendChild(el(`<p class="tb-lista-vacia">Nada con «${esc(filtroReglas)}».</p>`));
    };
    inp.addEventListener("input", () => { filtroReglas = inp.value; pintar(); });
    pintar();
    setTimeout(() => inp.focus(), 30);
  }
  function alternarReglas() { if (ventanas.has("reglas")) ventanas.get("reglas").cerrar(); else abrirReglas(); }

  window.TBLado = { iniciar, abrirEntrada, editarEntrada, abrirPestana, sonar, pintarAvatares, aplicarAjustes, alternarReglas };
})();

