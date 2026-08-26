function modAbility(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function statCardHTML(s) {
  const vitals = [];
  if (s.pv !== undefined) vitals.push(["PV", s.pv]);
  if (s.ca !== undefined) vitals.push(["CA", s.ca]);
  if (s.velocidad) vitals.push(["Velocidad", s.velocidad]);
  if (s.nivel !== undefined) vitals.push(["Nivel", s.nivel]);

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
    <article class="stat-card">
      <div class="stat-card-header">
        <h3>${s.nombre}</h3>
        <p class="stat-card-role">${s.rol || ""}</p>
        ${s.raza ? `<p class="stat-card-race">${s.raza}</p>` : ""}
        ${linkHTML}
      </div>
      ${vitalsHTML}
      ${abilitiesHTML}
      ${equipoHTML}
      ${habilidadesHTML}
      ${estrategiaHTML}
    </article>
  `;
}

function renderStats() {
  const grid = document.getElementById("statGrid");
  const stats = window.STATS || [];
  grid.innerHTML = stats.map(statCardHTML).join("");
  const count = document.getElementById("resultCount");
  if (count) count.textContent = `${stats.length} fichas`;
}

document.getElementById("statGrid").addEventListener("click", e => {
  const btn = e.target.closest(".stat-card-link");
  if (!btn) return;
  const entry = ALL_ENTRIES.find(x => x.id === btn.dataset.personajeId);
  if (entry) openEntryModal(entry);
});

initAdminGate(renderStats);
