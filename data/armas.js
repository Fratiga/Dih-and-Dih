window.ARMAS = [
  {
    id: "garrote",
    title: "Garrote",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "contundente"],
    summary: "Un trozo de madera endurecida, rudimentario pero eficaz.",
    daño: "1d4", tipoDano: "Contundente", alcance: "", peso: "2 lb", coste: "1 PP",
    escala: "Fuerza",
    propiedades: ["Ligera"],
    content: `
      <p>Un trozo de madera endurecida, rudimentario pero eficaz.</p>
      <p><em> Dicen que las primeras armas de los hombres no fueron forjadas.</em></p>
    `
  },
  {
    id: "daga",
    title: "Daga",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "perforante"],
    summary: "Una hoja corta diseñada para llevarse oculta y utilizarse a corta distancia o arrojadiza.",
    daño: "1d4", tipoDano: "Perforante", alcance: "6/18 m", peso: "1 lb", coste: "2 PO",
    escala: "Fuerza o Destreza",
    propiedades: ["Sutil", "Ligera", "Arrojadiza (6/18 m)"],
    content: `
      <p>Una hoja corta diseñada para llevarse oculta y utilizarse a corta distancia o arrojadiza.</p>
      <p><em> Una buena daga rara vez se ve antes de ser utilizada. Mientras que una mala, casi nunca sobrevive a su dueño.</em></p>
    `
  },
  {
    id: "garrote-grande",
    title: "Garrote grande",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "contundente"],
    summary: "Un grueso tronco reforzado, demasiado tosco para llamarlo arma refinada.",
    daño: "1d8", tipoDano: "Contundente", alcance: "", peso: "10 lb", coste: "2 PP",
    escala: "Fuerza",
    propiedades: ["A dos manos"],
    content: `
      <p>Un grueso tronco reforzado, demasiado tosco para llamarlo arma refinada.</p>
      <p><em> No necesita filo quien posee la fuerza suficiente para hacer del hueso una astilla.</em></p>
    `
  },
  {
    id: "hacha-de-mano",
    title: "Hacha de mano",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "cortante"],
    summary: "Un hacha pequeña, útil tanto para el combate como para las tareas cotidianas.",
    daño: "1d6", tipoDano: "Cortante", alcance: "6/18 m", peso: "2 lb", coste: "5 PO",
    escala: "Fuerza",
    propiedades: ["Ligera", "Arrojadiza (6/18 m)"],
    content: `
      <p>Un hacha pequeña, útil tanto para el combate como para las tareas cotidianas.</p>
      <p><em> Muchos leñadores han aprendido que la distancia entre cortar un árbol y cortar una garganta es menor de lo que parece.</em></p>
    `
  },
  {
    id: "jabalina",
    title: "Jabalina",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "perforante"],
    summary: "Una lanza ligera equilibrada para ser arrojada.",
    daño: "1d6", tipoDano: "Perforante", alcance: "9/36 m", peso: "2 lb", coste: "5 PP",
    escala: "Fuerza",
    propiedades: ["Arrojadiza (9/36 m)"],
    content: `
      <p>Una lanza ligera equilibrada para ser arrojada.</p>
      <p><em> La jabalina no mata por su fuerza, mata más por la certeza con la que encuentra su destino.</em></p>
    `
  },
  {
    id: "martillo-ligero",
    title: "Martillo ligero",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "contundente"],
    summary: "Un martillo pequeño empleado por herreros, artesanos y soldados.",
    daño: "1d4", tipoDano: "Contundente", alcance: "6/18 m", peso: "2 lb", coste: "2 PO",
    escala: "Fuerza",
    propiedades: ["Ligera", "Arrojadiza (6/18 m)"],
    content: `
      <p>Un martillo pequeño empleado por herreros, artesanos y soldados.</p>
      <p><em> Antes de aprender a blandir una espada, todo herrero aprende a golpear.</em></p>
    `
  },
  {
    id: "maza",
    title: "Maza",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "contundente"],
    summary: "Una pesada cabeza de metal montada sobre un asta corta.",
    daño: "1d6", tipoDano: "Contundente", alcance: "", peso: "4 lb", coste: "5 PO",
    escala: "Fuerza",
    propiedades: [],
    content: `
      <p>Una pesada cabeza de metal montada sobre un asta corta.</p>
      <p><em> La armadura protege de los filos. Poco puede hacer contra aquello que pretende aplastarla.</em></p>
    `
  },
  {
    id: "baston",
    title: "Bastón",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "contundente"],
    summary: "Un sencillo bastón de madera utilizado por viajeros, peregrinos y magos.",
    daño: "1d6", tipoDano: "Contundente", alcance: "", peso: "4 lb", coste: "2 PP",
    escala: "Fuerza",
    propiedades: ["Versátil (1d8)"],
    content: `
      <p>Un sencillo bastón de madera utilizado por viajeros, peregrinos y magos.</p>
      <p><em> Algunos bastones han acompañado a sus dueños durante más años que cualquier espada.</em></p>
    `
  },
  {
    id: "hoz",
    title: "Hoz",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "cortante"],
    summary: "Una hoja curva empleada originalmente para segar cultivos.",
    daño: "1d4", tipoDano: "Cortante", alcance: "", peso: "2 lb", coste: "1 PO",
    escala: "Fuerza",
    propiedades: ["Ligera"],
    content: `
      <p>Una hoja curva empleada originalmente para segar cultivos.</p>
      <p><em> La cosecha y la muerte comparten una vieja costumbre: ninguna distingue entre lo que está listo y lo que aún no.</em></p>
    `
  },
  {
    id: "lanza",
    title: "Lanza",
    category: "Armas",
    tags: ["simple", "cuerpo a cuerpo", "perforante"],
    summary: "Una punta de metal fijada a un largo asta de madera.",
    daño: "1d6", tipoDano: "Perforante", alcance: "6/18 m", peso: "3 lb", coste: "1 PO",
    escala: "Fuerza",
    propiedades: ["Arrojadiza (6/18 m)", "Versátil (1d8)"],
    content: `
      <p>Una punta de metal fijada a un largo asta de madera.</p>
      <p><em> La lanza fue entregada al campesino antes que la espada al caballero. Quizá por eso tantos reinos olvidan de quién nació realmente su ejército.</em></p>
    `
  },
  {
    id: "ballesta-ligera",
    title: "Ballesta ligera",
    category: "Armas",
    tags: ["simple", "a distancia", "perforante"],
    summary: "Una ballesta compacta que dispara virotes con considerable fuerza.",
    daño: "1d8", tipoDano: "Perforante", alcance: "24/96 m", peso: "5 lb", coste: "25 PO",
    escala: "Destreza",
    propiedades: ["Munición (24/96 m)", "Recarga", "A dos manos"],
    content: `
      <p>Una ballesta compacta que dispara virotes con considerable fuerza.</p>
      <p><em> Donde el entrenamiento de años cabe en un mecanismo de madera, los nobles encontraron una razón más para temer al campesino.</em></p>
    `
  },
  {
    id: "dardo",
    title: "Dardo",
    category: "Armas",
    tags: ["simple", "a distancia", "perforante"],
    summary: "Un pequeño proyectil equilibrado para ser lanzado con precisión.",
    daño: "1d4", tipoDano: "Perforante", alcance: "6/18 m", peso: "¼ lb", coste: "5 PC",
    escala: "Destreza",
    propiedades: ["Sutil", "Arrojadizo (6/18 m)"],
    content: `
      <p>Un pequeño proyectil equilibrado para ser lanzado con precisión.</p>
      <p><em> Pequeño como una mentira y, en las manos adecuadas, igual de mortal.</em></p>
    `
  },
  {
    id: "arco-corto",
    title: "Arco corto",
    category: "Armas",
    tags: ["simple", "a distancia", "perforante"],
    summary: "Un arco compacto, fácil de transportar y utilizar incluso en terrenos cerrados.",
    daño: "1d6", tipoDano: "Perforante", alcance: "24/96 m", peso: "2 lb", coste: "25 PO",
    escala: "Destreza",
    propiedades: ["Munición (24/96 m)", "A dos manos"],
    content: `
      <p>Un arco compacto, fácil de transportar y utilizar incluso en terrenos cerrados.</p>
      <p><em> Basta con escuchar el silencio que viene después para saber si diste en el blanco.</em></p>
    `
  },
  {
    id: "honda",
    title: "Honda",
    category: "Armas",
    tags: ["simple", "a distancia", "contundente"],
    summary: "Una tira de cuero capaz de convertir una piedra ordinaria en un proyectil mortal.",
    daño: "1d4", tipoDano: "Contundente", alcance: "9/36 m", peso: "—", coste: "1 PP",
    escala: "Destreza",
    propiedades: ["Munición (9/36 m)"],
    content: `
      <p>Una tira de cuero capaz de convertir una piedra ordinaria en un proyectil mortal.</p>
      <p><em> Los ejércitos desprecian las piedras hasta que empiezan a morir por ellas.</em></p>
    `
  },
  {
    id: "hacha-de-batalla",
    title: "Hacha de batalla",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Un arma de guerra diseñada para cortar con un único golpe pesado.",
    daño: "1d8", tipoDano: "Cortante", alcance: "", peso: "4 lb", coste: "10 PO",
    escala: "Fuerza",
    propiedades: ["Versátil (1d10)"],
    content: `
      <p>Un arma de guerra diseñada para cortar con un único golpe pesado.</p>
      <p><em> El filo no distingue entre armadura, carne, material o individuo. Solo entre que puede cortar y aquello que todavía no.</em></p>
    `
  },
  {
    id: "mayal",
    title: "Mayal",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "contundente"],
    summary: "Una cabeza de metal unida mediante una cadena a su empuñadura.",
    daño: "1d8", tipoDano: "Contundente", alcance: "", peso: "2 lb", coste: "10 PO",
    escala: "Fuerza",
    propiedades: [],
    content: `
      <p>Una cabeza de metal unida mediante una cadena a su empuñadura.</p>
      <p><em> Arma difícil, incluso para quien la empuña. Tal vez por eso sus heridas suelen ser tan impredecibles.</em></p>
    `
  },
  {
    id: "guja",
    title: "Guja",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una larga asta coronada por una hoja curva.",
    daño: "1d10", tipoDano: "Cortante", alcance: "", peso: "6 lb", coste: "20 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "Alcance", "A dos manos"],
    content: `
      <p>Una larga asta coronada por una hoja curva.</p>
      <p><em> Los soldados que la portan permanecen detrás de la primera línea. La idea es que sus enemigos rara vez lleguen a descubrir por qué.</em></p>
    `
  },
  {
    id: "hacha-a-dos-manos",
    title: "Hacha a dos manos",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una enorme hacha cuyo peso exige ambas manos para ser manejada correctamente.",
    daño: "1d12", tipoDano: "Cortante", alcance: "", peso: "7 lb", coste: "30 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "A dos manos"],
    content: `
      <p>Una enorme hacha cuyo peso exige ambas manos para ser manejada correctamente.</p>
      <p><em> No fue creada para vencer duelos.</em></p>
    `
  },
  {
    id: "espadon",
    title: "Espadón",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una espada enorme cuyo peso y longitud requieren una fuerza considerable.",
    daño: "2d6", tipoDano: "Cortante", alcance: "", peso: "6 lb", coste: "50 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "A dos manos"],
    content: `
      <p>Una espada enorme cuyo peso y longitud requieren una fuerza considerable.</p>
      <p><em> Muy pocos tienen lo necesario para empuñar este monstruo increíblemente pesado y capaz de infligir un gran daño. Es una de las armas favoritas de los caballeros de Berenike.</em></p>
    `
  },
  {
    id: "alabarda",
    title: "Alabarda",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una larga arma de asta que combina una hoja de hacha con una punta de lanza.",
    daño: "1d10", tipoDano: "Cortante", alcance: "", peso: "6 lb", coste: "20 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "Alcance", "A dos manos"],
    content: `
      <p>Una larga arma de asta que combina una hoja de hacha con una punta de lanza.</p>
      <p><em> Tal como los muros tienen puertas. Los hombres también. La alabarda fue hecha para decidir dónde termina una formación.</em></p>
    `
  },
  {
    id: "lanza-de-caballeria",
    title: "Lanza de caballería",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Una lanza especialmente larga destinada principalmente al combate montado.",
    daño: "1d12", tipoDano: "Perforante", alcance: "", peso: "6 lb", coste: "10 PO",
    escala: "Fuerza",
    propiedades: ["Alcance", "Especial"],
    content: `
      <p>Una lanza especialmente larga destinada principalmente al combate montado.</p>
      <p><em> Cuando el caballo comienza a correr, el caballero deja de ser un hombre y se convierte en la punta de un proyectil.</em></p>
      <h4>Regla especial</h4>
      <p>Tienes desventaja cuando utilizas una lanza de caballería para atacar a una criatura que se
      encuentre a 5 pies de ti. Además, una lanza de caballería requiere dos manos para utilizarse
      cuando no estás montado. Cuando estás montado, puedes utilizarla con una sola mano.</p>
    `
  },
  {
    id: "espada-larga",
    title: "Espada larga",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una espada equilibrada que puede utilizarse tanto con una como con ambas manos.",
    daño: "1d8", tipoDano: "Cortante", alcance: "", peso: "3 lb", coste: "15 PO",
    escala: "Fuerza",
    propiedades: ["Versátil (1d10)"],
    content: `
      <p>Una espada equilibrada que puede utilizarse tanto con una como con ambas manos.</p>
      <p><em> La espada larga no pide fuerza ni astucia. Necesita ambas, y castiga al que carece de cualquiera de ellas.</em></p>
    `
  },
  {
    id: "maza-de-guerra",
    title: "Maza de guerra",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "contundente"],
    summary: "Una enorme arma de metal diseñada para destruir incluso las protecciones más resistentes.",
    daño: "2d6", tipoDano: "Contundente", alcance: "", peso: "10 lb", coste: "10 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "A dos manos"],
    content: `
      <p>Una enorme arma de metal diseñada para destruir incluso las protecciones más resistentes.</p>
      <p><em> Los herreros que la fabricaron aprendieron una verdad sencilla: todo metal puede doblarse. Solo hace falta suficiente fuerza.</em></p>
    `
  },
  {
    id: "lucero-del-alba",
    title: "Lucero del alba",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Una esfera metálica cubierta de púas montada sobre un asta.",
    daño: "1d8", tipoDano: "Perforante", alcance: "", peso: "4 lb", coste: "15 PO",
    escala: "Fuerza",
    propiedades: [],
    content: `
      <p>Una esfera metálica cubierta de púas montada sobre un asta.</p>
      <p><em> Las estrellas que brillan en el cielo son hermosas. Las que descienden a la tierra rara vez comparten esa belleza.</em></p>
    `
  },
  {
    id: "pica",
    title: "Pica",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Una larguísima asta terminada en una punta de metal.",
    daño: "1d10", tipoDano: "Perforante", alcance: "", peso: "18 lb", coste: "5 PO",
    escala: "Fuerza",
    propiedades: ["Pesada", "Alcance", "A dos manos"],
    content: `
      <p>Una larguísima asta terminada en una punta de metal.</p>
      <p><em> Una muralla de lanzas convierte al cobarde en soldado.</em></p>
    `
  },
  {
    id: "estoque",
    title: "Estoque",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Una espada estrecha diseñada para realizar estocadas rápidas y precisas.",
    daño: "1d8", tipoDano: "Perforante", alcance: "", peso: "2 lb", coste: "25 PO",
    escala: "Fuerza o Destreza",
    propiedades: ["Sutil"],
    content: `
      <p>Una espada estrecha diseñada para realizar estocadas rápidas y precisas.</p>
      <p><em> Una hoja fina no necesita atravesar una armadura. Solo necesita encontrar lo que la armadura olvidó proteger.</em></p>
    `
  },
  {
    id: "cimitarra",
    title: "Cimitarra",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una espada ligera de hoja curva, especialmente eficaz en movimientos rápidos.",
    daño: "1d6", tipoDano: "Cortante", alcance: "", peso: "3 lb", coste: "25 PO",
    escala: "Fuerza o Destreza",
    propiedades: ["Sutil", "Ligera"],
    content: `
      <p>Una espada ligera de hoja curva, especialmente eficaz en movimientos rápidos.</p>
      <p><em> En las tierras donde nació, las espadas rectas eran consideradas demasiado honestas.</em></p>
    `
  },
  {
    id: "espada-corta",
    title: "Espada corta",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Una espada pequeña y ligera, fácil de portar y manejar en espacios reducidos.",
    daño: "1d6", tipoDano: "Perforante", alcance: "", peso: "2 lb", coste: "10 PO",
    escala: "Fuerza o Destreza",
    propiedades: ["Sutil", "Ligera"],
    content: `
      <p>Una espada pequeña y ligera, fácil de portar y manejar en espacios reducidos.</p>
      <p><em> Muchos héroes comenzaron con una espada corta. Mientras que muchos otros no vivieron lo suficiente para conseguir una más grande.</em></p>
    `
  },
  {
    id: "tridente",
    title: "Tridente",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Un arma de tres puntas empleada tanto en tierra como en el mar.",
    daño: "1d6", tipoDano: "Perforante", alcance: "6/18 m", peso: "4 lb", coste: "5 PO",
    escala: "Fuerza",
    propiedades: ["Arrojadizo (6/18 m)", "Versátil (1d8)"],
    content: `
      <p>Un arma de tres puntas empleada tanto en tierra como en el mar.</p>
      <p><em> Los pescadores lo utilizan para capturar lo que vive bajo el agua. Los reyes aprendieron a utilizarlo para capturar hombres.</em></p>
    `
  },
  {
    id: "pico-de-guerra",
    title: "Pico de guerra",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "perforante"],
    summary: "Un arma diseñada para concentrar toda su fuerza en una pequeña punta.",
    daño: "1d8", tipoDano: "Perforante", alcance: "", peso: "2 lb", coste: "5 PO",
    escala: "Fuerza",
    propiedades: [],
    content: `
      <p>Un arma diseñada para concentrar toda su fuerza en una pequeña punta.</p>
      <p><em> Allí donde la espada rebota, la pica atraviesa.</em></p>
    `
  },
  {
    id: "martillo-de-guerra",
    title: "Martillo de guerra",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "contundente"],
    summary: "Un martillo equilibrado para el combate, capaz de utilizarse con una o dos manos.",
    daño: "1d8", tipoDano: "Contundente", alcance: "", peso: "2 lb", coste: "15 PO",
    escala: "Fuerza",
    propiedades: ["Versátil (1d10)"],
    content: `
      <p>Un martillo equilibrado para el combate, capaz de utilizarse con una o dos manos.</p>
      <p><em> Los caballeros llevan espadas para ser recordados. Pero quienes llevan martillos lo hacen para que nadie lo sea.</em></p>
    `
  },
  {
    id: "latigo",
    title: "Látigo",
    category: "Armas",
    tags: ["marcial", "cuerpo a cuerpo", "cortante"],
    summary: "Una larga tira flexible capaz de golpear desde una distancia considerable.",
    daño: "1d4", tipoDano: "Cortante", alcance: "", peso: "3 lb", coste: "2 PO",
    escala: "Fuerza o Destreza",
    propiedades: ["Sutil", "Alcance"],
    content: `
      <p>Una larga tira flexible capaz de golpear desde una distancia considerable.</p>
      <p><em> Un recordatorio de que el dolor no necesita una hoja.</em></p>
    `
  },
  {
    id: "cerbatana",
    title: "Cerbatana",
    category: "Armas",
    tags: ["marcial", "a distancia", "perforante"],
    summary: "Un tubo estrecho utilizado para lanzar pequeños proyectiles.",
    daño: "1", tipoDano: "Perforante", alcance: "7,5/30 m", peso: "1 lb", coste: "10 PO",
    escala: "Destreza",
    propiedades: ["Munición (7,5/30 m)", "Recarga"],
    content: `
      <p>Un tubo estrecho utilizado para lanzar pequeños proyectiles.</p>
      <p><em> En manos de un guerrero es poco más que una herramienta. Pero en manos de un asesino, puede ser la última cosa que escuches.</em></p>
    `
  },
  {
    id: "ballesta-de-mano",
    title: "Ballesta de mano",
    category: "Armas",
    tags: ["marcial", "a distancia", "perforante"],
    summary: "Una pequeña ballesta diseñada para ser utilizada con una sola mano.",
    daño: "1d6", tipoDano: "Perforante", alcance: "9/36 m", peso: "3 lb", coste: "75 PO",
    escala: "Destreza",
    propiedades: ["Munición (9/36 m)", "Ligera", "Recarga"],
    content: `
      <p>Una pequeña ballesta diseñada para ser utilizada con una sola mano.</p>
      <p><em> Los asesinos la prefieren por una razón sencilla: no exige que su dueño sea fuerte, solo que esté cerca.</em></p>
    `
  },
  {
    id: "ballesta-pesada",
    title: "Ballesta pesada",
    category: "Armas",
    tags: ["marcial", "a distancia", "perforante"],
    summary: "Una gran ballesta capaz de lanzar virotes con una fuerza devastadora.",
    daño: "1d10", tipoDano: "Perforante", alcance: "30/120 m", peso: "18 lb", coste: "50 PO",
    escala: "Destreza",
    propiedades: ["Munición (30/120 m)", "Pesada", "Recarga", "A dos manos"],
    content: `
      <p>Una gran ballesta capaz de lanzar virotes con una fuerza devastadora.</p>
      <p><em> Sus usuarios dicen que cargarla es una molestia. Los muertos suelen opinar que vale la pena.</em></p>
    `
  },
  {
    id: "arco-largo",
    title: "Arco largo",
    category: "Armas",
    tags: ["marcial", "a distancia", "perforante"],
    summary: "Un arco de gran tamaño capaz de alcanzar objetivos a distancias extraordinarias.",
    daño: "1d8", tipoDano: "Perforante", alcance: "45/180 m", peso: "2 lb", coste: "50 PO",
    escala: "Destreza",
    propiedades: ["Munición (45/180 m)", "Pesada", "A dos manos"],
    content: `
      <p>Un arco de gran tamaño capaz de alcanzar objetivos a distancias extraordinarias.</p>
      <p><em> Tiene un alcance mayor que los arcos estándar, pero es más difícil de usar. Sin las habilidades adecuadas, los resultados serán decepcionantes.</em></p>
    `
  },
  {
    id: "red",
    title: "Red",
    category: "Armas",
    tags: ["marcial", "a distancia", "especial"],
    summary: "Una pesada red preparada para atrapar criaturas y restringir sus movimientos.",
    daño: "—", tipoDano: "—", alcance: "1,5/4,5 m", peso: "3 lb", coste: "1 PO",
    escala: "Destreza",
    propiedades: ["Especial", "Arrojadiza (1,5/4,5 m)"],
    content: `
      <p>Una pesada red preparada para atrapar criaturas y restringir sus movimientos.</p>
      <p><em> A las bestias más grandes basta con recordarles que también pueden ser atrapadas.</em></p>
      <h4>Regla especial</h4>
      <p>Una criatura Grande o más pequeña que sea impactada por una red queda restringida hasta que
      sea liberada. Una criatura puede utilizar su acción para realizar una prueba de Fuerza CD 10 y
      liberarse. La red también puede destruirse: tiene CA 10, 5 puntos de golpe y es inmune al daño
      contundente, venenoso y psíquico. Reducirla a 0 puntos de golpe la destruye. Al atacar con una
      red solo puede realizarse un ataque, independientemente de cuántos ataques puedas hacer
      normalmente.</p>
    `
  }
];
