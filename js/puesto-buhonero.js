/* El Buhonero de Intercambios (pestaña Buhonero de intercambios.html): un mercader encapuchado junto a su carreta, bajo unos faroles, en un callejón de noche.
   Es solo escena y voz: dibuja el SVG, hace que sus ojos sigan al cursor, le da frases (con efecto de máquina de escribir) y enciende tantas velas como
   tratos le quedan a quien lo visita hoy. Lo que se vende y lo que se cobra lo decide el servidor (js/intercambios.js).
   Sus frases las puede cambiar el Admin (js/dialogos-personajes.js, pestaña Diálogos).
   También atiende en las Cartas del Hipódromo (js/hipodromo-cartas.js), donde paga y cobra en tokens en lugar de cambiar cartas por cartas: allí no hay velas
   (montar con { velas: false }) y usa los grupos hip*.
   API: PuestoBuhonero.montar(contenedor, { velas }), .decir(clave), .velas(hoy, tope). */
window.PuestoBuhonero = (function () {
  const FRASES = {
    saludo: ["Acércate. La luz de los faroles no dura toda la noche.", "Otro que viene a cambiar lo que no sabe que perdió.", "No pregunto de dónde vienes. Tú no preguntes de dónde saqué esto.", "Mira con calma. Todo lo que ves tiene dueño, y ese dueño soy yo."],
    vacio: ["Mi carreta duerme hoy. Vuelve cuando cambie la luna.", "Esta noche no hay nada que enseñarte. Las sombras se llevaron el resto."],
    agotado: ["Por hoy basta. Las velas ya no dan más.", "Tus tres tratos de hoy están hechos. Mañana seguimos."],
    comun: ["Humilde. Pero toda historia empieza en algún sitio.", "Pasa por común y rinde como cualquiera."],
    infrecuente: ["Poco común, dicen. Yo la llamo difícil de encontrar.", "Esa la guardé para alguien con buen ojo."],
    rara: ["Esa pesa más de lo que parece.", "La rara casi nunca se queda mucho en mi carreta."],
    legendaria: ["Esa no es para cualquiera. Ni yo sé cómo llegó a mis manos."],
    limitada: ["Pocas copias existen. No me preguntes cómo llegó una a mi mesa."],
    especial: ["A esa no se la enseño a cualquiera.", "La traje esta noche solo para ti."],
    tarda: ["Piénsalo. A mí no me corre prisa.", "Yo no me muevo de aquí."],
    exito: ["Trato hecho. No olvides quién te lo ofreció.", "Un placer. Y un consejo. No mires atrás.", "Buena elección. Que nadie te vea con ella hasta que salgas de aquí."],
    error: ["Eso no cuadra. Yo no hago favores.", "No. Así no se negocia."],
    sinSesion: ["Sin nombre no hay trato. Inicia sesión."],
    // en el Hipódromo
    hipSaludo: ["Aquí los faroles son de colores y las monedas, de juego. Tráeme cartas o llévate las mías.", "Los que apuestan acaban buscándome tarde o temprano. Mira lo que tengo, o enséñame lo que traes.", "Tokens por cartas y cartas por tokens. Aquí no se regatea."],
    hipReservaVacia: ["Mi carreta va vacía. Nadie me ha traído nada.", "No tengo nada que enseñarte. Véndeme algo y vuelve."],
    hipSinCartas: ["No traes nada. Vuelve cuando tengas cartas.", "Con las manos vacías no hay trato."],
    hipRecibe: ["Dámela. Aquí tienes tus tokens, cuéntalos si quieres.", "La guardo con las demás. Alguien vendrá a buscarla.", "Hecho. Que el hipódromo te sea ligero."],
    hipOfrece: ["Es tuya. A mí ya no me vuelve.", "Cuídala. Otros la tuvieron antes que tú.", "Trato hecho. Los tokens bien gastados no se echan de menos."],
    hipSinTokens: ["Con eso no te alcanza. Apuesta mejor o véndeme algo.", "Te faltan tokens. Yo no fío."],
    hipLleno: ["Ya llevas todas las que puedes llevar. No insistas.", "No cabe una más en tus manos. Esa se queda aquí."]
  };
  /* Cuándo dice cada grupo (lo enseña el editor de Admin, js/admin-dialogos.js) */
  const CUANDO = {
    saludo: "Al abrir la pestaña del Buhonero, si tiene ofertas", vacio: "Al abrir la pestaña si no tiene nada que ofrecer", agotado: "Al abrir la pestaña cuando ya hiciste tus 3 tratos de hoy",
    comun: "Al pasar el cursor sobre una carta común", infrecuente: "Al pasar el cursor sobre una carta poco común", rara: "Al pasar el cursor sobre una carta rara",
    legendaria: "Al pasar el cursor sobre una carta legendaria", limitada: "Al pasar el cursor sobre una carta limitada", especial: "Al pasar el cursor sobre una oferta especial",
    tarda: "Mientras eliges qué entregar", exito: "Al cerrar un trato", error: "Si algo falla en un trato", sinSesion: "Sin sesión iniciada (todavía no se usa)",
    hipSaludo: "Hipódromo, pestaña Cartas: al abrirla, si hay cartas en su carreta", hipReservaVacia: "Hipódromo, pestaña Cartas: al abrirla, si su carreta está vacía",
    hipSinCartas: "Hipódromo, pestaña Cartas: al abrirla, si no tienes ninguna carta", hipRecibe: "Hipódromo: cuando le vendes una carta y te paga",
    hipOfrece: "Hipódromo: cuando le compras una carta", hipSinTokens: "Hipódromo: al pasar el cursor sobre «Comprar» sin tokens suficientes",
    hipLleno: "Hipódromo: al pasar el cursor sobre «Comprar» una carta de la que ya tienes todas las que puedes tener"
  };
  const ORIGINALES = JSON.parse(JSON.stringify(FRASES));
  if (window.DialogosPersonajes) { DialogosPersonajes.aplicar("buhonero", FRASES); DialogosPersonajes.refrescar("buhonero", FRASES); }
  const al = lista => lista[Math.floor(Math.random() * lista.length)];

  const ESCENA = `
<svg class="pb-svg" viewBox="0 0 960 360" preserveAspectRatio="xMidYMid slice" role="img" aria-label="El Buhonero, una figura encapuchada junto a su carreta, bajo faroles en un callejón de noche">
  <defs>
    <linearGradient id="pbCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030807"/><stop offset=".65" stop-color="#0a2420"/><stop offset="1" stop-color="#123a31"/></linearGradient>
    <radialGradient id="pbLuz"><stop offset="0" stop-color="#ffb04a" stop-opacity=".9"/><stop offset=".4" stop-color="#ff7a3a" stop-opacity=".28"/><stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="pbOrbe"><stop offset="0" stop-color="#c8fff3"/><stop offset=".45" stop-color="#36d1a5" stop-opacity=".75"/><stop offset="1" stop-color="#36d1a5" stop-opacity="0"/></radialGradient>
    <radialGradient id="pbNiebla"><stop offset="0" stop-color="#bfe8da" stop-opacity=".16"/><stop offset="1" stop-color="#bfe8da" stop-opacity="0"/></radialGradient>
    <linearGradient id="pbSuelo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2822"/><stop offset="1" stop-color="#050e0c"/></linearGradient>
    <pattern id="pbAdoquin" width="46" height="22" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="20" height="9" rx="3" fill="#143730"/><rect x="25" y="1" width="20" height="9" rx="3" fill="#102e28"/><rect x="12" y="12" width="20" height="9" rx="3" fill="#123229"/><rect x="36" y="12" width="9" height="9" rx="3" fill="#143730"/><rect x="1" y="12" width="8" height="9" rx="3" fill="#102e28"/></pattern>
  </defs>

  <rect width="960" height="360" fill="url(#pbCielo)"/>
  <g class="pb-estrellas" fill="#e9f3dc"><circle cx="70" cy="40" r="1.4"/><circle cx="150" cy="78" r="1"/><circle cx="260" cy="30" r="1.3"/><circle cx="340" cy="64" r="1"/><circle cx="420" cy="22" r="1.4"/><circle cx="560" cy="48" r="1"/><circle cx="640" cy="26" r="1.3"/><circle cx="720" cy="70" r="1"/><circle cx="900" cy="110" r="1.2"/><circle cx="610" cy="96" r="0.9"/></g>
  <circle cx="842" cy="62" r="24" fill="#e9f3dc" opacity=".92"/><circle cx="832" cy="55" r="22" fill="#07130f"/>
  <circle cx="842" cy="62" r="60" fill="url(#pbNiebla)"/>

  <!-- tejados lejanos -->
  <path d="M0 258 V150 H44 V118 L74 92 L104 118 V160 H170 V128 H226 V176 H268 V258Z" fill="#06151a"/>
  <path d="M680 258 V176 H724 V136 L760 104 L796 136 V150 H850 V122 L884 96 L918 122 V160 H960 V258Z" fill="#06151a"/>
  <g fill="#ffb04a"><rect x="78" y="130" width="10" height="14" class="pb-vent" opacity=".55"/><rect x="190" y="146" width="9" height="12" opacity=".35"/><rect x="745" y="150" width="10" height="14" class="pb-vent" opacity=".5"/><rect x="872" y="136" width="9" height="12" opacity=".35"/></g>

  <!-- suelo de adoquines con luz de farol reflejada -->
  <rect y="256" width="960" height="104" fill="url(#pbSuelo)"/>
  <rect y="256" width="960" height="104" fill="url(#pbAdoquin)" opacity=".55"/>
  <ellipse cx="480" cy="316" rx="260" ry="26" fill="url(#pbLuz)" opacity=".4"/>

  <!-- niebla baja -->
  <g class="pb-niebla"><ellipse cx="200" cy="276" rx="260" ry="26" fill="url(#pbNiebla)"/><ellipse cx="720" cy="292" rx="300" ry="30" fill="url(#pbNiebla)"/></g>

  <!-- cuerda de faroles -->
  <path d="M0 36 Q240 78 480 40 T960 34" fill="none" stroke="#2a1a10" stroke-width="3"/>
  ${[[150, 58], [480, 44], [800, 52]].map(([x, y], i) => `
  <g class="pb-farol" style="transform-origin:${x}px ${y}px;animation-delay:${-i * 1.3}s">
    <circle cx="${x}" cy="${y + 34}" r="74" fill="url(#pbLuz)" class="pb-parpadeo" style="animation-delay:${-i * .7}s"/>
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 14}" stroke="#2a1a10" stroke-width="2"/>
    <path d="M${x - 11} ${y + 14} h22 l-3 -7 h-16z" fill="#3a2414"/>
    <rect x="${x - 11}" y="${y + 14}" width="22" height="34" rx="4" fill="#ff7a3a"/><rect x="${x - 6}" y="${y + 19}" width="12" height="24" rx="3" fill="#ffd48a"/>
    <path d="M${x - 12} ${y + 48} h24 l-3 6 h-18z" fill="#3a2414"/>
  </g>`).join("")}

  <!-- la carreta -->
  <g class="pb-carreta">
    <path d="M588 270 H900 L886 316 H604Z" fill="#3b2616"/>
    <path d="M588 270 H900 V282 H588Z" fill="#573720"/>
    <g stroke="#22140a" stroke-width="2" opacity=".7"><line x1="640" y1="282" x2="634" y2="314"/><line x1="700" y1="282" x2="698" y2="316"/><line x1="760" y1="282" x2="760" y2="316"/><line x1="820" y1="282" x2="824" y2="316"/><line x1="870" y1="282" x2="876" y2="314"/></g>
    <g class="pb-rueda"><circle cx="680" cy="316" r="40" fill="none" stroke="#4a2f1c" stroke-width="8"/><circle cx="680" cy="316" r="6" fill="#2a1a10"/><g stroke="#4a2f1c" stroke-width="4"><line x1="680" y1="278" x2="680" y2="354"/><line x1="642" y1="316" x2="718" y2="316"/><line x1="653" y1="289" x2="707" y2="343"/><line x1="707" y1="289" x2="653" y2="343"/></g></g>
    <path d="M598 268 Q744 120 890 268 Q868 250 846 268 Q824 250 802 268 Q780 250 758 268 Q736 250 714 268 Q692 250 670 268 Q648 250 626 268 Q612 254 598 268Z" fill="#7a2230"/>
    <path d="M744 124 L706 268 H730 L744 124 L760 268 H784 Z" fill="#a33445" opacity=".75"/><path d="M744 124 L650 268 H676 L744 124Z" fill="#a33445" opacity=".45"/><path d="M744 124 L838 268 H812 L744 124Z" fill="#a33445" opacity=".45"/>
    <g stroke="#5a3a22" stroke-width="2"><line x1="626" y1="262" x2="626" y2="296"/><line x1="664" y1="262" x2="664" y2="288"/><line x1="842" y1="262" x2="842" y2="300"/></g>
    <circle cx="626" cy="300" r="6" fill="#36d1a5"/><circle cx="664" cy="292" r="5" fill="#ffb04a"/><path d="M838 300 l4 -10 l4 10z" fill="#e9f3dc"/>
    <!-- frascos sobre el cajón -->
    <rect x="726" y="248" width="14" height="24" rx="4" fill="#36d1a5" opacity=".85"/><rect x="730" y="240" width="6" height="9" fill="#5a3a22"/>
    <rect x="750" y="254" width="16" height="18" rx="5" fill="#9a5ad8" opacity=".85"/><rect x="755" y="247" width="6" height="8" fill="#5a3a22"/>
    <circle cx="790" cy="262" r="10" fill="#e9dfc1"/><rect x="784" y="262" width="12" height="9" rx="2" fill="#e9dfc1"/><circle cx="786" cy="262" r="2.4" fill="#06110f"/><circle cx="794" cy="262" r="2.4" fill="#06110f"/>
    <!-- cuervo -->
    <g class="pb-cuervo" style="transform-origin:872px 246px"><ellipse cx="872" cy="252" rx="13" ry="8" fill="#050a0a"/><circle cx="884" cy="246" r="6" fill="#050a0a"/><path d="M889 245 l9 2 l-9 3z" fill="#7a6a4a"/><circle cx="886" cy="245" r="1.4" fill="#ffc766"/><path d="M860 254 l-14 6 l16 -2z" fill="#050a0a"/></g>
  </g>

  <!-- mesa con el orbe -->
  <g class="pb-mesa">
    <circle cx="316" cy="236" r="46" fill="url(#pbOrbe)" class="pb-orbe"/>
    <circle cx="316" cy="246" r="14" fill="#9ff0d8" opacity=".85" class="pb-orbe"/><path d="M304 260 h24 l4 8 h-32z" fill="#5a3a22"/>
    <rect x="250" y="268" width="136" height="12" rx="2" fill="#3b2616"/><rect x="250" y="268" width="136" height="3" fill="#573720"/>
    <rect x="262" y="280" width="9" height="40" fill="#2a1a10"/><rect x="365" y="280" width="9" height="40" fill="#2a1a10"/>
    <rect x="256" y="250" width="26" height="18" fill="#e9dfc1" transform="rotate(-6 269 259)"/><rect x="350" y="254" width="22" height="14" fill="#b8ad8e" transform="rotate(8 361 261)"/>
  </g>

  <!-- el Buhonero -->
  <g class="pb-buhonero">
    <path d="M470 98 C438 98 420 130 422 162 C423 182 412 214 404 266 L392 314 Q470 330 548 314 L536 266 C528 214 517 182 518 162 C520 130 502 98 470 98Z" fill="#0b1c18" stroke="#1d3d35" stroke-width="3"/>
    <path d="M470 98 C446 102 432 128 432 160" fill="none" stroke="#2e6a5a" stroke-width="2.5" opacity=".7"/>
    <path d="M452 178 Q470 190 488 178 L500 270 L470 280 L440 270Z" fill="#081410" opacity=".7"/>
    <path d="M430 196 L506 300" stroke="#5a3a22" stroke-width="6" opacity=".9"/><rect x="496" y="278" width="30" height="28" rx="5" fill="#4a2f1c" stroke="#2a1a10" stroke-width="2"/>
    <path d="M404 272 L396 312 M536 272 L544 312" stroke="#1d3d35" stroke-width="2" fill="none"/>
    <ellipse cx="470" cy="150" rx="19" ry="25" fill="#010504"/>
    <g class="pb-ojos"><g class="pb-parpadeo-ojos"><ellipse cx="462" cy="148" rx="3.4" ry="2.2" fill="#ffc766"/><ellipse cx="478" cy="148" rx="3.4" ry="2.2" fill="#ffc766"/></g><ellipse cx="462" cy="148" rx="9" ry="6" fill="#ffb04a" opacity=".22"/><ellipse cx="478" cy="148" rx="9" ry="6" fill="#ffb04a" opacity=".22"/></g>
    <!-- brazo izquierdo: manga ancha y palma abierta bajo una carta que flota -->
    <path d="M440 170 Q412 186 398 222 L420 234 Q430 206 454 190Z" fill="#0f2621" stroke="#1d3d35" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="404" cy="236" rx="15" ry="9" fill="#173229" stroke="#1d3d35" stroke-width="2.4" transform="rotate(-20 404 236)"/>
    <g fill="#173229" stroke="#1d3d35" stroke-width="1.8"><ellipse cx="391" cy="230" rx="7" ry="3.2" transform="rotate(-55 391 230)"/><ellipse cx="397" cy="225" rx="7" ry="3.2" transform="rotate(-35 397 225)"/><ellipse cx="406" cy="223" rx="7" ry="3.2" transform="rotate(-12 406 223)"/></g>
    <g class="pb-carta-flota"><rect x="388" y="188" width="26" height="38" rx="3" fill="#e9dfc1" stroke="#ffb04a" stroke-width="2" transform="rotate(-12 401 207)"/><circle cx="401" cy="207" r="6" fill="#7a2230" transform="rotate(-12 401 207)"/><circle cx="401" cy="207" r="34" fill="url(#pbLuz)" opacity=".45"/></g>
    <!-- bastón con farolillo -->
    <line x1="548" y1="124" x2="548" y2="318" stroke="#4a2f1c" stroke-width="5"/><path d="M548 124 q14 -6 20 6" fill="none" stroke="#4a2f1c" stroke-width="5"/>
    <g class="pb-farol" style="transform-origin:568px 130px"><line x1="568" y1="130" x2="568" y2="142" stroke="#2a1a10" stroke-width="2"/><rect x="558" y="142" width="20" height="26" rx="4" fill="#ff7a3a"/><rect x="563" y="147" width="10" height="16" rx="3" fill="#ffd48a"/><circle cx="568" cy="156" r="40" fill="url(#pbLuz)" class="pb-parpadeo"/></g>
    <!-- brazo derecho: la misma manga, con el puño cerrado sobre el bastón -->
    <path d="M500 170 Q528 186 542 222 L520 234 Q510 206 486 190Z" fill="#0f2621" stroke="#1d3d35" stroke-width="3" stroke-linejoin="round"/>
    <rect x="534" y="219" width="28" height="26" rx="10" fill="#173229" stroke="#1d3d35" stroke-width="2.4" transform="rotate(8 548 232)"/>
    <g stroke="#0b1c18" stroke-width="1.8" opacity=".75" stroke-linecap="round"><path d="M538 227 h20"/><path d="M538 233 h20"/><path d="M538 239 h18"/></g>
  </g>
  <rect y="330" width="960" height="30" fill="#050e0c" opacity=".55"/>
</svg>`;

  let caja = null, ojos = null, timer = null, ultima = "";

  function montar(contenedor, opc) {
    caja = contenedor;
    const conVelas = !opc || opc.velas !== false;
    caja.innerHTML = `${ESCENA}
      <div class="pb-burbuja" role="status" aria-live="polite"><span class="pb-quien">El Buhonero</span><p class="pb-texto"></p></div>${conVelas ? `
      <div class="pb-velas" aria-label="Tratos que te quedan hoy"><span class="pb-velas-etq">Tus tratos de hoy</span><span class="pb-velas-fila"></span></div>` : ""}`;
    ojos = caja.querySelector(".pb-ojos");
    const svg = caja.querySelector(".pb-svg"), estrecha = matchMedia("(max-width: 900px)");
    const ajustar = () => svg.setAttribute("preserveAspectRatio", estrecha.matches ? "xMidYMid meet" : "xMidYMid slice");
    ajustar();
    if (estrecha.addEventListener) estrecha.addEventListener("change", ajustar);
    caja.addEventListener("mousemove", ev => {
      if (!ojos) return;
      const r = caja.getBoundingClientRect();
      const dx = ((ev.clientX - r.left) / r.width - 0.49) * 7, dy = ((ev.clientY - r.top) / r.height - 0.42) * 4;
      ojos.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });
    caja.addEventListener("mouseleave", () => { if (ojos) ojos.style.transform = ""; });
  }

  /* Dice una frase del grupo (clave) o un texto suelto si la clave no existe. Con movimiento reducido sale entera de golpe */
  function decir(clave) {
    if (!caja) return;
    const lista = FRASES[clave];
    let texto = lista ? al(lista) : String(clave || "");
    if (lista && lista.length > 1 && texto === ultima) texto = al(lista);
    ultima = texto;
    const p = caja.querySelector(".pb-texto");
    clearInterval(timer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { p.textContent = texto; return; }
    p.textContent = "";
    let i = 0;
    timer = setInterval(() => { p.textContent = texto.slice(0, ++i); if (i >= texto.length) clearInterval(timer); }, 26);
  }

  function velas(hoy, tope) {
    if (!caja || !caja.querySelector(".pb-velas")) return;
    const quedan = Math.max(0, tope - hoy);
    caja.querySelector(".pb-velas-fila").innerHTML = Array.from({ length: tope }, (_, i) => `<i class="pb-vela${i < quedan ? " pb-vela-viva" : ""}"><b></b></i>`).join("");
    caja.querySelector(".pb-velas").setAttribute("aria-label", `Te quedan ${quedan} de ${tope} tratos hoy`);
  }

  return { montar, decir, velas, FRASES, ORIGINALES, CUANDO };
})();
