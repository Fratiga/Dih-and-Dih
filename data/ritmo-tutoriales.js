// Minitutoriales del editor de mapas. Cada lección tiene pasos cortos; "objetivo" es lo que se
// resalta en la página (un selector de CSS o una lista de ellos), "tab" abre esa pestaña de
// herramientas y "abrir" despliega una sección.
window.RITMO_TUTORIALES = [
  {
    id: "basico",
    titulo: "Primeros pasos",
    resumen: "Cargar un mapa y escucharlo.",
    pasos: [
      { texto: "Elige la canción en esta lista. Las que suben los DJ también salen aquí.", objetivo: "#reCancion" },
      { texto: "Elige la dificultad. Cada una tiene su propio mapa.", objetivo: ".re-segmentos[data-para='reDif']" },
      { texto: "«Cargar automático» genera el mapa con el mismo motor que usa el juego. Si ya hay uno guardado, usa «Cargar guardado».", objetivo: ".re-campo-botones" },
      { texto: "Dale a ▶ o pulsa Espacio. Con el sonido de notas y el metrónomo oyes si todo cae donde debe.", objetivo: ".re-transporte" },
      { texto: "Ctrl + rueda hace zoom y la rueda sola mueve la línea de tiempo. Haz clic en la regla o en la onda para saltar a otro punto.", objetivo: "#reLienzo" }
    ]
  },
  {
    id: "notas",
    titulo: "Poner y mover notas",
    resumen: "Clic para poner, arrastrar para mover.",
    pasos: [
      { texto: "Haz clic en un carril, el de arriba o el de abajo, para poner una nota. Se pega a la cuadrícula del pulso.", objetivo: "#reLienzo" },
      { texto: "Con «Ajuste» decides a qué parte del pulso se pegan: pulso entero, mitades, cuartos o libre.", objetivo: ".re-segmentos[data-para='reSnap']" },
      { texto: "Arrastra una nota para moverla. Clic derecho la borra.", objetivo: "#reLienzo" },
      { texto: "Deshacer y rehacer están a la derecha de las herramientas. También con Ctrl + Z y Ctrl + Y.", objetivo: ".re-tabs-der" }
    ]
  },
  {
    id: "largas",
    titulo: "Largas y dobles",
    resumen: "Notas que se mantienen y notas de dos carriles.",
    pasos: [
      { texto: "Elige una nota y pulsa H. Se vuelve larga. Arrastra el borde de la barra para alargarla o acortarla.", objetivo: "#reLarga", tab: "notas" },
      { texto: "Una doble pide los dos carriles a la vez. Elige una nota y pulsa D.", objetivo: "#reDoble", tab: "notas" },
      { texto: "Una larga no puede pisar otra nota de su mismo carril. Si pasa, el editor lo corrige solo al guardar.", objetivo: "#reLienzo" }
    ]
  },
  {
    id: "varias",
    titulo: "Elegir varias notas",
    resumen: "Cajas, Ctrl + clic y acciones en grupo.",
    pasos: [
      { texto: "Mayús + arrastrar en un hueco dibuja una caja. Todas las notas que queden dentro se eligen.", objetivo: "#reLienzo" },
      { texto: "Ctrl + clic suma o quita una nota. Ctrl + A elige todas y Esc quita la selección. El contador te dice cuántas llevas.", objetivo: "#reSelCuenta" },
      { texto: "«Elegir las del tramo» toma todas las notas de los tramos que marcaste en la franja de colores.", objetivo: "#reSelTramo", tab: "notas" },
      { texto: "Con varias elegidas puedes arrastrarlas juntas, cambiarles el carril, hacerlas largas o dobles, moverlas 10 ms con las flechas, copiarlas o borrarlas.", objetivo: ".re-panel-tool[data-panel='notas']", tab: "notas" }
    ]
  },
  {
    id: "tramos",
    titulo: "Tramos y bandas",
    resumen: "Qué sonido sigue cada parte de la canción.",
    pasos: [
      { texto: "La franja de colores de arriba muestra qué banda sigue cada tramo: graves en rojo, medios en verde y agudos en azul.", objetivo: "#reLienzo" },
      { texto: "Haz clic en un tramo para elegirlo. Con Mayús + clic eliges varios seguidos.", objetivo: "#reLienzo" },
      { texto: "Dile qué banda quieres. Las notas de esos tramos se generan de nuevo siguiéndola.", objetivo: ".re-panel-tool[data-panel='tramos']", tab: "tramos" },
      { texto: "«Sin notas» deja el tramo vacío y «Automático» vuelve a lo que decidió el motor.", objetivo: ".re-panel-tool[data-panel='tramos']", tab: "tramos" }
    ]
  },
  {
    id: "pulso",
    titulo: "Arreglar el pulso",
    resumen: "Cuando el tempo se descuadra.",
    pasos: [
      { texto: "Activa el metrónomo y escucha. Si se separa de la música, el pulso está mal en esa parte.", objetivo: "#reMetro" },
      { texto: "Elige en la franja de colores los tramos con el problema.", objetivo: "#reLienzo" },
      { texto: "«Regularizar» deja los pulsos a la misma distancia. «Pulso al cursor» alinea uno con el cursor, y ±10 ms los desplaza un poco.", objetivo: ".re-panel-tool[data-panel='pulso']", tab: "pulso" },
      { texto: "Las notas que ya pusiste no se mueven. Si quieres que sigan al pulso nuevo, genera el tramo otra vez desde la pestaña Tramos.", objetivo: ".re-panel-tool[data-panel='pulso']", tab: "pulso" }
    ]
  },
  {
    id: "copiar",
    titulo: "Copiar y pegar",
    resumen: "Repetir una parte en otro sitio.",
    pasos: [
      { texto: "Elige notas, o tramos si no hay notas elegidas, y pulsa «Copiar» (Ctrl + C).", objetivo: "#reCopiar", tab: "copiar" },
      { texto: "Pon el cursor donde quieras y usa «Pegar en el cursor», o elige un tramo y usa «Pegar en el tramo elegido» (Ctrl + V).", objetivo: ".re-panel-tool[data-panel='copiar']", tab: "copiar" },
      { texto: "Las notas se copian en pulsos, no en segundos, así encajan aunque el tempo cambie. «Sumar» pega sin borrar lo que había.", objetivo: ".re-panel-tool[data-panel='copiar'] .re-interruptor", tab: "copiar" }
    ]
  },
  {
    id: "completar",
    titulo: "Completar con tu estilo",
    resumen: "Que el editor siga tu mano.",
    pasos: [
      { texto: "Edita a mano el principio de la canción, tantos compases como quieras.", objetivo: "#reLienzo" },
      { texto: "Pon el cursor donde terminaste.", objetivo: "#reLienzo" },
      { texto: "«Completar desde el cursor» genera el resto imitando tu densidad, tus rachas por carril, tus largas y tus dobles. Lo anterior no se toca.", objetivo: "#reCompletar", tab: "completar" },
      { texto: "Si no te convence, Ctrl + Z lo deshace de una vez.", objetivo: "#reDeshacer" }
    ]
  },
  {
    id: "guardar",
    titulo: "Guardar, firmar y probar",
    resumen: "Publicar tu mapa.",
    pasos: [
      { texto: "Escribe tu firma. Sale en el juego junto a la estrella del mapa.", objetivo: "#reFirma" },
      { texto: "«Probar en el juego» abre Zarabanda con tu mapa sin guardar. Solo lo ves tú, en este navegador.", objetivo: "#reProbar" },
      { texto: "«Guardar para los jugadores» lo publica. Desde ese momento lo juega todo el mundo.", objetivo: "#reGuardar" },
      { texto: "Exportar guarda una copia en un archivo y Importar la vuelve a cargar. Sirve de respaldo.", objetivo: ["#reExportar", "#reImportar"] }
    ]
  },
  {
    id: "rocola",
    titulo: "Subir canciones",
    resumen: "Añadir un mp3 a la rocola.",
    pasos: [
      { texto: "Abre «Subir una canción a la rocola», más abajo en la página.", objetivo: "#reRocola", abrir: "#reRocola" },
      { texto: "Elige el mp3 (hasta 30 MB) y revisa el título y el artista.", objetivo: "#reRocolaForm", abrir: "#reRocola" },
      { texto: "Al subirla sale en la rocola y en Zarabanda para todos. Las que subiste aparecen abajo y las puedes quitar.", objetivo: "#reRocolaLista", abrir: "#reRocola" }
    ]
  },
  {
    id: "probar",
    titulo: "Probar y repetir un tramo",
    resumen: "Juega el mapa sin salir del editor.",
    pasos: [
      { texto: "En la pestaña Probar activa el modo prueba. Con la música sonando, Z D F ↑ tocan arriba y X J K ↓ tocan abajo.", objetivo: ".re-panel-tool[data-panel='probar']", tab: "probar" },
      { texto: "Arriba a la derecha de la línea de tiempo ves tu combo, los perfectos, los bien y los fallos. Un anillo marca cada nota que juzgó.", objetivo: "#reLienzo" },
      { texto: "Para repetir una parte, marca el inicio (A) y el final (B) con el cursor, o usa «Bucle del tramo elegido».", objetivo: "#reBucleTramo", tab: "probar" },
      { texto: "Con el bucle activo, la música vuelve a A cada vez que llega a B. Quítalo cuando termines.", objetivo: "#reQuitarBucle", tab: "probar" }
    ]
  },
  {
    id: "revisar",
    titulo: "Revisar el mapa",
    resumen: "Encontrar errores antes de guardar.",
    pasos: [
      { texto: "En la pestaña Revisar, «Revisar el mapa» busca largas que pisan notas, dobles dentro de largas, notas encimadas y partes demasiado cargadas o vacías.", objetivo: "#reRevisar", tab: "revisar" },
      { texto: "Cada problema tiene un botón «Ir» que te lleva a ese punto. Arriba ves las estadísticas del mapa.", objetivo: "#reRevisarLista", tab: "revisar" },
      { texto: "«Corregir lo corregible» arregla las largas, las dobles y las notas repetidas. Al guardar, el editor revisa solo y te avisa si hay errores.", objetivo: "#reCorregir", tab: "revisar" }
    ]
  },
  {
    id: "dificultades",
    titulo: "Derivar dificultades",
    resumen: "Sacar Normal o Difícil desde un mapa hecho.",
    pasos: [
      { texto: "Guarda primero el mapa que hiciste a mano, en la dificultad que sea.", objetivo: "#reGuardar" },
      { texto: "Elige arriba la dificultad que quieres crear y abre la pestaña Dificultades.", objetivo: ".re-segmentos[data-para='reDif']" },
      { texto: "Elige de cuál mapa partir. Hacia una más fácil se quitan notas con cuidado de no perder el ritmo; hacia una más difícil se añaden notas en los huecos con tu estilo.", objetivo: "#reDerivarOrigen", tab: "dificultades" },
      { texto: "Pulsa «Derivar». El resultado queda en el editor, sin guardar: revísalo, retócalo y guarda.", objetivo: "#reDerivar", tab: "dificultades" }
    ]
  },
  {
    id: "tempo",
    titulo: "Cambiar el tempo",
    resumen: "BPM a mano, tap tempo y pulsos sueltos.",
    pasos: [
      { texto: "Para mover un solo pulso, mantén Alt y arrastra su línea. Los demás no se tocan.", objetivo: "#reLienzo" },
      { texto: "Si la canción cambia de tempo, pon el cursor en el pulso donde cambia, escribe el BPM y pulsa «Aplicar desde el cursor».", objetivo: "#reBpmValor", tab: "pulso" },
      { texto: "O reproduce y toca la tecla T al ritmo, al menos 4 veces. Verás el BPM que sale. «Aplicar al resto» rehace los pulsos desde tu primer toque.", objetivo: "#reTap", tab: "pulso" },
      { texto: "Las notas ya puestas no se mueven. Si quieres que sigan al pulso nuevo, genera ese tramo de nuevo desde la pestaña Tramos.", objetivo: ".re-panel-tool[data-panel='tramos']", tab: "tramos" }
    ]
  },
  {
    id: "historial",
    titulo: "Historial y conflictos",
    resumen: "Volver a una versión y no pisar a nadie.",
    pasos: [
      { texto: "Si alguien guarda el mapa mientras lo editas, al guardar te avisa quién fue y cuándo, antes de pisar su trabajo.", objetivo: "#reGuardar" },
      { texto: "Cada guardado y cada borrado deja una copia. Abre «Historial y registro de cambios» para verlas.", objetivo: "#reHistorial", abrir: "#reHistorial" },
      { texto: "«Cargar» pone esa versión en el editor sin guardar nada. Si te sirve, guárdala y será la actual.", objetivo: "#reVersiones", abrir: "#reHistorial" },
      { texto: "Además, cada minuto tu trabajo se guarda en este navegador. Si se cierra la pestaña, al volver te ofrece recuperarlo.", objetivo: "#reCancion" }
    ]
  },
  {
    id: "marcas",
    titulo: "Marcas y secciones",
    resumen: "Apuntes sobre la línea de tiempo.",
    pasos: [
      { texto: "Pon el cursor donde quieras dejar una nota, elige si es una sección (dorada) o un comentario (celeste) y escribe el texto.", objetivo: "#reMarcaTexto", tab: "marcas" },
      { texto: "Pulsa «Añadir en el cursor». Sale como una banderita en la regla de arriba. «Ir» te lleva a ella desde la lista.", objetivo: "#reMarcaAgregar", tab: "marcas" },
      { texto: "Las marcas se guardan con el mapa, así que las ve el siguiente DJ que lo abra.", objetivo: "#reMarcasLista", tab: "marcas" }
    ]
  },
  {
    id: "patrones",
    titulo: "Patrones guardados",
    resumen: "Guarda un grupo de notas y pégalo donde quieras.",
    pasos: [
      { texto: "Selecciona las notas que forman el patrón, con los tramos o con el recuadro de selección.", objetivo: "#reLienzo" },
      { texto: "Ponle un nombre y pulsa «Guardar la selección». Lo ven todos los DJ.", objetivo: "#rePatronGuardar", tab: "patrones" },
      { texto: "Pon el cursor en un pulso y pulsa «Pegar en el cursor». El patrón se adapta al tempo de ese punto.", objetivo: "#rePatronesLista", tab: "patrones" }
    ]
  },
  {
    id: "guia",
    titulo: "Guía de otra dificultad",
    resumen: "Ver las notas de otro mapa en gris.",
    pasos: [
      { texto: "Si la canción tiene otra dificultad guardada, elígela aquí. Sus notas salen en gris detrás de las tuyas.", objetivo: "#reSuperponer" },
      { texto: "Sirve para que Difícil no se salga de lo que ya hiciste en Normal, o para ver qué notas faltan.", objetivo: "#reLienzo" }
    ]
  },
  {
    id: "jugadores",
    titulo: "Dónde fallan los jugadores",
    resumen: "Los tramos difíciles, con datos reales.",
    pasos: [
      { texto: "Cada partida anota en qué tramos de 4 segundos se falla. Pulsa «Cargar los fallos» para verlo.", objetivo: "#reVerFallosBtn", tab: "revisar" },
      { texto: "Los tramos con más fallos salen en naranja en la tira de abajo y en la lista. Si un tramo falla casi todo el mundo, quizá convenga aligerarlo.", objetivo: "#reFallosLista", tab: "revisar" },
      { texto: "Los datos son de la versión actual del mapa. Si lo guardas de nuevo, empiezan de cero.", objetivo: "#reVerFallos", tab: "revisar" }
    ]
  }
];
