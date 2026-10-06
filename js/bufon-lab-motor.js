/* =============================================================================
   LABORATORIO DEL BUFÓN — MOTOR (solo Admin; ver js/bufon-lab.js para la
   interfaz).

   Corre la página REAL del Bufón (secreto.html, con su motor y su diálogo)
   dentro de un iframe, pero aislada del resto del sitio:
     - localStorage y sessionStorage son falsos (viven en memoria y en el
       propio Laboratorio): tu sesión, tu lado y tu avance NO se tocan.
     - Nada llega a Supabase. Los registros ("lo que se habría guardado") se
       acumulan en el estado del Laboratorio para poder verlos.
   Con eso se puede jugar a mano, o dejar que un jugador automático juegue
   cientos de visitas para auditar el contenido (repeticiones, bucles,
   ciclos que se filtran, entrada a un ciclo nuevo...).

   El iframe no carga el modelo 3D salvo que se pida: es para probar diálogo.
============================================================================= */
(function () {
  "use strict";

  const dormir = ms => new Promise(r => setTimeout(r, ms));
  // Ceder el turno sin la espera mínima de ~4 ms de setTimeout(0): acelera mucho la simulación.
  const ceder = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
  let htmlBase = null;
  let contador = 0;
  window.__bufonLabs = window.__bufonLabs || {};

  /* ---------- almacenamiento falso ---------- */
  function nuevoAlmacen(inicial) {
    const m = new Map(Object.entries(inicial || {}));
    const a = {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); if (a.alCambiar) a.alCambiar(); },
      removeItem: k => { m.delete(k); if (a.alCambiar) a.alCambiar(); },
      clear: () => { m.clear(); if (a.alCambiar) a.alCambiar(); },
      key: i => Array.from(m.keys())[i] || null,
      get length() { return m.size; },
      alCambiar: null,
      _volcar: () => Object.fromEntries(m)
    };
    return a;
  }

  /* Estado de un jugador de prueba (compartido con el iframe). */
  function nuevoEstado(cfg) {
    cfg = cfg || {};
    return {
      local: nuevoAlmacen(cfg.local),
      session: nuevoAlmacen(),
      lado: cfg.lado || null,
      cuenta: cfg.cuenta || "",
      admin: !!cfg.admin,
      rpcAvanzo: !!cfg.rpcAvanzo,   // el servidor ya dice "avanzó" aunque el navegador no lo sepa
      latenciaRpc: cfg.latenciaRpc || 0,
      abrir: (cfg.abrir || []).slice(),    // ciclos que se fuerzan a abiertos en la prueba
      cerrar: (cfg.cerrar || []).slice(),  // ciclos que se fuerzan a cerrados
      eventos: [],   // lo que se habría mandado a Supabase
      errores: [],   // errores de JavaScript dentro del iframe
      toques: 0
    };
  }

  /* ---------- la página del Bufón ---------- */
  async function cargarHtmlBase(forzar) {
    if (htmlBase && !forzar) return htmlBase;
    const r = await fetch("secreto.html", { cache: "no-cache" });
    if (!r.ok) throw new Error("No pude leer secreto.html (" + r.status + ").");
    htmlBase = await r.text();
    return htmlBase;
  }

  /* Se ejecuta DENTRO del iframe, antes que cualquier otro script. Se
     serializa con toString(), así que no puede usar nada de afuera. */
  function preludio(idLab) {
    var L = parent.__bufonLabs[idLab];
    function definir(nombre, valor) {
      try { Object.defineProperty(window, nombre, { value: valor, configurable: true, writable: true }); } catch (e) { window[nombre] = valor; }
    }
    definir("localStorage", L.local);
    definir("sessionStorage", L.session);
    window.Audio = function () {
      this.play = function () { return Promise.resolve(); };
      this.pause = function () {};
      this.addEventListener = function () {};
      this.volume = 0;
    };
    window.alert = function () {};
    window.confirm = function () { return false; };
    window.addEventListener("error", function (e) {
      L.errores.push((e.message || "error") + (e.filename ? " @ " + e.filename.split("/").pop() + ":" + e.lineno : ""));
    });
    window.addEventListener("unhandledrejection", function (e) {
      L.errores.push("promesa rechazada: " + (e.reason && e.reason.message ? e.reason.message : e.reason));
    });

    // Para saber si hay una línea esperando un click, y poder avanzarla desde afuera.
    var clicks = [];
    var agregar = document.addEventListener.bind(document);
    var quitar = document.removeEventListener.bind(document);
    document.addEventListener = function (t, f, o) { if (t === "click") clicks.push(f); return agregar(t, f, o); };
    document.removeEventListener = function (t, f, o) {
      if (t === "click") { var i = clicks.indexOf(f); if (i >= 0) clicks.splice(i, 1); }
      return quitar(t, f, o);
    };
    window.__lab = {
      clicksPendientes: function () { return clicks.length; },
      avanzar: function () {
        clicks.slice().forEach(function (f) { f({ clientX: 0, clientY: 0, stopPropagation: function () {}, preventDefault: function () {} }); });
      }
    };

    // Lo que en el sitio real aporta js/lado.js
    window.ladoActual = function () { return L.lado || null; };
    window.esAdmin = function () { return !!L.admin; };
    window.esModoPrueba = function () { return false; };
    window.nombreUsuario = function () { return L.cuenta || ""; };
    window.dispararSusto = function (ms) {
      L.eventos.push({ cat: "susto", dialogo: "", opcion: String(ms || 0) + " ms" });
      var d = document.createElement("div");
      d.textContent = "SUSTO";
      d.style.cssText = "position:fixed;inset:0;background:#000;color:#c33;display:flex;align-items:center;justify-content:center;font:700 4rem sans-serif;z-index:99999";
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, ms || 1000);
    };

    // Lo que aporta js/bufon-supabase.js (nada sale a la red)
    window.bufonRegistrar = function (e) {
      L.eventos.push({ cat: e.category, dialogo: e.dialogueId, opcion: e.choiceId });
      return Promise.resolve();
    };
    window.bufonRegistrarToquePuerta = function () {
      L.toques++;
      if (L.toques === 50 && window.bufonToquePuertaFinal) window.bufonToquePuertaFinal();
    };
    window.bufonCliente = function () {
      return Promise.resolve({
        rpc: function (nombre) {
          var valor = { data: (/avanzo/.test(nombre) && L.rpcAvanzo) ? true : null };
          if (!L.latenciaRpc) return Promise.resolve(valor);
          return new Promise(function (res) { setTimeout(function () { res(valor); }, L.latenciaRpc); });
        },
        from: function () { return {}; }
      });
    };
    window.bufonEstadoEleccion = function () { return Promise.resolve({ total: 1, mi_rango: 1 }); };
    window.chequearFichasAuth = function () { return Promise.resolve(); };
    window.bufonMigrarAnonimoSiCorresponde = function () { return Promise.resolve(); };
    window.bufonEsIdentidadReal = function () { return false; };
    window.bufonPlayerId = function () { return "laboratorio"; };
  }

  /* Este script se mete justo antes del motor: suma los borradores del editor
     y fuerza ciclos abiertos o cerrados según el estado de la prueba. */
  function scriptDeCiclos(idLab, borradores) {
    const datos = JSON.stringify(borradores || []).replace(/</g, "\\u003c");
    return "(function(){var L=parent.__bufonLabs[" + JSON.stringify(idLab) + "];" +
      "(" + datos + ").forEach(function(c){window.bufonAgregarCiclo(c);});" +
      "(L.abrir||[]).forEach(function(i){if(window.BUFON_CICLOS&&BUFON_CICLOS[i])BUFON_CICLOS[i].abierto=true;});" +
      "(L.cerrar||[]).forEach(function(i){if(window.BUFON_CICLOS&&BUFON_CICLOS[i])BUFON_CICLOS[i].abierto=false;});" +
      "})();";
  }

  /* Los scripts de datos (data/*.js) se leen UNA sola vez y se meten en línea
     en cada página: así cada visita simulada no vuelve a pedir una docena de
     archivos (era lo que hacía lenta la auditoría). */
  const textos = new Map();
  async function cargarTexto(src) {
    if (!textos.has(src)) {
      const r = await fetch(src);
      if (!r.ok) throw new Error("No pude leer " + src + " (" + r.status + ").");
      textos.set(src, await r.text());
    }
    return textos.get(src);
  }
  // La página ya preparada se guarda con un id comodín: cada visita solo cambia el id (preparar el HTML es lo más caro).
  const plantillas = new Map();
  function olvidarTextos() { textos.clear(); plantillas.clear(); htmlBase = null; }

  async function prepararHtml(base, idLab, opts) {
    const doc = new DOMParser().parseFromString(base, "text/html");
    const quitar = sel => doc.querySelectorAll(sel).forEach(n => n.remove());
    quitar('script[src*="js/fichas-supabase"]');
    quitar('script[src*="js/lado.js"]');
    quitar('script[src*="js/bufon-supabase"]');
    if (!opts.modelo3d) {
      quitar('script[type="module"]');
      quitar('script[type="importmap"]');
      quitar('script[src*="clown-model-base64"]');
    }
    // Un borrador con el mismo id que un ciclo existente lo REEMPLAZA.
    (opts.borradores || []).forEach(b => quitar('script[src*="data/bufon-ciclo-' + b.id + '.js"]'));

    const motor = Array.from(doc.querySelectorAll("script:not([src])")).find(s => s.textContent.indexOf("MOTOR DE DIÁLOGO") >= 0);
    if (!motor) throw new Error("No encuentro el motor del Bufón en secreto.html (busqué 'MOTOR DE DIÁLOGO').");
    const sc = doc.createElement("script");
    sc.textContent = scriptDeCiclos(idLab, opts.borradores);
    motor.parentNode.insertBefore(sc, motor);

    for (const s of Array.from(doc.querySelectorAll("script[src]"))) {
      const src = s.getAttribute("src");
      if (!/^data\//.test(src) || (s.type && s.type !== "text/javascript")) continue;
      const texto = await cargarTexto(src);
      s.removeAttribute("src");
      s.textContent = texto.replace(/<\/script/gi, "<\\/script");
    }

    // Avisa cuando todos los scripts ya corrieron, sin esperar a las imágenes ni las fuentes (el evento load las espera y tarda ~100 ms de más).
    const fin = doc.createElement("script");
    fin.textContent = "try{parent.__bufonLabs[" + JSON.stringify(idLab + ":listo") + "]();}catch(e){}";
    doc.body.appendChild(fin);

    const pre = doc.createElement("script");
    pre.textContent = "(" + preludio.toString() + ")(" + JSON.stringify(idLab) + ");";
    doc.head.insertBefore(pre, doc.head.firstChild);
    return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
  }

  /* Crea una página del Bufón con ese estado. opts = { contenedor, clase,
     borradores, modelo3d }. Espías: pg.nodos y pg.elecciones se llenan solos. */
  async function crearPagina(L, opts) {
    opts = opts || {};
    const id = "lab" + (++contador);
    window.__bufonLabs[id] = L;
    const clave = JSON.stringify([opts.borradores || [], !!opts.modelo3d]);
    let plantilla = plantillas.get(clave);
    if (!plantilla) {
      plantilla = await prepararHtml(await cargarHtmlBase(), "__LABID__", opts);
      if (plantillas.size > 12) plantillas.clear();
      plantillas.set(clave, plantilla);
    }
    const html = plantilla.split("__LABID__").join(id);
    const iframe = document.createElement("iframe");
    iframe.className = opts.clase || "bufon-lab-oculto";
    iframe.setAttribute("title", "Bufón (laboratorio)");
    (opts.contenedor || document.body).appendChild(iframe);
    await new Promise(res => {
      window.__bufonLabs[id + ":listo"] = res;
      setTimeout(res, 8000);   // por si algo impide llegar al final de la página
      iframe.srcdoc = html;
    });
    delete window.__bufonLabs[id + ":listo"];
    const win = iframe.contentWindow;
    const pg = { id, iframe, win, doc: iframe.contentDocument, L, nodos: [], elecciones: [] };
    if (typeof win.renderNodo === "function") {
      const orig = win.renderNodo;
      win.renderNodo = function (n) { pg.nodos.push(n); return orig.apply(this, arguments); };
    }
    if (typeof win.renderEleccion === "function") {
      const orig = win.renderEleccion;
      win.renderEleccion = function (n) { pg.elecciones.push(n); return orig.apply(this, arguments); };
    }
    pg.cerrar = () => { iframe.remove(); delete window.__bufonLabs[id]; };
    return pg;
  }

  /* El click del jugador en la puerta. Devuelve { puertaCerrada, sinPuerta }. */
  async function abrirPuerta(pg, esperaMs) {
    const puerta = pg.doc.getElementById("puertaGate");
    if (!puerta) return { sinPuerta: true, puertaCerrada: false };
    const ui = pg.doc.getElementById("bufonUI");
    puerta.click();
    const t0 = Date.now();
    // Se espera cediendo el turno (no con setTimeout): el navegador frena los temporizadores de las pestañas ocultas.
    while (!ui.innerHTML.trim() && Date.now() - t0 < (esperaMs || 150)) await ceder();
    return { puertaCerrada: !ui.innerHTML.trim() };
  }

  function pantalla(pg) {
    const ui = pg.doc.getElementById("bufonUI");
    const botones = Array.from(ui.querySelectorAll("[data-id]"));
    if (botones.length) {
      return { tipo: "opciones", opciones: botones.map(b => ({ id: b.dataset.id, texto: b.textContent.trim(), voz: b.classList.contains("bufon-opcion-voz") })) };
    }
    if (!ui.innerHTML.trim()) return { tipo: "vacio" };
    const voz = ui.querySelector(".voz-nombre");
    return { tipo: pg.win.__lab.clicksPendientes() > 0 ? "linea" : "fin", texto: ui.textContent.replace(/\s+/g, " ").trim(), voz: voz ? voz.textContent.trim() : null, rota: /undefined|\[object/.test(ui.innerHTML) };
  }

  async function elegir(pg, id) {
    const b = pg.doc.getElementById("bufonUI").querySelector('[data-id="' + id + '"]');
    if (!b) throw new Error('No hay una opción "' + id + '" en pantalla.');
    b.click();
    await ceder();
  }
  async function avanzar(pg) { pg.win.__lab.avanzar(); await ceder(); }

  function rng(semilla) {
    let s = semilla >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------- jugador automático ---------- */
  async function jugarVisita(L, o) {
    L.session = nuevoAlmacen();
    L.errores = [];
    const pg = await crearPagina(L, { borradores: o.borradores });
    const problemas = [];
    try {
      const r = await abrirPuerta(pg, o.esperaMs);
      if (r.sinPuerta) return { nodos: [], elecciones: [], problemas, terminoPor: "sin_puerta", puertaCerrada: false };
      if (r.puertaCerrada) return { nodos: pg.nodos, elecciones: pg.elecciones, problemas, terminoPor: "puerta_cerrada", puertaCerrada: true };
      let pasosHub = 0;
      const limite = o.maxHub != null ? o.maxHub : 999;
      let termino = "agotado";
      for (let paso = 0; paso < 800; paso++) {
        await ceder();
        const p = pantalla(pg);
        if (p.rota) problemas.push("Pantalla con 'undefined' tras el nodo " + pg.nodos[pg.nodos.length - 1]);
        if (p.tipo === "opciones") {
          const ids = p.opciones.map(x => x.id);
          const sinCerrar = ids.filter(i => !/cerrar$/.test(i));
          if (pg.elecciones[pg.elecciones.length - 1] === "intro_reason") {
            pasosHub++;
            if (pasosHub > limite) { termino = "se_fue"; break; }
          }
          let elegido;
          if (ids.includes("registro_rechazar")) elegido = "registro_rechazar";
          else if (sinCerrar.length) elegido = o.estrategia === "orden" ? sinCerrar[0] : sinCerrar[Math.floor(o.rnd() * sinCerrar.length)];
          else elegido = ids[0];
          try { await elegir(pg, elegido); } catch (e) { problemas.push("Excepción al elegir '" + elegido + "': " + e.message); break; }
          continue;
        }
        if (p.tipo === "linea") { await avanzar(pg); continue; }
        termino = "final_sin_salida";
        break;
      }
      if (termino === "agotado") { termino = "LIMITE_DE_PASOS"; problemas.push("posible bucle: 800 pasos sin terminar la visita"); }
      L.errores.forEach(e => problemas.push("Error de JavaScript: " + e));
      return { nodos: pg.nodos, elecciones: pg.elecciones, problemas, terminoPor: termino, puertaCerrada: false };
    } finally {
      pg.cerrar();
    }
  }

  /* ---------- datos del contenido (de una página sin jugar) ---------- */
  async function leerMeta(borradores) {
    const L = nuevoEstado({ lado: "B" });
    const pg = await crearPagina(L, { borradores });
    try {
      const w = pg.win;
      const D = w.BUFON_DIALOGO;
      const repetibles = new Set(["bufon_retorno_generico", "bufon_fase2_toque_silencioso", "early_return_01", "bufon_dia_sin_visita"]);
      Object.keys(D.nodos).forEach(n => { if (D.nodos[n].consumeEncounter) repetibles.add(n); });
      const ciclos = {};
      Object.values(w.BUFON_CICLOS || {}).forEach(c => {
        ciclos[c.id] = { id: c.id, nombre: c.nombre, abierto: c.abierto, requiere: c.requiere.slice(), lados: c.lados ? c.lados.slice() : null, temas: c.temas.map(t => ({ id: t.id, boton: t.boton, preguntas: t.preguntas, grupos: t.grupos, nodos: t.nodos.slice() })) };
      });
      return {
        ciclos,
        errores: Array.from(w.BUFON_ERRORES_CICLOS || []),
        avisos: Array.from(w.BUFON_AVISOS_CICLOS || []),
        nodos: Object.keys(D.nodos),
        repetibles,
        voces: Object.keys(w.BUFON_VOCES_INFO || {}),
        // temas que usan visibleSi (una función): el editor no puede representarlos
        conVisibleSi: Object.fromEntries(Object.values(w.BUFON_CICLOS || {}).map(c => [c.id, ((c.def && c.def.temas) || []).filter(t => typeof t.visibleSi === "function").map(t => t.id)])),
        // descripciones originales para el editor (sin funciones)
        defs: JSON.parse(JSON.stringify(Object.fromEntries(Object.values(w.BUFON_CICLOS || {}).map(c => [c.id, c.def || null]))))
      };
    } finally { pg.cerrar(); }
  }

  /* ---------- auditoría ---------- */
  async function escenario(cfg, o) {
    const rnd = rng(cfg.semilla || 1);
    const L = nuevoEstado({ lado: cfg.lado, cuenta: cfg.cuenta, admin: cfg.admin, cerrar: cfg.cerrar, local: cfg.localInicial });
    const visitas = [];
    for (let v = 0; v < cfg.visitas; v++) {
      if (o.cancelado()) break;
      if (cfg.gen2EnVisita === v) L.local.setItem("bufonGen2v2_" + cfg.lado, "1");
      L.abrir = Object.entries(cfg.abrirEnVisita || {}).filter(([, desde]) => v >= desde).map(([id]) => id);
      const maxHub = cfg.maxHubPorVisita ? cfg.maxHubPorVisita[v % cfg.maxHubPorVisita.length] : 999;
      visitas.push(await jugarVisita(L, { rnd, maxHub, estrategia: cfg.estrategia || "azar", esperaMs: 30, borradores: o.borradores }));
      o.tick();
    }
    return visitas;
  }

  /* opts = { semillas, lados, borradores, nombres:[{lado,nombre,cuenta}], alProgreso(texto, fraccion), cancelado() } */
  async function auditar(opts) {
    const o = Object.assign({ semillas: 2, lados: ["A", "B"], borradores: [], nombres: [], alProgreso: () => {}, cancelado: () => false }, opts);
    const meta = await leerMeta(o.borradores);
    const res = { errores: [], avisos: [], secciones: [] };
    meta.errores.forEach(e => res.errores.push("Ciclo mal escrito: " + e));
    meta.avisos.forEach(a => res.avisos.push(a));

    const ids = Object.keys(meta.ciclos);
    const abrirTodos = Object.fromEntries(ids.map(id => [id, 5]));
    const matriz = [];
    o.lados.forEach(lado => {
      matriz.push({ n: "Side " + lado + ": primer ciclo", cfg: { lado, visitas: 8, maxHubPorVisita: [3, 6, 40, 2, 40] } });
      matriz.push({ n: "Side " + lado + ": entra a la generación 2", cfg: { lado, visitas: 12, gen2EnVisita: 3, maxHubPorVisita: [3, 6, 40, 2, 40] } });
      matriz.push({ n: "Side " + lado + ": todos los ciclos abiertos", cfg: { lado, visitas: 14, gen2EnVisita: 2, abrirEnVisita: abrirTodos, maxHubPorVisita: [3, 6, 40, 2, 40] } });
      matriz.push({ n: "Side " + lado + ": completista", cfg: { lado, visitas: 12, gen2EnVisita: 2, abrirEnVisita: abrirTodos, estrategia: "orden" } });
    });
    matriz.push({ n: "Side B como Admin", cfg: { lado: "B", admin: true, visitas: 8, maxHubPorVisita: [5, 40, 40] } });

    // total estimado de visitas, solo para la barra de progreso
    let total = matriz.reduce((s, e) => s + e.cfg.visitas, 0) * o.semillas;
    total += ids.length * 112 + o.lados.length * 2 * 7 + o.nombres.length * 18;
    let hechas = 0;
    const tick = () => { hechas++; o.alProgreso(null, Math.min(1, hechas / total)); };
    const E = { borradores: o.borradores, cancelado: o.cancelado, tick };

    // 1. repeticiones, bucles, textos rotos
    const hallazgos = new Map();
    const alcanzados = new Set();
    const fin = new Map();
    for (const e of matriz) {
      for (let s = 1; s <= o.semillas && !o.cancelado(); s++) {
        o.alProgreso(e.n, null);
        const visitas = await escenario(Object.assign({}, e.cfg, { semilla: s * 977 }), E);
        const anotar = t => { const h = hallazgos.get(t) || { n: 0, ej: e.n }; h.n++; hallazgos.set(t, h); };
        const vistoEn = new Map();
        visitas.forEach((v, i) => {
          const dentro = new Map();
          v.nodos.forEach(n => { dentro.set(n, (dentro.get(n) || 0) + 1); alcanzados.add(n); });
          dentro.forEach((c, n) => { if (c > 1 && !meta.repetibles.has(n)) anotar("Se repite dentro de una visita (×" + c + "): " + n); });
          new Set(v.nodos).forEach(n => (vistoEn.get(n) || vistoEn.set(n, []).get(n)).push(i + 1));
          v.problemas.forEach(p => anotar("Problema: " + p.slice(0, 200)));
          fin.set(v.terminoPor, (fin.get(v.terminoPor) || 0) + 1);
        });
        vistoEn.forEach((vs, n) => { if (vs.length > 1 && !meta.repetibles.has(n)) anotar("Se repite entre visitas: " + n); });
      }
    }
    const s1 = { titulo: "Repeticiones, bucles y textos rotos", lineas: [] };
    if (!hallazgos.size) s1.lineas.push({ ok: true, t: "Sin hallazgos." });
    hallazgos.forEach((h, t) => { s1.lineas.push({ ok: false, t: t + " (" + h.n + " veces, p. ej. " + h.ej + ")" }); res.errores.push(t); });
    s1.lineas.push({ info: true, t: "Cómo terminaron las visitas: " + Array.from(fin).map(([k, n]) => k + " " + n).join(" · ") });
    res.secciones.push(s1);

    // 2. cada ciclo
    const s2 = { titulo: "Cada ciclo", lineas: [] };
    if (!ids.length) s2.lineas.push({ info: true, t: "No hay ciclos cargados." });
    for (const id of ids) {
      if (o.cancelado()) break;
      o.alProgreso("Ciclo " + id, null);
      const c = meta.ciclos[id];
      const nodosCiclo = new Set([].concat(...c.temas.map(t => t.nodos)));
      const lados = c.lados || ["A", "B"];
      const deps = c.requiere.filter(r => r.indexOf("ciclo:") === 0).map(r => r.slice(6));
      const abrirCiclo = Object.fromEntries([id].concat(deps).map(x => [x, 0]));
      const filtrados = new Set();
      const alcanzadosCiclo = new Set();
      for (const lado of ["A", "B"]) {
        const permitido = lados.includes(lado);
        for (let s = 1; s <= 2; s++) {
          let v = await escenario({ lado, visitas: 6, gen2EnVisita: 0, cerrar: [id], semilla: s * 31, maxHubPorVisita: [40] }, E);
          v.forEach(x => x.nodos.forEach(n => { if (nodosCiclo.has(n)) filtrados.add("[cerrado, Side " + lado + "] " + n); }));
          if (c.requiere.includes("gen2")) {
            v = await escenario({ lado, visitas: 6, abrirEnVisita: abrirCiclo, semilla: s * 37, maxHubPorVisita: [40] }, E);
            v.forEach(x => x.nodos.forEach(n => { if (nodosCiclo.has(n)) filtrados.add("[abierto sin generación 2, Side " + lado + "] " + n); }));
          }
        }
        for (let s = 1; s <= 2; s++) {
          for (const estrategia of ["azar", "orden"]) {
            const v = await escenario({ lado, visitas: 8, gen2EnVisita: 0, abrirEnVisita: abrirCiclo, estrategia, semilla: s * 41, maxHubPorVisita: [40] }, E);
            v.forEach(x => x.nodos.forEach(n => {
              if (!nodosCiclo.has(n)) return;
              if (permitido) alcanzadosCiclo.add(n); else filtrados.add("[lado no permitido, Side " + lado + "] " + n);
            }));
          }
        }
      }
      const faltan = Array.from(nodosCiclo).filter(n => !alcanzadosCiclo.has(n));
      if (filtrados.size) { s2.lineas.push({ ok: false, t: id + ": se filtra. " + Array.from(filtrados).slice(0, 3).join("; ") }); res.errores.push("El ciclo '" + id + "' se filtra: " + Array.from(filtrados)[0]); }
      else s2.lineas.push({ ok: true, t: id + ": cerrado no se filtra, respeta generación 2 y lados." });
      if (faltan.length) {
        const t = "Ciclo '" + id + "': " + faltan.length + " nodo(s) no alcanzables en la simulación (" + faltan.join(", ") + "). ¿Una condición visibleSi que exige un hecho o un nombre?";
        s2.lineas.push({ ok: null, t }); res.avisos.push(t);
      } else s2.lineas.push({ ok: true, t: id + ": se alcanzan los " + nodosCiclo.size + " nodos al abrirlo." });
    }
    res.secciones.push(s2);

    // 3. entrada a la generación 2
    const s3 = { titulo: "Entrada a la generación 2 (el servidor ya dice 'avanzó' y el jugador abre la página justo después)", lineas: [] };
    for (const lado of o.lados) {
      for (const latencia of [0, 300]) {
        if (o.cancelado()) break;
        o.alProgreso("Entrada a la generación 2, Side " + lado, null);
        const rnd = rng(42);
        const L = nuevoEstado({ lado });
        let cerrada = false;
        for (let v = 0; v < 6 && !cerrada; v++) {
          const r = await jugarVisita(L, { rnd, maxHub: 999, estrategia: "orden", esperaMs: 30, borradores: o.borradores });
          tick();
          if (r.puertaCerrada) cerrada = true;
        }
        L.rpcAvanzo = true; L.latenciaRpc = latencia;
        const r1 = await jugarVisita(L, { rnd, maxHub: 999, estrategia: "orden", esperaMs: 900, borradores: o.borradores });
        tick();
        const ok = !r1.puertaCerrada && L.local.getItem("bufonGen2v2_" + lado) === "1";
        s3.lineas.push({ ok, t: "Side " + lado + ", red " + latencia + " ms: " + (ok ? "la primera visita ya ve el ciclo nuevo." : "la primera visita todavía ve la puerta cerrada o no guardó el desbloqueo.") });
        if (!ok) res.errores.push("Entrada a la generación 2 (Side " + lado + ", red " + latencia + " ms)");
      }
    }
    res.secciones.push(s3);

    // 4. nombres
    if (o.nombres.length) {
      const s4 = { titulo: "Reacciones por nombre", lineas: [] };
      for (const c of o.nombres) {
        if (o.cancelado()) break;
        o.alProgreso("Nombre " + c.nombre, null);
        const alc = new Set(); const probs = [];
        for (let s = 1; s <= 3; s++) {
          const ini = { bufonIntroVista: "1" }; if (c.nombre) ini.jesterPlayerName = c.nombre;
          const L = nuevoEstado({ lado: c.lado, cuenta: c.cuenta, local: ini });
          for (let v = 0; v < 6; v++) {
            if (v === 1) L.local.setItem("bufonGen2v2_" + c.lado, "1");
            const r = await jugarVisita(L, { rnd: rng(s * 7 + v), maxHub: 40, estrategia: "azar", esperaMs: 30, borradores: o.borradores });
            tick();
            r.nodos.forEach(n => alc.add(n)); probs.push(...r.problemas);
          }
        }
        const reac = Array.from(alc).filter(n => /reconoce|_intro$|revelacion/.test(n));
        s4.lineas.push({ ok: probs.length ? false : null, t: "Side " + c.lado + ", nombre «" + (c.nombre || "") + "»" + (c.cuenta ? ", cuenta «" + c.cuenta + "»" : "") + ": " + (reac.join(", ") || "sin reacción propia") + (probs.length ? " ⚠ " + probs[0] : "") });
        if (probs.length) res.errores.push("Nombre " + c.nombre + ": " + probs[0]);
      }
      res.secciones.push(s4);
    }

    const sinVer = meta.nodos.filter(n => !alcanzados.has(n));
    res.cobertura = { vistos: alcanzados.size, total: meta.nodos.length, sinVer };
    res.cancelado = o.cancelado();
    return res;
  }

  /* ---------- revisor de estilo (mismas reglas que tools/bufon, que no se sube) ---------- */
  const REGLAS = [
    { n: "x", id: "pendiente", re: /PENDIENTE/, msg: "Texto de plantilla sin reemplazar (PENDIENTE)." },
    { n: "x", id: "raya", re: /—/, msg: "Raya (—). Reescribe con punto, coma o paréntesis." },
    { n: "x", id: "voseo", re: /(?<![\p{L}])(vos|tenés|sabés|querés|podés|decís|mirá|fijate|acordate|vení|andá|sos|hacé|pensá|dejá|fijá)(?![\p{L}])/iu, msg: "Voseo. Siempre tuteo (tú)." },
    { n: "x", id: "gm", re: /\b(GM|DM|game master|máster|master|director de juego|narrador)\b/, msg: "El Bufón nunca habla del GM ni rompe la cuarta pared de forma explícita." },
    { n: "!", id: "cuerpo", re: /\b(cuerpo|existir|salir de aquí|volver a vivir)\b/i, msg: "El Bufón nunca debe decir ni insinuar que quiere un cuerpo." },
    { n: "!", id: "reveladores", re: /\b(Happy Chaos|Side C|Ryujin)\b/i, msg: "Nombre o dato reservado. ¿Seguro que debe decirse aquí?" },
    { n: "!", id: "como_si", re: /\bcomo si\b/i, msg: "\"como si\" (solo para juicios, no como muletilla)." },
    { n: "!", id: "ningun", re: /(^|[.!?]\s)Ning(ún|una|uno)\b/, msg: "Apertura con \"Ningún/Ninguna\" (tic repetido)." },
    { n: "!", id: "buena_parte", re: /\bbuena parte de\b/i, msg: "\"buena parte de\" (tic repetido)." },
    { n: "!", id: "tolera", re: /\btoler(a|an|ar|ó)\b/i, msg: "\"tolera\" (tic repetido)." },
    { n: "!", id: "no_es_es", re: /\b[Nn]o (es|son|fue|fueron|era|eran) [^.,;!?]{1,50}, (sino|es|son|fue|era)\b/, msg: "Patrón \"no es X, es Y\" (tic repetido)." },
    { n: "!", id: "dos_puntos", re: /: [a-záéíóúñ]/, msg: "Dos puntos explicativos. Prefiere dos oraciones con punto." },
    { n: "!", id: "suspensivos", re: /\.\.\./, msg: "\"...\" solo con peso real (normalmente como línea propia).", soloSiHayMasTexto: true },
    { n: "!", id: "duda", re: /\b(creo que|supongo|quizá|quizás|tal vez|a lo mejor)\b/i, msg: "Duda como muletilla. El Bufón habla con confianza." },
    { n: "!", id: "apertura_refleja", re: /^(Da igual|Cierto|No sé)\b/, msg: "Apertura refleja (\"Da igual\"/\"Cierto\"/\"No sé\"). Conviértela en una observación o un chiste." },
    { n: "!", id: "larga", re: /^.{260,}$/, msg: "Línea muy larga (más de 260 caracteres). Pártela en dos pantallas." }
  ];
  function revisarTexto(t) {
    const out = [];
    REGLAS.forEach(r => {
      if (!r.re.test(t)) return;
      if (r.soloSiHayMasTexto && t.trim() === "...") return;
      out.push({ nivel: r.n, id: r.id, msg: r.msg });
    });
    return out;
  }

  window.BufonLabMotor = {
    nuevoAlmacen, nuevoEstado, cargarHtmlBase, crearPagina, abrirPuerta, pantalla, elegir, avanzar,
    jugarVisita, leerMeta, auditar, revisarTexto, rng, dormir, ceder, olvidarTextos
  };
})();
