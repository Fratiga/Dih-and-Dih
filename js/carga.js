/* =============================================================================
   AVISO DE CARGA
   Si una página tarda en estar lista (datos grandes, cuentas, cartas que vienen del servidor), NO se tapa: se enseña la
   página y solo se marca lo que falta.
   - Arriba: una barra fina y un aviso pequeño ("Colocando las piezas...") que no bloquean nada.
   - En el hueco del contenido que todavía no llegó (la rejilla de una lista, o cualquier elemento con data-carga="Texto"):
     un recuadro punteado con "Cargando..." hasta que se pinta lo de verdad. Es lo mismo que hace el Hipódromo.
   - No sale si la página se abre rápido: aparece solo si pasan 250 ms, y una vez que sale se queda al menos 400 ms (sin parpadeos).
   - La página se considera lista cuando: ya corrieron sus scripts y su contenido principal está pintado (ver LISTO). Las páginas que dependen del
     servidor (sin entrada en LISTO) esperan además a que no quede ninguna petición (fetch) ni la librería de Supabase por bajar.
     Como tope, a los 12 segundos se quita sola.
   - Una página puede avisar a mano con Carga.listo() (y pedir esperar con Carga.espera()).
============================================================================= */
(function () {
  if (window.Carga) return;
  const PAGINA = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* Contenido que tiene que estar pintado para dar la página por lista (un selector: debe existir al menos un elemento) */
  const entradas = "#entryGrid > *";
  const LISTO = {
    "compendio.html": entradas, "personajes.html": entradas, "lugares.html": entradas, "facciones.html": entradas, "razas.html": entradas,
    "religion.html": entradas, "textos.html": entradas, "pergaminos.html": entradas, "armas.html": entradas, "objetos.html": entradas, "bestiario.html": entradas,
    "cronologia.html": "#cronicaList > *", "mapa.html": ".mapa-pin", "reglas.html": "#reglasGrid > *", "estadisticas.html": "#statGrid > *",
    "fanarts.html": "#fanartGrid > *, #fanartSideGate:not(.hidden) > *, #fanartEmpty:not(.hidden)", "rocola.html": "#trackList > *"
  };
  const MENSAJES = {
    "index.html": "Abriendo la taberna...", "compendio.html": "Abriendo el compendio...", "mapa.html": "Desenrollando el mapa...",
    "cronologia.html": "Hojeando la cronología...", "fichas.html": "Buscando tus personajes...", "cartas.html": "Buscando tus cartas...",
    "mazos.html": "Buscando tus cartas...", "batalla.html": "Preparando la mesa...", "intercambios.html": "Encendiendo los faroles...", "forja.html": "Avivando el fuego de la forja...", "habitacion.html": "Entrando a tu habitación...", "corrales.html": "Abriendo los corrales...",
    "estadisticas.html": "Afilando las estadísticas...", "fanarts.html": "Colgando los dibujos...", "rocola.html": "Encendiendo la rocola...",
    "ajedrez.html": "Colocando las piezas...", "arqueria.html": "Tensando el arco...", "minijuegos.html": "Montando la feria...",
    "admin.html": "Abriendo el panel..."
  };
  const TOPE_MS = 12000, ESPERA_MS = 250, MINIMO_MS = 400, QUIETO_MS = 350;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .carga-barra { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 2147483000; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity .2s ease; }
    .carga-barra::before { content: ""; position: absolute; top: 0; bottom: 0; width: 40%; background: var(--accent, #f6bf4d); animation: carga-barra 1.1s ease-in-out infinite; }
    .carga-aviso { position: fixed; top: 12px; left: 50%; z-index: 2147483000; display: flex; align-items: center; gap: 10px; padding: 7px 16px 7px 12px;
      transform: translate(-50%, -8px); opacity: 0; pointer-events: none; transition: opacity .2s ease, transform .2s ease;
      background: var(--panel, #1e2022); border: 1px solid var(--accent-soft, #55554a); color: var(--accent, #f6bf4d); font-size: .85rem; letter-spacing: .05em; box-shadow: 0 6px 20px rgba(0, 0, 0, .45); }
    .carga-barra.visible { opacity: 1; }
    .carga-aviso.visible { opacity: 1; transform: translate(-50%, 0); }
    .carga-giro { width: 16px; height: 16px; border: 3px solid var(--border, #555); border-top-color: var(--accent, #f6bf4d); border-radius: 50%; animation: carga-gira .8s linear infinite; }
    /* El hueco de lo que falta: un recuadro punteado dentro de la página */
    .carga-hueco { position: relative; }
    .carga-hueco::before { content: attr(data-carga); grid-column: 1 / -1; display: flex; align-items: center; min-height: 120px; box-sizing: border-box; margin: 18px 0; padding: 14px 16px 14px 54px;
      border: 1px dashed var(--accent-soft, #55554a); color: var(--accent, #f6bf4d); letter-spacing: .05em; }
    .carga-hueco::after { content: ""; position: absolute; left: 22px; top: 66px; width: 18px; height: 18px; border: 3px solid var(--border, #555); border-top-color: var(--accent, #f6bf4d); border-radius: 50%; animation: carga-gira .8s linear infinite; }
    @keyframes carga-gira { to { transform: rotate(360deg); } }
    @keyframes carga-barra { from { left: -40%; } to { left: 100%; } }
    @media (prefers-reduced-motion: reduce) { .carga-giro, .carga-hueco::after { animation-duration: 2.4s; } .carga-barra::before { animation-duration: 2.6s; } .carga-aviso, .carga-barra { transition: none; } }`;
  document.head.appendChild(estilo);

  const mensaje = MENSAJES[PAGINA] || "Cargando...";
  const barra = document.createElement("div");
  barra.className = "carga-barra";
  barra.setAttribute("aria-hidden", "true");
  const caja = document.createElement("div");
  caja.className = "carga-aviso";
  caja.id = "cargaPagina";
  caja.setAttribute("role", "status");
  caja.setAttribute("aria-live", "polite");
  caja.innerHTML = `<div class="carga-giro" aria-hidden="true"></div><p style="margin:0"></p>`;
  caja.querySelector("p").textContent = mensaje;
  document.body.appendChild(barra);
  document.body.appendChild(caja);

  /* Huecos: el contenedor del contenido principal (de LISTO) y todo lo que traiga data-carga */
  const huecos = [];
  function marcarHuecos() {
    const sel = LISTO[PAGINA];
    if (sel) {
      sel.split(",").forEach(parte => {
        const contenedor = parte.split(">")[0].trim();
        if (!contenedor || /\s/.test(contenedor)) return;
        try {
          const el = document.querySelector(contenedor);
          if (el && !el.hasAttribute("data-carga")) { el.setAttribute("data-carga", mensaje); el.classList.add("carga-hueco"); huecos.push(el); }
        } catch (e) { /* selector raro: sin hueco */ }
      });
    }
    document.querySelectorAll("[data-carga]").forEach(el => { if (!huecos.includes(el)) { el.classList.add("carga-hueco"); huecos.push(el); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", marcarHuecos); else marcarHuecos();

  /* --- Qué sigue pendiente --- */
  let enCurso = 0, manual = 0, quietoDesde = performance.now();
  // «Cargada» es que el HTML y los scripts ya corrieron (DOMContentLoaded), no el evento load: este espera hasta la última imagen
  // y fuente, y una página puede estar lista mucho antes.
  const cargada = () => document.readyState !== "loading";
  const fetchOriginal = window.fetch;
  if (fetchOriginal) {
    window.fetch = function () {
      enCurso++;
      const fin = () => { enCurso = Math.max(0, enCurso - 1); quietoDesde = performance.now(); };
      let p;
      try { p = fetchOriginal.apply(this, arguments); } catch (e) { fin(); throw e; }
      p.then(fin, fin);
      return p;
    };
  }
  document.addEventListener("DOMContentLoaded", () => { quietoDesde = performance.now(); });

  // La librería de Supabase se baja con import(): mientras no llega, lo que depende de ella no puede estar pintado
  let supabasePendiente = false, supabaseVista = null;
  function mirarSupabase() {
    try {
      if (typeof fichasClientePromesa !== "undefined" && fichasClientePromesa && fichasClientePromesa !== supabaseVista) {
        supabaseVista = fichasClientePromesa; supabasePendiente = true;
        const fin = () => { supabasePendiente = false; quietoDesde = performance.now(); };
        fichasClientePromesa.then(fin, fin);
      }
    } catch (e) { /* aún no existe */ }
  }

  const contenidoListo = () => {
    const sel = LISTO[PAGINA];
    if (!sel) return true;
    try { if (!document.querySelector(sel)) return false; } catch (e) { return true; }
    if (PAGINA === "mapa.html") { const i = document.querySelector(".mapa-image"); if (i && !i.complete) return false; }
    return true;
  };

  /* --- Mostrar y quitar --- */
  const t0 = performance.now();
  let visibleDesde = 0, quitada = false;
  const mostrar = setTimeout(() => { if (quitada) return; visibleDesde = performance.now(); caja.classList.add("visible"); barra.classList.add("visible"); }, ESPERA_MS);

  function quitar() {
    if (quitada) return;
    quitada = true;
    clearInterval(sondeo); clearTimeout(mostrar);
    const limpiarHuecos = () => huecos.forEach(el => { el.classList.remove("carga-hueco"); el.removeAttribute("data-carga"); });
    const sacar = () => {
      caja.classList.remove("visible"); barra.classList.remove("visible");
      limpiarHuecos();
      setTimeout(() => { caja.remove(); barra.remove(); }, 260);
    };
    if (visibleDesde) { const resto = MINIMO_MS - (performance.now() - visibleDesde); if (resto > 0) setTimeout(sacar, resto); else sacar(); }
    else { caja.remove(); barra.remove(); limpiarHuecos(); }   // nunca llegó a verse
  }

  const sondeo = setInterval(() => {
    mirarSupabase();
    const ahora = performance.now();
    if (ahora - t0 > TOPE_MS) { quitar(); return; }
    if (!cargada() || manual > 0) return;
    // Las páginas que se pintan solas con sus datos (LISTO) no esperan a la red: con el contenido pintado basta. Las que dependen
    // del servidor (cuentas, cartas, partidas...) esperan a que no quede nada en curso.
    if (!LISTO[PAGINA] && (supabasePendiente || enCurso > 0)) return;
    if (ahora - quietoDesde < QUIETO_MS) return;
    if (!contenidoListo()) return;
    quitar();
  }, 80);

  window.Carga = {
    /* La página pide esperar (devuelve una función que se llama al terminar) */
    espera() { manual++; let hecho = false; return () => { if (!hecho) { hecho = true; manual = Math.max(0, manual - 1); quietoDesde = performance.now(); } }; },
    listo: quitar,
    texto(t) { const p = caja.querySelector("p"); if (p) p.textContent = t; huecos.forEach(el => el.setAttribute("data-carga", t)); }
  };
})();
