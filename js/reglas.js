function slugify(texto) {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderReglas() {
  const grid = document.getElementById("reglasGrid");
  grid.innerHTML = (window.REGLAS || []).map(grupo => `
    <article class="reglas-group${grupo.items.length >= 10 ? " wide" : ""}" id="reglas-${slugify(grupo.titulo)}">
      <h3>${grupo.titulo}</h3>
      <p class="reglas-desc">${grupo.descripcion}</p>
      <ul class="reglas-items">
        ${grupo.items.map(item => `
          <li>
            <span class="reglas-label">${item.label}</span>
            ${item.detalle ? `<span class="reglas-detail">${item.detalle}</span>` : ""}
          </li>
        `).join("")}
      </ul>
    </article>
  `).join("");
}

function renderReglasChips() {
  const chips = document.getElementById("reglasChips");
  if (!chips) return;
  chips.innerHTML = (window.REGLAS || []).map(grupo => `
    <button type="button" class="pill" data-target="reglas-${slugify(grupo.titulo)}">${grupo.titulo}</button>
  `).join("");
  chips.addEventListener("click", e => {
    const btn = e.target.closest("[data-target]");
    if (!btn) return;
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

renderReglas();
renderReglasChips();
