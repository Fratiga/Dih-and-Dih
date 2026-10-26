/* Tablón de Discord (discord.html): vincular y desvincular la cuenta de la web con Discord.
   Todo lo importante pasa en el servidor (docs/discord.sql): aquí solo se pide un código y se enseña. El código sirve una vez y caduca a los 10 minutos.
   Se vincula escribiendo /vincular con ese código en Discord, así queda demostrado que la persona controla las dos cuentas. */
(function () {
  const caja = document.getElementById("dcEstado");
  if (!caja) return;

  // Pon aquí el enlace de invitación permanente al servidor (Discord > Invitar gente > que nunca caduque). Vacío = no se enseña el botón.
  const INVITACION = "";

  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let sesion = null, timer = null, relojTimer = null;

  if (INVITACION && /^https:\/\/discord\.(gg|com)\//.test(INVITACION)) {
    const box = document.getElementById("dcInvitacion");
    const a = document.getElementById("dcInvitacionEnlace");
    if (box && a) { a.href = INVITACION; box.classList.remove("hidden"); }
  }

  function parar() { clearInterval(timer); clearInterval(relojTimer); timer = relojTimer = null; }

  async function rpc(nombre) {
    const sb = await fichasCliente();
    const { data, error } = await sb.rpc(nombre);
    if (error) throw error;
    return data;
  }

  // El botón se apaga y dice qué hace mientras espera (regla del sitio para cualquier espera).
  async function conEspera(boton, textoEspera, fn) {
    const original = boton.textContent;
    boton.disabled = true; boton.textContent = textoEspera;
    try { return await fn(); } finally { boton.disabled = false; boton.textContent = original; }
  }

  function mensaje(html, tipo) { caja.innerHTML = `<p class="dc-mensaje${tipo ? " dc-" + tipo : ""}">${html}</p>`; }

  async function pintar() {
    parar();
    if (!sesion) { mensaje("Inicia sesión (arriba a la derecha) para vincular tu cuenta con Discord."); return; }
    let est;
    try { est = await rpc("discord_estado"); }
    catch (e) { mensaje("No pude consultar tu vinculación. Prueba de nuevo en un rato.", "error"); return; }
    if (est && est.vinculada) pintarVinculada(est); else pintarSinVincular();
  }

  function pintarVinculada(est) {
    const desde = est.desde ? new Date(est.desde).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "";
    caja.innerHTML = `
      <p class="dc-estado dc-ok">Vinculada</p>
      <p class="dc-mensaje">Tu cuenta está unida a <strong>${esc(est.nombre || "tu cuenta de Discord")}</strong>${desde ? ` desde el ${esc(desde)}` : ""}.
      Prueba <strong>/perfil</strong> en el servidor.</p>
      <div class="dc-acciones"><button type="button" id="dcDesvincular" class="secondary-button">Desvincular</button></div>
      <p id="dcError" class="dc-mensaje dc-error hidden" role="alert"></p>`;
    const b = document.getElementById("dcDesvincular");
    let seguro = false, plazo = null;
    b.addEventListener("click", async () => {
      if (!seguro) {   // confirmación en el mismo botón, sin ventanas aparte
        seguro = true; b.textContent = "¿Seguro? Pulsa otra vez";
        plazo = setTimeout(() => { seguro = false; b.textContent = "Desvincular"; }, 6000);
        return;
      }
      clearTimeout(plazo);
      try { await conEspera(b, "Desvinculando...", () => rpc("discord_desvincular")); await pintar(); }
      catch (e) { const er = document.getElementById("dcError"); er.textContent = e.message || "No se pudo desvincular."; er.classList.remove("hidden"); seguro = false; }
    });
  }

  function pintarSinVincular() {
    caja.innerHTML = `
      <p class="dc-estado">Sin vincular</p>
      <ol class="dc-pasos">
        <li>Pulsa <strong>Generar código</strong>.</li>
        <li>En el servidor de Discord escribe <strong>/vincular</strong> y pega el código.</li>
        <li>Esta página se actualiza sola cuando termine.</li>
      </ol>
      <div class="dc-acciones"><button type="button" id="dcGenerar" class="secondary-button">Generar código</button></div>
      <div id="dcCodigo" class="dc-codigo-caja hidden"></div>
      <p id="dcError" class="dc-mensaje dc-error hidden" role="alert"></p>`;
    document.getElementById("dcGenerar").addEventListener("click", generar);
  }

  async function generar(ev) {
    const b = ev.currentTarget, er = document.getElementById("dcError");
    er.classList.add("hidden");
    let r;
    try { r = await conEspera(b, "Generando...", () => rpc("discord_crear_codigo")); }
    catch (e) { er.textContent = e.message || "No se pudo generar el código."; er.classList.remove("hidden"); return; }
    const expira = new Date(r.expira).getTime();
    const cont = document.getElementById("dcCodigo");
    cont.classList.remove("hidden");
    cont.innerHTML = `
      <p class="dc-etiqueta">Tu código</p>
      <p class="dc-codigo" id="dcTexto">${esc(r.codigo)}</p>
      <div class="dc-acciones"><button type="button" id="dcCopiar" class="secondary-button">Copiar</button></div>
      <p class="dc-mensaje">Escribe en Discord: <strong>/vincular codigo:${esc(r.codigo)}</strong></p>
      <p class="dc-reloj" id="dcReloj"></p>`;
    document.getElementById("dcCopiar").addEventListener("click", async e => {
      const btn = e.currentTarget;
      try { await navigator.clipboard.writeText(r.codigo); btn.textContent = "Copiado"; }
      catch (err) { btn.textContent = "Selecciónalo y cópialo a mano"; }
      setTimeout(() => { btn.textContent = "Copiar"; }, 2500);
    });
    // La cuenta atrás y la consulta de si ya se vinculó (cada 4 s) paran solas al terminar o al salir de la página.
    const reloj = document.getElementById("dcReloj");
    const tic = () => {
      const s = Math.max(0, Math.round((expira - Date.now()) / 1000));
      reloj.textContent = s > 0 ? `Caduca en ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}. Sirve una sola vez.` : "El código caducó. Genera uno nuevo.";
      if (s <= 0) { parar(); document.getElementById("dcTexto")?.classList.add("dc-caducado"); }
    };
    tic();
    relojTimer = setInterval(tic, 1000);
    timer = setInterval(async () => {
      try { const est = await rpc("discord_estado"); if (est && est.vinculada) await pintar(); } catch (e) { /* se reintenta */ }
    }, 4000);
  }

  window.addEventListener("pagehide", parar);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearInterval(timer); });
  mensaje("Cargando...");
  if (typeof fichasEnCambioDeSesion === "function") {
    fichasEnCambioDeSesion(s => { sesion = s; pintar(); }).catch(() => mensaje("No pude conectar. Revisa tu conexión.", "error"));
  } else {
    mensaje("No pude cargar el sistema de cuentas.", "error");
  }
})();
