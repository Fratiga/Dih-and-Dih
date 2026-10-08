/* =============================================================================
   AUTENTICACIÓN — wiring del login/registro. Llama a onSesion(session|null)
   cada vez que cambia el estado (incluido al cargar), para que
   fichas-ui.js decida qué mostrar. No sabe nada de personajes ni de
   Supabase directamente: todo eso vive en fichas-supabase.js.
============================================================================= */
function fichasInitAuthUI(onSesion) {
  const gate = document.getElementById("fichasAuthGate");
  const contenido = document.getElementById("fichasContent");
  const tabs = document.querySelectorAll(".fichas-auth-tab");
  const loginForm = document.getElementById("fichasLoginForm");
  const signupForm = document.getElementById("fichasSignupForm");
  const status = document.getElementById("fichasAuthStatus");
  const olvideBtn = document.getElementById("fichasOlvideBtn");
  const logoutBtn = document.getElementById("fichasLogoutBtn");
  const emailActual = document.getElementById("fichasEmailActual");

  function mostrarStatus(texto, tipo) {
    status.textContent = texto;
    status.className = "fichas-auth-status " + tipo;
  }
  function limpiarStatus() {
    status.className = "fichas-auth-status hidden";
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const esLogin = tab.dataset.authTab === "login";
      loginForm.classList.toggle("hidden", !esLogin);
      signupForm.classList.toggle("hidden", esLogin);
      limpiarStatus();
    });
  });

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("fichasLoginEmail").value.trim();
    const password = document.getElementById("fichasLoginPassword").value;
    mostrarStatus("Entrando...", "pendiente");
    try {
      await fichasIniciarSesion(email, password);
      limpiarStatus();
    } catch (err) {
      mostrarStatus(fichasTraducirErrorAuth(err), "error");
    }
  });

  signupForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("fichasSignupEmail").value.trim();
    const password = document.getElementById("fichasSignupPassword").value;
    mostrarStatus("Creando cuenta...", "pendiente");
    try {
      const { necesitaConfirmarEmail } = await fichasRegistrarse(email, password);
      if (necesitaConfirmarEmail) {
        mostrarStatus("Cuenta creada. Este proyecto pide confirmar el email antes de poder entrar. Revisa tu correo (puede tardar un rato o caer en spam) y después inicia sesión.", "ok");
      } else {
        limpiarStatus();
      }
    } catch (err) {
      mostrarStatus(fichasTraducirErrorAuth(err), "error");
    }
  });

  // Abre el aviso de "olvidé mi contraseña" con el email que ya hubiera escrito
  olvideBtn.addEventListener("click", () => {
    fichasOlvideContrasena(document.getElementById("fichasLoginEmail").value);
  });

  document.getElementById("fichasCambiarPassBtn").addEventListener("click", () => { fichasCambiarContrasena(); });

  logoutBtn.addEventListener("click", async () => {
    await fichasCerrarSesion();
  });

  fichasEnCambioDeSesion(session => {
    gate.classList.toggle("hidden", !!session);
    contenido.classList.toggle("hidden", !session);
    if (session) {
      // El nombre de usuario vive en js/lado.js (misma cuenta, tabla
      // "perfiles"). Puede no estar resuelto todavía en este instante, así
      // que se muestra el email como respaldo y se corrige solo apenas
      // termine de sincronizar.
      emailActual.textContent = (typeof nombreUsuario === "function" && nombreUsuario()) || session.user.email;
      if (typeof ladoSincronizarPromesa !== "undefined") {
        ladoSincronizarPromesa.then(() => {
          if (typeof nombreUsuario === "function" && nombreUsuario()) emailActual.textContent = nombreUsuario();
        });
      }
      loginForm.reset();
      signupForm.reset();
      limpiarStatus();
    }
    onSesion(session);
  });
}

/* fichasTraducirErrorAuth y fichasOlvideContrasena viven en js/fichas-supabase.js */
