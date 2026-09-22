function renderTimeline() {
  const track = document.getElementById("timelineTrack");
  const arcos = [...(window.CRONOLOGIA_ARCOS || [])].sort((a, b) => a.orden - b.orden);

  track.innerHTML = arcos.map(arco => `
    <button type="button" class="timeline-node" data-arco-id="${arco.id}">
      <span class="timeline-node-fecha">${arco.fecha}</span>
      <span class="timeline-node-title">${arco.title}</span>
      <span class="timeline-node-resumen">${arco.resumen}</span>
    </button>
  `).join("");
}

function abrirArco(arcoId) {
  if (arcoId === "la-encomienda") {
    const section = document.getElementById("encomiendaSection");
    section.classList.remove("hidden");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.getElementById("timelineTrack").addEventListener("click", e => {
  const btn = e.target.closest("[data-arco-id]");
  if (!btn) return;
  abrirArco(btn.dataset.arcoId);
});

renderTimeline();

const cronicaList = document.getElementById("cronicaList");
const cronicaIndice = document.getElementById("cronicaIndice");
const cronicaExpandirTodo = document.getElementById("cronicaExpandirTodo");

// Cada capítulo arranca colapsado — la cronología ya tiene demasiados como
// para forzar un solo scroll gigante. El índice y "Expandir todo" son las
// dos formas de llegar a un capítulo puntual sin desplazarse a ciegas.
function renderCronologia(lado) {
  const fuente = lado === "A" ? window.CRONOLOGIA_A : window.CRONOLOGIA_B;
  const capitulos = [...(fuente || [])].sort((a, b) => a.orden - b.orden);

  if (!capitulos.length) {
    cronicaIndice.innerHTML = "";
    cronicaExpandirTodo.classList.add("hidden");
    cronicaList.innerHTML = `
      <div class="empty-state">
        <h3>Todavía no hay capítulos</h3>
        <p>Esta versión de la cronología aún no tiene entradas registradas.</p>
      </div>
    `;
    return;
  }

  cronicaExpandirTodo.classList.remove("hidden");
  cronicaExpandirTodo.textContent = "Expandir todo";

  cronicaIndice.innerHTML = capitulos.map(cap => `
    <button type="button" class="cronica-indice-link" data-ir-a="${cap.id}">${cap.numero}</button>
  `).join("");

  cronicaList.innerHTML = capitulos.map(cap => `
    <article class="cronica-capitulo" id="${cap.id}">
      <button type="button" class="cronica-capitulo-header" data-toggle-capitulo>
        <p class="cronica-numero">${cap.numero}</p>
        <h3 class="cronica-titulo">${cap.title}</h3>
        <p class="cronica-fecha">${cap.fecha}</p>
      </button>
      <div class="modal-body cronica-cuerpo hidden">${autoLinkEntidades(cap.content)}</div>
    </article>
  `).join("");

  abrirCapituloDesdeHash();
}

function abrirCapitulo(articulo) {
  articulo.classList.add("cronica-abierto");
  articulo.querySelector(".cronica-cuerpo").classList.remove("hidden");
}

function abrirCapituloDesdeHash() {
  const id = location.hash.slice(1);
  if (!id) return;
  const articulo = document.getElementById(id);
  if (!articulo || !articulo.classList.contains("cronica-capitulo")) return;
  abrirCapitulo(articulo);
  articulo.scrollIntoView({ behavior: "smooth", block: "start" });
}

cronicaIndice.addEventListener("click", e => {
  const btn = e.target.closest("[data-ir-a]");
  if (!btn) return;
  const articulo = document.getElementById(btn.dataset.irA);
  if (!articulo) return;
  abrirCapitulo(articulo);
  history.replaceState(null, "", `#${btn.dataset.irA}`);
  articulo.scrollIntoView({ behavior: "smooth", block: "start" });
});

cronicaExpandirTodo.addEventListener("click", () => {
  const hayColapsados = !!cronicaList.querySelector(".cronica-cuerpo.hidden");
  cronicaList.querySelectorAll(".cronica-capitulo").forEach(articulo => {
    articulo.classList.toggle("cronica-abierto", hayColapsados);
    articulo.querySelector(".cronica-cuerpo").classList.toggle("hidden", !hayColapsados);
  });
  cronicaExpandirTodo.textContent = hayColapsados ? "Colapsar todo" : "Expandir todo";
});

cronicaList.addEventListener("click", e => {
  const toggleBtn = e.target.closest("[data-toggle-capitulo]");
  if (toggleBtn) {
    const articulo = toggleBtn.closest(".cronica-capitulo");
    const cuerpo = articulo.querySelector(".cronica-cuerpo");
    const abriendo = cuerpo.classList.contains("hidden");
    articulo.classList.toggle("cronica-abierto", abriendo);
    cuerpo.classList.toggle("hidden", !abriendo);
    return;
  }

  const link = e.target.closest(".relation-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(item => item.id === link.dataset.id);
  if (entry) openEntryModal(entry);
});

initLadoGate(renderCronologia);
