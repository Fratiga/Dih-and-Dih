/* =============================================================================
   ROCOLA DE FONDOS
   La biblioteca de canciones del Admin para la música de las páginas. Es aparte de la Rocola pública: nada de lo que se
   sube aquí sale en rocola.html ni en los juegos, y solo el Admin puede ver la lista (tabla musica_fondos y bucket
   musica_fondos, docs/admin/musica_fondos.sql). Las listas de cada página guardan el enlace público del archivo.
   MusicaFondos.montar(elemento, { alCambiar }) dibuja el gestor (subir, escuchar, renombrar, borrar).
   Lo usan el editor de música de cada página (js/musica-paginas-editor.js) y la pestaña "Música de fondo" de Admin.
============================================================================= */
window.MusicaFondos = (function () {
  const BUCKET = "musica_fondos";
  const MAX_BYTES = 30 * 1024 * 1024;
  const TIPOS = { mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", weba: "audio/webm", flac: "audio/flac" };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let filas = [], cargada = false, sinTabla = false;
  let previa = null, previaRuta = "";
  const oyentes = new Set();

  const cliente = () => fichasCliente();
  const mb = b => (b / 1048576).toFixed(1);
  const minutos = s => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

  function extension(nombre, tipo) {
    const e = (nombre.split(".").pop() || "").toLowerCase();
    if (TIPOS[e]) return e;
    return Object.keys(TIPOS).find(k => TIPOS[k] === tipo) || "";
  }
  const limpio = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "cancion";
  const tituloDe = nombre => nombre.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").trim().slice(0, 120) || "Sin título";

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

  /* --- Datos --- */
  async function cargar(forzar) {
    if (cargada && !forzar) return filas;
    const { data, error } = await (await cliente()).from("musica_fondos").select("id, ruta, archivo, titulo, duracion, bytes, creada").order("creada", { ascending: false });
    if (error) {
      sinTabla = /musica_fondos|relation|does not exist|schema cache/i.test(error.message || "");
      throw error;
    }
    sinTabla = false;
    filas = data || [];
    cargada = true;
    return filas;
  }
  const avisar = () => oyentes.forEach(f => { try { f(); } catch (e) { /* un oyente roto no frena a los demás */ } });

  const lista = () => filas.slice();
  const nombreDe = ruta => { const f = filas.find(x => x.ruta === ruta); return f ? f.titulo : ""; };

  async function subirBlob(blob, nombreArchivo, titulo, tipo) {
    const ext = extension(nombreArchivo, tipo || blob.type);
    if (!ext) throw new Error("Formato de audio no válido (usa mp3, ogg, wav, m4a, aac o flac).");
    if (blob.size > MAX_BYTES) throw new Error(`Pesa ${mb(blob.size)} MB y el máximo es 30.`);
    const sb = await cliente();
    const archivo = `${Date.now().toString(36)}-${limpio(titulo || tituloDe(nombreArchivo))}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(archivo, blob, { contentType: TIPOS[ext], cacheControl: "31536000" });
    if (error) throw error;
    const ruta = sb.storage.from(BUCKET).getPublicUrl(archivo).data.publicUrl;
    const duracion = await medirDuracion(blob);
    const fila = { ruta, archivo, titulo: (titulo || tituloDe(nombreArchivo)).slice(0, 120), duracion: duracion || null, bytes: blob.size };
    const { data, error: e2 } = await sb.from("musica_fondos").insert(fila).select("id, ruta, archivo, titulo, duracion, bytes, creada").single();
    if (e2) { await sb.storage.from(BUCKET).remove([archivo]); throw e2; }
    filas.unshift(data);
    cargada = true;
    return data;
  }

  async function renombrar(id, titulo) {
    const t = String(titulo || "").trim().slice(0, 120);
    if (!t) throw new Error("El nombre no puede quedar vacío.");
    const { error } = await (await cliente()).from("musica_fondos").update({ titulo: t }).eq("id", id);
    if (error) throw error;
    const f = filas.find(x => x.id === id);
    if (f) f.titulo = t;
  }

  async function borrar(fila) {
    const sb = await cliente();
    const { error } = await sb.from("musica_fondos").delete().eq("id", fila.id);
    if (error) throw error;
    try { await sb.storage.from(BUCKET).remove([fila.archivo]); } catch (e) { /* queda huérfano, no pasa nada */ }
    filas = filas.filter(x => x.id !== fila.id);
  }

  /* Páginas (nombres de archivo) cuyas listas usan esta canción, según lo último que se sabe en este navegador */
  function paginasQueLaUsan(ruta) {
    let todo = {};
    try { todo = JSON.parse(localStorage.getItem("musicaPaginasCfg") || "{}") || {}; } catch (e) { todo = {}; }
    return Object.keys(todo).filter(p => {
      const c = todo[p] || {};
      return (c.lista || []).includes(ruta) || ((c.partida || {}).lista || []).includes(ruta);
    });
  }

  /* Baja una canción de otro sitio (la Rocola pública, un archivo del sitio) y la guarda en la biblioteca */
  async function copiarDesde(url, titulo) {
    const r = await fetch(encodeURI(decodeURI(url)));
    if (!r.ok) throw new Error(`No se pudo bajar la canción (${r.status}).`);
    const blob = await r.blob();
    const nombre = decodeURIComponent(url.split("?")[0].split("/").pop() || "cancion.mp3");
    return subirBlob(blob, nombre, titulo || tituloDe(nombre), blob.type && blob.type.startsWith("audio/") ? blob.type : "");
  }

  function pararPrevia() {
    if (previa) { previa.pause(); previa = null; }
    previaRuta = "";
  }

  /* --- Interfaz --- */
  function montar(el, opciones) {
    opciones = opciones || {};
    const alCambiar = opciones.alCambiar || (() => {});
    let estadoTexto = "", estadoError = false, ocupado = false;

    function decir(t, error) {
      estadoTexto = t || ""; estadoError = !!error;
      const e = el.querySelector(".mf-estado");
      if (e) { e.textContent = estadoTexto; e.classList.toggle("mf-error", estadoError); }
    }

    function pintar() {
      const total = filas.reduce((a, f) => a + (Number(f.bytes) || 0), 0);
      el.classList.add("mf");
      el.innerHTML = `
        <div class="mf-barra">
          <label class="mf-subir">+ Subir canciones <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac,.flac" multiple hidden></label>
          <span class="mf-uso">${filas.length ? `${filas.length} canción${filas.length === 1 ? "" : "es"}, ${mb(total)} MB (el plan gratuito de Supabase da unos 1000 MB para todo)` : ""}</span>
        </div>
        <p class="mf-estado" role="status"></p>
        <ul class="mf-lista">${filas.map(f => `
          <li data-id="${esc(f.id)}">
            <button type="button" class="mf-prev${previaRuta === f.ruta ? " sonando" : ""}" data-mf="prev" aria-label="Escuchar">${previaRuta === f.ruta ? "❚❚" : "▶"}</button>
            <span class="mf-nombre" title="${esc(f.archivo)}">${esc(f.titulo)} <small>${esc(minutos(Number(f.duracion)))}${f.bytes ? ` · ${mb(f.bytes)} MB` : ""}</small></span>
            <button type="button" data-mf="renombra">Renombrar</button>
            <button type="button" class="mf-peligro" data-mf="borra">Borrar</button>
          </li>`).join("") || `<li class="mf-vacia">${sinTabla ? "Falta correr docs/admin/musica_fondos.sql en Supabase." : "Todavía no hay canciones. Sube las que quieras para la música de las páginas."}</li>`}</ul>`;
      decir(estadoTexto, estadoError);
    }

    async function subir(archivos) {
      if (ocupado) return;
      ocupado = true;
      let hechas = 0;
      try {
        for (const a of Array.from(archivos)) {
          if (!extension(a.name, a.type)) { decir(`«${a.name}» no es un audio válido.`, true); continue; }
          if (a.size > MAX_BYTES) { decir(`«${a.name}» pesa ${mb(a.size)} MB y el máximo es 30.`, true); continue; }
          decir(`Subiendo ${a.name}...`);
          await subirBlob(a, a.name, tituloDe(a.name), a.type);
          hechas++;
          pintar();
        }
        if (hechas) { decir(`${hechas} canción${hechas === 1 ? "" : "es"} subida${hechas === 1 ? "" : "s"}.`); alCambiar(); avisar(); }
      } catch (e) {
        decir(`No se pudo subir: ${e.message || e}. ¿Corriste docs/admin/musica_fondos.sql y tienes la sesión de admin iniciada?`, true);
      } finally { ocupado = false; }
    }

    el.addEventListener("change", ev => {
      if (ev.target.matches('input[type="file"]')) { if (ev.target.files.length) subir(ev.target.files); ev.target.value = ""; }
    });
    el.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-mf]");
      if (!b) return;
      const li = b.closest("li[data-id]");
      const fila = li && filas.find(f => f.id === li.dataset.id);
      if (!fila) return;
      if (b.dataset.mf === "prev") {
        const sonaba = previaRuta === fila.ruta;
        pararPrevia();
        if (!sonaba) {
          previa = new Audio(fila.ruta); previaRuta = fila.ruta; previa.volume = 0.6;
          previa.play().catch(() => { decir("No se pudo reproducir esa canción.", true); pararPrevia(); pintar(); });
          previa.addEventListener("ended", () => { pararPrevia(); pintar(); });
        }
        pintar();
      } else if (b.dataset.mf === "renombra") {
        const t = prompt("Nombre de la canción:", fila.titulo);
        if (t == null || t.trim() === fila.titulo) return;
        try { await renombrar(fila.id, t); pintar(); decir("Nombre cambiado."); alCambiar(); avisar(); } catch (e) { decir(`No se pudo renombrar: ${e.message || e}`, true); }
      } else if (b.dataset.mf === "borra") {
        const usan = paginasQueLaUsan(fila.ruta);
        const aviso = usan.length ? `\n\nHoy la usan: ${usan.join(", ")}. Dejará de sonar allí (la lista salta a la siguiente canción).` : "";
        if (!confirm(`¿Borrar «${fila.titulo}» de la rocola de fondos?${aviso}`)) return;
        pararPrevia();
        try { await borrar(fila); pintar(); decir("Canción borrada."); alCambiar(); avisar(); } catch (e) { decir(`No se pudo borrar: ${e.message || e}`, true); }
      }
    });

    pintar();
    decir("Leyendo la biblioteca...");
    cargar(true).then(() => { pintar(); decir(""); alCambiar(); }).catch(e => {
      pintar();
      decir(sinTabla ? "Falta correr docs/admin/musica_fondos.sql en Supabase." : `No se pudo leer la biblioteca: ${e.message || e}`, true);
    });
    return { pintar, parar: pararPrevia };
  }

  /* Pestaña "Música de fondo" del panel de Admin (se monta la primera vez que se abre) */
  function iniciarAdmin() {
    const panel = document.getElementById("adminMusicaFondos");
    const pestana = document.querySelector('[data-tab="musicafondos"]');
    if (!panel || !pestana) return;
    let hecho = false;
    pestana.addEventListener("click", () => { if (!hecho) { hecho = true; montar(panel); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarAdmin); else iniciarAdmin();

  return { montar, cargar, lista, nombreDe, subirBlob, copiarDesde, paginasQueLaUsan, alCambiar: f => { oyentes.add(f); return () => oyentes.delete(f); }, parar: pararPrevia };
})();
