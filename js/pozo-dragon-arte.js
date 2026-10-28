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
  // EL DRAGÓN: solo se le ven los ojos. No hay cuerpo, ni cejas, ni hocico: dos ojos de brasa en la oscuridad.
  //  - Cada ojo es un grupo (.pz-ojo-g) con resplandor ámbar y rojo, cuenca, iris recortado por el párpado, pupila rasgada, venas y el párpado que se cierra.
  //  - Los degradados viven una sola vez en un <svg> oculto (defs()); no puede ser display:none porque Chrome no pinta degradados de un svg oculto así.
  //  - Sin filtros ni desenfoques: el brillo son degradados radiales. Lo único que se mueve son los ojos: seguir al cursor, parpadear, respirar y, con una Ruina, abrirse y deformarse.
  // El color, el tamaño y la forma de cada estado (espera, mira, ruina, premio, gran, cobro) los pone el CSS desde data-e en el marco (pozo-dragon-escena.css).
  // ---------------------------------------------------------------------------------------------------------------------
  const CY = 205;

  function defs() {
    return `<svg id="pzDefsDragon" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>
      <radialGradient id="pzIris" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0b0"/><stop offset=".45" stop-color="#ffb93a"/><stop offset="1" stop-color="#b3560f"/></radialGradient>
      <radialGradient id="pzIrisRoja" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd0b8"/><stop offset=".45" stop-color="#e8442a"/><stop offset="1" stop-color="#6a0f0a"/></radialGradient>
      <radialGradient id="pzLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb03a" stop-opacity=".6"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
      <radialGradient id="pzLuzRoja" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff3a22" stop-opacity=".75"/><stop offset="1" stop-color="#ff3a22" stop-opacity="0"/></radialGradient>
      <linearGradient id="pzParp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs></svg>`;
  }

  // Las venas que se ven en el iris cuando el ojo se desorbita (solo en la Ruina): líneas rojas que salen del centro con un pequeño quiebro
  function venasDib(cx) {
    let p = "";
    for (let i = 0; i < 11; i++) {
      const a = (i * 33 + 7) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), q = (i % 2 ? 1 : -1) * 3;
      p += `M${(cx + 9 * c).toFixed(1)} ${(CY + 9 * s).toFixed(1)} L${(cx + 20 * c - q * s).toFixed(1)} ${(CY + 20 * s + q * c).toFixed(1)} L${(cx + 36 * c).toFixed(1)} ${(CY + 36 * s).toFixed(1)} `;
    }
    return `<path d="${p}" class="pz-dh-venas" fill="none" stroke="#e2402a" stroke-width="1" stroke-linecap="round"/>`;
  }

  // Un ojo. d = 1 el izquierdo, -1 el derecho.
  let ojosN = 0;
  function ojoDib(cx, d, id) {
    const x = n => (cx + n * d).toFixed(1);
    const almendra = `M${x(-29)} ${CY - 10} Q${x(0)} ${CY - 20} ${x(29)} ${CY + 8} Q${x(-3)} ${CY + 20} ${x(-29)} ${CY - 10} Z`;
    return `
      <clipPath id="${id}"><path d="${almendra}"/></clipPath>
      <g class="pz-ojo-g" data-lado="${d > 0 ? "i" : "d"}">
        <circle cx="${cx}" cy="${CY}" r="50" fill="url(#pzLuz)" class="pz-dh-luz"/>
        <circle cx="${cx}" cy="${CY}" r="56" fill="url(#pzLuzRoja)" class="pz-dh-luz-roja"/>
        <path d="${almendra}" fill="#070304"/>
        <g clip-path="url(#${id})">
          <g class="pz-heroe-iris"><ellipse cx="${cx}" cy="${CY}" rx="27" ry="17" fill="url(#pzIris)"/><ellipse cx="${cx}" cy="${CY}" rx="27" ry="17" fill="url(#pzIrisRoja)" class="pz-dh-iris-roja"/>${venasDib(cx)}</g>
          <g class="pz-heroe-pupila"><g transform="rotate(${14 * d} ${cx} ${CY})"><ellipse cx="${cx}" cy="${CY}" rx="3.4" ry="12" fill="#080302" class="pz-dh-pupila"/></g></g>
          <rect x="${cx - 36}" y="${CY - 24}" width="72" height="20" fill="url(#pzParp)"/>
          <rect x="${cx - 36}" y="${CY - 24}" width="72" height="48" fill="#120a0c" class="pz-dh-parpado"/>
        </g>
        <path d="${almendra}" fill="none" stroke="#f3b95a" stroke-width="1.3" stroke-linejoin="round"/>
      </g>`;
  }

  // El marco del dragón: los dos ojos. vb es el trozo del dibujo que se ve (la franja de los ojos); clase la pone quien lo usa.
  function marcoDragon(vb, clase, etiqueta) {
    const n = ++ojosN;
    return `<div class="pz-dragon-marco ${clase}" data-e="espera" data-vb="${vb}" role="img" aria-label="${etiqueta}">
      <svg class="pz-dragon-ojos" viewBox="${vb}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${ojoDib(324, 1, "pzOjoI" + n)}${ojoDib(476, -1, "pzOjoD" + n)}</svg>
    </div>`;
  }
  const dragonHeroe = () => marcoDragon("200 130 400 190", "pz-dragon-heroe", "Los ojos de un dragón que te vigila en la oscuridad");
  const dragonCara = () => marcoDragon("230 150 340 160", "pz-dragon-cara", "Los ojos del Dragón te miran desde el otro lado de la mesa");

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
