/* Guía de Triunfos del lobby: cómo se juega, palabras clave, tipos de habilidad, tipos de carta y glosario.
   El texto sale de data/triunfos-guia.js. Las listas de cartas ("quién la tiene") se arman solas a partir de
   js/cartas-efectos.js y del catálogo, así que no hay que mantenerlas a mano. Requiere cartas-datos.js,
   cartas-motor.js y cartas-efectos.js. El panel es <section id="btGuia"> de batalla.html. */
window.TriunfosGuia = (function () {
  const G = window.TRIUNFOS_GUIA;
  const M = window.CartasMotor;
  const raiz = document.getElementById("btGuia");
  if (!G || !raiz) return { pintar() {} };

  const TABS = [
    { id: "juego", nombre: "Cómo se juega" },
    { id: "palabras", nombre: "Palabras clave" },
    { id: "habilidades", nombre: "Tipos de habilidad" },
    { id: "cartas", nombre: "Tipos de carta" },
    { id: "glosario", nombre: "Glosario" }
  ];
  const CLAVE = "triunfosGuia";
  let tab = "juego", abierta = true, filtro = "";
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    if (TABS.some(t => t.id === g.tab)) tab = g.tab;
    if (g.abierta === false) abierta = false;
  } catch (e) { /* sin almacenamiento */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ tab, abierta })); } catch (e) { /* sin almacenamiento */ } };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nombreDe = id => { const c = window.cartaPorId ? window.cartaPorId(id) : null; return c ? c.nombre : null; };
  const unicos = lista => [...new Set(lista)];

  /* Cartas que cumplen algo, ordenadas por nombre. Solo las que existen en el catálogo (las fichas y las cartas de prueba no). */
  function nombresDe(ids) {
    return unicos(ids).map(id => ({ id, nombre: nombreDe(id) })).filter(c => c.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  const conEfecto = pred => nombresDe(Object.keys(M.EFECTOS).filter(id => pred(M.EFECTOS[id], id)));

  function cartasDePalabra(p) {
    const solas = conEfecto(ef => (ef.palabras || []).includes(p.id) || Object.values(ef.palabrasForma || {}).some(l => l.includes(p.id))).map(c => c.id);
    return nombresDe([...solas, ...(p.cartas || []), ...(p.tambien || [])]);
  }
  function cartasDeHabilidad(h) {
    if (h.ejemplos) return nombresDe(h.ejemplos);
    if (h.campo === "terreno") return nombresDe(Object.keys(M.TERRENOS));
    if (h.campo === "palabras") return conEfecto(ef => (ef.palabras || []).length > 0 || Object.keys(ef.palabrasForma || {}).length > 0);
    if (h.campo === "jugar") return conEfecto((ef, id) => !!ef.jugar && (window.cartaPorId(id) || {}).tipo !== "Terreno");
    return conEfecto(ef => !!ef[h.campo]);
  }

  function chips(lista, titulo) {
    if (!lista.length) return "";
    return `<details class="bt-guia-cartas"><summary>${esc(titulo)} (${lista.length})</summary><p>${lista.map(c => `<span class="bt-guia-chip">${esc(c.nombre)}</span>`).join("")}</p></details>`;
  }
  const parrafos = lista => `<ul class="bt-guia-detalle">${lista.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  const item = (clase, html, extra) => `<article class="bt-guia-item ${clase || ""}" ${extra || ""}>${html}</article>`;

  /* ------------------------------------------------------------ cada pestaña */
  function htmlJuego() {
    const pasos = G.pasos.map((p, i) => `<li class="bt-guia-item bt-guia-paso"><span class="bt-guia-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div></li>`).join("");
    const ej = G.ejemplo.map(t => `<li>${esc(t)}</li>`).join("");
    return `<p class="bt-guia-intro">${esc(G.inicio)}</p>
      <ol class="bt-guia-pasos">${pasos}</ol>
      <div class="bt-guia-item bt-guia-ejemplo"><h3>Un turno de ejemplo</h3><ol>${ej}</ol></div>`;
  }

  function htmlPalabras() {
    return `<p class="bt-guia-intro">Las palabras clave son reglas fijas. Una unidad las tiene escritas en su carta, o las recibe de un terreno o de otra carta durante un tiempo. En el tablero salen bajo cada unidad. Barrera, Escurridizo y Marcada son estados, no palabras fijas.</p>
      <div class="bt-guia-rejilla">${G.palabras.map(p => item("", `
        <h3>${esc(p.nombre)}${p.estado ? ' <span class="bt-guia-sello">Estado</span>' : ""}</h3>
        <p class="bt-guia-resumen">${esc(p.resumen)}</p>${parrafos(p.detalle)}${chips(cartasDePalabra(p), "Cartas relacionadas")}`)).join("")}</div>`;
  }

  function htmlHabilidades() {
    return `<p class="bt-guia-intro">Cada habilidad de una carta es de uno de estos tipos, y el tipo dice cuándo se activa. Las listas de abajo se arman solas con las cartas del catálogo.</p>
      <div class="bt-guia-rejilla">${G.habilidades.map(h => item("", `
        <h3>${esc(h.nombre)}</h3>
        <p class="bt-guia-resumen">${esc(h.resumen)}</p>${parrafos(h.detalle)}${chips(cartasDeHabilidad(h), "Cartas con este tipo")}`)).join("")}</div>`;
  }

  function htmlCartas() {
    const tipos = G.tipos.map(t => item("", `<h3>${esc(t.nombre)}</h3><p>${esc(t.texto)}</p>`)).join("");
    const afs = Object.values(window.CARTAS_AFINIDADES || {}).map(a => item("", `<h3>${esc(a.nombre)}</h3><p>${esc(a.descripcion)}</p>`)).join("");
    const rar = Object.values(window.CARTAS_RAREZAS || {}).sort((a, b) => a.orden - b.orden).map(r => `<span class="bt-guia-chip">${esc(r.nombre)}</span>`).join("");
    return `<h3 class="bt-guia-sub">Tipos de carta</h3><div class="bt-guia-rejilla">${tipos}</div>
      <h3 class="bt-guia-sub">Afinidades</h3>
      <p class="bt-guia-intro">Hay seis. Cada carta tiene una o más, y algunas cartas, terrenos y objetos premian a una afinidad concreta.</p>
      <div class="bt-guia-rejilla">${afs}</div>
      <h3 class="bt-guia-sub">Rareza y lado</h3>
      <div class="bt-guia-rejilla">${item("", `<h3>Rareza</h3><p>${esc(G.rarezas)}</p><p>${rar}</p>`)}${item("", `<h3>Lado</h3><p>${esc(G.lados)}</p>`)}</div>`;
  }

  function htmlGlosario() {
    const lista = G.glosario.slice().sort((a, b) => a.termino.localeCompare(b.termino, "es"));
    return `<dl class="bt-guia-glosario">${lista.map(g => `<div class="bt-guia-item bt-guia-termino"><dt>${esc(g.termino)}</dt><dd>${esc(g.definicion)}</dd></div>`).join("")}</dl>`;
  }

  const HTML = { juego: htmlJuego, palabras: htmlPalabras, habilidades: htmlHabilidades, cartas: htmlCartas, glosario: htmlGlosario };

  /* ------------------------------------------------------------- estructura */
  function armar() {
    raiz.innerHTML = `
      <div class="bt-guia-cabeza">
        <h2 id="btGuiaTitulo">Guía de Triunfos</h2>
        <button type="button" class="cartas-boton" id="btGuiaAlternar" aria-expanded="${abierta}" aria-controls="btGuiaCuerpo">${abierta ? "Ocultar guía" : "Mostrar guía"}</button>
      </div>
      <div id="btGuiaCuerpo" ${abierta ? "" : "hidden"}>
        <div class="bt-guia-barra">
          <div class="bt-guia-tabs" role="tablist" aria-label="Secciones de la guía">
            ${TABS.map(t => `<button type="button" role="tab" id="btGuiaTab-${t.id}" data-guia-tab="${t.id}" aria-controls="btGuiaPanel" aria-selected="${t.id === tab}" tabindex="${t.id === tab ? 0 : -1}">${esc(t.nombre)}</button>`).join("")}
          </div>
          <input type="search" id="btGuiaBuscar" class="mz-buscar" placeholder="Buscar en esta sección" aria-label="Buscar en esta sección" autocomplete="off" value="${esc(filtro)}">
        </div>
        <div id="btGuiaPanel" class="bt-guia-panel" role="tabpanel" tabindex="0" aria-labelledby="btGuiaTab-${tab}"></div>
        <p id="btGuiaNada" class="bt-vacio" hidden>No hay nada que coincida con esa búsqueda.</p>
      </div>`;
    pintarPanel();
  }

  function pintarPanel() {
    const panel = document.getElementById("btGuiaPanel");
    panel.innerHTML = HTML[tab]();
    panel.setAttribute("aria-labelledby", `btGuiaTab-${tab}`);
    raiz.querySelectorAll("[data-guia-tab]").forEach(b => {
      const activo = b.dataset.guiaTab === tab;
      b.setAttribute("aria-selected", activo);
      b.tabIndex = activo ? 0 : -1;
    });
    aplicarFiltro();
  }

  function aplicarFiltro() {
    const q = norm(filtro.trim());
    const items = raiz.querySelectorAll("#btGuiaPanel .bt-guia-item");
    let visibles = 0;
    items.forEach(el => {
      const ok = !q || norm(el.textContent).includes(q);
      el.hidden = !ok;
      if (ok) visibles++;
    });
    // Con búsqueda, las cartas relacionadas se abren para ver por qué coincide
    raiz.querySelectorAll("#btGuiaPanel details").forEach(d => { d.open = !!q && norm(d.textContent).includes(q) && !d.closest("[hidden]"); });
    document.getElementById("btGuiaNada").hidden = visibles > 0 || !q;
  }

  function elegir(id, foco) {
    tab = id; guardar();
    pintarPanel();
    if (foco) document.getElementById(`btGuiaTab-${id}`).focus();
  }

  raiz.addEventListener("click", ev => {
    const t = ev.target.closest("[data-guia-tab]");
    if (t) { elegir(t.dataset.guiaTab); return; }
    if (ev.target.closest("#btGuiaAlternar")) {
      abierta = !abierta; guardar();
      document.getElementById("btGuiaCuerpo").hidden = !abierta;
      const b = document.getElementById("btGuiaAlternar");
      b.textContent = abierta ? "Ocultar guía" : "Mostrar guía";
      b.setAttribute("aria-expanded", abierta);
    }
  });
  raiz.addEventListener("input", ev => {
    if (ev.target.id !== "btGuiaBuscar") return;
    filtro = ev.target.value;
    aplicarFiltro();
  });
  // Flechas para moverse entre pestañas
  raiz.addEventListener("keydown", ev => {
    const t = ev.target.closest && ev.target.closest("[data-guia-tab]");
    if (!t || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const i = TABS.findIndex(x => x.id === t.dataset.guiaTab);
    const n = ev.key === "Home" ? 0 : ev.key === "End" ? TABS.length - 1 : (i + (ev.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    elegir(TABS[n].id, true);
  });

  armar();
  /* Para volver a pintar si el catálogo cambia (por ejemplo al cargar lo que se editó en el servidor) */
  return { pintar: () => { if (document.getElementById("btGuiaPanel")) pintarPanel(); } };
})();
