function modAbility(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function statCardHTML(s) {
  const vitals = [];
  if (s.nivel !== undefined) vitals.push(["Nivel", s.nivel]);
  if (s.pv !== undefined) vitals.push(["PV", s.pv]);
  if (s.ca !== undefined) vitals.push(["CA", s.ca]);
  if (s.velocidad) vitals.push(["Velocidad", s.velocidad]);

  const vitalsHTML = vitals.length
    ? `<div class="stat-vitals">${vitals.map(([k, v]) => `<div class="stat-vital"><strong>${k}</strong>${v}</div>`).join("")}</div>`
    : "";

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

  const habilidadesHTML = s.habilidades && s.habilidades.length
    ? `<p class="stat-section-label">Habilidades</p>${s.habilidades.map(h => `
        <div class="stat-ability-item"><strong>${h.nombre}</strong><p>${h.descripcion}</p></div>`).join("")}`
    : "";

  const estrategiaHTML = s.estrategia
    ? `<p class="stat-estrategia">${s.estrategia}</p>`
    : "";

  const linkHTML = s.personajeId
    ? `<button type="button" class="stat-card-link" data-personaje-id="${s.personajeId}">Ver personaje →</button>`
    : "";

  return `
    <article class="stat-card" data-tipo="${s.tipo || ""}">
      <button type="button" class="stat-card-header">
        <div class="stat-card-heading">
          <h3>${s.nombre}</h3>
          <p class="stat-card-role">${s.rol || ""}</p>
          ${s.raza ? `<p class="stat-card-race">${s.raza}</p>` : ""}
        </div>
        <span class="stat-card-chevron">▾</span>
      </button>
      ${vitalsHTML}
      <div class="stat-card-body">
        ${abilitiesHTML}
        ${equipoHTML}
        ${habilidadesHTML}
        ${estrategiaHTML}
        ${linkHTML}
      </div>
    </article>
  `;
}

const state = { search: "", tipos: new Set(), nivelMin: null, nivelMax: null };

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

function renderStats() {
  const grid = document.getElementById("statGrid");
  const stats = filteredStats();
  grid.innerHTML = stats.map(statCardHTML).join("");
  const count = document.getElementById("resultCount");
  if (count) count.textContent = `${stats.length} ${stats.length === 1 ? "ficha" : "fichas"}`;
}

document.getElementById("statGrid").addEventListener("click", e => {
  const link = e.target.closest(".stat-card-link");
  if (link) {
    const entry = ALL_ENTRIES.find(x => x.id === link.dataset.personajeId);
    if (entry) openEntryModal(entry);
    return;
  }
  const header = e.target.closest(".stat-card-header");
  if (header) {
    header.closest(".stat-card").classList.toggle("expanded");
  }
});

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
    if (statSearch) statSearch.value = "";
    if (tipoFiltersBox) tipoFiltersBox.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
    if (nivelMinInput) nivelMinInput.value = "";
    if (nivelMaxInput) nivelMaxInput.value = "";
    renderStats();
  });
}

initAdminGate(() => {
  renderTipoFilters();
  renderStats();
});
