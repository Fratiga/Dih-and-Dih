/* =============================================================================
   LAS VEINTIUNA VELAS: el arte (todo SVG dibujado aquí; no hay imágenes ni archivos que puedan faltar)
   Aquí no hay reglas ni red: solo funciones que devuelven el dibujo de las cartas, el dorso, la crupier, las fichas, los iconos de las reglas
   y el tapete. veintiuna-mesa.js las usa para pintar y veintiuna.css para darles vida.
   Palos (número de palo del servidor): 0 picas, 1 corazones, 2 diamantes, 3 tréboles.
============================================================================= */
window.VeintiunaArte = (function () {
  const PALOS = [
    { id: "picas", nombre: "picas", color: "negro" },
    { id: "corazones", nombre: "corazones", color: "rojo" },
    { id: "diamantes", nombre: "diamantes", color: "rojo" },
    { id: "treboles", nombre: "tréboles", color: "negro" }
  ];
  const RANGOS = { 1: "as", 11: "jota", 12: "reina", 13: "rey" };
  const LETRAS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const nombreRango = r => RANGOS[r] || String(r);
  const letraRango = r => LETRAS[r] || String(r);
  // «as de picas», «10 de corazones»... para lectores de pantalla y descripciones
  const nombreCarta = c => `${nombreRango(c.r)} de ${PALOS[c.p].nombre}`;

  /* ---------------------------------------------------------------- símbolos compartidos (un solo <svg> oculto en la página) */
  function sprite() {
    return `<svg class="vv-sprite" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
  <defs>
    <symbol id="vv-picas" viewBox="0 0 100 100"><path d="M50 4C54 22 92 38 92 62c0 15-12 24-25 24-7 0-13-3-17-9 1 9 5 15 14 19H36c9-4 13-10 14-19-4 6-10 9-17 9C20 86 8 77 8 62 8 38 46 22 50 4Z"/></symbol>
    <symbol id="vv-corazones" viewBox="0 0 100 100"><path d="M50 92C20 68 6 50 6 31 6 17 17 7 30 7c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 24 0 19-14 37-44 61Z"/></symbol>
    <symbol id="vv-diamantes" viewBox="0 0 100 100"><path d="M50 3C58 24 74 40 93 50 74 60 58 76 50 97 42 76 26 60 7 50 26 40 42 24 50 3Z"/></symbol>
    <symbol id="vv-treboles" viewBox="0 0 100 100"><circle cx="50" cy="27" r="19"/><circle cx="27" cy="62" r="19"/><circle cx="73" cy="62" r="19"/><circle cx="50" cy="50" r="13"/><path d="M50 52C50 72 46 86 35 97h30C54 86 50 72 50 52Z"/></symbol>
    <symbol id="vv-llama" viewBox="0 0 40 60"><path d="M20 2C26 14 36 24 36 38c0 12-7 20-16 20S4 50 4 38C4 29 9 24 12 17c3 5 4 8 6 8 1-7 0-14 2-23Z"/></symbol>
    <symbol id="vv-moneda" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="currentColor"/><circle cx="20" cy="20" r="13" fill="none" stroke="#00000055" stroke-width="2"/><path d="M20 10v20M14 15h9a3.5 3.5 0 0 1 0 7h-6a3.5 3.5 0 0 0 0 7h9" fill="none" stroke="#0000007a" stroke-width="2.4" stroke-linecap="round"/></symbol>
    <linearGradient id="vv-g-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d98a"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#8a6420"/></linearGradient>
    <radialGradient id="vv-g-cera" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#fbf3dc"/><stop offset=".6" stop-color="#e6d6ae"/><stop offset="1" stop-color="#bba67a"/></radialGradient>
    <radialGradient id="vv-g-brillo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff9b3a" stop-opacity=".35"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
    <linearGradient id="vv-g-capa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1830"/><stop offset="1" stop-color="#0d0812"/></linearGradient>
  </defs>
</svg>`;
  }

  /* ---------------------------------------------------------------- cartas */
  // Dónde van los símbolos de cada número, sobre una carta de 100 x 140 (columnas 30/50/70)
  const COL = [30, 50, 70];
  const PIPS = {
    2: [[50, 32], [50, 108]],
    3: [[50, 32], [50, 70], [50, 108]],
    4: [[30, 32], [70, 32], [30, 108], [70, 108]],
    5: [[30, 32], [70, 32], [50, 70], [30, 108], [70, 108]],
    6: [[30, 32], [70, 32], [30, 70], [70, 70], [30, 108], [70, 108]],
    7: [[30, 32], [70, 32], [50, 51], [30, 70], [70, 70], [30, 108], [70, 108]],
    8: [[30, 32], [70, 32], [50, 51], [30, 70], [70, 70], [50, 89], [30, 108], [70, 108]],
    9: [[30, 30], [70, 30], [30, 56], [70, 56], [50, 70], [30, 84], [70, 84], [30, 110], [70, 110]],
    10: [[30, 30], [70, 30], [50, 44], [30, 56], [70, 56], [30, 84], [70, 84], [50, 96], [30, 110], [70, 110]]
  };
  const pip = (palo, x, y, tam, giro) =>
    `<use href="#vv-${PALOS[palo].id}" x="${x - tam / 2}" y="${y - tam / 2}" width="${tam}" height="${tam}"${giro ? ` transform="rotate(180 ${x} ${y})"` : ""}/>`;

  // El adorno de las figuras: una espada, una corona con vela y una corona de rey
  function emblemaFigura(r) {
    if (r === 11) return `<g class="vv-fig-oro"><path d="M50 30v44" stroke="url(#vv-g-oro)" stroke-width="5" stroke-linecap="round"/><path d="M50 22l5 8h-10z" fill="url(#vv-g-oro)"/><rect x="37" y="73" width="26" height="5" rx="2" fill="url(#vv-g-oro)"/><rect x="47" y="78" width="6" height="14" fill="url(#vv-g-oro)"/><circle cx="50" cy="95" r="4" fill="url(#vv-g-oro)"/></g>`;
    if (r === 12) return `<g class="vv-fig-oro"><path d="M30 74l-4-26 14 12 10-18 10 18 14-12-4 26z" fill="url(#vv-g-oro)"/><rect x="30" y="76" width="40" height="6" rx="2" fill="url(#vv-g-oro)"/><path d="M50 26c3 6 7 8 7 13a7 7 0 0 1-14 0c0-5 4-7 7-13z" fill="#ffb24a"/></g>`;
    return `<g class="vv-fig-oro"><path d="M28 78l-3-30 15 12 10-20 10 20 15-12-3 30z" fill="url(#vv-g-oro)"/><rect x="28" y="80" width="44" height="7" rx="2" fill="url(#vv-g-oro)"/><path d="M50 18v14M44 24h12" stroke="url(#vv-g-oro)" stroke-width="4" stroke-linecap="round"/></g>`;
  }

  // La cara de una carta (viewBox 100 x 140). c = { r: 1..13, p: 0..3, as1?: true }
  function cara(c) {
    const color = PALOS[c.p].color === "rojo" ? "rojo" : "negro";
    const letra = letraRango(c.r);
    const esFigura = c.r >= 11;
    let centro;
    if (c.r === 1) {
      centro = `<g class="vv-as">${pip(c.p, 50, 70, 46)}<circle cx="50" cy="70" r="33" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="2 3"/></g>`;
    } else if (esFigura) {
      centro = `<rect x="23" y="20" width="54" height="100" rx="5" fill="none" stroke="url(#vv-g-oro)" stroke-width="1.6"/>
        <rect x="26.5" y="23.5" width="47" height="93" rx="3" fill="currentColor" fill-opacity=".07"/>
        ${emblemaFigura(c.r)}
        <text x="50" y="118" class="vv-fig-letra" text-anchor="middle" font-size="22" fill="currentColor">${letra}</text>
        ${pip(c.p, 33, 33, 11)}${pip(c.p, 67, 107, 11, true)}`;
    } else {
      const tam = c.r >= 9 ? 19 : 23;
      centro = (PIPS[c.r] || []).map(([x, y]) => pip(c.p, x, y, tam, y > 70)).join("");
    }
    const as1 = c.as1 ? `<g class="vv-as1"><rect x="14" y="56" width="72" height="28" rx="14" fill="#14301f" stroke="url(#vv-g-oro)" stroke-width="1.5"/><text x="50" y="75" text-anchor="middle" font-size="15" fill="#f6d98a" class="vv-fig-letra">vale 1</text></g>` : "";
    return `<svg class="vv-cara ${color}" viewBox="0 0 100 140" role="img" aria-label="${nombreCarta(c)}${c.as1 ? ", convertida en un as de valor 1" : ""}" focusable="false">
      <rect x="1" y="1" width="98" height="138" rx="9" class="vv-papel"/>
      <rect x="5" y="5" width="90" height="130" rx="6" fill="none" class="vv-filete"/>
      <g fill="currentColor" class="vv-trazo">
        <text x="9" y="25" class="vv-indice" font-size="${letra.length > 1 ? 17 : 21}">${letra}</text>${pip(c.p, 15, 37, 12)}
        <g transform="rotate(180 50 70)"><text x="9" y="25" class="vv-indice" font-size="${letra.length > 1 ? 17 : 21}">${letra}</text>${pip(c.p, 15, 37, 12)}</g>
        ${centro}
      </g>${as1}
    </svg>`;
  }

  // El dorso: vino con celosía de oro y un anillo de veintiuna llamas alrededor de una vela
  function dorso() {
    let llamas = "";
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(a) * 26, y = 70 + Math.sin(a) * 26;
      llamas += `<use href="#vv-llama" x="${(x - 2.6).toFixed(1)}" y="${(y - 3.9).toFixed(1)}" width="5.2" height="7.8" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    return `<svg class="vv-dorso" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
      <defs><pattern id="vv-celosia" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 6h12M6 0v12" stroke="#d9a441" stroke-opacity=".28" stroke-width=".8"/></pattern></defs>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="#4a1220"/>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="url(#vv-celosia)"/>
      <rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="url(#vv-g-oro)" stroke-width="1.6"/>
      <rect x="10" y="10" width="80" height="120" rx="4" fill="none" stroke="#d9a441" stroke-opacity=".5" stroke-width=".8"/>
      <circle cx="50" cy="70" r="33" fill="#2a0a14" stroke="url(#vv-g-oro)" stroke-width="1.4"/>
      <circle cx="50" cy="70" r="31" fill="none" stroke="#d9a441" stroke-opacity=".5" stroke-dasharray="1 3"/>
      <g fill="#ffb24a">${llamas}</g>
      <g><rect x="46.5" y="62" width="7" height="22" rx="1.5" fill="#f2e6c6"/><use href="#vv-llama" x="45" y="46" width="10" height="16" fill="#ffb24a"/><use href="#vv-llama" x="47" y="51" width="6" height="10" fill="#fff0b0"/></g>
      <text x="50" y="22" text-anchor="middle" font-size="9" fill="#d9a441" class="vv-fig-letra">XXI</text>
      <g transform="rotate(180 50 70)"><text x="50" y="22" text-anchor="middle" font-size="9" fill="#d9a441" class="vv-fig-letra">XXI</text></g>
    </svg>`;
  }

  // Una carta entera, con sus dos lados para poder girarla
  function carta(c, oculta) {
    const etiqueta = oculta ? "carta oculta" : nombreCarta(c);
    return `<div class="vv-carta${oculta ? " vv-boca-abajo" : ""}" data-r="${c ? c.r : ""}" data-p="${c ? c.p : ""}" role="img" aria-label="${etiqueta}${c && c.as1 ? ", convertida en un as de valor 1" : ""}">
      <div class="vv-carta-giro"><div class="vv-lado vv-lado-cara">${oculta ? "" : cara(c)}</div><div class="vv-lado vv-lado-dorso">${dorso()}</div></div></div>`;
  }

  /* ---------------------------------------------------------------- fichas de apuesta */
  const FICHAS = { 10: ["#2c6b57", "#cfe9de"], 20: ["#7d2331", "#f3d6da"], 50: ["#244a7a", "#d6e4f7"], 100: ["#26202c", "#e6c36a"] };
  function ficha(valor) {
    const [fondo, filo] = FICHAS[valor] || ["#5a4a2a", "#f6e3b0"];
    let marcas = "";
    for (let i = 0; i < 8; i++) marcas += `<rect x="46" y="3" width="8" height="14" rx="1.5" transform="rotate(${i * 45} 50 50)" fill="${filo}"/>`;
    return `<svg class="vv-ficha-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="48" fill="${fondo}" stroke="#00000066" stroke-width="2"/>
      ${marcas}
      <circle cx="50" cy="50" r="31" fill="${fondo}" stroke="${filo}" stroke-width="2.4"/>
      <circle cx="50" cy="50" r="27" fill="none" stroke="${filo}" stroke-opacity=".55" stroke-dasharray="2 3"/>
      <text x="50" y="59" text-anchor="middle" font-size="${String(valor).length > 2 ? 21 : 26}" class="vv-fig-letra" fill="${filo}">${valor}</text>
    </svg>`;
  }

  /* ---------------------------------------------------------------- iconos de las reglas */
  const ICONOS = {
    // Un trébol de cuatro hojas sobre un token
    fortuna: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#14301f" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <g fill="#8fd18b"><path d="M32 30c-8-12-20-4-14 4 3 4 10 3 14-4z"/><path d="M32 30c8-12 20-4 14 4-3 4-10 3-14-4z"/><path d="M32 34c-8 12-20 4-14-4 3-4 10-3 14 4z"/><path d="M32 34c8 12 20 4 14-4-3-4-10-3-14 4z"/></g>
      <path d="M32 34c0 8 2 13 7 17" stroke="#8fd18b" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
    // Una corona agrietada
    maldicion: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#2a0e18" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <path d="M14 44l-3-20 11 9 10-15 10 15 11-9-3 20z" fill="#b8323f" stroke="#f6d98a" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="14" y="45" width="36" height="5" rx="1.5" fill="#8a1e2b" stroke="#f6d98a" stroke-width="1.2"/>
      <path d="M33 21l-4 9 6 4-5 10" stroke="#1a0a10" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    // Un pergamino con sello de cera
    voluntad: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#1b1730" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <path d="M18 15h28a4 4 0 0 1 4 4v22a5 5 0 0 1-5 5H20a4 4 0 0 0 0-8h-4V19a4 4 0 0 1 2-4z" fill="#efe3c3" stroke="#8a6420" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M22 24h22M22 29h22M22 34h14" stroke="#7a5a2a" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="42" cy="42" r="8" fill="#a8202f" stroke="#5a0f18" stroke-width="1.2"/><path d="M42 37v10M37 42h10" stroke="#f3b6bd" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    // Un ojo sobre una carta
    ojo: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#102a33" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <rect x="20" y="12" width="24" height="34" rx="3" fill="#efe3c3" stroke="#8a6420" stroke-width="1.2" transform="rotate(-8 32 29)"/>
      <path d="M8 38c6-10 14-15 24-15s18 5 24 15c-6 10-14 15-24 15S14 48 8 38z" fill="#0d1d24" stroke="#f6d98a" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="32" cy="38" r="9" fill="#58c7d6" stroke="#f6d98a" stroke-width="1.4"/><circle cx="32" cy="38" r="4.2" fill="#06161c"/><circle cx="34.4" cy="35.6" r="1.6" fill="#fff"/></svg>`,
    // Una carta con marcas en el dorso
    marcadas: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#2b1a0c" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <rect x="19" y="11" width="26" height="38" rx="3.5" fill="#7a1f2b" stroke="#f6d98a" stroke-width="1.4" transform="rotate(7 32 30)"/>
      <g transform="rotate(7 32 30)" fill="none" stroke="#f6d98a" stroke-width="1.2" stroke-opacity=".8"><rect x="23" y="15" width="18" height="30" rx="2"/><path d="M32 22l5 8-5 8-5-8z"/></g>
      <path d="M43 45l9 9" stroke="#f6d98a" stroke-width="3" stroke-linecap="round"/><circle cx="37" cy="39" r="9" fill="#ffffff22" stroke="#f6d98a" stroke-width="2.2"/></svg>`,
    // Dos cartas que se cruzan
    trueque: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#2a2310" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <rect x="12" y="18" width="19" height="27" rx="3" fill="#efe3c3" stroke="#8a6420" stroke-width="1.2" transform="rotate(-10 21 31)"/>
      <rect x="33" y="19" width="19" height="27" rx="3" fill="#7a1f2b" stroke="#f6d98a" stroke-width="1.2" transform="rotate(10 43 32)"/>
      <path d="M22 16c6-6 14-6 20 0M42 49c-6 6-14 6-20 0" fill="none" stroke="#f6d98a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M42 11l1 6-6-1M22 54l-1-6 6 1" fill="none" stroke="#f6d98a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    // Una vela consumida a medias
    vela: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#2c1b13" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <path d="M24 36h16l1 16H23z" fill="#efe3c3" stroke="#8a6420" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M24 36c0 5-3 7-3 10s3 3 3-1" fill="#efe3c3" stroke="#8a6420" stroke-width="1.2" stroke-linejoin="round"/>
      <rect x="19" y="50" width="26" height="4" rx="1.5" fill="#6a4d2a" stroke="#f6d98a" stroke-width="1"/>
      <path d="M32 36v-5" stroke="#241a14" stroke-width="2" stroke-linecap="round"/>
      <path d="M32 11c5 6 7 10 7 14a7 7 0 0 1-14 0c0-4 2-8 7-14z" fill="#ffb24a" stroke="#f6d98a" stroke-width="1.2"/><path d="M32 18c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="#fff3b0"/></svg>`,
    // Un gorro de bufón con cascabeles
    bufon: `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" fill="#241334" stroke="url(#vv-g-oro)" stroke-width="2.4"/>
      <path d="M12 44c0-14 4-24 12-30 2 6 4 8 8 10 4-2 6-4 8-10 8 6 12 16 12 30z" fill="#6a2fa8" stroke="#f6d98a" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M32 24c-3 6-3 14 0 20 3-6 3-14 0-20z" fill="#d7a62f" stroke="#f6d98a" stroke-width="1"/>
      <rect x="11" y="43" width="42" height="7" rx="3" fill="#d7a62f" stroke="#7a5a1a" stroke-width="1.2"/>
      <circle cx="24" cy="13" r="4" fill="#f6d98a" stroke="#7a5a1a" stroke-width="1"/><circle cx="40" cy="13" r="4" fill="#f6d98a" stroke="#7a5a1a" stroke-width="1"/></svg>`
  };

  /* ---------------------------------------------------------------- el emblema de la cabecera */
  function emblema() {
    let aro = "";
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2 - Math.PI / 2, x = 50 + Math.cos(a) * 41, y = 50 + Math.sin(a) * 41;
      aro += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a * 180 / Math.PI + 90).toFixed(1)})"><rect x="-1.6" y="-1" width="3.2" height="7" rx=".8" fill="#f2e6c6"/><use href="#vv-llama" x="-2.2" y="-6.6" width="4.4" height="6.6" fill="#ffb24a" class="vv-emblema-llama" style="--i:${i}"/></g>`;
    }
    return `<svg class="vv-emblema" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="34" fill="#0d0a12" stroke="url(#vv-g-oro)" stroke-width="2"/>
      ${aro}
      <text x="50" y="62" text-anchor="middle" font-size="34" class="vv-fig-letra" fill="url(#vv-g-oro)">21</text>
    </svg>`;
  }

  /* ---------------------------------------------------------------- la crupier: Cera, de rostro de cera y corona de velas */
  function crupier() {
    // Una vela: cuerpo de cera, gotas y llama doble
    const vela = (x, alto, i) => `<g class="vv-cr-vela" style="--i:${i}">
      <rect x="${x - 4.5}" y="${92 - alto}" width="9" height="${alto + 6}" rx="2" fill="#f6edd3" stroke="#c9b88c" stroke-width=".8"/>
      <path d="M${x - 4.5} ${92 - alto + 3}c0 7 2 9 3 9s1 3-1 7M${x + 4.5} ${92 - alto + 3}c0 5-1 7-2 7" stroke="#fffaf0" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>
      <g class="vv-cr-llama"><use href="#vv-llama" x="${x - 7}" y="${92 - alto - 23}" width="14" height="21" fill="#ffb24a"/><use href="#vv-llama" x="${x - 3.5}" y="${92 - alto - 15}" width="7" height="12" fill="#fff4c4"/></g>
    </g>`;
    return `<svg class="vv-cr" viewBox="0 0 260 320" role="img" aria-label="Cera, la crupier: una figura de cera con una corona de velas encendidas" focusable="false">
  <circle class="vv-cr-aura" cx="130" cy="124" r="118" fill="url(#vv-g-brillo)"/>
  <!-- capucha y capa -->
  <path d="M30 320c2-96 26-170 100-200 74 30 98 104 100 200z" fill="#0c0610"/>
  <path d="M8 320c6-72 30-116 72-134l50 20 50-20c42 18 66 62 72 134z" fill="url(#vv-g-capa)"/>
  <path d="M60 232c20-22 44-34 70-34s50 12 70 34" fill="none" stroke="#d9a441" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 5"/>
  <!-- cuello alto con filigrana -->
  <path d="M84 196l46 30 46-30 14 24-60 44-60-44z" fill="#150b1a" stroke="url(#vv-g-oro)" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M96 204l34 24 34-24M104 214l26 19 26-19" fill="none" stroke="#d9a441" stroke-width="1.2" stroke-opacity=".7"/>
  <circle cx="130" cy="238" r="5" fill="#a8202f" stroke="url(#vv-g-oro)" stroke-width="1.6"/>
  <g class="vv-cr-cabeza">
    <!-- corona de velas -->
    <path d="M72 96c8-12 30-17 58-17s50 5 58 17" fill="none" stroke="url(#vv-g-oro)" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M72 96c8-12 30-17 58-17s50 5 58 17" fill="none" stroke="#fff1bd" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 7"/>
    ${vela(80, 17, 0)}${vela(105, 29, 1)}${vela(130, 38, 2)}${vela(155, 27, 3)}${vela(180, 16, 4)}
    <!-- rostro de cera -->
    <path d="M82 140c0-36 20-56 48-56s48 20 48 56c0 36-14 66-48 74-34-8-48-38-48-74z" fill="url(#vv-g-cera)" stroke="#a89468" stroke-width="1.6"/>
    <path d="M172 112c6 12 8 30 4 46-5 22-17 40-36 50 24-6 40-28 44-54 3-18-2-32-12-42z" fill="#8f7a52" opacity=".26"/>
    <path d="M90 118c14-8 28-10 40-10s26 2 40 10" fill="none" stroke="#fffaf0" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
    <!-- gotas de cera que bajan de la corona -->
    <path d="M97 98c1 9 0 15-3 19-3 3-6 1-5-3 2-5 6-9 8-16z" fill="#fbf4de" stroke="#d6c79c" stroke-width=".8"/>
    <path d="M168 97c2 7 5 11 6 16 1 4-3 6-6 2-3-5-2-11 0-18z" fill="#fbf4de" stroke="#d6c79c" stroke-width=".8"/>
    <path d="M131 93c0 7 1 11 0 14-1 3-4 2-4-1 0-5 3-8 4-13z" fill="#fbf4de" stroke="#d6c79c" stroke-width=".8"/>
    <!-- grieta reparada con oro (kintsugi) -->
    <path d="M154 106l-9 13 8 9-9 14 6 8" fill="none" stroke="url(#vv-g-oro)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M154 106l-9 13 8 9-9 14 6 8" fill="none" stroke="#fff1bd" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
    <!-- nariz y pómulos -->
    <path d="M130 140c-2 12-5 21-8 26 4 4 12 4 16 0-3-5-6-14-8-26z" fill="#e6d7ae" stroke="#a89468" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M122 166c2 2 6 3 8 3s6-1 8-3" fill="none" stroke="#a89468" stroke-width="1.3" stroke-linecap="round"/>
    <!-- cejas -->
    <g class="vv-cr-cejas" stroke="#2e2019" stroke-width="3.6" fill="none" stroke-linecap="round">
      <path class="vv-ce-calma" d="M98 127c8-4 16-4 24 0M138 127c8-4 16-4 24 0"/>
      <path class="vv-ce-alza" d="M98 123c8-8 16-8 24-2M138 119c8-6 16-6 24 2"/>
      <path class="vv-ce-baja" d="M98 123c8 2 16 6 24 8M138 131c8-2 16-6 24-8"/>
    </g>
    <!-- ojos -->
    <g class="vv-cr-ojos">
      <g class="vv-oj-calma"><path d="M99 141c7-8 17-8 24 0-7 5-17 5-24 0z" fill="#1b1318"/><path d="M137 141c7-8 17-8 24 0-7 5-17 5-24 0z" fill="#1b1318"/><circle cx="111" cy="140.5" r="2.6" fill="#d9a441"/><circle cx="149" cy="140.5" r="2.6" fill="#d9a441"/><path d="M98 140h26M136 140h26" stroke="#2e2019" stroke-width="2.4" opacity=".6"/><path d="M123 141l4 2M137 141l-4 2" stroke="#2e2019" stroke-width="1.2" opacity=".5"/></g>
      <g class="vv-oj-atentos"><ellipse cx="111" cy="141" rx="11.5" ry="9.5" fill="#fffaf0" stroke="#2e2019" stroke-width="1.6"/><ellipse cx="149" cy="141" rx="11.5" ry="9.5" fill="#fffaf0" stroke="#2e2019" stroke-width="1.6"/><circle class="vv-pupila" cx="111" cy="142" r="5.4" fill="#1b1318"/><circle class="vv-pupila" cx="149" cy="142" r="5.4" fill="#1b1318"/><circle cx="113" cy="140" r="1.7" fill="#ffd27a"/><circle cx="151" cy="140" r="1.7" fill="#ffd27a"/></g>
      <g class="vv-oj-sonrisa" fill="none" stroke="#1b1318" stroke-width="4.6" stroke-linecap="round"><path d="M100 146c6-10 16-10 22 0M138 146c6-10 16-10 22 0"/></g>
      <g class="vv-oj-asombro"><ellipse cx="111" cy="140" rx="12.5" ry="12.5" fill="#fffaf0" stroke="#2e2019" stroke-width="1.6"/><ellipse cx="149" cy="140" rx="12.5" ry="12.5" fill="#fffaf0" stroke="#2e2019" stroke-width="1.6"/><circle cx="111" cy="140" r="3.6" fill="#1b1318"/><circle cx="149" cy="140" r="3.6" fill="#1b1318"/></g>
      <g class="vv-oj-bajos" fill="none" stroke="#1b1318" stroke-width="3.8" stroke-linecap="round"><path d="M99 141c7 7 17 7 24 0M137 141c7 7 17 7 24 0"/><path d="M103 148c2 3 5 3 8 2M149 150c3 1 6 0 8-2" stroke-width="2" opacity=".55"/></g>
    </g>
    <!-- boca -->
    <g class="vv-cr-boca" stroke-linecap="round" stroke-linejoin="round">
      <path class="vv-bo-calma" d="M112 187c6-3 12-3 18-1 6-2 12-2 18 1-5 5-13 7-18 7s-13-2-18-7z" fill="#a8505a" stroke="#6b2a30" stroke-width="1.6"/>
      <path class="vv-bo-ladea" d="M112 188c6-1 12 0 18 0s14-2 20-8c-1 7-6 14-18 14-9 0-17-2-20-6z" fill="#a8505a" stroke="#6b2a30" stroke-width="1.6"/>
      <g class="vv-bo-gran"><path d="M108 178c14 18 30 18 44 0z" fill="#3b1218" stroke="#6b2a30" stroke-width="2"/><path d="M113 180c10 4 24 4 34 0v4c-10 4-24 4-34 0z" fill="#fff4dc"/></g>
      <path class="vv-bo-triste" d="M112 192c12-7 24-7 36 0" fill="none" stroke="#6b2a30" stroke-width="3.4"/>
      <ellipse class="vv-bo-o" cx="130" cy="187" rx="7.5" ry="9" fill="#3b1218" stroke="#6b2a30" stroke-width="1.6"/>
    </g>
    <!-- mejillas -->
    <ellipse cx="94" cy="168" rx="9" ry="6" fill="#e4a898" opacity=".4"/><ellipse cx="166" cy="168" rx="9" ry="6" fill="#e4a898" opacity=".4"/>
  </g>
  <!-- manos enguantadas sobre la mesa -->
  <g class="vv-cr-manos">
    <g class="vv-cr-mano-i"><path d="M20 316c0-26 12-48 34-50l30 8c8 4 6 14-4 16l-26 4c-4 14-12 22-34 22z" fill="#f4eee0" stroke="#bfb08a" stroke-width="1.4"/><rect x="8" y="300" width="42" height="16" rx="3" fill="#3a1a2a" stroke="url(#vv-g-oro)" stroke-width="1.4"/></g>
    <g class="vv-cr-mano-d"><path d="M240 316c0-26-12-48-34-50l-30 8c-8 4-6 14 4 16l26 4c4 14 12 22 34 22z" fill="#f4eee0" stroke="#bfb08a" stroke-width="1.4"/><rect x="210" y="300" width="42" height="16" rx="3" fill="#3a1a2a" stroke="url(#vv-g-oro)" stroke-width="1.4"/></g>
  </g>
</svg>`;
  }

  /* ---------------------------------------------------------------- tapete: el dibujo que va debajo de las cartas */
  function tapete() {
    let velas = "";
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2 - Math.PI / 2, x = 600 + Math.cos(a) * 178, y = 350 + Math.sin(a) * 178;
      velas += `<use href="#vv-llama" x="${(x - 5).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="10" height="15"/>`;
    }
    return `<svg class="vv-tapete-svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <filter id="vv-ruido" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
        <pattern id="vv-trama" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0h6" stroke="#ffffff" stroke-opacity=".035" stroke-width="1"/></pattern>
      </defs>
      <rect width="1200" height="700" fill="url(#vv-trama)"/>
      <rect width="1200" height="700" filter="url(#vv-ruido)"/>
      <g class="vv-tapete-adorno" fill="none" stroke="#d9a441" stroke-opacity=".30" stroke-width="1.6">
        <circle cx="600" cy="350" r="178"/><circle cx="600" cy="350" r="146" stroke-dasharray="2 8"/><circle cx="600" cy="350" r="222" stroke-opacity=".14"/>
      </g>
      <g fill="#d9a441" fill-opacity=".28">${velas}</g>
      <g class="vv-tapete-esquinas" fill="none" stroke="#d9a441" stroke-opacity=".34" stroke-width="2">
        <path d="M34 34h70M34 34v70"/><path d="M1166 34h-70M1166 34v70"/>
      </g>
    </svg>`;
  }

  return { PALOS, nombreCarta, nombreRango, letraRango, sprite, cara, dorso, carta, ficha, ICONOS, emblema, crupier, tapete };
})();
