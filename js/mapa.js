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

if (mapaBusqueda) {
  mapaBusqueda.addEventListener("input", () => {
    const consulta = normalizarTexto(mapaBusqueda.value.trim());
    mapaContainer.querySelectorAll(".mapa-pin").forEach(pin => {
      const coincide = !consulta || pin.dataset.nombre.includes(consulta);
      pin.classList.toggle("mapa-pin-oculto-busqueda", !coincide);
    });
  });
}
