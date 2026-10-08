/* =============================================================================
   PRESENCIA — quién está conectado y qué anda haciendo, en cualquier página del
   sitio. Cada página (con la sesión iniciada) se anuncia en el canal de presencia
   de Supabase con su nombre y una frase según la página; el lobby las muestra en
   la caja "En la taberna". Solo funciona con la sesión iniciada y no guarda nada:
   se borra al cerrar la página.

   No se carga en las páginas secretas (Bufón, Muerte Súbita) ni dice nada de las
   páginas escondidas: ahí se muestra una frase genérica.
============================================================================= */
(function () {
  if (typeof fichasCliente !== "function" || typeof fichasSesionActual !== "function") return;

  // Frases por página (se elige una al azar al entrar). Siempre en tercera persona.
  const FRASES = {
    "index.html": ["Calentándose junto a la chimenea", "Mirando la taberna con cara de misterio", "Eligiendo puerta sin decidirse", "Haciendo como que busca a alguien", "Contando las vigas del techo", "Esperando a que alguien le invite algo", "Calentándose las manos en la chimenea", "Mirando la rocola con ganas", "Preguntándose qué puerta es la buena", "Haciendo tiempo antes de decidir"],
    "compendio.html": ["Hojeando el Compendio", "Perdido entre cientos de entradas", "Buscando algo que juraba haber leído", "Leyendo \"solo una entrada más\"", "Abriendo una entrada tras otra sin leerlas", "Siguiendo un enlace que lo llevó muy lejos", "Perdiendo una hora en el Compendio", "Descubriendo cosas que nadie le preguntó", "Dándole vueltas a una entrada rara", "Usando el buscador como si fuera un oráculo"],
    "mapa.html": ["Mirando el mapa fingiendo que sabe dónde está", "Trazando rutas que nadie le pidió", "Buscando su casa en el mapa", "Poniendo el dedo donde cree que queda todo", "Midiendo distancias con los dedos", "Descubriendo que su ciudad no está donde pensaba", "Buscando atajos que no existen", "Encontrando lugares de los que nunca oyó hablar", "Haciendo zoom a ver si aparece un dragón"],
    "cronologia.html": ["Repasando quién hizo qué y cuándo", "Viajando por la línea del tiempo", "Descubriendo que todo fue culpa de alguien", "Siguiendo la línea del tiempo sin perder el hilo", "Intentando entender qué pasó primero", "Fingiendo que recuerda esa fecha", "Haciendo cuentas de cuántos años pasaron", "Leyendo la historia con cara de preocupación", "Cazando contradicciones en las fechas"],
    "lugares.html": ["Planeando unas vacaciones peligrosas", "Eligiendo dónde NO ir", "Buscando una posada decente", "Buscando el mejor sitio donde esconderse", "Marcando destinos para un viaje que no hará", "Evaluando qué ciudad tiene mejor taberna", "Leyendo sobre un lugar al que le da miedo ir", "Comparando climas, todos malos", "Eligiendo dónde empezar la próxima aventura"],
    "facciones.html": ["Decidiendo a qué bando traicionar", "Evaluando alianzas dudosas", "Leyendo quién odia a quién", "Sospechando de todas las facciones por igual", "Haciéndose amigo del bando equivocado", "Trazando un árbol de enemistades", "Preguntándose quién manda de verdad", "Leyendo sobre un juramento que nadie cumple", "Anotando a quién le debe un favor"],
    "personajes.html": ["Chismeando sobre los personajes del mundo", "Buscando al culpable de todo", "Mirando caras conocidas", "Revisando quién conoce a quién", "Buscando al personaje que le cae peor", "Leyendo la vida de alguien que no pidió fama", "Descubriendo parientes que nadie mencionó", "Tomando partido por un personaje secundario", "Atando cabos entre nombres raros"],
    "razas.html": ["Comparando orejas y colmillos", "Eligiendo qué raza se le da mejor mentir", "Pensando qué raza le haría un buen bufón", "Leyendo sobre pueblos que no conocía", "Escogiendo orejas para su próximo personaje", "Comparando alturas y malos humores", "Preguntándose qué raza cocina mejor", "Buscando de qué lado de la familia salió"],
    "religion.html": ["Charlando con los dioses (en silencio)", "Contando cuántos dioses son demasiados", "Leyendo qué castiga cada dios", "Eligiendo a quién rezarle esta noche", "Contando cuántos templos son demasiados", "Descubriendo que se peleó con un dios sin querer", "Buscando un milagro que le sirva", "Leyendo doctrinas con cara de sospecha"],
    "textos.html": ["Leyendo letra chica", "Cultivándose, de a poquito", "Subrayando mentalmente un párrafo largo", "Leyendo despacio para no entender más rápido", "Perdido en un tratado sin fin", "Haciéndose el intelectual", "Buscando una frase que sonara importante", "Estudiando para un examen que no existe"],
    "pergaminos.html": ["Descifrando pergaminos polvorientos", "Estornudando por culpa de un pergamino", "Desenrollando un pergamino con mucho cuidado", "Buscando la parte que no está tachada", "Sacudiendo el polvo de un hechizo olvidado", "Intentando pronunciar algo imposible", "Copiando una fórmula en su libreta", "Descubriendo que el pergamino estaba al revés"],
    "armas.html": ["Admirando armas que no puede pagar", "Eligiendo con qué golpear mejor", "Pesando mandobles con la mirada", "Imaginándose con esa hacha enorme", "Comparando dagas con cara de experto", "Preguntándose si esa espada corta de verdad", "Escogiendo el arma que nunca sabrá usar", "Mirando el precio y suspirando"],
    "objetos.html": ["Hurgando en el baúl de objetos", "Buscando algo que brille", "Revolviendo el baúl de objetos", "Probándose un anillo sin permiso", "Buscando algo útil entre tanto trasto", "Sospechando de un objeto demasiado bonito", "Preguntándose si esa poción está caducada", "Coleccionando tesoros que no cargará"],
    "bestiario.html": ["Estudiando cómo no ser comido", "Descubriendo qué criatura lo perseguiría", "Tomando notas de lo que más muerde", "Buscando qué criatura lo comería primero", "Comparando colmillos y garras", "Averiguando de qué lado huir", "Leyendo debilidades para después olvidarlas", "Haciendo una lista de lo que NO acariciar", "Escogiendo al monstruo favorito"],
    "reglas.html": ["Discutiendo las reglas con el reglamento", "Buscando la regla que le conviene", "Buscando el párrafo que le da la razón", "Releyendo la regla que nunca entiende", "Armando un caso legal contra el DM", "Subrayando una excepción que le conviene", "Discutiendo qué cuenta como acción", "Descubriendo que llevaba años jugando mal"],
    "economia.html": ["Contando monedas imaginarias", "Calculando si le alcanza para la posada", "Calculando cuántas monedas hacen una fortuna", "Regateando con una tabla de precios", "Preguntándose cuánto cuesta una cabra", "Sumando monedas que no tiene", "Comparando precios de posadas", "Soñando con ser rico en el juego"],
    "estadisticas.html": ["Midiendo monstruos con una cinta", "Mirando números con cara seria", "Comparando monstruos con una calculadora", "Mirando una CA con sospecha", "Preguntándose si ese jefe se puede vencer", "Estudiando los números de un enemigo", "Sacando cuentas de cuánto daño aguanta", "Buscando el punto débil en una tabla"],
    "fanarts.html": ["Babeando con los fanarts", "Buscando su personaje entre los dibujos", "Admirando lo que dibuja la gente", "Guardándose un dibujo para mirarlo después", "Reconociendo a su personaje en un dibujo", "Admirando los trazos de alguien", "Prometiéndose dibujar algo algún día", "Riéndose de un fanart sin explicación", "Recorriendo la galería de punta a punta"],
    "peticiones.html": ["Dejando una petición en el buzón", "Redactando una sugerencia con mucha seriedad", "Escribiendo una sugerencia en el buzón", "Reescribiendo una petición para que suene seria", "Dudando si mandarla anónima", "Pidiendo algo que seguramente no se podrá", "Dejando una queja con mucho cariño", "Releyendo su mensaje antes de enviarlo"],
    "fichas.html": ["Revisando los misterios de sus personajes", "Contando puntos de atributo con los dedos", "Dándole un último retoque a su ficha", "Preguntándose por qué su personaje hizo eso", "Peleando con las cuentas de su ficha", "Subiendo de nivel y rezando por sus PV", "Contando espacios de conjuro por décima vez", "Acomodando sus ataques en el orden perfecto", "Revisando qué rasgos olvidó que tenía", "Inventando una historia para su personaje", "Preguntándose si tiene suficiente inventario"],
    "minijuegos.html": ["Eligiendo con qué perder el tiempo", "Decidiendo qué juego le va a doler más", "Mirando juegos sin atreverse a empezar", "Buscando algo con qué distraerse un rato", "Eligiendo entre perder y perder más lento", "Calentando los dedos antes de jugar", "Decidiendo qué récord quiere superar", "Escogiendo la excusa para procrastinar"],
    "arqueria.html": ["Apuntando con un ojo cerrado y el otro también", "Culpando al viento por un disparo desviado", "Soltando la cuerda y rezando", "Midiendo la distancia con el pulgar", "Fingiendo que el blanco se movió", "Buscando la diana a base de flechazos", "Poniéndose en postura de arquero legendario", "Contando flechas que ya no quedan", "Sintiéndose Hornet por un minuto"],
    "ajedrez.html": ["Pensando una jugada durante demasiado tiempo", "Fingiendo que sabe de ajedrez", "Moviendo un peón con aire de gran estratega", "Pensando tres jugadas… y olvidando la primera", "Sacrificando una pieza por motivos poéticos", "Culpando al reloj por una mala jugada", "Protegiendo a su rey con aire dramático", "Intentando recordar cómo se movía el caballo", "Planeando un jaque que nunca llega", "Mirando el tablero con ojos de estratega"],
    "ritmo.html": ["Golpeando notas al compás de la Zarabanda", "Moviendo los dedos como si fueran de otro", "Siguiendo el ritmo con la cabeza", "Golpeando notas con el dedo meñique", "Fallando una nota con mucho estilo", "Buscando el compás perdido", "Moviendo todo el cuerpo menos el dedo correcto", "Peleando por el combo perfecto", "Tarareando mientras cae la nota"],
    "parranda.html": ["Rasgueando el aire mientras caen las notas", "Sintiéndose estrella de rock en el escenario", "Perdiendo el combo por culpa del dedo meñique", "Tocando la Parranda con la lengua afuera", "Sintiéndose el rey del escenario", "Persiguiendo un combo imposible", "Siguiendo el ritmo con el pie aunque no deba", "Perdiendo la nota por reírse", "Dándolo todo en la pista de la Parranda"],
    "parranda-editor.html": ["Armando un mapa de Parranda carril por carril", "Grabando notas a mano de oído", "Mapeando una batería con paciencia infinita", "Acomodando notas como si fueran fichas de dominó", "Pensando dónde cae mejor el siguiente golpe", "Escuchando la misma canción por vigésima vez", "Poniendo carriles con pulso de relojero", "Probando un mapa y gritándole a las notas", "Convirtiendo una canción en un reto imposible"],
    "ritmo-editor.html": ["Jugueteando con el editor del Zarabanda", "Acomodando notas en el editor de mapas", "Poniéndole ritmo a una canción desde cero", "Pelando con el compás en el editor", "Acomodando notas como si fueran fichas de dominó", "Escuchando la misma canción por vigésima vez", "Poniendo notas con pulso de relojero", "Probando un mapa y gritándole a las notas", "Convirtiendo una canción en un reto imposible", "Peleando con una nota que no quiere quedarse"],
    "rocola.html": ["Poniendo música a la taberna", "Peleando con la rocola", "Eligiendo la canción que todos van a odiar", "Eligiendo música para fastidiar a los demás", "Subiéndole el volumen a su canción favorita", "Saltándose canciones sin piedad", "Buscando esa canción que nadie conoce", "Descubriendo que ya había puesto esa antes", "Armando la banda sonora de la partida"],
    "sacrificio.html": ["Sacrificando a Hooey sin remordimientos", "Tratando de que ninguno toque el piso", "Sacrificando 30 millones de Hooeys", "Apuntando bien para que ninguno caiga", "Persiguiendo un récord de racha", "Atrapando Hooeys como si fuera su trabajo", "Intentando que el fuego no lo alcance", "Dándole a Hooey una despedida digna"]
  };
  // Páginas escondidas o de administración: no se dice qué son
  const GENERICAS = ["Trasteando por ahí", "Tras bambalinas, moviendo hilos", "En algún rincón de la taberna"];
  const OCULTAS = ["duelo.html", "cartas.html", "ostelar.html", "hipodromo.html", "admin.html"];
  const FALLBACK = ["Paseando por la taberna", "Curioseando por ahí"];
  const OTRA_PESTANA = [
    "En otra pestaña, vaya a saber qué hace", "Se fue a mirar otra cosa", "Desaparecido (probablemente tomando agua)",
    "Contestando un mensaje que no era urgente", "Viendo videos de gatos, seguro", "Se levantó a por un snack",
    "Perdido en otra pestaña, sin mapa", "Fingiendo trabajar en otra ventana", "Revisando el celular con cara de culpa",
    "Atendiendo un asunto muy importante (no lo es)", "Se quedó dormido sobre el teclado", "Fue a ver qué ruido era ese",
    "Discutiendo en un chat, mejor no preguntar", "De visita en el universo de otra pestaña", "Dejó la taberna con la puerta abierta"
  ];

  const alAzar = lista => lista[Math.floor(Math.random() * lista.length)];
  const pagina = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const lista = OCULTAS.includes(pagina) ? GENERICAS : (FRASES[pagina] || FALLBACK);
  function nuevaFrase(anterior) {
    let f = alAzar(lista);
    for (let i = 0; i < 4 && f === anterior && lista.length > 1; i++) f = alAzar(lista);
    return f;
  }
  let fraseActual = nuevaFrase("");
  let ultimaOtra = "";
  // cada vez que se va a otra pestaña se elige una frase distinta a la anterior
  function otraPestana() {
    let f = alAzar(OTRA_PESTANA);
    if (f === ultimaOtra) f = alAzar(OTRA_PESTANA);
    ultimaOtra = f;
    return f;
  }

  const oyentes = new Set();
  let ultimo = [];
  let canal = null;

  function leer() {
    if (!canal) return [];
    const estado = canal.presenceState();
    return Object.entries(estado).map(([id, metas]) => {
      // si hay varias pestañas de la misma persona, vale la más reciente
      const m = metas.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || {};
      return { id, nombre: m.nombre || "alguien", frase: m.frase || "", oculto: !!m.oculto };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  function avisar() {
    ultimo = leer();
    oyentes.forEach(cb => { try { cb(ultimo); } catch (e) { /* un oyente roto no frena a los demás */ } });
  }

  window.Presencia = {
    /* cb(lista) con [{ id, nombre, frase, oculto }]; se llama al instante con lo último y en cada cambio. */
    suscribir(cb) { oyentes.add(cb); cb(ultimo); return () => oyentes.delete(cb); }
  };

  async function iniciar() {
    let sesion;
    try { sesion = await fichasSesionActual(); } catch (e) { return; }
    if (!sesion) return;
    const miId = sesion.user.id;
    // el nombre lo guarda lado.js en localStorage (se lee directo: esta página puede cargar antes que lado.js)
    let nombre = "";
    try { nombre = localStorage.getItem("compendioUsername") || ""; } catch (e) { /* sin almacenamiento */ }
    nombre = nombre || (sesion.user.email || "").split("@")[0] || "alguien";
    let supabase;
    try { supabase = await fichasCliente(); } catch (e) { return; }
    try {
      canal = supabase.channel("lobby-presencia", { config: { presence: { key: miId } } });
      canal.on("presence", { event: "sync" }, avisar);
      const anunciar = () => canal.track({
        nombre, ts: Date.now(),
        frase: document.hidden ? otraPestana() : fraseActual,
        oculto: document.hidden
      });
      // cada par de minutos en la misma página, una frase distinta
      setInterval(() => {
        if (document.hidden) return;
        fraseActual = nuevaFrase(fraseActual);
        try { anunciar(); } catch (e) { /* sin conexión */ }
      }, 150000);
      canal.subscribe(async estado => { if (estado === "SUBSCRIBED") await anunciar(); });
      document.addEventListener("visibilitychange", () => { try { anunciar(); } catch (e) { /* sin conexión */ } });
    } catch (e) { /* sin tiempo real: simplemente no hay presencia */ }
  }
  iniciar();
})();
