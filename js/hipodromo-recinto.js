/* =============================================================================
   HIPÓDROMO: el recinto. El dibujo del hipódromo que queda detrás de toda la página (js/hipodromo-pagina.js lo pone
   de fondo y coloca encima los sitios que se pulsan), los iconos de la barra de secciones y la cabecera de cada sección.
   Todo es SVG fijo y unas pocas animaciones de CSS (nubes, banderas y tres criaturas dando vueltas a la pista): no hay
   lienzo ni bucle, para que no pese en una gráfica integrada.
============================================================================= */
window.HipodromoRecinto = (function () {
  "use strict";

  /* Iconos de trazo (24 × 24). Los usan la barra de secciones, los sitios del recinto y las cabeceras. */
  const TRAZOS = {
    inicio: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/>',
    carrera: '<path d="M5 21V4"/><path d="M5 5h13l-3 4 3 4H5"/>',
    cuadra: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6M9 14l6 6M15 14l-6 6"/>',
    criaturas: '<path d="M6 20c-3-6-2-15 6-15s9 9 6 15h-3c2-5 2-11-3-11s-5 6-3 11z"/>',
    cartas: '<rect x="4" y="6" width="10" height="14" rx="1.5" transform="rotate(-8 9 13)"/><rect x="10" y="4" width="10" height="14" rx="1.5" transform="rotate(8 15 11)"/>',
    noticias: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    apuestas: '<path d="M3 9V6h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
    mundo: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    novedades: '<rect x="4" y="4" width="16" height="12"/><path d="M8 16v5M16 16v5M8 8h8M8 11h5"/>',
    vivo: '<path d="M8 5l11 7-11 7z"/>',
    sonido: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    pleno: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  const icono = id => `<svg class="hj-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[id] || ""}</svg>`;

  /* Los sitios del recinto: a qué sección llevan y dónde va su cartel sobre el dibujo (x, y en tanto por ciento del lienzo de 1600 × 900;
     el cartel queda centrado en x y apoyado por abajo en y). «vivo» es un enlace a la pista a pantalla completa. */
  const SITIOS = [
    { id: "carrera", nombre: "Carrera", x: 62.5, y: 58, principal: true },
    { id: "vivo", nombre: "En vivo", x: 60, y: 23.5, enlace: "hipodromo-vivo.html" },
    { id: "cuadra", nombre: "Mi cuadra", x: 40, y: 29.5 },
    { id: "mundo", nombre: "Mundo", x: 83.2, y: 21 },
    { id: "apuestas", nombre: "Mis apuestas", x: 90, y: 59.5 },
    { id: "criaturas", nombre: "Criaturas", x: 42.5, y: 75 },
    { id: "novedades", nombre: "Novedades", x: 55.8, y: 77 },
    { id: "noticias", nombre: "Noticias", x: 69.5, y: 74.5 },
    { id: "cartas", nombre: "Cartas", x: 85.2, y: 76 }
  ];

  /* La cabecera de cada sección: el sitio del recinto donde está y de qué va */
  const CABECERAS = {
    carrera: ["La pista", "Carrera", "El programa, las inscritas y tu boleto para la próxima carrera."],
    cartas: ["El carromato del Buhonero", "Cartas", "Cambia cartas por tokens de juego, o tokens por cartas."],
    criaturas: ["El paddock", "Criaturas", "Todas las criaturas del mundo, con su ficha."],
    noticias: ["El quiosco", "Noticias", "Lo que se cuenta en el hipódromo."],
    novedades: ["El tablón", "Novedades", "Lo último que se añadió y dónde encontrarlo."],
    apuestas: ["La taquilla", "Mis apuestas", "Tus tokens, lo que tienes en juego y tu historial."],
    mundo: ["El registro", "Mundo", "El mundo en cifras y las cuadras de la tribuna."]
  };

  /* ---------------------------------------------------------------- el dibujo */
  // una criatura pequeña (para la pista, el paddock y la pantalla de carga), de perfil y mirando a la derecha: las patas de
  // atrás del dibujo, el tronco con el cuello, la oreja y la cabeza alargada hasta el hocico, la cola y las patas de delante.
  // Las patas van sueltas y en dos parejas (pa, pb) para que troten donde la hoja de estilos lo pida.
  const pata = (c, x, par) => `<path class="hj-pata ${par}" d="M${x} -9.5 V1" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
  const bicho = (c, cl) => `<g class="hj-bicho ${cl || ""}">${pata(c, -6.2, "pb")}${pata(c, 6.4, "pa")}`
    + `<path d="M-12.5 -16 C-17.5 -16.5 -20.5 -13 -20 -6.5" stroke="${c}" stroke-width="2.8" stroke-linecap="round" fill="none"/>`
    + `<path fill="${c}" d="M-13 -13 C-13 -18 -9 -19.6 -4 -19.1 C0 -18.7 3 -18.5 5.6 -19.6 C8.6 -22.2 10.4 -26 11.9 -30.2 L12.5 -33.6 L15.1 -30.9 C18.6 -30 22.2 -26.6 24.8 -23 C25.9 -21.4 24.7 -19.5 22.8 -19.9 C20.6 -20.4 18.9 -22 17 -22.6 C16.7 -19 15.2 -15 13 -12 C12 -8 6 -6.5 0 -6.5 C-6 -6.5 -13 -7.5 -13 -13 Z"/>`
    + `${pata(c, -9.4, "pa")}${pata(c, 9.6, "pb")}</g>`;
  function arte() {
    let arboles = "";
    for (let i = 0; i < 24; i++) {
      const x = 30 + i * 68 + (i % 3) * 9, y = 356 + (i % 2) * 8, r = 24 + (i * 7) % 11;
      arboles += `<rect x="${x - 3}" y="${y}" width="6" height="26" fill="#5a3a22"/><circle cx="${x}" cy="${y - 6}" r="${r}" fill="${i % 2 ? "#3f7d4b" : "#377243"}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.5}" r="${r * 0.45}" fill="#4b8d57"/>`;
    }
    // el público de la tribuna: tres gradas de cabezas de colores
    let gente = "";
    const tonos = ["#b23a2e", "#e3c44a", "#3f78a8", "#f2edd5", "#6b4a9a", "#d98a2b", "#2f7d6d", "#b0527e"];
    [[322, 0], [346, 7], [372, 3]].forEach(([y, d], f) => { for (let k = 0; k < 20; k++) gente += `<circle cx="${796 + k * 17 + d}" cy="${y}" r="5" fill="${tonos[(k * 3 + f * 5) % tonos.length]}"/>`; });
    const banderin = (x, y, c) => `<path d="M${x} ${y + 44} V${y}" stroke="#4a2f19" stroke-width="3"/><path class="hj-bandera" d="M${x} ${y} l34 9 -34 9z" fill="${c}"/>`;
    const mata = (x, y) => `<path d="M${x} ${y} l-5 -15 M${x} ${y} l1 -19 M${x} ${y} l7 -13" stroke="#3d7a3a" stroke-width="2.4" stroke-linecap="round"/>`;
    const flor = (x, y, c) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle cx="${x}" cy="${y}" r="2" fill="#f2edd5"/>`;
    let hierba = "";
    for (let i = 0; i < 30; i++) { const x = 20 + i * 54 + (i % 4) * 7, y = 838 + (i % 3) * 14; hierba += mata(x, y) + (i % 3 === 0 ? flor(x + 18, y - 6, ["#e3c44a", "#b0527e", "#f2edd5", "#8f7fd0"][i % 4]) : ""); }
    let estrellas = "";
    for (let i = 0; i < 46; i++) estrellas += `<circle cx="${(i * 211 + 37) % 1600}" cy="${(i * 97 + 13) % 300}" r="${1 + (i % 3) * 0.5}" fill="#f2edd5"/>`;

    return `<svg class="hj-arte" viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="1600" height="900" fill="#a9d6d3"/>
  <rect width="1600" height="190" fill="#97cccd"/>
  <g class="hj-estrellas">${estrellas}</g>
  <g class="hj-capa c-cielo">
  <circle class="hj-sol" cx="1470" cy="120" r="44" fill="#f7ecb8"/>
  <g class="hj-nube"><ellipse cx="330" cy="110" rx="86" ry="24" fill="#fff" opacity=".85"/><ellipse cx="390" cy="96" rx="52" ry="20" fill="#fff" opacity=".85"/></g>
  <g class="hj-nube lenta"><ellipse cx="1080" cy="78" rx="96" ry="22" fill="#fff" opacity=".8"/><ellipse cx="1020" cy="92" rx="60" ry="18" fill="#fff" opacity=".8"/></g>
  <g class="hj-nube"><ellipse cx="760" cy="150" rx="64" ry="16" fill="#fff" opacity=".7"/></g>
  </g>
  <g class="hj-capa c-fondo">
  <path d="M0 330 C200 250 380 290 560 310 S900 240 1150 300 1450 255 1600 300 V900 H0Z" fill="#8dbd92"/>
  <path d="M0 372 C260 322 420 352 700 346 S1200 322 1600 362 V900 H0Z" fill="#74aa76"/>
  ${arboles}
  </g>
  <rect y="392" width="1600" height="508" fill="#62a052"/>
  <path d="M0 640 C400 612 1200 660 1600 624 V900 H0Z" fill="#589648"/>
  <path d="M0 800 C500 780 1100 815 1600 790 V900 H0Z" fill="#4f8b42"/>

  <!-- el camino que une los sitios -->
  <path d="M640 404 C640 470 560 560 690 716 M700 730 C820 800 1000 790 1120 772 S1300 760 1345 770 M1345 770 C1420 720 1450 690 1456 640" fill="none" stroke="#cdb780" stroke-width="20" stroke-linecap="round" opacity=".75"/>

  <!-- las cuadras -->
  <g>
    <ellipse cx="640" cy="406" rx="118" ry="10" fill="#000" opacity=".16"/>
    <rect x="556" y="330" width="168" height="74" fill="#7a3f2a"/>
    <path d="M556 330h168v8H556z" fill="#5c2d1d"/>
    <path d="M540 334 L640 272 L740 334 Z" fill="#a5402f"/>
    <path d="M540 334 L640 272 L740 334" fill="none" stroke="#f2edd5" stroke-width="4"/>
    <rect x="612" y="352" width="56" height="52" fill="#3b2416"/>
    <path d="M612 352l56 52M668 352l-56 52" stroke="#7a4a2c" stroke-width="4"/>
    <circle cx="640" cy="310" r="10" fill="#3b2416"/>
    <rect x="570" y="356" width="26" height="22" fill="#e9d79a"/><rect x="684" y="356" width="26" height="22" fill="#e9d79a"/>
    <path d="M520 400h56M704 400h64" stroke="#7b4a2c" stroke-width="4"/><path d="M526 388v16M546 388v16M566 388v16M714 388v16M734 388v16M754 388v16" stroke="#7b4a2c" stroke-width="5"/>
  </g>

  <!-- la tribuna -->
  <g>
    <ellipse cx="960" cy="396" rx="210" ry="10" fill="#000" opacity=".16"/>
    <rect x="780" y="286" width="360" height="108" fill="#6b4127"/>
    <rect x="786" y="310" width="348" height="24" fill="#e6dcbb"/><rect x="786" y="334" width="348" height="24" fill="#d9ceaa"/><rect x="786" y="358" width="348" height="36" fill="#cbbf98"/>
    <g class="hj-gente">${gente}</g>
    <path d="M760 288 L1160 288 L1136 256 L784 256 Z" fill="#a5402f"/>
    <rect x="760" y="286" width="400" height="7" fill="#f2edd5"/>
    <rect x="794" y="292" width="8" height="102" fill="#f2edd5"/><rect x="956" y="292" width="8" height="102" fill="#f2edd5"/><rect x="1118" y="292" width="8" height="102" fill="#f2edd5"/>
    <circle cx="960" cy="272" r="12" fill="#f2edd5"/><path d="M960 264v8l5 4" stroke="#6b4127" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${banderin(820, 212, "#e3c44a")}${banderin(960, 200, "#b23a2e")}${banderin(1100, 212, "#3f78a8")}
  </g>

  <!-- el registro -->
  <g>
    <ellipse cx="1340" cy="398" rx="96" ry="9" fill="#000" opacity=".16"/>
    <rect x="1362" y="336" width="74" height="60" fill="#cbc2a6"/><path d="M1354 338 L1444 338 L1436 318 L1362 318Z" fill="#33566b"/>
    <rect x="1380" y="352" width="16" height="20" fill="#33566b"/><rect x="1406" y="352" width="16" height="20" fill="#33566b"/>
    <rect x="1298" y="240" width="66" height="156" fill="#d9d1b6"/>
    <path d="M1286 244 L1331 186 L1376 244 Z" fill="#33566b"/>
    <circle cx="1331" cy="282" r="17" fill="#f2edd5" stroke="#33566b" stroke-width="4"/><path d="M1331 271v11l8 5" stroke="#33566b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="1318" y="352" width="26" height="44" fill="#5a3a22"/><rect x="1312" y="316" width="38" height="6" fill="#b9b093"/>
    <path d="M1331 186v-22" stroke="#4a2f19" stroke-width="3"/><path class="hj-bandera" d="M1331 164 l26 7 -26 7z" fill="#e3c44a"/>
  </g>

  <!-- la pista -->
  <g>
    <ellipse cx="1000" cy="542" rx="406" ry="131" fill="#f2edd5"/>
    <ellipse cx="1000" cy="542" rx="400" ry="126" fill="#d9c38c"/>
    <ellipse cx="1000" cy="542" rx="400" ry="126" fill="none" stroke="#c9b176" stroke-width="2" stroke-dasharray="3 22"/>
    <ellipse cx="1000" cy="542" rx="304" ry="84" fill="#f2edd5"/>
    <ellipse cx="1000" cy="542" rx="299" ry="80" fill="#6dab5c"/>
    <ellipse cx="1000" cy="548" rx="150" ry="30" fill="#62a052"/>
    <ellipse cx="930" cy="540" rx="52" ry="14" fill="#7fc1cf"/><ellipse cx="930" cy="538" rx="40" ry="9" fill="#a5d9e3"/>
    <circle cx="1070" cy="528" r="15" fill="#3f7d4b"/><circle cx="1094" cy="536" r="12" fill="#4b8d57"/><rect x="1068" y="538" width="5" height="12" fill="#5a3a22"/>
    <!-- la meta -->
    <path d="M1000 626v44" stroke="#f2edd5" stroke-width="6"/><path d="M1000 626v44" stroke="#23262c" stroke-width="6" stroke-dasharray="6 6"/>
    <path d="M986 610v20M1014 610v20" stroke="#4a2f19" stroke-width="4"/><rect x="984" y="602" width="32" height="12" fill="#b23a2e"/><path d="M990 608h20" stroke="#f2edd5" stroke-width="2"/>
    <!-- tres criaturas calentando: dan la vuelta por el centro de la calle -->
    <g class="hj-vuelta v1"><g class="hj-mira">${bicho("#b98a4e")}</g></g><g class="hj-vuelta v2"><g class="hj-mira">${bicho("#8f8f96")}</g></g><g class="hj-vuelta v3"><g class="hj-mira">${bicho("#a5523a")}</g></g>
  </g>

  <!-- la taquilla -->
  <g>
    <ellipse cx="1456" cy="642" rx="64" ry="8" fill="#000" opacity=".16"/>
    <rect x="1408" y="578" width="96" height="62" fill="#e9e1c6"/>
    <rect x="1424" y="592" width="64" height="26" fill="#2c4a3a"/><rect x="1424" y="618" width="64" height="5" fill="#7b4a2c"/>
    <path d="M1398 580 h116 l-8 -22 h-100z" fill="#b23a2e"/>
    <path d="M1421 558 l-4 22 h19 l2 -22z M1456 558 v22 h19 l-3 -22z M1491 558 l3 22 h18 l-6 -22z" fill="#f2edd5"/>
    <circle cx="1440" cy="604" r="5" fill="#e9d79a"/><circle cx="1470" cy="604" r="5" fill="#e9d79a"/>
  </g>

  <!-- el paddock -->
  <g>
    <ellipse cx="690" cy="730" rx="128" ry="40" fill="#d9c38c"/>
    <ellipse cx="690" cy="730" rx="128" ry="40" fill="none" stroke="#7b4a2c" stroke-width="4"/>
    <ellipse cx="690" cy="718" rx="128" ry="40" fill="none" stroke="#7b4a2c" stroke-width="4" stroke-dasharray="1 0"/>
    <path d="M562 716v16M600 690v16M650 680v15M730 680v15M780 690v16M818 716v16M600 756v14M650 766v14M730 766v14M780 756v14" stroke="#7b4a2c" stroke-width="6" stroke-linecap="round"/>
    <g transform="translate(662 738)">${bicho("#c9a36a")}</g><g transform="translate(724 730) scale(-1 1)">${bicho("#6f5a48")}</g>
  </g>

  <!-- el tablón -->
  <g>
    <path d="M876 724v60M932 724v60" stroke="#5a3a22" stroke-width="7" stroke-linecap="round"/>
    <rect x="862" y="700" width="84" height="56" fill="#7b4a2c"/><rect x="868" y="706" width="72" height="44" fill="#e9e1c6"/>
    <rect x="874" y="712" width="26" height="16" fill="#f7ecb8"/><rect x="906" y="712" width="28" height="30" fill="#fff"/><rect x="874" y="732" width="26" height="12" fill="#cfe3d0"/>
    <path d="M856 700 L904 684 L952 700Z" fill="#a5402f"/>
  </g>

  <!-- el quiosco -->
  <g>
    <ellipse cx="1112" cy="778" rx="56" ry="7" fill="#000" opacity=".16"/>
    <rect x="1076" y="716" width="72" height="60" fill="#2f5d54"/>
    <rect x="1086" y="728" width="52" height="24" fill="#16291f"/><rect x="1082" y="752" width="60" height="6" fill="#e9e1c6"/>
    <rect x="1090" y="732" width="12" height="16" fill="#f2edd5"/><rect x="1106" y="732" width="12" height="16" fill="#f7ecb8"/><rect x="1122" y="732" width="12" height="16" fill="#f2edd5"/>
    <path d="M1062 718 L1112 676 L1162 718Z" fill="#d98a2b"/><path d="M1062 718h100" stroke="#f2edd5" stroke-width="4"/>
    <circle cx="1112" cy="672" r="5" fill="#f2edd5"/>
  </g>

  <!-- el carromato del Buhonero -->
  <g>
    <ellipse cx="1340" cy="784" rx="76" ry="8" fill="#000" opacity=".16"/>
    <path d="M1276 742 Q1340 668 1404 742 Z" fill="#b23a2e"/>
    <path d="M1300 742 Q1316 700 1326 690 L1340 742Z M1354 690 Q1368 700 1382 742 L1342 742Z" fill="#f2edd5" opacity=".9"/>
    <rect x="1272" y="740" width="136" height="30" fill="#7b4a2c"/><rect x="1272" y="740" width="136" height="6" fill="#5c2d1d"/>
    <circle cx="1298" cy="776" r="15" fill="none" stroke="#3b2416" stroke-width="6"/><circle cx="1382" cy="776" r="15" fill="none" stroke="#3b2416" stroke-width="6"/>
    <path d="M1298 761v30M1283 776h30M1382 761v30M1367 776h30" stroke="#3b2416" stroke-width="3"/>
    <path d="M1408 752h26" stroke="#5a3a22" stroke-width="5" stroke-linecap="round"/>
    <rect x="1284" y="716" width="14" height="18" fill="#e9d79a"/><rect x="1304" y="712" width="12" height="22" fill="#cfe3d0"/><rect x="1362" y="714" width="16" height="20" fill="#f7ecb8"/>
  </g>

  <!-- la hora del mundo: el atardecer y la noche tiñen el recinto y encienden las luces -->
  <rect class="hj-tarde" width="1600" height="900" fill="#d9772e"/>
  <rect class="hj-noche" width="1600" height="900" fill="#0d2036"/>
  <g class="hj-luces">
    <rect x="570" y="356" width="26" height="22" fill="#f7dc7a"/><rect x="684" y="356" width="26" height="22" fill="#f7dc7a"/>
    <rect x="1380" y="352" width="16" height="20" fill="#f7dc7a"/><rect x="1406" y="352" width="16" height="20" fill="#f7dc7a"/>
    <circle cx="1331" cy="282" r="15" fill="#f7e9a8"/><path d="M1331 271v11l8 5" stroke="#33566b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="1424" y="592" width="64" height="26" fill="#f1cf6a"/>
    <rect x="1086" y="728" width="52" height="24" fill="#f1cf6a"/>
    <circle cx="1420" cy="738" r="7" fill="#f7dc7a"/><circle cx="960" cy="272" r="12" fill="#f7e9a8"/>
    <circle cx="820" cy="300" r="5" fill="#f7dc7a"/><circle cx="1100" cy="300" r="5" fill="#f7dc7a"/><circle cx="640" cy="310" r="8" fill="#f7dc7a"/>
    <circle cx="986" cy="604" r="5" fill="#f7dc7a"/><circle cx="1014" cy="604" r="5" fill="#f7dc7a"/>
  </g>
  <g class="hj-capa c-frente">${hierba}</g>
</svg>`;
  }

  /* Pone el dibujo de fondo, los iconos de la barra y del marcador y la cabecera de cada sección. Se llama una vez, al cargar. */
  function montar() {
    const lienzo = document.getElementById("hjLienzo");
    if (lienzo && !lienzo.firstChild) lienzo.innerHTML = arte();
    document.querySelectorAll(".hj-dock [data-ico]").forEach((i, k) => { i.innerHTML = icono(i.dataset.ico); const b = i.closest("button"); if (b && k < 9) b.insertAdjacentHTML("beforeend", `<kbd>${k + 1}</kbd>`); });
    const pl = document.getElementById("hjPleno"); if (pl) pl.innerHTML = icono("pleno");
    const so = document.getElementById("hjSonido"); if (so) so.innerHTML = icono("sonido");
    Object.keys(CABECERAS).forEach(id => {
      const p = document.getElementById("hipPanel-" + id); if (!p || p.querySelector(".hj-cab")) return;
      const c = CABECERAS[id];
      p.insertAdjacentHTML("afterbegin", `<header class="hj-cab"><button type="button" class="hj-cab-volver" data-ir="inicio">${icono("inicio")}Recinto</button><div><p class="hj-cab-sitio">${c[0]}</p><h2>${c[1]}</h2><p class="hj-cab-lema">${c[2]}</p></div>${icono(id)}</header>`);
    });
    const fig = document.querySelector(".hj-cargando-fig"); if (fig) fig.innerHTML = `<svg viewBox="-34 -37 68 41">${bicho("#14241b")}</svg>`;
    // el fondo se mueve un poco con el cursor, por capas (solo en el recinto y si no se pidió reducir el movimiento)
    if (lienzo && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let pend = false, px = 0, py = 0;
      window.addEventListener("pointermove", e => {
        if (document.body.dataset.pestana !== "inicio") return;
        px = (e.clientX / window.innerWidth) * 2 - 1; py = (e.clientY / window.innerHeight) * 2 - 1;
        if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; lienzo.style.setProperty("--px", px.toFixed(3)); lienzo.style.setProperty("--py", py.toFixed(3)); }); }
      }, { passive: true });
    }
  }
  /* La hora del mundo tiñe el recinto: día, atardecer o noche con las luces encendidas */
  let momentoVisto = "";
  function momento(hora) {
    const mo = hora >= 7 && hora < 18 ? "dia" : hora >= 18 && hora < 21 ? "tarde" : hora >= 5 && hora < 7 ? "tarde" : "noche";
    if (mo === momentoVisto) return; momentoVisto = mo;
    const f = document.getElementById("hjFondo"); if (f) f.dataset.momento = mo;
  }
  /* Al entrar en una sección la cámara se acerca a su sitio en el dibujo */
  function enfocar(id) {
    const s = SITIOS.find(x => x.id === id), lienzo = document.getElementById("hjLienzo"); if (!s || !lienzo) return;
    lienzo.style.setProperty("--ox", s.x + "%"); lienzo.style.setProperty("--oy", Math.min(92, s.y + 8) + "%");
  }

  return { icono, arte, montar, momento, enfocar, SITIOS, CABECERAS };
})();
