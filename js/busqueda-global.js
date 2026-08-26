(function () {
  const input = document.getElementById("globalSearch");
  const sugerencias = document.getElementById("globalSearchSugerencias");
  const randomBtn = document.getElementById("globalRandomBtn");
  if (!input && !randomBtn) return;

  function poolVisible() {
    return (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).filter(entry => typeof entryEsVisible !== "function" || entryEsVisible(entry));
  }

  function escapeHtml(texto) {
    return texto.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function resaltarCoincidencia(title, consultaNormalizada) {
    if (!consultaNormalizada) return escapeHtml(title);
    const normalizado = normalizarTexto(title);
    const inicio = normalizado.indexOf(consultaNormalizada);
    if (inicio === -1) return escapeHtml(title);
    const fin = inicio + consultaNormalizada.length;
    return `${escapeHtml(title.slice(0, inicio))}<mark>${escapeHtml(title.slice(inicio, fin))}</mark>${escapeHtml(title.slice(fin))}`;
  }

  function ocultarSugerencias() {
    if (!sugerencias) return;
    sugerencias.classList.add("hidden");
    sugerencias.innerHTML = "";
  }

  function mostrarSugerencias(consulta) {
    if (!sugerencias) return;
    const consultaNormalizada = normalizarTexto(consulta.trim());
    if (!consultaNormalizada) {
      ocultarSugerencias();
      return;
    }

    const coincidencias = poolVisible()
      .filter(entry => {
        const searchable = normalizarTexto([entry.title, entry.category, entry.summary, ...(entry.tags || [])].join(" "));
        return searchable.includes(consultaNormalizada);
      })
      .slice(0, 8);

    if (!coincidencias.length) {
      sugerencias.innerHTML = `<div class="global-search-empty">Sin resultados</div>`;
      sugerencias.classList.remove("hidden");
      return;
    }

    sugerencias.innerHTML = coincidencias.map(entry => `
      <button type="button" class="global-search-suggestion" data-id="${entry.id}">
        ${resaltarCoincidencia(entry.title, consultaNormalizada)}
        <small>${entry.category}</small>
      </button>
    `).join("");
    sugerencias.classList.remove("hidden");
  }

  if (input) {
    input.addEventListener("input", () => mostrarSugerencias(input.value));
    input.addEventListener("focus", () => mostrarSugerencias(input.value));
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") ocultarSugerencias();
    });
  }

  if (sugerencias) {
    sugerencias.addEventListener("click", e => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      const entry = (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).find(item => item.id === btn.dataset.id);
      ocultarSugerencias();
      if (input) input.value = "";
      if (entry) openEntryModal(entry);
    });
  }

  document.addEventListener("click", e => {
    if (!input) return;
    if (e.target === input || (sugerencias && sugerencias.contains(e.target))) return;
    ocultarSugerencias();
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      const pool = poolVisible();
      if (!pool.length) return;
      const entry = pool[Math.floor(Math.random() * pool.length)];
      openEntryModal(entry);
    });
  }
})();
