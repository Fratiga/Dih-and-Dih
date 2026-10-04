/* =============================================================================
   CARTAS MALDITAS — lado cliente. Lee la colección del jugador y pide las
   recompensas de los minijuegos. Quien decide qué carta cae es el servidor
   (scratchpad/cartas.sql); acá solo se avisa de lo que pasó y se muestra el
   resultado. Requiere js/cartas-datos.js y js/fichas-supabase.js.
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

  /* Aviso flotante al ganar una carta. */
  function avisar(carta, nueva, cantidad) {
    let caja = document.getElementById("cartaAviso");
    if (!caja) {
      caja = document.createElement("a");
      caja.id = "cartaAviso";
      caja.href = "cartas.html";
      document.body.appendChild(caja);
    }
    const rareza = window.CARTAS_RAREZAS[carta.rareza];
    caja.className = `carta-aviso carta-rareza-${carta.rareza}`;
    caja.innerHTML = `<small>${nueva ? "Carta nueva" : `Repetida (x${cantidad})`}</small><strong></strong><span>${rareza.nombre} · ver en el álbum</span>`;
    caja.querySelector("strong").textContent = carta.nombre;
    requestAnimationFrame(() => caja.classList.add("visible"));
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => caja.classList.remove("visible"), 7000);
  }

  /* Pide una carta por lo ocurrido en un minijuego. Devuelve la carta o null. */
  async function recompensar(juego, clave, resultado, logro = 0) {
    if (!(await sesion())) return null;
    try {
      const supabase = await fichasCliente();
      const { data, error } = await supabase.rpc("cartas_recompensa", {
        p_juego: juego, p_clave: clave, p_resultado: resultado, p_logro: Math.max(0, Math.round(logro))
      });
      if (error) throw error;
      if (!data || !data.carta) return null;
      const carta = window.cartaPorId(data.carta);
      if (carta) avisar(carta, data.nueva, data.cantidad);
      return carta;
    } catch (e) {
      return null; // si el servidor no tiene las cartas todavía, el juego sigue sin avisos
    }
  }

  return { visible, coleccion, recompensar, sesion };
})();
