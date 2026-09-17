const fanartTodos = (window.FANARTS || [])
  .slice()
  // Orden alfabético (insensible a mayúsculas/acentos) por el nombre legible,
  // así no importa el orden en que las imágenes se agreguen a data/fanarts.js.
  .sort((a, b) => prettyName(a).localeCompare(prettyName(b), "es", { sensitivity: "base" }));

const fanartState = { fanarts: fanartTodos, lightboxIndex: -1 };

/* Filtra por Side apenas se sabe el reparto real (ver
   scratchpad/fanarts_side.sql) — sin fila para un src, sigue siendo
   compartido, visible para todos, igual que antes de que existiera
   este reparto. Admin ve siempre todo, sin filtrar (esAdmin() en
   js/lado.js). Arranca mostrando la lista completa sin esperar a la
   red, y la corrige en cuanto el reparto real llega — así no hay
   demora en la primera pintada. */
async function aplicarRepartoFanarts() {
  if (typeof esAdmin === "function" && esAdmin()) return;
  try {
    const reparto = await fanartsCargarSides();
    const miLado = (typeof ladoActual === "function") ? ladoActual() : null;
    fanartState.fanarts = fanartTodos.filter(src => {
      const side = reparto[src];
      return !side || side === miLado;
    });
    renderFanarts();
  } catch (err) {
    // Silencioso a propósito, igual que el resto de las llamadas a
    // Supabase — si falla, todos siguen viendo la lista completa.
  }
}

function renderFanarts() {
  const grid = document.getElementById("fanartGrid");
  const count = document.getElementById("fanartCount");
  const empty = document.getElementById("fanartEmpty");
  count.textContent = `${fanartState.fanarts.length} ${fanartState.fanarts.length === 1 ? "imagen" : "imágenes"}`;
  if (!fanartState.fanarts.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = fanartState.fanarts.map((src, i) => `
    <div class="fanart-card" data-fanart="${i}" title="${prettyName(src)}">
      <img src="${src}" alt="${prettyName(src)}" loading="lazy">
    </div>
  `).join("");
}

const lightboxEl = document.getElementById("lightbox");
const lbViewport = document.getElementById("lbViewport");
const lbImage = document.getElementById("lbImage");
const lbCaption = document.getElementById("lbCaption");
const lbZoom = initZoomPan(lbViewport, lbImage, { minScale: 1, maxScale: 5 });

function openLightbox(index) {
  if (!fanartState.fanarts.length) return;
  fanartState.lightboxIndex = (index + fanartState.fanarts.length) % fanartState.fanarts.length;
  const src = fanartState.fanarts[fanartState.lightboxIndex];
  lbZoom.reset();
  lbImage.src = src;
  lbImage.alt = prettyName(src);
  lbCaption.textContent = prettyName(src);
  lightboxEl.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightboxEl.classList.add("hidden");
  lbImage.src = "";
  document.body.style.overflow = "";
}

document.getElementById("fanartGrid").addEventListener("click", e => {
  const card = e.target.closest("[data-fanart]");
  if (!card) return;
  openLightbox(parseInt(card.dataset.fanart, 10));
});

document.getElementById("lbClose").addEventListener("click", closeLightbox);
document.getElementById("lbPrev").addEventListener("click", () => openLightbox(fanartState.lightboxIndex - 1));
document.getElementById("lbNext").addEventListener("click", () => openLightbox(fanartState.lightboxIndex + 1));

lightboxEl.addEventListener("click", e => { if (e.target === lightboxEl) closeLightbox(); });

document.addEventListener("keydown", e => {
  if (lightboxEl.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") openLightbox(fanartState.lightboxIndex - 1);
  if (e.key === "ArrowRight") openLightbox(fanartState.lightboxIndex + 1);
});

renderFanarts();
aplicarRepartoFanarts();
