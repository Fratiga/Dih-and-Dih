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
        <div class="admin-cuenta-acciones">
          <button type="button" class="admin-cuenta-accion" data-accion="password">Cambiar contraseña</button>
          <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-accion="eliminar">Eliminar cuenta</button>
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

    cont.querySelectorAll('[data-accion="password"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const nueva = prompt("Nueva contraseña para esta cuenta (mínimo 6 caracteres):");
        if (!nueva) return;
        if (nueva.length < 6) {
          alert("La contraseña debe tener al menos 6 caracteres.");
          return;
        }
        btn.disabled = true;
        try {
          await adminCambiarPassword(fila.dataset.id, nueva);
          alert("Contraseña cambiada.");
        } catch (err) {
          alert("No se pudo cambiar la contraseña: " + (err.message || "error desconocido"));
        } finally {
          btn.disabled = false;
        }
      });
    });

    cont.querySelectorAll('[data-accion="eliminar"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const nombre = fila.querySelector(".admin-cuenta-nombre").textContent.trim();
        const confirmado = confirm(
          `¿Eliminar la cuenta de "${nombre}"?\n\nEsto borra su acceso por completo y no se puede deshacer. Sus fichas de personaje no se borran solas con esto.`
        );
        if (!confirmado) return;
        btn.disabled = true;
        try {
          await adminEliminarCuenta(fila.dataset.id);
          fila.remove();
        } catch (err) {
          alert("No se pudo eliminar la cuenta: " + (err.message || "error desconocido"));
          btn.disabled = false;
        }
      });
    });
  }

  function pintarBufonProgreso({ jugadores, sideB }) {
    const banner = document.getElementById("adminBufonBanner");
    banner.textContent = `Side B: ${sideB.completos}/${sideB.necesarios} jugadores completaron el Bufón.` +
      (sideB.avanzo ? " Generación 2 desbloqueada." : "");

    const cont = document.getElementById("adminBufonLista");
    const count = document.getElementById("adminBufonCount");
    count.textContent = `${jugadores.length} jugador${jugadores.length === 1 ? "" : "es"}`;

    if (!jugadores.length) {
      cont.innerHTML = `<p class="admin-vacio">Todavía nadie interactuó con el Bufón.</p>`;
      return;
    }

    cont.innerHTML = jugadores.map(j => `
      <div class="admin-bufon-fila">
        <span class="admin-bufon-nombre">
          ${j.nombre ? escaparHtml(j.nombre) : `Anónimo (${j.playerId ? j.playerId.slice(0, 8) : "?"}…)`}
          ${j.side ? `<span class="admin-bufon-side">Side ${j.side}</span>` : ""}
        </span>
        <span class="admin-bufon-dato"><strong>${j.elecciones}</strong> elecciones</span>
        <span class="admin-bufon-dato"><strong>${j.completados}</strong> diálogos completados</span>
        <span class="admin-bufon-dato">${j.ultimoNodo ? `Último: ${escaparHtml(j.ultimoNodo)}` : "—"}</span>
        <span class="admin-bufon-dato admin-bufon-toques">${j.toquesPuerta ? `<strong>${j.toquesPuerta}</strong> toques sin acceso` : "Nunca tocó sin acceso"}</span>
        <span class="admin-bufon-fecha">${formatearFecha(j.ultimaActividad)}</span>
      </div>
    `).join("");
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

    // Sección separada e independiente: usa scratchpad/panel-admin-bufon.sql,
    // un script aparte del resto del panel, así que su falla no debe tapar
    // Peticiones/Cuentas si todavía no se corrió.
    const bufonEl = document.getElementById("adminBufonLista");
    try {
      const progreso = await adminListarProgresoBufon();
      pintarBufonProgreso(progreso);
    } catch (e) {
      bufonEl.innerHTML = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/panel-admin-bufon.sql en Supabase?</p>`;
    }
  });

  const tabs = document.getElementById("adminTabs");
  if (tabs) {
    tabs.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        tabs.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
        document.querySelectorAll(".admin-panel").forEach(panel => {
          panel.classList.toggle("active", panel.id === "adminPanel" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1));
        });
      });
    });
  }
})();
