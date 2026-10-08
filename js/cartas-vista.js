/* =============================================================================
   CARTAS MALDITAS — dibujo de una carta. Lo comparten el álbum, el editor, el
   constructor de mazos y el tablero de batalla. Devuelve HTML (un <button
   class="carta">); todo el tamaño se mide con el ancho de la carta, así que
   escala sola.
============================================================================= */
window.CartasVista = (function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iniciales = nombre => String(nombre).replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";
  const numeros2 = n => String(n).padStart(2, "0");

  /* Un icono por afinidad (se pinta con el color de la afinidad) */
  const ICONOS_AFINIDAD = {
    juramento: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
    sombra: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    carne: '<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>',
    arcano: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    eternidad: '<path d="M6 2h12v4l-4.5 6 4.5 6v4H6v-4l4.5-6L6 6z"/>',
    caceria: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>'
  };

  /* "Palabra clave: efecto" -> la palabra clave sale en dorado (solo si no lleva punto antes de los dos puntos) */
  function htmlReglas(texto) {
    const m = String(texto || "").match(/^([^.:]{2,32}):\s*([\s\S]*)$/);
    return m ? `<span class="kw">${esc(m[1])}:</span> ${esc(m[2])}` : esc(texto);
  }

  function htmlCarta(c, tengo, cantidad, numeros) {
    const rareza = window.CARTAS_RAREZAS[c.rareza] || { nombre: c.rareza };
    const afinidad = c.afinidad[0];
    const conStats = c.atq !== null && c.atq !== undefined;
    const marcaNumero = tengo && c.limite && numeros && numeros.length
      ? `<span class="carta-numero">${numeros.map(n => `${numeros2(n)}/${numeros2(c.limite)}`).join(" · ")}</span>` : "";
    const copias = tengo && cantidad > 1 ? `<span class="carta-copias">x${cantidad}</span>` : "";
    const borrador = c.borrador ? `<span class="carta-borrador">Borrador</span>` : "";
    const aj = c.ajuste || { z: 1, x: 50, y: 50 };
    const arte = tengo && c.imagen
      ? `<img src="${esc(c.imagen)}" alt="" loading="lazy" decoding="async" style="--z:${+aj.z || 1};--px:${+aj.x}%;--py:${+aj.y}%">`
      : `<b>${esc(tengo ? iniciales(c.nombre) : "?")}</b>`;
    const largo = c.nombre.length > 22 ? " muylargo" : c.nombre.length > 15 ? " largo" : "";
    const iconos = c.afinidad.map(a => `<span class="carta-af-icono carta-af-${a}" title="${esc(window.CARTAS_AFINIDADES[a].nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_AFINIDAD[a] || ""}</svg></span>`).join("");
    return `
      <button type="button" class="carta carta-rareza-${c.rareza} carta-af-${afinidad} ${tengo ? "" : "sin-tener"}" data-id="${esc(c.id)}" aria-label="${tengo ? esc(c.nombre) : "Carta sin descubrir"}">
        <div class="carta-caja">
          <div class="carta-arte">${arte}</div>
          <span class="carta-coste" title="Coste">${c.coste}</span>
          <div class="carta-afinidades">${iconos}</div>
          <div class="carta-texto">
            <p class="carta-nombre${largo}">${esc(c.nombre)}${c.epiteto ? `<small>${esc(c.epiteto)}</small>` : ""}</p>
            ${c.habilidad ? `<p class="carta-habilidad">${htmlReglas(c.habilidad)}</p>` : ""}
            ${marcaNumero}
          </div>
          ${conStats ? `<span class="carta-stat atq" title="Ataque">${c.atq}</span><span class="carta-stat pv" title="Vida">${c.pv}</span>` : ""}
          <span class="carta-gema" title="${esc(rareza.nombre)}"></span>
          <div class="carta-oculta-info">${esc(c.tipo)} · ${esc(rareza.nombre)}</div>
          ${copias}${borrador}
        </div>
      </button>`;
  }

  return { esc, iniciales, numeros2, htmlReglas, htmlCarta, ICONOS_AFINIDAD };
})();
