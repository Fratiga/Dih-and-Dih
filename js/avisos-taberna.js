/* =============================================================================
   AVISOS DE LA TABERNA (index.html, franja #lbAvisos bajo la cinta de novedades)
   Cosas que esperan a quien entra, con un enlace directo cada una:
     • crías listas para recoger en los corrales          (cartas_corral_ver)
     • retos de ajedrez y de arquería, y partidas donde te toca mover (ajedrez_partidas, arqueria_partidas)
     • ofertas de trueque dirigidas a ti                  (cartas_intercambios)
     • ofertas nuevas del Buhonero desde la última vez que lo miraste (cartas_mercader_ver; intercambios.js apunta lo que ya viste)
     • eventos del Admin en marcha (eventos_sitio): aviso con enlace opcional y, si llevan regalo, un botón para reclamarlo una vez (evento_reclamar)
   Cada fuente falla por separado: si una tabla o función no existe, ese aviso simplemente no sale. Se vuelve a mirar cada 2 minutos y al
   volver a la pestaña, y el título de la pestaña lleva el número de avisos para que se note sin tenerla delante.
   index.html?avisos=prueba enseña avisos de ejemplo (para ver cómo quedan; no cuenta nada de verdad).
============================================================================= */
(function () {
  const caja = document.getElementById("lbAvisos");
  if (!caja) return;
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const TITULO = document.title.replace(/^\(\d+\)\s*/, "");
  const CLAVE_BUHONERO = "lbBuhoneroVisto";
  const PRUEBA = new URLSearchParams(location.search).get("avisos") === "prueba";

  let supa = null, miId = null, activo = false, temporizador = null, leyendo = false;

  const dia = () => new Date().toISOString().slice(0, 10);
  const buhoneroVisto = () => { try { const v = JSON.parse(localStorage.getItem(CLAVE_BUHONERO) || "null"); return v && v.dia === dia() ? new Set(v.ids || []) : new Set(); } catch (e) { return new Set(); } };

  /* Cada fuente devuelve una lista de avisos { icono, texto, href } (vacía si no hay nada) y nunca lanza */
  async function crias() {
    try {
      const t0 = Date.now();
      const { data, error } = await supa.rpc("cartas_corral_ver");
      if (error || !data) return [];
      const ahora = Date.parse(data.ahora) + (Date.now() - t0);
      const listas = (data.corrales || []).filter(c => c.cria && Date.parse(c.cria.fin) <= ahora);
      if (!listas.length) return [];
      return [{ icono: "🐣", texto: listas.length === 1 ? "Tu cría del corral está lista" : `${listas.length} crías listas para recoger`, href: `corrales.html#${listas[0].habitat}`, urgente: true }];
    } catch (e) { return []; }
  }
  async function ajedrez() {
    try {
      const { data, error } = await supa.from("ajedrez_partidas").select("estado, retador, blancas, negras, jugadas").in("estado", ["pendiente", "en_curso"]);
      if (error || !data) return [];
      const retos = data.filter(p => p.estado === "pendiente" && p.retador !== miId).length;
      const turno = data.filter(p => p.estado === "en_curso" && (((p.jugadas || []).length % 2 === 0) ? p.blancas : p.negras) === miId).length;
      const out = [];
      if (retos) out.push({ icono: "♞", texto: `Ajedrez: ${plural(retos, "reto sin responder", "retos sin responder")}`, href: "ajedrez.html" });
      if (turno) out.push({ icono: "♞", texto: `Ajedrez: te toca mover en ${plural(turno, "partida", "partidas")}`, href: "ajedrez.html" });
      return out;
    } catch (e) { return []; }
  }
  async function arqueria() {
    try {
      const { data, error } = await supa.from("arqueria_partidas").select("estado, a, b").in("estado", ["pendiente", "listos", "jugando"]);
      if (error || !data) return [];
      const retos = data.filter(p => p.estado === "pendiente" && p.b === miId).length;
      const marcha = data.filter(p => p.estado !== "pendiente").length;
      const out = [];
      if (retos) out.push({ icono: "➶", texto: `Arquería: ${plural(retos, "reto sin responder", "retos sin responder")}`, href: "arqueria.html" });
      if (marcha) out.push({ icono: "➶", texto: `Arquería: ${plural(marcha, "partida en marcha", "partidas en marcha")}`, href: "arqueria.html" });
      return out;
    } catch (e) { return []; }
  }
  async function trueques() {
    try {
      const { data, error } = await supa.from("cartas_intercambios").select("id, para, estado").eq("estado", "abierta").eq("para", miId);
      if (error || !data || !data.length) return [];
      return [{ icono: "⇄", texto: `${plural(data.length, "intercambio te espera", "intercambios te esperan")}`, href: "intercambios.html", urgente: true }];
    } catch (e) { return []; }
  }
  async function buhonero() {
    try {
      const { data, error } = await supa.rpc("cartas_mercader_ver");
      if (error || !data || !Array.isArray(data.ofertas)) return [];
      const vistas = buhoneroVisto();
      const nuevas = data.ofertas.filter(o => !vistas.has(o.id)).length;
      if (!nuevas) return [];
      return [{ icono: "✦", texto: nuevas === 1 ? "El Buhonero tiene una oferta nueva" : `El Buhonero tiene ${nuevas} ofertas nuevas`, href: "intercambios.html#buhonero" }];
    } catch (e) { return []; }
  }

  async function eventos() {
    try {
      const [ev, rec] = await Promise.all([supa.from("eventos_sitio").select("id, titulo, texto, enlace, regalo_carta, regalo_monedas, hasta").order("hasta"),
        supa.from("eventos_reclamos").select("evento").eq("user_id", miId)]);
      if (ev.error || !ev.data) return [];
      const hechos = new Set((rec.data || []).map(r => r.evento));
      const ahora = Date.now();
      return ev.data.filter(e => Date.parse(e.hasta) > ahora).map(e => {
        const regalo = !!(e.regalo_carta || e.regalo_monedas), reclamable = regalo && !hechos.has(e.id);
        return { icono: "🎁", texto: reclamable ? `${e.titulo}: reclama tu regalo` : e.titulo, detalle: e.texto || "", href: e.enlace || "", reclamar: reclamable ? e.id : "", urgente: reclamable };
      });
    } catch (e) { return []; }
  }

  function chip(a) {
    const clase = `lb-aviso-chip${a.urgente ? " lb-aviso-chip-fuerte" : ""}`, cuerpo = `<span aria-hidden="true">${esc(a.icono)}</span> ${esc(a.texto)}`, ayuda = a.detalle ? ` title="${esc(a.detalle)}"` : "";
    if (a.reclamar) return `<button type="button" class="${clase}" data-reclamar="${esc(a.reclamar)}"${ayuda}>${cuerpo}</button>`;
    if (!a.href) return `<span class="${clase}"${ayuda}>${cuerpo}</span>`;
    return `<a class="${clase}" href="${esc(a.href)}"${ayuda}>${cuerpo}</a>`;
  }
  function pintar(avisos) {
    caja.hidden = !avisos.length;
    caja.innerHTML = avisos.length ? `<span class="lb-avisos-etq">AVISOS</span>${avisos.map(chip).join("")}` : "";
    document.title = avisos.length ? `(${avisos.length}) ${TITULO}` : TITULO;
  }

  async function mirar() {
    if (leyendo || !activo) return;
    leyendo = true;
    try {
      if (PRUEBA) {
        pintar([{ icono: "🐣", texto: "Tu cría del corral está lista", href: "corrales.html", urgente: true }, { icono: "♞", texto: "Ajedrez: 2 retos sin responder", href: "ajedrez.html" },
          { icono: "⇄", texto: "1 intercambio te espera", href: "intercambios.html", urgente: true }, { icono: "✦", texto: "El Buhonero tiene 3 ofertas nuevas", href: "intercambios.html#buhonero" },
          { icono: "🎁", texto: "Torneo de otoño: reclama tu regalo", detalle: "Evento de ejemplo", reclamar: "prueba", urgente: true }, { icono: "🎁", texto: "Noche de bardos en la taberna", href: "" }]);
        return;
      }
      const grupos = await Promise.all([crias(), trueques(), ajedrez(), arqueria(), buhonero(), eventos()]);
      if (activo) pintar(grupos.flat());
    } finally { leyendo = false; }
  }

  async function arrancar(sesion) {
    if (activo) return;
    activo = true;
    miId = sesion.user.id;
    try { supa = await fichasCliente(); } catch (e) { activo = false; return; }
    mirar();
    temporizador = setInterval(() => { if (!document.hidden) mirar(); }, 120000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) mirar(); });
  }
  caja.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-reclamar]");
    if (!b || b.disabled) return;
    if (PRUEBA) { b.textContent = "🎁 (prueba) regalo reclamado"; b.disabled = true; return; }
    b.disabled = true;
    try {
      const { data, error } = await supa.rpc("evento_reclamar", { p_id: b.dataset.reclamar });
      if (error) throw error;
      const partes = [data && data.carta ? "una carta nueva en tu álbum" : "", data && data.monedas ? `${data.monedas} tokens de juego` : ""].filter(Boolean);
      b.textContent = `🎁 Recibiste ${partes.join(" y ") || "tu regalo"}`;
      setTimeout(() => { if (activo) mirar(); }, 4000);
    } catch (e) {
      const m = String((e && e.message) || e).replace(/^ERROR:\s*/, "");
      b.textContent = /Ya reclamaste/.test(m) ? "🎁 Ya lo reclamaste" : `🎁 No se pudo: ${m}`;
      if (!/Ya reclamaste/.test(m)) b.disabled = false;
    }
  });
  function parar() { activo = false; clearInterval(temporizador); pintar([]); }

  if (PRUEBA) { activo = true; mirar(); }
  else if (typeof fichasEnCambioDeSesion === "function") fichasEnCambioDeSesion(ses => { if (ses) arrancar(ses); else parar(); }).catch(() => {});
})();
