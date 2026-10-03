/* Muerte Súbita: acceso a Supabase. Requiere scratchpad/muerte_subita.sql.
   Usa el mismo cliente que Mis personajes (fichasCliente). */
async function msIniciar(desafio, personajeId, personajeNombre) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.rpc("ms_iniciar", {
    p_desafio: desafio, p_personaje_id: personajeId, p_personaje_nombre: personajeNombre
  });
  if (error) throw error;
  return data;
}

async function msFinalizar(idIntento, puntaje, puntajeRival) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.rpc("ms_finalizar", {
    p_id: idIntento, p_puntaje: puntaje, p_puntaje_rival: puntajeRival
  });
  if (error) throw error;
  return data;
}

/* Intentos visibles para quien llama: los suyos, o todos si es Admin. */
async function msListarIntentos() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase
    .from("muerte_subita_intentos")
    .select("id, username, personaje_id, personaje_nombre, desafio, estado, puntaje, puntaje_rival, veredicto, creado_en, cerrado_en")
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function msAdminResolver(idIntento, accion) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("ms_admin_resolver", { p_id: idIntento, p_accion: accion });
  if (error) throw error;
}
