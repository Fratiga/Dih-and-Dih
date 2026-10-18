/* =============================================================================
   CICLO 3 — EL LABORATORIO Y TEROS.

   Teros es para Side A y Side B. Los temas del laboratorio (Dexter, los tres
   doctores y la Corona) son solo de Side B, y cada uno se destapa con un hecho
   de la mesa (ver BUFON_HECHOS_CONOCIDOS.B en data/bufon-evidencia.js). El tema
   de los cambiantes es solo para la jugadora de Laia.

   Lo reciben solo los jugadores que estén en el ciclo 3. Nadie lo está hasta
   que el Admin los mueva desde "Progreso del Bufón" (a un lado entero o a un
   jugador). Admin siempre lo ve, para poder preparar y revisar contenido.

   Formato y reglas: ver data/bufon-ciclos.js y tools/bufon/LEEME.md.
============================================================================= */
window.bufonAgregarCiclo({
  id: "fase3",
  numero: 3,
  nombre: "El laboratorio y Teros",
  temas: [

    /* TEROS. El Bufón lo cuenta como un recuerdo que no sabe si es suyo.
       Nunca dice que quiere nada ni explica de dónde viene. */
    {
      id: "teros",
      boton: "Cuéntame otra vez lo del minotauro.",
      intro: {
        como: "recuerdo",
        lineas: [
          "Se me vino un minotauro a la cabeza.",
          "Enorme. Más ancho que una puerta y con mucha menos paciencia.",
          "No sé de dónde lo saqué. No parece de por aquí.",
          "Se llamaba Teros."
        ]
      },
      preguntas: [
        {
          id: "no_importa", texto: "No me interesa quién sea.", cierra: true,
          lineas: [
            "Hah. Qué directo.",
            "Está bien. El minotauro no se va a ofender.",
            "Lo dejo donde estaba."
          ]
        },
        {
          id: "quien", texto: "¿Quién era?",
          lineas: [
            "Un borracho. De los buenos, es decir, de los malos.",
            "Rompía mesas por deporte y deudas por costumbre. Fuerte como tres hombres y sin ninguna gana de servir para algo.",
            "Lo condenaron a la horca. Lo normal, la verdad.",
            "Lo raro es que se soltó. Y no dejó a mucha gente en pie.",
            "Dejó vivo a uno. Un niño. Lo tuvo delante, con la mano ya lista, y se quedó mirándolo.",
            "Acuérdate de eso."
          ]
        },
        {
          id: "templo", texto: "¿Y qué hizo después de escapar?", requiere: ["quien"],
          lineas: [
            "Llegó a un templo por accidente. Buscaba dónde esconderse. Encontró otra cosa.",
            "Los monjes no le preguntaron qué había hecho. Le dieron una escoba.",
            "Barrió ese patio un año entero. Después aprendió a pelear sin odiar a nadie, que es bastante más difícil de lo que suena.",
            "Pasó el resto de su vida intentando arreglar lo que rompió. Pueblos, deudas, una viuda que no quería verlo ni en pintura. Algunas cosas se arreglaron. Otras se quedaron rotas, y esas las cargó él.",
            "Tengo una teoría sobre los que se reforman. Cargan el pasado como una maleta que nadie les pidió y nunca la dejan en el suelo.",
            "Es una mala teoría. Pero me gusta cómo suena."
          ]
        },
        {
          id: "final", texto: "¿Cómo terminó?", requiere: ["templo"],
          lineas: [
            "Años después alguien tocó a su puerta. Reconoció la cara antes que la edad.",
            "Era el niño. Había crecido y no se había olvidado.",
            "Teros lo vio venir. Podía haberlo detenido con un dedo.",
            "No levantó la mano.",
            "...",
            "Dijo que le tocaba.",
            // Solo se muestra con La Herida en Murmullo o más.
            { voz: "herida", texto: "El niño tampoco durmió bien en todos esos años." },
            "Yo habría peleado. Soy mal ejemplo.",
            "No sé si esto lo recuerdo o lo soñé. Pero cada vez que llego a esta parte me quedo sin chistes. Pasa pocas veces.",
            "Si algún día te cruzas con uno que se le parezca, saluda de mi parte."
          ]
        }
      ],
      // Las tres respuestas son mutuamente excluyentes y ninguna contradice
      // a las otras: el Bufón no obliga a tomar partido para poder seguir.
      grupos: [
        {
          id: "merecia", requiere: ["final"],
          opciones: [
            {
              id: "si", texto: "Sí, se lo merecía.",
              lineas: [
                "Mucha gente diría lo mismo. El niño, para empezar.",
                "Teros también lo pensaba. Eso es lo que me molesta."
              ]
            },
            {
              id: "no", texto: "No, no se lo merecía.",
              lineas: [
                "A mí tampoco me lo parece.",
                "Pero rompió demasiado como para que la cuenta saliera en cero. Ni con todos mis chistes arreglo esa aritmética."
              ]
            },
            {
              id: "nose", texto: "No lo sé.", neutral: true,
              lineas: [
                "Está bien. Yo llevo dándole vueltas desde que lo recuerdo.",
                "Que no es mucho tiempo, ahora que lo pienso. Casi no recuerdo nada."
              ]
            }
          ]
        }
      ]
    },

    /* DEXTER (solo Side B). El Bufón lo recuerda mal y lo afirma con seguridad.
       Se abre cuando oyen su nombre, tras conocer a Clef. Nunca habla del
       cuerpo ni de otras versiones. */
    {
      id: "dexter",
      boton: "Cuéntame lo de Dexter.",
      hechos: ["conocio_clef"],
      lados: ["B"],
      intro: {
        como: "recuerdo",
        lineas: [
          "Dexter.",
          "Ese nombre me suena a martillo olvidado en una cocina. No sé por qué. Los martillos y yo nunca fuimos amigos.",
          "Un científico, eso seguro. De los que te dan la mano y te cuentan los dientes.",
          "Y el laboratorio, a la entrada. Primera puerta a la derecha. De eso estoy completamente seguro."
        ]
      },
      preguntas: [
        {
          id: "centro", texto: "El laboratorio está en el centro.",
          lineas: [
            "En el centro, sí.",
            "Eso mismo estaba diciendo. Desde la entrada se ve mejor."
          ]
        },
        {
          id: "conoces", texto: "¿Lo conoces de verdad?",
          lineas: [
            "Lo conozco.",
            "De aquí no. De otra manera.",
            "...",
            "No me pidas más. Tengo dos recuerdos de Dexter y se llevan a patadas. Me quedo con el que me hace quedar mejor."
          ]
        },
        {
          id: "nigredo", texto: "Harrow nos habló del Nigredo. ¿Qué sabes?",
          requiere: ["conoces"], hechos: ["harrow_hablo_de_nigredo"],
          lineas: [
            "Es oscuridad. Pero de la que gotea.",
            "Dexter y el Nigredo en la misma frase me da una comezón. Como una canción que ya oí.",
            "Algo oscuro que se te mete por una ventana. Eso lo recuerdo. De quién era la ventana, no.",
            "Hablo de ventanas, que quede claro."
          ]
        }
      ]
    },

    /* LOS TRES DOCTORES (solo Side B). Sorel, Morcant y Nico. Con Nico el
       Bufón se queda sin chistes, porque es un niño. */
    {
      id: "doctores",
      boton: "¿Qué sabes de los tres doctores?",
      hechos: ["conocio_doctores"],
      lados: ["B"],
      intro: {
        como: "boton",
        lineas: [
          "Los doctores. Sí.",
          "Tres, ¿no? Uno viejo, uno joven y uno con una máscara.",
          "Huelen a cloro y a decisiones que tomó otro.",
          "Pregúntame por el que quieras."
        ]
      },
      preguntas: [
        {
          id: "sorel", texto: "¿Y el viejo?",
          lineas: [
            "Sorel. El que manda.",
            "Voz de lija y una vida entera de guerra.",
            "Hay médicos que miran a un herido y ven a alguien. Sorel mira y ve material.",
            "Lo que no hace es preguntarse para qué."
          ]
        },
        {
          id: "morcant", texto: "¿Y el joven?",
          lineas: [
            "Morcant. El que se emociona.",
            "Anota cómo reacciona la gente. Con cuaderno. Con entusiasmo.",
            "Y mira a Sorel con la devoción de un alumno que quiere la nota.",
            "Lo peor es que se le nota lo bien que lo pasa."
          ]
        },
        {
          id: "nico", texto: "¿Y Nico?",
          lineas: [
            "Nico.",
            "...",
            "Una máscara demasiado grande y alguien debajo que no se entera de lo que le toca.",
            "Cree que pelear con ustedes era entrenamiento. Que todo el mundo se levanta después.",
            "Alguien tendría que haberle explicado la diferencia. Nadie lo hizo. Es más cómodo no hacerlo.",
            "Busqué un chiste. No hay."
          ]
        },
        {
          id: "comerciante", texto: "¿No se parecen al Comerciante de Dávidas?",
          // Hecho de mesa del ciclo 2 (la máscara del Comerciante). No se usa
          // "tras" para que un diálogo sin ver no impida agotar el ciclo.
          requiere: ["sorel", "morcant"], hechos: ["chose_mask"],
          lineas: [
            "Se parecen en lo de usar lo que queda de otros.",
            "El Comerciante espera a que alguien termine de vivir. Estos no esperan.",
            "Entre un ladrón de cadáveres y alguien que lo hace con el dueño dentro, prefiero al ladrón. Que ya es decir."
          ]
        }
      ],
      // Opcional y excluyente: el menú no obliga a tomar partido.
      grupos: [
        {
          id: "que_hacer", requiere: ["sorel", "morcant"],
          opciones: [
            {
              id: "detener", texto: "Hay que detenerlos.",
              lineas: ["Los hicieron retroceder. Retroceder tiene mejor prensa que detener, pero algo es algo."]
            },
            {
              id: "asunto", texto: "No es asunto nuestro.",
              lineas: ["Muy sano. Pocos lo dicen en voz alta. Lo anoto."]
            },
            {
              id: "nose", texto: "No sé qué se hace.", neutral: true,
              lineas: ["Esa es la respuesta de los que lo pensaron. Yo tampoco tengo la mía."]
            }
          ]
        }
      ]
    },

    /* LA CORONA (solo Side B). Sarcasmo sobre la Corona de Balutia, que
       financia el Instituto Vesalio. Insinúa, no afirma. */
    {
      id: "corona",
      boton: "Lo de la Corona.",
      hechos: ["supo_de_vesalio"],
      lados: ["B"],
      intro: {
        como: "recuerdo",
        lineas: [
          "Instituto Vesalio. Qué nombre tan limpio.",
          "Lo financia la Corona de Balutia. Eso sí que me sorprende.",
          "No ha pasado nada. Ni una carta, ni un inspector, ni una ceja levantada.",
          "Qué despistada tiene que estar la Corona."
        ]
      },
      preguntas: [
        {
          id: "quien_paga", texto: "¿La Corona paga todo esto?",
          lineas: [
            "Oficialmente paga medicina. Es lo que pone en el letrero.",
            "Lo que pasa dentro no sale en la factura.",
            "Aunque ya me dirás qué cuesta más, un laboratorio entero o una carta preguntando por los niños."
          ]
        },
        {
          id: "sabe", texto: "¿Crees que la Corona lo sabe?", requiere: ["quien_paga"],
          lineas: [
            "Yo no digo nada.",
            "Digo que cuando alguien pregunta, la respuesta es siempre la misma. La guerra exige sacrificios.",
            "Qué guerra tan servicial.",
            "Y los sacrificios, siempre de los mismos. Qué casualidad."
          ]
        }
      ],
      grupos: [
        {
          id: "postura", requiere: ["sabe"],
          opciones: [
            {
              id: "hacer", texto: "Alguien debería hacer algo.",
              lineas: ["Alguien siempre debería. Ese es el problema de alguien."]
            },
            {
              id: "asunto", texto: "No es asunto nuestro.",
              lineas: ["Cómodo. Ahí no se pasa frío."]
            },
            {
              id: "nose", texto: "No lo sé.", neutral: true,
              lineas: ["Los que dudan son los que miran con más cuidado."]
            }
          ]
        }
      ]
    },

    /* LOS CAMBIANTES (solo la jugadora de Laia). No cierra el origen: mezcla
       las dos hipótesis que ya existen en el compendio. Se lo cuenta solo a
       ella para no exponerla. */
    {
      id: "cambiantes",
      boton: "Lo de los cambiantes.",
      hechos: ["harrow_ataco_laia"],
      lados: ["B"],
      jugadora: "laia",
      intro: {
        como: "recuerdo",
        lineas: [
          "Oye. Esto va solo para ti.",
          "La enfermera te miró como se mira un mueble raro. Eso lo vi.",
          "Los tuyos guardan lo suyo para quien lo acepta. Yo también sé guardar cosas. Por eso hablo contigo y con nadie más.",
          "A los demás no les hace falta saberlo."
        ]
      },
      preguntas: [
        {
          id: "hipotesis", texto: "¿Sabes de dónde vienen los cambiantes?",
          lineas: [
            "Claro que sé.",
            "Hubo un pacto. Con algo enorme, de esos que mueven las formas igual que se mueven fichas.",
            "Y también fue una mutación tan vieja que ya ni se acuerda de sí misma.",
            "Las dos cosas. A la vez. No hay problema.",
            "Si alguien te dice cuál es la buena, desconfía."
          ]
        },
        {
          id: "tratan", texto: "¿Cómo nos tratan en otros sitios?",
          lineas: [
            "Depende de dónde pises.",
            "En Asmodeo, sospecha abierta. Dicen que amenazas la identidad de la gente. De la gente de ellos, se entiende.",
            "En Sepulkrad hay comunidades enteras que te aceptan sin preguntas. Monstruos, sí. Para ellos la forma es lo de menos y la intención lo de más.",
            "Y la enfermera del laboratorio te trató como espécimen. Esa es una tercera forma y no la recomiendo."
          ]
        },
        {
          id: "curioso", texto: "¿Y tú qué quieres saber de mí?", requiere: ["hipotesis"],
          lineas: [
            "Una cosa. Nada más.",
            "¿Cómo es tener tantas caras?"
          ]
        },
        {
          id: "proposito", texto: "¿Por qué me cuentas todo esto?", requiere: ["caras"],
          lineas: [
            "Porque saliste a buscar por qué haces lo que haces.",
            "Eso me cae bien. Es la única pregunta que vale el viaje.",
            "Respuesta no tengo. Compañía, un rato."
          ]
        }
      ],
      grupos: [
        {
          id: "caras", requiere: ["curioso"],
          opciones: [
            {
              id: "una_real", texto: "Hay una que es la mía.",
              lineas: ["Qué suerte. Yo la busco desde hace un rato largo."]
            },
            {
              id: "ninguna", texto: "Todas son igual de reales.",
              lineas: ["Ya somos dos. Los demás insisten en que hay una buena. Llevo años dándole vueltas."]
            },
            {
              id: "nose", texto: "No lo sé.", neutral: true,
              lineas: ["Buena respuesta. La gente que lo sabe suele equivocarse."]
            }
          ]
        }
      ]
    },

    // @@TEMAS@@  (nuevo-tema agrega los temas nuevos justo encima de esta línea)
  ]
});
