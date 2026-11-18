/* =============================================================================
   LA FRACTURA · MÚSICA DE LOS HÉROES
   El Admin elige una canción para cada héroe. Cuando alguien invoca a ese héroe en el tablero, la música de la
   partida se calla y suena la suya, para todos los que estén mirando esa guerra.
   - La configuración vive en la tabla musica_paginas, en la fila 'fractura-heroes.html' (no es una página de verdad:
     así se reutilizan musica_pagina_guardar y su permiso de Admin, sin SQL nuevo). Forma:
       { "heroes": { "<id del héroe>": { "ruta": "<enlace público>", "volumen": 0.6, "modo": "vive" | "una" } } }
     "vive": suena en bucle mientras el héroe siga vivo. "una": suena una vez y vuelve la música de la partida.
   - Las canciones salen de la Rocola de fondos del Admin (js/musica-fondos.js), que se carga solo al abrir el editor.
   - El editor solo aparece con la cuenta de Admin: la marca del navegador (compendioAdmin) enseña el botón y el
     servidor (fichas_es_admin) lo confirma.
============================================================================= */
window.FracturaMusicaHeroes = (function () {
  "use strict";
  const D = window.FRACTURA_DATOS;
  const CLAVE = "fractura-heroes.html", CACHE = "fracturaMusicaHeroes";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const urlDe = r => { try { return encodeURI(decodeURI(r)); } catch (e) { return encodeURI(r); } };

  let heroes = {};
  try { heroes = (JSON.parse(localStorage.getItem(CACHE) || "{}") || {}).heroes || {}; } catch (e) { heroes = {}; }
  let activa = true;               // el jugador puede apagarla en Ajustes
  let sonando = null;              // { heroe, audio, modo }

  /* --- Configuración desde el servidor --- */
  async function cargar() {
    try {
      if (typeof fichasCliente !== "function") return heroes;
      const sb = await fichasCliente();
      const { data, error } = await sb.from("musica_paginas").select("config").eq("pagina", CLAVE).maybeSingle();
      if (error) return heroes;
      heroes = (data && data.config && data.config.heroes) || {};
      try { localStorage.setItem(CACHE, JSON.stringify({ heroes })); } catch (e) { /* sin almacenamiento */ }
    } catch (e) { /* sin conexión: se queda lo último que se sabía */ }
    return heroes;
  }

  /* --- Reproducción --- */
  const paginas = () => window.MusicaPaginas || null;
  const silenciada = () => { const mp = paginas(); return !!(mp && mp.estado && mp.estado().silencio); };
  /* La música de la página (js/musica-paginas.js) se calla mientras suena un héroe. Si intenta volver sola (al volver a
     la pestaña, al tocar algo), se vuelve a pausar. Al acabar el tema del héroe, sigue por donde iba. */
  let vigilada = false;
  function apartarPagina(si) {
    const mp = paginas();
    if (!mp || !mp.audio) return;
    if (!vigilada) { vigilada = true; mp.audio.addEventListener("play", () => { if (sonando) mp.audio.pause(); }); }
    if (si) mp.audio.pause();
    else if (!silenciada() && mp.configurada && mp.configurada() && mp.audio.src && !document.hidden) mp.audio.play().catch(() => {});
  }

  function soltar(rapido) {
    const s = sonando;
    if (!s) return;
    sonando = null;
    const a = s.audio, v0 = a.volume, t0 = performance.now(), dur = rapido ? 200 : 1400;
    const paso = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      a.volume = v0 * (1 - k);
      if (k < 1) requestAnimationFrame(paso); else { a.pause(); a.src = ""; if (!sonando) apartarPagina(false); }
    };
    paso();
  }

  function alInvocar(heroeId) {
    const c = heroes[heroeId];
    if (!activa || !c || !c.ruta || silenciada()) return;
    if (sonando) { const s = sonando; sonando = null; s.audio.pause(); s.audio.src = ""; }
    const a = new Audio(urlDe(c.ruta));
    a.volume = Math.max(0, Math.min(1, Number(c.volumen ?? 0.6)));
    a.loop = c.modo !== "una";
    sonando = { heroe: heroeId, audio: a, modo: c.modo || "vive" };
    apartarPagina(true);
    a.addEventListener("ended", () => { if (sonando && sonando.audio === a) soltar(true); });
    a.addEventListener("error", () => { if (sonando && sonando.audio === a) soltar(true); });
    a.play().catch(() => { if (sonando && sonando.audio === a) soltar(true); });
  }
  function alCaer(heroeId) { if (sonando && sonando.heroe === heroeId && sonando.modo === "vive") soltar(false); }
  function alTerminar() { soltar(true); }
  document.addEventListener("visibilitychange", () => { if (!sonando) return; if (document.hidden) sonando.audio.pause(); else sonando.audio.play().catch(() => {}); });
  window.addEventListener("pagehide", () => soltar(true));

  /* --- ¿Admin? --- */
  const marcaAdmin = () => { try { return localStorage.getItem("compendioAdmin") === "1"; } catch (e) { return false; } };
  async function esAdmin() {
    if (!marcaAdmin() || typeof fichasCliente !== "function") return false;
    try { const sb = await fichasCliente(); const { data } = await sb.rpc("fichas_es_admin"); return data === true; } catch (e) { return false; }
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => {
      if (document.querySelector(`script[data-fmh="${src}"]`)) { ok(); return; }
      const s = document.createElement("script");
      s.src = src; s.dataset.fmh = src; s.onload = ok; s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  /* --- Editor (solo Admin) --- */
  let dlg = null, borrador = {}, previa = null, biblio = null;
  function pararPrevia() { if (previa) { previa.pause(); previa = null; } if (dlg) dlg.querySelectorAll("[data-oir].sonando").forEach(b => { b.classList.remove("sonando"); b.textContent = "▶"; }); }

  function filaHeroe(hid, fac) {
    const h = D.HEROES[hid], c = borrador[hid] || {}, canciones = window.MusicaFondos ? window.MusicaFondos.lista() : [];
    const conocida = !c.ruta || canciones.some(f => f.ruta === c.ruta);
    const FR = window.FracturaRetratos;
    const img = FR && FR.retratoURL ? `<img src="${FR.retratoURL({ faccion: fac, heroe: hid }, 56)}" alt="" width="56" height="71" loading="lazy">` : "";
    return `<div class="fmh-fila" data-h="${hid}">
      ${img}
      <div class="fmh-nombre"><strong>${esc(h.variantes ? h.variantes.join(" o ") : h.nombre)}</strong><small>${esc(D.FACCIONES[fac].corto)}</small></div>
      <select data-campo="ruta" aria-label="Canción de ${esc(h.nombre)}">
        <option value="">Sin música propia</option>
        ${canciones.map(f => `<option value="${esc(f.ruta)}"${f.ruta === c.ruta ? " selected" : ""}>${esc(f.titulo)}</option>`).join("")}
        ${conocida ? "" : `<option value="${esc(c.ruta)}" selected>${esc(c.ruta.split("/").pop())} (ya no está en la biblioteca)</option>`}
      </select>
      <button type="button" class="fr-btn fr-btn-chico" data-oir title="Escuchar"${c.ruta ? "" : " disabled"}>▶</button>
      <select data-campo="modo" aria-label="Cuánto suena"${c.ruta ? "" : " disabled"}>
        <option value="vive"${c.modo !== "una" ? " selected" : ""}>Mientras viva</option>
        <option value="una"${c.modo === "una" ? " selected" : ""}>Una vez</option>
      </select>
      <label class="fmh-vol" title="Volumen"><span>Vol.</span><input type="range" min="5" max="100" value="${Math.round((c.volumen ?? 0.6) * 100)}" data-campo="volumen"${c.ruta ? "" : " disabled"}></label>
    </div>`;
  }

  function pintar() {
    const cuerpo = dlg.querySelector(".fmh-lista");
    cuerpo.innerHTML = Object.keys(D.FACCIONES).map(f => (D.FACCIONES[f].heroe || []).map(h => filaHeroe(h, f)).join("")).join("");
  }
  function estado(t, mal) { const p = dlg.querySelector(".fmh-estado"); p.textContent = t || ""; p.classList.toggle("mal", !!mal); }

  function crear() {
    dlg = document.createElement("dialog");
    dlg.className = "fr-dialogo fr-dialogo-ancho fmh";
    dlg.innerHTML = `<h2 class="fr-h2">Música de los héroes</h2>
      <p class="fr-sub">Solo Admin. Cuando alguien invoca a un héroe en el tablero, se calla la música de la partida y suena la suya, para todos los que estén en esa guerra. «Mientras viva» la repite hasta que el héroe cae; «Una vez» la toca entera y vuelve la música de la partida.</p>
      <details class="fmh-biblio"><summary>Subir o quitar canciones de la Rocola de fondos</summary><div class="fmh-biblio-cuerpo"></div></details>
      <div class="fmh-lista"></div>
      <p class="fmh-estado" role="status"></p>
      <div class="fr-fila"><button type="button" class="fr-btn" data-cerrar>Cerrar</button><button type="button" class="fr-btn fr-btn-principal" data-guardar>Guardar</button></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("close", pararPrevia);
    dlg.addEventListener("toggle", ev => {
      const d = ev.target.closest && ev.target.closest(".fmh-biblio");
      if (d && d.open && !biblio && window.MusicaFondos) biblio = window.MusicaFondos.montar(d.querySelector(".fmh-biblio-cuerpo"), { alCambiar: pintar });
    }, true);
    dlg.addEventListener("change", ev => {
      const el = ev.target, fila = el.closest("[data-h]");
      if (!fila) return;
      const hid = fila.dataset.h, c = borrador[hid] = borrador[hid] || {};
      if (el.dataset.campo === "ruta") { if (el.value) c.ruta = el.value; else delete borrador[hid]; pararPrevia(); pintar(); }
      else if (el.dataset.campo === "modo") c.modo = el.value;
      else if (el.dataset.campo === "volumen") c.volumen = +el.value / 100;
    });
    dlg.addEventListener("input", ev => {
      if (ev.target.dataset.campo !== "volumen") return;
      const hid = ev.target.closest("[data-h]").dataset.h;
      if (borrador[hid]) borrador[hid].volumen = +ev.target.value / 100;
      if (previa && previa._h === hid) previa.volume = +ev.target.value / 100;
    });
    dlg.addEventListener("click", async ev => {
      if (ev.target.closest("[data-cerrar]")) { dlg.close(); return; }
      const oir = ev.target.closest("[data-oir]");
      if (oir) {
        const hid = oir.closest("[data-h]").dataset.h, c = borrador[hid];
        const era = oir.classList.contains("sonando");
        pararPrevia();
        if (era || !c || !c.ruta) return;
        previa = new Audio(urlDe(c.ruta)); previa.volume = c.volumen ?? 0.6; previa._h = hid;
        previa.play().catch(() => estado("No se pudo reproducir esa canción.", true));
        oir.classList.add("sonando"); oir.textContent = "■";
        return;
      }
      if (ev.target.closest("[data-guardar]")) {
        estado("Guardando...");
        try {
          const sb = await fichasCliente();
          const limpio = {};
          Object.keys(borrador).forEach(h => { const c = borrador[h]; if (c && c.ruta && D.HEROES[h]) limpio[h] = { ruta: c.ruta, volumen: Math.round((c.volumen ?? 0.6) * 100) / 100, modo: c.modo === "una" ? "una" : "vive" }; });
          const { error } = Object.keys(limpio).length
            ? await sb.rpc("musica_pagina_guardar", { p_pagina: CLAVE, p_config: { heroes: limpio } })
            : await sb.rpc("musica_pagina_quitar", { p_pagina: CLAVE });
          if (error) throw error;
          heroes = limpio;
          try { localStorage.setItem(CACHE, JSON.stringify({ heroes })); } catch (e) { /* sin almacenamiento */ }
          estado(`Guardado. ${Object.keys(limpio).length ? `${Object.keys(limpio).length} ${Object.keys(limpio).length === 1 ? "héroe tiene" : "héroes tienen"} música propia.` : "Ningún héroe tiene música propia."}`);
        } catch (e) {
          estado(`No se pudo guardar: ${e.message || e}. ¿Tienes la sesión de Admin iniciada?`, true);
        }
      }
    });
  }

  async function abrir() {
    if (!(await esAdmin())) { alert("Solo el Admin puede elegir la música de los héroes."); return; }
    if (!dlg) crear();
    estado("Cargando la biblioteca...");
    try {
      if (!window.MusicaFondos) await cargarScript("js/musica-fondos.js");
      await Promise.all([window.MusicaFondos.cargar(true), cargar()]);
      estado("");
    } catch (e) { estado(`No se pudo cargar la Rocola de fondos: ${e.message || e}`, true); }
    borrador = JSON.parse(JSON.stringify(heroes || {}));
    pintar();
    if (!dlg.open) dlg.showModal();
  }

  cargar();
  return { cargar, alInvocar, alCaer, alTerminar, esAdmin, abrir, activar: si => { activa = si !== false; if (!activa) soltar(true); }, sonando: () => (sonando ? sonando.heroe : null) };
})();
