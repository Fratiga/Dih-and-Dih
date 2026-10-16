/* =============================================================================
   PESTAÑA «REGALOS Y EVENTOS» (panel de Admin), SQL en docs/admin/regalos_eventos.sql
   1) Regalar una carta: a una persona, a un Side o a todos. Pasa por la economía de cartas (límites, circulación, reserva): a quien no le cabe se le salta y aquí se
      dice quién y por qué.
   2) Regalar monedas del Hipódromo, igual de repartido.
   3) Eventos: un aviso con fecha de inicio y de fin que sale en la taberna (js/avisos-taberna.js), con enlace opcional y, si quieres, un regalo (carta y/o monedas)
      que cada jugador reclama una vez desde la taberna.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelRegalos");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAGINAS = [["", "(sin enlace)"], ["index.html", "La taberna"], ["compendio.html", "Compendio"], ["mapa.html", "Mapa"], ["minijuegos.html", "Minijuegos"], ["ajedrez.html", "Ajedrez"], ["arqueria.html", "Arquería"],
    ["cartas.html", "Triunfos (álbum)"], ["intercambios.html", "Intercambios"], ["hipodromo.html", "Hipódromo"], ["hipodromo-vivo.html", "Hipódromo en vivo"], ["corrales.html", "Corrales"], ["fanarts.html", "Fanarts"], ["peticiones.html", "Peticiones"], ["rocola.html", "Rocola"]];

  let cartas = [], jugadores = [], nombreCarta = new Map(), listo = false;
  const cliente = () => fichasCliente();
  const estado = (t, error) => { const e = $("adminRegalosEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };
  const fecha = iso => new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const deLocal = v => (v ? new Date(v).toISOString() : "");

  function opcionesDestino() {
    return `<option value="todos">Todos los jugadores</option><option value="side:A">Todo el Side A</option><option value="side:B">Todo el Side B</option>`
      + jugadores.map(j => `<option value="u:${esc(j.id)}">${esc(j.username || "(sin nombre)")}</option>`).join("");
  }
  const destino = v => (v.startsWith("u:") ? { p_usuario: v.slice(2), p_side: null } : v.startsWith("side:") ? { p_usuario: null, p_side: v.slice(5) } : { p_usuario: null, p_side: null });
  const textoDestino = v => (v === "todos" ? "a todos los jugadores" : v.startsWith("side:") ? `al Side ${v.slice(5)}` : `a ${(jugadores.find(j => "u:" + j.id === v) || {}).username || "esa persona"}`);

  async function cargarBase() {
    const sb = await cliente();
    const [c, j] = await Promise.all([sb.from("cartas_definiciones").select("id, data"), typeof adminListarPerfiles === "function" ? adminListarPerfiles() : Promise.resolve([])]);
    if (c.error) throw c.error;
    cartas = (c.data || []).map(x => ({ id: x.id, nombre: (x.data && x.data.nombre) || x.id })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    nombreCarta = new Map(cartas.map(x => [x.id, x.nombre]));
    jugadores = (j || []).slice().sort((a, b) => String(a.username || "").localeCompare(String(b.username || ""), "es"));
  }
  const resolverCarta = texto => {
    const t = String(texto || "").trim().toLowerCase();
    if (!t) return null;
    const exacta = cartas.find(c => c.nombre.toLowerCase() === t || c.id === t);
    if (exacta) return exacta.id;
    const parecidas = cartas.filter(c => c.nombre.toLowerCase().includes(t));
    return parecidas.length === 1 ? parecidas[0].id : null;
  };

  function pintarFormularios() {
    $("adminRegalosCartas").innerHTML = cartas.map(c => `<option value="${esc(c.nombre)}"></option>`).join("");
    $("adminRegaloCartaPara").innerHTML = opcionesDestino();
    $("adminRegaloMonedasPara").innerHTML = opcionesDestino();
    $("adminEventoPagina").innerHTML = PAGINAS.map(([h, n]) => `<option value="${h}">${esc(n)}</option>`).join("");
    const ahora = new Date(); const manana = new Date(Date.now() + 7 * 86400000);
    const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (!$("adminEventoDesde").value) $("adminEventoDesde").value = local(ahora);
    if (!$("adminEventoHasta").value) $("adminEventoHasta").value = local(manana);
  }

  async function pintarEventos() {
    const caja = $("adminEventosLista");
    const sb = await cliente();
    const { data, error } = await sb.from("eventos_sitio").select("id, titulo, texto, enlace, side, desde, hasta, regalo_carta, regalo_monedas").order("hasta", { ascending: false }).limit(60);
    if (error) throw error;
    const { data: rec } = await sb.from("eventos_reclamos").select("evento");
    const cuenta = {}; (rec || []).forEach(r => { cuenta[r.evento] = (cuenta[r.evento] || 0) + 1; });
    const ahora = Date.now();
    caja.innerHTML = (data || []).length ? data.map(e => {
      const en = new Date(e.desde) <= ahora && new Date(e.hasta) > ahora, futuro = new Date(e.desde) > ahora;
      const regalo = [e.regalo_carta ? `la carta ${nombreCarta.get(e.regalo_carta) || e.regalo_carta}` : "", e.regalo_monedas ? `${e.regalo_monedas} monedas` : ""].filter(Boolean).join(" y ");
      return `<div class="admin-cambio${en ? "" : " revertido"}"><div class="admin-cambio-top"><span>${esc(fecha(e.desde))} → ${esc(fecha(e.hasta))}</span><span>${en ? "en marcha" : futuro ? "programado" : "terminado"}</span><span>${e.side ? `Side ${esc(e.side)}` : "todos"}</span></div>
        <div class="admin-cambio-que"><b>${esc(e.titulo)}</b>${e.texto ? `: ${esc(e.texto)}` : ""}${e.enlace ? ` <small>(enlaza a ${esc(e.enlace)})</small>` : ""}${regalo ? `<br><small>Regala ${esc(regalo)}. Reclamado por ${cuenta[e.id] || 0} jugador${(cuenta[e.id] || 0) === 1 ? "" : "es"}.</small>` : ""}</div>
        <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-quitar-evento="${esc(e.id)}">Quitar</button></div>`;
    }).join("") : `<p class="admin-vacio">Todavía no hay eventos.</p>`;
  }

  async function regalarCarta() {
    const id = resolverCarta($("adminRegaloCarta").value);
    if (!id) { estado("No encuentro esa carta: elige una de la lista.", true); return; }
    const para = $("adminRegaloCartaPara").value;
    if (!confirm(`¿Regalar «${nombreCarta.get(id)}» ${textoDestino(para)}?`)) return;
    estado("Regalando...");
    try {
      const { data, error } = await (await cliente()).rpc("admin_regalar_carta", Object.assign({ p_carta: id }, destino(para)));
      if (error) throw error;
      const omitidas = data.omitidas || [];
      $("adminRegaloCartaResultado").innerHTML = `<p><b>${data.entregadas}</b> entrega${data.entregadas === 1 ? "" : "s"} de «${esc(nombreCarta.get(id))}».</p>`
        + (omitidas.length ? `<p>No se pudo a ${omitidas.length}:</p><ul>${omitidas.map(o => `<li>${esc(o.nombre)}: ${esc(String(o.motivo || "").replace(/^ERROR:\s*/, ""))}</li>`).join("")}</ul>` : "");
      estado("");
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }
  async function regalarMonedas() {
    const monto = Math.round(Number($("adminRegaloMonto").value));
    if (!(monto >= 1 && monto <= 100000)) { estado("El monto va de 1 a 100000.", true); return; }
    const para = $("adminRegaloMonedasPara").value;
    if (!confirm(`¿Regalar ${monto} monedas del Hipódromo ${textoDestino(para)}?`)) return;
    try {
      const { data, error } = await (await cliente()).rpc("admin_regalar_monedas", Object.assign({ p_monto: monto, p_motivo: $("adminRegaloMotivo").value.trim() }, destino(para)));
      if (error) throw error;
      estado(`Listo: ${data.entregadas} billetera${data.entregadas === 1 ? "" : "s"} con +${monto}.`);
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }
  async function crearEvento() {
    const carta = $("adminEventoCarta").value.trim() ? resolverCarta($("adminEventoCarta").value) : null;
    if ($("adminEventoCarta").value.trim() && !carta) { estado("No encuentro la carta del regalo: elige una de la lista.", true); return; }
    const p = { titulo: $("adminEventoTitulo").value.trim(), texto: $("adminEventoTexto").value.trim(), enlace: $("adminEventoPagina").value, side: $("adminEventoSide").value,
      desde: deLocal($("adminEventoDesde").value), hasta: deLocal($("adminEventoHasta").value), regalo_carta: carta || "", regalo_monedas: $("adminEventoMonedas").value ? Math.round(Number($("adminEventoMonedas").value)) : "" };
    if (!p.titulo) { estado("Ponle un título al evento.", true); return; }
    if (!p.hasta || new Date(p.hasta) <= new Date(p.desde || Date.now())) { estado("La fecha de fin tiene que ser posterior a la de inicio.", true); return; }
    try {
      const { error } = await (await cliente()).rpc("evento_guardar", { p });
      if (error) throw error;
      $("adminEventoTitulo").value = ""; $("adminEventoTexto").value = ""; $("adminEventoCarta").value = ""; $("adminEventoMonedas").value = "";
      await pintarEventos(); estado("Evento creado. Sale en la taberna desde su fecha de inicio.");
    } catch (e) { estado(`No se pudo crear: ${e.message || e}`, true); }
  }

  async function abrir() {
    if (listo) return; listo = true;
    estado("Cargando...");
    try { await cargarBase(); pintarFormularios(); await pintarEventos(); estado(""); }
    catch (e) { listo = false; estado(/eventos_sitio|relation|does not exist|schema cache/i.test(e.message || "") ? "Falta correr docs/admin/regalos_eventos.sql en Supabase." : `No se pudo cargar: ${e.message || e}`, true); }
  }
  document.querySelector('[data-tab="regalos"]').addEventListener("click", abrir);
  $("adminRegaloCartaBoton").addEventListener("click", regalarCarta);
  $("adminRegaloMonedasBoton").addEventListener("click", regalarMonedas);
  $("adminEventoCrear").addEventListener("click", crearEvento);
  $("adminEventosLista").addEventListener("click", async ev => {
    const b = ev.target.closest("[data-quitar-evento]"); if (!b || !confirm("¿Quitar este evento? Se borran también los reclamos.")) return;
    try { const { error } = await (await cliente()).rpc("evento_quitar", { p_id: b.dataset.quitarEvento }); if (error) throw error; await pintarEventos(); }
    catch (e) { estado(`No se pudo quitar: ${e.message || e}`, true); }
  });
})();
