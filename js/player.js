const MUSICA_TRACKS = window.MUSICA || [];
const ROCOLA_KEY = "rocolaState";

function shuffleOrder(length) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadRocolaState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(ROCOLA_KEY) || "null");
  } catch { /* ignore corrupt state */ }
  const valid = saved
    && Array.isArray(saved.order)
    && saved.order.length === MUSICA_TRACKS.length
    && saved.order.every(i => Number.isInteger(i) && i >= 0 && i < MUSICA_TRACKS.length)
    && Number.isInteger(saved.pos) && saved.pos >= 0 && saved.pos < saved.order.length;
  if (valid) return saved;
  return { order: shuffleOrder(MUSICA_TRACKS.length), pos: 0, time: 0, playing: false, volume: 0.8 };
}

const rocola = loadRocolaState();

function saveRocolaState() {
  localStorage.setItem(ROCOLA_KEY, JSON.stringify(rocola));
}

let audio = null;
let lastSavedTime = 0;

if (MUSICA_TRACKS.length) {
  audio = document.createElement("audio");
  audio.id = "audioPlayer";
  audio.preload = "metadata";
  document.body.appendChild(audio);

  audio.volume = rocola.volume;
  audio.src = MUSICA_TRACKS[rocola.order[rocola.pos]];

  audio.addEventListener("loadedmetadata", () => {
    if (rocola.time > 0 && rocola.time < audio.duration) {
      audio.currentTime = rocola.time;
    }
  }, { once: true });

  if (rocola.playing) {
    audio.play().catch(() => { /* autoplay blocked, stays paused until a user click */ });
  }

  audio.addEventListener("play", () => { rocola.playing = true; saveRocolaState(); });
  audio.addEventListener("pause", () => { rocola.playing = false; saveRocolaState(); });
  audio.addEventListener("volumechange", () => { rocola.volume = audio.volume; saveRocolaState(); });
  audio.addEventListener("timeupdate", () => {
    if (Math.abs(audio.currentTime - lastSavedTime) >= 1) {
      lastSavedTime = audio.currentTime;
      rocola.time = audio.currentTime;
      saveRocolaState();
    }
  });
  audio.addEventListener("ended", () => rocolaNext());
  audio.addEventListener("error", () => rocolaNext());
  window.addEventListener("beforeunload", () => {
    rocola.time = audio.currentTime;
    saveRocolaState();
  });
}

function rocolaLoadByPos(pos, autoplay) {
  rocola.pos = (pos + rocola.order.length) % rocola.order.length;
  rocola.time = 0;
  audio.src = MUSICA_TRACKS[rocola.order[rocola.pos]];
  saveRocolaState();
  if (autoplay) audio.play().catch(() => {});
}

function rocolaLoadTrack(trackIndex, autoplay) {
  const pos = rocola.order.indexOf(trackIndex);
  if (pos === -1) return;
  rocolaLoadByPos(pos, autoplay);
}

function rocolaNext() {
  if (!audio) return;
  if (rocola.pos + 1 >= rocola.order.length) {
    rocola.order = shuffleOrder(MUSICA_TRACKS.length);
    rocolaLoadByPos(0, true);
  } else {
    rocolaLoadByPos(rocola.pos + 1, true);
  }
}

function rocolaPrev() {
  if (!audio) return;
  rocolaLoadByPos(rocola.pos - 1, true);
}

function rocolaToggle() {
  if (!audio) return;
  if (!audio.src) { rocolaLoadByPos(rocola.pos, true); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

function rocolaCurrentTrackName() {
  if (!audio || !MUSICA_TRACKS.length) return "Ninguna pista seleccionada";
  return prettyName(MUSICA_TRACKS[rocola.order[rocola.pos]]);
}

if (audio && !window.HIDE_MINI_PLAYER) {
  document.body.classList.add("has-mini-player");
  const bar = document.createElement("div");
  bar.className = "mini-player";
  bar.id = "miniPlayer";
  bar.innerHTML = `
    <button id="miniPrev" class="ctrl-button small" title="Anterior">⏮</button>
    <button id="miniPlay" class="ctrl-button primary small" title="Reproducir">▶</button>
    <button id="miniNext" class="ctrl-button small" title="Siguiente">⏭</button>
    <div class="mini-player-info">
      <span id="miniTrackName" class="mini-track-name"></span>
      <div class="mini-progress-row">
        <span id="miniTimeCurrent" class="mini-time">0:00</span>
        <input id="miniProgress" type="range" min="0" max="100" value="0" step="0.1">
        <span id="miniTimeTotal" class="mini-time">0:00</span>
      </div>
    </div>
    <div class="mini-volume-wrap">
      <span class="volume-icon">🔊</span>
      <input id="miniVolume" type="range" min="0" max="1" step="0.01" value="0.8">
    </div>
    <a href="rocola.html" class="mini-player-link" title="Abrir Rocola">🎵</a>
  `;
  document.body.appendChild(bar);

  const miniPlay = document.getElementById("miniPlay");
  const miniTrackName = document.getElementById("miniTrackName");
  const miniProgress = document.getElementById("miniProgress");
  const miniTimeCurrent = document.getElementById("miniTimeCurrent");
  const miniTimeTotal = document.getElementById("miniTimeTotal");
  const miniVolume = document.getElementById("miniVolume");

  miniVolume.value = audio.volume;

  document.getElementById("miniPrev").addEventListener("click", rocolaPrev);
  document.getElementById("miniNext").addEventListener("click", rocolaNext);
  miniPlay.addEventListener("click", rocolaToggle);

  miniProgress.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = parseFloat(miniProgress.value);
  });

  miniVolume.addEventListener("input", () => {
    audio.volume = parseFloat(miniVolume.value);
  });

  function updateMiniPlayer() {
    miniTrackName.textContent = rocolaCurrentTrackName();
    miniPlay.textContent = audio.paused ? "▶" : "❚❚";
    miniPlay.title = audio.paused ? "Reproducir" : "Pausar";
  }

  audio.addEventListener("play", updateMiniPlayer);
  audio.addEventListener("pause", updateMiniPlayer);
  audio.addEventListener("loadstart", updateMiniPlayer);
  audio.addEventListener("loadedmetadata", () => {
    miniTimeTotal.textContent = fmtTime(audio.duration);
    miniProgress.max = audio.duration || 100;
  });
  audio.addEventListener("timeupdate", () => {
    miniTimeCurrent.textContent = fmtTime(audio.currentTime);
    if (!miniProgress.matches(":active")) miniProgress.value = audio.currentTime;
  });
  updateMiniPlayer();
}
