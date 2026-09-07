/* =============================================================================
   DIÁLOGO DEL BUFÓN — árbol de nodos ramificado.

   Formato de un nodo (window.BUFON_DIALOGO.nodos[id]):
     lineas: array de strings, una por pantalla (se avanza con "seguir").
       Usar "..." como línea propia donde tenga sentido un silencio.
     eleccion: (opcional) id de un punto de elección en BUFON_DIALOGO.elecciones
       que se muestra apenas terminan las líneas.
     next: (opcional, si no hay "eleccion") id del próximo nodo, o una
       función () => id que decide dinámicamente según el historial del
       jugador (ver hasPreviousChoice/requiresChoice en el motor).

   Formato de un punto de elección (window.BUFON_DIALOGO.elecciones[id]):
     opciones: array de { id, texto, next }, donde "next" es el id del
       próximo nodo (o una función () => id, igual que arriba).

   Cada opción guarda choice_id (no solo el texto) en Supabase, así que
   renombrar el texto visible más adelante no rompe nada. El id del punto
   de elección se guarda como dialogue_id.
============================================================================= */
window.BUFON_DIALOGO = {
  inicio: "intro_01",

  /* =========================================================================
     VOZ DEL BUFÓN (revisión completa) — confiado, conversador, disfruta
     hablar. Habla como si todo, incluso lo metafísico, fuera charla de
     sobremesa. Regla central:

       "El Bufón normalmente llena el silencio. Cuando se calla, debe haber
       una razón."

     "..." reservado para: se da cuenta de que mezcló Side A/B, dijo algo
     que no debía, una respuesta del jugador genuinamente lo desconcierta,
     percibe algo de fuera del mundo, reconsidera un recuerdo, o un
     silencio puntual mejora un remate. En cualquier otro lado, no.

     Cuando recuerda mal algo, no dice "creo que quizá..." — afirma la
     versión equivocada con la misma confianza que la correcta, y si el
     jugador lo corrige, reacciona como alguien al que le señalaron un
     error curioso, no como alguien avergonzado.
  ========================================================================= */
  nodos: {
    intro_01: {
      lineas: [
        "Hola.",
        '¿Qué tal? Ah, espera, no. Antes que nada: no le digas a nadie que estoy acá.',
        "No por nada grave. Es más una cuestión de principios. Y porque me conviene.",
        "Tus amigos tampoco, eh. Sobre todo tus amigos.",
        'Aunque bueno, técnicamente "Él" ya sabe. Él siempre sabe esas cosas. Es bastante irritante, si te soy sincero.',
        "Pero que Él sepa que estoy acá y que tú me hayas encontrado son dos cosas completamente distintas. Pienso aferrarme a esa distinción con todas mis fuerzas.",
        "En fin. ¿Qué haces tú acá?"
      ],
      animacion: "Pofavor",
      // Único punto donde se decide si corresponde ofrecer nombre antes
      // del hub — intro_01 es en sí mismo "primera visita" (solo se
      // corre una vez en la vida real del navegador), así que no hace
      // falta re-chequear eso acá, solo si ya hay nombre/oferta previa.
      next: ctx => (debeOfrecerRegistro(ctx) ? "bufon_oferta_registro" : "intro_reason")
    },

    resp_exploring: {
      lineas: [
        "Ah. Un curioso.",
        "Excelente idea, la exploración. Funciona perfectamente hasta que encuentras algo. Después todo el mundo actúa como si encontrarlo hubiera sido un error."
      ],
      completeDialogue: "exploring",
      animacion: "Apuntando",
      next: "intro_reason"
    },

    resp_searching: {
      lineas: [
        "¿Algo? Qué específico.",
        "Ojalá lo reconozcas cuando lo tengas enfrente. Sería medio trágico pasar justo al lado sin darte cuenta."
      ],
      completeDialogue: "searching",
      next: "intro_reason"
    },

    resp_lost: {
      lineas: [
        "Ja. Entonces somos dos.",
        "Yo llevo perdido bastante más tiempo que tú, para que sepas."
      ],
      completeDialogue: "lost",
      animacion: "Auch",
      next: "intro_reason"
    },

    // Etapa 1 de "¿Quién es 'Él'?" — tema evolutivo, no permanente.
    // completeDialogue queda por etapa (who_is_he_stage_1) para que la
    // elección del hub sepa a qué etapa saltar la próxima vez;
    // consumeEncounter es el que hace que la opción desaparezca del menú
    // solo durante esta visita.
    resp_who_1: {
      lineas: [
        "Ah, ya empezamos con ésa.",
        "No. Todavía no.",
        "Pregúntame otra cosa. Tienes un montón de opciones y fuiste directo a la que no pienso responder."
      ],
      completeDialogue: "who_is_he_stage_1",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },
    // Misma negativa, pero para cuando "who_is_he" es lo único que le
    // queda al hub: decirle "tienes un montón de opciones" sería mentira,
    // así que en vez de fingir que las hay, lo reconoce y se lo pasa por
    // encima con la misma confianza de siempre.
    resp_who_1_unica: {
      lineas: [
        "Ah, se te acabaron las otras preguntas.",
        "No importa. Sigue sin ser el momento.",
        "Vuelve cuando tengas algo nuevo que preguntar. Yo, mientras tanto, sigo teniendo cosas que no pienso contarte."
      ],
      completeDialogue: "who_is_he_stage_1",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },

    resp_who_2: {
      lineas: ["Sabes quién."],
      eleccion: "who_confirm"
    },

    resp_who_confirmed: {
      lineas: ["Entonces no hace falta que lo diga yo. Mejor. Prefiero no ser yo quien lo diga en voz alta."],
      completeDialogue: "who_is_he_stage_2",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },
    // Único silencio real de esta rama: la respuesta lo desconcierta de
    // verdad — venía con una premisa (que el jugador sabe) y se la
    // rompieron.
    resp_who_denied: {
      lineas: ["...", "Eso es raro.", "No sé por qué, pero no me lo esperaba."],
      completeDialogue: "who_is_he_stage_2",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },

    resp_why_hide: {
      lineas: ["Porque ahí sabrían que hablaste conmigo. Y eso complica cosas que preferiría mantener simples."],
      eleccion: "why_hide_followup"
    },

    resp_what_wrong: {
      lineas: [
        "Nada. Aunque ahora que lo pienso, tengo curiosidad.",
        "¿Confías en ellos?"
      ],
      eleccion: "trust_friends"
    },

    resp_trust_yes: {
      lineas: ["Qué bien.", "Confiar en la gente hace todo mucho más fácil, hasta que deja de hacerlo. Para entonces, claro, ya tienes problemas más interesantes."],
      completeDialogue: "why_hide",
      animacion: "Celebrar",
      next: "intro_reason"
    },
    resp_trust_no: {
      lineas: ["¿En serio? ¿Y entonces por qué sigues con ellos?"],
      completeDialogue: "why_hide",
      next: "intro_reason"
    },
    resp_trust_unsure: {
      lineas: ['Ésa es bastante más honesta que un "sí". La gente usa esa palabra con demasiada facilidad.'],
      completeDialogue: "why_hide",
      next: "intro_reason"
    },

    resp_what_doing: {
      lineas: ["Esperando."],
      animacion: "Parado",
      eleccion: "what_doing_followup"
    },

    resp_waiting_what: {
      lineas: ["Que hicieras exactamente esa pregunta. Tenía fe en ti."],
      completeDialogue: "what_doing",
      next: "intro_reason"
    },

    /* =====================================================================
       DESPEDIDA — se dispara sola cuando el hub ("intro_reason") no tiene
       ningún tema visible (ver renderEleccion en secreto.html). "¿Qué
       tiempo?" vive DENTRO de esta secuencia, no como tema nuevo del hub:
       si apareciera como opción normal contradiría el propio "no queda
       nada de qué hablar".

       bufon_despedida_que_tiempo ya no es un final plano: tiene su propio
       punto de elección (despedida_que_significa) para que, cuando el
       jugador insiste en qué significa "nuestro tiempo", el Bufón —que
       hasta acá tuvo una respuesta lista para todo— se quede sin una.
       Ese es el silencio que importa de toda esta secuencia.
    ===================================================================== */
    bufon_despedida: {
      lineas: ["Bueno. Se nos acabó el tiempo.", "No me preguntes quién decide eso, yo estaba bastante cómodo."],
      animacion: "Cariñito",
      completeDialogue: "goodbye_ever",
      eleccion: "despedida_opciones"
    },
    bufon_despedida_que_tiempo: {
      lineas: ["El nuestro."],
      eleccion: "despedida_que_significa"
    },
    bufon_despedida_fin: {
      lineas: ["...", "Buena pregunta.", "Nos vemos."]
    },
    bufon_despedida_cierre: {
      lineas: ["Nos vemos en algún momento. No sé cuándo, pero nos vemos.", "No te olvides de visitarme.", "Jeje."],
      animacion: "Riendosesentao"
    },

    /* =====================================================================
       NOMBRE OPCIONAL — se ofrece una sola vez, al final de intro_01 (ver
       su "next" dinámico), nunca como tema del hub. No es una cuenta: no
       hay contraseña ni sesión, solo una etiqueta sobre el mismo
       jester_player_id anónimo de siempre.
    ===================================================================== */
    bufon_oferta_registro: {
      lineas: [
        "Ah, antes de seguir.",
        "No sé quién eres.",
        "No, espera. Sí sé quién eres.",
        "El problema es que no tengo dónde guardar tu nombre.",
        "Si quieres, podemos arreglarlo."
      ],
      completeDialogue: "registro_ofrecido",
      eleccion: "oferta_registro_opciones"
    },
    bufon_registro_exitoso: {
      lineas: ["Ahí está.", "Mucho mejor.", "Ahora cuando vuelvas puedo fingir que me acuerdo de ti."],
      next: "intro_reason"
    },
    bufon_registro_rechazado: {
      lineas: ["Está bien.", "Los nombres tampoco hacen tanto.", "Si vuelves y no te reconozco, diremos que fue culpa tuya."],
      next: "intro_reason"
    },

    /* =====================================================================
       REGRESO TEMPRANO — tema evolutivo (ver elegirEarlyReturn en
       secreto.html), se dispara cuando el jugador ya se despidió una vez
       y vuelve sin que haya nada nuevo. early_return_01 es la primera
       etapa; agregar early_return_02 más adelante es sumar un nodo +
       una línea en el dispatcher, no rehacer nada de esto.
    ===================================================================== */
    early_return_01: {
      lineas: [
        "¿Otra vez tú?",
        "Me vas a hacer sentir importante.",
        "Todavía no tengo nada nuevo, eso sí. Falta que me encuentre más gente. Necesito más ojos.",
        "No pongas esa cara, tiene sentido.",
        "Tú me miras y ves una cosa. Otro me encuentra y ve otra. Ninguno necesita hablar con el otro para que ya existan dos versiones distintas de mí.",
        "Si aparecen diez, ya tengo diez.",
        "Y cuando suficientes ojos se quedan con una versión tuya, empieza a ser difícil decidir cuál tiene más derecho a llamarse la verdadera.",
        "Uno se pasa años intentando averiguar quién es y resulta que los demás llevan todo ese tiempo haciéndolo por él.",
        "Sin preguntar, además.",
        "Odio a la gente que saca conclusiones precipitadas."
      ],
      eleccion: "early_return_01_opciones"
    },
    early_return_reaction_yo_mismo: {
      lineas: [
        "¿Sí?",
        "Qué respuesta más cómoda.",
        "Tú dices una cosa. Tus amigos otra. Tus enemigos seguramente tienen una versión bastante menos generosa.",
        "Alguien puede conocerte diez minutos, recordarte durante veinte años y construirte entero a partir de eso.",
        "Todas esas versiones hicieron algo. Dejaron algo.",
        "¿Por qué la tuya tiene prioridad?",
        "Porque vive dentro de tu cabeza no cuenta. Tú eres juez y parte."
      ],
      completeDialogue: "early_return_stage_1",
      consumeEncounter: "early_return",
      next: "intro_reason"
    },
    early_return_reaction_no_conocen: {
      lineas: ["Puede ser.", "Aunque tú tampoco puedes verte desde fuera.", "Siempre me pareció una falla de diseño bastante importante."],
      completeDialogue: "early_return_stage_1",
      consumeEncounter: "early_return",
      next: "intro_reason"
    },
    early_return_reaction_cual_real: {
      lineas: [
        "Todas.",
        "Sería bastante arrogante decirle a cien personas que noventa y nueve entendieron mal.",
        "Aunque sí, suena exactamente como algo que yo haría.",
        "Así que no sé. Pregúntame cuando seamos más."
      ],
      completeDialogue: "early_return_stage_1",
      consumeEncounter: "early_return",
      next: "intro_reason"
    },
    early_return_reaction_secreto: {
      lineas: ["Y no les cuentes.", "No necesito que hablen entre ustedes.", "Sólo necesito que miren.", "Encontrarme y que me traigan gente son cosas muy distintas."],
      completeDialogue: "early_return_stage_1",
      consumeEncounter: "early_return",
      next: "intro_reason"
    },
    early_return_reaction_saludo: {
      lineas: [
        "Ah.",
        "Bueno, eso cambia bastante las cosas.",
        'Yo acá hablando y hablando sobre una cosa tan insignificante como el "ser" y tú sólo venías a saludar.',
        "...",
        "Gracias."
      ],
      completeDialogue: "early_return_stage_1",
      consumeEncounter: "early_return",
      next: "intro_reason"
    },
    bufon_retorno_generico: {
      lineas: [
        "Sigues llegando antes.",
        "No ha pasado nada nuevo.",
        "Bueno, nada que pueda contarte.",
        "Vuelve después.",
        "Si tengo suerte, para entonces ya habrá más gente mirando."
      ]
    },

    /* =====================================================================
       RECUERDOS ESPONTÁNEOS — el Bufón los trae él mismo (ver
       RECUERDOS_DISPONIBLES en secreto.html), nunca son preguntas que el
       jugador elige del menú. Cada uno sigue el mismo patrón: recuerdo
       vago → detalle incompleto o levemente equivocado → elección real
       (guardada como choice_id en data/bufon-evidencia.js) → reacción.
       Todas las reacciones vuelven a "intro_reason_sin_recuerdo", no a
       "intro_reason", para no encadenar un segundo recuerdo de inmediato.
    ===================================================================== */

    // memoryGroup: pet_rescue
    bufon_pet_rescue: {
      lineas: ["¿Todavía anda contigo el pequeño?"],
      animacion: "Cariñito",
      eleccion: "pet_rescue_check1"
    },
    bufon_pet_rescue_2: {
      lineas: ["Me caía bien.", "Nunca entendí bien qué tipo de animal era, la verdad."],
      eleccion: "pet_rescue"
    },
    bufon_pet_reaction_a: {
      lineas: ["Bestia Trémula. Ahí está, ese es el nombre que se me escapaba. Con razón suena inventado."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_b: {
      lineas: ["Ah, el que picoteaba todo. Se me cruzan los bichos con plumas."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_cat: {
      lineas: ["Un gato. Claro, eso lo explica todo, por qué lo dejan hacer lo que quiere, por qué nadie se queja."],
      animacion: "Riendosesentao",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_0: {
      lineas: ["Tampoco es que necesite entenderlo del todo. Lo mío es más catalogar que comprender."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: gareth_relationship
    bufon_gareth: {
      lineas: [
        "Gareth.",
        "Nunca me acuerdo quién le debía un favor a quién con ese tipo. Ustedes a él, él a ustedes... alguien quedó endeudado y, por alguna razón, mi cabeza decidió archivar todo menos la parte útil."
      ],
      eleccion: "gareth_relationship"
    },
    bufon_gareth_reaction_a: {
      lineas: ["Eso pensé. Bien, entonces no estoy tan mal de la cabeza como pensaba."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_gareth_reaction_b: {
      lineas: ["Ah. Entonces mezclé ésa también.", "Bien saber. Ahora tengo que revisar qué más mezclé. Pero bueno, un problema a la vez."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_gareth_reaction_0: {
      lineas: ["Era sobre un tipo al que probablemente no conoces. O sí, y simplemente no te gusta hablar de él. Las dos teorías me convencen por igual."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: dragon_first_wound
    bufon_dragon_wound: {
      lineas: [
        "La primera vez que lograron herir a esa cosa fue bastante ridícula, para que sepas.",
        'No en el sentido de "qué gesta heroica". En el sentido de "no puedo creer que haya funcionado".'
      ],
      animacion: "Boxing",
      eleccion: "dragon_wound_check1"
    },
    bufon_dragon_wound_2: {
      lineas: ["Bueno.", "Lo que se les ocurrió no era exactamente un plan digno de un monumento. Pero funcionó, a su manera."],
      eleccion: "dragon_first_wound"
    },
    bufon_dragon_reaction_a: {
      lineas: ["Ah, sí. Ahora encaja."],
      eleccion: "dragon_wound_followup"
    },
    bufon_dragon_reaction_b: {
      lineas: [
        "Una balista. Bien, mucho más sensato que lo que yo tenía en mente.",
        { voz: "testigo", texto: "No fue cualquier balista. Apuntaron al ojo, no al cuello. Eso es lo que hizo que funcionara." }
      ],
      eleccion: "dragon_wound_followup"
    },
    bufon_dragon_reaction_nada: {
      lineas: ["Nada importante. Sigue con tu vida."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_dragon_reaction_0: {
      lineas: ["Puede ser. O me lo inventé. A esta altura ya no llevo la cuenta."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: post_refuge_decision
    bufon_post_refuge: {
      lineas: ["Después de esa noche se complicó todo bastante, ¿no? Como que arrancaron mal la semana."],
      eleccion: "post_refuge_check1"
    },
    bufon_post_refuge_2: {
      lineas: ["Todavía no sé bien cómo les fue después de esa noche. Sospecho que no del todo bien, pero es solo una sospecha."],
      eleccion: "post_refuge_decision"
    },
    bufon_refuge_reaction_a: {
      lineas: ["Con alguien pisándoles los talones, nada menos. Ustedes no hacen nada a medias."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_refuge_reaction_b: {
      lineas: ["Bastante valiente entregarse así, la verdad. Yo hubiera salido corriendo."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_refuge_reaction_0: {
      lineas: ["Era una época confusa para todos, al parecer. O la confusión soy yo. Cuesta saber cuál de las dos, últimamente."],
      next: "intro_reason_sin_recuerdo"
    },

    /* =====================================================================
       CICLO "LO QUE QUEDA" — exclusivo de Side B (BUFON_HECHOS_CONOCIDOS.B
       en data/bufon-evidencia.js), pensado para vivir detrás de sideBGen2.
       Temas de menú, no recuerdos espontáneos: cada uno es evolutivo vía
       completeDialogue por sub-pregunta (permanente, uno por uno) más un
       submenú que se vuelve a mostrar a sí mismo hasta que solo queda la
       opción de salir — mismo truco en Ledros, el Comerciante y Hubert.
    ===================================================================== */

    // --- Ledros ---
    bufon_ledros_intro: {
      lineas: [
        "Ledros.",
        "Ya se conocieron, entonces.",
        "Bueno. Conocieron la armadura. Ledros ya no hace mucho ahí adentro.",
        "Cada caballero de Brurland jura recuperar Broneland el día que lo nombran caballero. Se lo enseñan casi antes que a atarse las botas.",
        "El problema es que el reino ya no quiere esa guerra de vuelta. Así que la Corona hace como que nunca escuchó el juramento.",
        "Algunos caballeros igual le mandan cartas a la gente correcta en Piedrablanca, pero nadie lo admite en voz alta."
      ],
      animacion: "Parado",
      completeDialogue: "ledros_intro_seen",
      eleccion: "ledros_hub"
    },
    bufon_ledros_sigue_siendo: {
      lineas: [
        "¿Sí?",
        "No tiene rostro. No sé cuántos muertos carga ahí adentro.",
        "Cuando camina se le caen almas por las costuras.",
        "Pero conserva un nombre. Quizá alcance con eso.",
        "¿A ti te bastaría?",
        // Solo se muestra si El Rostro ya está en Murmullo o más — ver
        // el filtro por voiceStage en renderNodo(). Primera vez que esta
        // Voz interviene en el ciclo de Ledros; en Influencia (con techo
        // en 3, ver BUFON_VOCES_TECHO) es lo que destapa la opción
        // exclusiva nueva en ledros_hub.
        { voz: "rostro", texto: "Pregúntale por el hombre." }
      ],
      completeDialogue: "ledros_sigue_siendo",
      eleccion: "ledros_hub"
    },
    bufon_ledros_ya_no_persona: {
      lineas: [
        "Puede ser.",
        "Aunque conserva el nombre, la voz, algo del paso. Eso es mucho para ser \"nada\".",
        "No sé dónde está la línea. Nadie parece tenerla muy clara, la verdad."
      ],
      completeDialogue: "ledros_ya_no_persona",
      eleccion: "ledros_hub"
    },
    bufon_ledros_sonrisa: {
      lineas: [
        "Sonreía. No mucho.",
        "Nunca le duraba demasiado la sonrisa a Ledros.",
        "No voy a explicarte por qué. No lo sé del todo, y lo poco que sé no es mío para contarlo."
      ],
      completeDialogue: "ledros_sonrisa",
      eleccion: "ledros_hub"
    },
    bufon_ledros_rompio_juramento: {
      lineas: [
        "Puede ser.",
        "Mandó una carta que no debía, o se negó a mandar una que sí. Cualquiera de las dos rompe algo.",
        "No sé cuál fue con Ledros. Sé que algo se rompió. Ahora es una armadura que no hace buena plática."
      ],
      completeDialogue: "ledros_rompio_juramento",
      eleccion: "ledros_hub"
    },
    bufon_ledros_adam: {
      lineas: [
        "Adam también es capitán. Como Ledros.",
        "Brurland tiene talento para fabricar esa clase de hombre. Le da una espada, un juramento, y un puñado de órdenes que no siempre están de acuerdo entre sí.",
        "Cumple. Aguanta. Protege.",
        "Cada vez que el mundo le quita algo, se pone otra capa encima.",
        "Y aun así, lo siguen heriendo justo donde no llega la armadura.",
        "Hay gente que puede soportar tanto que nadie se acuerda de preguntarle si debería.",
        "Las cadenas que uno mismo se pone siempre ajustan mejor.",
        "Después mira qué queda."
      ],
      completeDialogue: "ledros_adam",
      eleccion: "ledros_hub"
    },
    bufon_ledros_rostro_hombre: {
      lineas: [
        "No sé.",
        "Nadie estuvo ahí para marcar el momento exacto. No es esa clase de cosa.",
        "Pero si tuviera que apostar, diría que fue antes de la armadura. Ledros ya se estaba perdiendo de a poco, mucho antes de necesitar meterse dentro de algo para seguir de pie."
      ],
      completeDialogue: "ledros_rostro_hombre",
      eleccion: "ledros_hub"
    },
    bufon_ledros_osses_hooey: {
      lineas: [
        "Curioso que preguntes.",
        "Ledros juró pelear contra Osses. Nunca llegó a hacerlo, al final.",
        "Y resulta que uno de ustedes viene de ahí, cargando pedazos de otro tipo que tampoco terminó de ser dueño de su historia.",
        "No sé si eso significa algo. Pero me gusta cuando el mundo rima sin que se lo pida."
      ],
      completeDialogue: "ledros_osses_hooey",
      eleccion: "ledros_hub"
    },

    // --- El Comerciante de Dávidas ---
    bufon_comerciante_intro: {
      lineas: [
        "Ah. También conocieron al Comerciante de Dávidas.",
        "Qué carroñero tan mediocre."
      ],
      animacion: "Auch",
      completeDialogue: "comerciante_intro_seen",
      eleccion: "comerciante_hub"
    },
    bufon_comerciante_por_que: {
      lineas: [
        "Espera a que alguien termine de vivir algo interesante.",
        "Junta lo que queda. Una máscara, una espada, un farol.",
        "Le pone la historia encima y actúa como si fuera suya.",
        "Es un ladrón. Nada más que eso."
      ],
      completeDialogue: "comerciante_por_que",
      eleccion: "comerciante_hub"
    },
    bufon_comerciante_contraste: {
      lineas: [
        "Claro que sí. Por eso me cae mal.",
        "A mí me gustan mientras todavía pueden cambiar de idea. Él llega cuando ya terminaron.",
        "Es fácil hacerle justicia a un cadáver. Ya no puede corregirte."
      ],
      completeDialogue: "comerciante_contraste",
      eleccion: "comerciante_hub"
    },
    bufon_comerciante_mascara: {
      lineas: [
        "Una persona vive treinta, cuarenta años. Ama a alguien. Odia a otro. Cambia de idea un montón de veces.",
        "Y se muere.",
        "Alguien recoge lo que dejó. Una máscara, en este caso.",
        "Tres frases después, eso era toda su vida."
      ],
      completeDialogue: "comerciante_mascara",
      eleccion: "comerciante_hub"
    },

    // --- Hubert Magnolia ---
    bufon_hubert_intro: {
      lineas: [
        "Hubert Magnolia.",
        "Lindo nombre para alguien que nunca lo usó."
      ],
      animacion: "Riendosesentao",
      completeDialogue: "hubert_intro_seen",
      eleccion: "hubert_hub"
    },
    bufon_hubert_quien: {
      lineas: ["Exacto. Esa es la parte graciosa."],
      completeDialogue: "hubert_quien_pregunta",
      eleccion: "hubert_hub"
    },
    bufon_hubert_quien_es: {
      lineas: [
        "Un catedrático de Dolbred. Escribió sobre alquimia. Después escribió sobre qué hacer cuando la alquimia sale mal.",
        "La segunda vez que salió mal, él seguía adentro. Ironía de esas que solo el mundo real produce.",
        "No sé si el nombre te queda. Pero algo tuyo sabe algo que tú no recuerdas, y eso ya es raro de por sí."
      ],
      completeDialogue: "hubert_quien_es",
      eleccion: "hubert_hub"
    },
    bufon_hubert_hooey_es_hooey: {
      lineas: [
        "Puede ser.",
        "Pero hay un nombre allá afuera que parece recordarte mejor de lo que tú te recuerdas a ti mismo.",
        "¿A quién pertenece quién?"
      ],
      completeDialogue: "hubert_hooey_es_hooey",
      eleccion: "hubert_hub"
    },

    // --- Laia e Isa ---
    bufon_laia_intro: {
      lineas: [
        "Isa.",
        "Un nombre elegante para alguien que se pasa el día en una celda. Aunque, para ser justos, elegante es como se describe a sí mismo todo el tiempo."
      ],
      animacion: "Cariñito",
      completeDialogue: "laia_intro_seen",
      eleccion: "laia_hub"
    },
    bufon_laia_quien_es: {
      lineas: [
        "Un prisionero. Terminó ahí por algo con la reina, y no parecía avergonzado en lo más mínimo.",
        "Se conocieron en los calabozos de Kigan. Quedaron en volver a verse en la Taberna del Gigante.",
        "No sé si eso cuenta como una cita o como una situación que se les fue de las manos. Probablemente las dos cosas."
      ],
      completeDialogue: "laia_quien_es",
      eleccion: "laia_hub"
    },
    bufon_laia_incomodo: {
      lineas: [
        "Te incomodaba, sí. Bastante.",
        "No fue lo que dijo. Fue lo guapo que es, sin ningún esfuerzo de por medio, y sin dejarte olvidarlo.",
        "Eso incomoda a cualquiera. Más a alguien que cambia de cara todo el tiempo y nunca termina de decidirse por una."
      ],
      animacion: "Riendosesentao",
      completeDialogue: "laia_incomodo",
      eleccion: "laia_hub"
    },
    bufon_laia_enmascarado: {
      lineas: [
        "¿El de la máscara de hierro?",
        "Sí. Es él.",
        "Nadie más lo sabe, que yo sepa. Pero tú sí, porque te dejó verlo.",
        "Eso ya dice bastante. De él, o de ti. Todavía no decido de cuál de los dos."
      ],
      completeDialogue: "laia_enmascarado",
      eleccion: "laia_hub"
    },

    // --- Respiro: Eledar, Cassius, Torvrena, Ryn, rumores del juicio ---
    bufon_eledar_tobillo: {
      lineas: [
        "Por cierto. Eledar.",
        "Buen trabajo con el tobillo.",
        "Toda una expedición al norte. Dragones, muertos caminando, comerciantes espirituales.",
        "Y el verdadero enemigo era pisar mal."
      ],
      animacion: "Riendosesentao",
      completeDialogue: "eledar_tobillo",
      eleccion: "eledar_tobillo_followup"
    },
    bufon_eledar_niega: {
      lineas: ["Como digas."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_eledar_afirma_primero: {
      lineas: [
        "Ah. Viniste a asumir la fama en persona.",
        "Bien por ti."
      ],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_cassius_opinion: {
      lineas: ["Me cae bien Cassius."],
      completeDialogue: "cassius_opinion",
      eleccion: "cassius_followup"
    },
    bufon_cassius_por_que: {
      lineas: [
        "Tiene precio. Dos piezas de oro, seis de cobre.",
        "La mayoría se pasa años fingiendo que sus principios no tienen uno. A él le dio igual e hizo las cuentas."
      ],
      animacion: "Cariñito",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_torvrena_opinion: {
      lineas: [
        "Torvrena al menos lo hace fácil.",
        "Le pagas por cazar un monstruo. Caza un monstruo. Refrescante."
      ],
      completeDialogue: "torvrena_opinion",
      next: "intro_reason_sin_recuerdo"
    },
    // Respiro sin ninguna dependencia de "Lo que queda" — charla normal,
    // no pensada como metáfora de nada. Disponible bastante antes que el
    // resto del ciclo (solo necesita un par de elecciones hechas, no
    // sideBGen2), a propósito: es del tipo de cosa que Slappy comentaría
    // en cualquier momento, no algo reservado para cuando "empiece" el
    // ciclo puente que todavía no está escrito.
    bufon_brurland_lluvia: {
      lineas: [
        "Me gusta la lluvia.",
        "En Brurland la odian, cosa curiosa. Yo la encuentro bastante agradable.",
        "Hasta el cielo tiene un mal día, a veces."
      ],
      completeDialogue: "brurland_lluvia",
      eleccion: "brurland_lluvia_reaccion"
    },
    bufon_brurland_lluvia_normal: {
      lineas: [
        "¿Normal? Qué grosero.",
        "Estaba intentando compartir algo contigo."
      ],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_ryn_intro: {
      lineas: ["Ryn no durmió."],
      completeDialogue: "ryn_no_durmio",
      eleccion: "ryn_followup"
    },
    bufon_ryn_como_sabes: {
      lineas: [
        "Porque estaba despierta.",
        "Suele ser una pista bastante buena."
      ],
      next: "intro_reason_sin_recuerdo"
    },
    // --- "Varios Eledar" — reacción a elegir "Ese fui yo." en
    // eledar_tobillo_followup (ver esa eleccion más abajo y "asyncNext"
    // en el manejador de clicks de secreto.html). Cuál de estos nodos se
    // muestra depende de cuánta gente más ya eligió esa misma opción
    // antes, chequeado en Supabase en el momento del click, no de un
    // nombre registrado.
    bufon_eledar_impostor_gag_2: {
      lineas: [
        "Espera.",
        "Tú también eres Eledar.",
        "Perfecto. Ya tenemos dos."
      ],
      animacion: "Auch",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_eledar_impostor_gag_3: {
      lineas: [
        "Tres Eledar.",
        "Ahora sí tenemos un problema."
      ],
      animacion: "Auch",
      eleccion: "eledar_gag_problema"
    },
    bufon_eledar_gag_estadistico: {
      lineas: [
        "Estadístico.",
        "En algún momento uno de ustedes tiene que ser falso.",
        "Se me ocurre que el primero es el falso. Sería gracioso."
      ],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_eledar_original_extranado: {
      lineas: [
        "Ah. Otra cosa.",
        "Hay alguien más por ahí diciendo que también es Eledar.",
        "...",
        "¿Sabes algo de eso?"
      ],
      next: "intro_reason_sin_recuerdo"
    },

    // --- "Te reconozco" — interrupción espontánea, igual que "varios
    // Eledar": ver reaccionPorNombreRegistrado() en secreto.html. Dispara
    // una sola vez (completeDialogue compartido "nombre_reconocido"), la
    // primera vez que el hub se muestra después de registrarse con uno de
    // estos nombres. Chistes internos de mesa, no lore de campaña.
    bufon_reconoce_eledar_solo: {
      lineas: [
        "¿Se te olvidó tu apellido, o sigues siendo precavido?",
        "Un poco supersticioso, si me preguntas."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_eledar_completo: {
      lineas: [
        "Wooow. Hace mucho que no dices tu apellido.",
        "Está bien. Tu secreto está a salvo conmigo."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_edy: {
      lineas: [
        "¿Edy? No recuerdo ese nombre.",
        "...",
        "¿Estás seguro, pequeño Eduardo Quilodrán?"
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_laia: {
      lineas: ["Sabía que reconocía esos ojos vacíos y abismales."],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_cami: {
      lineas: [
        "Ah, no te reconocí con los lentes, Cami.",
        "No deberías usar tu nombre real en estas cosas...",
        "Aunque puedes confiar en mí."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_side_b_falta_uno: {
      lineas: [
        "Aún falta alguien más.",
        "Aunque no cuento a los anónimos. Muy de mala clase no presentarse...",
        "Bueno. Yo aún no lo hago. Pero porque no recuerdo mi nombre, la verdad."
      ],
      completeDialogue: "side_b_falta_uno",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_ryn: {
      lineas: [
        "Se acerca tu invierno, ¿sabías?",
        "Aunque no es que te vaya a hacer volver a casa."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_nacha: {
      lineas: [
        "Nachipeps.",
        "...",
        "Lo siento, no sé de dónde salió eso."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_cassius: {
      lineas: [
        "¿El vaquero?",
        "¿No habías hecho todo esto antes? Lo de matar al dragón, encomendarte, y esas cosas...",
        "¿O me estoy confundiendo?",
        "Bueno. Da igual."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_k4k: {
      lineas: [
        "Navarrete, guatón. Danos galletas.",
        "...",
        "Lo siento, no sé de dónde salió eso."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_reconoce_hooey: {
      lineas: [
        "El perro verde.",
        "Ya veo."
      ],
      completeDialogue: "nombre_reconocido",
      next: "intro_reason_sin_recuerdo"
    },

    // --- Easter egg puntual: Kak/Cassius carga memoria de una vuelta
    // anterior de esta misma campaña, de antes de que existiera el
    // Bufón. Anomalía específica de este jugador, no una regla general
    // — ver la nota sobre El Rostro/El Hilo en el documento de diseño,
    // ninguna Voz se conecta a esto todavía. Dispara una sola vez.
    bufon_kak_cassius_revelacion: {
      lineas: [
        "Cassius.",
        "Tú ya estuviste aquí.",
        "Bueno, tú no. Ese es el problema.",
        "Conoces lugares que Cassius nunca vio. Gente que él todavía no conocía. Cosas que pasaron de otra manera.",
        "Qué cosa tan desagradable para llevar dentro de la cabeza.",
        "Pero no te preocupes. Esa historia ya terminó.",
        "O eso espero.",
        '"Él" se pone bastante pesado cuando algo que ya terminó insiste en seguir apareciendo.',
        "Pero bueno. Ten la historia clara. No querrás que piense que me estás mintiendo, ¿verdad?"
      ],
      completeDialogue: "kak_cassius_revelado",
      eleccion: "kak_cassius_reaccion"
    },
    bufon_kak_reaccion_recuerdos: {
      lineas: ["Curioso.", "Los recuerdos no suelen tener este nivel de detalle."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_kak_reaccion_estuve_ahi: {
      lineas: ["Entonces no son recuerdos.", "Son historial."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_kak_reaccion_cassius_no_sabe: {
      lineas: ["Sí.", "Tú sí.", "Qué relación tan rara tienen ustedes dos."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_kak_reaccion_el_sabe: {
      lineas: ["Sí.", "Él sabe de casi todo.", "Que vaya a hacer algo al respecto es otra historia."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_kak_reaccion_no_se: {
      lineas: ["Puede ser.", "O no quieres saberlo. Las dos cosas se parecen bastante desde afuera."],
      next: "intro_reason_sin_recuerdo"
    },

    // --- Medidores (Mentirosos/Impostores) — interrupciones espontáneas,
    // ver RECUERDOS_DISPONIBLES en secreto.html. Despertar: la Voz
    // principal lo nombra. Influencia: "graduación", ahora es Slappy
    // mismo el que lo nota. El cruce (ambos medidores altos a la vez)
    // es el único momento en que aparece El Apetito.
    bufon_testigo_menciona_mentira: {
      lineas: [
        { voz: "testigo", texto: "Eso no pasó así. Ya van dos versiones distintas de la misma historia." }
      ],
      completeDialogue: "mentirosos_notado",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_coartada_menciona_impostor: {
      lineas: [
        { voz: "coartada", texto: "No está mal. Un nombre nuevo, y a ver quién te sigue el juego." }
      ],
      completeDialogue: "impostores_notado",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_mentirosos: {
      lineas: [
        "Ya perdí la cuenta de cuántas versiones distintas me diste de lo mismo.",
        "No es un reproche. Solo digo que ya lo noté."
      ],
      completeDialogue: "graduacion_mentirosos",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_impostores: {
      lineas: [
        "En algún momento vas a tener que decidir quién eres.",
        "O no. A mí tampoco me urge, la verdad."
      ],
      completeDialogue: "graduacion_impostores",
      next: "intro_reason_sin_recuerdo"
    },
    // Graduación del medidor (Slappy nota el patrón) ≠ evolución de la
    // Voz (la Voz habla). Antes esto llevaba líneas {voz:"apetito"} —
    // acoplaba el render a que Apetito estuviera en Despertar o más,
    // rompiendo si su techo alguna vez bajara. Ahora es Slappy quien
    // comenta, con un guiño a que "algo" todavía no habla — el mismo
    // guiño que bufon_graduacion_deseo, a propósito, como un hilo que se
    // repite antes de que El Apetito tenga permiso de decir algo él
    // mismo, en un ciclo futuro y aparte de esto.
    bufon_graduacion_cruce: {
      lineas: [
        "Mentiste sobre lo que pasó. Y sobre quién eres.",
        "Eso ya no es descuido. Es una versión armada a propósito.",
        "Algo ahí atrás todavía no dice nada. Pero está prestando atención."
      ],
      completeDialogue: "medidores_cruce",
      next: "intro_reason_sin_recuerdo"
    },

    // --- Los otros cuatro medidores (Insistencia/Reserva/Apego/Identidad/
    // Curiosidad/Deseo) — un único aviso de Despertar cada uno, ver
    // RECUERDOS_DISPONIBLES en secreto.html. Sin graduación propia
    // todavía, a propósito.
    bufon_grieta_menciona_insistencia: {
      lineas: [
        { voz: "grieta", texto: "Volviste a preguntar. No te conformas con la primera respuesta." }
      ],
      completeDialogue: "insistencia_notada",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_muralla_menciona_reserva: {
      lineas: [
        { voz: "muralla", texto: "Te guardas cosas. No hace falta que las expliques todas." }
      ],
      completeDialogue: "reserva_notada",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_herida_menciona_apego: {
      lineas: [
        { voz: "herida", texto: "Confías rápido. Eso también dice algo de ti." }
      ],
      completeDialogue: "apego_notado",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_rostro_menciona_identidad: {
      lineas: [
        { voz: "rostro", texto: "Quién es quién de verdad. Ahí vuelves siempre, ¿no?" }
      ],
      completeDialogue: "identidad_notada",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_hilo_menciona_curiosidad: {
      lineas: [
        { voz: "hilo", texto: "Preguntas de todo un poco. Nunca te quedas en un solo hilo." }
      ],
      completeDialogue: "curiosidad_notada",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_apetito_menciona_deseo: {
      lineas: [
        { voz: "apetito", texto: "Sigues viniendo. Sigues queriendo más de esto." }
      ],
      completeDialogue: "deseo_notado",
      next: "intro_reason_sin_recuerdo"
    },

    // --- Graduación de los seis medidores restantes (Insistencia,
    // Reserva, Apego, Identidad, Curiosidad, Deseo) — mismo nivel que ya
    // tenían Mentirosos/Impostores: acá es Slappy mismo el que lo nota,
    // no solo la Voz. Ver generarCandidatosGraduacion() en secreto.html.
    bufon_graduacion_insistencia: {
      lineas: [
        "Ya sé que si te digo que no, vuelves a preguntar.",
        "No es queja. Ya dejé de sorprenderme."
      ],
      completeDialogue: "graduacion_insistencia",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_reserva: {
      lineas: [
        "Nunca terminas de explicar nada.",
        "Ya dejé de esperar que lo hagas."
      ],
      completeDialogue: "graduacion_reserva",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_apego: {
      lineas: [
        "Confías rápido, para alguien que apenas me conoce.",
        "No sé si eso te sirve allá afuera. Aquí adentro funciona bien."
      ],
      completeDialogue: "graduacion_apego",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_identidad: {
      lineas: [
        "Siempre terminamos hablando de lo mismo. Quién es quién, qué queda, qué se pierde.",
        "A este punto casi podría cobrar entrada por el tema."
      ],
      completeDialogue: "graduacion_identidad",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_curiosidad: {
      lineas: [
        "Preguntaste de todo. En serio, de todo.",
        "En algún momento vas a tener que quedarte con un solo tema."
      ],
      completeDialogue: "graduacion_curiosidad",
      next: "intro_reason_sin_recuerdo"
    },
    bufon_graduacion_deseo: {
      lineas: [
        "Últimamente admites rápido lo que quieres.",
        "Me gusta. Acorta las conversaciones.",
        "Algo ahí atrás todavía no dice nada. Pero está prestando atención."
      ],
      completeDialogue: "graduacion_deseo",
      next: "intro_reason_sin_recuerdo"
    },

    bufon_juicio_rumor: {
      lineas: [
        "Alguien anda contando su juicio por Kigan. Rápidos, eh.",
        "Primero pasa. Después alguien que nunca estuvo ahí te corrige la versión.",
        "En algún momento todos saben qué pasó. Menos tú."
      ],
      animacion: "Auch",
      completeDialogue: "juicio_rumor",
      next: "intro_reason_sin_recuerdo"
    }
  },

  elecciones: {
    intro_reason: {
      opciones: [
        {
          id: "exploring", texto: "Estoy explorando.", next: "resp_exploring",
          visible: ctx => !ctx.hasCompletedDialogue("exploring")
        },
        {
          id: "searching", texto: "Busco algo.", next: "resp_searching",
          visible: ctx => !ctx.hasCompletedDialogue("searching")
        },
        {
          id: "lost", texto: "Me perdí.", next: "resp_lost",
          visible: ctx => !ctx.hasCompletedDialogue("lost")
        },
        {
          id: "who_is_he",
          texto: '¿Quién es "Él"?',
          // Evolutivo: desaparece por el resto de ESTA visita apenas se
          // completa una etapa, pero nunca queda tachado para siempre —
          // la próxima vez que aparezca, salta a la etapa siguiente
          // (hoy hay dos escritas; agregar una tercera es sumar un
          // ternario más acá, no tocar el motor).
          visible: ctx => !ctx.consumedThisEncounter("who_is_he"),
          next: ctx => {
            if (ctx.hasCompletedDialogue("who_is_he_stage_1")) return "resp_who_2";
            // Si ya completó todos los demás temas del hub, "who_is_he" no
            // fue una entre muchas: era la única que quedaba.
            const eraLaUnica = ["exploring", "searching", "lost", "why_hide", "what_doing"]
              .every(id => ctx.hasCompletedDialogue(id));
            return eraLaUnica ? "resp_who_1_unica" : "resp_who_1";
          }
        },
        {
          id: "why_hide", texto: "¿Por qué no quieres que se lo diga a mis amigos?", next: "resp_why_hide",
          visible: ctx => !ctx.hasCompletedDialogue("why_hide")
        },
        {
          id: "what_doing", texto: "¿Qué haces tú aquí?", next: "resp_what_doing",
          visible: ctx => !ctx.hasCompletedDialogue("what_doing")
        },

        /* =================================================================
           CICLO "LO QUE QUEDA" (Side B, detrás de sideBGen2). Cada uno
           evolutivo por sub-pregunta (ver los nodos y elecciones nuevos
           más arriba/abajo), no de una sola vez como los de arriba.
        ================================================================= */
        {
          id: "side_b2_ledros", texto: "¿Qué es esa armadura?",
          visible: ctx => ctx.actualCampaign === "B" && ctx.sideBGen2 && ctx.hasFact("met_ledros"),
          next: ctx => ctx.hasCompletedDialogue("ledros_intro_seen") ? "ledros_hub" : "bufon_ledros_intro"
        },
        {
          id: "side_b2_comerciante", texto: "¿Conoces al tipo de anoche?",
          visible: ctx => ctx.actualCampaign === "B" && ctx.sideBGen2 && ctx.hasFact("chose_mask"),
          next: ctx => ctx.hasCompletedDialogue("comerciante_intro_seen") ? "comerciante_hub" : "bufon_comerciante_intro"
        },
        {
          id: "side_b2_hubert", texto: "Por cierto. Hubert Magnolia.",
          visible: ctx => ctx.actualCampaign === "B" && ctx.sideBGen2 && ctx.hasFact("hubert_magnolia_named")
            && ctx.playerNameMatches("Hooey Magoo", "Hooey", "Magoo", "Joan", "mahooey"),
          next: ctx => ctx.hasCompletedDialogue("hubert_intro_seen") ? "hubert_hub" : "bufon_hubert_intro"
        },
        {
          id: "side_b2_laia", texto: "¿Qué fue eso con el prisionero de los calabozos?",
          visible: ctx => ctx.actualCampaign === "B" && ctx.sideBGen2 && ctx.hasFact("conocio_isa"),
          next: ctx => ctx.hasCompletedDialogue("laia_intro_seen") ? "laia_hub" : "bufon_laia_intro"
        }
        // Eledar/Cassius/Torvrena/Ryn/rumores del juicio ya NO son botones
        // del hub — pasaron a ser interrupciones espontáneas (ver
        // RECUERDOS_DISPONIBLES en secreto.html). Mismos nodos, mismo
        // completeDialogue, solo cambió cómo se llega a ellos: antes el
        // jugador tenía que pedirlos, ahora Slappy los trae solo. La idea
        // es que "Lo que queda" no se sienta como nueve botones nuevos de
        // golpe, sino como Ledros/Comerciante/Hubert/Laia como temas
        // reales, y el resto como cosas que se le ocurren mientras tanto.
      ]
    },

    despedida_opciones: {
      opciones: [
        { id: "despedida_que_tiempo", texto: "¿Qué tiempo?", next: "bufon_despedida_que_tiempo" },
        { id: "despedida_nos_vemos", texto: "Nos vemos.", next: "bufon_despedida_cierre" }
      ]
    },

    oferta_registro_opciones: {
      opciones: [
        { id: "registro_aceptar", texto: "Está bien. Regístrame.", next: "__formulario_registro__" },
        { id: "registro_rechazar", texto: "Prefiero seguir así.", next: "bufon_registro_rechazado" }
      ]
    },

    early_return_01_opciones: {
      opciones: [
        { id: "early_return_yo_mismo", texto: "Sigo siendo yo aunque me vean distinto.", next: "early_return_reaction_yo_mismo" },
        { id: "early_return_no_conocen", texto: "Entonces ninguno de ellos me conoce realmente.", next: "early_return_reaction_no_conocen" },
        { id: "early_return_cual_real", texto: "¿Y cuál versión de ti es la real?", next: "early_return_reaction_cual_real" },
        { id: "early_return_secreto", texto: "¿No dijiste que no le contara a nadie?", next: "early_return_reaction_secreto" },
        { id: "early_return_saludo", texto: "Solo quería hablar contigo.", next: "early_return_reaction_saludo" }
      ]
    },

    despedida_que_significa: {
      opciones: [
        { id: "despedida_que_significa_eso", texto: "¿Qué significa eso?", next: "bufon_despedida_fin" }
      ]
    },

    who_confirm: {
      opciones: [
        { id: "i_do_know", texto: "Sí, sé quién es.", next: "resp_who_confirmed" },
        { id: "i_dont_know", texto: "No, no sé.", next: "resp_who_denied" }
      ]
    },

    why_hide_followup: {
      opciones: [
        { id: "what_wrong", texto: "¿Y qué tiene de malo?", next: "resp_what_wrong" }
      ]
    },

    trust_friends: {
      opciones: [
        { id: "yes", texto: "Sí, confío en ellos.", next: "resp_trust_yes" },
        { id: "no", texto: "No, la verdad no.", next: "resp_trust_no" },
        { id: "unsure", texto: "No estoy seguro.", next: "resp_trust_unsure" }
      ]
    },

    what_doing_followup: {
      opciones: [
        { id: "waiting_what", texto: "¿Esperando qué?", next: "resp_waiting_what" }
      ]
    },

    /* =====================================================================
       Submenús del ciclo "Lo que queda" (Side B). Cada opción real es
       completeDialogue permanente y apunta de vuelta al mismo submenú, así
       que desaparece sola en cuanto se contesta y deja ver las que faltan.
       La última opción de cada uno queda siempre visible, sin importar
       cuánto se haya avanzado, para nunca dejar el menú vacío.
    ===================================================================== */
    ledros_hub: {
      opciones: [
        {
          id: "ledros_sigue_siendo", texto: "Sigue siendo Ledros.", next: "bufon_ledros_sigue_siendo",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_sigue_siendo")
        },
        {
          id: "ledros_ya_no_persona", texto: "Eso ya no es una persona.", next: "bufon_ledros_ya_no_persona",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_ya_no_persona")
        },
        {
          id: "ledros_sonrisa", texto: "¿Cómo era Ledros? De antes, digo.", next: "bufon_ledros_sonrisa",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_sonrisa")
        },
        {
          id: "ledros_rompio_juramento", texto: "¿Rompió alguno de sus juramentos?", next: "bufon_ledros_rompio_juramento",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_rompio_juramento")
        },
        {
          id: "ledros_adam", texto: "¿Qué tiene que ver Adam con él?", next: "bufon_ledros_adam",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_adam")
        },
        {
          id: "ledros_osses_hooey", texto: "¿Tiene que ver con Hooey esto?", next: "bufon_ledros_osses_hooey",
          visible: ctx => !ctx.hasCompletedDialogue("ledros_osses_hooey") && ctx.hasCompletedDialogue("hubert_intro_seen")
        },
        // Primera opción exclusiva de Voz real del árbol. Solo aparece
        // con El Rostro en Influencia (etapa 3) — hoy la única Voz con
        // el techo narrativo así de alto (ver BUFON_VOCES_TECHO en
        // data/bufon-voces.js), a propósito: es la "gran novedad" de
        // este ciclo, no una más entre varias.
        {
          id: "ledros_rostro_hombre", texto: "¿En qué momento Ledros dejó de ser Ledros?", voz: "rostro",
          next: "bufon_ledros_rostro_hombre",
          visible: ctx => ctx.voiceStage("rostro") >= 3 && !ctx.hasCompletedDialogue("ledros_rostro_hombre")
        },
        { id: "ledros_cerrar", texto: "Ya fue, sigamos con otra cosa.", next: "intro_reason_sin_recuerdo" }
      ]
    },

    comerciante_hub: {
      opciones: [
        {
          id: "comerciante_por_que", texto: "¿Por qué te cae tan mal?", next: "bufon_comerciante_por_que",
          visible: ctx => !ctx.hasCompletedDialogue("comerciante_por_que")
        },
        {
          id: "comerciante_tambien_te_gustan", texto: "Pero a ti también te gustan las historias.", next: "bufon_comerciante_contraste",
          visible: ctx => ctx.hasCompletedDialogue("comerciante_por_que") && !ctx.hasCompletedDialogue("comerciante_contraste")
        },
        {
          id: "comerciante_mascara", texto: "¿Qué es esa máscara que aceptamos?", next: "bufon_comerciante_mascara",
          visible: ctx => !ctx.hasCompletedDialogue("comerciante_mascara")
        },
        { id: "comerciante_cerrar", texto: "Ya fue, sigamos con otra cosa.", next: "intro_reason_sin_recuerdo" }
      ]
    },

    hubert_hub: {
      opciones: [
        {
          id: "hubert_quien_pregunta", texto: "¿Quién?", next: "bufon_hubert_quien",
          visible: ctx => !ctx.hasCompletedDialogue("hubert_quien_pregunta")
        },
        {
          id: "hubert_quien_es", texto: "¿Y quién es Hubert Magnolia?", next: "bufon_hubert_quien_es",
          visible: ctx => !ctx.hasCompletedDialogue("hubert_quien_es")
        },
        {
          id: "hubert_hooey_es_hooey", texto: "Hooey es Hooey.", next: "bufon_hubert_hooey_es_hooey",
          visible: ctx => !ctx.hasCompletedDialogue("hubert_hooey_es_hooey")
        },
        { id: "hubert_cerrar", texto: "Ya fue, sigamos con otra cosa.", next: "intro_reason_sin_recuerdo" }
      ]
    },

    laia_hub: {
      opciones: [
        {
          id: "laia_quien_es", texto: "¿Quién es Isa?", next: "bufon_laia_quien_es",
          visible: ctx => !ctx.hasCompletedDialogue("laia_quien_es")
        },
        {
          id: "laia_incomodo", texto: "¿Por qué me incomodaba tanto?", next: "bufon_laia_incomodo",
          visible: ctx => !ctx.hasCompletedDialogue("laia_incomodo")
        },
        {
          id: "laia_enmascarado", texto: "¿Tiene que ver con el prisionero de la máscara?", next: "bufon_laia_enmascarado",
          visible: ctx => !ctx.hasCompletedDialogue("laia_enmascarado")
        },
        { id: "laia_cerrar", texto: "Ya fue, sigamos con otra cosa.", next: "intro_reason_sin_recuerdo" }
      ]
    },

    cassius_followup: {
      opciones: [
        { id: "cassius_por_que", texto: "¿Por qué?", next: "bufon_cassius_por_que" }
      ]
    },

    ryn_followup: {
      opciones: [
        { id: "ryn_como_sabes", texto: "¿Cómo sabes eso?", next: "bufon_ryn_como_sabes" }
      ]
    },

    brurland_lluvia_reaccion: {
      opciones: [
        { id: "lluvia_normal", texto: "Eso ha sido sorprendentemente normal.", next: "bufon_brurland_lluvia_normal" }
      ]
    },

    eledar_gag_problema: {
      opciones: [
        { id: "eledar_que_problema", texto: "¿Qué problema?", next: "bufon_eledar_gag_estadistico" }
      ]
    },

    kak_cassius_reaccion: {
      opciones: [
        { id: "kak_solo_recuerdos", texto: "Solo son recuerdos.", next: "bufon_kak_reaccion_recuerdos" },
        { id: "kak_yo_estuve_ahi", texto: "Yo sí estuve ahí.", next: "bufon_kak_reaccion_estuve_ahi" },
        { id: "kak_cassius_no_sabe", texto: "Cassius no sabe nada de eso.", next: "bufon_kak_reaccion_cassius_no_sabe" },
        { id: "kak_el_sabe", texto: '¿"Él" sabe de la otra vez?', next: "bufon_kak_reaccion_el_sabe" },
        { id: "kak_no_se_de_que_hablas", texto: "No sé de qué estás hablando.", next: "bufon_kak_reaccion_no_se" }
      ]
    },

    /* "Ese fui yo." es la única opción de todo el árbol que usa
       asyncNext en vez de next: necesita ir a Supabase a ver cuánta
       gente más ya eligió esta misma opción antes de decidir qué
       contesta el Bufón (ver bufon_estado_eleccion en
       js/bufon-supabase.js y scratchpad/bufon_estado_eleccion.sql, y el
       manejo de asyncNext en el click handler de secreto.html). Si la
       llamada falla, se trata como "eres el primero" — nunca deja al
       jugador sin respuesta. */
    eledar_tobillo_followup: {
      opciones: [
        {
          id: "eledar_afirma_ser_el",
          texto: "Ese fui yo.",
          asyncNext: async () => {
            const estado = await bufonEstadoEleccion("eledar_afirma_ser_el");
            if (!estado || estado.total <= 1) return "bufon_eledar_afirma_primero";
            if (estado.mi_rango === 1) return "bufon_eledar_original_extranado";
            return estado.total >= 3 ? "bufon_eledar_impostor_gag_3" : "bufon_eledar_impostor_gag_2";
          }
        },
        { id: "eledar_niega_ser_el", texto: "No, no soy yo.", next: "bufon_eledar_niega" }
      ]
    },

    /* =====================================================================
       Puntos de elección de los recuerdos espontáneos. Los "_check1" son
       la primera reacción ambigua (valen 0 siempre, ninguna de sus
       opciones está en data/bufon-evidencia.js). Los que comparten id con
       un memoryGroup ("pet_rescue", "gareth_relationship",
       "dragon_first_wound", "post_refuge_decision") son la elección real:
       ahí es donde el jugador puede aportar evidencia, y el motor usa ese
       mismo id para no volver a ofrecer el mismo recuerdo dos veces.
    ===================================================================== */

    pet_rescue_check1: {
      opciones: [
        { id: "pet_check1_yes", texto: "Sí.", next: "bufon_pet_rescue_2" },
        { id: "pet_check1_who", texto: "¿Cómo sabes de él?", next: "bufon_pet_rescue_2" },
        { id: "pet_check1_grown", texto: "Ya no es tan pequeño.", next: "bufon_pet_rescue_2" },
        { id: "pet_check1_refuse", texto: "No quiero hablar de eso.", next: "bufon_pet_rescue_2" }
      ]
    },
    pet_rescue: {
      opciones: [
        { id: "pet_bestia_tremula", texto: "Es una Bestia Trémula.", next: "bufon_pet_reaction_a" },
        { id: "pet_grifon", texto: "Es un grifón.", next: "bufon_pet_reaction_b" },
        { id: "pet_como_un_gato", texto: "Para nosotros es básicamente un gato.", next: "bufon_pet_reaction_cat" },
        { id: "pet_no_entender", texto: "No tienes que entenderlo.", next: "bufon_pet_reaction_0" }
      ]
    },

    gareth_relationship: {
      opciones: [
        { id: "gareth_nos_debe", texto: "Él nos debe una.", next: "bufon_gareth_reaction_a" },
        { id: "gareth_no_debe_nada", texto: "No nos debe nada.", next: "bufon_gareth_reaction_b" },
        { id: "gareth_no_se", texto: "¿De qué estás hablando?", next: "bufon_gareth_reaction_0" },
        { id: "gareth_quien", texto: "¿Gareth?", next: "bufon_gareth_reaction_0" }
      ]
    },

    dragon_wound_check1: {
      opciones: [
        { id: "dragon_check_ridicula", texto: "¿Ridícula?", next: "bufon_dragon_wound_2" },
        { id: "dragon_check_si", texto: "Sí, lo fue.", next: "bufon_dragon_wound_2" }
      ]
    },
    dragon_first_wound: {
      opciones: [
        { id: "dragon_proyectil", texto: "Fue una persona, no un arma.", next: "bufon_dragon_reaction_a" },
        { id: "dragon_balista", texto: "¿Que tiene de raro una balista?", next: "bufon_dragon_reaction_b" },
        { id: "dragon_no_se", texto: "No sé de qué hablas.", next: "bufon_dragon_reaction_0" }
      ]
    },
    dragon_wound_followup: {
      opciones: [
        { id: "dragon_followup_que", texto: "¿Qué cosa?", next: "bufon_dragon_reaction_nada" }
      ]
    },

    post_refuge_check1: {
      opciones: [
        { id: "refuge_check_si", texto: "Sí.", next: "bufon_post_refuge_2" },
        { id: "refuge_check_poco", texto: "Un poco.", next: "bufon_post_refuge_2" }
      ]
    },
    post_refuge_decision: {
      opciones: [
        { id: "refuge_huyeron", texto: "Huyendo. Nadie se quedó a esperar nada.", next: "bufon_refuge_reaction_a" },
        { id: "refuge_entregaron", texto: "Nos quedamos. Esperamos el juicio.", next: "bufon_refuge_reaction_b" },
        { id: "refuge_no_recuerdo", texto: "No sé de qué hablas.", next: "bufon_refuge_reaction_0" }
      ]
    }
  }
};
