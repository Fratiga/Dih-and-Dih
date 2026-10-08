/* Constructor de mazos de Triunfos. */
(function () {
  const { esc, htmlCarta } = window.CartasVista;
  const M = window.CartasMotor;
  const $ = id => document.getElementById(id);

  const gridEl = $("mzGrid");
  const listaEl = $("mzLista");
  let esEditor = CartasCliente.editorCacheado();
  let propia = null;            // { cartas: Map } o null sin sesión
  let mazos = [];               // guardados en el servidor
  let actual = { id: null, nombre: "", cuenta: {} };
  let original = "";            // para saber si hay cambios sin guardar

  const cartaPorId = id => window.cartaPorId(id);
  const tope = c => M.topeCopias(c);
  // Cuántas copias puede usar este jugador: las que tiene; los editores, todas las que permite la rareza
  const posee = c => (esEditor ? tope(c) : (propia && propia.cartas.get(c.id)) || 0);
  const maximoUsable = c => Math.min(tope(c), posee(c));
  const total = () => Object.values(actual.cuenta).reduce((s, n) => s + n, 0);
  const firma = () => JSON.stringify([actual.nombre.trim(), Object.keys(actual.cuenta).sort().map(k => [k, actual.cuenta[k]])]);

  function aviso(texto) {
    const el = $("mzAviso");
    el.textContent = texto || "";
    el.classList.toggle("hidden", !texto);
  }

  /* --- Colección ---------------------------------------------------------- */
  function cartasUsables() {
    return window.CARTAS.filter(c => CartasCliente.visible(c) && !c.borrador && posee(c) > 0);
  }

  function pintarColeccion() {
    const q = $("mzBuscar").value.trim().toLowerCase();
    const f = { r: $("mzRareza").value, t: $("mzTipo").value, a: $("mzAfinidad").value, fuera: $("mzSoloFuera").checked };
    const lista = cartasUsables()
      .filter(c => (!q || `${c.nombre} ${c.habilidad}`.toLowerCase().includes(q)) && (!f.r || c.rareza === f.r) && (!f.t || c.tipo === f.t)
        && (!f.a || c.afinidad.includes(f.a)) && (!f.fuera || !actual.cuenta[c.id]))
      .sort((a, b) => a.coste - b.coste || a.nombre.localeCompare(b.nombre));
    gridEl.innerHTML = lista.length ? lista.map(c => {
      const n = actual.cuenta[c.id] || 0, max = maximoUsable(c);
      const tengo = (propia && propia.cartas.get(c.id)) || 0;
      return `<div class="mz-item ${n >= max ? "lleno" : ""} ${n ? "en-mazo" : ""}" data-id="${esc(c.id)}">
        ${htmlCarta(c, true, tengo, null)}
        <div class="mz-item-pie">
          <button type="button" data-quitar="${esc(c.id)}" ${n ? "" : "disabled"} aria-label="Quitar una">−</button>
          <span title="${tengo > 1 ? `Tienes ${tengo} copias en tu colección, pero solo ${max === 1 ? "una" : max} cabe${max === 1 ? "" : "n"} en un mazo.` : ""}"><strong>${n}</strong> / ${max}</span>
          <button type="button" data-poner="${esc(c.id)}" ${n >= max ? "disabled" : ""} aria-label="Añadir una">+</button>
        </div>
      </div>`;
    }).join("") : `<p class="cartas-vacio">${propia || esEditor ? "No hay cartas con esos filtros." : "Inicia sesión para armar mazos con tus cartas."}</p>`;
  }

  /* --- Mazo actual -------------------------------------------------------- */
  function cambiar(id, delta) {
    const c = cartaPorId(id);
    if (!c) return;
    const n = (actual.cuenta[id] || 0) + delta;
    if (n < 0 || n > maximoUsable(c)) return;
    if (delta > 0 && total() >= M.C.MAZO_MAX) { $("mzEstado").textContent = `El mazo ya tiene ${M.C.MAZO_MAX} cartas.`; return; }
    if (n === 0) delete actual.cuenta[id]; else actual.cuenta[id] = n;
    $("mzEstado").textContent = "";
    pintarTodo();
  }

  function problemas() {
    const cartas = {};
    window.CARTAS.forEach(c => { cartas[c.id] = c; });
    const poseidas = esEditor ? null : Object.fromEntries(window.CARTAS.map(c => [c.id, posee(c)]));
    const lista = M.validarMazo(actual.cuenta, cartas, poseidas);
    if (!actual.nombre.trim()) lista.unshift("Ponle un nombre al mazo.");
    return lista;
  }

  function pintarMazo() {
    const n = total();
    $("mzTotal").textContent = String(n);
    $("mzBarra").style.width = `${Math.min(100, (n / M.C.MAZO_MAX) * 100)}%`;
    $("mzBarra").className = n < M.C.MAZO_MIN ? "corto" : n > M.C.MAZO_MAX ? "largo" : "bien";

    const entradas = Object.entries(actual.cuenta).map(([id, k]) => [cartaPorId(id), k]).filter(([c]) => c)
      .sort((a, b) => a[0].coste - b[0].coste || a[0].nombre.localeCompare(b[0].nombre));
    $("mzCartas").innerHTML = entradas.length ? entradas.map(([c, k]) => `
      <li class="mz-fila carta-rareza-${c.rareza}" data-id="${esc(c.id)}">
        <span class="mz-fila-coste">${c.coste}</span>
        <span class="mz-fila-nombre">${esc(c.nombre)}</span>
        <span class="mz-fila-tipo">${esc(c.tipo)}</span>
        <span class="mz-fila-cant">
          <button type="button" data-quitar="${esc(c.id)}" aria-label="Quitar una">−</button>
          <strong>${k}</strong>
          <button type="button" data-poner="${esc(c.id)}" ${k >= maximoUsable(c) ? "disabled" : ""} aria-label="Añadir una">+</button>
        </span>
      </li>`).join("") : `<li class="mz-vacio">Todavía no hay cartas. Haz clic en las de la izquierda.</li>`;

    // Curva de coste (solo cuenta cartas)
    const barras = Array(8).fill(0);
    entradas.forEach(([c, k]) => { barras[Math.min(7, c.coste)] += k; });
    const maxBarra = Math.max(1, ...barras);
    $("mzCurva").innerHTML = barras.map((v, i) => `<div class="mz-col" title="${v} carta${v === 1 ? "" : "s"} de coste ${i === 7 ? "7 o más" : i}"><i style="height:${(v / maxBarra) * 100}%"></i><b>${v || ""}</b><small>${i === 7 ? "7+" : i}</small></div>`).join("");

    const porTipo = {};
    entradas.forEach(([c, k]) => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + k; });
    $("mzTipos").innerHTML = Object.entries(porTipo).map(([t, k]) => `<span>${esc(t)} <strong>${k}</strong></span>`).join("");

    const lista = problemas();
    $("mzProblemas").innerHTML = lista.map(p => `<li>${esc(p)}</li>`).join("");
    const cambios = firma() !== original;
    $("mzGuardar").disabled = lista.length > 0 || !cambios || !(propia || esEditor);
    $("mzGuardar").textContent = cambios ? "Guardar mazo" : "Guardado";
    $("mzBorrar").disabled = !actual.id;
  }

  function pintarLista() {
    listaEl.innerHTML = `<option value="">— Mazo nuevo —</option>` + mazos.map(m => {
      const n = Object.values(m.cartas).reduce((s, k) => s + k, 0);
      return `<option value="${m.id}">${esc(m.nombre)} (${n})</option>`;
    }).join("");
    listaEl.value = actual.id || "";
  }

  function pintarTodo() {
    pintarColeccion();
    pintarMazo();
  }

  function elegirMazo(id) {
    const m = mazos.find(x => x.id === id);
    actual = m ? { id: m.id, nombre: m.nombre, cuenta: { ...m.cartas } } : { id: null, nombre: "", cuenta: {} };
    $("mzNombre").value = actual.nombre;
    original = firma();
    $("mzEstado").textContent = "";
    pintarLista();
    pintarTodo();
  }

  /* --- Guardar y borrar ----------------------------------------------------- */
  async function guardar() {
    const estado = $("mzEstado");
    estado.textContent = "Guardando...";
    $("mzGuardar").disabled = true;
    try {
      const id = await CartasCliente.guardarMazo(actual.id, actual.nombre.trim(), actual.cuenta);
      mazos = await CartasCliente.listarMazos();
      actual.id = id;
      original = firma();
      estado.textContent = "Mazo guardado.";
      pintarLista();
      pintarMazo();
    } catch (e) {
      estado.textContent = `No se pudo guardar: ${e.message || e}`;
      pintarMazo();
    }
  }

  async function borrar() {
    if (!actual.id || !(await dialogo.confirmar(`¿Borrar el mazo "${actual.nombre}"?`, { titulo: "Borrar mazo", aceptar: "Borrar", peligro: true }))) return;
    try {
      await CartasCliente.borrarMazo(actual.id);
      mazos = await CartasCliente.listarMazos();
      elegirMazo("");
      $("mzEstado").textContent = "Mazo borrado.";
    } catch (e) {
      $("mzEstado").textContent = `No se pudo borrar: ${e.message || e}`;
    }
  }

  /* --- Eventos --------------------------------------------------------------- */
  async function preguntarSiHayCambios() {
    return firma() === original || await dialogo.confirmar("Hay cambios sin guardar en este mazo. ¿Dejarlos?", { titulo: "Cambios sin guardar", aceptar: "Dejarlos", peligro: true });
  }

  gridEl.addEventListener("click", ev => {
    const poner = ev.target.closest("[data-poner]");
    const quitar = ev.target.closest("[data-quitar]");
    if (poner) return cambiar(poner.dataset.poner, 1);
    if (quitar) return cambiar(quitar.dataset.quitar, -1);
    const item = ev.target.closest("[data-id]");
    if (item) cambiar(item.dataset.id, 1);
  });
  gridEl.addEventListener("contextmenu", ev => {
    const item = ev.target.closest("[data-id]");
    if (!item) return;
    ev.preventDefault();
    cambiar(item.dataset.id, -1);
  });
  $("mzCartas").addEventListener("click", ev => {
    const poner = ev.target.closest("[data-poner]");
    const quitar = ev.target.closest("[data-quitar]");
    if (poner) cambiar(poner.dataset.poner, 1);
    if (quitar) cambiar(quitar.dataset.quitar, -1);
  });
  $("mzNombre").addEventListener("input", () => { actual.nombre = $("mzNombre").value; pintarMazo(); });
  listaEl.addEventListener("change", async () => {
    if (!(await preguntarSiHayCambios())) { listaEl.value = actual.id || ""; return; }
    elegirMazo(listaEl.value);
  });
  $("mzNuevo").addEventListener("click", async () => { if (await preguntarSiHayCambios()) elegirMazo(""); });
  $("mzGuardar").addEventListener("click", guardar);
  $("mzBorrar").addEventListener("click", borrar);
  [$("mzRareza"), $("mzTipo"), $("mzAfinidad"), $("mzSoloFuera")].forEach(el => el.addEventListener("change", pintarColeccion));
  $("mzBuscar").addEventListener("input", pintarColeccion);
  window.addEventListener("beforeunload", ev => { if (firma() !== original) { ev.preventDefault(); ev.returnValue = ""; } });

  function llenarFiltros() {
    const rarezaActual = $("mzRareza").value;
    $("mzRareza").innerHTML = `<option value="">Todas las rarezas</option>` + Object.entries(window.CARTAS_RAREZAS).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
    $("mzRareza").value = rarezaActual;
    const tipoActual = $("mzTipo").value;
    $("mzTipo").innerHTML = `<option value="">Todos los tipos</option>` + [...new Set(window.CARTAS.map(c => c.tipo))].map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    $("mzTipo").value = tipoActual;
    $("mzAfinidad").innerHTML = `<option value="">Todas las afinidades</option>` + Object.entries(window.CARTAS_AFINIDADES).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
  }

  $("mzMin").textContent = String(M.C.MAZO_MIN);
  $("mzMax").textContent = String(M.C.MAZO_MAX);
  llenarFiltros();
  pintarLista();
  pintarTodo();

  (async function cargar() {
    const rol = await CartasCliente.verificarRol();
    esEditor = rol.puede;
    await CartasCliente.cargarDefiniciones(esEditor);
    llenarFiltros();
    try {
      propia = await CartasCliente.coleccion();
    } catch (e) {
      propia = null;
      aviso("No se pudo leer tu colección. Si eres el máster, corre scratchpad/cartas.sql en Supabase.");
    }
    if (!propia && !esEditor) aviso("Inicia sesión para armar mazos con tus cartas.");
    else if (esEditor && !propia) aviso("");
    else aviso(esEditor ? "Modo editor: puedes usar cualquier carta para probar." : "");
    try {
      mazos = await CartasCliente.listarMazos();
    } catch (e) {
      mazos = [];
      if (propia || esEditor) aviso("No se pudieron cargar tus mazos. Si eres el máster, corre scratchpad/cartas_combate.sql en Supabase.");
    }
    pintarLista();
    elegirMazo(mazos.length ? mazos[0].id : "");
  })();
})();
