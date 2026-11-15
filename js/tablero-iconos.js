/* TABLERO — iconos (SVG en línea, trazos simples, color del texto) */
(function () {
  const s = (cuerpo, relleno) => `<svg viewBox="0 0 24 24" fill="${relleno ? "currentColor" : "none"}" stroke="${relleno ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`;
  /* Marcadores de estado de las fichas, en el orden del set por defecto de Roll20: siete puntos de color, la X de muerto
     y las siluetas de game-icons.net (js/tablero-marcas.js). Las condiciones de D&D 5e llevan la silueta que más se les parece;
     los ids antiguos se conservan para que las fichas que ya los llevan sigan igual. */
  const m = (id, nombre, ic, x) => Object.assign({ id, nombre, ic }, x || {});
  window.TBEstados = [
    { id: "rojo", nombre: "Punto rojo", color: "#C91010", numero: true }, { id: "azul", nombre: "Punto azul", color: "#1076C9", numero: true },
    { id: "verde", nombre: "Punto verde", color: "#2FC910", numero: true }, { id: "naranja", nombre: "Punto marrón", color: "#C97310", numero: true },
    { id: "morado", nombre: "Punto morado", color: "#9510C9", numero: true }, { id: "rosa", nombre: "Punto rosa", color: "#EB75E1", numero: true },
    { id: "amarillo", nombre: "Punto amarillo", color: "#E5EB75", numero: true },
    m("muerto", "Muerto", null),
    m("calavera", "Calavera", "skull-crossed-bones"), m("inconsciente", "Inconsciente", "sleepy", { cond: true }),
    m("agotamiento", "Agotamiento", "half-heart", { cond: true, numero: true, regla: "Cansancio" }), m("ardiendo", "Ardiendo", "half-haze"),
    m("ensordecido", "Ensordecido", "interdiction", { cond: true }), m("ralentizado", "Ralentizado", "snail"),
    m("paralizado", "Paralizado", "lightning-helix", { cond: true }), m("llave", "Llave", "spanner"),
    m("encantado", "Encantado", "chained-heart", { cond: true, regla: "Hechizado" }), m("envenenado", "Envenenado", "chemical-bolt", { cond: true }),
    m("maldito", "Maldito", "death-zone"), m("pocion", "Poción", "drink-me"),
    m("petrificado", "Petrificado", "edge-crack", { cond: true }), m("invisible", "Invisible", "ninja-mask", { cond: true }),
    m("cronometro", "Cronómetro", "stopwatch"), m("apresado", "Apresado", "fishing-net", { cond: true }),
    m("aturdido", "Aturdido", "overdrive", { cond: true }), m("fuerte", "Fuerte", "strong"), m("puno", "Puño", "fist"),
    m("candado", "Candado", "padlock"), m("hojas", "Tres hojas", "three-leaves"), m("acelerado", "Acelerado", "fluffy-wing"),
    m("golpeado", "Golpeado", "pummeled"), m("huellas", "Huellas", "tread"),
    m("sangrando", "Sangrando", "arrowed"), m("concentracion", "Concentración", "aura"),
    m("derribado", "Derribado", "back-pain", { cond: true }), m("bandera_negra", "Bandera negra", "black-flag"),
    m("cegado", "Cegado", "bleeding-eye", { cond: true }), m("protegido", "Protegido", "bolt-shield"),
    m("corazon_roto", "Corazón roto", "broken-heart"), m("telarana", "Telaraña", "cobweb"),
    m("incapacitado", "Incapacitado", "broken-shield", { cond: true }), m("bandera", "Bandera", "flying-flag"),
    m("radiactivo", "Radiactivo", "radioactive"), m("trofeo", "Trofeo", "trophy"),
    m("craneo_roto", "Cráneo roto", "broken-skull"), m("helado", "Helado", "frozen-orb"),
    m("bomba", "Bomba", "rolling-bomb"), m("torre", "Torre", "white-tower"),
    m("agarrado", "Agarrado", "grab", { cond: true }), m("asustado", "Asustado", "screaming", { cond: true }),
    m("granada", "Granada", "grenade"), m("torreta", "Torreta", "sentry-gun"),
    m("todos_a_una", "Todos a una", "all-for-one"), m("bendecido", "Bendecido", "angel-outfit"), m("diana", "Diana", "archery-target"),
    m("casteo_notas", "Casteo: notas musicales", "musical-notes", { anim: true }), m("casteo_cartas", "Casteo: cartas", "poker-hand", { anim: true }),
    m("fumando", "Fumando", "smoking-pipe", { anim: true }), m("raudo", "Raudo", "sprint", { anim: true })
  ];
  // Lo que dice el reglamento (data/reglas.js, sección Estados) de un marcador; vacío si no es una condición
  window.TBReglaEstado = (c, nombre) => {
    const sec = (window.REGLAS || []).find(s => s.titulo === "Estados");
    const buscado = String(nombre || (c && (c.regla || c.nombre)) || "").toLowerCase();
    const it = sec && buscado && sec.items.find(i => i.label.split(" (")[0].trim().toLowerCase() === buscado);
    return it ? it.detalle : "";
  };
  // Silueta de un marcador como SVG en línea (toma el color del texto)
  window.TBMarcaSVG = c => {
    const d = c && c.ic && window.TBMarcas && window.TBMarcas[c.ic];
    if (d) return `<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
    if (c && c.id === "muerto") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="#d32f2f" stroke-width="3.4" stroke-linecap="round"/></svg>';
    return "";
  };
  window.TBIconoDado = {
    d4: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5L22 20.5H2z" fill="currentColor"/><path d="M12 2.5L9.5 20.5" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d6: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z" fill="currentColor"/><path d="M3 7l9 5 9-5M12 12v10" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d8: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8.5 10L12 22 3.5 12z" fill="currentColor"/><path d="M3.5 12h17M12 2L9.2 12 12 22" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d10: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9 9.2-9 10.8-9-10.8z" fill="currentColor"/><path d="M3 11.2l5 2.6L12 2l4 11.8 5-2.6M8 13.8h8M12 22v0" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d12: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9.5 6.9-3.6 11.2H6.1L2.5 8.9z" fill="currentColor"/><path d="M12 6.6l4.4 3.2-1.7 5.2H9.3L7.6 9.8zM12 2v4.6M21.5 8.9l-5.1.9M17.9 20.1l-3.2-5.1M6.1 20.1l3.2-5.1M2.5 8.9l5.1.9" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d20: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="currentColor"/><path d="M12 6.8l4.8 8.3H7.2zM12 2v4.8M3.3 7l3.9 8.1M20.7 7l-3.9 8.1M7.2 15.1L3.3 17M16.8 15.1l3.9 1.9M7.2 15.1L12 22l4.8-6.9" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    d100: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3l5.5 5.6-5.5 6.6-5.5-6.6z" fill="currentColor"/><path d="M17 8.8l5.5 5.6-5.5 6.6-5.5-6.6z" fill="currentColor"/><path d="M1.5 8.6L4.5 10 7 3l2.5 7 3-1.4M11.5 14.4l3 1.4L17 8.8l2.5 7 3-1.4" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
    dF: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor"/><path d="M8 12h8M12 8v8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  window.TBIcono = {
    menu: s('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    seleccionar: s('<path d="M6 3l12 9-5.5 1.2 3.2 6.3-2.4 1.2-3.2-6.3L6 18z"/>', true),
    mano: s('<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>'),
    pingTodos: s('<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/>'),
    pingEnfoque: s('<circle cx="12" cy="12" r="2"/><path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3"/>'),
    grupoDef: s('<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>', true),
    grupoPon: s('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5M15 14.5c2.6 0 4.6 1.6 5.2 4.5"/>'),
    copiar: s('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/>'),
    pegar: s('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/>'),
    deshacer: s('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    rehacer: s('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    capas: s('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5"/>'),
    frente: s('<rect x="9" y="9" width="11" height="11" rx="1" fill="currentColor"/><rect x="4" y="4" width="11" height="11" rx="1"/>'),
    fondo: s('<rect x="4" y="4" width="11" height="11" rx="1" fill="currentColor"/><rect x="9" y="9" width="11" height="11" rx="1"/>'),
    transformar: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l3-4 3 3 2-2 3 3"/>'),
    papeleraR: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6m4-6v6"/>'),
    dibujo: s('<path d="M4 20c1.5 0 3-.6 3.7-1.7.8-1.2.4-2.6-.6-3.1-1-.6-2.4-.1-2.8 1C4 17.6 4.6 19 3 20z" fill="currentColor"/><path d="M8.5 14.5L19 4a1.4 1.4 0 0 1 2 2L10.5 16.5"/>'),
    linea: s('<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/>'),
    rect: s('<rect x="4" y="5" width="16" height="14" rx="1" fill="currentColor"/>'),
    elipse: s('<ellipse cx="12" cy="12" rx="8" ry="7" fill="currentColor"/>'),
    papelera: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    texto: s('<path d="M5 5h14M12 5v15M9 20h6"/>'),
    medida: s('<rect x="8" y="2" width="8" height="20" rx="1"/><path d="M8 6h4M8 10h3M8 14h4M8 18h3"/>'),
    dado: s('<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><path d="M12 2v6m8.7-1L12 8 3.3 7M12 8l-5 9h10z"/>'),
    turno: s('<path d="M4 6h10M4 12h8M4 18h10M18 5v14m-3-3l3 3 3-3"/>'),
    ping: s('<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/>'),
    niebla: s('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/><path d="M8 11h3m-3 3h3"/>'),
    luz: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    fx: s('<path d="M4 20L15 9m-2-2l2 2"/><path d="M17 3v3m-1.5-1.5h3M20 8v2m-1-1h2M11 3v2m-1-1h2" stroke-width="1.6"/>'),
    capaFichas: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.4-6 8-6s6.5 2 8 6"/>'),
    capaDJ: s('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>', true),
    capaMapa: s('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14m6-12v14"/>'),
    capaDelantero: s('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    chat: s('<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>'),
    arte: s('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>'),
    diario: s('<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h12M9 8h6"/>'),
    compendio: s('<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5 1z"/>'),
    gramola: s('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
    colecciones: s('<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><path d="M14 17h6m-3-3v6"/>'),
    ajustes: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    ojo: s('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    mas: s('<path d="M12 5v14M5 12h14"/>'),
    menos: s('<path d="M5 12h14"/>'),
    centrar: s('<circle cx="12" cy="12" r="7"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'),
    ordenar: s('<path d="M4 6h7M4 12h5M4 18h3M17 5v14m-3-3l3 3 3-3"/>'),
    engranaje: s('<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2"/>'),
    izquierda: s('<path d="M19 12H5m6-6l-6 6 6 6"/>'),
    derecha: s('<path d="M5 12h14m-6-6l6 6-6 6"/>'),
    candado: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    marca: s('<path d="M6 3h12v18l-6-4-6 4z"/>', true),
    carpeta: s('<path d="M3 6h6l2 2h10v11H3z"/><path d="M12 11v5m-2.5-2.5h5"/>'),
    buscar: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>')
  };
})();
