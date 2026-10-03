// ==UserScript==
// @name         Compendio → Roll20
// @namespace    https://fratiga.github.io/Dih-and-Dih/
// @version      2.0.0
// @description  Muestra dentro de Roll20 las tiradas de tus personajes del Compendio y las manda al chat con un clic.
// @match        https://app.roll20.net/editor*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
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

  const estado = {
    sesion: leerJSON("compendio_sesion"),
    personajes: leerJSON("compendio_cache") || [],
    personajeId: GM_getValue("compendio_personaje", ""),
    modo: "normal",
    filtro: "favoritas",
    busqueda: "",
    abierto: GM_getValue("compendio_abierto", true),
    cargando: false,
    error: ""
  };

  function leerJSON(clave) {
    try { return JSON.parse(GM_getValue(clave, "") || "null"); } catch (e) { return null; }
  }

  /* =========================================================================
     Supabase por HTTP (GM_xmlhttpRequest evita los bloqueos de CORS/CSP de Roll20)
  ========================================================================= */
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
    GM_deleteValue("compendio_sesion");
    GM_deleteValue("compendio_cache");
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

  /* =========================================================================
     Panel flotante
  ========================================================================= */
  GM_addStyle(`
    #cr20-boton { position: fixed; left: 10px; bottom: 10px; z-index: 99999; background: #1d1e20; color: #e8e4d0;
      border: 1px solid #5a5a48; padding: 8px 12px; font: 600 13px sans-serif; cursor: pointer; }
    #cr20-panel { position: fixed; left: 10px; bottom: 52px; z-index: 99999; width: 330px; max-height: 70vh;
      display: flex; flex-direction: column; background: #1d1e20; color: #e8e4d0; border: 1px solid #5a5a48;
      font: 13px sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
    #cr20-panel[hidden] { display: none; }
    #cr20-panel select, #cr20-panel input { background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34;
      padding: 6px 8px; font: 13px sans-serif; box-sizing: border-box; }
    #cr20-panel button.cr20-accion { background: #26272a; color: #e8e4d0; border: 1px solid #5a5a48; padding: 7px 10px; font: 13px sans-serif; cursor: pointer; }
    .cr20-fila { display: flex; gap: 6px; padding: 8px 10px 0; align-items: center; }
    .cr20-fila > * { flex: 1; min-width: 0; }
    .cr20-fila > .cr20-chico { flex: 0 0 auto; }
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
    #cr20-toast { position: fixed; left: 10px; bottom: 56px; z-index: 100000; background: #26272a; color: #e8e4d0;
      border: 1px solid #a9a58f; padding: 8px 12px; font: 13px sans-serif; max-width: 320px; }
  `);

  const boton = document.createElement("button");
  boton.id = "cr20-boton";
  boton.type = "button";
  boton.textContent = "Compendio";
  const panel = document.createElement("div");
  panel.id = "cr20-panel";
  document.body.append(boton, panel);

  boton.addEventListener("click", () => {
    estado.abierto = !estado.abierto;
    GM_setValue("compendio_abierto", estado.abierto);
    pintar();
    if (estado.abierto && estado.sesion) cargarPersonajes();
  });

  function personajeActual() {
    return estado.personajes.find(p => p.id === estado.personajeId) || estado.personajes[0] || null;
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
    const lineas = String(texto).split("\n").filter(Boolean);
    const area = document.querySelector("#textchat-input textarea");
    if (!area) {
      GM_setClipboard(texto);
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

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --- Pantallas ---------------------------------------------------------- */
  function pintarLogin() {
    panel.innerHTML = `
      <div class="cr20-vacio">Entra con tu cuenta del Compendio (la misma de Mis personajes). Solo hace falta una vez; no guardo tu contraseña.</div>
      <div class="cr20-fila"><input id="cr20-email" type="email" placeholder="Correo" autocomplete="username"></div>
      <div class="cr20-fila"><input id="cr20-pass" type="password" placeholder="Contraseña" autocomplete="current-password"></div>
      ${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}
      <div class="cr20-fila" style="padding-bottom:10px"><button type="button" class="cr20-accion" id="cr20-entrar">Entrar</button></div>`;
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
    panel.querySelector("#cr20-entrar").addEventListener("click", entrar);
    panel.querySelector("#cr20-pass").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
  }

  function pintar() {
    panel.hidden = !estado.abierto;
    if (!estado.abierto) return;
    if (!estado.sesion) { pintarLogin(); return; }

    const pie = `<div class="cr20-pie"><span>${estado.cargando ? "Actualizando…" : esc(estado.sesion.email)}</span><span><a id="cr20-refrescar">Actualizar</a> · <a id="cr20-salir">Salir</a></span></div>`;
    const p = personajeActual();
    if (!p) {
      panel.innerHTML = `<div class="cr20-vacio">${estado.cargando ? "Cargando tus personajes…" : "Todavía no hay personajes publicados. Abre Mis personajes en el Compendio una vez (se publican solos) y pulsa Actualizar."}</div>${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}${pie}`;
      enlazarPie();
      return;
    }

    const categorias = [...new Set(p.items.map(i => i.categoria))];
    const hayFavoritas = p.items.some(i => i.favorita);
    if (estado.filtro === "favoritas" && !hayFavoritas) estado.filtro = "todas";

    const chips = [["favoritas", "★ Favoritas"], ["todas", "Todas"], ...categorias.map(c => [c, c])];
    const q = estado.busqueda.trim().toLowerCase();
    const items = p.items.filter(i => {
      if (estado.filtro === "favoritas" && !i.favorita) return false;
      if (estado.filtro !== "favoritas" && estado.filtro !== "todas" && i.categoria !== estado.filtro) return false;
      return !q || i.texto.toLowerCase().includes(q);
    });
    const hayVariosDuenos = new Set(estado.personajes.map(x => x.dueno)).size > 1;
    const etiqueta = x => (hayVariosDuenos && x.dueno ? `${x.nombre} (${x.dueno})` : x.nombre);

    panel.innerHTML = `
      <div class="cr20-fila">
        ${estado.personajes.length > 1 ? `<select id="cr20-pj">${estado.personajes.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(etiqueta(x))}</option>`).join("")}</select>` : `<strong style="padding:6px 0">${esc(p.nombre)}</strong>`}
        <select id="cr20-modo">
          <option value="normal" ${estado.modo === "normal" ? "selected" : ""}>Normal</option>
          <option value="ventaja" ${estado.modo === "ventaja" ? "selected" : ""}>Ventaja</option>
          <option value="desventaja" ${estado.modo === "desventaja" ? "selected" : ""}>Desventaja</option>
        </select>
      </div>
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${chips.map(([v, t]) => `<button type="button" class="cr20-chip ${estado.filtro === v ? "on" : ""}" data-filtro="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      ${estado.error ? `<div class="cr20-error">${esc(estado.error)}</div>` : ""}
      <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-id="${esc(i.id)}"><small>${esc(i.categoria)}</small>${esc(i.texto)}</button>`).join("") || `<div class="cr20-vacio">Nada coincide.</div>`}</div>
      ${pie}`;

    panel.querySelector("#cr20-pj")?.addEventListener("change", e => {
      estado.personajeId = e.target.value;
      GM_setValue("compendio_personaje", estado.personajeId);
      pintar();
    });
    panel.querySelector("#cr20-modo").addEventListener("change", e => { estado.modo = e.target.value; });
    panel.querySelector("#cr20-buscar").addEventListener("input", e => {
      estado.busqueda = e.target.value;
      const pos = e.target.selectionStart;
      pintar();
      const nuevo = panel.querySelector("#cr20-buscar");
      nuevo.focus();
      nuevo.setSelectionRange(pos, pos);
    });
    panel.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => { estado.filtro = b.dataset.filtro; pintar(); }));
    panel.querySelectorAll(".cr20-item").forEach(b => b.addEventListener("click", () => {
      const item = p.items.find(i => i.id === b.dataset.id);
      if (!item) return;
      enviarAlChat(item.cmd[estado.modo] || item.cmd.normal);
    }));
    enlazarPie();
  }

  function enlazarPie() {
    const ref = panel.querySelector("#cr20-refrescar");
    if (ref) ref.addEventListener("click", cargarPersonajes);
    const salir = panel.querySelector("#cr20-salir");
    if (salir) salir.addEventListener("click", () => { cerrarSesion(); pintar(); });
  }

  pintar();
  if (estado.sesion) cargarPersonajes();
  // Mientras el panel está abierto, se refresca solo cada par de minutos
  setInterval(() => { if (estado.abierto && estado.sesion && !estado.cargando) cargarPersonajes(); }, 120000);
})();
