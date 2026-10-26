/* =============================================================================
   PESTAÑA «CRÓNICA» (panel de Admin), SQL en docs/cronica-1_base.sql y docs/cronica-2_disparadores.sql
   1) Escribir una noticia: sale en la pestaña Crónica del Tablón de la taberna, a los dos Sides o solo a uno, con enlace opcional.
   2) Tipos: encender o apagar cada tipo de suceso y cambiar sus umbrales (por ejemplo «ratio» y «min_pago» de las apuestas grandes) sin tocar código.
   3) Revisar lo anotado: también lo oculto, lo que aún no se enseña y quién fue en los tipos anónimos (intercambios y crías). Se puede ocultar cualquiera.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelCronica");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAGINAS = [["", "(sin enlace)"], ["compendio.html", "Compendio"], ["mapa.html", "Mapa"], ["cronologia.html", "Cronología"], ["personajes.html", "Personajes"], ["lugares.html", "Lugares"],
    ["facciones.html", "Facciones"], ["cartas.html", "Triunfos"], ["intercambios.html", "Intercambios"], ["hipodromo.html", "Hipódromo"], ["veintiuna.html", "Las Veintiuna Velas"], ["minijuegos.html", "Minijuegos"]];
  const NOMBRES = { carta_ganada: "Carta ganada", intercambio: "Intercambio", cria_nacida: "Cría nacida", apuesta_hipodromo: "Apuesta grande (Hipódromo)", apuesta_veintiuna: "Apuesta grande (Veintiuna)",
    racha_veintiuna: "Racha de Veintiuna", logro_oro_veintiuna: "Desafío de oro de Veintiuna", ultima_vela: "La Última Vela", record_hooey: "Récord de Hooey", record_ritmo: "Récord de Zarabanda", record_parranda: "Récord de Parranda", record_minijuego: "Líder de Ajedrez o Arquería", copa_hipodromo: "Copa del Hipódromo", partida_dificil: "Partida difícil", nota: "Noticia del Admin" };

  let listo = false;
  const cliente = () => fichasCliente();
  const estado = (t, error) => { const e = $("adminCronicaEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };
  const fecha = iso => new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const falta = e => /cronica_|relation|does not exist|schema cache|Could not find/i.test((e && e.message) || "");

  async function pintarTipos() {
    const { data, error } = await (await cliente()).rpc("cronica_admin_tipos");
    if (error) throw error;
    $("adminCronicaTipos").innerHTML = (data || []).map(t => `
      <div class="admin-cronica-tipo" data-tipo="${esc(t.tipo)}">
        <label class="admin-cronica-titulo"><input type="checkbox" data-activo ${t.activo ? "checked" : ""}> <strong>${esc(NOMBRES[t.tipo] || t.tipo)}</strong> <small>(${esc(t.juego)} · ${t.total} anotados)</small></label>
        <p class="admin-cronica-desc">${esc(t.descripcion)}</p>
        <label>Umbrales (JSON) <input type="text" data-config value="${esc(JSON.stringify(t.config))}" spellcheck="false"></label>
        <button type="button" class="admin-cuenta-accion" data-guardar>Guardar</button>
      </div>`).join("") || `<p class="admin-vacio">No hay tipos.</p>`;
  }
  async function pintarSucesos() {
    const { data, error } = await (await cliente()).rpc("cronica_admin_ver", { p_limite: 60 });
    if (error) throw error;
    const filas = (data || []).map(s => {
      const l = window.Cronica && Cronica.linea(Object.assign({}, s, { user: s.user, yo: false }));
      const quien = [s.user, s.otro].filter(Boolean).join(" y ");
      const futuro = Date.parse(s.visible_desde) > Date.now();
      return `<tr class="${s.oculto ? "admin-cronica-oculto" : ""}">
        <td>${esc(fecha(s.actualizado))}</td>
        <td>${esc(NOMBRES[s.tipo] || s.tipo)}${s.anonimo ? ` <small title="Los jugadores no ven quién fue">(anónimo)</small>` : ""}</td>
        <td>${esc(l ? l.texto : JSON.stringify(s.datos))}${s.side ? ` <small>· Side ${esc(s.side)}</small>` : ""}${futuro ? ` <small>· se enseña ${esc(fecha(s.visible_desde))}</small>` : ""}</td>
        <td>${esc(quien)}</td>
        <td><button type="button" class="admin-cuenta-accion" data-ocultar="${s.id}" data-a="${s.oculto ? "0" : "1"}">${s.oculto ? "Mostrar" : "Ocultar"}</button></td></tr>`;
    }).join("");
    $("adminCronicaLista").innerHTML = filas ? `<table class="admin-cronica-tabla"><thead><tr><th>Cuándo</th><th>Tipo</th><th>Qué dice</th><th>Quién</th><th></th></tr></thead><tbody>${filas}</tbody></table>`
      : `<p class="admin-vacio">Todavía no se ha anotado nada.</p>`;
  }
  async function publicar() {
    const texto = $("adminCronicaTexto").value.trim();
    if (!texto) { estado("Escribe la noticia.", true); return; }
    try {
      const { error } = await (await cliente()).rpc("cronica_publicar", { p_texto: texto, p_side: $("adminCronicaSide").value || null, p_enlace: $("adminCronicaPagina").value || null });
      if (error) throw error;
      $("adminCronicaTexto").value = "";
      await pintarSucesos(); estado("Publicada. Sale en la pestaña Crónica del Tablón.");
    } catch (e) { estado(`No se pudo publicar: ${e.message || e}`, true); }
  }
  async function guardarTipo(caja) {
    let config;
    try { config = JSON.parse(caja.querySelector("[data-config]").value || "{}"); } catch (e) { estado("Los umbrales no son un JSON válido (por ejemplo {\"ratio\": 4, \"min_pago\": 200}).", true); return; }
    try {
      const { error } = await (await cliente()).rpc("cronica_tipo_guardar", { p_tipo: caja.dataset.tipo, p_activo: caja.querySelector("[data-activo]").checked, p_config: config });
      if (error) throw error;
      estado("Guardado. Vale para los sucesos que se anoten desde ahora.");
    } catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
  }

  async function abrir() {
    if (listo) return; listo = true;
    estado("Cargando...");
    $("adminCronicaPagina").innerHTML = PAGINAS.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("");
    try { await Promise.all([pintarTipos(), pintarSucesos()]); estado(""); }
    catch (e) { listo = false; estado(falta(e) ? "Falta correr docs/cronica-1_base.sql y docs/cronica-2_disparadores.sql en Supabase." : `No se pudo cargar: ${e.message || e}`, true); }
  }
  document.querySelector('[data-tab="cronica"]').addEventListener("click", abrir);
  $("adminCronicaPublicar").addEventListener("click", publicar);
  $("adminCronicaTipos").addEventListener("click", ev => { const b = ev.target.closest("[data-guardar]"); if (b) guardarTipo(b.closest("[data-tipo]")); });
  $("adminCronicaLista").addEventListener("click", async ev => {
    const b = ev.target.closest("[data-ocultar]"); if (!b) return;
    try { const { error } = await (await cliente()).rpc("cronica_ocultar", { p_id: Number(b.dataset.ocultar), p_oculto: b.dataset.a === "1" }); if (error) throw error; await pintarSucesos(); }
    catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  });
})();
