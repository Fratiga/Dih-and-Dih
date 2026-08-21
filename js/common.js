function prettyName(path) {
  const base = path.split("/").pop().split("\\").pop();
  return base.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
}

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ROTACION_KEY = "rotacionIndex";

function loadRotacionIndex(length) {
  const saved = parseInt(localStorage.getItem(ROTACION_KEY), 10);
  return Number.isInteger(saved) && saved >= 0 && saved < length ? saved : 0;
}

const rotacionState = { index: 0 };

function renderRotacion(rotacion) {
  const inner = document.getElementById("rotacionInner");
  const empty = document.getElementById("rotacionEmpty");
  if (!rotacion.length) {
    inner.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  rotacionState.index = loadRotacionIndex(rotacion.length);
  inner.innerHTML = rotacion.map((src, i) => `
    <img src="${src}" alt="" data-rot="${i}" class="${i === rotacionState.index ? "active" : ""}" loading="lazy">
  `).join("");
  if (rotacion.length > 1) {
    setInterval(() => {
      const imgs = inner.querySelectorAll("img");
      if (!imgs.length) return;
      const prev = rotacionState.index;
      rotacionState.index = (rotacionState.index + 1) % imgs.length;
      imgs[prev]?.classList.remove("active");
      imgs[rotacionState.index]?.classList.add("active");
      localStorage.setItem(ROTACION_KEY, rotacionState.index);
    }, 4500);
  }
}

renderRotacion(window.ROTACION || []);
