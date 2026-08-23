window.PERSONAJES = [
  {
    id: "rook",
    title: "Rook",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Líder de Las Comadrejas, asesino y ejecutor.",
    retrato: "",
    titulo: "Líder de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Asesino / Ejecutor",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A"],
    relacionesConocidas: [
      { id: "bull", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" },
      { id: "baraja", nota: "Compañero de banda" }
    ],
    content: `
      <p>El líder de Las Comadrejas. Frío, metódico y de reputación temida. Se dice
      que nunca ha aceptado un encargo que no pudiera completar.</p>
    `
  },
  {
    id: "bull",
    title: "Bull",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Miembro de Las Comadrejas, bruto pero paciente.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "rook", nota: "lider de banda" },
      { id: "baraja", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"El que se mueva primero, muere primero."</em></p>
      <p>Miembro de Las Comadrejas junto a Baraja desde la infancia. Bruto pero
      paciente, prefiere ocupar puertas, pasillos y puentes antes que perseguir.</p>
    `
  },
  {
    id: "garra",
    title: "Garra",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Miembro más nuevo de Las Comadrejas, mal genio e impaciente.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Semigigante",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "rook", nota: "Compañero de banda" },
      { id: "bull", nota: "Compañero de banda" },
      { id: "baraja", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"Nunca tuve que correr tras una presa."</em></p>
      <p>El miembro más nuevo del trío. Mal genio e impaciente, se encarga de
      mantener alejados a los curiosos y separar a sus objetivos del resto.</p>
    `
  },
  {
    id: "baraja",
    title: "Baraja",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "El cerebro de Las Comadrejas.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "bull", nota: "Compañero de banda" },
      { id: "rook", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"Las probabilidades siempre están de mi lado."</em></p>
      <p>Compañero de banda —y algunos dicen que algo más— de Bull. El cerebro del trío.
      Nunca entra en combate cuerpo a cuerpo y siempre actúa al final.</p>
    `
  },
  {
    id: "ocevat",
    title: "Ocevat",
    category: "Personajes",
    tags: ["npc", "aarakocra", "refugio", "har"],
    summary: "Paladín aarakocra que murió defendiendo el refugio y a los protagonistas.",
    retrato: "",
    titulo: "Paladín",
    raza: "Aarakocra",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Paladín",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A", "B"],
    relacionesConocidas: [],
    content: `
      <p>Un paladín aarakocra, noble y de trato amable incluso en medio del desastre.
      Luchó junto a los protagonistas en la defensa del refugio y no sobrevivió a esa
      noche, pero antes de caer les encomendó una tarea que terminó definiendo el resto
      de su historia en Brurland: espantar al dragón que había caído sobre la ciudad.</p>
    `
  },
  {
    id: "verdam",
    title: "Verdam",
    category: "Personajes",
    tags: ["npc", "explorador", "refugio"],
    summary: "Explorador humano de paradero desconocido, encontrado junto a los cadáveres del refugio.",
    retrato: "",
    titulo: "Explorador",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Explorador",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A", "B"],
    relacionesConocidas: [],
    content: `
      <p>Un explorador humano, poco hablador y de intenciones difíciles de leer. Cuando
      los protagonistas llegaron al refugio lo encontraron junto a los cadáveres de los
      refugiados y de Ocevat, sin tiempo ni ocasión para hacerle una sola pregunta. En
      cuanto aparecieron los guardias, escapó del lugar sin dar explicaciones. Su
      paradero actual se desconoce.</p>
    `
  },
  {
    id: "eklino-a",
    title: "Eklino",
    category: "Personajes",
    tags: ["npc", "hombre-bestia", "refugio", "side-a"],
    summary: "Encargado del refugio, hombre bestia foca, murió defendiéndolo junto al resto de los suyos.",
    retrato: "",
    titulo: "Encargado del refugio",
    raza: "Hombre bestia (Foca)",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Encargado del refugio",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A"],
    relacionesConocidas: [],
    content: `
      <p>Un hombre bestia con rasgos de foca, encargado de organizar el refugio
      improvisado durante el ataque a Brurland. No se apartó de su puesto cuando la
      situación empeoró, y cayó esa noche junto al resto de quienes se quedaron a
      defenderlo hasta el final.</p>
    `
  },
  {
    id: "eklino-b",
    title: "Eklino",
    category: "Personajes",
    tags: ["npc", "hombre-bestia", "refugio", "side-b"],
    summary: "Encargado del refugio, hombre bestia foca, murió luchando contra los dragartos que lo asediaron.",
    retrato: "",
    titulo: "Encargado del refugio",
    raza: "Hombre bestia (Foca)",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Encargado del refugio",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un hombre bestia con rasgos de foca, encargado de organizar el refugio
      improvisado durante el ataque a Brurland. Murió luchando contra los dragartos
      que asediaron el refugio, defendiéndolo hasta el último momento.</p>
    `
  },
  {
    id: "coach-a",
    title: "Coach",
    category: "Personajes",
    tags: ["npc", "refugio", "side-a"],
    summary: "Aldeano del refugio, notablemente más fuerte que el resto, se sacrificó para salvar a Orina del aliento de un protodraco.",
    retrato: "",
    titulo: "Aldeano del refugio",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A"],
    relacionesConocidas: [],
    content: `
      <p>Un aldeano refugiado en Brurland aquella noche, bastante más fuerte que el
      resto de quienes se resguardaban junto a él. Cuando el aliento de un protodraco
      barrió la línea de defensa, se interpuso para salvar a Orina, y pagó esa decisión
      con su vida.</p>
    `
  },
  {
    id: "coach-b",
    title: "Coach",
    category: "Personajes",
    tags: ["npc", "refugio", "side-b"],
    summary: "Enviado por la familia de Ryn para encontrarla en Brurland, se sacrificó para salvar a los protagonistas del aliento del dragón.",
    retrato: "",
    titulo: "Enviado de la familia de Ryn",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Enviado por la familia de Ryn con la orden de encontrarla en Brurland, la
      búsqueda lo llevó directamente al ataque que sacudió la ciudad. Se sacrificó para
      salvar a los protagonistas del aliento del dragón, sin haber llegado siquiera a
      completar la misión que lo trajo hasta allí.</p>
    `
  },
  {
    id: "dagren",
    title: "Dagren",
    category: "Personajes",
    tags: ["npc", "bárbaro"],
    summary: "Bárbaro de edad avanzada que actualmente da refugio a los protagonistas en su granero.",
    retrato: "",
    titulo: "Bárbaro",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "",
    lado: ["A"],
    relacionesConocidas: [
      { id: "guillotina", nota: "Le arrancó un brazo al atacar su granero" }
    ],
    content: `
      <p>Un bárbaro ya entrado en años que les da refugio a los protagonistas en su
      granero, en las tierras de la Ley. Perdió un brazo cuando Guillotina, arrastrada
      hasta allí por accidente por los propios protagonistas, atacó la propiedad.</p>
    `
  },
  {
    id: "adam-kovacs",
    title: "Adam Kovacs",
    category: "Personajes",
    tags: ["npc", "guardia-real", "kigan"],
    summary: "Capitán de la Guardia Real, reconocido por su fuerza y agradecido con los protagonistas por su ayuda durante el ataque del dragón.",
    retrato: "",
    titulo: "Capitán de la Guardia Real",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Capitán de la Guardia Real",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Capitán de la Guardia Real, reconocido por su fuerza incluso entre sus propios
      soldados. Se encontraba en alta mar cuando el dragón atacó Brurland, y desde
      entonces está agradecido con los protagonistas por la ayuda que prestaron durante
      el ataque.</p>
    `
  },
  {
    id: "prisionero-enmascarado",
    title: "Prisionero Enmascarado",
    category: "Personajes",
    tags: ["npc", "prisionero", "kigan"],
    summary: "Prisionero con una máscara de hierro, encarcelado junto a otra persona por seducir a la reina.",
    retrato: "",
    titulo: "Prisionero",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un prisionero que nunca se quita la máscara de hierro que cubre su rostro.
      Terminó encerrado junto a otra persona por seducir a la reina, un escándalo que
      terminó en una orden de ejecución para ambos. Nadie parece haberlo visto sin la
      máscara, aunque se dice que es alguien muy hermoso.</p>
    `
  },
  {
    id: "sunny-y-hoare",
    title: "Sunny y Hoare",
    category: "Personajes",
    tags: ["npc", "prisioneros", "kigan"],
    summary: "Prisioneros a quienes los protagonistas ayudaron a escapar, amigos de los padres de Laia.",
    retrato: "",
    titulo: "Prisioneros",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Dos prisioneros a los que los protagonistas facilitaron la fuga desde los
      calabozos de Kigan. Son amigos de los padres de Laia, un vínculo que pesó a la
      hora de decidir ayudarlos.</p>
    `
  },
  {
    id: "orina",
    title: "Orina",
    category: "Personajes",
    tags: ["jugador", "goblin"],
    summary: "Paladín goblin fallecido, usado como proyectil para espantar al dragón durante el ataque a la Taberna del Gigante.",
    retrato: "",
    titulo: "Paladín",
    raza: "Goblin",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Paladín",
    faccion: "",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A"],
    relacionesConocidas: [
      { id: "edge", nota: "Compañero de huida" },
      { id: "hornet", nota: "Compañera de huida" },
      { id: "sir-buffolet", nota: "Compañero de huida" }
    ],
    content: `
      <p>Un paladín goblin que llegó a Brurland sin ningún objetivo claro, tan a la
      deriva como había vivido el resto de su vida, y que murió exactamente de la
      misma manera. Terminó en La Taberna del Gigante por pura casualidad la noche en
      que el dragón atacó la ciudad, y durante el caos alguien decidió usarlo como
      proyectil para intentar espantar a la bestia. No hacía falta, pero nadie se
      detuvo a pensarlo en ese momento.</p>
    `
  },
  {
    id: "edge",
    title: "Edge",
    category: "Personajes",
    tags: ["jugador", "humano"],
    summary: "Pícaro humano, único sobreviviente de la masacre de su banda a manos de un grupo rival.",
    retrato: "",
    titulo: "Pícaro",
    raza: "Humano",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Pícaro",
    faccion: "",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A"],
    relacionesConocidas: [
      { id: "orina", nota: "Compañero de huida" },
      { id: "hornet", nota: "Compañera de huida" },
      { id: "sir-buffolet", nota: "Compañero de huida" }
    ],
    content: `
      <p>Un pícaro humano, único superviviente de la masacre de su banda, Los
      Skibidi, a manos de un grupo rival. Vive escondido, dividido entre sobrevivir
      día a día y encontrar a los responsables de esa noche. El ataque del dragón lo
      arrastró de lleno al caos de Brurland, y fue entonces cuando se unió a Orina,
      Hornet y Sir Buffolet.</p>
    `
  },
  {
    id: "hornet",
    title: "Hornet",
    category: "Personajes",
    tags: ["jugador", "semielfo"],
    summary: "Exploradora semielfa, única sobreviviente de la masacre de su aldea.",
    retrato: "",
    titulo: "Exploradora",
    raza: "Semielfa",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Exploradora",
    faccion: "",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A"],
    relacionesConocidas: [
      { id: "orina", nota: "Compañero de huida" },
      { id: "edge", nota: "Compañero de huida" },
      { id: "sir-buffolet", nota: "Compañero de huida" }
    ],
    content: `
      <p>Una exploradora semielfa, única superviviente de la masacre de su aldea.
      Huyó hasta Brurland buscando algo parecido a un respiro, y lo encontró,
      brevemente, en La Taberna del Gigante, hasta que el dragón atacó la ciudad esa
      misma noche. Escapó junto a Edge, Orina y Sir Buffolet, y sigue con ellos desde
      entonces porque no tiene ningún otro lugar al que ir.</p>
    `
  },
  {
    id: "sir-buffolet",
    title: "Sir Buffolet",
    category: "Personajes",
    tags: ["jugador", "aarakocra"],
    summary: "Bardo aarakocra condenado a muerte por orden real tras ser el peor bufón que la corona haya soportado en siglos.",
    retrato: "",
    titulo: "Bardo",
    raza: "Aarakocra",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Bardo",
    faccion: "",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A"],
    relacionesConocidas: [
      { id: "orina", nota: "Compañero de huida" },
      { id: "edge", nota: "Compañero de huida" },
      { id: "hornet", nota: "Compañera de huida" }
    ],
    content: `
      <p>Un bardo aarakocra condenado a muerte por orden real, tras ganarse la
      distinción, poco envidiable, de ser el peor bufón que la corona haya soportado
      en siglos. Huyó de la ejecución y se escondió en los barrios bajos de Brurland,
      refugiándose finalmente en La Taberna del Gigante la noche en que el dragón
      atacó. Se unió a Orina, Hornet y Edge durante la huida, y ninguno de los cuatro
      se ha separado desde entonces.</p>
    `
  },
  {
    id: "enzo",
    title: "Enzo",
    category: "Personajes",
    tags: ["jugador", "humano"],
    summary: "Monje humano que perseguía a Orina por venganza; con su objetivo muerto, ahora busca entregar al resto de los fugitivos por su recompensa.",
    retrato: "",
    titulo: "Monje",
    raza: "Humano",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Monje",
    faccion: "",
    primeraAparicion: "El Descanso del Trasgo",
    lado: ["A"],
    relacionesConocidas: [
      { id: "orina", nota: "Objetivo original de venganza, fallecido" },
      { id: "mattei", nota: "Lo acompaña" }
    ],
    content: `
      <p>Un monje humano que llegó a Brurland persiguiendo a Orina, movido por una
      sed de venganza personal. La muerte de Orina durante el ataque del dragón le
      arrebató su objetivo, pero no la sed que lo trajo hasta aquí. Ahora la dirige
      contra el resto de los fugitivos, a quienes planea entregar a la ley a cambio
      de la recompensa que pesa sobre sus cabezas.</p>
    `
  },
  {
    id: "mattei",
    title: "Mattei",
    category: "Personajes",
    tags: ["jugador", "mediano"],
    summary: "Mediano pícaro que vivía solo en la calle hasta que Enzo lo encontró; ahora acompaña al grupo, sobre todo a él.",
    retrato: "",
    titulo: "Pícaro",
    raza: "Mediano",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Pícaro",
    faccion: "",
    primeraAparicion: "El Descanso del Trasgo",
    lado: ["A"],
    relacionesConocidas: [
      { id: "enzo", nota: "Lo sigue" }
    ],
    content: `
      <p>Un mediano pícaro tan pobre como falto de suerte. Vivió solo
      en la calle desde siempre, sobreviviendo de lo que otros descartaban, hasta que
      Enzo lo encontró y se lo llevó consigo. Ahora acompaña al grupo, aunque su
      lealtad, más que a la causa, parece estar puesta sobre todo en Enzo.</p>
    `
  },
  {
    id: "laia",
    title: "Laia",
    category: "Personajes",
    tags: ["jugador", "cambiaformas"],
    summary: "Cambiaformas pícaro, criado en una familia de ladrones, que partió de viaje para entender las emociones propias y ajenas.",
    retrato: "",
    titulo: "Pícaro",
    raza: "Cambiaformas",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Pícaro",
    faccion: "",
    primeraAparicion: "",
    lado: ["B"],
    relacionesConocidas: [
      { id: "sunny-y-hoare", nota: "Amigos de sus padres" }
    ],
    content: `
      <p>Un cambiaformas pícaro, criado dentro de una familia de ladrones. Su propia
      naturaleza cambiante siempre le dificultó entender el porqué de sus propias
      acciones, y mucho menos las de la gente a su alrededor. Harto de esa
      incertidumbre, partió de viaje decidido a entender las emociones —las suyas y
      las ajenas— de una vez por todas. El ataque del dragón no entraba, ni de lejos,
      en sus planes.</p>
    `
  },
  {
    id: "eledar-a",
    title: "Eledar",
    category: "Personajes",
    tags: ["jugador", "semielfo"],
    summary: "Tarotista semielfo, hijo bastardo criado por la tarotista que lo adoptó, en busca de su destino y su lugar en el mundo.",
    retrato: "",
    titulo: "Tarotista",
    raza: "Semielfo",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Tarotista",
    faccion: "",
    primeraAparicion: "",
    lado: ["A"],
    relacionesConocidas: [],
    content: `
      <p>Un tarotista semielfo, hijo bastardo de un elfo y una humana, criado por una
      tarotista que lo adoptó de niño después de que ambos padres lo consideraran una
      vergüenza compartida. Al llegar a la adultez, partió a buscar su destino y su
      lugar en el mundo con las únicas herramientas que tenía: las que le enseñó su
      maestra. Ni sus cartas vieron venir el arpón.</p>
    `
  },
  {
    id: "eledar-b",
    title: "Eledar",
    category: "Personajes",
    tags: ["jugador", "semielfo"],
    summary: "Tarotista semielfo, hijo bastardo criado por la tarotista que lo adoptó, en busca de su destino y su lugar en el mundo.",
    retrato: "",
    titulo: "Tarotista",
    raza: "Semielfo",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Tarotista",
    faccion: "",
    primeraAparicion: "",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un tarotista semielfo, hijo bastardo de un elfo y una humana, criado por una
      tarotista que lo adoptó de niño después de que ambos padres lo consideraran una
      vergüenza compartida. Al llegar a la adultez, partió a buscar su destino y su
      lugar en el mundo con las únicas herramientas que tenía: las que le enseñó su
      maestra. Ni sus cartas, sin embargo, vieron venir al dragón.</p>
    `
  },
  {
    id: "ryn",
    title: "Ryn",
    category: "Personajes",
    tags: ["jugador", "eladrin"],
    summary: "Bardo eladrin de familia adinerada de Fel, escapada de más de cien años de encierro para conocer el mundo por su cuenta.",
    retrato: "",
    titulo: "Bardo",
    raza: "Eladrin",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Bardo",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["B"],
    relacionesConocidas: [
      { id: "coach-b", nota: "Se sacrificó para salvarla" }
    ],
    content: `
      <p>Una bardo eladrin, hija de una familia adinerada de Fel que nunca la dejó
      salir de casa en más de cien años de vida. Harta del encierro y de conocer el
      mundo solo a través de los libros, se escapó decidida a experimentarlo de
      primera mano, ganarse un nombre propio y reclamar la autonomía que su familia
      nunca le concedió. De todo lo que había leído, un dragón no era exactamente lo
      que esperaba encontrarse primero.</p>
    `
  },
  {
    id: "hooey-magoo",
    title: "Hooey Magoo",
    category: "Personajes",
    tags: ["jugador", "slimefolk"],
    summary: "Bárbaro slimefolk que viste ropas de mago sin saber magia, a menudo confundido con un perro.",
    retrato: "",
    titulo: "Bárbaro",
    raza: "Slimefolk",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Bárbaro",
    faccion: "",
    primeraAparicion: "",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un bárbaro slimefolk que viste ropas de mago sin saber una sola palabra de
      magia, por razones que nadie —ni él mismo— ha logrado explicar. Su forma y su
      intelecto más bien limitado hacen que más de uno lo confunda con un perro a
      primera vista.</p>
    `
  },
  {
    id: "sigismund",
    title: "Sigismund",
    category: "Personajes",
    tags: ["jugador", "humano"],
    summary: "Paladín humano, antiguo discípulo de Ocevat, que se unió al grupo en la atalaya del castillo y no volvió a separarse de ellos.",
    retrato: "",
    titulo: "Paladín",
    raza: "Humano",
    tipo: "Jugador",
    lugarOrigen: "",
    ocupacion: "Paladín",
    faccion: "",
    primeraAparicion: "El Castillo",
    lado: ["B"],
    relacionesConocidas: [
      { id: "ocevat", nota: "Fue su maestro" }
    ],
    content: `
      <p>Un paladín humano, antiguo discípulo de Ocevat, que se sumó al grupo en la
      atalaya del castillo mientras cargaban la vieja balista contra el dragón. No
      volvió a separarse de ellos desde entonces, ni siquiera cuando terminaron
      encerrados en los calabozos de Kigan junto al resto. Bastante recto para su
      propio bien, y jamás se lo ve sin la armadura pesada que carga incluso para
      dormir.</p>
    `
  }
];
