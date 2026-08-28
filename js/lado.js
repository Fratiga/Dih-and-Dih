const LADO_KEY = "compendioLado";
const LADO_PASSWORDS = { A: "repampanos", B: "cambalache" };
const ADMIN_KEY = "compendioAdmin";
const ADMIN_PASSWORD = "teamomivida";

function ladoActual() {
  return localStorage.getItem(LADO_KEY);
}

function esAdmin() {
  return localStorage.getItem(ADMIN_KEY) === "1";
}

let sustoAudio = null;
let sustoTimeout = null;

function ocultarSusto() {
  const overlay = document.getElementById("ladoSusto");
  if (overlay) overlay.classList.add("hidden");
  if (sustoAudio) {
    sustoAudio.pause();
    sustoAudio.currentTime = 0;
  }
  if (sustoTimeout) clearTimeout(sustoTimeout);
}

function dispararSusto() {
  const imagenes = window.JUMPSCARE_IMAGENES || [];
  const canciones = window.JUMPSCARE_CANCIONES || [];
  if (!imagenes.length && !canciones.length) return;

  let overlay = document.getElementById("ladoSusto");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ladoSusto";
    overlay.className = "lado-susto hidden";
    overlay.innerHTML = `<div id="ladoSustoBg" class="lado-susto-bg"></div><img id="ladoSustoImg" alt="">`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", ocultarSusto);
  }

  const img = document.getElementById("ladoSustoImg");
  const bg = document.getElementById("ladoSustoBg");
  if (imagenes.length) {
    const src = imagenes[Math.floor(Math.random() * imagenes.length)];
    img.src = src;
    img.classList.remove("hidden");
    bg.style.backgroundImage = `url("${src}")`;
    bg.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    bg.classList.add("hidden");
  }

  if (canciones.length) {
    if (!sustoAudio) sustoAudio = new Audio();
    sustoAudio.pause();
    sustoAudio.src = canciones[Math.floor(Math.random() * canciones.length)];
    sustoAudio.currentTime = 0;
    sustoAudio.volume = 1;
    sustoAudio.play().catch(() => { /* el navegador puede bloquear el autoplay */ });
  }

  overlay.classList.remove("hidden");
  overlay.classList.remove("lado-susto-shake");
  void overlay.offsetWidth;
  overlay.classList.add("lado-susto-shake");

  if (sustoTimeout) clearTimeout(sustoTimeout);
  sustoTimeout = setTimeout(ocultarSusto, 5000);
}

let bienvenidaTimeout = null;

function ocultarBienvenida() {
  const overlay = document.getElementById("ladoBienvenida");
  if (overlay) overlay.classList.add("hidden");
  if (bienvenidaTimeout) clearTimeout(bienvenidaTimeout);
}

function dispararBienvenida(srcElegido) {
  const imagenes = window.CONTRASENAS_IMAGENES || [];
  const src = srcElegido || imagenes[Math.floor(Math.random() * imagenes.length)];
  if (!src) return;

  let overlay = document.getElementById("ladoBienvenida");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ladoBienvenida";
    overlay.className = "lado-susto hidden";
    overlay.innerHTML = `<div id="ladoBienvenidaBg" class="lado-susto-bg"></div><img id="ladoBienvenidaImg" alt="">`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", ocultarBienvenida);
  }

  const img = document.getElementById("ladoBienvenidaImg");
  const bg = document.getElementById("ladoBienvenidaBg");
  img.src = src;
  bg.style.backgroundImage = `url("${src}")`;

  overlay.classList.remove("hidden");

  if (bienvenidaTimeout) clearTimeout(bienvenidaTimeout);
  bienvenidaTimeout = setTimeout(ocultarBienvenida, 2500);
}

function nombreSinExtension(ruta) {
  const archivo = ruta.split("/").pop();
  return archivo.replace(/\.[^.]+$/, "").toLowerCase();
}

function buscarImagenPorPalabraClave(valor) {
  const imagenes = window.CONTRASENAS_IMAGENES || [];
  const buscado = valor.toLowerCase();
  return imagenes.find(src => nombreSinExtension(src) === buscado);
}

function actualizarElementosAdminOnly() {
  const admin = esAdmin();
  document.querySelectorAll("[data-admin-only]").forEach(el => el.classList.toggle("hidden", !admin));
}
actualizarElementosAdminOnly();

function entryEsVisible(entry) {
  if (esAdmin()) return true;
  if (!entry.lado) return true;
  const lado = ladoActual();
  return !!lado && entry.lado.includes(lado);
}

function resolverIntentoLogin(value) {
  const imagenClave = buscarImagenPorPalabraClave(value);
  if (imagenClave) return { tipo: "imagen", src: imagenClave };
  if (value === ADMIN_PASSWORD) return { tipo: "admin" };
  const lado = Object.entries(LADO_PASSWORDS).find(([, v]) => v === value)?.[0];
  if (lado) return { tipo: "lado", lado };
  return null;
}

function initLadoGate(onUnlock) {
  const gate = document.getElementById("ladoGate");
  const mainContent = document.getElementById("ladoContent");
  const form = document.getElementById("ladoForm");
  const input = document.getElementById("ladoPassword");
  const error = document.getElementById("ladoError");
  const badge = document.getElementById("ladoBadge");
  const switchBtn = document.getElementById("ladoSwitch");
  const logoutBtn = document.getElementById("ladoAdminLogout");

  function revelar(lado) {
    gate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    if (badge) badge.textContent = esAdmin() ? `★ Admin — Side ${lado}` : `Side ${lado}`;
    actualizarElementosAdminOnly();
    onUnlock(lado);
  }

  const ladoGuardado = ladoActual();
  if (ladoGuardado) {
    revelar(ladoGuardado);
  } else {
    gate.classList.remove("hidden");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const value = input.value.trim();
    const resultado = resolverIntentoLogin(value);

    if (resultado?.tipo === "imagen") {
      error.classList.add("hidden");
      input.value = "";
      dispararBienvenida(resultado.src);
      return;
    }

    if (resultado?.tipo === "admin") {
      error.classList.add("hidden");
      input.value = "";
      localStorage.setItem(ADMIN_KEY, "1");
      const ladoInicial = ladoActual() || "A";
      localStorage.setItem(LADO_KEY, ladoInicial);
      revelar(ladoInicial);
      return;
    }

    if (resultado?.tipo === "lado") {
      error.classList.add("hidden");
      localStorage.setItem(LADO_KEY, resultado.lado);
      revelar(resultado.lado);
      return;
    }

    error.classList.remove("hidden");
    input.value = "";
    input.focus();
    dispararSusto();
  });

  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      if (esAdmin()) {
        const otroLado = ladoActual() === "A" ? "B" : "A";
        localStorage.setItem(LADO_KEY, otroLado);
        revelar(otroLado);
        return;
      }
      localStorage.removeItem(LADO_KEY);
      mainContent.classList.add("hidden");
      gate.classList.remove("hidden");
      input.value = "";
      input.focus();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(LADO_KEY);
      mainContent.classList.add("hidden");
      gate.classList.remove("hidden");
      input.value = "";
      input.focus();
      actualizarElementosAdminOnly();
    });
  }
}

function initAdminGate(onUnlock) {
  const gate = document.getElementById("adminGate");
  const mainContent = document.getElementById("adminContent");
  const form = document.getElementById("adminGateForm");
  const input = document.getElementById("adminGatePassword");
  const error = document.getElementById("adminGateError");
  const logoutBtn = document.getElementById("adminGateLogout");

  function revelar() {
    gate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    actualizarElementosAdminOnly();
    onUnlock();
  }

  if (esAdmin()) {
    revelar();
  } else {
    gate.classList.remove("hidden");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (input.value.trim() !== ADMIN_PASSWORD) {
      error.classList.remove("hidden");
      input.value = "";
      input.focus();
      dispararSusto();
      return;
    }
    error.classList.add("hidden");
    input.value = "";
    localStorage.setItem(ADMIN_KEY, "1");
    revelar();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_KEY);
      mainContent.classList.add("hidden");
      gate.classList.remove("hidden");
      input.value = "";
      input.focus();
      actualizarElementosAdminOnly();
    });
  }
}

function initGlobalLadoWidget() {
  const widget = document.getElementById("globalLadoWidget");
  if (!widget) return;

  const badge = document.getElementById("globalLadoBadge");
  const popover = document.getElementById("globalLadoPopover");
  const form = document.getElementById("globalLadoForm");
  const input = document.getElementById("globalLadoPassword");
  const error = document.getElementById("globalLadoError");
  const logoutBtn = document.getElementById("globalLadoLogout");
  // Opcional: si la página incluye este botón, un Admin puede alternar
  // Side A/B con un click, sin volver a escribir ninguna contraseña.
  // Páginas que no lo tengan en su markup simplemente no lo usan.
  const switchBtn = document.getElementById("globalLadoSwitch");

  function actualizarBadge() {
    const lado = ladoActual();
    const admin = esAdmin();
    badge.textContent = admin ? `★ Admin${lado ? ` — Side ${lado}` : ""}` : (lado ? `Side ${lado}` : "Iniciar sesión");
    badge.classList.toggle("is-active", !!lado || admin);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !lado && !admin);
    if (switchBtn) switchBtn.classList.toggle("hidden", !admin);
  }

  function cerrarPopover() {
    popover.classList.add("hidden");
  }

  badge.addEventListener("click", e => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
    if (!popover.classList.contains("hidden")) input.focus();
  });

  document.addEventListener("click", e => {
    if (!widget.contains(e.target)) cerrarPopover();
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const value = input.value.trim();
    const resultado = resolverIntentoLogin(value);

    if (resultado?.tipo === "imagen") {
      input.value = "";
      error.classList.add("hidden");
      dispararBienvenida(resultado.src);
      return;
    }

    if (resultado?.tipo === "admin") {
      localStorage.setItem(ADMIN_KEY, "1");
      if (!ladoActual()) localStorage.setItem(LADO_KEY, "A");
      input.value = "";
      error.classList.add("hidden");
      cerrarPopover();
      actualizarBadge();
      actualizarElementosAdminOnly();
      return;
    }

    if (resultado?.tipo === "lado") {
      localStorage.setItem(LADO_KEY, resultado.lado);
      input.value = "";
      error.classList.add("hidden");
      cerrarPopover();
      actualizarBadge();
      return;
    }

    error.classList.remove("hidden");
    input.value = "";
    dispararSusto();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", e => {
      e.stopPropagation();
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(LADO_KEY);
      actualizarBadge();
      actualizarElementosAdminOnly();
      cerrarPopover();
    });
  }

  if (switchBtn) {
    switchBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (!esAdmin()) return;
      const otroLado = ladoActual() === "A" ? "B" : "A";
      localStorage.setItem(LADO_KEY, otroLado);
      actualizarBadge();
    });
  }

  actualizarBadge();
}

initGlobalLadoWidget();
