/* =============================================================================
   HIPÓDROMO: los objetos de pago del criadero (js/hipodromo-criadero.js). Aquí solo está lo que se ve: el dibujo de cada uno, dónde se pone en la escena y dónde se
   colocan las criaturas para usarlo. Lo que cuestan y qué son (nombre, grupo, texto) lo decide el motor: HipodromoMotor.OBJETOS_CRIADERO.
   Las dos zonas se dibujan en dos piezas (el fondo y la valla de delante) para que las criaturas queden dentro; por eso hay claves como recinto y recinto_f.
============================================================================= */
window.HipodromoCriaderoObjetos = (function () {
  "use strict";
  const valla = (x0, x1, y, n, alto) => { let s = `<path d="M${x0} ${y - alto * 0.62} H${x1} M${x0} ${y - alto * 0.22} H${x1}" stroke="#6b4a2c" stroke-width="4" stroke-linecap="round"/>`; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; s += `<rect x="${(x - 3).toFixed(1)}" y="${y - alto}" width="6" height="${alto}" rx="1.4" fill="#7a5632" stroke="#3b2412" stroke-width="1.4"/>`; } return s; };

  const SVG = {
    recinto: `<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="150" cy="86" rx="146" ry="30" fill="#c8b07c"/><ellipse cx="150" cy="86" rx="130" ry="24" fill="#d6c08c"/>
      <path d="M40 80 q12 -6 26 0 M120 94 q14 -6 28 0 M210 78 q12 -6 24 0 M170 70 q10 -4 20 0" stroke="#b49a68" stroke-width="2.4" fill="none" stroke-linecap="round"/>${valla(8, 292, 64, 12, 40)}
      <path d="M150 64 V14" stroke="#5a3b21" stroke-width="3.6"/><path d="M150 14 L186 24 L150 34 Z" fill="#c9463a" stroke="#6b1f18" stroke-width="2"/></svg>`,
    recinto_f: `<svg viewBox="0 0 300 40" xmlns="http://www.w3.org/2000/svg">${valla(8, 292, 38, 12, 26)}</svg>`,
    rincon: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="92" rx="96" ry="22" fill="#c8b25b" opacity=".75"/>
      <path d="M12 30 L188 30 L174 52 L26 52 Z" fill="#e9e2cc" stroke="#9b9278" stroke-width="2" stroke-linejoin="round"/><path d="M26 52 L174 52 M44 30 L50 52 M80 30 L84 52 M120 30 L118 52 M156 30 L152 52" stroke="#b9b199" stroke-width="1.6"/>
      <path d="M14 28 V92 M186 28 V92" stroke="#5a3b21" stroke-width="5" stroke-linecap="round"/>${valla(14, 186, 88, 7, 32)}</svg>`,
    rincon_f: `<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">${valla(14, 186, 38, 7, 24)}</svg>`,
    neumatico: `<svg viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="64" rx="34" ry="5" fill="#000" opacity=".25"/><ellipse cx="40" cy="38" rx="30" ry="28" fill="#2b2b2e" stroke="#101012" stroke-width="2"/>
      <ellipse cx="40" cy="38" rx="14" ry="13" fill="#7fb0a0" opacity=".55"/><ellipse cx="40" cy="38" rx="14" ry="13" fill="none" stroke="#101012" stroke-width="2"/><path d="M16 26 Q40 12 64 26 M12 38 H20 M60 38 H68 M16 50 Q40 64 64 50" stroke="#46464c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
    cuerda: `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg"><ellipse cx="46" cy="38" rx="38" ry="5" fill="#000" opacity=".22"/><ellipse cx="44" cy="28" rx="30" ry="11" fill="none" stroke="#c6a96a" stroke-width="7"/><ellipse cx="44" cy="28" rx="19" ry="6.6" fill="none" stroke="#a98c4f" stroke-width="6"/>
      <ellipse cx="44" cy="28" rx="9" ry="2.6" fill="none" stroke="#c6a96a" stroke-width="5"/><path d="M72 30 C84 30 92 22 96 12" stroke="#c6a96a" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="96" cy="11" r="5" fill="#8a6a35" stroke="#4a3517" stroke-width="1.6"/></svg>`,
    columpio: `<svg viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg"><ellipse cx="70" cy="172" rx="62" ry="7" fill="#000" opacity=".22"/>
      <path d="M18 172 L34 18 M122 172 L106 18" stroke="#5a3b21" stroke-width="9" stroke-linecap="round"/><path d="M14 22 H126" stroke="#6b4a2c" stroke-width="10" stroke-linecap="round"/>
      <g class="hc-balanceo" style="transform-box:fill-box;transform-origin:50% 0"><path d="M52 24 V126 M88 24 V126" stroke="#c6a96a" stroke-width="4" stroke-linecap="round"/><rect x="34" y="124" width="72" height="20" rx="10" fill="#8a5a31" stroke="#3b2412" stroke-width="2.4"/><path d="M44 134 H96" stroke="#6b4423" stroke-width="1.8"/></g></svg>`,
    charca: `<svg viewBox="0 0 180 76" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="46" rx="86" ry="26" fill="#6a5a3a"/><ellipse cx="90" cy="44" rx="80" ry="22" fill="#5aa3b5"/><ellipse cx="86" cy="42" rx="62" ry="15" fill="#6fbad0"/>
      <ellipse cx="60" cy="38" rx="14" ry="3" fill="#fff" opacity=".28"/><ellipse cx="124" cy="48" rx="7" ry="2.6" fill="#3f8d4a"/><ellipse cx="136" cy="44" rx="5" ry="2" fill="#4a9b55"/><circle cx="136" cy="43" r="1.6" fill="#f2c0d0"/>
      <g class="hc-ondas" fill="none" stroke="#e4f6fb" stroke-width="1.4" opacity=".7"><ellipse cx="96" cy="44" rx="14" ry="4"><animate attributeName="rx" dur="3.2s" repeatCount="indefinite" values="6;22;6"/><animate attributeName="opacity" dur="3.2s" repeatCount="indefinite" values=".8;0;.8"/></ellipse></g>
      <g class="hc-pato" style="animation-delay:-3s"><ellipse cx="72" cy="40" rx="9" ry="5.4" fill="#f4f1e6" stroke="#b9b39b" stroke-width="1"/><circle cx="80" cy="35" r="4" fill="#2f7d55"/><path d="M83 35 L89 37 L83 38 Z" fill="#e8892f"/></g>
      <g class="hc-pato" style="animation-delay:-9s"><ellipse cx="112" cy="50" rx="8" ry="5" fill="#f4f1e6" stroke="#b9b39b" stroke-width="1"/><circle cx="104" cy="45.5" r="3.6" fill="#7a5a2f"/><path d="M101 45.5 L96 47 L101 48.4 Z" fill="#e8892f"/></g>
      <path d="M14 38 V18 M20 40 V12 M26 38 V20 M158 40 V16 M164 42 V10 M170 40 V20" stroke="#4a8a3e" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="20" cy="12" rx="3" ry="6" fill="#6b4a2c"/><ellipse cx="164" cy="10" rx="3" ry="6" fill="#6b4a2c"/></svg>`,
    arbol_sombra: `<svg viewBox="0 0 220 250" xmlns="http://www.w3.org/2000/svg"><ellipse cx="110" cy="236" rx="100" ry="14" fill="#0b2a14" opacity=".34"/><path d="M96 238 L102 118 H120 L126 238 Z" fill="#5a3a22" stroke="#33200f" stroke-width="2.4"/><path d="M108 150 L70 118 M114 140 L152 112" stroke="#5a3a22" stroke-width="9" stroke-linecap="round"/>
      <g class="hc-copa"><circle cx="64" cy="98" r="46" fill="#2f6a3e"/><circle cx="158" cy="96" r="48" fill="#357a42"/><circle cx="110" cy="58" r="54" fill="#3f8a4c"/><circle cx="84" cy="70" r="30" fill="#4a9356" opacity=".7"/><circle cx="140" cy="62" r="22" fill="#56a063" opacity=".55"/><circle cx="96" cy="38" r="12" fill="#fff" opacity=".08"/></g></svg>`,
    arbusto_bayas: `<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="88" rx="52" ry="6" fill="#000" opacity=".22"/><circle cx="34" cy="62" r="28" fill="#2f6a3e"/><circle cx="82" cy="62" r="28" fill="#2c6137"/><circle cx="58" cy="44" r="32" fill="#3a7a48"/><circle cx="46" cy="36" r="12" fill="#4a9356" opacity=".6"/>
      ${[[30, 56], [48, 40], [70, 52], [86, 66], [58, 62], [40, 72], [74, 36], [22, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#c8383f" stroke="#7a1f25" stroke-width="1"/><circle cx="${x - 1.2}" cy="${y - 1.4}" r="1.2" fill="#fff" opacity=".6"/>`).join("")}</svg>`,
    rocas_musgo: `<svg viewBox="0 0 110 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="55" cy="58" rx="50" ry="5" fill="#000" opacity=".22"/><path d="M6 56 C4 36 18 22 34 26 C46 14 66 18 70 34 C84 30 98 42 94 56 Z" fill="#8f9a96" stroke="#4d5855" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M20 58 C18 44 30 38 40 42 C50 34 62 40 64 50 C70 46 78 50 78 58 Z" fill="#a4aeaa" stroke="#4d5855" stroke-width="2" stroke-linejoin="round"/><path d="M12 38 C22 30 32 32 38 28 M52 24 C62 20 70 26 70 34" stroke="#5fa04e" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/><path d="M60 52 C68 48 76 50 80 56" stroke="#5fa04e" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    parterre: `<svg viewBox="0 0 140 56" xmlns="http://www.w3.org/2000/svg"><ellipse cx="70" cy="50" rx="64" ry="5" fill="#000" opacity=".2"/><path d="M6 44 L16 24 H124 L134 44 Z" fill="#6b4a2c" stroke="#3b2412" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 24 H124 L121 30 H19 Z" fill="#8a5a31"/><path d="M10 38 H130" stroke="#8a5a31" stroke-width="2"/>
      ${[[22, 22, "#e86f8a"], [38, 18, "#f2f0e0"], [54, 22, "#f2c14e"], [70, 16, "#a98ae0"], [86, 22, "#e86f8a"], [102, 18, "#f2c14e"], [118, 22, "#f2f0e0"], [30, 26, "#a98ae0"], [62, 28, "#f2f0e0"], [94, 28, "#e86f8a"]].map(([x, y, c]) => `<path d="M${x} 32 V${y + 3}" stroke="#2f6a3a" stroke-width="2.2"/><circle cx="${x}" cy="${y}" r="5.4" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.9" fill="#7a4a1a"/>`).join("")}</svg>`,
    tronco_hueco: `<svg viewBox="0 0 130 74" xmlns="http://www.w3.org/2000/svg"><ellipse cx="62" cy="68" rx="58" ry="5" fill="#000" opacity=".22"/><path d="M14 58 C10 36 22 22 44 22 H104 C118 22 124 34 124 44 C124 56 116 62 104 62 H34 C24 62 18 62 14 58 Z" fill="#7a5632" stroke="#3b2412" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M40 30 H104 M34 44 H110 M40 56 H100" stroke="#5a3b21" stroke-width="2" opacity=".8"/><ellipse cx="22" cy="42" rx="14" ry="19" fill="#4b3018" stroke="#33200f" stroke-width="2.4"/><ellipse cx="22" cy="42" rx="8" ry="13" fill="#150e08"/><path d="M14 40 C14 34 18 30 22 30" stroke="#8a6a3f" stroke-width="1.6" fill="none"/>
      <path d="M60 24 C70 16 84 18 90 24 M96 26 C104 22 112 24 116 30" stroke="#5fa04e" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="76" cy="20" r="3.4" fill="#d9534f"/><circle cx="82" cy="17" r="1.6" fill="#fff" opacity=".6"/></svg>`
  };

  /* Dónde va cada uno en la escena: x en % del ancho, f de 0 (cerca) a 1 (lejos), w en % del ancho; spots = dónde se ponen las criaturas para usarlo (dir: hacia dónde miran);
     clave del motor a la que pertenece (el recinto y el rincón son dos piezas cada uno). */
  const UBIC = {
    recinto: { clave: "recinto_crias", x: 49, f: 0.22, w: 27 }, recinto_f: { clave: "recinto_crias", x: 49, f: 0.115, w: 27 },
    rincon: { clave: "rincon_tranquilo", x: 89, f: 0.52, w: 19 }, rincon_f: { clave: "rincon_tranquilo", x: 89, f: 0.43, w: 19 },
    neumatico: { clave: "neumatico", x: 63, f: 0.34, w: 7, spots: [{ x: 57, f: 0.34, dir: 1 }, { x: 69, f: 0.34, dir: -1 }] },
    cuerda: { clave: "cuerda", x: 73, f: 0.17, w: 8, spots: [{ x: 66.5, f: 0.17, dir: 1 }] },
    columpio: { clave: "columpio", x: 75, f: 0.4, w: 12, spots: [{ x: 68, f: 0.38, dir: 1 }] },
    charca: { clave: "charca", x: 24, f: 0.16, w: 17, spots: [{ x: 15, f: 0.16, dir: 1 }, { x: 33, f: 0.16, dir: -1 }] },
    arbol_sombra: { clave: "arbol_sombra", x: 52, f: 0.86, w: 21, spots: [{ x: 46, f: 0.76, dir: 1 }, { x: 58, f: 0.78, dir: -1 }] },
    arbusto_bayas: { clave: "arbusto_bayas", x: 32, f: 0.62, w: 10, spots: [{ x: 25, f: 0.6, dir: 1 }, { x: 39, f: 0.6, dir: -1 }] },
    rocas_musgo: { clave: "rocas_musgo", x: 8, f: 0.28, w: 9, spots: [{ x: 14.5, f: 0.28, dir: -1 }] },
    parterre: { clave: "parterre", x: 42, f: 0.5, w: 12, spots: [{ x: 35.5, f: 0.5, dir: 1 }, { x: 48.5, f: 0.5, dir: -1 }] },
    tronco_hueco: { clave: "tronco_hueco", x: 6, f: 0.56, w: 10, spots: [{ x: 12.5, f: 0.56, dir: -1 }] }
  };

  /* Qué hace una criatura al usarlo: acc = el estado que adopta (pastar, echar, sentar, mirar, jugar, saltar) y anim = cómo se mueve mientras (la escena lo interpreta). */
  const USO = {
    arbusto_bayas: { acc: "pastar", anim: "comer", alto: 0.5 }, charca: { acc: "pastar", anim: "beber" }, arbol_sombra: { acc: "echar|sentar" },
    rocas_musgo: { acc: "mirar", anim: "olfatear" }, parterre: { acc: "mirar", anim: "olfatear", bajo: true }, tronco_hueco: { acc: "mirar", anim: "olfatear", lado: true },
    cuerda: { acc: "mirar", anim: "tirar" }, columpio: { acc: "mirar", anim: "columpio" }, neumatico: { acc: "saltar" }
  };
  return { SVG, UBIC, USO };
})();
