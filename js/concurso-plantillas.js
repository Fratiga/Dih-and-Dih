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
      nombre: "¿De qué personaje es el dibujo?", tema: "vineta", tipo: "dibujo",
      // Cuanto menos tiempo tienes para dibujar, más puntos vale
      preguntas: [
        { segundos: 60, idea: "Johnny Silverhand (Cyberpunk 2077)." },
        { segundos: 30, idea: "Freddy Fazbear (FNAF)." },
        { segundos: 15, idea: "El Heavy (Team Fortress 2)." },
        { segundos: 10, idea: "Steven (Steven Universe)." },
        { segundos: 5, idea: "Un slime rosa (Slime Rancher)." }
      ]
    },
    {
      nombre: "¿De qué personaje es esta parte?", tema: "vineta", tipo: "parte",
      preguntas: [
        { idea: "El brazo cromado de Johnny Silverhand (Cyberpunk 2077)." },
        { idea: "La pajarita y el sombrero de Freddy Fazbear (FNAF)." },
        { idea: "La estrella de la camiseta de Steven (Steven Universe)." },
        { idea: "El sombrero o la camisa hawaiana de Rango." },
        { idea: "La gorra de Jotaro (JoJo)." }
      ]
    },
    {
      nombre: "Reconoce la silueta", tema: "camara", tipo: "silueta",
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
      nombre: "Encuentra al falso", tema: "madera", tipo: "falso",
      // Más imágenes en la fila, más difícil
      preguntas: [
        { n: 3, idea: "Tres carátulas de discos de twenty one pilots. Una la editas tú." },
        { n: 3, idea: "Tres slimes de Slime Rancher. Uno inventado (por ejemplo, un slime con los colores cambiados)." },
        { n: 4, idea: "Cuatro animatrónicos de FNAF. Uno hecho por fans." },
        { n: 4, idea: "Cuatro pósters de películas de Marvel o DC. Uno falso." },
        { n: 5, idea: "Cinco héroes de Deadlock. Uno no existe (de otro juego o inventado)." }
      ]
    },
    {
      nombre: "Reconoce la canción", tema: "camara", tipo: "cancion",
      // Cuanto más corto el trozo, más puntos vale
      preguntas: [
        { segundos: 10, idea: "Gasolina (Daddy Yankee)." },
        { segundos: 5, idea: "Stressed Out (twenty one pilots)." },
        { segundos: 3, idea: "I Really Want to Stay at Your House (Cyberpunk: Edgerunners)." },
        { segundos: 2, idea: "world.execute(me); (Mili)." },
        { segundos: 1, idea: "Never Fade Away (Cyberpunk 2077)." }
      ]
    },
    {
      nombre: "¿Quién está mintiendo?", tema: "madera", tipo: "mentiroso", patron: "papel",
      preguntas: [
        { real: "Un personaje infravalorado", falsa: "Un personaje que te cae bien" },
        { real: "Un personaje que te follarías", falsa: "Un personaje con el que irías de fiesta" },
        { real: "", falsa: "" },
        { real: "", falsa: "" },
        { real: "", falsa: "" }
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

  const LETRAS = "ABCDE";
  const NOTA_PULSADOR = "Todos pueden pulsar RESPONDER en su enlace: en la cabina ves el orden. Al cambiar de escena el orden se limpia solo.";

  function escenaPregunta(cat, i, menu, puntos) {
    const v = VALORES[i], d = cat.preguntas[i];
    const e = CZ.nuevaEscena(`${cat.nombre} · ${v}`);
    e.carpeta = cat.nombre;
    e.tema = cat.tema;
    if (cat.patron) e.fondo = { tipo: "patron", valor: cat.patron };
    const comunes = [
      el("texto", "Categoría", 400, 28, 1120, 100, { texto: cat.nombre, tam: 56, caja: true }),
      el("texto", "Puntos", 1540, 40, 340, 80, { texto: pts(v), tam: 46, fuente: "cuerpo", contorno: false, alinear: "right" })
    ];
    const botones = [
      el("boton", "menu", 120, 930, 360, 110, { texto: "menu" }, { enlace: menu.id }),
      el("boton", "points", 1440, 930, 360, 110, { texto: "points" }, { enlace: puntos.id })
    ];
    const pulsador = el("pulsador", "Quién pulsó", 520, 935, 880, 100, { vacio: "Pulsa RESPONDER en tu enlace" });
    const respuesta = (x, y, w, h, tam) => el("texto", "Respuesta", x, y, w, h, { texto: "Escribe aquí la respuesta", tam: tam || 60 }, { oculto: true, entrada: "sello" });
    const conDing = (...pasos) => { pasos.forEach((p, k) => { if (k) p.junto = true; }); e.pasos.push(...pasos, paso("sonido", "", { sonido: "ding", junto: true })); };

    if (cat.tipo === "dibujo") {
      const reloj = el("temporizador", "Reloj", 1620, 160, 260, 130, { segundos: d.segundos });
      const resp = respuesta(300, 830, 1300, 90, 64);
      e.elementos.push(...comunes,
        el("texto", "Tiempo", 1620, 296, 260, 60, { texto: `${d.segundos} s para dibujar`, tam: 30, fuente: "cuerpo", contorno: false }),
        el("pizarra", "Pizarra", 300, 150, 1300, 670, { barra: true, fondo: "#ffffff" }),
        reloj, resp, pulsador, ...botones);
      conDing(paso("mostrar", resp.id));
      e.notas = `Tienes ${d.segundos} segundos. Piensa el personaje antes de empezar (idea: ${d.idea}).\n`
        + "Haz clic en el reloj al aire para que empiece a contar. Al llegar a 0 la pizarra se bloquea; Alt+clic en el reloj lo reinicia.\n"
        + "Dibuja en la ventana del programa (o en el monitor de la cabina). Abajo de la pizarra tienes colores, grosor, goma, deshacer y borrar.\n"
        + "Escribe el personaje en el texto oculto «Respuesta» (doble clic) y pulsa Espacio para enseñarlo.\n" + NOTA_PULSADOR;
      return e;
    }

    if (cat.tipo === "parte") {
      const parte = el("imagen", "Parte", 180, 160, 740, 650, { src: "", marco: true, ajuste: "contain" });
      const hueco = el("forma", "Hueco", 1000, 160, 740, 650, { forma: "rect", radio: 28 });
      const signo = el("texto", "Interrogación", 1000, 160, 740, 650, { texto: "?", tam: 300 });
      const completa = el("imagen", "Imagen completa", 1000, 160, 740, 650, { src: "", marco: true, ajuste: "contain" }, { oculto: true, entrada: "zoom" });
      const resp = respuesta(180, 822, 1560, 96, 64);
      e.elementos.push(...comunes, parte, hueco, signo, completa, resp, pulsador, ...botones);
      conDing(paso("mostrar", completa.id), paso("mostrar", resp.id));
      e.notas = "Te toca poner dos imágenes: selecciona «Parte» y pon el PNG recortado de la parte (con «Archivo del equipo», pegándolo o arrastrándolo encima). Luego haz clic sobre el «?»: encima está «Imagen completa», oculta y transparente en el editor. Pon ahí la imagen entera.\n"
        + `Escribe el personaje en «Respuesta». Con Espacio aparecen a la vez la imagen completa y la respuesta.\nIdea: ${d.idea}\n` + NOTA_PULSADOR;
      return e;
    }

    if (cat.tipo === "silueta") {
      const img = el("prueba", "Imagen", 460, 200, 1000, 620, { modo: "silueta", src: "", zoom: 3, cx: 0.5, cy: 0.5, marco: true });
      const resp = respuesta(460, 828, 1000, 90, 56);
      e.elementos.push(...comunes, el("texto", "Pregunta", 360, 136, 1200, 60, { texto: cat.enunciado, tam: 44, fuente: "cuerpo", contorno: false }), img, resp, pulsador, ...botones);
      conDing(paso("revelar", img.id), paso("mostrar", resp.id));
      e.notas = `Te toca: pon la imagen (selecciona «Imagen» y usa «Archivo del equipo» o una URL). Sale negra hasta que pulses Espacio. Escribe la respuesta en el texto oculto.\nIdea: ${d.idea}\n` + NOTA_PULSADOR;
      return e;
    }

    if (cat.tipo === "falso") {
      const n = d.n, hueco = 40, ancho = Math.min(440, Math.floor((1680 - hueco * (n - 1)) / n));
      const x0 = Math.round((1920 - (ancho * n + hueco * (n - 1))) / 2), y0 = 200 + Math.round((600 - ancho) / 2);
      e.elementos.push(...comunes, el("texto", "Pregunta", 360, 130, 1200, 60, { texto: "¿Cuál es el falso?", tam: 46, fuente: "cuerpo", contorno: false }));
      for (let k = 0; k < n; k++) {
        const x = x0 + k * (ancho + hueco);
        e.elementos.push(
          el("imagen", "Imagen " + LETRAS[k], x, y0, ancho, ancho, { src: "", marco: true, ajuste: "cover", sello: "FALSO" }, { entrada: "rebote" }),
          el("texto", "Letra " + LETRAS[k], x, y0 + ancho + 14, ancho, 90, { texto: LETRAS[k], tam: 76 })
        );
      }
      e.elementos.push(pulsador, ...botones);
      e.notas = `Te toca poner ${n} imágenes, una de ellas falsa (selecciona «Imagen A», «Imagen B»... y usa «Archivo del equipo»).\n`
        + "Para revelar, haz clic al aire en la falsa: se le pone el sello FALSO. Otro clic lo quita.\n"
        + `Idea: ${d.idea}\n` + NOTA_PULSADOR;
      return e;
    }

    if (cat.tipo === "cancion") {
      const clip = el("clip", "Canción", 480, 190, 960, 360, { src: "", archivo: "", inicio: 0, fin: d.segundos, volumen: 1, etiqueta: `Escucha ${d.segundos === 1 ? "1 segundo" : d.segundos + " segundos"}` });
      const resp = respuesta(260, 600, 1400, 220, 72);
      e.elementos.push(...comunes, clip, resp, pulsador, ...botones);
      e.pasos.push(paso("reproducir", clip.id));
      conDing(paso("mostrar", resp.id));
      e.notas = `Te toca poner la canción: selecciona «Canción», pulsa «Archivo del equipo» (o arrastra el mp3 al escenario) y en el recorte deja ${d.segundos} s con el botón «${d.segundos} s» de Duración fija.\n`
        + "Espacio la hace sonar. Un clic en el disco al aire la vuelve a poner desde el principio (o la para si está sonando). El sonido sale por el programa; si quieres oírla también en la cabina, marca «Sonidos aquí».\n"
        + `Escribe título y artista en «Respuesta».\nIdea: ${d.idea}\n` + NOTA_PULSADOR;
      return e;
    }

    const caja = el("forma", "Fondo", 140, 160, 1640, 740, { forma: "rect", radio: 28 });

    if (cat.tipo === "mentiroso") {
      const real = el("texto", "Pregunta real", 220, 470, 1480, 150, { texto: d.real || "Escribe la pregunta real", tam: 70, contorno: false }, { oculto: true, entrada: "sello" });
      const etqReal = el("texto", "Título de la real", 220, 410, 1480, 60, { texto: "La pregunta era", tam: 40, fuente: "cuerpo", contorno: false }, { oculto: true, entrada: "aparecer" });
      const falsa = el("texto", "Pregunta del mentiroso", 220, 720, 1480, 110, { texto: d.falsa || "Escribe la pregunta del mentiroso", tam: 54, contorno: false, color: "#d6332b" }, { oculto: true, entrada: "sello" });
      const etqFalsa = el("texto", "Título de la falsa", 220, 665, 1480, 56, { texto: "Y el mentiroso tenía esta", tam: 36, fuente: "cuerpo", contorno: false }, { oculto: true, entrada: "aparecer" });
      e.elementos.push(...comunes, caja,
        el("texto", "Instrucciones", 220, 200, 1480, 190, { texto: "Todos tienen una pregunta en su enlace, menos uno: el mentiroso tiene otra parecida. Respondan por turnos y luego voten quién miente.", tam: 46, fuente: "cuerpo", contorno: false }),
        etqReal, real, etqFalsa, falsa, ...botones);
      e.pasos.push(paso("mostrar", etqReal.id), Object.assign(paso("mostrar", real.id), { junto: true }), paso("mostrar", etqFalsa.id), Object.assign(paso("mostrar", falsa.id), { junto: true }), paso("sonido", "", { sonido: "tambor", junto: true }));
      e.notas = (d.real ? "" : "Te toca: escribe la pregunta real y la del mentiroso (doble clic en los textos ocultos, o desde la vista de los pasos).\n")
        + "Antes de empezar, en la pestaña Jugadores pulsa «Repartir las preguntas»: a todos les llega la real a su enlace y a uno (al azar o el que elijas) la del mentiroso.\n"
        + "Espacio 1: enseña la pregunta real. Espacio 2: enseña la del mentiroso.\n"
        + "Puntos (cámbialos si quieres): quien vote bien gana los puntos de la casilla. Si nadie descubre al mentiroso, él gana el doble.";
      return e;
    }

    // Opinión impopular
    e.elementos.push(...comunes, caja,
      el("texto", "Pregunta", 220, 260, 1480, 300, { texto: d.q, tam: 76, contorno: false }),
      el("texto", "Regla", 220, 640, 1480, 120, { texto: "Solo puntúan las respuestas que nadie más dio. Si coincides con alguien, los dos se quedan sin puntos.", tam: 38, fuente: "cuerpo", contorno: false }),
      ...botones);
    e.notas = "No hay respuesta correcta. Pide que cada uno responda y da los puntos solo a las respuestas únicas.";
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
        texto: "• En tu turno eliges una casilla.\n• Todos pueden pulsar RESPONDER en su enlace. Responde el primero; si falla, pasa al siguiente.\n• Si aciertas, te llevas los puntos de la casilla. Si pides una pista, vale la mitad.\n• En los dibujos y las canciones, menos tiempo es más puntos.\n• En «Opinión impopular» solo puntúan las respuestas que nadie más dio.\n• Antes de elegir casilla puedes comprar en la tienda con tus puntos.",
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
    { id: "gran-noche", nombre: "La Gran Noche del Quiz", descripcion: "Dibujos, partes, siluetas, falsos, canciones, mentirosos y opiniones. Temas: Cyberpunk, Slime Rancher, FNAF, TF2, Overwatch, Deadlock, Edgerunners, Steven Universe, JoJo, música, Marvel, DC y Rango", crear: granNoche }
  ];
})(window.CZ);
