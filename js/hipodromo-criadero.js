/* =============================================================================
   HIPÓDROMO: el criadero. La escena donde viven las criaturas del jugador (pestaña «Mi cuadra»).

   No dibuja criaturas nuevas ni calcula nada del juego: reutiliza el dibujo en piezas (js/hipodromo-dibujo.js con la opción vivo) y los títeres con
   cinemática inversa de la pista en vivo (js/hipodromo-vida.js: pastar, mirar, caminar, sentarse, echarse, saludar). Esta pieza añade:
   - el escenario ilustrado (pradera, camino, árboles, cercas) y los objetos con función: comederos, bebedero, refugio, cama de heno de la zona de
     recuperación, poste para rascarse y pelota de las crías;
   - un plan por criatura (a qué objeto va y qué hace allí) que depende de su carácter (manías), de si es una cría, de si está lesionada o cansada;
   - la selección directa: pulsar una criatura la elige y la pestaña enseña su ficha.
   Las posiciones son solo de esta pantalla (no se guardan). Lo que pasa en el escenario no cambia la economía, la genética ni las carreras.

   Uso: const escena = HipodromoCriadero.crear(api, { alSeleccionar(id) }); escena.nodo (el elemento), escena.sincronizar(mias), escena.activar(bool),
   escena.seleccionar(id), escena.efecto(id, "cuidar").
============================================================================= */
window.HipodromoCriadero = (function () {
  "use strict";
  const V = window.HipodromoVida, D = window.HipodromoDibujo, U = V.util;
  const { clamp, lerp, acerca, azar } = U;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  /* Dónde está cada objeto (x en metros de escenario, que son el % del ancho; f de 0 cerca a 1 lejos) y dónde se ponen las criaturas para usarlo.
     dir: hacia dónde miran al llegar (1 derecha, -1 izquierda). */
  const OBJ = {
    comedero: { x: 17, f: 0.42, w: 12, spots: [{ x: 8.2, f: 0.42, dir: 1 }, { x: 25.8, f: 0.42, dir: -1 }], cartel: "Alimentación" },
    bebedero: { x: 36, f: 0.34, w: 11, spots: [{ x: 27.5, f: 0.34, dir: 1 }, { x: 44.5, f: 0.34, dir: -1 }] },
    refugio: { x: 78, f: 0.9, w: 30, spots: [{ x: 68, f: 0.84, dir: 1 }, { x: 78, f: 0.86, dir: -1 }], cartel: "Refugio" },
    heno: { x: 88, f: 0.5, w: 15, spots: [{ x: 87, f: 0.5, dir: -1 }], cartel: "Recuperación" },
    rascador: { x: 62, f: 0.6, w: 6, spots: [{ x: 56, f: 0.6, dir: 1 }, { x: 68, f: 0.6, dir: -1 }] },
    pelota: { x: 49, f: 0.14, w: 5, spots: [{ x: 49, f: 0.14, dir: 1 }], cartel: "Crías" }
  };
  const ESC_F = 0.34;                                   // cuánto se encoge una criatura al irse al fondo
  const Y0 = 0.935, Y1 = 0.50;                           // altura (fracción del alto) del primer plano y del fondo de la pradera
  const ANCHO_BASE = 0.2;                               // lo que mide una criatura adulta, en fracción del ancho
  let HipodromoCriaderoUltima = null;                    // la última escena creada (solo para probarla desde la consola)

  /* ---------------------------------------------------------------- los dibujos de los objetos */
  const SVG = {
    comedero: `<svg viewBox="0 0 120 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="58" rx="54" ry="5" fill="#000" opacity=".25"/>
      <path d="M14 30 L22 58 M106 30 L98 58 M60 36 L60 58" stroke="#4a2f19" stroke-width="6" stroke-linecap="round"/>
      <path d="M8 22 L112 22 L104 46 L16 46 Z" fill="#8a5a31" stroke="#3b2412" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M12 30 H108 M15 38 H105" stroke="#6b4423" stroke-width="1.6" opacity=".8"/><path d="M8 22 L112 22 L110 27 L10 27 Z" fill="#a8723f"/>
      <path d="M16 24 C20 8 30 14 34 6 C38 14 46 8 52 4 C56 12 66 8 70 2 C74 10 84 8 88 12 C94 8 100 14 104 24 Z" fill="#c8b25b" stroke="#8a7a2c" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M30 20 L38 10 M48 20 L56 8 M68 20 L76 8 M86 20 L92 12" stroke="#e6d78a" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    bebedero: `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="54" rx="52" ry="5" fill="#000" opacity=".25"/>
      <path d="M14 22 L22 52 H98 L106 22 Z" fill="#5d6b73" stroke="#2b343a" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M22 52 H98 L100 46 H20 Z" fill="#46535a"/><path d="M26 30 H94 M24 38 H96" stroke="#7d8d96" stroke-width="1.4" opacity=".7"/>
      <ellipse cx="60" cy="22" rx="46" ry="9" fill="#2b343a"/><ellipse cx="60" cy="22" rx="43" ry="7.2" fill="#6fb6cf"/>
      <path d="M30 21 C40 18 50 24 62 21 C72 18 80 23 90 21" stroke="#c6ecf7" stroke-width="1.6" fill="none" stroke-linecap="round"><animate attributeName="d" dur="3s" repeatCount="indefinite" values="M30 21 C40 18 50 24 62 21 C72 18 80 23 90 21;M30 21 C40 24 50 18 62 21 C72 24 80 19 90 21;M30 21 C40 18 50 24 62 21 C72 18 80 23 90 21"/></path>
      <ellipse cx="44" cy="19.5" rx="8" ry="2" fill="#fff" opacity=".35"/></svg>`,
    refugio: `<svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg"><ellipse cx="150" cy="178" rx="140" ry="9" fill="#000" opacity=".22"/>
      <rect x="20" y="64" width="260" height="112" fill="#6b4a2c"/><path d="M20 64 H280 V176 H20 Z" fill="none" stroke="#3b2412" stroke-width="3"/>
      <path d="M50 64 V176 M80 64 V176 M110 64 V176 M140 64 V176 M170 64 V176 M200 64 V176 M230 64 V176 M260 64 V176" stroke="#4d3320" stroke-width="2.4"/>
      <rect x="20" y="64" width="260" height="112" fill="#1b130c" opacity=".38"/>
      <path d="M96 176 V120 Q96 100 130 100 H170 Q204 100 204 120 V176 Z" fill="#150e08" opacity=".55"/>
      <path d="M40 176 C70 160 110 168 150 164 C190 168 230 160 262 176 Z" fill="#b69d4c" opacity=".7"/>
      <path d="M4 66 L150 6 L296 66 Z" fill="#7a3b2a" stroke="#2f1710" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M22 62 L150 12 M60 62 L150 22 M100 62 L150 34 M278 62 L150 12 M240 62 L150 22 M200 62 L150 34" stroke="#a24f38" stroke-width="2" opacity=".7"/>
      <path d="M4 66 H296 L290 76 H10 Z" fill="#4a2a1a"/><rect x="12" y="70" width="10" height="106" fill="#5a3b21" stroke="#2f1d10" stroke-width="2.4"/><rect x="278" y="70" width="10" height="106" fill="#5a3b21" stroke="#2f1d10" stroke-width="2.4"/>
      <path d="M150 76 V88" stroke="#2f1d10" stroke-width="2"/><path d="M143 88 H157 L155 102 H145 Z" fill="#f2c14e" stroke="#2f1d10" stroke-width="2"/><circle cx="150" cy="96" r="14" fill="#ffd98a" opacity=".16"><animate attributeName="opacity" dur="2.6s" repeatCount="indefinite" values=".1;.22;.1"/></circle></svg>`,
    heno: `<svg viewBox="0 0 150 62" xmlns="http://www.w3.org/2000/svg"><ellipse cx="75" cy="55" rx="68" ry="6" fill="#000" opacity=".22"/>
      <path d="M6 44 C10 26 30 20 50 24 C70 18 100 20 120 24 C140 26 146 38 144 46 C130 54 20 54 6 44 Z" fill="#c8b25b" stroke="#7a6a25" stroke-width="2" stroke-linejoin="round"/>
      <path d="M16 40 L28 30 M34 44 L48 30 M54 42 L66 28 M74 44 L88 30 M94 42 L106 30 M114 44 L128 32" stroke="#e6d78a" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M40 30 C60 22 100 22 118 32 L112 44 C90 50 56 50 36 42 Z" fill="#9c4a3a" stroke="#5c2a20" stroke-width="2"/><path d="M52 34 H100 M54 40 H98" stroke="#c46a56" stroke-width="1.6" opacity=".8"/>
      <path d="M4 50 V30 M146 50 V30" stroke="#5a3b21" stroke-width="5" stroke-linecap="round"/><path d="M2 32 H18 M132 32 H148" stroke="#5a3b21" stroke-width="3.4" stroke-linecap="round"/></svg>`,
    rascador: `<svg viewBox="0 0 56 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="28" cy="114" rx="22" ry="4.5" fill="#000" opacity=".25"/>
      <path d="M16 112 L18 14 Q28 6 38 14 L40 112 Z" fill="#8a5a31" stroke="#3b2412" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M22 20 V108 M28 14 V110 M34 20 V108" stroke="#6b4423" stroke-width="1.4" opacity=".7"/>
      <path d="M16 40 H40 M16 46 H40 M16 52 H40 M16 58 H40 M16 64 H40" stroke="#d9c08a" stroke-width="3.4" stroke-linecap="round"/><path d="M16 40 H40 M16 52 H40 M16 64 H40" stroke="#a58a52" stroke-width="1.2"/>
      <ellipse cx="28" cy="14" rx="12" ry="4.5" fill="#a8723f" stroke="#3b2412" stroke-width="2"/></svg>`,
    pelota: `<svg viewBox="0 0 44 48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="22" cy="43" rx="14" ry="3.6" fill="#000" opacity=".28"/><g class="hc-rueda"><circle cx="22" cy="24" r="16" fill="#c9463a" stroke="#6b1f18" stroke-width="2.2"/>
      <path d="M8 18 Q22 28 36 18 M7 28 Q22 36 37 28" stroke="#f2e8d0" stroke-width="3" fill="none"/><path d="M22 8 V40" stroke="#f2e8d0" stroke-width="2.6"/><ellipse cx="16" cy="15" rx="5" ry="3" fill="#fff" opacity=".4" transform="rotate(-30 16 15)"/></g></svg>`
  };

  /* ---------------------------------------------------------------- el fondo: cielo, colinas, pradera, camino, árboles, cercas y flores */
  function fondoSvg() {
    const r = azar(7), W = 1000, H = 500, partes = [];
    const arbol = (x, y, k, tono) => `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="34" ry="6" fill="#0b2a14" opacity=".28"/><path d="M-5 0 L-3 -46 H3 L5 0 Z" fill="#5a3a22"/>
      <g class="hc-copa" style="animation-delay:-${(x % 7).toFixed(1)}s"><circle cx="-16" cy="-62" r="26" fill="${tono[0]}"/><circle cx="14" cy="-66" r="28" fill="${tono[1]}"/><circle cx="0" cy="-86" r="26" fill="${tono[2]}"/><circle cx="-8" cy="-92" r="10" fill="#fff" opacity=".07"/></g></g>`;
    partes.push(`<defs><linearGradient id="hcCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fbcc4"/><stop offset=".6" stop-color="#bfe0d2"/><stop offset="1" stop-color="#e5ecd0"/></linearGradient>
      <linearGradient id="hcPrado" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d9a52"/><stop offset=".55" stop-color="#4f8a46"/><stop offset="1" stop-color="#3f7438"/></linearGradient>
      <radialGradient id="hcSombra" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0b2a14" stop-opacity=".34"/><stop offset="1" stop-color="#0b2a14" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#hcCielo)"/>`);
    // nubes
    [[150, 70, 1], [520, 46, 1.2], [820, 88, .9]].forEach(([x, y, k]) => partes.push(`<g class="hc-nube" style="animation-duration:${70 + x % 50}s;animation-delay:-${x % 40}s"><g transform="translate(${x} ${y}) scale(${k})" fill="#fff" opacity=".8"><ellipse cx="0" cy="0" rx="46" ry="12"/><ellipse cx="26" cy="-9" rx="28" ry="12"/><ellipse cx="-24" cy="-6" rx="24" ry="10"/></g></g>`));
    // colinas lejanas y bosque
    partes.push(`<path d="M0 232 C120 188 220 206 330 196 C450 186 540 214 650 198 C770 182 880 206 1000 190 V300 H0 Z" fill="#7aa88a"/>
      <path d="M0 252 C100 226 240 244 360 232 C500 220 600 250 740 236 C860 226 940 244 1000 236 V310 H0 Z" fill="#5f9570"/>`);
    for (let i = 0; i < 26; i++) { const x = 20 + i * 38 + r() * 18, y = 254 + r() * 12; partes.push(arbol(x, y, 0.38 + r() * 0.16, ["#356b45", "#3f7a4e", "#2f6040"])); }
    // pradera
    partes.push(`<path d="M0 262 C200 252 400 270 600 258 C800 248 900 262 1000 256 V${H} H0 Z" fill="url(#hcPrado)"/>`);
    // manchas de hierba y trozos de tierra
    for (let i = 0; i < 38; i++) { const x = r() * W, y = 290 + r() * 200, k = 0.5 + (y - 290) / 200 * 0.9; partes.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(46 * k).toFixed(0)}" ry="${(9 * k).toFixed(0)}" fill="${r() < 0.5 ? "#68a65a" : "#3b6f36"}" opacity=".32"/>`); }
    // camino de tierra: del refugio al comedero, pasando por el centro
    partes.push(`<path d="M820 292 C760 330 700 380 600 408 C500 436 380 410 300 392 C220 374 150 340 126 330 L168 322 C230 346 320 366 408 372 C520 380 610 360 690 330 C740 312 780 296 840 284 Z" fill="#b59a6a" opacity=".78"/>
      <path d="M770 308 C720 340 650 372 590 392 C500 416 400 394 330 376" fill="none" stroke="#c8b07c" stroke-width="3" stroke-dasharray="14 18" opacity=".6"/>`);
    // la zona de las crías y la de recuperación: un poco de tierra batida
    partes.push(`<ellipse cx="490" cy="448" rx="112" ry="26" fill="#a98f60" opacity=".55"/><ellipse cx="925" cy="376" rx="76" ry="16" fill="#a98f60" opacity=".5"/>`);
    // árboles de más cerca (a los lados y al fondo)
    partes.push(arbol(60, 308, 1.0, ["#2f6a3e", "#3a7a48", "#4b8c52"]), arbol(300, 288, 0.8, ["#356f43", "#417f4d", "#52925a"]), arbol(470, 282, 0.7, ["#2f6a3e", "#3a7a48", "#4b8c52"]), arbol(960, 316, 1.05, ["#2f6a3e", "#3a7a48", "#4b8c52"]));
    // cerca del fondo
    let cerca = `<path d="M0 286 H1000" stroke="#6b4a2c" stroke-width="3" opacity=".9"/><path d="M0 298 H1000" stroke="#6b4a2c" stroke-width="3" opacity=".9"/>`;
    for (let x = 6; x < 1000; x += 36) cerca += `<rect x="${x}" y="278" width="5" height="30" rx="1" fill="#7a5632" stroke="#3b2412" stroke-width="1"/>`;
    partes.push(`<g opacity=".85">${cerca}</g>`);
    // sombra bajo el refugio
    partes.push(`<ellipse cx="800" cy="372" rx="190" ry="44" fill="url(#hcSombra)"/>`);
    // flores y matas
    const colores = ["#f2f0e0", "#e86f8a", "#f2c14e", "#a98ae0", "#ff9a5a"];
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = 300 + Math.pow(r(), 0.8) * 190, k = 0.6 + (y - 300) / 190 * 0.8, c = colores[Math.floor(r() * colores.length)];
      if (r() < 0.55) partes.push(`<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${k.toFixed(2)})"><path d="M0 0 V-7" stroke="#2f6a3e" stroke-width="1.4"/><circle cx="0" cy="-8" r="2.6" fill="${c}"/><circle cx="0" cy="-8" r="1" fill="#7a4a1a"/></g>`);
      else partes.push(`<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${k.toFixed(2)})" stroke="#2f6a3e" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M-4 0 L-6 -9 M0 0 L0 -12 M4 0 L6 -9"/></g>`);
    }
    // rocas
    [[612, 470, 1], [180, 444, 0.8], [740, 440, 0.7]].forEach(([x, y, k]) => partes.push(`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="3" rx="22" ry="5" fill="#000" opacity=".22"/><path d="M-20 2 C-18 -14 -4 -18 8 -14 C18 -12 22 -4 20 2 Z" fill="#8f9a96" stroke="#4d5855" stroke-width="2"/><path d="M-8 -8 C-2 -13 6 -12 10 -8" stroke="#c6cfcb" stroke-width="2" fill="none"/></g>`));
    return `<svg class="hc-fondo" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${partes.join("")}</svg>`;
  }

  /* El primer plano: matas de hierba altas que tapan un poco los pies de las criaturas de delante, arbustos en las esquinas y una rama arriba. Encuadra la escena y le da profundidad. */
  function frenteSvg() {
    const r = azar(113), W = 1000, H = 500, p = [];
    const mata = (x, y, k, tono, retraso) => {
      let d = "";
      for (let i = 0; i < 7; i++) { const dx = (i - 3) * 4.2 * k, alto = (22 + r() * 16) * k, curva = (r() * 2 - 1) * 7 * k; d += `M${(x + dx).toFixed(1)} ${y} Q${(x + dx + curva).toFixed(1)} ${(y - alto * 0.6).toFixed(1)} ${(x + dx + curva * 1.6).toFixed(1)} ${(y - alto).toFixed(1)} `; }
      return `<g class="hc-mata" style="animation-delay:-${retraso.toFixed(1)}s"><path d="${d}" fill="none" stroke="${tono}" stroke-width="${(2.6 * k).toFixed(1)}" stroke-linecap="round"/></g>`;
    };
    for (let i = 0; i < 30; i++) { const x = 6 + i * 33 + r() * 20, y = 486 + r() * 18; p.push(mata(x, y, 1 + (y - 486) / 18 * 0.5, r() < 0.5 ? "#2f6a3a" : "#3f7d44", r() * 5)); }
    ["#f2f0e0", "#e86f8a", "#f2c14e", "#a98ae0"].forEach((c, i) => { for (let j = 0; j < 4; j++) { const x = r() * W, y = 484 + r() * 14; p.push(`<g class="hc-mata" style="animation-delay:-${(r() * 4).toFixed(1)}s"><path d="M${x.toFixed(0)} ${y.toFixed(0)} V${(y - 22).toFixed(0)}" stroke="#2f6a3a" stroke-width="2"/><circle cx="${x.toFixed(0)}" cy="${(y - 24).toFixed(0)}" r="5" fill="${c}"/><circle cx="${x.toFixed(0)}" cy="${(y - 24).toFixed(0)}" r="1.8" fill="#7a4a1a"/></g>`); } });
    const arbusto = (x, y, k) => `<g class="hc-mata" transform="translate(${x} ${y}) scale(${k})" style="animation-delay:-1.5s"><circle cx="-34" cy="-6" r="30" fill="#2c6137"/><circle cx="0" cy="-22" r="38" fill="#357a42"/><circle cx="36" cy="-8" r="30" fill="#2c6137"/><circle cx="-10" cy="-30" r="14" fill="#4a9356" opacity=".6"/><circle cx="26" cy="-22" r="9" fill="#4a9356" opacity=".5"/></g>`;
    p.push(arbusto(-6, 520, 1.25), arbusto(1010, 524, 1.15));
    // rama que cuelga arriba a la izquierda
    p.push(`<g class="hc-mata" style="animation-delay:-2.2s"><path d="M-10 -6 C90 18 160 6 230 40" fill="none" stroke="#4a2f1b" stroke-width="9" stroke-linecap="round"/>${[[60, 20], [110, 24], [160, 22], [205, 38], [90, 32], [140, 32]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 12}" rx="22" ry="11" fill="#357a42" transform="rotate(${(x % 40) - 20} ${x} ${y + 12})"/>`).join("")}</g>`);
    return `<svg class="hc-frente" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${p.join("")}</svg>`;
  }
  /* Detalles del ambiente: hojas que caen y mariposas (solo CSS; se paran si el sistema pide menos movimiento) */
  function ambienteHtml() {
    const r = azar(77); let h = '<div class="hc-aire" aria-hidden="true">';
    for (let i = 0; i < 7; i++) h += `<i class="hc-hoja" style="left:${(5 + r() * 90).toFixed(0)}%;animation-duration:${(11 + r() * 9).toFixed(1)}s;animation-delay:-${(r() * 18).toFixed(1)}s"></i>`;
    for (let i = 0; i < 2; i++) h += `<svg class="hc-mariposa m${i}" viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg"><g class="hc-alas"><ellipse cx="7" cy="7" rx="6.5" ry="5.5" fill="${i ? "#f2c14e" : "#a98ae0"}"/><ellipse cx="17" cy="7" rx="6.5" ry="5.5" fill="${i ? "#f2c14e" : "#a98ae0"}"/></g><rect x="11.2" y="2" width="1.6" height="12" rx=".8" fill="#2a1d12"/></svg>`;
    return h + "</div>";
  }

  /* ---------------------------------------------------------------- la edad en las proporciones: las crías tienen patas cortas y cabeza grande */
  const JUVENIL = { "cría": 1, "potro": 0.7, "joven": 0.28 };
  function perfilSegunEdad(p) {
    const j = JUVENIL[p.etapa] || 0;
    if (!j || !p.silueta) return { p, j: 0 };
    const s = Object.assign({}, p.silueta);
    s.longitud_patas = lerp(s.longitud_patas, 0.1, 0.75 * j); s.tamano_cabeza = lerp(s.tamano_cabeza, 0.96, 0.7 * j); s.longitud_cuello = lerp(s.longitud_cuello, 0.28, 0.55 * j);
    s.longitud_cuerpo = lerp(s.longitud_cuerpo, 0.2, 0.5 * j);
    return { p: Object.assign({}, p, { silueta: s }), j };
  }

  /* El temperamento que se nota en la escena. Sale de datos que ya existen (las manías y la mirada del cuerpo) y de la edad; no cambia nada del juego.
     tímida: se aparta de las demás; curiosa: va a mirar los objetos; juguetona: vuelve a la pelota; perezosa: pasa más tiempo descansando;
     sociable: se tumba junto a otras; territorial: se queda cerca del poste. */
  function temperamento(p) {
    const man = p.manias || [], en = id => man.includes(id), mir = p.silueta && p.silueta.mirada != null ? p.silueta.mirada : 0.5, joven = (JUVENIL[p.etapa] || 0) > 0.5;
    const f = { timida: mir < 0.4 || en("niebla") || en("arcana"), curiosa: mir > 0.62, juguetona: joven || en("sol") || en("barro"), perezosa: en("dormilona"), sociable: en("publico"), territorial: en("terca") };
    if (f.timida) f.sociable = false;
    const nombres = { timida: "tímida", curiosa: "curiosa", juguetona: "juguetona", perezosa: "perezosa", sociable: "sociable", territorial: "territorial" };
    return { f, texto: Object.keys(f).filter(k => f[k]).map(k => nombres[k]) };
  }

  /* Lo que le gusta hacer a cada una: pesos para elegir adónde ir. Salen de su temperamento, de su edad y de su estado real. */
  function pesosDePlan(w) {
    const p = w.p, man = p.manias || [], joven = w.j > 0.5, lesion = !!p.lesion, fat = w.fatiga || 0, en = id => man.includes(id) ? 1 : 0, T = w.temp.f, b = k => (T[k] ? 1 : 0);
    const pes = {
      comedero: 10, bebedero: 7, refugio: 5 + 12 * b("perezosa") + 6 * b("timida") + 7 * en("lluvia") + 5 * en("niebla") - 3 * en("sol"), rascador: 4 + 12 * b("territorial") + 7 * b("curiosa"),
      pelota: joven ? 22 : 1 + 15 * b("juguetona"), heno: lesion ? 40 : fat > 60 ? 12 : 0, seguir: joven && w.madre ? 18 : 0, juntarse: 2 + 18 * b("sociable")
    };
    if (lesion) { pes.refugio += 6; pes.pelota = 0; pes.rascador *= 0.3; pes.juntarse *= 0.3; }
    if (fat > 60) { pes.refugio += 8; pes.pelota *= 0.2; }
    if (T.timida) pes.juntarse = 0;
    Object.keys(pes).forEach(k => { pes[k] = Math.max(0, pes[k]); });
    return pes;
  }

  /* ---------------------------------------------------------------- la escena */
  function crear(api, opc) {
    opc = opc || {};
    const nodo = document.createElement("div");
    nodo.className = "hip-criadero";
    nodo.innerHTML = `${fondoSvg()}<div class="hc-capa"></div>${frenteSvg()}${ambienteHtml()}<p class="hc-vacio hidden">Tu cuadra está vacía. Adopta o compra una criatura y vivirá aquí.</p>`;
    const capa = nodo.querySelector(".hc-capa"), vacio = nodo.querySelector(".hc-vacio");
    const rngG = azar(31), ids = new Map();   // id -> actor de pantalla
    const objetos = {}, bola = { x: 49, f: 0.14, vx: 0, vf: 0, giro: 0 };
    let W = 800, H = 400, activa = false, visible = true, sel = null, tPrev = 0, tReloj = 0, raf = 0, primera = true;
    const mundo = { x0: 4, x1: 96, vPaso: 5.4, ancho: 13, otros: [], cansado: 0, salida: 400 };

    // objetos y carteles
    Object.keys(OBJ).forEach(k => {
      const o = OBJ[k], el = document.createElement("div");
      el.className = "hc-obj hc-" + k; el.innerHTML = SVG[k]; capa.appendChild(el);
      objetos[k] = { el, o: Object.assign({}, o), usando: 0, rueda: el.querySelector(".hc-rueda") };
      if (o.cartel) { const c = document.createElement("span"); c.className = "hc-cartel"; c.textContent = o.cartel; el.appendChild(c); }
    });

    /* Coloca un objeto según su sitio (x, f) y el tamaño de la escena; alzado = píxeles que se despega del suelo (la pelota al botar) */
    function colocar(k, alzado) {
      const { el, o } = objetos[k], esc = 1 - o.f * ESC_F, wpx = W * o.w / 100 * (0.7 + 0.3 * esc);
      const ys = H * (Y0 - o.f * (Y0 - Y1)), alto = el.firstChild.viewBox.baseVal.height / el.firstChild.viewBox.baseVal.width * wpx;
      el.style.width = wpx.toFixed(1) + "px"; el.style.transform = "translate(" + (W * o.x / 100 - wpx / 2).toFixed(1) + "px," + (ys - alto * 0.94 - (alzado || 0)).toFixed(1) + "px)";
      // la cama de heno queda por debajo de las criaturas que se echan encima; lo demás, justo por encima de las que están en su mismo plano
      el.style.zIndex = 2 * (1000 - Math.round(o.f * 900)) + (k === "heno" ? -1 : 1);
    }
    function medidas() {
      const r = nodo.getBoundingClientRect(); W = Math.max(200, r.width); H = Math.max(160, r.height);
      Object.keys(objetos).forEach(k => colocar(k, 0));
    }

    /* ---- las criaturas */
    function nuevo(e, entrando) {
      const p = e.p, c = e.c, { p: pd, j } = perfilSegunEdad(p), el = document.createElement("div");
      el.className = "hc-cab"; el.dataset.id = p.id;
      el.innerHTML = `<div class="hc-giro">${D.silueta(pd, { clase: "hc-sil", vivo: true, titulo: p.nombre })}</div><span class="hc-nombre">${esc(p.nombre)}</span><span class="hc-icono"></span><i class="hc-anillo"></i>`;
      capa.appendChild(el);
      const tit = V.crearTitere(el.querySelector("svg")), a = V.crearActor({ id: p.id, titere: tit, semilla: hash("c" + p.id) % 100000 + 1 });
      const w = { a, el, giro: el.firstChild, nom: el.querySelector(".hc-nombre"), ico: el.querySelector(".hc-icono"), p, c, j, esc: 1 - 0.34 * j, modo: "quieto", vm: 0, flipPrev: 99, visible: true, cd: 3 + rngG() * 9, plan: null, temp: temperamento(p), alertaT: 0, reaccCd: 4 + rngG() * 6, rotulo: null, madre: p.madre ? p.madre.id : null, fatiga: c ? c.fatiga : 0, wAncho: 0, ts: 0 };
      ids.set(p.id, w);
      const rng = azar(hash("pos" + p.id));
      a.f = 0.1 + rng() * 0.75; a.dir = rng() < 0.5 ? -1 : 1; a.flip = a.dir; a.cojo = !!p.lesion;
      if (entrando) { a.x = -12; a.dir = 1; a.flip = 1; V.entrar(a, "caminar", mundo); a.dest = { x: 10 + rng() * 40, f: 0.2 + rng() * 0.5 }; }
      else {
        a.x = 8 + rng() * 84; const r = rng();
        if (r < 0.34) V.ponerPostura(a, "pastar"); else if (r < 0.58) V.ponerPostura(a, "mirar"); else if (r < 0.7) V.ponerPostura(a, "echar"); else if (r < 0.78) V.ponerPostura(a, "sentar"); else V.entrar(a, "caminar", mundo);
        a.t = rng() * a.dur;
      }
      el.addEventListener("click", () => seleccionar(p.id, true));
      return w;
    }
    function quitar(w) { w.el.classList.add("sale"); setTimeout(() => w.el.remove(), 500); ids.delete(w.p.id); if (sel === w.p.id) sel = null; }

    /* mias: [{ p, c }] (lo que da api.mias()). Añade las que llegan, quita las que se van y pone al día el estado de las demás. */
    function sincronizar(mias) {
      const lista = mias || [], vivos = new Set();
      lista.forEach(e => {
        vivos.add(e.p.id);
        const w = ids.get(e.p.id);
        if (!w) { nuevo(e, !primera); return; }
        const cambiaEtapa = w.p.etapa !== e.p.etapa || w.p.estado !== e.p.estado;
        w.p = e.p; w.temp = temperamento(e.p); w.c = e.c; w.fatiga = e.c ? e.c.fatiga : 0; w.a.cojo = !!e.p.lesion;
        if (cambiaEtapa) { const { p: pd, j } = perfilSegunEdad(e.p); w.j = j; w.esc = 1 - 0.34 * j; /* el dibujo ya hecho se queda: la próxima visita lo rehace */ }
        w.nom.textContent = e.p.nombre;
      });
      Array.from(ids.values()).forEach(w => { if (!vivos.has(w.p.id)) quitar(w); });
      primera = false;
      vacio.classList.toggle("hidden", ids.size > 0);
      marcarSel();
    }
    function seleccionar(id, deUsuario) {
      if (!ids.has(id)) return;
      sel = id; marcarSel();
      if (opc.alSeleccionar && deUsuario) opc.alSeleccionar(id);
    }
    function marcarSel() { ids.forEach((w, id) => w.el.classList.toggle("sel", id === sel)); }
    function destacar(id) { const w = ids.get(id); if (!w) return; w.el.classList.remove("pulsa"); void w.el.offsetWidth; w.el.classList.add("pulsa"); }

    /* ---- qué hace cada una: va a un objeto y lo usa */
    const recientes = {};   // cuándo se eligió por última vez cada plan: para que no hagan todas lo mismo a la vez
    function elegirPlan(w) {
      const pes = pesosDePlan(w), a = w.a;
      Object.keys(pes).forEach(k => {
        if (objetos[k] && objetos[k].usando > 0 && k !== "pelota") pes[k] *= 0.3;
        if (recientes[k] != null && tReloj - recientes[k] < 24) pes[k] *= 0.4;
      });
      const tot = Object.values(pes).reduce((s, x) => s + x, 0);
      if (tot <= 0) return null;
      let r = a.rng() * tot, eleg = "comedero";
      for (const k of Object.keys(pes)) { r -= pes[k]; if (r < 0) { eleg = k; break; } }
      recientes[eleg] = tReloj;
      if (eleg === "seguir") { const m = ids.get(w.madre); if (!m || m.a.estado === "fuera") return null; return { obj: "seguir", fase: "ir", dur: 14 + a.rng() * 12, t: 0, madre: m }; }
      if (eleg === "juntarse") {
        const otras = Array.from(ids.values()).filter(o => o !== w && o.a.estado !== "fuera").sort((p, q) => Math.abs(p.a.x - a.x) - Math.abs(q.a.x - a.x));
        const o = otras[0]; if (!o) return null;
        const lado = o.a.x >= a.x ? -1 : 1;
        return { obj: "juntarse", fase: "ir", spot: { x: o.a.x + lado * 9, f: o.a.f + 0.03, dir: -lado }, accion: a.rng() < 0.5 ? "sentar" : "echar", dur: 20 + a.rng() * 25, t: 0 };
      }
      const O = objetos[eleg].o, spot = O.spots ? O.spots[Math.floor(a.rng() * O.spots.length)] : { x: O.x, f: O.f, dir: 1 }, ob = objetos[eleg];
      if (O.spots && ob.usando >= O.spots.length && eleg !== "pelota") return null;    // el sitio está lleno
      const accion = { comedero: "pastar", bebedero: "pastar", refugio: a.rng() < 0.55 ? "echar" : "sentar", heno: "echar", rascador: "mirar", pelota: "jugar" }[eleg];
      const dur = { pastar: 10 + a.rng() * 10, echar: 26 + a.rng() * 40, sentar: 18 + a.rng() * 22, mirar: 7 + a.rng() * 4, jugar: 16 + a.rng() * 12 }[accion];
      ob.usando++;
      return { obj: eleg, fase: "ir", spot, accion, dur, t: 0, patada: 0 };
    }
    function soltarPlan(w) { if (w.plan && objetos[w.plan.obj]) objetos[w.plan.obj].usando = Math.max(0, objetos[w.plan.obj].usando - 1); w.plan = null; w.rasca = 0; }
    function lleva(w, dest) {
      const a = w.a, tumbada = a.w.echada > 0.15 || a.w.sentada > 0.15;
      if (tumbada) { if (a.estado !== "levantar") V.entrar(a, "levantar", mundo); return; }
      if (a.estado !== "caminar") V.entrar(a, "caminar", mundo);
      a.dest = { x: clamp(dest.x, mundo.x0, mundo.x1), f: clamp(dest.f, 0.02, 0.98) };
    }
    const distA = (a, d) => Math.hypot(d.x - a.x, (d.f - a.f) * 45);
    function planear(w, dt) {
      const a = w.a;
      if (!w.plan) {
        w.cd -= dt;
        if (w.cd <= 0) { w.cd = (10 + a.rng() * 24) * (w.p.lesion ? 1.3 : 1) * (w.temp.f.curiosa ? 0.65 : 1) * (w.temp.f.perezosa ? 1.4 : 1); if (!a.socio && !["saludo", "acercar", "recibir"].includes(a.estado)) w.plan = elegirPlan(w); }
        return;
      }
      const pl = w.plan; pl.t += dt;
      if (a.socio || a.estado === "saludo" || a.estado === "recibir" || a.estado === "acercar") { soltarPlan(w); return; }
      if (pl.fase === "ir") {
        const dest = pl.obj === "seguir" ? { x: pl.madre.a.x - 7 * pl.madre.a.dir, f: pl.madre.a.f } : pl.obj === "pelota" ? { x: bola.x - (bola.x < 50 ? 1 : -1) * 7, f: bola.f } : pl.spot;
        if (pl.t > 40) { soltarPlan(w); return; }
        if (distA(a, dest) < 1.6) {
          if (pl.obj === "seguir") { pl.fase = "seguir"; pl.t = 0; return; }
          pl.fase = "hacer"; pl.t = 0;
          if (pl.obj === "pelota") { a.dir = bola.x >= a.x ? 1 : -1; V.entrar(a, "mirar", mundo); a.dur = 2; return; }
          a.dir = pl.spot.dir; V.entrar(a, pl.accion, mundo); a.dur = pl.accion === "mirar" ? pl.dur + 2 : pl.dur; a.dir = pl.spot.dir; a.flip = a.dir;
        } else lleva(w, dest);
      } else if (pl.fase === "seguir") {
        const m = pl.madre;
        if (!ids.has(m.p.id) || pl.t > pl.dur) { soltarPlan(w); return; }
        const dest = { x: m.a.x - 7 * m.a.dir, f: m.a.f + 0.04 };
        if (distA(a, dest) > 5) lleva(w, dest);
      } else if (pl.obj === "pelota") {
        // corre tras la pelota y le da una patada con un brinco; la pelota rueda y vuelve a ir tras ella
        pl.patada -= dt;
        const lejos = distA(a, bola) > 8.5, quieta = Math.hypot(bola.vx, bola.vf) < 5;
        if (a.estado === "celebrar") { if (a.t > 1.1) { pl.golpeado = false; lleva(w, { x: bola.x, f: bola.f }); } return; }
        if (lejos) lleva(w, { x: bola.x - (bola.x < 50 ? 1 : -1) * 7, f: bola.f });
        else if (quieta && pl.patada <= 0) {
          const s = bola.x >= a.x ? 1 : -1;
          a.dir = s; V.entrar(a, "celebrar", mundo); a.dur = 1.3; pl.patada = 1.6;
          bola.vx = s * (15 + a.rng() * 10); bola.vf = (a.rng() * 2 - 1) * 9;
        } else if (!lejos && a.estado !== "mirar") { V.entrar(a, "mirar", mundo); a.dur = 1.5; }
        if (pl.t > pl.dur) soltarPlan(w);
      } else {   // hacer
        if (pl.accion === "mirar") w.rasca = 1;
        if (a.estado !== pl.accion || pl.t > pl.dur + 3) soltarPlan(w);
      }
    }

    /* ---- un cuadro */
    function cuadro(ts) {
      raf = requestAnimationFrame(cuadro);
      if (!activa || !visible || document.hidden) { tPrev = 0; return; }
      const dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0.016; tPrev = ts;
      actualizar(dt);
    }
    function textoDe(w) {
      const a = w.a, pl = w.plan, f = w.fatiga;
      if (pl && pl.fase === "hacer") {
        if (pl.obj === "comedero") return "comiendo"; if (pl.obj === "bebedero") return "bebiendo"; if (pl.obj === "heno") return "descansando en la cama de heno";
        if (pl.obj === "refugio") return a.estado === "echar" ? "durmiendo a la sombra" : "descansando a la sombra"; if (pl.obj === "rascador") return "rascándose en el poste";
        if (pl.obj === "pelota") return "jugando con la pelota"; if (pl.obj === "juntarse") return "descansando junto a otra"; if (pl.obj === "alejarse") return "apartada, tranquila";
      }
      if (pl && pl.fase === "seguir") return "siguiendo a su madre";
      if (pl && pl.fase === "ir") return { comedero: "va al comedero", bebedero: "va a beber", refugio: "va al refugio", heno: "va a la cama de heno", rascador: "va al poste", pelota: "va a por la pelota", juntarse: "se acerca a otra", alejarse: "se aparta", seguir: "busca a su madre" }[pl.obj] || "paseando";
      return { pastar: "pastando", mirar: "mirando a su alrededor", caminar: "paseando", sentar: "sentada", echar: f > 60 || w.p.lesion ? "descansando" : "echada", saludo: "saludando a otra", acercar: "se acerca a saludar", recibir: "espera un saludo", levantar: "se levanta" }[a.estado] || "";
    }
    /* El ciclo de comer: bajar la cabeza (al comedero, al agua o a la hierba), morder, subir a masticar con la mandíbula y el cuello en movimiento, y a veces mirar a un lado
       con las orejas tiesas. Cada criatura lleva su propio ritmo (duraciones al azar). up es cuánto levanta la cabeza respecto a la de pastar: 0 en la hierba, más en el comedero. */
    function animarComida(w, a, ctx, dt) {
      const base = a.titere.cuPasto, plan = w.plan && w.plan.fase === "hacer" ? w.plan.obj : null, ts = tReloj + a.semilla, beber = plan === "bebedero";
      const baja = plan === "comedero" ? 0.28 : beber ? 0.16 : 0;
      let c = w.comer;
      if (!c) c = w.comer = { fase: "bajar", t: 0, dur: 0.7 + a.rng() * 0.6, up: 0.75, alto: 0.7, lado: 1 };
      c.t += dt;
      let upT = baja;
      if (c.fase === "bajar") { if (c.t > c.dur) { c.fase = "morder"; c.t = 0; c.dur = beber ? 2 + a.rng() * 2.4 : 0.9 + a.rng() * 1.1; } }
      else if (c.fase === "morder") { upT = baja + (beber ? 0 : 0.05 * Math.sin(ts * 11)); if (c.t > c.dur) { c.fase = "subir"; c.t = 0; c.dur = 0.5 + a.rng() * 0.3; c.alto = 0.58 + a.rng() * 0.24; } }
      else if (c.fase === "subir") { upT = c.alto; if (c.t > c.dur) { c.fase = "masticar"; c.t = 0; c.dur = beber ? 1 + a.rng() : 1.6 + a.rng() * 2; } }
      else if (c.fase === "masticar") {
        upT = c.alto - 0.04 * Math.sin(ts * 1.3);
        if (c.t > c.dur) { c.t = 0; if (a.rng() < 0.4) { c.fase = "mirar"; c.dur = 0.9 + a.rng() * 1.6; c.lado = a.rng() < 0.5 ? -1 : 1; } else { c.fase = "bajar"; c.dur = 0.7 + a.rng() * 0.5; } }
      } else { upT = 0.88; if (c.t > c.dur) { c.fase = "bajar"; c.t = 0; c.dur = 0.8 + a.rng() * 0.6; } }
      c.up = acerca(c.up, upT, c.fase === "morder" ? 9 : 3.6, dt);
      ctx.cuExtra = -base * c.up;
      ctx.cabExtra = (c.fase === "masticar" ? (beber ? 2.5 : 5.5) * Math.sin(ts * 8.5) : 0) + (c.fase === "mirar" ? 9 * c.lado * Math.sin(Math.min(1, c.t / c.dur) * Math.PI) : 0)
        + (c.fase === "morder" ? (beber ? 2 * Math.sin(ts * 2.4) : 3 * Math.sin(ts * 12)) : 0);
      ctx.inclina = (ctx.inclina || 0) + 1.4 * Math.sin(ts * 0.5);   // cambia el peso de un lado a otro
      if (c.fase === "mirar") ctx.orExtra = 10;
    }
    function actualizar(dt) {
      tReloj += dt;
      const lista = Array.from(ids.values());
      mundo.otros = lista.map(w => w.a);
      lista.forEach(w => {
        const a = w.a, lesionada = !!w.p.lesion, juega = w.plan && w.plan.obj === "pelota" && w.plan.fase === "hacer";
        mundo.cansado = clamp(Math.max(w.fatiga / 100, lesionada ? 0.7 : 0), 0, 1);
        mundo.vPaso = (w.j > 0.5 ? 7.4 : 5.4) * (w.p.etapa === "joven" ? 1.1 : 1) * (juega ? 1.7 : 1);
        mundo.ancho = ANCHO_BASE * 100 * 0.75 * (1 - 0.3 * w.j);
        w.alertaT = Math.max(0, (w.alertaT || 0) - dt); w.reaccCd = Math.max(0, (w.reaccCd || 0) - dt); a.obj.alerta = w.alertaT > 0 ? 1 : 0;
        planear(w, dt);
        const r = V.pensarLibre(a, dt, mundo); w.modo = r.modo; w.vm = Math.abs(r.v);
        if (juega && w.modo === "paso") w.modo = "trote";
      });
      // que no se atraviesen: las que van casi en el mismo sitio se separan un poco en profundidad
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
        const wp = lista[i], wq = lista[j], p = wp.a, q = wq.a;
        if (Math.abs(p.x - q.x) < mundo.ancho * 0.6 && Math.abs(p.f - q.f) * 45 < 6 && p.socio !== q && q.socio !== p) { const d = (p.f >= q.f ? 1 : -1) * 0.3 * dt; p.f = clamp(p.f + d, 0, 1); q.f = clamp(q.f - d, 0, 1); }
        // reacciones al cruzarse: levantan la cabeza y miran; la tímida se aparta
        const de_pie = x => x.a.w.echada < 0.2 && x.a.w.sentada < 0.2;
        if (wp.reaccCd <= 0 && wq.reaccCd <= 0 && de_pie(wp) && de_pie(wq) && !p.socio && !q.socio && Math.abs(p.x - q.x) < mundo.ancho * 1.05 && Math.abs(p.f - q.f) * 45 < 11) {
          [[wp, wq], [wq, wp]].forEach(([u, v]) => {
            u.alertaT = 1.1 + u.a.rng() * 0.8; u.reaccCd = 8 + u.a.rng() * 8;
            if (u.a.estado === "pastar" || u.a.estado === "mirar") { u.a.dir = v.a.x >= u.a.x ? 1 : -1; u.a.mirar.cuT = -3; }
            if (u.temp.f.timida && !u.plan && !u.p.lesion) {
              const cands = [{ x: 8, f: 0.2 }, { x: 8, f: 0.78 }, { x: 46, f: 0.9 }, { x: 94, f: 0.2 }].sort((m, n) => distA(v.a, n) - distA(v.a, m));
              const c = cands[0]; u.plan = { obj: "alejarse", fase: "ir", spot: { x: c.x, f: c.f, dir: c.x < 50 ? 1 : -1 }, accion: "pastar", dur: 10 + u.a.rng() * 8, t: 0 };
            }
          });
        }
      }
      // la pelota rueda y rebota en los bordes
      bola.x += bola.vx * dt; bola.f += bola.vf * dt / 45;
      const fr = Math.exp(-1.5 * dt); bola.vx *= fr; bola.vf *= fr;
      if (bola.x < 8) { bola.x = 8; bola.vx = Math.abs(bola.vx) * 0.7; } else if (bola.x > 92) { bola.x = 92; bola.vx = -Math.abs(bola.vx) * 0.7; }
      if (bola.f < 0.04) { bola.f = 0.04; bola.vf = Math.abs(bola.vf) * 0.7; } else if (bola.f > 0.5) { bola.f = 0.5; bola.vf = -Math.abs(bola.vf) * 0.7; }
      const vb = Math.hypot(bola.vx, bola.vf);
      bola.giro += (bola.vx * 0.9) * dt * 8;
      const pob = objetos.pelota; pob.o.x = bola.x; pob.o.f = bola.f;
      colocar("pelota", vb > 3 ? Math.abs(Math.sin(tReloj * 11)) * Math.min(1, vb / 14) * H * 0.03 : 0);
      if (pob.rueda) pob.rueda.style.transform = "rotate(" + bola.giro.toFixed(0) + "deg)";
      lista.forEach(w => {
        const a = w.a, f = a.f, escala = (1 - f * ESC_F) * w.esc, wpx = W * ANCHO_BASE * escala, hpx = wpx * 148 / 240;
        // echada sobre la cama de heno: sube a la altura de la manta (y se coloca justo en su sitio) en vez de quedar delante
        const enCama = w.plan && w.plan.obj === "heno" && w.plan.fase === "hacer" && (a.estado === "echar" || a.estado === "levantar");
        if (enCama && !w.enCama) { a.x = w.plan.spot.x; a.f = w.plan.spot.f; }
        w.enCama = enCama; w.alza = acerca(w.alza || 0, enCama ? W * 0.021 * (1 - f * ESC_F) : 0, 5, dt);
        const xs = W * a.x / 100, ys = H * (Y0 - f * (Y0 - Y1)) - w.alza;
        const ctx = { dt, pxPorUnidad: wpx / 240 * a.titere.R.k, vPx: w.vm * W / 100, modo: w.modo, ant: 0, rasca: null, omitir: false, inclina: 0, cuExtra: 0, cabExtra: 0 };
        if (w.rasca && a.estado === "mirar") { ctx.inclina = 4 * Math.sin(tReloj * 5 + a.semilla); ctx.cuExtra = 6 * Math.sin(tReloj * 5 + 1); } else w.rasca = 0;
        // comer, beber y pastar: nunca con la cabeza clavada en una postura; baja, muerde, sube a masticar y de vez en cuando mira alrededor
        if (a.estado === "pastar") animarComida(w, a, ctx, dt); else w.comer = null;
        V.pintarActor(a, ctx);
        if (Math.abs(w.wAncho - wpx) > 0.5) { w.el.style.width = wpx.toFixed(1) + "px"; w.wAncho = wpx; }
        w.el.style.transform = "translate(" + (xs - wpx / 2).toFixed(1) + "px," + (ys - hpx * 0.919).toFixed(1) + "px)";
        w.el.style.zIndex = 2 * (1000 - Math.round(f * 900));
        if (Math.abs(a.flip - w.flipPrev) > 0.01) { w.giro.style.transform = Math.abs(a.flip - 1) < 0.01 ? "" : "scaleX(" + a.flip.toFixed(2) + ")"; w.flipPrev = a.flip; }
        // iconos de estado: lesión o cansancio, solo cuando es de verdad
        const ic = w.p.lesion ? "✚" : (w.fatiga > 60 && (a.estado === "echar" || a.estado === "sentar")) ? "z" : "";
        if (w.ico.textContent !== ic) { w.ico.textContent = ic; w.ico.className = "hc-icono" + (ic === "✚" ? " lesion" : ic ? " sueno" : ""); }
      });
    }

    function activar(si) { activa = !!si; if (activa) { medidas(); tPrev = 0; } }
    function efecto(id, tipo) {
      const w = ids.get(id); if (!w) return;
      const e = document.createElement("span"); e.className = "hc-efecto " + (tipo || "cuidar");
      e.innerHTML = tipo === "cuidar" || !tipo ? "<i>♥</i><i>✚</i><i>♥</i>" : "<i>✦</i>";
      w.el.appendChild(e); setTimeout(() => e.remove(), 2600);
      if (!tipo || tipo === "cuidar") { soltarPlan(w); V.entrar(w.a, "levantar", mundo); }
    }

    if (window.ResizeObserver) new ResizeObserver(() => { medidas(); }).observe(nodo);
    if (window.IntersectionObserver) new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible) tPrev = 0; }).observe(nodo);
    window.addEventListener("resize", medidas);
    raf = requestAnimationFrame(cuadro);
    setTimeout(medidas, 0);
    // para probar sin reloj de pantalla: avanza la escena `seg` segundos de golpe
    function simular(seg) { medidas(); for (let t = 0; t < seg; t += 1 / 30) actualizar(1 / 30); }
    function forzar(id, obj) { const w = ids.get(id); if (!w) return; soltarPlan(w); const O = OBJ[obj], spot = O.spots[0]; w.plan = { obj, fase: "ir", spot, accion: { comedero: "pastar", bebedero: "pastar", refugio: "echar", heno: "echar", rascador: "mirar", pelota: "jugar" }[obj], dur: 12, t: 0, patada: 0 }; objetos[obj].usando++; }
    const estados = () => Array.from(ids.values()).map(w => ({ id: w.p.id, estado: w.a.estado, x: +w.a.x.toFixed(1), f: +w.a.f.toFixed(2), plan: w.plan ? w.plan.obj + ":" + w.plan.fase : null, dest: w.a.dest ? [+w.a.dest.x.toFixed(1), +w.a.dest.f.toFixed(2)] : null }));
    const actividad = id => { const w = ids.get(id); return w ? textoDe(w) : ""; };   // lo que hace ahora (la ficha lo enseña; la escena no lo escribe)
    const api2 = { forzar, estados, actividad, nodo, sincronizar, activar, seleccionar, destacar, efecto, medidas, simular, seleccionada: () => sel, estaEn: id => ids.has(id) };
    HipodromoCriaderoUltima = api2;
    return api2;
  }
  return { crear, OBJ, temperamento, ultima: () => HipodromoCriaderoUltima };
})();
