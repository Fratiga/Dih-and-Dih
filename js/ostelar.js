/* =============================================================================
   OSTELAR — pantallas. Cuartel (grupo, nivel, equipo), arena (el combate se
   dibuja en un canvas y se maneja con clic) y resultado (XP, niveles, botín).
   Las reglas viven en ostelar-reglas / datos / combate; aquí solo se muestra
   y se pasan órdenes al motor.
============================================================================= */
(function () {
  const OS = window.OS;
  const CLAVE = "compendioOstelar";
  const TS = 64;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const ATRIBUTOS = [["fue", "FUE"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]];

  /* --- Guardado ------------------------------------------------------------- */
  let datos = { alzados: [], reserva: [], grupo: [], dificultad: "normal" };
  try {
    let g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (!g) {
      // guardado de cuando la arena tenía otro nombre
      const viejo = JSON.parse(localStorage.getItem("compendioValhalla") || "null");
      if (viejo && Array.isArray(viejo.einherjar)) {
        viejo.alzados = viejo.einherjar;
        delete viejo.einherjar;
        viejo.alzados.forEach(r => { r.nombre = String(r.nombre || "").replace(/ de Valhalla$/, " de Ostelar"); });
        g = viejo;
      }
    }
    if (g && Array.isArray(g.alzados)) datos = Object.assign(datos, g);
  } catch (e) { /* sin almacenamiento */ }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* sin almacenamiento */ }
  }
  const reg = id => datos.alzados.find(r => r.id === id);

  /* --- Cuartel ------------------------------------------------------------------- */
  let seleccionado = null;
  let panel = null; // "nuevo" | "fichas"
  let fichasEstado = null; // { cargando } | { lista } | { error }

  function barraXp(r) {
    if (r.nivel >= OS.NIVEL_MAX) return `<div class="os-xp"><span style="width:100%"></span></div><small>Nivel máximo</small>`;
    const a = OS.XP_PARA_NIVEL[r.nivel], b = OS.XP_PARA_NIVEL[r.nivel + 1];
    const pct = Math.max(0, Math.min(100, Math.round(((r.xp - a) / (b - a)) * 100)));
    return `<div class="os-xp"><span style="width:${pct}%"></span></div><small>${r.xp - a} / ${b - a} XP</small>`;
  }

  function resumen(r) {
    try {
      const u = OS.unidadDesdeRegistro(r);
      return `PV ${u.pvMax} · CA ${u.ca} · Vel. ${u.vel}`;
    } catch (e) { return ""; }
  }

  function pintarCuartel() {
    const grupo = datos.grupo.map(reg).filter(Boolean);
    const lista = datos.alzados.map(r => `
      <article class="os-carta ${seleccionado === r.id ? "activa" : ""} ${datos.grupo.includes(r.id) ? "en-grupo" : ""}" data-id="${r.id}">
        <h3>${esc(r.nombre)}</h3>
        <p class="os-sub">${esc(r.origen === "ficha" ? (r.ficha.identidad.clase || "Personaje") : OS.CLASES[r.claseId].nombre)} · nivel ${r.nivel}${r.mejoras ? ` · <b class="os-aviso">${r.mejoras} mejoras</b>` : ""}</p>
        ${barraXp(r)}
        <p class="os-sub">${esc(resumen(r))}</p>
        <button type="button" class="os-mini" data-grupo="${r.id}">${datos.grupo.includes(r.id) ? "Sacar del grupo" : "Al grupo"}</button>
      </article>`).join("");

    $("osCuartel").innerHTML = `
      <p class="os-intro">Aquí se pelea y nada más. Elige a tus alzados, ponlos en el grupo y entra a la arena. Suben de nivel y encuentran equipo con cada victoria, hasta el nivel 20.</p>
      <div class="os-barra-grupo">
        <div class="os-grupo">
          <strong>Grupo (${grupo.length}/4)</strong>
          ${grupo.map(r => `<span class="os-chip" style="--c:${r.color}">${esc(r.nombre)} <small>nv. ${r.nivel}</small></span>`).join("") || `<span class="os-vacio">Nadie todavía</span>`}
        </div>
        <label>Dificultad
          <select id="osDificultad">${Object.entries(OS.dificultades).map(([id, d]) => `<option value="${id}" ${datos.dificultad === id ? "selected" : ""}>${d.nombre}</option>`).join("")}</select>
        </label>
        <button type="button" class="os-boton os-principal" id="osEntrar" ${grupo.length ? "" : "disabled"}>Entrar a la arena</button>
      </div>
      <div class="os-botones-fila">
        <button type="button" class="os-boton" id="osNuevo">+ Nuevo alzado</button>
        <button type="button" class="os-boton" id="osFichas">Traer un personaje mío</button>
      </div>
      <div id="osPanel">${pintarPanel()}</div>
      <div class="os-salon">${lista || `<p class="os-vacio">El salón está vacío. Crea un alzado o trae uno de tus personajes.</p>`}</div>
      <div id="osDetalle">${pintarDetalle()}</div>`;
    cablearCuartel();
  }

  function pintarPanel() {
    if (panel === "nuevo") {
      return `<div class="os-panel"><h3>Elige una clase</h3>
        <div class="os-clases">${Object.entries(OS.CLASES).map(([id, c]) => `
          <button type="button" class="os-clase" data-clase="${id}"><strong>${c.nombre}</strong><span>${esc(c.desc)}</span><small>d${c.dado} de vida</small></button>`).join("")}</div>
        <label class="os-campo">Nombre (opcional)<input id="osNombreNuevo" maxlength="40" placeholder="Se llamará «Clase de Ostelar»"></label></div>`;
    }
    if (panel === "fichas") {
      const f = fichasEstado || {};
      if (f.cargando) return `<div class="os-panel"><p>Buscando tus personajes…</p></div>`;
      if (f.error) return `<div class="os-panel"><p class="os-aviso">${esc(f.error)}</p></div>`;
      if (!f.lista || !f.lista.length) return `<div class="os-panel"><p>No tienes personajes en tus fichas.</p></div>`;
      return `<div class="os-panel"><h3>Tus personajes</h3>
        <p class="os-sub">Se trae una copia. Tu ficha original no se toca, y lo que pase en Ostelar se queda en Ostelar.</p>
        <div class="os-fichas">${f.lista.map(p => `
          <div class="os-ficha-fila">
            <span><strong>${esc(p.identidad.nombre || "Sin nombre")}</strong> <small>${esc([p.identidad.raza, p.identidad.clase].filter(Boolean).join(" · "))} · nivel ${p.identidad.nivelTotal || 1}</small>
            ${esaCaido(p) ? `<span class="os-etiqueta">Caído</span>` : ""}</span>
            <button type="button" class="os-mini" data-traer="${p.id}">Traer</button>
          </div>`).join("")}</div></div>`;
    }
    return "";
  }

  function esaCaido(p) {
    return !!(p.archivado || (p.combate && (p.combate.salvMuerte || {}).fallos >= 3) || (p.combate && Number(p.combate.pvMax) > 0 && Number(p.combate.pvActual) <= 0));
  }

  function pintarDetalle() {
    const r = reg(seleccionado);
    if (!r) return datos.reserva.length ? `<h3 class="os-subtitulo">Reserva</h3>${pintarReserva(null)}` : "";
    let u;
    try { u = OS.unidadDesdeRegistro(r); } catch (e) { return `<p class="os-aviso">No se pudo leer este personaje: ${esc(e.message)}</p>`; }
    const puntos = r.mejoras > 0;
    const eq = r.equipo || {};
    const casilla = (nombre, it, tipo) => `<div class="os-eq"><span>${nombre}</span><strong>${it ? esc(OS.nombreObjeto(it)) : "—"}</strong>${it ? `<button type="button" class="os-mini" data-quitar="${tipo}">Quitar</button>` : ""}</div>`;
    const conj = u.conjuros.map(cj => cj.nombre + (cj.nivel ? ` (${cj.nivel})` : "")).join(", ");
    return `
      <div class="os-panel os-detalle">
        <div class="os-detalle-cab">
          <div><h2>${esc(r.nombre)}</h2><p class="os-sub">${esc(u.clase || "")} · nivel ${r.nivel} · ${r.victorias} victorias, ${r.derrotas} derrotas</p></div>
          <div class="os-botones-fila">
            <button type="button" class="os-mini" data-renombrar="${r.id}">Renombrar</button>
            ${r.origen === "predeterminado" && puntos ? `<button type="button" class="os-mini" data-auto="${r.id}">Repartir mejoras</button>` : ""}
            <button type="button" class="os-mini peligro" data-borrar="${r.id}">Eliminar</button>
          </div>
        </div>
        <div class="os-stats">
          <div><span>PV</span><strong>${u.pvMax}</strong></div>
          <div><span>CA</span><strong>${u.ca}</strong></div>
          <div><span>Velocidad</span><strong>${u.vel} casillas</strong></div>
          <div><span>Competencia</span><strong>${OS.signo(u.comp)}</strong></div>
          <div><span>Ataques por acción</span><strong>${u.ataquesPorAccion}</strong></div>
        </div>
        <div class="os-atributos">${ATRIBUTOS.map(([id, n]) => `
          <div class="os-atr"><span>${n}</span><strong>${OS.signo(u.mod[id])}</strong>${puntos ? `<button type="button" class="os-mini" data-mejora="${id}">+1</button>` : ""}</div>`).join("")}</div>
        ${puntos ? `<p class="os-aviso">Tienes ${r.mejoras} puntos de mejora para repartir.</p>` : ""}
        <h4>Ataques y habilidades</h4>
        <ul class="os-lista">${u.acciones.filter(a => a.tipo !== "especial").map(a => `<li><strong>${esc(a.nombre)}</strong>${a.ataque !== undefined && a.ataque !== null ? ` ${OS.signo(a.ataque)}` : ""} ${esc((a.danos || []).map(d => `${d.f} ${d.t}`).join(" + "))}${a.desc ? ` <small>${esc(a.desc)}</small>` : ""}</li>`).join("")}</ul>
        ${u.espacios.length ? `<h4>Magia</h4><p class="os-sub">Espacios: ${u.espacios.map((n, i) => `nv. ${i + 1}: ${n}`).join(" · ")} · CD ${u.lanz.cd} · ataque ${OS.signo(u.lanz.ataque)}</p><p class="os-sub">${esc(conj)}</p>` : (u.conjuros.length ? `<h4>Conjuros</h4><p class="os-sub">${esc(conj)}</p>` : "")}
        ${u.rasgos.length ? `<h4>Rasgos</h4><ul class="os-lista">${u.rasgos.map(t => `<li><small>${esc(t)}</small></li>`).join("")}</ul>` : ""}
        ${u.notas.length ? `<p class="os-sub">Sin automatizar todavía: ${esc(u.notas.join("; "))}</p>` : ""}
        <h4>Equipo</h4>
        <div class="os-equipo">${casilla("Arma", eq.arma, "arma")}${casilla("Armadura", eq.armadura, "armadura")}${casilla("Escudo", eq.escudo, "escudo")}${casilla("Accesorio", eq.accesorio, "accesorio")}</div>
        ${pintarReserva(r)}
      </div>`;
  }

  function descripcionObjeto(it) {
    const partes = [];
    if (it.tipo === "arma") { const a = OS.arma(it.base); if (a) partes.push(`${a.dano} ${a.tipoDano}`); }
    if (it.tipo === "armadura") { const a = OS.ARMADURAS.find(x => x.id === it.base); if (a) partes.push(`CA ${a.base + (it.bonus || 0)}`); }
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
    if (!datos.reserva.length) return `<p class="os-sub">La reserva está vacía. El botín sale de los enemigos derrotados.</p>`;
    return `<h4>Reserva</h4><div class="os-reserva">${datos.reserva.map(it => `
      <div class="os-objeto"><span><strong>${esc(OS.nombreObjeto(it))}</strong> <small>${esc(it.tipo)}</small><br><small>${esc(descripcionObjeto(it))}</small></span>
      ${r ? `<button type="button" class="os-mini" data-equipar="${it.id}">Equipar</button>` : ""}
      <button type="button" class="os-mini peligro" data-tirar="${it.id}" title="Descartar">✕</button></div>`).join("")}</div>`;
  }

  function cablearCuartel() {
    $("osDificultad").addEventListener("change", ev => { datos.dificultad = ev.target.value; guardar(); });
    $("osEntrar").addEventListener("click", empezarCombate);
    $("osNuevo").addEventListener("click", () => { panel = panel === "nuevo" ? null : "nuevo"; pintarCuartel(); });
    $("osFichas").addEventListener("click", abrirFichas);
    const raiz = $("osCuartel");
    raiz.querySelectorAll("[data-clase]").forEach(b => b.addEventListener("click", () => {
      const nombre = ($("osNombreNuevo").value || "").trim();
      const r = OS.registroPredeterminado(b.dataset.clase, nombre);
      datos.alzados.push(r);
      if (datos.grupo.length < 4) datos.grupo.push(r.id);
      seleccionado = r.id; panel = null; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-traer]").forEach(b => b.addEventListener("click", () => {
      const p = fichasEstado.lista.find(x => x.id === b.dataset.traer);
      if (!p) return;
      const r = OS.registroDesdeFicha(p);
      datos.alzados.push(r);
      if (datos.grupo.length < 4) datos.grupo.push(r.id);
      seleccionado = r.id; panel = null; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll(".os-carta").forEach(carta => carta.addEventListener("click", ev => {
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
      if (r.origen === "predeterminado" && (OS.CLASES[r.claseId].atr[b.dataset.mejora] + (r.bonosAtr[b.dataset.mejora] || 0)) >= 20) return;
      r.bonosAtr[b.dataset.mejora] = (r.bonosAtr[b.dataset.mejora] || 0) + 1;
      r.mejoras--; guardar(); pintarCuartel();
    }));
    raiz.querySelectorAll("[data-auto]").forEach(b => b.addEventListener("click", () => { OS.repartirMejorasAuto(reg(b.dataset.auto)); guardar(); pintarCuartel(); }));
    raiz.querySelectorAll("[data-renombrar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(b.dataset.renombrar);
      const n = prompt("Nuevo nombre", r.nombre);
      if (n && n.trim()) { r.nombre = n.trim().slice(0, 40); guardar(); pintarCuartel(); }
    }));
    raiz.querySelectorAll("[data-borrar]").forEach(b => b.addEventListener("click", () => {
      const r = reg(b.dataset.borrar);
      if (!confirm(`¿Eliminar a ${r.nombre} para siempre? Su equipo vuelve a la reserva.`)) return;
      Object.values(r.equipo || {}).forEach(it => { if (it) datos.reserva.push(it); });
      datos.alzados = datos.alzados.filter(x => x.id !== r.id);
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
  let ultimoTurnoId = null;
  const canvas = $("osCanvas");
  const ctx = canvas.getContext("2d");
  let colores = {};

  function leerColores() {
    const css = getComputedStyle(document.documentElement);
    colores = { panel: css.getPropertyValue("--panel").trim() || "#1e2022", panel2: css.getPropertyValue("--panel-2").trim() || "#232527", borde: css.getPropertyValue("--border").trim() || "#333", texto: css.getPropertyValue("--text").trim() || "#ddd", tenue: css.getPropertyValue("--muted").trim() || "#888" };
  }

  function empezarCombate() {
    const jugadores = datos.grupo.map(reg).filter(Boolean).map(r => OS.unidadDesdeRegistro(r));
    if (!jugadores.length) return;
    const enemigos = OS.generarEncuentro(jugadores, datos.dificultad);
    c = OS.crearCombate(jugadores, enemigos);
    c.participantes = jugadores.map(u => u.id);
    c.enemigosIniciales = enemigos.slice();
    modo = null; hover = null; flashes = []; ocupado = false; combateId++;
    leerColores();
    canvas.style.aspectRatio = `${c.ancho} / ${c.alto}`;
    escena.reiniciar(c);
    ultimoTurnoId = null;
    $("osCuartel").classList.add("hidden");
    $("osResultado").classList.add("hidden");
    $("osCombate").classList.remove("hidden");
    ajustarCanvas();
    c.empezar();
    c.log.length = 0;
    c.log.push({ msg: `${c.mapaNombre}. Combate: ${enemigos.map(e => e.nombre).join(", ")}.`, tipo: "ronda" });
    pintarTodo();
    cartel("¡A la arena!", enemigos.map(e => e.nombre).join(" · "), "inicio", 2000);
    setTimeout(siguiente, 1400);
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
    if (c.fin) {
      if (!c.cartelFin) { c.cartelFin = true; cartel(c.fin === "victoria" ? "¡Victoria!" : "Derrota", c.fin === "victoria" ? "La arena es tuya" : "Ostelar los levantará", c.fin === "victoria" ? "victoria" : "derrota", 2400); }
      setTimeout(() => { if (c && c.fin) terminarCombate(); }, 2300);
      return;
    }
    const u = c.activo;
    pintarTodo();
    if (u.id !== ultimoTurnoId) {
      ultimoTurnoId = u.id;
      if (u.equipo === "enemigos") cartel(u.nombre, "Turno del enemigo", "enemigo", 1100);
      else cartel(u.nombre, "Tu turno", "aliado", 1000);
    }
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
    $("osOrden").innerHTML = c.orden.map(id => {
      const u = c.unidades.find(x => x.id === id);
      const muerto = u.muerto || u.caido;
      return `<span class="os-orden-chip ${u === c.activo ? "activo" : ""} ${muerto ? "caido" : ""} ${u.equipo === "enemigos" ? "enemigo" : ""}" style="--c:${u.color}" title="${esc(u.nombre)}"><i></i>${esc(u.nombre.split(" ")[0])}</span>`;
    }).join("") + `<span class="os-ronda">${esc(c.mapaNombre)} · Ronda ${c.ronda}</span><button type="button" class="os-mini" id="osHuir">Abandonar combate</button>`;
    $("osHuir").addEventListener("click", abandonar);
  }

  function pintarLog() {
    const l = $("osLog");
    l.innerHTML = c.log.slice(-60).map(e => `<li class="${e.tipo}">${esc(e.msg)}</li>`).join("");
    l.scrollTop = l.scrollHeight;
  }

  function barraPv(u) {
    const pct = Math.max(0, Math.round((u.pv / u.pvMax) * 100));
    return `<div class="os-pv"><span style="width:${pct}%"></span></div><small>${u.pv} / ${u.pvMax} PV · CA ${u.ca}</small>`;
  }

  function pintarFicha() {
    const cel = hover && c.unidadEn(hover.x, hover.y);
    const u = cel || c.activo;
    const conds = Object.keys(u.cond).map(n => `<span class="os-cond" title="${esc(OS.CONDICIONES[n] || "")}">${esc(n)}</span>`).join("");
    const rasgos = u.equipo === "enemigos" && u.rasgos.length ? `<details><summary>Rasgos</summary><ul class="os-lista">${u.rasgos.map(t => `<li><small>${esc(t)}</small></li>`).join("")}</ul></details>` : "";
    $("osFicha").innerHTML = `
      <h3 style="color:${u.color}">${esc(u.nombre)} <small>nv. ${u.nivel}</small></h3>
      ${barraPv(u)}
      <p class="os-sub">${esc(u.clase || "")} · Vel. ${c.velocidadActual(u)}${u.muerto ? " · derrotado" : u.caido ? " · inconsciente" : ""}</p>
      ${conds ? `<p>${conds}</p>` : ""}${rasgos}`;
  }

  let nivelElegido = 0;

  function pintarAcciones() {
    const cont = $("osAcciones");
    const u = c.activo;
    if (c.fin) { cont.innerHTML = `<p class="os-estado">${c.fin === "victoria" ? "¡Victoria!" : "Derrota"}</p>`; return; }
    if (u.equipo === "enemigos") { cont.innerHTML = `<p class="os-estado">Turno de ${esc(u.nombre)}…</p>`; return; }
    const t = u.turno;
    const ops = c.opciones(u);
    const espacios = u.espacios.map((n, i) => `<span class="${u.usados[i] >= n ? "gastado" : ""}">${i + 1}º ${n - u.usados[i]}/${n}</span>`).join("");
    const libres = u.espacios.length ? [...new Set(ops.filter(o => o.conjuro && o.conjuro.nivel > 0 && o.ok).flatMap(o => c.espaciosLibres(u, o.conjuro.nivel)))].sort() : [];
    const boton = o => `<button type="button" class="os-op ${o.ok ? "" : "off"} ${modo && modo.op.clave === o.clave ? "elegida" : ""}" data-op="${o.clave}" ${o.ok ? "" : `title="${esc(o.motivo)}"`}>
        <strong>${esc(o.nombre)}</strong><small>${o.costo === "bonus" ? "adicional · " : o.costo === "libre" ? "libre · " : ""}${esc(o.info || "")}</small></button>`;
    const acciones = ops.filter(o => !o.conjuro);
    const conjuros = ops.filter(o => o.conjuro).sort((a, b) => a.nivel - b.nivel);
    const paladin = u.acciones.some(a => a.castigo);
    cont.innerHTML = `
      <div class="os-recursos">
        <span>Movimiento <b>${t.mov}</b></span>
        <span class="${t.accion > 0 || t.ataquesExtra > 0 ? "" : "gastado"}">Acción <b>${t.accion > 0 ? "●" : t.ataquesExtra > 0 ? `+${t.ataquesExtra} ataque` : "○"}</b></span>
        <span class="${t.bonus ? "" : "gastado"}">Adicional <b>${t.bonus ? "●" : "○"}</b></span>
        ${espacios ? `<span class="os-espacios">Espacios: ${espacios}</span>` : ""}
        ${libres.length > 1 ? `<label>Lanzar con espacio <select id="osNivel"><option value="0">el más bajo</option>${libres.map(n => `<option value="${n}" ${nivelElegido === n ? "selected" : ""}>nivel ${n}</option>`).join("")}</select></label>` : ""}
        ${paladin ? `<button type="button" class="os-mini ${u.castigoActivo ? "elegida" : ""}" id="osCastigo">Castigo divino: ${u.castigoActivo ? "sí" : "no"}</button>` : ""}
      </div>
      <div class="os-ops">${acciones.map(boton).join("")}</div>
      ${conjuros.length ? `<div class="os-ops conjuros">${conjuros.map(boton).join("")}</div>` : ""}
      <div class="os-pie">
        <button type="button" class="os-boton os-principal" id="osFinTurno">Terminar turno</button>
      </div>`;
    cont.querySelectorAll("[data-op]").forEach(b => b.addEventListener("click", () => elegirOp(b.dataset.op)));
    $("osFinTurno").addEventListener("click", finTurno);
    const sel = $("osNivel");
    if (sel) sel.addEventListener("change", () => { nivelElegido = parseInt(sel.value, 10) || 0; });
    const cast = $("osCastigo");
    if (cast) cast.addEventListener("click", () => { u.castigoActivo = !u.castigoActivo; pintarAcciones(); });
    $("osPista").textContent = modo ? "Elige el objetivo en el tablero. Esc para cancelar." : "Haz clic en una casilla azul para moverte, o elige una acción.";
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
    const p = $("osPista");
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
    $("osCombate").classList.add("hidden");
    $("osCuartel").classList.remove("hidden");
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
    if (!c || $("osCombate").classList.contains("hidden")) return;
    if (ev.key === "Escape" && modo) { modo = null; pintarAcciones(); }
    else if (ev.key === "Enter" && c.activo.equipo === "jugadores" && !(ev.target && /^(input|select|textarea|button)$/i.test(ev.target.tagName))) finTurno();
    else if (/^[1-9]$/.test(ev.key) && c.activo.equipo === "jugadores") {
      const ops = c.opciones(c.activo).filter(o => o.ok && !o.conjuro);
      const o = ops[parseInt(ev.key, 10) - 1];
      if (o) elegirOp(o.clave);
    }
  });

  /* --- Dibujo: lo hace la escena (js/ostelar-escena.js) ---------------------------- */
  const escena = OS.crearEscena(canvas);
  let ultimoCuadro = 0;
  let cacheAlcance = { clave: "", mapa: null };

  function alcanceActual() {
    const u = c.activo;
    if (!u || !u.turno) return null;
    const clave = `${u.id}:${u.x},${u.y}:${u.turno.mov}:${c.version}`;
    if (cacheAlcance.clave !== clave) cacheAlcance = { clave, mapa: c.alcanzables(u) };
    return cacheAlcance.mapa;
  }

  function dibujar(ahora) {
    requestAnimationFrame(dibujar);
    const dt = Math.min(0.05, (ahora - ultimoCuadro) / 1000 || 0);
    ultimoCuadro = ahora;
    if (!c || $("osCombate").classList.contains("hidden")) return;
    const turnoJugador = !!(c.activo && c.activo.equipo === "jugadores" && !ocupado && !c.fin);
    escena.dibujar(c, ahora, dt, {
      hover, modo, turnoJugador,
      alcance: turnoJugador && !modo ? alcanceActual() : null,
      destinoHover: modo && hover ? destinoEn(hover.x, hover.y) : null
    });
  }
  requestAnimationFrame(dibujar);

  /* --- Carteles épicos sobre la arena ---------------------------------------------- */
  let temporizadorCartel = 0;
  function cartel(titulo, subtitulo, clase, ms) {
    const el = $("osCartel");
    if (!el) return;
    el.className = `os-cartel ${clase || ""}`;
    el.innerHTML = `<strong>${esc(titulo)}</strong>${subtitulo ? `<span>${esc(subtitulo)}</span>` : ""}`;
    void el.offsetWidth;
    el.classList.add("visible");
    clearTimeout(temporizadorCartel);
    temporizadorCartel = setTimeout(() => el.classList.remove("visible"), ms || 1300);
  }

  /* --- Fin del combate ------------------------------------------------------------------------ */
  function terminarCombate() {
    const gano = c.fin === "victoria";
    const participantes = c.participantes.map(reg).filter(Boolean);
    const xpTotal = c.unidades.filter(u => u.equipo === "enemigos").reduce((t, u) => t + OS.xpEnemigo(u.nivel), 0);
    const xpPor = Math.round((gano ? xpTotal : xpTotal * 0.2) / Math.max(1, participantes.length));
    const lineas = [];
    participantes.forEach(r => {
      const antes = r.nivel;
      r.xp += xpPor;
      if (gano) r.victorias++; else r.derrotas++;
      const nuevo = OS.nivelPorXp(r.xp);
      for (let n = antes + 1; n <= nuevo; n++) {
        r.nivel = n;
        if (OS.NIVELES_MEJORA.includes(n)) r.mejoras += 2;
      }
      lineas.push({ nombre: r.nombre, antes, ahora: r.nivel, mejoras: OS.NIVELES_MEJORA.filter(n => n > antes && n <= r.nivel).length * 2, xp: xpPor });
    });
    const botin = [];
    if (gano) {
      c.unidades.filter(u => u.equipo === "enemigos").forEach(e => {
        const prob = 0.4 + Math.min(0.3, e.nivel * 0.03);
        if (botin.length < 4 && Math.random() < prob) botin.push(OS.generarObjeto(e.nivel));
      });
      if (!botin.length) botin.push(OS.generarObjeto(Math.max(...c.unidades.filter(u => u.equipo === "enemigos").map(u => u.nivel))));
      botin.forEach(it => datos.reserva.push(it));
    }
    guardar();
    c = null; combateId++; ocupado = false; modo = null;
    $("osCombate").classList.add("hidden");
    const res = $("osResultado");
    res.classList.remove("hidden");
    res.innerHTML = `
      <div class="os-panel os-resultado ${gano ? "gana" : "pierde"}">
        <h2>${gano ? "Victoria" : "Derrota"}</h2>
        <p class="os-sub">${gano ? "Los alzados vuelven al salón." : "Ostelar los levanta de nuevo. Se llevan una parte de la experiencia."}</p>
        <ul class="os-lista">${lineas.map(l => `<li><strong>${esc(l.nombre)}</strong>: +${l.xp} XP${l.ahora > l.antes ? ` · <b class="os-aviso">¡Nivel ${l.ahora}!</b>${l.mejoras ? ` (+${l.mejoras} mejoras)` : ""}` : ""}</li>`).join("")}</ul>
        ${botin.length ? `<h4>Botín</h4><div class="os-reserva">${botin.map(it => `<div class="os-objeto"><span><strong>${esc(OS.nombreObjeto(it))}</strong> <small>${esc(it.tipo)}</small><br><small>${esc(descripcionObjeto(it))}</small></span></div>`).join("")}</div>` : ""}
        <div class="os-botones-fila"><button type="button" class="os-boton os-principal" id="osVolver">Volver al salón</button></div>
      </div>`;
    $("osVolver").addEventListener("click", () => { res.classList.add("hidden"); $("osCuartel").classList.remove("hidden"); pintarCuartel(); });
  }

  OS.depurar = () => c;
  pintarCuartel();
})();
