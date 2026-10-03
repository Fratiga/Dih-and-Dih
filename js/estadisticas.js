const state = { search: "", tipos: new Set(), nivelMin: null, nivelMax: null, orden: "default", seleccion: new Set() };

function modAbility(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function statVitalsHTML(s) {
  const vitals = [];
  if (s.nivel !== undefined) vitals.push(["Nivel", s.nivel]);
  if (s.iniciativa) vitals.push(["Iniciativa", s.iniciativa]);
  if (s.pv !== undefined) vitals.push(["PV", s.pv]);
  if (s.ca !== undefined) vitals.push(["CA", s.ca]);
  if (s.velocidad) vitals.push(["Velocidad", s.velocidad]);

  return vitals.length
    ? `<div class="stat-vitals">${vitals.map(([k, v]) => `<div class="stat-vital"><strong>${k}</strong>${v}</div>`).join("")}</div>`
    : "";
}

function statCardHTML(s) {
  const elegida = state.seleccion.has(s.id);
  return `
    <article class="stat-card ${elegida ? "is-selected" : ""}" data-tipo="${s.tipo || ""}" data-stat-id="${s.id}">
      <button type="button" class="stat-card-select" data-select-stat title="Ver junto con otras fichas">${elegida ? "✓ Seleccionada" : "+ Comparar"}</button>
      <div class="stat-card-heading">
        <h3>${s.nombre}</h3>
        <p class="stat-card-role">${s.rol || ""}</p>
        ${s.raza ? `<p class="stat-card-race">${s.raza}</p>` : ""}
      </div>
      ${statVitalsHTML(s)}
      <p class="stat-card-hint">Ver ficha completa →</p>
    </article>
  `;
}

/* Sección "Para Roll20": cada habilidad convertida en comandos de chat, con
   botones para copiarlos (js/stats-roll20.js). */
function statRoll20HTML(s) {
  if (typeof statsR20Enemigo !== "function") return "";
  const e = statsR20Enemigo(s);
  const grupos = ["Acciones", "Rasgos", "Tiradas"].map(cat => {
    const items = e.items.filter(i => i.categoria === cat);
    if (!items.length) return "";
    const filas = items.map(i => {
      const botones = i.tieneModo
        ? `<button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.normal)}">Copiar</button>
           <button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.ventaja)}" title="Ventaja">Vent.</button>
           <button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.desventaja)}" title="Desventaja">Desv.</button>`
        : `<button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.normal)}">Copiar</button>`;
      return `<div class="stat-r20-fila"><span>${i.texto}</span><span class="stat-r20-botones">${botones}</span></div>`;
    }).join("");
    return `<p class="stat-r20-grupo">${cat}${cat === "Rasgos" ? " (se anuncian en el chat)" : ""}</p>${filas}`;
  }).join("");
  return `<p class="stat-section-label">Para Roll20</p><div class="stat-r20">${grupos}</div>`;
}

function escaparAtributo(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Copia el comando al portapapeles desde cualquiera de los dos diálogos. */
document.addEventListener("click", async e => {
  const boton = e.target.closest(".stat-r20-btn");
  if (!boton) return;
  const texto = boton.dataset.cmd;
  let ok = false;
  try { await navigator.clipboard.writeText(texto); ok = true; } catch (err) { /* sin permiso */ }
  if (!ok) { prompt("Copia este comando a mano:", texto); return; }
  const original = boton.textContent;
  boton.textContent = "✓";
  setTimeout(() => { boton.textContent = original; }, 1200);
});

/* Deja los enemigos (ya convertidos a comandos) y los que tengas marcados
   "+ Comparar" a la vista del script de Roll20 (roll20/compendio-roll20.user.js). */
function publicarEnemigosRoll20() {
  if (typeof statsR20Enemigo !== "function") return;
  try {
    const payload = {
      version: 1,
      actualizado: Date.now(),
      enemigos: (window.STATS || []).map(statsR20Enemigo),
      seleccion: [...state.seleccion]
    };
    localStorage.setItem("compendioRoll20Enemigos", JSON.stringify(payload));
    window.postMessage({ tipo: "compendio-roll20-enemigos", payload }, window.location.origin);
  } catch (e) { /* publicar es un extra, nunca debe romper la página */ }
}

function statModalHTML(s) {
  const abilitiesHTML = s.stats
    ? `<div class="stat-abilities">${["fue", "des", "con", "int", "sab", "car"].map(k => `
        <div class="stat-ability">
          <div class="stat-ability-label">${k.toUpperCase()}</div>
          <div class="stat-ability-score">${s.stats[k]}</div>
          <div class="stat-ability-mod">${modAbility(s.stats[k])}</div>
        </div>`).join("")}</div>`
    : "";

  const equipoHTML = s.equipo && s.equipo.length
    ? `<p class="stat-section-label">Equipo</p><p class="stat-equipo">${s.equipo.join(", ")}</p>`
    : "";

  const notasHTML = s.notas && s.notas.length
    ? `<p class="stat-section-label">Rasgos de Combate</p><ul class="stat-notas">${s.notas.map(n => `<li>${n}</li>`).join("")}</ul>`
    : "";

  const habilidadesHTML = s.habilidades && s.habilidades.length
    ? `<p class="stat-section-label">Habilidades</p>${s.habilidades.map(h => `
        <div class="stat-ability-item"><strong>${h.nombre}</strong><p>${h.descripcion}</p></div>`).join("")}`
    : "";

  const estrategiaHTML = s.estrategia
    ? `<p class="stat-estrategia">${s.estrategia}</p>`
    : "";

  const roll20HTML = statRoll20HTML(s);

  const linkHTML = s.personajeId
    ? `<button type="button" class="stat-card-link" data-personaje-id="${s.personajeId}">Ver personaje →</button>`
    : "";

  return `
    <div class="entry-type">Ficha de Combate</div>
    <h2>${s.nombre}</h2>
    <p class="modal-meta">${[s.rol, s.raza].filter(Boolean).join(" · ")}</p>
    ${statVitalsHTML(s)}
    ${abilitiesHTML}
    ${notasHTML}
    ${equipoHTML}
    ${habilidadesHTML}
    ${estrategiaHTML}
    ${roll20HTML}
    ${linkHTML}
  `;
}

function openStatModal(s) {
  modalContent.innerHTML = statModalHTML(s);
  modal.showModal();
}


function renderTipoFilters() {
  const box = document.getElementById("tipoFilters");
  if (!box) return;
  const tipos = [...new Set((window.STATS || []).map(s => s.tipo).filter(Boolean))].sort();
  box.innerHTML = tipos.map(t => `<button class="pill" data-tipo="${t}">${t}</button>`).join("");
}

function filteredStats() {
  const stats = window.STATS || [];
  return stats.filter(s => {
    const searchable = [s.nombre, s.rol, s.raza, s.tipo].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !state.search || searchable.includes(state.search);
    const matchesTipo = state.tipos.size === 0 || state.tipos.has(s.tipo);

    let matchesNivel = true;
    if (state.nivelMin !== null || state.nivelMax !== null) {
      const n = Number(s.nivel);
      matchesNivel = Number.isFinite(n)
        && (state.nivelMin === null || n >= state.nivelMin)
        && (state.nivelMax === null || n <= state.nivelMax);
    }

    return matchesSearch && matchesTipo && matchesNivel;
  });
}

function sortedByNivel(stats, dir = "desc") {
  return [...stats].sort((a, b) => {
    const na = Number(a.nivel), nb = Number(b.nivel);
    const fa = Number.isFinite(na), fb = Number.isFinite(nb);
    if (fa && fb) return dir === "asc" ? na - nb : nb - na;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });
}

function groupedByTipo(stats) {
  const groups = new Map();
  for (const s of stats) {
    const key = s.tipo || "Sin tipo";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderStats() {
  const grid = document.getElementById("statGrid");
  const stats = filteredStats();

  if (state.orden === "tipo") {
    grid.innerHTML = groupedByTipo(stats).map(([tipo, list]) => `
      <h3 class="stat-group-header">${tipo}</h3>
      ${sortedByNivel(list).map(statCardHTML).join("")}
    `).join("");
  } else if (state.orden === "nivel-desc") {
    grid.innerHTML = sortedByNivel(stats, "desc").map(statCardHTML).join("");
  } else if (state.orden === "nivel-asc") {
    grid.innerHTML = sortedByNivel(stats, "asc").map(statCardHTML).join("");
  } else {
    grid.innerHTML = stats.map(statCardHTML).join("");
  }

  const count = document.getElementById("resultCount");
  if (count) count.textContent = `${stats.length} ${stats.length === 1 ? "ficha" : "fichas"}`;
}

const compareBar = document.getElementById("statCompareBar");
const compareModal = document.getElementById("statCompareModal");
const compareContent = document.getElementById("statCompareContent");

function updateCompareBar() {
  const n = state.seleccion.size;
  compareBar.classList.toggle("hidden", n === 0);
  document.getElementById("statCompareCount").textContent = `${n} ${n === 1 ? "ficha seleccionada" : "fichas seleccionadas"}`;
  document.getElementById("statCompareOpen").disabled = n < 2;
  publicarEnemigosRoll20();
}

function openCompareModal() {
  const elegidas = (window.STATS || []).filter(s => state.seleccion.has(s.id));
  if (!elegidas.length) return;
  compareContent.innerHTML = elegidas.map(s => `<section class="stat-compare-col">${statModalHTML(s)}</section>`).join("");
  compareModal.showModal();
}

document.getElementById("statGrid").addEventListener("click", e => {
  const card = e.target.closest(".stat-card");
  if (!card) return;
  if (e.target.closest("[data-select-stat]")) {
    const id = card.dataset.statId;
    const ahora = !state.seleccion.has(id);
    if (ahora) state.seleccion.add(id); else state.seleccion.delete(id);
    card.classList.toggle("is-selected", ahora);
    e.target.closest("[data-select-stat]").textContent = ahora ? "✓ Seleccionada" : "+ Comparar";
    updateCompareBar();
    return;
  }
  const s = (window.STATS || []).find(x => x.id === card.dataset.statId);
  if (s) openStatModal(s);
});

document.getElementById("statCompareOpen").addEventListener("click", openCompareModal);
document.getElementById("statCompareClear").addEventListener("click", () => {
  state.seleccion.clear();
  document.querySelectorAll(".stat-card.is-selected").forEach(c => {
    c.classList.remove("is-selected");
    c.querySelector("[data-select-stat]").textContent = "+ Comparar";
  });
  updateCompareBar();
});
document.getElementById("statCompareClose").addEventListener("click", () => compareModal.close());
compareContent.addEventListener("click", e => {
  const link = e.target.closest(".stat-card-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(x => x.id === link.dataset.personajeId);
  if (!entry) return;
  compareModal.close();
  openEntryModal(entry);
});

modalContent.addEventListener("click", e => {
  const link = e.target.closest(".stat-card-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(x => x.id === link.dataset.personajeId);
  if (entry) openEntryModal(entry);
});

const ordenSelect = document.getElementById("ordenSelect");
if (ordenSelect) {
  ordenSelect.addEventListener("change", e => {
    state.orden = e.target.value;
    renderStats();
  });
}

const statSearch = document.getElementById("statSearch");
if (statSearch) {
  statSearch.addEventListener("input", e => {
    state.search = e.target.value.toLowerCase().trim();
    renderStats();
  });
}

const tipoFiltersBox = document.getElementById("tipoFilters");
if (tipoFiltersBox) {
  tipoFiltersBox.addEventListener("click", e => {
    const btn = e.target.closest("[data-tipo]");
    if (!btn) return;
    const tipo = btn.dataset.tipo;
    if (state.tipos.has(tipo)) {
      state.tipos.delete(tipo);
      btn.classList.remove("active");
    } else {
      state.tipos.add(tipo);
      btn.classList.add("active");
    }
    renderStats();
  });
}

const nivelMinInput = document.getElementById("nivelMin");
const nivelMaxInput = document.getElementById("nivelMax");
if (nivelMinInput) {
  nivelMinInput.addEventListener("input", e => {
    state.nivelMin = e.target.value === "" ? null : Number(e.target.value);
    renderStats();
  });
}
if (nivelMaxInput) {
  nivelMaxInput.addEventListener("input", e => {
    state.nivelMax = e.target.value === "" ? null : Number(e.target.value);
    renderStats();
  });
}

const clearStatFilters = document.getElementById("clearStatFilters");
if (clearStatFilters) {
  clearStatFilters.addEventListener("click", () => {
    state.search = "";
    state.tipos.clear();
    state.nivelMin = null;
    state.nivelMax = null;
    state.orden = "default";
    if (statSearch) statSearch.value = "";
    if (tipoFiltersBox) tipoFiltersBox.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
    if (nivelMinInput) nivelMinInput.value = "";
    if (nivelMaxInput) nivelMaxInput.value = "";
    if (ordenSelect) ordenSelect.value = "default";
    renderStats();
  });
}

initAdminGate(() => {
  publicarEnemigosRoll20();
  renderTipoFilters();
  renderStats();
});

activarFlechasNumericas(document.querySelector(".stat-level-range"));
