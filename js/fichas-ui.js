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
  let avisoPuntosActivo = false; // se prende al subir de nivel, sobrevive a un renderTabs() y se apaga solo al repartir todo
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
    sincronizarRoll20(personajes);
    await cargarMarcasDominio();
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

  /* Personajes que perdieron en Muerte Súbita: los ve su dueño y el Admin
     (la base solo devuelve los intentos propios, o todos si es Admin). */
  const marcasDominio = new Map(); // id de personaje -> "juicio" | "confirmado"
  async function cargarMarcasDominio() {
    marcasDominio.clear();
    if (typeof msListarIntentos !== "function") return;
    try {
      const intentos = await msListarIntentos();
      intentos.forEach(i => {
        if (i.estado === "perdido" && i.veredicto !== "anulado" && i.veredicto !== "perdonado") {
          marcasDominio.set(i.personaje_id, i.veredicto === "confirmado" ? "confirmado" : "juicio");
        }
      });
    } catch (err) { /* sin la tabla de Muerte Súbita no hay marcas */ }
  }

  function textoMarca(estado) {
    return estado === "confirmado" ? "☠ Marcado por el Dominio" : "☠ Marca del Dominio, en juicio";
  }

  function tarjetaHTML(p) {
    const marca = marcasDominio.get(p.id);
    const clases = [p.identidad.clase, ...(p.identidad.clasesExtra || []).map(c => c.nombre)].filter(Boolean).join(" / ");
    const esDeOtro = p.ownerEmail && p.ownerEmail !== miEmail;
    return `
      <article class="fichas-card${marca ? " fichas-card-marcada" : ""}">
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
            ${marca ? `<p class="fichas-marca-dominio">${textoMarca(marca)}</p>` : ""}
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
        sincronizarRoll20([personajeActual]);
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
    avisoPuntosActivo = false;
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

  // Una sola vez: #fichasTabsPaneles es fijo en el HTML, renderTabs() solo
  // le reemplaza el innerHTML, así que la delegación de eventos no necesita
  // (ni debe) volver a registrarse en cada render.
  inicializarEventosTabs();

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
    let marcaEl = document.getElementById("fichasHMarca");
    if (!marcaEl) {
      marcaEl = document.createElement("p");
      marcaEl.id = "fichasHMarca";
      marcaEl.className = "fichas-marca-dominio";
      document.getElementById("fichasHSub").insertAdjacentElement("afterend", marcaEl);
    }
    const marcaEstado = marcasDominio.get(p.id);
    marcaEl.textContent = marcaEstado ? textoMarca(marcaEstado) : "";
    marcaEl.classList.toggle("hidden", !marcaEstado);
    const clases = [p.identidad.clase, ...(p.identidad.clasesExtra || []).map(c => c.nombre)].filter(Boolean).join(" / ");
    const esDeOtro = p.ownerEmail && p.ownerEmail !== miEmail;
    document.getElementById("fichasHSub").textContent = `${p.identidad.raza || "—"} · ${clases || "—"} · Nivel ${p.identidad.nivelTotal}` + (esDeOtro ? ` · De: ${p.ownerUsername || p.ownerEmail}` : "");
    document.getElementById("fichasHPV").textContent = `${p.combate.pvActual}/${p.combate.pvMax}`;
    document.getElementById("fichasHCA").textContent = fichasCATotal(p);
    document.getElementById("fichasHIni").textContent = fichasSigno(fichasIniciativaTotal(p));
    document.getElementById("fichasHVel").textContent = p.combate.velocidad;
    document.getElementById("fichasHComp").textContent = fichasSigno(fichasCompetenciaTotal(p));
    const repartidos = fichasPuntosRepartidos(p);
    const disponibles = fichasPuntosDisponiblesNetos(p);
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
    actualizarAvisoPuntos();
  }

  /* El aviso de "tenés puntos por repartir" solo aparece cuando el
     jugador acaba de subir de nivel (ver manejarCambioBinding). Una vez
     visible, se mantiene actualizado con cada cambio y se esconde solo
     cuando ya repartió todo lo que tenía disponible. */
  function actualizarAvisoPuntos() {
    if (!avisoPuntosActivo) return;
    const aviso = document.getElementById("fichasAvisoPuntos");
    if (!aviso) return; // el panel Resumen no está montado en este momento
    const p = personajeActual;
    const disponibles = fichasPuntosDisponiblesNetos(p);
    const repartidos = fichasPuntosRepartidos(p);
    if (disponibles <= repartidos) {
      avisoPuntosActivo = false;
      aviso.classList.add("hidden");
      return;
    }
    aviso.textContent = `Subiste de nivel: tenés ${disponibles - repartidos} puntos de mejora por repartir.`;
    aviso.classList.remove("hidden");
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
      case "danoAtaque": {
        const a = p.ataques.find(x => x.id === arg);
        return a ? (fichasDanoAtaque(p, a) || "—") : "";
      }
      case "lanzAtaque": return fichasSigno(fichasLanzamientoAtaque(p));
      case "lanzCD": return String(fichasLanzamientoCD(p));
      case "puntosDisponibles": return String(fichasPuntosDisponiblesNetos(p));
      case "puntosRepartidos": return String(fichasPuntosRepartidos(p));
      default: return "";
    }
  }

  /* ==========================================================================
     TABS
  ========================================================================== */
  // Solo cambia qué tab/panel tiene la clase "active" — a diferencia de
  // simular un click() real, esto no mueve el foco ni dispara el scroll
  // automático del navegador hacia el botón de la pestaña.
  function activarTab(nombre) {
    document.querySelectorAll(".fichas-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === nombre));
    document.querySelectorAll(".fichas-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === nombre));
  }

  function renderTabs() {
    document.getElementById("fichasTabsPaneles").innerHTML = [
      panelResumen(), panelCombate(), panelHabilidades(), panelRasgos(),
      panelHechizos(), panelInventario(), panelRoll20(), panelNotas()
    ].join("");

    document.querySelectorAll(".fichas-tab").forEach(btn => {
      btn.onclick = () => {
        activarTab(btn.dataset.tab);
        if (btn.dataset.tab === "roll20") renderRoll20Lista();
      };
    });
    activarTab("resumen");
    aplicarFiltroHechizos();
    hechizoParaAbrir = null;

    renderMacros();
    renderRoll20Lista();
  }

  /* --- Binding genérico: cualquier input/select/textarea con data-bind --- */
  function manejarCambioBinding(e) {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    const path = el.dataset.bind;
    let valor;
    if (el.type === "checkbox") valor = el.checked;
    else if (el.type === "number") valor = el.value === "" ? 0 : Number(el.value);
    else valor = el.value;
    const esSubidaDeNivel = path === "identidad.nivelTotal" && Number(valor) > Number(personajeActual.identidad.nivelTotal);
    setPath(personajeActual, path, valor);
    if (esSubidaDeNivel) mostrarAvisoPuntos();
    refrescarCalculado();
    programarAutoguardado();
  }

  function mostrarAvisoPuntos() {
    const p = personajeActual;
    if (fichasPuntosDisponiblesNetos(p) <= fichasPuntosRepartidos(p)) return;
    avisoPuntosActivo = true;
    actualizarAvisoPuntos();
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

  /* --- Secciones plegables: cada bloque se puede colapsar para que la
     ficha no se sienta interminable. El estado abierto/cerrado se guarda en
     memoria porque renderTabs() recrea todo el HTML al agregar o quitar
     filas, y sin esto las secciones volverían a su estado inicial. --- */
  const seccionesAbiertas = new Map();
  const CLAVE_VISTA_HECHIZOS = "fichasVistaHechizos";
  let vistaGuardada = "lista";
  try { vistaGuardada = localStorage.getItem(CLAVE_VISTA_HECHIZOS) === "cubos" ? "cubos" : "lista"; } catch (e) { /* sin almacenamiento */ }
  const filtroHechizos = { texto: "", soloDisponibles: false, vista: vistaGuardada };
  let hechizoParaAbrir = null;

  function normalizarBusqueda(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  let imprimiendo = false;
  window.addEventListener("beforeprint", () => {
    imprimiendo = true;
    document.querySelectorAll("#fichasTabsPaneles .fichas-hechizo:not([data-listo])").forEach(llenarCuerpoHechizo);
    document.querySelectorAll("#fichasTabsPaneles details").forEach(d => { d.dataset.eraAbierta = d.open ? "1" : "0"; d.open = true; });
  });
  window.addEventListener("afterprint", () => {
    document.querySelectorAll("#fichasTabsPaneles details").forEach(d => { d.open = d.dataset.eraAbierta === "1"; });
    setTimeout(() => { imprimiendo = false; }, 200);
  });
  function seccion(id, titulo, cuerpo, abiertaPorDefecto = false) {
    const abierta = seccionesAbiertas.has(id) ? seccionesAbiertas.get(id) : abiertaPorDefecto;
    return `
      <details class="fichas-fieldset fichas-seccion" data-seccion="${id}" ${abierta ? "open" : ""}>
        <summary><h3>${titulo}</h3></summary>
        <div class="fichas-seccion-cuerpo">${cuerpo}</div>
      </details>`;
  }
  function mas(cuerpo, etiqueta = "Más opciones") {
    return `<details class="fichas-mas"><summary>${etiqueta}</summary><div class="fichas-mas-cuerpo">${cuerpo}</div></details>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelResumen() {
    const p = personajeActual;
    const identidad = `
      <div class="fichas-identidad-fila">
        <div class="fichas-avatar-resumen">${slotImagenTablero("retrato")}</div>
        <div class="fichas-field-grid fichas-identidad-campos">
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
      </div>`;

    const atributos = `
      <div class="fichas-atributos-grid">
        ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
          <div class="fichas-atributo-card">
            <small>${nombre}</small>
            ${campoNumero(`atributos.${id}`, p.atributos[id])}
            <div class="fichas-field-resultado" data-calc="modAtributo:${id}">${fichasSigno(fichasModificadorFinal(p, id))}</div>
          </div>
        `).join("")}
      </div>
      <p class="fichas-puntos-info">Puntos por tu nivel: <strong data-calc="puntosDisponibles">${fichasPuntosDisponiblesNetos(p)}</strong>. Repartidos: <strong data-calc="puntosRepartidos">${fichasPuntosRepartidos(p)}</strong></p>
      <p id="fichasAvisoPuntos" class="fichas-aviso-puntos ${avisoPuntosActivo ? "" : "hidden"}">Subiste de nivel: tenés ${fichasPuntosDisponiblesNetos(p) - fichasPuntosRepartidos(p)} puntos de mejora por repartir.</p>`;

    const ajustes = `
      <p class="fichas-imagenes-ayuda">Todo personaje arranca en 8 en cada característica. Los bonos raciales se suman a la puntuación final, pero no cuentan como puntos de mejora repartidos.</p>
      <div class="fichas-atributos-grid fichas-atributos-grid--chico">
        ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
          <div class="fichas-field">
            <label>${nombre}</label>
            ${campoNumero(`atributosRaciales.${id}`, p.atributosRaciales[id])}
            <input type="number" class="fichas-atributo-ajuste" data-bind="ajustesAtributos.${id}" value="${esc(p.ajustesAtributos[id])}" placeholder="ajuste" title="Ajuste manual (objetos, maldiciones, reglas caseras)">
          </div>
        `).join("")}
      </div>
      <p class="fichas-puntos-info">Arriba de cada característica: bono racial. Abajo: ajuste manual.</p>
      <div class="fichas-field-grid">
        <div class="fichas-field"><label>Puntos cambiados por un feat</label>${campoNumero("puntosFeats", p.puntosFeats, 'min="0"')}</div>
        <div class="fichas-field"><label>Competencia base</label><div class="fichas-field-resultado">${fichasSigno(fichasCompetenciaBase(p.identidad.nivelTotal))}</div></div>
        <div class="fichas-field"><label>Ajuste de competencia</label>${campoNumero("competenciaAjusteManual", p.competenciaAjusteManual)}</div>
        <div class="fichas-field"><label>Competencia total</label><div class="fichas-field-resultado" data-calc="competenciaTotal">${fichasSigno(fichasCompetenciaTotal(p))}</div></div>
      </div>`;

    const clases = `
      <div data-lista="clasesExtra">${(p.identidad.clasesExtra || []).map((c, i) => filaClaseExtra(c, i)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="claseExtra">+ Agregar clase</button>`;

    const descripcion = `
      <div class="fichas-field-grid wide">
        <div class="fichas-field"><label>Descripción física</label>${campoTextarea("identidad.descripcionFisica", p.identidad.descripcionFisica)}</div>
        <div class="fichas-field"><label>Historia resumida</label>${campoTextarea("identidad.historia", p.identidad.historia)}</div>
      </div>`;

    return `
    <section class="fichas-panel" data-panel="resumen">
      ${seccion("identidad", "Identidad", identidad, true)}
      ${seccion("atributos", "Atributos", atributos, true)}
      ${seccion("ajustes", "Bonos, feats y competencia", ajustes)}
      ${seccion("clases", "Clases adicionales", clases)}
      ${seccion("descripcion", "Descripción e historia", descripcion)}
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
    const pv = `
      <div class="fichas-field-grid fichas-grid-chico">
        <div class="fichas-field"><label>PV máximos</label>${campoNumero("combate.pvMax", p.combate.pvMax)}</div>
        <div class="fichas-field"><label>PV actuales</label>${campoNumero("combate.pvActual", p.combate.pvActual)}</div>
        <div class="fichas-field"><label>PV temporales</label>${campoNumero("combate.pvTemp", p.combate.pvTemp)}</div>
        <div class="fichas-field"><label>Dados de golpe</label>${campoNumero("combate.dadosGolpe.actuales", p.combate.dadosGolpe.actuales)}</div>
        <div class="fichas-field"><label>Dados máx.</label>${campoNumero("combate.dadosGolpe.max", p.combate.dadosGolpe.max)}</div>
        <div class="fichas-field"><label>Tipo de dado</label>${campoTexto("combate.dadosGolpe.dado", p.combate.dadosGolpe.dado)}</div>
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
      </div>`;

    const defensa = `
      <div class="fichas-field-grid fichas-grid-chico">
        <div class="fichas-field"><label>Modo de CA</label>${campoSelect("combate.ca.modo", p.combate.ca.modo, [["manual", "Manual"], ["calculada", "Calculada"]])}</div>
        <div class="fichas-field"><label>CA manual</label>${campoNumero("combate.ca.manual", p.combate.ca.manual)}</div>
        <div class="fichas-field"><label>Armadura base</label>${campoNumero("combate.ca.armadura", p.combate.ca.armadura)}</div>
        <div class="fichas-field"><label>Escudo</label>${campoNumero("combate.ca.escudo", p.combate.ca.escudo)}</div>
        <div class="fichas-field"><label>Otros ajustes</label>${campoNumero("combate.ca.otros", p.combate.ca.otros)}</div>
        <div class="fichas-field fichas-field-check"><label>¿Suma Destreza?</label>${campoCheck("combate.ca.incluyeDes", p.combate.ca.incluyeDes)}</div>
        <div class="fichas-field"><label>CA total</label><div class="fichas-field-resultado" data-calc="caTotal">${fichasCATotal(p)}</div></div>
        <div class="fichas-field"><label>Velocidad</label>${campoNumero("combate.velocidad", p.combate.velocidad)}</div>
        <div class="fichas-field"><label>Ajuste de iniciativa</label>${campoNumero("combate.iniciativaAjuste", p.combate.iniciativaAjuste)}</div>
        <div class="fichas-field"><label>Iniciativa total</label><div class="fichas-field-resultado" data-calc="iniciativaTotal">${fichasSigno(fichasIniciativaTotal(p))}</div></div>
      </div>
      <div class="fichas-copiar-fila">
        <button type="button" class="fichas-copiar-btn" data-copiar="iniciativa">Copiar iniciativa para Roll20</button>
      </div>`;

    const muerte = `
      <div class="fichas-field-grid fichas-grid-chico">
        <div class="fichas-field"><label>Éxitos (0-3)</label>${campoNumero("combate.salvMuerte.exitos", p.combate.salvMuerte.exitos, 'min="0" max="3"')}</div>
        <div class="fichas-field"><label>Fallos (0-3)</label>${campoNumero("combate.salvMuerte.fallos", p.combate.salvMuerte.fallos, 'min="0" max="3"')}</div>
      </div>`;

    const estados = `
      <div class="fichas-field-grid wide">
        <div class="fichas-field"><label>Condiciones activas (separadas por coma)</label>${campoTexto("combate.condiciones", p.combate.condiciones)}</div>
        <div class="fichas-field"><label>Resistencias</label>${campoTexto("combate.resistencias", p.combate.resistencias)}</div>
        <div class="fichas-field"><label>Inmunidades</label>${campoTexto("combate.inmunidades", p.combate.inmunidades)}</div>
        <div class="fichas-field"><label>Vulnerabilidades</label>${campoTexto("combate.vulnerabilidades", p.combate.vulnerabilidades)}</div>
        <div class="fichas-field"><label>Sentidos especiales</label>${campoTexto("combate.sentidos", p.combate.sentidos)}</div>
      </div>`;

    const ataques = `
      <div data-lista="ataques">${p.ataques.map(a => filaAtaque(a)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="ataque">+ Agregar ataque</button>`;

    return `
    <section class="fichas-panel" data-panel="combate">
      ${seccion("pv", "Puntos de golpe", pv, true)}
      ${seccion("defensa", "Defensa, iniciativa y velocidad", defensa, true)}
      ${seccion("ataques", "Ataques", ataques, true)}
      ${seccion("estados", "Condiciones, resistencias y sentidos", estados)}
      ${seccion("muerte", "Salvaciones contra la muerte", muerte)}
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
        <div class="fichas-field-grid fichas-grid-chico">
          <div class="fichas-field"><label>Atributo</label>${campoSelect(`__ataque__.${a.id}.atributo`, a.atributo, Object.entries(NOMBRES_ATRIBUTOS).map(([id, n]) => [id, n]))}</div>
          <div class="fichas-field fichas-field-check"><label>¿Competente?</label>${campoCheck(`__ataque__.${a.id}.competente`, a.competente)}</div>
          <div class="fichas-field"><label>Ajuste adicional</label>${campoNumero(`__ataque__.${a.id}.ajusteAtaque`, a.ajusteAtaque)}</div>
          <div class="fichas-field"><label>Bonificador total</label><div class="fichas-field-resultado" data-calc="ataqueTotal:${a.id}">${fichasSigno(fichasAtaqueTotal(p, a))}</div></div>
          <div class="fichas-field"><label>Daño</label>${campoTexto(`__ataque__.${a.id}.dano`, a.dano, 'placeholder="1d8+2"')}</div>
          <div class="fichas-field"><label>Tipo de daño</label>${campoTexto(`__ataque__.${a.id}.tipoDano`, a.tipoDano)}</div>
          <div class="fichas-field fichas-field-check"><label>Sumar el modificador al daño</label>${campoCheck(`__ataque__.${a.id}.sumaModDano`, a.sumaModDano)}</div>
          <div class="fichas-field"><label>Daño extra (manual)</label>${campoTexto(`__ataque__.${a.id}.danoExtra`, a.danoExtra || "", 'placeholder="+1d4 o +2"')}</div>
        </div>
        <p class="fichas-puntos-info">Se tira de daño: <strong data-calc="danoAtaque:${a.id}">${esc(fichasDanoAtaque(p, a) || "—")}</strong></p>
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
        ${mas(`
          <div class="fichas-field-grid fichas-grid-chico">
            <div class="fichas-field"><label>Alcance</label>${campoTexto(`__ataque__.${a.id}.alcance`, a.alcance)}</div>
            <div class="fichas-field"><label>Munición actual</label>${campoNumero(`__ataque__.${a.id}.municionActual`, a.municionActual ?? "")}</div>
            <div class="fichas-field"><label>Munición máxima</label>${campoNumero(`__ataque__.${a.id}.municionMax`, a.municionMax ?? "")}</div>
          </div>
          <div class="fichas-field"><label>Propiedades</label>${campoTexto(`__ataque__.${a.id}.propiedades`, a.propiedades)}</div>
          <div class="fichas-field"><label>Notas</label>${campoTextarea(`__ataque__.${a.id}.notas`, a.notas, 2)}</div>`)}
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelHabilidades() {
    const p = personajeActual;
    const salvaciones = `
      <div class="fichas-compacto-grid">
        ${Object.entries(NOMBRES_ATRIBUTOS).map(([id, nombre]) => `
          <div class="fichas-compacto-item">
            <div class="fichas-compacto-titulo"><strong>${nombre}</strong>
              <span class="fichas-field-resultado" data-calc="salvTotal:${id}">${fichasSigno(fichasSalvacionTotal(p, id))}</span>
            </div>
            <label class="fichas-compacto-check">${campoCheck(`salvaciones.${id}.competente`, p.salvaciones[id].competente)} Competente</label>
            <input type="number" class="fichas-atributo-ajuste" data-bind="salvaciones.${id}.ajuste" value="${esc(p.salvaciones[id].ajuste)}" placeholder="ajuste" title="Ajuste adicional">
          </div>
        `).join("")}
      </div>`;

    const habilidades = `
      <p class="fichas-puntos-info">Percepción pasiva: <strong data-calc="percepcionPasiva">${fichasPercepcionPasiva(p)}</strong></p>
      <div class="fichas-hab-lista">
        ${FICHAS_HABILIDADES.map(h => `
          <div class="fichas-hab-fila">
            <span class="fichas-hab-nombre">${h.nombre} <small>(${NOMBRES_ATRIBUTOS[h.atributo]})</small></span>
            <select data-bind="habilidades.${h.id}.nivel" title="Nivel de competencia">${[["ninguna", "Sin competencia"], ["competente", "Competente"], ["pericia", "Pericia"]].map(([v, t]) => `<option value="${v}" ${v === p.habilidades[h.id].nivel ? "selected" : ""}>${t}</option>`).join("")}</select>
            <input type="number" class="fichas-atributo-ajuste" data-bind="habilidades.${h.id}.ajuste" value="${esc(p.habilidades[h.id].ajuste)}" placeholder="ajuste" title="Ajuste adicional">
            <span class="fichas-field-resultado" data-calc="habTotal:${h.id}">${fichasSigno(fichasHabilidadTotal(p, h.id))}</span>
          </div>
        `).join("")}
      </div>
      <p class="fichas-puntos-info">Para copiar una tirada a Roll20, usa la pestaña Roll20.</p>`;

    return `
    <section class="fichas-panel" data-panel="habilidades">
      ${seccion("salvaciones", "Tiradas de salvación", salvaciones, true)}
      ${seccion("habilidades", "Habilidades", habilidades, true)}
    </section>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelRasgos() {
    const p = personajeActual;
    const rasgos = `
      <div data-lista="rasgos">${p.rasgos.map(r => filaRasgo(r)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="rasgo">+ Agregar rasgo/recurso</button>`;
    const competencias = `
      <div class="fichas-field-grid wide">
        <div class="fichas-field"><label>Armas</label>${campoTexto("competenciasArmas", p.competenciasArmas || "")}</div>
        <div class="fichas-field"><label>Armaduras</label>${campoTexto("competenciasArmaduras", p.competenciasArmaduras || "")}</div>
        <div class="fichas-field"><label>Herramientas</label>${campoTexto("competenciasHerramientas", p.competenciasHerramientas || "")}</div>
        <div class="fichas-field"><label>Idiomas</label>${campoTexto("idiomas", p.idiomas || "")}</div>
      </div>`;
    return `
    <section class="fichas-panel" data-panel="rasgos">
      ${seccion("rasgos", "Rasgos y recursos", rasgos, true)}
      ${seccion("competencias", "Competencias e idiomas", competencias)}
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
        <div class="fichas-field-grid fichas-grid-chico">
          <div class="fichas-field"><label>Usos actuales</label>${campoNumero(`__rasgo__.${r.id}.usosActuales`, r.usosActuales ?? "")}</div>
          <div class="fichas-field"><label>Usos máximos</label>${campoNumero(`__rasgo__.${r.id}.usosMax`, r.usosMax ?? "")}</div>
          <div class="fichas-field"><label>Tipo de acción</label>${campoSelect(`__rasgo__.${r.id}.tipoAccion`, r.tipoAccion || "accion", [["accion", "Acción"], ["adicional", "Acción adicional"], ["reaccion", "Reacción"], ["pasiva", "Pasiva"], ["otra", "Otra"]])}</div>
          <div class="fichas-field"><label>Recuperación</label>${campoSelect(`__rasgo__.${r.id}.recuperacion`, r.recuperacion || "manual", [["corto", "Descanso corto"], ["largo", "Descanso largo"], ["manual", "Manual"]])}</div>
        </div>
        ${mas(`
          <div class="fichas-field"><label>Fórmula para Roll20 (opcional)</label>${campoTexto(`__rasgo__.${r.id}.formulaRoll20`, r.formulaRoll20)}</div>
          ${r.formulaRoll20 ? `<div class="fichas-copiar-fila"><button type="button" class="fichas-copiar-btn" data-copiar="rasgo" data-id="${r.id}">Copiar para Roll20</button></div>` : ""}`)}
      </div>`;
  }

  /* ---------------------------------------------------------------------- */
  function panelHechizos() {
    const p = personajeActual;
    const l = p.lanzamiento;
    const lanzamiento = `
      <div class="fichas-field-grid fichas-grid-chico">
        <div class="fichas-field"><label>Atributo</label>${campoSelect("lanzamiento.atributo", l.atributo, Object.entries(NOMBRES_ATRIBUTOS).map(([id, n]) => [id, n]))}</div>
        <div class="fichas-field"><label>Ataque mágico total</label><div class="fichas-field-resultado" data-calc="lanzAtaque">${fichasSigno(fichasLanzamientoAtaque(p))}</div></div>
        <div class="fichas-field"><label>CD total</label><div class="fichas-field-resultado" data-calc="lanzCD">${fichasLanzamientoCD(p)}</div></div>
      </div>
      ${mas(`
        <div class="fichas-field-grid fichas-grid-chico">
          <div class="fichas-field fichas-field-check"><label>Usar valores manuales</label>${campoCheck("lanzamiento.manual", l.manual)}</div>
          <div class="fichas-field"><label>Ajuste ataque mágico</label>${campoNumero("lanzamiento.ajusteAtaque", l.ajusteAtaque)}</div>
          <div class="fichas-field"><label>Ajuste CD</label>${campoNumero("lanzamiento.ajusteCD", l.ajusteCD)}</div>
          <div class="fichas-field"><label>Ataque mágico manual</label>${campoNumero("lanzamiento.ataqueManual", l.ataqueManual)}</div>
          <div class="fichas-field"><label>CD manual</label>${campoNumero("lanzamiento.cdManual", l.cdManual)}</div>
        </div>`, "Valores manuales")}`;
    const espacios = `
      <div data-lista="espacios">${l.espacios.map((e, i) => filaEspacio(e, i)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="espacio">+ Agregar nivel de espacio</button>`;
    const vista = filtroHechizos.vista;
    const hechizos = `
      <div class="fichas-hechizos-barra">
        <input type="search" id="fhBuscar" placeholder="Buscar conjuro..." value="${esc(filtroHechizos.texto)}">
        <label class="fichas-compacto-check"><input type="checkbox" id="fhSoloDisp" ${filtroHechizos.soloDisponibles ? "checked" : ""}> Solo disponibles</label>
        <div class="fichas-vista-toggle">
          <button type="button" data-fh-vista="lista" class="${vista === "lista" ? "activo" : ""}">Lista</button>
          <button type="button" data-fh-vista="cubos" class="${vista === "cubos" ? "activo" : ""}">Cubos</button>
        </div>
        <button type="button" class="fichas-link-button" id="fhColapsar">Colapsar todo</button>
        <span id="fhConteo" class="fichas-puntos-info"></span>
      </div>
      <div data-lista="hechizos" class="fichas-hechizos fichas-hechizos--${vista}">${p.hechizos.map(h => filaHechizo(h, h.id === hechizoParaAbrir)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="hechizo">+ Agregar conjuro</button>`;
    return `
    <section class="fichas-panel" data-panel="hechizos">
      ${seccion("lanzamiento", "Lanzamiento de conjuros", lanzamiento, true)}
      ${seccion("espacios", "Espacios de conjuro", espacios, true)}
      ${seccion("hechizos", "Conjuros", hechizos, true)}
    </section>`;
  }

  function filaEspacio(e, i) {
    return `
      <div class="fichas-repetible-item" data-espacio="${i}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="lanzamiento.espacios.${i}.nombre" value="${esc(e.nombre === undefined ? `Nivel ${i + 1}` : e.nombre)}" placeholder="Nivel ${i + 1}">
          <button type="button" class="fichas-repetible-remove" data-remove="espacio:${i}">×</button>
        </div>
        <div class="fichas-field-grid">
          <div class="fichas-field"><label>Nivel</label>${campoNumero(`lanzamiento.espacios.${i}.nivel`, e.nivel)}</div>
          <div class="fichas-field"><label>Máximos</label>${campoNumero(`lanzamiento.espacios.${i}.max`, e.max)}</div>
          <div class="fichas-field"><label>Usados</label>${campoNumero(`lanzamiento.espacios.${i}.usados`, e.usados)}</div>
        </div>
      </div>`;
  }

  function etiquetaNivelHechizo(h) {
    return Number(h.nivel) > 0 ? `Nv ${h.nivel}` : "Truco";
  }

  function filaHechizo(h, abierto) {
    const disponible = h.disponible !== false;
    return `
      <details class="fichas-hechizo ${disponible ? "" : "no-disponible"}" data-hechizo="${h.id}" data-nombre="${esc(normalizarBusqueda(h.nombre))}" ${abierto ? 'open data-listo="1"' : ""}>
        <summary>
          <span class="fh-nombre">${esc(h.nombre || "Sin nombre")}</span>
          <span class="fh-nivel">${etiquetaNivelHechizo(h)}</span>
          <span class="fh-disp" title="Disponible"><input type="checkbox" data-bind="__hechizo__.${h.id}.disponible" ${disponible ? "checked" : ""}></span>
        </summary>
        <div class="fh-cuerpo">${abierto ? cuerpoHechizo(h) : ""}</div>
      </details>`;
  }

  function cuerpoHechizo(h) {
    return `
      <div class="fichas-repetible-header">
          <input type="text" data-bind="__hechizo__.${h.id}.nombre" value="${esc(h.nombre)}" placeholder="Nombre del conjuro">
          <button type="button" class="fichas-repetible-remove" data-remove="hechizo:${h.id}">×</button>
        </div>
        <div class="fichas-field-grid fichas-grid-chico">
          <div class="fichas-field"><label>Nivel</label>${campoNumero(`__hechizo__.${h.id}.nivel`, h.nivel)}</div>
          <div class="fichas-field"><label>Tipo</label>${campoSelect(`__hechizo__.${h.id}.tipo`, h.tipo || "ninguno", [["ataque", "Ataque mágico"], ["salvacion", "Requiere salvación"], ["ninguno", "Ninguno"]])}</div>
          <div class="fichas-field"><label>Daño/curación</label>${campoTexto(`__hechizo__.${h.id}.dano`, h.dano, 'placeholder="8d6 o 1d4+3"')}</div>
          <div class="fichas-field"><label>Tipo de daño</label>${campoTexto(`__hechizo__.${h.id}.tipoDano`, h.tipoDano)}</div>
        </div>
        <div class="fichas-field"><label>Descripción</label>${campoTextarea(`__hechizo__.${h.id}.descripcion`, h.descripcion, 2)}</div>
        <div class="fichas-copiar-fila">
          <button type="button" class="fichas-copiar-btn" data-copiar="hechizo" data-id="${h.id}">Copiar para Roll20</button>
        </div>
        ${mas(`
          <div class="fichas-field-grid fichas-grid-chico">
            <div class="fichas-field"><label>Escuela</label>${campoTexto(`__hechizo__.${h.id}.escuela`, h.escuela)}</div>
            <div class="fichas-field"><label>Tiempo de lanzamiento</label>${campoTexto(`__hechizo__.${h.id}.tiempo`, h.tiempo)}</div>
            <div class="fichas-field"><label>Alcance</label>${campoTexto(`__hechizo__.${h.id}.alcance`, h.alcance)}</div>
            <div class="fichas-field"><label>Duración</label>${campoTexto(`__hechizo__.${h.id}.duracion`, h.duracion)}</div>
            <div class="fichas-field"><label>Componentes</label>${campoTexto(`__hechizo__.${h.id}.componentes`, h.componentes)}</div>
            <div class="fichas-field fichas-field-check"><label>Concentración</label>${campoCheck(`__hechizo__.${h.id}.concentracion`, h.concentracion)}</div>
            <div class="fichas-field fichas-field-check"><label>Ritual</label>${campoCheck(`__hechizo__.${h.id}.ritual`, h.ritual)}</div>
          </div>
          <div class="fichas-field"><label>Notas</label>${campoTextarea(`__hechizo__.${h.id}.notas`, h.notas, 2)}</div>`)}`;
  }

  function llenarCuerpoHechizo(detalle) {
    const h = personajeActual.hechizos.find(x => x.id === detalle.dataset.hechizo);
    if (!h) return;
    detalle.querySelector(".fh-cuerpo").innerHTML = cuerpoHechizo(h);
    detalle.dataset.listo = "1";
  }

  function aplicarFiltroHechizos() {
    const lista = document.querySelectorAll("#fichasTabsPaneles .fichas-hechizo");
    const q = normalizarBusqueda(filtroHechizos.texto.trim());
    let visibles = 0;
    let disponibles = 0;
    lista.forEach(d => {
      const esDisp = !d.classList.contains("no-disponible");
      if (esDisp) disponibles += 1;
      const coincide = (!q || d.dataset.nombre.includes(q)) && (!filtroHechizos.soloDisponibles || esDisp);
      d.hidden = !coincide;
      if (coincide) visibles += 1;
    });
    const conteo = document.getElementById("fhConteo");
    if (conteo) conteo.textContent = `${lista.length} ${lista.length === 1 ? "conjuro" : "conjuros"} · ${disponibles} ${disponibles === 1 ? "disponible" : "disponibles"}` + (visibles !== lista.length ? ` · ${visibles} a la vista` : "");
  }

  /* ---------------------------------------------------------------------- */
  function panelInventario() {
    const p = personajeActual;
    const monedas = `
      <div class="fichas-field-grid fichas-grid-chico">
        <div class="fichas-field"><label>Oro</label>${campoNumero("inventario.monedas.oro", p.inventario.monedas.oro)}</div>
        <div class="fichas-field"><label>Plata</label>${campoNumero("inventario.monedas.plata", p.inventario.monedas.plata)}</div>
        <div class="fichas-field"><label>Cobre</label>${campoNumero("inventario.monedas.cobre", p.inventario.monedas.cobre)}</div>
        <div class="fichas-field fichas-field-check"><label>Usar cálculo de peso</label>${campoCheck("inventario.usarPeso", p.inventario.usarPeso)}</div>
      </div>`;
    const objetos = `
      <div data-lista="objetos">${p.inventario.objetos.map(o => filaObjeto(o, p.inventario.usarPeso)).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-add="objeto">+ Agregar objeto</button>`;
    return `
    <section class="fichas-panel" data-panel="inventario">
      ${seccion("monedas", "Monedas", monedas, true)}
      ${seccion("objetos", "Objetos", objetos, true)}
    </section>`;
  }

  function filaObjeto(o, usarPeso) {
    return `
      <div class="fichas-repetible-item" data-objeto="${o.id}">
        <div class="fichas-repetible-header">
          <input type="text" data-bind="__objeto__.${o.id}.nombre" value="${esc(o.nombre)}" placeholder="Nombre del objeto">
          <button type="button" class="fichas-repetible-remove" data-remove="objeto:${o.id}">×</button>
        </div>
        <div class="fichas-field-grid fichas-grid-chico">
          <div class="fichas-field"><label>Cantidad</label>${campoNumero(`__objeto__.${o.id}.cantidad`, o.cantidad)}</div>
          ${usarPeso ? `<div class="fichas-field"><label>Peso</label>${campoNumero(`__objeto__.${o.id}.peso`, o.peso ?? "")}</div>` : ""}
          <div class="fichas-field"><label>Estado</label>${campoSelect(`__objeto__.${o.id}.estado`, o.estado, [["equipado", "Equipado"], ["guardado", "Guardado"], ["consumido", "Consumido"]])}</div>
        </div>
        ${mas(`
          <div class="fichas-field-grid fichas-grid-chico">
            <div class="fichas-field"><label>Cargas actuales</label>${campoNumero(`__objeto__.${o.id}.cargasActuales`, o.cargasActuales ?? "")}</div>
            <div class="fichas-field"><label>Cargas máximas</label>${campoNumero(`__objeto__.${o.id}.cargasMax`, o.cargasMax ?? "")}</div>
            <div class="fichas-field"><label>Valor</label>${campoNumero(`__objeto__.${o.id}.valor`, o.valor ?? "")}</div>
          </div>
          <div class="fichas-field"><label>Descripción</label>${campoTextarea(`__objeto__.${o.id}.descripcion`, o.descripcion, 2)}</div>
          <div class="fichas-field"><label>Notas</label>${campoTexto(`__objeto__.${o.id}.notas`, o.notas)}</div>`)}
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
      <div class="fichas-fieldset fichas-roll20-instalar">
        <h3>Tus tiradas dentro de Roll20, sin copiar y pegar</h3>
        <p class="fichas-imagenes-ayuda">Con el script del Compendio, Roll20 muestra un panel con tus tiradas (las favoritas primero) y las manda al chat con un clic. Se instala una sola vez y se actualiza solo.</p>
        <ol class="fichas-roll20-pasos">
          <li>Instala la extensión <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener">Tampermonkey</a> en el navegador donde usas Roll20.</li>
          <li><a href="roll20/compendio-roll20.user.js" class="fichas-roll20-instalar-enlace">Instalar el script del Compendio</a> (Tampermonkey te pedirá confirmar).</li>
          <li>Abre tu partida en Roll20 y pulsa el botón <strong>Compendio</strong> (abajo a la izquierda). La primera vez entras con el correo y la contraseña de tu cuenta de aquí.</li>
        </ol>
        <p class="fichas-puntos-info">Tus tiradas se actualizan solas cuando editas tu ficha: no tienes que abrir esta página en el mismo navegador de Roll20.</p>
      </div>

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
            <option value="Conjuros">Conjuros</option>
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

     IMPORTANTE: esta delegación se registra UNA sola vez (ver
     inicializarEventosTabs, más abajo) — #fichasTabsPaneles nunca se
     destruye, solo se le reemplaza el innerHTML en cada renderTabs(), así
     que volver a llamar addEventListener acá en cada render apilaría un
     listener nuevo encima de los anteriores sin sacar los viejos: un
     click terminaría disparando manejarAgregar/manejarQuitar tantas
     veces como renders hubo, duplicando ataques/objetos por cada click.
  ========================================================================== */
  function inicializarEventosTabs() {
    const cont = document.getElementById("fichasTabsPaneles");

    cont.addEventListener("toggle", e => {
      const d = e.target;
      if (d.classList && d.classList.contains("fichas-hechizo") && d.open && !d.dataset.listo) llenarCuerpoHechizo(d);
      if (!imprimiendo && d.dataset && d.dataset.seccion) seccionesAbiertas.set(d.dataset.seccion, d.open);
    }, true);

    // En captura a propósito: el binding de arrays (manejarBindingDeArray)
    // corta la propagación de los campos __hechizo__.*, y estos oyentes
    // necesitan ver también esos eventos.
    cont.addEventListener("input", e => {
      if (e.target.id === "fhBuscar") {
        filtroHechizos.texto = e.target.value;
        aplicarFiltroHechizos();
        return;
      }
      // El nombre y el nivel de un hechizo se reflejan al instante en su fila cerrada
      const m = (e.target.dataset && e.target.dataset.bind || "").match(/^__hechizo__\.([^.]+)\.(nombre|nivel)$/);
      if (m) {
        const d = cont.querySelector(`.fichas-hechizo[data-hechizo="${m[1]}"]`);
        const h = personajeActual.hechizos.find(x => x.id === m[1]);
        if (d && h) {
          const nuevo = m[2] === "nombre" ? e.target.value : h.nombre;
          d.querySelector(".fh-nombre").textContent = nuevo || "Sin nombre";
          d.dataset.nombre = normalizarBusqueda(nuevo);
          if (m[2] === "nivel") d.querySelector(".fh-nivel").textContent = Number(e.target.value) > 0 ? `Nv ${e.target.value}` : "Truco";
        }
      }
    }, true);
    cont.addEventListener("change", e => {
      if (e.target.id === "fhSoloDisp") {
        filtroHechizos.soloDisponibles = e.target.checked;
        aplicarFiltroHechizos();
        return;
      }
      const marca = e.target.closest && e.target.closest(".fh-disp");
      if (marca) {
        marca.closest(".fichas-hechizo").classList.toggle("no-disponible", !e.target.checked);
        aplicarFiltroHechizos();
      }
    }, true);
    cont.addEventListener("click", e => {
      const vistaBtn = e.target.closest("[data-fh-vista]");
      if (vistaBtn) {
        filtroHechizos.vista = vistaBtn.dataset.fhVista;
        try { localStorage.setItem(CLAVE_VISTA_HECHIZOS, filtroHechizos.vista); } catch (err) { /* sin almacenamiento */ }
        const lista = cont.querySelector(".fichas-hechizos");
        lista.classList.toggle("fichas-hechizos--lista", filtroHechizos.vista === "lista");
        lista.classList.toggle("fichas-hechizos--cubos", filtroHechizos.vista === "cubos");
        cont.querySelectorAll("[data-fh-vista]").forEach(b => b.classList.toggle("activo", b === vistaBtn));
      } else if (e.target.id === "fhColapsar") {
        cont.querySelectorAll(".fichas-hechizo[open]").forEach(d => { d.open = false; });
      }
    });

    /* Los campos numéricos se envuelven con flechitas propias (las del
       navegador no se pueden estilizar y desentonaban con el tema). Un
       MutationObserver los envuelve también cuando se arman más tarde
       (hechizos, macros, filas nuevas). */
    const envolverNumericos = () => {
      cont.querySelectorAll('input[type="number"]').forEach(inp => {
        if (inp.closest(".fichas-num")) return;
        const envoltorio = document.createElement("span");
        envoltorio.className = "fichas-num";
        inp.replaceWith(envoltorio);
        envoltorio.appendChild(inp);
        envoltorio.insertAdjacentHTML("beforeend", '<span class="fichas-num-botones"><button type="button" tabindex="-1" data-paso="1" aria-label="Subir"></button><button type="button" tabindex="-1" data-paso="-1" aria-label="Bajar"></button></span>');
      });
    };
    new MutationObserver(envolverNumericos).observe(cont, { childList: true, subtree: true });
    envolverNumericos();

    cont.addEventListener("click", e => {
      const paso = e.target.closest(".fichas-num-botones button");
      if (!paso) return;
      const campo = paso.closest(".fichas-num").querySelector("input");
      if (Number(paso.dataset.paso) > 0) campo.stepUp(); else campo.stepDown();
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });

    cont.addEventListener("input", manejarCambioBinding);
    cont.addEventListener("change", manejarCambioBinding);

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
    if (tipo === "ataque") p.ataques.push({ id: fichasNuevoId(), nombre: "Nuevo ataque", atributo: "fue", competente: true, ajusteAtaque: 0, dano: "1d6", sumaModDano: true, danoExtra: "", tipoDano: "", alcance: "", municionActual: null, municionMax: null, propiedades: "", notas: "" });
    if (tipo === "rasgo") p.rasgos.push({ id: fichasNuevoId(), nombre: "Nuevo rasgo", descripcion: "", usosActuales: null, usosMax: null, tipoAccion: "accion", recuperacion: "manual", formulaRoll20: "" });
    if (tipo === "hechizo") {
      const nuevoHechizo = { id: fichasNuevoId(), disponible: true, nombre: "Nuevo conjuro", nivel: 0, escuela: "", tiempo: "", alcance: "", duracion: "", componentes: "", concentracion: false, ritual: false, tipo: "ninguno", dano: "", tipoDano: "", descripcion: "", notas: "" };
      p.hechizos.unshift(nuevoHechizo);
      hechizoParaAbrir = nuevoHechizo.id;
      filtroHechizos.texto = "";
      filtroHechizos.soloDisponibles = false;
    }
    if (tipo === "espacio") p.lanzamiento.espacios.push({ nivel: p.lanzamiento.espacios.length + 1, max: 1, usados: 0 });
    if (tipo === "objeto") p.inventario.objetos.push({ id: fichasNuevoId(), nombre: "Nuevo objeto", cantidad: 1, peso: null, estado: "guardado", descripcion: "", notas: "", cargasActuales: null, cargasMax: null, valor: null });
    if (tipo === "macro") p.macros.push({ id: fichasNuevoId(), nombre: "Nueva macro", formula: "1d20", modificadorFijo: 0, narrativa: "", tipoDano: "", modoTirada: "normal", notas: "", favorita: false });

    programarAutoguardado();
    // Hay que leer la pestaña activa ANTES de renderTabs(): esa función
    // resetea todo a "resumen" por defecto, así que leerla después
    // siempre devolvía "resumen" pasara lo que pasara.
    const activo = document.querySelector(".fichas-tab.active")?.dataset.tab || "resumen";
    renderTabs();
    activarTab(activo);
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
    activarTab(activo);
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
      else if (tipo === "dano") texto = fichasComandoDano(a.nombre, fichasDanoAtaque(p, a), a.tipoDano);
      else texto = fichasComandoAtaqueYDano(p.identidad.nombre, a.nombre, fichasAtaqueTotal(p, a), fichasDanoAtaque(p, a), a.tipoDano, { modo });
    } else if (tipo === "hechizo") {
      const h = p.hechizos.find(x => x.id === id);
      if (h.tipo === "ataque") texto = fichasComandoHechizoAtaque(h.nombre, fichasLanzamientoAtaque(p), fichasResolverFormula(p, h.dano), h.tipoDano);
      else if (h.tipo === "salvacion") texto = fichasComandoHechizoSalvacion(h.nombre, NOMBRES_ATRIBUTOS[p.lanzamiento.atributo], fichasLanzamientoCD(p), fichasResolverFormula(p, h.dano), h.tipoDano);
      else if (h.dano) texto = fichasComandoHechizoCuracion(h.nombre, fichasResolverFormula(p, h.dano));
      else texto = h.nombre;
    } else if (tipo === "rasgo") {
      const r = p.rasgos.find(x => x.id === id);
      texto = fichasComandoRasgo(r.nombre, fichasResolverFormula(p, r.formulaRoll20));
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
      : `${fichasResolverFormula(personajeActual, m.formula)}${m.modificadorFijo ? fichasSigno(m.modificadorFijo) : ""}`;
    partes.push(`${m.nombre}: [[${formula}]]${m.tipoDano ? ` ${m.tipoDano}` : ""}`);
    return partes.join("\n");
  }

  /* ==========================================================================
     PANEL ROLL20: lista unificada + búsqueda/filtro + favoritos
  ========================================================================== */
  function listaCompletaRoll20(p = personajeActual) {
    const items = [];

    Object.entries(NOMBRES_ATRIBUTOS).forEach(([id, nombre]) => {
      items.push({ id: `salv:${id}`, categoria: "Salvaciones", texto: `Salvación de ${nombre}: ${fichasSigno(fichasSalvacionTotal(p, id))}`, tipo: "salvacion", refId: id });
    });
    FICHAS_HABILIDADES.forEach(h => {
      items.push({ id: `hab:${h.id}`, categoria: "Habilidades", texto: `${h.nombre}: ${fichasSigno(fichasHabilidadTotal(p, h.id))}`, tipo: "habilidad", refId: h.id });
    });
    items.push({ id: "iniciativa", categoria: "Combate", texto: `Iniciativa: ${fichasSigno(fichasIniciativaTotal(p))}`, tipo: "iniciativa", refId: null });
    p.ataques.forEach(a => {
      items.push({ id: `ataquedano:${a.id}`, categoria: "Ataques", texto: `${a.nombre}: ataque ${fichasSigno(fichasAtaqueTotal(p, a))}, daño ${fichasDanoAtaque(p, a) || "—"}`, tipo: "ataquedano", refId: a.id });
    });
    p.hechizos.filter(h => h.disponible !== false).forEach(h => {
      items.push({ id: `hechizo:${h.id}`, categoria: "Conjuros", texto: `${h.nombre} (nv. ${h.nivel})`, tipo: "hechizo", refId: h.id });
    });
    p.rasgos.filter(r => r.formulaRoll20).forEach(r => {
      items.push({ id: `rasgo:${r.id}`, categoria: "Rasgos", texto: r.nombre, tipo: "rasgo", refId: r.id });
    });
    p.macros.forEach(m => {
      items.push({ id: `macro:${m.id}`, categoria: "Macros", texto: m.nombre, tipo: "macro", refId: m.id });
    });
    return items;
  }

  /* El mismo texto que arman los botones "Copiar", pero para cualquier personaje
     y modo (normal / ventaja / desventaja). Devuelve null si ese item no tiene
     variantes de modo. */
  function comandoDeItemRoll20(p, item, modo) {
    const opts = { modo };
    switch (item.tipo) {
      case "salvacion": return fichasComandoPrueba(`Salvación de ${NOMBRES_ATRIBUTOS[item.refId]}`, fichasSalvacionTotal(p, item.refId), opts);
      case "habilidad": return fichasComandoPrueba(FICHAS_HABILIDADES.find(h => h.id === item.refId).nombre, fichasHabilidadTotal(p, item.refId), opts);
      case "iniciativa": return fichasComandoIniciativa(fichasIniciativaTotal(p), opts);
      case "ataquedano": {
        const a = p.ataques.find(x => x.id === item.refId);
        return fichasComandoAtaqueYDano(p.identidad.nombre, a.nombre, fichasAtaqueTotal(p, a), fichasDanoAtaque(p, a), a.tipoDano, opts);
      }
      case "hechizo": {
        const h = p.hechizos.find(x => x.id === item.refId);
        if (h.tipo === "ataque") return fichasComandoHechizoAtaque(h.nombre, fichasLanzamientoAtaque(p), fichasResolverFormula(p, h.dano), h.tipoDano, opts);
        if (h.tipo === "salvacion") return fichasComandoHechizoSalvacion(h.nombre, NOMBRES_ATRIBUTOS[p.lanzamiento.atributo], fichasLanzamientoCD(p), fichasResolverFormula(p, h.dano), h.tipoDano);
        return h.dano ? fichasComandoHechizoCuracion(h.nombre, fichasResolverFormula(p, h.dano)) : h.nombre;
      }
      case "rasgo": {
        const r = p.rasgos.find(x => x.id === item.refId);
        return fichasComandoRasgo(r.nombre, fichasResolverFormula(p, r.formulaRoll20));
      }
      case "macro": return comandoDeMacro(p.macros.find(x => x.id === item.refId));
      default: return null;
    }
  }

  /* Texto que el panel de Roll20 muestra al pasar el mouse sobre una tirada
     (descripción del rasgo, datos del hechizo, notas del ataque...). */
  function descripcionItemRoll20(p, item) {
    const partes = [];
    if (item.tipo === "rasgo") {
      const r = p.rasgos.find(x => x.id === item.refId);
      if (r) {
        if (r.descripcion) partes.push(r.descripcion);
        if (r.usosMax) partes.push(`Usos: ${r.usosActuales ?? "?"}/${r.usosMax}`);
      }
    } else if (item.tipo === "hechizo") {
      const h = p.hechizos.find(x => x.id === item.refId);
      if (h) {
        const datos = [h.escuela, h.tiempo, h.alcance, h.duracion, h.componentes].filter(Boolean).join(" · ");
        if (datos) partes.push(datos);
        if (h.descripcion) partes.push(h.descripcion);
      }
    } else if (item.tipo === "ataquedano") {
      const a = p.ataques.find(x => x.id === item.refId);
      if (a) {
        const datos = [a.alcance, a.propiedades].filter(Boolean).join(" · ");
        if (datos) partes.push(datos);
        if (a.notas) partes.push(a.notas);
      }
    } else if (item.tipo === "macro") {
      const m = p.macros.find(x => x.id === item.refId);
      if (m) {
        if (m.narrativa) partes.push(m.narrativa);
        if (m.notas) partes.push(m.notas);
      }
    }
    const texto = partes.join("\n").trim();
    return texto.length > 700 ? texto.slice(0, 700) + "…" : texto;
  }

  function payloadRoll20DePersonaje(p) {
    const items = listaCompletaRoll20(p).map(i => {
      const cmd = {
        normal: comandoDeItemRoll20(p, i, "normal"),
        ventaja: comandoDeItemRoll20(p, i, "ventaja"),
        desventaja: comandoDeItemRoll20(p, i, "desventaja")
      };
      const desc = descripcionItemRoll20(p, i);
      return { id: i.id, categoria: i.categoria, texto: i.texto, favorita: p.favoritosRoll20.includes(i.id), cmd, ...(desc ? { desc } : {}) };
    });
    items.sort((a, b) => Number(b.favorita) - Number(a.favorita));
    return { id: p.id, nombre: p.identidad.nombre || "Sin nombre", items };
  }

  /* Sube a Supabase (columna fichas_personajes.roll20) el panel de tiradas ya
     armado, para que el script de Tampermonkey (roll20/compendio-roll20.user.js)
     lo lea directo desde Roll20, desde cualquier navegador. Solo sube cuando el
     panel cambió de verdad (se compara un hash por personaje), así que casi
     ningún guardado genera una petición extra. Si la columna todavía no existe
     (scratchpad/roll20_panel.sql sin correr) se desactiva en silencio: nunca
     debe romper el guardado de una ficha. */
  let sinColumnaRoll20 = false;

  function hashTexto(texto) {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
    return String(h);
  }

  async function sincronizarRoll20(lista) {
    if (sinColumnaRoll20) return;
    for (const pj of lista) {
      try {
        const payload = payloadRoll20DePersonaje(pj);
        const hash = hashTexto(JSON.stringify(payload));
        const clave = "compendioRoll20Hash:" + pj.id;
        if (localStorage.getItem(clave) === hash) continue;
        const supabase = await fichasCliente();
        const { error } = await supabase.from("fichas_personajes").update({ roll20: payload }).eq("id", pj.id);
        if (error) {
          if (/roll20/i.test(error.message || "")) sinColumnaRoll20 = true;
          continue;
        }
        localStorage.setItem(clave, hash);
      } catch (e) { /* es un extra, nunca debe romper la ficha */ }
    }
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
      programarAutoguardado(); renderTabs(); activarTab("combate");
    }
    if (e.target.id === "fcBtnRecuperarPV") {
      const v = Number(document.getElementById("fcRecuperarPV").value) || 0;
      p.combate.pvActual = Math.min(p.combate.pvMax, p.combate.pvActual + v);
      programarAutoguardado(); renderTabs(); activarTab("combate");
    }
    if (e.target.id === "fcBtnTempPV") {
      const v = Number(document.getElementById("fcTempPV").value) || 0;
      p.combate.pvTemp = Math.max(0, p.combate.pvTemp + v);
      programarAutoguardado(); renderTabs(); activarTab("combate");
    }
    if (e.target.id === "fcBtnDescansoCorto" || e.target.id === "fcBtnDescansoLargo") {
      const tipo = e.target.id === "fcBtnDescansoCorto" ? "corto" : "largo";
      p.rasgos.forEach(r => { if (r.recuperacion === tipo && r.usosMax != null) r.usosActuales = r.usosMax; });
      if (tipo === "largo") {
        p.combate.pvActual = p.combate.pvMax;
        p.combate.dadosGolpe.actuales = p.combate.dadosGolpe.max;
        p.lanzamiento.espacios.forEach(esp => { esp.usados = 0; });
      }
      programarAutoguardado(); renderTabs(); activarTab("combate");
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
