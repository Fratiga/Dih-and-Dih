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

  /* Palabras clave del Triunfos (data/triunfos-guia.js), con un icono pequeño para las más comunes. */
  const ICONOS_CLAVE = {
    guardia: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
    provocar: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
    volar: '<path d="M2 14c4 0 6-3 10-9 4 6 6 9 10 9-3 1-6 3-10 7-4-4-7-6-10-7z"/>',
    arrollar: '<path d="M4 4l8 8-8 8M12 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/>',
    temible: '<path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5 4 6v4h8v-4c2.4-1 4-3 4-6a8 8 0 0 0-8-8zM9 10a1.5 1.5 0 1 1 0 .1zm6 0a1.5 1.5 0 1 1 0 .1z"/>',
    veloz: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    duro: '<path d="M12 2l9 10-9 10L3 12z"/>',
    esquivo: '<path d="M12 4a8 8 0 1 0 8 8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 3v6h-6z"/>',
    barrera: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/>',
    escurridizo: '<path d="M12 3a7 7 0 0 0-7 7v11l3.5-3 3.5 3 3.5-3 3.5 3V10a7 7 0 0 0-7-7z"/>'
  };
  const sinTildes = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  /* Por encima de este largo, la carta muestra solo los nombres de sus reglas y el texto entero sale
     en una pestaña que se despliega (y en la ficha de la carta). */
  const UMBRAL_REGLAS = 90;

  /* Parte el texto en cláusulas "Nombre: efecto". Lo que venga antes de la primera es la introducción. */
  function clausulas(texto) {
    const t = String(texto || "").trim();
    const re = /(?:^|(?<=[.!?]\s))([A-ZÁÉÍÓÚÑ][^.:\n]{1,40}):\s+/g;
    const marcas = [];
    let m;
    while ((m = re.exec(t))) marcas.push({ nombre: m[1].trim(), ini: m.index, fin: re.lastIndex });
    return {
      intro: marcas.length ? t.slice(0, marcas[0].ini).trim() : t,
      lista: marcas.map((k, i) => ({ nombre: k.nombre, texto: t.slice(k.fin, i + 1 < marcas.length ? marcas[i + 1].ini : t.length).trim() }))
    };
  }

  function htmlClave(nombre) {
    const icono = ICONOS_CLAVE[sinTildes(nombre)];
    return `<span class="carta-clave">${icono ? `<svg viewBox="0 0 24 24" aria-hidden="true">${icono}</svg>` : ""}${esc(nombre)}</span>`;
  }

  /* Cara de la carta: nombres de las reglas como etiquetas + pestaña "Reglas" que abre el texto completo. */
  function htmlReglasCompactas(texto) {
    const { intro, lista } = clausulas(texto);
    const resumen = lista.length ? "" : (intro.length > 64 ? intro.slice(0, 62).trimEnd() + "…" : intro);
    return `
      ${lista.length ? `<div class="carta-claves">${lista.map(k => htmlClave(k.nombre)).join("")}</div>` : ""}
      ${resumen ? `<p class="carta-habilidad">${esc(resumen)}</p>` : ""}
      <span class="carta-reglas-tab" role="button" tabindex="0" aria-label="Ver las reglas completas">Reglas ▾</span>`;
  }

  /* "Palabra clave: efecto" -> la palabra clave sale en dorado (solo si no lleva punto antes de los dos puntos) */
  function htmlReglas(texto) {
    const { intro, lista } = clausulas(texto);
    if (!lista.length) return esc(texto);
    return (intro ? esc(intro) + " " : "") + lista.map(k => `<span class="kw">${esc(k.nombre)}:</span> ${esc(k.texto)}`).join(" ");
  }

  function htmlCarta(c, tengo, cantidad, numeros, opciones) {
    const completa = !!(opciones && opciones.completa);
    const compacta = !completa && c.habilidad && String(c.habilidad).length > UMBRAL_REGLAS;
    const rareza = window.CARTAS_RAREZAS[c.rareza] || { nombre: c.rareza };
    const afinidad = c.afinidad[0];
    const conStats = c.atq !== null && c.atq !== undefined;
    const marcaNumero = tengo && c.limite && numeros && numeros.length
      ? `<span class="carta-numero">${numeros.map(n => `${numeros2(n)}/${numeros2(c.limite)}`).join(" · ")}</span>` : "";
    const copias = tengo && cantidad > 1 ? `<span class="carta-copias">x${cantidad}</span>` : "";
    const borrador = c.borrador ? `<span class="carta-borrador">Borrador</span>` : "";
    // Forma de la carta (0 = base). Una forma sin foto propia se ve con la de la base
    const forma = c.forma > 0 && c.formas && c.formas[c.forma - 1] && c.formas[c.forma - 1].imagen ? c.formas[c.forma - 1] : null;
    const imagen = forma ? forma.imagen : c.imagen;
    const aj = (forma ? forma.ajuste : c.ajuste) || { z: 1, x: 50, y: 50 };
    const arte = tengo && imagen
      ? `<img src="${esc(imagen)}" alt="" loading="lazy" decoding="async" style="--z:${+aj.z || 1};--px:${+aj.x}%;--py:${+aj.y}%">`
      : `<b>${esc(tengo ? iniciales(c.nombre) : "?")}</b>`;
    const largo = c.nombre.length > 22 ? " muylargo" : c.nombre.length > 15 ? " largo" : "";
    const iconos = c.afinidad.map(a => `<span class="carta-af-icono carta-af-${a}" title="${esc(window.CARTAS_AFINIDADES[a].nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_AFINIDAD[a] || ""}</svg></span>`).join("");
    return `
      <button type="button" class="carta carta-rareza-${c.rareza} carta-af-${afinidad} ${tengo ? "" : "sin-tener"}${c.forma > 0 ? " carta-forma" : ""}" data-id="${esc(c.id)}"${c.forma > 0 ? ` data-forma="${+c.forma}"` : ""} aria-label="${tengo ? esc(c.nombre) : "Carta sin descubrir"}">
        <div class="carta-caja">
          <div class="carta-arte">${arte}</div>
          <span class="carta-coste" title="Coste">${c.coste}</span>
          <div class="carta-afinidades">${iconos}</div>
          <div class="carta-texto">
            <p class="carta-nombre${largo}">${esc(c.nombre)}${c.epiteto ? `<small>${esc(c.epiteto)}</small>` : ""}</p>
            ${c.habilidad ? (compacta ? htmlReglasCompactas(c.habilidad) : `<p class="carta-habilidad">${htmlReglas(c.habilidad)}</p>`) : ""}
            ${marcaNumero}
          </div>
          ${compacta ? `<div class="carta-reglas-completas"><p class="carta-habilidad">${htmlReglas(c.habilidad)}</p></div>` : ""}
          ${conStats ? `<span class="carta-stat atq" title="Ataque">${c.atq}</span><span class="carta-stat pv" title="Vida">${c.pv}</span>` : ""}
          <span class="carta-gema" title="${esc(rareza.nombre)}"></span>
          <div class="carta-oculta-info">${esc(c.tipo)} · ${esc(rareza.nombre)}</div>
          ${copias}${borrador}
        </div>
      </button>`;
  }

  /* La pestaña "Reglas" abre y cierra el texto completo. Va en la captura para que pulsarla no abra la ficha
     de la carta ni la seleccione en el tablero. */
  function alternarReglas(e) {
    const tab = e.target.closest && e.target.closest(".carta-reglas-tab");
    if (!tab) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    tab.closest(".carta").classList.toggle("carta-reglas-abiertas");
  }
  document.addEventListener("click", alternarReglas, true);
  document.addEventListener("keydown", alternarReglas, true);

  return { esc, iniciales, numeros2, htmlReglas, htmlCarta, ICONOS_AFINIDAD };
})();
