/* =============================================================================
   LA FRACTURA: pantallas. Elegir ejército, cuartel (soldados, casas, reliquias, salón de los caídos,
   crónicas e historia del mundo), la guerra sobre el tablero y el final con su crónica.
   Las reglas están en fractura-motor.js y lo que dura entre guerras en fractura-campana.js.
============================================================================= */
(function () {
  const D = window.FRACTURA_DATOS, S = window.FracturaSoldados, FM = window.FracturaMotor, IA = window.FracturaIA, C = window.FracturaCampana, CR = window.FracturaCronica, Red = window.FracturaRed;
  const { CLASES, FACCIONES, TIPOS_FRACTURA, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RECURSOS, RECURSO_NOMBRE, RANGOS, SLOTS, DIFICULTADES } = D;
  const $ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ROM = ["", "I", "II", "III"];
  const SLOT_NOMBRE = { arma: "Arma", armadura: "Armadura", accesorio: "Accesorio", estandarte: "Estandarte" };
  const STAT_NOMBRE = { FUE: "Fuerza", CON: "Constitución", VEL: "Velocidad", INT: "Inteligencia", VOL: "Voluntad", MAG: "Aptitud mágica" };

  let ejercitos = {};      // faccion -> ejército
  let ej = null;           // el ejército con el que se juega
  let pestana = "guerra";
  let est = null;          // guerra en curso
  let lat = "sel";
  let sel = { uid: null, ciudad: null };
  let modo = null;         // habilidad que espera una casilla: { id, ... }
  let guardarEstadoTimer = null;
  let ajustesGuerra = { tipo: "azar", dificultad: "normal", rival: "azar", ids: null };
  let tablero = null;
  let ultimoResumen = null;

  /* --- Utilidades --- */
  function aviso(t, error) {
    const a = $("frAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("fr-aviso-error", !!error);
    if (t) { clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.add("hidden"), 5000); }
  }
  function mostrar(pantalla) {
    ["frInicio", "frCuartel", "frGuerra", "frFin"].forEach(id => $(id).classList.toggle("hidden", id !== pantalla));
    window.scrollTo(0, 0);
  }
  const edad = s => S.edadDe(s, ej.anio);
  const nombre = s => `${s.nombre} ${s.casa}`;
  const nombreApodo = s => `${s.nombre} ${s.casa}${s.apodo ? ` «${s.apodo}»` : ""}`;
  const rango = s => S.rangoDe(s.victorias);
  const costeTexto = c => Object.keys(c).map(k => `${c[k]} ${RECURSO_NOMBRE[k].toLowerCase()}`).join(", ") || "gratis";

  async function guardar() {
    const r = await Red.guardarEjercito(ej);
    if (r && r.error) aviso("No se pudo guardar en el servidor. Se guardó en este navegador.", true);
  }

  /* =========================================================================
     INICIO: elegir o fundar un ejército
  ========================================================================= */
  async function pantallaInicio() {
    ej = null; est = null;
    mostrar("frInicio");
    const guardados = await Red.listarEjercitos(Object.keys(FACCIONES));
    ejercitos = {};
    Object.keys(guardados).forEach(f => { ejercitos[f] = guardados[f].ej; });
    const enCurso = Red.cargarGuerra();
    const banner = enCurso && ejercitos[enCurso.cfg.faccion]
      ? `<div class="fr-banner"><p>Tienes una guerra en curso con <strong>${esc(ejercitos[enCurso.cfg.faccion].nombre)}</strong>, en el turno ${enCurso.est.turno}.</p><button type="button" class="fr-btn fr-btn-principal" data-retomar>Retomar la guerra</button></div>` : "";
    $("frEjercitos").innerHTML = banner + Object.keys(FACCIONES).map(f => {
      const fac = FACCIONES[f], e = ejercitos[f];
      const filas = e ? C.enFila(e).length : 0;
      return `<article class="fr-ejercito" style="--c:${fac.color};--b:${fac.bandera}">
        <div class="fr-ejercito-banda"></div>
        <h3>${esc(fac.nombre)}</h3>
        <p class="fr-ejercito-resumen">${esc(fac.resumen)}</p>
        <p class="fr-ejercito-ventaja"><strong>Ventaja.</strong> ${esc(fac.ventaja)}</p>
        ${e ? `<p class="fr-ejercito-datos">${esc(e.nombre)} · ${e.guerras} guerra${e.guerras === 1 ? "" : "s"} (${e.ganadas} ganadas) · ${filas} soldado${filas === 1 ? "" : "s"} en filas · año ${e.anio}</p>
          <button type="button" class="fr-btn fr-btn-principal" data-entrar="${f}">Entrar al cuartel</button>`
          : `<button type="button" class="fr-btn" data-fundar="${f}">Fundar este ejército</button>`}
      </article>`;
    }).join("");
  }

  $("frEjercitos").addEventListener("click", async ev => {
    const f = ev.target.closest("[data-fundar]"), e = ev.target.closest("[data-entrar]"), r = ev.target.closest("[data-retomar]");
    if (f) {
      const id = f.dataset.fundar;
      const nombreEj = await dialogo.pedir(`Nombre del ejército de ${FACCIONES[id].corto}`, `Ejército de ${FACCIONES[id].corto}`);
      if (nombreEj === null) return;
      ej = C.crearEjercito(id, nombreEj);
      ejercitos[id] = ej;
      await guardar();
      entrarCuartel();
    } else if (e) { ej = ejercitos[e.dataset.entrar]; entrarCuartel(); }
    else if (r) retomarGuerra();
  });

  /* =========================================================================
     CUARTEL
  ========================================================================= */
  function entrarCuartel(p) {
    if (!ej) return pantallaInicio();
    pestana = p || pestana || "guerra";
    est = null;
    mostrar("frCuartel");
    $("frNombreEjercito").textContent = ej.nombre;
    const fac = FACCIONES[ej.faccion];
    $("frResumenEjercito").innerHTML = `${esc(fac.nombre)} · año ${ej.anio} de la Fractura · ${ej.guerras} guerra${ej.guerras === 1 ? "" : "s"}, ${ej.ganadas} ganadas · ${C.enFila(ej).length} en filas`;
    document.querySelectorAll("#frPestanas button").forEach(b => b.classList.toggle("activa", b.dataset.p === pestana));
    pintarVista();
  }
  $("frAtras").addEventListener("click", pantallaInicio);
  $("frRenombrar").addEventListener("click", async () => {
    const n = await dialogo.pedir("Nuevo nombre del ejército", ej.nombre);
    if (n === null) return;
    C.renombrarEjercito(ej, n); await guardar(); entrarCuartel();
  });
  $("frPestanas").addEventListener("click", ev => { const b = ev.target.closest("button[data-p]"); if (b) entrarCuartel(b.dataset.p); });

  function pintarVista() {
    const v = $("frVista");
    const fn = { guerra: vistaGuerra, soldados: vistaSoldados, casas: vistaCasas, reliquias: vistaReliquias, salon: vistaSalon, cronicas: vistaCronicas, mundo: vistaMundo }[pestana];
    fn(v);
  }

  /* --- Tarjeta pequeña de soldado --- */
  function tarjetaSoldado(s, extra) {
    const rg = rango(s);
    const claseN = CLASES[s.clase] ? CLASES[s.clase].nombre : s.clase;
    const etiquetas = [];
    if (s.capitan) etiquetas.push(`Capitán ${ROM[s.compania]}`);
    else if (s.compania) etiquetas.push(`${ROM[s.compania]} compañía`);
    if (s.estado === "establecido") etiquetas.push("Establecido");
    if (s.estado === "nino") etiquetas.push(`Niño de ${edad(s)} años`);
    if (C.convaleciente(ej, s)) etiquetas.push("Herido");
    if (s.ascensoPendiente) etiquetas.push("Ascenso pendiente");
    if (s.luto) etiquetas.push("De luto");
    return `<button type="button" class="fr-soldado ${s.estado === "caido" ? "fr-caido" : ""}" data-ficha="${s.id}">
      <span class="fr-soldado-nombre">${esc(nombreApodo(s))}</span>
      <span class="fr-soldado-meta">${esc(claseN)} · ${rg.nombre} · ${s.victorias} victorias · ${edad(s)} años</span>
      ${etiquetas.length ? `<span class="fr-etiquetas">${etiquetas.map(t => `<i>${esc(t)}</i>`).join("")}</span>` : ""}
      ${extra || ""}
    </button>`;
  }

  /* --- Pestaña: Guerra (preparar) --- */
  function vistaGuerra(v) {
    const lim = C.limiteContingente(ej);
    const disp = C.disponibles(ej);
    if (!ajustesGuerra.ids) ajustesGuerra.ids = C.elegirContingenteAuto(ej);
    ajustesGuerra.ids = ajustesGuerra.ids.filter(id => ej.soldados[id] && disp.includes(ej.soldados[id])).slice(0, lim);
    const pend = C.pendientesDeAscenso(ej);
    const heridos = C.enFila(ej).filter(s => C.convaleciente(ej, s));
    v.innerHTML = `
      ${pend.length ? `<div class="fr-banner"><p><strong>${pend.length} veterano${pend.length === 1 ? "" : "s"} esperan una especialización.</strong> Elígela en su ficha antes de partir.</p>
        <div class="fr-fila">${pend.map(s => `<button type="button" class="fr-btn fr-btn-chico" data-ficha="${s.id}">${esc(nombre(s))}</button>`).join("")}</div></div>` : ""}
      <div class="fr-dos">
        <div>
          <h3 class="fr-h3">Contingente (${ajustesGuerra.ids.length} de ${lim})</h3>
          <p class="fr-sub">Solo los que van a la guerra pueden ganar experiencia, o morir. Sube el máximo ganando guerras.</p>
          <div class="fr-fila"><button type="button" class="fr-btn fr-btn-chico" data-auto>Elegir los mejores</button><button type="button" class="fr-btn fr-btn-chico" data-ninguno>Vaciar</button></div>
          <div class="fr-lista fr-lista-marcar">${disp.map(s => `<label class="fr-marcar"><input type="checkbox" data-pon="${s.id}"${ajustesGuerra.ids.includes(s.id) ? " checked" : ""}>${tarjetaSoldadoLinea(s)}</label>`).join("") || `<p class="fr-vacio">No hay nadie disponible. Si no llevas a nadie, la compañía recibe reclutas para llegar a seis.</p>`}</div>
          ${heridos.length ? `<p class="fr-sub">Convalecientes (no pueden ir): ${heridos.map(s => esc(nombre(s))).join(", ")}.</p>` : ""}
        </div>
        <div>
          <h3 class="fr-h3">La guerra</h3>
          <label class="fr-campo">Tipo de Fractura
            <select data-aj="tipo">${["azar"].concat(Object.keys(TIPOS_FRACTURA)).map(t => `<option value="${t}"${ajustesGuerra.tipo === t ? " selected" : ""}>${t === "azar" ? "Al azar" : TIPOS_FRACTURA[t].nombre}</option>`).join("")}</select></label>
          <p class="fr-sub" id="frTextoTipo">${ajustesGuerra.tipo === "azar" ? "Cada guerra cae en un tipo distinto." : esc(TIPOS_FRACTURA[ajustesGuerra.tipo].texto)}</p>
          <label class="fr-campo">Rival
            <select data-aj="rival">${["azar"].concat(Object.keys(FACCIONES).filter(f => f !== ej.faccion)).map(f => `<option value="${f}"${ajustesGuerra.rival === f ? " selected" : ""}>${f === "azar" ? "Al azar" : FACCIONES[f].nombre}</option>`).join("")}</select></label>
          <label class="fr-campo">Dificultad
            <select data-aj="dificultad">${Object.keys(DIFICULTADES).map(d => `<option value="${d}"${ajustesGuerra.dificultad === d ? " selected" : ""}>${DIFICULTADES[d].nombre}</option>`).join("")}</select></label>
          ${ej.nemesis.length ? `<p class="fr-sub"><strong>Némesis.</strong> ${ej.nemesis.map(n => esc(`${n.nombre} ${n.casa}`)).join(", ")} te espera${ej.nemesis.length === 1 ? "" : "n"} en alguna parte.</p>` : ""}
          <button type="button" class="fr-btn fr-btn-principal fr-btn-grande" data-empezar>Empezar la guerra</button>
        </div>
      </div>`;
  }
  const tarjetaSoldadoLinea = s => `<span class="fr-linea"><b>${esc(nombreApodo(s))}</b> <small>${esc(CLASES[s.clase].nombre)} · ${rango(s).nombre} · ${s.victorias}v${s.capitan ? ` · Capitán ${ROM[s.compania]}` : ""}</small></span>`;

  $("frVista").addEventListener("change", ev => {
    const pon = ev.target.closest("[data-pon]");
    if (pon) {
      const id = pon.dataset.pon;
      const lista = ajustesGuerra.ids.filter(x => x !== id);
      if (pon.checked) { if (lista.length >= C.limiteContingente(ej)) { pon.checked = false; aviso(`El contingente es de ${C.limiteContingente(ej)} como máximo.`, true); return; } lista.push(id); }
      ajustesGuerra.ids = lista;
      vistaGuerra($("frVista"));
    }
    const aj = ev.target.closest("[data-aj]");
    if (aj) { ajustesGuerra[aj.dataset.aj] = aj.value; vistaGuerra($("frVista")); }
  });

  $("frVista").addEventListener("click", async ev => {
    const t = ev.target;
    if (t.closest("[data-auto]")) { ajustesGuerra.ids = C.elegirContingenteAuto(ej); vistaGuerra($("frVista")); return; }
    if (t.closest("[data-ninguno]")) { ajustesGuerra.ids = []; vistaGuerra($("frVista")); return; }
    if (t.closest("[data-empezar]")) { empezarGuerra(); return; }
    const f = t.closest("[data-ficha]");
    if (f) { abrirFicha(f.dataset.ficha); return; }
    const casa = t.closest("[data-casa]");
    if (casa) { const el = casa.nextElementSibling; if (el && el.classList.contains("fr-arbol")) el.classList.toggle("hidden"); return; }
    const cr = t.closest("[data-cronica]");
    if (cr) { const el = cr.nextElementSibling; if (el) el.classList.toggle("hidden"); return; }
    const eq = t.closest("[data-equipar]");
    if (eq) {
      const sid = $("frVista").querySelector(`[data-sel-reliquia="${eq.dataset.equipar}"]`).value;
      if (!sid) return;
      const err = C.equipar(ej, sid, eq.dataset.equipar);
      if (err) aviso(err, true); else { await guardar(); vistaReliquias($("frVista")); }
    }
  });

  /* --- Pestaña: Soldados --- */
  function vistaSoldados(v) {
    const grupos = [["En filas", C.enFila(ej)], ["Niños de las casas", C.ninos(ej)], ["Retirados", C.retirados(ej)]];
    v.innerHTML = grupos.map(([t, l]) => l.length ? `<h3 class="fr-h3">${t} (${l.length})</h3><div class="fr-lista">${l.slice().sort((a, b) => b.victorias - a.victorias).map(s => tarjetaSoldado(s)).join("")}</div>` : "").join("") || `<p class="fr-vacio">Sin soldados.</p>`;
  }

  /* --- Pestaña: Casas --- */
  function vistaCasas(v) {
    const casas = C.casas(ej);
    v.innerHTML = `<p class="fr-sub">Las casas se forman solas cuando los soldados tienen hijos. Cada hijo lleva el apellido de su padre.</p>` + casas.map(c => {
      const vivos = c.miembros.filter(s => s.estado !== "caido").length;
      return `<article class="fr-casa">
        <button type="button" class="fr-casa-cab" data-casa="${esc(c.casa)}"><strong>Casa ${esc(c.casa)}</strong>
          <span>${c.miembros.length} miembro${c.miembros.length === 1 ? "" : "s"} (${vivos} vivos) · ${c.generaciones} generación${c.generaciones === 1 ? "" : "es"} · ${c.victorias} victorias</span></button>
        <div class="fr-arbol hidden">${arbolHtml(C.arbolDeCasa(ej, c.casa), 0)}
          <p class="fr-sub">Los ${esc(c.casa)} han servido durante ${Math.max(1, c.anios)} año${c.anios === 1 ? "" : "s"}.</p></div>
      </article>`;
    }).join("");
  }
  function arbolHtml(nodos, nivel) {
    return `<ul class="fr-arbol-lista">${nodos.map(n => `<li><button type="button" class="fr-enlace ${n.s.estado === "caido" ? "fr-caido" : ""}" data-ficha="${n.s.id}">${esc(nombreApodo(n.s))}</button>
      <small>${n.s.nacimiento}${n.s.estado === "caido" && n.s.muerte ? ` – ${n.s.muerte.anio}` : ""} · ${esc(CLASES[n.s.clase].nombre)} · ${n.s.victorias}v</small>${n.hijos.length ? arbolHtml(n.hijos, nivel + 1) : ""}</li>`).join("")}</ul>`;
  }

  /* --- Pestaña: Reliquias --- */
  function vistaReliquias(v) {
    const rels = C.reliquiasDe(ej);
    if (!rels.length) { v.innerHTML = `<p class="fr-vacio">Todavía no hay reliquias. Se encuentran en ruinas, en fortalezas custodiadas y en las manos de los enemigos caídos.</p>`; return; }
    const libres = new Set(C.reliquiasLibres(ej).map(r => r.id));
    v.innerHTML = `<p class="fr-sub">Pocas y con nombre. Cuando alguien cae, lo suyo no desaparece: tú decides quién la recibe.</p>` + rels.map(r => {
      const dueno = C.todos(ej).find(s => s.estado !== "caido" && Object.values(s.equipo || {}).includes(r.id));
      const hist = r.propietarios.map((p, i) => `${i + 1}. ${esc(p.nombre)}${p.heredada ? " (heredada)" : ""}${p.cae ? " (cayó con ella)" : ""}`).join(" · ");
      const elegibles = C.enFila(ej).filter(s => r.slot !== "estandarte" || s.capitan);
      return `<article class="fr-reliquia ${r.estado === "perdida" ? "fr-caido" : ""}">
        <h4>${esc(r.nombre)} <small>${SLOT_NOMBRE[r.slot]}</small></h4>
        <p>${esc(r.texto)}</p>
        <p class="fr-sub">${r.estado === "perdida" ? "Perdida en la Fractura." : dueno ? `La lleva ${esc(nombreApodo(dueno))}.` : "Sin dueño, en el reliquiario."} ${r.origen ? esc(r.origen) + "." : ""}</p>
        ${hist ? `<p class="fr-sub"><strong>Propietarios conocidos.</strong> ${hist}</p>` : ""}
        ${r.estado !== "perdida" ? `<div class="fr-fila"><select data-sel-reliquia="${r.id}"><option value="">Dársela a...</option>${elegibles.map(s => `<option value="${s.id}">${esc(nombre(s))}</option>`).join("")}</select><button type="button" class="fr-btn fr-btn-chico" data-equipar="${r.id}">Entregar</button></div>` : ""}
      </article>`;
    }).join("");
    void libres;
  }

  /* --- Pestaña: Salón de los Caídos --- */
  function vistaSalon(v) {
    const caidos = C.caidos(ej);
    if (!caidos.length) { v.innerHTML = `<p class="fr-vacio">El Salón de los Caídos está vacío. Por ahora.</p>`; return; }
    v.innerHTML = `<p class="fr-sub">${caidos.length} nombre${caidos.length === 1 ? "" : "s"} grabado${caidos.length === 1 ? "" : "s"} en la piedra.</p><div class="fr-lista">${caidos.map(s => {
      const m = s.muerte || {};
      const serv = Math.max(1, (m.anio || ej.anio) - s.ingreso);
      return `<button type="button" class="fr-soldado fr-caido" data-ficha="${s.id}">
        <span class="fr-soldado-nombre">${esc(nombreApodo(s))}</span>
        <span class="fr-soldado-meta">${esc(CLASES[s.clase].nombre)} · ${s.victorias} victorias${s.capitan ? ` · Capitán de la ${ROM[s.compania] || ""} Compañía` : ""} · ${serv} año${serv === 1 ? "" : "s"} de servicio</span>
        <span class="fr-soldado-meta">${m.natural ? "Murió en paz." : `Cayó en ${esc(m.lugar || "la Fractura")}${m.causa && m.causa !== "la Fractura" ? ` a manos de ${esc(m.causa)}` : ""}.`}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /* --- Pestaña: Crónicas propias --- */
  function vistaCronicas(v) {
    const h = ej.historia.slice().reverse();
    if (!h.length) { v.innerHTML = `<p class="fr-vacio">Aún no hay guerras que contar.</p>`; return; }
    v.innerHTML = h.map(g => `<article class="fr-cronica">
      <button type="button" class="fr-casa-cab" data-cronica="1"><strong>${esc(g.titulo || `Guerra ${g.n}`)}</strong>
        <span>Año ${g.anio} · ${g.resultado} contra ${esc(FACCIONES[g.rival] ? FACCIONES[g.rival].corto : g.rival)} · ${g.turnos} turnos</span></button>
      <div class="fr-arbol hidden">${(g.parrafos || [g.razon || ""]).map(p => `<p>${esc(p)}</p>`).join("")}</div>
    </article>`).join("");
  }

  /* --- Pestaña: Historia del mundo --- */
  async function vistaMundo(v) {
    v.innerHTML = `<p class="fr-sub">Cargando...</p>`;
    const guerras = await Red.historiaDelMundo(300);
    if (!guerras.length) { v.innerHTML = `<p class="fr-vacio">La historia del mundo se guarda en el servidor. Inicia sesión y juega una guerra para empezar a escribirla.</p>`; return; }
    const h = CR.historiaDelMundo(guerras);
    const facs = Object.keys(h.porFaccion).sort((a, b) => h.porFaccion[b].guerras - h.porFaccion[a].guerras);
    v.innerHTML = `<div class="fr-historia">
      <p><strong>${h.guerras}</strong> guerras disputadas por <strong>${h.jugadores}</strong> jugador${h.jugadores === 1 ? "" : "es"}.</p>
      <p><strong>${h.facciones}</strong> bandos distintos han salido a la Fractura. Se tomaron <strong>${h.capitalesTomadas}</strong> capitales y <strong>${h.nucleos}</strong> veces alguien impuso su influencia sobre el Núcleo del Sueño.</p>
      <p>Cayeron <strong>${h.bajas}</strong> soldados entre los dos bandos.${h.mayor ? ` La guerra más larga duró ${h.mayor.turnos} turnos.` : ""}</p>
    </div>
    <h3 class="fr-h3">Por bando</h3>
    <div class="fr-lista">${facs.map(f => `<div class="fr-soldado"><span class="fr-soldado-nombre">${esc(FACCIONES[f] ? FACCIONES[f].nombre : f)}</span><span class="fr-soldado-meta">${h.porFaccion[f].guerras} guerras · ${h.porFaccion[f].victorias} victorias</span></div>`).join("")}</div>
    <h3 class="fr-h3">Últimas guerras</h3>
    ${guerras.slice(0, 20).map(g => `<article class="fr-cronica"><button type="button" class="fr-casa-cab" data-cronica="1"><strong>${esc(g.titulo || "Una guerra")}</strong><span>${esc(g.jugador)} (${esc(FACCIONES[g.faccion] ? FACCIONES[g.faccion].corto : g.faccion)}) · ${g.resultado} contra ${esc(FACCIONES[g.rival] ? FACCIONES[g.rival].corto : g.rival)} · ${g.turnos} turnos</span></button>
      <div class="fr-arbol hidden">${(g.cronica || []).map(p => `<p>${esc(p)}</p>`).join("") || `<p>${esc(g.razon)}</p>`}</div></article>`).join("")}`;
  }

  /* =========================================================================
     FICHA DE UN SOLDADO
  ========================================================================= */
  function abrirFicha(id) {
    const s = ej.soldados[id];
    if (!s) return;
    const rg = rango(s);
    const claseN = CLASES[s.clase].nombre;
    const barra = k => `<div class="fr-stat"><span>${STAT_NOMBRE[k]}</span><i><b style="width:${s.stats[k] * 10}%"></b></i><em>${s.stats[k]}</em></div>`;
    const vivo = s.estado !== "caido";
    const equipo = SLOTS.map(slot => {
      const rid = s.equipo && s.equipo[slot];
      const r = rid && ej.reliquias[rid];
      const libres = C.reliquiasLibres(ej).filter(x => x.slot === slot);
      return `<div class="fr-slot"><b>${SLOT_NOMBRE[slot]}</b> ${r ? `${esc(r.nombre)} <button type="button" class="fr-enlace" data-quita="${slot}">quitar</button>` : (slot === "estandarte" && !s.capitan) ? "<small>solo capitanes</small>" : vivo && libres.length ? `<select data-pon-equipo="${slot}"><option value="">Equipar...</option>${libres.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join("")}</select>` : "<small>nada</small>"}</div>`;
    }).join("");
    const rel = C.relaciones(ej, s).map(r => `<li>${esc(r.tipo)} <button type="button" class="fr-enlace" data-ficha-otro="${r.s.id}">${esc(nombreApodo(r.s))}</button></li>`).join("");
    const caps = C.capitanes(ej);
    const puedeCap = vivo && s.estado !== "nino" && s.estado !== "retirado" && S.rangoIndice(s.victorias) >= 1;
    const ascenso = s.ascensoPendiente ? `<div class="fr-banner"><p><strong>${esc(s.nombre)} ha sobrevivido a ${s.victorias} victorias.</strong> Elige una especialización.</p>
      <div class="fr-fila">${Object.keys(ESPECIALIZACIONES).map(k => `<button type="button" class="fr-btn fr-btn-chico" data-spec="${k}" title="${esc(ESPECIALIZACIONES[k].texto)}">${ESPECIALIZACIONES[k].nombre}</button>`).join("")}</div>
      <p class="fr-sub">${Object.keys(ESPECIALIZACIONES).map(k => `${ESPECIALIZACIONES[k].nombre}: ${ESPECIALIZACIONES[k].texto}`).join(" ")}</p></div>` : "";
    const m = s.muerte;
    $("frFichaCuerpo").innerHTML = `
      <h2 class="fr-h2">${esc(nombreApodo(s))}</h2>
      <p class="fr-sub">${s.sexo === "f" ? "Mujer" : "Hombre"} de ${edad(s)} años · ${esc(claseN)} · ${rg.nombre} · ${esc(D.ORIGENES[s.origen] ? D.ORIGENES[s.origen].nombre : s.origen)}${s.reanimado ? " · Reanimado" : ""}${s.renacido ? ` · Renaciente (${s.renacido})` : ""}</p>
      ${m ? `<p class="fr-epitafio">${m.natural ? "Murió en paz." : `Cayó en ${esc(m.lugar)}${m.causa && m.causa !== "la Fractura" ? ` a manos de ${esc(m.causa)}` : ""}.`} Año ${m.anio}.</p>` : ""}
      ${s.estado === "establecido" ? `<p class="fr-sub">Establecido: tiene familia.</p>` : ""}
      ${C.convaleciente(ej, s) ? `<p class="fr-sub">Convaleciente de unas heridas graves. No puede ir a la guerra hasta pasadas ${s.herida.hasta - ej.guerras + 1} guerra(s).</p>` : ""}
      ${s.luto ? `<p class="fr-sub">De luto por ${esc(s.luto.nombre)}: +1 de ataque durante ${s.luto.restantes} guerra(s).</p>` : ""}
      ${ascenso}
      <div class="fr-cifras"><div><b>${s.victorias}</b>victorias</div><div><b>${s.bajas}</b>bajas</div><div><b>${s.oficiales}</b>oficiales abatidos</div><div><b>${s.guerras}</b>guerras (${s.ganadas} ganadas)</div><div><b>${s.cicatrices || 0}</b>cicatrices</div><div><b>${S.aniosDeServicio(s, ej.anio)}</b>años de servicio</div></div>
      ${s.spec ? `<p><strong>${ESPECIALIZACIONES[s.spec].nombre}.</strong> ${esc(ESPECIALIZACIONES[s.spec].texto)}</p>` : ""}
      <div class="fr-dos fr-dos-chico"><div><h3 class="fr-h3">Características</h3>${["FUE", "CON", "VEL", "INT", "VOL", "MAG"].map(barra).join("")}</div>
        <div><h3 class="fr-h3">Equipo</h3>${equipo}</div></div>
      ${vivo && s.estado !== "nino" ? `<h3 class="fr-h3">Mando</h3><div class="fr-fila">
        ${s.capitan ? `<span>Capitán de la ${ROM[s.compania]} compañía.</span> <button type="button" class="fr-btn fr-btn-chico" data-quitar-capitan>Quitarle el mando</button>`
          : `${puedeCap ? [1, 2, 3].map(n => `<button type="button" class="fr-btn fr-btn-chico" data-capitan="${n}"${caps.some(c => c.compania === n) ? " disabled" : ""}>Capitán de la ${ROM[n]}</button>`).join("") : "<small>Hay que ser al menos soldado para mandar.</small>"}
          <select data-compania><option value="0">Sin compañía</option>${caps.map(c => `<option value="${c.compania}"${s.compania === c.compania ? " selected" : ""}>${ROM[c.compania]} compañía (${esc(c.nombre)})</option>`).join("")}</select>`}</div>` : ""}
      ${rel ? `<h3 class="fr-h3">Familia y compañeros</h3><ul class="fr-rel">${rel}</ul>` : ""}
      <h3 class="fr-h3">Su historia</h3>
      <ol class="fr-hitos">${s.hitos.slice().reverse().map(h => `<li><b>Año ${h.anio}.</b> ${esc(h.texto)}</li>`).join("") || "<li>Aún sin historia.</li>"}</ol>`;
    $("frFichaCuerpo").dataset.id = id;
    if (!$("frFicha").open) $("frFicha").showModal();
  }
  $("frFichaCerrar").addEventListener("click", () => $("frFicha").close());
  $("frFicha").addEventListener("click", ev => { if (ev.target === $("frFicha")) $("frFicha").close(); });
  $("frFicha").addEventListener("click", async ev => {
    const id = $("frFichaCuerpo").dataset.id;
    const t = ev.target;
    const otro = t.closest("[data-ficha-otro]");
    if (otro) { abrirFicha(otro.dataset.fichaOtro); return; }
    let err = null, cambio = false;
    const spec = t.closest("[data-spec]"), cap = t.closest("[data-capitan]"), quitaCap = t.closest("[data-quitar-capitan]"), quita = t.closest("[data-quita]");
    if (spec) { err = C.elegirEspecializacion(ej, id, spec.dataset.spec); cambio = true; }
    else if (cap) { err = C.nombrarCapitan(ej, id, Number(cap.dataset.capitan)); cambio = true; }
    else if (quitaCap) { C.quitarCapitan(ej, id); cambio = true; }
    else if (quita) { C.desequipar(ej, id, quita.dataset.quita); cambio = true; }
    if (err) aviso(err, true);
    if (cambio) { await guardar(); abrirFicha(id); if (!est) entrarCuartelSinSalto(); }
  });
  $("frFicha").addEventListener("change", async ev => {
    const id = $("frFichaCuerpo").dataset.id;
    const eq = ev.target.closest("[data-pon-equipo]"), co = ev.target.closest("[data-compania]");
    let err = null;
    if (eq && eq.value) err = C.equipar(ej, id, eq.value);
    if (co) err = C.asignarCompania(ej, id, Number(co.value));
    if (err) aviso(err, true);
    await guardar(); abrirFicha(id); if (!est) entrarCuartelSinSalto();
  });
  function entrarCuartelSinSalto() { if (!$("frCuartel").classList.contains("hidden")) pintarVista(); }

  /* =========================================================================
     LA GUERRA
  ========================================================================= */
  function empezarGuerra() {
    const cfg = C.prepararGuerra(ej, ajustesGuerra.ids, { tipo: ajustesGuerra.tipo === "azar" ? "azar" : ajustesGuerra.tipo, dificultad: ajustesGuerra.dificultad, rival: ajustesGuerra.rival === "azar" ? null : ajustesGuerra.rival });
    if (!cfg) { aviso("No hay soldados disponibles.", true); return; }
    est = FM.crearGuerra(cfg);
    cfgGuerraActual = { faccion: ej.faccion };
    ejercitosAntes = null;
    sel = { uid: null, ciudad: null }; modo = null; lat = "sel";
    entrarGuerra();
    guardarEnCurso();
  }
  const musicaPartida = si => { if (window.MusicaPaginas) window.MusicaPaginas.partida(si); };
  let cfgGuerraActual = null, ejercitosAntes = null;

  function guardarEnCurso() { clearTimeout(guardarEstadoTimer); guardarEstadoTimer = setTimeout(() => Red.guardarGuerra(est, cfgGuerraActual), 300); }

  function retomarGuerra() {
    const g = Red.cargarGuerra();
    if (!g || !ejercitos[g.cfg.faccion]) return;
    ej = ejercitos[g.cfg.faccion];
    est = g.est; cfgGuerraActual = g.cfg;
    sel = { uid: null, ciudad: null }; modo = null; lat = "sel";
    entrarGuerra();
  }

  function entrarGuerra() {
    mostrar("frGuerra");
    musicaPartida(est.ganador === null);
    if (!tablero) tablero = window.FracturaTablero.crear($("frTablero"), { alTocar: tocar });
    tablero.poner(est);
    refrescar();
    if (est.ganador !== null) terminarGuerraUI();
  }

  const humano = () => 0;
  const soyYo = () => est.activo === humano() && est.ganador === null;

  function refrescar() {
    pintarRecursos();
    $("frTurno").textContent = est.ganador !== null ? "Guerra terminada" : est.activo === humano() ? `Turno ${est.turno} de ${est.maxTurnos}` : "Turno del rival";
    $("frTerminar").disabled = !soyYo();
    pintarResaltes();
    pintarLateral();
  }

  function pintarRecursos() {
    const jug = est.jugadores[humano()];
    const ing = FM.ingresoDe(est, humano());
    const gasto = FM.mantenimiento(est, humano());
    $("frRecursos").innerHTML = RECURSOS.map(k => {
      const neto = (ing[k] || 0) - (k === "comida" ? gasto : 0);
      return `<span class="fr-rec" title="${RECURSO_NOMBRE[k]}"><b>${RECURSO_NOMBRE[k]}</b> ${jug.recursos[k]}<small class="${neto < 0 ? "fr-neg" : ""}">${neto >= 0 ? "+" : ""}${neto}</small></span>`;
    }).join("") + `<span class="fr-rec" title="Turnos que llevas sobre el Núcleo del Sueño"><b>Núcleo</b> ${est.nucleoHold[0]}/${est.hold}</span>`;
  }

  function pintarResaltes() {
    const e = { sel: sel.uid, ciudad: sel.ciudad, mover: new Map(), atacar: new Set(), objetivosHab: new Set() };
    const u = sel.uid && est.unidades[sel.uid];
    if (u && u.dueno === humano() && soyYo()) {
      if (!modo) {
        if (u.pm > 0) FM.alcanzables(est, u).destinos.forEach((n, k) => e.mover.set(k, n));
        if (!u.atacado && u.clase !== "sanador") {
          const alc = FM.ef(est, u).alc;
          Object.values(est.unidades).forEach(w => { if (w.dueno !== humano() && FM.veCasilla(est, humano(), w.x, w.y) && Math.max(Math.abs(w.x - u.x), Math.abs(w.y - u.y)) <= alc) e.atacar.add(`${w.x},${w.y}`); });
        }
      } else if (modo.id === "alterar") {
        const alc = FM.ef(est, u).alc;
        for (let y = u.y - alc; y <= u.y + alc; y++) for (let x = u.x - alc; x <= u.x + alc; x++) { const c = FM.casilla(est, x, y); if (c && !c.est && !FM.unidadEn(est, x, y) && D.TERRENOS[c.t].mov > 0 && (x !== u.x || y !== u.y)) e.objetivosHab.add(`${x},${y}`); }
      }
    }
    tablero.estado(e);
  }

  /* --- Tocar el tablero --- */
  async function tocar(x, y) {
    if (est.ganador !== null || !soyYo()) return;
    const H = humano();
    const u = sel.uid ? est.unidades[sel.uid] : null;
    const enCasilla = FM.unidadEn(est, x, y);
    const visible = FM.veCasilla(est, H, x, y);
    // Habilidades que piden una casilla
    if (modo && u) {
      if (modo.id === "alterar") {
        const r = FM.aplicar(est, { t: "habilidad", id: "alterar", uid: u.uid, x, y, a: modo.a });
        modo = null; if (!r.ok) aviso(r.error, true);
        return despuesDeAccion();
      }
    }
    if (enCasilla && enCasilla.dueno === H) { sel = { uid: enCasilla.uid, ciudad: null }; modo = null; lat = "sel"; refrescar(); return; }
    if (u && u.dueno === H && enCasilla && enCasilla.dueno !== H && visible) {
      // Atacar: si no llega desde donde está, se acerca primero
      const e = FM.ef(est, u);
      const d = Math.max(Math.abs(enCasilla.x - u.x), Math.abs(enCasilla.y - u.y));
      if (u.atacado) { aviso("Esa unidad ya atacó este turno.", true); return; }
      if (d > e.alc) {
        const info = FM.alcanzables(est, u);
        let mejor = null;
        info.destinos.forEach(n => { const dd = Math.max(Math.abs(enCasilla.x - n.x), Math.abs(enCasilla.y - n.y)); if (dd <= e.alc && dd >= 1 && (!mejor || n.c < mejor.c || (n.c === mejor.c && dd > mejor.dd))) mejor = { x: n.x, y: n.y, c: n.c, dd }; });
        if (!mejor) { aviso("No llega hasta ahí este turno.", true); return; }
        const m = FM.aplicar(est, { t: "mover", uid: u.uid, x: mejor.x, y: mejor.y });
        if (!m.ok) { aviso(m.error, true); return; }
        tablero.redibujar();
        if (est.ganador !== null || !est.unidades[u.uid]) return despuesDeAccion();
      }
      const a = FM.aplicar(est, { t: "atacar", uid: u.uid, x: enCasilla.x, y: enCasilla.y });
      if (!a.ok) aviso(a.error, true);
      return despuesDeAccion();
    }
    if (u && u.dueno === H && !enCasilla) {
      const info = FM.alcanzables(est, u);
      if (info.destinos.has(`${x},${y}`) && u.pm > 0) {
        const m = FM.aplicar(est, { t: "mover", uid: u.uid, x, y });
        if (!m.ok) aviso(m.error, true);
        return despuesDeAccion();
      }
    }
    const ciudad = FM.ciudadEn(est, x, y);
    if (ciudad && visible) { sel = { uid: null, ciudad: ciudad.id }; modo = null; lat = "sel"; refrescar(); return; }
    sel = { uid: null, ciudad: null }; modo = null; refrescar();
  }

  function despuesDeAccion() {
    (est.ev || []).forEach(e => {
      if (e.k === "golpe") tablero.efecto(e.x, e.y, `-${e.dmg}`, "#ffd0c8");
      if (e.k === "muerte") tablero.efecto(e.x, e.y, "✝", "#ffffff");
    });
    if (sel.uid && !est.unidades[sel.uid]) sel.uid = null;
    refrescar();
    guardarEnCurso();
    if (est.ganador !== null) setTimeout(terminarGuerraUI, 700);
  }

  /* --- Panel lateral --- */
  function pintarLateral() {
    document.querySelectorAll("#frLatPestanas button").forEach(b => b.classList.toggle("activa", b.dataset.l === lat));
    const c = $("frLateral");
    ({ sel: latSeleccion, ciudades: latCiudades, saber: latSaber, registro: latRegistro }[lat])(c);
  }
  $("frLatPestanas").addEventListener("click", ev => { const b = ev.target.closest("button[data-l]"); if (b) { lat = b.dataset.l; pintarLateral(); } });

  function statsUnidad(u) {
    const e = FM.ef(est, u);
    const cl = CLASES[u.clase];
    return `<div class="fr-cifras fr-cifras-chicas"><div><b>${u.hp}/${e.hpMax}</b>vida</div><div><b>${e.atq}</b>ataque</div><div><b>${e.def}</b>defensa</div><div><b>${u.pm}/${e.mov}</b>movimiento</div><div><b>${e.alc}</b>alcance</div></div>
      <p class="fr-sub">${esc(cl.texto)}</p>`;
  }

  function latSeleccion(c) {
    const H = humano();
    const u = sel.uid && est.unidades[sel.uid];
    if (u) {
      const jug = est.jugadores[u.dueno] || null;
      let h = `<h3 class="fr-h3">${esc(FM.nombreUnidad(u))}</h3><p class="fr-sub">${esc(CLASES[u.clase].nombre)}${u.s ? ` · ${rango(u.s).nombre}${u.s.spec ? " · " + ESPECIALIZACIONES[u.s.spec].nombre : ""} · ${u.s.victorias + (u.vicG || 0)} victorias` : ""}</p>`;
      h += statsUnidad(u);
      if (u.s) {
        const rels = Object.values(u.s.equipo || {}).map(id => est.reliquias[id]).filter(Boolean);
        if (rels.length) h += `<p class="fr-sub"><strong>Lleva.</strong> ${rels.map(r => esc(r.nombre)).join(", ")}</p>`;
        if (u.s.luto) h += `<p class="fr-sub">De luto por ${esc(u.s.luto.nombre)}.</p>`;
      }
      if (u.dueno === H && soyYo()) {
        const botones = [];
        const jh = est.jugadores[H];
        if (u.clase === "picaro" && !u.atacado) {
          FM.ciudadesDe(est, 1 - H).filter(ci => Math.max(Math.abs(ci.x - u.x), Math.abs(ci.y - u.y)) <= 1).forEach(ci => ci.edificios.filter(e => !(ci.desh[e] >= est.turno)).forEach(e => botones.push(`<button type="button" class="fr-btn fr-btn-chico" data-hab="sabotear" data-x="${ci.x}" data-y="${ci.y}" data-ed="${e}">Sabotear ${esc(EDIFICIOS[e].nombre)}</button>`)));
        }
        if ((u.clase === "arcanista" || u.clase === "archimago" || u.clase === "eco") && jh.tech.arcano >= 3 && !u.atacado && u.enfriar <= 0) {
          ["llanura", "bosque", "desierto"].forEach(t => botones.push(`<button type="button" class="fr-btn fr-btn-chico${modo && modo.a === t ? " fr-btn-principal" : ""}" data-hab="alterar" data-a="${t}">Cambiar terreno a ${D.TERRENOS[t].nombre.toLowerCase()} (3 maná)</button>`));
        }
        if (jh.tech.tanato >= 3 && !u.atacado) est.tumbas.filter(t => Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) <= 1 && !FM.unidadEn(est, t.x, t.y)).forEach(t => botones.push(`<button type="button" class="fr-btn fr-btn-chico" data-hab="reanimar" data-x="${t.x}" data-y="${t.y}">Reanimar a ${esc(t.s ? nombreApodo(t.s) : "un caído")} (3 Ánima)</button>`));
        if (botones.length) h += `<div class="fr-fila fr-fila-botones">${botones.join("")}</div>`;
        if (modo) h += `<p class="fr-sub">Toca una casilla marcada en violeta.</p>`;
      }
      c.innerHTML = h;
      return;
    }
    const ci = sel.ciudad && est.ciudades[sel.ciudad];
    if (ci) { latCiudad(c, ci); return; }
    // Nada seleccionado: resumen de las unidades propias
    const mias = FM.unidadesDe(est, H);
    c.innerHTML = `<h3 class="fr-h3">Tus unidades (${mias.length})</h3>
      <div class="fr-lista fr-lista-chica">${mias.map(u => `<button type="button" class="fr-soldado fr-soldado-chico" data-uid="${u.uid}"><span class="fr-soldado-nombre">${esc(FM.nombreUnidad(u))}</span><span class="fr-soldado-meta">${esc(CLASES[u.clase].nombre)} · ${u.hp}/${FM.ef(est, u).hpMax}${u.pm > 0 || !u.atacado ? "" : " · ya actuó"}</span></button>`).join("")}</div>`;
  }

  function latCiudad(c, ci) {
    const H = humano();
    const mia = ci.dueno === H;
    let h = `<h3 class="fr-h3">${esc(ci.nombre)}${ci.capital ? " (capital)" : ""}</h3><p class="fr-sub">Nivel ${ci.nivel} · ${ci.dueno === null ? "Sin dueño" : mia ? "Tuya" : "Del rival"} · ${esc(est.regiones[ci.region].nombre)} (estabilidad ${est.regiones[ci.region].estab})</p>`;
    if (ci.edificios.length) h += `<p class="fr-sub"><strong>Edificios.</strong> ${ci.edificios.map(e => `${esc(EDIFICIOS[e].nombre)}${ci.desh[e] >= est.turno ? " (inutilizado)" : ""}`).join(", ")}</p>`;
    if (!mia) { c.innerHTML = h; return; }
    if (soyYo()) {
      h += `<h4 class="fr-h4">Entrenar</h4><div class="fr-fila-botones">${FM.clasesDisponibles(est, H).map(cl => {
        const razon = FM.razonNoReclutar(est, H, ci.id, cl);
        const coste = FM.costeReclutar(est, H, cl, ci);
        return `<button type="button" class="fr-btn fr-btn-chico" data-recluta="${cl}"${razon ? " disabled" : ""} title="${esc(razon || CLASES[cl].texto)}">${esc(CLASES[cl].nombre)} <small>${esc(costeTexto(coste))}</small></button>`;
      }).join("")}</div>
      <h4 class="fr-h4">Construir (${ci.edificios.length}/${ci.nivel + 2} huecos)</h4><div class="fr-fila-botones">${Object.keys(EDIFICIOS).filter(e => !ci.edificios.includes(e)).map(e => {
        const razon = FM.razonNoConstruir(est, H, ci.id, e);
        return `<button type="button" class="fr-btn fr-btn-chico" data-construye="${e}"${razon ? " disabled" : ""} title="${esc(razon || EDIFICIOS[e].texto)}">${esc(EDIFICIOS[e].nombre)} <small>${esc(costeTexto(EDIFICIOS[e].coste))}</small></button>`;
      }).join("")}</div>
      ${ci.nivel < 5 ? `<h4 class="fr-h4">Crecer</h4><button type="button" class="fr-btn fr-btn-chico" data-mejora="${ci.id}"${FM.puedePagar(est.jugadores[H], { materiales: 4 * ci.nivel, oro: 3 * ci.nivel }) ? "" : " disabled"}>Subir a nivel ${ci.nivel + 1} <small>${4 * ci.nivel} materiales, ${3 * ci.nivel} oro</small></button>` : ""}`;
    }
    c.innerHTML = h;
  }

  function latCiudades(c) {
    const H = humano();
    const vis = Object.values(est.ciudades).filter(ci => ci.dueno === H || FM.veCasilla(est, H, ci.x, ci.y) || est.vision[H][ci.y * est.ancho + ci.x] === 1);
    c.innerHTML = `<h3 class="fr-h3">Ciudades</h3><div class="fr-lista fr-lista-chica">${vis.map(ci => `<button type="button" class="fr-soldado fr-soldado-chico" data-ciu="${ci.id}"><span class="fr-soldado-nombre">${esc(ci.nombre)}${ci.capital ? " (capital)" : ""}</span><span class="fr-soldado-meta">${ci.dueno === null ? "Sin dueño" : ci.dueno === H ? "Tuya" : "Del rival"} · nivel ${ci.nivel}</span></button>`).join("")}</div>
      <h3 class="fr-h3">Fragmentos</h3><div class="fr-lista fr-lista-chica">${est.regiones.map(r => `<div class="fr-soldado fr-soldado-chico"><span class="fr-soldado-nombre">${esc(r.nombre)}</span><span class="fr-soldado-meta">${r.tipo} · estabilidad ${r.estab}${r.dueno === H ? " · tuyo" : r.dueno === 1 - H ? " · rival" : ""}</span></div>`).join("")}</div>`;
  }

  function latSaber(c) {
    const H = humano();
    const jug = est.jugadores[H];
    c.innerHTML = Object.keys(ESCUELAS).map(k => {
      const esc0 = ESCUELAS[k];
      return `<h3 class="fr-h3">${esc0.nombre}</h3>${esc0.escalones.map((e, i) => {
        const hecho = jug.tech[k] > i, siguiente = jug.tech[k] === i;
        const coste = siguiente ? FM.costeInvestigar(est, H, k) : e.coste;
        const razon = siguiente ? FM.razonNoInvestigar(est, H, k) : null;
        return `<div class="fr-saber ${hecho ? "fr-hecho" : ""}"><div><strong>${["I", "II", "III", "IV"][i]}. ${esc(e.nombre)}</strong><p class="fr-sub">${esc(e.texto)}</p></div>
          ${hecho ? "<em>Dominado</em>" : siguiente ? `<button type="button" class="fr-btn fr-btn-chico" data-investiga="${k}"${razon || !soyYo() ? " disabled" : ""} title="${esc(razon || "")}">${esc(costeTexto(coste))}</button>` : "<em>Antes, el escalón anterior</em>"}</div>`;
      }).join("")}`;
    }).join("");
  }

  function latRegistro(c) {
    c.innerHTML = `<h3 class="fr-h3">Registro</h3><ol class="fr-registro">${est.log.slice(-50).reverse().map(l => `<li class="fr-log-${esc(l.tipo)}"><b>${l.t}.</b> ${esc(l.texto)}</li>`).join("")}</ol>`;
  }

  $("frLateral").addEventListener("click", async ev => {
    const t = ev.target;
    const H = humano();
    const un = t.closest("[data-uid]");
    if (un) { sel = { uid: un.dataset.uid, ciudad: null }; refrescar(); return; }
    const ciu = t.closest("[data-ciu]");
    if (ciu) { sel = { uid: null, ciudad: ciu.dataset.ciu }; lat = "sel"; refrescar(); return; }
    if (!soyYo()) return;
    let r = null;
    const rec = t.closest("[data-recluta]"), con = t.closest("[data-construye]"), mej = t.closest("[data-mejora]"), inv = t.closest("[data-investiga]"), hab = t.closest("[data-hab]");
    if (rec && sel.ciudad) r = FM.aplicar(est, { t: "reclutar", ciudad: sel.ciudad, clase: rec.dataset.recluta });
    else if (con && sel.ciudad) r = FM.aplicar(est, { t: "construir", ciudad: sel.ciudad, edificio: con.dataset.construye });
    else if (mej) r = FM.aplicar(est, { t: "mejorar", ciudad: mej.dataset.mejora });
    else if (inv) r = FM.aplicar(est, { t: "investigar", escuela: inv.dataset.investiga });
    else if (hab) {
      const u = sel.uid && est.unidades[sel.uid];
      if (!u) return;
      const id = hab.dataset.hab;
      if (id === "alterar") { modo = { id: "alterar", a: hab.dataset.a }; refrescar(); return; }
      if (id === "sabotear") r = FM.aplicar(est, { t: "habilidad", id, uid: u.uid, x: Number(hab.dataset.x), y: Number(hab.dataset.y), edificio: hab.dataset.ed });
      if (id === "reanimar") r = FM.aplicar(est, { t: "habilidad", id, uid: u.uid, x: Number(hab.dataset.x), y: Number(hab.dataset.y) });
    }
    if (r) { if (!r.ok) aviso(r.error, true); if (r.uid) { sel = { uid: r.uid, ciudad: null }; } despuesDeAccion(); }
    void H;
  });

  /* --- Fin del turno y turno del rival --- */
  $("frTerminar").addEventListener("click", async () => {
    if (!soyYo()) return;
    // Aviso si quedan unidades sin mover
    const sinActuar = FM.unidadesDe(est, humano()).filter(u => !u.lider && u.pm > 0 && !u.atacado && u.quieto).length;
    if (sinActuar >= 3 && !(await dialogo.confirmar(`Tienes ${sinActuar} unidades sin mover. ¿Terminar el turno?`, { aceptar: "Terminar" }))) return;
    sel = { uid: null, ciudad: null }; modo = null;
    FM.aplicar(est, { t: "terminar" });
    refrescar();
    if (est.ganador !== null) { terminarGuerraUI(); return; }
    cartel("Turno del rival");
    setTimeout(() => {
      const antes = est.log.length;
      let guard = 0;
      while (est.ganador === null && est.activo !== humano() && guard++ < 3) IA.turnoCompleto(est, est.activo);
      void antes;
      cartel(null);
      refrescar();
      guardarEnCurso();
      if (est.ganador !== null) terminarGuerraUI();
      else if (est.activo === humano()) cartel(`Turno ${est.turno}`, 900);
    }, 450);
  });

  $("frRendirse").addEventListener("click", async () => {
    if (!soyYo()) return;
    if (!(await dialogo.confirmar("Rendirte cuenta como derrota. Los soldados que lleves conservarán lo que hayan ganado, pero perderás lo que no hayas recuperado.", { titulo: "Rendirse", aceptar: "Rendirme", peligro: true }))) return;
    FM.terminarGuerra(est, 1, `${est.jugadores[0].nombre} se rinde.`);
    refrescar();
    terminarGuerraUI();
  });

  function cartel(t, ms) {
    const el = $("frCartel");
    el.textContent = t || "";
    el.classList.toggle("hidden", !t);
    if (t && ms) setTimeout(() => el.classList.add("hidden"), ms);
  }

  /* =========================================================================
     FINAL
  ========================================================================= */
  let finHecho = false;
  async function terminarGuerraUI() {
    if (finHecho) return;
    finHecho = true;
    musicaPartida(false);
    const resumen = C.cerrarGuerra(ej, est, null, humano());
    const narr = CR.narrar(est, ej, resumen, humano());
    const reg = resumen.registro;
    reg.titulo = narr.titulo; reg.parrafos = narr.parrafos.slice(0, 12);
    ultimoResumen = { resumen, narr, reg, estFin: est };
    Red.borrarGuerra();
    await guardar();
    const id = await Red.registrarGuerra({ ejercito: ej.nombre, faccion: ej.faccion, rival: reg.rival, tipo: reg.tipo, resultado: reg.resultado, turnos: reg.turnos, razon: reg.razon || "", bajas: reg.bajas, logros: reg.logros, titulo: narr.titulo, cronica: narr.parrafos.slice(0, 12), anio: reg.anio });
    ultimoResumen.guerraId = id;
    pantallaFin();
  }

  function pantallaFin() {
    const { resumen, narr, reg } = ultimoResumen;
    mostrar("frFin");
    const premio = resumen.gano && ultimoResumen.guerraId && !ultimoResumen.premiado;
    const pend = C.pendientesDeAscenso(ej);
    $("frFin").innerHTML = `
      <p class="eyebrow">${resumen.gano ? "VICTORIA" : resumen.perdio ? "DERROTA" : "TABLAS"}</p>
      <h2 class="fr-h2">${esc(narr.titulo)}</h2>
      <div class="fr-cronica-texto">${narr.parrafos.map(p => `<p>${esc(p)}</p>`).join("")}</div>
      ${pend.length ? `<div class="fr-banner"><p><strong>Veterano${pend.length === 1 ? "" : "s"} listo${pend.length === 1 ? "" : "s"} para especializarse.</strong></p><div class="fr-fila">${pend.map(s => `<button type="button" class="fr-btn fr-btn-chico" data-ficha-fin="${s.id}">${esc(nombre(s))}</button>`).join("")}</div></div>` : ""}
      ${premio ? `<div class="fr-banner"><p>Ganar esta guerra merece una carta de Triunfos.</p><button type="button" class="fr-btn fr-btn-principal" data-premio>Reclamar la carta</button></div>` : ""}
      ${resumen.gano && !ultimoResumen.guerraId ? `<p class="fr-sub">Inicia sesión antes de la próxima guerra para guardar la historia y ganar cartas.</p>` : ""}
      <div class="fr-fila"><button type="button" class="fr-btn fr-btn-principal" data-volver>Volver al cuartel</button></div>`;
    finHecho = false;
  }
  $("frFin").addEventListener("click", async ev => {
    const t = ev.target;
    if (t.closest("[data-volver]")) { entrarCuartel("guerra"); return; }
    const f = t.closest("[data-ficha-fin]");
    if (f) { abrirFicha(f.dataset.fichaFin); $("frFicha").addEventListener("close", () => { if (!$("frFin").classList.contains("hidden")) pantallaFin(); }, { once: true }); return; }
    if (t.closest("[data-premio]")) {
      try {
        const r = await Red.pedirPremio(ultimoResumen.guerraId);
        ultimoResumen.premiado = true;
        const carta = window.cartaPorId ? window.cartaPorId(r.carta) : null;
        await dialogo.avisar(`Has ganado la carta ${carta ? carta.nombre : r.carta} (${r.rareza}).`, { titulo: "Premio de la Fractura" });
      } catch (e) {
        await dialogo.avisar(`No se pudo dar el premio: ${e.message || e}. ¿Corriste scratchpad/fractura.sql en Supabase?`);
      }
      pantallaFin();
    }
  });

  window.addEventListener("pagehide", () => { if (est && est.ganador === null) Red.guardarGuerra(est, cfgGuerraActual); });

  pantallaInicio();
})();
