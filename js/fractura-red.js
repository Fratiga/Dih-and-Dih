/* =============================================================================
   LA FRACTURA: guardado y servidor. El ejército se guarda siempre en este navegador (así se puede
   jugar sin cuenta) y, con la sesión iniciada, también en el servidor (tabla fractura_ejercitos).
   Si el servidor tiene una copia más reciente que la local, manda el servidor.
   La guerra en curso se guarda solo en el navegador para poder retomarla al recargar.
   Las guerras terminadas van a la historia del mundo (fractura_guerras) y de ahí salen los premios.
   Necesita js/fichas-supabase.js para hablar con el servidor.
============================================================================= */
window.FracturaRed = (function () {
  const CLAVE_EJ = faccion => `fracturaEjercito:${faccion}`;
  const CLAVE_GUERRA = "fracturaGuerraEnCurso";

  const leer = clave => { try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch (e) { return null; } };
  const escribir = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)); return true; } catch (e) { return false; } };

  async function sesion() {
    try { return typeof fichasSesionActual === "function" ? await fichasSesionActual() : null; } catch (e) { return null; }
  }
  async function cliente() { return typeof fichasCliente === "function" ? fichasCliente() : null; }

  /* Facciones que ya tienen ejército (aquí o en el servidor) */
  async function listarEjercitos(faccionesIds) {
    const out = {};
    faccionesIds.forEach(f => { const e = leer(CLAVE_EJ(f)); if (e) out[f] = { origen: "local", ej: e }; });
    const s = await sesion();
    if (s) {
      try {
        const sb = await cliente();
        const { data } = await sb.from("fractura_ejercitos").select("faccion, data, actualizado").eq("user_id", s.user.id);
        (data || []).forEach(f => {
          const local = out[f.faccion] && out[f.faccion].ej;
          const servidor = f.data;
          // Manda la copia con más guerras (y la del servidor si empatan)
          if (!local || (servidor.guerras || 0) >= (local.guerras || 0)) { out[f.faccion] = { origen: "servidor", ej: servidor }; escribir(CLAVE_EJ(f.faccion), servidor); }
        });
      } catch (e) { /* sin tabla o sin conexión: se queda lo local */ }
    }
    return out;
  }

  let pendiente = null;
  async function guardarEjercito(ej) {
    escribir(CLAVE_EJ(ej.faccion), ej);
    const s = await sesion();
    if (!s) return { local: true, servidor: false };
    clearTimeout(pendiente);
    return new Promise(res => {
      pendiente = setTimeout(async () => {
        try {
          const sb = await cliente();
          const { error } = await sb.from("fractura_ejercitos").upsert({ user_id: s.user.id, faccion: ej.faccion, data: ej, actualizado: new Date().toISOString() });
          res({ local: true, servidor: !error, error: error && error.message });
        } catch (e) { res({ local: true, servidor: false, error: e.message }); }
      }, 600);
    });
  }

  async function borrarEjercito(faccion) {
    try { localStorage.removeItem(CLAVE_EJ(faccion)); } catch (e) { /* sin almacenamiento */ }
    const s = await sesion();
    if (s) { try { const sb = await cliente(); await sb.from("fractura_ejercitos").delete().eq("user_id", s.user.id).eq("faccion", faccion); } catch (e) { /* nada */ } }
  }

  const guardarGuerra = (est, cfgMin) => escribir(CLAVE_GUERRA, { est, cfg: cfgMin });
  const cargarGuerra = () => leer(CLAVE_GUERRA);
  const borrarGuerra = () => { try { localStorage.removeItem(CLAVE_GUERRA); } catch (e) { /* nada */ } };

  /* Historia del mundo y premios */
  async function registrarGuerra(reg) {
    const s = await sesion();
    if (!s) return null;
    try {
      const sb = await cliente();
      const { data, error } = await sb.rpc("fractura_registrar_guerra", { p: reg });
      if (error) throw error;
      return data;
    } catch (e) { return null; }
  }
  async function pedirPremio(guerraId) {
    const sb = await cliente();
    const { data, error } = await sb.rpc("fractura_recompensa", { p_guerra: guerraId });
    if (error) throw error;
    return data;
  }
  async function historiaDelMundo(limite) {
    const s = await sesion();
    if (!s) return [];
    try {
      const sb = await cliente();
      const { data } = await sb.from("fractura_guerras").select("id, jugador, ejercito, faccion, rival, tipo, resultado, turnos, razon, bajas, logros, titulo, cronica, anio, creada").order("creada", { ascending: false }).limit(limite || 200);
      return data || [];
    } catch (e) { return []; }
  }

  /* --- Guerras entre jugadores --- */
  async function pvpJugadores() {
    const sb = await cliente();
    const { data, error } = await sb.rpc("cartas_jugadores");
    if (error) throw error;
    return data || [];
  }
  async function pvpListar() {
    const sb = await cliente();
    const { data, error } = await sb.from("fractura_partidas").select("id, j1, j2, nombre1, nombre2, estado, activo, ganador, razon, actualizada, tipo:config->>tipo, f1:config->jugadores->0->>faccion, f2:config->jugadores->1->>faccion").order("actualizada", { ascending: false }).limit(30);
    if (error) throw error;
    return data || [];
  }
  async function pvpGet(id) {
    const sb = await cliente();
    const { data, error } = await sb.from("fractura_partidas").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }
  async function pvpRpc(nombre, args) {
    const sb = await cliente();
    const { data, error } = await sb.rpc(nombre, args);
    if (error) throw error;
    return data;
  }
  const pvpRetar = (rival, config) => pvpRpc("fractura_retar", { p_rival: rival, p_config: config });
  const pvpResponder = (id, aceptar, jug) => pvpRpc("fractura_responder", { p_id: id, p_aceptar: aceptar, p_jug: jug });
  const pvpTurno = (id, n, acciones) => pvpRpc("fractura_turno", { p_id: id, p_n: n, p_acciones: acciones });
  const pvpTerminar = (id, ganador, razon) => pvpRpc("fractura_terminar", { p_id: id, p_ganador: String(ganador), p_razon: razon || "" });
  const pvpRendirse = id => pvpRpc("fractura_rendirse", { p_id: id });

  return { pvpJugadores, pvpListar, pvpGet, pvpRetar, pvpResponder, pvpTurno, pvpTerminar, pvpRendirse, listarEjercitos, guardarEjercito, borrarEjercito, guardarGuerra, cargarGuerra, borrarGuerra, registrarGuerra, pedirPremio, historiaDelMundo, sesion };
})();
