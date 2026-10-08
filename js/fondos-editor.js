/* Pestaña "Fondo" de los editores de Zarabanda y Parranda: una imagen, un GIF o un video que se ve detrás de los
   carriles. Se puede poner solo para la dificultad que se está editando, para todas las dificultades del juego o
   para todos los juegos. En el juego gana siempre el más específico (ver FondosJuego.elegir). Solo Admin y DJ llegan
   al editor, y el servidor lo exige igual (tabla rocola_fondos, ver scratchpad/fondos_2.sql). Se carga después del
   editor y de sus extras. */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const LIMITE_IMAGEN = 15 * 1024 * 1024;
  const LIMITE_GIF = 6 * 1024 * 1024; // un GIF pesa mucho más que un video igual y hace ir peor al juego
  const LIMITE_VIDEO = 40 * 1024 * 1024;
  const NOMBRE_DIF = { facil: "Fácil", normal: "Normal", dificil: "Difícil", experto: "Experto" };
  const MARCA_STORAGE = "/object/public/rocola/";
  const mb = b => (b / 1048576).toFixed(1);

  let cfg = null; // { juego, nombreJuego, editor }
  let filas = []; // todos los fondos de la canción abierta
  let rutaCargada = null;
  let archivo = null;
  let urlPrevia = null;
  let sinTabla = false;

  const limpiarNombre = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,'()&!_-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "fondo";
  const filaDe = (juego, dificultad) => filas.find(f => f.juego === juego && f.dificultad === dificultad) || null;
  const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function contexto() { return cfg.editor(); }

  /* El alcance elegido en el selector */
  function alcance() {
    const v = $("reFondoAlcance").value;
    const ed = contexto();
    if (v === "dif") return { juego: cfg.juego, dificultad: ed.dificultad };
    if (v === "juego") return { juego: cfg.juego, dificultad: "" };
    return { juego: "", dificultad: "" };
  }

  function opcionesAlcance() {
    const ed = contexto();
    const previo = $("reFondoAlcance").value || "dif";
    $("reFondoAlcance").innerHTML =
      `<option value="dif">Solo ${NOMBRE_DIF[ed.dificultad] || ed.dificultad} de ${cfg.nombreJuego}</option>` +
      `<option value="juego">Todas las dificultades de ${cfg.nombreJuego}</option>` +
      `<option value="todo">Todos los juegos y dificultades</option>`;
    $("reFondoAlcance").value = previo;
  }

  function previa(url, tipo) {
    const caja = $("reFondoPrevia");
    caja.innerHTML = "";
    if (!url) { caja.innerHTML = `<span class="re-fondo-vacio">Sin fondo en este alcance</span>`; return; }
    const el = tipo === "video" ? Object.assign(document.createElement("video"), { muted: true, loop: true, autoplay: true, playsInline: true }) : document.createElement("img");
    el.src = url;
    el.style.opacity = String(Number($("reFondoOpacidad").value) / 100);
    caja.appendChild(el);
    // Unas franjas simulan los carriles encima, para ver cómo queda
    caja.insertAdjacentHTML("beforeend", `<i class="re-fondo-carril" style="top: 28%"></i><i class="re-fondo-carril" style="top: 62%"></i>`);
  }

  function pintarResumen() {
    const ed = contexto();
    const niveles = [
      { etq: `${NOMBRE_DIF[ed.dificultad] || ed.dificultad} de ${cfg.nombreJuego}`, f: filaDe(cfg.juego, ed.dificultad) },
      { etq: `Todas las dificultades de ${cfg.nombreJuego}`, f: filaDe(cfg.juego, "") },
      { etq: "Todos los juegos y dificultades", f: filaDe("", "") }
    ];
    const vigente = niveles.findIndex(n => n.f);
    $("reFondoResumen").innerHTML = niveles.map((n, i) =>
      `<li${i === vigente ? ` class="re-fondo-vigente"` : ""}><span>${escHtml(n.etq)}</span><span>${n.f ? `${n.f.tipo === "video" ? "Video" : "Imagen"}: ${escHtml(n.f.nombre || "sin nombre")}${i === vigente ? " (el que se ve ahora)" : ""}` : "sin fondo"}</span></li>`
    ).join("");
  }

  function pintar() {
    if (!cfg) return;
    const ed = contexto();
    if (!ed.ruta) { $("reFondoCancionTxt").textContent = "Elige una canción."; return; }
    opcionesAlcance();
    $("reFondoCancionTxt").textContent = "";
    const a = alcance();
    const f = filaDe(a.juego, a.dificultad);
    archivo = null;
    if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
    $("reFondoArchivo").value = "";
    $("reFondoOpacidad").value = String(Math.round((f ? Number(f.opacidad) : 0.35) * 100));
    $("reFondoOpTxt").textContent = $("reFondoOpacidad").value + " %";
    $("reFondoQuitar").classList.toggle("hidden", !f);
    $("reFondoEstado").textContent = sinTabla ? "Para poner fondos falta correr scratchpad/fondos_2.sql en Supabase." : "";
    $("reFondoEstado").classList.toggle("error", sinTabla);
    $("reFondoProgreso").classList.add("hidden");
    $("reFondoGuardar").disabled = sinTabla;
    previa(f ? f.url : null, f ? f.tipo : null);
    pintarResumen();
  }

  async function cargarFilas() {
    const ed = contexto();
    if (!ed.ruta) { filas = []; return; }
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("rocola_fondos").select("cancion, juego, dificultad, url, tipo, opacidad, nombre").eq("cancion", ed.ruta);
      sinTabla = !!error;
      filas = error ? [] : (data || []);
      rutaCargada = ed.ruta;
    } catch (e) {
      sinTabla = false;
      filas = [];
      $("reFondoEstado").textContent = "No se pudo cargar los fondos. Revisa tu conexión.";
      $("reFondoEstado").classList.add("error");
    }
  }

  async function refrescar() {
    if (!cfg) return;
    await cargarFilas();
    pintar();
  }

  function mensaje(texto, error) {
    $("reFondoEstado").textContent = texto;
    $("reFondoEstado").classList.toggle("error", !!error);
  }

  async function subir(sb, ruta, blob, tipoMime, alProgreso) {
    const { data } = await sb.auth.getSession();
    const sesion = data && data.session;
    if (!sesion) throw new Error("Sin sesión: inicia sesión de nuevo.");
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${window.FICHAS_SUPABASE_URL}/storage/v1/object/rocola/${ruta.split("/").map(encodeURIComponent).join("/")}`);
      xhr.setRequestHeader("apikey", window.FICHAS_SUPABASE_KEY);
      xhr.setRequestHeader("Authorization", "Bearer " + sesion.access_token);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("Content-Type", tipoMime);
      xhr.upload.onprogress = e => { if (e.lengthComputable) alProgreso(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Error ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Sin conexión"));
      xhr.send(blob);
    });
  }

  async function borrarArchivo(sb, url) {
    const i = url.indexOf(MARCA_STORAGE);
    if (i < 0) return;
    try { await sb.storage.from("rocola").remove([decodeURIComponent(url.slice(i + MARCA_STORAGE.length))]); } catch (e) { /* queda huérfano, no pasa nada */ }
  }

  function elegirArchivo() {
    const a = $("reFondoArchivo").files[0];
    archivo = a || null;
    if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
    const act = alcance();
    const f = filaDe(act.juego, act.dificultad);
    if (!a) { previa(f ? f.url : null, f ? f.tipo : null); return; }
    const esVideo = /^video\//.test(a.type);
    const esImagen = /^image\//.test(a.type);
    const falla = texto => { mensaje(texto, true); archivo = null; $("reFondoArchivo").value = ""; previa(f ? f.url : null, f ? f.tipo : null); };
    if (!esVideo && !esImagen) return falla("Tiene que ser una imagen (JPG, PNG, WebP, GIF) o un video (MP4 o WebM).");
    if (a.type === "image/gif" && a.size > LIMITE_GIF) return falla(`Este GIF pesa ${mb(a.size)} MB y haría ir lento el juego. Máximo ${mb(LIMITE_GIF)} MB. Conviértelo a MP4 o WebM (pesa mucho menos) o acórtalo.`);
    const limite = esVideo ? LIMITE_VIDEO : LIMITE_IMAGEN;
    if (a.size > limite) return falla(`Pesa ${mb(a.size)} MB: el máximo es ${mb(limite)} MB.`);
    mensaje("");
    urlPrevia = URL.createObjectURL(a);
    previa(urlPrevia, esVideo ? "video" : "imagen");
  }

  async function guardar() {
    const ed = contexto();
    const a = alcance();
    const previo = filaDe(a.juego, a.dificultad);
    const opacidad = Math.max(0.05, Math.min(1, Number($("reFondoOpacidad").value) / 100));
    if (!archivo && !previo) return mensaje("Elige un archivo.", true);
    $("reFondoGuardar").disabled = true;
    try {
      const sb = await fichasCliente();
      if (!archivo) {
        const { error } = await sb.from("rocola_fondos").update({ opacidad, actualizado: new Date().toISOString() }).eq("cancion", ed.ruta).eq("juego", a.juego).eq("dificultad", a.dificultad);
        if (error) throw error;
      } else {
        const esVideo = /^video\//.test(archivo.type);
        const barra = $("reFondoProgreso");
        barra.value = 0;
        barra.classList.remove("hidden");
        mensaje("Subiendo...");
        const carpeta = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
        const base = archivo.name.replace(/\.[^.]+$/, "");
        const coincide = archivo.name.match(/\.([A-Za-z0-9]{2,5})$/);
        const ext = (coincide ? coincide[1] : (esVideo ? "mp4" : "jpg")).toLowerCase();
        const ruta = `fondos/${carpeta}/${limpiarNombre(base)}.${ext}`;
        await subir(sb, ruta, archivo, archivo.type || (esVideo ? "video/mp4" : "image/jpeg"), fr => { barra.value = Math.round(fr * 100); mensaje(`Subiendo... ${Math.round(fr * 100)} %`); });
        const urlPublica = sb.storage.from("rocola").getPublicUrl(ruta).data.publicUrl;
        let quien = "";
        try { quien = typeof nombreUsuario === "function" ? nombreUsuario() : ""; } catch (e) { /* sin nombre */ }
        const { error } = await sb.from("rocola_fondos").upsert({ cancion: ed.ruta, juego: a.juego, dificultad: a.dificultad, url: urlPublica, tipo: esVideo ? "video" : "imagen", opacidad, nombre: archivo.name.slice(0, 100), nombre_subidor: quien || "", actualizado: new Date().toISOString() });
        if (error) { await sb.storage.from("rocola").remove([ruta]); throw error; }
        if (previo) await borrarArchivo(sb, previo.url);
      }
      await cargarFilas();
      pintar();
      mensaje("Fondo guardado.");
      if (window.RitmoEditor && cfg.juego === "zarabanda") window.RitmoEditor.mensaje("Fondo guardado.");
      if (window.ParrandaEditor && cfg.juego === "parranda") window.ParrandaEditor.mensaje("Fondo guardado.");
    } catch (err) {
      mensaje("No se pudo guardar el fondo: " + (/relation|column|schema cache/i.test(String(err && err.message)) ? "falta correr scratchpad/fondos_2.sql en Supabase." : (err && err.message) || err), true);
    } finally {
      $("reFondoGuardar").disabled = sinTabla;
      $("reFondoProgreso").classList.add("hidden");
    }
  }

  async function quitar() {
    const ed = contexto();
    const a = alcance();
    const previo = filaDe(a.juego, a.dificultad);
    if (!previo || !(await dialogo.confirmar("¿Quitar este fondo?", { titulo: "Quitar fondo", aceptar: "Quitar", peligro: true }))) return;
    try {
      const sb = await fichasCliente();
      const { error } = await sb.from("rocola_fondos").delete().eq("cancion", ed.ruta).eq("juego", a.juego).eq("dificultad", a.dificultad);
      if (error) throw error;
      await borrarArchivo(sb, previo.url);
      await cargarFilas();
      pintar();
      mensaje("Fondo quitado.");
    } catch (err) {
      mensaje("No se pudo quitar: " + ((err && err.message) || err), true);
    }
  }

  /* editor: función que devuelve { ruta, dificultad } de lo que se está editando */
  function iniciar(opciones) {
    cfg = opciones;
    $("reFondoAlcance").addEventListener("change", pintar);
    $("reFondoArchivo").addEventListener("change", elegirArchivo);
    $("reFondoOpacidad").addEventListener("input", () => {
      $("reFondoOpTxt").textContent = $("reFondoOpacidad").value + " %";
      const el = $("reFondoPrevia").querySelector("img, video");
      if (el) el.style.opacity = String(Number($("reFondoOpacidad").value) / 100);
    });
    $("reFondoGuardar").addEventListener("click", guardar);
    $("reFondoQuitar").addEventListener("click", quitar);
    // Si cambia la canción o la dificultad mientras la pestaña está a la vista, se actualiza
    const abierta = () => !document.querySelector('[data-panel="fondo"]').classList.contains("hidden");
    const alCambiar = () => { if (abierta()) refrescar(); };
    $("reCancion").addEventListener("change", alCambiar);
    $("reDif").addEventListener("change", () => { if (abierta()) pintar(); });
  }

  window.FondosEditor = { iniciar, refrescar };

  if (window.ParrandaEditor) iniciar({ juego: "parranda", nombreJuego: "Parranda", editor: () => window.ParrandaEditor.obtener() });
  else if (window.RitmoEditor) iniciar({ juego: "zarabanda", nombreJuego: "Zarabanda", editor: () => window.RitmoEditor.obtener() });
})();
