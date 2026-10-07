/* =============================================================================
   CICLO 3 — FASE 3. Mismo material para Side A y Side B.

   Lo reciben solo los jugadores que estén en el ciclo 3. Nadie lo está hasta
   que el Admin los mueva desde "Progreso del Bufón" (a un lado entero o a un
   jugador). Admin siempre lo ve, para poder preparar y revisar contenido.

   Formato y reglas: ver data/bufon-ciclos.js y tools/bufon/LEEME.md.
============================================================================= */
window.bufonAgregarCiclo({
  id: "fase3",
  numero: 3,
  nombre: "Fase 3",
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

    // @@TEMAS@@  (nuevo-tema agrega los temas nuevos justo encima de esta línea)
  ]
});
