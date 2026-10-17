/* La forja (forja.html): entregas cartas y a cambio sale una mejor. Antes era un cuadro dentro de Mi habitación y, antes aún, una pestaña de Intercambios.
   Toda la lógica y los límites viven en el servidor (docs/economia-6_forja.sql y docs/economia-14_forja_reserva.sql: cartas_forja_ver y cartas_forjar);
   esta página enseña los encargos, deja colocar las cartas en el banco y cuenta lo que el servidor decide. El herrero y su escena están en js/forja-herrero.js
   y las cartas pequeñas en js/cartas-mini.js. Necesita js/batalla-apuestas.js (copiasLibres), js/cartas-vista.js y js/dialogos.js. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const BA = window.BatallaApuestas, FH = window.ForjaHerrero, CM = window.CartasMini;
  const TIPOS_FORJA = new Set(["Objeto", "Reacción", "Terreno", "Acción"]);   // la forja solo acepta cartas que no están vivas (el servidor lo vuelve a comprobar)
  const PLURAL = { comun: ["común", "comunes"], infrecuente: ["poco común", "poco comunes"], rara: ["rara", "raras"] };
  const rarezaN = (r, n) => (PLURAL[r] || [r, r])[n === 1 ? 0 : 1];

  let forja = null, mochila = [], receta = null, huecos = [], ocupada = false;

  function estado(t, error) {
    const e = $("fjEstado");
    e.textContent = t || "";
    e.classList.toggle("ic-error", !!error);
  }
  async function rpc(nombre, args) {
    const { data, error } = await (await fichasCliente()).rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  /* ------------------------------------------------------------------ lo que cada grupo de un encargo acepta */
  const acepta = (grupo, c) => c.rareza === grupo.rareza && TIPOS_FORJA.has(c.tipo) && (!grupo.tipos || !grupo.tipos.length || grupo.tipos.includes(c.tipo));
  const totalDe = r => r.entrada.reduce((s, g) => s + g.n, 0);
  /* Cuántas piezas de cada grupo tengo (sin contar dos veces una misma copia entre grupos) */
  function cubierto(r) {
    const usadas = new Set();
    return r.entrada.map(g => {
      const mias = mochila.filter(c => !usadas.has(c.id) && acepta(g, c)).slice(0, g.n);
      mias.forEach(c => usadas.add(c.id));
      return mias.length;
    });
  }
  const dorso = (rareza, clase) => `<span class="fj-dorso fj-r-${esc(rareza)}${clase ? " " + clase : ""}" title="${esc(rarezaN(rareza, 1))}"><i class="fj-gema"></i></span>`;

  /* ------------------------------------------------------------------ los encargos */
  function falla(r) {
    if (r.exito >= 1) return "No puede fallar.";
    return r.al_fallar === "devolver_una" ? "Si falla, te devuelve una de las cartas." : "Si falla, lo pierdes todo.";
  }

  function pintarRecetas() {
    if (!forja) return;
    const agotado = forja.hoy >= forja.tope;
    $("fjRecetas").innerHTML = forja.recetas.length ? forja.recetas.map(r => {
      const tengo = cubierto(r), completa = tengo.every((n, i) => n >= r.entrada[i].n);
      const pct = Math.round(r.exito * 100);
      return `<li class="fj-encargo${completa ? " fj-lista" : ""}" data-receta="${esc(r.id)}">
        <header><h3>${esc(r.nombre)}</h3><span class="fj-sello">${pct >= 100 ? "Siempre sale" : `${pct} % de éxito`}</span></header>
        <p class="fj-desc">${esc(r.descripcion)}</p>
        <div class="fj-flujo">
          <div class="fj-entra">${r.entrada.map((g, i) => Array.from({ length: g.n }, (_, k) => dorso(g.rareza, k < tengo[i] ? "fj-tengo" : "")).join("")).join("")}</div>
          <span class="fj-mazo-ico" aria-hidden="true">⚒</span>
          <div class="fj-sale">${dorso(r.salida.rareza, "fj-sale-dorso")}<b class="fj-interrogante" aria-hidden="true">?</b></div>
        </div>
        <div class="fj-temple" role="img" aria-label="Temple: ${pct} %"><i style="width:${pct}%"></i></div>
        <p class="fj-falla">${esc(falla(r))}</p>
        <p class="fj-pide">Entregas ${r.entrada.map(g => `${g.n} ${rarezaN(g.rareza, g.n)}`).join(" + ")}. Recibes 1 carta ${rarezaN(r.salida.rareza, 1)}.</p>
        <footer><span class="fj-tienes">${completa ? "Tienes lo necesario" : `Te falta ${r.entrada.map((g, i) => g.n - tengo[i] > 0 ? `${g.n - tengo[i]} ${rarezaN(g.rareza, g.n - tengo[i])}` : "").filter(Boolean).join(" y ")}`}</span>
          <button type="button" class="cartas-boton cartas-boton-principal" data-forjar="${esc(r.id)}"${agotado ? " disabled" : ""}>${receta && receta.id === r.id ? "En el banco" : "Forjar"}</button></footer></li>`;
    }).join("") : `<li class="ic-vacio fj-vacio">El herrero no tiene encargos ahora mismo.</li>`;
    FH.brasas(forja.hoy, forja.tope);
  }

  /* ------------------------------------------------------------------ el banco: colocar las cartas en los huecos */
  function abrirBanco(id) {
    const r = forja.recetas.find(x => x.id === id);
    if (!r) return;
    receta = r;
    huecos = r.entrada.flatMap(g => Array.from({ length: g.n }, () => ({ grupo: g, copia: null })));
    pintarBanco();
    pintarRecetas();
    $("fjBanco").classList.remove("hidden");
    $("fjBanco").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    FH.decir(mochila.some(c => r.entrada.some(g => acepta(g, c))) ? "elige" : "vacio");
  }
  function cerrarBanco() {
    receta = null; huecos = [];
    $("fjBanco").classList.add("hidden");
    pintarRecetas();
  }

  function pintarBanco() {
    if (!receta) return;
    const puestas = new Set(huecos.filter(h => h.copia).map(h => h.copia.id));
    const sirven = mochila.filter(c => !puestas.has(c.id) && receta.entrada.some(g => acepta(g, c)));
    const llenos = huecos.filter(h => h.copia).length, total = huecos.length, listo = llenos === total;
    $("fjBanco").innerHTML = `
      <header><div><p class="fj-eyebrow">En el banco</p><h2>${esc(receta.nombre)}</h2></div><button type="button" class="cartas-boton" data-cerrar-banco>Quitar del banco</button></header>
      <div class="fj-banco-fila">
        <div class="fj-huecos">${huecos.map((h, i) => h.copia
          ? `<span class="fj-hueco fj-lleno">${CM.html({ carta: h.copia.carta, nombre: h.copia.nombre, rareza: h.copia.rareza, numero: h.copia.numero })}<button type="button" class="fj-sacar" data-sacar="${i}" aria-label="Quitar ${esc(h.copia.nombre)} del banco">×</button></span>`
          : `<button type="button" class="fj-hueco fj-vacio-hueco fj-r-${esc(h.grupo.rareza)}" data-hueco="${i}" aria-label="Hueco para una carta ${esc(rarezaN(h.grupo.rareza, 1))}"><i class="fj-gema"></i><span>${esc(rarezaN(h.grupo.rareza, 1))}</span></button>`).join("")}</div>
        <div class="fj-resultado-prev" aria-hidden="true"><span class="fj-flecha">➜</span>${dorso(receta.salida.rareza, "fj-sale-dorso")}<b class="fj-interrogante">?</b></div>
      </div>
      <p class="fj-cuenta">${llenos} de ${total} piezas · ${Math.round(receta.exito * 100)} % de éxito · ${esc(falla(receta))}</p>
      <div class="fj-acciones"><button type="button" class="cartas-boton cartas-boton-principal fj-golpear" data-golpear${listo && !ocupada ? "" : " disabled"}>Golpear</button></div>
      <h3 class="fj-sub">Tu mochila</h3>
      <p class="fj-ayuda">Pulsa una carta para ponerla en el banco. La lupa la enseña grande.</p>
      <div class="fj-mochila">${sirven.length ? sirven.map(c => `<div class="fj-pieza">${CM.html({ carta: c.carta, nombre: c.nombre, rareza: c.rareza, numero: c.numero }).replace('<button type="button" class="mc"', `<button type="button" data-copia="${esc(c.id)}" class="mc"`)}<button type="button" class="fj-lupa" data-ver="${esc(c.carta)}" data-numero="${esc(c.numero)}" aria-label="Ver ${esc(c.nombre)} grande">🔍</button></div>`).join("")
        : `<p class="ic-vacio fj-vacio">No tienes más cartas libres que sirvan para este encargo.</p>`}</div>`;
  }

  function poner(idCopia) {
    const c = mochila.find(x => x.id === idCopia);
    if (!c || !receta) return;
    const hueco = huecos.find(h => !h.copia && acepta(h.grupo, c));
    if (!hueco) { FH.decir("falta"); return; }
    hueco.copia = c;
    pintarBanco();
    FH.decir(huecos.every(h => h.copia) ? "listo" : "elige");
  }

  async function golpear() {
    if (!receta || ocupada || !huecos.every(h => h.copia)) return;
    const total = totalDe(receta);
    if (!(await dialogo.confirmar(`Vas a entregar ${total} cartas, que vuelven a la reserva. ¿Forjar?`, { titulo: "Forja", aceptar: "Forjar" }))) return;
    ocupada = true; pintarBanco();
    FH.decir("golpe");
    try {
      const [out] = await Promise.all([rpc("cartas_forjar", { p_receta: receta.id, p_ejemplares: huecos.map(h => h.copia.id) }), FH.golpe()]);
      if (out.resultado === "carta") { FH.decir("exito"); mostrarResultado(true, out); }
      else if (out.resultado === "fallo") { FH.decir("fallo"); mostrarResultado(false, out); }
      else { estado(out.mensaje || "No hay carta disponible ahora mismo. No se consumió nada.", true); FH.decir("error"); }
      receta = null; huecos = [];
      $("fjBanco").classList.add("hidden");
    } catch (e) { estado(e.message || String(e), true); FH.decir("error"); }
    ocupada = false;
    await cargar();
    if (receta) pintarBanco();
  }

  /* ------------------------------------------------------------------ resultado */
  function mostrarResultado(salio, out) {
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado fj-res " + (salio ? "fj-res-bien" : "fj-res-mal");
    if (salio) {
      const c = window.cartaPorId(out.carta);
      dlg.innerHTML = `<h2>¡La forja funcionó!</h2><div class="ic-carta">${c ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
        <p><b>${esc(c ? c.nombre : out.carta)}</b><br><small>Copia ${esc(out.numero)}</small></p><button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    } else {
      dlg.innerHTML = `<h2>El hierro se quebró</h2><div class="fj-ceniza" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <p>${out.devuelta ? "La forja falló. Te devolvieron una de las cartas." : "La forja falló y las cartas volvieron a la reserva."}</p><button type="button" class="cartas-boton cartas-boton-principal">Entendido</button>`;
    }
    document.body.appendChild(dlg);
    dlg.querySelector(".cartas-boton-principal").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  /* ------------------------------------------------------------------ datos y arranque */
  async function cargarMochila() {
    try { mochila = (await BA.copiasLibres()).filter(c => TIPOS_FORJA.has(c.tipo) && (c.rareza === "comun" || c.rareza === "infrecuente" || c.rareza === "rara")); }
    catch (e) { mochila = []; }
  }
  async function cargar() {
    try {
      forja = await rpc("cartas_forja_ver");
      await cargarMochila();
      pintarRecetas();
    } catch (e) { $("fjRecetas").innerHTML = `<li class="ic-vacio fj-vacio">${esc(e.message || e)}</li>`; }
  }

  function enlazar() {
    document.querySelector("main").addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.forjar) abrirBanco(b.dataset.forjar);
      else if ("cerrarBanco" in b.dataset) cerrarBanco();
      else if ("golpear" in b.dataset) golpear();
      else if (b.dataset.sacar !== undefined) { huecos[Number(b.dataset.sacar)].copia = null; pintarBanco(); }
      else if (b.classList.contains("fj-lupa")) CM.abrir(b.dataset.ver, b.dataset.numero);
      else if (b.dataset.copia) poner(b.dataset.copia);
      else if (b.dataset.hueco !== undefined) FH.decir("elige");
      else if (b.dataset.ver) CM.abrir(b.dataset.ver, b.dataset.numero);
    });
  }

  async function iniciar() {
    FH.montar($("fjEscena"));
    FH.brasas(0, 3);
    enlazar();
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) {
      FH.decir("sinSesion");
      const aviso = $("fjAviso");
      aviso.textContent = "Inicia sesión para forjar cartas.";
      aviso.classList.remove("hidden");
      $("fjCuerpo").classList.add("hidden");
      return;
    }
    const rol = await CartasCliente.verificarRol();
    await CartasCliente.cargarDefiniciones(rol.puede);
    await cargar();
    FH.decir(forja && forja.hoy >= forja.tope ? "agotado" : "saludo");
    setInterval(() => { if (!document.hidden && !receta && !document.querySelector("dialog[open]")) cargar(); }, 30000);
  }
  iniciar();
})();
