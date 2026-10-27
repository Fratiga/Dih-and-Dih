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
  function monton(n) {
    const k = Math.max(1, Math.min(14, n));
    let h = "";
    for (let i = 0; i < k; i++) {
      const y = 92 - i * 6, dx = (i % 3) * 3 - 3;
      h += `<ellipse cx="${50 + dx}" cy="${y}" rx="38" ry="9" class="pz-disco"/><ellipse cx="${50 + dx}" cy="${y - 3}" rx="38" ry="9" class="pz-disco-tapa"/>`;
    }
    return `<svg class="pz-monton" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${h}</svg>`;
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

  // La cara del dragón de frente, grande: cresta, cuernos, alas a los lados, ojos de brasa y colmillos con luz de fuego dentro. Está dibujada mitad y mitad (la izquierda se refleja)
  // para que sea simétrica. Los ojos llevan la clase pz-heroe-pupila: el controlador los mueve hacia el cursor.
  function dragonHeroe() {
    const mitad = `
      <path d="M392 270 C300 190 150 120 -20 70 L-10 200 C80 214 190 250 300 330 Z" class="pz-dh-ala"/>
      <path d="M300 330 C200 250 90 214 -10 200 M330 300 C230 232 120 196 20 182" class="pz-dh-nervio" fill="none"/>
      <path d="M400 40 L368 52 L340 112 L312 168 L318 250 L346 330 L376 392 L400 404 Z" class="pz-dh-cabeza"/>
      <path d="M338 118 L246 14 L226 110 L298 154 Z" class="pz-dh-cuerno"/>
      <path d="M306 172 L186 104 L204 192 L292 216 Z" class="pz-dh-cuerno"/>
      <path d="M292 218 L196 196 L226 262 L300 262 Z" class="pz-dh-cuerno"/>
      <path d="M400 46 L388 -22 L372 56 Z M372 58 L350 -14 L338 78 Z M338 82 L304 2 L298 104 Z M302 106 L262 36 L262 130 Z" class="pz-dh-pua"/>
      <path d="M316 262 L258 292 L292 304 L330 292 Z M330 292 L284 332 L322 336 L350 318 Z M350 322 L316 362 L350 360 L368 340 Z" class="pz-dh-pua"/>
      <path d="M392 236 L360 254 L350 304 L368 352 L400 366 Z" class="pz-dh-hocico"/>
      <ellipse cx="372" cy="292" rx="9" ry="14" class="pz-dh-nariz"/>
      <path d="M392 366 L346 346 L336 318 M392 366 L352 372 L326 356" class="pz-dh-boca" fill="none"/>
      <path d="M394 362 L388 346 L380 364 Z M378 362 L370 344 L362 362 Z M360 360 L352 344 L346 358 Z M346 354 L336 338 L334 354 Z" class="pz-dh-colmillo"/>
      <path d="M316 214 Q336 196 358 204" class="pz-dh-ceja" fill="none"/>
      <ellipse cx="332" cy="222" rx="30" ry="14" transform="rotate(-16 332 222)" class="pz-dh-ojo-cuenca"/>
      <ellipse cx="332" cy="222" rx="24" ry="10" transform="rotate(-16 332 222)" class="pz-dh-iris"/>`;
    return `<svg class="pz-dragon-heroe" viewBox="0 0 800 420" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Un dragón negro de frente, con los ojos encendidos" focusable="false">
      <defs>
        <radialGradient id="pzHumo" cx=".5" cy="1" r=".75"><stop offset="0" stop-color="#e07a2c" stop-opacity=".85"/><stop offset=".45" stop-color="#8a3a18" stop-opacity=".45"/><stop offset="1" stop-color="#1a0f0a" stop-opacity="0"/></radialGradient>
        <radialGradient id="pzIris" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a"/><stop offset=".6" stop-color="#f0a22c"/><stop offset="1" stop-color="#8a3a10"/></radialGradient>
        <radialGradient id="pzLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb03a" stop-opacity=".7"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
        <g id="pzDhMitad">${mitad}</g>
      </defs>
      <ellipse cx="400" cy="430" rx="420" ry="150" fill="url(#pzHumo)"/>
      <use href="#pzDhMitad"/>
      <use href="#pzDhMitad" transform="translate(800 0) scale(-1 1)"/>
      <circle cx="332" cy="222" r="44" fill="url(#pzLuz)" class="pz-dh-luz"/><circle cx="468" cy="222" r="44" fill="url(#pzLuz)" class="pz-dh-luz"/>
      <g class="pz-heroe-pupila"><ellipse cx="332" cy="222" rx="4" ry="10" transform="rotate(-16 332 222)" class="pz-dh-pupila"/></g>
      <g class="pz-heroe-pupila"><ellipse cx="468" cy="222" rx="4" ry="10" transform="rotate(16 468 222)" class="pz-dh-pupila"/></g>
      <ellipse cx="400" cy="362" rx="46" ry="14" fill="#ff9a2a" opacity=".35" class="pz-dh-fuego"/>
    </svg>`;
  }

  // El ojo del dragón que vigila la mesa mientras juegas: se estrecha cuando es tu turno y se enciende con una Ruina o un premio grande (la clase la pone el controlador)
  function ojoVigia() {
    return `<svg class="pz-vigia-ojo" viewBox="0 0 240 110" focusable="false" aria-hidden="true">
      <path d="M6 55 C50 6 190 6 234 55 C190 104 50 104 6 55 Z" class="pz-vi-parpado"/>
      <circle cx="120" cy="55" r="38" class="pz-vi-iris"/><circle cx="120" cy="55" r="32" class="pz-vi-iris2"/>
      <ellipse cx="120" cy="55" rx="9" ry="34" class="pz-vi-pupila"/>
      <circle cx="105" cy="38" r="5" class="pz-vi-brillo"/>
    </svg>`;
  }

  return { dado, ojo, emblema, moneda, monton, dragon, dragonHeroe, ojoVigia, ejemplo, EJEMPLOS };
})();
