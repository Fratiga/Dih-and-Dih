/* =============================================================================
   CONCURSO — la cabina del anfitrión: editor de escenas, pasos, monitor de lo
   que está al aire, jugadores y puntos. Todo cambio pasa por cambio(), que
   guarda una copia para deshacer, guarda en local, repinta y avisa al
   programa y a los jugadores.
============================================================================= */
(function () {
  const $ = s => document.querySelector(s);
  const esc = CZ.esc;
  const C = { p: null, editId: "", sel: [], jugSel: "", abierto: "", deshacer: [], rehacer: [], porta: null, pestana: "props", vistaPaso: 0 };

  /* ---------------------------------------------------------------- arranque */

  function arrancar() {
    const id = CZ.local.actual();
    C.p = (id && CZ.local.cargar(id)) || CZ.nuevaPartida("El Gran Concurso", true);
    C.editId = C.p.vivo.escena || (C.p.escenas[0] || {}).id;
    construir();
    CZ.local.guardar(C.p);
    CZ.remoto.alCambiar = pintarRemoto;
    CZ.remoto.iniciar().then(() => CZ.remoto.publicar(C.p));
    pintarTodo();
    enviar();
  }

  /* ---------------------------------------------------------------- cambios, deshacer y envío */

  let tGuardar = null;
  function guardar() { clearTimeout(tGuardar); tGuardar = setTimeout(() => { if (!CZ.local.guardar(C.p)) aviso("No se pudo guardar en este navegador: el almacenamiento está lleno.", true); }, 300); }

  function instantanea() { return JSON.stringify(C.p); }
  function apuntar(foto) {
    C.deshacer.push(foto || instantanea());
    if (C.deshacer.length > 120) C.deshacer.shift();
    C.rehacer = [];
  }

  /* Aplica un cambio. partes: qué repintar ("todo" por defecto). */
  function cambio(fn, o) {
    o = o || {};
    if (o.historial !== false) apuntar();
    fn();
    guardar();
    pintar(o.partes || "todo");
    enviar(o.evento, o.sonido);
  }

  function deshacer() {
    if (!C.deshacer.length) return;
    C.rehacer.push(instantanea());
    C.p = CZ.normalizar(JSON.parse(C.deshacer.pop()));
    repararSeleccion();
    guardar(); pintarTodo(); enviar();
  }
  function rehacer() {
    if (!C.rehacer.length) return;
    C.deshacer.push(instantanea());
    C.p = CZ.normalizar(JSON.parse(C.rehacer.pop()));
    repararSeleccion();
    guardar(); pintarTodo(); enviar();
  }
  function repararSeleccion() {
    if (!CZ.escena(C.p, C.editId)) C.editId = (C.p.escenas[0] || {}).id || "";
    const e = escenaEdit();
    C.sel = C.sel.filter(id => e && e.elementos.some(x => x.id === id));
    if (!CZ.jugador(C.p, C.jugSel)) C.jugSel = "";
  }

  let tEnviar = null, eventoPendiente = null;
  function enviar(evento, sonido) {
    if (evento) eventoPendiente = { evento, sonido };
    if (tEnviar) return;
    // setTimeout y no requestAnimationFrame: con la cabina en segundo plano (el programa delante) el rAF no corre
    tEnviar = setTimeout(() => {
      tEnviar = null;
      const ev = eventoPendiente || {};
      eventoPendiente = null;
      CZ.canal.enviar({ tipo: "estado", partida: C.p, evento: ev.evento, sonido: ev.sonido });
      CZ.remoto.publicar(C.p);
    }, 16);
  }

  CZ.canal.escuchar(msg => {
    if (!msg) return;
    if (msg.tipo === "pedir") enviar();
    if (msg.tipo === "clic" && msg.escena === C.p.vivo.escena) {
      const e = CZ.escena(C.p, msg.escena), el = e && e.elementos.find(x => x.id === msg.el);
      if (el) clicAlAire(el, msg.sub, { altKey: !!msg.alt, shiftKey: !!msg.shift, derecho: !!msg.derecho });
    }
    if (msg.tipo === "puntos") {
      const j = CZ.jugador(C.p, msg.jugador);
      if (j && Number.isFinite(msg.valor)) sumar(j, msg.valor - j.puntos);
    }
    if (msg.tipo === "tecla") {
      if (msg.tecla === " " || msg.tecla === "ArrowRight") pasoSiguiente();
      else pasoAnterior();
    }
  });

  const escenaEdit = () => CZ.escena(C.p, C.editId);
  const elDe = id => { const e = escenaEdit(); return e && e.elementos.find(x => x.id === id); };
  const seleccion = () => C.sel.map(elDe).filter(Boolean);

  /* ---------------------------------------------------------------- estructura de la página */

  let edEsc, monEsc;
  const minis = new Map();

  function construir() {
    $("#czTemaPartida").innerHTML = Object.entries(CZ.TEMAS).map(([k, t]) => `<option value="${k}">${esc(t.nombre)}</option>`).join("");
    edEsc = new CZ.Escenario($("#czEditor"), { modo: "editor" });
    monEsc = new CZ.Escenario($("#czMonitor"), { modo: "monitor", alClic: clicAlAire });
    conectarEditor();
    conectarBarra();
    conectarTeclado();
    $("#czNombrePartida").addEventListener("change", e => cambio(() => { C.p.nombre = e.target.value.trim() || "Partida"; }, { partes: "nada" }));
    $("#czTemaPartida").addEventListener("change", e => cambio(() => { C.p.tema = e.target.value; }));
    document.querySelectorAll("[data-pestana]").forEach(b => b.addEventListener("click", () => { C.pestana = b.dataset.pestana; pintar("lado"); }));
    $("#czVerPaso").addEventListener("input", e => { C.vistaPaso = Number(e.target.value); pintar("editor"); });
  }

  /* ---------------------------------------------------------------- pintado */

  function pintarTodo() { pintar("todo"); }

  function pintar(partes) {
    if (partes === "nada") return;
    const todo = partes === "todo";
    if (todo) {
      $("#czNombrePartida").value = C.p.nombre;
      $("#czTemaPartida").value = C.p.tema;
      document.body.setAttribute("data-tema-partida", C.p.tema);
    }
    if (todo || partes === "escenas") pintarEscenas();
    if (todo || partes === "editor" || partes === "escenas") pintarEditor();
    // El monitor también se repinta al editar: la escena editada puede ser la que está al aire
    if (todo || partes === "aire" || partes === "editor" || partes === "escenas") pintarAire();
    if (todo || partes === "lado" || partes === "editor") pintarLado();
    if (todo || partes === "pasos" || partes === "editor") pintarPasos();
    if (partes === "jugadores") { pintarLado(); pintarAire(); pintarEditor(); }
  }

  /* --- lista de escenas --- */
  function pintarEscenas() {
    const lista = $("#czEscenas");
    const usadas = new Set();
    let html = "", carpeta = null;
    C.p.escenas.forEach((e, i) => {
      if ((e.carpeta || "") !== carpeta) {
        carpeta = e.carpeta || "";
        html += `<div class="cz-carpeta">${esc(carpeta || "Sin carpeta")}</div>`;
      }
      const aire = C.p.vivo.escena === e.id;
      html += `<div class="cz-escena-item${e.id === C.editId ? " cz-editando" : ""}${aire ? " cz-al-aire" : ""}" data-escena="${e.id}" draggable="true">
        <div class="cz-mini" data-mini="${e.id}"></div>
        <div class="cz-escena-pie"><span class="cz-escena-n">${i + 1}</span><span class="cz-escena-nom">${esc(e.nombre)}</span>${aire ? `<b class="cz-chip-aire">AL AIRE</b>` : `<button class="cz-mini-aire" data-aire="${e.id}" title="Poner al aire">▶</button>`}</div>
      </div>`;
      usadas.add(e.id);
    });
    // Las miniaturas se conservan entre repintados para no rehacer las imágenes
    const guardadas = new Map();
    lista.querySelectorAll("[data-mini]").forEach(n => { if (n.firstChild) guardadas.set(n.dataset.mini, n.firstChild); });
    lista.innerHTML = html;
    lista.querySelectorAll("[data-mini]").forEach(n => {
      const id = n.dataset.mini;
      let m = minis.get(id);
      if (m && guardadas.has(id)) n.appendChild(guardadas.get(id));
      else {
        if (m) m.destruir();
        m = new CZ.Escenario(n, { modo: "mini" });
        minis.set(id, m);
      }
      m.cont = n;
      m.ro.disconnect(); m.ro.observe(n); m.ajustar();
      m.mostrar(C.p, id, 0);
    });
    minis.forEach((m, id) => { if (!usadas.has(id)) { m.destruir(); minis.delete(id); } });
  }

  let tMini = null;
  function refrescarMini(id) {
    clearTimeout(tMini);
    tMini = setTimeout(() => { const m = minis.get(id || C.editId); if (m) m.mostrar(C.p, id || C.editId, 0); }, 200);
  }

  /* --- editor --- */
  function pintarEditor() {
    const e = escenaEdit();
    if (!e) return;
    const maxPaso = e.pasos.length;
    if (C.vistaPaso > maxPaso) C.vistaPaso = maxPaso;
    edEsc.mostrar(C.p, e.id, C.vistaPaso);
    $("#czVerPaso").max = maxPaso;
    $("#czVerPaso").value = C.vistaPaso;
    $("#czVerPasoTxt").textContent = C.vistaPaso === 0 ? "Inicio" : "Paso " + C.vistaPaso;
    $("#czEditorTitulo").textContent = e.nombre;
    pintarSeleccion();
    refrescarMini(e.id);
    if (e.id === C.p.vivo.escena && monEsc) pintarAire();
  }

  let capaSel = null;
  function pintarSeleccion(guias) {
    if (!capaSel || !capaSel.isConnected) {
      capaSel = document.createElement("div");
      capaSel.className = "cz-selcapa";
      edEsc.lienzo.appendChild(capaSel);
    }
    const e = escenaEdit();
    let html = "";
    // Números de paso sobre los elementos que tienen pasos
    const marcas = new Map();
    e.pasos.forEach((p, i) => { if (p.objetivo) { const l = marcas.get(p.objetivo) || []; l.push(i + 1); marcas.set(p.objetivo, l); } });
    marcas.forEach((nums, id) => {
      const el = e.elementos.find(x => x.id === id);
      if (el) html += `<div class="cz-marca-paso" style="left:${el.x}px;top:${el.y}px">${nums.join(" · ")}</div>`;
    });
    seleccion().forEach(el => {
      const solo = C.sel.length === 1 && !el.bloqueado;
      html += `<div class="cz-selcaja${el.bloqueado ? " cz-sel-bloq" : ""}" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;transform:rotate(${el.rot || 0}deg)">
        ${solo ? ["n", "ne", "e", "se", "s", "sw", "w", "nw"].map(h => `<i class="cz-h cz-h-${h}" data-h="${h}"></i>`).join("") + `<i class="cz-h cz-h-rot" data-h="rot"></i>` : ""}
        ${el.bloqueado ? `<span class="cz-candado">bloqueado</span>` : ""}
      </div>`;
    });
    (guias || []).forEach(g => {
      html += g.eje === "x" ? `<div class="cz-guia cz-guia-v" style="left:${g.v}px"></div>` : `<div class="cz-guia cz-guia-h" style="top:${g.v}px"></div>`;
    });
    if (marquesina) {
      const r = rectMarq();
      html += `<div class="cz-marquesina" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>`;
    }
    capaSel.innerHTML = html;
  }

  /* --- al aire --- */
  function pintarAire() {
    const v = C.p.vivo, e = CZ.escena(C.p, v.escena);
    monEsc.mostrar(C.p, v.escena, v.paso, { transicion: true });
    $("#czAireNombre").textContent = e ? e.nombre : "Nada al aire";
    const total = e ? e.pasos.length : 0;
    $("#czAirePaso").textContent = total ? `Paso ${v.paso} de ${total}` : "Sin pasos";
    $("#czPasoAnt").disabled = !e || v.paso <= 0;
    $("#czPasoSig").disabled = !e || v.paso >= total;
    $("#czEnviarAire").disabled = C.editId === v.escena;
    const sig = e && e.pasos[v.paso];
    $("#czAireSiguiente").textContent = sig ? "Siguiente: " + describirPaso(e, sig) : "";
  }

  /* --- panel lateral: propiedades o jugadores --- */
  function pintarLado() {
    document.querySelectorAll("[data-pestana]").forEach(b => b.classList.toggle("activa", b.dataset.pestana === C.pestana));
    $("#czProps").hidden = C.pestana !== "props";
    $("#czJug").hidden = C.pestana !== "jugadores";
    if (C.pestana === "props") pintarProps(); else pintarJugadores();
  }

  /* ---------------------------------------------------------------- panel de propiedades */

  function opcionesEscenas(actual, vacia) {
    return `<option value="">${esc(vacia || "Ninguna")}</option>` + C.p.escenas.map(e => `<option value="${e.id}"${e.id === actual ? " selected" : ""}>${esc(e.nombre)}</option>`).join("");
  }

  function campoColor(nombre, valor, temaPaleta) {
    const pal = (CZ.TEMAS[temaPaleta] || CZ.TEMAS.madera).paleta;
    return `<div class="cz-colores" data-color="${nombre}">
      <button type="button" class="cz-sw cz-sw-tema${!valor ? " activo" : ""}" data-v="" title="El del tema">tema</button>
      ${pal.map(c => `<button type="button" class="cz-sw${valor === c ? " activo" : ""}" data-v="${c}" style="--sw:${c}" title="${c}"></button>`).join("")}
      <label class="cz-sw cz-sw-libre" title="Otro color" style="--sw:${valor || "#ffffff"}"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(valor || "") ? valor : "#ffffff"}"></label>
    </div>`;
  }

  function campoHtml(c, valor, tema) {
    const id = "f_" + c.k;
    switch (c.t) {
      case "area": return `<label class="cz-campo"><span>${esc(c.l)}</span><textarea data-k="${c.k}" rows="3">${esc(valor)}</textarea></label>`;
      case "linea": return `<label class="cz-campo"><span>${esc(c.l)}</span><input data-k="${c.k}" value="${esc(valor)}"></label>`;
      case "rango": return `<label class="cz-campo cz-campo-rango"><span>${esc(c.l)} <b>${esc(valor)}</b></span><input type="range" data-k="${c.k}" data-num="1" min="${c.min}" max="${c.max}" step="${c.paso || 1}" value="${esc(valor)}"></label>`;
      case "casilla": return `<label class="cz-casilla"><input type="checkbox" data-k="${c.k}"${valor ? " checked" : ""}><i></i><span>${esc(c.l)}</span></label>`;
      case "elegir": {
        const ops = Object.entries(c.ops);
        return `<div class="cz-campo"><span>${esc(c.l)}</span><div class="cz-segmento" data-elegir="${c.k}">${ops.map(([k, t]) => `<button type="button" data-v="${k}" class="${String(valor) === k ? "activo" : ""}">${esc(t)}</button>`).join("")}</div></div>`;
      }
      case "color": return `<div class="cz-campo"><span>${esc(c.l)}</span>${campoColor(c.k, valor, tema)}</div>`;
      case "imagen": return `<div class="cz-campo"><span>${esc(c.l)}</span>
        <div class="cz-imagen-campo"><div class="cz-imagen-prev" data-prev="${esc(valor || "")}"></div>
        <div><input data-k="${c.k}" placeholder="Pega una URL" value="${esc(valor && !valor.startsWith("idb:") ? valor : "")}">
        <button type="button" class="cz-btn-mini" data-archivo="${c.k}">Archivo del equipo</button>${valor ? ` <button type="button" class="cz-btn-mini" data-quitar="${c.k}">Quitar</button>` : ""}</div></div></div>`;
      case "jugador": return `<label class="cz-campo"><span>${esc(c.l)}</span><select data-k="${c.k}"><option value="">Elige</option>${C.p.jugadores.map(j => `<option value="${j.id}"${j.id === valor ? " selected" : ""}>${esc(j.nombre)}</option>`).join("")}</select></label>`;
      case "lista": case "listaImagenes": return `<label class="cz-campo"><span>${esc(c.l)}</span><textarea data-k="${c.k}" data-lista="1" rows="4">${esc((valor || []).join("\n"))}</textarea></label>`;
      case "enlacesMatriz": return "";
      default: return "";
    }
  }

  function pintarProps() {
    const cont = $("#czProps");
    const sel = seleccion();
    const e = escenaEdit();
    if (!e) { cont.innerHTML = ""; return; }
    const tema = e.tema || C.p.tema;
    if (!sel.length) {
      const f = e.fondo || { tipo: "tema" };
      cont.innerHTML = `
        <h3 class="cz-lado-tit">Escena</h3>
        <label class="cz-campo"><span>Nombre</span><input data-esc="nombre" value="${esc(e.nombre)}"></label>
        <label class="cz-campo"><span>Carpeta</span><input data-esc="carpeta" value="${esc(e.carpeta)}" placeholder="Por ejemplo: Preguntas"></label>
        <div class="cz-campo"><span>Tema</span><div class="cz-segmento" data-esc-elegir="tema"><button type="button" data-v="" class="${!e.tema ? "activo" : ""}">El de la partida</button>${Object.entries(CZ.TEMAS).map(([k, t]) => `<button type="button" data-v="${k}" class="${e.tema === k ? "activo" : ""}">${esc(t.nombre)}</button>`).join("")}</div></div>
        <div class="cz-campo"><span>Fondo</span><div class="cz-segmento" data-esc-fondo="tipo">${[["tema", "Del tema"], ["color", "Color"], ["patron", "Patrón"], ["imagen", "Imagen"]].map(([k, t]) => `<button type="button" data-v="${k}" class="${f.tipo === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
        ${f.tipo === "color" ? `<div class="cz-campo">${campoColor("fondoColor", f.valor, tema)}</div>` : ""}
        ${f.tipo === "patron" ? `<div class="cz-campo"><div class="cz-segmento cz-seg-col" data-esc-fondo="valor">${Object.entries(CZ.PATRONES).map(([k, t]) => `<button type="button" data-v="${k}" class="${f.valor === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>` : ""}
        ${f.tipo === "imagen" ? `<div class="cz-campo"><div class="cz-imagen-campo"><div class="cz-imagen-prev" data-prev="${esc(f.valor || "")}"></div><div><input data-fondo-url placeholder="Pega una URL" value="${esc(f.valor && !f.valor.startsWith("idb:") ? f.valor : "")}"><button type="button" class="cz-btn-mini" data-archivo="__fondo">Archivo del equipo</button></div></div></div>` : ""}
        <div class="cz-campo"><span>Transición al entrar</span><div class="cz-segmento" data-esc-elegir="transicion">${Object.entries(CZ.TRANSICIONES).map(([k, t]) => `<button type="button" data-v="${k}" class="${(e.transicion || "barrido") === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
        <div class="cz-acciones">
          <button type="button" class="cz-btn" data-accion="aire">Poner al aire</button>
          <button type="button" class="cz-btn" data-accion="dupEscena">Duplicar escena</button>
          <button type="button" class="cz-btn cz-peligro" data-accion="borrarEscena">Borrar escena</button>
        </div>
        <p class="cz-ayuda">Haz clic en un elemento para editarlo. Arrastra en vacío para seleccionar varios. Doble clic en un texto para escribir.</p>`;
    } else if (sel.length > 1) {
      cont.innerHTML = `
        <h3 class="cz-lado-tit">${sel.length} elementos</h3>
        <div class="cz-campo"><span>Alinear</span><div class="cz-segmento cz-iconos" data-alinear>
          <button type="button" data-v="izq" title="A la izquierda">⇤</button><button type="button" data-v="cx" title="Centrar en horizontal">↔</button><button type="button" data-v="der" title="A la derecha">⇥</button>
          <button type="button" data-v="arr" title="Arriba">⤒</button><button type="button" data-v="cy" title="Centrar en vertical">↕</button><button type="button" data-v="aba" title="Abajo">⤓</button>
        </div></div>
        <div class="cz-campo"><span>Repartir</span><div class="cz-segmento" data-repartir><button type="button" data-v="x">En horizontal</button><button type="button" data-v="y">En vertical</button></div></div>
        <div class="cz-campo"><span>Animación de entrada</span><div class="cz-segmento cz-seg-col" data-comun-elegir="entrada">${Object.entries(CZ.ENTRADAS).map(([k, t]) => `<button type="button" data-v="${k}">${t}</button>`).join("")}</div></div>
        <div class="cz-acciones">
          <button type="button" class="cz-btn" data-accion="duplicar">Duplicar</button>
          <button type="button" class="cz-btn" data-accion="frente">Al frente</button>
          <button type="button" class="cz-btn" data-accion="fondo">Al fondo</button>
          <button type="button" class="cz-btn" data-accion="bloquear">Bloquear o desbloquear</button>
          <button type="button" class="cz-btn cz-peligro" data-accion="borrar">Borrar</button>
        </div>`;
    } else {
      const el = sel[0], comp = CZ.COMPONENTES[el.tipo];
      cont.innerHTML = `
        <h3 class="cz-lado-tit"><small>${esc(comp.nombre)}</small><input class="cz-nombre-el" data-el="nombre" value="${esc(el.nombre || comp.nombre)}" title="Nombre (sirve para reconocerlo en los pasos)"></h3>
        <div class="cz-geo">
          ${[["x", "X"], ["y", "Y"], ["w", "Ancho"], ["h", "Alto"], ["rot", "Giro"]].map(([k, t]) => `<label><span>${t}</span><input type="number" data-geo="${k}" value="${Math.round(el[k] || 0)}"></label>`).join("")}
        </div>
        ${comp.campos.map(c => campoHtml(c, el.props[c.k], tema)).join("")}
        ${el.tipo === "matriz" ? enlacesMatrizHtml(el) : ""}
        <hr class="cz-sep">
        <label class="cz-campo"><span>Al pulsarlo al aire, ir a</span><select data-el="enlace">${opcionesEscenas(el.enlace, "No lleva a ninguna escena")}</select></label>
        <div class="cz-campo"><span>Animación de entrada</span><div class="cz-segmento cz-seg-col" data-el-elegir="entrada">${Object.entries(CZ.ENTRADAS).map(([k, t]) => `<button type="button" data-v="${k}" class="${(el.entrada || "aparecer") === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
        <label class="cz-campo cz-campo-rango"><span>Opacidad <b>${Math.round((el.opacidad == null ? 1 : el.opacidad) * 100)}%</b></span><input type="range" data-el="opacidad" min="0" max="1" step="0.05" value="${el.opacidad == null ? 1 : el.opacidad}"></label>
        <label class="cz-casilla"><input type="checkbox" data-el="oculto"${el.oculto ? " checked" : ""}><i></i><span>Empieza oculto (lo muestra un paso)</span></label>
        <label class="cz-casilla"><input type="checkbox" data-el="bloqueado"${el.bloqueado ? " checked" : ""}><i></i><span>Bloqueado</span></label>
        <div class="cz-acciones">
          <button type="button" class="cz-btn cz-btn-fuerte" data-accion="pasoCon">Añadir un paso con este elemento</button>
          <button type="button" class="cz-btn" data-accion="duplicar">Duplicar</button>
          <button type="button" class="cz-btn" data-accion="frente">Al frente</button>
          <button type="button" class="cz-btn" data-accion="fondo">Al fondo</button>
          <button type="button" class="cz-btn cz-peligro" data-accion="borrar">Borrar</button>
        </div>`;
    }
    cont.querySelectorAll("[data-prev]").forEach(n => { if (n.dataset.prev) CZ.ponerImagen(n, n.dataset.prev, true); });
  }

  function enlacesMatrizHtml(el) {
    const p = el.props, cats = p.categorias || [], vals = p.valores || [];
    return `<div class="cz-campo"><span>Celda → escena a la que lleva</span>
      <div class="cz-enl-tabla" style="grid-template-columns: 7em repeat(${vals.length}, 1fr)">
        <i></i>${vals.map(v => `<b>${esc(v)}</b>`).join("")}
        ${cats.map((cat, r) => `<em title="${esc(cat)}">${esc(cat)}</em>` + vals.map((v, c) => `<select data-enlace-celda="${r},${c}" class="${p.enlaces && p.enlaces[r + "," + c] ? "con" : ""}">${opcionesEscenas(p.enlaces && p.enlaces[r + "," + c], "—")}</select>`).join("")).join("")}
      </div>
      <button type="button" class="cz-btn-mini" data-accion="crearPreguntas">Crear una escena de pregunta por cada celda vacía</button>
    </div>`;
  }

  function conectarProps() {
    const cont = $("#czProps");
    // Cambios en vivo mientras se escribe o se arrastra un control: sin historial por cada tecla, uno al empezar
    let fotoCampo = null;
    cont.addEventListener("focusin", () => { fotoCampo = instantanea(); });
    cont.addEventListener("pointerdown", () => { fotoCampo = instantanea(); });
    const conFoto = fn => {
      if (fotoCampo) { apuntar(fotoCampo); fotoCampo = null; }
      fn(); guardar(); pintarEditor(); pintarAire(); pintarPasosSiHace(); enviar();
    };

    cont.addEventListener("input", ev => {
      const t = ev.target, el = seleccion()[0], e = escenaEdit();
      if (t.dataset.k && el) {
        let v = t.type === "checkbox" ? t.checked : t.value;
        if (t.dataset.num) v = Number(v);
        if (t.dataset.lista) {
          v = t.value.split("\n").map(s => s.trim()).filter((s, i, a) => s || i < a.length - 1);
          if (t.dataset.k === "valores" && el.tipo === "matriz") v = v.filter(Boolean).map(x => (isNaN(Number(x)) ? x : Number(x)));
          else v = v.filter(Boolean);
        }
        conFoto(() => { el.props[t.dataset.k] = v; });
        if (t.type === "range") { const b = t.closest("label").querySelector("b"); if (b) b.textContent = v; }
        if (t.dataset.lista && el.tipo === "matriz") debounce("matriz", () => pintarProps(), 600);
      } else if (t.dataset.geo && el) {
        conFoto(() => { el[t.dataset.geo] = Number(t.value) || 0; });
      } else if (t.dataset.el === "opacidad" && el) {
        conFoto(() => { el.opacidad = Number(t.value); });
        t.closest("label").querySelector("b").textContent = Math.round(Number(t.value) * 100) + "%";
      } else if (t.dataset.el === "nombre" && el) {
        conFoto(() => { el.nombre = t.value; });
      } else if (t.dataset.esc && e) {
        conFoto(() => { e[t.dataset.esc] = t.value; });
        debounce("escenas", () => pintar("escenas"), 500);
      } else if (t.dataset.fondoUrl !== undefined && e) {
        conFoto(() => { e.fondo = { tipo: "imagen", valor: t.value.trim() }; });
      } else if (t.type === "color" && t.closest("[data-color]")) {
        aplicarColor(t.closest("[data-color]").dataset.color, t.value, true);
      }
    });

    cont.addEventListener("change", ev => {
      const t = ev.target, el = seleccion()[0];
      if (t.dataset.el === "oculto" && el) cambio(() => { el.oculto = t.checked; }, { partes: "editor" });
      else if (t.dataset.el === "bloqueado" && el) cambio(() => { el.bloqueado = t.checked; }, { partes: "editor" });
      else if (t.dataset.el === "enlace" && el) cambio(() => { el.enlace = t.value; }, { partes: "editor" });
      else if (t.dataset.enlaceCelda && el) cambio(() => { el.props.enlaces = el.props.enlaces || {}; if (t.value) el.props.enlaces[t.dataset.enlaceCelda] = t.value; else delete el.props.enlaces[t.dataset.enlaceCelda]; }, { partes: "editor" });
      else if (t.dataset.k && t.closest(".cz-imagen-campo")) pintarProps();
      else if (t.dataset.esc) pintar("escenas");
    });

    cont.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      const el = seleccion()[0], e = escenaEdit();
      const seg = b.closest("[data-elegir],[data-el-elegir],[data-esc-elegir],[data-esc-fondo],[data-comun-elegir],[data-alinear],[data-repartir]");
      if (seg) {
        const v = b.dataset.v;
        if (seg.dataset.elegir && el) cambio(() => { el.props[seg.dataset.elegir] = v; }, { partes: "editor" });
        else if (seg.dataset.elElegir && el) { cambio(() => { el.entrada = v; }, { partes: "editor" }); previsualizarEntrada(el); }
        else if (seg.dataset.comunElegir) cambio(() => { seleccion().forEach(x => { x.entrada = v; }); }, { partes: "editor" });
        else if (seg.dataset.escElegir && e) cambio(() => { e[seg.dataset.escElegir] = v; }, { partes: "todo" });
        else if (seg.dataset.escFondo && e) cambio(() => {
          if (seg.dataset.escFondo === "tipo") e.fondo = { tipo: v, valor: v === "patron" ? "madera" : v === "color" ? "#3d8de0" : "" };
          else e.fondo.valor = v;
        }, { partes: "todo" });
        else if (seg.dataset.alinear !== undefined) alinear(v);
        else if (seg.dataset.repartir !== undefined) repartir(v);
        return;
      }
      if (b.closest("[data-color]")) { if (b.dataset.v !== undefined) aplicarColor(b.closest("[data-color]").dataset.color, b.dataset.v); return; }
      if (b.dataset.archivo) { elegirArchivo(b.dataset.archivo); return; }
      if (b.dataset.quitar && el) { cambio(() => { el.props[b.dataset.quitar] = ""; }, { partes: "editor" }); return; }
      if (b.dataset.accion) accion(b.dataset.accion);
    });
  }

  function pintarPasosSiHace() { debounce("pasos", pintarPasos, 300); }

  const tiempos = {};
  function debounce(k, fn, ms) { clearTimeout(tiempos[k]); tiempos[k] = setTimeout(fn, ms); }

  function aplicarColor(campo, valor, enVivo) {
    const e = escenaEdit(), el = seleccion()[0];
    const fn = () => {
      if (campo === "fondoColor" && e) e.fondo = { tipo: "color", valor };
      else if (el) el.props[campo] = valor;
    };
    if (enVivo) { fn(); guardar(); pintarEditor(); pintarAire(); enviar(); }
    else { cambio(fn, { partes: "editor" }); pintarProps(); }
  }

  function previsualizarEntrada(el) {
    const n = edEsc.nodoDe(el.id);
    if (!n || !el.entrada || el.entrada === "ninguna") return;
    n.classList.remove("cz-in-" + el.entrada);
    void n.offsetWidth;
    n.classList.add("cz-in-" + el.entrada);
    n.addEventListener("animationend", () => n.classList.remove("cz-in-" + el.entrada), { once: true });
  }

  /* ---------------------------------------------------------------- acciones */

  function accion(a) {
    const e = escenaEdit(), sel = seleccion();
    switch (a) {
      case "aire": alAire(C.editId); break;
      case "dupEscena": duplicarEscena(e); break;
      case "borrarEscena": borrarEscena(e); break;
      case "duplicar": duplicar(); break;
      case "borrar": borrarSel(); break;
      case "frente": cambio(() => { const ids = new Set(C.sel); const fuera = e.elementos.filter(x => !ids.has(x.id)); e.elementos = fuera.concat(e.elementos.filter(x => ids.has(x.id))); }, { partes: "editor" }); break;
      case "fondo": cambio(() => { const ids = new Set(C.sel); e.elementos = e.elementos.filter(x => ids.has(x.id)).concat(e.elementos.filter(x => !ids.has(x.id))); }, { partes: "editor" }); break;
      case "bloquear": cambio(() => { const b = !sel.every(x => x.bloqueado); sel.forEach(x => { x.bloqueado = b; }); }, { partes: "editor" }); break;
      case "pasoCon": nuevoPaso(sel[0]); break;
      case "crearPreguntas": crearPreguntas(sel[0]); break;
    }
  }

  function alAire(id) {
    if (!CZ.escena(C.p, id)) return;
    cambio(() => { C.p.vivo = { escena: id, paso: 0 }; }, { historial: false, partes: "aire" });
    pintar("escenas");
  }
  function pasoSiguiente() {
    const e = CZ.escena(C.p, C.p.vivo.escena);
    if (!e || C.p.vivo.paso >= e.pasos.length) return;
    cambio(() => { C.p.vivo.paso++; }, { historial: false, partes: "aire" });
    if (!CZ.silencio && $("#czSonidoCabina").checked) CZ.sonidosDePasos(e, C.p.vivo.paso - 1, C.p.vivo.paso);
  }
  function pasoAnterior() {
    if (C.p.vivo.paso <= 0) return;
    cambio(() => { C.p.vivo.paso--; }, { historial: false, partes: "aire" });
  }

  function clicAlAire(el, sub, ev) {
    const J = C.p.juego;
    // Marcadores y podio: clic sobre el número para escribir los puntos
    if (el.tipo === "marcador" || el.tipo === "podio") {
      const num = CZ.numeroDePuntos(el, ev.objetivo);
      const j = num && CZ.jugador(C.p, num.jugador);
      if (j && num.nodo) CZ.editarNumero(num.nodo, v => sumar(j, v - j.puntos));
      return;
    }
    if (ev.derecho) return;
    if (el.tipo === "rejilla" && sub != null) {
      const i = Number(sub);
      cambio(() => { const l = J.volteadas[el.id] = (J.volteadas[el.id] || []).slice(); const k = l.indexOf(i); if (k >= 0) l.splice(k, 1); else l.push(i); }, { partes: "aire", evento: "volteo" });
      return;
    }
    if (el.tipo === "matriz" && sub != null) {
      const clave = el.id + ":" + sub, destino = el.props.enlaces && el.props.enlaces[sub];
      if (J.usadas[clave] && ev.altKey) { cambio(() => { delete J.usadas[clave]; }, { partes: "aire" }); return; }
      if (!J.usadas[clave]) cambio(() => { J.usadas[clave] = C.jugSel || "x"; }, { partes: "aire" });
      if (destino) alAire(destino);
      return;
    }
    if (el.tipo === "carta") { cambio(() => { J.volteadas[el.id] = !J.volteadas[el.id]; }, { partes: "aire", evento: "volteo" }); return; }
    if (el.tipo === "temporizador") {
      // Clic: arranca o pausa. Alt+clic: vuelve al tiempo inicial. Si ya terminó, el clic lo reinicia y arranca.
      cambio(() => {
        const r = J.relojes[el.id], total = Number(el.props.segundos) || 30;
        if (ev.altKey) J.relojes[el.id] = { inicio: 0, restante: total };
        else if (r && r.inicio) J.relojes[el.id] = { inicio: 0, restante: CZ.restanteReloj(el, J) };
        else { const resto = r ? r.restante : total; J.relojes[el.id] = { inicio: Date.now(), restante: resto > 0 ? resto : total }; }
      }, { partes: "aire", historial: false });
      return;
    }
    if (el.enlace) alAire(el.enlace);
    else if (el.tipo === "boton") aviso("Este botón no lleva a ninguna escena. Elígela en Propiedades, en «Al pulsarlo al aire, ir a».", true);
  }

  /* ---------------------------------------------------------------- escenas */

  function nuevaEscena() {
    const e = CZ.nuevaEscena("Escena " + (C.p.escenas.length + 1));
    const actual = escenaEdit();
    if (actual) e.carpeta = actual.carpeta;
    cambio(() => {
      const i = C.p.escenas.findIndex(x => x.id === C.editId);
      C.p.escenas.splice(i + 1, 0, e);
      C.editId = e.id; C.sel = []; C.vistaPaso = 0;
    });
  }
  function duplicarEscena(e) {
    if (!e) return;
    const c = CZ.copia(e);
    c.id = CZ.uid();
    c.nombre = e.nombre + " (copia)";
    const mapa = {};
    c.elementos.forEach(x => { const n = CZ.uid(); mapa[x.id] = n; x.id = n; });
    c.pasos.forEach(p => { p.id = CZ.uid(); if (mapa[p.objetivo]) p.objetivo = mapa[p.objetivo]; });
    cambio(() => { C.p.escenas.splice(C.p.escenas.indexOf(e) + 1, 0, c); C.editId = c.id; C.sel = []; });
  }
  async function borrarEscena(e) {
    if (!e || C.p.escenas.length < 2) { aviso("Una partida necesita al menos una escena."); return; }
    if (!(await confirmar(`¿Borrar la escena «${e.nombre}»? Puedes deshacerlo con Ctrl+Z.`))) return;
    cambio(() => {
      const i = C.p.escenas.indexOf(e);
      C.p.escenas.splice(i, 1);
      C.p.escenas.forEach(x => x.elementos.forEach(el => { if (el.enlace === e.id) el.enlace = ""; if (el.props.enlaces) Object.keys(el.props.enlaces).forEach(k => { if (el.props.enlaces[k] === e.id) delete el.props.enlaces[k]; }); }));
      if (C.p.vivo.escena === e.id) C.p.vivo = { escena: C.p.escenas[0].id, paso: 0 };
      C.editId = (C.p.escenas[i] || C.p.escenas[i - 1]).id; C.sel = [];
    });
  }

  /* Una escena de pregunta por cada celda de la matriz que no lleva a ninguna parte. */
  function crearPreguntas(el) {
    if (!el || el.tipo !== "matriz") return;
    const menu = escenaEdit();
    const cats = el.props.categorias || [], vals = el.props.valores || [];
    let creadas = 0;
    cambio(() => {
      el.props.enlaces = el.props.enlaces || {};
      let pos = C.p.escenas.indexOf(menu) + 1;
      cats.forEach((cat, r) => vals.forEach((v, c) => {
        const k = r + "," + c;
        if (el.props.enlaces[k]) return;
        const e = CZ.nuevaEscena(`${cat} · ${v}`);
        e.carpeta = cat;
        const prueba = CZ.nuevoElemento("prueba", { nombre: "Imagen", x: 460, y: 200, w: 1000, h: 640 });
        e.elementos.push(
          CZ.nuevoElemento("texto", { nombre: "Categoría", x: 560, y: 30, w: 800, h: 90, props: { texto: cat, tam: 64, caja: true } }),
          CZ.nuevoElemento("texto", { nombre: "Puntos", x: 1540, y: 40, w: 340, h: 80, props: { texto: v + (v === 1 ? " punto" : " puntos"), tam: 48, fuente: "cuerpo", contorno: false } }),
          CZ.nuevoElemento("texto", { nombre: "Pregunta", x: 360, y: 120, w: 1200, h: 70, props: { texto: "Escribe la pregunta", tam: 44, fuente: "cuerpo", contorno: false } }),
          prueba,
          CZ.nuevoElemento("boton", { nombre: "menu", x: 140, y: 900, w: 380, h: 110, enlace: menu.id, props: { texto: "menu" } })
        );
        e.pasos.push({ id: CZ.uid(), accion: "revelar", objetivo: prueba.id });
        C.p.escenas.splice(pos++, 0, e);
        el.props.enlaces[k] = e.id;
        creadas++;
      }));
    });
    aviso(creadas ? `Se crearon ${creadas} escenas de pregunta, enlazadas a sus celdas.` : "Todas las celdas ya llevan a alguna escena.");
  }

  /* ---------------------------------------------------------------- elementos */

  function anadir(tipo, extra) {
    const e = escenaEdit();
    if (!e) return null;
    const el = CZ.nuevoElemento(tipo, extra);
    if (tipo === "marcador" && !el.props.jugadorId) {
      const usados = new Set(e.elementos.filter(x => x.tipo === "marcador").map(x => x.props.jugadorId));
      const j = C.p.jugadores.find(x => !usados.has(x.id)) || C.p.jugadores[0];
      if (j) el.props.jugadorId = j.id;
    }
    // Si ya hay algo justo en el centro, se desplaza un poco para que se vea que es nuevo
    while (e.elementos.some(x => x.x === el.x && x.y === el.y)) { el.x += 30; el.y += 30; }
    cambio(() => { e.elementos.push(el); C.sel = [el.id]; C.pestana = "props"; });
    return el;
  }

  const PREAJUSTES = {
    texto: () => anadir("texto"),
    titulo: () => anadir("texto", { nombre: "Título", w: 1400, h: 200, props: { texto: "Título", tam: 140 } }),
    pestana: () => anadir("texto", { nombre: "Pestaña", w: 700, h: 100, props: { texto: "Categoría", tam: 60, caja: true } }),
    rect: () => anadir("forma"),
    circulo: () => anadir("forma", { w: 300, h: 300, props: { forma: "circulo" } }),
    anillo: () => anadir("forma", { nombre: "Círculo rojo", w: 260, h: 260, oculto: true, entrada: "sello", props: { forma: "anillo", borde: "#e03131", grosor: 14 } }),
    linea: () => anadir("forma", { w: 600, h: 20, props: { forma: "linea", grosor: 10 } }),
    boton: () => anadir("boton"),
    marcador: () => anadir("marcador"),
    podio: () => anadir("podio"),
    carta: () => anadir("carta"),
    suerte: () => anadir("rejilla", { nombre: "Cartas de riesgo", props: { cols: 6, filas: 3, estilo: "suerte", letras: true, valores: Array.from({ length: 18 }, (_, i) => (i === 5 ? "-5 puntos" : "+1 punto")) } }),
    feud: () => anadir("rejilla", { nombre: "Respuestas ocultas", w: 1300, h: 640, props: { cols: 2, filas: 4, estilo: "feud", letras: false, valores: ["Respuesta 1", "Respuesta 2", "Respuesta 3", "Respuesta 4", "Respuesta 5", "Respuesta 6", "Respuesta 7", "Respuesta 8"] } }),
    fichas: () => anadir("rejilla", { nombre: "Fichas", w: 900, h: 600, props: { cols: 3, filas: 3, estilo: "madera", letras: true, valores: Array(9).fill("") } }),
    matriz: () => anadir("matriz", { w: 1500, h: 820, props: { categorias: ["Recortes", "Siluetas", "Dibujos rápidos", "¿Cuál es el falso?", "¿Existe?"], valores: [1, 1, 2, 2, 3] } }),
    prueba: () => anadir("prueba"),
    silueta: () => anadir("prueba", { nombre: "Silueta", props: { modo: "silueta" } }),
    reloj: () => anadir("temporizador")
  };

  function duplicar() {
    const e = escenaEdit(), sel = seleccion();
    if (!sel.length) return;
    cambio(() => {
      const nuevos = sel.map(x => { const c = CZ.copia(x); c.id = CZ.uid(); c.x += 30; c.y += 30; return c; });
      e.elementos.push(...nuevos);
      C.sel = nuevos.map(x => x.id);
    }, { partes: "editor" });
  }
  function borrarSel() {
    const e = escenaEdit(), ids = new Set(C.sel);
    if (!ids.size) return;
    cambio(() => {
      e.elementos = e.elementos.filter(x => !ids.has(x.id));
      e.pasos = e.pasos.filter(p => !ids.has(p.objetivo));
      C.sel = [];
    }, { partes: "editor" });
  }
  function alinear(modo) {
    const sel = seleccion();
    if (sel.length < 2) return;
    const L = Math.min(...sel.map(x => x.x)), R = Math.max(...sel.map(x => x.x + x.w));
    const T = Math.min(...sel.map(x => x.y)), B = Math.max(...sel.map(x => x.y + x.h));
    cambio(() => sel.forEach(x => {
      if (modo === "izq") x.x = L; if (modo === "der") x.x = R - x.w; if (modo === "cx") x.x = Math.round((L + R - x.w) / 2);
      if (modo === "arr") x.y = T; if (modo === "aba") x.y = B - x.h; if (modo === "cy") x.y = Math.round((T + B - x.h) / 2);
    }), { partes: "editor" });
  }
  function repartir(eje) {
    const sel = seleccion().slice().sort((a, b) => (eje === "x" ? a.x - b.x : a.y - b.y));
    if (sel.length < 3) return;
    const k = eje === "x" ? "x" : "y", d = eje === "x" ? "w" : "h";
    const ini = sel[0][k], fin = sel[sel.length - 1][k] + sel[sel.length - 1][d];
    const total = sel.reduce((s, x) => s + x[d], 0), hueco = (fin - ini - total) / (sel.length - 1);
    cambio(() => { let pos = ini; sel.forEach(x => { x[k] = Math.round(pos); pos += x[d] + hueco; }); }, { partes: "editor" });
  }

  /* ---------------------------------------------------------------- pasos */

  function describirPaso(e, p) {
    if (p.accion === "sonido") return "Sonido: " + (CZ.SONIDOS[p.sonido] || p.sonido || "");
    const el = e.elementos.find(x => x.id === p.objetivo);
    return (CZ.ACCIONES[p.accion] || p.accion) + " " + (el ? (el.nombre || CZ.COMPONENTES[el.tipo].nombre) : "(elemento borrado)") + (p.celda != null && p.celda !== "" ? " · carta " + (Number(p.celda) + 1) : "");
  }

  function accionPorDefecto(el) {
    if (!el) return "sonido";
    if (el.tipo === "prueba") return "revelar";
    if (el.tipo === "carta" || el.tipo === "rejilla") return "voltear";
    return el.oculto ? "mostrar" : "ocultar";
  }

  function nuevoPaso(el) {
    const e = escenaEdit();
    const p = { id: CZ.uid(), accion: accionPorDefecto(el), objetivo: el ? el.id : "" };
    if (p.accion === "sonido") p.sonido = "ding";
    if (el && el.tipo === "rejilla") p.celda = 0;
    cambio(() => { e.pasos.push(p); C.vistaPaso = e.pasos.length; }, { partes: "editor" });
  }

  function pintarPasos() {
    const e = escenaEdit(), cont = $("#czPasosLista");
    if (!e) return;
    if (!e.pasos.length) {
      cont.innerHTML = `<p class="cz-vacio-txt">Sin pasos. Un paso muestra, oculta, revela o voltea algo al pulsar Espacio con la escena al aire. Selecciona un elemento y pulsa «Añadir paso».</p>`;
      return;
    }
    const opsEl = sel => e.elementos.map(x => `<option value="${x.id}"${x.id === sel ? " selected" : ""}>${esc(x.nombre || CZ.COMPONENTES[x.tipo].nombre)}</option>`).join("");
    cont.innerHTML = e.pasos.map((p, i) => {
      const el = e.elementos.find(x => x.id === p.objetivo);
      return `<div class="cz-paso${C.vistaPaso === i + 1 ? " cz-paso-visto" : ""}" data-paso="${p.id}">
        <button type="button" class="cz-paso-n" data-ver="${i + 1}" title="Ver la escena en este paso">${i + 1}</button>
        <select data-p="accion">${Object.entries(CZ.ACCIONES).map(([k, t]) => `<option value="${k}"${p.accion === k ? " selected" : ""}>${t}</option>`).join("")}</select>
        ${p.accion === "sonido"
          ? `<select data-p="sonido">${Object.entries(CZ.SONIDOS).map(([k, t]) => `<option value="${k}"${p.sonido === k ? " selected" : ""}>${t}</option>`).join("")}</select><button type="button" class="cz-btn-mini" data-probar="${esc(p.sonido || "ding")}">Escuchar</button>`
          : `<select data-p="objetivo"><option value="">Elige un elemento</option>${opsEl(p.objetivo)}</select>`}
        ${p.accion === "voltear" && el && el.tipo === "rejilla" ? `<label class="cz-paso-celda">carta <input type="number" min="1" data-p="celda" value="${Number(p.celda || 0) + 1}"></label>` : ""}
        <span class="cz-paso-mov"><button type="button" data-mover="-1" title="Subir">↑</button><button type="button" data-mover="1" title="Bajar">↓</button><button type="button" data-quitar-paso title="Quitar">×</button></span>
      </div>`;
    }).join("");
  }

  function conectarPasos() {
    const cont = $("#czPasosLista");
    cont.addEventListener("change", ev => {
      const t = ev.target, fila = t.closest("[data-paso]"), e = escenaEdit();
      if (!fila) return;
      const p = e.pasos.find(x => x.id === fila.dataset.paso);
      cambio(() => {
        if (t.dataset.p === "celda") p.celda = Math.max(0, Number(t.value) - 1);
        else p[t.dataset.p] = t.value;
        if (p.accion === "sonido" && !p.sonido) p.sonido = "ding";
      }, { partes: "editor" });
    });
    cont.addEventListener("click", ev => {
      const b = ev.target.closest("button"), fila = ev.target.closest("[data-paso]"), e = escenaEdit();
      if (!b || !fila) return;
      const i = e.pasos.findIndex(x => x.id === fila.dataset.paso);
      if (b.dataset.ver) { C.vistaPaso = C.vistaPaso === Number(b.dataset.ver) ? 0 : Number(b.dataset.ver); pintar("editor"); return; }
      if (b.dataset.probar) { CZ.sonar(b.dataset.probar); return; }
      if (b.dataset.mover) {
        const j = i + Number(b.dataset.mover);
        if (j < 0 || j >= e.pasos.length) return;
        cambio(() => { const [x] = e.pasos.splice(i, 1); e.pasos.splice(j, 0, x); }, { partes: "editor" });
      }
      if (b.dataset.quitarPaso !== undefined) cambio(() => { e.pasos.splice(i, 1); }, { partes: "editor" });
    });
    $("#czPasoNuevo").addEventListener("click", () => nuevoPaso(seleccion()[0]));
    $("#czPasoSonido").addEventListener("click", () => nuevoPaso(null));
  }

  /* ---------------------------------------------------------------- jugadores */

  function pintarJugadores() {
    const cont = $("#czJug");
    const ranking = CZ.ranking(C.p);
    cont.innerHTML = `
      <div class="cz-jug-cab"><h3 class="cz-lado-tit">Jugadores</h3><button type="button" class="cz-btn-mini" data-j-accion="nuevo">Añadir jugador</button></div>
      <p class="cz-ayuda">Teclas 1 a ${Math.min(9, C.p.jugadores.length)} para elegir, + y − para sumar o restar 1, * y _ para 5. También puedes escribir los puntos en su casilla o hacer clic en el número de un marcador o del podio al aire. Lo que ganas en la matriz se marca con el jugador elegido.</p>
      <div class="cz-jug-lista">${C.p.jugadores.map((j, i) => {
        const pos = ranking.indexOf(j) + 1;
        return `<div class="cz-jug${C.jugSel === j.id ? " cz-jug-sel" : ""}" data-jug="${j.id}" style="--cz-jc:${esc(j.color)}">
          <div class="cz-jug-fila">
            <span class="cz-jug-tecla">${i + 1}</span>
            <span class="cz-jug-av"></span>
            <span class="cz-jug-nom">${esc(j.nombre)}<small>${pos}.º${j.estados.length ? " · " + j.estados.map(s => esc(s.texto)).join(", ") : ""}</small></span>
            <input type="number" class="cz-jug-pts" data-pts value="${j.puntos}" title="Escribe los puntos y pulsa Enter">
          </div>
          <div class="cz-jug-botones">
            ${[-5, -1, 1, 5].map(d => `<button type="button" data-delta="${d}" class="${d > 0 ? "mas" : "menos"}">${d > 0 ? "+" + d : "−" + Math.abs(d)}</button>`).join("")}
            <button type="button" data-abrir title="Datos, estados, cartas y enlace">${C.abierto === j.id ? "Cerrar" : "Datos"}</button>
          </div>
          ${C.abierto === j.id ? fichaJugador(j) : ""}
        </div>`;
      }).join("")}</div>
      <h3 class="cz-lado-tit cz-mt">Registro</h3>
      <ol class="cz-registro">${C.p.registro.slice(-12).reverse().map(r => `<li><b>${esc(r.nombre)}</b> ${r.delta > 0 ? "+" : "−"}${Math.abs(r.delta)} <span>→ ${r.total}</span> <time>${new Date(r.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</time></li>`).join("") || "<li class=\"cz-vacio-txt\">Aún no hay movimientos.</li>"}</ol>`;
    cont.querySelectorAll("[data-jug]").forEach(n => {
      const j = CZ.jugador(C.p, n.dataset.jug);
      n.querySelector(".cz-jug-av").appendChild(CZ.avatar(j));
      n.querySelectorAll("[data-prev]").forEach(x => { if (x.dataset.prev) CZ.ponerImagen(x, x.dataset.prev, true); });
    });
  }

  function fichaJugador(j) {
    return `<div class="cz-jug-ficha">
      <label class="cz-campo"><span>Nombre</span><input data-jf="nombre" value="${esc(j.nombre)}"></label>
      <div class="cz-campo"><span>Avatar</span><div class="cz-imagen-campo"><div class="cz-imagen-prev" data-prev="${esc(j.avatar || "")}"></div><div>
        <input data-jf="avatar" placeholder="Pega una URL" value="${esc(j.avatar && !j.avatar.startsWith("idb:") ? j.avatar : "")}">
        <button type="button" class="cz-btn-mini" data-j-accion="avatarArchivo">Archivo del equipo</button>
        ${j.avatar && j.avatar.startsWith("idb:") ? `<small class="cz-nota">Esta imagen solo existe en este equipo. Para que el jugador la vea en su enlace, usa una URL.</small>` : ""}
      </div></div></div>
      <div class="cz-campo"><span>Color</span><div class="cz-colores" data-jcolor>${CZ.COLORES_JUGADOR.map(c => `<button type="button" class="cz-sw${j.color === c ? " activo" : ""}" data-v="${c}" style="--sw:${c}"></button>`).join("")}</div></div>
      <div class="cz-campo"><span>Estados</span>
        <div class="cz-estados-ed">${j.estados.map((s, i) => `<span class="cz-estado" style="--cz-ec:${esc(s.color)}">${esc(s.texto)}${s.turnos ? ` <b>${s.turnos}</b>` : ""}
          ${s.turnos ? `<button type="button" data-est-menos="${i}" title="Un turno menos">−</button>` : ""}<button type="button" data-est-quitar="${i}" title="Quitar">×</button></span>`).join("") || `<small class="cz-nota">Ninguno.</small>`}</div>
        <div class="cz-fila-mini"><input data-nuevo-estado placeholder="Quemado, escudo, maldición..."><input type="number" data-nuevo-turnos min="0" placeholder="Turnos" title="Turnos (opcional)"><button type="button" class="cz-btn-mini" data-j-accion="estado">Poner</button></div>
      </div>
      <div class="cz-campo"><span>Cartas y objetos</span>
        ${j.inventario.map((c, i) => `<div class="cz-inv-item" style="--cz-cc:${esc(c.color || "#e8453c")}"><b>${esc(c.nombre)}</b>${c.etiqueta ? ` <i>${esc(c.etiqueta)}</i>` : ""}<p>${esc(c.texto || "")}</p><button type="button" data-inv-quitar="${i}" title="Quitar">×</button></div>`).join("") || `<small class="cz-nota">Ninguno.</small>`}
        <div class="cz-inv-nuevo"><input data-inv="nombre" placeholder="Nombre"><input data-inv="etiqueta" placeholder="Etiqueta (opcional)"><textarea data-inv="texto" rows="2" placeholder="Qué hace"></textarea>
        <button type="button" class="cz-btn-mini" data-j-accion="inv">Dar al jugador</button>${seleccion()[0] && seleccion()[0].tipo === "carta" ? `<button type="button" class="cz-btn-mini" data-j-accion="invCarta">Dar la carta seleccionada</button>` : ""}</div>
      </div>
      <label class="cz-campo"><span>Consigna privada (solo la ve este jugador)</span><textarea data-jf="privado" rows="2" placeholder="Por ejemplo, la pregunta del impostor">${esc(j.privado)}</textarea></label>
      <label class="cz-campo"><span>Notas tuyas (nadie más las ve)</span><textarea data-jf="notas" rows="2">${esc(j.notas)}</textarea></label>
      <div class="cz-campo"><span>Enlace personal</span><div class="cz-fila-mini"><input readonly value="${esc(CZ.enlaceJugador(j))}"><button type="button" class="cz-btn-mini" data-j-accion="copiar">Copiar</button></div>
        <button type="button" class="cz-btn-mini" data-j-accion="token">Hacer un enlace nuevo (el viejo deja de funcionar)</button></div>
      <button type="button" class="cz-btn cz-peligro" data-j-accion="borrar">Quitar jugador</button>
    </div>`;
  }

  function sumar(j, delta) {
    if (!j || !delta) return;
    cambio(() => {
      j.puntos += delta;
      C.p.registro.push({ t: Date.now(), jugador: j.id, nombre: j.nombre, delta, total: j.puntos });
      if (C.p.registro.length > 500) C.p.registro.shift();
    }, { partes: "jugadores" });
  }

  function conectarJugadores() {
    const cont = $("#czJug");
    let foto = null;
    cont.addEventListener("focusin", () => { foto = instantanea(); });
    cont.addEventListener("input", ev => {
      const t = ev.target, fila = t.closest("[data-jug]");
      if (!fila || !t.dataset.jf) return;
      const j = CZ.jugador(C.p, fila.dataset.jug);
      if (foto) { apuntar(foto); foto = null; }
      j[t.dataset.jf] = t.value;
      guardar(); enviar();
      debounce("jug", () => { pintarEditor(); pintarAire(); }, 250);
    });
    cont.addEventListener("change", ev => { if (ev.target.dataset.jf) pintarJugadores(); });
    // Los puntos se escriben directamente en la casilla; se guardan al pulsar Enter o al salir de ella
    cont.addEventListener("change", ev => {
      const t = ev.target;
      if (t.dataset.pts === undefined) return;
      const j = CZ.jugador(C.p, t.closest("[data-jug]").dataset.jug), v = parseInt(t.value, 10);
      if (j && !isNaN(v)) sumar(j, v - j.puntos); else if (j) t.value = j.puntos;
    });
    cont.addEventListener("keydown", ev => { if (ev.target.dataset.pts !== undefined && ev.key === "Enter") ev.target.blur(); });
    cont.addEventListener("click", async ev => {
      const b = ev.target.closest("button"), fila = ev.target.closest("[data-jug]");
      if (!b && fila && ev.target.tagName !== "INPUT" && ev.target.closest(".cz-jug-fila")) { C.jugSel = C.jugSel === fila.dataset.jug ? "" : fila.dataset.jug; pintarJugadores(); return; }
      if (!b) return;
      const j = fila && CZ.jugador(C.p, fila.dataset.jug);
      if (b.dataset.jAccion === "nuevo") { cambio(() => { C.p.jugadores.push(CZ.nuevoJugador(C.p.jugadores.length)); }, { partes: "jugadores" }); return; }
      if (!j) return;
      if (b.dataset.delta) { sumar(j, Number(b.dataset.delta)); return; }
      if (b.dataset.abrir !== undefined) { C.abierto = C.abierto === j.id ? "" : j.id; pintarJugadores(); return; }
      if (b.closest("[data-jcolor]")) { cambio(() => { j.color = b.dataset.v; }, { partes: "jugadores" }); return; }
      if (b.dataset.estQuitar) { cambio(() => { j.estados.splice(Number(b.dataset.estQuitar), 1); }, { partes: "jugadores" }); return; }
      if (b.dataset.estMenos) { cambio(() => { const s = j.estados[Number(b.dataset.estMenos)]; s.turnos = Math.max(0, (s.turnos || 0) - 1); if (!s.turnos) j.estados.splice(Number(b.dataset.estMenos), 1); }, { partes: "jugadores" }); return; }
      if (b.dataset.invQuitar) { cambio(() => { j.inventario.splice(Number(b.dataset.invQuitar), 1); }, { partes: "jugadores" }); return; }
      switch (b.dataset.jAccion) {
        case "estado": {
          const texto = fila.querySelector("[data-nuevo-estado]").value.trim();
          const turnos = Number(fila.querySelector("[data-nuevo-turnos]").value) || 0;
          if (!texto) return;
          const color = /escudo|inmun|protec/i.test(texto) ? "#3d8de0" : /maldic|veneno|quema|infec/i.test(texto) ? "#a35ee8" : "#e8453c";
          cambio(() => { j.estados.push({ texto, turnos, color }); }, { partes: "jugadores" });
          break;
        }
        case "inv": {
          const v = k => fila.querySelector(`[data-inv="${k}"]`).value.trim();
          if (!v("nombre")) return;
          cambio(() => { j.inventario.push({ nombre: v("nombre"), etiqueta: v("etiqueta"), texto: v("texto"), color: "#e8453c" }); }, { partes: "jugadores" });
          break;
        }
        case "invCarta": {
          const c = seleccion()[0];
          if (!c || c.tipo !== "carta") return;
          cambio(() => { j.inventario.push({ nombre: c.props.titulo, etiqueta: c.props.etiqueta, texto: c.props.texto, color: c.props.colorEtiqueta, imagen: c.props.imagen }); }, { partes: "jugadores" });
          break;
        }
        case "avatarArchivo": elegirArchivo("__avatar:" + j.id); break;
        case "copiar":
          try { await navigator.clipboard.writeText(CZ.enlaceJugador(j)); aviso("Enlace copiado."); } catch (e) { aviso("No se pudo copiar. Selecciónalo y cópialo a mano."); }
          break;
        case "token":
          if (await confirmar(`¿Hacer un enlace nuevo para ${j.nombre}? El que tiene ahora deja de funcionar.`)) cambio(() => { j.token = CZ.uuid(); }, { partes: "jugadores" });
          break;
        case "borrar":
          if (await confirmar(`¿Quitar a ${j.nombre} de la partida?`)) cambio(() => { C.p.jugadores = C.p.jugadores.filter(x => x !== j); if (C.jugSel === j.id) C.jugSel = ""; }, { partes: "todo" });
          break;
      }
    });
  }

  /* ---------------------------------------------------------------- archivos de imagen */

  function elegirArchivo(destino) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => { if (inp.files[0]) usarArchivo(inp.files[0], destino); };
    inp.click();
  }

  async function usarArchivo(archivo, destino, punto) {
    if (!archivo.type.startsWith("image/")) return;
    if (archivo.size > 15 * 1024 * 1024) { aviso("La imagen pesa más de 15 MB."); return; }
    let src;
    try { src = await CZ.imagenes.guardar(archivo); } catch (e) { aviso("No se pudo guardar la imagen en este navegador."); return; }
    const e = escenaEdit(), el = seleccion()[0];
    if (destino === "__fondo") { cambio(() => { e.fondo = { tipo: "imagen", valor: src }; }); return; }
    if (destino && destino.startsWith("__avatar:")) { const j = CZ.jugador(C.p, destino.slice(9)); cambio(() => { j.avatar = src; }, { partes: "jugadores" }); return; }
    if (destino && el) { cambio(() => { el.props[destino] = src; }, { partes: "editor" }); return; }
    // Sin destino: una imagen nueva, con su proporción
    const dim = await new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([600, 400]); CZ.imagenes.url(src).then(u => { i.src = u; }); });
    let [w, h] = dim;
    const k = Math.min(1, 900 / w, 700 / h);
    w = Math.round(w * k); h = Math.round(h * k);
    const extra = { w, h, props: { src } };
    if (punto) { extra.x = Math.round(punto.x - w / 2); extra.y = Math.round(punto.y - h / 2); }
    anadir("imagen", extra);
  }

  /* ---------------------------------------------------------------- editor: ratón */

  let arrastre = null, marquesina = null;
  const rectMarq = () => {
    const m = marquesina;
    return { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
  };
  function aLienzo(ev) {
    const r = edEsc.lienzo.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / edEsc.escala, y: (ev.clientY - r.top) / edEsc.escala };
  }

  function conectarEditor() {
    const zona = $("#czEditor");
    zona.addEventListener("pointerdown", ev => {
      if (ev.button !== 0 || ev.target.isContentEditable) return;
      const pt = aLienzo(ev);
      const h = ev.target.closest("[data-h]");
      const e = escenaEdit();
      if (h && C.sel.length === 1) {
        const el = elDe(C.sel[0]);
        arrastre = { tipo: h.dataset.h === "rot" ? "rot" : "tam", h: h.dataset.h, el, ini: { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot || 0 }, p0: pt, foto: instantanea(), movido: false };
      } else {
        const nodo = ev.target.closest(".cz-el");
        const id = nodo && nodo.dataset.id;
        if (id) {
          if (ev.shiftKey) C.sel = C.sel.includes(id) ? C.sel.filter(x => x !== id) : C.sel.concat(id);
          else if (!C.sel.includes(id)) C.sel = [id];
          C.pestana = "props";
          const movibles = seleccion().filter(x => !x.bloqueado);
          arrastre = { tipo: "mover", els: movibles, ini: movibles.map(x => ({ x: x.x, y: x.y })), p0: pt, foto: instantanea(), movido: false };
        } else {
          if (!ev.shiftKey) C.sel = [];
          marquesina = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, base: C.sel.slice() };
        }
        pintarSeleccion();
        pintarLado();
      }
      zona.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    zona.addEventListener("pointermove", ev => {
      const pt = aLienzo(ev);
      if (marquesina) {
        marquesina.x1 = pt.x; marquesina.y1 = pt.y;
        const r = rectMarq(), e = escenaEdit();
        const dentro = e.elementos.filter(x => x.x < r.x + r.w && x.x + x.w > r.x && x.y < r.y + r.h && x.y + x.h > r.y).map(x => x.id);
        C.sel = Array.from(new Set(marquesina.base.concat(dentro)));
        pintarSeleccion();
        return;
      }
      if (!arrastre) return;
      const dx = pt.x - arrastre.p0.x, dy = pt.y - arrastre.p0.y;
      if (!arrastre.movido && Math.abs(dx) + Math.abs(dy) < 3 / edEsc.escala) return;
      if (!arrastre.movido) { arrastre.movido = true; apuntar(arrastre.foto); }
      let guias = [];
      if (arrastre.tipo === "mover" && arrastre.els.length) {
        const caja = cajaDe(arrastre.ini.map((p, i) => ({ x: p.x + dx, y: p.y + dy, w: arrastre.els[i].w, h: arrastre.els[i].h })));
        const im = ev.altKey ? { dx: 0, dy: 0, guias: [] } : iman(caja, new Set(arrastre.els.map(x => x.id)));
        guias = im.guias;
        arrastre.els.forEach((el, i) => { el.x = Math.round(arrastre.ini[i].x + dx + im.dx); el.y = Math.round(arrastre.ini[i].y + dy + im.dy); });
      } else if (arrastre.tipo === "tam") {
        redimensionar(arrastre, dx, dy, ev.shiftKey);
      } else if (arrastre.tipo === "rot") {
        const el = arrastre.el, cx = el.x + el.w / 2, cy = el.y + el.h / 2;
        let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        a = Math.round(((a % 360) + 540) % 360 - 180);
        if (Math.abs(a) < 3) a = 0;
        el.rot = a;
      }
      edEsc.mostrar(C.p, C.editId, C.vistaPaso);
      pintarSeleccion(guias);
    });

    const soltar = () => {
      if (marquesina) { marquesina = null; pintarSeleccion(); pintarLado(); return; }
      if (!arrastre) return;
      const movido = arrastre.movido;
      arrastre = null;
      if (movido) { guardar(); pintarEditor(); pintarLado(); enviar(); }
      else pintarSeleccion();
    };
    zona.addEventListener("pointerup", soltar);
    zona.addEventListener("pointercancel", soltar);

    // Doble clic en un texto o botón: escribir directamente sobre el escenario
    zona.addEventListener("dblclick", ev => {
      // Con la captura del puntero el evento llega a la zona: se busca qué hay debajo del ratón
      const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodo = bajo && bajo.closest(".cz-el");
      if (!nodo) return;
      const el = elDe(nodo.dataset.id);
      if (!el || el.bloqueado) return;
      const t = nodo.querySelector(".cz-texto-t, .cz-boton-t");
      if (!t) { C.pestana = "props"; pintarLado(); return; }
      const foto = instantanea();
      t.contentEditable = "true";
      t.focus();
      document.getSelection().selectAllChildren(t);
      const fin = () => {
        t.contentEditable = "false";
        const v = t.innerText.replace(/\n$/, "");
        if (v !== el.props.texto) { apuntar(foto); el.props.texto = v; guardar(); enviar(); }
        pintarEditor(); pintarLado();
      };
      t.addEventListener("blur", fin, { once: true });
      t.addEventListener("keydown", e2 => {
        if (e2.key === "Escape" || (e2.key === "Enter" && (el.tipo === "boton" || e2.ctrlKey))) { e2.preventDefault(); t.blur(); }
        e2.stopPropagation();
      });
    });

    // Arrastrar imágenes desde el equipo al escenario
    zona.addEventListener("dragover", ev => { if (Array.from(ev.dataTransfer.types).includes("Files")) { ev.preventDefault(); zona.classList.add("cz-soltar"); } });
    zona.addEventListener("dragleave", () => zona.classList.remove("cz-soltar"));
    zona.addEventListener("drop", ev => {
      zona.classList.remove("cz-soltar");
      const f = Array.from(ev.dataTransfer.files || []).find(x => x.type.startsWith("image/"));
      if (!f) return;
      ev.preventDefault();
      const nodo = ev.target.closest(".cz-el");
      const el = nodo && elDe(nodo.dataset.id);
      const campo = el && { imagen: "src", prueba: "src", carta: "imagen" }[el.tipo];
      if (campo) { C.sel = [el.id]; usarArchivo(f, campo); } else usarArchivo(f, null, aLienzo(ev));
    });
  }

  function cajaDe(rs) {
    const L = Math.min(...rs.map(r => r.x)), T = Math.min(...rs.map(r => r.y));
    return { x: L, y: T, w: Math.max(...rs.map(r => r.x + r.w)) - L, h: Math.max(...rs.map(r => r.y + r.h)) - T };
  }

  /* Guías magnéticas: bordes y centros del escenario y de los demás elementos. */
  function iman(caja, excluir) {
    const tol = 8 / edEsc.escala;
    const e = escenaEdit();
    const xs = [0, CZ.ANCHO / 2, CZ.ANCHO], ys = [0, CZ.ALTO / 2, CZ.ALTO];
    e.elementos.forEach(o => { if (excluir.has(o.id)) return; xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); });
    const busca = (vals, objetivos) => {
      let mejor = null;
      vals.forEach(v => objetivos.forEach(o => { const d = o - v; if (Math.abs(d) <= tol && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d, v: o }; }));
      return mejor;
    };
    const bx = busca([caja.x, caja.x + caja.w / 2, caja.x + caja.w], xs);
    const by = busca([caja.y, caja.y + caja.h / 2, caja.y + caja.h], ys);
    const guias = [];
    if (bx) guias.push({ eje: "x", v: bx.v });
    if (by) guias.push({ eje: "y", v: by.v });
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guias };
  }

  function redimensionar(a, dx, dy, proporcion) {
    const el = a.el, i = a.ini, h = a.h;
    let x = i.x, y = i.y, w = i.w, hh = i.h;
    if (h.includes("e")) w = i.w + dx;
    if (h.includes("s")) hh = i.h + dy;
    if (h.includes("w")) { w = i.w - dx; x = i.x + dx; }
    if (h.includes("n")) { hh = i.h - dy; y = i.y + dy; }
    if (proporcion && (h.length === 2)) {
      const k = Math.max(w / i.w, hh / i.h);
      const nw = i.w * k, nh = i.h * k;
      if (h.includes("w")) x = i.x + i.w - nw;
      if (h.includes("n")) y = i.y + i.h - nh;
      w = nw; hh = nh;
    }
    el.w = Math.max(20, Math.round(w)); el.h = Math.max(20, Math.round(hh));
    el.x = Math.round(x); el.y = Math.round(y);
  }

  /* ---------------------------------------------------------------- barra superior, herramientas y lista */

  function conectarBarra() {
    document.querySelectorAll("[data-anadir]").forEach(b => b.addEventListener("click", () => {
      cerrarMenus();
      if (b.dataset.anadir === "imagen") elegirArchivo(null);
      else if (PREAJUSTES[b.dataset.anadir]) PREAJUSTES[b.dataset.anadir]();
    }));
    document.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", ev => {
      ev.stopPropagation();
      const m = document.getElementById(b.dataset.menu);
      const abierto = !m.hidden;
      cerrarMenus();
      m.hidden = abierto;
      if (b.dataset.menu === "czMenuPartidas" && !abierto) pintarMenuPartidas();
    }));
    document.addEventListener("click", ev => { if (!ev.target.closest(".cz-menu")) cerrarMenus(); });

    $("#czDeshacer").addEventListener("click", deshacer);
    $("#czRehacer").addEventListener("click", rehacer);
    $("#czEscenaNueva").addEventListener("click", nuevaEscena);
    $("#czPrograma").addEventListener("click", () => {
      const w = window.open("concurso-programa.html", "czPrograma", "popup,width=1280,height=760");
      if (!w) aviso("El navegador bloqueó la ventana. Permite las ventanas emergentes de esta página.");
    });
    $("#czPasoSig").addEventListener("click", pasoSiguiente);
    $("#czPasoAnt").addEventListener("click", pasoAnterior);
    $("#czEnviarAire").addEventListener("click", () => alAire(C.editId));
    $("#czEditarAire").addEventListener("click", () => { C.editId = C.p.vivo.escena; C.sel = []; C.vistaPaso = 0; pintarTodo(); });
    $("#czReiniciarAire").addEventListener("click", async () => {
      const e = CZ.escena(C.p, C.p.vivo.escena);
      if (!e || !(await confirmar("¿Quitar las marcas de esta escena (celdas usadas, cartas volteadas y temporizadores)? Los puntos no cambian."))) return;
      cambio(() => {
        const ids = new Set(e.elementos.map(x => x.id)), J = C.p.juego;
        Object.keys(J.usadas).forEach(k => { if (ids.has(k.split(":")[0])) delete J.usadas[k]; });
        ["volteadas", "relojes"].forEach(t => Object.keys(J[t]).forEach(k => { if (ids.has(k)) delete J[t][k]; }));
        C.p.vivo.paso = 0;
      }, { partes: "todo" });
    });
    $("#czSilencio").addEventListener("change", ev => { CZ.canal.enviar({ tipo: "silencio", valor: ev.target.checked }); });

    // Lista de escenas: elegir, poner al aire y reordenar arrastrando
    const lista = $("#czEscenas");
    lista.addEventListener("click", ev => {
      const aire = ev.target.closest("[data-aire]");
      if (aire) { ev.stopPropagation(); alAire(aire.dataset.aire); return; }
      const it = ev.target.closest("[data-escena]");
      if (!it || it.dataset.escena === C.editId) return;
      C.editId = it.dataset.escena; C.sel = []; C.vistaPaso = 0;
      pintar("escenas"); pintarLado();
    });
    lista.addEventListener("dblclick", ev => { const it = ev.target.closest("[data-escena]"); if (it) alAire(it.dataset.escena); });
    let arrastrada = null;
    lista.addEventListener("dragstart", ev => { const it = ev.target.closest("[data-escena]"); arrastrada = it && it.dataset.escena; ev.dataTransfer.effectAllowed = "move"; });
    lista.addEventListener("dragover", ev => { if (arrastrada) { ev.preventDefault(); const it = ev.target.closest("[data-escena]"); lista.querySelectorAll(".cz-sobre").forEach(n => n.classList.remove("cz-sobre")); if (it) it.classList.add("cz-sobre"); } });
    lista.addEventListener("drop", ev => {
      const it = ev.target.closest("[data-escena]");
      if (!arrastrada || !it || it.dataset.escena === arrastrada) { arrastrada = null; return; }
      ev.preventDefault();
      const de = arrastrada, a = it.dataset.escena;
      arrastrada = null;
      cambio(() => {
        const es = C.p.escenas, i = es.findIndex(x => x.id === de);
        const [m] = es.splice(i, 1);
        const j = es.findIndex(x => x.id === a);
        m.carpeta = es[j].carpeta;
        es.splice(j + (i <= j ? 1 : 0), 0, m);
      }, { partes: "escenas" });
    });
    lista.addEventListener("dragend", () => { arrastrada = null; lista.querySelectorAll(".cz-sobre").forEach(n => n.classList.remove("cz-sobre")); });

    conectarProps();
    conectarPasos();
    conectarJugadores();
  }

  function cerrarMenus() { document.querySelectorAll(".cz-menu-lista").forEach(m => { m.hidden = true; }); }

  function pintarMenuPartidas() {
    const m = $("#czMenuPartidas");
    const otras = CZ.local.lista().filter(x => x.id !== C.p.id);
    m.innerHTML = `
      <button type="button" data-partida="nueva">Nueva partida vacía</button>
      <button type="button" data-partida="ejemplo">Nueva partida de ejemplo</button>
      <button type="button" data-partida="exportar">Exportar esta partida (JSON)</button>
      <button type="button" data-partida="importar">Importar una partida (JSON)</button>
      ${otras.length ? `<div class="cz-menu-sep">Abrir otra</div>` + otras.map(x => `<button type="button" data-abrir-partida="${x.id}">${esc(x.nombre)} <small>${new Date(x.actualizada).toLocaleDateString("es")}</small></button>`).join("") : ""}
      <div class="cz-menu-sep"></div>
      <button type="button" class="cz-peligro" data-partida="borrar">Borrar esta partida</button>`;
    m.onclick = async ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      cerrarMenus();
      if (b.dataset.abrirPartida) { abrirPartida(CZ.local.cargar(b.dataset.abrirPartida)); return; }
      switch (b.dataset.partida) {
        case "nueva": abrirPartida(CZ.nuevaPartida("Partida nueva", false)); break;
        case "ejemplo": abrirPartida(CZ.nuevaPartida("El Gran Concurso", true)); break;
        case "exportar": exportar(); break;
        case "importar": importar(); break;
        case "borrar":
          if (await confirmar(`¿Borrar «${C.p.nombre}» de este navegador? No se puede deshacer. Exporta antes si la quieres guardar.`)) {
            CZ.local.borrar(C.p.id);
            const otra = CZ.local.lista()[0];
            abrirPartida((otra && CZ.local.cargar(otra.id)) || CZ.nuevaPartida("Partida nueva", false));
          }
          break;
      }
    };
  }

  function abrirPartida(p) {
    if (!p) return;
    C.p = CZ.normalizar(p);
    C.editId = C.p.vivo.escena || C.p.escenas[0].id;
    C.sel = []; C.jugSel = ""; C.abierto = ""; C.deshacer = []; C.rehacer = []; C.vistaPaso = 0;
    minis.forEach(m => m.destruir()); minis.clear();
    CZ.local.guardar(C.p);
    pintarTodo();
    enviar();
  }

  /* Exporta la partida con sus imágenes locales dentro, para poder abrirla en otro equipo. */
  async function exportar() {
    const p = CZ.copia(C.p), imagenes = {};
    const claves = new Set();
    JSON.stringify(p, (k, v) => { if (typeof v === "string" && v.startsWith("idb:")) claves.add(v); return v; });
    for (const c of claves) {
      const u = await CZ.imagenes.url(c);
      if (!u) continue;
      const blob = await fetch(u).then(r => r.blob());
      imagenes[c] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    }
    const datos = JSON.stringify({ formato: "concurso", version: 1, partida: p, imagenes }, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([datos], { type: "application/json" }));
    a.download = (p.nombre || "partida").replace(/[^\w\-áéíóúñ ]+/gi, "").trim().replace(/\s+/g, "-") + ".concurso.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function importar() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = async () => {
      try {
        const d = JSON.parse(await inp.files[0].text());
        const p = d.partida || d;
        if (!p.escenas) throw new Error("no es una partida");
        const cambios = {};
        for (const [clave, dataUrl] of Object.entries(d.imagenes || {})) {
          const blob = await fetch(dataUrl).then(r => r.blob());
          cambios[clave] = await CZ.imagenes.guardar(blob);
        }
        let txt = JSON.stringify(p);
        Object.entries(cambios).forEach(([a, b]) => { txt = txt.split(JSON.stringify(a)).join(JSON.stringify(b)); });
        const nueva = JSON.parse(txt);
        if (CZ.local.lista().some(x => x.id === nueva.id)) { nueva.id = CZ.uuid(); nueva.nombre += " (importada)"; }
        nueva.jugadores.forEach(j => { j.token = CZ.uuid(); });
        abrirPartida(nueva);
        aviso("Partida importada. Los enlaces de los jugadores son nuevos.");
      } catch (e) {
        aviso("Ese archivo no es una partida de Concurso.", true);
      }
    };
    inp.click();
  }

  /* ---------------------------------------------------------------- teclado y portapapeles */

  function escribiendo(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }

  function conectarTeclado() {
    document.addEventListener("keydown", ev => {
      if (escribiendo(ev.target)) return;
      const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key;
      if (ctrl && (k === "z" || k === "Z")) { ev.preventDefault(); if (ev.shiftKey) rehacer(); else deshacer(); return; }
      if (ctrl && (k === "y" || k === "Y")) { ev.preventDefault(); rehacer(); return; }
      if (ctrl && (k === "d" || k === "D")) { ev.preventDefault(); duplicar(); return; }
      if (ctrl && (k === "c" || k === "C")) { if (C.sel.length) C.porta = CZ.copia(seleccion()); return; }
      if (ctrl && (k === "a" || k === "A")) { ev.preventDefault(); C.sel = escenaEdit().elementos.map(x => x.id); pintarSeleccion(); pintarLado(); return; }
      if (ctrl && k === "Enter") { ev.preventDefault(); alAire(C.editId); return; }
      if (k === " ") { ev.preventDefault(); pasoSiguiente(); return; }
      if (k === "Backspace") { ev.preventDefault(); pasoAnterior(); return; }
      if (k === "Delete") { borrarSel(); return; }
      if (k === "Escape") { C.sel = []; pintarSeleccion(); pintarLado(); return; }
      if (k.startsWith("Arrow")) {
        ev.preventDefault();
        if (!C.sel.length) { if (k === "ArrowRight") pasoSiguiente(); if (k === "ArrowLeft") pasoAnterior(); return; }
        const d = ev.shiftKey ? 10 : 1;
        cambio(() => seleccion().forEach(x => {
          if (x.bloqueado) return;
          if (k === "ArrowLeft") x.x -= d; if (k === "ArrowRight") x.x += d; if (k === "ArrowUp") x.y -= d; if (k === "ArrowDown") x.y += d;
        }), { partes: "editor" });
        return;
      }
      if (/^[1-9]$/.test(k) && !ctrl) {
        const j = C.p.jugadores[Number(k) - 1];
        if (j) { C.jugSel = C.jugSel === j.id ? "" : j.id; if (C.pestana !== "jugadores") { C.pestana = "jugadores"; } pintarLado(); }
        return;
      }
      // + y − suman o restan 1; * y _ (las mismas teclas con Mayús en un teclado español) suman o restan 5
      const delta = { "+": 1, "=": 1, "-": -1, "*": 5, "_": -5 }[k];
      if (delta && C.jugSel) sumar(CZ.jugador(C.p, C.jugSel), delta);
    });

    document.addEventListener("paste", ev => {
      if (escribiendo(ev.target)) return;
      const f = Array.from(ev.clipboardData.files || []).find(x => x.type.startsWith("image/"));
      if (f) { ev.preventDefault(); usarArchivo(f, null); return; }
      const texto = ev.clipboardData.getData("text/plain").trim();
      if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(texto)) { ev.preventDefault(); anadir("imagen", { props: { src: texto } }); return; }
      if (C.porta && C.porta.length) {
        ev.preventDefault();
        const e = escenaEdit();
        cambio(() => {
          const nuevos = C.porta.map(x => { const c = CZ.copia(x); c.id = CZ.uid(); c.x += 30; c.y += 30; return c; });
          e.elementos.push(...nuevos);
          C.sel = nuevos.map(x => x.id);
          C.porta = nuevos.map(x => CZ.copia(x));
        }, { partes: "editor" });
      }
    });
  }

  /* ---------------------------------------------------------------- estado remoto, avisos y diálogos */

  function pintarRemoto(estado, detalle) {
    const chip = $("#czRemoto");
    const textos = {
      apagado: "Jugadores: solo en este equipo",
      conectando: "Conectando con los jugadores...",
      "sin-sesion": "Jugadores: inicia sesión como Admin en el sitio",
      "sin-admin": "Jugadores: tu cuenta no es Admin",
      "sin-sql": "Jugadores: falta correr docs/admin/concurso.sql",
      conectado: "Jugadores conectados",
      error: "Jugadores: error al publicar"
    };
    chip.textContent = textos[estado] || estado;
    chip.dataset.estado = estado;
    chip.title = detalle || "";
  }

  function aviso(texto, error) {
    const n = document.createElement("div");
    n.className = "cz-aviso" + (error ? " cz-aviso-error" : "");
    n.textContent = texto;
    $("#czAvisos").appendChild(n);
    setTimeout(() => n.classList.add("fuera"), 3600);
    setTimeout(() => n.remove(), 4200);
  }

  function modal(html) {
    const fondo = document.createElement("div");
    fondo.className = "cz-modal-fondo";
    fondo.innerHTML = `<div class="cz-modal">${html}</div>`;
    document.body.appendChild(fondo);
    return fondo;
  }
  function confirmar(texto) {
    return new Promise(res => {
      const m = modal(`<p>${esc(texto)}</p><div class="cz-modal-bot"><button type="button" class="cz-btn" data-r="0">Cancelar</button><button type="button" class="cz-btn cz-btn-fuerte" data-r="1">Aceptar</button></div>`);
      m.querySelector('[data-r="1"]').focus();
      m.addEventListener("click", ev => { const b = ev.target.closest("[data-r]"); if (b || ev.target === m) { m.remove(); res(!!(b && b.dataset.r === "1")); } });
      m.addEventListener("keydown", ev => { if (ev.key === "Escape") { m.remove(); res(false); } });
    });
  }
  function pedir(texto, valor) {
    return new Promise(res => {
      const m = modal(`<label class="cz-campo"><span>${esc(texto)}</span><input value="${esc(valor || "")}"></label><div class="cz-modal-bot"><button type="button" class="cz-btn" data-r="0">Cancelar</button><button type="button" class="cz-btn cz-btn-fuerte" data-r="1">Aceptar</button></div>`);
      const inp = m.querySelector("input");
      inp.focus(); inp.select();
      const cerrar = ok => { m.remove(); res(ok ? inp.value : null); };
      m.addEventListener("click", ev => { const b = ev.target.closest("[data-r]"); if (b) cerrar(b.dataset.r === "1"); else if (ev.target === m) cerrar(false); });
      inp.addEventListener("keydown", ev => { if (ev.key === "Enter") cerrar(true); if (ev.key === "Escape") cerrar(false); ev.stopPropagation(); });
    });
  }

  arrancar();
})();
