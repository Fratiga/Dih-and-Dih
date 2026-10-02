(function () {
  const canvas = document.getElementById("sacrificioCampo");
  const contadorEl = document.getElementById("sacrificioContador");
  const ctx = canvas.getContext("2d");
  const CLAVE = "compendioSacrificios";
  const CANTIDAD = 6;
  const ANCHO_SPRITE = 120;

  const imagen = new Image();
  imagen.src = "assets/cosas/slime-bruja.png";

  let total = 0;
  try { total = parseInt(localStorage.getItem(CLAVE), 10) || 0; } catch (e) { /* sin almacenamiento */ }

  let slimes = [];
  let particulas = [];
  let ancho = 0;
  let alto = 0;
  let ultimo = 0;

  function mensaje() {
    if (total === 0) return "Aún no has sacrificado a ninguno. El slime lo nota.";
    if (total < 10) return `${total} ${total === 1 ? "slime sacrificado" : "slimes sacrificados"}.`;
    if (total < 50) return `${total} slimes sacrificados. Los que quedan han empezado a mirarte.`;
    return `${total} slimes sacrificados. Ya no queda ninguno que no sepa tu nombre.`;
  }

  function actualizarTexto() {
    contadorEl.textContent = mensaje();
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, String(total)); } catch (e) { /* sin almacenamiento */ }
  }

  function ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    ancho = canvas.clientWidth;
    alto = canvas.clientHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function dimensiones() {
    const w = Math.min(ANCHO_SPRITE, ancho * 0.28);
    const ratio = imagen.naturalHeight && imagen.naturalWidth ? imagen.naturalHeight / imagen.naturalWidth : 0.74;
    return { w, h: w * ratio };
  }

  function nuevoSlime() {
    const { w, h } = dimensiones();
    const velocidad = 25 + Math.random() * 35;
    const angulo = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * Math.max(1, ancho - w),
      y: Math.random() * Math.max(1, alto - h),
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad * 0.6,
      fase: Math.random() * Math.PI * 2
    };
  }

  function iniciarCampo() {
    ajustarTamano();
    slimes = Array.from({ length: CANTIDAD }, nuevoSlime);
  }

  function sacrificar(indice) {
    const { w, h } = dimensiones();
    const s = slimes[indice];
    const cx = s.x + w / 2;
    const cy = s.y + h / 2;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      particulas.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        vida: 0.6 + Math.random() * 0.5, edad: 0,
        tam: 3 + Math.floor(Math.random() * 4),
        color: Math.random() < 0.5 ? "#4f9a3a" : "#7fc45a"
      });
    }
    slimes.splice(indice, 1);
    total += 1;
    guardar();
    actualizarTexto();
    setTimeout(() => { slimes.push(nuevoSlime()); }, 700);
  }

  function indiceBajo(x, y) {
    const { w, h } = dimensiones();
    for (let i = slimes.length - 1; i >= 0; i--) {
      const s = slimes[i];
      if (x >= s.x && x <= s.x + w && y >= s.y && y <= s.y + h) return i;
    }
    return -1;
  }

  function posicion(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("click", e => {
    const p = posicion(e);
    const i = indiceBajo(p.x, p.y);
    if (i >= 0) sacrificar(i);
  });

  canvas.addEventListener("mousemove", e => {
    const p = posicion(e);
    canvas.style.cursor = indiceBajo(p.x, p.y) >= 0 ? "pointer" : "default";
  });

  canvas.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && slimes.length) {
      e.preventDefault();
      sacrificar(Math.floor(Math.random() * slimes.length));
    }
  });

  function actualizar(dt) {
    const { w, h } = dimensiones();
    for (const s of slimes) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.fase += dt * 4;
      if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      if (s.x > ancho - w) { s.x = ancho - w; s.vx = -Math.abs(s.vx); }
      if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy); }
      if (s.y > alto - h) { s.y = alto - h; s.vy = -Math.abs(s.vy); }
    }
    for (const p of particulas) {
      p.edad += dt;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particulas = particulas.filter(p => p.edad < p.vida);
  }

  function dibujar() {
    ctx.clearRect(0, 0, ancho, alto);
    const { w, h } = dimensiones();
    for (const s of slimes) {
      const gelatina = 1 + Math.sin(s.fase) * 0.035;
      const dw = w / gelatina;
      const dh = h * gelatina;
      ctx.save();
      ctx.translate(s.x + w / 2, s.y + h);
      if (s.vx < 0) ctx.scale(-1, 1);
      ctx.drawImage(imagen, -dw / 2, -dh, dw, dh);
      ctx.restore();
    }
    for (const p of particulas) {
      ctx.globalAlpha = Math.max(0, 1 - p.edad / p.vida);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    ctx.globalAlpha = 1;
  }

  function cuadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
    ultimo = t;
    actualizar(dt);
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.addEventListener("resize", () => {
    ajustarTamano();
    const { w, h } = dimensiones();
    for (const s of slimes) {
      s.x = Math.min(s.x, Math.max(0, ancho - w));
      s.y = Math.min(s.y, Math.max(0, alto - h));
    }
  });

  actualizarTexto();
  iniciarCampo();
  requestAnimationFrame(cuadro);
})();
