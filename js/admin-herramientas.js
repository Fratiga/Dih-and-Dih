/* =============================================================================
   HERRAMIENTAS DE ADMIN (docs/admin-herramientas.md)
   Pestañas que no son de una sola función: Cambios (historial y deshacer), Copias (descargar todo) y Salud
   (revisa las páginas del sitio y dice cuáles tienen errores). Cada una trabaja sola; si falta su SQL, lo dice.
============================================================================= */
(function () {
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = id => document.getElementById(id);
  const cuando = iso => { try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const recorte = (t, n) => { const s = typeof t === "string" ? t : JSON.stringify(t); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

  /* ===========================================================================
     CAMBIOS: historial de todo lo que se edita desde la web, con Deshacer
  =========================================================================== */
  const cambios = { filas: [], tabla: "", cargando: false, fin: false };

  async function cargarCambios(mas) {
    const lista = $("adminCambiosLista");
    if (!lista || cambios.cargando) return;
    cambios.cargando = true;
    try {
      const supabase = await fichasCliente();
      if (!mas) {
        cambios.filas = []; cambios.fin = false;
        const { data: tablas } = await supabase.from("admin_tablas").select("tabla, etiqueta").order("etiqueta");
        const sel = $("adminCambiosTabla");
        if (tablas && sel.options.length <= 1) tablas.forEach(t => sel.insertAdjacentHTML("beforeend", `<option value="${esc(t.tabla)}">${esc(t.etiqueta || t.tabla)}</option>`));
      }
      const ultimo = cambios.filas.length ? cambios.filas[cambios.filas.length - 1].id : null;
      const { data, error } = await supabase.rpc("admin_cambios_listar", { p_limite: 40, p_tabla: cambios.tabla || null, p_antes_de: ultimo });
      if (error) throw error;
      cambios.filas.push(...data);
      if (data.length < 40) cambios.fin = true;
      pintarCambios();
    } catch (e) {
      lista.innerHTML = `<p class="admin-vacio">No se pudo cargar el historial. ¿Corriste docs/admin/admin_historial.sql en Supabase? (${esc(e.message || e)})</p>`;
    } finally {
      cambios.cargando = false;
    }
  }

  const VERBO = { INSERT: "Creó", UPDATE: "Cambió", DELETE: "Borró" };

  function resumenDiff(c) {
    if (c.operacion !== "UPDATE" || !c.antes || !c.despues) return "";
    const claves = Object.keys(c.despues).filter(k => JSON.stringify(c.antes[k]) !== JSON.stringify(c.despues[k]) && !["actualizada", "actualizada_por"].includes(k));
    if (!claves.length) return "";
    return claves.slice(0, 4).map(k => {
      // Si el valor es un objeto (config, data...), se nombran los campos que cambiaron dentro
      const a = c.antes[k], d = c.despues[k];
      if (a && d && typeof a === "object" && typeof d === "object" && !Array.isArray(a)) {
        const dentro = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(x => JSON.stringify(a[x]) !== JSON.stringify(d[x]));
        return `<b>${esc(k)}</b>: ${dentro.slice(0, 6).map(esc).join(", ")}${dentro.length > 6 ? "…" : ""}`;
      }
      return `<b>${esc(k)}</b>: ${esc(recorte(a, 40))} → ${esc(recorte(d, 40))}`;
    }).join(" · ");
  }

  function pintarCambios() {
    const lista = $("adminCambiosLista");
    if (!cambios.filas.length) { lista.innerHTML = `<p class="admin-vacio">Todavía no hay cambios anotados.</p>`; return; }
    const pintar = c => {
      const clave = Object.values(c.clave || {}).join(" · ");
      const titulo = c.revierte ? `Deshizo el cambio #${c.revierte}` : `${VERBO[c.operacion] || c.operacion}`;
      return `<div class="admin-cambio${c.revertido ? " revertido" : ""}" data-id="${c.id}">
        <div class="admin-cambio-top">
          <span class="admin-cambio-cuando">${esc(cuando(c.momento))}</span>
          <span class="admin-cambio-quien">${esc(c.quien || "—")}</span>
          <span class="admin-cambio-tabla">${esc(c.etiqueta)}</span>
        </div>
        <div class="admin-cambio-que"><strong>${esc(titulo)}</strong> <code>${esc(recorte(clave, 60))}</code>${c.revertido ? ` <em>(ya revertido)</em>` : ""}</div>
        ${resumenDiff(c) ? `<div class="admin-cambio-diff">${resumenDiff(c)}</div>` : ""}
        <details><summary>Ver antes y después</summary>
          <div class="admin-cambio-json"><div><b>Antes</b><pre>${esc(c.antes ? JSON.stringify(c.antes, null, 1) : "—")}</pre></div><div><b>Después</b><pre>${esc(c.despues ? JSON.stringify(c.despues, null, 1) : "—")}</pre></div></div>
        </details>
        <button type="button" class="admin-cuenta-accion" data-deshacer="${c.id}"${c.revertido ? " disabled" : ""}>Deshacer</button>
      </div>`;
    };
    lista.innerHTML = cambios.filas.map(pintar).join("") + (cambios.fin ? "" : `<p><button type="button" class="admin-cuenta-accion" data-mas>Ver más antiguos</button></p>`);
  }

  async function deshacer(id) {
    const c = cambios.filas.find(x => x.id === id);
    if (!c) return;
    const ok = await dialogo.confirmar(`¿Deshacer este cambio?\n\n${VERBO[c.operacion] || c.operacion} «${Object.values(c.clave || {}).join(" · ")}» en ${c.etiqueta}. Queda anotado y se puede rehacer.`, { titulo: "Deshacer", aceptar: "Deshacer" });
    if (!ok) return;
    try {
      const supabase = await fichasCliente();
      const { error } = await supabase.rpc("admin_cambio_revertir", { p_id: id });
      if (error) throw error;
      await dialogo.avisar("Hecho. Recarga la página afectada para ver el cambio.", { titulo: "Deshecho" });
      cargarCambios(false);
    } catch (e) {
      dialogo.avisar(`No se pudo deshacer: ${e.message || e}`, { tipoAviso: "error" });
    }
  }

  function iniciarCambios() {
    const pan = $("adminPanelCambios");
    if (!pan) return;
    $("adminCambiosTabla").addEventListener("change", ev => { cambios.tabla = ev.target.value; cargarCambios(false); });
    $("adminCambiosRecargar").addEventListener("click", () => cargarCambios(false));
    pan.addEventListener("click", ev => {
      const d = ev.target.closest("[data-deshacer]");
      if (d) deshacer(Number(d.dataset.deshacer));
      if (ev.target.closest("[data-mas]")) cargarCambios(true);
    });
    document.querySelector('[data-tab="cambios"]').addEventListener("click", () => { if (!cambios.filas.length) cargarCambios(false); });
  }

  /* ===========================================================================
     COPIAS: descarga un archivo con el contenido (y, si quieres, los datos de los jugadores)
  =========================================================================== */
  const COPIA_CONTENIDO = [
    "cartas_catalogo", "cartas_definiciones", "cartas_vinculos", "cartas_recetas", "musica_paginas",
    "fanarts_side", "fanarts_ocultos", "fanarts_subidos", "rocola_canciones", "rocola_nombres", "rocola_ocultas", "rocola_fondos",
    "ritmo_mapas", "parranda_mapas", "ritmo_patrones", "parranda_patrones", "stats_ediciones",
    "contenido_servidor", "hipodromo_criaturas", "hipodromo_calendario"
  ];
  const COPIA_JUGADORES = [
    "perfiles", "fichas_personajes", "fichas_historial", "peticiones", "cartas_coleccion", "cartas_mazos", "cartas_numeradas",
    "cartas_ejemplares", "cartas_movimientos", "cartas_registro", "bufon_jugadores", "bufon_elecciones", "bufon_ciclo_jugador",
    "bufon_ciclo_lado", "muerte_subita_intentos", "hooey_puntajes", "mj_estadisticas", "atajos_usuario", "ritmo_puntajes", "parranda_puntajes"
  ];

  async function descargarCopia(tablas, nombre) {
    const estado = $("adminCopiasEstado");
    const botones = document.querySelectorAll("#adminPanelCopias button");
    botones.forEach(b => { b.disabled = true; });
    try {
      const supabase = await fichasCliente();
      const copia = { app: "dnd_compendio", fecha: new Date().toISOString(), tablas: {}, sinLeer: {} };
      let filas = 0;
      for (const t of tablas) {
        estado.textContent = `Leyendo ${t}...`;
        const todas = [];
        let fallo = null;
        for (let desde = 0; ; desde += 1000) {
          const { data, error } = await supabase.from(t).select("*").range(desde, desde + 999);
          if (error) { fallo = error; break; }
          todas.push(...data);
          if (data.length < 1000) break;
        }
        if (fallo) {
          // Una tabla que todavía no existe no es un problema: simplemente no entra
          copia.sinLeer[t] = /not find the table|does not exist|PGRST205|42P01/i.test(`${fallo.code} ${fallo.message}`) ? "no existe" : fallo.message;
        } else { copia.tablas[t] = todas; filas += todas.length; }
      }
      const blob = new Blob([JSON.stringify(copia)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      const ok = Object.keys(copia.tablas).length, no = Object.keys(copia.sinLeer);
      estado.textContent = `Listo: ${ok} tablas y ${filas} filas.${no.length ? ` No se pudieron leer: ${no.map(n => `${n} (${copia.sinLeer[n]})`).join(", ")}.` : ""}`;
    } catch (e) {
      estado.textContent = `No se pudo hacer la copia: ${e.message || e}`;
    } finally {
      botones.forEach(b => { b.disabled = false; });
    }
  }

  function iniciarCopias() {
    if (!$("adminPanelCopias")) return;
    $("adminCopiaContenido").addEventListener("click", () => descargarCopia(COPIA_CONTENIDO, "copia-contenido"));
    $("adminCopiaTodo").addEventListener("click", () => descargarCopia([...COPIA_CONTENIDO, ...COPIA_JUGADORES], "copia-completa"));
  }

  /* ===========================================================================
     SALUD: abre cada página en un marco invisible y anota errores, recursos que no cargan e imágenes rotas
  =========================================================================== */
  const PAGINAS_SALUD = [
    "index", "compendio", "mapa", "cronologia", "lugares", "facciones", "personajes", "razas", "religion", "textos", "pergaminos",
    "armas", "objetos", "bestiario", "reglas", "economia", "estadisticas", "fanarts", "peticiones", "fichas", "rocola",
    "minijuegos", "ajedrez", "arqueria", "duelo", "cartas", "mazos", "batalla", "ostelar", "hipodromo", "sacrificio",
    "ritmo", "parranda", "muerte-subita", "encuentro-verdam"
  ];
  const RUIDO = /ResizeObserver|Script error\.?$|The play\(\) request/i;
  let escaneando = false;

  function escanear(pagina) {
    return new Promise(resolver => {
      const marco = document.createElement("iframe");
      marco.setAttribute("allow", "autoplay 'none'; camera 'none'; microphone 'none'; geolocation 'none'");
      marco.setAttribute("aria-hidden", "true");
      marco.tabIndex = -1;
      marco.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;opacity:0;pointer-events:none;border:0;z-index:-1";
      const res = { errores: [], recursos: [], imagenes: [], destino: "", ms: 0 };
      const t0 = performance.now();
      let hecho = false, cargada = false, listoDesde = 0; // eslint-disable-line no-unused-vars
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        clearInterval(sondeo);
        try {
          const w = marco.contentWindow, d = w.document;
          res.destino = w.location.pathname.split("/").pop();
          [...d.images].forEach(i => { if (i.src && !i.src.startsWith("data:") && i.complete && i.naturalWidth === 0) res.imagenes.push(i.getAttribute("src")); });
        } catch (e) { /* otra página u origen */ }
        res.ms = Math.round(performance.now() - t0);
        marco.remove();
        resolver(res);
      };
      const sondeo = setInterval(() => {
        try {
          const w = marco.contentWindow;
          if (w.location.href !== "about:blank" && !w.__saludEnganchada) {
            w.__saludEnganchada = true;
            w.addEventListener("error", e => {
              const t = e.target;
              if (t && t !== w && (t.src || t.href)) res.recursos.push(`${(t.tagName || "").toLowerCase()} ${(t.src || t.href).split("/").slice(-2).join("/")}`);
              else if (e.message && !RUIDO.test(e.message)) res.errores.push(`${e.message} (${String(e.filename || "").split("/").pop()}:${e.lineno})`);
            }, true);
            w.addEventListener("unhandledrejection", e => { const m = String((e.reason && e.reason.message) || e.reason); if (!RUIDO.test(m)) res.errores.push(`Promesa sin atender: ${m}`); });
            const origen = w.console.error.bind(w.console);
            w.console.error = (...a) => { const m = a.map(x => (x && x.message) || String(x)).join(" "); if (!RUIDO.test(m)) res.errores.push(`console.error: ${m}`); origen(...a); };
          }
          // Se da por revisada 3,5 s después de que el HTML esté listo, sin esperar a que termine de bajar todo (un recurso colgado
          // haría esperar el máximo en cada página)
          if (w.location.href !== "about:blank" && w.document.readyState !== "loading") {
            if (!listoDesde) listoDesde = performance.now();
            else if (performance.now() - listoDesde > 3500) terminar();
          }
        } catch (e) { /* aún no listo */ }
        if (performance.now() - t0 > 14000) terminar();
      }, 10);
      // El evento load del marco (no el de su ventana, que se reutiliza): se espera un momento más para las imágenes
      marco.addEventListener("load", () => {
        try { if (marco.contentWindow.location.href === "about:blank") return; } catch (e) { /* otra página: sigue */ }
        cargada = true;
        setTimeout(terminar, 1800);
      });
      document.body.appendChild(marco);
      marco.src = `${pagina}.html`;
    });
  }

  async function revisarSalud(paginas) {
    if (escaneando) return;
    escaneando = true;
    const lista = $("adminSaludLista"), boton = $("adminSaludRevisar");
    boton.disabled = true;
    const filas = [];
    const pintar = fin => {
      const malas = filas.filter(f => f.errores.length || f.recursos.length || f.imagenes.length);
      $("adminSaludCount").textContent = fin && malas.length ? String(malas.length) : "";
      lista.innerHTML = `<p class="admin-sistema-resumen ${malas.length ? "mal" : "bien"}">${fin
        ? (malas.length ? `${malas.length} de ${filas.length} páginas tienen algo que revisar.` : `Las ${filas.length} páginas cargaron sin errores.`)
        : `Revisando... ${filas.length} de ${paginas.length}`}</p>` +
        filas.map(f => {
          const n = f.errores.length + f.recursos.length + f.imagenes.length;
          return `<details class="admin-sistema-fila ${n ? "falta" : "ok"}"><summary>
            <span class="admin-sistema-marca">${n ? "✗" : "✓"}</span>
            <span class="admin-sistema-que"><a href="${esc(f.pagina)}.html" target="_blank" rel="noopener">${esc(f.pagina)}.html</a>${f.destino && f.destino !== f.pagina + ".html" ? ` <small>abrió ${esc(f.destino)}</small>` : ""}</span>
            <span class="admin-sistema-sql">${n ? `${n} problema${n === 1 ? "" : "s"}` : `${f.ms} ms`}</span></summary>
            ${n ? `<ul class="admin-salud-detalle">${[
              ...f.errores.map(x => `<li>Error: ${esc(recorte(x, 200))}</li>`),
              ...f.recursos.map(x => `<li>No cargó: ${esc(x)}</li>`),
              ...f.imagenes.map(x => `<li>Imagen rota: ${esc(x)}</li>`)
            ].join("")}</ul>` : ""}
          </details>`;
        }).join("");
    };
    pintar(false);
    for (const p of paginas) {
      const r = await escanear(p);
      filas.push({ pagina: p, ...r });
      pintar(false);
    }
    pintar(true);
    boton.disabled = false;
    escaneando = false;
  }

  function iniciarSalud() {
    if (!$("adminPanelSalud")) return;
    $("adminSaludRevisar").addEventListener("click", () => revisarSalud(PAGINAS_SALUD));
  }

  iniciarCambios();
  iniciarCopias();
  iniciarSalud();
})();
