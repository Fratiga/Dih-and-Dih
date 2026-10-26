/* =============================================================================
   LA CRÓNICA EN LA TABERNA (index.html, pestaña «Crónica» del Tablón). SQL en docs/cronica-1_base.sql y docs/cronica-2_disparadores.sql.
   Enseña los últimos sucesos del mundo (cartas raras ganadas, intercambios, crías, apuestas grandes, rachas de Veintiuna...) con las frases de js/cronica.js.
   Las pestañas solo salen cuando hay sesión y la función cronica_ver responde: si el SQL aún no está en Supabase, el Tablón se queda como siempre.
   Los avisos (js/avisos-taberna.js) llevan aquí con el botón «La taberna: N novedades»; al abrir la pestaña se apunta la hora en localStorage (lbCronicaVista).
   index.html?cronica=prueba enseña sucesos de ejemplo sin sesión (no cuenta nada de verdad).
============================================================================= */
(function () {
  const pestanas = document.getElementById("lbPestanas");
  const caja = document.getElementById("lbCronica");
  const novedades = document.getElementById("lbNovedades");
  if (!pestanas || !caja || !novedades || !window.Cronica) return;
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CLAVE_VISTA = "lbCronicaVista";
  const POR_PAGINA = 8;
  const PRUEBA = new URLSearchParams(location.search).get("cronica") === "prueba";

  let supa = null, activo = false, cargado = false, cargando = false, sucesos = [], hayMas = true, temporizador = null;
  const vista = () => { try { return localStorage.getItem(CLAVE_VISTA) || ""; } catch (e) { return ""; } };
  const apuntarVista = () => { try { localStorage.setItem(CLAVE_VISTA, new Date().toISOString()); } catch (e) { /* sin almacenamiento */ } window.dispatchEvent(new Event("cronica-vista")); };

  function fila(s) {
    const l = Cronica.linea(s);
    if (!l) return "";
    const cuerpo = `<span class="lb-cronica-ico" aria-hidden="true">${esc(l.icono)}</span><div><p>${esc(l.texto)}</p>`
      + `<time datetime="${esc(s.actualizado)}">${esc(Cronica.hace(s.actualizado))}${l.mio ? ` · <span class="lb-cronica-tu">te toca</span>` : ""}</time></div>`;
    const clase = `lb-cronica-fila${l.mio ? " lb-cronica-mio" : ""}`;
    return l.enlace ? `<a class="${clase}" href="${esc(l.enlace)}">${cuerpo}</a>` : `<div class="${clase}">${cuerpo}</div>`;
  }
  function pintar() {
    const filas = sucesos.map(fila).filter(Boolean).join("");
    caja.innerHTML = (filas || `<p class="lb-chico">Todavía no ha pasado nada que contar.</p>`)
      + (hayMas && sucesos.length ? `<button type="button" class="lb-cronica-mas" id="lbCronicaMas">Ver más</button>` : "")
      + (sucesos.length ? `<a class="lb-cronica-todo" href="cronica.html">Ver el Registro completo</a>` : "");
  }
  /* La cinta de arriba (#lbTicker, la llena js/lobby.js con las Novedades): se le suman al principio los dos últimos sucesos de la crónica */
  function cinta() {
    const pista = document.getElementById("lbTicker");
    if (!pista) return;
    pista.querySelectorAll("[data-cronica]").forEach(x => x.remove());
    const html = sucesos.map(s => ({ s, l: Cronica.linea(s) })).filter(x => x.l).slice(0, 2).map(({ s, l }) =>
      `<span data-cronica><b>[${esc(Cronica.hace(s.actualizado))}]</b> ${esc(l.icono)} ${l.enlace ? `<a href="${esc(l.enlace)}">${esc(l.texto)}</a>` : esc(l.texto)}</span>`).join("");
    if (html) pista.insertAdjacentHTML("afterbegin", html);
  }
  function insignia() {
    const n = nuevas(), b = document.getElementById("lbCronicaN");
    if (!b) return;
    b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
  }
  /* Cuántos sucesos de la lista son más nuevos que la última vez que abriste la pestaña (y no son tuyos) */
  function nuevas() {
    const t = Date.parse(vista());
    return sucesos.filter(s => !s.yo && (isNaN(t) ? false : Date.parse(s.actualizado) > t)).length;
  }

  async function leer(antes) {
    if (PRUEBA) return { sucesos: Cronica.EJEMPLOS };
    const { data, error } = await supa.rpc("cronica_ver", { p_limite: POR_PAGINA, p_antes: antes || null, p_juego: null });
    if (error) throw error;
    return data || { sucesos: [] };
  }
  async function cargar(masAntiguos) {
    if (cargando) return;
    cargando = true;
    try {
      const antes = masAntiguos && sucesos.length ? sucesos[sucesos.length - 1].actualizado : null;
      const r = await leer(antes);
      const nuevos = r.sucesos || [];
      sucesos = masAntiguos ? sucesos.concat(nuevos) : nuevos;
      hayMas = !PRUEBA && nuevos.length === POR_PAGINA;
      cargado = true;
      pestanas.hidden = false;
      pintar(); insignia(); cinta();
    } catch (e) {
      // Sin la función en Supabase (o sin red): el Tablón se queda con las Novedades de siempre
      if (!cargado) pestanas.hidden = true;
    } finally { cargando = false; }
  }

  function mostrar(cual) {
    const esCronica = cual === "cronica";
    novedades.hidden = esCronica; caja.hidden = !esCronica;
    pestanas.querySelectorAll("button").forEach(b => { const on = b.dataset.pest === cual; b.classList.toggle("activa", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    if (esCronica) { cargar(false).then(() => { apuntarVista(); insignia(); }); }
  }
  pestanas.addEventListener("click", ev => { const b = ev.target.closest("[data-pest]"); if (b) mostrar(b.dataset.pest); });
  caja.addEventListener("click", ev => { if (ev.target.closest("#lbCronicaMas")) { const b = ev.target.closest("button"); b.disabled = true; cargar(true); } });
  // Los avisos de la taberna llevan aquí
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-accion=\"cronica\"]");
    if (!b || pestanas.hidden) return;
    mostrar("cronica");
    document.getElementById("lbTablonCaja").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  async function arrancar() {
    if (activo) return;
    activo = true;
    if (!PRUEBA) { try { supa = await fichasCliente(); } catch (e) { activo = false; return; } }
    await cargar(false);
    // Cada 3 minutos, con la pestaña de Novedades a la vista, vuelve a mirar para poner al día la insignia (no toca la lista si estás leyendo la Crónica)
    temporizador = setInterval(() => { if (!document.hidden && activo && novedades.hidden === false) cargar(false); }, 180000);
  }
  function parar() { activo = false; clearInterval(temporizador); pestanas.hidden = true; mostrar("novedades"); sucesos = []; cargado = false; }

  if (PRUEBA) arrancar();
  else if (typeof fichasEnCambioDeSesion === "function") fichasEnCambioDeSesion(ses => { if (ses) arrancar(); else parar(); }).catch(() => {});
})();
