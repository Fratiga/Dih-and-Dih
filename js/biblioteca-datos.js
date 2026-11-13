/* Biblioteca de los jugadores: acceso a datos (tabla biblioteca_entradas y bucket privado "biblioteca",
   ver docs/admin/biblioteca.sql). Lo usan biblioteca.html y la ficha (para enlazar la clase y la raza). */
(function () {
  const TIPOS = { clase: "Clase", subclase: "Subclase", raza: "Raza", otro: "Otra regla" };
  const CAMPOS_LISTA = "id, tipo, nombre, fuente, resumen, autor, autor_nombre, actualizada";

  async function cliente() { return fichasCliente(); }
  function ok({ data, error }) { if (error) throw error; return data; }

  async function listar() {
    const sb = await cliente();
    return ok(await sb.from("biblioteca_entradas").select(CAMPOS_LISTA).order("nombre"));
  }
  async function obtener(id) {
    const sb = await cliente();
    return ok(await sb.from("biblioteca_entradas").select("*").eq("id", id).maybeSingle());
  }
  async function guardar(e) {
    const sb = await cliente();
    const fila = { tipo: e.tipo, nombre: e.nombre, fuente: e.fuente || "", resumen: e.resumen || "", contenido: limpiarHtml(e.contenido || ""), tabla: e.tabla || { columnas: [], filas: [] }, archivos: e.archivos || [] };
    if (e.id) return ok(await sb.from("biblioteca_entradas").update(fila).eq("id", e.id).select().single());
    return ok(await sb.from("biblioteca_entradas").insert(fila).select().single());
  }
  async function borrar(e) {
    const sb = await cliente();
    const rutas = (e.archivos || []).map(a => a.ruta).filter(Boolean);
    ok(await sb.from("biblioteca_entradas").delete().eq("id", e.id));
    if (rutas.length) await sb.storage.from("biblioteca").remove(rutas).catch(() => {});
  }
  const MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
  async function subir(archivo) {
    if (!MIME.includes(archivo.type)) throw new Error("Solo PDF o imágenes (PNG, JPG, WebP, GIF).");
    if (archivo.size > 20 * 1024 * 1024) throw new Error("El archivo pasa de 20 MB.");
    const sb = await cliente();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error("Inicia sesión para subir archivos.");
    const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
    const ruta = `${user.id}/${Date.now().toString(36)}-${limpio}`;
    ok(await sb.storage.from("biblioteca").upload(ruta, archivo, { contentType: archivo.type, upsert: false }));
    return { ruta, nombre: archivo.name.slice(0, 120), tipo: archivo.type, tam: archivo.size };
  }
  async function quitarArchivo(ruta) {
    const sb = await cliente();
    await sb.storage.from("biblioteca").remove([ruta]);
  }
  async function enlace(ruta) {
    const sb = await cliente();
    const d = ok(await sb.storage.from("biblioteca").createSignedUrl(ruta, 3600));
    return d.signedUrl;
  }
  async function esAdmin() {
    try { const sb = await cliente(); const { data } = await sb.rpc("fichas_es_admin"); return !!data; } catch (e) { return false; }
  }

  /* HTML permitido en el contenido: formato básico y tablas, sin atributos (nada de scripts, estilos ni enlaces raros). */
  const PERMITIDAS = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "H3", "H4", "UL", "OL", "LI", "BLOCKQUOTE", "HR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "SUB", "SUP"]);
  const CAMBIOS = { H1: "H3", H2: "H3", H5: "H4", H6: "H4", DIV: "P", SECTION: "P", ARTICLE: "P" };
  const QUITAR_CON_TODO = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "LINK", "META", "TITLE", "HEAD"]);
  function limpiarHtml(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const salida = document.createElement("div");
    function copiar(origen, destino) {
      origen.childNodes.forEach(n => {
        if (n.nodeType === 3) { destino.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName;
        if (QUITAR_CON_TODO.has(tag)) return;
        const final = CAMBIOS[tag] || tag;
        if (PERMITIDAS.has(final)) {
          const nuevo = document.createElement(final);
          copiar(n, nuevo);
          destino.appendChild(nuevo);
        } else copiar(n, destino);   // etiqueta no permitida: se queda solo su contenido
      });
    }
    copiar(doc.body, salida);
    return salida.innerHTML.replace(/(<p><\/p>)+/g, "").trim();
  }

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  /* Tabla de clase: se escribe o pega como texto (una fila por línea; columnas separadas por tabulador o por «|»).
     La primera línea son los títulos. Copiar una tabla de una web y pegarla aquí ya trae los tabuladores. */
  function textoATabla(texto) {
    const lineas = String(texto || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 60);
    if (!lineas.length) return { columnas: [], filas: [] };
    const sep = lineas.some(l => l.includes("\t")) ? "\t" : "|";
    const partir = l => l.replace(/^\|/, "").replace(/\|$/, "").split(sep).map(c => c.trim().slice(0, 200)).slice(0, 20);
    const filas = lineas.filter(l => !/^\|?\s*:?-{2,}/.test(l)).map(partir);   // salta la raya de las tablas en Markdown
    return { columnas: filas[0] || [], filas: filas.slice(1) };
  }
  function tablaATexto(t) {
    if (!t || !(t.columnas || []).length) return "";
    return [t.columnas].concat(t.filas || []).map(f => f.join("\t")).join("\n");
  }
  function tablaHtml(t, opciones) {
    if (!t || !(t.columnas || []).length) return "";
    const marcar = opciones && opciones.nivel;   // resalta la fila del nivel del personaje
    const n = t.columnas.length;
    const cuerpo = (t.filas || []).map(f => {
      const nivel = parseInt(f[0], 10);
      return `<tr${marcar && nivel === marcar ? ' class="bib-tabla-actual"' : ""}>${Array.from({ length: n }, (_, i) => `<td>${esc(f[i] || "")}</td>`).join("")}</tr>`;
    }).join("");
    return `<div class="bib-tabla-caja"><table class="bib-tabla"><thead><tr>${t.columnas.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${cuerpo}</tbody></table></div>`;
  }

  window.Biblioteca = { TIPOS, listar, obtener, guardar, borrar, subir, quitarArchivo, enlace, esAdmin, limpiarHtml, textoATabla, tablaATexto, tablaHtml, esc };
})();
