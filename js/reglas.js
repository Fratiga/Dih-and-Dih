function renderReglas() {
  const grid = document.getElementById("reglasGrid");
  grid.innerHTML = (window.REGLAS || []).map(grupo => `
    <article class="reglas-group">
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

renderReglas();
