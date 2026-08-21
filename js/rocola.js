const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const volumeSlider = document.getElementById("volumeSlider");
const progressBar = document.getElementById("progressBar");
const currentTrackEl = document.getElementById("currentTrack");
const timeCurrent = document.getElementById("timeCurrent");
const timeTotal = document.getElementById("timeTotal");
const trackList = document.getElementById("trackList");
const trackCount = document.getElementById("trackCount");
const trackEmpty = document.getElementById("trackEmpty");

function renderTracks() {
  trackCount.textContent = `${MUSICA_TRACKS.length} ${MUSICA_TRACKS.length === 1 ? "pista" : "pistas"}`;
  if (!MUSICA_TRACKS.length) {
    trackList.innerHTML = "";
    trackEmpty.classList.remove("hidden");
    return;
  }
  trackEmpty.classList.add("hidden");
  const activeTrack = rocola.order[rocola.pos];
  trackList.innerHTML = MUSICA_TRACKS.map((t, i) => `
    <li data-track="${i}" class="${i === activeTrack ? "active" : ""}">
      <span class="track-name">${prettyName(t)}</span>
      <span class="track-duration" data-dur="${i}">--:--</span>
    </li>
  `).join("");
  MUSICA_TRACKS.forEach((t, i) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.src = t;
    probe.addEventListener("loadedmetadata", () => {
      const el = document.querySelector(`[data-dur="${i}"]`);
      if (el) el.textContent = fmtTime(probe.duration);
    });
  });
}

renderTracks();

if (audio) {
  volumeSlider.value = audio.volume;

  function updateJukeboxUI() {
    currentTrackEl.textContent = rocolaCurrentTrackName();
    playBtn.textContent = audio.paused ? "▶" : "❚❚";
    playBtn.title = audio.paused ? "Reproducir" : "Pausar";
    document.querySelectorAll("#trackList li").forEach((li, idx) => {
      li.classList.toggle("active", idx === rocola.order[rocola.pos]);
    });
  }

  playBtn.addEventListener("click", rocolaToggle);
  prevBtn.addEventListener("click", rocolaPrev);
  nextBtn.addEventListener("click", rocolaNext);

  audio.addEventListener("play", updateJukeboxUI);
  audio.addEventListener("pause", updateJukeboxUI);
  audio.addEventListener("loadstart", updateJukeboxUI);

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = fmtTime(audio.duration);
    progressBar.max = audio.duration || 100;
  });

  audio.addEventListener("timeupdate", () => {
    timeCurrent.textContent = fmtTime(audio.currentTime);
    if (!progressBar.matches(":active")) progressBar.value = audio.currentTime;
  });

  progressBar.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = parseFloat(progressBar.value);
  });

  volumeSlider.addEventListener("input", () => {
    audio.volume = parseFloat(volumeSlider.value);
  });

  trackList.addEventListener("click", e => {
    const li = e.target.closest("[data-track]");
    if (!li) return;
    rocolaLoadTrack(parseInt(li.dataset.track, 10), true);
  });

  updateJukeboxUI();
}
