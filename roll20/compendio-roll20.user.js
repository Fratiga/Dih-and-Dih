// ==UserScript==
// @name         Compendio → Roll20
// @namespace    https://fratiga.github.io/Dih-and-Dih/
// @version      1.1.0
// @description  Muestra dentro de Roll20 las tiradas de tus personajes y las habilidades de los enemigos del Compendio, y las manda al chat con un clic.
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

  // Cada fuente: lo que publica la página del Compendio -> dónde lo guarda este script.
  const FUENTES = [
    { local: "compendioRoll20Datos", gm: "compendio_roll20_datos", mensaje: "compendio-roll20-datos" },       // Mis personajes
    { local: "compendioRoll20Enemigos", gm: "compendio_roll20_enemigos", mensaje: "compendio-roll20-enemigos" } // Estadísticas (enemigos)
  ];

  /* =========================================================================
     LADO DEL COMPENDIO: copia lo que publica la página al almacenamiento del
     script, para que Roll20 (otro sitio) pueda leerlo.
  ========================================================================= */
  if (location.hostname !== "app.roll20.net") {
    const copiar = (clave, texto) => {
      if (texto && texto !== GM_getValue(clave, "")) GM_setValue(clave, texto);
    };
    const leerLocal = () => {
      FUENTES.forEach(f => {
        try { copiar(f.gm, localStorage.getItem(f.local)); } catch (e) { /* sin acceso */ }
      });
    };
    leerLocal();
    window.addEventListener("message", e => {
      if (e.source !== window || !e.data) return;
      const f = FUENTES.find(x => x.mensaje === e.data.tipo);
      if (f) { try { copiar(f.gm, JSON.stringify(e.data.payload)); } catch (err) { /* ignorar */ } }
    });
    window.addEventListener("storage", leerLocal);
    setInterval(leerLocal, 4000);
    return;
  }

  /* =========================================================================
     LADO DE ROLL20: panel flotante con las tiradas.
  ========================================================================= */
  const estado = {
    personajes: null,
    enemigos: null,
    vista: GM_getValue("compendio_vista", "personaje"), // "personaje" | "enemigos"
    personajeId: GM_getValue("compendio_personaje", ""),
    enemigoId: GM_getValue("compendio_enemigo", ""),
    modo: "normal",
    susurro: GM_getValue("compendio_susurro", false),
    filtro: "favoritas",
    filtroEnemigo: "Acciones",
    busqueda: "",
    abierto: GM_getValue("compendio_abierto", true)
  };

  GM_addStyle(`
    #cr20-boton { position: fixed; left: 10px; bottom: 10px; z-index: 99999; background: #1d1e20; color: #e8e4d0;
      border: 1px solid #5a5a48; padding: 8px 12px; font: 600 13px sans-serif; cursor: pointer; }
    #cr20-panel { position: fixed; left: 10px; bottom: 52px; z-index: 99999; width: 340px; max-height: 72vh;
      display: flex; flex-direction: column; background: #1d1e20; color: #e8e4d0; border: 1px solid #5a5a48;
      font: 13px sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
    #cr20-panel[hidden] { display: none; }
    #cr20-panel select, #cr20-panel input[type=search] { background: #26272a; color: #e8e4d0; border: 1px solid #3a3a34;
      padding: 6px 8px; font: 13px sans-serif; box-sizing: border-box; }
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
    .cr20-ficha { padding: 8px 10px 0; color: #a9a58f; font-size: 12px; }
    .cr20-susurro { display: flex; align-items: center; gap: 6px; color: #a9a58f; font-size: 12px; padding: 8px 10px 0; }
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

  function leerJson(clave) {
    try { return JSON.parse(GM_getValue(clave, "") || "null"); } catch (e) { return null; }
  }

  function cargarDatos() {
    estado.personajes = leerJson(FUENTES[0].gm);
    estado.enemigos = leerJson(FUENTES[1].gm);
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
    if (estado.susurro) lineas = lineas.filter(l => !l.startsWith("/em")).map(l => `/w gm ${l}`);
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
        <label class="cr20-susurro" style="padding:0;flex:1.2"><input type="checkbox" id="cr20-susurro" ${estado.susurro ? "checked" : ""}> Solo yo (susurro)</label>
      </div>`;
  }

  function pintar() {
    panel.hidden = !estado.abierto;
    if (!estado.abierto) return;
    panel.innerHTML = cabecera() + (estado.vista === "enemigos" ? cuerpoEnemigos() : cuerpoPersonaje());
    enlazar();
  }

  function cuerpoPersonaje() {
    const lista = (estado.personajes && estado.personajes.personajes) || [];
    const p = lista.find(x => x.id === estado.personajeId) || lista[0] || null;
    if (!p) {
      return `<div class="cr20-vacio">Todavía no tengo tus personajes. Abre el Compendio (Mis personajes) con tu cuenta, en este mismo navegador, y vuelve aquí.</div>`;
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
    return `
      <div class="cr20-fila">
        ${lista.length > 1 ? `<select id="cr20-pj">${lista.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>` : `<strong style="padding:6px 0">${esc(p.nombre)}</strong>`}
      </div>
      ${controlesComunes()}
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${chips.map(([v, t]) => `<button type="button" class="cr20-chip ${estado.filtro === v ? "on" : ""}" data-filtro="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-id="${esc(i.id)}"><small>${esc(i.categoria)}</small>${esc(i.texto)}</button>`).join("") || `<div class="cr20-vacio">Nada coincide.</div>`}</div>`;
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
        <div id="cr20-lista">${items.map(i => `<button type="button" class="cr20-item" data-enemigo-item="${esc(i.id)}">${esc(i.texto)}</button>`).join("")}</div>`;
    } else {
      cuerpo = `<div class="cr20-vacio">Marca enemigos con "+ Comparar" en Estadísticas para tenerlos aquí, o búscalos por nombre.</div>`;
    }

    return `
      ${controlesComunes()}
      <div class="cr20-fila"><input id="cr20-buscar" type="search" placeholder="Buscar enemigo..." value="${esc(estado.busqueda)}"></div>
      <div class="cr20-chips">${sugeridos.map(e => `<button type="button" class="cr20-chip ${actual && actual.id === e.id ? "on" : ""}" data-enemigo="${esc(e.id)}">${esc(e.nombre)}</button>`).join("") || `<span class="cr20-vacio" style="padding:0">Sin enemigos en escena.</span>`}</div>
      ${cuerpo}`;
  }

  function enlazar() {
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

    // Personaje: botón de una tirada
    panel.querySelectorAll(".cr20-item[data-id]").forEach(b => b.addEventListener("click", () => {
      const lista = (estado.personajes && estado.personajes.personajes) || [];
      const p = lista.find(x => x.id === estado.personajeId) || lista[0];
      const item = p && p.items.find(i => i.id === b.dataset.id);
      if (item) enviarAlChat(item.cmd[estado.modo] || item.cmd.normal);
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
      const lista = (estado.enemigos && estado.enemigos.enemigos) || [];
      const enemigo = lista.find(e => e.id === estado.enemigoId);
      const item = enemigo && enemigo.items.find(i => i.id === b.dataset.enemigoItem);
      if (item) enviarAlChat(item.cmd[estado.modo] || item.cmd.normal);
    }));
  }

  cargarDatos();
  pintar();
  if (typeof GM_addValueChangeListener === "function") {
    FUENTES.forEach(f => GM_addValueChangeListener(f.gm, () => { cargarDatos(); pintar(); }));
  }
})();
