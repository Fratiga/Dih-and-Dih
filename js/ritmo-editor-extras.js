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
  }
  tabs.forEach(t => t.addEventListener("click", () => abrirTab(t.dataset.tab)));

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

  function iniciarRocola() {
    const form = $("reRocolaForm");
    const archivo = $("reRocolaArchivo");
    const titulo = $("reRocolaTitulo");
    const artista = $("reRocolaArtista");
    const estado = $("reRocolaEstado");
    const boton = $("reRocolaSubir");
    const lista = $("reRocolaLista");
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
        const { data, error } = await sb.from("rocola_canciones").select("id, ruta, titulo, artista, duracion, nombre_subidor, creada").order("creada", { ascending: false });
        if (error) throw error;
        lista.innerHTML = data.length
          ? data.map(c => `<li><span>${escHtml(c.titulo)}${c.artista ? ` <small>· ${escHtml(c.artista)}</small>` : ""} <small>${formatoDuracion(c.duracion)}${c.nombre_subidor ? ` · ${escHtml(c.nombre_subidor)}` : ""}</small></span><button type="button" class="re-btn re-btn-chico re-btn-peligro" data-id="${c.id}" data-ruta="${escHtml(c.ruta)}">Quitar</button></li>`).join("")
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
      boton.disabled = true;
      decir("Subiendo...");
      try {
        const sb = await fichasCliente();
        const carpeta = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
        const ruta = `${carpeta}/${limpiarNombre(a ? `${t} - ${a}` : t)}.mp3`;
        const { error: e1 } = await sb.storage.from("rocola").upload(ruta, f, { contentType: "audio/mpeg", upsert: false });
        if (e1) throw e1;
        const urlPublica = sb.storage.from("rocola").getPublicUrl(ruta).data.publicUrl;
        const quien = typeof nombreUsuario === "function" ? nombreUsuario() : "";
        const { error: e2 } = await sb.from("rocola_canciones").insert({ ruta: urlPublica, titulo: t, artista: a, duracion: duracion || null, nombre_subidor: quien || "" });
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
      }
    });

    lista.addEventListener("click", async ev => {
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

  acceso();

  if (/[?&]debug\b/.test(location.search)) window.__extras = { abrirTab, acceso };
})();
