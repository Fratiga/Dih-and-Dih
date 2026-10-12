/* Apuestas de cartas en los duelos de Triunfos (lobby de batalla.html).
   Elegir qué copias apostar y mostrar lo apostado. Las reglas las aplica el servidor
   (scratchpad/economia_4_apuestas.sql); aquí solo se escoge y se muestra. docs/economia-de-cartas.md, sección 9. */
window.BatallaApuestas = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ORDEN = { comun: 1, infrecuente: 2, rara: 3, legendaria: 4, limitada: 4 };
  const nombreRareza = r => (window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r] ? window.CARTAS_RAREZAS[r].nombre : r);
  const nombreCarta = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };

  /* Lista de copias libres del jugador (estado "poseida"): las que se pueden apostar */
  async function copiasLibres() {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.from("cartas_ejemplares").select("id, carta_id, numero, estado").eq("estado", "poseida");
    if (error) throw error;
    return (data || []).map(e => {
      const c = window.cartaPorId && window.cartaPorId(e.carta_id);
      return { id: e.id, carta: e.carta_id, numero: e.numero, nombre: c ? c.nombre : e.carta_id, rareza: c ? c.rareza : "comun" };
    }).sort((a, b) => (ORDEN[b.rareza] - ORDEN[a.rareza]) || a.nombre.localeCompare(b.nombre, "es") || a.numero - b.numero);
  }

  /* Abre el selector. cantidad: número exacto de cartas (al aceptar un reto) o null (de 1 a 5, al retar).
     contra: lo que apuesta el rival, para que se vea. Devuelve la lista de ids o null si se cancela. */
  async function elegir({ cantidad, titulo, contra }) {
    let copias;
    try { copias = await copiasLibres(); } catch (e) { return { error: "No se pudieron leer tus cartas. ¿Corriste economia_1_nucleo.sql?" }; }
    if (!copias.length) return { error: "No tienes cartas libres para apostar." };
    return new Promise(resolver => {
      const dlg = document.createElement("dialog");
      dlg.className = "ba-dialogo";
      const max = cantidad || 5;
      const elegidas = new Set();
      dlg.innerHTML = `
        <h2>${esc(titulo || "Elige tu apuesta")}</h2>
        ${contra && contra.length ? `<p class="ba-contra">Tu rival apuesta: ${contra.map(c => `<b>${esc(c.nombre)}</b> (${esc(nombreRareza(c.rareza))})`).join(", ")}.</p>` : ""}
        <p class="ba-ayuda">${cantidad ? `Tienes que elegir exactamente ${cantidad} carta${cantidad === 1 ? "" : "s"}, de rareza parecida a las de tu rival (cada pareja, ordenadas de mayor a menor, como mucho una categoría de diferencia).` : "Elige de 1 a 5 cartas. Quedan bloqueadas hasta que termine el reto. Quien gana se lleva las de los dos; si hay empate cada uno recupera las suyas."}</p>
        <ul class="ba-lista">${copias.map(c => `
          <li><label><input type="checkbox" data-id="${esc(c.id)}"> <span class="ba-nombre">${esc(c.nombre)}</span>
            <small>${esc(nombreRareza(c.rareza))} · copia ${c.numero}</small></label></li>`).join("")}</ul>
        <p class="ba-cuenta" role="status"></p>
        <div class="ba-botones"><button type="button" class="cartas-boton cartas-boton-principal" data-ok>Confirmar</button>
          <button type="button" class="cartas-boton" data-no>Cancelar</button></div>`;
      document.body.appendChild(dlg);
      const cuenta = dlg.querySelector(".ba-cuenta"), ok = dlg.querySelector("[data-ok]");
      const pintar = () => {
        cuenta.textContent = `Elegidas: ${elegidas.size}${cantidad ? ` de ${cantidad}` : " (máximo 5)"}`;
        ok.disabled = cantidad ? elegidas.size !== cantidad : elegidas.size < 1;
        dlg.querySelectorAll("input[type=checkbox]").forEach(i => { i.disabled = !i.checked && elegidas.size >= max; });
      };
      dlg.addEventListener("change", ev => {
        const i = ev.target.closest("input[data-id]");
        if (!i) return;
        if (i.checked) elegidas.add(i.dataset.id); else elegidas.delete(i.dataset.id);
        pintar();
      });
      const cerrar = valor => { dlg.close(); dlg.remove(); resolver(valor); };
      ok.addEventListener("click", () => cerrar({ ids: [...elegidas], copias: copias.filter(c => elegidas.has(c.id)) }));
      dlg.querySelector("[data-no]").addEventListener("click", () => cerrar(null));
      dlg.addEventListener("cancel", ev => { ev.preventDefault(); cerrar(null); });
      pintar();
      dlg.showModal();
    });
  }

  /* Texto corto de una apuesta guardada en la partida (apuesta1_info / apuesta2_info) */
  function texto(info) {
    return (info || []).map(c => `${esc(c.nombre)} (${esc(nombreRareza(c.rareza))})`).join(", ");
  }

  return { elegir, texto, copiasLibres };
})();
