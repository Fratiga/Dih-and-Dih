const state = {
  search: "",
  tags: new Set()
};

const searchInput = document.getElementById("search");
const tagFilters = document.getElementById("tagFilters");
const entryGrid = document.getElementById("entryGrid");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");

const PAGE_CATEGORY = window.PAGE_CATEGORY || null;
const TAG_GROUPS = window.TAG_GROUPS || null;

const SCOPE_ENTRIES = PAGE_CATEGORY
  ? ALL_ENTRIES.filter(e => e.category === PAGE_CATEGORY)
  : ALL_ENTRIES;

function regionTagFor(entry) {
  return entry.category === "Bestiario" && entry.region ? entryTitleById(entry.region) : null;
}

function effectiveTags(entry) {
  const region = regionTagFor(entry);
  return region ? [...entry.tags, region] : entry.tags;
}

const tags = [...new Set(SCOPE_ENTRIES.flatMap(e => effectiveTags(e)))].sort();

function tagPill(tag) {
  return `<button class="pill tag-pill" data-tag="${tag}">${tag}</button>`;
}

function renderTagGroup(label, tagList) {
  return `
    <div class="tag-group">
      <h4>${label}</h4>
      <div class="pill-list">${tagList.map(tagPill).join("")}</div>
    </div>
  `;
}

if (TAG_GROUPS && TAG_GROUPS.groupByCategory) {
  const categories = [...new Set(SCOPE_ENTRIES.map(e => e.category))].sort();
  let html = "";
  for (const cat of categories) {
    const catTags = [...new Set(SCOPE_ENTRIES.filter(e => e.category === cat).flatMap(effectiveTags))].sort();
    if (catTags.length) html += renderTagGroup(cat, catTags);
  }
  tagFilters.innerHTML = html;
} else if (TAG_GROUPS) {
  const regionTags = [...new Set(SCOPE_ENTRIES.map(regionTagFor).filter(Boolean))].sort();
  const grouped = new Set();
  let html = "";
  for (const [label, list] of Object.entries(TAG_GROUPS.groups)) {
    const present = list.filter(t => tags.includes(t));
    present.forEach(t => grouped.add(t));
    if (present.length) html += renderTagGroup(label, present);
  }
  if (regionTags.length) {
    html += renderTagGroup(TAG_GROUPS.regionLabel || "Región", regionTags);
    regionTags.forEach(t => grouped.add(t));
  }
  const leftover = tags.filter(t => !grouped.has(t));
  if (leftover.length) html += renderTagGroup(TAG_GROUPS.otherLabel || "Otras características", leftover);
  tagFilters.innerHTML = html;
} else {
  tagFilters.innerHTML = tags.map(tagPill).join("");
}

searchInput.addEventListener("input", e => {
  state.search = e.target.value.toLowerCase().trim();
  renderCompendio();
});

tagFilters.addEventListener("click", e => {
  const btn = e.target.closest("[data-tag]");
  if (!btn) return;
  const tag = btn.dataset.tag;
  if (state.tags.has(tag)) {
    state.tags.delete(tag);
    btn.classList.remove("active");
  } else {
    state.tags.add(tag);
    btn.classList.add("active");
  }
  renderCompendio();
});

document.getElementById("clearFilters").addEventListener("click", () => {
  state.search = "";
  state.tags.clear();
  searchInput.value = "";
  tagFilters.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
  renderCompendio();
});

function filteredEntries() {
  return SCOPE_ENTRIES.filter(entry => {
    const eTags = effectiveTags(entry);
    const searchable = [
      entry.title,
      entry.category,
      entry.summary,
      entry.content,
      ...eTags
    ].join(" ").toLowerCase();
    const matchesSearch = !state.search || searchable.includes(state.search);
    const matchesTags = state.tags.size === 0 || [...state.tags].every(tag => eTags.includes(tag));
    return matchesSearch && matchesTags;
  });
}

function renderCompendio() {
  const entries = filteredEntries();
  resultCount.textContent = `${entries.length} ${entries.length === 1 ? "entrada" : "entradas"}`;
  emptyState.classList.toggle("hidden", entries.length !== 0);
  entryGrid.innerHTML = entries.map(entry => {
    const meta = cardMeta(entry);
    return `
      <article class="entry-card" data-id="${entry.id}">
        <div class="entry-type">${entry.category}</div>
        <h3>${entry.title}</h3>
        ${meta ? `<p>${meta}</p>` : ""}
        <p>${entry.summary}</p>
        <div class="tags">
          ${effectiveTags(entry).map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

entryGrid.addEventListener("click", e => {
  const card = e.target.closest("[data-id]");
  if (!card) return;
  const entry = ALL_ENTRIES.find(item => item.id === card.dataset.id);
  openEntryModal(entry);
});

renderCompendio();
