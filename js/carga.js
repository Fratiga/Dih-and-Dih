/* =============================================================================
   PANTALLA DE CARGA
   Si una página tarda en estar lista (datos grandes, cuentas, cartas que vienen del servidor), se tapa con una pantalla de
   carga en vez de enseñar la página a medias. Va al principio del <body>.

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
    "mazos.html": "Buscando tus cartas...", "batalla.html": "Preparando la mesa...", "intercambios.html": "Preparando la mesa...",
    "estadisticas.html": "Afilando las estadísticas...", "fanarts.html": "Colgando los dibujos...", "rocola.html": "Encendiendo la rocola...",
    "ajedrez.html": "Colocando las piezas...", "arqueria.html": "Tensando el arco...", "minijuegos.html": "Montando la feria...",
    "admin.html": "Abriendo el panel..."
  };
  const TOPE_MS = 12000, ESPERA_MS = 250, MINIMO_MS = 400, QUIETO_MS = 350;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .carga-pagina { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
      background: var(--bg, #14101c); color: var(--text, #eee); font-family: var(--font-body, inherit); opacity: 0; transition: opacity .18s ease; }
    .carga-pagina.visible { opacity: 1; }
    .carga-pagina.sale { opacity: 0; pointer-events: none; }
    .carga-giro { width: 44px; height: 44px; border: 5px solid var(--border, #555); border-top-color: var(--accent, #f6bf4d); border-radius: 50%; animation: carga-gira .8s linear infinite; }
    .carga-pagina p { margin: 0; font-size: 1rem; letter-spacing: .06em; color: var(--accent, #f6bf4d); text-align: center; padding: 0 20px; }
    @keyframes carga-gira { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .carga-giro { animation-duration: 2.4s; } .carga-pagina { transition: none; } }`;
  document.head.appendChild(estilo);

  const caja = document.createElement("div");
  caja.className = "carga-pagina";
  caja.id = "cargaPagina";
  caja.setAttribute("role", "status");
  caja.setAttribute("aria-live", "polite");
  caja.innerHTML = `<div class="carga-giro" aria-hidden="true"></div><p></p>`;
  caja.querySelector("p").textContent = MENSAJES[PAGINA] || "Cargando...";
  document.body.appendChild(caja);

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
  const mostrar = setTimeout(() => { if (quitada) return; visibleDesde = performance.now(); caja.classList.add("visible"); }, ESPERA_MS);

  function quitar() {
    if (quitada) return;
    quitada = true;
    clearInterval(sondeo); clearTimeout(mostrar);
    const sacar = () => { caja.classList.add("sale"); setTimeout(() => caja.remove(), 260); };
    if (visibleDesde) { const resto = MINIMO_MS - (performance.now() - visibleDesde); if (resto > 0) setTimeout(sacar, resto); else sacar(); }
    else caja.remove();   // nunca llegó a verse
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
    texto(t) { const p = caja.querySelector("p"); if (p) p.textContent = t; }
  };
})();
