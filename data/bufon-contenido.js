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

  nodos: {
    intro_01: {
      lineas: [
        "Hola.",
        "...",
        "¿Qué tal?",
        "No, espera.",
        "Primero una cosa.",
        "No le digas a nadie que estoy aquí.",
        "No porque vaya a pasar algo.",
        "Probablemente.",
        "Pero preferiría que no.",
        "Tus amigos tampoco.",
        "Especialmente tus amigos.",
        "...",
        "Bueno.",
        'Obviamente "Él" sabe.',
        "Él siempre sabe esas cosas.",
        "Pero saber que estoy aquí y saber que me encontraste son cosas diferentes.",
        "Creo.",
        "Espero.",
        "...",
        "En fin.",
        "¿Qué haces aquí?"
      ],
      eleccion: "intro_reason"
    },

    resp_exploring: {
      lineas: [
        "Ah.",
        "Un curioso.",
        "Eso suele acabar bien.",
        "...",
        "Bueno, no.",
        "Pero hace las cosas más interesantes."
      ],
      completeDialogue: "exploring",
      next: "intro_reason"
    },

    resp_searching: {
      lineas: [
        "¿Algo?",
        "Qué específico.",
        "Espero que sepas reconocerlo cuando lo encuentres.",
        "Sería bastante triste pasar justo por delante."
      ],
      completeDialogue: "searching",
      next: "intro_reason"
    },

    resp_lost: {
      lineas: [
        "Ja.",
        "Entonces somos dos.",
        "Aunque yo llevo perdido bastante más tiempo que tú.",
        "Creo."
      ],
      completeDialogue: "lost",
      next: "intro_reason"
    },

    // Etapa 1 de "¿Quién es 'Él'?" — tema evolutivo, no permanente.
    // completeDialogue queda por etapa (who_is_he_stage_1) para que la
    // elección del hub sepa a qué etapa saltar la próxima vez;
    // consumeEncounter es el que hace que la opción desaparezca del menú
    // solo durante esta visita.
    resp_who_1: {
      lineas: [
        "Ah.",
        "Ya empezamos.",
        "...",
        "No.",
        "Todavía no.",
        "Hazme otra pregunta."
      ],
      completeDialogue: "who_is_he_stage_1",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },

    resp_who_2: {
      lineas: ["Sabes quién."],
      eleccion: "who_confirm"
    },

    // Las dos líneas de abajo no venían con texto exacto en la especificación
    // (solo definía la rama "no sabe"). Son un placeholder mío para la rama
    // "sí sabe" — ajustalas cuando quieras.
    resp_who_confirmed: {
      lineas: ["Entonces no hace falta que lo diga yo."],
      completeDialogue: "who_is_he_stage_2",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },
    resp_who_denied: {
      lineas: ["...", "Eso es raro."],
      completeDialogue: "who_is_he_stage_2",
      consumeEncounter: "who_is_he",
      next: "intro_reason"
    },

    resp_why_hide: {
      lineas: ['Porque entonces sabrían que hablaste conmigo.'],
      eleccion: "why_hide_followup"
    },

    resp_what_wrong: {
      lineas: [
        "Nada.",
        "Supongo.",
        "...",
        "¿Confías en ellos?"
      ],
      eleccion: "trust_friends"
    },

    // Las tres respuestas de abajo tampoco venían con texto exacto en la
    // especificación (pedía que la elección quedara guardada, sin dar la
    // línea de reacción). Placeholder mío, ajustable.
    resp_trust_yes: {
      lineas: ["Qué bien.", "...", "Ojalá tengas razón."],
      completeDialogue: "why_hide",
      next: "intro_reason"
    },
    resp_trust_no: {
      lineas: ["...", "¿Y por qué sigues con ellos, entonces?"],
      completeDialogue: "why_hide",
      next: "intro_reason"
    },
    resp_trust_unsure: {
      lineas: ["Esa es una respuesta más honesta de lo que crees."],
      completeDialogue: "why_hide",
      next: "intro_reason"
    },

    resp_what_doing: {
      lineas: ["Esperando."],
      eleccion: "what_doing_followup"
    },

    resp_waiting_what: {
      lineas: ["Que hicieras esa pregunta."],
      completeDialogue: "what_doing",
      next: "intro_reason"
    },

    /* =====================================================================
       DESPEDIDA — se dispara sola cuando el hub ("intro_reason") no tiene
       ningún tema visible (ver renderEleccion en secreto.html). "¿Qué
       tiempo?" vive DENTRO de esta secuencia, no como tema nuevo del hub:
       si apareciera como opción normal contradiría el propio "no queda
       nada de qué hablar". Ninguno de los dos finales tiene next/eleccion
       — el motor los apaga solos en un "..." sin más opciones.
    ===================================================================== */
    bufon_despedida: {
      lineas: ["Bueno...", "Se nos acabó el tiempo, creo."],
      eleccion: "despedida_opciones"
    },
    bufon_despedida_que_tiempo: {
      lineas: ["El nuestro.", "...", "Nos vemos."]
    },
    bufon_despedida_cierre: {
      lineas: ["Ya nos vamos a ver otro día.", "No te olvides de visitarme.", "Jeje."]
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
      eleccion: "pet_rescue_check1"
    },
    bufon_pet_rescue_2: {
      lineas: ["Me caía bien.", "Aunque nunca entendí qué clase de animal era."],
      eleccion: "pet_rescue"
    },
    bufon_pet_reaction_a: {
      lineas: ["¿Un gato con tentáculos?", "...", "Ah. Sí. Supongo que así tiene más sentido."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_b: {
      lineas: ["...", "Cierto. Ese picoteaba."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_cat: {
      lineas: ["Un gato.", "Claro.", "Eso explica por qué lo dejan salirse con la suya."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_pet_reaction_0: {
      lineas: ["...", "Da igual, entonces."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: gareth_relationship
    bufon_gareth: {
      lineas: ["Gareth...", "...", "Nunca recuerdo quién le debía qué a quién."],
      eleccion: "gareth_relationship"
    },
    bufon_gareth_reaction_a: {
      lineas: ["...", "Eso pensé.", "Bien."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_gareth_reaction_b: {
      lineas: ["Ah.", "Entonces mezclé esa parte también.", "Muy bien.", "...", "Muy bien."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_gareth_reaction_0: {
      lineas: ["...", "Da igual."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: dragon_first_wound
    bufon_dragon_wound: {
      lineas: ["La primera vez que consiguieron herirlo fue bastante ridícula."],
      eleccion: "dragon_wound_check1"
    },
    bufon_dragon_wound_2: {
      lineas: ["Bueno.", "Usar a una persona de munición no suele ser el primer plan de nadie."],
      eleccion: "dragon_first_wound"
    },
    bufon_dragon_reaction_a: {
      lineas: ["...", "Sí.", "Ahora encaja."],
      eleccion: "dragon_wound_followup"
    },
    bufon_dragon_reaction_b: {
      lineas: ["...", "Sí.", "Ahora encaja."],
      eleccion: "dragon_wound_followup"
    },
    bufon_dragon_reaction_nada: {
      lineas: ["Nada importante."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_dragon_reaction_0: {
      lineas: ["...", "Puede ser."],
      next: "intro_reason_sin_recuerdo"
    },

    // memoryGroup: post_refuge_decision
    bufon_post_refuge: {
      lineas: ["Después de esa noche se complicó todo bastante, ¿no?"],
      eleccion: "post_refuge_check1"
    },
    bufon_post_refuge_2: {
      lineas: ["Todavía no sé si terminaron peor huyendo o quedándose."],
      eleccion: "post_refuge_decision"
    },
    bufon_refuge_reaction_a: {
      lineas: ["...", "Cierto.", "Con alguien pisándoles los talones, además."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_refuge_reaction_b: {
      lineas: ["...", "Cierto.", "Bastante valiente, la verdad, entregarse así."],
      next: "intro_reason_sin_recuerdo"
    },
    bufon_refuge_reaction_0: {
      lineas: ["...", "Da igual."],
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
