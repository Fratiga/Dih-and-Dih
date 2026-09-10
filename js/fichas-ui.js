/* =============================================================================
   INTERFAZ — lista de personajes, importación (PDF/JSON), y la ficha con
   sus 8 pestañas. Todo el cálculo vive en fichas-calc.js, todo el texto
   para Roll20 en fichas-roll20.js, todo el guardado en fichas-storage.js:
   este archivo solo arma DOM y responde a eventos.
============================================================================= */
(function () {
  let personajeActual = null;
  let importacionPendiente = null; // { personaje, pendientesRevision } antes de confirmar
  let autoguardadoTimeout = null;
  let modoPorItemRoll20 = {}; // { [idSintetico]: { modo, preguntar } } — transitorio, no se persiste
  let miEmail = null; // email de la sesión actual — para saber si una ficha es "de otro" (solo pasa si sos Admin)
  let decoracionArrastre = null; // estado transitorio del arrastre/redimensión de una pegatina en curso

  const NOMBRES_ATRIBUTOS = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };

  /* --- Utilidades de path genérico (para el data-binding) ---------------- */
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const partes = path.split(".");
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) o = o[partes[i]];
    o[partes[partes.length - 1]] = value;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --- Vistas -------------------------------------------------------------- */
  function mostrarVista(nombre) {
    document.getElementById("fichasListaVista").classList.toggle("hidden", nombre !== "lista");
    document.getElementById("fichasRevisionVista").classList.toggle("hidden", nombre !== "revision");
    document.getElementById("fichasFichaVista").classList.toggle("hidden", nombre !== "ficha");
  }

  /* ==========================================================================
     LISTA DE PERSONAJES
  ========================================================================== */
  async function cargarLista() {
    const grid = document.getElementById("fichasGrid");
    const vacio = document.getElementById("fichasVacio");
    let personajes = [];
    try {
      personajes = await fichasStorage.listar();
    } catch (err) {
      grid.innerHTML = `<p class="fichas-auth-status error">No se pudo cargar la lista: ${esc(err.message || err)}</p>`;
      return;
    }
    vacio.classList.toggle("hidden", personajes.length > 0);
    grid.innerHTML = personajes.map(p => tarjetaHTML(p)).join("");

    grid.querySelectorAll("[data-abrir]").forEach(el => {
      el.addEventListener("click", () => abrirFicha(el.dataset.abrir));
    });
    grid.querySelectorAll("[data-menu-toggle]").forEach(el => {
      el.addEventListener("click", e => {
        e.stopPropagation();
        const menu = el.closest(".fichas-card").querySelector(".fichas-card-menu");
        document.querySelectorAll(".fichas-card-menu").forEach(m => { if (m !== menu) m.classList.add("hidden"); });
        menu.classList.toggle("hidden");
      });
    });
    grid.querySelectorAll("[data-duplicar]").forEach(el => {
      el.addEventListener("click", async e => {
        e.stopPropagation();
        await fichasStorage.duplicar(el.dataset.duplicar);
        cargarLista();
      });
    });
    grid.querySelectorAll("[data-exportar]").forEach(el => {
      el.addEventListener("click", async e => {
        e.stopPropagation();
        const json = await fichasExportarUno(el.dataset.exportar);
        descargarTexto(json, `ficha-${el.dataset.exportar}.json`);
      });
    });
    grid.querySelectorAll("[data-archivar]").forEach(el => {
      el.addEventListener("click", async e => {
        e.stopPropagation();
        await fichasStorage.archivar(el.dataset.archivar, true);
        cargarLista();
      });
    });
    grid.querySelectorAll("[data-eliminar]").forEach(el => {
      el.addEventListener("click", async e => {
        e.stopPropagation();
        const nombre = el.dataset.nombre || "este personaje";
        if (!confirm(`¿Eliminar "${nombre}" para siempre? Esto no se puede deshacer.`)) return;
        await fichasStorage.eliminar(el.dataset.eliminar);
        cargarLista();
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".fichas-card-menu").forEach(m => m.classList.add("hidden"));
    });
  }

  function tarjetaHTML(p) {
    const clases = [p.identidad.clase, ...(p.identidad.clasesExtra || []).map(c => c.nombre)].filter(Boolean).join(" / ");
    const esDeOtro = p.ownerEmail && p.ownerEmail !== miEmail;
    return `
      <article class="fichas-card">
        <button type="button" class="fichas-card-menu-btn" data-menu-toggle title="Más opciones">⋮</button>
        <div class="fichas-card-menu hidden">
          <button type="button" data-duplicar="${p.id}">Duplicar</button>
          <button type="button" data-exportar="${p.id}">Exportar JSON</button>
          <button type="button" data-archivar="${p.id}">Archivar</button>
          <button type="button" class="fichas-menu-peligro" data-eliminar="${p.id}" data-nombre="${esc(p.identidad.nombre || "Sin nombre")}">Eliminar</button>
        </div>
        <div class="fichas-card-top">
          <div class="fichas-card-retrato">${p.identidad.retrato ? `<img src="${esc(p.identidad.retrato)}" alt="">` : (p.identidad.nombre || "?")[0].toUpperCase()}</div>
          <div>
            <h3 class="fichas-card-nombre">${esc(p.identidad.nombre || "Sin nombre")}</h3>
            <p class="fichas-card-meta">${esc(p.identidad.raza || "—")} · ${esc(clases || "—")} · Nv. ${esc(p.identidad.nivelTotal)}</p>
            ${esDeOtro ? `<p class="fichas-card-dueno">De: ${esc(p.ownerUsername || p.ownerEmail)}</p>` : ""}
          </div>
        </div>
        <div class="fichas-card-stats">
          <span>PV <strong>${esc(p.combate.pvActual)}/${esc(p.combate.pvMax)}</strong></span>
          <span>CA <strong>${esc(fichasCATotal(p))}</strong></span>
          ${p.side ? `<span>${esc(p.side)}</span>` : ""}
        </div>
        <button type="button" class="secondary-button fichas-card-abrir" data-abrir="${p.id}">Abrir ficha</button>
      </article>
    `;
  }

  function descargarTexto(texto, nombreArchivo) {
    const blob = new Blob([texto], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ==========================================================================
     CREAR / IMPORTAR
  ========================================================================== */
  async function crearPersonaje() {
    const nuevo = fichasPersonajeVacio();
    await fichasStorage.guardar(nuevo);
    await abrirFicha(nuevo.id);
  }

  function leerArchivoComoArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  function leerArchivoComoTexto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function manejarImportarPdf(file) {
    try {
      const buffer = await leerArchivoComoArrayBuffer(file);
      const resultado = await fichasImportarPdf(buffer);
      importacionPendiente = { personaje: resultado.personaje, pendientesRevision: resultado.pendientesRevision, esNuevoDeCero: true };
      mostrarRevision(`Detectado como: ${resultado.adaptador}`);
    } catch (err) {
      alert("No se pudo importar el PDF: " + (err.message || err));
    }
  }

  async function manejarImportarJson(file) {
    try {
      const texto = await leerArchivoComoTexto(file);
      const val = fichasValidarImportacion(texto);
      if (!val.ok) { alert(val.error); return; }
      // Si son varias fichas en un respaldo, se importan todas directo
      // (ya son fichas completas y válidas, no un borrador a revisar campo
      // por campo como el PDF) y se vuelve a la lista.
      if (val.personajes.length > 1) {
        if (!confirm(`Este archivo tiene ${val.personajes.length} personajes. ¿Importarlos todos?`)) return;
        await fichasImportarRespaldo(val.personajes);
        cargarLista();
        return;
      }
      importacionPendiente = { personaje: val.personajes[0], pendientesRevision: [], esNuevoDeCero: false };
      mostrarRevision("Respaldo JSON de este sitio");
    } catch (err) {
      alert("No se pudo leer el archivo: " + (err.message || err));
    }
  }

  function mostrarRevision(origenTexto) {
    const p = importacionPendiente.personaje;
    document.getElementById("fichasRevisionEyebrow").textContent = origenTexto.toUpperCase();

    const pendCont = document.getElementById("fichasRevisionPendientes");
    if (importacionPendiente.pendientesRevision.length) {
      pendCont.innerHTML = `<strong>Revisa esto antes de guardar:</strong><ul>${importacionPendiente.pendientesRevision.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
    } else {
      pendCont.innerHTML = `<strong>Todo se pudo leer con claridad — igual, echale un vistazo antes de guardar.</strong>`;
    }

    const campo = (label, valor) => `<div class="fichas-revision-campo"><small>${esc(label)}</small>${esc(valor)}</div>`;
    document.getElementById("fichasRevisionResumen").innerHTML = [
      campo("Nombre", p.identidad.nombre || "—"),
      campo("Raza", p.identidad.raza || "—"),
      campo("Clase", p.identidad.clase || "—"),
      campo("Nivel", p.identidad.nivelTotal),
      campo("Fuerza", p.atributos.fue),
      campo("Destreza", p.atributos.des),
      campo("Constitución", p.atributos.con),
      campo("Inteligencia", p.atributos.int),
      campo("Sabiduría", p.atributos.sab),
      campo("Carisma", p.atributos.car),
      campo("PV máx.", p.combate.pvMax),
      campo("PV actuales", p.combate.pvActual),
      campo("CA", fichasCATotal(p)),
      campo("Velocidad", p.combate.velocidad),
      campo("Ataques detectados", p.ataques.length)
    ].join("");

    mostrarVista("revision");
  }

  document.getElementById("fichasRevisionConfirmar").addEventListener("click", async () => {
    if (!importacionPendiente) return;
    const p = importacionPendiente.personaje;
    await fichasStorage.guardar(p);
    importacionPendiente = null;
    await abrirFicha(p.id);
  });
  document.getElementById("fichasRevisionCancelar").addEventListener("click", () => {
    importacionPendiente = null;
    mostrarVista("lista");
  });

  /* ==========================================================================
     AUTOGUARDADO
  ========================================================================== */
  function estadoGuardado(texto, clase) {
    const el = document.getElementById("fichasGuardadoEstado");
    el.textContent = texto;
    el.className = "fichas-guardado-estado " + clase;
  }

  function programarAutoguardado() {
    estadoGuardado("Cambios sin guardar", "");
    clearTimeout(autoguardadoTimeout);
    autoguardadoTimeout = setTimeout(async () => {
      estadoGuardado("Guardando…", "guardando");
      try {
        await fichasStorage.guardar(personajeActual);
        estadoGuardado("Guardado", "guardado");
      } catch (err) {
        estadoGuardado("Error al guardar: " + (err.message || err), "error");
      }
    }, 700);
  }

  /* ==========================================================================
     ABRIR FICHA
  ========================================================================== */
  async function abrirFicha(id) {
    const p = await fichasStorage.obtener(id);
    if (!p) { alert("No se encontró ese personaje."); return; }
    personajeActual = p;
    renderEncabezado();
    renderTabs();
    renderDecoraciones();
    mostrarVista("ficha");
  }

  document.getElementById("fichasVolverBtn").addEventListener("click", () => {
    personajeActual = null;
    mostrarVista("lista");
    cargarLista();
  });

  /* ==========================================================================
     PEGATINAS — decoración libre de la página del personaje. Puramente
     visual (no entra en ningún cálculo): el jugador sube una imagen, la
     arrastra donde quiera y la puede achicar/agrandar desde la esquina.
     Posición y tamaño se guardan como % del contenedor para que se
     mantengan más o menos en el mismo lugar en cualquier pantalla.
  ========================================================================== */
  function renderDecoraciones() {
    const cont = document.getElementById("fichasDecoraciones");
    cont.innerHTML = (personajeActual.decoraciones || []).map(d => `
      <div class="fichas-decoracion" data-decoracion="${d.id}" style="left:${d.xPct}%; top:${d.yPct}%; width:${d.anchoPct}%;">
        <img src="${esc(d.imagen)}" alt="" draggable="false">
        <span class="fichas-decoracion-resize" title="Cambiar tamaño"></span>
        <button type="button" class="fichas-decoracion-borrar" data-borrar-decoracion="${d.id}" title="Quitar pegatina">×</button>
      </div>
    `).join("");
  }

  document.getElementById("fichasDecorarBtn").addEventListener("click", () => {
    document.getElementById("fichasDecoracionArchivo").click();
  });

  document.getElementById("fichasDecoracionArchivo").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Eso no es una imagen."); return; }
    try {
      const dataUrl = await fichasImagenADataUrl(file, 400, 0.85);
      personajeActual.decoraciones.push({ id: fichasNuevoId(), imagen: dataUrl, xPct: 70, yPct: 4, anchoPct: 14 });
      renderDecoraciones();
      programarAutoguardado();
    } catch (err) {
      alert("No se pudo procesar la imagen: " + (err.message || err));
    }
  });

  const decoracionesCont = document.getElementById("fichasDecoraciones");

  decoracionesCont.addEventListener("pointerdown", e => {
    if (e.target.closest("[data-borrar-decoracion]")) return;
    const el = e.target.closest(".fichas-decoracion");
    if (!el) return;
    e.preventDefault();
    const d = personajeActual.decoraciones.find(x => x.id === el.dataset.decoracion);
    if (!d) return;
    decoracionArrastre = {
      id: d.id,
      tipo: e.target.closest(".fichas-decoracion-resize") ? "redimensionar" : "mover",
      inicioClienteX: e.clientX, inicioClienteY: e.clientY,
      inicioXPct: d.xPct, inicioYPct: d.yPct, inicioAnchoPct: d.anchoPct,
      contRect: decoracionesCont.getBoundingClientRect()
    };
    el.classList.add("fichas-decoracion--arrastrando");
    el.setPointerCapture(e.pointerId);
  });

  decoracionesCont.addEventListener("pointermove", e => {
    if (!decoracionArrastre) return;
    const d = personajeActual.decoraciones.find(x => x.id === decoracionArrastre.id);
    if (!d) return;
    const dxPct = (e.clientX - decoracionArrastre.inicioClienteX) / decoracionArrastre.contRect.width * 100;
    const dyPct = (e.clientY - decoracionArrastre.inicioClienteY) / decoracionArrastre.contRect.height * 100;
    if (decoracionArrastre.tipo === "mover") {
      d.xPct = Math.max(0, Math.min(96, decoracionArrastre.inicioXPct + dxPct));
      d.yPct = Math.max(0, Math.min(96, decoracionArrastre.inicioYPct + dyPct));
    } else {
      d.anchoPct = Math.max(4, Math.min(70, decoracionArrastre.inicioAnchoPct + dxPct));
    }
    const el = decoracionesCont.querySelector(`[data-decoracion="${d.id}"]`);
    if (el) { el.style.left = d.xPct + "%"; el.style.top = d.yPct + "%"; el.style.width = d.anchoPct + "%"; }
  });

  decoracionesCont.addEventListener("pointerup", () => {
    if (!decoracionArrastre) return;
    decoracionArrastre = null;
    decoracionesCont.querySelectorAll(".fichas-decoracion--arrastrando").forEach(el => el.classList.remove("fichas-decoracion--arrastrando"));
    programarAutoguardado();
  });

  decoracionesCont.addEventListener("click", e => {
    const borrarBtn = e.target.closest("[data-borrar-decoracion]");
    if (!borrarBtn) return;
    personajeActual.decoraciones = personajeActual.decoraciones.filter(d => d.id !== borrarBtn.dataset.borrarDecoracion);
    renderDecoraciones();
    programarAutoguardado();
  });

  function renderEncabezado() {
    const p = personajeActual;
    const retratoImg = document.getElementById("fichasHRetrato");
    const retratoVacio = document.getElementById("fichasHRetratoVacio");
    if (p.identidad.retrato) {
      retratoImg.src = p.identidad.retrato;
      retratoImg.classList.remove("hidden");
      retratoVacio.classList.add("hidden");
    } else {
      retratoImg.classList.add("hidden");
      retratoVacio.classList.remove("hidden");
      retratoVacio.textContent = (p.identidad.nombre || "?")[0].toUpperCase();
    }
    document.getElementById("fichasHNombre").textContent = p.identidad.nombre || "Sin nombre";
    const clases = [p.identidad.clase, ...(p.identidad.clasesExtra || []).map(c => c.nombre)].filter(Boolean).join(" / ");
    const esDeOtro = p.ownerEmail && p.ownerEmail !== miEmail;
    document.getElementById("fichasHSub").textContent = `${p.identidad.raza || "—"} · ${clases || "—"} · Nivel ${p.identidad.nivelTotal}` + (esDeOtro ? ` · De: ${p.ownerUsername || p.ownerEmail}` : "");
    document.getElementById("fichasHPV").textContent = `${p.combate.pvActual}/${p.combate.pvMax}`;
    document.getElementById("fichasHCA").textContent = fichasCATotal(p);
    document.getElementById("fichasHIni").textContent = fichasSigno(fichasIniciativaTotal(p));
    document.getElementById("fichasHVel").textContent = p.combate.velocidad;
    document.getElementById("fichasHComp").textContent = fichasSigno(fichasCompetenciaTotal(p));
    const repartidos = fichasPuntosRepartidos(p);
    const disponibles = fichasPuntosDisponiblesTotal(p.identidad.nivelTotal);
    const puntosEl = document.getElementById("fichasHPuntos");
    puntosEl.textContent = `${repartidos}/${disponibles}`;
    puntosEl.classList.toggle("fichas-stat-sobregastado", repartidos > disponibles);
    estadoGuardado("Guardado", "guardado");
  }

  /* Se llama después de CUALQUIER cambio de dato: refresca todo lo
     calculado que sea visible ahora mismo, sin releer el DOM entero. */
  function refrescarCalculado() {
    renderEncabezado();
    document.querySelectorAll("[data-calc]").forEach(el => {
      try { el.textContent = fichasFormatearCalc(el.dataset.calc); } catch (e) { /* campo de un tab no activo todavía */ }
    });
  }

  function fichasFormatearCalc(expr) {
    const p = personajeActual;
    const [tipo, arg] = expr.split(":");
    switch (tipo) {
      case "modAtributo": return fichasSigno(fichasModificadorFinal(p, arg));
      case "salvTotal": return fichasSigno(fichasSalvacionTotal(p, arg));
      case "habTotal": return fichasSigno(fichasHabilidadTotal(p, arg));
      case "percepcionPasiva": return String(fichasPercepcionPasiva(p));
      case "competenciaTotal": return fichasSigno(fichasCompetenciaTotal(p));
      case "iniciativaTotal": return fichasSigno(fichasIniciativaTotal(p));
      case "caTotal": return String(fichasCATotal(p));
      case "ataqueTotal": {
        const a = p.ataques.find(x => x.id === arg);
        return a ? fichasSigno(fichasAtaqueTotal(p, a)) : "";
      }
      case "lanzAtaque": return fichasSigno(fichasLanzamientoAtaque(p));
      case "lanzCD": return String(fichasLanzamientoCD(p));
      case "puntosPorNivel": return String(fichasPuntosPorNivel(p.identidad.nivelTotal));
      case "puntosMejoraClase": return String(fichasPuntosMejoraClase(p.identidad.nivelTotal));
      case "puntosDisponibles": return String(fichasPuntosDisponiblesTotal(p.identidad.nivelTotal));
      case "puntosRepartidos": return String(fichasPuntosRepartidos(p));
      default: return "";
    }
  }

  /* ==========================================================================
     TABS
  ========================================================================== */
  function renderTabs() {
    document.getElementById("fichasTabsPaneles").innerHTML = [
      panelResumen(), panelCombate(), panelHabilidades(), panelRasgos(),
      panelHechizos(), panelInventario(), panelRoll20(), panelNotas()
    ].join("");

    document.querySelectorAll(".fichas-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "resumen");
      btn.onclick = () => {
        document.querySelectorAll(".fichas-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".fichas-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
        if (btn.dataset.tab === "roll20") renderRoll20Lista();
      };
    });
    document.querySelectorAll(".fichas-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === "resumen"));

    wirirBindingGenerico();
    wirirRepetibles();
    renderRoll20Lista();
  }

  /* --- Binding genérico: cualquier input/select/textarea con data-bind --- */
  function wirirBindingGenerico() {
    const cont = document.getElementById("fichasTabsPaneles");
    cont.addEventListener("input", manejarCambioBinding);
    cont.addEventListener("change", manejarCambioBinding);
  }
  function manejarCambioBinding(e) {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    const path = el.dataset.bind;
    let valor;
    if (el.type === "checkbox") valor = el.checked;
    else if (el.type === "number") valor = el.value === "" ? 0 : Number(el.value);
    else valor = el.value;
    setPath(personajeActual, path, valor);
    refrescarCalculado();
    programarAutoguardado();
  }

  function campoNumero(bind, valor, extra = "") {
    return `<input type="number" data-bind="${bind}" value="${esc(valor)}" ${extra}>`;
  }
  function campoTexto(bind, valor, extra = "") {
    return `<input type="text" data-bind="${bind}" value="${esc(valor)}" ${extra}>`;
  }
  function campoTextarea(bind, valor, filas = 3) {
    return `<textarea data-bind="${bind}" rows="${filas}">${esc(valor)}</textarea>`;
  }
  function campoCheck(bind, checked) {
    return `<input type="checkbox" data-bind="${bind}" ${checked ? "checked" : ""}>`;
  }
  function campoSelect(bind, valor, opciones) {
    return `<select data-bind="${bind}">${opciones.map(([v, t]) => `<option value="${esc(v)}" ${v === valor ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelResumen() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="resumen">
      <div class="fichas-fieldset">
        <h3>Avatar</h3>
        <div class="fichas-avatar-resumen">
          ${slotImagenTablero("retrato")}
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Identidad</h3>
        <div class="fichas-field-grid wide">
          <div class="fichas-field"><label>Nombre</label>${campoTexto("identidad.nombre", p.identidad.nombre)}</div>
          <div class="fichas-field"><label>Pronombres</label>${campoTexto("identidad.pronombres", p.identidad.pronombres)}</div>
          <div class="fichas-field"><label>Raza</label>${campoTexto("identidad.raza", p.identidad.raza)}</div>
          <div class="fichas-field"><label>Clase principal</label>${campoTexto("identidad.clase", p.identidad.clase)}</div>
          <div class="fichas-field"><label>Subclase</label>${campoTexto("identidad.subclase", p.identidad.subclase)}</div>
          <div class="fichas-field"><label>Nivel total</label>${campoNumero("identidad.nivelTotal", p.identidad.nivelTotal, 'min="1"')}</div>
          <div class="fichas-field"><label>Trasfondo</label>${campoTexto("identidad.trasfondo", p.identidad.trasfondo)}</div>
          <div class="fichas-field"><label>Alineamiento</label>${campoTexto("identidad.alineamiento", p.identidad.alineamiento)}</div>
          <div class="fichas-field"><label>Campaña / Side</label>${campoTexto("side", p.side)}</div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Clases adicionales</h3>
        <div data-lista="clasesExtra">${(p.identidad.clasesExtra || []).map((c, i) => filaClaseExtra(c, i)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="claseExtra">+ Agregar clase</button>
      </div>

      <div class="fichas-fieldset">
        <h3>Atributos</h3>
        <div class="fichas-atributos-grid">
          ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
            <div class="fichas-atributo-card">
              <small>${nombre}</small>
              ${campoNumero(`atributos.${id}`, p.atributos[id])}
              <div class="fichas-field-resultado" data-calc="modAtributo:${id}">${fichasSigno(fichasModificadorFinal(p, id))}</div>
              <input type="number" class="fichas-atributo-ajuste" data-bind="ajustesAtributos.${id}" value="${esc(p.ajustesAtributos[id])}" placeholder="ajuste manual" title="Ajuste manual (objetos, maldiciones, reglas caseras)">
            </div>
          `).join("")}
        </div>
        <p class="fichas-puntos-info">Puntos disponibles: 2 por nivel (<span data-calc="puntosPorNivel">${fichasPuntosPorNivel(p.identidad.nivelTotal)}</span>) + 2 extra cada nivel múltiplo de 4 (<span data-calc="puntosMejoraClase">${fichasPuntosMejoraClase(p.identidad.nivelTotal)}</span>) = <strong data-calc="puntosDisponibles">${fichasPuntosDisponiblesTotal(p.identidad.nivelTotal)}</strong> en total. Repartidos hasta ahora (puntuación actual menos 8 de base y menos racial): <strong data-calc="puntosRepartidos">${fichasPuntosRepartidos(p)}</strong></p>
      </div>

      <div class="fichas-fieldset">
        <h3>Bonificaciones raciales</h3>
        <p class="fichas-imagenes-ayuda">Todo personaje arranca en 8 en cada característica. Los bonos raciales se suman a la puntuación final de arriba, pero no cuentan como puntos de mejora repartidos.</p>
        <div class="fichas-atributos-grid">
          ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
            <div class="fichas-atributo-card fichas-atributo-card--mini">
              <small>${nombre}</small>
              <div class="fichas-field"><label>Racial</label>${campoNumero(`atributosRaciales.${id}`, p.atributosRaciales[id])}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Bonificador de competencia</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Base (por nivel)</label><div class="fichas-field-resultado">${fichasSigno(fichasCompetenciaBase(p.identidad.nivelTotal))}</div></div>
          <div class="fichas-field"><label>Ajuste manual</label>${campoNumero("competenciaAjusteManual", p.competenciaAjusteManual)}</div>
          <div class="fichas-field"><label>Total</label><div class="fichas-field-resultado" data-calc="competenciaTotal">${fichasSigno(fichasCompetenciaTotal(p))}</div></div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Descripción e historia</h3>
        <div class="fichas-field-grid wide">
          <div class="fichas-field"><label>Descripción física</label>${campoTextarea("identidad.descripcionFisica", p.identidad.descripcionFisica)}</div>
          <div class="fichas-field"><label>Historia resumida</label>${campoTextarea("identidad.historia", p.identidad.historia)}</div>
        </div>
      </div>
    </section>`;
  }

  function filaClaseExtra(c, i) {
    return `
      <div class="fichas-repetible-item" data-clase-extra="${i}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="identidad.clasesExtra.${i}.nombre" value="${esc(c.nombre)}" placeholder="Nombre de la clase">
          <button type="button" class="fichas-repetible-remove" data-remove="claseExtra:${i}">×</button>
        </div>
        <div class="fichas-field"><label>Nivel en esta clase</label>${campoNumero(`identidad.clasesExtra.${i}.nivel`, c.nivel)}</div>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelCombate() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="combate">
      <div class="fichas-fieldset">
        <h3>Puntos de golpe</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>PV máximos</label>${campoNumero("combate.pvMax", p.combate.pvMax)}</div>
          <div class="fichas-field"><label>PV actuales</label>${campoNumero("combate.pvActual", p.combate.pvActual)}</div>
          <div class="fichas-field"><label>PV temporales</label>${campoNumero("combate.pvTemp", p.combate.pvTemp)}</div>
          <div class="fichas-field"><label>Dados de golpe actuales</label>${campoNumero("combate.dadosGolpe.actuales", p.combate.dadosGolpe.actuales)}</div>
          <div class="fichas-field"><label>Dados de golpe máximos</label>${campoNumero("combate.dadosGolpe.max", p.combate.dadosGolpe.max)}</div>
          <div class="fichas-field"><label>Dado de golpe</label>${campoTexto("combate.dadosGolpe.dado", p.combate.dadosGolpe.dado)}</div>
        </div>
        <div class="fichas-combate-rapido">
          <input type="number" id="fcRecibirDano" placeholder="daño">
          <button type="button" class="secondary-button" id="fcBtnRecibirDano">Recibir daño</button>
          <input type="number" id="fcRecuperarPV" placeholder="PV">
          <button type="button" class="secondary-button" id="fcBtnRecuperarPV">Recuperar PV</button>
          <input type="number" id="fcTempPV" placeholder="PV temp.">
          <button type="button" class="secondary-button" id="fcBtnTempPV">Añadir/retirar PV temp.</button>
          <button type="button" class="secondary-button" id="fcBtnDescansoCorto">Descanso corto</button>
          <button type="button" class="secondary-button" id="fcBtnDescansoLargo">Descanso largo</button>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Clase de armadura</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Modo</label>${campoSelect("combate.ca.modo", p.combate.ca.modo, [["manual", "Manual"], ["calculada", "Calculada"]])}</div>
          <div class="fichas-field"><label>CA manual</label>${campoNumero("combate.ca.manual", p.combate.ca.manual)}</div>
          <div class="fichas-field"><label>Armadura base</label>${campoNumero("combate.ca.armadura", p.combate.ca.armadura)}</div>
          <div class="fichas-field"><label>Escudo</label>${campoNumero("combate.ca.escudo", p.combate.ca.escudo)}</div>
          <div class="fichas-field"><label>Otros ajustes</label>${campoNumero("combate.ca.otros", p.combate.ca.otros)}</div>
          <div class="fichas-field fichas-field-check"><label>¿Suma Destreza?</label>${campoCheck("combate.ca.incluyeDes", p.combate.ca.incluyeDes)}</div>
          <div class="fichas-field"><label>CA total</label><div class="fichas-field-resultado" data-calc="caTotal">${fichasCATotal(p)}</div></div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Iniciativa y velocidad</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Ajuste manual de iniciativa</label>${campoNumero("combate.iniciativaAjuste", p.combate.iniciativaAjuste)}</div>
          <div class="fichas-field"><label>Iniciativa total</label><div class="fichas-field-resultado" data-calc="iniciativaTotal">${fichasSigno(fichasIniciativaTotal(p))}</div></div>
          <div class="fichas-field"><label>Velocidad</label>${campoNumero("combate.velocidad", p.combate.velocidad)}</div>
        </div>
        <div class="fichas-copiar-fila">
          <button type="button" class="fichas-copiar-btn" data-copiar="iniciativa">Copiar iniciativa para Roll20</button>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Salvaciones contra la muerte</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Éxitos (0-3)</label>${campoNumero("combate.salvMuerte.exitos", p.combate.salvMuerte.exitos, 'min="0" max="3"')}</div>
          <div class="fichas-field"><label>Fallos (0-3)</label>${campoNumero("combate.salvMuerte.fallos", p.combate.salvMuerte.fallos, 'min="0" max="3"')}</div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Condiciones, resistencias y sentidos</h3>
        <div class="fichas-field-grid wide">
          <div class="fichas-field"><label>Condiciones activas (separadas por coma)</label>${campoTexto("combate.condiciones", p.combate.condiciones)}</div>
          <div class="fichas-field"><label>Resistencias</label>${campoTexto("combate.resistencias", p.combate.resistencias)}</div>
          <div class="fichas-field"><label>Inmunidades</label>${campoTexto("combate.inmunidades", p.combate.inmunidades)}</div>
          <div class="fichas-field"><label>Vulnerabilidades</label>${campoTexto("combate.vulnerabilidades", p.combate.vulnerabilidades)}</div>
          <div class="fichas-field"><label>Sentidos especiales</label>${campoTexto("combate.sentidos", p.combate.sentidos)}</div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Ataques</h3>
        <div data-lista="ataques">${p.ataques.map(a => filaAtaque(a)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="ataque">+ Agregar ataque</button>
      </div>
    </section>`;
  }

  function filaAtaque(a) {
    const p = personajeActual;
    return `
      <div class="fichas-repetible-item" data-ataque="${a.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__ataque__.${a.id}.nombre" value="${esc(a.nombre)}" placeholder="Nombre del ataque">
          <button type="button" class="fichas-repetible-remove" data-remove="ataque:${a.id}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Atributo</label>${campoSelect(`__ataque__.${a.id}.atributo`, a.atributo, Object.entries(NOMBRES_ATRIBUTOS).map(([id, n]) => [id, n]))}</div>
          <div class="fichas-field fichas-field-check"><label>¿Competente?</label>${campoCheck(`__ataque__.${a.id}.competente`, a.competente)}</div>
          <div class="fichas-field"><label>Ajuste adicional</label>${campoNumero(`__ataque__.${a.id}.ajusteAtaque`, a.ajusteAtaque)}</div>
          <div class="fichas-field"><label>Bonificador total</label><div class="fichas-field-resultado" data-calc="ataqueTotal:${a.id}">${fichasSigno(fichasAtaqueTotal(p, a))}</div></div>
          <div class="fichas-field"><label>Fórmula de daño</label>${campoTexto(`__ataque__.${a.id}.dano`, a.dano, 'placeholder="1d8+2"')}</div>
          <div class="fichas-field"><label>Tipo de daño</label>${campoTexto(`__ataque__.${a.id}.tipoDano`, a.tipoDano)}</div>
          <div class="fichas-field"><label>Alcance</label>${campoTexto(`__ataque__.${a.id}.alcance`, a.alcance)}</div>
          <div class="fichas-field"><label>Munición actual</label>${campoNumero(`__ataque__.${a.id}.municionActual`, a.municionActual ?? "")}</div>
          <div class="fichas-field"><label>Munición máxima</label>${campoNumero(`__ataque__.${a.id}.municionMax`, a.municionMax ?? "")}</div>
        </div>
        <div class="fichas-field"><label>Propiedades</label>${campoTexto(`__ataque__.${a.id}.propiedades`, a.propiedades)}</div>
        <div class="fichas-field"><label>Notas</label>${campoTextarea(`__ataque__.${a.id}.notas`, a.notas, 2)}</div>
        <div class="fichas-modo-tirada">
          Tirada:
          <label><input type="radio" name="modo-ataque-${a.id}" value="normal" checked> normal</label>
          <label><input type="radio" name="modo-ataque-${a.id}" value="ventaja"> ventaja</label>
          <label><input type="radio" name="modo-ataque-${a.id}" value="desventaja"> desventaja</label>
        </div>
        <div class="fichas-copiar-fila">
          <button type="button" class="fichas-copiar-btn" data-copiar="ataque" data-id="${a.id}">Copiar ataque</button>
          <button type="button" class="fichas-copiar-btn" data-copiar="dano" data-id="${a.id}">Copiar daño</button>
          <button type="button" class="fichas-copiar-btn" data-copiar="ataquedano" data-id="${a.id}">Copiar ataque y daño</button>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelHabilidades() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="habilidades">
      <div class="fichas-fieldset">
        <h3>Tiradas de salvación</h3>
        <div class="fichas-field-grid wide">
          ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
            <div class="fichas-repetible-item">
              <div class="fichas-repetible-header"><strong>${nombre}</strong>
                <span class="fichas-field-resultado" data-calc="salvTotal:${id}">${fichasSigno(fichasSalvacionTotal(p, id))}</span>
              </div>
              <div class="fichas-field-check"><label>Competente</label>${campoCheck(`salvaciones.${id}.competente`, p.salvaciones[id].competente)}</div>
              <div class="fichas-field"><label>Ajuste adicional</label>${campoNumero(`salvaciones.${id}.ajuste`, p.salvaciones[id].ajuste)}</div>
              <button type="button" class="fichas-copiar-btn" data-copiar="salvacion" data-id="${id}">Copiar para Roll20</button>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Habilidades</h3>
        <p class="fichas-puntos-info">Percepción pasiva: <strong data-calc="percepcionPasiva">${fichasPercepcionPasiva(p)}</strong></p>
        <div class="fichas-field-grid wide">
          ${FICHAS_HABILIDADES.map(h => `
            <div class="fichas-repetible-item">
              <div class="fichas-repetible-header"><strong>${h.nombre}</strong> <small>(${NOMBRES_ATRIBUTOS[h.atributo]})</small>
                <span class="fichas-field-resultado" data-calc="habTotal:${h.id}">${fichasSigno(fichasHabilidadTotal(p, h.id))}</span>
              </div>
              <div class="fichas-field"><label>Nivel</label>${campoSelect(`habilidades.${h.id}.nivel`, p.habilidades[h.id].nivel, [["ninguna", "Sin competencia"], ["competente", "Competente"], ["pericia", "Pericia"]])}</div>
              <div class="fichas-field"><label>Ajuste adicional</label>${campoNumero(`habilidades.${h.id}.ajuste`, p.habilidades[h.id].ajuste)}</div>
              <button type="button" class="fichas-copiar-btn" data-copiar="habilidad" data-id="${h.id}">Copiar para Roll20</button>
            </div>
          `).join("")}
        </div>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelRasgos() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="rasgos">
      <div class="fichas-fieldset">
        <h3>Rasgos, competencias y recursos</h3>
        <div data-lista="rasgos">${p.rasgos.map(r => filaRasgo(r)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="rasgo">+ Agregar rasgo/recurso</button>
      </div>
      <div class="fichas-fieldset">
        <h3>Competencias e idiomas (texto libre)</h3>
        <div class="fichas-field-grid wide">
          <div class="fichas-field"><label>Armas</label>${campoTexto("competenciasArmas", p.competenciasArmas || "")}</div>
          <div class="fichas-field"><label>Armaduras</label>${campoTexto("competenciasArmaduras", p.competenciasArmaduras || "")}</div>
          <div class="fichas-field"><label>Herramientas</label>${campoTexto("competenciasHerramientas", p.competenciasHerramientas || "")}</div>
          <div class="fichas-field"><label>Idiomas</label>${campoTexto("idiomas", p.idiomas || "")}</div>
        </div>
      </div>
    </section>`;
  }

  function filaRasgo(r) {
    return `
      <div class="fichas-repetible-item" data-rasgo="${r.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__rasgo__.${r.id}.nombre" value="${esc(r.nombre)}" placeholder="Nombre">
          <button type="button" class="fichas-repetible-remove" data-remove="rasgo:${r.id}">×</button>
        </div>
        <div class="fichas-field"><label>Descripción</label>${campoTextarea(`__rasgo__.${r.id}.descripcion`, r.descripcion, 2)}</div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Usos actuales</label>${campoNumero(`__rasgo__.${r.id}.usosActuales`, r.usosActuales ?? "")}</div>
          <div class="fichas-field"><label>Usos máximos</label>${campoNumero(`__rasgo__.${r.id}.usosMax`, r.usosMax ?? "")}</div>
          <div class="fichas-field"><label>Tipo de acción</label>${campoSelect(`__rasgo__.${r.id}.tipoAccion`, r.tipoAccion || "accion", [["accion", "Acción"], ["adicional", "Acción adicional"], ["reaccion", "Reacción"], ["pasiva", "Pasiva"], ["otra", "Otra"]])}</div>
          <div class="fichas-field"><label>Recuperación</label>${campoSelect(`__rasgo__.${r.id}.recuperacion`, r.recuperacion || "manual", [["corto", "Descanso corto"], ["largo", "Descanso largo"], ["manual", "Manual"]])}</div>
        </div>
        <div class="fichas-field"><label>Fórmula para Roll20 (opcional)</label>${campoTexto(`__rasgo__.${r.id}.formulaRoll20`, r.formulaRoll20)}</div>
        ${r.formulaRoll20 ? `<div class="fichas-copiar-fila"><button type="button" class="fichas-copiar-btn" data-copiar="rasgo" data-id="${r.id}">Copiar para Roll20</button></div>` : ""}
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelHechizos() {
    const p = personajeActual;
    const l = p.lanzamiento;
    return `
    <section class="fichas-panel" data-panel="hechizos">
      <div class="fichas-fieldset">
        <h3>Lanzamiento de hechizos</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Atributo</label>${campoSelect("lanzamiento.atributo", l.atributo, Object.entries(NOMBRES_ATRIBUTOS).map(([id, n]) => [id, n]))}</div>
          <div class="fichas-field fichas-field-check"><label>Usar valores manuales</label>${campoCheck("lanzamiento.manual", l.manual)}</div>
          <div class="fichas-field"><label>Ajuste ataque mágico</label>${campoNumero("lanzamiento.ajusteAtaque", l.ajusteAtaque)}</div>
          <div class="fichas-field"><label>Ajuste CD</label>${campoNumero("lanzamiento.ajusteCD", l.ajusteCD)}</div>
          <div class="fichas-field"><label>Ataque mágico manual</label>${campoNumero("lanzamiento.ataqueManual", l.ataqueManual)}</div>
          <div class="fichas-field"><label>CD manual</label>${campoNumero("lanzamiento.cdManual", l.cdManual)}</div>
          <div class="fichas-field"><label>Ataque mágico total</label><div class="fichas-field-resultado" data-calc="lanzAtaque">${fichasSigno(fichasLanzamientoAtaque(p))}</div></div>
          <div class="fichas-field"><label>CD total</label><div class="fichas-field-resultado" data-calc="lanzCD">${fichasLanzamientoCD(p)}</div></div>
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Espacios de conjuro</h3>
        <div data-lista="espacios">${l.espacios.map((e, i) => filaEspacio(e, i)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="espacio">+ Agregar nivel de espacio</button>
      </div>

      <div class="fichas-fieldset">
        <h3>Hechizos</h3>
        <div data-lista="hechizos">${p.hechizos.map(h => filaHechizo(h)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="hechizo">+ Agregar hechizo</button>
      </div>
    </section>`;
  }

  function filaEspacio(e, i) {
    return `
      <div class="fichas-repetible-item" data-espacio="${i}">
        <div class="fichas-repetible-header"><strong>Nivel ${i + 1}</strong>
          <button type="button" class="fichas-repetible-remove" data-remove="espacio:${i}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Nivel</label>${campoNumero(`lanzamiento.espacios.${i}.nivel`, e.nivel)}</div>
          <div class="fichas-field"><label>Máximos</label>${campoNumero(`lanzamiento.espacios.${i}.max`, e.max)}</div>
          <div class="fichas-field"><label>Usados</label>${campoNumero(`lanzamiento.espacios.${i}.usados`, e.usados)}</div>
        </div>
      </div>`;
  }

  function filaHechizo(h) {
    return `
      <div class="fichas-repetible-item" data-hechizo="${h.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__hechizo__.${h.id}.nombre" value="${esc(h.nombre)}" placeholder="Nombre del hechizo">
          <button type="button" class="fichas-repetible-remove" data-remove="hechizo:${h.id}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Nivel</label>${campoNumero(`__hechizo__.${h.id}.nivel`, h.nivel)}</div>
          <div class="fichas-field"><label>Escuela</label>${campoTexto(`__hechizo__.${h.id}.escuela`, h.escuela)}</div>
          <div class="fichas-field"><label>Tiempo de lanzamiento</label>${campoTexto(`__hechizo__.${h.id}.tiempo`, h.tiempo)}</div>
          <div class="fichas-field"><label>Alcance</label>${campoTexto(`__hechizo__.${h.id}.alcance`, h.alcance)}</div>
          <div class="fichas-field"><label>Duración</label>${campoTexto(`__hechizo__.${h.id}.duracion`, h.duracion)}</div>
          <div class="fichas-field"><label>Componentes</label>${campoTexto(`__hechizo__.${h.id}.componentes`, h.componentes)}</div>
          <div class="fichas-field fichas-field-check"><label>Concentración</label>${campoCheck(`__hechizo__.${h.id}.concentracion`, h.concentracion)}</div>
          <div class="fichas-field fichas-field-check"><label>Ritual</label>${campoCheck(`__hechizo__.${h.id}.ritual`, h.ritual)}</div>
          <div class="fichas-field"><label>Tipo</label>${campoSelect(`__hechizo__.${h.id}.tipo`, h.tipo || "ninguno", [["ataque", "Ataque mágico"], ["salvacion", "Requiere salvación"], ["ninguno", "Ninguno"]])}</div>
          <div class="fichas-field"><label>Fórmula de daño/curación</label>${campoTexto(`__hechizo__.${h.id}.dano`, h.dano, 'placeholder="8d6 o 1d4+3"')}</div>
          <div class="fichas-field"><label>Tipo de daño</label>${campoTexto(`__hechizo__.${h.id}.tipoDano`, h.tipoDano)}</div>
        </div>
        <div class="fichas-field"><label>Descripción</label>${campoTextarea(`__hechizo__.${h.id}.descripcion`, h.descripcion, 2)}</div>
        <div class="fichas-field"><label>Notas</label>${campoTextarea(`__hechizo__.${h.id}.notas`, h.notas, 2)}</div>
        <div class="fichas-copiar-fila">
          <button type="button" class="fichas-copiar-btn" data-copiar="hechizo" data-id="${h.id}">Copiar para Roll20</button>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelInventario() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="inventario">
      <div class="fichas-fieldset">
        <h3>Monedas</h3>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Oro</label>${campoNumero("inventario.monedas.oro", p.inventario.monedas.oro)}</div>
          <div class="fichas-field"><label>Plata</label>${campoNumero("inventario.monedas.plata", p.inventario.monedas.plata)}</div>
          <div class="fichas-field"><label>Cobre</label>${campoNumero("inventario.monedas.cobre", p.inventario.monedas.cobre)}</div>
          <div class="fichas-field fichas-field-check"><label>Usar cálculo de peso</label>${campoCheck("inventario.usarPeso", p.inventario.usarPeso)}</div>
        </div>
      </div>
      <div class="fichas-fieldset">
        <h3>Objetos</h3>
        <div data-lista="objetos">${p.inventario.objetos.map(o => filaObjeto(o, p.inventario.usarPeso)).join("")}</div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="objeto">+ Agregar objeto</button>
      </div>
    </section>`;
  }

  function filaObjeto(o, usarPeso) {
    return `
      <div class="fichas-repetible-item" data-objeto="${o.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__objeto__.${o.id}.nombre" value="${esc(o.nombre)}" placeholder="Nombre del objeto">
          <button type="button" class="fichas-repetible-remove" data-remove="objeto:${o.id}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Cantidad</label>${campoNumero(`__objeto__.${o.id}.cantidad`, o.cantidad)}</div>
          ${usarPeso ? `<div class="fichas-field"><label>Peso</label>${campoNumero(`__objeto__.${o.id}.peso`, o.peso ?? "")}</div>` : ""}
          <div class="fichas-field"><label>Estado</label>${campoSelect(`__objeto__.${o.id}.estado`, o.estado, [["equipado", "Equipado"], ["guardado", "Guardado"], ["consumido", "Consumido"]])}</div>
          <div class="fichas-field"><label>Cargas actuales</label>${campoNumero(`__objeto__.${o.id}.cargasActuales`, o.cargasActuales ?? "")}</div>
          <div class="fichas-field"><label>Cargas máximas</label>${campoNumero(`__objeto__.${o.id}.cargasMax`, o.cargasMax ?? "")}</div>
          <div class="fichas-field"><label>Valor</label>${campoNumero(`__objeto__.${o.id}.valor`, o.valor ?? "")}</div>
        </div>
        <div class="fichas-field"><label>Descripción</label>${campoTextarea(`__objeto__.${o.id}.descripcion`, o.descripcion, 2)}</div>
        <div class="fichas-field"><label>Notas</label>${campoTexto(`__objeto__.${o.id}.notas`, o.notas)}</div>
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelNotas() {
    const p = personajeActual;
    return `
    <section class="fichas-panel" data-panel="notas">
      <div class="fichas-fieldset">
        <h3>Notas del jugador</h3>
        <p class="fichas-puntos-info">Esta sección es tuya, es solo lo que tú quieres recordar.</p>
        <div class="fichas-field"><label>Notas públicas</label>${campoTextarea("identidad.notasPublicas", p.identidad.notasPublicas, 10)}</div>
      </div>
      <div class="fichas-fieldset">
        <h3>Imprimir / exportar</h3>
        <div class="fichas-copiar-fila">
          <button type="button" class="secondary-button" id="fnImprimir">Imprimir ficha</button>
          <button type="button" class="secondary-button" id="fnExportarJson">Exportar como JSON</button>
        </div>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------- */
  const CAMPOS_IMAGEN_TABLERO = {
    retrato: { path: "identidad.retrato", maxDim: 600, calidad: 0.85, etiqueta: "Avatar / token" },
    ficha: { path: "identidad.fichaFoto", maxDim: 1600, calidad: 0.82, etiqueta: "Foto de la ficha de juego" }
  };

  function nombreArchivoImagen(slot) {
    const base = (personajeActual.identidad.nombre || "personaje").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "personaje";
    return `${base}-${slot === "retrato" ? "avatar" : "ficha"}.jpg`;
  }

  function slotImagenTablero(slot) {
    const cfg = CAMPOS_IMAGEN_TABLERO[slot];
    const valor = getPath(personajeActual, cfg.path);
    return `
    <div class="fichas-imagen-slot">
      <div class="fichas-imagen-preview">
        <img data-imagen-preview="${slot}" src="${esc(valor || "")}" alt="" class="${valor ? "" : "hidden"}">
        <span data-imagen-vacio="${slot}" class="fichas-imagen-vacio ${valor ? "hidden" : ""}">Sin imagen</span>
      </div>
      <div class="fichas-imagen-acciones">
        <label class="secondary-button fichas-imagen-subir">
          Subir
          <input type="file" accept="image/*" data-imagen-input="${slot}" class="hidden">
        </label>
        <a data-imagen-descargar="${slot}" class="fichas-link-button ${valor ? "" : "hidden"}" href="${esc(valor || "")}" download="${esc(nombreArchivoImagen(slot))}">Descargar</a>
        <button type="button" class="fichas-link-button" data-quitar-imagen="${slot}" ${valor ? "" : "disabled"}>Quitar</button>
      </div>
      <small>${cfg.etiqueta}</small>
    </div>`;
  }

  function panelRoll20() {
    return `
    <section class="fichas-panel" data-panel="roll20">
      <div class="fichas-fieldset">
        <h3>Foto de la ficha (Roll20)</h3>
        <p class="fichas-imagenes-ayuda">Sube una foto de tu ficha de juego para tenerla a mano y llevarla al tablero en Roll20.</p>
        <div class="fichas-imagenes-grid">
          ${slotImagenTablero("ficha")}
        </div>
      </div>

      <div class="fichas-fieldset">
        <h3>Panel de tiradas preparadas</h3>
        <div class="fichas-roll20-controles">
          <input type="search" id="fr20Buscar" placeholder="Buscar una tirada...">
          <select id="fr20Filtro">
            <option value="todas">Todas las categorías</option>
            <option value="Atributos">Atributos</option>
            <option value="Habilidades">Habilidades</option>
            <option value="Salvaciones">Salvaciones</option>
            <option value="Combate">Iniciativa</option>
            <option value="Ataques">Ataques</option>
            <option value="Hechizos">Hechizos</option>
            <option value="Rasgos">Rasgos</option>
            <option value="Macros">Macros</option>
          </select>
          <label class="fichas-field-check" style="flex-direction:row;align-items:center;gap:6px;">
            <input type="checkbox" id="fr20SoloFavoritas"> Panel de sesión (solo favoritas)
          </label>
        </div>
        <div id="fr20Lista" class="fichas-roll20-lista"></div>
      </div>

      <div class="fichas-fieldset">
        <h3>Macros personalizadas</h3>
        <div data-lista="macros"></div>
        <button type="button" class="secondary-button fichas-add-btn" data-add="macro">+ Nueva macro</button>
      </div>

      <div class="fichas-fieldset">
        <button type="button" class="secondary-button" id="fr20CopiarTodas">Copiar todas las macros</button>
      </div>
    </section>`;
  }

  /* Redimensiona en un <canvas> antes de guardar: una foto de celular sin
     comprimir puede pesar varios MB, y esto viaja entero como jsonb en cada
     autoguardado. maxDim limita el lado más largo; el resto es cuánto se
     nota la compresión JPEG. */
  function fichasImagenADataUrl(file, maxDim, calidad) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
      img.src = url;
    });
  }

  function renderImagenSlot(slot) {
    const cfg = CAMPOS_IMAGEN_TABLERO[slot];
    const valor = getPath(personajeActual, cfg.path);
    const img = document.querySelector(`[data-imagen-preview="${slot}"]`);
    const vacio = document.querySelector(`[data-imagen-vacio="${slot}"]`);
    const descargarLink = document.querySelector(`[data-imagen-descargar="${slot}"]`);
    const quitarBtn = document.querySelector(`[data-quitar-imagen="${slot}"]`);
    if (!img) return; // panel Roll20 no montado todavía
    img.src = valor || "";
    img.classList.toggle("hidden", !valor);
    vacio.classList.toggle("hidden", !!valor);
    descargarLink.href = valor || "";
    descargarLink.download = nombreArchivoImagen(slot);
    descargarLink.classList.toggle("hidden", !valor);
    quitarBtn.disabled = !valor;
  }

  async function manejarSubidaImagen(slot, file) {
    const cfg = CAMPOS_IMAGEN_TABLERO[slot];
    if (!cfg) return;
    if (!file.type.startsWith("image/")) { alert("Eso no es una imagen."); return; }
    const label = document.querySelector(`[data-imagen-input="${slot}"]`)?.closest(".fichas-imagen-subir");
    const textoOriginal = label ? label.firstChild.textContent : "";
    if (label) label.firstChild.textContent = "Procesando...";
    try {
      const dataUrl = await fichasImagenADataUrl(file, cfg.maxDim, cfg.calidad);
      setPath(personajeActual, cfg.path, dataUrl);
      renderImagenSlot(slot);
      refrescarCalculado();
      programarAutoguardado();
    } catch (err) {
      alert("No se pudo procesar la imagen: " + (err.message || err));
    } finally {
      if (label) label.firstChild.textContent = textoOriginal;
    }
  }

  function manejarQuitarImagen(slot) {
    const cfg = CAMPOS_IMAGEN_TABLERO[slot];
    if (!cfg) return;
    setPath(personajeActual, cfg.path, "");
    renderImagenSlot(slot);
    refrescarCalculado();
    programarAutoguardado();
  }

  /* ==========================================================================
     REPETIBLES: alta/baja de filas para ataques, hechizos, rasgos,
     objetos, clases extra, espacios de conjuro y macros. Todo pasa por
     acá vía delegación (un solo listener de click en el contenedor).
  ========================================================================== */
  function wirirRepetibles() {
    const cont = document.getElementById("fichasTabsPaneles");

    cont.addEventListener("click", e => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) return manejarAgregar(addBtn.dataset.add);

      const removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) {
        const [tipo, idOIndice] = removeBtn.dataset.remove.split(":");
        return manejarQuitar(tipo, idOIndice);
      }

      const copiarBtn = e.target.closest("[data-copiar]");
      if (copiarBtn) return manejarCopiar(copiarBtn);

      const quitarImgBtn = e.target.closest("[data-quitar-imagen]");
      if (quitarImgBtn) return manejarQuitarImagen(quitarImgBtn.dataset.quitarImagen);
    });

    cont.addEventListener("change", e => {
      const input = e.target.closest("[data-imagen-input]");
      if (!input || !input.files || !input.files[0]) return;
      const slot = input.dataset.imagenInput;
      const file = input.files[0];
      input.value = "";
      manejarSubidaImagen(slot, file);
    });

    // Los inputs con __ataque__ / __hechizo__ / __rasgo__ / __objeto__ /
    // __rasgo__ apuntan a un item DENTRO de un array (no una ruta fija de
    // objeto), así que necesitan su propio traductor de binding además del
    // genérico por path — se resuelve acá antes de que llegue al binding
    // genérico (mismo contenedor, mismo evento, pero atajado antes).
    cont.addEventListener("input", manejarBindingDeArray, true);
    cont.addEventListener("change", manejarBindingDeArray, true);

    renderMacros();
  }

  const ARRAYS_POR_PREFIJO = {
    "__ataque__": "ataques",
    "__hechizo__": "hechizos",
    "__rasgo__": "rasgos",
    "__objeto__": p => p.inventario.objetos,
    "__macro__": p => p.macros
  };

  function manejarBindingDeArray(e) {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    const bind = el.dataset.bind;
    const m = bind.match(/^(__\w+__)\.([^.]+)\.(.+)$/);
    if (!m) return; // no es de un array especial, lo maneja el binding genérico
    e.stopPropagation();

    const [, prefijo, id, campo] = m;
    const resolver = ARRAYS_POR_PREFIJO[prefijo];
    const arr = typeof resolver === "function" ? resolver(personajeActual) : personajeActual[resolver];
    const item = arr.find(x => x.id === id);
    if (!item) return;

    let valor;
    if (el.type === "checkbox") valor = el.checked;
    else if (el.type === "number") valor = el.value === "" ? null : Number(el.value);
    else valor = el.value;
    item[campo] = valor;

    refrescarCalculado();
    programarAutoguardado();
  }

  function manejarAgregar(tipo) {
    const p = personajeActual;
    if (tipo === "claseExtra") p.identidad.clasesExtra.push({ nombre: "", nivel: 1 });
    if (tipo === "ataque") p.ataques.push({ id: fichasNuevoId(), nombre: "Nuevo ataque", atributo: "fue", competente: true, ajusteAtaque: 0, dano: "1d6", tipoDano: "", alcance: "", municionActual: null, municionMax: null, propiedades: "", notas: "" });
    if (tipo === "rasgo") p.rasgos.push({ id: fichasNuevoId(), nombre: "Nuevo rasgo", descripcion: "", usosActuales: null, usosMax: null, tipoAccion: "accion", recuperacion: "manual", formulaRoll20: "" });
    if (tipo === "hechizo") p.hechizos.push({ id: fichasNuevoId(), nombre: "Nuevo hechizo", nivel: 0, escuela: "", tiempo: "", alcance: "", duracion: "", componentes: "", concentracion: false, ritual: false, tipo: "ninguno", dano: "", tipoDano: "", descripcion: "", notas: "" });
    if (tipo === "espacio") p.lanzamiento.espacios.push({ nivel: p.lanzamiento.espacios.length + 1, max: 1, usados: 0 });
    if (tipo === "objeto") p.inventario.objetos.push({ id: fichasNuevoId(), nombre: "Nuevo objeto", cantidad: 1, peso: null, estado: "guardado", descripcion: "", notas: "", cargasActuales: null, cargasMax: null, valor: null });
    if (tipo === "macro") p.macros.push({ id: fichasNuevoId(), nombre: "Nueva macro", formula: "1d20", modificadorFijo: 0, narrativa: "", tipoDano: "", modoTirada: "normal", notas: "", favorita: false });

    programarAutoguardado();
    renderTabs();
    // Vuelve al mismo tab en el que estaba, en vez de resetear a Resumen.
    const activo = document.querySelector(".fichas-tab.active")?.dataset.tab || "resumen";
    document.querySelector(`.fichas-tab[data-tab="${activo}"]`)?.click();
  }

  function manejarQuitar(tipo, idOIndice) {
    const p = personajeActual;
    if (tipo === "claseExtra") p.identidad.clasesExtra.splice(Number(idOIndice), 1);
    if (tipo === "ataque") p.ataques = p.ataques.filter(a => a.id !== idOIndice);
    if (tipo === "rasgo") p.rasgos = p.rasgos.filter(r => r.id !== idOIndice);
    if (tipo === "hechizo") p.hechizos = p.hechizos.filter(h => h.id !== idOIndice);
    if (tipo === "espacio") p.lanzamiento.espacios.splice(Number(idOIndice), 1);
    if (tipo === "objeto") p.inventario.objetos = p.inventario.objetos.filter(o => o.id !== idOIndice);
    if (tipo === "macro") p.macros = p.macros.filter(m => m.id !== idOIndice);

    programarAutoguardado();
    const activo = document.querySelector(".fichas-tab.active")?.dataset.tab || "resumen";
    renderTabs();
    document.querySelector(`.fichas-tab[data-tab="${activo}"]`)?.click();
  }

  /* ==========================================================================
     COPIAR PARA ROLL20
  ========================================================================== */
  async function manejarCopiar(btn) {
    const tipo = btn.dataset.copiar;
    const id = btn.dataset.id;
    const p = personajeActual;
    let texto = "";

    if (tipo === "iniciativa") texto = fichasComandoIniciativa(fichasIniciativaTotal(p));
    else if (tipo === "salvacion") texto = fichasComandoPrueba(`Salvación de ${NOMBRES_ATRIBUTOS[id]}`, fichasSalvacionTotal(p, id));
    else if (tipo === "habilidad") texto = fichasComandoPrueba(FICHAS_HABILIDADES.find(h => h.id === id).nombre, fichasHabilidadTotal(p, id));
    else if (tipo === "ataque" || tipo === "dano" || tipo === "ataquedano") {
      const a = p.ataques.find(x => x.id === id);
      const modo = btn.closest(".fichas-repetible-item").querySelector(`input[name="modo-ataque-${id}"]:checked`)?.value || "normal";
      if (tipo === "ataque") texto = fichasComandoAtaque(a.nombre, fichasAtaqueTotal(p, a), { modo });
      else if (tipo === "dano") texto = fichasComandoDano(a.nombre, a.dano, a.tipoDano);
      else texto = fichasComandoAtaqueYDano(p.identidad.nombre, a.nombre, fichasAtaqueTotal(p, a), a.dano, a.tipoDano, { modo });
    } else if (tipo === "hechizo") {
      const h = p.hechizos.find(x => x.id === id);
      if (h.tipo === "ataque") texto = fichasComandoHechizoAtaque(h.nombre, fichasLanzamientoAtaque(p), h.dano, h.tipoDano);
      else if (h.tipo === "salvacion") texto = fichasComandoHechizoSalvacion(h.nombre, NOMBRES_ATRIBUTOS[p.lanzamiento.atributo], fichasLanzamientoCD(p), h.dano, h.tipoDano);
      else if (h.dano) texto = fichasComandoHechizoCuracion(h.nombre, h.dano);
      else texto = h.nombre;
    } else if (tipo === "rasgo") {
      const r = p.rasgos.find(x => x.id === id);
      texto = fichasComandoRasgo(r.nombre, r.formulaRoll20);
    } else if (tipo === "macro") {
      texto = comandoDeMacro(p.macros.find(x => x.id === id));
    } else if (tipo === "roll20item") {
      texto = btn.dataset.texto;
    }

    await copiarConFeedback(btn, texto);
  }

  async function copiarConFeedback(btn, texto) {
    const ok = await fichasCopiar(texto);
    if (ok) {
      const original = btn.textContent;
      btn.textContent = "Tirada copiada ✓";
      btn.classList.add("fichas-copiado");
      setTimeout(() => { btn.textContent = original; btn.classList.remove("fichas-copiado"); }, 1800);
    } else {
      // Fallback: campo de texto seleccionado para copiar a mano.
      const campo = prompt("No se pudo copiar automáticamente. Copia este texto a mano:", texto);
      void campo;
    }
  }

  function comandoDeMacro(m) {
    const partes = [];
    if (m.narrativa) partes.push(`/em ${m.narrativa}`);
    const formula = m.modoTirada && m.modoTirada !== "normal"
      ? fichasFormulaD20(m.modificadorFijo, m.modoTirada)
      : `${m.formula}${m.modificadorFijo ? fichasSigno(m.modificadorFijo) : ""}`;
    partes.push(`${m.nombre}: [[${formula}]]${m.tipoDano ? ` ${m.tipoDano}` : ""}`);
    return partes.join("\n");
  }

  /* ==========================================================================
     PANEL ROLL20: lista unificada + búsqueda/filtro + favoritos
  ========================================================================== */
  function listaCompletaRoll20() {
    const p = personajeActual;
    const items = [];

    Object.entries(NOMBRES_ATRIBUTOS).forEach(([id, nombre]) => {
      items.push({ id: `salv:${id}`, categoria: "Salvaciones", texto: `Salvación de ${nombre}: ${fichasSigno(fichasSalvacionTotal(p, id))}`, tipo: "salvacion", refId: id });
    });
    FICHAS_HABILIDADES.forEach(h => {
      items.push({ id: `hab:${h.id}`, categoria: "Habilidades", texto: `${h.nombre}: ${fichasSigno(fichasHabilidadTotal(p, h.id))}`, tipo: "habilidad", refId: h.id });
    });
    items.push({ id: "iniciativa", categoria: "Combate", texto: `Iniciativa: ${fichasSigno(fichasIniciativaTotal(p))}`, tipo: "iniciativa", refId: null });
    p.ataques.forEach(a => {
      items.push({ id: `ataquedano:${a.id}`, categoria: "Ataques", texto: `${a.nombre}: ataque ${fichasSigno(fichasAtaqueTotal(p, a))}, daño ${a.dano || "—"}`, tipo: "ataquedano", refId: a.id });
    });
    p.hechizos.forEach(h => {
      items.push({ id: `hechizo:${h.id}`, categoria: "Hechizos", texto: `${h.nombre} (nv. ${h.nivel})`, tipo: "hechizo", refId: h.id });
    });
    p.rasgos.filter(r => r.formulaRoll20).forEach(r => {
      items.push({ id: `rasgo:${r.id}`, categoria: "Rasgos", texto: r.nombre, tipo: "rasgo", refId: r.id });
    });
    p.macros.forEach(m => {
      items.push({ id: `macro:${m.id}`, categoria: "Macros", texto: m.nombre, tipo: "macro", refId: m.id });
    });
    return items;
  }

  function renderRoll20Lista() {
    const p = personajeActual;
    if (!p) return;
    const buscar = document.getElementById("fr20Buscar");
    const filtro = document.getElementById("fr20Filtro");
    const soloFav = document.getElementById("fr20SoloFavoritas");
    const cont = document.getElementById("fr20Lista");
    if (!cont) return;

    function pintar() {
      const q = normalizarTexto(buscar.value || "");
      const cat = filtro.value;
      let items = listaCompletaRoll20();
      if (cat !== "todas") items = items.filter(i => i.categoria === cat);
      if (q) items = items.filter(i => normalizarTexto(i.texto).includes(q));
      if (soloFav.checked) items = items.filter(i => p.favoritosRoll20.includes(i.id));
      // Favoritas primero (sección 14: "mostrar primero las que usa con mayor frecuencia").
      items.sort((a, b) => Number(p.favoritosRoll20.includes(b.id)) - Number(p.favoritosRoll20.includes(a.id)));

      cont.innerHTML = items.map(i => `
        <div class="fichas-roll20-item">
          <div>
            <span class="fichas-roll20-item-cat">${esc(i.categoria)}</span>
            <span class="fichas-roll20-item-texto">${esc(i.texto)}</span>
          </div>
          <div class="fichas-roll20-item-acciones">
            <button type="button" class="fichas-roll20-fav ${p.favoritosRoll20.includes(i.id) ? "activa" : ""}" data-fav="${i.id}" title="Favorita">★</button>
            <button type="button" class="fichas-copiar-btn" data-copiar="${i.tipo}" data-id="${i.refId || ""}">Copiar</button>
          </div>
        </div>
      `).join("") || `<p class="fichas-puntos-info">Nada coincide con esa búsqueda.</p>`;

      cont.querySelectorAll("[data-fav]").forEach(el => {
        el.addEventListener("click", () => {
          const id = el.dataset.fav;
          const i = p.favoritosRoll20.indexOf(id);
          if (i === -1) p.favoritosRoll20.push(id); else p.favoritosRoll20.splice(i, 1);
          programarAutoguardado();
          pintar();
        });
      });
    }

    buscar.oninput = pintar;
    filtro.onchange = pintar;
    soloFav.onchange = pintar;
    pintar();
  }

  function renderMacros() {
    const p = personajeActual;
    const cont = document.querySelector('[data-lista="macros"]');
    if (!cont) return;
    cont.innerHTML = p.macros.map(m => `
      <div class="fichas-repetible-item" data-macro="${m.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__macro__.${m.id}.nombre" value="${esc(m.nombre)}" placeholder="Nombre de la macro">
          <button type="button" class="fichas-repetible-remove" data-remove="macro:${m.id}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Fórmula de dados</label>${campoTexto(`__macro__.${m.id}.formula`, m.formula, 'placeholder="1d8"')}</div>
          <div class="fichas-field"><label>Modificador fijo</label>${campoNumero(`__macro__.${m.id}.modificadorFijo`, m.modificadorFijo)}</div>
          <div class="fichas-field"><label>Tipo de daño/efecto</label>${campoTexto(`__macro__.${m.id}.tipoDano`, m.tipoDano)}</div>
          <div class="fichas-field"><label>Modo</label>${campoSelect(`__macro__.${m.id}.modoTirada`, m.modoTirada, [["normal", "Normal"], ["ventaja", "Ventaja"], ["desventaja", "Desventaja"]])}</div>
          <div class="fichas-field fichas-field-check"><label>Favorita</label>${campoCheck(`__macro__.${m.id}.favorita`, m.favorita)}</div>
        </div>
        <div class="fichas-field"><label>Texto narrativo (opcional)</label>${campoTexto(`__macro__.${m.id}.narrativa`, m.narrativa)}</div>
        <div class="fichas-field"><label>Notas</label>${campoTexto(`__macro__.${m.id}.notas`, m.notas)}</div>
        <div class="fichas-copiar-fila"><button type="button" class="fichas-copiar-btn" data-copiar="macro" data-id="${m.id}">Copiar macro</button></div>
      </div>
    `).join("") || `<p class="fichas-puntos-info">Todavía no hay macros.</p>`;
  }

  /* ==========================================================================
     COMBATE: controles rápidos + imprimir/exportar (delegados al documento
     porque viven dentro de paneles que se recrean en cada renderTabs()).
  ========================================================================== */
  document.addEventListener("click", async e => {
    const cont = document.getElementById("fichasTabsPaneles");
    if (!cont || !cont.contains(e.target)) return;
    const p = personajeActual;
    if (!p) return;

    if (e.target.id === "fcBtnRecibirDano") {
      const v = Number(document.getElementById("fcRecibirDano").value) || 0;
      const restante = Math.max(0, p.combate.pvTemp - v);
      const sobra = Math.max(0, v - p.combate.pvTemp);
      p.combate.pvTemp = restante;
      p.combate.pvActual = Math.max(0, p.combate.pvActual - sobra);
      programarAutoguardado(); renderTabs(); document.querySelector('.fichas-tab[data-tab="combate"]').click();
    }
    if (e.target.id === "fcBtnRecuperarPV") {
      const v = Number(document.getElementById("fcRecuperarPV").value) || 0;
      p.combate.pvActual = Math.min(p.combate.pvMax, p.combate.pvActual + v);
      programarAutoguardado(); renderTabs(); document.querySelector('.fichas-tab[data-tab="combate"]').click();
    }
    if (e.target.id === "fcBtnTempPV") {
      const v = Number(document.getElementById("fcTempPV").value) || 0;
      p.combate.pvTemp = Math.max(0, p.combate.pvTemp + v);
      programarAutoguardado(); renderTabs(); document.querySelector('.fichas-tab[data-tab="combate"]').click();
    }
    if (e.target.id === "fcBtnDescansoCorto" || e.target.id === "fcBtnDescansoLargo") {
      const tipo = e.target.id === "fcBtnDescansoCorto" ? "corto" : "largo";
      p.rasgos.forEach(r => { if (r.recuperacion === tipo && r.usosMax != null) r.usosActuales = r.usosMax; });
      if (tipo === "largo") {
        p.combate.pvActual = p.combate.pvMax;
        p.combate.dadosGolpe.actuales = p.combate.dadosGolpe.max;
        p.lanzamiento.espacios.forEach(esp => { esp.usados = 0; });
      }
      programarAutoguardado(); renderTabs(); document.querySelector('.fichas-tab[data-tab="combate"]').click();
    }
    if (e.target.id === "fnImprimir") window.print();
    if (e.target.id === "fnExportarJson") {
      const json = await fichasExportarUno(p.id);
      descargarTexto(json, `ficha-${(p.identidad.nombre || "personaje").replace(/\s+/g, "-")}.json`);
    }
    if (e.target.id === "fr20CopiarTodas") {
      const items = listaCompletaRoll20();
      const porCategoria = {};
      items.forEach(i => { (porCategoria[i.categoria] = porCategoria[i.categoria] || []).push(i.texto); });
      const grupos = Object.entries(porCategoria).map(([titulo, comandos]) => ({ titulo, comandos }));
      await copiarConFeedback(e.target, fichasBloqueMacros(grupos));
    }
  });

  /* ==========================================================================
     INIT
  ========================================================================== */
  document.getElementById("fichasCrearBtn").addEventListener("click", crearPersonaje);
  document.querySelector("[data-vacio-crear]").addEventListener("click", crearPersonaje);
  document.getElementById("fichasImportarPdfBtn").addEventListener("click", () => document.getElementById("fichasArchivoPdf").click());
  document.querySelector("[data-vacio-pdf]").addEventListener("click", () => document.getElementById("fichasArchivoPdf").click());
  document.getElementById("fichasArchivoPdf").addEventListener("change", e => { if (e.target.files[0]) manejarImportarPdf(e.target.files[0]); e.target.value = ""; });
  document.getElementById("fichasImportarJsonBtn").addEventListener("click", () => document.getElementById("fichasArchivoJson").click());
  document.getElementById("fichasArchivoJson").addEventListener("change", e => { if (e.target.files[0]) manejarImportarJson(e.target.files[0]); e.target.value = ""; });
  document.getElementById("fichasExportarTodoBtn").addEventListener("click", async () => {
    descargarTexto(await fichasExportarTodos(), "mis-personajes-respaldo.json");
  });

  fichasInitAuthUI(session => {
    miEmail = session?.user?.email || null;
    if (session) cargarLista();
  });
})();
