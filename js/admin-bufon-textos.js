/* =============================================================================
   PESTAÑA «BUFÓN: TEXTOS» (panel de Admin): cambiar lo que dice el Bufón sin tocar los archivos
   Carga el diálogo de siempre (los mismos data/bufon-*.js que secreto.html) en un marco invisible y enseña sus nodos (líneas de texto) y los botones de elección.
   Lo que guardes va a la tabla bufon_textos (docs/admin/bufon_textos.sql) y secreto.html lo pone encima al cargar (js/bufon-textos.js). Solo cambia el texto: las ramas,
   los ids y las condiciones se quedan como están. Una línea por pantalla del Bufón: cada línea de la caja es una pantalla. «Volver al original» borra el cambio.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelBufonTextos");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ARCHIVOS = ["data/bufon-contenido.js", "data/bufon-evidencia.js", "data/bufon-voces.js", "data/bufon-ciclos-lista.js", "data/bufon-ciclos.js", "data/bufon-ciclo-fase3.js", "data/bufon-nombres-personajes.js"];
  const VERSION = (document.querySelector('script[src*="admin-bufon-textos.js"]').src.match(/\?v=\d+/) || [""])[0];

  let D = null, ediciones = {}, items = [], elegido = null;
  const estado = (t, error) => { const e = $("adminBufonTextosEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };

  function cargarDialogo() {
    return new Promise((ok, mal) => {
      const f = document.createElement("iframe");
      f.hidden = true; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
      f.srcdoc = `<!doctype html><meta charset="utf-8">${ARCHIVOS.map(a => `<script src="${a}${VERSION}"><\/script>`).join("")}`;
      f.onload = () => { const w = f.contentWindow; if (w.BUFON_DIALOGO && w.BUFON_DIALOGO.nodos) ok(w.BUFON_DIALOGO); else mal(new Error("El diálogo del Bufón no cargó.")); };
      f.onerror = () => mal(new Error("No se pudo cargar el diálogo."));
      document.body.appendChild(f);
    });
  }
  async function leerEdiciones() {
    const { data, error } = await (await fichasCliente()).from("bufon_textos").select("clave, valor");
    if (error) throw error;
    ediciones = {}; (data || []).forEach(f => { ediciones[f.clave] = f.valor; });
  }

  function armarLista() {
    items = [];
    Object.keys(D.nodos).forEach(id => {
      const n = D.nodos[id];
      if (Array.isArray(n.lineas) && n.lineas.every(l => typeof l === "string")) items.push({ clave: `n:${id}`, tipo: "nodo", id, base: n.lineas.slice() });
    });
    Object.keys(D.elecciones).forEach(eid => {
      ((D.elecciones[eid] || {}).opciones || []).forEach(o => { if (typeof o.texto === "string") items.push({ clave: `o:${eid}:${o.id}`, tipo: "opción", id: `${eid} → ${o.id}`, base: o.texto }); });
    });
  }
  const resumen = it => (it.tipo === "nodo" ? it.base.join(" / ") : it.base).slice(0, 90);

  function pintarLista() {
    const q = $("adminBufonTextosBuscar").value.trim().toLowerCase();
    const sel = items.filter(it => !q || it.id.toLowerCase().includes(q) || resumen({ tipo: it.tipo, base: it.base }).toLowerCase().includes(q) || (it.clave in ediciones && JSON.stringify(ediciones[it.clave]).toLowerCase().includes(q)));
    $("adminBufonTextosLista").innerHTML = sel.slice(0, 120).map(it => `<li><button type="button" data-clave="${esc(it.clave)}" class="${it.clave in ediciones ? "admin-bt-editado" : ""}${elegido && elegido.clave === it.clave ? " admin-bt-elegido" : ""}">
      <b>${esc(it.id)}</b> <small>${esc(it.tipo)}${it.clave in ediciones ? " · editado" : ""}</small><span>${esc(resumen(it))}</span></button></li>`).join("")
      + (sel.length > 120 ? `<li class="admin-vacio">Hay ${sel.length - 120} más: afina la búsqueda.</li>` : "") || `<li class="admin-vacio">Nada coincide.</li>`;
  }
  function pintarEditor() {
    const caja = $("adminBufonTextosEditor");
    if (!elegido) { caja.innerHTML = `<p class="admin-vacio">Elige un texto de la lista.</p>`; return; }
    const it = elegido, actual = it.clave in ediciones ? ediciones[it.clave] : it.base;
    const comoTexto = it.tipo === "nodo" ? actual.join("\n") : actual;
    caja.innerHTML = `<h3>${esc(it.id)} <small>${esc(it.tipo)}</small></h3>
      ${it.tipo === "nodo" ? `<p class="admin-bufon-ayuda">Una línea por pantalla del Bufón. «...» vale como línea propia para un silencio.</p>` : ""}
      <textarea id="adminBufonTextosCaja" rows="${it.tipo === "nodo" ? Math.max(5, comoTexto.split("\n").length + 2) : 3}" spellcheck="true">${esc("\n" + comoTexto)}</textarea>
      <details><summary>Cómo viene de fábrica</summary><pre class="admin-bt-base">${esc(it.tipo === "nodo" ? it.base.join("\n") : it.base)}</pre></details>
      <div class="admin-rival-botones"><button type="button" class="admin-cuenta-accion" id="adminBufonTextosGuardar">Guardar</button>
      <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" id="adminBufonTextosOriginal"${it.clave in ediciones ? "" : " disabled"}>Volver al original</button></div>`;
  }

  async function guardar() {
    const it = elegido; if (!it) return;
    const bruto = $("adminBufonTextosCaja").value.replace(/^\n/, "");   // el salto del principio lo pone el HTML
    const valor = it.tipo === "nodo" ? bruto.split("\n").map(l => l.trim()).filter(Boolean) : bruto.trim();
    if (it.tipo === "nodo" ? !valor.length : !valor) { estado("Escribe algo: un texto vacío no vale. Si quieres lo de fábrica, usa «Volver al original».", true); return; }
    const igualBase = JSON.stringify(valor) === JSON.stringify(it.base);
    try {
      const sb = await fichasCliente();
      const { error } = igualBase ? await sb.rpc("bufon_texto_quitar", { p_clave: it.clave }) : await sb.rpc("bufon_texto_guardar", { p_clave: it.clave, p_valor: valor });
      if (error) throw error;
      await leerEdiciones(); pintarLista(); pintarEditor();
      estado(igualBase ? "Es igual al de fábrica: se quitó el cambio." : "Guardado. El Bufón lo dirá en la siguiente visita.");
    } catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
  }
  async function volver() {
    if (!elegido || !confirm("¿Volver al texto de fábrica?")) return;
    try {
      const { error } = await (await fichasCliente()).rpc("bufon_texto_quitar", { p_clave: elegido.clave });
      if (error) throw error;
      await leerEdiciones(); pintarLista(); pintarEditor(); estado("Vuelve al texto de fábrica.");
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }

  let listo = false;
  async function abrir() {
    if (listo) return; listo = true;
    estado("Cargando el diálogo del Bufón...");
    try {
      [D] = await Promise.all([cargarDialogo(), leerEdiciones()]);
      armarLista(); pintarLista(); pintarEditor(); estado("");
    } catch (e) {
      listo = false;
      estado(/bufon_textos|relation|does not exist|schema cache/i.test(e.message || "") ? "Falta correr docs/admin/bufon_textos.sql en Supabase." : `No se pudo cargar: ${e.message || e}`, true);
    }
  }
  document.querySelector('[data-tab="bufontextos"]').addEventListener("click", abrir);
  $("adminBufonTextosBuscar").addEventListener("input", pintarLista);
  $("adminBufonTextosLista").addEventListener("click", ev => {
    const b = ev.target.closest("[data-clave]"); if (!b) return;
    elegido = items.find(i => i.clave === b.dataset.clave) || null; pintarLista(); pintarEditor();
  });
  $("adminBufonTextosEditor").addEventListener("click", ev => {
    if (ev.target.closest("#adminBufonTextosGuardar")) guardar();
    else if (ev.target.closest("#adminBufonTextosOriginal")) volver();
  });
})();
