/* =============================================================================
   EL REGISTRO (cronica.html): la crónica del mundo completa. SQL en docs/cronica-1_base.sql y docs/cronica-2_disparadores.sql, frases en js/cronica.js.
   Lista con filtro por juego y «Ver más», y un cuadro con lo más alto de lo que queda en la lista (mejor racha, premio más grande, quién más cartas raras...).
   Hace falta sesión: cronica_ver solo contesta a quien la tiene y respeta el Side. cronica.html?prueba=1 enseña sucesos de ejemplo sin sesión.
============================================================================= */
(function () {
  const lista = document.getElementById("crLista");
  if (!lista || !window.Cronica) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PRUEBA = new URLSearchParams(location.search).get("prueba") === "1";
  const POR_PAGINA = 30;
  const FILTROS = [["", "Todo"], ["cartas", "Cartas"], ["hipodromo", "Hipódromo"], ["veintiuna", "Las Veintiuna Velas"], ["campana", "Noticias"]];

  let supa = null, juego = "", sucesos = [], hayMas = false, cargando = false;
  const num = n => Number(n || 0).toLocaleString("es");

  function dia(iso) {
    const d = new Date(iso), hoy = new Date(), ayer = new Date(Date.now() - 86400000);
    const mismo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    return mismo(d, hoy) ? "Hoy" : mismo(d, ayer) ? "Ayer" : d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  }
  function pintar() {
    let out = "", actual = "";
    sucesos.forEach(s => {
      const l = Cronica.linea(s);
      if (!l) return;
      const d = dia(s.actualizado);
      if (d !== actual) { out += `<h3 class="cr-dia">${esc(d)}</h3>`; actual = d; }
      const hora = new Date(s.actualizado).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
      const cuerpo = `<span class="cr-ico" aria-hidden="true">${esc(l.icono)}</span><span class="cr-texto">${esc(l.texto)}${l.mio ? ` <span class="cr-tu">te toca</span>` : ""}</span><time datetime="${esc(s.actualizado)}" title="${esc(Cronica.hace(s.actualizado))}">${esc(hora)}</time>`;
      out += l.enlace ? `<a class="cr-fila${l.mio ? " cr-mio" : ""}" href="${esc(l.enlace)}">${cuerpo}</a>` : `<div class="cr-fila${l.mio ? " cr-mio" : ""}">${cuerpo}</div>`;
    });
    lista.innerHTML = out || `<p class="cr-vacio">Todavía no ha pasado nada que contar${juego ? " en este juego" : ""}.</p>`;
    $("crMas").hidden = !hayMas;
    $("crMas").disabled = false;
  }

  /* Lo más alto de lo que hay en la lista (hasta 100 sucesos sin filtrar) */
  function pintarAlto(todos) {
    const filas = [];
    const de = tipo => todos.filter(s => s.tipo === tipo && s.datos);
    const mayor = (arr, f) => arr.reduce((a, b) => (a && f(a) >= f(b) ? a : b), null);
    const rachas = de("racha_veintiuna"), mejorRacha = mayor(rachas, s => Number(s.datos.racha || 0));
    if (mejorRacha) filas.push(`Mejor racha: ${esc(mejorRacha.user || "Alguien")}, ${mejorRacha.datos.racha} victorias seguidas en Las Veintiuna Velas.`);
    const apuestas = de("apuesta_hipodromo").concat(de("apuesta_veintiuna")), grande = mayor(apuestas, s => Number(s.datos.pago || 0));
    if (grande) filas.push(`Premio más grande: ${esc(grande.user || "Alguien")} cobró ${num(grande.datos.pago)} tokens de juego (${esc(grande.tipo === "apuesta_hipodromo" ? "Hipódromo" : "Las Veintiuna Velas")}).`);
    const multi = mayor(apuestas, s => Number(s.datos.mult || 0));
    if (multi && multi !== grande) filas.push(`Mayor múltiplo: ${esc(multi.user || "Alguien")}, ${String(multi.datos.mult).replace(".", ",")} veces lo apostado.`);
    const cuenta = tipo => {
      const m = new Map();
      de(tipo).filter(s => s.user && !s.datos.resumen).forEach(s => m.set(s.user, (m.get(s.user) || 0) + 1));
      const mejor = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return mejor && mejor[1] >= 2 ? mejor : null;
    };
    const cartas = cuenta("carta_ganada");
    if (cartas) filas.push(`Más cartas raras ganadas: ${esc(cartas[0])} (${cartas[1]}).`);
    const copas = cuenta("copa_hipodromo");
    if (copas) filas.push(`Más copas ganadas en el Hipódromo: ${esc(copas[0])} (${copas[1]}).`);
    $("crAlto").hidden = !filas.length;
    $("crAltoLista").innerHTML = filas.map(f => `<li>${f}</li>`).join("");
  }

  async function leer(antes, filtro, limite) {
    if (PRUEBA) return Cronica.EJEMPLOS.filter(s => !filtro || (filtro === "campana" ? s.tipo === "nota" : true));
    const { data, error } = await supa.rpc("cronica_ver", { p_limite: limite, p_antes: antes || null, p_juego: filtro || null });
    if (error) throw error;
    return (data && data.sucesos) || [];
  }
  async function cargar(masAntiguos) {
    if (cargando) return;
    cargando = true;
    try {
      const antes = masAntiguos && sucesos.length ? sucesos[sucesos.length - 1].actualizado : null;
      const nuevos = await leer(antes, juego, POR_PAGINA);
      sucesos = masAntiguos ? sucesos.concat(nuevos) : nuevos;
      hayMas = !PRUEBA && nuevos.length === POR_PAGINA;
      pintar();
    } catch (e) {
      lista.innerHTML = `<p class="cr-vacio">${/cronica_|schema cache|does not exist/i.test((e && e.message) || "") ? "La crónica todavía no está activada en el servidor." : "No se pudo cargar la crónica. Prueba otra vez en un momento."}</p>`;
      $("crMas").hidden = true;
    } finally { cargando = false; }
  }
  function pintarFiltros() {
    const caja = $("crFiltros");
    caja.hidden = false;
    caja.innerHTML = FILTROS.map(([v, n]) => `<button type="button" class="cr-filtro${v === juego ? " activo" : ""}" data-juego="${esc(v)}" aria-pressed="${v === juego}">${esc(n)}</button>`).join("");
  }
  async function arrancar() {
    pintarFiltros();
    lista.innerHTML = `<p class="cr-vacio">Cargando...</p>`;
    try { pintarAlto(await leer(null, "", 100)); } catch (e) { $("crAlto").hidden = true; }
    await cargar(false);
  }

  $("crFiltros").addEventListener("click", ev => {
    const b = ev.target.closest("[data-juego]");
    if (!b || cargando) return;
    juego = b.dataset.juego; pintarFiltros(); cargar(false);
  });
  $("crMas").addEventListener("click", () => { $("crMas").disabled = true; cargar(true); });

  async function conSesion() {
    try { supa = await fichasCliente(); } catch (e) { lista.innerHTML = `<p class="cr-vacio">No se pudo conectar con el servidor.</p>`; return; }
    arrancar();
  }
  if (PRUEBA) arrancar();
  else if (typeof fichasEnCambioDeSesion === "function") {
    fichasEnCambioDeSesion(ses => {
      if (ses) conSesion();
      else { $("crFiltros").hidden = true; $("crAlto").hidden = true; $("crMas").hidden = true; lista.innerHTML = `<p class="cr-vacio">Inicia sesión para ver lo que pasa en la taberna.</p>`; }
    }).catch(() => { lista.innerHTML = `<p class="cr-vacio">Inicia sesión para ver lo que pasa en la taberna.</p>`; });
  }
})();
