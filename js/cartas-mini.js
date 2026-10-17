/* Cartas pequeñas de verdad para Intercambios y la Forja. CartasMini.html(info, extra) devuelve un botón con la carta real de Triunfos (la de
   js/cartas-vista.js) sin su propio botón dentro. info = { carta, nombre, rareza, numero?, n? }; pulsarla se maneja con data-ver (carta) y
   data-numero. CartasMini.abrir(carta, numero, texto) la enseña grande en un cuadro. Los estilos están en css/cartas-mini.css. */
window.CartasMini = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nombreRareza = r => (window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r] ? window.CARTAS_RAREZAS[r].nombre : r);

  function html(info, extra) {
    const c = window.cartaPorId && window.cartaPorId(info.carta);
    const n = info.n && info.n > 1 ? `<i class="mc-n">×${info.n}</i>` : "";
    const cuerpo = c && window.CartasVista
      ? window.CartasVista.htmlCarta(c, true, 1, info.numero ? [info.numero] : null).replace(/^\s*<button type="button"/, "<div").replace(/<\/button>\s*$/, "</div>")
      : `<div class="carta mc-dorso carta-rareza-${esc(info.rareza || "comun")}"><b>?</b></div>`;
    const nombre = info.nombre || (c ? c.nombre : info.carta);
    return `<button type="button" class="mc${extra ? " " + extra : ""}" data-ver="${esc(info.carta)}" data-numero="${esc(info.numero || "")}" title="${esc(nombre)} · ${esc(nombreRareza(info.rareza || (c && c.rareza)))}">${cuerpo}${n}</button>`;
  }

  function abrir(cartaId, numero, texto) {
    const c = window.cartaPorId && window.cartaPorId(cartaId);
    if (!c) return;
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado mc-ver";
    dlg.innerHTML = `<h2>${esc(c.nombre)}</h2><div class="ic-carta">${window.CartasVista.htmlCarta(c, true, 1, numero ? [numero] : null)}</div>
      <p><small>${esc(texto || `${nombreRareza(c.rareza)}${numero ? ` · copia ${numero}` : ""}`)}</small></p><button type="button" class="cartas-boton cartas-boton-principal">Cerrar</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".cartas-boton-principal").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  return { html, abrir };
})();
