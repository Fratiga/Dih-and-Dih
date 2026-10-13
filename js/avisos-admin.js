/* =============================================================================
   AVISOS DEL ADMIN A LOS JUGADORES (docs/admin/herramientas_2.sql)
   - Mensajes: con la sesión iniciada, si hay un mensaje nuevo para ti (para todos, para tu Side o para tu cuenta) sale un aviso
     una sola vez; lo ya visto se recuerda en este navegador.
   - Suspensión: si tu cuenta está suspendida, sale el aviso con el motivo y se cierra la sesión. Es una suspensión «suave»: no
     bloquea nada en el servidor, solo avisa y cierra la sesión.
   Sin sesión o sin las tablas no hace nada. Va en las páginas que ya cargan fichas-supabase.js.
============================================================================= */
(function () {
  if (typeof fichasCliente !== "function" || typeof fichasSesionActual !== "function") return;
  const VISTOS = "avisosAdminVistos";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const vistos = () => { try { return new Set(JSON.parse(localStorage.getItem(VISTOS) || "[]")); } catch (e) { return new Set(); } };

  function tarjeta(html, alCerrar) {
    const caja = document.createElement("div");
    caja.className = "aviso-admin";
    caja.setAttribute("role", "dialog");
    caja.innerHTML = `<div class="aviso-admin-cuerpo">${html}<button type="button" class="aviso-admin-cerrar">Entendido</button></div>`;
    caja.querySelector("button").addEventListener("click", () => { caja.remove(); if (alCerrar) alCerrar(); });
    document.body.appendChild(caja);
  }

  async function iniciar() {
    let sesion;
    try { sesion = await fichasSesionActual(); } catch (e) { return; }
    if (!sesion) return;
    let supabase;
    try { supabase = await fichasCliente(); } catch (e) { return; }
    try {
      // 1) ¿Cuenta suspendida?
      const { data: sus } = await supabase.from("cuentas_suspendidas").select("motivo, hasta").eq("user_id", sesion.user.id).maybeSingle();
      if (sus && (!sus.hasta || new Date(sus.hasta) > new Date())) {
        tarjeta(`<h2>Tu cuenta está suspendida</h2><p>${esc(sus.motivo || "El Admin ha suspendido tu cuenta.")}</p>${sus.hasta ? `<p>Hasta el ${esc(new Date(sus.hasta).toLocaleDateString("es-ES"))}.</p>` : ""}<p>Se cerrará tu sesión.</p>`,
          async () => { try { await supabase.auth.signOut(); } catch (e) { /* sin red */ } location.reload(); });
        return;
      }
      // 2) Mensajes nuevos
      const { data: msgs } = await supabase.from("admin_mensajes").select("id, texto, creado").order("id", { ascending: true }).limit(20);
      const ya = vistos();
      const nuevos = (msgs || []).filter(m => !ya.has(m.id));
      if (!nuevos.length) return;
      const guardar = () => { try { localStorage.setItem(VISTOS, JSON.stringify([...ya, ...nuevos.map(m => m.id)].slice(-200))); } catch (e) { /* sin almacenamiento */ } };
      tarjeta(`<h2>${nuevos.length === 1 ? "Mensaje del Admin" : "Mensajes del Admin"}</h2>${nuevos.map(m => `<p>${esc(m.texto)}</p>`).join("")}`, guardar);
    } catch (e) { /* sin las tablas o sin conexión */ }
  }
  iniciar();
})();
