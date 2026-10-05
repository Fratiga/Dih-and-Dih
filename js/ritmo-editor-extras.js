/* Apartados de la página del editor de mapas que no tocan el editor en sí: control de acceso (Admin
   y DJ), pestañas y controles segmentados, subida de canciones a la rocola, buzón de problemas o
   sugerencias y minitutoriales. Se carga después de ritmo-editor.js. */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const avisar = (texto, error) => { if (window.RitmoEditor) window.RitmoEditor.mensaje(texto, error); };

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
  }
  tabs.forEach(t => t.addEventListener("click", () => abrirTab(t.dataset.tab)));
  window.addEventListener("ritmo-abrir-tab", ev => {
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
      if (!djIniciado) { djIniciado = true; iniciarRocola(); }
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

  /* --- Subir canciones a la rocola --------------------------------------------------------- */
  function limpiarNombre(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,'()&!_-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "cancion";
  }

  function textoErrorSubida(err) {
    const t = String((err && (err.message || err.error_description)) || err || "");
    if (/Bucket not found|does not exist|relation|rocola_canciones/i.test(t)) return "Falta correr scratchpad/ritmo_dj.sql en Supabase.";
    if (/row-level|policy|permission|Unauthorized|not authorized|JWT/i.test(t)) return "No tienes permiso para subir canciones. Hace falta el rol DJ.";
    if (/duplicate|already exists/i.test(t)) return "Esa canción ya está subida.";
    return "No se pudo subir: " + t;
  }

  function formatoDuracion(s) {
    const t = Math.round(s || 0);
    return t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : "";
  }

  function escHtml(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Sube el archivo a Storage por XHR para poder mostrar el progreso */
  async function subirConProgreso(sb, ruta, archivo, alProgreso) {
    const { data } = await sb.auth.getSession();
    const sesion = data && data.session;
    if (!sesion) throw new Error("Sin sesión: inicia sesión de nuevo.");
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${window.FICHAS_SUPABASE_URL}/storage/v1/object/rocola/${ruta.split("/").map(encodeURIComponent).join("/")}`);
      xhr.setRequestHeader("apikey", window.FICHAS_SUPABASE_KEY);
      xhr.setRequestHeader("Authorization", "Bearer " + sesion.access_token);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("Content-Type", "audio/mpeg");
      xhr.upload.onprogress = e => { if (e.lengthComputable) alProgreso(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Error ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Sin conexión"));
      xhr.send(archivo);
    });
  }

  function iniciarRocola() {
    const form = $("reRocolaForm");
    const archivo = $("reRocolaArchivo");
    const titulo = $("reRocolaTitulo");
    const artista = $("reRocolaArtista");
    const estado = $("reRocolaEstado");
    const boton = $("reRocolaSubir");
    const lista = $("reRocolaLista");
    const progreso = $("reRocolaProgreso");
    const uso = $("reRocolaUso");
    let duracion = 0;

    const decir = (texto, error) => { estado.textContent = texto; estado.classList.toggle("error", !!error); };

    archivo.addEventListener("change", () => {
      const f = archivo.files[0];
      duracion = 0;
      if (!f) return;
      // Si el archivo se llama "Título - Artista.mp3", los campos se rellenan solos
      const base = f.name.replace(/\.[^.]+$/, "");
      const m = base.match(/^(.*\S) - ([^-]+)$/);
      if (!titulo.value) titulo.value = m ? m[1].trim() : base;
      if (!artista.value && m) artista.value = m[2].trim();
      const url = URL.createObjectURL(f);
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => {
        duracion = isFinite(a.duration) ? a.duration : 0;
        URL.revokeObjectURL(url);
        decir(duracion > 360 ? "Dura más de 6 minutos: sonará en la rocola, pero no saldrá en la lista de Zarabanda." : "");
      };
      a.onerror = () => { URL.revokeObjectURL(url); };
      a.src = url;
    });

    async function pintarLista() {
      try {
        const sb = await fichasCliente();
        let res = await sb.from("rocola_canciones").select("id, ruta, titulo, artista, duracion, nombre_subidor, creada, bytes").order("creada", { ascending: false });
        if (res.error && /bytes/i.test(String(res.error.message))) res = await sb.from("rocola_canciones").select("id, ruta, titulo, artista, duracion, nombre_subidor, creada").order("creada", { ascending: false });
        const { data, error } = res;
        if (error) throw error;
        const mb = b => (b / 1048576).toFixed(1);
        const total = data.reduce((a, c) => a + (Number(c.bytes) || 0), 0);
        uso.textContent = data.length
          ? `${data.length} canción${data.length === 1 ? "" : "es"} subida${data.length === 1 ? "" : "s"}${total ? `, ${mb(total)} MB de unos 1000 MB que da el plan gratuito de Supabase` : ""}.`
          : "";
        lista.innerHTML = data.length
          ? data.map(c => `<li><span>${escHtml(c.titulo)}${c.artista ? ` <small>· ${escHtml(c.artista)}</small>` : ""} <small>${formatoDuracion(c.duracion)}${c.bytes ? ` · ${mb(c.bytes)} MB` : ""}${c.nombre_subidor ? ` · ${escHtml(c.nombre_subidor)}` : ""}</small></span><span class="re-lista-acciones"><button type="button" class="re-btn re-btn-chico" data-editar="${c.id}" data-titulo="${escHtml(c.titulo)}" data-artista="${escHtml(c.artista)}">Editar</button><button type="button" class="re-btn re-btn-chico re-btn-peligro" data-id="${c.id}" data-ruta="${escHtml(c.ruta)}">Quitar</button></span></li>`).join("")
          : `<li class="re-vacio">Todavía no hay canciones subidas.</li>`;
      } catch (err) {
        lista.innerHTML = `<li class="re-vacio">${escHtml(/relation|does not exist/i.test(String(err && err.message)) ? "Falta correr scratchpad/ritmo_dj.sql en Supabase." : "No se pudo cargar la lista.")}</li>`;
      }
    }

    async function refrescarListas() {
      if (window.MusicaNube) await MusicaNube.refrescar();
      if (window.RitmoEditor) window.RitmoEditor.recargarCanciones();
      pintarLista();
    }

    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const f = archivo.files[0];
      const t = titulo.value.trim();
      const a = artista.value.trim();
      if (!f) return decir("Elige un archivo mp3.", true);
      if (!/\.mp3$/i.test(f.name) && f.type !== "audio/mpeg") return decir("Tiene que ser un archivo mp3.", true);
      if (f.size > 30 * 1024 * 1024) return decir("Pesa más de 30 MB.", true);
      if (!t) return decir("Ponle un título.", true);
      // ¿Ya hay una canción con ese nombre en la rocola?
      const norma = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const nt = norma(t);
      const na = norma(a);
      const parecida = nt.length >= 4 && (window.MUSICA || []).some(r => {
        const nombre = norma(window.RitmoEditor ? window.RitmoEditor.cancionPorRuta(r) : r);
        return nombre.includes(nt) && (!na || nombre.includes(na));
      });
      if (parecida && !confirm("Ya hay una canción con un nombre parecido en la rocola. ¿Subirla igual?")) return decir("No se subió.", true);
      boton.disabled = true;
      progreso.value = 0;
      progreso.classList.remove("hidden");
      decir("Subiendo...");
      try {
        const sb = await fichasCliente();
        const carpeta = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
        const ruta = `${carpeta}/${limpiarNombre(a ? `${t} - ${a}` : t)}.mp3`;
        await subirConProgreso(sb, ruta, f, fraccion => {
          progreso.value = Math.round(fraccion * 100);
          decir(`Subiendo... ${Math.round(fraccion * 100)} %`);
        });
        const urlPublica = sb.storage.from("rocola").getPublicUrl(ruta).data.publicUrl;
        const quien = typeof nombreUsuario === "function" ? nombreUsuario() : "";
        let { error: e2 } = await sb.from("rocola_canciones").insert({ ruta: urlPublica, titulo: t, artista: a, duracion: duracion || null, nombre_subidor: quien || "", bytes: f.size });
        // Si todavía no se corrió ritmo_editor_2.sql, la columna "bytes" no existe: se guarda sin ella
        if (e2 && /bytes/i.test(String(e2.message))) ({ error: e2 } = await sb.from("rocola_canciones").insert({ ruta: urlPublica, titulo: t, artista: a, duracion: duracion || null, nombre_subidor: quien || "" }));
        if (e2) {
          await sb.storage.from("rocola").remove([ruta]);
          throw e2;
        }
        form.reset();
        duracion = 0;
        decir("Subida. Ya está en la rocola y en Zarabanda.");
        avisar("Canción subida a la rocola.");
        await refrescarListas();
      } catch (err) {
        decir(textoErrorSubida(err), true);
      } finally {
        boton.disabled = false;
        progreso.classList.add("hidden");
      }
    });

    lista.addEventListener("click", async ev => {
      const ed = ev.target.closest("[data-editar]");
      if (ed) {
        const nuevoTitulo = prompt("Título de la canción:", ed.dataset.titulo);
        if (nuevoTitulo === null) return;
        const nuevoArtista = prompt("Artista:", ed.dataset.artista);
        if (nuevoArtista === null) return;
        if (!nuevoTitulo.trim()) { avisar("El título no puede quedar vacío.", true); return; }
        try {
          const sb = await fichasCliente();
          const { error } = await sb.from("rocola_canciones").update({ titulo: nuevoTitulo.trim().slice(0, 140), artista: nuevoArtista.trim().slice(0, 140) }).eq("id", ed.dataset.editar);
          if (error) throw error;
          avisar("Canción actualizada.");
          await refrescarListas();
        } catch (err) {
          avisar(/policy|row-level|permission/i.test(String(err && err.message)) ? "Para editar títulos falta correr scratchpad/ritmo_editor_2.sql." : textoErrorSubida(err), true);
        }
        return;
      }
      const b = ev.target.closest("[data-id]");
      if (!b) return;
      const nombre = b.closest("li").querySelector("span").textContent.trim();
      if (!confirm(`¿Quitar "${nombre}" de la rocola? Los mapas que tenga guardados se quedan, pero la canción deja de aparecer.`)) return;
      b.disabled = true;
      try {
        const sb = await fichasCliente();
        const { error } = await sb.from("rocola_canciones").delete().eq("id", b.dataset.id);
        if (error) throw error;
        const marca = "/object/public/rocola/";
        const i = b.dataset.ruta.indexOf(marca);
        if (i >= 0) {
          const objeto = decodeURIComponent(b.dataset.ruta.slice(i + marca.length));
          await sb.storage.from("rocola").remove([objeto]);
        }
        avisar("Canción quitada.");
        await refrescarListas();
      } catch (err) {
        b.disabled = false;
        avisar(textoErrorSubida(err), true);
      }
    });

    pintarLista();
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
        await enviarPeticion({ texto: "[Editor de mapas] " + t, nombre: nombre.value.trim() });
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
    const lecciones = window.RITMO_TUTORIALES || [];
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
    const ed = window.RitmoEditor && window.RitmoEditor.obtener();
    const cont = $("reRevisarStats");
    const lista = $("reRevisarLista");
    if (!ed || !ed.buffer || !ed.notas.length) {
      cont.innerHTML = "";
      lista.innerHTML = `<li class="re-vacio">Carga primero un mapa.</li>`;
      return;
    }
    const r = RitmoLogica.revisar(ed.notas, ed.pulsos, ed.buffer.duration, ed.dificultad);
    const st = r.stats;
    cont.innerHTML = [
      ["Notas", st.total], ["Por segundo", st.npsMedio], ["Pico", st.picoNps + " /s"], ["Dobles", st.dobles], ["Largas", st.largas],
      ["Arriba", st.arriba], ["Abajo", st.abajo], ["Racha máx.", st.rachaMax], ["Hueco máx.", st.huecoMax + " s"]
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
    if (!window.RitmoEditor) return;
    window.RitmoEditor.limpiarNotas();
    const quitadas = window.RitmoEditor.quitarEncimadas();
    window.RitmoEditor.repintar();
    revisarMapa();
    avisar(`Largas y notas repetidas corregidas${quitadas ? `, y ${quitadas} nota${quitadas === 1 ? "" : "s"} encimada${quitadas === 1 ? "" : "s"} quitada${quitadas === 1 ? "" : "s"}` : ""}.`);
  });
  $("reRevisarLista").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ir]");
    if (b && window.RitmoEditor) window.RitmoEditor.ir(Math.max(0, Number(b.dataset.ir) - 1));
  });

  /* --- Derivar una dificultad desde otra ------------------------------------------------------------------ */
  async function refrescarOrigenes() {
    const sel = $("reDerivarOrigen");
    const ed = window.RitmoEditor && window.RitmoEditor.obtener();
    if (!ed) return;
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("ritmo_mapas").select("dificultad, mapa").eq("cancion", ed.ruta);
      if (error) throw error;
      const otros = (data || []).filter(f => f.dificultad !== ed.dificultad)
        .sort((a, b) => RitmoLogica.ORDEN.indexOf(a.dificultad) - RitmoLogica.ORDEN.indexOf(b.dificultad));
      sel.innerHTML = otros.length
        ? otros.map(f => `<option value="${f.dificultad}">${RitmoLogica.NOMBRE[f.dificultad]} (${f.mapa.notas.length} notas${f.mapa.firma ? `, de ${escHtml(f.mapa.firma)}` : ""})</option>`).join("")
        : `<option value="">No hay otro mapa guardado de esta canción</option>`;
    } catch (err) {
      sel.innerHTML = `<option value="">No se pudo cargar la lista</option>`;
    }
  }

  $("reDerivarRefrescar").addEventListener("click", refrescarOrigenes);
  [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => { if (!document.querySelector('[data-panel="dificultades"]').classList.contains("hidden")) refrescarOrigenes(); }));
  window.addEventListener("ritmo-guardado", refrescarOrigenes);

  $("reDerivar").addEventListener("click", async () => {
    const estado = $("reDerivarEstado");
    const origen = $("reDerivarOrigen").value;
    const ed = window.RitmoEditor.obtener();
    if (!origen) { estado.textContent = "Elige de qué mapa partir."; estado.classList.add("error"); return; }
    estado.classList.remove("error");
    estado.textContent = "Derivando...";
    try {
      await window.RitmoEditor.cargarAudio();
      const sb = await fichasCliente();
      const { data, error } = await sb.from("ritmo_mapas").select("mapa").eq("cancion", ed.ruta).eq("dificultad", origen).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ese mapa ya no existe.");
      const base = window.RitmoEditor.obtener();
      const notasO = data.mapa.notas.map(x => ({ t: x[0], carril: ["abajo", "arriba", "ambos"][x[1]] || "abajo", dur: x[2] || 0 }));
      const nuevas = RitmoLogica.derivar(notasO, data.mapa.pulsos, base.buffer, origen, ed.dificultad);
      window.RitmoEditor.aplicarNotasExternas(nuevas, data.mapa.pulsos);
      window.RitmoEditor.fijarEsperado(null);
      const texto = `${RitmoLogica.NOMBRE[origen]} (${notasO.length} notas) → ${RitmoLogica.NOMBRE[ed.dificultad]} (${nuevas.length} notas). Revísalo y retócalo antes de guardar.`;
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
    const nombreDif = d => RitmoLogica.NOMBRE[d] || d;

    async function cargarHistorial() {
      const ed = window.RitmoEditor && window.RitmoEditor.obtener();
      if (!ed) return;
      try {
        const sb = await fichasCliente();
        const { data, error } = await sb.from("ritmo_mapas_historial").select("id, cancion, dificultad, accion, notas, firma, autor_nombre, creada").order("creada", { ascending: false }).limit(120);
        if (error) throw error;
        const detalle = f => (f.accion === "borrado" ? "borró el mapa" : `guardó ${f.notas} notas`) + (f.firma ? ` · firma ${escHtml(f.firma)}` : "");
        const propias = data.filter(f => f.cancion === ed.ruta && f.dificultad === ed.dificultad).slice(0, 40);
        versiones.innerHTML = propias.length
          ? propias.map(f => `<li><span>${cuando(f.creada)} · <strong>${escHtml(f.autor_nombre || "alguien")}</strong> ${detalle(f)}</span>${f.accion === "guardado" ? `<button type="button" class="re-btn re-btn-chico" data-version="${f.id}">Cargar</button>` : ""}</li>`).join("")
          : `<li class="re-vacio">Todavía no hay versiones guardadas de esta canción y dificultad.</li>`;
        registro.innerHTML = data.slice(0, 40).map(f => `<li><span>${cuando(f.creada)} · <strong>${escHtml(f.autor_nombre || "alguien")}</strong> ${detalle(f)} <small>· ${escHtml(window.RitmoEditor.cancionPorRuta(f.cancion))} · ${nombreDif(f.dificultad)}</small></span></li>`).join("") || `<li class="re-vacio">Nadie ha guardado mapas todavía.</li>`;
      } catch (err) {
        const falta = /relation|does not exist|schema cache/i.test(String(err && err.message));
        versiones.innerHTML = `<li class="re-vacio">${falta ? "Falta correr scratchpad/ritmo_editor_2.sql en Supabase." : "No se pudo cargar el historial."}</li>`;
        registro.innerHTML = "";
      }
    }

    $("reHistorial").addEventListener("toggle", ev => { if (ev.target.open) cargarHistorial(); });
    $("reHistorialRefrescar").addEventListener("click", cargarHistorial);
    window.addEventListener("ritmo-guardado", () => { if ($("reHistorial").open) cargarHistorial(); });
    [$("reCancion"), $("reDif")].forEach(el => el.addEventListener("change", () => { if ($("reHistorial").open) cargarHistorial(); }));

    versiones.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-version]");
      if (!b) return;
      if (window.RitmoEditor.hayCambios() && !confirm("Hay cambios sin guardar en el editor. ¿Reemplazarlos con esa versión?")) return;
      b.disabled = true;
      try {
        const sb = await fichasCliente();
        const ed = window.RitmoEditor.obtener();
        const { data, error } = await sb.from("ritmo_mapas_historial").select("mapa").eq("id", b.dataset.version).single();
        if (error) throw error;
        // Para no recibir un aviso de conflicto contigo mismo, se toma la fecha del mapa guardado ahora
        const { data: actual } = await sb.from("ritmo_mapas").select("actualizado").eq("cancion", ed.ruta).eq("dificultad", ed.dificultad).maybeSingle();
        await window.RitmoEditor.cargarAudio();
        window.RitmoEditor.aplicarGuardableExterno(data.mapa, actual ? actual.actualizado : null);
        avisar("Versión cargada en el editor. Guarda si quieres que sea la actual.");
      } catch (err) {
        avisar("No se pudo cargar esa versión: " + (err && err.message || err), true);
      } finally {
        b.disabled = false;
      }
    });
  }

  acceso();

  if (/[?&]debug\b/.test(location.search)) window.__extras = { abrirTab, acceso, revisarMapa, refrescarOrigenes };
})();
