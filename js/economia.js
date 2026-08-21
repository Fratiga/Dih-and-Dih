const economiaSearch = document.getElementById("economiaSearch");
const economiaBody = document.getElementById("economiaBody");
const economiaCount = document.getElementById("economiaCount");
const economiaCategorias = document.getElementById("economiaCategorias");

const state = { categoria: "" };

const categorias = [...new Set((window.ECONOMIA || []).map(item => item.categoria))];
economiaCategorias.innerHTML = [`<button class="pill active" data-categoria="">Todas</button>`]
  .concat(categorias.map(cat => `<button class="pill" data-categoria="${cat}">${cat}</button>`))
  .join("");

economiaCategorias.addEventListener("click", e => {
  const btn = e.target.closest("[data-categoria]");
  if (!btn) return;
  state.categoria = btn.dataset.categoria;
  economiaCategorias.querySelectorAll(".pill").forEach(b => b.classList.toggle("active", b === btn));
  renderEconomia();
});

function renderEconomia() {
  const term = economiaSearch.value.toLowerCase().trim();
  const items = (window.ECONOMIA || []).filter(item => {
    if (state.categoria && item.categoria !== state.categoria) return false;
    if (!term) return true;
    const searchable = [item.nombre, item.categoria, item.precio, item.nota || ""]
      .join(" ")
      .toLowerCase();
    return searchable.includes(term);
  });

  economiaCount.textContent = `${items.length} ${items.length === 1 ? "objeto" : "objetos"}`;

  if (!items.length) {
    economiaBody.innerHTML = `<tr><td class="economia-empty" colspan="4">No se encontraron objetos. Prueba con otro término.</td></tr>`;
    return;
  }

  economiaBody.innerHTML = items.map(item => `
    <tr>
      <td>${item.nombre}</td>
      <td>${item.categoria}</td>
      <td class="economia-precio">${item.precio}</td>
      <td class="economia-nota">${item.nota || ""}</td>
    </tr>
  `).join("");
}

economiaSearch.addEventListener("input", renderEconomia);

renderEconomia();
