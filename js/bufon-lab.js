/* =============================================================================
   LABORATORIO DEL BUFÓN — INTERFAZ (solo Admin; el motor está en
   js/bufon-lab-motor.js).

   Cuatro pestañas dentro de la pestaña "Laboratorio del Bufón" del panel de
   Admin:
     Jugar      el Bufón real en un marco, con un jugador de prueba aislado
     Ciclos     qué ciclos hay, si están abiertos y qué temas tienen
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
    lado: "B", nombre: "", cuenta: "", gen2: false, rpcAvanzo: false, admin: false,
    abrir: [], usarBorradores: true, modelo3d: false, almacen: {}, nombresTexto: ""
  }, leerJson(KEY_CFG, {}));
  let borradores = leerJson(KEY_BORR, []);
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

  function controles() {
    const radios = ["A", "B"].map(lado => h("label", { class: "blab-radio" },
      h("input", { type: "radio", name: "blabLado", value: lado, checked: cfg.lado === lado, onchange: () => { cfg.lado = lado; guardarCfg(); marcarPendiente(); pintarCiclosCtrl(); } }),
      "Side " + lado));
    return h("div", { class: "blab-controles" },
      h("h4", null, "Jugador de prueba"),
      h("div", { class: "blab-fila-radios" }, radios),
      campo("Nombre registrado en el Bufón", h("input", { type: "text", value: cfg.nombre, placeholder: "(ninguno)", onchange: e => { cfg.nombre = e.target.value.trim(); guardarCfg(); marcarPendiente(); } }), "Lo que el jugador escribió al registrarse con el Bufón."),
      campo("Nombre de la cuenta", h("input", { type: "text", value: cfg.cuenta, placeholder: "(ninguna)", onchange: e => { cfg.cuenta = e.target.value.trim(); guardarCfg(); marcarPendiente(); } }), "El de su cuenta del sitio (algunos temas reconocen a su jugador por ahí)."),
      casilla("Su generación 2 ya está desbloqueada", cfg.gen2, v => { cfg.gen2 = v; guardarCfg(); marcarPendiente(); }, "Lo que el navegador del jugador ya sabe."),
      casilla("El servidor ya dice «avanzó»", cfg.rpcAvanzo, v => { cfg.rpcAvanzo = v; guardarCfg(); marcarPendiente(); }, "Pero su navegador todavía no lo sabe. Para probar la entrada a un ciclo nuevo."),
      casilla("Modo Admin del Bufón", cfg.admin, v => { cfg.admin = v; guardarCfg(); marcarPendiente(); }, "Ve todos los ciclos aunque estén cerrados."),
      h("h4", null, "Ciclos"),
      listaCiclosCtrl,
      casilla("Incluir los borradores del Editor", cfg.usarBorradores, v => { cfg.usarBorradores = v; guardarCfg(); marcarPendiente(); }),
      casilla("Con modelo 3D", cfg.modelo3d, v => { cfg.modelo3d = v; guardarCfg(); marcarPendiente(); }, "Más lento. Solo para ver cómo luce."),
      h("div", { class: "blab-botones" },
        h("button", { type: "button", class: "primary-button", onclick: nuevaVisita }, "Nueva visita"),
        h("button", { type: "button", class: "secondary-button", onclick: reiniciarJugador }, "Reiniciar jugador"),
        h("button", { type: "button", class: "secondary-button", title: "Vuelve a leer secreto.html y los archivos de data/ (si los cambiaste desde que abriste esta página)", onclick: recargarMotor }, "Recargar archivos")),
      avisoPendiente,
      h("p", { class: "blab-nota" }, "Tu sesión, tu lado y tu avance reales no se tocan, y nada llega a Supabase. «Nueva visita» es como volver a abrir la página con el mismo jugador. «Reiniciar jugador» borra todo lo que ha hablado.")
    );
  }

  function ciclosDisponibles() {
    const delMeta = meta ? Object.values(meta.ciclos) : [];
    const ids = delMeta.map(c => ({ id: c.id, nombre: c.nombre, abierto: c.abierto, borrador: false }));
    if (cfg.usarBorradores) borradores.forEach(b => {
      const i = ids.findIndex(x => x.id === b.id);
      if (i >= 0) ids[i].borrador = true; else ids.push({ id: b.id, nombre: b.nombre || b.id, abierto: !!b.abierto, borrador: true });
    });
    return ids;
  }
  function pintarCiclosCtrl() {
    listaCiclosCtrl.replaceChildren();
    const cs = ciclosDisponibles();
    if (!cs.length) { listaCiclosCtrl.append(h("p", { class: "blab-nota" }, meta ? "No hay ciclos." : "Cargando ciclos...")); return; }
    cs.forEach(c => listaCiclosCtrl.append(casilla(
      "Abrir «" + c.nombre + "» en la prueba" + (c.borrador ? " (borrador)" : ""),
      cfg.abrir.includes(c.id),
      v => { cfg.abrir = v ? unico(cfg.abrir.concat(c.id)) : cfg.abrir.filter(x => x !== c.id); guardarCfg(); marcarPendiente(); },
      c.abierto ? "Ya está abierto en su archivo." : "Cerrado en su archivo."
    )));
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
      L = M.nuevoEstado({ lado: cfg.lado, cuenta: cfg.cuenta, admin: cfg.admin, rpcAvanzo: cfg.rpcAvanzo, local: cfg.almacen, abrir: cfg.abrir });
      if (cfg.nombre) L.local.setItem("jesterPlayerName", cfg.nombre); else L.local.removeItem("jesterPlayerName");
      if (cfg.gen2) L.local.setItem("bufonGen2v2_" + cfg.lado, "1"); else L.local.removeItem("bufonGen2v2_" + cfg.lado);
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
    filas.push(["Generación 2", "A: " + (ctx.sideAGen2 ? "sí" : "no") + " · B: " + (ctx.sideBGen2 ? "sí" : "no")]);
    filas.push(["Elecciones hechas", String(ctx.totalChoices)]);
    filas.push(["Toques a la puerta", String(L.toques)]);
    Object.keys(meta ? meta.ciclos : {}).concat(borradoresActivos().map(b => b.id)).filter((x, i, a) => a.indexOf(x) === i).forEach(id => {
      let abierto = false; try { abierto = ctx.cicloAbierto(id); } catch (e) { /* ciclo no cargado */ }
      filas.push(["Ciclo " + id, abierto ? "ABIERTO para este jugador" : "cerrado para este jugador"]);
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
    const cs = Object.values(meta.ciclos);
    pCiclos.replaceChildren(...bien(
      h("p", { class: "blab-nota" }, "Un ciclo es un bloque de contenido con su propio interruptor. Los jugadores solo lo ven si está abierto en su archivo (data/bufon-ciclo-<id>.js) y cumplen sus requisitos. Admin siempre los ve."),
      meta.errores.length ? h("div", { class: "blab-error" }, meta.errores.map(e => h("p", null, "Ciclo mal escrito: " + e))) : null,
      cs.length ? cs.map(c => h("div", { class: "blab-tarjeta" },
        h("div", { class: "blab-tarjeta-top" },
          h("strong", null, c.nombre), h("code", null, c.id),
          h("span", { class: "blab-etiqueta " + (c.abierto ? "ok" : "cerrado") }, c.abierto ? "abierto en su archivo" : "cerrado")),
        h("p", { class: "blab-nota" }, "Requiere: " + (c.requiere.join(", ") || "nada") + " · Lados: " + (c.lados ? c.lados.join(", ") : "A y B") + " · Archivo: data/bufon-ciclo-" + c.id + ".js"),
        c.temas.map(t => h("div", { class: "blab-tema-fila" },
          h("strong", null, t.id), " · botón «" + t.boton + "» · " + t.preguntas + " pregunta(s), " + t.grupos + " grupo(s) de respuestas excluyentes, " + t.nodos.length + " nodos")),
        h("div", { class: "blab-botones" },
          h("button", { type: "button", class: "secondary-button", onclick: () => { cfg.abrir = unico(cfg.abrir.concat(c.id)); guardarCfg(); marcarPendiente(); mostrar("jugar"); pintarCiclosCtrl(); } }, "Probarlo en Jugar"),
          h("button", { type: "button", class: "secondary-button", onclick: () => importarCiclo(c.id) }, "Editarlo en el Editor"))
      )) : h("p", { class: "blab-vacio" }, "No hay ciclos todavía. Crea uno en el Editor."),
      h("details", { class: "blab-detalle" }, h("summary", null, "Cómo se abre un ciclo a los jugadores"),
        h("p", null, "En el archivo del ciclo, cambia abierto: false por abierto: true, sube el número de caché de ese archivo en secreto.html y publica. Aunque esté abierto, un jugador solo lo ve si cumple los requisitos: «gen2» es la generación 2 de su propio lado, y «ciclo:otro» es que ese otro ciclo también esté abierto. En la terminal: node tools/bufon/bufon.js abrir <ciclo>."))));
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
  const lineasATexto = arr => (arr || []).map(l => typeof l === "string" ? l : l.voz + "> " + l.texto).join("\n");

  function aConfig(b) {
    const cfgCiclo = { id: b.id, nombre: b.nombre || b.id, abierto: !!b.abierto, requiere: lista(b.requiere) };
    if (lista(b.lados).length) cfgCiclo.lados = lista(b.lados);
    cfgCiclo.temas = b.temas.map(t => ({
      id: t.id, boton: t.boton,
      intro: { como: t.como === "boton" ? "boton" : "recuerdo", lineas: parseLineas(t.intro) },
      preguntas: t.preguntas.map(p => {
        const o = { id: p.id, texto: p.texto };
        if (lista(p.requiere).length) o.requiere = lista(p.requiere);
        if (p.voz) o.voz = p.voz;
        o.lineas = parseLineas(p.lineas);
        return o;
      }),
      grupos: t.grupos.map(g => ({
        id: g.id, requiere: lista(g.requiere),
        opciones: g.opciones.map(o => { const x = { id: o.id, texto: o.texto }; if (o.neutral) x.neutral = true; x.lineas = parseLineas(o.lineas); return x; })
      }))
    }));
    return cfgCiclo;
  }

  function desdeConfig(def) {
    return {
      id: def.id, nombre: def.nombre || def.id, abierto: !!def.abierto, requiere: (def.requiere || []).join(", "), lados: (def.lados || []).join(", "),
      temas: (def.temas || []).map(t => ({
        id: t.id, boton: t.boton, como: t.intro && t.intro.como === "boton" ? "boton" : "recuerdo", intro: lineasATexto(t.intro && t.intro.lineas),
        preguntas: (t.preguntas || []).map(p => ({ id: p.id, texto: p.texto, requiere: (p.requiere || []).join(", "), voz: p.voz || "", lineas: lineasATexto(p.lineas) })),
        grupos: (t.grupos || []).map(g => ({ id: g.id, requiere: (g.requiere || []).join(", "), opciones: (g.opciones || []).map(o => ({ id: o.id, texto: o.texto, neutral: !!o.neutral, lineas: lineasATexto(o.lineas) })) }))
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
      "   Generado con el Laboratorio del Bufón (" + fecha + "). Cerrado para los jugadores\n" +
      "   hasta que 'abierto' pase a true y se publique. Admin siempre lo ve.\n" +
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

  const nuevoBorrador = (id, nombre) => ({ id, nombre, abierto: false, requiere: "gen2", lados: "", temas: [] });
  const nuevoTema = id => ({ id, boton: "", como: "recuerdo", intro: "", preguntas: [], grupos: [] });
  const nuevaPregunta = id => ({ id, texto: "", requiere: "", voz: "", lineas: "" });
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

  function formTema(t, ti, b) {
    const base = "temas." + ti;
    const idsPreg = t.preguntas.map(p => p.id);
    return h("details", { class: "blab-tema", open: true },
      h("summary", null, "Tema «" + t.id + "»", h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base }, "Quitar tema")),
      cp("Botón del menú principal", entrada(base + ".boton", t.boton, { ph: "Texto que ve el jugador" }), "Aparece cuando el tema ya empezó y se esconde solo al terminarlo."),
      cp("Cómo empieza", h("select", { "data-r": base + ".como" }, h("option", { value: "recuerdo", selected: t.como !== "boton" }, "El Bufón lo trae solo (recuerdo)"), h("option", { value: "boton", selected: t.como === "boton" }, "El botón aparece desde el principio"))),
      cp("Primeras líneas del Bufón", entrada(base + ".intro", t.intro, { area: true, filas: 4, ph: "Una línea por renglón" }), "Una línea por renglón. Para la interjección de una Voz: herida> texto (voces: coartada, testigo, grieta, muralla, hilo, rostro, herida, apetito)."),
      h("h5", null, "Preguntas"),
      t.preguntas.map((p, pi) => h("div", { class: "blab-sub" },
        h("div", { class: "blab-sub-top" }, h("strong", null, "Pregunta «" + p.id + "»"), h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base + ".preguntas." + pi }, "Quitar")),
        cp("Texto del botón", entrada(base + ".preguntas." + pi + ".texto", p.texto, { ph: "¿Qué dice el jugador?" })),
        cp("Se destapa tras...", entrada(base + ".preguntas." + pi + ".requiere", p.requiere, { ph: "ids separados por coma" }), idsPreg.length ? "Preguntas de este tema: " + idsPreg.join(", ") : null),
        cp("Respuesta del Bufón", entrada(base + ".preguntas." + pi + ".lineas", p.lineas, { area: true, filas: 6, ph: "Una línea por renglón" })))),
      h("button", { type: "button", class: "secondary-button blab-agregar", "data-acc": "add-pregunta", "data-ruta": base }, "+ Pregunta"),
      h("h5", null, "Respuestas excluyentes"),
      h("p", { class: "blab-nota" }, "Al elegir una, las otras desaparecen. Deja siempre una salida neutral («No lo sé»): así el Bufón no obliga a tomar partido para poder seguir."),
      t.grupos.map((g, gi) => h("div", { class: "blab-sub" },
        h("div", { class: "blab-sub-top" }, h("strong", null, "Grupo «" + g.id + "»"), h("button", { type: "button", class: "blab-mini peligro", "data-acc": "quitar", "data-ruta": base + ".grupos." + gi }, "Quitar")),
        cp("Aparece tras...", entrada(base + ".grupos." + gi + ".requiere", g.requiere, { ph: "ids de preguntas, separados por coma" })),
        g.opciones.map((o, oi) => h("div", { class: "blab-opcion" },
          h("div", { class: "blab-sub-top" }, h("code", null, o.id), h("label", { class: "blab-casilla chico" }, h("input", { type: "checkbox", "data-r": base + ".grupos." + gi + ".opciones." + oi + ".neutral", checked: o.neutral }), h("span", null, "salida neutral"))),
          cp("Texto del botón", entrada(base + ".grupos." + gi + ".opciones." + oi + ".texto", o.texto)),
          cp("Reacción del Bufón", entrada(base + ".grupos." + gi + ".opciones." + oi + ".lineas", o.lineas, { area: true, filas: 3 })))))),
      h("button", { type: "button", class: "secondary-button blab-agregar", "data-acc": "add-grupo", "data-ruta": base }, "+ Grupo de respuestas excluyentes"),
      h("div", { class: "blab-botones" },
        h("button", { type: "button", class: "secondary-button", "data-acc": "copiar-tema", "data-ruta": String(ti) }, "Copiar solo este tema")));
  }

  function renderEditor() {
    pEditor.replaceChildren();
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
        borradores.push(nuevoBorrador(id, nombre)); borradorActual = id; guardarBorradores(); renderEditor(); programarValidacion();
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
        cp("Requiere", entrada("requiere", b.requiere, { ph: "gen2, ciclo:otro" }), "«gen2»: la generación 2 de su lado. «ciclo:otro»: que ese ciclo esté abierto."),
        cp("Solo para el lado (opcional)", entrada("lados", b.lados, { ph: "A, B (vacío = los dos)" }))),
      h("label", { class: "blab-casilla" }, h("input", { type: "checkbox", "data-r": "abierto", checked: b.abierto }), h("span", null, "Abierto para los jugadores al publicar", h("small", null, "Déjalo apagado mientras lo preparas.")))));

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
          h("li", null, "Si es un ciclo nuevo, agrega su <script> en secreto.html, justo debajo de los de los otros ciclos: <script src=\"data/bufon-ciclo-" + b.id + ".js?v=AAAAMMDD\"></script>. Si ya existía, solo sube el número de caché de su <script>."),
          h("li", null, "Publica (git add, commit y push). Mientras tenga abierto: false, ningún jugador lo ve."),
          h("li", null, "Para abrirlo a los jugadores: cambia abierto a true y vuelve a subir el número de caché. En la terminal, node tools/bufon/bufon.js abrir " + b.id + " lo hace por ti."),
          h("li", null, "O pega aquí el archivo (o el JSON del borrador) en una conversación con Claude y que lo publique por ti."))));
    pEditor.append(salida);
    programarValidacion();
  }

  pEditor.addEventListener("input", e => {
    const r = e.target.getAttribute && e.target.getAttribute("data-r");
    const b = bActual();
    if (!r || !b) return;
    ponerEnRuta(b, r, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    guardarBorradores(); programarValidacion();
  });
  pEditor.addEventListener("change", e => {
    const r = e.target.getAttribute && e.target.getAttribute("data-r");
    const b = bActual();
    if (!r || !b) return;
    ponerEnRuta(b, r, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    guardarBorradores(); programarValidacion();
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
      cfg.abrir = unico(cfg.abrir.concat(b.id, lista(b.requiere).filter(r => r.indexOf("ciclo:") === 0).map(r => r.slice(6))));
      if (lista(b.requiere).includes("gen2")) cfg.gen2 = true;
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
  const areaNombres = h("textarea", { class: "blab-area", rows: 4, placeholder: "B | nombre registrado\nA | nombre registrado | nombre de la cuenta", value: cfg.nombresTexto, onchange: e => { cfg.nombresTexto = e.target.value; guardarCfg(); } });
  const btnEjecutar = h("button", { type: "button", class: "primary-button", onclick: ejecutarAuditoria }, "Auditar");
  const btnCancelar = h("button", { type: "button", class: "secondary-button oculto", onclick: () => { cancelarAud = true; } }, "Cancelar");

  function parseNombres(txt) {
    return String(txt || "").split("\n").map(s => s.trim()).filter(Boolean).map(l => {
      const p = l.split("|").map(x => x.trim());
      return { lado: (p[0] || "B").toUpperCase() === "A" ? "A" : "B", nombre: p[1] || "", cuenta: p[2] || "" };
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
