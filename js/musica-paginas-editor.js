/* Editor de la música de una página (solo Admin). Lo carga js/musica-paginas.js cuando se pulsa ⚙.
   Las canciones salen de la Rocola (window.MUSICA); para tener más, se suben allí. */
window.MusicaPaginasEditor = (function () {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CLAVE_CACHE = "musicaPaginasCfg";

  let dlg = null, st = null, previa = null;
  // Canciones que traen los juegos y no están en la Rocola
  const MUSICAS_DE_JUEGOS = ["assets/cosas/All The Fun At The Fair.mp3", "assets/cosas/Pizza Parlor Theme.mp3", "assets/cosas/The Crack of Doom.mp3"];

  function nombreCancion(ruta) {
    const n = window.MUSICA_NUBE_NOMBRES && window.MUSICA_NUBE_NOMBRES[ruta];
    if (n) return n;
    let f = ruta.split("/").pop().replace(/\.[a-z0-9]{2,4}$/i, "");
    try { f = decodeURIComponent(f); } catch (e) { /* queda como está */ }
    return f;
  }
  const urlDe = r => { try { return encodeURI(decodeURI(r)); } catch (e) { return encodeURI(r); } };

  function pararPrevia() {
    if (previa) { previa.pause(); previa = null; }
    if (dlg) dlg.querySelectorAll(".mpe-prev.sonando").forEach(b => { b.classList.remove("sonando"); b.textContent = "▶"; });
  }

  const nuevaSeccion = s => ({
    lista: (s && Array.isArray(s.lista) ? s.lista.slice() : []),
    desdeCero: s ? s.desdeCero !== false : true,
    mezclar: !!(s && s.mezclar),
    volumen: s && typeof s.volumen === "number" ? s.volumen : 0.5
  });

  function seccionHtml(clave, titulo, ayuda) {
    const s = st[clave];
    return `<section class="mpe-seccion" data-sec="${clave}">
      <h3>${titulo}</h3>
      <p class="mpe-ayuda">${ayuda}</p>
      <ol class="mpe-lista">${s.lista.map((r, i) => `
        <li><span class="mpe-nombre" title="${esc(r)}">${esc(nombreCancion(r))}</span>
          <button type="button" class="mpe-prev" data-acc="prev" data-i="${i}" aria-label="Escuchar">▶</button>
          <button type="button" data-acc="sube" data-i="${i}" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" data-acc="baja" data-i="${i}" aria-label="Bajar"${i === s.lista.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" data-acc="quita" data-i="${i}" aria-label="Quitar">✕</button></li>`).join("") || `<li class="mpe-vacia">Sin canciones.</li>`}</ol>
      <div class="mpe-anadir">
        <input type="text" list="mpeCatalogo" data-add placeholder="Buscar una canción para añadir..." aria-label="Añadir canción">
        <button type="button" data-acc="anade">Añadir</button>
      </div>
      <div class="mpe-opciones">
        <label><input type="checkbox" data-op="desdeCero"${s.desdeCero ? " checked" : ""}> Empezar desde cero cada vez que se entra${clave === "partida" ? " a una partida" : ""}</label>
        <label><input type="checkbox" data-op="mezclar"${s.mezclar ? " checked" : ""}> Orden aleatorio</label>
        <label class="mpe-vol">Volumen <input type="range" min="0" max="100" step="1" value="${Math.round(s.volumen * 100)}" data-op="volumen"> <output>${Math.round(s.volumen * 100)}%</output></label>
      </div>
    </section>`;
  }

  function pintar() {
    pararPrevia();
    const otras = Object.keys(leerCache()).filter(p => p !== st.pagina && leerCache()[p]);
    const nombrePag = p => (st.paginas.find(x => x[0] === p) || [p, p])[1];
    dlg.querySelector(".mpe-cuerpo").innerHTML = `
      <datalist id="mpeCatalogo">${st.catalogo.map(([nombre]) => `<option value="${esc(nombre)}"></option>`).join("")}</datalist>
      ${seccionHtml("fondo", st.etiquetas ? st.etiquetas.fondo[0] : "Música de fondo", (st.etiquetas ? st.etiquetas.fondo[1] : "Suena mientras estás en la página. Cuando termina una canción pasa a la siguiente y, al acabar la lista, vuelve a empezar.") + (st.avisoPropia ? " <strong>Esta página ya trae su canción; la dejé en la lista para que la veas. Al guardar, la lista manda y la de fábrica deja de sonar.</strong>" : ""))}
      ${st.conPartida ? seccionHtml("partida", st.etiquetas ? st.etiquetas.partida[0] : "Al empezar una partida", st.etiquetas ? st.etiquetas.partida[1] : "En cuanto empieza una partida suena esta lista en vez de la de fondo, y al terminar vuelve la de fondo. Si la dejas vacía, la música no cambia.") : ""}
      ${otras.length ? `<div class="mpe-copiar"><label>Copiar la lista de otra página
        <select data-copiar><option value="">Elegir...</option>${otras.map(p => `<option value="${esc(p)}">${esc(nombrePag(p))}</option>`).join("")}</select></label></div>` : ""}
      <p class="mpe-ayuda">Las canciones son las de la Rocola. Para tener más, súbelas allí.${otras.length ? ` Páginas con música ahora: ${otras.map(p => esc(nombrePag(p))).join(", ")}.` : ""}</p>`;
  }

  function leerCache() { try { return JSON.parse(localStorage.getItem(CLAVE_CACHE) || "{}") || {}; } catch (e) { return {}; } }

  function estado(t, error) {
    const e = dlg.querySelector(".mpe-estado");
    e.textContent = t || "";
    e.classList.toggle("mpe-error", !!error);
  }

  function resolver(texto) {
    const t = texto.trim().toLowerCase();
    if (!t) return null;
    const exacto = st.catalogo.find(([n]) => n.toLowerCase() === t);
    if (exacto) return exacto[1];
    const parecidas = st.catalogo.filter(([n]) => n.toLowerCase().includes(t));
    return parecidas.length === 1 ? parecidas[0][1] : null;
  }

  function alClic(ev) {
    const b = ev.target.closest("button[data-acc]");
    if (!b) return;
    const sec = b.closest("[data-sec]");
    if (!sec) return;
    const s = st[sec.dataset.sec], i = Number(b.dataset.i);
    switch (b.dataset.acc) {
      case "sube": [s.lista[i - 1], s.lista[i]] = [s.lista[i], s.lista[i - 1]]; pintar(); break;
      case "baja": [s.lista[i + 1], s.lista[i]] = [s.lista[i], s.lista[i + 1]]; pintar(); break;
      case "quita": s.lista.splice(i, 1); pintar(); break;
      case "anade": {
        const input = sec.querySelector("[data-add]");
        const ruta = resolver(input.value);
        if (!ruta) { estado(input.value.trim() ? "No encuentro esa canción en la Rocola. Elige una de la lista." : "Escribe el nombre de una canción.", true); return; }
        s.lista.push(ruta); estado(""); pintar(); break;
      }
      case "prev": {
        const sonaba = b.classList.contains("sonando");
        pararPrevia();
        if (sonaba) return;
        previa = new Audio(urlDe(s.lista[i]));
        previa.volume = s.volumen;
        previa.play().catch(() => estado("No se pudo reproducir esa canción.", true));
        previa.addEventListener("ended", pararPrevia);
        b.classList.add("sonando"); b.textContent = "❚❚";
        break;
      }
    }
  }

  function alCambiar(ev) {
    const el = ev.target;
    if (el.matches("[data-copiar]")) {
      const otra = leerCache()[el.value];
      if (otra) { st.fondo = nuevaSeccion(otra); if (st.conPartida && otra.partida) st.partida = nuevaSeccion(otra.partida); pintar(); }
      return;
    }
    const sec = el.closest("[data-sec]");
    if (!sec) return;
    if (el.matches("[data-add]")) {
      const ruta = resolver(el.value);
      if (ruta) { st[sec.dataset.sec].lista.push(ruta); estado(""); pintar(); }
      return;
    }
    const op = el.dataset.op;
    if (!op) return;
    const s = st[sec.dataset.sec];
    if (op === "volumen") { s.volumen = el.value / 100; el.nextElementSibling.textContent = `${el.value}%`; if (previa) previa.volume = s.volumen; }
    else s[op] = el.checked;
  }

  function construirConfig() {
    const sec = s => ({ lista: s.lista.slice(), desdeCero: s.desdeCero, mezclar: s.mezclar, volumen: Math.round(s.volumen * 100) / 100 });
    const cfg = {};
    if (st.fondo.lista.length) Object.assign(cfg, sec(st.fondo));
    else Object.assign(cfg, { lista: [], desdeCero: st.fondo.desdeCero, mezclar: st.fondo.mezclar, volumen: st.fondo.volumen });
    if (st.conPartida && st.partida.lista.length) cfg.partida = sec(st.partida);
    return cfg;
  }

  async function guardar() {
    const vacia = !st.fondo.lista.length && !(st.conPartida && st.partida.lista.length);
    estado("Guardando...");
    try {
      const supabase = await fichasCliente();
      if (vacia) {
        const { error } = await supabase.rpc("musica_pagina_quitar", { p_pagina: st.pagina });
        if (error) throw error;
        window.MusicaPaginas.aplicar(null);
      } else {
        const cfg = construirConfig();
        const { error } = await supabase.rpc("musica_pagina_guardar", { p_pagina: st.pagina, p_config: cfg });
        if (error) throw error;
        window.MusicaPaginas.aplicar(cfg);
      }
      estado(vacia ? "Música quitada de esta página." : "Guardado. Ya suena así para todos.");
    } catch (e) {
      estado(`No se pudo guardar: ${e.message || e}. ¿Corriste scratchpad/musica_paginas.sql y tienes la sesión de admin iniciada?`, true);
    }
  }

  function crearDialogo() {
    dlg = document.createElement("dialog");
    dlg.className = "mpe";
    dlg.innerHTML = `<button type="button" class="mpe-cerrar" aria-label="Cerrar">×</button>
      <h2></h2>
      <div class="mpe-cuerpo"></div>
      <p class="mpe-estado" role="status"></p>
      <div class="mpe-botones"><button type="button" class="mpe-guardar">Guardar</button></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".mpe-cerrar").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", pararPrevia);
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.querySelector(".mpe-guardar").addEventListener("click", guardar);
    dlg.addEventListener("click", alClic);
    dlg.addEventListener("change", alCambiar);
    dlg.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.matches("[data-add]")) { ev.preventDefault(); ev.target.closest("[data-sec]").querySelector('[data-acc="anade"]').click(); } });
  }

  function abrir(o) {
    if (!dlg) crearDialogo();
    const nombrePag = (o.paginas.find(x => x[0] === o.pagina) || [o.pagina, o.pagina])[1];
    const catalogo = [];
    const usados = new Map();
    // Además de las de la Rocola, las que traen de fábrica los juegos (para poder usarlas en otras páginas)
    const propias = (window.__fondoPropio || []).map(a => a.rutaOriginal).filter(Boolean);
    const lista = [...(window.MUSICA || [])];
    [...propias, ...MUSICAS_DE_JUEGOS].forEach(r => { if (!lista.includes(r)) lista.push(r); });
    lista.forEach(r => {
      let n = nombreCancion(r);
      const k = usados.get(n) || 0;
      usados.set(n, k + 1);
      if (k) n = `${n} (${k + 1})`;
      catalogo.push([n, r]);
    });
    catalogo.sort((a, b) => a[0].localeCompare(b[0], "es", { sensitivity: "base" }));
    st = { pagina: o.pagina, paginas: o.paginas, conPartida: o.conPartida, etiquetas: o.etiquetas || null, catalogo,
      fondo: nuevaSeccion(o.config), partida: nuevaSeccion(o.config && o.config.partida) };
    // Sin música configurada, la lista arranca con la que suena hoy en esa página (si la página trae una propia)
    if (!(o.config && (o.config.lista || []).length) && propias.length) {
      st.fondo.lista = propias.filter((r, i) => propias.indexOf(r) === i);
      st.avisoPropia = true;
    }
    dlg.querySelector("h2").textContent = `Música de «${nombrePag}»`;
    estado("");
    pintar();
    if (!dlg.open) dlg.showModal();
  }

  return { abrir };
})();
