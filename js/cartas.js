/* Álbum de Cartas malditas y editor de cartas (Admin y rol Editor de cartas). */
(function () {
  const gridEl = document.getElementById("cartasGrid");
  const detalleEl = document.getElementById("cartaDetalle");
  const detalleContenidoEl = document.getElementById("cartaDetalleContenido");
  const filtroRareza = document.getElementById("filtroRareza");
  const filtroTipo = document.getElementById("filtroTipo");
  const filtroAfinidad = document.getElementById("filtroAfinidad");
  const filtroTengo = document.getElementById("filtroTengo");
  const filtroReveladas = document.getElementById("filtroReveladas");
  const CLAVE_REVELAR = "compendioCartasRevelar";

  // Los ids del catálogo base (cartas-datos.js): esas cartas no se borran, solo se despublican.
  const idsBase = new Set(window.CARTAS.map(c => c.id));
  let puedeEditar = CartasCliente.editorCacheado();
  // Quien edita puede ver todas las cartas sin que cuenten como suyas.
  const revelando = () => puedeEditar && filtroReveladas.checked;

  let propia = null; // { cartas: Map, numeros: Map } o null sin sesión
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const iniciales = nombre => nombre.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";

  const cantidadDe = id => (propia && propia.cartas.get(id)) || 0;
  const numeros2 = n => String(n).padStart(2, "0");

  function htmlCarta(c, tengo, cantidad, numeros) {
    const rareza = window.CARTAS_RAREZAS[c.rareza] || { nombre: c.rareza };
    const afinidad = c.afinidad[0];
    const stats = c.atq === null || c.atq === undefined ? "" : `<div class="carta-stats"><span class="atq">${c.atq} ATQ</span><span class="pv">${c.pv} PV</span></div>`;
    const marcaNumero = tengo && c.limite && numeros && numeros.length
      ? `<span class="carta-numero">${numeros.map(n => `${numeros2(n)}/${numeros2(c.limite)}`).join(" · ")}</span>` : "";
    const copias = tengo && cantidad > 1 ? `<span class="carta-copias">x${cantidad}</span>` : "";
    const borrador = c.borrador ? `<span class="carta-borrador">Borrador</span>` : "";
    const arte = tengo && c.imagen
      ? `<img src="${esc(c.imagen)}" alt="" loading="lazy" decoding="async">`
      : `<b>${esc(tengo ? iniciales(c.nombre) : "?")}</b>`;
    return `
      <button type="button" class="carta carta-rareza-${c.rareza} carta-af-${afinidad} ${tengo ? "" : "sin-tener"}" data-id="${esc(c.id)}" aria-label="${tengo ? esc(c.nombre) : "Carta sin descubrir"}">
        ${copias}${marcaNumero}${borrador}
        <div class="carta-cabeza">
          <span class="carta-coste">${c.coste}</span>
          <span class="carta-nombre">${esc(c.nombre)}${c.epiteto ? `<small>${esc(c.epiteto)}</small>` : ""}</span>
        </div>
        <div class="carta-arte">${arte}</div>
        <div class="carta-tipo"><span>${esc(c.tipo)}</span><span>${esc(rareza.nombre)}</span></div>
        <p class="carta-habilidad">${esc(c.habilidad)}</p>
        ${stats}
      </button>`;
  }

  function resumenFuente(c) {
    if (!c.fuente || !c.fuente.data) return "";
    const lista = window[c.fuente.data] || [];
    const entrada = lista.find(e => e.id === c.fuente.id);
    return entrada && entrada.summary ? entrada.summary : "";
  }

  const descripcionDe = c => c.descripcion || resumenFuente(c);

  function abrirDetalle(id) {
    const c = window.cartaPorId(id);
    if (!c) return;
    const cantidad = cantidadDe(id);
    const tengo = cantidad > 0 || revelando();
    const numeros = propia && propia.numeros.get(id);
    const af = c.afinidad.map(a => window.CARTAS_AFINIDADES[a].nombre).join(" / ");
    const rareza = window.CARTAS_RAREZAS[c.rareza].nombre;
    const editar = puedeEditar ? `<p><button type="button" class="cartas-boton" data-editar="${esc(c.id)}">Editar esta carta</button></p>` : "";
    const cuerpo = tengo
      ? `<h2>${esc(c.nombre)}${c.epiteto ? ` — ${esc(c.epiteto)}` : ""}</h2>
         <p class="carta-meta">${esc(c.tipo)} · ${esc(rareza)} · ${esc(af)}${c.limite ? ` · edición de ${c.limite}` : ""}</p>
         ${c.habilidad ? `<p><strong>Reglas.</strong> ${esc(c.habilidad)}</p>` : ""}
         ${descripcionDe(c) ? `<p class="carta-resumen">${esc(descripcionDe(c))}</p>` : ""}
         <p class="carta-meta">${cantidad > 0 ? `Tienes ${cantidad} copia${cantidad === 1 ? "" : "s"}.` : "Vista de editor: no la tienes."}</p>${editar}`
      : `<h2>Carta sin descubrir</h2>
         <p class="carta-meta">${esc(c.tipo)} · ${esc(rareza)}</p>
         <p class="carta-resumen">${c.obtenible
            ? "Se consigue ganando en los minijuegos o en combates de cartas. Las más raras piden rivales más difíciles."
            : "Esta carta no sale de los minijuegos. Solo el máster puede dártela."}</p>`;
    detalleContenidoEl.innerHTML = `<div class="carta-detalle-fila">${htmlCarta(c, tengo, cantidad, numeros)}<div>${cuerpo}</div></div>`;
    if (!detalleEl.open) detalleEl.showModal();
  }

  function pintar() {
    const visibles = window.CARTAS.filter(c => CartasCliente.visible(c));
    const tengo = visibles.filter(c => cantidadDe(c.id) > 0);
    document.getElementById("cartasTotal").textContent = String(visibles.length);
    document.getElementById("cartasTengo").textContent = String(tengo.length);
    document.getElementById("cartasCopias").textContent = String(tengo.reduce((s, c) => s + cantidadDe(c.id), 0));
    document.getElementById("cartasProgreso").style.width = `${visibles.length ? Math.round((tengo.length / visibles.length) * 100) : 0}%`;

    const f = { rareza: filtroRareza.value, tipo: filtroTipo.value, af: filtroAfinidad.value, soloTengo: filtroTengo.checked };
    const lista = visibles
      .filter(c => (!f.rareza || c.rareza === f.rareza) && (!f.tipo || c.tipo === f.tipo) && (!f.af || c.afinidad.includes(f.af)) && (!f.soloTengo || cantidadDe(c.id) > 0))
      .sort((a, b) => window.CARTAS_RAREZAS[a.rareza].orden - window.CARTAS_RAREZAS[b.rareza].orden || a.coste - b.coste || a.nombre.localeCompare(b.nombre));

    gridEl.innerHTML = lista.length
      ? lista.map(c => htmlCarta(c, cantidadDe(c.id) > 0 || revelando(), cantidadDe(c.id), propia && propia.numeros.get(c.id))).join("")
      : `<p class="cartas-vacio">No hay cartas con esos filtros.</p>`;
  }

  function llenarFiltroTipo() {
    const actual = filtroTipo.value;
    filtroTipo.innerHTML = `<option value="">Todos los tipos</option>` + [...new Set(window.CARTAS.map(c => c.tipo))]
      .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    filtroTipo.value = actual;
  }

  function mostrarControlesDeEditor() {
    document.getElementById("filtroReveladasEtiqueta").classList.toggle("hidden", !puedeEditar);
    document.getElementById("cartaNueva").classList.toggle("hidden", !puedeEditar);
  }

  function prepararFiltros() {
    Object.entries(window.CARTAS_RAREZAS).forEach(([k, v]) => filtroRareza.insertAdjacentHTML("beforeend", `<option value="${k}">${v.nombre}</option>`));
    llenarFiltroTipo();
    Object.entries(window.CARTAS_AFINIDADES).forEach(([k, v]) => filtroAfinidad.insertAdjacentHTML("beforeend", `<option value="${k}" title="${esc(v.descripcion)}">${v.nombre}</option>`));
    try { filtroReveladas.checked = localStorage.getItem(CLAVE_REVELAR) !== "0"; } catch (e) { /* sin almacenamiento */ }
    filtroReveladas.addEventListener("change", () => {
      try { localStorage.setItem(CLAVE_REVELAR, filtroReveladas.checked ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
    });
    [filtroRareza, filtroTipo, filtroAfinidad, filtroTengo, filtroReveladas].forEach(el => el.addEventListener("change", pintar));
    mostrarControlesDeEditor();
  }

  /* =========================================================================
     Editor de cartas
  ========================================================================= */
  const editorEl = document.getElementById("cartaEditor");
  const $ = id => document.getElementById(id);
  const campos = {
    id: $("edId"), nombre: $("edNombre"), epiteto: $("edEpiteto"), tipo: $("edTipo"), rareza: $("edRareza"),
    af1: $("edAfinidad1"), af2: $("edAfinidad2"), coste: $("edCoste"), atq: $("edAtq"), pv: $("edPv"),
    habilidad: $("edHabilidad"), descripcion: $("edDescripcion"), fuente: $("edFuente"), lado: $("edLado"),
    limite: $("edLimite"), obtenible: $("edObtenible"), publicada: $("edPublicada")
  };
  let edActual = null; // { id, nueva, imagen, imagenOriginal, subidas:[], idManual }

  const slug = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const numeroOVacio = el => (el.value.trim() === "" ? null : Math.round(Number(el.value)));

  function llenarSelectoresDelEditor() {
    campos.tipo.innerHTML = window.CARTAS_TIPOS.map(t => `<option>${esc(t)}</option>`).join("");
    campos.rareza.innerHTML = Object.entries(window.CARTAS_RAREZAS).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
    const afin = Object.entries(window.CARTAS_AFINIDADES).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
    campos.af1.innerHTML = afin;
    campos.af2.innerHTML = `<option value="">(ninguna)</option>` + afin;
    const grupo = (titulo, clave) => `<optgroup label="${titulo}">${(window[clave] || []).map(e => `<option value="${clave}|${esc(e.id)}">${esc(e.title)}</option>`).join("")}</optgroup>`;
    campos.fuente.innerHTML = `<option value="">(ninguna)</option>${grupo("Personajes", "PERSONAJES")}${grupo("Bestiario", "BESTIARIO")}${grupo("Objetos", "OBJETOS")}`;
  }

  /* Lo que hay en el formulario ahora mismo, con la forma de una carta. */
  function cartaDelFormulario() {
    const f = campos.fuente.value ? campos.fuente.value.split("|") : null;
    const lado = campos.lado.value ? [campos.lado.value] : null;
    return {
      id: campos.id.value.trim(),
      nombre: campos.nombre.value.trim() || "Sin nombre",
      epiteto: campos.epiteto.value.trim(),
      tipo: campos.tipo.value,
      rareza: campos.rareza.value,
      afinidad: [campos.af1.value, campos.af2.value].filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i),
      coste: numeroOVacio(campos.coste) ?? 0,
      atq: numeroOVacio(campos.atq),
      pv: numeroOVacio(campos.pv),
      habilidad: campos.habilidad.value.trim(),
      descripcion: campos.descripcion.value.trim(),
      imagen: edActual ? edActual.imagen : null,
      fuente: f ? { data: f[0], id: f[1] } : null,
      lado,
      obtenible: campos.obtenible.checked,
      limite: numeroOVacio(campos.limite)
    };
  }

  function pintarVistaPrevia() {
    $("cartaEditorVista").innerHTML = htmlCarta(cartaDelFormulario(), true, 0, null);
    $("edImagenQuitar").disabled = !(edActual && edActual.imagen);
  }

  function abrirEditor(id) {
    const existente = id ? window.cartaPorId(id) : null;
    const c = existente || { id: "", nombre: "", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 1, atq: 1, pv: 1, habilidad: "", descripcion: "", imagen: null, fuente: null, lado: null, obtenible: true, limite: null };
    edActual = { id: existente ? existente.id : null, nueva: !existente, imagen: c.imagen || null, imagenOriginal: c.imagen || null, subidas: [], idManual: !!existente };
    $("cartaEditorTitulo").textContent = existente ? `Editar: ${c.nombre}` : "Nueva carta";
    campos.id.value = c.id;
    campos.id.disabled = !!existente;
    $("edIdEtiqueta").classList.toggle("hidden", !!existente);
    campos.nombre.value = c.nombre;
    campos.epiteto.value = c.epiteto || "";
    campos.tipo.value = c.tipo;
    campos.rareza.value = c.rareza;
    campos.af1.value = c.afinidad[0];
    campos.af2.value = c.afinidad[1] || "";
    campos.coste.value = c.coste;
    campos.atq.value = c.atq ?? "";
    campos.pv.value = c.pv ?? "";
    campos.habilidad.value = c.habilidad || "";
    campos.descripcion.value = c.descripcion || "";
    campos.fuente.value = c.fuente && c.fuente.data ? `${c.fuente.data}|${c.fuente.id}` : "";
    campos.lado.value = c.lado && c.lado.length === 1 ? c.lado[0] : "";
    campos.limite.value = c.limite ?? "";
    campos.obtenible.checked = c.obtenible !== false;
    campos.publicada.checked = !c.borrador;
    $("edBorrar").classList.toggle("hidden", !existente || idsBase.has(c.id));
    $("edEstado").textContent = "";
    $("edGuardar").disabled = false;
    detalleEl.close();
    pintarVistaPrevia();
    editorEl.showModal();
  }

  function cerrarEditor() {
    // Cancelar: las fotos subidas en este formulario nunca se guardaron en la carta
    if (edActual) edActual.subidas.forEach(u => CartasCliente.quitarImagen(u));
    edActual = null;
    if (editorEl.open) editorEl.close();
  }

  async function guardarEditor(ev) {
    ev.preventDefault();
    if (!edActual) return;
    const estado = $("edEstado");
    const datos = cartaDelFormulario();
    const id = edActual.nueva ? datos.id : edActual.id;
    if (!/^[a-z0-9-]{1,60}$/.test(id)) { estado.textContent = "El identificador solo admite minúsculas, números y guiones."; return; }
    if (edActual.nueva && window.cartaPorId(id)) { estado.textContent = "Ya existe una carta con ese identificador."; return; }
    if (!datos.afinidad.length) { estado.textContent = "Elige al menos una afinidad."; return; }
    if ((datos.atq === null) !== (datos.pv === null)) { estado.textContent = "Pon ataque y vida los dos, o ninguno."; return; }
    estado.textContent = "Guardando...";
    $("edGuardar").disabled = true;
    try {
      await CartasCliente.guardar(id, datos, campos.publicada.checked);
      if (edActual.imagenOriginal && edActual.imagenOriginal !== datos.imagen) CartasCliente.quitarImagen(edActual.imagenOriginal);
      const lista = window.CARTAS;
      const i = lista.findIndex(c => c.id === id);
      const guardada = Object.assign({}, i >= 0 ? lista[i] : {}, datos, { id, borrador: !campos.publicada.checked });
      if (i >= 0) lista[i] = guardada; else lista.push(guardada);
      edActual.subidas = []; // ya quedaron en uso
      edActual = null;
      editorEl.close();
      llenarFiltroTipo();
      pintar();
    } catch (e) {
      estado.textContent = `No se pudo guardar: ${e.message || e}`;
      $("edGuardar").disabled = false;
    }
  }

  async function borrarEditor() {
    if (!edActual || edActual.nueva) return;
    const c = window.cartaPorId(edActual.id);
    if (!confirm(`¿Borrar "${c.nombre}"? Solo se puede si nadie la ha tenido.`)) return;
    try {
      await CartasCliente.borrar(c.id);
      if (c.imagen) CartasCliente.quitarImagen(c.imagen);
      window.CARTAS.splice(window.CARTAS.indexOf(c), 1);
      edActual.subidas = [];
      edActual = null;
      editorEl.close();
      pintar();
    } catch (e) {
      $("edEstado").textContent = `No se pudo borrar: ${e.message || e}`;
    }
  }

  function prepararEditor() {
    llenarSelectoresDelEditor();
    $("cartaNueva").addEventListener("click", () => abrirEditor(null));
    $("cartaEditorCerrar").addEventListener("click", cerrarEditor);
    editorEl.addEventListener("cancel", ev => { ev.preventDefault(); cerrarEditor(); });
    $("cartaEditorForm").addEventListener("submit", guardarEditor);
    $("edBorrar").addEventListener("click", borrarEditor);
    Object.values(campos).forEach(el => el.addEventListener("input", pintarVistaPrevia));
    Object.values(campos).forEach(el => el.addEventListener("change", pintarVistaPrevia));
    // El identificador sigue al nombre hasta que se escribe a mano
    campos.nombre.addEventListener("input", () => {
      if (edActual && edActual.nueva && !edActual.idManual) campos.id.value = slug(campos.nombre.value);
    });
    campos.id.addEventListener("input", () => { if (edActual) edActual.idManual = true; });

    $("edImagen").addEventListener("change", async ev => {
      const archivo = ev.target.files[0];
      ev.target.value = "";
      if (!archivo || !edActual) return;
      const estado = $("edEstado");
      estado.textContent = "Subiendo la foto...";
      try {
        const url = await CartasCliente.subirImagen(archivo);
        if (!edActual) { CartasCliente.quitarImagen(url); return; }
        // Una foto nueva reemplaza a la de este formulario; si no estaba guardada, se borra ya
        if (edActual.imagen && edActual.subidas.includes(edActual.imagen)) CartasCliente.quitarImagen(edActual.imagen);
        edActual.subidas.push(url);
        edActual.imagen = url;
        estado.textContent = "";
        pintarVistaPrevia();
      } catch (e) {
        estado.textContent = `No se pudo subir la foto: ${e.message || e}`;
      }
    });
    $("edImagenQuitar").addEventListener("click", () => {
      if (!edActual) return;
      if (edActual.imagen && edActual.subidas.includes(edActual.imagen)) CartasCliente.quitarImagen(edActual.imagen);
      edActual.imagen = null;
      pintarVistaPrevia();
    });
  }

  /* ---- Eventos del álbum ---- */
  gridEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-id]");
    if (b) abrirDetalle(b.dataset.id);
  });
  detalleContenidoEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-editar]");
    if (b) abrirEditor(b.dataset.editar);
  });
  document.getElementById("cartaDetalleCerrar").addEventListener("click", () => detalleEl.close());
  detalleEl.addEventListener("click", ev => { if (ev.target === detalleEl) detalleEl.close(); });

  prepararFiltros();
  prepararEditor();
  pintar();

  (async function cargar() {
    // Quién eres y qué cartas hay guardadas en el servidor (lo editado reemplaza al catálogo base)
    const rol = await CartasCliente.verificarRol();
    puedeEditar = rol.puede;
    mostrarControlesDeEditor();
    await CartasCliente.cargarDefiniciones(puedeEditar);
    llenarFiltroTipo();
    pintar();

    try {
      propia = await CartasCliente.coleccion();
    } catch (e) {
      propia = null;
      const aviso = document.getElementById("cartasSesion");
      aviso.textContent = "No se pudo leer tu colección. Si eres el máster, corre scratchpad/cartas.sql en Supabase.";
      aviso.classList.remove("hidden");
      return;
    }
    document.getElementById("cartasSesion").classList.toggle("hidden", !!propia);
    pintar();
  })();
})();
