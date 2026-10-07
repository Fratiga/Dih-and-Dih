/* =============================================================================
   LABORATORIO DEL BUFÓN — INTERFAZ (solo Admin; el motor está en
   js/bufon-lab-motor.js).

   Cuatro pestañas dentro de la pestaña "Laboratorio del Bufón" del panel de
   Admin:
     Jugar      el Bufón real en un marco, con un jugador de prueba aislado
     Ciclos     los ciclos 1, 2, 3... y todo lo que corresponde a cada uno
     Editor     crear y editar ciclos y temas con formularios, probarlos al
                instante y sacar el archivo listo para publicar
     Auditoría  cientos de visitas automáticas que buscan errores

   Todo lo que se guarda (configuración, borradores) vive en el localStorage
   de ESTE navegador. Nada va a Supabase ni al repositorio: para publicar un
   ciclo hay que copiar o descargar el archivo y subirlo (ver LEEME en el
   propio editor).
============================================================================= */
(function () {
  "use strict";
  const M = window.BufonLabMotor;
  const raiz = document.getElementById("bufonLabRaiz");
  if (!M || !raiz) return;

  const KEY_CFG = "bufonLab_cfg_v1";
  const KEY_BORR = "bufonLab_borradores_v1";

  /* ---------- utilidades ---------- */
  function h(tag, attrs, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    hijos.flat(Infinity).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }
  const leerJson = (k, d) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : d; } catch (e) { return d; } };
  const guardarJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ } };
  const unico = a => Array.from(new Set(a));
  // Quita los vacíos antes de append/replaceChildren (si no, un null se dibuja como el texto "null").
  const bien = (...xs) => xs.flat(Infinity).filter(x => x != null && x !== false);
  const lista = s => String(s || "").split(",").map(x => x.trim()).filter(Boolean);
  const copiar = async txt => { try { await navigator.clipboard.writeText(txt); return true; } catch (e) { return false; } };

  /* ---------- estado ---------- */
  const cfg = Object.assign({
    lado: "B", nombre: "", cuenta: "", ciclo: 1, admin: false,
    usarBorradores: true, modelo3d: false, almacen: {}, nombresTexto: ""
  }, leerJson(KEY_CFG, {}));
  let borradores = leerJson(KEY_BORR, []);
  borradores.forEach(b => { if (b.numero === undefined) b.numero = ""; }); // borradores de antes de que los ciclos tuvieran número
  let borradorActual = borradores.length ? borradores[0].id : null;
  let meta = null;
  let L = null;
  let pg = null;
  let visitas = 0;
  let pendiente = false;
  const guardarCfg = () => guardarJson(KEY_CFG, cfg);
  const guardarBorradores = () => guardarJson(KEY_BORR, borradores);

  /* ---------- esqueleto con pestañas ---------- */
  const paneles = {};
  const botonesTab = {};
  function pestana(id, titulo) {
    paneles[id] = h("div", { class: "blab-panel", "data-blab": id });
    botonesTab[id] = h("button", { type: "button", class: "blab-tab", onclick: () => mostrar(id) }, titulo);
    return paneles[id];
  }
  function mostrar(id) {
    Object.keys(paneles).forEach(k => {
      paneles[k].classList.toggle("activo", k === id);
      botonesTab[k].classList.toggle("activo", k === id);
    });
    if (id === "jugar") pintarEstado();
    if (id === "ciclos") pintarCiclos();
    if (id === "editor") renderEditor();
  }

  /* =========================================================================
     JUGAR
  ========================================================================= */
  const marco = h("div", { class: "blab-marco" }, h("p", { class: "blab-vacio" }, "Pulsa «Nueva visita» para abrir el Bufón."));
  const avisoPendiente = h("p", { class: "blab-pendiente oculto" }, "Cambiaste la configuración. Pulsa «Nueva visita» para aplicarla.");
  const panelEstado = h("div", { class: "blab-estado" });
  const contVisitas = h("span", { class: "blab-contador" }, "Visita 0");
  const listaCiclosCtrl = h("div", { class: "blab-ciclos-ctrl" });

  function marcarPendiente() { pendiente = true; avisoPendiente.classList.remove("oculto"); }

  function campo(etiqueta, control, ayuda) {
    return h("label", { class: "blab-campo" }, h("span", null, etiqueta), control, ayuda ? h("small", null, ayuda) : null);
  }
  function casilla(etiqueta, valor, alCambiar, ayuda) {
    return h("label", { class: "blab-casilla" },
      h("input", { type: "checkbox", checked: valor, onchange: e => alCambiar(e.target.checked) }),
      h("span", null, etiqueta, ayuda ? h("small", null, ayuda) : null));
  }

  /* Los ciclos del selector: los de data/bufon-ciclos-lista.js más el número de los borradores. */
  function listaDeCiclos() {
    const base = meta ? meta.lista.map(c => ({ numero: c.numero, nombre: c.nombre })) : [{ numero: 1, nombre: "Contenido original" }, { numero: 2, nombre: "Lo que queda" }];
    if (cfg.usarBorradores) borradores.forEach(b => {
      const n = parseInt(b.numero, 10);
      if (Number.isInteger(n) && !base.some(c => c.numero === n)) base.push({ numero: n, nombre: (b.nombre || b.id) + " (borrador)" });
    });
    return base.sort((a, b) => a.numero - b.numero);
  }
  const nombreDelCiclo = n => { const c = listaDeCiclos().find(x => x.numero === n); return c ? c.nombre : ""; };
  const selCiclo = h("select", { onchange: e => { cfg.ciclo = parseInt(e.target.value, 10); guardarCfg(); marcarPendiente(); } });
  function pintarCiclosCtrl() {
    selCiclo.replaceChildren(
      ...listaDeCiclos().map(c => h("option", { value: String(c.numero), selected: (Number.isInteger(cfg.ciclo) ? cfg.ciclo : 1) === c.numero }, "Ciclo " + c.numero + ": " + c.nombre)));
  }

  function controles() {
    const radios = ["A", "B"].map(lado => h("label", { class: "blab-radio" },
      h("input", { type: "radio", name: "blabLado", value: lado, checked: cfg.lado === lado, onchange: () => { cfg.lado = lado; guardarCfg(); marcarPendiente(); } }),
      "Side " + lado));
    return h("div", { class: "blab-controles" },
      h("h4", null, "Jugador de prueba"),
      h("div", { class: "blab-fila-radios" }, radios),
      campo("Nombre de su cuenta", h("input", { type: "text", value: cfg.cuenta, placeholder: "(ninguna)", onchange: e => { cfg.cuenta = e.target.value.trim(); guardarCfg(); marcarPendiente(); } }), "Es lo ÚNICO que el Bufón usa para reconocer a un jugador. Los jugadores de la campaña son las cuentas con personajes en «Mis personajes»."),
      campo("Nombre que escribió en el Bufón", h("input", { type: "text", value: cfg.nombre, placeholder: "(ninguno)", onchange: e => { cfg.nombre = e.target.value.trim(); guardarCfg(); marcarPendiente(); } }), "Ya no sirve para reconocer a nadie. Solo cambia lo que el Bufón le dice a alguna cuenta concreta."),
      h("h4", null, "Ciclo"),
      campo("Ciclo del jugador", selCiclo, "Como el interruptor del Admin: el jugador solo recibe el contenido de ese ciclo."),
      h("button", { type: "button", class: "secondary-button blab-agregar", title: "Un jugador automático juega todo el contenido original hasta la despedida y deja el resultado en este jugador de prueba", onclick: terminarOriginal }, "Hacer que agote el ciclo 1 (juega solo)"),
      casilla("Modo Admin del Bufón", cfg.admin, v => { cfg.admin = v; guardarCfg(); marcarPendiente(); }, "Ve todos los ciclos a la vez, mezclados."),
      h("h4", null, "Opciones"),
      casilla("Incluir los borradores del Editor", cfg.usarBorradores, v => { cfg.usarBorradores = v; guardarCfg(); marcarPendiente(); pintarCiclosCtrl(); }),
      casilla("Con modelo 3D", cfg.modelo3d, v => { cfg.modelo3d = v; guardarCfg(); marcarPendiente(); }, "Más lento. Solo para ver cómo luce."),
      h("div", { class: "blab-botones" },
        h("button", { type: "button", class: "primary-button", onclick: nuevaVisita }, "Nueva visita"),
        h("button", { type: "button", class: "secondary-button", onclick: reiniciarJugador }, "Reiniciar jugador"),
        h("button", { type: "button", class: "secondary-button", title: "Vuelve a leer secreto.html y los archivos de data/ (si los cambiaste desde que abriste esta página)", onclick: recargarMotor }, "Recargar archivos")),
      avisoPendiente,
      h("p", { class: "blab-nota" }, "Tu sesión, tu lado y tu avance reales no se tocan, y nada llega a Supabase. «Nueva visita» es como volver a abrir la página con el mismo jugador. «Reiniciar jugador» borra todo lo que ha hablado.")
    );
  }

  let guardadoPendiente = null;
  function persistirAlmacen() {
    clearTimeout(guardadoPendiente);
    guardadoPendiente = setTimeout(() => { if (L) { cfg.almacen = L.local._volcar(); guardarCfg(); } }, 300);
  }

  function borradoresActivos() {
    return cfg.usarBorradores ? borradores.map(aConfig) : [];
  }

  async function nuevaVisita() {
    if (pg) { pg.cerrar(); pg = null; }
    marco.replaceChildren(h("p", { class: "blab-vacio" }, "Abriendo..."));
    try {
      if (!meta) await cargarMeta();
      L = M.nuevoEstado({ lado: cfg.lado, cuenta: cfg.cuenta, admin: cfg.admin, local: cfg.almacen, ciclo: cfg.ciclo });
      if (cfg.nombre) L.local.setItem("jesterPlayerName", cfg.nombre); else L.local.removeItem("jesterPlayerName");
      L.local.alCambiar = persistirAlmacen;
      persistirAlmacen();
      marco.replaceChildren();
      pg = await M.crearPagina(L, { contenedor: marco, clase: "blab-iframe", borradores: borradoresActivos(), modelo3d: cfg.modelo3d });
      visitas++;
      contVisitas.textContent = "Visita " + visitas;
      pendiente = false; avisoPendiente.classList.add("oculto");
      pintarEstado();
    } catch (e) {
      marco.replaceChildren(h("p", { class: "blab-error" }, "No pude abrir el Bufón: " + e.message));
    }
  }
  /* Un jugador automático juega el contenido original (ciclo 1) hasta la despedida, como
     lo haría uno real, y deja el resultado en el jugador de prueba. Sirve para probar, por
     ejemplo, para ver el aviso de que un jugador agotó su ciclo. */
  async function terminarOriginal() {
    if (pg) { pg.cerrar(); pg = null; }
    if (L) { L.local.alCambiar = null; cfg.almacen = L.local._volcar(); L = null; }
    marco.replaceChildren(h("p", { class: "blab-vacio" }, "Jugando el contenido original..."));
    let terminado = false;
    try {
      const E = M.nuevoEstado({ lado: cfg.lado, cuenta: cfg.cuenta, local: cfg.almacen, ciclo: 1 });
      if (cfg.nombre) E.local.setItem("jesterPlayerName", cfg.nombre);
      const rnd = M.rng(7);
      for (let i = 0; i < 4 && !terminado; i++) {
        await M.jugarVisita(E, { rnd, maxHub: 999, estrategia: "orden", esperaMs: 60, borradores: [] });
        try { terminado = JSON.parse(E.local.getItem("bufonHistorial") || "[]").some(e => e.eleccionId === "__completado__" && e.opcionId === "goodbye_ever"); } catch (e) { terminado = false; }
      }
      cfg.almacen = E.local._volcar();
      guardarCfg();
    } catch (e) {
      marco.replaceChildren(h("p", { class: "blab-error" }, "No pude jugarlo: " + e.message));
      return;
    }
    marco.replaceChildren(h("p", { class: "blab-vacio" }, terminado ? "Listo: el jugador terminó el contenido original. Pulsa «Nueva visita»." : "El jugador automático no llegó a la despedida. Pulsa «Nueva visita» para ver cómo quedó."));
    marcarPendiente();
  }

  async function recargarMotor() {
    M.olvidarTextos(); meta = null;
    await cargarMeta().catch(() => {});
    await nuevaVisita();
  }
  function reiniciarJugador() {
    if (!confirm("¿Borrar todo lo que este jugador de prueba ha hablado?")) return;
    cfg.almacen = {}; guardarCfg();
    nuevaVisita();
  }

  function pintarEstado() {
    panelEstado.replaceChildren();
    if (!pg || !pg.win) { panelEstado.append(h("p", { class: "blab-vacio" }, "Sin visita abierta.")); return; }
    let ctx = null;
    try { ctx = pg.win.construirContexto(); } catch (e) { panelEstado.append(h("p", { class: "blab-error" }, "No pude leer el estado: " + e.message)); return; }
    const hist = (() => { try { return JSON.parse(L.local.getItem("bufonHistorial") || "[]"); } catch (e) { return []; } })();
    const hechos = hist.filter(e => e.eleccionId === "__completado__").map(e => e.opcionId);
    const filas = [];
    filas.push(["Lado", ctx.actualCampaign || "(ninguno)"]);
    filas.push(["Ciclo de este jugador", ctx.ciclo + ": " + nombreDelCiclo(ctx.ciclo) + (cfg.admin ? " (en modo Admin ve todos a la vez)" : "")]);
    filas.push(["Elecciones hechas", String(ctx.totalChoices)]);
    filas.push(["Toques a la puerta", String(L.toques)]);
    Object.keys(meta ? meta.ciclos : {}).concat(borradoresActivos().map(b => b.id)).filter((x, i, a) => a.indexOf(x) === i).forEach(id => {
      let abierto = false; try { abierto = ctx.cicloAbierto(id); } catch (e) { /* ciclo no cargado */ }
      filas.push(["Archivo " + id, abierto ? "lo recibe este jugador" : "no lo recibe este jugador"]);
    });
    const voces = (meta ? meta.voces : []).map(v => v + ": " + (ctx.innerVoices[v] || 0) + " pts, etapa " + ctx.voiceStage(v)).join(" · ");
    filas.push(["Voces", voces]);
    filas.push(["Temas completados (" + hechos.length + ")", hechos.join(", ") || "(ninguno)"]);
    const dl = h("dl", { class: "blab-dl" });
    filas.forEach(([k, v]) => dl.append(h("dt", null, k), h("dd", null, v)));
    panelEstado.append(dl);
    if (L.errores.length) panelEstado.append(h("p", { class: "blab-error" }, "Errores de JavaScript en el Bufón: " + L.errores.join(" | ")));
    const ev = L.eventos.slice(-12).map(e => e.cat + " · " + (e.dialogo || "") + " → " + (e.opcion || ""));
    panelEstado.append(h("details", { class: "blab-detalle" }, h("summary", null, "Lo que se habría guardado en Supabase (últimos " + ev.length + " de " + L.eventos.length + ")"), h("pre", null, ev.join("\n") || "(nada todavía)")));
  }
  setInterval(() => { if (paneles.jugar && paneles.jugar.classList.contains("activo") && pg) pintarEstado(); }, 1500);

  const pJugar = pestana("jugar", "Jugar");
  pJugar.append(h("div", { class: "blab-jugar" },
    controles(),
    h("div", { class: "blab-escena" },
      h("div", { class: "blab-barra" }, contVisitas, h("span", { class: "blab-nota" }, "Haz click en la puerta como lo haría un jugador.")),
      marco,
      h("h4", null, "Estado del jugador"),
      panelEstado)));

  /* =========================================================================
     CICLOS
  ========================================================================= */
  const pCiclos = pestana("ciclos", "Ciclos");
  async function cargarMeta() {
    meta = await M.leerMeta(borradoresActivos());
    pintarCiclosCtrl();
    return meta;
  }
  async function pintarCiclos() {
    pCiclos.replaceChildren(h("p", { class: "blab-vacio" }, "Leyendo ciclos..."));
    try { await cargarMeta(); } catch (e) { pCiclos.replaceChildren(h("p", { class: "blab-error" }, "No pude leer los ciclos: " + e.message)); return; }
    const tarjetas = meta.lista.map(c => {
      const modulo = Object.values(meta.ciclos).find(m => m.numero === c.numero);
      const botones = meta.botones.filter(b => b.ciclo === c.numero);
      const nodos = Object.values(meta.duenoDeNodo).filter(n => n === c.numero).length;
      return h("div", { class: "blab-tarjeta" },
        h("div", { class: "blab-tarjeta-top" },
          h("strong", null, "Ciclo " + c.numero + ": " + c.nombre),
          modulo ? h("code", null, "data/bufon-ciclo-" + modulo.id + ".js") : h("span", { class: "blab-etiqueta cerrado" }, "escrito a mano en bufon-contenido.js")),
        h("p", { class: "blab-nota" }, botones.length + " botón(es) en el menú principal · " + nodos + " nodos" + (modulo ? " · Lados: " + (modulo.lados ? modulo.lados.join(", ") : "A y B") : "")),
        botones.length ? h("div", { class: "blab-tema-fila" }, botones.map(b => "«" + b.texto + "»").join(" · ")) : null,
        modulo ? modulo.temas.map(t => h("div", { class: "blab-tema-fila" },
          h("strong", null, t.id), " · botón «" + t.boton + "» · " + t.preguntas + " pregunta(s), " + t.grupos + " grupo(s) de respuestas excluyentes, " + t.nodos.length + " nodos")) : null,
        c.numero === 1 ? h("p", { class: "blab-nota" }, "Además de los botones: los recuerdos con los que el Bufón arranca solo (mascota, Gareth, dragón, refugio...).") : null,
        c.numero === 2 ? h("p", { class: "blab-nota" }, "Además de los botones: los comentarios con los que el Bufón arranca solo (Eledar, Cassius, Torvrena, Ryn, rumores del juicio, la muerte de Eledar de Side A).") : null,
        h("div", { class: "blab-botones" },
          h("button", { type: "button", class: "secondary-button", onclick: () => { cfg.ciclo = c.numero; guardarCfg(); marcarPendiente(); pintarCiclosCtrl(); mostrar("jugar"); } }, "Probarlo en Jugar"),
          modulo ? h("button", { type: "button", class: "secondary-button", onclick: () => importarCiclo(modulo.id) }, "Editarlo en el Editor") : null));
    });
    pCiclos.replaceChildren(...bien(
      h("p", { class: "blab-nota" }, "Cada jugador está en UN ciclo y solo recibe el contenido de ese ciclo. Tú los mueves (a un lado entero o a un jugador) desde Progreso del Bufón. Nada avanza solo: todos empiezan en el ciclo 1 y el panel te avisa cuando agotan el suyo para que los avances tú. Los ciclos 3 en adelante son archivos que se crean en el Editor."),
      meta.errores.length ? h("div", { class: "blab-error" }, meta.errores.map(e => h("p", null, "Ciclo mal escrito: " + e))) : null,
      tarjetas,
      h("details", { class: "blab-detalle" }, h("summary", null, "Cómo se agrega un ciclo nuevo"),
        h("p", null, "En el Editor, crea un ciclo con el número siguiente (3 o más), arma sus temas y descarga el archivo. Agrega su número y nombre a data/bufon-ciclos-lista.js, ponlo en secreto.html como los demás y publica. Nadie lo recibe hasta que muevas a un jugador o a un lado a ese número desde Progreso del Bufón."))));
  }

  /* =========================================================================
     EDITOR
  ========================================================================= */
  const pEditor = pestana("editor", "Editor");
  let resultadoValidacion = null;
  let timerValidar = null;

  function parseLineas(txt) {
    return String(txt || "").split("\n").map(s => s.trim()).filter(Boolean).map(l => {
      const m = /^([a-z]+)>\s*(.+)$/.exec(l);
      return m ? { voz: m[1], texto: m[2] } : l;
    });
  }
  // "herida +1, rostro +2" <-> { herida: 1, rostro: 2 }
  function parseVoces(txt) {
    const o = {};
    lista(txt).forEach(item => {
      const m = /^([^\s+\-\d]+)\s*([+-]?\d+(?:\.\d+)?)?$/.exec(item);
      if (m) o[m[1].toLowerCase()] = m[2] === undefined ? 1 : parseFloat(m[2]);
      else o[item] = 0;
    });
    return o;
  }
  const vocesATexto = o => Object.keys(o || {}).map(v => v + " " + (o[v] > 0 ? "+" : "") + o[v]).join(", ");
  // Campos que comparten temas, preguntas y respuestas: se escriben solo si tienen algo.
  function extrasAConfig(x, o) {
    if (lista(x.tras).length) o.tras = lista(x.tras);
    if (lista(x.hechos).length) o.hechos = lista(x.hechos);
    if (x.animacion) o.animacion = x.animacion.trim();
    const r = parseInt(x.risa, 10); if (r > 0) o.risa = r;
    return o;
  }
  const extrasDesdeConfig = x => ({ tras: (x.tras || []).join(", "), hechos: (x.hechos || []).join(", "), animacion: x.animacion || "", risa: x.risa ? String(x.risa) : "" });
  const lineasATexto = arr => (arr || []).map(l => typeof l === "string" ? l : l.voz + "> " + l.texto).join("\n");

  function aConfig(b) {
    const cfgCiclo = { id: b.id, numero: parseInt(b.numero, 10), nombre: b.nombre || b.id };
    if (lista(b.lados).length) cfgCiclo.lados = lista(b.lados);
    cfgCiclo.temas = b.temas.map(t => {
      const tc = { id: t.id, boton: t.boton };
      if ((t.cerrar || "").trim()) tc.cerrar = t.cerrar.trim();
      if (lista(t.tras).length) tc.tras = lista(t.tras);
      if (lista(t.hechos).length) tc.hechos = lista(t.hechos);
      tc.intro = { como: t.como === "boton" ? "boton" : "recuerdo", lineas: parseLineas(t.intro) };
      if (t.introAnimacion) tc.intro.animacion = t.introAnimacion.trim();
      const ir = parseInt(t.introRisa, 10); if (ir > 0) tc.intro.risa = ir;
      tc.preguntas = t.preguntas.map(p => {
        const o = { id: p.id, texto: p.texto };
        if (lista(p.requiere).length) o.requiere = lista(p.requiere);
        if (p.voz) o.voz = p.voz;
        if (p.cierra) o.cierra = true;
        if (p.fin) o.fin = true;
        if (lista(p.voces).length) o.voces = parseVoces(p.voces);
        extrasAConfig(p, o);
        o.lineas = parseLineas(p.lineas);
        return o;
      });
      tc.grupos = t.grupos.map(g => {
        const go = { id: g.id, requiere: lista(g.requiere) };
        extrasAConfig(g, go);
        go.opciones = g.opciones.map(o => {
          const x = { id: o.id, texto: o.texto };
          if (o.neutral) x.neutral = true; if (o.cierra) x.cierra = true; if (o.fin) x.fin = true;
          if (lista(o.voces).length) x.voces = parseVoces(o.voces);
          const r = parseInt(o.risa, 10); if (o.animacion) x.animacion = o.animacion.trim(); if (r > 0) x.risa = r;
          x.lineas = parseLineas(o.lineas);
          return x;
        });
        return go;
      });
      return tc;
    });
    return cfgCiclo;
  }

  function desdeConfig(def) {
    return {
      id: def.id, numero: def.numero, nombre: def.nombre || def.id, lados: (def.lados || []).join(", "),
      temas: (def.temas || []).map(t => ({
        id: t.id, boton: t.boton, cerrar: t.cerrar || "", tras: (t.tras || []).join(", "), hechos: (t.hechos || []).join(", "),
        como: t.intro && t.intro.como === "boton" ? "boton" : "recuerdo", intro: lineasATexto(t.intro && t.intro.lineas),
        introAnimacion: (t.intro && t.intro.animacion) || "", introRisa: t.intro && t.intro.risa ? String(t.intro.risa) : "",
        preguntas: (t.preguntas || []).map(p => Object.assign({ id: p.id, texto: p.texto, requiere: (p.requiere || []).join(", "), voz: p.voz || "", cierra: !!p.cierra, fin: !!p.fin, voces: vocesATexto(p.voces), lineas: lineasATexto(p.lineas) }, extrasDesdeConfig(p))),
        grupos: (t.grupos || []).map(g => Object.assign({ id: g.id, requiere: (g.requiere || []).join(", "), opciones: (g.opciones || []).map(o => Object.assign({ id: o.id, texto: o.texto, neutral: !!o.neutral, cierra: !!o.cierra, fin: !!o.fin, voces: vocesATexto(o.voces), lineas: lineasATexto(o.lineas) }, extrasDesdeConfig(o))) }, extrasDesdeConfig(g)))
      }))
    };
  }

  /* Serializa a JavaScript legible (claves sin comillas, textos largos en su propia línea). */
  function aJs(v, ind) {
    ind = ind || "";
    if (typeof v === "string") return JSON.stringify(v);
    if (v == null || typeof v === "number" || typeof v === "boolean") return String(v);
    const sig = ind + "  ";
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      if (v.every(x => typeof x === "string") && v.length === 1 && v[0].length < 70) return "[" + aJs(v[0]) + "]";
      return "[\n" + v.map(x => sig + aJs(x, sig)).join(",\n") + "\n" + ind + "]";
    }
    const claves = Object.keys(v).filter(k => v[k] !== undefined);
    const clave = k => /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    const simple = claves.every(k => v[k] === null || typeof v[k] !== "object");
    const enLinea = "{ " + claves.map(k => clave(k) + ": " + aJs(v[k])).join(", ") + " }";
    if (simple && enLinea.length < 90) return enLinea;
    return "{\n" + claves.map(k => sig + clave(k) + ": " + aJs(v[k], sig)).join(",\n") + "\n" + ind + "}";
  }

  function archivoDe(b) {
    const c = aConfig(b);
    const fecha = new Date().toISOString().slice(0, 10);
    return "/* =============================================================================\n" +
      "   CICLO: " + (b.nombre || b.id) + ".\n\n" +
      "   Generado con el Laboratorio del Bufón (" + fecha + "). Lo reciben solo los\n" +
      "   jugadores que estén en el ciclo " + c.numero + " (el Admin los mueve desde Progreso del\n" +
      "   Bufón). Admin siempre lo ve. Su número debe estar en data/bufon-ciclos-lista.js.\n" +
      "   Formato y reglas: ver data/bufon-ciclos.js.\n" +
      "============================================================================= */\n" +
      "window.bufonAgregarCiclo(" + aJs(c) + ");\n";
  }
  function temaDe(b, i) { return aJs(aConfig(b).temas[i], "    "); }

  function avisosDeImportacion(def) {
    const notas = [];
    if (!def) return notas;
    ["nodos", "elecciones", "recuerdos"].forEach(k => { if (def[k] && Object.keys(def[k]).length) notas.push("usa «" + k + "» sueltos"); });
    return notas;
  }

  async function importarCiclo(id) {
    if (!meta) await cargarMeta();
    const def = meta.defs[id];
    if (!def) { alert("Ese ciclo no se puede cargar en el editor."); return; }
    if (borradores.some(b => b.id === id) && !confirm("Ya tienes un borrador con ese id. ¿Reemplazarlo con el ciclo tal como está en su archivo?")) return;
    borradores = borradores.filter(b => b.id !== id);
    borradores.push(desdeConfig(def));
    borradorActual = id;
    guardarBorradores();
    mostrar("editor");
  }

  /* --- rutas "temas.0.preguntas.1.texto" --- */
  function porRuta(obj, ruta) { return ruta === "" ? obj : ruta.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
  function ponerEnRuta(obj, ruta, valor) {
    const partes = ruta.split(".");
    const ultimo = partes.pop();
    porRuta(obj, partes.join("."))[ultimo] = valor;
  }
  const bActual = () => borradores.find(b => b.id === borradorActual) || null;

  function programarValidacion() {
    clearTimeout(timerValidar);
    timerValidar = setTimeout(validarActual, 700);
  }
  async function validarActual() {
    const b = bActual();
    if (!b) return;
    try {
      const m = await M.leerMeta([aConfig(b)]);
      const filas = [];
      m.errores.filter(e => e.indexOf(b.id + ":") === 0 || e.indexOf(b.id) === 0).forEach(e => filas.push({ n: "x", t: e }));
      m.errores.filter(e => !(e.indexOf(b.id) === 0)).forEach(e => filas.push({ n: "x", t: "(otro ciclo) " + e }));
      m.avisos.filter(a => a.indexOf('ciclo "' + b.id + '"') === 0).forEach(a => filas.push({ n: "!", t: a }));
      const c = aConfig(b);
      const visitar = (donde, lineas) => (lineas || []).forEach((l, i) => {
        const texto = typeof l === "string" ? l : l.texto;
        M.revisarTexto(texto).forEach(r => filas.push({ n: r.nivel, t: donde + ", línea " + (i + 1) + ": " + r.msg + " «" + texto.slice(0, 70) + "»" }));
      });
      c.temas.forEach(t => {
        visitar("Tema «" + t.id + "», intro", t.intro.lineas);
        t.preguntas.forEach(p => { visitar("«" + t.id + "» pregunta «" + p.id + "»", p.lineas); M.revisarTexto(p.texto).forEach(r => filas.push({ n: r.nivel, t: "Botón de la pregunta «" + p.id + "»: " + r.msg })); });
        t.grupos.forEach(g => g.opciones.forEach(o => visitar("«" + t.id + "» respuesta «" + g.id + "/" + o.id + "»", o.lineas)));
      });
      resultadoValidacion = { id: b.id, filas };
    } catch (e) {
      resultadoValidacion = { id: b.id, filas: [{ n: "x", t: "No pude validar: " + e.message }] };
    }
    pintarValidacion();
  }
  const cajaValidacion = h("div", { class: "blab-validacion" });
  function pintarValidacion() {
    cajaValidacion.replaceChildren();
    if (!resultadoValidacion || resultadoValidacion.id !== borradorActual) { cajaValidacion.append(h("p", { class: "blab-nota" }, "La revisión aparece aquí unos instantes después de editar.")); return; }
    const errores = resultadoValidacion.filas.filter(f => f.n === "x");
    const avisos = resultadoValidacion.filas.filter(f => f.n !== "x");
    cajaValidacion.append(...bien(h("p", { class: errores.length ? "blab-error" : "blab-ok" }, errores.length ? errores.length + " error(es) a corregir antes de publicar" : "Sin errores"), avisos.length ? h("p", { class: "blab-nota" }, avisos.length + " aviso(s) para revisar con criterio") : null));
    resultadoValidacion.filas.slice(0, 40).forEach(f => cajaValidacion.append(h("p", { class: "blab-fila-val " + (f.n === "x" ? "x" : "a") }, (f.n === "x" ? "✗ " : "! ") + f.t)));
  }

  const nuevoBorrador = (id, nombre, numero) => ({ id, numero, nombre, lados: "", temas: [] });
  const nuevoTema = id => ({ id, boton: "", como: "recuerdo", intro: "", cerrar: "", tras: "", hechos: "", introAnimacion: "", introRisa: "", preguntas: [], grupos: [] });
  const nuevaPregunta = id => ({ id, texto: "", requiere: "", voz: "", voces: "", tras: "", hechos: "", animacion: "", risa: "", lineas: "" });
  const nuevoGrupo = id => ({ id, requiere: "", opciones: [{ id: "si", texto: "", neutral: false, lineas: "" }, { id: "no", texto: "", neutral: false, lineas: "" }, { id: "nose", texto: "No lo sé.", neutral: true, lineas: "" }] });
  const idValido = s => /^[a-z0-9_]+$/.test(s || "");
  function pedirId(que) {
    const v = (prompt("Id " + que + " (solo minúsculas sin tildes, números y _; por ejemplo: mi_tema):") || "").trim();
    if (!v) return null;
    if (!idValido(v)) { alert("Ese id no es válido. Usa solo minúsculas sin tildes, números y _."); return null; }
    return v;
  }

  function entrada(ruta, valor, opciones) {
    opciones = opciones || {};
    if (opciones.area) return h("textarea", { class: "blab-area", "data-r": ruta, rows: opciones.filas || 4, placeholder: opciones.ph || "", value: valor });
    return h("input", { type: "text", "data-r": ruta, value: valor, placeholder: opciones.ph || "", class: opciones.corto ? "corto" : "" });
  }
  function cp(etiqueta, ctl, ayuda) { return h("label", { class: "blab-campo" }, h("span", null, etiqueta), ctl, ayuda ? h("small", null, ayuda) : null); }

  const ANIMACIONES = ["Parado", "Pofavor", "Aplaudirnormal", "Aplaudirrapido", "Apuntando", "Auch", "Aymisbolas", "Bateria", "Boxing",
    "Cantando", "Cariñito", "Celebrar", "Fistifght", "JumpinJacks", "Mma Kick", "Pumpin", "Riendosesentao", "Saltito", "Toma pesao",
    "Rumba", "SillyDance", "Twerk", "Twist", "Swag", "Gangnam"];
  const datalistAnim = () => h("datalist", { id: "blabAnimaciones" }, ANIMACIONES.map(a => h("option", { value: a })));

  // Campos opcionales (condiciones, animación, risa) plegados para no llenar la pantalla.
  function extrasForm(base, x, que) {
    const hayAlgo = (x.tras || "").trim() || (x.hechos || "").trim() || (x.animacion || "").trim() || (x.risa || "").trim();
    return h("details", { class: "blab-detalle", open: !!hayAlgo },
      h("summary", null, "Condiciones, animación y risa" + (que ? " (" + que + ")" : "")),
      h("div", { class: "blab-dos" },
        cp("Solo si ya se completó...", entrada(base + ".tras", x.tras, { ph: "ids de diálogos, separados por coma" }), "Por ejemplo teros_final. Los ids de las preguntas de un tema son <tema>_<pregunta>."),
        cp("Solo si en la mesa pasó...", entrada(base + ".hechos", x.hechos, { ph: "hechos, separados por coma" }), "Hechos de data/bufon-evidencia.js, por ejemplo mattei_se_unio.")),
      h("div", { class: "blab-dos" },
        cp("Animación del Bufón", h("input", { type: "text", list: "blabAnimaciones", "data-r": base + ".animacion", value: x.animacion || "", placeholder: "(la de siempre)" })),
        cp("Risa del Bufón (milisegundos)", entrada(base + ".risa", x.risa || "", { ph: "por ejemplo 2000" }))));
  }

  // Resumen en árbol de cómo se destapa un tema. Se repinta mientras escribes.
  function arbolTexto(t) {
    const etiquetas = x => {
      const e = [];
      if (x.cierra && !x.fin) e.push("cierra el tema");
      if (x.fin) e.push("termina la conversación");
      if (x.voces && lista(x.voces).length) e.push("Voces: " + x.voces);
      if (x.voz) e.push("solo si la Voz " + x.voz + " despertó");
      if (lista(x.tras).length) e.push("tras " + lista(x.tras).join("+"));
      if (lista(x.hechos).length) e.push("hechos " + lista(x.hechos).join("+"));
      return e.length ? "  [" + e.join("; ") + "]" : "";
    };
    const elems = [];
    t.preguntas.forEach(p => elems.push({ id: p.id, req: lista(p.requiere), pinta: nivel => [nivel + "• " + (p.texto || "(sin texto)") + "  <" + p.id + ">" + etiquetas(p)] }));
    t.grupos.forEach(g => elems.push({
      id: g.id, req: lista(g.requiere),
      pinta: nivel => [nivel + "◆ una sola de" + etiquetas(g) + "  <" + g.id + ">"].concat(g.opciones.map(o => nivel + "    ○ " + (o.texto || "(sin texto)") + (o.neutral ? "  (neutral)" : "") + etiquetas(o)))
    }));
    const ids = new Set(elems.map(e => e.id));
    const salida = ["Tema «" + t.id + "»  botón: «" + (t.boton || "...") + "»  empieza " + (t.como === "boton" ? "con el botón" : "como recuerdo") + etiquetas(t),
      "└ intro (el Bufón cuenta)" + ((t.introAnimacion || t.introRisa) ? "  [animación/risa]" : "")];
    const visto = new Set();
    function hijosDe(padre, nivel, profundidad) {
      if (profundidad > 12) return;
      const hijos = elems.filter(e => !visto.has(e.id) && (padre === null ? !e.req.some(r => ids.has(r)) : e.req[0] === padre));
      hijos.forEach(e => {
        visto.add(e.id);
        const extra = e.req.length > 1 ? "  (necesita también: " + e.req.slice(1).join(", ") + ")" : "";
        e.pinta(nivel).forEach((l, i) => salida.push(l + (i === 0 ? extra : "")));
        hijosDe(e.id, nivel + "    ", profundidad + 1);
      });
    }
    hijosDe(null, "   ", 0);
    elems.filter(e => !visto.has(e.id)).forEach(e => e.pinta("   ").forEach(l => salida.push(l + "  (!) nunca se destapa: revisa 'se destapa tras'")));
    salida.push("└ salida del submenú: «" + ((t.cerrar || "").trim() || "Ya fue, sigamos con otra cosa.") + "»");
    return salida.join("\n");
  }
  function repintarArboles() {
    const b = bActual(); if (!b) return;
    pEditor.querySelectorAll("[data-arbol]").forEach(pre => {
      const t = b.temas[parseInt(pre.getAttribute("data-arbol"), 10)];
      if (t) pre.textContent = arbolTexto(t);
    });
  }

  function formTema(t, ti, b) {
    const base = "temas." + ti;
    const idsPreg = t.preguntas.map(p => p.id);
    return h("details", { class: "blab-tema", open: true },
      h("summary", null, "Tema «" + t.id + "»", h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base }, "Quitar tema")),
      cp("Botón del menú principal", entrada(base + ".boton", t.boton, { ph: "Texto que ve el jugador" }), "Aparece cuando el tema ya empezó y se esconde solo al terminarlo."),
      cp("Cómo empieza", h("select", { "data-r": base + ".como" }, h("option", { value: "recuerdo", selected: t.como !== "boton" }, "El Bufón lo trae solo (recuerdo)"), h("option", { value: "boton", selected: t.como === "boton" }, "El botón aparece desde el principio"))),
      cp("Primeras líneas del Bufón", entrada(base + ".intro", t.intro, { area: true, filas: 4, ph: "Una línea por renglón" }), "Una línea por renglón. Para la interjección de una Voz: herida> texto (voces: coartada, testigo, grieta, muralla, hilo, rostro, herida, apetito)."),
      h("details", { class: "blab-detalle", open: !!((t.tras || "").trim() || (t.hechos || "").trim() || (t.cerrar || "").trim() || (t.introAnimacion || "").trim() || (t.introRisa || "").trim()) },
        h("summary", null, "Condiciones del tema, animación de la intro y texto de salida"),
        h("div", { class: "blab-dos" },
          cp("El tema solo existe si ya se completó...", entrada(base + ".tras", t.tras, { ph: "ids de diálogos, separados por coma" })),
          cp("El tema solo existe si en la mesa pasó...", entrada(base + ".hechos", t.hechos, { ph: "hechos, separados por coma" }))),
        h("div", { class: "blab-dos" },
          cp("Animación al empezar", h("input", { type: "text", list: "blabAnimaciones", "data-r": base + ".introAnimacion", value: t.introAnimacion || "", placeholder: "(la de siempre)" })),
          cp("Risa al empezar (milisegundos)", entrada(base + ".introRisa", t.introRisa || "", { ph: "por ejemplo 2000" }))),
        cp("Texto del botón de salida del submenú", entrada(base + ".cerrar", t.cerrar || "", { ph: "Ya fue, sigamos con otra cosa." }), "Vuelve al menú principal sin cerrar el tema.")),
      h("h5", null, "Preguntas"),
      t.preguntas.map((p, pi) => h("div", { class: "blab-sub" },
        h("div", { class: "blab-sub-top" }, h("strong", null, "Pregunta «" + p.id + "»"), h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base + ".preguntas." + pi }, "Quitar")),
        cp("Texto del botón", entrada(base + ".preguntas." + pi + ".texto", p.texto, { ph: "¿Qué dice el jugador?" })),
        cp("Se destapa tras...", entrada(base + ".preguntas." + pi + ".requiere", p.requiere, { ph: "ids separados por coma" }), idsPreg.length ? "Preguntas de este tema: " + idsPreg.join(", ") : null),
        cp("Respuesta del Bufón", entrada(base + ".preguntas." + pi + ".lineas", p.lineas, { area: true, filas: 6, ph: "Una línea por renglón" })),
        cp("Voces que suben al elegirla", entrada(base + ".preguntas." + pi + ".voces", p.voces || "", { ph: "herida +1, rostro +2" }), "Puntos para las Voces cuando el jugador elige esta pregunta. Déjalo vacío si no suma nada. Voces: coartada, testigo, grieta, muralla, hilo, rostro, herida, apetito."),
        extrasForm(base + ".preguntas." + pi, p, "esta pregunta"),
        h("label", { class: "blab-casilla" }, h("input", { type: "checkbox", "data-r": base + ".preguntas." + pi + ".cierra", checked: p.cierra }),
          h("span", null, "Cierra el tema. ", h("small", null, "Tras esta respuesta el Bufón vuelve al menú principal y el tema ya no sigue avanzando (lo pendiente desaparece). Úsalo para «No me interesa»."))),
        h("label", { class: "blab-casilla" }, h("input", { type: "checkbox", "data-r": base + ".preguntas." + pi + ".fin", checked: p.fin }),
          h("span", null, "Termina la conversación. ", h("small", null, "Tras esta respuesta el Bufón no ofrece más opciones y la visita acaba (como su despedida). Cierra también el tema."))))),
      h("button", { type: "button", class: "secondary-button blab-agregar", "data-acc": "add-pregunta", "data-ruta": base }, "+ Pregunta"),
      h("h5", null, "Respuestas excluyentes"),
      h("p", { class: "blab-nota" }, "Al elegir una, las otras desaparecen. Deja siempre una salida neutral («No lo sé»): así el Bufón no obliga a tomar partido para poder seguir. La casilla «salida neutral» solo sirve de recordatorio para el validador, no cambia lo que ve el jugador."),
      t.grupos.map((g, gi) => h("div", { class: "blab-sub" },
        h("div", { class: "blab-sub-top" }, h("strong", null, "Grupo «" + g.id + "»"), h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base + ".grupos." + gi }, "Quitar")),
        cp("Aparece tras...", entrada(base + ".grupos." + gi + ".requiere", g.requiere, { ph: "ids de preguntas, separados por coma" })),
        extrasForm(base + ".grupos." + gi, g, "todo el grupo"),
        g.opciones.map((o, oi) => {
          const ob = base + ".grupos." + gi + ".opciones." + oi;
          return h("div", { class: "blab-opcion" },
            h("div", { class: "blab-sub-top" }, h("code", null, o.id),
              h("label", { class: "blab-casilla chico" }, h("input", { type: "checkbox", "data-r": ob + ".neutral", checked: o.neutral }), h("span", null, "salida neutral"), h("input", { type: "checkbox", "data-r": ob + ".cierra", checked: o.cierra }), h("span", null, "cierra el tema"), h("input", { type: "checkbox", "data-r": ob + ".fin", checked: o.fin }), h("span", null, "termina la conversación"))),
            cp("Texto del botón", entrada(ob + ".texto", o.texto)),
            cp("Reacción del Bufón", entrada(ob + ".lineas", o.lineas, { area: true, filas: 3 })),
            cp("Voces que suben al elegirla", entrada(ob + ".voces", o.voces || "", { ph: "herida +1, rostro +2" })),
            h("details", { class: "blab-detalle", open: !!((o.animacion || "").trim() || (o.risa || "").trim()) },
              h("summary", null, "Animación y risa de esta reacción"),
              h("div", { class: "blab-dos" },
                cp("Animación del Bufón", h("input", { type: "text", list: "blabAnimaciones", "data-r": ob + ".animacion", value: o.animacion || "", placeholder: "(la de siempre)" })),
                cp("Risa del Bufón (milisegundos)", entrada(ob + ".risa", o.risa || "", { ph: "por ejemplo 2000" })))));
        }))),
      h("button", { type: "button", class: "secondary-button blab-agregar", "data-acc": "add-grupo", "data-ruta": base }, "+ Grupo de respuestas excluyentes"),
      h("details", { class: "blab-detalle", open: true },
        h("summary", null, "Vista del flujo de este tema"),
        h("pre", { "data-arbol": String(ti) }, arbolTexto(t))),
      h("div", { class: "blab-botones" },
        h("button", { type: "button", class: "secondary-button", "data-acc": "copiar-tema", "data-ruta": String(ti) }, "Copiar solo este tema")));
  }

  function renderEditor() {
    pEditor.replaceChildren(datalistAnim());
    const b = bActual();
    const importables = meta ? Object.keys(meta.ciclos).filter(id => meta.defs[id]) : [];
    const barra = h("div", { class: "blab-barra" },
      h("select", { onchange: e => { borradorActual = e.target.value || null; renderEditor(); programarValidacion(); } },
        h("option", { value: "" }, borradores.length ? "Elige un borrador..." : "(sin borradores)"),
        borradores.map(x => h("option", { value: x.id, selected: x.id === borradorActual }, (x.nombre || x.id) + " [" + x.id + "]"))),
      h("button", { type: "button", class: "secondary-button", onclick: () => {
        const id = pedirId("del ciclo nuevo"); if (!id) return;
        if (borradores.some(x => x.id === id)) { alert("Ya hay un borrador con ese id."); return; }
        const nombre = prompt("Nombre visible del ciclo:", id) || id;
        const usados = meta ? meta.lista.map(c => c.numero) : [1, 2];
        borradores.forEach(x => { const n = parseInt(x.numero, 10); if (Number.isInteger(n)) usados.push(n); });
        const sugerido = Math.max(2, ...usados) + 1;
        const numero = parseInt(prompt("Número del ciclo (3 o más). El 1 es el contenido original y el 2 es «Lo que queda»:", String(sugerido)), 10);
        if (!Number.isInteger(numero) || numero < 3) { alert("El número debe ser 3 o más."); return; }
        borradores.push(nuevoBorrador(id, nombre, numero)); borradorActual = id; guardarBorradores(); renderEditor(); programarValidacion();
      } }, "+ Ciclo nuevo"),
      importables.length ? h("select", { onchange: e => { if (e.target.value) importarCiclo(e.target.value); } },
        h("option", { value: "" }, "Cargar un ciclo existente..."), importables.map(id => h("option", { value: id }, id))) : null,
      b ? h("button", { type: "button", class: "secondary-button peligro", onclick: () => {
        if (!confirm("¿Borrar el borrador «" + b.id + "»? Esto no borra ningún archivo.")) return;
        borradores = borradores.filter(x => x.id !== b.id); borradorActual = borradores.length ? borradores[0].id : null; guardarBorradores(); renderEditor();
      } }, "Borrar borrador") : null);
    pEditor.append(barra);
    pEditor.append(h("p", { class: "blab-nota" }, "Aquí armas un ciclo con formularios y lo pruebas al instante. No se guarda en el sitio: cuando esté listo, copia o descarga el archivo y súbelo (te explico cómo abajo)."));
    if (!b) { pEditor.append(h("p", { class: "blab-vacio" }, "Crea un ciclo nuevo o carga uno existente para empezar.")); return; }

    const def = meta && meta.defs ? meta.defs[b.id] : null;
    const notas = avisosDeImportacion(def);
    if (notas.length) pEditor.append(h("p", { class: "blab-error" }, "Ojo: el ciclo original " + notas.join(" y ") + ", y el editor no los maneja. El archivo completo que exportes NO los incluirá. Usa «Copiar solo este tema» y pégalo en tu archivo."));
    const tieneVisibleSi = !!(meta && meta.conVisibleSi && meta.conVisibleSi[b.id] && meta.conVisibleSi[b.id].length);

    pEditor.append(h("div", { class: "blab-tarjeta" },
      h("div", { class: "blab-dos" },
        cp("Id del ciclo", h("input", { type: "text", value: b.id, disabled: true }), "Es el nombre del archivo: data/bufon-ciclo-" + b.id + ".js"),
        cp("Nombre", entrada("nombre", b.nombre))),
      h("div", { class: "blab-dos" },
        cp("Número de ciclo", entrada("numero", String(b.numero == null ? "" : b.numero), { ph: "3" }), "3 o más. Debe estar en data/bufon-ciclos-lista.js (con su nombre). Los jugadores lo reciben cuando los mueves a este número desde Progreso del Bufón."),
        cp("Solo para el lado (opcional)", entrada("lados", b.lados, { ph: "A, B (vacío = los dos)" })))));

    b.temas.forEach((t, ti) => pEditor.append(formTema(t, ti, b)));
    pEditor.append(h("button", { type: "button", class: "secondary-button blab-agregar", "data-acc": "add-tema" }, "+ Tema nuevo (un personaje o asunto)"));

    pEditor.append(h("h4", null, "Revisión"), cajaValidacion);
    pintarValidacion();

    const salida = h("div", { class: "blab-tarjeta" },
      h("h4", null, "Probarlo y publicarlo"),
      h("div", { class: "blab-botones" },
        h("button", { type: "button", class: "primary-button", "data-acc": "probar" }, "Probar en el Bufón"),
        h("button", { type: "button", class: "secondary-button", "data-acc": "copiar-archivo" }, "Copiar archivo"),
        h("button", { type: "button", class: "secondary-button", "data-acc": "descargar" }, "Descargar archivo"),
        h("button", { type: "button", class: "secondary-button", "data-acc": "copiar-json" }, "Copiar borrador (JSON)")),
      tieneVisibleSi ? h("p", { class: "blab-nota" }, "Un tema de este ciclo usa una condición (visibleSi) que no se puede editar aquí.") : null,
      h("p", { class: "blab-estado-accion", id: "blabAccion" }),
      h("details", { class: "blab-detalle" }, h("summary", null, "Cómo se publica"),
        h("ol", null,
          h("li", null, "Pulsa «Descargar archivo» (o «Copiar archivo») y guárdalo como data/bufon-ciclo-" + b.id + ".js en el proyecto."),
          h("li", null, "Si es un ciclo nuevo: agrega { numero: " + (b.numero || "N") + ", nombre: \"" + (b.nombre || b.id) + "\" } a data/bufon-ciclos-lista.js y su <script> en secreto.html, justo debajo de los de los otros ciclos: <script src=\"data/bufon-ciclo-" + b.id + ".js?v=AAAAMMDD\"></script>. Si ya existía, solo sube el número de caché de su <script>."),
          h("li", null, "Publica (git add, commit y push). Nadie lo recibe todavía."),
          h("li", null, "Para abrirlo: en Progreso del Bufón, mueve a un lado entero o a un jugador al ciclo " + (b.numero || "N") + ". En la terminal, node tools/bufon/bufon.js nuevo-ciclo " + (b.numero || "N") + " " + b.id + " \"Nombre\" hace los pasos de los archivos por ti."),
          h("li", null, "O pega aquí el archivo (o el JSON del borrador) en una conversación con Claude y que lo publique por ti."))));
    pEditor.append(salida);
    programarValidacion();
  }

  pEditor.addEventListener("input", e => {
    const r = e.target.getAttribute && e.target.getAttribute("data-r");
    const b = bActual();
    if (!r || !b) return;
    ponerEnRuta(b, r, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    guardarBorradores(); programarValidacion(); repintarArboles();
  });
  pEditor.addEventListener("change", e => {
    const r = e.target.getAttribute && e.target.getAttribute("data-r");
    const b = bActual();
    if (!r || !b) return;
    ponerEnRuta(b, r, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    guardarBorradores(); programarValidacion(); repintarArboles();
  });
  pEditor.addEventListener("click", async e => {
    const btn = e.target.closest && e.target.closest("[data-acc]");
    const b = bActual();
    if (!btn || !b) return;
    const acc = btn.getAttribute("data-acc");
    const ruta = btn.getAttribute("data-ruta");
    const aviso = t => { const el = document.getElementById("blabAccion"); if (el) el.textContent = t; };
    if (acc === "add-tema") {
      const id = pedirId("del tema"); if (!id) return;
      if (b.temas.some(t => t.id === id)) { alert("Ya hay un tema con ese id en este ciclo."); return; }
      b.temas.push(nuevoTema(id)); guardarBorradores(); renderEditor(); return;
    }
    if (acc === "add-pregunta") {
      const t = porRuta(b, ruta);
      const id = pedirId("de la pregunta"); if (!id) return;
      if (t.preguntas.concat(t.grupos).some(x => x.id === id)) { alert("Ese id ya se usa en este tema."); return; }
      t.preguntas.push(nuevaPregunta(id)); guardarBorradores(); renderEditor(); return;
    }
    if (acc === "add-grupo") {
      const t = porRuta(b, ruta);
      const id = pedirId("del grupo de respuestas"); if (!id) return;
      if (t.preguntas.concat(t.grupos).some(x => x.id === id)) { alert("Ese id ya se usa en este tema."); return; }
      t.grupos.push(nuevoGrupo(id)); guardarBorradores(); renderEditor(); return;
    }
    if (acc === "quitar") {
      if (!confirm("¿Quitar esto?")) return;
      const partes = ruta.split("."); const idx = parseInt(partes.pop(), 10);
      porRuta(b, partes.join(".")).splice(idx, 1); guardarBorradores(); renderEditor(); return;
    }
    if (acc === "probar") {
      cfg.usarBorradores = true;
      const n = parseInt(b.numero, 10);
      if (!Number.isInteger(n)) { aviso("Primero pon el número de ciclo de este borrador (3 o más)."); return; }
      cfg.ciclo = n;
      cfg.admin = false;
      guardarCfg();
      await cargarMeta().catch(() => {});
      mostrar("jugar");
      pintarCiclosCtrl();
      await nuevaVisita();
      return;
    }
    if (acc === "copiar-archivo") { aviso((await copiar(archivoDe(b))) ? "Archivo copiado. Pégalo en data/bufon-ciclo-" + b.id + ".js." : "No pude copiar. Usa «Descargar archivo»."); return; }
    if (acc === "copiar-tema") { aviso((await copiar(temaDe(b, parseInt(ruta, 10)))) ? "Tema copiado. Pégalo dentro de la lista temas: [ ... ] de tu archivo." : "No pude copiar."); return; }
    if (acc === "copiar-json") { aviso((await copiar(JSON.stringify(b, null, 2))) ? "Borrador copiado (JSON)." : "No pude copiar."); return; }
    if (acc === "descargar") {
      const a = h("a", { href: URL.createObjectURL(new Blob([archivoDe(b)], { type: "text/javascript" })), download: "bufon-ciclo-" + b.id + ".js" });
      document.body.append(a); a.click(); a.remove(); aviso("Descargado: bufon-ciclo-" + b.id + ".js"); return;
    }
  });

  /* =========================================================================
     AUDITORÍA
  ========================================================================= */
  const pAud = pestana("auditoria", "Auditoría");
  const salidaAud = h("div", { class: "blab-resultados" });
  const barraProg = h("progress", { max: 1000, value: 0, class: "oculto" });
  const textoProg = h("span", { class: "blab-nota" });
  let cancelarAud = false;
  let corriendo = false;
  const selSemillas = h("select", null, [[1, "Rápida (unos 2 minutos)"], [2, "Normal (unos 4 minutos)"], [3, "Completa (unos 6 minutos)"]].map(([n, t]) => h("option", { value: n, selected: n === 1 }, t)));
  const areaNombres = h("textarea", { class: "blab-area", rows: 4, placeholder: "B | nombre de la cuenta\nA | nombre de la cuenta | nombre escrito en el Bufón (opcional)", value: cfg.nombresTexto, onchange: e => { cfg.nombresTexto = e.target.value; guardarCfg(); } });
  const btnEjecutar = h("button", { type: "button", class: "primary-button", onclick: ejecutarAuditoria }, "Auditar");
  const btnCancelar = h("button", { type: "button", class: "secondary-button oculto", onclick: () => { cancelarAud = true; } }, "Cancelar");

  function parseNombres(txt) {
    return String(txt || "").split("\n").map(s => s.trim()).filter(Boolean).map(l => {
      const p = l.split("|").map(x => x.trim());
      return { lado: (p[0] || "B").toUpperCase() === "A" ? "A" : "B", cuenta: p[1] || "", nombre: p[2] || "" };
    });
  }

  async function ejecutarAuditoria() {
    if (corriendo) return;
    corriendo = true; cancelarAud = false;
    btnEjecutar.disabled = true; btnCancelar.classList.remove("oculto"); barraProg.classList.remove("oculto"); barraProg.value = 0;
    salidaAud.replaceChildren(h("p", { class: "blab-vacio" }, "Jugando visitas automáticas..."));
    const t0 = performance.now();
    try {
      const r = await M.auditar({
        semillas: parseInt(selSemillas.value, 10),
        borradores: cfg.usarBorradores ? borradores.map(aConfig) : [],
        nombres: parseNombres(areaNombres.value),
        cancelado: () => cancelarAud,
        alProgreso: (texto, frac) => { if (frac != null) barraProg.value = Math.round(frac * 1000); if (texto) textoProg.textContent = texto; }
      });
      pintarAuditoria(r, Math.round((performance.now() - t0) / 1000));
    } catch (e) {
      salidaAud.replaceChildren(h("p", { class: "blab-error" }, "La auditoría falló: " + e.message));
    } finally {
      corriendo = false; btnEjecutar.disabled = false; btnCancelar.classList.add("oculto"); barraProg.classList.add("oculto"); textoProg.textContent = "";
    }
  }

  function pintarAuditoria(r, seg) {
    salidaAud.replaceChildren(...bien(
      h("p", { class: r.errores.length ? "blab-error" : "blab-ok" },
        (r.cancelado ? "Cancelada. " : "") + (r.errores.length ? r.errores.length + " error(es)" : "Sin errores") + " · " + r.avisos.length + " aviso(s) · " + seg + " s"),
      r.errores.length ? h("div", { class: "blab-tarjeta" }, h("h4", null, "Errores"), r.errores.map(e => h("p", { class: "blab-fila-val x" }, "✗ " + e))) : null,
      r.avisos.length ? h("div", { class: "blab-tarjeta" }, h("h4", null, "Avisos"), r.avisos.map(a => h("p", { class: "blab-fila-val a" }, "! " + a))) : null,
      r.secciones.map(s => h("div", { class: "blab-tarjeta" }, h("h4", null, s.titulo),
        s.lineas.map(l => h("p", { class: "blab-fila-val " + (l.ok === true ? "ok" : l.ok === false ? "x" : l.info ? "i" : "a") }, (l.ok === true ? "✓ " : l.ok === false ? "✗ " : l.info ? "" : "! ") + l.t)))),
      r.cobertura ? h("details", { class: "blab-detalle" }, h("summary", null, "Cobertura: " + r.cobertura.vistos + " de " + r.cobertura.total + " nodos alcanzados"),
        h("p", { class: "blab-nota" }, "Los " + r.cobertura.sinVer.length + " restantes suelen depender de un nombre de jugador, un hecho de la mesa o el paso del tiempo."),
        h("pre", null, r.cobertura.sinVer.join("\n"))) : null));
  }

  const pAudInt = pAud;
  pAudInt.append(
    h("p", { class: "blab-nota" }, "Un jugador automático juega cientos de visitas de Side A y B (con visitas a medias, cambios de ciclo y Admin) y busca lo que un jugador real notaría: diálogos que se repiten, bucles, textos rotos, ciclos cerrados que se filtran, ciclos que no se pueden alcanzar, y si la primera visita tras un cambio de ciclo ya lo ve."),
    h("div", { class: "blab-barra" }, selSemillas, btnEjecutar, btnCancelar, barraProg, textoProg),
    h("p", { class: "blab-nota" }, "Deja esta pestaña del navegador a la vista mientras audita: el navegador frena las pestañas ocultas y la auditoría se vuelve muy lenta."),
    campo("Reacciones por nombre (opcional)", areaNombres, "Una línea por jugador: lado | nombre registrado | nombre de cuenta (opcional). Los nombres se guardan solo en este navegador."),
    salidaAud);

  /* ---------- montaje ---------- */
  // Se monta la primera vez que se abre la pestaña, para no cargar nada cuando solo se mira el resto del panel.
  function montar() {
    raiz.replaceChildren(
      h("div", { class: "blab-tabs" }, Object.values(botonesTab)),
      pJugar, pCiclos, pEditor, pAud);
    mostrar("jugar");
    cargarMeta().then(pintarCiclosCtrl).catch(e => { listaCiclosCtrl.replaceChildren(h("p", { class: "blab-error" }, "No pude leer los ciclos: " + e.message)); });
  }
  window.BufonLabUI = { archivoDe, aConfig, pintarAuditoria, borradores: () => borradores };  // para depurar desde la consola
  const tabLab = document.querySelector('[data-tab="lab"]');
  if (tabLab) tabLab.addEventListener("click", montar, { once: true });
})();
