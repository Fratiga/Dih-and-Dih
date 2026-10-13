/* =============================================================================
   EDITOR DE CONTENIDO (pestaña Contenido del panel de Admin)
   Crear y corregir entradas del compendio, capítulos de la cronología, reglas, economía, novedades del lobby y pines del
   mapa sin tocar archivos. Lo que se guarda va a la tabla contenido_servidor como un PARCHE sobre el archivo data/*.js
   (js/contenido-servidor.js lo mezcla al cargar cada página). Todo queda en el historial y se puede deshacer.
============================================================================= */
(function () {
  const CS = window.ContenidoServidor;
  const panel = document.getElementById("adminPanelContenido");
  if (!panel || !CS) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slug = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

  const LADOS = [["", "Todos"], ["A", "Solo Side A"], ["B", "Solo Side B"], ["A,B", "Side A y B"]];
  const ENTRADA = [
    { k: "title", t: "texto", e: "Título", req: true },
    { k: "id", t: "id", e: "Identificador" },
    { k: "category", t: "texto", e: "Categoría", ro: true },
    { k: "summary", t: "area", e: "Resumen (se ve en la tarjeta)" },
    { k: "tags", t: "tags", e: "Etiquetas (separadas por comas)" },
    { k: "lado", t: "lado", e: "Quién lo ve" },
    { k: "content", t: "html", e: "Texto (HTML)" }
  ];
  const entrada = (categoria) => ({ campos: ENTRADA, nuevo: () => ({ id: "", title: "", category: categoria, tags: [], summary: "", content: "<p></p>" }), enlace: "compendio.html#e=", conLado: true });
  const DEF = {
    ENTRIES: entrada("Textos"), PERSONAJES: entrada("Personajes"), LUGARES: entrada("Lugares"), FACCIONES: entrada("Facciones"),
    PERGAMINOS: entrada("Pergaminos"), ARMAS: entrada("Armas"), BESTIARIO: entrada("Bestiario"), RAZAS: entrada("Razas"),
    RELIGIONES: entrada("Religión"), OBJETOS: entrada("Objetos"),
    CRONOLOGIA_A: crono("A"), CRONOLOGIA_B: crono("B"),
    CRONOLOGIA_ARCOS: {
      campos: [{ k: "id", t: "id", e: "Identificador" }, { k: "title", t: "texto", e: "Título", req: true }, { k: "orden", t: "numero", e: "Orden" },
        { k: "fecha", t: "texto", e: "Fecha o época" }, { k: "resumen", t: "area", e: "Resumen" }],
      nuevo: () => ({ id: "", title: "", orden: 99, fecha: "", resumen: "" })
    },
    REGLAS: { campos: [{ k: "titulo", t: "texto", e: "Título", req: true }, { k: "descripcion", t: "area", e: "Descripción" }], nuevo: () => ({ titulo: "", descripcion: "", items: [] }), tituloDe: i => i.titulo },
    ECONOMIA: { campos: [{ k: "categoria", t: "texto", e: "Categoría", req: true }, { k: "nombre", t: "texto", e: "Nombre", req: true }, { k: "precio", t: "texto", e: "Precio" }],
      nuevo: () => ({ categoria: "", nombre: "", precio: "" }), tituloDe: i => `${i.nombre} (${i.categoria})` },
    NOVEDADES: { campos: [{ k: "fecha", t: "texto", e: "Fecha (AAAA-MM-DD)", req: true }, { k: "titulo", t: "texto", e: "Título", req: true }, { k: "texto", t: "area", e: "Texto" }, { k: "enlace", t: "texto", e: "Enlace (opcional)" }],
      nuevo: () => ({ fecha: new Date().toISOString().slice(0, 10), titulo: "", texto: "" }), tituloDe: i => `${i.fecha} · ${i.titulo}` },
    MAPA_PUNTOS: { campos: [{ k: "lugarId", t: "texto", e: "Id del lugar", req: true }, { k: "x", t: "numero", e: "X (0 a 100)" }, { k: "y", t: "numero", e: "Y (0 a 100)" }],
      nuevo: () => ({ lugarId: "", x: 50, y: 50 }), tituloDe: i => i.lugarId }
  };
  function crono(lado) {
    return {
      campos: [{ k: "title", t: "texto", e: "Título", req: true }, { k: "id", t: "id", e: "Identificador" }, { k: "numero", t: "texto", e: "Numeral (Capítulo X)" },
        { k: "orden", t: "numero", e: "Orden" }, { k: "fecha", t: "texto", e: "Fecha o época" }, { k: "content", t: "html", e: "Texto del capítulo (HTML)" }],
      nuevo: () => ({ id: "", orden: CS.base(lado === "A" ? "CRONOLOGIA_A" : "CRONOLOGIA_B").length + 1, numero: "", title: "", fecha: "", content: "<p></p>" })
    };
  }

  let col = "PERSONAJES", actual = null, filtro = "";

  const tituloDe = (c, i) => (DEF[c].tituloDe ? DEF[c].tituloDe(i) : i.title || i.id || "(sin título)");

  /* Todos los elementos de la colección: los del archivo (con su parche) y los creados desde la web */
  function elementos() {
    const def = DEF[col], base = CS.base(col);
    const filas = new Map(CS.filas().filter(f => f.coleccion === col).map(f => [f.clave, f]));
    const usados = new Set();
    const lista = base.map(item => {
      const clave = CS.claveDe(col, item), f = filas.get(clave);
      usados.add(clave);
      return { clave, base: item, fila: f || null, item: f && !f.borrado ? CS.fusionar(item, f.data) : item, borrado: !!(f && f.borrado) };
    });
    filas.forEach((f, clave) => { if (!usados.has(clave)) lista.push({ clave, base: null, fila: f, item: CS.fusionar(null, f.data), borrado: f.borrado }); });
    return lista;
  }

  function pintarLista() {
    const q = filtro.trim().toLowerCase();
    const todos = elementos().filter(x => !q || `${tituloDe(col, x.item)} ${x.clave}`.toLowerCase().includes(q));
    const ver = todos.slice(0, 300);
    $("adminContItems").innerHTML = ver.map(x => {
      const marca = x.borrado ? "borrado" : !x.base ? "nuevo" : x.fila ? "editado" : "";
      const lado = DEF[col].conLado ? ladoTexto(x.item.lado) : "";
      return `<li><button type="button" class="admin-cont-item${actual && actual.clave === x.clave ? " activo" : ""}${x.borrado ? " borrado" : ""}" data-clave="${esc(x.clave)}">
        <span>${esc(tituloDe(col, x.item))}</span>${lado ? `<small>${esc(lado)}</small>` : ""}${marca ? `<i>${marca}</i>` : ""}</button></li>`;
    }).join("") + (todos.length > ver.length ? `<li class="admin-cont-mas">Hay ${todos.length - ver.length} más: usa el buscador.</li>` : "") || `<li class="admin-cont-mas">Nada que mostrar.</li>`;
    $("adminContCuenta").textContent = `${todos.length} elemento${todos.length === 1 ? "" : "s"}`;
  }

  const ladoTexto = l => (!l ? "" : (Array.isArray(l) ? l : [l]).length === 2 ? "A y B" : `Side ${[].concat(l)[0]}`);
  const ladoValor = l => (!l ? "" : [].concat(l).join(","));

  /* --- Formulario --- */
  function campoHtml(c, v, esNuevo) {
    const id = `adminCont_${c.k}`;
    const ro = c.ro || (c.t === "id" && !esNuevo);
    const lbl = `<label for="${id}">${esc(c.e)}${c.req ? " *" : ""}</label>`;
    switch (c.t) {
      case "area": return `<div class="admin-cont-campo">${lbl}<textarea id="${id}" data-k="${c.k}" rows="3">
${esc(v ?? "")}</textarea></div>`;
      case "html": return `<div class="admin-cont-campo">${lbl}
        <div class="admin-cont-barra" role="toolbar" aria-label="Formato">
          <button type="button" data-tag="p">Párrafo</button><button type="button" data-tag="h4">Subtítulo</button><button type="button" data-tag="strong">Negrita</button>
          <button type="button" data-tag="em">Cursiva</button><button type="button" data-tag="ul">Lista</button><button type="button" data-vista>Vista previa</button></div>
        <textarea id="${id}" data-k="${c.k}" rows="16" spellcheck="true">
${esc(v ?? "")}</textarea>
        <div class="admin-cont-vista modal-body hidden" id="adminContVista"></div></div>`;
      case "numero": return `<div class="admin-cont-campo">${lbl}<input id="${id}" data-k="${c.k}" type="number" step="any" value="${esc(v ?? "")}"></div>`;
      case "tags": return `<div class="admin-cont-campo">${lbl}<input id="${id}" data-k="${c.k}" type="text" value="${esc((v || []).join(", "))}"></div>`;
      case "lado": return `<div class="admin-cont-campo">${lbl}<select id="${id}" data-k="${c.k}">${LADOS.map(([val, t]) => `<option value="${val}"${ladoValor(v) === val ? " selected" : ""}>${t}</option>`).join("")}</select></div>`;
      default: return `<div class="admin-cont-campo">${lbl}<input id="${id}" data-k="${c.k}" type="text" value="${esc(v ?? "")}"${ro ? " readonly" : ""}></div>`;
    }
  }

  /* --- Mapa: los pines se arrastran sobre la imagen --- */
  const IMAGEN_MAPA = "assets/mapa/Boes_2026-03-26-23-45.png";
  let zoomMapa = 100;
  const tituloLugar = id => { const l = [...CS.base("LUGARES"), ...CS.filas().filter(f => f.coleccion === "LUGARES" && !f.borrado).map(f => f.data)].find(x => x.id === id); return l ? (l.title || id) : id; };

  function pintarMapa() {
    const caja = $("adminContMapa");
    if (!caja) return;
    if (col !== "MAPA_PUNTOS") { caja.classList.add("hidden"); caja.innerHTML = ""; return; }
    caja.classList.remove("hidden");
    const pines = elementos().filter(x => !x.borrado);
    const sinPin = new Set(pines.map(x => x.item.lugarId));
    const lugares = [...CS.base("LUGARES")].filter(l => !sinPin.has(l.id)).sort((a, b) => a.title.localeCompare(b.title, "es"));
    caja.innerHTML = `<div class="admin-mapa-barra">
        <label>Zoom <input type="range" min="100" max="400" step="25" value="${zoomMapa}" id="adminMapaZoom"></label>
        <label>Poner un lugar que no tiene pin <select id="adminMapaNuevo"><option value="">Elegir lugar...</option>${lugares.map(l => `<option value="${esc(l.id)}">${esc(l.title)}</option>`).join("")}</select></label>
        <span id="adminMapaAyuda">Arrastra un pin para moverlo. Elige un lugar de la lista y toca el mapa para ponerlo.</span></div>
      <div class="admin-mapa-marco"><div class="admin-mapa" id="adminMapa" style="width:${zoomMapa}%">
        <img src="${IMAGEN_MAPA}" alt="Mapa del mundo" draggable="false">
        ${pines.map(x => `<button type="button" class="admin-mapa-pin${actual && actual.clave === x.clave ? " activo" : ""}" data-clave="${esc(x.clave)}" style="left:${x.item.x}%;top:${x.item.y}%" title="${esc(tituloLugar(x.item.lugarId))}"></button>`).join("")}
      </div></div>`;
  }

  let arrastrando = null, colocando = "";
  function posicionEn(ev, mapa) {
    const r = mapa.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  async function guardarPin(clave, item, base, pos) {
    const nuevo = Object.assign({}, item, pos);
    const p = base ? parche(base, nuevo) : nuevo;
    if (base && !Object.keys(p).length) await CS.restaurar(col, clave); else await CS.guardar(col, clave, p, false);
  }

  function iniciarMapa() {
    const caja = $("adminContMapa");
    caja.addEventListener("input", ev => {
      if (ev.target.id === "adminMapaZoom") { zoomMapa = Number(ev.target.value); $("adminMapa").style.width = `${zoomMapa}%`; }
    });
    caja.addEventListener("change", ev => {
      if (ev.target.id === "adminMapaNuevo") { colocando = ev.target.value; $("adminMapaAyuda").textContent = colocando ? `Toca el mapa donde va «${tituloLugar(colocando)}».` : ""; }
    });
    caja.addEventListener("pointerdown", ev => {
      const pin = ev.target.closest(".admin-mapa-pin");
      if (!pin) return;
      ev.preventDefault();
      try { pin.setPointerCapture(ev.pointerId); } catch (e) { /* puntero simulado */ }
      arrastrando = { pin, movido: false, clave: pin.dataset.clave };
    });
    caja.addEventListener("pointermove", ev => {
      if (!arrastrando) return;
      const pos = posicionEn(ev, $("adminMapa"));
      arrastrando.movido = true;
      arrastrando.pos = pos;
      arrastrando.pin.style.left = `${pos.x}%`;
      arrastrando.pin.style.top = `${pos.y}%`;
    });
    caja.addEventListener("pointerup", async () => {
      if (!arrastrando) return;
      const a = arrastrando; arrastrando = null;
      const x = elementos().find(e => e.clave === a.clave);
      if (!a.movido || !x) { if (x) abrir(x.clave); return; }
      try { await guardarPin(a.clave, x.item, x.base, a.pos); abrir(a.clave); }
      catch (e) { dialogo.avisar(`No se pudo mover el pin: ${e.message || e}`, { tipoAviso: "error" }); pintarMapa(); }
    });
    caja.addEventListener("click", async ev => {
      if (!colocando || ev.target.closest(".admin-mapa-pin") || !ev.target.closest("#adminMapa")) return;
      const pos = posicionEn(ev, $("adminMapa")), lugar = colocando;
      colocando = "";
      try { await CS.guardar(col, lugar, { lugarId: lugar, x: pos.x, y: pos.y }, false); abrir(lugar); }
      catch (e) { dialogo.avisar(`No se pudo poner el pin: ${e.message || e}`, { tipoAviso: "error" }); }
    });
  }

  function pintarForm() {
    pintarMapa();
    const f = $("adminContForm");
    if (!actual) { f.innerHTML = `<p class="admin-vacio">Elige algo de la lista o crea uno nuevo.</p>`; return; }
    const def = DEF[col], esNuevo = !actual.clave;
    const item = actual.item;
    const conocidos = new Set(def.campos.map(c => c.k));
    const resto = {};
    Object.keys(item).forEach(k => { if (!conocidos.has(k)) resto[k] = item[k]; });
    const estado = actual.borrado ? "borrado" : esNuevo ? "nuevo" : !actual.base ? "creado desde la web" : actual.fila ? "con cambios guardados" : "como en el archivo";
    f.innerHTML = `<h3>${esc(esNuevo ? "Nuevo" : tituloDe(col, item))} <small>${esc(CS.CONF[col].nombre)} · ${estado}</small></h3>
      ${def.campos.map(c => campoHtml(c, item[c.k], esNuevo)).join("")}
      <details class="admin-cont-campo"><summary>Otros campos (avanzado, JSON)</summary>
        <textarea id="adminCont_resto" rows="8" spellcheck="false">${esc(Object.keys(resto).length ? JSON.stringify(resto, null, 2) : "{}")}</textarea>
        <small>Aquí van los campos que no tienen casilla propia (relaciones, región, datos de armas, etc.). Debe ser JSON válido.</small></details>
      <p id="adminContEstado" class="admin-cartas-estado" role="status"></p>
      <div class="admin-cont-botones">
        <button type="submit" class="admin-cuenta-accion">Guardar</button>
        ${!esNuevo && !actual.borrado ? `<button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-borrar>${actual.base ? "Quitar del sitio" : "Borrar"}</button>` : ""}
        ${actual.fila && actual.base ? `<button type="button" class="admin-cuenta-accion" data-original>Volver al original</button>` : ""}
        ${actual.borrado ? `<button type="button" class="admin-cuenta-accion" data-original>Volver a ponerlo</button>` : ""}
        ${!esNuevo && DEF[col].enlace && !actual.borrado ? `<a class="admin-cont-ver" href="${DEF[col].enlace}${encodeURIComponent(actual.clave)}" target="_blank" rel="noopener">Ver en el sitio</a>` : ""}
      </div>`;
  }

  function leerForm() {
    const def = DEF[col], out = {};
    let resto = {};
    try { resto = JSON.parse($("adminCont_resto").value || "{}"); } catch (e) { throw new Error("Los «otros campos» no son JSON válido."); }
    if (!resto || typeof resto !== "object" || Array.isArray(resto)) throw new Error("Los «otros campos» deben ser un objeto JSON.");
    Object.assign(out, resto);
    def.campos.forEach(c => {
      const el = $(`adminCont_${c.k}`);
      let v = el.value;
      if (c.t === "tags") v = v.split(",").map(s => s.trim()).filter(Boolean);
      else if (c.t === "numero") v = v === "" ? undefined : Number(v);
      else if (c.t === "lado") v = v ? v.split(",") : undefined;
      else if (c.t !== "html") v = v.trim();
      if (c.req && (v === "" || v === undefined)) throw new Error(`Falta «${c.e}».`);
      if (v === undefined || (c.t !== "tags" && c.t !== "html" && v === "")) delete out[c.k];
      else out[c.k] = v;
    });
    return out;
  }

  /* El parche son solo los campos que difieren del archivo; un campo que el archivo tiene y ya no está va en null */
  function parche(base, nuevo) {
    if (!base) return nuevo;
    const p = {};
    Object.keys(nuevo).forEach(k => { if (JSON.stringify(nuevo[k]) !== JSON.stringify(base[k])) p[k] = nuevo[k]; });
    Object.keys(base).forEach(k => { if (!(k in nuevo)) p[k] = null; });
    return p;
  }

  function estado(t, mal) { const e = $("adminContEstado"); if (e) { e.textContent = t || ""; e.classList.toggle("mal", !!mal); } }

  async function guardar(ev) {
    ev.preventDefault();
    let nuevo;
    try { nuevo = leerForm(); } catch (e) { estado(e.message, true); return; }
    const def = DEF[col], esNuevo = !actual.clave;
    let clave = actual.clave;
    if (esNuevo) {
      if (nuevo.id === undefined && def.campos.some(c => c.k === "id")) nuevo.id = slug(nuevo.title || "");
      if (def.campos.some(c => c.k === "id") && !/^[a-z0-9-]{1,80}$/.test(nuevo.id || "")) { estado("El identificador solo admite minúsculas, números y guiones.", true); return; }
      clave = CS.claveDe(col, nuevo);
      if (!clave || elementos().some(x => x.clave === clave)) { estado("Ya existe uno con ese identificador o nombre.", true); return; }
    }
    const p = esNuevo ? nuevo : parche(actual.base, nuevo);
    estado("Guardando...");
    try {
      if (!esNuevo && actual.base && !Object.keys(p).length) await CS.restaurar(col, clave);
      else await CS.guardar(col, clave, p, false);
      abrir(clave);
      estado("Guardado. En el sitio se ve al recargar la página.");
    } catch (e) {
      estado(`No se pudo guardar: ${e.message || e}. ¿Corriste docs/admin/contenido_servidor.sql en Supabase?`, true);
    }
  }

  async function borrar() {
    const aviso = actual.base ? "¿Quitar esto del sitio? Podrás volver a ponerlo y queda en el historial." : "¿Borrar este elemento creado desde la web?";
    if (!(await dialogo.confirmar(aviso, { titulo: "Quitar", aceptar: "Quitar", peligro: true }))) return;
    try {
      if (actual.base) await CS.guardar(col, actual.clave, {}, true); else await CS.restaurar(col, actual.clave);
      actual = null; pintarLista(); pintarForm();
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }

  async function volverAlOriginal() {
    if (!(await dialogo.confirmar("¿Descartar los cambios guardados y volver a como está en el archivo?", { titulo: "Volver al original", aceptar: "Volver" }))) return;
    try { await CS.restaurar(col, actual.clave); abrir(actual.clave); } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }

  function abrir(clave) {
    if (clave === null) {
      actual = { clave: null, base: null, fila: null, item: DEF[col].nuevo(), borrado: false };
    } else {
      actual = elementos().find(x => x.clave === clave) || null;
    }
    pintarLista(); pintarForm();
  }

  /* --- Barra de formato del HTML --- */
  function insertar(tag) {
    const ta = $("adminCont_content");
    if (!ta) return;
    const a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
    const envuelto = tag === "ul" ? `<ul>\n  <li>${sel || "elemento"}</li>\n</ul>` : `<${tag}>${sel || (tag === "p" ? "Texto" : "texto")}</${tag}>`;
    ta.setRangeText(envuelto, a, b, "end");
    ta.focus();
  }

  function iniciar() {
    $("adminContColeccion").innerHTML = CS.colecciones().filter(c => DEF[c]).map(c => `<option value="${c}">${esc(CS.CONF[c].nombre)}</option>`).join("");
    $("adminContColeccion").value = col;
    $("adminContColeccion").addEventListener("change", ev => { col = ev.target.value; actual = null; filtro = ""; $("adminContBuscar").value = ""; pintarLista(); pintarForm(); });
    $("adminContBuscar").addEventListener("input", ev => { filtro = ev.target.value; pintarLista(); });
    $("adminContNuevo").addEventListener("click", () => abrir(null));
    $("adminContItems").addEventListener("click", ev => { const b = ev.target.closest("[data-clave]"); if (b) abrir(b.dataset.clave); });
    const f = $("adminContForm");
    f.addEventListener("submit", guardar);
    f.addEventListener("click", ev => {
      const t = ev.target.closest("button");
      if (!t) return;
      if (t.dataset.tag) insertar(t.dataset.tag);
      if (t.hasAttribute("data-vista")) { const v = $("adminContVista"); v.classList.toggle("hidden"); v.innerHTML = $("adminCont_content").value; }
      if (t.hasAttribute("data-borrar")) borrar();
      if (t.hasAttribute("data-original")) volverAlOriginal();
    });
    f.addEventListener("input", ev => { if (ev.target.id === "adminCont_content") { const v = $("adminContVista"); if (v && !v.classList.contains("hidden")) v.innerHTML = ev.target.value; } });
    document.querySelector('[data-tab="contenido"]').addEventListener("click", () => { if (!$("adminContItems").children.length) { pintarLista(); pintarForm(); CS.refrescar().then(() => pintarLista()); } });
  }

  iniciarMapa();
  iniciar();
})();
