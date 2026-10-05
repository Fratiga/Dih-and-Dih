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
  }
];
