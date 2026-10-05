/* Gestor de la rocola, dentro de la página de la rocola y solo para Admin y DJ:
   añadir canciones, quitarlas (las subidas se borran; las que trae el sitio se ocultan) y recortarlas.
   Usa las tablas rocola_canciones (ritmo_dj.sql, ritmo_editor_2.sql) y rocola_ocultas (rocola_gestor.sql).
   Requiere js/fichas-supabase.js, js/ritmo-rol.js, js/musica-nube.js y js/common.js. */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const caja = $("rgGestor");
  if (!caja) return;

  const MARCA_STORAGE = "/object/public/rocola/";
  const MAX_BYTES = 30 * 1024 * 1024;

  const escHtml = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formatoDur = s => { const t = Math.round(s || 0); return t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : ""; };
  const mb = b => (b / 1048576).toFixed(1);
  const esNube = ruta => /^https?:/i.test(ruta);
  const urlDe = ruta => (esNube(ruta) ? ruta : encodeURI(ruta));
  const norma = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function limpiarNombre(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,'()&!_-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "cancion";
  }
  function partir(nombre) {
    const m = nombre.match(/^(.*\S) - ([^-]+)$/);
    return m ? { titulo: m[1].trim(), artista: m[2].trim() } : { titulo: nombre.trim(), artista: "" };
  }
  function textoError(err) {
    const t = String((err && (err.message || err.error_description)) || err || "");
    if (/Bucket not found|does not exist|relation|rocola_canciones|rocola_ocultas|rocola_nombres/i.test(t)) return "Falta correr scratchpad/rocola_gestor.sql (y ritmo_dj.sql) en Supabase.";
    if (/row-level|policy|permission|Unauthorized|not authorized|JWT/i.test(t)) return "No tienes permiso. Hace falta ser Admin o DJ.";
    if (/duplicate|already exists/i.test(t)) return "Esa canción ya está subida.";
    return t || "Error desconocido";
  }

  let filasNube = []; // canciones subidas, con su id
  let ocultas = []; // canciones del sitio ocultas: { ruta, titulo }
  let nombres = []; // nombres puestos a mano a canciones del sitio: { ruta, titulo, artista }
  let filtro = "";

  const estado = $("rgEstado");
  const decir = (texto, error) => { estado.textContent = texto; estado.classList.toggle("error", !!error); };

  /* --- Lista de todas las canciones ---------------------------------------------------------------- */
  async function cargarDatos() {
    try {
      const sb = await fichasCliente();
      let res = await sb.from("rocola_canciones").select("id, ruta, titulo, artista, duracion, nombre_subidor, bytes").order("creada", { ascending: false });
      if (res.error && /bytes/i.test(String(res.error.message))) res = await sb.from("rocola_canciones").select("id, ruta, titulo, artista, duracion, nombre_subidor").order("creada", { ascending: false });
      if (res.error) throw res.error;
      filasNube = res.data || [];
      const o = await sb.from("rocola_ocultas").select("ruta, titulo").order("creada", { ascending: false });
      ocultas = o.error ? [] : (o.data || []);
      if (o.error && !/relation|does not exist|schema cache/i.test(String(o.error.message))) throw o.error;
      sinTablaOcultas = !!o.error;
      const n = await sb.from("rocola_nombres").select("ruta, titulo, artista");
      nombres = n.error ? [] : (n.data || []);
      sinTablaNombres = !!n.error;
    } catch (err) {
      decir(textoError(err), true);
    }
    pintar();
  }
  let sinTablaOcultas = false;
  let sinTablaNombres = false;

  function nombreDe(ruta) {
    return typeof prettyName === "function" ? prettyName(ruta) : ruta.split("/").pop();
  }
  // El nombre del archivo tal cual ("Título - Artista"), sin la limpieza que hace prettyName
  function nombreCrudo(ruta) {
    let n = ruta.split("/").pop();
    try { n = decodeURIComponent(n); } catch (e) { /* tal cual */ }
    return n.replace(/\.[^.]+$/, "");
  }
  function duracionDe(ruta) {
    return (window.MUSICA_NUBE_DURACIONES || {})[ruta] || (window.MUSICA_DURACIONES || {})[ruta] || 0;
  }

  function pintar() {
    const porRuta = new Map(filasNube.map(f => [f.ruta, f]));
    const q = norma(filtro);
    const visibles = (window.MUSICA || []).map(ruta => {
      const f = porRuta.get(ruta);
      return f
        ? { ruta, nube: true, id: f.id, titulo: f.titulo, artista: f.artista, dur: Number(f.duracion) || duracionDe(ruta), bytes: f.bytes, quien: f.nombre_subidor }
        : { ruta, nube: false, titulo: nombreDe(ruta), artista: "", dur: duracionDe(ruta), cambiado: nombres.some(n => n.ruta === ruta) };
    }).filter(c => !q || norma(c.titulo + " " + c.artista).includes(q));
    $("rgLista").innerHTML = visibles.length
      ? visibles.map(c => `<li data-ruta="${escHtml(c.ruta)}"><span class="rg-nombre">${escHtml(c.titulo)}${c.artista ? ` <small>· ${escHtml(c.artista)}</small>` : ""} <small>${formatoDur(c.dur)}${c.bytes ? ` · ${mb(c.bytes)} MB` : ""}${c.nube ? ` · subida${c.quien ? " por " + escHtml(c.quien) : ""}` : " · del sitio"}</small></span><span class="rg-acciones">` +
        `<button type="button" class="rg-btn" data-recortar>Recortar</button>` +
        `<button type="button" class="rg-btn" data-renombrar>Renombrar</button>` +
        `<button type="button" class="rg-btn rg-peligro" data-quitar>Quitar</button></span></li>`).join("")
      : `<li class="rg-vacio">${q ? "Ninguna canción coincide." : "No hay canciones."}</li>`;
    $("rgOcultasCaja").classList.toggle("hidden", !ocultas.length && !sinTablaOcultas);
    $("rgOcultas").innerHTML = sinTablaOcultas
      ? `<li class="rg-vacio">Para ocultar canciones del sitio falta correr scratchpad/rocola_gestor.sql en Supabase.</li>`
      : ocultas.map(o => `<li data-ruta="${escHtml(o.ruta)}"><span class="rg-nombre">${escHtml(o.titulo || nombreDe(o.ruta))}</span><span class="rg-acciones"><button type="button" class="rg-btn" data-restaurar>Restaurar</button></span></li>`).join("");
    const total = filasNube.reduce((a, c) => a + (Number(c.bytes) || 0), 0);
    $("rgUso").textContent = filasNube.length ? `${filasNube.length} subida${filasNube.length === 1 ? "" : "s"}${total ? `, ${mb(total)} MB de unos 1000 MB que da el plan gratuito de Supabase` : ""}.` : "";
  }

  async function refrescarTodo() {
    if (window.MusicaNube) await MusicaNube.refrescar();
    await cargarDatos();
  }

  $("rgFiltro").addEventListener("input", ev => { filtro = ev.target.value; pintar(); });

  /* --- Subida --------------------------------------------------------------------------------------- */
  async function subirConProgreso(sb, ruta, blob, alProgreso) {
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
      xhr.send(blob);
    });
  }

  function medirDuracion(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(a.duration) ? a.duration : 0); };
      a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      a.src = url;
    });
  }

  /* Sube un blob mp3 y crea su fila. Devuelve la fila nueva (con su ruta pública). */
  async function crearCancion(sb, blob, titulo, artista, duracion, alProgreso) {
    const carpeta = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
    const ruta = `${carpeta}/${limpiarNombre(artista ? `${titulo} - ${artista}` : titulo)}.mp3`;
    await subirConProgreso(sb, ruta, blob, alProgreso || (() => {}));
    const urlPublica = sb.storage.from("rocola").getPublicUrl(ruta).data.publicUrl;
    const quien = typeof nombreUsuario === "function" ? nombreUsuario() : "";
    const fila = { ruta: urlPublica, titulo, artista, duracion: duracion || null, nombre_subidor: quien || "", bytes: blob.size };
    let { error } = await sb.from("rocola_canciones").insert(fila);
    if (error && /bytes/i.test(String(error.message))) { delete fila.bytes; ({ error } = await sb.from("rocola_canciones").insert(fila)); }
    if (error) { await sb.storage.from("rocola").remove([ruta]); throw error; }
    return urlPublica;
  }

  async function borrarArchivo(sb, urlRuta) {
    const i = urlRuta.indexOf(MARCA_STORAGE);
    if (i < 0) return;
    try { await sb.storage.from("rocola").remove([decodeURIComponent(urlRuta.slice(i + MARCA_STORAGE.length))]); } catch (e) { /* queda huérfano, no pasa nada */ }
  }

  $("rgForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const archivos = [...$("rgArchivos").files];
    if (!archivos.length) return decir("Elige uno o varios archivos mp3.", true);
    const boton = $("rgSubir");
    const barra = $("rgProgreso");
    boton.disabled = true;
    barra.classList.remove("hidden");
    let ok = 0;
    const fallos = [];
    try {
      const sb = await fichasCliente();
      for (let k = 0; k < archivos.length; k++) {
        const f = archivos[k];
        const etiqueta = `(${k + 1} de ${archivos.length}) ${f.name}`;
        if (!/\.mp3$/i.test(f.name) && f.type !== "audio/mpeg") { fallos.push(`${f.name}: no es mp3`); continue; }
        if (f.size > MAX_BYTES) { fallos.push(`${f.name}: pesa más de 30 MB`); continue; }
        const { titulo, artista } = partir(f.name.replace(/\.[^.]+$/, ""));
        const nt = norma(titulo);
        const repetida = nt.length >= 4 && (window.MUSICA || []).some(r => norma(nombreDe(r)).includes(nt));
        if (repetida && !confirm(`Ya hay algo parecido a "${titulo}" en la rocola. ¿Subirla igual?`)) { fallos.push(`${f.name}: omitida (parecida a una existente)`); continue; }
        decir(`Subiendo ${etiqueta}...`);
        barra.value = 0;
        try {
          const dur = await medirDuracion(f);
          await crearCancion(sb, f, titulo.slice(0, 140), artista.slice(0, 140), dur, fr => { barra.value = Math.round(fr * 100); });
          ok++;
        } catch (err) {
          fallos.push(`${f.name}: ${textoError(err)}`);
        }
      }
    } catch (err) {
      fallos.push(textoError(err));
    }
    $("rgArchivos").value = "";
    boton.disabled = false;
    barra.classList.add("hidden");
    decir((ok ? `${ok} canción${ok === 1 ? "" : "es"} subida${ok === 1 ? "" : "s"}. ` : "") + (fallos.length ? "Problemas: " + fallos.join("; ") : ""), !ok && fallos.length > 0);
    await refrescarTodo();
  });

  /* --- Quitar, renombrar y restaurar ------------------------------------------------------------- */
  $("rgLista").addEventListener("click", async ev => {
    const li = ev.target.closest("li[data-ruta]");
    if (!li) return;
    const ruta = li.dataset.ruta;
    const nombre = li.querySelector(".rg-nombre").firstChild.textContent.trim();
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.dataset.recortar !== undefined) { abrirRecorte(ruta, nombre); return; }

    if (btn.dataset.renombrar !== undefined) { abrirNombre(ruta); return; }

    if (btn.dataset.quitar !== undefined) {
      const nube = esNube(ruta);
      const aviso = nube
        ? `¿Quitar "${nombre}" de la rocola? Se borra el archivo. Los mapas que tenga guardados se quedan, pero la canción deja de aparecer.`
        : `¿Quitar "${nombre}" de la rocola y de Zarabanda? Se oculta del sitio y puedes restaurarla desde "Canciones ocultas".`;
      if (!confirm(aviso)) return;
      btn.disabled = true;
      try {
        const sb = await fichasCliente();
        if (nube) {
          const { error } = await sb.from("rocola_canciones").delete().eq("ruta", ruta);
          if (error) throw error;
          await borrarArchivo(sb, ruta);
        } else {
          const { error } = await sb.from("rocola_ocultas").insert({ ruta, titulo: nombre });
          if (error) throw error;
        }
        decir(`"${nombre}" quitada.`);
        await refrescarTodo();
      } catch (err) { btn.disabled = false; decir(textoError(err), true); }
    }
  });

  $("rgOcultas").addEventListener("click", async ev => {
    const btn = ev.target.closest("[data-restaurar]");
    if (!btn) return;
    const ruta = btn.closest("li").dataset.ruta;
    btn.disabled = true;
    try {
      const sb = await fichasCliente();
      const { error } = await sb.from("rocola_ocultas").delete().eq("ruta", ruta);
      if (error) throw error;
      decir("Canción restaurada.");
      await refrescarTodo();
    } catch (err) { btn.disabled = false; decir(textoError(err), true); }
  });

  /* --- Renombrar (cualquier canción) ------------------------------------------------------------ */
  const dlgNombre = $("rgNombre");
  let nombrando = null; // ruta

  // Título y artista actuales: los de la fila si es subida, el nombre puesto a mano o el del archivo si es del sitio
  function nombreActual(ruta) {
    const f = filasNube.find(x => x.ruta === ruta);
    if (f) return { titulo: f.titulo, artista: f.artista };
    const n = nombres.find(x => x.ruta === ruta);
    return n ? { titulo: n.titulo, artista: n.artista || "" } : partir(nombreCrudo(ruta));
  }

  function abrirNombre(ruta) {
    nombrando = ruta;
    const a = nombreActual(ruta);
    $("rgNombreTitulo").value = a.titulo;
    $("rgNombreArtista").value = a.artista;
    const manual = !esNube(ruta) && nombres.some(x => x.ruta === ruta);
    $("rgNombreRestablecer").classList.toggle("hidden", !manual);
    $("rgNombreEstado").textContent = !esNube(ruta) && sinTablaNombres ? "Para cambiar el nombre de las canciones del sitio falta correr scratchpad/rocola_nombres.sql en Supabase." : "";
    $("rgNombreEstado").classList.toggle("error", !esNube(ruta) && sinTablaNombres);
    dlgNombre.showModal();
    $("rgNombreTitulo").select();
  }

  $("rgNombreCancelar").addEventListener("click", () => dlgNombre.close());
  $("rgNombreForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const ruta = nombrando;
    const t = $("rgNombreTitulo").value.trim().slice(0, 140);
    const a = $("rgNombreArtista").value.trim().slice(0, 140);
    if (!t) { $("rgNombreEstado").textContent = "El título no puede quedar vacío."; $("rgNombreEstado").classList.add("error"); return; }
    try {
      const sb = await fichasCliente();
      if (esNube(ruta)) {
        const { error } = await sb.from("rocola_canciones").update({ titulo: t, artista: a }).eq("ruta", ruta);
        if (error) throw error;
      } else {
        const { error } = await sb.from("rocola_nombres").upsert({ ruta, titulo: t, artista: a });
        if (error) throw error;
      }
      dlgNombre.close();
      decir("Nombre actualizado.");
      await refrescarTodo();
    } catch (err) {
      $("rgNombreEstado").textContent = textoError(err);
      $("rgNombreEstado").classList.add("error");
    }
  });
  $("rgNombreRestablecer").addEventListener("click", async () => {
    try {
      const sb = await fichasCliente();
      const { error } = await sb.from("rocola_nombres").delete().eq("ruta", nombrando);
      if (error) throw error;
      dlgNombre.close();
      decir("Nombre restablecido al del archivo.");
      await refrescarTodo();
    } catch (err) {
      $("rgNombreEstado").textContent = textoError(err);
      $("rgNombreEstado").classList.add("error");
    }
  });

  /* --- Recortar -------------------------------------------------------------------------------------- */
  const dlg = $("rgRecorte");
  const lienzo = $("rgOnda");
  const g = lienzo.getContext("2d");
  const iniEl = $("rgIni");
  const finEl = $("rgFin");
  const estadoR = $("rgRecorteEstado");
  const barraR = $("rgRecorteProgreso");
  let rec = null; // { ruta, nombre, buffer, picos, ini, fin }
  let audioCtx = null;
  let reproduccion = null;

  const decirR = (texto, error) => { estadoR.textContent = texto; estadoR.classList.toggle("error", !!error); };

  function contexto() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  async function abrirRecorte(ruta, nombre) {
    detenerPrueba();
    rec = null;
    $("rgRecorteTitulo").textContent = nombre;
    $("rgRecorteCuerpo").classList.add("hidden");
    decirR("Cargando la canción...");
    barraR.classList.add("hidden");
    $("rgRecorteGuardar").disabled = true;
    dlg.showModal();
    try {
      const resp = await fetch(urlDe(ruta));
      if (!resp.ok) throw new Error(`No se pudo leer el archivo (${resp.status})`);
      const datos = await resp.arrayBuffer();
      const buffer = await contexto().decodeAudioData(datos);
      const canal = buffer.getChannelData(0);
      const N = 900;
      const paso = Math.max(1, Math.floor(canal.length / N));
      const picos = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let m = 0;
        const a = i * paso;
        for (let j = a; j < a + paso && j < canal.length; j += 4) { const v = Math.abs(canal[j]); if (v > m) m = v; }
        picos[i] = m;
      }
      rec = { ruta, nombre, buffer, picos, ini: 0, fin: buffer.duration };
      $("rgRecorteCuerpo").classList.remove("hidden");
      $("rgRecorteGuardar").disabled = false;
      decirR("");
      sincronizar();
    } catch (err) {
      decirR("No se pudo abrir la canción: " + textoError(err), true);
    }
  }

  function sincronizar() {
    if (!rec) return;
    iniEl.value = rec.ini.toFixed(1);
    finEl.value = rec.fin.toFixed(1);
    iniEl.max = finEl.max = rec.buffer.duration.toFixed(1);
    $("rgRecorteResumen").textContent = `Original ${formatoDur(rec.buffer.duration)}. Queda ${formatoDur(rec.fin - rec.ini)}.`;
    dibujar();
  }

  function dibujar() {
    if (!rec) return;
    const w = lienzo.width;
    const h = lienzo.height;
    g.clearRect(0, 0, w, h);
    const dur = rec.buffer.duration;
    const xi = (rec.ini / dur) * w;
    const xf = (rec.fin / dur) * w;
    g.fillStyle = "rgba(255, 255, 255, 0.06)";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(122, 232, 255, 0.16)";
    g.fillRect(xi, 0, xf - xi, h);
    const N = rec.picos.length;
    for (let i = 0; i < N; i++) {
      const x = (i / N) * w;
      const dentro = x >= xi && x <= xf;
      g.fillStyle = dentro ? "#7ae8ff" : "rgba(180, 180, 180, 0.35)";
      const alto = Math.max(1, rec.picos[i] * (h - 8));
      g.fillRect(x, (h - alto) / 2, Math.max(1, w / N - 0.5), alto);
    }
    g.fillStyle = "#ff4fd8";
    g.fillRect(xi - 1.5, 0, 3, h);
    g.fillRect(xf - 1.5, 0, 3, h);
  }

  function tiempoDeX(ev) {
    const r = lienzo.getBoundingClientRect();
    return Math.max(0, Math.min(rec.buffer.duration, ((ev.clientX - r.left) / r.width) * rec.buffer.duration));
  }

  let arrastre = null;
  lienzo.addEventListener("pointerdown", ev => {
    if (!rec) return;
    const t = tiempoDeX(ev);
    arrastre = Math.abs(t - rec.ini) <= Math.abs(t - rec.fin) ? "ini" : "fin";
    try { lienzo.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    mover(ev);
  });
  lienzo.addEventListener("pointermove", ev => { if (arrastre) mover(ev); });
  lienzo.addEventListener("pointerup", () => { arrastre = null; });
  lienzo.addEventListener("pointercancel", () => { arrastre = null; });
  function mover(ev) {
    const t = Math.round(tiempoDeX(ev) * 10) / 10;
    if (arrastre === "ini") rec.ini = Math.min(t, rec.fin - 1);
    else rec.fin = Math.max(t, rec.ini + 1);
    rec.ini = Math.max(0, rec.ini);
    rec.fin = Math.min(rec.buffer.duration, rec.fin);
    detenerPrueba();
    sincronizar();
  }
  iniEl.addEventListener("change", () => { if (!rec) return; rec.ini = Math.max(0, Math.min(Number(iniEl.value) || 0, rec.fin - 1)); detenerPrueba(); sincronizar(); });
  finEl.addEventListener("change", () => { if (!rec) return; rec.fin = Math.min(rec.buffer.duration, Math.max(Number(finEl.value) || 0, rec.ini + 1)); detenerPrueba(); sincronizar(); });

  function detenerPrueba() {
    if (reproduccion) { try { reproduccion.stop(); } catch (e) { /* ya parada */ } reproduccion = null; }
    $("rgRecortePrueba").textContent = "Escuchar el inicio";
  }
  $("rgRecortePrueba").addEventListener("click", async () => {
    if (!rec) return;
    if (reproduccion) { detenerPrueba(); return; }
    const ctx = contexto();
    if (ctx.state === "suspended") await ctx.resume();
    const fuente = ctx.createBufferSource();
    fuente.buffer = rec.buffer;
    fuente.connect(ctx.destination);
    // Los primeros 8 segundos del recorte, para comprobar dónde empieza
    const largo = rec.fin - rec.ini;
    fuente.start(0, rec.ini, Math.min(largo, 8));
    reproduccion = fuente;
    fuente.onended = () => { if (reproduccion === fuente) detenerPrueba(); };
    $("rgRecortePrueba").textContent = "Detener";
  });
  $("rgRecortePruebaFinal").addEventListener("click", async () => {
    if (!rec) return;
    detenerPrueba();
    const ctx = contexto();
    if (ctx.state === "suspended") await ctx.resume();
    const fuente = ctx.createBufferSource();
    fuente.buffer = rec.buffer;
    fuente.connect(ctx.destination);
    fuente.start(0, Math.max(rec.ini, rec.fin - 5), Math.min(5, rec.fin - rec.ini));
    reproduccion = fuente;
    fuente.onended = () => { if (reproduccion === fuente) detenerPrueba(); };
    $("rgRecortePrueba").textContent = "Detener";
  });

  $("rgRecorteCancelar").addEventListener("click", () => { detenerPrueba(); dlg.close(); });
  dlg.addEventListener("close", detenerPrueba);

  let lameCargado = null;
  function cargarLame() {
    if (window.lamejs) return Promise.resolve();
    if (!lameCargado) {
      lameCargado = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js";
        s.onload = resolve;
        s.onerror = () => { lameCargado = null; reject(new Error("No se pudo cargar el codificador de mp3. Revisa tu conexión.")); };
        document.head.appendChild(s);
      });
    }
    return lameCargado;
  }

  /* Corta el audio decodificado, le pone un fundido corto en los extremos y lo codifica a mp3 de 128 kbps */
  async function codificar(buffer, ini, fin, fundidoSalida, alProgreso) {
    await cargarLame();
    const sr = buffer.sampleRate;
    const canales = Math.min(2, buffer.numberOfChannels);
    const a = Math.floor(ini * sr);
    const b = Math.min(buffer.length, Math.floor(fin * sr));
    const n = b - a;
    const datos = [];
    const fadeIn = Math.floor(0.015 * sr);
    const fadeOut = Math.floor((fundidoSalida ? 1.2 : 0.015) * sr);
    for (let c = 0; c < canales; c++) {
      const origen = buffer.getChannelData(c);
      const salida = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        let v = origen[a + i];
        if (i < fadeIn) v *= i / fadeIn;
        if (n - i < fadeOut) v *= (n - i) / fadeOut;
        v = Math.max(-1, Math.min(1, v));
        salida[i] = v < 0 ? v * 32768 : v * 32767;
      }
      datos.push(salida);
    }
    const enc = new window.lamejs.Mp3Encoder(canales, sr, 128);
    const trozos = [];
    const bloque = 1152;
    for (let i = 0; i < n; i += bloque) {
      const izq = datos[0].subarray(i, i + bloque);
      const out = canales === 2 ? enc.encodeBuffer(izq, datos[1].subarray(i, i + bloque)) : enc.encodeBuffer(izq);
      if (out.length) trozos.push(new Uint8Array(out));
      if ((i / bloque) % 200 === 0) {
        alProgreso(i / n);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    const resto = enc.flush();
    if (resto.length) trozos.push(new Uint8Array(resto));
    return new Blob(trozos, { type: "audio/mpeg" });
  }

  $("rgRecorteGuardar").addEventListener("click", async () => {
    if (!rec) return;
    const { ruta, buffer, ini, fin } = rec;
    const sinCambios = ini < 0.05 && fin > buffer.duration - 0.05;
    if (sinCambios) return decirR("Mueve el inicio o el final para recortar algo.", true);
    const nube = esNube(ruta);
    const fila = filasNube.find(f => f.ruta === ruta);
    const base = nombreActual(ruta);
    const aviso = (nube
      ? "La canción se reemplaza por la versión recortada (se borra el archivo anterior)."
      : "Se sube la versión recortada como canción nueva y la original se oculta del sitio.") +
      (ini < 0.05 ? " Los mapas de la canción se pasan a la versión recortada." : " Como cambia el inicio, los mapas hechos para la versión larga no encajarían: no se pasan y tendrás que rehacerlos.") +
      " Los puntajes empiezan de cero.\n\n¿Seguir?";
    if (!confirm(aviso)) return;
    $("rgRecorteGuardar").disabled = true;
    barraR.classList.remove("hidden");
    barraR.value = 0;
    try {
      decirR("Preparando el mp3...");
      const blob = await codificar(buffer, ini, fin, $("rgRecorteFundido").checked, f => { barraR.value = Math.round(f * 50); decirR(`Preparando el mp3... ${Math.round(f * 100)} %`); });
      if (blob.size > MAX_BYTES) throw new Error("El resultado pesa más de 30 MB.");
      const sb = await fichasCliente();
      decirR("Subiendo...");
      const nuevaRuta = await crearCancion(sb, blob, base.titulo.slice(0, 140), base.artista.slice(0, 140), fin - ini, fr => { barraR.value = 50 + Math.round(fr * 50); decirR(`Subiendo... ${Math.round(fr * 100)} %`); });
      let notaMapas = "";
      if (ini < 0.05) {
        // Los mapas de Zarabanda y de Estruendo
        let pasados = 0;
        for (const tabla of ["ritmo_mapas", "estruendo_mapas"]) {
          const { data, error } = await sb.from(tabla).update({ cancion: nuevaRuta }).eq("cancion", ruta).select("dificultad");
          if (!error && data) pasados += data.length;
        }
        if (pasados) notaMapas = ` Se pasaron ${pasados} mapa${pasados === 1 ? "" : "s"}.`;
      }
      if (nube) {
        const { error } = await sb.from("rocola_canciones").delete().eq("ruta", ruta);
        if (error) throw error;
        await borrarArchivo(sb, ruta);
      } else {
        const { error } = await sb.from("rocola_ocultas").insert({ ruta, titulo: nombreCrudo(ruta) });
        if (error) throw error;
      }
      detenerPrueba();
      dlg.close();
      decir(`Recortada: ahora dura ${formatoDur(fin - ini)}.${notaMapas}`);
      await refrescarTodo();
    } catch (err) {
      decirR("No se pudo recortar: " + textoError(err), true);
    } finally {
      $("rgRecorteGuardar").disabled = false;
      barraR.classList.add("hidden");
    }
  });

  /* --- Quién lo ve ------------------------------------------------------------------------------------ */
  let iniciado = false;
  function iniciar() { if (!iniciado) { iniciado = true; cargarDatos(); } }
  function mostrar(si) { caja.classList.toggle("hidden", !si); if (si) iniciar(); }
  caja.addEventListener("toggle", () => { if (caja.open && iniciado) cargarDatos(); });
  // Los editores enlazan aquí (rocola.html#rgGestor): se abre el panel
  if (location.hash === "#rgGestor") caja.open = true;
  if (window.RitmoRol) {
    if (RitmoRol.cacheado()) mostrar(true);
    RitmoRol.verificar().then(r => mostrar(!!r.puede));
  }
})();
