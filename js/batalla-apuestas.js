/* Selector de copias de cartas para las apuestas de los duelos (batalla.html) y para los intercambios, el mercader
   y la forja (intercambios.html). Las reglas las aplica siempre el servidor (scratchpad/economia_4_apuestas.sql y
   siguientes); aquí solo se escoge y se muestra. docs/economia-de-cartas.md. */
window.BatallaApuestas = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ORDEN = { comun: 1, infrecuente: 2, rara: 3, legendaria: 4, limitada: 4 };
  const nombreRareza = r => (window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r] ? window.CARTAS_RAREZAS[r].nombre : r);

  /* Lista de copias libres del jugador (estado "poseida"): las que se pueden apostar, cambiar o forjar */
  async function copiasLibres() {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.from("cartas_ejemplares").select("id, carta_id, numero, estado").eq("estado", "poseida");
    if (error) throw error;
    return (data || []).map(e => {
      const c = window.cartaPorId && window.cartaPorId(e.carta_id);
      return { id: e.id, carta: e.carta_id, numero: e.numero, nombre: c ? c.nombre : e.carta_id, rareza: c ? c.rareza : "comun", tipo: c ? c.tipo : "" };
    }).sort((a, b) => (ORDEN[b.rareza] - ORDEN[a.rareza]) || a.nombre.localeCompare(b.nombre, "es") || a.numero - b.numero);
  }

  /* Abre el selector. Opciones:
       cantidad  número exacto de cartas (al aceptar un reto), o null para elegir de 1 a max
       max       máximo de cartas (5 por defecto)
       titulo, contra (lo que apuesta el rival), ayuda (texto bajo el título)
       filtro    (copia) => boolean: solo se muestran las copias que lo cumplen
       validar   (copiasElegidas) => { ok, texto }: sustituye a la regla de la cantidad
     Devuelve { ids, copias }, null si se cancela o { error } si no se pudo. */
  async function elegir(op) {
    const { cantidad, titulo, contra, ayuda, filtro, validar } = op;
    let copias;
    try { copias = await copiasLibres(); } catch (e) { return { error: "No se pudieron leer tus cartas. ¿Corriste economia_1_nucleo.sql?" }; }
    if (filtro) copias = copias.filter(filtro);
    if (!copias.length) return { error: filtro ? "No tienes cartas libres que sirvan para esto." : "No tienes cartas libres para apostar." };
    return new Promise(resolver => {
      const dlg = document.createElement("dialog");
      dlg.className = "ba-dialogo";
      const max = cantidad || op.max || 5;
      const elegidas = new Set();
      const textoAyuda = ayuda || (cantidad
        ? `Tienes que elegir exactamente ${cantidad} carta${cantidad === 1 ? "" : "s"}, de rareza parecida a las de tu rival (cada pareja, ordenadas de mayor a menor, como mucho una categoría de diferencia).`
        : "Elige de 1 a 5 cartas. Quedan bloqueadas hasta que termine el reto. Quien gana se lleva las de los dos; si hay empate cada uno recupera las suyas.");
      dlg.innerHTML = `
        <h2>${esc(titulo || "Elige tus cartas")}</h2>
        ${contra && contra.length ? `<p class="ba-contra">Tu rival apuesta: ${contra.map(c => `<b>${esc(c.nombre)}</b> (${esc(nombreRareza(c.rareza))})`).join(", ")}.</p>` : ""}
        <p class="ba-ayuda">${esc(textoAyuda)}</p>
        <ul class="ba-lista">${copias.map(c => `
          <li><label><input type="checkbox" data-id="${esc(c.id)}"> <span class="ba-nombre">${esc(c.nombre)}</span>
            <small>${esc(nombreRareza(c.rareza))} · copia ${c.numero}</small></label></li>`).join("")}</ul>
        <p class="ba-cuenta" role="status"></p>
        <div class="ba-botones"><button type="button" class="cartas-boton cartas-boton-principal" data-ok>Confirmar</button>
          <button type="button" class="cartas-boton" data-no>Cancelar</button></div>`;
      document.body.appendChild(dlg);
      const cuenta = dlg.querySelector(".ba-cuenta"), ok = dlg.querySelector("[data-ok]");
      const pintar = () => {
        const sel = copias.filter(c => elegidas.has(c.id));
        if (validar) {
          const r = validar(sel);
          cuenta.textContent = r.texto || `Elegidas: ${elegidas.size}`;
          ok.disabled = !r.ok;
        } else {
          cuenta.textContent = `Elegidas: ${elegidas.size}${cantidad ? ` de ${cantidad}` : ` (máximo ${max})`}`;
          ok.disabled = cantidad ? elegidas.size !== cantidad : elegidas.size < 1;
        }
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

  /* Texto corto de una lista guardada en una partida o intercambio (apuesta1_info, ofrece_info...) */
  function texto(info) {
    return (info || []).map(c => `${esc(c.nombre)}${c.n && c.n > 1 ? ` ×${c.n}` : ""} (${esc(nombreRareza(c.rareza))})`).join(", ");
  }

  return { elegir, texto, copiasLibres, nombreRareza, categoria: r => ORDEN[r] || 1 };
})();
