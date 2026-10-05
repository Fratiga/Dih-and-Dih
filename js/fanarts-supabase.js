/* =============================================================================
   REPARTO DE FANARTS POR SIDE. Reusa fichasCliente() (mismo proyecto de
   Supabase que Mis Personajes/Admin) para no duplicar la conexión.

   Sin fila en fanarts_side para un src = compartido, lo ve todo el
   mundo (comportamiento de siempre). Con fila: solo ese Side (y Admin,
   que siempre ve todo — ver esAdmin() en js/lado.js). Requiere
   scratchpad/fanarts_side.sql.
============================================================================= */
async function fanartsCargarSides() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.from("fanarts_side").select("src, side");
  if (error) throw error;
  const mapa = {};
  (data || []).forEach(f => { mapa[f.src] = f.side; });
  return mapa;
}

/* Fanarts eliminados desde Admin: se ocultan para todos (el archivo
   sigue en el repo). Requiere scratchpad/fanarts_ocultos.sql. */
async function fanartsCargarOcultos() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.from("fanarts_ocultos").select("src");
  if (error) throw error;
  return new Set((data || []).map(f => f.src));
}

async function fanartsAdminSetOculto(src, oculto) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("fanarts_admin_set_oculto", { p_src: src, p_oculto: oculto });
  if (error) throw error;
}

/* p_side: "A", "B", o null (para volver a "compartido"). Falla del
   lado del servidor si quien llama no es Admin (fanarts_admin_set_side
   revisa fichas_es_admin() antes de tocar la tabla). */
async function fanartsAdminSetSide(src, side) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("fanarts_admin_set_side", { p_src: src, p_side: side });
  if (error) throw error;
}

/* Fanarts subidos desde el panel de Admin (viven en el bucket "fanarts" de
   Supabase Storage y en la tabla fanarts_subidos, ver scratchpad/fanarts_subidos.sql).
   Devuelve las rutas (URLs) y deja los nombres bonitos en window.FANARTS_NOMBRES
   para que prettyName() los use. Los más nuevos van primero. */
async function fanartsCargarSubidos() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.from("fanarts_subidos").select("src, nombre").order("creada", { ascending: false });
  if (error) throw error;
  window.FANARTS_NOMBRES = window.FANARTS_NOMBRES || {};
  (data || []).forEach(f => { window.FANARTS_NOMBRES[f.src] = f.nombre; });
  return (data || []).map(f => f.src);
}

/* Sube una imagen (solo Admin: lo revisan las políticas del bucket y de la tabla).
   side: "A", "B" o null (compartido). Devuelve la URL pública. */
async function fanartsAdminSubir(archivo, side) {
  const supabase = await fichasCliente();
  const limpio = archivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "fanart.png";
  const ruta = `${crypto.randomUUID()}/${limpio}`;
  const { error: errSubida } = await supabase.storage.from("fanarts")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false, cacheControl: "31536000" });
  if (errSubida) throw errSubida;
  const src = `${window.FICHAS_SUPABASE_URL}/storage/v1/object/public/fanarts/${ruta}`;
  const nombre = archivo.name.replace(/\.[^.]+$/, "").replace(/_+/g, " ").trim().slice(0, 140) || "Fanart";
  const { error: errFila } = await supabase.from("fanarts_subidos").insert({ src, nombre, ruta });
  if (errFila) {
    await supabase.storage.from("fanarts").remove([ruta]);
    throw errFila;
  }
  if (side) await fanartsAdminSetSide(src, side);
  return src;
}
