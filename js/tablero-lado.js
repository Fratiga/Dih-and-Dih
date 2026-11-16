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
    { id: "tiradas", icono: "dado", titulo: "Tiradas de tu ficha" },
    { id: "arte", icono: "arte", titulo: "Biblioteca de arte" },
    { id: "diario", icono: "diario", titulo: "Diario" },
    { id: "compendio", icono: "compendio", titulo: "Compendio" },
    { id: "gramola", icono: "gramola", titulo: "Gramola", gm: true },
    { id: "colecciones", icono: "colecciones", titulo: "Colecciones (macros y tablas)" },
    { id: "ajustes", icono: "ajustes", titulo: "Ajustes" }
  ];

  function iniciar(tb) {
    TB = tb;
    TB.cargarTablas = cargarTablas;
    TB.tirarTabla = tirarTabla;
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
    // El ancho del panel se cambia arrastrando su borde izquierdo, como en Roll20, y se recuerda
    const ponerAncho = w => document.documentElement.style.setProperty("--tb-lado", Math.round(Math.max(260, Math.min(w, Math.min(760, window.innerWidth - 320)))) + "px");
    if (TB.prefs.anchoLado) ponerAncho(TB.prefs.anchoLado);
    document.getElementById("tbLadoAsa").addEventListener("mousedown", e => {
      e.preventDefault();
      document.body.classList.add("redimensionando-lado");
      const mover = ev => ponerAncho(window.innerWidth - ev.clientX);
      const soltar = () => {
        window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar);
        document.body.classList.remove("redimensionando-lado");
        TB.prefs.anchoLado = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tb-lado"), 10); TB.guardarPrefs();
      };
      window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
    });
    document.getElementById("tbLadoAsa").addEventListener("dblclick", () => { document.documentElement.style.removeProperty("--tb-lado"); TB.prefs.anchoLado = null; TB.guardarPrefs(); });
    document.getElementById("tbCompendioBtn").addEventListener("click", () => { if (TB.prefs.ladoPlegado) document.getElementById("tbLadoPlegar").click(); abrirPestana("compendio"); });
    construirChat();
    if (window.TBTiradas) TBTiradas.iniciar(TB);
    // Las tiradas con dados 3D aparecen en el chat cuando los dados se paran, como en Roll20
    let colaChat = Promise.resolve();
    TB.on("mensaje", m => {
      const P = TB.prefs.dados || {}, mio = m.autor === TB.yo.uid;
      const llegoOculta = document.hidden;
      const con3D = !!window.TBDados3D && m.tirada && !m.tirada.enlinea && !m.tirada.secreta && P.tresD !== false && (mio || P.auto3D !== false);
      colaChat = colaChat.then(async () => {
        // con la pestaña en segundo plano no se animan: al volver no salen todas las tiradas en fila
        if (con3D && !document.hidden && !llegoOculta) await Promise.race([TBDados3D.lanzar(m.tirada), new Promise(r => setTimeout(r, 6000))]);
        agregarMensaje(m, true);
        if (pestana !== "chat") marcarNovedad("chat");
        if (TB.prefs.pitido && !mio) pitido();
      });
    });
    // three.js se descarga en segundo plano para que la primera tirada no espere
    if (window.TBDados3D && (TB.prefs.dados || {}).tresD !== false) setTimeout(() => TBDados3D.precargar(), 4000);
    TB.on("mensajes", pintarMensajes);
    TB.on("diario", () => { pintarDiario(); pintarComo(); });
    let ordenVisto = "";
    TB.on("estado", () => { const k = JSON.stringify((TB.estado || {}).carpetas || []); if (k !== ordenVisto) { ordenVisto = k; pintarDiario(); } });
    TB.on("jugadores", pintarDiario);
    TB.on("musica", sincronizarMusica);
    TB.on("gramola", () => pintarGramola());
    TB.on("presencia", pintarAvatares);
    document.getElementById("tbReglasBtn").addEventListener("click", alternarReglas);
    const repro = document.getElementById("tbReproductor");
    repro.querySelector("[data-plegar]").addEventListener("click", () => repro.classList.toggle("plegado"));
    // Solo audio (se recuerda) y cerrar la ventana de esta pista; la música no se para
    repro.querySelector("[data-audio]").addEventListener("click", () => { TB.prefs.soloAudio = !TB.prefs.soloAudio; TB.guardarPrefs(); estadoRepro(); });
    repro.querySelector("[data-guardar]").hidden = !TB.esGM();
    repro.querySelector("[data-guardar]").addEventListener("click", ev => { const r = ev.currentTarget.getBoundingClientRect(); guardarActual(r.left - 140, r.bottom + 4); });
    repro.querySelector("[data-cerrar]").addEventListener("click", () => { reproCerrado = (TB.estado.musica || {}).src || null; estadoRepro(); });
    repro.querySelector("[data-abrir]").addEventListener("click", () => { reproCerrado = null; if (TB.prefs.soloAudio) { TB.prefs.soloAudio = false; TB.guardarPrefs(); } estadoRepro(); });
    // Barra para avanzar y retroceder en la propia ventana (solo el DJ: mueve la música de todos)
    if (TB.esGM()) {
      const barra = repro.querySelector(".tb-repro-avance"), rav = barra.querySelector("[data-rav]"), rt = barra.querySelector("[data-rt]"), rp = barra.querySelector("[data-rpausa]");
      barra.hidden = false;
      let tocando = false;
      rav.addEventListener("input", () => { tocando = true; rt.textContent = mmss(+rav.value) + " / " + mmss(duracionActual()); });
      rav.addEventListener("change", () => { tocando = false; irAPosicion(+rav.value); });
      barra.querySelectorAll("[data-rs]").forEach(b => b.addEventListener("click", () => irAPosicion(posicionDe(TB.estado.musica || {}) + Number(b.dataset.rs))));
      rp.addEventListener("click", () => {
        const m = TB.estado.musica || {};
        if (m.pausado) cambiarMusica({ pausado: false, inicio: Date.now() - (m.pos || 0) * 1000 });
        else cambiarMusica({ pausado: true, pos: posicionDe(m) });
      });
      setInterval(() => {
        const m = TB.estado.musica || {};
        if (repro.hidden || tocando || !m.src) return;
        const d = duracionActual();
        let p = posicionDe(m);
        if (d) { if (m.bucle) p = p % d; p = Math.min(p, d); }
        rav.max = d || Math.max(60, p + 30);
        rav.value = p;
        rt.textContent = mmss(p) + " / " + (d ? mmss(d) : "–:––");
        rp.textContent = m.pausado ? "▶" : "❚❚";
        rp.title = m.pausado ? "Seguir" : "Pausa";
      }, 500);
    }
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
    if (id === "tiradas" && window.TBTiradas) TBTiradas.pintar(cuerpos.tiradas);
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
      <div class="tb-chat-pie"><label>Como:</label><select data-como></select><button type="button" class="tb-btn tb-btn-gif" data-gif title="Mis GIFs">GIF</button><button type="button" class="tb-btn" data-enviar>Enviar</button></div></div>`);
    c.append(lista, entrada);
    // Estrella de los GIFs del chat: vacía si no lo tienes guardado; un clic lo guarda en «Mis GIFs» y otro lo quita
    lista.addEventListener("click", async e => {
      const b = e.target.closest(".tb-gif-estrella");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const u = b.parentNode.dataset.gif;
      if (!u || b.disabled) return;
      b.disabled = true;
      try {
        await cargarGifs();
        const g = (gifs || []).find(x => x.url === u);
        if (g) { await TB.red.borrarGif(g.id); gifs = gifs.filter(x => x.id !== g.id); aviso("Quitado de Mis GIFs."); }
        else { const n = await TB.red.agregarGif({ url: u, nombre: "" }); gifs = [n].concat(gifs || []); aviso("Guardado en Mis GIFs."); }
        marcarEstrellas();
      } catch (err) { aviso(/tablero_gifs/.test(String(err && err.message)) ? "Falta volver a correr tablero.sql para guardar GIFs." : mensajeError(err), true); }
      finally { b.disabled = false; }
    });
    cargarGifs().then(marcarEstrellas).catch(() => {});
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
    entrada.querySelector("[data-gif]").addEventListener("click", () => alternarGifs(entrada));
    // Pegar una imagen (por ejemplo, «Copiar imagen» en Discord): se sube y queda su enlace listo para mandar
    ta.addEventListener("paste", async e => {
      // Si al copiar viene también el enlace original (Discord lo pone en el HTML), se usa ese: así el GIF se mueve.
      // La imagen pegada sola es siempre una foto fija (el primer fotograma).
      const html = (e.clipboardData && e.clipboardData.getData("text/html")) || "";
      const enlaceImg = (html.match(/<img[^>]+src="([^"]+)"/i) || [])[1];
      if (enlaceImg && /^https:\/\//i.test(enlaceImg) && medioDe(enlaceImg.replace(/&amp;/g, "&"))) {
        e.preventDefault();
        ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + enlaceImg.replace(/&amp;/g, "&");
        return;
      }
      const f = [...(e.clipboardData && e.clipboardData.files || [])].find(x => /^(image|video)\//.test(x.type));
      if (!f) return;
      if (f.type === "image/png" || f.type === "image/bmp") aviso("Si era un GIF y sale quieto: en Discord usa «Copiar enlace» en vez de «Copiar imagen».");
      e.preventDefault();
      try { aviso("Subiendo la imagen…"); const url = await TB.red.subirPropio(f); ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + url; ta.focus(); }
      catch (err) { aviso(mensajeError(err), true); }
    });
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
      <li>Acciones: <b>/em</b> se esconde tras la columna${TB.esGM() ? " · Narración: <b>/desc</b> texto" : ""}</li>
      <li>Tablas aleatorias: <b>/tabla</b> nombre</li></ul>
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
    const medio = !m.tirada && !emote && !desc ? medioDe(t) : null;
    if (medio) cuerpoTxt = medio.tipo === "enlace" ? medioHtml(medio) : `<span class="tb-msg-medio-caja" data-gif="${esc(t.trim())}">${medioHtml(medio)}<button type="button" class="tb-gif-estrella${gifs && gifs.some(g => g.url === t.trim()) ? " llena" : ""}" title="Guardar en Mis GIFs">${ESTRELLA}</button></span>`;
    cuerpoTxt = cuerpoTxt.replace(/⟦(\d+)⟧/g, (x, i) => TBDados.enLineaHtml(enlinea[+i]));
    let etq = "";
    if (m.modo === "dj") etq = m.autor === TB.yo.uid && !TB.esGM() ? "Al DJ" : "Tirada / mensaje al DJ";
    if (m.modo === "secreta") etq = "Secreta";
    if (m.modo === "susurro") etq = m.autor === TB.yo.uid ? "Susurro a " + (m.para || []).map(u => TB.nombreJugador(u)).join(", ") : "Te susurra";
    const ini = (m.nombre || "?").trim()[0] || "?";
    // Sin avatar propio: la foto con la que sale en la barra de presentes, o el retrato de su personaje
    const pres = (TB.presencia || []).find(p => p.uid === m.autor) || {};
    const pj = [...TB.diario.values()].find(e => e.tipo === "personaje" && e.imagen && (e.controladores || []).includes(m.autor));
    const foto = m.avatar || pres.avatar || (pj && pj.imagen) || "";
    const av = foto ? `style="background-image:url('${esc(foto)}')"` : `style="background-color:${TB.colorJugador(m.autor)}"`;
    const nodo = el(`<div class="tb-msg ${esc(m.modo)}${seguido ? " seguido" : ""}${emote ? " emote" : ""}${desc ? " desc" : ""}">
      <span class="tb-msg-av" ${av}>${foto ? "" : esc(ini.toUpperCase())}</span>
      <div class="tb-msg-cuerpo">${TB.prefs.horas && m.creado ? `<span class="tb-msg-hora">${new Date(m.creado).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}${etq ? `<span class="tb-msg-etq">${esc(etq)}</span>` : ""}${seguido ? "" : `<span class="tb-msg-nombre">${esc(m.nombre)}${emote ? "" : ":"}</span>`}${cuerpoTxt}${tirada ? (tirada.tabla ? tablaHtml(tirada) : TBDados.tiradaHtml(tirada)) : ""}</div></div>`);
    lista.appendChild(nodo);
    if (abajo || (animado && m.autor === TB.yo.uid)) lista.scrollTop = lista.scrollHeight;
    // Cuando carga el GIF cambia el alto: que el chat siga abajo
    nodo.querySelectorAll(".tb-msg-medio").forEach(x => x.addEventListener(x.tagName === "VIDEO" ? "loadeddata" : "load", () => { if (abajo || (animado && m.autor === TB.yo.uid)) lista.scrollTop = lista.scrollHeight; }, { once: true }));
  }

  /* ============================================================ GIFs e imágenes en el chat */
  /* Un mensaje que es solo un enlace a un GIF, imagen o vídeo corto se ve en el chat. Los enlaces de Tenor (lo que
     da «Copiar enlace» en Discord) se ven con el reproductor oficial de Tenor; los de Giphy, con su imagen. */
  function medioDe(t) {
    const u = String(t || "").trim();
    if (!/^https:\/\/\S+$/i.test(u) || u.length > 1000) return null;
    let m = u.match(/^https:\/\/(?:www\.)?tenor\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?view\/\S*?-(\d{5,})(?:[?#]\S*)?$/i);
    if (m) return { tipo: "tenor", id: m[1] };
    m = u.match(/^https:\/\/(?:www\.)?giphy\.com\/(?:gifs|stickers)\/(?:\S*-)?([A-Za-z0-9]{8,})\/?(?:[?#]\S*)?$/i);
    if (m) return { tipo: "img", src: `https://media.giphy.com/media/${m[1]}/giphy.gif` };
    // Klipy (lo que usa Discord ahora): su página no se puede incrustar; sus archivos directos sí
    if (/^https:\/\/(?:www\.)?klipy\.com\/(?:gifs|clips|stickers|ai-gifs|static-memes)\/[^\s/?#]+/i.test(u)) return { tipo: "enlace", src: u, nombre: "GIF de Klipy" };
    if (/^https:\/\/[a-z0-9.-]*klipy\.com\/.+\.(gif|webp|mp4|webm|png|jpe?g)(\?\S*)?$/i.test(u)) return /\.(mp4|webm)/i.test(u) ? { tipo: "video", src: u } : { tipo: "img", src: u };
    if (/\.(mp4|webm)(\?\S*)?$/i.test(u)) return { tipo: "video", src: u };
    if (/\.(gif|png|jpe?g|webp|avif)(\?\S*)?$/i.test(u) || /^https:\/\/(media\.tenor\.com|media\d*\.giphy\.com|i\.giphy\.com|media\.discordapp\.net|cdn\.discordapp\.com|i\.imgur\.com)\//i.test(u)) return { tipo: "img", src: u };
    return null;
  }
  function medioHtml(md) {
    if (md.tipo === "tenor") return `<iframe class="tb-msg-medio tenor" src="https://tenor.com/embed/${md.id}" loading="lazy" referrerpolicy="no-referrer" allowfullscreen title="GIF de Tenor"></iframe>`;
    if (md.tipo === "video") return `<video class="tb-msg-medio" src="${esc(md.src)}" autoplay loop muted playsinline></video>`;
    if (md.tipo === "enlace") return `<a class="tb-msg-enlace" href="${esc(md.src)}" target="_blank" rel="noopener noreferrer">▶ Abrir ${esc(md.nombre || "el enlace")} ↗</a>`;
    return `<img class="tb-msg-medio" src="${esc(md.src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  // «Mis GIFs»: los favoritos de cada uno (en su cuenta). Se añaden pegando el enlace, subiendo el archivo o con la estrella del chat.
  let gifs = null, filtroGifs = "", cargandoGifs = null;
  const ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
  function cargarGifs() {
    if (gifs !== null) return Promise.resolve(gifs);
    if (!cargandoGifs) cargandoGifs = TB.red.gifs().then(l => { gifs = l || []; return gifs; }).finally(() => { cargandoGifs = null; });
    return cargandoGifs;
  }
  function marcarEstrellas() {
    const lista = cuerpos.chat && cuerpos.chat.querySelector(".tb-chat-lista");
    if (!lista) return;
    const guardados = new Set((gifs || []).map(g => g.url));
    lista.querySelectorAll(".tb-msg-medio-caja").forEach(c => {
      const b = c.querySelector(".tb-gif-estrella"), si = guardados.has(c.dataset.gif);
      b.classList.toggle("llena", si);
      b.title = si ? "Quitar de Mis GIFs" : "Guardar en Mis GIFs";
    });
  }
  async function alternarGifs(entrada) {
    let caja = entrada.querySelector(".tb-gifs");
    if (caja) { caja.remove(); return; }
    caja = el(`<div class="tb-gifs"><div class="tb-gifs-cab"><b>Mis GIFs</b><input type="search" placeholder="Buscar…" data-buscar><button type="button" class="tb-flot-cerrar" data-cerrar>✕</button></div>
      <div class="tb-gifs-rejilla" data-rejilla><p class="tb-nota">Cargando…</p></div>
      <div class="tb-gifs-pie"><input type="text" placeholder="Pega un enlace (Tenor, Giphy, Discord, .gif…)" data-url><button type="button" class="tb-btn tb-btn-mini" data-anadir>＋</button>
        <label class="tb-btn tb-btn-mini" title="Subir un GIF o una imagen">⇪<input type="file" accept="image/*,video/mp4,video/webm" hidden data-archivo></label></div>
      <p class="tb-nota tb-gifs-ayuda">En Discord: clic derecho en el GIF → Copiar enlace, y pégalo aquí. Un clic en un GIF lo manda al chat.</p></div>`);
    entrada.appendChild(caja);
    const rej = caja.querySelector("[data-rejilla]"), buscar = caja.querySelector("[data-buscar]"), url = caja.querySelector("[data-url]");
    caja.querySelector("[data-cerrar]").addEventListener("click", () => caja.remove());
    buscar.value = filtroGifs;
    const pintar = () => {
      rej.innerHTML = "";
      const f = filtroGifs.trim().toLowerCase();
      const lista = (gifs || []).filter(g => !f || (g.nombre || "").toLowerCase().includes(f) || g.url.toLowerCase().includes(f));
      if (!lista.length) { rej.appendChild(el(`<p class="tb-nota">${(gifs || []).length ? "Nada con ese nombre." : "Todavía no tienes GIFs. Pega abajo el enlace de uno."}</p>`)); return; }
      lista.forEach(g => {
        const md = medioDe(g.url);
        if (!md) return;
        const item = el(`<div class="tb-gif" title="${esc(g.nombre || "Mandar al chat")}">${medioHtml(md)}<button type="button" class="tb-gif-quitar" title="Quitar de mis GIFs">✕</button><span class="tb-gif-tapa"></span></div>`);
        item.querySelector(".tb-gif-tapa").addEventListener("click", () => { TB.enviarChat(g.url, cuerpos.chat.querySelector("[data-como]").value || null); caja.remove(); });
        item.querySelector(".tb-gif-quitar").addEventListener("click", async ev => {
          ev.stopPropagation();
          try { await TB.red.borrarGif(g.id); gifs = gifs.filter(x => x.id !== g.id); pintar(); marcarEstrellas(); } catch (e) { aviso(mensajeError(e), true); }
        });
        rej.appendChild(item);
      });
    };
    buscar.addEventListener("input", () => { filtroGifs = buscar.value; pintar(); });
    const anadir = async (u, nombre) => {
      const md = medioDe(u);
      if (!md) { aviso("Ese enlace no es un GIF ni una imagen que pueda mostrar.", true); return; }
      if (md.tipo === "enlace") { aviso("La página de Klipy no se puede incrustar. Ábrela, haz clic derecho en el GIF y copia la dirección de la imagen: ese enlace sí se mueve.", true); return; }
      try { const g = await TB.red.agregarGif({ url: u, nombre }); gifs = [g].concat(gifs || []); url.value = ""; pintar(); marcarEstrellas(); }
      catch (e) { aviso(mensajeError(e), true); }
    };
    caja.querySelector("[data-anadir]").addEventListener("click", () => anadir(url.value.trim(), ""));
    url.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); anadir(url.value.trim(), ""); } });
    caja.querySelector("[data-archivo]").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { aviso("Como mucho 15 MB.", true); return; }
      try { aviso("Subiendo…"); const u = await TB.red.subirPropio(f); await anadir(u, f.name.replace(/\.[^.]+$/, "")); } catch (err) { aviso(mensajeError(err), true); }
    });
    if (gifs === null) { try { gifs = await TB.red.gifs(); } catch (e) { gifs = []; aviso(/tablero_gifs/.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para guardar GIFs." : mensajeError(e), true); } }
    pintar();
  }

  /* ============================================================ arte (GM) */
  let filtroArte = "", tipoArte = "todo";
  const plegadasArte = new Set();
  function pintarArte() {
    const c = cuerpos.arte;
    if (!c || pestana !== "arte") return;
    if (TB.arte === null) { c.innerHTML = `<p class="tb-nota" style="padding:calc(14px * var(--tb-k))">Cargando…</p>`; TB.arte = []; TB.red.arte().then(a => { TB.arte = a || []; pintarArte(); }).catch(() => { TB.arte = []; pintarArte(); }); return; }
    c.innerHTML = "";
    const cab = el(`<div class="tb-pes-cab" style="display:block">
      <div class="tb-fila"><b style="font-weight:500">Buscar:</b><span style="flex:1"></span><select data-tipo style="width:calc(150px * var(--tb-k))"><option value="todo">Todo</option><option value="subidas">Mi biblioteca</option><option value="compendio">Del compendio</option></select></div>
      <input type="search" data-buscar style="margin-top:calc(6px * var(--tb-k))">
      <p class="tb-arte-ayuda">Arrastra para colocar el arte, <b>arrastra pulsando Alt</b> para mantener las dimensiones. Suelta aquí las imágenes de tu PC para subirlas (o encima de una carpeta para meterlas en ella). Clic derecho en una carpeta para más opciones.</p>
      <div class="tb-fila" style="justify-content:flex-end"><input type="file" accept="image/*" multiple hidden data-archivo><button type="button" class="tb-btn" data-carpeta-nueva title="Nueva carpeta">＋ Carpeta</button><button type="button" class="tb-btn" data-cargar>⬆ Cargar</button><button type="button" class="tb-btn" data-url>＋ Añadir URL</button></div></div>`);
    const gmArte = TB.esGM();
    if (!gmArte) { tipoArte = "subidas"; cab.querySelector("[data-tipo]").hidden = true; }
    const buscar = cab.querySelector("[data-buscar]"), tipo = cab.querySelector("[data-tipo]"), archivo = cab.querySelector("[data-archivo]");
    buscar.value = filtroArte; tipo.value = tipoArte;
    buscar.addEventListener("input", () => { filtroArte = buscar.value; pintarLista(); });
    tipo.addEventListener("change", () => { tipoArte = tipo.value; pintarLista(); });
    const btnCargar = cab.querySelector("[data-cargar]");
    btnCargar.addEventListener("click", () => { destinoSubida = ""; archivo.click(); });
    // Subir varias imágenes a una carpeta; la espera se ve en el botón Cargar
    let destinoSubida = "";
    async function subirArte(archivos, carpeta) {
      archivos = [...archivos].filter(f => /^image\//.test(f.type));
      if (!archivos.length) return;
      const texto = btnCargar.innerHTML;
      btnCargar.disabled = true;
      for (const [i, f] of archivos.entries()) {
        btnCargar.innerHTML = `<span class="tb-girando"></span> ${archivos.length > 1 ? `${i + 1} de ${archivos.length}` : "Subiendo…"}`;
        try { const src = await (gmArte ? TB.red.subirImagen(f) : TB.red.subirPropio(f)); const a = await TB.red.crearArte({ src, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 120), carpeta: carpeta || "" }); TB.arte.unshift(a); }
        catch (e) { aviso(/carpeta/.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para las carpetas del arte." : f.name + ": " + mensajeError(e), true); }
      }
      btnCargar.disabled = false; btnCargar.innerHTML = texto;
      if (carpeta) plegadasArte.delete(carpeta);
      pintarLista();
    }
    archivo.addEventListener("change", async () => { const l = [...archivo.files]; archivo.value = ""; await subirArte(l, destinoSubida); });
    cab.querySelector("[data-url]").addEventListener("click", async () => {
      const u = await pedir("Añadir imagen por dirección", "", { etiqueta: "Dirección de la imagen (https://…)" });
      if (!u || !/^https?:\/\//i.test(u.trim())) return;
      try { const a = await TB.red.crearArte({ src: u.trim(), nombre: decodeURIComponent(u.trim().split("/").pop().split("?")[0]).slice(0, 120) }); TB.arte.unshift(a); pintarLista(); }
      catch (e) { aviso(mensajeError(e), true); }
    });
    cab.querySelector("[data-carpeta-nueva]").addEventListener("click", () => nuevaCarpeta(""));
    const lista = el(`<div class="tb-pes-scroll tb-arte-lista"></div>`);
    c.append(cab, lista);
    // Soltar imágenes del explorador en cualquier parte del panel: van a la raíz (o a la carpeta sobre la que se suelten)
    c._subirArte = subirArte;
    if (!c._conSoltar) {
      c._conSoltar = true;
      const marca = v => { const l = c.querySelector(".tb-arte-lista"); if (l) l.classList.toggle("soltando", v); };
      c.addEventListener("dragover", ev => { if ([...ev.dataTransfer.types].includes("Files")) { ev.preventDefault(); marca(true); } });
      c.addEventListener("dragleave", ev => { if (!c.contains(ev.relatedTarget)) marca(false); });
      c.addEventListener("drop", ev => { marca(false); if (!ev.dataTransfer.files.length) return; ev.preventDefault(); c._subirArte(ev.dataTransfer.files, ""); });
    }

    // Carpetas: «Padre/Hijo» es una subcarpeta; el orden y las vacías se guardan en el estado del tablero
    const padreDe = x => (x.includes("/") ? x.slice(0, x.lastIndexOf("/")) : "");
    const hojaDe = x => x.slice(x.lastIndexOf("/") + 1);
    const leerOrdenJug = () => { try { return JSON.parse(localStorage.getItem("tbCarpetasArte:" + TB.yo.uid) || "[]"); } catch (e) { return []; } };
    const orden = () => (gmArte ? (TB.estado || {}).carpetas_arte || [] : leerOrdenJug()).filter(x => typeof x === "string" && x.trim());
    const dentro = (a, cp) => a.carpeta === cp || (a.carpeta || "").startsWith(cp + "/");
    async function guardarOrden(l) {
      if (!gmArte) { try { localStorage.setItem("tbCarpetasArte:" + TB.yo.uid, JSON.stringify([...new Set(l)].slice(0, 200))); } catch (e) { /* nada */ } pintarLista(); return; }
      TB.estado.carpetas_arte = [...new Set(l)];
      pintarLista();
      try { await TB.red.actualizarEstado({ carpetas_arte: TB.estado.carpetas_arte }); }
      catch (err) { aviso(/carpetas_arte/.test(String(err && err.message)) ? "Falta volver a correr tablero.sql para las carpetas del arte." : mensajeError(err), true); }
    }
    async function moverArte(lista, cambio) {
      for (const a of lista) {
        const c2 = cambio(a);
        try { await TB.red.actualizarArte(a.id, c2); Object.assign(a, c2); } catch (err) { aviso(/carpeta/.test(String(err && err.message)) ? "Falta volver a correr tablero.sql para las carpetas del arte." : mensajeError(err), true); return; }
      }
    }
    async function nuevaCarpeta(padre) {
      const n = await pedir(padre ? "Nueva subcarpeta" : "Nueva carpeta", "", { etiqueta: "Nombre" });
      if (!n || !n.trim()) return;
      const ruta = (padre ? padre + "/" : "") + n.trim().replace(/\//g, "-");
      if (ruta.length > 60) { aviso("El nombre completo de la carpeta no puede pasar de 60 letras.", true); return; }
      if (padre) plegadasArte.delete(padre);
      guardarOrden(orden().concat([ruta]));
    }
    async function renombrar(viejo, nuevo) {
      if (!nuevo || nuevo === viejo) return;
      if (nuevo.length > 60) { aviso("El nombre completo de la carpeta no puede pasar de 60 letras.", true); return; }
      if (nuevo.startsWith(viejo + "/")) { aviso("Una carpeta no puede ir dentro de sí misma.", true); return; }
      const mover = x => (x === viejo ? nuevo : x.startsWith(viejo + "/") ? nuevo + x.slice(viejo.length) : x);
      await moverArte(TB.arte.filter(a => dentro(a, viejo)), a => ({ carpeta: mover(a.carpeta) }));
      await guardarOrden(orden().map(mover).concat([nuevo]));
    }
    function menuCarpeta(cp, x, y) {
      const cont = TB.arte.filter(a => dentro(a, cp));
      menu(x, y, [
        { texto: "Añadir subcarpeta", accion: () => nuevaCarpeta(cp) },
        { texto: "Subir imágenes aquí…", accion: () => { destinoSubida = cp; archivo.click(); } },
        "-",
        { texto: "Ordenar de la A a la Z", accion: () => {
          const hijas = [...new Set(orden().filter(c2 => padreDe(c2) === cp).concat(cont.map(a => a.carpeta).filter(c2 => padreDe(c2) === cp)))].sort((a, b) => a.localeCompare(b));
          guardarOrden(orden().filter(c2 => padreDe(c2) !== cp).concat(hijas));
        } },
        { texto: "Renombrar carpeta", accion: async () => { const n = await pedir("Renombrar carpeta", hojaDe(cp), { etiqueta: "Nombre" }); if (n && n.trim()) renombrar(cp, (padreDe(cp) ? padreDe(cp) + "/" : "") + n.trim().replace(/\//g, "-")); } },
        { texto: "Eliminar carpeta", accion: async () => {
          const arriba = padreDe(cp), mover = x => (x === cp ? arriba : x.startsWith(cp + "/") ? (arriba ? arriba + "/" : "") + x.slice(cp.length + 1) : x);
          await moverArte(cont, a => ({ carpeta: mover(a.carpeta) }));
          guardarOrden(orden().filter(c2 => c2 !== cp).map(mover).filter(Boolean));
        } },
        { texto: "Eliminar la carpeta y su contenido", peligro: true, accion: async () => {
          if (!(await confirmar("Eliminar la carpeta", `¿Quitar «${hojaDe(cp)}» y sus ${cont.length} ${cont.length === 1 ? "imagen" : "imágenes"} de la biblioteca? Las fichas del tablero que las usan se quedan.`, "Quitar todo"))) return;
          for (const a of cont) { try { await TB.red.borrarArte(a.id); } catch (err) { aviso(mensajeError(err), true); } }
          TB.arte = TB.arte.filter(a => !dentro(a, cp));
          guardarOrden(orden().filter(c2 => !(c2 === cp || c2.startsWith(cp + "/"))));
        } }
      ]);
    }
    function item(src, nombre, arte) {
      const it = el(`<div class="tb-lista-item cuadrada" draggable="true" title="Arrastra al tablero"><img src="${esc(src)}" alt="" loading="lazy"><b>${esc(nombre || src.split("/").pop())}</b>${arte ? `<button type="button" class="tb-btn tb-btn-mini" title="Quitar de la biblioteca">✕</button>` : ""}</div>`);
      it.addEventListener("dragstart", e => { e.dataTransfer.setData("text/tablero-src", src); e.dataTransfer.setData("text/tablero-nombre", nombre || ""); if (arte) e.dataTransfer.setData("text/tablero-arte", arte.id); e.dataTransfer.effectAllowed = "copyMove"; });
      it.addEventListener("click", ev => { if (ev.target.closest("button")) return; TBPaneles.soltarEnTablero({ files: [], getData: k => (k === "text/tablero-src" ? src : k === "text/tablero-nombre" ? nombre || "" : "") }, TB.L.centroVista(), false); });
      if (arte) {
        const quitar = async () => { await TB.red.borrarArte(arte.id); TB.arte = TB.arte.filter(a => a.id !== arte.id); pintarLista(); };
        it.querySelector("button").addEventListener("click", ev => { ev.stopPropagation(); quitar(); });
        it.addEventListener("contextmenu", ev => {
          ev.preventDefault();
          menu(ev.clientX, ev.clientY, [
            { texto: "Cambiar el nombre", accion: async () => { const n = await pedir("Nombre", arte.nombre || ""); if (n === null) return; await moverArte([arte], () => ({ nombre: n.trim().slice(0, 120) })); pintarLista(); } },
            { texto: "Sacar de la carpeta", apagado: !arte.carpeta, accion: async () => { await moverArte([arte], () => ({ carpeta: "" })); pintarLista(); } },
            "-",
            { texto: "Quitar de la biblioteca", peligro: true, accion: quitar }
          ]);
        });
      }
      return it;
    }
    function pintarLista() {
      lista.innerHTML = "";
      const f = filtroArte.trim().toLowerCase();
      const ok = n => !f || String(n || "").toLowerCase().includes(f);
      if (tipoArte !== "compendio") {
        lista.appendChild(el(`<div class="tb-lista-titulo">▢ Activos cargados</div>`));
        const sub = TB.arte.filter(a => ok(a.nombre));
        const ord = orden();
        const todas = new Set(sub.filter(a => a.carpeta).map(a => a.carpeta).concat(f ? [] : ord));
        [...todas].forEach(x => { const p = x.split("/"); for (let i = 1; i < p.length; i++) todas.add(p.slice(0, i).join("/")); });
        if (!sub.length && !todas.size) lista.appendChild(el(`<p class="tb-lista-vacia">Aún no has subido nada. Usa Cargar o suelta aquí las imágenes desde tu carpeta.</p>`));
        const hijas = padre => [...todas].filter(x => padreDe(x) === padre).sort((a, b) => ((ord.indexOf(a) + 1 || 1e6) - (ord.indexOf(b) + 1 || 1e6)) || hojaDe(a).localeCompare(hojaDe(b)));
        const pintarCarpeta = (cp, destino) => {
          const abierta = !plegadasArte.has(cp) || !!f;
          const t = el(`<div class="tb-lista-carpeta" draggable="true"><i>${abierta ? "−" : "+"}</i>${esc(hojaDe(cp))}<small>${TB.arte.filter(a => dentro(a, cp)).length}</small></div>`);
          t.addEventListener("click", () => { if (plegadasArte.has(cp)) plegadasArte.delete(cp); else plegadasArte.add(cp); pintarLista(); });
          t.addEventListener("contextmenu", ev => { ev.preventDefault(); menuCarpeta(cp, ev.clientX, ev.clientY); });
          t.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/tablero-carpeta-arte", cp); ev.dataTransfer.effectAllowed = "move"; t.classList.add("arrastrando"); });
          t.addEventListener("dragend", () => t.classList.remove("arrastrando"));
          const tipo = ev => { const ts = [...ev.dataTransfer.types]; return ts.includes("Files") ? "archivos" : ts.includes("text/tablero-carpeta-arte") ? "carpeta" : ts.includes("text/tablero-arte") ? "arte" : null; };
          t.addEventListener("dragover", ev => {
            const k = tipo(ev);
            if (!k) return;
            ev.preventDefault(); ev.stopPropagation();
            const r = t.getBoundingClientRect(), y = ev.clientY - r.top;
            const zona = k !== "carpeta" ? "dentro" : y < r.height * 0.3 ? "antes" : y > r.height * 0.7 ? "despues" : "dentro";
            t.classList.toggle("soltar-antes", zona === "antes"); t.classList.toggle("soltar-despues", zona === "despues"); t.classList.toggle("soltar-dentro", zona === "dentro");
          });
          t.addEventListener("dragleave", () => t.classList.remove("soltar-antes", "soltar-despues", "soltar-dentro"));
          t.addEventListener("drop", async ev => {
            const zona = t.classList.contains("soltar-antes") ? "antes" : t.classList.contains("soltar-despues") ? "despues" : "dentro";
            t.classList.remove("soltar-antes", "soltar-despues", "soltar-dentro");
            ev.preventDefault(); ev.stopPropagation(); lista.classList.remove("soltando");
            if (ev.dataTransfer.files.length) { subirArte(ev.dataTransfer.files, cp); return; }
            const idArte = ev.dataTransfer.getData("text/tablero-arte"), movida = ev.dataTransfer.getData("text/tablero-carpeta-arte");
            if (idArte) { const a = TB.arte.find(x => x.id === idArte); if (a && a.carpeta !== cp) { await moverArte([a], () => ({ carpeta: cp })); plegadasArte.delete(cp); pintarLista(); } return; }
            if (!movida || movida === cp || cp.startsWith(movida + "/")) return;
            const destinoPadre = zona === "dentro" ? cp : padreDe(cp);
            let ruta = movida;
            if (padreDe(movida) !== destinoPadre) { ruta = (destinoPadre ? destinoPadre + "/" : "") + hojaDe(movida); await renombrar(movida, ruta); }
            if (zona === "dentro") { plegadasArte.delete(cp); pintarLista(); return; }
            const hermanas = hijas(destinoPadre).filter(x => x !== ruta);
            hermanas.splice(hermanas.indexOf(cp) + (zona === "antes" ? 0 : 1), 0, ruta);
            guardarOrden(orden().filter(x => !hermanas.includes(x)).concat(hermanas));
          });
          destino.appendChild(t);
          if (!abierta) return;
          const h = el(`<div class="tb-lista-hijos"></div>`);
          sub.filter(a => a.carpeta === cp).forEach(a => h.appendChild(item(a.src, a.nombre, a)));
          hijas(cp).forEach(x => pintarCarpeta(x, h));
          // la carpeta abierta entera recibe lo que se suelta (la subcarpeta más profunda gana, por eso se para la propagación)
          const vale = ev => { const ts = [...ev.dataTransfer.types]; return ts.includes("Files") || ts.includes("text/tablero-arte"); };
          h.addEventListener("dragover", ev => { if (!vale(ev)) return; ev.preventDefault(); ev.stopPropagation(); t.classList.add("soltar-dentro"); h.classList.add("soltando"); });
          h.addEventListener("dragleave", ev => { if (!h.contains(ev.relatedTarget)) { t.classList.remove("soltar-dentro"); h.classList.remove("soltando"); } });
          h.addEventListener("drop", async ev => {
            if (!vale(ev)) return;
            ev.preventDefault(); ev.stopPropagation();
            t.classList.remove("soltar-dentro"); h.classList.remove("soltando"); lista.classList.remove("soltando");
            if (ev.dataTransfer.files.length) { subirArte(ev.dataTransfer.files, cp); return; }
            const a = TB.arte.find(x => x.id === ev.dataTransfer.getData("text/tablero-arte"));
            if (a && a.carpeta !== cp) { await moverArte([a], () => ({ carpeta: cp })); pintarLista(); }
          });
          destino.appendChild(h);
        };
        hijas("").forEach(cp => pintarCarpeta(cp, lista));
        sub.filter(a => !a.carpeta).forEach(a => lista.appendChild(item(a.src, a.nombre, a)));
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
      ${gm ? `<div class="tb-fila" style="margin-top:calc(8px * var(--tb-k))"><button type="button" class="tb-btn" data-nuevo="personaje">＋ Personaje</button><button type="button" class="tb-btn" data-nuevo="nota">＋ Nota</button><button type="button" class="tb-btn" data-traer title="Crear personajes del diario con las fichas de «Mis personajes» de tus jugadores">De Mis personajes</button><span style="flex:1"></span><label class="tb-casilla tb-nota"><input type="checkbox" data-arch> Archivados</label></div>` : ""}</div>`);
    const buscar = cab.querySelector("[data-buscar]");
    buscar.value = filtroDiario;
    buscar.addEventListener("input", () => { filtroDiario = buscar.value; pintarLista(); });
    if (gm) {
      cab.querySelectorAll("[data-nuevo]").forEach(b => b.addEventListener("click", async () => {
        try { const e = await TB.red.crearDiario({ tipo: b.dataset.nuevo, nombre: b.dataset.nuevo === "nota" ? "Nueva nota" : "Nuevo personaje", carpeta: b.dataset.nuevo === "nota" ? "Notas" : "Personajes" }); TB.diario.set(e.id, e); editarEntrada(e.id); }
        catch (e) { aviso(mensajeError(e), true); }
      }));
      cab.querySelector("[data-traer]").addEventListener("click", traerPersonajes);
      const arch = cab.querySelector("[data-arch]");
      arch.checked = verArchivados;
      arch.addEventListener("change", () => { verArchivados = arch.checked; pintarLista(); });
    }
    const lista = el(`<div class="tb-pes-scroll"></div>`);
    c.append(cab, lista);
    // Carpetas: «Padre/Hijo» es una subcarpeta. El orden (y las carpetas vacías) se guardan en el estado del tablero.
    const padreDe = c => (c.includes("/") ? c.slice(0, c.lastIndexOf("/")) : "");
    const hojaDe = c => c.slice(c.lastIndexOf("/") + 1);
    const ordenCarpetas = () => ((TB.estado || {}).carpetas || []).filter(x => typeof x === "string" && x.trim());
    async function guardarOrden(l) {
      TB.estado.carpetas = [...new Set(l)];
      pintarLista();
      try { await TB.red.actualizarEstado({ carpetas: TB.estado.carpetas }); }
      catch (err) { aviso(/carpetas/.test(String(err && err.message)) ? "Falta volver a correr tablero.sql para guardar las carpetas." : mensajeError(err), true); }
    }
    const dentroDe = (e, cp) => e.carpeta === cp || (e.carpeta || "").startsWith(cp + "/");
    async function cambiarEntradas(lista, cambio) {
      for (const e of lista) {
        const c = cambio(e);
        try { await TB.red.actualizarDiario(e.id, c); TB.diario.set(e.id, Object.assign({}, e, c)); } catch (err) { aviso(mensajeError(err), true); }
      }
    }
    async function renombrarCarpeta(viejo, nuevo) {
      nuevo = nuevo.split("/").map(s => s.trim()).filter(Boolean).join("/");
      if (!nuevo || nuevo === viejo) return;
      if (nuevo.length > 60) { aviso("El nombre completo de la carpeta no puede pasar de 60 letras.", true); return; }
      if (nuevo.startsWith(viejo + "/")) { aviso("Una carpeta no puede ir dentro de sí misma.", true); return; }
      const mover = c => (c === viejo ? nuevo : c.startsWith(viejo + "/") ? nuevo + c.slice(viejo.length) : c);
      await cambiarEntradas([...TB.diario.values()].filter(e => dentroDe(e, viejo)), e => ({ carpeta: mover(e.carpeta) }));
      await guardarOrden(ordenCarpetas().map(mover).concat([nuevo]));
    }
    async function nuevaEntrada(tipo, carpeta) {
      try { const e = await TB.red.crearDiario({ tipo, nombre: tipo === "nota" ? "Nueva nota" : "Nuevo personaje", carpeta }); TB.diario.set(e.id, e); pintarLista(); editarEntrada(e.id); }
      catch (err) { aviso(mensajeError(err), true); }
    }
    function menuCarpeta(cp, x, y) {
      const contenido = [...TB.diario.values()].filter(e => dentroDe(e, cp));
      menu(x, y, [
        { texto: "Añadir subcarpeta", accion: async () => {
          const n = await pedir("Nueva subcarpeta", "", { etiqueta: "Nombre" });
          if (!n || !n.trim()) return;
          const ruta = cp + "/" + n.trim().replace(/\//g, "-");
          if (ruta.length > 60) { aviso("El nombre completo de la carpeta no puede pasar de 60 letras.", true); return; }
          plegadas.delete(cp);
          guardarOrden(ordenCarpetas().concat([ruta]));
        } },
        { texto: "Añadir personaje", accion: () => nuevaEntrada("personaje", cp) },
        { texto: "Añadir nota", accion: () => nuevaEntrada("nota", cp) },
        "-",
        { texto: "Ordenar de la A a la Z", accion: async () => {
          await cambiarEntradas(contenido.filter(e => e.carpeta === cp && e.orden), () => ({ orden: 0 }));
          const hijas = ordenCarpetas().filter(c => padreDe(c) === cp).concat([...new Set(contenido.map(e => e.carpeta).filter(c => padreDe(c) === cp))]);
          const resto = ordenCarpetas().filter(c => padreDe(c) !== cp);
          guardarOrden(resto.concat([...new Set(hijas)].sort((a, b) => a.localeCompare(b))));
        } },
        { texto: "Renombrar carpeta", accion: async () => {
          const n = await pedir("Renombrar carpeta", hojaDe(cp), { etiqueta: "Nombre" });
          if (n && n.trim()) renombrarCarpeta(cp, (padreDe(cp) ? padreDe(cp) + "/" : "") + n.trim().replace(/\//g, "-"));
        } },
        { texto: "Eliminar carpeta", accion: async () => {
          // Lo que tenía pasa a la carpeta de arriba
          const arriba = padreDe(cp);
          const mover = c => (c === cp ? arriba : c.startsWith(cp + "/") ? (arriba ? arriba + "/" : "") + c.slice(cp.length + 1) : c);
          await cambiarEntradas(contenido, e => ({ carpeta: mover(e.carpeta) }));
          guardarOrden(ordenCarpetas().filter(c => c !== cp).map(mover).filter(Boolean));
        } },
        { texto: "Eliminar la carpeta y su contenido", peligro: true, accion: async () => {
          if (!(await confirmar("Eliminar la carpeta", `¿Borrar «${hojaDe(cp)}» y todo lo que tiene dentro (${contenido.length} ${contenido.length === 1 ? "entrada" : "entradas"})? No se puede deshacer. Las fichas del tablero se quedan.`, "Borrar todo"))) return;
          for (const e of contenido) { try { await TB.red.borrarDiario(e.id); TB.diario.delete(e.id); } catch (err) { aviso(mensajeError(err), true); } }
          guardarOrden(ordenCarpetas().filter(c => !(c === cp || c.startsWith(cp + "/"))));
          TB.lanzar("diario");
        } }
      ]);
    }
    function menuEntrada(e, x, y) {
      menu(x, y, [
        { texto: e.ver_todos ? "Ocultar a los jugadores" : "Mostrar a los jugadores", accion: async () => {
          await cambiarEntradas([e], () => ({ ver_todos: !e.ver_todos })); pintarLista();
        } },
        { texto: "Duplicar", accion: async () => {
          const c = Object.assign({}, e); delete c.id; delete c.creado; delete c.actualizado;
          c.nombre = (e.nombre + " (copia)").slice(0, 80);
          try { const n = await TB.red.crearDiario(c); TB.diario.set(n.id, n); pintarLista(); } catch (err) { aviso(mensajeError(err), true); }
        } },
        { texto: "Copiar ID al portapapeles", accion: async () => {
          try { await navigator.clipboard.writeText(e.id); aviso("ID copiado."); } catch (err) { aviso(e.id); }
        } },
        { texto: e.archivado ? "Sacar del archivo" : "Archivar", accion: async () => { await cambiarEntradas([e], () => ({ archivado: !e.archivado })); pintarLista(); } },
        "-",
        { texto: "Quitar del juego", peligro: true, accion: async () => {
          if (!(await confirmar("Quitar del juego", `¿Borrar «${e.nombre}» del diario? Las fichas del tablero que lo representan se quedan.`, "Quitar"))) return;
          try { await TB.red.borrarDiario(e.id); TB.diario.delete(e.id); TB.lanzar("diario"); } catch (err) { aviso(mensajeError(err), true); }
        } }
      ]);
    }
    function item(e) {
      const color = (e.controladores || []).length ? TB.colorJugador(e.controladores[0]) : "#e0632e";
      const it = el(`<div class="tb-lista-item" draggable="${gm}"><span class="tb-lista-av" style="${e.imagen ? `background:url('${esc(e.imagen)}') center/cover` : `background:${e.tipo === "nota" ? "#c9b98a" : "#999"}`}"></span>
        <b>${e.tipo === "nota" ? "📜 " : ""}${esc(e.nombre)}${e.archivado ? " (archivado)" : ""}</b>${gm ? `<span class="tb-lista-punto" style="background:${color}" title="${e.ver_todos ? "Lo ven todos" : (e.ver || []).length ? "Lo ven algunos" : "Solo tú"}"></span>` : ""}</div>`);
      it.addEventListener("click", () => abrirEntrada(e.id));
      if (gm) {
        it.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/tablero-diario", e.id); ev.dataTransfer.effectAllowed = "copyMove"; });
        it.addEventListener("contextmenu", ev => { ev.preventDefault(); menuEntrada(e, ev.clientX, ev.clientY); });
      }
      return it;
    }
    function pintarLista() {
      lista.innerHTML = "";
      const f = filtroDiario.trim().toLowerCase();
      const todas = [...TB.diario.values()].filter(e => (verArchivados || !e.archivado) && (!f || e.nombre.toLowerCase().includes(f) || (e.etiquetas || []).some(t => t.toLowerCase().includes(f))))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre));
      const orden = ordenCarpetas();
      // Todas las carpetas: las de las entradas, las vacías que creó el DJ (sin filtro) y sus carpetas de arriba
      const todasCarpetas = new Set(todas.filter(e => e.carpeta).map(e => e.carpeta).concat(gm && !f ? orden : []));
      [...todasCarpetas].forEach(c => { const p = c.split("/"); for (let i = 1; i < p.length; i++) todasCarpetas.add(p.slice(0, i).join("/")); });
      if (!todas.length && !todasCarpetas.size) { lista.appendChild(el(`<p class="tb-lista-vacia">${gm ? "Crea personajes y notas con los botones de arriba." : "El DJ todavía no ha compartido nada contigo."}</p>`)); return; }
      const hijasDe = padre => [...todasCarpetas].filter(c => padreDe(c) === padre)
        .sort((a, b) => ((orden.indexOf(a) + 1 || 1e6) - (orden.indexOf(b) + 1 || 1e6)) || hojaDe(a).localeCompare(hojaDe(b)));
      todas.filter(e => !e.carpeta).forEach(e => lista.appendChild(item(e)));
      const pintarCarpeta = (cp, destino) => {
        const abierta = !plegadas.has(cp) || !!f;
        const t = el(`<div class="tb-lista-carpeta" draggable="${gm}"><i>${abierta ? "−" : "+"}</i>${esc(hojaDe(cp))}</div>`);
        t.addEventListener("click", () => { if (plegadas.has(cp)) plegadas.delete(cp); else plegadas.add(cp); pintarLista(); });
        if (gm) {
          t.addEventListener("contextmenu", ev => { ev.preventDefault(); menuCarpeta(cp, ev.clientX, ev.clientY); });
          t.addEventListener("dragstart", ev => { ev.stopPropagation(); ev.dataTransfer.setData("text/tablero-carpeta", cp); ev.dataTransfer.effectAllowed = "move"; t.classList.add("arrastrando"); });
          t.addEventListener("dragend", () => t.classList.remove("arrastrando"));
          const tipo = ev => [...ev.dataTransfer.types].find(x => x === "text/tablero-carpeta" || x === "text/tablero-diario");
          t.addEventListener("dragover", ev => {
            const k = tipo(ev);
            if (!k) return;
            ev.preventDefault(); ev.stopPropagation();
            const r = t.getBoundingClientRect(), y = ev.clientY - r.top;
            // Una carpeta: arriba o abajo la pone antes o después; en medio, dentro (como subcarpeta)
            const zona = k === "text/tablero-diario" ? "dentro" : y < r.height * 0.3 ? "antes" : y > r.height * 0.7 ? "despues" : "dentro";
            t.classList.toggle("soltar-antes", zona === "antes");
            t.classList.toggle("soltar-despues", zona === "despues");
            t.classList.toggle("soltar-dentro", zona === "dentro");
          });
          t.addEventListener("dragleave", () => t.classList.remove("soltar-antes", "soltar-despues", "soltar-dentro"));
          t.addEventListener("drop", async ev => {
            const zona = t.classList.contains("soltar-antes") ? "antes" : t.classList.contains("soltar-despues") ? "despues" : "dentro";
            t.classList.remove("soltar-antes", "soltar-despues", "soltar-dentro");
            const movida = ev.dataTransfer.getData("text/tablero-carpeta"), entrada = ev.dataTransfer.getData("text/tablero-diario");
            ev.preventDefault(); ev.stopPropagation();
            // Soltar un personaje o nota sobre una carpeta lo mete en ella
            if (entrada && !movida) {
              const e = TB.diario.get(entrada);
              if (!e || e.carpeta === cp) return;
              await cambiarEntradas([e], () => ({ carpeta: cp }));
              pintarLista();
              return;
            }
            if (!movida || movida === cp || cp.startsWith(movida + "/")) return;
            const destinoPadre = zona === "dentro" ? cp : padreDe(cp);
            let ruta = movida;
            if (padreDe(movida) !== destinoPadre) {
              ruta = (destinoPadre ? destinoPadre + "/" : "") + hojaDe(movida);
              await renombrarCarpeta(movida, ruta);
            }
            if (zona === "dentro") { plegadas.delete(cp); pintarLista(); return; }
            // Reordenar entre hermanas
            const hermanas = hijasDe(destinoPadre).filter(c => c !== ruta);
            hermanas.splice(hermanas.indexOf(cp) + (zona === "antes" ? 0 : 1), 0, ruta);
            guardarOrden(ordenCarpetas().filter(c => !hermanas.includes(c)).concat(hermanas));
          });
        }
        destino.appendChild(t);
        if (!abierta) return;
        const h = el(`<div class="tb-lista-hijos"></div>`);
        todas.filter(e => e.carpeta === cp).forEach(e => h.appendChild(item(e)));
        hijasDe(cp).forEach(sub => pintarCarpeta(sub, h));
        if (gm) {
          const vale = ev => [...ev.dataTransfer.types].includes("text/tablero-diario");
          h.addEventListener("dragover", ev => { if (!vale(ev)) return; ev.preventDefault(); ev.stopPropagation(); t.classList.add("soltar-dentro"); h.classList.add("soltando"); });
          h.addEventListener("dragleave", ev => { if (!h.contains(ev.relatedTarget)) { t.classList.remove("soltar-dentro"); h.classList.remove("soltando"); } });
          h.addEventListener("drop", async ev => {
            if (!vale(ev)) return;
            ev.preventDefault(); ev.stopPropagation();
            t.classList.remove("soltar-dentro"); h.classList.remove("soltando");
            const e = TB.diario.get(ev.dataTransfer.getData("text/tablero-diario"));
            if (e && e.carpeta !== cp) { await cambiarEntradas([e], () => ({ carpeta: cp })); pintarLista(); }
          });
        }
        destino.appendChild(h);
      };
      hijasDe("").forEach(cp => pintarCarpeta(cp, lista));
    }
    pintarLista();
  }

  // El DJ trae al diario las fichas de «Mis personajes»: nombre, retrato, quién lo controla y el enlace a la ficha
  async function traerPersonajes() {
    const [fichas, jugadores] = await Promise.all([TB.red.fichas(), TB.red.jugadores().catch(() => [])]);
    const nombreDe = uid => (jugadores.find(j => j.uid === uid) || {}).nombre || "Jugador";
    const ya = new Set([...TB.diario.values()].map(e => e.ficha).filter(Boolean));
    fichas.sort((a, b) => nombreDe(a.owner).localeCompare(nombreDe(b.owner)) || a.nombre.localeCompare(b.nombre));
    const c = el(`<div>${fichas.length ? `<p class="tb-nota" style="margin-top:0">Se crea un personaje por ficha, con su retrato. Lo controla y lo ve su dueño.</p>
      <div class="tb-traer-lista">${fichas.map(f => `<label class="tb-traer-item${ya.has(f.id) ? " ya" : ""}"><input type="checkbox" value="${esc(f.id)}"${ya.has(f.id) ? " disabled" : ""}>
        <span class="tb-lista-av" style="${f.retrato ? `background:url('${esc(f.retrato)}') center/cover` : "background:#999"}"></span>
        <span><b>${esc(f.nombre)}</b><small>${esc([f.raza, f.clase, f.nivel ? "nivel " + f.nivel : ""].filter(Boolean).join(" · "))}</small></span>
        <em>${ya.has(f.id) ? "Ya está en el diario" : esc(nombreDe(f.owner))}</em></label>`).join("")}</div>` : `<p class="tb-nota">Tus jugadores todavía no tienen fichas en «Mis personajes».</p>`}</div>`);
    modal({ titulo: "Traer de «Mis personajes»", cuerpo: c, ancho: 520, aceptar: fichas.length ? "Traer al diario" : null, alAceptar: async () => {
      const marcadas = [...c.querySelectorAll("input:checked")].map(i => fichas.find(f => f.id === i.value)).filter(Boolean);
      if (!marcadas.length) { aviso("Marca al menos una ficha."); return false; }
      const boton = document.querySelector(".tb-modal [data-aceptar]");
      if (boton) boton.innerHTML = '<span class="tb-girando"></span> Trayendo…';
      for (const f of marcadas) {
        let imagen = f.retrato || "";
        // Los retratos guardados dentro de la ficha se suben al almacén del tablero (el diario solo guarda enlaces)
        if (imagen.startsWith("data:")) {
          try { const b = await (await fetch(imagen)).blob(); imagen = await TB.red.subirImagen(new File([b], "retrato." + ((b.type.split("/")[1] || "png").replace("jpeg", "jpg")), { type: b.type })); }
          catch (e) { imagen = ""; }
        }
        if (imagen.length > 1000) imagen = "";
        const e = await TB.red.crearDiario({ tipo: "personaje", nombre: f.nombre.slice(0, 80), imagen, carpeta: "Personajes", controladores: [f.owner], ver: [f.owner], ficha: f.id,
          etiquetas: [f.raza, f.clase].filter(Boolean).map(t => String(t).slice(0, 40)) });
        TB.diario.set(e.id, e);
      }
      aviso(marcadas.length === 1 ? "Personaje añadido al diario." : marcadas.length + " personajes añadidos al diario.");
      pintarDiario();
    } });
  }

  async function abrirEntrada(id) {
    const e = TB.diario.get(id);
    if (!e) return;
    const gm = TB.esGM();
    const v = ventana("diario-" + id, { titulo: esc(e.nombre), ancho: 520, alto: 560, x: Math.max(80, window.innerWidth - 1000), y: 70 });
    v.cuerpo.innerHTML = "";
    const c = el(`<div style="padding:calc(16px * var(--tb-k))">
      <div class="tb-fila" style="align-items:flex-start;gap:calc(16px * var(--tb-k))">
        ${e.imagen ? `<img src="${esc(e.imagen)}" alt="" style="width:${e.tipo === "nota" ? "100%" : "150px"};${e.tipo === "nota" ? "" : "height:150px;border-radius:50%;"}object-fit:cover;flex:none">` : ""}
        ${e.tipo === "personaje" ? `<div><h2 style="margin:calc(4px * var(--tb-k)) 0 calc(6px * var(--tb-k));font-size:calc(22px * var(--tb-k))">${esc(e.nombre)}</h2>${(e.etiquetas || []).length ? `<p class="tb-nota">${e.etiquetas.map(esc).join(" · ")}</p>` : ""}
          ${(e.controladores || []).length ? `<p class="tb-nota">Lo controla: ${e.controladores.map(u => esc(TB.nombreJugador(u))).join(", ")}</p>` : ""}
          ${e.ficha && (gm || (e.controladores || []).includes(TB.yo.uid)) ? `<a class="tb-btn" href="fichas.html?ficha=${encodeURIComponent(e.ficha)}" target="_blank" rel="noopener">Abrir la hoja de personaje ↗</a>` : ""}</div>` : ""}
      </div>
      <h4 style="margin:calc(16px * var(--tb-k)) 0 calc(6px * var(--tb-k))">${e.tipo === "nota" ? "Contenido" : "Biografía e información"}</h4>
      <div class="tb-contenido-rico">${limpiarHtml(e.texto) || `<p class="tb-nota">Sin texto.</p>`}</div>
      ${gm ? `<h4 style="margin:calc(16px * var(--tb-k)) 0 calc(6px * var(--tb-k))">Notas del DJ</h4><div class="tb-contenido-rico" data-gm><p class="tb-nota">Cargando…</p></div>` : ""}
    </div>`);
    v.cuerpo.appendChild(c);
    if (gm) {
      const pie = el(`<div class="tb-fila"><button type="button" class="tb-btn" data-hablar>Mostrar a los jugadores</button><button type="button" class="tb-btn tb-btn-azul" data-editar>Editar</button></div>`);
      pie.style.cssText = "padding:calc(10px * var(--tb-k)) calc(16px * var(--tb-k));border-top:1px solid #ddd;justify-content:flex-end";
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
      <div style="display:grid;grid-template-columns:calc(300px * var(--tb-k)) 1fr;gap:calc(24px * var(--tb-k))">
        <div><div class="tb-etq" style="margin-bottom:calc(6px * var(--tb-k))">${esPj ? "Avatar" : "Imagen"}</div><div data-avatar></div>
          ${esPj ? `<div class="tb-etq" style="margin:calc(16px * var(--tb-k)) 0 calc(6px * var(--tb-k))">Token predeterminado (opcional)</div>
            <div data-token class="tb-token-zona" title="Suelta aquí una imagen, o haz clic para subirla"><span>Suelta una imagen o haz clic</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div>
            <button type="button" class="tb-btn" data-tok="avatar" style="width:100%;margin-bottom:calc(8px * var(--tb-k))">Usar el avatar como token</button>
            <div style="display:flex;flex-direction:column;gap:calc(8px * var(--tb-k))">
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
          ${esPj ? `<label class="tb-casilla" style="margin-top:calc(16px * var(--tb-k));justify-content:space-between;width:100%"><span>Miembro del grupo:</span><input type="checkbox" data-grupo></label>` : ""}
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
      const pintarTok = () => {
        const s = (e.token && e.token.datos && e.token.datos.src) || "";
        tok.style.backgroundImage = s ? `url('${s.replace(/'/g, "%27")}')` : "";
        tok.classList.toggle("vacia", !s);
      };
      pintarTok();
      // Token con una imagen: una casilla, su nombre y, si tiene hoja de «Mis personajes», la barra 1 enlazada a sus PV
      const ponerImagenToken = async src => {
        if (!src) return;
        const t = TB.L.tamCelda();
        const datos = Object.assign({ nombre: q("[data-nombre]").value.trim() || e.nombre }, e.token && e.token.datos, { src, representa: id });
        const fichaId = q("[data-ficha]").value || e.ficha;
        if (fichaId && !((datos.barras || [])[0] || {}).enlace) {
          const f = (TB.fichas || []).find(x => x.id === fichaId), c = (f && f.combate) || {};
          const barras = (datos.barras || []).slice();
          barras[0] = Object.assign({ ver: true, editar: true, texto: "editores" }, barras[0], { enlace: fichaId, valor: Number(c.pvActual) || 0, max: Number(c.pvMax) || 0 });
          datos.barras = barras;
        }
        e.token = { ancho: (e.token && e.token.ancho) || t, alto: (e.token && e.token.alto) || t, datos };
        try { await TB.red.actualizarDiario(id, { token: e.token }); pintarTok(); aviso("Token predeterminado guardado."); }
        catch (err) { aviso(mensajeError(err), true); }
      };
      const archTok = tok.querySelector("input[type=file]");
      tok.addEventListener("click", () => archTok.click());
      archTok.addEventListener("change", async () => {
        const f = archTok.files[0]; archTok.value = "";
        if (!f || !/^image\//.test(f.type)) return;
        try { aviso("Subiendo…"); await ponerImagenToken(await TB.red.subirImagen(f)); } catch (err) { aviso(mensajeError(err), true); }
      });
      tok.addEventListener("dragover", ev => { ev.preventDefault(); tok.classList.add("soltando"); });
      tok.addEventListener("dragleave", () => tok.classList.remove("soltando"));
      tok.addEventListener("drop", async ev => {
        ev.preventDefault(); tok.classList.remove("soltando");
        const f = ev.dataTransfer.files[0];
        if (f && /^image\//.test(f.type)) { try { aviso("Subiendo…"); await ponerImagenToken(await TB.red.subirImagen(f)); } catch (err) { aviso(mensajeError(err), true); } return; }
        const u = (ev.dataTransfer.getData("text/tablero-src") || ev.dataTransfer.getData("text/uri-list") || "").trim();
        if (/^(https:\/\/|data:image\/)/.test(u)) ponerImagenToken(u);
      });
      cuerpo.querySelectorAll("[data-tok]").forEach(b => b.addEventListener("click", async () => {
        const a = b.dataset.tok;
        if (a === "editar") { TBUI.cerrarModal(); TBPaneles.ajustesFicha(null, { diario: id }); return; }
        if (a === "avatar") { const s = avatar.valor(); if (!s) { aviso("Este personaje todavía no tiene avatar."); return; } ponerImagenToken(s); return; }
        const sel = TB.L.seleccion().map(s => TB.L.objeto(s)).filter(o => o && o.tipo === "imagen");
        if (!sel.length) { aviso("No hay ninguna ficha seleccionada. Cierra esta ventana, selecciona la ficha en el tablero y vuelve a abrirla.", true); return; }
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
      c.innerHTML = `<div class="tb-pes-cab" style="display:block"><h2 style="font-size:calc(21px * var(--tb-k));font-weight:500;margin:0 0 calc(8px * var(--tb-k))">Compendio</h2><input type="search" placeholder="Buscar criaturas, lugares, objetos, personajes…" data-buscar></div><div class="tb-pes-scroll" data-res><p class="tb-nota">Cargando el compendio…</p></div>`;
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
        v.cuerpo.innerHTML = `<div style="padding:calc(16px * var(--tb-k)) calc(20px * var(--tb-k))" class="tb-contenido-rico"><p class="tb-nota">${esc(cat)}${it.summary ? " · " + esc(it.summary) : ""}</p>${it.content || ""}</div>`;
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
    estadoRepro();
    document.querySelector("#tbReproductor .tb-repro-yt").hidden = tipo !== "youtube";
    document.querySelector("#tbReproductor .tb-repro-sp").hidden = tipo !== "spotify";
    const cab = document.querySelector("#tbReproductor .tb-repro-nombre");
    if (cab) cab.textContent = mus.nombre || "";
    pintarGramola();
  }
  let reproCerrado = null;
  function estadoRepro() {
    const r = document.getElementById("tbReproductor"), mus = TB.estado.musica || {};
    const cerrado = !!mus.src && reproCerrado === mus.src;
    r.classList.toggle("solo-audio", !cerrado && !!TB.prefs.soloAudio && mus.tipo === "youtube");
    r.classList.toggle("cerrado", cerrado);
    const b = r.querySelector("[data-audio]");
    b.hidden = mus.tipo !== "youtube";
    b.textContent = TB.prefs.soloAudio ? "🎬" : "🎵";
    b.title = TB.prefs.soloAudio ? "Ver el vídeo" : "Solo audio: esconde el vídeo y sigue sonando";
  }
  function marcarBloqueo(v) {
    if (audioBloqueado === v) return;
    audioBloqueado = v;
    pintarGramola();
    // El navegador no deja sonar nada hasta que se toca la página: un botón a la vista para activarlo
    let b = document.getElementById("tbActivarSonido");
    if (!b) {
      b = el(`<button type="button" class="tb-activar-sonido" id="tbActivarSonido" hidden>🔊 Activar el sonido</button>`);
      b.addEventListener("click", activarSonido);
      document.body.appendChild(b);
    }
    b.hidden = !v;
  }
  function aplicarVolumen() {
    const mus = TB.estado.musica || {}, v = volumenDe(mus);
    document.getElementById("tbAudio").volume = v;
    if (yt && yt.setVolume && mus.tipo === "youtube") try { yt.setVolume(Math.round(v * 100)); } catch (e) { /* nada */ }
  }

  // Archivos de audio
  let audioPreparado = false;
  function pararAudio() { const a = document.getElementById("tbAudio"); a.pause(); a.removeAttribute("src"); }
  function syncAudio(mus) {
    const a = document.getElementById("tbAudio");
    if (!audioPreparado) { audioPreparado = true; a.addEventListener("ended", alTerminar); }
    a.volume = volumenDe(mus);
    a.loop = !!mus.bucle;
    if (a.getAttribute("src") !== mus.src) { a.preload = "auto"; a.src = mus.src; a.load(); }
    const colocar = () => {
      if (a.getAttribute("src") !== mus.src) return;
      let p = posicionDe(mus);
      if (a.duration && isFinite(a.duration)) { if (mus.bucle) p = p % a.duration; else if (p >= a.duration) { a.pause(); return; } }
      if (Math.abs(a.currentTime - p) > 1.5) a.currentTime = p;
    };
    if (a.readyState >= 1) colocar(); else a.addEventListener("loadedmetadata", colocar, { once: true });
    if (mus.pausado) a.pause();
    else a.play().then(() => marcarBloqueo(false)).catch(err => { if (err && err.name === "NotAllowedError") marcarBloqueo(true); else if (err && err.name !== "AbortError") aviso("No se pudo reproducir «" + (mus.nombre || "la pista") + "».", true); });
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
          if (d.duration) spDuracion = d.duration / 1000;
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
  const sonando = new Set();
  function pararEfectos() { sonando.forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) { /* nada */ } }); sonando.clear(); }
  function sonar(d) {
    if (d && d.parar) { pararEfectos(); return; }
    // Solo suenan los efectos del soundboard (el de la lista base o los que subió el DJ)
    const ef = (EFECTOS_BASE.concat(gramola().sonidos || [])).find(e => e.src === (d && d.src));
    if (!ef) return;
    const a = new Audio(ef.src);
    sonando.add(a);
    a.addEventListener("ended", () => sonando.delete(a));
    a.volume = Math.max(0, Math.min(1, (d.vol == null ? 0.8 : d.vol) * (TB.prefs.volumenEfectos == null ? 0.8 : TB.prefs.volumenEfectos)));
    a.play().catch(() => marcarBloqueo(true));
  }
  function lanzarEfecto(ef) {
    const d = { src: ef.src, vol: gramola().volEfectos == null ? 0.8 : gramola().volEfectos };
    sonar(d);
    TB.red.emitir("sonido", d);
  }

  // Duración de lo que suena (archivo, YouTube o Spotify) y formato m:ss
  let spDuracion = 0;
  function irAPosicion(s) {
    const mus = TB.estado.musica || {}, d = duracionActual();
    s = Math.max(0, d ? Math.min(s, d - 0.5) : s);
    if (mus.pausado) cambiarMusica({ pos: s });
    else cambiarMusica({ inicio: Date.now() - s * 1000 });
  }
  function duracionActual() {
    const m = TB.estado.musica || {};
    if (m.tipo === "youtube") return yt && yt.getDuration ? yt.getDuration() || 0 : 0;
    if (m.tipo === "spotify") return spDuracion;
    const a = document.getElementById("tbAudio");
    return a.duration && isFinite(a.duration) ? a.duration : 0;
  }
  const mmss = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

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
      ${audioBloqueado ? `<button type="button" class="tb-btn tb-btn-acento" data-activar style="width:100%;margin:calc(8px * var(--tb-k)) 0">🔊 Activar el sonido en este navegador</button>` : ""}
      <div class="tb-gramola-ahora"><b>${mus.src ? "Reproduciendo" : "Nada sonando"}</b>${mus.src ? `<span class="tb-gramola-origen">${mus.tipo === "youtube" ? "YouTube" : mus.tipo === "spotify" ? "Spotify" : "Archivo"}</span>` : ""}<br>
        <span>${mus.src ? esc(mus.nombre || "Pista") + (mus.pausado ? " (en pausa)" : "") : "El DJ elige la música y suena para todos."}</span>
        ${l ? `<div class="tb-nota" style="margin-top:calc(4px * var(--tb-k))">Lista «${esc(l.nombre)}» · ${(mus.indice || 0) + 1} de ${l.pistas.length}</div>` : ""}
        ${gm && mus.src ? `<div class="tb-gramola-mandos">
            <button type="button" class="tb-btn tb-btn-mini" data-ant title="Anterior" ${l ? "" : "disabled"}>⏮</button>
            <button type="button" class="tb-btn tb-btn-mini" data-pausa title="${mus.pausado ? "Seguir" : "Pausa"}">${mus.pausado ? "▶" : "❚❚"}</button>
            <button type="button" class="tb-btn tb-btn-mini" data-sig title="Siguiente" ${l ? "" : "disabled"}>⏭</button>
            <button type="button" class="tb-btn tb-btn-mini" data-parar title="Parar">■</button>
            <button type="button" class="tb-btn tb-btn-mini" data-guardar-actual title="Guardar lo que suena en una lista">＋ A una lista</button>
            <label class="tb-casilla"><input type="checkbox" data-bucle${mus.bucle ? " checked" : ""}> Repetir pista</label>
            ${l ? `<label class="tb-casilla"><input type="checkbox" data-aleatorio${mus.aleatorio ? " checked" : ""}> Aleatorio</label><label class="tb-casilla"><input type="checkbox" data-replista${mus.repetirLista ? " checked" : ""}> Repetir lista</label>` : ""}</div>
          <div class="tb-gramola-avance"><button type="button" class="tb-btn tb-btn-mini" data-salto="-10" title="Atrás 10 segundos">−10 s</button><span data-t-actual>0:00</span>
            <input type="range" min="0" max="1" step="0.5" value="0" data-avance><span data-t-total>0:00</span><button type="button" class="tb-btn tb-btn-mini" data-salto="10" title="Adelante 10 segundos">+10 s</button></div>
          <label class="tb-campo" style="margin:calc(8px * var(--tb-k)) 0 0"><span style="font-weight:400">Volumen para todos</span><input type="range" min="0" max="100" data-volgm value="${Math.round((mus.volumen == null ? 0.6 : mus.volumen) * 100)}"></label>` : ""}
        ${mus.tipo === "spotify" ? `<p class="tb-nota" style="margin:calc(6px * var(--tb-k)) 0 0">Spotify suena entero solo si tienes la sesión de Spotify abierta en este navegador; si no, 30 segundos. Su volumen se ajusta en el propio reproductor.</p>` : ""}
      </div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Mi volumen de música</span><input type="range" min="0" max="100" data-vol value="${Math.round((TB.prefs.volumen == null ? 0.7 : TB.prefs.volumen) * 100)}"></label>
        <label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Mi volumen de efectos</span><input type="range" min="0" max="100" data-volef value="${Math.round((TB.prefs.volumenEfectos == null ? 0.8 : TB.prefs.volumenEfectos) * 100)}"></label></div>
      ${gm ? `<hr class="tb-sep">
        <div class="tb-campo"><span>YouTube, Spotify o un enlace a un audio</span>
          <div class="tb-fila"><input type="text" data-campo="enlace" data-enlace placeholder="Pega aquí el enlace…" style="flex:1"><button type="button" class="tb-btn tb-btn-acento" data-poner>▶</button><button type="button" class="tb-btn" data-alista title="Añadir a una lista">＋</button><label class="tb-btn" data-subirmus title="Subir canciones de tu PC (mp3, ogg, wav…) y añadirlas a una lista">⇪ Subir<input type="file" accept="audio/*" multiple hidden></label></div>
          <span class="tb-nota" style="font-weight:400">¿No lo tienes? <a class="tb-enlace" data-buscayt href="#">Buscar en YouTube ↗</a> · <a class="tb-enlace" data-buscasp href="#">Buscar en Spotify ↗</a></span></div>
        <div class="tb-subpestanas">${[["canciones", "Canciones"], ["listas", "Listas"], ["efectos", "Soundboard"]].map(([k, t]) => `<button type="button" data-vista="${k}" class="${vistaGramola === k ? "activo" : ""}">${t}</button>`).join("")}</div>
        <div data-vistag></div>` : `<p class="tb-nota" style="margin-top:calc(12px * var(--tb-k))">Solo el DJ elige la música y los efectos.</p>`}
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
    const avance = q("[data-avance]");
    if (avance) {
      let tocando = false;
      const irA = irAPosicion;
      avance.addEventListener("input", () => { tocando = true; q("[data-t-actual]").textContent = mmss(+avance.value); });
      avance.addEventListener("change", () => { tocando = false; irA(+avance.value); });
      cuerpo.querySelectorAll("[data-salto]").forEach(b => b.addEventListener("click", () => irA(posicionDe(TB.estado.musica || {}) + Number(b.dataset.salto))));
      const refrescar = () => {
        if (!avance.isConnected) { clearInterval(reloj); return; }
        if (tocando) return;
        const d = duracionActual(), m = TB.estado.musica || {};
        let p = posicionDe(m);
        if (d) { if (m.bucle) p = p % d; p = Math.min(p, d); }
        avance.max = d || Math.max(60, p + 30);
        avance.value = p;
        q("[data-t-actual]").textContent = mmss(p);
        q("[data-t-total]").textContent = d ? mmss(d) : "–:––";
      };
      const reloj = setInterval(refrescar, 500);
      refrescar();
    }
    if (q("[data-pausa]")) q("[data-pausa]").addEventListener("click", () => {
      if (mus.pausado) cambiarMusica({ pausado: false, inicio: Date.now() - (mus.pos || 0) * 1000 });
      else cambiarMusica({ pausado: true, pos: posicionDe(mus) });
    });
    if (q("[data-parar]")) q("[data-parar]").addEventListener("click", () => cambiarMusica({ src: null, nombre: null, pausado: false, lista: null }));
    if (q("[data-guardar-actual]")) q("[data-guardar-actual]").addEventListener("click", ev => { const r = ev.currentTarget.getBoundingClientRect(); guardarActual(r.left, r.bottom + 4); });
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
    const subirMus = q("[data-subirmus]");
    subirMus.querySelector("input").addEventListener("change", async ev => {
      const archivos = [...ev.target.files]; ev.target.value = "";
      const r = subirMus.getBoundingClientRect();
      const pistas = await subirAudios(archivos, subirMus);
      if (pistas.length) menuAnadirALista(pistas, r.left - 160, r.bottom + 4);
    });
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
    const buscar = el(`<input type="search" data-campo="buscar" placeholder="Buscar entre todas las canciones…" style="margin:calc(8px * var(--tb-k)) 0">`);
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
  // Lo que está sonando (un vídeo de YouTube pegado, por ejemplo) se guarda en una lista
  function guardarActual(x, y) {
    const m = TB.estado.musica || {};
    if (!m.src) { aviso("No está sonando nada."); return; }
    menuAnadirALista(limpiaPista(m), x, y);
  }
  async function subirAudios(archivos, boton) {
    archivos = archivos.filter(f => /^audio\//.test(f.type) || /\.(mp3|ogg|oga|wav|m4a|aac|opus)$/i.test(f.name));
    if (!archivos.length) return [];
    const grandes = archivos.filter(f => f.size > 15 * 1024 * 1024);
    if (grandes.length) aviso("Cada canción puede pesar como mucho 15 MB: " + grandes.map(f => f.name).join(", ") + " no se sube.", true);
    archivos = archivos.filter(f => f.size <= 15 * 1024 * 1024);
    const antes = boton ? boton.innerHTML : "";
    const entrada = boton && boton.querySelector("input");
    if (boton) { boton.classList.add("ocupado"); boton.innerHTML = '<span class="tb-girando"></span> Subiendo…'; if (entrada) boton.appendChild(entrada); }
    const pistas = [];
    for (const [i, f] of archivos.entries()) {
      if (boton && archivos.length > 1) boton.firstChild.nextSibling.textContent = ` Subiendo ${i + 1} de ${archivos.length}…`;
      try { pistas.push({ tipo: "archivo", src: await TB.red.subirImagen(f), nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 80) }); }
      catch (e) { aviso(/mime|type/i.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para poder subir audio." : f.name + ": " + mensajeError(e), true); }
    }
    if (boton) { boton.classList.remove("ocupado"); boton.innerHTML = antes; if (entrada) { const nueva = boton.querySelector("input"); if (nueva) nueva.replaceWith(entrada); } }
    return pistas;
  }
  function menuAnadirALista(p, x, y) {
    const g = gramola(), varias = Array.isArray(p) ? p : [p];
    menu(x, y, g.listas.map(l => ({ texto: "A «" + esc(l.nombre) + "»", accion: () => anadirALista(l.id, varias) })).concat(g.listas.length ? ["-"] : [], [{ texto: "＋ Lista nueva…", accion: async () => {
      const n = await pedir("Lista nueva", "", { etiqueta: "Nombre de la lista (por ejemplo, Combate o Taberna)" });
      if (!n || !n.trim()) return;
      const l = { id: "l" + Date.now().toString(36), nombre: n.trim().slice(0, 60), pistas: varias.map(limpiaPista) };
      guardarGramola({ listas: g.listas.concat([l]) });
      aviso(`Añadida a «${l.nombre}».`);
    } }]));
  }
  function anadirALista(id, p) {
    const g = gramola(), varias = (Array.isArray(p) ? p : [p]).map(limpiaPista);
    const listas = g.listas.map(l => l.id === id ? Object.assign({}, l, { pistas: l.pistas.concat(varias).slice(0, 300) }) : l);
    guardarGramola({ listas });
    aviso(varias.length === 1 ? "Añadida a la lista." : varias.length + " canciones añadidas a la lista.");
  }
  function pintarListas(caja, mus) {
    caja.innerHTML = "";
    const g = gramola();
    const nueva = el(`<button type="button" class="tb-btn" style="margin:calc(8px * var(--tb-k)) 0;width:100%">＋ Crear lista</button>`);
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
        { texto: "Subir canciones de tu PC…", accion: () => subirEnLista.click() },
        { texto: "Cambiar el nombre", accion: async () => { const n = await pedir("Nombre de la lista", l.nombre); if (n && n.trim()) guardarGramola({ listas: gramola().listas.map(x => x.id === l.id ? Object.assign({}, x, { nombre: n.trim().slice(0, 60) }) : x) }); } },
        "-",
        { texto: "Borrar la lista", peligro: true, accion: async () => { if (await confirmar("Borrar lista", `¿Borrar la lista «${l.nombre}»? Las canciones no se borran.`, "Borrar")) guardarGramola({ listas: gramola().listas.filter(x => x.id !== l.id) }); } }
      ]));
      const subirEnLista = el(`<input type="file" accept="audio/*" multiple hidden>`);
      bloque.appendChild(subirEnLista);
      const masBtn = bloque.querySelector("[data-mas]");
      subirEnLista.addEventListener("change", async ev => {
        const archivos = [...ev.target.files]; ev.target.value = "";
        const nuevas = await subirAudios(archivos, masBtn);
        if (nuevas.length) { listaAbierta = l.id; anadirALista(l.id, nuevas); }
      });
      bloque.addEventListener("dragover", ev => { if ([...ev.dataTransfer.types].includes("Files")) { ev.preventDefault(); bloque.classList.add("soltando"); } });
      bloque.addEventListener("dragleave", () => bloque.classList.remove("soltando"));
      bloque.addEventListener("drop", async ev => {
        if (!ev.dataTransfer.files.length) return;
        ev.preventDefault(); bloque.classList.remove("soltando");
        const nuevas = await subirAudios([...ev.dataTransfer.files], masBtn);
        if (nuevas.length) { listaAbierta = l.id; anadirALista(l.id, nuevas); }
      });
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
      if (!l.pistas.length) pistas.appendChild(el(`<p class="tb-lista-vacia">Vacía. Añade canciones desde la pestaña Canciones, pegando un enlace de YouTube o soltando aquí tus mp3.</p>`));
      caja.appendChild(bloque);
    });
  }
  let editandoEfectos = false;
  function pintarEfectos(caja) {
    caja.innerHTML = "";
    const g = gramola();
    const cab = el(`<div class="tb-fila" style="margin:calc(8px * var(--tb-k)) 0;align-items:center">
      <label class="tb-campo" style="flex:1;margin:0"><span style="font-weight:400">Volumen de los efectos para todos</span><input type="range" min="0" max="100" data-v value="${Math.round((g.volEfectos == null ? 0.8 : g.volEfectos) * 100)}"></label>
      <button type="button" class="tb-btn tb-btn-mini" data-parar title="Parar los efectos que están sonando, para todos">■ Parar</button>
      <button type="button" class="tb-btn tb-btn-mini" data-editar>${editandoEfectos ? "Listo" : "Editar"}</button></div>`);
    cab.querySelector("[data-parar]").addEventListener("click", () => { pararEfectos(); TB.red.emitir("sonido", { parar: true }); });
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
    const pie = el(`<div class="tb-fila" style="margin-top:calc(10px * var(--tb-k))"><label class="tb-btn" style="flex:1;cursor:pointer">＋ Subir un efecto<input type="file" accept="audio/*" hidden data-archivo></label><button type="button" class="tb-btn" style="flex:1" data-url>＋ Desde un enlace</button></div>`);
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

  function tablaHtml(t) {
    const b = t.tabla;
    return `<div class="tb-tirada tb-tirada-tabla"><div class="tb-tirada-etq">Tabla «${esc(b.nombre)}»</div>
      <div class="tb-tabla-res">${esc(b.texto)}</div><div class="tb-tirada-expr">sale ${t.total} de ${b.de}</div></div>`;
  }

  /* ============================================================ tablas aleatorias */
  // El DJ las hace (a mano o rellenándolas con el compendio) y elige cuáles ven los jugadores. Se tiran aquí o con /tabla nombre.
  async function cargarTablas() { try { TB.tablas = await TB.red.tablas(); } catch (e) { TB.tablas = TB.tablas || []; } return TB.tablas; }
  async function tirarTabla(t, modo) {
    try { await TB.red.tirarTabla(t.id, modo || "todos", cuerpos.chat.querySelector("[data-como]").value || null); }
    catch (e) { aviso(/tablero_tirar_tabla|tablero_tablas/.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para las tablas." : mensajeError(e), true); }
  }
  const textoFilas = filas => (filas || []).map(f => ((parseInt(f.peso, 10) || 1) > 1 ? f.peso + " | " : "") + f.texto).join("\n");
  const leerFilas = txt => String(txt || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 500).map(l => {
    const m = l.match(/^(\d{1,4})\s*\|\s*(.+)$/);
    return m ? { texto: m[2].slice(0, 500), peso: Math.max(1, Math.min(1000, parseInt(m[1], 10))) } : { texto: l.slice(0, 500), peso: 1 };
  });
  function editarTabla(t) {
    t = t || { nombre: "", filas: [], ver_todos: false };
    const fuentes = { BESTIARIO: "Bestiario", OBJETOS: "Objetos", ARMAS: "Armas", PERSONAJES: "Personajes", LUGARES: "Lugares", RAZAS: "Pueblos" };
    const c = el(`<div><label class="tb-campo"><span>Nombre</span><input type="text" maxlength="60" data-n placeholder="Botín de la cripta"></label>
      <label class="tb-campo"><span>Filas, una por línea. Para que una salga más, ponle delante cuántas veces cuenta: <b>3 | Poción de curación</b></span>
        <textarea rows="12" data-f style="font-family:Consolas,monospace;font-size:calc(13px * var(--tb-k))"></textarea></label>
      <div class="tb-fila"><select data-fuente><option value="">Rellenar con el compendio…</option>${Object.entries(fuentes).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <span class="tb-nota" data-cuenta></span><span style="flex:1"></span><label class="tb-casilla"><input type="checkbox" data-v> La ven y tiran los jugadores</label></div></div>`);
    const n = c.querySelector("[data-n]"), f = c.querySelector("[data-f]"), cuenta = c.querySelector("[data-cuenta]");
    n.value = t.nombre; f.value = textoFilas(t.filas); c.querySelector("[data-v]").checked = !!t.ver_todos;
    const contar = () => { cuenta.textContent = leerFilas(f.value).length + " filas"; };
    contar(); f.addEventListener("input", contar);
    c.querySelector("[data-fuente]").addEventListener("change", async e => {
      const k = e.target.value; e.target.value = "";
      if (!k) return;
      await cargarCompendio();
      const nombres = [...new Set((window[k] || []).map(x => x.title || x.nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      f.value = (f.value.trim() ? f.value.trim() + "\n" : "") + nombres.join("\n");
      if (!n.value.trim()) n.value = fuentes[k];
      contar();
    });
    [n, f].forEach(x => x.addEventListener("keydown", e => e.stopPropagation()));
    modal({ titulo: t.id ? "Editar tabla" : "Nueva tabla", cuerpo: c, ancho: 560, alAceptar: async () => {
      const nombre = n.value.trim().slice(0, 60), filas = leerFilas(f.value);
      if (!nombre) { aviso("Ponle un nombre."); return false; }
      if (!filas.length) { aviso("La tabla necesita al menos una fila."); return false; }
      try { await TB.red.guardarTabla({ id: t.id, nombre, filas, ver_todos: c.querySelector("[data-v]").checked }); }
      catch (e) { aviso(/duplicate|unique|tablero_tablas_nombre|Ya hay/.test(String(e && e.message)) ? "Ya hay una tabla con ese nombre." : mensajeError(e), true); return false; }
      await cargarTablas(); pintarColecciones();
    } });
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
      const caja = el(`<div style="border:1px solid #ddd;border-radius:calc(6px * var(--tb-k));padding:calc(10px * var(--tb-k));margin-bottom:calc(10px * var(--tb-k))">
        <div class="tb-fila"><input type="text" data-n><label class="tb-casilla" style="white-space:nowrap"><input type="checkbox" data-b> En la barra</label></div>
        <textarea data-t rows="3" style="margin-top:calc(8px * var(--tb-k));font-family:Consolas,monospace;font-size:calc(13px * var(--tb-k))"></textarea>
        <div class="tb-fila" style="justify-content:flex-end;margin-top:calc(8px * var(--tb-k))"><button type="button" class="tb-btn tb-btn-mini" data-probar>Probar</button><button type="button" class="tb-btn tb-btn-mini" data-guardar>Guardar</button><button type="button" class="tb-btn tb-btn-mini tb-btn-rojo" data-borrar>Borrar</button></div></div>`);
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
    const gm = TB.esGM();
    const secTablas = el(`<div class="tb-tablas"><div class="tb-pes-cab" style="padding-left:0;padding-right:0"><h2>Tablas aleatorias</h2>${gm ? '<button type="button" class="tb-btn" data-nueva-tabla>＋ Tabla</button>' : ""}</div>
      <p class="tb-nota" style="margin-top:0">${gm ? "Botín, encuentros, nombres… Tíralas aquí o en el chat con <b>/tabla nombre</b> (o <b>/gtabla nombre</b> para que solo lo veas tú). Las que marques como visibles las pueden tirar los jugadores." : "Las tablas que el DJ comparte contigo. También se tiran en el chat con <b>/tabla nombre</b>."}</p><div data-tablas><p class="tb-nota">Cargando…</p></div></div>`);
    lista.appendChild(secTablas);
    if (gm) secTablas.querySelector("[data-nueva-tabla]").addEventListener("click", () => editarTabla(null));
    cargarTablas().then(l => {
      const caja = secTablas.querySelector("[data-tablas]");
      caja.innerHTML = l.length ? "" : `<p class="tb-nota">${gm ? "Todavía no hay tablas." : "El DJ no ha compartido ninguna tabla."}</p>`;
      l.forEach(t => {
        const fila = el(`<div class="tb-tabla-item"><button type="button" class="tb-btn tb-btn-mini" data-tirar title="Tirar en el chat">${TBIconoDado.d20}</button>
          <span><b>${esc(t.nombre)}</b><small>${(t.filas || []).length} filas${gm ? (t.ver_todos ? " · la ven los jugadores" : " · solo tú") : ""}</small></span>
          ${gm ? '<button type="button" class="tb-btn tb-btn-mini" data-editar>Editar</button><button type="button" class="tb-btn tb-btn-mini" data-borrar title="Borrar">✕</button>' : ""}</div>`);
        fila.querySelector("[data-tirar]").addEventListener("click", () => TB.tirarTabla(t, "todos"));
        if (gm) {
          fila.querySelector("[data-editar]").addEventListener("click", () => editarTabla(t));
          fila.querySelector("[data-borrar]").addEventListener("click", async () => {
            if (!(await confirmar("Borrar la tabla", "¿Borrar la tabla «" + t.nombre + "»? No se puede deshacer.", "Borrar"))) return;
            try { await TB.red.borrarTabla(t.id); await cargarTablas(); pintarColecciones(); } catch (e) { aviso(mensajeError(e), true); }
          });
        }
        caja.appendChild(fila);
      });
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
      s.value = String(leer(ruta) === "auto" ? "0.8" : leer(ruta));
      s.addEventListener("change", () => { escribir(ruta, s.value); if (alCambiar) alCambiar(s.value); });
      caja.appendChild(f);
    };
    const deslizador = (caja, ruta, texto, min, max, paso, alCambiar) => {
      const f = el(`<label class="tb-campo"><span style="font-weight:400">${texto} <b data-v></b></span><input type="range" min="${min}" max="${max}" step="${paso}"></label>`);
      const r = f.querySelector("input");
      r.value = leer(ruta);
      const mostrar = () => { f.querySelector("[data-v]").textContent = max === 1 ? Math.round(r.value * 100) + " %" : r.value; };
      mostrar();
      r.addEventListener("input", () => { escribir(ruta, +r.value); mostrar(); if (alCambiar) alCambiar(+r.value); });
      caja.appendChild(f);
    };

    const perfil = seccion("Mi avatar", true);
    pintarPerfil(perfil);
    const sonido = seccion("Sonido", false);
    deslizador(sonido, "volumen", "Mi volumen de la música", 0, 1, 0.05, aplicarVolumen);
    deslizador(sonido, "volumenEfectos", "Mi volumen de los efectos", 0, 1, 0.05);
    toggle(sonido, "soloAudio", "YouTube solo en audio (sin la ventana del vídeo)", () => estadoRepro());
    if (!gm) sonido.appendChild(el(`<p class="tb-nota">La música y los efectos los pone el DJ.</p>`));
    if (gm) {
      // Los volúmenes globales del DJ: se aplican a todos (cada jugador ajusta encima el suyo)
      const glob = el(`<div><p class="tb-nota" style="margin:calc(10px * var(--tb-k)) 0 calc(4px * var(--tb-k));font-weight:700">Para todos (lo que tú pongas suena así en cada jugador)</p>
        <label class="tb-campo"><span style="font-weight:400">Música para todos <b data-tm></b></span><input type="range" min="0" max="100" data-mg></label>
        <label class="tb-campo"><span style="font-weight:400">Efectos para todos <b data-te></b></span><input type="range" min="0" max="100" data-eg></label></div>`);
      const mg = glob.querySelector("[data-mg]"), eg = glob.querySelector("[data-eg]");
      const mus = TB.estado.musica || {}, g = gramola();
      mg.value = Math.round((mus.volumen == null ? 0.6 : mus.volumen) * 100);
      eg.value = Math.round((g.volEfectos == null ? 0.8 : g.volEfectos) * 100);
      const pintarV = () => { glob.querySelector("[data-tm]").textContent = mg.value + " %"; glob.querySelector("[data-te]").textContent = eg.value + " %"; };
      pintarV();
      mg.addEventListener("input", pintarV); eg.addEventListener("input", pintarV);
      mg.addEventListener("change", () => cambiarMusica({ volumen: mg.value / 100 }));
      eg.addEventListener("change", () => guardarGramola({ volEfectos: eg.value / 100 }));
      sonido.appendChild(glob);
    }
    const jug = seccion("Jugadores en el tablero", gm);
    toggle(jug, "avatares.ver", "Mostrar los avatares de quien está ahora en el tablero", pintarAvatares);
    deslizador(jug, "avatares.tam", "Tamaño de los avatares", 32, 120, 4, pintarAvatares);
    toggle(jug, "avatares.nombres", "Mostrar los nombres debajo de los avatares", pintarAvatares);

    const acc = seccion("Accesibilidad");
    selector(acc, "escalaUI", "Tamaño de la interfaz (barras, panel, ventanas y letras; no el lienzo)", [["0.7", "70 %"], ["0.8", "80 % (como Roll20)"], ["0.9", "90 %"], ["1", "100 %"], ["1.1", "110 %"], ["1.25", "125 %"], ["zoom", "Compensar el zoom del navegador"]], () => TB.aplicarEscala());
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
      const b = el(`<button type="button" class="tb-btn tb-btn-rojo" style="margin-top:calc(8px * var(--tb-k))">Vaciar el registro del chat</button>`);
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
      <tr><td>Parada de la ruta mientras arrastras una ficha</td><td>Q o clic derecho</td></tr>
      <tr><td>Ver la última ruta de la ficha seleccionada</td><td>X</td></tr>
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

  /* ============================================================ mi avatar */
  function pintarPerfil(caja) {
    const actual = (TB.miPerfil && TB.miPerfil.avatar) || "";
    const mios = [...TB.diario.values()].filter(e => e.tipo === "personaje" && !e.archivado && e.imagen && (TB.esGM() || (e.controladores || []).includes(TB.yo.uid)));
    caja.innerHTML = "";
    const c = el(`<div class="tb-perfil">
      <span class="tb-perfil-av" style="${actual ? `background-image:url('${esc(actual)}')` : `background-color:${TB.colorJugador(TB.yo.uid)}`}">${actual ? "" : esc(String(TB.yo.nombre || "?")[0].toUpperCase())}</span>
      <div class="tb-perfil-botones">
        <label class="tb-btn tb-btn-mini">Subir una imagen<input type="file" accept="image/*" hidden data-archivo></label>
        <button type="button" class="tb-btn tb-btn-mini" data-enlace>Desde un enlace</button>
        ${mios.length ? `<button type="button" class="tb-btn tb-btn-mini" data-pj>La de un personaje</button>` : ""}
        ${actual ? `<button type="button" class="tb-btn tb-btn-mini" data-quitar>Quitar</button>` : ""}</div></div>`);
    caja.appendChild(c);
    caja.appendChild(el(`<p class="tb-nota">Sale en el chat y en la barra de quién está en el tablero. Sin avatar propio se usa la imagen de tu personaje.</p>`));
    const guardar = async avatar => {
      try {
        await TB.red.guardarPerfil({ avatar });
        TB.miPerfil = Object.assign({}, TB.miPerfil, { avatar });
        TB.anunciarAvatar();
        pintarPerfil(caja);
        aviso(avatar ? "Avatar cambiado." : "Avatar quitado.");
      } catch (e) { aviso(/tablero_perfil/.test(String(e && e.message)) ? "Falta volver a correr tablero.sql para guardar el avatar." : mensajeError(e), true); }
    };
    c.querySelector("[data-archivo]").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try { aviso("Subiendo…"); guardar(await TB.red.subirPropio(f)); } catch (err) { aviso(mensajeError(err), true); }
    });
    c.querySelector("[data-enlace]").addEventListener("click", async () => {
      const u = await pedir("Avatar desde un enlace", actual, { etiqueta: "Enlace https a una imagen" });
      if (u === null) return;
      if (!/^https:\/\/\S+$/i.test(u.trim())) { aviso("Tiene que ser un enlace https.", true); return; }
      guardar(u.trim());
    });
    const pj = c.querySelector("[data-pj]");
    if (pj) pj.addEventListener("click", ev => menu(ev.clientX, ev.clientY, mios.map(e => ({ texto: esc(e.nombre), accion: () => guardar(e.imagen) }))));
    const q = c.querySelector("[data-quitar]");
    if (q) q.addEventListener("click", () => guardar(""));
  }

  /* ============================================================ avatares de los presentes */
  function pintarAvatares() {
    const b = document.getElementById("tbAvatares");
    if (!b || !TB) return;
    const A = Object.assign({ ver: true, tam: 56, nombres: true }, TB.prefs.avatares);
    b.hidden = !A.ver;
    if (!A.ver) return;
    const lista = (TB.presencia || []).slice().sort((x, y) => (y.gm ? 1 : 0) - (x.gm ? 1 : 0) || String(x.nombre).localeCompare(String(y.nombre)));
    b.style.setProperty("--tb-av", `calc(${A.tam}px * var(--tb-k))`);
    b.innerHTML = lista.map(p => {
      const nombre = p.personaje ? `${p.personaje} (${p.nombre})` : p.nombre || "?";
      const fondo = p.avatar ? `background-image:url('${esc(p.avatar)}')` : `background-color:${TB.colorJugador(p.uid)}`;
      return `<div class="tb-av${p.gm ? " gm" : ""}${p.uid === TB.yo.uid ? " yo" : ""}" title="${esc(nombre)}${p.gm ? " · DJ" : ""}${p.uid === TB.yo.uid ? " · clic para cambiar tu avatar" : ""}">
        <span class="tb-av-img" style="${fondo};border-color:${TB.colorJugador(p.uid)}">${p.avatar ? "" : esc(String(p.nombre || "?")[0].toUpperCase())}</span>
        ${A.nombres ? `<span class="tb-av-nombre">${esc(p.gm ? "DJ" : (p.personaje || p.nombre || ""))}</span>` : ""}</div>`;
    }).join("");
    const yo = b.querySelector(".tb-av.yo");
    if (yo) yo.addEventListener("click", () => { if (TB.prefs.ladoPlegado) document.getElementById("tbLadoPlegar").click(); abrirPestana("ajustes"); });
  }

  /* ============================================================ reglas (ventana que se abre al pedirla) */
  let filtroReglas = "";
  function abrirReglas() {
    const v = ventana("reglas", { titulo: "Reglas", ancho: 520, alto: Math.min(680, window.innerHeight - 80), x: Math.max(80, window.innerWidth / 2 - 380), y: 50 });
    v.cuerpo.innerHTML = "";
    v.cuerpo.style.display = "flex"; v.cuerpo.style.flexDirection = "column";
    const buscar = el(`<div style="padding:calc(10px * var(--tb-k)) calc(12px * var(--tb-k));border-bottom:1px solid var(--tb-borde)"><input type="search" placeholder="Buscar una regla (agarre, derribado, descanso…)"></div>`);
    const lista = el(`<div class="tb-reglas" style="flex:1;overflow-y:auto;padding:calc(6px * var(--tb-k)) calc(12px * var(--tb-k)) calc(14px * var(--tb-k))"></div>`);
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
          ${r.descripcion ? `<p class="tb-nota" style="margin:calc(6px * var(--tb-k)) 0 calc(8px * var(--tb-k))">${esc(r.descripcion)}</p>` : ""}
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

