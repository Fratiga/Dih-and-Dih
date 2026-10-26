/* =============================================================================
   CICLO 3 — EL LABORATORIO Y TEROS.

   Teros es para Side A y Side B. Los temas del laboratorio (Dexter, los tres
   doctores y la Corona) son solo de Side B, y cada uno se destapa con un hecho
   de la mesa (ver BUFON_HECHOS_CONOCIDOS.B en data/bufon-evidencia.js). El tema
   de los cambiantes es solo para la jugadora de Laia.

   Lo reciben solo los jugadores que estén en el ciclo 3. Nadie lo está hasta
   que el Admin los mueva desde "Progreso del Bufón" (a un lado entero o a un
   jugador). Admin siempre lo ve, para poder preparar y revisar contenido.

   Editado con el Laboratorio del Bufón (2026-10-26). Las Voces aparecen como
   líneas { voz, texto } y suman puntos con "voces". Una línea de Voz solo se ve
   si esa Voz ya está en Murmullo o más, y con nombre, color e icono desde
   Despertar. Ningún nodo es solo de Voces: todos tienen líneas del Bufón.

   Formato y reglas: ver data/bufon-ciclos.js.
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
      boton: "¿Minotauro?",
      intro: {
        como: "recuerdo",
        lineas: [
          "Se me vino un minotauro a la cabeza.",
          "Enorme. Más ancho que una puerta y con mucha menos paciencia.",
          "No sé de dónde lo saqué. No parece de por aquí.",
          "Se llamaba Teros...? Teros y algo más."
        ],
        animacion: "Apuntando"
      },
      preguntas: [
        {
          id: "no_importa",
          texto: "No me interesa quién sea.",
          cierra: true,
          lineas: [
            "Hah. Qué directo.",
            "Está bien. El minotauro no se va a ofender.",
            "Tampoco creo que lo vean."
          ]
        },
        {
          id: "quien",
          texto: "¿Quién era?",
          lineas: [
            "Un borracho. De los buenos, bueno, de los malos.",
            "Rompía mesas por deporte y deudas por costumbre. Fuerte como tres hombres y sin ninguna gana de servir para algo.",
            "Lo condenaron a la horca. Lo normal, la verdad.",
            "Lo que no fue normal es que se soltó. Y no dejó a mucha gente en pie.",
            "Dejó vivo a uno. Un solo niño. Lo tuvo delante, con la mano ya lista, y se quedó mirándolo.",
            "El pequeño infeliz era del tamaño de la palma de su mano.",
            "Bueno, él no era un animal después de todo. ¿O sí?",
            "Creo que lo tomaría como un insulto, no le digas que dude de eso."
          ]
        },
        {
          id: "templo",
          texto: "¿Y qué hizo después de escapar?",
          requiere: ["quien"],
          lineas: [
            "Llegó a un templo por accidente. Buscaba dónde esconderse pero lo sorprendieron sus residentes.",
            "Los monjes no le preguntaron qué había hecho. Le dieron una escoba.",
            "Barrió ese patio un año entero. Agradeció cada barrido a cada estatua del templo.",
            "Pasó el resto de su vida intentando arreglar lo que rompió. Pueblos, deudas, una viuda que no quería verlo ni en pintura. Algunas cosas se arreglaron. Otras se quedaron rotas, y esas las cargó él.",
            "Eso es lo molesto sobre los que se reforman. Cargan el pasado como una maleta molesta que nadie les pidió y nunca la dejan en el suelo.",
            "Es una teoría. Pero aplica a varios de los reformados que he visto."
          ]
        },
        {
          id: "final",
          texto: "¿Cómo terminó?",
          requiere: ["templo"],
          lineas: [
            "Años después alguien tocó a su puerta. Reconoció la cara antes que la edad.",
            "Era el niño. Había crecido y no se había olvidado.",
            "Teros lo vio venir. Podía haberlo detenido con una mano. No, ¡con un dedo!",
            "Pero no levantó la mano.",
            "...",
            "Dijo que le tocaba. Y se dejó caer por su mano.",
            "Bueno, daga.",
            "Algo dijo sobre que mucho tiempo sus sueños habían sido invadidos por esta escena.",
            { voz: "herida", texto: "El niño tampoco durmió bien en todos esos años." },
            "Yo habría peleado. Soy un mal ejemplo.",
            "No sé si esto lo recuerdo o lo soñé. Pero cada vez que llego a esta parte me quedo sin chistes. Pasa pocas veces.",
            "Siento que él era importante para alguien, podrías preguntar.",
            { voz: "hilo", texto: "Quien lo recuerda así sabe más de lo que dice. Pregunta." },
            "Si algún día te cruzas con algún minotauro que se le parezca, saluda de mi parte.",
            "O no, tal vez sea un poco incómodo."
          ]
        }
      ],
      grupos: [
        {
          id: "merecia",
          requiere: ["final"],
          opciones: [
            {
              id: "si",
              texto: "Sí, se lo merecía.",
              lineas: [
                "Mucha gente diría lo mismo. El niño, para empezar.",
                "Teros también lo pensaba. Eso es lo que me molesta.",
                "Los redimidos tienen la mala práctica de morir en paz a pesar del daño que causaron.",
                "¿Dónde queda el daño que él infligió? ¿Lo que se merece no es un fin como el que él le entregó a tanta gente?",
                "¿Con miedo, desesperación y odio?",
                "Bueno, se arrepintió durante muchos años para llegar a esa paz, de algo le habrá valido."
              ]
            },
            {
              id: "no",
              texto: "No, no se lo merecía.",
              lineas: [
                "A mí tampoco me lo parece.",
                "Pero rompió demasiado como para que la cuenta saliera en cero.",
                "Lamentablemente era el tipo de hombre capaz de justificar cualquier cosa cuando estaba lo suficientemente enfadado.",
                "Que aprendiera a no enfadarse después fue en respuesta a eso."
              ]
            },
            {
              id: "nose",
              texto: "No lo sé.",
              neutral: true,
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
          "Ese nombre me suena a plato olvidado en una cocina. No sé por qué.",
          "Un científico, eso seguro. Uno de esos que uno saluda y te cuentan los dientes.",
          "Y el laboratorio, a la entrada. Primera puerta a la derecha. De eso estoy completamente seguro.",
          { voz: "testigo", texto: "Clef dijo que Dexter trabaja en el centro." },
          { voz: "coartada", texto: "No lo corrijas. Una versión equivocada también sirve." }
        ]
      },
      preguntas: [
        {
          id: "centro",
          texto: "¿El laboratorio no estaba en el centro...?",
          voces: { testigo: 2 },
          lineas: [
            "En el centro, sí.",
            "Me confundí.",
            "Eso mismo estaba intentando decir. Desde la entrada se ve mejor."
          ]
        },
        {
          id: "conoces",
          texto: "¿Lo conoces de verdad?",
          voces: { grieta: 1 },
          lineas: [
            "Lo conozco.",
            "No, la verdad, nunca lo he visto, y ustedes tampoco.",
            "...",
            "No me pidas más. Tengo dos recuerdos de Dexter y se llevan a patadas.",
            { voz: "grieta", texto: "Dos recuerdos que se pelean. Pregunta cuál ganó." }
          ]
        },
        {
          id: "nigredo",
          texto: "Harrow nos habló del Nigredo. ¿Qué sabes?",
          requiere: ["conoces"],
          hechos: ["harrow_hablo_de_nigredo"],
          voces: { hilo: 2 },
          lineas: [
            "Ah, sí. En términos simples es una especie de icor negro.",
            "Básicamente es oscuridad. Pero que gotea.",
            "Dexter y el Nigredo en la misma frase me da una comezón. Como una canción que se me pegó hace tiempo.",
            "Algo oscuro que se te mete por una ventana. Eso lo recuerdo. De quién era la ventana, no, la verdad.",
            "Hablo de ventanas, que quede claro.",
            { voz: "hilo", texto: "Una ventana y algo oscuro que entra. Tira de ese hilo." }
          ]
        }
      ],
      grupos: []
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
          "Tres, ¿no? Uno viejo, uno joven y uno pequeño.",
          { voz: "testigo", texto: "Baltasar Sorel, Elías Morcant y Nico. Así aparecieron." },
          "Huelen a cloro y a decisiones que tomó otro.",
          "Pregúntame por el que quieras."
        ]
      },
      preguntas: [
        {
          id: "sorel",
          texto: "¿El viejo?",
          lineas: [
            "Sorel. Es básicamente el padre de los otros dos.",
            "Voz de lija y una vida entera de guerra.",
            "El tipo de médico que ve a un herido y ve material con el que trabajar.",
            "Lo que no hacía era preguntarse para qué.",
            "Quien le respondió esa duda lo cambió para siempre.",
            { voz: "hilo", texto: "Alguien le respondió esa duda. Pregunta quién." }
          ]
        },
        {
          id: "morcant",
          texto: "¿El joven?",
          lineas: [
            "Morcant. Un adolescente un poco creído para mi gusto.",
            "Anota cómo reacciona la gente. Con cuaderno. Con entusiasmo.",
            "Y mira a Sorel con la devoción de un alumno que quiere su nota.",
            "Lo peor es que se nota lo bien que lo pasa hasta a través de la máscara.",
            { voz: "rostro", texto: "Una máscara no esconde lo que la cara quiere decir." }
          ]
        },
        {
          id: "nico",
          texto: "¿El pequeño?",
          voces: { herida: 1 },
          lineas: [
            "Nico. El peque.",
            "Una máscara demasiado grande y alguien debajo que no se entera de lo que le toca.",
            "Cree que pelear con ustedes era divertido. Que todo el mundo se levanta después.",
            "Alguien tendría que haberle explicado la diferencia. Nadie lo hizo.",
            "...",
            "Se asustó mucho cuando Sorel no se estaba levantando.",
            { voz: "herida", texto: "Tenía miedo y nadie le preguntó si estaba bien." }
          ]
        },
        {
          id: "comerciante",
          texto: "¿No se parecen al Comerciante de Dávidas?",
          requiere: ["sorel", "morcant"],
          hechos: ["chose_mask"],
          lineas: [
            "Se parecen en lo de usar lo que queda de otros.",
            "Al menos el Comerciante espera a que terminen de vivir.",
            "Ellos son mucho menos pacientes.",
            "Entre un ladrón de cadáveres y alguien que lo hace con el dueño aún vivo, prefiero al ladrón. Que ya es decir.",
            { voz: "apetito", texto: "Los dos se alimentan de otros. Solo cambia cuándo muerden." }
          ]
        }
      ],
      grupos: [
        {
          id: "que_hacer",
          requiere: ["sorel", "morcant"],
          opciones: [
            {
              id: "detener",
              texto: "Hay que detenerlos.",
              lineas: [
                "Los hicieron retroceder. Retroceder tiene mejor prensa que detener, pero algo es algo."
              ]
            },
            {
              id: "asunto",
              texto: "No es asunto nuestro.",
              voces: { muralla: 1 },
              lineas: [
                "Muy sano. Pocos lo dicen en voz alta. Lo anoto.",
                { voz: "muralla", texto: "Así se cierra una puerta sin dar explicaciones." }
              ]
            },
            {
              id: "nose",
              texto: "No sé qué se hace en situaciones así.",
              neutral: true,
              lineas: ["La incertidumbre no te queda. Aunque yo pensé lo mismo."]
            }
          ]
        }
      ]
    },

    /* LA CORONA (solo Side B). Sarcasmo sobre la Corona que financia el
       Instituto Vesalio. Insinúa, no afirma. */
    {
      id: "corona",
      boton: "Lo de la Corona.",
      hechos: ["supo_de_vesalio"],
      lados: ["B"],
      intro: {
        como: "recuerdo",
        lineas: [
          "Instituto Vesalio. ¿Te suena?",
          "Un nombre tan limpio.",
          "Lo financia la Corona de Brurland. Quién lo diría.",
          "No ha pasado nada. Ni una carta, ni un inspector, ni una ceja levantada.",
          "Qué despistada tiene que estar la Corona, jaja."
        ]
      },
      preguntas: [
        {
          id: "quien_paga",
          texto: "¿La Corona paga todo esto?",
          lineas: [
            "Oficialmente paga medicina y el plan público de salud.",
            "Lo que pasa dentro no sale en la factura.",
            "Aunque ya me dirás qué cuesta más, un laboratorio entero o una carta preguntando por los niños.",
            "Bueno, más de 500 niños desaparecen en Brurland al año, es de esperarse.",
            { voz: "herida", texto: "Más de quinientos al año. Cada uno tenía un nombre." }
          ]
        },
        {
          id: "sabe",
          texto: "¿Crees que la Corona lo sabe?",
          requiere: ["quien_paga"],
          voces: { grieta: 1 },
          lineas: [
            "Yo no digo nada.",
            "Digo que cuando alguien pregunta, la respuesta es siempre la misma. La guerra exige sacrificios.",
            "La guerra más servicial que ha tenido la Corona.",
            "Y los sacrificios, siempre de los mismos. Qué casualidad.",
            { voz: "grieta", texto: "No contestó a lo que preguntaste. Insiste." }
          ]
        }
      ],
      grupos: [
        {
          id: "postura",
          requiere: ["sabe"],
          opciones: [
            {
              id: "hacer",
              texto: "Alguien debería hacer algo.",
              lineas: [
                "Alguien siempre debería. Ese es el problema de alguien.",
                "Pobre alguien, siempre debería hacer algo, ¿cuándo le toca a otro?",
                "¿Qué tal tú?",
                "¿Gastarías tu vida entera en intentar arreglar lo que él hizo?",
                "¿Cada aspiración, deseo, relación y futuro?",
                "Tal vez deberías pensar en eso antes de jugar a ser el héroe.",
                { voz: "apetito", texto: "Quieres hacerlo. Admítelo." }
              ]
            },
            {
              id: "asunto",
              texto: "No es asunto nuestro.",
              voces: { muralla: 1 },
              lineas: [
                "Buenísima. Ahí no se pasa frío.",
                { voz: "muralla", texto: "Lo que piensas, te lo guardas." }
              ]
            },
            {
              id: "nose",
              texto: "No lo sé.",
              neutral: true,
              lineas: ["Los que dudan son los mejores cómplices."]
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
          "La enfermera te miró como un mueble raro. Eso lo vi.",
          "Los tuyos guardan lo suyo para quien lo acepta. Yo también sé guardar cosas. Por eso hablo contigo y con nadie más.",
          "A los demás no les hace falta saberlo.",
          { voz: "muralla", texto: "Lo que te cuenta es para ti. No hace falta repetirlo." }
        ]
      },
      preguntas: [
        {
          id: "hipotesis",
          texto: "¿Sabes de dónde vienen los cambiantes?",
          voces: { hilo: 1 },
          lineas: [
            "Claro que sé.",
            "Hubo un pacto. Con algo enorme, con fuerzas que mueven las formas igual que se mueven fichas en un tablero.",
            "Y también fue una mutación tan vieja que ya ni se acuerda de sí misma.",
            "Las dos cosas. A la vez.",
            "Siempre intentan diferenciarlas, te juro que algunos no saben leer.",
            "Si alguien te dice cuál es la buena, desconfía.",
            { voz: "hilo", texto: "Dos explicaciones que se pisan. Algo las une." }
          ]
        },
        {
          id: "tratan",
          texto: "¿Cómo nos tratan en otros sitios?",
          lineas: [
            "Depende de dónde pises.",
            "En Asmodeo, sospecha abierta. Dicen que amenazas la identidad de la gente. Viniendo de ellos, se entiende.",
            "En Sepulkrad hay comunidades enteras que te aceptan sin preguntas. Monstruos, sí. Para ellos la forma física es lo de menos.",
            "Y la enfermera del laboratorio te trató como espécimen. Esa es una tercera forma y no la recomiendo, te noté bastante incómodo.",
            { voz: "testigo", texto: "Harrow quiso quedarse contigo para estudiarte. Eso pasó tal cual." },
            "Aunque bueno. ¿Quién sabe qué descubrimientos hubiesen podido lograr contigo? Los cambiantes y el Nigredo van de la mano.",
            "La alquimia es así de virtuosa, ya ves."
          ]
        },
        {
          id: "curioso",
          texto: "¿Y tú qué quieres saber de mí?",
          requiere: ["hipotesis"],
          lineas: [
            "Una cosa. Nada más.",
            "¿Cómo es tener tantas caras?",
            { voz: "rostro", texto: "Dile qué cara usas cuando nadie mira." }
          ]
        },
        {
          id: "proposito",
          texto: "¿Por qué me cuentas todo esto?",
          requiere: ["caras"],
          lineas: [
            "Porque saliste a descubrirte a ti mismo, ¿no?",
            "Eso me cae bien. Es la única pregunta que vale el viaje en mi experiencia.",
            "Respuesta de eso no tengo, lamentablemente. Compañía, tengo para un rato.",
            { voz: "coartada", texto: "Te dice lo que quieres oír. Quédate con la versión que te sirve." }
          ]
        }
      ],
      grupos: [
        {
          id: "caras",
          requiere: ["curioso"],
          opciones: [
            {
              id: "una_real",
              texto: "Hay una que es la mía.",
              voces: { rostro: 1 },
              lineas: ["Qué suerte. Yo busco la mía desde hace un buen rato ya."]
            },
            {
              id: "ninguna",
              texto: "Todas son igual de reales.",
              voces: { rostro: 2 },
              lineas: [
                "Ya somos dos. Los demás insisten en que hay una sola que es la buena. Llevo muchos años dándole vueltas a esa idea."
              ]
            },
            {
              id: "nose",
              texto: "No lo sé.",
              neutral: true,
              lineas: [
                "Buena respuesta. La gente que responde con seguridad a eso suele equivocarse."
              ]
            }
          ]
        }
      ]
    },

    // @@TEMAS@@  (nuevo-tema agrega los temas nuevos justo encima de esta línea)
  ]
});
