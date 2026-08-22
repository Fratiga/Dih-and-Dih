const modal = document.getElementById("entryModal");
const modalContent = document.getElementById("modalContent");

const ALL_ENTRIES = [
  ...(window.ENTRIES || []),
  ...(window.PERSONAJES || []),
  ...(window.LUGARES || []),
  ...(window.FACCIONES || []),
  ...(window.PERGAMINOS || []),
  ...(window.ARMAS || []),
  ...(window.BESTIARIO || []),
  ...(window.RAZAS || []),
  ...(window.RELIGIONES || [])
];

function entryTitleById(id) {
  return ALL_ENTRIES.find(e => e.id === id)?.title || id;
}

function relationLink(id) {
  const found = ALL_ENTRIES.find(e => e.id === id);
  if (!found) return id;
  return `<button type="button" class="relation-link" data-id="${id}">${found.title}</button>`;
}

const PLACE_NAME_INDEX = (window.LUGARES || []).map(l => ({ id: l.id, title: l.title.toLowerCase() }));

function relationLinkFuzzy(text) {
  const match = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const baseName = (match ? match[1] : text).trim().toLowerCase();
  const found = PLACE_NAME_INDEX.find(l => l.title === baseName);
  if (!found) return text;
  return `<button type="button" class="relation-link" data-id="${found.id}">${text}</button>`;
}

function cardMeta(entry) {
  if (entry.category === "Personajes") {
    return [entry.raza, entry.faccion && entryTitleById(entry.faccion)].filter(Boolean).join(" · ");
  }
  if (entry.category === "Lugares" || entry.category === "Razas" || entry.category === "Religión") {
    return entry.region || "";
  }
  if (entry.category === "Facciones") {
    return [entry.tipo, entry.region].filter(Boolean).join(" · ");
  }
  if (entry.category === "Armas") {
    return entry.daño && entry.daño !== "—"
      ? [`${entry.daño} · ${entry.tipoDano}`, entry.escala].filter(Boolean).join(" · ")
      : "Especial";
  }
  if (entry.category === "Bestiario") {
    return [entry.raza, entry.clasificacion].filter(Boolean).join(" · ");
  }
  return "";
}

function modalExtraMeta(entry) {
  const rows = [];
  if (entry.category === "Personajes") {
    if (entry.titulo) rows.push(["Título", entry.titulo]);
    if (entry.raza) rows.push(["Raza", entry.raza]);
    if (entry.tipo) rows.push(["Tipo", entry.tipo]);
    if (entry.lugarOrigen) rows.push(["Lugar de origen", relationLink(entry.lugarOrigen)]);
    if (entry.ocupacion) rows.push(["Ocupación", entry.ocupacion]);
    if (entry.faccion) rows.push(["Facción", relationLink(entry.faccion)]);
    if (entry.primeraAparicion) rows.push(["Primera aparición", entry.primeraAparicion]);
    if (entry.relacionesConocidas?.length) {
      rows.push(["Relaciones conocidas", entry.relacionesConocidas
        .map(r => r.nota ? `${relationLink(r.id)} (${r.nota})` : relationLink(r.id))
        .join(", ")]);
    }
  } else if (entry.category === "Lugares" || entry.category === "Razas") {
    if (entry.region) rows.push(["Región", entry.region]);
    if (entry.gobierno) rows.push(["Gobierno", entry.gobierno]);
    if (entry.religionPredominante) rows.push(["Religión predominante", entry.religionPredominante]);
    if (entry.lugaresDestacados?.length) rows.push(["Lugares destacados", entry.lugaresDestacados.map(relationLinkFuzzy).join(", ")]);
  } else if (entry.category === "Facciones") {
    if (entry.tipo) rows.push(["Tipo", entry.tipo]);
    if (entry.region) rows.push(["Región", entry.region]);
    if (entry.ideologia) rows.push(["Ideología", entry.ideologia]);
    if (entry.miembrosConocidos?.length) rows.push(["Miembros conocidos", entry.miembrosConocidos.map(relationLink).join(", ")]);
    if (entry.relaciones?.length) {
      rows.push(["Relaciones", entry.relaciones
        .map(r => `${relationLink(r.id)} (${r.signo})`)
        .join(", ")]);
    }
  } else if (entry.category === "Armas") {
    if (entry.daño && entry.daño !== "—") rows.push(["Daño", entry.daño]);
    if (entry.tipoDano && entry.tipoDano !== "—") rows.push(["Tipo de daño", entry.tipoDano]);
    if (entry.escala) rows.push(["Escala con", entry.escala]);
    if (entry.alcance) rows.push(["Alcance", entry.alcance]);
    if (entry.peso) rows.push(["Peso", entry.peso]);
    if (entry.coste) rows.push(["Coste", entry.coste]);
    if (entry.propiedades?.length) rows.push(["Propiedades", entry.propiedades.join(", ")]);
  } else if (entry.category === "Bestiario") {
    if (entry.raza) rows.push(["Raza", entry.raza]);
    if (entry.clasificacion) rows.push(["Clasificación", entry.clasificacion]);
    if (entry.amenaza) rows.push(["Nivel de amenaza", entry.amenaza]);
    if (entry.region) rows.push(["Región habitual", relationLink(entry.region)]);
  } else if (entry.category === "Religión") {
    if (entry.simbolo) rows.push(["Símbolo", entry.simbolo]);
    if (entry.principio) rows.push(["Principio", entry.principio]);
    if (entry.region) rows.push(["Cultura de origen", entry.region]);
    if (entry.muerte) rows.push(["Visión de la muerte", entry.muerte]);
    if (entry.eternos) rows.push(["Visión de los Eternos", entry.eternos]);
  }
  if (!rows.length) return "";
  return `<p class="modal-meta">${rows.map(([k, v]) => `<strong>${k}:</strong> ${v}`).join("<br>")}</p>`;
}

function mapaLinkFor(entry) {
  if (entry.category !== "Lugares" || typeof window.mapaTienePin !== "function") return "";
  if (!window.mapaTienePin(entry.id)) return "";
  return `<button type="button" class="mapa-link" data-mapa-id="${entry.id}">📍 Ver en el mapa</button>`;
}

function openEntryModal(entry) {
  if (!entry) return;
  modalContent.innerHTML = `
    <div class="entry-type">${entry.category}</div>
    <h2>${entry.title}</h2>
    <p class="modal-meta">${entry.tags.join(" · ")}</p>
    ${modalExtraMeta(entry)}
    ${mapaLinkFor(entry)}
    <div class="modal-body">${entry.content}</div>
  `;
  modal.showModal();
}

document.getElementById("closeModal").addEventListener("click", () => modal.close());
modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });

modalContent.addEventListener("click", e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  e.preventDefault();
  const target = document.getElementById(link.getAttribute("href").slice(1));
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
});

modalContent.addEventListener("click", e => {
  const relLink = e.target.closest(".relation-link");
  if (!relLink) return;
  e.preventDefault();
  const relatedEntry = ALL_ENTRIES.find(item => item.id === relLink.dataset.id);
  if (relatedEntry) openEntryModal(relatedEntry);
});

modalContent.addEventListener("click", e => {
  const mapaLink = e.target.closest(".mapa-link");
  if (!mapaLink) return;
  e.preventDefault();
  if (typeof window.focusMapaPin === "function") window.focusMapaPin(mapaLink.dataset.mapaId);
});
