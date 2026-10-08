/* =============================================================================
   TRIUNFOS: guía del lobby. Es el único sitio donde se explican las reglas al jugador.
   Lo usan js/batalla-guia.js (el panel del lobby) y js/batalla.js (los textos cortos del
   inspector, campo "resumen" de cada palabra clave).

   Si cambias una regla en js/cartas-motor.js, cambia aquí su texto. `node tools/verificar-guia.js`
   comprueba que cada palabra clave y cada tipo de habilidad del motor tiene su entrada.

   palabras[].cartas   cartas con la palabra que el motor no puede deducir (estados, terrenos). Las que la
                       llevan en `palabras` de cartas-efectos.js se buscan solas.
   habilidades[].campo nombre del campo de cartas-efectos.js; con él se listan solas las cartas que lo usan
============================================================================= */
window.TRIUNFOS_GUIA = {
  /* ------------------------------------------------------------- cómo se juega */
  inicio: "Consigue cartas en el Álbum, arma tu mazo en Mazos y reta a otra persona desde este lobby. Con «Probar solo» juegas los dos lados en una pantalla, sin servidor.",
  pasos: [
    { titulo: "El objetivo", texto: "Gana quien deja al rival sin vida. Cada jugador empieza con 20 de vida. Si los dos llegan a 0 a la vez, es empate." },
    { titulo: "Tu mazo", texto: "Un mazo tiene entre 20 y 30 cartas. Cada personaje va una sola vez. De las demás cartas puedes poner copias según su rareza: 3 de las comunes y las infrecuentes, 2 de las raras y 1 de las legendarias." },
    { titulo: "Al empezar", texto: "Robas 5 cartas. Quien juega segundo roba una más. El primer jugador no roba en su primer turno." },
    { titulo: "Energía", texto: "La energía se gasta para jugar cartas. En tu primer turno tienes 1 y en cada turno propio sube 1, hasta un máximo de 10. Se rellena entera al empezar tu turno. Lo que te sobra sirve para reaccionar durante el turno del rival." },
    { titulo: "Tu turno", texto: "Robas una carta. Juegas las cartas que quieras pagando su coste, antes o después de atacar. Atacas una vez. Cuando termines, pulsas «Terminar turno»." },
    { titulo: "Jugar una carta", texto: "Pulsa una carta de tu mano para verla en el panel lateral y usa el botón «Jugar», o arrástrala al tablero. Una unidad puede ir a cualquier hueco libre de tu campo. Si la carta pide un objetivo, se resaltan los válidos y eliges uno." },
    { titulo: "Campo y mano", texto: "Tu campo tiene 6 huecos para unidades. Tu mano guarda hasta 8 cartas, y si robas con la mano llena, esa carta se pierde. Una unidad recién jugada no puede atacar hasta tu próximo turno." },
    { titulo: "Atacar", texto: "Atacas una sola vez por turno y declaras de golpe todas las unidades que atacan. Pulsa una unidad para prepararla, arrástrala a la franja de combate o usa «Todas». Después pulsa «Atacar». Las unidades Desafiantes pueden elegir a quién obligar a bloquear." },
    { titulo: "Reaccionar", texto: "En cuanto declaras un ataque, el rival puede jugar una reacción si tiene una que encaje y energía para pagarla. Si no, no hay espera." },
    { titulo: "Bloquear", texto: "El rival elige sus bloqueos. Cada una de sus unidades bloquea como mucho a un atacante, y cada atacante recibe como mucho un bloqueador. Se elige una unidad propia y luego al atacante, o se arrastra la unidad hasta él. En partidas en línea hay 45 segundos para bloquear y 20 para reaccionar. Al acabarse el tiempo se manda lo que ya estaba elegido." },
    { titulo: "Resolver el combate", texto: "Todo ocurre a la vez. Cada atacante y su bloqueador se hacen daño igual a su ataque. Los atacantes que nadie bloquea golpean al jugador rival. Una unidad sin vida cae al cementerio. Veloz cambia el orden, y Arrollar pasa el daño sobrante al jugador." },
    { titulo: "Terrenos", texto: "Solo hay un terreno en juego. Al jugar otro, reemplaza al anterior. Cambia las reglas del tablero. Algunos favorecen a quien lo juega y otros afectan a todas las unidades." },
    { titulo: "Sin cartas", texto: "Si te quedas sin cartas en el mazo, cada vez que debas robar recibes daño. Primero 1, luego 2, luego 3 y así sin parar." },
    { titulo: "Ayudas", texto: "Pasa el ratón por una carta o unidad para verla con todo su texto. Esc cancela lo que tengas seleccionado. En el tablero, las palabras clave de cada unidad salen bajo ella." }
  ],
  ejemplo: [
    "Es tu turno 4 y tienes 4 de energía. Robas una carta.",
    "Juegas a Hornet por 3. Su habilidad al entrar te deja elegir una unidad enemiga, que recibe 1 de daño. Hornet no puede atacar este turno.",
    "Te queda 1 de energía. La guardas por si el rival ataca y tienes una reacción barata.",
    "Declaras un ataque con las dos unidades que ya estaban en tu campo. El rival bloquea a una con su unidad más fuerte.",
    "Las dos se hacen daño a la vez. La otra atacante nadie la bloqueó, así que golpea al jugador rival.",
    "Pulsas «Terminar turno» y empieza el del rival."
  ],

  /* ---------------------------------------------------------- palabras clave */
  palabras: [
    { id: "desafiante", nombre: "Desafiante",
      resumen: "Al atacar, elige qué unidad enemiga debe bloquearla, aunque vuele o no pueda bloquear. Respeta Provocar.",
      detalle: [
        "Al declarar el ataque, una unidad Desafiante puede escoger a una unidad enemiga. Esa unidad queda obligada a bloquearla y no puede bloquear a ningún otro atacante.",
        "Un desafío pasa por encima de Volar y de No bloquea.",
        "Respeta Provocar. Si el rival tiene alguna unidad con Provocar, el desafío tiene que apuntar a una de ellas. Hay dos excepciones, una unidad Marcada por quien ataca y el Puente de las Legiones de quien ataca.",
        "Una unidad solo puede ser desafiada por un atacante, y no se puede desafiar a una unidad Escurridiza.",
        "Si una reacción saca del combate a quien desafía, la unidad desafiada queda libre."
      ], tambien: ["fauces-grises"] },
    { id: "provocar", nombre: "Provocar",
      resumen: "Los desafíos enemigos deben apuntar a una unidad con Provocar antes que a otras.",
      detalle: [
        "Regla propia de Triunfos. Mientras controles una unidad con Provocar, los desafíos del rival solo pueden apuntar a las unidades que tengan Provocar.",
        "No obliga a nadie a bloquear y no protege al jugador. Solo limita a quién se puede desafiar.",
        "Se ignora contra una unidad Marcada por quien ataca y con el Puente de las Legiones. El Arpón de Garra se la quita a una unidad durante un tiempo."
      ], tambien: ["garra", "puente-de-las-legiones"] },
    { id: "volar", nombre: "Volar",
      resumen: "Solo la bloquean unidades que también vuelan.",
      detalle: [
        "Cuando una unidad que vuela ataca, solo la pueden bloquear unidades que también vuelan. Una unidad que vuela puede bloquear a cualquier atacante.",
        "Un desafío puede obligar a bloquear a una unidad que no vuela. Así se bajan las voladoras.",
        "Se puede perder durante un tiempo, como con el Arpón de Garra."
      ], tambien: ["los-huesos", "garra"] },
    { id: "temible", nombre: "Temible",
      resumen: "No la bloquean unidades con menos de 3 de ataque.",
      detalle: [
        "Cuando una unidad Temible ataca, no la pueden bloquear las unidades con menos de 3 de ataque.",
        "Cuenta el ataque que tengan en ese momento, con sus bonificaciones. Ninguna carta la tiene por ahora."
      ] },
    { id: "veloz", nombre: "Veloz",
      resumen: "En combate golpea antes; si mata a su rival, no recibe daño.",
      detalle: [
        "En combate golpea antes que su rival. Si lo mata con ese golpe, no recibe el daño de vuelta.",
        "Si las dos unidades son Veloz, o ninguna, golpean a la vez. Vale al atacar y al bloquear."
      ] },
    { id: "arrollar", nombre: "Arrollar",
      resumen: "El daño que sobra al matar a su bloqueador pasa al jugador.",
      detalle: [
        "Cuando ataca y mata a su bloqueador, el daño que sobra pasa al jugador rival. Sobra su ataque menos la vida que tenía el bloqueador.",
        "Solo vale al atacar. Cuenta como golpear al jugador para las habilidades que se activan con eso."
      ] },
    { id: "duro", nombre: "Duro",
      resumen: "Recibe 1 menos de daño.",
      detalle: [
        "Cada golpe que recibe hace 1 menos de daño, con un mínimo de 0. Vale para el daño de combate, de habilidades y de terrenos."
      ] },
    { id: "esquivo", nombre: "Esquivo",
      resumen: "En combate recibe la mitad del daño (redondeado hacia abajo).",
      detalle: [
        "En combate recibe la mitad del daño, redondeado hacia abajo. Un golpe de 1 se esquiva del todo.",
        "No afecta al daño de habilidades ni de terrenos."
      ] },
    { id: "noBloquea", nombre: "No bloquea",
      resumen: "No puede bloquear.",
      detalle: [
        "No puede bloquear a nadie. Un desafío sí puede obligarla a bloquear.",
        "También aparece como estado temporal en una unidad que no puede bloquear hasta cierto momento."
      ] },
    { id: "barrera", nombre: "Barrera", estado: true,
      resumen: "Ignora el primer daño que reciba.",
      detalle: [
        "Estado de una unidad, no una palabra fija de la carta. Ignora por completo el primer daño que reciba, sea de combate, de habilidad o de terreno. Después se rompe.",
        "No se renueva. Dura hasta que se rompe."
      ], cartas: ["darian"] },
    { id: "escurridizo", nombre: "Escurridizo", estado: true,
      resumen: "Los desafíos y las habilidades enemigas no pueden elegirla. Si bloquea o la bloquean, recibe daño normal.",
      detalle: [
        "Regla propia de Triunfos. Ni los desafíos ni las habilidades enemigas pueden elegirla. Tampoco los objetos o reacciones enemigos que apuntan a una unidad.",
        "No es invulnerable. Si bloquea o la bloquean, recibe el daño normal, y los efectos que no apuntan a nadie, como los de los terrenos, la alcanzan.",
        "Puede ser temporal, hasta el final de un turno, o depender de algo, como en Cassius mientras tengas otra unidad."
      ], cartas: ["mattei", "cassius-coldgrave", "felino-veloz-mistico", "capa-reversible"] },
    { id: "marcada", nombre: "Marcada", estado: true,
      resumen: "Es Vulnerable para las unidades de quien la marcó: cualquiera puede obligarla a bloquear, ignorando Provocar, y le hacen 2 de daño extra en combate.",
      detalle: [
        "Estado de una unidad. Una unidad Marcada es Vulnerable para quien la marcó.",
        "Cualquier unidad de quien la marcó puede desafiarla al atacar, aunque no sea Desafiante y aunque haya Provocar. Una unidad Escurridiza no se puede desafiar.",
        "Además, las unidades de quien la marcó le hacen 2 de daño extra en combate.",
        "La marca puede durar para siempre, como la de Verdam, o hasta el final de un turno, como la de Victor."
      ], cartas: ["verdam", "victor"] }
  ],

  /* ---------------------------------------------------- tipos de habilidad */
  habilidades: [
    { id: "palabra", nombre: "Palabra clave", campo: "palabras",
      resumen: "Una regla fija que la carta resume en una palabra.",
      detalle: ["Siempre está activa mientras la unidad esté en el campo. En la pestaña Palabras clave está cada una."] },
    { id: "pasiva", nombre: "Pasiva", campo: "pasivaAtq",
      resumen: "Un efecto siempre activo mientras la carta esté en el campo.",
      detalle: ["No se activa en un momento concreto y no cuesta nada. Cambia los números de la propia unidad, por ejemplo Rook gana +2 de ataque si es tu única unidad."] },
    { id: "aura", nombre: "Aura", campo: "auraAtq",
      resumen: "Una pasiva que mejora a tus otras unidades.",
      detalle: ["No se aplica a quien la tiene. Deja de valer cuando esa unidad cae."] },
    { id: "bonusCombate", nombre: "Bonificación de combate", campo: "bonusAtaque",
      resumen: "Daño extra solo cuando la unidad pelea contra otra unidad.",
      detalle: ["Vale al atacar y al bloquear. No suma cuando el golpe va al jugador, porque ahí no hay unidad rival."] },
    { id: "golpeExacto", nombre: "Golpe exacto", campo: "golpeExacto",
      resumen: "En combate contra una unidad, hace tanto daño como vida tenga esa unidad.",
      detalle: [
        "El daño es la vida exacta que tiene la unidad rival cuando empieza el combate. Ni el ataque de la carta ni las bonificaciones de daño cuentan. Vale al atacar y al bloquear.",
        "No ignora resistencias. Barrera, Duro, Esquivo, la reducción de daño y los guardianes actúan como con cualquier golpe de combate, así que una unidad resistente puede sobrevivir.",
        "Contra el jugador pega con su ataque normal. La unidad sigue recibiendo el daño de su rival, a la vez."
      ] },
    { id: "reduccion", nombre: "Reducción de daño", campo: "reduceDano",
      resumen: "Resta daño de cada golpe que recibe.",
      detalle: ["Se aplica después de Esquivo y de Duro, con un mínimo de 0."] },
    { id: "guardian", nombre: "Guardián", campo: "guardian",
      resumen: "Recibe en lugar de una unidad aliada el golpe que esta fuera a recibir.",
      detalle: ["Protege a las demás unidades de su dueño, no a sí mismo. Cada guardián tiene su límite. Ocevat actúa una vez por turno y Amarillo una sola vez en toda la partida."] },
    { id: "alEntrar", nombre: "Al entrar", campo: "alEntrar",
      resumen: "Se activa cuando juegas la carta desde tu mano.",
      detalle: [
        "Muchas piden un objetivo. Si hay objetivos válidos tienes que elegir uno. Si no hay ninguno, la unidad entra sin activarla.",
        "No se activa si la unidad llega al campo de otra forma, por ejemplo al volver con Sales aromáticas o con el Pozo de la Eternidad, o como parte de otra habilidad.",
        "La Torre del Silencio las apaga y la Montaña del Eco Arcano las repite."
      ] },
    { id: "alEntrarAliada", nombre: "Cuando entra una aliada", campo: "alEntrarAliada",
      resumen: "Se activa cada vez que otra unidad tuya llega al campo.",
      detalle: ["Cuenta cualquier forma de llegar, sea jugada desde la mano, devuelta del cementerio o creada por una habilidad."] },
    { id: "alMorir", nombre: "Al morir", campo: "alMorir",
      resumen: "Se activa cuando la unidad cae.",
      detalle: ["Vale si cae por combate, por una habilidad o por un terreno."] },
    { id: "alMatar", nombre: "Al matar", campo: "alMatar",
      resumen: "Se activa cuando la unidad destruye a otra en combate.",
      detalle: ["Solo cuenta el daño de combate, no el de las habilidades."] },
    { id: "alRecibirDano", nombre: "Al recibir daño", campo: "alRecibirDano",
      resumen: "Se activa cuando la unidad recibe daño y sobrevive.",
      detalle: ["Si el daño la mata, se activa Al morir en su lugar."] },
    { id: "alInicioTurno", nombre: "Al inicio del turno", campo: "alInicioTurno",
      resumen: "Se activa al empezar tu turno.",
      detalle: ["Ocurre después de robar y antes de que puedas jugar nada."] },
    { id: "alGolpearJugador", nombre: "Al golpear al jugador", campo: "alAtacarJugador",
      resumen: "Se activa cuando la unidad golpea al jugador rival.",
      detalle: ["Pasa cuando nadie bloquea a la unidad que ataca, o con el daño sobrante de Arrollar."] },
    { id: "objeto", nombre: "Objeto o acción", campo: "jugar",
      resumen: "Se juega desde la mano, hace su efecto y va al cementerio.",
      detalle: [
        "Si pide un objetivo, lo eliges al jugarlo.",
        "Un objeto que apunta a una unidad enemiga no puede elegir unidades Escurridizas ni con Capucha oscura, igual que una habilidad."
      ] },
    { id: "equipo", nombre: "Equipo", ejemplos: ["escudo-reforzado", "capucha-oscura"],
      resumen: "Un objeto que se queda pegado a una unidad aliada.",
      detalle: ["Dura mientras la unidad siga en el campo. Si la unidad cae, el equipo se pierde con ella."] },
    { id: "reaccion", nombre: "Reacción", campo: "reaccion",
      resumen: "Se juega en el turno del rival, como respuesta a lo que hace.",
      detalle: [
        "Se paga con la energía que te sobró. Hay dos momentos. Cuando el rival declara un ataque, antes de elegir los bloqueos. Y cuando el rival juega una carta, antes de que haga efecto.",
        "Algunas piden elegir a una unidad atacante, y otras pueden cancelar una carta.",
        "Si no tienes una reacción que encaje y que puedas pagar, el juego no espera. En partidas en línea hay 20 segundos para decidir."
      ] },
    { id: "terreno", nombre: "Terreno", campo: "terreno",
      resumen: "Cambia las reglas del tablero mientras está en juego.",
      detalle: [
        "Solo hay uno a la vez. Jugar otro reemplaza al anterior, sea de quien sea.",
        "Algunos duran un número de turnos. El turno en que lo juegas cuenta como el primero, y cuentan los turnos de los dos jugadores. Los demás duran hasta que entra otro.",
        "Algunos favorecen solo a quien los jugó, como Los Huesos o Fauces Grises. Otros, como La Cueva de Carne, afectan a todas las unidades.",
        "El tablero cambia de ambiente mientras el terreno está en juego."
      ] },
    { id: "temporal", nombre: "Efecto temporal", ejemplos: ["torvrena", "ryn", "veneno-debil"],
      resumen: "Dura hasta el final de un turno. Mira «Hasta el final de» en el glosario.",
      detalle: ["Las bonificaciones, las marcas y las restricciones suelen decir «este turno», «el próximo turno del rival» o «tu próximo turno». El glosario explica cuánto dura cada una."] }
  ],

  /* ---------------------------------------------------------- tipos de carta */
  tipos: [
    { nombre: "Personaje", texto: "Una unidad con ataque y vida, basada en una persona del compendio. Va una sola vez por mazo." },
    { nombre: "Criatura", texto: "Una unidad con ataque y vida, basada en el bestiario. Se pueden repetir según su rareza." },
    { nombre: "Entidad", texto: "Una unidad que no es persona ni criatura. Funciona igual que las demás unidades." },
    { nombre: "Objeto", texto: "Se juega, hace su efecto y va al cementerio. Algunos se quedan pegados a una unidad como equipo." },
    { nombre: "Acción", texto: "Funciona como un objeto. Se juega, hace su efecto y va al cementerio." },
    { nombre: "Reacción", texto: "Se juega en el turno del rival, como respuesta. Usa la energía que te sobró." },
    { nombre: "Terreno", texto: "Cambia las reglas del tablero. Solo hay uno en juego a la vez." }
  ],
  lados: "Cada jugador pertenece al lado A o al lado B. Un jugador no ve ni recibe las cartas del lado contrario. Las cartas sin lado las ven todos.",
  rarezas: "La rareza dice lo difícil que es conseguir una carta, no lo fuerte que es. Sirve para limitar cuántas copias caben en un mazo.",

  /* --------------------------------------------------------------- glosario */
  glosario: [
    { termino: "Afinidad", definicion: "La escuela de una carta. Algunos terrenos, objetos y personajes premian a una afinidad concreta, por ejemplo curando más a las de Carne." },
    { termino: "Ataque", definicion: "El daño que hace una unidad al pelear. Una unidad con 0 de ataque no puede atacar." },
    { termino: "Bloquear", definicion: "Ponerse delante de un atacante para que el golpe vaya contra la unidad y no contra el jugador. Cada unidad bloquea a un solo atacante y cada atacante recibe un solo bloqueador." },
    { termino: "Bonificación temporal", definicion: "Un cambio de ataque y vida que dura hasta el final de un turno. Sube la vida máxima y la actual. Al acabarse, la vida baja hasta el nuevo máximo, pero nunca queda por debajo de 1." },
    { termino: "Campo", definicion: "Los 6 huecos donde van tus unidades. Puedes jugar una unidad en cualquier hueco libre. Los ataques se resuelven de izquierda a derecha según el hueco." },
    { termino: "Carta revelada", definicion: "Cuando una carta te deja mirar la siguiente de tu mazo, esa carta se muestra boca arriba en la pila hasta que la robes." },
    { termino: "Cementerio", definicion: "Donde van las unidades que caen y las cartas ya jugadas. Algunas cartas lo usan, como Sales aromáticas." },
    { termino: "Combate", definicion: "Lo que ocurre cuando atacas. Tiene cuatro pasos. Declarar los atacantes, reaccionar, elegir los bloqueos y resolver." },
    { termino: "Coste", definicion: "La energía que hay que pagar para jugar una carta. Algunos efectos lo bajan, como El Cráter para las de Arcano." },
    { termino: "Curar", definicion: "Devolver vida. Una unidad no pasa de su vida máxima y un jugador no pasa de 20. El Desierto de Cenizas impide curar." },
    { termino: "Daño", definicion: "Puede venir del combate, de una habilidad, de un terreno o de la fatiga. Barrera y Duro valen contra cualquier fuente de daño a unidades. Esquivo solo contra el combate. La Catedral del Juramento impide que las habilidades maten unidades, que quedan con 1 de vida." },
    { termino: "Declarar un ataque", definicion: "Elegir a la vez todas las unidades que atacan este turno y, si se puede, a quién desafían. Solo se hace una vez por turno." },
    { termino: "Descarte", definicion: "Perder una carta de la mano sin jugarla. Pasa si robas con la mano llena o por habilidades como la de Voss." },
    { termino: "Desafío", definicion: "Una unidad Desafiante, o cualquiera contra una unidad Marcada, elige a una unidad enemiga que queda obligada a bloquearla. Mira Desafiante y Provocar." },
    { termino: "Empate", definicion: "Si la vida de los dos jugadores llega a 0 en el mismo golpe, la partida termina sin ganador." },
    { termino: "Energía", definicion: "Lo que se gasta para jugar cartas. La máxima sube 1 en cada turno propio, hasta 10, y se rellena al empezar el turno. La que no gastas queda para reaccionar." },
    { termino: "Fatiga", definicion: "Daño que recibes si debes robar y no te quedan cartas. Empieza en 1 y sube 1 cada vez." },
    { termino: "Ficha", definicion: "Una unidad que no viene de una carta, como el Centinela o los restos de Ledros. Sales aromáticas y el Pozo de la Eternidad no las devuelven." },
    { termino: "Hasta el final de…", definicion: "Cada jugador tiene su turno, y el contador de la partida suma los de los dos. «Este turno» termina cuando acaba el turno en curso. «El próximo turno del rival» es el que viene justo después. «Tu próximo turno» es el siguiente tuyo. «Hasta el final del próximo turno de su dueño» dura hasta que acaba el siguiente turno del jugador que controla esa unidad." },
    { termino: "Hueco", definicion: "Cada una de las 6 casillas del campo. Una unidad ocupa un hueco mientras está en juego." },
    { termino: "Lado", definicion: "El bando del jugador, A o B. Decide qué cartas ve y recibe." },
    { termino: "Mano", definicion: "Las cartas que tienes para jugar. Caben 8." },
    { termino: "Mazo", definicion: "Las cartas que te quedan por robar, en orden desconocido. Un mazo tiene entre 20 y 30 cartas." },
    { termino: "Objetivo", definicion: "Lo que una carta pide elegir. Se resaltan los válidos. Una unidad Escurridiza o con Capucha oscura no es válida frente a efectos enemigos, y bajo el Vado Ceniza ninguna habilidad puede elegir unidades." },
    { termino: "Rareza", definicion: "Lo difícil que es conseguir una carta. Limita las copias por mazo, no marca su fuerza." },
    { termino: "Turno", definicion: "Lo que juega un jugador antes de pasar al otro. Se roba, se juega, se ataca y se termina. Al empezar el tuyo se rellena la energía y se activan los efectos de inicio de turno." },
    { termino: "Unidad", definicion: "Cualquier carta con ataque y vida que está en el campo. Pueden ser personajes, criaturas o entidades." },
    { termino: "Vida", definicion: "Lo que le queda a una unidad o a un jugador. Una unidad cae cuando llega a 0. Un jugador empieza con 20 y pierde al llegar a 0." },
    { termino: "Vulnerable", definicion: "Estado de una unidad Marcada frente a quien la marcó. Mira Marcada." }
  ]
};
