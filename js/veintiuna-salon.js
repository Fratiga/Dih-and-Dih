/* =============================================================================
   LAS VEINTIUNA VELAS: la sala (veintiuna.html)
   El mundo alrededor de la mesa: la habitación, el tapete en perspectiva, los objetos con los que se navega (la puerta del salón privado,
   el tablón de desafíos, el farol del Buhonero, el libro de la casa, el libro de cuentas, la cajita de música), el fichero, la campanilla,
   las velas del marcador, la luz de las velas, el polvo que flota y las chispas y el humo de los momentos importantes.
   Aquí no hay reglas ni red. veintiuna-mesa.js llama a VeintiunaSalon para los efectos; la dirección artística está en css/veintiuna-juego.css.
   Rendimiento (gráfica integrada): un solo lienzo pequeño, a 15 fotogramas por segundo en reposo y a 30 con efectos, dormido con la pestaña
   oculta o con «reducir movimiento». El paralaje mueve tres capas con transform y solo cuando se mueve el ratón.
============================================================================= */
window.VeintiunaSalon = (function () {
  "use strict";
  const reducir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
  const quieto = () => reducir.matches;

  /* ---------------------------------------------------------------- la habitación (fondo a pantalla completa) */
  function habitacion() {
    // flor de damasco del papel pintado
    const flor = `<path d="M40 8c6 10 16 14 16 26 0 9-7 14-16 14s-16-5-16-14c0-12 10-16 16-26Z M40 48v30 M40 62c-10-6-20-2-22 6 8 2 16 0 22-6Z M40 62c10-6 20-2 22 6-8 2-16 0-22-6Z M14 92c8-6 18-6 26 0 8-6 18-6 26 0"/>`;
    let pliegues = "";
    for (let i = 0; i < 6; i++) pliegues += `<path d="M${14 + i * 20} 0v900" stroke="#00000055" stroke-width="${i % 2 ? 7 : 3}"/>`;
    return `<svg class="vj-sala-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="vjDamasco" width="80" height="104" patternUnits="userSpaceOnUse"><g fill="none" stroke="#3a2140" stroke-width="2.2" stroke-linecap="round">${flor}</g></pattern>
    <radialGradient id="vjPozoLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb24a" stop-opacity=".34"/><stop offset=".5" stop-color="#ff8a2a" stop-opacity=".1"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>
    <radialGradient id="vjPenumbra" cx=".5" cy=".42" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></radialGradient>
  </defs>
  <g class="vj-capa vj-capa-pared">
    <rect width="1600" height="900" fill="#180d1a"/>
    <rect width="1600" height="560" fill="url(#vjDamasco)" opacity=".55"/>
    <!-- cornisa y zócalo de madera -->
    <rect y="0" width="1600" height="26" fill="#0e070f"/><rect y="26" width="1600" height="5" fill="#5a3a1c"/>
    <rect y="548" width="1600" height="352" fill="#120a10"/><rect y="548" width="1600" height="7" fill="#5a3a1c"/><rect y="555" width="1600" height="3" fill="#2a1508"/>
    <g fill="none" stroke="#2a1a22" stroke-width="3">${[40, 300, 560, 820, 1080, 1340].map(x => `<rect x="${x}" y="590" width="220" height="250" rx="4"/>`).join("")}</g>
    <!-- el retrato vacío detrás de la crupier: un marco ovalado con una vela apagada pintada -->
    <g transform="translate(800 330)">
      <ellipse rx="176" ry="196" fill="#0d0710"/>
      <ellipse rx="176" ry="196" fill="none" stroke="#6b4d22" stroke-width="16"/>
      <ellipse rx="160" ry="180" fill="none" stroke="#3b2a12" stroke-width="3"/>
      <g opacity=".22"><rect x="-14" y="-10" width="28" height="120" fill="#e9dcc0"/><path d="M0 -12c-2-18 6-26 2-44" stroke="#9b8f80" stroke-width="3" fill="none"/></g>
    </g>
    <!-- dos apliques con vela en la pared -->
    ${[300, 1300].map(x => `<g class="vj-aplique" transform="translate(${x} 300)">
      <circle r="150" fill="url(#vjPozoLuz)"/>
      <path d="M-34 40h68l-10 14h-48z" fill="#6b4d22"/><rect x="-4" y="54" width="8" height="40" fill="#4a3216"/>
      <rect x="-9" y="-6" width="18" height="46" rx="2" fill="#efe3c3"/>
      <path class="vj-llama-pared" d="M0 -34c7 9 10 15 10 21a10 10 0 0 1-20 0c0-6 3-12 10-21z" fill="#ffb24a"/>
      <path d="M0 -24c3 4 4 7 4 10a4 4 0 0 1-8 0c0-3 1-6 4-10z" fill="#fff3c4"/>
    </g>`).join("")}
    <!-- cortinas de terciopelo en los bordes -->
    <g fill="#4a1220"><rect x="0" width="128" height="900"/><rect x="1472" width="128" height="900"/></g>
    <g transform="translate(0 0)">${pliegues}</g><g transform="translate(1472 0)">${pliegues}</g>
    <path d="M128 0v900M1472 0v900" stroke="#2a0812" stroke-width="6"/>
    <path d="M0 0h1600v40c-140 22-300 30-420 18-120-12-240-20-380-20s-260 8-380 20C300 70 140 62 0 40z" fill="#3a0d19"/>
    <path d="M0 40c140 22 300 30 420 18 120-12 240-20 380-20s260 8 380 20c120 12 280 4 420-18" fill="none" stroke="#c9a44a" stroke-width="3" stroke-dasharray="2 9"/>
  </g>
  <rect width="1600" height="900" fill="url(#vjPenumbra)"/>
</svg>`;
  }

  /* ---------------------------------------------------------------- el tapete en perspectiva (los rótulos del arco los cambia la mesa) */
  // Medidas en las mismas unidades que el escenario (1600 de ancho): el tapete empieza 430 por debajo del techo.
  // Entre las cartas de la crupier (40 a 150) y las tuyas (220 a 330) van los dos rótulos en arco; el círculo de la apuesta queda a tu derecha.
  // En vertical (móvil) el tapete es otro dibujo, de 800 x 1030, con los mismos rótulos (los cambia la mesa por su id: solo hay un juego de ids).
  function tapete() { return tapeteAncho() + tapeteAlto(); }
  function tapeteAlto() {
    return `<svg class="vj-tapete-svg vj-tapete-alto" viewBox="0 0 800 1030" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="vjFieltroLuzA" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#1d6b57"/><stop offset=".55" stop-color="#0f4036"/><stop offset="1" stop-color="#062019"/></radialGradient>
  </defs>
  <path d="M50 0H750L950 1030H-150Z" fill="#2a160d"/>
  <path d="M66 12H734L930 1030H-130Z" fill="url(#vjFieltroLuzA)"/>
  <path d="M50 0H750" stroke="#5a3320" stroke-width="22"/>
  <path d="M52 9H748" stroke="#c9a44a" stroke-width="2" stroke-dasharray="3 12"/>
  <g fill="none" stroke="#d9a441" stroke-opacity=".35" stroke-width="1.6"><path d="M80 180 Q400 240 720 180"/><path d="M170 258 Q400 318 630 258"/></g>
  <g transform="translate(690 570)" fill="none" stroke="#d9a441" stroke-opacity=".55"><ellipse rx="74" ry="32" stroke-width="2.4"/><ellipse rx="63" ry="26" stroke-dasharray="2 6" stroke-width="1.4"/></g>
</svg>`;
  }
  function tapeteAncho() {
    return `<svg class="vj-tapete-svg vj-tapete-ancho" viewBox="0 0 1600 470" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="vjFieltroLuz" cx=".5" cy=".22" r=".72"><stop offset="0" stop-color="#1d6b57"/><stop offset=".55" stop-color="#0f4036"/><stop offset="1" stop-color="#062019"/></radialGradient>
  </defs>
  <!-- madera del borde de la casa y el tapete que se abre hacia ti -->
  <path d="M230 0H1370L1740 470H-140Z" fill="#2a160d"/>
  <path d="M250 12H1350L1700 470H-100Z" fill="url(#vjFieltroLuz)"/>
  <path d="M230 0H1370" stroke="#5a3320" stroke-width="22"/>
  <path d="M232 9H1368" stroke="#c9a44a" stroke-width="2" stroke-dasharray="3 12"/>
  <!-- la bandeja de fichas de la casa, delante de la crupier -->
  <g transform="translate(800 30)"><rect x="-120" y="-6" width="240" height="26" rx="4" fill="#1a0d08"/>
    ${[-96, -64, -32, 0, 32, 64, 96].map((x, i) => `<rect x="${x - 12}" y="-2" width="24" height="18" rx="3" fill="${["#2c6b57", "#7d2331", "#244a7a", "#26202c", "#4a2f7a", "#7d2331", "#2c6b57"][i]}"/><path d="M${x - 12} 4h24M${x - 12} 10h24" stroke="#00000055"/>`).join("")}</g>
  <g fill="none" stroke="#d9a441" stroke-opacity=".35" stroke-width="1.6"><path d="M360 128 Q800 210 1240 128"/><path d="M420 150 Q800 232 1180 150" stroke-dasharray="2 8"/></g>
  <!-- el círculo de la apuesta, a tu derecha -->
  <g transform="translate(1135 282)" fill="none" stroke="#d9a441" stroke-opacity=".55"><ellipse rx="92" ry="40" stroke-width="2.4"/><ellipse rx="80" ry="33" stroke-dasharray="2 6" stroke-width="1.4"/></g>
</svg>`;
  }

  /* ---------------------------------------------------------------- los objetos de la sala */
  const OBJ = {
    // La puerta del salón privado (Con amigos), entreabierta, con luz detrás
    puerta: `<svg viewBox="0 0 170 480" aria-hidden="true" focusable="false"><path d="M10 462V90a75 75 0 0 1 150 0v372z" fill="#0b0609"/>
      <path class="vj-puerta-luz" d="M24 462V96a61 61 0 0 1 122 0v366z" fill="#ffb24a" opacity=".35"/>
      <path class="vj-puerta-luz" d="M24 462h122l30 18H-6z" fill="#ffb24a" opacity=".22"/>
      <path class="vj-puerta-hoja" d="M24 462V96a61 61 0 0 1 61-61v427z" fill="#3d2416"/>
      <g fill="none" stroke="#2a180e" stroke-width="3"><rect x="36" y="112" width="38" height="140" rx="3"/><rect x="36" y="270" width="38" height="170" rx="3"/></g>
      <circle cx="74" cy="262" r="4" fill="#c9a44a"/>
      <path d="M10 462V90a75 75 0 0 1 150 0v372" fill="none" stroke="#5a3a1c" stroke-width="10"/>
      <rect x="-2" y="458" width="174" height="12" rx="2" fill="#4a2e18"/><rect x="-2" y="468" width="174" height="12" fill="#2a180e"/>
      <path d="M85 12v6" stroke="#c9a44a" stroke-width="3"/><circle cx="85" cy="24" r="6" fill="#c9a44a"/></svg>`,
    // El tablón de los desafíos: madera con papeles clavados
    tablon: `<svg viewBox="0 0 200 170" aria-hidden="true" focusable="false"><rect x="6" y="6" width="188" height="158" rx="4" fill="#3d2416"/><rect x="16" y="16" width="168" height="138" fill="#5a3a22"/>
      <g fill="none" stroke="#3d2416" stroke-width="2" opacity=".6"><path d="M16 50h168M16 92h168M16 128h168"/></g>
      <g class="vj-papeles"><rect x="28" y="26" width="46" height="58" fill="#efe7cd" transform="rotate(-4 51 55)"/><rect x="86" y="30" width="44" height="52" fill="#e2d8b8" transform="rotate(3 108 56)"/><rect x="138" y="24" width="38" height="60" fill="#efe7cd" transform="rotate(-2 157 54)"/>
      <rect x="40" y="94" width="52" height="50" fill="#e2d8b8" transform="rotate(2 66 119)"/><rect x="108" y="96" width="58" height="46" fill="#efe7cd" transform="rotate(-3 137 119)"/>
      <g stroke="#7a6a52" stroke-width="2"><path d="M36 44h30M36 52h26M36 60h30M94 44h28M94 52h22M144 42h24M144 50h20M50 112h30M50 120h34M116 110h40M116 118h30"/></g></g>
      <g fill="#a8202f"><circle cx="51" cy="30" r="4"/><circle cx="108" cy="33" r="4"/><circle cx="157" cy="28" r="4"/><circle cx="66" cy="97" r="4"/><circle cx="137" cy="99" r="4"/></g></svg>`,
    // El farol del Buhonero colgado de un cartel
    buhonero: `<svg viewBox="0 0 170 150" aria-hidden="true" focusable="false"><path d="M10 14h150" stroke="#2a180e" stroke-width="8" stroke-linecap="round"/>
      <path d="M40 14v18M130 14v18" stroke="#8f7733" stroke-width="2"/><rect x="22" y="32" width="126" height="44" rx="4" fill="#5a3a22"/><rect x="28" y="38" width="114" height="32" rx="2" fill="none" stroke="#c9a44a" stroke-width="1.4"/>
      <g transform="translate(85 96)"><path d="M0 -20v8" stroke="#8f7733" stroke-width="2"/><path d="M-14 -12h28l-4 6h-20z" fill="#3a2a18"/>
      <rect class="vj-farol-luz" x="-11" y="-6" width="22" height="30" rx="3" fill="#ffb24a" opacity=".85"/><path d="M-11 -6h22v30h-22zM0 -6v30" fill="none" stroke="#3a2a18" stroke-width="2.4"/><path d="M-14 24h28l-4 6h-20z" fill="#3a2a18"/>
      <path d="M0 2c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#fff3c4"/></g></svg>`,
    // El libro de la casa: tapas rojas, cierre de latón
    libro: `<svg viewBox="0 0 150 90" aria-hidden="true" focusable="false"><path d="M8 70l60 14 74-20-60-12z" fill="#00000066"/>
      <path d="M10 58l60 14 72-20-60-14z" fill="#efe3c3"/><path d="M10 52l60 14 72-20-60-14z" fill="#e2d4ae"/><path d="M10 52v6l60 14v-6z" fill="#d8caa2"/>
      <path d="M8 46l62 15 74-21-62-15z" fill="#7d2331"/><path d="M8 46v8l62 15v-8z" fill="#5a1626"/><path d="M70 61v8l74-21v-8z" fill="#4a1220"/>
      <path d="M34 42l62 15" stroke="#c9a44a" stroke-width="1.6"/><path d="M46 36l58 14" stroke="#c9a44a" stroke-width="1"/><rect x="66" y="58" width="9" height="12" rx="1.5" fill="#c9a44a" transform="rotate(-14 70 64)"/>
      <path d="M104 30l4 34" stroke="#a8202f" stroke-width="4"/></svg>`,
    // El libro de cuentas: lomo de cuero, abierto con columnas de tinta
    cuentas: `<svg viewBox="0 0 150 90" aria-hidden="true" focusable="false"><path d="M4 70l70 14 72-18-70-14z" fill="#00000066"/>
      <path d="M6 56l68 14V36L6 22z" fill="#efe7cd"/><path d="M74 70l70-18V18L74 36z" fill="#e7dcc0"/><path d="M74 36v34" stroke="#3d2416" stroke-width="3"/>
      <g stroke="#7a6a52" stroke-width="1.4"><path d="M14 32l52 10M14 39l52 10M14 46l52 10M82 42l54-14M82 49l54-14M82 56l54-14"/></g>
      <g stroke="#a8202f" stroke-width="1.4"><path d="M44 30v26M112 26v28"/></g>
      <path d="M2 58l72 16 74-20" fill="none" stroke="#3d2416" stroke-width="5" stroke-linejoin="round"/>
      <path d="M118 14l22-12 4 4-22 12z" fill="#efe3c3"/><path d="M118 14l-3 6 7-2" fill="#3a2a18"/></svg>`,
    // La cajita de música de los efectos
    cajita: `<svg viewBox="0 0 80 70" aria-hidden="true" focusable="false"><path d="M8 34h64v30H8z" fill="#5a3a22"/><path d="M8 34l8-12h48l8 12z" fill="#7a5030"/><rect x="34" y="42" width="12" height="10" rx="2" fill="#c9a44a"/>
      <g class="vj-notas" fill="#efe3c3"><path d="M22 18v-12l10-3v12" stroke="#efe3c3" stroke-width="2" fill="none"/><circle cx="20" cy="18" r="3"/><circle cx="30" cy="15" r="3"/><path d="M52 14v-10" stroke="#efe3c3" stroke-width="2"/><circle cx="50" cy="15" r="3"/></g></svg>`
  };

  // La bolsa de tokens del jugador (va en la baranda, junto al saldo)
  const bolsa = () => `<svg viewBox="0 0 90 90" aria-hidden="true" focusable="false"><path d="M45 18c-10 0-16-6-16-10h32c0 4-6 10-16 10z" fill="#3d2416"/>
    <path d="M30 22c-18 12-26 30-24 44 2 14 18 20 39 20s37-6 39-20c2-14-6-32-24-44z" fill="#6b4226"/><path d="M30 22c6 4 24 4 30 0" stroke="#2a180e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M24 44c8 6 34 6 42 0" stroke="#c9a44a" stroke-width="2" fill="none"/><circle cx="45" cy="60" r="11" fill="#c9a44a"/><circle cx="45" cy="60" r="7" fill="none" stroke="#8f7733" stroke-width="2"/></svg>`;

  // La campanilla de latón que se toca para repartir
  const campana = () => `<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false"><ellipse cx="60" cy="98" rx="50" ry="9" fill="#00000077"/>
    <path d="M12 92h96v-8H12z" fill="#3d2416"/><path d="M8 84h104l-6-8H14z" fill="#5a3a22"/>
    <g class="vj-campana-cuerpo"><path d="M60 22c-22 0-32 18-34 38-1 8-6 12-12 16h92c-6-4-11-8-12-16-2-20-12-38-34-38z" fill="#c9a44a"/>
    <path d="M60 22c-22 0-32 18-34 38-1 8-6 12-12 16h20c4-4 6-10 7-18 2-18 8-32 19-36z" fill="#e2c56f"/>
    <path d="M14 76h92" stroke="#8f7733" stroke-width="4" stroke-linecap="round"/></g>
    <g class="vj-campana-boton"><rect x="54" y="8" width="12" height="16" rx="2" fill="#8f7733"/><ellipse cx="60" cy="8" rx="9" ry="4" fill="#e2c56f"/></g></svg>`;

  // Un montón de fichas visto de lado (la columna del fichero)
  const FICHA_COLOR = { 10: "#2c6b57", 20: "#7d2331", 50: "#244a7a", 100: "#26202c", 200: "#6b4a1a", 500: "#4a2f7a", 1000: "#1f5a5a", 5000: "#6b1f3a" };
  function columna(valor, n) {
    const c = FICHA_COLOR[valor] || "#3a3a46";
    let h = "";
    for (let i = 0; i < n; i++) {
      const y = 86 - i * 9;
      h += `<g transform="translate(0 ${y})"><ellipse cx="30" cy="4" rx="26" ry="8" fill="#00000066"/><path d="M4 0v6a26 8 0 0 0 52 0V0z" fill="${c}"/><path d="M12 3v6M26 5v7M40 5v7M50 2v6" stroke="#efe3c3" stroke-width="3" opacity=".75"/><ellipse cx="30" cy="0" rx="26" ry="8" fill="${c}"/><ellipse cx="30" cy="0" rx="17" ry="5" fill="none" stroke="#efe3c3" stroke-opacity=".7" stroke-width="1.4"/></g>`;
    }
    return `<svg viewBox="0 0 60 106" aria-hidden="true" focusable="false">${h}</svg>`;
  }

  /* ---------------------------------------------------------------- el lienzo de partículas */
  const P = { cv: null, cx: null, w: 0, h: 0, motas: [], efectos: [], ultimo: 0, raf: 0, despierto: false };
  function prepararLienzo() {
    const cv = document.getElementById("vjParticulas");
    if (!cv || !cv.getContext) return;
    P.cv = cv; P.cx = cv.getContext("2d");
    medir();
    window.addEventListener("resize", medir);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) despertar(); });
    if (reducir.addEventListener) reducir.addEventListener("change", despertar);
    // el polvo que flota a la luz de las velas
    for (let i = 0; i < 26; i++) P.motas.push(nuevaMota(true));
    despertar();
  }
  function medir() {
    if (!P.cv) return;
    // a resolución baja a propósito: el polvo y el humo no necesitan más y la gráfica integrada lo agradece
    const k = Math.min(1, 960 / Math.max(1, window.innerWidth));
    P.k = k;
    P.w = P.cv.width = Math.round(window.innerWidth * k);
    P.h = P.cv.height = Math.round(window.innerHeight * k);
  }
  function nuevaMota(alAzar) {
    return { x: Math.random() * P.w, y: alAzar ? Math.random() * P.h : P.h + 4, vx: (Math.random() - .5) * 4, vy: -(2 + Math.random() * 5), r: .6 + Math.random() * 1.3, a: .15 + Math.random() * .35, f: Math.random() * 6.28 };
  }
  function despertar() {
    if (P.despierto || !P.cx) return;
    P.despierto = true; P.ultimo = 0;
    P.raf = requestAnimationFrame(cuadro);
  }
  function cuadro(t) {
    if (document.hidden || (quieto() && !P.efectos.length)) { P.despierto = false; if (P.cx) P.cx.clearRect(0, 0, P.w, P.h); return; }
    const conEfectos = P.efectos.length > 0;
    const paso = conEfectos ? 33 : 66;                 // 30 fps con chispas o humo, 15 en reposo
    if (P.ultimo && t - P.ultimo < paso) { P.raf = requestAnimationFrame(cuadro); return; }
    const dt = Math.min(0.1, P.ultimo ? (t - P.ultimo) / 1000 : 0.033);
    P.ultimo = t;
    const c = P.cx;
    c.clearRect(0, 0, P.w, P.h);
    if (!quieto()) {
      c.fillStyle = "#ffd9a0";
      for (const m of P.motas) {
        m.f += dt; m.x += (m.vx + Math.sin(m.f) * 3) * dt; m.y += m.vy * dt;
        if (m.y < -4) Object.assign(m, nuevaMota(false));
        c.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.f * 1.7));
        c.fillRect(m.x, m.y, m.r, m.r);
      }
    }
    for (let i = P.efectos.length - 1; i >= 0; i--) {
      const e = P.efectos[i];
      e.v += dt;
      if (e.v >= e.vida) { P.efectos.splice(i, 1); continue; }
      const k = e.v / e.vida;
      e.vx *= e.roce; e.vy = e.vy * e.roce + e.g * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.tipo === "humo") {
        c.globalAlpha = e.a * (1 - k);
        c.fillStyle = e.color;
        c.beginPath(); c.arc(e.x, e.y, e.r * (1 + k * 2.4), 0, 6.283); c.fill();
      } else {
        c.globalAlpha = e.a * (1 - k * k);
        c.fillStyle = e.color;
        c.fillRect(e.x - e.r / 2, e.y - e.r / 2, e.r, e.r);
      }
    }
    c.globalAlpha = 1;
    P.raf = requestAnimationFrame(cuadro);
  }
  // Coordenadas de pantalla (CSS) al lienzo
  const enLienzo = (x, y) => [x * (P.k || 1), y * (P.k || 1)];
  function chispas(x, y, n, colores, fuerza) {
    if (!P.cx || quieto()) return;
    const [lx, ly] = enLienzo(x, y), f = (fuerza || 1) * (P.k || 1);
    const cols = colores || ["#ffd27a", "#fff3c4", "#ffb24a"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = (60 + Math.random() * 220) * f;
      P.efectos.push({ tipo: "chispa", x: lx, y: ly, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * f, g: 340 * f, roce: .985, r: 1.5 + Math.random() * 2.2, a: 1, color: cols[i % cols.length], v: 0, vida: .7 + Math.random() * .8 });
    }
    despertar();
  }
  function humo(x, y, n, color) {
    if (!P.cx || quieto()) return;
    const [lx, ly] = enLienzo(x, y), f = P.k || 1;
    for (let i = 0; i < n; i++) {
      P.efectos.push({ tipo: "humo", x: lx + (Math.random() - .5) * 8 * f, y: ly, vx: (Math.random() - .5) * 18 * f, vy: -(24 + Math.random() * 30) * f, g: -6 * f, roce: .99, r: (2 + Math.random() * 3) * f, a: .35, color: color || "#b9b0a8", v: 0, vida: 1.4 + Math.random() * 1.2 });
    }
    despertar();
  }
  // Polvo que salta al golpear algo contra el fieltro (el sello del resultado, una ficha grande)
  function polvo(x, y, n) {
    if (!P.cx || quieto()) return;
    const [lx, ly] = enLienzo(x, y), f = P.k || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI, v = (40 + Math.random() * 90) * f;
      P.efectos.push({ tipo: "humo", x: lx, y: ly, vx: Math.cos(a) * v * 1.6, vy: Math.sin(a) * v * .5, g: 10 * f, roce: .93, r: (1.6 + Math.random() * 2) * f, a: .28, color: "#d8cdb8", v: 0, vida: .6 + Math.random() * .5 });
    }
    despertar();
  }

  /* ---------------------------------------------------------------- paralaje y forma de la pantalla */
  let pendiente = false, mx = 0, my = 0;
  function alMover(ev) {
    if (quieto() || ev.pointerType === "touch") return;
    mx = ev.clientX / window.innerWidth * 2 - 1; my = ev.clientY / window.innerHeight * 2 - 1;
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const r = document.documentElement.style;
      r.setProperty("--px", mx.toFixed(3)); r.setProperty("--py", my.toFixed(3));
    });
  }
  // Ancha (escritorio, 1600 x 900) o alta (móvil en vertical, 800 x 1500): cada una tiene su composición en el CSS
  function forma() {
    const ancha = window.innerWidth / Math.max(1, window.innerHeight) >= 1.15;
    document.body.dataset.forma = ancha ? "ancha" : "alta";
  }

  /* ---------------------------------------------------------------- la luz de la sala según lo que pasa */
  let luzTimer = null;
  function luz(tipo, ms) {
    const el = document.getElementById("vvEscena");
    if (!el) return;
    el.dataset.luz = tipo || "";
    clearTimeout(luzTimer);
    if (tipo && ms) luzTimer = setTimeout(() => { if (el.dataset.luz === tipo) el.dataset.luz = ""; }, ms);
  }
  // Un temblor corto de la mesa (golpe de la campanilla, una mano que se pierde por pasarse)
  function temblor(el, fuerza) {
    if (!el || !el.animate || quieto()) return;
    const f = fuerza || 4;
    el.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-f}px, ${f / 2}px)` }, { transform: `translate(${f}px, ${-f / 3}px)` }, { transform: `translate(${-f / 2}px, 0)` }, { transform: "translate(0,0)" }], { duration: 320, easing: "ease-out" });
  }

  function montar() {
    const sala = document.getElementById("vjSala");
    if (sala) sala.innerHTML = habitacion();
    forma();
    window.addEventListener("resize", forma);
    window.addEventListener("pointermove", alMover, { passive: true });
    prepararLienzo();
  }

  return { montar, tapete, OBJ, bolsa, campana, columna, FICHA_COLOR, chispas, humo, polvo, luz, temblor, quieto };
})();
