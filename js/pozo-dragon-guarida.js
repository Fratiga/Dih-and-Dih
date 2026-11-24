/* =============================================================================
   EL POZO DEL DRAGÓN: la guarida (pozo-dragon.html)
   El mundo alrededor de la mesa: la cueva (roca, estalactitas, el tesoro que brilla al fondo), los glifos tallados del menú y el paralaje.
   Aquí no hay reglas ni red. La dirección artística está en css/pozo-dragon-juego.css.
   Rendimiento: un solo SVG fijo, sin filtros; el paralaje mueve dos capas con transform y solo al mover el ratón.
============================================================================= */
window.PozoGuarida = (function () {
  "use strict";
  const reducir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // La cueva: dos paredes de roca que se cierran hacia arriba, estalactitas, el montón de oro al fondo y su luz
  function cueva() {
    const estalactitas = [[120, 150], [230, 90], [330, 190], [470, 120], [610, 70], [990, 80], [1130, 140], [1270, 100], [1380, 180], [1490, 110]]
      .map(([x, l]) => `<path d="M${x - 26} 0L${x} ${l}L${x + 22} 0Z"/>`).join("");
    const monedas = Array.from({ length: 70 }, (_, i) => {
      const x = 240 + (i * 151) % 1120, y = 830 + ((i * 37) % 9) * 9 - Math.sin((x - 240) / 1120 * Math.PI) * 70;
      return `<ellipse cx="${x}" cy="${y.toFixed(0)}" rx="${10 + (i % 4) * 3}" ry="${3 + (i % 3)}"/>`;
    }).join("");
    return `<svg class="pzj-cueva-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="pzjOroLuz" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="#e0a23a" stop-opacity=".42"/><stop offset=".45" stop-color="#9a4a1f" stop-opacity=".16"/><stop offset="1" stop-color="#2a0d10" stop-opacity="0"/></radialGradient>
    <radialGradient id="pzjNegro" cx=".5" cy=".3" r=".65"><stop offset="0" stop-color="#000" stop-opacity=".85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="900" fill="#0d0607"/>
  <g class="pzj-capa-fondo">
    <!-- la garganta de la cueva: donde vive el dragón, lo más oscuro -->
    <ellipse cx="800" cy="260" rx="560" ry="330" fill="url(#pzjNegro)"/>
    <!-- paredes de roca en tres planos -->
    <path d="M0 0H360C300 120 330 260 260 380C200 480 230 640 150 900H0Z" fill="#1c0f12"/>
    <path d="M1600 0H1240C1300 140 1260 270 1340 400C1400 500 1370 650 1450 900H1600Z" fill="#1c0f12"/>
    <path d="M0 0H210C170 160 190 300 120 440C70 560 90 720 40 900H0Z" fill="#26151a"/>
    <path d="M1600 0H1390C1430 150 1410 310 1480 450C1530 570 1510 730 1560 900H1600Z" fill="#26151a"/>
    <g fill="none" stroke="#3a2027" stroke-width="3" stroke-linecap="round" opacity=".8">
      <path d="M60 220c40 30 70 20 100 60M30 520c50 10 70 50 90 90M1540 260c-40 30-70 20-100 60M1570 560c-50 10-70 50-90 90"/>
    </g>
    <g fill="#140a0c">${estalactitas}</g>
  </g>
  <!-- el tesoro al fondo: un resplandor de oro que sube del suelo -->
  <rect y="420" width="1600" height="480" fill="url(#pzjOroLuz)" class="pzj-oro-luz"/>
  <g class="pzj-capa-frente">
    <path d="M140 900C300 830 560 776 800 770C1040 776 1300 830 1460 900Z" fill="#2e180e"/>
    <g fill="#8a6420" opacity=".5">${monedas}</g>
  </g>
</svg>`;
  }

  // Los glifos tallados del menú: cada uno se dibuja como si estuviera grabado en piedra
  const GLIFO = {
    reglas: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M10 6h24l6 6v30H10z" fill="currentColor" opacity=".18"/><path d="M10 6h24l6 6v30H10zM34 6v6h6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 18h4l2 4-2 4h-4M26 18v8M30 18l-4 4 4 4M16 32h18M16 37h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    desafios: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M12 8c4 10 4 22-2 32M22 6c4 12 4 24-2 36M32 8c4 10 4 22-2 32" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M6 26l36-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".7"/></svg>`,
    atajos: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="6" y="14" width="36" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 21h4M20 21h4M28 21h4M36 21h0M12 29h24" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    rapido: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M14 6h20M14 42h20M16 6c0 10 16 12 16 18S16 32 16 42M32 6c0 10-16 12-16 18s16 8 16 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M19 38h10l-5-6z" fill="currentColor"/></svg>`,
    efectos: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 30c6-2 10-8 14-16 2-4 8-6 12-2s2 10-2 12c-6 4-14 8-24 10z" fill="currentColor" opacity=".18"/><path d="M8 30c6-2 10-8 14-16 2-4 8-6 12-2s2 10-2 12c-6 4-14 8-24 10z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M36 10c4 2 6 6 6 10M40 6c5 3 7 8 7 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    movimiento: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M4 24c6-10 12-14 20-14s14 4 20 14c-6 10-12 14-20 14S10 34 4 24z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M24 16c2 3 2 13 0 16-2-3-2-13 0-16z" fill="currentColor"/></svg>`
  };

  let pendiente = false, mx = 0, my = 0;
  function alMover(ev) {
    if (reducir.matches || ev.pointerType === "touch") return;
    mx = ev.clientX / window.innerWidth * 2 - 1; my = ev.clientY / window.innerHeight * 2 - 1;
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const r = document.documentElement.style;
      r.setProperty("--px", mx.toFixed(3)); r.setProperty("--py", my.toFixed(3));
    });
  }

  function montar() {
    const g = document.getElementById("pzjGuarida");
    if (g) g.innerHTML = cueva();
    document.querySelectorAll("[data-glifo]").forEach(e => { e.innerHTML = GLIFO[e.dataset.glifo] || ""; });
    window.addEventListener("pointermove", alMover, { passive: true });
  }
  return { montar, GLIFO };
})();
