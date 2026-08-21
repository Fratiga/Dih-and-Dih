const LADO_KEY = "compendioLado";
const LADO_PASSWORDS = { A: "repampanos", B: "cambalache" };

function ladoActual() {
  return localStorage.getItem(LADO_KEY);
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

function initLadoGate(onUnlock) {
  const gate = document.getElementById("ladoGate");
  const mainContent = document.getElementById("ladoContent");
  const form = document.getElementById("ladoForm");
  const input = document.getElementById("ladoPassword");
  const error = document.getElementById("ladoError");
  const badge = document.getElementById("ladoBadge");
  const switchBtn = document.getElementById("ladoSwitch");

  function revelar(lado) {
    gate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    if (badge) badge.textContent = `Side ${lado}`;
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
      localStorage.removeItem(LADO_KEY);
      mainContent.classList.add("hidden");
      gate.classList.remove("hidden");
      input.value = "";
      input.focus();
    });
  }
}
