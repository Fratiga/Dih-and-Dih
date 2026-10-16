/* =============================================================================
   LAS SALAS DE LA TABERNA
   El lobby (index.html) es la sala principal. Desde ella se entra a otras salas que viven en la misma página, cada una con los enlaces de
   su grupo, para que desde la taberna se llegue a TODAS las páginas del sitio sin que el salón principal se llene:
     Biblioteca       el compendio por estantes (Mundo, Archivo, Reglas y cifras)
     Sala recreativa  los juegos uno por uno y las cartas (el Hipódromo no está aquí: tiene su propio sitio)
     Establos         el Hipódromo, el Hipódromo en vivo y los corrales
     Despacho         solo admin: el panel y los editores de mapas de ritmo
   Mi habitación y el Intercambios son puertas de la taberna que llevan a su propia página.

   MAPA es la lista de enlaces del lobby y la única fuente: de ella salen las salas dibujadas y la lista «Todas las puertas».
   docs/pruebas-web/enlaces_lobby.js comprueba que no falte ninguna página del sitio. Quedan fuera, a propósito, las páginas secretas
   (secreto, muerte-subita, encuentro-verdam) y el propio index.
   Navegación: la sala va en el hash de la URL (#biblioteca, #juegos, #establos, #despacho); sin hash se ve la taberna.
============================================================================= */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const esAdmin = () => typeof window.esAdmin === "function" ? !!window.esAdmin() : false;

  /* ---------------------------------------------------------------- el mapa: todos los enlaces */
  // [href, nombre, arte, solo admin]
  const MAPA = {
    taberna: {
      nombre: "Taberna", grupos: [{ titulo: "Taberna", enlaces: [
        ["compendio.html", "El Compendio"], ["mapa.html", "Mapa"], ["rocola.html", "Rocola"], ["fanarts.html", "Fanarts"], ["peticiones.html", "Tablón (peticiones)"],
        ["fichas.html", "Mis personajes"], ["minijuegos.html", "Salón de juegos (Minijuegos)"], ["cartas.html", "Triunfos"], ["intercambios.html", "Intercambios"], ["habitacion.html", "Mi habitación"]] }]
    },
    biblioteca: {
      nombre: "Biblioteca", lema: "Todo lo que se sabe del mundo, estante por estante.", grupos: [
        { titulo: "Mundo", enlaces: [["cronologia.html", "Cronología", "libros"], ["lugares.html", "Lugares", "libros"], ["facciones.html", "Facciones", "libros"], ["personajes.html", "Personajes", "libros"], ["razas.html", "Razas", "libros"], ["religion.html", "Religión", "libros"]] },
        { titulo: "Archivo", enlaces: [["textos.html", "Textos", "libros"], ["pergaminos.html", "Pergaminos", "libros"], ["armas.html", "Armas", "libros"], ["objetos.html", "Objetos", "libros"], ["bestiario.html", "Bestiario", "libros"]] },
        { titulo: "Reglas y cifras", enlaces: [["reglas.html", "Reglas", "libros"], ["economia.html", "Economía", "libros"], ["estadisticas.html", "Estadísticas", "libros"]] }]
    },
    juegos: {
      nombre: "Sala recreativa", lema: "Cada juego en su máquina. Minijuegos los junta todos.", grupos: [
        { titulo: "Juegos", enlaces: [["ajedrez.html", "Ajedrez", "ajedrez"], ["arqueria.html", "Arquería", "diana"], ["ritmo.html", "Zarabanda", "arcade-ritmo"], ["parranda.html", "Parranda", "arcade-parranda"], ["sacrificio.html", "Hooey", "arcade-hooey"],
          ["duelo.html", "Duelo", "espadas", true], ["ostelar.html", "Ostelar", "trampilla", true], ["fractura.html", "La Fractura", "arcade-fractura", true]] },
        { titulo: "Triunfos", enlaces: [["cartas.html", "Álbum", "cartas"], ["mazos.html", "Mazos", "cartas"], ["batalla.html", "Batalla", "cartas"]] }]
    },
    establos: {
      nombre: "Establos", lema: "Carreras de criaturas y los corrales donde se crían.", grupos: [
        { titulo: "Establos", enlaces: [["hipodromo.html", "Hipódromo", "gradas"], ["hipodromo-vivo.html", "Hipódromo en vivo", "pantalla"], ["corrales.html", "Corrales", "cerca"]] }]
    },
    despacho: {
      nombre: "Despacho", lema: "Solo para el admin.", admin: true, grupos: [
        { titulo: "Despacho", enlaces: [["admin.html", "Panel de Admin", "escritorio", true], ["ritmo-editor.html", "Editor de Zarabanda", "arcade-ritmo", true], ["parranda-editor.html", "Editor de Parranda", "arcade-parranda", true]] }]
    }
  };
  const ORDEN = ["taberna", "biblioteca", "juegos", "establos", "despacho"];
  const visible = e => !e[3] || esAdmin();

  /* ---------------------------------------------------------------- arte (cada pieza cabe en 160 x 130) */
  const COLORES = ["#b6453f", "#4f7fb5", "#e8b84a", "#4c8a4f", "#8a5fc2", "#c9703a", "#2f8a8a", "#a8546a"];
  const semilla = t => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 997; return h; };
  function libros(titulo) {
    const sem = semilla(titulo);
    let s = `<rect width="160" height="130" fill="#4a3220"/><rect x="8" y="8" width="144" height="114" fill="#241810"/>`;
    for (let fila = 0; fila < 3; fila++) {
      const y0 = 10 + fila * 38;
      let x = 12, i = 0;
      while (x < 146) {
        const w = 6 + ((sem + i * 7) % 6), h = 22 + ((sem * 3 + i * 5) % 13), col = COLORES[(sem + i * 3 + fila) % COLORES.length];
        s += `<rect x="${x}" y="${y0 + 34 - h}" width="${w}" height="${h}" fill="${col}"/>`;
        x += w + 1; i++;
      }
      s += `<rect x="8" y="${y0 + 34}" width="144" height="4" fill="#6a4a30"/>`;
    }
    return s;
  }
  const PANTALLAS = {
    ritmo: `<rect x="8" y="8" width="8" height="26" class="lb-neon lb-n1"/><rect x="22" y="16" width="8" height="18" class="lb-neon lb-n2"/><rect x="36" y="6" width="8" height="28" class="lb-neon lb-n3"/><rect x="50" y="20" width="8" height="14" class="lb-neon lb-n1"/>`,
    parranda: `<rect x="6" y="4" width="2" height="34" fill="#ffffff44"/><rect x="20" y="4" width="2" height="34" fill="#ffffff44"/><rect x="34" y="4" width="2" height="34" fill="#ffffff44"/><rect x="48" y="4" width="2" height="34" fill="#ffffff44"/><rect x="62" y="4" width="2" height="34" fill="#ffffff44"/>
      <rect x="8" y="10" width="10" height="6" fill="#ff7ac0"/><rect x="22" y="20" width="10" height="6" fill="#5fe0d2"/><rect x="36" y="6" width="10" height="6" fill="#ffd84a"/><rect x="50" y="26" width="10" height="6" fill="#ff7ac0"/>`,
    hooey: `<rect x="22" y="20" width="24" height="14" fill="#e8872a"/><rect x="26" y="12" width="16" height="12" fill="#f0b038" class="lb-llama"/><rect x="30" y="6" width="8" height="10" fill="#f7dd6a" class="lb-llama lb-l2"/><rect x="50" y="26" width="8" height="8" fill="#f2ead2"/>`,
    fractura: `<rect x="8" y="6" width="14" height="14" fill="#8d6a45"/><rect x="26" y="6" width="14" height="14" fill="#5a3f27"/><rect x="44" y="6" width="14" height="14" fill="#8d6a45"/><rect x="8" y="24" width="14" height="14" fill="#5a3f27"/><rect x="26" y="24" width="14" height="14" fill="#b6453f"/><rect x="44" y="24" width="14" height="14" fill="#5a3f27"/>`
  };
  const CAB = { ritmo: "#2a5a8a", parranda: "#8a2f5a", hooey: "#8a3a22", fractura: "#4a4066" };
  function arcade(tipo) {
    return `<g transform="translate(36 4)"><rect width="88" height="124" fill="${CAB[tipo]}"/><rect width="88" height="6" fill="#ffffff2a"/>
      <rect x="6" y="10" width="76" height="16" fill="#e8b84a"/><rect x="10" y="14" width="68" height="8" fill="#1c1422"/>
      <rect x="14" y="16" width="8" height="4" fill="#e8b84a"/><rect x="28" y="16" width="8" height="4" fill="#ff7ac0"/><rect x="42" y="16" width="8" height="4" fill="#5fe0d2"/><rect x="56" y="16" width="8" height="4" fill="#e8b84a"/>
      <rect x="8" y="32" width="72" height="46" fill="#0c1a2a"/><g transform="translate(9 34)">${PANTALLAS[tipo]}</g>
      <rect x="4" y="84" width="80" height="14" fill="#1c1c3a"/><rect x="12" y="88" width="8" height="6" fill="#b6453f"/><rect x="26" y="88" width="8" height="6" fill="#e8b84a"/><rect x="62" y="86" width="14" height="10" fill="#4f7fb5"/>
      <rect x="30" y="104" width="28" height="12" fill="#0c1220"/></g>`;
  }
  const ARTE = {
    libros,
    "arcade-ritmo": () => arcade("ritmo"), "arcade-parranda": () => arcade("parranda"), "arcade-hooey": () => arcade("hooey"), "arcade-fractura": () => arcade("fractura"),
    ajedrez: () => `<g transform="translate(-216 -366)"><rect x="224" y="424" width="144" height="16" fill="#8d6a45"/><rect x="232" y="440" width="16" height="48" fill="#6b4a2f"/><rect x="344" y="440" width="16" height="48" fill="#6b4a2f"/>
      <rect x="248" y="396" width="96" height="32" fill="url(#pTableroSala)"/><rect x="248" y="392" width="96" height="4" fill="#3a2a1d"/>
      <rect x="260" y="378" width="8" height="18" fill="#f2ead2"/><rect x="258" y="374" width="12" height="6" fill="#f2ead2"/><rect x="300" y="382" width="8" height="14" fill="#f2ead2"/>
      <rect x="318" y="376" width="8" height="20" fill="#2a2030"/><rect x="316" y="372" width="12" height="6" fill="#2a2030"/><rect x="282" y="386" width="8" height="10" fill="#2a2030"/></g>`,
    diana: () => `<rect x="70" y="86" width="8" height="42" fill="#6b4a2f"/><rect x="84" y="86" width="8" height="42" fill="#6b4a2f"/><rect x="58" y="120" width="44" height="6" fill="#6b4a2f"/>
      <circle cx="80" cy="52" r="46" fill="#e9dcc0"/><circle cx="80" cy="52" r="34" fill="#b6453f"/><circle cx="80" cy="52" r="22" fill="#e9dcc0"/><circle cx="80" cy="52" r="10" fill="#b6453f"/>
      <rect x="82" y="46" width="44" height="4" fill="#8d6a45"/><rect x="120" y="42" width="10" height="14" fill="#c9cdd6"/>`,
    espadas: () => `<g transform="translate(-34 -22)"><rect x="84" y="36" width="48" height="56" fill="#8d6a45"/><rect x="88" y="40" width="40" height="48" fill="#3b4a8a"/><rect x="88" y="40" width="20" height="24" fill="#b6453f"/><rect x="108" y="64" width="20" height="24" fill="#b6453f"/>
      <polygon points="52,36 60,32 156,92 148,100" fill="#c9cdd6"/><polygon points="164,36 156,32 60,92 68,100" fill="#aeb3bf"/>
      <rect x="48" y="86" width="24" height="8" fill="#e8b84a" transform="rotate(35 60 90)"/><rect x="144" y="86" width="24" height="8" fill="#e8b84a" transform="rotate(-35 156 90)"/></g>`,
    cartas: titulo => {
      const c = ["#5a2438", "#24385a", "#245a38"][semilla(titulo) % 3];
      return `<g transform="translate(-558 -382)"><rect x="552" y="432" width="168" height="16" fill="#8d6a45"/><rect x="560" y="448" width="16" height="44" fill="#6b4a2f"/><rect x="696" y="448" width="16" height="44" fill="#6b4a2f"/>
      <rect x="560" y="404" width="152" height="28" fill="${c}"/><rect x="580" y="388" width="24" height="32" fill="#f2ead2" transform="rotate(-12 592 404)"/><rect x="620" y="392" width="24" height="32" fill="#7a2f4a" transform="rotate(6 632 408)"/>
      <rect x="660" y="390" width="24" height="32" fill="#f2ead2" transform="rotate(14 672 406)"/><rect x="626" y="398" width="8" height="8" fill="#e8b84a" transform="rotate(6 632 408)"/></g>`;
    },
    trampilla: () => `<g transform="translate(-764 -418)"><rect x="776" y="448" width="136" height="64" fill="#2a1d14"/><rect x="784" y="456" width="120" height="48" fill="#120c08"/><rect x="792" y="464" width="104" height="8" fill="#3a2a1d"/><rect x="800" y="476" width="88" height="8" fill="#2c1f15"/>
      <rect x="808" y="488" width="72" height="8" fill="#20160f"/><rect x="836" y="452" width="16" height="8" fill="#8d8d99"/><circle cx="844" cy="452" r="6" fill="none" stroke="#8d8d99" stroke-width="3"/></g>`,
    gradas: () => {
      let s = `<rect width="160" height="12" fill="#b6453f"/>`;
      for (let i = 0; i < 8; i++) s += `<rect x="${i * 20}" y="0" width="10" height="12" fill="#f2ead2"/>`;
      s += `<rect x="4" y="12" width="6" height="30" fill="#6b4a2f"/><rect x="150" y="12" width="6" height="30" fill="#6b4a2f"/>`;
      for (let fila = 0; fila < 4; fila++) {
        s += `<rect x="0" y="${42 + fila * 22}" width="160" height="22" fill="${["#6b4a2f", "#5a3d28", "#4a3220", "#3a2518"][fila]}"/>`;
        for (let k = 0; k < 9; k++) s += `<rect x="${8 + k * 17}" y="${34 + fila * 22}" width="8" height="10" fill="${COLORES[(k * 3 + fila * 5) % COLORES.length]}"/>`;
      }
      return s;
    },
    pantalla: () => `<rect x="8" y="6" width="144" height="86" fill="#1c1422"/><rect x="14" y="12" width="132" height="74" fill="#0c1a2a"/>
      <rect x="14" y="30" width="132" height="2" fill="#ffffff33"/><rect x="14" y="50" width="132" height="2" fill="#ffffff33"/><rect x="14" y="70" width="132" height="2" fill="#ffffff33"/>
      <rect x="40" y="20" width="14" height="8" fill="#e8b84a"/><rect x="66" y="38" width="14" height="8" fill="#5fe0d2"/><rect x="92" y="58" width="14" height="8" fill="#ff7ac0"/><rect x="52" y="76" width="14" height="8" fill="#6fe08a"/>
      <rect x="20" y="16" width="8" height="8" fill="#e04a4a" class="lb-brillo"/><rect x="68" y="92" width="24" height="22" fill="#4a3220"/><rect x="40" y="114" width="80" height="10" fill="#6b4a2f"/>`,
    cerca: () => `<rect y="84" width="160" height="46" fill="#5b8a3a"/><rect y="84" width="160" height="4" fill="#4a7230"/>
      <rect x="0" y="62" width="160" height="6" fill="#8d6a45"/><rect x="0" y="80" width="160" height="6" fill="#8d6a45"/>
      <rect x="6" y="52" width="8" height="48" fill="#6b4a2f"/><rect x="52" y="52" width="8" height="48" fill="#6b4a2f"/><rect x="100" y="52" width="8" height="48" fill="#6b4a2f"/><rect x="146" y="52" width="8" height="48" fill="#6b4a2f"/>
      <rect x="112" y="102" width="38" height="22" fill="#d4b24a"/><rect x="112" y="102" width="38" height="4" fill="#ecd275"/>
      <rect x="22" y="94" width="26" height="12" fill="#f6e7c2"/><rect x="42" y="88" width="10" height="10" fill="#f6e7c2"/><rect x="24" y="106" width="4" height="8" fill="#f6e7c2"/><rect x="40" y="106" width="4" height="8" fill="#f6e7c2"/>
      <rect x="66" y="100" width="22" height="10" fill="#c9b08a"/><rect x="82" y="95" width="8" height="8" fill="#c9b08a"/>`,
    escritorio: () => `<rect x="10" y="74" width="140" height="10" fill="#8d6a45"/><rect x="18" y="84" width="12" height="42" fill="#6b4a2f"/><rect x="130" y="84" width="12" height="42" fill="#6b4a2f"/><rect x="34" y="92" width="92" height="30" fill="#5a3f27"/>
      <rect x="22" y="44" width="48" height="30" fill="#f2ead2"/><rect x="22" y="40" width="48" height="4" fill="#d9c9a0"/><rect x="28" y="50" width="34" height="2" fill="#6b4a2f"/><rect x="28" y="56" width="26" height="2" fill="#6b4a2f"/>
      <rect x="86" y="56" width="44" height="18" fill="#3b4a8a"/><rect x="90" y="60" width="36" height="10" fill="#e8b84a"/>
      <rect x="116" y="30" width="6" height="26" fill="#8d8d99"/><rect x="110" y="20" width="18" height="12" fill="#e8b84a"/><rect x="114" y="22" width="10" height="6" fill="#fff1b0" class="lb-llama"/>`,
    lectura: () => `<rect x="56" y="64" width="48" height="64" fill="#6b4a2f"/><rect x="36" y="52" width="88" height="14" fill="#8d6a45"/>
      <rect x="28" y="14" width="50" height="38" fill="#f2ead2" transform="skewY(-6)"/><rect x="82" y="14" width="50" height="38" fill="#e9dcc0" transform="skewY(6)"/><rect x="78" y="16" width="4" height="40" fill="#8a3d3d"/>
      <rect x="36" y="24" width="34" height="2" fill="#6b4a2f"/><rect x="36" y="30" width="30" height="2" fill="#6b4a2f"/><rect x="36" y="36" width="32" height="2" fill="#6b4a2f"/>
      <rect x="90" y="26" width="34" height="2" fill="#6b4a2f"/><rect x="90" y="32" width="28" height="2" fill="#6b4a2f"/><rect x="90" y="38" width="32" height="2" fill="#6b4a2f"/>`,
    puerta: () => `<rect x="44" y="12" width="72" height="104" fill="#4a2f1f"/><rect x="52" y="20" width="56" height="96" fill="#6b4a2f"/><rect x="58" y="28" width="44" height="40" fill="#5a3d28"/><rect x="58" y="74" width="44" height="36" fill="#5a3d28"/><rect x="98" y="66" width="6" height="6" fill="#e8b84a"/>
      <rect x="62" y="0" width="36" height="10" fill="#3b4a8a"/><rect x="66" y="2" width="28" height="6" fill="#e8b84a"/>`
  };

  /* ---------------------------------------------------------------- fondos de cada sala */
  function fondo(id, tema) {
    const T = {
      biblioteca: { pared: "#2a1d14", raya: "#3a281a", suelo: "#4a2f22", linea: "#35221a", luz: "#e8b84a", pared_h: 545 },
      juegos: { pared: "#1d1736", raya: "#2a2050", suelo: "#241a3a", linea: "#33264f", luz: "#ff7ac0", pared_h: 330 },
      establos: { pared: "#6b5238", raya: "#5a432d", suelo: "#a88a52", linea: "#8f7442", luz: "#fff1b0", pared_h: 470 },
      despacho: { pared: "#243326", raya: "#1c291f", suelo: "#3a2a2a", linea: "#2c2020", luz: "#e8b84a", pared_h: 430 }
    }[tema];
    const H = T.pared_h;
    return `<defs><pattern id="pTableroSala" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e9dcc0"/><rect width="8" height="8" fill="#3a2a1d"/><rect x="8" y="8" width="8" height="8" fill="#3a2a1d"/></pattern>
      <pattern id="${id}P" width="48" height="16" patternUnits="userSpaceOnUse"><rect width="48" height="16" fill="${T.pared}"/><rect width="48" height="2" fill="${T.raya}"/><rect x="16" y="8" width="2" height="8" fill="${T.raya}"/><rect x="40" y="0" width="2" height="8" fill="${T.raya}"/></pattern>
      <pattern id="${id}S" width="64" height="24" patternUnits="userSpaceOnUse"><rect width="64" height="24" fill="${T.suelo}"/><rect width="64" height="2" fill="${T.linea}"/><rect y="12" width="64" height="2" fill="${T.linea}"/><rect x="20" y="2" width="2" height="10" fill="${T.linea}"/><rect x="48" y="14" width="2" height="10" fill="${T.linea}"/></pattern></defs>
      <rect width="1280" height="${H}" fill="url(#${id}P)"/><rect y="${H}" width="1280" height="${700 - H}" fill="url(#${id}S)"/>
      <rect y="${H - 4}" width="1280" height="8" fill="#1c1422"/><rect width="1280" height="24" fill="#1c1422"/><rect y="24" width="1280" height="4" fill="#120d19"/>
      <rect width="16" height="${H}" fill="#1c1422"/><rect x="1264" width="16" height="${H}" fill="#1c1422"/>`;
  }

  /* ---------------------------------------------------------------- piezas */
  function celda(x, y, e, k, w, h) {
    const [href, nombre, arte, admin] = e;
    const f = ARTE[arte];
    const centro = x + (w * k) / 2;
    return `<a class="lb-spot" href="${esc(href)}" aria-label="${esc(nombre)}"${admin ? " data-admin-only" : ""}><g class="lb-forma" transform="translate(${x} ${y}) scale(${k})">${f(nombre)}</g>
      <text x="${centro}" y="${y + h * k + 18}" text-anchor="middle" class="lb-etq lb-etq-fija">${esc(nombre)}</text></a>`;
  }
  function fila(items, y, k, sep) {
    const w = 160 * k, total = items.length * w + (items.length - 1) * sep;
    let x = (1280 - total) / 2;
    return items.map(it => { const s = celda(x, y, it, k, 160, 130); x += w + sep; return s; }).join("");
  }
  function rotulo(texto, x, y, ancho) {
    return `<rect x="${x - ancho / 2}" y="${y - 12}" width="${ancho}" height="22" fill="#7a5233"/><rect x="${x - ancho / 2 + 3}" y="${y - 9}" width="${ancho - 6}" height="16" fill="#9a6a41"/><text x="${x}" y="${y + 3}" text-anchor="middle" class="lb-rotulo">${esc(texto)}</text>`;
  }
  const puertaTaberna = () => `<a class="lb-spot" href="#taberna" aria-label="Volver a la taberna"><g class="lb-forma" transform="translate(-20 560)">${ARTE.puerta()}</g><text x="60" y="694" text-anchor="middle" class="lb-etq lb-etq-fija">TABERNA</text></a>`;

  /* ---------------------------------------------------------------- una sala */
  function dibujar(clave) {
    const s = MAPA[clave];
    const items = g => g.enlaces.filter(visible);
    let cuerpo = "";
    if (clave === "biblioteca") {
      s.grupos.forEach((g, i) => {
        const y0 = 22 + i * 176;
        cuerpo += rotulo(g.titulo.toUpperCase(), 640, y0 + 2, 220) + fila(items(g), y0 + 20, 1, 30);
      });
      cuerpo += `<a class="lb-spot" href="compendio.html" aria-label="El Compendio completo"><g class="lb-forma" transform="translate(520 560) scale(.8)">${ARTE.lectura()}</g><text x="600" y="690" text-anchor="middle" class="lb-etq lb-etq-fija">EL COMPENDIO COMPLETO</text></a>`;
    } else if (clave === "juegos") {
      cuerpo += `<a class="lb-spot" href="minijuegos.html" aria-label="Minijuegos: la página con todos los juegos"><g class="lb-forma"><rect x="360" y="40" width="560" height="78" fill="#2a1d4a"/><rect x="368" y="48" width="544" height="62" fill="#120d2a"/>
        <text x="640" y="92" text-anchor="middle" class="lb-rotulo-grande">MINIJUEGOS</text><rect x="368" y="48" width="544" height="4" class="lb-neon lb-n1"/><rect x="368" y="106" width="544" height="4" class="lb-neon lb-n2"/></g></a>`;
      const juegos = items(s.grupos[0]);
      const arriba = juegos.filter(e => !e[3]), abajo = [...items(s.grupos[1]), ...juegos.filter(e => e[3])];   // arriba los juegos de todos; abajo las cartas y, para el admin, los juegos escondidos
      cuerpo += fila(arriba, 150, 1, 40) + (abajo.length ? fila(abajo, 400, 1, 40) : "");
    } else if (clave === "establos") {
      cuerpo += fila(items(s.grupos[0]), 140, 2, 50);
    } else if (clave === "despacho") {
      cuerpo += fila(items(s.grupos[0]), 150, 1.6, 60);
    }
    return `<svg class="lb-escena lb-sala" data-sala="${clave}" viewBox="0 0 1280 700" shape-rendering="crispEdges" role="group" aria-label="${esc(s.nombre)}: ${esc(s.lema || "")}">${fondo("sala" + clave, clave)}${cuerpo}${puertaTaberna()}</svg>`;
  }

  /* ---------------------------------------------------------------- navegación */
  let actual = "taberna";
  function salaDeHash() {
    const h = decodeURIComponent((location.hash || "").slice(1));
    return MAPA[h] && !(MAPA[h].admin && !esAdmin()) ? h : "taberna";
  }
  function pintarChips() {
    const nav = $("lbSalasNav");
    if (!nav) return;
    nav.innerHTML = ORDEN.filter(c => !MAPA[c].admin || esAdmin()).map(c =>
      `<a class="lb-chip${c === actual ? " lb-chip-actual" : ""}" href="#${c}"${c === actual ? ' aria-current="page"' : ""}>${esc(MAPA[c].nombre)}</a>`).join("");
  }
  function mostrar() {
    const sala = salaDeHash();
    const hall = $("lbEscena"), caja = $("lbSalas");
    if (!hall || !caja) return;
    actual = sala;
    if (sala === "taberna") { caja.hidden = true; caja.innerHTML = ""; hall.classList.remove("lb-oculta"); }
    else { caja.innerHTML = dibujar(sala); caja.hidden = false; hall.classList.add("lb-oculta"); }
    pintarChips();
    const lema = $("lbSalaLema");
    if (lema) lema.textContent = sala === "taberna" ? "" : `${MAPA[sala].nombre}: ${MAPA[sala].lema || ""}`;
  }

  /* ---------------------------------------------------------------- todas las puertas */
  function pintarZonas() {
    const cont = $("lbZonas");
    if (!cont) return;
    const cajas = [];
    ORDEN.forEach(c => {
      const s = MAPA[c];
      if (s.admin && !esAdmin()) return;
      s.grupos.forEach(g => {
        const enlaces = g.enlaces.filter(visible);
        if (!enlaces.length) return;
        const titulo = c === "taberna" || c === g.titulo.toLowerCase() ? s.nombre : `${s.nombre} · ${g.titulo}`;
        cajas.push(`<div class="lb-caja"><h2>${esc(titulo)}</h2><div class="lb-caja-cuerpo lb-lista-links">${enlaces.map(e => `<a href="${esc(e[0])}">${esc(e[1])}</a>`).join("")}</div></div>`);
      });
    });
    cont.innerHTML = cajas.join("");
  }

  /* Los carteles de la taberna (el nombre de cada objeto al pasar el ratón o enfocarlo) se pasan a una capa que se pinta la última:
     así ningún mueble que esté dibujado después los tapa. */
  function capaEtiquetas() {
    const hall = $("lbEscena"), capa = $("lbEtiquetas");
    if (!hall || !capa) return;
    hall.querySelectorAll("a.lb-spot").forEach(a => {
      const t = a.querySelector("text.lb-etq");
      if (!t) return;
      capa.appendChild(t);
      const ver = () => t.classList.add("lb-etq-ver"), ocultar = () => t.classList.remove("lb-etq-ver");
      a.addEventListener("pointerenter", ver); a.addEventListener("pointerleave", ocultar);
      a.addEventListener("focus", ver); a.addEventListener("blur", ocultar);
    });
  }

  window.LobbyMapa = { MAPA, ORDEN };
  function iniciar() {
    capaEtiquetas();
    pintarZonas();
    // En el móvil la escena no se ve (hay puertas grandes): la lista con todos los enlaces va abierta
    const todo = document.querySelector(".lb-todo");
    if (todo && window.matchMedia && matchMedia("(max-width: 700px)").matches) todo.open = true;
    mostrar();
    window.addEventListener("hashchange", mostrar);
    // El rol de admin se sabe un poco después de cargar: se rehacen las listas y la sala cuando cambia
    new MutationObserver(() => { pintarZonas(); mostrar(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
