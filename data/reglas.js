window.REGLAS = [
  {
    titulo: "Movimiento",
    descripcion: "Puedes moverte en cualquier momento durante tu turno (antes, después o durante las acciones). Limitado por la velocidad de movimiento.",
    items: [
      { label: "Moverse", detalle: "Costo: 5 pies por 5 pies en terreno normal." },
      { label: "Escalar", detalle: "Costo: 10 pies por 5 pies, salvo que tengas velocidad de escalada." },
      { label: "Nadar", detalle: "Costo: 10 pies por 5 pies, salvo que tengas velocidad de nado." },
      { label: "Tirarte al piso (Drop Prone)", detalle: "Costo: 0 pies. Quedas Derribado por voluntad propia." },
      { label: "Arrastrarse", detalle: "Costo: 10 pies por 5 pies. Es tu único movimiento posible mientras estés Derribado, salvo que te levantes primero." },
      { label: "Levantarse", detalle: "Costo: la mitad de tu velocidad. Si tu velocidad es 0, no puedes levantarte." },
      { label: "Salto de altura", detalle: "Con impulso de al menos 10 pies, saltas 3 pies + tu modificador de Fuerza; sin impulso, la mitad. Cuesta 1 pie de movimiento por cada pie saltado." },
      { label: "Salto de longitud", detalle: "Con impulso de al menos 10 pies, saltas una distancia igual a tu puntuación de Fuerza en pies; sin impulso, la mitad. Cuesta 1 pie de movimiento por cada pie saltado." },
      { label: "Improvisar", detalle: "Cualquier otro movimiento que el DM considere razonable." },
      { label: "Terreno difícil", detalle: "Costo: +5 pies por cada 5 pies recorridos." },
      { label: "Mover a una criatura agarrada", detalle: "Tu velocidad se reduce a la mitad, salvo que la criatura sea dos o más categorías de tamaño menor que tú." }
    ]
  },
  {
    titulo: "Acción",
    descripcion: "También puedes interactuar con un objeto o característica del entorno de forma gratuita. Máximo 1 por turno.",
    items: [
      { label: "Atacar", detalle: "Ataque cuerpo a cuerpo o a distancia. Algunas características de clase permiten repetir esta acción para realizar varios ataques." },
      { label: "Agarrar (Grapple)", detalle: "Sustituye a un ataque cuerpo a cuerpo. Prueba enfrentada de tu Atletismo contra la Atletismo o Acrobacias del objetivo (que debe ser, como máximo, una categoría de tamaño mayor que tú); si ganas, queda Agarrado." },
      { label: "Empujar (Shove)", detalle: "Sustituye a un ataque cuerpo a cuerpo. Misma prueba enfrentada que Agarrar; si ganas, derribas al objetivo o lo empujas 5 pies." },
      { label: "Lanzar un conjuro", detalle: "Tiempo de lanzamiento de 1 acción." },
      { label: "Correr (Dash)", detalle: "Añades tu velocidad al movimiento disponible este turno." },
      { label: "Destrabarse (Disengage)", detalle: "Tu movimiento no provoca ataques de oportunidad durante el resto del turno." },
      { label: "Esquivar (Dodge)", detalle: "Hasta el inicio de tu siguiente turno, los ataques contra ti tienen desventaja si puedes verlos, y tienes ventaja en salvaciones de Destreza." },
      { label: "Escapar de un agarre (Escape)", detalle: "Prueba de Atletismo o Acrobacias contra la CD de agarre de quien te sostiene; si tienes éxito, dejas de estar Agarrado." },
      { label: "Ayudar (Help)", detalle: "Un aliado obtiene ventaja en su próxima prueba relacionada con la tarea, o en su próximo ataque contra una criatura a 5 pies de ti." },
      { label: "Usar un objeto", detalle: "Interactuar con un segundo objeto durante el turno (el primero es gratuito)." },
      { label: "Usar un escudo", detalle: "Equipar o desequipar un escudo." },
      { label: "Esconderse", detalle: "Prueba de Sigilo contra la Percepción pasiva de quienes podrían detectarte." },
      { label: "Buscar", detalle: "Prueba de Percepción o Investigación, según qué estés buscando." },
      { label: "Preparar una acción (Ready)", detalle: "Eliges una circunstancia y una acción (incluido, si aplica, su objetivo); usas tu reacción para ejecutarla cuando ocurra." },
      { label: "Usar un rasgo de clase", detalle: "Algunos rasgos utilizan acciones — indicado en su propia descripción." },
      { label: "Estabilizar a una criatura", detalle: "Primeros auxilios a una criatura Moribunda. Prueba de Medicina CD 10, o el uso de un kit de sanador; la deja en 0 puntos de golpe sin necesidad de seguir tirando salvaciones de muerte." },
      { label: "Improvisar", detalle: "Cualquier acción no en esta lista, a discreción del DM." }
    ]
  },
  {
    titulo: "Acción Adicional",
    descripcion: "Puedes realizar una acción adicional sólo cuando una habilidad, conjuro o característica especial indica que puedes hacer algo como acción adicional. Máximo 1 por turno.",
    items: [
      { label: "Ataque con dos armas", detalle: "Se usa junto con la acción de Ataque, siempre que ambas armas sean ligeras; no sumas tu modificador de característica al daño salvo que sea negativo." },
      { label: "Lanzar un conjuro", detalle: "Lanzamiento de 1 acción adicional. Si ya lanzaste un conjuro con tu acción este turno, el otro debe ser un truco con tiempo de lanzamiento de 1 acción." },
      { label: "Usar un rasgo de clase", detalle: "Rasgos que utilizan 1 acción adicional — indicado en su propia descripción." }
    ]
  },
  {
    titulo: "Reacción",
    descripcion: "Una reacción es una respuesta instantánea a un desencadenante de algún tipo, que puede ocurrir en su turno o en el de otra persona. Máximo 1 por ronda.",
    items: [
      { label: "Ataque de oportunidad", detalle: "El enemigo sale de tu alcance sin usar Destrabarse. Un único ataque cuerpo a cuerpo contra él." },
      { label: "Acción preparada (Readied action)", detalle: "Se activa cuando ocurre la circunstancia que declaraste al Preparar una acción." },
      { label: "Lanzar un conjuro", detalle: "Tiempo de lanzamiento de 1 reacción, normalmente ligado a un desencadenante que el propio conjuro especifica." }
    ]
  },
  {
    titulo: "Acciones Opcionales",
    descripcion: "Opciones adicionales de Acciones (reglas opcionales del Dungeon Master Guide). Máximo 1 por turno.",
    items: [
      { label: "Subirse a una criatura más grande", detalle: "Ataque cuerpo a cuerpo o a distancia contra un objetivo Grande o mayor; si impacta, puedes moverte a un espacio sobre ella en vez de infligir daño." },
      { label: "Desarmar", detalle: "Ataque especial cuerpo a cuerpo. Tirada de ataque contra la CA del objetivo; si impacta, este suelta un objeto de su elección." },
      { label: "Marcar", detalle: "Ataque cuerpo a cuerpo que sacrifica precisión (desventaja en la tirada) a cambio de que tu próximo ataque contra el mismo objetivo tenga ventaja." },
      { label: "Abrirse Paso (Overrun)", detalle: "Acción o Acción adicional. Prueba de Atletismo enfrentada contra Atletismo o Acrobacias del objetivo; si ganas, puedes atravesar su espacio." },
      { label: "Empujar a un lado", detalle: "Ataque especial cuerpo a cuerpo. Prueba de Atletismo enfrentada; si ganas, desplazas al objetivo a un espacio adyacente sin provocar ataques de oportunidad." },
      { label: "Rodar (Tumble)", detalle: "Acción o Acción adicional. Prueba de Acrobacias enfrentada contra Atletismo; si ganas, puedes atravesar el espacio del objetivo." }
    ]
  },
  {
    titulo: "Estados",
    descripcion: "Los estados alteran tus capacidades de varias maneras y pueden surgir como resultado de un conjuro, una característica de clase, un ataque de monstruo u otro efecto. La mayoría termina cuando expira la duración del efecto que lo causó, cuando superas la salvación indicada, o mediante la magia curativa apropiada.",
    items: [
      { label: "Cegado (Blinded)", detalle: "No puedes ver y fallas automáticamente cualquier prueba que dependa de la vista. Los ataques contra ti tienen ventaja, y los tuyos, desventaja. Termina al desaparecer su causa, o mediante magia como Restablecimiento Menor." },
      { label: "Hechizado (Charmed)", detalle: "No puedes atacar a quien te hechizó ni dirigir contra él habilidades o efectos dañinos, y esa criatura tiene ventaja en las pruebas sociales que intente contigo. Termina al expirar la duración del efecto, si quien te hechizó te hace daño, o mediante magia como Disipar Magia." },
      { label: "Ensordecido (Deafened)", detalle: "No puedes oír y fallas automáticamente cualquier prueba que dependa del oído. Termina al desaparecer su causa, o mediante magia como Restablecimiento Menor." },
      { label: "Cansancio (Exhaustion)", detalle: "Se acumula en niveles (máximo 6). 1: desventaja en pruebas de característica. 2: velocidad reducida a la mitad. 3: desventaja en ataques y salvaciones. 4: puntos de golpe máximos reducidos a la mitad. 5: velocidad reducida a 0. 6: mueres. Un descanso largo reduce el Cansancio en 1 nivel, siempre que hayas comido y bebido." },
      { label: "Asustado (Frightened)", detalle: "Tienes desventaja en pruebas de característica y ataques mientras la fuente de tu miedo esté a la vista, y no puedes acercarte a ella voluntariamente. Termina al expirar su duración o al superar la salvación correspondiente." },
      { label: "Agarrado (Grappled)", detalle: "Tu velocidad se reduce a 0. Termina si quien te agarra queda Incapacitado, si te alejan de su alcance mediante algún efecto, o si tienes éxito en la acción de Escapar." },
      { label: "Incapacitado (Incapacitated)", detalle: "No puedes realizar acciones ni reacciones. Termina al desaparecer la causa que lo provoca." },
      { label: "Invisible", detalle: "No te pueden ver sin un sentido especial, y se te considera fuertemente oscurecido para esconderte. Tus ataques tienen ventaja, y los ataques contra ti, desventaja. Termina al expirar la duración del efecto que lo causó." },
      { label: "Paralizado (Paralyzed)", detalle: "Estás Incapacitado y no puedes moverte ni hablar. Fallas automáticamente las salvaciones de Fuerza y Destreza. Los ataques contra ti tienen ventaja, y cualquier golpe cuerpo a cuerpo desde 5 pies o menos es crítico automático. Termina al expirar su duración o al superar la salvación correspondiente." },
      { label: "Petrificado (Petrified)", detalle: "Tú y tus posesiones no mágicas se transforman en una sustancia sólida, normalmente piedra. Estás Incapacitado, no puedes moverte ni hablar, y no percibes tu entorno. Fallas automáticamente las salvaciones de Fuerza y Destreza; los ataques contra ti tienen ventaja. Tienes resistencia a todo el daño y eres inmune a veneno y enfermedad — cualquier veneno o enfermedad previo queda suspendido, no curado. Termina mediante magia como Restablecimiento Mayor." },
      { label: "Envenenado (Poisoned)", detalle: "Tienes desventaja en tiradas de ataque y en pruebas de característica. Termina al expirar la duración del veneno, al superar la salvación de Constitución correspondiente (normalmente al final de cada turno, o una sola vez, según la fuente), o mediante magia curativa como Restablecimiento Menor o el conjuro Neutralizar Veneno." },
      { label: "Derribado (Prone)", detalle: "Tu único movimiento posible es arrastrarte, salvo que te levantes primero (cuesta la mitad de tu velocidad). Tienes desventaja en tiradas de ataque. Un ataque cuerpo a cuerpo contra ti tiene ventaja si el atacante está a 5 pies o menos; cualquier otro ataque tiene desventaja." },
      { label: "Apresado (Restrained)", detalle: "Tu velocidad se reduce a 0. Los ataques contra ti tienen ventaja, los tuyos, desventaja, y tienes desventaja en salvaciones de Destreza. Termina al desaparecer la causa (se corta la red, se destruye la telaraña) o al superar la prueba o salvación correspondiente para liberarte." },
      { label: "Aturdido (Stunned)", detalle: "Estás Incapacitado, no puedes moverte, y solo hablas de forma entrecortada. Fallas automáticamente las salvaciones de Fuerza y Destreza. Los ataques contra ti tienen ventaja. Termina al expirar su duración o al superar la salvación correspondiente." },
      { label: "Inconsciente (Unconscious)", detalle: "Estás Incapacitado, no puedes moverte ni hablar, y no percibes tu entorno. Sueltas lo que sostengas y caes Derribado. Fallas automáticamente las salvaciones de Fuerza y Destreza; los ataques contra ti tienen ventaja, y cualquier golpe cuerpo a cuerpo desde 5 pies o menos es crítico automático. Termina al recuperar al menos 1 punto de golpe." },
      { label: "Muriendo (Dying)", detalle: "Al llegar a 0 puntos de golpe caes Inconsciente y haces una salvación de muerte (d20 sin modificadores) al inicio de cada uno de tus turnos: 10 o más es éxito, menos de 10 es fallo. Tres éxitos te estabilizan; tres fallos te matan. Un 20 natural te devuelve 1 punto de golpe; un 1 natural cuenta como dos fallos. Recibir daño mientras estás a 0 puntos de golpe causa un fallo automático (dos si es un crítico), y si el daño iguala o supera tus puntos de golpe máximos, mueres de inmediato." }
    ]
  },
  {
    titulo: "Efectos Ambientales",
    descripcion: "Los efectos que oscurecen la visión pueden ser un obstáculo importante para la mayoría de las tareas de aventura.",
    items: [
      { label: "Ligeramente obscuro", detalle: "Desventaja en pruebas de Percepción que dependan de la vista." },
      { label: "Muy obscuro", detalle: "Se te considera Cegado dentro del área — fallas pruebas que requieran vista, y tienes desventaja en tus ataques mientras los ataques contra ti tienen ventaja — salvo que poseas visión en la oscuridad o un sentido equivalente." },
      { label: "Luz brillante", detalle: "Visión normal." },
      { label: "Luz tenue", detalle: "Crea una zona Ligeramente obscura." },
      { label: "Obscuridad", detalle: "La ausencia de luz crea una zona Muy obscura." },
      { label: "Visión ciega", detalle: "Percibes tu entorno sin depender de la vista dentro de un radio determinado (ecolocalización, olfato, vibración); no ves más allá de ese radio." },
      { label: "Visión en la obscuridad", detalle: "Ves en la oscuridad hasta cierta distancia como si fuera penumbra, y en penumbra como si fuera luz brillante; solo distingues tonos de gris, no colores." },
      { label: "Visión verdadera", detalle: "Ves con normalidad en la oscuridad (incluida la mágica), detectas formas invisibles, reconoces ilusiones como falsas, y percibes el plano etéreo, dentro de un radio determinado." },
      { label: "Cobertura media", detalle: "Muro bajo, mueble grande, criaturas. +2 a la CA y a las salvaciones de Destreza." },
      { label: "Cobertura tres cuartos", detalle: "Rastrillo, aspillera, tronco grueso. +5 a la CA y a las salvaciones de Destreza." },
      { label: "Cobertura completa", detalle: "Completamente oculto. No puede ser objetivo directo de un ataque o conjuro." }
    ]
  },
  {
    titulo: "Descansar",
    descripcion: "Los aventureros pueden hacer descansos cortos a lo largo del día y un descanso largo al final de este.",
    items: [
      { label: "Descanso corto", detalle: "Al menos una hora dedicada a actividad ligera (comer, leer, vendar heridas). Puedes gastar Dados de Golpe para recuperar puntos de golpe, y algunas características de clase se recuperan al terminarlo." },
      { label: "Descanso largo", detalle: "Al menos ocho horas, con un mínimo de seis dedicadas a dormir o actividad ligera. Recuperas todos tus puntos de golpe y la mitad de tus Dados de Golpe totales (mínimo 1), además de espacios de conjuro y la mayoría de las características de clase. Reduce el Cansancio en 1 nivel si comiste y bebiste. No puedes beneficiarte de más de uno en un período de 24 horas, y necesitas al menos 1 punto de golpe al comenzarlo." }
    ]
  }
];
