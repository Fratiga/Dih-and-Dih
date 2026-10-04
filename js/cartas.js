/* Álbum de Cartas malditas. */
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
  // El admin puede ver todas las cartas sin que cuenten como suyas.
  const revelando = () => typeof esAdmin === "function" && esAdmin() && filtroReveladas.checked;

  let propia = null; // { cartas: Map, numeros: Map } o null sin sesión
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const iniciales = nombre => nombre.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";

  const cantidadDe = id => (propia && propia.cartas.get(id)) || 0;
  const numeros2 = n => String(n).padStart(2, "0");

  function htmlCarta(c, tengo, cantidad, numeros) {
    const rareza = window.CARTAS_RAREZAS[c.rareza];
    const afinidad = c.afinidad[0];
    const stats = c.atq === null ? "" : `<div class="carta-stats"><span class="atq">${c.atq} ATQ</span><span class="pv">${c.pv} PV</span></div>`;
    const marcaNumero = tengo && c.limite && numeros && numeros.length
      ? `<span class="carta-numero">${numeros.map(n => `${numeros2(n)}/${numeros2(c.limite)}`).join(" · ")}</span>` : "";
    const copias = tengo && cantidad > 1 ? `<span class="carta-copias">x${cantidad}</span>` : "";
    return `
      <button type="button" class="carta carta-rareza-${c.rareza} carta-af-${afinidad} ${tengo ? "" : "sin-tener"}" data-id="${c.id}" aria-label="${tengo ? esc(c.nombre) : "Carta sin descubrir"}">
        ${copias}${marcaNumero}
        <div class="carta-cabeza">
          <span class="carta-coste">${c.coste}</span>
          <span class="carta-nombre">${esc(c.nombre)}${c.epiteto ? `<small>${esc(c.epiteto)}</small>` : ""}</span>
        </div>
        <div class="carta-arte"><b>${esc(tengo ? iniciales(c.nombre) : "?")}</b></div>
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

  function abrirDetalle(id) {
    const c = window.cartaPorId(id);
    if (!c) return;
    const cantidad = cantidadDe(id);
    const tengo = cantidad > 0 || revelando();
    const numeros = propia && propia.numeros.get(id);
    const af = c.afinidad.map(a => window.CARTAS_AFINIDADES[a].nombre).join(" / ");
    const rareza = window.CARTAS_RAREZAS[c.rareza].nombre;
    const cuerpo = tengo
      ? `<h2>${esc(c.nombre)}${c.epiteto ? ` — ${esc(c.epiteto)}` : ""}</h2>
         <p class="carta-meta">${esc(c.tipo)} · ${esc(rareza)} · ${esc(af)}${c.limite ? ` · edición de ${c.limite}` : ""}</p>
         <p><strong>Habilidad.</strong> ${esc(c.habilidad)}</p>
         ${resumenFuente(c) ? `<p class="carta-resumen">${esc(resumenFuente(c))}</p>` : ""}
         <p class="carta-meta">${cantidad > 0 ? `Tienes ${cantidad} copia${cantidad === 1 ? "" : "s"}.` : "Vista de admin: no la tienes."}</p>`
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

  function prepararFiltros() {
    Object.entries(window.CARTAS_RAREZAS).forEach(([k, v]) => filtroRareza.insertAdjacentHTML("beforeend", `<option value="${k}">${v.nombre}</option>`));
    [...new Set(window.CARTAS.map(c => c.tipo))].forEach(t => filtroTipo.insertAdjacentHTML("beforeend", `<option value="${esc(t)}">${esc(t)}</option>`));
    Object.entries(window.CARTAS_AFINIDADES).forEach(([k, v]) => filtroAfinidad.insertAdjacentHTML("beforeend", `<option value="${k}" title="${esc(v.descripcion)}">${v.nombre}</option>`));
    if (typeof esAdmin === "function" && esAdmin()) {
      document.getElementById("filtroReveladasEtiqueta").classList.remove("hidden");
      try { filtroReveladas.checked = localStorage.getItem(CLAVE_REVELAR) !== "0"; } catch (e) { /* sin almacenamiento */ }
      filtroReveladas.addEventListener("change", () => {
        try { localStorage.setItem(CLAVE_REVELAR, filtroReveladas.checked ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      });
    }
    [filtroRareza, filtroTipo, filtroAfinidad, filtroTengo, filtroReveladas].forEach(el => el.addEventListener("change", pintar));
  }

  gridEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-id]");
    if (b) abrirDetalle(b.dataset.id);
  });
  document.getElementById("cartaDetalleCerrar").addEventListener("click", () => detalleEl.close());
  detalleEl.addEventListener("click", ev => { if (ev.target === detalleEl) detalleEl.close(); });

  prepararFiltros();
  pintar();

  (async function cargar() {
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
