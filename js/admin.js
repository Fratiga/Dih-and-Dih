/* =============================================================================
   PANEL DE ADMIN — Peticiones (leer + marcar atendidas) y Cuentas (ver
   Side/username de todos, corregir el Side de cualquiera). El flag de
   Admin en sí no se toca desde acá a propósito, eso se sigue dando de alta
   por SQL (ver scratchpad/panel-admin.sql).
============================================================================= */
(function () {
  function escaparHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function formatearFecha(iso) {
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function pintarPeticiones(lista) {
    const cont = document.getElementById("adminPeticionesLista");
    const count = document.getElementById("adminPeticionesCount");

    if (!lista.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay peticiones todavía.</p>`;
      count.textContent = "";
      return;
    }

    const pendientes = lista.filter(p => !p.atendida).length;
    count.textContent = `${pendientes} pendiente${pendientes === 1 ? "" : "s"} de ${lista.length}`;

    cont.innerHTML = lista.map(p => `
      <div class="admin-peticion-card ${p.atendida ? "is-atendida" : ""}" data-id="${p.id}">
        <div class="admin-peticion-top">
          <span class="admin-peticion-nombre">${p.nombre ? escaparHtml(p.nombre) : "Anónimo"}</span>
          <span class="admin-peticion-fecha">${formatearFecha(p.created_at)}</span>
        </div>
        <p class="admin-peticion-texto">${escaparHtml(p.texto)}</p>
        <label class="admin-peticion-check">
          <input type="checkbox" data-atendida ${p.atendida ? "checked" : ""}>
          Atendida
        </label>
      </div>
    `).join("");

    cont.querySelectorAll("[data-atendida]").forEach(chk => {
      chk.addEventListener("change", async e => {
        const card = e.target.closest("[data-id]");
        const nuevoValor = e.target.checked;
        card.classList.toggle("is-atendida", nuevoValor);
        try {
          await adminMarcarPeticion(card.dataset.id, nuevoValor);
        } catch (err) {
          e.target.checked = !nuevoValor;
          card.classList.toggle("is-atendida", !nuevoValor);
          alert("No se pudo guardar. Prueba de nuevo.");
        }
      });
    });
  }

  function pintarCuentas(lista) {
    const cont = document.getElementById("adminCuentasLista");
    const count = document.getElementById("adminCuentasCount");
    count.textContent = `${lista.length} cuenta${lista.length === 1 ? "" : "s"}`;

    if (!lista.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay cuentas todavía.</p>`;
      return;
    }

    cont.innerHTML = lista.map(u => `
      <div class="admin-cuenta-fila" data-id="${u.id}">
        <span class="admin-cuenta-nombre">
          ${escaparHtml(u.username || "(sin nombre de usuario)")}
          ${u.es_admin ? '<span class="admin-cuenta-tag">★ Admin</span>' : ""}
        </span>
        <div class="admin-cuenta-side">
          <button type="button" class="admin-side-btn ${u.side === "A" ? "is-active" : ""}" data-side="A">${LADO_NOMBRES.A}</button>
          <button type="button" class="admin-side-btn ${u.side === "B" ? "is-active" : ""}" data-side="B">${LADO_NOMBRES.B}</button>
        </div>
      </div>
    `).join("");

    cont.querySelectorAll("[data-side]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const side = btn.dataset.side;
        try {
          await adminCambiarSide(fila.dataset.id, side);
          fila.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("is-active", b.dataset.side === side));
        } catch (err) {
          alert("No se pudo cambiar el Side. Prueba de nuevo.");
        }
      });
    });
  }

  initAdminGate(async () => {
    const peticionesEl = document.getElementById("adminPeticionesLista");
    const cuentasEl = document.getElementById("adminCuentasLista");
    try {
      const [peticiones, cuentas] = await Promise.all([adminListarPeticiones(), adminListarPerfiles()]);
      pintarPeticiones(peticiones);
      pintarCuentas(cuentas);
    } catch (e) {
      const mensaje = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/panel-admin.sql en Supabase?</p>`;
      peticionesEl.innerHTML = mensaje;
      cuentasEl.innerHTML = mensaje;
    }
  });
})();
