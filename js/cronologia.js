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

function renderCronologia(lado) {
  const fuente = lado === "A" ? window.CRONOLOGIA_A : window.CRONOLOGIA_B;
  const capitulos = [...(fuente || [])].sort((a, b) => a.orden - b.orden);

  if (!capitulos.length) {
    cronicaList.innerHTML = `
      <div class="empty-state">
        <h3>Todavía no hay capítulos</h3>
        <p>Esta versión de la cronología aún no tiene entradas registradas.</p>
      </div>
    `;
    return;
  }

  cronicaList.innerHTML = capitulos.map(cap => `
    <article class="cronica-capitulo">
      <p class="cronica-numero">${cap.numero}</p>
      <h3 class="cronica-titulo">${cap.title}</h3>
      <p class="cronica-fecha">${cap.fecha}</p>
      <div class="modal-body">${autoLinkEntidades(cap.content)}</div>
    </article>
  `).join("");
}

cronicaList.addEventListener("click", e => {
  const link = e.target.closest(".relation-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(item => item.id === link.dataset.id);
  if (entry) openEntryModal(entry);
});

initLadoGate(renderCronologia);
