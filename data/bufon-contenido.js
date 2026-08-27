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
      next: "intro_reason"
    },

    resp_searching: {
      lineas: [
        "¿Algo?",
        "Qué específico.",
        "Espero que sepas reconocerlo cuando lo encuentres.",
        "Sería bastante triste pasar justo por delante."
      ],
      next: "intro_reason"
    },

    resp_lost: {
      lineas: [
        "Ja.",
        "Entonces somos dos.",
        "Aunque yo llevo perdido bastante más tiempo que tú.",
        "Creo."
      ],
      next: "intro_reason"
    },

    resp_who_1: {
      lineas: [
        "Ah.",
        "Ya empezamos.",
        "...",
        "No.",
        "Todavía no.",
        "Hazme otra pregunta."
      ],
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
      next: "intro_reason"
    },
    resp_who_denied: {
      lineas: ["...", "Eso es raro."],
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
      next: "intro_reason"
    },
    resp_trust_no: {
      lineas: ["...", "¿Y por qué seguís con ellos, entonces?"],
      next: "intro_reason"
    },
    resp_trust_unsure: {
      lineas: ["Esa es una respuesta más honesta de lo que creés."],
      next: "intro_reason"
    },

    resp_what_doing: {
      lineas: ["Esperando."],
      eleccion: "what_doing_followup"
    },

    resp_waiting_what: {
      lineas: ["Que hicieras esa pregunta."],
      next: "intro_reason"
    }
  },

  elecciones: {
    intro_reason: {
      opciones: [
        { id: "exploring", texto: "Estoy explorando.", next: "resp_exploring" },
        { id: "searching", texto: "Busco algo.", next: "resp_searching" },
        { id: "lost", texto: "Me perdí.", next: "resp_lost" },
        {
          id: "who_is_he",
          texto: '¿Quién es "Él"?',
          next: () => (hasPreviousChoice("who_is_he") ? "resp_who_2" : "resp_who_1")
        },
        { id: "why_hide", texto: "¿Por qué no querés que se lo diga a mis amigos?", next: "resp_why_hide" },
        { id: "what_doing", texto: "¿Qué hacés vos acá?", next: "resp_what_doing" }
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
    }
  }
};
