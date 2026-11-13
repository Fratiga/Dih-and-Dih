/* Biblioteca de los jugadores (biblioteca.html): lista, vista y editor de entradas. Datos en js/biblioteca-datos.js. */
(function () {
  const B = window.Biblioteca;
  const esc = B.esc;
  const raiz = document.getElementById("bibRaiz");
  let sesion = null, admin = false, entradas = [], filtroTipo = "", filtroTexto = "", abierta = null;

  function aviso(texto, error) {
    const a = document.getElementById("bibAviso");
    a.textContent = texto;
    a.className = "bib-aviso" + (error ? " error" : "");
    a.hidden = false;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => { a.hidden = true; }, error ? 6000 : 3000);
  }
  function mensajeError(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para eso.";
    if (/relation .*biblioteca_entradas.* does not exist|Could not find the table/i.test(m)) return "La biblioteca todavía no está instalada en el servidor (falta correr docs/admin/biblioteca.sql).";
    return m;
  }
  const puedeEditar = e => !!sesion && (admin || e.autor === sesion.user.id);

  /* ------------------------------------------------------------ lista */
  async function cargar() {
    if (!sesion) { pintar(); return; }
    try { entradas = await B.listar(); } catch (e) { entradas = []; aviso(mensajeError(e), true); }
    pintar();
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && (!abierta || abierta.id !== id)) abrir(id);
  }
  function pintar() {
    if (!sesion) {
      raiz.innerHTML = `<p class="bib-intro">La biblioteca es para los jugadores: inicia sesión (arriba a la derecha) para leerla y subir tu clase o tu raza.</p>`;
      return;
    }
    const cuenta = { "": entradas.length };
    entradas.forEach(e => { cuenta[e.tipo] = (cuenta[e.tipo] || 0) + 1; });
    raiz.innerHTML = `
      <p class="bib-intro">Aquí cada uno sube su clase, su subclase o su raza (o cualquier regla que use) para que todos la podamos consultar.
        Puedes escribirla, pegar la tabla de la clase y adjuntar el PDF o capturas del libro. Desde tu ficha puedes enlazarla y ver la tabla ahí mismo.</p>
      <div class="bib-barra">
        <div class="bib-chips">${[["", "Todas"], ["clase", "Clases"], ["subclase", "Subclases"], ["raza", "Razas"], ["otro", "Otras"]].map(([v, t]) =>
          `<button type="button" class="nav-chip${filtroTipo === v ? " active" : ""}" data-tipo="${v}">${t} <small>${cuenta[v] || 0}</small></button>`).join("")}</div>
        <input type="search" class="bib-buscar" placeholder="Buscar por nombre, fuente o autor…" value="${esc(filtroTexto)}">
        <button type="button" class="bib-boton bib-boton-fuerte" data-nueva>＋ Subir entrada</button>
      </div>
      <div class="bib-rejilla"></div>`;
    raiz.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => { filtroTipo = b.dataset.tipo; pintar(); }));
    const buscar = raiz.querySelector(".bib-buscar");
    buscar.addEventListener("input", () => { filtroTexto = buscar.value; pintarRejilla(); });
    raiz.querySelector("[data-nueva]").addEventListener("click", () => editar(null));
    pintarRejilla();
  }
  function pintarRejilla() {
    const r = raiz.querySelector(".bib-rejilla");
    if (!r) return;
    const f = filtroTexto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const lista = entradas.filter(e => (!filtroTipo || e.tipo === filtroTipo) && (!f || [e.nombre, e.fuente, e.autor_nombre, e.resumen].some(x => norm(x).includes(f))));
    if (!lista.length) { r.innerHTML = `<p class="bib-vacio">${entradas.length ? "Nada con ese filtro." : "Todavía no hay nada. Sé el primero en subir tu clase o tu raza."}</p>`; return; }
    r.innerHTML = lista.map(e => `
      <button type="button" class="bib-tarjeta" data-id="${e.id}">
        <span class="bib-tipo bib-tipo-${e.tipo}">${esc(B.TIPOS[e.tipo] || e.tipo)}</span>
        <strong>${esc(e.nombre)}</strong>
        ${e.fuente ? `<small class="bib-fuente">${esc(e.fuente)}</small>` : ""}
        ${e.resumen ? `<span class="bib-resumen">${esc(e.resumen)}</span>` : ""}
        <small class="bib-autor">Subida por ${esc(e.autor_nombre || "alguien")}</small>
      </button>`).join("");
    r.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => abrir(b.dataset.id)));
  }

  /* ------------------------------------------------------------ ver una entrada */
  const dlg = document.getElementById("bibDialogo");
  const dlgCuerpo = document.getElementById("bibDialogoCuerpo");
  document.getElementById("bibDialogoCerrar").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { abierta = null; if (location.hash) history.replaceState(null, "", location.pathname + location.search); });
  dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });

  async function abrir(id) {
    let e;
    try { e = await B.obtener(id); } catch (err) { aviso(mensajeError(err), true); return; }
    if (!e) { aviso("Esa entrada ya no existe.", true); return; }
    abierta = e;
    if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
    dlgCuerpo.innerHTML = `
      <header class="bib-vista-cab">
        <span class="bib-tipo bib-tipo-${e.tipo}">${esc(B.TIPOS[e.tipo] || e.tipo)}</span>
        <h2>${esc(e.nombre)}</h2>
        <p class="bib-vista-meta">${e.fuente ? esc(e.fuente) + " · " : ""}Subida por ${esc(e.autor_nombre)} · Actualizada el ${new Date(e.actualizada).toLocaleDateString("es")}</p>
        ${puedeEditar(e) ? `<div class="bib-vista-botones"><button type="button" class="bib-boton" data-editar>Editar</button><button type="button" class="bib-boton bib-boton-peligro" data-borrar>Borrar</button></div>` : ""}
      </header>
      ${e.resumen ? `<p class="bib-vista-resumen">${esc(e.resumen)}</p>` : ""}
      ${(e.tabla && e.tabla.columnas && e.tabla.columnas.length) ? `<h3>Tabla</h3>${B.tablaHtml(e.tabla)}` : ""}
      ${e.contenido ? `<div class="bib-contenido">${B.limpiarHtml(e.contenido)}</div>` : ""}
      ${(e.archivos || []).length ? `<h3>Archivos</h3><div class="bib-archivos" data-archivos></div>` : ""}
      <p class="bib-enlace-ficha">Para enlazarla desde tu ficha: en «Mis personajes», sección Identidad, elige esta entrada en «Biblioteca».</p>`;
    if (!dlg.open) dlg.showModal();
    dlgCuerpo.scrollTop = 0;
    const caja = dlgCuerpo.querySelector("[data-archivos]");
    if (caja) pintarArchivos(caja, e.archivos);
    const be = dlgCuerpo.querySelector("[data-editar]"), bb = dlgCuerpo.querySelector("[data-borrar]");
    if (be) be.addEventListener("click", () => editar(e));
    if (bb) bb.addEventListener("click", async () => {
      if (!confirm(`¿Borrar «${e.nombre}» con sus archivos? No se puede deshacer.`)) return;
      try { await B.borrar(e); dlg.close(); aviso("Entrada borrada."); cargar(); } catch (err) { aviso(mensajeError(err), true); }
    });
  }
  async function pintarArchivos(caja, archivos) {
    caja.innerHTML = archivos.map((a, i) => `<div class="bib-archivo" data-i="${i}"><span>${a.tipo === "application/pdf" ? "📄" : "🖼"} ${esc(a.nombre)}</span><small>${(a.tam / 1048576).toFixed(1)} MB</small></div>`).join("");
    for (let i = 0; i < archivos.length; i++) {
      const a = archivos[i], fila = caja.querySelector(`[data-i="${i}"]`);
      try {
        const url = await B.enlace(a.ruta);
        if (a.tipo === "application/pdf") fila.insertAdjacentHTML("beforeend", `<a class="bib-boton" href="${esc(url)}" target="_blank" rel="noopener">Abrir PDF</a>`);
        else fila.insertAdjacentHTML("afterend", `<a href="${esc(url)}" target="_blank" rel="noopener" class="bib-imagen"><img src="${esc(url)}" alt="${esc(a.nombre)}" loading="lazy"></a>`);
      } catch (err) { fila.insertAdjacentHTML("beforeend", `<small class="bib-error">No se pudo abrir</small>`); }
    }
  }

  /* ------------------------------------------------------------ editor */
  function editar(e) {
    const nueva = !e;
    const d = e ? JSON.parse(JSON.stringify(e)) : { tipo: filtroTipo || "clase", nombre: "", fuente: "", resumen: "", contenido: "", tabla: { columnas: [], filas: [] }, archivos: [] };
    const subidasNuevas = [];   // si se cancela, se borran
    dlgCuerpo.innerHTML = `
      <header class="bib-vista-cab"><h2>${nueva ? "Subir una entrada" : "Editar «" + esc(d.nombre) + "»"}</h2></header>
      <div class="bib-form">
        <div class="bib-form-fila">
          <label class="bib-campo"><span>Tipo</span><select data-tipo>${Object.entries(B.TIPOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
          <label class="bib-campo bib-campo-ancho"><span>Nombre</span><input type="text" maxlength="80" data-nombre placeholder="Por ejemplo, Paladín o Tiefling"></label>
          <label class="bib-campo bib-campo-ancho"><span>Fuente</span><input type="text" maxlength="80" data-fuente placeholder="Manual del jugador, homebrew, Tasha…"></label>
        </div>
        <label class="bib-campo"><span>Resumen (una o dos frases)</span><input type="text" maxlength="300" data-resumen></label>
        <div class="bib-campo"><span>Texto: rasgos, reglas, lo que haga falta. Puedes pegar desde una web y se queda el formato básico.</span>
          <div class="bib-editor-barra">
            <button type="button" data-cmd="bold" title="Negrita"><b>N</b></button>
            <button type="button" data-cmd="italic" title="Cursiva"><i>C</i></button>
            <button type="button" data-cmd="underline" title="Subrayado"><u>S</u></button>
            <button type="button" data-cmd="formatBlock" data-arg="H3" title="Título">Título</button>
            <button type="button" data-cmd="formatBlock" data-arg="H4" title="Subtítulo">Subtítulo</button>
            <button type="button" data-cmd="formatBlock" data-arg="P" title="Párrafo normal">Párrafo</button>
            <button type="button" data-cmd="insertUnorderedList" title="Lista">• Lista</button>
            <button type="button" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>
            <button type="button" data-cmd="formatBlock" data-arg="BLOCKQUOTE" title="Cita o recuadro">Recuadro</button>
            <button type="button" data-cmd="removeFormat" title="Quitar formato">Limpiar</button>
          </div>
          <div class="bib-editor" contenteditable="true" data-contenido></div>
        </div>
        <div class="bib-campo"><span>Tabla de la clase (opcional). Una fila por línea; la primera son los títulos. Separa las columnas con tabulador o con «|». Si copias la tabla de una web y la pegas aquí, ya viene bien.</span>
          <textarea rows="6" data-tabla placeholder="Nivel | Bono de competencia | Rasgos&#10;1 | +2 | Sentido divino, Imposición de manos&#10;2 | +2 | Estilo de combate, Conjuros"></textarea>
          <div data-previa></div>
        </div>
        <div class="bib-campo"><span>Archivos: PDF o imágenes, hasta 20 MB cada uno (máximo 12)</span>
          <div class="bib-soltar" data-soltar>Suelta aquí los archivos o <label class="bib-enlace">elígelos<input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" hidden data-archivo></label></div>
          <div data-lista-archivos></div>
        </div>
        <div class="bib-form-pie"><button type="button" class="bib-boton" data-cancelar>Cancelar</button><button type="button" class="bib-boton bib-boton-fuerte" data-guardar>${nueva ? "Publicar" : "Guardar cambios"}</button></div>
      </div>`;
    if (!dlg.open) dlg.showModal();
    dlgCuerpo.scrollTop = 0;
    const q = s => dlgCuerpo.querySelector(s);
    q("[data-tipo]").value = d.tipo; q("[data-nombre]").value = d.nombre; q("[data-fuente]").value = d.fuente; q("[data-resumen]").value = d.resumen;
    const editor = q("[data-contenido]");
    editor.innerHTML = B.limpiarHtml(d.contenido);
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (err) { /* nada */ }
    dlgCuerpo.querySelectorAll("[data-cmd]").forEach(b => b.addEventListener("mousedown", ev => {
      ev.preventDefault();
      editor.focus();
      document.execCommand(b.dataset.cmd, false, b.dataset.arg || null);
    }));
    // Al pegar se limpia el HTML (sin estilos ni scripts de la web de origen)
    editor.addEventListener("paste", ev => {
      const html = ev.clipboardData.getData("text/html");
      if (!html) return;
      ev.preventDefault();
      document.execCommand("insertHTML", false, B.limpiarHtml(html));
    });
    const tabla = q("[data-tabla]"), previa = q("[data-previa]");
    tabla.value = B.tablaATexto(d.tabla);
    const verPrevia = () => { const t = B.textoATabla(tabla.value); previa.innerHTML = t.columnas.length ? `<p class="bib-nota">Así se verá:</p>${B.tablaHtml(t)}` : ""; };
    tabla.addEventListener("input", verPrevia);
    verPrevia();

    const listaArch = q("[data-lista-archivos]");
    const pintarLista = () => {
      listaArch.innerHTML = d.archivos.map((a, i) => `<div class="bib-archivo"><span>${a.tipo === "application/pdf" ? "📄" : "🖼"} ${esc(a.nombre)}</span><small>${(a.tam / 1048576).toFixed(1)} MB</small><button type="button" class="bib-boton bib-boton-peligro" data-quitar="${i}">Quitar</button></div>`).join("");
      listaArch.querySelectorAll("[data-quitar]").forEach(b => b.addEventListener("click", () => { d.archivos.splice(Number(b.dataset.quitar), 1); pintarLista(); }));
    };
    pintarLista();
    const subirVarios = async files => {
      for (const f of files) {
        if (d.archivos.length >= 12) { aviso("Como mucho 12 archivos por entrada.", true); break; }
        try {
          aviso("Subiendo " + f.name + "…");
          const a = await B.subir(f);
          d.archivos.push(a); subidasNuevas.push(a.ruta);
          pintarLista();
        } catch (err) { aviso(mensajeError(err), true); }
      }
      aviso("Archivos listos. Recuerda guardar.");
    };
    q("[data-archivo]").addEventListener("change", ev => { subirVarios([...ev.target.files]); ev.target.value = ""; });
    const zona = q("[data-soltar]");
    zona.addEventListener("dragover", ev => { ev.preventDefault(); zona.classList.add("encima"); });
    zona.addEventListener("dragleave", () => zona.classList.remove("encima"));
    zona.addEventListener("drop", ev => { ev.preventDefault(); zona.classList.remove("encima"); subirVarios([...ev.dataTransfer.files]); });

    const cancelar = async () => {
      for (const r of subidasNuevas) await B.quitarArchivo(r).catch(() => {});
      if (e) abrir(e.id); else dlg.close();
    };
    q("[data-cancelar]").addEventListener("click", cancelar);
    q("[data-guardar]").addEventListener("click", async ev => {
      const nombre = q("[data-nombre]").value.trim();
      if (!nombre) { aviso("Ponle un nombre.", true); q("[data-nombre]").focus(); return; }
      const boton = ev.currentTarget;
      boton.disabled = true; boton.textContent = "Guardando…";
      try {
        const quitados = (e && e.archivos || []).filter(a => !d.archivos.some(x => x.ruta === a.ruta)).map(a => a.ruta);
        const guardada = await B.guardar({ id: e && e.id, tipo: q("[data-tipo]").value, nombre, fuente: q("[data-fuente]").value.trim(), resumen: q("[data-resumen]").value.trim(),
          contenido: editor.innerHTML, tabla: B.textoATabla(tabla.value), archivos: d.archivos });
        for (const r of quitados) await B.quitarArchivo(r).catch(() => {});
        subidasNuevas.length = 0;
        aviso(nueva ? "Publicada. Ya la pueden ver todos." : "Cambios guardados.");
        await cargar();
        abrir(guardada.id);
      } catch (err) {
        aviso(mensajeError(err), true);
        boton.disabled = false; boton.textContent = nueva ? "Publicar" : "Guardar cambios";
      }
    });
  }

  window.addEventListener("hashchange", () => { const id = decodeURIComponent(location.hash.slice(1)); if (id && sesion && (!abierta || abierta.id !== id)) abrir(id); });

  pintar();
  if (typeof fichasEnCambioDeSesion === "function") {
    fichasEnCambioDeSesion(async s => {
      sesion = s;
      admin = s ? await B.esAdmin() : false;
      cargar();
    }).catch(() => pintar());
  }
})();
