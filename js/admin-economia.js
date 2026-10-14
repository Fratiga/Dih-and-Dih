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
  let filtro = { texto: "", tipo: "", rareza: "", soloPendientes: false, soloSinLimite: false, soloFuera: false };
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
        <button type="button" data-vista="apuestas" class="${vista === "apuestas" ? "activo" : ""}">Apuestas y disputas</button>
        <button type="button" data-vista="bloqueos" class="${vista === "bloqueos" ? "activo" : ""}">Bloqueos e incidencias</button>
        <button type="button" data-vista="juegos" class="${vista === "juegos" ? "activo" : ""}">Juegos y recetas</button>
        <button type="button" data-vista="crianza" class="${vista === "crianza" ? "activo" : ""}">Crianza</button>
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
    else if (vista === "apuestas") pintarApuestas();
    else if (vista === "bloqueos") pintarBloqueos();
    else if (vista === "juegos") pintarJuegos();
    else if (vista === "crianza") pintarCrianza();
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

  // La etiqueta solo existe si el servidor ya tiene economia-11 (si no, la columna no se enseña)
  const conCirc = () => filas.length > 0 && "en_circulacion" in filas[0];
  const valorPend = (f, campo) => (pendientes.has(f.id) && campo in pendientes.get(f.id) ? pendientes.get(f.id)[campo] : f[campo]);

  function filasVisibles() {
    const t = filtro.texto.trim().toLowerCase();
    return filas.filter(f =>
      (!t || f.nombre.toLowerCase().includes(t) || f.id.includes(t)) &&
      (!filtro.tipo || f.tipo === filtro.tipo) &&
      (!filtro.rareza || f.rareza === filtro.rareza) &&
      (!filtro.soloPendientes || pendientes.has(f.id)) &&
      (!filtro.soloSinLimite || valorPend(f, "limite") === null) &&
      (!filtro.soloFuera || valorPend(f, "en_circulacion") === false));
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
      <div class="eco-resumen">${filas.length} cartas · ${emitidas} copias emitidas de ${total} posibles · ${filas.filter(f => f.limite === null).length} sin límite global${conCirc() ? ` · ${filas.filter(f => valorPend(f, "en_circulacion")).length} en circulación` : ""}</div>
      ${conCirc() ? `<div class="eco-ayuda"><p><b>En circulación</b>: una carta que no lo está no sale por ninguna vía automática (recompensas, forja, reserva, escaparate del mercader), aunque esté publicada y sea ganable. Tú sí puedes regalarla a mano. Quitarla de circulación no quita copias a nadie. Las cartas nuevas nacen fuera de circulación.</p></div>` : ""}
      <div class="eco-filtros">
        <input type="search" id="ecoTexto" placeholder="Buscar carta..." aria-label="Buscar carta" value="${esc(filtro.texto)}">
        <select id="ecoTipo" aria-label="Tipo"><option value="">Todos los tipos</option>${tipos.map(t => `<option${filtro.tipo === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select id="ecoRareza" aria-label="Rareza"><option value="">Todas las rarezas</option>${Object.entries(RAREZAS).map(([k, v]) => `<option value="${k}"${filtro.rareza === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <label><input type="checkbox" id="ecoSoloSin"${filtro.soloSinLimite ? " checked" : ""}> Solo sin límite global</label>
        ${conCirc() ? `<label><input type="checkbox" id="ecoSoloFuera"${filtro.soloFuera ? " checked" : ""}> Solo fuera de circulación</label>` : ""}
        <label><input type="checkbox" id="ecoSoloPend"${filtro.soloPendientes ? " checked" : ""}> Solo cambiadas</label>
      </div>
      <div class="eco-lote">
        <span>Con las seleccionadas (<b id="ecoSelN">${seleccion.size}</b>):</span>
        <label>Global <input type="number" id="ecoLoteGlobal" min="1" max="999" placeholder="sin cambio"></label>
        <label>Por jugador <input type="number" id="ecoLoteJugador" min="1" max="99" placeholder="sin cambio"></label>
        <button type="button" id="ecoLoteAplicar">Aplicar a la selección</button>
        ${conCirc() ? `<button type="button" id="ecoLoteEntra">Poner en circulación</button><button type="button" id="ecoLoteSale">Sacar de circulación</button>` : ""}
      </div>
      <div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr>
        <th><input type="checkbox" id="ecoTodas" aria-label="Seleccionar las visibles"></th>
        <th>Carta</th><th>Emitidas</th><th>Límite global</th><th>Límite por jugador</th>${conCirc() ? `<th title="Sin esta marca la carta no sale por recompensas, forja ni mercader">En circulación</th>` : ""}
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
        ${conCirc() ? `<td><input type="checkbox" data-campo="en_circulacion"${valorPend(f, "en_circulacion") ? " checked" : ""} aria-label="En circulación: ${esc(f.nombre)}"></td>` : ""}
        <td>${f.reserva || ""}</td><td>${f.poseidas || ""}</td><td>${f.bloqueadas || ""}</td><td>${f.destruidas || ""}</td><td>${f.copias_max ?? ""}</td></tr>`;
    }).join("") || `<tr><td colspan="11" class="eco-vacia">Ninguna carta coincide.</td></tr>`;
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
      filtro.soloPendientes = document.getElementById("ecoSoloPend").checked;
      const fuera = document.getElementById("ecoSoloFuera"); filtro.soloFuera = !!(fuera && fuera.checked); pintarFilas(); };
    ["ecoTexto", "ecoTipo", "ecoRareza", "ecoSoloSin", "ecoSoloPend", "ecoSoloFuera"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("input", filtrar); });
    const tbody = document.getElementById("ecoFilas");
    tbody.addEventListener("change", ev => {
      const tr = ev.target.closest("tr[data-id]");
      if (!tr) return;
      const id = tr.dataset.id;
      if (ev.target.matches("[data-sel]")) { if (ev.target.checked) seleccion.add(id); else seleccion.delete(id); document.getElementById("ecoSelN").textContent = String(seleccion.size); return; }
      const campo = ev.target.dataset.campo;
      if (!campo) return;
      apuntar(id, campo, ev.target.type === "checkbox" ? ev.target.checked : ev.target.value === "" ? null : Math.round(Number(ev.target.value)));
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
    const circLote = valor => () => {
      if (!seleccion.size) { estado("Selecciona alguna carta primero.", true); return; }
      filas.filter(f => seleccion.has(f.id)).forEach(f => apuntar(f.id, "en_circulacion", valor));
      estado(valor ? "Marcadas en circulación. Falta guardar." : "Marcadas fuera de circulación. Falta guardar.");
      pintarLimites();
    };
    const entra = document.getElementById("ecoLoteEntra"), sale = document.getElementById("ecoLoteSale");
    if (entra) entra.addEventListener("click", circLote(true));
    if (sale) sale.addEventListener("click", circLote(false));
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

  /* ---------------- apuestas y disputas ---------------- */
  const fecha = t => (t ? new Date(t).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "");
  const cartasTxt = info => (info || []).map(c => `${esc(c.nombre)} #${c.numero}`).join(", ") || "—";
  const SITUACION = {
    disputa: ["Disputa", "Los dos avisaron resultados distintos. Se resuelve con el registro de la partida o la decides tú; si nadie la resuelve se cierra sola sin ganador y se devuelven las apuestas."],
    un_aviso: ["Un solo aviso", "El otro no ha confirmado. Si sigue así, la apuesta se devuelve sola (sin ganador)."],
    sin_avisos: ["Sin avisos", "Nadie ha avisado ni se ha movido nada. Se devuelve sola pasado el plazo."],
    sin_respuesta: ["Reto sin respuesta", "Caduca solo y devuelve la apuesta."],
    otra: ["Cerrada", "Resuelta o devuelta hace poco."]
  };
  const REPORTE = (p, n) => ({ j1: `gana ${p.nombre1}`, j2: `gana ${p.nombre2}`, empate: "empate" }[n === 1 ? p.reporte1 : p.reporte2] || "sin avisar");

  async function pintarApuestas() {
    const cuerpo = document.getElementById("ecoCuerpo");
    cuerpo.innerHTML = `<p class="eco-ayuda">Aquí ves las partidas con apuesta que necesitan atención. Un jugador que avisa un resultado y no es confirmado en el plazo no gana nada: la apuesta se devuelve. Las disputas las resuelves tú con el botón del resultado que consideres justo; cada carta se mueve una sola vez.</p><div id="ecoApRes">Cargando...</div>`;
    const res = document.getElementById("ecoApRes");
    try {
      const lista = await rpc("cartas_admin_apuestas");
      if (!lista.length) { res.innerHTML = `<p class="eco-ok">No hay apuestas abiertas ni recientes.</p>`; return; }
      res.innerHTML = `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Situación</th><th>Jugadores</th><th>Apuestas</th><th>Avisos</th><th>Fechas</th><th>Resolver</th></tr></thead><tbody>${
        lista.map(p => {
          const [titulo, ayuda] = SITUACION[p.situacion] || SITUACION.otra;
          const abierta = ["disputa", "un_aviso", "sin_avisos", "sin_respuesta"].includes(p.situacion);
          return `<tr data-id="${esc(p.id)}" class="${abierta ? "" : "eco-borrador"}">
            <td><b>${esc(titulo)}</b><small>${esc(ayuda)}</small><small>${esc(p.estado)} / ${esc(p.apuesta_estado || "—")}${p.motivo ? ` / ${esc(p.motivo)}` : ""}${p.resultado ? ` / ${esc(p.resultado)}` : ""}</small></td>
            <td>${esc(p.nombre1)} contra ${esc(p.nombre2)}</td>
            <td>${esc(p.nombre1)}: ${cartasTxt(p.apuesta1_info)}<br>${esc(p.nombre2)}: ${cartasTxt(p.apuesta2_info)}</td>
            <td>${esc(p.nombre1)}: ${esc(REPORTE(p, 1))}<br>${esc(p.nombre2)}: ${esc(REPORTE(p, 2))}</td>
            <td><small>Creada ${esc(fecha(p.creada))}</small>${p.reportado ? `<small>Primer aviso ${esc(fecha(p.reportado))}</small>` : ""}${p.se_devuelve_el && abierta ? `<small>Se devuelve el ${esc(fecha(p.se_devuelve_el))}</small>` : ""}</td>
            <td>${abierta ? `<div class="eco-acciones">
              <button type="button" data-ver="${esc(p.id)}">Qué dice el registro</button>
              <button type="button" data-reg="${esc(p.id)}">Resolver según el registro</button>
              <button type="button" data-res="j1">Gana ${esc(p.nombre1)}</button>
              <button type="button" data-res="j2">Gana ${esc(p.nombre2)}</button>
              <button type="button" data-res="empate">Empate</button>
              <button type="button" data-res="cancelar">Cancelar y devolver</button></div>` : ""}</td></tr>`;
        }).join("")
      }</tbody></table></div>`;
      const verRegistro = async (id, aplicar) => {
        const supabase = await fichasCliente();
        const { data, error } = await supabase.functions.invoke("cartas-verificar", { body: { partida: id, aplicar } });
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
        return data;
      };
      const resumen = (v, p) => {
        const nombre = r => (r === "j1" ? p.nombre1 : r === "j2" ? p.nombre2 : "empate");
        if (v.resultadoServidor && v.resultadoServidor !== "resuelta") return `El servidor no aplicó el resultado (${v.resultadoServidor}). ${v.resultadoServidor === "cambiada" ? "La partida cambió mientras se comprobaba; vuelve a intentarlo." : v.resultadoServidor === "motor" ? "Los jugadores no registraron la misma versión del motor." : v.resultadoServidor === "no-vencido" ? "El plazo de abandono todavía no venció." : "No hacía falta."}`;
        if (v.estado === "terminada") return `Según el registro (${v.acciones} acciones, ${v.ignoradas} ignoradas) la partida terminó: ${v.resultado === "empate" ? "empate" : "gana " + nombre(v.resultado)}.${(v.avisosFalsos || []).length ? " Avisó algo distinto: " + v.avisosFalsos.map(a => a.nombre).join(", ") + "." : ""}`;
        if (v.estado === "abandono") return `Según el registro la partida sigue, pero ${nombre(v.pierde === 0 ? "j1" : "j2")} lleva ${v.horas} h sin actuar: pierde por abandono y gana ${nombre(v.resultado)}.`;
        if (v.estado === "en_juego") return `Según el registro la partida sigue en juego: le toca a ${nombre(v.actua === 0 ? "j1" : "j2")} (${v.horas} h sin movimiento).`;
        if (v.estado === "nada") return v.mensaje;
        if (v.estado === "motor") return v.mensaje;
        return `No se pudo comprobar: ${v.mensaje || v.error || "error"}`;
      };
      res.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", async () => {
        const p = lista.find(x => x.id === b.dataset.ver);
        estado("Repitiendo la partida...");
        try { estado(resumen(await verRegistro(p.id, false), p)); }
        catch (e) { estado(`No se pudo comprobar: ${e.message || e}. ¿Está desplegada la función cartas-verificar?`, true); }
      }));
      res.querySelectorAll("[data-reg]").forEach(b => b.addEventListener("click", async () => {
        const p = lista.find(x => x.id === b.dataset.reg);
        if (!window.confirm("Se repite la partida y se reparten las cartas según lo que diga el registro. No se puede deshacer. ¿Seguro?")) return;
        try {
          const v = await verRegistro(p.id, true);
          estado(v.aplicado ? `Resuelta. ${resumen(v, p)}` : resumen(v, p), !v.aplicado && v.estado !== "en_juego");
          if (v.aplicado) pintarApuestas();
        } catch (e) { estado(`No se pudo resolver: ${e.message || e}`, true); }
      }));
      res.querySelectorAll("[data-res]").forEach(b => b.addEventListener("click", async () => {
        const tr = b.closest("tr");
        const textos = { j1: "ganador al primer jugador (se lleva las cartas del otro)", j2: "ganador al segundo jugador (se lleva las cartas del otro)", empate: "empate (cada carta vuelve a su dueño)", cancelar: "cancelar y devolver todo" };
        if (!window.confirm(`¿Seguro? Vas a dar ${textos[b.dataset.res]}. No se puede deshacer.`)) return;
        try {
          await rpc("cartas_admin_resolver_apuesta", { p_id: tr.dataset.id, p_resultado: b.dataset.res });
          estado("Resuelta.");
          pintarApuestas();
        } catch (e) { estado(`No se pudo resolver: ${e.message || e}`, true); }
      }));
      pintarReputacion(res);
    } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo cargar: ${esc(e.message || e)}</p>`; }
  }
  async function pintarReputacion(res) {
    try {
      const rep = await rpc("cartas_admin_reputacion");
      if (!rep.length) return;
      res.insertAdjacentHTML("beforeend", `<h3>Avisos desmentidos y abandonos</h3><p class="eco-ayuda">Jugadores a los que el registro de la partida contradijo, o que dejaron pasar el plazo sin jugar. Solo informa: no se quita nada por esto.</p>
        <div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Jugador</th><th>Avisos desmentidos</th><th>Abandonos</th><th>Última vez</th></tr></thead><tbody>${
          rep.map(r => `<tr><td><b>${esc(r.nombre)}</b></td><td>${r.avisos_desmentidos}</td><td>${r.abandonos}</td><td>${esc(fecha(r.ultima))}</td></tr>`).join("")
        }</tbody></table></div>`);
    } catch (e) { /* aún sin economia-10: no hay reputación que enseñar */ }
  }

  /* ---------------- bloqueos e incidencias ---------------- */
  async function pintarBloqueos() {
    const cuerpo = document.getElementById("ecoCuerpo");
    cuerpo.innerHTML = `<p class="eco-ayuda">Copias retenidas por una apuesta o un intercambio. Si la operación ya terminó (o no existe) puedes soltarlas desde aquí. Si sigue activa, resuélvela o cancélala desde su pestaña: así las cartas se devuelven una sola vez y queda registro.</p><div id="ecoBlRes">Cargando...</div><h3>Incidencias</h3><label class="eco-linea"><input type="checkbox" id="ecoIncTodas"> Mostrar también las resueltas</label><div id="ecoIncRes"></div>`;
    const pintar = async () => {
      const res = document.getElementById("ecoBlRes");
      try {
        const lista = await rpc("cartas_admin_bloqueos");
        res.innerHTML = lista.length ? `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Operación</th><th>Estado de la operación</th><th>Copias</th><th>Desde</th><th></th></tr></thead><tbody>${
          lista.map(g => `<tr data-ref="${esc(g.referencia)}" class="${g.situacion === "activa" ? "" : "eco-cambiada"}">
            <td><small>${esc(g.referencia)}</small></td>
            <td><b>${esc({ activa: "Activa", cerrada: "Terminada", inexistente: "No existe", desconocida: "Desconocida" }[g.situacion] || g.situacion)}</b></td>
            <td>${g.cartas.map(c => `${esc(nombreCarta(c.carta))} #${c.numero} (${esc(c.nombre || "—")})`).join("<br>")}</td>
            <td>${esc(fecha(g.desde))}</td>
            <td>${g.situacion === "activa" ? "" : `<button type="button" data-soltar>Soltar</button>`}</td></tr>`).join("")
        }</tbody></table></div>` : `<p class="eco-ok">No hay copias bloqueadas.</p>`;
        res.querySelectorAll("[data-soltar]").forEach(b => b.addEventListener("click", async () => {
          const ref = b.closest("tr").dataset.ref;
          const motivo = window.prompt("¿Por qué las sueltas? (queda anotado)", "bloqueo atascado");
          if (!motivo) return;
          try {
            const n = await rpc("cartas_admin_liberar_bloqueos", { p_referencia: ref, p_motivo: motivo });
            estado(`Se soltaron ${n} copia${n === 1 ? "" : "s"}.`);
            pintarBloqueos();
          } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
        }));
      } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo cargar: ${esc(e.message || e)}</p>`; }
    };
    const pintarInc = async () => {
      const res = document.getElementById("ecoIncRes");
      try {
        const lista = await rpc("cartas_admin_incidencias", { p_incluir_resueltas: document.getElementById("ecoIncTodas").checked });
        res.innerHTML = lista.length ? `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Cuándo</th><th>Qué</th><th>Referencia</th><th>Detalle</th><th></th></tr></thead><tbody>${
          lista.map(i => `<tr data-id="${i.id}" class="${i.resuelta ? "eco-borrador" : ""}"><td>${esc(fecha(i.creada))}</td><td>${esc(i.tipo.replace(/_/g, " "))}</td><td><small>${esc(i.referencia)}</small></td><td>${esc(i.detalle)}</td><td>${i.resuelta ? "" : `<button type="button" data-cerrar>Marcar como vista</button>`}</td></tr>`).join("")
        }</tbody></table></div>` : `<p class="eco-ok">Sin incidencias pendientes.</p>`;
        res.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", async () => {
          try { await rpc("cartas_admin_cerrar_incidencia", { p_id: Number(b.closest("tr").dataset.id) }); pintarInc(); } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
        }));
      } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo cargar: ${esc(e.message || e)}</p>`; }
    };
    document.getElementById("ecoIncTodas").addEventListener("change", pintarInc);
    pintar();
    pintarInc();
  }
  const nombreCarta = id => (filas.find(f => f.id === id) || { nombre: id }).nombre;

  /* ---------------- juegos, ajustes y recetas ---------------- */
  let perfilesJuego = [];
  const TRAMOS = [["bueno", "Bueno"], ["excelente", "Excelente"], ["extraordinario", "Extraordinario"]];
  const RAREZAS_JUEGO = [["comun", "Común"], ["infrecuente", "Poco común"], ["rara", "Rara"]];
  const TIPOS_CARTA = ["Personaje", "Criatura", "Objeto", "Terreno", "Reacción", "Acción", "Entidad"];
  const lista = v => Array.isArray(v) ? v : [];

  /* Puntaje que da cada rival (o cada victoria) en este juego: sale de cartas_juegos.valores */
  const campoV = (ruta, valor, ancho) => `<input type="number" data-v="${esc(ruta)}" value="${esc(valor ?? 0)}" step="any" style="width:${ancho || 4.5}em">`;
  function bloqueValores(j) {
    const v = j.valores || {};
    if (j.juego === "hooey") {
      return `<h4>Puntaje por partida</h4><p class="eco-ayuda">Cada sacrificio suma este puntaje, hasta el máximo. Ese puntaje es el que se compara con los umbrales de arriba.</p>
        <div class="eco-filtros"><label>Puntaje por sacrificio ${campoV("por_punto", v.por_punto)}</label><label>Máximo ${campoV("maximo", v.maximo)}</label></div>`;
    }
    if (j.juego === "fractura") {
      return `<h4>Puntaje por victoria</h4><p class="eco-ayuda">Lo que vale una guerra ganada contra la IA (las de jugador contra jugador no dan nada).</p>
        <div class="eco-filtros"><label>Victoria normal ${campoV("normal", v.normal)}</label><label>Con dificultad, núcleo o capital ${campoV("dificil", v.dificil)}</label>
        <label>Primera victoria, leyenda, némesis o tres generaciones ${campoV("especial", v.especial)}</label></div>`;
    }
    if (j.juego === "zarabanda" || j.juego === "parranda") {
      const dif = v.dificultades || {};
      const NOM = { facil: "Fácil", normal: "Normal", dificil: "Difícil", experto: "Experto" };
      return `<h4>Puntos necesarios por dificultad</h4><p class="eco-ayuda">El premio sale de los <b>puntos ganados</b> en la canción (no del rango): una canción corta o fácil da pocos puntos, así que no se puede abusar de ella. Solo cuenta una canción completa (la práctica y las pruebas del editor no). Cada casilla es el mínimo de puntos para llegar a ese tramo; <b>-1 = ese tramo no existe</b> en esa dificultad. Referencia en la mesa: la mediana en Difícil es 285.000 puntos y en Experto 350.000; el máximo visto, 1.054.000. Los puntos tienen que subir de «sello» a «extraordinario».</p>
        <div class="eco-filtros"><label>Precisión mínima (%) <input type="number" data-v="precision_minima" value="${esc(v.precision_minima ?? 0)}" min="0" max="100" step="any" style="width:5em"></label><small class="eco-ayuda">Para que una canción larguísima no se gane a base de puntos con una precisión mediocre. 0 la quita.</small></div>
        <table class="eco-tabla"><thead><tr><th>Dificultad</th><th>Un sello desde</th><th>Bueno desde</th><th>Excelente desde</th><th>Extraordinario desde</th></tr></thead><tbody>${Object.keys(NOM).map(d => { const x = dif[d] || {}; return `<tr><td>${NOM[d]}</td>${["sello", "bueno", "excelente", "extraordinario"].map(t => `<td>${campoV(`dificultades.${d}.${t}`, x[t] ?? -1, 7)}</td>`).join("")}</tr>`; }).join("")}</tbody></table>`;
    }

    const tablas = j.juego === "ajedrez";
    const filasV = Object.entries(v.rivales).map(([rival, r]) => `<tr><td>${esc(rival === "_otros" ? "Cualquier otro rival" : rival)}</td><td>${campoV(`rivales.${rival}.gana`, r.gana)}</td>${tablas ? `<td>${campoV(`rivales.${rival}.tablas`, r.tablas)}</td>` : ""}<td>${campoV(`rivales.${rival}.pierde`, r.pierde)}</td></tr>`).join("");
    const extra = j.juego === "arqueria" && v.bonus ? `<div class="eco-filtros"><label>Bonus: a partir de estos puntos ${campoV("bonus.puntos", v.bonus.puntos)}</label><label>suma ${campoV("bonus.suma", v.bonus.suma)}</label><label>Puntaje máximo ${campoV("maximo", v.maximo)}</label></div>` : "";
    return `<h4>Puntaje que da cada rival</h4><p class="eco-ayuda">Al terminar una partida, el rival y el resultado dan un puntaje, y ese puntaje es el que se compara con los umbrales de arriba. Pon -1 para que esa partida no cuente para recompensas.</p>
      <table class="eco-tabla"><thead><tr><th>Rival</th><th>Gana</th>${tablas ? "<th>Tablas</th>" : ""}<th>Pierde</th></tr></thead><tbody>${filasV}</tbody></table>${extra}`;
  }

  function tarjetaJuego(j) {
    const g = j.grupo || {}, pesos = j.pesos || {}, u = j.umbrales || {};
    const idsTxt = lista(g.ids).join(", ");
    return `<details class="eco-juego" data-juego="${esc(j.juego)}" data-valores="${esc(JSON.stringify(j.valores || {}))}"${j.activo ? " data-era-activo=\"1\"" : ""} style="margin:.6em 0;padding:.4em .8em;border:1px solid currentColor;border-radius:6px">
      <summary><b>${esc(j.nombre)}</b> · <span class="${j.activo ? "eco-error" : "eco-ok"}">${j.activo ? "da cartas" : "apagado"}</span> · hasta ${esc(j.tope_dia)} al día</summary>
      <div class="eco-filtros">
        <label><input type="checkbox" data-c="activo"${j.activo ? " checked" : ""}> Da cartas</label>
        <label>Cartas por día <input type="number" data-c="tope_dia" min="0" max="50" value="${esc(j.tope_dia)}"></label>
        <label>Segundos mínimos de partida <input type="number" data-c="min_segundos" min="0" max="3600" value="${esc(j.min_segundos)}"></label>
        <label>Sellos por carta <input type="number" data-c="sellos_por_carta" min="1" max="50" value="${esc(j.sellos_por_carta)}"></label>
      </div>
      <h4>1. Puntaje → tramo</h4>
      <p class="eco-ayuda">El juego informa un puntaje al terminar (en Ajedrez, Duelo, Arquería y La Fractura va de 0 a 4; en Hooey son los sacrificios). Cada tramo empieza en el puntaje que pongas. Por debajo de «Bueno» solo cuenta como participación (sin carta). Tienen que ir de menor a mayor.</p>
      <div class="eco-filtros">${["participacion", "bueno", "excelente", "extraordinario"].map(k => `<label>${k === "participacion" ? "Participación desde" : TRAMOS.find(t => t[0] === k)[1] + " desde"} <input type="number" data-u="${k}" value="${esc(u[k])}" step="any" style="width:5em"></label>`).join("")}</div>
      ${bloqueValores(j)}
      <h4>2. Cada tramo: probabilidad, rareza y cartas</h4>
      <p class="eco-ayuda">Para cada tramo eliges: la <b>probabilidad</b> de que dé carta (de 0 a 1; 1 = siempre, 0 = nunca, solo sello), los <b>pesos de rareza</b> (relativos, no hace falta que sumen 100; 0 = nunca) y, si quieres, <b>cartas propias</b> (tipos o cartas concretas; vacío = las del juego, más abajo). La probabilidad se multiplica por el factor del día: la primera carta del día ×1, la segunda ×0,5 y la tercera ×0,25. Tras varias partidas buenas sin carta hay una común asegurada (Ajustes generales).</p>
      <table class="eco-tabla"><thead><tr><th>Tramo</th><th>Prob. de carta</th>${RAREZAS_JUEGO.map(r => `<th>${r[1]}</th>`).join("")}<th>Reparto</th><th>Cartas propias del tramo (vacío = las del juego)</th></tr></thead><tbody>${
        TRAMOS.map(([t, nom]) => { const gt = (j.grupos || {})[t] || {}; return `<tr data-tramo="${t}"><td>${nom}</td><td><input type="number" data-prob="${t}" min="0" max="1" step="0.05" value="${esc((j.prob || {})[t] ?? 1)}" style="width:4.5em"></td>${RAREZAS_JUEGO.map(([r]) => `<td><input type="number" data-p="${r}" min="0" max="1000" value="${esc((pesos[t] || {})[r] ?? 0)}" style="width:4.5em"></td>`).join("")}<td class="eco-pct"></td>
          <td>${TIPOS_CARTA.map(tp => `<label style="white-space:nowrap"><input type="checkbox" data-gt-tipo="${esc(tp)}"${lista(gt.tipos).includes(tp) ? " checked" : ""}> ${esc(tp)}</label>`).join(" ")}<br>
            <input type="text" data-gt-ids placeholder="ids de cartas concretas, separados por coma" list="ecoCartasIds" value="${esc(lista(gt.ids).join(", "))}" style="width:22em"></td></tr>`; }).join("")
      }</tbody></table>
      <h4>3. Cartas del juego (las usan los tramos sin cartas propias y los sellos)</h4>
      <div class="eco-filtros">
        <span>Tipos (ninguno marcado = cualquiera):</span>
        ${TIPOS_CARTA.map(t => `<label><input type="checkbox" data-g-tipo="${esc(t)}"${lista(g.tipos).includes(t) ? " checked" : ""}> ${esc(t)}</label>`).join(" ")}
      </div>
      <div class="eco-filtros">
        <label>Afinidades (separadas por coma, vacío = cualquiera) <input type="text" data-g="afinidades" value="${esc(lista(g.afinidades).join(", "))}" style="width:16em"></label>
      </div>
      <div class="eco-filtros">
        <label>Cartas concretas (ids separados por coma; si pones alguna, SOLO se dan esas) <textarea data-g="ids" rows="2" cols="48" list="ecoCartasIds">${esc(idsTxt)}</textarea></label>
        <small class="eco-ayuda" data-g-nombres>${lista(g.ids).map(id => esc(nombreCarta(id))).join(", ")}</small>
      </div>
      <p class="eco-ayuda">Aparte de esto, el servidor solo da cartas publicadas, obtenibles, <b>en circulación</b>, con copias disponibles y que el jugador pueda recibir sin pasar sus límites. Si no queda ninguna, el jugador recibe un sello.</p>
      <button type="button" data-guardar-juego>Guardar ${esc(j.nombre)}</button>
      <h4>Últimas recompensas</h4>
      <div data-monitor>Se carga al abrir este juego...</div>
    </details>`;
  }

  function resumenPesos(tr) {
    const v = [...tr.querySelectorAll("[data-p]")].map(i => [i.dataset.p, Math.max(0, Number(i.value) || 0)]);
    const tot = v.reduce((a, [, n]) => a + n, 0);
    tr.querySelector(".eco-pct").textContent = tot ? v.filter(([, n]) => n).map(([r, n]) => `${Math.round(n * 100 / tot)} % ${r}`).join(" · ") : "sin pesos: error";
  }

  async function monitorJuego(det) {
    const caja = det.querySelector("[data-monitor]");
    try {
      const supabase = await fichasCliente();
      const { data, error } = await supabase.from("cartas_recompensas_registro").select("creado, user_id, tramo, valor, resultado, carta_id, nota")
        .eq("juego", det.dataset.juego).order("creado", { ascending: false }).limit(15);
      if (error) throw error;
      if (!data.length) { caja.textContent = "Todavía nadie ha jugado esto con las recompensas encendidas."; return; }
      const quien = id => (perfilesJuego.find(p => p.id === id) || {}).username || String(id).slice(0, 6);
      caja.innerHTML = `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Cuándo</th><th>Jugador</th><th>Puntaje</th><th>Tramo</th><th>Resultado</th><th>Nota</th></tr></thead><tbody>${
        data.map(r => `<tr><td>${esc(new Date(r.creado).toLocaleString("es"))}</td><td>${esc(quien(r.user_id))}</td><td>${esc(r.valor)}</td><td>${esc(r.tramo)}</td><td>${r.resultado === "carta" ? "<b>" + esc(nombreCarta(r.carta_id)) + "</b>" : esc(r.resultado)}</td><td>${esc(r.nota || "")}</td></tr>`).join("")
      }</tbody></table></div>`;
    } catch (e) { caja.textContent = "No se pudo leer el registro: " + (e.message || e); }
  }

  async function pintarJuegos() {
    const cuerpo = document.getElementById("ecoCuerpo");
    cuerpo.innerHTML = `<div id="ecoJgRes">Cargando...</div>`;
    const res = document.getElementById("ecoJgRes");
    try {
      const [datos, recetas] = await Promise.all([rpc("cartas_admin_juegos"), rpc("cartas_admin_recetas")]);
      if (!filas.length) { try { filas = await rpc("cartas_admin_limites"); } catch (e) { /* sin lista de cartas: el selector de cartas concretas queda sin nombres */ } }
      try { if (!perfilesJuego.length && typeof adminListarPerfiles === "function") perfilesJuego = await adminListarPerfiles(); } catch (e) { /* sin nombres de jugador */ }
      const todosApagados = datos.juegos.every(j => !j.activo);
      const aj = datos.ajustes || {};
      const json = v => esc(JSON.stringify(v ?? null, null, 1));
      res.innerHTML = `
        <p class="${todosApagados ? "eco-ok" : "eco-error"}">${todosApagados ? "Las recompensas de cartas están APAGADAS: nadie gana cartas jugando." : "Hay juegos con recompensa ENCENDIDA. Mientras el servidor no pueda comprobar el resultado de la partida, un jugador con el navegador modificado puede inventar su resultado (los topes diarios limitan el daño, no lo impiden)."}</p>
        <h3>Minijuegos</h3>
        <p class="eco-ayuda">Una tarjeta por minijuego: qué puntaje da qué tramo, qué rarezas salen en cada tramo y de qué cartas. Abre una para ver sus últimas recompensas.</p>
        ${datos.juegos.map(tarjetaJuego).join("")}
        <datalist id="ecoCartasIds">${filas.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</datalist>
        <h3>Ajustes generales</h3>
        <div class="eco-filtros" id="ecoAjustes">
          <label>Cartas por día entre todos los juegos <input type="number" data-a="tope_dia_total" min="0" value="${esc(aj.tope_dia_total ?? 6)}"></label>
          <label>Partidas buenas sin carta antes de asegurar una <input type="number" data-a="pity" min="1" value="${esc(aj.pity ?? 10)}"></label>
          <label>Mejora personal (0,1 = 10 %) <input type="number" data-a="mejora_personal" step="any" min="0" value="${esc(aj.mejora_personal ?? 0.1)}"></label>
          <label>Horas para devolver una apuesta con un solo aviso <input type="number" data-a="apuesta_silencio_horas" min="1" max="720" value="${esc(aj.apuesta_silencio_horas ?? 24)}"></label>
          <label>Horas para devolver una apuesta sin avisos <input type="number" data-a="apuesta_inactividad_horas" min="1" max="720" value="${esc(aj.apuesta_inactividad_horas ?? 72)}"></label>
          <label>Días para cerrar una disputa sin resolver <input type="number" data-a="disputa_dias" min="1" max="365" value="${esc(aj.disputa_dias ?? 14)}"></label>
          <label title="Cada partida copia este valor al aceptarse. Súbelo siempre que cambies cartas-motor.js, cartas-efectos.js o cartas-vinculos.js (y la VERSION de cartas-motor.js)">Versión del motor de Triunfos <input type="text" data-a="motor_version" maxlength="40" value="${esc(typeof aj.motor_version === "string" ? aj.motor_version : "")}" style="width:12em"></label>
          <button type="button" id="ecoGuardarAjustes">Guardar ajustes</button>
        </div>
        <h3>Recetas de la forja</h3>
        <div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Receta</th><th>Activa</th><th>Entrada (JSON)</th><th>Salida (JSON)</th><th>Éxito (0 a 1)</th><th>Al fallar</th><th>Cartas entregadas</th><th></th></tr></thead><tbody>${
          recetas.map(r => `<tr data-receta="${esc(r.id)}"><td><b>${esc(r.nombre)}</b><small>${esc(r.id)}</small></td>
            <td><input type="checkbox" data-r="activa"${r.activa ? " checked" : ""}></td>
            <td><textarea data-r="entrada" rows="3" cols="26">${json(r.entrada)}</textarea></td>
            <td><textarea data-r="salida" rows="3" cols="20">${json(r.salida)}</textarea></td>
            <td><input type="number" data-r="exito" min="0" max="1" step="0.05" value="${r.exito}" style="width:5em"></td>
            <td><select data-r="al_fallar"><option value="perder_todo"${r.al_fallar === "perder_todo" ? " selected" : ""}>Pierdes todas (vuelven a la reserva)</option><option value="devolver_una"${r.al_fallar === "devolver_una" ? " selected" : ""}>Devuelve una</option></select></td>
            <td>Vuelven a la reserva</td>
            <td><button type="button" data-guardar-receta>Guardar</button></td></tr>`).join("")
        }</tbody></table></div>
        <p class="eco-ayuda">Las recetas piden rarezas <code>comun</code>, <code>infrecuente</code> o <code>rara</code> (la forja nunca usa legendarias ni limitadas). Ejemplo de entrada: <code>[{"rareza":"comun","n":5}]</code>. Salida: <code>{"rareza":"infrecuente"}</code>.</p>`;

      res.querySelectorAll("details.eco-juego").forEach(det => {
        det.querySelectorAll("tr[data-tramo]").forEach(tr => { resumenPesos(tr); tr.addEventListener("input", () => resumenPesos(tr)); });
        det.addEventListener("toggle", () => { if (det.open && !det.dataset.visto) { det.dataset.visto = "1"; monitorJuego(det); } });
        det.querySelector('[data-g="ids"]').addEventListener("input", ev => {
          const ids = ev.target.value.split(/[\s,]+/).filter(Boolean);
          det.querySelector("[data-g-nombres]").textContent = ids.map(id => filas.some(c => c.id === id) ? nombreCarta(id) : `(${id}: no existe)`).join(", ");
        });
        det.querySelector("[data-guardar-juego]").addEventListener("click", async () => {
          const num = sel => Number(det.querySelector(sel).value);
          const ids = det.querySelector('[data-g="ids"]').value.split(/[\s,]+/).filter(Boolean);
          const raras = ids.filter(id => !filas.some(c => c.id === id));
          if (raras.length) { estado(`Estas cartas no existen: ${raras.join(", ")}`, true); return; }
          // Puntaje por rival / por victoria: se parte de lo guardado y se cambian solo los números editados
          let valores = null;
          const camposV = det.querySelectorAll("[data-v]");
          if (camposV.length) {
            valores = JSON.parse(det.dataset.valores || "{}");
            for (const i of camposV) {
              const ruta = i.dataset.v.split("."), n = Number(i.value);
              if (i.value === "" || !Number.isFinite(n)) { estado("Hay un puntaje vacío o que no es un número.", true); return; }
              let o = valores;
              ruta.slice(0, -1).forEach(k => { o = o[k] = o[k] || {}; });
              o[ruta[ruta.length - 1]] = n;
            }
          }
          const pesos = {}, prob = {}, grupos = {};
          for (const tr of det.querySelectorAll("tr[data-tramo]")) {
            const t = tr.dataset.tramo;
            const p = {};
            tr.querySelectorAll("[data-p]").forEach(i => { const n = Math.max(0, Math.round(Number(i.value) || 0)); if (n) p[i.dataset.p] = n; });
            if (!Object.keys(p).length) { estado(`El tramo «${t}» necesita al menos una rareza con peso mayor que 0.`, true); return; }
            pesos[t] = p;
            const pr = Number(tr.querySelector("[data-prob]").value);
            if (!(pr >= 0 && pr <= 1)) { estado(`La probabilidad del tramo «${t}» va de 0 a 1.`, true); return; }
            prob[t] = pr;
            const tiposT = [...tr.querySelectorAll("[data-gt-tipo]")].filter(i => i.checked).map(i => i.dataset.gtTipo);
            const idsT = tr.querySelector("[data-gt-ids]").value.split(/[\s,]+/).filter(Boolean);
            const malasT = idsT.filter(id => !filas.some(c => c.id === id));
            if (malasT.length) { estado(`Estas cartas no existen (${t}): ${malasT.join(", ")}`, true); return; }
            if (tiposT.length || idsT.length) grupos[t] = { ...(tiposT.length ? { tipos: tiposT } : {}), ...(idsT.length ? { ids: idsT } : {}) };
          }
          const cfg = {
            activo: det.querySelector('[data-c="activo"]').checked,
            tope_dia: num('[data-c="tope_dia"]'),
            min_segundos: num('[data-c="min_segundos"]'),
            sellos_por_carta: num('[data-c="sellos_por_carta"]'),
            umbrales: Object.fromEntries([...det.querySelectorAll("[data-u]")].map(i => [i.dataset.u, Number(i.value)])),
            pesos, prob, grupos,
            ...(valores ? { valores } : {}),
            grupo: {
              tipos: [...det.querySelectorAll("[data-g-tipo]")].filter(i => i.checked).map(i => i.dataset.gTipo),
              afinidades: det.querySelector('[data-g="afinidades"]').value.split(",").map(t => t.trim()).filter(Boolean),
              ids
            }
          };
          if (cfg.activo && !det.dataset.eraActivo && !window.confirm("Vas a encender las recompensas de cartas de este juego. ¿Seguro?")) return;
          try { await rpc("cartas_admin_guardar_juego", { p_juego: det.dataset.juego, p_cfg: cfg }); estado("Juego guardado."); pintarJuegos(); }
          catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
        });
      });
      document.getElementById("ecoGuardarAjustes").addEventListener("click", async () => {
        const ajustes = {};
        document.querySelectorAll("#ecoAjustes [data-a]").forEach(i => { ajustes[i.dataset.a] = i.type === "text" ? i.value.trim() : Number(i.value); });
        try { await rpc("cartas_admin_guardar_ajustes", { p_ajustes: ajustes }); estado("Ajustes guardados."); }
        catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
      });
      res.querySelectorAll("[data-guardar-receta]").forEach(b => b.addEventListener("click", async () => {
        const tr = b.closest("tr");
        try {
          const cfg = {
            activa: tr.querySelector('[data-r="activa"]').checked,
            entrada: JSON.parse(tr.querySelector('[data-r="entrada"]').value),
            salida: JSON.parse(tr.querySelector('[data-r="salida"]').value),
            exito: Number(tr.querySelector('[data-r="exito"]').value),
            al_fallar: tr.querySelector('[data-r="al_fallar"]').value
          };
          await rpc("cartas_admin_guardar_receta", { p_id: tr.dataset.receta, p_cfg: cfg });
          estado("Receta guardada.");
        } catch (e) { estado(`No se pudo guardar${e instanceof SyntaxError ? " (el JSON no es válido)" : ""}: ${e.message || e}`, true); }
      }));
    } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo cargar: ${esc(e.message || e)}</p>`; }
  }

  /* ---------------- crianza: corrales y especies ---------------- */
  async function pintarCrianza() {
    const cuerpo = document.getElementById("ecoCuerpo");
    cuerpo.innerHTML = `<div id="ecoCrRes">Cargando...</div>`;
    const res = document.getElementById("ecoCrRes");
    try {
      const d = await rpc("cartas_admin_crianza");
      const opciones = h => d.corrales.map(c => `<option value="${esc(c.habitat)}"${c.habitat === h ? " selected" : ""}>${esc(c.nombre)}</option>`).join("");
      const fecha = t => new Date(t).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      res.innerHTML = `
        <p class="eco-ayuda">Cada criatura se cría en el corral de su medio. Hace falta una pareja: <b>dos copias del jugador de la misma criatura</b>. La cría pasa por tres fases (cortejo, gestación y cría, con las horas que pongas aquí para esa especie) y después el corral descansa. Al nacer, la copia nueva sale de la reserva o se emite respetando el límite global, el límite por jugador y «En circulación». Si la especie ya llegó a su límite, no nace nada y el jugador ve «sobrepoblación de la especie». Una criatura sin configurar no se puede criar.</p>
        <h3>Criaturas</h3>
        <div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Criatura</th><th>Rareza</th><th>Límite</th><th>Corral</th><th>Cortejo (h)</th><th>Gestación (h)</th><th>Cría (h)</th><th>Descanso (h)</th><th>Se cría</th><th></th></tr></thead><tbody>${
          d.criaturas.map(c => `<tr data-carta="${esc(c.carta)}"><td><b>${esc(c.nombre)}</b>${c.configurada ? "" : "<small>sin configurar</small>"}${c.en_circulacion ? "" : "<small>fuera de circulación</small>"}</td>
            <td>${esc(RAREZAS[c.rareza] || c.rareza)}</td><td>${esc(c.limite ?? "—")}</td>
            <td><select data-k="habitat">${opciones(c.habitat)}</select></td>
            ${[0, 1, 2].map(i => `<td><input type="number" data-h="${i}" min="0.01" max="720" step="any" value="${esc(c.horas[i])}" style="width:5em"></td>`).join("")}
            <td><input type="number" data-k="descanso" min="0" max="720" step="any" value="${esc(c.descanso_horas)}" style="width:5em"></td>
            <td><input type="checkbox" data-k="activa"${c.activa ? " checked" : ""} aria-label="Se puede criar"></td>
            <td><button type="button" data-guardar-cria>Guardar</button></td></tr>`).join("")
        }</tbody></table></div>
        <h3>Crías en curso</h3>
        ${d.en_curso.length ? `<div class="eco-tabla-caja"><table class="eco-tabla"><thead><tr><th>Jugador</th><th>Criatura</th><th>Corral</th><th>Empezó</th><th>Termina</th></tr></thead><tbody>${
          d.en_curso.map(x => `<tr><td>${esc(x.jugador)}</td><td>${esc((d.criaturas.find(c => c.carta === x.carta) || { nombre: x.carta }).nombre)}</td><td>${esc((d.corrales.find(c => c.habitat === x.habitat) || { nombre: x.habitat }).nombre)}</td><td>${esc(fecha(x.inicio))}</td><td>${esc(fecha(x.fin))}</td></tr>`).join("")
        }</tbody></table></div>` : `<p class="eco-ayuda">No hay ninguna cría en marcha.</p>`}
        <h3>Corrales</h3>
        <ul class="eco-ayuda">${d.corrales.map(c => `<li><b>${esc(c.nombre)}</b>: ${esc(c.descripcion)} Fases: ${esc(c.fases.join(" → "))}.</li>`).join("")}</ul>`;
      res.querySelectorAll("[data-guardar-cria]").forEach(b => b.addEventListener("click", async () => {
        const tr = b.closest("tr");
        const cfg = {
          habitat: tr.querySelector('[data-k="habitat"]').value,
          horas: [0, 1, 2].map(i => Number(tr.querySelector(`[data-h="${i}"]`).value)),
          descanso_horas: Number(tr.querySelector('[data-k="descanso"]').value),
          activa: tr.querySelector('[data-k="activa"]').checked
        };
        try { await rpc("cartas_admin_guardar_cria", { p_carta: tr.dataset.carta, p_cfg: cfg }); estado("Criatura guardada."); pintarCrianza(); }
        catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
      }));
    } catch (e) { res.innerHTML = `<p class="eco-error">No se pudo cargar: ${esc(e.message || e)}. ¿Aplicaste economia-18_crianza.sql?</p>`; }
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
