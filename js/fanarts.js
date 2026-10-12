const fanartTodos = (window.FANARTS || [])
  .slice()
  // Orden alfabético (insensible a mayúsculas/acentos) por el nombre legible,
  // así no importa el orden en que las imágenes se agreguen a data/fanarts.js.
  .sort((a, b) => prettyName(a).localeCompare(prettyName(b), "es", { sensitivity: "base" }));

const fanartState = {
  fanarts: fanartTodos,
  lightboxIndex: -1,
  sideElegido: null,
  porSide: { A: fanartTodos, B: fanartTodos },
};
let fanartReparto = {};
let fanartOcultos = new Set();

const fanartSideGate = document.getElementById("fanartSideGate");
const fanartSection = document.getElementById("fanarts");
const fanartSideCambiar = document.getElementById("fanartSideCambiar");

/* Pantalla partida para elegir qué Side de fanarts ver, independiente
   de con qué cuenta hayas iniciado sesión ("quiero que todos puedan
   elegir"). Admin sigue viendo todo sin filtrar como antes (ya tiene
   su propia pantalla de gestión en admin.html). Sin fila en
   fanarts_side para un src = compartido, visible elijas lo que
   elijas (ver scratchpad/fanarts_side.sql). */
function construirGateFanarts() {
  const nombreA = (typeof LADO_NOMBRES !== "undefined") ? LADO_NOMBRES.A : "Side A";
  const nombreB = (typeof LADO_NOMBRES !== "undefined") ? LADO_NOMBRES.B : "Side B";
  fanartSideGate.innerHTML = `
    <button type="button" class="fanart-side-half" data-elegir-fanart-side="A">
      <div class="fanart-side-bg"></div>
      <div class="fanart-side-overlay"><span class="fanart-side-label">${nombreA}</span></div>
    </button>
    <button type="button" class="fanart-side-half" data-elegir-fanart-side="B">
      <div class="fanart-side-bg"></div>
      <div class="fanart-side-overlay"><span class="fanart-side-label">${nombreB}</span></div>
    </button>
  `;
  const shuffleTimers = new Map();
  const detenerShuffle = halfEl => {
    const t = shuffleTimers.get(halfEl);
    if (t) { clearInterval(t); shuffleTimers.delete(halfEl); }
  };
  const barajarShuffle = (halfEl, side) => {
    detenerShuffle(halfEl);
    const bg = halfEl.querySelector(".fanart-side-bg");
    const pool = fanartState.porSide[side] || fanartTodos;
    if (!pool.length) return;
    const tick = () => { bg.style.backgroundImage = `url("${encodeURI(pool[Math.floor(Math.random() * pool.length)])}")`; };
    tick();
    shuffleTimers.set(halfEl, setInterval(tick, 140));
  };
  fanartSideGate.querySelectorAll(".fanart-side-half").forEach(halfEl => {
    const side = halfEl.dataset.elegirFanartSide;
    halfEl.addEventListener("mouseenter", () => barajarShuffle(halfEl, side));
    halfEl.addEventListener("mouseleave", () => detenerShuffle(halfEl));
    halfEl.addEventListener("click", () => { detenerShuffle(halfEl); elegirFanartSide(side); });
  });
}

function elegirFanartSide(side) {
  fanartState.sideElegido = side;
  fanartSideGate.classList.add("hidden");
  fanartSection.classList.remove("hidden");
  fanartSideCambiar.classList.remove("hidden");
  aplicarFiltroFanarts();
}

function aplicarFiltroFanarts() {
  const lado = fanartState.sideElegido;
  fanartState.fanarts = fanartTodos.filter(src => {
    if (fanartOcultos.has(src)) return false;
    const side = fanartReparto[src];
    return !lado || !side || side === lado;
  });
  renderFanarts();
}

async function cargarRepartoFanarts() {
  const [reparto, ocultos, subidos] = await Promise.all([
    fanartsCargarSides().catch(() => ({})),
    fanartsCargarOcultos().catch(() => new Set()),
    fanartsCargarSubidos().catch(() => []),
  ]);
  // Los subidos desde el Admin se suman a los del repositorio
  const nuevos = subidos.filter(src => !fanartTodos.includes(src));
  if (nuevos.length) {
    fanartTodos.push(...nuevos);
    fanartTodos.sort((a, b) => prettyName(a).localeCompare(prettyName(b), "es", { sensitivity: "base" }));
  }
  fanartReparto = reparto;
  fanartOcultos = ocultos;
  const visibles = fanartTodos.filter(src => !fanartOcultos.has(src));
  fanartState.porSide = {
    A: visibles.filter(src => !fanartReparto[src] || fanartReparto[src] === "A"),
    B: visibles.filter(src => !fanartReparto[src] || fanartReparto[src] === "B"),
  };
  if (!fanartSection.classList.contains("hidden")) aplicarFiltroFanarts();
}

function iniciarFanartsPagina() {
  if (typeof esAdmin === "function" && esAdmin()) {
    fanartSideGate.classList.add("hidden");
    fanartSection.classList.remove("hidden");
    fanartState.fanarts = fanartTodos;
    renderFanarts();
    cargarRepartoFanarts();
    return;
  }
  construirGateFanarts();
  fanartSideGate.classList.remove("hidden");
  fanartSection.classList.add("hidden");
  cargarRepartoFanarts();
}

/* Subir fanarts desde esta misma página (solo Admin; lo comprueban las políticas del servidor, esto solo decide qué se ve) */
(function iniciarSubidaFanarts() {
  const entrada = document.getElementById("fanartArchivos");
  const selectSide = document.getElementById("fanartSideSubir");
  const estado = document.getElementById("fanartSubirEstado");
  if (!entrada || !selectSide) return;
  selectSide.innerHTML = `<option value="">Ambos</option><option value="A">${LADO_NOMBRES.A}</option><option value="B">${LADO_NOMBRES.B}</option>`;
  const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX = 10 * 1024 * 1024;
  let subiendo = false;

  async function subir(archivos) {
    if (subiendo || typeof esAdmin !== "function" || !esAdmin()) return;
    const lista = Array.from(archivos).filter(a => TIPOS.includes(a.type) && a.size <= MAX);
    const omitidos = archivos.length - lista.length;
    if (!lista.length) { estado.textContent = "Ninguna imagen válida (PNG, JPG, WebP o GIF de hasta 10 MB)."; return; }
    subiendo = true;
    let hechas = 0, fallo = "";
    for (const archivo of lista) {
      estado.textContent = `Subiendo ${hechas + 1} de ${lista.length}: ${archivo.name}`;
      try {
        await fanartsAdminSubir(archivo, selectSide.value || null);
        hechas += 1;
      } catch (err) {
        fallo = (err && err.message) || "error desconocido";
        break;
      }
    }
    subiendo = false;
    entrada.value = "";
    estado.textContent = `${hechas} subida${hechas === 1 ? "" : "s"}.`
      + (omitidos ? ` ${omitidos} omitida${omitidos === 1 ? "" : "s"} por tipo o tamaño.` : "")
      + (fallo ? ` Se detuvo: ${fallo}. ¿Corriste scratchpad/fanarts_subidos.sql en Supabase?` : "");
    if (hechas) await cargarRepartoFanarts();
  }

  entrada.addEventListener("change", () => { if (entrada.files.length) subir(entrada.files); });
  const zona = document.getElementById("fanarts");
  const hayArchivos = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
  ["dragenter", "dragover"].forEach(ev => zona.addEventListener(ev, e => { if (hayArchivos(e)) { e.preventDefault(); zona.classList.add("arrastrando"); } }));
  ["dragleave", "drop"].forEach(ev => zona.addEventListener(ev, e => { if (hayArchivos(e)) { e.preventDefault(); zona.classList.remove("arrastrando"); } }));
  zona.addEventListener("drop", e => { if (hayArchivos(e) && e.dataTransfer.files.length) subir(e.dataTransfer.files); });
})();

fanartSideCambiar.addEventListener("click", () => {
  fanartSection.classList.add("hidden");
  fanartSideGate.classList.remove("hidden");
});

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

iniciarFanartsPagina();
