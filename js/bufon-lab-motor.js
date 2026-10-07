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
      rpcAvanzo: !!cfg.rpcAvanzo,   // el servidor dice que su lado avanzó (los 5 jugadores reales)
      latenciaRpc: cfg.latenciaRpc || 0,
      ciclo: Number.isInteger(cfg.ciclo) ? cfg.ciclo : null,  // el interruptor del Admin: pone al jugador en ese ciclo. null = automático
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
          var valor = (nombre === "bufon_ciclo_info")
            ? { data: { manual: (typeof L.ciclo === "number" ? L.ciclo : null), avanzo: !!L.rpcAvanzo } }
            : { data: (/avanzo/.test(nombre) && L.rpcAvanzo) ? true : null };
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

  /* Este script se mete justo antes del motor: suma los borradores del editor. Si el
     número de ciclo de un borrador todavía no está en data/bufon-ciclos-lista.js, lo
     agrega a la lista solo para esta prueba. */
  function scriptDeCiclos(idLab, borradores) {
    const datos = JSON.stringify(borradores || []).replace(/</g, "\\u003c");
    return "(function(){(" + datos + ").forEach(function(c){" +
      "var l=window.BUFON_LISTA_CICLOS=window.BUFON_LISTA_CICLOS||[];" +
      "if(!l.some(function(x){return x.numero===c.numero;}))l.push({numero:c.numero,nombre:c.nombre||c.id});" +
      "window.bufonAgregarCiclo(c);});})();";
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
    const menu = new Set(); // botones del menú principal que vio
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
          if (pg.elecciones[pg.elecciones.length - 1] === "intro_reason") ids.forEach(i => menu.add(i));
          const sinCerrar = ids.filter(i => !/cerrar$/.test(i));
          if (pg.elecciones[pg.elecciones.length - 1] === "intro_reason") {
            pasosHub++;
            if (pasosHub > limite) { termino = "se_fue"; break; }
          }
          let elegido;
          if (ids.includes("registro_rechazar")) elegido = "registro_rechazar";
          else if (sinCerrar.length) elegido = o.estrategia === "orden" ? sinCerrar[0] : o.estrategia === "ultima" ? sinCerrar[sinCerrar.length - 1] : o.estrategia === "segunda" ? sinCerrar[Math.min(1, sinCerrar.length - 1)] : sinCerrar[Math.floor(o.rnd() * sinCerrar.length)];
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
      return { nodos: pg.nodos, elecciones: pg.elecciones, problemas, terminoPor: termino, puertaCerrada: false, menu: Array.from(menu) };
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
      const lista = JSON.parse(JSON.stringify(w.BUFON_LISTA_CICLOS || []));
      // Los ciclos que viven en un archivo (3 en adelante); el 1 y el 2 están escritos a mano.
      const ciclos = {};
      Object.values(w.BUFON_CICLOS || {}).forEach(c => {
        ciclos[c.id] = { id: c.id, numero: c.numero, nombre: c.nombre, lados: c.lados ? c.lados.slice() : null, temas: c.temas.map(t => ({ id: t.id, boton: t.boton, preguntas: t.preguntas, grupos: t.grupos, nodos: t.nodos.slice() })) };
      });
      // A qué ciclo pertenece cada nodo: los de archivo por su lista de nodos, los escritos a mano por prefijo.
      const duenoDeNodo = {};
      Object.values(ciclos).forEach(c => c.temas.forEach(t => t.nodos.forEach(n => { duenoDeNodo[n] = c.numero; })));
      lista.forEach(c => (c.prefijos || []).forEach(p => Object.keys(D.nodos).forEach(n => { if (n.indexOf(p) === 0 && duenoDeNodo[n] === undefined) duenoDeNodo[n] = c.numero; })));
      const botones = D.elecciones.intro_reason.opciones.map(o => ({ id: o.id, texto: o.texto, ciclo: o.ciclo !== undefined ? o.ciclo : 1 }));
      return {
        lista, ciclos, duenoDeNodo, botones,
        cicloDeBoton: Object.fromEntries(botones.map(b => [b.id, b.ciclo])),
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
  const unico = a => Array.from(new Set(a));

  /* Un escenario = un jugador a lo largo de varias visitas.
     cfg = { lado, visitas, cicloPorVisita:[n|null,...], maxHubPorVisita:[..], estrategia,
             localInicial, cuenta, admin, semilla } */
  async function escenario(cfg, o) {
    const rnd = rng(cfg.semilla || 1);
    const L = nuevoEstado({ lado: cfg.lado, cuenta: cfg.cuenta, admin: cfg.admin, local: cfg.localInicial });
    const visitas = [];
    for (let v = 0; v < cfg.visitas; v++) {
      if (o.cancelado()) break;
      L.ciclo = cfg.cicloPorVisita ? (cfg.cicloPorVisita[v % cfg.cicloPorVisita.length] || null) : null;
      const maxHub = cfg.maxHubPorVisita ? cfg.maxHubPorVisita[v % cfg.maxHubPorVisita.length] : 999;
      const r = await jugarVisita(L, { rnd, maxHub, estrategia: cfg.estrategia || "azar", esperaMs: 30, borradores: o.borradores });
      r.cicloForzado = L.ciclo;
      visitas.push(r);
      o.tick();
    }
    visitas.estado = L; // para ver lo que se habría guardado
    return visitas;
  }

  /* ¿Recibió esta visita algo de otro ciclo? (solo si el ciclo estaba forzado) */
  function fugas(visita, meta) {
    const n = visita.cicloForzado;
    const out = [];
    if (!n) return out;
    visita.nodos.forEach(nodo => { const d = meta.duenoDeNodo[nodo]; if (d !== undefined && d !== n) out.push("el nodo " + nodo + " es del ciclo " + d); });
    (visita.menu || []).forEach(b => { const c = meta.cicloDeBoton[b]; if (c !== undefined && c !== n) out.push("el botón " + b + " es del ciclo " + c); });
    return unico(out);
  }

  /* opts = { semillas, lados, borradores, nombres:[{lado,cuenta,nombre}], alProgreso(texto, fraccion), cancelado() } */
  async function auditar(opts) {
    const o = Object.assign({ semillas: 1, lados: ["A", "B"], borradores: [], nombres: [], alProgreso: () => {}, cancelado: () => false }, opts);
    const meta = await leerMeta(o.borradores);
    const res = { errores: [], avisos: [], secciones: [] };
    meta.errores.forEach(e => res.errores.push("Ciclo mal escrito: " + e));
    meta.avisos.forEach(a => res.avisos.push(a));
    const numeros = meta.lista.map(c => c.numero);

    // 1. Matriz de jugadores: repeticiones, bucles, textos rotos y contenido de otro ciclo
    const recorrido = numeros.concat(numeros.slice().reverse()).filter((n, i, a) => i === 0 || n !== a[i - 1]);
    const cicloPorVisita = [];
    recorrido.forEach(n => { cicloPorVisita.push(n, n); });
    const matriz = [];
    o.lados.forEach(lado => {
      matriz.push({ n: "Side " + lado + ": primer ciclo (sin interruptor)", cfg: { lado, visitas: 8, maxHubPorVisita: [3, 6, 40, 2, 40] } });
      matriz.push({ n: "Side " + lado + ": movido por el Admin hacia adelante y hacia atrás", cfg: { lado, visitas: cicloPorVisita.length, cicloPorVisita, maxHubPorVisita: [3, 6, 40, 2, 40] } });
      matriz.push({ n: "Side " + lado + ": completista", cfg: { lado, visitas: cicloPorVisita.length, cicloPorVisita, estrategia: "orden" } });
    });
    matriz.push({ n: "Side B como Admin (ve todos los ciclos)", cfg: { lado: "B", admin: true, visitas: 8, maxHubPorVisita: [5, 40, 40] } });

    // total estimado de visitas, solo para la barra de progreso
    let total = matriz.reduce((s, e) => s + e.cfg.visitas, 0) * o.semillas;
    total += meta.lista.length * 2 * 2 * 4 * 8 + meta.lista.length * 4 + o.lados.length * 2 * 7 + o.nombres.length * 18;
    let hechas = 0;
    const tick = () => { hechas++; o.alProgreso(null, Math.min(1, hechas / total)); };
    const E = { borradores: o.borradores, cancelado: o.cancelado, tick };

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
          fugas(v, meta).forEach(f => anotar("Contenido de otro ciclo (jugador en el ciclo " + v.cicloForzado + "): " + f));
          fin.set(v.terminoPor, (fin.get(v.terminoPor) || 0) + 1);
        });
        vistoEn.forEach((vs, n) => { if (vs.length > 1 && !meta.repetibles.has(n)) anotar("Se repite entre visitas: " + n); });
      }
    }
    const s1 = { titulo: "Repeticiones, bucles, textos rotos y contenido de otro ciclo", lineas: [] };
    if (!hallazgos.size) s1.lineas.push({ ok: true, t: "Sin hallazgos." });
    hallazgos.forEach((h, t) => { s1.lineas.push({ ok: false, t: t + " (" + h.n + " veces, p. ej. " + h.ej + ")" }); res.errores.push(t); });
    s1.lineas.push({ info: true, t: "Cómo terminaron las visitas: " + Array.from(fin).map(([k, n]) => k + " " + n).join(" · ") });
    res.secciones.push(s1);

    // 2. Cada ciclo
    const s2 = { titulo: "Cada ciclo", lineas: [] };
    for (const c of meta.lista) {
      if (o.cancelado()) break;
      o.alProgreso("Ciclo " + c.numero, null);
      const n = c.numero;
      const modulo = Object.values(meta.ciclos).find(m => m.numero === n);
      const propios = new Set(Object.entries(meta.duenoDeNodo).filter(([, d]) => d === n).map(([nodo]) => nodo));
      const lados = modulo && modulo.lados ? modulo.lados : ["A", "B"];
      const filtrados = new Set();
      const alcanzadosCiclo = new Set();
      for (const lado of ["A", "B"]) {
        const permitido = lados.includes(lado);
        for (let s = 1; s <= 2; s++) {
          for (const estrategia of ["azar", "orden", "segunda", "ultima"]) {
            const v = await escenario({ lado, visitas: 8, cicloPorVisita: [n], estrategia, semilla: s * 41, maxHubPorVisita: [40] }, E);
            v.forEach(x => {
              fugas(x, meta).forEach(f => filtrados.add("[ciclo " + n + ", Side " + lado + "] " + f));
              x.nodos.forEach(nodo => {
                if (!propios.has(nodo)) return;
                if (permitido) alcanzadosCiclo.add(nodo); else filtrados.add("[Side " + lado + " no permitido] " + nodo);
              });
            });
          }
        }
      }
      const faltan = Array.from(propios).filter(nodo => !alcanzadosCiclo.has(nodo));
      const etiqueta = "Ciclo " + n + " (" + c.nombre + ")";
      if (filtrados.size) { s2.lineas.push({ ok: false, t: etiqueta + ": recibe contenido que no es suyo. " + Array.from(filtrados).slice(0, 3).join("; ") }); res.errores.push(etiqueta + " recibe contenido de otro ciclo: " + Array.from(filtrados)[0]); }
      else s2.lineas.push({ ok: true, t: etiqueta + ": recibe solo contenido de su ciclo." });
      if (!propios.size) s2.lineas.push({ info: true, t: etiqueta + ": todavía sin contenido." });
      else if (modulo) {
        if (faltan.length) { const t = etiqueta + ": " + faltan.length + " nodo(s) no alcanzables en la simulación (" + faltan.join(", ") + "). ¿Una condición visibleSi que exige un hecho o un nombre?"; s2.lineas.push({ ok: null, t }); res.avisos.push(t); }
        else s2.lineas.push({ ok: true, t: etiqueta + ": se alcanzan sus " + propios.size + " nodos." });
      } else s2.lineas.push({ info: true, t: etiqueta + ": alcanzó " + (propios.size - faltan.length) + " de " + propios.size + " nodos (varios dependen de hechos de la mesa o de nombres)." });
    }
    res.secciones.push(s2);

    // 3. Aviso de ciclo agotado: al agotar su ciclo, el jugador deja la marca que lee el panel de Admin
    const sAviso = { titulo: "Aviso de ciclo agotado (lo que lee el panel de Admin para avisarte de que toca avanzar al jugador)", lineas: [] };
    for (const c of meta.lista) {
      if (o.cancelado()) break;
      const n = c.numero;
      if (!Object.values(meta.duenoDeNodo).some(d => d === n)) continue;
      o.alProgreso("Aviso de ciclo agotado, ciclo " + n, null);
      const modulo = Object.values(meta.ciclos).find(m => m.numero === n);
      const lado = modulo && modulo.lados ? modulo.lados[0] : "B";
      const visitas = await escenario({ lado, visitas: 4, cicloPorVisita: [n], estrategia: "orden", semilla: 5, maxHubPorVisita: [999] }, E);
      const marca = "agotado_ciclo_" + n;
      const dejo = !!(visitas.estado && visitas.estado.eventos.some(e => e.opcion === marca));
      sAviso.lineas.push({ ok: dejo, t: "Ciclo " + n + " (" + c.nombre + "), Side " + lado + ": " + (dejo ? "deja la marca " + marca + "." : "no deja la marca " + marca + " al agotar su contenido.") });
      if (!dejo) res.errores.push("El ciclo " + n + " no deja la marca de ciclo agotado");
    }
    res.secciones.push(sAviso);

    // 4. Entrada a un ciclo nuevo: el Admin lo mueve y el jugador abre la página justo después
    const s3 = { titulo: "Entrada a un ciclo nuevo (el Admin acaba de mover al jugador al ciclo 2 y él abre la página justo después)", lineas: [] };
    for (const lado of o.lados) {
      for (const latencia of [0, 300]) {
        if (o.cancelado()) break;
        o.alProgreso("Entrada al ciclo 2, Side " + lado, null);
        const rnd = rng(42);
        const L = nuevoEstado({ lado });
        let cerrada = false;
        for (let v = 0; v < 6 && !cerrada; v++) {
          const r = await jugarVisita(L, { rnd, maxHub: 999, estrategia: "orden", esperaMs: 30, borradores: o.borradores });
          tick();
          if (r.puertaCerrada) cerrada = true;
        }
        L.ciclo = 2; L.latenciaRpc = latencia;
        const r1 = await jugarVisita(L, { rnd, maxHub: 999, estrategia: "orden", esperaMs: 900, borradores: o.borradores });
        tick();
        let guardado = false;
        try { guardado = JSON.parse(L.local.getItem("bufonCicloInfo_" + lado) || "{}").manual === 2; } catch (e) { /* sin cache */ }
        const veCiclo2 = (r1.menu || []).some(b => meta.cicloDeBoton[b] === 2);
        const ok = cerrada && !r1.puertaCerrada && guardado && veCiclo2;
        s3.lineas.push({ ok, t: "Side " + lado + ", red " + latencia + " ms: " + (ok ? "tenía la puerta cerrada y la primera visita tras moverlo ya ve el ciclo 2." : "falla (puerta cerrada antes: " + cerrada + ", puerta cerrada después: " + r1.puertaCerrada + ", guardó el ciclo: " + guardado + ", ve el menú del ciclo 2: " + veCiclo2 + ").") });
        if (!ok) res.errores.push("Entrada al ciclo 2 (Side " + lado + ", red " + latencia + " ms)");
      }
    }
    res.secciones.push(s3);

    // 4. Nombres (de la CUENTA: es lo único que el Bufón usa para reconocer a alguien)
    if (o.nombres.length) {
      const s4 = { titulo: "Reacciones por nombre de cuenta", lineas: [] };
      for (const c of o.nombres) {
        if (o.cancelado()) break;
        o.alProgreso("Cuenta " + c.cuenta, null);
        const alc = new Set(); const probs = [];
        for (let s = 1; s <= 3; s++) {
          const ini = { bufonIntroVista: "1" }; if (c.nombre) ini.jesterPlayerName = c.nombre;
          const L = nuevoEstado({ lado: c.lado, cuenta: c.cuenta, local: ini });
          for (let v = 0; v < 6; v++) {
            L.ciclo = v >= 1 ? 2 : 1;
            const r = await jugarVisita(L, { rnd: rng(s * 7 + v), maxHub: 40, estrategia: "azar", esperaMs: 30, borradores: o.borradores });
            tick();
            r.nodos.forEach(nodo => alc.add(nodo)); probs.push(...r.problemas);
          }
        }
        const reac = Array.from(alc).filter(nodo => /reconoce|_intro$|revelacion/.test(nodo));
        s4.lineas.push({ ok: probs.length ? false : null, t: "Side " + c.lado + ", cuenta «" + (c.cuenta || "") + "»" + (c.nombre ? ", nombre escrito «" + c.nombre + "»" : "") + ": " + (reac.join(", ") || "sin reacción propia") + (probs.length ? " ⚠ " + probs[0] : "") });
        if (probs.length) res.errores.push("Cuenta " + c.cuenta + ": " + probs[0]);
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
