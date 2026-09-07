/* =============================================================================
   SIDE A / SIDE B / ADMIN — unificado con las cuentas reales de Supabase
   (las mismas de "Mis personajes", ver js/fichas-supabase.js). Ya no hay
   contraseña compartida por bando: cada persona inicia sesión con su propia
   cuenta, elige su Side una vez (autoservicio, tabla "perfiles"), y el flag
   de Admin lo sigue controlando solo el dueño del proyecto por SQL (tabla
   "fichas_admins", ya existente — reusada acá, no es nueva).

   Diseño clave para no tener que tocar ningún otro archivo del sitio:
   ladoActual()/esAdmin() siguen siendo lecturas SÍNCRONAS de localStorage,
   exactamente como antes — compendio.js, modal.js, busqueda-global.js,
   header-marquee.js, huella-bufon.js, cronologia.js, etc. no cambian ni una
   línea. Lo único que cambia es CÓMO se llena ese localStorage: en vez de
   "contraseña correcta -> se guarda", ahora es "sesión de Supabase + fila de
   perfiles -> se guarda". La sincronización con Supabase es asíncrona por
   naturaleza (red de por medio); cuando el valor resuelto difiere del que ya
   estaba cacheado, se recarga la página una sola vez para que todo lo que
   renderiza de forma síncrona (grillas, admin-only, etc.) lo haga ya con el
   valor correcto — el mismo efecto que antes tenía "escribir la contraseña
   y que la página se actualice".
============================================================================= */
const LADO_KEY = "compendioLado";
const ADMIN_KEY = "compendioAdmin";
const USERNAME_KEY = "compendioUsername";

function ladoActual() {
  return localStorage.getItem(LADO_KEY);
}

function esAdmin() {
  return localStorage.getItem(ADMIN_KEY) === "1";
}

/* Distinto de esAdmin(): Admin ya no manda nada a Supabase (ver
   bufonRegistrar en js/bufon-supabase.js), así que sirve para
   previsualizar contenido pero NO para probar cómo se ve el Bufón para
   un jugador nuevo de verdad (Admin salta todos los gates). Modo
   prueba en cambio SÍ respeta los gates reales — juega como cualquier
   anónimo — pero marca cada fila que genera con es_prueba=true, para
   que ningún marcador de progreso (bufon_side_b_avanzo, el panel de
   Admin) la cuente. Se activa con Alt+Shift+P en secreto.html; no
   depende de esAdmin() a propósito, porque probar "como jugador nuevo"
   significa justamente NO estar en modo Admin. */
const MODO_PRUEBA_KEY = "compendioModoPrueba";

function esModoPrueba() {
  return localStorage.getItem(MODO_PRUEBA_KEY) === "1";
}

/* A diferencia del Side, el nombre de usuario NO es permanente — se pide
   al crear la cuenta (para no mostrar el email crudo por todos lados) pero
   se puede cambiar después desde el popover. */
function nombreUsuario() {
  return localStorage.getItem(USERNAME_KEY) || "";
}

/* --- Susto / jumpscare (sin cambios, lo sigue usando la palabra clave equivocada) --- */
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

function dispararSusto(duracionMs = 5000) {
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
  sustoTimeout = setTimeout(ocultarSusto, duracionMs);
}

/* --- "Contraseña mágica" -> imagen grande (sin cambios en la mecánica) --- */
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

/* =============================================================================
   SINCRONIZACIÓN CON SUPABASE — resuelve sesión + perfil (side) + admin, y
   cachea el resultado en los mismos localStorage de siempre. Si el valor
   cacheado ya estaba desactualizado, recarga una sola vez (misma idea que
   "escribir la contraseña actualiza la página", pero disparado por la
   sesión en vez de un submit).
============================================================================= */
const LADO_RECARGA_KEY = "compendioLadoRecargando";

async function ladoObtenerPerfilYAdmin() {
  const supabase = await fichasCliente();
  const [{ data: perfil }, { data: esAdminRPC }] = await Promise.all([
    supabase.from("perfiles").select("side, username").maybeSingle(),
    supabase.rpc("fichas_es_admin")
  ]);
  return { side: perfil?.side || null, username: perfil?.username || "", admin: !!esAdminRPC };
}

async function ladoGuardarSide(side) {
  const supabase = await fichasCliente();
  const { error } = await supabase.from("perfiles").upsert({ side });
  if (error) throw error;
}

async function ladoGuardarUsername(username) {
  const supabase = await fichasCliente();
  const { error } = await supabase.from("perfiles").upsert({ username });
  if (error) throw error;
}

/* El Side se elige al crear la cuenta y queda permanente: no hay forma de
   volver a elegirlo desde la interfaz (salvo el Admin, que sí puede
   cambiar el suyo para previsualizar ambos lados). El nombre de usuario en
   cambio NO es permanente, se puede cambiar después desde el popover — acá
   solo se pide una vez para no arrancar mostrando el email crudo. Si el
   proyecto exige confirmar el email, todavía no hay sesión activa en el
   momento del registro (RLS necesita auth.uid()), así que ambos quedan
   guardados acá nomás como "pendientes" y se aplican en el primer login
   exitoso. */
const LADO_SIDE_PENDIENTE_KEY = "ladoSidePendiente";
const LADO_USERNAME_PENDIENTE_KEY = "ladoUsernamePendiente";

async function ladoManejarSignupSubmit({ email, password, side, username }) {
  const { necesitaConfirmarEmail } = await fichasRegistrarse(email, password);
  if (necesitaConfirmarEmail) {
    localStorage.setItem(LADO_SIDE_PENDIENTE_KEY, side);
    localStorage.setItem(LADO_USERNAME_PENDIENTE_KEY, username);
    return { necesitaConfirmarEmail: true };
  }
  await ladoGuardarSide(side);
  await ladoGuardarUsername(username);
  localStorage.setItem(LADO_KEY, side);
  localStorage.setItem(USERNAME_KEY, username);
  return { necesitaConfirmarEmail: false };
}

/* Se llama una sola vez por carga de página. No bloquea nada: el resto del
   sitio sigue leyendo localStorage de forma síncrona como siempre — esto
   solo corrige ese caché si quedó desactualizado (login/logout/cambio de
   side hecho en otra pestaña, token vencido, etc.), y si corrige, recarga
   una vez para que todo vuelva a renderizar con el valor correcto. */
async function ladoSincronizar() {
  let session;
  try {
    session = await fichasSesionActual();
  } catch (e) {
    return; // sin conexión o Supabase no disponible: se queda con lo cacheado
  }

  const ladoCacheado = ladoActual();
  const adminCacheado = esAdmin();

  if (!session) {
    if (ladoCacheado || adminCacheado || nombreUsuario()) {
      localStorage.removeItem(LADO_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(USERNAME_KEY);
      recargarSiHaceFalta();
    }
    return;
  }

  try {
    let { side, username, admin } = await ladoObtenerPerfilYAdmin();

    // Cuenta creada con "confirmar email" activado: el Side/username
    // elegidos en el registro quedaron pendientes porque todavía no había
    // sesión para guardarlos. Este es el primer login real, así que se
    // aplican ahora.
    const sidePendiente = localStorage.getItem(LADO_SIDE_PENDIENTE_KEY);
    if (!side && sidePendiente) {
      try {
        await ladoGuardarSide(sidePendiente);
        side = sidePendiente;
      } catch (e) { /* se reintenta en la próxima sincronización */ }
      finally { localStorage.removeItem(LADO_SIDE_PENDIENTE_KEY); }
    }
    const usernamePendiente = localStorage.getItem(LADO_USERNAME_PENDIENTE_KEY);
    if (!username && usernamePendiente) {
      try {
        await ladoGuardarUsername(usernamePendiente);
        username = usernamePendiente;
      } catch (e) { /* se reintenta en la próxima sincronización */ }
      finally { localStorage.removeItem(LADO_USERNAME_PENDIENTE_KEY); }
    }

    const cambioLado = (side || null) !== (ladoCacheado || null);
    const cambioAdmin = admin !== adminCacheado;
    const cambioUsername = (username || "") !== nombreUsuario();
    if (side) localStorage.setItem(LADO_KEY, side); else localStorage.removeItem(LADO_KEY);
    if (username) localStorage.setItem(USERNAME_KEY, username); else localStorage.removeItem(USERNAME_KEY);
    localStorage.setItem(ADMIN_KEY, admin ? "1" : "0");
    if (cambioLado || cambioAdmin || cambioUsername) recargarSiHaceFalta();
  } catch (e) {
    // Silencioso: se queda con el último valor bueno cacheado.
  }
}

/* Evita loops de recarga infinita si por lo que sea el valor nunca
   converge (p. ej. RLS mal configurada) — recarga como máximo una vez por
   "sesión" de sessionStorage, no en cada carga de página. */
function recargarSiHaceFalta() {
  if (sessionStorage.getItem(LADO_RECARGA_KEY)) return;
  sessionStorage.setItem(LADO_RECARGA_KEY, "1");
  location.reload();
}

/* =============================================================================
   WIDGET DE CUENTA (header, en todas las páginas) — reemplaza el viejo
   formulario de contraseña por login/registro real + selector de Side.
============================================================================= */
/* Nombres visibles para cada Side — solo cosmético, la lógica interna
   sigue usando "A"/"B" en todos lados (entry.lado, RLS, etc.). */
const LADO_NOMBRES = {
  A: 'Side A ("oio sv")',
  B: 'Side B ("los dayo")'
};

function ladoAuthWidgetHTML() {
  return `
    <form id="ladoAuthLogin" class="lado-auth-form">
      <input type="email" id="ladoAuthEmail" placeholder="Email" required autocomplete="username">
      <input type="password" id="ladoAuthPassword" placeholder="Contraseña" required autocomplete="current-password">
      <button type="submit">Entrar</button>
      <button type="button" id="ladoAuthIrSignup" class="lado-auth-link">Crear cuenta</button>
    </form>
    <form id="ladoAuthSignup" class="lado-auth-form hidden">
      <input type="email" id="ladoAuthSignupEmail" placeholder="Email" required autocomplete="username">
      <input type="password" id="ladoAuthSignupPassword" placeholder="Contraseña (mínimo 6)" required minlength="6" autocomplete="new-password">
      <input type="text" id="ladoAuthSignupUsername" placeholder="Nombre de usuario" required maxlength="30" autocomplete="nickname">
      <fieldset class="lado-side-fieldset">
        <legend>Tu Side (permanente, no se puede cambiar después)</legend>
        <label><input type="radio" name="ladoAuthSignupSide" value="A" required> ${LADO_NOMBRES.A}</label>
        <label><input type="radio" name="ladoAuthSignupSide" value="B" required> ${LADO_NOMBRES.B}</label>
      </fieldset>
      <button type="submit">Crear cuenta</button>
      <button type="button" id="ladoAuthIrLogin" class="lado-auth-link">Ya tengo cuenta</button>
    </form>
    <p id="ladoAuthError" class="global-lado-error hidden">TE EQUIVOCASTESSS</p>
  `;
}

function ladoSidePickerHTML(ladoElegido) {
  return `
    <p class="lado-picker-texto">¿De qué Side eres?</p>
    <div class="lado-picker-botones">
      <button type="button" class="lado-picker-btn ${ladoElegido === "A" ? "is-active" : ""}" data-elegir-side="A">${LADO_NOMBRES.A}</button>
      <button type="button" class="lado-picker-btn ${ladoElegido === "B" ? "is-active" : ""}" data-elegir-side="B">${LADO_NOMBRES.B}</button>
    </div>
  `;
}

function initGlobalLadoWidget() {
  const widget = document.getElementById("globalLadoWidget");
  if (!widget) return;

  const badge = document.getElementById("globalLadoBadge");
  const popover = document.getElementById("globalLadoPopover");

  function cerrarPopover() {
    popover.classList.add("hidden");
  }

  async function pintarPopover() {
    let session;
    try { session = await fichasSesionActual(); } catch (e) { session = null; }

    if (!session) {
      popover.innerHTML = ladoAuthWidgetHTML();
      wirirFormsAuth();
      return;
    }

    const lado = ladoActual();
    // El Side se elige una sola vez, al crear la cuenta, y queda
    // permanente para cualquier jugador — así que acá solo se muestra un
    // selector interactivo en dos casos: el Admin (que sí puede
    // previsualizar ambos lados), o una cuenta vieja que quedó sin Side
    // guardado (caso borde, no debería pasar con cuentas nuevas). El
    // nombre de usuario en cambio SIEMPRE se puede editar acá, no es
    // permanente como el Side.
    const mostrarSelector = esAdmin() || !lado;
    popover.innerHTML = `
      <div class="lado-username-editar">
        <input type="text" id="ladoUsernameInput" value="${nombreUsuario()}" maxlength="30" placeholder="Nombre de usuario">
        <button type="button" id="ladoUsernameGuardar">Guardar</button>
      </div>
      ${mostrarSelector ? ladoSidePickerHTML(lado) : `<p class="lado-picker-texto">Side ${lado}</p>`}
      <button type="button" id="ladoAuthCerrarSesion" class="lado-auth-link">Cerrar sesión</button>
    `;
    if (mostrarSelector) {
      popover.querySelectorAll("[data-elegir-side]").forEach(btn => {
        btn.addEventListener("click", async () => {
          try {
            await ladoGuardarSide(btn.dataset.elegirSide);
            localStorage.setItem(LADO_KEY, btn.dataset.elegirSide);
            location.reload();
          } catch (e) { /* red caída: se queda como estaba */ }
        });
      });
    }
    document.getElementById("ladoUsernameGuardar").addEventListener("click", async () => {
      const nuevo = document.getElementById("ladoUsernameInput").value.trim();
      if (!nuevo) return;
      try {
        await ladoGuardarUsername(nuevo);
        localStorage.setItem(USERNAME_KEY, nuevo);
        actualizarBadge();
        cerrarPopover();
      } catch (e) { /* red caída: se queda como estaba */ }
    });
    document.getElementById("ladoAuthCerrarSesion").addEventListener("click", async () => {
      await fichasCerrarSesion();
      localStorage.removeItem(LADO_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(USERNAME_KEY);
      location.reload();
    });
  }

  function wirirFormsAuth() {
    const loginForm = document.getElementById("ladoAuthLogin");
    const signupForm = document.getElementById("ladoAuthSignup");
    const error = document.getElementById("ladoAuthError");

    document.getElementById("ladoAuthIrSignup").addEventListener("click", () => {
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    });
    document.getElementById("ladoAuthIrLogin").addEventListener("click", () => {
      signupForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });

    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("ladoAuthEmail").value.trim();
      const password = document.getElementById("ladoAuthPassword").value;
      try {
        await fichasIniciarSesion(email, password);
        error.classList.add("hidden");
        location.reload();
      } catch (err) {
        error.textContent = "Email o contraseña incorrectos.";
        error.classList.remove("hidden");
      }
    });

    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("ladoAuthSignupEmail").value.trim();
      const password = document.getElementById("ladoAuthSignupPassword").value;
      const username = document.getElementById("ladoAuthSignupUsername").value.trim();
      const side = signupForm.querySelector('input[name="ladoAuthSignupSide"]:checked')?.value;
      if (!username) {
        error.textContent = "Escribe un nombre de usuario antes de crear la cuenta.";
        error.classList.remove("hidden");
        return;
      }
      if (!side) {
        error.textContent = "Elige tu Side antes de crear la cuenta.";
        error.classList.remove("hidden");
        return;
      }
      try {
        const { necesitaConfirmarEmail } = await ladoManejarSignupSubmit({ email, password, side, username });
        if (necesitaConfirmarEmail) {
          error.classList.remove("hidden");
          error.textContent = "Cuenta creada. Confirma tu email y vuelve a entrar.";
        } else {
          location.reload();
        }
      } catch (err) {
        error.textContent = err.message || "Algo falló creando la cuenta.";
        error.classList.remove("hidden");
      }
    });
  }

  function actualizarBadge() {
    const lado = ladoActual();
    const admin = esAdmin();
    badge.textContent = admin ? `★ Admin${lado ? ` — Side ${lado}` : ""}` : (lado ? `Side ${lado}` : "Iniciar sesión");
    badge.classList.toggle("is-active", !!lado || admin);
  }

  badge.addEventListener("click", async e => {
    e.stopPropagation();
    const estabaAbierto = !popover.classList.contains("hidden");
    if (estabaAbierto) { cerrarPopover(); return; }
    popover.classList.remove("hidden");
    await pintarPopover();
  });

  document.addEventListener("click", e => {
    if (!widget.contains(e.target)) cerrarPopover();
  });

  actualizarBadge();
  ladoSincronizarPromesa.then(actualizarBadge);
}

/* =============================================================================
   WIDGET DE "CONTRASEÑAS MÁGICAS" — el chiste de las imágenes, ahora
   separado del login de verdad. No tiene nada que ver con Side/Admin.
============================================================================= */
function initClaveMagicaWidget() {
  const widget = document.getElementById("claveMagicaWidget");
  if (!widget) return;

  const badge = document.getElementById("claveMagicaBadge");
  const popover = document.getElementById("claveMagicaPopover");
  const form = document.getElementById("claveMagicaForm");
  const input = document.getElementById("claveMagicaInput");

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

  // Otra entrada escondida: cinco intentos fallidos seguidos (nunca uno
  // vacío) y el Bufón se apiada — un susto más corto de despedida y te
  // manda a la puerta, en vez del susto normal. Se reinicia con cualquier
  // acierto (Slappy, puerta, o una contraseña que sí funcione).
  let rachaFallos = 0;
  const RACHA_FALLOS_LIMITE = 5;

  form.addEventListener("submit", e => {
    e.preventDefault();
    const valor = input.value.trim();
    input.value = "";

    // "Slappy" no dispara la imagen normal: prende/apaga el propio Slappy
    // bailando en el header (ver js/slappy.js) — es un interruptor, no una
    // palabra clave más.
    if (valor.toLowerCase() === "slappy") {
      rachaFallos = 0;
      cerrarPopover();
      if (typeof toggleSlappy === "function") toggleSlappy();
      return;
    }

    // Otra entrada escondida más, esta sin ningún dato invisible que
    // encontrar por casualidad: hay que saber la palabra.
    if (valor.toLowerCase() === "puerta") {
      rachaFallos = 0;
      cerrarPopover();
      window.location.href = "secreto.html";
      return;
    }

    const imagenClave = buscarImagenPorPalabraClave(valor);
    if (imagenClave) {
      rachaFallos = 0;
      cerrarPopover();
      dispararBienvenida(imagenClave);
    } else if (valor) {
      rachaFallos++;
      if (rachaFallos >= RACHA_FALLOS_LIMITE) {
        rachaFallos = 0;
        cerrarPopover();
        if (typeof dispararSusto === "function") dispararSusto(1100);
        setTimeout(() => { window.location.href = "secreto.html"; }, 1200);
      } else {
        dispararSusto();
      }
    }
  });
}

/* =============================================================================
   GATES DE PÁGINA COMPLETA (cronologia.html, personajes.html) — ahora esperan
   la sincronización con Supabase antes de decidir si mostrar el gate o el
   contenido, en vez de mirar localStorage de entrada no más.
============================================================================= */
function initLadoGate(onUnlock) {
  const gate = document.getElementById("ladoGate");
  const mainContent = document.getElementById("ladoContent");
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

  function mostrarGateConLogin() {
    gate.innerHTML = `<div class="lado-gate-auth">${ladoAuthWidgetHTML()}</div>`;
    gate.classList.remove("hidden");
    const loginForm = gate.querySelector("#ladoAuthLogin");
    const signupForm = gate.querySelector("#ladoAuthSignup");
    const error = gate.querySelector("#ladoAuthError");
    gate.querySelector("#ladoAuthIrSignup").addEventListener("click", () => {
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    });
    gate.querySelector("#ladoAuthIrLogin").addEventListener("click", () => {
      signupForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        await fichasIniciarSesion(gate.querySelector("#ladoAuthEmail").value.trim(), gate.querySelector("#ladoAuthPassword").value);
        location.reload();
      } catch (err) {
        error.textContent = "Email o contraseña incorrectos.";
        error.classList.remove("hidden");
      }
    });
    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      const username = gate.querySelector("#ladoAuthSignupUsername").value.trim();
      const side = signupForm.querySelector('input[name="ladoAuthSignupSide"]:checked')?.value;
      if (!username) {
        error.textContent = "Escribe un nombre de usuario antes de crear la cuenta.";
        error.classList.remove("hidden");
        return;
      }
      if (!side) {
        error.textContent = "Elige tu Side antes de crear la cuenta.";
        error.classList.remove("hidden");
        return;
      }
      try {
        const { necesitaConfirmarEmail } = await ladoManejarSignupSubmit({
          email: gate.querySelector("#ladoAuthSignupEmail").value.trim(),
          password: gate.querySelector("#ladoAuthSignupPassword").value,
          side,
          username
        });
        error.classList.remove("hidden");
        error.textContent = necesitaConfirmarEmail ? "Cuenta creada. Confirma tu email y vuelve a entrar." : "Cuenta creada.";
        if (!necesitaConfirmarEmail) location.reload();
      } catch (err) {
        error.textContent = err.message || "Algo falló creando la cuenta.";
        error.classList.remove("hidden");
      }
    });
  }

  function mostrarGateConSidePicker() {
    gate.innerHTML = `<div class="lado-gate-auth">${ladoSidePickerHTML(null)}</div>`;
    gate.classList.remove("hidden");
    gate.querySelectorAll("[data-elegir-side]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await ladoGuardarSide(btn.dataset.elegirSide);
          localStorage.setItem(LADO_KEY, btn.dataset.elegirSide);
          location.reload();
        } catch (e) { /* red caída */ }
      });
    });
  }

  (async () => {
    await ladoSincronizarPromesa;
    const lado = ladoActual();
    if (lado) { revelar(lado); return; }

    let session;
    try { session = await fichasSesionActual(); } catch (e) { session = null; }
    if (session) mostrarGateConSidePicker();
    else mostrarGateConLogin();
  })();

  // El Side es permanente para cualquier jugador — este botón solo hace
  // algo si sos Admin (para poder previsualizar los dos lados). El markup
  // ya lo esconde con data-admin-only; esto es además una segunda barrera
  // por si el click llega igual.
  if (switchBtn) {
    switchBtn.addEventListener("click", async () => {
      if (!esAdmin()) return;
      const otroLado = ladoActual() === "A" ? "B" : "A";
      try {
        await ladoGuardarSide(otroLado);
        localStorage.setItem(LADO_KEY, otroLado);
        location.reload();
      } catch (e) { /* red caída */ }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fichasCerrarSesion();
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(LADO_KEY);
      location.reload();
    });
  }
}

/* estadisticas.html: admin puro, sin Side de por medio. */
function initAdminGate(onUnlock) {
  const gate = document.getElementById("adminGate");
  const mainContent = document.getElementById("adminContent");
  const logoutBtn = document.getElementById("adminGateLogout");

  function revelar() {
    gate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    actualizarElementosAdminOnly();
    onUnlock();
  }

  function mostrarGateConLogin() {
    gate.innerHTML = `<div class="lado-gate-auth">
      <p class="lado-picker-texto">Esta sección es solo para el Admin.</p>
      ${ladoAuthWidgetHTML()}
    </div>`;
    gate.classList.remove("hidden");
    const loginForm = gate.querySelector("#ladoAuthLogin");
    // No tiene sentido ofrecer "crear cuenta" desde el gate de Admin — el
    // formulario de registro ya arranca oculto (ver ladoAuthWidgetHTML), acá
    // solo hace falta esconder el link que lo mostraría.
    gate.querySelector("#ladoAuthIrSignup").classList.add("hidden");
    const error = gate.querySelector("#ladoAuthError");
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        await fichasIniciarSesion(gate.querySelector("#ladoAuthEmail").value.trim(), gate.querySelector("#ladoAuthPassword").value);
        location.reload();
      } catch (err) {
        error.textContent = "Email o contraseña incorrectos.";
        error.classList.remove("hidden");
      }
    });
  }

  function mostrarGateSinPermiso() {
    gate.innerHTML = `<div class="lado-gate-auth"><p class="lado-picker-texto">Tu cuenta no tiene permiso de Admin.</p></div>`;
    gate.classList.remove("hidden");
  }

  (async () => {
    await ladoSincronizarPromesa;
    if (esAdmin()) { revelar(); return; }

    let session;
    try { session = await fichasSesionActual(); } catch (e) { session = null; }
    if (session) mostrarGateSinPermiso();
    else mostrarGateConLogin();
  })();

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fichasCerrarSesion();
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(LADO_KEY);
      location.reload();
    });
  }
}

/* Corre siempre, tenga o no la página un widget visible — páginas como
   secreto.html no tienen #globalLadoWidget en su markup pero SÍ dependen de
   ladoActual()/esAdmin() como barrera de spoilers, así que la
   sincronización no puede depender de que exista el widget. */
const ladoSincronizarPromesa = ladoSincronizar();

initGlobalLadoWidget();
initClaveMagicaWidget();

/* =============================================================================
   DOS ENTRADAS ESCONDIDAS MÁS, ninguna pedida a propósito: hay que
   quedarse quieto, o pasar por acá a la hora justa. Ambas usan el mismo
   truco visual que la puerta de index.html (un punto invisible), pero en
   lugares y bajo condiciones distintas para no ser la misma cosa repetida.
============================================================================= */
function crearPuntoOculto(elemento, id) {
  if (!elemento || document.getElementById(id)) return;
  const punto = document.createElement("a");
  punto.href = "secreto.html";
  punto.id = id;
  punto.className = "huella-oculta";
  punto.textContent = ".";
  punto.setAttribute("aria-hidden", "true");
  punto.setAttribute("tabindex", "-1");
  elemento.appendChild(punto);
}

/* Silencio prolongado: sin mouse, teclado ni scroll durante varios
   minutos, aparece un punto invisible pegado al subtítulo, y la pestaña
   del navegador cambia de título como pista silenciosa. No pasa nada si
   la pestaña está en segundo plano cuando se cumple el tiempo — se
   reintenta con la próxima actividad. */
(function () {
  const INACTIVIDAD_MS = 4 * 60 * 1000;
  const tituloOriginal = document.title;
  let temporizador = null;

  function revelarPorInactividad() {
    if (document.hidden) return;
    document.title = "..." + tituloOriginal;
    crearPuntoOculto(document.querySelector(".subtitle"), "huellaInactividad");
  }

  function reiniciarTemporizador() {
    if (document.title !== tituloOriginal) document.title = tituloOriginal;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(revelarPorInactividad, INACTIVIDAD_MS);
  }

  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach(evento => {
    document.addEventListener(evento, reiniciarTemporizador, { passive: true });
  });
  reiniciarTemporizador();
})();

/* Medianoche: entre las 00:00 y la 01:00 (hora local de quien mira),
   aparece un punto invisible pegado al título del header. No es la
   puerta directa, es una pista — igual que las otras, hay que darse
   cuenta de que está ahí. */
(function () {
  const hora = new Date().getHours();
  if (hora !== 0) return;
  crearPuntoOculto(document.querySelector(".header-left h1"), "huellaMedianoche");
})();
