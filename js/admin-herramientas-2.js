/* =============================================================================
   HERRAMIENTAS DE ADMIN, segunda tanda (docs/admin/herramientas_2.sql):
   Interruptores, Mensajes a jugadores, En vivo (quién está conectado), Archivos (imágenes y audio), suspensión de cuentas
   (botón en la pestaña Cuentas) y respuestas a peticiones (en la pestaña Peticiones).
============================================================================= */
(function () {
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = id => document.getElementById(id);
  const cuando = iso => { try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const falta = e => /not find the (table|function)|does not exist|PGRST20[25]|42P01|42883/i.test(`${(e && e.code) || ""} ${(e && e.message) || ""}`);
  const errorSql = e => falta(e) ? "Falta correr docs/admin/herramientas_2.sql en Supabase." : (e.message || String(e));
  const alAbrir = (tab, fn) => { const b = document.querySelector(`[data-tab="${tab}"]`); if (b) b.addEventListener("click", fn); };
  const cliente = () => fichasCliente();

  /* ===========================================================================
     INTERRUPTORES
  =========================================================================== */
  const INTERRUPTORES = [
    ["huella_bufon", "El gorro del Bufón en el compendio", "El gorro escondido que lleva, tras varios clics, a la puerta del Bufón."],
    ["huella_risita", "La risita del gorro", "El sonido de la risa al aparecer y al hacer clic en el gorro."],
    ["musica_paginas", "Música de fondo de las páginas", "Las playlists que configuraste con el botón ⚙. Apagado, cada página vuelve a su sonido de siempre."],
    ["presencia", "«En la taberna» (quién está conectado)", "La lista del lobby con quién está conectado y qué hace. Apagarlo también quita la pestaña En vivo."]
  ];

  async function pintarInterruptores() {
    const lista = $("adminInterruptoresLista");
    try {
      const { data, error } = await (await cliente()).from("sitio_interruptores").select("clave, activo, actualizada");
      if (error) throw error;
      const estado = new Map((data || []).map(f => [f.clave, f]));
      lista.innerHTML = INTERRUPTORES.map(([clave, nombre, ayuda]) => {
        const f = estado.get(clave), activo = !f || f.activo;
        return `<label class="admin-interruptor"><input type="checkbox" data-clave="${clave}"${activo ? " checked" : ""}>
          <span><strong>${esc(nombre)}</strong><small>${esc(ayuda)}</small>${f ? `<em>Cambiado ${esc(cuando(f.actualizada))}</em>` : ""}</span></label>`;
      }).join("");
    } catch (e) {
      lista.innerHTML = `<p class="admin-vacio">${esc(errorSql(e))}</p>`;
    }
  }

  function iniciarInterruptores() {
    if (!$("adminPanelInterruptores")) return;
    alAbrir("interruptores", pintarInterruptores);
    $("adminInterruptoresLista").addEventListener("change", async ev => {
      const c = ev.target.closest("input[data-clave]");
      if (!c) return;
      c.disabled = true;
      try {
        const { error } = await (await cliente()).rpc("interruptor_poner", { p_clave: c.dataset.clave, p_activo: c.checked });
        if (error) throw error;
        $("adminInterruptoresEstado").textContent = "Guardado. Se nota en la siguiente página que abra cada jugador.";
      } catch (e) {
        c.checked = !c.checked;
        $("adminInterruptoresEstado").textContent = `No se pudo: ${errorSql(e)}`;
      } finally { c.disabled = false; }
    });
  }

  /* ===========================================================================
     MENSAJES
  =========================================================================== */
  async function pintarMensajes() {
    const lista = $("adminMensajesLista"), dest = $("adminMensajeDestino");
    try {
      const supabase = await cliente();
      if (dest.options.length <= 3) {
        // Todas las cuentas salen de la misma función del servidor que usa la pestaña Cuentas (la tabla perfiles solo deja ver la propia)
        const cuentas = await adminListarPerfiles();
        cuentas.slice().sort((a, b) => String(a.username || "").localeCompare(String(b.username || ""), "es"))
          .forEach(c => dest.insertAdjacentHTML("beforeend", `<option value="u:${esc(c.id)}">${esc(c.username || "(sin nombre)")}</option>`));
      }
      const { data, error } = await supabase.from("admin_mensajes").select("id, texto, para, side, creado, expira, activo").order("id", { ascending: false }).limit(30);
      if (error) throw error;
      const nombres = new Map([...dest.options].filter(o => o.value.startsWith("u:")).map(o => [o.value.slice(2), o.textContent]));
      lista.innerHTML = data.length ? data.map(m => {
        const para = m.para ? `para ${nombres.get(m.para) || "una cuenta"}` : m.side ? `para el Side ${m.side}` : "para todos";
        const vivo = m.activo && (!m.expira || new Date(m.expira) > new Date());
        return `<div class="admin-cambio${vivo ? "" : " revertido"}"><div class="admin-cambio-top"><span>${esc(cuando(m.creado))}</span><span>${esc(para)}</span><span>${vivo ? "visible" : (m.activo ? "caducado" : "quitado")}</span></div>
          <div class="admin-cambio-que">${esc(m.texto)}</div>${vivo ? `<button type="button" class="admin-cuenta-accion" data-quitar="${m.id}">Quitar</button>` : ""}</div>`;
      }).join("") : `<p class="admin-vacio">Todavía no has enviado mensajes.</p>`;
    } catch (e) {
      lista.innerHTML = `<p class="admin-vacio">${esc(errorSql(e))}</p>`;
    }
  }

  function iniciarMensajes() {
    if (!$("adminPanelMensajes")) return;
    alAbrir("mensajes", pintarMensajes);
    $("adminMensajeForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const texto = $("adminMensajeTexto").value.trim();
      const d = $("adminMensajeDestino").value;
      const dias = $("adminMensajeDias").value;
      if (!texto) { $("adminMensajeEstado").textContent = "Escribe el mensaje."; return; }
      $("adminMensajeEstado").textContent = "Enviando...";
      try {
        const { error } = await (await cliente()).rpc("admin_mensaje_enviar", {
          p_texto: texto, p_para: d.startsWith("u:") ? d.slice(2) : null, p_side: d === "A" || d === "B" ? d : null, p_dias: dias ? Number(dias) : null
        });
        if (error) throw error;
        $("adminMensajeTexto").value = "";
        $("adminMensajeEstado").textContent = "Enviado. Lo verán al abrir una página (una sola vez).";
        pintarMensajes();
      } catch (e) { $("adminMensajeEstado").textContent = `No se pudo: ${errorSql(e)}`; }
    });
    $("adminMensajesLista").addEventListener("click", async ev => {
      const b = ev.target.closest("[data-quitar]");
      if (!b) return;
      try { const { error } = await (await cliente()).rpc("admin_mensaje_quitar", { p_id: Number(b.dataset.quitar) }); if (error) throw error; pintarMensajes(); }
      catch (e) { dialogo.avisar(`No se pudo quitar: ${errorSql(e)}`, { tipoAviso: "error" }); }
    });
  }

  /* ===========================================================================
     EN VIVO: quién está conectado ahora, en qué página y desde cuándo (presencia, no guarda nada)
  =========================================================================== */
  const NOMBRES_PAG = {
    "index.html": "Lobby", "compendio.html": "Compendio", "mapa.html": "Mapa", "cronologia.html": "Cronología", "lugares.html": "Lugares", "facciones.html": "Facciones",
    "personajes.html": "Personajes", "razas.html": "Razas", "religion.html": "Religión", "textos.html": "Textos", "pergaminos.html": "Pergaminos", "armas.html": "Armas",
    "objetos.html": "Objetos", "bestiario.html": "Bestiario", "reglas.html": "Reglas", "economia.html": "Economía", "estadisticas.html": "Estadísticas",
    "fanarts.html": "Fanarts", "peticiones.html": "Peticiones", "fichas.html": "Mis personajes", "minijuegos.html": "Minijuegos", "ajedrez.html": "Ajedrez",
    "arqueria.html": "Arquería", "ritmo.html": "Zarabanda", "parranda.html": "Parranda", "rocola.html": "Rocola", "sacrificio.html": "Hooey", "intercambios.html": "Intercambios", "fractura.html": "La Fractura"
  };
  const hace = ms => { const m = Math.round(ms / 60000); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`; };

  function iniciarEnVivo() {
    if (!$("adminPanelEnvivo") || !window.Presencia) return;
    let ultimo = [];
    const pintar = () => {
      const lista = $("adminEnVivoLista");
      $("adminEnVivoCount").textContent = ultimo.length ? String(ultimo.length) : "";
      lista.innerHTML = ultimo.length ? ultimo.map(p => `<div class="admin-sistema-fila ok">
        <span class="admin-sistema-marca">●</span>
        <span class="admin-sistema-que"><strong>${esc(p.nombre)}</strong>${p.oculto ? " <small>en otra pestaña</small>" : ""}<br><small>${esc(p.frase)}</small></span>
        <span class="admin-sistema-sql">${esc(p.pag ? (NOMBRES_PAG[p.pag] || p.pag) : "página escondida")}${p.desde ? `<br><small>${hace(Date.now() - p.desde)}</small>` : ""}</span></div>`).join("")
        : `<p class="admin-vacio">Nadie conectado ahora mismo (o tienes apagada «En la taberna» en Interruptores).</p>`;
    };
    window.Presencia.suscribir(l => { ultimo = l; pintar(); });
    setInterval(pintar, 30000);
  }

  /* ===========================================================================
     ARCHIVOS: subir imágenes y audio al sitio y copiar su enlace
  =========================================================================== */
  const BUCKET = "archivos";
  const MAX_BYTES = 20 * 1024 * 1024;
  const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4"];
  const urlPublica = ruta => `${window.FICHAS_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${ruta.split("/").map(encodeURIComponent).join("/")}`;

  async function listarArchivos() {
    const lista = $("adminArchivosLista");
    try {
      const { data, error } = await (await cliente()).storage.from(BUCKET).list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const archivos = (data || []).filter(f => f.id);
      lista.innerHTML = archivos.length ? archivos.map(f => {
        const url = urlPublica(f.name), imagen = /\.(png|jpe?g|webp|gif)$/i.test(f.name);
        return `<div class="admin-archivo"><div class="admin-archivo-vista">${imagen ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<audio controls preload="none" src="${esc(url)}"></audio>`}</div>
          <div class="admin-archivo-nombre" title="${esc(f.name)}">${esc(f.name)}</div>
          <div class="admin-archivo-botones"><button type="button" class="admin-cuenta-accion" data-copiar="${esc(url)}">Copiar enlace</button>
          <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-borrar="${esc(f.name)}">Borrar</button></div></div>`;
      }).join("") : `<p class="admin-vacio">Todavía no hay archivos.</p>`;
    } catch (e) {
      lista.innerHTML = `<p class="admin-vacio">${esc(/not found|bucket/i.test(e.message || "") ? "Falta correr docs/admin/herramientas_2.sql en Supabase." : (e.message || e))}</p>`;
    }
  }

  async function subirArchivos(archivos) {
    const estado = $("adminArchivosEstado");
    const supabase = await cliente();
    let hechos = 0;
    for (const a of Array.from(archivos)) {
      if (!TIPOS.includes(a.type) || a.size > MAX_BYTES) { estado.textContent = `«${a.name}» no es una imagen o audio válido (hasta 20 MB).`; continue; }
      estado.textContent = `Subiendo ${a.name}...`;
      const limpio = a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "archivo";
      const ruta = `${Date.now().toString(36)}-${limpio}`;
      const { error } = await supabase.storage.from(BUCKET).upload(ruta, a, { contentType: a.type, cacheControl: "31536000" });
      if (error) { estado.textContent = `No se pudo subir «${a.name}»: ${error.message}`; return; }
      hechos++;
    }
    if (hechos) estado.textContent = `${hechos} archivo${hechos === 1 ? "" : "s"} subido${hechos === 1 ? "" : "s"}. Copia el enlace y pégalo donde lo necesites (por ejemplo en el HTML de una entrada).`;
    listarArchivos();
  }

  function iniciarArchivos() {
    if (!$("adminPanelArchivos")) return;
    alAbrir("archivos", listarArchivos);
    $("adminArchivosInput").addEventListener("change", ev => { if (ev.target.files.length) subirArchivos(ev.target.files); ev.target.value = ""; });
    const zona = $("adminPanelArchivos");
    ["dragenter", "dragover"].forEach(t => zona.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); zona.classList.add("arrastrando"); } }));
    ["dragleave", "drop"].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.remove("arrastrando"); }));
    zona.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) subirArchivos(e.dataTransfer.files); });
    $("adminArchivosLista").addEventListener("click", async ev => {
      const c = ev.target.closest("[data-copiar]");
      if (c) {
        try { await navigator.clipboard.writeText(c.dataset.copiar); c.textContent = "Copiado"; setTimeout(() => { c.textContent = "Copiar enlace"; }, 1500); }
        catch (e) { dialogo.copiar("Copia el enlace a mano:", c.dataset.copiar); }
      }
      const b = ev.target.closest("[data-borrar]");
      if (b && await dialogo.confirmar(`¿Borrar «${b.dataset.borrar}»? Si alguna página lo usa, dejará de verse.`, { titulo: "Borrar archivo", aceptar: "Borrar", peligro: true })) {
        const { error } = await (await cliente()).storage.from(BUCKET).remove([b.dataset.borrar]);
        if (error) dialogo.avisar(`No se pudo borrar: ${error.message}`, { tipoAviso: "error" }); else listarArchivos();
      }
    });
  }

  /* ===========================================================================
     CUENTAS: botón para suspender / levantar (se añade a cada fila que pinta admin.js)
  =========================================================================== */
  let suspendidas = new Map();
  async function cargarSuspendidas() {
    try {
      const { data, error } = await (await cliente()).from("cuentas_suspendidas").select("user_id, motivo, hasta");
      if (error) throw error;
      suspendidas = new Map((data || []).map(f => [f.user_id, f]));
    } catch (e) { suspendidas = new Map(); }
  }

  function decorarCuentas() {
    document.querySelectorAll("#adminCuentasLista .admin-cuenta-fila").forEach(fila => {
      if (fila.dataset.suspension === "1" || fila.dataset.esAdmin === "1") return;
      const acciones = fila.querySelector(".admin-cuenta-acciones");
      if (!acciones) return;
      fila.dataset.suspension = "1";
      const susp = suspendidas.get(fila.dataset.id);
      const b = document.createElement("button");
      b.type = "button"; b.className = "admin-cuenta-accion admin-cuenta-peligro"; b.dataset.suspender = fila.dataset.id;
      b.textContent = susp ? "Levantar suspensión" : "Suspender";
      b.title = "Al abrir cualquier página, la cuenta suspendida ve el aviso y se le cierra la sesión. No borra nada.";
      acciones.appendChild(b);
      if (susp) fila.querySelector(".admin-cuenta-nombre").insertAdjacentHTML("beforeend", ` <span class="admin-cuenta-tag">Suspendida${susp.hasta ? ` hasta ${esc(cuando(susp.hasta))}` : ""}</span>`);
    });
  }

  function iniciarSuspensiones() {
    const cont = $("adminCuentasLista");
    if (!cont) return;
    cargarSuspendidas().then(decorarCuentas);
    new MutationObserver(() => decorarCuentas()).observe(cont, { childList: true });
    cont.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-suspender]");
      if (!b) return;
      const id = b.dataset.suspender;
      const fila = b.closest(".admin-cuenta-fila");
      const nombre = fila.querySelector(".admin-cuenta-usuario").textContent.trim();
      try {
        const supabase = await cliente();
        if (suspendidas.has(id)) {
          if (!(await dialogo.confirmar(`¿Levantar la suspensión de "${nombre}"?`, { titulo: "Levantar suspensión" }))) return;
          const { error } = await supabase.rpc("cuenta_levantar", { p_usuario: id }); if (error) throw error;
        } else {
          const v = await dialogo.formulario(`Suspender a "${nombre}"`, [
            { id: "motivo", etiqueta: "Motivo (lo verá la persona)", tipo: "text" },
            { id: "dias", etiqueta: "Días (vacío = hasta que la levantes)", tipo: "number" }
          ], { titulo: "Suspender cuenta", aceptar: "Suspender" });
          if (!v) return;
          const { error } = await supabase.rpc("cuenta_suspender", { p_usuario: id, p_motivo: v.motivo || "", p_dias: v.dias ? Number(v.dias) : null }); if (error) throw error;
        }
        await cargarSuspendidas();
        fila.dataset.suspension = ""; fila.querySelector("[data-suspender]").remove();
        fila.querySelectorAll(".admin-cuenta-nombre .admin-cuenta-tag:not([hidden])").forEach(t => { if (/Suspendida/.test(t.textContent)) t.remove(); });
        decorarCuentas();
      } catch (e) { dialogo.avisar(`No se pudo: ${errorSql(e)}`, { tipoAviso: "error" }); }
    });
  }

  /* ===========================================================================
     PETICIONES: responder desde cada tarjeta (la persona ve la respuesta con su código)
  =========================================================================== */
  let respuestas = new Map();
  async function cargarRespuestas() {
    try {
      const { data, error } = await (await cliente()).from("peticiones").select("id, respuesta");
      if (error) throw error;
      respuestas = new Map((data || []).map(f => [f.id, f.respuesta || ""]));
    } catch (e) { respuestas = new Map(); }   // sin la columna todavía: no se ofrece responder
  }

  function decorarPeticiones() {
    document.querySelectorAll("#adminPeticionesLista .admin-peticion-card").forEach(card => {
      if (card.dataset.resp === "1" || !respuestas.size) return;
      card.dataset.resp = "1";
      const id = card.dataset.id;
      card.insertAdjacentHTML("beforeend", `<div class="admin-respuesta"><label>Respuesta (la verá quien la envió, junto a «Atendida»)
        <textarea rows="2" maxlength="1000" data-resp-texto>${"\n" + esc(respuestas.get(id) || "")}</textarea></label>
        <button type="button" class="admin-cuenta-accion" data-responder="${esc(id)}">${respuestas.get(id) ? "Guardar respuesta" : "Responder"}</button></div>`);
    });
  }

  function iniciarPeticiones() {
    const cont = $("adminPeticionesLista");
    if (!cont) return;
    cargarRespuestas().then(decorarPeticiones);
    new MutationObserver(() => cargarRespuestas().then(decorarPeticiones)).observe(cont, { childList: true });
    cont.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-responder]");
      if (!b) return;
      const texto = b.closest(".admin-respuesta").querySelector("[data-resp-texto]").value.trim();
      b.disabled = true;
      try {
        const { error } = await (await cliente()).rpc("peticion_responder", { p_id: b.dataset.responder, p_respuesta: texto });
        if (error) throw error;
        respuestas.set(b.dataset.responder, texto);
        b.textContent = texto ? "Guardada ✓" : "Respuesta quitada";
        const check = b.closest(".admin-peticion-card").querySelector("[data-atendida]");
        if (check) check.checked = true;
      } catch (e) { dialogo.avisar(`No se pudo responder: ${errorSql(e)}`, { tipoAviso: "error" }); }
      finally { b.disabled = false; }
    });
  }

  iniciarInterruptores();
  iniciarMensajes();
  iniciarEnVivo();
  iniciarArchivos();
  iniciarSuspensiones();
  iniciarPeticiones();
})();
