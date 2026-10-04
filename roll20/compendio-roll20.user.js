// ==UserScript==
// @name         Compendio → Roll20
// @namespace    https://fratiga.github.io/Dih-and-Dih/
// @version      2.6.0
// @description  Muestra dentro de Roll20 las tiradas de tus personajes y las habilidades de los enemigos del Compendio, y las manda al chat con un clic.
// @match        https://app.roll20.net/editor*
// @match        https://fratiga.github.io/Dih-and-Dih/*
// @match        http://localhost:8845/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      ilicqboqelrjuvtslaxd.supabase.co
// @run-at       document-idle
// @updateURL    https://fratiga.github.io/Dih-and-Dih/roll20/compendio-roll20.user.js
// @downloadURL  https://fratiga.github.io/Dih-and-Dih/roll20/compendio-roll20.user.js
// ==/UserScript==

(function () {
  "use strict";

  // Mismo proyecto de Supabase y misma clave pública que usa el sitio (la clave
  // "publishable" está pensada para ir en el navegador; los datos los protege RLS).
  const SUPA = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const CLAVE = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

  // Los PERSONAJES se leen directo de Supabase con la sesión del jugador (funciona
  // desde cualquier navegador). Los ENEMIGOS (solo para el máster) los publica la
  // página de Estadísticas en este navegador, y se copian al script desde el sitio.
  const FUENTE_ENEMIGOS = { local: "compendioRoll20Enemigos", gm: "compendio_roll20_enemigos", mensaje: "compendio-roll20-enemigos" };

  /* =========================================================================
     LADO DEL COMPENDIO: copia lo que publica la página (enemigos) al
     almacenamiento del script, para que Roll20 (otro sitio) pueda leerlo.
  ========================================================================= */
  if (location.hostname !== "app.roll20.net") {
    const copiar = (clave, texto) => {
      if (texto && texto !== GM_getValue(clave, "")) GM_setValue(clave, texto);
    };
    const leerLocal = () => {
      try { copiar(FUENTE_ENEMIGOS.gm, localStorage.getItem(FUENTE_ENEMIGOS.local)); } catch (e) { /* sin acceso */ }
    };
    leerLocal();
    window.addEventListener("message", e => {
      if (e.source !== window || !e.data || e.data.tipo !== FUENTE_ENEMIGOS.mensaje) return;
      try { copiar(FUENTE_ENEMIGOS.gm, JSON.stringify(e.data.payload)); } catch (err) { /* ignorar */ }
    });
    window.addEventListener("storage", leerLocal);
    setInterval(leerLocal, 4000);
    return;
  }

  /* =========================================================================
     LADO DE ROLL20: panel flotante con las tiradas.
  ========================================================================= */
  function leerJson(clave) {
    try { return JSON.parse(GM_getValue(clave, "") || "null"); } catch (e) { return null; }
  }

  const estado = {
    sesion: leerJson("compendio_sesion"),
    esAdmin: leerJson("compendio_admin") === true, // solo el Admin ve la pestaña de Enemigos
    personajes: leerJson("compendio_cache") || [], // lista de { id, nombre, dueno, items }
    enemigos: null,
    cargando: false,
    error: "",
    vista: GM_getValue("compendio_vista", "personaje"), // "personaje" | "enemigos"
    personajeId: GM_getValue("compendio_personaje", ""),
    enemigoId: GM_getValue("compendio_enemigo", ""),
    modo: "normal",
    susurro: GM_getValue("compendio_susurro", false),
    filtro: "favoritas",
    filtroEnemigo: "Acciones",
    busqueda: "",
    abierto: GM_getValue("compendio_abierto", true),
    confirmar: GM_getValue("compendio_confirmar", true) // abrir la ventana de confirmación antes de lanzar
  };

  /* --- Supabase por HTTP (GM_xmlhttpRequest evita los bloqueos de CORS/CSP de Roll20) --- */
  function pedir({ metodo = "GET", ruta, cuerpo, token }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: metodo,
        url: SUPA + ruta,
        headers: Object.assign({ apikey: CLAVE, "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
        data: cuerpo ? JSON.stringify(cuerpo) : undefined,
        timeout: 15000,
        onload: r => {
          let json = null;
          try { json = JSON.parse(r.responseText); } catch (e) { /* sin cuerpo */ }
          if (r.status >= 200 && r.status < 300) resolve(json);
          else reject({ status: r.status, json });
        },
        onerror: () => reject({ status: 0 }),
        ontimeout: () => reject({ status: 0 })
      });
    });
  }

  function guardarSesion(resp) {
    const ahora = Math.floor(Date.now() / 1000);
    estado.sesion = {
      access_token: resp.access_token,
      refresh_token: resp.refresh_token,
      expires_at: resp.expires_at || ahora + (resp.expires_in || 3600),
      email: (resp.user && resp.user.email) || (estado.sesion && estado.sesion.email) || ""
    };
    GM_setValue("compendio_sesion", JSON.stringify(estado.sesion));
    return estado.sesion;
  }

  function cerrarSesion() {
    estado.sesion = null;
    estado.personajes = [];
    estado.esAdmin = false;
    estado.vista = "personaje";
    GM_deleteValue("compendio_sesion");
    GM_deleteValue("compendio_cache");
    GM_deleteValue("compendio_admin");
  }

  async function tokenValido() {
    const s = estado.sesion;
    if (!s) return null;
    if (Date.now() / 1000 < s.expires_at - 60) return s.access_token;
    try {
      const resp = await pedir({ metodo: "POST", ruta: "/auth/v1/token?grant_type=refresh_token", cuerpo: { refresh_token: s.refresh_token } });
      return guardarSesion(resp).access_token;
    } catch (e) {
      if (e.status === 400 || e.status === 401) cerrarSesion();
      return null;
    }
  }

  async function iniciarSesion(email, password) {
    const resp = await pedir({ metodo: "POST", ruta: "/auth/v1/token?grant_type=password", cuerpo: { email, password } });
    guardarSesion(resp);
  }

  async function cargarPersonajes() {
    if (!estado.sesion || estado.cargando) return;
    estado.cargando = true;
    estado.error = "";
    pintar();
    try {
      const token = await tokenValido();
      if (!token) throw new Error("La sesión venció. Entra de nuevo.");
      const filas = await pedir({
        ruta: "/rest/v1/fichas_personajes?select=id,roll20,nombre:data->identidad->>nombre,dueno:data->>ownerUsername&archivado=eq.false&roll20=not.is.null&order=updated_at.desc",
        token
      });
      try {
        // La misma función que usa el sitio para saber si una cuenta es Admin
        const admin = await pedir({ metodo: "POST", ruta: "/rest/v1/rpc/fichas_es_admin", cuerpo: {}, token });
        estado.esAdmin = admin === true;
      } catch (e) { /* si falla la consulta, se deja como estaba */ }
      GM_setValue("compendio_admin", JSON.stringify(estado.esAdmin));
      if (!estado.esAdmin) { estado.vista = "personaje"; estado.susurro = false; }
      estado.personajes = (filas || []).map(f => ({
        id: f.id,
        nombre: f.nombre || (f.roll20 && f.roll20.nombre) || "Sin nombre",
        dueno: f.dueno || "",
        items: (f.roll20 && f.roll20.items) || []
      }));
      GM_setValue("compendio_cache", JSON.stringify(estado.personajes));
    } catch (e) {
      estado.error = e && e.message ? e.message : "No pude conectar con el Compendio.";
    }
    estado.cargando = false;
    pintar();
  }

  GM_addStyle(`
    #cr20-boton { position: fixed; left: 10px; bottom: 10px; z-index: 99999; background: #1d1e20; color: #e8e4d0;
      border: 1px solid #5a5a48; padding: 8px 12px; font: 600 13px sans-serif; cursor: pointer; }
    #cr20-panel { position: fixed; left: 10px; bottom: 52px; z-index: 99999; width: 340px; max-height: 72vh;
      display: flex; flex-direction: column; background: #1d1e20; color: #e8e4d0; border: 1px solid #5a5a48;
      font: 13px sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
    #cr20-panel[hidden] { display: none; }
    #cr20-asa { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; cursor: grab;
      background: #26272a; border-bottom: 1px solid #3a3a34; color: #8d8977; font: 600 11px sans-serif;
      letter-spacing: .06em; text-transform: uppercase; user-select: none; touch-action: none; }
    #cr20-asa:active, #cr20-boton:active { cursor: grabbing; }
    #cr20-cuerpo { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    #cr20-boton { touch-action: none; user-select: none; }
    #cr20-panel select, #cr20-panel input[type=search], #cr20-panel input[type=email], #cr20-panel input[type=password] { background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34;
      padding: 6px 8px; font: 13px sans-serif; box-sizing: border-box; }
    #cr20-panel button.cr20-accion { background: #26272a; color: #e8e4d0; border: 1px solid #5a5a48; padding: 7px 10px; font: 13px sans-serif; cursor: pointer; }
    .cr20-fila { display: flex; gap: 6px; padding: 8px 10px 0; align-items: center; }
    .cr20-fila > * { flex: 1; min-width: 0; }
    .cr20-tabs { display: flex; border-bottom: 1px solid #3a3a34; }
    .cr20-tab { flex: 1; background: none; color: #a9a58f; border: 0; border-bottom: 2px solid transparent; padding: 8px; font: 600 12px sans-serif; cursor: pointer; }
    .cr20-tab.on { color: #e8e4d0; border-bottom-color: #a9a58f; }
    .cr20-chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 10px 0; }
    .cr20-chip { background: none; color: #a9a58f; border: 1px solid #3a3a34; padding: 3px 8px; font: 12px sans-serif; cursor: pointer; }
    .cr20-chip.on { color: #e8e4d0; border-color: #a9a58f; background: #26272a; }
    #cr20-lista { overflow-y: auto; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
    .cr20-item { text-align: left; background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34; padding: 7px 9px; cursor: pointer; font: 13px sans-serif; }
    .cr20-item:hover { border-color: #a9a58f; }
    .cr20-item small { display: block; color: #8d8977; font-size: 11px; }
    .cr20-vacio { color: #a9a58f; padding: 12px 10px; line-height: 1.5; }
    .cr20-error { color: #d99a9a; padding: 8px 10px 0; }
    .cr20-pie { color: #8d8977; font-size: 11px; padding: 6px 10px 8px; display: flex; justify-content: space-between; }
    .cr20-pie a { color: #a9a58f; cursor: pointer; text-decoration: underline; }
    .cr20-ficha { padding: 8px 10px 0; color: #a9a58f; font-size: 12px; }
    .cr20-susurro { display: flex; align-items: center; gap: 6px; color: #a9a58f; font-size: 12px; padding: 8px 10px 0; }
    #cr20-tip { position: fixed; z-index: 100001; max-width: 300px; background: #26272a; color: #e8e4d0;
      border: 1px solid #a9a58f; padding: 8px 10px; font: 12px/1.5 sans-serif; white-space: pre-wrap;
      box-shadow: 0 6px 20px rgba(0,0,0,.5); pointer-events: none; }
    #cr20-modal-fondo { position: fixed; inset: 0; z-index: 100002; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
    #cr20-modal { width: min(460px, 94vw); max-height: 88vh; overflow-y: auto; background: #1d1e20; color: #e8e4d0;
      border: 1px solid #a9a58f; padding: 16px; font: 13px/1.5 sans-serif; box-shadow: 0 12px 40px rgba(0,0,0,.7); }
    #cr20-modal h3 { margin: 0 0 4px; font: 600 16px sans-serif; }
    #cr20-modal .cr20-cat { color: #8d8977; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    #cr20-modal .cr20-bloque { margin-top: 10px; }
    #cr20-modal .cr20-etq { display: block; color: #a9a58f; font: 600 11px sans-serif; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
    #cr20-modal .cr20-texto { white-space: pre-wrap; background: #26272a; border: 1px solid #3a3a34; padding: 7px 9px; max-height: 160px; overflow-y: auto; }
    #cr20-modal textarea { width: 100%; box-sizing: border-box; min-height: 84px; resize: vertical; background: #26272a; color: #e8e4d0;
      border: 1px solid #5a5a48; padding: 7px 9px; font: 13px/1.5 monospace; }
    #cr20-modal select { background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34; padding: 5px 8px; font: 13px sans-serif; margin-bottom: 6px; }
    #cr20-modal button.cr20-accion { background: #26272a; color: #e8e4d0; border: 1px solid #5a5a48; padding: 7px 14px; font: 13px sans-serif; cursor: pointer; }
    #cr20-modal .cr20-botones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    #cr20-modal .cr20-ayuda { color: #8d8977; font-size: 11px; margin-top: 3px; }
    #cr20-toast { position: fixed; left: 10px; bottom: 56px; z-index: 100000; background: #26272a; color: #e8e4d0;
      border: 1px solid #a9a58f; padding: 8px 12px; font: 13px sans-serif; max-width: 320px; }
  `);

  const boton = document.createElement("button");
  boton.id = "cr20-boton";
  boton.type = "button";
  boton.textContent = "Compendio";
  const panel = document.createElement("div");
  panel.id = "cr20-panel";
  panel.innerHTML = `<div id="cr20-asa" title="Arrastra para mover"><span>⋮⋮ Compendio</span><span>arrastra</span></div><div id="cr20-cuerpo"></div>`;
  const cuerpoPanel = panel.querySelector("#cr20-cuerpo");
  document.body.append(boton, panel);

  /* --- Mover el panel y el botón (la posición se recuerda) ----------------- */
  function dentroDeLaPantalla(x, y, el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - r.width)),
      y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - r.height))
    };
  }

  function colocar(el, x, y) {
    const pos = dentroDeLaPantalla(x, y, el);
    el.style.left = pos.x + "px";
    el.style.top = pos.y + "px";
    el.style.bottom = "auto";
    return pos;
  }

  function hacerArrastrable(el, asa, clave, alHacerClic) {
    const guardada = leerJson(clave);
    if (guardada) colocar(el, guardada.x, guardada.y);

    let inicio = null;
    asa.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      inicio = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, movido: false };
      try { asa.setPointerCapture(e.pointerId); } catch (err) { /* sin captura, sigue funcionando */ }
    });
    asa.addEventListener("pointermove", e => {
      if (!inicio) return;
      const dx = e.clientX - inicio.px;
      const dy = e.clientY - inicio.py;
      if (!inicio.movido && Math.hypot(dx, dy) < 5) return;
      inicio.movido = true;
      colocar(el, inicio.x + dx, inicio.y + dy);
    });
    const soltar = e => {
      if (!inicio) return;
      const { movido } = inicio;
      inicio = null;
      if (movido) {
        const r = el.getBoundingClientRect();
        GM_setValue(clave, JSON.stringify({ x: r.left, y: r.top }));
      } else if (alHacerClic) {
        alHacerClic(e);
      }
    };
    asa.addEventListener("pointerup", soltar);
    asa.addEventListener("pointercancel", () => { inicio = null; });
    window.addEventListener("resize", () => {
      if (el.style.left) { const r = el.getBoundingClientRect(); colocar(el, r.left, r.top); }
    });
  }

  hacerArrastrable(panel, panel.querySelector("#cr20-asa"), "compendio_pos_panel", null);
  panel.addEventListener("mouseleave", () => { const t = document.getElementById("cr20-tip"); if (t) t.remove(); });
  hacerArrastrable(boton, boton, "compendio_pos_boton", () => {
    estado.abierto = !estado.abierto;
    GM_setValue("compendio_abierto", estado.abierto);
    pintar();
    if (estado.abierto && estado.sesion) cargarPersonajes();
  });

  function cargarEnemigos() {
    estado.enemigos = leerJson(FUENTE_ENEMIGOS.gm);
  }

  function aviso(texto) {
    const previo = document.getElementById("cr20-toast");
    if (previo) previo.remove();
    const t = document.createElement("div");
    t.id = "cr20-toast";
    t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* --- Envío al chat de Roll20 ------------------------------------------ */
  function escribirEnArea(area, valor) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(area, valor);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function pulsarEnviar(area) {
    const envio = document.querySelector("#textchat-input .btn") || document.querySelector("#textchat-input button");
    if (envio) { envio.click(); return; }
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  }

  function enviarAlChat(texto) {
    let lineas = String(texto).split("\n").filter(Boolean);
    // En susurro (solo para el máster) se omiten las acciones narradas (/em) y el resto va como "/w gm ..."
    if (estado.esAdmin && estado.susurro) lineas = lineas.filter(l => !l.startsWith("/em")).map(l => `/w gm ${l}`);
    if (!lineas.length) return;
    const area = document.querySelector("#textchat-input textarea");
    if (!area) {
      GM_setClipboard(lineas.join("\n"));
      aviso("No encontré el chat de Roll20. Copié la tirada: pégala en el chat.");
      return;
    }
    let i = 0;
    const siguiente = () => {
      if (i >= lineas.length) return;
      escribirEnArea(area, lineas[i++]);
      pulsarEnviar(area);
      setTimeout(siguiente, 250);
    };
    siguiente();
  }

  /* --- Panel -------------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function cabecera() {
    return `
      <div class="cr20-tabs">
        <button type="button" class="cr20-tab ${estado.vista === "personaje" ? "on" : ""}" data-vista="personaje">Mi personaje</button>
        <button type="button" class="cr20-tab ${estado.vista === "enemigos" ? "on" : ""}" data-vista="enemigos">Enemigos</button>
      </div>`;
  }

  function controlesComunes() {
    return `
      <div class="cr20-fila">
        <select id="cr20-modo">
          <option value="normal" ${estado.modo === "normal" ? "selected" : ""}>Normal</option>
          <option value="ventaja" ${estado.modo === "ventaja" ? "selected" : ""}>Ventaja</option>
          <option value="desventaja" ${estado.modo === "desventaja" ? "selected" : ""}>Desventaja</option>
        </select>
        <label class="cr20-susurro" style="padding:0;flex:1.2"><input type="checkbox" id="cr20-confirmar" ${estado.confirmar ? "checked" : ""}> Revisar antes de lanzar</label>
        ${estado.esAdmin ? `<label class="cr20-susurro" style="padding:0;flex:1.2"><input type="checkbox" id="cr20-susurro" ${estado.susurro ? "checked" : ""}> Solo yo (susurro)</label>` : ""}
      </div>`;
  }

  function pintar() {
    panel.hidden = !estado.abierto;
    if (!estado.abierto) return;
    if (!estado.esAdmin) estado.vista = "personaje";
    // Sin sesión solo hay login; las pestañas (y los enemigos) son solo para el Admin
    cuerpoPanel.innerHTML = (estado.sesion && estado.esAdmin ? cabecera() : "") + (estado.vista === "enemigos" && estado.sesion ? cuerpoEnemigos() : cuerpoPersonaje());
    enlazar();
    // Si cambió el alto del panel, que no se salga de la pantalla
    if (panel.style.left) { const r = panel.getBoundingClientRect(); colocar(panel, r.left, r.top); }
  }

  function pieSesion() {
    return `<div class="cr20-pie"><span>${estado.cargando ? "Actualizando…" : esc(estado.sesion.email)}</span><span><a id="cr20-refrescar">Actualizar</a> · <a id="cr20-salir">Salir</a></span></div>`;
  }

  function cuerpoLogin() {
    return `
      <div class="cr20-vacio">Entra con tu cuenta del Compendio (la misma de Mis personajes). Solo hace falta una vez; no guardo tu contraseña.</div>
      <div class="cr20-fila"><input id="cr20-email" type="email" placeholder="Correo" autocomplete="username"></div>
      <div class="cr20-fila"><input id="cr20-pass" type="password" placeholder="Contraseña" autocomplete="current-password"></div>
      ${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}
      <div class="cr20-fila" style="padding-bottom:10px"><button type="button" class="cr20-accion" id="cr20-entrar">Entrar</button></div>`;
  }

  function cuerpoPersonaje() {
    if (!estado.sesion) return cuerpoLogin();

    const lista = estado.personajes;
    const p = lista.find(x => x.id === estado.personajeId) || lista[0] || null;
    if (!p) {
      return `<div class="cr20-vacio">${estado.cargando ? "Cargando tus personajes…" : "Todavía no hay personajes publicados. Abre Mis personajes en el Compendio una vez (se publican solos) y pulsa Actualizar."}</div>${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}${pieSesion()}`;
    }
    const categorias = [...new Set(p.items.map(i => i.categoria))];
    if (estado.filtro === "favoritas" && !p.items.some(i => i.favorita)) estado.filtro = "todas";
    const chips = [["favoritas", "★ Favoritas"], ["todas", "Todas"], ...categorias.map(c => [c, c])];
    const q = estado.busqueda.trim().toLowerCase();
    const items = p.items.filter(i => {
      if (estado.filtro === "favoritas" && !i.favorita) return false;
      if (estado.filtro !== "favoritas" && estado.filtro !== "todas" && i.categoria !== estado.filtro) return false;
      return !q || i.texto.toLowerCase().includes(q);
    });
    const hayVariosDuenos = new Set(lista.map(x => x.dueno)).size > 1;
    const etiqueta = x => (hayVariosDuenos && x.dueno ? `${x.nombre} (${x.dueno})` : x.nombre);
    return `
      <div class="cr20-fila">
        ${lista.length > 1 ? `<select id="cr20-pj">${lista.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(etiqueta(x))}</option>`).join("")}</select>` : `<strong style="padding:6px 0">${esc(p.nombre)}</strong>`}
      </div>
      ${controlesComunes()}
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${chips.map(([v, t]) => `<button type="button" class="cr20-chip ${estado.filtro === v ? "on" : ""}" data-filtro="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      ${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}
      <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-id="${esc(i.id)}"${i.desc ? ` data-desc="${esc(i.desc)}"` : ""}${i.calc ? ` data-calc="${esc(i.calc)}"` : ""}><small>${esc(i.categoria)}${i.municion ? ` · Munición ${i.municion.actual}/${i.municion.max}` : ""}</small>${esc(i.texto)}</button>`).join("") || `<div class="cr20-vacio">Nada coincide.</div>`}</div>
      ${pieSesion()}`;
  }

  function cuerpoEnemigos() {
    const lista = (estado.enemigos && estado.enemigos.enemigos) || [];
    if (!lista.length) {
      return `<div class="cr20-vacio">Todavía no tengo los enemigos. Abre Estadísticas en el Compendio (con tu cuenta de Admin), en este mismo navegador, y vuelve aquí.</div>`;
    }
    const enEscena = ((estado.enemigos && estado.enemigos.seleccion) || []).map(id => lista.find(e => e.id === id)).filter(Boolean);
    const q = estado.busqueda.trim().toLowerCase();
    let actual = lista.find(e => e.id === estado.enemigoId) || enEscena[0] || null;
    const sugeridos = q ? lista.filter(e => e.nombre.toLowerCase().includes(q)).slice(0, 8) : enEscena;
    if (actual) estado.enemigoId = actual.id;

    let cuerpo = "";
    if (actual) {
      const cats = ["Acciones", "Rasgos", "Tiradas"].filter(c => actual.items.some(i => i.categoria === c));
      if (!cats.includes(estado.filtroEnemigo)) estado.filtroEnemigo = cats[0];
      const items = actual.items.filter(i => i.categoria === estado.filtroEnemigo);
      cuerpo = `
        <div class="cr20-ficha"><strong style="color:#e8e4d0">${esc(actual.nombre)}</strong>${actual.ca !== null ? ` · CA ${esc(actual.ca)}` : ""}${actual.pv !== null ? ` · PV ${esc(actual.pv)}` : ""}<br>${esc(actual.rol)}</div>
        <div class="cr20-chips">${cats.map(c => `<button type="button" class="cr20-chip ${estado.filtroEnemigo === c ? "on" : ""}" data-filtro-enemigo="${c}">${c}</button>`).join("")}</div>
        <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-enemigo-item="${esc(i.id)}"${i.desc ? ` data-desc="${esc(i.desc)}"` : ""}>${esc(i.texto)}</button>`).join("")}</div>`;
    } else {
      cuerpo = `<div class="cr20-vacio">Marca enemigos con "+ Comparar" en Estadísticas para tenerlos aquí, o búscalos por nombre.</div>`;
    }

    return `
      ${controlesComunes()}
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar enemigo..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${sugeridos.map(e => `<button type="button" class="cr20-chip ${actual && actual.id === e.id ? "on" : ""}" data-enemigo="${esc(e.id)}">${esc(e.nombre)}</button>`).join("") || `<span class="cr20-vacio" style="padding:0">Sin enemigos en escena.</span>`}</div>
      ${cuerpo}`;
  }

  /* --- Descripción al pasar el mouse ------------------------------------- */
  function ocultarDescripcion() {
    const t = document.getElementById("cr20-tip");
    if (t) t.remove();
  }

  // Qué va a tirar, leído del comando que se manda al chat: "Ataque: 1d20+5"
  function resumenComando(cmd) {
    return String(cmd || "").split("\n")
      .filter(l => l && !l.startsWith("/em"))
      .map(l => l.replace(/\[\[(.*?)\]\]/g, "$1"))
      .join("\n");
  }

  function textoTooltip(boton) {
    const partes = [];
    const calc = boton.dataset.calc || boton.dataset.cmdResumen;
    if (calc) partes.push("Cálculo\n" + calc);
    if (boton.dataset.desc) partes.push(boton.dataset.desc);
    return partes.join("\n\n");
  }

  function mostrarDescripcion(boton) {
    ocultarDescripcion();
    const texto = textoTooltip(boton);
    if (!texto) return;
    const tip = document.createElement("div");
    tip.id = "cr20-tip";
    tip.textContent = texto;
    document.body.appendChild(tip);
    // Al lado del panel (a la derecha si cabe, si no a la izquierda), a la altura de la tirada
    const pr = panel.getBoundingClientRect();
    const br = boton.getBoundingClientRect();
    const ancho = tip.offsetWidth;
    let x = pr.right + 8;
    if (x + ancho > window.innerWidth) x = Math.max(4, pr.left - ancho - 8);
    let y = br.top;
    if (y + tip.offsetHeight > window.innerHeight) y = Math.max(4, window.innerHeight - tip.offsetHeight - 4);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  /* --- Ventana de confirmación: descripción, cálculo y tirada editable --- */
  function buscarItem(boton) {
    if (boton.dataset.id) {
      const p = estado.personajes.find(x => x.id === estado.personajeId) || estado.personajes[0];
      return p && p.items.find(i => i.id === boton.dataset.id);
    }
    if (boton.dataset.enemigoItem) {
      const lista = (estado.enemigos && estado.enemigos.enemigos) || [];
      const enemigo = lista.find(e => e.id === estado.enemigoId);
      return enemigo && enemigo.items.find(i => i.id === boton.dataset.enemigoItem);
    }
    return null;
  }

  function lanzar(item) {
    if (!estado.confirmar) {
      if (item.municion && item.municion.actual <= 0) { aviso("Sin munición. Recárgala en tu ficha del Compendio."); return; }
      enviarAlChat(item.cmd[estado.modo] || item.cmd.normal);
      gastarMunicion(item);
      return;
    }
    abrirConfirmacion(item);
  }

  /* Descuenta 1 de munición en la ficha (función fichas_gastar_municion en Supabase,
     scratchpad/municion_ataques.sql). Si falla, la tirada igual se mandó. */
  async function gastarMunicion(item) {
    if (!item.municion) return;
    const p = estado.personajes.find(x => x.id === estado.personajeId) || estado.personajes[0];
    if (!p) return;
    try {
      const token = await tokenValido();
      if (!token) throw new Error("sin sesión");
      const nuevo = await pedir({ metodo: "POST", ruta: "/rest/v1/rpc/fichas_gastar_municion", cuerpo: { p_ficha: p.id, p_ataque: item.municion.ataque }, token });
      item.municion.actual = Number(nuevo);
      GM_setValue("compendio_cache", JSON.stringify(estado.personajes));
      pintar();
    } catch (e) {
      aviso("No pude descontar la munición de tu ficha. Ajústala a mano en el Compendio.");
    }
  }

  function cerrarConfirmacion() {
    const f = document.getElementById("cr20-modal-fondo");
    if (f) f.remove();
  }

  function abrirConfirmacion(item) {
    cerrarConfirmacion();
    ocultarDescripcion();
    const fondo = document.createElement("div");
    fondo.id = "cr20-modal-fondo";
    const calc = item.calc || resumenComando(item.cmd[estado.modo] || item.cmd.normal);
    fondo.innerHTML = `
      <div id="cr20-modal" role="dialog" aria-modal="true">
        <div class="cr20-cat">${esc(item.categoria || "")}</div>
        <h3>${esc(item.texto)}</h3>
        ${item.desc ? `<div class="cr20-bloque"><span class="cr20-etq">Descripción</span><div class="cr20-texto">${esc(item.desc)}</div></div>` : ""}
        ${calc ? `<div class="cr20-bloque"><span class="cr20-etq">Cálculo</span><div class="cr20-texto">${esc(calc)}</div></div>` : ""}
        ${item.municion ? `<div class="cr20-bloque"><span class="cr20-etq">Munición</span>
          ${item.municion.actual > 0
            ? `<label><input type="checkbox" id="cr20-m-gastar" checked> Gastar 1 (${item.municion.actual} → ${item.municion.actual - 1} de ${item.municion.max})</label>`
            : `<div class="cr20-texto">Sin munición (0 / ${item.municion.max}). Recárgala en tu ficha del Compendio.</div>`}
        </div>` : ""}
        <div class="cr20-bloque">
          <span class="cr20-etq">Tirada (editable)</span>
          <select id="cr20-m-modo">
            <option value="normal">Normal</option>
            <option value="ventaja">Ventaja</option>
            <option value="desventaja">Desventaja</option>
          </select>
          <textarea id="cr20-m-cmd" spellcheck="false"></textarea>
          <div class="cr20-ayuda">Cambia los dados o los bonos dentro de [[ ]]. Cada línea se manda como un mensaje al chat.</div>
        </div>
        <div class="cr20-botones">
          <button type="button" class="cr20-accion" id="cr20-m-cancelar">Cancelar</button>
          <button type="button" class="cr20-accion" id="cr20-m-lanzar" style="border-color:#a9a58f">Lanzar</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);

    const selModo = fondo.querySelector("#cr20-m-modo");
    const area = fondo.querySelector("#cr20-m-cmd");
    const poner = modo => { area.value = item.cmd[modo] || item.cmd.normal; };
    selModo.value = item.cmd[estado.modo] ? estado.modo : "normal";
    poner(selModo.value);
    selModo.addEventListener("change", () => poner(selModo.value));

    const sinMunicion = item.municion && item.municion.actual <= 0;
    const botonLanzar = fondo.querySelector("#cr20-m-lanzar");
    if (sinMunicion) { botonLanzar.disabled = true; botonLanzar.style.opacity = ".45"; botonLanzar.style.cursor = "not-allowed"; }
    const lanzarYa = () => {
      if (sinMunicion) return;
      const texto = area.value.trim();
      const gastar = !!fondo.querySelector("#cr20-m-gastar")?.checked;
      cerrarConfirmacion();
      if (texto) enviarAlChat(texto);
      if (texto && gastar) gastarMunicion(item);
    };
    fondo.querySelector("#cr20-m-lanzar").addEventListener("click", lanzarYa);
    fondo.querySelector("#cr20-m-cancelar").addEventListener("click", cerrarConfirmacion);
    fondo.addEventListener("mousedown", e => { if (e.target === fondo) cerrarConfirmacion(); });
    // Roll20 tiene atajos de teclado: que no se enteren de lo que se escribe aquí
    fondo.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape") cerrarConfirmacion();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) lanzarYa();
    }, true);
    fondo.addEventListener("keyup", e => e.stopPropagation(), true);
    fondo.addEventListener("keypress", e => e.stopPropagation(), true);
    area.focus();
  }

  function enlazar() {
    ocultarDescripcion();
    panel.querySelectorAll(".cr20-item").forEach(b => {
      // Sin desglose propio (enemigos, macros), se muestra lo que tira el comando
      if (!b.dataset.calc) {
        const item = buscarItem(b);
        if (item) b.dataset.cmdResumen = resumenComando(item.cmd[estado.modo] || item.cmd.normal);
      }
      b.addEventListener("mouseenter", () => mostrarDescripcion(b));
      b.addEventListener("mouseleave", ocultarDescripcion);
    });
    panel.querySelector("#cr20-confirmar")?.addEventListener("change", e => {
      estado.confirmar = e.target.checked;
      GM_setValue("compendio_confirmar", estado.confirmar);
    });

    panel.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => {
      estado.vista = b.dataset.vista;
      estado.busqueda = "";
      GM_setValue("compendio_vista", estado.vista);
      pintar();
    }));
    panel.querySelector("#cr20-modo")?.addEventListener("change", e => { estado.modo = e.target.value; });
    panel.querySelector("#cr20-susurro")?.addEventListener("change", e => {
      estado.susurro = e.target.checked;
      GM_setValue("compendio_susurro", estado.susurro);
    });
    panel.querySelector("#cr20-pj")?.addEventListener("change", e => {
      estado.personajeId = e.target.value;
      GM_setValue("compendio_personaje", estado.personajeId);
      pintar();
    });
    const buscar = panel.querySelector("#cr20-buscar");
    if (buscar) buscar.addEventListener("input", e => {
      estado.busqueda = e.target.value;
      const pos = e.target.selectionStart;
      pintar();
      const nuevo = panel.querySelector("#cr20-buscar");
      nuevo.focus();
      nuevo.setSelectionRange(pos, pos);
    });
    panel.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => { estado.filtro = b.dataset.filtro; pintar(); }));

    // Sesión
    const entrar = async () => {
      const email = panel.querySelector("#cr20-email").value.trim();
      const pass = panel.querySelector("#cr20-pass").value;
      if (!email || !pass) return;
      estado.error = "";
      try {
        await iniciarSesion(email, pass);
        await cargarPersonajes();
      } catch (e) {
        estado.error = "Correo o contraseña incorrectos.";
        pintar();
      }
    };
    panel.querySelector("#cr20-entrar")?.addEventListener("click", entrar);
    panel.querySelector("#cr20-pass")?.addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
    panel.querySelector("#cr20-refrescar")?.addEventListener("click", cargarPersonajes);
    panel.querySelector("#cr20-salir")?.addEventListener("click", () => { cerrarSesion(); pintar(); });

    // Personaje: botón de una tirada
    panel.querySelectorAll(".cr20-item[data-id]").forEach(b => b.addEventListener("click", () => {
      const item = buscarItem(b);
      if (item) lanzar(item);
    }));

    // Enemigos
    panel.querySelectorAll("[data-enemigo]").forEach(b => b.addEventListener("click", () => {
      estado.enemigoId = b.dataset.enemigo;
      GM_setValue("compendio_enemigo", estado.enemigoId);
      estado.busqueda = "";
      pintar();
    }));
    panel.querySelectorAll("[data-filtro-enemigo]").forEach(b => b.addEventListener("click", () => { estado.filtroEnemigo = b.dataset.filtroEnemigo; pintar(); }));
    panel.querySelectorAll("[data-enemigo-item]").forEach(b => b.addEventListener("click", () => {
      const item = buscarItem(b);
      if (item) lanzar(item);
    }));
  }

  cargarEnemigos();
  pintar();
  if (estado.sesion) cargarPersonajes();
  if (typeof GM_addValueChangeListener === "function") {
    GM_addValueChangeListener(FUENTE_ENEMIGOS.gm, () => { cargarEnemigos(); pintar(); });
  }
  // Mientras el panel está abierto, los personajes se refrescan solos cada par de minutos
  setInterval(() => { if (estado.abierto && estado.sesion && !estado.cargando && estado.vista === "personaje") cargarPersonajes(); }, 120000);
})();
