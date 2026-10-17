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
    <g class="fh-chispas" transform="translate(690 404)" stroke="#ffd070" stroke-width="3" stroke-linecap="round"><path d="M0 0 L-40 -34 M0 0 L-14 -52 M0 0 L10 -56 M0 0 L38 -40 M0 0 L56 -14 M0 0 L-58 -12"/><circle cx="-30" cy="-44" r="3" fill="#fff0b0" stroke="none"/><circle cx="34" cy="-50" r="3" fill="#fff0b0" stroke="none"/><circle cx="0" cy="-64" r="2.5" fill="#fff0b0" stroke="none"/></g>
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
    <g class="fh-brazo" style="transform-origin:190px 548px">
      <g transform="rotate(16 100 504)" stroke="#cfae72" stroke-width="2.2">
        <rect x="-50" y="436" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="466" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="496" width="280" height="28" rx="3" fill="url(#fhMadera)"/><rect x="-50" y="526" width="280" height="28" rx="3" fill="url(#fhMadera)"/>
        <g stroke="#e0c488" stroke-width="2.4"><path d="M40 460 v10 M120 460 v10 M60 490 v10 M150 490 v10 M30 520 v10 M110 520 v10"/></g>
      </g>
      <g fill="none" stroke="#7d7066" stroke-width="3.5"><ellipse cx="198" cy="478" rx="8" ry="5" transform="rotate(30 198 478)"/><ellipse cx="206" cy="494" rx="3" ry="8" transform="rotate(20 206 494)"/><ellipse cx="212" cy="510" rx="8" ry="5" transform="rotate(10 212 510)"/><ellipse cx="215" cy="526" rx="3" ry="8"/><ellipse cx="214" cy="542" rx="8" ry="5" transform="rotate(-10 214 542)"/></g>
      <path d="M214 526 Q230 484 292 480 L402 488 Q446 494 436 524 Q424 552 380 560 L300 562 Q240 562 214 526Z" fill="url(#fhMano)" stroke="#2a221d" stroke-width="3"/>
      <g fill="none" stroke="#3d342d" stroke-width="2.6" opacity=".7" stroke-linecap="round"><path d="M296 494 Q340 504 384 498"/><path d="M288 514 Q340 524 404 516"/><path d="M296 536 Q340 546 396 540"/></g>
      <g class="fh-mazo">
        <path d="M376 508 L406 524 L496 444 L468 420Z" fill="url(#fhMazo)" stroke="#8a7842" stroke-width="2.5"/>
        <g stroke="#9c8a52" stroke-width="1.6" opacity=".7" fill="none"><path d="M390 512 L476 434 M398 518 L486 442"/></g>
        <path d="M452 404 L548 372 L606 434 L522 480Z" fill="url(#fhMazo)" stroke="#8a7842" stroke-width="3" stroke-linejoin="round"/>
        <path d="M452 404 L430 372 L470 388 L548 372Z" fill="#e6d79e" stroke="#8a7842" stroke-width="2.5" stroke-linejoin="round"/>
        <g stroke="#9c8a52" stroke-width="1.8" opacity=".65" fill="none"><path d="M470 412 L574 386 M486 430 L588 410 M500 448 L580 430 M466 396 L540 380"/></g>
        <rect x="456" y="406" width="20" height="56" fill="#5a4a2a" transform="rotate(-31 466 434)" opacity=".5"/>
      </g>
      <g fill="url(#fhMano)" stroke="#2a221d" stroke-width="2.5"><ellipse cx="402" cy="500" rx="25" ry="10" transform="rotate(-34 402 500)"/><ellipse cx="414" cy="516" rx="26" ry="10.5" transform="rotate(-34 414 516)"/><ellipse cx="424" cy="531" rx="23" ry="10" transform="rotate(-34 424 531)"/></g>
      <g fill="none" stroke="#e0d5c0" stroke-width="2" opacity=".5" stroke-linecap="round"><path d="M386 494 q12 -8 24 -6"/><path d="M398 510 q12 -8 26 -6"/><path d="M408 525 q12 -8 24 -6"/></g>
      <ellipse cx="368" cy="494" rx="34" ry="13" transform="rotate(-24 368 494)" fill="#bdb1a1" stroke="#2a221d" stroke-width="2.5"/><ellipse cx="392" cy="486" rx="8" ry="5" transform="rotate(-24 392 486)" fill="#dcd2c2"/>
    </g>
    <path d="M10 560 L28 404 Q50 332 130 308" fill="none" stroke="#000" stroke-width="2" opacity=".4"/>
    <path d="M620 420 Q600 330 530 306 L432 294" fill="none" stroke="#ff8a2a" stroke-width="4" opacity=".4" class="fh-luz-borde"/>
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
