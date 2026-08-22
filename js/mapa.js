const mapaContainer = document.getElementById("mapaContainer");
const mapaFiltros = document.getElementById("mapaFiltros");
const mapaBusqueda = document.getElementById("mapaBusqueda");

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const TIPO_INFO = {
  capital: { label: "Capital", claseTipo: "mapa-pin--capital" },
  catedral: { label: "Catedral", claseTipo: "mapa-pin--catedral" },
  fortaleza: { label: "Fortaleza / Torre", claseTipo: "mapa-pin--fortaleza" },
  aldea: { label: "Pueblo", claseTipo: "mapa-pin--aldea" },
  naturaleza: { label: "Naturaleza", claseTipo: "mapa-pin--naturaleza" },
  ciudad: { label: "Ciudad", claseTipo: "mapa-pin--ciudad" },
  reino: { label: "Reino", claseTipo: "mapa-pin--reino" },
  region: { label: "Región", claseTipo: "" }
};

function tipoDeLugar(lugar) {
  const tags = lugar.tags || [];
  if (tags.includes("capital")) return "capital";
  if (tags.includes("catedral")) return "catedral";
  if (tags.includes("fortaleza") || tags.includes("torre") || tags.includes("prisión")) return "fortaleza";
  if (tags.includes("aldea")) return "aldea";
  if (tags.includes("reino") || tags.includes("imperio") || tags.includes("provincia") || tags.includes("ciudad-estado")) return "reino";
  if (tags.includes("región") || tags.includes("continente")) return "region";
  if (tags.includes("isla") || tags.includes("bosque") || tags.includes("montaña") || tags.includes("volcán") || tags.includes("río") || tags.includes("lago") || tags.includes("naturaleza")) return "naturaleza";
  if (tags.includes("ciudad")) return "ciudad";
  return "region";
}

const MAPA_PINS_POR_LUGAR = new Map();
const MAPA_LUGARES_INDEX = [];

(window.MAPA_PUNTOS || []).forEach(punto => {
  const lugar = ALL_ENTRIES.find(e => e.id === punto.lugarId);
  if (!lugar) return;

  const tipo = tipoDeLugar(lugar);
  const info = TIPO_INFO[tipo];

  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "mapa-pin";
  if (info.claseTipo) pin.classList.add(info.claseTipo);
  pin.dataset.tipo = tipo;
  pin.dataset.lugarId = punto.lugarId;
  pin.style.left = `${punto.x}%`;
  pin.style.top = `${punto.y}%`;
  pin.title = lugar.title;
  pin.setAttribute("aria-label", lugar.title);
  pin.dataset.nombre = normalizarTexto(lugar.title);
  pin.addEventListener("click", () => openEntryModal(lugar));

  mapaContainer.appendChild(pin);
  MAPA_PINS_POR_LUGAR.set(punto.lugarId, pin);
  MAPA_LUGARES_INDEX.push({
    id: punto.lugarId,
    title: lugar.title,
    nombre: normalizarTexto(lugar.title),
    tipoLabel: info.label
  });
});

window.mapaTienePin = function (lugarId) {
  return MAPA_PINS_POR_LUGAR.has(lugarId);
};

window.focusMapaPin = function (lugarId) {
  const pin = MAPA_PINS_POR_LUGAR.get(lugarId);
  if (!pin) return false;
  modal.close();
  pin.classList.remove("mapa-pin-oculto-tipo", "mapa-pin-oculto-busqueda");
  pin.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  pin.classList.add("mapa-pin--highlight");
  setTimeout(() => pin.classList.remove("mapa-pin--highlight"), 2200);
  return true;
};

if (mapaFiltros) {
  mapaFiltros.addEventListener("change", e => {
    const checkbox = e.target.closest("[data-filtro-tipo]");
    if (!checkbox) return;
    const tipo = checkbox.dataset.filtroTipo;
    mapaContainer.querySelectorAll(`.mapa-pin[data-tipo="${tipo}"]`).forEach(pin => {
      pin.classList.toggle("mapa-pin-oculto-tipo", !checkbox.checked);
    });
  });
}

const mapaSugerencias = document.getElementById("mapaSugerencias");

function escapeHtml(texto) {
  return texto.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function resaltarCoincidencia(title, consultaNormalizada) {
  if (!consultaNormalizada) return escapeHtml(title);
  const nombreNormalizado = normalizarTexto(title);
  const inicio = nombreNormalizado.indexOf(consultaNormalizada);
  if (inicio === -1) return escapeHtml(title);
  const fin = inicio + consultaNormalizada.length;
  return `${escapeHtml(title.slice(0, inicio))}<mark>${escapeHtml(title.slice(inicio, fin))}</mark>${escapeHtml(title.slice(fin))}`;
}

function ocultarSugerencias() {
  mapaSugerencias.classList.add("hidden");
  mapaSugerencias.innerHTML = "";
}

function mostrarSugerencias(consultaNormalizada) {
  if (!consultaNormalizada) {
    ocultarSugerencias();
    return;
  }
  const coincidencias = MAPA_LUGARES_INDEX
    .filter(l => l.nombre.includes(consultaNormalizada))
    .slice(0, 8);

  if (!coincidencias.length) {
    ocultarSugerencias();
    return;
  }

  mapaSugerencias.innerHTML = coincidencias.map(l => `
    <button type="button" class="mapa-suggestion" data-lugar-id="${l.id}">
      ${resaltarCoincidencia(l.title, consultaNormalizada)}
      <small>${l.tipoLabel}</small>
    </button>
  `).join("");
  mapaSugerencias.classList.remove("hidden");
}

if (mapaBusqueda) {
  mapaBusqueda.addEventListener("input", () => {
    const consulta = normalizarTexto(mapaBusqueda.value.trim());
    mapaContainer.querySelectorAll(".mapa-pin").forEach(pin => {
      const coincide = !consulta || pin.dataset.nombre.includes(consulta);
      pin.classList.toggle("mapa-pin-oculto-busqueda", !coincide);
    });
    mostrarSugerencias(consulta);
  });

  mapaBusqueda.addEventListener("keydown", e => {
    if (e.key === "Escape") ocultarSugerencias();
  });

  mapaBusqueda.addEventListener("focus", () => {
    const consulta = normalizarTexto(mapaBusqueda.value.trim());
    mostrarSugerencias(consulta);
  });

  mapaSugerencias.addEventListener("click", e => {
    const btn = e.target.closest("[data-lugar-id]");
    if (!btn) return;
    const lugarId = btn.dataset.lugarId;
    const lugar = MAPA_LUGARES_INDEX.find(l => l.id === lugarId);
    if (lugar) mapaBusqueda.value = lugar.title;
    ocultarSugerencias();
    mapaContainer.querySelectorAll(".mapa-pin").forEach(pin => pin.classList.remove("mapa-pin-oculto-busqueda"));
    const entry = ALL_ENTRIES.find(e => e.id === lugarId);
    if (entry) openEntryModal(entry);
  });

  document.addEventListener("click", e => {
    if (e.target === mapaBusqueda || mapaSugerencias.contains(e.target)) return;
    ocultarSugerencias();
  });
}
