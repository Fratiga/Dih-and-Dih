const fanartState = { fanarts: window.FANARTS || [], lightboxIndex: -1 };

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
const lbImage = document.getElementById("lbImage");
const lbCaption = document.getElementById("lbCaption");

function openLightbox(index) {
  if (!fanartState.fanarts.length) return;
  fanartState.lightboxIndex = (index + fanartState.fanarts.length) % fanartState.fanarts.length;
  const src = fanartState.fanarts[fanartState.lightboxIndex];
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
