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
        '¿Qué tal? Ah, esperá, no. Antes que nada: no le digas a nadie que estoy acá.',
        "No por nada grave. Es más una cuestión de principios. Y porque me conviene.",
        "Tus amigos tampoco, eh. Sobre todo tus amigos.",
        'Aunque bueno, técnicamente "Él" ya sabe. Él siempre sabe esas cosas. Es bastante irritante, si te soy sincero.',
        "Pero que Él sepa que estoy acá y que tú me hayas encontrado son dos cosas completamente distintas. Pienso aferrarme a esa distinción con todas mis fuerzas.",
        "En fin. ¿Qué haces tú acá?"
      ],
      animacion: "Pofavor",
      eleccion: "intro_reason"
    },

    resp_exploring: {
      lineas: [
        "Ah. Un curioso.",
        "Excelente idea, la exploración. Funciona perfectamente hasta que encuentras algo — después todo el mundo actúa como si encontrarlo hubiera sido un error."
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
        "Pregúntame otra cosa — tienes un montón de opciones y fuiste directo a la que no pienso responder. Admirable, en cierta forma."
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
      lineas: ["Qué bien.", "Confiar en la gente hace todo mucho más fácil. Hasta que deja de hacerlo, claro — pero para entonces ya tienes problemas más interesantes."],
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
      lineas: ["Bestia Trémula. Ahí está, ese es el nombre que se me escapaba. Con razón — suena inventado."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_b: {
      lineas: ["Ah, el que picoteaba todo. Se me cruzan los bichos con plumas."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_cat: {
      lineas: ["Un gato. Claro, eso lo explica todo — por qué lo dejan hacer lo que quiere, por qué nadie se queja."],
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
      lineas: ["Eso pensé. Bien — entonces no estoy tan mal de la cabeza como pensaba."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_gareth_reaction_b: {
      lineas: ["Ah. Entonces mezclé ésa también.", "Bien saber. Ahora tengo que revisar qué más mezclé, pero bueno — un problema a la vez."],
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
      lineas: ["Una balista. Bien, mucho más sensato que lo que yo tenía en mente."],
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
          next: ctx => (ctx.hasCompletedDialogue("who_is_he_stage_1") ? "resp_who_2" : "resp_who_1")
        },
        {
          id: "why_hide", texto: "¿Por qué no quieres que se lo diga a mis amigos?", next: "resp_why_hide",
          visible: ctx => !ctx.hasCompletedDialogue("why_hide")
        },
        {
          id: "what_doing", texto: "¿Qué haces tú aquí?", next: "resp_what_doing",
          visible: ctx => !ctx.hasCompletedDialogue("what_doing")
        }
      ]
    },

    despedida_opciones: {
      opciones: [
        { id: "despedida_que_tiempo", texto: "¿Qué tiempo?", next: "bufon_despedida_que_tiempo" },
        { id: "despedida_nos_vemos", texto: "Nos vemos.", next: "bufon_despedida_cierre" }
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
        { id: "pet_grifon", texto: "Tiene plumas, no ocho patas.", next: "bufon_pet_reaction_b" },
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
        { id: "dragon_balista", texto: "Nosotros usamos una balista.", next: "bufon_dragon_reaction_b" },
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
