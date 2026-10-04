/* =============================================================================
   VALHALLA — pantallas. Cuartel (grupo, nivel, equipo), arena (el combate se
   dibuja en un canvas y se maneja con clic) y resultado (XP, niveles, botín).
   Las reglas viven en valhalla-reglas / datos / combate; acá solo se muestra
   y se pasan órdenes al motor.
============================================================================= */
(function () {
  const VH = window.VH;
  const CLAVE = "compendioValhalla";
  const TS = 64;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const ATRIBUTOS = [["fue", "FUE"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]];

  /* --- Guardado ------------------------------------------------------------- */
  let datos = { einherjar: [], reserva: [], grupo: [], dificultad: "normal" };
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (g && Array.isArray(g.einherjar)) datos = Object.assign(datos, g);
  } catch (e) { /* sin almacenamiento */ }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* sin almacenamiento */ }
  }
  const reg = id => datos.einherjar.find(r => r.id === id);

  /* --- Cuartel ------------------------------------------------------------------- */
  let seleccionado = null;
  let panel = null; // "nuevo" | "fichas"
  let fichasEstado = null; // { cargando } | { lista } | { error }

  function barraXp(r) {
    if (r.nivel >= VH.NIVEL_MAX) return `<div class="vh-xp"><span style="width:100%"></span></div><small>Nivel máximo</small>`;
    const a = VH.XP_PARA_NIVEL[r.nivel], b = VH.XP_PARA_NIVEL[r.nivel + 1];
    const pct = Math.max(0, Math.min(100, Math.round(((r.xp - a) / (b - a)) * 100)));
    return `<div class="vh-xp"><span style="width:${pct}%"></span></div><small>${r.xp - a} / ${b - a} XP</small>`;
  }

  function resumen(r) {
    try {
      const u = VH.unidadDesdeRegistro(r);
      return `PV ${u.pvMax} · CA ${u.ca} · Vel. ${u.vel}`;
    } catch (e) { return ""; }
  }

  function pintarCuartel() {
    const grupo = datos.grupo.map(reg).filter(Boolean);
    const lista = datos.einherjar.map(r => `
      <article class="vh-carta ${seleccionado === r.id ? "activa" : ""} ${datos.grupo.includes(r.id) ? "en-grupo" : ""}" data-id="${r.id}">
        <h3>${esc(r.nombre)}</h3>
        <p class="vh-sub">${esc(r.origen === "ficha" ? (r.ficha.identidad.clase || "Personaje") : VH.CLASES[r.claseId].nombre)} · nivel ${r.nivel}${r.mejoras ? ` · <b class="vh-aviso">${r.mejoras} mejoras</b>` : ""}</p>
        ${barraXp(r)}
        <p class="vh-sub">${esc(resumen(r))}</p>
        <button type="button" class="vh-mini" data-grupo="${r.id}">${datos.grupo.includes(r.id) ? "Sacar del grupo" : "Al grupo"}</button>
      </article>`).join("");

    $("vhCuartel").innerHTML = `
      <p class="vh-intro">Aquí se pelea y nada más. Elige a tus einherjar, ponlos en el grupo y entra a la arena. Suben de nivel y encuentran equipo con cada victoria, hasta el nivel 20.</p>
      <div class="vh-barra-grupo">
        <div class="vh-grupo">
          <strong>Grupo (${grupo.length}/4)</strong>
          ${grupo.map(r => `<span class="vh-chip" style="--c:${r.color}">${esc(r.nombre)} <small>nv. ${r.nivel}</small></span>`).join("") || `<span class="vh-vacio">Nadie todavía</span>`}
        </div>
        <label>Dificultad
          <select id="vhDificultad">${Object.entries(VH.dificultades).map(([id, d]) => `<option value="${id}" ${datos.dificultad === id ? "selected" : ""}>${d.nombre}</option>`).join("")}</select>
        </label>
        <button type="button" class="vh-boton vh-principal" id="vhEntrar" ${grupo.length ? "" : "disabled"}>Entrar a la arena</button>
      </div>
      <div class="vh-botones-fila">
        <button type="button" class="vh-boton" id="vhNuevo">+ Nuevo einherjar</button>
        <button type="button" class="vh-boton" id="vhFichas">Traer un personaje mío</button>
      </div>
      <div id="vhPanel">${pintarPanel()}</div>
      <div class="vh-salon">${lista || `<p class="vh-vacio">El salón está vacío. Crea un einherjar o trae uno de tus personajes.</p>`}</div>
      <div id="vhDetalle">${pintarDetalle()}</div>`;
    cablearCuartel();
  }

  function pintarPanel() {
    if (panel === "nuevo") {
      return `<div class="vh-panel"><h3>Elige una clase</h3>
        <div class="vh-clases">${Object.entries(VH.CLASES).map(([id, c]) => `
          <button type="button" class="vh-clase" data-clase="${id}"><strong>${c.nombre}</strong><span>${esc(c.desc)}</span><small>d${c.dado} de vida</small></button>`).join("")}</div>
        <label class="vh-campo">Nombre (opcional)<input id="vhNombreNuevo" maxlength="40" placeholder="Se llamará «Clase de Valhalla»"></label></div>`;
    }
    if (panel === "fichas") {
      const f = fichasEstado || {};
      if (f.cargando) return `<div class="vh-panel"><p>Buscando tus personajes…</p></div>`;
      if (f.error) return `<div class="vh-panel"><p class="vh-aviso">${esc(f.error)}</p></div>`;
      if (!f.lista || !f.lista.length) return `<div class="vh-panel"><p>No tienes personajes en tus fichas.</p></div>`;
      return `<div class="vh-panel"><h3>Tus personajes</h3>
        <p class="vh-sub">Se trae una copia. Tu ficha original no se toca, y lo que pase en Valhalla se queda en Valhalla.</p>
        <div class="vh-fichas">${f.lista.map(p => `
          <div class="vh-ficha-fila">
            <span><strong>${esc(p.identidad.nombre || "Sin nombre")}</strong> <small>${esc([p.identidad.raza, p.identidad.clase].filter(Boolean).join(" · "))} · nivel ${p.identidad.nivelTotal || 1}</small>
            ${esaCaido(p) ? `<span class="vh-etiqueta">Caído</span>` : ""}</span>
            <button type="button" class="vh-mini" data-traer="${p.id}">Traer</button>
          </div>`).join("")}</div></div>`;
    }
    return "";
  }

  function esaCaido(p) {
    return !!(p.archivado || (p.combate && (p.combate.salvMuerte || {}).fallos >= 3) || (p.combate && Number(p.combate.pvMax) > 0 && Number(p.combate.pvActual) <= 0));
  }

  function pintarDetalle() {
    const r = reg(seleccionado);
    if (!r) return datos.reserva.length ? `<h3 class="vh-subtitulo">Reserva</h3>${pintarReserva(null)}` : "";
    let u;
    try { u = VH.unidadDesdeRegistro(r); } catch (e) { return `<p class="vh-aviso">No se pudo leer este personaje: ${esc(e.message)}</p>`; }
    const puntos = r.mejoras > 0;
    const eq = r.equipo || {};
    const casilla = (nombre, it, tipo) => `<div class="vh-eq"><span>${nombre}</span><strong>${it ? esc(VH.nombreObjeto(it)) : "—"}</strong>${it ? `<button type="button" class="vh-mini" data-quitar="${tipo}">Quitar</button>` : ""}</div>`;
    const conj = u.conjuros.map(cj => cj.nombre + (cj.nivel ? ` (${cj.nivel})` : "")).join(", ");
    return `
      <div class="vh-panel vh-detalle">
        <div class="vh-detalle-cab">
          <div><h2>${esc(r.nombre)}</h2><p class="vh-sub">${esc(u.clase || "")} · nivel ${r.nivel} · ${r.victorias} victorias, ${r.derrotas} derrotas</p></div>
          <div class="vh-botones-fila">
            <button type="button" class="vh-mini" data-renombrar="${r.id}">Renombrar</button>
            ${r.origen === "predeterminado" && puntos ? `<button type="button" class="vh-mini" data-auto="${r.id}">Repartir mejoras</button>` : ""}
            <button type="button" class="vh-mini peligro" data-borrar="${r.id}">Eliminar</button>
          </div>
        </div>
        <div class="vh-stats">
          <div><span>PV</span><strong>${u.pvMax}</strong></div>
          <div><span>CA</span><strong>${u.ca}</strong></div>
          <div><span>Velocidad</span><strong>${u.vel} casillas</strong></div>
          <div><span>Competencia</span><strong>${VH.signo(u.comp)}</strong></div>
          <div><span>Ataques por acción</span><strong>${u.ataquesPorAccion}</strong></div>
        </div>
        <div class="vh-atributos">${ATRIBUTOS.map(([id, n]) => `
          <div class="vh-atr"><span>${n}</span><strong>${VH.signo(u.mod[id])}</strong>${puntos ? `<button type="button" class="vh-mini" data-mejora="${id}">+1</button>` : ""}</div>`).join("")}</div>
        ${puntos ? `<p class="vh-aviso">Tienes ${r.mejoras} puntos de mejora para repartir.</p>` : ""}
        <h4>Ataques y habilidades</h4>
        <ul class="vh-lista">${u.acciones.filter(a => a.tipo !== "especial").map(a => `<li><strong>${esc(a.nombre)}</strong>${a.ataque !== undefined && a.ataque !== null ? ` ${VH.signo(a.ataque)}` : ""} ${esc((a.danos || []).map(d => `${d.f} ${d.t}`).join(" + "))}${a.desc ? ` <small>${esc(a.desc)}</small>` : ""}</li>`).join("")}</ul>
        ${u.espacios.length ? `<h4>Magia</h4><p class="vh-sub">Espacios: ${u.espacios.map((n, i) => `nv. ${i + 1}: ${n}`).join(" · ")} · CD ${u.lanz.cd} · ataque ${VH.signo(u.lanz.ataque)}</p><p class="vh-sub">${esc(conj)}</p>` : (u.conjuros.length ? `<h4>Conjuros</h4><p class="vh-sub">${esc(conj)}</p>` : "")}
        ${u.rasgos.length ? `<h4>Rasgos</h4><ul class="vh-lista">${u.rasgos.map(t => `<li><small>${esc(t)}</small></li>`).join("")}</ul>` : ""}
        ${u.notas.length ? `<p class="vh-sub">Sin automatizar todavía: ${esc(u.notas.join("; "))}</p>` : ""}
        <h4>Equipo</h4>
        <div class="vh-equipo">${casilla("Arma", eq.arma, "arma")}${casilla("Armadura", eq.armadura, "armadura")}${casilla("Escudo", eq.escudo, "escudo")}${casilla("Accesorio", eq.accesorio, "accesorio")}</div>
        ${pintarReserva(r)}
      </div>`;
  }

  function descripcionObjeto(it) {
    const partes = [];
    if (it.tipo === "arma") { const a = VH.arma(it.base); if (a) partes.push(`${a.dano} ${a.tipoDano}`); }
    if (it.tipo === "armadura") { const a = VH.ARMADURAS.find(x => x.id === it.base); if (a) partes.push(`CA ${a.base + (it.bonus || 0)}`); }
    if (it.tipo === "escudo") partes.push(`CA +${2 + (it.bonus || 0)}`);
    if (it.ca) partes.push(`CA +${it.ca}`);
    if (it.pv) partes.push(`PV +${it.pv}`);
    if (it.vel) partes.push(`Vel. +${it.vel}`);
    if (it.afijo) {
      const a = it.afijo;
      if (a.extra) partes.push(`+${a.extra.f} ${a.extra.t}`);
      if (a.empuje) partes.push(`empuja ${a.empuje}`);
      if (a.robo) partes.push("roba vida");
      if (a.espinas) partes.push(`espinas ${a.espinas.f}`);
      if (a.pv) partes.push(`PV +${a.pv}`);
      if (a.vel) partes.push(`Vel. +${a.vel}`);
      if (a.resistencia) partes.push(`resiste ${a.resistencia}`);
    }
    return partes.join(" · ");
  }

  function pintarReserva(r) {
    if (!datos.reserva.length) return `<p class="vh-sub">La reserva está vacía. El botín sale de los enemigos derrotados.</p>`;
    return `<h4>Reserva</h4><div class="vh-reserva">${datos.reserva.map(it => `
      <div class="vh-objeto"><span><strong>${esc(VH.nombreObjeto(it))}</strong> <small>${esc(it.tipo)}</small><br><small>${esc(descripcionObjeto(it))}</small></span>
      ${r ? `<button type="button" class="vh-mini" data-equipar="${it.id}">Equipar</button>` : ""}
      <button type="button" class="vh-mini peligro" data-tirar="${it.id}" title="Descartar">✕</button></div>`).join("")}</div>`;
  }

  function cablearCuartel() {
    $("vhDificultad").addEventListener("change", ev => { datos.dificultad = ev.target.value; guardar(); });
    $("vhEntrar").addEventListener("click", empezarCombate);
    $("vhNuevo").addEventListener("click", () => { panel = panel === "nuevo" ? null : "nuevo"; pintarCuartel(); });
    $("vhFichas").addEventListener("click", abrirFichas);
    const raiz = $("vhCuartel");
    raiz.querySelectorAll("[data-clase]").forEach(b => b.addEventListener("click", () => {
      const nombre = ($("vhNombreNuevo").value || "").trim();
      const r = VH.registroPredeterminado(b.dataset.clase, nombre);
      datos.einherjar.push(r);
      if (datos.grupo.length < 4) datos.grupo.push(r.id);
      seleccionado = r.id; panel = null; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-traer]").forEach(b => b.addEventListener("click", () => {
      const p = fichasEstado.lista.find(x => x.id === b.dataset.traer);
      if (!p) return;
      const r = VH.registroDesdeFicha(p);
      datos.einherjar.push(r);
      if (datos.grupo.length < 4) datos.grupo.push(r.id);
      seleccionado = r.id; panel = null; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll(".vh-carta").forEach(carta => carta.addEventListener("click", ev => {
      if (ev.target.closest("[data-grupo]")) return;
      seleccionado = seleccionado === carta.dataset.id ? null : carta.dataset.id;
      pintarCuartel();
    }));
    raiz.querySelectorAll("[data-grupo]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.grupo;
      if (datos.grupo.includes(id)) datos.grupo = datos.grupo.filter(x => x !== id);
      else if (datos.grupo.length < 4) datos.grupo.push(id);
      guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-mejora]").forEach(b => b.addEventListener("click", () => {
      const r = reg(seleccionado);
      if (!r || r.mejoras <= 0) return;
      if (r.origen === "predeterminado" && (VH.CLASES[r.claseId].atr[b.dataset.mejora] + (r.bonosAtr[b.dataset.mejora] || 0)) >= 20) return;
      r.bonosAtr[b.dataset.mejora] = (r.bonosAtr[b.dataset.mejora] || 0) + 1;
      r.mejoras--; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-auto]").forEach(b => b.addEventListener("click", () => { VH.repartirMejorasAuto(reg(b.dataset.auto)); guardar(); pintarCuartel(); }));
    raiz.querySelectorAll("[data-renombrar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(b.dataset.renombrar);
      const n = prompt("Nuevo nombre", r.nombre);
      if (n && n.trim()) { r.nombre = n.trim().slice(0, 40); guardar(); pintarCuartel(); }
    }));
    raiz.querySelectorAll("[data-borrar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(b.dataset.borrar);
      if (!confirm(`¿Eliminar a ${r.nombre} para siempre? Su equipo vuelve a la reserva.`)) return;
      Object.values(r.equipo || {}).forEach(it => { if (it) datos.reserva.push(it); });
      datos.einherjar = datos.einherjar.filter(x => x.id !== r.id);
      datos.grupo = datos.grupo.filter(x => x !== r.id);
      seleccionado = null; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-equipar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(seleccionado);
      const i = datos.reserva.findIndex(x => x.id === b.dataset.equipar);
      if (!r || i < 0) return;
      const it = datos.reserva.splice(i, 1)[0];
      r.equipo = r.equipo || {};
      if (r.equipo[it.tipo]) datos.reserva.push(r.equipo[it.tipo]);
      r.equipo[it.tipo] = it;
      guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-quitar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(seleccionado);
      const it = r.equipo[b.dataset.quitar];
      if (it) { datos.reserva.push(it); delete r.equipo[b.dataset.quitar]; guardar(); pintarCuartel(); }
    }));
    raiz.querySelectorAll("[data-tirar]").forEach(b => b.addEventListener("click", () => {
      datos.reserva = datos.reserva.filter(x => x.id !== b.dataset.tirar); guardar(); pintarCuartel();
    }));
  }

  async function abrirFichas() {
    if (panel === "fichas") { panel = null; pintarCuartel(); return; }
    panel = "fichas"; fichasEstado = { cargando: true }; pintarCuartel();
    try {
      const sesion = await fichasSesionActual();
      if (!sesion) { fichasEstado = { error: "Inicia sesión (arriba a la derecha) para traer tus personajes." }; }
      else {
        const lista = await fichasStorageListar({ incluirArchivadas: true });
        lista.sort((a, b) => Number(esaCaido(b)) - Number(esaCaido(a)));
        fichasEstado = { lista };
      }
    } catch (e) {
      fichasEstado = { error: "No se pudieron cargar tus personajes." };
    }
    if (panel === "fichas") pintarCuartel();
  }

  /* --- Arena ------------------------------------------------------------------------- */
  let c = null;
  let modo = null; // { op, destinos, nivel }
  let hover = null;
  let ocupado = false;
  let combateId = 0;
  let flashes = [];
  const canvas = $("vhCanvas");
  const ctx = canvas.getContext("2d");
  let colores = {};

  function leerColores() {
    const css = getComputedStyle(document.documentElement);
    colores = { panel: css.getPropertyValue("--panel").trim() || "#1e2022", panel2: css.getPropertyValue("--panel-2").trim() || "#232527", borde: css.getPropertyValue("--border").trim() || "#333", texto: css.getPropertyValue("--text").trim() || "#ddd", tenue: css.getPropertyValue("--muted").trim() || "#888" };
  }

  function empezarCombate() {
    const jugadores = datos.grupo.map(reg).filter(Boolean).map(r => VH.unidadDesdeRegistro(r));
    if (!jugadores.length) return;
    const enemigos = VH.generarEncuentro(jugadores, datos.dificultad);
    c = VH.crearCombate(jugadores, enemigos);
    c.participantes = jugadores.map(u => u.id);
    c.enemigosIniciales = enemigos.slice();
    modo = null; hover = null; flashes = []; ocupado = false; combateId++;
    leerColores();
    canvas.style.aspectRatio = `${c.ancho} / ${c.alto}`;
    $("vhCuartel").classList.add("hidden");
    $("vhResultado").classList.add("hidden");
    $("vhCombate").classList.remove("hidden");
    ajustarCanvas();
    c.empezar();
    c.log.length = 0;
    c.log.push({ msg: `${c.mapaNombre}. Combate: ${enemigos.map(e => e.nombre).join(", ")}.`, tipo: "ronda" });
    pintarTodo();
    siguiente();
  }

  function ajustarCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const caja = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(caja.width * dpr));
    canvas.height = Math.max(1, Math.round(caja.height * dpr));
  }
  window.addEventListener("resize", () => { if (c) ajustarCanvas(); });

  function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

  function siguiente() {
    if (!c) return;
    if (c.fin) { setTimeout(() => { if (c && c.fin) terminarCombate(); }, 900); return; }
    const u = c.activo;
    pintarTodo();
    if (u.equipo === "enemigos") turnoEnemigo();
    else if (c.opciones(u).every(o => !o.ok) && u.turno.mov === 0) {
      // paralizado, aturdido o sin nada que hacer: se pasa solo
      const id = combateId;
      setTimeout(() => { if (id === combateId && c && c.activo === u && !c.fin) { c.terminarTurno(); siguiente(); } }, 900);
    }
  }

  async function turnoEnemigo() {
    if (ocupado) return;
    ocupado = true;
    const id = combateId;
    const u = c.activo;
    await esperar(550);
    let guarda = 0;
    while (id === combateId && !c.fin && c.activo === u && guarda++ < 24) {
      const p = c.siguientePasoIA();
      if (!p) break;
      if (p.tipo === "mover") { c.mover(u, p.x, p.y); pintarTodo(); await esperar(520); }
      else {
        if (p.destino.area) flashes.push({ celdas: p.destino.area, t: 0 });
        c.ejecutar(u, p.op, p.destino, p.nivel);
        pintarTodo();
        await esperar(780);
      }
    }
    if (id !== combateId) return;
    ocupado = false;
    if (!c.fin) c.terminarTurno();
    siguiente();
  }

  /* --- Paneles de la arena ------------------------------------------------------------ */
  function pintarTodo() {
    pintarOrden(); pintarAcciones(); pintarFicha(); pintarLog();
  }

  function pintarOrden() {
    $("vhOrden").innerHTML = c.orden.map(id => {
      const u = c.unidades.find(x => x.id === id);
      const muerto = u.muerto || u.caido;
      return `<span class="vh-orden-chip ${u === c.activo ? "activo" : ""} ${muerto ? "caido" : ""} ${u.equipo === "enemigos" ? "enemigo" : ""}" style="--c:${u.color}" title="${esc(u.nombre)}"><i></i>${esc(u.nombre.split(" ")[0])}</span>`;
    }).join("") + `<span class="vh-ronda">${esc(c.mapaNombre)} · Ronda ${c.ronda}</span><button type="button" class="vh-mini" id="vhHuir">Abandonar combate</button>`;
    $("vhHuir").addEventListener("click", abandonar);
  }

  function pintarLog() {
    const l = $("vhLog");
    l.innerHTML = c.log.slice(-60).map(e => `<li class="${e.tipo}">${esc(e.msg)}</li>`).join("");
    l.scrollTop = l.scrollHeight;
  }

  function barraPv(u) {
    const pct = Math.max(0, Math.round((u.pv / u.pvMax) * 100));
    return `<div class="vh-pv"><span style="width:${pct}%"></span></div><small>${u.pv} / ${u.pvMax} PV · CA ${u.ca}</small>`;
  }

  function pintarFicha() {
    const cel = hover && c.unidadEn(hover.x, hover.y);
    const u = cel || c.activo;
    const conds = Object.keys(u.cond).map(n => `<span class="vh-cond" title="${esc(VH.CONDICIONES[n] || "")}">${esc(n)}</span>`).join("");
    const rasgos = u.equipo === "enemigos" && u.rasgos.length ? `<details><summary>Rasgos</summary><ul class="vh-lista">${u.rasgos.map(t => `<li><small>${esc(t)}</small></li>`).join("")}</ul></details>` : "";
    $("vhFicha").innerHTML = `
      <h3 style="color:${u.color}">${esc(u.nombre)} <small>nv. ${u.nivel}</small></h3>
      ${barraPv(u)}
      <p class="vh-sub">${esc(u.clase || "")} · Vel. ${c.velocidadActual(u)}${u.muerto ? " · derrotado" : u.caido ? " · inconsciente" : ""}</p>
      ${conds ? `<p>${conds}</p>` : ""}${rasgos}`;
  }

  let nivelElegido = 0;

  function pintarAcciones() {
    const cont = $("vhAcciones");
    const u = c.activo;
    if (c.fin) { cont.innerHTML = `<p class="vh-estado">${c.fin === "victoria" ? "¡Victoria!" : "Derrota"}</p>`; return; }
    if (u.equipo === "enemigos") { cont.innerHTML = `<p class="vh-estado">Turno de ${esc(u.nombre)}…</p>`; return; }
    const t = u.turno;
    const ops = c.opciones(u);
    const espacios = u.espacios.map((n, i) => `<span class="${u.usados[i] >= n ? "gastado" : ""}">${i + 1}º ${n - u.usados[i]}/${n}</span>`).join("");
    const libres = u.espacios.length ? [...new Set(ops.filter(o => o.conjuro && o.conjuro.nivel > 0 && o.ok).flatMap(o => c.espaciosLibres(u, o.conjuro.nivel)))].sort() : [];
    const boton = o => `<button type="button" class="vh-op ${o.ok ? "" : "off"} ${modo && modo.op.clave === o.clave ? "elegida" : ""}" data-op="${o.clave}" ${o.ok ? "" : `title="${esc(o.motivo)}"`}>
        <strong>${esc(o.nombre)}</strong><small>${o.costo === "bonus" ? "adicional · " : o.costo === "libre" ? "libre · " : ""}${esc(o.info || "")}</small></button>`;
    const acciones = ops.filter(o => !o.conjuro);
    const conjuros = ops.filter(o => o.conjuro).sort((a, b) => a.nivel - b.nivel);
    const paladin = u.acciones.some(a => a.castigo);
    cont.innerHTML = `
      <div class="vh-recursos">
        <span>Movimiento <b>${t.mov}</b></span>
        <span class="${t.accion > 0 || t.ataquesExtra > 0 ? "" : "gastado"}">Acción <b>${t.accion > 0 ? "●" : t.ataquesExtra > 0 ? `+${t.ataquesExtra} ataque` : "○"}</b></span>
        <span class="${t.bonus ? "" : "gastado"}">Adicional <b>${t.bonus ? "●" : "○"}</b></span>
        ${espacios ? `<span class="vh-espacios">Espacios: ${espacios}</span>` : ""}
        ${libres.length > 1 ? `<label>Lanzar con espacio <select id="vhNivel"><option value="0">el más bajo</option>${libres.map(n => `<option value="${n}" ${nivelElegido === n ? "selected" : ""}>nivel ${n}</option>`).join("")}</select></label>` : ""}
        ${paladin ? `<button type="button" class="vh-mini ${u.castigoActivo ? "elegida" : ""}" id="vhCastigo">Castigo divino: ${u.castigoActivo ? "sí" : "no"}</button>` : ""}
      </div>
      <div class="vh-ops">${acciones.map(boton).join("")}</div>
      ${conjuros.length ? `<div class="vh-ops conjuros">${conjuros.map(boton).join("")}</div>` : ""}
      <div class="vh-pie">
        <button type="button" class="vh-boton vh-principal" id="vhFinTurno">Terminar turno</button>
      </div>`;
    cont.querySelectorAll("[data-op]").forEach(b => b.addEventListener("click", () => elegirOp(b.dataset.op)));
    $("vhFinTurno").addEventListener("click", finTurno);
    const sel = $("vhNivel");
    if (sel) sel.addEventListener("change", () => { nivelElegido = parseInt(sel.value, 10) || 0; });
    const cast = $("vhCastigo");
    if (cast) cast.addEventListener("click", () => { u.castigoActivo = !u.castigoActivo; pintarAcciones(); });
    $("vhPista").textContent = modo ? "Elige el objetivo en el tablero. Esc para cancelar." : "Haz clic en una casilla azul para moverte, o elige una acción.";
  }

  function elegirOp(clave) {
    if (ocupado || c.fin) return;
    const u = c.activo;
    const op = c.opciones(u).find(o => o.clave === clave);
    if (!op || !op.ok) return;
    if (modo && modo.op.clave === clave) { modo = null; pintarAcciones(); return; }
    const nivel = op.conjuro && op.conjuro.nivel > 0 ? nivelElegido : 0;
    const destinos = c.destinosDesde(u, op, { x: u.x, y: u.y }, nivel);
    if (!destinos.length) { aviso("No hay objetivos al alcance."); return; }
    if (destinos.length === 1 && destinos[0].propio) { ejecutar(op, destinos[0], nivel); return; }
    modo = { op, destinos, nivel };
    pintarAcciones();
  }

  let temporizadorAviso = 0;
  function aviso(txt) {
    const p = $("vhPista");
    p.textContent = txt;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { if (c) pintarAcciones(); }, 1800);
  }

  function ejecutar(op, destino, nivel) {
    const u = c.activo;
    if (destino.area) flashes.push({ celdas: destino.area, t: 0 });
    c.ejecutar(u, op, destino, nivel);
    modo = null;
    pintarTodo();
    if (c.fin) siguiente();
  }

  function finTurno() {
    if (ocupado || c.fin) return;
    modo = null;
    c.terminarTurno();
    siguiente();
  }

  function abandonar() {
    if (!confirm("¿Abandonar el combate? No ganas experiencia ni botín.")) return;
    combateId++; ocupado = false; c = null; modo = null;
    $("vhCombate").classList.add("hidden");
    $("vhCuartel").classList.remove("hidden");
    pintarCuartel();
  }

  /* El destino que corresponde a una casilla clicada (o sobrevolada). */
  function destinoEn(x, y) {
    if (!modo) return null;
    const ds = modo.destinos;
    if (ds[0] && ds[0].dirigido) {
      const u = c.activo;
      const ang = Math.atan2(y - u.y, x - u.x);
      let mejor = null, dif = 9;
      ds.forEach(d => {
        const a = Math.atan2(d.y - u.y, d.x - u.x);
        let k = Math.abs(a - ang);
        if (k > Math.PI) k = 2 * Math.PI - k;
        if (k < dif) { dif = k; mejor = d; }
      });
      return (x === u.x && y === u.y) ? null : mejor;
    }
    return ds.find(d => d.x === x && d.y === y) || null;
  }

  function celdaDe(ev) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * c.ancho);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * c.alto);
    return x >= 0 && y >= 0 && x < c.ancho && y < c.alto ? { x, y } : null;
  }

  canvas.addEventListener("mousemove", ev => { if (c) { hover = celdaDe(ev); pintarFichaSuave(); } });
  canvas.addEventListener("mouseleave", () => { hover = null; if (c) pintarFichaSuave(); });
  let ultimaFicha = "";
  function pintarFichaSuave() {
    const k = hover ? `${hover.x},${hover.y}` : "";
    if (k !== ultimaFicha) { ultimaFicha = k; pintarFicha(); }
  }

  canvas.addEventListener("click", ev => {
    if (!c || ocupado || c.fin) return;
    const u = c.activo;
    if (u.equipo !== "jugadores") return;
    const cel = celdaDe(ev);
    if (!cel) return;
    hover = cel;
    if (modo) {
      const d = destinoEn(cel.x, cel.y);
      if (d) ejecutar(modo.op, d, modo.nivel);
      else { modo = null; pintarAcciones(); }
      return;
    }
    if (c.mover(u, cel.x, cel.y)) { pintarTodo(); }
  });

  document.addEventListener("keydown", ev => {
    if (!c || $("vhCombate").classList.contains("hidden")) return;
    if (ev.key === "Escape" && modo) { modo = null; pintarAcciones(); }
    else if (ev.key === "Enter" && c.activo.equipo === "jugadores" && !(ev.target && /^(input|select|textarea|button)$/i.test(ev.target.tagName))) finTurno();
    else if (/^[1-9]$/.test(ev.key) && c.activo.equipo === "jugadores") {
      const ops = c.opciones(c.activo).filter(o => o.ok && !o.conjuro);
      const o = ops[parseInt(ev.key, 10) - 1];
      if (o) elegirOp(o.clave);
    }
  });

  /* --- Dibujo ------------------------------------------------------------------------------ */
  const posVisual = new Map();
  let ultimoCuadro = 0;

  function dibujar(ahora) {
    requestAnimationFrame(dibujar);
    const dt = Math.min(0.05, (ahora - ultimoCuadro) / 1000 || 0);
    ultimoCuadro = ahora;
    if (!c || $("vhCombate").classList.contains("hidden")) return;
    const W = c.ancho * TS, H = c.alto * TS;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const T = VH.TERRENO;

    for (let y = 0; y < c.alto; y++) for (let x = 0; x < c.ancho; x++) {
      ctx.fillStyle = (x + y) % 2 ? colores.panel : colores.panel2;
      ctx.fillRect(x * TS, y * TS, TS, TS);
      const t = c.terreno[y][x];
      if (t === T.ROCA) {
        ctx.fillStyle = "#4a4a48"; ctx.beginPath();
        ctx.moveTo(x * TS + 8, y * TS + TS - 8); ctx.lineTo(x * TS + 18, y * TS + 12); ctx.lineTo(x * TS + 40, y * TS + 6); ctx.lineTo(x * TS + TS - 8, y * TS + 24); ctx.lineTo(x * TS + TS - 12, y * TS + TS - 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(x * TS + 20, y * TS + 14, 14, 6);
      } else if (t === T.FUEGO) {
        const f = 0.5 + 0.5 * Math.sin(ahora / 160 + x * 2 + y);
        ctx.fillStyle = `rgba(255,${100 + 60 * f},40,.55)`; ctx.fillRect(x * TS + 4, y * TS + 4, TS - 8, TS - 8);
        ctx.fillStyle = `rgba(255,220,90,${0.4 + 0.3 * f})`; ctx.beginPath(); ctx.arc(x * TS + TS / 2, y * TS + TS / 2, 12 + 4 * f, 0, Math.PI * 2); ctx.fill();
      } else if (t === T.PINCHOS) {
        ctx.fillStyle = "#9aa0a6";
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x * TS + 10 + i * 20, y * TS + 20 + j * 18); ctx.lineTo(x * TS + 16 + i * 20, y * TS + 6 + j * 18); ctx.lineTo(x * TS + 22 + i * 20, y * TS + 20 + j * 18); ctx.fill(); }
      } else if (t === T.BARRO) {
        ctx.fillStyle = "rgba(110,80,50,.55)"; ctx.fillRect(x * TS + 2, y * TS + 2, TS - 4, TS - 4);
        ctx.fillStyle = "rgba(60,40,25,.6)"; ctx.beginPath(); ctx.ellipse(x * TS + 22, y * TS + 26, 10, 5, 0, 0, Math.PI * 2); ctx.ellipse(x * TS + 42, y * TS + 42, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,.04)"; ctx.lineWidth = 1;
    for (let x = 0; x <= c.ancho; x++) { ctx.beginPath(); ctx.moveTo(x * TS, 0); ctx.lineTo(x * TS, H); ctx.stroke(); }
    for (let y = 0; y <= c.alto; y++) { ctx.beginPath(); ctx.moveTo(0, y * TS); ctx.lineTo(W, y * TS); ctx.stroke(); }

    const activo = c.activo;
    const turnoJugador = activo && activo.equipo === "jugadores" && !ocupado && !c.fin;
    const celda = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2); };

    if (turnoJugador && !modo) {
      c.alcanzables(activo).forEach(i => { if (!(i.x === activo.x && i.y === activo.y)) celda(i.x, i.y, "rgba(90,150,255,.22)"); });
    }
    if (modo && turnoJugador) {
      modo.destinos.forEach(d => {
        if (d.dirigido) return;
        if (d.area) { celda(d.x, d.y, "rgba(255,255,255,.07)"); return; }
        const aliado = d.victimas[0] && d.victimas[0].equipo === activo.equipo;
        celda(d.x, d.y, d.teleport ? "rgba(170,120,255,.28)" : aliado ? "rgba(90,210,120,.3)" : "rgba(255,90,80,.3)");
      });
      const d = hover ? destinoEn(hover.x, hover.y) : null;
      if (d) {
        (d.area || []).forEach(k => celda(k.x, k.y, "rgba(255,160,50,.4)"));
        d.victimas.forEach(v => { ctx.strokeStyle = "#ffd36a"; ctx.lineWidth = 3; ctx.strokeRect(v.x * TS + 3, v.y * TS + 3, TS - 6, TS - 6); });
      }
    }
    flashes.forEach(f => { f.t += dt; const a = Math.max(0, 0.55 - f.t); f.celdas.forEach(k => celda(k.x, k.y, `rgba(255,170,60,${a})`)); });
    flashes = flashes.filter(f => f.t < 0.55);
    if (hover && !modo) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.strokeRect(hover.x * TS + 2, hover.y * TS + 2, TS - 4, TS - 4); }

    // unidades
    c.unidades.forEach(u => {
      if (u.muerto) return;
      let v = posVisual.get(u.id);
      if (!v) { v = { x: u.x, y: u.y }; posVisual.set(u.id, v); }
      const k = 1 - Math.pow(0.0009, dt);
      v.x += (u.x - v.x) * k; v.y += (u.y - v.y) * k;
      const px = v.x * TS + TS / 2, py = v.y * TS + TS / 2;
      ctx.globalAlpha = u.caido ? 0.35 : 1;
      if (u === activo && !c.fin) { ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, TS / 2 - 3, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = u.color; ctx.beginPath(); ctx.arc(px, py, TS / 2 - 9, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = u.equipo === "enemigos" ? "#7a1f1a" : "#2c5a3a"; ctx.stroke();
      ctx.fillStyle = "#101010"; ctx.font = "700 22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(u.nombre.trim().charAt(0).toUpperCase(), px, py + 1);
      // vida
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(px - 22, py + 26, 44, 6);
      ctx.fillStyle = u.pv / u.pvMax > 0.5 ? "#6fd07a" : u.pv / u.pvMax > 0.25 ? "#e6c14e" : "#e0645c";
      ctx.fillRect(px - 22, py + 26, 44 * Math.max(0, u.pv / u.pvMax), 6);
      // condiciones
      const conds = Object.keys(u.cond);
      conds.slice(0, 4).forEach((n, i) => { ctx.fillStyle = "#e0cf7a"; ctx.font = "700 10px sans-serif"; ctx.fillText(n.charAt(0).toUpperCase(), px - 22 + i * 12 + 6, py - 31); });
      ctx.globalAlpha = 1;
    });

    // textos flotantes
    c.flotantes.forEach(f => {
      f.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      ctx.fillStyle = f.color; ctx.font = "700 22px sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)";
      const x = f.x * TS + TS / 2, y = f.y * TS - 6 - f.t * 28;
      ctx.strokeText(f.msg, x, y); ctx.fillText(f.msg, x, y);
      ctx.globalAlpha = 1;
    });
    c.flotantes = c.flotantes.filter(f => f.t < 1.2);
  }
  requestAnimationFrame(dibujar);

  /* --- Fin del combate ------------------------------------------------------------------------ */
  function terminarCombate() {
    const gano = c.fin === "victoria";
    const participantes = c.participantes.map(reg).filter(Boolean);
    const xpTotal = c.unidades.filter(u => u.equipo === "enemigos").reduce((t, u) => t + VH.xpEnemigo(u.nivel), 0);
    const xpPor = Math.round((gano ? xpTotal : xpTotal * 0.2) / Math.max(1, participantes.length));
    const lineas = [];
    participantes.forEach(r => {
      const antes = r.nivel;
      r.xp += xpPor;
      if (gano) r.victorias++; else r.derrotas++;
      const nuevo = VH.nivelPorXp(r.xp);
      for (let n = antes + 1; n <= nuevo; n++) {
        r.nivel = n;
        if (VH.NIVELES_MEJORA.includes(n)) r.mejoras += 2;
      }
      lineas.push({ nombre: r.nombre, antes, ahora: r.nivel, mejoras: VH.NIVELES_MEJORA.filter(n => n > antes && n <= r.nivel).length * 2, xp: xpPor });
    });
    const botin = [];
    if (gano) {
      c.unidades.filter(u => u.equipo === "enemigos").forEach(e => {
        const prob = 0.4 + Math.min(0.3, e.nivel * 0.03);
        if (botin.length < 4 && Math.random() < prob) botin.push(VH.generarObjeto(e.nivel));
      });
      if (!botin.length) botin.push(VH.generarObjeto(Math.max(...c.unidades.filter(u => u.equipo === "enemigos").map(u => u.nivel))));
      botin.forEach(it => datos.reserva.push(it));
    }
    guardar();
    c = null; combateId++; ocupado = false; modo = null;
    $("vhCombate").classList.add("hidden");
    const res = $("vhResultado");
    res.classList.remove("hidden");
    res.innerHTML = `
      <div class="vh-panel vh-resultado ${gano ? "gana" : "pierde"}">
        <h2>${gano ? "Victoria" : "Derrota"}</h2>
        <p class="vh-sub">${gano ? "Los einherjar vuelven al salón." : "Valhalla los levanta de nuevo. Se llevan una parte de la experiencia."}</p>
        <ul class="vh-lista">${lineas.map(l => `<li><strong>${esc(l.nombre)}</strong>: +${l.xp} XP${l.ahora > l.antes ? ` · <b class="vh-aviso">¡Nivel ${l.ahora}!</b>${l.mejoras ? ` (+${l.mejoras} mejoras)` : ""}` : ""}</li>`).join("")}</ul>
        ${botin.length ? `<h4>Botín</h4><div class="vh-reserva">${botin.map(it => `<div class="vh-objeto"><span><strong>${esc(VH.nombreObjeto(it))}</strong> <small>${esc(it.tipo)}</small><br><small>${esc(descripcionObjeto(it))}</small></span></div>`).join("")}</div>` : ""}
        <div class="vh-botones-fila"><button type="button" class="vh-boton vh-principal" id="vhVolver">Volver al salón</button></div>
      </div>`;
    $("vhVolver").addEventListener("click", () => { res.classList.add("hidden"); $("vhCuartel").classList.remove("hidden"); pintarCuartel(); });
  }

  VH.depurar = () => c;
  pintarCuartel();
})();
