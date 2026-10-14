/* Recompensas de cartas de los minijuegos contra la casa (ajedrez, duelo, arquería, Hooey, Zarabanda y Parranda).
   Cada juego avisa al empezar (Recompensas.iniciar) y al terminar (Recompensas.terminar); el servidor decide el
   premio con cartas_juego_iniciar / cartas_juego_terminar (scratchpad/economia_3_recompensas.sql) y aquí solo se
   muestra. Sin sesión iniciada no hace nada. Ver docs/economia-de-cartas.md, sección 6. */
window.Recompensas = (function () {
  const tokens = {};
  const VERSION = (() => {
    const s = document.currentScript || document.querySelector('script[src*="recompensas.js"]');
    const m = s && s.src.match(/\?v=[0-9a-z]+/);
    return m ? m[0] : "";
  })();
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function conSesion() {
    try { return typeof fichasSesionActual === "function" && !!(await fichasSesionActual()); } catch (e) { return false; }
  }

  async function iniciar(juego, clave) {
    delete tokens[juego];
    try {
      if (!(await conSesion())) return;
      const supabase = await fichasCliente();
      const { data, error } = await supabase.rpc("cartas_juego_iniciar", { p_juego: juego, p_clave: String(clave) });
      if (!error && data) tokens[juego] = data;
    } catch (e) { /* sin conexión o sin las tablas: la partida sigue igual */ }
  }

  /* resultado: "gana" | "pierde" | "tablas". puntuacion: lo que cada juego pida (Hooey: la racha; arquería: la diferencia de puntos). */
  async function terminar(juego, resultado, puntuacion) {
    const token = tokens[juego];
    if (!token) return null;
    delete tokens[juego];
    try {
      const supabase = await fichasCliente();
      const { data, error } = await supabase.rpc("cartas_juego_terminar", { p_token: token, p_resultado: resultado, p_puntuacion: Math.round(Number(puntuacion) || 0) });
      if (error || !data) return null;
      mostrar(juego, data);
      return data;
    } catch (e) {
      return null;
    }
  }

  /* --- Pantalla --- */
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      if (document.querySelector(`script[data-rc="${src}"]`)) { ok(); return; }
      const s = document.createElement("script");
      s.src = `${src}${VERSION}`; s.dataset.rc = src; s.onload = ok; s.onerror = () => mal(new Error(src));
      document.head.appendChild(s);
    });
  }
  function cargarCss(href) {
    if (document.querySelector(`link[data-rc="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = `${href}${VERSION}`; l.dataset.rc = href;
    document.head.appendChild(l);
  }

  const NOMBRES_JUEGO = { ajedrez: "Ajedrez", duelo: "Duelo", arqueria: "Arquería", hooey: "Hooey", fractura: "La Fractura", zarabanda: "Zarabanda", parranda: "Parranda" };
  const TRAMOS = { bueno: "Buen resultado", excelente: "Resultado excelente", extraordinario: "Resultado extraordinario", participacion: "Participación" };

  function aviso(texto, clase) {
    cargarCss("css/recompensas.css");
    const el = document.createElement("div");
    el.className = `rec-aviso ${clase || ""}`;
    el.setAttribute("role", "status");
    el.textContent = texto;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("entra"));
    setTimeout(() => { el.classList.remove("entra"); setTimeout(() => el.remove(), 400); }, 6000);
  }

  async function mostrar(juego, r) {
    const nombre = NOMBRES_JUEGO[juego] || juego;
    if (r.resultado === "carta") { await mostrarCarta(juego, r); return; }
    if (r.resultado === "sello") {
      if (r.motivo === "tope-diario") aviso(`Hoy ya llevas el máximo de cartas en ${nombre}. Esta partida suma un sello (${r.sellos}/${r.sellos_meta}). Mañana vuelves a ganar cartas.`);
      else if (r.motivo === "agotado") aviso(`Lo que te podía tocar en ${nombre} está agotado por ahora. Te llevas un sello (${r.sellos}/${r.sellos_meta}).`);
      else aviso(`+1 sello de ${nombre} (${r.sellos}/${r.sellos_meta}). Con ${r.sellos_meta} ganas una carta.`);
    }
    // "nada" (muy rápido, sin premio, sin sesión...) no se enseña
  }

  async function mostrarCarta(juego, r) {
    cargarCss("css/recompensas.css");
    let cara = "";
    try {
      cargarCss("css/cartas.css");
      if (!window.CARTAS_RAREZAS) await cargarScript("js/cartas-datos.js");
      if (!window.CartasVista) await cargarScript("js/cartas-vista.js");
      if (!window.CartasCliente) await cargarScript("js/cartas-cliente.js");
      await window.CartasCliente.cargarDefiniciones(false);
      const c = window.cartaPorId(r.carta);
      if (c) cara = window.CartasVista.htmlCarta(c, true, 1, null);
    } catch (e) { /* sin la cara, sale solo el texto */ }
    const rareza = window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r.rareza] ? window.CARTAS_RAREZAS[r.rareza].nombre : r.rareza;
    const c = window.cartaPorId ? window.cartaPorId(r.carta) : null;
    const dlg = document.createElement("dialog");
    dlg.className = "rec-modal";
    dlg.innerHTML = `
      <p class="rec-etiqueta">${esc(r.por_sellos ? "Completaste los sellos" : TRAMOS[r.tramo] || "Recompensa")}${r.mejora ? " · mejor que tu marca" : ""}</p>
      <h2>¡Ganaste una carta!</h2>
      <div class="rec-carta">${cara}</div>
      <p class="rec-nombre">${esc(c ? c.nombre : r.carta)}</p>
      <p class="rec-detalle">${esc(rareza)}${r.nueva ? " · nueva en tu colección" : " · ya tenías una"}</p>
      <button type="button" class="rec-cerrar">Genial</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".rec-cerrar").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.showModal();
  }

  return { iniciar, terminar };
})();
