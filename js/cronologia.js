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
      <div class="modal-body">${cap.content}</div>
    </article>
  `).join("");
}

initLadoGate(renderCronologia);
