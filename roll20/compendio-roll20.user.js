// ==UserScript==
// @name         Compendio → Roll20
// @namespace    https://fratiga.github.io/Dih-and-Dih/
// @version      1.0.0
// @description  Muestra dentro de Roll20 las tiradas de tus personajes del Compendio y las manda al chat con un clic.
// @match        https://app.roll20.net/editor*
// @match        https://fratiga.github.io/Dih-and-Dih/*
// @match        http://localhost:8845/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// @updateURL    https://fratiga.github.io/Dih-and-Dih/roll20/compendio-roll20.user.js
// @downloadURL  https://fratiga.github.io/Dih-and-Dih/roll20/compendio-roll20.user.js
// ==/UserScript==

(function () {
  "use strict";

  const CLAVE_LOCAL = "compendioRoll20Datos"; // lo escribe la página del Compendio (Mis personajes)
  const CLAVE_GM = "compendio_roll20_datos";

  /* =========================================================================
     LADO DEL COMPENDIO: copia los personajes que publica la página al
     almacenamiento del script, para que Roll20 (otro sitio) pueda leerlos.
  ========================================================================= */
  if (location.hostname !== "app.roll20.net") {
    const copiar = texto => {
      if (texto && texto !== GM_getValue(CLAVE_GM, "")) GM_setValue(CLAVE_GM, texto);
    };
    const leerLocal = () => {
      try { copiar(localStorage.getItem(CLAVE_LOCAL)); } catch (e) { /* sin acceso */ }
    };
    leerLocal();
    window.addEventListener("message", e => {
      if (e.source === window && e.data && e.data.tipo === "compendio-roll20-datos") {
        try { copiar(JSON.stringify(e.data.payload)); } catch (err) { /* ignorar */ }
      }
    });
    window.addEventListener("storage", leerLocal);
    setInterval(leerLocal, 4000);
    return;
  }

  /* =========================================================================
     LADO DE ROLL20: panel flotante con las tiradas.
  ========================================================================= */
  const estado = {
    datos: null,
    personajeId: GM_getValue("compendio_personaje", ""),
    modo: "normal",
    filtro: "favoritas",
    busqueda: "",
    abierto: GM_getValue("compendio_abierto", true)
  };

  GM_addStyle(`
    #cr20-boton { position: fixed; left: 10px; bottom: 10px; z-index: 99999; background: #1d1e20; color: #e8e4d0;
      border: 1px solid #5a5a48; padding: 8px 12px; font: 600 13px sans-serif; cursor: pointer; }
    #cr20-panel { position: fixed; left: 10px; bottom: 52px; z-index: 99999; width: 330px; max-height: 70vh;
      display: flex; flex-direction: column; background: #1d1e20; color: #e8e4d0; border: 1px solid #5a5a48;
      font: 13px sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
    #cr20-panel[hidden] { display: none; }
    #cr20-panel select, #cr20-panel input { background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34;
      padding: 6px 8px; font: 13px sans-serif; box-sizing: border-box; }
    .cr20-fila { display: flex; gap: 6px; padding: 8px 10px 0; }
    .cr20-fila > * { flex: 1; min-width: 0; }
    .cr20-chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 10px 0; }
    .cr20-chip { background: none; color: #a9a58f; border: 1px solid #3a3a34; padding: 3px 8px; font: 12px sans-serif; cursor: pointer; }
    .cr20-chip.on { color: #e8e4d0; border-color: #a9a58f; background: #26272a; }
    #cr20-lista { overflow-y: auto; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
    .cr20-item { text-align: left; background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34; padding: 7px 9px; cursor: pointer; font: 13px sans-serif; }
    .cr20-item:hover { border-color: #a9a58f; }
    .cr20-item small { display: block; color: #8d8977; font-size: 11px; }
    .cr20-vacio { color: #a9a58f; padding: 12px 10px; line-height: 1.5; }
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
  });

  function cargarDatos() {
    try { estado.datos = JSON.parse(GM_getValue(CLAVE_GM, "") || "null"); } catch (e) { estado.datos = null; }
  }

  function personajeActual() {
    const lista = (estado.datos && estado.datos.personajes) || [];
    return lista.find(p => p.id === estado.personajeId) || lista[0] || null;
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

  /* --- Panel -------------------------------------------------------------- */
  function pintar() {
    panel.hidden = !estado.abierto;
    if (!estado.abierto) return;

    const p = personajeActual();
    if (!p) {
      panel.innerHTML = `<div class="cr20-vacio">Todavía no tengo tus personajes. Abre el Compendio (Mis personajes) con tu cuenta, en este mismo navegador, y vuelve aquí.</div>`;
      return;
    }

    const lista = estado.datos.personajes;
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

    panel.innerHTML = `
      <div class="cr20-fila">
        ${lista.length > 1 ? `<select id="cr20-pj">${lista.map(x => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>` : `<strong style="padding:6px 0">${esc(p.nombre)}</strong>`}
        <select id="cr20-modo">
          <option value="normal" ${estado.modo === "normal" ? "selected" : ""}>Normal</option>
          <option value="ventaja" ${estado.modo === "ventaja" ? "selected" : ""}>Ventaja</option>
          <option value="desventaja" ${estado.modo === "desventaja" ? "selected" : ""}>Desventaja</option>
        </select>
      </div>
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${chips.map(([v, t]) => `<button type="button" class="cr20-chip ${estado.filtro === v ? "on" : ""}" data-filtro="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-id="${esc(i.id)}"><small>${esc(i.categoria)}</small>${esc(i.texto)}</button>`).join("") || `<div class="cr20-vacio">Nada coincide.</div>`}</div>`;

    panel.querySelector("#cr20-pj")?.addEventListener("change", e => {
      estado.personajeId = e.target.value;
      GM_setValue("compendio_personaje", estado.personajeId);
      pintar();
    });
    panel.querySelector("#cr20-modo").addEventListener("change", e => { estado.modo = e.target.value; });
    const buscar = panel.querySelector("#cr20-buscar");
    buscar.addEventListener("input", e => {
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
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  cargarDatos();
  pintar();
  if (typeof GM_addValueChangeListener === "function") {
    GM_addValueChangeListener(CLAVE_GM, () => { cargarDatos(); pintar(); });
  }
})();
