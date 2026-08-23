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

function initLadoGate(onUnlock) {
  const gate = document.getElementById("ladoGate");
  const mainContent = document.getElementById("ladoContent");
  const form = document.getElementById("ladoForm");
  const input = document.getElementById("ladoPassword");
  const error = document.getElementById("ladoError");
  const badge = document.getElementById("ladoBadge");
  const switchBtn = document.getElementById("ladoSwitch");
  const logoutBtn = document.getElementById("ladoAdminLogout");

  function actualizarBotonesAdmin() {
    const admin = esAdmin();
    document.querySelectorAll("[data-admin-only]").forEach(el => el.classList.toggle("hidden", !admin));
  }

  function revelar(lado) {
    gate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    if (badge) badge.textContent = esAdmin() ? `★ Admin — Side ${lado}` : `Side ${lado}`;
    actualizarBotonesAdmin();
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

    const imagenClave = buscarImagenPorPalabraClave(value);
    if (imagenClave) {
      error.classList.add("hidden");
      input.value = "";
      dispararBienvenida(imagenClave);
      return;
    }

    if (value === ADMIN_PASSWORD) {
      error.classList.add("hidden");
      input.value = "";
      localStorage.setItem(ADMIN_KEY, "1");
      const ladoInicial = ladoActual() || "A";
      localStorage.setItem(LADO_KEY, ladoInicial);
      revelar(ladoInicial);
      return;
    }

    const lado = Object.entries(LADO_PASSWORDS).find(([, v]) => v === value)?.[0];
    if (!lado) {
      error.classList.remove("hidden");
      input.value = "";
      input.focus();
      dispararSusto();
      return;
    }
    error.classList.add("hidden");
    localStorage.setItem(LADO_KEY, lado);
    revelar(lado);
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
    });
  }
}
