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
    TB.on("mensaje", m => { agregarMensaje(m, true); if (pestana !== "chat") marcarNovedad("chat"); });
    TB.on("mensajes", pintarMensajes);
    TB.on("diario", () => { pintarDiario(); pintarComo(); });
    TB.on("jugadores", pintarDiario);
    TB.on("musica", sincronizarMusica);
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
      <div class="tb-msg-cuerpo">${etq ? `<span class="tb-msg-etq">${esc(etq)}</span>` : ""}${seguido ? "" : `<span class="tb-msg-nombre">${esc(m.nombre)}${emote ? "" : ":"}</span>`}${cuerpoTxt}${tirada ? TBDados.tiradaHtml(tirada) : ""}</div></div>`);
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
  let audioBloqueado = false;
  function pistas() { return (window.MUSICA || []).map(src => ({ src, nombre: decodeURIComponent(src.split("/").pop()).replace(/\.[^.]+$/, "") })); }
  function sincronizarMusica(mus) {
    const a = document.getElementById("tbAudio");
    mus = mus || {};
    a.volume = Math.max(0, Math.min(1, (mus.volumen == null ? 0.6 : mus.volumen) * (TB.prefs.volumen == null ? 0.7 : TB.prefs.volumen)));
    a.loop = !!mus.bucle;
    if (!mus.src) { a.pause(); a.removeAttribute("src"); pintarGramola(); return; }
    if (a.getAttribute("src") !== mus.src) { a.src = mus.src; }
    const pos = mus.pausado ? (mus.pos || 0) : Math.max(0, (Date.now() - (mus.inicio || Date.now())) / 1000);
    const colocar = () => {
      let p = pos;
      if (a.duration && isFinite(a.duration)) { if (mus.bucle) p = p % a.duration; else if (p >= a.duration) { a.pause(); return; } }
      if (Math.abs(a.currentTime - p) > 1.5) a.currentTime = p;
      if (mus.pausado) a.pause();
      else a.play().then(() => { if (audioBloqueado) { audioBloqueado = false; pintarGramola(); } }).catch(() => { audioBloqueado = true; pintarGramola(); });
    };
    if (a.readyState >= 1) colocar(); else a.addEventListener("loadedmetadata", colocar, { once: true });
    pintarGramola();
  }
  function cambiarMusica(c) { TB.red.actualizarEstado({ musica: Object.assign({}, TB.estado.musica || {}, c) }).catch(e => aviso(mensajeError(e), true)); }
  let filtroMusica = "";
  function pintarGramola() {
    const c = cuerpos.gramola;
    if (!c || pestana !== "gramola") return;
    const mus = TB.estado.musica || {};
    const gm = TB.esGM();
    const a = document.getElementById("tbAudio");
    c.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab"><h2>Gramola</h2></div>`);
    const cuerpo = el(`<div class="tb-pes-scroll" style="padding-top:0">
      <p style="margin:4px 0 10px;line-height:1.45">La Gramola permite al DJ reproducir música de fondo que todos pueden oír.</p>
      ${audioBloqueado ? `<button type="button" class="tb-btn tb-btn-acento" data-activar style="width:100%;margin-bottom:10px">🔊 Activar el sonido en este navegador</button>` : ""}
      <div class="tb-gramola-ahora"><b>Reproduciendo</b><br><span>${mus.src ? esc(mus.nombre || "Pista") + (mus.pausado ? " (en pausa)" : "") : "Nada, por el momento."}</span>
        ${gm && mus.src ? `<div class="tb-fila" style="margin-top:8px"><button type="button" class="tb-btn tb-btn-mini" data-pausa>${mus.pausado ? "▶ Seguir" : "❚❚ Pausa"}</button><button type="button" class="tb-btn tb-btn-mini" data-parar>■ Parar</button><label class="tb-casilla"><input type="checkbox" data-bucle${mus.bucle ? " checked" : ""}> Repetir</label></div>
          <label class="tb-campo" style="margin:8px 0 0"><span style="font-weight:400">Volumen para todos</span><input type="range" min="0" max="100" data-volgm value="${Math.round((mus.volumen == null ? 0.6 : mus.volumen) * 100)}"></label>` : ""}
      </div>
      <label class="tb-campo"><span style="font-weight:400">Mi volumen</span><input type="range" min="0" max="100" data-vol value="${Math.round((TB.prefs.volumen == null ? 0.7 : TB.prefs.volumen) * 100)}"></label>
      ${gm ? `<hr class="tb-sep"><input type="search" placeholder="Buscar pista…" data-buscar><div data-lista style="margin-top:8px"></div>` : ""}
    </div>`);
    c.append(cab, cuerpo);
    const q = s => cuerpo.querySelector(s);
    if (q("[data-activar]")) q("[data-activar]").addEventListener("click", () => { audioBloqueado = false; sincronizarMusica(TB.estado.musica); });
    q("[data-vol]").addEventListener("input", ev => { TB.prefs.volumen = ev.target.value / 100; TB.guardarPrefs(); a.volume = (mus.volumen == null ? 0.6 : mus.volumen) * TB.prefs.volumen; });
    if (gm) {
      if (q("[data-pausa]")) q("[data-pausa]").addEventListener("click", () => {
        if (mus.pausado) cambiarMusica({ pausado: false, inicio: Date.now() - (mus.pos || 0) * 1000 });
        else cambiarMusica({ pausado: true, pos: a.currentTime || 0 });
      });
      if (q("[data-parar]")) q("[data-parar]").addEventListener("click", () => cambiarMusica({ src: null, nombre: null, pausado: false }));
      if (q("[data-bucle]")) q("[data-bucle]").addEventListener("change", ev => cambiarMusica({ bucle: ev.target.checked }));
      if (q("[data-volgm]")) q("[data-volgm]").addEventListener("change", ev => cambiarMusica({ volumen: ev.target.value / 100 }));
      const buscar = q("[data-buscar]"), lista = q("[data-lista]");
      buscar.value = filtroMusica;
      const pintarLista = () => {
        lista.innerHTML = "";
        const f = filtroMusica.trim().toLowerCase();
        pistas().filter(p => !f || p.nombre.toLowerCase().includes(f)).forEach(p => {
          const it = el(`<div class="tb-gramola-pista${p.src === mus.src ? " sonando" : ""}">▶ <span>${esc(p.nombre)}</span></div>`);
          it.addEventListener("click", () => cambiarMusica({ src: p.src, nombre: p.nombre, inicio: Date.now(), pausado: false, pos: 0 }));
          lista.appendChild(it);
        });
      };
      buscar.addEventListener("input", () => { filtroMusica = buscar.value; pintarLista(); });
      pintarLista();
    }
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
  function pintarAjustes() {
    const c = cuerpos.ajustes;
    c.innerHTML = "";
    const gm = TB.esGM();
    const scroll = el(`<div class="tb-pes-scroll"></div>`);
    const seccion = (titulo, html, abierta) => {
      const s = el(`<div class="tb-acordeon"><button type="button">${titulo}<span>${abierta ? "▴" : "▾"}</span></button><div ${abierta ? "" : "hidden"}>${html}</div></div>`);
      s.querySelector("button").addEventListener("click", () => { const d = s.querySelector("div"); d.hidden = !d.hidden; s.querySelector("span").textContent = d.hidden ? "▾" : "▴"; });
      scroll.appendChild(s);
      return s;
    };
    const vista = seccion("Personalización y vista", `<label class="tb-campo"><span style="font-weight:400">Tamaño del texto del chat</span><input type="range" min="12" max="19" step="0.5" data-tamchat></label>
      <label class="tb-casilla"><input type="checkbox" data-consejos> Mostrar los consejos del chat</label>`, true);
    vista.querySelector("[data-tamchat]").value = TB.prefs.tamChat || 14.5;
    vista.querySelector("[data-tamchat]").addEventListener("input", ev => { TB.prefs.tamChat = +ev.target.value; TB.guardarPrefs(); cuerpos.chat.querySelector(".tb-chat-lista").style.fontSize = TB.prefs.tamChat + "px"; });
    vista.querySelector("[data-consejos]").checked = !!TB.prefs.consejos;
    vista.querySelector("[data-consejos]").addEventListener("change", ev => { TB.prefs.consejos = ev.target.checked; TB.guardarPrefs(); pintarMensajes(); });
    seccion("Opciones de dados", `<p class="tb-nota">Las tiradas se hacen siempre en el servidor, así que nadie puede cambiar un resultado. El modo del lanzador (Todo, DJ o Secreta) se recuerda en este navegador.</p>`);
    seccion("Atajos de teclado", `<table class="tb-historial"><tbody>
      <tr><td>Mover la vista</td><td>Espacio + arrastrar, botón central o la mano</td></tr>
      <tr><td>Zoom</td><td>Rueda del ratón</td></tr>
      <tr><td>Selección múltiple</td><td>Mayús + clic, o arrastrar un marco</td></tr>
      <tr><td>No ajustar a la cuadrícula</td><td>Alt al soltar o al redimensionar</td></tr>
      <tr><td>Mover una casilla</td><td>Flechas (Mayús: un quinto)</td></tr>
      <tr><td>Copiar / pegar</td><td>Ctrl + C / Ctrl + V (DJ)</td></tr>
      <tr><td>Deshacer</td><td>Ctrl + Z (DJ)</td></tr>
      <tr><td>Borrar</td><td>Supr</td></tr>
      <tr><td>Dibujo a mano / rectángulo</td><td>Ctrl + F / Ctrl + D</td></tr>
      <tr><td>Señalar</td><td>Mantener pulsado (Mayús: mueve la vista de todos, DJ)</td></tr>
      <tr><td>Cerrar polígono o línea</td><td>Doble clic o Intro</td></tr>
      <tr><td>Cancelar</td><td>Esc</td></tr></tbody></table>`);
    if (gm) {
      const varios = seccion("Varios", `<button type="button" class="tb-btn tb-btn-rojo" data-vaciar>Vaciar el chat</button>
        <p class="tb-nota">${TB.local ? "Estás en modo local: todo se guarda solo en este navegador." : "Las imágenes que subes van al almacenamiento del tablero en Supabase."}</p>`);
      varios.querySelector("[data-vaciar]").addEventListener("click", async () => {
        if (await confirmar("Vaciar el chat", "¿Borrar todos los mensajes y tiradas del chat para todos?", "Vaciar")) {
          try { await TB.red.vaciarChat(); TB.mensajes = []; pintarMensajes(); } catch (e) { aviso(mensajeError(e), true); }
        }
      });
    }
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

  window.TBLado = { iniciar, abrirEntrada, editarEntrada, abrirPestana };
})();
