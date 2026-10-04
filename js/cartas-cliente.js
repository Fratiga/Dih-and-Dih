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

  return { visible, coleccion, sesion };
})();
