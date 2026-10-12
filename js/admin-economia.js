/* Admin > Economía de cartas: límites global y por jugador de cada carta, auditoría y movimientos.
   Requiere scratchpad/economia_1_nucleo.sql. Ver docs/economia-de-cartas.md. */
(function () {
  const cont = document.getElementById("adminEconomia");
  if (!cont) return;

  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RAREZAS = { comun: "Común", infrecuente: "Poco común", rara: "Rara", legendaria: "Legendaria", limitada: "Limitada" };
  const TIPOS_MOV = {
    emision: "Emisión", entrega_reserva: "Entrega desde la reserva", transferencia: "Transferencia", retirada_reserva: "A la reserva",
    retirada_destruida: "Destruida", retirada_mercader: "Al mercader", bloqueo: "Bloqueo", desbloqueo: "Desbloqueo", ajuste: "Ajuste"
  };

  let filas = [];
  const pendientes = new Map();      // id -> { limite?, limite_jugador? }
  const seleccion = new Set();
  let filtro = { texto: "", tipo: "", rareza: "", soloPendientes: false, soloSinLimite: false };
  let vista = "limites";

  async function rpc(nombre, args) {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  function estado(t, error) {
    const e = cont.querySelector(".eco-estado");
    if (!e) return;
    e.textContent = t || "";
    e.classList.toggle("eco-error", !!error);
  }

  /* ---------------- armazón ---------------- */
  function pintarMarco() {
    cont.innerHTML = `
      <div class="eco-vistas" role="tablist">
        <button type="button" data-vista="limites" class="${vista === "limites" ? "activo" : ""}">Límites</button>
        <button type="button" data-vista="auditoria" class="${vista === "auditoria" ? "activo" : ""}">Auditoría</button>
        <button type="button" data-vista="historial" class="${vista === "historial" ? "activo" : ""}">Movimientos</button>
      </div>
      <p class="eco-estado" role="status"></p>
      <div id="ecoCuerpo"></div>`;
    cont.querySelector(".eco-vistas").addEventListener("click", ev => {
      const b = ev.target.closest("[data-vista]");
      if (!b) return;
      vista = b.dataset.vista;
      pintarMarco();
      pintarVista();
    });
  }

  function pintarVista() {
    if (vista === "limites") pintarLimites();
    else if (vista === "auditoria") pintarAuditoria();
    else pintarHistorial();
  }

  /* ---------------- límites ---------------- */
  async function cargar() {
    estado("Cargando...");
    try {
      filas = await rpc("cartas_admin_limites");
      estado("");
      const sin = filas.filter(f => f.limite === null).length;
      const badge = document.getElementById("adminEconomiaCount");
      if (badge) badge.textContent = sin ? String(sin) : "";
      pintarLimites();
    } catch (e) {
      estado(`No se pudo cargar: ${e.message || e}. ¿Corriste scratchpad/economia_1_nucleo.sql en Supabase?`, true);
    }
  }

  const valorPend = (f, campo) => (pendientes.has(f.id) && campo in pendientes.get(f.id) ? pendientes.get(f.id)[campo] : f[campo]);

  function filasVisibles() {
    const t = filtro.texto.trim().toLowerCase();
    return filas.filter(f =>
      (!t || f.nombre.toLowerCase().includes(t) || f.id.includes(t)) &&
      (!filtro.tipo || f.tipo === filtro.tipo) &&
      (!filtro.rareza || f.rareza === filtro.rareza) &&
      (!filtro.soloPendientes || pendientes.has(f.id)) &&
      (!filtro.soloSinLimite || valorPend(f, "limite") === null));
  }

  function pintarLimites() {
    const cuerpo = document.getElementById("ecoCuerpo");
    if (!cuerpo) return;
    const tipos = [...new Set(filas.map(f => f.tipo))].sort();
    const total = filas.reduce((s, f) => s + (f.limite || 0), 0);
    const emitidas = filas.reduce((s, f) => s + f.emitidas, 0);
    cuerpo.innerHTML = `
      <div class="eco-ayuda">
        <p><b>Límite global</b>: cuántas copias de esa carta pueden existir en toda la página. Cuenta lo emitido alguna vez; una copia destruida no libera hueco, y una que vuelve al mercado queda en la reserva y se reparte antes de emitir una nueva. Una carta <b>sin definir</b> no sale por recompensa, solo la puedes dar tú.</p>
        <p><b>Límite por jugador</b>: cuántas copias puede tener cada jugador. Si lo dejas vacío usa el que corresponde al tipo (3 personajes, 10 el resto, 1 legendarias y limitadas). Nunca supera al global.</p>
        <p>No se puede bajar el global por debajo de lo ya emitido. Bajar el de por jugador no quita nada a nadie: solo impide recibir más.</p>
      </div>
      <div class="eco-resumen">${filas.length} cartas · ${emitidas} copias emitidas de ${total} posibles · ${filas.filter(f => f.limite === null).length} sin límite global</div>
      <div class="eco-filtros">
        <input type="search" id="ecoTexto" placeholder="Buscar carta..." aria-label="Buscar carta" value="${esc(filtro.texto)}">
        <select id="ecoTipo" aria-label="Tipo"><option value="">Todos los tipos</option>${tipos.map(t => `<option${filtro.tipo === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select id="ecoRareza" aria-label="Rareza"><option value="">Todas las rarezas</option>${Object.entries(RAREZAS).map(([k, v]) => `<option value="${k}"${filtro.rareza === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <label><input type="checkbox" id="ecoSoloSin"${filtro.soloSinLimite ? " checked" : ""}> Solo sin límite global</label>
        <label><input type="checkbox" id="ecoSoloPend"${filtro.soloPendientes ? " checked" : ""}> Solo cambiadas</label>
      </div>
      <div class="eco-lote">
        <span>Con las seleccionadas (<b id="ecoSelN">${seleccion.size}</b>):</span>
        <label>Global <input type="number" id="ecoLoteGlobal" min="1" max="999" placeholder="sin cambio"></label>
        <label>Por jugador <input type="number" id="ecoLoteJugador" min="1" max="99" placeholder="sin cambio"></label>
        <button type="button" id="ecoLoteAplicar">Aplicar a la selección</button>
      </div>
      <div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr>
        <th><input type="checkbox" id="ecoTodas" aria-label="Seleccionar las visibles"></th>
        <th>Carta</th><th>Emitidas</th><th>Límite global</th><th>Límite por jugador</th>
        <th title="Sin dueño, se reparte antes de emitir">Reserva</th><th>Con jugadores</th><th>Bloqueadas</th><th>Destruidas</th><th title="Copias por mazo (se cambia en el editor de cartas)">Por mazo</th>
      </tr></thead><tbody id="ecoFilas"></tbody></table></div>
      <div class="eco-guardar">
        <button type="button" id="ecoGuardar" class="admin-cuenta-accion" ${pendientes.size ? "" : "disabled"}>Guardar cambios (${pendientes.size})</button>
        <button type="button" id="ecoDescartar" class="admin-cuenta-accion" ${pendientes.size ? "" : "disabled"}>Descartar</button>
        <button type="button" id="ecoRecargar" class="admin-cuenta-accion">Recargar</button>
      </div>`;
    pintarFilas();
    enlazarLimites();
  }

  function pintarFilas() {
    const visibles = filasVisibles();
    document.getElementById("ecoFilas").innerHTML = visibles.map(f => {
      const g = valorPend(f, "limite"), j = valorPend(f, "limite_jugador");
      const cambiado = pendientes.has(f.id);
      const bajo = g !== null && g !== "" && g < f.emitidas;
      return `<tr data-id="${esc(f.id)}" class="${cambiado ? "eco-cambiada" : ""}${f.publicada ? "" : " eco-borrador"}">
        <td><input type="checkbox" data-sel${seleccion.has(f.id) ? " checked" : ""} aria-label="Seleccionar ${esc(f.nombre)}"></td>
        <td><b>${esc(f.nombre)}</b><small>${esc(f.tipo)} · ${esc(RAREZAS[f.rareza] || f.rareza)}${f.publicada ? "" : " · borrador"}${f.obtenible ? "" : " · no se gana"}</small></td>
        <td>${f.emitidas}</td>
        <td><input type="number" data-campo="limite" min="${Math.max(1, f.emitidas)}" max="999" value="${g ?? ""}" placeholder="sin definir" class="${g === null ? "eco-sin" : ""}${bajo ? " eco-mal" : ""}" aria-label="Límite global de ${esc(f.nombre)}"></td>
        <td><input type="number" data-campo="limite_jugador" min="1" max="99" value="${j ?? ""}" placeholder="${f.limite_jugador_efectivo}" aria-label="Límite por jugador de ${esc(f.nombre)}"></td>
        <td>${f.reserva || ""}</td><td>${f.poseidas || ""}</td><td>${f.bloqueadas || ""}</td><td>${f.destruidas || ""}</td><td>${f.copias_max ?? ""}</td></tr>`;
    }).join("") || `<tr><td colspan="10" class="eco-vacia">Ninguna carta coincide.</td></tr>`;
    const todas = document.getElementById("ecoTodas");
    if (todas) todas.checked = visibles.length > 0 && visibles.every(f => seleccion.has(f.id));
    const n = document.getElementById("ecoSelN");
    if (n) n.textContent = String(seleccion.size);
  }

  function apuntar(id, campo, valor) {
    const f = filas.find(x => x.id === id);
    const actual = pendientes.get(id) || {};
    if (valor === f[campo]) delete actual[campo]; else actual[campo] = valor;
    if (Object.keys(actual).length) pendientes.set(id, actual); else pendientes.delete(id);
  }

  function refrescarGuardar() {
    const g = document.getElementById("ecoGuardar"), d = document.getElementById("ecoDescartar");
    if (g) { g.disabled = !pendientes.size; g.textContent = `Guardar cambios (${pendientes.size})`; }
    if (d) d.disabled = !pendientes.size;
  }

  function enlazarLimites() {
    const filtrar = () => { filtro.texto = document.getElementById("ecoTexto").value; filtro.tipo = document.getElementById("ecoTipo").value;
      filtro.rareza = document.getElementById("ecoRareza").value; filtro.soloSinLimite = document.getElementById("ecoSoloSin").checked;
      filtro.soloPendientes = document.getElementById("ecoSoloPend").checked; pintarFilas(); };
    ["ecoTexto", "ecoTipo", "ecoRareza", "ecoSoloSin", "ecoSoloPend"].forEach(id => document.getElementById(id).addEventListener("input", filtrar));
    const tbody = document.getElementById("ecoFilas");
    tbody.addEventListener("change", ev => {
      const tr = ev.target.closest("tr[data-id]");
      if (!tr) return;
      const id = tr.dataset.id;
      if (ev.target.matches("[data-sel]")) { if (ev.target.checked) seleccion.add(id); else seleccion.delete(id); document.getElementById("ecoSelN").textContent = String(seleccion.size); return; }
      const campo = ev.target.dataset.campo;
      if (!campo) return;
      apuntar(id, campo, ev.target.value === "" ? null : Math.round(Number(ev.target.value)));
      tr.classList.toggle("eco-cambiada", pendientes.has(id));
      refrescarGuardar();
      pintarFilas();
    });
    document.getElementById("ecoTodas").addEventListener("change", ev => {
      filasVisibles().forEach(f => { if (ev.target.checked) seleccion.add(f.id); else seleccion.delete(f.id); });
      pintarFilas();
    });
    document.getElementById("ecoLoteAplicar").addEventListener("click", () => {
      const g = document.getElementById("ecoLoteGlobal").value, j = document.getElementById("ecoLoteJugador").value;
      if (!seleccion.size) { estado("Selecciona alguna carta primero.", true); return; }
      if (g === "" && j === "") { estado("Escribe el límite global, el de por jugador o los dos.", true); return; }
      filas.filter(f => seleccion.has(f.id)).forEach(f => {
        if (g !== "") apuntar(f.id, "limite", Math.max(f.emitidas, Math.round(Number(g))));
        if (j !== "") apuntar(f.id, "limite_jugador", Math.round(Number(j)));
      });
      estado(g !== "" ? "Los límites globales por debajo de lo ya emitido se subieron a lo emitido." : "");
      pintarLimites();
    });
    document.getElementById("ecoDescartar").addEventListener("click", () => { pendientes.clear(); pintarLimites(); });
    document.getElementById("ecoRecargar").addEventListener("click", cargar);
    document.getElementById("ecoGuardar").addEventListener("click", guardar);
  }

  async function guardar() {
    const cambios = [...pendientes.entries()].map(([id, c]) => Object.assign({ id }, c));
    if (!cambios.length) return;
    const bajo = cambios.find(c => c.limite !== undefined && c.limite !== null && c.limite < filas.find(f => f.id === c.id).emitidas);
    if (bajo) {
      const f = filas.find(x => x.id === bajo.id);
      estado(`${f.nombre}: ya se emitieron ${f.emitidas} copias, el límite global no puede ser menor.`, true);
      return;
    }
    estado("Guardando...");
    try {
      const n = await rpc("cartas_admin_guardar_limites", { p_cambios: cambios });
      pendientes.clear();
      await cargar();
      estado(`Guardado: ${n} cambio${n === 1 ? "" : "s"}.`);
    } catch (e) {
      estado(`No se pudo guardar: ${e.message || e}`, true);
    }
  }

  /* ---------------- auditoría ---------------- */
  async function pintarAuditoria() {
    const cuerpo = document.getElementById("ecoCuerpo");
    cuerpo.innerHTML = `<p class="eco-ayuda">Comprueba que todo cuadra: que la numeración no tenga huecos, que no se pase ningún límite, que la colección de cada jugador coincida con sus copias y que no haya bloqueos sueltos.</p>
      <button type="button" id="ecoAudi" class="admin-cuenta-accion">Comprobar ahora</button><div id="ecoAudiRes"></div>`;
    document.getElementById("ecoAudi").addEventListener("click", async () => {
      const res = document.getElementById("ecoAudiRes");
      res.textContent = "Comprobando...";
      try {
        const problemas = await rpc("cartas_auditoria");
        const nombre = id => (filas.find(f => f.id === id) || { nombre: id }).nombre;
        res.innerHTML = problemas.length
          ? `<ul class="eco-problemas">${problemas.map(p => `<li><b>${esc(nombre(p.carta_id))}</b> ${esc(p.problema)}<small>${esc(p.detalle)}</small></li>`).join("")}</ul>`
          : `<p class="eco-ok">Todo cuadra.</p>`;
      } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo: ${esc(e.message || e)}</p>`; }
    });
  }

  /* ---------------- movimientos ---------------- */
  async function pintarHistorial() {
    const cuerpo = document.getElementById("ecoCuerpo");
    let perfiles = [];
    try { perfiles = typeof adminListarPerfiles === "function" ? await adminListarPerfiles() : []; } catch (e) { perfiles = []; }
    cuerpo.innerHTML = `<div class="eco-filtros">
        <label>Carta <select id="ecoHCarta"><option value="">Todas</option>${filas.map(f => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join("")}</select></label>
        <label>Jugador <select id="ecoHJugador"><option value="">Todos</option>${perfiles.map(p => `<option value="${esc(p.id)}">${esc(p.username || "(sin nombre)")}</option>`).join("")}</select></label>
        <button type="button" id="ecoHVer" class="admin-cuenta-accion">Ver movimientos</button>
      </div><div id="ecoHRes"></div>`;
    const ver = async () => {
      const res = document.getElementById("ecoHRes");
      res.textContent = "Cargando...";
      try {
        const datos = await rpc("cartas_admin_historial", { p_carta: document.getElementById("ecoHCarta").value || null, p_usuario: document.getElementById("ecoHJugador").value || null, p_limite: 200 });
        const nombre = id => (filas.find(f => f.id === id) || { nombre: id }).nombre;
        res.innerHTML = datos.length ? `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Cuándo</th><th>Carta</th><th>Qué</th><th>De</th><th>A</th><th>Motivo</th></tr></thead><tbody>${
          datos.map(m => `<tr><td>${new Date(m.creado).toLocaleString("es")}</td><td>${esc(nombre(m.carta_id))} #${m.numero}</td><td>${esc(TIPOS_MOV[m.tipo] || m.tipo)}</td><td>${esc(m.nombre_de || "")}</td><td>${esc(m.nombre_a || "")}</td><td>${esc(m.motivo)}${m.referencia ? ` <small>${esc(m.referencia)}</small>` : ""}</td></tr>`).join("")
        }</tbody></table></div>` : `<p class="eco-vacia">Sin movimientos.</p>`;
      } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo: ${esc(e.message || e)}</p>`; }
    };
    document.getElementById("ecoHVer").addEventListener("click", ver);
    ver();
  }

  /* ---------------- arranque ---------------- */
  let iniciado = false;
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    pintarMarco();
    cargar();
  }
  // Se carga al abrir la pestaña (no antes: así el panel no consulta nada si no lo miras)
  const tab = document.querySelector('[data-tab="economia"]');
  if (tab) tab.addEventListener("click", iniciar);
  window.AdminEconomia = { iniciar };
})();
