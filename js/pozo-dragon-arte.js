/* =============================================================================
   EL POZO DEL DRAGÓN: el arte (todo SVG dibujado aquí; no hay imágenes ni archivos que puedan faltar).
   Aquí no hay reglas ni red: solo funciones que devuelven dibujos (dados, emblema, monedas, el ojo del dragón) para que pozo-dragon.js los pinte y pozo-dragon.css les dé movimiento.
   Superficies planas: hueso, piedra, hierro y oro apagado con filetes finos, sin degradados dorados ni brillos.
============================================================================= */
window.PozoArte = (function () {
  // Dónde va cada punto de un dado de 100 x 100 (rejilla de 3 x 3: 28, 50, 72)
  const L = 28, C = 50, R = 72;
  const PUNTOS = {
    1: [[C, C]],
    2: [[L, L], [R, R]],
    3: [[L, L], [C, C], [R, R]],
    4: [[L, L], [R, L], [L, R], [R, R]],
    5: [[L, L], [R, L], [C, C], [L, R], [R, R]],
    6: [[L, L], [R, L], [L, C], [R, C], [L, R], [R, R]]
  };

  // Un dado de hueso tallado. valor 1 a 6; clases extra para la animación (rueda, ruina, brasa...)
  function dado(valor, clase) {
    const v = Math.min(6, Math.max(1, Number(valor) || 1));
    const pts = PUNTOS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 11 : 8}" class="pz-punto${v === 1 ? " pz-punto-uno" : ""}"/>`).join("");
    return `<svg class="pz-dado${clase ? " " + clase : ""}" viewBox="0 0 100 100" role="img" aria-label="Dado: ${v}" data-valor="${v}" focusable="false">
      <rect x="6" y="6" width="88" height="88" rx="16" class="pz-dado-cuerpo"/>
      <rect x="12" y="12" width="76" height="76" rx="11" class="pz-dado-filete" fill="none"/>
      ${pts}
    </svg>`;
  }

  // El ojo del dragón: iris con la pupila rasgada y un anillo de escamas
  function ojo(clase) {
    let escamas = "";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 44;
      escamas += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.4" ry="7.5" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" class="pz-escama"/>`;
    }
    return `<svg class="pz-ojo${clase ? " " + clase : ""}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="50" class="pz-ojo-fondo"/>
      ${escamas}
      <circle cx="50" cy="50" r="33" class="pz-ojo-aro"/>
      <circle cx="50" cy="50" r="28" class="pz-ojo-iris"/>
      <path d="M50 24 C58 38 58 62 50 76 C42 62 42 38 50 24 Z" class="pz-ojo-pupila"/>
      <circle cx="42" cy="40" r="3.2" class="pz-ojo-brillo"/>
    </svg>`;
  }

  // El emblema de la cabecera: una moneda con el ojo del dragón
  function emblema() {
    return `<svg class="pz-emblema" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" class="pz-emb-moneda"/>
      <circle cx="50" cy="50" r="41" class="pz-emb-filete" fill="none"/>
      <g transform="translate(22 22) scale(.56)">${ojo("pz-ojo-pequeno").replace(/<svg[^>]*>|<\/svg>/g, "")}</g>
    </svg>`;
  }

  // Una moneda suelta (para el pozo y el saldo)
  function moneda(clase) {
    return `<svg class="pz-moneda${clase ? " " + clase : ""}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="18" class="pz-moneda-cuerpo"/><circle cx="20" cy="20" r="13.5" class="pz-moneda-aro" fill="none"/>
      <path d="M20 10v20M14.5 15h8a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7h8.5" class="pz-moneda-marca" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  // El montón del pozo: más monedas cuanto más pozo (de 1 a 14 discos), siempre del mismo ancho
  function monton(n, nuevos) {
    const k = Math.max(1, Math.min(14, n));
    let h = "";
    for (let i = 0; i < k; i++) {
      const y = 92 - i * 6, dx = (i % 3) * 3 - 3;
      h += `<g class="pz-disco-g${i >= k - (nuevos || 0) ? " pz-disco-nuevo" : ""}"><ellipse cx="${50 + dx}" cy="${y}" rx="38" ry="9" class="pz-disco"/><ellipse cx="${50 + dx}" cy="${y - 3}" rx="38" ry="9" class="pz-disco-tapa"/></g>`;
    }
    return `<svg class="pz-monton" viewBox="0 0 100 100" data-n="${k}" aria-hidden="true" focusable="false">${h}</svg>`;
  }

  // Un dragón dormido sobre su tesoro: silueta del fondo de la mesa (decorativa)
  function dragon() {
    return `<svg class="pz-dragon" viewBox="0 0 400 160" aria-hidden="true" focusable="false">
      <path d="M0 160 C20 120 50 112 80 118 C100 90 140 70 190 80 C230 40 290 30 330 52 L372 40 L360 66 C392 78 398 104 376 116 C350 124 332 114 318 108 C300 130 270 144 240 148 L240 160 Z" class="pz-dragon-forma"/>
      <path d="M330 52 L352 28 L346 56 Z M300 46 L318 22 L316 50 Z" class="pz-dragon-forma"/>
      <circle cx="352" cy="70" r="4.5" class="pz-dragon-ojo"/>
    </svg>`;
  }

  // El símbolo de una combinación, para la tabla de reglas: sus tres dados en pequeño
  const EJEMPLOS = { ruina: [1, 1, 2], ceniza: [2, 4, 6], pareja: [3, 3, 5], escalera: [3, 4, 5], triple: [4, 4, 4], triple_seis: [6, 6, 6] };
  function ejemplo(cat) {
    return `<span class="pz-ejemplo" aria-hidden="true">${(EJEMPLOS[cat] || []).map(v => dado(v, "pz-mini")).join("")}</span>`;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // EL DRAGÓN. Dibujado por capas a partir de la ilustración de referencia y pensado para pintarse barato:
  //  - Los degradados, el patrón de escamas y la mitad izquierda de la cara viven una sola vez en un <svg> oculto (defs()). Cada dragón de la página es solo un <use> de ahí.
  //  - Cada dragón son dos capas: el cuerpo, que no se anima nunca, y los ojos (resplandor, iris, pupila rasgada, párpados), que son lo único que se mueve. Así, seguir al cursor o parpadear
  //    solo repinta un par de formas pequeñas y no toda la cara.
  //  - Sin filtros ni desenfoques: el brillo son degradados radiales.
  // El color de los ojos, el cierre de los párpados y el tamaño de la pupila salen de data-e en el marco (espera, mira, ruina, premio, cobro) y los pone el CSS (pozo-dragon-escena.css).
  // ---------------------------------------------------------------------------------------------------------------------
  const CY = 205;
  const MITAD_DRAGON = `
      <path d="M380 220 C250 120 100 90 -100 80 C-250 100 -400 160 -700 150 Q-600 210 -500 200 Q-400 270 -300 260 Q-200 330 -100 320 Q100 300 380 220 Z" fill="url(#pzAla)"/>
      <path d="M380 220 C250 120 100 90 -100 80 C-250 100 -400 160 -700 150 Q-600 210 -500 200 Q-400 270 -300 260 Q-200 330 -100 320 Q100 300 380 220 Z" fill="url(#pzEscama)" opacity=".4"/>
      <path d="M380 220 C200 110 -100 80 -650 100 M380 220 Q50 160 -500 200 M380 220 Q100 260 -300 260 M380 220 Q150 290 -100 320" fill="none" stroke="#6c464f" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M380 220 C250 120 100 90 -100 80 C-250 100 -400 160 -700 150" fill="none" stroke="#d2a32e" stroke-width="1.6"/>
      <path d="M222 104 C222 70 232 36 246 10 C262 36 280 62 292 86 Z M284 82 C288 50 296 24 304 4 C316 30 326 50 334 72 Z M328 72 C334 54 340 38 348 22 C356 36 364 50 372 66 Z M366 64 C370 52 376 44 382 34 C388 46 394 56 398 70 Z M400 0 L384 54 L400 68 Z" fill="#000" opacity=".4" transform="translate(4 6)"/>
      <path d="M222 104 C222 70 232 36 246 10 C262 36 280 62 292 86 Z M284 82 C288 50 296 24 304 4 C316 30 326 50 334 72 Z M328 72 C334 54 340 38 348 22 C356 36 364 50 372 66 Z M366 64 C370 52 376 44 382 34 C388 46 394 56 398 70 Z M400 0 L384 54 L400 68 Z" fill="url(#pzCuerno)" stroke="#d2a32e" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M400 4 L388 30 L372 60 L340 76 L300 100 L262 150 L226 182 L248 238 L290 294 L320 340 L352 390 L378 420 L400 444 Z" fill="url(#pzPiel)"/>
      <path d="M400 4 L388 30 L372 60 L340 76 L300 100 L262 150 L226 182 L248 238 L290 294 L320 340 L352 390 L378 420 L400 444 Z" fill="url(#pzEscama)" opacity=".55"/>
      <path d="M296 126 C262 108 226 98 196 90 C214 118 236 150 272 180 Z M284 180 C254 178 228 180 206 184 C226 206 254 224 288 234 Z M292 238 C274 246 260 254 244 262 C262 278 282 288 302 292 Z M306 294 C290 302 278 308 266 316 C282 328 300 334 320 334 Z M322 342 C310 352 302 362 296 374 C310 378 326 376 342 368 Z M330 118 C316 110 302 104 288 98 C296 126 308 146 322 160 Z" fill="#000" opacity=".4" transform="translate(5 7)"/>
      <path d="M296 126 C262 108 226 98 196 90 C214 118 236 150 272 180 Z M284 180 C254 178 228 180 206 184 C226 206 254 224 288 234 Z M292 238 C274 246 260 254 244 262 C262 278 282 288 302 292 Z M306 294 C290 302 278 308 266 316 C282 328 300 334 320 334 Z M322 342 C310 352 302 362 296 374 C310 378 326 376 342 368 Z M330 118 C316 110 302 104 288 98 C296 126 308 146 322 160 Z" fill="url(#pzCuerno)" stroke="#d2a32e" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M400 96 L378 120 M400 128 L370 156 M400 160 L364 188 M400 196 L374 214" fill="none" stroke="#c59c34" stroke-width="1.6" opacity=".7"/>
      <path d="M352 232 L346 300 L372 346 L400 372 L400 232 Z" fill="url(#pzHocico)" stroke="#937427" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M400 372 L372 382 L388 418 L400 444 Z" fill="url(#pzPiel)" stroke="#d2a32e" stroke-width="1.2" stroke-linejoin="round"/>
      <ellipse cx="371" cy="296" rx="15" ry="20" fill="#060302" stroke="#a4822a" stroke-width="1.4"/>
      <ellipse cx="371" cy="302" rx="7" ry="11" fill="#240e14" opacity=".8"/>
      <path d="M344 330 L336 354 L356 348 Z M358 346 L354 370 L372 356 Z M374 354 L374 376 L388 360 Z M390 360 L392 380 L400 364 Z" fill="url(#pzDiente)" stroke="#f4dea5" stroke-width=".8" stroke-linejoin="round"/>`;
  const BRASAS_DRAGON = [[70, 330, 2.2], [150, 410, 1.8], [210, 90, 1.6], [90, 200, 1.4], [330, 440, 1.6], [250, 360, 1.4], [40, 260, 1.6]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${800 - x}" cy="${y + 14}" r="${r * 0.9}"/>`).join("");

  // El <svg> oculto con lo que comparten todos los dragones. Va una sola vez en la página (no puede estar en display:none: Chrome no pinta degradados de un svg oculto así).
  function defs() {
    return `<svg id="pzDefsDragon" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>
      <radialGradient id="pzHumo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d77635" stop-opacity=".55"/><stop offset=".55" stop-color="#84471e" stop-opacity=".25"/><stop offset="1" stop-color="#180c0f" stop-opacity="0"/></radialGradient>
      <radialGradient id="pzIris" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0b0"/><stop offset=".45" stop-color="#ffb93a"/><stop offset="1" stop-color="#b3560f"/></radialGradient>
      <radialGradient id="pzIrisRoja" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e4ddd3"/><stop offset=".45" stop-color="#df7834"/><stop offset="1" stop-color="#6a0f0a"/></radialGradient>
      <radialGradient id="pzLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb03a" stop-opacity=".6"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
      <radialGradient id="pzLuzRoja" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff3a22" stop-opacity=".75"/><stop offset="1" stop-color="#ff3a22" stop-opacity="0"/></radialGradient>
      <radialGradient id="pzBoca" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb93a" stop-opacity=".95"/><stop offset=".6" stop-color="#ff9a2a" stop-opacity=".5"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient>
      <linearGradient id="pzPiel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2228"/><stop offset=".5" stop-color="#1a0f12"/><stop offset="1" stop-color="#0b0607"/></linearGradient>
      <linearGradient id="pzCuerno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#613f47"/><stop offset=".55" stop-color="#29171b"/><stop offset="1" stop-color="#0f080a"/></linearGradient>
      <linearGradient id="pzAla" x1="400" y1="200" x2="-700" y2="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2a181c"/><stop offset="1" stop-color="#140b0d"/></linearGradient>
      <linearGradient id="pzHocico" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#241418"/><stop offset="1" stop-color="#492730"/></linearGradient>
      <linearGradient id="pzDiente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="#ffb93a"/></linearGradient>
      <linearGradient id="pzParp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
      <pattern id="pzEscama" width="18" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q9 -1 18 6 M-9 12 Q0 5 9 12 M9 12 Q18 5 27 12" fill="none" stroke="#a38539" stroke-width="1" opacity=".5"/></pattern>
      <g id="pzDhMitad">${MITAD_DRAGON}</g>
      <g id="pzDhCuerpo">
        <ellipse cx="130" cy="430" rx="190" ry="60" fill="url(#pzHumo)"/><ellipse cx="670" cy="432" rx="190" ry="60" fill="url(#pzHumo)"/><ellipse cx="400" cy="452" rx="260" ry="50" fill="url(#pzHumo)"/>
        <use href="#pzDhMitad"/><use href="#pzDhMitad" transform="translate(800 0) scale(-1 1)"/>
        <path d="M400 4 L400 444" stroke="#e6b538" stroke-width="1.8" opacity=".85" fill="none"/>
        <g fill="#e9be50" opacity=".75">${BRASAS_DRAGON}</g>
      </g>
    </defs></svg>`;
  }

  // Un ojo: resplandor (ámbar y rojo), cuenca, párpado superior, iris recortado por el párpado, pupila rasgada y el párpado que se cierra. d = 1 el izquierdo, -1 el derecho.
  let ojosN = 0;
  function ojoDib(cx, d, id) {
    const x = n => (cx + n * d).toFixed(1);
    const almendra = `M${x(-29)} ${CY - 10} Q${x(0)} ${CY - 20} ${x(29)} ${CY + 8} Q${x(-3)} ${CY + 20} ${x(-29)} ${CY - 10} Z`;
    return `
      <clipPath id="${id}"><path d="${almendra}"/></clipPath>
      <circle cx="${cx}" cy="${CY}" r="50" fill="url(#pzLuz)" class="pz-dh-luz"/>
      <circle cx="${cx}" cy="${CY}" r="56" fill="url(#pzLuzRoja)" class="pz-dh-luz-roja"/>
      <path d="M${x(-40)} ${CY - 4} L${x(-8)} ${CY - 32} L${x(36)} ${CY - 2} Q${x(0)} ${CY - 14} ${x(-40)} ${CY - 4} Z" fill="#1b1013" fill-opacity=".3" stroke="#c59c34" stroke-opacity=".08" stroke-width="1" stroke-linejoin="round"/>
      <path d="${almendra}" fill="#090506"/>
      <g clip-path="url(#${id})">
        <g class="pz-heroe-iris"><ellipse cx="${cx}" cy="${CY}" rx="27" ry="17" fill="url(#pzIris)"/><ellipse cx="${cx}" cy="${CY}" rx="27" ry="17" fill="url(#pzIrisRoja)" class="pz-dh-iris-roja"/></g>
        <g class="pz-heroe-pupila"><g transform="rotate(${14 * d} ${cx} ${CY})"><ellipse cx="${cx}" cy="${CY}" rx="3.4" ry="12" fill="#080302" class="pz-dh-pupila"/></g></g>
        <rect x="${cx - 36}" y="${CY - 24}" width="72" height="20" fill="url(#pzParp)"/>
        <rect x="${cx - 36}" y="${CY - 24}" width="72" height="48" fill="#170c0f" class="pz-dh-parpado"/>
      </g>
      <path d="${almendra}" fill="none" stroke="#ecc461" stroke-width="1.3" stroke-linejoin="round"/>`;
  }

  // El marco del dragón: cuerpo + ojos. vb es el trozo del dibujo que se ve (la cara entera con las alas, o solo la cabeza); clase la pone quien lo usa.
  function marcoDragon(vb, clase, etiqueta) {
    const n = ++ojosN;
    return `<div class="pz-dragon-marco ${clase}" data-e="espera" data-vb="${vb}" role="img" aria-label="${etiqueta}">
      <svg class="pz-dragon-cuerpo" viewBox="${vb}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false" overflow="visible"><use href="#pzDhCuerpo"/></svg>
      <svg class="pz-dragon-ojos" viewBox="${vb}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false" overflow="visible">
        ${ojoDib(324, 1, "pzOjoI" + n)}${ojoDib(476, -1, "pzOjoD" + n)}
        <ellipse cx="400" cy="364" rx="30" ry="9" fill="#f48135" class="pz-dh-fuego"/>
      </svg>
    </div>`;
  }
  const dragonHeroe = () => marcoDragon("0 0 800 460", "pz-dragon-heroe", "Un dragón negro de frente, con las alas abiertas y los ojos encendidos");
  const dragonCara = () => marcoDragon("176 0 448 410", "pz-dragon-cara", "El Dragón te mira desde el otro lado de la mesa");

  // El ojo del dragón que vigila la mesa mientras juegas: se estrecha cuando es tu turno y se enciende con una Ruina o un premio grande (la clase la pone el controlador)
  function ojoVigia() {
    return `<svg class="pz-vigia-ojo" viewBox="0 0 240 110" focusable="false" aria-hidden="true">
      <path d="M6 55 C50 6 190 6 234 55 C190 104 50 104 6 55 Z" class="pz-vi-parpado"/>
      <circle cx="120" cy="55" r="38" class="pz-vi-iris"/><circle cx="120" cy="55" r="32" class="pz-vi-iris2"/>
      <ellipse cx="120" cy="55" rx="9" ry="34" class="pz-vi-pupila"/>
      <circle cx="105" cy="38" r="5" class="pz-vi-brillo"/>
    </svg>`;
  }

  return { dado, ojo, emblema, moneda, monton, dragon, defs, dragonHeroe, dragonCara, ojoVigia, ejemplo, EJEMPLOS };
})();
