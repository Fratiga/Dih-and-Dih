/* =============================================================================
   CONCURSO — partidas ya montadas que se crean desde el menú Partidas.
   Cada plantilla es una función que devuelve una partida completa (escenas,
   pasos, enlaces de la matriz y tienda). Las notas de cada escena (escena.notas)
   solo las ve el anfitrión en la cabina: ahí van respuestas, ideas e
   instrucciones de lo que falta por poner.
============================================================================= */
(function (CZ) {
  const el = (tipo, nombre, x, y, w, h, props, extra) => CZ.nuevoElemento(tipo, Object.assign({ nombre, x, y, w, h, props: props || {} }, extra || {}));
  const paso = (accion, objetivo, mas) => Object.assign({ id: CZ.uid(), accion, objetivo }, mas || {});
  const pts = v => v + (v === 1 ? " punto" : " puntos");

  /* ---------------------------------------------------------------- La Gran Noche del Quiz */

  const VALORES = [1, 1, 2, 2, 3];

  // Una fila de la matriz: categoría, tema de sus escenas, tipo de pregunta y sus cinco preguntas (de 1, 1, 2, 2 y 3 puntos)
  const CATEGORIAS = [
    {
      nombre: "Pieza suelta", tema: "vineta", tipo: "recorte",
      enunciado: "¿De quién es esta parte?",
      preguntas: [
        { idea: "El brazo cromado de Johnny Silverhand (Cyberpunk 2077)." },
        { idea: "La pajarita y el sombrero de Freddy Fazbear (FNAF)." },
        { idea: "La estrella de la camiseta de Steven (Steven Universe)." },
        { idea: "El sombrero o la camisa hawaiana de Rango." },
        { idea: "La cara de un Tarr o el ojo de un slime (Slime Rancher)." }
      ]
    },
    {
      nombre: "En la sombra", tema: "camara", tipo: "silueta",
      enunciado: "¿Quién es esta silueta?",
      preguntas: [
        { idea: "El Heavy con su ametralladora (Team Fortress 2)." },
        { idea: "Spider-Man colgado de su telaraña." },
        { idea: "Tracer corriendo (Overwatch)." },
        { idea: "Lion, el león de Steven (Steven Universe)." },
        { idea: "Un Stand: Star Platinum o The World (JoJo)." }
      ]
    },
    {
      nombre: "Oído fino", tema: "vineta", tipo: "texto", patron: "puntos",
      preguntas: [
        { q: "¿Quién canta «Gasolina» (2004)?", r: "Daddy Yankee" },
        { q: "¿Cuántos integrantes tiene twenty one pilots?", r: "Dos: Tyler Joseph y Josh Dun" },
        { q: "«Heathens», de twenty one pilots, se hizo para la banda sonora de una película de DC. ¿Cuál?", r: "Escuadrón Suicida (2016)" },
        { q: "¿En qué serie suena «I Really Want to Stay at Your House»?", r: "Cyberpunk: Edgerunners", nota: "La cantan Rosa Walton y Hallie Coggins. Si quieres, pon el fragmento desde tu equipo antes de preguntar." },
        { q: "Mili compuso gran parte de la banda sonora de un juego de Project Moon de 2020. ¿Cuál?", r: "Library of Ruina", nota: "Mili también hizo música para Limbus Company." }
      ]
    },
    {
      nombre: "Night City y alrededores", tema: "camara", tipo: "texto",
      preguntas: [
        { q: "¿Qué actor interpreta a Johnny Silverhand en Cyberpunk 2077?", r: "Keanu Reeves" },
        { q: "En Five Nights at Freddy's, ¿qué animatrónico vive en la Pirate Cove?", r: "Foxy" },
        { q: "¿Qué estudio japonés animó Cyberpunk: Edgerunners?", r: "Studio Trigger" },
        { q: "¿Cómo se llama la protagonista de Slime Rancher?", r: "Beatrix LeBeau" },
        { q: "Nombra las nueve clases de Team Fortress 2.", r: "Scout, Soldier, Pyro, Demoman, Heavy, Engineer, Medic, Sniper y Spy", nota: "Puedes dar puntos parciales si nombran siete u ocho." }
      ]
    },
    {
      nombre: "¿Existe o me lo inventé?", tema: "madera", tipo: "existe",
      preguntas: [
        { q: "En Cyberpunk 2077 hay una megacorporación llamada Arasaka.", r: "EXISTE" },
        { q: "Team Fortress 2 tiene una clase llamada «el Arquero».", r: "INVENTADO", nota: "El arco lo usa el Sniper. Las clases son nueve y ninguna es el Arquero." },
        { q: "En Steven Universe, Steven tiene un león rosa que se llama Garnet.", r: "INVENTADO", nota: "El león se llama Lion (León). Garnet es una de las Gemas de Cristal." },
        { q: "En Overwatch, Cassidy antes se llamaba McCree.", r: "EXISTE", nota: "Cambió de nombre en 2021." },
        { q: "En JoJo existe un Stand llamado «Bohemian Rhapsody».", r: "EXISTE", nota: "Es el Stand de Ungalo, en Stone Ocean (parte 6)." }
      ]
    },
    {
      nombre: "Ordénalos", tema: "vineta", tipo: "ordenar",
      preguntas: [
        { q: "Ordena por estreno, de la más antigua a la más nueva:", lista: ["Vengadores: Endgame", "Iron Man", "Los Vengadores"], r: "1. Iron Man (2008)\n2. Los Vengadores (2012)\n3. Vengadores: Endgame (2019)" },
        { q: "Ordena estas partes de JoJo, de la primera a la última:", lista: ["Stardust Crusaders", "Phantom Blood", "Battle Tendency"], r: "1. Phantom Blood\n2. Battle Tendency\n3. Stardust Crusaders" },
        { q: "Ordena estos discos de twenty one pilots, del más antiguo al más nuevo:", lista: ["Trench", "Vessel", "Scaled and Icy", "Blurryface"], r: "1. Vessel (2013)\n2. Blurryface (2015)\n3. Trench (2018)\n4. Scaled and Icy (2021)" },
        { q: "Ordena estos juegos de FNAF por lanzamiento:", lista: ["Sister Location", "FNAF 3", "Pizzeria Simulator", "FNAF 2"], r: "1. FNAF 2 (2014)\n2. FNAF 3 (2015)\n3. Sister Location (2016)\n4. Pizzeria Simulator (2017)" },
        { q: "Ordena por año de lanzamiento:", lista: ["Cyberpunk 2077", "Overwatch", "Deadlock", "Team Fortress 2", "Slime Rancher", "Five Nights at Freddy's"], r: "1. Team Fortress 2 (2007)\n2. Five Nights at Freddy's (2014)\n3. Overwatch (2016)\n4. Slime Rancher (2017)\n5. Cyberpunk 2077 (2020)\n6. Deadlock (2024)", nota: "Slime Rancher: versión completa (estuvo en acceso anticipado desde 2016). Deadlock: año en que Valve lo mostró." }
      ]
    },
    {
      nombre: "Opinión impopular", tema: "madera", tipo: "opinion", patron: "papel",
      preguntas: [
        { q: "¿Qué personaje de cualquiera de estos temas invitarías a cenar?" },
        { q: "¿Qué canción pondrías para entrar a un ring de boxeo?" },
        { q: "¿Qué personaje duraría menos de un día en Night City?" },
        { q: "¿Qué villano tiene un poco de razón?" },
        { q: "¿Qué personaje sería el peor compañero de piso?" }
      ]
    }
  ];

  // Tienda: cada objeto viene de uno de los temas. tipo da el color y la etiqueta de la carta.
  const TIPOS = {
    sabotaje: { nombre: "Sabotaje", color: "#e8453c" },
    restriccion: { nombre: "Restricción", color: "#a35ee8" },
    proteccion: { nombre: "Protección", color: "#3d8de0" },
    ayuda: { nombre: "Ayuda", color: "#6cc04a" },
    misterio: { nombre: "Misterio", color: "#6b6b6b" },
    distorsion: { nombre: "Distorsión", color: "#ff8a3d" }
  };
  const TIENDA = [
    { n: "Sandevistan", tema: "Cyberpunk: Edgerunners", tipo: "ayuda", precio: 4, t: "Si fallas una pregunta, vuelves a responder antes que nadie." },
    { n: "Hackeo rápido", tema: "Cyberpunk 2077", tipo: "sabotaje", precio: 7, t: "Elige un jugador: pierde la mitad de sus puntos (redondeando hacia abajo)." },
    { n: "Parche 1.0", tema: "Cyberpunk 2077", tipo: "distorsion", precio: 5, t: "Hasta el final de la ronda, todos los objetos activos hacen lo contrario de lo que dicen." },
    { n: "El Tarr", tema: "Slime Rancher", tipo: "sabotaje", precio: 4, t: "Dáselo a otro jugador. Pierde 1 punto al inicio de cada turno suyo. Si acierta una pregunta, se lo pasa a quien quiera." },
    { n: "Plort dorado", tema: "Slime Rancher", tipo: "ayuda", precio: 3, t: "Véndelo cuando quieras: tira un dado y ganas el doble de lo que salga." },
    { n: "Máscara de Freddy", tema: "Five Nights at Freddy's", tipo: "proteccion", precio: 5, t: "Durante una ronda nadie puede quitarte puntos ni ponerte estados." },
    { n: "Linterna", tema: "Five Nights at Freddy's", tipo: "proteccion", precio: 2, t: "La próxima vez que destapes un castigo en las cartas de riesgo, no te afecta." },
    { n: "Sandvich", tema: "Team Fortress 2", tipo: "ayuda", precio: 3, t: "Recuperas los últimos puntos que perdiste." },
    { n: "Disfraz del Spy", tema: "Team Fortress 2", tipo: "distorsion", precio: 8, t: "Cambia tu puntuación por la de otro jugador, elegido con un dado." },
    { n: "Nano Boost", tema: "Overwatch", tipo: "ayuda", precio: 5, t: "Tu próxima pregunta vale el doble." },
    { n: "Urna de almas", tema: "Deadlock", tipo: "misterio", precio: 3, t: "No hace nada. ¿O sí?", nota: "Secreto: si sigue en el inventario de alguien al abrir la escena final, le roba 2 puntos a cada jugador." },
    { n: "¡Ora ora!", tema: "JoJo's Bizarre Adventure", tipo: "restriccion", precio: 3, t: "Elige un jugador: en su próximo turno tiene que decir «ORA» antes de cada respuesta. Si se le olvida, pierde 1 punto." },
    { n: "Fusión", tema: "Steven Universe", tipo: "distorsion", precio: 4, t: "Te fusionas con otro jugador hasta el final de la ronda: lo que gane uno lo ganan los dos." },
    { n: "Guantelete del Infinito", tema: "Marvel", tipo: "sabotaje", precio: 10, t: "Chasquido: tira un dado por cada jugador (tú incluido). Con 1, 2 o 3, pierde la mitad de sus puntos." },
    { n: "Kryptonita", tema: "DC", tipo: "sabotaje", precio: 4, t: "Destruye un objeto de otro jugador, aunque sea una protección." },
    { n: "Perreo intenso", tema: "Reggaetón clásico", tipo: "restriccion", precio: 3, t: "Durante una ronda, quien diga «eh», «este» o «o sea» pierde 1 punto." }
  ];

  function escenaPregunta(cat, i, menu, puntos) {
    const v = VALORES[i], d = cat.preguntas[i];
    const e = CZ.nuevaEscena(`${cat.nombre} · ${v}`);
    e.carpeta = cat.nombre;
    e.tema = cat.tema;
    if (cat.patron) e.fondo = { tipo: "patron", valor: cat.patron };
    const comunes = [
      el("texto", "Categoría", 460, 28, 1000, 100, { texto: cat.nombre, tam: 60, caja: true }),
      el("texto", "Puntos", 1500, 40, 380, 80, { texto: pts(v), tam: 46, fuente: "cuerpo", contorno: false, alinear: "right" })
    ];
    const botones = [
      el("boton", "menu", 140, 920, 380, 110, { texto: "menu" }, { enlace: menu.id }),
      el("boton", "points", 1400, 920, 380, 110, { texto: "points" }, { enlace: puntos.id })
    ];
    if (cat.tipo === "recorte" || cat.tipo === "silueta") {
      const img = el("prueba", "Imagen", 460, 210, 1000, 620, { modo: cat.tipo, src: "", zoom: 3, cx: 0.5, cy: 0.5, marco: true });
      const resp = el("texto", "Respuesta", 460, 840, 1000, 70, { texto: "Escribe aquí la respuesta", tam: 54 }, { oculto: true, entrada: "sello" });
      e.elementos.push(...comunes, el("texto", "Pregunta", 360, 140, 1200, 60, { texto: cat.enunciado, tam: 44, fuente: "cuerpo", contorno: false }), img, resp, ...botones);
      e.pasos.push(paso("revelar", img.id), paso("mostrar", resp.id), paso("sonido", "", { sonido: "ding" }));
      e.notas = `Te toca: pon la imagen (selecciona «Imagen» y usa «Archivo del equipo» o una URL), ajusta el recorte con el acercamiento y el centro, y escribe la respuesta en el texto oculto.\nIdea: ${d.idea}`;
      return e;
    }
    const caja = el("forma", "Fondo", 140, 170, 1640, 700, { forma: "rect", radio: 28 });
    if (cat.tipo === "ordenar") {
      const lista = el("texto", "Lista", 220, 320, 700, 500, { texto: d.lista.map(x => "• " + x).join("\n"), tam: 50, fuente: "cuerpo", contorno: false, alinear: "left" });
      const resp = el("texto", "Respuesta", 980, 300, 740, 540, { texto: d.r, tam: 46, fuente: "cuerpo", contorno: false, alinear: "left", color: "#16a34a" }, { oculto: true, entrada: "subir" });
      e.elementos.push(...comunes, caja, el("texto", "Pregunta", 200, 200, 1520, 100, { texto: d.q, tam: 52, fuente: "cuerpo", contorno: false }), lista, resp, ...botones);
      e.pasos.push(paso("mostrar", resp.id), paso("sonido", "", { sonido: "ding" }));
      e.notas = "Respuesta:\n" + d.r + (d.nota ? "\n\n" + d.nota : "");
      return e;
    }
    if (cat.tipo === "opinion") {
      e.elementos.push(...comunes, caja,
        el("texto", "Pregunta", 220, 260, 1480, 300, { texto: d.q, tam: 76, contorno: false }),
        el("texto", "Regla", 220, 640, 1480, 120, { texto: "Solo puntúan las respuestas que nadie más dio. Si coincides con alguien, los dos se quedan sin puntos.", tam: 38, fuente: "cuerpo", contorno: false }),
        ...botones);
      e.notas = "No hay respuesta correcta. Pide que cada uno responda y da los puntos solo a las respuestas únicas.";
      return e;
    }
    const pregunta = el("texto", "Pregunta", 220, 230, 1480, 330, { texto: d.q, tam: d.q.length > 70 ? 62 : 76, contorno: false });
    let resp;
    if (cat.tipo === "existe") {
      const real = d.r === "EXISTE";
      resp = el("texto", "Respuesta", 610, 620, 700, 170, { texto: d.r, tam: 120, color: real ? "#3f9e2f" : "#d6332b" }, { oculto: true, entrada: "sello", rot: real ? -4 : 4 });
      e.notas = `Respuesta: ${d.r}.${d.nota ? "\n" + d.nota : ""}\nSi alguien pide que le digas el nombre exacto como pista, la pregunta vale la mitad.`;
    } else {
      resp = el("texto", "Respuesta", 220, 600, 1480, 220, { texto: d.r, tam: d.r.length > 60 ? 54 : 80, color: "" }, { oculto: true, entrada: "sello" });
      e.notas = `Respuesta: ${d.r}${d.nota ? "\n" + d.nota : ""}`;
    }
    e.elementos.push(...comunes, caja, pregunta, resp, ...botones);
    e.pasos.push(paso("mostrar", resp.id), paso("sonido", "", { sonido: cat.tipo === "existe" ? "tambor" : "ding" }));
    return e;
  }

  function escenaTienda(items, n, total, menu, otra) {
    const e = CZ.nuevaEscena(`Tienda ${n}`);
    e.carpeta = "Tienda";
    e.tema = "vineta";
    e.fondo = { tipo: "patron", valor: "velocidad" };
    e.elementos.push(
      el("texto", "Título", 610, 18, 700, 100, { texto: `Tienda ${n}/${total}`, tam: 64, caja: true }),
      el("boton", "menu", 40, 22, 300, 96, { texto: "menu" }, { enlace: menu.id })
    );
    if (otra) e.elementos.push(el("boton", n === 1 ? "más" : "volver", 1580, 22, 300, 96, { texto: n === 1 ? "más" : "volver" }, { enlace: otra.id }));
    items.forEach((it, i) => {
      const t = TIPOS[it.tipo];
      e.elementos.push(el("carta", it.n, 60 + (i % 4) * 460, 140 + Math.floor(i / 4) * 470, 420, 450, {
        titulo: it.n, etiqueta: it.precio + " PTS", colorEtiqueta: t.color, imagen: "",
        habilidad: t.nombre, texto: it.t, nota: it.tema, bocaAbajo: true,
        dorso: it.precio + " PTS", colorDorso: "#3d7bd9"
      }, { entrada: "rebote" }));
    });
    e.notas = "Las cartas salen boca abajo y solo se ve el precio. Cuando alguien compre una, haz clic en ella al aire para darle la vuelta (otro clic la vuelve a tapar).\nPara vender: selecciona la carta en el editor y, en Jugadores, abre los datos del comprador y pulsa «Dar la carta seleccionada». Luego réstale el precio.\nPuedes poner una ilustración a cada carta con «Archivo del equipo».\n\n"
      + items.filter(it => it.nota).map(it => `${it.n}: ${it.nota}`).join("\n");
    return e;
  }

  function granNoche() {
    const p = CZ.nuevaPartida("La Gran Noche del Quiz", false);
    p.escenas = [];
    p.tema = "madera";

    const titulo = CZ.nuevaEscena("Título");
    titulo.carpeta = "Inicio";
    titulo.tema = "vineta";
    titulo.transicion = "zoom";
    const reglas = CZ.nuevaEscena("Reglas");
    reglas.carpeta = "Inicio";
    const menu = CZ.nuevaEscena("Menú");
    menu.carpeta = "Inicio";
    const puntos = CZ.nuevaEscena("Puntos");
    puntos.carpeta = "Inicio";
    puntos.fondo = { tipo: "patron", valor: "papel" };
    const suerte = CZ.nuevaEscena("¿Te sientes con suerte?");
    suerte.carpeta = "Eventos";
    suerte.tema = "camara";
    const final = CZ.nuevaEscena("Final");
    final.carpeta = "Final";
    final.tema = "vineta";
    final.fondo = { tipo: "patron", valor: "velocidad" };
    final.transicion = "cortina";

    titulo.elementos.push(
      el("texto", "Título", 160, 300, 1600, 240, { texto: "La Gran Noche del Quiz", tam: 170 }, { entrada: "rebote" }),
      el("texto", "Subtítulo", 360, 560, 1200, 80, { texto: "Juegos, series, música y películas", tam: 52, fuente: "cuerpo", contorno: false }, { entrada: "subir" }),
      el("boton", "empezar", 760, 760, 400, 110, { texto: "empezar" }, { enlace: reglas.id, entrada: "subir" })
    );

    reglas.elementos.push(
      el("texto", "Título", 560, 40, 800, 110, { texto: "Cómo se juega", tam: 70, caja: true }),
      el("forma", "Fondo", 180, 190, 1560, 680, { forma: "rect", radio: 28 }),
      el("texto", "Reglas", 240, 220, 1440, 620, {
        texto: "• En tu turno eliges una casilla. Si aciertas, te llevas sus puntos.\n• Puedes pedir una pista. Si lo haces, la pregunta vale la mitad.\n• En «¿Existe o me lo inventé?», pedir el nombre exacto también la deja en la mitad.\n• En «Opinión impopular» solo puntúan las respuestas que nadie más dio.\n• Antes de elegir casilla puedes comprar en la tienda con tus puntos.",
        tam: 44, fuente: "cuerpo", contorno: false, alinear: "left"
      }),
      el("boton", "al menú", 760, 920, 400, 110, { texto: "al menú" }, { enlace: menu.id })
    );
    reglas.notas = "Cambia lo que quieras: es un texto normal. Doble clic sobre él para escribir.";

    // Preguntas, en el orden de la matriz
    const preguntas = CATEGORIAS.map(cat => cat.preguntas.map((_, i) => escenaPregunta(cat, i, menu, puntos)));

    const matriz = el("matriz", "Matriz", 40, 30, 1520, 860, {
      categorias: CATEGORIAS.map(c => c.nombre), valores: VALORES.slice(), iconos: [], mostrarValores: true,
      enlaces: {}
    });
    preguntas.forEach((fila, r) => fila.forEach((e, c) => { matriz.props.enlaces[r + "," + c] = e.id; }));

    const tienda1 = escenaTienda(TIENDA.slice(0, 8), 1, 2, menu, null);
    const tienda2 = escenaTienda(TIENDA.slice(8), 2, 2, menu, tienda1);
    tienda1.elementos.push(el("boton", "más", 1580, 22, 300, 96, { texto: "más" }, { enlace: tienda2.id }));

    menu.elementos.push(
      matriz,
      el("boton", "¿suerte?", 1590, 40, 300, 110, { texto: "¿suerte?" }, { enlace: suerte.id }),
      el("boton", "tienda", 1590, 180, 300, 110, { texto: "tienda" }, { enlace: tienda1.id }),
      el("boton", "reglas", 1590, 320, 300, 110, { texto: "reglas" }, { enlace: reglas.id }),
      el("boton", "puntos", 1590, 460, 300, 110, { texto: "puntos" }, { enlace: puntos.id }),
      el("boton", "final", 1590, 760, 300, 110, { texto: "final" }, { enlace: final.id })
    );
    p.jugadores.forEach((j, i) => menu.elementos.push(el("marcador", "Marcador " + (i + 1), 40 + i * 390, 920, 370, 130, { jugadorId: j.id }, { entrada: "subir" })));
    menu.notas = "Clic en una celda (en el programa o en el monitor) para ir a su pregunta. Se marca con el jugador que tengas elegido (teclas 1 a 4). Alt+clic en una celda usada la desmarca.";

    const valoresSuerte = Array.from({ length: 18 }, (_, i) => (i === 11 ? "-5 puntos" : i === 4 || i === 15 ? "Pierdes el turno" : "+1 punto"));
    suerte.elementos.push(
      el("texto", "Pregunta", 410, 30, 1100, 80, { texto: "¿Cuántas veces vas a tentar a la suerte?", tam: 52, fuente: "cuerpo", contorno: false, color: "#e9e33b" }),
      el("rejilla", "Cartas", 160, 150, 1600, 750, { cols: 6, filas: 3, estilo: "suerte", letras: true, valores: valoresSuerte }),
      el("boton", "menu", 360, 940, 380, 100, { texto: "menu" }, { enlace: menu.id }),
      el("boton", "points", 1180, 940, 380, 100, { texto: "points" }, { enlace: puntos.id })
    );
    suerte.notas = "Cada carta normal vale +1. Una es -5 y dos hacen perder el turno. El jugador decide cuándo parar. Si quieres otro reparto, cambia «Lo que hay debajo» en la rejilla.";

    puntos.elementos.push(
      el("podio", "Podio", 160, 100, 1600, 800, { titulo: "" }),
      el("boton", "menu", 760, 930, 400, 100, { texto: "menu" }, { enlace: menu.id })
    );
    puntos.notas = "Clic sobre el número de un jugador para escribir sus puntos.";

    final.elementos.push(
      el("texto", "Título", 460, 30, 1000, 110, { texto: "Resultado final", tam: 76, caja: true }),
      el("podio", "Podio", 160, 160, 1600, 820, { titulo: "" }, { entrada: "rebote" })
    );
    final.notas = "Antes de abrir esta escena, revisa si alguien tiene la Urna de almas.";

    p.escenas.push(titulo, reglas, menu, puntos, ...[].concat(...preguntas), tienda1, tienda2, suerte, final);
    p.vivo = { escena: titulo.id, paso: 0 };
    return p;
  }

  CZ.PLANTILLAS = [
    { id: "gran-noche", nombre: "La Gran Noche del Quiz", descripcion: "Cyberpunk, Slime Rancher, FNAF, TF2, Overwatch, Deadlock, Edgerunners, Steven Universe, JoJo, música, Marvel, DC y Rango", crear: granNoche }
  ];
})(window.CZ);
