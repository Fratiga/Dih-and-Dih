/* =============================================================================
   TABLERO — piezas de interfaz: ventanas flotantes (se arrastran, se redimensionan, se minimizan), modales,
   menú contextual, avisos, selector de jugadores con fichitas y editor de texto con formato.
============================================================================= */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  /* ------------------------------------------------------------ avisos */
  function aviso(texto, error) {
    const caja = document.getElementById("tbAvisos");
    const a = el(`<div class="tb-aviso${error ? " error" : ""}">${esc(texto)}</div>`);
    caja.appendChild(a);
    setTimeout(() => a.remove(), error ? 6000 : 3200);
  }
  const mensajeError = e => (e && (e.message || e.error_description || e.details)) || "Algo falló.";

  /* ------------------------------------------------------------ ventanas flotantes */
  const ventanas = new Map();
  let zTope = 360;
  function ventana(id, { titulo, ancho, alto, x, y, cuerpo, pie, alCerrar, minimizable = true, redimensionable = true, recordar = true }) {
    if (ventanas.has(id)) { const v = ventanas.get(id); traerAlFrente(v.el); return v; }
    const guardada = recordar ? leerPos(id) : null;
    const w = el(`<section class="tb-ventana" data-ventana="${esc(id)}">
      <header class="tb-ventana-cab"><h3>${titulo || ""}</h3>
        ${minimizable ? `<button type="button" data-min title="Minimizar">—</button>` : ""}<button type="button" data-cerrar title="Cerrar">✕</button></header>
      <div class="tb-ventana-cuerpo"></div>${pie ? `<footer class="tb-ventana-pie"></footer>` : ""}
      ${redimensionable ? `<div class="tb-ventana-asa"></div>` : ""}</section>`);
    const pos = guardada || { x: x == null ? 300 : x, y: y == null ? 120 : y, w: ancho || 320, h: alto || null };
    Object.assign(w.style, { left: pos.x + "px", top: pos.y + "px", width: (pos.w || ancho || 320) + "px" });
    if (pos.h) w.style.height = pos.h + "px";
    const cuerpoEl = w.querySelector(".tb-ventana-cuerpo");
    if (cuerpo) cuerpoEl.append(cuerpo);
    if (pie) w.querySelector(".tb-ventana-pie").append(pie);
    document.getElementById("tbVentanas").appendChild(w);
    traerAlFrente(w);
    const v = { el: w, cuerpo: cuerpoEl, pie: w.querySelector(".tb-ventana-pie"), titulo: t => { w.querySelector("h3").innerHTML = t; },
      cerrar: () => { w.remove(); ventanas.delete(id); if (alCerrar) alCerrar(); } };
    ventanas.set(id, v);
    w.addEventListener("mousedown", () => traerAlFrente(w));
    w.querySelector("[data-cerrar]").addEventListener("click", () => v.cerrar());
    const min = w.querySelector("[data-min]");
    if (min) min.addEventListener("click", () => { w.classList.toggle("minimizada"); if (w.classList.contains("minimizada")) w.style.height = ""; });
    arrastrable(w, w.querySelector(".tb-ventana-cab"), () => recordar && guardarPos(id, w));
    const asa = w.querySelector(".tb-ventana-asa");
    if (asa) asa.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, y0 = e.clientY, w0 = w.offsetWidth, h0 = w.offsetHeight;
      const mover = ev => { w.style.width = Math.max(220, w0 + ev.clientX - x0) + "px"; w.style.height = Math.max(140, h0 + ev.clientY - y0) + "px"; };
      const soltar = () => { window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); if (recordar) guardarPos(id, w); };
      window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
    });
    return v;
  }
  function traerAlFrente(w) { w.style.zIndex = ++zTope; }
  function arrastrable(w, asa, alSoltar) {
    asa.addEventListener("mousedown", e => {
      if (e.target.closest("button, input, select")) return;
      e.preventDefault();
      const x0 = e.clientX - w.offsetLeft, y0 = e.clientY - w.offsetTop;
      const mover = ev => {
        w.style.left = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - x0)) + "px";
        w.style.top = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - y0)) + "px";
      };
      const soltar = () => { window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); if (alSoltar) alSoltar(); };
      window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
    });
  }
  function leerPos(id) { try { return JSON.parse(localStorage.getItem("tbVentana:" + id) || "null"); } catch (e) { return null; } }
  function guardarPos(id, w) {
    try { localStorage.setItem("tbVentana:" + id, JSON.stringify({ x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.style.height ? w.offsetHeight : null })); } catch (e) { /* sin almacenamiento */ }
  }

  /* ------------------------------------------------------------ modales */
  let modalAbierto = null;
  function modal({ titulo, cuerpo, aceptar = "Guardar cambios", cancelar = "Cancelar", ancho, alAceptar, alCerrar, extraPie }) {
    cerrarModal();
    const fondo = document.getElementById("tbFondoModal");
    const m = el(`<div class="tb-modal" role="dialog" aria-modal="true">
      <header class="tb-modal-cab"><h2>${titulo}</h2><button type="button" data-cerrar aria-label="Cerrar">✕</button></header>
      <div class="tb-modal-cuerpo"></div>
      <footer class="tb-modal-pie">${cancelar ? `<button type="button" class="tb-btn" data-cancelar>${esc(cancelar)}</button>` : ""}${aceptar ? `<button type="button" class="tb-btn tb-btn-azul" data-aceptar>${esc(aceptar)}</button>` : ""}</footer>
    </div>`);
    if (ancho) m.style.width = ancho + "px";
    m.querySelector(".tb-modal-cuerpo").append(cuerpo);
    if (extraPie) m.querySelector(".tb-modal-pie").prepend(extraPie);
    document.body.appendChild(m);
    fondo.hidden = false;
    const cerrar = () => { m.remove(); fondo.hidden = true; modalAbierto = null; if (alCerrar) alCerrar(); };
    modalAbierto = { el: m, cerrar };
    m.querySelector("[data-cerrar]").addEventListener("click", cerrar);
    const bc = m.querySelector("[data-cancelar]"); if (bc) bc.addEventListener("click", cerrar);
    const ba = m.querySelector("[data-aceptar]");
    if (ba) ba.addEventListener("click", async () => {
      ba.disabled = true;
      try { const r = alAceptar ? await alAceptar() : true; if (r !== false) cerrar(); }
      catch (e) { aviso(mensajeError(e), true); }
      finally { ba.disabled = false; }
    });
    fondo.onclick = cerrar;
    return modalAbierto;
  }
  function cerrarModal() { if (modalAbierto) modalAbierto.cerrar(); }

  function pedir(titulo, valor, { etiqueta = "", aceptar = "Aceptar", multilinea = false } = {}) {
    return new Promise(res => {
      let hecho = false;
      const c = el(`<div><label class="tb-campo"><span>${esc(etiqueta)}</span>${multilinea ? `<textarea rows="5"></textarea>` : `<input type="text">`}</label></div>`);
      const inp = c.querySelector("input, textarea");
      inp.value = valor || "";
      modal({ titulo, cuerpo: c, aceptar, ancho: 460, alAceptar: () => { hecho = true; res(inp.value); }, alCerrar: () => { if (!hecho) res(null); } });
      setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 30);
      inp.addEventListener("keydown", e => { if (e.key === "Enter" && !multilinea) { e.preventDefault(); modalAbierto.el.querySelector("[data-aceptar]").click(); } });
    });
  }
  function confirmar(titulo, texto, aceptar = "Aceptar") {
    return new Promise(res => {
      let hecho = false;
      modal({ titulo, cuerpo: el(`<p style="margin:0;line-height:1.5">${esc(texto)}</p>`), aceptar, ancho: 440,
        alAceptar: () => { hecho = true; res(true); }, alCerrar: () => { if (!hecho) res(false); } });
    });
  }

  /* ------------------------------------------------------------ menú contextual */
  function menu(x, y, items) {
    const m = document.getElementById("tbMenu");
    m.innerHTML = "";
    items.forEach(it => {
      if (it === "-") { m.appendChild(el("<hr>")); return; }
      if (it.cab) { m.appendChild(el(`<div class="tb-menu-cab">${esc(it.cab)}</div>`)); return; }
      const b = el(`<button type="button" class="${it.peligro ? "peligro" : ""}">${it.texto}</button>`);
      b.addEventListener("click", () => { m.hidden = true; it.accion(); });
      m.appendChild(b);
    });
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
    m.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
  }
  function cerrarMenu() { document.getElementById("tbMenu").hidden = true; }
  document.addEventListener("mousedown", e => { if (!e.target.closest("#tbMenu")) cerrarMenu(); });

  /* ------------------------------------------------------------ selector de jugadores (fichitas) */
  function chips(opciones, elegidos, { todos = null } = {}) {
    // opciones: [{id, nombre}]; todos: texto de la opción "Todos los jugadores" (id "*")
    let sel = elegidos.slice();
    const caja = el(`<div class="tb-chips"></div>`);
    const lista = todos ? [{ id: "*", nombre: todos }].concat(opciones) : opciones;
    function pintar() {
      caja.innerHTML = "";
      sel.forEach(id => {
        const o = lista.find(x => x.id === id);
        if (!o) return;
        const c = el(`<span class="tb-chip">${esc(o.nombre)} <button type="button" aria-label="Quitar">×</button></span>`);
        c.querySelector("button").addEventListener("click", () => { sel = sel.filter(x => x !== id); pintar(); });
        caja.appendChild(c);
      });
      const libres = lista.filter(o => !sel.includes(o.id) && !(sel.includes("*") && o.id !== "*"));
      if (libres.length) {
        const s = el(`<select><option value="">Añadir…</option>${libres.map(o => `<option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join("")}</select>`);
        s.addEventListener("change", () => { if (s.value === "*") sel = ["*"]; else if (s.value) sel.push(s.value); pintar(); });
        caja.appendChild(s);
      }
    }
    pintar();
    return { el: caja, valor: () => sel.slice() };
  }

  /* ------------------------------------------------------------ editor con formato */
  const PERMITIDAS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUP", "SUB", "P", "BR", "DIV", "UL", "OL", "LI", "A", "HR", "H1", "H2", "H3", "H4", "SPAN", "FONT", "IMG", "TABLE", "TBODY", "TR", "TD", "TH", "BLOCKQUOTE", "MARK"]);
  function limpiarHtml(html) {
    const t = document.createElement("template");
    t.innerHTML = String(html || "");
    (function rec(n) {
      [...n.childNodes].forEach(h => {
        if (h.nodeType === 1) {
          if (!PERMITIDAS.has(h.tagName)) { h.replaceWith(...h.childNodes); rec(n); return; }
          [...h.attributes].forEach(a => {
            const v = a.value || "";
            const ok = (a.name === "href" && /^https?:/i.test(v)) || (a.name === "src" && /^(https?:|data:image\/|assets\/)/i.test(v)) || a.name === "color" || (a.name === "style" && /^[\w\s:;#%,.()-]*$/.test(v) && !/url|expression/i.test(v));
            if (!ok) h.removeAttribute(a.name);
          });
          if (h.tagName === "A") { h.setAttribute("target", "_blank"); h.setAttribute("rel", "noopener"); }
          rec(h);
        } else if (h.nodeType !== 3) h.remove();
      });
    })(t.content);
    return t.innerHTML;
  }
  function editorRico(html) {
    const caja = el(`<div class="tb-editor-rico">
      <div class="tb-editor-rico-barra">
        <button type="button" data-c="bold"><b>B</b></button><button type="button" data-c="italic"><i>I</i></button><button type="button" data-c="underline"><u>U</u></button>
        <button type="button" data-c="strikeThrough"><s>S</s></button><button type="button" data-c="removeFormat" title="Quitar formato">⌫</button>
        <button type="button" data-c="superscript">X²</button><button type="button" data-c="subscript">X₂</button>
        <button type="button" data-c="insertOrderedList">1.</button><button type="button" data-c="insertUnorderedList">•</button>
        <button type="button" data-c="justifyLeft">⯇</button><button type="button" data-c="justifyCenter">≡</button>
        <button type="button" data-c="createLink" title="Enlace">🔗</button><button type="button" data-c="unlink" title="Quitar enlace">⛓</button>
        <button type="button" data-c="insertHorizontalRule">—</button><button type="button" data-c="hiliteColor" title="Resaltar">A</button>
        <button type="button" data-c="formatBlock" title="Título">H</button><button type="button" data-c="insertImage" title="Imagen por URL">🖼</button>
      </div>
      <div class="tb-editor-rico-area" contenteditable="true"></div></div>`);
    const area = caja.querySelector(".tb-editor-rico-area");
    area.innerHTML = limpiarHtml(html);
    caja.querySelector(".tb-editor-rico-barra").addEventListener("mousedown", e => e.preventDefault());
    caja.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", async () => {
      const c = b.dataset.c;
      area.focus();
      if (c === "createLink" || c === "insertImage") {
        const sel = window.getSelection(), rango = sel.rangeCount ? sel.getRangeAt(0) : null;
        const url = window.prompt(c === "createLink" ? "Dirección del enlace (https://…)" : "Dirección de la imagen (https://…)");
        if (!url) return;
        if (rango) { sel.removeAllRanges(); sel.addRange(rango); }
        document.execCommand(c, false, url);
      } else if (c === "hiliteColor") document.execCommand(c, false, "#fff36b");
      else if (c === "formatBlock") document.execCommand(c, false, "h3");
      else document.execCommand(c, false, null);
    }));
    return { el: caja, valor: () => limpiarHtml(area.innerHTML) };
  }

  /* ------------------------------------------------------------ campo de imagen (soltar, subir o URL) */
  function campoImagen(src, subir, { texto = "Suelta una imagen aquí o haz clic" } = {}) {
    let valor = src || "";
    const zona = el(`<div class="tb-avatar-zona"></div>`);
    const archivo = el(`<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`);
    zona.appendChild(archivo);
    function pintar() {
      zona.style.backgroundImage = valor ? `url("${valor.replace(/"/g, "%22")}")` : "";
      zona.classList.toggle("vacia", !valor);
      [...zona.childNodes].forEach(n => { if (n !== archivo) n.remove(); });
      if (!valor) zona.appendChild(el(`<span>${esc(texto)}</span>`));
    }
    async function usar(f) {
      if (!f || !/^image\//.test(f.type)) return;
      try { valor = await subir(f); pintar(); } catch (e) { aviso(mensajeError(e), true); }
    }
    zona.addEventListener("click", () => archivo.click());
    archivo.addEventListener("change", () => usar(archivo.files[0]));
    zona.addEventListener("dragover", e => { e.preventDefault(); zona.classList.add("soltando"); });
    zona.addEventListener("dragleave", () => zona.classList.remove("soltando"));
    zona.addEventListener("drop", e => {
      e.preventDefault(); zona.classList.remove("soltando");
      if (e.dataTransfer.files.length) usar(e.dataTransfer.files[0]);
      else { const u = e.dataTransfer.getData("text/tablero-src") || e.dataTransfer.getData("text/uri-list"); if (u) { valor = u.trim(); pintar(); } }
    });
    pintar();
    return { el: zona, valor: () => valor, poner: v => { valor = v || ""; pintar(); } };
  }

  /* Interruptor rosa */
  function interruptor(marcado) {
    const l = el(`<label class="tb-interruptor"><input type="checkbox"${marcado ? " checked" : ""}><i></i></label>`);
    return { el: l, valor: () => l.querySelector("input").checked, input: l.querySelector("input") };
  }

  window.TBUI = { esc, el, aviso, mensajeError, ventana, ventanas, modal, cerrarModal, pedir, confirmar, menu, cerrarMenu, chips, editorRico, limpiarHtml, campoImagen, interruptor, arrastrable };
})();
