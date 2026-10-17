/* El herrero gigante de la Forja (forja.html): un busto enorme con yelmo de láminas de cobre oxidado, hombreras de tablones cosidos con cuerda, una cadena en la
   muñeca y un mazo de madera clara, delante de su horno y su yunque. Es solo escena y voz: dibuja el SVG, deja que el yelmo se incline hacia el cursor,
   le da frases cortas (con efecto de máquina de escribir), enciende tantas brasas como forjas le quedan a quien lo visita hoy y, al forjar, baja el mazo
   sobre el yunque con chispas. Lo que se forja y lo que sale lo decide el servidor (js/forja.js).
   Sus frases las puede cambiar el Admin (js/dialogos-personajes.js, pestaña Diálogos).
   API: ForjaHerrero.montar(contenedor), .decir(clave), .brasas(hoy, tope), .golpe() -> promesa que se cumple cuando cae el mazo. */
window.ForjaHerrero = (function () {
  const FRASES = {
    saludo: ["Hm. Otro con las manos llenas.", "Trae algo que valga el fuego.", "El hierro no miente. Tú tampoco lo hagas."],
    elige: ["Eso servirá.", "Pon lo que haga falta. Ni una más.", "Cada pieza pesa.", "Despacio. El fuego no corre prisa."],
    falta: ["Eso no sirve para este encargo.", "Aún falta material."],
    listo: ["Con eso basta. Dime cuando.", "Está todo. Golpea cuando quieras."],
    golpe: ["Calla y mira.", "Así se hace."],
    exito: ["Salió bien. El fuego te debe una.", "Buen temple. Llévatela.", "Hm. Quedó mejor de lo que merecías."],
    fallo: ["El hierro no quiso. Pasa a veces.", "Se quebró. Vuelve con más.", "Cenizas. El fuego cobra lo que quiere."],
    agotado: ["Basta por hoy. El fuego también descansa.", "Mañana. Las brasas se han ido."],
    vacio: ["Sin cartas no hay forja.", "Con las manos vacías no se forja nada."],
    error: ["Así no. Mira bien lo que pide.", "No. Otra vez."],
    sinSesion: ["Sin nombre no hay encargo. Inicia sesión."]
  };
  /* Cuándo dice cada grupo (lo enseña el editor de Admin, js/admin-dialogos.js) */
  const CUANDO = {
    saludo: "Al entrar en la forja", elige: "Al abrir el banco y al colocar una pieza", falta: "Si pones una carta que no sirve para el encargo", listo: "Cuando todos los huecos están llenos",
    golpe: "Al golpear", exito: "Cuando la forja funciona", fallo: "Cuando la forja falla", agotado: "Si ya forjaste 3 veces hoy", vacio: "Si no tienes ninguna carta que sirva",
    error: "Si el servidor rechaza algo", sinSesion: "Sin sesión iniciada"
  };
  const ORIGINALES = JSON.parse(JSON.stringify(FRASES));
  if (window.DialogosPersonajes) { DialogosPersonajes.aplicar("herrero", FRASES); DialogosPersonajes.refrescar("herrero", FRASES); }
  const al = lista => lista[Math.floor(Math.random() * lista.length)];

  /* La cadena de colgar: eslabones alternos, uno de canto y otro de frente */
  const cadena = (x, n, ritmo) => `<g class="fh-cadena" style="transform-origin:${x}px 0;animation-delay:${ritmo}s">${Array.from({ length: n }, (_, i) =>
    `<ellipse cx="${x}" cy="${14 + i * 21}" rx="${i % 2 ? 3 : 7}" ry="11" fill="none" stroke="#4a3d36" stroke-width="3.5"/>`).join("")}
    <path d="M${x - 9} ${14 + n * 21} q9 24 18 0" fill="none" stroke="#3a2f2a" stroke-width="4"/></g>`;

  /* Brasas que suben del horno: cada una con su propio tamaño, deriva y tiempo */
  const brasas = Array.from({ length: 18 }, (_, i) => {
    const x = 640 + ((i * 53) % 230), r = 1.2 + (i % 4) * .7, d = 4 + (i % 5) * 1.3, w = (i % 2 ? 1 : -1) * (14 + (i % 3) * 12);
    return `<circle class="fh-brasa" cx="${x}" cy="440" r="${r}" fill="${i % 3 ? "#ff8a2a" : "#ffd070"}" style="--d:${d}s;--w:${w}px;animation-delay:${-(i * 0.9) % d}s"/>`;
  }).join("");

  const ESCENA = `
<svg class="fh-svg" viewBox="0 0 960 560" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Un herrero gigante con yelmo de láminas de cobre oxidado y un mazo de madera, delante de su horno encendido y su yunque">
  <defs>
    <pattern id="fhLadrillo" width="64" height="30" patternUnits="userSpaceOnUse"><rect width="64" height="30" fill="#150e0b"/><rect x="1" y="1" width="30" height="13" fill="#1c1411"/><rect x="34" y="1" width="29" height="13" fill="#191210"/><rect x="17" y="16" width="30" height="13" fill="#1b1310"/><rect x="50" y="16" width="13" height="13" fill="#1c1411"/><rect x="1" y="16" width="14" height="13" fill="#191210"/></pattern>
    <radialGradient id="fhHorno" cx=".5" cy=".85" r=".9"><stop offset="0" stop-color="#fff0b0"/><stop offset=".22" stop-color="#ffb347"/><stop offset=".5" stop-color="#ff6a1a"/><stop offset=".8" stop-color="#7a1a05"/><stop offset="1" stop-color="#1a0805"/></radialGradient>
    <radialGradient id="fhResplandor"><stop offset="0" stop-color="#ff7a20" stop-opacity=".55"/><stop offset=".5" stop-color="#ff5a10" stop-opacity=".16"/><stop offset="1" stop-color="#ff5a10" stop-opacity="0"/></radialGradient>
    <linearGradient id="fhPiel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a8d7e"/><stop offset=".55" stop-color="#6a5d51"/><stop offset="1" stop-color="#2f2722"/></linearGradient>
    <radialGradient id="fhPielLuz"><stop offset="0" stop-color="#e0d5c0" stop-opacity=".55"/><stop offset="1" stop-color="#e0d5c0" stop-opacity="0"/></radialGradient>
    <linearGradient id="fhOxido" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e3418"/><stop offset=".35" stop-color="#c0703c"/><stop offset=".5" stop-color="#e5a074"/><stop offset=".62" stop-color="#b6643a"/><stop offset="1" stop-color="#6a3216"/></linearGradient>
    <linearGradient id="fhHierro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3c34"/><stop offset=".5" stop-color="#2a201b"/><stop offset="1" stop-color="#14100d"/></linearGradient>
    <linearGradient id="fhMadera" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a4c32"/><stop offset=".5" stop-color="#6a3624"/><stop offset="1" stop-color="#4a2418"/></linearGradient>
    <linearGradient id="fhMazo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0e2a8"/><stop offset=".6" stop-color="#cdb878"/><stop offset="1" stop-color="#9c8a52"/></linearGradient>
    <linearGradient id="fhAcero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a49d92"/><stop offset=".5" stop-color="#8d867c"/><stop offset="1" stop-color="#7a746b"/></linearGradient>
    <linearGradient id="fhCobre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6a278"/><stop offset=".5" stop-color="#b86c3c"/><stop offset="1" stop-color="#8a4a22"/></linearGradient>
    <linearGradient id="fhMango" gradientUnits="userSpaceOnUse" x1="192.8" y1="542.9" x2="217.2" y2="584.3"><stop offset="0" stop-color="#6b6048"/><stop offset=".4" stop-color="#4c4237"/><stop offset="1" stop-color="#2f291f"/></linearGradient>
    <linearGradient id="fhDedo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b4ada1"/><stop offset=".55" stop-color="#8f887c"/><stop offset="1" stop-color="#6c665c"/></linearGradient>
    <linearGradient id="fhBrazoGris" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a9387"/><stop offset="1" stop-color="#6d665b"/></linearGradient>
    <linearGradient id="fhMano" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3a797"/><stop offset="1" stop-color="#6b5f54"/></linearGradient>
    <linearGradient id="fhLado" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset=".3" stop-color="#000" stop-opacity=".05"/><stop offset=".72" stop-color="#ff6a1a" stop-opacity="0"/><stop offset="1" stop-color="#ff6a1a" stop-opacity=".38"/></linearGradient>
    <filter id="fhGrano" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.3 0 0 0 -.38"/></filter>
    <radialGradient id="fhVineta" cx=".45" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></radialGradient>
  </defs>

  <!-- pared de piedra y brillo del horno -->
  <rect width="960" height="560" fill="url(#fhLadrillo)"/>
  <rect width="960" height="560" fill="#0a0605" opacity=".35"/>
  <circle cx="750" cy="380" r="380" fill="url(#fhResplandor)" class="fh-brillo"/>

  <!-- herramientas colgadas y cadenas -->
  <g stroke="#3e322c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9">
    <path d="M520 36 L560 120 M540 36 L520 120"/><path d="M596 40 V118"/><rect x="580" y="34" width="32" height="20" fill="#3a2f2a" stroke="none"/>
    <path d="M660 38 L700 112 M690 38 L660 112"/><path d="M780 44 V120 M770 44 H792" stroke-width="7"/>
  </g>
  ${cadena(40, 11, -.8)}${cadena(470, 7, -2.1)}${cadena(930, 10, -3.3)}

  <!-- el horno -->
  <g class="fh-horno">
    <path d="M590 480 V250 Q590 118 750 118 Q910 118 910 250 V480 Z" fill="#2c211c" stroke="#0b0705" stroke-width="7"/>
    <path d="M590 250 Q590 118 750 118 Q910 118 910 250" fill="none" stroke="#44342b" stroke-width="3" stroke-dasharray="26 14"/>
    <path d="M626 480 V262 Q626 158 750 158 Q874 158 874 262 V480 Z" fill="url(#fhHorno)" class="fh-fuego"/>
    <g class="fh-llamas">
      <path d="M690 480 Q676 420 700 380 Q704 412 720 392 Q742 350 730 300 Q770 350 760 400 Q790 380 788 340 Q826 400 800 480Z" fill="#ffd070" opacity=".75" class="fh-llama"/>
      <path d="M708 480 Q700 440 720 410 Q730 440 744 420 Q756 392 750 360 Q782 400 776 440 Q796 430 800 480Z" fill="#fff0b0" opacity=".8" class="fh-llama fh-llama-2"/>
    </g>
    <g stroke="#0b0705" stroke-width="6"><line x1="672" y1="170" x2="672" y2="480"/><line x1="750" y1="158" x2="750" y2="480"/><line x1="828" y1="170" x2="828" y2="480"/></g>
    <rect x="590" y="456" width="320" height="24" fill="#1d1511" stroke="#0b0705" stroke-width="4"/>
  </g>

  <!-- suelo -->
  <rect y="478" width="960" height="82" fill="#150e0b"/><rect y="478" width="960" height="5" fill="#2a1d17"/>
  <ellipse cx="740" cy="500" rx="300" ry="26" fill="#ff7a20" opacity=".17"/>

  <!-- el yunque sobre su tocón -->
  <g class="fh-yunque">
    <path d="M648 470 H758 V560 H648Z" fill="#3a2416" stroke="#0b0705" stroke-width="4"/><g stroke="#1e1209" stroke-width="2" fill="none" opacity=".8"><ellipse cx="703" cy="470" rx="55" ry="9"/><path d="M670 500 H736 M668 530 H738"/></g>
    <path d="M552 424 H792 L846 436 Q852 444 800 454 H738 L752 474 H668 L680 454 H600 Q552 448 552 424Z" fill="url(#fhHierro)" stroke="#050302" stroke-width="5" stroke-linejoin="round"/>
    <path d="M560 427 H790" stroke="#8a766a" stroke-width="3" opacity=".7"/><path d="M590 456 H690" stroke="#000" stroke-width="3" opacity=".5"/>
    <rect x="652" y="408" width="74" height="15" rx="3" fill="#ff7a20" class="fh-rojo"/><rect x="652" y="408" width="74" height="5" rx="2" fill="#ffd070" class="fh-rojo"/>
    <g class="fh-chispas" transform="translate(735 410)" stroke="#ffd070" stroke-width="3" stroke-linecap="round"><path d="M0 0 L-40 -34 M0 0 L-14 -52 M0 0 L10 -56 M0 0 L38 -40 M0 0 L56 -14 M0 0 L-58 -12"/><circle cx="-30" cy="-44" r="3" fill="#fff0b0" stroke="none"/><circle cx="34" cy="-50" r="3" fill="#fff0b0" stroke="none"/><circle cx="0" cy="-64" r="2.5" fill="#fff0b0" stroke="none"/></g>
  </g>

  <!-- tablones apilados en primer plano -->
  <g class="fh-pila">
    <g transform="translate(637.5 528.3) rotate(-17)"><rect x="-61.9" y="-18.8" width="123.7" height="37.5" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-54.9" y="-11.8" width="109.7" height="23.5" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(727.5 515.2) rotate(8)"><rect x="-52.5" y="-17.8" width="105.0" height="35.6" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-45.5" y="-10.8" width="91.0" height="21.6" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(714.4 546.9) rotate(-4)"><rect x="-70.3" y="-17.8" width="140.6" height="35.6" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-63.3" y="-10.8" width="126.6" height="21.6" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(808.1 518.9) rotate(-12)"><rect x="-57.2" y="-17.8" width="114.4" height="35.6" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-50.2" y="-10.8" width="100.4" height="21.6" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(774.4 494.7) rotate(12)"><rect x="-40.3" y="-14.1" width="80.6" height="28.1" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-33.3" y="-7.1" width="66.6" height="14.1" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(875.6 528.3) rotate(22)"><rect x="-61.9" y="-18.8" width="123.7" height="37.5" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-54.9" y="-11.8" width="109.7" height="23.5" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
    <g transform="translate(845.6 550.7) rotate(-6)"><rect x="-57.2" y="-18.8" width="114.4" height="37.5" rx="3" fill="#8b4b2c" stroke="#d19a62" stroke-width="2.6"/><rect x="-50.2" y="-11.8" width="100.4" height="23.5" fill="#7a3f24" stroke="#4a2412" stroke-width="1.6"/></g>
  </g>

  <!-- el gigante -->
  <g class="fh-gigante">
    <!-- tronco de piel gris y pelaje oscuro -->
    <path d="M10 560 L28 404 Q50 332 130 308 L230 294 Q330 320 430 294 L530 308 Q610 332 632 404 L650 560Z" fill="url(#fhPiel)"/>
    <ellipse cx="346" cy="410" rx="150" ry="88" fill="url(#fhPielLuz)" opacity=".7"/>
    <path d="M10 560 L28 404 Q50 332 130 308 L230 294 Q330 320 430 294 L530 308 Q610 332 632 404 L650 560Z" fill="url(#fhLado)"/>
    <path d="M250 330 Q330 372 410 330 L400 420 Q330 450 260 420Z" fill="#000" opacity=".18"/>
    <path d="M258 304 Q330 346 402 304" fill="none" stroke="#2a221d" stroke-width="6" opacity=".5"/>
    <path d="M0 334 L18 314 L8 298 L40 302 L36 284 L70 298 L72 278 L104 300 L112 286 L140 306 L172 302 L170 334 L132 376 L70 414 L0 436Z" fill="#0d0907"/>
    <path d="M660 334 L642 314 L652 298 L620 302 L624 284 L590 298 L588 278 L556 300 L548 286 L520 306 L488 302 L490 334 L528 376 L590 414 L660 436Z" fill="#0d0907"/>
    <g stroke="#2a201b" stroke-width="2" fill="none"><path d="M20 340 L60 380 M44 322 L90 372 M80 322 L120 360"/><path d="M640 340 L600 380 M616 322 L570 372 M580 322 L540 360"/></g>

    <!-- tablones: hombreras y arneses cosidos con cuerda -->
    <g class="fh-tablones" stroke="#cfae72" stroke-width="2.2" stroke-linejoin="round">
      <g transform="rotate(-8 94 360)"><rect x="70" y="300" width="48" height="124" rx="4" fill="url(#fhMadera)"/><rect x="77" y="310" width="34" height="104" fill="none" stroke="#2e170d" stroke-width="2"/></g>
      <g transform="rotate(-4 146 355)"><rect x="122" y="292" width="48" height="136" rx="4" fill="url(#fhMadera)"/><rect x="129" y="302" width="34" height="116" fill="none" stroke="#2e170d" stroke-width="2"/></g>
      <rect x="176" y="300" width="44" height="178" rx="4" fill="url(#fhMadera)"/><rect x="182" y="310" width="32" height="158" fill="none" stroke="#2e170d" stroke-width="2"/>
      <rect x="226" y="296" width="44" height="192" rx="4" fill="url(#fhMadera)"/><rect x="232" y="306" width="32" height="172" fill="none" stroke="#2e170d" stroke-width="2"/>
      <rect x="390" y="296" width="44" height="192" rx="4" fill="url(#fhMadera)"/><rect x="396" y="306" width="32" height="172" fill="none" stroke="#2e170d" stroke-width="2"/>
      <rect x="440" y="300" width="44" height="178" rx="4" fill="url(#fhMadera)"/><rect x="446" y="310" width="32" height="158" fill="none" stroke="#2e170d" stroke-width="2"/>
      <g transform="rotate(4 514 355)"><rect x="490" y="292" width="48" height="136" rx="4" fill="url(#fhMadera)"/><rect x="497" y="302" width="34" height="116" fill="none" stroke="#2e170d" stroke-width="2"/></g>
      <g transform="rotate(8 566 360)"><rect x="542" y="300" width="48" height="124" rx="4" fill="url(#fhMadera)"/><rect x="549" y="310" width="34" height="104" fill="none" stroke="#2e170d" stroke-width="2"/></g>
      <g stroke="#e0c488" stroke-width="2.4" fill="none"><path d="M112 330 l24 10 M112 340 l24 -10 M216 360 l14 6 M216 366 l14 -6 M216 420 l14 6 M216 426 l14 -6 M396 360 l-14 6 M396 366 l-14 -6 M396 420 l-14 6 M396 426 l-14 -6 M524 330 l-24 10 M524 340 l-24 -10"/></g>
    </g>

    <!-- cuello -->
    <path d="M258 248 L402 248 L424 304 Q330 340 236 304Z" fill="#5c5046"/>
    <path d="M262 252 Q330 290 398 252" fill="none" stroke="#2a221d" stroke-width="5" opacity=".5"/>

    <ellipse cx="330" cy="272" rx="84" ry="18" fill="#000" opacity=".3"/>
    <!-- el yelmo: cúpula de hierro oscuro y láminas de cobre oxidado -->
    <g class="fh-cabeza" style="transform-origin:330px 300px"><g transform="translate(0 6) rotate(-4 330 262) translate(330 262) scale(1.12) translate(-330 -262)">
      <path d="M224 238 C214 120 266 34 338 30 C412 34 456 112 450 238 L432 262 L242 262Z" fill="url(#fhHierro)" stroke="#0a0605" stroke-width="5"/>
      <path d="M250 96 C278 54 320 42 346 44" fill="none" stroke="#7a6a5e" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      <g stroke="#7a6556" stroke-width="2" fill="#2b2019"><rect x="226" y="108" width="44" height="26"/><rect x="228" y="140" width="42" height="26"/><rect x="230" y="172" width="40" height="26"/><rect x="404" y="112" width="44" height="26"/><rect x="404" y="144" width="42" height="26"/><rect x="402" y="176" width="40" height="26"/></g>
      <rect x="304" y="68" width="62" height="206" fill="#040201"/>
      <g class="fh-brasas-ojos"><rect x="309" y="140" width="3" height="34" fill="#ff8a2a"/><rect x="358" y="140" width="3" height="34" fill="#ff8a2a"/></g>
      <path d="M264 92 L312 72 L317 254 L292 280 L264 248Z" fill="url(#fhOxido)" stroke="#2a130a" stroke-width="3"/>
      <path d="M322 64 L350 64 L348 214 L322 214Z" fill="url(#fhOxido)" stroke="#2a130a" stroke-width="3"/>
      <path d="M356 74 L404 94 L402 246 L376 276 L356 254Z" fill="url(#fhOxido)" stroke="#2a130a" stroke-width="3"/>
      <rect x="320" y="222" width="30" height="40" fill="#060302"/><g fill="#2a1f19"><rect x="322" y="228" width="7" height="8"/><rect x="332" y="228" width="7" height="8"/><rect x="341" y="228" width="7" height="8"/><rect x="326" y="244" width="7" height="8"/><rect x="337" y="244" width="7" height="8"/></g>
      <g stroke="#f4b98a" stroke-width="2.4" fill="none" opacity=".55" stroke-linecap="round"><path d="M270 98 L296 248"/><path d="M326 70 L328 208"/><path d="M362 80 L396 98"/></g>
      <g stroke="#2a130a" stroke-width="2" opacity=".7"><path d="M280 140 l8 30 M300 100 l4 36 M372 130 l6 40 M390 160 l2 30"/></g>
      <g fill="#b97a4a" stroke="#2f160a" stroke-width="2"><circle cx="290" cy="110" r="5.5"/><circle cx="336" cy="82" r="5.5"/><circle cx="384" cy="118" r="5.5"/><circle cx="302" cy="238" r="5.5"/><circle cx="368" cy="250" r="5.5"/></g>
      <g stroke="#2f160a" stroke-width="2"><path d="M286 107 l8 6 M332 79 l8 6 M380 115 l8 6 M298 235 l8 6 M364 247 l8 6"/></g>
    </g></g>

    <!-- el antebrazo con tablones, la cadena, la mano y el mazo de madera -->
    <!-- el brazalete de tablones del otro brazo, con su cadena -->
    <g class="fh-brazalete">
      <g transform="rotate(16 100 504)" stroke="#cfae72" stroke-width="2.2">
        <rect x="-50" y="436" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="466" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="496" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="526" width="280" height="28" rx="3" fill="url(#fhMadera)"/>
        <g stroke="#e0c488" stroke-width="2.4"><path d="M40 460 v10 M120 460 v10 M60 490 v10 M150 490 v10 M30 520 v10 M110 520 v10"/></g>
      </g>
      <!-- la cadena: una cuerda oscura con eslabones que se enredan en la muñeca -->
      <path d="M200 474 Q214 500 218 548" fill="none" stroke="#1a1412" stroke-width="7" stroke-linecap="round"/>
      <g fill="none" stroke="#8a7d72" stroke-width="3.4"><ellipse cx="203" cy="480" rx="9" ry="5.5" transform="rotate(48 203 480)"/><ellipse cx="209" cy="494" rx="4" ry="9" transform="rotate(24 209 494)"/><ellipse cx="214" cy="508" rx="9" ry="5.5" transform="rotate(14 214 508)"/><ellipse cx="217" cy="522" rx="4" ry="9"/><ellipse cx="218" cy="537" rx="9" ry="5.5" transform="rotate(-8 218 537)"/><ellipse cx="217" cy="551" rx="4" ry="8" transform="rotate(-6 217 551)"/></g>
      <path d="M200 478 q-16 4 -22 18" fill="none" stroke="#8a7d72" stroke-width="3.4"/>
    </g>

    <!-- el brazo derecho sube desde abajo y empuña un mazo de hierro con placa de cobre; todo el conjunto baja sobre el yunque al golpear -->
    <g class="fh-brazo" style="transform-origin:205px 564px">
      <!-- el antebrazo de acero sube desde abajo, con un filo de madera en el borde -->
      <path d="M528 470 L598 440 L652 508 L662 562 L545 562 L538 520Z" fill="url(#fhBrazoGris)" stroke="#4a4036" stroke-width="3" stroke-linejoin="round"/>
      <path d="M598 440 L652 508" stroke="#d8a878" stroke-width="3" opacity=".85" stroke-linecap="round"/>
      <g fill="none" stroke="#66665f" stroke-width="2.2" opacity=".7" stroke-linecap="round"><path d="M548 500 L560 556"/><path d="M575 486 L598 556"/><path d="M600 470 L632 548"/></g>
      <!-- el mango, de madera oliva oscura, de abajo a la izquierda hasta la cabeza -->
      <path d="M192.8 542.9 L629.8 285.3 L654.2 326.7 L217.2 584.3Z" fill="url(#fhMango)" stroke="#16140d" stroke-width="3" stroke-linejoin="round"/>
      <path d="M197 545 L632 289" stroke="#8a8260" stroke-width="3" opacity=".55" stroke-linecap="round"/>
      <g stroke="#16140d" stroke-width="2" opacity=".75" stroke-linecap="round"><g transform="translate(580 330) rotate(-30.5)"><path d="M-12 -12v24 M-4 -12v24 M4 -12v24 M-14 -4h28 M-14 4h28"/></g><g transform="translate(334 481) rotate(-30.5)"><path d="M-12 -12v24 M-4 -12v24 M4 -12v24 M-14 -4h28 M-14 4h28"/></g></g>
      <!-- la cabeza: losa de acero con remaches, una placa de cobre y el canto de cobre abajo -->
      <g transform="translate(710.3 275.4) rotate(-28.5)">
        <rect x="64" y="-34" width="38" height="78" rx="5" fill="#4e4c3a" stroke="#1e1e1a" stroke-width="3.2"/>
        <rect x="64" y="-34" width="38" height="9" rx="4" fill="#6a6850" opacity=".7"/>
        <rect x="-68.5" y="-135.5" width="137" height="271" rx="8" fill="url(#fhAcero)" stroke="#2e2a26" stroke-width="4"/>
        <rect x="-64.5" y="-131.5" width="129" height="22" rx="5" fill="#d4cdc2" opacity=".5"/>
        <path d="M-64.5 108 H64.5 V128 Q64.5 131.5 61 131.5 H-61 Q-64.5 131.5 -64.5 128Z" fill="#b57a52" stroke="#6a3a1e" stroke-width="2"/>
        <g stroke="#3a342e" stroke-width="2.6"><path d="M-68.5 -110 H68.5"/><path d="M-68.5 88 H68.5"/><path d="M-68.5 104 H68.5"/></g>
        <g fill="#968f84" stroke="#2e2a26" stroke-width="2.2"><circle cx="-54" cy="-80" r="5.4"/><circle cx="0" cy="-80" r="5.4"/><circle cx="54" cy="-80" r="5.4"/><circle cx="-54" cy="70" r="5.4"/><circle cx="0" cy="70" r="5.4"/><circle cx="54" cy="70" r="5.4"/></g>
        <path d="M-34.8 -56.9 H34.8 L47.8 -43.9 V39.9 L34.8 52.9 H-34.8 L-47.8 39.9 V-43.9Z" fill="url(#fhCobre)" stroke="#6a3a1e" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M-30 -51 H30 L41 -40 V37 L30 47 H-30 L-41 37 V-40Z" fill="none" stroke="#f0c09a" stroke-width="1.8" opacity=".4"/>
        <g fill="#8a4a22" stroke="#4a240e" stroke-width="1.8"><circle cx="-36" cy="-42" r="3.8"/><circle cx="36" cy="-42" r="3.8"/><circle cx="-36" cy="38" r="3.8"/><circle cx="36" cy="38" r="3.8"/></g>
        <g stroke="#3a342e" stroke-width="2" opacity=".6" fill="none" stroke-linecap="round"><path d="M-60 -96 l14 14"/><path d="M-12 -98 l6 12"/><path d="M54 56 l-8 22"/><path d="M-6 6 l12 6"/><path d="M50 -20 l6 -16"/></g>
      </g>
    <!-- el puño de acero: la palma, cuatro dedos con dos falanges y los nudillos en anillo -->
      <path d="M486 420 L490.7 446.9 L506.7 464.8 L532.8 476 L560.8 472 L580.9 456.9 L596 436.9 L597.7 417 L584.8 377 L572 372 L520 380 L486 400Z" fill="url(#fhBrazoGris)" stroke="#4a4036" stroke-width="3" stroke-linejoin="round"/>
      <g fill="none" stroke="#66665f" stroke-width="2.2" opacity=".7" stroke-linecap="round"><path d="M533 409 L549 461"/><path d="M551 405 L573 449"/><path d="M512 418 L520 460"/><path d="M570 392 L588 430"/></g>
      <g transform="translate(536.8 308.5) rotate(57.5)"><rect x="-15" y="-15" width="100.9" height="30" rx="15" fill="url(#fhDedo)" stroke="#4a4036" stroke-width="2.8"/><path d="M31.9 -11 v22" stroke="#4a4036" stroke-width="2" opacity=".75"/><path d="M-4 -7 H28.4" stroke="#e4e4dc" stroke-width="2.2" opacity=".5" stroke-linecap="round"/></g>
      <g transform="translate(499.9 329.2) rotate(50.0)"><rect x="-15" y="-15" width="106.0" height="30" rx="15" fill="url(#fhDedo)" stroke="#4a4036" stroke-width="2.8"/><path d="M34.2 -11 v22" stroke="#4a4036" stroke-width="2" opacity=".75"/><path d="M-4 -7 H30.4" stroke="#e4e4dc" stroke-width="2.2" opacity=".5" stroke-linecap="round"/></g>
      <g transform="translate(487.9 353.2) rotate(54.0)"><rect x="-15" y="-15" width="94.1" height="30" rx="15" fill="url(#fhDedo)" stroke="#4a4036" stroke-width="2.8"/><path d="M28.8 -11 v22" stroke="#4a4036" stroke-width="2" opacity=".75"/><path d="M-4 -7 H25.6" stroke="#e4e4dc" stroke-width="2.2" opacity=".5" stroke-linecap="round"/></g>
      <g transform="translate(465.5 381.9) rotate(51.3)"><rect x="-15" y="-15" width="81.1" height="30" rx="15" fill="url(#fhDedo)" stroke="#4a4036" stroke-width="2.8"/><path d="M23.0 -11 v22" stroke="#4a4036" stroke-width="2" opacity=".75"/><path d="M-4 -7 H20.5" stroke="#e4e4dc" stroke-width="2.2" opacity=".5" stroke-linecap="round"/></g>
      <g><circle cx="499.9" cy="426" r="9" fill="#c2bbb0" stroke="#4a4036" stroke-width="2.4"/><circle cx="526.8" cy="406.6" r="9" fill="#c2bbb0" stroke="#4a4036" stroke-width="2.4"/><circle cx="552" cy="388.8" r="9" fill="#c2bbb0" stroke="#4a4036" stroke-width="2.4"/><circle cx="576.8" cy="366" r="9" fill="#c2bbb0" stroke="#4a4036" stroke-width="2.4"/></g>
      <path d="M499.9 426 L526.8 406.6 L552 388.8 L576.8 366" fill="none" stroke="#4a4036" stroke-width="2" opacity=".8"/>
    </g>
    <path d="M10 560 L28 404 Q50 332 130 308" fill="none" stroke="#000" stroke-width="2" opacity=".4"/>
  </g>

  <!-- brasas que suben y viñeta -->
  <g class="fh-brasas">${brasas}</g>
  <rect width="960" height="560" filter="url(#fhGrano)" opacity=".3" style="mix-blend-mode:multiply" pointer-events="none"/>
  <rect width="960" height="560" fill="url(#fhVineta)"/>
</svg>`;

  let caja = null, timer = null, ultima = "", sigue = null;

  function montar(contenedor) {
    caja = contenedor;
    caja.innerHTML = `${ESCENA}
      <div class="fh-voz" role="status" aria-live="polite"><span class="fh-quien">El herrero</span><p class="fh-texto"></p></div>
      <div class="fh-brasero" aria-label="Forjas que te quedan hoy"><span class="fh-brasero-etq">Forjas de hoy</span><span class="fh-brasero-fila"></span></div>`;
    const cabeza = caja.querySelector(".fh-cabeza");
    // en pantallas pequeñas el herrero va en una franja baja y se enseña entero; en las grandes, recortado por arriba para que llene el cuadro
    const svg = caja.querySelector(".fh-svg"), estrecha = matchMedia("(max-width: 900px)");
    const ajustar = () => svg.setAttribute("preserveAspectRatio", estrecha.matches ? "xMidYMid meet" : "xMidYMax slice");
    ajustar();
    if (estrecha.addEventListener) estrecha.addEventListener("change", ajustar);
    caja.addEventListener("mousemove", ev => {
      if (!cabeza || caja.classList.contains("fh-golpeando")) return;
      const r = caja.getBoundingClientRect();
      const dx = ((ev.clientX - r.left) / r.width - 0.35) * 8, dy = ((ev.clientY - r.top) / r.height - 0.4) * 5;
      cabeza.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(dx * .35).toFixed(1)}deg)`;
    });
    caja.addEventListener("mouseleave", () => { if (cabeza) cabeza.style.transform = ""; });
  }

  /* Dice una frase del grupo (clave) o un texto suelto. Con movimiento reducido sale entera de golpe */
  function decir(clave) {
    if (!caja) return;
    const lista = FRASES[clave];
    let texto = lista ? al(lista) : String(clave || "");
    if (lista && lista.length > 1 && texto === ultima) texto = al(lista);
    ultima = texto;
    const p = caja.querySelector(".fh-texto");
    clearInterval(timer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { p.textContent = texto; return; }
    p.textContent = "";
    let i = 0;
    timer = setInterval(() => { p.textContent = texto.slice(0, ++i); if (i >= texto.length) clearInterval(timer); }, 28);
  }

  function brasasHoy(hoy, tope) {
    if (!caja) return;
    const quedan = Math.max(0, tope - hoy);
    caja.querySelector(".fh-brasero-fila").innerHTML = Array.from({ length: tope }, (_, i) => `<i class="fh-carbon${i < quedan ? " fh-carbon-vivo" : ""}"></i>`).join("");
    caja.querySelector(".fh-brasero").setAttribute("aria-label", `Te quedan ${quedan} de ${tope} forjas hoy`);
  }

  /* Baja el mazo sobre el yunque: la promesa se cumple justo cuando cae, para enseñar el resultado después del golpe */
  function golpe() {
    return new Promise(resolver => {
      if (!caja) { resolver(); return; }
      caja.classList.remove("fh-golpeando");
      void caja.offsetWidth;
      caja.classList.add("fh-golpeando");
      const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(resolver, reducido ? 80 : 760);
      setTimeout(() => caja.classList.remove("fh-golpeando"), reducido ? 100 : 1500);
    });
  }

  return { montar, decir, brasas: brasasHoy, golpe, FRASES, ORIGINALES, CUANDO };
})();
