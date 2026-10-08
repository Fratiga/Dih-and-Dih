/* Apartados de la página del editor de mapas que no tocan el editor en sí: control de acceso (Admin
   y DJ), pestañas y controles segmentados, subida de canciones a la rocola, buzón de problemas o
   sugerencias y minitutoriales. Se carga después de parranda-editor.js. */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const avisar = (texto, error) => { if (window.ParrandaEditor) window.ParrandaEditor.mensaje(texto, error); };

  /* --- Controles segmentados: la dificultad, la velocidad y el ajuste son selects ocultos --- */
  document.querySelectorAll(".re-segmentos").forEach(cont => {
    const sel = $(cont.dataset.para);
    if (!sel) return;
    const pintar = () => {
      cont.innerHTML = [...sel.options].map(o => `<button type="button" class="re-seg ${o.value === sel.value ? "activa" : ""}" data-v="${o.value}">${o.textContent}</button>`).join("");
    };
    pintar();
    cont.addEventListener("click", ev => {
      const b = ev.target.closest("[data-v]");
      if (!b || sel.value === b.dataset.v) return;
      sel.value = b.dataset.v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      pintar();
    });
    sel.addEventListener("change", pintar);
  });

  /* --- Pestañas de herramientas --- */
  const tabs = document.querySelectorAll(".re-tab");
  const paneles = document.querySelectorAll(".re-panel-tool");
  function abrirTab(id) {
    tabs.forEach(t => t.classList.toggle("activa", t.dataset.tab === id));
    paneles.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== id));
    if (id === "dificultades" && typeof refrescarOrigenes === "function") refrescarOrigenes();
    if (id === "patrones" && typeof pintarPatrones === "function") pintarPatrones();
    if (id === "fondo" && window.FondosEditor) window.FondosEditor.refrescar();
  }
  tabs.forEach(t => t.addEventListener("click", () => abrirTab(t.dataset.tab)));
  window.addEventListener("parranda-abrir-tab", ev => {
    abrirTab(ev.detail);
    if (ev.detail === "revisar") revisarMapa();
  });

  /* --- Acceso: solo Admin y DJ ----------------------------------------------------------
     Esto decide qué se ve. Quien manda es el servidor: sin el rol, guardar mapas o subir canciones
     falla igual (ver scratchpad/ritmo_dj.sql). */
  let djIniciado = false;
  async function acceso() {
    const aviso = $("reAcceso");
    const txt = $("reAccesoTxt");
    const todo = $("reTodo");
    const abrir = () => { aviso.classList.add("hidden"); todo.classList.remove("hidden"); };
    if (window.RitmoRol && RitmoRol.cacheado()) abrir();
    const r = window.RitmoRol ? await RitmoRol.verificar() : { puede: false, sesion: false };
    if (r.puede) {
      abrir();
      $("reAdminLink").classList.toggle("hidden", !r.admin);
      if (!djIniciado) { djIniciado = true; iniciarPresencia(); refrescarGuias(); iniciarPatrones(); }
      return;
    }
    todo.classList.add("hidden");
    aviso.classList.remove("hidden");
    txt.innerHTML = r.error
      ? "No se pudo comprobar el acceso. Revisa tu conexión y recarga la página."
      : r.sesion
        ? "Esta cuenta no tiene acceso al editor. Pídele a un admin el rol <strong>DJ</strong>."
        : "Inicia sesión (arriba a la derecha) con una cuenta <strong>DJ</strong> o Admin para usar el editor.";
  }

  function escHtml(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --- Problemas o sugerencias: llegan a la pestaña Peticiones del panel de Admin --- */
  {
    const form = $("reBuzonForm");
    const texto = $("reBuzonTexto");
    const nombre = $("reBuzonNombre");
    const estado = $("reBuzonEstado");
    const boton = $("reBuzonEnviar");
    try { nombre.value = localStorage.getItem("compendioRitmoFirma") || ""; } catch (e) { /* sin almacenamiento */ }
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const t = texto.value.trim();
      if (!t) return;
      boton.disabled = true;
      estado.classList.remove("error");
      estado.textContent = "Enviando...";
      try {
        await enviarPeticion({ texto: "[Editor de Parranda] " + t, nombre: nombre.value.trim() });
        texto.value = "";
        estado.textContent = "Enviado. Gracias.";
      } catch (err) {
        estado.classList.add("error");
        estado.textContent = "No se pudo enviar. Prueba de nuevo en un rato.";
      } finally {
        boton.disabled = false;
      }
    });
  }

  /* --- Minitutoriales: lecciones de pasos cortos que resaltan lo que explican --- */
  {
    const lecciones = window.PARRANDA_TUTORIALES || [];
    const raiz = $("reTuto");
    const lista = $("reTutoLista");
    const leccionEl = $("reTutoLeccion");
    const tituloEl = $("reTutoTitulo");
    const pasoEl = $("reTutoPaso");
    const puntosEl = $("reTutoPuntos");
    const atras = $("reTutoAtras");
    const siguiente = $("reTutoSiguiente");
    let actual = null;
    let paso = 0;

    const quitarResalte = () => document.querySelectorAll(".re-resalte").forEach(e => e.classList.remove("re-resalte"));

    function cerrar() {
      quitarResalte();
      raiz.classList.add("hidden");
    }

    function verLista() {
      quitarResalte();
      actual = null;
      leccionEl.classList.add("hidden");
      lista.classList.remove("hidden");
      lista.innerHTML = `<p class="re-tuto-titulo" style="grid-column: 1 / -1; margin: 0">Elige una lección</p>` +
        lecciones.map((l, i) => `<button type="button" class="re-tuto-tarjeta" data-i="${i}"><strong>${escHtml(l.titulo)}</strong><small>${escHtml(l.resumen)} · ${l.pasos.length} pasos</small></button>`).join("");
    }

    function verPaso() {
      quitarResalte();
      const p = actual.pasos[paso];
      tituloEl.textContent = `${actual.titulo} · paso ${paso + 1} de ${actual.pasos.length}`;
      pasoEl.textContent = p.texto;
      puntosEl.innerHTML = actual.pasos.map((_, i) => `<i class="${i === paso ? "activo" : ""}"></i>`).join("");
      atras.disabled = paso === 0;
      siguiente.textContent = paso === actual.pasos.length - 1 ? "Terminar" : "Siguiente";
      if (p.tab) abrirTab(p.tab);
      if (p.abrir) { const d = document.querySelector(p.abrir); if (d && d.tagName === "DETAILS") d.open = true; }
      const objetivos = Array.isArray(p.objetivo) ? p.objetivo : p.objetivo ? [p.objetivo] : [];
      let primero = null;
      objetivos.forEach(sel => document.querySelectorAll(sel).forEach(el => { el.classList.add("re-resalte"); if (!primero) primero = el; }));
      if (primero) primero.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    function abrirLeccion(i) {
      actual = lecciones[i];
      paso = 0;
      lista.classList.add("hidden");
      leccionEl.classList.remove("hidden");
      verPaso();
    }

    $("reTutoBtn").addEventListener("click", () => {
      if (!raiz.classList.contains("hidden")) { cerrar(); return; }
      raiz.classList.remove("hidden");
      verLista();
    });
    $("reTutoCerrar").addEventListener("click", cerrar);
    $("reTutoVolver").addEventListener("click", verLista);
    lista.addEventListener("click", ev => { const b = ev.target.closest("[data-i]"); if (b) abrirLeccion(Number(b.dataset.i)); });
    atras.addEventListener("click", () => { if (paso > 0) { paso--; verPaso(); } });
    siguiente.addEventListener("click", () => {
      if (paso < actual.pasos.length - 1) { paso++; verPaso(); } else cerrar();
    });
  }

  /* --- Revisar el mapa ------------------------------------------------------------------------------------ */
  function revisarMapa() {
    const ed = window.ParrandaEditor && window.ParrandaEditor.obtener();
    const cont = $("reRevisarStats");
    const lista = $("reRevisarLista");
    if (!ed || !ed.buffer || !ed.notas.length) {
      cont.innerHTML = "";
      lista.innerHTML = `<li class="re-vacio">Carga primero un mapa.</li>`;
      return;
    }
    const r = ParrandaLogica.revisar(ed.notas, ed.pulsos, ed.buffer.duration, ed.dificultad);
    const st = r.stats;
    cont.innerHTML = [
      ["Nivel", st.nivel], ["Notas", st.total], ["Golpes por segundo", st.npsMedio], ["Pico", st.picoNps + " /s"], ["Acordes", st.acordes], ["Largas", st.largas],
      ["Carril 1", st.carriles[0]], ["Carril 2", st.carriles[1]], ["Carril 3", st.carriles[2]], ["Carril 4", st.carriles[3]], ["Racha máx.", st.rachaMax], ["Hueco máx.", st.huecoMax + " s"]
    ].map(([k, v]) => `<span>${k} <strong>${v}</strong></span>`).join("");
    const nombres = { error: "Error", aviso: "Aviso", info: "Nota" };
    lista.innerHTML = r.problemas.length
      ? r.problemas.map(p => `<li class="nivel-${p.nivel}"><span><b class="re-nivel">${nombres[p.nivel]}</b>${escHtml(p.texto)}</span>${p.t > 0 || p.nivel !== "info" ? `<button type="button" class="re-btn re-btn-chico" data-ir="${p.t}">Ir</button>` : ""}</li>`).join("")
      : `<li class="nivel-info"><span><b class="re-nivel">Todo bien</b>No se encontró ningún problema.</span></li>`;
    const errores = r.problemas.filter(p => p.nivel === "error").length;
    avisar(errores ? `${errores} error${errores === 1 ? "" : "es"} en el mapa.` : "Revisión lista.", !!errores);
  }
  $("reRevisar").addEventListener("click", revisarMapa);
  $("reCorregir").addEventListener("click", () => {
    if (!window.ParrandaEditor) return;
    window.ParrandaEditor.limpiarNotas();
    const quitadas = window.ParrandaEditor.quitarEncimadas();
    window.ParrandaEditor.repintar();
    revisarMapa();
    avisar(`Largas y notas repetidas corregidas${quitadas ? `, y ${quitadas} nota${quitadas === 1 ? "" : "s"} encimada${quitadas === 1 ? "" : "s"} quitada${quitadas === 1 ? "" : "s"}` : ""}.`);
  });
  $("reRevisarLista").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ir]");
    if (b && window.ParrandaEditor) window.ParrandaEditor.ir(Math.max(0, Number(b.dataset.ir) - 1));
  });

  /* --- Derivar una dificultad desde otra ------------------------------------------------------------------ */
  /* --- Traer un mapa del otro juego ------------------------------------------------------------------------- */
  async function refrescarOtro() {
    const sel = $("reOtroOrigen");
    const ed = window.ParrandaEditor && window.ParrandaEditor.obtener();
    if (!ed || !sel) return;
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("ritmo_mapas").select("dificultad, mapa").eq("cancion", ed.ruta);
      if (error) throw error;
      const lista = (data || []).slice().sort((a, b) => ParrandaLogica.ORDEN.indexOf(a.dificultad) - ParrandaLogica.ORDEN.indexOf(b.dificultad));
      sel.innerHTML = lista.length
        ? lista.map(f => `<option value="${f.dificultad}">${ParrandaLogica.NOMBRE[f.dificultad]} (${f.mapa.notas.length} notas${f.mapa.firma ? `, de ${escHtml(f.mapa.firma)}` : ""})</option>`).join("")
        : `<option value="">No hay un mapa de Zarabanda de esta canción</option>`;
    } catch (err) {
      sel.innerHTML = `<option value="">No se pudo cargar la lista</option>`;
    }
  }

  $("reOtroTraer").addEventListener("click", async () => {
    const estado = $("reOtroEstado");
    const origen = $("reOtroOrigen").value;
    const ed = window.ParrandaEditor.obtener();
    if (!origen) { estado.textContent = "Elige de qué mapa partir."; estado.classList.add("error"); return; }
    estado.classList.remove("error");
    estado.textContent = "Pasando el mapa...";
    try {
      await window.ParrandaEditor.cargarAudio();
      const sb = await fichasCliente();
      const { data, error } = await sb.from("ritmo_mapas").select("mapa").eq("cancion", ed.ruta).eq("dificultad", origen).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ese mapa ya no existe.");
      const notasO = data.mapa.notas.map(x => ({ t: x[0], carril: ["abajo", "arriba", "ambos"][x[1]] || "abajo", dur: x[2] || 0 }));
      await window.ParrandaEditor.cargarAudio();
      const nuevas = ParrandaLogica.desdeZarabanda(notasO, window.ParrandaEditor.obtener().buffer, ed.dificultad);
      window.ParrandaEditor.aplicarNotasExternas(nuevas, data.mapa.pulsos);
      window.ParrandaEditor.fijarEsperado(null);
      const texto = `Zarabanda ${ParrandaLogica.NOMBRE[origen]} (${notasO.length} notas) → ${nuevas.length} notas. Es un borrador: revísalo y retócalo antes de guardar.`;
      estado.textContent = texto;
      avisar(texto);
    } catch (err) {
      estado.classList.add("error");
      estado.textContent = "No se pudo pasar el mapa: " + (err && err.message || err);
    }
  });

  async function refrescarOrigenes() {
    refrescarOtro();
    const sel = $("reDerivarOrigen");
    const ed = window.ParrandaEditor && window.ParrandaEditor.obtener();
    if (!ed) return;
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("parranda_mapas").select("dificultad, mapa").eq("cancion", ed.ruta);
      if (error) throw error;
      const otros = (data || []).filter(f => f.dificultad !== ed.dificultad)
        .sort((a, b) => ParrandaLogica.ORDEN.indexOf(a.dificultad) - ParrandaLogica.ORDEN.indexOf(b.dificultad));
      sel.innerHTML = otros.length
        ? otros.map(f => `<option value="${f.dificultad}">${ParrandaLogica.NOMBRE[f.dificultad]} (${f.mapa.notas.length} notas${f.mapa.firma ? `, de ${escHtml(f.mapa.firma)}` : ""})</option>`).join("")
        : `<option value="">No hay otro mapa guardado de esta canción</option>`;
    } catch (err) {
      sel.innerHTML = `<option value="">No se pudo cargar la lista</option>`;
    }
  }

  $("reDerivarRefrescar").addEventListener("click", refrescarOrigenes);
  [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => { if (!document.querySelector('[data-panel="dificultades"]').classList.contains("hidden")) refrescarOrigenes(); }));
  window.addEventListener("parranda-guardado", refrescarOrigenes);

  $("reDerivar").addEventListener("click", async () => {
    const estado = $("reDerivarEstado");
    const origen = $("reDerivarOrigen").value;
    const ed = window.ParrandaEditor.obtener();
    if (!origen) { estado.textContent = "Elige de qué mapa partir."; estado.classList.add("error"); return; }
    estado.classList.remove("error");
    estado.textContent = "Derivando...";
    try {
      await window.ParrandaEditor.cargarAudio();
      const sb = await fichasCliente();
      const { data, error } = await sb.from("parranda_mapas").select("mapa").eq("cancion", ed.ruta).eq("dificultad", origen).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ese mapa ya no existe.");
      const base = window.ParrandaEditor.obtener();
      const notasO = data.mapa.notas.map(x => ({ t: x[0], carril: Math.max(0, Math.min(3, x[1] | 0)), dur: x[2] || 0 }));
      const nuevas = ParrandaLogica.derivar(notasO, data.mapa.pulsos, base.buffer, origen, ed.dificultad);
      window.ParrandaEditor.aplicarNotasExternas(nuevas, data.mapa.pulsos);
      window.ParrandaEditor.fijarEsperado(null);
      const texto = `${ParrandaLogica.NOMBRE[origen]} (${notasO.length} notas) → ${ParrandaLogica.NOMBRE[ed.dificultad]} (${nuevas.length} notas). Revísalo y retócalo antes de guardar.`;
      estado.textContent = texto;
      avisar(texto);
    } catch (err) {
      estado.classList.add("error");
      estado.textContent = "No se pudo derivar: " + (err && err.message || err);
    }
  });

  /* --- Historial y registro de cambios ------------------------------------------------------------------------ */
  {
    const versiones = $("reVersiones");
    const registro = $("reRegistro");
    const cuando = iso => new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const nombreDif = d => ParrandaLogica.NOMBRE[d] || d;

    async function cargarHistorial() {
      const ed = window.ParrandaEditor && window.ParrandaEditor.obtener();
      if (!ed) return;
      try {
        const sb = await fichasCliente();
        const { data, error } = await sb.from("parranda_mapas_historial").select("id, cancion, dificultad, accion, notas, firma, autor_nombre, creada").order("creada", { ascending: false }).limit(120);
        if (error) throw error;
        const detalle = f => (f.accion === "borrado" ? "borró el mapa" : `guardó ${f.notas} notas`) + (f.firma ? ` · firma ${escHtml(f.firma)}` : "");
        const propias = data.filter(f => f.cancion === ed.ruta && f.dificultad === ed.dificultad).slice(0, 40);
        versiones.innerHTML = propias.length
          ? propias.map(f => `<li><span>${cuando(f.creada)} · <strong>${escHtml(f.autor_nombre || "alguien")}</strong> ${detalle(f)}</span>${f.accion === "guardado" ? `<button type="button" class="re-btn re-btn-chico" data-version="${f.id}">Cargar</button>` : ""}</li>`).join("")
          : `<li class="re-vacio">Todavía no hay versiones guardadas de esta canción y dificultad.</li>`;
        registro.innerHTML = data.slice(0, 40).map(f => `<li><span>${cuando(f.creada)} · <strong>${escHtml(f.autor_nombre || "alguien")}</strong> ${detalle(f)} <small>· ${escHtml(window.ParrandaEditor.cancionPorRuta(f.cancion))} · ${nombreDif(f.dificultad)}</small></span></li>`).join("") || `<li class="re-vacio">Nadie ha guardado mapas todavía.</li>`;
      } catch (err) {
        const falta = /relation|does not exist|schema cache/i.test(String(err && err.message));
        versiones.innerHTML = `<li class="re-vacio">${falta ? "Falta correr scratchpad/parranda.sql en Supabase." : "No se pudo cargar el historial."}</li>`;
        registro.innerHTML = "";
      }
    }

    $("reHistorial").addEventListener("toggle", ev => { if (ev.target.open) cargarHistorial(); });
    $("reHistorialRefrescar").addEventListener("click", cargarHistorial);
    window.addEventListener("parranda-guardado", () => { if ($("reHistorial").open) cargarHistorial(); });
    [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => { if ($("reHistorial").open) cargarHistorial(); }));

    versiones.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-version]");
      if (!b) return;
      if (window.ParrandaEditor.hayCambios() && !(await dialogo.confirmar("Hay cambios sin guardar en el editor. ¿Reemplazarlos con esa versión?", { titulo: "Cargar versión", aceptar: "Reemplazar", peligro: true }))) return;
      b.disabled = true;
      try {
        const sb = await fichasCliente();
        const ed = window.ParrandaEditor.obtener();
        const { data, error } = await sb.from("parranda_mapas_historial").select("mapa").eq("id", b.dataset.version).single();
        if (error) throw error;
        // Para no recibir un aviso de conflicto contigo mismo, se toma la fecha del mapa guardado ahora
        const { data: actual } = await sb.from("parranda_mapas").select("actualizado").eq("cancion", ed.ruta).eq("dificultad", ed.dificultad).maybeSingle();
        await window.ParrandaEditor.cargarAudio();
        window.ParrandaEditor.aplicarGuardableExterno(data.mapa, actual ? actual.actualizado : null);
        avisar("Versión cargada en el editor. Guarda si quieres que sea la actual.");
      } catch (err) {
        avisar("No se pudo cargar esa versión: " + (err && err.message || err), true);
      } finally {
        b.disabled = false;
      }
    });
  }

  /* --- Marcas en la línea de tiempo ---------------------------------------------------------------------------- */
  {
    const lista = $("reMarcasLista");
    const tiempoTxt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    function pintarMarcas() {
      const m = window.ParrandaEditor ? window.ParrandaEditor.obtenerMarcas() : [];
      lista.innerHTML = m.length
        ? m.map((x, i) => `<li><span><b class="re-nivel" style="color: ${x.tipo === "seccion" ? "#f2d46b" : "#7ae8ff"}">${x.tipo === "seccion" ? "Sección" : "Comentario"}</b>${tiempoTxt(x.t)} · ${escHtml(x.texto || "(sin texto)")}${x.autor ? ` <small>· ${escHtml(x.autor)}</small>` : ""}</span><span class="re-lista-acciones"><button type="button" class="re-btn re-btn-chico" data-ir="${x.t}">Ir</button><button type="button" class="re-btn re-btn-chico" data-editar-marca="${i}">Editar</button><button type="button" class="re-btn re-btn-chico re-btn-peligro" data-quitar-marca="${i}">Quitar</button></span></li>`).join("")
        : `<li class="re-vacio">Todavía no hay marcas.</li>`;
    }
    window.addEventListener("parranda-marcas", pintarMarcas);
    $("reMarcaAgregar").addEventListener("click", () => {
      window.ParrandaEditor.agregarMarca($("reMarcaTipo").value, $("reMarcaTexto").value);
      $("reMarcaTexto").value = "";
    });
    $("reMarcaTexto").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); $("reMarcaAgregar").click(); } });
    lista.addEventListener("click", async ev => {
      const ir = ev.target.closest("[data-ir]");
      if (ir) { window.ParrandaEditor.ir(Math.max(0, Number(ir.dataset.ir) - 0.5)); return; }
      const ed = ev.target.closest("[data-editar-marca]");
      if (ed) {
        const i = Number(ed.dataset.editarMarca);
        const actual = window.ParrandaEditor.obtenerMarcas()[i];
        const nuevo = await dialogo.pedir("Texto de la marca:", actual ? actual.texto : "", { titulo: "Editar marca" });
        if (nuevo !== null) window.ParrandaEditor.editarMarca(i, nuevo);
        return;
      }
      const q = ev.target.closest("[data-quitar-marca]");
      if (q) window.ParrandaEditor.quitarMarca(Number(q.dataset.quitarMarca));
    });
    pintarMarcas();
  }

  /* --- Patrones: guardados con nombre y compartidos entre los DJ ---------------------------------------------- */
  const CLAVE_PATRONES_LOCAL = "parrandaPatronesLocal";
  let patrones = [];
  let patronesRemotos = true;

  function iniciarPatrones() { cargarPatrones(); }

  async function cargarPatrones() {
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("parranda_patrones").select("id, nombre, patron, autor_nombre, creada").order("creada", { ascending: false });
      if (error) throw error;
      patrones = data || [];
      patronesRemotos = true;
    } catch (err) {
      // Si todavía no se corrió ritmo_editor_3.sql, quedan guardados solo en este navegador
      patronesRemotos = false;
      try { patrones = JSON.parse(localStorage.getItem(CLAVE_PATRONES_LOCAL) || "[]"); } catch (e) { patrones = []; }
    }
    pintarPatrones();
  }

  function pintarPatrones() {
    const lista = $("rePatronesLista");
    if (!lista) return;
    lista.innerHTML = patrones.length
      ? patrones.map(p => `<li><span>${escHtml(p.nombre)} <small>· ${p.patron.notas.length} notas · ${Math.max(1, Math.round(p.patron.pulsos))} pulsos${p.autor_nombre ? ` · ${escHtml(p.autor_nombre)}` : ""}</small></span><span class="re-lista-acciones"><button type="button" class="re-btn re-btn-chico" data-pegar-patron="${escHtml(String(p.id))}">Pegar en el cursor</button><button type="button" class="re-btn re-btn-chico re-btn-peligro" data-borrar-patron="${escHtml(String(p.id))}">Quitar</button></span></li>`).join("")
      : `<li class="re-vacio">Todavía no hay patrones guardados.</li>`;
    const est = $("rePatronEstado");
    if (est && !patronesRemotos) est.textContent = "Se guardan solo en este navegador. Para compartirlos hace falta correr scratchpad/parranda.sql.";
  }

  $("rePatronGuardar").addEventListener("click", async () => {
    const est = $("rePatronEstado");
    const nombre = $("rePatronNombre").value.trim();
    const patron = window.ParrandaEditor.patronDeSeleccion();
    est.classList.add("error");
    if (!patron) { est.textContent = "Elige primero algunas notas en la línea de tiempo."; return; }
    if (!nombre) { est.textContent = "Ponle un nombre al patrón."; return; }
    est.classList.remove("error");
    const quien = typeof nombreUsuario === "function" ? nombreUsuario() : "";
    try {
      if (patronesRemotos) {
        const sb = await fichasCliente();
        const { error } = await sb.from("parranda_patrones").insert({ nombre, patron, autor_nombre: quien || "" });
        if (error) throw error;
      } else {
        patrones.unshift({ id: "l" + Date.now(), nombre, patron, autor_nombre: quien || "" });
        localStorage.setItem(CLAVE_PATRONES_LOCAL, JSON.stringify(patrones.slice(0, 60)));
      }
      $("rePatronNombre").value = "";
      est.textContent = "Patrón guardado.";
      await cargarPatrones();
    } catch (err) {
      est.classList.add("error");
      est.textContent = "No se pudo guardar el patrón: " + (err && err.message || err);
    }
  });

  $("rePatronesLista").addEventListener("click", async ev => {
    const pegar = ev.target.closest("[data-pegar-patron]");
    if (pegar) {
      const p = patrones.find(x => String(x.id) === pegar.dataset.pegarPatron);
      if (p) window.ParrandaEditor.pegarPatron(p.patron);
      return;
    }
    const borrar = ev.target.closest("[data-borrar-patron]");
    if (!borrar) return;
    const p = patrones.find(x => String(x.id) === borrar.dataset.borrarPatron);
    if (!p || !(await dialogo.confirmar(`¿Quitar el patrón "${p.nombre}"?`, { titulo: "Quitar patrón", aceptar: "Quitar", peligro: true }))) return;
    try {
      if (patronesRemotos) {
        const sb = await fichasCliente();
        const { error } = await sb.from("parranda_patrones").delete().eq("id", p.id);
        if (error) throw error;
      } else {
        patrones = patrones.filter(x => x !== p);
        localStorage.setItem(CLAVE_PATRONES_LOCAL, JSON.stringify(patrones));
      }
      await cargarPatrones();
    } catch (err) {
      avisar("No se pudo quitar: " + (err && err.message || err), true);
    }
  });

  /* --- Quién más está editando esta canción ------------------------------------------------------------------------ */
  let canalPresencia = null;
  async function iniciarPresencia() {
    try {
      const sesion = await fichasSesionActual();
      if (!sesion) return;
      const sb = await fichasCliente();
      const yo = sesion.user.id;
      const nombre = (typeof nombreUsuario === "function" && nombreUsuario()) || "Alguien";
      const aviso = $("reOtros");
      const estado = () => {
        const ed = window.ParrandaEditor.obtener();
        return { nombre, cancion: ed.ruta, dificultad: ed.dificultad };
      };
      const mirar = () => {
        const ed = window.ParrandaEditor.obtener();
        const otros = [];
        const todos = canalPresencia.presenceState();
        Object.keys(todos).forEach(id => {
          if (id === yo) return;
          const m = todos[id][todos[id].length - 1];
          if (m && m.cancion === ed.ruta && m.dificultad === ed.dificultad) otros.push(m.nombre || "alguien");
        });
        aviso.classList.toggle("hidden", !otros.length);
        aviso.textContent = otros.length ? `${otros.join(" y ")} también ${otros.length === 1 ? "está" : "están"} editando esta canción y dificultad ahora mismo. Si guardáis a la vez, el último pisa al otro (queda en el historial).` : "";
      };
      canalPresencia = sb.channel("parranda-editores", { config: { presence: { key: yo } } });
      canalPresencia.on("presence", { event: "sync" }, mirar).subscribe(async st => {
        if (st === "SUBSCRIBED") await canalPresencia.track(estado());
      });
      const cambio = async () => { try { await canalPresencia.track(estado()); mirar(); } catch (e) { /* sin presencia */ } };
      [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => setTimeout(cambio, 50)));
    } catch (e) { /* sin presencia: el aviso de conflicto al guardar sigue funcionando */ }
  }

  /* --- Guía de otra dificultad ------------------------------------------------------------------------------------------ */
  async function refrescarGuias() {
    const sel = $("reSuperponer");
    const ed = window.ParrandaEditor && window.ParrandaEditor.obtener();
    if (!ed) return;
    const actual = sel.value;
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("parranda_mapas").select("dificultad").eq("cancion", ed.ruta);
      if (error) throw error;
      const otros = (data || []).filter(f => f.dificultad !== ed.dificultad).sort((a, b) => ParrandaLogica.ORDEN.indexOf(a.dificultad) - ParrandaLogica.ORDEN.indexOf(b.dificultad));
      sel.innerHTML = `<option value="">Ninguna</option>` + otros.map(f => `<option value="${f.dificultad}">${ParrandaLogica.NOMBRE[f.dificultad]}</option>`).join("");
      sel.value = otros.some(f => f.dificultad === actual) ? actual : "";
    } catch (e) {
      sel.innerHTML = `<option value="">Ninguna</option>`;
    }
    if (!sel.value) window.ParrandaEditor.fijarSuperpuesto(null);
  }

  $("reSuperponer").addEventListener("change", async ev => {
    const dif = ev.target.value;
    const ed = window.ParrandaEditor.obtener();
    if (!dif) { window.ParrandaEditor.fijarSuperpuesto(null); return; }
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("parranda_mapas").select("mapa").eq("cancion", ed.ruta).eq("dificultad", dif).maybeSingle();
      if (error) throw error;
      const desfase = data ? (Number(data.mapa.offset) || 0) / 1000 : 0;
      window.ParrandaEditor.fijarSuperpuesto(data ? data.mapa.notas.map(x => ({ t: x[0] + desfase, carril: Math.max(0, Math.min(3, x[1] | 0)) })) : null);
    } catch (err) {
      avisar("No se pudo cargar esa guía.", true);
    }
  });
  [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => { window.ParrandaEditor.fijarSuperpuesto(null); $("reSuperponer").value = ""; refrescarGuias(); window.ParrandaEditor.fijarFallos(null); }));
  window.addEventListener("parranda-guardado", refrescarGuias);

  /* --- Dónde fallan los jugadores ------------------------------------------------------------------------------------------ */
  $("reVerFallosBtn").addEventListener("click", async () => {
    const lista = $("reFallosLista");
    const ed = window.ParrandaEditor.obtener();
    if (!ed.buffer) { lista.innerHTML = `<li class="re-vacio">Carga primero un mapa.</li>`; return; }
    lista.innerHTML = `<li class="re-vacio">Cargando...</li>`;
    try {
      const sb = await fichasCliente();
      const { data: act } = await sb.from("parranda_mapas").select("actualizado").eq("cancion", ed.ruta).eq("dificultad", ed.dificultad).maybeSingle();
      const version = act ? act.actualizado : "auto";
      const { data, error } = await sb.from("parranda_fallos").select("bloque, veces, fallos").eq("cancion", ed.ruta).eq("dificultad", ed.dificultad).eq("mapa_version", version);
      if (error) throw error;
      if (!data || !data.length) { window.ParrandaEditor.fijarFallos(null); lista.innerHTML = `<li class="re-vacio">Todavía no hay partidas registradas de esta versión del mapa.</li>`; return; }
      const nBloques = Math.ceil(ed.buffer.duration / 4) + 1;
      const notasPorBloque = new Array(nBloques).fill(0);
      ed.notas.forEach(n => { const b = Math.min(nBloques - 1, Math.floor(n.t / 4)); notasPorBloque[b] += 1; });
      const tasas = new Array(nBloques).fill(null);
      const detalle = [];
      data.forEach(f => {
        if (f.bloque >= nBloques || f.veces < 1) return;
        const tasa = f.fallos / (f.veces * Math.max(1, notasPorBloque[f.bloque]));
        tasas[f.bloque] = Math.min(1, tasa);
        if (f.veces >= 3 && notasPorBloque[f.bloque] > 0) detalle.push({ bloque: f.bloque, tasa, veces: f.veces });
      });
      window.ParrandaEditor.fijarFallos(tasas);
      detalle.sort((a, b) => b.tasa - a.tasa);
      const t = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      lista.innerHTML = detalle.length
        ? detalle.slice(0, 6).map(d => `<li><span>${t(d.bloque * 4)} a ${t(d.bloque * 4 + 4)} · se falla el <strong>${Math.round(d.tasa * 100)} %</strong> de las notas <small>· ${d.veces} partidas</small></span><button type="button" class="re-btn re-btn-chico" data-ir="${d.bloque * 4}">Ir</button></li>`).join("")
        : `<li class="re-vacio">Hay pocas partidas todavía para señalar partes difíciles (hacen falta al menos 3).</li>`;
    } catch (err) {
      lista.innerHTML = `<li class="re-vacio">${escHtml(/relation|does not exist|schema cache/i.test(String(err && err.message)) ? "Falta correr scratchpad/parranda.sql en Supabase." : "No se pudo cargar.")}</li>`;
    }
  });
  $("reFallosLista").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ir]");
    if (b) window.ParrandaEditor.ir(Math.max(0, Number(b.dataset.ir) - 1));
  });
  $("reVerFallos").addEventListener("change", () => window.ParrandaEditor.repintar());

  acceso();

  if (/[?&]debug\b/.test(location.search)) window.__extras = { abrirTab, acceso, revisarMapa, refrescarOrigenes };
})();
