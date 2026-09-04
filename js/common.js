function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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

/* Zoom/pan reutilizable para visores de imagen (mapa, lightbox de fanarts).
   viewportEl: caja de tamaño fijo con overflow:hidden — define la "ventana".
   targetEl: el elemento que se escala/mueve dentro de esa ventana (puede
   ser la imagen misma, o un contenedor que además tenga otros elementos
   posicionados en porcentaje, como los pines del mapa — al transformar el
   contenedor, todos sus hijos se mueven y escalan juntos). */
function initZoomPan(viewportEl, targetEl, opts = {}) {
  const minScale = opts.minScale ?? 1;
  const maxScale = opts.maxScale ?? 4;
  let scale = minScale;
  let tx = 0, ty = 0;
  let dragging = false, moved = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;

  function apply() {
    targetEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    viewportEl.classList.toggle("zoom-activo", scale > minScale);
  }

  function clamp() {
    const rect = viewportEl.getBoundingClientRect();
    const maxTx = (rect.width * (scale - 1)) / 2;
    const maxTy = (rect.height * (scale - 1)) / 2;
    tx = Math.min(maxTx, Math.max(-maxTx, tx));
    ty = Math.min(maxTy, Math.max(-maxTy, ty));
  }

  function setScale(nextScale, clientX, clientY) {
    nextScale = Math.min(maxScale, Math.max(minScale, nextScale));
    if (clientX !== undefined) {
      const rect = viewportEl.getBoundingClientRect();
      const originX = clientX - rect.left - rect.width / 2;
      const originY = clientY - rect.top - rect.height / 2;
      const ratio = nextScale / scale;
      tx = originX - (originX - tx) * ratio;
      ty = originY - (originY - ty) * ratio;
    }
    scale = nextScale;
    if (scale === minScale) { tx = 0; ty = 0; }
    clamp();
    apply();
  }

  viewportEl.addEventListener("wheel", e => {
    e.preventDefault();
    setScale(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });

  viewportEl.addEventListener("mousedown", e => {
    if (scale <= minScale) return;
    e.preventDefault();
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    viewportEl.classList.add("zoom-arrastrando");
  });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    moved = true;
    clamp();
    apply();
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    viewportEl.classList.remove("zoom-arrastrando");
  });
  // Si hubo arrastre real, que el click posterior no dispare otra cosa
  // (por ejemplo abrir/cerrar el lightbox) en el mismo elemento.
  viewportEl.addEventListener("click", e => {
    if (moved) { e.stopPropagation(); moved = false; }
  }, true);

  viewportEl.addEventListener("dblclick", e => {
    if (scale > minScale) setScale(minScale);
    else setScale(Math.min(maxScale, minScale * 2), e.clientX, e.clientY);
  });

  function touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }
  viewportEl.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > minScale) {
      dragging = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  }, { passive: true });
  viewportEl.addEventListener("touchmove", e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = touchDist(e.touches);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setScale(pinchStartScale * (dist / pinchStartDist), cx, cy);
    } else if (e.touches.length === 1 && dragging) {
      e.preventDefault();
      tx += e.touches[0].clientX - lastX;
      ty += e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      clamp();
      apply();
    }
  }, { passive: false });
  viewportEl.addEventListener("touchend", () => { dragging = false; });

  apply();

  return {
    reset() { scale = minScale; tx = 0; ty = 0; apply(); }
  };
}
