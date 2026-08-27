(function () {
  const MARQUEE_PAUSE_KEY = "marqueePaused";
  const marqueeEl = document.querySelector(".header-marquee");
  const toggleBtn = document.getElementById("marqueeToggle");

  function applyPausedState(paused) {
    if (marqueeEl) marqueeEl.classList.toggle("paused", paused);
    if (toggleBtn) {
      toggleBtn.textContent = paused ? "▶" : "⏸";
      toggleBtn.title = paused ? "Reanudar franjas" : "Detener franjas";
    }
  }

  applyPausedState(localStorage.getItem(MARQUEE_PAUSE_KEY) === "1");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const next = !marqueeEl.classList.contains("paused");
      localStorage.setItem(MARQUEE_PAUSE_KEY, next ? "1" : "0");
      applyPausedState(next);
    });
  }

  const trackA = document.getElementById("marqueeTrackA");
  const trackB = document.getElementById("marqueeTrackB");
  if (!trackA && !trackB) return;

  function poolVisible() {
    return (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).filter(entry => typeof entryEsVisible !== "function" || entryEsVisible(entry));
  }

  function escapeHtml(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cardHtml(entry) {
    return `
      <button type="button" class="marquee-card" data-id="${entry.id}">
        <span>${escapeHtml(entry.title)}</span>
        <small>${escapeHtml(entry.category)}</small>
      </button>
    `;
  }

  function fillTrack(track, entries) {
    if (!track || !entries.length) return;
    const html = entries.map(cardHtml).join("");
    track.innerHTML = html + html;
    track.addEventListener("click", e => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      const entry = (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).find(item => item.id === btn.dataset.id);
      if (entry && typeof openEntryModal === "function") openEntryModal(entry);
    });
  }

  const pool = shuffle(poolVisible());
  if (!pool.length) return;
  const mid = Math.ceil(pool.length / 2);
  fillTrack(trackA, pool.slice(0, mid));
  fillTrack(trackB, pool.slice(mid));
})();
