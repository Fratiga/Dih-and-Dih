/* Editor de la música de una página (solo Admin). Lo carga js/musica-paginas.js cuando se pulsa ⚙.
   Las canciones salen de la Rocola de fondos (js/musica-fondos.js), una biblioteca aparte de la Rocola pública:
   se suben desde el desplegable de arriba del editor. Las listas que ya usaban canciones de la Rocola pública
   siguen funcionando y se pueden copiar a la biblioteca con un botón. */
window.MusicaPaginasEditor = (function () {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CLAVE_CACHE = "musicaPaginasCfg";

  let dlg = null, st = null, previa = null, biblio = null;
  let catalogo = [], legado = new Set();
  // Canciones que traen los juegos y no están en la Rocola
  const MUSICAS_DE_JUEGOS = ["assets/cosas/All The Fun At The Fair.mp3", "assets/cosas/Pizza Parlor Theme.mp3", "assets/cosas/The Crack of Doom.mp3"];

  function nombreCancion(ruta) {
    const propio = window.MusicaFondos && window.MusicaFondos.nombreDe(ruta);
    if (propio) return propio;
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
        <li><span class="mpe-nombre" title="${esc(r)}">${esc(nombreCancion(r))}${legado.has(r) ? ` <small class="mpe-aviso">de la rocola pública</small>` : ""}</span>
          ${legado.has(r) ? `<button type="button" data-acc="copia" data-i="${i}" title="Sube una copia a tu rocola de fondos y la usa en esta lista, para que no dependa de la pública">Copiar a mi rocola</button>` : ""}
          <button type="button" class="mpe-prev" data-acc="prev" data-i="${i}" aria-label="Escuchar">▶</button>
          <button type="button" data-acc="sube" data-i="${i}" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" data-acc="baja" data-i="${i}" aria-label="Bajar"${i === s.lista.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" data-acc="quita" data-i="${i}" aria-label="Quitar">✕</button></li>`).join("") || `<li class="mpe-vacia">Sin canciones.</li>`}</ol>
      <div class="mpe-anadir">
        <input type="text" list="mpeCatalogo" data-add placeholder="Buscar una canción de tu rocola de fondos..." aria-label="Añadir canción">
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
      <datalist id="mpeCatalogo">${catalogo.map(([nombre]) => `<option value="${esc(nombre)}"></option>`).join("")}</datalist>
      ${seccionHtml("fondo", st.etiquetas ? st.etiquetas.fondo[0] : "Música de fondo", (st.etiquetas ? st.etiquetas.fondo[1] : "Suena mientras estás en la página. Cuando termina una canción pasa a la siguiente y, al acabar la lista, vuelve a empezar.") + (st.avisoPropia ? " <strong>Esta página ya trae su canción; la dejé en la lista para que la veas. Al guardar, la lista manda y la de fábrica deja de sonar.</strong>" : ""))}
      ${st.conPartida ? `<div class="mpe-opciones mpe-continua"><label><input type="checkbox" data-continua${st.continua ? " checked" : ""}> No cambiar de canción al empezar ni al terminar una partida</label>
        <p class="mpe-ayuda">Con esto marcado la música de fondo sigue sonando sin cortes, esté o no la partida en marcha, y la lista de partida de abajo no se usa.</p></div>` : ""}
      ${st.conPartida ? seccionHtml("partida", st.etiquetas ? st.etiquetas.partida[0] : "Al empezar una partida", st.etiquetas ? st.etiquetas.partida[1] : "En cuanto empieza una partida suena esta lista en vez de la de fondo, y al terminar vuelve la de fondo. Si la dejas vacía, la música no cambia.") : ""}
      ${otras.length ? `<div class="mpe-copiar"><label>Copiar la lista de otra página
        <select data-copiar><option value="">Elegir...</option>${otras.map(p => `<option value="${esc(p)}">${esc(nombrePag(p))}</option>`).join("")}</select></label></div>` : ""}
      <p class="mpe-ayuda">Las canciones son las de tu rocola de fondos (el desplegable de arriba), que no se mezcla con la Rocola pública. Para tener más, súbelas allí.${otras.length ? ` Páginas con música ahora: ${otras.map(p => esc(nombrePag(p))).join(", ")}.` : ""}</p>`;
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
    const exacto = catalogo.find(([n]) => n.toLowerCase() === t);
    if (exacto) return exacto[1];
    const parecidas = catalogo.filter(([n]) => n.toLowerCase().includes(t));
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
        if (!ruta) { estado(input.value.trim() ? "No encuentro esa canción en tu rocola de fondos. Elige una de la lista o súbela arriba." : "Escribe el nombre de una canción.", true); return; }
        s.lista.push(ruta); estado(""); pintar(); break;
      }
      case "copia": {
        const ruta = s.lista[i];
        b.disabled = true; estado("Copiando la canción a tu rocola...");
        window.MusicaFondos.copiarDesde(ruta, nombreCancion(ruta)).then(f => {
          ["fondo", "partida"].forEach(k => { st[k].lista = st[k].lista.map(x => (x === ruta ? f.ruta : x)); });
          armarCatalogo(); if (biblio) biblio.pintar();
          pintar(); estado("Copiada. Pulsa Guardar para que la página use tu copia.");
        }).catch(e => { b.disabled = false; estado(`No se pudo copiar: ${e.message || e}`, true); });
        break;
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
      if (otra) { st.continua = !!otra.continua; st.fondo = nuevaSeccion(otra); if (st.conPartida && otra.partida) st.partida = nuevaSeccion(otra.partida); pintar(); }
      return;
    }
    if (el.matches("[data-continua]")) { st.continua = el.checked; return; }
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
    if (st.conPartida && st.continua) cfg.continua = true;
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
      <details class="mpe-biblioteca"><summary>Mi rocola de fondos (solo para la música de las páginas, aparte de la Rocola pública)</summary><div class="mpe-biblioteca-cuerpo"></div></details>
      <div class="mpe-cuerpo"></div>
      <p class="mpe-estado" role="status"></p>
      <div class="mpe-botones"><button type="button" class="mpe-guardar">Guardar</button></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".mpe-cerrar").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => { pararPrevia(); if (window.MusicaFondos) window.MusicaFondos.parar(); });
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.querySelector(".mpe-guardar").addEventListener("click", guardar);
    dlg.addEventListener("click", alClic);
    dlg.addEventListener("change", alCambiar);
    dlg.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.matches("[data-add]")) { ev.preventDefault(); ev.target.closest("[data-sec]").querySelector('[data-acc="anade"]').click(); } });
  }

  // El catálogo: la rocola de fondos + las canciones que traen de fábrica los juegos (que no están en la Rocola pública)
  function armarCatalogo() {
    const usados = new Map();
    const propias = (window.__fondoPropio || []).map(x => x.rutaOriginal).filter(Boolean);
    const lista = window.MusicaFondos ? window.MusicaFondos.lista().map(f => f.ruta) : [];
    [...propias, ...MUSICAS_DE_JUEGOS].forEach(r => { if (!lista.includes(r)) lista.push(r); });
    catalogo = [];
    lista.forEach(r => {
      let n = nombreCancion(r);
      const k = usados.get(n) || 0;
      usados.set(n, k + 1);
      if (k) n = `${n} (${k + 1})`;
      catalogo.push([n, r]);
    });
    catalogo.sort((x, y) => x[0].localeCompare(y[0], "es", { sensitivity: "base" }));
    // Las que están en una lista pero vienen de la Rocola pública
    const conocidas = new Set(lista);
    legado = new Set();
    if (st) [...st.fondo.lista, ...st.partida.lista].forEach(r => { if (!conocidas.has(r) && (window.MUSICA || []).includes(r)) legado.add(r); });
  }

  function abrir(o) {
    if (!dlg) crearDialogo();
    const nombrePag = (o.paginas.find(x => x[0] === o.pagina) || [o.pagina, o.pagina])[1];
    const propias = (window.__fondoPropio || []).map(x => x.rutaOriginal).filter(Boolean);
    st = { pagina: o.pagina, paginas: o.paginas, conPartida: o.conPartida, etiquetas: o.etiquetas || null,
      continua: !!(o.config && o.config.continua), fondo: nuevaSeccion(o.config), partida: nuevaSeccion(o.config && o.config.partida) };
    // Sin música configurada, la lista arranca con la que suena hoy en esa página (si la página trae una propia)
    if (!(o.config && (o.config.lista || []).length) && propias.length) {
      st.fondo.lista = propias.filter((r, i) => propias.indexOf(r) === i);
      st.avisoPropia = true;
    }
    armarCatalogo();
    dlg.querySelector("h2").textContent = `Música de «${nombrePag}»`;
    estado("");
    pintar();
    if (!dlg.open) dlg.showModal();
    // La biblioteca se lee del servidor; cuando llega (o cambia) se rehace el catálogo
    if (!biblio) biblio = window.MusicaFondos.montar(dlg.querySelector(".mpe-biblioteca-cuerpo"), { alCambiar: () => { if (st) { armarCatalogo(); pintar(); } } });
    else window.MusicaFondos.cargar(true).then(() => { armarCatalogo(); biblio.pintar(); pintar(); }).catch(() => {});
  }

  return { abrir };
})();
