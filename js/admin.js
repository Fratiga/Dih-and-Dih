/* =============================================================================
   PANEL DE ADMIN — Peticiones (leer + marcar atendidas) y Cuentas (ver
   Side/username de todos, corregir el Side de cualquiera). El flag de
   Admin en sí no se toca desde aquí a propósito, eso se sigue dando de alta
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

  // Las pendientes y las atendidas van en vistas separadas. Por defecto solo se
  // ven las pendientes; "Todas" las muestra en dos grupos, pendientes primero.
  let peticionesDatos = [];
  let filtroPeticiones = "pendientes";

  function tarjetaPeticion(p) {
    return `
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
      </div>`;
  }

  function repintarPeticiones() {
    const cont = document.getElementById("adminPeticionesLista");
    const count = document.getElementById("adminPeticionesCount");
    const pendientes = peticionesDatos.filter(p => !p.atendida);
    const atendidas = peticionesDatos.filter(p => p.atendida);

    count.textContent = peticionesDatos.length
      ? `${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"} de ${peticionesDatos.length}`
      : "";
    const numeros = { pendientes: pendientes.length, atendidas: atendidas.length, todas: peticionesDatos.length };
    document.querySelectorAll("#adminPeticionesFiltro [data-n]").forEach(el => { el.textContent = `(${numeros[el.dataset.n]})`; });
    document.querySelectorAll("#adminPeticionesFiltro [data-filtro]").forEach(b => b.classList.toggle("activo", b.dataset.filtro === filtroPeticiones));

    if (!peticionesDatos.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay peticiones todavía.</p>`;
      return;
    }

    if (filtroPeticiones === "pendientes") {
      cont.innerHTML = pendientes.length ? pendientes.map(tarjetaPeticion).join("") : `<p class="admin-vacio">No queda ninguna pendiente.</p>`;
    } else if (filtroPeticiones === "atendidas") {
      cont.innerHTML = atendidas.length ? atendidas.map(tarjetaPeticion).join("") : `<p class="admin-vacio">Todavía no hay ninguna atendida.</p>`;
    } else {
      cont.innerHTML = `
        <h3 class="admin-grupo-titulo">Pendientes (${pendientes.length})</h3>
        ${pendientes.length ? pendientes.map(tarjetaPeticion).join("") : `<p class="admin-vacio">No queda ninguna pendiente.</p>`}
        <h3 class="admin-grupo-titulo">Atendidas (${atendidas.length})</h3>
        ${atendidas.length ? atendidas.map(tarjetaPeticion).join("") : `<p class="admin-vacio">Todavía no hay ninguna atendida.</p>`}`;
    }

    cont.querySelectorAll("[data-atendida]").forEach(chk => {
      chk.addEventListener("change", async e => {
        const card = e.target.closest("[data-id]");
        const nuevoValor = e.target.checked;
        const peticion = peticionesDatos.find(x => String(x.id) === card.dataset.id);
        if (!peticion) return;
        try {
          await adminMarcarPeticion(card.dataset.id, nuevoValor);
          peticion.atendida = nuevoValor;
          repintarPeticiones();
        } catch (err) {
          e.target.checked = !nuevoValor;
          alert("No se pudo guardar. Prueba de nuevo.");
        }
      });
    });
  }

  function pintarPeticiones(lista) {
    peticionesDatos = lista;
    repintarPeticiones();
  }

  const filtroPeticionesEl = document.getElementById("adminPeticionesFiltro");
  if (filtroPeticionesEl) {
    filtroPeticionesEl.addEventListener("click", e => {
      const boton = e.target.closest("[data-filtro]");
      if (!boton) return;
      filtroPeticiones = boton.dataset.filtro;
      repintarPeticiones();
    });
  }

  let miIdCuenta = null;
  if (typeof fichasSesionActual === "function") {
    fichasSesionActual().then(ses => { miIdCuenta = ses && ses.user ? ses.user.id : null; }).catch(() => {});
  }

  function pintarCuentas(lista, djs = new Set()) {
    const cont = document.getElementById("adminCuentasLista");
    const count = document.getElementById("adminCuentasCount");
    count.textContent = `${lista.length} cuenta${lista.length === 1 ? "" : "s"}`;

    if (!lista.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay cuentas todavía.</p>`;
      return;
    }

    cont.innerHTML = lista.map(u => `
      <div class="admin-cuenta-fila" data-id="${u.id}" data-es-admin="${u.es_admin ? "1" : "0"}" data-es-dj="${djs.has(u.id) ? "1" : "0"}">
        <span class="admin-cuenta-nombre">
          <span class="admin-cuenta-usuario">${escaparHtml(u.username || "(sin nombre de usuario)")}</span>
          <span class="admin-cuenta-tag"${u.es_admin ? "" : " hidden"}>★ Admin</span>
          <span class="admin-cuenta-tag admin-cuenta-tag-dj"${djs.has(u.id) ? "" : " hidden"}>DJ</span>
        </span>
        <div class="admin-cuenta-side">
          <button type="button" class="admin-side-btn ${u.side === "A" ? "is-active" : ""}" data-side="A">${LADO_NOMBRES.A}</button>
          <button type="button" class="admin-side-btn ${u.side === "B" ? "is-active" : ""}" data-side="B">${LADO_NOMBRES.B}</button>
        </div>
        <div class="admin-cuenta-acciones">
          ${u.id === miIdCuenta ? "" : `<button type="button" class="admin-cuenta-accion" data-accion="admin">${u.es_admin ? "Quitar Admin" : "Dar Admin"}</button>`}
          <button type="button" class="admin-cuenta-accion" data-accion="dj" title="Editores de mapas de Zarabanda y Parranda y gestionar la rocola, nada más">${djs.has(u.id) ? "Quitar DJ" : "Dar DJ"}</button>
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

    cont.querySelectorAll('[data-accion="admin"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const nombre = fila.querySelector(".admin-cuenta-usuario").textContent.trim();
        const darlo = fila.dataset.esAdmin !== "1";
        const confirmado = confirm(darlo
          ? `¿Dar Admin a "${nombre}"?\n\nPodrá ver y cambiar cuentas, fichas, peticiones y todo este panel.`
          : `¿Quitarle el Admin a "${nombre}"?`);
        if (!confirmado) return;
        btn.disabled = true;
        try {
          await adminCambiarAdmin(fila.dataset.id, darlo);
          fila.dataset.esAdmin = darlo ? "1" : "0";
          fila.querySelector(".admin-cuenta-tag").hidden = !darlo;
          btn.textContent = darlo ? "Quitar Admin" : "Dar Admin";
        } catch (err) {
          alert("No se pudo cambiar el permiso: " + (err.message || "error desconocido") + "\n\n¿Corriste scratchpad/admin_dar_admin.sql en Supabase?");
        } finally {
          btn.disabled = false;
        }
      });
    });

    cont.querySelectorAll('[data-accion="dj"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const nombre = fila.querySelector(".admin-cuenta-usuario").textContent.trim();
        const darlo = fila.dataset.esDj !== "1";
        const confirmado = confirm(darlo
          ? `¿Dar el rol DJ a "${nombre}"?\n\nPodrá usar los editores de mapas de Zarabanda y Parranda y gestionar la rocola. Nada más: no ve este panel ni las cuentas.`
          : `¿Quitarle el rol DJ a "${nombre}"?`);
        if (!confirmado) return;
        btn.disabled = true;
        try {
          await adminCambiarDJ(fila.dataset.id, darlo);
          fila.dataset.esDj = darlo ? "1" : "0";
          fila.querySelector(".admin-cuenta-tag-dj").hidden = !darlo;
          btn.textContent = darlo ? "Quitar DJ" : "Dar DJ";
        } catch (err) {
          alert("No se pudo cambiar el rol: " + (err.message || "error desconocido") + "\n\n¿Corriste scratchpad/ritmo_dj.sql en Supabase?");
        } finally {
          btn.disabled = false;
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
        const nombre = fila.querySelector(".admin-cuenta-usuario").textContent.trim();
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

  async function cargarProgresoBufon() {
    const bufonEl = document.getElementById("adminBufonLista");
    try {
      const progreso = await adminListarProgresoBufon();
      pintarBufonProgreso(progreso);
    } catch (e) {
      console.error("[admin] Progreso del Bufón falló:", e);
      bufonEl.innerHTML = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/panel-admin-bufon.sql y scratchpad/bufon_excluir_conteo_admin.sql en Supabase?</p>`;
    }
  }

  function pintarBufonProgreso({ jugadores, sideA, sideB }) {
    const banner = document.getElementById("adminBufonBanner");
    banner.innerHTML = `<p>Side A: ${sideA.completos}/${sideA.necesarios} jugadores completaron el Bufón.` +
      (sideA.avanzo ? " Generación 2 desbloqueada.</p>" : "</p>") +
      `<p>Side B: ${sideB.completos}/${sideB.necesarios} jugadores completaron el Bufón.` +
      (sideB.avanzo ? " Generación 2 desbloqueada.</p>" : "</p>");

    const cont = document.getElementById("adminBufonLista");
    const count = document.getElementById("adminBufonCount");
    count.textContent = `${jugadores.length} jugador${jugadores.length === 1 ? "" : "es"}`;

    if (!jugadores.length) {
      cont.innerHTML = `<p class="admin-vacio">Todavía nadie interactuó con el Bufón.</p>`;
      return;
    }

    cont.innerHTML = jugadores.map(j => `
      <div class="admin-bufon-fila ${j.excluido ? "admin-bufon-fila-excluida" : ""}" data-player-id="${j.playerId}" data-nombre="${escaparHtml(j.nombre || "")}">
        <span class="admin-bufon-nombre">
          ${j.nombre ? escaparHtml(j.nombre) : `Anónimo (${j.playerId ? j.playerId.slice(0, 8) : "?"}…)`}
          ${j.side ? `<span class="admin-bufon-side">Side ${j.side}</span>` : ""}
        </span>
        <span class="admin-bufon-dato"><strong>${j.elecciones}</strong> elecciones</span>
        <span class="admin-bufon-dato"><strong>${j.completados}</strong> diálogos completados</span>
        <span class="admin-bufon-dato">${j.ultimoNodo ? `Último: ${escaparHtml(j.ultimoNodo)}` : "—"}</span>
        <span class="admin-bufon-dato admin-bufon-toques">${j.toquesPuerta ? `<strong>${j.toquesPuerta}</strong> veces sin nada nuevo` : "Siempre encontró algo nuevo"}</span>
        <span class="admin-bufon-fecha">${formatearFecha(j.ultimaActividad)}</span>
        <button type="button" class="admin-bufon-excluir-btn" data-toggle-excluido="${j.playerId}" title="${j.excluido ? escaparHtml(j.motivoExcluido || "Excluido del conteo") : "No cuenta para el progreso de Side A/B"}">
          ${j.excluido ? "Volver a contar" : "No contar para el progreso"}
        </button>
      </div>
    `).join("");

    cont.querySelectorAll("[data-player-id]").forEach(fila => {
      fila.addEventListener("click", () => mostrarConversacionBufon(fila.dataset.playerId, fila.dataset.nombre));
    });

    cont.querySelectorAll("[data-toggle-excluido]").forEach(btn => {
      btn.addEventListener("click", async e => {
        e.stopPropagation(); // no abrir la conversación del jugador al tocar el botón
        const playerId = btn.dataset.toggleExcluido;
        const estaExcluido = btn.closest(".admin-bufon-fila").classList.contains("admin-bufon-fila-excluida");
        btn.disabled = true;
        try {
          if (estaExcluido) {
            await adminReincluirEnBufon(playerId);
          } else {
            const motivo = prompt("¿Por qué no debería contar para el progreso? (opcional)") || null;
            await adminExcluirDelBufon(playerId, motivo);
          }
          await cargarProgresoBufon();
        } catch (err) {
          alert("No se pudo actualizar: " + (err.message || "error desconocido"));
          btn.disabled = false;
        }
      });
    });
  }

  function formatearFechaHora(iso) {
    try {
      return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function tituloConversacion(playerId, nombre) {
    return nombre ? escaparHtml(nombre) : `Anónimo (${playerId.slice(0, 8)}…)`;
  }

  // Agrupa por CICLO DE GENERACIÓN real del Bufón, no por sesión de
  // juego: Ciclo 1 es todo lo que pasó antes de que Side B juntara a su
  // quinto jugador y desbloqueara la generación 2 (momentoGen2B, ver
  // adminMomentoGeneracion2B en js/bufon-supabase.js); Ciclo 2 es lo que
  // pasó después. Side A no tiene generación 2 definida todavía, así que
  // sus eventos (y los que no tienen side) quedan siempre en Ciclo 1 —
  // cuando exista ese mecanismo, esto es lo único que hay que tocar.
  function agruparPorCiclo(elecciones, momentoGen2B) {
    const grupos = new Map();
    let contador = 0;
    elecciones.forEach(e => {
      const esCiclo2 = e.side === "B" && momentoGen2B && new Date(e.created_at) >= new Date(momentoGen2B);
      const numero = esCiclo2 ? 2 : 1;
      if (!grupos.has(numero)) grupos.set(numero, { numero, eventos: [] });
      grupos.get(numero).eventos.push({ ...e, _idx: contador++ });
    });
    return Array.from(grupos.values()).sort((a, b) => a.numero - b.numero);
  }

  // Una tarjeta por evento, con fecha y Side. No omite nada: "completado"
  // (avance de nodo, sin pregunta/respuesta real) se marca con un check,
  // y "saludo"/"conector" (línea narrativa sin elección real, ver
  // renderNodo en secreto.html) se muestran como una sola línea del
  // Bufón, sin flecha de respuesta que no existió.
  function renderEventoLista(e) {
    if (e.category === "completado") {
      return `
        <div class="admin-bufon-evento admin-bufon-evento-completado" id="admin-bufon-evento-${e._idx}">
          <span class="admin-bufon-evento-fecha">${formatearFechaHora(e.created_at)}</span>
          <span>✓ Completó el nodo <strong>${escaparHtml(e.choice_id || "")}</strong></span>
        </div>
      `;
    }
    if (e.category === "saludo" || e.category === "conector") {
      return `
        <div class="admin-bufon-evento" id="admin-bufon-evento-${e._idx}">
          <span class="admin-bufon-evento-fecha">${formatearFechaHora(e.created_at)}${e.side ? ` · Side ${e.side}` : ""}</span>
          <p class="admin-bufon-respuesta">${escaparHtml(e.question_text || "")}</p>
        </div>
      `;
    }
    return `
      <div class="admin-bufon-evento" id="admin-bufon-evento-${e._idx}">
        <span class="admin-bufon-evento-fecha">${formatearFechaHora(e.created_at)}${e.side ? ` · Side ${e.side}` : ""}</span>
        ${e.question_text ? `<p class="admin-bufon-pregunta">${escaparHtml(e.question_text)}</p>` : ""}
        <p class="admin-bufon-respuesta">→ ${escaparHtml(e.choice_text || e.choice_id || "")}</p>
      </div>
    `;
  }

  // Todo de corrido, sin fechas ni tarjetas separadas, para leer la
  // conversación como si fuese un diálogo real. Nada se salta: "saludo"/
  // "conector" son línea del Bufón sola (no hubo elección real que
  // responder), "completado" es una acotación de guion entre paréntesis.
  function renderEventoGuion(e, nombreJugador) {
    if (e.category === "completado") {
      return `<p class="admin-bufon-guion-acotacion" id="admin-bufon-evento-${e._idx}">(completa "${escaparHtml(e.choice_id || "")}")</p>`;
    }
    if (e.category === "saludo" || e.category === "conector") {
      return `<p class="admin-bufon-guion-linea" id="admin-bufon-evento-${e._idx}"><strong>Bufón:</strong> ${escaparHtml(e.question_text || "")}</p>`;
    }
    const pregunta = e.question_text
      ? `<p class="admin-bufon-guion-linea"><strong>Bufón:</strong> ${escaparHtml(e.question_text)}</p>`
      : "";
    const respuesta = `<p class="admin-bufon-guion-linea admin-bufon-guion-jugador" id="admin-bufon-evento-${e._idx}"><strong>${nombreJugador}:</strong> ${escaparHtml(e.choice_text || e.choice_id || "")}</p>`;
    return pregunta + respuesta;
  }

  async function mostrarConversacionBufon(playerId, nombre) {
    const modal = document.getElementById("entryModal");
    const contenido = document.getElementById("modalContent");
    if (!modal || !contenido) return;
    const titulo = tituloConversacion(playerId, nombre);
    const nombreJugador = nombre ? escaparHtml(nombre) : "Jugador";

    contenido.innerHTML = `
      <div class="entry-type">Progreso del Bufón</div>
      <h2>${titulo}</h2>
      <p class="admin-vacio">Cargando conversación...</p>
    `;
    modal.showModal();

    try {
      const [elecciones, momentoGen2B] = await Promise.all([
        adminListarConversacionBufon(playerId),
        adminMomentoGeneracion2B().catch(() => null) // si falla, todo queda en Ciclo 1, no rompe la vista
      ]);
      if (!elecciones.length) {
        contenido.querySelector(".admin-vacio").textContent = "No hay elecciones registradas para esta identidad.";
        return;
      }

      const ciclos = agruparPorCiclo(elecciones, momentoGen2B);
      let modoGuion = false;

      function pintar() {
        const indiceHTML = `
          <nav class="admin-bufon-indice">
            ${ciclos.map(c => `<button type="button" class="admin-bufon-indice-link" data-ir-a="admin-bufon-ciclo-${c.numero}">Ciclo ${c.numero} <small>${c.eventos.length} evento${c.eventos.length === 1 ? "" : "s"}</small></button>`).join("")}
          </nav>
        `;
        const cuerpoHTML = ciclos.map(c => `
          <h3 class="admin-bufon-ciclo-titulo" id="admin-bufon-ciclo-${c.numero}">Ciclo ${c.numero}</h3>
          ${c.eventos.map(e => modoGuion ? renderEventoGuion(e, nombreJugador) : renderEventoLista(e)).join("")}
        `).join("");

        contenido.innerHTML = `
          <div class="entry-type">Progreso del Bufón</div>
          <h2>${titulo}</h2>
          <button type="button" id="adminBufonModoToggle" class="secondary-button admin-bufon-modo-toggle">
            ${modoGuion ? "Ver como lista" : "Ver como guion"}
          </button>
          ${indiceHTML}
          <div class="admin-bufon-conversacion${modoGuion ? " admin-bufon-conversacion-guion" : ""}">
            ${cuerpoHTML}
          </div>
        `;
        document.getElementById("adminBufonModoToggle").addEventListener("click", () => {
          modoGuion = !modoGuion;
          pintar();
        });
        contenido.querySelectorAll("[data-ir-a]").forEach(btn => {
          btn.addEventListener("click", () => {
            const destino = document.getElementById(btn.dataset.irA);
            if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
      }
      pintar();
    } catch (err) {
      contenido.innerHTML = `
        <div class="entry-type">Progreso del Bufón</div>
        <h2>${titulo}</h2>
        <p class="admin-vacio">No se pudo cargar la conversación.</p>
      `;
    }
  }

  // Sin fila en el reparto (side === undefined) = "Ambos" = compartido,
  // lo ve todo el mundo. Mismo criterio que aplicarRepartoFanarts() en
  // js/fanarts.js.
  /* --- Sistema: qué SQL falta correr -------------------------------------------
     Cada comprobación solo lee o llama a una función con datos que no existen, así
     que no cambia nada. Una tabla o función que "no se encuentra" = falta su SQL. */
  const CERO = "00000000-0000-0000-0000-000000000000";
  const CHEQUEOS = [
    { que: "Cuentas y Sides (panel de Admin)", sql: "panel-admin.sql", tipo: "rpc", ref: "fichas_admin_listar_perfiles", args: {} },
    { que: "Dar y quitar el Admin desde Cuentas", sql: "admin_dar_admin.sql", tipo: "rpc", ref: "fichas_admin_set_admin", args: { target_id: CERO, nuevo: true } },
    { que: "Historial de cambios en fichas", sql: "fichas_historial.sql", tipo: "tabla", ref: "fichas_historial" },
    { que: "Rankings de ajedrez y duelo", sql: "minijuegos_estadisticas.sql", tipo: "tabla", ref: "mj_estadisticas" },
    { que: "Ranking de Hooey", sql: "hooey_ranking.sql", tipo: "tabla", ref: "hooey_puntajes" },
    { que: "Muerte Súbita", sql: "muerte_subita.sql", tipo: "tabla", ref: "muerte_subita_intentos" },
    { que: "Fanarts por Side", sql: "fanarts_side.sql", tipo: "tabla", ref: "fanarts_side" },
    { que: "Fanarts ocultos", sql: "fanarts_ocultos.sql", tipo: "tabla", ref: "fanarts_ocultos" },
    { que: "Subir fanarts desde el panel", sql: "fanarts_subidos.sql", tipo: "tabla", ref: "fanarts_subidos" },
    { que: "Subir fanarts: almacenamiento", sql: "fanarts_subidos.sql", tipo: "bucket", ref: "fanarts" },
    { que: "Ajedrez contra otros jugadores", sql: "ajedrez_pvp.sql", tipo: "tabla", ref: "ajedrez_partidas" },
    { que: "Arquería contra otros jugadores", sql: "arqueria_pvp.sql", tipo: "tabla", ref: "arqueria_partidas" },
    { que: "Mapas del editor de ritmo", sql: "ritmo_mapas.sql", tipo: "tabla", ref: "ritmo_mapas" },
    { que: "Rol DJ", sql: "ritmo_dj.sql", tipo: "rpc", ref: "ritmo_es_dj", args: {} },
    { que: "Canciones subidas a la rocola", sql: "ritmo_dj.sql", tipo: "tabla", ref: "rocola_canciones" },
    { que: "Canciones de la rocola: almacenamiento", sql: "ritmo_dj.sql", tipo: "bucket", ref: "rocola" },
    { que: "Puntajes de Zarabanda", sql: "ritmo_puntajes.sql", tipo: "tabla", ref: "ritmo_puntajes" },
    { que: "Parranda: mapas del editor", sql: "parranda.sql", tipo: "tabla", ref: "parranda_mapas" },
    { que: "Parranda: puntajes", sql: "parranda.sql", tipo: "tabla", ref: "parranda_puntajes" },
    { que: "Canciones ocultas de la rocola (gestor)", sql: "rocola_gestor.sql", tipo: "tabla", ref: "rocola_ocultas" },
    { que: "Nombres de canciones del sitio (gestor)", sql: "rocola_nombres.sql", tipo: "tabla", ref: "rocola_nombres" },
    { que: "Catálogo y colección de cartas", sql: "cartas.sql", tipo: "tabla", ref: "cartas_coleccion" },
    { que: "Regalar cartas (Admin)", sql: "cartas.sql", tipo: "rpc", ref: "cartas_regalar", args: { p_usuario: CERO, p_carta: "no-existe", p_nota: "" } },
    { que: "Atajos del lobby guardados en la cuenta", sql: "atajos_usuario.sql", tipo: "tabla", ref: "atajos_usuario" },
    { que: "Contador de visitas del lobby", sql: "lobby_contador.sql", tipo: "rpc", ref: "lobby_visita", args: { p_contar: false } },
    { que: "Ver si una petición fue atendida", sql: "peticiones_estado.sql", tipo: "rpc", ref: "peticiones_estado", args: { p_codigos: [] } }
  ];

  async function comprobar(supabase, ch) {
    try {
      if (ch.tipo === "tabla") {
        const { error } = await supabase.from(ch.ref).select("*", { head: true, count: "exact" }).limit(1);
        if (!error) return { ok: true };
        return /not find the table|does not exist|42P01|PGRST205/i.test(`${error.code} ${error.message}`) ? { ok: false } : { ok: true, nota: "existe (sin permiso para leerla)" };
      }
      if (ch.tipo === "rpc") {
        const { error } = await supabase.rpc(ch.ref, ch.args || {});
        if (!error) return { ok: true };
        return /not find the function|PGRST202|42883/i.test(`${error.code} ${error.message}`) ? { ok: false } : { ok: true };
      }
      if (ch.tipo === "bucket") {
        const { error } = await supabase.storage.from(ch.ref).list("", { limit: 1 });
        return error ? { ok: false } : { ok: true };
      }
    } catch (e) { /* cae abajo */ }
    return { ok: false, nota: "no se pudo comprobar" };
  }

  async function revisarSistema() {
    const lista = document.getElementById("adminSistemaLista");
    const boton = document.getElementById("adminSistemaRevisar");
    boton.disabled = true;
    lista.innerHTML = `<p class="admin-vacio">Revisando...</p>`;
    const supabase = await fichasCliente();
    const resultados = [];
    for (const ch of CHEQUEOS) resultados.push({ ch, r: await comprobar(supabase, ch) });
    const faltan = resultados.filter(x => !x.r.ok);
    document.getElementById("adminSistemaCount").textContent = faltan.length ? String(faltan.length) : "";
    const sqls = [...new Set(faltan.map(x => x.ch.sql))];
    lista.innerHTML = `<p class="admin-sistema-resumen ${faltan.length ? "mal" : "bien"}">${faltan.length
      ? `Faltan ${faltan.length} de ${resultados.length}. Corre: ${sqls.map(escaparHtml).join(", ")}`
      : `Todo listo: ${resultados.length} de ${resultados.length}.`}</p>` +
      resultados.map(({ ch, r }) => `
        <div class="admin-sistema-fila ${r.ok ? "ok" : "falta"}">
          <span class="admin-sistema-marca">${r.ok ? "✓" : "✗"}</span>
          <span class="admin-sistema-que">${escaparHtml(ch.que)}${r.nota ? ` <small>${escaparHtml(r.nota)}</small>` : ""}</span>
          <span class="admin-sistema-sql">${r.ok ? "" : escaparHtml(ch.sql)}</span>
        </div>`).join("");
    boton.disabled = false;
  }
  const botonSistema = document.getElementById("adminSistemaRevisar");
  if (botonSistema) botonSistema.addEventListener("click", revisarSistema);

  async function cargarFanartsAdmin() {
    const fanartsEl = document.getElementById("adminFanartsLista");
    try {
      const reparto = await fanartsCargarSides();
      const ocultos = await fanartsCargarOcultos().catch(() => new Set());
      // Los subidos desde aquí van primero (los más nuevos arriba), luego los del repositorio
      const subidos = await fanartsCargarSubidos().catch(() => []);
      pintarFanartsAdmin([...subidos, ...(window.FANARTS || [])], reparto, ocultos);
    } catch (e) {
      console.error("[admin] Reparto de fanarts falló:", e);
      fanartsEl.innerHTML = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/fanarts_side.sql en Supabase?</p>`;
    }
  }

  /* --- Subir fanarts desde el panel (sin tocar el repositorio) --- */
  (function iniciarSubidaFanarts() {
    const entrada = document.getElementById("adminFanartArchivos");
    const selectSide = document.getElementById("adminFanartSideSubir");
    const estado = document.getElementById("adminFanartSubirEstado");
    const zona = document.getElementById("adminPanelFanarts");
    if (!entrada || !selectSide || !zona) return;
    selectSide.innerHTML = `<option value="">Ambos</option><option value="A">${LADO_NOMBRES.A}</option><option value="B">${LADO_NOMBRES.B}</option>`;
    const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const MAX = 10 * 1024 * 1024;
    let subiendo = false;

    async function subir(archivos) {
      if (subiendo) return;
      const lista = Array.from(archivos).filter(a => TIPOS.includes(a.type) && a.size <= MAX);
      const omitidos = archivos.length - lista.length;
      if (!lista.length) { estado.textContent = "Ninguna imagen válida (PNG, JPG, WebP o GIF de hasta 10 MB)."; return; }
      subiendo = true;
      let hechas = 0;
      let fallo = "";
      for (const archivo of lista) {
        estado.textContent = `Subiendo ${hechas + 1} de ${lista.length}: ${archivo.name}`;
        try {
          await fanartsAdminSubir(archivo, selectSide.value || null);
          hechas += 1;
        } catch (err) {
          fallo = (err && err.message) || "error desconocido";
          break;
        }
      }
      subiendo = false;
      entrada.value = "";
      estado.textContent = `${hechas} subida${hechas === 1 ? "" : "s"}.`
        + (omitidos ? ` ${omitidos} omitida${omitidos === 1 ? "" : "s"} por tipo o tamaño.` : "")
        + (fallo ? ` Se detuvo: ${fallo}. ¿Corriste scratchpad/fanarts_subidos.sql en Supabase?` : "");
      if (hechas) cargarFanartsAdmin();
    }

    entrada.addEventListener("change", () => { if (entrada.files.length) subir(entrada.files); });
    ["dragenter", "dragover"].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add("arrastrando"); }));
    ["dragleave", "drop"].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove("arrastrando"); }));
    zona.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) subir(e.dataTransfer.files); });
  })();

  function pintarFanartsAdmin(fanarts, reparto, ocultos) {
    const cont = document.getElementById("adminFanartsLista");
    const count = document.getElementById("adminFanartsCount");
    count.textContent = `${fanarts.length} imagen${fanarts.length === 1 ? "" : "es"}`;

    if (!fanarts.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay fanarts todavía.</p>`;
      return;
    }

    cont.innerHTML = fanarts.map(src => {
      const side = reparto[src];
      const oculto = ocultos.has(src);
      return `
        <div class="admin-fanart-card ${oculto ? "is-oculto" : ""}" data-src="${escaparHtml(src)}">
          <img src="${src}" alt="${escaparHtml(prettyName(src))}" loading="lazy">
          <div class="admin-fanart-nombre">${escaparHtml(prettyName(src))}</div>
          <div class="admin-fanart-side">
            <button type="button" class="admin-side-btn ${!side ? "is-active" : ""}" data-side="">Ambos</button>
            <button type="button" class="admin-side-btn ${side === "A" ? "is-active" : ""}" data-side="A">${LADO_NOMBRES.A}</button>
            <button type="button" class="admin-side-btn ${side === "B" ? "is-active" : ""}" data-side="B">${LADO_NOMBRES.B}</button>
          </div>
          <button type="button" class="admin-fanart-eliminar" data-eliminar>${oculto ? "Restaurar" : "Eliminar"}</button>
        </div>
      `;
    }).join("");

    cont.querySelectorAll("[data-side]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const card = btn.closest("[data-src]");
        const nuevoSide = btn.dataset.side || null;
        const anterior = Array.from(card.querySelectorAll("[data-side]")).find(b => b.classList.contains("is-active"));
        card.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("is-active", b === btn));
        try {
          await fanartsAdminSetSide(card.dataset.src, nuevoSide);
        } catch (err) {
          card.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("is-active", b === anterior));
          alert("No se pudo guardar. Prueba de nuevo.");
        }
      });
    });

    cont.querySelectorAll("[data-eliminar]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const card = btn.closest("[data-src]");
        const ocultar = !card.classList.contains("is-oculto");
        if (ocultar && !confirm("¿Eliminar este fanart de la galería? Puedes restaurarlo desde aquí cuando quieras.")) return;
        btn.disabled = true;
        try {
          await fanartsAdminSetOculto(card.dataset.src, ocultar);
          card.classList.toggle("is-oculto", ocultar);
          btn.textContent = ocultar ? "Restaurar" : "Eliminar";
        } catch (err) {
          alert("No se pudo guardar. ¿Corriste scratchpad/fanarts_ocultos.sql en Supabase?");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function textoIntentoMuerte(i) {
    const veredicto = i.veredicto === "confirmado" ? "Confirmado" : i.veredicto === "anulado" ? "Anulado"
      : i.veredicto === "perdonado" ? "Marca quitada" : "Pendiente";
    const estado = i.estado === "en_curso" ? "sin terminar" : i.estado;
    const marcador = i.puntaje === null ? "" : ` · ${i.puntaje} a ${i.puntaje_rival}`;
    return `${estado}${marcador} · ${veredicto}`;
  }

  // Aviso de derrotas nuevas mientras este panel esté abierto: revisa cada 45 s
  // y, si diste permiso, manda una notificación del navegador.
  const derrotasVistas = new Set();
  function vigilarDerrotas(listaInicial) {
    listaInicial.filter(i => i.estado === "perdido").forEach(i => derrotasVistas.add(i.id));
    const boton = document.getElementById("adminMuerteNotificar");
    if (boton) {
      if (!("Notification" in window)) boton.classList.add("hidden");
      else if (Notification.permission === "granted") boton.textContent = "Avisos del navegador activados";
      boton.addEventListener("click", async () => {
        if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
        boton.textContent = Notification.permission === "granted" ? "Avisos del navegador activados" : "El navegador bloqueó los avisos";
      });
    }
    setInterval(async () => {
      try {
        const lista = await msListarIntentos();
        pintarMuerteSubita(lista);
        lista.filter(i => i.estado === "perdido" && !derrotasVistas.has(i.id)).forEach(i => {
          derrotasVistas.add(i.id);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Muerte Súbita", { body: `${i.personaje_nombre} (${i.username}) perdió el desafío ${i.desafio}.` });
          }
        });
      } catch (e) { /* se reintenta en el siguiente ciclo */ }
    }, 45000);
  }

  function pintarMuerteSubita(lista) {
    const cont = document.getElementById("adminMuerteLista");
    const count = document.getElementById("adminMuerteCount");
    const pendientes = lista.filter(i => !i.veredicto).length;
    count.textContent = pendientes ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : "";
    if (!lista.length) {
      cont.innerHTML = `<p class="admin-vacio">Nadie ha intentado un desafío todavía.</p>`;
      return;
    }
    cont.innerHTML = lista.map(i => `
      <div class="admin-cuenta-fila" data-id="${escaparHtml(i.id)}">
        <span class="admin-cuenta-nombre">
          ${escaparHtml(i.personaje_nombre)}
          <span class="admin-cuenta-tag">${escaparHtml(i.username)} · ${escaparHtml(i.desafio)} · ${escaparHtml(textoIntentoMuerte(i))}</span>
        </span>
        <div class="admin-cuenta-acciones">
          ${i.veredicto ? "" : `
            <button type="button" class="admin-cuenta-accion" data-veredicto="confirmado">Confirmar</button>
            <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-veredicto="anulado">Anular</button>`}
          ${i.estado === "perdido" && i.veredicto !== "anulado" && i.veredicto !== "perdonado" ? `
            <button type="button" class="admin-cuenta-accion" data-veredicto="perdonado">Quitar marca</button>` : ""}
        </div>
      </div>`).join("");
    cont.querySelectorAll("[data-veredicto]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const fila = btn.closest("[data-id]");
        const accion = btn.dataset.veredicto;
        const frase = accion === "confirmado" ? "¿Confirmar este resultado?"
          : accion === "perdonado" ? "¿Quitar la marca del Dominio a este personaje? El intento sigue contando, no podrá repetirlo."
          : "¿Anular este intento? Ese personaje podrá volver a intentarlo.";
        if (!confirm(frase)) return;
        btn.disabled = true;
        try {
          await msAdminResolver(fila.dataset.id, accion);
          pintarMuerteSubita(await msListarIntentos());
        } catch (err) {
          alert("No se pudo guardar. Prueba de nuevo.");
          btn.disabled = false;
        }
      });
    });
  }

  // --- Historial de fichas (requiere scratchpad/fichas_historial.sql) ---
  const SEGMENTOS_HISTORIAL = {
    identidad: "Identidad", combate: "Combate", atributos: "Atributos", ajustesAtributos: "Ajuste de atributo",
    atributosRaciales: "Bono racial", salvaciones: "Salvación", habilidades: "Habilidad", lanzamiento: "Lanzamiento",
    inventario: "Inventario", hechizos: "Conjuro", ataques: "Ataque", rasgos: "Rasgo", objetos: "Objeto",
    espacios: "Espacio de conjuro", monedas: "Monedas", macros: "Macro", dadosGolpe: "Dados de golpe",
    fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma",
    nombre: "nombre", nivel: "nivel", nivelTotal: "nivel total", clase: "clase", subclase: "subclase", raza: "raza",
    trasfondo: "trasfondo", alineamiento: "alineamiento", pronombres: "pronombres", historia: "historia",
    descripcionFisica: "descripción física", notasPublicas: "notas", retrato: "avatar", fichaFoto: "foto de la ficha",
    pvMax: "PV máximos", pvActual: "PV actuales", pvTemp: "PV temporales", velocidad: "velocidad",
    disponible: "disponible", usados: "usados", max: "máximos", actuales: "actuales", dano: "daño",
    tipoDano: "tipo de daño", descripcion: "descripción", cantidad: "cantidad", estado: "estado",
    competente: "competente", ajuste: "ajuste", oro: "oro", plata: "plata", cobre: "cobre",
    archivado: "Archivado", fallecido: "Fallecido", fecha: "fecha", decoraciones: "Pegatinas", puntosFeats: "Puntos de feat", side: "Side"
  };

  function etiquetaRutaHistorial(ruta) {
    return String(ruta).split(".").map(seg => {
      const m = seg.match(/^([^\[]+)(\[(.+)\])?$/);
      if (!m) return seg;
      const base = SEGMENTOS_HISTORIAL[m[1]] || m[1];
      return m[3] ? `${base} «${m[3]}»` : base;
    }).join(" · ");
  }

  function valorHistorial(v) {
    if (v === null || v === undefined || v === "") return "vacío";
    if (v === true) return "sí";
    if (v === false) return "no";
    if (typeof v === "string") return `"${v.length > 80 ? v.slice(0, 80) + "…" : v}"`;
    if (typeof v === "object") { const t = JSON.stringify(v); return t.length > 80 ? t.slice(0, 80) + "…" : t; }
    return String(v);
  }

  function lineaCambioHistorial(c) {
    const ruta = `<span class="adm-hist-ruta">${escaparHtml(etiquetaRutaHistorial(c.ruta))}</span>`;
    if (c.imagen) return `<li>${ruta} cambió la imagen</li>`;
    if (c.accion === "agregado") return `<li>${ruta} agregado</li>`;
    if (c.accion === "quitado") return `<li>${ruta} quitado</li>`;
    if (c.nota) return `<li class="adm-hist-nota">${escaparHtml(c.nota)}</li>`;
    return `<li>${ruta}: <span class="adm-hist-antes">${escaparHtml(valorHistorial(c.antes))}</span> → <span class="adm-hist-despues">${escaparHtml(valorHistorial(c.despues))}</span></li>`;
  }

  let historialFichas = [];

  function pintarHistorialFichas() {
    const cont = document.getElementById("adminHistorialLista");
    const jugador = document.getElementById("adminHistorialJugador").value;
    const q = document.getElementById("adminHistorialBuscar").value.trim().toLowerCase();
    const filas = historialFichas.filter(f => {
      if (jugador && f.actor_username !== jugador) return false;
      if (!q) return true;
      const texto = [f.ficha_nombre, f.actor_username, ...(f.cambios || []).map(c => etiquetaRutaHistorial(c.ruta))].join(" ").toLowerCase();
      return texto.includes(q);
    });
    if (!filas.length) {
      cont.innerHTML = `<p class="admin-vacio">No hay cambios registrados con ese filtro.</p>`;
      return;
    }
    let diaActual = "";
    cont.innerHTML = filas.map(f => {
      const fecha = new Date(f.creado_en);
      const dia = fecha.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
      const encabezadoDia = dia !== diaActual ? `<h3 class="adm-hist-dia">${escaparHtml(dia)}</h3>` : "";
      diaActual = dia;
      const hora = fecha.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
      const quien = escaparHtml(f.actor_username || "alguien");
      const personaje = escaparHtml(f.ficha_nombre || "Sin nombre");
      let cuerpo = "";
      if (f.accion === "creada") cuerpo = `<p class="adm-hist-accion">creó el personaje</p>`;
      else if (f.accion === "eliminada") cuerpo = `<p class="adm-hist-accion">eliminó el personaje</p>`;
      else {
        const lineas = (f.cambios || []).map(lineaCambioHistorial);
        const visibles = lineas.slice(0, 6).join("");
        const resto = lineas.slice(6);
        cuerpo = `<ul class="adm-hist-cambios">${visibles}</ul>` + (resto.length
          ? `<details class="adm-hist-mas"><summary>…y ${resto.length} cambios más</summary><ul class="adm-hist-cambios">${resto.join("")}</ul></details>`
          : "");
      }
      return `${encabezadoDia}
        <div class="adm-hist-fila">
          <div class="adm-hist-cab"><strong>${personaje}</strong> <span>${quien} · ${hora}</span></div>
          ${cuerpo}
        </div>`;
    }).join("");
  }

  async function cargarHistorialFichas() {
    const cont = document.getElementById("adminHistorialLista");
    try {
      historialFichas = await adminListarHistorialFichas(300);
      document.getElementById("adminHistorialCount").textContent = String(historialFichas.length);
      const select = document.getElementById("adminHistorialJugador");
      const nombres = [...new Set(historialFichas.map(f => f.actor_username).filter(Boolean))].sort();
      select.innerHTML = `<option value="">Todos los jugadores</option>` + nombres.map(n => `<option value="${escaparHtml(n)}">${escaparHtml(n)}</option>`).join("");
      select.addEventListener("change", pintarHistorialFichas);
      document.getElementById("adminHistorialBuscar").addEventListener("input", pintarHistorialFichas);
      pintarHistorialFichas();
    } catch (e) {
      console.error("[admin] Historial de fichas falló:", e);
      cont.innerHTML = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/fichas_historial.sql en Supabase?</p>`;
    }
  }

  // --- Cartas malditas (requiere scratchpad/cartas.sql) ---
  async function cargarCartasAdmin() {
    const estadoEl = document.getElementById("adminCartasEstado");
    const registroEl = document.getElementById("adminCartasRegistro");
    const jugadorEl = document.getElementById("adminCartasJugador");
    const cartaEl = document.getElementById("adminCartasCarta");
    const nombreCarta = id => (window.cartaPorId(id) || { nombre: id }).nombre;
    let jugadores = [];
    try {
      jugadores = await adminListarPerfiles();
    } catch (e) {
      registroEl.innerHTML = `<li>No se pudo cargar la lista de jugadores.</li>`;
      return;
    }
    const nombreJugador = id => (jugadores.find(j => j.id === id) || {}).username || "(desconocido)";
    jugadorEl.innerHTML = jugadores.map(j => `<option value="${j.id}">${escaparHtml(j.username || "(sin nombre)")}${j.side ? ` · ${j.side}` : ""}</option>`).join("");
    const orden = Object.entries(window.CARTAS_RAREZAS).sort((a, b) => a[1].orden - b[1].orden);
    cartaEl.innerHTML = orden.map(([clave, r]) => {
      const cartas = window.CARTAS.filter(c => c.rareza === clave);
      return cartas.length ? `<optgroup label="${r.nombre}">${cartas.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}${c.lado ? ` (${c.lado.join("/")})` : ""}${c.limite ? ` · edición de ${c.limite}` : ""}</option>`).join("")}</optgroup>` : "";
    }).join("");

    async function pintarRegistro() {
      try {
        const supabase = await fichasCliente();
        const { data, error } = await supabase.from("cartas_registro")
          .select("user_id, carta_id, origen, detalle, creado").order("creado", { ascending: false }).limit(40);
        if (error) throw error;
        document.getElementById("adminCartasCount").textContent = String(data.length);
        const etiqueta = { juego: "minijuego", admin: "regalo", quitada: "quitada" };
        registroEl.innerHTML = data.length ? data.map(f => `<li><span>${new Date(f.creado).toLocaleString("es")}</span><span>${escaparHtml(nombreJugador(f.user_id))}</span><span>${escaparHtml(nombreCarta(f.carta_id))}</span><span>${etiqueta[f.origen] || f.origen}${f.detalle ? ` · ${escaparHtml(f.detalle)}` : ""}</span></li>`).join("") : `<li>Todavía no hay movimientos.</li>`;
      } catch (e) {
        registroEl.innerHTML = `<li>No se pudo cargar. ¿Corriste scratchpad/cartas.sql en Supabase?</li>`;
      }
    }

    async function ejecutar(funcion, textoOk) {
      estadoEl.textContent = "...";
      try {
        const supabase = await fichasCliente();
        const { data, error } = await supabase.rpc(funcion, {
          p_usuario: jugadorEl.value, p_carta: cartaEl.value, p_nota: document.getElementById("adminCartasNota").value.trim()
        });
        if (error) throw error;
        const numero = data && data.numero ? ` (copia ${data.numero})` : "";
        estadoEl.textContent = `${textoOk}: ${nombreCarta(cartaEl.value)}${numero} → ${nombreJugador(jugadorEl.value)}.`;
        document.getElementById("adminCartasNota").value = "";
        pintarRegistro();
      } catch (e) {
        estadoEl.textContent = `No se pudo: ${e.message || e}`;
      }
    }
    document.getElementById("adminCartasRegalar").addEventListener("click", () => ejecutar("cartas_regalar", "Regalada"));
    document.getElementById("adminCartasQuitar").addEventListener("click", () => {
      if (confirm(`¿Quitar una copia de ${nombreCarta(cartaEl.value)} a ${nombreJugador(jugadorEl.value)}?`)) ejecutar("cartas_quitar", "Quitada");
    });
    pintarRegistro();
  }

  initAdminGate(async () => {
    cargarCartasAdmin();
    const peticionesEl = document.getElementById("adminPeticionesLista");
    const cuentasEl = document.getElementById("adminCuentasLista");
    try {
      const [peticiones, cuentas] = await Promise.all([adminListarPeticiones(), adminListarPerfiles()]);
      pintarPeticiones(peticiones);
      // Los DJ se piden aparte: si todavía no se corrió ritmo_dj.sql, las cuentas se ven igual
      let djs = new Set();
      try { djs = new Set(await adminListarDJs()); } catch (e) { /* sin rol DJ todavía */ }
      pintarCuentas(cuentas, djs);
    } catch (e) {
      const mensaje = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/panel-admin.sql en Supabase?</p>`;
      peticionesEl.innerHTML = mensaje;
      cuentasEl.innerHTML = mensaje;
    }

    // Sección separada e independiente: usa scratchpad/panel-admin-bufon.sql,
    // un script aparte del resto del panel, así que su falla no debe tapar
    // Peticiones/Cuentas si todavía no se corrió.
    await cargarProgresoBufon();

    // Muerte Súbita (requiere scratchpad/muerte_subita.sql), también por separado.
    const muerteEl = document.getElementById("adminMuerteLista");
    try {
      const lista = await msListarIntentos();
      pintarMuerteSubita(lista);
      vigilarDerrotas(lista);
    } catch (e) {
      muerteEl.innerHTML = `<p class="admin-vacio">No se pudo cargar. ¿Corriste scratchpad/muerte_subita.sql en Supabase?</p>`;
    }

    await cargarHistorialFichas();

    // Independiente también: requiere scratchpad/fanarts_side.sql.
    await cargarFanartsAdmin();
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
