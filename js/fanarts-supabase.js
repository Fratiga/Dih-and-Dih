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
