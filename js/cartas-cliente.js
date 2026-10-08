/* =============================================================================
   CARTAS MALDITAS — lado cliente. Lee la colección del jugador. Las cartas
   las entrega el servidor (scratchpad/cartas.sql); las recompensas de los
   minijuegos todavía no existen. Requiere js/cartas-datos.js y js/fichas-supabase.js.
============================================================================= */
window.CartasCliente = (function () {
  /* ¿Puede ver este jugador esta carta? Mismo criterio que las entradas. */
  function visible(carta) {
    if (typeof esAdmin === "function" && esAdmin()) return true;
    if (!carta.lado) return true;
    const lado = typeof ladoActual === "function" ? ladoActual() : null;
    return !!lado && carta.lado.includes(lado);
  }

  async function sesion() {
    try { return await fichasSesionActual(); } catch (e) { return null; }
  }

  /* { cartas: Map(id -> cantidad), numeros: Map(id -> [n,...]) } de la sesión actual. */
  async function coleccion() {
    const s = await sesion();
    if (!s) return null;
    const supabase = await fichasCliente();
    const [col, num] = await Promise.all([
      supabase.from("cartas_coleccion").select("carta_id, cantidad").eq("user_id", s.user.id),
      supabase.from("cartas_numeradas").select("carta_id, numero").eq("user_id", s.user.id)
    ]);
    if (col.error) throw col.error;
    const cartas = new Map((col.data || []).map(f => [f.carta_id, f.cantidad]));
    const numeros = new Map();
    (num.data || []).forEach(f => numeros.set(f.carta_id, [...(numeros.get(f.carta_id) || []), f.numero].sort((a, b) => a - b)));
    return { cartas, numeros };
  }

  /* --- Rol de editor ---------------------------------------------------- */
  const CLAVE_EDITOR = "compendioCartasEditor";

  /* Lo que ya se sabe sin preguntar al servidor (para mostrar u ocultar enseguida). */
  function editorCacheado() {
    try { return localStorage.getItem("compendioAdmin") === "1" || localStorage.getItem(CLAVE_EDITOR) === "1"; } catch (e) { return false; }
  }

  /* Pregunta al servidor: { admin, editor, puede }. Sin sesión devuelve que no. */
  async function verificarRol() {
    try {
      if (!(await sesion())) return { admin: false, editor: false, puede: false };
      const supabase = await fichasCliente();
      const [a, e] = await Promise.all([supabase.rpc("fichas_es_admin"), supabase.rpc("cartas_es_editor")]);
      const admin = !!a.data;
      const editor = !!e.data;
      try { localStorage.setItem(CLAVE_EDITOR, editor ? "1" : "0"); } catch (err) { /* sin almacenamiento */ }
      return { admin, editor, puede: admin || editor };
    } catch (err) {
      return { admin: false, editor: false, puede: false };
    }
  }

  /* --- Definiciones guardadas en el servidor ------------------------------ */
  const CAMPOS = ["nombre", "epiteto", "tipo", "rareza", "afinidad", "coste", "atq", "pv", "habilidad", "descripcion", "imagen", "ajuste", "fuente", "lado", "obtenible", "limite"];
  const VACIA = { epiteto: "", atq: null, pv: null, habilidad: "", descripcion: "", imagen: null, ajuste: null, fuente: null, lado: null, obtenible: true, limite: null };

  /* Mezcla lo guardado en el servidor con el catálogo base de cartas-datos.js:
     una definición reemplaza a la carta con su id, o la crea si es nueva. Las
     cartas despublicadas se quitan salvo para quien edita (que las ve con
     borrador: true). Devuelve false si el servidor todavía no tiene las tablas. */
  async function cargarDefiniciones(puedeEditar) {
    try {
      const supabase = await fichasCliente();
      const [defs, cat] = await Promise.all([
        supabase.from("cartas_definiciones").select("id, data"),
        supabase.from("cartas_catalogo").select("id, publicada")
      ]);
      if (defs.error || cat.error) return false;
      const lista = window.CARTAS;
      (defs.data || []).forEach(f => {
        const i = lista.findIndex(c => c.id === f.id);
        const base = i >= 0 ? lista[i] : { id: f.id, fuente: null };
        const nueva = Object.assign({}, VACIA, base, { id: f.id });
        CAMPOS.forEach(k => { if (f.data[k] !== undefined) nueva[k] = f.data[k]; });
        nueva.nuevaEnServidor = i < 0;
        if (i >= 0) lista[i] = nueva; else lista.push(nueva);
      });
      const publicada = new Map((cat.data || []).map(f => [f.id, f.publicada]));
      for (let i = lista.length - 1; i >= 0; i--) {
        if (publicada.get(lista[i].id) === false) {
          if (puedeEditar) lista[i].borrador = true; else lista.splice(i, 1);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Guarda una carta entera. datos: los campos de CAMPOS. */
  async function guardar(id, datos, publicada) {
    const supabase = await fichasCliente();
    const limpio = {};
    CAMPOS.forEach(k => { limpio[k] = datos[k] === undefined ? null : datos[k]; });
    const { error } = await supabase.rpc("cartas_guardar", { p_id: id, p_data: limpio, p_publicada: !!publicada });
    if (error) throw error;
  }

  async function borrar(id) {
    const supabase = await fichasCliente();
    const { error } = await supabase.rpc("cartas_borrar", { p_id: id });
    if (error) throw error;
  }

  /* --- Fotos -------------------------------------------------------------- */
  const MARCA_BUCKET = "/storage/v1/object/public/cartas/";

  /* Reduce la foto (lado largo de 1000 como máximo) y la pasa a WebP, sin recortarla:
     el encuadre se guarda aparte (ajuste) y se puede cambiar cuando quieras. */
  function prepararImagen(archivo) {
    return new Promise((resolver, rechazar) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const reduccion = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * reduccion));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * reduccion));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolver(b) : rechazar(new Error("No se pudo preparar la imagen")), "image/webp", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("No se pudo leer esa imagen")); };
      img.src = url;
    });
  }

  /* Sube la foto al bucket y devuelve su URL pública. */
  async function subirImagen(archivo) {
    const blob = await prepararImagen(archivo);
    const supabase = await fichasCliente();
    const ruta = `${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from("cartas").upload(ruta, blob, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (error) throw error;
    return `${window.FICHAS_SUPABASE_URL}${MARCA_BUCKET}${ruta}`;
  }

  /* Borra del bucket una foto que ya no se usa (si no se puede, queda huérfana y no pasa nada). */
  async function quitarImagen(url) {
    try {
      const i = String(url || "").indexOf(MARCA_BUCKET);
      if (i < 0) return;
      const supabase = await fichasCliente();
      await supabase.storage.from("cartas").remove([decodeURIComponent(url.slice(i + MARCA_BUCKET.length))]);
    } catch (e) { /* queda huérfana */ }
  }

  /* --- Mazos ------------------------------------------------------------- */
  /* Mazos del jugador: [{ id, nombre, cartas: { cartaId: copias } }] */
  async function listarMazos() {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.from("cartas_mazos").select("id, nombre, cartas, actualizado").order("actualizado", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function guardarMazo(id, nombre, cartas) {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.rpc("cartas_guardar_mazo", { p_id: id || null, p_nombre: nombre, p_cartas: cartas });
    if (error) throw error;
    return data;
  }

  async function borrarMazo(id) {
    const supabase = await fichasCliente();
    const { error } = await supabase.rpc("cartas_borrar_mazo", { p_id: id });
    if (error) throw error;
  }

  /* Copia de los datos de las cartas de un mazo, para guardarla en la partida y que los dos
     jugadores vean lo mismo aunque después se edite una carta. */
  function instantanea(ids) {
    const out = {};
    [...new Set(ids)].forEach(id => {
      const c = window.cartaPorId(id);
      if (!c) return;
      out[id] = {
        id, nombre: c.nombre, epiteto: c.epiteto || "", tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad,
        coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "",
        imagen: c.imagen || null, ajuste: c.ajuste || null
      };
    });
    return out;
  }

  /* Pasa { cartaId: copias } a la lista de ids repetidos */
  const aplanar = cuenta => Object.entries(cuenta).flatMap(([id, n]) => Array(n).fill(id));

  return { visible, coleccion, sesion, editorCacheado, verificarRol, cargarDefiniciones, guardar, borrar, subirImagen, quitarImagen, listarMazos, guardarMazo, borrarMazo, instantanea, aplanar };
})();
