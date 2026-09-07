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

  // Otro huevo de pascua: si insistís con Enter sobre una búsqueda que no
  // encuentra nada, a veces te manda igual a la puerta del Bufón — ver el
  // keydown de abajo, que es lo único que lo dispara (nunca en cada tecla).
  let sinResultadosActual = false;

  function mostrarSugerencias(consulta) {
    if (!sugerencias) return;
    const consultaNormalizada = normalizarTexto(consulta.trim());
    if (!consultaNormalizada) {
      sinResultadosActual = false;
      ocultarSugerencias();
      return;
    }

    function rango(entry) {
      const titulo = normalizarTexto(entry.title);
      if (titulo.startsWith(consultaNormalizada)) return 0;
      if (titulo.includes(consultaNormalizada)) return 1;
      return 2;
    }

    const coincidencias = poolVisible()
      .filter(entry => {
        const searchable = normalizarTexto([entry.title, entry.category, entry.summary, ...(entry.tags || [])].join(" "));
        return searchable.includes(consultaNormalizada);
      })
      .sort((a, b) => rango(a) - rango(b))
      .slice(0, 8);

    if (!coincidencias.length) {
      sugerencias.innerHTML = `<div class="global-search-empty">Sin resultados</div>`;
      sugerencias.classList.remove("hidden");
      sinResultadosActual = true;
      return;
    }

    sinResultadosActual = false;
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
      if (e.key === "Enter" && sinResultadosActual && input.value.trim().length >= 3) {
        if (Math.random() < 0.12) window.location.href = "secreto.html";
      }
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
      // 5% de las veces, en vez de una entrada al azar, manda directo a la
      // puerta del Bufón — un huevo de pascua más dentro de otro.
      if (Math.random() < 0.05) {
        window.location.href = "secreto.html";
        return;
      }
      const pool = poolVisible();
      if (!pool.length) return;
      const entry = pool[Math.floor(Math.random() * pool.length)];
      openEntryModal(entry);
    });
  }
})();
